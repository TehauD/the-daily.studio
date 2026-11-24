"""Compare any two measured subjects on byte-identical tasks, open one task side by side, and see results over time."""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from forge.api.routes_pipeline import _studies_for
from forge.api.routes_studies import _study
from forge.api.state import AppState, get_state
from forge.engine import compare as cmp
from forge.engine.study import Study, StudyError

router = APIRouter(prefix="/api", tags=["compare"])
_CACHE: dict[tuple[str, str], tuple[tuple, cmp.Subject]] = {}
_MAX = 16


def _all_studies(st: AppState) -> list[Study]:
    out = []
    for r in st.db.query("SELECT * FROM studies ORDER BY created_at DESC"):
        try:
            out.append(Study(Path(r["path"])))
        except StudyError:
            continue
    return out


def _scope(st: AppState, project: str | None) -> list[Study]:
    if not project:
        return _all_studies(st)
    kind, _, ref = project.partition(":")
    if kind not in ("agent", "docs", "catalog"):
        raise HTTPException(422, "Unknown project")
    return _studies_for(st, kind, ref or None)


def _fingerprint(st: AppState, ref: str, split: str) -> tuple:
    kind, _, rest = ref.partition(":")
    files: list[Path] = []
    try:
        if kind == "arm":
            sid, arm = rest.split(":")[:2]
            s = _study(st, sid)
            files = [s.root / "tasks.jsonl", *sorted((s.root / "episodes" / arm / split).glob("seed*.jsonl"))]
        elif kind == "variant":
            vid, _, sid = rest.partition(":")
            files = [st.settings.home / "weightlab" / vid / "eval" / f"{sid}.jsonl"]
        elif kind == "lane":
            files = [st.settings.home / "bench" / rest.partition(":")[0] / "results.jsonl"]
    except (HTTPException, ValueError):
        return ()
    return tuple((str(f), f.stat().st_mtime_ns, f.stat().st_size) for f in files if f.exists())


def _subject(st: AppState, ref: str, split: str) -> cmp.Subject:
    key = (ref, split)
    fp = _fingerprint(st, ref, split)
    hit = _CACHE.get(key)
    if hit and fp and hit[0] == fp:
        return hit[1]
    try:
        s = cmp.load_subject(ref, split, lambda sid: _study(st, sid), st.settings.home)
    except cmp.CompareError as e:
        raise HTTPException(422, str(e))
    if len(_CACHE) >= _MAX:
        _CACHE.pop(next(iter(_CACHE)))
    _CACHE[key] = (fp, s)
    return s


def _split_for(ref: str, split: str) -> str:
    return "bench" if ref.startswith("lane:") else split


@router.get("/compare/subjects")
def compare_subjects(project: str | None = None, st: AppState = Depends(get_state)):
    return {"subjects": cmp.subjects(_scope(st, project) if project else _all_studies(st), st.settings.home)}


@router.get("/compare")
async def compare(a: str = Query(max_length=400), b: str = Query(max_length=400), split: str = "dev", st: AppState = Depends(get_state)):
    if split not in cmp.SPLITS:
        raise HTTPException(422, "Unknown split")
    if a == b:
        raise HTTPException(422, "Pick two different things to compare")

    def run() -> dict[str, Any]:
        A, B = _subject(st, a, _split_for(a, split)), _subject(st, b, _split_for(b, split))
        try:
            return cmp.compare(A, B)
        except cmp.CompareError as e:
            raise HTTPException(422, str(e))
    return await asyncio.to_thread(run)


@router.get("/compare/unit")
def compare_unit(a: str = Query(max_length=400), b: str = Query(max_length=400), unit: str = Query(pattern=r"^[a-f0-9]{64}$"),
                 split: str = "dev", st: AppState = Depends(get_state)):
    A, B = _subject(st, a, _split_for(a, split)), _subject(st, b, _split_for(b, split))
    try:
        return cmp.unit_detail(A, B, unit)
    except cmp.CompareError as e:
        raise HTTPException(404, str(e))


@router.get("/history")
async def history(project: str | None = None, model: str | None = Query(default=None, max_length=200), st: AppState = Depends(get_state)):
    studies = _scope(st, project)
    return await asyncio.to_thread(cmp.history, studies, st.settings.home, model)
