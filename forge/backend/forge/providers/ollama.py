from __future__ import annotations

import asyncio
import re
import time

import httpx

from forge.providers.base import DiscoveredModel, ModelProvider, ProviderResult
from forge.providers.http import make_client
from forge.registry.roles import classify_kind


def parse_param_size(s: str | None) -> int | None:
    m = re.fullmatch(r"\s*([\d.]+)\s*([KMBT])\s*", s or "", re.I)
    if not m:
        return None
    return int(float(m.group(1)) * {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}[m.group(2).upper()])


class OllamaProvider(ModelProvider):
    name = "ollama"

    def __init__(self, base_url: str, timeout: float = 3.0, transport: httpx.AsyncBaseTransport | None = None):
        self.base_url, self.timeout, self.transport = base_url, timeout, transport

    async def _show(self, client: httpx.AsyncClient, model: str) -> dict:
        try:
            r = await client.post(f"{self.base_url}/api/show", json={"model": model})
            r.raise_for_status()
            return r.json()
        except (httpx.HTTPError, ValueError):
            return {}

    async def discover(self) -> ProviderResult:
        t0 = time.perf_counter()
        async with make_client(self.timeout, self.transport) as client:
            try:
                r = await client.get(f"{self.base_url}/api/tags")
                r.raise_for_status()
                tags = r.json().get("models", [])
            except httpx.ConnectError:
                return ProviderResult(provider=self.name, status="unreachable", detail=f"Ollama not running at {self.base_url}")
            except (httpx.HTTPError, ValueError) as exc:
                return ProviderResult(provider=self.name, status="error", detail=str(exc))
            try:
                v = (await client.get(f"{self.base_url}/api/version")).json().get("version")
            except (httpx.HTTPError, ValueError):
                v = None
            shows = await asyncio.gather(*(self._show(client, t["name"]) for t in tags))
        models = []
        for tag, show in zip(tags, shows):
            d = tag.get("details", {}) or {}
            info = show.get("model_info", {}) or {}
            arch = info.get("general.architecture") or d.get("family")
            exact = info.get("general.parameter_count")
            caps = show.get("capabilities")
            template = show.get("template") or ""
            license_text = show.get("license") or ""
            if caps and "embedding" in caps and "completion" not in caps:
                kind, evidence = "embedding", "Ollama reports the 'embedding' capability."
            elif caps and "completion" in caps:
                kind, evidence = "generative", "Ollama reports the 'completion' capability."
            else:
                kind, evidence = classify_kind(None, None, tag["name"], gguf_arch=arch or "unknown")
            models.append(DiscoveredModel(
                provider=self.name, locator=f"ollama://{tag['name']}", name=tag["name"], architecture=arch,
                parameter_count=exact or parse_param_size(d.get("parameter_size")),
                parameter_count_source="provider_reported" if (exact or d.get("parameter_size")) else "unknown",
                quantization=d.get("quantization_level"),
                context_length=info.get(f"{arch}.context_length") if arch else None,
                format="ollama", size_bytes=tag.get("size"),
                license=license_text.strip().splitlines()[0][:200] if license_text.strip() else None,
                metadata={
                    "digest": tag.get("digest"), "modified_at": tag.get("modified_at"),
                    "underlying_format": d.get("format"), "families": d.get("families"),
                    "ollama_capabilities": caps, "template_mentions_tools": ".Tools" in template,
                    "ollama_version": v, "vocab_size": info.get(f"{arch}.vocab_size") if arch else None,
                    "model_kind": kind, "model_kind_evidence": evidence,
                },
            ))
        return ProviderResult(provider=self.name, status="ok", models=models,
                              detail=f"Ollama {v}" if v else None, duration_ms=int((time.perf_counter() - t0) * 1000))
