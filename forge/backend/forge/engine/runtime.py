"""Episode runtime: one task → one observable trajectory.

The model sees a system prompt, the task, and tool results (as user turns, so any
chat template works without a 'tool' role). Each assistant turn must be exactly
one JSON object: {"tool": name, "arguments": {...}} or {"answer": "..."}.

Integrity rules:
- Hidden reasoning (<think>…</think>, reasoning_content) is stripped and counted.
- An *unclosed* reasoning block is rejected (the turn is invalid).
- What gets stored as the assistant message is the canonical JSON re-serialization
  of the parsed action — malformed text never reaches a dataset.
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol
from urllib.parse import urlparse

import httpx

from forge.config import is_loopback_host
from forge.engine.tasks import SYSTEM_PROMPT, Task, ToolWorld, score_episode
from forge.util import canonical_json, sha256_text, utcnow

_CLOSED = re.compile(r"<(think|thinking|reasoning)>.*?</\1>", re.S | re.I)
_OPEN = re.compile(r"<(think|thinking|reasoning)>", re.I)
_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.S)


class ActionError(ValueError):
    def __init__(self, code: str, detail: str):
        super().__init__(detail)
        self.code = code


@dataclass
class Completion:
    text: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    latency_ms: int | None = None
    reasoning_stripped: bool = False


class ChatBackend(Protocol):
    name: str

    def complete(self, messages: list[dict[str, str]]) -> Completion: ...


def strip_reasoning(text: str) -> tuple[str, bool]:
    """Remove closed reasoning blocks. Raise on an unclosed block (truncated thinking is not data)."""
    cleaned = _CLOSED.sub("", text)
    if _OPEN.search(cleaned) or re.search(r"</(think|thinking|reasoning)>", cleaned, re.I):
        raise ActionError("unclosed_reasoning", "Unclosed or orphaned reasoning block")
    return cleaned.strip(), cleaned != text


def parse_action(text: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Returns (action, info). info records stripped reasoning and fence repair."""
    body, stripped = strip_reasoning(text)
    info = {"reasoning_stripped": stripped, "fence_repaired": False}
    m = _FENCE.match(body)
    if m:  # tolerated and recorded; the stored message is re-serialized canonically anyway
        body, info["fence_repaired"] = m.group(1).strip(), True
    try:
        obj = json.loads(body)
    except json.JSONDecodeError as e:
        raise ActionError("invalid_json", f"Not a single JSON object: {e.msg}") from e
    if not isinstance(obj, dict):
        raise ActionError("invalid_action", "Top-level JSON must be an object")
    if "answer" in obj and set(obj) <= {"answer", "sources"}:
        if not isinstance(obj["answer"], (str, int, float)):
            raise ActionError("invalid_action", "answer must be a string or number")
        act: dict[str, Any] = {"answer": str(obj["answer"])}
        if "sources" in obj:  # doc-QA citations: a list of passage ids
            src = obj["sources"]
            if not isinstance(src, list) or not all(isinstance(x, str) for x in src) or len(src) > 10:
                raise ActionError("invalid_action", "sources must be a list of passage id strings")
            act["sources"] = src
        return act, info
    if set(obj) == {"tool", "arguments"} and isinstance(obj["tool"], str) and isinstance(obj["arguments"], dict):
        return {"tool": obj["tool"], "arguments": obj["arguments"]}, info
    raise ActionError("invalid_action", f"Expected {{tool, arguments}} or {{answer}}, got keys {sorted(obj)}")


def tool_result_message(result: dict[str, Any]) -> str:
    return "TOOL_RESULT " + canonical_json(result)


@dataclass
class EpisodeConfig:
    max_turns: int = 6
    stop_on_invalid: bool = True  # one invalid turn ends the episode (strict protocol)


