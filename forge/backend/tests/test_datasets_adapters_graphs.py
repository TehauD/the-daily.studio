import json
import struct

import numpy as np
import pytest

from forge.analysis.adapters import AdapterError, SafeTensorFile, effective_rank, inspect_adapter, lora_spectrum
from forge.engine import datasets as ds
from forge.engine.runtime import OracleBackend, ScriptedBackend, run_episode
from forge.engine.tasks import TaskSetSpec, ToolWorld, build_catalog, generate_taskset
from forge.graphs.paths import compare, first_divergence, outcome, path_graph

SPEC = TaskSetSpec(seed=3, groups_per_family=10, ood_groups_per_family=1, regression_groups=2)


def _eps(backend_for):
    tasks = generate_taskset(SPEC)
    w = ToolWorld(build_catalog(SPEC.seed))
    return tasks, [run_episode(t, backend_for(tasks, t), w) | {"split": t.split} for t in tasks]


class CharTok:
    """Deterministic fake tokenizer: one token per character; a minimal Qwen-like template."""

    def apply_chat_template(self, messages, tokenize=False, add_generation_prompt=False, enable_thinking=None):
        s = "".join(f"<{m['role']}>{m['content']}</{m['role']}>" for m in messages)
        return s + ("<assistant>" if add_generation_prompt else "")

    def __call__(self, text, add_special_tokens=False):
        return {"input_ids": [ord(c) for c in text]}


class BrokenTok(CharTok):
    def apply_chat_template(self, messages, tokenize=False, add_generation_prompt=False, enable_thinking=None):
        return ("X" if add_generation_prompt else "Y") + super().apply_chat_template(messages, tokenize, add_generation_prompt)


def test_records_masks_and_prefix():
    tasks, eps = _eps(lambda ts, t: OracleBackend({x.prompt: x for x in ts}))
    multi = next(e for e in eps if e["family"] == "multi_step_quote")
    recs = ds.episode_records(multi)
    assert len(recs) == 3 and [r["turn"] for r in recs] == [0, 1, 2]  # quote, quote, answer
    tok = ds.tokenize_record(CharTok(), recs[1], max_len=10_000)
    n_sup = sum(1 for x in tok["labels"] if x != ds.IGNORE_INDEX)
    assert n_sup == len(recs[1]["completion"]) + len("</assistant>")
    assert tok["labels"][: len(tok["labels"]) - n_sup] == [ds.IGNORE_INDEX] * (len(tok["labels"]) - n_sup)
    with pytest.raises(ds.PrefixMismatchError):
        ds.tokenize_record(BrokenTok(), recs[1], 10_000)


def test_overlength_blocks_run_never_truncates():
    tasks, eps = _eps(lambda ts, t: OracleBackend({x.prompt: x for x in ts}))
    recs = ds.episode_records(eps[0])
    with pytest.raises(ds.OverlengthError):
        ds.tokenize_all(CharTok(), recs, max_len=50)


def test_arms_share_eligible_ids_and_quarter_is_nested():
    tasks, oracle = _eps(lambda ts, t: OracleBackend({x.prompt: x for x in ts}))
    # A teacher that fails every missing_item task (answers a price instead of NOT_FOUND)
    def teacher(ts, t):
        if t.family == "missing_item":
            return ScriptedBackend("t", ['{"tool":"lookup","arguments":{"sku":"%s"}}' % t.reference_calls[0]["arguments"]["sku"],
                                         '{"answer":"9.99"}'])
        return OracleBackend({x.prompt: x for x in ts})
    _, teach = _eps(teacher)
    filt = ds.build_arm(ds.BuildPolicy("teacher_filtered"), teach, oracle)
    raw = ds.build_arm(ds.BuildPolicy("teacher_raw"), teach, oracle)
    orc = ds.build_arm(ds.BuildPolicy("oracle_sft"), teach, oracle)
    assert filt["eligible_task_ids"] == raw["eligible_task_ids"] == orc["eligible_task_ids"]
    assert not any(r["family"] == "missing_item" for r in filt["records"])
    assert all(r["trajectory_hash"] for r in filt["records"])
    groups = [r["group_id"] for r in filt["records"]]
    q25 = ds.nested_group_subset(groups, 0.25, 1)
    q50 = ds.nested_group_subset(groups, 0.5, 1)
    assert q25 <= q50
    assert all(e["split"] == "train" for e in teach if e["task_id"] in {r["task_id"] for r in filt["records"]})


# ---------------------------------------------------------------- adapters

def _write_st(path, tensors: dict[str, np.ndarray], dtype="F32"):
    header, blobs, off = {}, [], 0
    for k, a in tensors.items():
        if dtype == "BF16":
            raw = (a.astype(np.float32).view(np.uint32) >> 16).astype(np.uint16).tobytes()
        else:
            raw = a.astype(np.float32).tobytes()
        header[k] = {"dtype": dtype, "shape": list(a.shape), "data_offsets": [off, off + len(raw)]}
        blobs.append(raw)
        off += len(raw)
    h = json.dumps(header).encode()
    path.write_bytes(struct.pack("<Q", len(h)) + h + b"".join(blobs))


