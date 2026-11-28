"""GGUF export for LM Studio, using YOUR llama.cpp checkout.

FORGE does not ship a GGUF converter. It runs llama.cpp's own `convert_hf_to_gguf.py` (and, for 4–6-bit files,
`llama-quantize`) from a folder you choose in Settings, on the study's **verified merged export** — the bf16 copy made after
SEAL and checked against the adapter on the test set. The result is:

1. read back with a small built-in GGUF header reader (magic, version, architecture, tensor count, file type);
2. hashed and described in a manifest next to it (source export hashes, converter commit, arguments);
3. optionally copied into LM Studio's models folder as `forge/<name>/<file>.gguf` (never overwriting);
4. optionally checked: load it in LM Studio, then FORGE runs the sealed test tasks through LM Studio and reports success and
   agreement with the merged export. Quantization changes behaviour; this check shows by how much.

Nothing here makes a model fit for real-world or clinical use; it makes a local copy you can try in LM Studio.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import struct
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

from forge.util import sha256_file, utcnow, write_json_atomic

OUTTYPES = ("q8_0", "bf16", "f16")
QUANTS = ("Q6_K", "Q5_K_M", "Q4_K_M", "IQ4_XS", "Q4_0", "Q3_K_M")
FILE_TYPES = {0: "F32", 1: "F16", 2: "Q4_0", 7: "Q8_0", 12: "Q3_K_M", 15: "Q4_K_M", 17: "Q5_K_M", 18: "Q6_K", 30: "IQ4_XS", 32: "BF16"}


class GGUFError(RuntimeError):
    pass


def find_tools(llama_dir: str | None) -> dict[str, Any]:
    if not llama_dir:
        return {"ok": False, "problems": ["Choose your llama.cpp folder in Settings → GGUF export"]}
    d = Path(llama_dir)
    problems = []
    conv = d / "convert_hf_to_gguf.py"
    if not conv.is_file():
        problems.append("convert_hf_to_gguf.py not found in that folder")
    def _bin(name: str) -> Path | None:
        return next((p for p in (d / "build" / "bin" / f"{name}.exe", d / "build" / "bin" / "Release" / f"{name}.exe",
                                 d / "build" / "bin" / name, d / f"{name}.exe", d / name) if p.is_file()), None)
    quant, imatrix = _bin("llama-quantize"), _bin("llama-imatrix")
    commit = None
    head = d / ".git" / "HEAD"
    try:
        ref = head.read_text(encoding="utf-8").strip()
        commit = (d / ".git" / ref[5:]).read_text(encoding="utf-8").strip() if ref.startswith("ref: ") and (d / ".git" / ref[5:]).is_file() else (ref if re.fullmatch(r"[0-9a-f]{40}", ref) else None)
    except OSError:
        pass
    return {"ok": not problems, "problems": problems, "convert": str(conv) if conv.is_file() else None,
            "quantize": str(quant) if quant else None, "imatrix": str(imatrix) if imatrix else None, "commit": commit, "dir": str(d)}


# ---- minimal GGUF header reader (spec: magic 'GGUF', u32 version, u64 tensor count, u64 kv count, then key/values)
_SCALAR = {0: "<B", 1: "<b", 2: "<H", 3: "<h", 4: "<I", 5: "<i", 6: "<f", 7: "<?", 10: "<Q", 11: "<q", 12: "<d"}


def _read(f, fmt: str):
    n = struct.calcsize(fmt)
    b = f.read(n)
    if len(b) != n:
        raise GGUFError("truncated GGUF header")
    return struct.unpack(fmt, b)[0]


def _str(f) -> str:
    n = _read(f, "<Q")
    if n > 1 << 24:
        raise GGUFError("implausible string length in GGUF header")
    return f.read(n).decode("utf-8", errors="replace")


def _value(f, t: int, depth: int = 0):
    if t in _SCALAR:
        return _read(f, _SCALAR[t])
    if t == 8:
        return _str(f)
    if t == 9 and depth == 0:
        it, n = _read(f, "<I"), _read(f, "<Q")
        if n > 1 << 26:
            raise GGUFError("implausible array length")
        vals = [_value(f, it, 1) for _ in range(n)]
        return {"array_len": n} if n > 16 else vals
    raise GGUFError(f"unsupported GGUF value type {t}")


def read_header(path: Path, max_kv: int = 4096) -> dict[str, Any]:
    with open(path, "rb") as f:
        if f.read(4) != b"GGUF":
            raise GGUFError("not a GGUF file (bad magic)")
        version, tensors, nkv = _read(f, "<I"), _read(f, "<Q"), _read(f, "<Q")
        if version < 2 or nkv > max_kv:
            raise GGUFError(f"unsupported GGUF version {version} or too many keys")
        kv = {}
        for _ in range(nkv):
            k = _str(f)
            kv[k] = _value(f, _read(f, "<I"))
    arch = kv.get("general.architecture")
    ft = kv.get("general.file_type")
    return {"version": version, "tensors": tensors, "architecture": arch, "name": kv.get("general.name"),
            "file_type": FILE_TYPES.get(ft, ft), "context_length": kv.get(f"{arch}.context_length") if arch else None,
            "block_count": kv.get(f"{arch}.block_count") if arch else None, "has_chat_template": "tokenizer.chat_template" in kv}


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:48] or "forge-model"


def _run(argv: list[str], cwd: str, emit: Callable[[dict], None]) -> None:
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    with subprocess.Popen(argv, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)) as p:
        assert p.stdout is not None
        tail: list[str] = []
        for raw in p.stdout:
            line = raw.decode("utf-8", errors="replace").rstrip()
            tail = (tail + [line])[-20:]
            if line:
                emit({"event": "gguf_log", "line": line[:400]})
        code = p.wait()
    if code != 0:
        raise GGUFError(f"{Path(argv[1] if argv[0] == sys.executable else argv[0]).name} failed (exit {code}): " + " | ".join(tail[-4:]))


def merged_export(study: Any) -> Path:
    arm, seed = study.plan["arms"][0], study.plan["seeds"][0]
    src = study.root / "exports" / f"{arm}-seed{seed}-merged"
    if not (src / "forge_export.json").exists():
        raise GGUFError("Run the Export stage first: GGUF is made from the verified merged export")
    return src


def export(study: Any, spec: dict, emit: Callable[[dict], None] = lambda e: None) -> dict:
    tools = find_tools(spec.get("llama_cpp_dir"))
    if not tools["ok"]:
        raise GGUFError("; ".join(tools["problems"]))
    outtype, quant = spec.get("outtype", "q8_0"), spec.get("quant")
    if outtype not in OUTTYPES or (quant and quant not in QUANTS):
        raise GGUFError("Unknown output type")
    if quant and not tools["quantize"]:
        raise GGUFError("llama-quantize was not found (build llama.cpp, or choose q8_0 / bf16 / f16)")
    use_imatrix = bool(spec.get("imatrix")) and bool(quant)
    if use_imatrix and not tools["imatrix"]:
        raise GGUFError("llama-imatrix was not found (build llama.cpp's tools) — or quantize without calibration")
    src = merged_export(study)
    name = slug(spec.get("name") or study.plan["name"])
    out_dir = study.root / "exports" / "gguf"
    out_dir.mkdir(parents=True, exist_ok=True)
    label = (quant or outtype).lower() + ("-imatrix" if use_imatrix else "")
    final = out_dir / f"{name}-{label}.gguf"
    if final.exists():
        raise GGUFError(f"{final.name} already exists; exports are immutable")
    base = out_dir / f".{name}-{'f16' if quant else outtype}.tmp.gguf"
    emit({"event": "gguf_start", "source": str(src), "outtype": outtype, "quant": quant, "converter_commit": tools["commit"]})
    _run([sys.executable, tools["convert"], str(src), "--outfile", str(base), "--outtype", "f16" if quant else outtype], tools["dir"], emit)
    imx = None
    if quant:
        args = [tools["quantize"]]
        if use_imatrix:
            # Calibration from the TRAINING split only (never practice or test), written as plain text for llama-imatrix.
            from forge.quant.reference import calibration_texts
            texts = calibration_texts(study, int(spec.get("calibration_samples", 128)))
            if not texts:
                raise GGUFError("No training records to calibrate with (run Build)")
            calib = out_dir / f".{name}-calibration.txt"
            calib.write_text("\n\n".join(texts), encoding="utf-8")
            imat = out_dir / f"{name}-{quant.lower()}.imatrix"
            _run([tools["imatrix"], "-m", str(base), "-f", str(calib), "-o", str(imat)], tools["dir"], emit)
            imx = {"file": imat.name, "sha256": sha256_file(imat), "calibration_sha256": sha256_file(calib), "calibration_samples": len(texts),
                   "calibration_source": "training split (teacher-verified records)"}
            args += ["--imatrix", str(imat)]
        _run(args + [str(base), str(final), quant], tools["dir"], emit)
        base.unlink(missing_ok=True)
    else:
        os.replace(base, final)
    hdr = read_header(final)
    if not hdr["tensors"] or not hdr["architecture"]:
        raise GGUFError("The GGUF file has no tensors or no architecture")
    src_manifest = json.loads((src / "forge_export.json").read_text(encoding="utf-8"))
    man = {"file": final.name, "path": str(final), "sha256": sha256_file(final), "bytes": final.stat().st_size, "outtype": outtype, "quant": quant,
           "header": hdr, "source_export": str(src), "source_files": src_manifest["files"], "source_post_merge_eval": src_manifest.get("post_merge_eval"),
           "converter": {"dir": tools["dir"], "commit": tools["commit"]}, "imatrix": imx, "created_at": utcnow(), "installed": None, "lmstudio_check": None,
           "note": "Local copy for LM Studio. Quantization changes behaviour — run the LM Studio check. Not an approval for any use."}
    lms = spec.get("lmstudio_dir")
    if spec.get("install") and lms:
        dest = Path(lms) / "forge" / name / final.name
        if dest.exists():
            raise GGUFError(f"{dest} already exists in LM Studio's folder")
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(final, dest)
        man["installed"] = {"path": str(dest), "lmstudio_id_hint": f"forge/{name}"}
    write_json_atomic(final.with_suffix(".json"), json.dumps(man, indent=2))
    emit({"event": "gguf_done", "file": final.name, "bytes": man["bytes"], "tensors": hdr["tensors"], "file_type": hdr["file_type"], "installed": bool(man["installed"])})
    return man


def lmstudio_check(study: Any, manifest_path: Path, model_id: str, base_url: str, emit: Callable[[dict], None] = lambda e: None,
                   backend: Any = None) -> dict:
    """Run the sealed test tasks through the GGUF loaded in LM Studio; compare with the merged export."""
    from forge.engine.runtime import OpenAICompatBackend
    if not study.state["sealed"]:
        raise GGUFError("The study must be sealed")
    man = json.loads(manifest_path.read_text(encoding="utf-8"))
    # Arm names are path parts ([a-z0-9_] only): "gguf-…" was refused by the study's path guard, so this check never completed.
    arm = "gguf_" + re.sub(r"[^a-z0-9]+", "_", Path(man["file"]).stem.lower())[:34]
    seed = study.plan["seeds"][0]
    b = backend or OpenAICompatBackend(base_url.rstrip("/") + "/v1", model_id)
    study._evaluate(b, arm, "test", seed, study.tasks(), emit)
    g = {e["task_id"]: e["score"]["strict_success"] for e in study.episodes(arm, "test", seed)}
    m = {e["task_id"]: e["score"]["strict_success"] for e in study.episodes("merged", "test", seed)}
    agree = sum(g[t] == m.get(t) for t in g) / max(1, len(g))
    man["lmstudio_check"] = {"model_id": model_id, "split": "test", "tasks": len(g), "success": sum(g.values()) / max(1, len(g)),
                             "merged_success": (sum(m.values()) / len(m)) if m else None, "agreement_with_merged": agree, "at": utcnow()}
    write_json_atomic(manifest_path, json.dumps(man, indent=2))
    emit({"event": "gguf_checked", **man["lmstudio_check"]})
    return man["lmstudio_check"]


def list_exports(study: Any) -> list[dict]:
    d = study.root / "exports" / "gguf"
    out = []
    for p in sorted(d.glob("*.json")) if d.is_dir() else []:
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except (OSError, ValueError):
            continue
    return out
