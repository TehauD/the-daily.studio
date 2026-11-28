"""Header-only readers for GGUF and safetensors.

Reading only headers lets FORGE capture exact parameter counts and metadata for
multi-GB files in milliseconds without torch and without loading weights.
"""
from __future__ import annotations

import json
import struct
from pathlib import Path
from typing import Any, BinaryIO

MAX_SAFETENSORS_HEADER = 100 * 2**20

GGUF_FILE_TYPES = {
    0: "F32", 1: "F16", 2: "Q4_0", 3: "Q4_1", 7: "Q8_0", 8: "Q5_0", 9: "Q5_1", 10: "Q2_K", 11: "Q3_K_S",
    12: "Q3_K_M", 13: "Q3_K_L", 14: "Q4_K_S", 15: "Q4_K_M", 16: "Q5_K_S", 17: "Q5_K_M", 18: "Q6_K",
    19: "IQ2_XXS", 20: "IQ2_XS", 21: "Q2_K_S", 22: "IQ3_XS", 23: "IQ3_XXS", 24: "IQ1_S", 25: "IQ4_NL",
    26: "IQ3_S", 27: "IQ3_M", 28: "IQ2_S", 29: "IQ2_M", 30: "IQ4_XS", 31: "IQ1_M", 32: "BF16",
    # llama.cpp LLAMA_FTYPE values 33-35 were the removed Q4_0_N_M repacks; 36+ are current.
    33: "Q4_0_4_4", 34: "Q4_0_4_8", 35: "Q4_0_8_8", 36: "TQ1_0", 37: "TQ2_0", 38: "MXFP4",
}

# Tensor-name markers for embedding / output-projection weights (HF and GGUF naming).
EMBED_MARKERS = ("embed_tokens", "wte.weight", "word_embeddings", "token_embd")
LM_HEAD_MARKERS = ("lm_head", "output.weight")


def classify_tensor(name: str) -> str:
    """'embedding' | 'lm_head' | 'other' — used to report embedding vs non-embedding parameters."""
    n = name.lower()
    if any(m in n for m in EMBED_MARKERS):
        return "embedding"
    if n.startswith("lm_head") or n == "output.weight" or n.endswith(".lm_head.weight"):
        return "lm_head"
    return "other"
_SCALARS = {0: "<B", 1: "<b", 2: "<H", 3: "<h", 4: "<I", 5: "<i", 6: "<f", 7: "<?", 10: "<Q", 11: "<q", 12: "<d"}
ARRAY_KEEP_LIMIT = 64  # tokenizer vocabularies are skipped, not stored


class FormatError(ValueError):
    pass


def _read(f: BinaryIO, n: int) -> bytes:
    b = f.read(n)
    if len(b) != n:
        raise FormatError("Unexpected end of file")
    return b


def _gguf_string(f: BinaryIO) -> str:
    (n,) = struct.unpack("<Q", _read(f, 8))
    if n > 2**26:
        raise FormatError("Implausible GGUF string length")
    return _read(f, n).decode("utf-8", errors="replace")


def _gguf_value(f: BinaryIO, vtype: int) -> Any:
    if vtype in _SCALARS:
        fmt = _SCALARS[vtype]
        return struct.unpack(fmt, _read(f, struct.calcsize(fmt)))[0]
    if vtype == 8:
        return _gguf_string(f)
    if vtype == 9:
        (etype,) = struct.unpack("<I", _read(f, 4))
        (count,) = struct.unpack("<Q", _read(f, 8))
        if etype in _SCALARS and count > ARRAY_KEEP_LIMIT:
            f.seek(struct.calcsize(_SCALARS[etype]) * count, 1)
            return {"_array_len": count}
        items = [_gguf_value(f, etype) for _ in range(count)]
        return items if count <= ARRAY_KEEP_LIMIT else {"_array_len": count}
    raise FormatError(f"Unknown GGUF value type {vtype}")


def read_gguf_metadata(path: Path) -> dict[str, Any]:
    with open(path, "rb") as raw:
        import io
        f = io.BufferedReader(raw, buffer_size=1 << 20)
        if _read(f, 4) != b"GGUF":
            raise FormatError("Not a GGUF file")
        (version,) = struct.unpack("<I", _read(f, 4))
        if version < 2:
            raise FormatError(f"GGUF v{version} is not supported")
        tensor_count, kv_count = struct.unpack("<QQ", _read(f, 16))
        kv: dict[str, Any] = {}
        for _ in range(kv_count):
            key = _gguf_string(f)
            (vtype,) = struct.unpack("<I", _read(f, 4))
            kv[key] = _gguf_value(f, vtype)
        params = 0
        breakdown = {"embedding": 0, "lm_head": 0, "other": 0}
        for _ in range(tensor_count):
            tname = _gguf_string(f)
            (n_dims,) = struct.unpack("<I", _read(f, 4))
            if n_dims > 8:
                raise FormatError("Implausible tensor rank")
            dims = struct.unpack(f"<{n_dims}Q", _read(f, 8 * n_dims))
            _read(f, 12)  # ggml type (u32) + offset (u64)
            n = 1
            for d in dims:
                n *= d
            params += n
            breakdown[classify_tensor(tname)] += n
    arch = kv.get("general.architecture")
    ft = kv.get("general.file_type")
    template = kv.get("tokenizer.chat_template") if isinstance(kv.get("tokenizer.chat_template"), str) else None
    return {
        "gguf_version": version,
        "architecture": arch,
        "name": kv.get("general.name"),
        "license": kv.get("general.license"),
        "context_length": kv.get(f"{arch}.context_length") if arch else None,
        "quantization": GGUF_FILE_TYPES.get(ft, f"file_type_{ft}") if ft is not None else None,
        "parameter_count": params,
        "parameter_breakdown": breakdown,
        "tensor_count": tensor_count,
        "has_chat_template": template is not None,
        "template_mentions_tools": bool(template and "tool" in template),
        "embedding_length": kv.get(f"{arch}.embedding_length") if arch else None,
        "block_count": kv.get(f"{arch}.block_count") if arch else None,
    }


