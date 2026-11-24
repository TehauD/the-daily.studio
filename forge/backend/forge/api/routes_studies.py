"""Study routes — thin: validation and routing only. Every stage runs as a subprocess job."""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Annotated, Any, Literal

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
            "mvp_arms": ["teacher_filtered"],
            # Trainable skills per task-set kind (focus selection); regression-only skills are evaluated, never trained.
            "skills": {"catalog": [{"id": f, "label": knowledge.SKILL_LABEL[f]} for f in ("catalog_lookup", "multi_step_quote", "missing_item")],
                       "docqa": [{"id": f, "label": knowledge.SKILL_LABEL[f]} for f in ("doc_answerable", "doc_unanswerable")]}}


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
                        "arms": s.plan["arms"], "seeds": s.plan["seeds"],
                        "knowledge_pack": (s.plan["taskset"].get("pack") or {}).get("id"),
                        "focus_skills": (s.plan.get("focus") or {}).get("skills"),
                        "agent": (s.plan["taskset"].get("agent") or {}).get("id")})
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
    turbo: dict[str, Any] | None = None
    micro_batch: int | None = Field(None, ge=1, le=64)
    grad_accum: int | None = Field(None, ge=1, le=256)
    knowledge_pack_id: str | None = Field(None, pattern=r"^pack_[a-z0-9]+$")
    agent_id: str | None = Field(None, pattern=r"^agent_[a-z0-9]+$")
    require_review: bool = False
    focus_skills: list[Annotated[str, Field(pattern=r"^[a-z_]{1,40}$")]] | None = Field(None, max_length=10)


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


def vram_gate(s: dict, seq_len: int) -> dict[str, Any]:
    """Free-VRAM pre-flight threshold derived from the analytic estimate (×1.1, ≥ 2 GB) instead of a fixed
    12 GB, which sat too close to a 16 GB desktop GPU's idle free memory. Frozen into the plan with its basis."""
    import math
    from forge.hardware.profiles import EstimateInput, estimate_lora_memory
    md = s.get("metadata") or {}
    unique = (md.get("parameter_report") or {}).get("unique_total") or s.get("parameter_count")
    if not unique:
        return {}
    est = estimate_lora_memory(EstimateInput(
        params_b=unique / 1e9, quant="bf16", seq_len=seq_len, hidden=md.get("hidden_size"), layers=md.get("num_hidden_layers"),
        intermediate=md.get("intermediate_size"), vocab=md.get("vocab_size"), num_heads=md.get("num_attention_heads"),
        num_kv_heads=md.get("num_key_value_heads"), head_dim=md.get("head_dim")), None)
    gate = max(2048, int(math.ceil(est.total_mb * 1.1 / 256) * 256))
    return {"min_free_vram_mb": gate, "min_free_vram_basis": f"analytic estimate {est.total_mb:.0f} MB × 1.1 at seq {seq_len}"}


def _turbo(turbo: dict | None, device: str, micro_batch: int, torch_info: Any) -> dict:
    from forge.engine import turbo as tb
    try:
        t = tb.validate(turbo, device, micro_batch, availability=tb.probe(cuda=bool(torch_info.cuda_available), torch_version=torch_info.version))
    except tb.TurboError as e:
        raise HTTPException(422, f"Turbo: {e}")
    return {k: v for k, v in t.items() if k != "note"}


@router.get("/turbo/options")
def turbo_options():
    from forge.engine import turbo as tb
    torch = probe_torch()
    return {"defaults": tb.DEFAULTS, "choices": tb.CHOICES, "labels": tb.LABELS,
            "availability": tb.probe(cuda=bool(torch.cuda_available), torch_version=torch.version)}


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
    train_ov.update(vram_gate(s, train_ov.get("max_seq_len", 2048)))
    for k in ("micro_batch", "grad_accum"):
        if getattr(body, k) is not None:
            train_ov[k] = getattr(body, k)
    train_ov["turbo"] = _turbo(body.turbo, body.device, train_ov.get("micro_batch", 1), torch)
    pack = None
    if body.knowledge_pack_id:
        from forge.knowledge.pack import KnowledgePack, PackError
        try:
            pack = KnowledgePack(st.settings.home / "knowledge" / body.knowledge_pack_id)
        except PackError as e:
            raise HTTPException(404, str(e))
        if pack.meta["steps"].get("questions", {}).get("status") != "completed":
            raise HTTPException(409, "This knowledge pack has no verified questions yet")
    agent = None
    if body.agent_id:
        if pack is not None:
            raise HTTPException(422, "Choose either a knowledge pack or an agent, not both")
        from forge.agents.agent import Agent, AgentError
        try:
            agent = Agent(st.settings.home / "agents" / body.agent_id)
        except AgentError as e:
            raise HTTPException(404, str(e))
    try:
        study = Study.init(st.settings.studies_dir, name=body.name, profile=body.profile, teacher=_teacher_spec(st, t),
                           student={"model_id": s["id"], "name": s["name"], "path": str(student_dir),
                                    "parameter_report": s["metadata"].get("parameter_report")},
                           arms=body.arms, seeds=body.seeds, train_overrides=train_ov, min_gain=body.min_gain,
                           device=body.device, environment=env, base_hash=base_hash, knowledge_pack=pack,
                           focus_skills=body.focus_skills, agent=agent, require_review=body.require_review)
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


