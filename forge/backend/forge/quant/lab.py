"""Quantization Lab: make precise, smaller variants of a trained model and measure exactly what each one costs.

Modular by design — a *method* is a catalogue entry; a *toolchain* produces the files; *measurement* is always the same:
  methods     FORGE reference (simulated, in-process), GGUF via your llama.cpp (LM Studio), compressed-tensors via llm-compressor in
              its own environment (vLLM). New methods are new catalogue entries, not new measurement code.
  source      the study's verified merged export (made after SEAL and checked against the adapter on the test set).
  calibration training-split records only — practice (dev) and the final test never inform how a model is quantized.
  measurement every variant runs the study's own tasks through the study's own writer (arm `quant_<label>`), so Compare pairs it
              with the unquantized model task by task; choose on practice tasks, confirm once on the sealed test.
  record      a manifest per variant: method, settings, source hashes, calibration hash, tool versions, per-layer error.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Callable

from forge import __version__
from forge.engine import statistics as st
from forge.util import sha256_file, sha256_text, utcnow, write_json_atomic

METHODS: list[dict[str, Any]] = [
    {"id": "ref_w8", "label": "FORGE reference · 8-bit", "family": "reference", "runtime": "FORGE (simulated)", "bits": 8, "group": 128, "calibrated": False,
     "needs": [], "about": "Round-to-nearest, symmetric, per 128 weights. Almost lossless; the control for every other variant."},
    {"id": "ref_w4", "label": "FORGE reference · 4-bit", "family": "reference", "runtime": "FORGE (simulated)", "bits": 4, "group": 128, "calibrated": False,
     "needs": [], "about": "Round-to-nearest at 4 bits: the plain baseline that calibrated methods must beat."},
    {"id": "ref_w4_aware", "label": "FORGE reference · 4-bit, activation-aware", "family": "reference", "runtime": "FORGE (simulated)", "bits": 4, "group": 128, "calibrated": True,
     "needs": [], "about": "Protects input channels the model uses most (measured on training-split prompts), after AWQ. Shows what calibration buys."},
    {"id": "ref_w3_aware", "label": "FORGE reference · 3-bit, activation-aware", "family": "reference", "runtime": "FORGE (simulated)", "bits": 3, "group": 64, "calibrated": True,
     "needs": [], "about": "Aggressive: where does the skill start to break?"},
    {"id": "gguf_q8_0", "label": "GGUF Q8_0", "family": "gguf", "runtime": "LM Studio / llama.cpp", "bits": 8.5, "calibrated": False, "needs": ["llama.cpp"],
     "about": "Model Factory → GGUF. Near-lossless, half of bf16."},
    {"id": "gguf_q4_k_m_imatrix", "label": "GGUF Q4_K_M, importance matrix", "family": "gguf", "runtime": "LM Studio / llama.cpp", "bits": 4.8, "calibrated": True,
     "needs": ["llama.cpp (llama-quantize, llama-imatrix)"], "about": "The common LM Studio choice, calibrated on training-split prompts."},
    {"id": "gguf_iq4_xs_imatrix", "label": "GGUF IQ4_XS, importance matrix", "family": "gguf", "runtime": "LM Studio / llama.cpp", "bits": 4.25, "calibrated": True,
     "needs": ["llama.cpp (llama-quantize, llama-imatrix)"], "about": "Smaller 4-bit with non-uniform levels; needs calibration."},
    {"id": "vllm_fp8_dynamic", "label": "vLLM FP8 (dynamic)", "family": "compressed-tensors", "runtime": "vLLM", "bits": 8, "calibrated": False,
     "needs": ["llm-compressor environment", "GPU with FP8 support to serve"], "about": "8-bit floating point weights and activations; no calibration data."},
    {"id": "vllm_w8a8_int8", "label": "vLLM W8A8 INT8 (SmoothQuant + GPTQ)", "family": "compressed-tensors", "runtime": "vLLM", "bits": 8, "calibrated": True,
     "needs": ["llm-compressor environment", "GPU"], "about": "8-bit integer weights and activations, calibrated on training-split prompts."},
    {"id": "vllm_w4a16_gptq", "label": "vLLM W4A16 (GPTQ)", "family": "compressed-tensors", "runtime": "vLLM", "bits": 4, "calibrated": True,
     "needs": ["llm-compressor environment", "GPU"], "about": "4-bit weights, 16-bit activations; GPTQ error-compensated rounding."},
    {"id": "vllm_w4a16_awq", "label": "vLLM W4A16 (AWQ)", "family": "compressed-tensors", "runtime": "vLLM", "bits": 4, "calibrated": True,
     "needs": ["llm-compressor environment", "GPU"], "about": "4-bit weights with activation-aware scaling."},
]
LLMC_RECIPES = {  # llm-compressor modifiers per method (written for llm-compressor's oneshot API; FORGE records the installed version)
    "vllm_fp8_dynamic": [{"QuantizationModifier": {"targets": "Linear", "scheme": "FP8_DYNAMIC", "ignore": ["lm_head"]}}],
    "vllm_w8a8_int8": [{"SmoothQuantModifier": {"smoothing_strength": 0.8}}, {"GPTQModifier": {"targets": "Linear", "scheme": "W8A8", "ignore": ["lm_head"]}}],
    "vllm_w4a16_gptq": [{"GPTQModifier": {"targets": "Linear", "scheme": "W4A16", "ignore": ["lm_head"]}}],
    "vllm_w4a16_awq": [{"AWQModifier": {"targets": ["Linear"], "scheme": "W4A16_ASYM", "ignore": ["lm_head"]}}],
}
HONESTY = ("Speed is measured while answering the tasks on this machine; for FORGE reference variants it is the speed of the "
           "16-bit simulation, not of a real low-bit kernel. Every variant ran the same tasks with the same tools and scoring. FORGE reference variants are simulated (exact quantized "
           "values, stored in 16-bit): they measure behaviour, not size or speed — sizes shown for them are estimates. GGUF and vLLM "
           "variants are measured as served. Choose on practice tasks; confirm the chosen one on the sealed test.")


class QuantError(ValueError):
    pass


def method(mid: str) -> dict[str, Any]:
    m = next((x for x in METHODS if x["id"] == mid), None)
    if not m:
        raise QuantError(f"Unknown method {mid}")
    return m


def slug(label: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", (label or "").lower()).strip("_")[:30]
    if not s:
        raise QuantError("Give the variant a label")
    return s


def source_dir(study: Any) -> Path:
    arm, seed = study.plan["arms"][0], study.plan["seeds"][0]
    src = study.root / "exports" / f"{arm}-seed{seed}-merged"
    if not (src / "forge_export.json").exists():
        raise QuantError("Run the Export stage first: variants are made from the verified merged export")
    return src


def _vdir(study: Any, s: str) -> Path:
    return study.root / "quant" / s


def _check_split(study: Any, split: str) -> None:
    if split not in ("dev", "test"):
        raise QuantError("Split must be dev or test")
    if split == "test" and not study.state.get("sealed"):
        raise QuantError("The sealed test can be used only after SEAL")


def make_reference(study: Any, cfg: dict[str, Any], emit: Callable[[dict], None] = lambda e: None) -> dict[str, Any]:
    """Quantize the merged export with FORGE's reference quantizer, then evaluate on cfg['split'] (default dev)."""
    from forge.quant.reference import activation_stats, calibration_texts, file_hashes, quantize_checkpoint
    m = method(cfg["method"])
    if m["family"] != "reference":
        raise QuantError("Only FORGE reference methods run inside FORGE; use the recipe for GGUF / vLLM methods")
    split = cfg.get("split", "dev")
    _check_split(study, split)
    src = source_dir(study)
    s = slug(cfg.get("label") or m["id"])
    vd = _vdir(study, s)
    if (vd / "manifest.json").exists():
        raise QuantError(f"Variant '{s}' exists; variants are immutable — give a new label")
    act, calib = None, None
    if m["calibrated"]:
        texts = calibration_texts(study, int(cfg.get("calibration_samples", 64)))
        if not texts:
            raise QuantError("No training records to calibrate with (run Build)")
        calib = {"samples": len(texts), "sha256": sha256_text("\n␞\n".join(texts)), "source": "training split (teacher-verified records)"}
        emit({"event": "calibrating", "samples": len(texts)})
        act = activation_stats(src, texts, device=study.plan["device"] if study.plan["device"] == "cuda" else "cpu")
    res = quantize_checkpoint(src, vd / "model", int(m["bits"]), int(cfg.get("group", m.get("group", 128))), act, emit)
    man = {"label": s, "method": m, "family": "reference", "runtime": m["runtime"], "created_at": utcnow(), "forge_version": __version__,
           "source": {"path": str(src), "files": json.loads((src / "forge_export.json").read_text(encoding="utf-8")).get("files")},
           "calibration": calib, "summary": res["summary"], "layers": res["layers"], "files": file_hashes(vd / "model"),
           "arm": f"quant_{s}", "simulated": True}
    write_json_atomic(vd / "manifest.json", json.dumps(man, indent=2))
    evaluate(study, s, split, emit)
    return man


