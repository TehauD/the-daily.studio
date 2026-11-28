"""Weight Lab exactness, variant evaluation, the Agent Playground, human review of practice tasks, decisions."""
import json

import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("peft")

from forge.agents.agent import Agent, AgentError  # noqa: E402
from forge.engine import weightlab  # noqa: E402
from forge.engine.playground import PlaygroundError, run as play  # noqa: E402
from forge.engine.runtime import OracleBackend, TransformersBackend  # noqa: E402
from forge.engine.study import Study, StudyError  # noqa: E402
from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset  # noqa: E402
from tests.tiny_model import build_tiny_qwen3  # noqa: E402

TEACHER = {"provider": "lmstudio", "endpoint": "http://127.0.0.1:9/v1", "model": "t"}


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    import os
    os.environ["FORGE_ALLOW_CPU"], os.environ["FORGE_ISOLATE_RUNS"] = "1", "0"
    base = tmp_path_factory.mktemp("wl")
    tasks = generate_taskset(TaskSetSpec(groups_per_family=8))
    corpus = [SYSTEM_PROMPT] + [t.prompt for t in tasks] + [json.dumps(c) for t in tasks for c in t.reference_calls]
    tiny = build_tiny_qwen3(base / "tiny", corpus)
    st = Study.init(base / "studies", name="wl", profile="smoke", device="cpu", seeds=[0, 1], teacher=TEACHER,
                    student={"name": "tiny", "path": str(tiny)}, arms=["teacher_filtered"],
                    train_overrides={"max_steps": 3, "grad_accum": 1, "min_free_vram_mb": 0})
    st.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend({t.prompt: t for t in st.tasks()}))
    st.run_stage("build", emit=lambda e: None)
    st.run_stage("train", emit=lambda e: None)
    return st, base


def _dw(adapter_dir, name):
    cfg, t = weightlab._load(adapter_dir)
    a, b = weightlab._modules(t)[name]
    return weightlab._scaling(cfg) * (b.float() @ a.float())


def test_merge_scale_mask_and_rank_are_exact(trained, tmp_path):
    st, _ = trained
    a0, a1 = st.run_dir("teacher_filtered", 0) / "adapter", st.run_dir("teacher_filtered", 1) / "adapter"
    rep = weightlab.build([{"adapter": a0, "weight": 0.6}, {"adapter": a1, "weight": 0.4}], tmp_path / "m", strength=1.5)
    name = next(iter(weightlab._modules(weightlab._load(a0)[1])))
    want = 1.5 * (0.6 * _dw(a0, name) + 0.4 * _dw(a1, name))
    assert torch.allclose(_dw(tmp_path / "m" / "adapter", name), want, atol=1e-6, rtol=1e-4) and rep["rank"] == 32
    zero = weightlab.build([{"adapter": a0, "weight": 1}], tmp_path / "z", strength=0.0)
    assert zero["masked_modules"] == zero["modules"]
    att = weightlab.build([{"adapter": a0, "weight": 1}], tmp_path / "a", modules="attention", layers=(0, 0))
    for n in weightlab._modules(weightlab._load(tmp_path / "a" / "adapter")[1]):
        keep = weightlab.module_kind(n) == "attention" and weightlab.layer_of(n) == 0
        assert (float(_dw(tmp_path / "a" / "adapter", n).abs().max()) > 0) == keep or float(_dw(a0, n).abs().max()) == 0
    full = weightlab.build([{"adapter": a0, "weight": 1}], tmp_path / "r16", rank=16)
    assert torch.allclose(_dw(tmp_path / "r16" / "adapter", name), _dw(a0, name), atol=1e-6) and full["rank_energy_kept"] > 0.999
    small = weightlab.build([{"adapter": a0, "weight": 1}], tmp_path / "r2", rank=2)
    assert small["rank"] == 2 and 0 < small["rank_energy_kept"] < 1
    with pytest.raises(weightlab.WeightLabError):
        weightlab.build([{"adapter": a0, "weight": 1}], tmp_path / "bad", rank=99)


def test_variant_evaluation_and_playground(trained):
    st, base = trained
    v = weightlab.create_variant(base / "weightlab", "seed average", {
        "sources": [{"adapter": str(st.run_dir("teacher_filtered", s) / "adapter"), "weight": 0.5} for s in (0, 1)],
        "strength": 1.0, "layers": None, "modules": "all", "rank": None, "base_hash": st.plan.get("base_hash")})
    weightlab.run_build(v)
    assert v.recipe["status"] == "built" and (v.adapter / "adapter_config.json").exists()
    res = weightlab.evaluate(v, st)
    assert res["split"] == "dev" and res["variant"]["n"] == len([t for t in st.tasks() if t.split == "dev"])
    assert set(res) >= {"base", "tuned", "teacher"} and v.evaluations()[st.plan["study_id"]]["variant"]["n"] == res["variant"]["n"]

    tasks = {t.prompt: t for t in st.tasks()}
    path = st.plan["student"]["path"]

    def backend_for(lane):
        if lane["kind"] == "teacher":
            return OracleBackend(tasks)
        ad = None if lane["kind"] == "base" else (str(st.run_dir(lane["arm"], lane["seed"]) / "adapter") if lane["kind"] == "adapter" else str(v.adapter))
        return TransformersBackend(path, ad, device="cpu", max_new_tokens=48)
    dev = next(t for t in st.tasks() if t.split == "dev")
    lanes = [{"kind": "teacher", "label": "teacher"}, {"kind": "base", "label": "base"},
             {"kind": "adapter", "arm": "teacher_filtered", "seed": 0, "label": "tuned s0"}, {"kind": "variant", "path": str(v.root), "label": "avg"}]
    r = play(st, {"task_id": dev.task_id, "lanes": lanes}, backend_for=backend_for)
    assert [l["label"] for l in r["lanes"]] == ["teacher", "base", "tuned s0", "avg"]
    assert r["lanes"][0]["score"]["strict_success"] and r["lanes"][0]["diverges_at"] is None
    assert all(l["graph"]["nodes"] for l in r["lanes"]) and (st.root / "playground" / f"{r['id']}.json").exists()
    free = play(st, {"prompt": "How much is SKU-0001?", "lanes": lanes[:1]}, backend_for=backend_for)
    assert free["task"]["task_id"] == "playground" and free["lanes"][0]["score"] is None
    assert all(n["status"] == "neutral" for n in free["lanes"][0]["graph"]["nodes"] if n["kind"] == "answer")
    held = next(t for t in st.tasks() if t.split == "test")
    with pytest.raises(PlaygroundError, match="sealed"):
        play(st, {"task_id": held.task_id, "lanes": lanes[:1]}, backend_for=backend_for)