def run_episode(task: Task, backend: ChatBackend, world: ToolWorld, cfg: EpisodeConfig | None = None,
                arm: str = "", seed: int | None = None) -> dict[str, Any]:
    cfg = cfg or EpisodeConfig()
    # The world supplies its own instructions and scoring (catalog tools vs. document search).
    messages: list[dict[str, str]] = [{"role": "system", "content": getattr(world, "system_prompt", SYSTEM_PROMPT)},
                                      {"role": "user", "content": task.prompt}]
    events: list[dict[str, Any]] = [{"type": "prompt", "content": task.prompt}]
    calls: list[dict[str, Any]] = []
    errors: list[str] = []
    answer: str | None = None
    sources: list[str] | None = None
    usage = {"prompt_tokens": 0, "completion_tokens": 0, "latency_ms": 0}
    reasoning_stripped = 0
    started = utcnow()
    termination = "max_turns"
    for turn in range(cfg.max_turns):
        t0 = time.perf_counter()
        try:
            comp = backend.complete(messages)
        except Exception as exc:  # backend failure is recorded, not fatal to the study
            errors.append("backend_error")
            events.append({"type": "error", "code": "backend_error", "detail": f"{type(exc).__name__}: {exc}"[:800], "turn": turn})
            termination = "backend_error"
            break
        latency = comp.latency_ms if comp.latency_ms is not None else int((time.perf_counter() - t0) * 1000)
        usage["latency_ms"] += latency
        usage["prompt_tokens"] += comp.prompt_tokens or 0
        usage["completion_tokens"] += comp.completion_tokens or 0
        reasoning_stripped += int(comp.reasoning_stripped)
        try:
            action, info = parse_action(comp.text)
        except ActionError as e:
            errors.append(e.code)
            events.append({"type": "error", "code": e.code, "detail": str(e), "raw": comp.text[:2000], "turn": turn})
            termination = "invalid_action"
            if cfg.stop_on_invalid:
                break
            continue
        reasoning_stripped += int(info["reasoning_stripped"])
        messages.append({"role": "assistant", "content": canonical_json(action)})
        if "answer" in action:
            answer = action["answer"]
            sources = action.get("sources")
            events.append({"type": "answer", "content": answer, "turn": turn, "latency_ms": latency})
            termination = "answered"
            break
        calls.append(action)
        result, err = world.call(action["tool"], action["arguments"])
        events.append({"type": "tool_call", "tool": action["tool"], "arguments": action["arguments"], "turn": turn,
                       "latency_ms": latency, "fence_repaired": info["fence_repaired"]})
        events.append({"type": "tool_result", "tool": action["tool"], "result": result, "error": err, "turn": turn})
        if err:
            errors.append(err)
        messages.append({"role": "user", "content": tool_result_message(result)})
    score = (world.score(task, calls, answer, errors, events, sources) if hasattr(world, "score")
             else score_episode(task, calls, answer, errors))
    record = {
        "task_id": task.task_id, "group_id": task.group_id, "family": task.family, "split": task.split,
        "paraphrase": task.paraphrase, "arm": arm, "seed": seed, "model": backend.name,
        "messages": messages, "events": events, "calls": calls, "answer": answer, "sources": sources,
        "termination": termination,
        "score": score, "usage": usage, "reasoning_blocks_stripped": reasoning_stripped,
        "started_at": started, "ended_at": utcnow(),
    }
    # Trace hash covers the observable execution (not timestamps), so identical behavior → identical hash.
    record["trace_hash"] = sha256_text(canonical_json({k: record[k] for k in
                                                       ("task_id", "model", "messages", "calls", "answer", "termination")}))
    return record


# ---------------------------------------------------------------- backends

class OracleBackend:
    """Emits the reference action sequence. Used for the oracle_sft arm and for wiring tests."""

    name = "oracle"

    def __init__(self, tasks_by_prompt: dict[str, Task]):
        self.by_prompt = tasks_by_prompt

    def complete(self, messages: list[dict[str, str]]) -> Completion:
        task = self.by_prompt[messages[1]["content"]]
        step = sum(1 for m in messages if m["role"] == "assistant")
        if step < len(task.reference_calls):
            return Completion(canonical_json(task.reference_calls[step]), latency_ms=0)
        return Completion(canonical_json({"answer": task.reference_answer}), latency_ms=0)


class ScriptedBackend:
    """Replays fixed texts (tests)."""

    def __init__(self, name: str, texts: list[str]):
        self.name, self.texts, self.i = name, texts, 0

    def complete(self, messages: list[dict[str, str]]) -> Completion:
        t = self.texts[min(self.i, len(self.texts) - 1)]
        self.i += 1
        return Completion(t, latency_ms=1)


def validate_endpoint(url: str, allow_remote: bool = False) -> str:
    u = urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        raise ValueError(f"Endpoint must be an http(s) URL: {url}")
    if not is_loopback_host(u.hostname) and not allow_remote:
        raise ValueError(f"Endpoint {u.hostname} is not loopback; remote endpoints are opt-in")
    return url.rstrip("/")


