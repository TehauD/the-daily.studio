"""Projects are derived on read from agents, packs, studies and variants; each has one next step."""
from fastapi.testclient import TestClient

from forge.api.app import create_app


def test_projects_group_agents_with_next_step(settings):
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        assert c.get("/api/projects").json()["projects"] == []
        aid = c.post("/api/agents", json={"name": "Desk", "template": "itsm_servicenow", "no_sensitive_data": True}).json()["id"]
        r = c.get("/api/projects").json()
        assert r["counts"]["agents"] == 1
        p = r["projects"][0]
        assert p["id"] == f"agent:{aid}" and p["kind"] == "agent" and p["skills"] > 0 and p["studies"] == []
        assert p["next"] == {"label": "Write practice tasks", "route": "agent-studio"}
