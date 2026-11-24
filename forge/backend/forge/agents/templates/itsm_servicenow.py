"""ServiceNow-style ITSM routing and enrichment for a fictional health system's IT service desk (synthetic).

Routing: a keyword in the ticket → category, subcategory, assignment group. Priority: ServiceNow's default matrix,
priority = impact + urgency − 1 (impact/urgency: high = 1, medium = 2, low = 3). Enrichment: configuration item (CMDB) →
business service, support group, criticality, location. SLA: priority → resolution days → due date. Major incident: rule on
CI criticality and affected users. "ServiceNow" names the ticketing model only; no ServiceNow data or API is used.
"""
from __future__ import annotations

import random

from forge.agents.templates._util import date, num, pick

ID = "itsm_servicenow"

ROUTES = [  # keyword, category, subcategory, assignment group
    ("epic login", "Application", "EHR access", "EHR Support"), ("order set", "Application", "EHR build", "EHR Clinical Build"),
    ("barcode scanner", "Hardware", "Scanner", "Field Services"), ("label printer", "Hardware", "Printer", "Field Services"),
    ("pager", "Telecom", "Paging", "Telecom Services"), ("desk phone", "Telecom", "Voice", "Telecom Services"),
    ("teams meeting", "Collaboration", "Meetings", "Collaboration Services"), ("shared drive", "Storage", "File share", "Infrastructure Services"),
    ("monitor", "Hardware", "Display", "Field Services"), ("software install", "Software", "Request", "Desktop Engineering"),
    ("dictation", "Application", "Dictation", "Clinical Applications"), ("fax", "Telecom", "Fax", "Telecom Services"),
    ("workstation on wheels", "Hardware", "Mobile cart", "Field Services"), ("phishing email", "Security", "Suspicious email", "Security Operations"),
    ("data export", "Reporting", "Extract", "Analytics & BI"), ("dashboard", "Reporting", "Dashboard", "Analytics & BI"),
    ("vpn", "Network", "Remote access", "Network Operations"), ("wifi", "Network", "Wireless", "Network Operations"),
    ("network drop", "Network", "Wired", "Network Operations"), ("password reset", "Access", "Password", "Service Desk"),
    ("account locked", "Access", "Account", "Identity & Access"), ("mfa", "Access", "Multi-factor", "Identity & Access"),
    ("badge access", "Access", "Physical access", "Facilities Security"), ("printer", "Hardware", "Printer", "Field Services"),
    ("label printer", "Hardware", "Specimen labels", "Field Services"), ("laptop", "Hardware", "Laptop", "Field Services"),
    ("docking station", "Hardware", "Peripheral", "Field Services"), ("outlook", "Software", "Email", "Messaging"),
    ("teams", "Software", "Collaboration", "Collaboration Services"), ("sharepoint", "Software", "Collaboration", "Collaboration Services"),
    ("ehr login", "Clinical Applications", "EHR access", "Clinical Applications"),
    ("order set", "Clinical Applications", "EHR build", "Clinical Applications"),
    ("barcode scanner", "Clinical Applications", "Medication scanning", "Clinical Devices"),
    ("pacs viewer", "Clinical Applications", "Imaging", "Imaging Informatics"),
    ("lab interface", "Integration", "Interface", "Integration Engineering"), ("phishing", "Security", "Suspicious email", "Security Operations"),
    ("pager", "Telecom", "Paging", "Telecom Services"), ("desk phone", "Telecom", "Phone", "Telecom Services"),
    ("shared drive", "Infrastructure", "File share", "Server & Storage"), ("citrix", "Infrastructure", "Virtual desktop", "End User Computing"),
]
LEVELS = [("high", 1, "Widespread or patient-care impact"), ("medium", 2, "A department or a workflow is affected"),
          ("low", 3, "One user, workaround available")]
SLA = [("P1", 1, 1), ("P2", 2, 4), ("P3", 5, 8), ("P4", 10, 24), ("P5", 20, 72)]  # priority, resolution days, response hours
UNKNOWN = ["coffee machine", "parking validation", "cafeteria menu", "elevator music", "vending machine", "fitness room"]
SERVICES = [("EHR", "Clinical Applications"), ("PACS imaging", "Imaging Informatics"), ("Lab interfaces", "Integration Engineering"),
            ("Barcode medication administration", "Clinical Devices"), ("Remote access", "Network Operations"),
            ("Email", "Messaging"), ("Virtual desktop", "End User Computing"), ("File shares", "Server & Storage")]
CLASSES = {"EHR": "Application server", "PACS imaging": "Database", "Lab interfaces": "Interface engine",
           "Barcode medication administration": "Workstation", "Remote access": "Network device", "Email": "Application server",
           "Virtual desktop": "Application server", "File shares": "Storage"}
