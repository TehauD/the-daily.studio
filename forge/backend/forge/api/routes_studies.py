"""Study routes — thin: validation and routing only. Every stage runs as a subprocess job."""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from forge.api.state import AppState, get_state
from forge.engine.study import GPU_STAGES, PROFILES, STAGES, TRAIN_ARMS, Study, StudyError, read_jsonl
from forge.engine.train import model_hash
from forge.graphs import knowledge
from forge.graphs.lineage import lineage
from forge.graphs.paths import compare, outcome, path_graph
from forge.hardware.probe import probe_torch
from forge.jobs.runner import JobError
from forge.registry.registry import RegistryError
from forge.security.paths import PathSecurityError, safe_join
from forge.util import sha256_file

router = APIRouter(prefix="/api/studies", tags=["studies"])


def _study(st: AppState, sid: str) -> Study:
    row = st.db.one("SELECT path FROM studies WHERE id = ?", (sid,))
    if not row:
        raise HTTPException(404, f"Unknown study {sid}")
    try:
        return Study(Path(row["path"]))
    except StudyError as e:
        raise HTTPException(409, str(e))


@router.get("/catalog")
def catalog():
    return {"profiles": {k: {"seeds": v["seeds"], "purpose": v["purpose"], "train": v["train"], "taskset": v["taskset"]}
                         for k, v in PROFILES.items()},
            "arms": {k: v for k, v in TRAIN_ARMS.items()}, "stages": STAGES, "gpu_stages": sorted(GPU_STAGES),
            "mvp_arms": ["teacher_filtered"]}


@router.get("")
def list_studies(st: AppState = Depends(get_state)):
    out = []
    for r in st.db.query("SELECT * FROM studies ORDER BY created_at DESC"):
        try:
            s = Study(Path(r["path"]))
            summ = s.summary()
            out.append({"id": r["id"], "name": r["name"], "profile": r["profile"], "created_at": r["created_at"],
                        "next_stage": summ["next_stage"], "sealed": summ["state"]["sealed"],
                        "stages": {k: v["status"] for k, v in summ["state"]["stages"].items()},
                        "teacher": s.plan["teacher"]["model"], "student": s.plan["student"]["name"],
                        "arms": s.plan["arms"], "seeds": s.plan["seeds"]})
        except StudyError as e:
            out.append({"id": r["id"], "name": r["name"], "error": str(e)})
    return out


