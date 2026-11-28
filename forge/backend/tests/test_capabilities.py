import pytest

from forge.providers.base import DiscoveredModel
from forge.providers.hf_config import inspect_hf_dir
from forge.registry.capabilities import compute_capabilities
from forge.registry.registry import ModelRegistry, RegistryError
from tests.builders import write_hf_model

GPU = {"cuda_available": True, "bitsandbytes": True}
CPU = {"cuda_available": False, "bitsandbytes": False}


def hf(tmp_path, name="m", **kw):
    d = write_hf_model(tmp_path / name, **kw)
    return inspect_hf_dir(d, "local_directory", name, f"file://{d}")


def test_hf_complete_supported_arch_is_trainable(tmp_path):
    c = compute_capabilities(hf(tmp_path), GPU)
    assert c["inference"]["status"] == c["lora"]["status"] == c["qlora"]["status"] == "supported"
    assert c["logits"]["status"] == "supported" and c["tool_calling"]["status"] == "supported"


def test_qlora_requires_cuda(tmp_path):
    c = compute_capabilities(hf(tmp_path), CPU)
    assert c["lora"]["status"] == "supported" and c["qlora"]["status"] == "unsupported"


def test_incomplete_weights_not_trainable(tmp_path):
    c = compute_capabilities(hf(tmp_path, shards=2, drop_shard=True), GPU)
    assert c["inference"]["status"] == "unsupported" and c["lora"]["status"] == "unsupported"


def test_unknown_arch_not_assumed_trainable(tmp_path):
    c = compute_capabilities(hf(tmp_path, model_type="mystery", arch="MysteryForCausalLM"), GPU)
    assert c["lora"]["status"] == "unsupported"


def test_remote_code_is_conditional(tmp_path):
    c = compute_capabilities(hf(tmp_path, auto_map=True), GPU)
    assert c["inference"]["status"] == "conditional"


def test_prequantized_gptq(tmp_path):
    c = compute_capabilities(hf(tmp_path, quant={"quant_method": "gptq", "bits": 4}), GPU)
    assert c["lora"]["status"] == "conditional" and c["qlora"]["status"] == "unsupported"


@pytest.mark.parametrize("fmt", ["gguf", "ollama", "remote_api"])
def test_inference_formats_never_trainable(fmt):
    m = DiscoveredModel(provider="x", locator="x", name="x", format=fmt, metadata={"ollama_capabilities": ["tools"]})
    c = compute_capabilities(m, GPU)
    assert c["lora"]["status"] == "unsupported" and c["qlora"]["status"] == "unsupported"


def test_ollama_tools_from_capabilities():
    m = DiscoveredModel(provider="ollama", locator="o", name="o", format="ollama", metadata={"ollama_capabilities": ["completion"]})
    assert compute_capabilities(m, GPU)["tool_calling"]["status"] == "unsupported"


def _register(db, m, hw=GPU):
    return ModelRegistry(db).upsert(m, compute_capabilities(m, hw))


def test_roles_enforce_capabilities(db, tmp_path):
    reg = ModelRegistry(db)
    student = _register(db, hf(tmp_path, "s"))
    teacher = _register(db, DiscoveredModel(provider="ollama", locator="ollama://q:7b", name="q:7b", format="ollama",
                                            parameter_count=7_000_000_000, metadata={"ollama_capabilities": ["tools"]}))
    assert "teacher" in reg.assign_role(teacher, "teacher")["roles"]
    assert "student" in reg.assign_role(student, "student")["roles"]
    with pytest.raises(RegistryError):
        reg.assign_role(teacher, "student")  # Ollama blob is not trainable
    pc = reg.pair_check(teacher, student)
    # The hand-built Ollama row carries no kind evidence → a warning, never a silent pass.
    assert pc["verdict"] == "warn" and pc["distillation_modes"] == ["behavioral"]
    assert {c["check"] for c in pc["checks"]} >= {"capacity_ratio", "student_vram_lora_bf16", "one_gpu"}


def test_logit_kd_requires_matching_vocab(db, tmp_path):
    reg = ModelRegistry(db)
    t = _register(db, hf(tmp_path, "t", vocab=1000))
    s = _register(db, hf(tmp_path, "s", vocab=1000))
    s2 = _register(db, hf(tmp_path, "s2", vocab=999))
    assert "logit_kd" in reg.pair_check(t, s)["distillation_modes"]
    assert "logit_kd" not in reg.pair_check(t, s2)["distillation_modes"]


def _sized(tmp_path, name, params, shape):
    m = hf(tmp_path, name)
    m.parameter_count = params
    m.metadata.update(shape)
    return m


OLMO3_7B = {"hidden_size": 4096, "num_hidden_layers": 32, "intermediate_size": 11008, "vocab_size": 100278,
            "num_attention_heads": 32, "num_key_value_heads": 32}


def test_pair_check_takes_the_4bit_route_when_16bit_does_not_fit(db, tmp_path):
    """A 7B student on a 16 GB card: 16-bit training does not fit, a 4-bit base does — that is a supported setup, not a failure."""
    reg = ModelRegistry(db)
    t = _register(db, _sized(tmp_path, "t32", 32_000_000_000, {}))
    s = _register(db, _sized(tmp_path, "s7", 7_300_000_000, OLMO3_7B))
    pc = reg.pair_check(t, s, 16376)
    checks = {c["check"]: c for c in pc["checks"]}
    assert pc["verdict"] != "fail" and pc["quant_4bit_recommended"] is True
    assert checks["student_vram_lora_bf16"]["status"] == "info" and checks["student_vram_qlora_4bit"]["status"] in ("pass", "warn")
    # A 24 GB card fits 16-bit training of the same student: no 4-bit needed.
    assert reg.pair_check(t, s, 24 * 1024 * 1.0 + 8000)["quant_4bit_recommended"] is False
    # Too big even in 4-bit (a 32B student on 16 GB): a real failure, with the reason.
    big = _register(db, _sized(tmp_path, "s32", 32_000_000_000, {"hidden_size": 5120, "num_hidden_layers": 64, "intermediate_size": 27648, "vocab_size": 100278}))
    pc2 = reg.pair_check(t, big, 16376)
    assert pc2["verdict"] == "fail" and "smaller student" in next(c for c in pc2["checks"] if c["check"] == "student_vram_lora_bf16")["reason"]
