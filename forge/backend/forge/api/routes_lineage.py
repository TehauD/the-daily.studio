"""Lineage measurements: training-data overlap (contamination check) and the checkpoint timeline."""
from __future__ import annotations

import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from forge.api.routes_studies import _study
from forge.api.state import AppState, get_state
from forge.engine import lineage_eval as le
from forge.jobs.runner import JobError
from forge.registry.registry import RegistryError

router = APIRouter(prefix="/api", tags=["lineage"])
DEFAULT_INDEX = {"enabled": False, "url": "https://api.infini-gram.io/", "index": ""}


class IndexSettings(BaseModel):
    enabled: bool = False
    url: str = Field("https://api.infini-gram.io/", max_length=300)
    index: str = Field("", max_length=120)


@router.get("/lineage/index")
def get_index(st: AppState = Depends(get_state)):
    return {**DEFAULT_INDEX, **st.db.get_setting("training_index", {})}


@router.put("/lineage/index")
def put_index(body: IndexSettings, st: AppState = Depends(get_state)):
    try:
        le.check_index_url(body.url)
    except le.LineageError as e:
        raise HTTPException(422, str(e))
    if body.enabled and not body.index.strip():
        raise HTTPException(422, "Name the index to query (as the provider lists it)")
    st.db.set_setting("training_index", body.model_dump())
    return get_index(st)


class OverlapBody(BaseModel):
    split: Literal["dev", "test"] = "test"


@router.post("/studies/{sid}/overlap")
def start_overlap(sid: str, body: OverlapBody, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    cfg = {**DEFAULT_INDEX, **st.db.get_setting("training_index", {})}
    if not cfg["enabled"] or not cfg["index"]:
        raise HTTPException(409, "Training-data index is not configured: Settings → Training-data index")
    try:
        return st.jobs.start("overlap", ["overlap", "--study", str(s.root), "--config", json.dumps({**cfg, "split": body.split})],
                             gpu=False, study_id=sid, label=f"{s.plan['name']} · training-data overlap ({body.split})")
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("/studies/{sid}/overlap")
def get_overlap(sid: str, st: AppState = Depends(get_state)):
    p = _study(st, sid).root / "reports" / "overlap.json"
    if not p.exists():
        raise HTTPException(404, "No overlap check yet")
    return json.loads(p.read_text(encoding="utf-8"))


class CheckpointBody(BaseModel):
    model_id: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=60)
    order: float = 0
    stage: str = Field("", max_length=60)
    split: Literal["dev", "test"] = "dev"


@router.post("/studies/{sid}/checkpoints")
def start_checkpoint(sid: str, body: CheckpointBody, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    try:
        m = st.registry.get(body.model_id)
    except RegistryError as e:
        raise HTTPException(404, str(e))
    if not m.get("storage_path") or m["capabilities"]["inference"]["status"] != "supported":
        raise HTTPException(422, f"{m['name']} can't be run locally by FORGE (local Hugging Face weights with a supported architecture needed)")
    if body.split == "test" and not s.state.get("sealed"):
        raise HTTPException(409, "The final test can be used for checkpoints only after the study is sealed")
    try:
        le.slug(body.label)
    except le.LineageError as e:
        raise HTTPException(422, str(e))
    params = ((m.get("metadata") or {}).get("parameter_report") or {}).get("unique_total") or m.get("parameter_count") or 0
    cfg = {**body.model_dump(), "path": m["storage_path"], "load_4bit": s.plan["device"] == "cuda" and (params > 4e9 or s.base_4bit)}
    env = {"FORGE_ALLOW_CPU": "1"} if s.plan["device"] == "cpu" else None
    try:
        return st.jobs.start("checkpoint-eval", ["checkpoint-eval", "--study", str(s.root), "--config", json.dumps(cfg)], gpu=True, study_id=sid,
                             label=f"{s.plan['name']} · checkpoint {body.label} ({body.split})", env=env)
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("/studies/{sid}/checkpoints")
def get_timeline(sid: str, st: AppState = Depends(get_state)):
    return le.timeline(_study(st, sid))
