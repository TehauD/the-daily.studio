"""Every starter agent: synthetic data passes the sensitive-data scan, examples verify, built-in generators produce verified,
balanced, leakage-free task sets, and an agent study runs on them."""
import json

import pytest

from forge.agents import safety, templates
from forge.agents.agent import Agent
from forge.agents.verify import verify_task
from forge.engine.runtime import OracleBackend
from forge.engine.study import Study, read_jsonl

DOMAIN = [t for t in templates.TEMPLATES if t != "blank"]


@pytest.mark.parametrize("tid", DOMAIN)
def test_template_is_clean_and_verifiable(tmp_path, tid):
    a = Agent.create(tmp_path, "", tid, True)
    for name, rows in a.tables().items():
        assert not safety.scan_rows(list(rows[0]), rows)["block"], name   # synthetic data never trips the guard
    ts = a.toolset()
    for s in a.meta["skills"]:
        assert s["generator"] and set(s["tools"]) <= set(ts.names)
        for ex in s["examples"]:
            assert verify_task(ts, s["tools"], ex["prompt"], ex["calls"], ex["answer"], s["not_found"] > 0)[0] is None
    summ = a.run_tasks(None, per_skill=20, seed=5, source="template")
    assert all(n >= 15 for n in summ["by_skill"].values()), summ["by_skill"]
    assert summ["splits"]["dev"] > 0 and summ["splits"]["test"] > 0
    first = {}
    for t in a.tasks():
        keys = [v for c in t["reference_calls"] for k, v in c["arguments"].items() if k in ("key", "value", "query")]
        if keys:
            first.setdefault(keys[0].lower(), set()).add(t["split"])
    assert all(len(v) == 1 for v in first.values())                      # no primary entity crosses splits
    assert "patient" not in json.dumps([c for tb in a.meta["tools"]["tables"] for c in tb["columns"]])


def test_template_study_end_to_end_without_teacher(tmp_path, monkeypatch):
    monkeypatch.setenv("FORGE_ISOLATE_RUNS", "0")
    for tid in ("itsm_servicenow", "patient_access"):
        a = Agent.create(tmp_path / "agents", "", tid, True)
        a.run_tasks(None, per_skill=12, seed=1, source="template")
        st = Study.init(tmp_path / "studies", name=tid, profile="smoke", arms=["teacher_filtered"], agent=a,
                        teacher={"provider": "lmstudio", "endpoint": "http://127.0.0.1:9/v1", "model": "t"}, student={"name": "s", "path": str(tmp_path)})
        st.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend({t.prompt: t for t in st.tasks()}))
        eps = read_jsonl(st.episode_path("teacher", "dev", 0))
        assert eps and all(e["score"]["strict_success"] for e in eps)    # every generated task is solvable with the tools
        st.run_stage("build", emit=lambda e: None)
        assert (st.root / "datasets" / "teacher_filtered" / "records.jsonl").stat().st_size > 0


def test_catalogue_and_template_source_api(settings):
    from fastapi.testclient import TestClient

    from forge.api.app import create_app
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        cat = c.get("/api/agents/templates").json()["templates"]
        assert {"itsm_servicenow", "patient_access", "security_triage", "claims_denials", "prior_auth", "pharmacy_benefits"} <= {t["id"] for t in cat}
        assert all(t["domain"] and t["skills"] is not None for t in cat)
        blank = c.post("/api/agents", json={"name": "b", "template": "blank", "no_sensitive_data": True}).json()["id"]
        c.put(f"/api/agents/{blank}", json={"skills": [{"id": "x", "name": "X", "description": "d", "tools": ["calculate"], "not_found": 0, "examples": []}]})
        assert c.post(f"/api/agents/{blank}/steps/tasks", json={"source": "template"}).status_code == 409   # no generator
        assert c.post(f"/api/agents/{blank}/steps/tasks", json={"source": "teacher"}).status_code == 422    # teacher required
