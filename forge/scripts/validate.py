"""FORGE validation kit: one command that answers "does distillation work for OUR skills on OUR hardware?" with evidence.

Runs against a running FORGE (start it first) and LM Studio (teacher loaded). Everything happens through FORGE's own API, so
every step is visible and auditable in the app:

  0. preflight     FORGE, GPU, teacher and student found; records versions and hardware
  1. tasks         an Agent Studio template (synthetic) → verified practice tasks (or install a task pack with --pack)
  2. design        research profile by default: 6 seeds, the real arm + a NEGATIVE CONTROL (answers shuffled), a few-shot
                   PROMPTING baseline, and a POWER ANALYSIS frozen into the plan (calibrated on a pilot with --calibrate-from)
  3. run           collect → build → train → practice evaluation → analysis → SEAL → sealed final test → analysis
  4. checks        forgetting check (general-text perplexity), test adequacy, evidence verdict, training vs prompting
  5. quantize      (--quant) export, FORGE reference variants W8 / W4 activation-aware, measured on the sealed test
  6. record        a reproducibility bundle (every file hashed; anyone can recompute the statistics) and VALIDATION.md

Nothing here decides anything: it reports measured numbers, their ranges, and the limits. Synthetic data only.

  python scripts/validate.py --teacher "olmo-3-32b" --student "Olmo-3-7B-Instruct" --yes-seal
  python scripts/validate.py --resume study_1234 --yes-seal          # continue after fixing a failed stage
"""
from __future__ import annotations

import argparse
import json
import platform
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from skill_check import Api, pick  # noqa: E402  (same API client and model picker as the skill check)

STAGES = [("collect", "collect teacher examples"), ("build", "build training sets"), ("train", "train every arm and seed"),
          ("evaluate_dev", "evaluate on practice tasks"), ("analyze_dev", "analyse practice results")]
FINAL = [("evaluate_test", "run the sealed final test"), ("analyze_test", "analyse the final test")]


def pts(v) -> str:
    return "—" if v is None else f"{'+' if v >= 0 else '−'}{abs(v) * 100:.1f} pts"


def pct(v) -> str:
    return "—" if v is None else f"{v * 100:.1f}%"


def step(n: str, text: str) -> None:
    print(f"\n{n}. {text}")


def preflight(api: Api, a) -> dict:
    step("0", "Preflight")
    rd = api.get("/api/system/readiness")
    ver = api.get("/api/system/health")
    models = api.get("/api/models")["models"]
    teacher, student = pick(models, a.teacher, "teacher"), pick(models, a.student, "student")
    g = next((c for c in rd.get("checks", []) if c["id"] == "gpu"), {})
    print(f"   FORGE {ver.get('version', '?')} · GPU: {g.get('detail', '?')} · teacher {teacher['name']} · student {student['name']}")
    for c in rd.get("checks", []):
        if c.get("status") == "fail":
            print(f"   BLOCKER {c['label']}: {c['detail']}")
    if a.device == "cuda" and g.get("status") != "pass":
        print("   WARNING: no NVIDIA GPU visible; training will be refused unless you pass --device cpu (wiring only).")
    return {"forge": ver, "readiness": rd, "teacher": teacher, "student": student, "host": platform.platform(), "python": sys.version.split()[0]}


def make_agent(api: Api, a, teacher: dict) -> str:
    if a.pack:
        step("1", f"Install task pack {a.pack}")
        r = api.post("/api/packs/install", {"path": a.pack, "no_sensitive_data": True})
        print(f"   agent {r['agent_id']} · {r['tasks_verified']} of {r['tasks_included']} tasks re-verified")
        if r["tasks_verified"]:
            return r["agent_id"]
        aid = r["agent_id"]
    else:
        step("1", f"Agent from template '{a.template}' (synthetic)")
        aid = api.post("/api/agents", {"name": f"validation · {a.template}", "template": a.template, "no_sensitive_data": True})["id"]
    body = {"source": a.tasks_from, "per_skill": a.per_skill} | ({"teacher_id": teacher["id"]} if a.tasks_from == "teacher" else {})
    api.wait(api.post(f"/api/agents/{aid}/steps/tasks", body), "verified practice tasks")
    s = (api.get(f"/api/agents/{aid}")["steps"]["tasks"].get("summary") or {})
    print(f"   accepted {s.get('accepted')} · rejected {s.get('rejected')} · splits {s.get('splits')}")
    return aid


