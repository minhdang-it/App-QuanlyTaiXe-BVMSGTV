param(
    [ValidateSet('Start', 'Restart', 'Stop', 'Status')]
    [string]$Action = 'Start',
    [switch]$Build
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

$RootDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$RuntimeDir = Join-Path $RootDir '.service'
$PidFile = Join-Path $RuntimeDir 'msg-car-web.pid'
$LogFile = Join-Path $RuntimeDir 'msg-car-web.log'
$ErrorLogFile = Join-Path $RuntimeDir 'msg-car-web-error.log'
$ServerFile = Join-Path $PSScriptRoot 'static-server.mjs'
$DistDir = Join-Path $RootDir 'dist'
$IndexFile = Join-Path $DistDir 'index.html'
$Port = 8080
$HealthUrl = "http://127.0.0.1:$Port/__health"
$HomeUrl = "http://localhost:$Port"

function Write-Info([string]$Message) {
    Write-Host "[MSG-CAR] $Message" -ForegroundColor Cyan
}

function Write-Success([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-WarningMessage([string]$Message) {
    Write-Host "[CANH BAO] $Message" -ForegroundColor Yellow
}

function Throw-ServiceError([string]$Message) {
    throw $Message
}

function Ensure-RuntimeDirectory {
    if (-not (Test-Path -LiteralPath $RuntimeDir)) {
        New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
    }
}

function Get-NodeCommand {
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($null -eq $node) {
        $node = Get-Command node -ErrorAction SilentlyContinue
    }
    if ($null -eq $node) {
        Throw-ServiceError 'Khong tim thay Node.js trong PATH. Hay cai Node.js 22 LTS va mo lai cua so.'
    }

    $versionText = (& $node.Source -p "process.versions.node").Trim()
    $majorText = $versionText.Split('.')[0]
    $major = 0
    if (-not [int]::TryParse($majorText, [ref]$major)) {
        Throw-ServiceError "Khong doc duoc phien ban Node.js: $versionText"
    }
    if ($major -lt 18) {
        Throw-ServiceError "Node.js qua cu ($versionText). Can Node.js 18 tro len; de build source nen dung Node.js 22 LTS."
    }

    Write-Info "Node.js: $versionText"
    return $node.Source
}

function Get-NpmCommand {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($null -eq $npm) {
        $npm = Get-Command npm -ErrorAction SilentlyContinue
    }
    if ($null -eq $npm) {
        Throw-ServiceError 'Khong tim thay npm trong PATH. Hay cai lai Node.js kem npm.'
    }
    return $npm.Source
}

function Get-SavedPid {
    if (-not (Test-Path -LiteralPath $PidFile)) {
        return $null
    }

    $value = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    $processId = 0
    if (-not [int]::TryParse([string]$value, [ref]$processId)) {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        return $null
    }
    return $processId
}

function Test-NodeServerProcess([int]$ProcessId) {
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        return $false
    }

    try {
        $item = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
        if ($null -ne $item -and [string]$item.CommandLine -like '*static-server.mjs*') {
            return $true
        }
    } catch {}

    return ($process.ProcessName -eq 'node')
}

function Get-PortOwnerPid([int]$LocalPort) {
    try {
        $connection = Get-NetTCPConnection -State Listen -LocalPort $LocalPort -ErrorAction Stop | Select-Object -First 1
        if ($null -ne $connection) {
            return [int]$connection.OwningProcess
        }
    } catch {}

    try {
        $line = netstat -ano -p tcp | Select-String -Pattern (":$LocalPort\s+.*LISTENING\s+(\d+)\s*$") | Select-Object -First 1
        if ($null -ne $line -and $line.Matches.Count -gt 0) {
            return [int]$line.Matches[0].Groups[1].Value
        }
    } catch {}

    return $null
}

function Invoke-ProjectBuild {
    if (-not (Test-Path -LiteralPath (Join-Path $RootDir 'package.json'))) {
        Throw-ServiceError 'Khong tim thay package.json. Cac file service phai nam trong THU MUC GOC cua website.'
    }

    $npm = Get-NpmCommand
    Push-Location $RootDir
    try {
        if (-not (Test-Path -LiteralPath (Join-Path $RootDir 'node_modules'))) {
            Write-Info 'Chua co node_modules. Dang chay npm install...'
            & $npm install
            if ($LASTEXITCODE -ne 0) {
                Throw-ServiceError 'npm install that bai.'
            }
        }

        Write-Info 'Dang build website: npm run build...'
        & $npm run build
        if ($LASTEXITCODE -ne 0) {
            Throw-ServiceError 'npm run build that bai. Hay xem loi TypeScript/Vite phia tren.'
        }
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath $IndexFile)) {
        Throw-ServiceError 'Build xong nhung khong co dist\index.html.'
    }
    Write-Success 'Build website thanh cong.'
}

function Ensure-BuildOutput {
    if ($Build.IsPresent -or -not (Test-Path -LiteralPath $IndexFile)) {
        Invoke-ProjectBuild
    } else {
        Write-Info 'Da co dist\index.html, bo qua buoc build.'
    }
}

function Wait-UntilReady([int]$ProcessId, [int]$TimeoutSeconds = 25) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (-not (Test-NodeServerProcess -ProcessId $ProcessId)) {
            return $false
        }

        try {
            $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                return $true
            }
        } catch {}

        Start-Sleep -Milliseconds 700
    }
    return $false
}

