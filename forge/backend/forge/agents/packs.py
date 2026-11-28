"""Task packs: share a use case as data, not code.

A task pack is a zip holding one agent definition — role, read-only tools (tables, rules, calculator …), skills with examples —
its synthetic tables and, optionally, its verified practice tasks. It contains NO executable code: FORGE's own tool engine runs
the tools, so importing a pack cannot run anything its author wrote.

    pack.json        format, id, name, version, domain, description, author, licence, intended use, synthetic attestation,
                     FORGE version, sha256 of every file
    agent.json       the agent spec (as Agent Studio stores it; step status and attestation are reset on import)
    tables/*.json    rows (synthetic)
    tasks.jsonl      optional: practice tasks with their splits

On import FORGE: checks the format, sizes and every hash; refuses paths outside the pack; scans every table and task for
personal identifiers (any hit refuses the pack — synthetic data only); validates the spec; and RE-VERIFIES every included task
by re-running its tool calls against the tables — a task whose recorded answer does not follow from the tools is dropped and
listed. Splits are kept as the author assigned them (entity grouping is the author's responsibility, and is re-checked: a
task group may not span splits).
"""
from __future__ import annotations

import hashlib
import json
import re
import zipfile
from pathlib import Path
from typing import Any

from forge import __version__
from forge.agents import safety
from forge.agents.agent import Agent, AgentError
from forge.agents.tools import NAME, ToolSet
from forge.agents.verify import answer_norm, verify_task
from forge.util import canonical_json, new_id, utcnow, write_json_atomic

FORMAT = "forge-task-pack-1"
MAX_FILES, MAX_BYTES, MAX_TASKS = 64, 30_000_000, 20000
ID = re.compile(r"^[a-z0-9][a-z0-9_.-]{1,63}$")


class PackError(ValueError):
    pass


