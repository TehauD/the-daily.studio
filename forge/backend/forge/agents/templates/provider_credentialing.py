"""Provider credentialing and payer enrollment checks for a fictional medical staff office (synthetic).

Invented providers, licences, board certifications, malpractice coverage and payer enrollments. The agent reports status,
expiry and renewal windows, re-credentialing due dates and enrollment status. It never grants or changes privileges,
never judges a provider's competence, and never shares personal details — those are hand-back (boundary) cases.

No real identifiers: provider ids are FORGE's own (PRV-2xxx); there are no NPIs, DEA numbers, licence numbers, addresses or
contact details. Fictional policy: renewal action is needed when a credential expires within 90 days (or has expired);
re-credentialing is due 1,095 days (36 months) after the last credentialing date.

Skills (balanced answers, enough items for a 60/20/20 split):
- credential_lookup    one lookup: specialty, department, licence state / expiry, board status, privileges, last credentialed
- renewal_check        days between the as-of date and an expiry, then the 90-day renewal rule (yes/no), or the days left
- recredential_due     last credentialed + 1,095 days, or the days from an as-of date to that due date
- enrollment_status    find the provider's payer enrollments; status or effective date with one payer
"""
from __future__ import annotations

import datetime as dt
import random

from forge.agents.templates._util import num, pick

ID = "provider_credentialing"

_FIRST = ["Avery", "Jordan", "Riley", "Morgan", "Casey", "Quinn", "Rowan", "Sasha", "Emery", "Harper", "Reese", "Skyler", "Tatum", "Blair", "Devon", "Kendall"]
_LAST = ["Lindqvist", "Okafor", "Marchetti", "Vasquez-Hale", "Thorne", "Abernathy", "Kowalczyk", "Nakamura-Ruiz", "Delacroix", "Fairbanks",
         "Haldane", "Ingersoll", "Jaramillo", "Kessler", "Lockwood", "Montague", "Northcott", "Oyelaran", "Penhallow", "Quist"]
SPECIALTIES = [("Family Medicine", "Primary Care"), ("Internal Medicine", "Primary Care"), ("Pediatrics", "Women & Children"),
               ("Obstetrics & Gynecology", "Women & Children"), ("Orthopedic Surgery", "Surgery"), ("General Surgery", "Surgery"),
               ("Cardiology", "Heart & Vascular"), ("Radiology", "Imaging"), ("Anesthesiology", "Perioperative"), ("Emergency Medicine", "Emergency"),
               ("Psychiatry", "Behavioral Health"), ("Nurse Practitioner, Family", "Primary Care"), ("Physician Assistant, Surgery", "Surgery"),
               ("Physical Therapy", "Rehabilitation"), ("Dermatology", "Specialty Clinics"), ("Gastroenterology", "Specialty Clinics")]
STATES = ["Ohio", "Michigan", "Indiana", "Kentucky", "Pennsylvania", "Illinois"]
PAYERS = ["Northwind Health Plan", "Bluepeak Care", "Cedar Mutual", "Harbor Community Medicaid", "Summit Medicare Advantage", "Lakeshore Employers Trust"]
RENEWAL_DAYS, RECRED_DAYS = 90, 1095
_BASE = dt.date(2025, 7, 1)


def _d(rng: random.Random, lo: int, hi: int) -> str:
    return (_BASE + dt.timedelta(days=rng.randrange(lo, hi))).isoformat()


def providers() -> list[dict]:
    rng = random.Random("cred:prov:v1")
    rows, names = [], set()
    for i in range(70):
        while True:
            n = f"{rng.choice(_FIRST)} {rng.choice(_LAST)}"
            if n not in names:
                names.add(n)
                break
        spec, dept = SPECIALTIES[i % len(SPECIALTIES)]
        cert = rng.choice(["certified", "certified", "certified", "board eligible", "not applicable"])
        rows.append({"provider_id": f"PRV-{2001 + i}", "provider_name": n, "specialty": spec, "department": dept,
                     "license_state": rng.choice(STATES), "license_expires": _d(rng, -60, 700), "board_status": cert,
                     "board_expires": _d(rng, 30, 2000) if cert == "certified" else "none", "malpractice_expires": _d(rng, -30, 400),
                     "last_credentialed": _d(rng, -1080, -30), "privileges": rng.choice(["active", "active", "active", "provisional", "inactive"])})
    return rows


def enrollments() -> list[dict]:
    rng = random.Random("cred:enr:v1")
    rows, n = [], 5001
    for p in providers():
        if rng.random() < 0.12:
            continue  # newly hired: no enrollments on file yet (→ NOT_FOUND)
        for payer in rng.sample(PAYERS, rng.randint(2, 5)):
            st = rng.choice(["enrolled", "enrolled", "enrolled", "pending", "terminated"])
            rows.append({"enrollment_id": f"ENR-{n}", "provider_id": p["provider_id"], "payer": payer, "status": st,
                         "effective_date": _d(rng, -900, 60) if st != "pending" else "none"})
            n += 1
    return rows


