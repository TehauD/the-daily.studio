"""Task packs (data-only sharing, re-verified on import) and reproducibility bundles (hash + recompute verification)."""
import hashlib
import json
import zipfile

import pytest

from forge.agents import packs
from forge.agents.agent import Agent


def _rewrite(src, dst, mutate):
    """Copy a pack, let `mutate(files)` change it, and re-hash so only FORGE's own checks can catch the change."""
    with zipfile.ZipFile(src) as z:
        files = {n: z.read(n) for n in z.namelist()}
    info = json.loads(files.pop("pack.json"))
    mutate(files)
    info["files"] = {k: hashlib.sha256(v).hexdigest() for k, v in files.items()}
    with zipfile.ZipFile(dst, "w") as z:
        for k, v in files.items():
            z.writestr(k, v)
        z.writestr("pack.json", json.dumps(info))
    return dst


def test_pack_round_trip_reverifies_and_refuses_bad_packs(tmp_path):
    a = Agent.create(tmp_path / "agents", "desk", "itsm_servicenow", True)
    a.run_tasks(None, per_skill=6, seed=3, source="template")
    n = len(a.tasks_for_study())
    out = packs.export(a, tmp_path / "packs", {"id": "it_desk", "version": "1.2.0", "author": "test", "licence": "CC-BY-4.0"})
    info = packs.inspect(out["path"])
    assert info["pack"]["tasks"] == n and info["pack"]["synthetic"] and info["skills"]
    with pytest.raises(packs.PackError):
        packs.install(tmp_path / "agents2", out["path"], no_sensitive_data=False)
    r = packs.install(tmp_path / "agents2", out["path"], no_sensitive_data=True)
    assert r["tasks_verified"] == n and r["dropped_total"] == 0
    b = Agent(tmp_path / "agents2" / r["agent_id"])
    assert b.meta["from_pack"]["version"] == "1.2.0" and b.meta["steps"]["tasks"]["status"] == "completed"
    assert {t["split"] for t in b.tasks()} == {t["split"] for t in a.tasks_for_study()}

    # a tampered file without re-hashing fails the integrity check
    raw = tmp_path / "raw.zip"
    with zipfile.ZipFile(out["path"]) as z, zipfile.ZipFile(raw, "w") as w:
        for n_ in z.namelist():
            w.writestr(n_, z.read(n_) + (b" " if n_ == "agent.json" else b""))
    with pytest.raises(packs.PackError, match="integrity"):
        packs.inspect(raw)

    # a wrong recorded answer (re-hashed, so it passes integrity) is caught by re-running the tools
    def wrong_answer(files):
        rows = [json.loads(x) for x in files["tasks.jsonl"].decode().splitlines()]
        tgt = next(t for t in rows if t["reference_calls"])
        tgt["reference_answer"] = "definitely not the answer 987654"
        files["tasks.jsonl"] = "".join(json.dumps(t) + "\n" for t in rows).encode()
    r2 = packs.install(tmp_path / "agents3", _rewrite(out["path"], tmp_path / "wrong.zip", wrong_answer), True)
    assert r2["dropped_total"] == 1 and r2["tasks_verified"] == n - 1

    # code is not data: any unexpected file refuses the pack
    with pytest.raises(packs.PackError, match="Unexpected file"):
        packs.inspect(_rewrite(out["path"], tmp_path / "code.zip", lambda f: f.__setitem__("tools.py", b"import os")))

    # personal identifiers refuse the pack
    def phi(files):
        name = next(k for k in files if k.startswith("tables/"))
        rows = json.loads(files[name])
        k0 = next(iter(rows[0]))
        rows[0][k0] = "123-45-6789"
        files[name] = json.dumps(rows).encode()
    with pytest.raises(packs.PackError, match="personal identifiers"):
        packs.install(tmp_path / "agents4", _rewrite(out["path"], tmp_path / "phi.zip", phi), True)


def test_bundle_export_verify_and_tamper(tmp_path):
    from forge.engine import bundle
    from forge.util import canonical_json, sha256_text
    from tests.test_evidence import Wrong, _study
    s = _study(tmp_path, ["teacher_filtered", "shuffled_control"], lambda o: Wrong())
    out = bundle.export(s, tmp_path / "b")
    v = bundle.verify(out["path"])
    assert v["ok"], v["checks"]
    assert any(c["check"] == "recompute analysis_dev.json" and c["ok"] for c in v["checks"])

    # change one raw measurement and re-hash it in BUNDLE.json: the hashes pass, the recomputation does not
    with zipfile.ZipFile(out["path"]) as z:
        files = {n: z.read(n) for n in z.namelist()}
    meta = json.loads(files.pop("BUNDLE.json"))
    ep = next(n for n in files if n.startswith("episodes/teacher_filtered/dev/"))
    lines = files[ep].decode().splitlines()
    flipped = 0
    for i, ln in enumerate(lines):
        row = json.loads(ln)
        e = row["record"]
        if e["score"]["strict_success"] and flipped < 5:
            e["score"]["strict_success"] = False
            lines[i] = json.dumps({"sha256": sha256_text(canonical_json(e)), "record": e})   # a careful forger re-hashes the line too
            flipped += 1
    files[ep] = ("\n".join(lines) + "\n").encode()
    meta["files"][ep] = hashlib.sha256(files[ep]).hexdigest()
    bad = tmp_path / "bad.zip"
    with zipfile.ZipFile(bad, "w") as z:
        for k, val in files.items():
            z.writestr(k, val)
        z.writestr("BUNDLE.json", json.dumps(meta))
    v2 = bundle.verify(bad)
    assert not v2["ok"] and any(c["check"].startswith("recompute") and not c["ok"] for c in v2["checks"])
