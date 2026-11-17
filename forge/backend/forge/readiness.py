"""Readiness: the measured preconditions for each stage of the MVP loop.

Each check: {id, label, status: pass|warn|fail|unknown, detail, blocks: [stages]}.
Experiment Studio refuses to launch a stage while any check that blocks it is failing.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import httpx

from forge.hardware.probe import HardwareReport


def _c(cid: str, label: str, status: str, detail: str, blocks: list[str]) -> dict[str, Any]:
    return {"id": cid, "label": label, "status": status, "detail": detail, "blocks": blocks}


def teacher_endpoint_status(url: str, timeout: float = 2.0) -> dict[str, Any]:
    base = url.rstrip("/").removesuffix("/v1")
    try:
        r = httpx.get(f"{base}/v1/models", timeout=timeout, trust_env=False, follow_redirects=False)
        r.raise_for_status()
        ids = [m.get("id") for m in r.json().get("data", [])]
        loaded = None
        try:
            v0 = httpx.get(f"{base}/api/v0/models", timeout=timeout, trust_env=False)
            if v0.status_code == 200:
                loaded = [m["id"] for m in v0.json().get("data", []) if m.get("state") == "loaded"]
        except httpx.HTTPError:
            pass
        return {"reachable": True, "models": ids, "loaded": loaded, "url": base}
    except (httpx.HTTPError, ValueError) as e:
        return {"reachable": False, "error": type(e).__name__, "url": base}


def readiness(hw: HardwareReport, teacher: dict[str, Any], home: Path, roles: dict[str, list[str]],
              port: int) -> dict[str, Any]:
    t = hw.torch
    gpu = hw.gpus[0] if hw.gpus else None
    allow_cpu = os.environ.get("FORGE_ALLOW_CPU") == "1"
    exe = t.python_executable or sys.executable
    in_venv = sys.prefix != getattr(sys, "base_prefix", sys.prefix)
    train_stages = ["train", "evaluate_dev", "evaluate_test", "export"]
    checks = [
        _c("venv", "Project virtual environment", "pass" if in_venv else "fail",
           f"{exe}" + ("" if in_venv else " — not a venv; global interpreters are refused"), train_stages + ["collect"]),
        _c("numpy", "NumPy importable", "pass" if t.numpy_version else "fail",
           t.numpy_version or "NumPy missing (install the full pinned set, not --no-deps)", train_stages + ["analyze_dev"]),
        _c("torch", "PyTorch installed", "pass" if t.installed and not t.error else "fail",
           f"{t.version}" if t.installed else "torch not installed in this interpreter", train_stages),
        _c("cuda", "CUDA available to torch",
           "pass" if t.cuda_available else ("warn" if allow_cpu else "fail"),
           f"CUDA build {t.cuda_build}, {t.device_count} device(s)" if t.cuda_available else
           ("CPU wiring mode (FORGE_ALLOW_CPU=1) — results are not valid" if allow_cpu else
            f"torch CUDA build: {t.cuda_build or 'cpu-only'}"), [] if allow_cpu else train_stages),
        _c("bf16", "BF16 supported", "pass" if t.bf16_supported else ("warn" if allow_cpu else "fail"),
           str(t.bf16_supported), [] if allow_cpu else train_stages),
        _c("gpu", "NVIDIA GPU visible", "pass" if gpu else "warn",
           f"{gpu.name} · {gpu.vram_total_mb} MB · driver {gpu.driver_version} · CUDA {hw.cuda_driver_version or '—'}"
           if gpu else "nvidia-smi found no device", []),
        _c("single_gpu", "Single visible GPU", "pass" if len(hw.gpus) <= 1 else "warn",
           f"{len(hw.gpus)} GPU(s); set CUDA_VISIBLE_DEVICES to one", []),
        _c("teacher_endpoint", "Teacher endpoint reachable", "pass" if teacher.get("reachable") else "fail",
           f"{teacher.get('url')} · {len(teacher.get('models') or [])} model(s)" if teacher.get("reachable") else
           f"{teacher.get('url')} unreachable ({teacher.get('error')}) — start LM Studio's server", ["collect"]),
        _c("teacher_unloaded", "Teacher unloaded from GPU",
           "unknown" if teacher.get("loaded") is None else ("pass" if not teacher["loaded"] else "warn"),
           "state not exposed" if teacher.get("loaded") is None else
           ("no model loaded" if not teacher["loaded"] else f"loaded: {', '.join(teacher['loaded'])} — unload before training"),
           []),
        _c("teacher_role", "Teacher assigned", "pass" if roles.get("teacher") else "fail",
           ", ".join(roles.get("teacher") or []) or "assign in Model Observatory", ["collect"]),
        _c("student_role", "Student assigned", "pass" if roles.get("student") else "fail",
           ", ".join(roles.get("student") or []) or "assign in Model Observatory", ["collect"]),
        _c("port", "Bound to loopback", "pass", f"127.0.0.1:{port} (this server)", []),
    ]
    for d in hw.disks:
        checks.append(_c(f"disk:{d['mount']}", f"Disk {d['mount']} below 90%", "pass" if d["used_pct"] < 90 else "warn",
                         f"{d['free_gb']} GB free ({d['used_pct']}% used)", []))
    blocked: dict[str, list[str]] = {}
    for c in checks:
        if c["status"] == "fail":
            for s in c["blocks"]:
                blocked.setdefault(s, []).append(c["id"])
    return {"checks": checks, "blocked_stages": blocked, "cpu_wiring_mode": allow_cpu}
