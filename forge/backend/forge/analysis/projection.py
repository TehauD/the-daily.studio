"""Token projection of LoRA update directions ("logit lens on weights") — a heuristic, labeled as such.

For modules that write into the residual stream (o_proj, down_proj), the adapter's strongest
output direction u₁ of ΔW = s·B·A is computed from the r×r core (thin QR of B and Aᵀ; ΔW is never
formed). Projecting g ⊙ u₁ (g = final RMSNorm weight) through the unembedding W_U gives a score per
vocabulary token: which tokens a push along u₁ would favour *if it reached the output unchanged*.

Caveats (returned with every result):
- Later layers transform the residual stream; the projection ignores them, so it is most
  meaningful in the last layers and weak in the middle of the network.
- A singular direction's sign depends on the input, so both ends (+u₁ and −u₁) are reported.
- RMSNorm's per-token normalisation is ignored; only its learned scale g is applied.

Only safetensors are read. Vocabulary-sized matrices are streamed in row chunks as float32.
"""
from __future__ import annotations

import json
import math
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from forge.analysis.adapters import _KEY, _LAYER, AdapterError, SafeTensorFile, _base_index

PROJECTION_VERSION = 2  # bump when output format/semantics change; invalidates cached results
RESIDUAL_WRITERS = ("o_proj", "down_proj", "dense", "c_proj", "out_proj")
CHUNK_ROWS = 8192


@lru_cache(maxsize=1)
def _byte_decoder() -> dict[str, int]:
    """Inverse of GPT-2's bytes_to_unicode (used by byte-level BPE tokenizers such as Qwen's)."""
    bs = list(range(ord("!"), ord("~") + 1)) + list(range(ord("¡"), ord("¬") + 1)) + list(range(ord("®"), ord("ÿ") + 1))
    cs = bs[:]
    n = 0
    for b in range(256):
        if b not in bs:
            bs.append(b)
            cs.append(256 + n)
            n += 1
    return {chr(c): b for b, c in zip(bs, cs)}


def load_vocab(model_dir: Path) -> tuple[dict[int, str], set[int]]:
    """id → human-readable token, and the set of special/added token ids. Reads tokenizer.json only."""
    tj = model_dir / "tokenizer.json"
    if not tj.exists():
        raise AdapterError(f"No tokenizer.json in {model_dir}; cannot label tokens")
    data = json.loads(tj.read_text(encoding="utf-8"))
    vocab = data.get("model", {}).get("vocab") or {}
    if isinstance(vocab, list):  # Unigram: [[piece, score], …]
        id2tok = {i: p[0] for i, p in enumerate(vocab)}
    else:
        id2tok = {i: t for t, i in vocab.items()}
    special = set()
    for at in data.get("added_tokens", []):
        id2tok[at["id"]] = at["content"]
        if at.get("special"):
            special.add(at["id"])
    dec = _byte_decoder()
    out: dict[int, str] = {}
    for i, t in id2tok.items():
        if i in special:
            out[i] = t
        elif all(ch in dec for ch in t):
            # Byte-level BPE tokens can be partial UTF-8 sequences; show the raw bytes rather than "�".
            out[i] = bytes(dec[ch] for ch in t).decode("utf-8", errors="backslashreplace")
        else:
            out[i] = t.replace("▁", " ")
    return out, special


def show(token: str) -> str:
    """Make whitespace and control characters visible so the UI renders tokens faithfully."""
    t = token.replace(" ", "␣").replace("\n", "⏎").replace("\t", "⇥").replace("\r", "␍")
    t = "".join(f"\\x{ord(c):02x}" if unicodedata.category(c) == "Cc" else c for c in t)
    return t or "∅"


def _top_direction(A: np.ndarray, B: np.ndarray, scale: float) -> tuple[np.ndarray, float, float]:
    Qb, Rb = np.linalg.qr(B)
    _, Ra = np.linalg.qr(A.T)
    U, S, _ = np.linalg.svd(scale * (Rb @ Ra.T))
    return Qb @ U[:, 0], float(S[0]), float(S[0] ** 2 / max(1e-30, (S ** 2).sum()))


