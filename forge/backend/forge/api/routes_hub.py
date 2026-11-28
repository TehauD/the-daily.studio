"""Hugging Face Hub — the only deliberate outbound network path. Responses carry an `outbound` record."""
from __future__ import annotations

import asyncio
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from forge.api.state import AppState, get_state
from forge.jobs.runner import JobError
from forge.providers import hf_hub

router = APIRouter(prefix="/api/hub", tags=["hub"])
REPO_RE = re.compile(r"^[A-Za-z0-9][\w.\-]{0,95}/[\w.\-]{1,96}$")


def _repo(repo: str) -> str:
    if not REPO_RE.fullmatch(repo):
        raise HTTPException(422, "repo must look like 'owner/name'")
    return repo


@router.get("/search")
async def search(q: str = "", limit: int = 25, task: str | None = "text-generation", st: AppState = Depends(get_state)):
    try:
        return await asyncio.to_thread(hf_hub.search, q[:100], limit=limit, task=task)
    except Exception as e:  # offline, proxy, rate limit — reported, not hidden
        raise HTTPException(502, f"Hub unreachable: {type(e).__name__}: {str(e)[:200]}")


@router.get("/inspect")
async def inspect(repo: str, revision: str | None = None, st: AppState = Depends(get_state)):
    try:
        return await asyncio.to_thread(hf_hub.inspect, _repo(repo), revision=revision)
    except hf_hub.HubError as e:
        raise HTTPException(422, str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Hub inspection failed: {type(e).__name__}: {str(e)[:200]}")


class DownloadBody(BaseModel):
    repo: str
    revision: str | None = Field(None, pattern=r"^[\w.\-/]{1,80}$")


@router.post("/download")
def download(body: DownloadBody, st: AppState = Depends(get_state)):
    args = ["hub-download", "--repo", _repo(body.repo), "--cache-dir", str(st.settings.hf_hub_cache)]
    if body.revision:
        args += ["--revision", body.revision]
    try:
        # Network/disk-bound, not GPU-bound: may run alongside a GPU job.
        return st.jobs.start("hub_download", args, gpu=False, label=f"Download {body.repo}",
                             env={"HF_HUB_OFFLINE": "0", "HF_HUB_DISABLE_TELEMETRY": "1"})
    except JobError as e:
        raise HTTPException(409, str(e))
