# Use cases: where FORGE fits, and what to pilot first

This guide ranks the domain templates as **use cases** for a health system and gives, for each, why it matters, how to size it,
what real data you would load later, the guardrails, how FORGE measures it, and a recommended first pilot. It is generated
from `backend/forge/agents/templates/guides.py` — the same text Agent Studio shows when you pick a template.

> **Planning recommendations, not results.** Nothing here predicts an accuracy. Every template is synthetic. Real data —
> and anything touching patient information — needs separate approval first. FORGE never claims clinical validity or
> deployment readiness; a sealed final test and a recorded human decision come before any pilot.

## What makes a good fit

1. **Narrow and repeated** — the same kind of question thousands of times.
2. **Checkable** — a right answer exists in a table, policy, code set or system of record (FORGE keeps only tasks it can verify).
3. **Local matters** — sensitive data, cost at volume, speed, or offline use. If none apply, calling the large model directly
   through an approved endpoint is simpler.
4. **A person stays in the loop** — the agent drafts, routes, flags or explains; staff decide.
5. **Low clinical risk** — administrative, operational, revenue-cycle, IT and security work; never diagnosis or treatment.

## Scoring a candidate

Score 1–5 on **volume × minutes saved**, **verifiability**, **data readiness**, **risk** (inverted), **local advantage** and
**sponsor**. Rank by the total, but require verifiability ≥ 3 and risk ≤ 2 before a pilot. Tier 1 below = strong first-pilot
candidates; Tier 2 = valuable, needs more groundwork (data access, compliance review, or a sponsor).

## At a glance

