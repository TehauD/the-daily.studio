"""FORGE → llm-compressor driver: make a vLLM-ready (compressed-tensors) variant of a FORGE merged export.

Run it with the Python of a SEPARATE environment that has llm-compressor installed (it needs a newer transformers than FORGE pins):

    python -m venv %USERPROFILE%\\forge-llmc
    %USERPROFILE%\\forge-llmc\\Scripts\\pip install llmcompressor
    %USERPROFILE%\\forge-llmc\\Scripts\\python scripts\\quant_llmc.py <spec.json>

The spec is written by FORGE (Quantization Lab → recipe): source export, output folder, the modifier recipe, and a calibration file
built from the study's TRAINING split only. Written against llm-compressor's `oneshot` API; the installed versions of
llm-compressor, compressed-tensors, transformers and torch are recorded in `forge_quant.json` next to the result, with the hash of
every file, so the variant can be traced and reproduced. Serve the output with vLLM, then measure it in FORGE (Measure a served
model) — FORGE judges the variant by its behaviour on the study's tasks, not by this script's success.
"""
from __future__ import annotations

import hashlib
import json
import sys
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path


def _v(pkg: str) -> str | None:
    try:
        return version(pkg)
    except PackageNotFoundError:
        return None


def _modifiers(recipe: list[dict]) -> list:
    from llmcompressor.modifiers.quantization import GPTQModifier, QuantizationModifier
    known = {"GPTQModifier": GPTQModifier, "QuantizationModifier": QuantizationModifier}
    try:
        from llmcompressor.modifiers.smoothquant import SmoothQuantModifier
        known["SmoothQuantModifier"] = SmoothQuantModifier
    except ImportError:
        pass
    try:
        from llmcompressor.modifiers.awq import AWQModifier
        known["AWQModifier"] = AWQModifier
    except ImportError:
        pass
    out = []
    for step in recipe:
        (name, kw), = step.items()
        if name not in known:
            raise SystemExit(f"This llm-compressor ({_v('llmcompressor')}) has no {name}; upgrade it or choose another method.")
        out.append(known[name](**kw))
    return out


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    from llmcompressor import oneshot
    from transformers import AutoModelForCausalLM, AutoTokenizer
    src, out = Path(spec["source"]), Path(spec["output"])
    if out.exists() and any(out.iterdir()):
        raise SystemExit(f"{out} exists and is not empty; variants are immutable — remove it or change the output")
    tok = AutoTokenizer.from_pretrained(src, local_files_only=True)
    model = AutoModelForCausalLM.from_pretrained(src, torch_dtype="auto", local_files_only=True)
    recipe = _modifiers(spec["recipe"])
    calibrated = any(next(iter(s)) != "QuantizationModifier" for s in spec["recipe"])
    calib_sha = None
    if calibrated:
        from datasets import Dataset
        raw = Path(spec["calibration"]).read_bytes()
        calib_sha = hashlib.sha256(raw).hexdigest()
        texts = [json.loads(x)["text"] for x in raw.decode("utf-8").splitlines() if x.strip()][: spec["num_calibration_samples"]]
        ds = Dataset.from_dict({"text": texts}).map(
            lambda b: tok(b["text"], truncation=True, max_length=spec["max_seq_length"], padding=False, add_special_tokens=False),
            batched=True, remove_columns=["text"])
        oneshot(model=model, dataset=ds, recipe=recipe, max_seq_length=spec["max_seq_length"], num_calibration_samples=len(texts))
    else:
        oneshot(model=model, recipe=recipe)
    out.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(out, save_compressed=True)
    tok.save_pretrained(out)
    files = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.iterdir()) if p.is_file()}
    man = {"made_by": "FORGE scripts/quant_llmc.py", "source": str(src), "recipe": spec["recipe"], "calibration_sha256": calib_sha,
           "calibration_samples": spec.get("num_calibration_samples") if calibrated else 0, "calibration_source": "training split" if calibrated else None,
           "versions": {p: _v(p) for p in ("llmcompressor", "compressed-tensors", "transformers", "torch")}, "files": files,
           "bytes": sum((out / n).stat().st_size for n in files)}
    (out / "forge_quant.json").write_text(json.dumps(man, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(out), "bytes": man["bytes"], "versions": man["versions"]}))


if __name__ == "__main__":
    main()
