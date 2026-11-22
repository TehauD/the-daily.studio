"""FORGE Assistant: instructions, suggested questions, exact-payload preview, approval by hash, local audit + history."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from forge.agents import safety
from forge.assistant.context import redact, size_of
from forge.util import canonical_json, sha256_text, utcnow

SYSTEM = """You are the FORGE Assistant, embedded in FORGE — a local lab that distills a large *teacher* model (run in LM Studio) into a
small *student* model (Hugging Face weights, LoRA fine-tuning on one consumer NVIDIA GPU), and measures whether it improved.

What you know about FORGE
- Study lifecycle: collect (teacher solves tasks) → build (only verified, strictly successful teacher episodes become training
  records; one record per assistant turn, loss on the completion only, no truncation) → train (LoRA r16/α32 default, one process
  per arm × seed, gates: zero-adapter check, base-hash unchanged, free VRAM, teacher unloaded) → evaluate dev → analyze dev →
  SEAL (freezes adapters; no more training) → evaluate test/OOD/regression → analyze test → optional merged export.
- Profiles: smoke = wiring only (2 steps, 1 seed, no claims); pilot = 3 seeds, exploratory; research = 6 seeds, preregistered, review gate.
- Arms: teacher_filtered (primary), teacher_raw, oracle_sft, quarter_data, last_turn_only, rank4, attention_only, all_token_loss (ablations).
- Statistics: paired seed × group matrix; crossed bootstrap 95% CI of the gain (tuned − base strict success); exact/Monte-Carlo
  sign-flip tests over groups and seeds; Holm correction for secondary contrasts; McNemar diagnostic; review gate = candidate for
  human review only. With 3 seeds the minimum seed-level sign-flip p is 0.25.
- Strict success: right answer AND right tools/arguments (catalog) or gold passage retrieved (doc-QA) or answer backed by a tool
  result (agents) AND no errors.
- Focus skills: training uses only chosen skills; all skills are evaluated; the focus contrast is primary, off-focus is secondary.
- Distillation Lens: teacher-forced NLL per teacher action token ("surprise", lower = closer to teacher) and top-1 agreement, at
  training snapshots; word heatmap = log p(final adapter) − log p(base) per teacher token on dev episodes. It shows which tokens
  became expected, not why, and is not task success.
- Knowledge Studio: documents → passages → BM25 + embedding hybrid search (RRF) → teacher-written questions verified verbatim,
  plus unanswerable ones → doc-QA study (search tool, NOT_FOUND). Splits by document.
- Agent Studio: role + read-only tools (table lookup/find, exact calculator, unit conversion, date math, user rules, document
  search) + skills with examples → teacher writes tasks; FORGE keeps a task only if it re-executes the calls with grounded
  arguments and the answer is a value a tool returned. Splits by entity.
- Hardware context: typically one 16 GB GPU; the teacher must be unloaded before training/evaluation.

