"""Azure OpenAI assistant API. Every route except /status and /config answers 409 until the integration is configured,
enabled, and its key variable is set. Content (real text) is only sent with an approval hash from /preview."""
from __future__ import annotations

import asyncio
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from forge.api.state import AppState, get_state
from forge.assistant import context as ctx
from forge.assistant.azure import AzureClient, AzureConfig, AzureError, load_config
from forge.assistant.service import PROMPTS, AssistantError, Ledger, build_messages, payload_hash

router = APIRouter(prefix="/api/assistant", tags=["assistant"])
TRANSPORT: httpx.BaseTransport | None = None  # injectable for tests
SETTING = "azure_openai"
Scope = Literal["general", "study", "agent", "pack"]


def _cfg(st: AppState) -> AzureConfig:
    return load_config(st.db.get_setting(SETTING))


def _require(st: AppState) -> AzureConfig:
    cfg = _cfg(st)
    if not cfg.available:
        raise HTTPException(409, "The AI assistant is not configured (System Settings → Integrations → Azure OpenAI)")
    return cfg


@router.get("/status")
def status(st: AppState = Depends(get_state)):
    cfg = _cfg(st)
    return {"available": cfg.available, "configured": bool(cfg.endpoint), "deployment": cfg.deployment if cfg.available else None,
            "policy": "summaries are sent when you ask; real text (tasks, examples, rows, passages, episodes) only after you approve the exact payload"}


@router.get("/config")
def get_config(st: AppState = Depends(get_state)):
    return _cfg(st).public()


class ConfigBody(BaseModel):
    endpoint: str = Field("", max_length=300)
    deployment: str = Field("", max_length=64)
    api_version: str = Field("2024-10-21", max_length=24)
    key_env: str = Field("AZURE_OPENAI_API_KEY", max_length=64)
    enabled: bool = False
    use_system_proxy: bool = False


@router.put("/config")
def put_config(body: ConfigBody, st: AppState = Depends(get_state)):
    if not body.endpoint:  # clear → integration hidden again
        st.db.set_setting(SETTING, None)
        return _cfg(st).public()
    cfg = AzureConfig(**body.model_dump(), source="settings")
    try:
        cfg.validate()
    except AzureError as e:
        raise HTTPException(e.status, str(e))
    st.db.set_setting(SETTING, {k: v for k, v in cfg.public().items() if k in ConfigBody.model_fields})
    return _cfg(st).public()


@router.post("/test")
async def test(st: AppState = Depends(get_state)):
    """Sends one fixed sentence (no FORGE data) to confirm endpoint, deployment and key."""
    cfg = _require(st)
    try:
        res = await asyncio.to_thread(AzureClient(cfg, TRANSPORT).chat, [{"role": "user", "content": "Reply with the single word: ready"}], 20)
    except AzureError as e:
        raise HTTPException(e.status, str(e))
    return {"ok": True, "reply": res["text"][:80], "model": res.get("model"), "latency_ms": res["latency_ms"]}


@router.get("/prompts")
def prompts(scope: Scope = "general"):
    return {"prompts": PROMPTS.get(scope, [])}


class AskBody(BaseModel):
    scope: Scope = "general"
    id: str | None = Field(None, max_length=60)
    question: str = Field(min_length=1, max_length=4000)
    include_content: bool = False
    history: list[dict[str, Any]] = Field(default_factory=list, max_length=12)
    approved_sha256: str | None = Field(None, pattern=r"^[0-9a-f]{64}$")


async def _context(body: AskBody, st: AppState) -> tuple[dict, dict, list[str]]:
    if body.scope == "general":
        from forge.api.routes_system import get_readiness
        try:
            rd = await get_readiness(st)
        except Exception:  # readiness probing must never block the assistant
            rd = None
        return ctx.general_context(st, rd)
    if not body.id:
        raise HTTPException(422, f"Choose a {body.scope} first")
    if body.scope == "study":
        from forge.api.routes_studies import _study
        return await asyncio.to_thread(ctx.study_context, _study(st, body.id))
    if body.scope == "agent":
        from forge.api.routes_agents import _agent
        return await asyncio.to_thread(ctx.agent_context, _agent(st, body.id))
    from forge.api.routes_knowledge import _pack
    return await asyncio.to_thread(ctx.pack_context, _pack(st, body.id))


async def _messages(body: AskBody, st: AppState) -> tuple[list[dict], list[str], list[str]]:
    summary, content, items = await _context(body, st)
    try:
        msgs = build_messages(summary, content if body.include_content else None, body.question, body.history)
    except AssistantError as e:
        raise HTTPException(e.status, str(e))
    return msgs, (items if body.include_content else []), items


@router.post("/preview")
async def preview(body: AskBody, st: AppState = Depends(get_state)):
    """Exactly what would be sent, and its hash. Nothing leaves the machine."""
    _require(st)
    msgs, items, all_items = await _messages(body, st)
    return {"messages": msgs, "sha256": payload_hash(msgs), "bytes": ctx.size_of(msgs), "includes_content": body.include_content,
            "content_items": items, "content_available": all_items}


@router.post("/ask")
async def ask(body: AskBody, st: AppState = Depends(get_state)):
    cfg = _require(st)
    msgs, items, _ = await _messages(body, st)
    h = payload_hash(msgs)
    if body.include_content and body.approved_sha256 != h:
        raise HTTPException(428 if not body.approved_sha256 else 409,
                            "Approve the exact payload first" if not body.approved_sha256 else "The data changed since you reviewed it; review again")
    ledger = Ledger(st.settings.home)
    try:
        res = await asyncio.to_thread(AzureClient(cfg, TRANSPORT).chat, msgs)
    except AzureError as e:
        ledger.record(body.scope, body.id, msgs, body.include_content, cfg.deployment, None, str(e), body.question)
        raise HTTPException(e.status, str(e))
    ledger.record(body.scope, body.id, msgs, body.include_content, cfg.deployment, res, None, body.question)
    return {"answer": res["text"], "finish_reason": res["finish_reason"], "usage": res["usage"], "latency_ms": res["latency_ms"],
            "sent": {"sha256": h, "bytes": ctx.size_of(msgs), "included_content": body.include_content, "content_items": items}}


@router.get("/history")
def history(scope: Scope = "general", id: str | None = None, st: AppState = Depends(get_state)):
    return {"history": Ledger(st.settings.home).history(scope, id)}


@router.get("/audit")
def audit(st: AppState = Depends(get_state)):
    return {"audit": Ledger(st.settings.home).audit()}