def evaluate(study: Any, s: str, split: str, emit: Callable[[dict], None] = lambda e: None, backend: Any = None) -> None:
    from forge.engine.runtime import OpenAICompatBackend, TransformersBackend
    from forge.engine.study import StudyLock
    _check_split(study, split)
    man = json.loads((_vdir(study, s) / "manifest.json").read_text(encoding="utf-8"))
    if backend is None:
        if man.get("served"):
            backend = OpenAICompatBackend(man["served"]["endpoint"], man["served"]["model"])
        else:
            backend = TransformersBackend(str(_vdir(study, s) / "model"), None, device=study.plan["device"], max_new_tokens=study.plan["eval"]["max_new_tokens"])
    with StudyLock(study.root / ".lock"):
        study._evaluate(backend, man["arm"], split, 0, study.tasks(), emit)
    getattr(backend, "unload", lambda: None)()
    man.setdefault("evaluated", {})[split] = utcnow()
    write_json_atomic(_vdir(study, s) / "manifest.json", json.dumps(man, indent=2))


def register_served(study: Any, cfg: dict[str, Any], emit: Callable[[dict], None] = lambda e: None, backend: Any = None) -> dict[str, Any]:
    """A variant made elsewhere (GGUF in LM Studio, compressed-tensors in vLLM), measured through its OpenAI-compatible endpoint."""
    m = method(cfg["method"])
    s = slug(cfg["label"])
    vd = _vdir(study, s)
    if (vd / "manifest.json").exists():
        raise QuantError(f"Variant '{s}' exists — give a new label")
    vd.mkdir(parents=True, exist_ok=True)
    man = {"label": s, "method": m, "family": m["family"], "runtime": m["runtime"], "created_at": utcnow(), "forge_version": __version__,
           "served": {"endpoint": cfg["endpoint"], "model": cfg["model"]}, "size_bytes": cfg.get("size_bytes"), "notes": cfg.get("notes", "")[:500],
           "arm": f"quant_{s}", "simulated": False}
    write_json_atomic(vd / "manifest.json", json.dumps(man, indent=2))
    evaluate(study, s, cfg.get("split", "dev"), emit, backend)
    return man