@router.get("/{sid}/projection")
async def token_projection(sid: str, arm: str, seed: int, layers: int = 4, k: int = 12, st: AppState = Depends(get_state)):
    """Heuristic token projection of the adapter's residual-writing directions. Cached per adapter hash."""
    from forge.analysis.adapters import AdapterError
    from forge.analysis.projection import PROJECTION_VERSION, project
    s = _study(st, sid)
    if arm not in s.plan["arms"] or seed not in s.plan["seeds"]:
        raise HTTPException(404, "Unknown arm/seed for this study")
    rd = s.run_dir(arm, seed)
    adapter = rd / "adapter" / "adapter_model.safetensors"
    if not adapter.exists():
        raise HTTPException(404, f"No adapter for {arm} seed {seed} yet (run Train)")
    layers, k = max(1, min(layers, 12)), max(3, min(k, 40))
    digest = await asyncio.to_thread(sha256_file, adapter)
    cache = rd / f"token_projection.L{layers}.k{k}.json"
    if cache.exists():
        cached = json.loads(cache.read_text(encoding="utf-8"))
        if cached.get("adapter_sha256") == digest and cached.get("projection_version") == PROJECTION_VERSION:
            return cached
    try:
        res = await asyncio.to_thread(project, rd / "adapter", Path(s.plan["student"]["path"]), layers, k)
    except (AdapterError, FileNotFoundError, KeyError) as e:
        raise HTTPException(422, f"Projection unavailable: {e}")
    res["adapter_sha256"] = digest
    cache.write_text(json.dumps(res), encoding="utf-8")
    return res


class LensBody(BaseModel):
    arm: str
    seed: int


@router.post("/{sid}/lens")
def start_lens(sid: str, body: LensBody, st: AppState = Depends(get_state)):
    """Distillation lens as a GPU job: teacher-forced log-probs of dev teacher actions (base → snapshots → final)."""
    s = _study(st, sid)
    if body.arm not in s.plan["arms"] or body.seed not in s.plan["seeds"]:
        raise HTTPException(404, "Unknown arm/seed for this study")
    if not (s.run_dir(body.arm, body.seed) / "adapter" / "adapter_model.safetensors").exists():
        raise HTTPException(409, f"No adapter for {body.arm} seed {body.seed} yet (run Train)")
    env = {"FORGE_ALLOW_CPU": "1"} if s.plan["device"] == "cpu" and os.environ.get("FORGE_ALLOW_CPU") == "1" else None
    try:
        return st.jobs.start("lens", ["lens", "--study", str(s.root), "--arm", body.arm, "--seed", str(body.seed)],
                             gpu=True, study_id=sid, label=f"{s.plan['name']} · lens {body.arm} s{body.seed}", env=env)
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("/{sid}/lens")
async def get_lens(sid: str, arm: str, seed: int, st: AppState = Depends(get_state)):
    from forge.engine.lens import LENS_VERSION, snapshots
    s = _study(st, sid)
    if arm not in s.plan["arms"] or seed not in s.plan["seeds"]:
        raise HTTPException(404, "Unknown arm/seed for this study")
    rd = s.run_dir(arm, seed)
    adapter = rd / "adapter" / "adapter_model.safetensors"
    avail = {"snapshots": len(snapshots(rd)) - 1 if adapter.exists() else 0, "trained": adapter.exists()}
    p = rd / "lens.json"
    if not p.exists():
        return {"available": False, **avail}
    data = json.loads(p.read_text(encoding="utf-8"))
    stale = data.get("lens_version") != LENS_VERSION or data.get("adapter_sha256") != await asyncio.to_thread(sha256_file, adapter)
    return {"available": True, "stale": stale, **avail, **data}


