"""SQLite persistence with forward-only, versioned migrations.

Why SQLite: zero-ops, single-file, transactional, trivially backed up alongside
artifacts. WAL mode allows the API to read while a job writes.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

MIGRATIONS: list[str] = [
    # v1 — Phase 1 foundation + experiment/trajectory/dataset contracts.
    """
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

    CREATE TABLE models (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        locator TEXT NOT NULL,
        name TEXT NOT NULL,
        architecture TEXT,
        parameter_count INTEGER,
        parameter_count_source TEXT,
        quantization TEXT,
        context_length INTEGER,
        format TEXT NOT NULL,
        storage_path TEXT,
        size_bytes INTEGER,
        license TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        capabilities TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'available',
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        UNIQUE(provider, locator)
    );

    CREATE TABLE model_roles (
        model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('teacher','student')),
        assigned_at TEXT NOT NULL,
        PRIMARY KEY (model_id, role)
    );

    CREATE TABLE discovery_runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        results TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE experiments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TEXT NOT NULL,
        config TEXT NOT NULL,
        config_hash TEXT NOT NULL,
        parent_id TEXT REFERENCES experiments(id),
        notes TEXT
    );

    CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        experiment_id TEXT NOT NULL REFERENCES experiments(id),
        attempt INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        resumed_from_run_id TEXT REFERENCES runs(id),
        last_checkpoint TEXT,
        error TEXT,
        metrics TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE artifacts (
        id TEXT PRIMARY KEY,
        run_id TEXT REFERENCES runs(id),
        kind TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        sha256 TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        parent_artifact_id TEXT REFERENCES artifacts(id),
        created_at TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE trajectories (
        id TEXT PRIMARY KEY,
        experiment_id TEXT REFERENCES experiments(id),
        run_id TEXT REFERENCES runs(id),
        task_id TEXT NOT NULL,
        model_id TEXT,
        path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT 'unlabeled',
        score REAL,
        approved INTEGER NOT NULL DEFAULT 0,
        excluded INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    );

    CREATE TABLE datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version INTEGER NOT NULL,
        format TEXT NOT NULL,
        path TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        record_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        manifest TEXT NOT NULL,
        UNIQUE(name, version)
    );
    CREATE INDEX idx_runs_experiment ON runs(experiment_id);
    CREATE INDEX idx_traj_task ON trajectories(task_id);
    """,
    # v2 — subprocess jobs (one GPU job at a time) and the study index.
    """
    CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        argv TEXT NOT NULL,
        gpu INTEGER NOT NULL DEFAULT 0,
        study_id TEXT,
        status TEXT NOT NULL,
        pid INTEGER,
        exit_code INTEGER,
        log_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT
    );
    CREATE INDEX idx_jobs_status ON jobs(status);
    CREATE TABLE studies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        profile TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """,
]


class Database:
    def __init__(self, path: Path | str):
        self.path = str(path)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        if self.path != ":memory:":
            self._conn.execute("PRAGMA journal_mode = WAL")
        self._migrate()

    def _migrate(self) -> None:
        with self._lock:
            self._conn.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)")
            row = self._conn.execute("SELECT MAX(version) FROM schema_version").fetchone()
            current = row[0] or 0
            for idx, script in enumerate(MIGRATIONS, start=1):
                if idx <= current:
                    continue
                self._conn.execute("BEGIN")
                try:
                    for stmt in filter(None, (s.strip() for s in script.split(";"))):
                        self._conn.execute(stmt)
                    self._conn.execute("INSERT INTO schema_version(version) VALUES (?)", (idx,))
                    self._conn.execute("COMMIT")
                except Exception:
                    self._conn.execute("ROLLBACK")
                    raise

    @property
    def schema_version(self) -> int:
        return self._conn.execute("SELECT MAX(version) FROM schema_version").fetchone()[0]

    @contextmanager
    def tx(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                yield self._conn
                self._conn.execute("COMMIT")
            except Exception:
                self._conn.execute("ROLLBACK")
                raise

    def query(self, sql: str, params: tuple | dict = ()) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(r) for r in self._conn.execute(sql, params).fetchall()]

    def one(self, sql: str, params: tuple | dict = ()) -> dict[str, Any] | None:
        rows = self.query(sql, params)
        return rows[0] if rows else None

    # --- settings (JSON values) ---
    def get_setting(self, key: str, default: Any = None) -> Any:
        row = self.one("SELECT value FROM settings WHERE key = ?", (key,))
        return json.loads(row["value"]) if row else default

    def set_setting(self, key: str, value: Any) -> None:
        with self.tx() as c:
            c.execute(
                "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, json.dumps(value)),
            )

    def close(self) -> None:
        self._conn.close()
