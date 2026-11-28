import pytest
from pydantic import ValidationError

from forge.domain.trajectory import Trajectory, read_jsonl, write_jsonl
from tests.factories import traj


def test_roundtrip_jsonl_is_lossless(tmp_path):
    ts = [traj("a"), traj("b", tools=False)]
    p = tmp_path / "t.jsonl"
    write_jsonl(p, ts)
    back = read_jsonl(p)
    assert [t.model_dump() for t in back] == [t.model_dump() for t in ts]
    assert back[0].content_hash() == ts[0].content_hash()


def test_hidden_reasoning_stripped_and_recorded():
    t = traj()
    a = t.events[2]
    assert "secret" not in a.content and a.reasoning_stripped is True
    assert "secret" not in t.model_dump_json()


def test_reasoning_content_field_dropped():
    t = traj()
    d = t.model_dump(mode="json")
    d["events"][4]["reasoning_content"] = "hidden"
    t2 = Trajectory.model_validate(d)
    assert t2.events[4].reasoning_stripped and "hidden" not in t2.model_dump_json()


def test_hash_ignores_review_but_not_events():
    a, b = traj(score=0.1), traj(score=0.9)
    assert a.content_hash() == b.content_hash()
    assert traj(content="Answer: 41").content_hash() != a.content_hash()


def test_tool_result_must_reference_issued_call():
    d = traj().model_dump(mode="json")
    d["events"][3]["call_id"] = "nope"
    with pytest.raises(ValidationError):
        Trajectory.model_validate(d)


def test_cannot_approve_failure():
    with pytest.raises(ValidationError):
        traj(label="failure", approved=True)


def test_usage_and_tool_calls():
    t = traj()
    assert t.token_usage == {"prompt_tokens": 50, "completion_tokens": 12}
    assert t.tool_calls[0].arguments == {"expr": "6*7"}


def test_corrupt_line_reports_location(tmp_path):
    p = tmp_path / "bad.jsonl"
    p.write_text('{"id": 1}\n')
    with pytest.raises(ValueError, match="bad.jsonl:1"):
        read_jsonl(p)