def test_review_queue_and_study_policy(tmp_path):
    a = Agent.create(tmp_path / "agents", "", "itsm_servicenow", True)
    a.run_tasks(None, per_skill=8, seed=2, source="template")
    tasks = a.tasks()
    route = next(t for t in tasks if t["family"] == "route_ticket" and not t["meta"]["not_found"])
    pri = next(t for t in tasks if t["family"] == "set_priority")
    with pytest.raises(AgentError, match="reviewer"):
        a.review(route["task_id"], "approve", "  ")
    a.review(route["task_id"], "approve", "J. Doe")
    with pytest.raises(AgentError, match="does not verify"):
        a.review(pri["task_id"], "correct", "J. Doe", answer="9")              # not what the tools compute
    better = pri["prompt"].replace("What priority should it get?", "Which priority applies?")
    if better != pri["prompt"]:
        a.review(pri["task_id"], "correct", "J. Doe", question=better)
    rej = tasks[-1]
    stats = a.review(rej["task_id"], "reject", "J. Doe", note="unclear")
    assert stats["rejected"] == 1 and stats["approved"] == 1
    every = a.tasks_for_study(False)
    assert len(every) == len(tasks) - 1 and all(t["prompt"] != rej["prompt"] for t in every)
    only = a.tasks_for_study(True)
    assert {t["meta"].get("approved_by") or t["meta"].get("corrected_by") for t in only} == {"J. Doe"}
    st = Study.init(tmp_path / "s", name="r", profile="smoke", arms=["teacher_filtered"], agent=a, require_review=True, teacher=TEACHER,
                    student={"name": "s", "path": str(tmp_path)})
    assert st.plan["taskset"]["agent"]["review"]["required"] and len(st.tasks()) == len(only)
    a2 = Agent.create(tmp_path / "agents", "", "patient_access", True)
    a2.run_tasks(None, per_skill=4, seed=2, source="template")
    with pytest.raises(StudyError, match="none are approved"):
        Study.init(tmp_path / "s", name="r2", profile="smoke", arms=["teacher_filtered"], agent=a2, require_review=True, teacher=TEACHER,
                   student={"name": "s", "path": str(tmp_path)})


def test_playground_and_weightlab_api_validation(settings):
    from fastapi.testclient import TestClient

    from forge.api.app import create_app
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        assert c.post("/api/decisions", json={"study_id": "study_abc", "run_id": "play_abc", "lane": "x", "decision": "accept", "reviewer": "J"}).status_code == 404
        assert c.post("/api/weightlab", json={"name": "x", "sources": [{"study_id": "study_00", "arm": "teacher_filtered", "seed": 0}]}).status_code == 404
        assert c.get("/api/weightlab/var_../x").status_code in (404, 422) and c.get("/api/weightlab").json() == []
        assert c.post("/api/weightlab", json={"name": "x", "sources": [{"study_id": "study_00", "arm": "../x", "seed": 0}]}).status_code == 422


def test_playground_api_refuses_held_out_before_seal(settings, tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    from forge.api.app import create_app
    from forge.api import routes_studies
    st = Study.init(settings.studies_dir, name="p", profile="smoke", arms=["teacher_filtered"], teacher=TEACHER,
                    student={"name": "s", "path": str(tmp_path)})
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        monkeypatch.setattr(routes_studies, "_study", lambda _st, sid: st)
        held = next(t for t in st.tasks() if t.split == "test")
        r = c.post(f"/api/studies/{st.plan['study_id']}/playground", json={"task_id": held.task_id, "lanes": [{"kind": "teacher"}]})
        assert r.status_code == 409 and "sealed" in r.json()["detail"]
        assert c.post(f"/api/studies/{st.plan['study_id']}/playground", json={"task_id": "nope", "lanes": [{"kind": "teacher"}]}).status_code == 404
        assert c.post(f"/api/studies/{st.plan['study_id']}/playground", json={"prompt": "call 555-123-4567", "lanes": [{"kind": "teacher"}]}).status_code == 422
        listed = c.get(f"/api/studies/{st.plan['study_id']}/playground/tasks").json()
        assert listed["sealed"] is False and all(t["split"] in ("train", "dev") for t in listed["tasks"])
