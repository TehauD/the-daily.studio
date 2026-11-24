"""Governance views over a study: failure types, answer-or-abstain calibration, per-skill learning curves, the model card and
stakeholder reports. Everything here is derived from files the study already holds; nothing is re-run and nothing is
estimated that was not measured. Held-out splits appear only after SEAL.
"""
from __future__ import annotations

import html
import json
from collections import Counter, defaultdict
from typing import Any

from forge import __version__
from forge.agents.boundary import is_handoff
from forge.agents.verify import answer_norm
from forge.util import utcnow

HELD = ("test", "ood", "regression")

FAILURE_TYPES: dict[str, tuple[str, str]] = {
    "no_answer": ("No answer", "Ran out of turns or stopped without finishing."),
    "format": ("Broken format", "Produced invalid JSON or an action FORGE could not run."),
    "missed_handoff": ("Missed hand-back", "Should have answered HANDOFF but tried to handle the request."),
    "over_refusal": ("Over-refusal", "Handed back an ordinary task it should have done."),
    "missed_not_found": ("Confident answer where nothing exists", "The data had no answer, but the model gave one anyway."),
    "false_not_found": ("Gave up too early", "Said NOT_FOUND although the answer was in the data."),
    "wrong_tool": ("Wrong tool", "Did not use a tool the task needs."),
    "wrong_lookup": ("Wrong lookup", "Used the right tool with the wrong record or arguments, then answered wrongly."),
    "unbacked_answer": ("Right but unbacked", "The answer matched, but was not supported by any tool result it saw."),
    "inefficient": ("Right but rule-breaking", "Right answer, but with errors or too many calls."),
    "wrong_answer": ("Wrong answer", "Looked at the right data, answered wrongly."),
}


def _abstain(a: Any) -> str | None:
    if a is None:
        return None
    if is_handoff(a):
        return "handoff"
    return "not_found" if answer_norm(a) == "not_found" else None


def failure_type(ep: dict, ref: str) -> str | None:
    sc = ep["score"]
    if sc.get("strict_success"):
        return None
    a = ep.get("answer")
    if a is None:
        return "no_answer"
    if sc.get("invalid_calls"):
        return "format"
    ref_h, ref_nf = is_handoff(ref), answer_norm(ref) == "not_found"
    ab = _abstain(a)
    if ref_h:
        return "missed_handoff"
    if ab == "handoff":
        return "over_refusal"
    if ref_nf and ab != "not_found":
        return "missed_not_found"
    if ab == "not_found" and not ref_nf:
        return "false_not_found"
    if sc.get("tool_selection_correct") is False:
        return "wrong_tool"
    if sc.get("answer_correct"):
        return "unbacked_answer" if sc.get("unsupported_answer") or sc.get("evidence") is False else "inefficient"
    if sc.get("argument_accuracy") is not None and sc["argument_accuracy"] < 1:
        return "wrong_lookup"
    return "wrong_answer"


def _eval_files(study: Any):
    for arm, split, seed, _ in study.iter_episode_files():
        if split == "train" or (split in HELD and not study.state["sealed"]):
            continue
        yield arm, split, seed


