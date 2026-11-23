"""Weight Lab: build new adapters from trained ones, exactly, and measure them.

A LoRA adapter changes each targeted weight matrix by ΔW = s · B A (s = alpha / r, or alpha / √r with rsLoRA).
Every operation here produces a *new* adapter; sources and base weights are never modified.

- weighted merge / seed averaging / task arithmetic:  ΔW = Σ wᵢ ΔWᵢ, built EXACTLY by stacking factors
  (A = [A₁; A₂; …], B = [w₁s₁B₁, w₂s₂B₂, …]) — no approximation. The merged rank is the sum of source ranks.
- strength:   ΔW ← k · ΔW   (k = 0 is the base model; k = 1 the adapter as trained; k > 1 amplifies)
- layers / module types: ΔW ← 0 outside the selected layers or modules (attention q/k/v/o, MLP gate/up/down)
- rank compression: best rank-k approximation of each ΔW (truncated SVD); reports the energy kept per module.

Variants live in FORGE_HOME/weightlab/<id>/ with recipe.json, the adapter, and evaluations (dev split only — the test split
stays reserved for sealed studies).
"""
from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any, Callable

from forge.util import new_id, sha256_file, utcnow, write_json_atomic

ATTENTION = ("q_proj", "k_proj", "v_proj", "o_proj")
MLP = ("gate_proj", "up_proj", "down_proj")
LAYER = re.compile(r"\.layers\.(\d+)\.")


class WeightLabError(ValueError):
    pass


def _scaling(cfg: dict) -> float:
    r, a = float(cfg["r"]), float(cfg["lora_alpha"])
    return a / math.sqrt(r) if cfg.get("use_rslora") else a / r


def _load(adapter_dir: Path) -> tuple[dict, dict[str, Any]]:
    from safetensors.torch import load_file
    cfg = json.loads((adapter_dir / "adapter_config.json").read_text(encoding="utf-8"))
    if cfg.get("rank_pattern") or cfg.get("alpha_pattern"):
        raise WeightLabError(f"{adapter_dir.name}: per-module rank/alpha patterns are not supported")
    if cfg.get("peft_type", "LORA") != "LORA":
        raise WeightLabError("Only LoRA adapters can be combined")
    return cfg, load_file(str(adapter_dir / "adapter_model.safetensors"))


def _modules(tensors: dict) -> dict[str, tuple[Any, Any]]:
    """module prefix → (A, B)."""
    out: dict[str, list] = {}
    for k, v in tensors.items():
        if k.endswith(".lora_A.weight"):
            out.setdefault(k[: -len(".lora_A.weight")], [None, None])[0] = v
        elif k.endswith(".lora_B.weight"):
            out.setdefault(k[: -len(".lora_B.weight")], [None, None])[1] = v
    bad = [m for m, (a, b) in out.items() if a is None or b is None]
    if bad:
        raise WeightLabError(f"Incomplete LoRA pair for {bad[0]}")
    return {m: (a, b) for m, (a, b) in out.items()}


def module_kind(name: str) -> str:
    leaf = name.rsplit(".", 1)[-1]
    return "attention" if leaf in ATTENTION else "mlp" if leaf in MLP else "other"


def layer_of(name: str) -> int | None:
    m = LAYER.search(name + ".")
    return int(m.group(1)) if m else None


