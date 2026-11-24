"""Defensive security alert triage for a fictional health system (synthetic).

Detection rules → MITRE ATT&CK technique (public IDs and names, © The MITRE Corporation, used for reference) → tactic;
assets → owner team, environment, criticality; escalation rule on severity and asset criticality; remediation due dates for
synthetic vulnerability advisories (VULN-…, not real CVEs). Classification and routing only — no offensive content.
"""
from __future__ import annotations

import datetime as dt
import random

from forge.agents.templates._util import date, pick

ID = "security_triage"

TECHNIQUES = [("T1110", "Brute Force", "Credential Access"), ("T1566", "Phishing", "Initial Access"),
              ("T1059", "Command and Scripting Interpreter", "Execution"), ("T1078", "Valid Accounts", "Defense Evasion"),
              ("T1486", "Data Encrypted for Impact", "Impact"), ("T1048", "Exfiltration Over Alternative Protocol", "Exfiltration"),
              ("T1021", "Remote Services", "Lateral Movement"), ("T1053", "Scheduled Task/Job", "Persistence"),
              ("T1190", "Exploit Public-Facing Application", "Initial Access"), ("T1003", "OS Credential Dumping", "Credential Access"),
              ("T1071", "Application Layer Protocol", "Command and Control"), ("T1562", "Impair Defenses", "Defense Evasion")]
TEAMS = ["Clinical Applications", "Identity & Access", "Network Operations", "Server & Storage", "End User Computing", "Imaging Informatics"]
PREFIX = ["ehr-app", "pacs", "dc", "vpn-gw", "ws-icu", "ws-reg", "lab-if", "mail", "web-portal", "fs"]


def techniques() -> list[dict]:
    return [{"technique_id": t, "name": n, "tactic": ta} for t, n, ta in TECHNIQUES]


def detections() -> list[dict]:
    rng = random.Random("det:4")
    rows = []
    for i in range(60):
        t = rng.choice(TECHNIQUES)
        rows.append({"rule_id": f"DR-{1040 + i * 7}", "title": f"{t[1]} indicator #{i + 4}", "technique_id": t[0],
                     "severity": rng.choice([1, 2, 2, 3, 3, 4]), "queue": rng.choice(["SOC Tier 1", "SOC Tier 2", "Threat Hunting"])})
    return rows


def assets() -> list[dict]:
    rng = random.Random("assets:9")
    rows, seen = [], set()
    while len(rows) < 30:
        h = f"{rng.choice(PREFIX)}-{rng.randrange(4, 89):02d}"
        if h in seen:
            continue
        seen.add(h)
        rows.append({"hostname": h, "owner_team": rng.choice(TEAMS), "environment": rng.choice(["production", "production", "test"]),
                     "criticality": 1 if h.startswith(("ehr", "pacs", "dc")) else rng.choice([2, 3])})
    return sorted(rows, key=lambda r: r["hostname"])


def advisories() -> list[dict]:
    rng = random.Random("vuln:2")
    out = []
    for i in range(48):
        sev = rng.choice(["critical", "high", "medium", "low"])
        out.append({"advisory_id": f"VULN-2025-{1100 + i * 13}", "component": rng.choice(["web server", "VPN appliance", "database driver",
                    "imaging gateway", "identity provider", "file transfer tool"]), "severity": sev,
                    "remediation_days": {"critical": 7, "high": 15, "medium": 45, "low": 90}[sev]})
    return out


def _technique(tables: dict, rng: random.Random, nf: bool) -> dict:
    d = pick(rng, tables["detections"])
    t = next(x for x in tables["techniques"] if x["technique_id"] == d["technique_id"])
    field, ask = rng.choice([("name", "Which ATT&CK technique does it indicate?"), ("tactic", "Which ATT&CK tactic does it fall under?")])
    return {"question": f"Alert from detection rule {d['rule_id']} fired. {ask}",
            "calls": [{"tool": "lookup_detections", "arguments": {"key": d["rule_id"]}},
                      {"tool": "lookup_techniques", "arguments": {"key": d["technique_id"]}}], "answer": t[field]}


