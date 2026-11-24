"""Compare any two things FORGE has measured, on exactly the same tasks, and show how results moved over time.

Subjects (a "ref" string names one):
  arm:<study>:<arm>              a study's base student, teacher, or a trained arm (all of its seeds)
  arm:<study>:<arm>:<seed>       one seed of a trained arm (one adapter)
  variant:<variant>:<study>      a Weight Lab variant's practice (dev) run on that study's tasks
  lane:<bench run>:<mode>:<lane> one model in a bench run (modes: no_tools / tools / direct)

Pairing rule: a task enters the comparison only when BOTH sides ran it AND its content (prompt, references, split, or the
bench item incl. its image bytes) is byte-identical — SHA-256 of the canonical record. Tasks with the same id but different
content are counted and excluded, never paired.

Statistics (over the paired tasks):
- each side's rate: per task, the mean over that side's seeds; Wilson 95 % range when every task has one outcome, otherwise
  a bootstrap over task groups;
- the difference A − B: mean of per-group differences (groups = paraphrases of one task, or one bench item), percentile
  bootstrap over groups (10 000 resamples) and a two-sided sign-flip test over groups; exact McNemar when both sides have
  one outcome per task;
- per skill / category, the same with 2 000 resamples.
The range covers which tasks were drawn, not training-run variation: seed spread is shown separately per side.

Weights: when both sides are single adapters on the same base model, ΔW of every shared module is compared exactly from the
LoRA factors — ‖ΔW‖_F of each, cosine, and the relative distance — without building any full matrix.

Everything here is exploratory. A comparison picked after looking at results is not a preregistered test; the confirmatory
result of a study is its sealed test analysis.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import numpy as np

from forge.engine import statistics as st
from forge.util import canonical_json

SPLITS = ("dev", "test", "ood", "regression")
LAYER = re.compile(r"\.layers\.(\d+)\.")
HONESTY = ("Exploratory: paired on byte-identical tasks only. Ranges reflect which tasks were drawn, not training-run "
           "variation (see the seed spread). Comparing many pairs will turn up differences by chance; the confirmatory result "
           "of a study is its sealed test analysis.")


class CompareError(ValueError):
    pass


@dataclass
class Unit:
    id: str
    group: str
    family: str
    prompt: str
    outcomes: list[float] = field(default_factory=list)
    seeds: list[int] = field(default_factory=list)
    invalid: list[int] = field(default_factory=list)
    tokens: list[float] = field(default_factory=list)
    latency: list[float] = field(default_factory=list)
    records: list[dict] = field(default_factory=list)  # full episodes / bench rows, for the side-by-side view


@dataclass
class Subject:
    ref: str
    kind: str
    label: str
    split: str
    units: dict[str, Unit]
    ids: dict[str, str]                 # unit id → content hash (to detect same-id-different-content)
    seeds: list[int]
    describe: dict[str, Any]
    adapter: Path | None = None
    base_hash: str | None = None
    taskset: str | None = None


def _h(obj: Any) -> str:
    return hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()


def _read_episodes(p: Path) -> list[dict]:
    if not p.exists():
        return []
    out = []
    for line in p.read_text(encoding="utf-8").splitlines():
        if line.strip():
            r = json.loads(line)
            out.append(r["record"] if isinstance(r, dict) and "record" in r and "sha256" in r else r)
    return out


def _task_hashes(study: Any) -> dict[str, tuple[str, dict]]:
    out = {}
    for line in (study.root / "tasks.jsonl").read_text(encoding="utf-8").splitlines():
        if line.strip():
            t = json.loads(line)
            out[t["task_id"]] = (_h(t), t)
    return out


def _add_episode(units: dict[str, Unit], ids: dict[str, str], tasks: dict[str, tuple[str, dict]], e: dict, seed: int) -> None:
    th = tasks.get(e["task_id"])
    if not th:
        return
    h, t = th
    ids[e["task_id"]] = h
    u = units.setdefault(h, Unit(e["task_id"], str(e.get("group_id") or e["task_id"]), e.get("family") or t.get("family", "?"), t.get("prompt", "")))
    sc, us = e.get("score") or {}, e.get("usage") or {}
    u.outcomes.append(float(bool(sc.get("strict_success"))))
    u.seeds.append(seed)
    u.invalid.append(int(sc.get("invalid_calls") or 0))
    if us.get("completion_tokens") is not None:
        u.tokens.append(float(us["completion_tokens"]))
    if us.get("latency_ms") is not None:
        u.latency.append(float(us["latency_ms"]))
    u.records.append({"seed": seed, **{k: e.get(k) for k in ("messages", "events", "calls", "answer", "termination", "score", "usage")}})


def _arm_dirs(study: Any) -> dict[str, dict[str, list[int]]]:
    """arm → split → seeds with episodes on disk."""
    out: dict[str, dict[str, list[int]]] = {}
    base = study.root / "episodes"
    if base.is_dir():
        for a in sorted(base.iterdir()):
            for sp in sorted(a.iterdir()) if a.is_dir() else []:
                seeds = sorted(int(f.stem[4:]) for f in sp.glob("seed*.jsonl") if f.stem[4:].isdigit() and f.stat().st_size)
                if seeds and sp.name in SPLITS:
                    out.setdefault(a.name, {})[sp.name] = seeds
    return out


def _train_cfg(study: Any, arm: str) -> dict[str, Any]:
    from forge.engine.study import TRAIN_ARMS
    ov = (study.plan.get("arm_overrides") or {}).get(arm) or TRAIN_ARMS.get(arm) or {}
    return {**(study.plan.get("train") or {}), **(ov.get("train") or {})}


def _arm_data(study: Any, arm: str) -> str:
    from forge.engine.study import TRAIN_ARMS
    ov = (study.plan.get("arm_overrides") or {}).get(arm) or TRAIN_ARMS.get(arm) or {}
    return ov.get("data", arm)


def _adapter_cfg(ad: Path) -> dict[str, Any]:
    try:
        c = json.loads((ad / "adapter_config.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    tm = c.get("target_modules")
    if isinstance(tm, list):
        kinds = sorted({x.rsplit(".", 1)[-1] for x in tm})
        tm = ", ".join(kinds) + (f" ({len(tm)} modules)" if len(tm) > len(kinds) else "")
    return {"rank r": c.get("r"), "alpha": c.get("lora_alpha"), "rsLoRA": bool(c.get("use_rslora")), "target modules": tm}


def _sha_short(p: Path) -> str | None:
    try:
        h = hashlib.sha256()
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()[:16]
    except OSError:
        return None


def load_subject(ref: str, split: str, find_study: Callable[[str], Any], home: Path) -> Subject:
    kind, _, rest = ref.partition(":")
    if kind == "arm":
        parts = rest.split(":")
        if len(parts) not in (2, 3):
            raise CompareError("arm subject: arm:<study>:<arm>[:<seed>]")
        study, arm = find_study(parts[0]), parts[1]
        avail = _arm_dirs(study).get(arm, {})
        if split not in avail:
            raise CompareError(f"{arm} has no {split} results in study '{study.plan['name']}'")
        seeds = avail[split]
        if len(parts) == 3:
            if int(parts[2]) not in seeds:
                raise CompareError(f"{arm} seed {parts[2]} has no {split} results")
            seeds = [int(parts[2])]
        tasks = _task_hashes(study)
        units: dict[str, Unit] = {}
        ids: dict[str, str] = {}
        for s in seeds:
            for e in _read_episodes(study.episode_path(arm, split, s)):
                _add_episode(units, ids, tasks, e, s)
        plan = study.plan
        trained = arm not in ("base", "teacher", "oracle")
        model = plan["teacher"]["model"] if arm == "teacher" else plan["student"]["name"]
        desc: dict[str, Any] = {"what": "teacher" if arm == "teacher" else ("untrained student" if arm == "base" else f"trained student · {arm}"),
                                "model": model, "study": plan["name"], "study profile": plan["profile"],
                                "task set": f"{(plan['taskset'].get('kind') or 'catalog')} · {plan['taskset']['sha256'][:12]}",
                                "split": split, "seeds": ", ".join(map(str, seeds)), "decoding": plan["eval"].get("decoding"),
                                "max turns": plan["eval"].get("max_turns")}
        adapter = None
        if trained:
            tc = _train_cfg(study, arm)
            desc.update({f"train · {k}": v for k, v in tc.items() if not k.startswith("min_free_vram")})
            desc["training data"] = _arm_data(study, arm)
            bsum = (study.state.get("stages", {}).get("build", {}).get("summary") or {}).get(_arm_data(study, arm)) or {}
            if bsum:
                desc["training records"] = bsum.get("records")
            if len(seeds) == 1:
                ad = study.run_dir(arm, seeds[0]) / "adapter"
                if (ad / "adapter_model.safetensors").exists():
                    adapter = ad
                    desc.update({f"adapter · {k}": v for k, v in _adapter_cfg(ad).items()})
                    desc["adapter · sha256"] = _sha_short(ad / "adapter_model.safetensors")
        label = f"{plan['name']} · {arm}" + (f" · seed {seeds[0]}" if len(parts) == 3 else "")
        return Subject(ref, "arm", label, split, units, ids, seeds, desc, adapter, plan.get("base_hash") if arm != "teacher" else None,
                       plan["taskset"]["sha256"])
    if kind == "variant":
        vid, _, sid = rest.partition(":")
        if not re.fullmatch(r"[A-Za-z0-9_-]+", vid or ""):
            raise CompareError("variant subject: variant:<variant>:<study>")
        if split != "dev":
            raise CompareError("Weight Lab variants are measured on practice (dev) tasks only — the test split stays reserved")
        vroot = home / "weightlab" / vid
        try:
            recipe = json.loads((vroot / "recipe.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raise CompareError("Unknown variant")
        study = find_study(sid)
        eps = _read_episodes(vroot / "eval" / f"{study.plan['study_id']}.jsonl")
        if not eps:
            raise CompareError(f"Variant '{recipe['name']}' has not been evaluated on study '{study.plan['name']}'")
        tasks = _task_hashes(study)
        units, ids = {}, {}
        for e in eps:
            _add_episode(units, ids, tasks, e, 0)
        ad = vroot / "adapter"
        desc = {"what": "Weight Lab variant", "model": study.plan["student"]["name"], "variant": recipe["name"],
                "recipe · operation": recipe.get("op") or recipe.get("operation") or recipe.get("kind"),
                "recipe · sources": ", ".join(f"{s.get('arm')} s{s.get('seed')}·w{s.get('weight', 1)}" for s in recipe.get("sources", [])),
                "recipe · strength": recipe.get("strength"), "recipe · layers": recipe.get("layers"), "recipe · modules": recipe.get("modules"),
                "recipe · rank": recipe.get("rank"), "study": study.plan["name"],
                "task set": f"{(study.plan['taskset'].get('kind') or 'catalog')} · {study.plan['taskset']['sha256'][:12]}", "split": "dev", "seeds": "0"}
        if (ad / "adapter_model.safetensors").exists():
            desc.update({f"adapter · {k}": v for k, v in _adapter_cfg(ad).items()})
            desc["adapter · sha256"] = _sha_short(ad / "adapter_model.safetensors")
        return Subject(ref, "variant", f"variant {recipe['name']} @ {study.plan['name']}", "dev", units, ids, [0],
                       {k: v for k, v in desc.items() if v is not None}, ad if (ad / "adapter_model.safetensors").exists() else None,
                       recipe.get("base_hash") or study.plan.get("base_hash"), study.plan["taskset"]["sha256"])
    if kind == "lane":
        rid, _, rest2 = rest.partition(":")
        mode, _, lane = rest2.partition(":")
        if not re.fullmatch(r"bench_[a-f0-9]+", rid or ""):
            raise CompareError("lane subject: lane:<bench run>:<mode>:<lane label>")
        rd = home / "bench" / rid
        try:
            spec = json.loads((rd / "spec.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raise CompareError("Unknown bench run")
        ln = next((x for x in spec["lanes"] if x["label"] == lane), None)
        if not ln:
            raise CompareError("Unknown lane in that bench run")
        items = {}
        for line in (rd / "items.jsonl").read_text(encoding="utf-8").splitlines():
            if line.strip():
                it = json.loads(line)
                img = rd / "images" / it["image"] if it.get("image") else None
                items[it["id"]] = (_h({**it, "image_sha256": _sha_short(img) if img else None}), it)
        units, ids = {}, {}
        rows = [json.loads(x) for x in (rd / "results.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()] if (rd / "results.jsonl").exists() else []
        for r in rows:
            if r["lane"] != lane or r["mode"] != mode or "correct" not in r or r["item"] not in items:
                continue
            h, it = items[r["item"]]
            ids[r["item"]] = h
            u = units.setdefault(h, Unit(r["item"], r["item"], f"{it['category']}", it["prompt"]))
            u.outcomes.append(float(bool(r["correct"])))
            u.seeds.append(0)
            u.invalid.append(1 if r.get("format") else 0)
            if r.get("tokens") is not None:
                u.tokens.append(float(r["tokens"]))
            if r.get("latency_ms") is not None:
                u.latency.append(float(r["latency_ms"]))
            u.records.append({"seed": 0, "expected": it["answer"], "answer": r.get("answer"), "raw": r.get("raw"), "correct": r["correct"],
                              "format": r.get("format"), "image": it.get("image"), "difficulty": it.get("difficulty")})
        if not units:
            raise CompareError(f"No scored items for {lane} ({mode}) in that run")
        desc = {"what": "bench lane", "model": ln.get("model") or ln["label"], "lane kind": ln["kind"], "suite": spec["suite"], "mode": mode,
                "bench run": rid, "items": spec["items"], "item seed": spec.get("seed"),
                "adapter": Path(ln["adapter"]).parent.name if ln.get("adapter") else None}
        return Subject(ref, "lane", f"{ln['label']} · {spec['suite']} ({mode})", "bench", units, ids, [0],
                       {k: v for k, v in desc.items() if v is not None}, Path(ln["adapter"]) if ln.get("adapter") else None, None,
                       f"bench:{spec['suite']}:{_h(sorted(h for h, _ in items.values()))[:12]}")
    raise CompareError("Unknown subject kind (arm, variant or lane)")


# ---------------------------------------------------------------- statistics
def _mean(x: list[float]) -> float | None:
    return sum(x) / len(x) if x else None


def _boot(groups: list[list[tuple[float, float]]], n_boot: int, seed: int = 0) -> dict[str, Any]:
    """Per-group (a, b) unit pairs → rates, difference and percentile bootstrap ranges over groups."""
    G = len(groups)
    a = np.array([np.mean([p[0] for p in g]) for g in groups])
    b = np.array([np.mean([p[1] for p in g]) for g in groups])
    w = np.array([len(g) for g in groups], dtype=float)
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, G, size=(n_boot, G))
    ww = w[idx]
    ra, rb = (a[idx] * ww).sum(1) / ww.sum(1), (b[idx] * ww).sum(1) / ww.sum(1)
    d = (a - b)
    dd = d[idx].mean(1)
    q = lambda v: [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))]
    return {"rate_a": float((a * w).sum() / w.sum()), "rate_b": float((b * w).sum() / w.sum()), "ci_a": q(ra), "ci_b": q(rb),
            "delta": float(d.mean()), "delta_ci": q(dd), "group_delta": d}


def compare(A: Subject, B: Subject, weights: bool = True) -> dict[str, Any]:
    common = sorted(set(A.units) & set(B.units), key=lambda h: (A.units[h].family, A.units[h].id))
    same_id = set(A.ids) & set(B.ids)
    changed = sorted(i for i in same_id if A.ids[i] != B.ids[i])
    coverage = {"paired": len(common), "only_a": len(set(A.units) - set(B.units)), "only_b": len(set(B.units) - set(A.units)),
                "same_id_different_content": len(changed), "examples_changed": changed[:5],
                "same_task_set": A.taskset is not None and A.taskset == B.taskset}
    head = {"a": {"ref": A.ref, "label": A.label, "kind": A.kind, "split": A.split, "seeds": A.seeds},
            "b": {"ref": B.ref, "label": B.label, "kind": B.kind, "split": B.split, "seeds": B.seeds}, "coverage": coverage, "honesty": HONESTY}
    if not common:
        why = ("they ran on different task sets" if not same_id else f"{len(changed)} tasks share ids but their content differs")
        return {**head, "comparable": False, "reason": f"No byte-identical tasks in common — {why}. Compare subjects that ran the same "
                "tasks: arms and variants of one study, studies cloned from one another (Turbo / clone), or lanes of bench runs with the same items."}
    binary = all(len(A.units[h].outcomes) == 1 and len(B.units[h].outcomes) == 1 for h in common)
    groups: dict[str, list[tuple[float, float]]] = defaultdict(list)
    fam_groups: dict[str, dict[str, list[tuple[float, float]]]] = defaultdict(lambda: defaultdict(list))
    rows, table = [], {"both_right": 0, "only_a": 0, "only_b": 0, "both_wrong": 0, "a_higher": 0, "b_higher": 0, "same_partial": 0}
    for h in common:
        ua, ub = A.units[h], B.units[h]
        a, b = _mean(ua.outcomes), _mean(ub.outcomes)
        groups[ua.group].append((a, b))
        fam_groups[ua.family][ua.group].append((a, b))
        if a == 1 and b == 1:
            table["both_right"] += 1
        elif a == 0 and b == 0:
            table["both_wrong"] += 1
        elif a == 1 and b == 0:
            table["only_a"] += 1
        elif a == 0 and b == 1:
            table["only_b"] += 1
        elif a > b:
            table["a_higher"] += 1
        elif b > a:
            table["b_higher"] += 1
        else:
            table["same_partial"] += 1
        rows.append({"unit": h, "id": ua.id, "family": ua.family, "prompt": (ua.prompt or "")[:220], "a": a, "b": b,
                     "a_seeds": len(ua.outcomes), "b_seeds": len(ub.outcomes)})
    g = list(groups.values())
    bo = _boot(g, 10000)
    n = len(common)
    if binary:
        ka, kb = sum(r["a"] for r in rows), sum(r["b"] for r in rows)
        bo["ci_a"], bo["ci_b"] = list(st.wilson(ka, n)), list(st.wilson(kb, n))
        range_method = "Wilson 95 % (one outcome per task)"
    else:
        range_method = "bootstrap over task groups, 10 000 resamples (several seeds per task)"
    sf = st.sign_flip_test(bo["group_delta"]) if len(g) >= 2 else None
    overall = {"n_tasks": n, "n_groups": len(g), "rate_a": bo["rate_a"], "rate_b": bo["rate_b"], "ci_a": bo["ci_a"], "ci_b": bo["ci_b"],
               "delta": bo["delta"], "delta_ci": bo["delta_ci"], "range_method": range_method,
               "sign_flip_groups": {k: sf[k] for k in ("p", "method", "n_units", "min_attainable_p")} if sf else None,
               "mcnemar": st.mcnemar_exact(table["only_a"], table["only_b"]) if binary else None, "outcomes": table,
               "agreement": (table["both_right"] + table["both_wrong"]) / n}
    fams = []
    for f, fg in sorted(fam_groups.items()):
        lst = list(fg.values())
        fb = _boot(lst, 2000)
        nf = sum(len(x) for x in lst)
        fams.append({"family": f, "n": nf, "rate_a": fb["rate_a"], "rate_b": fb["rate_b"], "delta": fb["delta"], "delta_ci": fb["delta_ci"],
                     "differ": sum(1 for x in lst for p in x if p[0] != p[1])})
    fams.sort(key=lambda x: x["delta"])

    def side(S: Subject) -> dict:
        us = [S.units[h] for h in common]
        per_seed = {}
        for s in S.seeds:
            v = [o for u in us for o, ss in zip(u.outcomes, u.seeds) if ss == s]
            if v:
                per_seed[str(s)] = {"rate": sum(v) / len(v), "n": len(v)}
        tok = [t for u in us for t in u.tokens]
        lat = sorted(t for u in us for t in u.latency)
        inv = [i for u in us for i in u.invalid]
        return {"per_seed": per_seed, "invalid_rate": (sum(1 for i in inv if i) / len(inv)) if inv else None,
                "mean_tokens": _mean(tok), "median_latency_ms": lat[len(lat) // 2] if lat else None}
    rows.sort(key=lambda r: (-(abs(r["a"] - r["b"])), r["family"], r["id"]))
    keys = sorted(set(A.describe) | set(B.describe), key=lambda k: (k.count("·"), k))
    config = [{"key": k, "a": A.describe.get(k), "b": B.describe.get(k), "same": A.describe.get(k) == B.describe.get(k)} for k in keys]
    out = {**head, "comparable": True, "overall": overall, "families": fams, "sides": {"a": side(A), "b": side(B)},
           "units": rows, "config": config}
    if weights:
        out["weights"] = compare_weights(A, B)
    return out


# ---------------------------------------------------------------- weights
def _factors(adapter: Path) -> tuple[float, dict[str, tuple[np.ndarray, np.ndarray]]]:
    from forge.analysis.adapters import SafeTensorFile
    cfg = json.loads((adapter / "adapter_config.json").read_text(encoding="utf-8"))
    r, alpha = float(cfg["r"]), float(cfg.get("lora_alpha", cfg["r"]))
    s = alpha / math.sqrt(r) if cfg.get("use_rslora") else alpha / r
    f = SafeTensorFile(adapter / "adapter_model.safetensors")
    mods: dict[str, dict[str, str]] = defaultdict(dict)
    for k in f.keys():
        m = re.match(r"(.*)\.lora_([AB])\.weight$", k)
        if m:
            name = m.group(1).replace("base_model.model.", "")
            mods[name][m.group(2)] = k
    return s, {n: (f.get(v["A"]).astype(np.float64), f.get(v["B"]).astype(np.float64)) for n, v in mods.items() if "A" in v and "B" in v}


def compare_weights(A: Subject, B: Subject) -> dict[str, Any]:
    if not A.adapter or not B.adapter:
        why = "one side has no single adapter (base, teacher, a bench endpoint, or an arm with several seeds — pick one seed)"
        return {"available": False, "reason": why}
    if A.base_hash and B.base_hash and A.base_hash != B.base_hash:
        return {"available": False, "reason": "the two adapters were trained on different base models — their weight changes live in different spaces"}
    if A.adapter.resolve() == B.adapter.resolve():
        return {"available": False, "reason": "both sides use the same adapter file"}
    s1, f1 = _factors(A.adapter)
    s2, f2 = _factors(B.adapter)
    mods = []
    tot_in = tot_a = tot_b = 0.0
    for name in sorted(set(f1) & set(f2)):
        (A1, B1), (A2, B2) = f1[name], f2[name]
        if B1.shape[0] != B2.shape[0] or A1.shape[1] != A2.shape[1]:
            continue
        inner = s1 * s2 * float(np.trace((B1.T @ B2) @ (A2 @ A1.T)))
        na2 = s1 * s1 * float(np.trace((B1.T @ B1) @ (A1 @ A1.T)))
        nb2 = s2 * s2 * float(np.trace((B2.T @ B2) @ (A2 @ A2.T)))
        na, nb = math.sqrt(max(na2, 0.0)), math.sqrt(max(nb2, 0.0))
        dist = math.sqrt(max(na2 + nb2 - 2 * inner, 0.0))
        tot_in, tot_a, tot_b = tot_in + inner, tot_a + na2, tot_b + nb2
        lm = LAYER.search("." + name)
        mods.append({"module": name, "layer": int(lm.group(1)) if lm else None, "kind": name.rsplit(".", 1)[-1],
                     "norm_a": na, "norm_b": nb, "cosine": inner / (na * nb) if na and nb else None,
                     "rel_distance": dist / max(na, nb) if max(na, nb) else None})
    if not mods:
        return {"available": False, "reason": "the two adapters share no adapted modules of the same shape"}
    return {"available": True, "modules": mods, "overall_cosine": tot_in / math.sqrt(tot_a * tot_b) if tot_a and tot_b else None,
            "norm_a": math.sqrt(tot_a), "norm_b": math.sqrt(tot_b), "only_a": sorted(set(f1) - set(f2))[:20], "only_b": sorted(set(f2) - set(f1))[:20],
            "rank_a": next(iter(f1.values()))[0].shape[0], "rank_b": next(iter(f2.values()))[0].shape[0],
            "note": "Exact from the LoRA factors: ⟨ΔW_A, ΔW_B⟩ = s_A·s_B·tr((B_AᵀB_B)(A_B A_Aᵀ)). Cosine 1 = the same direction of change; "
                    "0 = unrelated changes; it says nothing about which change is better."}


def unit_detail(A: Subject, B: Subject, unit: str) -> dict[str, Any]:
    ua, ub = A.units.get(unit), B.units.get(unit)
    if not ua or not ub:
        raise CompareError("That task is not paired between these two")
    return {"id": ua.id, "family": ua.family, "prompt": ua.prompt, "a": {"label": A.label, "kind": A.kind, "records": ua.records},
            "b": {"label": B.label, "kind": B.kind, "records": ub.records}}


# ---------------------------------------------------------------- what can be compared
def subjects(studies: list[Any], home: Path) -> list[dict[str, Any]]:
    out = []
    ids = {s.plan["study_id"] for s in studies}
    for s in studies:
        p = s.plan
        for arm, sp in _arm_dirs(s).items():
            if arm == "merged":
                continue
            what = "teacher" if arm == "teacher" else ("untrained student" if arm == "base" else f"trained · {arm}")
            seeds = sorted({x for v in sp.values() for x in v})
            out.append({"ref": f"arm:{p['study_id']}:{arm}", "label": f"{p['name']} · {what}" + (f" (all {len(seeds)} seeds)" if len(seeds) > 1 and arm not in ("base", "teacher") else ""),
                        "group": p["name"], "splits": sorted(sp, key=SPLITS.index), "kind": "arm", "taskset": p["taskset"]["sha256"][:12],
                        "adapter": arm not in ("base", "teacher") and len(seeds) == 1, "model": p["teacher"]["model"] if arm == "teacher" else p["student"]["name"]})
            if arm not in ("base", "teacher", "oracle") and len(seeds) > 1:
                for sd in seeds:
                    out.append({"ref": f"arm:{p['study_id']}:{arm}:{sd}", "label": f"{p['name']} · trained · {arm} · seed {sd}", "group": p["name"],
                                "splits": sorted([k for k, v in sp.items() if sd in v], key=SPLITS.index), "kind": "arm", "taskset": p["taskset"]["sha256"][:12],
                                "adapter": True, "model": p["student"]["name"]})
    wl = home / "weightlab"
    if wl.is_dir():
        for d in sorted(wl.iterdir()):
            ev = d / "eval"
            if not ev.is_dir():
                continue
            try:
                r = json.loads((d / "recipe.json").read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            for f in sorted(ev.glob("*.jsonl")):
                if f.stem in ids:
                    s = next(x for x in studies if x.plan["study_id"] == f.stem)
                    out.append({"ref": f"variant:{r['id']}:{f.stem}", "label": f"variant {r['name']} @ {s.plan['name']}", "group": "Weight Lab variants",
                                "splits": ["dev"], "kind": "variant", "taskset": s.plan["taskset"]["sha256"][:12], "adapter": True, "model": s.plan["student"]["name"]})
    bd = home / "bench"
    if bd.is_dir():
        from forge.bench.runner import modes_for
        for d in sorted(bd.iterdir(), reverse=True):
            try:
                spec = json.loads((d / "spec.json").read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            for ln in spec["lanes"]:
                for mode in modes_for(spec["suite"]):
                    out.append({"ref": f"lane:{spec['id']}:{mode}:{ln['label']}", "label": f"{ln['label']} · {mode.replace('_', ' ')}",
                                "group": f"Bench · {spec['suite']} · {spec['created_at'][:16].replace('T', ' ')}", "splits": ["bench"], "kind": "lane",
                                "taskset": f"bench:{spec['id']}", "adapter": bool(ln.get("adapter")), "model": ln.get("model") or ln["label"]})
    return out


# ---------------------------------------------------------------- history
def _when(eps: list[dict]) -> str | None:
    ts = [e.get("ended_at") for e in eps if e.get("ended_at")]
    return max(ts) if ts else None


def history(studies: list[Any], home: Path, model_id: str | None = None) -> dict[str, Any]:
    from forge.engine import release as rel
    points, events = [], []
    tasksets: dict[str, dict[str, Any]] = {}
    adapters: dict[str, tuple[str, str, int]] = {}
    sids = {s.plan["study_id"] for s in studies}
    for s in studies:
        p = s.plan
        sid, name = p["study_id"], p["name"]
        role = None
        if model_id:
            role = "student" if p["student"].get("model_id") == model_id else ("teacher" if p["teacher"].get("model_id") == model_id else None)
            if not role:
                continue
        tsid = p["taskset"]["sha256"][:12]
        tasksets.setdefault(tsid, {"label": f"{p['taskset'].get('kind') or 'catalog'} task set {tsid}", "studies": []})["studies"].append(name)
        events.append({"t": p["created_at"], "kind": "study", "label": f"Study created: {name}", "detail": f"{p['profile']} · {len(p['seeds'])} seed(s) · arms {', '.join(p['arms'])}", "study": sid})
        for stg, v in (s.state.get("stages") or {}).items():
            if v.get("status") == "completed" and v.get("at") and stg in ("train", "seal", "analyze_dev", "analyze_test", "export"):
                lbl = {"train": "Trained", "seal": "Sealed", "analyze_dev": "Practice results analysed", "analyze_test": "Final test analysed", "export": "Exported"}[stg]
                events.append({"t": v["at"], "kind": stg, "label": f"{lbl}: {name}", "study": sid})
        for arm, sp in _arm_dirs(s).items():
            if arm == "merged" or (role == "teacher" and arm != "teacher") or (role == "student" and arm == "teacher"):
                continue
            for split, seeds in sp.items():
                if split not in ("dev", "test"):
                    continue
                eps = [e for sd in seeds for e in _read_episodes(s.episode_path(arm, split, sd))]
                if not eps:
                    continue
                k = sum(1 for e in eps if (e.get("score") or {}).get("strict_success"))
                n = len(eps)
                kind = "reference" if arm == "teacher" else ("final" if split == "test" else "practice")
                points.append({"t": _when(eps), "kind": kind, "series": f"{name} · {arm}" + (f" · {split}" if arm == "teacher" else ""),
                               "label": f"{name} · {arm} · {'teacher reference, ' + split if arm == 'teacher' else ('final test' if split == 'test' else 'practice')}", "rate": k / n, "ci": list(st.wilson(k, n)),
                               "n": n, "seeds": len(seeds), "study": sid, "arm": arm, "split": split, "taskset": tsid,
                               "ref": f"arm:{sid}:{arm}", "role": "teacher" if arm == "teacher" else ("base" if arm == "base" else "tuned")})
            if arm not in ("base", "teacher", "oracle"):
                for sd in sorted({x for v in sp.values() for x in v}):
                    adapters[str((s.run_dir(arm, sd) / "adapter").resolve())] = (sid, arm, sd)
        for so in rel.signoffs(s):
            events.append({"t": so.get("at"), "kind": "decision", "label": f"Decision: {so.get('decision_label') or so.get('decision', '')} — {name}",
                           "detail": f"{so.get('reviewer', '')} ({so.get('role', '')}): {so.get('purpose', '')}", "study": sid})
        for b in rel.bundles(s):
            m = re.search(r"-(\d{8}T\d{6})\.zip$", b["name"])
            t = f"{m.group(1)[:4]}-{m.group(1)[4:6]}-{m.group(1)[6:8]}T{m.group(1)[9:11]}:{m.group(1)[11:13]}:{m.group(1)[13:15]}+00:00" if m else None
            events.append({"t": t, "kind": "release", "label": f"Release bundle built: {name}", "detail": b.get("name"), "study": sid})
    wl = home / "weightlab"
    if wl.is_dir():
        for d in sorted(wl.iterdir()):
            try:
                r = json.loads((d / "recipe.json").read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            for f in sorted((d / "eval").glob("*.json")) if (d / "eval").is_dir() else []:
                if f.stem not in sids:
                    continue
                try:
                    ev = json.loads(f.read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    continue
                v = ev.get("variant") or {}
                if v.get("overall") is None or not v.get("n"):
                    continue
                s = next(x for x in studies if x.plan["study_id"] == f.stem)
                if model_id and s.plan["student"].get("model_id") != model_id:
                    continue
                k = round(v["overall"] * v["n"])
                points.append({"t": ev.get("generated_at"), "kind": "variant", "series": f"variant {r['name']}", "label": f"variant {r['name']} · practice",
                               "rate": v["overall"], "ci": list(st.wilson(k, v["n"])), "n": v["n"], "seeds": 1, "study": f.stem, "split": "dev",
                               "taskset": s.plan["taskset"]["sha256"][:12], "ref": f"variant:{r['id']}:{f.stem}", "role": "variant"})
    bd = home / "bench"
    if bd.is_dir():
        for d in sorted(bd.iterdir()):
            try:
                spec = json.loads((d / "spec.json").read_text(encoding="utf-8"))
                summ = json.loads((d / "summary.json").read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            for ln in spec["lanes"]:
                link = adapters.get(str(Path(ln["adapter"]).resolve())) if ln.get("adapter") else None
                if model_id:
                    if ln.get("model_id") != model_id:
                        continue
                elif not link and not (ln.get("model_id") and any(ln["model_id"] in (s.plan["student"].get("model_id"), s.plan["teacher"].get("model_id")) for s in studies)):
                    continue
                for row in summ.get("rows", []):
                    if row["lane"] != ln["label"] or not row.get("n"):
                        continue
                    tsid = f"bench·{spec['suite']}·{spec['id'][-6:]}"
                    tasksets.setdefault(tsid, {"label": f"{spec['suite']} bench, {spec['items']} items (run {spec['id'][-6:]})", "studies": []})
                    points.append({"t": spec["created_at"], "kind": "bench", "series": f"{ln['label']} · {spec['suite']} {row['mode'].replace('_', ' ')}",
                                   "label": f"{ln['label']} · {spec['suite']} bench ({row['mode'].replace('_', ' ')})", "rate": row["rate"], "ci": row["ci"],
                                   "n": row["n"], "seeds": 1, "taskset": tsid, "ref": f"lane:{spec['id']}:{row['mode']}:{ln['label']}", "role": "bench"})
    points = [x for x in points if x["t"]]
    events = [e for e in events if e["t"]]
    points.sort(key=lambda x: x["t"])
    events.sort(key=lambda e: e["t"], reverse=True)
    return {"points": points, "events": events, "tasksets": tasksets,
            "honesty": "Each point is a measured rate with its 95 % range, timed when its last task finished. Points on different task sets "
                       "(shapes/colours in the legend) are not directly comparable — a move between them can be the tasks, not the model. "
                       "Practice points informed training decisions; only final-test points of sealed studies are confirmatory."}
