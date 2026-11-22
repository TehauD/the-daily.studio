# FORGE hardening (v0.10.0)

What FORGE defends against, the control that does it, and how each control is checked.
"Test" names the automated test in `backend/tests/` and "browser" a check on the built UI.

## Scope and threat model

FORGE is a **single-user, local** lab. It runs on your machine and is reachable only from it.
In scope:
- other web pages open in your browser trying to drive FORGE (CSRF, DNS rebinding, click-jacking);
- untrusted *inputs*: model files, documents, tables, teacher output, request parameters;
- accidental data exposure (personal data in training material, remote endpoints);
- damage to your models or results (original weights, frozen plans, sealed test sets).

Out of scope: an attacker who already runs code as your Windows user; multi-user or networked deployment;
clinical use. FORGE makes **no clinical-validity or deployment-readiness claims**.

## Network and HTTP

| Risk | Control | Checked by |
|---|---|---|
| Exposure on the network | Binds `127.0.0.1` only; a non-loopback bind is refused unless `FORGE_ALLOW_REMOTE_BIND=1`. The port is bound before anything else; a conflict exits with code 3 and names the owning PID | test (`test_port_conflict_reports_owner_and_exits`) |
| DNS rebinding | Host header allowlist (`127.0.0.1`, `localhost`) | test (`test_security_headers`) |
| CSRF from other local pages | Per-session random token required on every POST/PUT/PATCH/DELETE under `/api/`; compared in constant time | tests |
| Click-jacking | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` | test + browser |
| Script injection in the UI | Strict Content-Security-Policy: same-origin only; the one inline pre-paint script allowed by its SHA-256; no `eval`, no plugins, no remote hosts. React escapes all rendered text | test + browser (all 14 pages, zero CSP violations) |
| Content sniffing / leaking URLs | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, explicit `charset=utf-8` | test |
| Outbound calls | Teacher, embedding and runtime endpoints must be loopback unless you opt in per endpoint; `trust_env=False` (no system proxy), no redirects; API keys referenced by environment-variable name only | tests |
| Azure OpenAI assistant (optional) | Off until endpoint, deployment, *enabled* and the key variable are all set; https only, host must be an Azure OpenAI / Azure AI domain, bare resource URL (no path, credentials or custom port); key read from an environment variable at call time, never stored or returned; no redirects; system proxy only if opted in. Summaries only by default; real text requires approving the exact payload (SHA-256 checked server-side; a mismatch sends nothing). Paths redacted; personal-data patterns refused; history cannot inject system messages; local audit log of size + hash | tests (`test_assistant.py`) + browser |
| Telemetry | None. Nothing leaves the machine except Hugging Face Hub downloads you start (the outbound call is shown first) | — |

## Files and paths

| Risk | Control | Checked by |
|---|---|---|
| Path traversal via IDs | Study, pack and agent IDs are pattern-checked (`study_…`, `pack_…`, `agent_…`, alphanumeric) | tests |
| Path traversal via names | Arm / split names that become path parts must match `[a-z0-9_]`; table names likewise; table deletion only for tables that exist | test (`test_path_components_are_validated`) |
| Reading outside a study | Evidence viewer confined to the study directory (`safe_join`, symlink escape refused) | tests |
| User folders | Knowledge-pack folders validated (no system / hidden directories) | tests |
| Torn or half-written state | JSON written to a process-unique temp file, then atomically replaced; on Windows the replace retries briefly when antivirus or a reader holds the file; JSONL appends are SHA-256 per line and a torn tail is repaired | tests |
| Two processes on one study | Study lock records PID + process start time (stale locks are detected, not trusted) | tests |

## Models and weights

| Risk | Control | Checked by |
|---|---|---|
| Malicious model code | `trust_remote_code=False`, `local_files_only=True` everywhere; pickle weights are never downloaded | tests |
| Modifying your base model | Base-model hash recorded before training and re-read after; a mismatch fails the run. Merged exports are new hashed copies | tests (CPU end-to-end) |
| Silent training errors | Zero-adapter check (adapter must be an exact no-op before training), only LoRA parameters trainable, exact token-prefix assertion, no truncation, no silent OOM fallback | tests |
| GPU contention | One GPU job at a time; training gated on free VRAM and on the teacher being unloaded; each arm × seed trains in its own process so memory is fully released | tests + your RTX run |

## Data you bring

| Risk | Control | Checked by |
|---|---|---|
| Personal / patient data | Explicit attestation for every knowledge pack and agent. Agent tables, role text and examples are scanned: identifier-like columns (patient, MRN, DOB, names, address, phone, e-mail, member/insurance IDs, SSN …) and SSN / e-mail / phone / MRN patterns are **refused**. A guard-rail, not a guarantee | tests + browser (a `patient_name,dob` CSV was refused) |
| Instruction injection in data | Instruction-like text in tables is flagged before import | tests |
| Wrong or unverifiable lessons | Only verified material becomes training data: doc-QA answers must be quoted from the passage; agent tasks are re-executed by FORGE with grounded arguments and an answer a tool really returned; teacher episodes must be strict successes | tests |
| Agent tools doing harm | Tools are declarative and read-only: no user code, no shell, no network. The calculator parses an AST whitelist (numbers, + − × ÷, min/max/abs/round); `__import__`, attributes, names and powers are refused | tests |
| Oversized uploads | Tables ≤ 5 MB, ≤ 20 000 rows, ≤ 40 columns, cells ≤ 500 chars | tests |

## Research integrity

| Risk | Control |
|---|---|
| Tuning on the test set | Frozen, hashed plan; SEAL before test evaluation; build/train/dev evaluation refused after sealing |
| Changing inputs mid-study | Task set, knowledge pack and agent (spec, tables, tasks) hashed into the plan; a later change is refused for that study |
| Leakage between splits | Group-level splits (catalog), document-level (doc-QA), entity-level (agents) |
| Over-claiming | Provenance chip on every number; a passing review gate means *candidate for human review*; the Lens and token projection state what they do not show |

## Install and runtime robustness (Windows)

- `setup.ps1` checks that the project venv's Python **and pip** work. If pip is broken, it repairs it, and if that fails it rebuilds the venv; `-Recreate` forces a rebuild.
- Startup no longer needs a resolvable home directory, and the port check always runs first.
- A training child's output is relayed through its parent as UTF-8, so the job log is complete regardless of console code page.

## Residual risks (known, accepted for a local lab)

- Any program running as your Windows user can read `%LOCALAPPDATA%\Forge` and could read the session token from the running page.
- The personal-data scan uses patterns and cannot recognise every identifier (free-text names, rare ID formats). **Synthetic or non-sensitive data only.**
- A malicious *teacher* model can still write wrong but verifiable-looking tasks. Verification proves that the answers come from your tools and data, not that the questions are sensible. Read the accepted tasks.
- When the assistant is on, summaries (metrics, settings, skill and tool names, your agent's role text) go to your Azure resource and are processed under your Azure terms and region.
- Inline style attributes are allowed by the CSP (the charts need them); inline scripts are not.
- PowerShell scripts were reviewed but are only exercised on your Windows machine; the CI-style checks here run on Linux.
