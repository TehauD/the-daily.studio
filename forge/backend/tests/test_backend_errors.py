"""Model-server failures: the server's reason is kept, temporary trouble is retried, deterministic refusals are not."""
import httpx
import pytest

from forge.engine.runtime import BackendHTTPError, OpenAICompatBackend, run_episode
from forge.engine.tasks import ToolWorld, build_catalog, generate_taskset, TaskSetSpec


def backend(responses, events):
    it = iter(responses)

    def handler(req):
        r = next(it)
        if isinstance(r, Exception):
            raise r
        return r
    b = OpenAICompatBackend("http://127.0.0.1:1234/v1", "teacher", transport=httpx.MockTransport(handler))
    b.retry_delays = (0.0, 0.0, 0.0)
    b.on_retry = events.append
    return b


OK = httpx.Response(200, json={"choices": [{"message": {"content": '{"answer": "NOT_FOUND"}'}}], "usage": {}})


def test_context_overflow_keeps_reason_and_is_not_retried():
    ev = []
    b = backend([httpx.Response(400, json={"error": "Trying to keep the first 5210 tokens when context the overflows. However, the model is loaded with context length of only 4096 tokens"})], ev)
    with pytest.raises(BackendHTTPError) as e:
        b.complete([{"role": "user", "content": "x"}])
    assert e.value.kind == "context_overflow" and "4096" in str(e.value) and "larger context length" in str(e.value) and ev == []


def test_model_unloaded_after_sleep_is_retried_then_succeeds():
    ev = []
    b = backend([httpx.Response(400, json={"error": {"message": "No models loaded. Please load a model in the developer page."}}),
                 httpx.ConnectError("refused"), httpx.Response(503, text="loading"), OK], ev)
    assert b.complete([{"role": "user", "content": "x"}]).text == '{"answer": "NOT_FOUND"}'
    assert [x["kind"] for x in ev] == ["model_not_loaded", "unreachable", "transient"]


def test_retries_exhausted_and_plain_bad_request():
    ev = []
    b = backend([httpx.Response(400, json={"error": "No models loaded"})] * 4, ev)
    with pytest.raises(BackendHTTPError, match="Load it in LM Studio"):
        b.complete([{"role": "user", "content": "x"}])
    assert len(ev) == 3
    b2 = backend([httpx.Response(400, json={"error": "'messages' must be an array"})], [])
    with pytest.raises(BackendHTTPError) as e:
        b2.complete([])
    assert e.value.kind == "client" and "'messages' must be an array" in str(e.value)


def test_episode_records_the_servers_reason():
    task = generate_taskset(TaskSetSpec(groups_per_family=2))[0]
    b = backend([httpx.Response(400, json={"error": "context length of only 4096 tokens"})], [])
    ep = run_episode(task, b, ToolWorld(build_catalog(1234)))
    err = next(e for e in ep["events"] if e["type"] == "error")
    assert ep["termination"] == "backend_error" and "4096" in err["detail"] and "BackendHTTPError" in err["detail"]
