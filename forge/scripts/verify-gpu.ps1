<#
.SYNOPSIS  Verify the GPU training path with the project venv.
           1) forward/backward in BF16 on CUDA (always)
           2) with -Student: a real smoke study on the GPU — pre-flight gates, zero-adapter check,
              a 2-step LoRA run, adapter inspection, base-hash check, and one dev evaluation.
.EXAMPLE   .\scripts\verify-gpu.ps1
.EXAMPLE   .\scripts\verify-gpu.ps1 -Student "$env:USERPROFILE\.cache\huggingface\hub\models--Qwen--Qwen3-1.7B\snapshots\70d244cc86ccca08cf5af4e1e306ecf908b1ad5e"
.NOTES     Unload the teacher in LM Studio first; the pre-flight refuses to train while a model is loaded.
#>
[CmdletBinding()]
param([string]$Student, [int]$MinFreeVramMb = 8000)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_venv.ps1')
Assert-Venv
$env:PYTHONUTF8 = '1'
Push-Location $Backend
try {
    Write-Host "`n==> forward/backward (BF16)" -ForegroundColor Cyan
    Invoke-Checked $Py @('-m', 'forge.engine', 'verify-gpu')
    if ($Student) {
        if (-not (Test-Path (Join-Path $Student 'config.json'))) { throw "No config.json in $Student" }
        Write-Host "`n==> GPU smoke study (2 LoRA steps + dev evaluation)" -ForegroundColor Cyan
        Invoke-Checked $Py @('-m', 'forge.engine', 'gpu-smoke', '--student', $Student, '--min-free-vram-mb', "$MinFreeVramMb")
    }
    Write-Host "`nGPU verification passed." -ForegroundColor Green
}
finally { Pop-Location }
