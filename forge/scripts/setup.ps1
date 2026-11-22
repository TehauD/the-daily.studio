<#
.SYNOPSIS  Idempotent FORGE setup on Windows: project venv, pinned stack, frontend, tests, readiness.
.PARAMETER WithML        Install torch (CUDA) + the training stack into the venv.
.PARAMETER CudaIndex     PyTorch wheel index (verified host: cu126).
.PARAMETER TorchVersion  Pinned torch (verified host: 2.14.1).
.PARAMETER SkipFrontend  Skip npm install.
.PARAMETER SkipTests     Skip the test run.
.PARAMETER Recreate      Delete and rebuild backend\.venv from scratch (packages are re-downloaded).
#>
[CmdletBinding()]
param([switch]$WithML, [string]$CudaIndex = 'cu126', [string]$TorchVersion = '2.14.1', [switch]$SkipFrontend, [switch]$SkipTests, [switch]$Recreate)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_venv.ps1')
$Venv = Join-Path $Backend '.venv'
$LogDir = Join-Path $Root 'logs'; New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Start-Transcript -Path (Join-Path $LogDir "setup-$(Get-Date -Format yyyyMMdd-HHmmss).log") | Out-Null
function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }

try {
    Step 'Python 3.12 (py launcher)'
    $ver = & py -3.12 -c "import sys;print(sys.version.split()[0])" 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 not found. Install: winget install Python.Python.3.12' }
    Write-Host "Found Python $ver"

    Step 'Project virtual environment'
    function New-Venv {
        if (Test-Path $Venv) {
            Write-Host "Removing $Venv (generated; packages will be re-downloaded)" -ForegroundColor Yellow
            try { Remove-Item -Recurse -Force $Venv -ErrorAction Stop }
            catch { throw "Could not delete $Venv ($($_.Exception.Message)). Close FORGE (launch.ps1 window) and any Python using it, then re-run." }
        }
        Invoke-Checked 'py' @('-3.12', '-m', 'venv', $Venv)
    }
    function Test-Pip { & $Py -m pip --version *> $null; return ($LASTEXITCODE -eq 0) }
    if ($Recreate -or -not (Test-Path $Py)) { New-Venv } else { Write-Host 'Reusing existing .venv' }
    # A venv whose interpreter or pip is damaged (interrupted upgrade, antivirus quarantine, a new copy unpacked
    # over an old .venv) is repaired: first ensurepip, then a clean rebuild. The venv holds no user data.
    $healthy = $true
    try { Assert-Venv } catch { $healthy = $false; Write-Warning "Interpreter check failed: $_" }
    if ($healthy -and -not (Test-Pip)) {
        Write-Warning 'pip in the project venv is broken (e.g. "No module named pip._vendor"). Repairing with ensurepip...'
        & $Py -m ensurepip --upgrade --default-pip *> $null
        $healthy = Test-Pip
    }
    if (-not $healthy) {
        Write-Warning 'Repair did not work; rebuilding the project venv from scratch.'
        New-Venv
        Assert-Venv
        if (-not (Test-Pip)) { throw 'pip is still unavailable in a fresh venv. Check that antivirus is not quarantining files under backend\.venv, then re-run.' }
    }
    Invoke-Checked $Py @('-m', 'pip', 'install', '--upgrade', 'pip', '--disable-pip-version-check', '-q')

    Step 'Core + dev dependencies (full pinned set, never --no-deps)'
    Invoke-Checked $Py @('-m', 'pip', 'install', '-q', '-r', (Join-Path $Backend 'requirements\dev.txt'))

    if ($WithML) {
        Step "PyTorch $TorchVersion ($CudaIndex)"
        Invoke-Checked $Py @('-m', 'pip', 'install', '-q', "torch==$TorchVersion", '--index-url', "https://download.pytorch.org/whl/$CudaIndex")
        Step 'Training stack'
        Invoke-Checked $Py @('-m', 'pip', 'install', '-q', '-r', (Join-Path $Backend 'requirements\ml.txt'))
        Invoke-Checked $Py @('-m', 'pip', 'check')
    }

    Step 'Readiness imports (NumPy is required; torch reported if present)'
    & $Py -c "import sys, numpy; print('python', sys.executable); print('numpy', numpy.__version__)
try:
    import torch; print('torch', torch.__version__, 'cuda', torch.version.cuda, 'available', torch.cuda.is_available(), 'bf16', torch.cuda.is_available() and torch.cuda.is_bf16_supported())
except ImportError:
    print('torch not installed (run setup.ps1 -WithML)')"
    if ($LASTEXITCODE -ne 0) { throw 'Readiness import failed' }

    if (-not $SkipFrontend) {
        Step 'Frontend dependencies'
        if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm not found. Install Node.js LTS: winget install OpenJS.NodeJS.LTS' }
        Push-Location $Frontend
        try { if (Test-Path 'package-lock.json') { Invoke-Checked 'npm' @('ci') } else { Invoke-Checked 'npm' @('install') } } finally { Pop-Location }
    }

    if (-not $SkipTests) {
        Step 'Backend tests'
        Push-Location $Backend
        try { Invoke-Checked $Py @('-m', 'pytest', '-q') } finally { Pop-Location }
    }

    Step 'Hardware report (as FORGE sees it)'
    Push-Location $Backend
    try { & $Py -m forge.hardware.probe } finally { Pop-Location }
    Write-Host "`nSetup complete. Next: .\scripts\verify-gpu.ps1, then .\scripts\launch.ps1" -ForegroundColor Green
}
finally { Stop-Transcript | Out-Null }