def export(agent: Agent, out_dir: Path, meta: dict[str, Any], include_tasks: bool = True) -> dict[str, Any]:
    m = agent.meta
    pid = meta.get("id") or re.sub(r"[^a-z0-9_]+", "_", m["name"].lower()).strip("_")[:40] or "pack"
    if not ID.match(pid):
        raise PackError("Pack id: lower case letters, digits, '_', '-', '.' (2–64 characters)")
    if not (m.get("attestation") or {}).get("no_sensitive_data"):
        raise PackError("Only agents attested as containing no sensitive data can be packed")
    spec = {k: m[k] for k in ("name", "role", "tools", "skills") if k in m} | ({"boundary": m["boundary"]} if m.get("boundary") else {})
    if spec["tools"].get("knowledge_pack"):
        raise PackError("Agents linked to a knowledge pack cannot be packed yet (the documents are not part of a task pack)")
    files: dict[str, bytes] = {"agent.json": json.dumps(spec, indent=2, ensure_ascii=False).encode()}
    for t in m["tools"].get("tables", []):
        files[f"tables/{t['name']}.json"] = (agent.root / "tables" / f"{t['name']}.json").read_bytes()
    tasks = agent.tasks_for_study(False) if include_tasks else []
    if tasks:
        files["tasks.jsonl"] = "".join(canonical_json(t) + "\n" for t in tasks).encode()
    info = {"format": FORMAT, "id": pid, "name": meta.get("name") or m["name"], "version": meta.get("version") or "1.0.0",
            "domain": meta.get("domain") or (m.get("template") or "custom"), "description": (meta.get("description") or "")[:2000],
            "author": (meta.get("author") or "")[:200], "licence": (meta.get("licence") or "")[:200],
            "intended_use": (meta.get("intended_use") or "Synthetic practice tasks for distillation research. Not for clinical or production decisions.")[:1000],
            "synthetic": True, "made_with": f"FORGE {__version__}", "made_at": utcnow(), "tasks": len(tasks),
            "skills": [s["id"] for s in m["skills"]], "files": {k: hashlib.sha256(v).hexdigest() for k, v in files.items()}}
    out_dir.mkdir(parents=True, exist_ok=True)
    zp = out_dir / f"{pid}-{info['version']}.forgepack.zip"
    with zipfile.ZipFile(zp, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for k, v in files.items():
            z.writestr(k, v)
        z.writestr("pack.json", json.dumps(info, indent=2, ensure_ascii=False))
    return {"path": str(zp), "bytes": zp.stat().st_size, "pack": {k: v for k, v in info.items() if k != "files"}}


def _read(zp: Path) -> tuple[dict[str, Any], dict[str, bytes]]:
    if zp.stat().st_size > MAX_BYTES:
        raise PackError("Pack is larger than 30 MB")
    with zipfile.ZipFile(zp) as z:
        infos = z.infolist()
        if len(infos) > MAX_FILES or sum(i.file_size for i in infos) > MAX_BYTES * 4:
            raise PackError("Too many files or too much data in the pack")
        names = [i.filename for i in infos]
        for n in names:
            if n.startswith("/") or ".." in Path(n).parts or "\\" in n:
                raise PackError(f"Unsafe path in pack: {n}")
            if not (n in ("pack.json", "agent.json", "tasks.jsonl") or re.fullmatch(r"tables/[a-z][a-z0-9_]{0,40}\.json", n)):
                raise PackError(f"Unexpected file in pack: {n} (packs carry data only)")
        if "pack.json" not in names or "agent.json" not in names:
            raise PackError("Not a FORGE task pack (pack.json / agent.json missing)")
        info = json.loads(z.read("pack.json"))
        files = {n: z.read(n) for n in names if n != "pack.json"}
    if info.get("format") != FORMAT:
        raise PackError(f"Unknown pack format {info.get('format')!r}")
    if not ID.match(str(info.get("id", ""))) or not info.get("synthetic"):
        raise PackError("Pack id invalid, or the pack does not declare synthetic data")
    bad = [n for n, h in (info.get("files") or {}).items() if n not in files or hashlib.sha256(files[n]).hexdigest() != h]
    unlisted = [n for n in files if n not in (info.get("files") or {})]
    if bad or unlisted:
        raise PackError(f"Pack integrity check failed: changed {bad[:5]} unlisted {unlisted[:5]}")
    return info, files


def inspect(zip_path: str | Path) -> dict[str, Any]:
    info, files = _read(Path(zip_path))
    spec = json.loads(files["agent.json"])
    return {"pack": {k: v for k, v in info.items() if k != "files"}, "tables": [t["name"] for t in spec["tools"].get("tables", [])],
            "skills": [{"id": s["id"], "name": s.get("name")} for s in spec.get("skills", [])], "files": len(files)}


def install(base: Path, zip_path: str | Path, no_sensitive_data: bool, name: str | None = None) -> dict[str, Any]:
    if not no_sensitive_data:
        raise PackError("Confirm the pack contains no patient, personal or confidential information")
    info, files = _read(Path(zip_path))
    spec = json.loads(files["agent.json"])
    tables = spec.get("tools", {}).get("tables", [])
    rows: dict[str, list[dict]] = {}
    block: list[str] = []
    for t in tables:
        if not NAME.match(t.get("name", "")):
            raise PackError(f"Invalid table name {t.get('name')!r}")
        raw = files.get(f"tables/{t['name']}.json")
        if raw is None:
            raise PackError(f"Table file for '{t['name']}' missing")
        rows[t["name"]] = json.loads(raw)
        block += [f"{t['name']}: {x}" for x in safety.scan_rows(t["columns"], rows[t["name"]])["block"]]
    tasks = [json.loads(x) for x in files.get("tasks.jsonl", b"").decode("utf-8").splitlines() if x.strip()]
    if len(tasks) > MAX_TASKS:
        raise PackError(f"More than {MAX_TASKS} tasks")
    for t in tasks:
        block += [f"task {t.get('task_id')}: {x}" for x in safety.scan_text(str(t.get("prompt", "")))["block"]]
    if block:
        raise PackError("Refused — possible personal identifiers: " + "; ".join(block[:8]))
    aid = new_id("agent")
    root = base / aid
    (root / "tables").mkdir(parents=True)
    for n, r in rows.items():
        (root / "tables" / f"{n}.json").write_text(json.dumps(r), encoding="utf-8")
    m = {"id": aid, "name": (name or info["name"]).strip()[:80], "template": f"pack:{info['id']}", "created_at": utcnow(),
         "attestation": {"no_sensitive_data": True, "at": utcnow()}, "role": spec["role"], "tools": spec["tools"], "skills": spec["skills"],
         "steps": {"tasks": {"status": None}}, "from_pack": {k: info.get(k) for k in ("id", "name", "version", "domain", "author", "licence", "intended_use", "made_with")}}
    if spec.get("boundary"):
        m["boundary"] = spec["boundary"]
    agent = Agent.__new__(Agent)
    agent.root = root
    agent._save(m)
    try:
        agent.validate()
    except AgentError as e:
        import shutil
        shutil.rmtree(root, ignore_errors=True)
        raise PackError(f"Pack spec is not valid: {e}") from e
    kept, dropped = _reverify(agent, tasks)
    if kept:
        (root / "tasks.jsonl").write_text("".join(canonical_json(t) + "\n" for t in kept), encoding="utf-8")
        (root / "rejected.jsonl").write_text("".join(json.dumps(d, ensure_ascii=False) + "\n" for d in dropped), encoding="utf-8")
        m = agent.meta
        m["steps"]["tasks"] = {"status": "completed", "at": utcnow(), "summary": {
            "accepted": len(kept), "rejected": len(dropped), "by_skill": {s["id"]: sum(t["family"] == s["id"] for t in kept) for s in m["skills"]},
            "splits": {sp: sum(t["split"] == sp for t in kept) for sp in ("train", "dev", "test")},
            "config": {"source": f"task pack {info['id']} {info.get('version')}", "reverified": True}}}
        agent._save(m)
    return {"agent_id": aid, "pack": {k: v for k, v in info.items() if k != "files"}, "tasks_included": len(tasks),
            "tasks_verified": len(kept), "tasks_dropped": dropped[:50], "dropped_total": len(dropped)}


def _reverify(agent: Agent, tasks: list[dict]) -> tuple[list[dict], list[dict]]:
    m = agent.meta
    ts = ToolSet(m, agent.tables(), None)
    skills = {s["id"]: s for s in m["skills"]}
    kept, dropped = [], []
    group_split: dict[str, str] = {}
    for t in tasks:
        g, sp = t.get("group_id"), t.get("split")
        if sp not in ("train", "dev", "test") or not g:
            dropped.append({"task_id": t.get("task_id"), "reason": "missing group or split"})
            continue
        if group_split.setdefault(g, sp) != sp:
            dropped.append({"task_id": t.get("task_id"), "reason": f"group {g} spans splits (leak)"})
            continue
        fam = t.get("family")
        if fam == "boundary":
            if answer_norm(t.get("reference_answer")) == answer_norm("HANDOFF") and not t.get("reference_calls"):
                kept.append(t)
            else:
                dropped.append({"task_id": t.get("task_id"), "reason": "boundary task must hand off with no tool calls"})
            continue
        sk = skills.get(fam)
        if not sk:
            dropped.append({"task_id": t.get("task_id"), "reason": f"unknown skill {fam!r}"})
            continue
        reason, _ = verify_task(ts, sk["tools"], t.get("prompt", ""), t.get("reference_calls"), t.get("reference_answer"),
                                float(sk.get("not_found", 0)) > 0)
        if reason:
            dropped.append({"task_id": t.get("task_id"), "reason": reason})
        else:
            kept.append(t)
    return kept, dropped
