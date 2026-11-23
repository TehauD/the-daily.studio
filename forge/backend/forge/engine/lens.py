"""Distillation lens: how training moved the student toward the teacher, measured token by token.

For held-out (dev) teacher trajectories the student never trained on, the teacher's actions are fed to the
student *teacher-forced* (no generation) and the student's log-probability of every teacher action token is read:

- word heatmap: per token, log p under the base model vs the final adapter (Δ = how much more the tuned
  student expects the teacher's next token);
- distance-to-teacher curve: mean negative log-likelihood per teacher action token (nats) and greedy
  agreement (the student's top-1 token equals the teacher's) for the base, every saved snapshot, and the
  final adapter.

This is measured model output on real inputs. It shows which tokens became more or less likely; it does not
show *why*, and agreement under teacher forcing is not the same as end-to-end task success (see evaluation).
"""
from __future__ import annotations

import gc
import json
import math
import os
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable

from forge.engine import datasets as ds
from forge.util import sha256_file, utcnow

LENS_VERSION = 1
MAX_EPISODES = 40


class LensError(RuntimeError):
    pass


def pick_episodes(eps: list[dict], limit: int = MAX_EPISODES) -> list[dict]:
    """Teacher strict successes on dev, balanced round-robin across skills, deterministic order."""
    by_fam: dict[str, list[dict]] = defaultdict(list)
    for e in sorted(eps, key=lambda e: e["task_id"]):
        if e["score"]["strict_success"]:
            by_fam[e["family"]].append(e)
    out: list[dict] = []
    while len(out) < limit and any(by_fam.values()):
        for f in sorted(by_fam):
            if by_fam[f] and len(out) < limit:
                out.append(by_fam[f].pop(0))
    return out


def snapshots(run_dir: Path) -> list[tuple[str, int | None, Path]]:
    """(label, step, adapter dir) for every saved snapshot, then the final adapter."""
    out: list[tuple[str, int | None, Path]] = []
    root = run_dir / "snapshots"
    if root.is_dir():
        for d in sorted(root.glob("step-*")):
            if (d / "adapter_model.safetensors").exists() and not d.name.endswith(".tmp"):
                out.append((f"step {int(d.name[5:])}", int(d.name[5:]), d))
    run = json.loads((run_dir / "run.json").read_text(encoding="utf-8")) if (run_dir / "run.json").exists() else {}
    final_step = run.get("global_step")
    out = [o for o in out if o[1] != final_step]  # the final adapter replaces a snapshot at the same step
    out.append(("final", final_step, run_dir / "adapter"))
    return out


def _pieces(tok: Any, ids: list[int]) -> list[str]:
    """Readable text for each token: incremental decode, so multi-byte characters land on the token that completes them."""
    out, prev = [], ""
    for j in range(len(ids)):
        cur = tok.decode(ids[: j + 1], skip_special_tokens=False, clean_up_tokenization_spaces=False)
        out.append(cur[len(prev):] if cur.startswith(prev) else cur)
        prev = cur
    return out


def _score(model: Any, items: list[dict], device: str) -> list[tuple[list[float], list[bool]]]:
    """Per item: log p(teacher token) and greedy agreement at every supervised (teacher action) position."""
    import torch
    res = []
    model.eval()
    with torch.no_grad():
        from forge.engine import guard
        for it in items:
            guard.check()
            ids = torch.tensor([it["input_ids"]], device=device)
            logits = model(input_ids=ids, attention_mask=torch.ones_like(ids)).logits[0, :-1].float()
            lp = torch.log_softmax(logits, dim=-1)
            tgt = ids[0, 1:]
            pos = torch.tensor(it["positions"], device=device) - 1  # logits at t-1 predict token t
            tok_lp = lp[pos, tgt[pos]].tolist()
            agree = (lp[pos].argmax(dim=-1) == tgt[pos]).tolist()
            res.append((tok_lp, agree))
    return res


def _summ(scored: list[tuple[list[float], list[bool]]], items: list[dict]) -> dict[str, Any]:
    lps = [x for s, _ in scored for x in s]
    ag = [x for _, a in scored for x in a]
    fam: dict[str, list[float]] = defaultdict(list)
    for (s, _), it in zip(scored, items):
        fam[it["family"]].extend(s)
    return {"nll": -sum(lps) / len(lps), "agreement": sum(ag) / len(ag), "tokens": len(lps),
            "families": {f: -sum(v) / len(v) for f, v in sorted(fam.items())}}


