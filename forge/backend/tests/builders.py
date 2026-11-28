"""Test fixtures that write *real* binary formats (GGUF, safetensors) so readers are exercised end-to-end."""
from __future__ import annotations

import json
import struct
from pathlib import Path


def _s(x: str) -> bytes:
    b = x.encode()
    return struct.pack("<Q", len(b)) + b


def write_gguf(path: Path, arch="llama", ctx=8192, file_type=15, tensors=((4096, 32000), (4096, 4096)),
               template="{% for m in messages %}{{ m.content }}{% endfor %}{% if tools %}tools{% endif %}", vocab=200):
    kv = []
    kv.append(_s("general.architecture") + struct.pack("<I", 8) + _s(arch))
    kv.append(_s("general.name") + struct.pack("<I", 8) + _s("Test Model"))
    kv.append(_s("general.license") + struct.pack("<I", 8) + _s("apache-2.0"))
    kv.append(_s("general.file_type") + struct.pack("<I", 4) + struct.pack("<I", file_type))
    kv.append(_s(f"{arch}.context_length") + struct.pack("<I", 4) + struct.pack("<I", ctx))
    # large string array (vocabulary) must be skipped, not stored
    arr = struct.pack("<I", 8) + struct.pack("<Q", vocab) + b"".join(_s(f"tok{i}") for i in range(vocab))
    kv.append(_s("tokenizer.ggml.tokens") + struct.pack("<I", 9) + arr)
    # large scalar array (scores) exercise the seek path
    kv.append(_s("tokenizer.ggml.scores") + struct.pack("<I", 9) + struct.pack("<I", 6) + struct.pack("<Q", vocab) + b"\0" * 4 * vocab)
    if template is not None:
        kv.append(_s("tokenizer.chat_template") + struct.pack("<I", 8) + _s(template))
    ti = b""
    for i, dims in enumerate(tensors):
        ti += _s(f"t{i}") + struct.pack("<I", len(dims)) + struct.pack(f"<{len(dims)}Q", *dims) + struct.pack("<IQ", 0, 0)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"GGUF" + struct.pack("<I", 3) + struct.pack("<QQ", len(tensors), len(kv)) + b"".join(kv) + ti)


def write_safetensors(path: Path, shapes: dict[str, list[int]], dtype="BF16"):
    header, off = {}, 0
    for name, shape in shapes.items():
        n = 1
        for d in shape:
            n *= d
        header[name] = {"dtype": dtype, "shape": shape, "data_offsets": [off, off + n * 2]}
        off += n * 2
    header["__metadata__"] = {"format": "pt"}
    h = json.dumps(header).encode()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(struct.pack("<Q", len(h)) + h)  # header only — readers never touch tensor data


def write_hf_model(d: Path, model_type="qwen2", arch="Qwen2ForCausalLM", tools=True, license_="apache-2.0",
                   shards=1, drop_shard=False, quant=None, auto_map=False, vocab=1000):
    d.mkdir(parents=True, exist_ok=True)
    cfg = {"architectures": [arch], "model_type": model_type, "hidden_size": 64, "num_hidden_layers": 2,
           "intermediate_size": 128, "vocab_size": vocab, "num_attention_heads": 4, "max_position_embeddings": 32768,
           "torch_dtype": "bfloat16"}
    if quant:
        cfg["quantization_config"] = quant
    if auto_map:
        cfg["auto_map"] = {"AutoModelForCausalLM": "modeling.X"}
    (d / "config.json").write_text(json.dumps(cfg))
    tpl = "{% if tools %}<tools>{{ tools }}</tools>{% endif %}" if tools else "{{ messages }}"
    (d / "tokenizer_config.json").write_text(json.dumps({"chat_template": tpl}))
    (d / "README.md").write_text(f"---\nlicense: {license_}\n---\n# model\n")
    if shards == 1:
        write_safetensors(d / "model.safetensors", {"embed": [vocab, 64], "w": [64, 64]})
    else:
        weight_map = {}
        for i in range(shards):
            name = f"model-{i+1:05d}-of-{shards:05d}.safetensors"
            weight_map[f"w{i}"] = name
            if not (drop_shard and i == shards - 1):
                write_safetensors(d / name, {f"w{i}": [64, 64]})
        (d / "model.safetensors.index.json").write_text(json.dumps({"weight_map": weight_map}))
    return d


def write_hf_cache_repo(cache: Path, repo_id: str, **kw) -> Path:
    repo = cache / f"models--{repo_id.replace('/', '--')}"
    rev = "a" * 40
    (repo / "refs").mkdir(parents=True, exist_ok=True)
    (repo / "refs" / "main").write_text(rev)
    (repo / "blobs").mkdir(exist_ok=True)
    return write_hf_model(repo / "snapshots" / rev, **kw)
