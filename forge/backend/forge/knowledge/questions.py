"""Grounded practice questions, written by the teacher and verified before use.

Answerable: the teacher reads one passage and writes a self-contained question plus an answer
copied *verbatim* from it. Checks: valid JSON, a real question, the answer is a span of the passage,
the question does not leak the answer, no "this passage" phrasing.

Unanswerable: the teacher writes a plausible on-topic question; we retrieve the top passages and
the teacher must confirm they do NOT contain the answer. The reference answer is NOT_FOUND —
this is what teaches the student to refuse rather than invent.

Splits are by *document*: test questions come from documents the student never trained on.
Every rejected candidate is kept with its reason (shown in the UI to explain what "good" means).
"""
from __future__ import annotations

import json
import random
import re
from collections import defaultdict
from typing import Any, Callable

from forge.engine.runtime import ActionError, ChatBackend, strip_reasoning
from forge.engine.tasks import Task

ANSWERABLE_FAMILY, UNANSWERABLE_FAMILY = "doc_answerable", "doc_unanswerable"
DEICTIC = re.compile(r"\b(this|the|above|following) (passage|text|excerpt|document|section|paragraph)\b|\bthe author\b", re.I)

GEN_SYSTEM = "You write precise exam questions from source passages. Reply with exactly one JSON object and nothing else."
GEN_USER = (
    "Passage (from \"{title}\"):\n<<<\n{text}\n>>>\n\n"
    "Write ONE question that a reader can answer only by reading this passage, and its answer copied VERBATIM "
    "as a short span (2-12 words) from the passage.\n"
    "Rules: the question must make sense on its own (name the subject explicitly; never say 'this passage' or "
    "'the text'); do not put the answer inside the question.\n"
    'Reply as: {{"question": "...", "answer": "..."}}'
)
NEG_USER = (
    "A document collection contains this passage (from \"{title}\"):\n<<<\n{text}\n>>>\n\n"
    "Write ONE realistic question someone might ask about the same subject that this collection probably does "
    "NOT answer — for example a specific detail, number, or date that is not mentioned. Make it self-contained.\n"
    'Reply as: {{"question": "..."}}'
)
VERIFY_USER = (
    "Question: {question}\n\nPassages:\n{passages}\n\n"
    "Can the question be answered from these passages alone? Reply as: {{\"answerable\": true}} or {{\"answerable\": false}}"
)


def norm(s: str) -> str:
    s = s.lower().replace("’", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"\s+", " ", s)
    return s.strip(" .,:;!?\"'`*()[]")


def _json(backend: ChatBackend, user: str) -> dict:
    comp = backend.complete([{"role": "system", "content": GEN_SYSTEM}, {"role": "user", "content": user}])
    body, _ = strip_reasoning(comp.text)
    m = re.search(r"\{.*\}", body, re.S)
    if not m:
        raise ActionError("invalid_json", "no JSON object in reply")
    return json.loads(m.group(0))


def check_answerable(q: dict, passage: str) -> str | None:
    """Returns a rejection reason, or None if the candidate passes every check."""
    question, answer = str(q.get("question", "")).strip(), str(q.get("answer", "")).strip()
    if not question.endswith("?") or not 12 <= len(question) <= 300:
        return "not a well-formed question"
    if not 1 <= len(answer) <= 160 or len(answer.split()) > 20:
        return "answer missing or too long"
    if norm(answer) not in norm(passage):
        return "answer is not copied verbatim from the passage"
    if len(norm(answer)) > 3 and norm(answer) in norm(question):
        return "question gives the answer away"
    if DEICTIC.search(question):
        return "question depends on 'this passage' (not self-contained)"
    return None


def sample_chunks(chunks: list[dict], n: int, seed: int, min_chars: int = 200) -> list[dict]:
    """Round-robin across documents so every document contributes, deterministic for a seed.

    Prefers substantial passages (≥ min_chars); short-document collections (FAQs, notes) fall back to ≥ 80.
    """
    if sum(1 for c in chunks if len(c["text"]) >= min_chars) < n:
        min_chars = min(min_chars, 80)
    by_doc: dict[str, list[dict]] = defaultdict(list)
    for c in chunks:
        if len(c["text"]) >= min_chars:
            by_doc[c["doc_id"]].append(c)
    rng = random.Random(f"q:{seed}")
    for v in by_doc.values():
        rng.shuffle(v)
    docs = sorted(by_doc)
    rng.shuffle(docs)
    out: list[dict] = []
    while len(out) < n and any(by_doc[d] for d in docs):
        for d in docs:
            if by_doc[d] and len(out) < n:
                out.append(by_doc[d].pop())
    return out


def assign_splits(doc_ids: list[str], seed: int) -> tuple[dict[str, str], str]:
    """Document-level train/dev/test (60/20/20). Returns (doc → split, unit)."""
    docs = sorted(set(doc_ids))
    random.Random(f"split:{seed}").shuffle(docs)
    n = len(docs)
    if n < 3:
        return {}, "passage"
    n_dev = max(1, round(0.2 * n))
    n_test = max(1, round(0.2 * n))
    n_train = n - n_dev - n_test
    out = {d: ("train" if i < n_train else "dev" if i < n_train + n_dev else "test") for i, d in enumerate(docs)}
    return out, "document"


