"""Training-data overlap (contamination check) and the checkpoint timeline."""
import json

import pytest

from forge.engine import lineage_eval as le
from forge.engine.runtime import OracleBackend
from forge.engine.study import Study


def _study(tmp_path, student_path="/nonexistent", seeds=(0,)):
    s = Study.init(tmp_path / "studies", name="lineage", profile="smoke", device="cpu", seeds=list(seeds),
                   teacher={"provider": "lmstudio", "endpoint": "http://127.0.0.1:9/v1", "model": "t"},
                   student={"name": "s", "path": str(student_path)}, arms=["teacher_filtered"], train_overrides={"min_free_vram_mb": 0})
    s.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend({t.prompt: t for t in s.tasks()}))
    return s


def test_windows_and_url_rules():
    w = le.windows(" ".join(f"w{i}" for i in range(40)))
    assert len(w) == 4 and all(len(x.split()) == 13 for x in w) and w[0].startswith("w0 ") and w[-1].endswith("w39")
    assert le.windows("too short to test") == [] and le.windows("one two three four five six seven eight") == ["one two three four five six seven eight"]
    assert le.check_index_url("https://api.infini-gram.io/") and le.check_index_url("http://127.0.0.1:5000/")
    for bad in ("http://example.com/", "ftp://x", "", "https://"):
        with pytest.raises(le.LineageError):
            le.check_index_url(bad)


def test_overlap_finds_planted_passages_and_feeds_adequacy(tmp_path):
    s = _study(tmp_path)
    test = [t for t in s.tasks() if t.split == "test"]
    planted = {test[0].task_id, test[1].task_id}
    corpus = " || ".join(t.prompt for t in test if t.task_id in planted)
    sent = []

    def count(q):  # stands in for the index: exact substring occurrences in a tiny "training corpus"
        sent.append(q)
        return corpus.count(q)
    out = le.overlap(s, {"split": "test", "index": "stub", "url": "https://x"}, count_fn=count)
    flagged = {e["task_id"] for e in out["examples"]}
    assert planted & flagged == {t for t in planted if le.windows(next(x.prompt for x in test if x.task_id == t))}
    assert out["hits"] == len(flagged) and out["tested"] + out["too_short"] == len(test)
    assert all(len(q.split()) <= 13 for q in sent)                                       # only question windows were sent
    assert not any(t.reference_answer in q for t in test for q in sent if len(t.reference_answer) > 12)
    from forge.engine.governance import adequacy
    a = adequacy(s)
    assert a["overlap"]["hits"] == out["hits"]
    hit_skills = {e["skill"] for e in out["examples"]}
    assert all(any(i["kind"] == "seen_in_training" for i in sk["issues"]) for sk in a["skills"] if sk["skill"] in hit_skills)


def test_checkpoint_timeline_and_compare(tmp_path, monkeypatch):
    monkeypatch.setenv("FORGE_ALLOW_CPU", "1")
    ckdir = tmp_path / "models--allenai--Olmo-3-sft" / "snapshots" / "feedface01"
    ckdir.mkdir(parents=True)
    s = _study(tmp_path)
    perfect = OracleBackend({t.prompt: t for t in s.tasks()})
    r = le.evaluate_checkpoint(s, {"label": "SFT stage", "order": 2, "stage": "SFT", "path": str(ckdir), "split": "dev"}, factory=lambda p: perfect)
    assert r["arm"] == "ckpt_sft_stage"
    le.evaluate_checkpoint(s, {"label": "SFT stage", "path": str(ckdir), "split": "dev"}, factory=lambda p: perfect)   # resumes, no duplicates
    with pytest.raises(le.LineageError):
        le.evaluate_checkpoint(s, {"label": "SFT stage", "path": str(ckdir), "split": "test"}, factory=lambda p: perfect)  # not sealed
    tl = le.timeline(s)
    ck = [p for p in tl["points"] if p["kind"] == "checkpoint"]
    n_dev = sum(1 for t in s.tasks() if t.split == "dev")
    assert len(ck) == 1 and ck[0]["n"] == n_dev and ck[0]["rate"] == 1.0 and ck[0]["revision"] == "feedface01" and ck[0]["ci"][1] == 1.0
    assert any(p["kind"] == "teacher" for p in tl["points"])
    from forge.engine import compare as cmp
    subs = cmp.subjects([s], tmp_path)
    lab = next(x for x in subs if x["ref"].endswith(":ckpt_sft_stage"))
    assert "checkpoint" in lab["label"]
    A = cmp.load_subject(f"arm:{s.plan['study_id']}:ckpt_sft_stage", "dev", lambda sid: s, tmp_path)
    B = cmp.load_subject(f"arm:{s.plan['study_id']}:teacher", "dev", lambda sid: s, tmp_path)
    out = cmp.compare(A, B, weights=False)
    assert out["comparable"] and out["overall"]["n_tasks"] == n_dev and A.describe["what"] == "checkpoint · SFT stage"
    h = cmp.history([s], tmp_path)
    assert not any("ckpt" in (p.get("arm") or "") for p in h["points"])


def test_real_olmo3_checkpoint_runs(tmp_path, monkeypatch):
    """A real (tiny) OLMo 3 checkpoint through the timeline path: real generate, scored by the same tools."""
    pytest.importorskip("torch")
    pytest.importorskip("transformers.models.olmo3")
    monkeypatch.setenv("FORGE_ALLOW_CPU", "1")
    from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset
    from tests.tiny_model import build_tiny_olmo3
    tasks = generate_taskset(TaskSetSpec(groups_per_family=3))
    olmo = build_tiny_olmo3(tmp_path / "olmo", [SYSTEM_PROMPT] + [t.prompt for t in tasks])
    s = _study(tmp_path)
    s.plan["eval"]["max_new_tokens"] = 8
    le.evaluate_checkpoint(s, {"label": "tiny base", "order": 1, "path": str(olmo), "split": "dev"})
    pt = next(p for p in le.timeline(s)["points"] if p["kind"] == "checkpoint")
    assert pt["n"] == sum(1 for t in s.tasks() if t.split == "dev") and 0 <= pt["rate"] <= 1


def test_lineage_api(settings, tmp_path):
    from fastapi.testclient import TestClient

    from forge.api.app import create_app
    s = _study(tmp_path)
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        with c.app.state.forge.db.tx() as cx:
            cx.execute("INSERT INTO studies(id, name, path, profile, created_at) VALUES (?,?,?,?,?)", (s.plan["study_id"], "lineage", str(s.root), "smoke", s.plan["created_at"]))
        sid = s.plan["study_id"]
        assert c.get("/api/lineage/index").json()["enabled"] is False
        assert c.post(f"/api/studies/{sid}/overlap", json={}).status_code == 409                          # off until configured
        assert c.put("/api/lineage/index", json={"enabled": True, "url": "http://example.com/", "index": "x"}).status_code == 422
        assert c.put("/api/lineage/index", json={"enabled": True, "url": "https://api.infini-gram.io/", "index": ""}).status_code == 422
        ok = c.put("/api/lineage/index", json={"enabled": True, "url": "https://api.infini-gram.io/", "index": "v4_example"}).json()
        assert ok["enabled"] and ok["index"] == "v4_example"
        assert c.get(f"/api/studies/{sid}/overlap").status_code == 404
        assert c.post(f"/api/studies/{sid}/checkpoints", json={"model_id": "nope", "label": "x"}).status_code == 404
        tl = c.get(f"/api/studies/{sid}/checkpoints").json()
        assert tl["sealed"] is False and any(p["kind"] == "teacher" for p in tl["points"])
