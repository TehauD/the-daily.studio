"""Agent Playground: one message (or one held-out task), several models, side by side.

Lanes: the untrained student (base), any trained adapter (arm × seed), any Weight Lab variant, and the teacher. Every lane
uses the study's own world (tools, instructions), so differences are the models' alone. For free text there is no
reference answer: FORGE reports what each lane did, whether its answer is backed by a tool result it saw (agents), and where
it first diverged from the teacher. Picking a task gives the full strict score.

Test / OOD / regression tasks are only selectable after the study is sealed, so playing never leaks held-out results into
training decisions.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from forge.engine.runtime import EpisodeConfig, TransformersBackend, run_episode
from forge.engine.tasks import Task
from forge.util import canonical_json, new_id, utcnow, write_json_atomic

HELD_OUT = ("test", "ood", "regression")


class PlaygroundError(ValueError):
    pass


def _task(study: Any, spec: dict) -> Task:
    if spec.get("task_id"):
        t = next((x for x in study.tasks() if x.task_id == spec["task_id"]), None)
        if t is None:
            raise PlaygroundError("Unknown task")
        if t.split in HELD_OUT and not study.state["sealed"]:
            raise PlaygroundError("Held-out tasks can be played only after the study is sealed (protects the final test)")
        return t
    prompt = (spec.get("prompt") or "").strip()
    if not prompt or len(prompt) > 2000:
        raise PlaygroundError("Write a message (≤ 2000 characters)")
    return Task("playground", "playground", "playground", "playground", 0, prompt, [], "", {})


def _evidence(ep: dict) -> bool | None:
    """Agents only: is the answer a value some tool returned in this episode (or NOT_FOUND after a lookup found nothing)?"""
    from forge.agents.verify import answer_norm, atoms, is_not_found
    if ep.get("answer") is None:
        return None
    results = [e["result"] for e in ep["events"] if e["type"] == "tool_result" and e.get("error") is None and isinstance(e.get("result"), dict)]
    a = answer_norm(ep["answer"])
    if a == "not_found":
        return any(is_not_found(r) for r in results)
    produced = set().union(*(atoms(r) for r in results)) if results else set()
    return a in produced


def _actions(ep: dict) -> list[str]:
    acts = [canonical_json({"tool": c["tool"], "arguments": c["arguments"]}) for c in ep.get("calls", [])]
    if ep.get("answer") is not None:
        acts.append(canonical_json({"answer": str(ep["answer"]).strip().lower()}))
    return acts


def lane_backend(study: Any, lane: dict) -> Any:
    """The chat backend for one lane: base student, a trained adapter, a Weight Lab variant, or the teacher."""
    kind = lane.get("kind")
    if kind == "teacher":
        return study.teacher_backend()
    mk = lambda ad: TransformersBackend(study.plan["student"]["path"], ad, device=study.plan["device"], max_new_tokens=study.plan["eval"]["max_new_tokens"])
    if kind == "base":
        return mk(None)
    if kind == "adapter":
        ad = study.run_dir(lane["arm"], int(lane["seed"])) / "adapter"
        if not (ad / "adapter_model.safetensors").exists():
            raise PlaygroundError(f"No adapter for {lane['arm']} seed {lane['seed']}")
        return mk(str(ad))
    if kind == "variant":
        ad = Path(lane["path"]) / "adapter"
        if not (ad / "adapter_model.safetensors").exists():
            raise PlaygroundError("Variant not built")
        return mk(str(ad))
    raise PlaygroundError(f"Unknown lane {kind}")


def run(study: Any, spec: dict, emit: Callable[[dict], None] = lambda e: None,
        backend_for: Callable[[dict], Any] | None = None) -> dict:
    from forge.graphs.paths import path_graph
    task = _task(study, spec)
    lanes = spec.get("lanes") or []
    if not lanes or len(lanes) > 6:
        raise PlaygroundError("Choose 1–6 models to compare")
    world = study.world()
    cfg = EpisodeConfig(max_turns=study.plan["eval"]["max_turns"])
    agent_world = study.plan["taskset"].get("kind") == "agent"
    out_lanes = []
    from forge.engine import guard
    for i, lane in enumerate(lanes, 1):
        guard.check()
        kind = lane.get("kind")
        backend = backend_for(lane) if backend_for else lane_backend(study, lane)
        emit({"event": "playground_lane", "lane": lane.get("label") or kind, "done": i - 1, "total": len(lanes)})
        ep = run_episode(task, backend, world, cfg, arm=kind, seed=int(lane.get("seed", 0)))
        getattr(backend, "unload", lambda: None)()
        graph = path_graph(ep)
        if not task.reference_answer:  # free text: there is nothing to be right or wrong against
            for n in graph["nodes"]:
                if n["kind"] == "answer":
                    n["status"] = "neutral"
        out_lanes.append({"lane": lane, "label": lane.get("label") or kind, "model": ep["model"], "answer": ep["answer"],
                          "termination": ep["termination"], "errors": ep["score"].get("errors", []),
                          "score": ep["score"] if task.reference_answer else None, "evidence": _evidence(ep) if agent_world else None,
                          "usage": ep["usage"], "calls": ep["calls"], "graph": graph, "actions": _actions(ep)})
    teacher = next((l for l in out_lanes if l["lane"].get("kind") == "teacher"), None)
    for l in out_lanes:
        if teacher is None or l is teacher:
            l["diverges_at"] = None
            continue
        a, b = l["actions"], teacher["actions"]
        l["diverges_at"] = next((k for k in range(max(len(a), len(b))) if k >= len(a) or k >= len(b) or a[k] != b[k]), None)
    rid = new_id("play")
    res = {"id": rid, "created_at": utcnow(), "study_id": study.plan["study_id"], "prompt": task.prompt,
           "task": {"task_id": task.task_id, "family": task.family, "split": task.split, "reference_answer": task.reference_answer or None},
           "lanes": out_lanes, "agent": agent_world,
           "honesty": "Observable actions only. Free-text messages have no reference answer; 'backed by a tool result' checks evidence, not correctness."}
    d = study.root / "playground"
    d.mkdir(exist_ok=True)
    write_json_atomic(d / f"{rid}.json", json.dumps(res, default=str))
    emit({"event": "playground_done", "run_id": rid, "lanes": len(out_lanes)})
    return res
