"""Skill check: does a real small model actually pick up an agent's skills?

Runs the whole FORGE route through its own API against a running FORGE (start it first), so every step is visible in the app:

  1. create an agent from a template (synthetic data)
  2. generate verified practice tasks (template generator, or your teacher)
  3. create a study: your teacher + your student, chosen profile
  4. collect -> build -> train -> evaluate (practice) -> analyze, then print the test-adequacy verdict
  5. optionally (--seal) seal, run the final test, analyze it
  6. print the untrained vs trained comparison on paired tasks, skill by skill, with 95 % ranges, and save it as JSON

Nothing here decides anything: it reports measured numbers and where to look in the app. Synthetic data only.

  python scripts/skill_check.py --teacher "qwen2.5-14b" --student "Qwen3-1.7B" --profile pilot --seal
  python scripts/skill_check.py --list-models
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ACTOR = "skill-check script"


class Api:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.token = self.get("/api/system/session")["token"]

    def _req(self, method: str, path: str, body: dict | None = None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method,
                                     headers={"Content-Type": "application/json", "X-Forge-Actor": ACTOR,
                                              **({"X-Forge-Token": self.token} if getattr(self, "token", None) else {})})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            try:
                detail = json.loads(detail).get("detail", detail)
            except ValueError:
                pass
            raise SystemExit(f"\nFORGE refused {method} {path}: {e.code} {detail}")
        except urllib.error.URLError as e:
            raise SystemExit(f"\nCannot reach FORGE at {self.base} ({e.reason}). Start it first (scripts\\launch.ps1).")

    def get(self, path: str):
        return self._req("GET", path)

    def post(self, path: str, body: dict | None = None):
        return self._req("POST", path, body or {})

    def wait(self, job: dict, what: str) -> None:
        jid, t0, last = job["id"], time.time(), ""
        while True:
            j = self.get(f"/api/jobs/{jid}")
            st = j.get("status")
            line = f"   {what}: {st} · {int(time.time() - t0)} s"
            if line != last:
                print("\r" + line.ljust(70), end="", flush=True)
                last = line
            if st in ("completed", "failed", "cancelled"):
                print()
                if st != "completed":
                    evs = (self.get(f"/api/jobs/{jid}/log") or {}).get("events", [])[-15:]
                    tail = "\n".join(e.get("text") or json.dumps(e) for e in evs)
                    raise SystemExit(f"\n{what} {st}. Last log lines:\n{tail}\nSee the job in FORGE's job dock for the full log.")
                return
            time.sleep(5)


def pick(models: list[dict], q: str, role: str) -> dict:
    hits = [m for m in models if q == m["id"]] or [m for m in models if q.lower() in m["name"].lower()]
    if not hits:
        raise SystemExit(f"No {role} model matches '{q}'. Use --list-models (run discovery in the Model Observatory first).")
    if len(hits) > 1:
        names = "\n  ".join(f"{m['id']}  {m['name']}  ({m['provider']})" for m in hits)
        raise SystemExit(f"'{q}' matches several models; pass the id:\n  {names}")
    return hits[0]


def pct(v) -> str:
    return "  —  " if v is None else f"{v * 100:5.1f}%"


def pts(v) -> str:
    return "—" if v is None else f"{'+' if v >= 0 else '−'}{abs(v) * 100:.1f} pts"


def show_split(summ: dict, split: str, arm: str) -> dict | None:
    rep = (summ["reports"].get(split) or {}).get("splits", {}).get(split)
    if not rep:
        return None
    c = rep["arms"].get(arm) or {}
    print(f"\n   {'final test (sealed)' if split == 'test' else 'practice (dev)'}:")
    print(f"     teacher            {pct(rep.get('teacher_rate'))}")
    print(f"     untrained student  {pct(c.get('control_rate', rep.get('base_rate')))}")
    print(f"     trained student    {pct(c.get('arm_rate'))}")
    if c:
        print(f"     gain               {pts(c.get('mean'))}   95% range {pts(c.get('ci_low'))} … {pts(c.get('ci_high'))}"
              f"   (sign-flip p over task groups {c.get('sign_flip_groups', {}).get('p', float('nan')):.3g})")
        fam = c.get("families") or {}
        if fam:
            print("     by skill            untrained   trained   teacher")
            for f, v in sorted(fam.items()):
                print(f"       {f[:20]:20s} {pct((v.get('base') or {}).get('rate'))}    {pct((v.get(arm) or {}).get('rate'))}    {pct((v.get('teacher') or {}).get('rate'))}")
    return c


def verdict(c: dict | None, split: str) -> str:
    if not c:
        return "no result"
    lo, hi = c.get("ci_low"), c.get("ci_high")
    if lo is not None and lo > 0:
        return f"LEARNED on {split}: the whole 95% range of the gain is above zero."
    if hi is not None and hi < 0:
        return f"WORSE on {split}: the trained student is measurably below the untrained one."
    return f"NOT SHOWN on {split}: the range includes zero — these tasks cannot tell the trained and untrained student apart."


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://127.0.0.1:8765")
    ap.add_argument("--list-models", action="store_true", help="list the models FORGE knows and exit")
    ap.add_argument("--template", default="itsm_servicenow", help="Agent Studio template id (default: IT service desk)")
    ap.add_argument("--teacher", help="teacher model id or part of its name (LM Studio / Ollama / endpoint)")
    ap.add_argument("--student", help="student model id or part of its name (local Hugging Face model, e.g. Qwen3-1.7B)")
    ap.add_argument("--tasks-from", choices=["template", "teacher"], default="template",
                    help="who writes the practice tasks; both are verified by re-running the tools (default: template)")
    ap.add_argument("--per-skill", type=int, default=60, help="practice tasks requested per skill (default 60)")
    ap.add_argument("--profile", choices=["smoke", "pilot", "research"], default="pilot")
    ap.add_argument("--seeds", type=int, nargs="*", help="override the profile's seeds, e.g. --seeds 0")
    ap.add_argument("--device", choices=["cuda", "cpu"], default="cuda")
    ap.add_argument("--max-steps", type=int)
    ap.add_argument("--epochs", type=float)
    ap.add_argument("--max-seq-len", type=int, default=3072,
                    help="longest training example in tokens (default 3072: agent prompts carry the tool schemas; FORGE never truncates)")
    ap.add_argument("--seal", action="store_true", help="after the practice analysis, seal and run the final test")
    ap.add_argument("--yes-seal", action="store_true", help="do not ask before sealing (sealing is irreversible for this study)")
    ap.add_argument("--name", help="study name (default: skill check · <template> · <student>)")
    ap.add_argument("--out", default="skill-check-result.json")
    ap.add_argument("--resume", metavar="STUDY_ID", help="continue an existing study from its next unfinished stage (e.g. after starting LM Studio)")
    a = ap.parse_args()

    api = Api(a.url)
    models = api.get("/api/models")["models"]
    if a.list_models:
        for m in models:
            print(f"{m['id']}  {m['name']}  ({m['provider']}; roles: {', '.join(m.get('roles') or []) or '—'})")
        return
    t0 = time.time()
    if a.resume:
        summ0 = api.get(f"/api/studies/{a.resume}")
        sid, aid = a.resume, (summ0["plan"]["taskset"].get("agent") or {}).get("id")
        teacher = {"name": summ0["plan"]["teacher"]["model"]}
        student = {"name": summ0["plan"]["student"]["name"]}
        summ_t = {}
        print(f"Resuming {summ0['plan']['name']} ({sid}) at stage: {summ0['next_stage']}")
    else:
        sid, aid, teacher, student, summ_t = new_study(api, a, models)
    run_stages(api, a, sid, t0, aid, teacher, student, summ_t)


def new_study(api: Api, a, models: list[dict]):
    if not a.teacher or not a.student:
        raise SystemExit("Pass --teacher and --student (see --list-models), or --resume STUDY_ID.")
    teacher, student = pick(models, a.teacher, "teacher"), pick(models, a.student, "student")
    print(f"Teacher: {teacher['name']}   Student: {student['name']}   Template: {a.template}   Profile: {a.profile}   Device: {a.device}")

    print("\n1. Agent from template (synthetic data)")
    agent = api.post("/api/agents", {"name": f"skill check · {a.template}", "template": a.template, "no_sensitive_data": True})
    aid = agent["id"]
    print(f"   agent {aid}")

    print("2. Practice tasks (every one verified by re-running the tools)")
    body = {"source": a.tasks_from, "per_skill": a.per_skill}
    if a.tasks_from == "teacher":
        body["teacher_id"] = teacher["id"]
    api.wait(api.post(f"/api/agents/{aid}/steps/tasks", body), "practice tasks")
    ag = api.get(f"/api/agents/{aid}")
    summ_t = ag["steps"]["tasks"].get("summary") or {}
    print(f"   accepted {summ_t.get('accepted')} · rejected {summ_t.get('rejected')} · splits {summ_t.get('splits')}")

    print("3. Study")
    sb = {"name": a.name or f"skill check · {a.template} · {student['name'].split('/')[-1]}"[:80], "profile": a.profile,
          "teacher_id": teacher["id"], "student_id": student["id"], "agent_id": aid, "device": a.device}
    for k in ("seeds", "max_steps", "epochs", "max_seq_len"):
        if getattr(a, k) is not None:
            sb[k] = getattr(a, k)
    study = api.post("/api/studies", sb)
    sid = study["id"]
    print(f"   study {sid} · pair check: {study.get('pair_check', {}).get('verdict')}")
    print(f"   (if a stage fails — e.g. LM Studio not running — fix it and re-run with --resume {sid})")
    return sid, aid, teacher, student, summ_t


def run_stages(api: Api, a, sid: str, t0: float, aid, teacher: dict, student: dict, summ_t: dict) -> None:
    done = {k for k, v in api.get(f"/api/studies/{sid}")["state"]["stages"].items() if v.get("status") == "completed"}
    for stage, label in (("collect", "collect teacher examples"), ("build", "build training set"), ("train", "train the student"),
                         ("evaluate_dev", "evaluate on practice tasks"), ("analyze_dev", "analyse practice results")):
        if stage not in done:
            if stage == "train":  # FORGE refuses to train while the teacher still holds GPU memory
                try:
                    r = api.post("/api/lmstudio/unload")
                    print(f"   unloaded LM Studio models before training: {'ok' if (r or {}).get('ok') else r}")
                except SystemExit as e:  # no `lms` CLI etc.: training's own pre-flight will say exactly what to do
                    print(f"   could not unload LM Studio automatically ({str(e).strip()[:160]}); eject the teacher in LM Studio if training refuses")
            api.wait(api.post(f"/api/studies/{sid}/stages/{stage}", {}), label)

    summ = api.get(f"/api/studies/{sid}")
    arm = summ["plan"]["arms"][0]
    print("\n4. Results")
    dev = show_split(summ, "dev", arm)
    adq = api.get(f"/api/studies/{sid}/adequacy")
    print(f"\n   Is this a good test? {adq.get('overall')}")
    for s in (adq.get("skills") or [])[:12]:
        if s.get("verdict") not in ("good", None):
            print(f"     {s.get('skill')}: {s.get('verdict')} — {'; '.join(str(i.get('text') or i.get('kind')) for i in s.get('issues') or [])}")

    test = None
    if a.seal:
        ok = a.yes_seal or input("\nSeal the study and run the final test? No more training is possible afterwards. Type SEAL: ").strip() == "SEAL"
        if ok:
            if "seal" not in done:
                api.wait(api.post(f"/api/studies/{sid}/stages/seal", {"confirm": "SEAL"}), "seal")
            for stage, label in (("evaluate_test", "run the sealed final test"), ("analyze_test", "analyse the final test")):
                if stage not in done:
                    api.wait(api.post(f"/api/studies/{sid}/stages/{stage}", {}), label)
            summ = api.get(f"/api/studies/{sid}")
            test = show_split(summ, "test", arm)
        else:
            print("   Not sealed.")

    split = "test" if test else "dev"
    cmp = api.get(f"/api/compare?a=arm:{sid}:{arm}&b=arm:{sid}:base&split={split}")
    if cmp.get("comparable"):
        o = cmp["overall"]
        print(f"\n   Paired comparison on {o['n_tasks']} {split} tasks: trained − untrained = {pts(o['delta'])} "
              f"(95% {pts(o['delta_ci'][0])} … {pts(o['delta_ci'][1])}); only trained right {o['outcomes']['only_a']}, "
              f"only untrained right {o['outcomes']['only_b']}, both right {o['outcomes']['both_right']}, both wrong {o['outcomes']['both_wrong']}.")

    print("\n" + verdict(dev, "practice tasks"))
    if test is not None:
        print(verdict(test, "the sealed final test"))
    print(f"\nTotal time {int((time.time() - t0) / 60)} min. In FORGE: Pipeline (this study), Measure → Compare (trained vs untrained, "
          f"open any task side by side), Playground (try it), Governance (model card).")
    print("Scores are strict success on synthetic tasks — not clinical validity or deployment readiness.")
    out = {"study_id": sid, "agent_id": aid, "teacher": teacher["name"], "student": student["name"], "template": a.template,
           "profile": a.profile, "device": a.device, "tasks": summ_t, "adequacy": adq.get("overall"),
           "practice": dev and {k: dev.get(k) for k in ("arm_rate", "control_rate", "mean", "ci_low", "ci_high")},
           "final_test": test and {k: test.get(k) for k in ("arm_rate", "control_rate", "mean", "ci_low", "ci_high")},
           "comparison": cmp.get("overall") if cmp.get("comparable") else None, "minutes": round((time.time() - t0) / 60, 1)}
    Path(a.out).write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"Saved {a.out}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nStopped. Running jobs continue in FORGE; see the job dock.")
