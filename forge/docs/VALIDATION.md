# Validation report — v0.5

Environment where validation ran: Linux container, **no GPU**, Python 3.12, torch 2.15.0 (CPU execution),
transformers 4.53.2, PEFT 0.16.0, Node 22, Chromium (Playwright). Hugging Face Hub was **not reachable** (proxy).

## Executed and passing

| What | Result |
|---|---|
| Backend test suite | **136 passed** (67 v0.1 baseline + 69 new) in ~33 s |
| Statistics known values | McNemar 18/6 → p = 0.0227; Holm; exact sign-flip resolution (3 units → 0.25, 6 → 2/64); zero-effect CI = [0, 0]; power formula; pairing integrity errors |
| Adapter math | σ from QR core = dense SVD (rtol 1e-9); ‖ΔW‖_F, relative change vs BF16 base, effective rank |
| §10 regressions | async telemetry starts sampler; CUDA banner + `-q` parse; LM Studio publisher-namespaced ids → no duplicates; GGUF 36/37/38 → TQ1_0/TQ2_0/MXFP4; encoder/vision/speech excluded; port conflict exits 3 before DB init; `charset=utf-8`; NumPy readiness; interpreter path reported; tied-lm_head parameter report; session token required |
| Real training code path (CPU) | `test_e2e_cpu`: tiny Qwen3-architecture model built offline; real `Trainer` + PEFT; pre-flight; zero-adapter max \|Δlogit\| = 0; LoRA-only trainable; base hash before = after; adapter save + inspection; resume no-op; real `generate` evaluation; SEAL; test eval; merged export + post-merge re-eval |
| Real tokenizer prefix assertion | Byte-level BPE with the Qwen2/3 pre-tokenizer pattern and a Qwen3-style template: every record prefix-stable; `<|im_end|>` supervised |
| Full MVP loop over HTTP | Real server + built UI on one port; mock LM Studio (`forge-mock/oracle-teacher`, oracle answers with deliberate errors, `<think>` and fenced outputs); discovery → roles (encoder refused) → pair-check → study → collect → build → train (150 steps, CPU) → eval/analyze dev → SEAL (wrong confirm 422, train after seal 409) → eval/analyze test → export. 2 min 12 s |
| Frontend | `tsc --noEmit` clean; production build OK (main chunk 228 KB) |
| Browser smoke | 10 pages × light/dark rendered, **0 console errors**; theme toggle; command palette; trajectory selection + path comparison; **no horizontal overflow at 390 px** on any page |

### Defects found by this validation and fixed
- Student generation passed `token_type_ids` to `generate` (crash) — and backend errors were being **recorded as model
  failures**. Fixed: only `input_ids`/`attention_mask` are passed, and a backend error now aborts the stage.
- `/compare` route raised 500 (missing argument). Fixed, with an API regression test.
- 390 px overflow on Guide and Factory; Observatory detail placement; forest-plot text scaling; lineage label. Fixed.

### What the wiring run showed (not a result)
The random-weight 115K-parameter student did not learn the task: strict success 0% before and after; training loss
6.44 → 5.87, dev loss 6.24 → 5.88; tuned outputs changed from blank lines to JSON-shaped but invalid text. Two arms
trained on byte-identical canonical supervision produced byte-identical adapters (determinism check).

## NOT validated — requires your machine
- **Any CUDA execution**: BF16, VRAM gates, peak-memory telemetry, real throughput, OOM behavior. Run `verify-gpu.ps1 -Student …`.
- **Qwen3-1.7B itself**: tokenizer/template prefix stability on the real tokenizer, memory at seq 2048, and whether a pilot
  study produces a gain. The parameter-report logic predicts stored 2.03B = unique ~1.72B + a duplicated 311M tied `lm_head`; unconfirmed on the real files.
- **LM Studio integration**: real teacher responses, REST v0 state reporting, slug matching on your exact folders.
- **Hugging Face Hub**: search/inspect/download were tested only against mocks (network blocked here).
- **PowerShell scripts**: not executed (no PowerShell in the container). Review on first run.
- **Windows specifics**: `SO_EXCLUSIVEADDRUSE`, PID lookup for port conflicts, `CREATE_NO_WINDOW` job spawning, path rules.
- Firefox/Safari rendering; screen-reader pass.

