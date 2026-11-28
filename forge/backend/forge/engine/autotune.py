"""Auto-tune: a frontier model (Azure OpenAI) steers weight edits; FORGE makes them, measures them, and a person approves.

The loop, run as an engine job that talks only to FORGE's own local API (the same endpoints a PowerShell or Python script
could call):

    propose  → POST /api/autotune/{id}/propose   FORGE sends a SUMMARY to Azure (skill names, dev metrics, failure-type
                                                 counts, past recipes and results — never task text) and validates the reply
    approve  → a person approves or rejects it in Weight Lab (or POST /api/autotune/{id}/decision); optional auto-approve
    apply    → POST /api/weightlab               exact LoRA arithmetic (sources × weights, strength, layers, modules, rank)
    measure  → POST /api/weightlab/{vid}/evaluate  practice (dev) tasks only — the sealed test is never used or shown
    record   → POST /api/autotune/{id}/result    FORGE reads the evaluation from disk and stores it with the round

Guardrails: a round budget; dev only; a variant that lowers hand-back (boundary) success below the trained adapter is flagged
and can never be "best"; the frontier model never sees task text, file paths or weights; every call is in the assistant
ledger and every action in the audit trail. Choosing the best of many dev results is optimistic — confirm with a new sealed
study before relying on it.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Callable

from forge.util import new_id, utcnow, write_json_atomic

MAX_ROUNDS = 20
TERMINAL = ("completed", "stopped", "failed")
SYSTEM = """You are tuning a small language model's LoRA adapters with exact weight arithmetic in a local lab (FORGE).
You cannot see the weights or any task text. You see per-skill success rates on practice (dev) tasks and failure-type counts.
Each round you propose ONE recipe, FORGE builds it exactly and measures it on the same dev tasks:
- sources: 1–4 trained adapters, each {"arm", "seed", "weight"}; the delta is the weighted sum (weights between -1 and 2)
- strength: 0–2, scales the whole delta (0 = untrained model, 1 = as trained)
- layers: [first, last] inclusive to keep the change only there, or null for all layers
- modules: "all", "attention" or "mlp"
- rank: null to keep full rank, or 1–64 to compress the delta with SVD
Rules: never propose a recipe already tried; hand-back (boundary) success must not drop below the trained adapter's;
prefer simple, explainable changes; stop when further rounds are unlikely to help.
Reply with ONE JSON object only:
{"rationale": "<= 80 words, what you expect and why", "action": "variant" | "stop",
 "recipe": {"sources": [{"arm": "...", "seed": 0, "weight": 1.0}], "strength": 1.0, "layers": null, "modules": "all", "rank": null}}"""


class AutoTuneError(ValueError):
    pass


class Run:
    def __init__(self, root: Path):
        self.root = root
        if not (root / "run.json").exists():
            raise AutoTuneError("Unknown auto-tune run")

    @property
    def data(self) -> dict:
        return json.loads((self.root / "run.json").read_text(encoding="utf-8"))

    def save(self, d: dict) -> None:
        d["updated_at"] = utcnow()
        write_json_atomic(self.root / "run.json", json.dumps(d, indent=2, ensure_ascii=False))

    @staticmethod
    def create(base: Path, study_id: str, rounds: int, approve_each: bool, goal: str, context: dict) -> "Run":
        rid = new_id("tune")
        root = base / rid
        root.mkdir(parents=True)
        d = {"id": rid, "study_id": study_id, "created_at": utcnow(), "status": "running", "max_rounds": rounds, "approve_each": approve_each,
             "goal": goal, "context": context, "rounds": [], "best": None, "job_id": None, "stop_requested": False}
        write_json_atomic(root / "run.json", json.dumps(d, indent=2))
        return Run(root)


def context_for(study: Any, wl_layers: int | None) -> dict:
    """The study facts the loop needs: trained adapters, layer count, baseline dev metrics per skill."""
    trained = [{"arm": a, "seed": s} for a in study.plan["arms"] for s in study.plan["seeds"]
               if (study.run_dir(a, s) / "adapter" / "adapter_model.safetensors").exists()]
    if not trained:
        raise AutoTuneError("The study has no trained adapters yet")
    rep = study.summary()["reports"].get("dev", {}).get("splits", {}).get("dev")
    if not rep:
        raise AutoTuneError("Run Evaluate · dev and Analyze · dev first, so there is a baseline to improve on")
    arm = study.plan["arms"][0]
    fam = (rep["arms"].get(arm) or {}).get("families") or {}
    per_skill = {f: {k: round(v["rate"], 3) for k, v in d.items() if isinstance(v, dict) and "rate" in v} for f, d in fam.items()}
    return {"trained": trained, "layers": wl_layers, "baseline": {"untrained": rep.get("base_rate"), "trained": rep["arms"].get(arm, {}).get("arm_rate"),
                                                                    "teacher": rep.get("teacher_rate"), "per_skill": per_skill}}


def build_messages(run: dict, failures: dict[str, int]) -> list[dict[str, str]]:
    hist = [{"round": r["round"], "recipe": r.get("recipe"), "decision": r.get("decision"), "note": r.get("note"),
             "dev_overall": (r.get("result") or {}).get("overall"), "dev_per_skill": (r.get("result") or {}).get("per_skill"),
             "boundary_guardrail_violated": (r.get("result") or {}).get("guardrail_violated")} for r in run["rounds"]]
    user = {"goal": run["goal"] or "Raise strict success on practice tasks without hurting any skill, especially hand-back (boundary).",
            "adapters_available": run["context"]["trained"], "layer_count": run["context"]["layers"],
            "baseline_dev": run["context"]["baseline"], "trained_adapter_failure_types_dev": failures,
            "history": hist, "rounds_left": run["max_rounds"] - len([r for r in run["rounds"] if r.get("decision") != "rejected"])}
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": json.dumps(user, ensure_ascii=False)}]


def parse_proposal(text: str, run: dict) -> dict:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        raise AutoTuneError("The model did not reply with JSON")
    try:
        p = json.loads(m.group(0))
    except ValueError as e:
        raise AutoTuneError(f"Unreadable JSON from the model ({e})") from e
    action = p.get("action")
    rationale = " ".join(str(p.get("rationale", "")).split())[:800]
    if action == "stop":
        return {"action": "stop", "rationale": rationale, "recipe": None}
    if action != "variant":
        raise AutoTuneError("action must be 'variant' or 'stop'")
    r = p.get("recipe") or {}
    ok = {(t["arm"], t["seed"]) for t in run["context"]["trained"]}
    srcs = r.get("sources") or []
    if not 1 <= len(srcs) <= 4:
        raise AutoTuneError("recipe needs 1–4 sources")
    clean = []
    for s in srcs:
        key = (str(s.get("arm")), int(s.get("seed", -1)))
        if key not in ok:
            raise AutoTuneError(f"unknown adapter {key}")
        w = float(s.get("weight", 1.0))
        if not -1.0 <= w <= 2.0:
            raise AutoTuneError("weights must be between -1 and 2")
        clean.append({"arm": key[0], "seed": key[1], "weight": round(w, 4)})
    strength = float(r.get("strength", 1.0))
    if not 0.0 <= strength <= 2.0:
        raise AutoTuneError("strength must be between 0 and 2")
    layers = r.get("layers")
    n = run["context"]["layers"]
    if layers is not None:
        if not (isinstance(layers, list) and len(layers) == 2 and 0 <= int(layers[0]) <= int(layers[1]) and (n is None or int(layers[1]) < n)):
            raise AutoTuneError(f"layers must be [first, last] within 0–{(n or 1) - 1}")
        layers = [int(layers[0]), int(layers[1])]
    modules = r.get("modules", "all")
    if modules not in ("all", "attention", "mlp"):
        raise AutoTuneError("modules must be all, attention or mlp")
    rank = r.get("rank")
    if rank is not None and not 1 <= int(rank) <= 64:
        raise AutoTuneError("rank must be null or 1–64")
    recipe = {"sources": clean, "strength": round(strength, 4), "layers": layers, "modules": modules, "rank": int(rank) if rank is not None else None}
    canon = json.dumps(recipe, sort_keys=True)
    if any(json.dumps(x.get("recipe"), sort_keys=True) == canon for x in run["rounds"] if x.get("recipe")):
        raise AutoTuneError("this recipe was already tried")
    return {"action": "variant", "rationale": rationale, "recipe": recipe}


def score_result(ev: dict, baseline: dict) -> dict:
    """Variant dev result vs the trained adapter; boundary must not drop."""
    v = ev["variant"]
    tuned = ev.get("tuned") or {}
    b_var, b_tun = v["per_skill"].get("boundary"), (tuned.get("per_skill") or {}).get("boundary")
    violated = b_var is not None and b_tun is not None and b_var < b_tun
    return {"overall": v["overall"], "per_skill": {k: round(x, 3) for k, x in v["per_skill"].items()}, "n": v["n"],
            "trained_overall": tuned.get("overall"), "delta_vs_trained": (v["overall"] - tuned["overall"]) if tuned.get("overall") is not None and v["overall"] is not None else None,
            "guardrail_violated": violated, "invalid_rate": ev.get("invalid_rate")}


def pick_best(rounds: list[dict]) -> dict | None:
    ok = [r for r in rounds if r.get("result") and not r["result"]["guardrail_violated"] and r["result"]["overall"] is not None]
    if not ok:
        return None
    b = max(ok, key=lambda r: (r["result"]["overall"], -r["round"]))
    d = b["result"]["delta_vs_trained"]
    return {"round": b["round"], "variant_id": b.get("variant_id"), "overall": b["result"]["overall"], "delta_vs_trained": d,
            "improved": d is not None and d > 0}


# ------------------------------------------------------------------ the loop (engine job; FORGE API only)
def loop(api: Any, rid: str, emit: Callable[[dict], None] = lambda e: None, poll_s: float = 2.0, sleep: Callable[[float], None] | None = None) -> dict:
    """`api` is an httpx.Client bound to FORGE's local API with the session token."""
    import time
    sleep = sleep or time.sleep

    def get() -> dict:
        return api.get(f"/api/autotune/{rid}").json()

    def wait_job(job: dict) -> None:
        while True:
            j = api.get(f"/api/jobs/{job['id']}").json()
            if j["status"] not in ("running", "cancelling"):
                if j["status"] != "completed":
                    raise AutoTuneError(f"{j['label']} {j['status']}")
                return
            if get().get("stop_requested"):
                api.post(f"/api/jobs/{job['id']}/cancel")
            sleep(poll_s)

    def retry_gpu(fn):
        while True:
            r = fn()
            if r.status_code == 409 and "GPU" in r.text:
                sleep(poll_s * 2)
                continue
            if r.status_code >= 400:
                raise AutoTuneError(f"{r.status_code}: {r.text[:300]}")
            return r.json()

    while True:
        run = get()
        if run["status"] in TERMINAL or run.get("stop_requested"):
            break
        used = len([r for r in run["rounds"] if r.get("decision") != "rejected"])
        attempts = len(run["rounds"])
        if used >= run["max_rounds"] or attempts >= 2 * run["max_rounds"]:
            break
        r = api.post(f"/api/autotune/{rid}/propose")
        if r.status_code >= 400:
            emit({"event": "autotune_error", "detail": r.text[:300]})
            raise AutoTuneError(f"propose failed: {r.text[:300]}")
        prop = r.json()
        emit({"event": "autotune_proposal", "round": prop["round"], "action": prop["action"], "rationale": prop["rationale"][:200]})
        if prop["action"] == "stop":
            break
        while prop.get("decision") in (None, "pending"):
            sleep(poll_s)
            run = get()
            if run.get("stop_requested"):
                break
            prop = next(x for x in run["rounds"] if x["round"] == prop["round"])
        if run.get("stop_requested") or prop.get("decision") != "approved":
            continue
        rec = prop["recipe"]
        created = retry_gpu(lambda: api.post("/api/weightlab", json={"name": f"auto-tune {rid[-6:]} · round {prop['round']}", **{k: rec[k] for k in ("strength", "layers", "modules", "rank")},
                                                                     "sources": [{"study_id": run["study_id"], **s} for s in rec["sources"]]}))
        vid = created["variant"]["id"]
        emit({"event": "autotune_build", "round": prop["round"], "variant": vid})
        wait_job(created["job"])
        job = retry_gpu(lambda: api.post(f"/api/weightlab/{vid}/evaluate", json={"study_id": run["study_id"]}))
        wait_job(job)
        res = api.post(f"/api/autotune/{rid}/result", json={"round": prop["round"], "variant_id": vid}).json()
        emit({"event": "autotune_result", "round": prop["round"], "overall": res["result"]["overall"], "guardrail_violated": res["result"]["guardrail_violated"]})
    fin = api.post(f"/api/autotune/{rid}/finish").json()
    emit({"event": "autotune_done", "best": fin.get("best")})
    return fin
