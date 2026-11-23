# FORGE changelog

## 0.14.0 — Projects, workspaces and a hardware guard
- **Home** is the new start page: one card per project (an agent, a document set, or the built-in catalog) with its studies,
  Weight Lab variants, stage progress, latest untrained / trained / teacher strict-success (labelled practice vs sealed final
  test) and the one sensible next step. Projects are derived on read (`GET /api/projects`), so they never disagree with their parts.
- Navigation regrouped into four workspaces: **Build**, **See & control**, **Measure**, **Operate**.
- **Simple / Expert** mode: Simple hides the expert pages (Dataset Factory, Training Lab, Trajectory Explorer, Knowledge Graph,
  System Overview, Model Factory); Expert shows everything.
- **Guided tours by role** (operations / clinical lead, analyst, engineer, leader) and a plain-language **glossary**: underlined
  terms explain themselves on hover or keyboard focus.
- **Job dock**: running jobs stay visible from every page with their live log on demand, and a toast appears when a job
  finishes or fails (including jobs shorter than one poll).
- **Hardware guard** (Settings → Hardware guard) for every engine job: thermal pause at safe points (default pause at 83 °C,
  resume at 75 °C; results unaffected), cool start, CPU cores kept free (torch / BLAS / OpenMP threads), below-normal priority,
  and GPU energy (Wh), average power, peak temperature and time paused per job — stored with training runs and shown in
  Training Lab. Readings are whole-card (nvidia-smi).

## 0.13.0 — Model Map
- Decision graph: episodes merged into skill → actions → outcome with per-skill procedure consistency; click to follow tasks.
- Representation map: decision-point hidden states at every layer, untrained vs trained on shared PCA axes (each centred on its own
  mean, so axes show structure), skill purity and silhouette by layer, training shift per layer; linked selection.
- Word view: gradient × input word influence for the first action; layer-by-layer prediction at the decision token.
- Held-out splits only after SEAL; personal-data patterns refused.
- Agent studies keep their own frozen copy of the agent: editing the agent (e.g. adding an example from the Playground) no longer
  breaks studies built from it; tampering with the copy is still refused.

## 0.12.0 — See it, control it, keep people in charge
- Agent Playground: free-text or practice-task input through base, trained adapters, Weight Lab variants and the teacher, side by
  side, with path graphs, evidence and first divergence; held-out tasks only after SEAL; accept / override decisions recorded with
  the reviewer; overrides can be added as skill examples.
- Weight Lab: exact LoRA arithmetic (stacked factors) — strength, weighted merges / seed averaging / skill merging, layer and
  module masks, SVD rank compression with energy kept; dev-only evaluation vs untrained, trained and teacher per skill.
- Human review queue for agent practice tasks (approve / correct with re-verification / reject, reviewer recorded); studies can
  require reviewed tasks.

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
