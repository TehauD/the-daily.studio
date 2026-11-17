<#
.SYNOPSIS  Launch FORGE on localhost.
.PARAMETER Mode  dev  = API (8765) + Vite dev server (5173) with hot reload.
                 prod = build the UI once and serve UI + API from a single process on 8765.
#>
[CmdletBinding()]
param([ValidateSet('dev', 'prod')][string]$Mode = 'prod', [int]$Port = 8765, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Backend = Join-Path $Root 'backend'; $Frontend = Join-Path $Root 'frontend'
$Py = Join-Path $Backend '.venv\Scripts\python.exe'
if (-not (Test-Path $Py)) { throw 'Environment missing. Run .\scripts\setup.ps1 first.' }

$env:FORGE_HOST = '127.0.0.1'   # loopback only; never 0.0.0.0
$env:FORGE_PORT = "$Port"

if ($Mode -eq 'prod') {
    Push-Location $Frontend
    try { npm run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' } } finally { Pop-Location }
    if (-not $NoBrowser) { Start-Job { Start-Sleep 2; Start-Process "http://127.0.0.1:$using:Port" } | Out-Null }
    Push-Location $Backend
    try { & $Py -m forge } finally { Pop-Location }
}
else {
    $api = Start-Process -FilePath $Py -ArgumentList '-m', 'forge' -WorkingDirectory $Backend -PassThru -WindowStyle Minimized
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
