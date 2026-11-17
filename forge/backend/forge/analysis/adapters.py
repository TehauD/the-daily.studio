"""Adapter Inspector — measured weight changes of a LoRA adapter, without torch.

For each adapted module: ΔW = s · B · A with B ∈ R^{out×r}, A ∈ R^{r×in},
s = α/r (α/√r for rsLoRA).

Singular values are computed from an r×r core, never from the full out×in matrix:
  B = Q_b R_b,  Aᵀ = Q_a R_a  (thin QR)
  ΔW = s · Q_b (R_b R_aᵀ) Q_aᵀ  →  σ(ΔW) = σ(s · R_b R_aᵀ)
Then ‖ΔW‖_F = √Σσ², effective rank = exp(H(σ/Σσ)).
If the base checkpoint is available, ‖W‖_F of the matching base tensor gives the
relative change ‖ΔW‖_F / ‖W‖_F (read straight from safetensors by offset).

Only safetensors is read. Pickle (.bin) adapters are refused: loading pickle
executes arbitrary code.
"""
from __future__ import annotations

import json
import math
import re
import struct
from pathlib import Path
from typing import Any

import numpy as np

_DTYPES = {"F32": np.float32, "F16": np.float16, "F64": np.float64}


class AdapterError(ValueError):
    pass


class SafeTensorFile:
    """Minimal header + per-tensor reader (memory-mapped). Supports F32/F16/F64/BF16."""

    def __init__(self, path: Path):
        if path.suffix != ".safetensors":
            raise AdapterError(f"Refusing non-safetensors file {path.name} (pickle is never loaded)")
        self.path = path
        with open(path, "rb") as f:
            (n,) = struct.unpack("<Q", f.read(8))
            if n > 100 * 2 ** 20:
                raise AdapterError("safetensors header too large")
            self.header = json.loads(f.read(n))
        self.header.pop("__metadata__", None)
        self.base = 8 + n
        self._mm = np.memmap(path, dtype=np.uint8, mode="r")

    def keys(self) -> list[str]:
        return list(self.header)

    def get(self, name: str) -> np.ndarray:
        t = self.header[name]
        a, b = t["data_offsets"]
        raw = self._mm[self.base + a: self.base + b]
        if t["dtype"] == "BF16":
            u16 = np.frombuffer(raw.tobytes(), dtype=np.uint16).astype(np.uint32) << 16
            arr = u16.view(np.float32)
        elif t["dtype"] in _DTYPES:
            arr = np.frombuffer(raw.tobytes(), dtype=_DTYPES[t["dtype"]])
        else:
            raise AdapterError(f"Unsupported dtype {t['dtype']} for {name}")
        return arr.reshape(t["shape"]).astype(np.float64)


def lora_spectrum(A: np.ndarray, B: np.ndarray, scale: float) -> np.ndarray:
    """Singular values of scale·B·A via thin QR; never materializes B·A."""
    _, Rb = np.linalg.qr(B)        # B: out×r → Rb r×r
    _, Ra = np.linalg.qr(A.T)      # Aᵀ: in×r → Ra r×r
    return np.linalg.svd(scale * (Rb @ Ra.T), compute_uv=False)


def effective_rank(sigma: np.ndarray) -> float:
    s = np.asarray(sigma, dtype=float)
    s = s[s > 0]
    if s.size == 0:
        return 0.0
    p = s / s.sum()
    return float(math.exp(-(p * np.log(p)).sum()))


_KEY = re.compile(r"^(?:base_model\.model\.)?(?P<mod>.+)\.lora_(?P<ab>[AB])(?:\.(?P<adapter>[^.]+))?\.weight$")
_LAYER = re.compile(r"\.layers\.(\d+)\.")


def _base_index(base_dir: Path | None) -> dict[str, SafeTensorFile]:
    if not base_dir:
        return {}
    idx = base_dir / "model.safetensors.index.json"
    files: dict[str, SafeTensorFile] = {}
    if idx.exists():
        wm = json.loads(idx.read_text(encoding="utf-8"))["weight_map"]
        cache: dict[str, SafeTensorFile] = {}
        for k, shard in wm.items():
            cache.setdefault(shard, SafeTensorFile(base_dir / shard))
            files[k] = cache[shard]
    else:
        for p in base_dir.glob("*.safetensors"):
            st = SafeTensorFile(p)
            for k in st.keys():
                files[k] = st
    return files


def inspect_adapter(adapter_dir: Path, base_dir: Path | None = None) -> dict[str, Any]:
    if any(adapter_dir.glob("*.bin")) and not (adapter_dir / "adapter_model.safetensors").exists():
        raise AdapterError("Adapter is pickle-only (.bin); refusing to load. Re-save with safetensors.")
    st_path = adapter_dir / "adapter_model.safetensors"
    if not st_path.exists():
        raise AdapterError(f"No adapter_model.safetensors in {adapter_dir}")
    cfg = json.loads((adapter_dir / "adapter_config.json").read_text(encoding="utf-8"))
    r, alpha = int(cfg["r"]), float(cfg.get("lora_alpha", cfg["r"]))
    rs = bool(cfg.get("use_rslora"))
    scale = alpha / math.sqrt(r) if rs else alpha / r
    st = SafeTensorFile(st_path)
    pairs: dict[str, dict[str, str]] = {}
    for k in st.keys():
        m = _KEY.match(k)
        if m:
            pairs.setdefault(m.group("mod"), {})[m.group("ab")] = k
    base = _base_index(base_dir)
    modules = []
    for mod, ab in sorted(pairs.items()):
        if set(ab) != {"A", "B"}:
            continue
        A, B = st.get(ab["A"]), st.get(ab["B"])
        sig = lora_spectrum(A, B, scale)
        fro = float(np.sqrt((sig ** 2).sum()))
        base_key = f"{mod}.weight"
        w_norm = None
        if base_key in base:
            W = base[base_key].get(base_key)
            w_norm = float(np.linalg.norm(W))
        lm = _LAYER.search(mod)
        modules.append({
            "module": mod, "layer": int(lm.group(1)) if lm else None, "kind": mod.rsplit(".", 1)[-1],
            "shape": [int(B.shape[0]), int(A.shape[1])], "rank": int(A.shape[0]),
            "delta_fro": fro, "base_fro": w_norm, "relative_change": (fro / w_norm) if w_norm else None,
            "singular_values": sig.tolist(), "effective_rank": effective_rank(sig),
            "trainable_params": int(A.size + B.size),
        })
    if not modules:
        raise AdapterError("No lora_A/lora_B pairs found")
    by_layer: dict[int, float] = {}
    for m in modules:
        if m["layer"] is not None:
            by_layer[m["layer"]] = by_layer.get(m["layer"], 0.0) + m["delta_fro"] ** 2
    return {
        "computed": True, "adapter_dir": str(adapter_dir), "r": r, "alpha": alpha, "use_rslora": rs, "scale": scale,
        "target_modules": cfg.get("target_modules"), "modules": modules,
        "layer_delta_fro": {str(k): math.sqrt(v) for k, v in sorted(by_layer.items())},
        "total_trainable_params": sum(m["trainable_params"] for m in modules),
        "base_available": bool(base),
        "method": "σ from r×r core after thin QR of B and Aᵀ; full ΔW never materialized",
    }
