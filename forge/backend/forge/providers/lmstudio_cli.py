"""LM Studio `lms` CLI — used for one action only: unloading models to free the GPU before training.

Safety: the executable is discovered (FORGE_LMS_PATH, PATH, or LM Studio's default install path),
never taken from a request; arguments are a fixed list; no shell. The result is confirmed against
LM Studio's REST state rather than trusting the CLI's exit code alone.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Callable

UNLOAD_ARGS = ("unload", "--all")


def find_lms() -> str | None:
    env = os.environ.get("FORGE_LMS_PATH")
    if env and Path(env).is_file():
        return env
    found = shutil.which("lms")
    if found:
        return found
    for cand in (Path.home() / ".lmstudio" / "bin" / "lms.exe", Path.home() / ".lmstudio" / "bin" / "lms",
                 Path.home() / ".cache" / "lm-studio" / "bin" / "lms.exe", Path.home() / ".cache" / "lm-studio" / "bin" / "lms"):
        if cand.is_file():
            return str(cand)
    return None


def unload_all(lms: str, loaded_fn: Callable[[], list[str] | None], timeout_s: float = 60.0,
               confirm_s: float = 15.0) -> dict[str, Any]:
    """Run `lms unload --all`, then poll LM Studio until nothing generative is loaded (or time out)."""
    t0 = time.monotonic()
    try:
        proc = subprocess.run([lms, *UNLOAD_ARGS], capture_output=True, timeout=timeout_s, check=False,
                              creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        code, out, err = proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return {"ok": False, "exit_code": None, "error": f"`lms unload --all` did not finish within {timeout_s:.0f}s"}
    except OSError as e:
        return {"ok": False, "exit_code": None, "error": f"Could not run {lms}: {e}"}
    loaded = loaded_fn()
    while loaded and time.monotonic() - t0 < confirm_s:
        time.sleep(0.5)
        loaded = loaded_fn()
    return {
        "ok": code == 0 and not loaded,
        "exit_code": code,
        "command": f"{Path(lms).name} {' '.join(UNLOAD_ARGS)}",
        "stdout": out.decode("utf-8", errors="replace")[-2000:],
        "stderr": err.decode("utf-8", errors="replace")[-2000:],
        "loaded_after": loaded,  # None = LM Studio did not report state (server off: nothing is loaded via it)
        "duration_ms": int((time.monotonic() - t0) * 1000),
    }
