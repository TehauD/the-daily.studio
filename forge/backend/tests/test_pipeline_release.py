"""Pipeline phases, human sign-off and release bundles on a real (tiny, CPU) study taken through the final test."""
import json
import zipfile

import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("peft")


def test_pipeline_signoff_and_release(settings, tmp_path):
    import os

    from fastapi.testclient import TestClient

    from forge.api.app import create_app
    from forge.engine.runtime import OracleBackend
    from forge.engine.study import Study
    from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset
    from tests.test_playground_weightlab import TEACHER
    from tests.tiny_model import build_tiny_qwen3
    os.environ["FORGE_ALLOW_CPU"], os.environ["FORGE_ISOLATE_RUNS"] = "1", "0"
    tasks = generate_taskset(TaskSetSpec(groups_per_family=3))
    tiny = build_tiny_qwen3(tmp_path / "tiny", [SYSTEM_PROMPT] + [t.prompt for t in tasks] + [json.dumps(c) for t in tasks for c in t.reference_calls])
    s = Study.init(settings.studies_dir, name="pipe", profile="smoke", device="cpu", seeds=[0], teacher=TEACHER,
                   student={"name": "tiny", "path": str(tiny)}, arms=["teacher_filtered"], train_overrides={"max_steps": 2, "grad_accum": 1, "min_free_vram_mb": 0})
    oracle = OracleBackend({t.prompt: t for t in s.tasks()})
    s.run_stage("collect", emit=lambda e: None, teacher_backend=oracle)
    for stage in ("build", "train", "evaluate_dev", "analyze_dev"):
        s.run_stage(stage, emit=lambda e: None)
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        with c.app.state.forge.db.tx() as cx:
            cx.execute("INSERT INTO studies(id, name, path, profile, created_at) VALUES (?,?,?,?,?)", (s.plan["study_id"], "pipe", str(s.root), "smoke", s.plan["created_at"]))
        sid = s.plan["study_id"]
        ph = {p["key"]: p for p in c.get("/api/pipeline", params={"project": "catalog"}).json()["phases"]}
        assert [ph[k]["status"] for k in ("study", "final", "package", "decide")] == ["done", "todo", "locked", "locked"]
        assert ph["measure"]["status"] in ("done", "attention") and ph["final"]["next"]["label"] == "Seal the study"
        body = {"decision": "approved_pilot", "role": "Prior-auth manager", "purpose": "Supervised pilot on synthetic queue", "rationale": "Final test gain is clear and boundaries hold well enough."}
        c.headers["X-Forge-Actor"] = "J. Rivera"
        r = c.post(f"/api/studies/{sid}/signoffs", json=body)
        assert r.status_code == 409 and "sealed" in r.json()["detail"]  # no approval before the final test
        assert c.post(f"/api/studies/{sid}/release").status_code == 409
        rej = c.post(f"/api/studies/{sid}/signoffs", json={**body, "decision": "changes_needed"}).json()
        assert rej["reviewer"] == "J. Rivera" and rej["pinned"]["final_test"] is None
        s.run_stage("seal", emit=lambda e: None, confirm="SEAL")
        s.run_stage("evaluate_test", emit=lambda e: None)
        s.run_stage("analyze_test", emit=lambda e: None)
        ok = c.post(f"/api/studies/{sid}/signoffs", json=body).json()
        assert ok["decision_label"].startswith("Approved") and ok["pinned"]["adapter_sha256"] and ok["pinned"]["final_test"]["untrained"] is not None
        rel = c.post(f"/api/studies/{sid}/release").json()
        z = zipfile.ZipFile(c.app.state.forge.settings.studies_dir / sid / "releases" / rel["name"])
        names = z.namelist()
        man = json.loads(z.read(next(n for n in names if n.endswith("MANIFEST.json"))))
        assert {"adapter/adapter_model.safetensors", "model-card.md", "reports/operations-report.html", "decisions/signoffs.jsonl", "plan.sha256"} <= set(man["files"])
        assert len(man["decisions"]) == 2 and all(len(v["sha256"]) == 64 for v in man["files"].values())
        assert c.get(f"/api/studies/{sid}/release/{rel['name']}").headers["content-type"] == "application/zip"
        assert c.get(f"/api/studies/{sid}/release/..%2Fplan.json").status_code == 404
        ph = {p["key"]: p for p in c.get("/api/pipeline", params={"project": "catalog"}).json()["phases"]}
        assert ph["final"]["status"] == "done" and ph["decide"]["status"] == "done" and "Approved" in ph["decide"]["facts"][0]
