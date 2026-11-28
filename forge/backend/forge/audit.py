"""Audit trail: every change made through FORGE's API, who made it, and whether the record is intact.

Each mutating API call (POST / PUT / DELETE) appends one line to `FORGE_HOME/audit/audit.jsonl`: time, actor, method,
path, response status, and a SHA-256 chained to the previous line, so a deleted or edited line breaks the chain and is
reported. Request bodies are never stored (they can contain task text); the path names what was acted on.

The actor is the reviewer name the browser sends (Settings / review panels; FORGE has no user accounts), or "unnamed".
It is a self-declared label for accountability between colleagues, not authentication.
"""
from __future__ import annotations

import hashlib
import json
import re
import threading
from pathlib import Path
from typing import Any

from forge.util import utcnow

ACTOR_HEADER = "X-Forge-Actor"
_LOCK = threading.Lock()
GENESIS = "0" * 64

# (method, path regex) → readable action. First match wins.
ACTIONS: list[tuple[str, str, str]] = [
    ("POST", r"^/api/studies$", "created a study"),
    ("POST", r"^/api/studies/[^/]+/stages/([a-z_]+)$", "ran stage {0}"),
    ("POST", r"^/api/studies/[^/]+/stress$", "started a stress test"),
    ("POST", r"^/api/studies/[^/]+/datacurve$", "started the data-size curve"),
    ("POST", r"^/api/studies/[^/]+/gguf/check$", "checked a GGUF in LM Studio"),
    ("POST", r"^/api/studies/[^/]+/gguf$", "made a GGUF"),
    ("POST", r"^/api/studies/[^/]+/playground$", "ran the playground"),
    ("POST", r"^/api/studies/[^/]+/lens$", "ran the distillation lens"),
    ("POST", r"^/api/decisions$", "recorded an accept / override decision"),
    ("POST", r"^/api/agents$", "created an agent"),
    ("PUT", r"^/api/agents/[^/]+$", "edited an agent"),
    ("POST", r"^/api/agents/[^/]+/steps/tasks$", "wrote practice tasks"),
    ("POST", r"^/api/agents/[^/]+/review$", "reviewed a practice task"),
    ("POST", r"^/api/agents/[^/]+/try$", "tried an agent tool"),
    ("POST", r"^/api/knowledge$", "created a document pack"),
    ("POST", r"^/api/knowledge/[^/]+/steps/([a-z_]+)$", "ran document step {0}"),
    ("POST", r"^/api/knowledge/[^/]+/search$", "searched documents"),
    ("POST", r"^/api/studies/[^/]+/datasets/[^/]+/verify$", "verified a dataset"),
    ("POST", r"^/api/agents/[^/]+/tables$", "added a table"),
    ("DELETE", r"^/api/agents/[^/]+/tables/[^/]+$", "removed a table"),
    ("DELETE", r"^/api/agents/[^/]+$", "deleted an agent"),
    ("POST", r"^/api/weightlab$", "created a Weight Lab variant"),
    ("POST", r"^/api/weightlab/[^/]+/evaluate$", "evaluated a Weight Lab variant"),
    ("DELETE", r"^/api/weightlab/[^/]+$", "deleted a Weight Lab variant"),
    ("POST", r"^/api/autotune", "auto-tune: {path}"),
    ("PUT", r"^/api/settings/([a-z\-]+)$", "changed settings: {0}"),
    ("PUT", r"^/api/assistant/config$", "changed the AI assistant settings"),
    ("POST", r"^/api/assistant/preview$", "previewed an AI assistant request"),
    ("POST", r"^/api/assistant/ask$", "asked the AI assistant"),
    ("POST", r"^/api/jobs/[^/]+/cancel$", "cancelled a job"),
]


def describe(method: str, path: str) -> str:
    for m, rx, text in ACTIONS:
        if m == method:
            mm = re.match(rx, path)
            if mm:
                return text.format(*mm.groups(), path=path)
    return f"{method} {path}"


def clean_actor(v: str | None) -> str:
    v = re.sub(r"[^\w .,'@\-]", "", (v or "").strip())[:60]
    return v or "unnamed"


class Audit:
    def __init__(self, home: Path):
        self.path = home / "audit" / "audit.jsonl"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _last_hash(self) -> str:
        if not self.path.exists() or self.path.stat().st_size == 0:
            return GENESIS
        with open(self.path, "rb") as f:
            f.seek(max(0, self.path.stat().st_size - 4096))
            lines = [x for x in f.read().splitlines() if x.strip()]
        try:
            return json.loads(lines[-1])["hash"]
        except (IndexError, ValueError, KeyError):
            return GENESIS

    def append(self, actor: str, method: str, path: str, status: int) -> dict:
        with _LOCK:
            rec = {"at": utcnow(), "actor": clean_actor(actor), "method": method, "path": path[:300], "status": status,
                   "what": describe(method, path), "prev": self._last_hash()}
            rec["hash"] = hashlib.sha256(json.dumps(rec, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            with open(self.path, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            return rec

    def read(self) -> tuple[list[dict], dict[str, Any]]:
        """All records, plus chain verification: the first line where the chain breaks, if any."""
        if not self.path.exists():
            return [], {"ok": True, "records": 0, "broken_at": None}
        recs, prev, broken = [], GENESIS, None
        for i, line in enumerate(self.path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            try:
                r = json.loads(line)
                body = {k: v for k, v in r.items() if k != "hash"}
                ok = r["prev"] == prev and hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False).encode()).hexdigest() == r["hash"]
            except (ValueError, KeyError):
                ok, r = False, {"at": "", "actor": "?", "what": "unreadable line", "path": "", "hash": ""}
            if not ok and broken is None:
                broken = i
            prev = r.get("hash", "")
            recs.append(r)
        return recs, {"ok": broken is None, "records": len(recs), "broken_at": broken}
