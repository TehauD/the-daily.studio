"""FORGE Turbo: switch validation, availability, clone-with-other-settings, and real (CPU) training with a switch."""
import json

import pytest

from forge.engine import turbo as tb

NO_GPU = tb.probe(cuda=False)


def test_validation_rules():
    assert tb.validate(None, "cpu", availability=NO_GPU) == tb.DEFAULTS
    with pytest.raises(tb.TurboError, match="Unknown"):
        tb.validate({"warp_drive": True}, "cuda", availability=NO_GPU)
    with pytest.raises(tb.TurboError, match="flash_attention_2"):
        tb.validate({"packing": True}, "cuda", check_available=False)
    with pytest.raises(tb.TurboError, match="need the GPU|needs the GPU"):
        tb.validate({"quant_4bit": True, "liger": True}, "cpu", check_available=False)
    if not tb._has("bitsandbytes"):  # on a machine with bitsandbytes installed this switch is legitimately available
        with pytest.raises(tb.TurboError, match="bitsandbytes"):
            tb.validate({"optim_8bit": True}, "cuda", availability=tb.probe(cuda=True))
    with pytest.raises(tb.TurboError, match="one of"):
        tb.validate({"checkpointing": "sometimes"}, "cpu", availability=NO_GPU)
    ok = tb.validate({"attention": "flash_attention_2", "packing": True}, "cuda", micro_batch=1, check_available=False)
    assert "no effect" in ok["note"]
    assert tb.describe(tb.DEFAULTS) == "standard" and "Activation memory (offload)" in tb.describe({**tb.DEFAULTS, "checkpointing": "offload"})
    assert NO_GPU["switches"]["liger"]["available"] is False and NO_GPU["switches"]["liger"]["why_not"]


def test_clone_and_offload_training_on_cpu(settings, tmp_path):
    torch = pytest.importorskip("torch")
    pytest.importorskip("peft")
    import os

    from fastapi.testclient import TestClient

    from forge.api.app import create_app
    from forge.engine.runtime import OracleBackend
    from forge.engine.study import Study, StudyError
    from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset
    from tests.test_playground_weightlab import TEACHER
    from tests.tiny_model import build_tiny_qwen3
    os.environ["FORGE_ALLOW_CPU"], os.environ["FORGE_ISOLATE_RUNS"] = "1", "0"
    tasks = generate_taskset(TaskSetSpec(groups_per_family=3))
    tiny = build_tiny_qwen3(tmp_path / "tiny", [SYSTEM_PROMPT] + [t.prompt for t in tasks] + [json.dumps(c) for t in tasks for c in t.reference_calls])
    src = Study.init(settings.studies_dir, name="std", profile="smoke", device="cpu", seeds=[0], teacher=TEACHER,
                     student={"name": "tiny", "path": str(tiny)}, arms=["teacher_filtered"],
                     train_overrides={"max_steps": 3, "grad_accum": 2, "min_free_vram_mb": 0, "turbo": dict(tb.DEFAULTS)})
    with pytest.raises(StudyError, match="Collect"):
        Study.clone(src, settings.studies_dir, "x", {"turbo": {}})
    src.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend({t.prompt: t for t in src.tasks()}))
    with pytest.raises(StudyError, match="may only change"):
        Study.clone(src, settings.studies_dir, "x", {"lr": 1.0})
    with pytest.raises(StudyError, match="effective batch"):
        Study.clone(src, settings.studies_dir, "x", {"micro_batch": 4})
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        with c.app.state.forge.db.tx() as cx:
            cx.execute("INSERT INTO studies(id, name, path, profile, created_at) VALUES (?,?,?,?,?)", (src.plan["study_id"], "std", str(src.root), "smoke", src.plan["created_at"]))
        assert c.post(f"/api/studies/{src.plan['study_id']}/clone", json={"name": "x", "turbo": {"liger": True}}).status_code == 422
        r = c.post(f"/api/studies/{src.plan['study_id']}/clone", json={"name": "offload", "turbo": {"checkpointing": "offload"}, "micro_batch": 2, "grad_accum": 1})
        assert r.status_code == 200, r.text
        cl = Study(src.root.parent / r.json()["id"])
        assert cl.plan["cloned_from"]["study_id"] == src.plan["study_id"] and cl.plan["train"]["turbo"]["checkpointing"] == "offload"
        assert cl.state["stages"]["collect"]["status"] == "completed"
        assert (cl.root / "tasks.jsonl").read_bytes() == (src.root / "tasks.jsonl").read_bytes()
        assert cl.episodes("teacher", "train", 0) == src.episodes("teacher", "train", 0)
        for s in (src, cl):
            s.run_stage("build", emit=lambda e: None)
            s.run_stage("train", emit=lambda e: None)
        run = json.loads((cl.run_dir("teacher_filtered", 0) / "run.json").read_text())
        assert run["turbo"]["checkpointing"] == "offload" and run["zero_adapter_max_abs_diff"] == 0.0 and run["base_hash_after"] == run["base_hash_before"]
        rows = c.get(f"/api/studies/{cl.plan['study_id']}/engine-compare").json()["rows"]
        assert [x["is_source"] for x in rows] == [True, False] and all(x["trained"] and x["final_loss"] is not None for x in rows)
        assert rows[1]["engine"] == "Activation memory (offload)" and rows[0]["engine"] == "standard"
        opts = c.get("/api/studies/turbo/options").json()
        assert set(opts["defaults"]) == set(tb.DEFAULTS) and "switches" in opts["availability"]
