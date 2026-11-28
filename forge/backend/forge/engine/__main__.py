"""`python -m forge.engine …` — the only entry point that touches torch / GPUs.

The API never imports this; it spawns it via forge.jobs.runner. Each line written
to stdout is one JSON event, which the job runner streams to the UI.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from pathlib import Path


def emit(event: dict) -> None:
    sys.stdout.write(json.dumps({"ts": time.time(), **event}, default=str, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def cmd_stage(a: argparse.Namespace) -> int:
    os.environ.setdefault("HF_HUB_OFFLINE", "1")  # studies are offline: no silent network fetches
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine.study import Study
    study = Study(Path(a.study))
    emit({"event": "stage_start", "stage": a.stage, "study": study.plan["study_id"], "python": sys.executable})
    res = study.run_stage(a.stage, emit=emit, confirm=a.confirm,
                          hash_cache=Path(a.hash_cache) if a.hash_cache else None)
    emit({"event": "stage_completed", "stage": a.stage, "result": res})
    return 0


def cmd_train_run(a: argparse.Namespace) -> int:
    """One arm × seed, in its own process (spawned by the train stage)."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine.study import Study
    Study(Path(a.study)).train_one(a.arm, int(a.seed), emit, Path(a.hash_cache) if a.hash_cache else None)
    return 0


def cmd_playground(a: argparse.Namespace) -> int:
    """Run one message / task through several models side by side."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine.playground import run
    from forge.engine.study import Study
    run(Study(Path(a.study)), json.loads(a.config), emit)
    return 0


def cmd_stress(a: argparse.Namespace) -> int:
    """Run held-out tasks with typos, rewording, noise and embedded instructions through several models."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine.stress import run
    from forge.engine.study import Study
    run(Study(Path(a.study)), json.loads(a.config), emit)
    return 0


def cmd_overlap(a: argparse.Namespace) -> int:
    """Look the final-test questions up in a training-data index (contamination check)."""
    from forge.engine.lineage_eval import overlap
    from forge.engine.study import Study
    overlap(Study(Path(a.study)), json.loads(a.config), emit)
    return 0


def cmd_checkpoint_eval(a: argparse.Namespace) -> int:
    """Run the study's tasks with another checkpoint of the base model (checkpoint timeline)."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine.lineage_eval import evaluate_checkpoint
    from forge.engine.study import Study
    evaluate_checkpoint(Study(Path(a.study)), json.loads(a.config), emit)
    return 0


def cmd_forgetting(a: argparse.Namespace) -> int:
    """Forgetting check: general-text perplexity of the untrained and every trained student."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine import forgetting
    from forge.engine.study import Study
    forgetting.run(Study(Path(a.study)), (json.loads(a.config) or {}).get("text_file"), emit)
    return 0


def cmd_autopilot(a: argparse.Namespace) -> int:
    """Run everything that is left in a study as one resumable job (the validation kit inside the app)."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine import autopilot
    from forge.engine.study import Study
    res = autopilot.run(Study(Path(a.study)), json.loads(a.config), emit)
    emit({"event": "autopilot_finished", "stopped_at": res["stopped_at"]})
    return 0


def cmd_bundle(a: argparse.Namespace) -> int:
    """Reproducibility bundle: write one (--study) or verify one (--verify)."""
    from forge.engine import bundle
    if a.verify:
        r = bundle.verify(a.verify)
        for c in r["checks"]:
            print(("PASS " if c["ok"] else "FAIL ") + f"{c['check']}: {c['detail']}")
        print("VERIFIED" if r["ok"] else "NOT VERIFIED")
        return 0 if r["ok"] else 1
    from forge.engine.study import Study
    print(json.dumps(bundle.export(Study(Path(a.study)), Path(a.out) if a.out else None, a.include_adapters), indent=2))
    return 0


def cmd_quant(a: argparse.Namespace) -> int:
    """Quantization Lab: make a reference variant, evaluate a variant, or measure a served one."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine.study import Study
    from forge.quant import lab
    s, cfg = Study(Path(a.study)), json.loads(a.config)
    {"reference": lambda: lab.make_reference(s, cfg, emit), "evaluate": lambda: lab.evaluate(s, cfg["label"], cfg["split"], emit),
     "served": lambda: lab.register_served(s, cfg, emit)}[cfg["action"]]()
    return 0


