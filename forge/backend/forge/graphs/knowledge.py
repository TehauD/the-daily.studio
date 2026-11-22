"""Knowledge graph of a study: models, data, adapters, skills, tools — and what training changed.

Everything is derived from files the study already wrote (plan, dataset manifests, run.json,
inspection.json, episode JSONL). Capability edges carry *measured* rates on a chosen evaluation
view; nothing is inferred about internal "knowledge". Rates pool episodes across seeds and are
descriptive — inference lives in the Evaluation Lab's group-level statistics.

Node kinds:  teacher · reference (task oracle) · base · tuned · dataset · skill · tool
Edge kinds:  produced (teacher/oracle → dataset) · trained (dataset → tuned) · adapted (base → tuned)
             performs (model → skill, weighted by the selected metric) · requires (skill → tool)
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from forge.engine.statistics import wilson
from forge.engine.study import TRAIN_ARMS, Study

METRICS = ("strict_success", "answer_correct", "tool_selection_correct", "argument_accuracy", "invalid_rate")
VIEWS = {"dev": ("dev",), "heldout": ("test", "ood", "regression")}
SKILL_LABEL = {"catalog_lookup": "Catalog lookup", "multi_step_quote": "Multi-step quote",
               "missing_item": "Missing-item detection", "extraction": "SKU extraction",
               "doc_answerable": "Answer from your documents", "doc_unanswerable": "Say NOT_FOUND when absent"}
TOOLS_FOR = {"catalog_lookup": ["lookup"], "missing_item": ["lookup"], "multi_step_quote": ["quote"], "extraction": [],
             "doc_answerable": ["search"], "doc_unanswerable": ["search"]}
COLS = {"teacher": 0, "reference": 0, "base": 0, "dataset": 1, "tuned": 2, "skill": 3, "tool": 4}


def _skill_key(family: str, split: str) -> str:
    if split == "ood":
        return f"{family}@ood"
    return family


def _skill_label(key: str, extra: dict[str, str] | None = None) -> str:
    fam, _, mod = key.partition("@")
    base = (extra or {}).get(fam) or SKILL_LABEL.get(fam, fam)
    return f"{base} · OOD wording" if mod == "ood" else (f"{base} (regression check)" if fam == "extraction" else base)


def _metrics(eps: list[dict]) -> dict[str, Any]:
    n = len(eps)
    if not n:
        return {}
    out: dict[str, Any] = {"n": n}
    for m in ("strict_success", "answer_correct", "tool_selection_correct"):
        k = sum(1 for e in eps if e["score"][m])
        out[m] = {"rate": k / n, "ci": wilson(k, n)}
    aa = sum(e["score"]["argument_accuracy"] for e in eps) / n
    out["argument_accuracy"] = {"rate": aa, "ci": None}
    k = sum(1 for e in eps if e["score"]["invalid_calls"] > 0)
    out["invalid_rate"] = {"rate": k / n, "ci": wilson(k, n)}
    return out


def _collect(study: Study, arm: str, splits: tuple[str, ...], seeds: list[int]) -> dict[str, list[dict]]:
    by_skill: dict[str, list[dict]] = defaultdict(list)
    for split in splits:
        for s in seeds:
            for e in study.episodes(arm, split, s):
                by_skill[_skill_key(e["family"], split)].append(e)
    return by_skill


def _json(p: Path) -> dict | None:
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
    except (OSError, json.JSONDecodeError):
        return None


def _last_tokens_seen(p: Path) -> int | None:
    """Exact token exposure from the Trainer counter recorded in training.jsonl (last logged row)."""
    if not p.exists():
        return None
    lines = [line for line in p.read_text(encoding="utf-8").splitlines() if line.strip()]
    for line in reversed(lines):
        try:
            v = json.loads(line).get("tokens_seen")
        except json.JSONDecodeError:
            continue
        if v:
            return int(v)
    return None


def build(study: Study, view: str = "auto", registry_rows: dict[str, dict] | None = None) -> dict[str, Any]:
    plan, registry_rows = study.plan, registry_rows or {}
    arms, seeds = plan["arms"], plan["seeds"]
    c0 = plan["eval"]["control_seed_broadcast"]
    if view == "auto":
        view = "heldout" if any(study.episode_path(a, "test", s).exists() for a in arms for s in seeds) else "dev"
    if view not in VIEWS:
        raise ValueError(f"view must be one of {list(VIEWS)} or 'auto'")
    splits = VIEWS[view]

    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []

    def node(nid: str, kind: str, label: str, **attrs: Any) -> None:
        nodes[nid] = {"id": nid, "kind": kind, "label": label, "col": COLS[kind], **attrs}

    t, s = plan["teacher"], plan["student"]
    trow, srow = registry_rows.get(t.get("model_id", ""), {}), registry_rows.get(s.get("model_id", ""), {})
    node("teacher", "teacher", t["model"], provider=t["provider"], endpoint=t.get("endpoint"),
         params=trow.get("parameter_count"), quant=trow.get("quantization"), arch=trow.get("architecture"),
         context=trow.get("context_length"), format=trow.get("format"))
    node("oracle", "reference", "Task oracle (reference)",
         note="Deterministic reference actions from the task generator; used for the oracle_sft arm and eligibility.")
    preport = s.get("parameter_report") or (srow.get("metadata") or {}).get("parameter_report") or {}
    node("base", "base", s["name"], params=srow.get("parameter_count") or preport.get("stored_total"),
         unique_params=preport.get("unique_total"), arch=srow.get("architecture"), base_hash=plan.get("base_hash"),
         path=s.get("path"))

    perf: dict[str, dict[str, dict]] = {}
    perf["teacher"] = {k: _metrics(v) for k, v in _collect(study, "teacher", splits, [0]).items()}
    perf["base"] = {k: _metrics(v) for k, v in _collect(study, "base", splits, [c0]).items()}

    for arm in arms:
        man = _json(study.root / "datasets" / arm / "manifest.json")
        data_src = TRAIN_ARMS[arm]["data"]
        ds_id = f"dataset:{data_src}"
        if ds_id not in nodes:
            node(ds_id, "dataset", f"{data_src} records", policy=data_src,
                 records=man.get("records") if man else None, episodes=man.get("episodes_used") if man else None,
                 sha256=man.get("records_sha256") if man else None, built=man is not None)
            src = "oracle" if data_src == "oracle_sft" else "teacher"
            edges.append({"from": src, "to": ds_id, "kind": "produced",
                          "label": f"{man['episodes_used']} verified trajectories" if man else "not built yet",
                          "measured": man is not None})
        trained_seeds = [sd for sd in seeds if (study.run_dir(arm, sd) / "run.json").exists()]
        runs = [r for r in (_json(study.run_dir(arm, sd) / "run.json") for sd in trained_seeds) if r]
        insp = [i for i in (_json(study.run_dir(arm, sd) / "inspection.json") for sd in seeds) if i]
        rel = [m["relative_change"] for i in insp for m in i["modules"] if m.get("relative_change") is not None]
        er = [m["effective_rank"] for i in insp for m in i["modules"]]
        tid = f"tuned:{arm}"
        overrides = TRAIN_ARMS[arm]["train"]
        node(tid, "tuned", f"{s['name']} + {arm}", arm=arm, trained_seeds=trained_seeds, seeds_trained=len(runs), seeds_planned=len(seeds),
             adapter_sha256=[r.get("adapter_sha256") for r in runs], global_steps=[r.get("global_step") for r in runs],
             trainable_params=runs[0].get("trainable_params") if runs else None,
             tokens_seen=_last_tokens_seen(study.run_dir(arm, trained_seeds[0]) / "training.jsonl") if trained_seeds else None,
             peak_vram_mb=max((r.get("peak_vram_mb") or 0 for r in runs), default=None) or None,
             mean_relative_change=(sum(rel) / len(rel)) if rel else None, mean_effective_rank=(sum(er) / len(er)) if er else None,
             rank=overrides.get("rank", plan["train"]["rank"]), alpha=overrides.get("alpha", plan["train"]["alpha"]),
             factor=overrides or {"data": data_src})
        edges.append({"from": ds_id, "to": tid, "kind": "trained", "measured": bool(runs),
                      "label": f"{len(runs)}/{len(seeds)} seeds trained" if runs else "not trained yet"})
        edges.append({"from": "base", "to": tid, "kind": "adapted", "measured": bool(runs),
                      "label": f"LoRA r={nodes[tid]['rank']}" + (f" · ‖ΔW‖/‖W‖ {nodes[tid]['mean_relative_change']:.2e}"
                                                                 if nodes[tid]["mean_relative_change"] else "")})
        perf[tid] = {k: _metrics(v) for k, v in _collect(study, arm, splits, seeds).items()}

    skills = sorted({k for p in perf.values() for k in p}, key=lambda k: (k.partition("@")[2], k))
    if not skills:  # nothing evaluated yet: still show the skills the task set defines
        tasks = study.tasks()
        skills = sorted({_skill_key(t.family, t.split) for t in tasks if t.split in splits})
    tools: set[str] = set()
    ts_plan = study.plan["taskset"]
    labels: dict[str, str] = {}
    tools_for = dict(TOOLS_FOR)
    if ts_plan.get("kind") == "agent":  # purpose-built agent: skill names and tools come from the frozen agent
        labels = {sk["id"]: sk["name"] for sk in ts_plan["agent"].get("skills", [])}
        for t in study.tasks():
            tools_for.setdefault(t.family, [])
            for c in t.reference_calls:
                if c["tool"] not in tools_for[t.family]:
                    tools_for[t.family].append(c["tool"])
    for k in skills:
        node(f"skill:{k}", "skill", _skill_label(k, labels), family=k.partition("@")[0], ood=k.endswith("@ood"))
        for tool in tools_for.get(k.partition("@")[0], []):
            tools.add(tool)
            edges.append({"from": f"skill:{k}", "to": f"tool:{tool}", "kind": "requires", "measured": True, "label": "reference calls"})
    for tool in sorted(tools):
        node(f"tool:{tool}", "tool", f"{tool}()", note="read-only, allowlisted")

    for mid, by_skill in perf.items():
        for k, m in by_skill.items():
            if not m:
                continue
            e = {"from": mid, "to": f"skill:{k}", "kind": "performs", "measured": True, "n": m["n"],
                 "metrics": {x: m[x]["rate"] for x in METRICS}, "ci": {x: m[x]["ci"] for x in METRICS}}
            if mid.startswith("tuned:") and k in perf["base"] and perf["base"][k]:
                e["delta_vs_base"] = {x: m[x]["rate"] - perf["base"][k][x]["rate"] for x in METRICS}
            edges.append(e)

    # Per-model "after training" profile: biggest movements vs base on strict success.
    for nid, n in nodes.items():
        if n["kind"] == "tuned":
            ds = [(e["to"], e["delta_vs_base"]["strict_success"]) for e in edges if e["from"] == nid and "delta_vs_base" in e]
            n["gains"] = [{"skill": nodes[k]["label"], "delta": d} for k, d in sorted(ds, key=lambda x: -x[1]) if d > 0]
            n["regressions"] = [{"skill": nodes[k]["label"], "delta": d} for k, d in sorted(ds, key=lambda x: x[1]) if d < 0]

    # Deterministic layered layout.
    by_col: dict[int, list[dict]] = defaultdict(list)
    order = {"teacher": 0, "reference": 1, "base": 2}
    for n in sorted(nodes.values(), key=lambda n: (order.get(n["kind"], 9), n["id"])):
        by_col[n["col"]].append(n)
    H = max(len(v) for v in by_col.values())
    for col, ns in by_col.items():
        off = (H - len(ns)) / 2
        for i, n in enumerate(ns):
            n["x"], n["y"] = col, off + i
    return {"study_id": plan["study_id"], "view": view, "splits": list(splits), "metrics": list(METRICS),
            "nodes": list(nodes.values()), "edges": edges, "rows": H, "cols": max(by_col) + 1,
            "provenance": "measured from study files; capability rates pool episodes across seeds (descriptive)",
            "honesty": "Edges are measured behavior and recorded lineage. The graph does not depict concepts "
                       "or knowledge stored inside the weights."}


def to_graphml(g: dict[str, Any]) -> str:
    """GraphML for Gephi / yEd / Neo4j import. Scalar attributes only; lists are JSON-encoded."""
    def val(v: Any) -> str:
        return escape(v if isinstance(v, str) else json.dumps(v))
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
           '<key id="kind" for="all" attr.name="kind" attr.type="string"/>',
           '<key id="label" for="all" attr.name="label" attr.type="string"/>',
           '<key id="attrs" for="all" attr.name="attrs" attr.type="string"/>',
           f'<graph id="{escape(g["study_id"])}" edgedefault="directed">']
    skip = {"id", "kind", "label", "x", "y", "col"}
    for n in g["nodes"]:
        attrs = {k: v for k, v in n.items() if k not in skip}
        out.append(f'<node id="{escape(n["id"])}"><data key="kind">{val(n["kind"])}</data>'
                   f'<data key="label">{val(n["label"])}</data><data key="attrs">{val(attrs)}</data></node>')
    for i, e in enumerate(g["edges"]):
        attrs = {k: v for k, v in e.items() if k not in ("from", "to", "kind", "label")}
        out.append(f'<edge id="e{i}" source="{escape(e["from"])}" target="{escape(e["to"])}">'
                   f'<data key="kind">{val(e["kind"])}</data><data key="label">{val(e.get("label", ""))}</data>'
                   f'<data key="attrs">{val(attrs)}</data></edge>')
    out += ["</graph>", "</graphml>"]
    return "\n".join(out)
