from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from forge.analysis.adapters import AdapterError, inspect_adapter
from forge.api.state import AppState, get_state
from forge.engine import statistics as stats
from forge.security.paths import is_within

router = APIRouter(prefix="/api", tags=["analysis"])


class McNemarBody(BaseModel):
    b: int = Field(ge=0, le=1_000_000)
    c: int = Field(ge=0, le=1_000_000)


@router.post("/stats/mcnemar")
def mcnemar(body: McNemarBody):
    return {**stats.mcnemar_exact(body.b, body.c), "computed": True,
            "note": "Exact two-sided binomial on discordant pairs. Diagnostic only in FORGE studies."}


class PowerBody(BaseModel):
    delta: float = Field(gt=0, le=1)
    discordant: float = Field(gt=0, le=1)
    alpha: float = Field(0.05, gt=0, lt=0.5)
    power: float = Field(0.8, gt=0.5, lt=1)


@router.post("/stats/power")
def power(body: PowerBody):
    try:
        return {**stats.power_n(body.delta, body.discordant, body.alpha, body.power), "computed": True}
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.get("/analysis/adapter")
async def adapter(path: str, base: str | None = None, st: AppState = Depends(get_state)):
    """Inspect any safetensors LoRA adapter under FORGE home or a registered model directory."""
    roots = [st.settings.home, *[Path(d) for d in st.db.get_setting("model_dirs", [])]]
    p = Path(path)
    if not p.is_absolute() or not is_within(p, roots):
        raise HTTPException(422, "Adapter path must be inside FORGE home or a registered model directory")
    b = Path(base) if base else None
    if b and not is_within(b, roots + [st.settings.hf_hub_cache]):
        raise HTTPException(422, "Base path must be a registered location")
    try:
        return await asyncio.to_thread(inspect_adapter, p, b)
    except (AdapterError, FileNotFoundError) as e:
        raise HTTPException(422, str(e))
