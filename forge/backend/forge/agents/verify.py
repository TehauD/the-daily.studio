"""Answer normalisation, grounding, and task verification for purpose-built agents.

A practice task is accepted only if FORGE can prove it by running the tools itself:
1. every call uses a tool the skill allows, and executes without error;
2. every argument is *grounded*: a text argument appears in the question or in an earlier tool result; a number
   appears in the question or an earlier result (calculator expressions may also use 0, 1 and 100);
3. the answer is a value that a tool actually returned (or NOT_FOUND, when a lookup really found nothing and the
   skill allows it), and does not appear in the question (no give-aways).
"""
from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

from forge.agents.tools import ToolError, ToolSet, expression_numbers, fmt_num, norm_cell, to_dec

MAX_CALLS = 6
CALC_CONSTANTS = {Decimal(0), Decimal(1), Decimal(100)}
ENUM_ARGS = {"column", "op", "from", "to"}
NUM = re.compile(r"-?\d[\d,]*(?:\.\d+)?")


def answer_norm(a: Any) -> str:
    if isinstance(a, bool):
        return "yes" if a else "no"
    s = str(a).strip().strip('"').strip().rstrip(".").strip()
    low = s.lower()
    if re.fullmatch(r"not[_ ]?found", low):
        return "not_found"
    if low in ("yes", "true", "y"):
        return "yes"
    if low in ("no", "false", "n"):
        return "no"
    m = re.fullmatch(r"\$?\s*(-?[\d,]*\.?\d+)\s*", s)
    if m:
        try:
            return fmt_num(Decimal(m.group(1).replace(",", "")))
        except ArithmeticError:
            pass
    return norm_cell(s)


def numbers_in(text: str) -> set[Decimal]:
    out = set()
    for m in NUM.findall(text or ""):
        try:
            out.add(Decimal(m.replace(",", "")).normalize())
        except ArithmeticError:
            pass
    return out


def atoms(obj: Any) -> set[str]:
    """Every scalar a tool returned, normalised like answers (numbers canonical, booleans yes/no)."""
    out: set[str] = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k not in ("explanation", "conditions_met", "truncated"):
                out |= atoms(v)
    elif isinstance(obj, list):
        for v in obj:
            out |= atoms(v)
    elif obj is not None:
        out.add(answer_norm(obj))
    return out


def answer_matches(answer: Any, ref: Any) -> bool:
    if answer is None:
        return False
    a, r = answer_norm(answer), answer_norm(ref)
    if a == r:
        return True
    if r in ("not_found", "yes", "no"):
        return False
    raw = str(answer)
    if re.fullmatch(r"-?[\d.]+", r):  # numeric reference: a short answer containing exactly that number
        return len(raw) <= 80 and Decimal(r).normalize() in numbers_in(raw)
    return len(a) <= 3 * len(r) + 40 and re.search(rf"(^|\W){re.escape(r)}($|\W)", a) is not None


def is_not_found(res: dict[str, Any]) -> bool:
    return res.get("found") is False or res.get("count") == 0 or res.get("results") == []


def verify_task(ts: ToolSet, allowed: list[str], question: str, calls: Any, answer: Any,
                allow_not_found: bool) -> tuple[str | None, list[dict]]:
    """Returns (rejection reason or None, executed results)."""
    q = (question or "").strip()
    if not q or len(q) > 500:
        return "question missing or longer than 500 characters", []
    if not isinstance(calls, list) or not 1 <= len(calls) <= MAX_CALLS:
        return f"needs 1–{MAX_CALLS} tool calls", []
    known_text, known_nums = norm_cell(q), {n for n in numbers_in(q)}
    known_atoms: set[str] = set()
    results: list[dict] = []
    for i, c in enumerate(calls):
        if not isinstance(c, dict) or not isinstance(c.get("tool"), str) or not isinstance(c.get("arguments"), dict):
            return f"call {i + 1} is not {{tool, arguments}}", results
        tool, args = c["tool"], c["arguments"]
        if tool not in allowed:
            return f"call {i + 1} uses '{tool}', which this skill does not allow", results
        for k, v in args.items():
            if k in ENUM_ARGS:
                continue
            if tool == "calculate" and k == "expression":
                bad = [n for n in expression_numbers(str(v)) if n.normalize() not in known_nums and n not in CALC_CONSTANTS]
                if bad:
                    return f"call {i + 1}: number {fmt_num(bad[0])} in the expression is not in the question or an earlier result", results
                continue
            try:
                d = to_dec(v)
                if d.normalize() not in known_nums:
                    return f"call {i + 1}: {k}={v} is not in the question or an earlier result", results
                continue
            except ToolError:
                pass
            nv = norm_cell(v)
            if not nv or (nv not in known_text and nv not in known_atoms):
                return f"call {i + 1}: {k}='{v}' is not in the question or an earlier result", results
        res, err = ts.call(tool, args)
        if err:
            return f"call {i + 1} failed: {res.get('error')}", results
        results.append(res)
        at = atoms(res)
        known_atoms |= at
        known_nums |= {Decimal(a).normalize() for a in at if re.fullmatch(r"-?\d+(\.\d+)?", a)}
    a = answer_norm(answer)
    if a == "not_found":
        if not allow_not_found:
            return "this skill does not include not-found cases", results
        if not any(is_not_found(r) for r in results):
            return "answer is NOT_FOUND but every lookup found something", results
        return None, results
    if any(is_not_found(r) for r in results[-1:]):
        return "the last tool call found nothing, but the answer is not NOT_FOUND", results
    produced = set().union(*(atoms(r) for r in results)) if results else set()
    if a not in produced:
        return f"answer '{answer}' is not a value the tools returned", results
    if re.fullmatch(r"-?\d+(\.\d+)?", a):
        if Decimal(a).normalize() in numbers_in(q):
            return "the answer appears in the question", results
    elif a not in ("yes", "no") and len(a) >= 3 and a in known_text:
        return "the answer appears in the question", results
    return None, results
