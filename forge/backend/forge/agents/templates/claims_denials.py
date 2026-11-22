"""Claims denial work-queue routing for a fictional health system's revenue cycle (synthetic).

Denial reason codes follow the public CARC group/code convention; descriptions are FORGE's own short paraphrases. Payers,
filing limits and amounts are invented.
"""
from __future__ import annotations

import datetime as dt
import random

from forge.agents.templates._util import date, pick

ID = "claims_denials"

CODES = [  # code, category, next action, work queue, appealable
    ("CO-16", "Missing information", "Correct the claim data and resubmit", "Claim Edits", "no"),
    ("CO-18", "Duplicate claim", "Confirm the original claim's status; do not resubmit", "Claim Follow-up", "no"),
    ("CO-22", "Coordination of benefits", "Bill the primary payer first", "Eligibility & COB", "no"),
    ("CO-27", "Coverage ended", "Verify eligibility on the service date", "Eligibility & COB", "no"),
    ("CO-29", "Timely filing", "Find proof of timely submission, then appeal", "Appeals", "yes"),
    ("CO-45", "Contractual adjustment", "Post the adjustment per contract", "Payment Posting", "no"),
    ("CO-50", "Not deemed necessary by payer", "Gather documentation and appeal", "Appeals", "yes"),
    ("CO-97", "Bundled service", "Review coding and modifiers", "Coding Review", "yes"),
    ("CO-197", "Authorization missing", "Check for a retro-authorization, then appeal", "Authorizations", "yes"),
    ("CO-109", "Wrong payer", "Send to the correct payer", "Claim Follow-up", "no"),
    ("PR-1", "Deductible", "Bill the guarantor", "Self-Pay", "no"),
    ("PR-2", "Coinsurance", "Bill the guarantor", "Self-Pay", "no"),
    ("PR-3", "Copayment", "Bill the guarantor", "Self-Pay", "no"),
]
PAYERS = ["Northwind Health Plan", "Lakeside Mutual", "Summit Care", "Riverbend Medicaid", "Evergreen Advantage", "Harbor PPO"]


def codes() -> list[dict]:
    return [{"code": c, "category": cat, "next_action": a, "work_queue": q, "appealable": ap} for c, cat, a, q, ap in CODES]


def payers() -> list[dict]:
    rng = random.Random("payers:6")
    return [{"payer_code": f"PYR-{i + 11}", "payer_name": n, "appeal_window_days": rng.choice([60, 90, 120, 180]),
             "timely_filing_days": rng.choice([90, 120, 180, 365])} for i, n in enumerate(PAYERS)]


def _route(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        c = f"CO-{rng.choice([301, 402, 503, 604])}"
        return {"question": f"A remittance shows denial code {c}. Which work queue should take it?",
                "calls": [{"tool": "lookup_codes", "arguments": {"key": c}}], "answer": "NOT_FOUND"}
    r = pick(rng, tables["codes"])
    field, ask = rng.choice([("work_queue", "Which work queue should take it?"), ("category", "What kind of denial is it?"),
                             ("next_action", "What is the next action?"), ("appealable", "Is it appealable (yes/no)?")])
    return {"question": f"A remittance shows denial code {r['code']}. {ask}", "calls": [{"tool": "lookup_codes", "arguments": {"key": r["code"]}}],
            "answer": r[field]}


def _deadline(tables: dict, rng: random.Random, nf: bool) -> dict:
    p = pick(rng, tables["payers"])
    d = date(rng)
    return {"question": f"A claim to payer {p['payer_code']} was denied on {d}. What is the last day to file an appeal?",
            "calls": [{"tool": "lookup_payers", "arguments": {"key": p["payer_code"]}},
                      {"tool": "date_math", "arguments": {"op": "add_days", "start": d, "days": p["appeal_window_days"]}}],
            "answer": (dt.date.fromisoformat(d) + dt.timedelta(days=p["appeal_window_days"])).isoformat()}


def _small(tables: dict, rng: random.Random, nf: bool) -> dict:
    amt = round(rng.choice([rng.uniform(1, 25), rng.uniform(25.01, 400)]), 2)
    return {"question": f"A denied line has a balance of ${amt}. Does it qualify for small-balance write-off review?",
            "calls": [{"tool": "check_small_balance", "arguments": {"balance": amt}}], "answer": "yes" if amt <= 25 else "no"}


TEMPLATE = {
    "title": "Claims denials — revenue-cycle routing (synthetic)", "domain": "Health system operations",
    "description": "Route denials by reason code to work queues with the next action, compute appeal deadlines per payer, flag small balances.",
    "role": ("You are a revenue-cycle denials assistant for a fictional health system (synthetic data). You classify claim denials by "
             "reason code, route them to the right work queue with the next action, and compute appeal deadlines — using your tools only. "
             "If a code or payer is not in your data, answer NOT_FOUND."),
    "tables": [
        {"name": "codes", "description": "Denial reason code (CARC-style) → category, next action, work queue, appealable.", "key": "code", "rows": codes},
        {"name": "payers", "description": "Payer → appeal window and timely-filing limit (days).", "key": "payer_code", "rows": payers},
    ],
    "tools": {"calculator": True, "units": False, "dates": True, "knowledge_pack": None, "rules": [{
        "name": "small_balance", "description": "Small-balance write-off review applies to denied balances of $25 or less.",
        "inputs": [{"name": "balance", "type": "number"}], "match": "all",
        "conditions": [{"input": "balance", "op": "<=", "value": 25}], "true_text": "Small-balance write-off review", "false_text": "Work the denial"}]},
    "skills": [
        {"id": "route_denial", "name": "Route the denial", "description": "Look up the reason code; return its work queue, category, next action, or appealability; NOT_FOUND for unknown codes.",
         "tools": ["lookup_codes", "find_codes"], "not_found": 0.15, "generate": _route, "examples": []},
        {"id": "appeal_deadline", "name": "Appeal deadline", "description": "Look up the payer's appeal window and add it to the denial date.",
         "tools": ["lookup_payers", "date_math"], "not_found": 0.0, "generate": _deadline, "examples": []},
        {"id": "small_balance", "name": "Small-balance check", "description": "Apply the small-balance rule to the denied amount.",
         "tools": ["check_small_balance"], "not_found": 0.0, "generate": _small, "examples": []},
    ],
}


def values(tables: dict) -> dict:
    return {}
