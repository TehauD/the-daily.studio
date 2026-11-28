"""Agent Studio API: purpose-built agents (role, tools over your data, skills), a tool console, and practice tasks."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from forge.agents.agent import Agent, AgentError
from forge.agents.templates import TEMPLATES, catalogue
from forge.agents.tools import OPS, UNIT_NAMES
from forge.api.state import AppState, get_state
from forge.jobs.runner import JobError
from forge.registry.registry import RegistryError

router = APIRouter(prefix="/api/agents", tags=["agents"])


def _base(st: AppState) -> Path:
    d = st.settings.home / "agents"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _agent(st: AppState, aid: str) -> Agent:
    if not aid.startswith("agent_") or not aid[6:].isalnum():
        raise HTTPException(422, "Invalid agent id")
    try:
        return Agent(_base(st) / aid)
    except AgentError as e:
        raise HTTPException(404, str(e))


def _short(a: Agent) -> dict[str, Any]:
    m = a.meta
    return {"id": m["id"], "name": m["name"], "template": m["template"], "created_at": m["created_at"],
            "skills": [{"id": s["id"], "name": s["name"]} for s in m["skills"]], "tables": [t["name"] for t in m["tools"].get("tables", [])],
            "tasks": m["steps"]["tasks"].get("status"), "summary": m["steps"]["tasks"].get("summary")}


@router.get("")
def list_agents(st: AppState = Depends(get_state)):
    out = []
    for d in sorted(_base(st).iterdir(), reverse=True):
        try:
            out.append(_short(Agent(d)))
        except (AgentError, KeyError, json.JSONDecodeError):
            continue
    return out


@router.get("/templates")
def templates():
    return {"templates": catalogue(), "operators": list(OPS), "units": UNIT_NAMES}


class CreateAgent(BaseModel):
    name: str = Field("", max_length=80)
    template: str = "blank"
    no_sensitive_data: bool


@router.post("")
def create_agent(body: CreateAgent, st: AppState = Depends(get_state)):
    try:
        return Agent.create(_base(st), body.name, body.template, body.no_sensitive_data).summary()
    except AgentError as e:
        raise HTTPException(422, str(e))


@router.get("/{aid}")
def get_agent(aid: str, st: AppState = Depends(get_state)):
    a = _agent(st, aid)
    return {**a.summary(), "jobs": st.jobs.list(10, study_id=aid)}


@router.get("/{aid}/coverage")
def agent_coverage(aid: str, st: AppState = Depends(get_state)):
    from forge.agents.coverage import coverage
    return coverage(_agent(st, aid))


@router.get("/boundary/categories")
def boundary_categories():
    from forge.agents.boundary import CATEGORIES, HANDOFF_LINE
    return {"categories": {k: {"label": v["label"], "why": v["why"], "example": v["phrases"][0].format(e="<record>")} for k, v in CATEGORIES.items()},
            "instruction": HANDOFF_LINE}


class UpdateAgent(BaseModel):
    name: str | None = Field(None, max_length=80)
    role: str | None = Field(None, max_length=4000)
    tools: dict[str, Any] | None = None
    skills: list[dict[str, Any]] | None = Field(None, max_length=30)
    boundary: dict[str, Any] | None = None


@router.put("/{aid}")
def update_agent(aid: str, body: UpdateAgent, st: AppState = Depends(get_state)):
    a = _agent(st, aid)
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    pid = (changes.get("tools") or {}).get("knowledge_pack")
    if pid and (not isinstance(pid, str) or not re.fullmatch(r"pack_[a-z0-9]+", pid)):
        raise HTTPException(422, "Invalid knowledge pack id")
    if pid and not (st.settings.home / "knowledge" / pid / "pack.json").exists():
        raise HTTPException(404, f"Knowledge pack {pid} not found")
    try:
        a.update(changes)
    except (AgentError, KeyError, TypeError, ValueError) as e:
        raise HTTPException(422, f"{e}" if isinstance(e, AgentError) else f"Invalid agent definition ({type(e).__name__}: {e})")
    return a.summary()


class TableBody(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    description: str = Field("", max_length=300)
    key: str = Field("", max_length=60)
    filename: str = Field("", max_length=200)
    content: str = Field(min_length=1, max_length=5_000_000)


@router.post("/{aid}/tables")
def add_table(aid: str, body: TableBody, st: AppState = Depends(get_state)):
    a = _agent(st, aid)
    try:
        return a.add_table(body.name, body.description, body.key, body.content, body.filename)
    except AgentError as e:
        raise HTTPException(422, str(e))


def _csv(rows: list[dict], filename: str):
    import csv as _csv_mod
    import io

    from fastapi.responses import Response
    buf = io.StringIO()
    cols = list(dict.fromkeys(k for r in rows for k in r))
    w = _csv_mod.DictWriter(buf, fieldnames=cols, lineterminator="\n")
    w.writeheader()
    for r in rows:  # neutralise spreadsheet formulas (CSV injection) — a leading quote keeps the text as text
        w.writerow({k: (f"'{v}" if isinstance(v, str) and v[:1] in ("=", "+", "-", "@") else v) for k, v in r.items()})
    return Response("\ufeff" + buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/{aid}/tables/{name}/csv")
def table_csv(aid: str, name: str, st: AppState = Depends(get_state)):
    """Download a table as CSV — also the template for loading your own data in the same shape."""
    a = _agent(st, aid)
    if name not in {t["name"] for t in a.meta["tools"].get("tables", [])}:
        raise HTTPException(404, "Unknown table")
    return _csv(a._rows_for(name), f"{name}.csv")


@router.get("/templates/{tid}/tables/{name}/csv")
def template_table_csv(tid: str, name: str):
    """A template's synthetic table as CSV, before creating an agent: the shape to fill with your own data."""
    if tid not in TEMPLATES or not re.fullmatch(r"[a-z][a-z0-9_]{0,40}", name):
        raise HTTPException(404, "Unknown template or table")
    t = next((x for x in TEMPLATES[tid]["tables"] if x["name"] == name), None)
    if not t:
        raise HTTPException(404, "Unknown table")
    return _csv(t["rows"](), f"{tid}-{name}.csv")


