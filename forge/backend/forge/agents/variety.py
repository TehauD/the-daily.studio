"""Variety filter: keep practice tasks from being near-copies of each other.

Similarity is ROUGE-L F1 over lower-cased word tokens (longest common subsequence), the measure Self-Instruct used to
de-duplicate generated instructions. A candidate is a near-duplicate — and rejected, with the score as the reason — when it
makes exactly the same tool calls as an accepted task of the same skill AND its wording scores at or above the threshold:
the same question reworded, which adds nothing and would leak across splits. Tasks that share a sentence shape but look
up different records are kept; how varied the wording is overall is reported per skill (mean nearest-neighbour score).
Exact duplicates are always rejected.
"""
from __future__ import annotations

import re

THRESHOLD = 0.7
_TOK = re.compile(r"[a-z0-9]+")


def tokens(text: str) -> list[str]:
    return _TOK.findall((text or "").lower())


def lcs(a: list[str], b: list[str]) -> int:
    if not a or not b:
        return 0
    prev = [0] * (len(b) + 1)
    for x in a:
        cur = [0]
        for j, y in enumerate(b, 1):
            cur.append(prev[j - 1] + 1 if x == y else max(prev[j], cur[j - 1]))
        prev = cur
    return prev[-1]


def rouge_l(a: str | list[str], b: str | list[str]) -> float:
    ta = a if isinstance(a, list) else tokens(a)
    tb = b if isinstance(b, list) else tokens(b)
    m = lcs(ta, tb)
    if not m:
        return 0.0
    p, r = m / len(tb), m / len(ta)
    return 2 * p * r / (p + r)


def max_similarity(candidate: str, others: list[list[str]]) -> float:
    tc = tokens(candidate)
    return max((rouge_l(tc, o) for o in others), default=0.0)


def summary(prompts_by_skill: dict[str, list[str]]) -> dict[str, dict[str, float]]:
    """Per skill: mean and max nearest-neighbour similarity (lower = more varied)."""
    out = {}
    for s, ps in prompts_by_skill.items():
        toks = [tokens(p) for p in ps]
        nn = [max((rouge_l(t, u) for j, u in enumerate(toks) if j != i), default=0.0) for i, t in enumerate(toks)]
        if nn:
            out[s] = {"n": len(nn), "mean_nearest": round(sum(nn) / len(nn), 3), "max_nearest": round(max(nn), 3)}
    return out
