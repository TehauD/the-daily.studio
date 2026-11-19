"""Knowledge pack: a document folder turned into searchable passages and verified practice questions.

  <FORGE_HOME>/knowledge/<pack_id>/
    pack.json         name, source folder, attestation, step status, embedding config
    docs.jsonl        one row per document
    chunks.jsonl      passages (what retrieval returns and the model reads)
    skipped.json      files not imported, with reasons
    vectors.npy       L2-normalised passage embeddings (optional)
    questions.jsonl   verified tasks (Task rows), split by document
    rejected.jsonl    candidates that failed a check, with the reason

Steps: import → index → questions. Re-running an earlier step invalidates the later ones.
Content hashes are recorded so a study can freeze exactly which pack version it used.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Callable

import numpy as np

from forge.knowledge import index as ix
from forge.knowledge import ingest, questions
from forge.util import canonical_json, new_id, sha256_file, sha256_text, utcnow

STEPS = ("import", "index", "questions")


class PackError(RuntimeError):
    pass


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text("".join(canonical_json(r) + "\n" for r in rows), encoding="utf-8")
    os.replace(tmp, path)


def _read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


class KnowledgePack:
    def __init__(self, root: Path):
        self.root = root
        if not (root / "pack.json").exists():
            raise PackError(f"No knowledge pack at {root}")

    @staticmethod
    def create(base: Path, name: str, source_dir: Path, no_sensitive_data: bool,
               chunk_size: int = 800, chunk_overlap: int = 120) -> "KnowledgePack":
        if not no_sensitive_data:
            raise PackError("Confirm the folder contains no patient, personal, or confidential data before importing")
        pid = new_id("pack")
        root = base / pid
        root.mkdir(parents=True)
        meta = {"id": pid, "name": name, "source_dir": str(source_dir), "created_at": utcnow(),
                "attestation": {"no_sensitive_data": True, "at": utcnow()},
                "chunking": {"size": chunk_size, "overlap": chunk_overlap}, "embedding": None, "steps": {}}
        (root / "pack.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        return KnowledgePack(root)

    # ---- state
    @property
    def meta(self) -> dict[str, Any]:
        return json.loads((self.root / "pack.json").read_text(encoding="utf-8"))

    def _save(self, meta: dict) -> None:
        tmp = self.root / "pack.json.tmp"
        tmp.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        os.replace(tmp, self.root / "pack.json")

    def _set_step(self, step: str, status: str, **extra: Any) -> None:
        m = self.meta
        m["steps"][step] = {"status": status, "at": utcnow(), **extra}
        if status == "completed":  # earlier step re-done → later ones are stale
            for later in STEPS[STEPS.index(step) + 1:]:
                if later in m["steps"]:
                    m["steps"][later] = {"status": "stale", "at": utcnow(),
                                         "reason": f"'{step}' was re-run; run '{later}' again"}
        self._save(m)

    def check_can_run(self, step: str) -> None:
        if step not in STEPS:
            raise PackError(f"Unknown step {step}")
        prev = STEPS[:STEPS.index(step)]
        for p in prev:
            if self.meta["steps"].get(p, {}).get("status") != "completed":
                raise PackError(f"'{step}' needs '{p}' first")

    def docs(self) -> list[dict]:
        return _read_jsonl(self.root / "docs.jsonl")

    def chunks(self) -> list[dict]:
        return _read_jsonl(self.root / "chunks.jsonl")

    def questions(self) -> list[dict]:
        return _read_jsonl(self.root / "questions.jsonl")

    def rejected(self) -> list[dict]:
        return _read_jsonl(self.root / "rejected.jsonl")

    def vectors(self) -> np.ndarray | None:
        p = self.root / "vectors.npy"
        return np.load(p) if p.exists() else None

    def hashes(self) -> dict[str, str | None]:
        def h(name: str) -> str | None:
            p = self.root / name
            return sha256_file(p) if p.exists() else None
        return {"chunks": h("chunks.jsonl"), "vectors": h("vectors.npy"), "questions": h("questions.jsonl")}

    def search_index(self, embed_cache: dict[str, list[float]] | None = None) -> ix.SearchIndex:
        """Keyword-only unless vectors exist and the embedding endpoint answers. Query vectors can be cached
        (studies persist the cache so re-runs are deterministic even if the endpoint changes)."""
        chunks, vecs, emb = self.chunks(), self.vectors(), self.meta.get("embedding")
        embed_query = None
        if vecs is not None and emb:
            embedder = ix.Embedder(emb["endpoint"], emb["model"])

            def embed_query(q: str) -> np.ndarray:
                key = sha256_text(q)
                if embed_cache is not None and key in embed_cache:
                    return np.asarray(embed_cache[key], dtype=np.float32)
                v = embedder.embed([q], kind="query")[0]
                if embed_cache is not None:
                    embed_cache[key] = v.tolist()
                return v
        return ix.SearchIndex(chunks, vecs, embed_query)

    # ---- steps
    def run_import(self, emit: Callable[[dict], None] = lambda e: None) -> dict:
        m = self.meta
        src = Path(m["source_dir"])
        if not src.is_dir():
            raise PackError(f"Folder not found: {src}")
        self._set_step("import", "running")
        docs, chunks, skipped = ingest.ingest_folder(src, m["chunking"]["size"], m["chunking"]["overlap"])
        if not chunks:
            self._set_step("import", "failed", error="No readable documents (supported: .txt .md .html .pdf)")
            raise PackError("No readable documents found (supported: .txt, .md, .rst, .html, .pdf)")
        _write_jsonl(self.root / "docs.jsonl", [d.__dict__ for d in docs])
        _write_jsonl(self.root / "chunks.jsonl", [c.to_dict() for c in chunks])
        (self.root / "skipped.json").write_text(json.dumps(skipped, indent=2), encoding="utf-8")
        for stale in ("vectors.npy", "questions.jsonl", "rejected.jsonl"):
            (self.root / stale).unlink(missing_ok=True)
        summary = {"documents": len(docs), "passages": len(chunks), "skipped": len(skipped),
                   "characters": sum(d.chars for d in docs)}
        emit({"event": "imported", **summary})
        self._set_step("import", "completed", summary=summary)
        return summary

    def run_index(self, endpoint: str | None, model: str | None, emit: Callable[[dict], None] = lambda e: None,
                  transport: Any = None) -> dict:
        self.check_can_run("index")
        self._set_step("index", "running")
        chunks = self.chunks()
        m = self.meta
        if model and endpoint:
            embedder = ix.Embedder(endpoint, model, transport=transport)
            vecs = embedder.embed([c["text"] for c in chunks], kind="document",
                                  progress=lambda d, t: emit({"event": "embedded", "done": d, "total": t}))
            np.save(self.root / "vectors.npy", vecs)
            m = self.meta
            m["embedding"] = {"endpoint": endpoint, "model": model, "dim": int(vecs.shape[1])}
        else:
            (self.root / "vectors.npy").unlink(missing_ok=True)
            m["embedding"] = None
        self._save(m)
        summary = {"passages": len(chunks), "mode": "hybrid" if m["embedding"] else "keyword",
                   "model": model, "dim": m["embedding"]["dim"] if m["embedding"] else None}
        emit({"event": "indexed", **summary})
        self._set_step("index", "completed", summary=summary)
        return summary

    def run_questions(self, teacher, n: int = 60, unanswerable_frac: float = 0.25, seed: int = 7,
                      emit: Callable[[dict], None] = lambda e: None) -> dict:
        self.check_can_run("questions")
        self._set_step("questions", "running")
        idx = self.search_index()
        docs = {d["doc_id"]: d for d in self.docs()}
        tasks, rejected, summary = questions.generate(self.chunks(), docs, teacher, lambda q, k: idx.search(q, k),
                                                      n=n, unanswerable_frac=unanswerable_frac, seed=seed, emit=emit)
        if not tasks:
            self._set_step("questions", "failed", error="No question passed verification")
            raise PackError("No question passed verification; see the rejected list for reasons")
        _write_jsonl(self.root / "questions.jsonl", [t.to_dict() for t in tasks])
        _write_jsonl(self.root / "rejected.jsonl", rejected)
        summary["config"] = {"n": n, "unanswerable_frac": unanswerable_frac, "seed": seed, "teacher": getattr(teacher, "name", "")}
        self._set_step("questions", "completed", summary=summary)
        return summary

    def summary(self) -> dict[str, Any]:
        m = self.meta
        return {**m, "path": str(self.root), "hashes": self.hashes(),
                "skipped": json.loads((self.root / "skipped.json").read_text(encoding="utf-8")) if (self.root / "skipped.json").exists() else []}
