"""Model-kind classification and role eligibility.

Why a separate module: discovery must *inventory* everything it finds (an
encoder in the HF cache is still a file on disk the user may want to see), but
only generative chat models may become teachers or students. Eligibility is a
list of named checks, each with status pass / warn / fail and a reason, so the UI
can show *why* a model is or is not eligible instead of a bare boolean.
"""
from __future__ import annotations

import re
from typing import Any, Literal

ModelKind = Literal["generative", "encoder", "embedding", "vision", "speech", "seq2seq", "unknown"]

# model_type → kind for well-known non-generative families.
_ENCODER_TYPES = {"bert", "roberta", "xlm-roberta", "distilbert", "deberta", "deberta-v2", "electra", "albert",
                  "mpnet", "camembert", "modernbert", "nomic_bert", "nomic-bert", "jina_bert", "xlm"}
_VISION_TYPES = {"dinov2", "dino", "vit", "clip", "siglip", "siglip_vision_model", "convnext", "swin", "beit",
                 "deit", "dinov3", "sam", "detr", "yolos", "segformer"}
_SPEECH_TYPES = {"whisper", "wav2vec2", "hubert", "wavlm", "speecht5", "seamless_m4t", "encodec", "musicgen",
                 "data2vec-audio", "unispeech"}
_SEQ2SEQ_TYPES = {"t5", "mt5", "bart", "mbart", "pegasus", "marian", "flan-t5", "longt5", "umt5"}
# GGUF general.architecture values that are not chat LMs.
_GGUF_NON_GENERATIVE = {"bert": "encoder", "nomic-bert": "embedding", "nomic-bert-moe": "embedding",
                        "jina-bert-v2": "embedding", "t5encoder": "encoder", "clip": "vision", "whisper": "speech"}
_EMBED_NAME = re.compile(r"(^|[/_\-.])(embed|embedding|e5|bge|gte|minilm|sentence-transformers|nomic-embed)", re.I)

PERMISSIVE_LICENSES = {"apache-2.0", "mit", "bsd-3-clause", "bsd-2-clause", "openrail", "cc-by-4.0", "llama3",
                       "llama3.1", "llama3.2", "llama3.3", "gemma", "qwen", "openrail++", "bigscience-openrail-m",
                       "cc-by-sa-4.0", "unlicense", "mpl-2.0"}
RESTRICTIVE_MARKERS = ("-nc", "noncommercial", "non-commercial", "research-only", "no-derivatives", "-nd")
REASONING_FIRST = re.compile(r"(deepseek-r1|-r1-|\br1\b|qwq|reasoning|thinking)", re.I)


def classify_kind(model_type: str | None, architectures: list[str] | None, name: str = "",
                  gguf_arch: str | None = None, provider_type: str | None = None,
                  sentence_transformers: bool = False) -> tuple[ModelKind, str]:
    """Best-effort kind from config/header metadata. Returns (kind, evidence)."""
    mt = (model_type or "").lower()
    archs = architectures or []
    if provider_type == "embeddings":
        return "embedding", "Provider reports type 'embeddings'."
    if gguf_arch:
        ga = gguf_arch.lower()
        if ga in _GGUF_NON_GENERATIVE:
            return _GGUF_NON_GENERATIVE[ga], f"GGUF architecture '{gguf_arch}'."  # type: ignore[return-value]
        if _EMBED_NAME.search(name) and "embed" in name.lower():
            return "embedding", "Name indicates an embedding model."
        return "generative", f"GGUF architecture '{gguf_arch}' (decoder LM)."
    if sentence_transformers:
        return "embedding", "sentence-transformers configuration present."
    if mt in _SPEECH_TYPES or any(a.startswith(("Whisper", "Wav2Vec2", "Hubert")) for a in archs):
        return "speech", f"Speech model_type '{mt or archs}'."
    if mt in _VISION_TYPES:
        return "vision", f"Vision model_type '{mt}'."
    generative_head = any(a.endswith(("ForCausalLM", "ForConditionalGeneration")) for a in archs)
    encoder_head = any(a.endswith(("ForMaskedLM", "Model", "ForSequenceClassification", "ForTokenClassification"))
                       for a in archs)
    if mt in _ENCODER_TYPES or (encoder_head and not generative_head and mt not in _SEQ2SEQ_TYPES):
        return ("embedding" if _EMBED_NAME.search(name) else "encoder"), f"Encoder model_type '{mt}' / {archs}."
    if mt in _SEQ2SEQ_TYPES:
        return "seq2seq", f"Encoder-decoder model_type '{mt}' (not a chat LM)."
    if any(a.endswith("ForCausalLM") for a in archs):
        return "generative", f"{archs[0]} is a causal LM."
    if any(a.endswith("ForConditionalGeneration") for a in archs):
        return "generative", f"{archs[0]} (multimodal conditional generation)."
    if provider_type in ("llm", "vlm"):
        return "generative", f"Provider reports type '{provider_type}'."
    return "unknown", "No architecture information."