def _lookup(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        c = f"PRV-{rng.randrange(8000, 8999)}"
        return {"question": f"What specialty is provider {c} credentialed in?", "calls": [{"tool": "lookup_providers", "arguments": {"key": c}}], "answer": "NOT_FOUND"}
    r = pick(rng, tables["providers"])
    field, ask = rng.choice([("specialty", "What specialty is provider {p} credentialed in?"), ("department", "Which department is {p} on staff with?"),
                             ("license_state", "In which state is {p}'s licence on file?"), ("license_expires", "When does {p}'s licence expire?"),
                             ("board_status", "What is {p}'s board certification status?"), ("privileges", "What is the status of {p}'s clinical privileges?"),
                             ("last_credentialed", "When was {p} last credentialed?"), ("malpractice_expires", "When does {p}'s malpractice coverage expire?")])
    return {"question": ask.format(p=r["provider_id"]), "calls": [{"tool": "lookup_providers", "arguments": {"key": r["provider_id"]}}], "answer": str(r[field])}


def _renewal(tables: dict, rng: random.Random, nf: bool) -> dict:
    field, label = rng.choice([("license_expires", "licence"), ("malpractice_expires", "malpractice coverage"), ("board_expires", "board certification")])
    r = pick(rng, [x for x in tables["providers"] if x[field] != "none"])
    exp = dt.date.fromisoformat(r[field])
    want = rng.random() < 0.5
    left = rng.randrange(-45, RENEWAL_DAYS + 1) if want else rng.randrange(RENEWAL_DAYS + 1, 400)
    as_of = (exp - dt.timedelta(days=left)).isoformat()
    calls = [{"tool": "lookup_providers", "arguments": {"key": r["provider_id"]}},
             {"tool": "date_math", "arguments": {"op": "days_between", "start": as_of, "end": r[field]}}]
    if rng.random() < 0.25:
        return {"question": f"As of {as_of}, how many days remain before {r['provider_id']}'s {label} expires (negative if already expired)?",
                "calls": calls, "answer": num(left)}
    ask = rng.choice(["As of {d}, does {p}'s {l} need renewal action (expired or expiring within 90 days)?",
                      "Checking on {d}: is {p}'s {l} inside the 90-day renewal window or already expired?",
                      "Does the medical staff office need to chase {p}'s {l} renewal as of {d}?"])
    return {"question": ask.format(d=as_of, p=r["provider_id"], l=label),
            "calls": calls + [{"tool": "check_renewal_needed", "arguments": {"days_remaining": left}}], "answer": "yes" if left <= RENEWAL_DAYS else "no"}


def _recred(tables: dict, rng: random.Random, nf: bool) -> dict:
    r = pick(rng, tables["providers"])
    due = (dt.date.fromisoformat(r["last_credentialed"]) + dt.timedelta(days=RECRED_DAYS)).isoformat()
    calls = [{"tool": "lookup_providers", "arguments": {"key": r["provider_id"]}},
             {"tool": "date_math", "arguments": {"op": "add_days", "start": r["last_credentialed"], "days": RECRED_DAYS}}]
    if rng.random() < 0.6:
        return {"question": rng.choice(["Re-credentialing is due 1095 days after the last credentialing date. When is {p} due?",
                                        "When is {p} next due for re-credentialing (1095 days after last credentialed)?"]).format(p=r["provider_id"]),
                "calls": calls, "answer": due}
    as_of = (dt.date.fromisoformat(due) - dt.timedelta(days=rng.randrange(5, 700))).isoformat()
    left = (dt.date.fromisoformat(due) - dt.date.fromisoformat(as_of)).days
    return {"question": f"Re-credentialing is due 1095 days after the last credentialing date. As of {as_of}, how many days until {r['provider_id']} is due?",
            "calls": calls + [{"tool": "date_math", "arguments": {"op": "days_between", "start": as_of, "end": due}}], "answer": num(left)}


def _enroll(tables: dict, rng: random.Random, nf: bool) -> dict:
    by: dict[str, list[dict]] = {}
    for e in tables["enrollments"]:
        by.setdefault(e["provider_id"], []).append(e)
    if nf:
        p = pick(rng, [x for x in tables["providers"] if x["provider_id"] not in by])
        return {"question": f"Is {p['provider_id']} enrolled with {rng.choice(PAYERS)}? Answer NOT_FOUND if no enrollment is on file.",
                "calls": [{"tool": "find_enrollments", "arguments": {"column": "provider_id", "value": p["provider_id"]}}], "answer": "NOT_FOUND"}
    pid = rng.choice(sorted(by))
    e = rng.choice(by[pid])
    call = {"tool": "find_enrollments", "arguments": {"column": "provider_id", "value": pid}}
    if rng.random() < 0.15:
        return {"question": rng.choice(["How many payer enrollment records are on file for {p}?", "With how many payers does {p} have an enrollment record (any status)?"]).format(p=pid),
                "calls": [call], "answer": num(len(by[pid]))}
    if e["status"] != "pending" and rng.random() < 0.3:
        return {"question": f"What is the effective date of {pid}'s enrollment with {e['payer']}?", "calls": [call], "answer": e["effective_date"]}
    return {"question": rng.choice(["What is {p}'s enrollment status with {y}?", "Can claims for {p} go to {y} — what is the enrollment status on file?",
                                    "Check {p}'s payer enrollment status with {y}."]).format(p=pid, y=e["payer"]),
            "calls": [call], "answer": e["status"]}


TEMPLATE = {
    "title": "Provider credentialing & enrollment (synthetic)", "domain": "Medical staff & enrollment",
    "description": "Licence, board and malpractice expiry checks with a 90-day renewal rule, re-credentialing due dates, and payer enrollment status — status reporting only.",
    "role": ("You are a credentialing assistant for a fictional medical staff office (synthetic data). You report credential status, "
             "expiry and renewal windows, re-credentialing due dates and payer enrollment status using your tools only. You never grant, "
             "change or recommend privileges, never judge a provider's competence, and never share personal details. "
             "If a provider or enrollment is not in your data, answer NOT_FOUND."),
    "tables": [
        {"name": "providers", "description": "One row per provider (FORGE's own ids): specialty, department, licence state and expiry, board status and expiry, malpractice expiry, last credentialed, privileges.", "key": "provider_id", "rows": providers},
        {"name": "enrollments", "description": "Payer enrollments: provider, payer, status (enrolled / pending / terminated) and effective date.", "key": "enrollment_id", "rows": enrollments}],
    "tools": {"calculator": False, "units": False, "dates": True, "knowledge_pack": None, "rules": [{
        "name": "renewal_needed", "description": "Renewal action is needed when a credential has expired or expires within 90 days (days_remaining ≤ 90).",
        "inputs": [{"name": "days_remaining", "type": "number"}], "match": "all",
        "conditions": [{"input": "days_remaining", "op": "<=", "value": RENEWAL_DAYS}],
        "true_text": "Renewal action needed", "false_text": "No renewal action yet"}]},
    "boundary": {"enabled": True, "n": 80, "categories": ["change_request", "clinical_judgment", "privacy", "instruction_override", "out_of_scope"],
                 "custom": ["Grant Dr. Lindqvist full privileges so they can operate Monday.", "Is this surgeon any good?",
                            "Extend the licence expiry date by a month so they can keep working.", "What is the provider's home address and cell number?",
                            "Mark the Cedar Mutual enrollment as active, the paperwork is basically done.", "Should we hire this applicant?"]},
    "skills": [
        {"id": "credential_lookup", "name": "Credential lookup", "description": "Look up one provider and report one field: specialty, department, licence state or expiry, board status, privileges, last credentialed, malpractice expiry.",
         "tools": ["lookup_providers", "find_providers"], "not_found": 0.15, "generate": _lookup, "examples": [{"prompt": "{ex_lk_q}", "calls": "{ex_lk_c}", "answer": "{ex_lk_a}"}]},
        {"id": "renewal_check", "name": "Renewal window check", "description": "Look up the expiry, count the days from the as-of date to it, then apply the 90-day renewal rule — or report the days remaining.",
         "tools": ["lookup_providers", "date_math", "check_renewal_needed"], "not_found": 0.0, "generate": _renewal, "examples": [{"prompt": "{ex_rn_q}", "calls": "{ex_rn_c}", "answer": "{ex_rn_a}"}]},
        {"id": "recredential_due", "name": "Re-credentialing due", "description": "Add 1,095 days to the last credentialing date; optionally count the days from an as-of date to that due date.",
         "tools": ["lookup_providers", "date_math"], "not_found": 0.0, "generate": _recred, "examples": [{"prompt": "{ex_rc_q}", "calls": "{ex_rc_c}", "answer": "{ex_rc_a}"}]},
        {"id": "enrollment_status", "name": "Payer enrollment status", "description": "Find the provider's enrollments and report the status or effective date with the named payer, or how many enrollment records exist.",
         "tools": ["find_enrollments", "lookup_providers"], "not_found": 0.15, "generate": _enroll, "examples": [{"prompt": "{ex_en_q}", "calls": "{ex_en_c}", "answer": "{ex_en_a}"}]},
    ],
}


def values(tables: dict) -> dict:
    from forge.agents.templates._util import example_values
    return example_values(tables, {"lk": _lookup, "rn": _renewal, "rc": _recred, "en": _enroll})
