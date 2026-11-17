"""Observable-behavior graphs. No hidden reasoning is represented — only what the model emitted.

Path graph: prompt → tool_call(args) → tool_result → … → answer (or error), laid out as a
layered DAG with deterministic coordinates so the frontend renders SVG without a graph library.
Comparison: teacher / base / tuned lanes on one task, with the first divergence from the
teacher's action sequence and an outcome label (fixed / regressed / unchanged).
"""
from __future__ import annotations

from typing import Any

from forge.util import canonical_json

COL_W, ROW_H = 190, 110


def path_graph(ep: dict[str, Any]) -> dict[str, Any]:
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []

    def add(kind: str, label: str, detail: Any, status: str) -> str:
        nid = f"n{len(nodes)}"
        nodes.append({"id": nid, "kind": kind, "label": label, "detail": detail, "status": status,
                      "layer": len(nodes), "x": len(nodes) * COL_W, "y": 0})
        if len(nodes) > 1:
            edges.append({"from": nodes[-2]["id"], "to": nid})
        return nid

    add("prompt", "prompt", ep["events"][0].get("content") if ep["events"] else "", "neutral")
    for ev in ep["events"][1:]:
        if ev["type"] == "tool_call":
            add("tool_call", ev["tool"], ev["arguments"], "neutral")
        elif ev["type"] == "tool_result":
            add("tool_result", "error" if ev.get("error") else "result", ev["result"], "fail" if ev.get("error") else "neutral")
        elif ev["type"] == "answer":
            ok = ep["score"]["answer_correct"]
            add("answer", str(ev["content"])[:40], ev["content"], "pass" if ok else "fail")
        elif ev["type"] == "error":
            add("error", ev["code"], ev.get("detail"), "fail")
    return {"task_id": ep["task_id"], "model": ep["model"], "arm": ep.get("arm"), "seed": ep.get("seed"),
            "strict_success": ep["score"]["strict_success"], "score": ep["score"], "nodes": nodes, "edges": edges,
            "trace_hash": ep.get("trace_hash"), "width": len(nodes) * COL_W, "height": ROW_H}


def _actions(ep: dict[str, Any] | None) -> list[str]:
    if not ep:
        return []
    acts = [canonical_json({"tool": c["tool"], "arguments": c["arguments"]}) for c in ep["calls"]]
    if ep.get("answer") is not None:
        acts.append(canonical_json({"answer": str(ep["answer"]).strip()}))
    if ep.get("termination") == "invalid_action":
        acts.append("<invalid>")
    return acts


def first_divergence(reference: dict | None, other: dict | None) -> int | None:
    a, b = _actions(reference), _actions(other)
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            return i
    return None if len(a) == len(b) else min(len(a), len(b))


def outcome(base: dict | None, tuned: dict | None) -> str:
    if not base or not tuned:
        return "incomplete"
    b, t = base["score"]["strict_success"], tuned["score"]["strict_success"]
    return "fixed" if (t and not b) else "regressed" if (b and not t) else "unchanged"


def compare(teacher: dict | None, base: dict | None, tuned: dict | None) -> dict[str, Any]:
    lanes = []
    for name, ep in (("teacher", teacher), ("base", base), ("tuned", tuned)):
        lanes.append({"lane": name, "graph": path_graph(ep) if ep else None,
                      "divergence_from_teacher": first_divergence(teacher, ep) if (ep and name != "teacher") else None})
    return {"task_id": (teacher or base or tuned or {}).get("task_id"), "outcome": outcome(base, tuned), "lanes": lanes,
            "honesty": "Observable actions only. Hidden reasoning is not visualized and cannot be faithfully recovered."}
