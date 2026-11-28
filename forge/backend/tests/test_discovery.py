import asyncio
import json

import httpx

from forge.providers.hf_cache import HuggingFaceCacheProvider
from forge.providers.lmstudio import LMStudioProvider
from forge.providers.local_dir import LocalDirectoryProvider
from forge.providers.ollama import OllamaProvider, parse_param_size
from forge.providers.openai_compat import OpenAICompatibleProvider
from forge.registry.discovery import run_discovery
from forge.registry.registry import ModelRegistry
from tests.builders import write_gguf, write_hf_cache_repo, write_hf_model

run = asyncio.run


def test_hf_cache_discovery(tmp_path):
    cache = tmp_path / "hub"
    write_hf_cache_repo(cache, "Qwen/Qwen2.5-0.5B-Instruct")
    res = run(HuggingFaceCacheProvider(cache).discover())
    assert res.status == "ok" and len(res.models) == 1
    m = res.models[0]
    assert m.name == "Qwen/Qwen2.5-0.5B-Instruct"
    assert m.parameter_count == 1000 * 64 + 64 * 64 and m.parameter_count_source == "exact_header"
    assert m.context_length == 32768 and m.license == "apache-2.0" and m.format == "hf_safetensors"
    assert m.metadata["revision"] == "a" * 40


def test_hf_cache_missing_dir(tmp_path):
    assert run(HuggingFaceCacheProvider(tmp_path / "none").discover()).status == "not_found"


def test_local_dir_finds_hf_and_gguf_and_skips_split_shards(tmp_path):
    write_hf_model(tmp_path / "root" / "student")
    write_gguf(tmp_path / "root" / "ggufs" / "teacher.Q4_K_M.gguf")
    write_gguf(tmp_path / "root" / "ggufs" / "big-00001-of-00002.gguf")
    write_gguf(tmp_path / "root" / "ggufs" / "big-00002-of-00002.gguf")
    res = run(LocalDirectoryProvider([tmp_path / "root"]).discover())
    fmts = sorted(m.format for m in res.models)
    assert fmts == ["gguf", "gguf", "hf_safetensors"]


def test_local_dir_disabled_when_unconfigured():
    assert run(LocalDirectoryProvider([]).discover()).status == "disabled"


def _ollama_transport():
    def handler(req: httpx.Request):
        if req.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "qwen2.5:7b", "size": 4_700_000_000, "digest": "d1",
                "details": {"format": "gguf", "family": "qwen2", "parameter_size": "7.6B", "quantization_level": "Q4_K_M"}}]})
        if req.url.path == "/api/version":
            return httpx.Response(200, json={"version": "0.12.0"})
        if req.url.path == "/api/show":
            assert json.loads(req.content)["model"] == "qwen2.5:7b"
            return httpx.Response(200, json={"license": "Apache License 2.0\n...", "template": "{{ .Tools }}",
                "model_info": {"general.architecture": "qwen2", "general.parameter_count": 7615616512,
                               "qwen2.context_length": 32768, "qwen2.vocab_size": 152064},
                "capabilities": ["completion", "tools"]})
        return httpx.Response(404)
    return httpx.MockTransport(handler)


def test_ollama_discovery_metadata():
    res = run(OllamaProvider("http://127.0.0.1:11434", transport=_ollama_transport()).discover())
    assert res.status == "ok" and res.detail == "Ollama 0.12.0"
    m = res.models[0]
    assert m.parameter_count == 7615616512 and m.context_length == 32768 and m.quantization == "Q4_K_M"
    assert m.metadata["ollama_capabilities"] == ["completion", "tools"] and m.license == "Apache License 2.0"


def test_ollama_unreachable():
    def boom(req):
        raise httpx.ConnectError("refused", request=req)
    res = run(OllamaProvider("http://127.0.0.1:11434", transport=httpx.MockTransport(boom)).discover())
    assert res.status == "unreachable" and not res.models


def test_parse_param_size():
    assert parse_param_size("7.6B") == 7_600_000_000 and parse_param_size("494M") == 494_000_000
    assert parse_param_size(None) is None and parse_param_size("big") is None


def test_lmstudio_links_rest_to_files(tmp_path):
    write_gguf(tmp_path / "lms" / "lmstudio-community" / "qwen2.5-7b-instruct-GGUF" / "qwen2.5-7b-instruct-Q4_K_M.gguf")

    def handler(req):
        if req.url.path == "/api/v0/models":
            return httpx.Response(200, json={"data": [
                {"id": "qwen2.5-7b-instruct", "type": "llm", "arch": "qwen2", "compatibility_type": "gguf",
                 "quantization": "Q4_K_M", "state": "loaded", "max_context_length": 32768, "capabilities": ["tool_use"]},
                {"id": "text-embedding-nomic", "type": "embeddings"},
                {"id": "remote-only", "type": "llm", "compatibility_type": "gguf"}]})
        return httpx.Response(404)
    res = run(LMStudioProvider("http://127.0.0.1:1234", (tmp_path / "lms",), transport=httpx.MockTransport(handler)).discover())
    names = {m.locator.split("://")[0]: m for m in res.models}
    assert names["file"].metadata["lmstudio_state"] == "loaded"
    assert names["lmstudio"].name == "remote-only" and len(res.models) == 2


def test_lmstudio_falls_back_to_openai_v1(tmp_path):
    def handler(req):
        if req.url.path == "/v1/models":
            return httpx.Response(200, json={"data": [{"id": "m1"}]})
        return httpx.Response(404)
    res = run(LMStudioProvider("http://127.0.0.1:1234", (), transport=httpx.MockTransport(handler)).discover())
    assert res.status == "ok" and res.models[0].name == "m1" and "openai_v1" in res.detail


def test_openai_compat_endpoint():
    def handler(req):
        assert req.url.path == "/v1/models"
        return httpx.Response(200, json={"data": [{"id": "llama-3.2-3b", "max_model_len": 8192}]})
    p = OpenAICompatibleProvider("llamacpp", "http://127.0.0.1:8080/v1", transport=httpx.MockTransport(handler))
    res = run(p.discover())
    assert res.provider == "endpoint:llamacpp" and res.models[0].context_length == 8192


class _Fake:
    def __init__(self, name, result):
        self.name, self.result = name, result

    async def discover(self):
        return self.result


def test_run_discovery_persists_marks_missing_and_offline(db, tmp_path):
    root = tmp_path / "r"
    write_hf_model(root / "a")
    write_hf_model(root / "b")
    hw = {"cuda_available": True, "bitsandbytes": True}
    out = run(run_discovery(db, [LocalDirectoryProvider([root])], hw))
    assert out["providers"]["local_directory"]["models"] == 2
    reg = ModelRegistry(db)
    assert all(m["status"] == "available" for m in reg.list())

    import shutil
    shutil.rmtree(root / "b")
    out = run(run_discovery(db, [LocalDirectoryProvider([root])], hw))
    statuses = sorted(m["status"] for m in reg.list())
    assert statuses == ["available", "missing"] and out["providers"]["local_directory"]["marked_missing"] == 1

    from forge.providers.base import ProviderResult
    run(run_discovery(db, [_Fake("local_directory", ProviderResult(provider="local_directory", status="unreachable"))], hw))
    assert {m["status"] for m in reg.list()} == {"provider_offline", "missing"}


def test_discovery_isolates_provider_crash(db):
    class Boom:
        name = "boom"
        async def discover(self):
            raise RuntimeError("kaboom")
    out = run(run_discovery(db, [Boom()], {}))
    assert out["providers"]["boom"]["status"] == "error"
