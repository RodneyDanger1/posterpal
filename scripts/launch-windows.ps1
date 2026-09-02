# PosterPal on Windows — no Docker.
# Starts the desk on 0.0.0.0:8080 and opens the Electron window (or the browser).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$env:VITE_AUTH_ENABLED = if ($env:VITE_AUTH_ENABLED) { $env:VITE_AUTH_ENABLED } else { "false" }
$env:PORT = if ($env:PORT) { $env:PORT } else { "8080" }

if (-not (Test-Path ".\node_modules")) {
  Write-Host "Installing npm packages…"
  npm ci
}

try {
  New-NetFirewallRule -DisplayName "PosterPal desk 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -ErrorAction SilentlyContinue | Out-Null
} catch { }
try {
  netsh advfirewall firewall add rule name="PosterPal desk 8080" dir=in action=allow protocol=TCP localport=8080 | Out-Null
} catch {
  Write-Host "Could not add firewall rule (run as Administrator if the phone cannot connect)."
try {
  $workerProc = Get-WmiObject Win32_Process -Filter "CommandLine LIKE '%worker.ts%'" -ErrorAction SilentlyContinue
  if (-not $workerProc) {
    Write-Host "Starting PosterPal 24/7 background worker…"
    Start-Process -FilePath "npm.cmd" -ArgumentList "run worker" -WindowStyle Hidden
  }
} catch { }

if (Test-Path ".\node_modules\electron") {
  npx electron .
} else {
  Write-Host "Electron not installed — opening the browser. Run: npm i -D electron"
  Start-Process "http://127.0.0.1:$($env:PORT)/"
  npm run dev
}
