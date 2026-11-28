"""Projects: one card per thing being built — an agent, a document pack, or the built-in catalog skills.

Derived on read from what already exists (agents, knowledge packs, studies, Weight Lab variants); nothing new is stored,
so a project can never disagree with its parts. Each project says where it stands and what the sensible next step is.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends

from forge.api.state import AppState, get_state

router = APIRouter(prefix="/api/projects", tags=["projects"])

STAGE_LABEL = {"collect": "Collect teacher examples", "build": "Build the training set", "train": "Train the student",
               "evaluate_dev": "Evaluate on practice tasks", "analyze_dev": "Analyse practice results", "seal": "Seal the final test",
               "evaluate_test": "Run the sealed final test", "analyze_test": "Analyse the final test", "export": "Export the model"}


def _study_rows(st: AppState) -> list[dict[str, Any]]:
    from forge.engine.study import Study, StudyError
    out = []
    for r in st.db.query("SELECT * FROM studies ORDER BY created_at DESC"):
        try:
            s = Study(Path(r["path"]))
            summ = s.summary()
        except (StudyError, OSError, ValueError):
            continue
        ts = s.plan["taskset"]
        headline = None
        for split in ("test", "dev"):
            rep = summ["reports"].get(split, {}).get("splits", {}).get(split)
            if rep:
                arm, v = next(iter(rep["arms"].items()), (None, None))
                headline = {"split": split, "base": rep.get("base_rate"), "teacher": rep.get("teacher_rate"),
                            "tuned": v.get("arm_rate") if v else None, "arm": arm,
                            "ci": [v.get("ci_low"), v.get("ci_high")] if v else None, "confirmatory": split == "test"}
                break
        stages = {k: v["status"] for k, v in summ["state"]["stages"].items()}
        out.append({"id": r["id"], "name": r["name"], "profile": r["profile"], "created_at": r["created_at"],
                    "next_stage": summ["next_stage"], "sealed": summ["state"]["sealed"], "stages": stages,
                    "running": any(v == "running" for v in stages.values()), "headline": headline,
                    "kind": ts.get("kind") or "catalog", "agent": (ts.get("agent") or {}).get("id"), "pack": (ts.get("pack") or {}).get("id"),
                    "teacher": s.plan["teacher"]["model"], "student": s.plan["student"]["name"]})
    return out


def _variants(st: AppState) -> list[dict[str, Any]]:
    base = st.settings.home / "weightlab"
    out = []
    if base.is_dir():
        for d in base.iterdir():
            try:
                r = json.loads((d / "recipe.json").read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            out.append({"id": r["id"], "name": r["name"], "studies": sorted({s.get("study_id") for s in r.get("sources", []) if s.get("study_id")}),
                        "built": (d / "adapter" / "adapter_model.safetensors").exists()})
    return out


def _next(kind: str, studies: list[dict], ready: bool, why: str) -> dict[str, str]:
    """The one sensible next step, and which page does it."""
    if not ready:
        return {"label": why, "route": "agent-studio" if kind == "agent" else "knowledge-studio" if kind == "docs" else "studio"}
    if not studies:
        return {"label": "Start a study (teacher vs student)", "route": "studio"}
    s = studies[0]
    if s["running"]:
        return {"label": f"Running: {STAGE_LABEL.get(next((k for k, v in s['stages'].items() if v == 'running'), ''), 'a stage')}", "route": "studio"}
    if s["next_stage"] in ("collect", "build", "train", "evaluate_dev", "analyze_dev"):
        return {"label": STAGE_LABEL[s["next_stage"]], "route": "studio"}
    if s["next_stage"] == "seal":
        return {"label": "Review practice results, try it in the Playground, then seal", "route": "evaluation"}
    if s["next_stage"] in ("evaluate_test", "analyze_test"):
        return {"label": STAGE_LABEL[s["next_stage"]], "route": "studio"}
    return {"label": "Explore what changed (Model Map) or export", "route": "modelmap"}


@router.get("")
def list_projects(st: AppState = Depends(get_state)):
    from forge.agents.agent import Agent, AgentError
    from forge.knowledge.pack import KnowledgePack, PackError
    studies = _study_rows(st)
    variants = _variants(st)
    projects: list[dict[str, Any]] = []

    def attach(p: dict, mine: list[dict]) -> dict:
        ids = {s["id"] for s in mine}
        p["studies"] = mine
        p["variants"] = [v for v in variants if ids & set(v["studies"])]
        p["updated_at"] = max([p.get("created_at") or ""] + [s["created_at"] for s in mine])
        p["running"] = any(s["running"] for s in mine)
        p["headline"] = next((s["headline"] for s in mine if s["headline"]), None)
        return p

    agents_dir = st.settings.home / "agents"
    if agents_dir.is_dir():
        for d in sorted(agents_dir.iterdir()):
            try:
                m = Agent(d).meta
            except (AgentError, KeyError, ValueError, OSError):
                continue
            tasks = m["steps"]["tasks"].get("status")
            mine = [s for s in studies if s["agent"] == m["id"]]
            p = {"id": f"agent:{m['id']}", "kind": "agent", "ref": m["id"], "name": m["name"], "template": m["template"],
                 "created_at": m["created_at"], "skills": len(m["skills"]), "tables": len(m["tools"].get("tables", [])), "tasks": tasks}
            p["next"] = _next("agent", mine, tasks == "completed", "Add a skill" if not m["skills"] else "Regenerate practice tasks (the agent changed since they were written)" if tasks == "stale" else "Write practice tasks")
            projects.append(attach(p, mine))
    packs_dir = st.settings.home / "knowledge"
    if packs_dir.is_dir():
        for d in sorted(packs_dir.iterdir()):
            try:
                m = KnowledgePack(d).meta
            except (PackError, KeyError, ValueError, OSError):
                continue
            steps = {k: v.get("status") for k, v in m["steps"].items()}
            mine = [s for s in studies if s["pack"] == m["id"]]
            ready = all(v == "completed" for v in steps.values()) if steps else False
            p = {"id": f"docs:{m['id']}", "kind": "docs", "ref": m["id"], "name": m["name"], "created_at": m["created_at"], "steps": steps}
            p["next"] = _next("docs", mine, ready, "Finish the document pack (import → index → questions)")
            projects.append(attach(p, mine))
    cat = [s for s in studies if s["kind"] not in ("agent", "docqa") and not s["agent"] and not s["pack"]]
    if cat:
        p = {"id": "catalog", "kind": "catalog", "ref": None, "name": "Catalog skills (built-in practice world)", "created_at": cat[-1]["created_at"]}
        p["next"] = _next("catalog", cat, True, "")
        projects.append(attach(p, cat))
    projects.sort(key=lambda p: p["updated_at"] or "", reverse=True)
    projects.sort(key=lambda p: not p["running"])
    return {"projects": projects, "counts": {"agents": sum(p["kind"] == "agent" for p in projects), "docs": sum(p["kind"] == "docs" for p in projects),
                                            "studies": len(studies), "variants": len(variants)}}
