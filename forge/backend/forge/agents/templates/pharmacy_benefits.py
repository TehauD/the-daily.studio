"""Pharmacy-benefits assistant for a fictional health plan (synthetic): invented drugs, tiers, copays, limits and review rule."""
from __future__ import annotations

import datetime as dt
import random
from typing import Any

from forge.agents.templates._util import date, num, pick

ID = "pharmacy_benefits"
_A = ["Val", "Quin", "Tor", "Zel", "Mir", "Dax", "Lum", "Pex", "Cor", "Nev", "Sor", "Ral", "Ox", "Bri", "Fen", "Kal"]
_B = ["ora", "ina", "ela", "ido", "ava", "eno", "ixa", "uma"]
_C = ["lex", "dril", "vant", "pine", "zole", "mab", "tide", "stat"]
FORMS = ["tablet", "capsule", "oral solution", "injection pen", "inhaler"]


def synthetic_formulary(seed: int = 11, n: int = 36) -> list[dict[str, Any]]:
    rng = random.Random(f"formulary:{seed}")
    names: set[str] = set()
    while len(names) < n:
        names.add(rng.choice(_A) + rng.choice(_B) + rng.choice(_C))
    rows = []
    for name in sorted(names):
        tier = rng.choice([1, 1, 2, 2, 2, 3, 3, 4, 5])
        copay = {1: rng.choice([0, 5, 10]), 2: rng.choice([15, 20, 25]), 3: rng.choice([40, 45, 50]),
                 4: rng.choice([75, 90, 100]), 5: rng.choice([150, 200, 250])}[tier]
        form = rng.choice(FORMS)
        strength = f"{rng.choice([2, 5, 10, 20, 25, 40, 50, 100, 250])} {'mg/mL' if form == 'oral solution' else 'mg'}"
        rows.append({"drug": name, "strength": strength, "form": form, "tier": tier, "copay_30day": f"{copay:.2f}",
                     "quantity_limit_30day": rng.choice([30, 30, 60, 90, 120]), "prior_auth": "yes" if tier >= 4 or rng.random() < 0.15 else "no"})
    return rows


