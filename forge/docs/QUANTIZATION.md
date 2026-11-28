# Quantization Lab — make your own quantized variants and measure them

A quantized model is a new model. FORGE treats each variant as an **arm** of the study: it answers the same practice tasks
(and, after SEAL, the same final test) as the unquantized student, and is judged by behaviour, not by file size or error
statistics alone. Variants are immutable, carry a manifest with file hashes, and are calibrated on the **training split only**
— practice and final-test prompts never reach a calibrator (checked by `tests/test_quant.py`).

Source: the study's merged export (`exports/<arm>-seed<seed>-merged`, Export stage). Backend: `forge/quant/`,
API `/api/studies/{id}/quant`, CLI `python -m forge.engine quant …`, screen **Package → Quantization Lab** (size-vs-accuracy frontier with ranges, variants table with agreement, McNemar and measured speed, per-layer error map, recipes, served-model measurement).

## Three runtimes, one measurement

| Runtime | Methods | Where it runs | How FORGE measures it |
|---|---|---|---|
| **FORGE reference** | `ref_w8`, `ref_w4`, `ref_w4_aware`, `ref_w3_aware` (group 64) | inside FORGE, CPU or GPU | loads the variant directly |
| **LM Studio / llama.cpp (GGUF)** | `Q8_0`, `Q4_K_M` + importance matrix, `IQ4_XS` + importance matrix | your llama.cpp tools | LM Studio check on the sealed test |
| **vLLM (compressed-tensors)** | FP8 dynamic, W8A8 int8 (SmoothQuant + GPTQ), W4A16 GPTQ, W4A16 AWQ | llm-compressor in a separate env | *Measure a served model* (loopback OpenAI-compatible endpoint) |

### FORGE reference quantizer (transparent, exact per-layer error)
Symmetric per-group integer rounding of each linear layer's weights: `scale = max|w| / (2^(b−1) − 1)`,
`ŵ = round(w / scale) · scale`. The *activation-aware* variant (after AWQ) measures mean |activation| per input channel on
training prompts and, per layer, picks the exponent α of the channel scale `s = a^α` that minimises output-weighted error.
Embeddings, output head and norms stay 16-bit; untouched tensors are bit-identical copies.

Output is **simulated** quantization: the checkpoint holds the exact quantized values in the source dtype, so any runtime
evaluates the quantized *behaviour*, but it is not smaller or faster on disk. The reported size is an estimate
(`bits + 16/group` effective bits). Real size and speed come from the GGUF and vLLM paths. Per-layer error (relative error,
SQNR, output-weighted error, chosen α) is available for every module.

### GGUF (LM Studio)
Study → Export → GGUF uses your own llama.cpp build (`FORGE_LLAMA_CPP`). With *importance matrix* on, FORGE writes
calibration text from the training split, runs `llama-imatrix`, then `llama-quantize --imatrix`; the manifest records it.

### vLLM
Quantization Lab → recipe (`GET /api/studies/{id}/quant/recipe?method=…`) writes `quant/recipes/calibration.jsonl` and a spec,
and gives the steps. llm-compressor needs a newer `transformers` than FORGE pins, so run `scripts/quant_llmc.py` from a
separate virtual environment; it records library versions and file hashes in `forge_quant.json`. Serve the result with vLLM on
this machine, then register it (`POST …/quant/served`, loopback endpoints only) and FORGE evaluates it.

## What the Lab reports
Per variant and split: strict success with Wilson range, agreement with the unquantized student task by task, and McNemar's
test against it; size (estimated or measured) against the bf16 size. Test results only after SEAL.

## Not done / not claimed
- vLLM and llama.cpp paths were **not executed** in the development sandbox (no GPU, no third-party binaries run there);
  their FORGE-side plumbing is tested with stand-in backends. Validate on your machine before relying on them.
- Reference variants measure accuracy, not speed.
- Synthetic tasks only; no clinical validity or deployment readiness is claimed.
