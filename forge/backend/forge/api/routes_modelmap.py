"""Model Map API: decision graph (from episodes), representation map and word view (engine jobs)."""
from __future__ import annotations

import json
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from forge.api.state import AppState, get_state
from forge.jobs.runner import JobError

router = APIRouter(prefix="/api/studies/{sid}/modelmap", tags=["modelmap"])
HELD_OUT = ("test", "ood", "regression")
EID = re.compile(r"^expl_[a-f0-9]+$")


def _study(st: AppState, sid: str):
    from forge.api.routes_studies import _study as s
    return s(st, sid)


def _split_ok(s, split: str) -> None:
    if split not in ("train", "dev", *HELD_OUT):
        raise HTTPException(422, "Unknown split")
    if split in HELD_OUT and not s.state["sealed"]:
        raise HTTPException(409, "Held-out splits are shown only after the study is sealed (protects the final test)")


def _labels(s) -> dict[str, str]:
    from forge.graphs.knowledge import SKILL_LABEL
    agent = s.plan["taskset"].get("agent") or {}
    return {**SKILL_LABEL, **{k["id"]: k["name"] for k in agent.get("skills", [])}}


def _cpu_env(s):
    import os
    return {"FORGE_ALLOW_CPU": "1"} if s.plan["device"] == "cpu" and os.environ.get("FORGE_ALLOW_CPU") == "1" else None


@router.get("/decisions")
def decisions(sid: str, split: str = "dev", model: str = "teacher", st: AppState = Depends(get_state)):
    from forge.engine.study import read_jsonl
    from forge.graphs.decisions import build
    s = _study(st, sid)
    _split_ok(s, split)
    models = [{"key": "teacher", "label": "teacher"}, {"key": "base", "label": "untrained student"}] + \
             [{"key": f"{a}:{sd}", "label": f"{a} · seed {sd}"} for a in s.plan["arms"] for sd in s.plan["seeds"]]
    if model == "teacher":
        arm, seed = "teacher", 0
    elif model == "base":
        arm, seed = "base", s.plan["eval"]["control_seed_broadcast"]
    else:
        arm, _, sd = model.partition(":")
        if arm not in s.plan["arms"] or not sd.isdigit() or int(sd) not in s.plan["seeds"]:
            raise HTTPException(422, "Unknown model")
        seed = int(sd)
    p = s.episode_path(arm, split, seed)
    eps = read_jsonl(p, verify=False) if p.exists() else []
    return {"split": split, "model": model, "models": models, "available": bool(eps), **(build(eps, _labels(s)) if eps else {})}


class MapBody(BaseModel):
    split: str = "dev"
    arm: str | None = Field(None, pattern=r"^[a-z0-9_]{1,40}$")
    seed: int | None = Field(None, ge=0, le=99)


@router.post("/map")
def start_map(sid: str, body: MapBody, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    _split_ok(s, body.split)
    arm = body.arm or s.plan["arms"][0]
    seed = s.plan["seeds"][0] if body.seed is None else body.seed
    if arm not in s.plan["arms"] or seed not in s.plan["seeds"]:
        raise HTTPException(422, "Unknown arm/seed")
    if not (s.run_dir(arm, seed) / "adapter" / "adapter_model.safetensors").exists():
        raise HTTPException(409, "Train the study first: the map compares the untrained and the trained student")
    try:
        return st.jobs.start("modelmap:map", ["modelmap", "--study", str(s.root), "--step", "map", "--config",
                                              json.dumps({"split": body.split, "arm": arm, "seed": seed})],
                             gpu=True, study_id=sid, label=f"{s.plan['name']} · model map ({body.split})", env=_cpu_env(s))
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("/map")
def get_map(sid: str, split: str = "dev", arm: str | None = None, seed: int | None = None, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    _split_ok(s, split)
    arm = arm or s.plan["arms"][0]
    seed = s.plan["seeds"][0] if seed is None else seed
    if not re.fullmatch(r"[a-z0-9_]{1,40}", arm):
        raise HTTPException(422, "Invalid arm")
    p = s.root / "modelmap" / f"map_{split}_{arm}_s{int(seed)}.json"
    if not p.exists():
        return {"available": False, "trained": (s.run_dir(arm, seed) / "adapter" / "adapter_model.safetensors").exists()}
    return {"available": True, **json.loads(p.read_text(encoding="utf-8"))}


class ExplainBody(BaseModel):
    task_id: str | None = Field(None, max_length=80)
    prompt: str | None = Field(None, max_length=2000)
    model: str = Field("trained", pattern=r"^(trained|untrained)$")
    arm: str | None = Field(None, pattern=r"^[a-z0-9_]{1,40}$")
    seed: int | None = Field(None, ge=0, le=99)


@router.post("/explain")
def start_explain(sid: str, body: ExplainBody, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    if not body.task_id and not (body.prompt or "").strip():
        raise HTTPException(422, "Pick a task or write a message")
    if body.task_id:
        t = next((x for x in s.tasks() if x.task_id == body.task_id), None)
        if t is None:
            raise HTTPException(404, "Unknown task")
        _split_ok(s, t.split)
    from forge.agents.safety import scan_text
    if body.prompt and scan_text(body.prompt)["block"]:
        raise HTTPException(422, "The message looks like it contains personal data. Use synthetic text.")
    try:
        return st.jobs.start("modelmap:explain", ["modelmap", "--study", str(s.root), "--step", "explain", "--config", body.model_dump_json()],
                             gpu=True, study_id=sid, label=f"{s.plan['name']} · word view", env=_cpu_env(s))
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("/explain")
def list_explains(sid: str, st: AppState = Depends(get_state)):
    d = _study(st, sid).root / "modelmap"
    rows = []
    for p in sorted(d.glob("expl_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:20] if d.is_dir() else []:
        r = json.loads(p.read_text(encoding="utf-8"))
        rows.append({"id": r["id"], "generated_at": r["generated_at"], "prompt": r["prompt"][:160], "model": r["model"], "task_id": r["task_id"]})
    return rows


@router.get("/explain/{eid}")
def get_explain(sid: str, eid: str, st: AppState = Depends(get_state)):
    if not EID.match(eid):
        raise HTTPException(422, "Invalid id")
    p = _study(st, sid).root / "modelmap" / f"{eid}.json"
    if not p.exists():
        raise HTTPException(404, "Not found")
    return json.loads(p.read_text(encoding="utf-8"))
