"""Weight microscope: one adapted matrix, before and after — exact, from the files, read-only.

For a module (e.g. model.layers.22.self_attn.k_proj) with base weight W (out × in) and LoRA factors A (r × in), B (out × r):
  ΔW = s · B · A,  s = α / r  (or α / √r with rsLoRA),  W' = W + ΔW   — the base file is never modified.

Returned views:
- change map: |ΔW| and |ΔW| / (|W| + ε) block-averaged to a readable grid (exact block means of the full matrices);
- row / column profiles: which output and input dimensions changed most (row / column norms of ΔW);
- distributions: histograms of W and W' on shared bins, and of ΔW;
- spectra: singular values of W and W' (exact, top k) and of ΔW (exact, from the r × r core);
- alignment: how much of ΔW's energy lies inside W's top-k singular subspaces (output side and input side) —
  "does training reuse directions W already has, or add new ones?";
- rank-1 parts: ΔW = Σ σᵢ uᵢ vᵢᵀ, each part's share of the change and its signed block map (toggle parts in the UI);
- over training: ‖ΔW‖_F at every saved snapshot;  across seeds: cosine similarity of ΔW between seeds.
Everything is a measurement of weights; none of it explains behaviour by itself.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np

from forge.analysis.adapters import AdapterError, SafeTensorFile, _base_index, effective_rank

GRID = (48, 96)  # rows × cols of the block map


def _scale(adapter_dir: Path) -> tuple[float, int]:
    cfg = json.loads((adapter_dir / "adapter_config.json").read_text(encoding="utf-8"))
    r, alpha = int(cfg["r"]), float(cfg.get("lora_alpha", cfg["r"]))
    return (alpha / math.sqrt(r) if cfg.get("use_rslora") else alpha / r), r


def _ab(adapter_dir: Path, module: str) -> tuple[np.ndarray, np.ndarray]:
    st = SafeTensorFile(adapter_dir / "adapter_model.safetensors")
    ka = next((k for k in st.keys() if k.endswith(f"{module}.lora_A.weight")), None)
    kb = next((k for k in st.keys() if k.endswith(f"{module}.lora_B.weight")), None)
    if not ka or not kb:
        raise AdapterError(f"Module {module} is not adapted in this adapter")
    return st.get(ka).astype(np.float64), st.get(kb).astype(np.float64)


def _blocks(M: np.ndarray, grid: tuple[int, int] = GRID) -> np.ndarray:
    gr, gc = min(grid[0], M.shape[0]), min(grid[1], M.shape[1])
    re = np.array_split(np.arange(M.shape[0]), gr)
    ce = np.array_split(np.arange(M.shape[1]), gc)
    out = np.empty((gr, gc))
    for i, rr in enumerate(re):
        sub = M[rr[0]:rr[-1] + 1]
        for j, cc in enumerate(ce):
            out[i, j] = sub[:, cc[0]:cc[-1] + 1].mean()
    return out


def _hist(vals: np.ndarray, edges: np.ndarray) -> list[int]:
    return np.histogram(vals, bins=edges)[0].astype(int).tolist()


def _energy_in(U_k: np.ndarray, X: np.ndarray) -> float:
    """Share of ‖X‖_F² that lies in the column space of U_k (orthonormal)."""
    tot = float((X ** 2).sum())
    return float(((U_k.T @ X) ** 2).sum()) / tot if tot else 0.0


def microscope(adapter_dir: Path, base_dir: Path, module: str, *, snapshots: list[tuple[str, Path]] | None = None,
               other_seeds: list[tuple[str, Path]] | None = None, k: int = 64) -> dict[str, Any]:
    s, r = _scale(adapter_dir)
    A, B = _ab(adapter_dir, module)
    base = _base_index(base_dir)
    key = f"{module}.weight"
    if key not in base:
        raise AdapterError(f"Base weight {key} not found in {base_dir}")
    W = base[key].get(key).astype(np.float64)
    dW = s * (B @ A)
    if dW.shape != W.shape:
        raise AdapterError(f"Shape mismatch: ΔW {dW.shape} vs W {W.shape}")
    Wp = W + dW
    # exact SVD of ΔW via thin QR of B and Aᵀ
    Qb, Rb = np.linalg.qr(B)
    Qa, Ra = np.linalg.qr(A.T)
    Uc, sig_d, Vct = np.linalg.svd(s * Rb @ Ra.T)
    Ud, Vd = Qb @ Uc, Qa @ Vct.T  # left (out) and right (in) singular vectors of ΔW
    kk = min(k, min(W.shape))
    Uw, sw, Vwt = np.linalg.svd(W, full_matrices=False)
    sw_p = np.linalg.svd(Wp, compute_uv=False)
    fro_w, fro_d = float(np.linalg.norm(W)), float(np.sqrt((sig_d ** 2).sum()))
    absd = np.abs(dW)
    rel = absd / (np.abs(W) + 1e-3 * np.abs(W).mean())
    lo, hi = np.percentile(np.concatenate([W.ravel(), Wp.ravel()]), [0.5, 99.5])
    edges = np.linspace(lo, hi, 81)
    dlo, dhi = np.percentile(dW, [0.5, 99.5])
    dedges = np.linspace(dlo, dhi, 61)
    row_n, col_n = np.linalg.norm(dW, axis=1), np.linalg.norm(dW, axis=0)
    energy = (sig_d ** 2) / (sig_d ** 2).sum() if sig_d.sum() else sig_d
    parts = []
    for i in range(len(sig_d)):
        comp = sig_d[i] * np.outer(Ud[:, i], Vd[:, i])
        parts.append({"i": i, "sigma": float(sig_d[i]), "share": float(energy[i]), "grid": np.round(_blocks(comp), 7).tolist()})
    out: dict[str, Any] = {
        "module": module, "shape": list(W.shape), "rank": r, "scale": s,
        "norms": {"W": fro_w, "dW": fro_d, "W_after": float(np.linalg.norm(Wp)), "relative": fro_d / fro_w if fro_w else None},
        "effective_rank": effective_rank(sig_d),
        "map": {"abs": np.round(_blocks(absd), 8).tolist(), "relative": np.round(_blocks(rel), 6).tolist(), "grid": list(_blocks(absd).shape),
                "rows_per_cell": W.shape[0] / min(GRID[0], W.shape[0]), "cols_per_cell": W.shape[1] / min(GRID[1], W.shape[1])},
        "profiles": {"rows": np.round(row_n, 8).tolist() if W.shape[0] <= 8192 else None, "cols": np.round(col_n, 8).tolist() if W.shape[1] <= 8192 else None,
                     "top_rows": [int(i) for i in np.argsort(-row_n)[:10]], "top_cols": [int(i) for i in np.argsort(-col_n)[:10]]},
        "hist": {"edges": edges.tolist(), "before": _hist(W.ravel(), edges), "after": _hist(Wp.ravel(), edges),
                 "delta_edges": dedges.tolist(), "delta": _hist(dW.ravel(), dedges),
                 "stats": {"W_mean": float(W.mean()), "W_std": float(W.std()), "after_mean": float(Wp.mean()), "after_std": float(Wp.std()),
                           "dW_mean": float(dW.mean()), "dW_std": float(dW.std()), "dW_max_abs": float(absd.max())}},
        "spectra": {"W": sw[:kk].tolist(), "W_after": sw_p[:kk].tolist(), "dW": sig_d.tolist(), "W_total": int(len(sw))},
        "alignment": {f"out_top{n}": _energy_in(Uw[:, :n], dW) for n in (r, kk)} | {f"in_top{n}": _energy_in(Vwt[:n].T, dW.T) for n in (r, kk)},
        # what a random direction would give: k / (that side's dimension)
        "random_baseline": {f"out_top{n}": min(1.0, n / W.shape[0]) for n in (r, kk)} | {f"in_top{n}": min(1.0, n / W.shape[1]) for n in (r, kk)},
        "parts": parts,
    }
    if snapshots:
        traj = []
        for label, d in snapshots:
            try:
                a, b = _ab(d, module)
                ss, _ = _scale(d)
                qb, rb = np.linalg.qr(b)
                qa, ra = np.linalg.qr(a.T)
                traj.append({"label": label, "dW": float(np.linalg.norm(ss * rb @ ra.T))})
            except (AdapterError, OSError, ValueError):
                continue
        out["over_training"] = traj
    if other_seeds:
        sims = []
        for label, d in other_seeds:
            try:
                a2, b2 = _ab(d, module)
                s2, _ = _scale(d)
                # ⟨ΔW1, ΔW2⟩ = s1 s2 tr(A1ᵀ B1ᵀ B2 A2) = s1 s2 tr((B1ᵀB2)(A2 A1ᵀ)), computed without forming either matrix
                inner = s * s2 * float(np.trace((B.T @ b2) @ (a2 @ A.T)))
                n2 = float(np.linalg.norm(s2 * np.linalg.qr(b2)[1] @ np.linalg.qr(a2.T)[1].T))
                sims.append({"label": label, "cosine": inner / (fro_d * n2) if fro_d and n2 else None})
            except (AdapterError, OSError, ValueError):
                continue
        out["across_seeds"] = sims
    out["honesty"] = "Exact measurements of weights (base file read-only). They show where and how much the matrix changed — not why the model behaves as it does."
    return out
