from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from forge.api.state import AppState, get_state
from forge.hardware.probe import query_gpus
from forge.hardware.profiles import EstimateInput, estimate_lora_memory
from forge.registry.capabilities import CAPABILITIES
from forge.registry.discovery import build_providers, hardware_context, run_discovery
from forge.registry.registry import RegistryError

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
def list_models(provider: str | None = None, include_missing: bool = True, st: AppState = Depends(get_state)):
    return {"capabilities": CAPABILITIES, "models": st.registry.list(provider, include_missing)}


@router.post("/purge-missing")
def purge_missing(st: AppState = Depends(get_state)):
    return {"purged": st.registry.purge_missing()}


@router.post("/discover")
async def discover(st: AppState = Depends(get_state)):
    if st.discovery_running:
        raise HTTPException(409, "Discovery already in progress")
    st.discovery_running = True
    try:
        hw = await asyncio.to_thread(hardware_context)
        return await run_discovery(st.db, build_providers(st.settings, st.db), hw)  # effective (overridden) settings
    finally:
        st.discovery_running = False


@router.get("/discovery-runs")
def discovery_runs(limit: int = 10, st: AppState = Depends(get_state)):
    import json
    rows = st.db.query("SELECT * FROM discovery_runs ORDER BY started_at DESC LIMIT ?", (min(limit, 100),))
    for r in rows:
        r["results"] = json.loads(r["results"])
    return rows


@router.get("/pair-check")
def pair_check(teacher: str, student: str, st: AppState = Depends(get_state)):
    try:
        return st.registry.pair_check(teacher, student)
    except RegistryError as e:
        raise HTTPException(404, str(e))


@router.get("/{model_id}")
def get_model(model_id: str, st: AppState = Depends(get_state)):
    try:
        return st.registry.get(model_id)
    except RegistryError as e:
        raise HTTPException(404, str(e))


@router.get("/{model_id}/fit")
async def fit(model_id: str, seq_len: int = 2048, st: AppState = Depends(get_state)):
    try:
        m = st.registry.get(model_id)
    except RegistryError as e:
        raise HTTPException(404, str(e))
    if not m["parameter_count"]:
        return {"available": False, "reason": "Parameter count unknown"}
    gpus = await asyncio.to_thread(query_gpus)
    free = max((g.vram_free_mb or 0 for g in gpus), default=None) or None
    md = m["metadata"]
    out = {}
    for method, quant in (("lora", "bf16"), ("qlora", "nf4")):
        if m["capabilities"].get(method, {}).get("status") == "unsupported":
            out[method] = {"verdict": "not_applicable", "reason": m["capabilities"][method]["reason"]}
            continue
        est = estimate_lora_memory(EstimateInput(params_b=m["parameter_count"] / 1e9, quant=quant, seq_len=seq_len,
                                                 hidden=md.get("hidden_size"), layers=md.get("num_hidden_layers"),
                                                 intermediate=md.get("intermediate_size"), vocab=md.get("vocab_size"),
                                                 num_heads=md.get("num_attention_heads"), num_kv_heads=md.get("num_key_value_heads"),
                                                 head_dim=md.get("head_dim")), free)
        out[method] = est.to_dict()
    return {"available": True, "seq_len": seq_len, "free_vram_mb": free, "estimates": out}


class RoleBody(BaseModel):
    role: Literal["teacher", "student"]


@router.put("/{model_id}/roles")
def add_role(model_id: str, body: RoleBody, st: AppState = Depends(get_state)):
    try:
        return st.registry.assign_role(model_id, body.role)
    except RegistryError as e:
        raise HTTPException(422, str(e))


@router.delete("/{model_id}/roles/{role}")
def remove_role(model_id: str, role: Literal["teacher", "student"], st: AppState = Depends(get_state)):
    try:
        return st.registry.remove_role(model_id, role)
    except RegistryError as e:
        raise HTTPException(404, str(e))
