# FORGE — Local Model Intelligence & Agent Distillation Laboratory

Local-first research instrument for discovering, evaluating, fine-tuning, and distilling LLMs on one consumer NVIDIA GPU.

**Status: Phase 1 (Foundation) complete** — hardware observatory, model observatory with capability matrix, registry + roles, REST API, dashboard. Phase 2 data contracts (trajectories, datasets, experiments) are implemented and tested.

## Quick start (Windows)

```powershell
.\scripts\probe-host.ps1           # 0. Inspect the host (no installs). Writes forge-host-report.json
.\scripts\setup.ps1                # 1. venv + pinned deps + npm + tests + FORGE hardware report
.\scripts\launch.ps1               # 2. Build UI, serve UI + API at http://127.0.0.1:8765
.\scripts\launch.ps1 -Mode dev     #    or hot-reload: API :8765 + Vite :5173
.\scripts\setup.ps1 -WithML        # Phase 2-3: torch (cu128) + transformers/PEFT/TRL/smolagents/MLflow
```

Prerequisites: Python 3.12 (`winget install Python.Python.3.12`), Node.js LTS, current NVIDIA driver. Optional: Ollama, LM Studio.

## What Phase 1 does

| Capability | Implementation |
|---|---|
| Hardware discovery | `nvidia-smi` (VRAM, util, temp, power, compute cap, CUDA driver), psutil (CPU/RAM/disk), torch probed in a **subprocess** (API never holds a CUDA context) |
| Live telemetry | 2 s sampler that **stops itself** 60 s after the last viewer; missing sensors report `null` |
| Model discovery | Ollama (`/api/tags` + `/api/show`), LM Studio (filesystem GGUF + REST v0 / v1), HF hub cache, user directories, any OpenAI-compatible `/v1/models` |
| Exact metadata | Header-only GGUF and safetensors readers → exact parameter counts, quantization, context, license, chat-template tool support — no weights loaded |
| Capability matrix | `inference · lora · qlora · logits · tool_calling · gguf_export · ollama_deploy` — each `supported / conditional / unsupported / unknown` **with a reason** |
| Roles | Teacher requires supported inference; student requires LoRA/QLoRA trainability; pair-check reports behavioral vs. logit-KD eligibility |
| Memory planning | Analytic VRAM estimator + adaptive profiles from measured free VRAM; verdict `safe / tight / unsafe` |
| Security | Loopback bind enforced, Host-header allowlist (DNS-rebinding defense), path validation, remote endpoints opt-in, API keys referenced by env-var name only |

## Layout

```
backend/forge/
  config.py  db.py  util.py  logging_setup.py
  hardware/   probe.py · telemetry.py · profiles.py
  providers/  base.py · ollama.py · lmstudio.py · hf_cache.py · local_dir.py · openai_compat.py · formats.py · hf_config.py
  registry/   capabilities.py · registry.py · discovery.py
  domain/     trajectory.py · datasets.py · experiments.py      (Phase 2 contracts)
  security/   paths.py
  api/        app.py · routes_*.py
backend/tests/   67 tests — discovery, providers, capabilities, trajectories, datasets, experiments, security, API
frontend/src/    React + TS + Tailwind v4 + Recharts dashboard
scripts/         probe-host.ps1 · setup.ps1 · launch.ps1 · test.ps1
docs/            ARCHITECTURE.md · IMPLEMENTATION_PLAN.md · WSL2.md
```

State lives in `%LOCALAPPDATA%\Forge` (override: `FORGE_HOME`): `forge.db`, `datasets/`, `trajectories/`, `artifacts/`, `logs/forge.jsonl`.

## Data policy

No healthcare or patient data in experiments until separately approved. Use public/synthetic tasks for the first milestone.
