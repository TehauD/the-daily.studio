"""Search over passages: BM25 (keywords) + optional dense vectors (meaning), fused by reciprocal rank.

- BM25 is pure Python and always available — the pack works with no embedding model at all.
- Vectors come from an OpenAI-compatible /v1/embeddings endpoint on loopback (LM Studio), are
  L2-normalised and stored as float32 .npy next to the pack. nomic-embed requires task prefixes
  ("search_document: " / "search_query: "), applied automatically for that family.
- Hybrid = reciprocal-rank fusion (RRF, k=60): robust, no score calibration between methods.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any, Callable

import httpx
import numpy as np

from forge.engine.runtime import validate_endpoint

TOKEN = re.compile(r"[a-z0-9]+(?:['._-][a-z0-9]+)*")
STOP = frozenset("a an and are as at be by for from has have in is it its of on or that the this to was were will with "
                 "what which who how when where why does do did can".split())
RRF_K = 60


def tokens(text: str) -> list[str]:
    return [t for t in TOKEN.findall(text.lower()) if t not in STOP]


class BM25:
    def __init__(self, docs: list[str], k1: float = 1.5, b: float = 0.75):
        self.k1, self.b = k1, b
        self.tf = [Counter(tokens(d)) for d in docs]
        self.len = [sum(c.values()) for c in self.tf]
        self.avg = (sum(self.len) / len(self.len)) if self.len else 0.0
        df: Counter = Counter()
        for c in self.tf:
            df.update(c.keys())
        n = len(docs)
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def scores(self, query: str) -> np.ndarray:
        q = tokens(query)
        out = np.zeros(len(self.tf))
        for i, c in enumerate(self.tf):
            s = 0.0
            for t in q:
                f = c.get(t)
                if f:
                    s += self.idf[t] * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * self.len[i] / (self.avg or 1)))
            out[i] = s
        return out


def _prefix(model: str, kind: str) -> str:
    return (f"search_{kind}: " if "nomic" in model.lower() else "")


class Embedder:
    """Loopback OpenAI-compatible embeddings. `transport` is injectable for tests."""

    def __init__(self, base_url: str, model: str, timeout_s: float = 120.0, transport: httpx.BaseTransport | None = None):
        base = validate_endpoint(base_url)
        self.url = (base if base.endswith("/v1") else base + "/v1") + "/embeddings"
        self.model = model
        self.client = httpx.Client(timeout=timeout_s, trust_env=False, follow_redirects=False, transport=transport)

    def embed(self, texts: list[str], kind: str = "document", batch: int = 32,
              progress: Callable[[int, int], None] | None = None) -> np.ndarray:
        vecs: list[list[float]] = []
        for i in range(0, len(texts), batch):
            part = [_prefix(self.model, kind) + t for t in texts[i:i + batch]]
            r = self.client.post(self.url, json={"model": self.model, "input": part})
            r.raise_for_status()
            data = sorted(r.json()["data"], key=lambda d: d["index"])
            vecs.extend(d["embedding"] for d in data)
            if progress:
                progress(min(i + batch, len(texts)), len(texts))
        m = np.asarray(vecs, dtype=np.float32)
        norms = np.linalg.norm(m, axis=1, keepdims=True)
        return m / np.where(norms == 0, 1, norms)


class SearchIndex:
    def __init__(self, chunks: list[dict], vectors: np.ndarray | None = None, embed_query: Callable[[str], np.ndarray] | None = None):
        self.chunks = chunks
        self.bm25 = BM25([c["text"] for c in chunks])
        self.vectors = vectors
        self.embed_query = embed_query

    @property
    def mode(self) -> str:
        return "hybrid" if self.vectors is not None and self.embed_query is not None else "keyword"

    def search(self, query: str, k: int = 3, mode: str | None = None) -> list[dict[str, Any]]:
        mode = mode or self.mode
        bm = self.bm25.scores(query)
        bm_rank = np.argsort(-bm, kind="stable")
        fused: dict[int, float] = {}
        detail: dict[int, dict] = {}
        for r, i in enumerate(bm_rank[:50]):
            if bm[i] <= 0:
                break
            fused[int(i)] = fused.get(int(i), 0.0) + 1.0 / (RRF_K + r + 1)
            detail.setdefault(int(i), {})["keyword_rank"] = r + 1
            detail[int(i)]["keyword_score"] = round(float(bm[i]), 3)
        if mode in ("hybrid", "vector") and self.vectors is not None and self.embed_query is not None:
            if mode == "vector":
                fused = {}
            sims = self.vectors @ self.embed_query(query)
            for r, i in enumerate(np.argsort(-sims, kind="stable")[:50]):
                fused[int(i)] = fused.get(int(i), 0.0) + 1.0 / (RRF_K + r + 1)
                detail.setdefault(int(i), {})["vector_rank"] = r + 1
                detail[int(i)]["similarity"] = round(float(sims[i]), 4)
        order = sorted(fused, key=lambda i: (-fused[i], i))[:k]
        return [{"chunk_id": self.chunks[i]["chunk_id"], "doc_id": self.chunks[i]["doc_id"], "text": self.chunks[i]["text"],
                 "score": round(fused[i], 5), **detail.get(i, {})} for i in order]