def recipe(study: Any, mid: str) -> dict[str, Any]:
    """Everything needed to make a GGUF / vLLM variant outside FORGE: calibration file (training split), commands, recipe."""
    from forge.quant.reference import calibration_texts
    m = method(mid)
    src = source_dir(study)
    rd = study.root / "quant" / "recipes"
    rd.mkdir(parents=True, exist_ok=True)
    texts = calibration_texts(study, 256)
    calib = rd / "calibration.jsonl"
    calib.write_text("".join(json.dumps({"text": t}) + "\n" for t in texts), encoding="utf-8")
    name = slug(study.plan["name"])
    out = {"method": m, "source": str(src), "calibration": {"file": str(calib), "samples": len(texts), "sha256": sha256_file(calib),
                                                             "source": "training split (teacher-verified records)"}}
    if m["family"] == "gguf":
        q = {"gguf_q8_0": None, "gguf_q4_k_m_imatrix": "Q4_K_M", "gguf_iq4_xs_imatrix": "IQ4_XS"}[mid]
        out["steps"] = ["Model Factory → GGUF for LM Studio: choose " + (f"{q} with 'Calibrate (importance matrix)'" if q else "q8_0") + " — FORGE runs llama.cpp for you.",
                        "Load the file in LM Studio, then come back and 'Measure a served model' with the LM Studio endpoint and model id."]
    elif m["family"] == "compressed-tensors":
        spec = {"source": str(src), "output": str(study.root / "quant" / f"{name}_{mid}"), "recipe": LLMC_RECIPES[mid], "calibration": str(calib),
                "num_calibration_samples": min(256, len(texts)), "max_seq_length": 2048}
        sp = rd / f"{mid}.json"
        write_json_atomic(sp, json.dumps(spec, indent=2))
        out |= {"spec": str(sp), "steps": [
            "One-time: make a separate environment for llm-compressor (it needs a newer transformers than FORGE pins):  python -m venv %USERPROFILE%\\forge-llmc  then  %USERPROFILE%\\forge-llmc\\Scripts\\pip install llmcompressor",
            f"Quantize (GPU):  %USERPROFILE%\\forge-llmc\\Scripts\\python scripts\\quant_llmc.py \"{sp}\"",
            f"Serve:  vllm serve \"{spec['output']}\" --port 8000   (vLLM runs on Linux/WSL2 with an NVIDIA GPU)",
            "Measure: Quantization Lab → 'Measure a served model' with endpoint http://127.0.0.1:8000/v1 and the model path as id."]}
    else:
        out["steps"] = ["Runs inside FORGE: Quantization Lab → Make variant."]
    return out


