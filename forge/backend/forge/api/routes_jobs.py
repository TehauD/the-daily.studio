from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from forge.api.state import AppState, get_state
from forge.jobs.runner import JobError

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("")
def list_jobs(limit: int = 50, st: AppState = Depends(get_state)):
    return {"jobs": st.jobs.list(min(limit, 200)), "gpu_busy": st.jobs.gpu_busy()}


@router.get("/{jid}")
def get_job(jid: str, st: AppState = Depends(get_state)):
    try:
        return st.jobs.get(jid)
    except JobError as e:
        raise HTTPException(404, str(e))


@router.get("/{jid}/log")
def job_log(jid: str, offset: int = 0, st: AppState = Depends(get_state)):
    try:
        return st.jobs.log(jid, max(0, offset))
    except JobError as e:
        raise HTTPException(404, str(e))


@router.post("/{jid}/cancel")
def cancel(jid: str, st: AppState = Depends(get_state)):
    try:
        return st.jobs.cancel(jid)
    except JobError as e:
        raise HTTPException(409, str(e))


@router.post("/verify-gpu")
def verify_gpu(st: AppState = Depends(get_state)):
    try:
        return st.jobs.start("verify_gpu", ["verify-gpu"], gpu=True, label="GPU verification (forward/backward, BF16)")
    except JobError as e:
        raise HTTPException(409, str(e))