def project(adapter_dir: Path, base_dir: Path, last_layers: int = 4, k: int = 12) -> dict[str, Any]:
    cfg = json.loads((adapter_dir / "adapter_config.json").read_text(encoding="utf-8"))
    r, alpha = int(cfg["r"]), float(cfg.get("lora_alpha", cfg["r"]))
    scale = alpha / math.sqrt(r) if cfg.get("use_rslora") else alpha / r
    st = SafeTensorFile(adapter_dir / "adapter_model.safetensors")
    pairs: dict[str, dict[str, str]] = {}
    for key in st.keys():
        m = _KEY.match(key)
        if m and m.group("mod").rsplit(".", 1)[-1] in RESIDUAL_WRITERS:
            pairs.setdefault(m.group("mod"), {})[m.group("ab")] = key
    mods = [(int(_LAYER.search(mod).group(1)), mod, ab) for mod, ab in pairs.items()
            if set(ab) == {"A", "B"} and _LAYER.search(mod)]
    if not mods:
        raise AdapterError("Adapter has no residual-writing modules (o_proj / down_proj) to project")
    layers = sorted({layer for layer, _, _ in mods})[-last_layers:]
    mods = sorted([x for x in mods if x[0] in layers])

    base = _base_index(base_dir)
    wu_key = "lm_head.weight" if "lm_head.weight" in base else "model.embed_tokens.weight"
    if wu_key not in base:
        raise AdapterError("Base model has neither lm_head.weight nor model.embed_tokens.weight")
    base_cfg = json.loads((base_dir / "config.json").read_text(encoding="utf-8"))
    hidden = base[wu_key].header[wu_key]["shape"][1]
    g = np.ones(hidden, dtype=np.float64)
    if "model.norm.weight" in base:
        g = base["model.norm.weight"].get("model.norm.weight").astype(np.float64)
        if str(base_cfg.get("model_type", "")).startswith("gemma"):
            g = 1.0 + g  # Gemma's RMSNorm scales by (1 + w)

    dirs, meta = [], []
    for layer, mod, ab in mods:
        u, s1, share = _top_direction(st.get(ab["A"]), st.get(ab["B"]), scale)
        if u.shape[0] != hidden:
            continue
        dirs.append(g * u)
        meta.append({"module": mod, "layer": layer, "kind": mod.rsplit(".", 1)[-1], "sigma1": s1, "energy_share": share})
    D = np.stack(dirs, axis=1).astype(np.float32)  # hidden × M

    # Stream W_U in row chunks: running top-k / bottom-k plus moments for z-scores.
    wu = base[wu_key]
    n_vocab = wu.header[wu_key]["shape"][0]
    M = D.shape[1]
    best = [np.empty(0, dtype=np.int64)] * M
    best_s = [np.empty(0, dtype=np.float32)] * M
    worst, worst_s = list(best), list(best_s)
    s1 = np.zeros(M)
    s2 = np.zeros(M)
    for start in range(0, n_vocab, CHUNK_ROWS):
        S = wu.rows(wu_key, start, start + CHUNK_ROWS) @ D  # chunk × M
        s1 += S.sum(axis=0, dtype=np.float64)
        s2 += (S.astype(np.float64) ** 2).sum(axis=0)
        ids = np.arange(start, start + S.shape[0])
        for j in range(M):
            col = S[:, j]
            kk = min(k, col.shape[0])
            hi = np.argpartition(-col, kk - 1)[:kk]
            lo = np.argpartition(col, kk - 1)[:kk]
            best[j] = np.concatenate([best[j], ids[hi]])
            best_s[j] = np.concatenate([best_s[j], col[hi]])
            worst[j] = np.concatenate([worst[j], ids[lo]])
            worst_s[j] = np.concatenate([worst_s[j], col[lo]])
            if best[j].shape[0] > 4 * k:
                o = np.argsort(-best_s[j])[:k]
                best[j], best_s[j] = best[j][o], best_s[j][o]
                o = np.argsort(worst_s[j])[:k]
                worst[j], worst_s[j] = worst[j][o], worst_s[j][o]

    id2tok, special = load_vocab(base_dir)
    mean = s1 / n_vocab
    std = np.sqrt(np.maximum(1e-30, s2 / n_vocab - mean ** 2))
    results = []
    for j, m in enumerate(meta):
        def fmt(ids: np.ndarray, sc: np.ndarray, desc: bool) -> list[dict]:
            o = np.argsort(-sc if desc else sc)[:k]
            return [{"id": int(ids[i]), "token": show(id2tok.get(int(ids[i]), f"<{int(ids[i])}>")),
                     "special": int(ids[i]) in special, "z": float((sc[i] - mean[j]) / std[j])} for i in o]
        results.append({**m, "plus": fmt(best[j], best_s[j], True), "minus": fmt(worst[j], worst_s[j], False)})
    return {
        "computed": True, "heuristic": True, "projection_version": PROJECTION_VERSION, "unembedding": wu_key, "vocab_size": n_vocab, "hidden": hidden,
        "layers": layers, "k": k, "modules": results, "scale": scale, "r": r,
        "method": "u₁ of ΔW from the r×r core (thin QR); scores = W_U · (g ⊙ u₁); z relative to the vocabulary",
        "caveats": [
            "Ignores every layer after the module; most meaningful in the last layers.",
            "Singular directions have no inherent sign: +u₁ and −u₁ are both shown.",
            "Only the final norm's learned scale is applied; per-token normalisation is ignored.",
            "Shows which tokens a weight direction favours, not what the model does on a given input.",
        ],
    }
