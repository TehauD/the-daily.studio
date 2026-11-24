"""Compare any two subjects on byte-identical tasks; exact weight comparison; history over time."""
import json

import numpy as np
import pytest

from forge.engine import compare as cmp


def _subj(ref, outcomes, ids=None, seeds=(0,), adapter=None, base="b", taskset="t"):
    units, idmap = {}, {}
    for i, o in enumerate(outcomes):
        h = (ids or {}).get(i, f"{i:064x}")
        u = cmp.Unit(f"task{i}", f"g{i // 2}", "fam_a" if i % 2 else "fam_b", f"prompt {i}")
        for s in seeds:
            u.outcomes.append(float(o if isinstance(o, (int, float)) else o[s]))
            u.seeds.append(s)
            u.invalid.append(0)
        units[h] = u
        idmap[f"task{i}"] = h
    return cmp.Subject(ref, "arm", ref, "dev", units, idmap, list(seeds), {"what": ref, "lr": 1 if ref == "A" else 2}, adapter, base, taskset)


def test_binary_comparison_counts_and_ranges():
    a = _subj("A", [1, 1, 1, 0, 1, 0, 1, 1, 0, 1])
    b = _subj("B", [0, 1, 0, 0, 1, 0, 0, 1, 0, 1])
    out = cmp.compare(a, b, weights=False)
    o = out["overall"]
    assert out["comparable"] and o["n_tasks"] == 10 and o["n_groups"] == 5
    assert o["rate_a"] == pytest.approx(0.7) and o["rate_b"] == pytest.approx(0.4) and o["delta"] == pytest.approx(0.3)
    assert o["outcomes"] == {"both_right": 4, "only_a": 3, "only_b": 0, "both_wrong": 3, "a_higher": 0, "b_higher": 0, "same_partial": 0}
    assert o["mcnemar"]["b"] == 3 and o["mcnemar"]["c"] == 0 and o["mcnemar"]["p"] == pytest.approx(0.25)
    assert o["range_method"].startswith("Wilson") and o["ci_a"][0] < 0.7 < o["ci_a"][1]
    assert o["delta_ci"][0] <= 0.3 <= o["delta_ci"][1] and o["sign_flip_groups"]["method"] == "exact"
    assert {f["family"] for f in out["families"]} == {"fam_a", "fam_b"}
    assert [c for c in out["config"] if not c["same"] and c["key"] == "lr"][0] == {"key": "lr", "a": 1, "b": 2, "same": False}
    assert out["units"][0]["a"] != out["units"][0]["b"]  # differing tasks listed first


def test_pairs_only_identical_content():
    a = _subj("A", [1, 1, 1, 1])
    b = _subj("B", [0, 0, 0, 0], ids={0: "f" * 64})  # task0 has the same id but different content
    out = cmp.compare(a, b, weights=False)
    assert out["overall"]["n_tasks"] == 3
    assert out["coverage"]["same_id_different_content"] == 1 and out["coverage"]["examples_changed"] == ["task0"]
    c = _subj("C", [1, 1], ids={0: "a" * 64, 1: "b" * 64})
    none = cmp.compare(a, c, weights=False)
    assert none["comparable"] is False and "No byte-identical tasks" in none["reason"]


def test_multi_seed_uses_bootstrap_and_seed_spread():
    a = _subj("A", [{0: 1, 1: 0}, {0: 1, 1: 1}, {0: 0, 1: 0}, {0: 1, 1: 1}], seeds=(0, 1))
    b = _subj("B", [0, 1, 0, 0])
    out = cmp.compare(a, b, weights=False)
    assert out["overall"]["mcnemar"] is None and out["overall"]["range_method"].startswith("bootstrap")
    assert out["overall"]["rate_a"] == pytest.approx((0.5 + 1 + 0 + 1) / 4)
    assert out["sides"]["a"]["per_seed"] == {"0": {"rate": 0.75, "n": 4}, "1": {"rate": 0.5, "n": 4}}
    assert out["overall"]["outcomes"]["a_higher"] == 1


def _adapter(d, A_list, B_list, r, alpha, names):
    from safetensors.numpy import save_file
    d.mkdir(parents=True)
    t = {}
    for n, A, B in zip(names, A_list, B_list):
        t[f"base_model.model.{n}.lora_A.weight"] = A.astype(np.float32)
        t[f"base_model.model.{n}.lora_B.weight"] = B.astype(np.float32)
    save_file(t, str(d / "adapter_model.safetensors"))
    (d / "adapter_config.json").write_text(json.dumps({"r": r, "lora_alpha": alpha, "target_modules": [n.rsplit(".", 1)[-1] for n in names]}))
    return d


