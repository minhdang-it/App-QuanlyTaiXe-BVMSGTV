$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $ProjectDir '.env'
if (-not (Test-Path $envFile)) { throw 'Khong tim thay .env.' }
$urlLine = Get-Content $envFile | Where-Object { $_ -match '^VITE_SUPABASE_URL=' } | Select-Object -First 1
$supabaseUrl = ($urlLine -replace '^VITE_SUPABASE_URL=', '').Trim().Trim('"').Trim("'").TrimEnd('/')
$healthUrl = "$supabaseUrl/functions/v1/manage-user"
Write-Host "Dang kiem tra: $healthUrl" -ForegroundColor Cyan
try {
  $result = Invoke-RestMethod -Method Get -Uri $healthUrl -TimeoutSec 30
  $result | ConvertTo-Json -Depth 5
  if ($result.ok -eq $true) {
    Write-Host 'manage-user dang hoat dong.' -ForegroundColor Green
  } else {
    Write-Host 'Function co phan hoi nhung health check khong hop le.' -ForegroundColor Yellow
  }
} catch {
  Write-Host 'Khong goi duoc manage-user.' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host 'Hay chay TRIEN-KHAI-MANAGE-USER.bat.' -ForegroundColor Yellow
}
Read-Host 'Nhan Enter de dong'
