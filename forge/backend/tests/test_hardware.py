from forge.hardware.probe import collect_hardware, parse_cuda_version, parse_nvidia_smi_csv
from forge.hardware.profiles import EstimateInput, adaptive_profiles, estimate_lora_memory

SMI = "0, NVIDIA GeForce RTX 4070, GPU-abc, 12282, 1024, 11000, 7, 41, 18.50, 200.00, 576.02, 8.9\n"


def test_parse_nvidia_smi():
    g = parse_nvidia_smi_csv(SMI)[0]
    assert g.name == "NVIDIA GeForce RTX 4070" and g.vram_total_mb == 12282 and g.compute_capability == "8.9"
    assert parse_nvidia_smi_csv("0, X, u, [N/A], [N/A], [N/A], [N/A], [N/A], [N/A], [N/A], 1, 7.5\n")[0].vram_total_mb is None


def test_parse_cuda_version():
    assert parse_cuda_version("| NVIDIA-SMI 576.02   Driver Version: 576.02   CUDA Version: 12.9 |") == "12.9"
    assert parse_cuda_version("nothing") is None


def test_collect_hardware_reports_real_values(tmp_path):
    r = collect_hardware([tmp_path], include_torch=False).to_dict()
    assert r["ram_total_mb"] > 0 and r["cpu_logical_cores"] >= 1 and r["disks"]
    assert isinstance(r["gpus"], list)  # empty when no NVIDIA GPU — never simulated


def test_estimator_monotonic_and_quant_ordering():
    def tot(**kw):
        return estimate_lora_memory(EstimateInput(**{"params_b": 7.0, **kw}), 24000).total_mb
    assert tot(quant="nf4") < tot(quant="int8") < tot(quant="bf16")
    assert tot(seq_len=1024) < tot(seq_len=4096)
    assert tot(grad_checkpointing=True) < tot(grad_checkpointing=False)


def test_estimator_verdicts():
    assert estimate_lora_memory(EstimateInput(params_b=0.5), 12000).verdict == "safe"
    assert estimate_lora_memory(EstimateInput(params_b=32, quant="bf16"), 12000).verdict == "unsafe"
    assert estimate_lora_memory(EstimateInput(params_b=0.5), None).verdict == "no_gpu"


def test_adaptive_profiles():
    assert adaptive_profiles(None, None)["gpu"] is False
    p12, p24 = adaptive_profiles(11000, 12282), adaptive_profiles(23000, 24564)
    assert p12["largest_safe"]["qlora"] <= p24["largest_safe"]["qlora"]
    assert p12["largest_safe"]["lora"] <= p12["largest_safe"]["qlora"]
