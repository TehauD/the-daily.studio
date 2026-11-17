"""Subprocess job manager.

Why subprocesses: the API never holds a CUDA context or torch import; a crashing
trainer cannot take the UI down; cancelling is a process signal, not cooperative.

Rules
- At most ONE GPU job runs at a time (teacher and student share one 16 GB GPU).
- Every job runs `<this interpreter> -m forge.engine …` — the project venv, never a global Python.
- stdout (JSON lines) → logs/jobs/<id>.log; status persisted in SQLite.
- On API start, jobs recorded as running whose PID is gone become 'interrupted'.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from pathlib import Path
from typing import Any

import psutil

from forge.db import Database
from forge.util import new_id, utcnow


class JobError(RuntimeError):
    pass


class JobRunner:
    def __init__(self, db: Database, logs_dir: Path, python: str = sys.executable, cwd: Path | None = None):
        self.db, self.logs_dir, self.python = db, logs_dir, python
        self.cwd = cwd or Path(__file__).resolve().parents[2]  # backend/ (so `-m forge.engine` resolves)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self._procs: dict[str, subprocess.Popen] = {}
        self._lock = threading.Lock()

    def recover(self) -> list[str]:
        stale = []
        for j in self.db.query("SELECT id, pid FROM jobs WHERE status = 'running'"):
            if not j["pid"] or not psutil.pid_exists(j["pid"]):
                stale.append(j["id"])
        with self.db.tx() as c:
            c.executemany("UPDATE jobs SET status='interrupted', ended_at=? WHERE id=?", [(utcnow(), i) for i in stale])
        return stale

    def gpu_busy(self) -> dict | None:
        return self.db.one("SELECT * FROM jobs WHERE gpu = 1 AND status = 'running' LIMIT 1")

    def start(self, kind: str, args: list[str], *, gpu: bool, study_id: str | None = None, label: str = "",
              env: dict[str, str] | None = None) -> dict[str, Any]:
        with self._lock:
            if gpu and (busy := self.gpu_busy()):
                raise JobError(f"GPU is busy with job {busy['id']} ({busy['label']}); one GPU job at a time")
            jid = new_id("job")
            log_path = self.logs_dir / f"{jid}.log"
            argv = [self.python, "-m", "forge.engine", *args]
            child_env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", **(env or {})}
            logf = open(log_path, "w", encoding="utf-8")
            proc = subprocess.Popen(argv, cwd=self.cwd, stdout=logf, stderr=subprocess.STDOUT, env=child_env,
                                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            with self.db.tx() as c:
                c.execute("INSERT INTO jobs(id, kind, label, argv, gpu, study_id, status, pid, log_path, created_at, started_at) "
                          "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                          (jid, kind, label, json.dumps(argv), int(gpu), study_id, "running", proc.pid, str(log_path),
                           utcnow(), utcnow()))
            self._procs[jid] = proc
        threading.Thread(target=self._wait, args=(jid, proc, logf), daemon=True).start()
        return self.get(jid)

    def _wait(self, jid: str, proc: subprocess.Popen, logf: Any) -> None:
        code = proc.wait()
        logf.close()
        row = self.db.one("SELECT status FROM jobs WHERE id = ?", (jid,))
        status = "cancelled" if row and row["status"] == "cancelling" else ("completed" if code == 0 else "failed")
        with self.db.tx() as c:
            c.execute("UPDATE jobs SET status=?, exit_code=?, ended_at=? WHERE id=?", (status, code, utcnow(), jid))
        self._procs.pop(jid, None)

    def cancel(self, jid: str) -> dict[str, Any]:
        j = self.get(jid)
        if j["status"] != "running":
            raise JobError(f"Job {jid} is {j['status']}")
        with self.db.tx() as c:
            c.execute("UPDATE jobs SET status='cancelling' WHERE id=?", (jid,))
        proc = self._procs.get(jid)
        try:
            target = psutil.Process(proc.pid if proc else j["pid"])
            for child in target.children(recursive=True):
                child.terminate()
            target.terminate()
        except psutil.NoSuchProcess:
            pass
        return self.get(jid)

    def get(self, jid: str) -> dict[str, Any]:
        j = self.db.one("SELECT * FROM jobs WHERE id = ?", (jid,))
        if not j:
            raise JobError(f"Unknown job {jid}")
        j["argv"] = json.loads(j["argv"])
        return j

    def list(self, limit: int = 50, study_id: str | None = None) -> list[dict]:
        if study_id:
            rows = self.db.query("SELECT * FROM jobs WHERE study_id = ? ORDER BY created_at DESC LIMIT ?", (study_id, limit))
        else:
            rows = self.db.query("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,))
        for r in rows:
            r["argv"] = json.loads(r["argv"])
        return rows

    def active_count(self) -> int:
        return self.db.one("SELECT COUNT(*) AS n FROM jobs WHERE status IN ('running','cancelling')")["n"]

    def log(self, jid: str, offset: int = 0, max_bytes: int = 256_000) -> dict[str, Any]:
        """Incremental tail: returns parsed JSON events (non-JSON lines as {'text': …}) and the next offset."""
        p = Path(self.get(jid)["log_path"])
        if not p.exists():
            return {"events": [], "offset": offset}
        with open(p, "rb") as f:
            f.seek(offset)
            chunk = f.read(max_bytes)
        cut = chunk.rfind(b"\n") + 1 if len(chunk) == max_bytes else len(chunk)
        text = chunk[:cut].decode("utf-8", errors="replace")
        events = []
        for line in text.splitlines():
            if not line.strip():
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                events.append({"text": line})
        return {"events": events, "offset": offset + cut}