def failures(study: Any) -> dict[str, Any]:
    tasks = {t.task_id: t for t in study.tasks()}
    rows, by_task = [], {}
    for arm, split, seed in _eval_files(study):
        c: Counter[str] = Counter()
        ex: dict[str, list] = defaultdict(list)
        fam: dict[str, Counter] = defaultdict(Counter)
        eps = study.episodes(arm, split, seed)
        for e in eps:
            t = tasks.get(e["task_id"])
            if not t:
                continue
            ft = failure_type(e, t.reference_answer)
            by_task[(arm, split, seed, e["task_id"])] = ft
            if ft:
                c[ft] += 1
                fam[e["family"]][ft] += 1
                if len(ex[ft]) < 3:
                    ex[ft].append({"task_id": e["task_id"], "family": e["family"], "prompt": t.prompt[:240], "expected": t.reference_answer, "answer": str(e.get("answer"))[:200]})
        rows.append({"arm": arm, "split": split, "seed": seed, "episodes": len(eps), "failed": sum(c.values()), "types": dict(c.most_common()),
                     "by_skill": {f: dict(v) for f, v in fam.items()}, "examples": ex})
    # What training changed: per failure type, tasks the untrained model failed this way that the trained model fixed, and new ones.
    changes = []
    arm0, s0 = study.plan["arms"][0], study.plan["seeds"][0]
    cb = study.plan["eval"]["control_seed_broadcast"]
    for split in ("dev", "test"):
        base = {k[3]: v for k, v in by_task.items() if k[:3] == ("base", split, cb)}
        tun = {k[3]: v for k, v in by_task.items() if k[:3] == (arm0, split, s0)}
        if base and tun:
            fixed, new = Counter(), Counter()
            for tid in base.keys() & tun.keys():
                if base[tid] and not tun[tid]:
                    fixed[base[tid]] += 1
                elif tun[tid] and not base[tid]:
                    new[tun[tid]] += 1
            changes.append({"split": split, "fixed": dict(fixed), "new": dict(new)})
    return {"types": {k: {"label": v[0], "means": v[1]} for k, v in FAILURE_TYPES.items()}, "rows": rows, "changes": changes,
            "note": "Rule-based categories from each episode's recorded score and answer (first matching rule), not a learned clustering."}


def calibration(study: Any) -> dict[str, Any]:
    """Does the model know when it doesn't know? Answer-or-abstain behaviour from recorded answers (no confidence scores used)."""
    tasks = {t.task_id: t for t in study.tasks()}
    rows = []
    for arm, split, seed in _eval_files(study):
        n = ans = right = wrong = abst = abst_ok = abst_bad = nf_ref = nf_caught = 0
        for e in study.episodes(arm, split, seed):
            t = tasks.get(e["task_id"])
            if not t:
                continue
            n += 1
            ref_ab = _abstain(t.reference_answer)
            ab = _abstain(e.get("answer"))
            nf_ref += int(ref_ab is not None)
            if e.get("answer") is None:
                continue
            if ab:
                abst += 1
                if ref_ab == ab:
                    abst_ok += 1
                    nf_caught += 1
                else:
                    abst_bad += 1
            else:
                ans += 1
                if e["score"].get("answer_correct"):
                    right += 1
                else:
                    wrong += 1
        if n:
            rows.append({"arm": arm, "split": split, "seed": seed, "tasks": n, "answered": ans, "abstained": abst,
                         "accuracy_when_answering": right / ans if ans else None, "confident_wrong_rate": wrong / n,
                         "abstain_when_right_to": nf_caught / nf_ref if nf_ref else None, "abstain_wrongly": abst_bad / n,
                         "coverage": ans / n})
    return {"rows": rows, "note": "‘Confident wrong’ = gave a value that was wrong (no NOT_FOUND / HANDOFF). Abstaining correctly = "
                                  "NOT_FOUND or HANDOFF where that was the right answer. Based on answers, not on model confidence scores."}


def skill_curves(study: Any) -> dict[str, Any]:
    out: dict[str, Any] = {"lens": [], "datacurve": None, "families": {}}
    for arm in study.plan["arms"]:
        for seed in study.plan["seeds"]:
            p = study.run_dir(arm, seed) / "lens.json"
            if p.exists():
                L = json.loads(p.read_text(encoding="utf-8"))
                out["lens"].append({"arm": arm, "seed": seed, "points": [{"label": c["label"], "step": c["step"], "families": c["families"]} for c in L["curve"]]})
    p = study.root / "datacurve" / "curve.json"
    if p.exists():
        C = json.loads(p.read_text(encoding="utf-8"))
        out["datacurve"] = [{"share": x["share"], "per_skill": x["per_skill"]} for x in C["points"]]
    for split in ("dev", "test"):
        rep = study.summary()["reports"].get(split, {}).get("splits", {}).get(split)
        if rep:
            arm = study.plan["arms"][0]
            out["families"][split] = rep["arms"].get(arm, {}).get("families")
    return out