@router.delete("/{aid}/tables/{name}")
def remove_table(aid: str, name: str, st: AppState = Depends(get_state)):
    a = _agent(st, aid)
    try:
        a.remove_table(name)
    except AgentError as e:
        raise HTTPException(409, str(e))
    return {"ok": True}


@router.get("/{aid}/tables/{name}")
def table_rows(aid: str, name: str, offset: int = 0, limit: int = 50, st: AppState = Depends(get_state)):
    rows = _agent(st, aid).tables().get(name)
    if rows is None:
        raise HTTPException(404, "No such table")
    return {"total": len(rows), "rows": rows[max(0, offset): max(0, offset) + min(limit, 200)]}


class TryBody(BaseModel):
    tool: str = Field(min_length=1, max_length=80)
    arguments: dict[str, Any] = Field(default_factory=dict)


@router.post("/{aid}/try")
def try_tool(aid: str, body: TryBody, st: AppState = Depends(get_state)):
    """Run one tool exactly as the agent would (read-only)."""
    a = _agent(st, aid)
    try:
        res, err = a.toolset().call(body.tool, body.arguments)
    except AgentError as e:
        raise HTTPException(409, str(e))
    return {"result": res, "error": err}


class TasksBody(BaseModel):
    source: Literal["teacher", "template"] = "teacher"
    teacher_id: str | None = None
    per_skill: int = Field(40, ge=2, le=500)
    seed: int = 7


@router.post("/{aid}/steps/tasks")
def run_tasks(aid: str, body: TasksBody, st: AppState = Depends(get_state)):
    from forge.api.routes_studies import _teacher_spec
    a = _agent(st, aid)
    try:
        a.check_can_run()
    except AgentError as e:
        raise HTTPException(409, str(e))
    cfg: dict[str, Any] = {"per_skill": body.per_skill, "seed": body.seed, "source": body.source}
    if body.source == "teacher":
        if not body.teacher_id:
            raise HTTPException(422, "Choose a teacher model")
        try:
            t = _teacher_spec(st, st.registry.get(body.teacher_id))
        except RegistryError as e:
            raise HTTPException(404, str(e))
        cfg |= {"endpoint": t["endpoint"], "model": t["model"]}
    elif not any(s.get("generator") for s in a.meta["skills"]):
        raise HTTPException(409, "None of this agent's skills has a built-in generator; use the teacher")
    try:
        # Teacher-written tasks drive the teacher on the GPU (exclusive); template generators are pure Python.
        return st.jobs.start("agent:tasks", ["agent", "--agent", str(a.root), "--step", "tasks", "--config", json.dumps(cfg)],
                             gpu=body.source == "teacher", study_id=aid, label=f"{a.meta['name']} · practice tasks ({body.source})")
    except JobError as e:
        raise HTTPException(409, str(e))


class ReviewBody(BaseModel):
    task_id: str = Field(min_length=1, max_length=80)
    decision: Literal["approve", "correct", "reject", "reset"]
    reviewer: str = Field(min_length=1, max_length=60)
    note: str = Field("", max_length=500)
    answer: str | None = Field(None, max_length=500)
    question: str | None = Field(None, max_length=500)


@router.post("/{aid}/review")
def review(aid: str, body: ReviewBody, st: AppState = Depends(get_state)):
    """Human review of a practice task. Corrections are re-verified against the tools."""
    a = _agent(st, aid)
    try:
        return a.review(body.task_id, body.decision, body.reviewer, body.note, body.answer, body.question)
    except AgentError as e:
        raise HTTPException(422, str(e))


@router.get("/{aid}/tasks")
def tasks(aid: str, split: Literal["all", "train", "dev", "test"] = "all", st: AppState = Depends(get_state)):
    a = _agent(st, aid)
    revs = a.reviews()
    rows = [t | {"review": revs.get(Agent.review_key(t["prompt"]))} for t in a.tasks() if split == "all" or t["split"] == split]
    return {"tasks": rows, "rejected": a.rejected(), "review": a.review_stats()}
