[CmdletBinding()] param([string]$Filter = '')
$ErrorActionPreference = 'Stop'
$Backend = Resolve-Path (Join-Path $PSScriptRoot '..\backend')
$Py = Join-Path $Backend '.venv\Scripts\python.exe'
Push-Location $Backend
try { if ($Filter) { & $Py -m pytest -k $Filter } else { & $Py -m pytest }; exit $LASTEXITCODE } finally { Pop-Location }
