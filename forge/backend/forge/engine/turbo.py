"""FORGE Turbo: switchable training optimizations, each one checked, recorded in the study plan, and measurable.

Every switch changes HOW training runs (speed, memory), not WHAT it learns from: same data, same LoRA rank, same seed,
same learning-rate schedule. Whether that holds in practice is measured, not assumed — clone a study with different
switches ("same study, other engine") and compare tokens/s, peak memory, energy, the loss curve and task success.

    attention       sdpa (PyTorch fused attention, default) · flash_attention_2 (needs flash-attn, CUDA) · eager (reference)
    packing         padding-free batches: several examples per row with position ids reset at each boundary, so they can't
                    see each other (needs flash_attention_2; only correct with it). Worth it with micro-batch > 1.
    liger           Liger Kernel fused Triton kernels (fused linear + cross-entropy that never materialises the full
                    vocabulary logits, RMSNorm, RoPE, SwiGLU) — less memory, often faster (needs liger-kernel, CUDA)
    quant_4bit      QLoRA: the frozen base is loaded in 4-bit NF4 with bf16 compute; LoRA adapters stay 16-bit (needs
                    bitsandbytes, CUDA). Lets a 16 GB card train larger students. Evaluation uses the bf16 base + adapter.
    optim_8bit      paged 8-bit AdamW states (needs bitsandbytes, CUDA) — smaller optimizer memory
    checkpointing   on (recompute activations, default) · off (fastest, most memory) · offload (keep activations in
                    CPU memory instead of recomputing — trades PCIe traffic for compute)
    compile         torch.compile the model (CUDA; first steps are slow while it compiles; Windows support varies)
"""
from __future__ import annotations

import importlib.util
from typing import Any

DEFAULTS: dict[str, Any] = {"attention": "sdpa", "packing": False, "liger": False, "quant_4bit": False, "optim_8bit": False,
                            "checkpointing": "on", "compile": False}
CHOICES = {"attention": ("sdpa", "flash_attention_2", "eager"), "checkpointing": ("on", "off", "offload")}
LABELS = {"attention": "Attention kernel", "packing": "Padding-free packing", "liger": "Liger fused kernels", "quant_4bit": "4-bit base (QLoRA)",
          "optim_8bit": "8-bit optimizer", "checkpointing": "Activation memory", "compile": "torch.compile"}
LIGER_ARCH = {"qwen3": "apply_liger_kernel_to_qwen3", "qwen2": "apply_liger_kernel_to_qwen2", "llama": "apply_liger_kernel_to_llama",
              "mistral": "apply_liger_kernel_to_mistral", "gemma": "apply_liger_kernel_to_gemma", "gemma2": "apply_liger_kernel_to_gemma2",
              "phi3": "apply_liger_kernel_to_phi3", "granite": "apply_liger_kernel_to_granite"}


class TurboError(ValueError):
    pass


def _has(mod: str) -> bool:
    try:
        return importlib.util.find_spec(mod) is not None
    except (ImportError, ValueError):
        return False


def probe(cuda: bool | None = None, torch_version: str | None = None) -> dict[str, Any]:
    """Which switches this machine can honour, and why not. The API process passes `cuda` from its out-of-process probe
    (it never imports torch); the engine process imports torch itself."""
    tv = torch_version
    if cuda is None:
        try:
            import torch
            cuda, tv = bool(torch.cuda.is_available()), torch.__version__
        except Exception:
            cuda = False
    avail = {"flash_attn": _has("flash_attn"), "liger_kernel": _has("liger_kernel"), "bitsandbytes": _has("bitsandbytes"), "triton": _has("triton")}
    need = {"attention:flash_attention_2": (cuda and avail["flash_attn"], "needs an NVIDIA GPU and the flash-attn package"),
            "packing": (cuda and avail["flash_attn"], "needs flash_attention_2 (packing is only correct with it)"),
            "liger": (cuda and avail["liger_kernel"], "needs an NVIDIA GPU and the liger-kernel package"),
            "quant_4bit": (cuda and avail["bitsandbytes"], "needs an NVIDIA GPU and the bitsandbytes package"),
            "optim_8bit": (cuda and avail["bitsandbytes"], "needs an NVIDIA GPU and the bitsandbytes package"),
            "compile": (cuda, "needs an NVIDIA GPU")}
    return {"cuda": cuda, "torch": tv, "packages": avail,
            "switches": {k: {"available": bool(ok), "why_not": None if ok else why} for k, (ok, why) in need.items()},
            "install_hint": "In FORGE's venv: pip install liger-kernel bitsandbytes (and flash-attn where a wheel exists for your setup)."}