def make_study(api: Api, a, pre: dict, aid: str) -> str:
    step("2", "Study design (frozen before any training)")
    st = pre["student"]
    params = ((st.get("metadata") or {}).get("parameter_report") or {}).get("unique_total") or st.get("parameter_count") or 0
    body = {"name": a.name or f"validation · {a.template} · {st['name'].split('/')[-1]}"[:80], "profile": a.profile,
            "teacher_id": pre["teacher"]["id"], "student_id": st["id"], "agent_id": aid, "device": a.device,
            "arms": ["teacher_filtered", "shuffled_control"], "fewshot_k": a.fewshot, "preregister_power": True,
            "max_seq_len": a.max_seq_len, "min_gain": a.min_gain}
    if a.seeds is not None:
        body["seeds"] = list(range(a.seeds))
    if a.max_steps:
        body["max_steps"] = a.max_steps
    if a.calibrate_from:
        body["power_calibrate_from"] = a.calibrate_from
    if a.device == "cuda" and (a.base_4bit == "on" or (a.base_4bit == "auto" and params > 4e9)):
        body["turbo"] = {"quant_4bit": True}
    s = api.post("/api/studies", body)
    sid = s["id"]
    pw = api.get(f"/api/studies/{sid}/power")["preregistered"] or {}
    d = pw.get("design") or {}
    print(f"   study {sid}: arms teacher_filtered + shuffled_control, prompting baseline k={a.fewshot}, {d.get('seeds')} seeds")
    if pw:
        print(f"   power (preregistered): detects gains ≥ {pts(pw.get('mde_groups'))} with 80% power on {d.get('groups')} test groups; "
              f"seed-test floor p = {pw.get('seed_floor_p'):.3g}")
        for n in pw.get("notes") or []:
            print(f"   note: {n}")
    print(f"   (if a stage fails, fix it and re-run with --resume {sid})")
    return sid


def run(api: Api, a, sid: str) -> None:
    step("3", "Run the study")
    done = {k for k, v in api.get(f"/api/studies/{sid}")["state"]["stages"].items() if v.get("status") == "completed"}
    for stage, label in STAGES:
        if stage in done:
            continue
        if stage == "train":
            try:
                api.post("/api/lmstudio/unload")
                print("   unloaded LM Studio models before training")
            except SystemExit as e:
                print(f"   could not unload LM Studio automatically ({str(e).strip()[:120]}); eject the teacher if training refuses")
        api.wait(api.post(f"/api/studies/{sid}/stages/{stage}", {}), label)
    if "seal" not in done:
        if not (a.yes_seal or input("\nSeal and run the final test? Irreversible for this study. Type SEAL: ").strip() == "SEAL"):
            raise SystemExit("Not sealed: validation needs the sealed final test. Re-run with --resume and --yes-seal.")
        api.wait(api.post(f"/api/studies/{sid}/stages/seal", {"confirm": "SEAL"}), "seal")
    for stage, label in FINAL:
        if stage not in done:
            api.wait(api.post(f"/api/studies/{sid}/stages/{stage}", {}), label)


def checks(api: Api, a, sid: str) -> dict:
    step("4", "Checks")
    fg = api.get(f"/api/studies/{sid}/forgetting")
    if fg.get("computed") is False:
        api.wait(api.post(f"/api/studies/{sid}/forgetting", {"text_file": a.general_text}), "forgetting check")
        fg = api.get(f"/api/studies/{sid}/forgetting")
    ev = api.get(f"/api/studies/{sid}/evidence")
    adq = api.get(f"/api/studies/{sid}/adequacy")
    v = ev["verdict"]
    print(f"   evidence: {v.get('status')} — {v.get('text')}")
    if (v.get("prompting") or {}).get("text"):
        print(f"   versus prompting: {v['prompting']['text']}")
    for arm, x in (fg.get("arms") or {}).items():
        p = x["pooled"]
        print(f"   forgetting ({arm}): {x['status']} — general-text perplexity {pts(p['change']).replace(' pts', '%')} (95% {pct(p['ci'][0])} … {pct(p['ci'][1])})")
    print(f"   is this a good test? {adq.get('overall')}")
    return {"evidence": ev, "forgetting": fg, "adequacy": adq}


