# FORGE Turbo — your own training engine, measured

FORGE Turbo is a set of training optimizations you switch on per study. Each switch changes **how** training runs (speed,
memory), never **what** it learns from: same tasks, same teacher examples, same LoRA rank, seed and learning-rate schedule.
Whether a switch really leaves learning unchanged is measured, not assumed.

| Switch | What it does | Needs |
|---|---|---|
| Attention kernel | PyTorch fused attention (default) · FlashAttention 2 · reference | flash-attn for FA2 |
| Activation memory | recompute (default) · **CPU offload** (keep activations in CPU memory instead of recomputing) · keep (fastest, most memory) | — |
| Liger fused kernels | fused linear + cross-entropy (never materialises the full vocabulary logits), RMSNorm, RoPE, SwiGLU | liger-kernel, GPU |
| 4-bit base (QLoRA) | frozen model in 4-bit NF4, adapters in 16-bit — larger students on 16 GB | bitsandbytes, GPU |
| 8-bit optimizer | paged 8-bit AdamW state | bitsandbytes, GPU |
| Padding-free packing | several short examples per row, isolated by position ids | FlashAttention 2, micro-batch > 1 |
| torch.compile | compiled model graph; slow first steps | GPU |

Install the optional packages with `.\scripts\setup.ps1 -WithML -WithTurbo` (non-fatal: a package that does not install
leaves its switch unavailable, and FORGE says why). FlashAttention rarely has Windows wheels; PyTorch's fused attention is
used instead.

## Compare engines on the same data

Training Lab → **FORGE Turbo** → *Re-train this study with other settings*. FORGE creates a clone that reuses the source
study's tasks, frozen agent and teacher examples byte for byte; only the Turbo switches and the micro-batch / accumulation
split may change (the effective batch is kept). Run Build → Train → Evaluate · dev → Analyze · dev on the clone; the panel
shows every engine side by side — wall time, tokens/s, peak VRAM, GPU energy, final loss, dev success — with the training
loss curves overlaid. Overlapping curves mean the switch changed speed, not learning.

Notes: QLoRA trains against a 4-bit base; FORGE evaluates every adapter on the bf16 base, the standard practice, so expect
small differences. One seed per engine: small differences in success are noise.
