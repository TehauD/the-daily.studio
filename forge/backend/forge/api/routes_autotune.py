"""Auto-tune API: the frontier model proposes, a person approves, FORGE applies and measures (see forge.engine.autotune).

Every step is a plain HTTP call, so the loop FORGE runs as a job can equally be driven by your own PowerShell or Python
script against these endpoints."""
from __future__ import annotations

import asyncio
import json
import threading
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from forge.api import routes_assistant as ra
from forge.api.routes_studies import _study
from forge.api.state import AppState, get_state
from forge.assistant.azure import AzureClient, AzureError
from forge.assistant.service import Ledger
from forge.audit import ACTOR_HEADER, clean_actor
from forge.engine import autotune as at
from forge.jobs.runner import JobError
from forge.util import utcnow

router = APIRouter(prefix="/api/autotune", tags=["autotune"])
_LOCK = threading.Lock()


def _base(st: AppState) -> Path:
    d = st.settings.home / "autotune"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _run(st: AppState, rid: str) -> at.Run:
    if not rid.startswith("tune_") or not rid[5:].isalnum():
        raise HTTPException(422, "Invalid run id")
    try:
        return at.Run(_base(st) / rid)
    except at.AutoTuneError as e:
        raise HTTPException(404, str(e))


def _layers(student_path: str) -> int | None:
    try:
        cfg = json.loads((Path(student_path) / "config.json").read_text(encoding="utf-8"))
        return int(cfg.get("num_hidden_layers") or cfg.get("text_config", {}).get("num_hidden_layers"))
    except (OSError, ValueError, TypeError):
        return None


class Start(BaseModel):
    study_id: str = Field(pattern=r"^study_[a-f0-9]+$")
    rounds: int = Field(6, ge=1, le=at.MAX_ROUNDS)
    approve_each: bool = True
    goal: str = Field("", max_length=400)


@router.get("")
def list_runs(study_id: str | None = None, st: AppState = Depends(get_state)):
    out = []
    for d in sorted(_base(st).iterdir(), reverse=True):
        try:
            r = at.Run(d).data
        except (at.AutoTuneError, ValueError):
            continue
        if not study_id or r["study_id"] == study_id:
            out.append({k: r[k] for k in ("id", "study_id", "created_at", "status", "max_rounds", "approve_each", "best")} | {"rounds": len(r["rounds"])})
    return out


@router.post("")
def start(body: Start, request: Request, st: AppState = Depends(get_state)):
    ra._require(st)
    s = _study(st, body.study_id)
    from forge.agents.safety import scan_text
    if body.goal and scan_text(body.goal)["block"]:
        raise HTTPException(422, "The goal looks like it contains personal data")
    if any(r["status"] == "running" for r in list_runs(body.study_id, st)):
        raise HTTPException(409, "An auto-tune run is already active for this study")
    try:
        ctx = at.context_for(s, _layers(s.plan["student"]["path"]))
    except at.AutoTuneError as e:
        raise HTTPException(409, str(e))
    run = at.Run.create(_base(st), body.study_id, body.rounds, body.approve_each, " ".join(body.goal.split()), ctx)
    d = run.data
    d["started_by"] = clean_actor(request.headers.get(ACTOR_HEADER))
    env = {"FORGE_API_URL": f"http://127.0.0.1:{st.settings.port}", "FORGE_SESSION_TOKEN": st.token}
    try:
        job = st.jobs.start("autotune", ["autotune", "--run", d["id"]], gpu=False, study_id=body.study_id,
                            label=f"{s.plan['name']} · auto-tune ({body.rounds} rounds)", env=env)
    except JobError as e:
        d["status"] = "failed"
        run.save(d)
        raise HTTPException(409, str(e))
    d["job_id"] = job["id"]
    run.save(d)
    return d


@router.get("/{rid}")
def get_run(rid: str, st: AppState = Depends(get_state)):
    return _run(st, rid).data


