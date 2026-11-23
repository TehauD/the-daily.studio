"""Model Map: decision graph (pure), representation map and word view (tiny model, CPU), held-out protection."""
import json

import numpy as np
import pytest

from forge.engine.modelmap import ModelMapError, knn_purity, silhouette
from forge.graphs.decisions import build, outcome


def ep(tid, fam, tools, strict=False, correct=False, answer="x", term="answered", invalid=0):
    return {"task_id": tid, "family": fam, "calls": [{"tool": t, "arguments": {}} for t in tools], "answer": answer,
            "termination": term, "score": {"strict_success": strict, "answer_correct": correct, "invalid_calls": invalid}}


def test_decision_graph_structure_and_consistency():
    eps = [ep("a1", "route", ["lookup"], True, True), ep("a2", "route", ["lookup"], True, True), ep("a3", "route", ["find", "lookup"], False, True),
           ep("b1", "prio", ["lookup", "lookup", "calculate"], True, True), ep("b2", "prio", [], answer=None, term="invalid_action", invalid=1)]
    g = build(eps, {"route": "Route the ticket"})
    skills = {s["skill"]: s for s in g["skills"]}
    assert skills["route"]["consistency"] == pytest.approx(2 / 3) and skills["route"]["most_common_path"] == ["lookup"]
    assert skills["route"]["label"] == "Route the ticket" and skills["prio"]["distinct_paths"] == 2
    by = {n["id"]: n for n in g["nodes"]}
    assert by["skill:route|lookup"]["count"] == 2 and set(by["skill:route|lookup"]["tasks"]) == {"a1", "a2"}
    outs = [n for n in g["nodes"] if n["kind"] == "outcome"]
    assert all(n["col"] == g["columns"] - 1 for n in outs)                        # outcomes aligned in the last column
    assert sum(e["count"] for e in g["edges"] if e["from"].startswith("skill:route") and e["to"].startswith("skill:route|") and "=>" in e["to"]) == 3
    assert outcome(eps[2]) == "answer_only" and outcome(eps[4]) == "invalid"
    assert all(isinstance(n["y"], float) for n in g["nodes"])


def test_cluster_metrics():
    rng = np.random.default_rng(0)
    a, b = rng.normal(size=8) * 5, rng.normal(size=8) * 5
    x = np.stack([a + rng.normal(size=8) * 0.1 for _ in range(10)] + [b + rng.normal(size=8) * 0.1 for _ in range(10)])
    labels = ["a"] * 10 + ["b"] * 10
    assert silhouette(x, labels) > 0.8 and knn_purity(x, labels) == 1.0
    mixed = rng.normal(size=(20, 8))
    assert abs(silhouette(mixed, labels)) < 0.3 and silhouette(x, ["a"] * 20) is None


torch = pytest.importorskip("torch")
pytest.importorskip("peft")


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    import os

    from forge.engine.runtime import OracleBackend
    from forge.engine.study import Study
    from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset
    from tests.tiny_model import build_tiny_qwen3
    os.environ["FORGE_ALLOW_CPU"], os.environ["FORGE_ISOLATE_RUNS"] = "1", "0"
    base = tmp_path_factory.mktemp("mm")
    tasks = generate_taskset(TaskSetSpec(groups_per_family=8))
    tiny = build_tiny_qwen3(base / "tiny", [SYSTEM_PROMPT] + [t.prompt for t in tasks] + [json.dumps(c) for t in tasks for c in t.reference_calls])
    st = Study.init(base / "studies", name="mm", profile="smoke", device="cpu", teacher={"provider": "lmstudio", "endpoint": "http://127.0.0.1:9/v1", "model": "t"},
                    student={"name": "tiny", "path": str(tiny)}, arms=["teacher_filtered"], train_overrides={"max_steps": 2, "grad_accum": 1, "min_free_vram_mb": 0})
    st.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend({t.prompt: t for t in st.tasks()}))
    st.run_stage("build", emit=lambda e: None)
    st.run_stage("train", emit=lambda e: None)
    return st


def test_representation_map_and_word_view(trained):
    from forge.engine import modelmap
    st = trained
    m = modelmap.run_map(st, "dev")
    n = len([t for t in st.tasks() if t.split == "dev"])
    assert len(m["tasks"]) == n and len(m["layers"]) == m["n_layers"] + 1
    for L in m["layers"]:
        assert len(L["base"]["xy"]) == n and len(L["tuned"]["xy"]) == n and 0 <= L["variance_2d"] <= 1
        assert L["base"]["knn_purity"] is None or 0 <= L["base"]["knn_purity"] <= 1
    assert m["layers"][0]["shift"] == pytest.approx(0, abs=1e-6)                     # embeddings: LoRA does not touch them
    assert any(L["shift"] > 0 for L in m["layers"][1:])                                 # deeper layers moved
    assert (st.root / "modelmap" / f"map_dev_teacher_filtered_s0.json").exists()
    dev = next(t for t in st.tasks() if t.split == "dev")
    e = modelmap.run_explain(st, dev.task_id, None, "trained")
    assert len(e["lens"]) == e["n_layers"] + 1 and all(1 <= l["chosen_rank"] and len(l["top"]) == 5 for l in e["lens"])
    assert e["words"] and all(0 <= w["score"] <= 1 for w in e["words"]) and max(w["score"] for w in e["words"]) == 1
    assert " ".join(w["w"] for w in e["words"]).split()[0] in dev.prompt and 0 < e["user_share"] <= 1
    free = modelmap.run_explain(st, None, "How much is SKU-0001?", "untrained")
    assert free["task_id"] is None and free["words"]
    held = next(t for t in st.tasks() if t.split == "test")
    with pytest.raises(ModelMapError, match="sealed"):
        modelmap.run_explain(st, held.task_id, None, "trained")
    with pytest.raises(ModelMapError, match="sealed"):
        modelmap.run_map(st, "test")


def test_modelmap_api(settings, tmp_path, monkeypatch, trained):
    from fastapi.testclient import TestClient

    from forge.api import routes_studies
    from forge.api.app import create_app
    st = trained
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        monkeypatch.setattr(routes_studies, "_study", lambda _st, sid: st)
        sid = st.plan["study_id"]
        g = c.get(f"/api/studies/{sid}/modelmap/decisions", params={"split": "dev", "model": "teacher"}).json()
        assert g["available"] and g["skills"] and {m["key"] for m in g["models"]} >= {"teacher", "base", "teacher_filtered:0"}
        assert c.get(f"/api/studies/{sid}/modelmap/decisions", params={"split": "test"}).status_code == 409
        assert c.get(f"/api/studies/{sid}/modelmap/decisions", params={"model": "evil:9"}).status_code == 422
        assert c.get(f"/api/studies/{sid}/modelmap/map", params={"split": "dev"}).json()["available"] is True
        assert c.get(f"/api/studies/{sid}/modelmap/map", params={"arm": "../x"}).status_code == 422
        assert c.post(f"/api/studies/{sid}/modelmap/explain", json={"prompt": "SSN 123-45-6789"}).status_code == 422
        assert c.get(f"/api/studies/{sid}/modelmap/explain/expl_zz").status_code == 422


def test_joint_pca_ignores_global_offset():
    from forge.engine.modelmap import joint_pca
    rng = np.random.default_rng(1)
    a = rng.normal(size=(30, 6))
    pa, pb, _ = joint_pca(a, a + 100.0)          # same structure, huge offset
    assert np.allclose(pa, pb, atol=1e-6)
