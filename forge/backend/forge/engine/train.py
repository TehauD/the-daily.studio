"""LoRA training (Transformers Trainer + PEFT). Runs only inside an engine subprocess.

Gates, in order (any failure aborts before a single optimizer step):
  1. CUDA present, BF16 supported, exactly one visible GPU, free VRAM ≥ threshold, teacher unloaded
     (CPU is permitted only when FORGE_ALLOW_CPU=1 — for wiring tests, never for results).
  2. Base-model hash recorded.
  3. Zero-adapter check: with B = 0 the adapted model's logits equal the base model's exactly.
  4. Only `lora_` parameters require grad.
  5. All records tokenize with an exact prefix and no truncation.
After training: adapter saved as safetensors and hashed; inspection computed; base hash re-verified.
There is no silent OOM fallback: an OOM fails the run with the measured peak.
"""
from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import httpx

from forge.engine.datasets import IGNORE_INDEX, tokenize_all
from forge.util import sha256_file, utcnow

log = logging.getLogger("forge.engine.train")


class GateError(RuntimeError):
    pass


@dataclass
class TrainConfig:
    model_path: str
    records: list[dict[str, Any]]
    output_dir: str
    seed: int = 0
    rank: int = 16
    alpha: int = 32
    dropout: float = 0.05
    target_modules: list[str] | str = "all-linear"
    lr: float = 2e-4
    warmup_ratio: float = 0.03
    micro_batch: int = 1
    grad_accum: int = 8
    max_seq_len: int = 2048
    epochs: float = 3.0
    max_steps: int = -1
    all_token_loss: bool = False
    gradient_checkpointing: bool = True
    min_free_vram_mb: int = 12000
    teacher_endpoint: str | None = None
    device: str = "cuda"
    eval_records: list[dict[str, Any]] = field(default_factory=list)
    save_steps: int = 50


def model_hash(model_dir: Path, cache_file: Path | None = None) -> str:
    """sha256 over config + weight shards (sorted). Cached by (name, size, mtime) — content is re-read if any change."""
    files = sorted([p for p in model_dir.iterdir() if p.is_file() and (p.suffix == ".safetensors" or p.name == "config.json")])
    key = json.dumps([[p.name, p.stat().st_size, p.stat().st_mtime_ns] for p in files])
    cache: dict[str, Any] = {}
    if cache_file and cache_file.exists():
        try:
            cache = json.loads(cache_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            cache = {}
    ck = f"{model_dir}|{key}"
    if ck in cache:
        return cache[ck]
    import hashlib
    h = hashlib.sha256()
    for p in files:
        h.update(p.name.encode())
        h.update(sha256_file(p).encode())
    digest = h.hexdigest()
    if cache_file:
        cache[ck] = digest
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(cache), encoding="utf-8")
    return digest


def teacher_loaded(endpoint: str | None) -> tuple[bool | None, str]:
    """LM Studio REST v0 exposes per-model state. None = cannot tell (server down → certainly not holding VRAM)."""
    if not endpoint:
        return None, "no teacher endpoint configured"
    base = endpoint.rstrip("/").removesuffix("/v1")
    try:
        r = httpx.get(f"{base}/api/v0/models", timeout=3.0, trust_env=False)
        if r.status_code != 200:
            return None, f"state not exposed (HTTP {r.status_code})"
        loaded = [m["id"] for m in r.json().get("data", []) if m.get("state") == "loaded" and m.get("type") != "embeddings"]
        if loaded:
            return True, (f"LM Studio still has {', '.join(loaded)} loaded on the GPU. Eject it in LM Studio "
                          "(or run `lms unload --all`), then run this stage again.")
        return False, "no generative model loaded"
    except httpx.HTTPError:
        return False, "teacher server not running"


