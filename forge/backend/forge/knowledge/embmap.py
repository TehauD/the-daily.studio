"""Embedding map of a knowledge pack: passages and practice questions on one 2D plane.

- Projection: PCA fitted on the passage vectors (deterministic, no extra dependencies); questions are projected
  into the same plane. 2D cannot preserve every distance, so the map reports how much it keeps:
    * explained variance of the two axes, and
    * neighbour preservation: for each passage, the share of its k nearest neighbours by cosine similarity in the
      full embedding space that are also among its k nearest on the map.
- Retrieval is NOT read from the map: for every question the student's actual search (hybrid or keyword, top-k)
  is run, and the true cosine rank of the correct passage is reported. The map is for orientation.
"""
from __future__ import annotations

import json
from typing import Any

import httpx
import numpy as np

from forge.knowledge import index as ix
from forge.util import sha256_text, utcnow

MAP_VERSION = 1
NEIGHBOURS = 10
SAMPLE_CAP = 2000


class MapError(RuntimeError):
    pass


def neighbour_preservation(full: np.ndarray, flat: np.ndarray, k: int = NEIGHBOURS, seed: int = 0) -> float | None:
    n = len(full)
    if n < 3:
        return None
    k = min(k, n - 1)
    idx = np.arange(n)
    if n > SAMPLE_CAP:
        idx = np.sort(np.random.default_rng(seed).choice(n, SAMPLE_CAP, replace=False))
    f, p = full[idx], flat[idx]
    sims = f @ f.T
    np.fill_diagonal(sims, -np.inf)
    d2 = ((p[:, None, :] - p[None, :, :]) ** 2).sum(-1)
    np.fill_diagonal(d2, np.inf)
    hi = np.argpartition(-sims, k, axis=1)[:, :k]
    lo = np.argpartition(d2, k, axis=1)[:, :k]
    return float(np.mean([len(set(a) & set(b)) / k for a, b in zip(hi, lo)]))


def build_map(pack: Any, k: int = 3) -> dict[str, Any]:
    vecs = pack.vectors()
    emb = pack.meta.get("embedding")
    if vecs is None or not emb:
        raise MapError("This pack has a keyword-only index. Rebuild it with an embedding model (step 2) to see the map.")
    hashes = pack.hashes()
    key = sha256_text(json.dumps([MAP_VERSION, hashes, emb.get("model"), k]))
    cache_file = pack.root / "map.json"
    if cache_file.exists():
        cached = json.loads(cache_file.read_text(encoding="utf-8"))
        if cached.get("key") == key:
            return cached
    chunks, docs = pack.chunks(), {d["doc_id"]: d for d in pack.docs()}
    qs = pack.questions()

    mu = vecs.mean(axis=0)
    _, s, vt = np.linalg.svd(vecs - mu, full_matrices=False)
    axes = vt[:2]
    xy = (vecs - mu) @ axes.T
    var = (s ** 2) / max(float((s ** 2).sum()), 1e-12)

    # Query vectors: batch-embed once, cached with the embedding model they came from.
    qcache_file = pack.root / "query_vectors.json"
    qcache: dict[str, Any] = {}
    if qcache_file.exists():
        raw = json.loads(qcache_file.read_text(encoding="utf-8"))
        if raw.get("model") == emb["model"] and raw.get("vectors_sha256") == hashes["vectors"]:
            qcache = raw["vectors"]
    note = None
    missing = [q["prompt"] for q in qs if sha256_text(q["prompt"]) not in qcache]
    if missing:
        try:
            got = ix.Embedder(emb["endpoint"], emb["model"]).embed(missing, kind="query")
            for text, v in zip(missing, got):
                qcache[sha256_text(text)] = v.tolist()
            qcache_file.write_text(json.dumps({"model": emb["model"], "vectors_sha256": hashes["vectors"],
                                               "vectors": qcache}), encoding="utf-8")
        except httpx.HTTPError as e:
            note = (f"Embedding endpoint unreachable ({type(e).__name__}); questions are not placed. "
                    "Load the embedding model in LM Studio and refresh.")
    idx = pack.search_index(qcache)
    by_id = {c["chunk_id"]: i for i, c in enumerate(chunks)}

    q_rows = []
    for q in qs:
        h = sha256_text(q["prompt"])
        if h not in qcache:
            continue
        qv = np.asarray(qcache[h], dtype=np.float32)
        p = (qv - mu) @ axes.T
        sims = vecs @ qv
        order = np.argsort(-sims, kind="stable")
        gold = q["meta"].get("gold_chunk")
        gi = by_id.get(gold) if gold else None
        hits = idx.search(q["prompt"], k)
        q_rows.append({
            "task_id": q["task_id"], "prompt": q["prompt"], "family": q["family"], "split": q["split"],
            "x": round(float(p[0]), 5), "y": round(float(p[1]), 5), "gold": gi,
            "retrieved": [by_id[r["chunk_id"]] for r in hits],
            "retrieved_detail": [{"i": by_id[r["chunk_id"]], "keyword_rank": r.get("keyword_rank"),
                                  "vector_rank": r.get("vector_rank"), "similarity": r.get("similarity")} for r in hits],
            "hit": (gi in [by_id[r["chunk_id"]] for r in hits]) if gi is not None else None,
            "gold_similarity": round(float(sims[gi]), 4) if gi is not None else None,
            "gold_vector_rank": int(np.where(order == gi)[0][0]) + 1 if gi is not None else None,
            "top_similarity": round(float(sims[order[0]]), 4),
        })
    doc_ids = sorted({c["doc_id"] for c in chunks})
    out = {
        "key": key, "map_version": MAP_VERSION, "computed": True, "generated_at": utcnow(),
        "model": emb["model"], "dim": int(vecs.shape[1]), "mode": idx.mode, "k": k,
        "projection": {"method": "PCA on passage vectors", "explained_variance": [round(float(v), 4) for v in var[:2]],
                       "neighbour_preservation": neighbour_preservation(vecs, xy),
                       "neighbours": min(NEIGHBOURS, max(1, len(vecs) - 1))},
        "docs": [{"doc_id": d, "title": docs.get(d, {}).get("title", d), "color": i} for i, d in enumerate(doc_ids)],
        "passages": [{"i": i, "chunk_id": c["chunk_id"], "doc": doc_ids.index(c["doc_id"]), "x": round(float(xy[i, 0]), 5),
                      "y": round(float(xy[i, 1]), 5), "text": c["text"][:280]} for i, c in enumerate(chunks)],
        "questions": q_rows,
        "retrieval_hit_rate": (sum(1 for q in q_rows if q["hit"]) / max(1, sum(1 for q in q_rows if q["hit"] is not None))),
        "note": note,
        "honesty": ("2D positions are a PCA projection and distort distances; the search results and cosine ranks listed "
                    "for each question are computed in the full embedding space and are what the student's tool uses."),
    }
    if note is None:
        cache_file.write_text(json.dumps(out), encoding="utf-8")
    return out
