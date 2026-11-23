"""Patient access routing and enrichment for a fictional health system (synthetic, administrative only).

Requests (portal messages, calls) are routed to work queues by keyword; referrals are routed to a specialty's default clinic
and enriched with location and scheduling window; an expedite rule uses only administrative signals (the referring
clinician's own urgent flag, days waiting). The agent never assesses symptoms or makes clinical triage decisions.
No real people, records, or identifiers — and none should be added.
"""
from __future__ import annotations

import datetime as dt
import random

from forge.agents.templates._util import date, pick

ID = "patient_access"

REQUESTS = [  # keyword, queue, department, channel, response_hours
    ("prescription refill", "Pharmacy Refill Queue", "Pharmacy", "portal", 48), ("billing question", "Billing Support", "Revenue Cycle", "phone", 72),
    ("payment plan", "Financial Counseling", "Revenue Cycle", "phone", 72), ("price estimate", "Financial Counseling", "Revenue Cycle", "portal", 48),
    ("appointment change", "Central Scheduling", "Access Center", "portal", 24), ("new appointment", "Central Scheduling", "Access Center", "phone", 24),
    ("referral status", "Referral Coordination", "Access Center", "portal", 48), ("records request", "Release of Information", "Health Information Management", "portal", 120),
    ("interpreter", "Language Services", "Care Experience", "phone", 24), ("transportation", "Care Navigation", "Care Management", "phone", 48),
    ("portal access", "Portal Support", "Digital Health", "portal", 24), ("form completion", "Clinic Forms Desk", "Ambulatory Operations", "portal", 120),
    ("insurance update", "Registration", "Access Center", "portal", 48), ("parking", "Guest Services", "Facilities", "phone", 72),
]
SPECIALTIES = ["cardiology", "dermatology", "orthopedics", "gastroenterology", "neurology", "endocrinology", "pulmonology",
               "rheumatology", "urology", "ophthalmology", "otolaryngology", "sleep medicine"]
CAMPUSES = ["North Campus", "Riverside", "Downtown Tower", "East Clinic", "Lakeside Pavilion"]
UNKNOWN = ["lost umbrella", "gift shop hours", "volunteer program", "cafeteria menu", "parking ticket appeal on city streets"]


def requests() -> list[dict]:
    return [{"keyword": k, "queue": q, "department": d, "channel": c, "response_hours": h} for k, q, d, c, h in REQUESTS]


def clinics() -> list[dict]:
    rng = random.Random("clinics:3")
    rows = []
    for s in SPECIALTIES:
        for n in range(2):
            code = f"{s[:4].upper()}-{['N', 'R', 'D', 'E', 'L'][(SPECIALTIES.index(s) + n) % 5]}{n + 4}"
            rows.append({"clinic_code": code, "specialty": s, "location": CAMPUSES[(SPECIALTIES.index(s) + 2 * n) % 5],
                         "accepting_new": "yes" if rng.random() > 0.2 else "no", "next_open_days": rng.choice([3, 6, 9, 14, 21, 28])})
    return rows


def specialties() -> list[dict]:
    rng = random.Random("spec:5")
    rows = []
    for s in SPECIALTIES:
        rows.append({"specialty": s, "default_clinic": next(c["clinic_code"] for c in clinics() if c["specialty"] == s),
                     "routine_window_days": rng.choice([21, 30, 45, 60]), "urgent_window_days": rng.choice([3, 5, 7]),
                     "referral_required": rng.choice(["yes", "yes", "no"])})
    return rows


MSG = ["Portal message: \"Hi, I need help with my {kw}, thanks\"", "Call note: caller asking about {kw}",
       "Portal message: \"Who do I contact about {kw}?\"", "Voicemail transcript: \"...calling about my {kw}...\""]


