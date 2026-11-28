from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from typing import Any

from fastapi import Request

from forge.config import Settings
from forge.db import Database
from forge.domain.experiments import ExperimentManager
from forge.hardware.telemetry import TelemetrySampler
from forge.jobs.runner import JobRunner
from forge.registry.registry import ModelRegistry

# Runtime keys a user may override from the UI (validated loopback URLs only).
RUNTIME_KEYS = ("lmstudio_url", "ollama_url")


@dataclass
class AppState:
    env_settings: Settings
    db: Database
    registry: ModelRegistry
    experiments: ExperimentManager
    telemetry: TelemetrySampler
    jobs: JobRunner
    token: str
    discovery_running: bool = False
    overrides: dict[str, Any] = field(default_factory=dict)

    @property
    def settings(self) -> Settings:
        """Effective settings: environment → validated DB overrides."""
        ov = {k: v for k, v in self.overrides.items() if k in RUNTIME_KEYS}
        return dataclasses.replace(self.env_settings, **ov) if ov else self.env_settings


def get_state(request: Request) -> AppState:
    return request.app.state.forge
