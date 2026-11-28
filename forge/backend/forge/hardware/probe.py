"""Hardware discovery.

Design rules:
- Never import torch in the API process: it costs ~1-2 GB RAM and can create a
  CUDA context. Torch capability is probed once in a short-lived subprocess.
- Every field is either a measured value or None. Nothing is simulated.
"""
from __future__ import annotations

import csv
import importlib.util
import io
import json
import logging
import platform
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from functools import lru_cache
from pathlib import Path

import psutil

log = logging.getLogger("forge.hardware")

NVIDIA_QUERY = (
    "index,name,uuid,memory.total,memory.used,memory.free,utilization.gpu,"
    "temperature.gpu,power.draw,power.limit,driver_version,compute_cap"
)


@dataclass
class GpuInfo:
    index: int
    name: str
    uuid: str | None
    vram_total_mb: int | None
    vram_used_mb: int | None
    vram_free_mb: int | None
    utilization_pct: float | None
    temperature_c: float | None
    power_draw_w: float | None
    power_limit_w: float | None
    driver_version: str | None
    compute_capability: str | None


@dataclass
class TorchInfo:
    installed: bool
    version: str | None = None
    cuda_build: str | None = None
    cuda_available: bool = False
    device_count: int = 0
    bf16_supported: bool | None = None
    numpy_version: str | None = None
    python_executable: str | None = None
    error: str | None = None


@dataclass
class HardwareReport:
    os: str
    python: str
    cpu_model: str
    cpu_physical_cores: int | None
    cpu_logical_cores: int | None
    ram_total_mb: int
    ram_available_mb: int
    disks: list[dict]
    nvidia_smi: str | None
    cuda_driver_version: str | None
    gpus: list[GpuInfo] = field(default_factory=list)
    torch: TorchInfo = field(default_factory=lambda: TorchInfo(installed=False))
    optional_packages: dict[str, bool] = field(default_factory=dict)
    wsl: bool = False
    python_executable: str = field(default_factory=lambda: sys.executable)

    def to_dict(self) -> dict:
        return asdict(self)


def _num(v: str) -> float | None:
    v = v.strip()
    if not v or v.startswith("[") or v.upper() in {"N/A", "[N/A]"}:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def parse_nvidia_smi_csv(text: str) -> list[GpuInfo]:
    gpus: list[GpuInfo] = []
    for row in csv.reader(io.StringIO(text)):
        if len(row) < 12:
            continue
        r = [c.strip() for c in row]
        to_int = lambda s: (int(x) if (x := _num(s)) is not None else None)  # noqa: E731
        gpus.append(
            GpuInfo(
                index=int(r[0]), name=r[1], uuid=r[2] or None,
                vram_total_mb=to_int(r[3]), vram_used_mb=to_int(r[4]), vram_free_mb=to_int(r[5]),
                utilization_pct=_num(r[6]), temperature_c=_num(r[7]),
                power_draw_w=_num(r[8]), power_limit_w=_num(r[9]),
                driver_version=r[10] or None, compute_capability=r[11] or None,
            )
        )
    return gpus


def parse_cuda_version(nvidia_smi_output: str) -> str | None:
    """Accepts both the banner ('CUDA Version: 12.9') and `nvidia-smi -q` ('CUDA Version : 12.9')."""
    m = re.search(r"CUDA (?:Driver )?Version\s*:\s*([\d.]+)", nvidia_smi_output)
    return m.group(1) if m else None


def _run_text(args: list[str], timeout: float) -> str:
    """Run a tool and decode as UTF-8 with replacement.

    Why: on Windows the console code page is not UTF-8; text=True decoding of nvidia-smi
    box-drawing characters raised and the CUDA version silently became '—'.
    """
    out = subprocess.run(args, capture_output=True, timeout=timeout, check=False).stdout
    return out.decode("utf-8", errors="replace")


def find_nvidia_smi() -> str | None:
    exe = shutil.which("nvidia-smi")
    if exe:
        return exe
    if sys.platform == "win32":
        candidate = Path(r"C:\Windows\System32\nvidia-smi.exe")
        if candidate.exists():
            return str(candidate)
    return None


def query_gpus(smi: str | None = None, timeout: float = 5.0) -> list[GpuInfo]:
    smi = smi or find_nvidia_smi()
    if not smi:
        return []
    try:
        out = _run_text([smi, f"--query-gpu={NVIDIA_QUERY}", "--format=csv,noheader,nounits"], timeout)
        return parse_nvidia_smi_csv(out)
    except (subprocess.SubprocessError, OSError) as exc:
        log.warning("nvidia-smi query failed", extra={"fields": {"error": str(exc)}})
        return []