def _route(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        kw = rng.choice(UNKNOWN)
        return {"question": f"{rng.choice(MSG).format(kw=kw)}. Which work queue should handle it?",
                "calls": [{"tool": "lookup_requests", "arguments": {"key": kw}}], "answer": "NOT_FOUND"}
    r = pick(rng, tables["requests"])
    field, ask = rng.choice([("queue", "Which work queue should handle it?"), ("department", "Which department owns it?"),
                             ("response_hours", "What is the response-time target in hours?")])
    return {"question": f"{rng.choice(MSG).format(kw=r['keyword'])}. {ask}",
            "calls": [{"tool": "lookup_requests", "arguments": {"key": r["keyword"]}}], "answer": str(r[field])}


def _referral(tables: dict, rng: random.Random, nf: bool) -> dict:
    s = pick(rng, tables["specialties"])
    c = next(x for x in tables["clinics"] if x["clinic_code"] == s["default_clinic"])
    field, ask = rng.choice([("location", "At which location will it be scheduled?"), ("clinic_code", "Which clinic should it be routed to?"),
                             ("accepting_new", "Is that clinic accepting new referrals (yes/no)?")])
    calls = [{"tool": "lookup_specialties", "arguments": {"key": s["specialty"]}}]
    if field != "clinic_code":
        calls.append({"tool": "lookup_clinics", "arguments": {"key": c["clinic_code"]}})
    return {"question": f"A {s['specialty']} referral just arrived. {ask}", "calls": calls,
            "answer": s["default_clinic"] if field == "clinic_code" else c[field]}


def _window(tables: dict, rng: random.Random, nf: bool) -> dict:
    s = pick(rng, tables["specialties"])
    urgent = rng.random() < 0.4
    d = date(rng)
    days = s["urgent_window_days"] if urgent else s["routine_window_days"]
    kind = "flagged urgent by the referring clinician" if urgent else "routine"
    return {"question": f"A {s['specialty']} referral ({kind}) was received on {d}. What is the latest date it should be scheduled?",
            "calls": [{"tool": "lookup_specialties", "arguments": {"key": s["specialty"]}},
                      {"tool": "date_math", "arguments": {"op": "add_days", "start": d, "days": days}}],
            "answer": (dt.date.fromisoformat(d) + dt.timedelta(days=days)).isoformat()}


def _expedite(tables: dict, rng: random.Random, nf: bool) -> dict:
    s = pick(rng, tables["specialties"])["specialty"]
    # Balanced labels (≈ half "yes"): urgent flag 1 in 4; otherwise waiting ≥ 30 days 1 in 3. Many distinct inputs.
    flag = "yes" if rng.random() < 0.25 else "no"
    n = rng.randint(30, 60) if rng.random() < 1 / 3 else rng.randint(1, 29)
    return {"question": f"A {s} referral has been waiting {n} days; the referring clinician's urgent flag is '{flag}'. Should scheduling expedite it?",
            "calls": [{"tool": "check_expedite", "arguments": {"urgent_flag": flag, "days_waiting": n}}],
            "answer": "yes" if flag == "yes" or n >= 30 else "no"}


TEMPLATE = {
    "title": "Patient access — request & referral routing (synthetic)",
    "domain": "Health system operations",
    "description": "Route portal messages and calls to work queues, route referrals to clinics and locations, compute scheduling windows, apply an administrative expedite rule.",
    "role": ("You are a patient-access routing assistant for a fictional health system (synthetic data). You route administrative "
             "requests and referrals, and enrich them with queue, department, clinic, location and scheduling dates — using your tools "
             "only. You never give medical advice and never judge clinical urgency: urgency comes only from the referring clinician's flag. "
             "If a request matches nothing in your routing table, answer NOT_FOUND."),
    "tables": [
        {"name": "requests", "description": "Request keyword → work queue, department, channel, response target (hours).", "key": "keyword", "rows": requests},
        {"name": "specialties", "description": "Specialty → default clinic, routine / urgent scheduling windows (days), referral requirement.", "key": "specialty", "rows": specialties},
        {"name": "clinics", "description": "Clinic code → specialty, campus location, accepting new referrals, next open days.", "key": "clinic_code", "rows": clinics},
    ],
    "tools": {"calculator": True, "units": False, "dates": True, "knowledge_pack": None, "rules": [{
        "name": "expedite", "description": "Expedite scheduling when the referring clinician flagged the referral urgent, or it has waited 30 days or more.",
        "inputs": [{"name": "urgent_flag", "type": "text"}, {"name": "days_waiting", "type": "number"}], "match": "any",
        "conditions": [{"input": "urgent_flag", "op": "==", "value": "yes"}, {"input": "days_waiting", "op": ">=", "value": 30}],
        "true_text": "Expedite", "false_text": "Schedule in the normal window"}]},
    "skills": [
        {"id": "route_request", "name": "Route the request", "description": "Find the request type in the message and return its work queue, department, or response target; NOT_FOUND if none matches.",
         "tools": ["lookup_requests", "find_requests"], "not_found": 0.15, "generate": _route, "examples": [
             {"prompt": "Portal message: \"Hi, I need help with my {kw0}, thanks\". Which work queue should handle it?", "answer": "{queue0}",
              "calls": [{"tool": "lookup_requests", "arguments": {"key": "{kw0}"}}]}]},
        {"id": "route_referral", "name": "Route the referral", "description": "Look up the specialty's default clinic, then the clinic's location or availability.",
         "tools": ["lookup_specialties", "lookup_clinics"], "not_found": 0.0, "generate": _referral, "examples": [
             {"prompt": "A {spec0} referral just arrived. At which location will it be scheduled?", "answer": "{loc0}",
              "calls": [{"tool": "lookup_specialties", "arguments": {"key": "{spec0}"}}, {"tool": "lookup_clinics", "arguments": {"key": "{clinic0}"}}]}]},
        {"id": "scheduling_window", "name": "Scheduling window", "description": "Look up the specialty's routine or urgent window and add it to the received date.",
         "tools": ["lookup_specialties", "date_math"], "not_found": 0.0, "generate": _window, "examples": []},
        {"id": "expedite_check", "name": "Expedite check", "description": "Apply the administrative expedite rule (clinician's urgent flag, days waiting).",
         "tools": ["check_expedite"], "not_found": 0.0, "generate": _expedite, "examples": []},
    ],
}


def values(tables: dict) -> dict:
    r, s = tables["requests"][0], tables["specialties"][0]
    c = next(x for x in tables["clinics"] if x["clinic_code"] == s["default_clinic"])
    return {"kw0": r["keyword"], "queue0": r["queue"], "spec0": s["specialty"], "clinic0": c["clinic_code"], "loc0": c["location"]}