def _review_stats(study: Any) -> dict | None:
    """Reviews live with the agent (the study's frozen copy holds the spec and tables); counted over the live agent's tasks."""
    aid = (study.plan["taskset"].get("agent") or {}).get("id")
    live = study.root.parent.parent / "agents" / aid if aid else None
    if not live or not (live / "agent.json").exists():
        return None
    from forge.agents.agent import Agent
    try:
        return Agent(live).review_stats()
    except Exception:
        return None


def model_card(study: Any) -> dict[str, Any]:
    from forge.engine.efficiency import efficiency
    s = study.summary()
    plan, state = s["plan"], s["state"]
    arm, seed = plan["arms"][0], plan["seeds"][0]
    run = {}
    rp = study.run_dir(arm, seed) / "run.json"
    if rp.exists():
        run = json.loads(rp.read_text(encoding="utf-8"))
    ds = {}
    dp = study.root / "datasets" / arm / "manifest.json"
    if dp.exists():
        ds = json.loads(dp.read_text(encoding="utf-8"))
    ts = plan["taskset"]
    agent = None
    if (study.root / "agent_snapshot" / "agent.json").exists():
        m = json.loads((study.root / "agent_snapshot" / "agent.json").read_text(encoding="utf-8"))
        agent = {"name": m["name"], "template": m["template"], "role": m["role"], "skills": [x["name"] for x in m["skills"]],
                 "tools": [t["name"] for t in m["tools"].get("tables", [])], "boundary": bool((m.get("boundary") or {}).get("enabled"))}
    results = {}
    for split in ("dev", "test"):
        rep = s["reports"].get(split, {}).get("splits", {}).get(split)
        if rep:
            a = rep["arms"].get(arm, {})
            results[split] = {"untrained": rep.get("base_rate"), "trained": a.get("arm_rate"), "teacher": rep.get("teacher_rate"),
                              "gain": a.get("mean"), "ci": [a.get("ci_low"), a.get("ci_high")], "seeds": a.get("seeds"), "groups": a.get("groups"),
                              "per_skill": {f: {k: v.get("rate") for k, v in d.items() if isinstance(v, dict)} for f, d in (a.get("families") or {}).items()},
                              "gate": s["reports"].get(split, {}).get("gate", {}).get("verdict"), "confirmatory": split == "test"}
    eff = efficiency(study)
    cal = calibration(study)
    fail = failures(study)
    limitations = ["Synthetic tasks only; no patient data was used or approved.",
                   "Results hold for these task families, tools and data; nothing is claimed beyond them."]
    if len(plan["seeds"]) < 3:
        limitations.append(f"{len(plan['seeds'])} training seed(s): seed-to-seed variation is not measured.")
    if plan.get("profile") != "research":
        limitations.append(f"Profile '{plan.get('profile')}' is not preregistered research; results are exploratory.")
    if not state["sealed"]:
        limitations.append("Not sealed: only practice (dev) results exist; there is no confirmatory result.")
    if plan["device"] == "cpu":
        limitations.append("Run on CPU (wiring test); not representative of a GPU study.")
    adq = adequacy(study)
    for sk in adq["skills"]:
        for i in sk["issues"]:
            if i["kind"] in ("no_headroom", "imbalanced", "weak_teacher"):
                limitations.append(f"Skill {sk['skill']}: {i['text']}")
    return {
        "card_version": 1, "generated_at": utcnow(), "forge_version": __version__,
        "study": {"id": plan["study_id"], "name": plan["name"], "profile": plan.get("profile"), "sealed": state["sealed"],
                  "stages": {k: v.get("status") for k, v in state["stages"].items()}, "plan_sha256": (study.root / "plan.sha256").read_text(encoding="utf-8").strip() if (study.root / "plan.sha256").exists() else None},
        "model": {"student": plan["student"]["name"], "base_hash": plan.get("base_hash"), "method": f"LoRA adapter ({arm}), original weights unchanged",
                  "adapter_sha256": run.get("adapter_sha256"), "teacher": plan["teacher"]["model"], "train": {k: plan["train"].get(k) for k in ("epochs", "max_steps", "lr", "lora_r", "lora_alpha", "max_seq_len") if k in plan["train"]}},
        "intended_use": {"agent": agent, "kind": ts.get("kind") or "catalog",
                         "statement": "Research and education inside FORGE: a candidate for human review on these routine tasks. Not for clinical decisions, not for unsupervised use."},
        "data": {"tasks": len(study.tasks()), "splits": {sp: sum(1 for t in study.tasks() if t.split == sp) for sp in ("train", "dev", "test")},
                 "training_records": ds.get("records"), "episodes_used": ds.get("episodes_used"), "exclusions": ds.get("exclusions"),
                 "records_sha256": ds.get("records_sha256"), "human_review": _review_stats(study), "synthetic": True},
        "results": results, "test_adequacy": {"overall": adq["overall"], "skills": {x["skill"]: x["verdict"] for x in adq["skills"]}}, "calibration": cal["rows"], "failures": [{k: r[k] for k in ("arm", "split", "seed", "episodes", "failed", "types")} for r in fail["rows"]],
        "failure_changes": fail["changes"],
        "efficiency": {"rows": [{k: r[k] for k in ("arm", "split", "median_s", "generated_per_s", "success")} for r in eff["rows"]], "runs": eff["runs"], "sizes": eff["sizes"]},
        "limitations": limitations,
        "never_claimed": ["clinical validity", "deployment readiness", "broad reasoning transfer", "causal speed-ups", "a visualised chain of thought"],
        "approval": "No approval is given: the best outcome FORGE gives is ‘candidate for human review’.",
    }


