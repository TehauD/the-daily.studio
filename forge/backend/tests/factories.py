from forge.domain.trajectory import Trajectory


def traj(tid="t1", task_id="task-1", label="success", approved=True, score=0.9, flags=(), tools=True,
         content="Answer: 42", model_id="mdl_teacher", termination="completed", excluded=False):
    events = [
        {"type": "system", "ts": "2026-01-01T00:00:00Z", "content": "You are precise."},
        {"type": "user", "ts": "2026-01-01T00:00:01Z", "content": "What is 6*7?"},
    ]
    if tools:
        events += [
            {"type": "assistant", "ts": "2026-01-01T00:00:02Z", "content": "<think>secret plan</think>Calling calculator.",
             "tool_calls": [{"id": "c1", "name": "calculator", "arguments": {"expr": "6*7"}}], "prompt_tokens": 20, "completion_tokens": 8},
            {"type": "tool_result", "ts": "2026-01-01T00:00:03Z", "call_id": "c1", "name": "calculator", "content": "42"},
        ]
    events.append({"type": "assistant", "ts": "2026-01-01T00:00:04Z", "content": content, "prompt_tokens": 30, "completion_tokens": 4})
    return Trajectory.model_validate({
        "id": tid, "model": {"model_id": model_id, "provider": "ollama", "name": "teacher"},
        "task": {"task_id": task_id, "prompt": "What is 6*7?", "system": "You are precise.",
                 "tools": [{"type": "function", "function": {"name": "calculator", "parameters": {"type": "object"}}}]},
        "events": events, "started_at": "2026-01-01T00:00:00Z", "ended_at": "2026-01-01T00:00:04Z", "duration_ms": 4000,
        "final_output": content, "termination": termination,
        "review": {"label": label, "approved": approved, "score": score, "flags": list(flags), "excluded": excluded},
    })
