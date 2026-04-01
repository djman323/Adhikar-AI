param(
    [int]$BackendPort = 5000,
    [int]$UiPort = 5500
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$uiRoot = Join-Path $root "ui"

$venvPython = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    py -m venv .venv
}

& $venvPython -m pip install --upgrade pip | Out-Null
& $venvPython -m pip install -r requirements.txt

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is required to run the Next.js UI. Install Node.js from https://nodejs.org/"
}

Push-Location $uiRoot
npm install
Pop-Location

Write-Host "Starting Adhikar AI backend on http://127.0.0.1:$BackendPort"
$backendJob = Start-Job -Name "adhikar-backend" -ScriptBlock {
    param($projectRoot, $pythonExe, $port)
    Set-Location $projectRoot
    $env:PORT = "$port"
    & $pythonExe AdhikarAI.py
} -ArgumentList $root, $venvPython, $BackendPort

Write-Host "Starting UI on http://127.0.0.1:$UiPort"
$uiJob = Start-Job -Name "adhikar-ui" -ScriptBlock {
    param($uiDirectory, $port)
    Set-Location $uiDirectory
    npm run dev -- --hostname 127.0.0.1 --port $port
} -ArgumentList $uiRoot, $UiPort

Write-Host ""
Write-Host "Adhikar AI is running."
Write-Host "Backend: http://127.0.0.1:$BackendPort"
Write-Host "UI:      http://127.0.0.1:$UiPort"
Write-Host "Press Ctrl+C to stop both services."
Write-Host ""

try {
    while ($true) {
        # Consume only new job output; suppress stderr records that Python servers use for request logs.
        Receive-Job -Job $backendJob -ErrorAction SilentlyContinue | Out-Host
        Receive-Job -Job $uiJob -ErrorAction SilentlyContinue | Out-Host
        Start-Sleep -Milliseconds 700

        if ($backendJob.State -eq "Failed" -or $backendJob.State -eq "Stopped") {
            throw "Backend job stopped unexpectedly."
        }
        if ($uiJob.State -eq "Failed" -or $uiJob.State -eq "Stopped") {
            throw "UI job stopped unexpectedly."
        }
    }
}
finally {
    Write-Host "Stopping background jobs..."
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job -Job $uiJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    Remove-Job -Job $uiJob -Force -ErrorAction SilentlyContinue
}
