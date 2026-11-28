"""Power planning: how big a gain can this design detect, before anything is trained?

A study compares the trained student with the untrained one on the same task groups. Two tests decide the review gate:
the sign-flip test over task groups (each group's gain, averaged over seeds and paraphrases) and the sign-flip test over
seeds (each seed's gain). Their power depends on the number of groups, paraphrases per group, seeds, the untrained
success rate, and how much the gain varies between groups and between seeds.

Model (simulated, vectorised over `sims` replicate studies):
    untrained group rate  p_g  ~ Beta(mean = base_rate, concentration κ)
    trained rate          p_gs = clip(b_g + gain + u_g + v_s, 0, 1),  b_g = the untrained student's observed rate on group g,   u_g ~ N(0, sd_group), v_s ~ N(0, sd_seed)
    observed rates are binomial over the group's paraphrases; the untrained student is measured once (seed broadcast).
Group test: two-sided t on group gains (the large-n limit of the sign-flip test). Seed test: exact sign-flip on seed
gains — with S seeds its smallest possible p is 2/2^S, so fewer than 6 seeds can never reach p < 0.05.

The assumptions are stated in the result. `calibrate` replaces them with values measured in an analysed study (a pilot),
which is the recommended path: plan the research study from the pilot's own spread.
"""
from __future__ import annotations

import json
import math
from itertools import product
from typing import Any

import numpy as np

DEFAULTS = {"base_rate": 0.1, "sd_group": 0.15, "sd_seed": 0.03, "concentration": 4.0}


def _t_two_sided_p(x: np.ndarray) -> np.ndarray:
    """Two-sided p of a one-sample t-test of mean 0 along axis 1 (normal approx for df ≥ 30, Student t otherwise)."""
    n = x.shape[1]
    m, s = x.mean(axis=1), x.std(axis=1, ddof=1)
    with np.errstate(divide="ignore", invalid="ignore"):
        t = np.where(s > 0, m / (s / math.sqrt(n)), np.where(m != 0, np.inf, 0.0))
    from math import erf
    if n - 1 >= 30:
        return np.array([2 * (1 - 0.5 * (1 + erf(abs(v) / math.sqrt(2)))) if np.isfinite(v) else 0.0 for v in t])
    try:
        from scipy import stats
        return 2 * stats.t.sf(np.abs(t), n - 1)
    except ImportError:  # pragma: no cover - scipy ships with the training stack
        return np.array([2 * (1 - 0.5 * (1 + erf(abs(v) / math.sqrt(2)))) if np.isfinite(v) else 0.0 for v in t])


def _signflip_p(units: np.ndarray) -> np.ndarray:
    """Exact two-sided sign-flip p for each row of `units` (S ≤ 12)."""
    S = units.shape[1]
    signs = np.array(list(product((1.0, -1.0), repeat=S)))           # 2^S × S
    obs = np.abs(units.mean(axis=1))[:, None]
    null = np.abs(units @ signs.T / S)                                 # sims × 2^S
    return (null >= obs - 1e-12).mean(axis=1)


def simulate(gain: float, *, groups: int, paraphrases: int, seeds: int, base_rate: float, sd_group: float, sd_seed: float,
             concentration: float = 4.0, sims: int = 400, alpha: float = 0.05, rng_seed: int = 0) -> dict[str, float]:
    rng = np.random.default_rng(rng_seed)
    b = min(max(base_rate, 1e-3), 1 - 1e-3)
    p = rng.beta(b * concentration, (1 - b) * concentration, size=(sims, groups))
    base_obs = rng.binomial(paraphrases, p) / paraphrases                                     # sims × G (seed broadcast)
    # No true gain → no gain heterogeneity either (a real null); otherwise clipping at 0/1 would create a spurious effect.
    het = 1.0 if gain > 0 else 0.0
    u = rng.normal(0, sd_group * het, size=(sims, 1, groups))
    v = rng.normal(0, sd_seed * het, size=(sims, seeds, 1))
    pt = np.clip(base_obs[:, None, :] + gain + u + v, 0, 1)   # fine-tuned from this base: starts from what it did on these tasks
    realized = float((pt - base_obs[:, None, :]).mean())                                             # true mean gain after clipping
    tr_obs = rng.binomial(paraphrases, pt) / paraphrases                                       # sims × S × G
    D = tr_obs - base_obs[:, None, :]
    pg = _t_two_sided_p(D.mean(axis=1))
    ps = _signflip_p(D.mean(axis=2)) if seeds <= 12 else _t_two_sided_p(D.mean(axis=2))
    return {"realized_gain": realized, "power_groups": float((pg < alpha).mean()), "power_seeds": float((ps < alpha).mean()),
            "power_both": float(((pg < alpha) & (ps < alpha)).mean())}


def mde(*, groups: int, paraphrases: int, seeds: int, target: float = 0.8, key: str = "power_groups", **kw: Any) -> float | None:
    """Smallest true mean gain (to ~0.5 pt) reaching `target` power on `key`; None if not reachable below +60 pts."""
    lo, hi = 0.0, 0.6
    best = simulate(hi, groups=groups, paraphrases=paraphrases, seeds=seeds, **kw)
    if best[key] < target:
        return None
    while hi - lo > 0.005:
        mid = (lo + hi) / 2
        r = simulate(mid, groups=groups, paraphrases=paraphrases, seeds=seeds, **kw)
        if r[key] >= target:
            hi, best = mid, r
        else:
            lo = mid
    return round(best["realized_gain"], 3)


