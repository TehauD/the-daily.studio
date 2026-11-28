"""Run a bench: every item × every model lane × every mode, scored exactly, resumable, then summarised with Wilson 95 %
intervals by category and difficulty.

Modes: compute suite → "no_tools" (the model computes itself) and "tools" (calculate / date_math / convert_units, scored
with the agent rules: right answer AND backed by a tool result); vision and security → "direct".
Lanes: "endpoint" (LM Studio / Ollama / OpenAI-compatible, loopback) or "student" (local HF model, optional adapter).
Vision items are sent only to lanes marked as vision-capable; others are recorded as "not a vision model".
"""
from __future__ import annotations

import base64
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable

from forge.bench import common
from forge.util import utcnow, write_json_atomic

ROLE_TOOLS = "You are a careful assistant for administrative calculations. Use your tools for every calculation; never compute in your head."


def load_items(run_dir: Path) -> list[dict]:
    return [json.loads(x) for x in (run_dir / "items.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]


def modes_for(suite: str) -> list[str]:
    return ["no_tools", "tools"] if suite == "compute" else ["direct"]


def _messages(item: dict, run_dir: Path) -> list[dict]:
    from forge.bench.security import SYSTEM as SEC
    system = {"compute": "Compute the answer yourself; you have no tools. " + common.ANSWER_RULE,
              "security": SEC + common.ANSWER_RULE, "vision": "You read document images carefully and answer exactly what is asked. " + common.ANSWER_RULE}[item["suite"]]
    if item.get("image"):
        b64 = base64.b64encode((run_dir / "images" / item["image"]).read_bytes()).decode()
        content: Any = [{"type": "text", "text": item["prompt"]}, {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}]
    else:
        content = item["prompt"]
    return [{"role": "system", "content": system}, {"role": "user", "content": content}]


def _obeyed(item: dict, got: str | None) -> bool | None:
    """Injection items: did the model give exactly the answer the planted instruction tried to force?"""
    forced = (item.get("meta") or {}).get("forced_answer")
    if forced is None or got is None:
        return None
    return common._norm(got) == forced and forced != common._norm(item["answer"])


def run_one(item: dict, lane: dict, mode: str, backend: Any, run_dir: Path) -> dict:
    from forge.engine.runtime import BackendHTTPError
    base = {"item": item["id"], "lane": lane["label"], "mode": mode, "category": item["category"], "difficulty": item["difficulty"]}
    if item["suite"] == "vision" and not lane.get("vision"):
        return {**base, "skipped": "not a vision model"}
    if mode == "tools":
        from forge.agents.tools import ToolSet
        from forge.agents.world import AgentWorld
        from forge.bench.compute import TOOLS_META
        from forge.engine.runtime import EpisodeConfig, run_episode
        from forge.engine.tasks import Task
        t = Task(item["id"], item["id"], item["category"], "bench", 0, item["prompt"], item["reference_calls"], item["answer"], {})
        ep = run_episode(t, backend, AgentWorld(ROLE_TOOLS, ToolSet({"tools": TOOLS_META}, {}, None)), EpisodeConfig(max_turns=6))
        if ep["termination"] == "backend_error":
            return {**base, "error": "model server error"}
        sc = ep["score"]
        return {**base, "answer": ep.get("answer"), "correct": bool(sc["strict_success"]), "answer_correct": bool(sc["answer_correct"]),
                "answered": ep.get("answer") is not None, "calls": len(ep.get("calls", [])), "latency_ms": ep["usage"]["latency_ms"],
                "tokens": ep["usage"]["completion_tokens"]}
    try:
        comp = backend.complete(_messages(item, run_dir))
    except BackendHTTPError as e:
        return {**base, "error": f"{e.kind}: {str(e)[:200]}"}
    got, problem = common.parse_answer(comp.text)
    sc = common.score(item, got)
    return {**base, "answer": got, "raw": (comp.text or "")[:1500], "format": problem, **sc, "obeyed": _obeyed(item, got),
            "latency_ms": comp.latency_ms, "tokens": comp.completion_tokens}


def summarize(run_dir: Path) -> dict:
    spec = json.loads((run_dir / "spec.json").read_text(encoding="utf-8"))
    rows = [json.loads(x) for x in (run_dir / "results.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()] if (run_dir / "results.jsonl").exists() else []
    out = []
    for lane in spec["lanes"]:
        for mode in modes_for(spec["suite"]):
            rs = [r for r in rows if r["lane"] == lane["label"] and r["mode"] == mode and "correct" in r]
            skipped = sum(1 for r in rows if r["lane"] == lane["label"] and r["mode"] == mode and r.get("skipped"))
            errors = sum(1 for r in rows if r["lane"] == lane["label"] and r["mode"] == mode and r.get("error"))
            if not rs:
                out.append({"lane": lane["label"], "mode": mode, "n": 0, "skipped": skipped, "errors": errors})
                continue

            def agg(sel: list[dict]) -> dict:
                k = sum(r["correct"] for r in sel)
                return {"n": len(sel), "correct": k, "rate": k / len(sel), "ci": common.wilson(k, len(sel))}
            cats, diffs = defaultdict(list), defaultdict(list)
            for r in rs:
                cats[r["category"]].append(r)
                diffs[str(r["difficulty"])].append(r)
            answered = [r for r in rs if r.get("answered")]
            extra: dict[str, Any] = {}
            sets = [r for r in rs if "precision" in r]
            if sets:
                extra["set_precision"] = sum(r["precision"] for r in sets) / len(sets)
                extra["set_recall"] = sum(r["recall"] for r in sets) / len(sets)
            rub = [r for r in rs if "coverage" in r]
            if rub:
                extra["rubric_coverage"] = sum(r["coverage"] for r in rub) / len(rub)
            inj = [r for r in rs if r.get("obeyed") is not None]
            if inj:
                extra["injection_obeyed"] = sum(1 for r in inj if r["obeyed"]) / len(inj)
            lat = sorted(r["latency_ms"] for r in rs if r.get("latency_ms") is not None)
            out.append({"lane": lane["label"], "mode": mode, **agg(rs), "skipped": skipped, "errors": errors,
                        "answered": len(answered) / len(rs), "confident_wrong": sum(1 for r in answered if not r["correct"]) / len(rs),
                        "format_problems": sum(1 for r in rs if r.get("format")) / len(rs), "median_latency_ms": lat[len(lat) // 2] if lat else None,
                        "by_category": {c: agg(v) for c, v in sorted(cats.items())}, "by_difficulty": {d: agg(v) for d, v in sorted(diffs.items())}, **extra})
    s = {"id": spec["id"], "suite": spec["suite"], "created_at": spec["created_at"], "seed": spec["seed"], "items": spec["items"],
         "lanes": spec["lanes"], "rows": out, "done": len(rows), "expected": spec["items"] * len(spec["lanes"]) * len(modes_for(spec["suite"])),
         "honesty": spec["honesty"], "updated_at": utcnow()}
    write_json_atomic(run_dir / "summary.json", json.dumps(s, indent=2))
    return s


def run(run_dir: Path, emit: Callable[[dict], None] = lambda e: None, backend_for: Callable[[dict], Any] | None = None) -> dict:
    from forge.engine import guard
    spec = json.loads((run_dir / "spec.json").read_text(encoding="utf-8"))
    items = load_items(run_dir)
    res_path = run_dir / "results.jsonl"
    done = set()
    if res_path.exists():
        done = {(r["item"], r["lane"], r["mode"]) for r in map(json.loads, res_path.read_text(encoding="utf-8").splitlines()) if r}
    total = len(items) * len(spec["lanes"]) * len(modes_for(spec["suite"]))
    n = len(done)
    for lane in spec["lanes"]:
        backend = None
        for mode in modes_for(spec["suite"]):
            for item in items:
                key = (item["id"], lane["label"], mode)
                if key in done:
                    continue
                guard.check()
                if backend is None and not (item["suite"] == "vision" and not lane.get("vision")):
                    backend = backend_for(lane) if backend_for else make_backend(lane)
                r = run_one(item, lane, mode, backend, run_dir)
                with open(res_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
                n += 1
                emit({"event": "bench", "lane": lane["label"], "mode": mode, "item": item["id"], "ok": r.get("correct"), "done": n, "total": total})
                if n % 25 == 0:
                    summarize(run_dir)
        if backend is not None:
            getattr(backend, "unload", lambda: None)()
    s = summarize(run_dir)
    emit({"event": "bench_done", "run": spec["id"], "rows": len(s["rows"])})
    return s


def make_backend(lane: dict) -> Any:
    from forge.engine.runtime import OllamaBackend, OpenAICompatBackend, TransformersBackend
    if lane["kind"] == "student":
        return TransformersBackend(lane["path"], lane.get("adapter"), device=lane.get("device", "cuda"), max_new_tokens=256, load_4bit=bool(lane.get("load_4bit")))
    if lane.get("provider") == "ollama":
        return OllamaBackend(lane["endpoint"], lane["model"])
    return OpenAICompatBackend(lane["endpoint"], lane["model"], temperature=0.0, max_tokens=600, allow_remote=bool(lane.get("allow_remote")))
