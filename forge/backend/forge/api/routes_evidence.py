"""Evidence: did the student learn, and does the measurement pass its negative control?"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends

from forge.api.routes_studies import _study
from forge.api.state import AppState, get_state
from forge.engine.evidence import evidence

router = APIRouter(prefix="/api", tags=["evidence"])


@router.get("/studies/{sid}/evidence")
async def study_evidence(sid: str, st: AppState = Depends(get_state)):
    return await asyncio.to_thread(evidence, _study(st, sid))
