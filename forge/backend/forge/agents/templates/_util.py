"""Helpers shared by the template modules."""
from __future__ import annotations

import random
from typing import Any


def pick(rng: random.Random, rows: list[dict]) -> dict:
    return rows[rng.randrange(len(rows))]


def date(rng: random.Random) -> str:
    import datetime as dt
    return (dt.date(2025, 1, 6) + dt.timedelta(days=rng.randrange(0, 330))).isoformat()


def num(v: Any) -> str:
    """Canonical text of a number as the tools would return it."""
    from decimal import Decimal

    from forge.agents.tools import fmt_num
    return fmt_num(Decimal(str(v)))


def example_values(tables: dict, gens: dict) -> dict[str, Any]:
    """Worked examples for each skill, produced by the skill's own generator (so they always verify): {ex_<k>_q|c|a}."""
    out: dict[str, Any] = {}
    for k, g in gens.items():
        c = g(tables, random.Random(f"example:{k}"), False)
        out[f"ex_{k}_q"], out[f"ex_{k}_c"], out[f"ex_{k}_a"] = c["question"], c["calls"], str(c["answer"])
    return out
