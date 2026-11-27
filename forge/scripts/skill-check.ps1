<#
.SYNOPSIS  Does a real small model actually pick up an agent's skills? Runs the whole FORGE route through its API:
           template agent -> verified practice tasks -> study (your teacher + your student) -> collect -> build -> train ->
           evaluate -> analyze -> [seal -> final test] and prints trained vs untrained, skill by skill, with 95 % ranges.
           Start FORGE first (.\scripts\launch.ps1) and LM Studio's server with your teacher model.
.EXAMPLE   .\scripts\skill-check.ps1 -ListModels
.EXAMPLE   .\scripts\skill-check.ps1 -Teacher "olmo-3-32b" -Student "Olmo-3-7B-Instruct" -Profile pilot -Seal
.EXAMPLE   .\scripts\skill-check.ps1 -Resume study_1234abcd -Seal      # continue after fixing a failed stage
#>
[CmdletBinding()]
param(
    [string]$Teacher, [string]$Student,
    [string]$Template = 'itsm_servicenow',
    [ValidateSet('smoke', 'pilot', 'research')][string]$Profile = 'pilot',
    [ValidateSet('template', 'teacher')][string]$TasksFrom = 'template',
    [ValidateSet('auto', 'on', 'off')][string]$Base4bit = 'auto',
    [int]$PerSkill = 60, [int]$MaxSeqLen = 3072,
    [switch]$Seal, [switch]$ListModels, [string]$Resume,
    [string]$Url = 'http://127.0.0.1:8765', [string]$Out = 'skill-check-result.json'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_venv.ps1')
Assert-Venv
$env:PYTHONUTF8 = '1'
$a = @((Join-Path $PSScriptRoot 'skill_check.py'), '--url', $Url, '--out', $Out)
if ($ListModels) { $a += '--list-models' }
elseif ($Resume) { $a += @('--resume', $Resume) }
else {
    if (-not $Teacher -or -not $Student) { throw 'Pass -Teacher and -Student (see -ListModels), or -Resume STUDY_ID.' }
    $a += @('--teacher', $Teacher, '--student', $Student, '--template', $Template, '--profile', $Profile,
            '--tasks-from', $TasksFrom, '--per-skill', "$PerSkill", '--max-seq-len', "$MaxSeqLen", '--base-4bit', $Base4bit)
}
if ($Seal) { $a += '--seal' }
Invoke-Checked $Py $a
