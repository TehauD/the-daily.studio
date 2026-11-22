"""Runtime configuration.

Why: one immutable settings object, resolved once from environment, keeps every
module deterministic and testable (tests inject a temp FORGE_HOME).
"""
from __future__ import annotations

import ipaddress
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path


def user_home() -> Path:
    """Path.home(), or a harmless fallback when the OS profile is unresolvable (e.g. Windows without USERPROFILE).
    Only used for *discovery* defaults; FORGE_HOME / LOCALAPPDATA decide where state lives."""
    try:
        return Path.home()
    except (RuntimeError, KeyError):
        import tempfile
        return Path(tempfile.gettempdir())


def _default_home() -> Path:
    # Windows: keep state out of roaming profiles (large artifacts must not sync).
    if sys.platform == "win32" and os.environ.get("LOCALAPPDATA"):
        return Path(os.environ["LOCALAPPDATA"]) / "Forge"
    return user_home() / ".forge"


def _hf_hub_cache() -> Path:
    if os.environ.get("HF_HUB_CACHE"):
        return Path(os.environ["HF_HUB_CACHE"])
    if os.environ.get("HF_HOME"):
        return Path(os.environ["HF_HOME"]) / "hub"
    return user_home() / ".cache" / "huggingface" / "hub"


def _ollama_url() -> str:
    raw = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").strip()
    if not raw.startswith(("http://", "https://")):
        raw = f"http://{raw}"
    # OLLAMA_HOST=0.0.0.0 is a *bind* address; the client must use loopback.
    return raw.replace("0.0.0.0", "127.0.0.1").rstrip("/")


def is_loopback_host(host: str) -> bool:
    if host in {"localhost"}:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


@dataclass(frozen=True)
class Settings:
    home: Path = field(default_factory=lambda: Path(os.environ.get("FORGE_HOME", _default_home())))
    host: str = field(default_factory=lambda: os.environ.get("FORGE_HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: int(os.environ.get("FORGE_PORT", "8765")))
    allow_remote_bind: bool = field(default_factory=lambda: os.environ.get("FORGE_ALLOW_REMOTE_BIND") == "1")
    hf_hub_cache: Path = field(default_factory=_hf_hub_cache)
    ollama_url: str = field(default_factory=_ollama_url)
    lmstudio_url: str = field(default_factory=lambda: os.environ.get("LMSTUDIO_URL", "http://127.0.0.1:1234").rstrip("/"))
    lmstudio_model_dirs: tuple[Path, ...] = field(
        default_factory=lambda: (user_home() / ".lmstudio" / "models", user_home() / ".cache" / "lm-studio" / "models")
    )
    http_timeout_s: float = field(default_factory=lambda: float(os.environ.get("FORGE_HTTP_TIMEOUT", "3.0")))
    telemetry_interval_s: float = 2.0
    telemetry_idle_stop_s: float = 60.0

    @property
    def db_path(self) -> Path:
        return self.home / "forge.db"

    @property
    def artifacts_dir(self) -> Path:
        return self.home / "artifacts"

    @property
    def datasets_dir(self) -> Path:
        return self.home / "datasets"

    @property
    def trajectories_dir(self) -> Path:
        return self.home / "trajectories"

    @property
    def logs_dir(self) -> Path:
        return self.home / "logs"

    @property
    def studies_dir(self) -> Path:
        return self.home / "studies"

    @property
    def jobs_log_dir(self) -> Path:
        return self.logs_dir / "jobs"

    def ensure_dirs(self) -> None:
        for d in (self.home, self.artifacts_dir, self.datasets_dir, self.trajectories_dir, self.logs_dir,
                  self.studies_dir, self.jobs_log_dir):
            d.mkdir(parents=True, exist_ok=True)

    def validate_bind(self) -> None:
        if not is_loopback_host(self.host) and not self.allow_remote_bind:
            raise RuntimeError(
                f"Refusing to bind to non-loopback host '{self.host}'. "
                "Set FORGE_ALLOW_REMOTE_BIND=1 to override deliberately."
            )
