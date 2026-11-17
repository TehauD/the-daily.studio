"""Capability matrix.

Each capability is a (status, reason) pair. Status is one of:
  supported | conditional | unsupported | unknown
Rules are explicit and conservative: a model that *loads* for inference is
never assumed trainable. Training requires local, complete, unquantized (or
bitsandbytes-requantizable) Hugging Face weights.
"""
from __future__ import annotations

import importlib.util
from functools import lru_cache
from typing import Any

from forge.providers.base import DiscoveredModel

CAPABILITIES = ("inference", "lora", "qlora", "logits", "tool_calling", "gguf_export", "ollama_deploy")


def cap(status: str, reason: str) -> dict[str, str]:
    return {"status": status, "reason": reason}


@lru_cache(maxsize=1)
def _transformers_causal_lm_types() -> frozenset[str] | None:
    """model_types the *installed* transformers can load as causal LMs; None if transformers absent."""
    if importlib.util.find_spec("transformers") is None:
        return None
    try:
        from transformers.models.auto.modeling_auto import MODEL_FOR_CAUSAL_LM_MAPPING_NAMES  # lightweight, no torch init
        return frozenset(MODEL_FOR_CAUSAL_LM_MAPPING_NAMES.keys())
    except Exception:
        return None


def _hf_caps(m: DiscoveredModel, hw: dict[str, Any]) -> dict[str, dict]:
    md = m.metadata
    archs = md.get("architectures") or []
    causal = any(a.endswith("ForCausalLM") for a in archs)
    cond_gen = any(a.endswith("ForConditionalGeneration") for a in archs)
    remote = md.get("requires_remote_code")
    complete = md.get("weights_complete", False) and not md.get("download_incomplete")
    pre_q = md.get("pre_quantized")
    known = _transformers_causal_lm_types()
    mt = md.get("model_type")

    if not complete:
        inference = cap("unsupported", "Weights incomplete or missing shards.")
    elif remote:
        inference = cap("conditional", "Requires trust_remote_code (disabled by default; review code first).")
    elif known is None:
        inference = cap("conditional", "Install transformers to verify architecture support.")
    elif mt in known:
        inference = cap("supported", f"transformers supports model_type '{mt}'.")
    elif cond_gen:
        inference = cap("conditional", "Multimodal ConditionalGeneration architecture; text-only use needs validation.")
    else:
        inference = cap("unsupported", f"Installed transformers has no causal-LM mapping for '{mt}'.")

    if inference["status"] == "unsupported":
        lora = cap("unsupported", "Not loadable for training.")
    elif not (causal or cond_gen):
        lora = cap("unsupported", f"Architecture {archs} is not a generative LM.")
    elif pre_q and m.quantization and not m.quantization.startswith("bitsandbytes"):
        lora = cap("conditional", f"Pre-quantized ({m.quantization}); PEFT support depends on kernel availability.")
    elif inference["status"] == "supported" and causal:
        lora = cap("supported", "Local complete HF weights with a supported causal-LM architecture.")
    else:
        lora = cap("conditional", inference["reason"])

    cuda = hw.get("cuda_available")
    bnb = hw.get("bitsandbytes")
    if lora["status"] == "unsupported":
        qlora = cap("unsupported", lora["reason"])
    elif pre_q:
        qlora = cap("unsupported", "Already quantized; QLoRA requantizes full-precision weights.")
    elif not cuda:
        qlora = cap("unsupported", "QLoRA requires a CUDA GPU visible to PyTorch.")
    elif not bnb:
        qlora = cap("conditional", "Install bitsandbytes to enable 4-bit NF4 training.")
    else:
        qlora = cap(lora["status"], "CUDA + bitsandbytes available.")

    return {
        "inference": inference,
        "lora": lora,
        "qlora": qlora,
        "logits": cap("supported", "Full-vocabulary logits via local forward pass.") if inference["status"] == "supported"
        else cap("unknown", "Depends on loadability."),
        "tool_calling": cap("supported", "Chat template declares tools.") if md.get("template_mentions_tools")
        else cap("unknown", "Chat template does not declare tools; may still follow tool prompts."),
        "gguf_export": cap("conditional", "Via llama.cpp convert_hf_to_gguf.py if architecture is supported there.")
        if causal else cap("unsupported", "Non-causal architecture."),
        "ollama_deploy": cap("conditional", "After GGUF export (or Ollama safetensors import for supported archs)."),
    }


def _non_generative_caps(kind: str, evidence: str) -> dict[str, dict]:
    why = f"{kind.capitalize()} model ({evidence}) — not a generative chat model; inventoried only."
    return {c: cap("unsupported", why) for c in CAPABILITIES}


def compute_capabilities(m: DiscoveredModel, hw: dict[str, Any]) -> dict[str, dict]:
    kind = m.metadata.get("model_kind")
    if kind in ("encoder", "embedding", "vision", "speech", "seq2seq"):
        return _non_generative_caps(kind, m.metadata.get("model_kind_evidence", ""))
    if m.format in ("hf_safetensors", "hf_pytorch_bin"):
        return _hf_caps(m, hw)

    not_trainable = "Quantized inference format; fine-tuning requires the original Hugging Face weights."
    md = m.metadata
    if m.format == "gguf":
        read_ok = "read_error" not in md and not md.get("file_not_located")
        tools = md.get("template_mentions_tools") or "tool_use" in (md.get("lmstudio_capabilities") or [])
        return {
            "inference": cap("supported" if read_ok else "unknown", "llama.cpp-compatible GGUF (LM Studio / llama.cpp / Ollama import)."),
            "lora": cap("unsupported", not_trainable), "qlora": cap("unsupported", not_trainable),
            "logits": cap("conditional", "llama.cpp server exposes top-n token probabilities, not full logits."),
            "tool_calling": cap("supported", "Embedded chat template declares tools.") if tools else cap("unknown", "No tool declaration found."),
            "gguf_export": cap("supported", "Already GGUF."),
            "ollama_deploy": cap("supported", "Importable with an Ollama Modelfile (FROM <path>.gguf)."),
        }
    if m.format == "ollama":
        caps = md.get("ollama_capabilities")
        if caps is not None:
            tools = cap("supported", "Ollama reports 'tools' capability.") if "tools" in caps else cap("unsupported", "Ollama does not report 'tools'.")
        else:
            tools = cap("supported", "Template references .Tools.") if md.get("template_mentions_tools") else cap("unknown", "Older Ollama; no capability report.")
        return {
            "inference": cap("supported", "Served by Ollama."),
            "lora": cap("unsupported", not_trainable), "qlora": cap("unsupported", not_trainable),
            "logits": cap("unknown", "Full logits are not exposed by Ollama; token logprob support is version-dependent."),
            "tool_calling": tools,
            "gguf_export": cap("unsupported", "Blob store is internal to Ollama."),
            "ollama_deploy": cap("supported", "Already deployed."),
        }
    if m.format == "mlx":
        return {c: cap("unsupported", "MLX models target Apple Silicon.") for c in CAPABILITIES}
    # remote_api / unknown
    return {
        "inference": cap("supported", "OpenAI-compatible endpoint listed this model.") if m.format == "remote_api" else cap("unknown", "Unrecognized format."),
        "lora": cap("unsupported", "No local weights."), "qlora": cap("unsupported", "No local weights."),
        "logits": cap("conditional", "Only if the server honors the `logprobs` parameter."),
        "tool_calling": cap("unknown", "Probe with a tool-call request (Phase 2)."),
        "gguf_export": cap("unsupported", "No local weights."), "ollama_deploy": cap("unsupported", "No local weights."),
    }
