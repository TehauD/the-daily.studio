from __future__ import annotations

import os
import time
from pathlib import Path

from forge.providers.base import DiscoveredModel, ModelProvider, ProviderResult
from forge.providers.formats import FormatError, read_gguf_metadata
from forge.providers.hf_config import inspect_hf_dir
from forge.registry.roles import classify_kind

MAX_DEPTH = 4
SKIP_DIRS = {".git", "__pycache__", "node_modules", ".cache", "blobs"}


def gguf_to_model(path: Path, provider: str) -> DiscoveredModel | None:
    try:
        meta = read_gguf_metadata(path)
    except (OSError, FormatError) as exc:
        return DiscoveredModel(provider=provider, locator=f"file://{path}", name=path.stem, format="gguf",
                               storage_path=str(path), size_bytes=path.stat().st_size,
                               metadata={"read_error": str(exc)})
    if path.name.startswith("mmproj"):
        return None  # vision projector, not a standalone LM
    name = meta.get("name") or path.stem
    kind, evidence = classify_kind(None, None, f"{name} {path.stem}", gguf_arch=meta.get("architecture"))
    b = meta.get("parameter_breakdown") or {}
    return DiscoveredModel(
        provider=provider, locator=f"file://{path}", name=name,
        architecture=meta.get("architecture"), parameter_count=meta.get("parameter_count") or None,
        parameter_count_source="exact_header" if meta.get("parameter_count") else "unknown",
        quantization=meta.get("quantization"), context_length=meta.get("context_length"),
        format="gguf", storage_path=str(path), size_bytes=path.stat().st_size, license=meta.get("license"),
        metadata={**{k: meta[k] for k in ("gguf_version", "has_chat_template", "template_mentions_tools",
                                           "embedding_length", "block_count", "tensor_count")},
                  "model_kind": kind, "model_kind_evidence": evidence, "file_name": path.name,
                  "parameter_report": {"stored_total": meta.get("parameter_count"), "embedding": b.get("embedding"),
                                       "lm_head_stored": b.get("lm_head"),
                                       "non_embedding": (meta.get("parameter_count") or 0) - (b.get("embedding") or 0) - (b.get("lm_head") or 0)}
                  if b else None},
    )


def scan_directory(root: Path, provider: str) -> list[DiscoveredModel]:
    found: list[DiscoveredModel] = []
    root_depth = len(root.parts)
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        d = Path(dirpath)
        dirnames[:] = [n for n in dirnames if n not in SKIP_DIRS and len(d.parts) - root_depth < MAX_DEPTH]
        if "config.json" in filenames and any(f.endswith((".safetensors", ".bin")) or f == "model.safetensors.index.json" for f in filenames):
            m = inspect_hf_dir(d, provider, d.name, f"file://{d}")
            if m:
                found.append(m)
                dirnames[:] = []  # don't descend into a model dir
                continue
        for f in sorted(filenames):
            if f.lower().endswith(".gguf"):
                # Only the first shard of split GGUFs (…-00001-of-0000N.gguf)
                if "-of-" in f and "-00001-of-" not in f:
                    continue
                m = gguf_to_model(d / f, provider)
                if m:
                    found.append(m)
    return found


class LocalDirectoryProvider(ModelProvider):
    name = "local_directory"

    def __init__(self, directories: list[Path]):
        self.directories = directories

    async def discover(self) -> ProviderResult:
        t0 = time.perf_counter()
        if not self.directories:
            return ProviderResult(provider=self.name, status="disabled", detail="No model directories configured")
        models, missing = [], []
        for d in self.directories:
            if not d.is_dir():
                missing.append(str(d))
                continue
            models.extend(scan_directory(d, self.name))
        return ProviderResult(provider=self.name, status="ok", models=models,
                              detail=f"Missing directories: {missing}" if missing else None,
                              duration_ms=int((time.perf_counter() - t0) * 1000))