@router.post("/{rid}/propose")
async def propose(rid: str, st: AppState = Depends(get_state)):
    run = _run(st, rid)
    d = run.data
    if d["status"] != "running":
        raise HTTPException(409, "Run is not active")
    if any(r.get("decision") == "pending" for r in d["rounds"]):
        raise HTTPException(409, "A proposal is waiting for a decision")
    cfg = ra._require(st)
    s = _study(st, d["study_id"])
    from forge.engine.governance import failures
    arm = s.plan["arms"][0]
    fr = next((r for r in failures(s)["rows"] if r["arm"] == arm and r["split"] == "dev"), None)
    msgs = at.build_messages(d, fr["types"] if fr else {})
    ledger = Ledger(st.settings.home)
    n = len(d["rounds"]) + 1
    try:
        res = await asyncio.to_thread(AzureClient(cfg, ra.TRANSPORT).chat, msgs, 700)
    except AzureError as e:
        ledger.record("autotune", rid, msgs, False, cfg.deployment, None, str(e), f"auto-tune round {n}")
        raise HTTPException(e.status, str(e))
    ledger.record("autotune", rid, msgs, False, cfg.deployment, res, None, f"auto-tune round {n}")
    with _LOCK:
        d = run.data
        entry = {"round": n, "at": utcnow(), "model": res.get("model") or cfg.deployment}
        try:
            p = at.parse_proposal(res["text"], d)
            entry |= p
            entry["decision"] = "stop" if p["action"] == "stop" else ("pending" if d["approve_each"] else "approved")
            if entry["decision"] == "approved":
                entry["decided_by"] = f"auto-approve (run started by {d.get('started_by', 'unnamed')})"
        except at.AutoTuneError as e:
            entry |= {"action": "invalid", "rationale": "", "recipe": None, "decision": "invalid", "error": str(e)}
        d["rounds"].append(entry)
        run.save(d)
    return entry


class Decision(BaseModel):
    round: int = Field(ge=1)
    decision: str = Field(pattern=r"^(approved|rejected)$")
    note: str = Field("", max_length=400)


@router.post("/{rid}/decision")
def decide(rid: str, body: Decision, request: Request, st: AppState = Depends(get_state)):
    run = _run(st, rid)
    with _LOCK:
        d = run.data
        r = next((x for x in d["rounds"] if x["round"] == body.round), None)
        if not r or r.get("decision") != "pending":
            raise HTTPException(409, "That proposal is not waiting for a decision")
        r |= {"decision": body.decision, "decided_by": clean_actor(request.headers.get(ACTOR_HEADER)), "decided_at": utcnow(),
              "note": " ".join(body.note.split())}
        run.save(d)
    return r


class Result(BaseModel):
    round: int = Field(ge=1)
    variant_id: str = Field(pattern=r"^var_[a-f0-9]+$")


@router.post("/{rid}/result")
def record_result(rid: str, body: Result, st: AppState = Depends(get_state)):
    run = _run(st, rid)
    from forge.engine.weightlab import Variant, WeightLabError
    d = run.data
    try:
        ev = Variant(st.settings.home / "weightlab" / body.variant_id).evaluations().get(d["study_id"])
    except WeightLabError as e:
        raise HTTPException(404, str(e))
    if not ev:
        raise HTTPException(409, "The variant has not been evaluated on this study")
    with _LOCK:
        d = run.data
        r = next((x for x in d["rounds"] if x["round"] == body.round and x.get("decision") == "approved"), None)
        if not r:
            raise HTTPException(409, "No approved proposal with that round")
        r |= {"variant_id": body.variant_id, "result": at.score_result(ev, d["context"]["baseline"])}
        d["best"] = at.pick_best(d["rounds"])
        run.save(d)
    return r


@router.post("/{rid}/stop")
def stop(rid: str, st: AppState = Depends(get_state)):
    run = _run(st, rid)
    with _LOCK:
        d = run.data
        d["stop_requested"] = True
        for r in d["rounds"]:
            if r.get("decision") == "pending":
                r["decision"] = "rejected"
                r["note"] = "run stopped"
        run.save(d)
    return d


@router.post("/{rid}/finish")
def finish(rid: str, failed: bool = False, st: AppState = Depends(get_state)):
    run = _run(st, rid)
    with _LOCK:
        d = run.data
        if d["status"] == "running":
            d["status"] = "failed" if failed else "stopped" if d.get("stop_requested") else "completed"
        d["best"] = at.pick_best(d["rounds"])
        tried = sum(1 for r in d["rounds"] if r.get("result"))
        d["caution"] = (f"Best of {tried} variants chosen on the same practice (dev) tasks: its dev score is optimistic. "
                        "Confirm with a new study's sealed test before relying on it.") if tried > 1 else None
        d["finished_at"] = utcnow()
        run.save(d)
    return d
