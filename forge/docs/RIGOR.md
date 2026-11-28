# Rigour: power, prompting baseline, forgetting

Three checks that turn "it learned" into "training beat the cheaper option, by this much, at this cost, and this study could
have seen it". All three are built into every new study and shown on **Measure → Evidence**.

## 1. Power analysis — could this study detect the gain? (preregistered)

Before anything is trained, FORGE simulates replicate studies with the exact design (test task groups × wordings, seeds) and
freezes the result into the plan (`plan.power`, covered by the plan hash):

- **Detectable gain** — the smallest true gain the task-group test finds 80 % of the time. A non-significant result on a gain
  smaller than this is weak evidence of no effect.
- **Seed floor** — with S seeds the seed-level sign-flip test can never go below p = 2/2^S: 3 seeds → 0.25, 5 → 0.0625,
  6 → 0.031. The review gate needs ≥ 6 seeds.
- **Alternatives** — detectable gain for 3/5/6/8 seeds and 1×/2× task groups, so you can see what more seeds or tasks buy.

Model: beta-binomial task groups; the trained model starts from what the untrained one did on each group and gains on average
*g*, varying by group (sd_group) and seed (sd_seed); t-test over group gains, exact sign-flip over seed gains. The null is
checked in `tests/test_rigor.py`: with no true gain both tests reject at about α or less.

Assumptions default to base rate 0.10, sd_group 0.15, sd_seed 0.03. **Recommended:** run a pilot, then create the research
study with *calibrate from* that pilot (`power_calibrate_from` / `validate.py --calibrate-from`), which measures the untrained
rate and the spread of group and seed gains. Live preview while creating a study; `POST /api/power` for planning.

## 2. Few-shot prompting baseline — does training beat simply showing examples?

Arm `fewshot`: the **untrained** student with *k* (default 3) complete, teacher-verified training conversations appended to its
system prompt. Examples come from the training split only, one per skill first, chosen with a fixed seed, and are frozen in
`reports/fewshot_examples.json` (with their hash) so practice and the final test use the same ones. Evaluated like the
untrained student, on the same tasks.

The analysis adds `fewshot_vs_base` (does prompting help?) and, per trained arm, `vs_fewshot` (what training adds over
prompting), with the same crossed bootstrap and sign-flip tests. Evidence reads it as *training beats prompting*, *no
difference shown — the cheaper option may be enough*, or *prompting beats training*.

## 3. Forgetting check — did it lose general language?

Perplexity = exp(mean negative log-likelihood per token) on general English unrelated to the tasks, for the untrained student
and every trained arm and seed. The change is paired per passage, with a bootstrap 95 % range over passages; seeds are
averaged per passage.

| status | rule |
|---|---|
| forgetting | whole range above +5 % |
| no material drift | range below +5 % (and not wholly below −5 %) |
| lower | whole range below −5 %: ordinary text became easier (training text overlapped it) |
| inconclusive | range straddles +5 % |

The built-in text (`forge/engine/general_text.py`, written for FORGE) is small: it detects broad drift, not every lost
capability. Point it at your own file for a stronger check (blank lines separate passages). Runs any time after Train; uses no
task data, so it is allowed before and after SEAL. `POST /api/studies/{id}/forgetting`.

## What these do not do

They make a synthetic-task result more trustworthy. They do not show performance on real requests, clinical validity or
deployment readiness.
