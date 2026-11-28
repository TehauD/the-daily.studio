# Path to real requests — design (not built; gated)

**Status: design only.** FORGE uses synthetic tasks. Nothing described here is implemented, and nothing here may be built or
used with real data until it is separately approved (privacy, security and clinical governance). This document exists so the
current design leaves room for it and so the approval conversation starts from a concrete, reviewable plan.

## The question it would answer

Synthetic tasks show that a student learned *these* skills. The open question is the **synthetic-to-real gap**: does the
measured gain hold on requests shaped like real ones? The design below measures that gap without putting identifiable data
into prompts, training sets, logs or bundles.

## Principles

1. **Patterns, not records.** Real requests are used only to derive *templates* (intent, structure, the tools needed, the
   kinds of values involved). Every value in a task is synthetic.
2. **Humans in the loop.** Every template is written or approved by a named reviewer; FORGE records who and when.
3. **Separate, sealed evaluation.** Real-pattern tasks form their own sealed split, never used for training, so the gap is
   measured, not trained away.
4. **Same instrument.** Same tools, verification, scoring, statistics and controls as synthetic tasks.

## Proposed flow

| step | where | what leaves the boundary |
|---|---|---|
| 1 sample | inside the approved environment, outside FORGE | nothing |
| 2 de-identify and abstract | approved tooling + reviewer: request → template with typed slots (`{drug}`, `{date}`, `{member_plan}`) | templates only |
| 3 review | FORGE review queue (exists for agent tasks): approve / correct / reject, with reviewer identity | templates only |
| 4 instantiate | FORGE fills slots from the agent's **synthetic** tables; tasks verified by re-running tools as today | synthetic tasks |
| 5 measure | new sealed split `real_pattern`; Evidence reports synthetic vs real-pattern gain with ranges | results |

## Safeguards to build before any use

- The existing identifier scan (SSN, e-mail, phone, MRN patterns) extended and **blocking** on templates, plus a reviewer
  attestation per template; a template with any un-slotted specific value is refused.
- No free text from real requests in training data, few-shot examples, bundles or logs — enforced by tests.
- Audit trail of who approved each template; bundles carry template hashes, not source references.
- A kill switch: the split is disabled unless an administrator setting records the approval reference.

## What it would still not show

Even with real-pattern tasks, results are strict success on reconstructed requests. They would not establish clinical
validity, safety in use, or deployment readiness — those need a separate clinical evaluation.
