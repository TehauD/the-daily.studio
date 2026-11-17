import pytest

from forge.domain.experiments import ExperimentError, ExperimentManager


def test_config_hash_is_order_independent(db):
    em = ExperimentManager(db)
    a = em.create("a", "sft", {"lr": 2e-4, "rank": 16})
    b = em.create("b", "sft", {"rank": 16, "lr": 2e-4})
    assert a["config_hash"] == b["config_hash"]


def test_run_state_machine(db):
    em = ExperimentManager(db)
    e = em.create("e", "sft", {})
    r = em.start_run(e["id"])
    assert r["status"] == "pending" and r["attempt"] == 1
    r = em.transition(r["id"], "running")
    assert r["started_at"]
    r = em.checkpoint(r["id"], "ckpt/step-100", {"loss": 1.2})
    r = em.transition(r["id"], "completed", metrics={"loss": 0.8})
    assert r["metrics"] == {"loss": 0.8} and r["last_checkpoint"] == "ckpt/step-100"
    with pytest.raises(ExperimentError):
        em.transition(r["id"], "running")


def test_recovery_and_resume(db):
    em = ExperimentManager(db)
    e = em.create("e", "sft", {})
    r = em.transition(em.start_run(e["id"])["id"], "running")
    em.checkpoint(r["id"], "ckpt/step-50")
    assert em.recover_interrupted() == [r["id"]]
    assert em.run(r["id"])["status"] == "interrupted"
    new = em.resume(r["id"])
    assert new["attempt"] == 2 and new["resumed_from_run_id"] == r["id"] and new["last_checkpoint"] == "ckpt/step-50"
    with pytest.raises(ExperimentError):
        em.resume(new["id"])


def test_artifacts_hash_lineage_and_immutability(db, tmp_path):
    em = ExperimentManager(db)
    run = em.start_run(em.create("e", "sft", {})["id"])
    ds = tmp_path / "ds.jsonl"
    ds.write_text("{}\n")
    adapter = tmp_path / "adapter"
    adapter.mkdir()
    (adapter / "adapter_model.safetensors").write_bytes(b"x")
    a1 = em.register_artifact(run["id"], "dataset", ds)
    a2 = em.register_artifact(run["id"], "adapter", adapter, parent_artifact_id=a1["id"])
    assert len(a2["sha256"]) == 64
    assert [a["id"] for a in em.lineage(a2["id"])] == [a2["id"], a1["id"]]
    with pytest.raises(ExperimentError):
        em.register_artifact(run["id"], "dataset", ds)


def test_invalid_kind(db):
    with pytest.raises(ExperimentError):
        ExperimentManager(db).create("x", "magic", {})
