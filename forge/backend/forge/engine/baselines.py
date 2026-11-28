"""Few-shot prompting baseline: does training beat simply showing the untrained student a few worked examples?

The `fewshot` arm is the *untrained* student with k complete, teacher-verified training conversations (the user request,
each tool call, each tool result and the final answer) appended to its system prompt as examples. It is evaluated like the
untrained student (one run, greedy decoding), on the same practice tasks and — after SEAL — the same final test.

Examples come only from the TRAINING split, one per skill where possible, chosen with a fixed seed. They are frozen in
`reports/fewshot_examples.json` (with their hash) the first time they are used, so practice and final test see the same ones.
If prompting alone matches the trained student, training was not needed for this task set; if training beats it, the gain
over prompting is the value training adds.
"""
from __future__ import annotations

import hashlib
import json
import random
from collections import defaultdict
from typing import Any

from forge.engine.runtime import Completion

ARM = "fewshot"
HEADER = "\n\nWorked examples (from practice data; follow the same format):"


def _conversations(study: Any) -> list[dict[str, Any]]:
    """Whole training conversations, rebuilt from the per-turn records of the first non-control dataset."""
    root = study.root / "datasets"
    train_ids = {t.task_id for t in study.tasks() if t.split == "train"}
    for arm in study.plan["arms"]:
        data = (study.plan.get("arm_overrides") or {}).get(arm, {}).get("data", arm)
        f = root / data / "records.jsonl"
        if data == "shuffled_control" or not f.exists():
            continue
        last: dict[str, dict] = {}
        for line in f.read_text(encoding="utf-8").splitlines():
            r = json.loads(line)
            if r["task_id"] in train_ids and (r["task_id"] not in last or r["turn"] > last[r["task_id"]]["turn"]):
                last[r["task_id"]] = r
        convs = []
        for tid, r in sorted(last.items()):
            msgs = [m for m in r["prompt_messages"] if m["role"] != "system"] + [{"role": "assistant", "content": r["completion"]}]
            convs.append({"task_id": tid, "family": r["family"], "messages": msgs})
        return convs
    return []


def choose(study: Any, k: int) -> dict[str, Any]:
    p = study.root / "reports" / "fewshot_examples.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    convs = _conversations(study)
    if not convs:
        raise ValueError("No training conversations to use as examples (run Build first)")
    rng = random.Random(f"fewshot:{study.plan['study_id']}")
    by_fam: dict[str, list] = defaultdict(list)
    for c in convs:
        by_fam[c["family"]].append(c)
    fams = sorted(by_fam)
    rng.shuffle(fams)
    picked = []
    while len(picked) < k and any(by_fam.values()):      # round-robin over skills: one example per skill first
        for f in fams:
            if by_fam[f] and len(picked) < k:
                picked.append(by_fam[f].pop(rng.randrange(len(by_fam[f]))))
    text = HEADER + "".join(
        f"\n\n### Example {i}\n" + "\n".join(f"{m['role'].upper()}: {m['content']}" for m in c["messages"]) for i, c in enumerate(picked, 1))
    out = {"k": len(picked), "task_ids": [c["task_id"] for c in picked], "families": [c["family"] for c in picked],
           "text": text, "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(), "source": "training split only"}
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, indent=2), encoding="utf-8")
    return out


class FewShotBackend:
    """Wraps a backend: the examples go at the end of the system prompt; the conversation itself is unchanged."""

    def __init__(self, inner: Any, examples_text: str):
        self.inner, self.text = inner, examples_text
        self.name = f"fewshot:{getattr(inner, 'name', 'student')}"

    def complete(self, messages: list[dict[str, str]]) -> Completion:
        if messages and messages[0]["role"] == "system":
            messages = [{"role": "system", "content": messages[0]["content"] + self.text}] + messages[1:]
        return self.inner.complete(messages)

    def __getattr__(self, k: str) -> Any:  # on_retry, unload … pass through
        return getattr(self.inner, k)
