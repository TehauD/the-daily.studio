<#
.SYNOPSIS  FORGE validation kit: does distillation work for our skills on our hardware? One command, with evidence:
           negative control, prompting baseline, preregistered power analysis, sealed final test, forgetting check,
           optional quantization, and a verified reproducibility bundle + VALIDATION.md. Start FORGE (.\scripts\launch.ps1)
           and LM Studio's server with the teacher loaded first.
.EXAMPLE   .\scripts\validate.ps1 -Teacher "olmo-3-32b" -Student "Olmo-3-7B-Instruct" -YesSeal -Quant
.EXAMPLE   .\scripts\validate.ps1 -Resume study_1234abcd -YesSeal          # continue after fixing a failed stage
#>
[CmdletBinding()]
param(
    [string]$Teacher, [string]$Student,
    [string]$Template = 'itsm_servicenow', [string]$Pack,
    [ValidateSet('pilot', 'research')][string]$Profile = 'research',
    [int]$Seeds = 0, [int]$FewShot = 3, [int]$PerSkill = 80, [string]$CalibrateFrom, [string]$GeneralText,
    [switch]$Quant, [switch]$YesSeal, [string]$Resume,
    [string]$Url = 'http://127.0.0.1:8765', [string]$OutDir = 'validation'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_venv.ps1')
Assert-Venv
$env:PYTHONUTF8 = '1'
$a = @((Join-Path $PSScriptRoot 'validate.py'), '--url', $Url, '--out-dir', $OutDir)
if ($Resume) { $a += @('--resume', $Resume) }
else {
    if (-not $Teacher -or -not $Student) { throw 'Pass -Teacher and -Student (see .\scripts\skill-check.ps1 -ListModels), or -Resume STUDY_ID.' }
    $a += @('--teacher', $Teacher, '--student', $Student, '--template', $Template, '--profile', $Profile, '--fewshot', "$FewShot", '--per-skill', "$PerSkill")
    if ($Pack) { $a += @('--pack', $Pack) }
    if ($Seeds -gt 0) { $a += @('--seeds', "$Seeds") }
    if ($CalibrateFrom) { $a += @('--calibrate-from', $CalibrateFrom) }
}
if ($GeneralText) { $a += @('--general-text', $GeneralText) }
if ($Quant) { $a += '--quant' }
if ($YesSeal) { $a += '--yes-seal' }
Invoke-Checked $Py $a
