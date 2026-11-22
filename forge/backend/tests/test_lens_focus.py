"""Skill-targeted studies + the distillation lens, on a tiny offline Qwen3 (CPU wiring mode).

Wiring only: the tiny model's numbers say nothing about learning quality.
"""
import json

import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("peft")

from forge.engine.lens import pick_episodes, run_lens, snapshots  # noqa: E402
from forge.engine.runtime import OracleBackend  # noqa: E402
from forge.engine.study import Study, StudyError  # noqa: E402
from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset  # noqa: E402
from tests.tiny_model import build_tiny_qwen3  # noqa: E402

TEACHER = {"provider": "lmstudio", "endpoint": "http://127.0.0.1:9/v1", "model": "oracle-as-teacher"}


@pytest.fixture(scope="module")
def tiny(tmp_path_factory):
    tasks = generate_taskset(TaskSetSpec(groups_per_family=8))
    corpus = [SYSTEM_PROMPT] + [t.prompt for t in tasks] + [json.dumps(c) for t in tasks for c in t.reference_calls]
    return build_tiny_qwen3(tmp_path_factory.mktemp("tiny") / "Qwen3-tiny", corpus)


def _init(tmp_path, tiny, **kw):
    return Study.init(tmp_path / "studies", name="focus", profile="smoke", device="cpu", teacher=TEACHER,
                      student={"name": "Qwen3-tiny", "path": str(tiny)}, arms=["teacher_filtered"],
                      train_overrides={"max_steps": 4, "grad_accum": 1, "min_free_vram_mb": 0}, **kw)


def test_focus_validation(tmp_path, tiny):
    with pytest.raises(StudyError, match="Unknown focus skill"):
        _init(tmp_path, tiny, focus_skills=["juggling"])
    # Regression-only skills cannot be trained on.
    with pytest.raises(StudyError, match="Unknown focus skill"):
        _init(tmp_path, tiny, focus_skills=["extraction"])
    every = _init(tmp_path, tiny, focus_skills=["catalog_lookup", "multi_step_quote", "missing_item"])
    assert every.plan["focus"] is None  # all skills selected = no focus
    one = _init(tmp_path, tiny, focus_skills=["multi_step_quote"])
    assert one.plan["focus"]["skills"] == ["multi_step_quote"] and "focus skills" in one.plan["primary_contrast"]


def test_focus_study_and_lens_on_cpu(tmp_path, tiny, monkeypatch):
    monkeypatch.setenv("FORGE_ALLOW_CPU", "1")
    monkeypatch.setenv("FORGE_ISOLATE_RUNS", "0")
    study = _init(tmp_path, tiny, focus_skills=["multi_step_quote"])
    tasks = {t.prompt: t for t in study.tasks()}
    study.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend(tasks))
    study.run_stage("build", emit=lambda e: None)
    man = json.loads((study.root / "datasets" / "teacher_filtered" / "manifest.json").read_text())
    recs = [json.loads(x) for x in (study.root / "datasets" / "teacher_filtered" / "records.jsonl").read_text().splitlines()]
    assert recs and {r["family"] for r in recs} == {"multi_step_quote"}
    assert man["exclusions"]["outside_focus_skills"] > 0 and man["focus_skills"] == ["multi_step_quote"]

    study.run_stage("train", emit=lambda e: None)
    rd = study.run_dir("teacher_filtered", 0)
    run = json.loads((rd / "run.json").read_text())
    assert run["snapshot_every_steps"] == 1
    snaps = snapshots(rd)
    assert [s[0] for s in snaps] == ["step 1", "step 2", "step 3", "final"]  # final replaces step 4
    assert all((d / "adapter_model.safetensors").exists() and not (d / "optimizer.pt").exists() for _, _, d in snaps)

    events = []
    lens = run_lens(study, "teacher_filtered", 0, events.append)
    assert [p["label"] for p in lens["curve"]] == ["base", "step 1", "step 2", "step 3", "final"]
    assert all(p["nll"] > 0 and 0 <= p["agreement"] <= 1 and p["tokens"] == lens["tokens"] for p in lens["curve"])
    assert lens["curve"][-1]["nll"] != lens["curve"][0]["nll"]  # the adapter changed the student's predictions
    ep = lens["episodes"][0]
    toks = [t for tr in ep["turns"] for t in tr["tokens"]]
    assert toks and all({"t", "b", "f", "a"} <= set(t) and t["b"] <= 0 and t["f"] <= 0 for t in toks)
    # Decoded pieces reassemble the teacher's action text exactly.
    first = ep["turns"][0]
    assert "".join(t["t"] for t in first["tokens"]).startswith("{")
    assert (rd / "lens.json").exists() and lens["adapter_sha256"] == run["adapter_sha256"]
    assert {e["event"] for e in events} >= {"lens_start", "lens_point", "lens_done"}
    # Evaluated skills cover every family, analysis reports focus and off-focus contrasts separately.
    study.run_stage("evaluate_dev", emit=lambda e: None)
    study.run_stage("analyze_dev", emit=lambda e: None)
    rep = json.loads((study.root / "reports" / "analysis_dev.json").read_text())
    c = rep["splits"]["dev"]["arms"]["teacher_filtered"]
    assert c["focus"]["families"] == ["multi_step_quote"]
    assert set(c["off_focus"]["families"]) == {"catalog_lookup", "missing_item"}


def test_pick_episodes_balances_skills():
    def ep(f, i, ok=True):
        return {"task_id": f"{f}-{i}", "family": f, "score": {"strict_success": ok}}
    eps = [ep("a", i) for i in range(10)] + [ep("b", i) for i in range(2)] + [ep("c", 0, ok=False)]
    got = pick_episodes(eps, limit=6)
    assert [e["family"] for e in got] == ["a", "b", "a", "b", "a", "a"]
