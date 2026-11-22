"""Agent Studio API: purpose-built agents (role, tools over your data, skills), a tool console, and practice tasks."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from forge.agents.agent import Agent, AgentError
from forge.agents.templates import TEMPLATES
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
    return {"templates": [{"id": k, "title": v["title"], "description": v["description"]} for k, v in TEMPLATES.items()],
            "operators": list(OPS), "units": UNIT_NAMES}


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


class UpdateAgent(BaseModel):
    name: str | None = Field(None, max_length=80)
    role: str | None = Field(None, max_length=4000)
    tools: dict[str, Any] | None = None
    skills: list[dict[str, Any]] | None = Field(None, max_length=30)


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
    teacher_id: str
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
    try:
        t = _teacher_spec(st, st.registry.get(body.teacher_id))
    except RegistryError as e:
        raise HTTPException(404, str(e))
    cfg = {"endpoint": t["endpoint"], "model": t["model"], "per_skill": body.per_skill, "seed": body.seed}
    try:
        return st.jobs.start("agent:tasks", ["agent", "--agent", str(a.root), "--step", "tasks", "--config", json.dumps(cfg)],
                             gpu=True, study_id=aid, label=f"{a.meta['name']} · practice tasks")
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("/{aid}/tasks")
def tasks(aid: str, split: Literal["all", "train", "dev", "test"] = "all", st: AppState = Depends(get_state)):
    a = _agent(st, aid)
    rows = [t for t in a.tasks() if split == "all" or t["split"] == split]
    return {"tasks": rows, "rejected": a.rejected()}