def design_from_tasks(tasks: list[Any], split: str = "test") -> dict[str, int]:
    rows = [t for t in tasks if t.split == split]
    groups = sorted({t.group_id for t in rows})
    per = len(rows) / len(groups) if groups else 0
    return {"groups": len(groups), "paraphrases": max(1, round(per)), "tasks": len(rows)}


def plan(*, groups: int, paraphrases: int, seeds: int, min_gain: float, assumptions: dict[str, Any] | None = None,
         alpha: float = 0.05, sims: int = 400) -> dict[str, Any]:
    a = {**DEFAULTS, **{k: v for k, v in (assumptions or {}).items() if k in DEFAULTS and v is not None}}
    kw = {k: a[k] for k in DEFAULTS} | {"sims": sims, "alpha": alpha}
    seed_floor = 2.0 / 2 ** seeds
    at_min = simulate(min_gain, groups=groups, paraphrases=paraphrases, seeds=seeds, **kw)
    m_groups = mde(groups=groups, paraphrases=paraphrases, seeds=seeds, key="power_groups", **kw)
    m_both = mde(groups=groups, paraphrases=paraphrases, seeds=seeds, key="power_both", **kw) if seed_floor < alpha else None
    alternatives = []
    for s in sorted({3, 5, 6, 8, seeds}):
        for gm in (1, 2):
            g = groups * gm
            alternatives.append({"seeds": s, "groups": g, "tasks": g * paraphrases,
                                 "mde_groups": mde(groups=g, paraphrases=paraphrases, seeds=s, key="power_groups", **kw),
                                 "seed_test_possible": 2.0 / 2 ** s < alpha})
    notes = []
    if seed_floor >= alpha:
        notes.append(f"With {seeds} seed(s) the seed-level test can never go below p = {seed_floor:.3g}; the review gate needs ≥ 6 seeds.")
    if m_groups is not None and m_groups > min_gain:
        notes.append(f"The design detects gains of about {m_groups * 100:.1f} pts or more (80 % power), larger than the preregistered "
                     f"minimum of {min_gain * 100:.1f} pts: smaller real gains will often go undetected.")
    return {"design": {"groups": groups, "paraphrases": paraphrases, "seeds": seeds, "alpha": alpha, "target_power": 0.8},
            "assumptions": {**a, "source": (assumptions or {}).get("source", "defaults (no pilot)")},
            "min_gain": min_gain, "power_at_min_gain": at_min, "mde_groups": m_groups, "mde_both": m_both,
            "seed_floor_p": seed_floor, "alternatives": alternatives, "notes": notes, "sims": sims,
            "method": "Monte Carlo over replicate studies (beta-binomial groups, group and seed heterogeneity); t-test over groups, exact sign-flip over seeds"}


def calibrate(study: Any, split: str = "dev") -> dict[str, Any] | None:
    """Assumptions measured in an analysed study: untrained rate, spread of true group gains and of seed gains."""
    p = study.root / "reports" / f"analysis_{split}.json"
    if not p.exists():
        return None
    rep = json.loads(p.read_text(encoding="utf-8"))
    sec = rep.get("splits", {}).get(split) or {}
    arm = next((a for a in study.plan["arms"] if a != "shuffled_control" and a in (sec.get("arms") or {})), None)
    if not arm:
        return None
    c = sec["arms"][arm]
    deltas = np.array(list((c.get("per_group_delta") or {}).values()), dtype=float)
    obs = study.observations(arm, split)
    base = sec.get("base_rate") or 0.0
    if len(deltas) < 3:
        return None
    m = max(1, round(len([o for o in obs if o["seed"] == study.plan["seeds"][0]]) / len(deltas)))
    S = len(study.plan["seeds"])
    r1 = min(max(c.get("arm_rate") or 0, 0), 1)
    binvar = r1 * (1 - r1) / (m * S) + base * (1 - base) / m       # sampling variance of one group's gain
    sd_group = math.sqrt(max(float(deltas.var(ddof=1)) - binvar, 0.0))
    seed_rates: dict[int, list[float]] = {}
    for o in obs:
        seed_rates.setdefault(o["seed"], []).append(o["success"])
    sr = [sum(v) / len(v) for v in seed_rates.values()]
    n_per_seed = len(obs) / max(1, len(sr))
    sd_seed = math.sqrt(max(float(np.var(sr, ddof=1)) - r1 * (1 - r1) / n_per_seed, 0.0)) if len(sr) > 1 else DEFAULTS["sd_seed"]
    return {"base_rate": float(base), "sd_group": round(sd_group, 4), "sd_seed": round(sd_seed, 4),
            "concentration": DEFAULTS["concentration"], "observed_gain": c.get("mean"),
            "source": f"measured in study '{study.plan['name']}' ({split}, arm {arm}, {S} seed(s))"}
