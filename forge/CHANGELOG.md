# FORGE changelog

## 0.11.1 — resilient collection
- Model-server errors keep the server's own reason (e.g. LM Studio's context-length or "no models loaded" message) plus a plain fix.
- Temporary trouble — server restarting, model reloading after sleep or idle unload, timeouts, 5xx, rate limits — is retried for
  about four minutes (shown in the job log) before the stage stops; deterministic refusals such as context overflow are not retried.
- Windows idle sleep is paused while an engine job runs (collect, train, lens, task writing).
- A stopped stage still resumes from the last recorded task.

## 0.11.0 — Domain starter agents
- Six synthetic starter templates grouped by domain: IT service desk (ServiceNow-style routing & enrichment), Patient access
  (request & referral routing, administrative only), Pharmacy benefits, Claims denials, Prior authorization criteria, Security
  alert triage (defensive; MITRE ATT&CK references).
- Built-in task generators per template skill: verified practice tasks without a teacher (no GPU, reproducible).
- Splits group tasks by their primary entity (first lookup), so cross-entity skills no longer starve dev/test.

## 0.10.0 — Azure OpenAI assistant (optional)
- In-app assistant powered by your Azure OpenAI deployment; hidden until configured (System Settings → Integrations or env vars).
- Answers from FORGE's own data per page (study, agent, knowledge pack, general) with FORGE's methods built in; quick questions and
  contextual buttons (Explain / Interpret / Why rejected? / Improve examples / Why does search miss?).
- Data policy: summaries sent on ask; real text only after reviewing the exact payload (hash-checked); redaction, personal-data
  refusal, local audit + history. Key only from an environment variable.

## 0.9.1 — hardened release
- Security: Content-Security-Policy (same-origin, hashed inline script, no eval, no framing); `X-Frame-Options: DENY`.
- Security: path traversal fixed in agent table deletion; arm/split path components validated centrally; refused input returns 422, not 500.
- Windows: atomic file replacement retries when antivirus or a reader holds the file; temp files are process-unique.
- Windows: `setup.ps1` repairs or rebuilds a broken project venv (`No module named pip._vendor`), with a `-Recreate` switch.
- Windows: startup works without a resolvable home directory; a training child's output is relayed in UTF-8 (complete job log).
- Docs: `docs/HARDENING.md` (threat model, controls, residual risks).

## 0.9.0 — Agent Studio
Purpose-built agents: role, read-only tools over your data (tables, exact calculator, units, dates, rules, documents), skills with
examples, teacher-written practice tasks verified by re-executing the tools, entity-level splits, evidence-backed scoring,
sensitive-data guard, synthetic pharmacy-benefits template.

## 0.8.0 — Distillation Lens
Focus skills (train on chosen skills; evaluate all; focus contrast is primary), training snapshots, distance-to-teacher curve,
word heatmap, skill space, embedding map in Knowledge Studio.

## 0.7.0 — Knowledge Studio
Guided doc-QA workflow on your own documents: ingest, hybrid search, verified questions (incl. unanswerable), document-level splits.

## 0.6.x
Knowledge Graph with token projection, wide-screen workspaces, LM Studio unload button, live job log without flashing, process-isolated training runs.

## 0.5.x
Unified research instrument: discovery, pair-check, studies with frozen plans, LoRA training with gates, paired statistics, path graphs.
