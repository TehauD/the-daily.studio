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
