"""Trajectory contract — the unit of teacher behavior FORGE learns from.

Policy: no hidden chain-of-thought. Reasoning blocks emitted by models
(<think>…</think>, reasoning_content) are stripped at ingest and the removal is
recorded, so datasets contain only observable actions and outputs.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, Field, field_validator, model_validator

from forge.util import canonical_json, sha256_text

TRAJECTORY_SCHEMA_VERSION = 1
_THINK = re.compile(r"<(think|thinking|reasoning)>.*?</\1>\s*", re.S | re.I)


def strip_hidden_reasoning(text: str) -> tuple[str, bool]:
    cleaned = _THINK.sub("", text)
    return cleaned, cleaned != text


class _Event(BaseModel):
    ts: str


class SystemEvent(_Event):
    type: Literal["system"] = "system"
    content: str


class UserEvent(_Event):
    type: Literal["user"] = "user"
    content: str


class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict[str, Any]


class AssistantEvent(_Event):
    type: Literal["assistant"] = "assistant"
    content: str = ""
    tool_calls: list[ToolCall] = Field(default_factory=list)
    reasoning_stripped: bool = False
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    latency_ms: int | None = None

    @model_validator(mode="before")
    @classmethod
    def _strip(cls, data: Any) -> Any:
        if isinstance(data, dict):
            data = dict(data)
            stripped = bool(data.pop("reasoning_content", None) or data.pop("thinking", None))
            cleaned, removed = strip_hidden_reasoning(data.get("content") or "")
            data["content"] = cleaned
            data["reasoning_stripped"] = data.get("reasoning_stripped", False) or stripped or removed
        return data


class ToolResultEvent(_Event):
    type: Literal["tool_result"] = "tool_result"
    call_id: str
    name: str
    content: str
    is_error: bool = False
    duration_ms: int | None = None


Event = Annotated[Union[SystemEvent, UserEvent, AssistantEvent, ToolResultEvent], Field(discriminator="type")]


class ModelRef(BaseModel):
    model_id: str
    provider: str
    name: str


class TaskSpec(BaseModel):
    task_id: str
    prompt: str
    system: str | None = None
    tools: list[dict[str, Any]] = Field(default_factory=list)  # JSON-schema tool definitions
    expected: str | None = None  # reference answer for evaluation, never shown to the model


class ExecutionSettings(BaseModel):
    temperature: float = 0.2
    max_tool_iterations: int = 8
    max_seconds: float = 120.0
    attempt: int = 1


class Review(BaseModel):
    label: Literal["unlabeled", "success", "failure"] = "unlabeled"
    score: float | None = Field(default=None, ge=0.0, le=1.0)
    flags: list[Literal["hallucination", "invalid_tool_call", "noisy", "unsafe"]] = Field(default_factory=list)
    approved: bool = False
    excluded: bool = False
    notes: str | None = None

    @model_validator(mode="after")
    def _approval_rules(self) -> "Review":
        if self.approved and (self.excluded or self.label != "success"):
            raise ValueError("Only non-excluded trajectories labeled 'success' can be approved")
        return self


class Trajectory(BaseModel):
    schema_version: int = TRAJECTORY_SCHEMA_VERSION
    id: str
    experiment_id: str | None = None
    run_id: str | None = None
    model: ModelRef
    task: TaskSpec
    settings: ExecutionSettings = Field(default_factory=ExecutionSettings)
    events: list[Event]
    started_at: str
    ended_at: str
    duration_ms: int
    final_output: str | None = None
    termination: Literal["completed", "max_iterations", "timeout", "error", "cancelled"] = "completed"
    evaluation: dict[str, Any] = Field(default_factory=dict)
    review: Review = Field(default_factory=Review)

    @field_validator("events")
    @classmethod
    def _tool_results_match_calls(cls, events: list) -> list:
        issued: set[str] = set()
        for e in events:
            if isinstance(e, AssistantEvent):
                issued.update(tc.id for tc in e.tool_calls)
            elif isinstance(e, ToolResultEvent) and e.call_id not in issued:
                raise ValueError(f"Tool result references unknown call id '{e.call_id}'")
        return events

    @property
    def tool_calls(self) -> list[ToolCall]:
        return [tc for e in self.events if isinstance(e, AssistantEvent) for tc in e.tool_calls]

    @property
    def token_usage(self) -> dict[str, int | None]:
        a = [e for e in self.events if isinstance(e, AssistantEvent)]
        p = [e.prompt_tokens for e in a if e.prompt_tokens is not None]
        c = [e.completion_tokens for e in a if e.completion_tokens is not None]
        return {"prompt_tokens": sum(p) if p else None, "completion_tokens": sum(c) if c else None}

    def content_hash(self) -> str:
        """Hash of the immutable execution record (review/evaluation excluded: they are mutable annotations)."""
        return sha256_text(canonical_json(self.model_dump(mode="json", exclude={"review", "evaluation"})))


def write_jsonl(path: Path, trajectories: list[Trajectory]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        for t in trajectories:
            f.write(canonical_json(t.model_dump(mode="json")) + "\n")


def read_jsonl(path: Path) -> list[Trajectory]:
    out = []
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if line.strip():
                try:
                    out.append(Trajectory.model_validate(json.loads(line)))
                except Exception as exc:
                    raise ValueError(f"{path}:{n}: {exc}") from exc
    return out
