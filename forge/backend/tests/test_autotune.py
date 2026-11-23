"""Auto-tune: proposal validation, and the full loop through FORGE's API with real weight arithmetic and a scripted Azure."""
import json

import httpx
import pytest

from forge.engine import autotune as at

torch = pytest.importorskip("torch")
pytest.importorskip("peft")

RUN = {"context": {"trained": [{"arm": "tf", "seed": 0}, {"arm": "tf", "seed": 1}], "layers": 2, "baseline": {}}, "rounds": [], "max_rounds": 3, "goal": ""}


def test_parse_proposal_validates_everything():
    ok = at.parse_proposal('noise {"action":"variant","rationale":"halve it","recipe":{"sources":[{"arm":"tf","seed":0,"weight":1}],"strength":0.5}}', RUN)
    assert ok["recipe"] == {"sources": [{"arm": "tf", "seed": 0, "weight": 1.0}], "strength": 0.5, "layers": None, "modules": "all", "rank": None}
    assert at.parse_proposal('{"action":"stop","rationale":"done"}', RUN)["action"] == "stop"
    bad = ['nothing', '{"action":"delete"}', '{"action":"variant","recipe":{"sources":[{"arm":"x","seed":0}]}}',
           '{"action":"variant","recipe":{"sources":[{"arm":"tf","seed":0,"weight":5}]}}',
           '{"action":"variant","recipe":{"sources":[{"arm":"tf","seed":0}],"strength":3}}',
           '{"action":"variant","recipe":{"sources":[{"arm":"tf","seed":0}],"layers":[0,9]}}',
           '{"action":"variant","recipe":{"sources":[{"arm":"tf","seed":0}],"rank":500}}',
           '{"action":"variant","recipe":{"sources":[{"arm":"tf","seed":0}],"modules":"lm_head"}}']
    for b in bad:
        with pytest.raises(at.AutoTuneError):
            at.parse_proposal(b, RUN)
    tried = {**RUN, "rounds": [{"recipe": ok["recipe"]}]}
    with pytest.raises(at.AutoTuneError, match="already tried"):
        at.parse_proposal('{"action":"variant","recipe":{"sources":[{"arm":"tf","seed":0,"weight":1}],"strength":0.5}}', tried)


def test_guardrail_and_best():
    ev = {"variant": {"overall": 0.8, "per_skill": {"a": 0.9, "boundary": 0.5}, "n": 10}, "tuned": {"overall": 0.6, "per_skill": {"a": 0.5, "boundary": 0.75}}}
    r = at.score_result(ev, {})
    assert r["guardrail_violated"] and abs(r["delta_vs_trained"] - 0.2) < 1e-9
    rounds = [{"round": 1, "result": r, "variant_id": "v1"}, {"round": 2, "variant_id": "v2", "result": {**r, "overall": 0.7, "guardrail_violated": False, "delta_vs_trained": 0.1}}]
    b = at.pick_best(rounds)
    assert b["round"] == 2 and b["improved"]  # the better score broke the hand-back guardrail, so it can't be best


