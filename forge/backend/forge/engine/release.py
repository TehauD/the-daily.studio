"""Human decisions and release bundles.

Sign-off: FORGE records a PERSON's decision about a sealed study's model — who, in what role, which decision, for what
purpose, why, under which conditions — pinned to the exact plan, adapter and result it was made on. FORGE makes no decision
and endorses none; it keeps the record.

Release bundle: one zip with everything a reviewer or deployment team needs to see what was decided and reproduce it —
adapter, model card (Markdown + JSON), reports, analyses, plan, sign-offs, GGUF manifests (not the large GGUF files; their
paths and hashes are listed), and a SHA-256 manifest of every file.
"""
from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path
from typing import Any

from forge.util import utcnow

DECISIONS = {"approved_pilot": "Approved for a supervised pilot", "approved_evaluation": "Approved for further evaluation only",
             "changes_needed": "Changes needed before reconsideration", "rejected": "Rejected"}


class ReleaseError(ValueError):
    pass


def _sha(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def signoffs(study: Any) -> list[dict]:
    p = study.root / "signoffs.jsonl"
    return [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x.strip()] if p.exists() else []


def sign_off(study: Any, decision: str, reviewer: str, role: str, purpose: str, rationale: str, conditions: str = "") -> dict:
    if decision not in DECISIONS:
        raise ReleaseError("Unknown decision")
    if not reviewer or reviewer == "unnamed":
        raise ReleaseError("Set your name first (it is recorded with the decision)")
    if len(rationale.strip()) < 20:
        raise ReleaseError("Write the rationale (at least a sentence)")
    approving = decision.startswith("approved")
    st = study.state["stages"]
    if approving and not (study.state["sealed"] and st.get("analyze_test", {}).get("status") == "completed"):
        raise ReleaseError("An approval can only be recorded on a sealed study with the final test analysed")
    arm, seed = study.plan["arms"][0], study.plan["seeds"][0]
    ad = study.run_dir(arm, seed) / "adapter" / "adapter_model.safetensors"
    rep = study.summary()["reports"].get("test", {})
    t = (rep.get("splits") or {}).get("test") or {}
    a = (t.get("arms") or {}).get(arm) or {}
    rec = {"at": utcnow(), "decision": decision, "decision_label": DECISIONS[decision], "reviewer": reviewer, "role": role.strip()[:80],
           "purpose": purpose.strip()[:400], "rationale": rationale.strip()[:2000], "conditions": conditions.strip()[:1000],
           "pinned": {"study_id": study.plan["study_id"], "plan_sha256": (study.root / "plan.sha256").read_text(encoding="utf-8").strip(),
                      "adapter": f"{arm} seed {seed}", "adapter_sha256": _sha(ad) if ad.exists() else None,
                      "final_test": {"trained": a.get("arm_rate"), "untrained": t.get("base_rate"), "gain": a.get("mean"),
                                     "ci": [a.get("ci_low"), a.get("ci_high")], "gate": rep.get("gate", {}).get("verdict")} if t else None},
           "note": "Recorded by FORGE; the decision is the reviewer's. FORGE does not approve models."}
    with open(study.root / "signoffs.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return rec


def build_bundle(study: Any, report_html: dict[str, str], card_md: str, card_json: dict) -> Path:
    st = study.state["stages"]
    if not (study.state["sealed"] and st.get("analyze_test", {}).get("status") == "completed"):
        raise ReleaseError("Seal the study and analyse the final test first: a release bundle documents a confirmatory result")
    arm, seed = study.plan["arms"][0], study.plan["seeds"][0]
    ad = study.run_dir(arm, seed) / "adapter"
    if not (ad / "adapter_model.safetensors").exists():
        raise ReleaseError("No trained adapter")
    out_dir = study.root / "releases"
    out_dir.mkdir(exist_ok=True)
    name = f"forge-release-{study.plan['study_id']}-{utcnow()[:19].replace(':', '').replace('-', '')}"
    path = out_dir / f"{name}.zip"
    files: list[tuple[str, bytes | Path]] = []
    for f in sorted(ad.iterdir()):
        if f.is_file():
            files.append((f"adapter/{f.name}", f))
    files += [("model-card.md", card_md.encode()), ("model-card.json", json.dumps(card_json, indent=2).encode()),
              ("plan.json", study.root / "plan.json"), ("plan.sha256", study.root / "plan.sha256")]
    for k in ("dev", "test"):
        p = study.root / "reports" / f"analysis_{k}.json"
        if p.exists():
            files.append((f"reports/analysis_{k}.json", p))
    for aud, html in report_html.items():
        files.append((f"reports/{aud}-report.html", html.encode()))
    if (study.root / "signoffs.jsonl").exists():
        files.append(("decisions/signoffs.jsonl", study.root / "signoffs.jsonl"))
    g = study.root / "exports" / "gguf"
    for p in sorted(g.glob("*.json")) if g.is_dir() else []:
        files.append((f"exports/{p.name}", p))
    merged = next((p for p in (study.root / "exports").glob("*-merged/forge_export.json")), None) if (study.root / "exports").is_dir() else None
    if merged:
        files.append(("exports/merged-export-manifest.json", merged))
    manifest = {"bundle": name, "created_at": utcnow(), "study_id": study.plan["study_id"], "study": study.plan["name"],
                "decisions": [{k: s[k] for k in ("at", "decision_label", "reviewer", "role", "purpose")} for s in signoffs(study)],
                "files": {}, "note": "GGUF and merged weights are not included (size); their manifests list paths and SHA-256. "
                                     "Nothing in this bundle is an approval by FORGE; decisions are the reviewers'."}
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for arc, src in files:
            data = src.read_bytes() if isinstance(src, Path) else src
            z.writestr(f"{name}/{arc}", data)
            manifest["files"][arc] = {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
        z.writestr(f"{name}/MANIFEST.json", json.dumps(manifest, indent=2))
    return path


def bundles(study: Any) -> list[dict]:
    d = study.root / "releases"
    return [{"name": p.name, "bytes": p.stat().st_size, "sha256": _sha(p)} for p in sorted(d.glob("*.zip"), reverse=True)] if d.is_dir() else []
