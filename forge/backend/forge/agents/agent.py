"""A purpose-built agent: its role, read-only tools over your data, and the skills it should get better at.

On disk (FORGE_HOME/agents/<id>/):
    agent.json          spec (role, tools, rules, skills with your examples) + attestation + step status
    tables/<name>.json  imported rows (scanned for personal identifiers before they are stored)
    tasks.jsonl         verified practice tasks, split train/dev/test by entity (no entity crosses splits)
    rejected.jsonl      every candidate that failed verification, with the reason
    search_cache.json   query vectors for linked-document search (deterministic re-runs)

Steps: define → tasks. Any change to the spec or the tables marks the tasks stale.
"""
from __future__ import annotations

import csv
import io
import json
import random
import re
from pathlib import Path
from typing import Any, Callable

from forge.agents import safety, templates
from forge.agents.tools import NAME, OPS, ToolSet, norm_cell
from forge.agents.verify import answer_norm, verify_task
from forge.engine.runtime import ActionError, ChatBackend, strip_reasoning
from forge.engine.tasks import Task
from forge.util import canonical_json, new_id, sha256_file, sha256_text, utcnow, write_json_atomic

MAX_ROWS, MAX_COLS, MAX_CELL, MAX_BYTES = 20000, 40, 500, 5_000_000
SPLITS = (("train", 0.6), ("dev", 0.2), ("test", 0.2))


class AgentError(ValueError):
    pass


