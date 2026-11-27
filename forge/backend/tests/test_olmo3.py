"""OLMo 3 architecture (Olmo3ForCausalLM) through every FORGE path, on a tiny offline model on CPU.

Wiring only: real Trainer + PEFT + generate + merge on the OLMo 3 layer layout (sliding-window and full attention, untied
head). It says nothing about OLMo 3 7B's memory, speed or learning — that needs a GPU and the real weights.
"""
import json

import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("peft")
transformers = pytest.importorskip("transformers")
pytest.importorskip("transformers.models.olmo3", reason="needs transformers >= 4.57 (OLMo 3)")

from forge.engine.runtime import OracleBackend, TransformersBackend  # noqa: E402
from forge.engine.study import Study, read_jsonl  # noqa: E402
from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset  # noqa: E402
from tests.tiny_model import build_tiny_olmo3  # noqa: E402


@pytest.fixture(scope="module")
def olmo(tmp_path_factory):
    tasks = generate_taskset(TaskSetSpec(groups_per_family=8))
    corpus = [SYSTEM_PROMPT] + [t.prompt for t in tasks] + [json.dumps(c) for t in tasks for c in t.reference_calls]
    return build_tiny_olmo3(tmp_path_factory.mktemp("olmo") / "Olmo-3-tiny", corpus)


def test_olmo3_is_recognised_as_trainable(olmo, monkeypatch):
    """The Model Observatory's discovery path: an OLMo 3 checkpoint is a causal LM FORGE can run and LoRA-train."""
    from transformers.models.auto.modeling_auto import MODEL_FOR_CAUSAL_LM_MAPPING_NAMES

    from forge.providers.hf_config import inspect_hf_dir
    from forge.registry import capabilities
    from forge.registry.capabilities import compute_capabilities
    # conftest pins a fixed architecture list for determinism; this test needs the installed transformers' real one
    monkeypatch.setattr(capabilities, "_transformers_causal_lm_types", lambda: frozenset(MODEL_FOR_CAUSAL_LM_MAPPING_NAMES))
    cfg = json.loads((olmo / "config.json").read_text())
    assert cfg["model_type"] == "olmo3" and cfg["architectures"] == ["Olmo3ForCausalLM"]
    assert set(cfg["layer_types"]) == {"sliding_attention", "full_attention"}
    m = inspect_hf_dir(olmo, "huggingface_cache", "allenai/Olmo-3-tiny", str(olmo))
    caps = compute_capabilities(m, {"cuda_available": True, "bitsandbytes": True})
    assert caps["inference"]["status"] == "supported" and caps["lora"]["status"] == "supported", caps


def test_full_olmo3_study_train_eval_seal_test_export(olmo, tmp_path, monkeypatch):
    monkeypatch.setenv("FORGE_ALLOW_CPU", "1")
    monkeypatch.setenv("FORGE_ISOLATE_RUNS", "0")
    study = Study.init(tmp_path / "studies", name="olmo3-wiring", profile="smoke", device="cpu",
                       teacher={"provider": "lmstudio", "endpoint": "http://127.0.0.1:9/v1", "model": "oracle-as-teacher"},
                       student={"name": "Olmo-3-tiny", "path": str(olmo)}, arms=["teacher_filtered"],
                       train_overrides={"max_steps": 2, "grad_accum": 2, "min_free_vram_mb": 0, "max_seq_len": 4096})
    tasks = {t.prompt: t for t in study.tasks()}
    study.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend(tasks))
    for stage in ("build", "train", "evaluate_dev", "analyze_dev"):
        study.run_stage(stage, emit=lambda e: None)
    run = json.loads((study.run_dir("teacher_filtered", 0) / "run.json").read_text())
    assert run["zero_adapter_max_abs_diff"] == 0.0 and run["global_step"] == 2
    assert run["base_hash_before"] == run["base_hash_after"]            # original weights never modified
    assert 0 < run["trainable_params"] < run["total_params"]
    insp = json.loads((study.run_dir("teacher_filtered", 0) / "inspection.json").read_text())
    kinds = {m.rsplit(".", 1)[-1] for m in (x["module"] for x in insp["modules"])}
    assert {"q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"} <= kinds
    assert read_jsonl(study.episode_path("teacher_filtered", "dev", 0))       # real generate ran on the OLMo 3 student
    study.run_stage("seal", emit=lambda e: None, confirm="SEAL")
    for stage in ("evaluate_test", "analyze_test"):
        study.run_stage(stage, emit=lambda e: None)
    res = study.run_stage("export", emit=lambda e: None)                    # merge into a full OLMo 3 checkpoint + re-evaluate it
    man = json.loads((study.root / "exports" / "teacher_filtered-seed0-merged" / "forge_export.json").read_text())
    assert 0.0 <= res["agreement_with_adapter"] <= 1.0 and man["post_merge_eval"]["split"] == "test"
    merged_cfg = json.loads((study.root / "exports" / "teacher_filtered-seed0-merged" / "config.json").read_text())
    assert merged_cfg["model_type"] == "olmo3"

    # weight microscope on an OLMo 3 module (exact from the factors; base read-only)
    from forge.analysis.microscope import microscope
    mod = next(x["module"] for x in insp["modules"] if x["module"].endswith("layers.3.self_attn.k_proj"))
    m = microscope(study.run_dir("teacher_filtered", 0) / "adapter", olmo, mod)
    assert m["norms"]["dW"] > 0 and abs(sum(p["share"] for p in m["parts"]) - 1) < 1e-6
    assert study.base_4bit is False


def test_backend_4bit_flag_is_off_on_cpu(olmo):
    b = TransformersBackend(str(olmo), None, device="cpu", load_4bit=True, max_new_tokens=4)
    b.load()   # 4-bit needs CUDA + bitsandbytes; on CPU it must fall back to the normal load, not fail
    assert b._state["model"].config.model_type == "olmo3"
    b.unload()


def test_memory_gate_follows_the_4bit_base():
    """A 7B student (OLMo 3 7B shape): refused in bf16 on a 16 GB card, admitted with a 4-bit base."""
    from forge.api.routes_studies import vram_gate
    s = {"metadata": {"parameter_report": {"unique_total": 7.3e9}, "hidden_size": 4096, "num_hidden_layers": 32, "intermediate_size": 11008,
                      "vocab_size": 100278, "num_attention_heads": 32, "num_key_value_heads": 32, "head_dim": 128}}
    bf16, nf4 = vram_gate(s, 3072, "bf16"), vram_gate(s, 3072, "nf4")
    assert bf16["min_free_vram_mb"] > 16384 > nf4["min_free_vram_mb"]
    assert "4-bit" in nf4["min_free_vram_basis"] and "4-bit" not in bf16["min_free_vram_basis"]
