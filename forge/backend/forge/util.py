from __future__ import annotations

import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def canonical_json(obj: Any) -> str:
    """Deterministic serialization — the basis for every content hash in FORGE."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while block := f.read(chunk):
            h.update(block)
    return h.hexdigest()


def stable_id(prefix: str, *parts: str) -> str:
    return f"{prefix}_{hashlib.sha1('|'.join(parts).encode()).hexdigest()[:16]}"


def atomic_replace(tmp: "os.PathLike[str] | str", dst: "os.PathLike[str] | str", attempts: int = 20) -> None:
    """os.replace with a short retry: on Windows the target can be briefly locked by antivirus, an indexer, or
    a reader in another FORGE process (PermissionError / WinError 5, 32). Never silently skips the write."""
    import time as _t
    for i in range(attempts):
        try:
            os.replace(tmp, dst)
            return
        except PermissionError:
            if i == attempts - 1:
                raise
            _t.sleep(0.05 * (i + 1))


def write_json_atomic(path: "os.PathLike[str] | str", text: str) -> None:
    """Write text to a process-unique temp file next to `path`, then atomically replace it."""
    from pathlib import Path as _P
    p = _P(path)
    tmp = p.with_name(f"{p.name}.tmp-{os.getpid()}-{uuid.uuid4().hex[:6]}")
    tmp.write_text(text, encoding="utf-8")
    try:
        atomic_replace(tmp, p)
    finally:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
