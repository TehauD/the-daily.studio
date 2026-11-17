"""Tasks, action protocol, episode runtime, scoring."""
import httpx
import pytest

from forge.engine.runtime import (ActionError, OpenAICompatBackend, OracleBackend, ScriptedBackend, parse_action,
                                  run_episode, strip_reasoning, validate_endpoint)
from forge.engine.tasks import (TaskSetSpec, ToolWorld, build_catalog, generate_taskset, normalize_answer,
                                score_episode, taskset_hash)

SPEC = TaskSetSpec(seed=7, groups_per_family=10, ood_groups_per_family=2, regression_groups=3)


def test_taskset_is_deterministic_and_group_split():
    a, b = generate_taskset(SPEC), generate_taskset(SPEC)
    assert taskset_hash(a) == taskset_hash(b)
    assert taskset_hash(a) != taskset_hash(generate_taskset(TaskSetSpec(seed=8, groups_per_family=10)))
    by_group = {}
    for t in a:
        by_group.setdefault(t.group_id, set()).add(t.split)
    assert all(len(s) == 1 for s in by_group.values())  # paraphrases never cross splits
    splits = {t.split for t in a}
    assert splits == {"train", "dev", "test", "ood", "regression"}
    assert {t.family for t in a if t.split == "regression"} == {"extraction"}
    assert all(t.meta["wording"] == "ood" for t in a if t.split == "ood" and t.family != "extraction")


def test_tool_world_is_read_only_and_validates():
    w = ToolWorld(build_catalog(7))
    sku = next(iter(w.catalog))
    res, err = w.call("lookup", {"sku": sku.lower()})
    assert err is None and res["sku"] == sku
    assert w.call("lookup", {"sku": "SKU-0000"})[0]["error"] == "NOT_FOUND"
    assert w.call("quote", {"sku": sku, "quantity": 0})[1] == "bad_arguments"
    assert w.call("quote", {"sku": sku, "quantity": True})[1] == "bad_arguments"
    assert w.call("shell", {"cmd": "rm -rf /"})[1] == "unknown_tool"


def test_strip_reasoning_and_unclosed_rejected():
    assert strip_reasoning('<think>plan</think>{"answer": "1"}') == ('{"answer": "1"}', True)
    with pytest.raises(ActionError) as e:
        strip_reasoning('<think>never closed {"answer": "1"}')
    assert e.value.code == "unclosed_reasoning"
    with pytest.raises(ActionError):
        strip_reasoning('stray </think>{"answer":"1"}')


@pytest.mark.parametrize("text,code", [
    ("hello", "invalid_json"), ("[1,2]", "invalid_action"), ('{"tool": "lookup"}', "invalid_action"),
    ('{"answer": "1", "tool": "x"}', "invalid_action"), ('{"answer": {"x": 1}}', "invalid_action"),
    ('{"answer":"1"} {"answer":"2"}', "invalid_json"),
])
def test_parse_action_rejects(text, code):
    with pytest.raises(ActionError) as e:
        parse_action(text)
    assert e.value.code == code


def test_parse_action_fence_is_recorded():
    act, info = parse_action('```json\n{"tool":"lookup","arguments":{"sku":"SKU-1"}}\n```')
    assert act == {"tool": "lookup", "arguments": {"sku": "SKU-1"}} and info["fence_repaired"]


def test_oracle_episode_is_strict_success_everywhere():
    tasks = generate_taskset(SPEC)
    world = ToolWorld(build_catalog(SPEC.seed))
    oracle = OracleBackend({t.prompt: t for t in tasks})
    for t in tasks:
        ep = run_episode(t, oracle, world)
        assert ep["score"]["strict_success"], (t.task_id, ep["score"])
        # stored assistant messages are canonical JSON
        assert all(m["content"].startswith("{") for m in ep["messages"] if m["role"] == "assistant")


def test_wrong_argument_fails_strict_but_answer_can_be_right():
    t = next(x for x in generate_taskset(SPEC) if x.family == "catalog_lookup")
    world = ToolWorld(build_catalog(SPEC.seed))
    texts = ['{"tool":"lookup","arguments":{"sku":"SKU-0000"}}', '{"answer":"%s"}' % t.reference_answer]
    ep = run_episode(t, ScriptedBackend("s", texts), world)
    assert ep["score"]["answer_correct"] and not ep["score"]["strict_success"]
    assert ep["score"]["argument_accuracy"] == 0.0


def test_invalid_turn_ends_episode_and_is_counted():
    t = generate_taskset(SPEC)[0]
    ep = run_episode(t, ScriptedBackend("s", ["Sure! The price is 5"]), ToolWorld(build_catalog(SPEC.seed)))
    assert ep["termination"] == "invalid_action" and ep["score"]["invalid_calls"] == 1
    assert not any(m["role"] == "assistant" for m in ep["messages"])  # malformed text never stored


def test_unsupported_answer_flag():
    t = next(x for x in generate_taskset(SPEC) if x.family == "catalog_lookup")
    s = score_episode(t, [], t.reference_answer, [])
    assert s["unsupported_answer"] and not s["strict_success"]


def test_normalize_answer():
    assert normalize_answer("$1,234.5") == "1234.50" and normalize_answer("not found") == "NOT_FOUND"
    assert normalize_answer("sku-1234") == "SKU-1234"


def test_openai_backend_strips_reasoning_and_is_loopback_only():
    def handler(req: httpx.Request):
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"answer":"1"}', "reasoning_content": "hmm"}}],
                                         "usage": {"prompt_tokens": 10, "completion_tokens": 3}})
    b = OpenAICompatBackend("http://127.0.0.1:1234/v1", "qwen/qwen3.8-27b", transport=httpx.MockTransport(handler))
    c = b.complete([{"role": "user", "content": "x"}])
    assert c.text == '{"answer":"1"}' and c.reasoning_stripped and c.prompt_tokens == 10
    with pytest.raises(ValueError):
        validate_endpoint("https://api.example.com/v1")
    assert validate_endpoint("https://api.example.com/v1", allow_remote=True)
