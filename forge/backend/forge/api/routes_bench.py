"""Bench Lab API: create a run (items are generated and frozen first), list runs, results, images, and the scorecard."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from forge.api.state import AppState, get_state
from forge.jobs.runner import JobError
from forge.util import new_id, utcnow, write_json_atomic

router = APIRouter(prefix="/api/bench", tags=["bench"])
HONESTY = {
    "compute": "Generated problems with exact answers. 'With tools' also requires the answer to be backed by a tool result. Results describe these problems, not mathematics in general.",
    "vision": "Synthetic administrative documents drawn by FORGE; answers are exact. Not medical images; says nothing about clinical image interpretation.",
    "security": "Synthetic artifacts. Defensive analysis with red-team knowledge; no exploit code is requested. Recommendation items are scored by rubric coverage — evidence, not proof of quality; review them.",
}


def _base(st: AppState) -> Path:
    d = st.settings.home / "bench"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _run_dir(st: AppState, rid: str) -> Path:
    if not rid.startswith("bench_") or not rid[6:].isalnum():
        raise HTTPException(422, "Invalid run id")
    d = _base(st) / rid
    if not (d / "spec.json").exists():
        raise HTTPException(404, "Unknown run")
    return d


@router.get("/suites")
def suites():
    from forge.bench import compute, security, vision
    return {"compute": {"title": "Model Bench — computation", "categories": compute.CATEGORIES, "modes": ["no_tools", "tools"], "honesty": HONESTY["compute"]},
            "vision": {"title": "Vision Bench — documents", "categories": vision.CATEGORIES, "modes": ["direct"], "honesty": HONESTY["vision"]},
            "security": {"title": "Security Bench — blue team", "categories": security.CATEGORIES, "modes": ["direct"], "honesty": HONESTY["security"]}}


class LaneIn(BaseModel):
    model_id: str = Field(min_length=1, max_length=300)
    study_id: str | None = Field(None, pattern=r"^study_[a-f0-9]+$")
    arm: str | None = Field(None, pattern=r"^[a-z0-9_]{1,40}$")
    seed: int | None = Field(None, ge=0, le=99)
    label: str | None = Field(None, max_length=60)


class RunIn(BaseModel):
    suite: Literal["compute", "vision", "security"]
    lanes: list[LaneIn] = Field(min_length=1, max_length=6)
    n_per_cell: int = Field(6, ge=1, le=50)
    seed: int = Field(1, ge=0, le=10_000)
    categories: list[str] | None = None
    device: Literal["cuda", "cpu"] = "cuda"


def _lane(st: AppState, ln: LaneIn, device: str) -> dict[str, Any]:
    from forge.api.routes_studies import _study, _teacher_spec
    from forge.registry.registry import RegistryError
    try:
        m = st.registry.get(ln.model_id)
    except RegistryError as e:
        raise HTTPException(404, str(e))
    meta = m.get("metadata") or {}
    vision = meta.get("lmstudio_type") == "vlm" or "vision" in (meta.get("lmstudio_capabilities") or []) or bool(meta.get("vision"))
    if m["provider"] in ("lmstudio", "ollama") or m["provider"].startswith("endpoint:"):
        spec = _teacher_spec(st, m)
        return {"kind": "endpoint", "label": ln.label or m["name"], "model_id": m["id"], "vision": vision, **{k: spec[k] for k in ("provider", "endpoint", "model")},
                "allow_remote": spec.get("allow_remote", False)}
    if not m.get("storage_path") or m["capabilities"]["lora"]["status"] != "supported":
        raise HTTPException(422, f"{m['name']} can't be run locally (use it through LM Studio / Ollama)")
    params = ((m.get("metadata") or {}).get("parameter_report") or {}).get("unique_total") or m.get("parameter_count") or 0
    lane = {"kind": "student", "label": ln.label or m["name"], "model_id": m["id"], "path": m["storage_path"], "device": device, "vision": False,
            "load_4bit": device == "cuda" and params > 4e9}  # a 7B base in bf16 does not leave room to run on a 16 GB card
    if ln.study_id:
        s = _study(st, ln.study_id)
        if ln.arm not in s.plan["arms"] or ln.seed not in s.plan["seeds"]:
            raise HTTPException(422, "Unknown arm/seed for that study")
        ad = s.run_dir(ln.arm, ln.seed) / "adapter"
        if not (ad / "adapter_model.safetensors").exists():
            raise HTTPException(409, "That adapter is not trained yet")
        lane |= {"adapter": str(ad), "label": ln.label or f"{m['name']} + {s.plan['name']} ({ln.arm} s{ln.seed})",
                 "load_4bit": lane["load_4bit"] or s.base_4bit}
    return lane


@router.post("/runs")
def create_run(body: RunIn, st: AppState = Depends(get_state)):
    import os
    from forge.bench import compute, security, vision
    if body.device == "cpu" and os.environ.get("FORGE_ALLOW_CPU") != "1":
        raise HTTPException(422, "CPU runs are wiring tests only; set FORGE_ALLOW_CPU=1")
    cats = {"compute": compute.CATEGORIES, "vision": vision.CATEGORIES, "security": security.CATEGORIES}[body.suite]
    if body.categories and set(body.categories) - set(cats):
        raise HTTPException(422, f"Unknown categories {sorted(set(body.categories) - set(cats))}")
    lanes = [_lane(st, ln, body.device) for ln in body.lanes]
    labels = [l["label"] for l in lanes]
    if len(set(labels)) != len(labels):
        raise HTTPException(422, "Give each model lane a distinct label")
    if body.suite == "vision" and not any(l["vision"] for l in lanes):
        raise HTTPException(422, "None of the chosen models is marked as a vision model (in LM Studio its type is 'vlm')")
    rid = new_id("bench")
    d = _base(st) / rid
    (d / "images").mkdir(parents=True)
    if body.suite == "compute":
        items = compute.generate(body.n_per_cell, body.seed, body.categories)
    elif body.suite == "security":
        items = security.generate(body.n_per_cell, body.seed, body.categories)
    else:
        items = vision.generate(body.n_per_cell, body.seed, d / "images", body.categories)
    (d / "items.jsonl").write_text("".join(json.dumps(i.to_dict(), ensure_ascii=False) + "\n" for i in items), encoding="utf-8")
    spec = {"id": rid, "suite": body.suite, "created_at": utcnow(), "seed": body.seed, "n_per_cell": body.n_per_cell, "items": len(items),
            "categories": body.categories or list(cats), "lanes": lanes, "honesty": HONESTY[body.suite]}
    write_json_atomic(d / "spec.json", json.dumps(spec, indent=2))
    env = {"FORGE_ALLOW_CPU": "1"} if body.device == "cpu" else None
    try:
        job = st.jobs.start("bench", ["bench", "--run", str(d)], gpu=True, study_id=rid, label=f"{body.suite} bench · {len(lanes)} model(s) · {len(items)} items", env=env)
    except JobError as e:
        raise HTTPException(409, str(e))
    return {"id": rid, "job": job, "items": len(items)}


@router.get("/runs")
def list_runs(st: AppState = Depends(get_state)):
    out = []
    for d in sorted(_base(st).iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            spec = json.loads((d / "spec.json").read_text(encoding="utf-8"))
            summ = json.loads((d / "summary.json").read_text(encoding="utf-8")) if (d / "summary.json").exists() else None
        except (OSError, ValueError):
            continue
        out.append({"id": spec["id"], "suite": spec["suite"], "created_at": spec["created_at"], "items": spec["items"], "lanes": [l["label"] for l in spec["lanes"]],
                    "done": (summ or {}).get("done", 0), "expected": (summ or {}).get("expected"), "rows": [{k: r.get(k) for k in ("lane", "mode", "rate", "ci", "n")} for r in (summ or {}).get("rows", [])]})
    return out


@router.get("/runs/{rid}")
def get_run(rid: str, st: AppState = Depends(get_state)):
    from forge.bench.runner import summarize
    d = _run_dir(st, rid)
    s = summarize(d) if (d / "results.jsonl").exists() else {"rows": [], "done": 0}
    spec = json.loads((d / "spec.json").read_text(encoding="utf-8"))
    return {**spec, "summary": s, "jobs": st.jobs.list(5, study_id=rid)}


@router.get("/runs/{rid}/items")
def run_items(rid: str, lane: str | None = None, mode: str | None = None, only_wrong: bool = False, category: str | None = None,
              st: AppState = Depends(get_state)):
    d = _run_dir(st, rid)
    items = {i["id"]: i for i in map(json.loads, (d / "items.jsonl").read_text(encoding="utf-8").splitlines()) if i}
    rows = [json.loads(x) for x in (d / "results.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()] if (d / "results.jsonl").exists() else []
    rows = [r for r in rows if (not lane or r["lane"] == lane) and (not mode or r["mode"] == mode) and (not category or r["category"] == category)
            and (not only_wrong or (r.get("correct") is False))]
    return {"rows": [{**r, "prompt": items[r["item"]]["prompt"][:3000], "expected": items[r["item"]]["answer"], "kind": items[r["item"]]["kind"],
                      "image": items[r["item"]].get("image"), "meta": items[r["item"]].get("meta")} for r in rows[:500]], "total": len(rows)}


@router.get("/runs/{rid}/images/{name}")
def run_image(rid: str, name: str, st: AppState = Depends(get_state)):
    import re
    d = _run_dir(st, rid)
    if not re.fullmatch(r"vis-[a-z]+-\d-\d{3}\.png", name):
        raise HTTPException(404, "Unknown image")
    p = d / "images" / name
    if not p.exists():
        raise HTTPException(404, "Unknown image")
    return FileResponse(p, media_type="image/png")


@router.get("/scorecard")
def scorecard(st: AppState = Depends(get_state)):
    """Latest completed result per (model, suite, mode): the cross-bench view of every model FORGE has measured."""
    best: dict[tuple, dict] = {}
    for d in sorted(_base(st).iterdir(), key=lambda p: p.stat().st_mtime):
        try:
            summ = json.loads((d / "summary.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for r in summ["rows"]:
            if r.get("n"):
                best[(r["lane"], summ["suite"], r["mode"])] = {"lane": r["lane"], "suite": summ["suite"], "mode": r["mode"], "rate": r["rate"], "ci": r["ci"],
                                                              "n": r["n"], "run": summ["id"], "at": summ["created_at"], "by_category": {k: v["rate"] for k, v in r["by_category"].items()}}
    return {"rows": list(best.values()), "note": "Latest run per model, suite and mode. Different runs may use different items (seed); compare models within one run for a strict comparison."}
