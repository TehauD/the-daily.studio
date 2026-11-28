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


def test_table_csv_downloads_and_round_trip(settings):
    from fastapi.testclient import TestClient

    from forge.agents.agent import parse_table
    from forge.api.app import create_app
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        r = c.get("/api/agents/templates/prior_auth/tables/services/csv")
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
        cols, rows = parse_table(r.text, "services.csv")
        assert len(rows) == 64 and cols[0] == "service_code" and {"requires_auth", "unit_cost"} <= set(cols)
        assert c.get("/api/agents/templates/prior_auth/tables/nope/csv").status_code == 404
        aid = c.post("/api/agents", json={"name": "PA", "template": "prior_auth", "no_sensitive_data": True}).json()["id"]
        a = c.get(f"/api/agents/{aid}").json()
        assert a["boundary"]["enabled"] and len(a["boundary"]["custom"]) >= 5  # the template ships hand-back cases
        assert c.get(f"/api/agents/{aid}/tables/services/csv").text.count("\n") == 65
        # Your own data in the same shape replaces the synthetic table
        mine = "Service Code,Service,Requires Auth\nPA-1,=HYPERLINK(1),yes\n"
        r = c.post(f"/api/agents/{aid}/tables", json={"name": "my_services", "description": "x", "key": "service_code", "content": mine, "filename": "m.csv"})
        assert r.status_code == 200
        assert "'=HYPERLINK(1)" in c.get(f"/api/agents/{aid}/tables/my_services/csv").text  # formulas neutralised on export
