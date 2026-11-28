"""Evidence: did the student learn, and can the measurement be trusted?

Everything here is computed from files the study already holds — episodes, analyses, training logs:

- components   per model (untrained, each trained arm, teacher) and split: strict success and its parts — right tool, argument
               accuracy, right final answer, invalid calls — with Wilson 95 % ranges, so a gain can be traced to *what* changed;
- contrasts    each trained arm against the untrained student from the study's own analysis (crossed bootstrap over seeds and
               task groups, sign-flip tests);
- controls     an arm trained on `shuffled_control` data (verified completions moved to other tasks) is a negative control:
               format and tool names without the right pairing. Real learning shows a gain in the real arm, none in the control;
- curves       training loss per step and held-out (dev) loss, per arm and seed;
- seeds        each seed's strict success, to show whether the gain repeats;
- skills       per-skill strict success;
- fixed        tasks the trained student gets right (majority of seeds) and the untrained one gets wrong — open them in Compare.
"""
from __future__ import annotations

import json
from collections import defaultdict
from typing import Any

from forge.engine import statistics as st

PARTS = [("strict_success", "strict success (all right)"), ("tool_selection_correct", "right tool chosen"),
         ("argument_accuracy", "right arguments"), ("answer_correct", "right final answer"), ("invalid", "invalid tool calls (lower is better)")]
CONTROL_ARMS = {"shuffled_control"}


def _eps(study: Any, arm: str, split: str, seeds: list[int]) -> dict[int, list[dict]]:
    out = {}
    for s in seeds:
        p = study.episode_path(arm, split, s)
        if p.exists():
            out[s] = study.episodes(arm, split, s)
    return out


def _parts(eps: list[dict]) -> dict[str, Any]:
    n = len(eps)
    out: dict[str, Any] = {"n": n}
    for k, _ in PARTS:
        if k == "invalid":
            v = [1.0 if (e["score"].get("invalid_calls") or 0) > 0 else 0.0 for e in eps]
        elif k == "argument_accuracy":
            v = [float(e["score"].get(k) or 0.0) for e in eps]
        else:
            v = [1.0 if e["score"].get(k) else 0.0 for e in eps]
        m = sum(v) / n if n else None
        out[k] = {"rate": m, "ci": list(st.wilson(sum(v), n)) if n and k != "argument_accuracy" else None}
    return out


def evidence(study: Any) -> dict[str, Any]:
    plan = study.plan
    ctl = plan["eval"]["control_seed_broadcast"]
    trained = list(plan["arms"])
    models = [("base", "untrained student", [ctl])] + [(a, ("negative control (shuffled answers)" if a in CONTROL_ARMS else f"trained · {a}"), plan["seeds"]) for a in trained] \
        + [("teacher", "teacher", [0])]
    reports = {}
    for sp in ("dev", "test"):
        p = study.root / "reports" / f"analysis_{sp}.json"
        if p.exists():
            reports[sp] = json.loads(p.read_text(encoding="utf-8"))
    splits = [sp for sp in ("test", "dev") if any(_eps(study, "base", sp, [ctl]).values())]
    comp: dict[str, dict[str, Any]] = {}
    seeds: dict[str, dict[str, Any]] = {}
    skills: dict[str, dict[str, dict[str, float]]] = {}
    for sp in splits:
        comp[sp], seeds[sp], skills[sp] = {}, {}, defaultdict(dict)
        for arm, label, ss in models:
            by_seed = _eps(study, arm, sp, ss)
            allv = [e for v in by_seed.values() for e in v]
            if not allv:
                continue
            comp[sp][arm] = {"label": label, **_parts(allv)}
            seeds[sp][arm] = {str(s): sum(1 for e in v if e["score"]["strict_success"]) / len(v) for s, v in by_seed.items() if v}
            fam: dict[str, list[int]] = defaultdict(list)
            for e in allv:
                fam[e["family"]].append(int(bool(e["score"]["strict_success"])))
            for f, v in fam.items():
                skills[sp][f][arm] = sum(v) / len(v)
    contrasts: dict[str, dict[str, Any]] = {}
    for sp, rep in reports.items():
        sec = rep.get("splits", {}).get(sp, {})
        for arm, c in (sec.get("arms") or {}).items():
            contrasts.setdefault(sp, {})[arm] = {"gain": c.get("mean"), "ci": [c.get("ci_low"), c.get("ci_high")], "arm_rate": c.get("arm_rate"),
                                                 "control_rate": c.get("control_rate"), "p_groups": (c.get("sign_flip_groups") or {}).get("p"),
                                                 "p_seeds": (c.get("sign_flip_seeds") or {}).get("p"), "min_p_seeds": (c.get("sign_flip_seeds") or {}).get("min_attainable_p")}
    curves: dict[str, list[dict[str, Any]]] = {}
    for arm in trained:
        for s in plan["seeds"]:
            p = study.run_dir(arm, s) / "training.jsonl"
            if not p.exists():
                continue
            rows = [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x.strip()]
            curves.setdefault(arm, []).append({"seed": s, "train": [[r["step"], r["loss"]] for r in rows if "loss" in r],
                                               "heldout": [[r["step"], r["eval_loss"]] for r in rows if "eval_loss" in r]})
    fixed = []
    real = next((a for a in trained if a not in CONTROL_ARMS), None)
    sp0 = splits[0] if splits else None
    if real and sp0:
        b = {e["task_id"]: e for v in _eps(study, "base", sp0, [ctl]).values() for e in v}
        votes: dict[str, list[int]] = defaultdict(list)
        for v in _eps(study, real, sp0, plan["seeds"]).values():
            for e in v:
                votes[e["task_id"]].append(int(bool(e["score"]["strict_success"])))
        for tid, v in sorted(votes.items()):
            if tid in b and not b[tid]["score"]["strict_success"] and sum(v) * 2 > len(v):
                fixed.append({"task_id": tid, "family": b[tid]["family"], "seeds_right": sum(v), "seeds": len(v)})
    verdict = _verdict(contrasts, trained, splits)
    return {"study": {"id": plan["study_id"], "name": plan["name"], "sealed": bool(study.state.get("sealed")), "seeds": plan["seeds"],
                      "student": plan["student"]["name"], "arms": trained, "train": {k: plan["train"].get(k) for k in ("lr", "rank", "max_steps", "epochs")}},
            "splits": splits, "parts": [{"key": k, "label": l} for k, l in PARTS], "components": comp, "contrasts": contrasts, "seeds": seeds,
            "skills": {sp: dict(v) for sp, v in skills.items()}, "curves": curves, "fixed": fixed[:12], "fixed_total": len(fixed), "fixed_split": sp0,
            "verdict": verdict,
            "honesty": "Strict success on synthetic tasks. A gain over the untrained student with the negative control flat shows the student learned "
                       "the skill and that the measurement responds to real learning, not to format alone. It does not show performance on real requests, "
                       "clinical validity or deployment readiness."}


