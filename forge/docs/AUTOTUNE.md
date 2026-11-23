# Auto-tune with Azure OpenAI

A frontier model (your Azure OpenAI deployment) steers **weight edits**; FORGE makes them with exact LoRA arithmetic, measures them,
and a person approves each step. Find it in **Weight Lab → Auto-tune with Azure** (visible once the AI assistant is configured).

## What happens in one round

1. **Propose.** FORGE sends the model a *summary*: adapters available, the number of layers, per-skill success on practice
   (dev) tasks for untrained / trained / teacher, failure-type counts, and every earlier recipe with its result and your
   notes. **Never sent:** task text, table rows, documents, file paths, weights, the sealed test.
2. **Validate.** The reply must be one recipe within limits: 1–4 trained adapters with weights −1…2, strength 0…2, a layer
   range, attention / MLP / all modules, optional SVD rank 1…64. Anything else, or a repeat, is refused and recorded.
3. **Approve.** You approve or reject it in Weight Lab (with a note the model sees next round). Your name is recorded.
4. **Apply.** Weight Lab builds the variant: a new adapter; the original model and adapters are never changed.
5. **Measure.** The variant runs the dev tasks. A variant that lowers hand-back (boundary) success below the trained adapter
   is flagged and can never be "best".

The run stops at the round budget, when the model says stop, or when you press Stop. Choosing the best of several variants
on the same dev tasks is optimistic: confirm the winner with a **new study's sealed test** before relying on it.

## Drive it from your own script

The loop FORGE runs is a plain client of these local endpoints (all on `http://127.0.0.1:8765`, mutating calls need the
session token from `GET /api/system/session` in `X-Forge-Token`; put your name in `X-Forge-Actor` for the audit trail):

| Step | Call |
|---|---|
| start a run | `POST /api/autotune` `{"study_id", "rounds", "approve_each", "goal"}` |
| get state | `GET /api/autotune/{id}` |
| ask for a proposal | `POST /api/autotune/{id}/propose` |
| approve / reject | `POST /api/autotune/{id}/decision` `{"round", "decision": "approved" \| "rejected", "note"}` |
| build the recipe | `POST /api/weightlab` `{"name", "sources": [{"study_id","arm","seed","weight"}], "strength", "layers", "modules", "rank"}` |
| measure it | `POST /api/weightlab/{variant_id}/evaluate` `{"study_id"}` then poll `GET /api/jobs/{job_id}` |
| record the result | `POST /api/autotune/{id}/result` `{"round", "variant_id"}` |
| finish / stop | `POST /api/autotune/{id}/finish` · `POST /api/autotune/{id}/stop` |

PowerShell example (one proposal, approved by you):

```powershell
$base = "http://127.0.0.1:8765"
$tok  = (Invoke-RestMethod "$base/api/system/session").token
$h    = @{ "X-Forge-Token" = $tok; "X-Forge-Actor" = "J. Rivera" }
$p    = Invoke-RestMethod -Method Post -Headers $h "$base/api/autotune/<run id>/propose"
$p.rationale; $p.recipe | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Headers $h -ContentType "application/json" "$base/api/autotune/<run id>/decision" `
  -Body (@{ round = $p.round; decision = "approved"; note = "" } | ConvertTo-Json)
```

## Limits

- Only Weight Lab operations on adapters that were already trained. Retraining with new data or settings is a new study.
- The model's suggestions are steering, not evidence. The measurements are the evidence.
- Every Azure call is in the assistant ledger (size and hash); every action is in the audit trail.