def quantize(api: Api, sid: str) -> dict | None:
    step("5", "Quantize and measure")
    summ = api.get(f"/api/studies/{sid}")
    if summ["state"]["stages"].get("export", {}).get("status") != "completed":
        api.wait(api.post(f"/api/studies/{sid}/stages/export", {}), "verified merged export")
    have = {v["label"] for v in api.get(f"/api/studies/{sid}/quant")["variants"]}
    for m in ("ref_w8", "ref_w4_aware"):
        if m not in have:
            api.wait(api.post(f"/api/studies/{sid}/quant/reference", {"method": m, "split": "dev"}), f"make {m}")
        lab = api.get(f"/api/studies/{sid}/quant")
        if "test" not in next(v for v in lab["variants"] if v["label"] == m)["results"]:
            api.wait(api.post(f"/api/studies/{sid}/quant/{m}/evaluate", {"split": "test"}), f"measure {m} on the final test")
    lab = api.get(f"/api/studies/{sid}/quant")
    u = lab["unquantized"].get("test", {})
    print(f"   unquantized: {pct(u.get('rate'))} on the final test")
    for v in lab["variants"]:
        r = v["results"].get("test") or {}
        print(f"   {v['label']:14s} {pct(r.get('rate'))}  agreement {pct(r.get('agreement'))}  McNemar p {r.get('mcnemar_p')}")
    print("   For LM Studio / vLLM variants use Quantization Lab → Recipe, then 'Measure a served model'.")
    return lab


