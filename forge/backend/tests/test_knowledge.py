"""Knowledge packs and the doc-QA world, end to end without torch (scripted teacher, fake embedder)."""
import json
import re

import httpx
import numpy as np
import pytest

from forge.engine.docqa import DocWorld
from forge.engine.runtime import Completion, OracleBackend, ScriptedBackend, parse_action, run_episode
from forge.engine.study import Study, read_jsonl
from forge.knowledge import index as ix
from forge.knowledge.ingest import chunk_text, ingest_folder
from forge.knowledge.pack import KnowledgePack, PackError
from forge.knowledge.questions import UNANSWERABLE_FAMILY, assign_splits, check_answerable

DOCS = {
    "lanterns.md": "# Lantern care\n\nThe Amber Lantern uses a 2200 mAh lithium battery that lasts about nine hours.\n\n"
                   "Clean the glass with a dry microfiber cloth. Never submerge the lantern in water.",
    "stoves.md": "# Stove safety\n\nThe Ridge Stove burns isobutane canisters and must be used outdoors only.\n\n"
                 "Keep a clearance of one metre from tents and other flammable fabric while cooking.",
    "tarps.txt": "Tarp pitching guide\n\nThe Slate Tarp measures three by four metres and ships with eight aluminium stakes.\n\n"
                 "Pitch the low edge into the wind so rain runs off the downhill side.",
    "kettles.html": "<html><body><h1>Kettle notes</h1><p>The Basalt Kettle holds 1.2 litres and has a folding handle.</p>"
                    "<script>alert('x')</script><p>Descale it monthly with white vinegar.</p></body></html>",
}


@pytest.fixture
def corpus(tmp_path):
    d = tmp_path / "docs"
    d.mkdir()
    for name, text in DOCS.items():
        (d / name).write_text(text, encoding="utf-8")
    (d / ".hidden").mkdir()
    (d / ".hidden" / "secret.md").write_text("should be skipped " * 10)
    (d / "image.png").write_bytes(b"\x89PNG")
    (d / "empty.txt").write_text("")
    return d


class FakeTeacher:
    """Writes grounded questions by quoting a clause of the passage; declares unanswerable questions unanswerable."""
    name = "fake-teacher"

    def complete(self, messages):
        user = messages[-1]["content"]
        if user.startswith("Question:"):
            return Completion('{"answerable": false}')
        if "probably does NOT answer" in user:
            subject = re.search(r'from "([^"]+)"', user).group(1)
            return Completion(json.dumps({"question": f"What is the warranty period for the {subject} products?"}))
        passage = user.split("<<<\n", 1)[1].split("\n>>>", 1)[0]
        sentence = [s for s in re.split(r"(?<=\.)\s+", passage.split("\n\n")[-1]) if len(s.split()) > 6][0]
        words = sentence.rstrip(".").split()
        subject, answer = " ".join(words[:3]), " ".join(words[-4:])
        return Completion(json.dumps({"question": f"According to the guide, what applies to {subject}?", "answer": answer}))


def fake_embeddings():
    def vec(t):  # deterministic bag-of-words hashing "embedding"
        v = np.zeros(64)
        for w in re.findall(r"[a-z]+", t.lower()):
            v[hash(w) % 64] += 1
        return v.tolist()

    def handler(req):
        body = json.loads(req.content)
        assert body["input"][0].startswith(("search_document: ", "search_query: "))  # nomic prefixes
        return httpx.Response(200, json={"data": [{"index": i, "embedding": vec(t)} for i, t in enumerate(body["input"])]})
    return httpx.MockTransport(handler)


def test_ingest_extracts_supported_files_and_reports_skips(corpus):
    docs, chunks, skipped = ingest_folder(corpus, size=120, overlap=20)
    assert sorted(d.path for d in docs) == ["kettles.html", "lanterns.md", "stoves.md", "tarps.txt"]
    assert all("alert(" not in c.text for c in chunks)            # <script> removed
    assert any(s["path"] == "empty.txt" for s in skipped)
    assert not any("secret" in c.text for c in chunks)             # hidden folders ignored
    assert len({c.chunk_id for c in chunks}) == len(chunks)
    long = chunk_text("Sentence one is here. " * 80, "dx", size=200, overlap=40)
    assert len(long) > 3 and all(len(c.text) <= 320 for c in long)


