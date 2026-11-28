"""Experiment management: configuration identity, run state machine, recovery, artifact lineage.

Invariants:
- An experiment's config is hashed on creation and never mutated.
- Runs follow an explicit state machine; illegal transitions raise.
- Runs left 'running' after a crash are marked 'interrupted' on startup and can be resumed
  from their last checkpoint as a new attempt (the original record is preserved).
- Artifacts are registered with sha256; paths are unique and never overwritten.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from forge.db import Database
from forge.util import canonical_json, new_id, sha256_file, sha256_text, utcnow

KINDS = ("teacher_run", "dataset_build", "sft", "distillation", "evaluation", "export")
TRANSITIONS = {
    "pending": {"running", "cancelled"},
    "running": {"completed", "failed", "cancelled", "interrupted"},
    "interrupted": {"cancelled"},  # resumption creates a new run
    "completed": set(), "failed": set(), "cancelled": set(),
}


class ExperimentError(ValueError):
    pass


class ExperimentManager:
    def __init__(self, db: Database):
        self.db = db

    def create(self, name: str, kind: str, config: dict[str, Any], parent_id: str | None = None, notes: str | None = None) -> dict:
        if kind not in KINDS:
            raise ExperimentError(f"kind must be one of {KINDS}")
        eid = new_id("exp")
        with self.db.tx() as c:
            c.execute("INSERT INTO experiments(id, name, kind, created_at, config, config_hash, parent_id, notes) VALUES (?,?,?,?,?,?,?,?)",
                      (eid, name, kind, utcnow(), canonical_json(config), sha256_text(canonical_json(config)), parent_id, notes))
        return self.get(eid)

    def get(self, eid: str) -> dict:
        e = self.db.one("SELECT * FROM experiments WHERE id = ?", (eid,))
        if not e:
            raise ExperimentError(f"Unknown experiment {eid}")
        e["config"] = json.loads(e["config"])
        e["runs"] = self.runs(eid)
        return e

    def list(self) -> list[dict]:
        rows = self.db.query("SELECT e.id, e.name, e.kind, e.created_at, e.config_hash, e.parent_id, "
                             "(SELECT COUNT(*) FROM runs r WHERE r.experiment_id = e.id) AS run_count, "
                             "(SELECT status FROM runs r WHERE r.experiment_id = e.id ORDER BY attempt DESC LIMIT 1) AS last_status "
                             "FROM experiments e ORDER BY e.created_at DESC")
        return rows

    def runs(self, eid: str) -> list[dict]:
        rows = self.db.query("SELECT * FROM runs WHERE experiment_id = ? ORDER BY attempt", (eid,))
        for r in rows:
            r["metrics"] = json.loads(r["metrics"])
        return rows

    def start_run(self, eid: str) -> dict:
        self.get(eid)
        rid = new_id("run")
        attempt = (self.db.one("SELECT MAX(attempt) AS a FROM runs WHERE experiment_id = ?", (eid,))["a"] or 0) + 1
        with self.db.tx() as c:
            c.execute("INSERT INTO runs(id, experiment_id, attempt, status, created_at) VALUES (?,?,?,?,?)",
                      (rid, eid, attempt, "pending", utcnow()))
        return self.run(rid)

    def run(self, rid: str) -> dict:
        r = self.db.one("SELECT * FROM runs WHERE id = ?", (rid,))
        if not r:
            raise ExperimentError(f"Unknown run {rid}")
        r["metrics"] = json.loads(r["metrics"])
        return r

    def transition(self, rid: str, to: str, error: str | None = None, metrics: dict | None = None) -> dict:
        r = self.run(rid)
        if to not in TRANSITIONS.get(r["status"], set()):
            raise ExperimentError(f"Illegal transition {r['status']} → {to}")
        now = utcnow()
        sets = {"status": to}
        if to == "running":
            sets["started_at"] = now
        if to in ("completed", "failed", "cancelled", "interrupted"):
            sets["ended_at"] = now
        if error:
            sets["error"] = error
        if metrics is not None:
            sets["metrics"] = json.dumps({**r["metrics"], **metrics})
        with self.db.tx() as c:
            c.execute(f"UPDATE runs SET {', '.join(f'{k} = ?' for k in sets)} WHERE id = ?", (*sets.values(), rid))
        return self.run(rid)

    def checkpoint(self, rid: str, checkpoint_path: str, metrics: dict | None = None) -> dict:
        r = self.run(rid)
        if r["status"] != "running":
            raise ExperimentError("Checkpoints can only be recorded for running runs")
        with self.db.tx() as c:
            c.execute("UPDATE runs SET last_checkpoint = ?, metrics = ? WHERE id = ?",
                      (checkpoint_path, json.dumps({**r["metrics"], **(metrics or {})}), rid))
        return self.run(rid)

    def recover_interrupted(self) -> list[str]:
        """Call at startup: any run still 'running' belongs to a dead process."""
        stale = [r["id"] for r in self.db.query("SELECT id FROM runs WHERE status = 'running'")]
        for rid in stale:
            self.transition(rid, "interrupted", error="Process exited while run was active")
        return stale

    def resume(self, rid: str) -> dict:
        r = self.run(rid)
        if r["status"] != "interrupted":
            raise ExperimentError("Only interrupted runs can be resumed")
        new = self.start_run(r["experiment_id"])
        with self.db.tx() as c:
            c.execute("UPDATE runs SET resumed_from_run_id = ?, last_checkpoint = ? WHERE id = ?",
                      (rid, r["last_checkpoint"], new["id"]))
        return self.run(new["id"])

    def active_count(self) -> int:
        return self.db.one("SELECT COUNT(*) AS n FROM runs WHERE status = 'running'")["n"]

    # --- artifacts ---
    def register_artifact(self, run_id: str | None, kind: str, path: Path, parent_artifact_id: str | None = None,
                          metadata: dict | None = None) -> dict:
        if not path.exists():
            raise ExperimentError(f"Artifact does not exist: {path}")
        if self.db.one("SELECT id FROM artifacts WHERE path = ?", (str(path),)):
            raise ExperimentError(f"Artifact path already registered (immutable): {path}")
        if path.is_dir():
            files = sorted(p for p in path.rglob("*") if p.is_file())
            digest = sha256_text(canonical_json({str(p.relative_to(path)).replace("\\", "/"): sha256_file(p) for p in files}))
            size = sum(p.stat().st_size for p in files)
        else:
            digest, size = sha256_file(path), path.stat().st_size
        aid = new_id("art")
        with self.db.tx() as c:
            c.execute("INSERT INTO artifacts(id, run_id, kind, path, sha256, size_bytes, parent_artifact_id, created_at, metadata) "
                      "VALUES (?,?,?,?,?,?,?,?,?)", (aid, run_id, kind, str(path), digest, size, parent_artifact_id,
                                                    utcnow(), json.dumps(metadata or {})))
        return self.db.one("SELECT * FROM artifacts WHERE id = ?", (aid,))

    def lineage(self, artifact_id: str) -> list[dict]:
        chain, cur = [], artifact_id
        while cur:
            a = self.db.one("SELECT * FROM artifacts WHERE id = ?", (cur,))
            if not a:
                break
            chain.append(a)
            cur = a["parent_artifact_id"]
        return chain
