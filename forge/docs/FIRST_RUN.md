# First run — the MVP loop on your machine

Target host: Windows 11, RTX 4070 Ti SUPER 16 GB, Python 3.12.10, LM Studio at `http://127.0.0.1:1234`.

1. **Probe** — `.\scripts\probe-host.ps1` (no installs). Confirms GPU, driver, Python 3.12, Node, LM Studio dirs.
2. **Setup** — `.\scripts\setup.ps1 -WithML`. Creates `backend\.venv`, installs torch 2.14.1+cu126 and the
   pinned stack (full dependency set — never `--no-deps`), runs `pip check`, prints the interpreter, imports NumPy, runs tests.
3. **Verify GPU** — `.\scripts\verify-gpu.ps1`. Then, with LM Studio's model **unloaded**:
   `.\scripts\verify-gpu.ps1 -Student "$env:USERPROFILE\.cache\huggingface\hub\models--Qwen--Qwen3-1.7B\snapshots\70d244cc86ccca08cf5af4e1e306ecf908b1ad5e"`
   This runs a 2-step LoRA on the real student plus a dev evaluation and prints peak VRAM.
4. **Launch** — `.\scripts\launch.ps1` → `http://127.0.0.1:8765`. If 8765 is taken, FORGE exits and names the owning PID.
5. **Overview** — every Readiness row green (CUDA, BF16, NumPy, venv, teacher endpoint). Telemetry should start immediately.
6. **Observatory** — *Run discovery*. Expect one row per LM Studio model (no REST duplicates), `gpt-oss-20b` as **MXFP4**,
   and BERT / DINO / Whisper / MiniLM / nomic-embed hidden behind "Show non-generative".
   Qwen3-1.7B: parameter reconciliation should show stored 2.03B, a duplicated tied `lm_head`, and the unique / non-embedding counts (predicted; confirm on your files).
7. **Roles** — `qwen/qwen3.8-27b` → teacher (or `qwen/qwen2.5-coder-14b` for speed; avoid `deepseek-r1…`: reasoning-first).
   Qwen3-1.7B → student. *Pair builder* → run pair-check → **Create study with this pair**.
8. **Studio** — profile **smoke**, arm `teacher_filtered`. Run **Collect** (teacher loaded in LM Studio), **Build**,
   then **unload the teacher in LM Studio**, then **Train**, **Eval · dev**, **Analyze · dev**, type SEAL, **Eval · test**, **Analyze · test**.
   Smoke trains only 2 steps — it proves wiring. For a real effect, create a **pilot** study (3 seeds, 3 epochs).
9. **Evaluation Lab** — paired Δ with 95% CI, sign-flip p-values, skill map; *Gains & regressions* → click a task for the
   teacher / base / tuned path comparison with the first divergence marked.

Collect needs the teacher **loaded**; train and student evaluation need it **unloaded** (one 16 GB GPU).
FORGE enforces the second. It cannot load models in LM Studio, but the **Unload LM Studio models** button (Overview / Studio) runs `lms unload --all` for you.

## Your own documents — Knowledge Studio (v0.7)

1. In LM Studio, load an **embedding model** (e.g. `text-embedding-nomic-embed-text-v1.5`, small enough to stay loaded) and your **teacher**.
2. **Knowledge Studio → Add your documents.** Start with *FORGE's own docs* for a first run, then a folder of your own
   non-sensitive documents (txt, md, rst, html, pdf). Tick the attestation (no PHI, no patient data, no secrets).
3. **Make it searchable** → *Keywords + meaning* → pick the embedding model → **Build index**. Ask the search box a few questions
   you know the answer to; if the right passage is not in the top 3, the student will not find it either.
4. **Create practice questions** → pick the teacher → 60 questions, 25 % unanswerable to start. Read the *Rejected* tab: it shows why
   questions failed verification. Aim for ≥ 40 accepted.
5. **Teach the student** → choose the student and profile → creates the study and opens Experiment Studio. Run the stages as in
   step 8 above (collect with the teacher loaded, unload before train).
   If **Build** reports records over the max sequence length, nothing was truncated: recreate the study with a larger max length.
6. **See what it learned** → base vs tuned on dev documents (never trained on), then Trajectory Explorer for each answer's search,
   retrieved passages, and cited source.