def report(api: Api, a, sid: str, pre: dict, ck: dict, lab: dict | None, t0: float) -> None:
    step("6", "Record")
    b = api.post(f"/api/studies/{sid}/bundle", {"include_adapters": False})
    vr = api.post("/api/bundles/verify", {"path": b["path"]})
    print(f"   bundle {b['path']} · verification: {'VERIFIED' if vr['ok'] else 'NOT VERIFIED'}")
    out = Path(a.out_dir) / sid
    out.mkdir(parents=True, exist_ok=True)
    ev, fg = ck["evidence"], ck["forgetting"]
    rec = {"study_id": sid, "made_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "minutes": round((time.time() - t0) / 60, 1),
           "teacher": pre["teacher"]["name"], "student": pre["student"]["name"], "host": pre["host"], "forge": pre["forge"],
           "verdict": ev["verdict"], "contrasts": ev["contrasts"], "vs_prompting": ev.get("vs_prompting"), "power": ev.get("power"),
           "forgetting": {k: {"status": v["status"], **v["pooled"]} for k, v in (fg.get("arms") or {}).items()},
           "adequacy": ck["adequacy"].get("overall"), "quantization": lab and {"unquantized": lab["unquantized"], "variants": [
               {k: v[k] for k in ("label", "method", "size_bytes", "results", "simulated")} for v in lab["variants"]]},
           "bundle": {"path": b["path"], "sha256": b["sha256"], "verified": vr["ok"], "checks": vr["checks"]}}
    (out / "validation.json").write_text(json.dumps(rec, indent=2, default=str), encoding="utf-8")
    test = (ev["contrasts"].get("test") or {})
    real, ctl = test.get("teacher_filtered") or {}, test.get("shuffled_control") or {}
    vp = (ev.get("vs_prompting") or {}).get("test") or {}
    md = [f"# FORGE validation — {pre['student']['name']} learning from {pre['teacher']['name']}", "",
          f"Study `{sid}` · {rec['made_at']} · {rec['minutes']} min · {pre['host']}", "",
          "## Verdict", "", f"**{ev['verdict'].get('status')}** — {ev['verdict'].get('text')}", "",
          "## Sealed final test (strict success)", "", "| comparison | gain | 95 % range | p (groups) | p (seeds) |", "|---|---|---|---|---|"]
    for lbl, c in (("trained − untrained", real), ("negative control − untrained", ctl), ("prompting − untrained", vp.get("fewshot") or {}),
                   ("trained − prompting", vp.get("teacher_filtered") or {})):
        if c:
            md.append(f"| {lbl} | {pts(c.get('gain'))} | {pts((c.get('ci') or [None])[0])} … {pts((c.get('ci') or [None, None])[1])} | "
                      f"{c.get('p_groups') if c.get('p_groups') is not None else '—'} | {c.get('p_seeds') if c.get('p_seeds') is not None else '—'} |")
    pw = ev.get("power") or {}
    md += ["", "## Power (preregistered)", "", f"Detects gains ≥ {pts(pw.get('mde_groups'))} with 80 % power; seed-test floor p = {pw.get('seed_floor_p')}. "
           f"Assumptions: {(pw.get('assumptions') or {}).get('source')}.", *(f"- {n}" for n in pw.get("notes") or []), "",
           "## Forgetting (general-text perplexity)", ""]
    md += [f"- {k}: **{v['status']}**, {v['change'] * 100:+.1f} % (95 % {v['ci'][0] * 100:+.1f} … {v['ci'][1] * 100:+.1f})" for k, v in rec["forgetting"].items()]
    if lab:
        md += ["", "## Quantization (sealed final test)", "", "| variant | size | strict success | agreement | McNemar p |", "|---|---|---|---|---|",
               f"| unquantized | {(lab.get('bf16_bytes') or 0) / 1e9:.2f} GB | {pct((lab['unquantized'].get('test') or {}).get('rate'))} | — | — |"]
        for v in lab["variants"]:
            r = v["results"].get("test") or {}
            md.append(f"| {v['label']}{' (simulated)' if v['simulated'] else ''} | {(v.get('size_bytes') or 0) / 1e9:.2f} GB | {pct(r.get('rate'))} | {pct(r.get('agreement'))} | {r.get('mcnemar_p')} |")
    md += ["", "## Reproducibility", "", f"Bundle `{b['path']}` (sha256 `{b['sha256'][:16]}…`): **{'verified' if vr['ok'] else 'NOT verified'}** — "
           "file hashes, frozen plan, and every analysis recomputed from raw episodes.", "",
           "## Limits", "", "Strict success on synthetic tasks from a template agent. It shows whether the student learned these skills and "
           "whether the measurement responds to real learning. It does not show performance on real requests, clinical validity or deployment readiness."]
    (out / "VALIDATION.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"   wrote {out / 'VALIDATION.md'} and validation.json")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://127.0.0.1:8765")
    ap.add_argument("--teacher")
    ap.add_argument("--student")
    ap.add_argument("--template", default="itsm_servicenow")
    ap.add_argument("--pack", help="install this task pack instead of a template")
    ap.add_argument("--tasks-from", choices=["template", "teacher"], default="template")
    ap.add_argument("--per-skill", type=int, default=80)
    ap.add_argument("--profile", choices=["pilot", "research"], default="research")
    ap.add_argument("--seeds", type=int, help="number of seeds (default: the profile's; ≥ 6 for the seed test to reach p < 0.05)")
    ap.add_argument("--fewshot", type=int, default=3, help="worked examples for the prompting baseline (0 = off)")
    ap.add_argument("--min-gain", type=float, default=0.05)
    ap.add_argument("--calibrate-from", help="an analysed pilot study id to take the power assumptions from")
    ap.add_argument("--device", choices=["cuda", "cpu"], default="cuda")
    ap.add_argument("--max-seq-len", type=int, default=3072)
    ap.add_argument("--max-steps", type=int, help="cap training steps (wiring runs only; leave unset for a real validation)")
    ap.add_argument("--base-4bit", choices=["auto", "on", "off"], default="auto")
    ap.add_argument("--general-text", help="your own general-text file for the forgetting check (default: built-in)")
    ap.add_argument("--quant", action="store_true", help="also export and measure W8 / W4 activation-aware variants")
    ap.add_argument("--yes-seal", action="store_true")
    ap.add_argument("--name")
    ap.add_argument("--resume", metavar="STUDY_ID")
    ap.add_argument("--out-dir", default="validation")
    a = ap.parse_args()
    api, t0 = Api(a.url), time.time()
    if a.resume:
        summ = api.get(f"/api/studies/{a.resume}")
        a.teacher, a.student = a.teacher or summ["plan"]["teacher"].get("model_id") or summ["plan"]["teacher"]["model"], a.student or summ["plan"]["student"].get("model_id") or summ["plan"]["student"]["name"]
        pre = preflight(api, a)
        sid = a.resume
    else:
        if not a.teacher or not a.student:
            raise SystemExit("Pass --teacher and --student (python scripts/skill_check.py --list-models), or --resume STUDY_ID.")
        pre = preflight(api, a)
        sid = make_study(api, a, pre, make_agent(api, a, pre["teacher"]))
    run(api, a, sid)
    ck = checks(api, a, sid)
    lab = quantize(api, sid) if a.quant else None
    report(api, a, sid, pre, ck, lab, t0)
    print("\nScores are strict success on synthetic tasks — not clinical validity or deployment readiness.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nStopped. Running jobs continue in FORGE; see the job dock.")
