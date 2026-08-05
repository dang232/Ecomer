#Requires -Version 5.1
<#
.SYNOPSIS
    Run visual snapshot tests on Linux via the local-origin-proxy wrapper.

.DESCRIPTION
    On macOS/Windows, Playwright boots a Linux container to generate snapshots.
    This script:
      1. Starts the local-origin-proxy inside the container
      2. Runs `playwright test` with baseURL pointing at the proxy
      3. Stops the proxy

    On Windows/macOS host it starts the proxy locally and calls playwright directly.
    On Linux it is a no-op (proxy must be started externally or via docker).

.PARAMETER UpdateSnapshots
    Pass this flag to update snapshots instead of comparing.

.EXAMPLE
    .\scripts\run-visual-linux.ps1
    .\scripts\run-visual-linux.ps1 -UpdateSnapshots
#>
param(
    [switch]$UpdateSnapshots
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ProxyScript = Join-Path $ProjectRoot "scripts\local-origin-proxy.mjs"
$ProxyLog = Join-Path $env:TEMP "local-origin-proxy-$PID.log"
$ProxyPort = 3333

function Get-ProxyStatus {
    $null -ne (Get-NetTCPConnection -LocalPort $ProxyPort -ErrorAction SilentlyContinue)
}

# ── Detect environment ──────────────────────────────────────────────────────────
$IsLinux = $IsLinux -or ($PSVersionTable.OS -match "Linux")
$IsMacOS = $IsMacOS -or ($PSVersionTable.OS -match "Darwin")

if ($IsLinux) {
    Write-Host "[run-visual-linux] Running on Linux — ensure local-origin-proxy is started manually or via docker."
    Write-Host "  Example: docker run --rm -p 3333:3333 -e PROXY_PORT=3333 -e HOST_FRONTEND=http://host.docker.internal:3000 -e HOST_GATEWAY=http://host.docker.internal:8080 vnshop-web"
    exit 0
}

# ── Start proxy ─────────────────────────────────────────────────────────────────
$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
    Write-Error "node not found in PATH"
    exit 1
}

Write-Host "[run-visual-linux] Starting local-origin-proxy on port $ProxyPort..."
$ProxyProc = Start-Process $NodePath -ArgumentList $ProxyScript `
    -RedirectStandardOutput $ProxyLog `
    -RedirectStandardError $ProxyLog `
    -WindowStyle Hidden `
    -PassThru

# Wait for proxy to bind
$retry = 0
while (-not (Get-ProxyStatus) -and $retry -lt 20) {
    Start-Sleep -Milliseconds 250
    $retry++
}

if (-not (Get-ProxyStatus)) {
    Write-Error "local-origin-proxy failed to start. See: $ProxyLog"
    Get-Content $ProxyLog -ErrorAction SilentlyContinue | Select-Object -First 20
    exit 1
}

Write-Host "[run-visual-linux] Proxy ready."

try {
    # ── Run Playwright ──────────────────────────────────────────────────────────
    Push-Location $ProjectRoot

    $Env:VITE_E2E_BASE_URL = "http://localhost:$ProxyPort"
    $Env:E2E_SKIP_WEBSERVER = "1"
    $Env:PLAYWRIGHT_SNAPSHOT_BASE_URL = "http://localhost:$ProxyPort"

    if ($UpdateSnapshots) {
        Write-Host "[run-visual-linux] Updating snapshots..."
        npx playwright test e2e/modernization/visual-matrix.spec.ts `
            --config=playwright.config.ts `
            --update-snapshots
    } else {
        Write-Host "[run-visual-linux] Comparing snapshots..."
        npx playwright test e2e/modernization/visual-matrix.spec.ts `
            --config=playwright.config.ts
    }
} finally {
    # ── Stop proxy ──────────────────────────────────────────────────────────────
    Pop-Location
    Write-Host "[run-visual-linux] Stopping proxy..."
    Stop-Process -Id $ProxyProc.Id -Force -ErrorAction SilentlyContinue
    Remove-Item $ProxyLog -ErrorAction SilentlyContinue
}

Write-Host "[run-visual-linux] Done."