class BackendHTTPError(RuntimeError):
    """A model server refused or failed a request. `kind` decides whether retrying can help."""

    def __init__(self, status: int | None, message: str, kind: str, url: str):
        self.status, self.message, self.kind, self.url = status, message, kind, url
        hint = {
            "context_overflow": " — the conversation is longer than the context length the model is loaded with. In LM Studio, "
                                "reload the teacher with a larger context length (e.g. 8192 or 16384), then run the stage again: it resumes.",
            "model_not_loaded": " — the model is not loaded (unloaded, crashed, idle time-out, or the PC slept). Load it in LM Studio, "
                                "then run the stage again: it resumes from this task.",
            "unreachable": " — the model server is not reachable. Start LM Studio's server (Developer → Start server), then run the stage again.",
        }.get(kind, "")
        super().__init__(f"HTTP {status}: {message}{hint}" if status else f"{message}{hint}")


_NOT_LOADED = ("no models loaded", "model unloaded", "not loaded", "model crashed", "failed to load", "model is loading",
               "model not found", "no model", "unloaded")
_OVERFLOW = ("context length", "context the overflows", "context overflow", "exceeds the context", "maximum context",
             "n_ctx", "too many tokens", "tokens to keep")
RETRY_DELAYS_S = (5.0, 15.0, 30.0, 60.0, 120.0)  # ~4 minutes in total, then the stage stops (and resumes later)


def _server_error(r: httpx.Response) -> BackendHTTPError:
    try:
        body = r.json()
        err = body.get("error", body)
        msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
    except ValueError:
        msg = r.text
    msg = " ".join(str(msg).split())[:400] or r.reason_phrase
    low = msg.lower()
    if any(k in low for k in _OVERFLOW):
        kind = "context_overflow"
    elif any(k in low for k in _NOT_LOADED) or r.status_code == 404:
        kind = "model_not_loaded"
    elif r.status_code in (408, 409, 429) or r.status_code >= 500:
        kind = "transient"
    else:
        kind = "client"
    return BackendHTTPError(r.status_code, msg, kind, str(r.url))


def post_with_retry(client: httpx.Client, url: str, payload: dict, on_retry: Callable[[dict], None] | None = None,
                    delays: tuple[float, ...] = RETRY_DELAYS_S) -> httpx.Response:
    """POST with patient retries for failures that can heal by themselves (server restarting, model reloading after
    sleep or idle unload, rate limits). Deterministic refusals (context overflow, bad request) fail immediately."""
    for attempt in range(len(delays) + 1):
        try:
            r = client.post(url, json=payload)
            if r.status_code < 400:
                return r
            err = _server_error(r)
        except (httpx.ConnectError, httpx.RemoteProtocolError, httpx.ReadError, httpx.WriteError) as e:
            err = BackendHTTPError(None, f"{type(e).__name__}: {e}", "unreachable", url)
        except httpx.TimeoutException as e:
            err = BackendHTTPError(None, f"timed out ({type(e).__name__})", "transient", url)
        if err.kind not in ("transient", "model_not_loaded", "unreachable") or attempt == len(delays):
            raise err
        if on_retry:
            on_retry({"event": "backend_retry", "attempt": attempt + 1, "of": len(delays), "wait_s": delays[attempt],
                      "kind": err.kind, "detail": str(err)[:300]})
        time.sleep(delays[attempt])
    raise AssertionError("unreachable")


class OpenAICompatBackend:
    """LM Studio / llama.cpp / vLLM chat completions. Loopback by default, no proxy, no redirects."""

    def __init__(self, base_url: str, model: str, temperature: float = 0.0, max_tokens: int = 512,
                 timeout_s: float = 180.0, api_key: str | None = None, allow_remote: bool = False,
                 transport: httpx.BaseTransport | None = None):
        base = validate_endpoint(base_url, allow_remote)
        self.url = (base if base.endswith("/v1") else base + "/v1") + "/chat/completions"
        self.model, self.temperature, self.max_tokens = model, temperature, max_tokens
        self.name = f"openai_compat:{model}"
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self.client = httpx.Client(timeout=timeout_s, trust_env=False, follow_redirects=False,
                                   headers=headers, transport=transport)
        self.on_retry: Callable[[dict], None] | None = None
        self.retry_delays = RETRY_DELAYS_S

    def complete(self, messages: list[dict[str, str]]) -> Completion:
        t0 = time.perf_counter()
        r = post_with_retry(self.client, self.url, {"model": self.model, "messages": messages, "temperature": self.temperature,
                                                    "max_tokens": self.max_tokens, "stream": False}, self.on_retry, self.retry_delays)
        data = r.json()
        msg = data["choices"][0]["message"]
        text = msg.get("content") or ""
        usage = data.get("usage") or {}
        return Completion(text=text, prompt_tokens=usage.get("prompt_tokens"),
                          completion_tokens=usage.get("completion_tokens"),
                          latency_ms=int((time.perf_counter() - t0) * 1000),
                          reasoning_stripped=bool(msg.get("reasoning_content") or msg.get("reasoning")))


