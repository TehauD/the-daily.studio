from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from forge.api.state import AppState, get_state
from forge.hardware.probe import query_gpus
from forge.hardware.profiles import EstimateInput, estimate_lora_memory
from forge.registry.capabilities import CAPABILITIES
from forge.registry.discovery import build_providers, hardware_context, run_discovery
from forge.registry.registry import RegistryError

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
def list_models(provider: str | None = None, include_missing: bool = True, st: AppState = Depends(get_state)):
    return {"capabilities": CAPABILITIES, "models": st.registry.list(provider, include_missing)}


@router.post("/purge-missing")
def purge_missing(st: AppState = Depends(get_state)):
    return {"purged": st.registry.purge_missing()}


@router.post("/discover")
async def discover(st: AppState = Depends(get_state)):
    if st.discovery_running:
        raise HTTPException(409, "Discovery already in progress")
    st.discovery_running = True
    try:
        hw = await asyncio.to_thread(hardware_context)
        return await run_discovery(st.db, build_providers(st.settings, st.db), hw)  # effective (overridden) settings
    finally:
        st.discovery_running = False


@router.get("/discovery-runs")
def discovery_runs(limit: int = 10, st: AppState = Depends(get_state)):
    import json
    rows = st.db.query("SELECT * FROM discovery_runs ORDER BY started_at DESC LIMIT ?", (min(limit, 100),))
    for r in rows:
        r["results"] = json.loads(r["results"])
    return rows


def gpu_total_mb() -> float | None:
    """Memory of the largest NVIDIA GPU, or None when none is visible (pair-check then assumes 16 GB)."""
    from forge.hardware.probe import query_gpus
    try:
        g = [x.vram_total_mb for x in query_gpus() if x.vram_total_mb]
    except Exception:  # nvidia-smi missing or slow: fall back to the 16 GB assumption
        return None
    return float(max(g)) if g else None


@router.get("/pair-check")
def pair_check(teacher: str, student: str, st: AppState = Depends(get_state)):
    try:
        return st.registry.pair_check(teacher, student, gpu_total_mb())
    except RegistryError as e:
        raise HTTPException(404, str(e))


@router.get("/{model_id}")
def get_model(model_id: str, st: AppState = Depends(get_state)):
    try:
        return st.registry.get(model_id)
    except RegistryError as e:
        raise HTTPException(404, str(e))


@router.get("/{model_id}/fit")
async def fit(model_id: str, seq_len: int = 2048, st: AppState = Depends(get_state)):
    try:
        m = st.registry.get(model_id)
    except RegistryError as e:
        raise HTTPException(404, str(e))
    if not m["parameter_count"]:
        return {"available": False, "reason": "Parameter count unknown"}
    gpus = await asyncio.to_thread(query_gpus)
    free = max((g.vram_free_mb or 0 for g in gpus), default=None) or None
    md = m["metadata"]
    out = {}
    for method, quant in (("lora", "bf16"), ("qlora", "nf4")):
        if m["capabilities"].get(method, {}).get("status") == "unsupported":
            out[method] = {"verdict": "not_applicable", "reason": m["capabilities"][method]["reason"]}
            continue
        est = estimate_lora_memory(EstimateInput(params_b=m["parameter_count"] / 1e9, quant=quant, seq_len=seq_len,
                                                 hidden=md.get("hidden_size"), layers=md.get("num_hidden_layers"),
                                                 intermediate=md.get("intermediate_size"), vocab=md.get("vocab_size"),
                                                 num_heads=md.get("num_attention_heads"), num_kv_heads=md.get("num_key_value_heads"),
                                                 head_dim=md.get("head_dim")), free)
        out[method] = est.to_dict()
    return {"available": True, "seq_len": seq_len, "free_vram_mb": free, "estimates": out}


class RoleBody(BaseModel):
    role: Literal["teacher", "student"]


@router.put("/{model_id}/roles")
def add_role(model_id: str, body: RoleBody, st: AppState = Depends(get_state)):
    try:
        return st.registry.assign_role(model_id, body.role)
    except RegistryError as e:
        raise HTTPException(422, str(e))


@router.delete("/{model_id}/roles/{role}")
def remove_role(model_id: str, role: Literal["teacher", "student"], st: AppState = Depends(get_state)):
    try:
        return st.registry.remove_role(model_id, role)
    except RegistryError as e:
        raise HTTPException(404, str(e))


