"""Quantization Lab: the reference quantizer's maths, checkpoints, the lab end to end, and the GGUF LM Studio check."""
import json

import numpy as np
import pytest

from forge.quant import reference as ref


def test_quantize_matrix_levels_and_error():
    rng = np.random.default_rng(0)
    W = rng.normal(size=(32, 256)).astype(np.float32)
    errs = {}
    for b in (8, 4, 3):
        Q = ref.quantize_matrix(W, b, 128)
        for g in range(2):  # every group uses at most 2^b − 1 symmetric levels
            blk = Q[:, g * 128:(g + 1) * 128]
            for row in blk[:4]:
                assert len(np.unique(np.round(row / np.abs(row).max() * (2 ** (b - 1) - 1)))) <= 2 ** b - 1
        errs[b] = ref._err(W, Q)["rel_error"]
    assert errs[8] < 0.01 < errs[4] < errs[3] < 0.5
    assert ref._err(W, ref.quantize_matrix(W, 8, 128))["sqnr_db"] > 40


def test_activation_aware_beats_plain_rounding_on_skewed_inputs():
    rng = np.random.default_rng(1)
    W = rng.normal(size=(64, 128)).astype(np.float32)
    act = np.ones(128, dtype=np.float32)
    act[:8] = 40.0  # a few input channels carry most of the signal, as in real models
    plain = ref._err(W, ref.quantize_matrix(W, 4, 128), act)["rel_output_error"]
    s, alpha = ref.awq_scale(W, act, 4, 128)
    aware = ref._err(W, ref.quantize_matrix(W, 4, 128, s), act)["rel_output_error"]
    assert aware < plain and alpha > 0


def test_quantize_checkpoint_keeps_embeddings_and_loads(tmp_path):
    pytest.importorskip("transformers.models.olmo3")
    import torch
    from transformers import AutoModelForCausalLM

    from forge.analysis.adapters import SafeTensorFile
    from tests.tiny_model import build_tiny_olmo3
    src = build_tiny_olmo3(tmp_path / "src", ["hello world, tool call json"] * 20)
    res = ref.quantize_checkpoint(src, tmp_path / "q4", 4, 32)
    a, b = SafeTensorFile(next(src.glob("*.safetensors"))), SafeTensorFile(next((tmp_path / "q4").glob("*.safetensors")))
    emb = next(k for k in a.keys() if "embed" in k)
    assert np.array_equal(a.get(emb).astype(np.float32), b.get(emb).astype(np.float32))       # embeddings untouched
    assert res["summary"]["quantized_params"] > 0 and res["summary"]["compression"] > 2
    assert {l["kind"] for l in res["layers"]} >= {"q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"}
    m = AutoModelForCausalLM.from_pretrained(tmp_path / "q4", local_files_only=True)
    with torch.no_grad():
        assert torch.isfinite(m(torch.tensor([[1, 2, 3]])).logits).all()


def test_lab_end_to_end_on_tiny_olmo3(tmp_path, monkeypatch):
    pytest.importorskip("peft")
    pytest.importorskip("transformers.models.olmo3")
    monkeypatch.setenv("FORGE_ALLOW_CPU", "1")
    monkeypatch.setenv("FORGE_ISOLATE_RUNS", "0")
    from forge.engine.runtime import OracleBackend
    from forge.engine.study import Study
    from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset
    from forge.quant import lab
    from tests.tiny_model import build_tiny_olmo3
    tasks = generate_taskset(TaskSetSpec(groups_per_family=3))
    olmo = build_tiny_olmo3(tmp_path / "olmo", [SYSTEM_PROMPT] + [t.prompt for t in tasks] + [json.dumps(c) for t in tasks for c in t.reference_calls])
    s = Study.init(tmp_path / "studies", name="quant", profile="smoke", device="cpu",
                   teacher={"provider": "lmstudio", "endpoint": "http://127.0.0.1:9/v1", "model": "t"},
                   student={"name": "olmo-tiny", "path": str(olmo)}, arms=["teacher_filtered"],
                   train_overrides={"max_steps": 2, "grad_accum": 1, "min_free_vram_mb": 0, "max_seq_len": 4096})
    s.plan["eval"]["max_new_tokens"] = 8
    s.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend({t.prompt: t for t in s.tasks()}))
    with pytest.raises(lab.QuantError):
        lab.source_dir(s)                                                    # no export yet
    for stage in ("build", "train", "evaluate_dev", "analyze_dev"):
        s.run_stage(stage, emit=lambda e: None)
    s.run_stage("seal", emit=lambda e: None, confirm="SEAL")
    for stage in ("evaluate_test", "analyze_test", "export"):
        s.run_stage(stage, emit=lambda e: None)
    man = lab.make_reference(s, {"method": "ref_w4_aware", "label": "w4 aware", "split": "dev"})
    assert man["calibration"]["source"].startswith("training split") and man["simulated"] is True
    with pytest.raises(lab.QuantError):
        lab.make_reference(s, {"method": "ref_w4_aware", "label": "w4 aware"})  # immutable
    perfect = OracleBackend({t.prompt: t for t in s.tasks()})
    lab.register_served(s, {"method": "vllm_w4a16_gptq", "label": "served gptq", "endpoint": "http://127.0.0.1:8000/v1", "model": "m", "size_bytes": 1234}, backend=perfect)
    L = lab.lab(s)
    n_dev = sum(1 for t in s.tasks() if t.split == "dev")
    v = {x["label"]: x for x in L["variants"]}
    assert v["w4_aware"]["results"]["dev"]["n"] == n_dev and v["w4_aware"]["results"]["dev"]["agreement"] is not None
    assert v["served_gptq"]["results"]["dev"]["rate"] == 1.0 and v["served_gptq"]["size_bytes"] == 1234 and not v["served_gptq"]["simulated"]
    assert L["unquantized"]["dev"]["n"] == n_dev and L["bf16_bytes"] > 0
    lab.evaluate(s, "w4_aware", "test")
    assert lab.lab(s)["variants"][1]["results"]["test"]["n"] == sum(1 for t in s.tasks() if t.split == "test")
    r = lab.recipe(s, "vllm_w4a16_gptq")
    calib = [json.loads(x)["text"] for x in open(r["calibration"]["file"], encoding="utf-8")]
    held_out = {t.prompt for t in s.tasks() if t.split in ("dev", "test", "ood", "regression")}
    assert calib and not any(p in c for c in calib for p in held_out)                  # calibration never sees held-out tasks
    spec = json.loads(open(r["spec"], encoding="utf-8").read())
    assert spec["recipe"][0]["GPTQModifier"]["scheme"] == "W4A16"
    assert lab.layers(s, "w4_aware")["layer_types"]["mixed"] is True

    # GGUF LM Studio check: the arm name must pass the study's path guard (it used a hyphen and never completed)
    from forge.engine import gguf
    gdir = s.root / "exports" / "gguf"
    gdir.mkdir(parents=True, exist_ok=True)
    mp = gdir / "quant-q4_k_m.json"
    mp.write_text(json.dumps({"file": "quant-q4_k_m.gguf", "quant": "Q4_K_M", "outtype": "f16"}))
    out = gguf.lmstudio_check(s, mp, "forge/quant", "http://127.0.0.1:1234", backend=perfect)
    assert out["success"] == 1.0 and out["tasks"] == sum(1 for t in s.tasks() if t.split == "test")
