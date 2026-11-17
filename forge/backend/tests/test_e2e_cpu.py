"""Real Trainer + PEFT + generate on a tiny offline Qwen3 model, CPU wiring mode, every stage.

Validates wiring only (gates, masks, prefix assertion, hashing, adapter save + inspection,
post-merge re-evaluation). It says nothing about GPU memory, speed, or learning quality.
"""
import json

import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("peft")

from forge.engine.datasets import tokenize_all, episode_records  # noqa: E402
from forge.engine.runtime import OracleBackend  # noqa: E402
from forge.engine.study import Study, read_jsonl  # noqa: E402
from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset  # noqa: E402
from tests.tiny_model import build_tiny_qwen3  # noqa: E402


@pytest.fixture(scope="module")
def tiny(tmp_path_factory):
    tasks = generate_taskset(TaskSetSpec(groups_per_family=8))
    corpus = [SYSTEM_PROMPT] + [t.prompt for t in tasks] + [json.dumps(c) for t in tasks for c in t.reference_calls]
    return build_tiny_qwen3(tmp_path_factory.mktemp("tiny") / "Qwen3-tiny", corpus)


def test_real_tokenizer_prefix_is_stable(tiny):
    from transformers import AutoTokenizer
    tok = AutoTokenizer.from_pretrained(tiny, local_files_only=True)
    tasks = generate_taskset(TaskSetSpec(groups_per_family=8))
    from forge.engine.runtime import run_episode
    from forge.engine.tasks import ToolWorld, build_catalog
    w = ToolWorld(build_catalog(1234))
    eps = [run_episode(t, OracleBackend({x.prompt: x for x in tasks}), w) for t in tasks[:12]]
    recs = [r for e in eps for r in episode_records(e)]
    out, stats = tokenize_all(tok, recs, max_len=4096)
    assert stats["records"] == len(recs) and stats["supervised_tokens"] > 0
    # <|im_end|> is inside the supervised span, so the model learns to stop (template appends "\n" after it).
    assert all(tok.eos_token_id in [t for t in x["labels"] if t != -100] for x in out)


def test_full_study_on_cpu(tiny, tmp_path, monkeypatch):
    monkeypatch.setenv("FORGE_ALLOW_CPU", "1")
    study = Study.init(tmp_path / "studies", name="cpu-wiring", profile="smoke", device="cpu",
                       teacher={"provider": "lmstudio", "endpoint": "http://127.0.0.1:9/v1", "model": "oracle-as-teacher"},
                       student={"name": "Qwen3-tiny", "path": str(tiny)}, arms=["teacher_filtered"],
                       train_overrides={"max_steps": 2, "grad_accum": 2, "save_steps": 1, "min_free_vram_mb": 0})
    events = []
    tasks = {t.prompt: t for t in study.tasks()}
    study.run_stage("collect", emit=events.append, teacher_backend=OracleBackend(tasks))
    study.run_stage("build", emit=events.append)
    study.run_stage("train", emit=events.append)
    run = json.loads((study.run_dir("teacher_filtered", 0) / "run.json").read_text())
    assert run["zero_adapter_max_abs_diff"] == 0.0
    assert run["global_step"] == 2 and run["base_hash_before"] == run["base_hash_after"]
    assert 0 < run["trainable_params"] < run["total_params"]
    assert {c["check"] for c in run["preflight"]} >= {"device", "teacher_unloaded"}
    rows = [json.loads(x) for x in (study.run_dir("teacher_filtered", 0) / "training.jsonl").read_text().splitlines()]
    assert any("loss" in r for r in rows) and all(r["tokens_seen"] >= 0 for r in rows)
    insp = json.loads((study.run_dir("teacher_filtered", 0) / "inspection.json").read_text())
    assert insp["computed"] and insp["modules"] and insp["base_available"]
    # Re-running train is a no-op (resume semantics), not a second adapter.
    study.run_stage("train", emit=events.append)
    assert any(e.get("event") == "skip_trained" for e in events)

    study.run_stage("evaluate_dev", emit=events.append)
    assert read_jsonl(study.episode_path("base", "dev", 0)) and read_jsonl(study.episode_path("teacher_filtered", "dev", 0))
    study.run_stage("analyze_dev", emit=events.append)
    study.run_stage("seal", emit=events.append, confirm="SEAL")
    study.run_stage("evaluate_test", emit=events.append)
    study.run_stage("analyze_test", emit=events.append)
    res = study.run_stage("export", emit=events.append)
    manifest = json.loads((study.root / "exports" / "teacher_filtered-seed0-merged" / "forge_export.json").read_text())
    assert 0.0 <= res["agreement_with_adapter"] <= 1.0 and manifest["post_merge_eval"]["split"] == "test"