def validate(turbo: dict | None, device: str, micro_batch: int = 1, check_available: bool = True, availability: dict | None = None) -> dict[str, Any]:
    t = dict(DEFAULTS)
    for k, v in (turbo or {}).items():
        if k not in DEFAULTS:
            raise TurboError(f"Unknown Turbo switch '{k}'")
        if k in CHOICES:
            if v not in CHOICES[k]:
                raise TurboError(f"{LABELS[k]} must be one of {', '.join(CHOICES[k])}")
        elif not isinstance(v, bool):
            raise TurboError(f"{LABELS[k]} must be true or false")
        t[k] = v
    if t["packing"] and t["attention"] != "flash_attention_2":
        raise TurboError("Packing needs the flash_attention_2 attention kernel (with other kernels packed examples would see each other)")
    if t["quant_4bit"] and t["checkpointing"] == "offload":
        raise TurboError("Activation offload is not combined with 4-bit loading; use checkpointing 'on' with QLoRA")
    gpu_only = [k for k in ("liger", "quant_4bit", "optim_8bit", "compile", "packing") if t[k]] + (["attention"] if t["attention"] == "flash_attention_2" else [])
    if device != "cuda" and gpu_only:
        raise TurboError(f"{', '.join(LABELS[k] for k in gpu_only)} need{'s' if len(gpu_only) == 1 else ''} the GPU (this study runs on {device})")
    if check_available:
        sw = (availability or probe())["switches"]
        missing = [(k, sw[key]["why_not"]) for k, key in (("attention", "attention:flash_attention_2"), ("packing", "packing"), ("liger", "liger"),
                                                           ("quant_4bit", "quant_4bit"), ("optim_8bit", "optim_8bit"), ("compile", "compile"))
                   if (t[k] if k != "attention" else t[k] == "flash_attention_2") and not sw[key]["available"]]
        if missing:
            raise TurboError("; ".join(f"{LABELS[k]}: {why}" for k, why in missing))
    if t["packing"] and micro_batch < 2:
        t["note"] = "Packing has no effect with micro-batch 1 — raise the micro-batch (and lower gradient accumulation) to use it."
    return t


def describe(t: dict) -> str:
    on = [LABELS[k] + (f" ({t[k]})" if k in CHOICES and t[k] != DEFAULTS[k] else "") for k in DEFAULTS if t.get(k) != DEFAULTS[k]]
    return "standard" if not on else " + ".join(on)


def model_kwargs(t: dict, dtype: Any) -> dict[str, Any]:
    kw: dict[str, Any] = {"attn_implementation": t["attention"]}
    if t["quant_4bit"]:
        from transformers import BitsAndBytesConfig
        import torch
        kw["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16,
                                                       bnb_4bit_use_double_quant=True)
        kw["device_map"] = {"": 0}
    else:
        kw["torch_dtype"] = dtype
    return kw


def apply_liger(model_type: str) -> str:
    fn = LIGER_ARCH.get(model_type)
    if not fn:
        raise TurboError(f"Liger kernels are not wired for model type '{model_type}' (supported: {', '.join(sorted(LIGER_ARCH))})")
    import liger_kernel.transformers as lk
    getattr(lk, fn)(rope=True, rms_norm=True, swiglu=True, cross_entropy=False, fused_linear_cross_entropy=True)
    return fn