def _snake(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", s.strip().lower()).strip("_")
    return ("c_" + s if s and s[0].isdigit() else s)[:40] or "col"


def parse_table(text: str, filename: str = "") -> tuple[list[str], list[dict[str, Any]]]:
    if len(text.encode("utf-8")) > MAX_BYTES:
        raise AgentError("Table is larger than 5 MB")
    body = text.lstrip("﻿")
    if filename.lower().endswith(".json") or body.lstrip().startswith("["):
        try:
            raw = json.loads(body)
        except json.JSONDecodeError as e:
            raise AgentError(f"Invalid JSON: {e}") from None
        if not isinstance(raw, list) or not all(isinstance(r, dict) for r in raw):
            raise AgentError("JSON tables must be a list of objects")
    else:
        dialect = csv.Sniffer().sniff(body[:4096], delimiters=",;\t") if body.strip() else csv.excel
        raw = list(csv.DictReader(io.StringIO(body), dialect=dialect))
    if not raw:
        raise AgentError("The table has no rows")
    if len(raw) > MAX_ROWS:
        raise AgentError(f"At most {MAX_ROWS} rows")
    cols_raw = list(dict.fromkeys(k for r in raw for k in r if k is not None))
    if len(cols_raw) > MAX_COLS:
        raise AgentError(f"At most {MAX_COLS} columns")
    mapping = {c: _snake(str(c)) for c in cols_raw}
    if len(set(mapping.values())) != len(mapping):
        raise AgentError("Two columns have the same name after normalisation")
    rows = []
    for r in raw:
        row = {}
        for c in cols_raw:
            v = r.get(c, "")
            v = "" if v is None else v
            if isinstance(v, (dict, list)):
                raise AgentError("Cells must be plain values (no nested objects)")
            if len(str(v)) > MAX_CELL:
                raise AgentError(f"Cells must be ≤ {MAX_CELL} characters")
            row[mapping[c]] = v.strip() if isinstance(v, str) else v
        rows.append(row)
    return list(mapping.values()), rows


class Agent:
    def __init__(self, root: Path):
        self.root = root
        if not (root / "agent.json").exists():
            raise AgentError(f"No agent at {root}")

    # ---- storage
    @property
    def meta(self) -> dict[str, Any]:
        return json.loads((self.root / "agent.json").read_text(encoding="utf-8"))

    def _save(self, m: dict[str, Any]) -> None:
        write_json_atomic(self.root / "agent.json", json.dumps(m, indent=2, ensure_ascii=False))

    @staticmethod
    def create(base: Path, name: str, template: str, no_sensitive_data: bool) -> "Agent":
        if not no_sensitive_data:
            raise AgentError("Confirm the agent's data contains no patient, personal, or confidential information")
        if template not in templates.TEMPLATES:
            raise AgentError(f"Unknown template '{template}'")
        t = templates.TEMPLATES[template]
        aid = new_id("agent")
        root = base / aid
        (root / "tables").mkdir(parents=True)
        data = templates.build_tables(template)
        tables = []
        for ts in t["tables"]:
            rows = data[ts["name"]]
            cols = list(rows[0])
            (root / "tables" / f"{ts['name']}.json").write_text(json.dumps(rows), encoding="utf-8")
            tables.append({"name": ts["name"], "description": ts["description"], "key": ts["key"], "columns": cols,
                           "rows": len(rows), "source": "template (synthetic)"})
        m = {"id": aid, "name": name.strip() or t["title"], "template": template, "created_at": utcnow(),
             "attestation": {"no_sensitive_data": True, "at": utcnow()}, "role": t["role"],
             "tools": {**{k: v for k, v in t["tools"].items()}, "tables": tables},
             "skills": templates.stored_skills(template, data), "steps": {"tasks": {"status": None}}}
        a = Agent.__new__(Agent)
        a.root = root
        a._save(m)
        a.validate()
        return a

    def tables(self) -> dict[str, list[dict]]:
        return {t["name"]: self._rows_for(t["name"]) for t in self.meta["tools"].get("tables", [])}

    def tasks(self) -> list[dict]:
        p = self.root / "tasks.jsonl"
        return [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x] if p.exists() else []

    def rejected(self) -> list[dict]:
        p = self.root / "rejected.jsonl"
        return [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x] if p.exists() else []

    def hashes(self) -> dict[str, str | None]:
        m = self.meta
        spec = {k: m[k] for k in ("role", "tools", "skills")}
        tabs = {t["name"]: sha256_file(self.root / "tables" / f"{t['name']}.json") for t in m["tools"].get("tables", [])}
        p = self.root / "tasks.jsonl"
        return {"spec": sha256_text(canonical_json(spec)), "tables": sha256_text(canonical_json(tabs)),
                "tasks": sha256_file(p) if p.exists() else None}

    def _stale(self, m: dict) -> None:
        if m["steps"]["tasks"].get("status") == "completed":
            m["steps"]["tasks"]["status"] = "stale"

    # ---- tools
    def pack(self) -> Any:
        pid = self.meta["tools"].get("knowledge_pack")
        if not pid:
            return None
        from forge.knowledge.pack import KnowledgePack, PackError
        snap = self.meta.get("snapshot_pack_path")  # frozen study copies remember where the pack lives
        try:
            return KnowledgePack(Path(snap) if snap else self.root.parent.parent / "knowledge" / pid)
        except PackError as e:
            raise AgentError(f"Linked knowledge pack missing: {e}") from e

    def toolset(self, cache: dict | None = None, cache_path: Path | None = None) -> ToolSet:
        search = None
        pack = self.pack()
        if pack is not None:
            if cache is None:
                cache_path = cache_path or self.root / "search_cache.json"
                cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
            idx = pack.search_index(cache)

            def search(q: str, k: int) -> list[dict]:
                before = len(cache)
                hits = idx.search(q, k)
                if cache_path and len(cache) != before:
                    cache_path.write_text(json.dumps(cache), encoding="utf-8")
                return hits
        return ToolSet(self.meta, self.tables(), search)

    # ---- editing
    def validate(self, m: dict | None = None) -> None:
        m = m or self.meta
        t = m["tools"]
        names = set()
        kp = t.get("knowledge_pack")
        if kp is not None and not (isinstance(kp, str) and re.fullmatch(r"pack_[a-z0-9]+", kp)):
            raise AgentError("Invalid knowledge pack id")
        for k in ("calculator", "units", "dates"):
            if not isinstance(t.get(k, False), bool):
                raise AgentError(f"tools.{k} must be true or false")
        if not isinstance(m.get("skills"), list) or not isinstance(t.get("rules", []), list):
            raise AgentError("skills and rules must be lists")
        for tb in t.get("tables", []):
            if not NAME.match(tb["name"]) or tb["key"] not in tb["columns"]:
                raise AgentError(f"Table '{tb['name']}': name must be lower_snake_case and key must be a column")
        for r in t.get("rules", []):
            if not NAME.match(r["name"]):
                raise AgentError(f"Rule name '{r['name']}' must be lower_snake_case")
            ins = {i["name"] for i in r["inputs"]}
            if not ins or any(not NAME.match(i) for i in ins):
                raise AgentError(f"Rule '{r['name']}': inputs need lower_snake_case names")
            if not r["conditions"]:
                raise AgentError(f"Rule '{r['name']}' needs at least one condition")
            for c in r["conditions"]:
                if c["input"] not in ins or c["op"] not in OPS:
                    raise AgentError(f"Rule '{r['name']}': condition on unknown input or operator")
            if r.get("match", "all") not in ("all", "any"):
                raise AgentError("match must be 'all' or 'any'")
        avail = set(ToolSet({**m}, {tb["name"]: self._rows_for(tb["name"]) for tb in t.get("tables", [])},
                            (lambda q, k: []) if t.get("knowledge_pack") else None).names)
        for s in m["skills"]:
            if not NAME.match(s["id"]) or s["id"] in names:
                raise AgentError(f"Skill id '{s['id']}' must be unique lower_snake_case")
            names.add(s["id"])
            missing = [x for x in s["tools"] if x not in avail]
            if not s["tools"] or missing:
                raise AgentError(f"Skill '{s['name']}': choose at least one tool; unknown tools {missing}")
            if not 0 <= float(s.get("not_found", 0)) <= 0.5:
                raise AgentError("not-found share must be between 0 and 0.5")

    def _rows_for(self, name: str) -> list[dict]:
        if not NAME.match(name or ""):
            raise AgentError("Invalid table name")
        p = self.root / "tables" / f"{name}.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []

    def update(self, changes: dict[str, Any]) -> dict:
        m = self.meta
        for k in ("name", "role"):
            if k in changes:
                m[k] = str(changes[k])[:4000]
        if "tools" in changes:
            for k in ("calculator", "units", "dates"):
                if k in changes["tools"]:
                    m["tools"][k] = bool(changes["tools"][k])
            if "rules" in changes["tools"]:
                m["tools"]["rules"] = changes["tools"]["rules"]
            if "knowledge_pack" in changes["tools"]:
                m["tools"]["knowledge_pack"] = changes["tools"]["knowledge_pack"] or None
        if "skills" in changes:
            m["skills"] = changes["skills"]
        if "role" in changes:
            sc = safety.scan_text(m["role"])
            if sc["block"]:
                raise AgentError("The role text contains " + ", ".join(sc["block"]))
        for s in m["skills"]:
            for ex in s.get("examples", []):
                sc = safety.scan_text(json.dumps(ex))
                if sc["block"]:
                    raise AgentError(f"An example in '{s['name']}' contains " + ", ".join(sc["block"]))
        self.validate(m)
        self._stale(m)
        self._save(m)
        return m

    def add_table(self, name: str, description: str, key: str, text: str, filename: str = "") -> dict[str, Any]:
        name = _snake(name)
        if not NAME.match(name):
            raise AgentError("Table name must start with a letter")
        cols, rows = parse_table(text, filename)
        key = _snake(key) if key else cols[0]
        if key not in cols:
            raise AgentError(f"Key column '{key}' not found; columns: {', '.join(cols)}")
        keys = [norm_cell(r.get(key, "")) for r in rows]
        if any(not k for k in keys):
            raise AgentError(f"Every row needs a value in the key column '{key}'")
        dup = len(keys) - len(set(keys))
        scan = safety.scan_rows(cols, rows)
        if scan["block"]:
            raise AgentError("Refused — this looks like personal data: " + "; ".join(scan["block"][:6]) +
                             ". Only synthetic or non-sensitive data is permitted.")
        m = self.meta
        m["tools"]["tables"] = [t for t in m["tools"].get("tables", []) if t["name"] != name]
        (self.root / "tables" / f"{name}.json").write_text(json.dumps(rows), encoding="utf-8")
        m["tools"]["tables"].append({"name": name, "description": description.strip()[:300], "key": key, "columns": cols,
                                     "rows": len(rows), "source": filename or "upload"})
        self._stale(m)
        self._save(m)
        return {"name": name, "columns": cols, "rows": len(rows), "key": key, "duplicate_keys": dup, "warnings": scan["warn"]}

    def remove_table(self, name: str) -> None:
        if not NAME.match(name or ""):
            raise AgentError("Invalid table name")
        m = self.meta
        if not any(t["name"] == name for t in m["tools"].get("tables", [])):
            raise AgentError(f"No table named '{name}'")
        used = [s["name"] for s in m["skills"] if any(t in (f"lookup_{name}", f"find_{name}") for t in s["tools"])]
        if used:
            raise AgentError(f"Table '{name}' is used by skills: {', '.join(used)}")
        m["tools"]["tables"] = [t for t in m["tools"].get("tables", []) if t["name"] != name]
        (self.root / "tables" / f"{name}.json").unlink(missing_ok=True)
        self._stale(m)
        self._save(m)

    # ---- practice tasks
    def snapshot(self, dest: Path) -> "Agent":
        """A frozen copy (spec + tables) for a study: later edits to the agent never break studies built from it."""
        import shutil
        if dest.exists():
            raise AgentError("Snapshot already exists")
        (dest / "tables").mkdir(parents=True)
        m = self.meta
        pack = self.pack()
        m["snapshot_of"] = m["id"]
        m["snapshot_pack_path"] = str(pack.root) if pack else None
        for t in m["tools"].get("tables", []):
            shutil.copy2(self.root / "tables" / f"{t['name']}.json", dest / "tables" / f"{t['name']}.json")
        write_json_atomic(dest / "agent.json", json.dumps(m, indent=2, ensure_ascii=False))
        return Agent(dest)

    def check_can_run(self) -> None:
        m = self.meta
        if not m["skills"]:
            raise AgentError("Add at least one skill first")
        self.validate(m)

    def run_tasks(self, teacher: ChatBackend | None, per_skill: int = 40, seed: int = 7, emit: Callable[[dict], None] = lambda e: None,
                  source: str = "teacher") -> dict:
        """source='teacher': the teacher writes candidates. source='template': the template's built-in generators write them
        (no teacher needed). Either way every candidate passes the same verification."""
        if source not in ("teacher", "template"):
            raise AgentError("source must be 'teacher' or 'template'")
        if source == "teacher" and teacher is None:
            raise AgentError("Choose a teacher model")
        self.check_can_run()
        m = self.meta
        m["steps"]["tasks"] = {"status": "running", "at": utcnow()}
        self._save(m)
        ts = self.toolset()
        tables = self.tables()
        rng = random.Random(f"agent:{seed}")
        accepted: list[dict] = []
        rejected: list[dict] = []
        seen: set[str] = set()

        def add(skill: dict, q: str, calls: list, answer: Any, source: str) -> str | None:
            key = norm_cell(q)
            if key in seen:
                return "duplicate question"
            nf = float(skill.get("not_found", 0)) > 0
            if calls:
                reason, _ = verify_task(ts, skill["tools"], q, calls, answer, nf)
                if reason:
                    return reason
            elif source != "you":
                return "no tool calls"
            seen.add(key)
            accepted.append({"skill": skill["id"], "prompt": q.strip(), "calls": calls, "answer": str(answer).strip(),
                             "source": source, "not_found": answer_norm(answer) == "not_found"})
            return None

        total = sum(per_skill for _ in m["skills"])
        done = 0
        for skill in m["skills"]:
            for ex in skill.get("examples", []):
                reason = add(skill, ex.get("prompt", ""), ex.get("calls") or [], ex.get("answer", ""), "you")
                if reason:
                    rejected.append({"skill": skill["id"], "source": "you", "candidate": ex, "reason": reason})
            want = per_skill
            want_nf = round(want * float(skill.get("not_found", 0)))
            got = got_nf = 0
            attempts = 0
            while got < want and attempts < want * 3:
                attempts += 1
                from forge.engine import guard
                guard.check()
                nf = got_nf < want_nf and (got - got_nf) >= (want - want_nf) or (got_nf < want_nf and rng.random() < 0.3)
                gen = templates.generator(m["template"], skill["id"]) if source == "template" else None
                if source == "template" and gen is None:
                    rejected.append({"skill": skill["id"], "source": "template", "candidate": None,
                                     "reason": "this skill has no built-in generator (use the teacher)"})
                    break
                try:
                    cand = gen(tables, rng, nf) if gen else self._ask(teacher, m, skill, tables, ts, rng, nf, accepted)
                except (ActionError, json.JSONDecodeError, KeyError, TypeError, ValueError, StopIteration, IndexError) as e:
                    rejected.append({"skill": skill["id"], "source": source, "candidate": None, "reason": f"unreadable candidate ({type(e).__name__})"})
                    continue
                reason = add(skill, str(cand.get("question", "")), cand.get("calls"), cand.get("answer", ""), source)
                if reason:
                    rejected.append({"skill": skill["id"], "source": source, "candidate": cand, "reason": reason})
                else:
                    got += 1
                    got_nf += int(accepted[-1]["not_found"])
                done += 1
                emit({"event": "agent_task", "skill": skill["id"], "accepted": got, "target": want, "done": min(done, total),
                      "total": total, "rejected": len(rejected)})
        if not accepted:
            m = self.meta
            m["steps"]["tasks"] = {"status": "failed", "at": utcnow(), "error": "No task passed verification"}
            self._save(m)
            raise AgentError("No task passed verification; see the rejected list for reasons")
        tasks = self._split(accepted, seed)
        (self.root / "tasks.jsonl").write_text("".join(canonical_json(t.to_dict()) + "\n" for t in tasks), encoding="utf-8")
        (self.root / "rejected.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rejected), encoding="utf-8")
        summary = {"accepted": len(tasks), "rejected": len(rejected),
                   "by_skill": {s["id"]: sum(t.family == s["id"] for t in tasks) for s in m["skills"]},
                   "from_you": sum(t.meta["source"] == "you" for t in tasks), "not_found": sum(t.meta["not_found"] for t in tasks),
                   "splits": {sp: sum(t.split == sp for t in tasks) for sp, _ in SPLITS},
                   "config": {"per_skill": per_skill, "seed": seed, "source": source,
                              "teacher": getattr(teacher, "name", "") if teacher else None}}
        m = self.meta
        m["steps"]["tasks"] = {"status": "completed", "at": utcnow(), "summary": summary}
        self._save(m)
        emit({"event": "agent_tasks_done", **{k: summary[k] for k in ("accepted", "rejected")}})
        return summary

    def _ask(self, teacher: ChatBackend, m: dict, skill: dict, tables: dict, ts: ToolSet, rng: random.Random,
             not_found: bool, accepted: list[dict]) -> dict:
        schemas = [s for s in ts.schemas if s["name"] in skill["tools"]]
        data = []
        for name, rows in tables.items():
            if any(t.endswith(f"_{name}") for t in skill["tools"]):
                sample = rng.sample(rows, min(6, len(rows)))
                data.append(f"Table {name} (sample rows):\n" + "\n".join(json.dumps(r, ensure_ascii=False) for r in sample))
        exs = [a for a in accepted if a["skill"] == skill["id"]]
        shots = [e for e in exs if e["source"] == "you"][:3] + rng.sample([e for e in exs if e["source"] != "you"], min(2, len([e for e in exs if e["source"] != "you"])))
        user = (f"Agent role: {m['role'] or '(not specified)'}\nSkill: {skill['name']} — {skill['description']}\n"
                f"Tools the agent may use:\n{json.dumps(schemas, ensure_ascii=False)}\n\n" + ("\n\n".join(data) + "\n\n" if data else "") +
                ("Examples (write something different):\n" + "\n".join(json.dumps({"question": e["prompt"], "calls": e["calls"], "answer": e["answer"]}, ensure_ascii=False) for e in shots) + "\n\n" if shots else "") +
                (f"Write ONE task about an item that is NOT in the data (invent a plausible one). The calls must include the lookup that "
                 f"finds nothing, and the answer must be NOT_FOUND.\n" if not_found else
                 "Write ONE new, realistic task for this skill, answerable with the tools from the data above. Every value you pass to a tool "
                 "must come from the question or from an earlier tool result. The answer must be copied exactly from the last tool result.\n") +
                'Reply as JSON: {"question": "...", "calls": [{"tool": "...", "arguments": {...}}], "answer": "..."}')
        comp = teacher.complete([{"role": "system", "content": "You write precise practice tasks for a tool-using AI agent. Reply with JSON only."},
                                 {"role": "user", "content": user}])
        body, _ = strip_reasoning(comp.text)
        mm = re.search(r"\{.*\}", body, re.S)
        if not mm:
            raise ActionError("invalid_json", "no JSON object in reply")
        return json.loads(mm.group(0))

    @staticmethod
    def _split(acc: list[dict], seed: int) -> list[Task]:
        """Group tasks by their primary entity (first lookup / search value), then split groups 60/20/20 — no primary entity crosses splits."""
        parent = list(range(len(acc)))

        def find(i: int) -> int:
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i
        owner: dict[str, int] = {}
        for i, a in enumerate(acc):
            # The primary entity is the first looked-up / searched value (the item the task is about). Grouping on every
            # value would chain cross-entity tasks (rule × host) into one giant group and starve dev/test.
            first = next((v for c in a["calls"] for k, v in c["arguments"].items() if k in ("key", "value", "query") and isinstance(v, str)), None)
            ents = {norm_cell(first)} if first else {f"task:{norm_cell(a['prompt'])}"}
            for e in ents:
                if e in owner:
                    parent[find(i)] = find(owner[e])
                else:
                    owner[e] = i
        groups: dict[int, list[int]] = {}
        for i in range(len(acc)):
            groups.setdefault(find(i), []).append(i)
        order = sorted(groups.values(), key=lambda g: sha256_text(f"{seed}:" + acc[g[0]]["prompt"]))
        n, cum, split_of = len(acc), 0, {}
        for gi, g in enumerate(order):
            frac = cum / n
            split = "train" if frac < SPLITS[0][1] else ("dev" if frac < SPLITS[0][1] + SPLITS[1][1] else "test")
            for i in g:
                split_of[i] = (split, gi)
            cum += len(g)
        out = []
        counters: dict[str, int] = {}
        for i, a in enumerate(acc):
            counters[a["skill"]] = counters.get(a["skill"], 0) + 1
            split, gi = split_of[i]
            out.append(Task(task_id=f"{a['skill'][:12]}-{counters[a['skill']]:04d}", group_id=f"agent-g{gi:04d}", family=a["skill"],
                            split=split, paraphrase=0, prompt=a["prompt"], reference_calls=a["calls"], reference_answer=a["answer"],
                            meta={"source": a["source"], "not_found": a["not_found"]}))
        return out

    # ---- human review
    @staticmethod
    def review_key(prompt: str) -> str:
        return sha256_text(norm_cell(prompt))[:20]

    def reviews(self) -> dict[str, dict]:
        p = self.root / "reviews.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}

    def review(self, task_id: str, decision: str, reviewer: str, note: str = "", answer: str | None = None,
               question: str | None = None) -> dict:
        """approve | correct | reject | reset. A correction is re-verified by running the task's tool calls again."""
        if decision not in ("approve", "correct", "reject", "reset"):
            raise AgentError("decision must be approve, correct, reject or reset")
        reviewer = " ".join((reviewer or "").split())[:60]
        if not reviewer:
            raise AgentError("Enter your name or initials as the reviewer")
        t = next((x for x in self.tasks() if x["task_id"] == task_id), None)
        if t is None:
            raise AgentError("Unknown task")
        key = self.review_key(t["prompt"])
        revs = self.reviews()
        if decision == "reset":
            revs.pop(key, None)
        else:
            rec: dict[str, Any] = {"status": {"approve": "approved", "correct": "corrected", "reject": "rejected"}[decision],
                                   "reviewer": reviewer, "at": utcnow(), "note": (note or "")[:500], "task_id": task_id}
            if decision == "correct":
                q = (question or t["prompt"]).strip()
                ans = (answer if answer is not None else t["reference_answer"]).strip()
                if q == t["prompt"] and ans == t["reference_answer"]:
                    raise AgentError("Change the question or the answer to record a correction")
                sc = safety.scan_text(q + " " + ans)
                if sc["block"]:
                    raise AgentError("The correction looks like it contains personal data: " + ", ".join(sc["block"]))
                skill = next((x for x in self.meta["skills"] if x["id"] == t["family"]), None)
                if t["reference_calls"]:
                    reason, _ = verify_task(self.toolset(), skill["tools"] if skill else [c["tool"] for c in t["reference_calls"]],
                                            q, t["reference_calls"], ans, bool(skill and float(skill.get("not_found", 0)) > 0) or ans.upper() == "NOT_FOUND")
                    if reason:
                        raise AgentError(f"The correction does not verify against the tools: {reason}")
                rec |= {"question": q, "answer": ans}
            revs[key] = rec
        write_json_atomic(self.root / "reviews.json", json.dumps(revs, indent=2, ensure_ascii=False))
        return self.review_stats()

    def review_stats(self) -> dict[str, int]:
        revs = self.reviews()
        keys = [self.review_key(t["prompt"]) for t in self.tasks()]
        c = {"approved": 0, "corrected": 0, "rejected": 0}
        for k in keys:
            if k in revs:
                c[revs[k]["status"]] += 1
        return c | {"pending": len(keys) - sum(c.values()), "total": len(keys)}

    def tasks_for_study(self, require_review: bool = False) -> list[dict]:
        """Corrections applied, rejected tasks removed; with require_review only approved / corrected tasks are kept.
        Splits are the ones assigned at generation, so entity grouping still holds."""
        revs = self.reviews()
        out = []
        for t in self.tasks():
            r = revs.get(self.review_key(t["prompt"]))
            if r and r["status"] == "rejected":
                continue
            if require_review and not r:
                continue
            if r and r["status"] == "corrected":
                t = {**t, "prompt": r["question"], "reference_answer": r["answer"], "meta": {**t["meta"], "corrected_by": r["reviewer"]}}
            elif r:
                t = {**t, "meta": {**t["meta"], "approved_by": r["reviewer"]}}
            out.append(t)
        return out

    def summary(self) -> dict[str, Any]:
        m = self.meta
        return {**m, "path": str(self.root), "hashes": self.hashes(),
                "tool_names": self.toolset_names(), "counts": {"tasks": len(self.tasks()), "rejected": len(self.rejected())}, "review": self.review_stats()}

    def toolset_names(self) -> list[dict[str, str]]:
        try:
            ts = ToolSet(self.meta, self.tables(), (lambda q, k: []) if self.meta["tools"].get("knowledge_pack") else None)
            return [{"name": s["name"], "description": s["description"], "parameters": s["parameters"]} for s in ts.schemas]
        except Exception:  # broken table file etc. — surfaced by validate() on the next edit
            return []
