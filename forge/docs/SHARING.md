# Sharing FORGE work: task packs and reproducibility bundles

FORGE is modular in two directions: **use cases** travel as task packs, **results** travel as reproducibility bundles. Both
are plain zips with a manifest and a SHA-256 for every file, and both are checked on arrival.

## Task packs — a use case as data

A task pack holds one agent definition — role, read-only tools (tables, rules, calculator, units, dates), skills with examples
— its synthetic tables and, optionally, its verified practice tasks with their splits.

**No code.** Packs may contain only `pack.json`, `agent.json`, `tables/*.json` and `tasks.jsonl`; anything else refuses the
pack. FORGE's own tool engine runs the tools, so installing a pack cannot run anything its author wrote.

**Checked on install:** format, sizes, every hash; paths (no `..`, no absolute paths); every table and task scanned for personal
identifiers — any hit refuses the pack; the spec validated; and **every task re-verified** by re-running its tool calls against
the tables. Tasks whose recorded answer does not follow from the tools are dropped and listed, as are task groups that span
splits (a leak).

| | |
|---|---|
| Make one | Agent Studio → (tasks done) → *Share as a task pack*, or `POST /api/agents/{id}/pack` |
| Install one | Agent Studio → New agent → *…or install a task pack*, or `POST /api/packs/install` |
| Built-in packs | `python scripts/make_packs.py --out packs` — one per template with generators (10 today), each re-verified 100 % on install |
| Where | `FORGE_HOME/packs` (listed in the app), or any path on the machine |

Packs are for **synthetic** data. A pack declares `synthetic: true` and an intended use; installing asks you to confirm it
contains no patient, personal or confidential information.

## Reproducibility bundles — results anyone can recompute

A bundle holds everything needed to check a study's numbers: frozen plan and hash, tasks, seal record, **every raw episode**,
analyses, few-shot examples, forgetting report, training logs and adapter configs, quantization manifests and, optionally, the
adapter weights. `BUNDLE.json` records the FORGE version, engine source hash, environment and file hashes.

**Verify** checks every hash and the plan hash, then **recomputes every analysis from the raw episodes** with FORGE's own
(seeded, deterministic) statistics and compares gains, ranges and p-values with the stored report. Tests show that a single
changed measurement is caught even when the forger re-hashes the file. Verification does not re-train: reproducing training
needs the base model, the same hardware class and the library versions recorded in each `run.json`.

| | |
|---|---|
| Make | History → Reproducibility → *Make bundle*; `POST /api/studies/{id}/bundle`; `python -m forge.engine bundle --study <dir>` |
| Verify | History → Reproducibility → *Verify*; `POST /api/bundles/verify`; `python -m forge.engine bundle --verify <zip>` |

Export holds the study lock, so a running job cannot change a file between hashing and zipping.

## Sharing FORGE itself

FORGE installs from this folder with `scripts\setup.ps1 -WithML` (see README → Quick start). Share the folder (or a release
zip) plus any task packs; the recipient runs setup, downloads the student, starts LM Studio with a teacher, and either runs a
study in the app or the validation kit (docs/VALIDATION_KIT.md). Nothing leaves the machine: FORGE binds to 127.0.0.1.
