"""Autopilot: run everything that is left in a study, in order, as one job — the validation kit inside the app.

Steps (each skipped when already done, so a failed run is resumed by starting it again):
  collect → build → train → evaluate_dev → analyze_dev → [seal] → evaluate_test → analyze_test →
  forgetting check → [export → quantized variants W8 + W4 activation-aware, on the final test] → reproducibility bundle

Sealing happens only when the caller passed the typed confirmation; without it the run stops before the final test and
says so. Before training, LM Studio is asked to unload its models (best effort) so the GPU is free. Every step is the same
code the individual buttons run: no shortcut, no different statistics.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

PRE = ["collect", "build", "train", "evaluate_dev", "analyze_dev"]
FINAL = ["evaluate_test", "analyze_test"]
QUANT = ["ref_w8", "ref_w4_aware"]


def steps(study: Any, cfg: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """The plan for this study and whether each step is done — from what exists on disk."""
    cfg = cfg or {}
    stg = {k: v.get("status") for k, v in study.state["stages"].items()}
    out = [{"key": s, "label": LABEL[s], "done": stg.get(s) == "completed", "status": stg.get(s)} for s in PRE]
    out.append({"key": "seal", "label": LABEL["seal"], "done": bool(study.state.get("sealed")), "status": stg.get("seal"), "needs_confirm": True})
    out += [{"key": s, "label": LABEL[s], "done": stg.get(s) == "completed", "status": stg.get(s)} for s in FINAL]
    out.append({"key": "forgetting", "label": LABEL["forgetting"], "done": (study.root / "reports" / "forgetting.json").exists(), "optional": True})
    if cfg.get("quant", True):
        out.append({"key": "export", "label": LABEL["export"], "done": stg.get("export") == "completed", "status": stg.get("export"), "optional": True})
        for m in QUANT:
            out.append({"key": f"quant:{m}", "label": f"Quantize {m.replace('ref_', '').replace('_', ' ')} and measure on the final test",
                        "done": (study.episode_path(f"quant_{m}", "test", 0)).exists(), "optional": True})
    bd = study.root / "bundles"
    out.append({"key": "bundle", "label": LABEL["bundle"], "done": bd.is_dir() and any(bd.glob("*.zip")), "optional": True})
    return out


LABEL = {"collect": "Collect the teacher's examples", "build": "Build training sets", "train": "Train every arm and seed",
         "evaluate_dev": "Evaluate on practice tasks", "analyze_dev": "Analyse practice results", "seal": "Seal (no more training)",
         "evaluate_test": "Run the sealed final test", "analyze_test": "Analyse the final test", "forgetting": "Forgetting check",
         "export": "Verified merged export", "bundle": "Reproducibility bundle (verified)"}


def _unload_teacher(emit: Callable[[dict], None]) -> None:
    try:
        from forge.providers import lmstudio_cli
        lms = lmstudio_cli.find_lms()
        if lms:
            r = lmstudio_cli.unload_all(lms, lambda: None)
            emit({"event": "autopilot_note", "text": "LM Studio models unloaded" if r.get("ok") else "LM Studio unload did not complete; training checks free memory itself"})
    except Exception as e:  # best effort: training's own pre-flight decides
        emit({"event": "autopilot_note", "text": f"Could not unload LM Studio ({type(e).__name__}); training checks free memory itself"})


def run(study: Any, cfg: dict[str, Any], emit: Callable[[dict], None]) -> dict[str, Any]:
    plan = steps(study, cfg)
    total = len(plan)
    hash_cache = Path(cfg["hash_cache"]) if cfg.get("hash_cache") else None

    def mark(i: int, st: dict, status: str, **extra: Any) -> None:
        emit({"event": "autopilot", "step": st["key"], "label": st["label"], "status": status, "index": i + 1, "total": total, **extra})

    for i, st in enumerate(plan):
        key = st["key"]
        if st["done"]:
            mark(i, st, "skipped")
            continue
        if key == "seal" and cfg.get("seal_confirm") != "SEAL":
            mark(i, st, "stopped", reason="Sealing needs confirmation. Practice results are ready; seal when you are satisfied, then run again.")
            return {"stopped_at": "seal", "steps": steps(study, cfg)}
        mark(i, st, "start")
        if key == "train":
            _unload_teacher(emit)
        if key in PRE or key in FINAL or key == "export":
            study.run_stage(key, emit=emit, hash_cache=hash_cache)
        elif key == "seal":
            study.run_stage("seal", emit=emit, confirm="SEAL")
        elif key == "forgetting":
            from forge.engine import forgetting
            forgetting.run(study, cfg.get("text_file"), emit)
        elif key.startswith("quant:"):
            from forge.quant import lab
            m = key.split(":", 1)[1]
            if not (study.root / "quant" / m / "manifest.json").exists():
                lab.make_reference(study, {"method": m, "split": "dev"}, emit)
            lab.evaluate(study, m, "test", emit)
        elif key == "bundle":
            from forge.engine import bundle
            b = bundle.export(study)
            v = bundle.verify(b["path"])
            emit({"event": "bundle", "path": b["path"], "verified": v["ok"]})
        mark(i, st, "done")
    return {"stopped_at": None, "steps": steps(study, cfg)}
