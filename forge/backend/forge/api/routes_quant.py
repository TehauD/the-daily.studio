"""Quantization Lab: reference variants, served (GGUF / vLLM) variants, recipes, and the size-vs-accuracy summary."""
from __future__ import annotations

import json
import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from forge.api.routes_studies import _study
from forge.api.state import AppState, get_state
from forge.jobs.runner import JobError
from forge.quant import lab

router = APIRouter(prefix="/api/studies/{sid}/quant", tags=["quant"])


def _env(s):
    return {"FORGE_ALLOW_CPU": "1"} if s.plan["device"] == "cpu" and os.environ.get("FORGE_ALLOW_CPU") == "1" else None


def _start(st: AppState, s, cfg: dict, label: str, gpu: bool = True):
    try:
        return st.jobs.start("quant", ["quant", "--study", str(s.root), "--config", json.dumps(cfg)], gpu=gpu, study_id=s.plan["study_id"],
                             label=f"{s.plan['name']} · {label}", env=_env(s))
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("")
def get_lab(sid: str, st: AppState = Depends(get_state)):
    return lab.lab(_study(st, sid))


class RefBody(BaseModel):
    method: str = Field(min_length=1, max_length=40)
    label: str | None = Field(None, max_length=40)
    split: Literal["dev", "test"] = "dev"
    group: int | None = Field(None, ge=16, le=1024)


@router.post("/reference")
def make_reference(sid: str, body: RefBody, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    try:
        m = lab.method(body.method)
        lab.source_dir(s)
        lab.slug(body.label or m["id"])
    except lab.QuantError as e:
        raise HTTPException(422, str(e))
    if m["family"] != "reference":
        raise HTTPException(422, "Only FORGE reference methods run inside FORGE; use the recipe for GGUF / vLLM")
    if body.split == "test" and not s.state.get("sealed"):
        raise HTTPException(409, "The sealed test can be used only after SEAL")
    cfg = {"action": "reference", **{k: v for k, v in body.model_dump().items() if v is not None}}
    return _start(st, s, cfg, f"quantize {body.label or m['id']}")


class EvalBody(BaseModel):
    split: Literal["dev", "test"] = "test"


@router.post("/{label}/evaluate")
def evaluate(sid: str, label: str, body: EvalBody, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    if not (s.root / "quant" / lab.slug(label) / "manifest.json").exists():
        raise HTTPException(404, "Unknown variant")
    if body.split == "test" and not s.state.get("sealed"):
        raise HTTPException(409, "The sealed test can be used only after SEAL")
    return _start(st, s, {"action": "evaluate", "label": lab.slug(label), "split": body.split}, f"measure {label} on {body.split}")


class ServedBody(BaseModel):
    method: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=40)
    endpoint: str = Field(min_length=8, max_length=300)
    model: str = Field(min_length=1, max_length=300)
    size_bytes: int | None = Field(None, ge=0)
    split: Literal["dev", "test"] = "dev"
    notes: str = Field("", max_length=500)


@router.post("/served")
def served(sid: str, body: ServedBody, st: AppState = Depends(get_state)):
    from urllib.parse import urlparse
    s = _study(st, sid)
    host = urlparse(body.endpoint).hostname
    if host not in ("127.0.0.1", "localhost", "::1"):
        raise HTTPException(422, "Served variants are measured on this machine only (loopback endpoint, e.g. http://127.0.0.1:8000/v1)")
    try:
        lab.method(body.method)
        lab.slug(body.label)
    except lab.QuantError as e:
        raise HTTPException(422, str(e))
    return _start(st, s, {"action": "served", **body.model_dump()}, f"measure served {body.label}", gpu=False)


@router.get("/recipe")
def get_recipe(sid: str, method: str, st: AppState = Depends(get_state)):
    try:
        return lab.recipe(_study(st, sid), method)
    except lab.QuantError as e:
        raise HTTPException(422, str(e))


@router.get("/{label}/layers")
def get_layers(sid: str, label: str, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    if not (s.root / "quant" / lab.slug(label) / "manifest.json").exists():
        raise HTTPException(404, "Unknown variant")
    return lab.layers(s, lab.slug(label))


@router.get("/served-models")
def served_models(sid: str, endpoint: str, st: AppState = Depends(get_state)):
    """Models an OpenAI-compatible server on this machine is serving (LM Studio, vLLM) — so the id is picked, not typed."""
    from urllib.parse import urlparse

    import httpx
    _study(st, sid)
    if urlparse(endpoint).hostname not in ("127.0.0.1", "localhost", "::1"):
        raise HTTPException(422, "Only servers on this machine (loopback) can be listed")
    url = endpoint.rstrip("/") + "/models"
    try:
        r = httpx.get(url, timeout=3.0, trust_env=False)   # loopback: never through a proxy
        r.raise_for_status()
        ids = [m.get("id") for m in (r.json().get("data") or []) if m.get("id")]
    except (httpx.HTTPError, ValueError) as e:
        raise HTTPException(502, f"No OpenAI-compatible server answered at {url} ({type(e).__name__}). Start LM Studio's server or `vllm serve` first.")
    return {"endpoint": endpoint, "models": [i for i in ids if "embed" not in i.lower()]}
