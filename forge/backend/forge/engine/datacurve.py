""""How much data do I need?" — train on nested shares of the training set and measure each on the dev tasks.

For shares 10 / 25 / 50 / 100 % of the study's training tasks (whole tasks, chosen by a fixed hash so every smaller set is
contained in every larger one), FORGE trains one adapter with the study's own settings and seed, then runs the dev tasks.
The 100 % point re-uses the study's trained adapter and dev results when they exist. If the curve is still climbing at
100 %, more examples are likely to help; if it is flat from 50 %, effort is better spent elsewhere (skills, tools, review).

Honest limits: one seed per point, so small differences are noise — each point carries a 95 % Wilson interval over dev
tasks. Dev only (decision support); the sealed test set is never touched. Adapters live in the study's `datacurve/`
folder and never replace the study's own results.
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

from forge.util import sha256_text, utcnow, write_json_atomic

FRACTIONS = (0.1, 0.25, 0.5, 1.0)


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float] | None:
    if not n:
        return None
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return max(0.0, c - h), min(1.0, c + h)


def subset(records: list[dict], frac: float, seed: int) -> list[dict]:
    """Whole tasks, nested: the tasks ranked by hash(seed, task); take the first ceil(frac × n)."""
    ids = sorted({r["task_id"] for r in records}, key=lambda t: sha256_text(f"curve:{seed}:{t}"))
    keep = set(ids[: max(1, math.ceil(frac * len(ids)))])
    return [r for r in records if r["task_id"] in keep]


def _dir(study: Any, frac: float) -> Path:
    return study.root / "datacurve" / f"p{int(round(frac * 100)):03d}"


def train_point(study: Any, frac: float, emit: Callable[[dict], None]) -> dict:
    from forge.engine.study import TRAIN_ARMS
    from forge.engine.train import TrainConfig, train_lora
    arm, seed = study.plan["arms"][0], study.plan["seeds"][0]
    records = [json.loads(x) for x in (study.root / "datasets" / arm / "records.jsonl").read_text(encoding="utf-8").splitlines() if x]
    sub = subset(records, frac, seed)
    params = {**study.plan["train"], **TRAIN_ARMS[arm]["train"]}
    cfg = TrainConfig(model_path=study.plan["student"]["path"], records=sub, output_dir=str(_dir(study, frac)), seed=seed,
                      eval_records=study._dev_records(), teacher_endpoint=study.plan["teacher"].get("endpoint"), device=study.plan["device"],
                      **{k: v for k, v in params.items() if k in TrainConfig.__dataclass_fields__})
    return train_lora(cfg, emit=emit)


def _train_child(study: Any, frac: float) -> None:
    argv = [sys.executable, "-m", "forge.engine", "datacurve", "--study", str(study.root), "--train-fraction", str(frac)]
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    from forge.engine import guard
    sys.stdout.flush()
    with guard.suspended(), subprocess.Popen(argv, cwd=Path(__file__).resolve().parents[2], stdout=subprocess.PIPE, env=env,
                                             creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)) as proc:
        assert proc.stdout is not None
        for raw in proc.stdout:
            sys.stdout.write(raw.decode("utf-8", errors="replace"))
            sys.stdout.flush()
        code = proc.wait()
    if code != 0 or not (_dir(study, frac) / "run.json").exists():
        raise RuntimeError(f"Training the {int(frac * 100)}% point failed (exit {code}); see the log above")


def _rates(eps: list[dict]) -> dict:
    n = len(eps)
    k = sum(1 for e in eps if e["score"]["strict_success"])
    fam: dict[str, list[int]] = {}
    for e in eps:
        fam.setdefault(e["family"], []).append(int(e["score"]["strict_success"]))
    return {"success": k / n if n else None, "n": n, "ci": wilson(k, n), "per_skill": {f: sum(v) / len(v) for f, v in sorted(fam.items())}}


def run(study: Any, fractions: tuple[float, ...] = FRACTIONS, emit: Callable[[dict], None] = lambda e: None,
        factory: Callable | None = None) -> dict:
    from forge.engine.study import append_jsonl, read_jsonl
    if study.state["stages"].get("build", {}).get("status") != "completed":
        raise RuntimeError("Run Build first: the curve samples the study's training set")
    arm, seed = study.plan["arms"][0], study.plan["seeds"][0]
    records = [json.loads(x) for x in (study.root / "datasets" / arm / "records.jsonl").read_text(encoding="utf-8").splitlines() if x]
    n_tasks = len({r["task_id"] for r in records})
    dev = [t for t in study.tasks() if t.split == "dev"]
    points = []
    for frac in sorted(fractions):
        d = _dir(study, frac)
        main = frac >= 1.0 and (study.run_dir(arm, seed) / "adapter" / "adapter_model.safetensors").exists()
        adapter = study.run_dir(arm, seed) / "adapter" if main else d / "adapter"
        sub = subset(records, frac, seed)
        if not main and not (d / "run.json").exists():
            emit({"event": "datacurve_train", "share": frac, "records": len(sub), "tasks": len({r["task_id"] for r in sub})})
            if study._isolate_runs():
                _train_child(study, frac)
            else:
                train_point(study, frac, emit)
        own = study.episode_path(arm, "dev", seed)
        reuse = main and own.exists() and {t.task_id for t in dev} <= {e["task_id"] for e in read_jsonl(own, verify=False)}
        eps_path = own if reuse else d / "dev.jsonl"  # the study's own episodes are only ever read, never appended to
        d.mkdir(parents=True, exist_ok=True)
        have = {e["task_id"] for e in read_jsonl(eps_path, verify=False)} if eps_path.exists() else set()
        todo = [t for t in dev if t.task_id not in have]
        if todo:
            from forge.engine import guard
            from forge.engine.runtime import EpisodeConfig, run_episode
            backend = study._student(factory, adapter)
            world, cfg = study.world(), EpisodeConfig(max_turns=study.plan["eval"]["max_turns"])
            for i, t in enumerate(todo, 1):
                guard.check()
                ep = run_episode(t, backend, world, cfg, arm=f"curve:{frac}", seed=seed)
                if ep["termination"] == "backend_error":
                    raise RuntimeError(f"model error on {t.task_id}")
                append_jsonl(eps_path, ep)
                emit({"event": "episode", "arm": f"{int(frac * 100)}% data", "split": "dev", "seed": seed, "task_id": t.task_id,
                      "strict_success": ep["score"]["strict_success"], "progress": f"{len(have) + i}/{len(dev)}"})
            getattr(backend, "unload", lambda: None)()
        eps = [e for e in read_jsonl(eps_path, verify=False) if e["split"] == "dev"]
        run_json = json.loads(((study.run_dir(arm, seed) if main else d) / "run.json").read_text(encoding="utf-8"))
        points.append({"share": frac, "tasks": len({r["task_id"] for r in sub}), "records": len(sub),
                       "steps": run_json.get("global_step"), "reused_study_adapter": main, **_rates(eps)})
        emit({"event": "datacurve_point", "share": frac, "success": points[-1]["success"]})

    def ref(a: str, s: int) -> dict | None:
        p = study.episode_path(a, "dev", s)
        return _rates(read_jsonl(p, verify=False)) if p.exists() else None
    out = {"computed": True, "generated_at": utcnow(), "arm": arm, "seed": seed, "train_tasks": n_tasks, "dev_tasks": len(dev),
           "points": points, "base": ref("base", study.plan["eval"]["control_seed_broadcast"]), "teacher": ref("teacher", 0),
           "max_steps": study.plan["train"].get("max_steps"), "epochs": study.plan["train"].get("epochs"),
           "honesty": "One seed per point on dev tasks (decision support, not a confirmatory result); intervals are 95 % Wilson over "
                      "dev tasks. With a fixed step budget, smaller shares are seen more times each."}
    (study.root / "datacurve").mkdir(exist_ok=True)
    write_json_atomic(study.root / "datacurve" / "curve.json", json.dumps(out, indent=2))
    emit({"event": "datacurve_done", "points": len(points)})
    return out
