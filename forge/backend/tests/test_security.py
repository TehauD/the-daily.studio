import os
import sys

import pytest

from forge.config import Settings, is_loopback_host
from forge.security.paths import PathSecurityError, safe_join, validate_user_directory


def test_safe_join_blocks_traversal(tmp_path):
    with pytest.raises(PathSecurityError):
        safe_join(tmp_path, "..", "etc")
    with pytest.raises(PathSecurityError):
        safe_join(tmp_path, "a/../../b")
    with pytest.raises(PathSecurityError):
        safe_join(tmp_path, str(tmp_path / "abs"))
    with pytest.raises(PathSecurityError):
        safe_join(tmp_path, "a\x00b")
    assert safe_join(tmp_path, "a", "b") == (tmp_path / "a" / "b").resolve()


@pytest.mark.skipif(sys.platform == "win32", reason="symlink creation needs privileges on Windows")
def test_safe_join_blocks_symlink_escape(tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    root = tmp_path / "root"
    root.mkdir()
    os.symlink(outside, root / "link")
    with pytest.raises(PathSecurityError):
        safe_join(root, "link", "x")


def test_validate_user_directory(tmp_path):
    assert validate_user_directory(str(tmp_path)) == tmp_path.resolve()
    for bad in ("relative/path", str(tmp_path / "missing"), "\\\\server\\share", ""):
        with pytest.raises(PathSecurityError):
            validate_user_directory(bad)
    f = tmp_path / "f"
    f.write_text("x")
    with pytest.raises(PathSecurityError):
        validate_user_directory(str(f))


def test_bind_policy(tmp_path):
    assert is_loopback_host("127.0.0.1") and is_loopback_host("::1") and is_loopback_host("localhost")
    assert not is_loopback_host("0.0.0.0")
    with pytest.raises(RuntimeError):
        Settings(home=tmp_path, host="0.0.0.0", allow_remote_bind=False).validate_bind()
    Settings(home=tmp_path, host="0.0.0.0", allow_remote_bind=True).validate_bind()
