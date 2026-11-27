# Skill check: does a real small model pick up the skills?

Every screenshot and demo study in the FORGE docs uses a **tiny random-weight test model** and a **mock teacher** — they show
the instruments working, not learning (the student scores 0 % everywhere). This is the first test that answers the real
question on your machine: train **Qwen3-1.7B** from **your LM Studio teacher's** examples and measure it against the untrained
student on a **sealed final test**.

## Before you start

| Need | Check |
|---|---|
| FORGE running | `.\scripts\launch.ps1`, open http://127.0.0.1:8765 |
| Student downloaded and discovered | `.\scripts\get-student.ps1 -Repo Qwen/Qwen3-1.7B`, then **Model Observatory → Run discovery** |
| Teacher in LM Studio | LM Studio → Developer → **Start server**, load your teacher (e.g. a 14B instruct model with tool use), run discovery |
| GPU free | close other GPU apps; FORGE unloads the teacher before training and refuses to train while it is still loaded |
| Synthetic data only | the script uses an Agent Studio template — no patient or personal data |

`.\scripts\skill-check.ps1 -ListModels` prints the models FORGE knows, with their ids.

## Run it

```powershell
.\scripts\skill-check.ps1 -Teacher "<teacher name or id>" -Student "Qwen3-1.7B" -Profile pilot -Seal
```

What happens (every step is also visible in the app — Pipeline, Agent Studio, the job dock):

1. An agent is created from the **IT service desk** template (`-Template` to choose another, e.g. `prior_auth`).
2. **Practice tasks**: 60 per skill from the template generator (`-TasksFrom teacher` to have your teacher write them); every
   task is verified by re-running the tools.
3. A **pilot** study (3 seeds) pairs your teacher and student; max sequence length 3,072 tokens (agent prompts carry the tool
   schemas; FORGE never truncates).
4. **Collect** (your teacher solves the training tasks; only verified-correct runs are kept) → **Build** → LM Studio models are
   unloaded → **Train** (3 adapters) → **Evaluate · dev** → **Analyze · dev**.
5. **Is this a good test?** is printed per skill. If it says *weak* or *unusable*, read why before trusting a gain.
6. With `-Seal` you are asked to type `SEAL`; then the **final test** runs once on tasks training never saw, and is analysed.
7. The result: teacher / untrained / trained, overall and per skill, the gain with its 95 % range, a paired task-by-task
   comparison, and a one-line verdict. Saved to `skill-check-result.json`.

If a stage fails (LM Studio not running, out of memory, …) the script prints the reason and the study id; fix it and continue:

```powershell
.\scripts\skill-check.ps1 -Resume <study id> -Seal
```

## Reading the result

| Verdict | Meaning |
|---|---|
| **LEARNED** | the whole 95 % range of the gain is above zero — the trained student is right more often on these tasks |
| **NOT SHOWN** | the range includes zero — these tasks cannot separate trained from untrained (no learning, too few tasks, or a weak teacher) |
| **WORSE** | the trained student is measurably below the untrained one |

Then look in the app:

- **Measure → Compare**: trained vs untrained on the final test; open any task **side by side** to see what changed in its tool
  calls and answer.
- **Measure → Compare**, trained vs teacher: how much of the gap was closed.
- **Playground**: type your own requests to the trained student.
- **Governance → Model card**: the summary a reviewer reads.

Useful follow-ups, in order: **Robustness** (reworded and unfamiliar requests, hand-back cases), **GGUF export + LM Studio check**
(the small file should behave the same), and only then the use case you actually care about.

## Rough time (16 GB GPU, Qwen3-1.7B, pilot, ~300 tasks)

Not measured on your hardware yet — expect **hours, not days**: collect depends on your teacher's speed; training is three short
LoRA runs; evaluation runs every dev and test task through the base and three adapters. The script prints elapsed time per step.

## Limits

Strict success on **synthetic** tasks. A gain here shows the mechanism works for this kind of job on your setup; it is not
clinical validity, deployment readiness or evidence about real requests. One template, one student size, one teacher.