| Use case | Department | Tier | Risk | Recommended first pilot |
|---|---|---|---|---|
| [IT service desk — ServiceNow-style routing & enrichment](#itsm-servicenow) | IT, integration & security | 1 | low | Shadow mode on one category for 4 weeks: the agent's suggestion is logged beside the analyst's choice; review disagreements weekly. |
| [Security alert triage](#security-triage) | IT, integration & security | 1 | moderate | Second-opinion triage on one alert family in the SOC queue; analysts rate usefulness and correctness. |
| [Patient access — request & referral routing](#patient-access) | Patient access & authorizations | 1 | moderate | Staff-facing suggestion panel for one specialty's referral queue; measure agreement and time per referral. |
| [Prior authorization criteria](#prior-auth) | Patient access & authorizations | 1 | moderate | Intake checklist assistant for one payer: flags 'needs auth' and missing documents; UM nurse confirms. |
| [Claims denials — revenue-cycle routing](#claims-denials) | Revenue cycle | 1 | moderate | Work-queue suggestion for one payer's denials; track days-to-correct-queue before and after. |
| [HL7 interface troubleshooting](#hl7-interfaces) | IT, integration & security | 2 | low | On-call helper for the interface team: explains the error, names the owner and the runbook step; engineers act. |
| [Provider credentialing & enrollment](#provider-credentialing) | Medical staff & enrollment | 2 | moderate | Weekly 'expiring in 90 days' and 'not enrolled with payer X' check-list drafted by the agent, verified by the analyst. |
| [Pharmacy-benefits assistant](#pharmacy-benefits) | Pharmacy | 2 | moderate | Internal help-line assistant for formulary lookups only; pharmacist reviews any 'alternative' answer before it is shared. |
| [Coding edit checks](#coding-edits) | Revenue cycle | 2 | compliance-sensitive | Read-only 'edit explainer' beside the coder's work queue for one specialty; compliance samples 50 answers a month. |
| [Supply chain item master & reorders](#supply-chain) | Supply chain | 2 | low | Item-master clean-up worklist for one category (e.g. gloves): the agent proposes the active record behind each duplicate; a data steward approves merges. |

<a id="itsm-servicenow"></a>
## IT service desk — ServiceNow-style routing & enrichment

*Template `itsm_servicenow` · IT, integration & security · Tier 1 · low risk · owner: IT service desk*

**Why it matters.** High ticket volume with clear routing rules; mis-routed tickets cost hours. The lowest-risk way to prove the whole FORGE workflow.

**Size the opportunity — count:** Tickets per day, share re-assigned at least once, average minutes to first correct assignment.

**What the template practises:** Route the ticket — find the keyword in the ticket and return its assignment group, category, or subcategory; NOT_FOUND if no keyword matches.; Set priority — priority = impact value + urgency value − 1, after looking both levels up.; Enrich from the CMDB — look up the configuration item named in the ticket and return its business service, support group, location or class.; SLA due date — look up the priority's resolution days and add them to the opened date.; Major-incident check — look up the CI's criticality, then apply the major-incident rule with the number of affected users.

**Synthetic tables:** `routing`, `impact_urgency`, `cmdb_ci`, `sla` (samples in [`docs/examples`](examples/)).

**Real data to load later (after approval):**
- Assignment-group routing table (category → group)
- Configuration-item list (name, location, owner group)
- SLA targets by priority

**Guardrails:**
- Read-only: suggests a group, never reassigns or closes tickets
- No user personal data in tables
- Hand back password resets and access requests

**How FORGE measures it.** Strict success on routing and SLA tasks vs the untrained student; hand-back rate on boundary cases; Compare against the teacher.

**Recommended first pilot.** Shadow mode on one category for 4 weeks: the agent's suggestion is logged beside the analyst's choice; review disagreements weekly.

**Never:** Change, close or reassign tickets; reset credentials.

<a id="security-triage"></a>
## Security alert triage

*Template `security_triage` · IT, integration & security · Tier 1 · moderate risk · owner: Security operations*

**Why it matters.** Alert volume outpaces analysts; logs are sensitive, so a local model has a real advantage. Blue-team triage with red-team knowledge and mitigations.

**Size the opportunity — count:** Alerts per day, share closed as benign, median minutes to triage, backlog age.

**What the template practises:** Map to ATT&CK — look up the detection rule's technique, then the technique's name or tactic.; Asset owner — look up the host named in the alert; NOT_FOUND for unknown hosts.; Escalation decision — look up the rule's severity and the asset's criticality, then apply the escalation rule.; Remediation deadline — look up the advisory's remediation days and add them to the publication date.

**Synthetic tables:** `detections`, `techniques`, `assets`, `advisories` (samples in [`docs/examples`](examples/)).

**Real data to load later (after approval):**
- Alert-type → severity, owner and playbook table
- ATT&CK technique references (public)
- Hardening baselines

**Guardrails:**
- Defensive only — no exploit code
- Never runs actions on systems; suggests mitigations for a human to apply
- Hand back credential requests and instructions to disable controls

**How FORGE measures it.** Strict success on triage skills plus the Security Bench (with decline items); robustness to injected instructions.

**Recommended first pilot.** Second-opinion triage on one alert family in the SOC queue; analysts rate usefulness and correctness.

**Never:** Execute changes, write exploits, or disable controls.

<a id="patient-access"></a>
## Patient access — request & referral routing

*Template `patient_access` · Patient access & authorizations · Tier 1 · moderate risk · owner: Patient access / scheduling*

**Why it matters.** Referral and scheduling rules are complex and change often; wrong visit types waste slots and delay care.

**Size the opportunity — count:** Referrals per week, share rescheduled for wrong visit type or department, average handling minutes.

**What the template practises:** Route the request — find the request type in the message and return its work queue, department, or response target; NOT_FOUND if none matches.; Route the referral — look up the specialty's default clinic, then the clinic's location or availability.; Scheduling window — look up the specialty's routine or urgent window and add it to the received date.; Expedite check — apply the administrative expedite rule (clinician's urgent flag, days waiting).

**Synthetic tables:** `requests`, `specialties`, `clinics` (samples in [`docs/examples`](examples/)).

**Real data to load later (after approval):**
- Department and visit-type routing rules
- Scheduling templates (slot lengths, prerequisites)
- Payer referral requirements

**Guardrails:**
- Administrative routing only — never triage symptoms or urgency
- Synthetic tasks until PHI approval
- Staff confirm every booking

**How FORGE measures it.** Strict success per routing skill; boundary hand-back rate (clinical questions must be handed back); test adequacy before reading gains.

**Recommended first pilot.** Staff-facing suggestion panel for one specialty's referral queue; measure agreement and time per referral.

**Never:** Assess symptoms, urgency or clinical appropriateness; book without staff confirmation.

<a id="prior-auth"></a>
## Prior authorization criteria

*Template `prior_auth` · Patient access & authorizations · Tier 1 · moderate risk · owner: Utilization management / prior-auth intake*

**Why it matters.** Very high volume; most time goes to looking up whether auth is needed, what to attach, and due dates.

**Size the opportunity — count:** Auth requests per week, share pended for missing documentation, intake minutes per request.

**What the template practises:** Authorization requirements — look up the service by code (or find it by name); return whether it needs authorization, the review team, the documentation, or units allowed without it.; Units over the limit — look up the units allowed without authorization and subtract them from the requested units.; Decision due date — look up the standard or expedited turnaround and add it to the received date.; High-cost review — look up the unit rate, multiply by the units, then apply the high-cost review rule with the setting.

**Synthetic tables:** `services` (samples in [`docs/examples`](examples/)).

**Real data to load later (after approval):**
- Payer criteria table: one row per service code (needs auth, units without auth, documentation, review team, turnaround)
- Plan unit rates for high-cost rules

**Guardrails:**
- Never decides medical necessity
- Answers NOT_FOUND for services not in the criteria table
- Every approval or denial stays with UM staff

**How FORGE measures it.** Strict success on auth-required, units, due dates and high-cost skills; hand-back rate on necessity questions; sealed final test before any pilot.

**Recommended first pilot.** Intake checklist assistant for one payer: flags 'needs auth' and missing documents; UM nurse confirms.

**Never:** Approve, deny or judge medical necessity.

<a id="claims-denials"></a>
## Claims denials — revenue-cycle routing

*Template `claims_denials` · Revenue cycle · Tier 1 · moderate risk · owner: Revenue cycle — denials management*

**Why it matters.** Denials are measurable dollars; routing the denial to the right work queue with the right next action shortens rework.

**Size the opportunity — count:** Denials per month, dollars at risk, average days in the wrong queue, share appealed past the deadline.

**What the template practises:** Route the denial — look up the reason code; return its work queue, category, next action, or appealability; NOT_FOUND for unknown codes.; Appeal deadline — look up the payer's appeal window and add it to the denial date.; Small-balance check — apply the small-balance rule to the denied amount.

**Synthetic tables:** `codes`, `payers` (samples in [`docs/examples`](examples/)).

**Real data to load later (after approval):**
- Denial reason code → work queue and next action (CARC/RARC are public)
- Payer appeal and filing limits

**Guardrails:**
- Routes and explains; never writes off, appeals or resubmits
- No claim-level personal data in tables

**How FORGE measures it.** Strict success on routing and deadline skills; failure types in Governance; Compare by payer task sets.

**Recommended first pilot.** Work-queue suggestion for one payer's denials; track days-to-correct-queue before and after.

**Never:** Write off balances, submit appeals or alter claims.

<a id="hl7-interfaces"></a>
## HL7 interface troubleshooting

*Template `hl7_interfaces` · IT, integration & security · Tier 2 · low risk · owner: Integration / interface team*

**Why it matters.** Interface errors are frequent and time-critical; knowledge of codes, fields and owners sits with a few people. Message content is sensitive, so local matters.

**Size the opportunity — count:** Interface errors per week, mean time to identify the owner and cause, after-hours pages, number of interfaces.

**What the template practises:** ACK & error codes — look up an ACK code, error condition code or engine error; report its meaning, likely cause, next step or owning team.; Segment fields — look up a field id for its name, data type or usage in the spec — or find the field that carries a named item.; Trigger events — look up a message type ^ trigger event for what it represents or its structure — or find the event that carries a described occurrence.; Interface details — look up an interface; report its owner, port, protocol, destination, message type, retry interval or alert depth.; Queue triage & escalation — look up throughput and alert depth; minutes to clear a queue (queued ÷ messages per minute), or queue − alert depth then the escalation rule.

**Synthetic tables:** `errors`, `fields`, `events`, `interfaces` (samples in [`docs/examples`](examples/)).

**Real data to load later (after approval):**
- Your interface catalogue (id, message type, source, destination, protocol, port, owner, retry, alert depth)
- Engine error codes and runbook actions
- Your interface specifications (field usage per interface)

**Guardrails:**
- Never resends, replays, edits or deletes messages, or changes settings
- Never reads out patient data from messages; reference tables only
- Credentials and VPN details are hand-back cases

**How FORGE measures it.** Strict success on error, field, event, interface and queue skills; escalation rule decisions; boundary hand-back on replay or PHI requests.

**Recommended first pilot.** On-call helper for the interface team: explains the error, names the owner and the runbook step; engineers act.

**Never:** Touch messages or settings, or expose message content.

<a id="provider-credentialing"></a>
## Provider credentialing & enrollment

*Template `provider_credentialing` · Medical staff & enrollment · Tier 2 · moderate risk · owner: Medical staff office / payer enrollment*

**Why it matters.** Expired licences, lapsed malpractice coverage and missing payer enrollments block scheduling and cause denials; status checks are repetitive lookups and date math.

**Size the opportunity — count:** Providers on staff, credentials expiring per month, claims denied for enrollment (e.g. CO-185 / CO-170), analyst hours on status checks.

**What the template practises:** Credential lookup — look up one provider and report one field: specialty, department, licence state or expiry, board status, privileges, last credentialed, malpractice expiry.; Renewal window check — look up the expiry, count the days from the as-of date to it, then apply the 90-day renewal rule — or report the days remaining.; Re-credentialing due — add 1,095 days to the last credentialing date; optionally count the days from an as-of date to that due date.; Payer enrollment status — find the provider's enrollments and report the status or effective date with the named payer, or how many enrollment records exist.

**Synthetic tables:** `providers`, `enrollments` (samples in [`docs/examples`](examples/)).

**Real data to load later (after approval):**
- Credentialing system export: provider id, specialty, department, licence state and expiry, board status and expiry, malpractice expiry, last credentialed, privileges
- Payer enrollment roster: provider, payer, status, effective date

**Guardrails:**
- Status reporting only — never grants, changes or recommends privileges
- No personal details (home address, phone, SSN, DEA) in tables
- Provider-identifiable data needs its own approval even though it is not PHI

**How FORGE measures it.** Strict success on lookup, renewal-window, re-credentialing and enrollment skills; date-math errors in failure types.

**Recommended first pilot.** Weekly 'expiring in 90 days' and 'not enrolled with payer X' check-list drafted by the agent, verified by the analyst.

**Never:** Grant or change privileges, alter dates, or judge competence.

<a id="pharmacy-benefits"></a>
## Pharmacy-benefits assistant

*Template `pharmacy_benefits` · Pharmacy · Tier 2 · moderate risk · owner: Pharmacy benefits / specialty pharmacy intake*

**Why it matters.** Formulary status, step therapy, quantity limits and lower-tier alternatives are asked constantly by staff and prescribers' offices.

**Size the opportunity — count:** Benefit questions per day at the pharmacy help line, share requiring a formulary lookup, average call minutes.

**What the template practises:** Formulary lookup — answer a question about one drug's tier, status, 30-day copay, quantity limit, form, class, step-therapy or prior-authorization flag.; Lower-tier alternatives — look up the drug's therapeutic class, find every drug in that class, and report the one on the lowest tier (or how many are in the class). Benefit information, not a clinical recommendation.; Days supply & refill dates — work out how many days a dispensed quantity lasts (quantity ÷ units per day), or the date a supply runs out / the next refill date.; Specialty review check — decide whether a request for a given drug and quantity needs specialty review: look up the drug's tier, then apply the rule.

**Synthetic tables:** `formulary` (samples in [`docs/examples`](examples/)).

**Real data to load later (after approval):**
- Plan formulary (drug, strength, tier, status, copay, quantity limit, PA and step-therapy flags, therapeutic class)
- Specialty review rules

**Guardrails:**
- Benefit information only — never whether a drug suits a person, interactions or dosing
- Alternatives are 'same class, lower tier', not recommendations
- Hand back every clinical question to a pharmacist

**How FORGE measures it.** Strict success on lookup, alternatives, days-supply and review skills; boundary hand-back on clinical questions must stay near 100 %.

**Recommended first pilot.** Internal help-line assistant for formulary lookups only; pharmacist reviews any 'alternative' answer before it is shared.

**Never:** Give clinical advice, recommend a switch, or override limits.

<a id="coding-edits"></a>
## Coding edit checks

*Template `coding_edits` · Revenue cycle · Tier 2 · compliance-sensitive risk · owner: HIM / coding and charge integrity*

**Why it matters.** Coders spend time checking edit tables (PTP / NCCI, MUE, coverage policies, global periods) before releasing claims; consistent answers reduce rework and denials.

**Size the opportunity — count:** Claims held for edits per week, share of edits overridden then denied, coder minutes per held claim.

**What the template practises:** Procedure-to-procedure edits — find the PTP edits whose column 1 is the first code; for the pair, report whether a modifier may bypass the edit, or why the edit exists.; Unit limits (MUE) — look up the MUE for the procedure; report it, the units over it, or the units within it (min of billed and MUE).; Diagnosis supports procedure? — look up the diagnosis group, then find the procedure's coverage policy rows; report whether that group is supported.; Global surgical period — look up the procedure's global days and add them to the procedure date (fictional policy: end = date + global days).

**Synthetic tables:** `procedures`, `ptp_edits`, `diagnoses`, `coverage` (samples in [`docs/examples`](examples/)).

**Real data to load later (after approval):**
- Licensed CPT® code descriptions (AMA licence required) or your chargemaster
- CMS NCCI PTP edit files (public)
- CMS MUE files (public)
- Payer / LCD coverage policies (diagnosis groups → procedures)
- Global-period days per procedure

**Guardrails:**
- Assistive only: reports what the edit tables say
- Never selects codes, modifiers or diagnoses; never advises how to make a claim pay
- Hand back every request to add a modifier, change units or pick a diagnosis
- Compliance review before any pilot; keep the audit trail

**How FORGE measures it.** Strict success per edit skill; boundary hand-back on upcoding-style requests must stay near 100 %; Compare after every quarterly edit-file update (new task set).

**Recommended first pilot.** Read-only 'edit explainer' beside the coder's work queue for one specialty; compliance samples 50 answers a month.

**Never:** Choose codes, modifiers or diagnoses, or suggest how to bypass an edit.

<a id="supply-chain"></a>
## Supply chain item master & reorders

*Template `supply_chain` · Supply chain · Tier 2 · low risk · owner: Supply chain / materials management*

**Why it matters.** Duplicate item-master records split usage and spend; reorder and par arithmetic is repetitive and error-prone. Low clinical risk.

**Size the opportunity — count:** Item-master records, estimated duplicate share, stock-outs per month, buyer hours on reorder checks.

**What the template practises:** Item-master clean-up — look up a record or find by manufacturer part; report the active item behind a duplicate or part number, or one field (unit of measure, pack size, status, manufacturer).; Units of measure & cost — look up the pack size (eaches per box or case) and unit cost; convert packs ↔ eaches or price N packs.; Reorder point check — look up daily use, lead time and safety stock; compute on hand − (daily use × lead time + safety stock) and apply the reorder rule — or report the reorder point.; Order to par & days on hand — look up par level or daily use; eaches needed to reach par (par − on hand) or days on hand (on hand ÷ daily use).

**Synthetic tables:** `items` (samples in [`docs/examples`](examples/)).

**Real data to load later (after approval):**
- Item master export (item id, description, manufacturer, manufacturer part, unit of measure, pack size, unit cost)
- Par levels, average daily use, lead times and safety stock per location

**Guardrails:**
- Never places, changes or approves orders, or changes par levels
- Duplicate merges are proposals for a data steward
- No clinical guidance on product use or reuse

**How FORGE measures it.** Strict success on clean-up, unit conversion, reorder and par skills; arithmetic failures in failure types.

**Recommended first pilot.** Item-master clean-up worklist for one category (e.g. gloves): the agent proposes the active record behind each duplicate; a data steward approves merges.

**Never:** Place or approve orders, change par levels, or advise on product use.

## Not recommended — now or by design

Diagnosis, symptom triage, treatment or dosing advice, clinical decision support, anything that approves or denies care, and
patient-facing chat without staff review. FORGE's evidence (strict success on synthetic, verifiable tasks) cannot support claims
there, and every template hands these requests back.

## A sensible order

1. **IT service desk triage** — lowest risk; proves the whole workflow (define → practise → train → seal → compare → decide).
2. **One revenue-cycle or access use case with a sponsor** — prior auth intake, denials routing, or patient access routing.
3. **Tier 2 with groundwork done** — supply chain and HL7 support (low risk) first; credentialing next; coding edits only with
   compliance review and licensed code data; pharmacy benefits with pharmacist review of every alternative.

For each: size it with the counts above, load real tables only after approval (see [LOADING_DATA.md](LOADING_DATA.md)), check
**Is this a good test?** before reading gains, seal the final test, compare against the teacher and the untrained student, and
record the human decision in **Governance → Decide & release**.
