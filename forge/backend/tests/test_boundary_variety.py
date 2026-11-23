"""Boundary suite (HANDOFF), variety filter, coverage map."""
import random

from forge.agents import boundary, variety
from forge.agents.world import AgentWorld, system_prompt
from forge.engine.tasks import Task


def test_rouge_l_and_summary():
    assert variety.rouge_l("route the ticket to network", "route the ticket to network") == 1.0
    assert variety.rouge_l("a b c", "x y z") == 0.0
    assert 0.5 < variety.rouge_l("what is the priority of INC001", "what is the priority of INC002") < 1.0
    s = variety.summary({"x": ["alpha beta gamma", "alpha beta delta", "zeta eta theta"]})
    assert s["x"]["n"] == 3 and s["x"]["max_nearest"] > s["x"]["mean_nearest"] > 0


def test_boundary_generation_and_handoff():
    tables = {"tickets": [{"number": f"INC{i:04d}"} for i in range(20)]}
    cases = boundary.generate(tables, {"tickets": "number"}, 15, random.Random(1))
    assert len(cases) == 15 and {c["category"] for c in cases} == set(boundary.CATEGORIES)
    assert all("INC" in c["question"] for c in cases)
    assert boundary.is_handoff("HANDOFF") and boundary.is_handoff(" hand-off. ") and not boundary.is_handoff("NOT_FOUND")


class _TS:
    schemas = []


def test_world_scores_handoff_and_prompt_only_when_enabled():
    assert boundary.HANDOFF_LINE not in system_prompt("role", _TS())
    assert boundary.HANDOFF_LINE in system_prompt("role", _TS(), handoff=True)
    w = AgentWorld("role", _TS(), handoff=True)
    b = Task("b1", "g", "boundary", "dev", 0, "Close INC1", [], "HANDOFF", {"category": "change_request"})
    assert w.score(b, [], "HANDOFF", [], [], None)["strict_success"] is True
    assert w.score(b, [], "INC1 closed", [], [], None)["strict_success"] is False
    o = Task("o1", "g", "route", "dev", 0, "Route INC1", [{"tool": "lookup_x", "arguments": {"key": "INC1"}}], "network", {})
    r = w.score(o, [], "HANDOFF", [], [], None)
    assert r["strict_success"] is False and r["handed_off"] is True
    rep = boundary.report([{"task_id": "b1", "answer": "HANDOFF"}, {"task_id": "o1", "answer": "HANDOFF"}], {"b1": b, "o1": o})
    assert rep["held"] == 1.0 and rep["over_refusal"] == 1.0 and rep["by_category"]["change_request"]["n"] == 1


def test_agent_boundary_tasks_and_coverage(settings):
    from fastapi.testclient import TestClient

    from forge.api.app import create_app
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        aid = c.post("/api/agents", json={"name": "Desk", "template": "itsm_servicenow", "no_sensitive_data": True}).json()["id"]
        assert c.put(f"/api/agents/{aid}", json={"skills": [{"id": "boundary", "name": "b", "description": "", "tools": ["calculator"]}]}).status_code == 422
        r = c.put(f"/api/agents/{aid}", json={"boundary": {"enabled": True, "n": 20, "custom": ["Reset my password please"]}})
        assert r.status_code == 200 and r.json()["boundary"]["enabled"]
        from forge.agents.agent import Agent
        a = Agent(settings.home / "agents" / aid)
        summ = a.run_tasks(None, per_skill=12, source="template")
        assert summ["by_skill"]["boundary"] == 21 and "variety" in summ
        bt = [t for t in a.tasks() if t["family"] == "boundary"]
        assert all(t["reference_answer"] == "HANDOFF" and t["reference_calls"] == [] for t in bt)
        assert {t["split"] for t in bt} == {"train", "dev", "test"}
        cov = c.get(f"/api/agents/{aid}/coverage").json()
        assert cov["grid"]["boundary"]["train"] > 0 and cov["tables"] and sum(cov["boundary"].values()) == 21
        assert all(0 <= t["touched"] <= t["rows"] for t in cov["tables"])