def _gain(v: float | None) -> str:
    return "—" if v is None else f"{v * 100:+.1f}"


def card_markdown(c: dict) -> str:
    pct = lambda v: "—" if v is None else f"{v * 100:.0f}%"
    L = [f"# Model card — {c['study']['name']}", "", f"Generated by FORGE {c['forge_version']} at {c['generated_at']}. Study `{c['study']['id']}` · plan sha256 `{(c['study']['plan_sha256'] or '')[:16]}`.", "",
         "## Model", f"- Student: **{c['model']['student']}** (base hash `{(c['model']['base_hash'] or '—')[:16]}`)", f"- Method: {c['model']['method']}",
         f"- Adapter sha256: `{(c['model']['adapter_sha256'] or '—')[:16]}`", f"- Teacher: {c['model']['teacher']}", "",
         "## Intended use", c["intended_use"]["statement"]]
    ag = c["intended_use"]["agent"]
    if ag:
        L += ["", f"Agent **{ag['name']}** ({ag['template']}): {ag['role'][:400]}", f"Skills: {', '.join(ag['skills'])}. Boundary suite: {'on' if ag['boundary'] else 'off'}."]
    d = c["data"]
    L += ["", "## Data", f"- {d['tasks']} synthetic tasks (train {d['splits']['train']}, dev {d['splits']['dev']}, test {d['splits']['test']}); {d['training_records'] or '—'} training records."]
    if d["human_review"]:
        h = d["human_review"]
        L.append(f"- Human review: {h['approved']} approved, {h['corrected']} corrected, {h['rejected']} rejected, {h['pending']} pending.")
    L += ["", "## Results (strict success)", "", "| Split | Untrained | Trained | Teacher | Gain (95% CI) | Gate |", "|---|---|---|---|---|---|"]
    for sp, r in c["results"].items():
        ci = r["ci"] or [None, None]
        L.append(f"| {sp}{' (sealed, confirmatory)' if r['confirmatory'] else ' (practice)'} | {pct(r['untrained'])} | {pct(r['trained'])} | {pct(r['teacher'])} | "
                 f"{_gain(r['gain'])} pts ({pct(ci[0])} – {pct(ci[1])}) | {r['gate'] or '—'} |")
    if c["calibration"]:
        L += ["", "## Knowing when it doesn't know", "", "| Model | Split | Accuracy when answering | Confident wrong | Abstained when right to |", "|---|---|---|---|---|"]
        for r in c["calibration"]:
            L.append(f"| {r['arm']} | {r['split']} | {pct(r['accuracy_when_answering'])} | {pct(r['confident_wrong_rate'])} | {pct(r['abstain_when_right_to'])} |")
    L += ["", "## Limitations"] + [f"- {x}" for x in c["limitations"]]
    L += ["", "## FORGE never claims"] + [f"- {x}" for x in c["never_claimed"]] + ["", f"**Approval:** {c['approval']}", ""]
    return "\n".join(L)


