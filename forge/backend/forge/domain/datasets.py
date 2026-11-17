"""Trajectory → dataset conversion with immutable, versioned JSONL outputs.

Output formats match Hugging Face TRL conventions:
  chat_sft / tool_calling → {"messages": [...], "tools": [...]}       (SFTTrainer)
  instruction             → {"prompt": str, "completion": str}          (SFTTrainer prompt-completion)
  preference              → {"prompt": [...], "chosen": [...], "rejected": [...]}  (DPOTrainer)
  teacher_student         → {"messages": [...], "teacher": {...}}       (distillation)
Provenance is written to a sidecar file so trainers never see extra columns.

Leakage control: train/held-out split is by task_id hash, so no task appears in both.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from forge.db import Database
from forge.domain.trajectory import AssistantEvent, SystemEvent, ToolResultEvent, Trajectory, UserEvent
from forge.security.paths import safe_join
from forge.util import canonical_json, new_id, sha256_file, utcnow

DatasetFormat = Literal["chat_sft", "instruction", "tool_calling", "preference", "teacher_student"]
FORMATS: tuple[str, ...] = ("chat_sft", "instruction", "tool_calling", "preference", "teacher_student")


@dataclass
class SelectionPolicy:
    require_approved: bool = True
    min_score: float | None = None
    reject_flags: tuple[str, ...] = ("hallucination", "invalid_tool_call", "unsafe")
    heldout_fraction: float = 0.2
    seed: str = "forge"


@dataclass
class ConversionResult:
    train: list[dict]
    heldout: list[dict]
    provenance: list[dict]
    skipped: dict[str, int] = field(default_factory=dict)


def to_messages(t: Trajectory) -> list[dict]:
    msgs: list[dict] = []
    for e in t.events:
        if isinstance(e, SystemEvent):
            msgs.append({"role": "system", "content": e.content})
        elif isinstance(e, UserEvent):
            msgs.append({"role": "user", "content": e.content})
        elif isinstance(e, AssistantEvent):
            m: dict = {"role": "assistant", "content": e.content}
            if e.tool_calls:
                m["tool_calls"] = [{"id": tc.id, "type": "function",
                                    "function": {"name": tc.name, "arguments": tc.arguments}} for tc in e.tool_calls]
            msgs.append(m)
        elif isinstance(e, ToolResultEvent):
            msgs.append({"role": "tool", "tool_call_id": e.call_id, "name": e.name, "content": e.content})
    return msgs


def _split(task_id: str, policy: SelectionPolicy) -> str:
    h = int(hashlib.sha256(f"{policy.seed}:{task_id}".encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    return "heldout" if h < policy.heldout_fraction else "train"


def _eligible(t: Trajectory, p: SelectionPolicy, skipped: dict[str, int]) -> bool:
    r = t.review
    reason = None
    if r.excluded:
        reason = "excluded"
    elif p.require_approved and not r.approved:
        reason = "not_approved"
    elif p.min_score is not None and (r.score is None or r.score < p.min_score):
        reason = "below_min_score"
    elif any(f in p.reject_flags for f in r.flags):
        reason = "flagged"
    elif t.termination != "completed":
        reason = f"termination_{t.termination}"
    if reason:
        skipped[reason] = skipped.get(reason, 0) + 1
        return False
    return True


def convert(trajectories: list[Trajectory], fmt: DatasetFormat, policy: SelectionPolicy | None = None) -> ConversionResult:
    if fmt not in FORMATS:
        raise ValueError(f"Unknown dataset format '{fmt}'")
    p = policy or SelectionPolicy()
    skipped: dict[str, int] = {}
    splits: dict[str, list[dict]] = {"train": [], "heldout": []}
    prov: list[dict] = []

    def emit(record: dict, sources: list[Trajectory], task_id: str) -> None:
        split = _split(task_id, p)
        splits[split].append(record)
        prov.append({"split": split, "index": len(splits[split]) - 1, "task_id": task_id,
                     "trajectory_ids": [s.id for s in sources], "content_hashes": [s.content_hash() for s in sources],
                     "models": sorted({s.model.model_id for s in sources})})

    if fmt == "preference":
        # Pairs within a task: chosen = approved success, rejected = failure (or lower score). Rejected need not be approved.
        by_task: dict[str, list[Trajectory]] = defaultdict(list)
        for t in trajectories:
            if not t.review.excluded:
                by_task[t.task.task_id].append(t)
        for task_id, group in sorted(by_task.items()):
            chosen = [t for t in group if _eligible(t, p, skipped)]
            rejected = [t for t in group if t.review.label == "failure" or "hallucination" in t.review.flags
                        or "invalid_tool_call" in t.review.flags]
            if not chosen or not rejected:
                skipped["no_pair"] = skipped.get("no_pair", 0) + 1
                continue
            c = max(chosen, key=lambda t: (t.review.score or 0, t.id))
            r = min(rejected, key=lambda t: (t.review.score or 0, t.id))
            cm, rm = to_messages(c), to_messages(r)
            n_prompt = next(i for i, m in enumerate(cm) if m["role"] == "assistant")
            emit({"prompt": cm[:n_prompt], "chosen": cm[n_prompt:], "rejected": rm[n_prompt:]}, [c, r], task_id)
        return ConversionResult(splits["train"], splits["heldout"], prov, skipped)

    for t in sorted(trajectories, key=lambda x: x.id):
        if not _eligible(t, p, skipped):
            continue
        msgs = to_messages(t)
        if fmt == "chat_sft":
            rec = {"messages": msgs}
            if t.task.tools:
                rec["tools"] = t.task.tools
        elif fmt == "tool_calling":
            if not t.tool_calls:
                skipped["no_tool_calls"] = skipped.get("no_tool_calls", 0) + 1
                continue
            rec = {"messages": msgs, "tools": t.task.tools}
        elif fmt == "instruction":
            if not t.final_output:
                skipped["no_final_output"] = skipped.get("no_final_output", 0) + 1
                continue
            prompt = (f"{t.task.system}\n\n" if t.task.system else "") + t.task.prompt
            rec = {"prompt": prompt, "completion": t.final_output}
        else:  # teacher_student
            rec = {"messages": msgs, "tools": t.task.tools,
                   "teacher": {"model_id": t.model.model_id, "name": t.model.name, "provider": t.model.provider}}
        emit(rec, [t], t.task.task_id)
    return ConversionResult(splits["train"], splits["heldout"], prov, skipped)


class DatasetStore:
    """Immutable versions: datasets/<name>/v0001/{train,heldout,provenance}.jsonl + manifest.json."""

    def __init__(self, db: Database, root: Path):
        self.db, self.root = db, root

    def write_version(self, name: str, fmt: DatasetFormat, result: ConversionResult, policy: SelectionPolicy,
                      description: str = "") -> dict:
        if not name.replace("-", "").replace("_", "").isalnum():
            raise ValueError("Dataset name must be alphanumeric with - or _")
        if not result.train:
            raise ValueError("Refusing to write a dataset with an empty training split")
        base = safe_join(self.root, name)
        row = self.db.one("SELECT MAX(version) AS v FROM datasets WHERE name = ?", (name,))
        version = (row["v"] or 0) + 1
        final = safe_join(base, f"v{version:04d}")
        if final.exists():
            raise FileExistsError(f"{final} already exists; versions are immutable")
        staging = safe_join(base, f".staging-{new_id('tmp')}")
        staging.mkdir(parents=True)
        try:
            for split, rows in (("train", result.train), ("heldout", result.heldout), ("provenance", result.provenance)):
                with open(staging / f"{split}.jsonl", "w", encoding="utf-8", newline="\n") as f:
                    for r in rows:
                        f.write(canonical_json(r) + "\n")
            manifest = {
                "name": name, "version": version, "format": fmt, "created_at": utcnow(), "description": description,
                "counts": {"train": len(result.train), "heldout": len(result.heldout)},
                "skipped": result.skipped,
                "policy": {k: (list(v) if isinstance(v, tuple) else v) for k, v in policy.__dict__.items()},
                "sha256": {f: sha256_file(staging / f"{f}.jsonl") for f in ("train", "heldout", "provenance")},
                "source_trajectories": sorted({tid for p in result.provenance for tid in p["trajectory_ids"]}),
            }
            (staging / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
            os.replace(staging, final)
        except Exception:
            shutil.rmtree(staging, ignore_errors=True)
            raise
        ds_id = new_id("ds")
        with self.db.tx() as c:
            c.execute("INSERT INTO datasets(id, name, version, format, path, sha256, record_count, created_at, manifest) "
                      "VALUES (?,?,?,?,?,?,?,?,?)",
                      (ds_id, name, version, fmt, str(final), manifest["sha256"]["train"], len(result.train),
                       manifest["created_at"], json.dumps(manifest)))
        return {"id": ds_id, "path": str(final), **manifest}

    def verify(self, name: str, version: int) -> bool:
        row = self.db.one("SELECT path, manifest FROM datasets WHERE name = ? AND version = ?", (name, version))
        if not row:
            raise KeyError(f"{name} v{version}")
        manifest, path = json.loads(row["manifest"]), Path(row["path"])
        return all(sha256_file(path / f"{f}.jsonl") == h for f, h in manifest["sha256"].items())

    def list(self) -> list[dict]:
        return [{**{k: v for k, v in r.items() if k != "manifest"}, "manifest": json.loads(r["manifest"])}
                for r in self.db.query("SELECT * FROM datasets ORDER BY name, version")]
