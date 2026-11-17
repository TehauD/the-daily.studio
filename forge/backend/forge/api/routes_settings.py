from __future__ import annotations

import re
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from forge.api.state import AppState, get_state
from forge.config import is_loopback_host
from forge.security.paths import PathSecurityError, validate_user_directory

router = APIRouter(prefix="/api/settings", tags=["settings"])


class RuntimeBody(BaseModel):
    lmstudio_url: str | None = None
    ollama_url: str | None = None


@router.put("/runtime")
def set_runtime(body: RuntimeBody, st: AppState = Depends(get_state)):
    """Persisted overrides layered on top of environment settings. Loopback URLs only."""
    ov = dict(st.overrides)
    for k, v in body.model_dump().items():
        if v is None:
            continue
        if v == "":
            ov.pop(k, None)
            continue
        u = urlparse(v)
        if u.scheme not in ("http", "https") or not u.hostname or not is_loopback_host(u.hostname):
            raise HTTPException(422, f"{k} must be an http(s) loopback URL")
        ov[k] = v.rstrip("/")
    st.db.set_setting("runtime_overrides", ov)
    st.overrides = ov
    return get_settings(st)


@router.get("/export")
def export_config(st: AppState = Depends(get_state)):
    return {"forge_config_version": 1, "runtime_overrides": st.overrides,
            "model_dirs": st.db.get_setting("model_dirs", []), "endpoints": st.db.get_setting("endpoints", [])}


class ImportBody(BaseModel):
    forge_config_version: int
    runtime_overrides: dict = Field(default_factory=dict)
    model_dirs: list[str] = Field(default_factory=list)
    endpoints: list[dict] = Field(default_factory=list)


@router.post("/import")
def import_config(body: ImportBody, st: AppState = Depends(get_state)):
    """Every imported value passes the same validators as the individual endpoints."""
    if body.forge_config_version != 1:
        raise HTTPException(422, "Unsupported config version")
    set_runtime(RuntimeBody(**{k: v for k, v in body.runtime_overrides.items() if k in ("lmstudio_url", "ollama_url")}), st)
    for d in body.model_dirs:
        try:
            add_dir(DirBody(path=d), st)
        except HTTPException:
            pass  # directories from another machine may not exist here
    for e in body.endpoints:
        add_endpoint(EndpointBody(**e), st)
    return get_settings(st)


@router.get("")
def get_settings(st: AppState = Depends(get_state)):
    s = st.settings
    return {
        "runtime_overrides": st.overrides,
        "home": str(s.home), "bind": {"host": s.host, "port": s.port, "remote_allowed": s.allow_remote_bind},
        "hf_hub_cache": str(s.hf_hub_cache), "ollama_url": s.ollama_url, "lmstudio_url": s.lmstudio_url,
        "lmstudio_model_dirs": [str(p) for p in s.lmstudio_model_dirs],
        "model_dirs": st.db.get_setting("model_dirs", []), "endpoints": st.db.get_setting("endpoints", []),
    }


class DirBody(BaseModel):
    path: str


@router.post("/model-dirs")
def add_dir(body: DirBody, st: AppState = Depends(get_state)):
    try:
        p = str(validate_user_directory(body.path))
    except PathSecurityError as e:
        raise HTTPException(422, str(e))
    dirs = st.db.get_setting("model_dirs", [])
    if p not in dirs:
        dirs.append(p)
        st.db.set_setting("model_dirs", dirs)
    return {"model_dirs": dirs}


@router.delete("/model-dirs")
def remove_dir(body: DirBody, st: AppState = Depends(get_state)):
    dirs = [d for d in st.db.get_setting("model_dirs", []) if d != body.path]
    st.db.set_setting("model_dirs", dirs)
    return {"model_dirs": dirs}


class EndpointBody(BaseModel):
    label: str = Field(pattern=r"^[A-Za-z0-9_\-]{1,40}$")
    base_url: str
    api_key_env: str | None = Field(None, pattern=r"^[A-Z_][A-Z0-9_]{0,63}$")
    allow_remote: bool = False


@router.post("/endpoints")
def add_endpoint(body: EndpointBody, st: AppState = Depends(get_state)):
    u = urlparse(body.base_url)
    if u.scheme not in ("http", "https") or not u.hostname:
        raise HTTPException(422, "base_url must be an http(s) URL")
    if not is_loopback_host(u.hostname) and not body.allow_remote:
        raise HTTPException(422, "Non-loopback endpoint requires allow_remote=true (local-first default)")
    eps = [e for e in st.db.get_setting("endpoints", []) if e["label"] != body.label]
    eps.append(body.model_dump())
    st.db.set_setting("endpoints", eps)
    return {"endpoints": eps}


@router.delete("/endpoints/{label}")
def remove_endpoint(label: str, st: AppState = Depends(get_state)):
    if not re.fullmatch(r"[A-Za-z0-9_\-]{1,40}", label):
        raise HTTPException(422, "Invalid label")
    eps = [e for e in st.db.get_setting("endpoints", []) if e["label"] != label]
    st.db.set_setting("endpoints", eps)
    return {"endpoints": eps}
