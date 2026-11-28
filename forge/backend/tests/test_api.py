import pytest
from fastapi.testclient import TestClient

from forge.api.app import create_app
from forge.providers.local_dir import LocalDirectoryProvider
from forge.registry import discovery
from tests.builders import write_hf_model


@pytest.fixture
def client(settings, monkeypatch):
    monkeypatch.setattr(discovery, "hardware_context", lambda: {"cuda_available": True, "bitsandbytes": True})
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        yield c


def test_health(client):
    r = client.get("/api/system/health").json()
    assert r["status"] == "ok" and r["schema_version"] == r["expected_schema"]


def test_rejects_foreign_host_header(client):
    assert client.get("/api/system/health", headers={"host": "evil.example"}).status_code == 400


def test_model_dir_and_discovery_and_roles(client, tmp_path, monkeypatch):
    root = tmp_path / "models"
    write_hf_model(root / "student")
    assert client.post("/api/settings/model-dirs", json={"path": str(root)}).status_code == 200
    assert client.post("/api/settings/model-dirs", json={"path": "../etc"}).status_code == 422
    monkeypatch.setattr(discovery, "build_providers", lambda s, db: [LocalDirectoryProvider([root])])
    out = client.post("/api/models/discover").json()
    assert out["providers"]["local_directory"]["models"] == 1
    models = client.get("/api/models").json()["models"]
    mid = models[0]["id"]
    assert client.put(f"/api/models/{mid}/roles", json={"role": "student"}).json()["roles"] == ["student"]
    fit = client.get(f"/api/models/{mid}/fit").json()
    assert fit["available"] and set(fit["estimates"]) == {"lora", "qlora"}
    assert client.delete(f"/api/models/{mid}/roles/student").json()["roles"] == []
    assert client.get("/api/models/nope").status_code == 404
    ov = client.get("/api/overview").json()
    assert ov["models_total"] == 1 and ov["models_trainable"] == 1


def test_endpoint_policy(client):
    ok = client.post("/api/settings/endpoints", json={"label": "llamacpp", "base_url": "http://127.0.0.1:8080/v1"})
    assert ok.status_code == 200
    assert client.post("/api/settings/endpoints", json={"label": "far", "base_url": "https://api.example.com"}).status_code == 422
    assert client.post("/api/settings/endpoints", json={"label": "far", "base_url": "https://api.example.com", "allow_remote": True}).status_code == 200
    assert client.post("/api/settings/endpoints", json={"label": "x", "base_url": "file:///etc"}).status_code == 422
    assert len(client.delete("/api/settings/endpoints/far").json()["endpoints"]) == 1


def test_estimate_with_override(client):
    r = client.post("/api/system/estimate", json={"params_b": 1.5, "available_vram_mb": 12000}).json()
    assert r["verdict"] in ("safe", "tight") and r["available_mb"] == 12000


def test_telemetry_and_profiles(client):
    t = client.get("/api/system/telemetry").json()
    assert "samples" in t
    assert "profiles" in client.get("/api/system/profiles").json()


def _register_pair(client, tmp_path, monkeypatch):
    from forge.providers.base import DiscoveredModel
    from forge.registry.capabilities import compute_capabilities
    from forge.registry.registry import ModelRegistry
    root = tmp_path / "models"
    write_hf_model(root / "student")
    client.post("/api/settings/model-dirs", json={"path": str(root)})
    monkeypatch.setattr(discovery, "build_providers", lambda s, db: [LocalDirectoryProvider([root])])
    client.post("/api/models/discover")
    reg = ModelRegistry(client.app.state.forge.db)
    t = DiscoveredModel(provider="lmstudio", locator="file://t.gguf", name="Teacher 8B", format="gguf",
                        parameter_count=8_000_000_000, metadata={"model_kind": "generative", "model_kind_evidence": "x",
                                                                 "template_mentions_tools": True, "lmstudio_id": "qwen/t"})
    tid = reg.upsert(t, compute_capabilities(t, {"cuda_available": True}))
    sid = next(m["id"] for m in client.get("/api/models").json()["models"] if m["provider"] == "local_directory")
    return tid, sid


def test_study_api_lifecycle_guards(client, tmp_path, monkeypatch):
    tid, sid = _register_pair(client, tmp_path, monkeypatch)
    assert client.post("/api/studies", json={"name": "x", "teacher_id": tid, "student_id": sid, "device": "cpu"}).status_code == 422
    monkeypatch.setenv("FORGE_ALLOW_CPU", "1")
    r = client.post("/api/studies", json={"name": "wiring", "teacher_id": tid, "student_id": sid, "device": "cpu"})
    assert r.status_code == 200, r.text
    study = r.json()
    assert study["plan"]["teacher"]["model"] == "qwen/t" and study["plan"]["base_hash"]
    assert study["plan"]["train"]["min_free_vram_mb"] == 2048 and "estimate" in study["plan"]["train"]["min_free_vram_basis"]
    assert study["next_stage"] == "collect" and study["pair_check"]["verdict"] in ("pass", "warn")
    sid_ = study["id"]
    assert client.post(f"/api/studies/{sid_}/stages/build", json={}).status_code == 409
    assert client.post(f"/api/studies/{sid_}/stages/seal", json={"confirm": "SEAL"}).status_code == 409
    listed = client.get("/api/studies").json()
    assert listed[0]["id"] == sid_ and listed[0]["stages"]["init"] == "completed"
    assert client.get(f"/api/studies/{sid_}/episodes").json() == []
    assert client.get(f"/api/studies/{sid_}/lineage").json()["nodes"]
    assert client.get(f"/api/studies/{sid_}/file", params={"path": "../../etc/passwd"}).status_code == 422
    assert "study_id" in client.get(f"/api/studies/{sid_}/file", params={"path": "plan.json"}).text
    cat = client.get("/api/studies/catalog").json()
    assert "teacher_filtered" in cat["arms"] and cat["stages"][0] == "init"


