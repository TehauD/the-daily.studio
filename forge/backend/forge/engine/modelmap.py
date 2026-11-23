"""Model Map: what the student's internals look like when it decides what to do.

Representation map — for each task, the hidden state at the *decision point* (the last prompt position, where the model
is about to emit its first action) is read at every layer, for the untrained and the trained student. Per layer:
  • a 2-D PCA fitted jointly on both models (same axes, so the two panels are comparable) + variance shown;
  • cluster quality by skill in the FULL space: silhouette (cosine) and k-NN skill purity (share of each task's 5 nearest
    tasks that share its skill). Rising values across layers / after training = the model organises tasks by skill.

Word view (one task, one model):
  • word influence: gradient × input on the user's words, for the log-probability of the model's own first action
    (an attribution *approximation*, labelled as such);
  • layer-by-layer prediction ("logit lens"): at the position just before the decision token, each layer's hidden state
    is projected through the final norm and unembedding → top tokens and the probability of the token finally chosen.
    Early-layer readings are rough by nature.

Measurements of real activations. They show *where and how strongly* things are organised, not a chain of thought.
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable

import numpy as np

from forge.engine.runtime import render_prompt
from forge.util import new_id, utcnow, write_json_atomic

MAP_VERSION = 1
MAX_TASKS = 300
HELD_OUT = ("test", "ood", "regression")


class ModelMapError(ValueError):
    pass


def pick_tasks(study: Any, split: str, limit: int = MAX_TASKS) -> list:
    if split in HELD_OUT and not study.state["sealed"]:
        raise ModelMapError("Held-out splits can be mapped only after the study is sealed")
    by: dict[str, list] = {}
    for t in study.tasks():
        if t.split == split:
            by.setdefault(t.family, []).append(t)
    out: list = []
    while len(out) < limit and any(by.values()):
        for f in sorted(by):
            if by[f] and len(out) < limit:
                out.append(by[f].pop(0))
    if not out:
        raise ModelMapError(f"No {split} tasks")
    return out


# ------------------------------------------------------------------ geometry
def _unit(x: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(x, axis=1, keepdims=True)
    return x / np.where(n == 0, 1, n)


def silhouette(x: np.ndarray, labels: list[str]) -> float | None:
    labs = np.array(labels)
    if len(set(labels)) < 2 or len(labels) < 3:
        return None
    u = _unit(x)
    d = 1.0 - u @ u.T
    s = []
    for i in range(len(labs)):
        same = labs == labs[i]
        same[i] = False
        if not same.any():
            continue
        a = d[i, same].mean()
        b = min(d[i, labs == other].mean() for other in set(labels) if other != labs[i])
        s.append((b - a) / max(a, b) if max(a, b) > 0 else 0.0)
    return float(np.mean(s)) if s else None


def knn_purity(x: np.ndarray, labels: list[str], k: int = 5) -> float | None:
    if len(labels) < 3:
        return None
    k = min(k, len(labels) - 1)
    u = _unit(x)
    sim = u @ u.T
    np.fill_diagonal(sim, -np.inf)
    nn = np.argpartition(-sim, k, axis=1)[:, :k]
    labs = np.array(labels)
    return float(np.mean([(labs[nn[i]] == labs[i]).mean() for i in range(len(labs))]))


def joint_pca(a: np.ndarray, b: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    """Shared axes for both models. Each model is centred on its own mean first, so the axes describe how tasks are
    arranged (structure), not the overall offset training introduced (reported separately as `shift`)."""
    a0, b0 = a - a.mean(0), b - b.mean(0)
    x = np.concatenate([a0, b0], 0)
    _, s, vt = np.linalg.svd(x, full_matrices=False)
    var = float((s[:2] ** 2).sum() / max((s ** 2).sum(), 1e-12))
    return a0 @ vt[:2].T, b0 @ vt[:2].T, var


# ------------------------------------------------------------------ model access
def _load(study: Any, adapter: str | None):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    path, device = study.plan["student"]["path"], study.plan["device"]
    tok = AutoTokenizer.from_pretrained(path, local_files_only=True, trust_remote_code=False)
    dtype = torch.bfloat16 if device == "cuda" else torch.float32
    model = AutoModelForCausalLM.from_pretrained(path, local_files_only=True, trust_remote_code=False, torch_dtype=dtype).to(device)
    if adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, adapter, is_trainable=False)
    model.eval()
    return tok, model, device


def _messages(study: Any, prompt: str, world: Any) -> list[dict[str, str]]:
    return [{"role": "system", "content": world.system_prompt if hasattr(world, "system_prompt") else ""},
            {"role": "user", "content": prompt}]


def decision_states(tok: Any, model: Any, device: str, texts: list[str], emit: Callable, label: str) -> np.ndarray:
    """[layers+1, n, d] hidden states at the last prompt position."""
    import torch
    out = []
    with torch.no_grad():
        for i, t in enumerate(texts, 1):
            ids = tok(t, return_tensors="pt", add_special_tokens=False)["input_ids"].to(device)
            hs = model(input_ids=ids, output_hidden_states=True).hidden_states
            out.append(np.stack([h[0, -1].float().cpu().numpy() for h in hs]))
            if i % 10 == 0 or i == len(texts):
                emit({"event": "modelmap_progress", "model": label, "done": i, "total": len(texts)})
    return np.stack(out, 1)


def _adapter_for(study: Any, arm: str | None, seed: int | None) -> tuple[str, str, int]:
    arm = arm or study.plan["arms"][0]
    seed = study.plan["seeds"][0] if seed is None else seed
    ad = study.run_dir(arm, seed) / "adapter"
    if not (ad / "adapter_model.safetensors").exists():
        raise ModelMapError(f"No adapter for {arm} seed {seed} yet (run Train)")
    return str(ad), arm, seed


def run_map(study: Any, split: str = "dev", arm: str | None = None, seed: int | None = None,
            emit: Callable[[dict], None] = lambda e: None) -> dict:
    tasks = pick_tasks(study, split)
    adapter, arm, seed = _adapter_for(study, arm, seed)
    world = study.world()
    emit({"event": "modelmap_start", "tasks": len(tasks), "split": split})
    tok, model, device = _load(study, None)
    texts = [render_prompt(tok, _messages(study, t.prompt, world)) for t in tasks]
    base = decision_states(tok, model, device, texts, emit, "untrained")
    from peft import PeftModel
    model = PeftModel.from_pretrained(model, adapter, is_trainable=False)
    model.eval()
    tuned = decision_states(tok, model, device, texts, emit, "trained")
    del model
    labels = [t.family for t in tasks]
    layers = []
    for L in range(base.shape[0]):
        pb, pt, var = joint_pca(base[L], tuned[L])
        layers.append({"layer": L, "variance_2d": var,
                       "base": {"xy": np.round(pb, 4).tolist(), "silhouette": silhouette(base[L], labels), "knn_purity": knn_purity(base[L], labels)},
                       "tuned": {"xy": np.round(pt, 4).tolist(), "silhouette": silhouette(tuned[L], labels), "knn_purity": knn_purity(tuned[L], labels)},
                       "shift": float(np.mean(np.linalg.norm(tuned[L] - base[L], axis=1) / np.maximum(np.linalg.norm(base[L], axis=1), 1e-9)))})
    res = {"map_version": MAP_VERSION, "computed": True, "generated_at": utcnow(), "split": split, "arm": arm, "seed": seed,
           "tasks": [{"task_id": t.task_id, "family": t.family, "prompt": t.prompt[:240]} for t in tasks],
           "layers": layers, "n_layers": base.shape[0] - 1, "hidden_size": int(base.shape[2]),
           "honesty": ("Hidden states at the decision point, measured. 2-D positions are a projection (variance shown); cluster scores are "
                       "computed in the full space. This shows how tasks are organised inside the model, not a chain of thought.")}
    d = study.root / "modelmap"
    d.mkdir(exist_ok=True)
    write_json_atomic(d / f"map_{split}_{arm}_s{seed}.json", json.dumps(res))
    emit({"event": "modelmap_done", "layers": len(layers)})
    return res


DECISION = re.compile(r'"(tool|answer)"\s*:\s*"?')


def run_explain(study: Any, task_id: str | None, prompt: str | None, model_key: str, arm: str | None = None, seed: int | None = None,
                emit: Callable[[dict], None] = lambda e: None) -> dict:
    import torch
    if task_id:
        t = next((x for x in study.tasks() if x.task_id == task_id), None)
        if t is None:
            raise ModelMapError("Unknown task")
        if t.split in HELD_OUT and not study.state["sealed"]:
            raise ModelMapError("Held-out tasks can be explained only after the study is sealed")
        prompt, family = t.prompt, t.family
    else:
        if not prompt or len(prompt) > 2000:
            raise ModelMapError("Write a message (≤ 2000 characters)")
        family = None
    adapter = None
    if model_key == "trained":
        adapter, arm, seed = _adapter_for(study, arm, seed)
    tok, model, device = _load(study, adapter)
    world = study.world()
    text = render_prompt(tok, _messages(study, prompt, world))
    ids = tok(text, return_tensors="pt", add_special_tokens=False)["input_ids"].to(device)
    with torch.no_grad():
        gen = model.generate(input_ids=ids, attention_mask=torch.ones_like(ids), max_new_tokens=48, do_sample=False,
                             pad_token_id=tok.pad_token_id or tok.eos_token_id)
    generated = tok.decode(gen[0, ids.shape[1]:], skip_special_tokens=True)
    m = DECISION.search(generated)
    dec_char = m.end() if m else 0
    full = text + generated
    enc = tok(full, return_offsets_mapping=True, add_special_tokens=False)
    full_ids, offsets = enc["input_ids"], enc["offset_mapping"]
    start = len(text) + dec_char
    di = next((i for i, (a, b) in enumerate(offsets) if a >= start and b > a), None)
    if di is None or di == 0:
        di = min(len(full_ids) - 1, max(1, ids.shape[1]))
    chosen = full_ids[di]
    target_end = min(len(full_ids), di + 6)
    x = torch.tensor([full_ids[:target_end]], device=device)
    # Layer-by-layer prediction at the position that produces the decision token.
    base_model = model.get_base_model() if hasattr(model, "get_base_model") else model
    norm = getattr(getattr(base_model, "model", base_model), "norm", None)
    head = base_model.get_output_embeddings()
    lens = []
    with torch.no_grad():
        hs = model(input_ids=x, output_hidden_states=True).hidden_states
        n = len(hs) - 1
        for L, h in enumerate(hs):
            v = h[0, di - 1]
            if L < n and norm is not None:
                v = norm(v.unsqueeze(0))[0]
            p = torch.softmax(head(v.unsqueeze(0)).float()[0], -1)
            top = torch.topk(p, 5)
            lens.append({"layer": L, "top": [{"t": tok.decode([int(i)]), "p": round(float(q), 4)} for q, i in zip(top.values, top.indices)],
                         "chosen_p": round(float(p[chosen]), 5), "chosen_rank": int((p > p[chosen]).sum()) + 1})
    # Word influence: grad × input for log p(first action tokens).
    emb = model.get_input_embeddings()(x).detach().requires_grad_(True)
    logits = model(inputs_embeds=emb).logits[0].float()
    lp = torch.log_softmax(logits[di - 1: target_end - 1], -1)
    tgt = x[0, di:target_end]
    score = lp[torch.arange(len(tgt)), tgt].sum()
    score.backward()
    attr = (emb.grad[0] * emb[0]).sum(-1).abs().float().detach().cpu().numpy()[: len(offsets)]
    u0 = text.rfind(prompt)
    u1 = u0 + len(prompt)
    total = float(attr[:di].sum()) or 1.0
    user_share = float(sum(a for a, (s, e) in zip(attr[:di], offsets[:di]) if s >= u0 and e <= u1)) / total
    words, cur, cur_s, cur_e = [], 0.0, None, None
    for a, (s, e) in zip(attr[:di], offsets[:di]):
        if s < u0 or e > u1 or e <= s:
            continue
        piece = full[s:e]
        if cur_s is not None and (piece[:1].isspace() or s > cur_e):
            words.append({"w": full[cur_s:cur_e].strip(), "score": cur})
            cur, cur_s = 0.0, None
        if cur_s is None:
            cur_s = s
        cur_e, cur = e, cur + float(a)
    if cur_s is not None:
        words.append({"w": full[cur_s:cur_e].strip(), "score": cur})
    mx = max((w["score"] for w in words), default=0.0) or 1.0
    words = [{"w": w["w"], "score": round(w["score"] / mx, 4)} for w in words if w["w"]]
    del model
    res = {"id": new_id("expl"), "generated_at": utcnow(), "task_id": task_id, "family": family, "prompt": prompt, "model": model_key,
           "arm": arm, "seed": seed, "first_action": generated[:200], "decision_token": tok.decode([chosen]), "words": words,
           "user_share": round(user_share, 4), "lens": lens, "n_layers": len(lens) - 1,
           "honesty": ("Word influence is gradient × input — an approximation of which words mattered for the model's first action. "
                       "Layer-by-layer predictions read intermediate layers through the final layer's output head; early layers are rough.")}
    d = study.root / "modelmap"
    d.mkdir(exist_ok=True)
    write_json_atomic(d / f"{res['id']}.json", json.dumps(res))
    emit({"event": "modelmap_explained", "id": res["id"], "decision_token": res["decision_token"]})
    return res