def _lookup(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        fake = rng.choice(_A) + "qu" + rng.choice(_C) + "ol"
        return {"question": f"What tier is {fake} on?", "calls": [{"tool": "lookup_formulary", "arguments": {"key": fake}}], "answer": "NOT_FOUND"}
    r = pick(rng, tables["formulary"])
    field, ask = rng.choice([("tier", "What tier is {d} on?"), ("copay_30day", "What is the 30-day copay for {d}?"),
                             ("quantity_limit_30day", "What is the 30-day quantity limit for {d}?"), ("prior_auth", "Does {d} require prior authorization?"),
                             ("form", "What dosage form is {d} on the formulary?")])
    return {"question": ask.format(d=r["drug"]), "calls": [{"tool": "lookup_formulary", "arguments": {"key": r["drug"]}}], "answer": str(r[field])}


def _supply(tables: dict, rng: random.Random, nf: bool) -> dict:
    if rng.random() < 0.5:
        per = rng.choice([2, 3, 4])
        qty = per * rng.choice([7, 14, 15, 28, 45])
        return {"question": f"A member picked up {qty} tablets and takes {per} per day. How many days does that last?",
                "calls": [{"tool": "calculate", "arguments": {"expression": f"{qty} / {per}"}}], "answer": num(qty // per)}
    days = rng.choice([28, 30, 60, 90])
    d = date(rng)
    return {"question": f"A {days}-day supply was filled on {d}. On what date does it run out?",
            "calls": [{"tool": "date_math", "arguments": {"op": "add_days", "start": d, "days": days}}],
            "answer": (dt.date.fromisoformat(d) + dt.timedelta(days=days)).isoformat()}


def _review(tables: dict, rng: random.Random, nf: bool) -> dict:
    r = pick(rng, tables["formulary"])
    q = rng.choice([30, 60, 120, 150])
    return {"question": f"Does a request for {q} units of {r['drug']} need specialty review?",
            "calls": [{"tool": "lookup_formulary", "arguments": {"key": r["drug"]}},
                      {"tool": "check_specialty_review", "arguments": {"tier": r["tier"], "quantity": q}}],
            "answer": "yes" if r["tier"] >= 4 or q > 90 else "no"}


TEMPLATE = {
    "title": "Pharmacy-benefits assistant (synthetic)", "domain": "Health system operations",
    "description": "Formulary lookups, days-supply and refill-date arithmetic, and a coverage-review rule — all on an invented formulary.",
    "role": ("You are a pharmacy-benefits assistant for a fictional health plan (synthetic data). You answer operational "
             "questions about the plan's formulary, quantities, and dates using your tools only. You never give medical advice."),
    "tables": [{"name": "formulary", "description": "Synthetic plan formulary.", "key": "drug", "rows": synthetic_formulary}],
    "tools": {"calculator": True, "units": True, "dates": True, "knowledge_pack": None, "rules": [{
        "name": "specialty_review", "description": "Whether a request needs specialty pharmacy review under the (fictional) plan rule: tier 4 or higher, or more than 90 units in 30 days.",
        "inputs": [{"name": "tier", "type": "number"}, {"name": "quantity", "type": "number"}], "match": "any",
        "conditions": [{"input": "tier", "op": ">=", "value": 4}, {"input": "quantity", "op": ">", "value": 90}],
        "true_text": "Specialty review required", "false_text": "No specialty review needed"}]},
    "skills": [
        {"id": "formulary_lookup", "name": "Formulary lookup", "description": "Answer a question about one drug's tier, 30-day copay, quantity limit, form, or prior-authorization flag.",
         "tools": ["lookup_formulary", "find_formulary"], "not_found": 0.2, "generate": _lookup, "examples": [
             {"prompt": "What tier is {drug0} on?", "answer": "{tier0}", "calls": [{"tool": "lookup_formulary", "arguments": {"key": "{drug0}"}}]},
             {"prompt": "What is the 30-day copay for {drug1}?", "answer": "{copay1}", "calls": [{"tool": "lookup_formulary", "arguments": {"key": "{drug1}"}}]}]},
        {"id": "days_supply", "name": "Days supply & refill dates", "description": "Work out how many days a dispensed quantity lasts (quantity ÷ units per day), or the date a supply runs out / the next refill date.",
         "tools": ["calculate", "date_math"], "not_found": 0.0, "generate": _supply, "examples": [
             {"prompt": "A member picked up 90 tablets and takes 3 per day. How many days does that last?", "answer": "30",
              "calls": [{"tool": "calculate", "arguments": {"expression": "90 / 3"}}]},
             {"prompt": "A 30-day supply was filled on 2025-03-10. On what date does it run out?", "answer": "2025-04-09",
              "calls": [{"tool": "date_math", "arguments": {"op": "add_days", "start": "2025-03-10", "days": 30}}]}]},
        {"id": "coverage_review", "name": "Specialty review check", "description": "Decide whether a request for a given drug and quantity needs specialty review: look up the drug's tier, then apply the rule.",
         "tools": ["lookup_formulary", "check_specialty_review"], "not_found": 0.0, "generate": _review, "examples": [
             {"prompt": "Does a request for 60 units of {drug2} need specialty review?", "answer": "{review2}",
              "calls": [{"tool": "lookup_formulary", "arguments": {"key": "{drug2}"}},
                        {"tool": "check_specialty_review", "arguments": {"tier": "{tier2}", "quantity": 60}}]}]},
    ],
}


def values(tables: dict) -> dict:
    rows = tables["formulary"]
    vals: dict[str, Any] = {}
    for i, r in enumerate(rows[:3]):
        vals |= {f"drug{i}": r["drug"], f"tier{i}": r["tier"], f"copay{i}": num(r["copay_30day"]),
                 f"review{i}": "yes" if int(r["tier"]) >= 4 else "no"}
    vals["tier0"] = str(vals["tier0"])
    return vals