def test_stats_and_adapter_routes(client, tmp_path):
    assert abs(client.post("/api/stats/mcnemar", json={"b": 18, "c": 6}).json()["p"] - 0.0227) < 1e-4
    assert client.post("/api/stats/power", json={"delta": 0.1, "discordant": 0.3}).json()["n_pairs"] > 0
    assert client.post("/api/stats/power", json={"delta": 0.5, "discordant": 0.3}).status_code == 422
    assert client.get("/api/analysis/adapter", params={"path": "/etc"}).status_code == 422
    assert client.get("/api/jobs").json()["gpu_busy"] is None


def test_episode_compare_and_changes_routes(client, tmp_path):
    from forge.engine.runtime import OracleBackend, ScriptedBackend
    from forge.engine.study import Study
    st = client.app.state.forge
    (tmp_path / "stu").mkdir()
    study = Study.init(st.settings.studies_dir, name="r", profile="smoke", arms=["teacher_filtered"],
                       teacher={"provider": "lmstudio", "endpoint": "http://127.0.0.1:1/v1", "model": "t"},
                       student={"name": "s", "path": str(tmp_path / "stu")})
    with st.db.tx() as c:
        c.execute("INSERT INTO studies(id, name, path, profile, created_at) VALUES (?,?,?,?,?)",
                  (study.plan["study_id"], "r", str(study.root), "smoke", study.plan["created_at"]))
    tasks = study.tasks()
    study._evaluate(OracleBackend({t.prompt: t for t in tasks}), "teacher", "dev", 0, tasks, lambda e: None)
    study._evaluate(ScriptedBackend("b", ['{"answer":"0.00"}']), "base", "dev", 0, tasks, lambda e: None)
    study._evaluate(OracleBackend({t.prompt: t for t in tasks}), "teacher_filtered", "dev", 0, tasks, lambda e: None)
    sid = study.plan["study_id"]
    tid = next(t.task_id for t in tasks if t.split == "dev")
    cmp = client.get(f"/api/studies/{sid}/compare", params={"split": "dev", "task_id": tid})
    assert cmp.status_code == 200, cmp.text
    body = cmp.json()
    assert body["outcome"] == "fixed" and [l["lane"] for l in body["lanes"]] == ["teacher", "base", "tuned"]
    assert body["lanes"][1]["divergence_from_teacher"] == 0 and body["lanes"][2]["divergence_from_teacher"] is None
    ch = client.get(f"/api/studies/{sid}/changes", params={"split": "dev"}).json()
    assert ch["counts"]["fixed"] == len(ch["rows"]) > 0
    ep = client.get(f"/api/studies/{sid}/episode", params={"arm": "base", "split": "dev", "seed": 0, "task_id": tid})
    assert ep.status_code == 200 and ep.json()["graph"]["nodes"][0]["kind"] == "prompt"


def test_rigor_and_sharing_routes(client, tmp_path):
    p = client.post("/api/power", json={"profile": "pilot", "min_gain": 0.05})
    assert p.status_code == 200 and p.json()["seed_floor_p"] == 0.25 and p.json()["mde_groups"] is not None
    assert client.post("/api/power", json={"profile": "nope"}).status_code == 422
    assert client.post("/api/packs/inspect", json={"path": str(tmp_path / "missing.zip")}).status_code == 422
    assert client.post("/api/bundles/verify", json={"path": str(tmp_path / "missing.zip")}).status_code == 422
    assert client.get("/api/packs/..%2Fsecret.forgepack.zip").status_code in (404, 422)
    a = client.post("/api/agents", json={"name": "desk", "template": "itsm_servicenow", "no_sensitive_data": True}).json()
    assert client.post(f"/api/agents/{a['id']}/pack", json={}).status_code == 200      # spec + tables, no tasks yet
    lst = client.get("/api/packs").json()["packs"]
    assert len(lst) == 1 and lst[0]["pack"]["tasks"] == 0
    r = client.post("/api/packs/install", json={"path": lst[0]["path"], "no_sensitive_data": True})
    assert r.status_code == 200 and r.json()["agent_id"].startswith("agent_")
    assert client.post("/api/packs/install", json={"path": lst[0]["path"]}).status_code == 422   # attestation required
