from __future__ import annotations

import pytest

from forge.config import Settings
from forge.db import Database
from forge.registry import capabilities


@pytest.fixture(autouse=True)
def _known_architectures(monkeypatch):
    # Make capability rules deterministic regardless of whether transformers is installed on the test host.
    monkeypatch.setattr(capabilities, "_transformers_causal_lm_types", lambda: frozenset({"qwen2", "llama", "gemma3"}))


@pytest.fixture
def settings(tmp_path, monkeypatch):
    s = Settings(home=tmp_path / "home", hf_hub_cache=tmp_path / "hf" / "hub",
                 ollama_url="http://127.0.0.1:1", lmstudio_url="http://127.0.0.1:2",
                 lmstudio_model_dirs=(tmp_path / "lms",), http_timeout_s=0.5)
    s.ensure_dirs()
    return s


@pytest.fixture
def db(tmp_path):
    d = Database(tmp_path / "t.db")
    yield d
    d.close()