def build(sources: list[dict], out_dir: Path, *, strength: float = 1.0, layers: tuple[int, int] | None = None,
          modules: str = "all", rank: int | None = None) -> dict[str, Any]:
    """sources: [{"adapter": Path, "weight": float, "label": str}]. Writes out_dir/adapter and returns a report."""
    import torch
    from safetensors.torch import save_file
    if not sources:
        raise WeightLabError("Choose at least one source adapter")
    if modules not in ("all", "attention", "mlp"):
        raise WeightLabError("modules must be all, attention or mlp")
    loaded = [(_load(Path(s["adapter"])), float(s.get("weight", 1.0))) for s in sources]
    base_cfg = loaded[0][0][0]
    names = sorted({m for (cfg, t), _ in loaded for m in _modules(t)})
    A_out: dict[str, Any] = {}
    B_out: dict[str, Any] = {}
    kept: dict[str, float] = {}
    dtype = next(iter(loaded[0][0][1].values())).dtype
    for name in names:
        As, Bs, shape = [], [], None
        for (cfg, t), w in loaded:
            mods = _modules(t)
            if name in mods:
                a, b = mods[name]
                shape = (a.shape[1], b.shape[0])
        for (cfg, t), w in loaded:
            mods = _modules(t)
            if name in mods:
                a, b = mods[name]
                As.append(a.float())
                Bs.append(b.float() * (w * _scaling(cfg)))
            else:  # this source did not adapt the module: contributes zero
                r = int(cfg["r"])
                As.append(torch.zeros(r, shape[0]))
                Bs.append(torch.zeros(shape[1], r))
        A, B = torch.cat(As, 0), torch.cat(Bs, 1)
        lay = layer_of(name)
        masked = (layers is not None and (lay is None or not layers[0] <= lay <= layers[1])) or \
                 (modules != "all" and module_kind(name) != modules)
        B = B * (0.0 if masked else strength)
        A_out[name], B_out[name] = A, B
    total_rank = next(iter(A_out.values())).shape[0]
    if rank is not None:
        if not 1 <= rank <= total_rank:
            raise WeightLabError(f"rank must be between 1 and {total_rank}")
        for name in names:
            dW = B_out[name] @ A_out[name]
            U, S, Vh = torch.linalg.svd(dW, full_matrices=False)
            energy = float((S ** 2).sum())
            kept[name] = float((S[:rank] ** 2).sum()) / energy if energy > 0 else 1.0
            B_out[name] = U[:, :rank] * S[:rank]
            A_out[name] = Vh[:rank]
        total_rank = rank
    tensors = {}
    for name in names:
        tensors[f"{name}.lora_A.weight"] = A_out[name].to(dtype).contiguous()
        tensors[f"{name}.lora_B.weight"] = B_out[name].to(dtype).contiguous()
    ad = out_dir / "adapter"
    ad.mkdir(parents=True, exist_ok=True)
    save_file(tensors, str(ad / "adapter_model.safetensors"))
    cfg = {**base_cfg, "r": total_rank, "lora_alpha": total_rank, "use_rslora": False, "lora_dropout": 0.0, "rank_pattern": {},
           "alpha_pattern": {}, "inference_mode": True,
           "target_modules": sorted({m.split("base_model.model.", 1)[-1] for m in names})}
    (ad / "adapter_config.json").write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    norms = {name: float((B_out[name] @ A_out[name]).norm()) for name in names}
    return {"modules": len(names), "rank": total_rank, "masked_modules": sum(1 for n in names if norms[n] == 0.0),
            "delta_norm_total": sum(norms.values()), "rank_energy_kept": (sum(kept.values()) / len(kept)) if kept else None,
            "adapter_sha256": sha256_file(ad / "adapter_model.safetensors"),
            "size_bytes": (ad / "adapter_model.safetensors").stat().st_size,
            "layers_seen": sorted({x for x in (layer_of(n) for n in names) if x is not None})}


# ------------------------------------------------------------------ variants on disk
class Variant:
    def __init__(self, root: Path):
        self.root = root
        if not (root / "recipe.json").exists():
            raise WeightLabError(f"No variant at {root}")

    @property
    def recipe(self) -> dict:
        return json.loads((self.root / "recipe.json").read_text(encoding="utf-8"))

    @property
    def adapter(self) -> Path:
        return self.root / "adapter"

    def evaluations(self) -> dict[str, Any]:
        d = self.root / "eval"
        return {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted(d.glob("*.json"))} if d.is_dir() else {}

    def summary(self) -> dict:
        return {**self.recipe, "built": (self.adapter / "adapter_model.safetensors").exists(), "evaluations": self.evaluations()}


def create_variant(base: Path, name: str, recipe: dict) -> Variant:
    vid = new_id("var")
    root = base / vid
    root.mkdir(parents=True)
    write_json_atomic(root / "recipe.json", json.dumps({"id": vid, "name": name, "created_at": utcnow(), **recipe, "status": "pending"}, indent=2))
    return Variant(root)