function Show-RecentErrorLog {
    if (Test-Path -LiteralPath $ErrorLogFile) {
        Write-Host ''
        Write-Host '----- LOI GAN NHAT -----' -ForegroundColor Red
        Get-Content -LiteralPath $ErrorLogFile -Tail 80 -ErrorAction SilentlyContinue
        Write-Host '------------------------' -ForegroundColor Red
    }
}

function Show-NetworkUrls {
    Write-Success "May hien tai: $HomeUrl"
    try {
        $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object {
                $_.IPAddress -ne '127.0.0.1' -and
                $_.IPAddress -notlike '169.254.*' -and
                $_.AddressState -eq 'Preferred'
            } |
            Select-Object -ExpandProperty IPAddress -Unique

        foreach ($address in $addresses) {
            Write-Success "May khac trong LAN: http://$address`:$Port"
        }
    } catch {}
}

function Start-WebService {
    Ensure-RuntimeDirectory
    $node = Get-NodeCommand
    Ensure-BuildOutput

    if (-not (Test-Path -LiteralPath $ServerFile)) {
        Throw-ServiceError 'Thieu file service\static-server.mjs. Hay chep lai TOAN BO goi service.'
    }

    $savedPid = Get-SavedPid
    if ($null -ne $savedPid -and (Test-NodeServerProcess -ProcessId $savedPid)) {
        Write-Success "Website dang chay, PID $savedPid."
        Show-NetworkUrls
        return
    }
    if ($null -ne $savedPid) {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    }

    $portOwner = Get-PortOwnerPid -LocalPort $Port
    if ($null -ne $portOwner) {
        $ownerProcess = Get-Process -Id $portOwner -ErrorAction SilentlyContinue
        $ownerName = if ($null -ne $ownerProcess) { $ownerProcess.ProcessName } else { 'khong xac dinh' }
        Throw-ServiceError "Cong $Port dang bi tien trinh khac su dung. PID=$portOwner, Process=$ownerName. Hay tat tien trinh do hoac doi cong."
    }

    Remove-Item -LiteralPath $LogFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $ErrorLogFile -Force -ErrorAction SilentlyContinue

    Write-Info 'Dang khoi dong website chay nen...'
    $oldPort = $env:PORT
    $oldRootDir = $env:ROOT_DIR
    try {
        $env:PORT = [string]$Port
        $env:ROOT_DIR = $DistDir
        $quotedServerFile = '"' + $ServerFile + '"'
        $process = Start-Process `
            -FilePath $node `
            -ArgumentList $quotedServerFile `
            -WorkingDirectory $RootDir `
            -WindowStyle Hidden `
            -RedirectStandardOutput $LogFile `
            -RedirectStandardError $ErrorLogFile `
            -PassThru
    }
    finally {
        if ($null -eq $oldPort) { Remove-Item Env:PORT -ErrorAction SilentlyContinue } else { $env:PORT = $oldPort }
        if ($null -eq $oldRootDir) { Remove-Item Env:ROOT_DIR -ErrorAction SilentlyContinue } else { $env:ROOT_DIR = $oldRootDir }
    }

    if ($null -eq $process) {
        Throw-ServiceError 'Windows khong khoi dong duoc Node.js process.'
    }

    Set-Content -LiteralPath $PidFile -Value $process.Id -Encoding ASCII

    if (-not (Wait-UntilReady -ProcessId $process.Id)) {
        try { $process.Kill() } catch {}
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
        Show-RecentErrorLog
        Throw-ServiceError "Website khong san sang tren cong $Port."
    }

    Write-Success "Khoi dong thanh cong. PID: $($process.Id)"
    Show-NetworkUrls
    Write-Info "Log: $LogFile"
    Write-Info "Error log: $ErrorLogFile"

    try { Start-Process $HomeUrl | Out-Null } catch {}
}

function Stop-WebService {
    Ensure-RuntimeDirectory
    $savedPid = Get-SavedPid

    if ($null -eq $savedPid -or -not (Test-NodeServerProcess -ProcessId $savedPid)) {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        Write-WarningMessage 'Khong tim thay website dang chay theo PID file.'
        return
    }

    Write-Info "Dang dung PID $savedPid..."
    Stop-Process -Id $savedPid -ErrorAction SilentlyContinue

    $deadline = (Get-Date).AddSeconds(8)
    while ((Get-Date) -lt $deadline -and (Test-NodeServerProcess -ProcessId $savedPid)) {
        Start-Sleep -Milliseconds 400
    }

    if (Test-NodeServerProcess -ProcessId $savedPid) {
        Write-WarningMessage 'Dung thong thuong khong thanh cong, dang buoc dung.'
        Stop-Process -Id $savedPid -Force -ErrorAction SilentlyContinue
    }

    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    Write-Success 'Da dung website.'
}

function Show-ServiceStatus {
    Ensure-RuntimeDirectory
    Write-Info "Thu muc website: $RootDir"
    Write-Info "Cong: $Port"

    $savedPid = Get-SavedPid
    if ($null -ne $savedPid -and (Test-NodeServerProcess -ProcessId $savedPid)) {
        Write-Success "DANG CHAY - PID: $savedPid"
        Show-NetworkUrls
    } else {
        Write-WarningMessage 'DANG DUNG'
        $portOwner = Get-PortOwnerPid -LocalPort $Port
        if ($null -ne $portOwner) {
            Write-WarningMessage "Tuy nhien cong $Port dang bi PID $portOwner su dung."
        }
    }

    Write-Info "Log: $LogFile"
    Write-Info "Error log: $ErrorLogFile"
    Show-RecentErrorLog
}

try {
    Write-Info "Action: $Action"
    Write-Info "Thu muc website: $RootDir"

    switch ($Action) {
        'Start' {
            Start-WebService
        }
        'Restart' {
            Stop-WebService
            Start-Sleep -Seconds 1
            Start-WebService
        }
        'Stop' {
            Stop-WebService
        }
        'Status' {
            Show-ServiceStatus
        }
    }
    exit 0
}
catch {
    Write-Host ''
    Write-Host "[LOI] $($_.Exception.Message)" -ForegroundColor Red
    Show-RecentErrorLog
    Write-Host ''
    Write-Host 'Kiem tra rang cac file service nam cung thu muc goc voi package.json va dist.' -ForegroundColor Yellow
    exit 1
}