def _verdict(contrasts: dict, trained: list[str], splits: list[str]) -> dict[str, Any]:
    sp = "test" if "test" in contrasts else ("dev" if "dev" in contrasts else None)
    if not sp:
        return {"status": "not_measured", "text": "No analysed results yet: run Evaluate and Analyze."}
    c = contrasts[sp]
    real = next((a for a in trained if a not in CONTROL_ARMS and a in c), None)
    ctl = next((a for a in trained if a in CONTROL_ARMS and a in c), None)
    where = "the sealed final test" if sp == "test" else "practice (dev) tasks"
    if not real:
        return {"status": "not_measured", "text": "No trained arm analysed."}
    r = c[real]
    learned = r["ci"][0] is not None and r["ci"][0] > 0
    out = {"split": sp, "real_arm": real, "control_arm": ctl, "learned": learned}
    if ctl:
        k = c[ctl]
        ctl_flat = k["ci"][0] is not None and k["ci"][0] <= 0 <= (k["ci"][1] or 0)
        ctl_below = k["ci"][1] is not None and r["ci"][0] is not None and k["ci"][1] < r["ci"][0]
        out |= {"control_flat": ctl_flat, "control_below_real": ctl_below}
        if learned and (ctl_flat or ctl_below):
            out |= {"status": "learned_and_valid", "text": f"Learned, and the measurement passes its control: on {where} the trained student gains "
                    f"{r['gain'] * 100:+.1f} pts (95 % {r['ci'][0] * 100:+.1f} to {r['ci'][1] * 100:+.1f}), while the negative control — same examples with "
                    f"answers shuffled — gains {k['gain'] * 100:+.1f} pts (95 % {k['ci'][0] * 100:+.1f} to {k['ci'][1] * 100:+.1f})."}
        elif learned:
            out |= {"status": "control_failed", "text": f"Gain on {where}, but the negative control also gains ({k['gain'] * 100:+.1f} pts): part of the measured gain may come from format alone. Investigate before trusting it."}
        else:
            out |= {"status": "not_shown", "text": f"No gain shown on {where}: the range of the trained student's gain includes zero."}
    else:
        out |= {"status": "learned" if learned else "not_shown",
                "text": (f"Gain on {where}: {r['gain'] * 100:+.1f} pts (95 % {r['ci'][0] * 100:+.1f} to {r['ci'][1] * 100:+.1f}). Add a shuffled_control arm to show the measurement responds to real learning."
                         if learned else f"No gain shown on {where}: the range includes zero.")}
    return out
