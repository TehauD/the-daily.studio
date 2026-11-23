"""Efficiency: what each model costs to run and to train, from what was actually recorded.

Per model and split (from evaluation episodes): episodes, median / 90th-percentile time per task, model calls per task,
prompt and generated tokens per task, generated tokens per second, tasks per minute, and generated tokens per strict success.
Per trained run (from run.json): wall time, peak training VRAM, GPU energy, adapter size. Sizes on disk for the student
weights and every export.

Measured on this machine under whatever else was running. Teacher numbers include LM Studio's server and its own
settings; they describe this setup, not the models in general, and a faster student is not evidence that distillation
*caused* the speed-up (the student is simply smaller).
"""
from __future__ import annotations

import json
import statistics
from pathlib import Path
from typing import Any


def _q(xs: list[float], q: float) -> float | None:
    if not xs:
        return None
    s = sorted(xs)
    return s[min(len(s) - 1, int(round(q * (len(s) - 1))))]


def _size(p: Path) -> int | None:
    if p.is_file():
        return p.stat().st_size
    if p.is_dir():
        return sum(f.stat().st_size for f in p.rglob("*") if f.is_file())
    return None


def efficiency(study: Any) -> dict[str, Any]:
    rows = []
    for arm, split, seed, _ in study.iter_episode_files():
        if split == "train" or (split in ("test", "ood", "regression") and not study.state["sealed"]):
            continue
        eps = study.episodes(arm, split, seed)
        if not eps:
            continue
        lat = [e["usage"]["latency_ms"] / 1000 for e in eps]
        comp = [e["usage"]["completion_tokens"] for e in eps]
        prompt = [e["usage"]["prompt_tokens"] for e in eps]
        calls = [len(e.get("calls", [])) + 1 for e in eps]
        ok = sum(1 for e in eps if e["score"]["strict_success"])
        total_s = sum(lat)
        rows.append({"arm": arm, "split": split, "seed": seed, "episodes": len(eps), "success": ok / len(eps),
                     "median_s": _q(lat, 0.5), "p90_s": _q(lat, 0.9), "calls_per_task": statistics.mean(calls),
                     "prompt_tokens": statistics.mean(prompt), "generated_tokens": statistics.mean(comp),
                     "generated_per_s": (sum(comp) / total_s) if total_s else None, "tasks_per_min": (60 * len(eps) / total_s) if total_s else None,
                     "tokens_per_success": (sum(comp) / ok) if ok else None, "tokens_reported": any(comp)})
    runs = []
    for arm in study.plan["arms"]:
        for seed in study.plan["seeds"]:
            rd = study.run_dir(arm, seed)
            if not (rd / "run.json").exists():
                continue
            r = json.loads((rd / "run.json").read_text(encoding="utf-8"))
            h = r.get("hardware") or {}
            runs.append({"arm": arm, "seed": seed, "wall_s": r.get("wall_s"), "peak_vram_mb": r.get("peak_vram_mb"), "steps": r.get("global_step"),
                         "energy_wh": h.get("energy_wh") if h.get("gpu_measured") else None, "thermal_pauses": h.get("thermal_pauses"),
                         "adapter_bytes": _size(rd / "adapter" / "adapter_model.safetensors")})
    student = Path(study.plan["student"]["path"])
    sizes = {"student_weights_bytes": sum(f.stat().st_size for f in student.glob("*.safetensors")) if student.is_dir() else None}
    ex = study.root / "exports"
    exports = [{"name": p.name, "bytes": _size(p)} for p in sorted(ex.iterdir())] if ex.is_dir() else []
    for g in sorted((ex / "gguf").glob("*.gguf")) if (ex / "gguf").is_dir() else []:
        exports.append({"name": f"gguf/{g.name}", "bytes": g.stat().st_size})
    ref = {r["arm"]: r for r in rows if r["split"] == "dev"}
    t, base = ref.get("teacher"), ref.get(study.plan["arms"][0])
    ratio = (t["median_s"] / base["median_s"]) if t and base and t["median_s"] and base["median_s"] else None
    return {"rows": rows, "runs": runs, "sizes": sizes, "exports": [e for e in exports if e["name"] != "gguf"],
            "teacher_vs_trained_median_ratio": ratio, "teacher": study.plan["teacher"]["model"], "student": study.plan["student"]["name"],
            "device": study.plan["device"],
            "honesty": "Measured on this machine, under whatever else was running. Teacher timings include LM Studio's server. A ratio "
                       "describes this setup; a smaller student is faster because it is smaller, not because of distillation."}