class OllamaBackend:
    def __init__(self, base_url: str, model: str, temperature: float = 0.0, timeout_s: float = 180.0,
                 transport: httpx.BaseTransport | None = None):
        self.url = validate_endpoint(base_url) + "/api/chat"
        self.model, self.temperature, self.name = model, temperature, f"ollama:{model}"
        self.client = httpx.Client(timeout=timeout_s, trust_env=False, follow_redirects=False, transport=transport)
        self.on_retry: Callable[[dict], None] | None = None
        self.retry_delays = RETRY_DELAYS_S

    def complete(self, messages: list[dict[str, str]]) -> Completion:
        t0 = time.perf_counter()
        r = post_with_retry(self.client, self.url, {"model": self.model, "messages": messages, "stream": False,
                                                    "think": False, "options": {"temperature": self.temperature}},
                            self.on_retry, self.retry_delays)
        d = r.json()
        return Completion(text=d.get("message", {}).get("content", ""), prompt_tokens=d.get("prompt_eval_count"),
                          completion_tokens=d.get("eval_count"), latency_ms=int((time.perf_counter() - t0) * 1000),
                          reasoning_stripped=bool(d.get("message", {}).get("thinking")))


@dataclass
class TransformersBackend:
    """Local student (base or base+adapter). Runs only inside an engine subprocess — never in the API."""

    model_path: str
    adapter_path: str | None = None
    device: str = "cuda"
    max_new_tokens: int = 256
    name: str = "transformers"
    _state: dict[str, Any] = field(default_factory=dict)

    def load(self) -> None:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        dtype = torch.bfloat16 if self.device == "cuda" else torch.float32
        tok = AutoTokenizer.from_pretrained(self.model_path, local_files_only=True, trust_remote_code=False)
        model = AutoModelForCausalLM.from_pretrained(self.model_path, local_files_only=True, trust_remote_code=False,
                                                     torch_dtype=dtype).to(self.device)
        if self.adapter_path:
            from peft import PeftModel
            model = PeftModel.from_pretrained(model, self.adapter_path, is_trainable=False)
        model.eval()
        self._state.update(tok=tok, model=model, torch=torch)
        self.name = f"student:{'tuned' if self.adapter_path else 'base'}"

    def unload(self) -> None:
        torch = self._state.get("torch")
        self._state.clear()
        if torch is not None and torch.cuda.is_available():
            torch.cuda.empty_cache()

    def complete(self, messages: list[dict[str, str]]) -> Completion:
        if not self._state:
            self.load()
        tok, model, torch = self._state["tok"], self._state["model"], self._state["torch"]
        prompt = render_prompt(tok, messages)
        enc = tok(prompt, return_tensors="pt", add_special_tokens=False)
        # Only the inputs a causal LM accepts: generic fast tokenizers also emit token_type_ids,
        # which Qwen3/Llama `generate` rejects (found by the v0.5 browser smoke).
        ids = {k: enc[k].to(self.device) for k in ("input_ids", "attention_mask") if k in enc}
        t0 = time.perf_counter()
        with torch.no_grad():
            out = model.generate(**ids, max_new_tokens=self.max_new_tokens, do_sample=False,
                                 pad_token_id=tok.pad_token_id or tok.eos_token_id)
        new = out[0, ids["input_ids"].shape[1]:]
        return Completion(tok.decode(new, skip_special_tokens=True), prompt_tokens=int(ids["input_ids"].shape[1]),
                          completion_tokens=int(new.shape[0]), latency_ms=int((time.perf_counter() - t0) * 1000))


def render_prompt(tokenizer: Any, messages: list[dict[str, str]]) -> str:
    """Chat template with thinking disabled when the template supports the switch."""
    try:
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
    except TypeError:
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
