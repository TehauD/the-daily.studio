"""GGUF export wrapper (with a stand-in converter), the built-in header reader, and the efficiency summary."""
import json
import struct
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from forge.engine import gguf


def write_gguf(path: Path, arch="qwen3", tensors=3, file_type=7):
    def s(x):
        b = x.encode()
        return struct.pack("<Q", len(b)) + b
    kvs = [(s("general.architecture") + struct.pack("<I", 8) + s(arch)),
           (s("general.file_type") + struct.pack("<I", 4) + struct.pack("<I", file_type)),
           (s(f"{arch}.block_count") + struct.pack("<I", 4) + struct.pack("<I", 2)),
           (s("tokenizer.ggml.tokens") + struct.pack("<I", 9) + struct.pack("<I", 8) + struct.pack("<Q", 2) + s("a") + s("b")),
           (s("tokenizer.chat_template") + struct.pack("<I", 8) + s("{{x}}"))]
    path.write_bytes(b"GGUF" + struct.pack("<IQQ", 3, tensors, len(kvs)) + b"".join(kvs))


def test_header_reader(tmp_path):
    p = tmp_path / "m.gguf"
    write_gguf(p)
    h = gguf.read_header(p)
    assert h == {**h, "version": 3, "tensors": 3, "architecture": "qwen3", "file_type": "Q8_0", "block_count": 2, "has_chat_template": True}
    (tmp_path / "bad.gguf").write_bytes(b"NOPE" + b"\0" * 20)
    with pytest.raises(gguf.GGUFError, match="magic"):
        gguf.read_header(tmp_path / "bad.gguf")
    (tmp_path / "short.gguf").write_bytes(b"GGUF\x03\0\0\0")
    with pytest.raises(gguf.GGUFError):
        gguf.read_header(tmp_path / "short.gguf")


FAKE_CONVERT = '''import struct, sys
args = sys.argv[1:]
out = args[args.index("--outfile") + 1]
def s(x):
    b = x.encode(); return struct.pack("<Q", len(b)) + b
kv = s("general.architecture") + struct.pack("<I", 8) + s("qwen3") + s("general.file_type") + struct.pack("<I", 4) + struct.pack("<I", 7)
open(out, "wb").write(b"GGUF" + struct.pack("<IQQ", 3, 5, 2) + kv)
print("converted", args[0])
'''


def test_export_with_stand_in_converter(tmp_path):
    llama = tmp_path / "llama.cpp"
    llama.mkdir()
    assert gguf.find_tools(str(llama))["ok"] is False
    (llama / "convert_hf_to_gguf.py").write_text(FAKE_CONVERT)
    t = gguf.find_tools(str(llama))
    assert t["ok"] and t["quantize"] is None
    root = tmp_path / "study"
    src = root / "exports" / "teacher_filtered-seed0-merged"
    src.mkdir(parents=True)
    (src / "forge_export.json").write_text(json.dumps({"files": {"model.safetensors": "ab"}, "post_merge_eval": {"agreement_with_adapter": 1.0}}))
    st = SimpleNamespace(root=root, plan={"arms": ["teacher_filtered"], "seeds": [0], "name": "Patient access · smoke"}, state={"sealed": True})
    lms = tmp_path / "lmstudio-models"
    lms.mkdir()
    events = []
    man = gguf.export(st, {"llama_cpp_dir": str(llama), "outtype": "q8_0", "install": True, "lmstudio_dir": str(lms)}, events.append)
    assert man["header"]["tensors"] == 5 and man["header"]["file_type"] == "Q8_0" and man["source_files"] == {"model.safetensors": "ab"}
    assert Path(man["installed"]["path"]).exists() and man["installed"]["path"].startswith(str(lms / "forge" / "patient-access-smoke"))
    assert any(e["event"] == "gguf_log" for e in events) and gguf.list_exports(st)[0]["sha256"] == man["sha256"]
    with pytest.raises(gguf.GGUFError, match="immutable"):
        gguf.export(st, {"llama_cpp_dir": str(llama), "outtype": "q8_0"})
    with pytest.raises(gguf.GGUFError, match="llama-quantize"):
        gguf.export(st, {"llama_cpp_dir": str(llama), "outtype": "q8_0", "quant": "Q4_K_M"})
    (llama / "convert_hf_to_gguf.py").write_text("import sys; print('boom'); sys.exit(3)")
    with pytest.raises(gguf.GGUFError, match="exit 3"):
        gguf.export(st, {"llama_cpp_dir": str(llama), "outtype": "bf16"})
    st2 = SimpleNamespace(root=tmp_path / "none", plan=st.plan, state=st.state)
    with pytest.raises(gguf.GGUFError, match="Export stage"):
        gguf.merged_export(st2)


def test_efficiency_from_collected_episodes(tmp_path):
    pytest.importorskip("torch")
    import os

    from forge.engine.efficiency import efficiency
    from forge.engine.runtime import OracleBackend
    from forge.engine.study import Study
    from forge.engine.tasks import SYSTEM_PROMPT, TaskSetSpec, generate_taskset
    from tests.test_playground_weightlab import TEACHER
    from tests.tiny_model import build_tiny_qwen3
    os.environ["FORGE_ALLOW_CPU"] = "1"
    tasks = generate_taskset(TaskSetSpec(groups_per_family=4))
    tiny = build_tiny_qwen3(tmp_path / "tiny", [SYSTEM_PROMPT] + [t.prompt for t in tasks])
    st = Study.init(tmp_path / "studies", name="e", profile="smoke", device="cpu", seeds=[0], teacher=TEACHER,
                    student={"name": "tiny", "path": str(tiny)}, arms=["teacher_filtered"])
    st.run_stage("collect", emit=lambda e: None, teacher_backend=OracleBackend({t.prompt: t for t in st.tasks()}))
    e = efficiency(st)
    dev = next(r for r in e["rows"] if r["arm"] == "teacher" and r["split"] == "dev")
    assert dev["episodes"] > 0 and dev["success"] == 1.0 and dev["calls_per_task"] >= 1
    assert not any(r["split"] in ("train", "test") for r in e["rows"])  # train is not an evaluation; test sealed away
    assert e["sizes"]["student_weights_bytes"] > 0 and "smaller" in e["honesty"]
