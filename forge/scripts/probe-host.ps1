<#
.SYNOPSIS  Step 0 — inspect this Windows host before installing anything.
.DESCRIPTION
  Native PowerShell inventory (no Python required): GPU/VRAM/driver/CUDA, CPU, RAM, disks,
  Python 3.12, WSL2, Ollama, LM Studio, Hugging Face cache. Writes forge-host-report.json.
.EXAMPLE   .\scripts\probe-host.ps1
#>
[CmdletBinding()]
param([string]$OutFile = (Join-Path $PSScriptRoot '..\forge-host-report.json'))
$ErrorActionPreference = 'Stop'

function Try-Run([scriptblock]$Block) { try { & $Block } catch { $null } }

$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$cs  = Get-CimInstance Win32_ComputerSystem
$os  = Get-CimInstance Win32_OperatingSystem

$gpus = @()
$smiCmd = Get-Command nvidia-smi -ErrorAction SilentlyContinue
$smi = if ($smiCmd) { $smiCmd.Source } else { $null }
if (-not $smi -and (Test-Path "$env:WINDIR\System32\nvidia-smi.exe")) { $smi = "$env:WINDIR\System32\nvidia-smi.exe" }
$cudaDriver = $null
if ($smi) {
    $q = & $smi --query-gpu=index,name,memory.total,memory.free,driver_version,compute_cap --format=csv,noheader,nounits
    foreach ($line in $q) {
        $c = $line.Split(',') | ForEach-Object { $_.Trim() }
        $gpus += [ordered]@{ index=[int]$c[0]; name=$c[1]; vram_total_mb=[int]$c[2]; vram_free_mb=[int]$c[3]; driver=$c[4]; compute_cap=$c[5] }
    }
    $banner = (& $smi) -join "`n"
    if ($banner -match 'CUDA Version:\s*([\d.]+)') { $cudaDriver = $Matches[1] }
}

$py312 = Try-Run { (& py -3.12 -c "import sys;print(sys.version.split()[0])" 2>$null) }
$wsl   = Try-Run { (wsl.exe --status 2>$null) -join ' ' }
$ollama = Try-Run { (& ollama --version 2>$null) -join ' ' }
$ollamaApi = Try-Run { (Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2).models.Count }
$lmsDirs = @("$HOME\.lmstudio\models", "$HOME\.cache\lm-studio\models") | Where-Object { Test-Path $_ }
$hfCache = if ($env:HF_HUB_CACHE) { $env:HF_HUB_CACHE } elseif ($env:HF_HOME) { Join-Path $env:HF_HOME 'hub' } else { "$HOME\.cache\huggingface\hub" }
$hfRepos = if (Test-Path $hfCache) { (Get-ChildItem $hfCache -Directory -Filter 'models--*').Count } else { 0 }
$node = Try-Run { (& node --version 2>$null) }

$disks = Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
    [ordered]@{ drive=$_.DeviceID; total_gb=[math]::Round($_.Size/1GB,1); free_gb=[math]::Round($_.FreeSpace/1GB,1) } }

$maxVram = ($gpus | Measure-Object -Property vram_total_mb -Maximum).Maximum
$guidance = switch ($true) {
    { -not $gpus }          { 'No NVIDIA GPU: inference-only via Ollama/LM Studio; training disabled.'; break }
    { $maxVram -ge 23000 }  { 'Teacher 7-14B (Ollama) / student 1.5-3B LoRA or <=7B QLoRA.'; break }
    { $maxVram -ge 15000 }  { 'Teacher 7-8B (Ollama) / student 1.5B LoRA or 3-7B QLoRA.'; break }
    { $maxVram -ge 11000 }  { 'Teacher 7B (Ollama, CPU-offload ok) / student 0.5-1.5B LoRA or <=3B QLoRA.'; break }
    default                 { 'Small VRAM: student 0.5B LoRA; teacher via Ollama.' }
}

$report = [ordered]@{
    generated_at = (Get-Date).ToString('o'); host = $env:COMPUTERNAME
    os = "$($os.Caption) $($os.Version)"; cpu = $cpu.Name.Trim(); cores = $cpu.NumberOfCores; threads = $cpu.NumberOfLogicalProcessors
    ram_gb = [math]::Round($cs.TotalPhysicalMemory/1GB,1); gpus = $gpus; nvidia_smi = $smi; cuda_driver_max = $cudaDriver
    disks = $disks; python312 = $py312; node = $node; wsl_status = $wsl
    ollama = [ordered]@{ cli = $ollama; api_models = $ollamaApi }; lmstudio_dirs = $lmsDirs
    hf_cache = [ordered]@{ path = $hfCache; repos = $hfRepos }
    milestone_sizing = $guidance
}
$report | ConvertTo-Json -Depth 6 | Set-Content -Path $OutFile -Encoding utf8
$report | ConvertTo-Json -Depth 6
Write-Host "`nReport written to $((Resolve-Path $OutFile).Path)" -ForegroundColor Green
if (-not $py312) { Write-Warning 'Python 3.12 not found via the py launcher. Install: winget install Python.Python.3.12' }
if (-not $node)  { Write-Warning 'Node.js not found. Install LTS: winget install OpenJS.NodeJS.LTS' }
