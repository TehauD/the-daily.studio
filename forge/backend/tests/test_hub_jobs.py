import json
import os
import time
from types import SimpleNamespace

import pytest

from forge.jobs.runner import JobError, JobRunner
from forge.providers import hf_hub


class FakeApi:
    def list_models(self, **kw):
        self.kw = kw
        return [SimpleNamespace(id="Qwen/Qwen3-1.7B", downloads=10, likes=2, pipeline_tag="text-generation",
                                library_name="transformers", safetensors=SimpleNamespace(total=2_031_739_904),
                                gated=False, last_modified="2026-01-01", tags=["license:apache-2.0", "x"])]

    def model_info(self, repo, revision=None, files_metadata=False):
        return SimpleNamespace(sha="abc", gated=False, card_data=None, siblings=[
            SimpleNamespace(rfilename="config.json", size=1000),
            SimpleNamespace(rfilename="model-00001-of-00002.safetensors", size=3_000_000_000),
            SimpleNamespace(rfilename="model-00002-of-00002.safetensors", size=1_000_000_000),
            SimpleNamespace(rfilename="original/consolidated.pth", size=4_000_000_000)])

    def get_safetensors_metadata(self, repo, revision=None):
        return SimpleNamespace(parameter_count={"BF16": 2_031_739_904})


FILES = {
    "config.json": json.dumps({"architectures": ["Qwen3ForCausalLM"], "model_type": "qwen3", "hidden_size": 2048,
                               "num_hidden_layers": 28, "num_attention_heads": 16, "num_key_value_heads": 8,
                               "head_dim": 128, "tie_word_embeddings": True, "vocab_size": 151936}),
    "tokenizer_config.json": json.dumps({"chat_template": "{% if tools %}<tools>{% endif %}"}),
    "README.md": "---\nlicense: apache-2.0\n---\n# Qwen3",
    "model.safetensors.index.json": None,
}


def test_hub_search_reports_outbound():
    api = FakeApi()
    r = hf_hub.search("qwen3", api=api)
    assert r["results"][0]["parameters"] == 2_031_739_904 and r["outbound"]["host"] == "huggingface.co"
    assert api.kw["filter"] == ["text-generation", "safetensors"]


def test_hub_inspect_metadata_only():
    r = hf_hub.inspect("Qwen/Qwen3-1.7B", api=FakeApi(), fetch=FILES.get)
    assert r["verdict"] == "pass" and r["kind"] == "generative" and r["num_key_value_heads"] == 8
    assert r["parameters"]["total"] == 2_031_739_904
    assert r["download_bytes"] == 4_000_001_000  # .pth excluded by allow_patterns
    bad = dict(FILES, **{"config.json": json.dumps({"architectures": ["BertForMaskedLM"], "model_type": "bert"})})
    assert hf_hub.inspect("google/bert", api=FakeApi(), fetch=bad.get)["verdict"] == "fail"


def test_download_verifies_every_shard(tmp_path):
    def snap(repo_id, revision, allow_patterns, cache_dir):
        assert "*.safetensors" in allow_patterns and "*.pth" not in allow_patterns
        d = tmp_path / "snap"
        d.mkdir(exist_ok=True)
        (d / "config.json").write_text("{}")
        (d / "model.safetensors.index.json").write_text(json.dumps({"weight_map": {"a": "s1.safetensors", "b": "s2.safetensors"}}))
        (d / "s1.safetensors").write_bytes(b"x")
        return str(d)
    with pytest.raises(hf_hub.HubError, match="missing shards"):
        hf_hub.download_and_verify("o/r", snapshot=snap)
    (tmp_path / "snap" / "s2.safetensors").write_bytes(b"y")
    assert hf_hub.download_and_verify("o/r", snapshot=snap)["shards"] == ["s1.safetensors", "s2.safetensors"]


def test_job_runner_one_gpu_job_and_logs(db, tmp_path):
    jr = JobRunner(db, tmp_path / "logs")
    with db.tx() as c:  # simulate a live GPU job owned by this process
        c.execute("INSERT INTO jobs(id, kind, label, argv, gpu, status, pid, log_path, created_at) VALUES "
                  "('job_x','stage:train','t','[]',1,'running',?,'x',datetime())", (os.getpid(),))
    with pytest.raises(JobError, match="GPU is busy"):
        jr.start("stage:train", ["verify-gpu"], gpu=True)
    j = jr.start("bad", ["stage", "--study", str(tmp_path / "nope"), "--stage", "collect"], gpu=False)
    for _ in range(120):
        if jr.get(j["id"])["status"] != "running":
            break
        time.sleep(0.25)
    done = jr.get(j["id"])
    assert done["status"] == "failed" and done["exit_code"] == 1
    events = jr.log(j["id"])["events"]
    assert any(e.get("event") == "error" and "No study" in e.get("error", "") for e in events)


def test_job_recovery_marks_dead_pids_interrupted(db, tmp_path):
    with db.tx() as c:
        c.execute("INSERT INTO jobs(id, kind, label, argv, gpu, status, pid, log_path, created_at) VALUES "
                  "('job_dead','k','t','[]',1,'running',999999999,'x',datetime())")
    assert JobRunner(db, tmp_path).recover() == ["job_dead"]
