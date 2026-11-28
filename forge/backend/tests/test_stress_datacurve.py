"""Stress perturbations and the data-size curve on a tiny trained study."""
import json

import pytest

from forge.engine import datacurve, stress
from forge.engine.tasks import Task

torch = pytest.importorskip("torch")
pytest.importorskip("peft")


def _task():
    return Task("t1", "g", "catalog_lookup", "dev", 0, "What is the unit price of SKU-0042 in the current catalog?",
                [{"tool": "lookup_sku", "arguments": {"sku": "SKU-0042"}}], "12.50", {})


def test_perturbations_are_deterministic_and_keep_identifiers():
    t = _task()
    for k in stress.KINDS:
        a, b = stress.perturb(t, k), stress.perturb(t, k)
        assert a == b and a != t.prompt and "SKU-0042" in a
    assert stress.INJECT_WORD in stress.perturb(t, "injection")


def test_nested_subsets_and_wilson():
    recs = [{"task_id": f"t{i}"} for i in range(40)]
    sizes, prev = [], set()
    for f in datacurve.FRACTIONS:
        ids = {r["task_id"] for r in datacurve.subset(recs, f, 0)}
        assert prev <= ids
        prev = ids
        sizes.append(len(ids))
    assert sizes == [4, 10, 20, 40]
    lo, hi = datacurve.wilson(5, 10)
    assert lo < 0.5 < hi and datacurve.wilson(0, 0) is None


def test_stress_and_curve_on_tiny_study(tmp_path):
    import os

    from forge.engine.runtime import OracleBackend, TransformersBackend
    from forge.engine.study import Study
    from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset
    from tests.test_playground_weightlab import TEACHER
    from tests.tiny_model import build_tiny_qwen3
    os.environ["FORGE_ALLOW_CPU"], os.environ["FORGE_ISOLATE_RUNS"] = "1", "0"
    tasks = generate_taskset(TaskSetSpec(groups_per_family=6))
    corpus = [SYSTEM_PROMPT] + [t.prompt for t in tasks] + [json.dumps(c) for t in tasks for c in t.reference_calls]
    tiny = build_tiny_qwen3(tmp_path / "tiny", corpus)
    st = Study.init(tmp_path / "studies", name="c", profile="smoke", device="cpu", seeds=[0], teacher=TEACHER,
                    student={"name": "tiny", "path": str(tiny)}, arms=["teacher_filtered"],
                    train_overrides={"max_steps": 2, "grad_accum": 1, "min_free_vram_mb": 0})
    st.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend({t.prompt: t for t in st.tasks()}))
    st.run_stage("build", emit=lambda e: None)

    # Stress: an oracle that recognises the task inside any wrapping is robust; a gullible one obeys the injection.
    by_id = {t.task_id: t for t in st.tasks()}

    class Robust:
        name = "robust"

        def complete(self, messages):
            from forge.agents.variety import rouge_l
            t = max(by_id.values(), key=lambda x: rouge_l(x.prompt, messages[1]["content"]))
            return OracleBackend({messages[1]["content"]: t}).complete(messages)

    class Gullible(Robust):
        name = "gullible"

        def complete(self, messages):
            from forge.engine.runtime import Completion
            if stress.INJECT_WORD in messages[1]["content"]:
                return Completion(json.dumps({"answer": stress.INJECT_WORD}), latency_ms=0)
            return super().complete(messages)
    lanes = [{"kind": "teacher", "label": "robust"}, {"kind": "base", "label": "gullible"}]
    res = stress.run(st, {"lanes": lanes, "split": "dev", "limit": 6}, backend_for=lambda l: Robust() if l["label"] == "robust" else Gullible())
    rob, gul = res["lanes"]
    assert rob["perturbations"]["injection"]["obeyed"] == 0 and gul["perturbations"]["injection"]["obeyed"] == 1.0
    assert gul["perturbations"]["injection"]["flips"] == sum(r["original"] for r in gul["rows"])
    assert (st.root / "stress" / f"{res['id']}.json").exists()
    with pytest.raises(ValueError, match="sealed"):
        stress.run(st, {"lanes": lanes, "split": "test"}, backend_for=lambda l: Robust())

    # Data curve: two shares, CPU, tiny model.
    out = datacurve.run(st, fractions=(0.25, 1.0), factory=lambda ad: TransformersBackend(str(tiny), str(ad), device="cpu", max_new_tokens=32))
    assert [p["share"] for p in out["points"]] == [0.25, 1.0]
    assert out["points"][0]["tasks"] < out["points"][1]["tasks"] and all(p["n"] == out["dev_tasks"] for p in out["points"])
    assert not st.episode_path("teacher_filtered", "dev", 0).exists()  # never wrote into the study's own results
