"""Two measurements an open-data base model makes possible.

1. Training-data overlap (contamination check)
   For each final-test question, a few 13-word windows (the n used by common contamination checks) are looked up in an index
   of the base model's training data — the infini-gram API format, hosted by AI2 for its open corpora or run locally — and
   the exact-occurrence count is recorded. A question with any non-zero window may have been seen in pretraining, which can
   inflate the untrained model's score and the measured gain. Off unless configured. Only the synthetic test *questions* are
   sent, never answers or anything else. No match does not prove absence: the index may cover part of the data, and
   paraphrases are not detected.

2. Checkpoint timeline
   The study's own tasks run with other checkpoints of the base model — e.g. OLMo 3 base, SFT, DPO and Instruct — so the skill
   can be followed through the model's own training and then through this study's adapter. Episodes are stored under the
   arm `ckpt_<label>` with the study's resumable, hash-verified writer, so Compare pairs them on identical tasks. The final
   test can be used only after SEAL; checkpoints never influence the study's training.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

from forge.engine import statistics as st
from forge.util import utcnow, write_json_atomic

NGRAM, WINDOWS, MIN_WORDS = 13, 4, 8
HONESTY_OVERLAP = ("An exact 13-word match means this text (or text containing it) is in the indexed training data. No match does not prove "
                   "absence: the index may cover only part of the data, and reworded copies are not detected. Only the synthetic test "
                   "questions were sent to the index.")


class LineageError(ValueError):
    pass


def check_index_url(url: str) -> str:
    """https anywhere, or http on this machine (a locally hosted infini-gram index)."""
    u = urlparse(url or "")
    if u.scheme == "https" and u.hostname:
        return url
    if u.scheme == "http" and u.hostname in ("127.0.0.1", "localhost", "::1"):
        return url
    raise LineageError("The index URL must be https, or http on this machine (127.0.0.1)")


def windows(text: str, n: int = NGRAM, k: int = WINDOWS) -> list[str]:
    w = re.findall(r"\S+", text or "")
    if len(w) < MIN_WORDS:
        return []
    if len(w) <= n:
        return [" ".join(w)]
    starts = sorted({round(i * (len(w) - n) / max(1, k - 1)) for i in range(k)})
    return [" ".join(w[s:s + n]) for s in starts]


def infini_gram_counter(url: str, index: str, timeout: float = 20.0, delay_s: float = 0.15) -> Callable[[str], int]:
    import httpx
    check_index_url(url)
    if not re.fullmatch(r"[A-Za-z0-9_.\-]{2,120}", index or ""):
        raise LineageError("Name the index exactly as the provider lists it")
    client = httpx.Client(timeout=timeout, trust_env=False)

    def count(q: str) -> int:
        time.sleep(delay_s)  # be gentle with a shared public service
        r = client.post(url, json={"index": index, "query_type": "count", "query": q})
        r.raise_for_status()
        d = r.json()
        if "error" in d:
            raise LineageError(f"Index error: {d['error']}")
        return int(d.get("count", 0))
    return count


def overlap(study: Any, cfg: dict[str, Any], emit: Callable[[dict], None] = lambda e: None,
            count_fn: Callable[[str], int] | None = None) -> dict[str, Any]:
    split = cfg.get("split", "test")
    if split not in ("dev", "test"):
        raise LineageError("Split must be dev or test")
    count = count_fn or infini_gram_counter(cfg["url"], cfg["index"])
    tasks = [t for t in study.tasks() if t.split == split]
    budget = int(cfg.get("max_queries", 400))
    k = max(1, min(WINDOWS, budget // max(1, len(tasks))))
    by_skill: dict[str, dict[str, int]] = {}
    examples, short, queries = [], 0, 0
    for i, t in enumerate(tasks, 1):
        ws = windows(t.prompt, k=k)
        sk = by_skill.setdefault(t.family, {"tested": 0, "hits": 0, "too_short": 0})
        if not ws:
            short += 1
            sk["too_short"] += 1
            continue
        sk["tested"] += 1
        best = 0
        for w in ws:
            c = count(w)
            queries += 1
            if c > best:
                best = c
                hit_phrase = w
        if best > 0:
            sk["hits"] += 1
            if len(examples) < 25:
                examples.append({"task_id": t.task_id, "skill": t.family, "phrase": hit_phrase, "count": best})
        emit({"event": "overlap", "progress": f"{i}/{len(tasks)}", "hits": sum(v["hits"] for v in by_skill.values())})
    tested = sum(v["tested"] for v in by_skill.values())
    hits = sum(v["hits"] for v in by_skill.values())
    out = {"generated_at": utcnow(), "split": split, "index": cfg.get("index"), "host": urlparse(cfg.get("url", "")).hostname if not count_fn else "test",
           "ngram": NGRAM, "windows_per_task": k, "queries": queries, "tasks": len(tasks), "tested": tested, "too_short": short, "hits": hits,
           "share": (hits / tested) if tested else None, "by_skill": by_skill, "examples": examples, "honesty": HONESTY_OVERLAP}
    (study.root / "reports").mkdir(exist_ok=True)
    write_json_atomic(study.root / "reports" / "overlap.json", json.dumps(out, indent=2))
    return out


# ---------------------------------------------------------------- checkpoints
def slug(label: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", (label or "").lower()).strip("_")[:34]  # arm names are path parts: [a-z0-9_] only
    if not s:
        raise LineageError("Give the checkpoint a label")
    return s


def evaluate_checkpoint(study: Any, cfg: dict[str, Any], emit: Callable[[dict], None] = lambda e: None,
                        factory: Callable[[str], Any] | None = None) -> dict[str, Any]:
    """cfg: label, order (number: position on the timeline), stage (free text), path, model_id, split, load_4bit."""
    from forge.engine.runtime import TransformersBackend
    from forge.engine.study import StudyLock
    split = cfg.get("split", "dev")
    if split not in ("dev", "test"):
        raise LineageError("Split must be dev or test")
    if split == "test" and not study.state.get("sealed"):
        raise LineageError("The final test can be used for checkpoints only after the study is sealed")
    s = slug(cfg["label"])
    arm = f"ckpt_{s}"
    meta_p = study.root / "checkpoints" / f"{s}.json"
    meta_p.parent.mkdir(exist_ok=True)
    meta = json.loads(meta_p.read_text(encoding="utf-8")) if meta_p.exists() else {}
    path = cfg.get("path") or meta.get("path")
    if not path or not Path(path).is_dir():
        raise LineageError("Checkpoint weights not found on this machine")
    meta.update({"label": cfg["label"], "slug": s, "arm": arm, "order": float(cfg.get("order", meta.get("order", 0))), "stage": cfg.get("stage", meta.get("stage", "")),
                 "path": str(path), "model_id": cfg.get("model_id", meta.get("model_id")), "revision": Path(path).name if Path(path).parent.name == "snapshots" else None})
    write_json_atomic(meta_p, json.dumps(meta, indent=2))
    backend = factory(path) if factory else TransformersBackend(str(path), None, device=study.plan["device"],
                                                                 max_new_tokens=study.plan["eval"]["max_new_tokens"], load_4bit=bool(cfg.get("load_4bit")))
    with StudyLock(study.root / ".lock"):
        study._evaluate(backend, arm, split, 0, study.tasks(), emit)
    getattr(backend, "unload", lambda: None)()
    meta.setdefault("evaluated", {})[split] = utcnow()
    write_json_atomic(meta_p, json.dumps(meta, indent=2))
    return {"arm": arm, "split": split}


def _rate(eps: list[dict]) -> dict[str, Any]:
    k, n = sum(1 for e in eps if (e.get("score") or {}).get("strict_success")), len(eps)
    fam: dict[str, list[int]] = {}
    for e in eps:
        fam.setdefault(e.get("family", "?"), []).append(int(bool((e.get("score") or {}).get("strict_success"))))
    return {"rate": k / n if n else None, "ci": list(st.wilson(k, n)) if n else None, "n": n,
            "per_skill": {f: {"rate": sum(v) / len(v), "n": len(v)} for f, v in sorted(fam.items())}}


def timeline(study: Any) -> dict[str, Any]:
    from forge.engine.study import read_jsonl
    sid = study.plan["study_id"]
    points = []
    d = study.root / "checkpoints"
    for p in sorted(d.glob("*.json")) if d.is_dir() else []:
        m = json.loads(p.read_text(encoding="utf-8"))
        for split in ("dev", "test"):
            eps = read_jsonl(study.episode_path(m["arm"], split, 0)) if study.episode_path(m["arm"], split, 0).exists() else []
            if eps:
                points.append({"kind": "checkpoint", "label": m["label"], "stage": m.get("stage"), "order": m["order"], "split": split,
                               "ref": f"arm:{sid}:{m['arm']}", "model_id": m.get("model_id"), "revision": m.get("revision"), **_rate(eps)})
    top = max([p["order"] for p in points], default=0)
    ctl = study.plan["eval"]["control_seed_broadcast"]
    for arm, kind, label, seeds, off in (("base", "study_base", "this study's student, untrained", [ctl], 1),
                                         (study.plan["arms"][0], "study_trained", f"this study's student + adapter ({study.plan['arms'][0]})", study.plan["seeds"], 2),
                                         ("teacher", "teacher", "teacher (reference)", [0], 3)):
        for split in ("dev", "test"):
            eps = [e for s in seeds if study.episode_path(arm, split, s).exists() for e in read_jsonl(study.episode_path(arm, split, s))]
            if eps:
                points.append({"kind": kind, "label": label, "stage": "", "order": top + off, "split": split, "ref": f"arm:{sid}:{arm}", **_rate(eps)})
    return {"points": sorted(points, key=lambda p: (p["split"], p["order"])), "sealed": bool(study.state.get("sealed")),
            "honesty": "Each point is strict success on this study's synthetic tasks, with its Wilson 95 % range. Checkpoints are run with their own "
                       "chat template and the same tools and scoring; a checkpoint never trained for chat or tools (a base model) is expected to "
                       "score low. Points share the same tasks, so differences can be tested in Compare."}
