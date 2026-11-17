[CmdletBinding()] param([string]$Filter = '', [switch]$WithFrontend)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_venv.ps1')
Assert-Venv
Push-Location $Backend
try {
    if ($Filter) { & $Py -m pytest -q -k $Filter } else { & $Py -m pytest -q }
    $code = $LASTEXITCODE
} finally { Pop-Location }
if ($WithFrontend -and $code -eq 0) {
    Push-Location $script:Frontend
    try { npm run build; $code = $LASTEXITCODE } finally { Pop-Location }
}
exit $code
