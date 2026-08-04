. (Join-Path $PSScriptRoot 'common.ps1')

try {
    Write-Step "Project directory: $script:RootDir"
    Ensure-NodeReady
    Ensure-BuildOutput

    if (-not (Test-Path -LiteralPath $script:ServiceDir)) {
        New-Item -ItemType Directory -Path $script:ServiceDir -Force | Out-Null
    }

    $existingPid = Get-ServicePid
    if ($null -ne $existingPid -and (Test-ServiceProcess -ProcessId $existingPid)) {
        Write-Ok "Service is already running with PID $existingPid."
        Show-ServiceInfo
        exit 0
    }

    if ($null -ne $existingPid) {
        Remove-Item -LiteralPath $script:PidFile -Force -ErrorAction SilentlyContinue
    }

    Write-Step 'Starting MSG Car web service in background...'
    $env:PORT = [string]$script:HostPort
    $env:ROOT_DIR = Join-Path $script:RootDir 'dist'

    $process = Start-Process `
        -FilePath 'node.exe' `
        -ArgumentList @($script:ServerFile) `
        -WorkingDirectory $script:RootDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $script:LogFile `
        -RedirectStandardError $script:ErrorLogFile `
        -PassThru

    Set-Content -LiteralPath $script:PidFile -Value $process.Id -Encoding ASCII

    if (-not (Wait-ServiceReady)) {
        if (Test-ServiceProcess -ProcessId $process.Id) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $script:PidFile -Force -ErrorAction SilentlyContinue
        if (Test-Path -LiteralPath $script:ErrorLogFile) {
            Get-Content -LiteralPath $script:ErrorLogFile -Tail 80
        }
        Fail-Service "Service did not become ready on port $($script:HostPort)."
    }

    Show-ServiceInfo
    exit 0
}
catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
