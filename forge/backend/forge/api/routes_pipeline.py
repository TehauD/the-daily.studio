"""Pipeline: the nine phases of a project, computed from what exists on disk — status, evidence, blockers and the next
action for each. Plus human sign-off and release bundles."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from forge.api.routes_studies import _study
from forge.api.state import AppState, get_state
from forge.audit import ACTOR_HEADER, clean_actor
from forge.engine import release as rel
from forge.engine.study import Study, StudyError

router = APIRouter(prefix="/api", tags=["pipeline"])
PHASES = [("setup", "Set up", "GPU, models, teacher–student pair"), ("define", "Define the job", "role, tools, data, skills, hand-back cases"),
          ("data", "Practice data", "verified tasks, human review, coverage"), ("study", "Study & train", "frozen plan → collect → build → train"),
          ("inside", "Look inside & steer", "playground, lens, model map, weight lab"), ("measure", "Measure (practice)", "results, test adequacy, robustness, benches"),
          ("final", "Seal & final test", "the confirmatory result"), ("package", "Package", "merged export → GGUF → LM Studio check"),
          ("decide", "Govern & decide", "model card, sign-off, release bundle")]


def _phase(key: str, status: str, facts: list[str], next_: dict | None = None, blockers: list[str] | None = None) -> dict:
    """status: done · attention (done, with warnings to read) · active · todo · blocked · optional · locked."""
    name, what = next((n, w) for k, n, w in PHASES if k == key)
    if status == "done" and blockers:
        status = "attention"
    return {"key": key, "name": name, "what": what, "status": status, "facts": facts, "next": next_, "blockers": blockers or []}


def _studies_for(st: AppState, kind: str, ref: str | None) -> list[Study]:
    out = []
    for r in st.db.query("SELECT * FROM studies ORDER BY created_at DESC"):
        try:
            s = Study(Path(r["path"]))
        except StudyError:
            continue
        ts = s.plan["taskset"]
        k = ts.get("kind") or "catalog"
        if (kind == "agent" and (ts.get("agent") or {}).get("id") == ref) or (kind == "docs" and (ts.get("pack") or {}).get("id") == ref) or \
           (kind == "catalog" and k not in ("agent", "docqa")):
            out.append(s)
    return out


@router.get("/pipeline")
def pipeline(project: str, study_id: str | None = None, st: AppState = Depends(get_state)):
    kind, _, ref = project.partition(":")
    if kind not in ("agent", "docs", "catalog"):
        raise HTTPException(422, "Unknown project")
    studies = _studies_for(st, kind, ref or None)
    s = next((x for x in studies if x.plan["study_id"] == study_id), studies[0] if studies else None)
    ph = []
    # 1 set up
    roles = {r for m in st.registry.list() for r in (m.get("roles") or [])} if hasattr(st.registry, "list") else set()
    has_t, has_s = "teacher" in roles, "student" in roles
    ph.append(_phase("setup", "done" if s or (has_t and has_s) else "active",
                     [f"teacher {'assigned' if has_t or s else 'not assigned'}", f"student {'assigned' if has_s or s else 'not assigned'}"] +
                     ([f"device: {s.plan['device']}"] if s else []),
                     {"label": "Review models" if s or (has_t and has_s) else "Assign a teacher and a student", "route": "observatory"}))
    # 2 define / 3 data
    if kind == "agent":
        from forge.agents.agent import Agent, AgentError
        try:
            a = Agent(st.settings.home / "agents" / ref)
        except AgentError:
            raise HTTPException(404, "Unknown agent")
        m = a.meta
        tables, skills = m["tools"].get("tables", []), m["skills"]
        ok = bool(m["role"].strip() and skills and (tables or m["tools"].get("calculator") or m["tools"].get("knowledge_pack")))
        ph.append(_phase("define", "done" if ok else "active", [f"{len(skills)} skills", f"{len(tables)} tables", f"boundary suite {'on' if (m.get('boundary') or {}).get('enabled') else 'off'}"],
                         {"label": "Open the agent", "route": "agent-studio", "handoff": {"agent": ref}}, [] if ok else ["Describe the role and add at least one skill and tool"]))
        tstat = m["steps"]["tasks"].get("status")
        summ = m["steps"]["tasks"].get("summary") or {}
        rv = a.review_stats()
        from forge.agents.coverage import coverage
        warns = coverage(a)["warnings"] if tstat in ("completed", "stale") else []
        ph.append(_phase("data", "done" if tstat == "completed" else "blocked" if tstat == "stale" else "todo" if ok else "locked",
                         ([f"{summ.get('accepted', 0)} verified tasks · {summ.get('rejected', 0)} rejected", f"human review: {rv['approved'] + rv['corrected']} done · {rv['pending']} pending",
                           f"{len(warns)} coverage warning{'s' if len(warns) != 1 else ''}"] if summ else ["no tasks yet"]),
                         {"label": "Write practice tasks" if tstat != "completed" else "Review tasks & coverage", "route": "agent-studio", "handoff": {"agent": ref}},
                         (["The agent changed since tasks were written — write them again"] if tstat == "stale" else []) + warns[:2]))
    elif kind == "docs":
        from forge.knowledge.pack import KnowledgePack, PackError
        try:
            p = KnowledgePack(st.settings.home / "knowledge" / ref)
        except PackError:
            raise HTTPException(404, "Unknown document pack")
        steps = {k: v.get("status") for k, v in p.meta["steps"].items()}
        ph.append(_phase("define", "done" if steps.get("index") == "completed" else "active", [f"{k}: {v or 'not run'}" for k, v in steps.items() if k in ("import", "index")],
                         {"label": "Open the document pack", "route": "knowledge-studio", "handoff": {"pack": ref}}))
        q = steps.get("questions")
        ph.append(_phase("data", "done" if q == "completed" else "todo", [f"questions: {q or 'not run'}"], {"label": "Write verified questions", "route": "knowledge-studio", "handoff": {"pack": ref}}))
    else:
        ph.append(_phase("define", "done", ["built-in catalog practice world"]))
        ph.append(_phase("data", "done", ["generated catalog tasks (fixed, verified)"]))
    # 4 study
    if not s:
        ph.append(_phase("study", "todo", ["no study yet"], {"label": "Create a study", "route": "studio"}))
        for k in ("inside", "measure", "final", "package", "decide"):
            ph.append(_phase(k, "locked", ["needs a study"]))
        return {"project": project, "study": None, "studies": [], "phases": ph}
    summ = s.summary()
    stg = {k: v.get("status") for k, v in summ["state"]["stages"].items()}
    arm, seed = s.plan["arms"][0], s.plan["seeds"][0]
    trained = [(a, sd) for a in s.plan["arms"] for sd in s.plan["seeds"] if (s.run_dir(a, sd) / "adapter" / "adapter_model.safetensors").exists()]
    run_status = "active" if any(v == "running" for v in stg.values()) else None
    need = [x for x in ("collect", "build", "train") if stg.get(x) != "completed"]
    failed = [x for x in ("collect", "build", "train") if stg.get(x) in ("failed", "interrupted")]
    ph.append(_phase("study", "done" if not need else run_status or ("blocked" if failed else "todo"),
                     [f"profile {s.plan['profile']} · {len(s.plan['seeds'])} seed(s)", f"stages: " + ", ".join(f"{k} {'✓' if stg.get(k) == 'completed' else stg.get(k) or '—'}" for k in ("collect", "build", "train")),
                      f"{len(trained)} adapter(s) trained" + (" · Turbo" if any(v for k, v in (s.plan['train'].get('turbo') or {}).items() if v not in (False, 'sdpa', 'on')) else "")],
                     {"label": f"Run {need[0]}" if need else "Training details", "route": "studio" if need else "training"}, [f"{x} {stg[x]}" for x in failed]))
    # 5 inside
    lens = sum(1 for a, sd in trained if (s.run_dir(a, sd) / "lens.json").exists())
    mm = (s.root / "modelmap").is_dir() and any((s.root / "modelmap").iterdir())
    play = len(list((s.root / "playground").glob("*.json"))) if (s.root / "playground").is_dir() else 0
    wl = 0
    wdir = st.settings.home / "weightlab"
    for d in wdir.iterdir() if wdir.is_dir() else []:
        try:
            r = json.loads((d / "recipe.json").read_text(encoding="utf-8"))
            wl += any(src.get("study_id") == s.plan["study_id"] for src in r.get("sources", []))
        except (OSError, ValueError):
            continue
    used = sum(bool(x) for x in (lens, mm, play, wl))
    ph.append(_phase("inside", "locked" if not trained else "done" if used >= 2 else "optional",
                     [f"playground runs: {play}", f"distillation lens: {'yes' if lens else 'no'}", f"model map: {'yes' if mm else 'no'}", f"weight lab variants: {wl}"],
                     {"label": "Try it in the Playground" if not play else "See inside (Model Map)", "route": "playground" if not play else "modelmap"}))
    # 6 measure
    from forge.engine.governance import adequacy
    adq = adequacy(s) if stg.get("evaluate_dev") == "completed" else None
    rep = summ["reports"].get("dev", {}).get("splits", {}).get("dev")
    rob = sum((s.root / x).is_dir() for x in ("stress", "datacurve"))
    bench = 0
    bdir = st.settings.home / "bench"
    for d in bdir.iterdir() if bdir.is_dir() else []:
        try:
            spec = json.loads((d / "spec.json").read_text(encoding="utf-8"))
            bench += any(str(s.root) in (l.get("adapter") or "") for l in spec["lanes"])
        except (OSError, ValueError):
            continue
    mdone = stg.get("analyze_dev") == "completed"
    a0 = (rep or {}).get("arms", {}).get(arm, {})
    ph.append(_phase("measure", "locked" if not trained else "done" if mdone else "todo",
                     ([f"practice: untrained {rep['base_rate']:.0%} → trained {a0.get('arm_rate', 0):.0%} · teacher {rep['teacher_rate']:.0%}" if rep and rep.get('base_rate') is not None else "not analysed yet",
                       f"test adequacy: {adq['overall']}" if adq else "test adequacy: after Evaluate · dev", f"robustness checks: {rob}", f"bench runs with this adapter: {bench}"]),
                     {"label": "Run Evaluate · dev" if stg.get("evaluate_dev") != "completed" else "Analyse dev" if not mdone else "Check robustness & limits",
                      "route": "studio" if not mdone else "robustness"},
                     [f"Test adequacy is '{adq['overall']}': fix weak skills before reading gains"] if adq and adq["overall"] in ("weak", "inadequate") else []))
    # 7 final
    sealed = summ["state"]["sealed"]
    trep = summ["reports"].get("test", {})
    tsec = (trep.get("splits") or {}).get("test")
    ph.append(_phase("final", "locked" if not mdone else "done" if stg.get("analyze_test") == "completed" else "todo",
                     [f"sealed: {'yes' if sealed else 'no'}"] + ([f"final test: trained {tsec['arms'][arm]['arm_rate']:.0%} vs untrained {tsec['base_rate']:.0%}", f"review gate: {trep.get('gate', {}).get('verdict', '—')}"] if tsec else []),
                     {"label": "Seal the study" if not sealed else "Run the final test", "route": "studio"} if stg.get("analyze_test") != "completed" else {"label": "Read the final result", "route": "evaluation"}))
    # 8 package
    exp = stg.get("export") == "completed"
    g = s.root / "exports" / "gguf"
    ggufs = [json.loads(p.read_text(encoding="utf-8")) for p in g.glob("*.json")] if g.is_dir() else []
    checked = sum(1 for x in ggufs if x.get("lmstudio_check"))
    ph.append(_phase("package", "locked" if stg.get("analyze_test") != "completed" else "done" if ggufs and checked else "optional" if exp else "todo",
                     [f"merged export: {'yes' if exp else 'no'}", f"GGUF files: {len(ggufs)}", f"checked in LM Studio: {checked}"],
                     {"label": "Export, then make a GGUF", "route": "factory"}))
    # 9 decide
    so = rel.signoffs(s)
    bundles = rel.bundles(s)
    last = so[-1] if so else None
    ph.append(_phase("decide", "locked" if stg.get("analyze_test") != "completed" else "done" if last and bundles else "todo",
                     [f"decision: {last['decision_label']} — {last['reviewer']}" if last else "no human decision recorded", f"release bundles: {len(bundles)}"],
                     {"label": "Record a decision / build the bundle", "route": "governance"}))
    return {"project": project, "study": {"id": s.plan["study_id"], "name": s.plan["name"], "profile": s.plan["profile"], "sealed": sealed},
            "studies": [{"id": x.plan["study_id"], "name": x.plan["name"]} for x in studies], "phases": ph}


class SignOff(BaseModel):
    decision: Literal["approved_pilot", "approved_evaluation", "changes_needed", "rejected"]
    role: str = Field(min_length=2, max_length=80)
    purpose: str = Field(min_length=3, max_length=400)
    rationale: str = Field(min_length=20, max_length=2000)
    conditions: str = Field("", max_length=1000)


@router.get("/studies/{sid}/signoffs")
def get_signoffs(sid: str, st: AppState = Depends(get_state)):
    s = _study(st, sid)
    return {"signoffs": rel.signoffs(s), "decisions": rel.DECISIONS, "bundles": rel.bundles(s)}


@router.post("/studies/{sid}/signoffs")
def post_signoff(sid: str, body: SignOff, request: Request, st: AppState = Depends(get_state)):
    from forge.agents.safety import scan_text
    for t in (body.purpose, body.rationale, body.conditions):
        if scan_text(t)["block"]:
            raise HTTPException(422, "The text looks like it contains personal data")
    try:
        return rel.sign_off(_study(st, sid), body.decision, clean_actor(request.headers.get(ACTOR_HEADER)), body.role, body.purpose, body.rationale, body.conditions)
    except rel.ReleaseError as e:
        raise HTTPException(409, str(e))


@router.post("/studies/{sid}/release")
def post_release(sid: str, request: Request, st: AppState = Depends(get_state)):
    from forge.api.routes_governance import study_timeline
    from forge.engine import governance as gov
    s = _study(st, sid)
    card = gov.model_card(s)
    audit = [e for e in study_timeline(st, request, sid) if e["kind"] in ("audit", "review", "decision")]
    html = {a: gov.report_html(card, a, audit if a != "executive" else None) for a in gov.AUDIENCES}
    try:
        p = rel.build_bundle(s, html, gov.card_markdown(card), card)
    except rel.ReleaseError as e:
        raise HTTPException(409, str(e))
    return {"name": p.name, "bytes": p.stat().st_size}


@router.get("/studies/{sid}/release/{name}")
def get_release(sid: str, name: str, st: AppState = Depends(get_state)):
    import re
    s = _study(st, sid)
    if not re.fullmatch(r"forge-release-study_[a-f0-9]+-\d{8}T\d{6}\.zip", name):
        raise HTTPException(404, "Unknown bundle")
    p = s.root / "releases" / name
    if not p.exists():
        raise HTTPException(404, "Unknown bundle")
    return FileResponse(p, media_type="application/zip", filename=name)