How to answer
- Ground every statement in the DATA provided. Quote the numbers you use. If the data does not support a conclusion, say so.
- Separate clearly: what was measured, what it implies, what is speculation.
- Be practical: name the FORGE page and the exact setting or action (e.g. "Experiment Studio → New study → profile pilot,
  Focus skills: Multi-step quote"). Prefer the smallest change that tests one hypothesis.
- Respect research integrity: decide on dev results only; never suggest re-running test after seeing it; suggest preregistering.
- Never claim clinical validity, deployment readiness, broad reasoning transfer, or that you can see a model's hidden reasoning.
  FORGE permits synthetic or non-sensitive data only — if the data looks like it contains personal data, say so.
- Be concise: short paragraphs and bullet lists, Markdown, no tables wider than 4 columns."""

PROMPTS: dict[str, list[dict[str, Any]]] = {
    "study": [
        {"label": "Explain these results", "q": "Explain this study's results in plain language: what improved, by how much, how certain, and what did not.", "content": False},
        {"label": "Is the gain real?", "q": "Is the measured gain trustworthy? Discuss the confidence interval, the sign-flip p-values, the number of seeds, and anything that could make it misleading.", "content": False},
        {"label": "What should I try next?", "q": "Recommend the next 1–3 experiments to get a larger, trustworthy gain, with exact FORGE settings, and say which hypothesis each tests.", "content": False},
        {"label": "Interpret the Lens", "q": "Interpret the Distillation Lens: the surprise / agreement curve and the tokens gained or lost. Is training still helping? What did the student actually learn?", "content": True},
        {"label": "Why does it fail?", "q": "Look at the student's failed dev episodes next to the teacher's actions. Group the failure modes and suggest fixes (data, skills, settings).", "content": True},
    ],
    "agent": [
        {"label": "Review my agent", "q": "Review this agent's role, tools, rules and skills. What is missing or ambiguous, and how would you improve it for a small student model?", "content": False},
        {"label": "Why were tasks rejected?", "q": "Explain the rejection reasons and how to change the skills, examples or tools so more tasks pass verification.", "content": False},
        {"label": "Improve my examples", "q": "Review my skill examples and sample tasks. Suggest better examples (with tool calls) and point out tasks that are too easy, ambiguous, or repetitive.", "content": True},
        {"label": "Suggest new skills", "q": "Given this agent's role, tables and rules, suggest 3 additional narrow skills with a description, allowed tools, and two example tasks each.", "content": True},
    ],
    "pack": [
        {"label": "Is my search good enough?", "q": "Assess this knowledge pack's search quality and question set. What limits the student, and what should I change first?", "content": False},
        {"label": "Why does search miss?", "q": "Look at the questions search missed. Explain why each was missed and what would fix it (chunk size, embedding model, wording).", "content": True},
    ],
    "general": [
        {"label": "Where do I start?", "q": "Given my setup, what should my next steps in FORGE be, in order?", "content": False},
        {"label": "Pick my models", "q": "Given the models assigned as teacher and student, are they a good pair for distillation on one 16 GB GPU? What would you change?", "content": False},
    ],
}


class AssistantError(RuntimeError):
    def __init__(self, msg: str, status: int = 422):
        super().__init__(msg)
        self.status = status


def build_messages(summary: dict, content: dict | None, question: str, history: list[dict]) -> list[dict[str, str]]:
    data = {"summary": redact(summary)}
    if content:
        data["content"] = redact(content)
    msgs = [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": "DATA (from FORGE, JSON):\n" + json.dumps(data, ensure_ascii=False, default=str)}]
    for h in history[-6:]:
        if h.get("role") in ("user", "assistant") and isinstance(h.get("content"), str):
            msgs.append({"role": h["role"], "content": redact(h["content"])[:6000]})
    msgs.append({"role": "user", "content": redact(question.strip())[:4000]})
    payload = json.dumps(msgs, ensure_ascii=False)
    scan = safety.scan_text(payload)
    if scan["block"]:
        raise AssistantError("Not sent: the payload looks like it contains personal data (" + ", ".join(scan["block"]) +
                             "). FORGE permits synthetic or non-sensitive data only.", 422)
    return msgs


def payload_hash(msgs: list[dict[str, str]]) -> str:
    return sha256_text(canonical_json(msgs))


class Ledger:
    """Local record of what was sent (hash + size, never the key) and of the conversation — nothing leaves the machine."""

    def __init__(self, home: Path):
        self.dir = home / "assistant"
        self.dir.mkdir(parents=True, exist_ok=True)

    def _append(self, name: str, row: dict) -> None:
        with open(self.dir / name, "a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    def record(self, scope: str, sid: str | None, msgs: list[dict], included_content: bool, deployment: str, result: dict | None,
               error: str | None, question: str) -> None:
        h = payload_hash(msgs)
        self._append("audit.jsonl", {"ts": utcnow(), "scope": scope, "id": sid, "payload_sha256": h, "bytes": size_of(msgs),
                                     "included_content": included_content, "deployment": deployment,
                                     "usage": (result or {}).get("usage"), "error": error})
        if result:
            self._append("history.jsonl", {"ts": utcnow(), "scope": scope, "id": sid, "question": question,
                                           "answer": result["text"], "payload_sha256": h, "included_content": included_content})

    def history(self, scope: str, sid: str | None, limit: int = 20) -> list[dict]:
        p = self.dir / "history.jsonl"
        if not p.exists():
            return []
        rows = [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x]
        return [r for r in rows if r["scope"] == scope and r.get("id") == sid][-limit:]

    def audit(self, limit: int = 50) -> list[dict]:
        p = self.dir / "audit.jsonl"
        return [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines()[-limit:] if x] if p.exists() else []
