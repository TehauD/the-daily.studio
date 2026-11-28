"""Hardware guard for engine jobs: keep long runs cool, the PC responsive, and measure energy.

Modern NVIDIA GPUs protect themselves (they slow down around 83–90 °C and shut off before damage), so this guard is about
*comfort and longevity*: sustained high temperatures, fan wear, and a PC that stays usable during 14-hour runs.

- Thermal pause: a background thread samples the GPU every few seconds (nvidia-smi). At safe points — between episodes,
  training steps, map/lens items — `check()` pauses when the GPU is at or above `max_temp_c` and resumes once it has
  cooled to `resume_temp_c`. Pauses are logged (`thermal_pause` / `thermal_resume`). Results are unaffected: work simply
  waits; nothing is skipped or recomputed.
- Cool start: a job that starts while the GPU is still hot waits until it has cooled.
- CPU reserve: the job uses all cores except `cpu_reserve` (threads for torch / BLAS), so the desktop stays responsive.
- Low priority: the engine process runs at below-normal priority.
- Energy: GPU board power is integrated over the job (Wh), with peak temperature and time paused — reported at the end
  (`hardware_summary`) and stored with training runs. Whole-GPU readings: other programs' load is included.

Configured in System Settings → Hardware guard; passed to engine processes as FORGE_GUARD_* environment variables.
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
from typing import Any, Callable

DEFAULTS = {"enabled": True, "max_temp_c": 83, "resume_temp_c": 75, "cpu_reserve": 2, "low_priority": True, "sample_s": 5.0}
_GUARD: "Guard | None" = None


def config_from_env() -> dict[str, Any]:
    raw = os.environ.get("FORGE_GUARD")
    cfg = dict(DEFAULTS)
    if raw:
        try:
            cfg.update({k: v for k, v in json.loads(raw).items() if k in DEFAULTS})
        except (ValueError, TypeError):
            pass
    return cfg


class Guard:
    def __init__(self, cfg: dict[str, Any], emit: Callable[[dict], None], reader: Callable[[], tuple[float | None, float | None]] | None = None):
        self.cfg, self.emit = cfg, emit
        self.reader = reader or self._smi_reader()
        self.temp: float | None = None
        self.power: float | None = None
        self.peak_temp: float | None = None
        self.energy_j = 0.0
        self.paused_s = 0.0
        self.pauses = 0
        self.t0 = time.monotonic()
        self._last = time.monotonic()
        self._stop = threading.Event()
        self._suspended = threading.Event()
        self._thread: threading.Thread | None = None

    @staticmethod
    def _smi_reader() -> Callable[[], tuple[float | None, float | None]]:
        from forge.hardware.probe import find_nvidia_smi, query_gpus
        smi = find_nvidia_smi()

        def read() -> tuple[float | None, float | None]:
            if not smi:
                return None, None
            try:
                g = query_gpus(smi, timeout=4.0)
            except Exception:  # a failed reading must never stop a job
                return None, None
            return (g[0].temperature_c, g[0].power_draw_w) if g else (None, None)
        return read

    # ---- sampling
    def sample(self) -> None:
        now = time.monotonic()
        dt, self._last = now - self._last, now
        if self._suspended.is_set():
            return
        t, p = self.reader()
        if p is not None and self.power is not None:
            self.energy_j += 0.5 * (p + self.power) * min(dt, 60.0)
        self.temp, self.power = t, p
        if t is not None:
            self.peak_temp = t if self.peak_temp is None else max(self.peak_temp, t)

    def _loop(self) -> None:
        while not self._stop.wait(float(self.cfg["sample_s"])):
            self.sample()

    def start(self) -> "Guard":
        self._apply_cpu()
        self.sample()
        self._thread = threading.Thread(target=self._loop, daemon=True, name="forge-guard")
        self._thread.start()
        if self.cfg["enabled"] and self.temp is not None and self.temp >= self.cfg["max_temp_c"]:
            self._cool("job start")
        return self

    def _apply_cpu(self) -> None:
        reserve = int(self.cfg.get("cpu_reserve") or 0)
        cores = os.cpu_count() or 1
        threads = max(1, cores - reserve)
        for k in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS"):
            os.environ.setdefault(k, str(threads))
        if "torch" in sys.modules:
            try:
                sys.modules["torch"].set_num_threads(threads)
            except Exception:
                pass
        self.threads = threads
        if self.cfg.get("low_priority"):
            try:
                import psutil
                p = psutil.Process()
                p.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS if sys.platform == "win32" else 5)
            except Exception:
                pass

    # ---- thermal pause
    def check(self) -> None:
        if not self.cfg["enabled"] or self.temp is None or self.temp < self.cfg["max_temp_c"]:
            return
        self._cool("safe point")

    def _cool(self, where: str) -> None:
        t0 = time.monotonic()
        self.pauses += 1
        self.emit({"event": "thermal_pause", "temp_c": self.temp, "max_c": self.cfg["max_temp_c"], "resume_c": self.cfg["resume_temp_c"], "at": where})
        while not self._stop.is_set():
            time.sleep(min(5.0, float(self.cfg["sample_s"])))
            if self._thread is None:
                self.sample()
            if self.temp is None or self.temp <= self.cfg["resume_temp_c"]:
                break
        waited = time.monotonic() - t0
        self.paused_s += waited
        self.emit({"event": "thermal_resume", "temp_c": self.temp, "paused_s": round(waited, 1)})

    # ---- energy accounting while a child process does the work (it reports its own)
    def suspend(self) -> "_Suspend":
        return _Suspend(self)

    def summary(self) -> dict[str, Any]:
        wall = time.monotonic() - self.t0
        return {"energy_wh": round(self.energy_j / 3600.0, 3), "avg_power_w": round(self.energy_j / wall, 1) if wall > 0 and self.energy_j else None,
                "peak_temp_c": self.peak_temp, "paused_s": round(self.paused_s, 1), "thermal_pauses": self.pauses,
                "threads": getattr(self, "threads", None), "wall_s": round(wall, 1), "gpu_measured": self.peak_temp is not None,
                "scope": "whole GPU (nvidia-smi): includes any other load on the card"}

    def stop(self) -> dict[str, Any]:
        self._stop.set()
        self.sample()
        return self.summary()


class _Suspend:
    def __init__(self, g: Guard):
        self.g = g

    def __enter__(self):
        self.g.sample()
        self.g._suspended.set()

    def __exit__(self, *exc):
        self.g._suspended.clear()
        self.g._last = time.monotonic()


def install(emit: Callable[[dict], None]) -> Guard:
    global _GUARD
    _GUARD = Guard(config_from_env(), emit).start()
    return _GUARD


def current() -> Guard | None:
    return _GUARD


def check() -> None:
    """Safe point: pause here if the GPU is too hot. No-op when no guard is installed (tests, API process)."""
    if _GUARD is not None:
        _GUARD.check()


def suspended():
    """Context manager: stop counting energy while a child engine process does the work."""
    import contextlib
    return _GUARD.suspend() if _GUARD is not None else contextlib.nullcontext()
