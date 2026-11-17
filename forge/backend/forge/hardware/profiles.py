"""Training memory estimation and adaptive profiles.

The estimator is an analytic upper-bound model (weights + LoRA optimizer state
+ activations + logits + runtime overhead). It is deliberately conservative:
FORGE prefers refusing a job that would have fit over OOM-crashing a desktop.
Expected accuracy is roughly ±25%; Phase 3 calibrates it against measured peaks.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

Quant = Literal["bf16", "int8", "nf4"]
BYTES_PER_WEIGHT: dict[str, float] = {"bf16": 2.0, "int8": 1.05, "nf4": 0.56}  # incl. quant constants
CUDA_OVERHEAD_MB = 900  # context + cuBLAS workspaces + allocator reserve
FRAGMENTATION = 1.10

# Reference transformer shapes (Qwen2.5-family) used when a model's config is unknown.
REFERENCE_SHAPES = {
    0.5: dict(hidden=896, layers=24, intermediate=4864, vocab=151936),
    1.5: dict(hidden=1536, layers=28, intermediate=8960, vocab=151936),
    3.0: dict(hidden=2048, layers=36, intermediate=11008, vocab=151936),
    7.0: dict(hidden=3584, layers=28, intermediate=18944, vocab=152064),
    14.0: dict(hidden=5120, layers=48, intermediate=13824, vocab=152064),
    32.0: dict(hidden=5120, layers=64, intermediate=27648, vocab=152064),
}


@dataclass
class EstimateInput:
    params_b: float
    quant: Quant = "nf4"
    lora_rank: int = 16
    target_all_linear: bool = True
    seq_len: int = 2048
    micro_batch: int = 1
    grad_checkpointing: bool = True
    hidden: int | None = None
    layers: int | None = None
    intermediate: int | None = None
    vocab: int | None = None
    num_heads: int | None = None
    num_kv_heads: int | None = None
    head_dim: int | None = None


def lora_param_count(hidden: int, layers: int, intermediate: int, rank: int, all_linear: bool = True,
                     num_heads: int | None = None, num_kv_heads: int | None = None, head_dim: int | None = None) -> dict:
    """Exact LoRA parameter count for a Llama/Qwen-style block (r·(in+out) per adapted matrix).

    With GQA, k_proj/v_proj project to num_kv_heads·head_dim (smaller than hidden), and q/o use
    num_heads·head_dim, which can differ from hidden (Qwen3 sets head_dim explicitly).
    """
    nh = num_heads or max(1, hidden // (head_dim or 128))
    hd = head_dim or hidden // nh
    kv = num_kv_heads or nh
    q_out, kv_out = nh * hd, kv * hd
    per = {"q_proj": rank * (hidden + q_out), "k_proj": rank * (hidden + kv_out), "v_proj": rank * (hidden + kv_out),
           "o_proj": rank * (q_out + hidden)}
    if all_linear:
        per |= {"gate_proj": rank * (hidden + intermediate), "up_proj": rank * (hidden + intermediate),
                "down_proj": rank * (intermediate + hidden)}
    return {"per_layer": per, "per_layer_total": sum(per.values()), "total": sum(per.values()) * layers,
            "exact": num_heads is not None and num_kv_heads is not None}


@dataclass
class Estimate:
    weights_mb: float
    lora_params: int
    trainable_state_mb: float
    activations_mb: float
    logits_mb: float
    overhead_mb: float
    total_mb: float
    available_mb: float | None
    utilization: float | None
    verdict: Literal["safe", "tight", "unsafe", "no_gpu"]
    notes: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


def _shape(inp: EstimateInput) -> dict:
    if inp.hidden and inp.layers:
        return dict(hidden=inp.hidden, layers=inp.layers,
                    intermediate=inp.intermediate or int(inp.hidden * 3.5), vocab=inp.vocab or 32000)
    nearest = min(REFERENCE_SHAPES, key=lambda k: abs(k - inp.params_b))
    return REFERENCE_SHAPES[nearest]


def estimate_lora_memory(inp: EstimateInput, available_vram_mb: float | None) -> Estimate:
    notes: list[str] = []
    sh = _shape(inp)
    if not (inp.hidden and inp.layers):
        notes.append(f"Model shape unknown; used reference shape for ~{min(REFERENCE_SHAPES, key=lambda k: abs(k - inp.params_b))}B.")
    h, L, i, v = sh["hidden"], sh["layers"], sh["intermediate"], sh["vocab"]
    r = inp.lora_rank

    weights_mb = inp.params_b * 1e9 * BYTES_PER_WEIGHT[inp.quant] / 2**20

    lc = lora_param_count(h, L, i, r, inp.target_all_linear, inp.num_heads, inp.num_kv_heads, inp.head_dim)
    lora_params = lc["total"]
    if not lc["exact"]:
        notes.append("Head layout unknown; k/v assumed full-width (upper bound on LoRA parameters).")
    # fp32 master weight (4) + grad (4) + AdamW m,v (8) = 16 B / trainable param
    trainable_state_mb = lora_params * 16 / 2**20

    bytes_act = 2  # bf16 activations
    tokens = inp.micro_batch * inp.seq_len
    if inp.grad_checkpointing:
        # stored layer boundaries + one layer's full recompute footprint (~34·h per token with SDPA)
        act = tokens * h * L * bytes_act + tokens * 34 * h * bytes_act
    else:
        act = tokens * 34 * h * L * bytes_act
        notes.append("Gradient checkpointing disabled: activation memory scales with layer count.")
    activations_mb = act / 2**20

    # Logits are upcast to fp32 for the loss; ×2 for the gradient of the logits.
    logits_mb = tokens * v * 4 * 2 / 2**20
    if logits_mb > 1024:
        notes.append("Large-vocabulary logits dominate; reduce seq_len or micro_batch before rank.")

    subtotal = weights_mb + trainable_state_mb + activations_mb + logits_mb
    total = subtotal * FRAGMENTATION + CUDA_OVERHEAD_MB

    if available_vram_mb is None or available_vram_mb <= 0:
        return Estimate(weights_mb, lora_params, trainable_state_mb, activations_mb, logits_mb,
                        CUDA_OVERHEAD_MB, total, None, None, "no_gpu",
                        notes + ["No CUDA GPU detected; GPU training is unavailable."])
    util = total / available_vram_mb
    verdict = "safe" if util <= 0.80 else "tight" if util <= 0.95 else "unsafe"
    if inp.quant == "nf4":
        notes.append("QLoRA requires bitsandbytes with CUDA.")
    return Estimate(round(weights_mb, 1), lora_params, round(trainable_state_mb, 1), round(activations_mb, 1),
                    round(logits_mb, 1), CUDA_OVERHEAD_MB, round(total, 1), available_vram_mb, round(util, 3), verdict, notes)


def adaptive_profiles(vram_free_mb: float | None, vram_total_mb: float | None) -> dict:
    """For each reference size × method, report the verdict and a recommended seq_len."""
    if not vram_total_mb:
        return {"gpu": False, "profiles": [], "summary": "No CUDA GPU detected. Inference via Ollama/LM Studio only; training disabled."}
    budget = vram_free_mb or vram_total_mb
    rows = []
    for size in REFERENCE_SHAPES:
        for method, quant in (("lora", "bf16"), ("qlora", "nf4")):
            best = None
            for seq in (4096, 2048, 1024, 512):
                est = estimate_lora_memory(EstimateInput(params_b=size, quant=quant, seq_len=seq), budget)
                if est.verdict == "safe":
                    best = (seq, est)
                    break
            rows.append({"params_b": size, "method": method, "fits": best is not None,
                         "max_safe_seq_len": best[0] if best else None,
                         "est_total_mb": best[1].total_mb if best else None})
    largest = {m: max((r["params_b"] for r in rows if r["method"] == m and r["fits"]), default=None) for m in ("lora", "qlora")}
    return {"gpu": True, "budget_mb": budget, "profiles": rows, "largest_safe": largest,
            "summary": f"Largest safe student: LoRA ≤ {largest['lora']}B, QLoRA ≤ {largest['qlora']}B (reference shapes, micro_batch=1, grad checkpointing)."}
