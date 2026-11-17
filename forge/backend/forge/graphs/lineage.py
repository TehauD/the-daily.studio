"""Lineage graph: base model → dataset version → config hash → adapter sha256 → evaluation report.

Built from files on disk (plan, manifests, run.json, reports); every node carries the file path
that proves it, so the UI can open the evidence.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from forge.util import canonical_json, sha256_text


def lineage(study_root: Path) -> dict[str, Any]:
    plan = json.loads((study_root / "plan.json").read_text(encoding="utf-8"))
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []

    def node(nid: str, kind: str, label: str, digest: str | None, path: Path | None, layer: int, **meta: Any) -> str:
        nodes.append({"id": nid, "kind": kind, "label": label, "digest": digest, "path": str(path) if path else None,
                      "layer": layer, "exists": bool(path and path.exists()), **meta})
        return nid

    base = node("base", "base_model", plan["student"].get("name", "student"), plan.get("base_hash"),
                Path(plan["student"]["path"]), 0)
    teach = node("teacher", "teacher", plan["teacher"].get("model", "teacher"), None, None, 0)
    plan_n = node("plan", "plan", f"plan · {plan['profile']}", (study_root / "plan.sha256").read_text(encoding="utf-8").strip(),
                  study_root / "plan.json", 1)
    edges += [{"from": base, "to": plan_n}, {"from": teach, "to": plan_n}]
    for arm in plan["arms"]:
        mpath = study_root / "datasets" / arm / "manifest.json"
        m = json.loads(mpath.read_text(encoding="utf-8")) if mpath.exists() else {}
        d = node(f"ds:{arm}", "dataset", f"dataset · {arm}", m.get("records_sha256"), mpath, 2, records=m.get("records"))
        edges.append({"from": plan_n, "to": d})
        cfg = {**plan["train"], **plan["arm_overrides"][arm]["train"]}
        c = node(f"cfg:{arm}", "config", f"config · {arm}", sha256_text(canonical_json(cfg)), study_root / "plan.json", 3,
                 config=cfg)
        edges.append({"from": d, "to": c})
        for seed in plan["seeds"]:
            rp = study_root / "runs" / arm / f"seed{seed}" / "run.json"
            run = json.loads(rp.read_text(encoding="utf-8")) if rp.exists() else {}
            a = node(f"ad:{arm}:{seed}", "adapter", f"adapter · s{seed}", run.get("adapter_sha256"),
                     rp.parent / "adapter", 4, global_step=run.get("global_step"))
            edges.append({"from": c, "to": a})
            for split in ("dev", "test"):
                rpt = study_root / "reports" / f"analysis_{split}.json"
                if rpt.exists():
                    rid = f"rep:{split}"
                    if not any(n["id"] == rid for n in nodes):
                        node(rid, "report", f"analysis · {split}", None, rpt, 5)
                    edges.append({"from": a, "to": rid})
    exp = study_root / "exports"
    if exp.exists():
        for d in sorted(exp.iterdir()):
            node(f"exp:{d.name}", "export", d.name, None, d, 6)
            edges.append({"from": f"ad:{plan['arms'][0]}:{plan['seeds'][0]}", "to": f"exp:{d.name}"})
    # deterministic layered layout
    by_layer: dict[int, list[dict]] = {}
    for n in nodes:
        by_layer.setdefault(n["layer"], []).append(n)
    for layer, ns in by_layer.items():
        for i, n in enumerate(ns):
            n["x"], n["y"] = layer * 200, i * 74
    return {"nodes": nodes, "edges": edges, "width": (max(by_layer) + 1) * 200,
            "height": max(len(v) for v in by_layer.values()) * 74}
