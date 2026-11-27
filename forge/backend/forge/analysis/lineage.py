"""Base-model lineage and layer layout, read from the files on disk — never from the network.

layer_types(model_dir)
    Which attention each decoder layer uses. OLMo 3 (and Gemma 3) mix *sliding-window* layers (each token attends to the most
    recent `sliding_window` tokens) with *full-attention* layers; the config's `layer_types` lists them. A config with
    `use_sliding_window: false` (Qwen3) is all full attention. None when the config does not say.

by_layer_type(inspection, types)
    How much training changed each layer type: √Σ‖ΔW‖² over its modules, share of the total, mean relative change.

model_lineage(model_dir, name)
    What the base model's publisher *declares* in its model card front matter (licence, base model, training datasets, languages)
    plus what FORGE verified itself (architecture, exact snapshot revision, weight files and their sizes). Declared fields are
    labelled as declared: FORGE does not check that a listed dataset is what the model was really trained on.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

# What some publishers make public beyond weights (from their published announcements); shown as "declared by the publisher".
PUBLISHED = {
    "allenai": {"publisher": "Allen Institute for AI (AI2)", "open": ["weights", "training data", "training code", "intermediate checkpoints", "post-training data and recipes"],
                "note": "OLMo models are released with their pretraining and post-training data, code and checkpoints; see the model card's links."},
    "qwen": {"publisher": "Qwen team (Alibaba)", "open": ["weights"], "note": "Open weights; training data is not published."},
}


def _cfg(model_dir: Path) -> dict[str, Any]:
    try:
        c = json.loads((Path(model_dir) / "config.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return c.get("text_config") or c


def layer_types(model_dir: Path | str | None) -> dict[str, Any] | None:
    if not model_dir:
        return None
    c = _cfg(Path(model_dir))
    n = c.get("num_hidden_layers")
    types = c.get("layer_types")
    if not types and c.get("use_sliding_window") is False and n:
        types = ["full_attention"] * n
    if not types:
        return None
    short = ["sliding" if "sliding" in t else "full" if "full" in t else t for t in types]
    ns, nf = short.count("sliding"), short.count("full")
    pattern = "all full attention" if not ns else f"{ns} sliding-window : {nf} full-attention layers"
    return {"types": short, "sliding_window": c.get("sliding_window") if ns else None, "pattern": pattern, "mixed": bool(ns and nf)}


def by_layer_type(inspection: dict[str, Any], lt: dict[str, Any] | None) -> list[dict[str, Any]] | None:
    if not lt or not lt.get("mixed"):
        return None
    agg: dict[str, dict[str, float]] = {}
    for m in inspection.get("modules", []):
        L = m.get("layer")
        if L is None or L >= len(lt["types"]):
            continue
        a = agg.setdefault(lt["types"][L], {"sq": 0.0, "n": 0, "rel": 0.0, "nrel": 0, "layers": set()})
        a["sq"] += m["delta_fro"] ** 2
        a["n"] += 1
        a["layers"].add(L)
        if m.get("relative_change") is not None:
            a["rel"] += m["relative_change"]
            a["nrel"] += 1
    tot = sum(a["sq"] for a in agg.values()) or 1.0
    return [{"type": t, "layers": len(a["layers"]), "modules": a["n"], "delta_fro": a["sq"] ** 0.5, "share_of_change": a["sq"] / tot,
             "share_of_layers": len(a["layers"]) / len(lt["types"]), "mean_relative_change": (a["rel"] / a["nrel"]) if a["nrel"] else None}
            for t, a in sorted(agg.items())]


def _front_matter(readme: Path) -> dict[str, Any]:
    """Minimal YAML front-matter reader for model cards: scalars and simple lists (no YAML dependency)."""
    try:
        txt = readme.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {}
    m = re.match(r"^---\s*\n(.*?)\n---", txt, re.S)
    if not m:
        return {}
    out: dict[str, Any] = {}
    key = None
    for line in m.group(1).splitlines():
        if re.match(r"^\s*-\s+", line) and key:
            v = re.sub(r"^\s*-\s+", "", line).strip().strip("'\"")
            if not isinstance(out.get(key), list):
                out[key] = [] if out.get(key) in (None, "") else [out[key]]
            out[key].append(v)
            continue
        km = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", line)
        if km:
            key, v = km.group(1), km.group(2).strip()
            if v.startswith("[") and v.endswith("]"):
                out[key] = [x.strip().strip("'\"") for x in v[1:-1].split(",") if x.strip()]
            else:
                out[key] = v.strip("'\"")
    return out


def model_lineage(model_dir: Path | str | None, name: str | None = None) -> dict[str, Any] | None:
    if not model_dir or not Path(model_dir).is_dir():
        return None
    d = Path(model_dir)
    raw = {}
    try:
        raw = json.loads((d / "config.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    fm = _front_matter(d / "README.md")
    snap = d.name if d.parent.name == "snapshots" else None
    repo = name or (d.parent.parent.name.removeprefix("models--").replace("--", "/") if snap else d.name)
    org = repo.split("/")[0].lower() if "/" in repo else ""
    weights = sorted(d.glob("*.safetensors"))
    as_list = lambda v: v if isinstance(v, list) else ([v] if v else [])
    pub = next((v for k, v in PUBLISHED.items() if org.startswith(k)), None)
    return {
        "repo": repo, "revision": snap,
        "verified": {"architecture": (raw.get("architectures") or [None])[0], "model_type": raw.get("model_type"),
                     "weight_files": len(weights), "weight_bytes": sum(p.stat().st_size for p in weights),
                     "layers": layer_types(d)},
        "declared": {"license": fm.get("license"), "base_model": as_list(fm.get("base_model")), "datasets": as_list(fm.get("datasets")),
                     "language": as_list(fm.get("language")), "has_model_card": (d / "README.md").exists()},
        "publisher": pub,
        "note": "Declared fields come from the model card the publisher ships with the weights; FORGE has not verified them. "
                "Verified fields were read from the files FORGE trained on.",
    }
