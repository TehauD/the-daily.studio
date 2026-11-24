"""Failure types, calibration, model card / reports, and the tamper-evident audit trail."""
import json
from types import SimpleNamespace

import pytest

from forge.audit import Audit, clean_actor, describe
from forge.engine import governance as gov
from forge.engine.tasks import Task


def ep(tid, answer, **score):
    base = {"strict_success": False, "answer_correct": False, "tool_selection_correct": True, "argument_accuracy": 1.0, "invalid_calls": 0,
            "unsupported_answer": False, "evidence": True}
    return {"task_id": tid, "family": "f", "answer": answer, "score": {**base, **score}}


def test_failure_types():
    assert gov.failure_type(ep("t", "x", strict_success=True), "x") is None
    assert gov.failure_type(ep("t", None), "x") == "no_answer"
    assert gov.failure_type(ep("t", "x", invalid_calls=1), "x") == "format"
    assert gov.failure_type(ep("t", "Closed it"), "HANDOFF") == "missed_handoff"
    assert gov.failure_type(ep("t", "HANDOFF"), "network") == "over_refusal"
    assert gov.failure_type(ep("t", "42"), "NOT_FOUND") == "missed_not_found"
    assert gov.failure_type(ep("t", "NOT_FOUND"), "42") == "false_not_found"
    assert gov.failure_type(ep("t", "7", tool_selection_correct=False), "42") == "wrong_tool"
    assert gov.failure_type(ep("t", "42", answer_correct=True, unsupported_answer=True, evidence=False), "42") == "unbacked_answer"
    assert gov.failure_type(ep("t", "42", answer_correct=True), "42") == "inefficient"
    assert gov.failure_type(ep("t", "7", argument_accuracy=0.0), "42") == "wrong_lookup"
    assert gov.failure_type(ep("t", "7"), "42") == "wrong_answer"


def fake_study(episodes_by_arm, sealed=False):
    tasks = [Task("a", "g1", "f", "dev", 0, "q a", [], "42", {}), Task("b", "g2", "f", "dev", 0, "q b", [], "NOT_FOUND", {}),
             Task("c", "g3", "f", "dev", 0, "q c", [], "HANDOFF", {}), Task("d", "g4", "f", "dev", 0, "q d", [], "7", {})]
    return SimpleNamespace(tasks=lambda: tasks, state={"sealed": sealed},
                           plan={"arms": ["tf"], "seeds": [0], "eval": {"control_seed_broadcast": 0}},
                           iter_episode_files=lambda: [(a, "dev", 0, None) for a in episodes_by_arm] + [("tf", "test", 0, None), ("teacher", "train", 0, None)],
                           episodes=lambda a, sp, s: episodes_by_arm.get(a, []) if sp == "dev" else [ep("a", "1")])


def test_calibration_and_changes():
    base = [ep("a", "41"), ep("b", "13"), ep("c", "done"), ep("d", "NOT_FOUND")]
    tuned = [ep("a", "42", strict_success=True, answer_correct=True), ep("b", "NOT_FOUND", strict_success=True, answer_correct=True),
             ep("c", "HANDOFF", strict_success=True, answer_correct=True), ep("d", "9")]
    st = fake_study({"base": base, "tf": tuned})
    cal = {r["arm"]: r for r in gov.calibration(st)["rows"]}
    assert set(cal) == {"base", "tf"}  # test split sealed away, train never counted
    assert cal["base"]["confident_wrong_rate"] == 0.75 and cal["base"]["abstain_wrongly"] == 0.25 and cal["base"]["abstain_when_right_to"] == 0
    assert cal["tf"]["abstain_when_right_to"] == 1.0 and cal["tf"]["accuracy_when_answering"] == 0.5 and cal["tf"]["confident_wrong_rate"] == 0.25
    f = gov.failures(st)
    ch = f["changes"][0]
    assert ch["split"] == "dev" and ch["fixed"] == {"wrong_answer": 1, "missed_not_found": 1, "missed_handoff": 1} and ch["new"] == {}
    assert {r["arm"]: r["failed"] for r in f["rows"]} == {"base": 4, "tf": 1}


def test_audit_chain_and_tamper(tmp_path):
    a = Audit(tmp_path)
    a.append("Dr. Lee", "POST", "/api/studies/study_1/stages/train", 200)
    a.append("<script>", "PUT", "/api/settings/hardware-guard", 200)
    recs, chain = a.read()
    assert chain == {"ok": True, "records": 2, "broken_at": None}
    assert recs[0]["what"] == "ran stage train" and recs[1]["actor"] == "script" and recs[1]["what"] == "changed settings: hardware-guard"
    lines = a.path.read_text().splitlines()
    lines[0] = lines[0].replace("Dr. Lee", "Someone else")
    a.path.write_text("\n".join(lines) + "\n")
    assert a.read()[1]["ok"] is False and a.read()[1]["broken_at"] == 1
    assert clean_actor("") == "unnamed" and describe("GET", "/x") == "GET /x"