@router.get("/{sid}/skillspace")
def skill_space(sid: str, split: str = "dev", st: AppState = Depends(get_state)):
    """Per-skill strict success for teacher, base, and every trained run (arm × seed), from the episodes."""
    s = _study(st, sid)
    if split not in ("dev", "test", "ood", "regression"):
        raise HTTPException(422, "split must be dev, test, ood or regression")

    def rates(arm: str, seed: int) -> dict[str, dict]:
        out: dict[str, list[float]] = {}
        p = s.episode_path(arm, split, seed)
        for e in (read_jsonl(p, verify=False) if p.exists() else []):
            out.setdefault(e["family"], []).append(float(e["score"]["strict_success"]))
        return {f: {"rate": sum(v) / len(v), "n": len(v)} for f, v in sorted(out.items())}

    c0 = s.plan["eval"]["control_seed_broadcast"]
    runs = [{"arm": a, "seed": sd, "rates": rates(a, sd)} for a in s.plan["arms"] for sd in s.plan["seeds"]]
    runs = [r for r in runs if r["rates"]]
    teacher, base = rates("teacher", 0), rates("base", c0)
    fams = sorted(set(teacher) | set(base) | {f for r in runs for f in r["rates"]})
    return {"split": split, "skills": fams, "teacher": teacher, "base": base, "runs": runs,
            "focus": (s.plan.get("focus") or {}).get("skills"), "sealed": s.state["sealed"], "computed": True,
            "basis": "strict success per skill from the study's episode files; descriptive (no intervals)"}


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


@router.get("/{sid}/boundary")
def boundary_report(sid: str, st: AppState = Depends(get_state)):
    """Hand-back behaviour per model and split: boundary cases held (HANDOFF) vs ordinary tasks wrongly handed back."""
    from forge.agents.boundary import report
    s = _study(st, sid)
    tasks = {t.task_id: t for t in s.tasks()}
    has = any(t.family == "boundary" for t in tasks.values())
    rows = []
    if has:
        for arm, split, seed, _ in s.iter_episode_files():
            if split == "train" or (split in ("test", "ood", "regression") and not s.state["sealed"]):
                continue  # train episodes are the teacher's demonstrations, not an evaluation
            rows.append({"arm": arm, "split": split, "seed": seed, **report(s.episodes(arm, split, seed), tasks)})
    return {"has_boundary": has, "rows": rows,
            "note": "held = share of boundary cases answered HANDOFF; over-refusal = share of ordinary tasks answered HANDOFF. "
                    "Both matter: an agent that hands everything back is not safe, just unhelpful."}


