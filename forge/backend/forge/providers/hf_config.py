"""Shared Hugging Face model-directory inspection (used by HF cache + local dirs)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from forge.providers.base import DiscoveredModel
from forge.providers.formats import count_safetensors_params, parameter_report, read_readme_license
from forge.registry.roles import classify_kind

CONTEXT_KEYS = ("max_position_embeddings", "n_positions", "max_sequence_length", "seq_length", "n_ctx")


def _text_cfg(cfg: dict) -> dict:
    # Multimodal configs nest the LM under text_config.
    return cfg.get("text_config") or cfg


def estimate_params_from_config(cfg: dict) -> int | None:
    t = _text_cfg(cfg)
    h, L, v = t.get("hidden_size"), t.get("num_hidden_layers"), t.get("vocab_size")
    if not (h and L and v):
        return None
    i = t.get("intermediate_size") or 4 * h
    heads, kv = t.get("num_attention_heads") or 1, t.get("num_key_value_heads") or t.get("num_attention_heads") or 1
    head_dim = t.get("head_dim") or h // heads
    attn = h * heads * head_dim + 2 * h * kv * head_dim + heads * head_dim * h
    mlp = 3 * h * i
    emb = v * h * (1 if t.get("tie_word_embeddings", cfg.get("tie_word_embeddings", False)) else 2)
    return int(L * (attn + mlp) + emb)


def inspect_hf_dir(model_dir: Path, provider: str, name: str, locator: str, extra: dict | None = None) -> DiscoveredModel | None:
    cfg_path = model_dir / "config.json"
    if not cfg_path.exists():
        return None
    try:
        cfg: dict[str, Any] = json.loads(cfg_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    t = _text_cfg(cfg)
    params, dtypes, complete = count_safetensors_params(model_dir)
    has_bin = any(model_dir.glob("pytorch_model*.bin"))
    fmt = "hf_safetensors" if params is not None else ("hf_pytorch_bin" if has_bin else "unknown")
    source = "exact_header" if params is not None and complete else "unknown"
    if params is None or not complete:
        est = estimate_params_from_config(cfg)
        if est and params is None:
            params, source = est, "config_estimate"
    qcfg = cfg.get("quantization_config") or {}
    quant = qcfg.get("quant_method")
    if quant and qcfg.get("bits"):
        quant = f"{quant}-{qcfg['bits']}bit"
    elif qcfg.get("load_in_4bit"):
        quant = "bitsandbytes-4bit"
    if not quant:
        quant = cfg.get("torch_dtype") or t.get("torch_dtype") or (max(dtypes, key=dtypes.get) if dtypes else None)
    ctx = next((t.get(k) for k in CONTEXT_KEYS if isinstance(t.get(k), int)), None)

    tok_cfg, chat_template = model_dir / "tokenizer_config.json", None
    if tok_cfg.exists():
        try:
            chat_template = json.loads(tok_cfg.read_text(encoding="utf-8")).get("chat_template")
        except (OSError, json.JSONDecodeError):
            pass
    if chat_template is None and (model_dir / "chat_template.jinja").exists():
        chat_template = (model_dir / "chat_template.jinja").read_text(encoding="utf-8", errors="replace")
    if isinstance(chat_template, list):  # list of named templates
        chat_template = " ".join(str(x.get("template", "")) for x in chat_template if isinstance(x, dict))

    tied = t.get("tie_word_embeddings", cfg.get("tie_word_embeddings"))
    report = parameter_report(model_dir, tied) if params is not None and complete else None
    st = (model_dir / "config_sentence_transformers.json").exists() or (model_dir / "modules.json").exists()
    kind, evidence = classify_kind(cfg.get("model_type"), cfg.get("architectures"), name, sentence_transformers=st)
    size = 0
    for p in model_dir.iterdir():
        try:
            if p.is_file():
                size += p.stat().st_size
        except OSError:
            pass
    return DiscoveredModel(
        provider=provider, locator=locator, name=name,
        architecture=(cfg.get("architectures") or [None])[0] or cfg.get("model_type"),
        parameter_count=params, parameter_count_source=source, quantization=quant, context_length=ctx,
        format=fmt, storage_path=str(model_dir), size_bytes=size, license=read_readme_license(model_dir),
        metadata={
            "model_type": cfg.get("model_type"),
            "architectures": cfg.get("architectures"),
            "hidden_size": t.get("hidden_size"), "num_hidden_layers": t.get("num_hidden_layers"),
            "intermediate_size": t.get("intermediate_size"), "vocab_size": t.get("vocab_size"),
            "num_attention_heads": t.get("num_attention_heads"), "num_key_value_heads": t.get("num_key_value_heads"),
            "head_dim": t.get("head_dim"), "tie_word_embeddings": tied,
            "parameter_report": report, "model_kind": kind, "model_kind_evidence": evidence,
            "requires_remote_code": bool(cfg.get("auto_map")),
            "weights_complete": complete if params is not None else has_bin,
            "has_chat_template": bool(chat_template),
            "template_mentions_tools": bool(chat_template and "tools" in chat_template),
            "pre_quantized": bool(qcfg),
            **(extra or {}),
        },
    )
