"""Task packs: share a use case as data (agent spec + synthetic tables + verified tasks), install one from a colleague."""
from __future__ import annotations

import asyncio
import os
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from forge.agents import packs
from forge.api.routes_agents import _agent, _base
from forge.api.state import AppState, get_state

router = APIRouter(prefix="/api", tags=["packs"])


def _dir(st: AppState):
    d = st.settings.home / "packs"
    d.mkdir(parents=True, exist_ok=True)
    return d


class ExportBody(BaseModel):
    id: str | None = Field(None, max_length=64)
    name: str | None = Field(None, max_length=120)
    version: str = Field("1.0.0", pattern=r"^[0-9]+\.[0-9]+\.[0-9]+$")
    description: str = Field("", max_length=2000)
    author: str = Field("", max_length=200)
    licence: str = Field("", max_length=200)
    intended_use: str | None = Field(None, max_length=1000)
    include_tasks: bool = True


@router.post("/agents/{aid}/pack")
def export_pack(aid: str, body: ExportBody, st: AppState = Depends(get_state)):
    try:
        return packs.export(_agent(st, aid), _dir(st), body.model_dump(), body.include_tasks)
    except packs.PackError as e:
        raise HTTPException(422, str(e))


@router.get("/packs")
def list_packs(st: AppState = Depends(get_state)):
    out = []
    for p in sorted(_dir(st).glob("*.forgepack.zip")):
        try:
            out.append({"file": p.name, "path": str(p), "bytes": p.stat().st_size, **packs.inspect(p)})
        except (packs.PackError, OSError, ValueError) as e:
            out.append({"file": p.name, "path": str(p), "error": str(e)})
    return {"packs": out, "folder": str(_dir(st))}


class PathBody(BaseModel):
    path: str = Field(min_length=5, max_length=1000)
    no_sensitive_data: bool = False
    name: str | None = Field(None, max_length=80)


def _check(path: str) -> None:
    if not path.lower().endswith(".zip") or not os.path.isfile(path):
        raise HTTPException(422, "Give the path of a .forgepack.zip on this machine")


@router.post("/packs/inspect")
def inspect_pack(body: PathBody):
    _check(body.path)
    try:
        return packs.inspect(body.path)
    except (packs.PackError, ValueError) as e:
        raise HTTPException(422, str(e))


@router.post("/packs/install")
async def install_pack(body: PathBody, st: AppState = Depends(get_state)):
    _check(body.path)
    try:
        return await asyncio.to_thread(packs.install, _base(st), body.path, body.no_sensitive_data, body.name)
    except (packs.PackError, ValueError) as e:
        raise HTTPException(422, str(e))


@router.get("/packs/{name}")
def download_pack(name: str, st: AppState = Depends(get_state)):
    if not re.fullmatch(r"[a-z0-9][a-z0-9_.-]{1,80}\.forgepack\.zip", name):
        raise HTTPException(422, "Bad pack name")
    p = _dir(st) / name
    if not p.exists():
        raise HTTPException(404, "No such pack")
    return FileResponse(p, filename=name, media_type="application/zip")