def preflight(cfg: TrainConfig) -> list[dict[str, Any]]:
    import gc

    import torch
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    checks: list[dict[str, Any]] = []

    def add(name: str, ok: bool | None, detail: str, blocking: bool = True) -> None:
        checks.append({"check": name, "status": "pass" if ok else ("skip" if ok is None else "fail"),
                       "detail": detail, "blocking": blocking})

    cpu_ok = os.environ.get("FORGE_ALLOW_CPU") == "1"
    if cfg.device == "cpu":
        add("device", cpu_ok, "CPU training permitted for wiring tests only (FORGE_ALLOW_CPU=1)"
            if cpu_ok else "CPU training refused; set FORGE_ALLOW_CPU=1 for wiring tests")
    else:
        avail = torch.cuda.is_available()
        add("cuda", avail, f"torch {torch.__version__}, CUDA build {torch.version.cuda}")
        if avail:
            add("bf16", torch.cuda.is_bf16_supported(), torch.cuda.get_device_name(0))
            n = torch.cuda.device_count()
            add("single_gpu", n == 1, f"{n} visible device(s)")
            free, total = torch.cuda.mem_get_info()
            own = torch.cuda.memory_reserved()  # cached by this process's allocator: reusable by this run
            usable = (free + own) / 2 ** 20
            add("free_vram", usable >= cfg.min_free_vram_mb,
                f"{usable:.0f} MB usable ({free / 2**20:.0f} free + {own / 2**20:.0f} cached by FORGE) of "
                f"{total / 2**20:.0f} MB; need ≥ {cfg.min_free_vram_mb}. Close other GPU apps (browser, games, "
                "LM Studio) if this fails.")
    loaded, detail = teacher_loaded(cfg.teacher_endpoint)
    add("teacher_unloaded", None if loaded is None else (not loaded), detail)
    failing = [c for c in checks if c["status"] == "fail" and c["blocking"]]
    if failing:
        raise GateError("Pre-flight failed: " + "; ".join(f"{c['check']}: {c['detail']}" for c in failing))
    return checks


def _collate(pad_id: int):
    import torch

    def fn(batch: list[dict]) -> dict:
        L = max(len(b["input_ids"]) for b in batch)
        ids = torch.full((len(batch), L), pad_id, dtype=torch.long)
        lab = torch.full((len(batch), L), IGNORE_INDEX, dtype=torch.long)
        att = torch.zeros((len(batch), L), dtype=torch.long)
        for i, b in enumerate(batch):
            n = len(b["input_ids"])
            ids[i, :n] = torch.tensor(b["input_ids"])
            lab[i, :n] = torch.tensor(b["labels"])
            att[i, :n] = 1
        return {"input_ids": ids, "labels": lab, "attention_mask": att}
    return fn


