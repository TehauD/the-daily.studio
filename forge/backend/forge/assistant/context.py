"""What the assistant may see — in two tiers.

summary  metrics, settings, statuses, statistics, skill/tool names, counts, rejection *reasons*. Sent whenever you ask.
content  actual text: task questions and answers, your examples, table rows, document passages, episode transcripts,
         lens tokens. Sent only after you have seen the exact payload and approved it.

Everything is redacted before it leaves: absolute file paths become <path>, user names in paths disappear with them, and a
payload that still looks like personal data (SSN / e-mail / phone / MRN patterns) is refused outright.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

PATH = re.compile(r"([A-Za-z]:[\\/][^\s\"',;]*|(?<![\w.])/(?:home|Users|tmp|mnt|root|var|opt|srv|data)/[^\s\"',;]*)")
MAX_LIST = 30


def redact(obj: Any) -> Any:
    if isinstance(obj, str):
        return PATH.sub("<path>", obj)
    if isinstance(obj, dict):
        return {k: redact(v) for k, v in obj.items() if k not in ("path", "root", "student_path", "source_dir", "storage_path")}
    if isinstance(obj, list):
        return [redact(v) for v in obj]
    return obj


def _round(x: Any, n: int = 4) -> Any:
    return round(x, n) if isinstance(x, float) else x


def _contrast(c: dict) -> dict:
    keep = ("mean", "ci_low", "ci_high", "arm_rate", "control_rate", "teacher_gap_closed", "invalid_rate_arm", "invalid_rate_control")
    out = {k: _round(c.get(k)) for k in keep if k in c}
    out["p_sign_flip_groups"] = _round((c.get("sign_flip_groups") or {}).get("p"))
    out["p_sign_flip_seeds"] = _round((c.get("sign_flip_seeds") or {}).get("p"))
    if c.get("families"):
        out["per_skill"] = {f: {who: _round(v["rate"], 3) for who, v in d.items()} for f, d in c["families"].items()}
    for k in ("focus", "off_focus"):
        if c.get(k):
            out[k] = {kk: _round(c[k].get(kk)) for kk in ("mean", "ci_low", "ci_high", "arm_rate", "control_rate")} | {"skills": c[k].get("families")}
    return out


def reason_class(r: str) -> str:
    return re.sub(r"\d+(\.\d+)?", "#", re.sub(r"'[^']*'", "…", r))[:120]


# ------------------------------------------------------------------ study
def study_context(study: Any) -> tuple[dict, dict, list[str]]:
    p, s = study.plan, study.summary()
    summary: dict[str, Any] = {
        "kind": "study", "name": p["name"], "profile": p["profile"], "purpose": p.get("profile_purpose"), "seeds": p["seeds"], "arms": p["arms"],
        "primary_contrast": p.get("primary_contrast"), "min_gain": p.get("min_gain"), "focus": p.get("focus"), "device": p.get("device"),
        "teacher": {k: p["teacher"].get(k) for k in ("provider", "model")},
        "student": {"name": p["student"].get("name"), "parameters": (p["student"].get("parameter_report") or {}).get("unique_total")},
        "task_set": {"kind": p["taskset"].get("kind", "catalog"), "counts": p["taskset"].get("counts")},
        "train": {k: p["train"].get(k) for k in ("rank", "alpha", "lr", "epochs", "max_steps", "max_seq_len", "grad_accum", "micro_batch")},
        "stages": {k: v.get("status") for k, v in s["state"]["stages"].items()}, "sealed": s["state"]["sealed"], "next_stage": s["next_stage"],
    }
    if p["taskset"].get("kind") == "agent":
        summary["agent_skills"] = p["taskset"]["agent"].get("skills")
    reports = {}
    for k, rep in s["reports"].items():
        r = {"gate": {kk: rep["gate"].get(kk) for kk in ("verdict", "checks")} if rep.get("gate") else None, "splits": {}}
        for sp, sec in rep.get("splits", {}).items():
            r["splits"][sp] = {"teacher_rate": _round(sec.get("teacher_rate")), "base_rate": _round(sec.get("base_rate")),
                               "arms": {a: _contrast(c) for a, c in sec.get("arms", {}).items()}}
        reports[k] = r
    summary["analysis"] = reports
    ds = []
    for arm in p["arms"]:
        mp = study.root / "datasets" / arm / "manifest.json"
        if mp.exists():
            m = json.loads(mp.read_text(encoding="utf-8"))
            ds.append({k: m.get(k) for k in ("arm", "records", "episodes_used", "exclusions", "focus_skills")})
    summary["datasets"] = ds
    runs, lens = [], []
    for arm in p["arms"]:
        for sd in p["seeds"]:
            rd = study.run_dir(arm, sd)
            if (rd / "run.json").exists():
                r = json.loads((rd / "run.json").read_text(encoding="utf-8"))
                rows = [json.loads(x) for x in (rd / "training.jsonl").read_text(encoding="utf-8").splitlines() if x] if (rd / "training.jsonl").exists() else []
                losses = [x["loss"] for x in rows if "loss" in x]
                evals = [x["eval_loss"] for x in rows if "eval_loss" in x]
                runs.append({"arm": arm, "seed": sd, "steps": r.get("global_step"), "peak_vram_mb": r.get("peak_vram_mb"), "wall_s": r.get("wall_s"),
                             "tokens": (r.get("token_stats") or {}).get("tokens_total"), "first_loss": _round(losses[0] if losses else None),
                             "last_loss": _round(losses[-1] if losses else None), "eval_loss": [_round(e) for e in evals][-6:]})
            if (rd / "lens.json").exists():
                L = json.loads((rd / "lens.json").read_text(encoding="utf-8"))
                lens.append({"arm": arm, "seed": sd, "curve": [{"label": c["label"], "nll": _round(c["nll"]), "agreement": _round(c["agreement"]),
                                                               "per_skill_nll": {f: _round(v) for f, v in c.get("families", {}).items()}} for c in L["curve"]]})
    summary["training_runs"], summary["lens"] = runs, lens

    # content tier: real text
    content: dict[str, Any] = {}
    items: list[str] = []
    if lens:
        rd = study.run_dir(lens[0]["arm"], lens[0]["seed"])
        L = json.loads((rd / "lens.json").read_text(encoding="utf-8"))
        content["lens_tokens"] = {"gained": L["tokens_gained"][:15], "lost": L["tokens_lost"][:10]}
        items.append("Lens: most gained / lost teacher tokens")
    arm, seed = p["arms"][0], p["seeds"][0]
    failures = []
    for split in ("dev",):
        try:
            tuned = {e["task_id"]: e for e in study.episodes(arm, split, seed)}
            teacher = {e["task_id"]: e for e in study.episodes("teacher", split, 0)}
        except Exception:  # not evaluated yet
            tuned, teacher = {}, {}
        for tid, e in sorted(tuned.items()):
            if not e["score"]["strict_success"] and len(failures) < 8:
                failures.append({"task": e["messages"][1]["content"][:500], "skill": e["family"],
                                 "student_actions": [m["content"][:300] for m in e["messages"][2:] if m["role"] == "assistant"][:4],
                                 "student_errors": e["score"].get("errors"),
                                 "teacher_actions": [m["content"][:300] for m in (teacher.get(tid) or {}).get("messages", [])[2:] if m["role"] == "assistant"][:4]})
    if failures:
        content["tuned_student_failures_on_dev"] = failures
        items.append(f"{len(failures)} failed dev episodes (task text, student and teacher actions)")
    return summary, content, items


# ------------------------------------------------------------------ agent
def agent_context(agent: Any) -> tuple[dict, dict, list[str]]:
    m = agent.meta
    t = m["tools"]
    st = m["steps"]["tasks"]
    rej = agent.rejected()
    summary = {
        "kind": "agent", "name": m["name"], "template": m["template"], "role": m["role"],
        "tools": [{"name": x["name"], "description": x["description"]} for x in agent.toolset_names()],
        "tables": [{k: tb.get(k) for k in ("name", "description", "key", "columns", "rows")} for tb in t.get("tables", [])],
        "rules": t.get("rules", []), "linked_documents": bool(t.get("knowledge_pack")),
        "skills": [{k: s.get(k) for k in ("id", "name", "description", "tools", "not_found")} | {"examples": len(s.get("examples", []))} for s in m["skills"]],
        "practice_tasks": {"status": st.get("status"), "summary": st.get("summary")},
        "rejection_reasons": dict(Counter(reason_class(r["reason"]) for r in rej).most_common(12)),
    }
    content: dict[str, Any] = {}
    items: list[str] = []
    if any(s.get("examples") for s in m["skills"]):
        content["your_examples"] = {s["name"]: s.get("examples", [])[:4] for s in m["skills"]}
        items.append("your skill examples (questions, answers, tool calls)")
    tables = agent.tables()
    if tables:
        content["table_samples"] = {k: v[:5] for k, v in tables.items()}
        items.append(f"5 sample rows from each of {len(tables)} table(s)")
    tasks = agent.tasks()
    if tasks:
        content["accepted_tasks_sample"] = [{"q": x["prompt"], "a": x["reference_answer"], "skill": x["family"], "calls": x["reference_calls"]} for x in tasks[:12]]
        items.append("12 accepted practice tasks")
    if rej:
        content["rejected_sample"] = [{"skill": r["skill"], "candidate": r.get("candidate"), "reason": r["reason"]} for r in rej[:15]]
        items.append("15 rejected candidates with reasons")
    return summary, content, items


# ------------------------------------------------------------------ knowledge pack
def pack_context(pack: Any) -> tuple[dict, dict, list[str]]:
    m = pack.meta
    summary = {"kind": "knowledge_pack", "name": m["name"], "steps": {k: v.get("status") for k, v in m["steps"].items()},
               "results": {k: v.get("summary") for k, v in m["steps"].items()}, "embedding_model": (m.get("embedding") or {}).get("model"),
               "chunking": m.get("chunking"), "rejection_reasons": dict(Counter(reason_class(r["reason"]) for r in pack.rejected()).most_common(10))}
    mp = pack.root / "map.json"
    mapd = json.loads(mp.read_text(encoding="utf-8")) if mp.exists() else None
    if mapd:
        summary["embedding_map"] = {"retrieval_hit_rate": _round(mapd["retrieval_hit_rate"]), "projection": mapd["projection"],
                                    "passages": len(mapd["passages"]), "questions": len(mapd["questions"])}
    content: dict[str, Any] = {}
    items: list[str] = []
    qs = pack.questions()
    if qs:
        content["questions_sample"] = [{"q": q["prompt"], "a": q["reference_answer"], "split": q["split"]} for q in qs[:12]]
        items.append("12 practice questions with answers")
    if mapd:
        misses = [q for q in mapd["questions"] if q["hit"] is False][:8]
        if misses:
            content["search_misses"] = [{"q": q["prompt"], "right_passage": mapd["passages"][q["gold"]]["text"][:300],
                                         "gold_meaning_rank": q["gold_vector_rank"],
                                         "returned": [mapd["passages"][i]["text"][:200] for i in q["retrieved"]]} for q in misses]
            items.append(f"{len(misses)} questions search missed, with passages")
    return summary, content, items


# ------------------------------------------------------------------ general
def general_context(st: Any, rd: dict | None = None) -> tuple[dict, dict, list[str]]:
    from forge import __version__
    checks = [{k: c.get(k) for k in ("id", "status", "label")} for c in (rd or {}).get("checks", [])]
    models = st.registry.list()
    roles = [{"name": x.get("name"), "provider": x.get("provider"), "roles": x.get("roles"), "params": x.get("parameter_count"),
              "quant": (x.get("metadata") or {}).get("quantization")} for x in models if x.get("roles")][:MAX_LIST]
    studies = [{"name": r["name"], "profile": r["profile"]} for r in st.db.query("SELECT name, profile FROM studies ORDER BY created_at DESC LIMIT 10")]
    return {"kind": "general", "forge_version": __version__, "readiness": checks, "assigned_models": roles, "recent_studies": studies}, {}, []


def size_of(obj: Any) -> int:
    return len(json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8"))


def short_path(p: Path) -> str:
    return p.name
