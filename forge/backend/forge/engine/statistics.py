"""Paired statistics for student-vs-baseline comparisons.

Unit of independence: the scenario *group*. Paraphrases are averaged within a
group, giving a seed × group matrix of paired deltas (arm − control).

Integrity: incomplete, unpaired, or duplicate observations raise. Nothing is
silently inner-joined away.

Everything here is pure NumPy + stdlib so it runs in the API process and is
unit-tested against hand-computed values.
"""
from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import asdict, dataclass
from itertools import product
from statistics import NormalDist
from typing import Any, Iterable

import numpy as np

EXACT_MAX_UNITS = 16


class PairingError(ValueError):
    pass


@dataclass
class PairedMatrix:
    seeds: list[int]
    groups: list[str]
    delta: np.ndarray  # shape (S, G): mean success(arm) − mean success(control) per seed × group
    arm_rate: np.ndarray
    control_rate: np.ndarray


def _index(obs: Iterable[dict[str, Any]], label: str) -> dict[tuple[int, str], dict[str, float]]:
    """(seed, group) → {task_id: success}. Raises on duplicates."""
    out: dict[tuple[int, str], dict[str, float]] = defaultdict(dict)
    for o in obs:
        key, tid = (int(o["seed"]), str(o["group_id"])), str(o["task_id"])
        if tid in out[key]:
            raise PairingError(f"{label}: duplicate observation seed={key[0]} task={tid}")
        out[key][tid] = float(o["success"])
    return out


def paired_matrix(arm_obs: list[dict], control_obs: list[dict], broadcast_control_seed: int | None = None) -> PairedMatrix:
    """Build the paired delta matrix.

    broadcast_control_seed: when the control is deterministic (greedy decoding of an untrained
    base model), it is evaluated once under that seed and explicitly reused for every arm seed.
    This is recorded by the caller; it is never implicit.
    """
    a = _index(arm_obs, "arm")
    c = _index(control_obs, "control")
    if broadcast_control_seed is not None:
        base = {g: v for (s, g), v in c.items() if s == broadcast_control_seed}
        if not base:
            raise PairingError(f"control has no observations for seed {broadcast_control_seed}")
        c = {(s, g): base[g] for (s, g) in a if g in base}
        missing = {g for (_, g) in a} - set(base)
        if missing:
            raise PairingError(f"control missing groups: {sorted(missing)[:5]}")
    if set(a) != set(c):
        only_a, only_c = sorted(set(a) - set(c))[:5], sorted(set(c) - set(a))[:5]
        raise PairingError(f"unpaired (seed, group) cells; arm-only={only_a} control-only={only_c}")
    seeds = sorted({s for s, _ in a})
    groups = sorted({g for _, g in a})
    if set(a) != set(product(seeds, groups)):
        raise PairingError("incomplete design: every seed must cover every group")
    D = np.zeros((len(seeds), len(groups)))
    A = np.zeros_like(D)
    C = np.zeros_like(D)
    for i, s in enumerate(seeds):
        for j, g in enumerate(groups):
            ta, tc = a[(s, g)], c[(s, g)]
            if set(ta) != set(tc):
                raise PairingError(f"seed {s} group {g}: task sets differ between arm and control")
            A[i, j] = np.mean(list(ta.values()))
            C[i, j] = np.mean([tc[t] for t in ta])
            D[i, j] = A[i, j] - C[i, j]
    return PairedMatrix(seeds, groups, D, A, C)


def crossed_bootstrap(D: np.ndarray, n_boot: int = 10000, seed: int = 0, level: float = 0.95) -> dict[str, Any]:
    """Resample seeds and groups jointly (pairing preserved: whole cells are drawn). Percentile CI, not BCa."""
    S, G = D.shape
    rng = np.random.default_rng(seed)
    stats = np.empty(n_boot)
    for b in range(n_boot):
        si = rng.integers(0, S, S)
        gi = rng.integers(0, G, G)
        stats[b] = D[np.ix_(si, gi)].mean()
    lo, hi = np.quantile(stats, [(1 - level) / 2, 1 - (1 - level) / 2])
    return {"mean": float(D.mean()), "ci_low": float(lo), "ci_high": float(hi), "level": level, "n_boot": n_boot,
            "method": "crossed percentile bootstrap (seeds × groups), not BCa", "seeds": S, "groups": G}


def sign_flip_test(units: np.ndarray, n_mc: int = 20000, seed: int = 0) -> dict[str, Any]:
    """Two-sided sign-flip permutation test of mean(units) = 0.

    Exact enumeration for ≤16 units; otherwise Monte Carlo with the +1 correction.
    The smallest attainable exact p is 2 / 2^n (n=3 → 0.25).
    """
    u = np.asarray(units, dtype=float)
    n = len(u)
    if n == 0:
        raise ValueError("no units")
    obs = abs(u.mean())
    tol = 1e-12
    if n <= EXACT_MAX_UNITS:
        signs = np.array(list(product((1.0, -1.0), repeat=n)))
        null = np.abs((signs * u).mean(axis=1))
        p = float(np.mean(null >= obs - tol))
        method, min_p = "exact", 2.0 / 2 ** n
    else:
        rng = np.random.default_rng(seed)
        signs = rng.choice((1.0, -1.0), size=(n_mc, n))
        null = np.abs((signs * u).mean(axis=1))
        p = float((1 + np.sum(null >= obs - tol)) / (1 + n_mc))
        method, min_p = f"monte_carlo({n_mc}, +1 corrected)", 1.0 / (1 + n_mc)
    return {"p": p, "method": method, "n_units": n, "observed_mean": float(u.mean()), "min_attainable_p": min_p}


