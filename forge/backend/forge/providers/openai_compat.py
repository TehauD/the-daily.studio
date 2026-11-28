from __future__ import annotations

import os
import time

import httpx

from forge.providers.base import DiscoveredModel, ModelProvider, ProviderResult
from forge.providers.http import make_client


def normalize_base(url: str) -> str:
    url = url.rstrip("/")
    return url[:-3] if url.endswith("/v1") else url


class OpenAICompatibleProvider(ModelProvider):
    """Any server exposing GET /v1/models (llama.cpp server, vLLM, LocalAI, Foundry Local, ...).

    Discovery sends no user data. API keys are never stored: an optional env var *name* is referenced.
    """

    def __init__(self, label: str, base_url: str, api_key_env: str | None = None, timeout: float = 3.0,
                 transport: httpx.AsyncBaseTransport | None = None):
        self.name = f"endpoint:{label}"
        self.label, self.base_url, self.api_key_env = label, normalize_base(base_url), api_key_env
        self.timeout, self.transport = timeout, transport

    async def discover(self) -> ProviderResult:
        t0 = time.perf_counter()
        headers = {}
        if self.api_key_env and os.environ.get(self.api_key_env):
            headers["Authorization"] = f"Bearer {os.environ[self.api_key_env]}"
        async with make_client(self.timeout, self.transport, headers) as client:
            try:
                r = await client.get(f"{self.base_url}/v1/models")
                r.raise_for_status()
                data = r.json().get("data", [])
            except httpx.ConnectError:
                return ProviderResult(provider=self.name, status="unreachable", detail=f"{self.base_url} not reachable")
            except (httpx.HTTPError, ValueError) as exc:
                return ProviderResult(provider=self.name, status="error", detail=str(exc))
        def kind(mid: str) -> dict:
            if "embed" in mid.lower():
                return {"model_kind": "embedding", "model_kind_evidence": "Model id indicates an embedding model."}
            return {"model_kind": "generative", "model_kind_evidence": "Listed by a chat-completions endpoint (assumed chat)."}

        models = [DiscoveredModel(provider=self.name, locator=f"{self.base_url}#{m['id']}", name=m["id"],
                                  format="remote_api", metadata={"endpoint": self.base_url, "owned_by": m.get("owned_by"),
                                                                  "max_model_len": m.get("max_model_len"), **kind(m["id"])},
                                  context_length=m.get("max_model_len") if isinstance(m.get("max_model_len"), int) else None)
                  for m in data if "id" in m]
        return ProviderResult(provider=self.name, status="ok", models=models,
                              duration_ms=int((time.perf_counter() - t0) * 1000))