PREFIX = {"EHR": "EHR-APP", "PACS imaging": "PACS-DB", "Lab interfaces": "LABIF", "Barcode medication administration": "BCMA-WS",
          "Remote access": "VPN-GW", "Email": "MAIL", "Virtual desktop": "VDI", "File shares": "NAS"}
SITES = ["North Campus", "Riverside", "Downtown Tower", "East Clinic", "Data Center A"]


def routes() -> list[dict]:
    return [{"keyword": k, "category": c, "subcategory": s, "assignment_group": g} for k, c, s, g in ROUTES]


def levels() -> list[dict]:
    return [{"level": a, "value": v, "meaning": m} for a, v, m in LEVELS]


def sla() -> list[dict]:
    return [{"priority": p, "resolution_days": d, "response_hours": h} for p, d, h in SLA]


def cmdb() -> list[dict]:
    rng = random.Random("cmdb:7")
    rows, seen = [], set()
    while len(rows) < 32:
        svc, grp = rng.choice(SERVICES)
        name = f"{PREFIX[svc]}-{rng.randrange(4, 99):02d}"
        if name in seen:
            continue
        seen.add(name)
        crit = {"EHR": 1, "Barcode medication administration": 1, "PACS imaging": 1, "Lab interfaces": 2}.get(svc, rng.choice([2, 3]))
        rows.append({"ci_name": name, "ci_class": CLASSES[svc], "business_service": svc, "support_group": grp,
                     "criticality": crit, "location": rng.choice(SITES)})
    return sorted(rows, key=lambda r: r["ci_name"])


PHRASES = ["User reports the {kw} is not working since this morning", "Cannot get {kw} working on 4 West",
           "{kw} problem in the emergency department", "Help: {kw} issue at the registration desk", "Night shift says {kw} keeps failing"]


