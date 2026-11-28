"""LM Studio control: status and a single explicit action — unload all models to free the GPU."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException

from forge.api.state import AppState, get_state
from forge.providers import lmstudio_cli
from forge.readiness import teacher_endpoint_status

router = APIRouter(prefix="/api/lmstudio", tags=["lmstudio"])


def _loaded(st: AppState) -> list[str] | None:
    s = teacher_endpoint_status(st.settings.lmstudio_url)
    if not s.get("reachable"):
        return None
    return s.get("loaded")


@router.get("/status")
async def status(st: AppState = Depends(get_state)):
    s = await asyncio.to_thread(teacher_endpoint_status, st.settings.lmstudio_url)
    lms = lmstudio_cli.find_lms()
    return {"server_reachable": s.get("reachable", False), "url": s.get("url"), "loaded": s.get("loaded"),
            "cli_path": lms, "cli_found": lms is not None, "unload_command": "lms unload --all"}


@router.post("/unload")
async def unload(st: AppState = Depends(get_state)):
    busy = st.jobs.gpu_busy()
    if busy and busy["kind"] == "stage:collect":
        raise HTTPException(409, f"Collect job {busy['id']} is using the teacher; unloading now would abort it. "
                                 "Cancel it first or wait for it to finish.")
    lms = lmstudio_cli.find_lms()
    if not lms:
        raise HTTPException(404, "LM Studio's `lms` CLI was not found (PATH, %USERPROFILE%\\.lmstudio\\bin). "
                                 "Eject the model in LM Studio instead, or set FORGE_LMS_PATH.")
    res = await asyncio.to_thread(lmstudio_cli.unload_all, lms, lambda: _loaded(st))
    if not res["ok"]:
        raise HTTPException(502, res.get("error") or
                            f"Unload did not complete (exit {res['exit_code']}); still loaded: {res['loaded_after']}. "
                            f"{res['stderr'][-300:]}".strip())
    return res