def generate(chunks: list[dict], docs: dict[str, dict], teacher: ChatBackend, search: Callable[[str, int], list[dict]],
             n: int = 60, unanswerable_frac: float = 0.25, seed: int = 7,
             emit: Callable[[dict], None] = lambda e: None) -> tuple[list[Task], list[dict], dict]:
    picked = sample_chunks(chunks, n, seed)
    if not picked:
        raise ValueError("No passage is long enough to write a question from (need ≥ 80 characters of text)")
    # The mix is applied to what was actually sampled (small collections yield fewer than n passages).
    n_neg = int(round(len(picked) * unanswerable_frac))
    if unanswerable_frac > 0 and len(picked) >= 2:
        n_neg = max(1, n_neg)
    n_pos = len(picked) - n_neg
    tasks: list[Task] = []
    rejected: list[dict] = []
    seen: set[str] = set()
    split_of, unit = assign_splits([c["doc_id"] for c in picked], seed)

    def split_for(c: dict, i: int) -> str:
        if split_of:
            return split_of[c["doc_id"]]
        return ("train", "train", "train", "dev", "test")[i % 5]  # tiny corpora: passage-level fallback

    for i, c in enumerate(picked):
        want_neg = i >= n_pos
        title = docs.get(c["doc_id"], {}).get("title", "")
        try:
            if not want_neg:
                q = _json(teacher, GEN_USER.format(title=title, text=c["text"]))
                reason = check_answerable(q, c["text"])
                if not reason and norm(q["question"]) in seen:
                    reason = "duplicate question"
                hits = search(q.get("question", ""), 5) if not reason else []
                retrievable = any(h["chunk_id"] == c["chunk_id"] for h in hits)
                if reason:
                    rejected.append({"chunk_id": c["chunk_id"], "kind": "answerable", "candidate": q, "reason": reason})
                else:
                    seen.add(norm(q["question"]))
                    tasks.append(Task(task_id=f"q{len(tasks):04d}", group_id=c["doc_id"] if unit == "document" else c["chunk_id"],
                                      family=ANSWERABLE_FAMILY, split=split_for(c, i), paraphrase=0, prompt=q["question"].strip(),
                                      reference_calls=[{"tool": "search", "arguments": {"query": q["question"].strip()}}],
                                      reference_answer=q["answer"].strip(),
                                      meta={"gold_chunk": c["chunk_id"], "doc_id": c["doc_id"], "retrievable": retrievable,
                                            "source": "teacher", "unit": unit}))
            else:
                q = _json(teacher, NEG_USER.format(title=title, text=c["text"]))
                question = str(q.get("question", "")).strip()
                reason = None if question.endswith("?") and 12 <= len(question) <= 300 else "not a well-formed question"
                if not reason and DEICTIC.search(question):
                    reason = "question depends on 'this passage' (not self-contained)"
                if not reason and norm(question) in seen:
                    reason = "duplicate question"
                if not reason:
                    hits = search(question, 5)
                    passages = "\n".join(f"[{h['chunk_id']}] {h['text'][:700]}" for h in hits)
                    verdict = _json(teacher, VERIFY_USER.format(question=question, passages=passages))
                    if verdict.get("answerable") is not False:
                        reason = "teacher found the answer in the collection (not unanswerable)"
                if reason:
                    rejected.append({"chunk_id": c["chunk_id"], "kind": "unanswerable", "candidate": q, "reason": reason})
                else:
                    seen.add(norm(question))
                    tasks.append(Task(task_id=f"q{len(tasks):04d}", group_id=c["doc_id"] if unit == "document" else c["chunk_id"],
                                      family=UNANSWERABLE_FAMILY, split=split_for(c, i), paraphrase=0, prompt=question,
                                      reference_calls=[{"tool": "search", "arguments": {"query": question}}],
                                      reference_answer="NOT_FOUND",
                                      meta={"gold_chunk": None, "doc_id": c["doc_id"], "retrievable": None,
                                            "source": "teacher", "unit": unit}))
        except Exception as e:  # one bad generation never stops the batch; it is recorded
            rejected.append({"chunk_id": c["chunk_id"], "kind": "unanswerable" if want_neg else "answerable",
                             "candidate": None, "reason": f"{type(e).__name__}: {str(e)[:160]}"})
        emit({"event": "question", "done": i + 1, "total": len(picked), "accepted": len(tasks), "rejected": len(rejected)})
    counts = {s: sum(1 for t in tasks if t.split == s) for s in ("train", "dev", "test")}
    summary = {"accepted": len(tasks), "rejected": len(rejected), "split_unit": unit, "splits": counts,
               "answerable": sum(t.family == ANSWERABLE_FAMILY for t in tasks),
               "unanswerable": sum(t.family == UNANSWERABLE_FAMILY for t in tasks),
               "retrievable_rate": (sum(1 for t in tasks if t.meta.get("retrievable")) /
                                    max(1, sum(t.family == ANSWERABLE_FAMILY for t in tasks)))}
    return tasks, rejected, summary