def read_safetensors_header(path: Path) -> dict[str, Any]:
    with open(path, "rb") as f:
        (n,) = struct.unpack("<Q", _read(f, 8))
        if n > MAX_SAFETENSORS_HEADER:
            raise FormatError("safetensors header exceeds safety limit")
        header = json.loads(_read(f, n))
    meta = header.pop("__metadata__", {}) or {}
    params, dtypes = 0, {}
    breakdown = {"embedding": 0, "lm_head": 0, "other": 0}
    for name, t in header.items():
        count = 1
        for d in t.get("shape", []):
            count *= d
        params += count
        dtypes[t.get("dtype", "?")] = dtypes.get(t.get("dtype", "?"), 0) + count
        breakdown[classify_tensor(name)] += count
    return {"parameter_count": params, "dtypes": dtypes, "metadata": meta, "breakdown": breakdown,
            "tensors": {k: {"dtype": v.get("dtype"), "shape": v.get("shape"), "data_offsets": v.get("data_offsets")}
                        for k, v in header.items()}, "header_size": n}


def _shard_names(model_dir: Path) -> list[str]:
    index = model_dir / "model.safetensors.index.json"
    if index.exists():
        try:
            return sorted(set(json.loads(index.read_text(encoding="utf-8"))["weight_map"].values()))
        except (OSError, KeyError, json.JSONDecodeError):
            return []
    return [p.name for p in sorted(model_dir.glob("*.safetensors"))]


def parameter_report(model_dir: Path, tie_word_embeddings: bool | None) -> dict[str, Any] | None:
    """Reconcile stored vs. unique parameters (the '2.03B vs 1.7B' question).

    Some checkpoints (e.g. Qwen3-1.7B) declare tie_word_embeddings=true yet still
    serialize lm_head.weight. The header total then counts the shared matrix twice.
    We report: stored total, embedding, lm_head, non-embedding, and the unique count
    a tied model actually trains/uses.
    """
    shards = _shard_names(model_dir)
    if not shards:
        return None
    b = {"embedding": 0, "lm_head": 0, "other": 0}
    total = 0
    for name in shards:
        p = model_dir / name
        if not p.exists():
            return None
        try:
            h = read_safetensors_header(p)
        except (OSError, FormatError, json.JSONDecodeError):
            return None
        total += h["parameter_count"]
        for k in b:
            b[k] += h["breakdown"][k]
    tied = bool(tie_word_embeddings)
    duplicate = b["lm_head"] if (tied and b["lm_head"] and b["lm_head"] == b["embedding"]) else 0
    unique = total - duplicate
    return {
        "stored_total": total,
        "embedding": b["embedding"],
        "lm_head_stored": b["lm_head"],
        "tie_word_embeddings": tied,
        "lm_head_is_duplicate_of_tied_embedding": bool(duplicate),
        "unique_total": unique,
        # Convention used by model cards: non-embedding excludes the input embedding and any untied output head.
        "non_embedding": unique - b["embedding"] - (0 if tied else b["lm_head"]),
        "note": ("lm_head is serialized although embeddings are tied; the stored total double-counts one "
                 f"{b['embedding']:,}-parameter matrix.") if duplicate else
                ("Untied output head counted separately." if b["lm_head"] else "No separate lm_head tensor stored."),
    }


def count_safetensors_params(model_dir: Path) -> tuple[int | None, dict[str, int], bool]:
    """Returns (params, dtype histogram, complete). `complete` is False if index shards are missing."""
    index = model_dir / "model.safetensors.index.json"
    if index.exists():
        try:
            shards = sorted(set(json.loads(index.read_text(encoding="utf-8"))["weight_map"].values()))
        except (OSError, KeyError, json.JSONDecodeError):
            shards = []
    else:
        shards = [p.name for p in sorted(model_dir.glob("*.safetensors"))]
    if not shards:
        return None, {}, False
    total, dtypes, complete = 0, {}, True
    for name in shards:
        p = model_dir / name
        if not p.exists():
            complete = False
            continue
        try:
            h = read_safetensors_header(p)
        except (OSError, FormatError, json.JSONDecodeError):
            complete = False
            continue
        total += h["parameter_count"]
        for k, v in h["dtypes"].items():
            dtypes[k] = dtypes.get(k, 0) + v
    return total, dtypes, complete


def read_readme_license(model_dir: Path) -> str | None:
    readme = model_dir / "README.md"
    if not readme.exists():
        return None
    try:
        text = readme.read_text(encoding="utf-8", errors="replace")[:20000]
    except OSError:
        return None
    if not text.startswith("---"):
        return None
    front = text.split("---", 2)[1] if text.count("---") >= 2 else ""
    for line in front.splitlines():
        if line.strip().startswith("license:"):
            return line.split(":", 1)[1].strip().strip("'\"") or None
    return None
