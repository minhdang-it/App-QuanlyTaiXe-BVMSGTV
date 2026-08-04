. (Join-Path $PSScriptRoot 'common.ps1')

try {
    Write-Step "Project directory: $script:RootDir"
    Ensure-NodeReady

    $existingPid = Get-ServicePid
    if ($null -ne $existingPid -and (Test-ServiceProcess -ProcessId $existingPid)) {
        Write-Step "Stopping service PID $existingPid..."
        Stop-Process -Id $existingPid -ErrorAction SilentlyContinue

        $deadline = (Get-Date).AddSeconds(10)
        while ((Get-Date) -lt $deadline -and (Test-ServiceProcess -ProcessId $existingPid)) {
            Start-Sleep -Milliseconds 500
        }

        if (Test-ServiceProcess -ProcessId $existingPid) {
            Write-WarnText 'Normal stop timed out. Forcing process stop.'
            Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
        }
    }
    else {
        Write-WarnText 'No active service process was found. Starting a new one.'
    }

    Remove-Item -LiteralPath $script:PidFile -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-service.ps1')
    exit $LASTEXITCODE
}
catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
