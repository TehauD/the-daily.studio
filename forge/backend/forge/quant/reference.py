"""FORGE's reference quantizer — transparent, CPU-capable, exact per-layer error.

Scheme: symmetric integer quantization per group of `group` consecutive input weights of each linear layer:
    scale_g = max|w| / (2^(b−1) − 1),   q = clamp(round(w / scale_g), −(2^(b−1) − 1), 2^(b−1) − 1),   ŵ = q · scale_g
Calibrated variant ("activation-aware", after AWQ): input channels the model uses strongly are scaled up before rounding and
scaled back after, so their weights keep more precision. Per layer, the exponent α of s = a^α (a = mean |activation| per input
channel, measured on TRAINING-split prompts only) is chosen on a grid to minimise the output-weighted error ‖(W − Ŵ)·diag(a)‖_F.

Output is *simulated* quantization: the checkpoint stores ŵ (the exact values integer kernels would use) in bf16, so any runtime
evaluates the quantized model's behaviour; it is NOT smaller or faster on disk. Real size / speed come from the GGUF (llama.cpp)
and compressed-tensors (llm-compressor → vLLM) toolchains. Embeddings, the output head and norms are left in 16-bit, as common
weight-only schemes do.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
from pathlib import Path
from typing import Any, Callable

import numpy as np

SKIP = re.compile(r"(embed|lm_head|norm|\.bias$)")
LAYER = re.compile(r"\.layers\.(\d+)\.")


def quantize_matrix(W: np.ndarray, bits: int, group: int, col_scale: np.ndarray | None = None) -> np.ndarray:
    """Quantize-dequantize W (out × in) per group along the input dimension; optional per-input-channel pre-scale."""
    out, inn = W.shape
    X = W * col_scale[None, :] if col_scale is not None else W
    g = group if group > 0 and inn % group == 0 else inn
    qmax = 2 ** (bits - 1) - 1
    Xg = X.reshape(out, inn // g, g)
    scale = np.abs(Xg).max(axis=2, keepdims=True) / qmax
    scale[scale == 0] = 1.0
    Q = np.clip(np.round(Xg / scale), -qmax, qmax) * scale
    Q = Q.reshape(out, inn)
    return Q / col_scale[None, :] if col_scale is not None else Q


def _err(W: np.ndarray, Q: np.ndarray, act: np.ndarray | None = None) -> dict[str, float]:
    D = W - Q
    nw, nd = float(np.linalg.norm(W)), float(np.linalg.norm(D))
    out = {"rel_error": nd / nw if nw else 0.0, "sqnr_db": 20 * math.log10(nw / nd) if nd > 0 else 99.0, "max_abs": float(np.abs(D).max())}
    if act is not None:
        nwa, nda = float(np.linalg.norm(W * act[None, :])), float(np.linalg.norm(D * act[None, :]))
        out["rel_output_error"] = nda / nwa if nwa else 0.0
    return out


def awq_scale(W: np.ndarray, act: np.ndarray, bits: int, group: int, grid: int = 11) -> tuple[np.ndarray, float]:
    a = np.maximum(act, 1e-8)
    best, best_s, best_alpha = None, None, 0.0
    for alpha in np.linspace(0, 1, grid):
        s = a ** alpha
        s = s / math.sqrt(float(s.max() * s.min()))
        Q = quantize_matrix(W, bits, group, s)
        e = float(np.linalg.norm((W - Q) * a[None, :]))
        if best is None or e < best:
            best, best_s, best_alpha = e, s, float(alpha)
    return best_s, best_alpha


def activation_stats(model_dir: Path, texts: list[str], device: str = "cpu", max_len: int = 1024) -> dict[str, np.ndarray]:
    """Mean |input| per channel for every linear layer, over the calibration texts (forward hooks, no gradients)."""
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(model_dir, local_files_only=True)
    model = AutoModelForCausalLM.from_pretrained(model_dir, local_files_only=True, torch_dtype=torch.float32 if device == "cpu" else torch.bfloat16).to(device)
    model.eval()
    sums: dict[str, Any] = {}
    counts: dict[str, int] = {}
    hooks = []
    for name, mod in model.named_modules():
        if isinstance(mod, torch.nn.Linear) and not SKIP.search(name):
            def hook(m, inp, _out, name=name):
                x = inp[0].detach().float().reshape(-1, inp[0].shape[-1]).abs()
                sums[name] = sums.get(name, 0) + x.sum(0).cpu()
                counts[name] = counts.get(name, 0) + x.shape[0]
            hooks.append(mod.register_forward_hook(hook))
    with torch.no_grad():
        for t in texts:
            ids = tok(t, return_tensors="pt", truncation=True, max_length=max_len).to(device)
            model(**ids)
    for h in hooks:
        h.remove()
    return {k: (v / counts[k]).numpy() for k, v in sums.items()}


def calibration_texts(study: Any, n: int = 64) -> list[str]:
    """Calibration from the TRAINING split only (teacher-verified training records): practice and test never leak in."""
    p = study.root / "datasets"
    texts: list[str] = []
    for arm_dir in sorted(p.iterdir()) if p.is_dir() else []:
        f = arm_dir / "records.jsonl"
        if f.exists() and arm_dir.name != "shuffled_control":
            for line in f.read_text(encoding="utf-8").splitlines():
                r = json.loads(line)
                texts.append("\n".join(str(m.get("content", "")) for m in r["prompt_messages"][1:]) + "\n" + r["completion"])
            break
    return texts[:n]


def quantize_checkpoint(src: Path, out: Path, bits: int, group: int = 128, act: dict[str, np.ndarray] | None = None,
                        emit: Callable[[dict], None] = lambda e: None) -> dict[str, Any]:
    out.mkdir(parents=True, exist_ok=True)
    for f in src.iterdir():  # config, tokenizer, chat template … unchanged
        if f.is_file() and not f.name.endswith(".safetensors") and f.name != "forge_export.json":
            shutil.copy2(f, out / f.name)
    layers, q_params, other_params = [], 0, 0
    import torch
    from safetensors import safe_open
    from safetensors.torch import save_file as save_t
    for sf in sorted(src.glob("*.safetensors")):
        tensors: dict[str, Any] = {}
        with safe_open(str(sf), framework="pt") as fh:
            for k in fh.keys():
                T = fh.get_tensor(k)
                if T.ndim == 2 and not SKIP.search(k):
                    W = T.float().numpy()
                    a = act.get(k.removesuffix(".weight")) if act is not None else None  # module names match tensor names
                    s_, alpha = (awq_scale(W, a, bits, group) if a is not None else (None, None))
                    Q = quantize_matrix(W, bits, group, s_)
                    lm = LAYER.search("." + k)
                    layers.append({"module": k.removesuffix(".weight"), "layer": int(lm.group(1)) if lm else None, "kind": k.removesuffix(".weight").rsplit(".", 1)[-1],
                                   "shape": list(W.shape), "alpha": alpha, **_err(W, Q, a)})
                    q_params += W.size
                    tensors[k] = torch.from_numpy(Q).to(T.dtype)   # quantized values, stored in the source's own dtype
                    emit({"event": "quantized", "module": k, "rel_error": layers[-1]["rel_error"]})
                else:
                    other_params += T.numel()
                    tensors[k] = T                                   # untouched: bit-identical copy
        save_t(tensors, str(out / sf.name), metadata={"format": "pt"})
    eff_bits = bits + 16 / group if group > 0 else bits
    size = q_params * eff_bits / 8 + other_params * 2
    full = (q_params + other_params) * 2
    rel = [l["rel_error"] for l in layers]
    summary = {"bits": bits, "group": group, "calibrated": act is not None, "effective_bits": eff_bits, "quantized_params": q_params, "other_params": other_params,
               "estimated_bytes": int(size), "bf16_bytes": int(full), "compression": full / size if size else None,
               "mean_rel_error": float(np.mean(rel)) if rel else None, "max_rel_error": float(np.max(rel)) if rel else None,
               "mean_sqnr_db": float(np.mean([l["sqnr_db"] for l in layers])) if layers else None}
    return {"summary": summary, "layers": layers}


def file_hashes(d: Path) -> dict[str, str]:
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(d.iterdir()) if p.is_file()}