def test_lora_spectrum_matches_dense_svd():
    rng = np.random.default_rng(0)
    A, B = rng.normal(size=(8, 96)), rng.normal(size=(64, 8))
    dense = np.linalg.svd(2.0 * B @ A, compute_uv=False)[:8]
    assert np.allclose(lora_spectrum(A, B, 2.0), dense, rtol=1e-9)
    assert effective_rank(np.ones(4)) == pytest.approx(4.0)
    assert effective_rank(np.array([1.0, 0, 0])) == pytest.approx(1.0)


def test_inspect_adapter_end_to_end(tmp_path):
    rng = np.random.default_rng(1)
    ad, base = tmp_path / "adapter", tmp_path / "base"
    ad.mkdir(), base.mkdir()
    mod = "model.layers.3.self_attn.q_proj"
    A, B = rng.normal(size=(4, 32)).astype(np.float32), rng.normal(size=(16, 4)).astype(np.float32)
    W = rng.normal(size=(16, 32)).astype(np.float32)
    _write_st(ad / "adapter_model.safetensors", {f"base_model.model.{mod}.lora_A.weight": A,
                                                  f"base_model.model.{mod}.lora_B.weight": B})
    (ad / "adapter_config.json").write_text(json.dumps({"r": 4, "lora_alpha": 8, "target_modules": ["q_proj"]}))
    _write_st(base / "model.safetensors", {f"{mod}.weight": W}, dtype="BF16")
    rep = inspect_adapter(ad, base)
    m = rep["modules"][0]
    dense = 2.0 * B.astype(np.float64) @ A.astype(np.float64)
    assert m["delta_fro"] == pytest.approx(np.linalg.norm(dense), rel=1e-6)
    assert m["layer"] == 3 and m["kind"] == "q_proj" and rep["scale"] == 2.0
    assert m["relative_change"] == pytest.approx(np.linalg.norm(dense) / np.linalg.norm(W), rel=1e-2)  # bf16 base
    assert rep["layer_delta_fro"] == {"3": pytest.approx(m["delta_fro"])}


def test_inspect_refuses_pickle(tmp_path):
    (tmp_path / "adapter_model.bin").write_bytes(b"\x80\x04")
    with pytest.raises(AdapterError):
        inspect_adapter(tmp_path)
    with pytest.raises(AdapterError):
        SafeTensorFile(tmp_path / "adapter_model.bin")


# ---------------------------------------------------------------- graphs

def test_path_graph_and_comparison():
    tasks, oracle = _eps(lambda ts, t: OracleBackend({x.prompt: x for x in ts}))
    t = next(x for x in tasks if x.family == "multi_step_quote")
    teacher = next(e for e in oracle if e["task_id"] == t.task_id)
    g = path_graph(teacher)
    assert [n["kind"] for n in g["nodes"]] == ["prompt", "tool_call", "tool_result", "tool_call", "tool_result", "answer"]
    assert g["nodes"][-1]["status"] == "pass" and len(g["edges"]) == 5
    bad = run_episode(t, ScriptedBackend("b", ['{"answer":"1.00"}']), ToolWorld(build_catalog(SPEC.seed)))
    assert first_divergence(teacher, bad) == 0 and first_divergence(teacher, teacher) is None
    assert outcome(bad, teacher) == "fixed" and outcome(teacher, bad) == "regressed" and outcome(bad, bad) == "unchanged"
    c = compare(teacher, bad, teacher)
    assert c["outcome"] == "fixed" and c["lanes"][1]["divergence_from_teacher"] == 0
    assert "Hidden reasoning is not visualized" in c["honesty"]


def test_shuffled_control_moves_every_completion():
    """Negative control: same completions, each on a different task; deterministic; nothing else changes."""
    from forge.engine.datasets import BuildPolicy, build_arm
    from forge.engine.runtime import OracleBackend, run_episode
    from forge.engine.tasks import TaskSetSpec, ToolWorld, build_catalog, generate_taskset
    tasks = [t for t in generate_taskset(TaskSetSpec(groups_per_family=4)) if t.split == "train"]
    w = ToolWorld(build_catalog(1234))
    eps = [run_episode(t, OracleBackend({x.prompt: x for x in tasks}), w) for t in tasks]
    real = build_arm(BuildPolicy(arm="teacher_filtered"), eps, eps)["records"]
    ctl = build_arm(BuildPolicy(arm="shuffled_control"), eps, eps)
    shuf = ctl["records"]
    assert len(shuf) == len(real) and ctl["exclusions"]["control_shuffled_records"] == len(real)
    assert sorted(r["completion"] for r in shuf) == sorted(r["completion"] for r in real)          # same content…
    assert all(a["prompt_messages"] == b["prompt_messages"] for a, b in zip(real, shuf))            # …same prompts…
    moved = sum(a["completion"] != b["completion"] for a, b in zip(real, shuf))
    assert moved >= 0.9 * len(real)                                                                 # …paired with other tasks
    assert [r["completion"] for r in build_arm(BuildPolicy(arm="shuffled_control"), eps, eps)["records"]] == [r["completion"] for r in shuf]
