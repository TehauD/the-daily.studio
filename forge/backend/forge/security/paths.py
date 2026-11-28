"""Path validation. Every user-supplied filesystem path passes through here.

Threats addressed: traversal (`..`), symlink escape from an allowed root,
UNC/device paths on Windows, and NUL-byte injection.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


class PathSecurityError(ValueError):
    pass


_WIN_DEVICE_PREFIXES = ("\\\\?\\", "\\\\.\\")


def _reject_raw(raw: str) -> None:
    if not raw or "\x00" in raw:
        raise PathSecurityError("Empty path or NUL byte in path")
    if sys.platform == "win32" or "\\" in raw:
        if raw.startswith(_WIN_DEVICE_PREFIXES):
            raise PathSecurityError("Device namespace paths are not allowed")
        if raw.startswith("\\\\"):
            raise PathSecurityError("UNC/network paths are not allowed (local-first)")


def validate_user_directory(raw: str) -> Path:
    """A user-selected model directory: must be absolute, exist, and be a directory."""
    _reject_raw(raw)
    p = Path(os.path.expanduser(raw))
    if not p.is_absolute():
        raise PathSecurityError("Model directories must be absolute paths")
    resolved = p.resolve(strict=False)
    if not resolved.exists():
        raise PathSecurityError(f"Directory does not exist: {resolved}")
    if not resolved.is_dir():
        raise PathSecurityError(f"Not a directory: {resolved}")
    return resolved


def safe_join(root: Path, *parts: str) -> Path:
    """Join untrusted parts under root; reject anything resolving outside root (incl. symlinks)."""
    for part in parts:
        _reject_raw(part)
        if Path(part).is_absolute() or Path(part).drive:
            raise PathSecurityError("Absolute path components are not allowed")
    root_resolved = root.resolve(strict=False)
    candidate = root_resolved.joinpath(*parts).resolve(strict=False)
    if candidate != root_resolved and root_resolved not in candidate.parents:
        raise PathSecurityError("Path escapes its permitted root")
    return candidate


def is_within(path: Path, roots: list[Path]) -> bool:
    p = path.resolve(strict=False)
    for r in roots:
        rr = r.resolve(strict=False)
        if p == rr or rr in p.parents:
            return True
    return False
