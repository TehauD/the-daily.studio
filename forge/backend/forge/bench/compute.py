"""Model Bench — computational accuracy. Generated problems with exact answers in five categories × four difficulties.

Each item carries the reference tool calls that compute its answer, so the same item runs twice:
- without tools: the model must compute the answer itself;
- with tools:   the model may call calculate / date_math / convert_units (the same read-only tools agents use), and
                 success also requires the answer to be backed by a tool result.
Prompts state the rounding rule; answers are compared exactly (after that rounding). Administrative, non-clinical
contexts only.
"""
from __future__ import annotations

import datetime as dt
import random
from decimal import ROUND_HALF_UP, Decimal

from forge.agents.tools import convert_units, fmt_num
from forge.bench.common import Item

CATEGORIES = {"arithmetic": "Arithmetic", "percent": "Percentages & rounding", "dates": "Date arithmetic",
              "units": "Unit conversion", "word": "Multi-step word problems"}
TOOLS_META = {"calculator": True, "units": True, "dates": True, "knowledge_pack": None, "rules": [], "tables": []}


def _r2(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _calc(expr: str) -> dict:
    return {"tool": "calculate", "arguments": {"expression": expr}}


def _d(rng: random.Random, y: int = 2025) -> dt.date:
    return dt.date(y, 1, 1) + dt.timedelta(days=rng.randrange(0, 360))


def arithmetic(rng: random.Random, lvl: int) -> tuple[str, str, list, str | None]:
    if lvl == 1:
        a, b = rng.randrange(10, 99), rng.randrange(10, 99)
        return f"What is {a} + {b}?", fmt_num(Decimal(a + b)), [_calc(f"{a} + {b}")], None
    if lvl == 2:
        a, b = rng.randrange(101, 999), rng.randrange(11, 99)
        return f"What is {a} × {b}?", fmt_num(Decimal(a * b)), [_calc(f"{a} * {b}")], None
    if lvl == 3:
        a, b, c, d = rng.randrange(120, 980), rng.randrange(12, 89), rng.randrange(100, 4000), rng.randrange(3, 19)
        v = _r2((Decimal(a) * b - c) / d)
        return f"Compute ({a} × {b} − {c}) ÷ {d}. Round to 2 decimal places.", fmt_num(v), [_calc(f"round(({a} * {b} - {c}) / {d}, 2)")], None
    a, b, c, d, e = rng.randrange(1200, 98000), rng.randrange(13, 97), rng.randrange(1000, 9999), rng.randrange(7, 61), rng.randrange(101, 999)
    v = _r2((Decimal(a) * b + Decimal(c) * d) / e)
    return (f"Compute ({a} × {b} + {c} × {d}) ÷ {e}. Round to 2 decimal places.", fmt_num(v),
            [_calc(f"round(({a} * {b} + {c} * {d}) / {e}, 2)")], None)


def percent(rng: random.Random, lvl: int) -> tuple[str, str, list, str | None]:
    if lvl == 1:
        p, x = rng.choice([10, 20, 25, 50, 5]), rng.randrange(2, 60) * 10
        return f"What is {p}% of {x}?", fmt_num(Decimal(p) * x / 100), [_calc(f"{p} / 100 * {x}")], None
    if lvl == 2:
        p, x = rng.randrange(3, 40), rng.randrange(120, 4000)
        v = _r2(Decimal(x) * (100 + p) / 100)
        return f"Increase {x} by {p}%. Round to 2 decimal places.", fmt_num(v), [_calc(f"round({x} * (100 + {p}) / 100, 2)")], None
    if lvl == 3:
        a, b = rng.randrange(200, 9000), rng.randrange(200, 9000)
        v = _r2((Decimal(b) - a) / a * 100)
        return (f"A monthly count went from {a} to {b}. What is the percent change? Round to 2 decimal places (negative if it fell).",
                fmt_num(v), [_calc(f"round(({b} - {a}) / {a} * 100, 2)")], None)
    x, disc, tax = Decimal(rng.randrange(2000, 250000)) / 100, Decimal(rng.choice(["12.5", "15", "7.5", "20", "33"])), Decimal(rng.choice(["7.25", "6.5", "8.875", "5.3"]))
    v = _r2(x * (100 - disc) / 100 * (100 + tax) / 100)
    return (f"An invoice of ${x} gets a {disc}% discount, then {tax}% tax is added to the discounted amount. What is the total? Round to cents.",
            fmt_num(v), [_calc(f"round({x} * (100 - {disc}) / 100 * (100 + {tax}) / 100, 2)")], None)


def dates(rng: random.Random, lvl: int) -> tuple[str, str, list, str | None]:
    if lvl in (1, 2):
        s = _d(rng)
        n = rng.randrange(3, 15) if lvl == 1 else rng.randrange(40, 130)
        out = (s + dt.timedelta(days=n)).isoformat()
        return f"What date is {n} days after {s.isoformat()}? Answer as YYYY-MM-DD.", out, [{"tool": "date_math", "arguments": {"op": "add_days", "start": s.isoformat(), "days": n}}], None
    if lvl == 3:
        a = _d(rng)
        b = a + dt.timedelta(days=rng.randrange(20, 300))
        return f"How many days are there from {a.isoformat()} to {b.isoformat()}?", str((b - a).days), [{"tool": "date_math", "arguments": {"op": "days_between", "start": a.isoformat(), "end": b.isoformat()}}], None
    a = dt.date(2023, 11, 1) + dt.timedelta(days=rng.randrange(0, 120))
    n = rng.randrange(300, 800)
    out = (a + dt.timedelta(days=n)).isoformat()
    return (f"What date is {n} days after {a.isoformat()}? (2024 is a leap year.) Answer as YYYY-MM-DD.", out,
            [{"tool": "date_math", "arguments": {"op": "add_days", "start": a.isoformat(), "days": n}}], None)


def units(rng: random.Random, lvl: int) -> tuple[str, str, list, str | None]:
    pairs = {1: [("kg", "g"), ("l", "ml"), ("km", "m"), ("h", "min")], 2: [("mg", "mcg"), ("ml", "l"), ("week", "h"), ("cm", "mm")],
             3: [("lb", "kg"), ("in", "cm"), ("ft", "m"), ("oz", "g")], 4: [("f", "c"), ("c", "f"), ("fl_oz", "ml"), ("lb", "oz")]}
    a, b = rng.choice(pairs[lvl])
    v = Decimal(rng.randrange(2, 400)) if lvl < 3 else Decimal(rng.randrange(150, 9900)) / 10
    out = _r2(convert_units(v, a, b))
    names = {"f": "°F", "c": "°C", "fl_oz": "fluid ounces", "mcg": "micrograms", "h": "hours", "min": "minutes", "week": "weeks"}
    return (f"Convert {fmt_num(v)} {names.get(a, a)} to {names.get(b, b)}. Round to 2 decimal places.", fmt_num(out),
            [{"tool": "convert_units", "arguments": {"value": float(v), "from": a, "to": b}},
             _calc(f"round({fmt_num(convert_units(v, a, b))}, 2)")], "0.01")


def word(rng: random.Random, lvl: int) -> tuple[str, str, list, str | None]:
    if lvl == 1:
        per, days = rng.randrange(12, 40), rng.randrange(3, 6)
        return f"A help desk closes {per} tickets a day. How many tickets does it close in {days} days?", str(per * days), [_calc(f"{per} * {days}")], None
    if lvl == 2:
        boxes, per, used = rng.randrange(6, 30), rng.randrange(12, 50), rng.randrange(20, 200)
        tot = boxes * per
        used = min(used, tot - 1)
        return (f"A supply room has {boxes} boxes of {per} forms each. {used} forms are used. How many forms are left?",
                str(tot - used), [_calc(f"{boxes} * {per} - {used}")], None)
    if lvl == 3:
        visits, days, noshow = rng.randrange(14, 40), rng.randrange(18, 24), rng.randrange(4, 15)
        v = (Decimal(visits * days) * (100 - noshow) / 100).quantize(Decimal(1), rounding=ROUND_HALF_UP)
        return (f"A clinic books {visits} visits a day for {days} working days. {noshow}% of bookings are no-shows. How many visits are "
                f"completed? Round to the nearest whole number.", fmt_num(v), [_calc(f"round({visits} * {days} * (100 - {noshow}) / 100, 0)")], None)
    staff, hrs, rate, ot, oth = rng.randrange(3, 12), rng.randrange(32, 40), Decimal(rng.randrange(1800, 4200)) / 100, Decimal("1.5"), rng.randrange(2, 9)
    v = _r2(staff * (hrs * rate + oth * rate * ot))
    return (f"{staff} staff each work {hrs} regular hours at ${rate}/hour plus {oth} overtime hours at 1.5× that rate. What is the total pay? "
            f"Round to cents.", fmt_num(v), [_calc(f"round({staff} * ({hrs} * {rate} + {oth} * {rate} * 1.5), 2)")], None)


GEN = {"arithmetic": arithmetic, "percent": percent, "dates": dates, "units": units, "word": word}


def generate(n_per_cell: int = 8, seed: int = 1, categories: list[str] | None = None) -> list[Item]:
    rng = random.Random(f"compute:{seed}")
    out = []
    for cat in categories or list(CATEGORIES):
        for lvl in (1, 2, 3, 4):
            for i in range(n_per_cell):
                q, a, calls, tol = GEN[cat](rng, lvl)
                out.append(Item(id=f"cmp-{cat[:4]}-{lvl}-{i:03d}", suite="compute", category=cat, difficulty=lvl, prompt=q, answer=a,
                                kind="date" if cat == "dates" and "YYYY" in q else "number", tolerance=tol, reference_calls=calls))
    return out
