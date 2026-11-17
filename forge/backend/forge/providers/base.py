"""Provider contract. Each provider discovers models and reports its own health.

Inference/chat lives behind the same interface in Phase 2 (`chat()`), so the
teacher agent engine never imports a concrete provider.
"""
from __future__ import annotations

import abc
from typing import Any, Literal

from pydantic import BaseModel, Field

ModelFormat = Literal["hf_safetensors", "hf_pytorch_bin", "gguf", "mlx", "ollama", "remote_api", "unknown"]


class DiscoveredModel(BaseModel):
    provider: str
    locator: str  # provider-unique handle: ollama tag, filesystem path, endpoint+model id
    name: str
    architecture: str | None = None
    parameter_count: int | None = None
    parameter_count_source: Literal["exact_header", "provider_reported", "config_estimate", "unknown"] = "unknown"
    quantization: str | None = None
    context_length: int | None = None
    format: ModelFormat = "unknown"
    storage_path: str | None = None
    size_bytes: int | None = None
    license: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProviderResult(BaseModel):
    provider: str
    status: Literal["ok", "unreachable", "not_found", "error", "disabled"]
    detail: str | None = None
    models: list[DiscoveredModel] = Field(default_factory=list)
    duration_ms: int = 0


class ModelProvider(abc.ABC):
    name: str

    @abc.abstractmethod
    async def discover(self) -> ProviderResult: ...