def mcnemar_exact(b: int, c: int) -> dict[str, Any]:
    """Exact two-sided McNemar (binomial on discordant pairs). b: arm-only successes, c: control-only."""
    n = b + c
    if n == 0:
        return {"b": b, "c": c, "p": 1.0, "n_discordant": 0}
    k = min(b, c)
    tail = sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n
    return {"b": b, "c": c, "n_discordant": n, "p": min(1.0, 2 * tail)}


def holm(pvalues: dict[str, float]) -> dict[str, float]:
    """Holm step-down adjusted p-values (monotone)."""
    items = sorted(pvalues.items(), key=lambda kv: kv[1])
    m, running, out = len(items), 0.0, {}
    for i, (k, p) in enumerate(items):
        running = max(running, min(1.0, (m - i) * p))
        out[k] = running
    return out


def power_n(delta: float, discordant: float, alpha: float = 0.05, power: float = 0.8) -> dict[str, Any]:
    """Paired-binary sample size: n = ⌈(z₁₋α/₂ + z_power)² · (q − δ²) / δ²⌉.

    q = P(discordant pair) = p10 + p01; δ = p10 − p01 (the expected gain). Requires q ≥ |δ|.
    """
    if not (0 < abs(delta) <= discordant <= 1):
        raise ValueError("require 0 < |delta| <= discordant <= 1")
    z = NormalDist().inv_cdf(1 - alpha / 2) + NormalDist().inv_cdf(power)
    n = math.ceil(z ** 2 * (discordant - delta ** 2) / delta ** 2)
    return {"n_pairs": n, "delta": delta, "discordant": discordant, "alpha": alpha, "power": power,
            "assumptions": "Independent paired binary outcomes, normal approximation (Connor 1987 form); "
                           "groups — not paraphrases — are the independent units."}


def wilson(k: float, n: int, z: float = 1.959964) -> tuple[float, float]:
    if n == 0:
        return (0.0, 1.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def teacher_gap_closed(base: float, tuned: float, teacher: float) -> float | None:
    """Descriptive only; undefined unless the teacher outperforms the base."""
    if teacher is None or teacher <= base:
        return None
    return (tuned - base) / (teacher - base)


@dataclass
class GateInput:
    profile: str
    n_seeds: int
    ci_low: float
    min_gain: float
    p_group: float
    p_seed: float
    invalid_call_delta: float      # arm − control invalid-call rate (lower is better)
    ood_delta_ci_low: float | None
    regression_delta_ci_low: float | None
    teacher_measured: bool
    noninferiority_margin: float = 0.05


def review_gate(g: GateInput) -> dict[str, Any]:
    """'pass' means *candidate for human review*, never deployment approval."""
    checks = [
        ("research_profile", g.profile == "research", f"profile={g.profile}"),
        ("seeds_ge_6", g.n_seeds >= 6, f"{g.n_seeds} seeds"),
        ("ci_low_ge_min_gain", g.ci_low >= g.min_gain, f"CI low {g.ci_low:+.3f} vs preregistered {g.min_gain:+.3f}"),
        ("sign_flip_groups", g.p_group < 0.05, f"p={g.p_group:.4f}"),
        ("sign_flip_seeds", g.p_seed < 0.05, f"p={g.p_seed:.4f}"),
        ("invalid_calls_noninferior", g.invalid_call_delta <= g.noninferiority_margin,
         f"Δ invalid-call rate {g.invalid_call_delta:+.3f} (margin {g.noninferiority_margin})"),
        ("ood_noninferior", g.ood_delta_ci_low is not None and g.ood_delta_ci_low >= -g.noninferiority_margin,
         "not evaluated" if g.ood_delta_ci_low is None else f"OOD CI low {g.ood_delta_ci_low:+.3f}"),
        ("regression_noninferior", g.regression_delta_ci_low is not None
         and g.regression_delta_ci_low >= -g.noninferiority_margin,
         "not evaluated" if g.regression_delta_ci_low is None else f"regression CI low {g.regression_delta_ci_low:+.3f}"),
        ("teacher_measured", g.teacher_measured, "teacher evaluated on the same tasks" if g.teacher_measured else "teacher not measured"),
    ]
    passed = all(ok for _, ok, _ in checks)
    return {"verdict": "candidate_for_human_review" if passed else "not_eligible",
            "checks": [{"check": c, "status": "pass" if ok else "fail", "detail": d} for c, ok, d in checks],
            "input": asdict(g),
            "disclaimer": "A pass is a candidate for human review, not deployment approval."}


def analyze_contrast(arm_obs: list[dict], control_obs: list[dict], broadcast_control_seed: int | None = None,
                     n_boot: int = 10000, seed: int = 0) -> dict[str, Any]:
    pm = paired_matrix(arm_obs, control_obs, broadcast_control_seed)
    boot = crossed_bootstrap(pm.delta, n_boot=n_boot, seed=seed)
    pg = sign_flip_test(pm.delta.mean(axis=0), seed=seed)
    ps = sign_flip_test(pm.delta.mean(axis=1), seed=seed)
    return {**boot, "arm_rate": float(pm.arm_rate.mean()), "control_rate": float(pm.control_rate.mean()),
            "sign_flip_groups": pg, "sign_flip_seeds": ps, "seeds_list": pm.seeds,
            "per_group_delta": dict(zip(pm.groups, pm.delta.mean(axis=0).round(6).tolist())),
            "control_broadcast_seed": broadcast_control_seed}
