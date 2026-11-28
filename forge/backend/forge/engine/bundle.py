"""Reproducibility bundle: everything someone else needs to check a study's numbers, in one hashed zip.

Contents (paths inside the zip mirror the study folder):
  plan.json, plan.sha256      the frozen plan (design, seeds, arms, power analysis, baselines) and its hash
  tasks.jsonl                 every task with its split; seal.json (adapter hashes at SEAL); state.json (stage history)
  episodes/                   every recorded episode — the raw measurements all statistics are computed from
  reports/                    the study's analyses, evidence inputs, forgetting check, few-shot examples
  datasets/*/records.jsonl    the training records (synthetic) each arm was trained on, with exclusions
  runs/<arm>/seed<n>/         run.json, training.jsonl and the adapter config; adapter WEIGHTS only with include_adapters
  quant/*/manifest.json       quantized variants: method, settings, calibration hash, per-layer error
  agent_snapshot/             the frozen agent (agent studies)
  BUNDLE.json                 FORGE version, engine source hash, environment, sha256 of every file above

`verify` re-checks every hash, the plan hash, and then *recomputes* each analysis from the raw episodes with FORGE's own
statistics (seeded, deterministic) and compares it with the stored report. It does not re-train: reproducing training needs
the base model, the same hardware class and the same library versions (recorded in each run.json).
Synthetic tasks only — the bundle contains no patient data unless the study's tasks did, which FORGE does not allow by default.
"""
from __future__ import annotations

import hashlib
import json
import math
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from forge import __version__
from forge.util import utcnow

INCLUDE_TOP = ("plan.json", "plan.sha256", "tasks.jsonl", "seal.json", "state.json")
INCLUDE_DIRS = ("episodes", "reports", "agent_snapshot")
RUN_FILES = ("run.json", "training.jsonl", "inspection.json", "adapter/adapter_config.json")
KEYS = ("mean", "ci_low", "ci_high", "arm_rate", "control_rate")


