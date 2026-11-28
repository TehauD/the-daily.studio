"""One regression test per defect in the v0.5 defect table (§10)."""
import json
import socket
import subprocess
import sys
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from forge.api.app import create_app
from forge.hardware.probe import TorchInfo, parse_cuda_version
from forge.providers.base import DiscoveredModel
from forge.providers.formats import parameter_report, read_gguf_metadata
from forge.providers.hf_config import inspect_hf_dir
from forge.providers.lmstudio import LMStudioProvider
from forge.registry import discovery
from forge.registry.capabilities import compute_capabilities
from forge.registry.registry import ModelRegistry, RegistryError
from forge.registry.roles import classify_kind
from tests.builders import write_gguf, write_hf_model, write_safetensors

GPU = {"cuda_available": True, "bitsandbytes": True}


@pytest.fixture
def client(settings, monkeypatch):
    monkeypatch.setattr(discovery, "hardware_context", lambda: GPU)
    with TestClient(create_app(settings)) as c:
        c.headers["X-Forge-Token"] = c.get("/api/system/session").json()["token"]
        yield c


def test_telemetry_sampler_starts_on_running_loop(client):
    """Defect: telemetry stuck on 'Collecting samples' (sync route → no event loop → sampler never started)."""
    first = client.get("/api/system/telemetry").json()
    assert first["running"] is True and len(first["samples"]) >= 1  # immediate measured sample
    deadline = time.time() + 6
    while time.time() < deadline:
        if len(client.get("/api/system/telemetry").json()["samples"]) >= 2:
            break
        time.sleep(0.5)
    assert len(client.get("/api/system/telemetry").json()["samples"]) >= 2


def test_cuda_version_banner_and_query_fallback():
    assert parse_cuda_version("Driver Version: 610.88   CUDA Version: 13.0") == "13.0"
    assert parse_cuda_version("    CUDA Version                          : 13.0") == "13.0"
    garbled = b"\xe2\x94\x82 NVIDIA-SMI 610.88 \xff CUDA Version: 13.0 \xe2\x94\x82".decode("utf-8", errors="replace")
    assert parse_cuda_version(garbled) == "13.0"


def test_lmstudio_no_duplicate_rows_for_publisher_namespaced_ids(tmp_path):
    root = tmp_path / "lms"
    write_gguf(root / "lmstudio-community" / "Qwen3.8-27B-GGUF" / "Qwen3.8-27B-Q4_K_M.gguf", arch="qwen3")
    write_gguf(root / "lmstudio-community" / "gpt-oss-20b-GGUF" / "gpt-oss-20b-MXFP4.gguf", arch="gpt-oss", file_type=38)
    write_gguf(root / "lmstudio-community" / "gemma-3-12b-it-GGUF" / "gemma-3-12b-it-Q4_K_M.gguf", arch="gemma3")

    def handler(req):
        return httpx.Response(200, json={"data": [
            {"id": "qwen/qwen3.8-27b", "type": "llm", "state": "loaded"},
            {"id": "openai/gpt-oss-20b", "type": "llm"}, {"id": "google/gemma-3-12b", "type": "llm"},
            {"id": "text-embedding-nomic-embed-text-v1.5", "type": "embeddings"}]})
    import asyncio
    res = asyncio.run(LMStudioProvider("http://127.0.0.1:1234", (root,), transport=httpx.MockTransport(handler)).discover())
    assert len(res.models) == 3, [m.name for m in res.models]
    assert all(m.locator.startswith("file://") for m in res.models)
    qwen = next(m for m in res.models if "Qwen3.8" in m.locator)
    assert qwen.metadata["lmstudio_id"] == "qwen/qwen3.8-27b" and qwen.metadata["lmstudio_state"] == "loaded"


def test_gguf_file_types_36_37_38(tmp_path):
    for ft, name in ((36, "TQ1_0"), (37, "TQ2_0"), (38, "MXFP4")):
        p = tmp_path / f"m{ft}.gguf"
        write_gguf(p, file_type=ft)
        assert read_gguf_metadata(p)["quantization"] == name


@pytest.mark.parametrize("mt,arch,kind", [
    ("bert", "BertForMaskedLM", "encoder"), ("dinov2", "Dinov2Model", "vision"),
    ("whisper", "WhisperForConditionalGeneration", "speech"), ("nomic_bert", "NomicBertModel", "encoder"),
    ("qwen3", "Qwen3ForCausalLM", "generative"), ("t5", "T5ForConditionalGeneration", "seq2seq"),
])
def test_encoders_vision_speech_classified(mt, arch, kind):
    assert classify_kind(mt, [arch], "x")[0] == kind


