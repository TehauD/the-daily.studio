"""Live resource telemetry.

The sampler runs only while a client has polled within `idle_stop_s`, so an
unattended FORGE costs ~zero CPU. Missing sensors are reported as None.
"""
from __future__ import annotations

import asyncio
import collections
import time
from dataclasses import asdict, dataclass

import psutil

from forge.hardware.probe import find_nvidia_smi, query_gpus


@dataclass
class Sample:
    ts: float
    cpu_pct: float
    ram_used_mb: int
    ram_total_mb: int
    gpus: list[dict]
    active_jobs: int


class TelemetrySampler:
    def __init__(self, interval_s: float, idle_stop_s: float, active_jobs_fn=lambda: 0, maxlen: int = 300):
        self.interval_s = interval_s
        self.idle_stop_s = idle_stop_s
        self.active_jobs_fn = active_jobs_fn
        self.buffer: collections.deque[Sample] = collections.deque(maxlen=maxlen)
        self._last_access = 0.0
        self._task: asyncio.Task | None = None
        self._smi = find_nvidia_smi()
        psutil.cpu_percent(interval=None)  # prime the counter

    def sample_now(self) -> Sample:
        vm = psutil.virtual_memory()
        gpus = [
            {"index": g.index, "name": g.name, "util_pct": g.utilization_pct, "vram_used_mb": g.vram_used_mb,
             "vram_total_mb": g.vram_total_mb, "temp_c": g.temperature_c, "power_w": g.power_draw_w}
            for g in query_gpus(self._smi)
        ] if self._smi else []
        s = Sample(ts=time.time(), cpu_pct=psutil.cpu_percent(interval=None), ram_used_mb=(vm.total - vm.available) // 2**20,
                   ram_total_mb=vm.total // 2**20, gpus=gpus, active_jobs=self.active_jobs_fn())
        self.buffer.append(s)
        return s

    async def _loop(self) -> None:
        while time.monotonic() - self._last_access < self.idle_stop_s:
            await asyncio.to_thread(self.sample_now)
            await asyncio.sleep(self.interval_s)
        self._task = None

    def touch(self) -> bool:
        """Extend the sampler's lease; start it on the *running* loop. Returns True if it is running.

        Must be called from a coroutine. The v0.1 route was a sync `def`, so FastAPI ran it in a
        worker thread with no event loop, `create_task` raised, and the sampler never started
        ("Collecting samples…" forever). The route is now `async def` and a regression test covers it.
        """
        self._last_access = time.monotonic()
        if self._task is None or self._task.done():
            self._task = asyncio.get_running_loop().create_task(self._loop())
        return True

    async def snapshot(self, since: float = 0.0) -> dict:
        self.touch()
        if not self.buffer:  # first viewer: return a measured sample immediately instead of an empty chart
            await asyncio.to_thread(self.sample_now)
        samples = [asdict(s) for s in self.buffer if s.ts > since]
        return {"gpu_source": "nvidia-smi" if self._smi else None, "interval_s": self.interval_s,
                "running": self._task is not None and not self._task.done(),
                "scope": "whole-GPU (nvidia-smi), not per-process", "samples": samples}