def _route(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        kw = rng.choice(UNKNOWN)
        return {"question": f"New ticket: \"{rng.choice(PHRASES).format(kw=kw)}\". Which assignment group should it go to?",
                "calls": [{"tool": "lookup_routing", "arguments": {"key": kw}}], "answer": "NOT_FOUND"}
    r = pick(rng, tables["routing"])
    field, ask = rng.choice([("assignment_group", "Which assignment group should it go to?"), ("category", "Which category should it get?"),
                             ("subcategory", "Which subcategory fits?")])
    return {"question": f"New ticket: \"{rng.choice(PHRASES).format(kw=r['keyword'])}\". {ask}",
            "calls": [{"tool": "lookup_routing", "arguments": {"key": r["keyword"]}}], "answer": r[field]}


def _priority(tables: dict, rng: random.Random, nf: bool) -> dict:
    lv = {r["level"]: r["value"] for r in tables["impact_urgency"]}
    i, u = rng.choice(list(lv)), rng.choice(list(lv))
    form = rng.choice(["An incident has {i} impact and {u} urgency. What priority should it get?",
                       "Impact is {i}, urgency is {u}. Which priority applies?", "Set the priority: impact {i}, urgency {u}.",
                       "The caller rates urgency {u}; the service owner rates impact {i}. What is the incident priority?"])
    return {"question": form.format(i=i, u=u),
            "calls": [{"tool": "lookup_impact_urgency", "arguments": {"key": i}}, {"tool": "lookup_impact_urgency", "arguments": {"key": u}},
                      {"tool": "calculate", "arguments": {"expression": f"{lv[i]} + {lv[u]} - 1"}}],
            "answer": num(lv[i] + lv[u] - 1)}


def _ci(tables: dict, rng: random.Random, nf: bool) -> dict:
    r = pick(rng, tables["cmdb_ci"])
    field, ask = rng.choice([("business_service", "Which business service does it belong to?"), ("support_group", "Which support group owns it?"),
                             ("location", "Where is it located?"), ("ci_class", "What class of CI is it?")])
    return {"question": f"The ticket references configuration item {r['ci_name']}. {ask}",
            "calls": [{"tool": "lookup_cmdb_ci", "arguments": {"key": r["ci_name"]}}], "answer": r[field]}


def _sla(tables: dict, rng: random.Random, nf: bool) -> dict:
    r = pick(rng, tables["sla"])
    d = date(rng)
    import datetime as dt
    due = (dt.date.fromisoformat(d) + dt.timedelta(days=r["resolution_days"])).isoformat()
    return {"question": f"A {r['priority']} incident was opened on {d}. By what date must it be resolved?",
            "calls": [{"tool": "lookup_sla", "arguments": {"key": r["priority"]}},
                      {"tool": "date_math", "arguments": {"op": "add_days", "start": d, "days": r["resolution_days"]}}], "answer": due}


def _major(tables: dict, rng: random.Random, nf: bool) -> dict:
    # Balanced (≈ half "yes"): yes needs a criticality-1 CI AND ≥ 50 users; "no" cases mix low criticality and few users.
    crit1 = [x for x in tables["cmdb_ci"] if x["criticality"] == 1]
    if rng.random() < 0.5 and crit1:
        r, n = pick(rng, crit1), rng.randrange(50, 600)
    elif rng.random() < 0.5 and crit1:
        r, n = pick(rng, crit1), rng.randrange(2, 50)
    else:
        r, n = pick(rng, [x for x in tables["cmdb_ci"] if x["criticality"] != 1]), rng.randrange(2, 600)
    yes = r["criticality"] == 1 and n >= 50
    return {"question": f"{n} users report problems with {r['ci_name']}. Should this be declared a major incident?",
            "calls": [{"tool": "lookup_cmdb_ci", "arguments": {"key": r["ci_name"]}},
                      {"tool": "check_major_incident", "arguments": {"criticality": r["criticality"], "affected_users": n}}],
            "answer": "yes" if yes else "no"}


TEMPLATE = {
    "title": "IT service desk — ServiceNow-style routing & enrichment (synthetic)",
    "domain": "IT, integration & security",
    "description": "Route tickets to the right group, set priority from impact × urgency, enrich with CMDB data, compute SLA due dates, flag major incidents.",
    "role": ("You are an IT service-desk triage assistant for a fictional health system (synthetic data). For each ticket you route it to "
             "the right assignment group, set its priority from impact and urgency, enrich it from the CMDB, and compute SLA dates — "
             "using your tools only. If a ticket mentions nothing your routing table knows, answer NOT_FOUND."),
    "tables": [
        {"name": "routing", "description": "Ticket keyword → category, subcategory, assignment group.", "key": "keyword", "rows": routes},
        {"name": "impact_urgency", "description": "Impact / urgency levels and their numeric values.", "key": "level", "rows": levels},
        {"name": "cmdb_ci", "description": "Configuration items (CMDB extract).", "key": "ci_name", "rows": cmdb},
        {"name": "sla", "description": "Resolution and response targets by priority.", "key": "priority", "rows": sla},
    ],
    "tools": {"calculator": True, "units": False, "dates": True, "knowledge_pack": None, "rules": [{
        "name": "major_incident", "description": "Major-incident criteria: the CI is criticality 1 and at least 50 users are affected.",
        "inputs": [{"name": "criticality", "type": "number"}, {"name": "affected_users", "type": "number"}], "match": "all",
        "conditions": [{"input": "criticality", "op": "==", "value": 1}, {"input": "affected_users", "op": ">=", "value": 50}],
        "true_text": "Declare a major incident", "false_text": "Handle as a standard incident"}]},
    "skills": [
        {"id": "route_ticket", "name": "Route the ticket", "description": "Find the keyword in the ticket and return its assignment group, category, or subcategory; NOT_FOUND if no keyword matches.",
         "tools": ["lookup_routing", "find_routing"], "not_found": 0.15, "generate": _route, "examples": [
             {"prompt": "New ticket: \"User reports the {kw0} is not working since this morning\". Which assignment group should it go to?",
              "answer": "{grp0}", "calls": [{"tool": "lookup_routing", "arguments": {"key": "{kw0}"}}]}]},
        {"id": "set_priority", "name": "Set priority", "description": "Priority = impact value + urgency value − 1, after looking both levels up.",
         "tools": ["lookup_impact_urgency", "calculate"], "not_found": 0.0, "generate": _priority, "examples": [
             {"prompt": "An incident has high impact and medium urgency. What priority should it get?", "answer": "2",
              "calls": [{"tool": "lookup_impact_urgency", "arguments": {"key": "high"}}, {"tool": "lookup_impact_urgency", "arguments": {"key": "medium"}},
                        {"tool": "calculate", "arguments": {"expression": "1 + 2 - 1"}}]}]},
        {"id": "enrich_ci", "name": "Enrich from the CMDB", "description": "Look up the configuration item named in the ticket and return its business service, support group, location or class.",
         "tools": ["lookup_cmdb_ci", "find_cmdb_ci"], "not_found": 0.0, "generate": _ci, "examples": [
             {"prompt": "The ticket references configuration item {ci0}. Which business service does it belong to?", "answer": "{svc0}",
              "calls": [{"tool": "lookup_cmdb_ci", "arguments": {"key": "{ci0}"}}]}]},
        {"id": "sla_due", "name": "SLA due date", "description": "Look up the priority's resolution days and add them to the opened date.",
         "tools": ["lookup_sla", "date_math"], "not_found": 0.0, "generate": _sla, "examples": []},
        {"id": "major_incident", "name": "Major-incident check", "description": "Look up the CI's criticality, then apply the major-incident rule with the number of affected users.",
         "tools": ["lookup_cmdb_ci", "check_major_incident"], "not_found": 0.0, "generate": _major, "examples": []},
    ],
}


def values(tables: dict) -> dict:
    r, c = tables["routing"][0], tables["cmdb_ci"][0]
    return {"kw0": r["keyword"], "grp0": r["assignment_group"], "ci0": c["ci_name"], "svc0": c["business_service"]}
