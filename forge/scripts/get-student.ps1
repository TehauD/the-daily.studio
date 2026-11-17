<#
.SYNOPSIS  Download a student from the Hugging Face Hub with allow-patterns and verify every shard.
           Uses huggingface_hub.snapshot_download — NOT `hf download --include` (it ignores filters
           when filenames are given). Pickle weights are never fetched.
.EXAMPLE   .\scripts\get-student.ps1 -Repo Qwen/Qwen3-1.7B
#>
[CmdletBinding()]
param([Parameter(Mandatory)][string]$Repo, [string]$Revision)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_venv.ps1')
Assert-Venv
$env:PYTHONUTF8 = '1'
$env:HF_HUB_OFFLINE = '0'
$args2 = @('-m', 'forge.engine', 'hub-download', '--repo', $Repo)
if ($Revision) { $args2 += @('--revision', $Revision) }
Push-Location $Backend
try { Invoke-Checked $Py $args2; Write-Host "`nVerified. Run discovery in the Model Observatory." -ForegroundColor Green }
finally { Pop-Location }
