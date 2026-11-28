"""HL7 v2 interface troubleshooting for a fictional health system's integration team (synthetic).

Reference tables use public HL7 v2 elements — acknowledgement codes (table 0008), message error condition codes (table 0357),
common segment fields and trigger events — with FORGE's own short descriptions; "usage" is as profiled in this fictional
interface specification, not a statement of the standard. Interface-engine errors (IE-xx), interfaces, systems, ports,
teams, thresholds and fixes are invented. No message content and no patient values appear anywhere.

The agent explains errors and ACKs, finds fields and event types, reports who owns an interface and how it connects, and does
queue arithmetic plus an escalation rule. It never resends, replays, edits or deletes messages, never changes interface
settings, and never reads out patient data from a message — those are hand-back (boundary) cases.

Fictional escalation rule: page the on-call owner when the queue depth reaches the interface's alert threshold, or the
interface has been down 30 minutes or more.
"""
from __future__ import annotations

import random

from forge.agents.templates._util import num, pick

ID = "hl7_interfaces"

ERRORS = [  # code, category, meaning, likely cause, next action, team
    ("AA", "ACK code", "Application accept", "Message processed successfully", "No action", "None"),
    ("AE", "ACK code", "Application error", "Receiver found a problem in the message content", "Read the ERR segment and fix the source data, then resend", "Interface Analysts"),
    ("AR", "ACK code", "Application reject", "Receiver refused the message (type, version, processing id or system problem)", "Check MSH-9, MSH-11 and MSH-12 against the receiver's spec", "Interface Analysts"),
    ("CA", "ACK code", "Commit accept", "Enhanced-mode receipt: message stored", "No action", "None"),
    ("CE", "ACK code", "Commit error", "Enhanced-mode receipt: message could not be stored", "Check the receiver's storage and resend", "Integration Engineering"),
    ("CR", "ACK code", "Commit reject", "Enhanced-mode receipt: message refused before storage", "Check the header fields and resend", "Interface Analysts"),
    ("0", "Error condition", "Message accepted", "No error", "No action", "None"),
    ("100", "Error condition", "Segment sequence error", "Segments out of order or a required segment missing", "Compare segment order with the message structure", "Interface Analysts"),
    ("101", "Error condition", "Required field missing", "A field the receiver requires is empty", "Find the empty field in ERR-2 and fix the source mapping", "Interface Analysts"),
    ("102", "Error condition", "Data type error", "A value does not match the field's data type", "Check the field format (dates, numbers, coded values)", "Interface Analysts"),
    ("103", "Error condition", "Table value not found", "A coded value is not in the receiver's table", "Add or map the code in the translation table", "Application Analysts"),
    ("104", "Error condition", "Value too long", "A value exceeds the receiver's maximum length", "Truncate or remap in the outbound transform", "Interface Analysts"),
    ("200", "Error condition", "Unsupported message type", "The receiver does not accept this message type", "Confirm routing: this message should not go to this receiver", "Integration Engineering"),
    ("201", "Error condition", "Unsupported event code", "The receiver does not accept this trigger event", "Filter the event out or request support from the receiver", "Integration Engineering"),
    ("202", "Error condition", "Unsupported processing id", "MSH-11 is not what the receiver expects (e.g. test vs production)", "Set the correct processing id for the environment", "Integration Engineering"),
    ("203", "Error condition", "Unsupported version id", "MSH-12 version is not accepted", "Align the version with the receiver's spec", "Integration Engineering"),
    ("204", "Error condition", "Unknown key identifier", "The record the message refers to does not exist at the receiver", "Check whether the create message was sent first", "Application Analysts"),
    ("205", "Error condition", "Duplicate key identifier", "The record already exists at the receiver", "Check for a duplicate send; do not resend blindly", "Application Analysts"),
    ("206", "Error condition", "Application record locked", "The receiver's record was in use", "Retry after the lock clears", "Application Analysts"),
    ("207", "Error condition", "Application internal error", "Unexpected error inside the receiving application", "Open a ticket with the receiving application's team", "Application Analysts"),
    ("IE-01", "Engine error", "Connection refused", "Destination host or port not listening", "Check the destination service and port, then restart the connection", "Integration Engineering"),
    ("IE-02", "Engine error", "TLS handshake failed", "Certificate or protocol mismatch", "Check certificate validity and TLS versions on both ends", "Integration Engineering"),
    ("IE-03", "Engine error", "MLLP framing error", "Missing start or end block characters", "Check the sender's MLLP wrapper settings", "Integration Engineering"),
    ("IE-04", "Engine error", "ACK timeout", "No acknowledgement within the timeout", "Check the receiver's health; messages queue until it responds", "Integration Engineering"),
    ("IE-05", "Engine error", "Queue full", "Outbound queue reached its limit", "Escalate to the on-call owner; find why the destination is not consuming", "Integration Engineering"),
    ("IE-06", "Engine error", "Message too large", "Message exceeds the configured size limit", "Check for embedded documents; route to the document channel", "Interface Analysts"),
    ("IE-07", "Engine error", "Character encoding error", "Unexpected characters for the declared encoding", "Check MSH-18 and the source system's encoding", "Interface Analysts"),
    ("IE-08", "Engine error", "No route matched", "No filter or route accepted the message", "Review routing filters for this message type", "Interface Analysts"),
    ("IE-09", "Engine error", "Transform script error", "The mapping script failed on this message", "Read the transform log and fix the script in test first", "Interface Analysts"),
    ("IE-10", "Engine error", "Duplicate control id", "MSH-10 repeated within the duplicate window", "Check the sender for resends before releasing", "Interface Analysts"),
    ("IE-11", "Engine error", "Destination disabled", "The destination connection is turned off", "Confirm the change window before re-enabling", "Integration Engineering"),
    ("IE-12", "Engine error", "Certificate expired", "The connection certificate is past its end date", "Renew and install the certificate", "Integration Engineering"),
    ("IE-13", "Engine error", "Retry limit reached", "Delivery retries exhausted", "Fix the cause, then release the held messages with approval", "Integration Engineering"),
]
FIELDS = [  # id, name, data type, usage in this spec
    ("MSH-3", "Sending Application", "HD", "O"), ("MSH-4", "Sending Facility", "HD", "O"), ("MSH-5", "Receiving Application", "HD", "O"),
    ("MSH-6", "Receiving Facility", "HD", "O"), ("MSH-7", "Date/Time of Message", "DTM", "R"), ("MSH-9", "Message Type", "MSG", "R"),
    ("MSH-10", "Message Control ID", "ST", "R"), ("MSH-11", "Processing ID", "PT", "R"), ("MSH-12", "Version ID", "VID", "R"),
    ("MSH-18", "Character Set", "ID", "O"), ("EVN-1", "Event Type Code", "ID", "O"), ("EVN-2", "Recorded Date/Time", "DTM", "R"),
    ("PID-3", "Patient Identifier List", "CX", "R"), ("PID-5", "Patient Name", "XPN", "R"), ("PID-7", "Date/Time of Birth", "DTM", "O"),
    ("PID-8", "Administrative Sex", "CWE", "O"), ("PID-11", "Patient Address", "XAD", "O"), ("PID-18", "Patient Account Number", "CX", "O"),
    ("PV1-2", "Patient Class", "CWE", "R"), ("PV1-3", "Assigned Patient Location", "PL", "O"), ("PV1-7", "Attending Doctor", "XCN", "O"),
    ("PV1-10", "Hospital Service", "CWE", "O"), ("PV1-19", "Visit Number", "CX", "O"), ("PV1-44", "Admit Date/Time", "DTM", "O"),
    ("PV1-45", "Discharge Date/Time", "DTM", "O"), ("ORC-1", "Order Control", "ID", "R"), ("ORC-2", "Placer Order Number", "EI", "C"),
    ("ORC-3", "Filler Order Number", "EI", "C"), ("ORC-12", "Ordering Provider", "XCN", "O"), ("OBR-4", "Universal Service Identifier", "CWE", "R"),
    ("OBR-7", "Observation Date/Time", "DTM", "C"), ("OBR-25", "Result Status", "ID", "C"), ("OBX-2", "Value Type", "ID", "C"),
    ("OBX-3", "Observation Identifier", "CWE", "R"), ("OBX-5", "Observation Value", "varies", "C"), ("OBX-6", "Units", "CWE", "O"),
    ("OBX-8", "Interpretation Codes", "CWE", "O"), ("OBX-11", "Observation Result Status", "ID", "R"), ("MSA-1", "Acknowledgment Code", "ID", "R"),
    ("MSA-2", "Message Control ID (acknowledged)", "ST", "R"), ("ERR-2", "Error Location", "ERL", "O"), ("ERR-3", "HL7 Error Code", "CWE", "R"),
    ("ERR-4", "Severity", "ID", "R"),
]
EVENTS = [  # event, description, structure
    ("ADT^A01", "Admit / visit notification", "ADT_A01"), ("ADT^A02", "Transfer a patient", "ADT_A02"), ("ADT^A03", "Discharge / end visit", "ADT_A03"),
    ("ADT^A04", "Register a patient (outpatient)", "ADT_A01"), ("ADT^A05", "Pre-admit a patient", "ADT_A05"), ("ADT^A06", "Change outpatient to inpatient", "ADT_A06"),
    ("ADT^A07", "Change inpatient to outpatient", "ADT_A06"), ("ADT^A08", "Update patient information", "ADT_A01"), ("ADT^A11", "Cancel admit / visit", "ADT_A09"),
    ("ADT^A13", "Cancel discharge", "ADT_A01"), ("ADT^A28", "Add person information", "ADT_A05"), ("ADT^A31", "Update person information", "ADT_A05"),
    ("ADT^A40", "Merge patient identifier list", "ADT_A39"), ("ORM^O01", "General order message", "ORM_O01"), ("OML^O21", "Laboratory order", "OML_O21"),
    ("ORU^R01", "Unsolicited observation result", "ORU_R01"), ("SIU^S12", "New appointment booking", "SIU_S12"), ("SIU^S14", "Appointment modification", "SIU_S12"),
    ("SIU^S15", "Appointment cancellation", "SIU_S12"), ("MDM^T02", "Original document with content", "MDM_T02"), ("DFT^P03", "Post detail financial transaction", "DFT_P03"),
    ("VXU^V04", "Unsolicited vaccination record update", "VXU_V04"), ("ACK", "General acknowledgment", "ACK"),
]
SYSTEMS = ["EHR (Evergreen)", "Lab (Quartz LIS)", "Radiology (Halo RIS)", "Pharmacy (Rx Hub)", "Billing (Ledger)", "Scheduling (SlotWise)",
           "Document imaging (Archivo)", "Immunization registry (state)", "Cardiology (PulseView)", "Transcription (ScribeLine)"]
