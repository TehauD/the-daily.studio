"""Rigour: power planning (calibrated nulls, seed floor), the few-shot prompting baseline, and the forgetting check."""
import json

import pytest

from forge.engine import power
from forge.engine.evidence import evidence
from forge.engine.runtime import Completion, OracleBackend
from forge.engine.study import Study


def test_power_null_is_calibrated_and_seed_floor_is_reported():
    for seeds in (3, 6):
        r = power.simulate(0.0, groups=40, paraphrases=2, seeds=seeds, base_rate=0.1, sd_group=0.15, sd_seed=0.03, sims=2000)
        assert r["power_groups"] < 0.08 and r["power_seeds"] < 0.08      # a true null rejects at about α or less
    p3 = power.plan(groups=24, paraphrases=2, seeds=3, min_gain=0.05)
    assert p3["seed_floor_p"] == 0.25 and p3["mde_both"] is None and any("6 seeds" in n for n in p3["notes"])
    p6 = power.plan(groups=48, paraphrases=2, seeds=6, min_gain=0.05)
    assert p6["mde_groups"] < p3["mde_groups"] and p6["mde_both"] is not None
    big = power.simulate(0.3, groups=40, paraphrases=2, seeds=6, base_rate=0.1, sd_group=0.1, sd_seed=0.02, sims=300)
    assert big["power_groups"] > 0.95


class Wrong:
    name = "wrong"

    def complete(self, messages):
        return Completion(json.dumps({"answer": "I do not know"}), latency_ms=1)


class ExampleFollower:
    """Answers correctly only when worked examples are in its system prompt (stands in for in-context learning)."""
    name = "follower"

    def __init__(self, oracle):
        self.oracle = oracle

    def complete(self, messages):
        if "Worked examples" in messages[0]["content"]:
            return self.oracle.complete(messages)
        return Completion(json.dumps({"answer": "?"}), latency_ms=1)


def test_fewshot_baseline_examples_come_from_training_and_feed_the_analysis(tmp_path):
    s = Study.init(tmp_path / "studies", name="fs", profile="smoke", device="cpu", seeds=[0, 1],
                   teacher={"provider": "lmstudio", "endpoint": "http://127.0.0.1:9/v1", "model": "t"},
                   student={"name": "s", "path": "/x"}, arms=["teacher_filtered"], train_overrides={"min_free_vram_mb": 0},
                   fewshot_k=3, power={})
    assert s.plan["baselines"]["fewshot"]["k"] == 3 and s.plan["power"]["design"]["seeds"] == 2
    oracle = OracleBackend({t.prompt: t for t in s.tasks()})
    s.run_stage("collect", emit=lambda e: None, teacher_backend=oracle)
    s.run_stage("build", emit=lambda e: None)
    from forge.engine import baselines
    ex = baselines.choose(s, 3)
    train_ids = {t.task_id for t in s.tasks() if t.split == "train"}
    held = [t.prompt for t in s.tasks() if t.split != "train"]
    assert ex["k"] == 3 and set(ex["task_ids"]) <= train_ids and len(set(ex["families"])) == 3
    assert not any(p in ex["text"] for p in held)                     # no practice / test prompt leaks into the examples
    assert baselines.choose(s, 5)["sha256"] == ex["sha256"]            # frozen after first use
    tasks = s.tasks()
    s._evaluate(Wrong(), "base", "dev", 0, tasks, lambda e: None)
    s._evaluate(baselines.FewShotBackend(ExampleFollower(oracle), ex["text"]), "fewshot", "dev", 0, tasks, lambda e: None)
    for sd in (0, 1):
        s._evaluate(oracle, "teacher_filtered", "dev", sd, tasks, lambda e: None)
    rep = s.analyze(("dev",))
    sec = rep["splits"]["dev"]
    assert sec["fewshot_rate"] == 1.0 and sec["fewshot_vs_base"]["mean"] == 1.0
    assert sec["arms"]["teacher_filtered"]["vs_fewshot"]["mean"] == 0.0
    (s.root / "reports" / "analysis_dev.json").write_text(json.dumps(rep))
    e = evidence(s)
    assert e["components"]["dev"]["fewshot"]["strict_success"]["rate"] == 1.0
    assert e["verdict"]["prompting"]["status"] == "no_difference_shown" and e["vs_prompting"]["dev"]["fewshot"]["gain"] == 1.0
    assert e["power"]["design"]["seeds"] == 2 and e["fewshot"]["k"] == 3


def test_forgetting_check_on_tiny_olmo3(tmp_path, monkeypatch):
    pytest.importorskip("peft")
    pytest.importorskip("transformers.models.olmo3")
    monkeypatch.setenv("FORGE_ALLOW_CPU", "1")
    monkeypatch.setenv("FORGE_ISOLATE_RUNS", "0")
    from forge.engine import forgetting
    from forge.engine.general_text import PASSAGES
    from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset
    from tests.tiny_model import build_tiny_olmo3
    tasks = generate_taskset(TaskSetSpec(groups_per_family=3))
    olmo = build_tiny_olmo3(tmp_path / "olmo", [SYSTEM_PROMPT] + [t.prompt for t in tasks] + PASSAGES)
    s = Study.init(tmp_path / "studies", name="fg", profile="smoke", device="cpu",
                   teacher={"provider": "lmstudio", "endpoint": "http://127.0.0.1:9/v1", "model": "t"},
                   student={"name": "olmo-tiny", "path": str(olmo)}, arms=["teacher_filtered"],
                   train_overrides={"max_steps": 2, "grad_accum": 1, "min_free_vram_mb": 0, "max_seq_len": 4096})
    with pytest.raises(ValueError):
        forgetting.run(s)                                               # nothing trained yet
    s.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend({t.prompt: t for t in s.tasks()}))
    s.run_stage("build", emit=lambda e: None)
    s.run_stage("train", emit=lambda e: None)
    rep = forgetting.run(s)
    a = rep["arms"]["teacher_filtered"]
    assert rep["passages"] == len(PASSAGES) and rep["base"]["perplexity"] > 1
    assert a["status"] in ("forgetting", "no_material_drift", "inconclusive") and a["pooled"]["ci"][0] <= a["pooled"]["change"] <= a["pooled"]["ci"][1]
    assert forgetting.report(s)["arms"]["teacher_filtered"]["seeds"]["0"]["passages"] == len(PASSAGES)