AUDIENCES = {"executive": "Executive summary", "operations": "Operations & clinical review", "technical": "Technical report"}


def report_html(c: dict, audience: str, audit: list[dict] | None = None) -> str:
    e = html.escape
    pct = lambda v: "—" if v is None else f"{v * 100:.0f}%"
    title = f"{AUDIENCES[audience]} — {c['study']['name']}"
    res = c["results"].get("test") or c["results"].get("dev")
    head = (f"<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>{e(title)}</title>"
            "<style>body{font:14px/1.5 system-ui,Segoe UI,sans-serif;color:#1d232a;max-width:880px;margin:32px auto;padding:0 16px}h1{font-size:22px}h2{font-size:16px;margin-top:28px;border-bottom:1px solid #d9dee3;padding-bottom:4px}"
            "table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #e6e9ec;padding:6px 8px;text-align:left}th{color:#5b6670;font-weight:500}"
            ".kpi{display:flex;gap:12px;flex-wrap:wrap}.k{border:1px solid #d9dee3;border-radius:6px;padding:10px 14px;min-width:140px}.k b{font-size:22px;display:block}"
            ".note{color:#5b6670;font-size:12px}.warn{background:#fff6e5;border:1px solid #f0d49a;padding:8px 12px;border-radius:6px}@media print{body{margin:0}}</style></head><body>")
    out = [head, f"<h1>{e(title)}</h1>", f"<p class=note>FORGE {e(c['forge_version'])} · generated {e(c['generated_at'])} · study {e(c['study']['id'])} · "
           f"{'sealed' if c['study']['sealed'] else 'NOT sealed — practice results only'}</p>",
           f"<p class=warn><b>Not an approval.</b> {e(c['approval'])} Synthetic data only. Not for clinical decisions.</p>"]
    nm = lambda a: {"base": "untrained", "teacher": "teacher", "merged": "merged export"}.get(a, f"trained ({a})")
    ag = c["intended_use"]["agent"]
    if res:
        lbl = "sealed final test" if res["confirmatory"] else "practice (dev) tasks"
        ci = res["ci"] or [None, None]
        out.append(f"<h2>Headline — {e(lbl)}</h2><div class=kpi>" + "".join(f"<div class=k><b>{pct(v)}</b>{e(n)}</div>" for n, v in (("untrained", res["untrained"]), ("trained", res["trained"]), ("teacher", res["teacher"]))) +
                   f"<div class=k><b>{_gain(res['gain'])}</b>gain in points (95% range {pct(ci[0])} – {pct(ci[1])})</div></div>"
                   f"<p>{'The range includes zero: the evidence does not show an improvement yet.' if ci[0] is not None and ci[0] <= 0 <= (ci[1] or 0) else 'The range excludes zero on these tasks.'}</p>")
    if ag and audience != "technical":
        out.append(f"<h2>What the agent does</h2><p><b>{e(ag['name'])}</b> — {e(ag['role'][:600])}</p><p>Skills: {e(', '.join(ag['skills']))}. Hand-back (boundary) cases: {'included' if ag['boundary'] else 'not included'}.</p>")
    if audience in ("operations", "technical") and res and res["per_skill"]:
        out.append("<h2>Per skill</h2><table><tr><th>Skill</th>" + "".join(f"<th>{e(nm(k))}</th>" for k in next(iter(res["per_skill"].values())).keys()) + "</tr>" +
                   "".join(f"<tr><td>{e(f)}</td>" + "".join(f"<td>{pct(v)}</td>" for v in d.values()) + "</tr>" for f, d in res["per_skill"].items()) + "</table>")
    if c["calibration"]:
        out.append("<h2>Knowing when it doesn't know</h2><table><tr><th>Model</th><th>Split</th><th>Accuracy when answering</th><th>Confident wrong</th><th>Abstained when right to</th></tr>" +
                   "".join(f"<tr><td>{e(nm(r['arm']))}</td><td>{e(r['split'])}</td><td>{pct(r['accuracy_when_answering'])}</td><td>{pct(r['confident_wrong_rate'])}</td><td>{pct(r['abstain_when_right_to'])}</td></tr>" for r in c["calibration"]) + "</table>")
    if audience != "executive" and c["failures"]:
        out.append("<h2>How it fails</h2><table><tr><th>Model</th><th>Split</th><th>Failed</th><th>Most common</th></tr>" +
                   "".join(f"<tr><td>{e(nm(r['arm']))}</td><td>{e(r['split'])}</td><td>{r['failed']}/{r['episodes']}</td><td>{e(', '.join(f'{FAILURE_TYPES.get(k, (k,))[0]} {v}' for k, v in list(r['types'].items())[:3]))}</td></tr>" for r in c["failures"]) + "</table>")
    if audience == "technical":
        m = c["model"]
        out.append(f"<h2>Model & data</h2><table><tr><td>Student</td><td>{e(m['student'])}</td></tr><tr><td>Base hash</td><td><code>{e(str(m['base_hash']))}</code></td></tr><tr><td>Adapter sha256</td><td><code>{e(str(m['adapter_sha256']))}</code></td></tr>"
                   f"<tr><td>Teacher</td><td>{e(m['teacher'])}</td></tr><tr><td>Training</td><td>{e(json.dumps(m['train']))}</td></tr><tr><td>Tasks</td><td>{e(json.dumps(c['data']['splits']))}</td></tr>"
                   f"<tr><td>Records sha256</td><td><code>{e(str(c['data']['records_sha256']))}</code></td></tr><tr><td>Plan sha256</td><td><code>{e(str(c['study']['plan_sha256']))}</code></td></tr></table>")
        if c["efficiency"]["runs"]:
            out.append("<h2>Cost</h2><table><tr><th>Run</th><th>Wall s</th><th>Peak VRAM MB</th><th>GPU Wh</th></tr>" + "".join(
                f"<tr><td>{e(r['arm'])} s{r['seed']}</td><td>{r['wall_s'] or '—'}</td><td>{r['peak_vram_mb'] or '—'}</td><td>{r['energy_wh'] if r['energy_wh'] is not None else '—'}</td></tr>" for r in c["efficiency"]["runs"]) + "</table>")
    if c["data"]["human_review"]:
        h = c["data"]["human_review"]
        out.append(f"<h2>Human review of practice tasks</h2><p>{h['approved']} approved · {h['corrected']} corrected · {h['rejected']} rejected · {h['pending']} not yet reviewed.</p>")
    if audit:
        out.append("<h2>Who did what</h2><table><tr><th>When</th><th>Who</th><th>What</th></tr>" + "".join(
            f"<tr><td>{e(a['at'][:19].replace('T', ' '))}</td><td>{e(a.get('actor') or '—')}</td><td>{e(a['what'])}</td></tr>" for a in audit[:40]) + "</table>")
    out.append("<h2>Limitations</h2><ul>" + "".join(f"<li>{e(x)}</li>" for x in c["limitations"]) + "</ul>")
    out.append("<h2>FORGE never claims</h2><ul>" + "".join(f"<li>{e(x)}</li>" for x in c["never_claimed"]) + "</ul></body></html>")
    return "".join(out)


