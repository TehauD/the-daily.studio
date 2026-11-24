"""Weight microscope: exact against a directly computed ΔW, rank-1 parts sum to the change, seeds and snapshots."""
import json

import numpy as np
from safetensors.numpy import save_file

from forge.analysis.microscope import _blocks, microscope

MOD = "model.layers.3.self_attn.k_proj"


def _adapter(d, A, B, r=4, alpha=8):
    d.mkdir(parents=True)
    save_file({f"base_model.model.{MOD}.lora_A.weight": A.astype(np.float32), f"base_model.model.{MOD}.lora_B.weight": B.astype(np.float32)},
              str(d / "adapter_model.safetensors"))
    (d / "adapter_config.json").write_text(json.dumps({"r": r, "lora_alpha": alpha}))
    return d


def test_microscope_is_exact(tmp_path):
    rng = np.random.default_rng(0)
    W = rng.normal(size=(40, 24)).astype(np.float32)
    base = tmp_path / "base"
    base.mkdir()
    save_file({f"{MOD}.weight": W}, str(base / "model.safetensors"))
    A, B = rng.normal(size=(4, 24)), rng.normal(size=(40, 4)) * 0.01
    ad = _adapter(tmp_path / "ad", A, B)
    snap = _adapter(tmp_path / "snap", A, B * 0.5)
    other = _adapter(tmp_path / "other", A, B)  # identical change → cosine 1
    out = microscope(ad, base, MOD, snapshots=[("step 5", snap)], other_seeds=[("seed 1", other)], k=8)
    dW = 2.0 * (B.astype(np.float32).astype(np.float64) @ A.astype(np.float32).astype(np.float64))
    assert abs(out["norms"]["dW"] - np.linalg.norm(dW)) < 1e-6 and out["scale"] == 2.0 and out["shape"] == [40, 24]
    assert np.allclose(sorted(out["spectra"]["dW"], reverse=True), np.linalg.svd(dW, compute_uv=False)[:4], atol=1e-8)
    assert np.allclose(np.sum([p["grid"] for p in out["parts"]], axis=0), _blocks(dW), atol=1e-6)  # parts add up to the change
    assert abs(sum(p["share"] for p in out["parts"]) - 1) < 1e-9
    assert abs(out["over_training"][0]["dW"] - 0.5 * out["norms"]["dW"]) < 1e-6
    assert abs(out["across_seeds"][0]["cosine"] - 1.0) < 1e-6
    assert out["random_baseline"]["out_top4"] == 4 / 40 and out["random_baseline"]["in_top8"] == 8 / 24
    assert sum(out["hist"]["before"]) > 0.95 * W.size and len(out["map"]["abs"]) == 40