def train_lora(cfg: TrainConfig, hash_cache: Path | None = None, emit=print) -> dict[str, Any]:
    import torch
    from peft import LoraConfig, get_peft_model
    from transformers import (AutoModelForCausalLM, AutoTokenizer, Trainer, TrainerCallback, TrainingArguments,
                              set_seed)

    out = Path(cfg.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    report: dict[str, Any] = {"started_at": utcnow(), "config": {k: v for k, v in asdict(cfg).items()
                                                                 if k not in ("records", "eval_records")}}
    report["preflight"] = preflight(cfg)
    emit({"event": "preflight_passed", "checks": report["preflight"]})

    base_dir = Path(cfg.model_path)
    report["base_hash_before"] = model_hash(base_dir, hash_cache)
    set_seed(cfg.seed)
    tok = AutoTokenizer.from_pretrained(base_dir, local_files_only=True, trust_remote_code=False)
    if tok.pad_token_id is None:
        tok.pad_token = tok.eos_token
    train_set, tstats = tokenize_all(tok, cfg.records, cfg.max_seq_len, cfg.all_token_loss)
    eval_set = tokenize_all(tok, cfg.eval_records, cfg.max_seq_len, cfg.all_token_loss)[0] if cfg.eval_records else []
    report["token_stats"] = tstats
    emit({"event": "tokenized", **tstats})

    dtype = torch.bfloat16 if cfg.device == "cuda" else torch.float32
    model = AutoModelForCausalLM.from_pretrained(base_dir, local_files_only=True, trust_remote_code=False,
                                                 torch_dtype=dtype).to(cfg.device)
    model.config.use_cache = False
    lcfg = LoraConfig(r=cfg.rank, lora_alpha=cfg.alpha, lora_dropout=cfg.dropout, target_modules=cfg.target_modules,
                      task_type="CAUSAL_LM", bias="none")
    model = get_peft_model(model, lcfg)

    # Gate: zero-adapter logit equality (B is zero-initialized ⇒ adapter must be an exact no-op).
    probe = torch.tensor([train_set[0]["input_ids"][:64]], device=cfg.device)
    model.eval()
    with torch.no_grad():
        with model.disable_adapter():
            base_logits = model(input_ids=probe).logits
        adapted_logits = model(input_ids=probe).logits
    max_diff = float((base_logits - adapted_logits).abs().max())
    report["zero_adapter_max_abs_diff"] = max_diff
    if max_diff != 0.0:
        raise GateError(f"Zero-adapter check failed: max |Δlogit| = {max_diff}")
    trainable = [n for n, p in model.named_parameters() if p.requires_grad]
    bad = [n for n in trainable if "lora_" not in n]
    if bad:
        raise GateError(f"Non-LoRA parameters are trainable: {bad[:5]}")
    n_tr = sum(p.numel() for p in model.parameters() if p.requires_grad)
    n_all = sum(p.numel() for p in model.parameters())
    report["trainable_params"], report["total_params"] = n_tr, n_all
    emit({"event": "gates_passed", "zero_adapter_max_abs_diff": max_diff, "trainable_params": n_tr,
          "total_params": n_all})
    model.train()

    log_path = out / "training.jsonl"
    t_start = time.perf_counter()

    class Telemetry(TrainerCallback):
        def on_step_end(self, args, state, control, **kw):
            from forge.engine import guard
            guard.check()  # thermal safe point between optimizer steps

        def on_log(self, args, state, control, logs=None, **kw):
            if not logs:
                return
            elapsed = time.perf_counter() - t_start
            seen = int(getattr(state, "num_input_tokens_seen", 0) or 0)  # exact count kept by Trainer
            row = {"ts": utcnow(), "step": state.global_step, "epoch": state.epoch, "elapsed_s": round(elapsed, 2),
                   "tokens_seen": seen, "tokens_per_s": round(seen / elapsed, 1) if elapsed else None,
                   "peak_vram_mb": round(torch.cuda.max_memory_allocated() / 2 ** 20, 1) if cfg.device == "cuda" else None,
                   "objective": "all_token_ce" if cfg.all_token_loss else "completion_ce", **logs}
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(row) + "\n")
            # training.jsonl keeps the ISO timestamp; the event stream uses emit's numeric ts.
            emit({"event": "log", **{k: v for k, v in row.items() if k != "ts"}})

    # Evenly spaced adapter snapshots (≈5 per run) for the distance-to-teacher curve. Saving does not touch the
    # optimisation; only the adapter weights are kept (no optimizer state), so each snapshot is small.
    import math
    per_epoch = math.ceil(len(train_set) / (cfg.micro_batch * cfg.grad_accum))
    total_steps = cfg.max_steps if cfg.max_steps > 0 else max(1, math.ceil(per_epoch * cfg.epochs))
    save_steps = max(1, min(cfg.save_steps, math.ceil(total_steps / 5)))
    report["snapshot_every_steps"] = save_steps
    snap_root = out / "snapshots"

    class Snapshots(TrainerCallback):
        def on_save(self, args, state, control, **kw):
            import shutil
            src = Path(args.output_dir) / f"checkpoint-{state.global_step}"
            dst = snap_root / f"step-{state.global_step:06d}"
            if src.is_dir() and (src / "adapter_model.safetensors").exists() and not dst.exists():
                tmp = dst.with_name(dst.name + ".tmp")
                tmp.mkdir(parents=True, exist_ok=True)
                for name in ("adapter_model.safetensors", "adapter_config.json"):
                    shutil.copy2(src / name, tmp / name)
                tmp.rename(dst)

    args = TrainingArguments(
        output_dir=str(out / "checkpoints"), per_device_train_batch_size=cfg.micro_batch,
        gradient_accumulation_steps=cfg.grad_accum, learning_rate=cfg.lr, lr_scheduler_type="cosine",
        warmup_ratio=cfg.warmup_ratio, num_train_epochs=cfg.epochs, max_steps=cfg.max_steps,
        bf16=cfg.device == "cuda", gradient_checkpointing=cfg.gradient_checkpointing,
        gradient_checkpointing_kwargs={"use_reentrant": False} if cfg.gradient_checkpointing else None,
        logging_steps=1, save_strategy="steps", save_steps=save_steps, save_total_limit=2,
        eval_strategy="steps" if eval_set else "no", eval_steps=save_steps if eval_set else None,
        per_device_eval_batch_size=1, report_to=[], seed=cfg.seed, data_seed=cfg.seed,
        remove_unused_columns=False, use_cpu=cfg.device == "cpu", dataloader_num_workers=0,
        include_num_input_tokens_seen=True,
        disable_tqdm=True,  # progress bars flood the job log; the Telemetry callback reports every step
    )
    trainer = Trainer(model=model, args=args, train_dataset=train_set, eval_dataset=eval_set or None,
                      data_collator=_collate(tok.pad_token_id), callbacks=[Telemetry(), Snapshots()])
    from transformers.trainer_callback import PrinterCallback
    trainer.remove_callback(PrinterCallback)  # raw dict prints duplicate the structured "log" events
    ckpts = sorted((out / "checkpoints").glob("checkpoint-*"), key=lambda p: int(p.name.split("-")[-1]))
    resume = str(ckpts[-1]) if ckpts else None
    report["resumed_from"] = resume
    if cfg.device == "cuda":
        torch.cuda.reset_peak_memory_stats()
    try:
        result = trainer.train(resume_from_checkpoint=resume)
    except torch.OutOfMemoryError as e:  # explicit failure, never a silent fallback
        peak = torch.cuda.max_memory_allocated() / 2 ** 20
        raise RuntimeError(f"CUDA OOM at peak {peak:.0f} MB; reduce seq len / rank. No fallback attempted.") from e
    report["train_metrics"] = result.metrics
    report["global_step"] = trainer.state.global_step
    report["peak_vram_mb"] = round(torch.cuda.max_memory_allocated() / 2 ** 20, 1) if cfg.device == "cuda" else None
    report["wall_s"] = round(time.perf_counter() - t_start, 2)

    adapter_dir = out / "adapter"
    model.save_pretrained(adapter_dir, safe_serialization=True)
    report["adapter_sha256"] = sha256_file(adapter_dir / "adapter_model.safetensors")
    from forge.analysis.adapters import inspect_adapter  # live inspection, before unload
    try:
        insp = inspect_adapter(adapter_dir, base_dir)
        (out / "inspection.json").write_text(json.dumps(insp), encoding="utf-8")
        report["inspection"] = {"modules": len(insp["modules"]), "total_trainable_params": insp["total_trainable_params"]}
    except Exception as e:  # inspection failure does not invalidate training, but is recorded
        report["inspection_error"] = repr(e)
    del trainer, model
    import gc
    gc.collect()  # PEFT/checkpointing hooks form reference cycles; collect before releasing cached blocks
    if cfg.device == "cuda":
        torch.cuda.empty_cache()
    report["base_hash_after"] = model_hash(base_dir, None)  # re-read content, bypass cache
    if report["base_hash_after"] != report["base_hash_before"]:
        raise GateError("Base model hash changed during training — original weights were modified")
    report["ended_at"] = utcnow()
    from forge.engine import guard
    if guard.current() is not None:
        report["hardware"] = guard.current().summary()  # energy, peak temperature, thermal pauses (whole GPU)
    (out / "run.json").write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    emit({"event": "trained", "adapter_sha256": report["adapter_sha256"], "global_step": report["global_step"]})
    return report
