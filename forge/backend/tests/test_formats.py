from forge.providers.formats import count_safetensors_params, read_gguf_metadata, read_safetensors_header, FormatError
from tests.builders import write_gguf, write_hf_model, write_safetensors
import pytest


def test_gguf_metadata_exact(tmp_path):
    p = tmp_path / "m.gguf"
    write_gguf(p, arch="qwen2", ctx=32768, file_type=15, tensors=((10, 20), (5,)), vocab=500)
    m = read_gguf_metadata(p)
    assert m["architecture"] == "qwen2"
    assert m["context_length"] == 32768
    assert m["quantization"] == "Q4_K_M"
    assert m["parameter_count"] == 205
    assert m["license"] == "apache-2.0"
    assert m["template_mentions_tools"] is True


def test_gguf_rejects_non_gguf(tmp_path):
    p = tmp_path / "x.gguf"
    p.write_bytes(b"NOPE" + b"\0" * 32)
    with pytest.raises(FormatError):
        read_gguf_metadata(p)


def test_gguf_truncated(tmp_path):
    p = tmp_path / "t.gguf"
    write_gguf(p)
    p.write_bytes(p.read_bytes()[:40])
    with pytest.raises(FormatError):
        read_gguf_metadata(p)


def test_safetensors_param_count(tmp_path):
    p = tmp_path / "a.safetensors"
    write_safetensors(p, {"a": [3, 4], "b": [10]})
    h = read_safetensors_header(p)
    assert h["parameter_count"] == 22 and h["dtypes"] == {"BF16": 22}


def test_sharded_incomplete_detected(tmp_path):
    d = write_hf_model(tmp_path / "m", shards=3, drop_shard=True)
    params, _, complete = count_safetensors_params(d)
    assert params == 2 * 64 * 64 and complete is False