def test_bm25_and_hybrid_search():
    chunks = [{"chunk_id": f"c{i}", "doc_id": "d", "text": t} for i, t in enumerate(
        ["isobutane stove outdoors only", "lantern battery nine hours", "tarp stakes aluminium"])]
    idx = ix.SearchIndex(chunks)
    assert idx.mode == "keyword" and idx.search("how long does the lantern battery last")[0]["chunk_id"] == "c1"
    vecs = np.eye(3, dtype=np.float32)
    hyb = ix.SearchIndex(chunks, vecs, lambda q: np.array([0, 0, 1], dtype=np.float32))
    res = hyb.search("stove", k=3)
    assert hyb.mode == "hybrid" and {r["chunk_id"] for r in res[:2]} == {"c0", "c2"}
    assert "keyword_rank" in res[0] or "vector_rank" in res[0]


def test_question_checks_and_document_splits():
    p = "The Ridge Stove burns isobutane canisters and must be used outdoors only."
    assert check_answerable({"question": "What fuel does the Ridge Stove burn?", "answer": "isobutane canisters"}, p) is None
    assert "verbatim" in check_answerable({"question": "What fuel does the Ridge Stove burn?", "answer": "propane"}, p)
    assert "self-contained" in check_answerable({"question": "What fuel does this passage say it burns?", "answer": "isobutane canisters"}, p)
    assert "gives the answer" in check_answerable({"question": "Does it burn isobutane canisters?", "answer": "isobutane canisters"}, p)
    split, unit = assign_splits([f"d{i}" for i in range(10)], 1)
    assert unit == "document" and sorted(split.values()).count("test") == 2
    assert assign_splits(["a", "b"], 1) == ({}, "passage")


def test_pack_pipeline_and_doc_study(corpus, tmp_path, monkeypatch):
    with pytest.raises(PackError):
        KnowledgePack.create(tmp_path / "k", "x", corpus, no_sensitive_data=False)
    pack = KnowledgePack.create(tmp_path / "k", "Outdoor gear", corpus, no_sensitive_data=True, chunk_size=300)
    with pytest.raises(PackError):
        pack.run_index(None, None)                                  # step order enforced
    assert pack.run_import()["documents"] == 4
    real_init = ix.Embedder.__init__

    def init(self, base, model, timeout_s=120.0, transport=None):  # every Embedder talks to the fake server
        real_init(self, base, model, timeout_s, transport=fake_embeddings())
    monkeypatch.setattr(ix.Embedder, "__init__", init)
    assert pack.run_index("http://127.0.0.1:1234/v1", "text-embedding-nomic-embed-text-v1.5")["mode"] == "hybrid"
    s = pack.run_questions(FakeTeacher(), n=8, unanswerable_frac=0.25, seed=3)
    assert s["accepted"] >= 4 and s["split_unit"] == "document" and s["unanswerable"] >= 1
    qs = pack.questions()
    assert {q["family"] for q in qs} == {"doc_answerable", "doc_unanswerable"}
    assert all(q["meta"]["gold_chunk"] for q in qs if q["family"] == "doc_answerable")

    monkeypatch.setenv("FORGE_ISOLATE_RUNS", "0")
    study = Study.init(tmp_path / "studies", name="docs", profile="smoke", arms=["teacher_filtered"], knowledge_pack=pack,
                       teacher={"provider": "lmstudio", "endpoint": "http://127.0.0.1:9/v1", "model": "t"},
                       student={"name": "s", "path": str(tmp_path)})
    assert study.plan["taskset"]["kind"] == "docqa" and study.plan["taskset"]["retrieval"]["mode"] == "hybrid"
    tasks = {t.prompt: t for t in study.tasks()}
    study.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend(tasks))
    eps = read_jsonl(study.episode_path("teacher", "train", 0)) + read_jsonl(study.episode_path("teacher", "dev", 0))
    assert eps and all(e["messages"][0]["content"].startswith("You answer questions using a document collection") for e in eps)
    assert (study.root / "query_embeddings.json").exists()           # query vectors cached for deterministic re-runs
    neg = [e for e in eps if e["family"] == UNANSWERABLE_FAMILY]
    assert neg and all(e["score"]["strict_success"] for e in neg)     # searched, then NOT_FOUND
    # Tampering with the pack after the study froze it is refused.
    (pack.root / "chunks.jsonl").write_text((pack.root / "chunks.jsonl").read_text() + "\n")
    with pytest.raises(Exception, match="changed since this study"):
        study.world()


