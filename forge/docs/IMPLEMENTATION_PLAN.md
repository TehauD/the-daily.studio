# Implementation Plan

## Phase 1 — Foundation ✅
- Delivered: repo, pinned deps, PowerShell setup/launch, hardware + telemetry, five discovery providers, capability matrix, roles, pair-check, memory estimator, API, dashboard, 67 tests.
- Exit criteria met: discovery runs with providers offline; no simulated data; loopback-only.

## Phase 2 — Experiments
- `chat()` on Ollama, LM Studio, OpenAI-compatible, and Transformers providers (native tool-calling where reported; JSON fallback otherwise).
- Teacher agent engine on smolagents `ToolCallingAgent`, wrapped by a FORGE recorder that emits `Trajectory` events.
- Built-in deterministic tools: calculator, JSON lookup over a fixture corpus, file read in scratch dir. Python/shell tools behind explicit confirmation.
- Task suites as versioned YAML (task_id, prompt, tools, expected answer, checker).
- Trajectory Explorer: timeline, attempt comparison, labeling, approval. Dataset Factory: build versions from approved trajectories.
- Exit: run N attempts per task, label, approve, emit `chat_sft` v1 with held-out split.

## Phase 3 — First training
- Job runner: separate process per job, heartbeat file, SIGINT-safe checkpointing, resume via `resume_from_checkpoint`.
- TRL `SFTTrainer` + PEFT LoRA/QLoRA; `assistant_only_loss`; config snapshot + dataset sha in run record.
- Pre-flight gate: estimator verdict `unsafe` blocks launch; `tight` requires confirmation.
- Calibrate the estimator with measured `torch.cuda.max_memory_allocated`.
- Adapter export + artifact lineage (parent model → dataset → adapter).
- Exit: LoRA on a ≤1.5B student completes, survives a forced interrupt and resumes.

## Phase 4 — Evaluation
- Same task suite on teacher, base student, and fine-tuned student, on the held-out split only.
- Metrics: completion, correctness (checker), tool selection, argument accuracy, multi-step success, hallucination rate, tokens, latency, peak VRAM.
- Paired comparison with bootstrap CIs; regression view against previous adapter versions.

## Phase 5 — Advanced research
- Logit KD (same-tokenizer pairs) with temperature-scaled KL; on-policy distillation (student samples, teacher scores).
- DPO from preference datasets; GRPO with programmatic rewards from task checkers; multi-agent experiments.

## First-milestone acceptance mapping

| # | Step | Phase | Component |
|---|---|---|---|
| 1 | Detect local model | 1 ✅ | Observatory |
| 2 | Register teacher + compatible student | 1 ✅ | Roles + pair-check |
| 3–4 | Run task with teacher, record trajectory | 2 | Agent engine + recorder |
| 5 | Score + approve | 2 | Trajectory Explorer (review model ✅) |
| 6 | Generate dataset | 2 | Dataset Factory (converter + store ✅) |
| 7–8 | LoRA fine-tune, export adapter | 3 | Training Lab + Model Factory |
| 9–11 | Base vs fine-tuned student on task, compare metrics | 4 | Evaluation Lab |
| 12 | Preserve artifacts + metadata | 1–4 | Experiment registry + artifacts ✅ |

## Recommended first-milestone pair
- Teacher: a tool-capable 7B instruct model in Ollama (e.g., a Qwen2.5-7B-Instruct tag).
- Student: the same family's 0.5B or 1.5B Instruct in HF format (`huggingface-cli download`) — matching tokenizer keeps logit KD open for Phase 5.