def cmd_datacurve(a: argparse.Namespace) -> int:
    """Train on 10/25/50/100 % of the training tasks and measure each on dev (or, as a child, train one share)."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine import datacurve
    from forge.engine.study import Study
    st = Study(Path(a.study))
    if a.train_fraction:
        datacurve.train_point(st, float(a.train_fraction), emit)
    else:
        datacurve.run(st, emit=emit)
    return 0


def cmd_gguf(a: argparse.Namespace) -> int:
    """Convert the verified merged export to GGUF with your llama.cpp, or check a GGUF loaded in LM Studio."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    from forge.engine import gguf
    from forge.engine.study import Study
    st, cfg = Study(Path(a.study)), json.loads(a.config)
    if a.step == "export":
        gguf.export(st, cfg, emit)
    else:
        gguf.lmstudio_check(st, Path(cfg["manifest"]), cfg["model_id"], cfg["base_url"], emit)
    return 0


def cmd_autotune(a: argparse.Namespace) -> int:
    """The auto-tune loop. Talks only to FORGE's local API (URL and session token are given to this job alone)."""
    import httpx
    from forge.engine.autotune import loop
    url, tok = os.environ.get("FORGE_API_URL", ""), os.environ.get("FORGE_SESSION_TOKEN", "")
    if not url.startswith("http://127.0.0.1:") or not tok:
        raise RuntimeError("auto-tune must be started by FORGE (no local API address or session token)")
    with httpx.Client(base_url=url, timeout=300, trust_env=False, follow_redirects=False,
                      headers={"X-Forge-Token": tok, "X-Forge-Actor": "auto-tune loop"}) as api:
        try:
            loop(api, a.run, emit)
        except Exception:
            api.post(f"/api/autotune/{a.run}/finish", params={"failed": "true"})
            raise
    return 0


def cmd_bench(a: argparse.Namespace) -> int:
    """Run a bench (compute / vision / security) over its model lanes."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.bench.runner import run
    run(Path(a.run), emit)
    return 0


def cmd_weightlab(a: argparse.Namespace) -> int:
    """Build a Weight Lab variant, or evaluate one on a study's dev split."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine import weightlab
    v = weightlab.Variant(Path(a.variant))
    if a.step == "build":
        weightlab.run_build(v, emit)
    else:
        from forge.engine.study import Study
        weightlab.evaluate(v, Study(Path(a.study)), emit)
    return 0