def license_check(license_: str | None) -> dict[str, str]:
    if not license_:
        return {"check": "license", "status": "warn", "reason": "License not declared; verify fine-tuning rights before use."}
    lic = license_.strip().lower()
    if any(m in lic for m in RESTRICTIVE_MARKERS):
        return {"check": "license", "status": "warn", "reason": f"'{license_}' restricts use (non-commercial / no-derivatives)."}
    if lic in PERMISSIVE_LICENSES or lic.startswith(("apache", "mit")):
        return {"check": "license", "status": "pass", "reason": f"'{license_}' permits fine-tuning."}
    return {"check": "license", "status": "warn", "reason": f"'{license_}' is a custom license; read its terms."}


def _c(check: str, status: str, reason: str) -> dict[str, str]:
    return {"check": check, "status": status, "reason": reason}


def eligibility(model: dict[str, Any]) -> dict[str, Any]:
    """Per-role eligibility for a registry row (dict with capabilities + metadata)."""
    caps, md = model["capabilities"], model.get("metadata") or {}
    kind = md.get("model_kind", "unknown")
    generative = kind == "generative"
    runnable = caps.get("inference", {}).get("status") == "supported"
    tools = caps.get("tool_calling", {}).get("status")

    gen_status = "pass" if generative else ("warn" if kind == "unknown" else "fail")
    teacher = [
        _c("generative", gen_status, md.get("model_kind_evidence") or f"kind={kind}"),
        _c("runnable", "pass" if runnable else "fail", caps.get("inference", {}).get("reason", "")),
        _c("tool_template", "pass" if tools == "supported" else "warn",
           "Chat template declares tools." if tools == "supported" else "No tool declaration; JSON action protocol still works."),
    ]
    if REASONING_FIRST.search(model.get("name", "")):
        teacher.append(_c("reasoning_first", "warn", "Name suggests a reasoning-first model; long hidden reasoning "
                          "inflates latency and is stripped before storage (heuristic)."))

    lora, qlora = caps.get("lora", {}).get("status"), caps.get("qlora", {}).get("status")
    student = [
        _c("generative", gen_status, md.get("model_kind_evidence") or f"kind={kind}"),
        _c("trainable_weights", "pass" if lora == "supported" else ("warn" if lora == "conditional" else "fail"),
           caps.get("lora", {}).get("reason", "")),
        _c("no_remote_code", "fail" if md.get("requires_remote_code") else "pass",
           "Requires trust_remote_code (refused)." if md.get("requires_remote_code") else "No remote code."),
        _c("tool_template", "pass" if tools == "supported" else "warn",
           "Chat template declares tools." if tools == "supported" else "Template lacks tools; FORGE uses a JSON action protocol."),
        license_check(model.get("license")),
    ]
    if qlora == "supported" and lora != "supported":
        student.append(_c("qlora_only", "warn", "Only QLoRA path is available (deferred post-MVP)."))

    def verdict(checks: list[dict]) -> str:
        return "fail" if any(c["status"] == "fail" for c in checks) else ("warn" if any(c["status"] == "warn" for c in checks) else "pass")

    return {"kind": kind, "teacher": {"verdict": verdict(teacher), "checks": teacher},
            "student": {"verdict": verdict(student), "checks": student}}
