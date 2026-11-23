"""Decision graph: every episode of one model on one split, merged into a prefix tree per skill.

skill → 1st action → 2nd action → … → outcome. Edge weight = how many tasks took that path. Built only from observable
actions (tool names in order, then the outcome), so it shows *how a model behaves*, never its hidden reasoning.

Consistency per skill = share of tasks that followed the skill's most common path (1.0 = always the same procedure).
"""
from __future__ import annotations

from collections import Counter
from typing import Any

MAX_STEPS = 4
OUTCOMES = {"strict": "strict ✓", "answer_only": "right answer, wrong path", "wrong": "wrong answer",
            "invalid": "invalid output", "no_answer": "no answer"}


def outcome(ep: dict) -> str:
    s = ep["score"]
    if s.get("strict_success"):
        return "strict"
    if ep["termination"] in ("invalid_action",) or s.get("invalid_calls"):
        return "invalid"
    if ep.get("answer") is None:
        return "no_answer"
    return "answer_only" if s.get("answer_correct") else "wrong"


def path_of(ep: dict) -> list[str]:
    tools = [c.get("tool", "?") for c in ep.get("calls", [])]
    if len(tools) > MAX_STEPS:
        tools = tools[: MAX_STEPS - 1] + [f"… +{len(tools) - MAX_STEPS + 1} more"]
    return tools


def build(episodes: list[dict], labels: dict[str, str] | None = None) -> dict[str, Any]:
    labels = labels or {}
    nodes: dict[str, dict] = {}
    edges: Counter = Counter()
    by_skill: dict[str, list[dict]] = {}
    for e in sorted(episodes, key=lambda e: (e["family"], e["task_id"])):
        by_skill.setdefault(e["family"], []).append(e)
    max_depth = max((len(path_of(e)) for e in episodes), default=0)
    out_col = max_depth + 1
    row = 0.0
    skills_out = []
    for fam, eps in by_skill.items():
        paths = Counter()
        sid = f"skill:{fam}"
        nodes[sid] = {"id": sid, "kind": "skill", "label": labels.get(fam, fam), "col": 0, "count": len(eps), "tasks": []}
        for e in eps:
            p = path_of(e)
            o = outcome(e)
            paths[tuple(p) + (o,)] += 1
            prev = sid
            for i, tool in enumerate(p):
                nid = f"{sid}|{'>'.join(p[: i + 1])}"
                n = nodes.setdefault(nid, {"id": nid, "kind": "action", "label": tool, "col": i + 1, "count": 0, "tasks": []})
                n["count"] += 1
                if len(n["tasks"]) < 200:
                    n["tasks"].append(e["task_id"])
                edges[(prev, nid)] += 1
                prev = nid
            oid = f"{prev}|=>{o}"
            n = nodes.setdefault(oid, {"id": oid, "kind": "outcome", "outcome": o, "label": OUTCOMES[o], "col": out_col, "count": 0, "tasks": []})
            n["count"] += 1
            if len(n["tasks"]) < 200:
                n["tasks"].append(e["task_id"])
            edges[(prev, oid)] += 1
        nodes[sid]["tasks"] = [e["task_id"] for e in eps][:200]
        # Tree layout: leaves (outcomes) get consecutive rows; parents sit at the mean of their children.
        children: dict[str, list[str]] = {}
        for (a, b) in edges:
            if a == sid or a.startswith(sid + "|"):
                children.setdefault(a, []).append(b)

        def place(nid: str) -> float:
            nonlocal row
            kids = sorted(children.get(nid, []), key=lambda k: -nodes[k]["count"])
            if not kids:
                nodes[nid]["y"] = row
                row += 1
                return nodes[nid]["y"]
            ys = [place(k) for k in kids]
            nodes[nid]["y"] = sum(ys) / len(ys)
            return nodes[nid]["y"]
        place(sid)
        row += 0.6  # gap between skills
        top, top_n = paths.most_common(1)[0]
        skills_out.append({"skill": fam, "label": labels.get(fam, fam), "tasks": len(eps), "distinct_paths": len(paths),
                           "consistency": top_n / len(eps), "most_common_path": list(top[:-1]), "most_common_outcome": OUTCOMES[top[-1]],
                           "strict_rate": sum(1 for e in eps if e["score"].get("strict_success")) / len(eps)})
    return {"nodes": list(nodes.values()), "edges": [{"from": a, "to": b, "count": c} for (a, b), c in edges.items()],
            "columns": out_col + 1, "rows": row, "skills": skills_out, "episodes": len(episodes),
            "honesty": "Built from observable actions only (tool names in order, then the outcome). It shows behaviour, not hidden reasoning."}