## Known limitations
- Teacher episodes are collected once (seed 0, temperature 0); seeds vary only training.
- Base control is evaluated once and explicitly broadcast across seeds (deterministic greedy decoding).
- The memory estimator is an analytic upper bound (±25%) until calibrated against measured peaks.
- FORGE cannot load/unload LM Studio models; you do that between collect and train.
- QLoRA, logit KD, DPO/GRPO, GGUF export are deferred.

## v0.6 additions (Knowledge Graph, token projection, wide-screen workspaces)

| What | Result |
|---|---|
| Knowledge graph builder + GraphML export | Tested on empty and evaluated studies; node/edge counts match GraphML |
| Token projection | Planted-direction test recovers the planted token far outside the vocab spread (\|z\| > 10); chunked reads equal full reads; tied-embedding fallback exercised on the tiny Qwen3; **1.3 s** at Qwen3-1.7B scale (151,936 × 2,048 BF16, 8 directions), cached per adapter hash + format version |
| Wide-screen layout | Browser check: Overview, Observatory, Studio, Trajectories, Evaluation, Knowledge Graph **fit without page scroll** at 1600×900, 1920×1080, 2560×1440; screens below 1600×760 scroll normally; no overflow at 390 px; 0 console errors |
| Backend suite | 147 passed |

Not validated: projection output on a real trained Qwen3-1.7B adapter (only tiny/synthetic adapters here); whether its token lists are informative for your study is an empirical question.

## v0.6.1 fixes (from a real Windows/RTX run)

| Defect | Fix | Verified here |
|---|---|---|
| Live job log reset in a loop ("flashing"): the parent re-created the completion callback each poll and it was an effect dependency | callback read via ref; log resets only on job change; append-only lines with stable keys and a fade-in on arrival; progress header (stage, episode bar, s/episode, ETA, latest step) | Browser: 60 samples at 250 ms during a live collect, line count never decreased |
| "Invalid Date" on training log lines (ISO `ts` overwrote the numeric one) | event stream keeps numeric `ts`; viewer accepts both | Test asserts numeric `ts` on child-process log events |
| tqdm bars and Trainer dict prints flooded the log | `disable_tqdm=True`, PrinterCallback removed, residual noise filtered | Test asserts no `%\|` in output |
| Second arm failed free-VRAM gate (11,631 < 12,000 MB): first run's CUDA context/caches still held in the same process | each arm × seed trains in its own child process on CUDA; gc + empty_cache around runs; gate counts FORGE's own cached memory | Isolated 2-seed run on CPU; **not yet re-run on your GPU** |
| Fixed 12 GB gate too close to idle free VRAM on a 16 GB desktop GPU | new studies: gate = analytic estimate × 1.1 (≥ 2 GB), basis frozen in the plan (Qwen3-1.7B @ 2048 → 8,960 MB) | API test |
| Run button shown on a running stage | hidden while running | — |

Backend suite: 148 passed.

## v0.7.0 — Knowledge Studio (doc-QA on your own documents)

A guided five-step workflow (add documents → make searchable → practice questions → teach → results) that turns a folder of
txt/md/rst/html/pdf into a *knowledge pack*, then into a doc-QA study the existing engine collects, trains, and evaluates.

