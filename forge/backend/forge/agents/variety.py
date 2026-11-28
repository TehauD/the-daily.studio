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
from collections import Counter

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


def _bound(ca: Counter[str], la: int, cb: Counter[str], lb: int) -> float:
    """Upper bound on ROUGE-L F1: the LCS can be no longer than the bag-of-words overlap, and F1 = 2·m/(|a|+|b|)."""
    if not la or not lb:
        return 0.0
    m = sum((ca & cb).values())
    return 2 * m / (la + lb)


def summary(prompts_by_skill: dict[str, list[str]]) -> dict[str, dict[str, float]]:
    """Per skill: mean and max nearest-neighbour similarity (lower = more varied).

    Exact: candidates are tried in order of an upper bound and the search stops once no remaining bound can beat the best
    score found, so the full O(n²) LCS sweep is only paid for tasks whose wording really is close.
    """
    out = {}
    for s, ps in prompts_by_skill.items():
        toks = [tokens(p) for p in ps]
        bags = [Counter(t) for t in toks]
        nn = []
        for i, t in enumerate(toks):
            cand = sorted(((_bound(bags[i], len(t), bags[j], len(u)), j) for j, u in enumerate(toks) if j != i), reverse=True)
            best = 0.0
            for b, j in cand:
                if b <= best:
                    break
                best = max(best, rouge_l(t, toks[j]))
            nn.append(best)
        if nn:
            out[s] = {"n": len(nn), "mean_nearest": round(sum(nn) / len(nn), 3), "max_nearest": round(max(nn), 3)}
    return out
