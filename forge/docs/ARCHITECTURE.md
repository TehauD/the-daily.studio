# FORGE Architecture

## Layering

| Layer | Responsibility | Never does |
|---|---|---|
| **Providers** | Discover models; (Phase 2) `chat()` inference | Write to the DB, decide trainability |
| **Registry** | Persist models, compute capabilities, assign roles | Network calls |
| **Hardware** | Measure; estimate memory; derive profiles | Simulate values |
| **Domain** | Trajectory / dataset / experiment contracts | Import ML frameworks |
| **Jobs** (Phase 3) | Training/eval workers in **separate processes** | Run inside the API process |
| **API** | Thin FastAPI routing + validation | Business logic |
| **UI** | Render measured state | Fabricate metrics |

Why: the API process stays light (~60 MB) and never holds GPU memory, so the GPU budget is entirely available to training jobs. Crashing workers cannot corrupt API state.

## Provider contract

```python
class ModelProvider(ABC):
    name: str
    async def discover(self) -> ProviderResult           # Phase 1
    async def chat(self, messages, tools, settings) -> AssistantTurn   # Phase 2
```

- Providers run concurrently with per-provider timeouts; one failure never blocks others.
- Offline provider ⇒ its models become `provider_offline` (not deleted). Successful scan that no longer sees a model ⇒ `missing`.
- Model ID = `sha1(provider | locator)` — stable across runs and renames of display names.

## Capability rules (conservative by design)

- **LoRA supported** only when: HF format, all shards present, download complete, `*ForCausalLM`, `model_type` known to the installed transformers, no `trust_remote_code`.
- **QLoRA** additionally needs CUDA visible to torch + bitsandbytes; pre-quantized checkpoints (GPTQ/AWQ) are excluded.
- **GGUF / Ollama / remote endpoints:** never trainable. Fine-tuning needs the original HF weights.
- **Logit KD** eligible only when both models expose full logits **and** vocab sizes match; otherwise behavioral (sequence-level) distillation.

## Data model (SQLite, WAL)

`models · model_roles · discovery_runs · experiments · runs · artifacts · trajectories · datasets · settings` — forward-only migrations in `db.py`.

## Reproducibility guarantees

- Experiment config hashed canonically (key-order independent) at creation; immutable.
- Run state machine: `pending → running → completed | failed | cancelled | interrupted`. Startup converts orphaned `running` to `interrupted`; resume creates a new attempt pointing to the last checkpoint.
- Dataset versions are written to a staging dir then atomically renamed; never overwritten; sha256 per split; provenance sidecar maps every record to trajectory IDs + content hashes.
- Held-out split is by **task_id hash** → no task leaks between train and eval.
- Artifacts: sha256 (directory digests are content-addressed), unique paths, parent lineage chain.

## Trajectory policy

- Captured: system/user/assistant messages, tool calls + arguments, tool results, timestamps, token usage, latency, termination reason, evaluation, review.
- Not captured: hidden chain-of-thought. `<think>` blocks and `reasoning_content` are stripped at ingest; `reasoning_stripped=true` records that it happened.

## Security

- Bind `127.0.0.1` enforced; `FORGE_ALLOW_REMOTE_BIND=1` is an explicit override.
- `TrustedHostMiddleware` rejects foreign Host headers (DNS rebinding).
- All user paths: absolute, existing, no UNC/device namespace, no NUL, symlink-aware containment via `safe_join`.
- HTTP clients use `trust_env=False` — local model traffic never routes through a corporate proxy.
- Phase 2 tool sandbox: Python/shell tools require per-run explicit confirmation; executed in a subprocess with a scratch working dir, timeout, and no inherited secrets.

## Future state

- Event-driven: discovery on filesystem change (watchdog) and Ollama pull events.
- Continuous evaluation: every new adapter auto-runs the held-out suite and posts a regression diff.
- MLflow as an optional mirror of FORGE's experiment registry (FORGE's SQLite remains the system of record).
