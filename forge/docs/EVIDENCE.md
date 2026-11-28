# Did the student actually learn? — positive and negative controls

FORGE's **Evidence** page (Measure → Evidence) answers one question with measured data: *did training change what the
student can do, and does the measurement respond to real learning rather than to output format?* It does this with two
controls run as ordinary study arms, on the same tasks, seeds and sealed final test as everything else.

![Evidence page](images/evidence.webp)

## The controls

| Arm | What it is trained on | What it should show if FORGE measures correctly |
|---|---|---|
| `teacher_filtered` (positive) | teacher answers that passed verification | a gain over the untrained student |
| `shuffled_control` (negative) | the **same** verified examples, but each completion moved to a different task (seeded derangement, every completion moves) | **no** gain: it sees the right format and vocabulary but never the right answer for its question |

If the negative control gains as much as the real arm, the metric is rewarding format, not skill, and the page says so
(`control_failed`). Add the control by selecting the arm *Negative control (shuffled answers)* when creating a study.

The verdict (`engine/evidence.py`) is one of: `learned_and_valid`, `learned` (no control run), `control_failed`, `not_shown`,
`not_measured`. It is computed from the study's own analysis reports (crossed bootstrap over seeds × task groups); nothing
is hand-entered.

## A measured run (this repository's validation, v0.29)

Run on CPU in the development sandbox. Because no OLMo 3 checkpoint could be downloaded there, the student is a **small
OLMo 3-architecture model** (4 layers, hidden 384; `Olmo3ForCausalLM`, sliding + full attention) first pretrained on generic
copying / chat text — enough to copy arguments, not enough to know the tasks. LoRA rank 64, lr 0.002, 900 steps, 3 seeds,
research taskset (48 sealed test tasks per seed). The teacher was a local mock that answers from the task catalogue.

Sealed final test, strict success (right tool, right arguments, right answer, no invalid calls), Wilson 95 % ranges:

| Arm | n | Strict success | Right tool | Right answer | Invalid calls |
|---|---|---|---|---|---|
| untrained student | 48 | 0 % (0–7) | 0 % | 0 % | 100 % |
| **trained · teacher_filtered** | 144 | **13.2 % (8.6–19.7)** | 78.5 % | 40.3 % | 7.6 % |
| negative control (shuffled) | 144 | 0 % (0–2.6) | 0 % | 0 % | 0 % |
| teacher | 48 | 83.3 % (70.4–91.3) | 100 % | 83.3 % | 0 % |

Per-seed strict success, trained: 14.6 %, 16.7 %, 8.3 %; control: 0 %, 0 %, 0 %.

Gain over the untrained student (crossed bootstrap, seeds × groups): **+13.2 pts (95 % +2.8 to +26.4)**; control
**+0.0 pts (+0.0 to +0.0)**. Verdict: `learned_and_valid`. On practice (dev) tasks: +9.7 pts (+1.4 to +20.8).

What this does **not** establish, stated plainly:
- The sign-flip tests are not significant at 5 %: p = 0.063 over task groups; p = 0.25 over seeds, which is the smallest
  value 3 seeds can give. The bootstrap range excludes zero; the permutation tests do not confirm it. More seeds are needed.
- The student is a tiny stand-in, and the absolute rate (13 %) says nothing about OLMo 3 7B. The run validates the
  *instrument* (it detects learning and rejects format-only training), not a production model.
- Synthetic tasks only. No performance on real requests, clinical validity or deployment readiness is claimed.

## Reproduce

1. Create a study with arms *teacher_filtered* and *Negative control (shuffled answers)*, at least 3 seeds.
2. Run it through **seal** and **analyze_test**.
3. Open Measure → Evidence. `GET /api/studies/{id}/evidence` returns the same data as JSON.

Tests: `tests/test_evidence.py` (each verdict) and
`tests/test_datasets_adapters_graphs.py::test_shuffled_control_moves_every_completion`.
