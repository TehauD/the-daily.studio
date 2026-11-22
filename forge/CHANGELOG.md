# FORGE changelog

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