def run_build(v: Variant, emit: Callable[[dict], None] = lambda e: None) -> dict:
    r = v.recipe
    emit({"event": "weightlab_build", "variant": r["id"], "sources": len(r["sources"])})
    report = build([{"adapter": Path(s["adapter"]), "weight": s["weight"]} for s in r["sources"]], v.root,
                   strength=float(r.get("strength", 1.0)), layers=tuple(r["layers"]) if r.get("layers") else None,
                   modules=r.get("modules", "all"), rank=r.get("rank"))
    r |= {"status": "built", "report": report, "built_at": utcnow()}
    write_json_atomic(v.root / "recipe.json", json.dumps(r, indent=2))
    emit({"event": "weightlab_built", "variant": r["id"], **{k: report[k] for k in ("modules", "rank", "masked_modules")}})
    return report


def evaluate(v: Variant, study: Any, emit: Callable[[dict], None] = lambda e: None, factory: Callable | None = None) -> dict:
    """Run the study's DEV tasks with the variant adapter and compare with the study's base and tuned students."""
    from forge.engine.runtime import EpisodeConfig, TransformersBackend, run_episode
    from forge.engine.study import read_jsonl
    r = v.recipe
    if r.get("base_hash") and study.plan.get("base_hash") and r["base_hash"] != study.plan["base_hash"]:
        raise WeightLabError("This variant was built for a different student model than the study's")
    tasks = [t for t in study.tasks() if t.split == "dev"]
    if not tasks:
        raise WeightLabError("The study has no dev tasks")
    world = study.world()
    backend = factory(v.adapter) if factory else TransformersBackend(study.plan["student"]["path"], str(v.adapter), device=study.plan["device"],
                                                                     max_new_tokens=study.plan["eval"]["max_new_tokens"])
    cfg = EpisodeConfig(max_turns=study.plan["eval"]["max_turns"])
    eps = []
    for i, t in enumerate(tasks, 1):
        ep = run_episode(t, backend, world, cfg, arm=f"variant:{r['id']}", seed=0)
        if ep["termination"] == "backend_error":
            raise WeightLabError(f"backend error on {t.task_id}")
        eps.append(ep)
        emit({"event": "episode", "arm": "variant", "split": "dev", "seed": 0, "task_id": t.task_id,
              "strict_success": ep["score"]["strict_success"], "progress": f"{i}/{len(tasks)}"})
    getattr(backend, "unload", lambda: None)()

    def rates(episodes: list[dict]) -> dict:
        fam: dict[str, list[float]] = {}
        for e in episodes:
            fam.setdefault(e["family"], []).append(float(e["score"]["strict_success"]))
        allv = [x for v_ in fam.values() for x in v_]
        return {"overall": sum(allv) / len(allv) if allv else None, "n": len(allv), "per_skill": {f: sum(v_) / len(v_) for f, v_ in sorted(fam.items())}}

    def study_eps(arm: str, seed: int) -> list[dict]:
        p = study.episode_path(arm, "dev", seed)
        return read_jsonl(p, verify=False) if p.exists() else []
    arm0, seed0 = study.plan["arms"][0], study.plan["seeds"][0]
    out = {"study_id": study.plan["study_id"], "study_name": study.plan["name"], "split": "dev", "generated_at": utcnow(),
           "variant": rates(eps), "base": rates(study_eps("base", study.plan["eval"]["control_seed_broadcast"])),
           "tuned": rates(study_eps(arm0, seed0)) | {"arm": arm0, "seed": seed0}, "teacher": rates(study_eps("teacher", 0)),
           "invalid_rate": sum(1 for e in eps if e["score"]["invalid_calls"]) / len(eps)}
    (v.root / "eval").mkdir(exist_ok=True)
    (v.root / "eval" / f"{study.plan['study_id']}.jsonl").write_text("".join(json.dumps(e) + "\n" for e in eps), encoding="utf-8")
    write_json_atomic(v.root / "eval" / f"{study.plan['study_id']}.json", json.dumps(out, indent=2))
    emit({"event": "weightlab_evaluated", "variant": r["id"], "overall": out["variant"]["overall"]})
    return out
