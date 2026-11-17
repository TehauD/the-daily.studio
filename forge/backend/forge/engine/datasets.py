"""Episodes → supervised prompt/completion records.

One record per assistant turn: prompt = every message before that turn,
completion = that turn's canonical JSON action. Loss is computed on the
completion tokens only (labels = -100 on the prompt).

Tokenization guarantees (enforced in `tokenize_record`):
- exact prefix: tokens(prompt + generation header) is a prefix of tokens(full conversation);
  if a chat template breaks this, the record is rejected loudly — never "fixed" silently.
- no truncation: an over-length record raises OverlengthError, which blocks the run.

Arms share the same *eligible task ids* so they differ only in the factor under study.
"""
from __future__ import annotations

import random
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from forge.util import canonical_json, sha256_text

IGNORE_INDEX = -100


class OverlengthError(ValueError):
    pass


class PrefixMismatchError(ValueError):
    pass


def episode_records(ep: dict[str, Any], last_turn_only: bool = False) -> list[dict[str, Any]]:
    msgs = ep["messages"]
    idx = [i for i, m in enumerate(msgs) if m["role"] == "assistant"]
    if last_turn_only:
        idx = idx[-1:]
    out = []
    for n, i in enumerate(idx):
        out.append({
            "prompt_messages": msgs[:i], "completion": msgs[i]["content"],
            "task_id": ep["task_id"], "group_id": ep["group_id"], "family": ep["family"], "turn": n,
            "trajectory_hash": ep["trace_hash"], "source_model": ep["model"],
        })
    return out


@dataclass
class BuildPolicy:
    arm: str = "teacher_filtered"   # teacher_raw | teacher_filtered | oracle_sft | quarter_data | last_turn_only
    quarter_fraction: float = 0.25
    seed: int = 1234


def eligible_task_ids(teacher_eps: list[dict], oracle_eps: list[dict]) -> set[str]:
    """Tasks usable by *every* arm: the teacher strictly succeeded (filtered arm needs it) and an oracle exists."""
    ok = {e["task_id"] for e in teacher_eps if e["score"]["strict_success"]}
    return ok & {e["task_id"] for e in oracle_eps}


def nested_group_subset(group_ids: list[str], fraction: float, seed: int) -> set[str]:
    """Deterministic subset of groups; smaller fractions are nested inside larger ones (same shuffle prefix)."""
    order = sorted(set(group_ids))
    random.Random(f"nest:{seed}").shuffle(order)
    return set(order[: max(1, round(fraction * len(order)))])


def build_arm(policy: BuildPolicy, teacher_eps: list[dict], oracle_eps: list[dict]) -> dict[str, Any]:
    """Returns {records, exclusions, eligible_task_ids}. Only 'train' split episodes are ever used."""
    teacher_eps = [e for e in teacher_eps if e["split"] == "train"]
    oracle_eps = [e for e in oracle_eps if e["split"] == "train"]
    eligible = eligible_task_ids(teacher_eps, oracle_eps)
    exclusions: dict[str, int] = defaultdict(int)
    source = {"oracle_sft": oracle_eps}.get(policy.arm, teacher_eps)
    chosen: list[dict] = []
    for e in sorted(source, key=lambda x: x["task_id"]):
        if e["task_id"] not in eligible:
            exclusions["task_not_eligible_for_all_arms"] += 1
            continue
        if policy.arm in ("teacher_filtered", "quarter_data", "last_turn_only") and not e["score"]["strict_success"]:
            exclusions["teacher_not_strict_success"] += 1
            continue
        if any(ev["type"] == "error" for ev in e["events"]):
            exclusions["episode_has_error_event"] += 1
            continue
        chosen.append(e)
    if policy.arm == "quarter_data":
        keep = nested_group_subset([e["group_id"] for e in chosen], policy.quarter_fraction, policy.seed)
        exclusions["outside_quarter_subset"] += sum(1 for e in chosen if e["group_id"] not in keep)
        chosen = [e for e in chosen if e["group_id"] in keep]
    records = [r for e in chosen for r in episode_records(e, last_turn_only=policy.arm == "last_turn_only")]
    for r in records:
        r["record_sha256"] = sha256_text(canonical_json({k: r[k] for k in ("prompt_messages", "completion")}))
    return {"records": records, "exclusions": dict(exclusions), "eligible_task_ids": sorted(eligible),
            "episodes_used": len(chosen)}


def _chat(tokenizer: Any, messages: list[dict[str, str]], add_generation_prompt: bool) -> str:
    try:
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=add_generation_prompt,
                                             enable_thinking=False)
    except TypeError:
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=add_generation_prompt)


def tokenize_record(tokenizer: Any, rec: dict[str, Any], max_len: int, all_token_loss: bool = False) -> dict[str, list[int]]:
    prompt_text = _chat(tokenizer, rec["prompt_messages"], add_generation_prompt=True)
    full_text = _chat(tokenizer, rec["prompt_messages"] + [{"role": "assistant", "content": rec["completion"]}],
                      add_generation_prompt=False)
    if not full_text.startswith(prompt_text):
        raise PrefixMismatchError(f"{rec['task_id']} turn {rec['turn']}: chat template text is not prefix-stable")
    p_ids = tokenizer(prompt_text, add_special_tokens=False)["input_ids"]
    f_ids = tokenizer(full_text, add_special_tokens=False)["input_ids"]
    if f_ids[: len(p_ids)] != p_ids:
        raise PrefixMismatchError(f"{rec['task_id']} turn {rec['turn']}: token prefix differs (merge across boundary)")
    if len(f_ids) > max_len:
        raise OverlengthError(f"{rec['task_id']} turn {rec['turn']}: {len(f_ids)} tokens > max {max_len}")
    if len(f_ids) == len(p_ids):
        raise PrefixMismatchError(f"{rec['task_id']} turn {rec['turn']}: empty completion")
    labels = list(f_ids) if all_token_loss else [IGNORE_INDEX] * len(p_ids) + f_ids[len(p_ids):]
    return {"input_ids": f_ids, "labels": labels, "attention_mask": [1] * len(f_ids)}


def tokenize_all(tokenizer: Any, records: list[dict], max_len: int, all_token_loss: bool = False) -> tuple[list[dict], dict]:
    """All-or-nothing: any overlength / prefix failure raises (blocks the run) with every offender listed."""
    out, problems = [], []
    for r in records:
        try:
            out.append(tokenize_record(tokenizer, r, max_len, all_token_loss))
        except (OverlengthError, PrefixMismatchError) as e:
            problems.append(str(e))
    if problems:
        raise OverlengthError(f"{len(problems)} record(s) rejected; run blocked: " + "; ".join(problems[:10]))
    lens = [len(x["input_ids"]) for x in out]
    sup = [sum(1 for t in x["labels"] if t != IGNORE_INDEX) for x in out]
    return out, {"records": len(out), "tokens_total": sum(lens), "supervised_tokens": sum(sup),
                 "max_len": max(lens, default=0), "mean_len": (sum(lens) / len(lens)) if lens else 0}