def test_weight_comparison_is_exact(tmp_path):
    pytest.importorskip("safetensors")
    rng = np.random.default_rng(0)
    names = ["model.layers.0.self_attn.k_proj", "model.layers.1.mlp.up_proj"]
    shapes = [(12, 20), (24, 12)]
    A1 = [rng.normal(size=(4, i)) for o, i in shapes]
    B1 = [rng.normal(size=(o, 4)) for o, i in shapes]
    A2 = [rng.normal(size=(6, i)) for o, i in shapes]
    B2 = [rng.normal(size=(o, 6)) for o, i in shapes]
    p1 = _adapter(tmp_path / "a1", A1, B1, 4, 8, names)
    p2 = _adapter(tmp_path / "a2", A2, B2, 6, 6, names)
    sa, sb = _subj("A", [1], adapter=p1), _subj("B", [1], adapter=p2)
    w = cmp.compare_weights(sa, sb)
    assert w["available"] and w["rank_a"] == 4 and w["rank_b"] == 6
    num = den_a = den_b = 0.0
    for k, m in enumerate(w["modules"]):
        d1 = 2.0 * B1[k].astype(np.float32).astype(np.float64) @ A1[k].astype(np.float32).astype(np.float64)
        d2 = 1.0 * B2[k].astype(np.float32).astype(np.float64) @ A2[k].astype(np.float32).astype(np.float64)
        assert m["norm_a"] == pytest.approx(np.linalg.norm(d1), rel=1e-9)
        assert m["cosine"] == pytest.approx((d1 * d2).sum() / np.linalg.norm(d1) / np.linalg.norm(d2), rel=1e-9, abs=1e-12)
        assert m["rel_distance"] == pytest.approx(np.linalg.norm(d1 - d2) / max(np.linalg.norm(d1), np.linalg.norm(d2)), rel=1e-9)
        num, den_a, den_b = num + (d1 * d2).sum(), den_a + (d1 * d1).sum(), den_b + (d2 * d2).sum()
    assert w["overall_cosine"] == pytest.approx(num / np.sqrt(den_a * den_b), rel=1e-9)
    assert cmp.compare_weights(sa, _subj("C", [1], adapter=p1))["available"] is False  # the same file
    import shutil
    shutil.copytree(p1, tmp_path / "copy")
    assert cmp.compare_weights(sa, _subj("C", [1], adapter=tmp_path / "copy"))["overall_cosine"] == pytest.approx(1.0)
    other = _subj("D", [1], adapter=p2, base="other")
    assert cmp.compare_weights(sa, other)["available"] is False


def test_compare_api_history_on_tiny_study(settings, tmp_path):
    pytest.importorskip("torch")
    pytest.importorskip("peft")
    import os

    from fastapi.testclient import TestClient

    from forge.api.app import create_app
    from forge.engine.runtime import OracleBackend
    from forge.engine.study import Study
    from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset
    from tests.test_playground_weightlab import TEACHER
    from tests.tiny_model import build_tiny_qwen3
    os.environ["FORGE_ALLOW_CPU"], os.environ["FORGE_ISOLATE_RUNS"] = "1", "0"
    tasks = generate_taskset(TaskSetSpec(groups_per_family=3))
    tiny = build_tiny_qwen3(tmp_path / "tiny", [SYSTEM_PROMPT] + [t.prompt for t in tasks] + [json.dumps(c) for t in tasks for c in t.reference_calls])
    s = Study.init(settings.studies_dir, name="cmp", profile="smoke", device="cpu", seeds=[0, 1], teacher=TEACHER,
                   student={"name": "tiny", "path": str(tiny)}, arms=["teacher_filtered"], train_overrides={"max_steps": 2, "grad_accum": 1, "min_free_vram_mb": 0})
    s.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend({t.prompt: t for t in s.tasks()}))
    for stage in ("build", "train", "evaluate_dev"):
        s.run_stage(stage, emit=lambda e: None)
    sid = s.plan["study_id"]
    with TestClient(create_app(settings)) as c:
        with c.app.state.forge.db.tx() as cx:
            cx.execute("INSERT INTO studies(id, name, path, profile, created_at) VALUES (?,?,?,?,?)", (sid, "cmp", str(s.root), "smoke", s.plan["created_at"]))
        refs = {x["ref"] for x in c.get("/api/compare/subjects").json()["subjects"]}
        assert {f"arm:{sid}:base", f"arm:{sid}:teacher", f"arm:{sid}:teacher_filtered", f"arm:{sid}:teacher_filtered:0", f"arm:{sid}:teacher_filtered:1"} <= refs
        r = c.get("/api/compare", params={"a": f"arm:{sid}:teacher", "b": f"arm:{sid}:base", "split": "dev"}).json()
        n_dev = sum(1 for t in s.tasks() if t.split == "dev")
        assert r["comparable"] and r["overall"]["n_tasks"] == n_dev and r["overall"]["rate_a"] == 1.0
        assert r["weights"]["available"] is False
        r = c.get("/api/compare", params={"a": f"arm:{sid}:teacher_filtered:0", "b": f"arm:{sid}:teacher_filtered:1", "split": "dev"}).json()
        assert r["weights"]["available"] and -1 <= r["weights"]["overall_cosine"] <= 1
        assert [x for x in r["config"] if x["key"] == "seeds"][0]["same"] is False
        unit = r["units"][0]["unit"]
        d = c.get("/api/compare/unit", params={"a": f"arm:{sid}:teacher_filtered:0", "b": f"arm:{sid}:teacher_filtered:1", "split": "dev", "unit": unit}).json()
        assert d["a"]["records"][0]["messages"] and d["b"]["records"][0]["seed"] == 1
        assert c.get("/api/compare", params={"a": f"arm:{sid}:base", "b": f"arm:{sid}:base"}).status_code == 422
        assert c.get("/api/compare", params={"a": f"arm:{sid}:base", "b": f"arm:{sid}:teacher_filtered", "split": "test"}).status_code == 422  # not sealed: no test results
        assert c.get("/api/compare", params={"a": f"variant:x:{sid}", "b": f"arm:{sid}:base", "split": "test"}).status_code == 422
        h = c.get("/api/history", params={"project": "catalog"}).json()
        kinds = {(p["arm"], p["kind"]) for p in h["points"] if p.get("study") == sid}
        assert ("base", "practice") in kinds and ("teacher_filtered", "practice") in kinds and ("teacher", "reference") in kinds
        assert not any(p["kind"] == "final" for p in h["points"])
        assert any(e["kind"] == "train" for e in h["events"])
        assert all(0 <= p["ci"][0] <= p["rate"] <= p["ci"][1] <= 1 for p in h["points"])
