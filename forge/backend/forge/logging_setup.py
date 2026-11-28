"""Structured JSON logging (one event per line) for pipeline-friendly observability."""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        extra = getattr(record, "fields", None)
        if isinstance(extra, dict):
            payload.update(extra)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(logs_dir: Path | None = None, level: int = logging.INFO) -> None:
    root = logging.getLogger("forge")
    if root.handlers:
        return
    root.setLevel(level)
    stream = logging.StreamHandler(sys.stdout)
    stream.setFormatter(JsonFormatter())
    root.addHandler(stream)
    if logs_dir is not None:
        logs_dir.mkdir(parents=True, exist_ok=True)
        fh = logging.FileHandler(logs_dir / "forge.jsonl", encoding="utf-8")
        fh.setFormatter(JsonFormatter())
        root.addHandler(fh)


def log_event(logger: logging.Logger, level: int, msg: str, **fields) -> None:
    logger.log(level, msg, extra={"fields": fields})