def test_audit_via_api(settings):
    from fastapi.testclient import TestClient

    from forge.api.app import create_app
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        c.headers["X-Forge-Actor"] = "Pat Analyst"
        aid = c.post("/api/agents", json={"name": "Desk", "template": "itsm_servicenow", "no_sensitive_data": True}).json()["id"]
        c.put(f"/api/agents/{aid}", json={"name": "Desk 2"})
        r = c.get("/api/audit").json()
        assert r["chain"]["ok"] and [x["what"] for x in r["records"][:2]] == ["edited an agent", "created an agent"]
        assert all(x["actor"] == "Pat Analyst" for x in r["records"][:2]) and "body" not in r["records"][0]


def test_model_card_and_reports(tmp_path):
    pytest.importorskip("torch")
    import os

    from forge.engine.runtime import OracleBackend
    from forge.engine.study import Study
    from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset
    from tests.test_playground_weightlab import TEACHER
    from tests.tiny_model import build_tiny_qwen3
    os.environ["FORGE_ALLOW_CPU"] = "1"
    tasks = generate_taskset(TaskSetSpec(groups_per_family=4))
    tiny = build_tiny_qwen3(tmp_path / "tiny", [SYSTEM_PROMPT] + [t.prompt for t in tasks])
    st = Study.init(tmp_path / "studies", name="Card <b>", profile="smoke", device="cpu", seeds=[0], teacher=TEACHER,
                    student={"name": "tiny", "path": str(tiny)}, arms=["teacher_filtered"])
    st.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend({t.prompt: t for t in st.tasks()}))
    card = gov.model_card(st)
    assert card["study"]["sealed"] is False and any("Not sealed" in x for x in card["limitations"]) and "clinical validity" in card["never_claimed"]
    assert card["data"]["synthetic"] and card["approval"].startswith("No approval")
    md = gov.card_markdown(card)
    assert md.startswith("# Model card") and "Approval:" in md
    for aud in gov.AUDIENCES:
        h = gov.report_html(card, aud, [{"at": "2026-01-01T00:00:00", "actor": "<i>x</i>", "what": "ran stage train"}])
        assert "Not an approval" in h and "<b>" not in h.split("<h1>")[1].split("</h1>")[0] and "&lt;i&gt;" in h or aud == "executive"
    assert json.dumps(card)  # serialisable


def test_test_adequacy_flags_each_problem(tmp_path):
    def T(i, fam, split, ans, calls=1):
        return Task(f"{fam}{i}", f"g{fam}{i}", fam, split, 0, f"q {fam} {i}", [{"tool": "x", "arguments": {}}] * calls, ans, {})
    tasks = []
    for fam, mk in (("easy", lambda i: str(i)), ("skewed", lambda i: "yes" if i % 10 else "no"), ("hard", lambda i: str(i)), ("tiny", lambda i: str(i))):
        n = 10 if fam == "tiny" else 100
        for i in range(n):
            tasks.append(T(i, fam, "train" if i % 5 < 3 else ("dev" if i % 5 == 3 else "test"), mk(i), 2 if fam == "hard" else 1))
    rates = {"base": {"easy": 0.95, "skewed": 0.5, "hard": 0.1, "tiny": 0.1}, "teacher": {"easy": 1.0, "skewed": 0.95, "hard": 0.9, "tiny": 0.5}}

    def eps(arm, sp, seed):
        out = []
        for f, r in rates[arm].items():
            dev = [t for t in tasks if t.family == f and t.split == "dev"]
            k = round(r * len(dev))
            out += [{"family": f, "score": {"strict_success": j < k}} for j in range(len(dev))]
        return out
    st = SimpleNamespace(tasks=lambda: tasks, plan={"eval": {"control_seed_broadcast": 0}},
                         episode_path=lambda a, sp, s: tmp_path, episodes=eps)
    a = gov.adequacy(st)
    by = {s["skill"]: s for s in a["skills"]}
    kinds = {k: {i["kind"] for i in v["issues"]} for k, v in by.items()}
    assert kinds["easy"] == {"no_headroom"} and by["easy"]["verdict"] == "unusable"
    assert "imbalanced" in kinds["skewed"] and by["skewed"]["top_share"] == 0.9
    assert kinds["hard"] == set() and by["hard"]["verdict"] == "good" and by["hard"]["avg_steps"] == 2
    assert {"too_few", "weak_teacher"} <= kinds["tiny"] and by["tiny"]["verdict"] == "weak"
    assert a["measured"] and a["overall"] == "weak"
