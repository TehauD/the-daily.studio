from __future__ import annotations

import logging
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from forge import __version__
from forge.audit import ACTOR_HEADER, Audit
from forge.api import (routes_analysis, routes_experiments, routes_hub, routes_jobs, routes_lmstudio, routes_models,
                       routes_settings, routes_studies, routes_system, routes_knowledge, routes_agents, routes_assistant, routes_playground, routes_modelmap, routes_projects, routes_governance, routes_autotune)
from forge.api.state import AppState
from forge.config import Settings
from forge.db import Database
from forge.domain.experiments import ExperimentManager
from forge.hardware.telemetry import TelemetrySampler
from forge.jobs.runner import JobRunner
from forge.logging_setup import configure_logging, log_event
from forge.registry.registry import ModelRegistry

log = logging.getLogger("forge.api")
MUTATING = {"POST", "PUT", "PATCH", "DELETE"}
TOKEN_HEADER = "X-Forge-Token"


def content_security_policy(index_html: Path) -> str:
    """Strict CSP for the UI: same-origin only; the one inline pre-paint script is allowed by its exact hash.
    Inline *style attributes* are allowed (charts set them); no inline script, eval, plugins, framing or remote hosts."""
    import base64
    import hashlib
    import re as _re
    hashes = []
    if index_html.exists():
        html = index_html.read_text(encoding="utf-8")
        for body in _re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, _re.S):
            hashes.append("'sha256-" + base64.b64encode(hashlib.sha256(body.encode("utf-8")).digest()).decode() + "'")
    return ("default-src 'self'; script-src 'self' " + " ".join(hashes) + "; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; "
            "form-action 'self'; frame-ancestors 'none'")


def create_app(settings: Settings | None = None, token: str | None = None) -> FastAPI:
    settings = settings or Settings()
    settings.ensure_dirs()
    configure_logging(settings.logs_dir)
    session_token = token or secrets.token_urlsafe(32)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        db = Database(settings.db_path)
        experiments = ExperimentManager(db)
        recovered = experiments.recover_interrupted()
        from forge.api.routes_settings import guard_env
        jobs = JobRunner(db, settings.jobs_log_dir, env_provider=lambda: guard_env(db))
        interrupted = jobs.recover()
        state = AppState(env_settings=settings, db=db, registry=ModelRegistry(db), experiments=experiments,
                         telemetry=TelemetrySampler(settings.telemetry_interval_s, settings.telemetry_idle_stop_s,
                                                    jobs.active_count),
                         jobs=jobs, token=session_token, overrides=db.get_setting("runtime_overrides", {}))
        app.state.forge = state
        app.state.audit = Audit(settings.home)
        # The listening socket is bound before the lifespan runs (see forge.__main__), so this marks a live server.
        log_event(log, logging.INFO, "forge.started", version=__version__, home=str(settings.home),
                  recovered_runs=recovered, interrupted_jobs=interrupted, bind=f"{settings.host}:{settings.port}")
        yield
        db.close()

    app = FastAPI(title="FORGE", version=__version__, lifespan=lifespan)
    dist = Path(os.environ.get("FORGE_FRONTEND_DIST", Path(__file__).resolve().parents[3] / "frontend" / "dist"))
    csp = content_security_policy(dist / "index.html")

    from fastapi.responses import JSONResponse

    from forge.agents.agent import AgentError
    from forge.engine.study import StudyError

    @app.exception_handler(StudyError)
    @app.exception_handler(AgentError)
    async def domain_error(request: Request, exc: Exception):  # refused input → 422, never a 500 with a traceback
        return JSONResponse({"detail": str(exc)}, status_code=422)

    @app.middleware("http")
    async def guard(request: Request, call_next):
        # Per-session token on every mutating API call (defense against CSRF from other local pages).
        if request.method in MUTATING and request.url.path.startswith("/api/"):
            if not secrets.compare_digest(request.headers.get(TOKEN_HEADER, ""), session_token):
                return JSONResponse({"detail": "Missing or invalid session token"}, status_code=403)
        response = await call_next(request)
        if request.method in MUTATING and request.url.path.startswith("/api/") and response.status_code < 500:
            try:  # who did what — never the request body
                getattr(app.state, "audit", None) and app.state.audit.append(request.headers.get(ACTOR_HEADER), request.method, request.url.path, response.status_code)
            except OSError as e:
                log_event(log, logging.WARNING, "audit.write_failed", error=str(e))
        ct = response.headers.get("content-type", "")
        if (ct.startswith(("application/json", "text/", "application/javascript")) and "charset" not in ct.lower()):
            response.headers["content-type"] = f"{ct}; charset=utf-8"
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")  # no framing: blocks click-jacking of stage buttons
        if not request.url.path.startswith("/api/"):
            response.headers.setdefault("Content-Security-Policy", csp)
        return response

    # DNS-rebinding defense: a localhost service must reject foreign Host headers.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver", settings.host])
    app.add_middleware(CORSMiddleware, allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
                       allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type", TOKEN_HEADER, ACTOR_HEADER])
    for r in (routes_system, routes_models, routes_settings, routes_experiments, routes_studies, routes_jobs,
              routes_hub, routes_analysis, routes_lmstudio, routes_knowledge, routes_agents, routes_assistant, routes_playground, routes_modelmap, routes_projects, routes_governance, routes_autotune):
        app.include_router(r.router)


    if (dist / "index.html").exists():
        app.mount("/", StaticFiles(directory=dist, html=True), name="ui")
    return app
