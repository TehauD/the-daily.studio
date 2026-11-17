<#
.SYNOPSIS  Launch FORGE (single app: UI + API on one loopback port).
.PARAMETER Mode  prod = build the UI and serve everything from 127.0.0.1:<Port>.
                 dev  = API on <Port> + Vite hot reload on 5173 (proxying /api).
.NOTES     The server checks the port BEFORE initializing anything and names the owning PID on conflict.
#>
[CmdletBinding()]
param([ValidateSet('dev', 'prod')][string]$Mode = 'prod', [int]$Port = 8765, [switch]$NoBrowser, [switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_venv.ps1')
Assert-Venv
$env:FORGE_HOST = '127.0.0.1'   # loopback only; never 0.0.0.0
$env:FORGE_PORT = "$Port"
$env:PYTHONUTF8 = '1'           # UTF-8 everywhere (no garbled arrows)

if ($Mode -eq 'prod') {
    if (-not $SkipBuild) {
        Push-Location $Frontend
        try { Invoke-Checked 'npm' @('run', 'build') } finally { Pop-Location }
    }
    if (-not $NoBrowser) { Start-Job { Start-Sleep 3; Start-Process "http://127.0.0.1:$using:Port" } | Out-Null }
    Push-Location $Backend
    try { & $Py -m forge; exit $LASTEXITCODE } finally { Pop-Location }
}
else {
    $api = Start-Process -FilePath $Py -ArgumentList '-m', 'forge' -WorkingDirectory $Backend -PassThru -NoNewWindow
    Start-Sleep 2
    if ($api.HasExited) { throw "API exited with code $($api.ExitCode) (port $Port in use? see message above)" }
    Write-Host "API pid $($api.Id) on http://127.0.0.1:$Port" -ForegroundColor Cyan
    try {
        if (-not $NoBrowser) { Start-Job { Start-Sleep 3; Start-Process 'http://127.0.0.1:5173' } | Out-Null }
        Push-Location $Frontend
        npm run dev
    }
    finally {
        Pop-Location
        if (-not $api.HasExited) { Stop-Process -Id $api.Id -Force; Write-Host 'API stopped.' }
    }
}