def test_full_loop_through_api(settings, monkeypatch, tmp_path):
    import os

    from fastapi.testclient import TestClient

    from forge.api import routes_assistant
    from forge.api.app import create_app
    from forge.engine import weightlab
    from forge.engine.runtime import OracleBackend
    from forge.engine.study import Study
    from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset
    from tests.test_playground_weightlab import TEACHER
    from tests.tiny_model import build_tiny_qwen3
    os.environ["FORGE_ALLOW_CPU"], os.environ["FORGE_ISOLATE_RUNS"] = "1", "0"
    tasks = generate_taskset(TaskSetSpec(groups_per_family=4))
    tiny = build_tiny_qwen3(tmp_path / "tiny", [SYSTEM_PROMPT] + [t.prompt for t in tasks] + [json.dumps(c) for t in tasks for c in t.reference_calls])
    st = Study.init(settings.home / "studies", name="tune", profile="smoke", device="cpu", seeds=[0], teacher=TEACHER,
                    student={"name": "tiny", "path": str(tiny)}, arms=["teacher_filtered"], train_overrides={"max_steps": 2, "grad_accum": 1, "min_free_vram_mb": 0})
    st.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend({t.prompt: t for t in st.tasks()}))
    for stage in ("build", "train", "evaluate_dev", "analyze_dev"):
        st.run_stage(stage, emit=lambda e: None)

    replies = iter(['{"action":"variant","rationale":"half strength","recipe":{"sources":[{"arm":"teacher_filtered","seed":0,"weight":1}],"strength":0.5}}',
                    '{"action":"variant","rationale":"again","recipe":{"sources":[{"arm":"teacher_filtered","seed":0,"weight":1}],"strength":0.5}}',
                    '{"action":"variant","rationale":"attention only","recipe":{"sources":[{"arm":"teacher_filtered","seed":0,"weight":1}],"modules":"attention"}}',
                    '{"action":"stop","rationale":"enough"}'])
    sent = []

    def azure(req: httpx.Request) -> httpx.Response:
        body = json.loads(req.content)
        sent.append(body["messages"][1]["content"])
        return httpx.Response(200, json={"model": "frontier", "usage": {"total_tokens": 5}, "choices": [{"finish_reason": "stop", "message": {"content": next(replies)}}]})
    monkeypatch.setenv("FORGE_TEST_AZURE_KEY", "sk-test")
    monkeypatch.setattr(routes_assistant, "TRANSPORT", httpx.MockTransport(azure))
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        c.headers["X-Forge-Actor"] = "Dr Reviewer"
        app_state = c.app.state.forge
        with app_state.db.tx() as cx:
            cx.execute("INSERT INTO studies(id, name, path, profile, created_at) VALUES (?,?,?,?,?)", (st.plan["study_id"], "tune", str(st.root), "smoke", st.plan["created_at"]))
        assert c.post("/api/autotune", json={"study_id": st.plan["study_id"]}).status_code == 409  # Azure not configured yet
        c.put("/api/assistant/config", json={"endpoint": "https://my-res.openai.azure.com", "deployment": "gpt-x", "api_version": "2024-10-21", "key_env": "FORGE_TEST_AZURE_KEY", "enabled": True})
        monkeypatch.setattr(app_state.jobs, "start", lambda *a, **k: {"id": "job_x"})
        run = c.post("/api/autotune", json={"study_id": st.plan["study_id"], "rounds": 3, "approve_each": True}).json()
        rid = run["id"]
        assert run["started_by"] == "Dr Reviewer" and run["context"]["layers"] == 2

        class API:
            """FORGE's API, with Weight Lab jobs executed in-process (no subprocesses in tests)."""
            def get(self, path, **k):
                if path.startswith("/api/jobs/"):
                    return httpx.Response(200, json={"status": "completed", "label": "x"})
                return c.get(path, **k)

            def post(self, path, **k):
                if path == "/api/weightlab":
                    r = c.post(path, **k)
                    weightlab.run_build(weightlab.Variant(settings.home / "weightlab" / r.json()["variant"]["id"]))
                    return r
                if path.endswith("/evaluate"):
                    weightlab.evaluate(weightlab.Variant(settings.home / "weightlab" / path.split("/")[3]), st)
                    return httpx.Response(200, json={"id": "job_e"})
                return c.post(path, **k)

        def human(_s):  # a reviewer approves round 1, rejects round 3
            d = c.get(f"/api/autotune/{rid}").json()
            for r in d["rounds"]:
                if r["decision"] == "pending":
                    c.post(f"/api/autotune/{rid}/decision", json={"round": r["round"], "decision": "approved" if r["round"] == 1 else "rejected", "note": "too broad"})
        fin = at.loop(API(), rid, sleep=human, poll_s=0)
        rounds = fin["rounds"]
        assert [r["decision"] for r in rounds] == ["approved", "invalid", "rejected", "stop"]
        assert rounds[0]["decided_by"] == "Dr Reviewer" and rounds[0]["result"]["n"] > 0 and "already tried" in rounds[1]["error"]
        assert fin["status"] == "completed" and fin["best"]["round"] == 1
        assert all("prompt" not in s and "SKU-" not in s for s in sent)  # summaries only: no task text left the machine
        assert json.loads(sent[-1])["history"][0]["dev_overall"] is not None
        audit = c.get("/api/audit").json()["records"]
        assert any(a["what"].startswith("auto-tune") and a["actor"] == "Dr Reviewer" for a in audit)
