# FORGE architecture (v0.5)

```
browser ──HTTP(loopback, token on mutations)──► API process (FastAPI, no torch)
                                                 │  registry / discovery / statistics / graphs / hub search
                                                 │  SQLite (WAL): models, roles, discovery_runs, jobs, studies, …
                                                 └─spawn──► job process: <venv python> -m forge.engine …
                                                              study stages · LoRA training · student eval · hub download
                                                              writes immutable JSONL / safetensors / manifests
LM Studio / Ollama (teacher) ◄─HTTP(loopback, trust_env=False, no redirects)── collect stage
```

## Layering

| Layer | Does | Never does |
|---|---|---|
| Providers | Discover models; teacher chat backends; Hub search/inspect/download | Write the DB or decide trainability |
| Registry | Persist models, capabilities, kind, roles, eligibility | Make network calls |
| Engine | Tasks, episodes, datasets, training, statistics, study lifecycle | Render UI or run inside the API process |
| Jobs | Spawn engine subprocesses (one GPU job at a time), stream JSON-line logs, cancel, recover | Run GPU work in the API process |
| API | Thin routing, validation, guards | Business logic |
| UI | Render measured state with provenance | Fabricate metrics |

## Persistence
- SQLite with forward-only migrations (v1 registry/experiments, v2 jobs/studies).
- Study directory = the system of record for research: `plan.json` + `plan.sha256` (frozen), `state.json`,
  `tasks.jsonl`, `episodes/<arm>/<split>/seed<n>.jsonl` (each line `{sha256, record}`), `datasets/<arm>/`,
  `runs/<arm>/seed<n>/{adapter/, training.jsonl, run.json, inspection.json}`, `reports/`, `seal.json`, `exports/`.
- Atomic JSON writes (tmp + rename); JSONL appends fsync'd; a torn final line is dropped on resume, any other corruption raises.
- Configuration precedence: environment → validated DB runtime overrides (`lmstudio_url`, `ollama_url`) → effective settings.
  UI preferences: localStorage `forge.ui.v1`, applied pre-paint, exportable as JSON.

## Process and GPU rules
- Teacher and student share one 16 GB GPU and are never loaded together: `collect` and every training/eval stage are
  GPU-exclusive jobs; training pre-flight refuses while LM Studio reports a loaded generative model.
- Studies run with `HF_HUB_OFFLINE=1`; models load with `local_files_only=True`, `trust_remote_code=False`.
- No silent OOM fallback: OOM fails the run and reports the measured peak.

## Security
Loopback bind (explicit override only) · port bound before any initialization, owning PID reported on conflict ·
`forge.started` logged only after bind · Host-header allowlist (DNS rebinding) · per-session `X-Forge-Token` on every
mutating request · loopback-only endpoints unless explicitly opted in; API keys by env-var name only ·
path validation (traversal, UNC/device, NUL, symlink escape) and study-confined evidence viewer · pickle never loaded ·
UTF-8 everywhere (`charset=utf-8` on responses, `encoding="utf-8"` on reads, `PYTHONUTF8=1` in jobs).

## Visualization honesty boundary
A model's hidden chain of thought cannot be faithfully visualized. FORGE renders observable behavior (actions, tool
results, answers) and measured weight changes only. Illustrations (Guide demos) are labeled `illustration`.
