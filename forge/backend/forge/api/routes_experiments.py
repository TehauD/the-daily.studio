from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from forge.api.state import AppState, get_state
from forge.domain.datasets import DatasetStore
from forge.domain.experiments import ExperimentError

router = APIRouter(prefix="/api", tags=["experiments"])


@router.get("/experiments")
def list_experiments(st: AppState = Depends(get_state)):
    return st.experiments.list()


@router.get("/experiments/{eid}")
def get_experiment(eid: str, st: AppState = Depends(get_state)):
    try:
        return st.experiments.get(eid)
    except ExperimentError as e:
        raise HTTPException(404, str(e))


@router.get("/datasets")
def list_datasets(st: AppState = Depends(get_state)):
    return DatasetStore(st.db, st.settings.datasets_dir).list()


@router.get("/overview")
def overview(st: AppState = Depends(get_state)):
    models = st.registry.list()
    by_provider: dict[str, int] = {}
    trainable = 0
    for m in models:
        by_provider[m["provider"]] = by_provider.get(m["provider"], 0) + 1
        if m["capabilities"].get("lora", {}).get("status") == "supported":
            trainable += 1
    last = st.db.one("SELECT started_at FROM discovery_runs ORDER BY started_at DESC LIMIT 1")
    return {
        "models_total": len(models), "models_available": sum(m["status"] == "available" for m in models),
        "models_trainable": trainable, "by_provider": by_provider,
        "teachers": [m["name"] for m in models if "teacher" in m["roles"]],
        "students": [m["name"] for m in models if "student" in m["roles"]],
        "experiments": st.db.one("SELECT COUNT(*) AS n FROM experiments")["n"],
        "trajectories": st.db.one("SELECT COUNT(*) AS n FROM trajectories")["n"],
        "datasets": st.db.one("SELECT COUNT(*) AS n FROM datasets")["n"],
        "active_runs": st.experiments.active_count(),
        "active_jobs": st.jobs.active_count(), "gpu_job": st.jobs.gpu_busy(),
        "studies": st.db.one("SELECT COUNT(*) AS n FROM studies")["n"],
        "latest_study": st.db.one("SELECT id, name, profile, created_at FROM studies ORDER BY created_at DESC LIMIT 1"),
        "models_hidden_non_generative": sum(m["eligibility"]["kind"] not in ("generative", "unknown") for m in models),
        "last_discovery": last["started_at"] if last else None,
    }
