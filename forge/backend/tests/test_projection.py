import json
import struct

import numpy as np
import pytest

from forge.analysis.adapters import AdapterError, SafeTensorFile
from forge.analysis.projection import load_vocab, project, show


def _st(path, tensors, dtype="F32"):
    header, blobs, off = {}, [], 0
    for k, a in tensors.items():
        raw = ((a.astype(np.float32).view(np.uint32) >> 16).astype(np.uint16).tobytes() if dtype == "BF16"
               else a.astype(np.float32).tobytes())
        header[k] = {"dtype": dtype, "shape": list(a.shape), "data_offsets": [off, off + len(raw)]}
        blobs.append(raw)
        off += len(raw)
    h = json.dumps(header).encode()
    path.write_bytes(struct.pack("<Q", len(h)) + h + b"".join(blobs))


def _tokenizer(d, n):
    vocab = {f"tok{i}": i for i in range(n)}
    vocab.pop("tok7"); vocab["\u0120lookup"] = 7          # "Ġlookup" = " lookup" in byte-level BPE
    vocab.pop("tok9"); vocab["\u010a"] = 9                # "Ċ" = newline
    d.joinpath("tokenizer.json").write_text(json.dumps({"model": {"type": "BPE", "vocab": vocab},
        "added_tokens": [{"id": n, "content": "<|im_end|>", "special": True}]}))


@pytest.fixture
def planted(tmp_path):
    rng = np.random.default_rng(0)
    hidden, vocab, inner = 8, 20000, 16  # vocab > CHUNK_ROWS exercises chunked streaming
    base, ad = tmp_path / "base", tmp_path / "adapter"
    base.mkdir(); ad.mkdir()
    WU = rng.normal(scale=0.01, size=(vocab + 1, hidden))
    target = np.zeros(hidden); target[3] = 1.0
    WU[7] = 5.0 * target                       # token 7 is the unembedding row aligned with the update
    _st(base / "model.safetensors", {"lm_head.weight": WU, "model.norm.weight": np.ones(hidden),
                                     "model.layers.1.self_attn.o_proj.weight": rng.normal(size=(hidden, hidden))}, "BF16")
    base.joinpath("config.json").write_text(json.dumps({"model_type": "qwen3"}))
    _tokenizer(base, vocab)
    B = np.zeros((hidden, 2)); B[:, 0] = target; B[:, 1] = rng.normal(scale=0.001, size=hidden)
    A = np.zeros((2, inner)); A[0] = rng.normal(size=inner); A[1] = rng.normal(scale=0.001, size=inner)
    mod = "base_model.model.model.layers.1.self_attn.o_proj"
    q = "base_model.model.model.layers.1.self_attn.q_proj"  # not a residual writer → excluded
    _st(ad / "adapter_model.safetensors", {f"{mod}.lora_A.weight": A, f"{mod}.lora_B.weight": B,
                                           f"{q}.lora_A.weight": A, f"{q}.lora_B.weight": np.ones((hidden, 2))})
    ad.joinpath("adapter_config.json").write_text(json.dumps({"r": 2, "lora_alpha": 4}))
    return ad, base


def test_planted_direction_surfaces_its_token(planted):
    ad, base = planted
    res = project(ad, base, last_layers=4, k=5)
    assert [m["kind"] for m in res["modules"]] == ["o_proj"] and res["heuristic"]
    m = res["modules"][0]
    ends = [m["plus"][0], m["minus"][0]]                    # sign of u1 is arbitrary
    hit = next(e for e in ends if e["id"] == 7)
    assert hit["token"] == "\u2423lookup" and abs(hit["z"]) > 10   # "␣lookup", far outside the vocab spread
    assert m["energy_share"] > 0.99 and len(res["caveats"]) == 4


def test_vocab_decoding_and_display(planted):
    _, base = planted
    vocab, special = load_vocab(base)
    assert vocab[7] == " lookup" and vocab[9] == "\n" and 20000 in special
    assert show(vocab[7]) == "\u2423lookup" and show(vocab[9]) == "\u23ce"
    assert show("\x1b") == "\\x1b" and show("") == "\u2205"


def test_rows_reads_only_requested_slice(planted):
    _, base = planted
    st = SafeTensorFile(base / "model.safetensors")
    full = st.get("lm_head.weight")
    assert np.allclose(st.rows("lm_head.weight", 5, 9), full[5:9], atol=0)


def test_no_residual_writers_is_an_error(planted, tmp_path):
    ad, base = planted
    only_q = tmp_path / "q"
    only_q.mkdir()
    st = SafeTensorFile(ad / "adapter_model.safetensors")
    q = "base_model.model.model.layers.1.self_attn.q_proj"
    _st(only_q / "adapter_model.safetensors", {f"{q}.lora_A.weight": st.get(f"{q}.lora_A.weight"),
                                               f"{q}.lora_B.weight": st.get(f"{q}.lora_B.weight")})
    only_q.joinpath("adapter_config.json").write_text(json.dumps({"r": 2, "lora_alpha": 4}))
    with pytest.raises(AdapterError):
        project(only_q, base)
