# WSL2 Guidance

## Native Windows is the default
- Phase 1–2 run natively (no CUDA-dependent Python packages).
- Phase 3 LoRA with PyTorch CUDA wheels works natively on Windows.
- bitsandbytes ships Windows wheels; QLoRA generally works natively on recent releases.

## Use WSL2 (Ubuntu 24.04) when
- QLoRA/bitsandbytes fails to load CUDA kernels natively.
- You need `flash-attn`, `deepspeed`, or Triton-based kernels (Linux-first).
- Building llama.cpp for GGUF conversion with CUDA.

## Setup
```powershell
wsl --install -d Ubuntu-24.04
wsl --update
```
- Install the **Windows** NVIDIA driver only. Do not install a Linux display driver inside WSL.
- Inside WSL, `nvidia-smi` should list the GPU. FORGE detects WSL (`wsl: true` in the hardware report).
- Keep models on the Linux filesystem (`~/models`). Cross-filesystem I/O via `/mnt/c` is far slower for multi-GB weights.
- Run FORGE inside WSL with `FORGE_HOST=127.0.0.1`; WSL2 forwards localhost to Windows, so the browser on Windows works unchanged.
- Ollama on Windows is reachable from WSL via mirrored networking (`networkingMode=mirrored` in `.wslconfig`) or by setting `OLLAMA_HOST` to the Windows host IP.

## Memory
- WSL2 caps RAM by default. Raise it in `%UserProfile%\.wslconfig`:
```
[wsl2]
memory=24GB
swap=16GB
```
