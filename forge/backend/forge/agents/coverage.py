"""Coverage map for an agent's practice tasks: what the tasks actually exercise, so gaps are visible before training.

- skills × splits: how many tasks each skill has in train / dev / test (a skill with no test tasks cannot be measured);
- tables: which rows any task looks up, per table and split (untouched rows are behaviour the agent never practises);
- tools: how often each tool appears in reference calls;
- answers: per skill, the most common reference answers and the top answer's share (one answer dominating = an agent can
  score well by always saying it);
- variety: per skill, mean nearest-neighbour ROUGE-L of the wording (lower = more varied);
- boundary: hand-back cases per category.
Counts only; nothing here is a model result.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

from forge.agents import variety
from forge.agents.verify import answer_norm

SPLITS = ("train", "dev", "test")
KEY_ARGS = ("key", "value", "query")


def coverage(agent: Any) -> dict[str, Any]:
    tasks = agent.tasks_for_study()
    m = agent.meta
    tables = agent.tables()
    keys = {t["name"]: t["key"] for t in m["tools"].get("tables", [])}
    skills = [s["id"] for s in m["skills"]] + (["boundary"] if any(t["family"] == "boundary" for t in tasks) else [])
    grid = {s: {sp: 0 for sp in SPLITS} for s in skills}
    touched: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    tools: Counter[str] = Counter()
    answers: dict[str, Counter[str]] = defaultdict(Counter)
    nf: Counter[str] = Counter()
    cats: Counter[str] = Counter()
    for t in tasks:
        fam, sp = t["family"], t["split"]
        grid.setdefault(fam, {x: 0 for x in SPLITS})[sp] = grid.get(fam, {}).get(sp, 0) + 1
        answers[fam][answer_norm(t["reference_answer"])] += 1
        nf[fam] += int(bool(t["meta"].get("not_found")))
        if fam == "boundary":
            cats[t["meta"].get("category", "custom")] += 1
        for c in t["reference_calls"]:
            tools[c["tool"]] += 1
            tool = c["tool"]
            for prefix in ("lookup_", "find_"):
                if tool.startswith(prefix) and tool[len(prefix):] in tables:
                    for k in KEY_ARGS:
                        v = c["arguments"].get(k)
                        if isinstance(v, str):
                            touched[tool[len(prefix):]][sp].add(answer_norm(v))
    tab_out = []
    for name, rows in tables.items():
        col = keys.get(name)
        ids = {answer_norm(r.get(col)) for r in rows if col}
        per = {sp: len(touched[name][sp] & ids) for sp in SPLITS}
        allt = set().union(*(touched[name][sp] for sp in SPLITS)) & ids
        tab_out.append({"table": name, "rows": len(rows), "touched": len(allt), "share": (len(allt) / len(rows)) if rows else None, "by_split": per})
    ans_out = {}
    for fam, cnt in answers.items():
        total = sum(cnt.values())
        ans_out[fam] = {"distinct": len(cnt), "top": [{"answer": a, "n": n} for a, n in cnt.most_common(6)],
                        "top_share": cnt.most_common(1)[0][1] / total if total else None, "not_found": nf[fam], "n": total}
    warnings = []
    for s, row in grid.items():
        for sp in ("dev", "test"):
            if row.get(sp, 0) < 3:
                warnings.append(f"{s}: only {row.get(sp, 0)} {sp} tasks — too few to measure this skill")
    for fam, a in ans_out.items():
        if fam != "boundary" and a["n"] >= 10 and a["top_share"] and a["top_share"] >= 0.5:
            warnings.append(f"{fam}: one answer ({a['top'][0]['answer']}) is {round(a['top_share'] * 100)}% of tasks — always giving it would score well")
    return {"tasks": len(tasks), "skills": skills, "grid": grid, "tables": tab_out, "tools": dict(tools.most_common()),
            "answers": ans_out, "variety": variety.summary({f: [t["prompt"] for t in tasks if t["family"] == f] for f in skills}),
            "boundary": dict(cats), "warnings": warnings,
            "note": "Counts of what the practice tasks exercise. Not a model result."}
