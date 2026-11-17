# FORGE — Local Distillation Lab (v0.5)

A local-first research instrument for **teacher → student LLM distillation on one consumer NVIDIA GPU**.
A large model you run in LM Studio (the teacher) solves tool-use tasks; its *verified* trajectories train a
small Hugging Face model (the student) with LoRA; FORGE then measures — with paired statistics and
confidence intervals — whether the student actually improved, where, why, and at what cost.

**One product, one backend, one UI, one port** (`127.0.0.1:8765`). The research engine runs inside FORGE as
separate job processes; the API never imports torch.

## Run order (Windows, PowerShell)

```powershell
.\scripts\probe-host.ps1                 # 0. inspect the host — installs nothing
.\scripts\setup.ps1 -WithML              # 1. project .venv (Python 3.12), torch 2.14.1+cu126, pinned stack, tests
.\scripts\verify-gpu.ps1                 # 2. BF16 forward/backward on CUDA
.\scripts\verify-gpu.ps1 -Student <snapshot-dir>   #    optional: 2-step LoRA + dev eval on the GPU
.\scripts\launch.ps1                     # 3. build UI, serve UI + API on 127.0.0.1:8765
```

Then in the UI: **Observatory** (discover → Hub tab for a student → set roles → Pair builder) →
**Experiment Studio** (new smoke study → Collect → Build → *unload teacher* → Train → Eval · dev →
Analyze · dev → SEAL → Eval · test → Analyze · test) → **Evaluation Lab** / **Trajectory Explorer**.

Every script resolves `backend\.venv\Scripts\python.exe` explicitly and prints it (the global
`C:\Python312` has CPU-only torch and is never used). State lives in `%LOCALAPPDATA%\Forge` (`FORGE_HOME`).

## What is in v0.5

| Area | Delivered |
|---|---|
| Discovery | Ollama, LM Studio (files + REST, slug-matched — no duplicate rows), HF cache, folders, OpenAI-compatible endpoints; header-only GGUF/safetensors readers |
| Eligibility | Model kind (generative / encoder / embedding / vision / speech / seq2seq); non-generative models inventoried but hidden and role-ineligible; per-role checklists incl. license |
| Parameters | Stored vs. unique vs. non-embedding counts; tied `lm_head` duplicates detected (the Qwen3-1.7B "2.03B vs 1.7B" question) |
| Hub | Search, metadata-only inspection (remote safetensors headers), `snapshot_download(allow_patterns)` + shard verification, outbound call shown in UI |
| Pair-check | Capacity ratio, tool templates, VRAM estimate (exact GQA LoRA counts), behavioral vs. logit-KD, one-GPU warning |
| Engine | Seeded synthetic catalog tasks (lookup, multi-step quote, missing item, OOD wording, extraction regression), group-level splits, strict JSON action protocol, hidden-reasoning stripping |
| Datasets | Per-turn records, completion-only loss mask, exact token-prefix assertion, no truncation, shared eligible ids across arms, nested quarter subset, provenance hashes |
| Training | Transformers `Trainer` + PEFT LoRA (r16/α32, all-linear, bf16, grad-ckpt); pre-flight gates (CUDA, BF16, single GPU, free VRAM, teacher unloaded), zero-adapter logit equality, LoRA-only trainable, base hash before = after, resume, exact token exposure |
| Studies | Frozen + hashed plan; ordered stages; study lock; resumable SHA-256-per-line JSONL; SEAL; backend errors abort a stage instead of becoming data |
| Statistics | Seed × group paired matrix, crossed bootstrap (percentile, not BCa), exact/MC sign-flip, McNemar (diagnostic), Holm, power planner, review gate |
| Visualization | Path graph, three-lane path comparison with first divergence, skill map, forest plot, lineage, adapter heat strip + singular spectrum, learning curves, telemetry |
| UI | 10 pages, light default + dark/system, 5 accents, density/contrast/text-scale/radius/grid/motion, command palette (Ctrl K), provenance chip on every measurement, 390 px layout |
| Security | Loopback bind, Host allowlist, per-session token on mutations, port pre-flight with PID, loopback-only runtime overrides, path confinement, `trust_remote_code=False`, `local_files_only=True` |

Deferred until after the MVP: QLoRA, the six-seed research run in practice, logit KD, DPO/GRPO,
multi-agent tasks, GGUF export / Ollama deployment.

## Claims FORGE never makes

Broad reasoning transfer · clinical validity · deployment readiness · causal speed-ups across backends ·
"visualized chain of thought". A passing review gate means *candidate for human review*.

## Layout

```
backend/forge/  config db util logging_setup readiness
  hardware/ providers/ (…, hf_hub) registry/ (…, roles)   engine/ (tasks runtime datasets train statistics study __main__)
  graphs/ (paths lineage)  analysis/ (adapters)  jobs/ (runner)  domain/ (v0.1 contracts)  security/  api/
backend/tests/   136 tests
frontend/src/    lib/ components/ pages/ pages/guide/
scripts/         probe-host setup verify-gpu get-student launch test (+ _venv helper)
docs/            ARCHITECTURE  RESEARCH_PROTOCOL  FIRST_RUN  VALIDATION  WSL2
```

See **docs/VALIDATION.md** for exactly what has and has not been executed.
