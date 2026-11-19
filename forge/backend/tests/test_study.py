"""Study lifecycle with an oracle teacher, fake trainer, and scripted students (no torch)."""
import json
from pathlib import Path

import pytest

import forge.engine.train as train_mod
from forge.engine.runtime import OracleBackend, ScriptedBackend
from forge.engine.study import Study, StudyError, read_jsonl
from forge.graphs.lineage import lineage


def _fake_train(cfg, hash_cache=None, emit=print):
    out = Path(cfg.output_dir) / "adapter"
    out.mkdir(parents=True, exist_ok=True)
    (out / "adapter_model.safetensors").write_bytes(b"fake-%d" % cfg.seed)
    (Path(cfg.output_dir) / "training.jsonl").write_text(json.dumps({"step": 1, "loss": 1.0}) + "\n")
    rep = {"adapter_sha256": f"sha{cfg.seed}", "base_hash_before": "h", "global_step": 1}
    (Path(cfg.output_dir) / "run.json").write_text(json.dumps(rep))
    return rep


@pytest.fixture
def study(tmp_path, monkeypatch):
    monkeypatch.setattr(train_mod, "train_lora", _fake_train)
    monkeypatch.setenv("FORGE_ISOLATE_RUNS", "0")  # the fake trainer lives in this process
    student = tmp_path / "student"
    student.mkdir()
    return Study.init(tmp_path / "studies", name="t", profile="smoke", seeds=[0, 1],
                      teacher={"provider": "lmstudio", "endpoint": "http://127.0.0.1:1234/v1", "model": "teacher"},
                      student={"name": "tiny", "path": str(student)}, arms=["teacher_filtered"], base_hash="h")


def _students(study):
    tasks = {t.prompt: t for t in study.tasks()}

    def factory(adapter, model_path=None):
        if adapter is None:  # base: always answers without tools → fails every tool task
            return ScriptedBackend("student:base", ['{"answer":"0.00"}'])
        return OracleBackend(tasks)
    return factory


def test_full_lifecycle_and_seal(study):
    events = []
    with pytest.raises(StudyError, match="requires 'collect'"):
        study.run_stage("build")
    tasks = {t.prompt: t for t in study.tasks()}
    study.run_stage("collect", emit=events.append, teacher_backend=OracleBackend(tasks))
    assert study.run_stage("build", emit=events.append)["teacher_filtered"]["records"] > 0
    study.run_stage("train", emit=events.append)
    f = _students(study)
    study.run_stage("evaluate_dev", emit=events.append, student_factory=f)
    study.run_stage("analyze_dev", emit=events.append)
    dev = json.loads((study.root / "reports" / "analysis_dev.json").read_text())["splits"]["dev"]
    c = dev["arms"]["teacher_filtered"]
    assert c["arm_rate"] > c["control_rate"] and c["ci_low"] > 0
    assert dev["teacher_rate"] == 1.0 and c["teacher_gap_closed"] is not None
    with pytest.raises(StudyError, match="SEAL"):
        study.run_stage("seal", confirm="seal")
    study.run_stage("seal", emit=events.append, confirm="SEAL")
    assert study.state["sealed"]
    for forbidden in ("train", "build", "evaluate_dev"):
        with pytest.raises(StudyError, match="sealed"):
            study.check_can_run(forbidden)
    study.run_stage("evaluate_test", emit=events.append, student_factory=f)
    study.run_stage("analyze_test", emit=events.append)
    rep = json.loads((study.root / "reports" / "analysis_test.json").read_text())
    assert rep["gate"]["verdict"] == "not_eligible"  # smoke profile can never pass the review gate
    assert set(rep["splits"]) == {"test", "ood", "regression"}
    assert "mcnemar_diagnostic" in rep["splits"]["test"]["arms"]["teacher_filtered"]
    lin = lineage(study.root)
    kinds = {n["kind"] for n in lin["nodes"]}
    assert {"base_model", "plan", "dataset", "config", "adapter", "report"} <= kinds


def test_resume_skips_completed_episodes_and_detects_corruption(study):
    tasks = {t.prompt: t for t in study.tasks()}
    study.run_stage("collect", teacher_backend=OracleBackend(tasks), emit=lambda e: None)
    p = study.episode_path("teacher", "dev", 0)
    n = len(read_jsonl(p))
    study._evaluate(OracleBackend(tasks), "teacher", "dev", 0, study.tasks(), lambda e: None)
    assert len(read_jsonl(p)) == n  # nothing re-run
    lines = p.read_text().splitlines()
    row = json.loads(lines[0])
    row["record"]["answer"] = "tampered"
    p.write_text("\n".join([json.dumps(row)] + lines[1:]) + "\n")
    with pytest.raises(StudyError, match="sha256 mismatch"):
        read_jsonl(p)


