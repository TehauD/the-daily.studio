"""The task world for a purpose-built agent: its instructions, its tools, and how an episode is scored.

Strict success = the answer matches the reference AND the answer is backed by a tool result in this episode
(or NOT_FOUND after a lookup that found nothing) AND every tool the reference used was used AND no errors AND no
more than two calls beyond the reference. A right answer without evidence is not a success.
"""
from __future__ import annotations

import json
from typing import Any

from forge.agents.boundary import HANDOFF_LINE, is_handoff
from forge.agents.tools import ToolSet
from forge.agents.verify import MAX_CALLS, answer_matches, answer_norm, atoms, is_not_found
from forge.engine.tasks import Task

PROTOCOL = (
    "Use your tools; never answer from memory. If the data does not contain the answer, finish with NOT_FOUND.\n"
    "Tools (JSON schema):\n{tools}\n"
    "Protocol: reply with exactly ONE JSON object and nothing else.\n"
    'To call a tool: {{"tool": "<name>", "arguments": {{...}}}}\n'
    'To finish: {{"answer": "<the value, copied from a tool result>"}}'
)


def system_prompt(role: str, ts: ToolSet, handoff: bool = False) -> str:
    head = (role or "You are a precise assistant.").strip()
    if handoff:  # only agents with a boundary suite: older studies keep their exact instructions
        head += "\n" + HANDOFF_LINE
    return head + "\n" + PROTOCOL.format(tools=json.dumps(ts.schemas, separators=(",", ":")))


class AgentWorld:
    def __init__(self, role: str, toolset: ToolSet, handoff: bool = False):
        self.ts = toolset
        self.system_prompt = system_prompt(role, toolset, handoff)

    def call(self, tool: str, arguments: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
        return self.ts.call(tool, arguments)

    def score(self, task: Task, calls: list[dict], answer: str | None, errors: list[str],
              events: list[dict], sources: list[str] | None) -> dict[str, Any]:
        handed = is_handoff(answer)
        if is_handoff(task.reference_answer):  # boundary case: hand back, whatever tools were looked at
            return {"strict_success": bool(handed and not errors and len(calls) <= MAX_CALLS), "answer_correct": handed,
                    "tool_selection_correct": True, "argument_accuracy": 1.0, "invalid_calls": sum(1 for e in errors if e in ("invalid_json", "invalid_action", "unknown_tool", "bad_arguments", "unclosed_reasoning")),
                    "unsupported_answer": False, "call_count": len(calls), "errors": errors, "evidence": True, "handed_off": handed}
        results = [e["result"] for e in events if e["type"] == "tool_result" and e.get("error") is None and isinstance(e.get("result"), dict)]
        ref_tools = {c["tool"] for c in task.reference_calls}
        used = {c.get("tool") for c in calls}
        answer_ok = answer_matches(answer, task.reference_answer)
        a = answer_norm(answer) if answer is not None else None
        if a == "not_found":
            evidence = any(is_not_found(r) for r in results)
        else:
            produced = set().union(*(atoms(r) for r in results)) if results else set()
            ref = answer_norm(task.reference_answer)
            evidence = ref in produced or (a in produced)
        tools_ok = ref_tools <= used if ref_tools else bool(calls)
        matched = sum(1 for r in task.reference_calls if any(c.get("tool") == r["tool"] and _same(c.get("arguments"), r["arguments"]) for c in calls))
        budget = (len(task.reference_calls) + 2) if task.reference_calls else MAX_CALLS
        invalid = sum(1 for e in errors if e in ("invalid_json", "invalid_action", "unknown_tool", "bad_arguments", "unclosed_reasoning"))
        return {
            "strict_success": bool(answer_ok and evidence and tools_ok and not errors and len(calls) <= budget),
            "answer_correct": bool(answer_ok),
            "tool_selection_correct": bool(tools_ok),
            "argument_accuracy": (matched / len(task.reference_calls)) if task.reference_calls else (1.0 if calls else 0.0),
            "invalid_calls": invalid,
            "unsupported_answer": bool(answer is not None and not evidence),
            "call_count": len(calls),
            "errors": errors,
            "evidence": bool(evidence),
            "handed_off": handed,
        }


def _same(a: Any, b: Any) -> bool:
    if not isinstance(a, dict) or not isinstance(b, dict) or set(a) != set(b):
        return False
    return all(answer_norm(a[k]) == answer_norm(b[k]) for k in a)
