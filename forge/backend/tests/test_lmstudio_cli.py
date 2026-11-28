import os
import stat
import sys

import pytest

from forge.api import routes_lmstudio
from forge.providers import lmstudio_cli
from tests.test_api import client  # noqa: F401  (fixture)


@pytest.fixture
def fake_lms(tmp_path, monkeypatch):
    """A stand-in `lms` that records its argv, so we can prove the exact command FORGE runs."""
    log = tmp_path / "argv.txt"
    if sys.platform == "win32":
        exe = tmp_path / "lms.cmd"
        exe.write_text(f'@echo %* > "{log}"\r\n@echo unloaded\r\n')
    else:
        exe = tmp_path / "lms"
        exe.write_text(f'#!/bin/sh\necho "$@" > "{log}"\necho unloaded\n')
        exe.chmod(exe.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setenv("FORGE_LMS_PATH", str(exe))
    return exe, log


def test_find_lms_prefers_env(fake_lms):
    assert lmstudio_cli.find_lms() == str(fake_lms[0])


def test_unload_runs_fixed_command_and_confirms_state(fake_lms):
    exe, log = fake_lms
    states = iter([["qwen/qwen3.8-27b"], []])
    res = lmstudio_cli.unload_all(str(exe), lambda: next(states, []), confirm_s=5)
    assert res["ok"] and res["exit_code"] == 0 and res["loaded_after"] == []
    assert log.read_text().split() == ["unload", "--all"]


def test_unload_reports_model_still_loaded(fake_lms):
    res = lmstudio_cli.unload_all(str(fake_lms[0]), lambda: ["stuck-model"], confirm_s=0.5)
    assert not res["ok"] and res["loaded_after"] == ["stuck-model"]


def test_unload_route(client, fake_lms, monkeypatch):  # noqa: F811
    monkeypatch.setattr(routes_lmstudio, "_loaded", lambda st: [])
    r = client.post("/api/lmstudio/unload")
    assert r.status_code == 200 and r.json()["command"].endswith("unload --all")
    st = client.app.state.forge
    with st.db.tx() as c:  # a live collect job owns the teacher → refuse
        c.execute("INSERT INTO jobs(id, kind, label, argv, gpu, status, pid, log_path, created_at) VALUES "
                  "('job_c','stage:collect','c','[]',1,'running',?,'x',datetime())", (os.getpid(),))
    assert client.post("/api/lmstudio/unload").status_code == 409
    assert client.get("/api/lmstudio/status").json()["cli_found"] is True


def test_unload_route_without_cli(client, monkeypatch):  # noqa: F811
    monkeypatch.setattr(lmstudio_cli, "find_lms", lambda: None)
    assert client.post("/api/lmstudio/unload").status_code == 404