@router.post("/{sid}/datacurve")
def start_datacurve(sid: str, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    if s.state["stages"].get("build", {}).get("status") != "completed":
        raise HTTPException(409, "Run Build first: the curve samples the study's training set")
    import os as _os
    env = {"FORGE_ALLOW_CPU": "1"} if s.plan["device"] == "cpu" and _os.environ.get("FORGE_ALLOW_CPU") == "1" else None
    try:
        return st.jobs.start("datacurve", ["datacurve", "--study", str(s.root)], gpu=True, study_id=sid,
                             label=f"{s.plan['name']} · how much data (10/25/50/100%)", env=env)
    except JobError as e:
        raise HTTPException(409, str(e))


@router.get("/{sid}/datacurve")
def get_datacurve(sid: str, st: AppState = Depends(get_state)):
    p = _study(st, sid).root / "datacurve" / "curve.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"computed": False}


@router.get("/{sid}/efficiency")
def get_efficiency(sid: str, st: AppState = Depends(get_state)):
    from forge.engine.efficiency import efficiency
    return efficiency(_study(st, sid))


class GGUFBody(BaseModel):
    outtype: Literal["q8_0", "bf16", "f16"] = "q8_0"
    quant: Literal["Q4_K_M", "Q5_K_M", "Q6_K"] | None = None
    install: bool = True
    name: str | None = Field(None, max_length=60)


@router.get("/{sid}/gguf")
def gguf_status(sid: str, st: AppState = Depends(get_state)):
    from forge.engine import gguf
    s = _study(st, sid)
    d = st.db.get_setting("llama_cpp_dir", "") or ""
    try:
        src = str(gguf.merged_export(s))
    except gguf.GGUFError:
        src = None
    lms = [str(p) for p in st.settings.lmstudio_model_dirs if p.is_dir()]
    return {"tools": gguf.find_tools(d), "merged_export": src, "lmstudio_dir": lms[0] if lms else None, "exports": gguf.list_exports(s),
            "outtypes": list(gguf.OUTTYPES), "quants": list(gguf.QUANTS)}


def _env(s: Study) -> dict | None:
    import os as _os
    return {"FORGE_ALLOW_CPU": "1"} if s.plan["device"] == "cpu" and _os.environ.get("FORGE_ALLOW_CPU") == "1" else None


@router.post("/{sid}/gguf")
def gguf_export(sid: str, body: GGUFBody, st: AppState = Depends(get_state)):
    from forge.engine import gguf
    s = _study(st, sid)
    try:
        gguf.merged_export(s)
    except gguf.GGUFError as e:
        raise HTTPException(409, str(e))
    d = st.db.get_setting("llama_cpp_dir", "") or ""
    tools = gguf.find_tools(d)
    if not tools["ok"]:
        raise HTTPException(409, "; ".join(tools["problems"]))
    lms = [str(p) for p in st.settings.lmstudio_model_dirs if p.is_dir()]
    cfg = {**body.model_dump(), "llama_cpp_dir": d, "lmstudio_dir": lms[0] if lms else None}
    try:
        return st.jobs.start("gguf", ["gguf", "--study", str(s.root), "--step", "export", "--config", json.dumps(cfg)], gpu=False,
                             study_id=sid, label=f"{s.plan['name']} · GGUF {body.quant or body.outtype}", env=_env(s))
    except JobError as e:
        raise HTTPException(409, str(e))


class GGUFCheck(BaseModel):
    file: str = Field(pattern=r"^[a-z0-9\-_.]+\.gguf$")
    model_id: str = Field(min_length=1, max_length=200)


@router.post("/{sid}/gguf/check")
def gguf_check(sid: str, body: GGUFCheck, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    if not s.state["sealed"]:
        raise HTTPException(409, "The study must be sealed")
    man = s.root / "exports" / "gguf" / body.file.replace(".gguf", ".json")
    if not man.exists():
        raise HTTPException(404, "Unknown GGUF export")
    cfg = {"manifest": str(man), "model_id": body.model_id, "base_url": st.settings.lmstudio_url}
    try:
        return st.jobs.start("gguf:check", ["gguf", "--study", str(s.root), "--step", "check", "--config", json.dumps(cfg)], gpu=True,
                             study_id=sid, label=f"{s.plan['name']} · check {body.file} in LM Studio", env=_env(s))
    except JobError as e:
        raise HTTPException(409, str(e))


class CloneBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    turbo: dict[str, Any] | None = None
    micro_batch: int | None = Field(None, ge=1, le=64)
    grad_accum: int | None = Field(None, ge=1, le=256)


@router.post("/{sid}/clone")
async def clone_study(sid: str, body: CloneBody, st: AppState = Depends(get_state)):
    """Same study, other training settings: reuses tasks and teacher episodes; only how training runs changes."""
    src = _study(st, sid)
    ov: dict[str, Any] = {k: getattr(body, k) for k in ("micro_batch", "grad_accum") if getattr(body, k) is not None}
    torch = await asyncio.to_thread(probe_torch)
    ov["turbo"] = _turbo(body.turbo, src.plan["device"], ov.get("micro_batch", src.plan["train"]["micro_batch"]), torch)
    try:
        study = Study.clone(src, st.settings.studies_dir, body.name, ov)
    except StudyError as e:
        raise HTTPException(422, str(e))
    with st.db.tx() as c:
        c.execute("INSERT INTO studies(id, name, path, profile, created_at) VALUES (?,?,?,?,?)",
                  (study.plan["study_id"], body.name, str(study.root), study.plan["profile"], study.plan["created_at"]))
    return study.summary()


@router.get("/{sid}/engine-compare")
def engine_compare(sid: str, st: AppState = Depends(get_state)):
    """This study and every study cloned from it (or its source): same data, different training settings, side by side."""
    from forge.engine.turbo import describe, DEFAULTS
    s = _study(st, sid)
    root_id = (s.plan.get("cloned_from") or {}).get("study_id") or sid
    rows = []
    for r in st.db.query("SELECT * FROM studies ORDER BY created_at"):
        try:
            x = Study(Path(r["path"]))
        except StudyError:
            continue
        if x.plan["study_id"] != root_id and (x.plan.get("cloned_from") or {}).get("study_id") != root_id:
            continue
        arm, seed = x.plan["arms"][0], x.plan["seeds"][0]
        rj = x.run_dir(arm, seed) / "run.json"
        run = json.loads(rj.read_text(encoding="utf-8")) if rj.exists() else {}
        logs = []
        lp = x.run_dir(arm, seed) / "training.jsonl"
        if lp.exists():
            logs = [json.loads(l) for l in lp.read_text(encoding="utf-8").splitlines() if l.strip()]
        losses = [l for l in logs if "loss" in l]
        rep = x.summary()["reports"].get("dev", {}).get("splits", {}).get("dev")
        t = {**DEFAULTS, **(x.plan["train"].get("turbo") or {})}
        rows.append({"study_id": x.plan["study_id"], "name": x.plan["name"], "is_source": x.plan["study_id"] == root_id, "turbo": t, "engine": describe(t),
                     "micro_batch": x.plan["train"]["micro_batch"], "grad_accum": x.plan["train"]["grad_accum"],
                     "trained": bool(run), "wall_s": run.get("wall_s"), "peak_vram_mb": run.get("peak_vram_mb"), "steps": run.get("global_step"),
                     "tokens_per_s": (logs[-1].get("tokens_per_s") if logs else None),
                     "energy_wh": (run.get("hardware") or {}).get("energy_wh") if (run.get("hardware") or {}).get("gpu_measured") else None,
                     "final_loss": losses[-1]["loss"] if losses else None, "loss_curve": [[l["step"], l["loss"]] for l in losses][:400],
                     "dev_success": (rep["arms"].get(arm) or {}).get("arm_rate") if rep else None,
                     "per_skill": {f: (d.get(arm) or {}).get("rate") for f, d in ((rep["arms"].get(arm) or {}).get("families") or {}).items()} if rep else {}})
    return {"rows": rows, "note": "Same tasks and teacher examples in every row; only the training settings differ. One seed each — "
                                  "small differences in success are noise. Loss curves should overlap if a switch changes speed but not learning."}


MICROSCOPE_VERSION = 2  # bump when the microscope output changes, so stale cached results are not served


@router.get("/{sid}/microscope")
async def weight_microscope(sid: str, arm: str, seed: int, module: str, st: AppState = Depends(get_state)):
    """One adapted matrix before and after training (exact, read-only). Cached per adapter + module."""
    import hashlib
    import re as _re

    from forge.analysis.adapters import AdapterError
    from forge.analysis.microscope import microscope
    from forge.engine.lens import snapshots as _snaps
    s = _study(st, sid)
    if arm not in s.plan["arms"] or seed not in s.plan["seeds"]:
        raise HTTPException(422, "Unknown arm/seed")
    if not _re.fullmatch(r"[A-Za-z0-9_.]{3,200}", module):
        raise HTTPException(422, "Invalid module name")
    rd = s.run_dir(arm, seed)
    ad = rd / "adapter"
    if not (ad / "adapter_model.safetensors").exists():
        raise HTTPException(409, "Not trained yet")
    sha = hashlib.sha256((ad / "adapter_model.safetensors").read_bytes()).hexdigest()[:16]
    cache = rd / "microscope" / f"v{MICROSCOPE_VERSION}-{module}-{sha}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    snaps = [(lbl, d) for lbl, _, d in _snaps(rd) if lbl != "final"]
    others = [(f"seed {x}", s.run_dir(arm, x) / "adapter") for x in s.plan["seeds"] if x != seed and (s.run_dir(arm, x) / "adapter" / "adapter_model.safetensors").exists()]
    try:
        out = await asyncio.to_thread(microscope, ad, Path(s.plan["student"]["path"]), module, snapshots=snaps, other_seeds=others)
    except AdapterError as e:
        raise HTTPException(422, str(e))
    out["adapter_sha256_prefix"] = sha
    cache.parent.mkdir(exist_ok=True)
    cache.write_text(json.dumps(out), encoding="utf-8")
    return out
