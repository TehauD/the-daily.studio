from __future__ import annotations

import re
import time
from pathlib import Path, PurePath

import httpx

from forge.providers.base import DiscoveredModel, ModelProvider, ProviderResult
from forge.providers.http import make_client
from forge.providers.local_dir import scan_directory
from forge.registry.roles import classify_kind

_QUANT_SUFFIX = re.compile(r"[-_.](i?q\d[\w]*|f16|f32|bf16|mxfp4|tq\d_0|fp16|q8_0)$", re.I)


def slug(text: str) -> str:
    """Normalize a model handle for matching: lowercase alphanumerics only."""
    return re.sub(r"[^a-z0-9]", "", text.lower())


def file_slugs(path: str) -> set[str]:
    """Candidate slugs for a GGUF path: its file stem without quant suffix and its parent dir without -GGUF."""
    p = PurePath(path.replace("\\", "/"))
    stem = _QUANT_SUFFIX.sub("", p.stem)
    stem = re.sub(r"-\d{5}-of-\d{5}$", "", stem)
    parent = re.sub(r"[-_]gguf$", "", p.parent.name, flags=re.I)
    return {slug(stem), slug(parent)} - {""}


def match_rest_to_files(rest: list[dict], files: list[DiscoveredModel]) -> dict[str, int]:
    """Map REST model id -> index in files. Exact slug match first, then a unique prefix match.

    Why: REST ids carry the *publisher* namespace (qwen/qwen3.8-27b) while files live under the
    *uploader* directory (lmstudio-community/Qwen3.8-27B-GGUF/...), so raw substring matching fails
    and produced duplicate rows.
    """
    cands = [file_slugs(m.storage_path or "") for m in files]
    out: dict[str, int] = {}
    taken: set[int] = set()
    for entry in rest:
        rid = str(entry.get("id", ""))
        if not rid:
            continue
        if entry.get("path"):  # newer LM Studio builds report the file path directly
            tail = slug(PurePath(str(entry["path"]).replace("\\", "/")).name)
            for i, m in enumerate(files):
                if i not in taken and slug(PurePath((m.storage_path or "").replace("\\", "/")).name) == tail:
                    out[rid] = i
                    break
            if rid in out:
                taken.add(out[rid])
                continue
        key = slug(rid.split("/")[-1].split("@")[0])
        exact = [i for i, c in enumerate(cands) if i not in taken and key in c]
        if len(exact) >= 1:
            out[rid] = exact[0]
            taken.add(exact[0])
            continue
        prefix = [i for i, c in enumerate(cands) if i not in taken and any(x.startswith(key) or key.startswith(x) for x in c)]
        if len(prefix) == 1:
            out[rid] = prefix[0]
            taken.add(prefix[0])
    return out


class LMStudioProvider(ModelProvider):
    """Filesystem scan gives exact GGUF metadata; the REST API (when running) adds load state and inference handles."""

    name = "lmstudio"

    def __init__(self, base_url: str, model_dirs: tuple[Path, ...], timeout: float = 3.0,
                 transport: httpx.AsyncBaseTransport | None = None):
        self.base_url, self.model_dirs, self.timeout, self.transport = base_url, model_dirs, timeout, transport

    async def _rest(self) -> tuple[list[dict], str]:
        async with make_client(self.timeout, self.transport) as client:
            try:
                r = await client.get(f"{self.base_url}/api/v0/models")
                if r.status_code == 200:
                    return r.json().get("data", []), "rest_v0"
                r = await client.get(f"{self.base_url}/v1/models")
                r.raise_for_status()
                return r.json().get("data", []), "openai_v1"
            except httpx.ConnectError:
                return [], "unreachable"
            except (httpx.HTTPError, ValueError) as exc:
                return [], f"error: {exc}"

    async def discover(self) -> ProviderResult:
        t0 = time.perf_counter()
        files: list[DiscoveredModel] = []
        for d in self.model_dirs:
            if d.is_dir():
                files.extend(scan_directory(d, self.name))
        rest, mode = await self._rest()
        mapping = match_rest_to_files(rest, files)
        for entry in rest:
            i = mapping.get(str(entry.get("id")))
            if i is None:
                continue
            m = files[i]
            m.metadata.update(lmstudio_id=entry.get("id"), lmstudio_state=entry.get("state"),
                              lmstudio_capabilities=entry.get("capabilities"), lmstudio_type=entry.get("type"))
            if entry.get("type") == "embeddings":
                m.metadata.update(model_kind="embedding", model_kind_evidence="LM Studio reports type 'embeddings'.")
        for entry in rest:
            if str(entry.get("id")) in mapping or entry.get("type") == "embeddings":
                continue
            files.append(DiscoveredModel(
                provider=self.name, locator=f"lmstudio://{entry['id']}", name=entry["id"],
                architecture=entry.get("arch"), quantization=entry.get("quantization"),
                context_length=entry.get("max_context_length"),
                format="mlx" if entry.get("compatibility_type") == "mlx" else ("gguf" if entry.get("compatibility_type") == "gguf" else "remote_api"),
                metadata={"lmstudio_id": entry["id"], "lmstudio_state": entry.get("state"),
                          "lmstudio_capabilities": entry.get("capabilities"), "lmstudio_type": entry.get("type"),
                          "publisher": entry.get("publisher"), "file_not_located": True,
                          **dict(zip(("model_kind", "model_kind_evidence"),
                                     classify_kind(None, None, entry["id"], provider_type=entry.get("type"))))},
            ))
        if not files and mode == "unreachable":
            return ProviderResult(provider=self.name, status="not_found", detail="LM Studio server not running and no model directory found")
        detail = f"server: {mode}; dirs: {[str(d) for d in self.model_dirs if d.is_dir()]}"
        return ProviderResult(provider=self.name, status="ok", models=files, detail=detail,
                              duration_ms=int((time.perf_counter() - t0) * 1000))
