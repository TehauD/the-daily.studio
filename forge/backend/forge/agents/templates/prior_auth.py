"""Prior-authorization criteria for a fictional health plan (synthetic): whether a service needs authorization, unit limits,
review turnaround, and a high-cost review rule. Administrative criteria only — not medical-necessity decisions."""
from __future__ import annotations

import datetime as dt
import random

from forge.agents.templates._util import date, pick

ID = "prior_auth"

SERVICES = ["lumbar spine MRI", "brain MRI", "cardiac stress test", "sleep study", "physical therapy", "occupational therapy",
            "home health visit", "durable wheelchair", "CPAP device", "knee arthroscopy", "outpatient infusion", "genetic panel",
            "bariatric consult", "speech therapy", "PET scan", "hearing aid fitting"]


def services() -> list[dict]:
    rng = random.Random("pa:8")
    rows = []
    for s in SERVICES:
        req = rng.choice(["yes", "yes", "no"])
        rows.append({"service": s, "requires_auth": req, "units_without_auth": 0 if req == "yes" else rng.choice([6, 8, 12, 20]),
                     "standard_turnaround_days": rng.choice([3, 5, 7, 14]), "expedited_turnaround_days": rng.choice([1, 2, 3]),
                     "review_team": rng.choice(["Imaging Review", "Therapy Review", "Medical Review", "DME Review"])})
    return rows


def _required(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        s = rng.choice(["teleportation therapy", "spa membership", "gym badge", "travel vaccine kit"])
        return {"question": f"Does a {s} need prior authorization?", "calls": [{"tool": "lookup_services", "arguments": {"key": s}}], "answer": "NOT_FOUND"}
    r = pick(rng, tables["services"])
    field, ask = rng.choice([("requires_auth", "Does a {s} need prior authorization?"), ("review_team", "Which review team handles a {s} request?"),
                             ("units_without_auth", "How many units of {s} are allowed without authorization?")])
    return {"question": ask.format(s=r["service"]), "calls": [{"tool": "lookup_services", "arguments": {"key": r["service"]}}], "answer": str(r[field])}


def _due(tables: dict, rng: random.Random, nf: bool) -> dict:
    r = pick(rng, tables["services"])
    exp = rng.random() < 0.35
    days = r["expedited_turnaround_days"] if exp else r["standard_turnaround_days"]
    d = date(rng)
    return {"question": f"An {'expedited' if exp else 'standard'} request for a {r['service']} was submitted on {d}. When is the decision due?",
            "calls": [{"tool": "lookup_services", "arguments": {"key": r["service"]}},
                      {"tool": "date_math", "arguments": {"op": "add_days", "start": d, "days": days}}],
            "answer": (dt.date.fromisoformat(d) + dt.timedelta(days=days)).isoformat()}


def _cost(tables: dict, rng: random.Random, nf: bool) -> dict:
    cost = rng.choice([5000, rng.randrange(300, 4999), rng.randrange(5001, 40000)])
    setting = rng.choice(["outpatient", "inpatient", "home"])
    return {"question": f"A request is estimated at ${cost} in the {setting} setting. Does it need high-cost review?",
            "calls": [{"tool": "check_high_cost_review", "arguments": {"estimated_cost": cost, "setting": setting}}],
            "answer": "yes" if cost >= 5000 or setting == "inpatient" else "no"}


TEMPLATE = {
    "title": "Prior authorization criteria (synthetic)", "domain": "Health system operations",
    "description": "Whether a service needs authorization, unit limits, review team, decision due dates, and a high-cost review rule.",
    "role": ("You are a prior-authorization intake assistant for a fictional health plan (synthetic data). You answer administrative "
             "authorization questions — whether a service needs authorization, limits, review team, and decision dates — using your tools "
             "only. You do not make medical-necessity decisions. If a service is not in your data, answer NOT_FOUND."),
    "tables": [{"name": "services", "description": "Service → requires authorization, units allowed without it, turnaround days, review team.",
                "key": "service", "rows": services}],
    "tools": {"calculator": True, "units": False, "dates": True, "knowledge_pack": None, "rules": [{
        "name": "high_cost_review", "description": "High-cost review applies when the estimate is $5,000 or more, or the setting is inpatient.",
        "inputs": [{"name": "estimated_cost", "type": "number"}, {"name": "setting", "type": "text"}], "match": "any",
        "conditions": [{"input": "estimated_cost", "op": ">=", "value": 5000}, {"input": "setting", "op": "==", "value": "inpatient"}],
        "true_text": "High-cost review", "false_text": "Standard review"}]},
    "skills": [
        {"id": "auth_required", "name": "Authorization requirements", "description": "Look up the service; return whether it needs authorization, its review team, or units allowed without it.",
         "tools": ["lookup_services", "find_services"], "not_found": 0.15, "generate": _required, "examples": []},
        {"id": "decision_due", "name": "Decision due date", "description": "Look up the standard or expedited turnaround and add it to the submission date.",
         "tools": ["lookup_services", "date_math"], "not_found": 0.0, "generate": _due, "examples": []},
        {"id": "high_cost", "name": "High-cost review", "description": "Apply the high-cost review rule to the estimate and setting.",
         "tools": ["check_high_cost_review"], "not_found": 0.0, "generate": _cost, "examples": []},
    ],
}


def values(tables: dict) -> dict:
    return {}
