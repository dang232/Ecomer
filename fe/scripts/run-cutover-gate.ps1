#Requires -Version 5.1

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $ImageReference,

  [Parameter(Mandatory = $true)]
  [string] $ExpectedSourceCommit,

  [Alias("StagingUrl")]
  [string] $ExternalBaseUrl,

  [string] $Registry = "ghcr.io",

  [string] $Environment = "buyer,seller,admin"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $ProjectRoot
$ContainerName = "vnshop-fe-cutover"
$ContainerPort = 3001
$ReportPath = Join-Path $ProjectRoot "test-results/cutover-results.json"
$BundlePath = Join-Path $ProjectRoot "performance/current/route-bundles.json"
$LighthousePath = Join-Path $ProjectRoot "performance/current/lighthouse-mobile.json"
$DistPath = Join-Path $ProjectRoot "dist"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string] $Command,
    [string[]] $Arguments = @()
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command exited with code $LASTEXITCODE"
  }
}

function Invoke-Captured {
  param(
    [Parameter(Mandatory = $true)][string] $Command,
    [string[]] $Arguments = @()
  )

  $output = & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command exited with code $LASTEXITCODE"
  }
  return ($output | Out-String).Trim()
}

function Wait-HttpOk([string] $Uri, [int] $TimeoutSeconds = 60) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 5
      if ($response.StatusCode -eq 200) { return }
    } catch {
      if ((Get-Date) -ge $deadline) { throw }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "Timed out waiting for $Uri"
}

function Set-ProcessEnvironment([string] $Name, [string] $Value) {
  Set-Item -Path "Env:$Name" -Value $Value
}

function Remove-ProcessEnvironment([string] $Name) {
  Remove-Item -Path "Env:$Name" -ErrorAction SilentlyContinue
}

$environmentNames = @(
  "VITE_E2E_BASE_URL",
  "VITE_E2E_API_URL",
  "E2E_SKIP_WEBSERVER",
  "E2E_RELEASE_CONTRACT",
  "E2E_REQUIRED_PERSONAS",
  "PLAYWRIGHT_JSON_OUTPUT_FILE",
  "E2E_BUYER_USERNAME",
  "E2E_BUYER_PASSWORD"
)
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
  $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

$isExternal = -not [string]::IsNullOrWhiteSpace($ExternalBaseUrl)
$baseUrl = $null
$apiUrl = $null
$containerStarted = $false
$distContainer = $null

