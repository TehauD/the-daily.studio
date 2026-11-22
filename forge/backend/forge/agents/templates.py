"""Starting points for Agent Studio.

`pharmacy_benefits` is entirely SYNTHETIC: invented drug names, tiers, copays and limits for a fictional health plan.
It exists to show a healthcare-operations agent end to end. It is not clinical or formulary data, and FORGE makes no
claim that an agent trained on it is fit for any real-world use.
"""
from __future__ import annotations

import random
from typing import Any

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


ROLE_PB = ("You are a pharmacy-benefits assistant for a fictional health plan (synthetic data). You answer operational "
           "questions about the plan's formulary, quantities, and dates using your tools only. You never give medical advice.")

TEMPLATES: dict[str, dict[str, Any]] = {
    "blank": {
        "title": "Blank agent", "description": "Start from nothing: add your own tables, rules and skills.",
        "role": "", "tables": [], "tools": {"calculator": True, "units": False, "dates": False, "rules": [], "knowledge_pack": None},
        "skills": [],
    },
    "pharmacy_benefits": {
        "title": "Pharmacy-benefits assistant (synthetic)",
        "description": "Formulary lookups, days-supply and refill-date arithmetic, and a coverage-review rule — all on an invented formulary.",
        "role": ROLE_PB,
        "tables": [{"name": "formulary", "description": "Synthetic plan formulary.", "key": "drug", "rows": "synthetic_formulary"}],
        "tools": {"calculator": True, "units": True, "dates": True, "knowledge_pack": None, "rules": [{
            "name": "specialty_review", "description": "Whether a request needs specialty pharmacy review under the (fictional) plan rule: tier 4 or higher, or more than 90 units in 30 days.",
            "inputs": [{"name": "tier", "type": "number"}, {"name": "quantity", "type": "number"}], "match": "any",
            "conditions": [{"input": "tier", "op": ">=", "value": 4}, {"input": "quantity", "op": ">", "value": 90}],
            "true_text": "Specialty review required", "false_text": "No specialty review needed"}]},
        "skills": [
            {"id": "formulary_lookup", "name": "Formulary lookup", "description": "Answer a question about one drug's tier, 30-day copay, quantity limit, form, or prior-authorization flag.",
             "tools": ["lookup_formulary", "find_formulary"], "not_found": 0.2, "examples": [
                 {"prompt": "What tier is {drug0} on?", "answer": "{tier0}", "calls": [{"tool": "lookup_formulary", "arguments": {"key": "{drug0}"}}]},
                 {"prompt": "What is the 30-day copay for {drug1}?", "answer": "{copay1}", "calls": [{"tool": "lookup_formulary", "arguments": {"key": "{drug1}"}}]}]},
            {"id": "days_supply", "name": "Days supply & refill dates", "description": "Work out how many days a dispensed quantity lasts (quantity ÷ units per day), or the date a supply runs out / the next refill date.",
             "tools": ["calculate", "date_math"], "not_found": 0.0, "examples": [
                 {"prompt": "A member picked up 90 tablets and takes 3 per day. How many days does that last?", "answer": "30",
                  "calls": [{"tool": "calculate", "arguments": {"expression": "90 / 3"}}]},
                 {"prompt": "A 30-day supply was filled on 2025-03-10. On what date does it run out?", "answer": "2025-04-09",
                  "calls": [{"tool": "date_math", "arguments": {"op": "add_days", "start": "2025-03-10", "days": 30}}]}]},
            {"id": "coverage_review", "name": "Specialty review check", "description": "Decide whether a request for a given drug and quantity needs specialty review: look up the drug's tier, then apply the rule.",
             "tools": ["lookup_formulary", "check_specialty_review"], "not_found": 0.0, "examples": [
                 {"prompt": "Does a request for 60 units of {drug2} need specialty review?", "answer": "{review2}",
                  "calls": [{"tool": "lookup_formulary", "arguments": {"key": "{drug2}"}},
                            {"tool": "check_specialty_review", "arguments": {"tier": "{tier2}", "quantity": 60}}]}]},
        ],
    },
}


def fill_examples(skills: list[dict], rows: list[dict]) -> list[dict]:
    """Bind template placeholders ({drug0}, {tier0}, …) to real rows of the synthetic table."""
    vals: dict[str, str] = {}
    for i, r in enumerate(rows[:3]):
        vals |= {f"drug{i}": r["drug"], f"tier{i}": str(r["tier"]), f"copay{i}": str(float(r["copay_30day"])).rstrip("0").rstrip("."),
                 f"review{i}": "yes" if int(r["tier"]) >= 4 else "no"}

    def sub(x: Any) -> Any:
        if isinstance(x, str):
            out = x.format(**vals) if "{" in x else x
            return int(out) if x.startswith("{tier") and out.isdigit() else out
        if isinstance(x, list):
            return [sub(v) for v in x]
        if isinstance(x, dict):
            return {k: sub(v) for k, v in x.items()}
        return x
    return [sub(s) for s in skills]