def _sha(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def files(study: Any, include_adapters: bool = False) -> list[Path]:
    r = study.root
    out = [r / n for n in INCLUDE_TOP if (r / n).exists()]
    for d in INCLUDE_DIRS:
        if (r / d).is_dir():
            out += sorted(p for p in (r / d).rglob("*") if p.is_file())
    if (r / "datasets").is_dir():
        out += sorted(p for p in (r / "datasets").rglob("*") if p.is_file() and p.suffix in (".jsonl", ".json"))
    if (r / "runs").is_dir():
        for sd in sorted((r / "runs").glob("*/seed*")):
            out += [sd / n for n in RUN_FILES if (sd / n).exists()]
            if include_adapters and (sd / "adapter" / "adapter_model.safetensors").exists():
                out.append(sd / "adapter" / "adapter_model.safetensors")
    if (r / "quant").is_dir():
        out += sorted(p for p in (r / "quant").glob("*/manifest.json"))
    return out


def export(study: Any, out_dir: Path | None = None, include_adapters: bool = False) -> dict[str, Any]:
    """Holds the study lock while reading, so a running job cannot change a file between hashing and zipping."""
    from forge.engine.study import StudyLock
    with StudyLock(study.root / ".lock"):
        return _export(study, out_dir, include_adapters)


def _export(study: Any, out_dir: Path | None, include_adapters: bool) -> dict[str, Any]:
    root = study.root
    fs = files(study, include_adapters)
    hashes = {str(p.relative_to(root)).replace("\\", "/"): _sha(p) for p in fs}
    meta = {"format": "forge-bundle-1", "made_at": utcnow(), "forge_version": __version__, "study_id": study.plan["study_id"],
            "name": study.plan["name"], "plan_sha256": (root / "plan.sha256").read_text(encoding="utf-8").strip(),
            "engine_source_sha256": study.plan.get("engine_source_sha256"), "environment": study.plan.get("environment"),
            "sealed": bool(study.state.get("sealed")), "include_adapters": include_adapters, "files": hashes,
            "verify": "python -m forge.engine bundle --verify <this zip>   (or History → Reproducibility bundle → Verify)",
            "limits": "Re-analysis from raw episodes is exact; re-training is not part of verification."}
    out_dir = out_dir or (root / "bundles")
    out_dir.mkdir(parents=True, exist_ok=True)
    zp = out_dir / f"{study.plan['study_id']}-{meta['made_at'][:19].replace(':', '').replace('-', '')}.zip"
    with zipfile.ZipFile(zp, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for p in fs:
            z.write(p, str(p.relative_to(root)).replace("\\", "/"))
        z.writestr("BUNDLE.json", json.dumps(meta, indent=2))
    return {"path": str(zp), "files": len(fs), "bytes": zp.stat().st_size, "sha256": _sha(zp), "bundle": {k: v for k, v in meta.items() if k != "files"}}


def _close(a: Any, b: Any, tol: float = 1e-9) -> bool:
    if a is None or b is None:
        return a is None and b is None
    return math.isclose(float(a), float(b), rel_tol=tol, abs_tol=tol)


def verify(zip_path: str | Path) -> dict[str, Any]:
    from forge.engine.study import Study, StudyError
    zp = Path(zip_path)
    checks: list[dict[str, Any]] = []
    with zipfile.ZipFile(zp) as z:
        names = set(z.namelist())
        if "BUNDLE.json" not in names:
            return {"ok": False, "checks": [{"check": "bundle", "ok": False, "detail": "BUNDLE.json missing: not a FORGE bundle"}]}
        meta = json.loads(z.read("BUNDLE.json"))
        for n in names:  # zip-slip guard: only plain relative paths
            if n.startswith("/") or ".." in Path(n).parts:
                return {"ok": False, "checks": [{"check": "paths", "ok": False, "detail": f"unsafe path {n}"}]}
        bad = [n for n, h in meta["files"].items() if n not in names or hashlib.sha256(z.read(n)).hexdigest() != h]
        extra = sorted(names - set(meta["files"]) - {"BUNDLE.json"})
        checks.append({"check": "file hashes", "ok": not bad and not extra, "detail": f"{len(meta['files'])} files" + (f"; mismatched {bad[:5]}" if bad else "") + (f"; unlisted {extra[:5]}" if extra else "")})
        with tempfile.TemporaryDirectory() as td:
            z.extractall(td)
            root = Path(td)
            try:
                s = Study(root)
                checks.append({"check": "frozen plan hash", "ok": True, "detail": meta["plan_sha256"][:16]})
            except StudyError as e:
                checks.append({"check": "frozen plan hash", "ok": False, "detail": str(e)})
                return {"ok": False, "bundle": {k: v for k, v in meta.items() if k != "files"}, "checks": checks}
            for rp in sorted((root / "reports").glob("analysis_*.json")):
                stored = json.loads(rp.read_text(encoding="utf-8"))
                splits = tuple(stored.get("splits", {}))
                if not splits:
                    continue
                try:
                    fresh = s.analyze(splits)
                except (StudyError, ValueError, KeyError) as e:   # e.g. an episode line whose own hash no longer matches
                    checks.append({"check": f"recompute {rp.name}", "ok": False, "detail": f"raw episodes unreadable: {e}"})
                    continue
                diffs = []
                for sp, sec in stored["splits"].items():
                    for arm, c in (sec.get("arms") or {}).items():
                        f = (fresh["splits"].get(sp, {}).get("arms") or {}).get(arm)
                        if f is None:
                            diffs.append(f"{sp}/{arm}: missing on recompute")
                            continue
                        for k in KEYS:
                            if not _close(c.get(k), f.get(k)):
                                diffs.append(f"{sp}/{arm}.{k}: stored {c.get(k)} vs recomputed {f.get(k)}")
                        for t in ("sign_flip_groups", "sign_flip_seeds"):
                            if not _close((c.get(t) or {}).get("p"), (f.get(t) or {}).get("p")):
                                diffs.append(f"{sp}/{arm}.{t}.p differs")
                checks.append({"check": f"recompute {rp.name}", "ok": not diffs, "detail": "; ".join(diffs[:6]) or f"{len(splits)} split(s): gains, ranges and p-values match"})
            if meta.get("sealed"):
                seal = root / "seal.json"
                checks.append({"check": "seal record", "ok": seal.exists(), "detail": "adapter hashes recorded at SEAL" if seal.exists() else "seal.json missing"})
    return {"ok": all(c["ok"] for c in checks), "bundle": {k: v for k, v in meta.items() if k != "files"}, "checks": checks, "verified_at": utcnow()}