def _rate(eps: list[dict]) -> dict[str, Any]:
    k, n = sum(1 for e in eps if e["score"]["strict_success"]), len(eps)
    return {"rate": k / n if n else None, "ci": list(st.wilson(k, n)) if n else None, "n": n, "speed": _speed(eps)}


def _speed(eps: list[dict]) -> dict[str, Any] | None:
    """Generation speed as measured while answering the tasks (completion tokens per second of model time, per-episode latency)."""
    rows = [(e.get("usage") or {}) for e in eps]
    tok = sum(r.get("completion_tokens") or 0 for r in rows)
    ms = sum(r.get("latency_ms") or 0 for r in rows)
    lat = sorted(r.get("latency_ms") or 0 for r in rows if r.get("latency_ms"))
    if not tok or not ms:
        return None
    return {"tokens_per_s": tok / (ms / 1000), "median_episode_ms": lat[len(lat) // 2] if lat else None, "completion_tokens": tok}


def lab(study: Any) -> dict[str, Any]:
    from forge.engine.study import read_jsonl
    arm, seed = study.plan["arms"][0], study.plan["seeds"][0]
    try:
        src = source_dir(study)
        bf16 = sum(p.stat().st_size for p in src.glob("*.safetensors"))
    except QuantError:
        src, bf16 = None, None
    ref: dict[str, Any] = {}
    for split in ("dev", "test"):
        p = study.episode_path(arm, split, seed)
        if p.exists():
            eps = read_jsonl(p)
            ref[split] = {**_rate(eps), "by_task": {e["task_id"]: bool(e["score"]["strict_success"]) for e in eps}}
    variants = []
    qd = study.root / "quant"
    for d in sorted(qd.iterdir()) if qd.is_dir() else []:
        mp = d / "manifest.json"
        if not mp.exists():
            continue
        man = json.loads(mp.read_text(encoding="utf-8"))
        res = {}
        for split in ("dev", "test"):
            p = study.episode_path(man["arm"], split, 0)
            if p.exists():
                eps = read_jsonl(p)
                r = _rate(eps)
                rb = ref.get(split, {}).get("by_task", {})
                paired = [(bool(e["score"]["strict_success"]), rb[e["task_id"]]) for e in eps if e["task_id"] in rb]
                b = sum(1 for q, u in paired if q and not u)
                c = sum(1 for q, u in paired if u and not q)
                res[split] = {**r, "agreement": (sum(1 for q, u in paired if q == u) / len(paired)) if paired else None,
                              "only_quant_right": b, "only_unquantized_right": c, "mcnemar_p": st.mcnemar_exact(b, c)["p"] if paired else None}
        summ = man.get("summary") or {}
        variants.append({"label": man["label"], "method": man["method"]["id"], "method_label": man["method"]["label"], "family": man["family"],
                         "runtime": man["runtime"], "simulated": man.get("simulated", False), "created_at": man["created_at"],
                         "size_bytes": man.get("size_bytes") or summ.get("estimated_bytes"), "effective_bits": summ.get("effective_bits") or man["method"].get("bits"),
                         "calibration": man.get("calibration"), "summary": summ, "results": res, "ref": f"arm:{study.plan['study_id']}:{man['arm']}"})
    anchors: dict[str, Any] = {}
    ctl = study.plan["eval"]["control_seed_broadcast"]
    for name, a in (("untrained", "base"), ("teacher", "teacher")):
        for split in ("dev", "test"):
            p = study.episode_path(a, split, ctl)
            if p.exists():
                anchors.setdefault(name, {})[split] = {k: v for k, v in _rate(read_jsonl(p)).items() if k != "speed"}
    return {"source": str(src) if src else None, "bf16_bytes": bf16, "sealed": bool(study.state.get("sealed")), "anchors": anchors,
            "unquantized": {sp: {k: v for k, v in r.items() if k != "by_task"} for sp, r in ref.items()}, "unquantized_ref": f"arm:{study.plan['study_id']}:{arm}",
            "variants": variants, "methods": METHODS, "honesty": HONESTY}


def layers(study: Any, s: str) -> dict[str, Any]:
    from forge.analysis.lineage import layer_types
    man = json.loads((_vdir(study, s) / "manifest.json").read_text(encoding="utf-8"))
    lt = layer_types(study.plan["student"].get("path"))
    return {"label": s, "layers": man.get("layers") or [], "layer_types": lt, "summary": man.get("summary")}
