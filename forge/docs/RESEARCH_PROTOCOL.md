# Research protocol

## Question
Does LoRA fine-tuning a small student on a teacher's *verified* tool-use trajectories increase the student's
**strict success** on held-out tasks of the same families — without regressing OOD wording or a simple
extraction skill — and how much of the teacher–base gap does it close?

## Units and splits
- **Task family**: `catalog_lookup`, `multi_step_quote`, `missing_item` (tool-using); `extraction` (no tools, regression split only).
- **Group** = one scenario (entities + reference tool sequence). Paraphrases share a `group_id` and never cross splits.
- Splits per family: train 60% · dev 20% · test 20% of groups; **ood** = fresh groups with held-out wording templates; **regression** = extraction.
- Generation is a pure function of the seed; the task-set SHA-256 is frozen in the plan.

## Protocol
- One JSON object per assistant turn: `{"tool", "arguments"}` or `{"answer"}`. Read-only tools `lookup`, `quote`.
- Hidden reasoning is stripped; an unclosed reasoning block makes the turn invalid. Stored assistant turns are canonical re-serializations.
- **Strict success** = correct answer ∧ exact reference tool sequence and arguments ∧ no errors.
- Also recorded: answer correctness, tool selection, argument accuracy, invalid calls, unsupported answers, call count, latency, tokens.
- Infrastructure failures (backend errors) abort the stage and are never recorded as model failures.

## Arms
Control: `base` (untrained student, greedy, evaluated once and **explicitly** broadcast across seeds).
Primary candidate: `teacher_filtered` (strict teacher successes). Ablations (one factor each): `teacher_raw`,
`oracle_sft`, `quarter_data` (nested by group), `last_turn_only`, `rank4`, `attention_only`, `all_token_loss`.
All data arms share the same eligible task ids.

## Lifecycle
`init` (freeze plan, tasks, base hash, engine source hash, environment) → `collect` → `build` → `train` →
`evaluate_dev` → `analyze_dev` → **`seal`** (type SEAL; adapters frozen by hash; no more build/train/dev eval) →
`evaluate_test` (test, ood, regression) → `analyze_test` → optional `export` (merged bf16 + post-merge test re-evaluation).

## Statistics
- Paraphrases averaged within group → seed × group matrix of Δ = arm − base.
- **CI**: crossed percentile bootstrap resampling seeds and groups jointly (10 000 draws); labeled *not BCa*.
- **Tests**: two-sided sign-flip, group-conditional (seeds averaged) and seed-conditional (groups averaged); exact for ≤ 16 units, else Monte Carlo with +1 correction. 3 seeds ⇒ minimum p = 0.25.
- **McNemar** (exact): diagnostic only, one fixed paraphrase (p0) per group, per seed.
- **Holm** across secondary contrasts (OOD, regression, other arms); the primary contrast is preregistered.
- **Power**: n = ⌈(z₁₋α/₂ + z_power)²·(q − δ²)/δ²⌉ groups, q = discordant fraction.
- **Teacher gap closed** = (tuned − base)/(teacher − base), only when teacher > base; descriptive.
- Incomplete, unpaired, or duplicate observations raise — nothing is inner-joined away.

## Review gate (all required)
research profile · ≥ 6 seeds · CI low ≥ preregistered min gain · both sign-flip p < .05 · invalid-call
non-inferiority · OOD and regression non-inferiority (CI low ≥ −0.05) · teacher measured.
Pass ⇒ **candidate for human review**, never deployment approval.

## Profiles
| Profile | Seeds | Groups / family | Purpose |
|---|---|---|---|
| smoke | 1 | 8 | wiring only — no inferential claims |
| pilot | 3 | 24 | exploratory |
| research | 6 | 40 | preregistered, gate-eligible |

## Data policy
Synthetic tasks only. No PHI or patient data until separately approved.
