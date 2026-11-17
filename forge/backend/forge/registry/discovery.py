"""Discovery orchestration: run all providers concurrently, persist, and record the run."""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from forge.config import Settings
from forge.db import Database
from forge.hardware.probe import probe_torch, optional_packages
from forge.providers.base import ModelProvider, ProviderResult
from forge.providers.hf_cache import HuggingFaceCacheProvider
from forge.providers.lmstudio import LMStudioProvider
from forge.providers.local_dir import LocalDirectoryProvider
from forge.providers.ollama import OllamaProvider
from forge.providers.openai_compat import OpenAICompatibleProvider
from forge.registry.capabilities import compute_capabilities
from forge.registry.registry import ModelRegistry
from forge.util import new_id, utcnow

log = logging.getLogger("forge.discovery")
PROVIDER_TIMEOUT_S = 60.0


def hardware_context() -> dict:
    t = probe_torch()
    return {"cuda_available": t.cuda_available, "bitsandbytes": optional_packages().get("bitsandbytes", False)}


def build_providers(settings: Settings, db: Database) -> list[ModelProvider]:
    dirs = [Path(p) for p in db.get_setting("model_dirs", [])]
    endpoints = db.get_setting("endpoints", [])
    providers: list[ModelProvider] = [
        OllamaProvider(settings.ollama_url, settings.http_timeout_s),
        LMStudioProvider(settings.lmstudio_url, settings.lmstudio_model_dirs, settings.http_timeout_s),
        HuggingFaceCacheProvider(settings.hf_hub_cache),
        LocalDirectoryProvider(dirs),
    ]
    providers += [OpenAICompatibleProvider(e["label"], e["base_url"], e.get("api_key_env"), settings.http_timeout_s) for e in endpoints]
    return providers


async def _guarded(p: ModelProvider) -> ProviderResult:
    try:
        return await asyncio.wait_for(p.discover(), PROVIDER_TIMEOUT_S)
    except asyncio.TimeoutError:
        return ProviderResult(provider=p.name, status="error", detail="Discovery timed out")
    except Exception as exc:  # one broken provider must not break discovery
        log.exception("provider failed")
        return ProviderResult(provider=p.name, status="error", detail=repr(exc))


async def run_discovery(db: Database, providers: list[ModelProvider], hw: dict) -> dict:
    run_id, started = new_id("disc"), utcnow()
    results = await asyncio.gather(*(_guarded(p) for p in providers))
    registry = ModelRegistry(db)
    summary = {}
    for res in results:
        if res.status == "ok":
            seen = {registry.upsert(m, compute_capabilities(m, hw)) for m in res.models}
            missing = registry.mark_unseen(res.provider, seen, "missing")
        else:
            # Provider offline ≠ models deleted. Keep records, flag them as unverified.
            registry.mark_provider(res.provider, "provider_offline")
            missing = 0
        summary[res.provider] = {"status": res.status, "detail": res.detail, "models": len(res.models),
                                 "marked_missing": missing, "duration_ms": res.duration_ms}
    with db.tx() as c:
        c.execute("INSERT INTO discovery_runs(id, started_at, finished_at, results) VALUES (?,?,?,?)",
                  (run_id, started, utcnow(), json.dumps(summary)))
    return {"run_id": run_id, "started_at": started, "providers": summary}
