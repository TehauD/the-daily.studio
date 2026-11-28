"""Governance: failure types, calibration, per-skill curves, model card, stakeholder reports, audit trail and timelines."""
from __future__ import annotations

import json
from typing import Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, PlainTextResponse

from forge.api.routes_studies import _study
from forge.api.state import AppState, get_state
from forge.engine import governance as gov

router = APIRouter(prefix="/api", tags=["governance"])


@router.get("/studies/{sid}/failures")
def study_failures(sid: str, st: AppState = Depends(get_state)):
    return gov.failures(_study(st, sid))


@router.get("/studies/{sid}/adequacy")
def study_adequacy(sid: str, st: AppState = Depends(get_state)):
    return gov.adequacy(_study(st, sid))


@router.get("/studies/{sid}/calibration")
def study_calibration(sid: str, st: AppState = Depends(get_state)):
    return gov.calibration(_study(st, sid))


@router.get("/studies/{sid}/skills")
def study_skills(sid: str, st: AppState = Depends(get_state)):
    return gov.skill_curves(_study(st, sid))


@router.get("/studies/{sid}/card")
def study_card(sid: str, st: AppState = Depends(get_state)):
    return gov.model_card(_study(st, sid))


@router.get("/studies/{sid}/card.md", response_class=PlainTextResponse)
def study_card_md(sid: str, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    return PlainTextResponse(gov.card_markdown(gov.model_card(s)), media_type="text/markdown",
                             headers={"Content-Disposition": f'attachment; filename="model-card-{sid}.md"'})


def _audit(request: Request) -> tuple[list[dict], dict]:
    a = getattr(request.app.state, "audit", None)
    return a.read() if a else ([], {"ok": True, "records": 0, "broken_at": None})


def study_timeline(st: AppState, request: Request, sid: str) -> list[dict]:
    """One study's history: stage runs, jobs, audit records naming it or its agent, reviews and decisions."""
    s = _study(st, sid)
    agent = (s.plan["taskset"].get("agent") or {}).get("id")
    out = [{"at": h["at"], "actor": None, "what": f"stage {h['stage']} {h.get('status', 'completed')}", "kind": "stage"} for h in s.state["history"]]
    for j in st.jobs.list(200, study_id=sid):
        out.append({"at": j["created_at"], "actor": None, "what": f"job started: {j['label']}", "kind": "job"})
        if j.get("ended_at"):
            out.append({"at": j["ended_at"], "actor": None, "what": f"job {j['status']}: {j['label']}", "kind": "job"})
    recs, _ = _audit(request)
    for r in recs:
        if sid in r.get("path", "") or (agent and agent in r.get("path", "")):
            out.append({"at": r["at"], "actor": r["actor"], "what": r["what"], "kind": "audit", "status": r.get("status")})
    if agent:
        revp = st.settings.home / "agents" / agent / "reviews.json"
        if revp.exists():
            for k, v in json.loads(revp.read_text(encoding="utf-8")).items():
                out.append({"at": v.get("at", ""), "actor": v.get("reviewer"), "what": f"task review: {v.get('status')}", "kind": "review"})
    dp = st.settings.home / "decisions.jsonl"
    if dp.exists():
        for line in dp.read_text(encoding="utf-8").splitlines():
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if d.get("study_id") == sid:
                out.append({"at": d["at"], "actor": d.get("reviewer"), "what": f"{d.get('decision')} on {d.get('lane')} lane answer", "kind": "decision"})
    return sorted(out, key=lambda x: x["at"] or "", reverse=True)


@router.get("/studies/{sid}/timeline")
def get_timeline(sid: str, request: Request, st: AppState = Depends(get_state)):
    _, chain = _audit(request)
    return {"events": study_timeline(st, request, sid)[:500], "chain": chain,
            "note": "Names are what each person typed as their reviewer name in this browser — accountability between colleagues, not authentication."}


@router.get("/audit")
def get_audit(request: Request, limit: int = 300):
    recs, chain = _audit(request)
    return {"records": list(reversed(recs))[: max(1, min(limit, 5000))], "chain": chain}


@router.get("/studies/{sid}/report", response_class=HTMLResponse)
def study_report(sid: str, request: Request, audience: Literal["executive", "operations", "technical"] = "executive",
                 st: AppState = Depends(get_state)):
    s = _study(st, sid)
    card = gov.model_card(s)
    audit = [e for e in study_timeline(st, request, sid) if e["kind"] in ("audit", "review", "decision")] if audience != "executive" else None
    body = gov.report_html(card, audience, audit)
    return HTMLResponse(body, headers={"Content-Disposition": f'attachment; filename="forge-{audience}-report-{sid}.html"',
                                       "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"})