def test_plan_is_frozen(study):
    plan = json.loads((study.root / "plan.json").read_text())
    plan["min_gain"] = 0.0
    (study.root / "plan.json").write_text(json.dumps(plan))
    with pytest.raises(StudyError, match="Frozen plan"):
        Study(study.root)


def test_lock_blocks_second_process(study):
    import os
    import psutil
    parent = psutil.Process(os.getppid())
    (study.root / ".lock").write_text(json.dumps({"pid": parent.pid, "created": parent.create_time()}))
    with pytest.raises(StudyError, match="locked"):
        study.run_stage("collect", teacher_backend=OracleBackend({}), emit=lambda e: None)


def test_backend_error_stops_stage_and_is_never_recorded(study):
    class Broken:
        name = "broken"

        def complete(self, messages):
            raise RuntimeError("GPU fell over")
    with pytest.raises(StudyError, match="backend error"):
        study.run_stage("collect", teacher_backend=Broken(), emit=lambda e: None)
    assert study.state["stages"]["collect"]["status"] == "failed"
    assert read_jsonl(study.episode_path("teacher", "train", 0)) == []


def test_cancelled_collect_resumes_cleanly(study):
    """Simulates a hard kill mid-collect: stale 'running' state, leftover lock whose PID was reused,
    and a torn final JSONL line. Re-running collect must resume without duplicates or corruption."""
    import os
    import psutil
    tasks = {t.prompt: t for t in study.tasks()}
    study._evaluate(OracleBackend(tasks), "teacher", "train", 0,
                    [t for t in study.tasks() if t.split == "train"][:5], lambda e: None)
    p = study.episode_path("teacher", "train", 0)
    with open(p, "a", encoding="utf-8") as f:
        f.write('{"sha256": "abc", "record": {"task_id": "torn')          # killed mid-write
    me = psutil.Process(os.getpid())
    (study.root / ".lock").write_text(json.dumps({"pid": me.pid, "created": me.create_time() - 999}))  # reused PID
    study._set_stage("collect", "running", pid=999999999, pid_created=1.0)  # dead process
    assert study.summary()["state"]["stages"]["collect"]["status"] == "interrupted"
    assert len(read_jsonl(p)) == 5  # torn line ignored on read

    done = []
    study.run_stage("collect", teacher_backend=OracleBackend(tasks), emit=done.append)
    eps = read_jsonl(p)
    ids = [e["task_id"] for e in eps]
    assert len(ids) == len(set(ids)) == sum(1 for t in study.tasks() if t.split == "train")
    assert study.state["stages"]["collect"]["status"] == "completed"
    assert sum(1 for e in done if e.get("event") == "episode" and e["arm"] == "teacher" and e["split"] == "train") == len(ids) - 5


def test_knowledge_graph_from_study_files(study):
    from forge.graphs.knowledge import build, to_graphml
    g0 = build(study)  # before any stage: skills come from the task set, nothing measured
    assert {n["kind"] for n in g0["nodes"]} >= {"teacher", "reference", "base", "dataset", "tuned", "skill", "tool"}
    assert not any(e["kind"] == "performs" for e in g0["edges"])
    tasks = {t.prompt: t for t in study.tasks()}
    study.run_stage("collect", teacher_backend=OracleBackend(tasks), emit=lambda e: None)
    study.run_stage("build", emit=lambda e: None)
    study.run_stage("train", emit=lambda e: None)
    study.run_stage("evaluate_dev", student_factory=_students(study), emit=lambda e: None)
    g = build(study)
    assert g["view"] == "dev"
    perf = [e for e in g["edges"] if e["kind"] == "performs"]
    assert {e["from"] for e in perf} == {"teacher", "base", "tuned:teacher_filtered"}
    tuned = [e for e in perf if e["from"] == "tuned:teacher_filtered"]
    assert all(e["metrics"]["strict_success"] == 1.0 and e["delta_vs_base"]["strict_success"] == 1.0 for e in tuned)
    node = next(n for n in g["nodes"] if n["id"] == "tuned:teacher_filtered")
    assert node["seeds_trained"] == 2 and node["gains"] and not node["regressions"]
    assert any(e["kind"] == "produced" and e["measured"] for e in g["edges"])
    xml = to_graphml(g)
    assert xml.startswith("<?xml") and xml.count("<node ") == len(g["nodes"]) and xml.count("<edge ") == len(g["edges"])
    with pytest.raises(ValueError):
        build(study, "nope")