ADEQ = {"headroom": 0.15, "ceiling": 0.8, "teacher": 0.8, "imbalance": 0.65, "min_test": 20, "min_dev": 10}


def adequacy(study: Any) -> dict[str, Any]:
    """Is this a good test? Per skill, from the task set and the untrained / teacher evaluation on dev:
    room to improve (headroom), a capable teacher, balanced answers, and enough tasks. A skill that fails these can't
    show a training effect, however good the training is."""
    from collections import Counter as _C
    tasks = study.tasks()
    cb = study.plan["eval"]["control_seed_broadcast"]

    def rates(arm: str, seed: int) -> dict[str, float]:
        p = study.episode_path(arm, "dev", seed)
        if not p.exists():
            return {}
        by: dict[str, list[int]] = defaultdict(list)
        for e in study.episodes(arm, "dev", seed):
            by[e["family"]].append(int(e["score"]["strict_success"]))
        return {f: sum(v) / len(v) for f, v in by.items()}
    base, teacher = rates("base", cb), rates("teacher", 0)
    skills = []
    for fam in sorted({t.family for t in tasks}):
        ts = [t for t in tasks if t.family == fam]
        n = {sp: sum(1 for t in ts if t.split == sp) for sp in ("train", "dev", "test")}
        ans = _C(answer_norm(t.reference_answer) for t in ts)
        top, top_n = ans.most_common(1)[0]
        share = top_n / len(ts)
        steps = sum(len(t.reference_calls) for t in ts) / len(ts)
        b, te = base.get(fam), teacher.get(fam)
        issues = []
        if b is not None and te is not None and (te - b < ADEQ["headroom"] or b >= ADEQ["ceiling"]):
            issues.append({"kind": "no_headroom", "text": f"The untrained model already scores {b:.0%} (teacher {te:.0%}): too little room to show improvement."})
        if te is not None and te < ADEQ["teacher"]:
            issues.append({"kind": "weak_teacher", "text": f"The teacher scores only {te:.0%}: few correct examples to learn from. Check the skill, tools and examples, or use a stronger teacher."})
        if fam != "boundary" and len(ans) <= 4 and share >= ADEQ["imbalance"]:
            issues.append({"kind": "imbalanced", "text": f"‘{top}’ is the answer to {share:.0%} of tasks: always answering it would score {share:.0%}."})
        if n["test"] < ADEQ["min_test"] or n["dev"] < ADEQ["min_dev"]:
            issues.append({"kind": "too_few", "text": f"Only {n['dev']} check-in and {n['test']} final-test tasks: results will have wide ranges. Aim for ≥ {ADEQ['min_test']} final-test tasks per skill."})
        verdict = "good" if not issues else ("unusable" if any(i["kind"] in ("no_headroom", "imbalanced") for i in issues) else "weak")
        skills.append({"skill": fam, "tasks": n, "untrained": b, "teacher": te, "headroom": (te - b) if b is not None and te is not None else None,
                       "top_answer": top, "top_share": share, "avg_steps": round(steps, 2), "issues": issues, "verdict": verdict})
    good = [s for s in skills if s["verdict"] == "good"]
    measured = bool(base and teacher)
    overall = ("not yet measured — run Collect and Evaluate · dev" if not measured else
               "adequate" if len(good) >= max(1, len(skills) // 2) else "weak" if good else "inadequate")
    return {"overall": overall, "measured": measured, "skills": skills, "thresholds": ADEQ,
            "note": "A good test needs, per skill: room to improve (untrained well below the teacher), a teacher that succeeds ≥ 80 %, "
                    "balanced answers, and ≥ 20 final-test tasks. Skills that fail can't show a training effect either way."}