def _cuda_driver_version(smi: str | None) -> str | None:
    if not smi:
        return None
    for args in ([smi], [smi, "-q"]):  # banner first, then the detailed query as fallback
        try:
            v = parse_cuda_version(_run_text(args, 8))
        except (subprocess.SubprocessError, OSError):
            v = None
        if v:
            return v
    return None


_TORCH_PROBE = r"""
import json, sys
try:
    import numpy
    np_v = numpy.__version__
except Exception:
    np_v = None
try:
    import torch
    d = {"installed": True, "version": torch.__version__, "cuda_build": torch.version.cuda,
         "cuda_available": bool(torch.cuda.is_available()), "device_count": 0, "bf16_supported": None,
         "numpy_version": np_v, "python_executable": sys.executable}
    if d["cuda_available"]:
        d["device_count"] = torch.cuda.device_count()
        d["bf16_supported"] = bool(torch.cuda.is_bf16_supported())
    print(json.dumps(d))
except ImportError:
    print(json.dumps({"installed": False, "numpy_version": np_v, "python_executable": sys.executable}))
except Exception as e:
    print(json.dumps({"installed": True, "error": repr(e), "numpy_version": np_v, "python_executable": sys.executable}))
"""


@lru_cache(maxsize=1)
def probe_torch(python: str = sys.executable, timeout: float = 90.0) -> TorchInfo:
    """Probe torch in a child process of *this* interpreter (the project .venv), never a global Python."""
    try:
        out = subprocess.run([python, "-I", "-c", _TORCH_PROBE], capture_output=True, timeout=timeout)
        data = json.loads(out.stdout.decode("utf-8", errors="replace").strip().splitlines()[-1])
        return TorchInfo(**data)
    except Exception as exc:  # probe failure must never break the API
        return TorchInfo(installed=importlib.util.find_spec("torch") is not None, python_executable=python,
                         error=f"probe failed: {exc!r}")


OPTIONAL_PACKAGES = ("torch", "numpy", "scipy", "transformers", "peft", "accelerate", "datasets", "safetensors",
                     "huggingface_hub", "bitsandbytes")


def optional_packages() -> dict[str, bool]:
    return {p: importlib.util.find_spec(p) is not None for p in OPTIONAL_PACKAGES}


def _cpu_model() -> str:
    if sys.platform == "win32":
        try:
            import winreg  # type: ignore
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
            return str(winreg.QueryValueEx(key, "ProcessorNameString")[0]).strip()
        except OSError:
            pass
    try:
        for line in Path("/proc/cpuinfo").read_text(encoding="utf-8", errors="replace").splitlines():
            if line.lower().startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or platform.machine()


def _disks(paths: list[Path]) -> list[dict]:
    seen: set[str] = set()
    disks = []
    for p in paths:
        probe = p
        while not probe.exists() and probe != probe.parent:
            probe = probe.parent
        try:
            usage = psutil.disk_usage(str(probe))
        except OSError:
            continue
        anchor = probe.anchor or str(probe)
        key = f"{anchor}:{usage.total}"
        if key in seen:
            continue
        seen.add(key)
        disks.append({"path": str(p), "mount": anchor, "total_gb": round(usage.total / 1e9, 1),
                      "free_gb": round(usage.free / 1e9, 1), "used_pct": usage.percent})
    return disks


def _is_wsl() -> bool:
    try:
        return "microsoft" in Path("/proc/version").read_text(encoding="utf-8", errors="replace").lower()
    except OSError:
        return False


def collect_hardware(disk_paths: list[Path], include_torch: bool = True) -> HardwareReport:
    smi = find_nvidia_smi()
    vm = psutil.virtual_memory()
    return HardwareReport(
        os=f"{platform.system()} {platform.release()} ({platform.version()})",
        python=sys.version.split()[0],
        cpu_model=_cpu_model(),
        cpu_physical_cores=psutil.cpu_count(logical=False),
        cpu_logical_cores=psutil.cpu_count(logical=True),
        ram_total_mb=vm.total // 2**20,
        ram_available_mb=vm.available // 2**20,
        disks=_disks(disk_paths),
        nvidia_smi=smi,
        cuda_driver_version=_cuda_driver_version(smi),
        gpus=query_gpus(smi),
        torch=probe_torch() if include_torch else TorchInfo(installed=importlib.util.find_spec("torch") is not None),
        optional_packages=optional_packages(),
        wsl=_is_wsl(),
    )


if __name__ == "__main__":  # `python -m forge.hardware.probe` → host inspection JSON
    from forge.config import Settings
    s = Settings()
    print(json.dumps(collect_hardware([s.home, s.hf_hub_cache]).to_dict(), indent=2))
