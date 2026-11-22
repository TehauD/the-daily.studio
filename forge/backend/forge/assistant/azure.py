"""Azure OpenAI client for the FORGE assistant. Off unless configured; the only non-loopback service FORGE calls on its own.

Configuration (System Settings → Integrations, or environment variables; Settings win):
    FORGE_AZURE_OPENAI_ENDPOINT     https://<resource>.openai.azure.com
    FORGE_AZURE_OPENAI_DEPLOYMENT   your chat deployment name (e.g. gpt-4.1)
    FORGE_AZURE_OPENAI_API_VERSION  default 2024-10-21
    FORGE_AZURE_OPENAI_KEY_ENV      name of the variable holding the key (default AZURE_OPENAI_API_KEY)
The key itself is only ever read from that environment variable — FORGE never stores it.

Endpoint hosts are restricted to Azure OpenAI / Azure AI domains over https. No redirects. The system proxy is used only
if you opt in (corporate networks).
"""
from __future__ import annotations

import os
import re
import time
from dataclasses import asdict, dataclass
from typing import Any
from urllib.parse import quote, urlparse

import httpx

AZURE_SUFFIXES = (".openai.azure.com", ".cognitiveservices.azure.com", ".services.ai.azure.com")
DEFAULT_API_VERSION = "2024-10-21"
DEFAULT_KEY_ENV = "AZURE_OPENAI_API_KEY"
ENV_NAME = re.compile(r"^[A-Z_][A-Z0-9_]{0,63}$")
DEPLOYMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
API_VERSION = re.compile(r"^\d{4}-\d{2}-\d{2}(-preview)?$")


class AzureError(RuntimeError):
    def __init__(self, msg: str, status: int = 502):
        super().__init__(msg)
        self.status = status


@dataclass
class AzureConfig:
    endpoint: str = ""
    deployment: str = ""
    api_version: str = DEFAULT_API_VERSION
    key_env: str = DEFAULT_KEY_ENV
    enabled: bool = False
    use_system_proxy: bool = False
    source: str = "none"

    def validate(self) -> "AzureConfig":
        u = urlparse(self.endpoint.strip())
        if u.scheme != "https" or not u.hostname or not u.hostname.lower().endswith(AZURE_SUFFIXES):
            raise AzureError("Endpoint must be https://<resource>.openai.azure.com (or another Azure OpenAI / Azure AI host)", 422)
        if u.path not in ("", "/") or u.query or u.username or u.password or u.port not in (None, 443):
            raise AzureError("Endpoint must be just the resource URL, e.g. https://my-resource.openai.azure.com", 422)
        self.endpoint = f"https://{u.hostname.lower()}"
        if not DEPLOYMENT.match(self.deployment or ""):
            raise AzureError("Deployment name: letters, digits, . _ - (the name you gave the deployment in Azure)", 422)
        if not API_VERSION.match(self.api_version or ""):
            raise AzureError("API version looks like 2024-10-21", 422)
        if not ENV_NAME.match(self.key_env or ""):
            raise AzureError("Key variable name: UPPER_CASE letters, digits and _ (e.g. AZURE_OPENAI_API_KEY)", 422)
        return self

    @property
    def key_present(self) -> bool:
        return bool(os.environ.get(self.key_env, "").strip())

    @property
    def available(self) -> bool:
        return bool(self.enabled and self.endpoint and self.deployment and self.key_present)

    def public(self) -> dict[str, Any]:
        d = asdict(self)
        d |= {"key_present": self.key_present, "available": self.available,
              "endpoint_host": urlparse(self.endpoint).hostname if self.endpoint else None}
        return d


def load_config(stored: dict | None) -> AzureConfig:
    """Settings (stored in FORGE's database) take precedence over environment variables."""
    if stored and stored.get("endpoint"):
        cfg = AzureConfig(**{k: v for k, v in stored.items() if k in AzureConfig.__dataclass_fields__ and k != "source"}, source="settings")
    elif os.environ.get("FORGE_AZURE_OPENAI_ENDPOINT"):
        cfg = AzureConfig(endpoint=os.environ["FORGE_AZURE_OPENAI_ENDPOINT"], deployment=os.environ.get("FORGE_AZURE_OPENAI_DEPLOYMENT", ""),
                          api_version=os.environ.get("FORGE_AZURE_OPENAI_API_VERSION", DEFAULT_API_VERSION),
                          key_env=os.environ.get("FORGE_AZURE_OPENAI_KEY_ENV", DEFAULT_KEY_ENV), enabled=True, source="env")
    else:
        return AzureConfig()
    try:
        return cfg.validate()
    except AzureError:
        cfg.enabled = False  # an invalid configuration is never used
        return cfg


class AzureClient:
    def __init__(self, cfg: AzureConfig, transport: httpx.BaseTransport | None = None, timeout_s: float = 120.0):
        if not cfg.available:
            raise AzureError("Azure OpenAI is not configured (endpoint, deployment, enabled, and the key variable set)", 409)
        self.cfg = cfg
        self.url = (f"{cfg.endpoint}/openai/deployments/{quote(cfg.deployment, safe='')}/chat/completions"
                    f"?api-version={quote(cfg.api_version, safe='')}")
        self.client = httpx.Client(timeout=timeout_s, trust_env=cfg.use_system_proxy, follow_redirects=False, transport=transport,
                                   headers={"api-key": os.environ[cfg.key_env].strip(), "Content-Type": "application/json"})

    def chat(self, messages: list[dict[str, str]], max_out: int = 1500) -> dict[str, Any]:
        body: dict[str, Any] = {"messages": messages, "max_completion_tokens": max_out}
        t0 = time.perf_counter()
        for attempt in range(3):
            try:
                r = self.client.post(self.url, json=body)
            except httpx.HTTPError as e:
                raise AzureError(f"Could not reach Azure OpenAI ({type(e).__name__}). Check the endpoint and your network/proxy.") from e
            if r.status_code == 400 and "max_completion_tokens" in r.text and "max_completion_tokens" in body:
                body["max_tokens"] = body.pop("max_completion_tokens")  # older model / API version
                continue
            if r.status_code == 429 and attempt < 2:
                time.sleep(min(20.0, float(r.headers.get("retry-after", "3") or 3)))
                continue
            break
        if r.status_code in (401, 403):
            raise AzureError(f"Azure rejected the credentials (HTTP {r.status_code}). Check the key in {self.cfg.key_env} and the resource.", 502)
        if r.status_code == 404:
            raise AzureError(f"Deployment '{self.cfg.deployment}' not found at {self.cfg.endpoint} (or API version {self.cfg.api_version} unsupported).", 502)
        if r.status_code == 429:
            raise AzureError("Azure OpenAI rate limit reached; try again shortly.", 503)
        if r.status_code >= 400:
            msg = r.text[:300]
            try:
                msg = r.json().get("error", {}).get("message", msg)
            except ValueError:
                pass
            raise AzureError(f"Azure OpenAI error {r.status_code}: {msg}", 502)
        if r.is_redirect:
            raise AzureError("Azure OpenAI answered with a redirect; refused.", 502)
        data = r.json()
        choice = (data.get("choices") or [{}])[0]
        text = (choice.get("message") or {}).get("content") or ""
        finish = choice.get("finish_reason")
        if finish == "content_filter" and not text:
            text = "_Azure's content filter blocked this answer._"
        return {"text": text, "finish_reason": finish, "usage": data.get("usage") or {}, "model": data.get("model"),
                "latency_ms": int((time.perf_counter() - t0) * 1000)}
