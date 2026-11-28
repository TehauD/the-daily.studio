from __future__ import annotations

import time
from pathlib import Path

from forge.providers.base import ModelProvider, ProviderResult
from forge.providers.hf_config import inspect_hf_dir


class HuggingFaceCacheProvider(ModelProvider):
    """Scans the HF hub cache layout: models--{org}--{name}/snapshots/{rev}/."""

    name = "huggingface_cache"

    def __init__(self, cache_dir: Path):
        self.cache_dir = cache_dir

    async def discover(self) -> ProviderResult:
        t0 = time.perf_counter()
        if not self.cache_dir.is_dir():
            return ProviderResult(provider=self.name, status="not_found", detail=f"No HF cache at {self.cache_dir}")
        models = []
        for repo in sorted(self.cache_dir.glob("models--*")):
            repo_id = repo.name[len("models--"):].replace("--", "/")
            ref = repo / "refs" / "main"
            snaps = repo / "snapshots"
            if not snaps.is_dir():
                continue
            rev = ref.read_text(encoding="utf-8").strip() if ref.exists() else None
            snap = snaps / rev if rev and (snaps / rev).is_dir() else next(iter(sorted(snaps.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)), None)
            if snap is None:
                continue
            incomplete = any((repo / "blobs").glob("*.incomplete")) if (repo / "blobs").is_dir() else False
            m = inspect_hf_dir(snap, self.name, repo_id, f"hf://{repo_id}@{snap.name}",
                               extra={"revision": snap.name, "download_incomplete": incomplete})
            if m:
                models.append(m)
        return ProviderResult(provider=self.name, status="ok", models=models,
                              duration_ms=int((time.perf_counter() - t0) * 1000))