def cmd_modelmap(a: argparse.Namespace) -> int:
    """Model Map: representation map (all tasks of a split) or word view (one task / message)."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine import modelmap
    from forge.engine.study import Study
    st, cfg = Study(Path(a.study)), json.loads(a.config or "{}")
    if a.step == "map":
        modelmap.run_map(st, cfg.get("split", "dev"), cfg.get("arm"), cfg.get("seed"), emit)
    else:
        modelmap.run_explain(st, cfg.get("task_id"), cfg.get("prompt"), cfg.get("model", "trained"), cfg.get("arm"), cfg.get("seed"), emit)
    return 0


def cmd_lens(a: argparse.Namespace) -> int:
    """Distillation lens for one arm × seed (teacher-forced log-probs: base, snapshots, final)."""
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    from forge.engine.lens import run_lens
    from forge.engine.study import Study
    run_lens(Study(Path(a.study)), a.arm, int(a.seed), emit)
    return 0


def cmd_knowledge(a: argparse.Namespace) -> int:
    """Knowledge-pack steps: import (local files), index (loopback embeddings), questions (teacher)."""
    from forge.engine.runtime import OpenAICompatBackend
    from forge.knowledge.pack import KnowledgePack
    pack = KnowledgePack(Path(a.pack))
    cfg = json.loads(a.config or "{}")
    emit({"event": "pack_step_start", "step": a.step, "pack": pack.meta["name"]})
    if a.step == "import":
        res = pack.run_import(emit)
    elif a.step == "index":
        res = pack.run_index(cfg.get("endpoint"), cfg.get("model"), emit)
    elif a.step == "questions":
        teacher = OpenAICompatBackend(cfg["endpoint"], cfg["model"], temperature=0.2, max_tokens=400)
        teacher.name = cfg["model"]
        res = pack.run_questions(teacher, n=int(cfg.get("n", 60)), unanswerable_frac=float(cfg.get("unanswerable", 0.25)),
                                 seed=int(cfg.get("seed", 7)), emit=emit)
    else:
        raise ValueError(f"unknown step {a.step}")
    emit({"event": "pack_step_completed", "step": a.step, "result": res})
    return 0


def cmd_agent(a: argparse.Namespace) -> int:
    """Agent steps: tasks (the teacher writes practice tasks; FORGE verifies each by running the tools)."""
    from forge.agents.agent import Agent
    from forge.engine.runtime import OpenAICompatBackend
    agent = Agent(Path(a.agent))
    cfg = json.loads(a.config or "{}")
    emit({"event": "agent_step_start", "step": a.step, "agent": agent.meta["name"]})
    if a.step != "tasks":
        raise ValueError(f"unknown step {a.step}")
    teacher = None
    if cfg.get("source", "teacher") == "teacher":
        teacher = OpenAICompatBackend(cfg["endpoint"], cfg["model"], temperature=0.4, max_tokens=600)
        teacher.name = cfg["model"]
    res = agent.run_tasks(teacher, per_skill=int(cfg.get("per_skill", 40)), seed=int(cfg.get("seed", 7)), emit=emit,
                          source=cfg.get("source", "teacher"))
    emit({"event": "agent_step_completed", "step": a.step, "result": res})
    return 0


def cmd_hub_download(a: argparse.Namespace) -> int:
    from forge.providers.hf_hub import download_and_verify
    res = download_and_verify(a.repo, revision=a.revision, cache_dir=Path(a.cache_dir) if a.cache_dir else None, emit=emit)
    emit({"event": "download_verified", **res})
    return 0


def cmd_verify_gpu(a: argparse.Namespace) -> int:
    """Forward/backward + BF16 on the real GPU. Prints measured facts only."""
    import numpy
    import torch
    emit({"event": "env", "python": sys.executable, "torch": torch.__version__, "cuda_build": torch.version.cuda,
          "numpy": numpy.__version__, "cuda_available": torch.cuda.is_available()})
    if not torch.cuda.is_available():
        emit({"event": "fail", "reason": "CUDA not available to this interpreter"})
        return 2
    dev = torch.device("cuda")
    emit({"event": "device", "name": torch.cuda.get_device_name(0), "capability": torch.cuda.get_device_capability(0),
          "bf16": torch.cuda.is_bf16_supported(), "count": torch.cuda.device_count()})
    torch.manual_seed(0)
    x = torch.randn(64, 1024, device=dev, dtype=torch.bfloat16, requires_grad=True)
    w = torch.randn(1024, 1024, device=dev, dtype=torch.bfloat16, requires_grad=True)
    loss = (x @ w).float().pow(2).mean()
    loss.backward()
    ok = bool(torch.isfinite(w.grad.float()).all())
    emit({"event": "forward_backward_bf16", "loss": float(loss), "grad_finite": ok,
          "peak_mb": round(torch.cuda.max_memory_allocated() / 2 ** 20, 1)})
    return 0 if ok else 3


def cmd_gpu_smoke(a: argparse.Namespace) -> int:
    """GPU wiring smoke on the real student: oracle teacher (no LM Studio needed), 2-step LoRA, dev evaluation.

    Exercises CUDA/BF16 pre-flight, the zero-adapter check, base-hash verification, adapter save +
    inspection, and student generation on the GPU. Results are wiring evidence only.
    """
    import tempfile
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    from forge.engine.runtime import OracleBackend
    from forge.engine.study import Study
    root = Path(a.out) if a.out else Path(tempfile.mkdtemp(prefix="forge-gpu-smoke-"))
    study = Study.init(root, name="gpu-smoke", profile="smoke", arms=["oracle_sft"], device="cuda",
                       teacher={"provider": "oracle", "endpoint": a.teacher_endpoint, "model": "oracle"},
                       student={"name": Path(a.student).name, "path": a.student},
                       train_overrides={"max_steps": 2, "save_steps": 1, "min_free_vram_mb": a.min_free_vram_mb},
                       taskset_overrides={"groups_per_family": 5, "ood_groups_per_family": 1, "regression_groups": 1})
    emit({"event": "smoke_study", "path": str(study.root)})
    tasks = {t.prompt: t for t in study.tasks()}
    for stage in ("collect", "build", "train", "evaluate_dev", "analyze_dev"):
        study.run_stage(stage, emit=emit, teacher_backend=OracleBackend(tasks) if stage == "collect" else None)
        emit({"event": "smoke_stage_ok", "stage": stage})
    run = json.loads((study.run_dir("oracle_sft", 0) / "run.json").read_text(encoding="utf-8"))
    emit({"event": "gpu_smoke_passed", "peak_vram_mb": run.get("peak_vram_mb"), "zero_adapter_max_abs_diff":
          run["zero_adapter_max_abs_diff"], "adapter_sha256": run["adapter_sha256"], "study": str(study.root)})
    return 0


def keep_awake() -> None:
    """Windows: stop idle sleep while this engine job runs (long collects and training runs take hours). Released
    automatically when the process exits. Closing the lid or choosing Sleep still sleeps."""
    if sys.platform != "win32":
        return
    try:
        import ctypes
        ES_CONTINUOUS, ES_SYSTEM_REQUIRED = 0x80000000, 0x00000001
        if ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED):
            emit({"event": "keep_awake", "detail": "Windows idle sleep is paused while this job runs"})
    except (AttributeError, OSError):
        pass


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="forge.engine")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("stage")
    s.add_argument("--study", required=True)
    s.add_argument("--stage", required=True)
    s.add_argument("--confirm")
    s.add_argument("--hash-cache")
    s.set_defaults(fn=cmd_stage)
    r = sub.add_parser("train-run")
    r.add_argument("--study", required=True)
    r.add_argument("--arm", required=True)
    r.add_argument("--seed", required=True)
    r.add_argument("--hash-cache")
    r.set_defaults(fn=cmd_train_run)
    mm = sub.add_parser("modelmap")
    mm.add_argument("--study", required=True)
    mm.add_argument("--step", required=True, choices=["map", "explain"])
    mm.add_argument("--config")
    mm.set_defaults(fn=cmd_modelmap)
    pg = sub.add_parser("playground")
    pg.add_argument("--study", required=True)
    pg.add_argument("--config", required=True)
    pg.set_defaults(fn=cmd_playground)
    sp = sub.add_parser("stress")
    sp.add_argument("--study", required=True)
    sp.add_argument("--config", required=True)
    sp.set_defaults(fn=cmd_stress)
    ov = sub.add_parser("overlap")
    ov.add_argument("--study", required=True)
    ov.add_argument("--config", required=True)
    ov.set_defaults(fn=cmd_overlap)
    ce = sub.add_parser("checkpoint-eval")
    ce.add_argument("--study", required=True)
    ce.add_argument("--config", required=True)
    ce.set_defaults(fn=cmd_checkpoint_eval)
    fg = sub.add_parser("forgetting")
    fg.add_argument("--study", required=True)
    fg.add_argument("--config", default="{}")
    fg.set_defaults(fn=cmd_forgetting)
    ap_ = sub.add_parser("autopilot")
    ap_.add_argument("--study", required=True)
    ap_.add_argument("--config", default="{}")
    ap_.set_defaults(fn=cmd_autopilot)
    bd = sub.add_parser("bundle", help="write (--study) or verify (--verify ZIP) a reproducibility bundle")
    bd.add_argument("--study")
    bd.add_argument("--out")
    bd.add_argument("--include-adapters", action="store_true")
    bd.add_argument("--verify")
    bd.set_defaults(fn=cmd_bundle)
    qt = sub.add_parser("quant")
    qt.add_argument("--study", required=True)
    qt.add_argument("--config", required=True)
    qt.set_defaults(fn=cmd_quant)
    dc = sub.add_parser("datacurve")
    dc.add_argument("--study", required=True)
    dc.add_argument("--train-fraction")
    dc.set_defaults(fn=cmd_datacurve)
    gg = sub.add_parser("gguf")
    gg.add_argument("--study", required=True)
    gg.add_argument("--step", required=True, choices=["export", "check"])
    gg.add_argument("--config", required=True)
    gg.set_defaults(fn=cmd_gguf)
    au = sub.add_parser("autotune")
    au.add_argument("--run", required=True)
    au.set_defaults(fn=cmd_autotune)
    bn = sub.add_parser("bench")
    bn.add_argument("--run", required=True)
    bn.set_defaults(fn=cmd_bench)
    wl = sub.add_parser("weightlab")
    wl.add_argument("--variant", required=True)
    wl.add_argument("--step", required=True, choices=["build", "evaluate"])
    wl.add_argument("--study")
    wl.set_defaults(fn=cmd_weightlab)
    lz = sub.add_parser("lens")
    lz.add_argument("--study", required=True)
    lz.add_argument("--arm", required=True)
    lz.add_argument("--seed", required=True)
    lz.set_defaults(fn=cmd_lens)
    ag = sub.add_parser("agent")
    ag.add_argument("--agent", required=True)
    ag.add_argument("--step", required=True, choices=["tasks"])
    ag.add_argument("--config")
    ag.set_defaults(fn=cmd_agent)
    k = sub.add_parser("knowledge")
    k.add_argument("--pack", required=True)
    k.add_argument("--step", required=True, choices=["import", "index", "questions"])
    k.add_argument("--config")
    k.set_defaults(fn=cmd_knowledge)
    h = sub.add_parser("hub-download")
    h.add_argument("--repo", required=True)
    h.add_argument("--revision")
    h.add_argument("--cache-dir")
    h.set_defaults(fn=cmd_hub_download)
    v = sub.add_parser("verify-gpu")
    v.set_defaults(fn=cmd_verify_gpu)
    g = sub.add_parser("gpu-smoke")
    g.add_argument("--student", required=True, help="Local HF snapshot directory of the student")
    g.add_argument("--out")
    g.add_argument("--teacher-endpoint", default="http://127.0.0.1:1234/v1", help="Checked only to confirm the teacher is unloaded")
    g.add_argument("--min-free-vram-mb", type=int, default=8000)
    g.set_defaults(fn=cmd_gpu_smoke)
    a = p.parse_args(argv)
    guarded = a.cmd in ("stage", "train-run", "lens", "agent", "knowledge", "gpu-smoke", "playground", "weightlab", "modelmap", "stress", "datacurve", "gguf", "bench")
    if guarded:
        keep_awake()
        from forge.engine import guard
        g = guard.install(emit)
        emit({"event": "hardware_guard", **{k: g.cfg[k] for k in ("enabled", "max_temp_c", "resume_temp_c", "cpu_reserve", "low_priority")},
              "threads": getattr(g, "threads", None)})
    try:
        return a.fn(a)
    except Exception as e:
        emit({"event": "error", "error": f"{type(e).__name__}: {e}", "traceback": traceback.format_exc()[-4000:]})
        return 1
    finally:
        if guarded:
            from forge.engine import guard
            if guard.current() is not None:
                emit({"event": "hardware_summary", **guard.current().stop()})


if __name__ == "__main__":
    sys.exit(main())
