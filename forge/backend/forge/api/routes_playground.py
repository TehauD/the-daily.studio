"""Agent Playground (side-by-side runs + accept/override decisions) and Weight Lab (adapter variants)."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from forge.api.state import AppState, get_state
from forge.jobs.runner import JobError
from forge.util import utcnow

router = APIRouter(prefix="/api", tags=["playground", "weightlab"])
VID = re.compile(r"^var_[a-f0-9]+$")
RID = re.compile(r"^play_[a-f0-9]+$")


def _study(st: AppState, sid: str):
    from forge.api.routes_studies import _study as s
    return s(st, sid)


def _wl(st: AppState) -> Path:
    d = st.settings.home / "weightlab"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _variant(st: AppState, vid: str):
    from forge.engine.weightlab import Variant, WeightLabError
    if not VID.match(vid):
        raise HTTPException(422, "Invalid variant id")
    try:
        return Variant(_wl(st) / vid)
    except WeightLabError as e:
        raise HTTPException(404, str(e))


def _cpu_env(study) -> dict | None:
    import os
    return {"FORGE_ALLOW_CPU": "1"} if study.plan["device"] == "cpu" and os.environ.get("FORGE_ALLOW_CPU") == "1" else None


# ------------------------------------------------------------------ playground
class Lane(BaseModel):
    kind: Literal["base", "adapter", "variant", "teacher"]
    arm: str | None = Field(None, pattern=r"^[a-z0-9_]{1,40}$")
    seed: int | None = Field(None, ge=0, le=99)
    variant: str | None = Field(None, pattern=r"^var_[a-f0-9]+$")
    label: str | None = Field(None, max_length=60)


class PlayBody(BaseModel):
    prompt: str | None = Field(None, max_length=2000)
    task_id: str | None = Field(None, max_length=80)
    lanes: list[Lane] = Field(min_length=1, max_length=6)


@router.get("/studies/{sid}/playground/tasks")
def playground_tasks(sid: str, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    held = ("test", "ood", "regression")
    rows = [{"task_id": t.task_id, "family": t.family, "split": t.split, "prompt": t.prompt[:200]} for t in s.tasks()
            if t.split not in held or s.state["sealed"]]
    return {"tasks": rows[:400], "sealed": s.state["sealed"]}


@router.post("/studies/{sid}/playground")
def start_playground(sid: str, body: PlayBody, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    if not body.task_id and not (body.prompt or "").strip():
        raise HTTPException(422, "Write a message or pick a task")
    if body.task_id:
        t = next((x for x in s.tasks() if x.task_id == body.task_id), None)
        if t is None:
            raise HTTPException(404, "Unknown task")
        if t.split in ("test", "ood", "regression") and not s.state["sealed"]:
            raise HTTPException(409, "Held-out tasks can be played only after the study is sealed (protects the final test)")
    from forge.agents.safety import scan_text
    if body.prompt and scan_text(body.prompt)["block"]:
        raise HTTPException(422, "The message looks like it contains personal data (SSN, e-mail, phone, MRN). Use synthetic text.")
    lanes = []
    for ln in body.lanes:
        d: dict[str, Any] = {"kind": ln.kind, "label": ln.label or ln.kind}
        if ln.kind == "adapter":
            if ln.arm not in s.plan["arms"] or ln.seed not in s.plan["seeds"]:
                raise HTTPException(422, "Unknown arm/seed for this study")
            d |= {"arm": ln.arm, "seed": ln.seed}
        if ln.kind == "variant":
            v = _variant(st, ln.variant or "")
            if v.recipe.get("base_hash") and v.recipe["base_hash"] != s.plan.get("base_hash"):
                raise HTTPException(422, "That variant was built for a different student model")
            d |= {"path": str(v.root)}
        lanes.append(d)
    cfg = {"prompt": body.prompt, "task_id": body.task_id, "lanes": lanes}
    needs_gpu = any(x["kind"] != "teacher" for x in lanes) or True  # the teacher shares the GPU through LM Studio
    try:
        return st.jobs.start("playground", ["playground", "--study", str(s.root), "--config", json.dumps(cfg)], gpu=needs_gpu,
                             study_id=sid, label=f"{s.plan['name']} · playground", env=_cpu_env(s))
    except JobError as e:
        raise HTTPException(409, str(e))


# ------------------------------------------------------------------ stress tests
class StressBody(BaseModel):
    lanes: list[Lane] = Field(min_length=1, max_length=4)
    split: Literal["dev", "test"] = "dev"
    kinds: list[Literal["typos", "reworded", "noise", "injection"]] = Field(default_factory=lambda: ["typos", "reworded", "noise", "injection"], min_length=1)
    limit: int = Field(24, ge=4, le=200)


def _lanes(st: AppState, s: Any, lanes: list[Lane]) -> list[dict]:
    out = []
    for ln in lanes:
        d: dict[str, Any] = {"kind": ln.kind, "label": ln.label or ln.kind}
        if ln.kind == "adapter":
            if ln.arm not in s.plan["arms"] or ln.seed not in s.plan["seeds"]:
                raise HTTPException(422, "Unknown arm/seed for this study")
            d |= {"arm": ln.arm, "seed": ln.seed}
        if ln.kind == "variant":
            v = _variant(st, ln.variant or "")
            if v.recipe.get("base_hash") and v.recipe["base_hash"] != s.plan.get("base_hash"):
                raise HTTPException(422, "That variant was built for a different student model")
            d |= {"path": str(v.root)}
        out.append(d)
    return out


@router.post("/studies/{sid}/stress")
def start_stress(sid: str, body: StressBody, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    if body.split == "test" and not s.state["sealed"]:
        raise HTTPException(409, "Test tasks can be stress-tested only after the study is sealed (protects the final test)")
    cfg = {"lanes": _lanes(st, s, body.lanes), "split": body.split, "kinds": body.kinds, "limit": body.limit}
    try:
        return st.jobs.start("stress", ["stress", "--study", str(s.root), "--config", json.dumps(cfg)], gpu=True,
                             study_id=sid, label=f"{s.plan['name']} · stress test", env=_cpu_env(s))
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("/studies/{sid}/stress")
def list_stress(sid: str, st: AppState = Depends(get_state)):
    d = _study(st, sid).root / "stress"
    out = []
    for p in sorted(d.glob("stress_*.json"), key=lambda p: p.stat().st_mtime, reverse=True) if d.is_dir() else []:
        try:
            r = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        out.append({k: r[k] for k in ("id", "created_at", "split", "kinds", "tasks", "examples", "honesty")} |
                   {"lanes": [{k: l[k] for k in ("label", "n", "original", "perturbations", "per_skill")} for l in r["lanes"]]})
    return out


@router.get("/studies/{sid}/playground")
def list_runs(sid: str, st: AppState = Depends(get_state)):
    d = _study(st, sid).root / "playground"
    rows = []
    for p in sorted(d.glob("play_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:30] if d.is_dir() else []:
        r = json.loads(p.read_text(encoding="utf-8"))
        rows.append({"id": r["id"], "created_at": r["created_at"], "prompt": r["prompt"][:160], "lanes": [l["label"] for l in r["lanes"]]})
    return rows


@router.get("/studies/{sid}/playground/{rid}")
def get_run(sid: str, rid: str, st: AppState = Depends(get_state)):
    if not RID.match(rid):
        raise HTTPException(422, "Invalid run id")
    p = _study(st, sid).root / "playground" / f"{rid}.json"
    if not p.exists():
        raise HTTPException(404, "Run not found")
    return json.loads(p.read_text(encoding="utf-8"))


class DecisionBody(BaseModel):
    study_id: str = Field(pattern=r"^study_[a-f0-9]+$")
    run_id: str = Field(pattern=r"^play_[a-f0-9]+$")
    lane: str = Field(max_length=60)
    decision: Literal["accept", "override"]
    correct_answer: str | None = Field(None, max_length=500)
    reviewer: str = Field(min_length=1, max_length=60)
    note: str = Field("", max_length=500)


@router.post("/decisions")
def record_decision(body: DecisionBody, st: AppState = Depends(get_state)):
    """A person accepts the agent's recommendation or overrides it. Recorded locally; overrides can become new examples."""
    run = get_run(body.study_id, body.run_id, st)
    lane = next((l for l in run["lanes"] if l["label"] == body.lane), None)
    if lane is None:
        raise HTTPException(404, "Unknown lane")
    if body.decision == "override" and not (body.correct_answer or "").strip():
        raise HTTPException(422, "Enter the correct answer to override")
    row = {"at": utcnow(), "study_id": body.study_id, "run_id": body.run_id, "lane": body.lane, "model": lane["model"],
           "prompt": run["prompt"], "agent_answer": lane["answer"], "evidence": lane.get("evidence"), "decision": body.decision,
           "correct_answer": (body.correct_answer or "").strip() or None, "reviewer": " ".join(body.reviewer.split()), "note": body.note}
    with open(st.settings.home / "decisions.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return row


@router.get("/decisions")
def decisions(study_id: str | None = None, st: AppState = Depends(get_state)):
    p = st.settings.home / "decisions.jsonl"
    rows = [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x] if p.exists() else []
    if study_id:
        rows = [r for r in rows if r["study_id"] == study_id]
    stats: dict[str, dict[str, int]] = {}
    for r in rows:
        s = stats.setdefault(r["lane"], {"accept": 0, "override": 0})
        s[r["decision"]] += 1
    return {"decisions": rows[-200:][::-1], "by_lane": stats}


# ------------------------------------------------------------------ weight lab
class Source(BaseModel):
    study_id: str = Field(pattern=r"^study_[a-f0-9]+$")
    arm: str = Field(pattern=r"^[a-z0-9_]{1,40}$")
    seed: int = Field(ge=0, le=99)
    weight: float = Field(1.0, ge=-2.0, le=2.0)


class VariantBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    sources: list[Source] = Field(min_length=1, max_length=8)
    strength: float = Field(1.0, ge=0.0, le=3.0)
    layers: tuple[int, int] | None = None
    modules: Literal["all", "attention", "mlp"] = "all"
    rank: int | None = Field(None, ge=1, le=512)


@router.get("/weightlab")
def list_variants(st: AppState = Depends(get_state)):
    from forge.engine.weightlab import Variant, WeightLabError
    out = []
    for d in sorted(_wl(st).iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            out.append(Variant(d).summary())
        except (WeightLabError, json.JSONDecodeError):
            continue
    return out


@router.post("/weightlab")
def create_variant(body: VariantBody, st: AppState = Depends(get_state)):
    from forge.engine.weightlab import create_variant as cv
    srcs, base_hash, student = [], None, None
    for s_ in body.sources:
        s = _study(st, s_.study_id)
        if s_.arm not in s.plan["arms"] or s_.seed not in s.plan["seeds"]:
            raise HTTPException(422, f"{s.plan['name']}: unknown arm/seed")
        ad = s.run_dir(s_.arm, s_.seed) / "adapter"
        if not (ad / "adapter_model.safetensors").exists():
            raise HTTPException(409, f"{s.plan['name']}: {s_.arm} seed {s_.seed} is not trained yet")
        if base_hash and s.plan.get("base_hash") != base_hash:
            raise HTTPException(422, "All sources must be trained on the same student model (base hashes differ)")
        base_hash, student = s.plan.get("base_hash"), s.plan["student"].get("name")
        srcs.append({"adapter": str(ad), "weight": s_.weight, "study_id": s_.study_id, "study_name": s.plan["name"], "arm": s_.arm, "seed": s_.seed})
    if body.layers and body.layers[0] > body.layers[1]:
        raise HTTPException(422, "Layer range: first ≤ last")
    v = cv(_wl(st), body.name, {"sources": srcs, "strength": body.strength, "layers": list(body.layers) if body.layers else None,
                                "modules": body.modules, "rank": body.rank, "base_hash": base_hash, "student": student})
    try:
        job = st.jobs.start("weightlab:build", ["weightlab", "--variant", str(v.root), "--step", "build"], gpu=False,
                            study_id=v.recipe["id"], label=f"Weight Lab · build {body.name}")
    except JobError as e:
        raise HTTPException(409, str(e))
    return {"variant": v.summary(), "job": job}


class EvalBody(BaseModel):
    study_id: str = Field(pattern=r"^study_[a-f0-9]+$")


@router.post("/weightlab/{vid}/evaluate")
def evaluate_variant(vid: str, body: EvalBody, st: AppState = Depends(get_state)):
    v = _variant(st, vid)
    if v.recipe.get("status") != "built":
        raise HTTPException(409, "Build the variant first")
    s = _study(st, body.study_id)
    if v.recipe.get("base_hash") and s.plan.get("base_hash") and v.recipe["base_hash"] != s.plan["base_hash"]:
        raise HTTPException(422, "That study uses a different student model")
    try:
        return st.jobs.start("weightlab:evaluate", ["weightlab", "--variant", str(v.root), "--step", "evaluate", "--study", str(s.root)],
                             gpu=True, study_id=vid, label=f"Weight Lab · evaluate {v.recipe['name']} on {s.plan['name']}", env=_cpu_env(s))
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("/weightlab/{vid}")
def get_variant(vid: str, st: AppState = Depends(get_state)):
    v = _variant(st, vid)
    return {**v.summary(), "jobs": st.jobs.list(10, study_id=vid)}


@router.delete("/weightlab/{vid}")
def delete_variant(vid: str, st: AppState = Depends(get_state)):
    import shutil
    v = _variant(st, vid)
    if any(j["status"] == "running" for j in st.jobs.list(10, study_id=vid)):
        raise HTTPException(409, "A job is using this variant")
    shutil.rmtree(v.root)
    return {"ok": True}