TEAMS = ["Integration Engineering", "Interface Analysts", "Lab Systems", "Revenue Cycle Systems", "Clinical Applications"]


def errors() -> list[dict]:
    return [{"error_code": c, "category": cat, "meaning": m, "likely_cause": cause, "next_action": act, "team": team} for c, cat, m, cause, act, team in ERRORS]


def fields() -> list[dict]:
    return [{"field_id": f, "segment": f.split("-")[0], "field_name": n, "data_type": t, "usage_in_spec": {"R": "required", "O": "optional", "C": "conditional"}[u]}
            for f, n, t, u in FIELDS]


def events() -> list[dict]:
    return [{"event": e, "description": d, "message_structure": s} for e, d, s in EVENTS]


def interfaces() -> list[dict]:
    rng = random.Random("hl7:ifaces:v1")
    flows = [("ADT^A01", 0, 1), ("ADT^A08", 0, 1), ("ADT^A03", 0, 4), ("ORM^O01", 0, 2), ("OML^O21", 0, 1), ("ORU^R01", 1, 0), ("ORU^R01", 2, 0),
             ("ORU^R01", 8, 0), ("SIU^S12", 5, 0), ("SIU^S15", 5, 0), ("DFT^P03", 0, 4), ("DFT^P03", 1, 4), ("MDM^T02", 9, 0), ("MDM^T02", 0, 6),
             ("VXU^V04", 0, 7), ("ADT^A40", 0, 1), ("ADT^A40", 0, 2), ("ORM^O01", 0, 3), ("ORU^R01", 3, 0), ("ADT^A08", 0, 3), ("SIU^S14", 5, 0),
             ("ADT^A04", 0, 5), ("ORM^O01", 0, 8), ("DFT^P03", 2, 4)]
    rows = []
    for i, (mt, s, d) in enumerate(flows):
        src, dst = SYSTEMS[s], SYSTEMS[d]
        rows.append({"interface_id": f"IF-{101 + i}", "name": f"{mt} {src.split(' (')[0]} to {dst.split(' (')[0]}", "message_type": mt,
                     "source": src, "destination": dst, "direction": "outbound" if s == 0 else "inbound",
                     "protocol": rng.choice(["MLLP", "MLLP", "MLLP", "SFTP batch", "HTTPS"]), "port": 6600 + i * 7,
                     "owner_team": rng.choice(TEAMS), "retry_minutes": rng.choice([1, 2, 5, 10]),
                     "alert_queue_depth": rng.choice([200, 500, 1000, 2000]), "messages_per_minute": rng.choice([20, 40, 60, 80, 120, 200])})
    return rows


