"""Forgetting check: did training change the student's general language, outside the trained skill?

Perplexity = exp(mean negative log-likelihood per token) of a fixed general-English text, for the untrained student and for
every trained arm and seed. Lower is better; a rise after training means the model now predicts ordinary text less well
(general-language drift, often called catastrophic forgetting). Paired per passage: the change is the mean difference in
per-token log-likelihood, with a bootstrap range over passages, reported as a percentage change in perplexity.

The text is FORGE's small built-in passage set (`general_text.py`) unless a file is given (one passage per blank-line block).
It never touches the study's tasks, so it can run at any time after training, before or after SEAL.
Thresholds: a perplexity rise whose whole range lies above +5 % is flagged "forgetting"; a whole range below −5 % is "lower"
(training made ordinary text easier to predict); a range inside ±5 %, or below +5 % without reaching −5 %, is "no material
drift"; anything else is "inconclusive".
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Callable

import numpy as np

from forge.util import utcnow

THRESHOLD = 0.05


def passages(path: str | None) -> tuple[list[str], str]:
    if path:
        raw = Path(path).read_text(encoding="utf-8")
        ps = [p.strip() for p in raw.split("\n\n") if len(p.strip()) > 40]
        return ps, f"file {Path(path).name}"
    from forge.engine.general_text import PASSAGES
    return list(PASSAGES), "built-in general text (FORGE)"


def _nll(model: Any, tok: Any, texts: list[str], device: str, max_len: int = 512) -> list[tuple[float, int]]:
    """(sum of token NLL, token count) per passage."""
    import torch
    out = []
    for t in texts:
        ids = tok(t, return_tensors="pt", truncation=True, max_length=max_len, add_special_tokens=True)["input_ids"].to(device)
        if ids.shape[1] < 2:
            continue
        with torch.no_grad():
            logits = model(input_ids=ids).logits[:, :-1].float()
        lp = torch.log_softmax(logits, -1).gather(-1, ids[:, 1:, None]).squeeze(-1)
        out.append((float(-lp.sum()), int(ids.shape[1] - 1)))
    return out


def _summ(rows: list[tuple[float, int]]) -> dict[str, float]:
    tot, n = sum(r[0] for r in rows), sum(r[1] for r in rows)
    return {"perplexity": math.exp(tot / n), "tokens": n, "mean_nll": tot / n}


def _paired(base: list[tuple[float, int]], arm: list[tuple[float, int]], n_boot: int = 5000, seed: int = 0) -> dict[str, Any]:
    d = np.array([a[0] / a[1] - b[0] / b[1] for a, b in zip(arm, base)])          # per-passage change in mean NLL
    rng = np.random.default_rng(seed)
    bs = d[rng.integers(0, len(d), size=(n_boot, len(d)))].mean(axis=1)
    lo, hi = np.percentile(bs, [2.5, 97.5])
    ch = lambda x: math.exp(float(x)) - 1                                          # NLL difference → relative perplexity change
    return {"change": ch(d.mean()), "ci": [ch(lo), ch(hi)], "passages_worse": int((d > 0).sum()), "passages": len(d)}


def _status(c: dict) -> str:
    if c["ci"][0] > THRESHOLD:
        return "forgetting"
    if c["ci"][1] < -THRESHOLD:
        return "lower"          # general text got *easier* to predict: training text overlapped it (common for tiny models)
    if c["ci"][1] < THRESHOLD:
        return "no_material_drift"
    return "inconclusive"


def run(study: Any, text_file: str | None = None, emit: Callable[[dict], None] = lambda e: None) -> dict[str, Any]:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    texts, source = passages(text_file)
    if len(texts) < 5:
        raise ValueError("The forgetting check needs at least 5 passages of general text")
    device = study.plan["device"]
    path = study.plan["student"]["path"]
    tok = AutoTokenizer.from_pretrained(path, local_files_only=True)
    kw: dict[str, Any] = {"local_files_only": True, "torch_dtype": torch.bfloat16 if device == "cuda" else torch.float32}
    if study.base_4bit and device == "cuda":
        from transformers import BitsAndBytesConfig
        kw |= {"quantization_config": BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16,
                                                         bnb_4bit_use_double_quant=True), "device_map": {"": 0}}
        model = AutoModelForCausalLM.from_pretrained(path, **kw)
    else:
        model = AutoModelForCausalLM.from_pretrained(path, **kw).to(device)
    model.eval()
    emit({"event": "forgetting", "model": "untrained student", "passages": len(texts)})
    base = _nll(model, tok, texts, device)
    adapters = [(a, s, study.run_dir(a, s) / "adapter") for a in study.plan["arms"] for s in study.plan["seeds"]]
    adapters = [x for x in adapters if (x[2] / "adapter_model.safetensors").exists()]
    if not adapters:
        raise ValueError("No trained adapters yet: run Train first")
    from peft import PeftModel
    pm = None
    arms: dict[str, Any] = {}
    for i, (arm, seed, ad) in enumerate(adapters):
        name = f"a{i}"
        if pm is None:
            pm = PeftModel.from_pretrained(model, str(ad), adapter_name=name, is_trainable=False)
        else:
            pm.load_adapter(str(ad), adapter_name=name, is_trainable=False)
        pm.set_adapter(name)
        pm.eval()
        emit({"event": "forgetting", "model": f"{arm} seed {seed}"})
        rows = _nll(pm, tok, texts, device)
        arms.setdefault(arm, {"seeds": {}, "_rows": []})
        arms[arm]["seeds"][str(seed)] = {**_summ(rows), **_paired(base, rows)}
        arms[arm]["_rows"].append(rows)
        pm.delete_adapter(name)
    for arm, v in arms.items():
        rows = v.pop("_rows")
        pooled = [(float(np.mean([r[i][0] for r in rows])), rows[0][i][1]) for i in range(len(base))]   # seed-averaged per passage
        v["pooled"] = {**_summ(pooled), **_paired(base, pooled)}
        v["status"] = _status(v["pooled"])
    rep = {"generated_at": utcnow(), "source": source, "passages": len(texts), "threshold": THRESHOLD,
           "base": _summ(base), "arms": arms,
           "method": "perplexity = exp(mean token NLL); change paired per passage, bootstrap 95 % over passages; seeds averaged per passage",
           "honesty": "A small general-text sample: it detects broad drift, not every lost capability. It says nothing about the trained skill."}
    from forge.engine.study import atomic_write_json
    (study.root / "reports").mkdir(parents=True, exist_ok=True)
    atomic_write_json(study.root / "reports" / "forgetting.json", rep)
    emit({"event": "forgetting_done", **{a: v["status"] for a, v in arms.items()}})
    return rep


def report(study: Any) -> dict[str, Any] | None:
    p = study.root / "reports" / "forgetting.json"
    if not p.exists():
        return None
    rep = json.loads(p.read_text(encoding="utf-8"))
    for v in rep.get("arms", {}).values():  # status follows the current thresholds, from the stored measurements
        v["status"] = _status(v["pooled"])
    return rep