@router.get("/{model_id}/hub")
def model_hub(model_id: str, st: AppState = Depends(get_state)):
    """Everything FORGE knows about one model: identity, roles, studies (as teacher or student) with each trained adapter's
    results, bench results (including its adapters), Weight Lab variants and GGUF exports."""
    import json as _json
    from pathlib import Path

    from forge.engine.study import Study, StudyError
    try:
        m = st.registry.get(model_id)
    except RegistryError as e:
        raise HTTPException(404, str(e))
    meta = m.get("metadata") or {}
    studies, adapters, exports = [], [], []
    for r in st.db.query("SELECT * FROM studies ORDER BY created_at DESC"):
        try:
            s = Study(Path(r["path"]))
        except StudyError:
            continue
        role = "student" if s.plan["student"].get("model_id") == model_id else "teacher" if s.plan["teacher"].get("model_id") == model_id else None
        if not role:
            continue
        summ = s.summary()
        reps = {sp: summ["reports"].get(sp, {}).get("splits", {}).get(sp) for sp in ("dev", "test")}
        studies.append({"id": s.plan["study_id"], "name": s.plan["name"], "role": role, "profile": s.plan.get("profile"), "sealed": summ["state"]["sealed"],
                        "next_stage": summ["next_stage"], "created_at": s.plan["created_at"],
                        "teacher_rate": (reps["test"] or reps["dev"] or {}).get("teacher_rate"), "untrained_rate": (reps["test"] or reps["dev"] or {}).get("base_rate")})
        if role == "student":
            for arm in s.plan["arms"]:
                for seed in s.plan["seeds"]:
                    if (s.run_dir(arm, seed) / "adapter" / "adapter_model.safetensors").exists():
                        res = {}
                        for sp, rep in reps.items():
                            if rep and arm in rep["arms"]:
                                a = rep["arms"][arm]
                                res[sp] = {"rate": a.get("arm_rate"), "gain": a.get("mean"), "ci": [a.get("ci_low"), a.get("ci_high")], "base": rep.get("base_rate")}
                        adapters.append({"study_id": s.plan["study_id"], "study": s.plan["name"], "arm": arm, "seed": seed, "results": res,
                                         "turbo": (s.plan["train"].get("turbo") or {}), "sealed": summ["state"]["sealed"]})
            g = s.root / "exports" / "gguf"
            for p in sorted(g.glob("*.json")) if g.is_dir() else []:
                try:
                    x = _json.loads(p.read_text(encoding="utf-8"))
                    exports.append({"study": s.plan["name"], "file": x["file"], "bytes": x["bytes"], "type": x["header"]["file_type"], "check": x.get("lmstudio_check")})
                except (OSError, ValueError, KeyError):
                    continue
    bench = []
    bdir = st.settings.home / "bench"
    for d in sorted(bdir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True) if bdir.is_dir() else []:
        try:
            spec = _json.loads((d / "spec.json").read_text(encoding="utf-8"))
            summ = _json.loads((d / "summary.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        mine = {l["label"]: l for l in spec["lanes"] if l.get("model_id") == model_id}
        for row in summ["rows"]:
            if row["lane"] in mine and row.get("n"):
                bench.append({"run": spec["id"], "suite": spec["suite"], "at": spec["created_at"], "lane": row["lane"], "mode": row["mode"],
                              "adapter": bool(mine[row["lane"]].get("adapter")), "rate": row["rate"], "ci": row["ci"], "n": row["n"],
                              "by_category": {k: v["rate"] for k, v in row["by_category"].items()}})
    variants = []
    wdir = st.settings.home / "weightlab"
    for d in wdir.iterdir() if wdir.is_dir() else []:
        try:
            r = _json.loads((d / "recipe.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if r.get("student") == m["name"]:
            variants.append({"id": r["id"], "name": r["name"], "status": r.get("status"), "created_at": r.get("created_at")})
    return {"model": {"id": m["id"], "name": m["name"], "provider": m["provider"], "roles": m.get("roles", []), "architecture": m.get("architecture"),
                      "parameter_count": m.get("parameter_count"), "quantization": m.get("quantization"), "context_length": m.get("context_length"),
                      "size_bytes": m.get("size_bytes"), "status": m.get("status"), "license": m.get("license"),
                      "vision": meta.get("lmstudio_type") == "vlm" or "vision" in (meta.get("lmstudio_capabilities") or []),
                      "trainable": (m.get("capabilities") or {}).get("lora", {}).get("status") == "supported",
                      "kind": meta.get("model_kind"), "storage_path": m.get("storage_path")},
            "studies": studies, "adapters": adapters, "bench": bench, "variants": variants, "exports": exports}