| Check | Result here |
|---|---|
| Ingest + chunking (FORGE's own docs as sample corpus) | 5 documents → 35 passages, content hashes recorded |
| Keyword (BM25) + meaning (embeddings) hybrid index, RRF fusion | built through the UI; search playground returns ranked passages with keyword/meaning ranks |
| Teacher-written questions with verification (answer verbatim in passage, self-contained, no leakage; unanswerable questions verified as unanswerable) | 23 accepted / 12 rejected, every rejection carries its reason |
| Document-level splits (no passage of a dev/test document is ever trained on) | asserted in tests |
| Doc-QA scoring: strict success requires the reference span **and** that the gold passage was retrieved; unanswerable requires a search then `NOT_FOUND` | unit tests + 7 dev episodes inspected in Trajectory Explorer |
| Study `docqa` through collect → build → train (tiny CPU student) → evaluate_dev → analyze_dev | completed end to end via UI and API |
| UI: all five steps at 1600/1920/2560 px wide fit without page scroll; 390 px no horizontal overflow; console errors | fits / none / none |
| Backend suite | 154 passed |

Fixed during this validation: Segmented controls took their accessible name from the wrapping label (each option now has its own);
a freshly created study could be replaced by a stale selection; the Teach step created CUDA studies on a CPU-only machine (device now
follows readiness); the pack detail endpoint returned a different shape than the list (contract test added); overlength records now
explain the fix (larger max sequence length or smaller passages) — nothing is ever truncated.

**Not validated — requires your machine:** real LM Studio embedding models and the real teacher's question quality (a deterministic
mock served both here); lesson lengths under the Qwen tokenizer (sequence-length gate worked with the test tokenizer at 4096);
any GPU training on doc-QA; whether a 1.7B student actually learns your documents — the measured numbers here (base 0 / tuned 0 /
teacher 0.86 strict on dev) come from a tiny random-weight model and say nothing about real capability.
Synthetic or non-sensitive documents only: no PHI or patient data.

## v0.8.0 — Distillation Lens, skill-targeted studies, embedding map

| Feature | What it measures | Checked here |
|---|---|---|
| **Focus skills** (study wizard; Knowledge Studio "What should it get better at?") | Training data restricted to chosen skills (`outside_focus_skills` exclusion counted); evaluation still covers every skill; analysis adds separate *focus* and *off-focus* contrasts; the focus contrast is the preregistered primary for the review gate, off-focus enters Holm as secondary | Unit tests (unknown / regression-only skills refused; all skills = no focus); CPU study: 30 records all from the focus skill, 20 episodes excluded; focus and off-focus contrasts present |
| **Training snapshots** | Adapter weights only (no optimizer state) every ⌈total/5⌉ steps; eval cadence aligned | 4 snapshots + final on a 60-step run (704 KB on the tiny model; ≈ 35 MB each for Qwen3-1.7B r16 in bf16 — estimate) |
| **Distance to the teacher** | Teacher-forced NLL per teacher action token and top-1 agreement on dev teacher episodes (balanced across skills, ≤ 40), for base, every snapshot, final | Tiny CPU model: 6.42 → 6.35 → 6.27 → 6.21 → 6.19 → 6.19 nats; agreement flat at 1.5 % (a random-weight model — wiring only) |
| **Word heatmap** | Per token log p under base vs final adapter; tokens most / least gained (≥ 2 occurrences) | Decoded pieces reassemble the teacher action text (test); top gains on the tiny model were JSON structure and `<\|im_end\|>` |
| **Skill space** | Strict success per skill: teacher, base, every arm × seed, gap closed = (tuned − base)/(teacher − base) | API + UI; descriptive only (intervals stay in Evaluation Lab) |
| **Map of meaning** | PCA of passage embeddings with questions projected in; neighbour preservation (k=10) and explained variance reported; per question the student's real hybrid search top-k and the true cosine rank of the right passage | 35 passages / 23 questions: 67 % found, neighbour preservation 54 %, 14 % variance on two axes (mock embeddings) |
| UI | Lens fits 1920×1080 without page scroll, no horizontal overflow at 390 px, no console errors; light and dark | yes |
| Backend suite | | 157 passed |

**Not validated — requires your machine:** lens runtime and memory on Qwen3-1.7B (one forward pass per teacher turn per snapshot;
expected seconds to a few minutes on a 16 GB GPU — not measured); snapshot sizes on real adapters; whether real training shows
the falling curve and per-skill gains (the tiny model here barely learns, so its skill space is flat at 0 %); map quality with a real
embedding model (the mock's bag-of-words vectors cluster questions artificially). Studies trained before v0.8 have no snapshots:
their curve has two points (before / after).

The lens shows which teacher tokens the student learned to expect under teacher forcing. It does not show why, it is not task
success, and it does not visualize reasoning.
