from __future__ import annotations

import asyncio
import dataclasses
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from forge import SCHEMA_VERSION, __version__
from forge.api.state import AppState, get_state
from forge.hardware.probe import collect_hardware, probe_torch, query_gpus
from forge.readiness import readiness, teacher_endpoint_status
from forge.hardware.profiles import EstimateInput, adaptive_profiles, estimate_lora_memory, lora_param_count

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/health")
def health(st: AppState = Depends(get_state)):
    return {"status": "ok", "version": __version__, "schema_version": st.db.schema_version,
            "expected_schema": SCHEMA_VERSION, "home": str(st.settings.home), "bind": f"{st.settings.host}:{st.settings.port}"}


@router.get("/session")
def session(st: AppState = Depends(get_state)):
    """Token for mutating requests. Readable only by same-origin pages (Host allowlist + CORS)."""
    return {"token": st.token, "header": "X-Forge-Token"}


@router.get("/hardware")
async def hardware(refresh: bool = False, st: AppState = Depends(get_state)):
    if refresh:
        probe_torch.cache_clear()
    report = await asyncio.to_thread(collect_hardware, [st.settings.home, st.settings.hf_hub_cache])
    return report.to_dict()


@router.get("/readiness")
async def get_readiness(st: AppState = Depends(get_state)):
    hw = await asyncio.to_thread(collect_hardware, [st.settings.home, st.settings.hf_hub_cache])
    teacher = await asyncio.to_thread(teacher_endpoint_status, st.settings.lmstudio_url)
    roles: dict[str, list[str]] = {"teacher": [], "student": []}
    for m in st.registry.list():
        for r in m["roles"]:
            roles[r].append(m["name"])
    return readiness(hw, teacher, st.settings.home, roles, st.settings.port)


@router.get("/telemetry")
async def telemetry(since: float = 0.0, st: AppState = Depends(get_state)):
    # async on purpose: the sampler must be scheduled on the running event loop (see TelemetrySampler.touch).
    return await st.telemetry.snapshot(since)


def _vram() -> tuple[float | None, float | None]:
    gpus = query_gpus()
    if not gpus:
        return None, None
    g = max(gpus, key=lambda x: x.vram_total_mb or 0)  # single-GPU target: use the largest device
    return g.vram_free_mb, g.vram_total_mb


@router.get("/profiles")
async def profiles():
    free, total = await asyncio.to_thread(_vram)
    return adaptive_profiles(free, total)


class EstimateRequest(BaseModel):
    params_b: float = Field(gt=0, le=1000)
    quant: Literal["bf16", "int8", "nf4"] = "nf4"
    lora_rank: int = Field(16, ge=1, le=1024)
    target_all_linear: bool = True
    seq_len: int = Field(2048, ge=64, le=262144)
    micro_batch: int = Field(1, ge=1, le=256)
    grad_checkpointing: bool = True
    hidden: int | None = None
    layers: int | None = None
    intermediate: int | None = None
    vocab: int | None = None
    num_heads: int | None = None
    num_kv_heads: int | None = None
    head_dim: int | None = None
    available_vram_mb: float | None = Field(None, description="Override; defaults to measured free VRAM")


@router.post("/estimate")
async def estimate(req: EstimateRequest):
    free, total = await asyncio.to_thread(_vram)
    budget = req.available_vram_mb if req.available_vram_mb is not None else free
    data = req.model_dump(exclude={"available_vram_mb"})
    est = estimate_lora_memory(EstimateInput(**data), budget)
    breakdown = None
    if req.hidden and req.layers and req.intermediate:
        breakdown = lora_param_count(req.hidden, req.layers, req.intermediate, req.lora_rank, req.target_all_linear,
                                     req.num_heads, req.num_kv_heads, req.head_dim)
    return {**est.to_dict(), "measured_free_mb": free, "measured_total_mb": total, "input": data,
            "lora_breakdown": breakdown}
