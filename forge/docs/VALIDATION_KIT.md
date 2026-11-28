# Validation kit — does distillation work for our skills, on our hardware?

One command produces the evidence a reviewer needs: a preregistered design, a negative control, a prompting baseline, the
sealed final test, a forgetting check, optional quantization, and a verified reproducibility bundle with a written report.

```powershell
.\scripts\launch.ps1                                   # FORGE (one window)
# LM Studio: start the server and load the teacher (e.g. OLMo 3 32B)
.\scripts\validate.ps1 -Teacher "olmo-3-32b" -Student "Olmo-3-7B-Instruct" -YesSeal -Quant
```

(`python scripts/validate.py --help` on any OS.) **In the app:** Pipeline → *Run everything that's left* runs the same steps for an
existing study as one resumable job, with a live checklist (it stops before SEAL unless you type SEAL). If a stage fails — LM Studio not running, out of memory — fix it and continue
with `-Resume study_…`; finished stages are not repeated, and episodes resume from the last recorded task.

## What it runs

| step | what | why |
|---|---|---|
| 0 preflight | FORGE version, GPU, teacher and student found; blockers listed | a failed run should fail early |
| 1 tasks | template agent (synthetic) → verified practice tasks, or `-Pack` a task pack | same tasks anyone can rebuild |
| 2 design | research profile (6 seeds), `teacher_filtered` + `shuffled_control`, few-shot baseline (k=3), **power analysis frozen into the plan** (`-CalibrateFrom` a pilot) | decided before any result exists |
| 3 run | collect → build → train → practice eval → analysis → **SEAL** → final test → analysis | the final test is touched once |
| 4 checks | forgetting check, test adequacy, evidence verdict, training vs prompting | |
| 5 quantize (`-Quant`) | verified export; W8 and W4 activation-aware variants measured on the final test | cost of a smaller footprint |
| 6 record | reproducibility bundle, **verified** by recomputation; `validation/<study>/VALIDATION.md` + `validation.json` | something to hand to a reviewer |

## Recommended sequence

1. **Pilot** (3 seeds, ~1–2 h on a 16 GB GPU for a 7B student): `-Profile pilot -YesSeal`. Read Evidence; note the gain and
   its spread. A pilot's final test is used, so its result is exploratory.
2. **Research** calibrated on the pilot: `-Profile research -CalibrateFrom study_<pilot> -YesSeal -Quant`. The power analysis
   uses the pilot's measured spread; the report says whether the design could detect the gain you care about.

## Reading the report

- **Verdict** `learned_and_valid`: the trained student's gain range is above zero *and* the negative control's is not.
- **Training vs prompting**: if prompting with three examples matches training, training is not justified for these tasks.
- **Power**: an observed gain below the detectable gain means a non-significant result is not evidence of no effect.
- **Forgetting**: general-text perplexity change with its range.
- **Quantization**: strict success, agreement with the unquantized student and McNemar p per variant.
- **Reproducibility**: bundle hash and verification result.

## Validated here

The kit's wiring was run end to end in the development sandbox (CPU, mock teacher, tiny OLMo 3-architecture student; see
CHANGELOG 0.30.0). That shows every step runs and the report is written; it is **not** a measurement of OLMo 3. The real run
needs your GPU, the real teacher and student.

Synthetic tasks only. No result from this kit establishes clinical validity or deployment readiness.
