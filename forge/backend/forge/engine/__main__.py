"""`python -m forge.engine …` — the only entry point that touches torch / GPUs.

The API never imports this; it spawns it via forge.jobs.runner. Each line written
to stdout is one JSON event, which the job runner streams to the UI.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from pathlib import Path


def emit(event: dict) -> None:
    sys.stdout.write(json.dumps({"ts": time.time(), **event}, default=str, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def cmd_stage(a: argparse.Namespace) -> int:
    os.environ.setdefault("HF_HUB_OFFLINE", "1")  # studies are offline: no silent network fetches
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine.study import Study
    study = Study(Path(a.study))
    emit({"event": "stage_start", "stage": a.stage, "study": study.plan["study_id"], "python": sys.executable})
    res = study.run_stage(a.stage, emit=emit, confirm=a.confirm,
                          hash_cache=Path(a.hash_cache) if a.hash_cache else None)
    emit({"event": "stage_completed", "stage": a.stage, "result": res})
    return 0


def cmd_hub_download(a: argparse.Namespace) -> int:
    from forge.providers.hf_hub import download_and_verify
    res = download_and_verify(a.repo, revision=a.revision, cache_dir=Path(a.cache_dir) if a.cache_dir else None, emit=emit)
    emit({"event": "download_verified", **res})
    return 0


def cmd_verify_gpu(a: argparse.Namespace) -> int:
    """Forward/backward + BF16 on the real GPU. Prints measured facts only."""
    import numpy
    import torch
    emit({"event": "env", "python": sys.executable, "torch": torch.__version__, "cuda_build": torch.version.cuda,
          "numpy": numpy.__version__, "cuda_available": torch.cuda.is_available()})
    if not torch.cuda.is_available():
        emit({"event": "fail", "reason": "CUDA not available to this interpreter"})
        return 2
    dev = torch.device("cuda")
    emit({"event": "device", "name": torch.cuda.get_device_name(0), "capability": torch.cuda.get_device_capability(0),
          "bf16": torch.cuda.is_bf16_supported(), "count": torch.cuda.device_count()})
    torch.manual_seed(0)
    x = torch.randn(64, 1024, device=dev, dtype=torch.bfloat16, requires_grad=True)
    w = torch.randn(1024, 1024, device=dev, dtype=torch.bfloat16, requires_grad=True)
    loss = (x @ w).float().pow(2).mean()
    loss.backward()
    ok = bool(torch.isfinite(w.grad.float()).all())
    emit({"event": "forward_backward_bf16", "loss": float(loss), "grad_finite": ok,
          "peak_mb": round(torch.cuda.max_memory_allocated() / 2 ** 20, 1)})
    return 0 if ok else 3


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="forge.engine")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("stage")
    s.add_argument("--study", required=True)
    s.add_argument("--stage", required=True)
    s.add_argument("--confirm")
    s.add_argument("--hash-cache")
    s.set_defaults(fn=cmd_stage)
    h = sub.add_parser("hub-download")
    h.add_argument("--repo", required=True)
    h.add_argument("--revision")
    h.add_argument("--cache-dir")
    h.set_defaults(fn=cmd_hub_download)
    v = sub.add_parser("verify-gpu")
    v.set_defaults(fn=cmd_verify_gpu)
    a = p.parse_args(argv)
    try:
        return a.fn(a)
    except Exception as e:
        emit({"event": "error", "error": f"{type(e).__name__}: {e}", "traceback": traceback.format_exc()[-4000:]})
        return 1


if __name__ == "__main__":
    sys.exit(main())