try {
  Push-Location $ProjectRoot

  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "docker is required for the exact-image cutover gate"
  }
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm is required for the exact-image cutover gate"
  }

  $revision = Invoke-Captured "docker" @(
    "image", "inspect", $ImageReference,
    "--format", '{{ index .Config.Labels "org.opencontainers.image.revision" }}'
  )
  if ($revision -ne $ExpectedSourceCommit) {
    throw "Image revision '$revision' does not match expected source commit '$ExpectedSourceCommit'"
  }

  if ($isExternal) {
    $externalUri = $null
    if (-not [Uri]::TryCreate($ExternalBaseUrl, [UriKind]::Absolute, [ref] $externalUri)) {
      throw "ExternalBaseUrl must be an absolute HTTPS URL"
    }
    if ($externalUri.Scheme -ne "https") {
      throw "ExternalBaseUrl must use HTTPS"
    }
    $baseUrl = $externalUri.GetLeftPart([UriPartial]::Path).TrimEnd("/")
    $apiUrl = [Environment]::GetEnvironmentVariable("VITE_E2E_API_URL", "Process")
    if ([string]::IsNullOrWhiteSpace($apiUrl)) {
      throw "External mode requires VITE_E2E_API_URL for the paired trusted API origin"
    }
    $apiUri = $null
    if (-not [Uri]::TryCreate($apiUrl, [UriKind]::Absolute, [ref] $apiUri) -or $apiUri.Scheme -ne "https") {
      throw "External VITE_E2E_API_URL must be an absolute HTTPS URL"
    }
    $isReservedStagingHost =
      $externalUri.Host -eq "web.vnshop.invalid" -and
      $apiUri.Host -eq "api.vnshop.invalid"
    if ($apiUri.Host.EndsWith(".invalid", [StringComparison]::OrdinalIgnoreCase) -and -not $isReservedStagingHost) {
      throw "External VITE_E2E_API_URL can use a reserved .invalid host only for the staging web.vnshop.invalid/api.vnshop.invalid pair"
    }
  } else {
    $existing = Invoke-Captured "docker" @("ps", "-a", "--filter", "name=^/$ContainerName$", "--format", "{{.ID}}")
    if (-not [string]::IsNullOrWhiteSpace($existing)) {
      throw "Container $ContainerName already exists; remove it before running the gate"
    }
    $baseUrl = "http://127.0.0.1:$ContainerPort"
    $apiUrl = "http://127.0.0.1:8080"
    $containerId = Invoke-Captured "docker" @(
      "run", "-d", "--name", $ContainerName,
      "-p", "$ContainerPort`:8080",
      $ImageReference
    )
    $containerStarted = $true
    Write-Host "Started exact frontend image $ImageReference as $ContainerName ($containerId)"
  }

  Wait-HttpOk "$baseUrl/healthz"
  Wait-HttpOk "$baseUrl/runtime-config.json"

  $distContainer = Invoke-Captured "docker" @("create", $ImageReference)
  if (Test-Path -LiteralPath $DistPath) {
    Remove-Item -LiteralPath $DistPath -Recurse -Force
  }
  New-Item -ItemType Directory -Path $DistPath -Force | Out-Null
  Invoke-Checked "docker" @(
    "cp",
    ("{0}:/usr/share/nginx/html/." -f $distContainer),
    $DistPath
  )
  Invoke-Checked "docker" @("rm", $distContainer)
  $distContainer = $null

  Remove-Item -LiteralPath $ReportPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $BundlePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $LighthousePath -Force -ErrorAction SilentlyContinue

  Set-ProcessEnvironment "VITE_E2E_BASE_URL" $baseUrl
  Set-ProcessEnvironment "VITE_E2E_API_URL" $apiUrl
  Set-ProcessEnvironment "E2E_SKIP_WEBSERVER" "1"
  Set-ProcessEnvironment "E2E_REQUIRED_PERSONAS" $Environment
  Set-ProcessEnvironment "PLAYWRIGHT_JSON_OUTPUT_FILE" $ReportPath
  if ($isExternal) {
    Set-ProcessEnvironment "E2E_RELEASE_CONTRACT" "true"
  } else {
    Set-ProcessEnvironment "E2E_RELEASE_CONTRACT" "false"
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("E2E_BUYER_USERNAME", "Process"))) {
      Set-ProcessEnvironment "E2E_BUYER_USERNAME" "buyer1"
    }
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("E2E_BUYER_PASSWORD", "Process"))) {
      Set-ProcessEnvironment "E2E_BUYER_PASSWORD" "test"
    }
  }

  Invoke-Checked "pnpm" @("run", "test:release-workflows")
  Invoke-Checked "pnpm" @("run", "verify:e2e")
  if ($isExternal) {
    Invoke-Checked "pnpm" @("run", "test:e2e")
  } else {
    Invoke-Checked "pnpm" @("run", "test:e2e:local-complete")
  }
  Invoke-Checked "node" @("scripts/assert-playwright-results.mjs", $ReportPath)
  Invoke-Checked "pnpm" @("run", "test:e2e:modernization")
  Invoke-Checked "node" @("scripts/assert-playwright-results.mjs", $ReportPath)
  Invoke-Checked "pnpm" @("run", "test:a11y")
  Invoke-Checked "pnpm" @("run", "test:states")
  Invoke-Checked "pnpm" @("run", "test:text-scale")
  Invoke-Checked "pnpm" @("run", "test:visual")
  Invoke-Checked "pnpm" @("run", "measure:bundles", "--", "--dist", $DistPath, "--output", $BundlePath)
  Invoke-Checked "pnpm" @("run", "measure:lighthouse", "--", "--output", $LighthousePath)
  Invoke-Checked "pnpm" @("run", "verify:performance")

  Write-Host "Cutover gate passed for $ImageReference at source commit $ExpectedSourceCommit"
} finally {
  if ($null -ne $distContainer) {
    & docker rm $distContainer *> $null
  }
  if ($containerStarted) {
    & docker rm -f $ContainerName *> $null
  }
  foreach ($name in $environmentNames) {
    $oldValue = $previousEnvironment[$name]
    if ($null -eq $oldValue) {
      Remove-ProcessEnvironment $name
    } else {
      Set-ProcessEnvironment $name $oldValue
    }
  }
  Pop-Location
}
