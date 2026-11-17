# Shared helper: resolve the PROJECT interpreter explicitly. Never the global C:\Python312 (CPU-only torch).
$script:Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$script:Backend = Join-Path $Root 'backend'
$script:Frontend = Join-Path $Root 'frontend'
$script:Py = Join-Path $Backend '.venv\Scripts\python.exe'

function Assert-Venv {
    if (-not (Test-Path $script:Py)) { throw "Project venv missing at $script:Py. Run .\scripts\setup.ps1 first." }
    $exe = & $script:Py -c "import sys; print(sys.executable)"
    Write-Host "Interpreter: $exe" -ForegroundColor DarkGray
    if ($exe -notlike '*\.venv\*') { throw "Resolved interpreter is not the project venv: $exe" }
}

function Invoke-Checked([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Exe $($Arguments -join ' ')" }
}
