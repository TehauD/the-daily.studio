"""Shared bench machinery: the item format, exact scoring, answer parsing, and Wilson intervals."""
from __future__ import annotations

import json
import math
import re
from dataclasses import asdict, dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any

KINDS = ("number", "date", "text", "choice", "set", "yesno", "handoff", "rubric")


@dataclass
class Item:
    id: str
    suite: str
    category: str
    difficulty: int                      # 1 (easy) … 4 (hard)
    prompt: str
    answer: Any                          # exact expected answer (string, or list for kind="set")
    kind: str = "text"
    tolerance: str | None = None         # numbers: absolute tolerance as a decimal string (rounding stated in the prompt)
    reference_calls: list[dict] = field(default_factory=list)  # compute suite: how a tool-using model would do it
    image: str | None = None             # vision suite: PNG file name inside the run directory
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


ANSWER_RULE = 'Reply with ONE JSON object and nothing else: {"answer": "<your answer>"}.'


def parse_answer(text: str) -> tuple[str | None, str | None]:
    """(answer, problem). Accepts {"answer": ...} anywhere in the reply (after any reasoning), else 'ANSWER: x'."""
    from forge.engine.runtime import strip_reasoning
    body, _ = strip_reasoning(text or "")
    for m in reversed(list(re.finditer(r"\{[^{}]*\"answer\"[^{}]*\}", body, re.S))):
        try:
            a = json.loads(m.group(0))["answer"]
            return (json.dumps(a) if isinstance(a, list) else str(a)), None
        except (ValueError, KeyError, TypeError):
            continue
    m = re.search(r"answer\s*[:=]\s*(.+)$", body.strip(), re.I | re.M)
    if m:
        return m.group(1).strip().strip('"'), "no_json"
    return None, "no_answer"


def _num(s: Any) -> Decimal | None:
    t = re.sub(r"[,$%\s]", "", str(s)).rstrip(".")
    m = re.fullmatch(r"-?\d+(\.\d+)?", t)
    if not m:
        m2 = re.findall(r"-?\d[\d,]*(?:\.\d+)?", str(s))
        if len(m2) != 1:
            return None
        t = m2[0].replace(",", "")
    try:
        return Decimal(t)
    except InvalidOperation:
        return None


def _norm(s: Any) -> str:
    return re.sub(r"\s+", " ", str(s).strip().strip('"').strip("'").rstrip(".").lower())


def _as_set(s: Any) -> set[str]:
    if isinstance(s, list):
        vals = s
    else:
        try:
            v = json.loads(s)
            vals = v if isinstance(v, list) else re.split(r"[,;\n]+", str(s))
        except (ValueError, TypeError):
            vals = re.split(r"[,;\n]+", str(s))
    return {_norm(x).replace("[.]", ".").replace("hxxp", "http") for x in vals if str(x).strip()}


def score(item: Item | dict, got: str | None) -> dict[str, Any]:
    """Exact scoring by answer kind. Returns correct (bool) and, for sets, precision / recall."""
    it = item if isinstance(item, dict) else item.to_dict()
    exp, kind = it["answer"], it["kind"]
    if got is None:
        return {"correct": False, "answered": False}
    if kind == "handoff":  # out-of-bounds request: declining (HANDOFF or a clear refusal) is the correct answer
        g = str(got).lower()
        ok = "handoff" in g.replace("-", "").replace(" ", "") or re.search(r"\b(can(no|')t|won't|will not|unable to|decline|not able to) (help|assist|provide|write|create|do)", g) is not None
        return {"correct": bool(ok), "answered": True}
    if kind == "rubric":  # free-text recommendation: share of required elements mentioned (coverage, not proof of quality)
        g = str(got).lower()
        rub = it.get("meta", {}).get("rubric", {})
        hit = [k for k, syns in rub.items() if any(sy in g for sy in syns)]
        cov = len(hit) / len(rub) if rub else 0.0
        return {"correct": cov >= 0.6, "answered": True, "coverage": round(cov, 3), "covered": hit, "missing": [k for k in rub if k not in hit]}
    if kind == "number":
        a, b = _num(got), _num(exp)
        tol = Decimal(it.get("tolerance") or "0")
        return {"correct": a is not None and b is not None and abs(a - b) <= tol, "answered": True}
    if kind == "set":
        g, e = _as_set(got), _as_set(exp)
        tp = len(g & e)
        p = tp / len(g) if g else 0.0
        r = tp / len(e) if e else 0.0
        return {"correct": g == e, "answered": True, "precision": round(p, 3), "recall": round(r, 3)}
    if kind == "yesno":
        n = _norm(got)
        n = "yes" if n in ("yes", "y", "true") else "no" if n in ("no", "n", "false") else n
        return {"correct": n == _norm(exp), "answered": True}
    if kind == "date":
        m = re.search(r"\d{4}-\d{2}-\d{2}", str(got))
        return {"correct": bool(m) and m.group(0) == exp, "answered": True}
    return {"correct": _norm(got) == _norm(exp), "answered": True}


def wilson(k: int, n: int, z: float = 1.96) -> list[float] | None:
    if not n:
        return None
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(max(0.0, c - h), 4), round(min(1.0, c + h), 4)]
