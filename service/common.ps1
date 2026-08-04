Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:RootDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$script:ServiceDir = Join-Path $script:RootDir '.service'
$script:PidFile = Join-Path $script:ServiceDir 'msg-car-web.pid'
$script:LogFile = Join-Path $script:ServiceDir 'msg-car-web.log'
$script:ErrorLogFile = Join-Path $script:ServiceDir 'msg-car-web-error.log'
$script:ServerFile = Join-Path $PSScriptRoot 'static-server.mjs'
$script:HostPort = 8080

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "[MSG-CAR] $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-WarnText {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Fail-Service {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

function Ensure-NodeReady {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($null -eq $nodeCommand) {
        Fail-Service 'Node.js was not found in PATH. Install Node.js 22 or newer.'
    }

    $majorText = (& node -p "process.versions.node.split('.')[0]").Trim()
    $major = 0
    if (-not [int]::TryParse($majorText, [ref]$major)) {
        Fail-Service 'Unable to read the Node.js version.'
    }
    if ($major -lt 22) {
        Fail-Service "Node.js 22 or newer is required. Current major version: $major"
    }
}

function Get-ServicePid {
    if (-not (Test-Path -LiteralPath $script:PidFile)) {
        return $null
    }

    $raw = (Get-Content -LiteralPath $script:PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $pidValue = 0
    if (-not [int]::TryParse([string]$raw, [ref]$pidValue)) {
        Remove-Item -LiteralPath $script:PidFile -Force -ErrorAction SilentlyContinue
        return $null
    }

    return $pidValue
}

function Test-ServiceProcess {
    param([Parameter(Mandatory = $true)][int]$ProcessId)

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        return $false
    }

    try {
        $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId").CommandLine
        return $commandLine -like '*static-server.mjs*'
    }
    catch {
        return $process.ProcessName -eq 'node'
    }
}

function Ensure-BuildOutput {
    $indexPath = Join-Path $script:RootDir 'dist\index.html'
    if (Test-Path -LiteralPath $indexPath) {
        return
    }

    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($null -eq $npmCommand) {
        $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
    }
    if ($null -eq $npmCommand) {
        Fail-Service 'npm was not found. The dist folder is missing and cannot be built.'
    }

    Write-Step 'The dist folder is missing. Running npm run build...'
    Push-Location $script:RootDir
    try {
        & $npmCommand.Source run build
        if ($LASTEXITCODE -ne 0) {
            Fail-Service 'npm run build failed.'
        }
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath $indexPath)) {
        Fail-Service 'Build completed but dist/index.html was not created.'
    }
}

function Wait-ServiceReady {
    param([int]$TimeoutSeconds = 30)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        Start-Sleep -Seconds 1
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$($script:HostPort)" -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        }
        catch {
            # Continue waiting.
        }
    } while ((Get-Date) -lt $deadline)

    return $false
}

function Show-ServiceInfo {
    $pidValue = Get-ServicePid
    Write-Host ''
    Write-Ok "PID: $pidValue"
    Write-Ok "URL: http://localhost:$($script:HostPort)"
    Write-Ok "Log: $script:LogFile"
    Write-Host ''
}