def test_docqa_scoring_rules():
    chunks = [{"chunk_id": "d1:0000", "doc_id": "d1", "text": "The Basalt Kettle holds 1.2 litres and has a folding handle."},
              {"chunk_id": "d2:0000", "doc_id": "d2", "text": "The Slate Tarp ships with eight aluminium stakes."}]
    world = DocWorld(ix.SearchIndex(chunks), k=1)
    from forge.engine.tasks import Task
    t = Task("q1", "d1", "doc_answerable", "test", 0, "How much water does the Basalt Kettle hold?",
             [{"tool": "search", "arguments": {"query": "Basalt Kettle"}}], "1.2 litres", {"gold_chunk": "d1:0000"})
    good = run_episode(t, ScriptedBackend("s", ['{"tool":"search","arguments":{"query":"Basalt Kettle capacity"}}',
                                                '{"answer":"It holds 1.2 litres.","sources":["d1:0000"]}']), world)
    assert good["score"]["strict_success"] and good["score"]["retrieval_hit"] and good["score"]["cited_gold"]
    memory = run_episode(t, ScriptedBackend("s", ['{"answer":"1.2 litres"}']), world)
    assert not memory["score"]["strict_success"] and memory["score"]["unsupported_answer"]  # no search = not grounded
    wrong_doc = run_episode(t, ScriptedBackend("s", ['{"tool":"search","arguments":{"query":"tarp stakes"}}',
                                                     '{"answer":"1.2 litres"}']), world)
    assert wrong_doc["score"]["answer_correct"] and not wrong_doc["score"]["strict_success"]  # evidence never retrieved
    rambling = run_episode(t, ScriptedBackend("s", ['{"tool":"search","arguments":{"query":"Basalt Kettle"}}',
                                                    '{"answer":"' + "blah " * 40 + '1.2 litres"}']), world)
    assert not rambling["score"]["answer_correct"]
    with pytest.raises(Exception):
        parse_action('{"answer":"x","sources":"d1:0000"}')


def test_knowledge_api(tmp_path, settings, monkeypatch, corpus):
    from fastapi.testclient import TestClient

    from forge.api.app import create_app
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        assert c.post("/api/knowledge", json={"name": "x", "folder": str(corpus), "no_sensitive_data": False}).status_code == 422
        assert c.post("/api/knowledge", json={"name": "x", "folder": "../etc", "no_sensitive_data": True}).status_code == 422
        assert c.get("/api/knowledge/sample").json()["available"]
        pid = c.post("/api/knowledge", json={"name": "Gear", "folder": str(corpus), "no_sensitive_data": True}).json()["id"]
        assert c.post(f"/api/knowledge/{pid}/steps/index", json={}).status_code == 409   # import first
        assert c.post(f"/api/knowledge/{pid}/search", json={"query": "stove"}).status_code == 409
        pack = KnowledgePack(settings.home / "knowledge" / pid)
        pack.run_import()
        r = c.post(f"/api/knowledge/{pid}/search", json={"query": "how long does the lantern battery last", "k": 2}).json()
        assert r["mode"] == "keyword" and r["results"][0]["title"] == "Lantern care"
        assert c.post(f"/api/knowledge/{pid}/search", json={"query": "x", "mode": "vector"}).status_code == 409
        docs = c.get(f"/api/knowledge/{pid}/docs").json()
        assert len(docs) == 4 and all(d["passages"] >= 1 for d in docs)
        assert c.get(f"/api/knowledge/{pid}/chunks", params={"doc_id": docs[0]["doc_id"]}).json()["total"] >= 1
        assert c.post(f"/api/knowledge/{pid}/steps/questions", json={}).status_code == 409   # index first
        assert c.get("/api/knowledge/pack_nope").status_code == 404
        assert c.get("/api/knowledge/..%2Fetc").status_code in (404, 422)
        assert [p["id"] for p in c.get("/api/knowledge").json()] == [pid]