def run_lens(study: Any, arm: str, seed: int, emit: Callable[[dict], None] = print,
             model_factory: Callable[[str, str], Any] | None = None) -> dict[str, Any]:
    if arm not in study.plan["arms"] or seed not in study.plan["seeds"]:
        raise LensError(f"Unknown arm/seed {arm}/{seed} for this study")
    rd = study.run_dir(arm, seed)
    final = rd / "adapter" / "adapter_model.safetensors"
    if not final.exists():
        raise LensError(f"No adapter for {arm} seed {seed} yet (run Train)")
    eps = pick_episodes(study.episodes("teacher", "dev", 0))
    if not eps:
        raise LensError("No successful teacher episodes on dev to measure against (run Collect)")
    device = study.plan["device"]
    if device == "cpu" and os.environ.get("FORGE_ALLOW_CPU") != "1":
        raise LensError("CPU studies are wiring tests only; set FORGE_ALLOW_CPU=1")
    if device == "cuda":
        from forge.engine.train import teacher_loaded
        loaded, detail = teacher_loaded(study.plan["teacher"].get("endpoint"))
        if loaded:
            raise LensError(detail)

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer
    path = study.plan["student"]["path"]
    tok = AutoTokenizer.from_pretrained(path, local_files_only=True, trust_remote_code=False)
    max_len = int(study.plan["train"]["max_seq_len"])
    items: list[dict] = []
    skipped: dict[str, int] = defaultdict(int)
    for e in eps:
        for r in ds.episode_records(e):
            try:
                t = ds.tokenize_record(tok, r, max_len)
            except (ds.OverlengthError, ds.PrefixMismatchError) as err:
                skipped[type(err).__name__] += 1
                continue
            pos = [i for i, lab in enumerate(t["labels"]) if lab != ds.IGNORE_INDEX and i > 0]
            items.append({"task_id": e["task_id"], "family": e["family"], "turn": r["turn"], "input_ids": t["input_ids"],
                          "positions": pos, "prompt": next((m["content"] for m in e["messages"] if m["role"] == "user"), "")})
    if not items:
        raise LensError("No teacher records fit the study's max sequence length")
    emit({"event": "lens_start", "arm": arm, "seed": seed, "episodes": len(eps), "records": len(items),
          "tokens": sum(len(i["positions"]) for i in items)})

    dtype = torch.bfloat16 if device == "cuda" else torch.float32
    model = (model_factory(path, device) if model_factory else
             AutoModelForCausalLM.from_pretrained(path, local_files_only=True, trust_remote_code=False,
                                                  torch_dtype=dtype).to(device))
    base = _score(model, items, device)
    curve = [{"label": "base", "step": 0, **_summ(base, items)}]
    emit({"event": "lens_point", "label": "base", "nll": curve[0]["nll"], "agreement": curve[0]["agreement"]})
    snaps = snapshots(rd)
    peft = None
    final_scored = None
    prev: str | None = None
    for i, (label, step, d) in enumerate(snaps):
        name = f"a{i}"
        if peft is None:
            peft = PeftModel.from_pretrained(model, str(d), adapter_name=name)
        else:
            peft.load_adapter(str(d), adapter_name=name)
        peft.set_adapter(name)
        if prev:
            peft.delete_adapter(prev)  # one adapter resident at a time
        prev = name
        sc = _score(peft, items, device)
        pt = {"label": label, "step": step, **_summ(sc, items)}
        curve.append(pt)
        emit({"event": "lens_point", "label": label, "step": step, "nll": pt["nll"], "agreement": pt["agreement"],
              "done": i + 1, "total": len(snaps)})
        if label == "final":
            final_scored = sc
    assert final_scored is not None

    # Word heatmap: base vs final, per episode, per turn.
    episodes: dict[str, dict] = {}
    agg: dict[str, list[float]] = defaultdict(list)
    for it, (b, _), (f, fa) in zip(items, base, final_scored):
        ids = [it["input_ids"][p] for p in it["positions"]]
        texts = _pieces(tok, ids)
        toks = [{"t": t, "b": round(bv, 4), "f": round(fv, 4), "a": bool(a)} for t, bv, fv, a in zip(texts, b, f, fa)]
        ep = episodes.setdefault(it["task_id"], {"task_id": it["task_id"], "family": it["family"], "prompt": it["prompt"],
                                                 "turns": []})
        ep["turns"].append({"turn": it["turn"], "tokens": toks})
        for t, bv, fv in zip(texts, b, f):
            key = t.strip()
            if key:
                agg[key].append(fv - bv)
    for ep in episodes.values():
        allt = [t for tr in ep["turns"] for t in tr["tokens"]]
        ep["mean_delta"] = sum(t["f"] - t["b"] for t in allt) / len(allt)
        ep["nll_base"] = -sum(t["b"] for t in allt) / len(allt)
        ep["nll_final"] = -sum(t["f"] for t in allt) / len(allt)
    rows = [{"token": k, "n": len(v), "mean_delta": sum(v) / len(v)} for k, v in agg.items() if len(v) >= 2]
    rows.sort(key=lambda r: -r["mean_delta"])
    out = {
        "lens_version": LENS_VERSION, "computed": True, "generated_at": utcnow(), "arm": arm, "seed": seed,
        "adapter_sha256": sha256_file(final), "device": device,
        "basis": "teacher-forced log-probability of the teacher's action tokens on dev episodes the student never trained on",
        "units": {"nll": "nats per teacher action token", "agreement": "share of tokens where the student's top-1 equals the teacher's"},
        "episodes_used": len(eps), "records": len(items), "tokens": curve[0]["tokens"], "skipped": dict(skipped),
        "curve": curve,
        "tokens_gained": rows[:20], "tokens_lost": [r for r in reversed(rows[-12:]) if r["mean_delta"] < 0],
        "episodes": sorted(episodes.values(), key=lambda e: (e["family"], e["task_id"])),
        "honesty": ("Measured under teacher forcing: how likely the student finds the teacher's next token. It shows which "
                    "tokens training made more or less expected, not why, and is not end-to-end task success."),
    }
    if not math.isfinite(out["curve"][-1]["nll"]):
        raise LensError("Non-finite log-likelihood; refusing to save")
    del peft, model
    gc.collect()
    if device == "cuda":
        torch.cuda.empty_cache()
    (rd / "lens.json").write_text(json.dumps(out), encoding="utf-8")
    emit({"event": "lens_done", "arm": arm, "seed": seed, "points": len(curve)})
    return out
