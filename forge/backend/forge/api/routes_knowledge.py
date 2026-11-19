"""Knowledge Studio API: packs, their steps (as jobs), browsing, and a live search playground."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from forge.api.state import AppState, get_state
from forge.jobs.runner import JobError
from forge.knowledge.pack import KnowledgePack, PackError
from forge.registry.registry import RegistryError
from forge.security.paths import PathSecurityError, validate_user_directory

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])
SAMPLE_DIR = Path(__file__).resolve().parents[3] / "docs"  # FORGE's own documentation: a safe first corpus


def _base(st: AppState) -> Path:
    d = st.settings.home / "knowledge"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _pack(st: AppState, pid: str) -> KnowledgePack:
    if not pid.startswith("pack_") or not pid[5:].isalnum():
        raise HTTPException(422, "Invalid pack id")
    try:
        return KnowledgePack(_base(st) / pid)
    except PackError as e:
        raise HTTPException(404, str(e))


def _short(p: KnowledgePack) -> dict:
    m = p.meta
    return {"id": m["id"], "name": m["name"], "source_dir": m["source_dir"], "created_at": m["created_at"],
            "steps": {k: v.get("status") for k, v in m["steps"].items()}, "embedding": m.get("embedding"),
            "summary": {k: v.get("summary") for k, v in m["steps"].items()}}


@router.get("")
def list_packs(st: AppState = Depends(get_state)):
    out = []
    for d in sorted(_base(st).iterdir(), reverse=True):
        try:
            out.append(_short(KnowledgePack(d)))
        except PackError:
            continue
    return out


@router.get("/sample")
def sample_info():
    files = sorted(p.name for p in SAMPLE_DIR.glob("*.md")) if SAMPLE_DIR.is_dir() else []
    return {"available": bool(files), "path": str(SAMPLE_DIR), "files": files,
            "description": "FORGE's own documentation — public, non-sensitive, good for a first run."}


class CreatePack(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    folder: str | None = None
    use_sample: bool = False
    no_sensitive_data: bool
    chunk_size: int = Field(800, ge=200, le=4000)


@router.post("")
def create_pack(body: CreatePack, st: AppState = Depends(get_state)):
    if body.use_sample:
        folder = SAMPLE_DIR
    else:
        try:
            folder = validate_user_directory(body.folder or "")
        except PathSecurityError as e:
            raise HTTPException(422, str(e))
    try:
        p = KnowledgePack.create(_base(st), body.name, folder, body.no_sensitive_data, body.chunk_size, max(40, body.chunk_size // 7))
    except PackError as e:
        raise HTTPException(422, str(e))
    return p.summary()


@router.get("/embedding-models")
async def embedding_models(st: AppState = Depends(get_state)):
    """Embedding models LM Studio can serve (by REST type, or 'embed' in the id)."""
    base = st.settings.lmstudio_url.rstrip("/")

    def fetch() -> list[dict]:
        out: dict[str, dict] = {}
        for url in (f"{base}/api/v0/models", f"{base}/v1/models"):
            try:
                r = httpx.get(url, timeout=3.0, trust_env=False)
                if r.status_code != 200:
                    continue
                for m in r.json().get("data", []):
                    mid = str(m.get("id", ""))
                    if m.get("type") == "embeddings" or "embed" in mid.lower():
                        out.setdefault(mid, {"id": mid, "state": m.get("state")})
            except (httpx.HTTPError, ValueError):
                continue
        return sorted(out.values(), key=lambda x: x["id"])
    models = await asyncio.to_thread(fetch)
    return {"endpoint": base + "/v1", "models": models}


@router.get("/{pid}")
def get_pack(pid: str, st: AppState = Depends(get_state)):
    p = _pack(st, pid)
    qs = p.questions()
    return {**p.summary(), "counts": {"documents": len(p.docs()), "passages": len(p.chunks()), "questions": len(qs),
                                      "rejected": len(p.rejected())},
            "jobs": st.jobs.list(10, study_id=pid)}


class StepBody(BaseModel):
    embedding_model: str | None = None
    teacher_id: str | None = None
    n: int = Field(60, ge=4, le=1000)
    unanswerable: float = Field(0.25, ge=0, le=0.6)
    seed: int = 7


@router.post("/{pid}/steps/{step}")
def run_step(pid: str, step: Literal["import", "index", "questions"], body: StepBody, st: AppState = Depends(get_state)):
    from forge.api.routes_studies import _teacher_spec
    p = _pack(st, pid)
    try:
        p.check_can_run(step)
    except PackError as e:
        raise HTTPException(409, str(e))
    cfg: dict = {}
    if step == "index" and body.embedding_model:
        cfg = {"endpoint": st.settings.lmstudio_url + "/v1", "model": body.embedding_model}
    if step == "questions":
        if not body.teacher_id:
            raise HTTPException(422, "Choose a teacher model")
        try:
            t = _teacher_spec(st, st.registry.get(body.teacher_id))
        except RegistryError as e:
            raise HTTPException(404, str(e))
        cfg = {"endpoint": t["endpoint"], "model": t["model"], "n": body.n, "unanswerable": body.unanswerable, "seed": body.seed}
    try:
        # Question generation drives the teacher on the GPU (exclusive); import/index do not.
        return st.jobs.start(f"knowledge:{step}", ["knowledge", "--pack", str(p.root), "--step", step, "--config", json.dumps(cfg)],
                             gpu=step == "questions", study_id=pid, label=f"{p.meta['name']} · {step}")
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("/{pid}/docs")
def docs(pid: str, st: AppState = Depends(get_state)):
    p = _pack(st, pid)
    per: dict[str, int] = {}
    for c in p.chunks():
        per[c["doc_id"]] = per.get(c["doc_id"], 0) + 1
    return [{**d, "passages": per.get(d["doc_id"], 0)} for d in p.docs()]


@router.get("/{pid}/chunks")
def chunks(pid: str, doc_id: str | None = None, offset: int = 0, limit: int = 20, st: AppState = Depends(get_state)):
    rows = [c for c in _pack(st, pid).chunks() if not doc_id or c["doc_id"] == doc_id]
    return {"total": len(rows), "rows": rows[max(0, offset): max(0, offset) + min(limit, 100)]}


@router.get("/{pid}/questions")
def questions(pid: str, st: AppState = Depends(get_state)):
    p = _pack(st, pid)
    text = {c["chunk_id"]: c["text"] for c in p.chunks()}
    qs = [{**q, "gold_text": text.get(q["meta"].get("gold_chunk") or "", None)} for q in p.questions()]
    return {"questions": qs, "rejected": p.rejected()}


class SearchBody(BaseModel):
    query: str = Field(min_length=1, max_length=400)
    k: int = Field(5, ge=1, le=20)
    mode: Literal["hybrid", "keyword", "vector"] | None = None


@router.post("/{pid}/search")
async def search(pid: str, body: SearchBody, st: AppState = Depends(get_state)):
    p = _pack(st, pid)
    if p.meta["steps"].get("import", {}).get("status") != "completed":
        raise HTTPException(409, "Import documents first")
    idx = p.search_index()
    mode = body.mode or idx.mode
    if mode in ("hybrid", "vector") and idx.mode != "hybrid":
        raise HTTPException(409, "No vector index: build the index with an embedding model, or use keyword search")
    try:
        hits = await asyncio.to_thread(idx.search, body.query, body.k, mode)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Embedding endpoint unreachable ({type(e).__name__}); is LM Studio running?")
    titles = {d["doc_id"]: d["title"] for d in p.docs()}
    return {"mode": mode, "results": [{**h, "title": titles.get(h["doc_id"], "")} for h in hits]}
