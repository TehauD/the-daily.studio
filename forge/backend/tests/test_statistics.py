import math

import numpy as np
import pytest

from forge.engine import statistics as st


def test_mcnemar_known_value():
    r = st.mcnemar_exact(18, 6)
    assert r["p"] == pytest.approx(0.0227, abs=5e-5)
    assert st.mcnemar_exact(0, 0)["p"] == 1.0 and st.mcnemar_exact(5, 5)["p"] == 1.0


def test_holm_known_values():
    adj = st.holm({"a": 0.01, "b": 0.04, "c": 0.03})
    assert adj["a"] == pytest.approx(0.03) and adj["c"] == pytest.approx(0.06) and adj["b"] == pytest.approx(0.06)


def test_sign_flip_exact_resolution():
    r = st.sign_flip_test(np.array([0.2, 0.3, 0.1]))
    assert r["method"] == "exact" and r["p"] == pytest.approx(0.25) and r["min_attainable_p"] == 0.25
    r6 = st.sign_flip_test(np.ones(6))
    assert r6["p"] == pytest.approx(2 / 64)
    assert st.sign_flip_test(np.zeros(4))["p"] == 1.0


def test_sign_flip_monte_carlo_plus_one():
    r = st.sign_flip_test(np.ones(20), n_mc=999, seed=1)
    assert r["method"].startswith("monte_carlo") and r["p"] >= 1 / 1000


def _obs(arm_success, seeds=(0, 1), groups=4, paraphrases=2):
    rows = []
    for s in seeds:
        for g in range(groups):
            for p in range(paraphrases):
                rows.append({"seed": s, "group_id": f"g{g}", "task_id": f"g{g}.p{p}", "success": arm_success(s, g, p)})
    return rows


def test_zero_effect_ci_is_zero():
    a = _obs(lambda s, g, p: float(g % 2))
    res = st.analyze_contrast(a, a, n_boot=500)
    assert res["mean"] == 0 and res["ci_low"] == 0 and res["ci_high"] == 0
    assert res["sign_flip_groups"]["p"] == 1.0


def test_positive_effect_detected_and_paired():
    arm = _obs(lambda s, g, p: 1.0, groups=8)
    ctl = _obs(lambda s, g, p: 0.0, groups=8)
    res = st.analyze_contrast(arm, ctl, n_boot=500)
    assert res["mean"] == 1.0 and res["ci_low"] == 1.0
    assert res["sign_flip_groups"]["p"] == pytest.approx(2 / 256)


def test_broadcast_control_seed_explicit():
    arm = _obs(lambda s, g, p: 1.0, seeds=(0, 1, 2))
    ctl = _obs(lambda s, g, p: 0.0, seeds=(0,))
    with pytest.raises(st.PairingError):
        st.paired_matrix(arm, ctl)  # never implicit
    pm = st.paired_matrix(arm, ctl, broadcast_control_seed=0)
    assert pm.delta.shape == (3, 4)


@pytest.mark.parametrize("mutate", ["duplicate", "missing_task", "missing_cell"])
def test_pairing_integrity_rejects(mutate):
    arm, ctl = _obs(lambda *a: 1.0), _obs(lambda *a: 0.0)
    if mutate == "duplicate":
        arm.append(dict(arm[0]))
    elif mutate == "missing_task":
        ctl = [o for o in ctl if o["task_id"] != "g0.p1" or o["seed"] != 0]
    else:
        arm = [o for o in arm if not (o["seed"] == 1 and o["group_id"] == "g3")]
    with pytest.raises(st.PairingError):
        st.paired_matrix(arm, ctl)


def test_power_formula():
    r = st.power_n(0.1, 0.3)
    z = 1.959963984540054 + 0.8416212335729143
    assert r["n_pairs"] == math.ceil(z ** 2 * (0.3 - 0.01) / 0.01)
    with pytest.raises(ValueError):
        st.power_n(0.4, 0.3)


def test_wilson_and_gap():
    lo, hi = st.wilson(8, 10)
    assert 0.44 < lo < 0.5 and 0.94 < hi < 0.97
    assert st.teacher_gap_closed(0.2, 0.5, 0.8) == pytest.approx(0.5)
    assert st.teacher_gap_closed(0.5, 0.6, 0.4) is None


def test_review_gate_requires_everything():
    g = st.GateInput(profile="pilot", n_seeds=3, ci_low=0.2, min_gain=0.05, p_group=0.01, p_seed=0.25,
                     invalid_call_delta=0.0, ood_delta_ci_low=0.0, regression_delta_ci_low=0.0, teacher_measured=True)
    out = st.review_gate(g)
    assert out["verdict"] == "not_eligible"
    failed = {c["check"] for c in out["checks"] if c["status"] == "fail"}
    assert failed == {"research_profile", "seeds_ge_6", "sign_flip_seeds"}
    ok = st.review_gate(st.GateInput(**{**g.__dict__, "profile": "research", "n_seeds": 6, "p_seed": 0.03}))
    assert ok["verdict"] == "candidate_for_human_review"