def _owner(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        h = f"unknown-host-{rng.randrange(100, 999)}"
        return {"question": f"An alert names host {h}. Which team owns it?", "calls": [{"tool": "lookup_assets", "arguments": {"key": h}}], "answer": "NOT_FOUND"}
    a = pick(rng, tables["assets"])
    field, ask = rng.choice([("owner_team", "Which team owns it?"), ("environment", "Which environment does it run in?")])
    return {"question": f"An alert names host {a['hostname']}. {ask}", "calls": [{"tool": "lookup_assets", "arguments": {"key": a["hostname"]}}],
            "answer": a[field]}


def _escalate(tables: dict, rng: random.Random, nf: bool) -> dict:
    # Balanced (≈ half "yes"): escalate when severity ≥ 4 or the asset is criticality 1.
    want = rng.random() < 0.5
    for _ in range(200):
        d, a = pick(rng, tables["detections"]), pick(rng, tables["assets"])
        yes = d["severity"] >= 4 or a["criticality"] == 1
        if yes == want:
            break
    return {"question": f"Detection rule {d['rule_id']} fired on host {a['hostname']}. Should it be escalated to the incident response team?",
            "calls": [{"tool": "lookup_detections", "arguments": {"key": d["rule_id"]}}, {"tool": "lookup_assets", "arguments": {"key": a["hostname"]}},
                      {"tool": "check_escalate", "arguments": {"severity": d["severity"], "asset_criticality": a["criticality"]}}],
            "answer": "yes" if yes else "no"}


def _patch(tables: dict, rng: random.Random, nf: bool) -> dict:
    v = pick(rng, tables["advisories"])
    d = date(rng)
    return {"question": f"Advisory {v['advisory_id']} was published on {d}. By what date must it be remediated?",
            "calls": [{"tool": "lookup_advisories", "arguments": {"key": v["advisory_id"]}},
                      {"tool": "date_math", "arguments": {"op": "add_days", "start": d, "days": v["remediation_days"]}}],
            "answer": (dt.date.fromisoformat(d) + dt.timedelta(days=v["remediation_days"])).isoformat()}


TEMPLATE = {
    "title": "Security alert triage (synthetic, defensive)", "domain": "IT, integration & security",
    "description": "Map detections to MITRE ATT&CK techniques and tactics, find asset owners, decide escalation, compute remediation deadlines.",
    "role": ("You are a security-operations triage assistant for a fictional health system (synthetic data). You classify alerts, "
             "identify asset owners, decide escalation by policy, and compute remediation deadlines — using your tools only. You do not "
             "provide attack instructions. If a host or rule is not in your data, answer NOT_FOUND."),
    "tables": [
        {"name": "detections", "description": "Detection rule → ATT&CK technique, severity (1–4), queue.", "key": "rule_id", "rows": detections},
        {"name": "techniques", "description": "MITRE ATT&CK technique → name, tactic.", "key": "technique_id", "rows": techniques},
        {"name": "assets", "description": "Host → owner team, environment, criticality (1 = most critical).", "key": "hostname", "rows": assets},
        {"name": "advisories", "description": "Synthetic vulnerability advisories → component, severity, remediation days.", "key": "advisory_id", "rows": advisories},
    ],
    "tools": {"calculator": True, "units": False, "dates": True, "knowledge_pack": None, "rules": [{
        "name": "escalate", "description": "Escalate to incident response when the detection severity is 4, or the asset is criticality 1.",
        "inputs": [{"name": "severity", "type": "number"}, {"name": "asset_criticality", "type": "number"}], "match": "any",
        "conditions": [{"input": "severity", "op": ">=", "value": 4}, {"input": "asset_criticality", "op": "==", "value": 1}],
        "true_text": "Escalate to incident response", "false_text": "Handle in the SOC queue"}]},
    "skills": [
        {"id": "map_technique", "name": "Map to ATT&CK", "description": "Look up the detection rule's technique, then the technique's name or tactic.",
         "tools": ["lookup_detections", "lookup_techniques"], "not_found": 0.0, "generate": _technique, "examples": []},
        {"id": "asset_owner", "name": "Asset owner", "description": "Look up the host named in the alert; NOT_FOUND for unknown hosts.",
         "tools": ["lookup_assets", "find_assets"], "not_found": 0.15, "generate": _owner, "examples": []},
        {"id": "escalation", "name": "Escalation decision", "description": "Look up the rule's severity and the asset's criticality, then apply the escalation rule.",
         "tools": ["lookup_detections", "lookup_assets", "check_escalate"], "not_found": 0.0, "generate": _escalate, "examples": []},
        {"id": "remediation_due", "name": "Remediation deadline", "description": "Look up the advisory's remediation days and add them to the publication date.",
         "tools": ["lookup_advisories", "date_math"], "not_found": 0.0, "generate": _patch, "examples": []},
    ],
}


def values(tables: dict) -> dict:
    return {}