def test_encoder_inventoried_but_never_role_eligible(db, tmp_path):
    d = write_hf_model(tmp_path / "bert", model_type="bert", arch="BertForMaskedLM")
    m = inspect_hf_dir(d, "huggingface_cache", "bert-base-uncased", f"file://{d}")
    caps = compute_capabilities(m, GPU)
    assert all(c["status"] == "unsupported" for c in caps.values())
    reg = ModelRegistry(db)
    mid = reg.upsert(m, caps)
    assert reg.list(include_ineligible=False) == [] and len(reg.list()) == 1
    for role in ("teacher", "student"):
        with pytest.raises(RegistryError):
            reg.assign_role(mid, role)
    st = DiscoveredModel(provider="x", locator="e", name="nomic-embed-text-v1.5", format="gguf",
                         metadata={"model_kind": "embedding", "model_kind_evidence": "x"})
    assert compute_capabilities(st, GPU)["inference"]["status"] == "unsupported"


def test_port_conflict_reports_owner_and_exits(tmp_path):
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    s.listen(1)
    port = s.getsockname()[1]
    try:
        r = subprocess.run([sys.executable, "-m", "forge"], capture_output=True, timeout=60,
                           env={"FORGE_PORT": str(port), "FORGE_HOME": str(tmp_path / "h"), "PATH": "",
                                "SYSTEMROOT": __import__("os").environ.get("SYSTEMROOT", "")},
                           cwd=__import__("pathlib").Path(__file__).resolve().parents[1])
        err = r.stderr.decode("utf-8", errors="replace")
        assert r.returncode == 3 and f"Port {port}" in err and "already in use" in err
        assert not (tmp_path / "h" / "forge.db").exists()  # nothing initialized before the port check
    finally:
        s.close()


def test_responses_declare_utf8_charset(client):
    r = client.get("/api/system/health")
    assert "charset=utf-8" in r.headers["content-type"]


def test_readiness_reports_numpy_and_interpreter(client):
    checks = {c["id"]: c for c in client.get("/api/system/readiness").json()["checks"]}
    assert checks["numpy"]["status"] == "pass"
    assert sys.executable in checks["venv"]["detail"]
    assert {"cuda", "teacher_endpoint", "student_role"} <= set(checks)


def test_torch_probe_records_interpreter():
    assert "python_executable" in TorchInfo.__dataclass_fields__ and "numpy_version" in TorchInfo.__dataclass_fields__


def test_parameter_report_tied_duplicate_lm_head(tmp_path):
    """Defect: Qwen3-1.7B shows 2.03B; the checkpoint stores lm_head although embeddings are tied."""
    d = tmp_path / "q"
    d.mkdir()
    write_safetensors(d / "model.safetensors", {"model.embed_tokens.weight": [100, 8], "lm_head.weight": [100, 8],
                                                "model.layers.0.mlp.up_proj.weight": [16, 8]})
    rep = parameter_report(d, tie_word_embeddings=True)
    assert rep["stored_total"] == 1728 and rep["lm_head_is_duplicate_of_tied_embedding"]
    assert rep["unique_total"] == 928 and rep["non_embedding"] == 128
    untied = parameter_report(d, tie_word_embeddings=False)
    assert untied["unique_total"] == 1728 and untied["non_embedding"] == 128


def test_mutations_require_session_token(settings):
    with TestClient(create_app(settings)) as c:
        assert c.post("/api/models/discover").status_code == 403
        assert c.post("/api/models/discover", headers={"X-Forge-Token": "wrong"}).status_code == 403
        assert c.get("/api/system/health").status_code == 200


def test_runtime_overrides_loopback_only(client):
    assert client.put("/api/settings/runtime", json={"lmstudio_url": "http://evil.example:1234"}).status_code == 422
    r = client.put("/api/settings/runtime", json={"lmstudio_url": "http://127.0.0.1:4321"}).json()
    assert r["lmstudio_url"] == "http://127.0.0.1:4321" and r["runtime_overrides"]["lmstudio_url"]
    exported = client.get("/api/settings/export").json()
    assert exported["runtime_overrides"]["lmstudio_url"] == "http://127.0.0.1:4321"
    assert client.post("/api/settings/import", json=exported).status_code == 200