class CreateStudy(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    profile: Literal["smoke", "pilot", "research"] = "smoke"
    teacher_id: str
    student_id: str
    arms: list[str] = Field(default_factory=lambda: ["teacher_filtered"])
    seeds: list[int] | None = None
    min_gain: float = Field(0.05, ge=0, le=1)
    max_steps: int | None = Field(None, ge=1, le=100000)
    epochs: float | None = Field(None, gt=0, le=50)
    max_seq_len: int | None = Field(None, ge=256, le=32768)
    device: Literal["cuda", "cpu"] = "cuda"


def _teacher_spec(st: AppState, t: dict) -> dict[str, Any]:
    if t["provider"] == "ollama":
        return {"provider": "ollama", "endpoint": st.settings.ollama_url, "model": t["name"], "model_id": t["id"]}
    if t["provider"] == "lmstudio":
        mid = t["metadata"].get("lmstudio_id") or t["name"]
        return {"provider": "lmstudio", "endpoint": st.settings.lmstudio_url + "/v1", "model": mid, "model_id": t["id"]}
    if t["provider"].startswith("endpoint:"):
        ep = t["metadata"].get("endpoint")
        return {"provider": t["provider"], "endpoint": ep, "model": t["name"], "model_id": t["id"],
                "allow_remote": any(e["base_url"].rstrip("/").removesuffix("/v1") == ep and e.get("allow_remote")
                                    for e in st.db.get_setting("endpoints", []))}
    raise HTTPException(422, f"Teacher provider {t['provider']} cannot serve chat; use LM Studio, Ollama, or an endpoint")


@router.post("")
async def create_study(body: CreateStudy, st: AppState = Depends(get_state)):
    try:
        pc = st.registry.pair_check(body.teacher_id, body.student_id)
        t, s = st.registry.get(body.teacher_id), st.registry.get(body.student_id)
    except RegistryError as e:
        raise HTTPException(404, str(e))
    if pc["verdict"] == "fail":
        raise HTTPException(422, "Pair-check failed: " + "; ".join(c["check"] for c in pc["checks"] if c["status"] == "fail"))
    if s["capabilities"]["lora"]["status"] != "supported" or not s["storage_path"]:
        raise HTTPException(422, "Student must have supported LoRA (local, complete safetensors)")
    if body.device == "cpu" and os.environ.get("FORGE_ALLOW_CPU") != "1":
        raise HTTPException(422, "CPU studies are wiring tests only; set FORGE_ALLOW_CPU=1 to permit them")
    student_dir = Path(s["storage_path"])
    base_hash = await asyncio.to_thread(model_hash, student_dir, st.settings.home / "hash_cache.json")
    torch = probe_torch()
    env = {"python": torch.python_executable, "torch": torch.version, "cuda_build": torch.cuda_build,
           "numpy": torch.numpy_version, "bf16": torch.bf16_supported}
    train_ov = {k: v for k, v in (("max_steps", body.max_steps), ("epochs", body.epochs),
                                  ("max_seq_len", body.max_seq_len)) if v is not None}
    try:
        study = Study.init(st.settings.studies_dir, name=body.name, profile=body.profile, teacher=_teacher_spec(st, t),
                           student={"model_id": s["id"], "name": s["name"], "path": str(student_dir),
                                    "parameter_report": s["metadata"].get("parameter_report")},
                           arms=body.arms, seeds=body.seeds, train_overrides=train_ov, min_gain=body.min_gain,
                           device=body.device, environment=env, base_hash=base_hash)
    except StudyError as e:
        raise HTTPException(422, str(e))
    with st.db.tx() as c:
        c.execute("INSERT INTO studies(id, name, path, profile, created_at) VALUES (?,?,?,?,?)",
                  (study.plan["study_id"], body.name, str(study.root), body.profile, study.plan["created_at"]))
    return {**study.summary(), "pair_check": pc}


@router.get("/{sid}")
def get_study(sid: str, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    return {**s.summary(), "jobs": st.jobs.list(20, study_id=sid)}


class StageBody(BaseModel):
    confirm: str | None = None


@router.post("/{sid}/stages/{stage}")
def run_stage(sid: str, stage: str, body: StageBody, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    try:
        s.check_can_run(stage)
    except StudyError as e:
        raise HTTPException(409, str(e))
    if stage == "seal" and body.confirm != "SEAL":
        raise HTTPException(422, "Type SEAL to confirm. After sealing, no further training is permitted.")
    args = ["stage", "--study", str(s.root), "--stage", stage, "--hash-cache", str(st.settings.home / "hash_cache.json")]
    if body.confirm:
        args += ["--confirm", body.confirm]
    env = {"FORGE_ALLOW_CPU": "1"} if s.plan["device"] == "cpu" and os.environ.get("FORGE_ALLOW_CPU") == "1" else None
    try:
        # collect is GPU-exclusive too: the teacher occupies the same GPU through LM Studio/Ollama.
        return st.jobs.start(f"stage:{stage}", args, gpu=stage in GPU_STAGES or stage == "collect", study_id=sid,
                             label=f"{s.plan['name']} · {stage}", env=env)
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("/{sid}/episodes")
def episodes(sid: str, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    out = []
    for arm, split, seed, path in s.iter_episode_files():
        for e in read_jsonl(path, verify=False):
            out.append({"arm": arm, "split": split, "seed": seed, "task_id": e["task_id"], "family": e["family"],
                        "group_id": e["group_id"], "strict_success": e["score"]["strict_success"],
                        "answer_correct": e["score"]["answer_correct"], "calls": e["score"]["call_count"],
                        "invalid": e["score"]["invalid_calls"], "termination": e["termination"],
                        "latency_ms": e["usage"]["latency_ms"], "trace_hash": e["trace_hash"]})
    return out


@router.get("/{sid}/episode")
def episode(sid: str, arm: str, split: str, seed: int, task_id: str, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    for e in s.episodes(arm, split, seed):
        if e["task_id"] == task_id:
            return {"episode": e, "graph": path_graph(e)}
    raise HTTPException(404, "episode not found")


def _find(s: Study, arm: str, split: str, seed: int, task_id: str) -> dict | None:
    return next((e for e in s.episodes(arm, split, seed) if e["task_id"] == task_id), None)


@router.get("/{sid}/compare")
def compare_paths(sid: str, split: str, task_id: str, arm: str | None = None, seed: int | None = None,
                  st: AppState = Depends(get_state)):
    s = _study(st, sid)
    arm = arm or s.plan["arms"][0]
    seed = s.plan["seeds"][0] if seed is None else seed
    c0 = s.plan["eval"]["control_seed_broadcast"]
    return compare(_find(s, "teacher", split, 0, task_id), _find(s, "base", split, c0, task_id),
                   _find(s, arm, split, seed, task_id))


@router.get("/{sid}/changes")
def changes(sid: str, split: str = "dev", arm: str | None = None, seed: int | None = None,
            st: AppState = Depends(get_state)):
    """Per-task outcome table (fixed / regressed / unchanged) for base → tuned."""
    s = _study(st, sid)
    arm = arm or s.plan["arms"][0]
    seed = s.plan["seeds"][0] if seed is None else seed
    base = {e["task_id"]: e for e in s.episodes("base", split, s.plan["eval"]["control_seed_broadcast"])}
    teacher = {e["task_id"]: e for e in s.episodes("teacher", split, 0)}
    rows = []
    for e in s.episodes(arm, split, seed):
        b = base.get(e["task_id"])
        rows.append({"task_id": e["task_id"], "family": e["family"], "group_id": e["group_id"],
                     "outcome": outcome(b, e), "base": b["score"]["strict_success"] if b else None,
                     "tuned": e["score"]["strict_success"],
                     "teacher": teacher[e["task_id"]]["score"]["strict_success"] if e["task_id"] in teacher else None})
    counts = {k: sum(r["outcome"] == k for r in rows) for k in ("fixed", "regressed", "unchanged", "incomplete")}
    return {"arm": arm, "seed": seed, "split": split, "counts": counts, "rows": rows}


@router.get("/{sid}/lineage")
def get_lineage(sid: str, st: AppState = Depends(get_state)):
    return lineage(_study(st, sid).root)


@router.get("/{sid}/knowledge")
def knowledge_graph(sid: str, view: str = "auto", format: Literal["json", "graphml"] = "json",
                    st: AppState = Depends(get_state)):
    s = _study(st, sid)
    rows = {}
    for key in ("teacher", "student"):
        mid = s.plan[key].get("model_id")
        if mid:
            try:
                rows[mid] = st.registry.get(mid)
            except RegistryError:
                pass  # model since purged from the registry; the frozen plan still names it
    try:
        g = knowledge.build(s, view, rows)
    except ValueError as e:
        raise HTTPException(422, str(e))
    if format == "graphml":
        return PlainTextResponse(knowledge.to_graphml(g), media_type="application/xml",
                                 headers={"Content-Disposition": f'attachment; filename="forge-{sid}.graphml"'})
    return g


@router.get("/{sid}/training")
def training(sid: str, arm: str, seed: int, st: AppState = Depends(get_state)):
    rd = _study(st, sid).run_dir(arm, seed)
    rows = []
    if (rd / "training.jsonl").exists():
        rows = [json.loads(line) for line in (rd / "training.jsonl").read_text(encoding="utf-8").splitlines() if line]
    run = json.loads((rd / "run.json").read_text(encoding="utf-8")) if (rd / "run.json").exists() else None
    return {"rows": rows, "run": run, "computed": True}


@router.get("/{sid}/inspection")
def inspection(sid: str, arm: str, seed: int, st: AppState = Depends(get_state)):
    p = _study(st, sid).run_dir(arm, seed) / "inspection.json"
    if not p.exists():
        raise HTTPException(404, "No inspection yet (train this arm first)")
    return json.loads(p.read_text(encoding="utf-8"))


@router.get("/{sid}/datasets")
def datasets(sid: str, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    out = []
    for arm in s.plan["arms"]:
        mp = s.root / "datasets" / arm / "manifest.json"
        if mp.exists():
            out.append(json.loads(mp.read_text(encoding="utf-8")))
    return out


@router.get("/{sid}/datasets/{arm}/records")
def dataset_records(sid: str, arm: str, offset: int = 0, limit: int = 50, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    try:
        p = safe_join(s.root / "datasets", arm, "records.jsonl")
    except PathSecurityError as e:
        raise HTTPException(422, str(e))
    if not p.exists():
        raise HTTPException(404, "dataset not built")
    lines = p.read_text(encoding="utf-8").splitlines()
    return {"total": len(lines), "offset": offset, "records": [json.loads(x) for x in lines[offset: offset + min(limit, 200)]]}


@router.post("/{sid}/datasets/{arm}/verify")
def verify_dataset(sid: str, arm: str, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    try:
        d = safe_join(s.root / "datasets", arm)
    except PathSecurityError as e:
        raise HTTPException(422, str(e))
    m = json.loads((d / "manifest.json").read_text(encoding="utf-8"))
    actual = sha256_file(d / "records.jsonl")
    return {"expected": m["records_sha256"], "actual": actual, "ok": actual == m["records_sha256"]}


@router.get("/{sid}/file", response_class=PlainTextResponse)
def evidence_file(sid: str, path: str, st: AppState = Depends(get_state)):
    """Read-only evidence viewer, confined to the study directory (traversal / symlink escape refused)."""
    s = _study(st, sid)
    try:
        rel = Path(path).resolve().relative_to(s.root.resolve()) if Path(path).is_absolute() else Path(path)
        p = safe_join(s.root, *rel.parts)
    except (ValueError, PathSecurityError) as e:
        raise HTTPException(422, f"Path outside study: {e}")
    if p.is_dir():
        return "\n".join(sorted(x.name + ("/" if x.is_dir() else f"  {x.stat().st_size} B") for x in p.iterdir()))
    if not p.exists() or p.suffix not in (".json", ".jsonl", ".sha256", ".txt", ".log"):
        raise HTTPException(404, "Not a readable evidence file")
    return p.read_text(encoding="utf-8", errors="replace")[:2_000_000]
