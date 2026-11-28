"""Scientific rigour: power planning (before a study), the forgetting check (after training)."""
from __future__ import annotations

import asyncio
import json
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from forge.api.routes_studies import _study
from forge.api.state import AppState, get_state
from forge.engine import forgetting, power
from forge.engine.study import PROFILES
from forge.engine.tasks import TaskSetSpec, generate_taskset
from forge.jobs.runner import JobError

router = APIRouter(prefix="/api", tags=["rigor"])


class PowerBody(BaseModel):
    profile: str = "pilot"
    seeds: int | None = Field(None, ge=1, le=12)
    groups: int | None = Field(None, ge=3, le=2000)          # test task groups; default: the profile's task set
    paraphrases: int | None = Field(None, ge=1, le=20)
    min_gain: float = Field(0.05, gt=0, le=1)
    base_rate: float | None = Field(None, ge=0, le=1)
    sd_group: float | None = Field(None, ge=0, le=1)
    sd_seed: float | None = Field(None, ge=0, le=1)
    calibrate_from: str | None = Field(None, pattern=r"^study_[a-z0-9]+$")   # an analysed pilot study


def power_for(st: AppState, body: PowerBody) -> dict:
    if body.profile not in PROFILES:
        raise HTTPException(422, f"profile must be one of {list(PROFILES)}")
    prof = PROFILES[body.profile]
    d = power.design_from_tasks(generate_taskset(TaskSetSpec(**prof["taskset"])))
    assumptions: dict = {}
    if body.calibrate_from:
        cal = power.calibrate(_study(st, body.calibrate_from))
        if not cal:
            raise HTTPException(409, "That study has no analysed practice results to calibrate from (run Analyze on dev first)")
        assumptions = cal
    assumptions |= {k: v for k, v in body.model_dump().items() if k in power.DEFAULTS and v is not None}
    return power.plan(groups=body.groups or d["groups"], paraphrases=body.paraphrases or d["paraphrases"],
                      seeds=body.seeds or len(prof["seeds"]), min_gain=body.min_gain, assumptions=assumptions)


@router.post("/power")
async def plan_power(body: PowerBody, st: AppState = Depends(get_state)):
    return await asyncio.to_thread(power_for, st, body)


@router.get("/studies/{sid}/power")
def study_power(sid: str, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    return {"preregistered": s.plan.get("power"), "calibration": power.calibrate(s)}


class ForgetBody(BaseModel):
    text_file: str | None = Field(None, max_length=1000)


@router.post("/studies/{sid}/forgetting")
def run_forgetting(sid: str, body: ForgetBody, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    if body.text_file and not os.path.isfile(body.text_file):
        raise HTTPException(422, "Text file not found on this machine")
    if not any((s.run_dir(a, x) / "adapter" / "adapter_model.safetensors").exists() for a in s.plan["arms"] for x in s.plan["seeds"]):
        raise HTTPException(409, "No trained adapters yet: run Train first")
    env = {"FORGE_ALLOW_CPU": "1"} if s.plan["device"] == "cpu" else None
    try:
        return st.jobs.start("forgetting", ["forgetting", "--study", str(s.root), "--config", json.dumps(body.model_dump())], gpu=True,
                             study_id=sid, label=f"{s.plan['name']} · forgetting check", env=env)
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("/studies/{sid}/forgetting")
def get_forgetting(sid: str, st: AppState = Depends(get_state)):
    return forgetting.report(_study(st, sid)) or {"computed": False}


class BundleBody(BaseModel):
    include_adapters: bool = False


@router.post("/studies/{sid}/bundle")
async def make_bundle(sid: str, body: BundleBody, st: AppState = Depends(get_state)):
    from forge.engine import bundle
    from forge.engine.study import StudyError
    s = _study(st, sid)
    try:
        return await asyncio.to_thread(bundle.export, s, None, body.include_adapters)
    except StudyError as e:
        raise HTTPException(409, f"{e} — wait for the running job to finish")


@router.get("/studies/{sid}/bundles")
def list_bundles(sid: str, st: AppState = Depends(get_state)):
    d = _study(st, sid).root / "bundles"
    return {"bundles": [{"name": p.name, "path": str(p), "bytes": p.stat().st_size} for p in sorted(d.glob("*.zip"), reverse=True)] if d.is_dir() else []}


@router.get("/studies/{sid}/bundles/{name}")
def download_bundle(sid: str, name: str, st: AppState = Depends(get_state)):
    from fastapi.responses import FileResponse
    import re
    if not re.fullmatch(r"study_[a-z0-9]+-[0-9T]+\.zip", name):
        raise HTTPException(422, "Bad bundle name")
    p = _study(st, sid).root / "bundles" / name
    if not p.exists():
        raise HTTPException(404, "No such bundle")
    return FileResponse(p, filename=name, media_type="application/zip")


class VerifyBody(BaseModel):
    path: str = Field(min_length=5, max_length=1000)


@router.post("/bundles/verify")
async def verify_bundle(body: VerifyBody):
    from forge.engine import bundle
    if not body.path.lower().endswith(".zip") or not os.path.isfile(body.path):
        raise HTTPException(422, "Give the path of a bundle .zip on this machine")
    return await asyncio.to_thread(bundle.verify, body.path)


class AutopilotBody(BaseModel):
    seal_confirm: str | None = Field(None, max_length=10)   # "SEAL" lets the run seal and run the final test
    quant: bool = True
    text_file: str | None = Field(None, max_length=1000)


@router.get("/studies/{sid}/autopilot")
def autopilot_plan(sid: str, quant: bool = True, st: AppState = Depends(get_state)):
    from forge.engine import autopilot
    s = _study(st, sid)
    running = next((j for j in st.jobs.list(study_id=sid) if j.get("kind") == "autopilot" and j.get("status") in ("running", "queued", "cancelling")), None)
    return {"steps": autopilot.steps(s, {"quant": quant}), "running": running}


@router.post("/studies/{sid}/autopilot")
def autopilot_start(sid: str, body: AutopilotBody, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    if body.seal_confirm not in (None, "", "SEAL"):
        raise HTTPException(422, "Type SEAL exactly to allow sealing, or leave it empty to stop before the final test")
    if body.text_file and not os.path.isfile(body.text_file):
        raise HTTPException(422, "General-text file not found on this machine")
    cfg = {**body.model_dump(), "hash_cache": str(st.settings.home / "hash_cache.json")}
    env = {"FORGE_ALLOW_CPU": "1"} if s.plan["device"] == "cpu" else None
    try:
        return st.jobs.start("autopilot", ["autopilot", "--study", str(s.root), "--config", json.dumps(cfg)], gpu=True, study_id=sid,
                             label=f"{s.plan['name']} · run everything left", env=env)
    except JobError as e:
        raise HTTPException(409, str(e))
