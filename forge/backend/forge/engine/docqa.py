"""Doc-QA world: answer questions from a document collection through a `search` tool.

The student learns a *skill* — search well, answer only from what it retrieved, cite the passage,
and say NOT_FOUND when the collection does not contain the answer. The facts stay in the index.

Strict success (answerable): short answer containing the reference span, the gold passage was
actually retrieved, no errors, ≤ 3 searches. Unanswerable: searched, then answered NOT_FOUND.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from forge.engine.tasks import Task
from forge.knowledge.index import SearchIndex
from forge.knowledge.questions import UNANSWERABLE_FAMILY, norm

SEARCH_TOOL = {"name": "search", "description": "Search the document collection. Returns the most relevant passages with ids.",
               "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}

DOC_SYSTEM_PROMPT = (
    "You answer questions using a document collection that you can search. Never answer from memory.\n"
    "Tools (JSON schema):\n" + json.dumps([SEARCH_TOOL], separators=(",", ":")) + "\n"
    "Protocol: reply with exactly ONE JSON object and nothing else.\n"
    'To search: {"tool": "search", "arguments": {"query": "<keywords>"}}\n'
    'To finish: {"answer": "<short answer copied from a passage>", "sources": ["<passage id>"]}\n'
    'If the passages do not contain the answer, finish with {"answer": "NOT_FOUND"}.'
)
MAX_CALLS = 3
PASSAGE_CHARS = 900


class DocWorld:
    system_prompt = DOC_SYSTEM_PROMPT

    def __init__(self, index: SearchIndex, k: int = 3, cache_path: Path | None = None, cache: dict | None = None):
        self.index, self.k, self.cache_path, self.cache = index, k, cache_path, cache

    def call(self, tool: str, arguments: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
        if tool != "search":
            return {"error": f"unknown tool '{tool}'"}, "unknown_tool"
        q = arguments.get("query") if isinstance(arguments, dict) else None
        if not isinstance(q, str) or not q.strip() or len(q) > 400:
            return {"error": "query must be a non-empty string (≤ 400 chars)"}, "bad_arguments"
        before = len(self.cache) if self.cache is not None else 0
        hits = self.index.search(q.strip(), self.k)
        if self.cache_path and self.cache is not None and len(self.cache) != before:
            self.cache_path.write_text(json.dumps(self.cache), encoding="utf-8")  # deterministic re-runs
        return {"results": [{"id": h["chunk_id"], "text": h["text"][:PASSAGE_CHARS]} for h in hits]}, None

    def score(self, task: Task, calls: list[dict], answer: str | None, errors: list[str],
              events: list[dict], sources: list[str] | None) -> dict[str, Any]:
        searches = [c for c in calls if c.get("tool") == "search"]
        retrieved = {r["id"] for e in events if e["type"] == "tool_result" and isinstance(e.get("result"), dict)
                     for r in e["result"].get("results", [])}
        gold = task.meta.get("gold_chunk")
        unanswerable = task.family == UNANSWERABLE_FAMILY
        a = norm(answer or "")
        said_not_found = a.replace(" ", "_").upper() in ("NOT_FOUND", "NOTFOUND")
        if unanswerable:
            answer_ok = answer is not None and said_not_found
        else:
            ref = norm(task.reference_answer)
            answer_ok = bool(answer) and not said_not_found and ref in a and len(a) <= 3 * len(ref) + 40
        hit = (gold in retrieved) if gold else None
        invalid = sum(1 for e in errors if e in ("invalid_json", "invalid_action", "unknown_tool", "bad_arguments",
                                                 "unclosed_reasoning"))
        cited = None if gold is None or not sources else gold in sources
        strict = (answer_ok and bool(searches) and (hit is not False) and not errors and len(calls) <= MAX_CALLS)
        return {
            "strict_success": bool(strict),
            "answer_correct": bool(answer_ok),
            "tool_selection_correct": bool(searches),
            "argument_accuracy": 1.0 if (hit or (gold is None and searches)) else 0.0,  # retrieval found the evidence
            "invalid_calls": invalid,
            "unsupported_answer": bool(answer is not None and not said_not_found and not searches),
            "call_count": len(calls),
            "errors": errors,
            "retrieval_hit": hit,
            "cited_gold": cited,
        }
