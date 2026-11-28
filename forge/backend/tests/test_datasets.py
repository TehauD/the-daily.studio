import json

import pytest

from forge.domain.datasets import DatasetStore, SelectionPolicy, convert
from tests.factories import traj


def test_chat_sft_shape_and_tool_messages():
    r = convert([traj()], "chat_sft", SelectionPolicy(heldout_fraction=0))
    rec = r.train[0]
    roles = [m["role"] for m in rec["messages"]]
    assert roles == ["system", "user", "assistant", "tool", "assistant"]
    assert rec["messages"][2]["tool_calls"][0]["function"] == {"name": "calculator", "arguments": {"expr": "6*7"}}
    assert rec["tools"][0]["function"]["name"] == "calculator"
    assert r.provenance[0]["trajectory_ids"] == ["t1"]


def test_selection_policy_filters():
    ts = [traj("ok"), traj("unapproved", approved=False), traj("halluc", flags=["hallucination"]),
          traj("low", score=0.2), traj("timeout", termination="timeout"), traj("excl", approved=False, excluded=True)]
    r = convert(ts, "chat_sft", SelectionPolicy(min_score=0.5, heldout_fraction=0))
    assert len(r.train) == 1
    assert r.skipped == {"not_approved": 1, "flagged": 1, "below_min_score": 1, "termination_timeout": 1, "excluded": 1}


def test_split_is_by_task_no_leakage():
    ts = [traj(f"t{i}-{k}", task_id=f"task-{i}") for i in range(40) for k in range(3)]
    r = convert(ts, "chat_sft", SelectionPolicy(heldout_fraction=0.3))
    train_tasks = {p["task_id"] for p in r.provenance if p["split"] == "train"}
    held_tasks = {p["task_id"] for p in r.provenance if p["split"] == "heldout"}
    assert train_tasks and held_tasks and not (train_tasks & held_tasks)
    assert convert(ts, "chat_sft", SelectionPolicy(heldout_fraction=0.3)).provenance == r.provenance  # deterministic


def test_tool_calling_requires_calls():
    r = convert([traj("a"), traj("b", tools=False)], "tool_calling", SelectionPolicy(heldout_fraction=0))
    assert len(r.train) == 1 and r.skipped == {"no_tool_calls": 1}


def test_instruction_format():
    r = convert([traj()], "instruction", SelectionPolicy(heldout_fraction=0))
    assert r.train[0] == {"prompt": "You are precise.\n\nWhat is 6*7?", "completion": "Answer: 42"}


def test_preference_pairs():
    ts = [traj("good", score=0.9), traj("bad", label="failure", approved=False, score=0.1, content="Answer: 41"),
          traj("lonely", task_id="task-2")]
    r = convert(ts, "preference", SelectionPolicy(heldout_fraction=0))
    assert len(r.train) == 1 and r.skipped.get("no_pair") == 1
    rec = r.train[0]
    assert rec["prompt"][-1]["role"] == "user"
    assert rec["chosen"][-1]["content"] == "Answer: 42" and rec["rejected"][-1]["content"] == "Answer: 41"
    assert r.provenance[0]["trajectory_ids"] == ["good", "bad"]


def test_teacher_student_records_teacher():
    r = convert([traj()], "teacher_student", SelectionPolicy(heldout_fraction=0))
    assert r.train[0]["teacher"]["model_id"] == "mdl_teacher"


def test_store_versions_are_immutable_and_verifiable(db, tmp_path):
    store = DatasetStore(db, tmp_path / "datasets")
    pol = SelectionPolicy(heldout_fraction=0)
    v1 = store.write_version("math-tools", "chat_sft", convert([traj()], "chat_sft", pol), pol)
    v2 = store.write_version("math-tools", "chat_sft", convert([traj("x")], "chat_sft", pol), pol)
    assert (v1["version"], v2["version"]) == (1, 2)
    assert store.verify("math-tools", 1)
    manifest = json.loads((tmp_path / "datasets" / "math-tools" / "v0001" / "manifest.json").read_text())
    assert manifest["source_trajectories"] == ["t1"]
    (tmp_path / "datasets" / "math-tools" / "v0001" / "train.jsonl").write_text("tampered\n")
    assert store.verify("math-tools", 1) is False


def test_store_rejects_bad_name_and_empty(db, tmp_path):
    store = DatasetStore(db, tmp_path / "datasets")
    pol = SelectionPolicy(heldout_fraction=0)
    with pytest.raises(ValueError):
        store.write_version("../evil", "chat_sft", convert([traj()], "chat_sft", pol), pol)
    with pytest.raises(ValueError):
        store.write_version("empty", "chat_sft", convert([], "chat_sft", pol), pol)
