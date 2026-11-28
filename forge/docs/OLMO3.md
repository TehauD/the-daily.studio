# OLMo 3: teacher and student

FORGE's default chain is **all OLMo 3** (Allen Institute for AI): **OLMo 3 32B** writes the examples (teacher), **OLMo 3 7B
Instruct** learns the job (student). OLMo is fully open — weights, training data, training code and recipes are published —
which makes the lineage of a purpose-built model auditable end to end. Check each model card for its licence before use.

> **Confirm the exact names first.** Model ids below are how AI2 names them on Hugging Face (`allenai/Olmo-3-…`); this
> release was prepared without access to the Hub, so open https://huggingface.co/allenai and copy the exact id of the
> **7B Instruct** (student) and the **32B Instruct** — or **32B Think** if no 32B Instruct is listed — (teacher, as GGUF in LM Studio).

## Why these two, on a 16 GB GPU

| | Teacher: OLMo 3 32B | Student: OLMo 3 7B Instruct |
|---|---|---|
| Runs in | LM Studio (GGUF), only during **Collect** (and task writing if you choose the teacher) | FORGE (Hugging Face safetensors) |
| Memory | Q4_K_M ≈ 19–20 GB — more than 16 GB: LM Studio offloads part of it to system RAM (≥ 32 GB RAM; slower), or serve it on a bigger machine and add it as an OpenAI-compatible endpoint in **Settings → Endpoints** | Training: **4-bit base (QLoRA)** ≈ 10 GB at 3,072 tokens (estimate); bf16 would need ≈ 21 GB and is refused |
| Day to day | not needed | GGUF q4_K_M ≈ 4.5 GB, q8_0 ≈ 8 GB (LM Studio, CPU or a modest GPU) |

Prefer **Instruct** variants: *Think* variants write long reasoning before answering — FORGE strips it, but it costs time and
tokens on every example. A smaller footprint than 7B is still available with **Qwen3-1.7B** (bf16, ≈ 1–2 GB as GGUF).

## What FORGE does automatically for a 7B student

- **4-bit base**: the skill check turns on Turbo's *4-bit base (QLoRA)* for students above 4B parameters; in Experiment Studio
  tick **Turbo → 4-bit base**. The free-memory gate uses the 4-bit estimate (before v0.27 it always assumed bf16 and refused).
- **Same precision everywhere**: evaluation, the sealed final test, Playground, Weight Lab variants and Bench Lab load the base
  in 4-bit too when the study trained that way, so a 7B student fits 16 GB end to end. LoRA adapters stay 16-bit.
- **Original weights untouched**; the merged export (for GGUF) is written in bf16 on the CPU — allow ≈ 16 GB of system RAM.

## Set up

1. **Install / update FORGE's ML stack** (OLMo 3 needs `transformers` 4.57+; 4-bit needs `bitsandbytes`):
   ```powershell
   .\scripts\setup.ps1 -WithML
   ```
2. **Student**:
   ```powershell
   .\scripts\get-student.ps1 -Repo allenai/Olmo-3-7B-Instruct
   ```
3. **Teacher**: in LM Studio search "OLMo 3 32B", download a Q4_K_M GGUF, load it with as many GPU layers as fit, then
   Developer → **Start server**.
4. **Model Observatory → Run discovery**; mark OLMo 3 32B **teacher** and OLMo 3 7B **student**; run the pair check.

## First test

```powershell
.\scripts\skill-check.ps1 -Teacher "olmo-3-32b" -Student "Olmo-3-7B-Instruct" -Profile pilot -Seal
```

It prints `4-bit base (QLoRA): on`, runs every stage, unloads the teacher before training and reports trained vs untrained on
the sealed final test. See [SKILL_CHECK.md](SKILL_CHECK.md).

## What an open-data model adds in FORGE

- **Layer types**: Model Factory marks sliding-window vs full-attention layers and shows which type training changed more.
- **Base model lineage** in the model card: verified files vs the publisher's declared licence, base model and training data.
- **Seen in training?** (Is this a good test?): look the final-test questions up in an index of OLMo's published training data
  (Settings → Training-data index; copy the index name from AI2's infini-gram documentation for the OLMo 3 corpus).
- **Checkpoint timeline** (History): download OLMo 3 stage checkpoints (base, SFT, DPO, Instruct — separate repositories or
  revisions; `get-student.ps1 -Repo … -Revision …`), run discovery, and add them to the timeline to see where in OLMo's own
  training the skill appears, before your adapter.

## Validated here, and not

- **Validated (CPU, tiny model with the OLMo 3 architecture)**: discovery marks `Olmo3ForCausalLM` as trainable; LoRA training on
  all seven projection types across sliding-window and full-attention layers; base hash unchanged; real generation for
  evaluation; seal, final test; merged export as an `olmo3` checkpoint; weight microscope on its modules.
- **Not validated**: the real 7B and 32B weights, 4-bit training and inference (need CUDA + bitsandbytes), memory and speed on
  your GPU, OLMo 3's real chat template through FORGE's prefix-stability check (it runs automatically at Build), and whether
  OLMo 3 7B learns these skills — that is what the skill check measures.
