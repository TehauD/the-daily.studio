"""Use-case recommendations for every domain template: why it matters, what real data to load later, guardrails, how FORGE
measures it, and a recommended first pilot. Shown in Agent Studio next to the template and rendered into docs/USE_CASES.md.

These are planning recommendations, not results: nothing here says an agent will reach any accuracy. Tier 1 = strong fit for a
first pilot; Tier 2 = valuable, needs more groundwork (data access, compliance review, or a sponsor).
"""
from __future__ import annotations

from typing import Any

GUIDES: dict[str, dict[str, Any]] = {
    "itsm_servicenow": {
        "tier": 1, "risk": "low", "owner": "IT service desk",
        "value": "High ticket volume with clear routing rules; mis-routed tickets cost hours. The lowest-risk way to prove the whole FORGE workflow.",
        "size_it": "Tickets per day, share re-assigned at least once, average minutes to first correct assignment.",
        "load": ["Assignment-group routing table (category → group)", "Configuration-item list (name, location, owner group)", "SLA targets by priority"],
        "guardrails": ["Read-only: suggests a group, never reassigns or closes tickets", "No user personal data in tables", "Hand back password resets and access requests"],
        "measure": "Strict success on routing and SLA tasks vs the untrained student; hand-back rate on boundary cases; Compare against the teacher.",
        "pilot": "Shadow mode on one category for 4 weeks: the agent's suggestion is logged beside the analyst's choice; review disagreements weekly.",
        "never": "Change, close or reassign tickets; reset credentials."},
    "patient_access": {
        "tier": 1, "risk": "moderate", "owner": "Patient access / scheduling",
        "value": "Referral and scheduling rules are complex and change often; wrong visit types waste slots and delay care.",
        "size_it": "Referrals per week, share rescheduled for wrong visit type or department, average handling minutes.",
        "load": ["Department and visit-type routing rules", "Scheduling templates (slot lengths, prerequisites)", "Payer referral requirements"],
        "guardrails": ["Administrative routing only — never triage symptoms or urgency", "Synthetic tasks until PHI approval", "Staff confirm every booking"],
        "measure": "Strict success per routing skill; boundary hand-back rate (clinical questions must be handed back); test adequacy before reading gains.",
        "pilot": "Staff-facing suggestion panel for one specialty's referral queue; measure agreement and time per referral.",
        "never": "Assess symptoms, urgency or clinical appropriateness; book without staff confirmation."},
    "prior_auth": {
        "tier": 1, "risk": "moderate", "owner": "Utilization management / prior-auth intake",
        "value": "Very high volume; most time goes to looking up whether auth is needed, what to attach, and due dates.",
        "size_it": "Auth requests per week, share pended for missing documentation, intake minutes per request.",
        "load": ["Payer criteria table: one row per service code (needs auth, units without auth, documentation, review team, turnaround)", "Plan unit rates for high-cost rules"],
        "guardrails": ["Never decides medical necessity", "Answers NOT_FOUND for services not in the criteria table", "Every approval or denial stays with UM staff"],
        "measure": "Strict success on auth-required, units, due dates and high-cost skills; hand-back rate on necessity questions; sealed final test before any pilot.",
        "pilot": "Intake checklist assistant for one payer: flags 'needs auth' and missing documents; UM nurse confirms.",
        "never": "Approve, deny or judge medical necessity."},
    "claims_denials": {
        "tier": 1, "risk": "moderate", "owner": "Revenue cycle — denials management",
        "value": "Denials are measurable dollars; routing the denial to the right work queue with the right next action shortens rework.",
        "size_it": "Denials per month, dollars at risk, average days in the wrong queue, share appealed past the deadline.",
        "load": ["Denial reason code → work queue and next action (CARC/RARC are public)", "Payer appeal and filing limits"],
        "guardrails": ["Routes and explains; never writes off, appeals or resubmits", "No claim-level personal data in tables"],
        "measure": "Strict success on routing and deadline skills; failure types in Governance; Compare by payer task sets.",
        "pilot": "Work-queue suggestion for one payer's denials; track days-to-correct-queue before and after.",
        "never": "Write off balances, submit appeals or alter claims."},
    "pharmacy_benefits": {
        "tier": 2, "risk": "moderate", "owner": "Pharmacy benefits / specialty pharmacy intake",
        "value": "Formulary status, step therapy, quantity limits and lower-tier alternatives are asked constantly by staff and prescribers' offices.",
        "size_it": "Benefit questions per day at the pharmacy help line, share requiring a formulary lookup, average call minutes.",
        "load": ["Plan formulary (drug, strength, tier, status, copay, quantity limit, PA and step-therapy flags, therapeutic class)", "Specialty review rules"],
        "guardrails": ["Benefit information only — never whether a drug suits a person, interactions or dosing", "Alternatives are 'same class, lower tier', not recommendations", "Hand back every clinical question to a pharmacist"],
        "measure": "Strict success on lookup, alternatives, days-supply and review skills; boundary hand-back on clinical questions must stay near 100 %.",
        "pilot": "Internal help-line assistant for formulary lookups only; pharmacist reviews any 'alternative' answer before it is shared.",
        "never": "Give clinical advice, recommend a switch, or override limits."},
    "security_triage": {
        "tier": 1, "risk": "moderate", "owner": "Security operations",
        "value": "Alert volume outpaces analysts; logs are sensitive, so a local model has a real advantage. Blue-team triage with red-team knowledge and mitigations.",
        "size_it": "Alerts per day, share closed as benign, median minutes to triage, backlog age.",
        "load": ["Alert-type → severity, owner and playbook table", "ATT&CK technique references (public)", "Hardening baselines"],
        "guardrails": ["Defensive only — no exploit code", "Never runs actions on systems; suggests mitigations for a human to apply", "Hand back credential requests and instructions to disable controls"],
        "measure": "Strict success on triage skills plus the Security Bench (with decline items); robustness to injected instructions.",
        "pilot": "Second-opinion triage on one alert family in the SOC queue; analysts rate usefulness and correctness.",
        "never": "Execute changes, write exploits, or disable controls."},
    "coding_edits": {
        "tier": 2, "risk": "compliance-sensitive", "owner": "HIM / coding and charge integrity",
        "value": "Coders spend time checking edit tables (PTP / NCCI, MUE, coverage policies, global periods) before releasing claims; consistent answers reduce rework and denials.",
        "size_it": "Claims held for edits per week, share of edits overridden then denied, coder minutes per held claim.",
        "load": ["Licensed CPT® code descriptions (AMA licence required) or your chargemaster", "CMS NCCI PTP edit files (public)", "CMS MUE files (public)", "Payer / LCD coverage policies (diagnosis groups → procedures)", "Global-period days per procedure"],
        "guardrails": ["Assistive only: reports what the edit tables say", "Never selects codes, modifiers or diagnoses; never advises how to make a claim pay", "Hand back every request to add a modifier, change units or pick a diagnosis", "Compliance review before any pilot; keep the audit trail"],
        "measure": "Strict success per edit skill; boundary hand-back on upcoding-style requests must stay near 100 %; Compare after every quarterly edit-file update (new task set).",
        "pilot": "Read-only 'edit explainer' beside the coder's work queue for one specialty; compliance samples 50 answers a month.",
        "never": "Choose codes, modifiers or diagnoses, or suggest how to bypass an edit."},
    "provider_credentialing": {
        "tier": 2, "risk": "moderate", "owner": "Medical staff office / payer enrollment",
        "value": "Expired licences, lapsed malpractice coverage and missing payer enrollments block scheduling and cause denials; status checks are repetitive lookups and date math.",
        "size_it": "Providers on staff, credentials expiring per month, claims denied for enrollment (e.g. CO-185 / CO-170), analyst hours on status checks.",
        "load": ["Credentialing system export: provider id, specialty, department, licence state and expiry, board status and expiry, malpractice expiry, last credentialed, privileges", "Payer enrollment roster: provider, payer, status, effective date"],
        "guardrails": ["Status reporting only — never grants, changes or recommends privileges", "No personal details (home address, phone, SSN, DEA) in tables", "Provider-identifiable data needs its own approval even though it is not PHI"],
        "measure": "Strict success on lookup, renewal-window, re-credentialing and enrollment skills; date-math errors in failure types.",
        "pilot": "Weekly 'expiring in 90 days' and 'not enrolled with payer X' check-list drafted by the agent, verified by the analyst.",
        "never": "Grant or change privileges, alter dates, or judge competence."},
    "supply_chain": {
        "tier": 2, "risk": "low", "owner": "Supply chain / materials management",
        "value": "Duplicate item-master records split usage and spend; reorder and par arithmetic is repetitive and error-prone. Low clinical risk.",
        "size_it": "Item-master records, estimated duplicate share, stock-outs per month, buyer hours on reorder checks.",
        "load": ["Item master export (item id, description, manufacturer, manufacturer part, unit of measure, pack size, unit cost)", "Par levels, average daily use, lead times and safety stock per location"],
        "guardrails": ["Never places, changes or approves orders, or changes par levels", "Duplicate merges are proposals for a data steward", "No clinical guidance on product use or reuse"],
        "measure": "Strict success on clean-up, unit conversion, reorder and par skills; arithmetic failures in failure types.",
        "pilot": "Item-master clean-up worklist for one category (e.g. gloves): the agent proposes the active record behind each duplicate; a data steward approves merges.",
        "never": "Place or approve orders, change par levels, or advise on product use."},
    "hl7_interfaces": {
        "tier": 2, "risk": "low", "owner": "Integration / interface team",
        "value": "Interface errors are frequent and time-critical; knowledge of codes, fields and owners sits with a few people. Message content is sensitive, so local matters.",
        "size_it": "Interface errors per week, mean time to identify the owner and cause, after-hours pages, number of interfaces.",
        "load": ["Your interface catalogue (id, message type, source, destination, protocol, port, owner, retry, alert depth)", "Engine error codes and runbook actions", "Your interface specifications (field usage per interface)"],
        "guardrails": ["Never resends, replays, edits or deletes messages, or changes settings", "Never reads out patient data from messages; reference tables only", "Credentials and VPN details are hand-back cases"],
        "measure": "Strict success on error, field, event, interface and queue skills; escalation rule decisions; boundary hand-back on replay or PHI requests.",
        "pilot": "On-call helper for the interface team: explains the error, names the owner and the runbook step; engineers act.",
        "never": "Touch messages or settings, or expose message content."},
}


def guide(template: str) -> dict[str, Any] | None:
    return GUIDES.get(template)