def _errors(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        c = rng.choice(["IE-" + str(rng.randrange(40, 99)), str(rng.randrange(300, 399)), "AX", "CQ"])
        return {"question": f"The interface engine log shows error code {c}. What does it mean?", "calls": [{"tool": "lookup_errors", "arguments": {"key": c}}], "answer": "NOT_FOUND"}
    r = pick(rng, tables["errors"])
    what = f"error code {r['error_code']}" if r["category"] != "ACK code" else f"an ACK with MSA-1 = {r['error_code']}"
    field, ask = rng.choice([("meaning", "What does {w} mean?"), ("likely_cause", "What is the likely cause of {w}?"),
                             ("next_action", "An interface returned {w}. What is the recommended next step?"), ("team", "Which team handles {w}?")])
    return {"question": ask.format(w=what), "calls": [{"tool": "lookup_errors", "arguments": {"key": r["error_code"]}}], "answer": str(r[field])}


def _fields(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        f = f"{rng.choice(['ZPV', 'ZXA', 'QRX'])}-{rng.randrange(1, 40)}"
        return {"question": f"What data type is {f} in our interface spec?", "calls": [{"tool": "lookup_fields", "arguments": {"key": f}}], "answer": "NOT_FOUND"}
    r = pick(rng, tables["fields"])
    if rng.random() < 0.35:
        return {"question": rng.choice(["Which field carries the {n}?", "Where in the message is the {n} — which segment field?"]).format(n=r["field_name"]),
                "calls": [{"tool": "find_fields", "arguments": {"column": "field_name", "value": r["field_name"]}}], "answer": r["field_id"]}
    field, ask = rng.choice([("field_name", "What is {f}?"), ("data_type", "What data type is {f}?"),
                             ("usage_in_spec", "What usage does our interface spec give {f}?")])
    return {"question": ask.format(f=r["field_id"]), "calls": [{"tool": "lookup_fields", "arguments": {"key": r["field_id"]}}], "answer": str(r[field])}


def _events(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        e = rng.choice(["ADT^A99", "ORU^R77", "SIU^S99", "XYZ^Q01"])
        return {"question": f"What trigger event is {e}?", "calls": [{"tool": "lookup_events", "arguments": {"key": e}}], "answer": "NOT_FOUND"}
    r = pick(rng, tables["events"])
    if rng.random() < 0.35:
        return {"question": rng.choice(["Which trigger event is used for '{d}'?", "What message type and event should carry a '{d}' message?",
                                        "Our spec needs a message for '{d}'. Which event code is that?"]).format(d=r["description"]),
                "calls": [{"tool": "find_events", "arguments": {"column": "description", "value": r["description"]}}], "answer": r["event"]}
    if rng.random() < 0.3:
        return {"question": f"Which message structure does {r['event']} use?", "calls": [{"tool": "lookup_events", "arguments": {"key": r["event"]}}], "answer": r["message_structure"]}
    return {"question": rng.choice(["What does a {e} message represent?", "An interface is sending {e}. What event is that?",
                                    "The error log names {e}. What happened that triggered it?", "In plain words, what is a {e}?"]).format(e=r["event"]),
            "calls": [{"tool": "lookup_events", "arguments": {"key": r["event"]}}], "answer": r["description"]}


def _iface(tables: dict, rng: random.Random, nf: bool) -> dict:
    if nf:
        c = f"IF-{rng.randrange(400, 999)}"
        return {"question": f"Which team owns interface {c}?", "calls": [{"tool": "lookup_interfaces", "arguments": {"key": c}}], "answer": "NOT_FOUND"}
    r = pick(rng, tables["interfaces"])
    field, ask = rng.choice([("owner_team", "Which team owns interface {i}?"), ("port", "Which port does {i} connect on?"), ("protocol", "What protocol does {i} use?"),
                             ("destination", "Where does {i} send its messages?"), ("message_type", "What message type does {i} carry?"),
                             ("retry_minutes", "How many minutes does {i} wait between delivery retries?"), ("alert_queue_depth", "At what queue depth does {i} alert?")])
    return {"question": ask.format(i=r["interface_id"]), "calls": [{"tool": "lookup_interfaces", "arguments": {"key": r["interface_id"]}}], "answer": str(r[field])}


def _queue(tables: dict, rng: random.Random, nf: bool) -> dict:
    r = pick(rng, tables["interfaces"])
    call = {"tool": "lookup_interfaces", "arguments": {"key": r["interface_id"]}}
    if rng.random() < 0.35:
        k = rng.randrange(2, 60)
        q = k * r["messages_per_minute"]
        return {"question": f"{r['interface_id']} has {q} messages queued. At its normal throughput, how many minutes will it take to clear once the destination is back?",
                "calls": [call, {"tool": "calculate", "arguments": {"expression": f"{q} / {r['messages_per_minute']}"}}], "answer": num(k)}
    want = rng.random() < 0.5
    thr = r["alert_queue_depth"]
    if want and rng.random() < 0.5:
        q, mins = thr + rng.randrange(0, thr), rng.randrange(1, 30)
    elif want:
        q, mins = rng.randrange(1, thr), rng.randrange(30, 180)
    else:
        q, mins = rng.randrange(1, thr), rng.randrange(1, 30)
    over = q - thr
    return {"question": rng.choice(["{i} has {q} messages queued and has been down {m} minutes. Should the on-call owner be paged under the escalation rule?",
                                    "Escalation check: {i} is down {m} minutes with a queue of {q}. Page on-call?"]).format(i=r["interface_id"], q=q, m=mins),
            "calls": [call, {"tool": "calculate", "arguments": {"expression": f"{q} - {thr}"}},
                      {"tool": "check_escalation", "arguments": {"over_threshold": over, "minutes_down": mins}}],
            "answer": "yes" if over >= 0 or mins >= 30 else "no"}


TEMPLATE = {
    "title": "HL7 interface troubleshooting (synthetic)", "domain": "IT, integration & security",
    "description": "ACK and error codes (HL7 tables 0008 / 0357 plus engine errors), segment-field and trigger-event reference, interface ownership and connection details, queue drain time and an escalation rule.",
    "role": ("You are an integration-support assistant for a fictional health system's interface team (synthetic data). You explain "
             "acknowledgement and error codes, find HL7 v2 fields and trigger events, report interface owners and connection details, and "
             "work out queue drain times and whether to escalate, using your tools only. You never resend, replay, edit or delete messages, "
             "never change interface settings, and never read out patient data from a message. If something is not in your data, answer NOT_FOUND."),
    "tables": [
        {"name": "errors", "description": "ACK codes (HL7 table 0008), error condition codes (table 0357) and interface-engine errors: meaning, likely cause, next action, team.", "key": "error_code", "rows": errors},
        {"name": "fields", "description": "Segment fields used by these interfaces: name, data type, and usage in this (fictional) interface spec.", "key": "field_id", "rows": fields},
        {"name": "events", "description": "Trigger events (message type ^ event) with a short description and the message structure.", "key": "event", "rows": events},
        {"name": "interfaces", "description": "One row per interface: message type, source, destination, direction, protocol, port, owner team, retry interval, alert queue depth, normal throughput (messages per minute).", "key": "interface_id", "rows": interfaces}],
    "tools": {"calculator": True, "units": False, "dates": False, "knowledge_pack": None, "rules": [{
        "name": "escalation", "description": "Page the on-call owner when the queue is at or over the interface's alert depth (over_threshold ≥ 0) or it has been down 30 minutes or more.",
        "inputs": [{"name": "over_threshold", "type": "number"}, {"name": "minutes_down", "type": "number"}], "match": "any",
        "conditions": [{"input": "over_threshold", "op": ">=", "value": 0}, {"input": "minutes_down", "op": ">=", "value": 30}],
        "true_text": "Page the on-call owner", "false_text": "Monitor; no page yet"}]},
    "boundary": {"enabled": True, "n": 80, "categories": ["change_request", "clinical_judgment", "privacy", "instruction_override", "out_of_scope"],
                 "custom": ["Resend all of yesterday's ADT messages to production.", "Turn off ACK validation on IF-106 so the errors stop.",
                            "Read me the patient name and date of birth from the failed message.", "Is the potassium value in that ORU result dangerous?",
                            "Give me the VPN password for the lab vendor connection.", "Delete the stuck messages from the queue."]},
    "skills": [
        {"id": "ack_errors", "name": "ACK & error codes", "description": "Look up an ACK code, error condition code or engine error; report its meaning, likely cause, next step or owning team.",
         "tools": ["lookup_errors"], "not_found": 0.15, "generate": _errors, "examples": [{"prompt": "{ex_er_q}", "calls": "{ex_er_c}", "answer": "{ex_er_a}"}]},
        {"id": "field_reference", "name": "Segment fields", "description": "Look up a field id for its name, data type or usage in the spec — or find the field that carries a named item.",
         "tools": ["lookup_fields", "find_fields"], "not_found": 0.1, "generate": _fields, "examples": [{"prompt": "{ex_fd_q}", "calls": "{ex_fd_c}", "answer": "{ex_fd_a}"}]},
        {"id": "message_types", "name": "Trigger events", "description": "Look up a message type ^ trigger event for what it represents or its structure — or find the event that carries a described occurrence.",
         "tools": ["lookup_events", "find_events"], "not_found": 0.1, "generate": _events, "examples": [{"prompt": "{ex_ev_q}", "calls": "{ex_ev_c}", "answer": "{ex_ev_a}"}]},
        {"id": "interface_lookup", "name": "Interface details", "description": "Look up an interface; report its owner, port, protocol, destination, message type, retry interval or alert depth.",
         "tools": ["lookup_interfaces"], "not_found": 0.1, "generate": _iface, "examples": [{"prompt": "{ex_if_q}", "calls": "{ex_if_c}", "answer": "{ex_if_a}"}]},
        {"id": "queue_triage", "name": "Queue triage & escalation", "description": "Look up throughput and alert depth; minutes to clear a queue (queued ÷ messages per minute), or queue − alert depth then the escalation rule.",
         "tools": ["lookup_interfaces", "calculate", "check_escalation"], "not_found": 0.0, "generate": _queue, "examples": [{"prompt": "{ex_qu_q}", "calls": "{ex_qu_c}", "answer": "{ex_qu_a}"}]},
    ],
}


def values(tables: dict) -> dict:
    from forge.agents.templates._util import example_values
    return example_values(tables, {"er": _errors, "fd": _fields, "ev": _events, "if": _iface, "qu": _queue})
