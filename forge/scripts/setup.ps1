<#
.SYNOPSIS  Idempotent environment setup for FORGE on Windows.
.PARAMETER WithML        Also install torch (CUDA) + transformers/PEFT/TRL stack (Phase 2-3).
.PARAMETER CudaIndex     PyTorch wheel index tag (cu128 supports RTX 20-50 series on current drivers).
.PARAMETER TorchVersion  Pinned torch version for -WithML.
.PARAMETER SkipFrontend  Skip npm install.
.PARAMETER SkipTests     Skip the post-install test run.
#>
[CmdletBinding()]
param(
    [switch]$WithML,
    [string]$CudaIndex = 'cu128',
    [string]$TorchVersion = '2.7.1',
    [switch]$SkipFrontend,
    [switch]$SkipTests
)
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$Venv = Join-Path $Backend '.venv'
$Py = Join-Path $Venv 'Scripts\python.exe'
$LogDir = Join-Path $Root 'logs'; New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Start-Transcript -Path (Join-Path $LogDir "setup-$(Get-Date -Format yyyyMMdd-HHmmss).log") | Out-Null

function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Invoke-Checked([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Exe $($Arguments -join ' ')" }
}

try {
    Step 'Python 3.12'
    $ver = & py -3.12 -c "import sys;print(sys.version.split()[0])" 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 not found. Install with: winget install Python.Python.3.12' }
    Write-Host "Found Python $ver"

    Step 'Virtual environment'
    if (-not (Test-Path $Py)) { Invoke-Checked 'py' @('-3.12', '-m', 'venv', $Venv) } else { Write-Host 'Reusing existing .venv' }
    Invoke-Checked $Py @('-m', 'pip', 'install', '--upgrade', 'pip', '--disable-pip-version-check', '-q')

    Step 'Core dependencies (pinned)'
    Invoke-Checked $Py @('-m', 'pip', 'install', '-q', '-r', (Join-Path $Backend 'requirements\dev.txt'))

    if ($WithML) {
        Step "PyTorch $TorchVersion ($CudaIndex)"
        Invoke-Checked $Py @('-m', 'pip', 'install', '-q', "torch==$TorchVersion", '--index-url', "https://download.pytorch.org/whl/$CudaIndex")
        Step 'ML stack (transformers / PEFT / TRL / datasets / smolagents / MLflow)'
        Invoke-Checked $Py @('-m', 'pip', 'install', '-q', '-r', (Join-Path $Backend 'requirements\ml.txt'))
        Invoke-Checked $Py @('-m', 'pip', 'check')
        & $Py -c "import torch;print('torch', torch.__version__, 'CUDA', torch.cuda.is_available(), torch.version.cuda)"
    }

    if (-not $SkipFrontend) {
        Step 'Frontend dependencies'
        if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm not found. Install Node.js LTS: winget install OpenJS.NodeJS.LTS' }
        Push-Location $Frontend
        try { if (Test-Path 'package-lock.json') { Invoke-Checked 'npm' @('ci') } else { Invoke-Checked 'npm' @('install') } }
        finally { Pop-Location }
    }

    if (-not $SkipTests) {
        Step 'Test suite'
        Push-Location $Backend
        try { Invoke-Checked $Py @('-m', 'pytest') } finally { Pop-Location }
    }

    Step 'Hardware report (as FORGE sees it)'
    Push-Location $Backend
    try { & $Py -m forge.hardware.probe } finally { Pop-Location }

    Write-Host "`nSetup complete. Launch with: .\scripts\launch.ps1" -ForegroundColor Green
}
finally { Stop-Transcript | Out-Null }
