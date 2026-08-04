$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ' DEPLOY EDGE FUNCTION manage-user - BVMSGTV v1.8.0' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''

$envFile = Join-Path $ProjectDir '.env'
$functionFile = Join-Path $ProjectDir 'supabase\functions\manage-user\index.ts'

if (-not (Test-Path $envFile)) {
  throw 'Khong tim thay file .env trong thu muc website.'
}
if (-not (Test-Path $functionFile)) {
  throw 'Khong tim thay supabase\functions\manage-user\index.ts.'
}

$urlLine = Get-Content $envFile | Where-Object { $_ -match '^VITE_SUPABASE_URL=' } | Select-Object -First 1
if (-not $urlLine) {
  throw 'File .env khong co VITE_SUPABASE_URL.'
}

$supabaseUrl = ($urlLine -replace '^VITE_SUPABASE_URL=', '').Trim().Trim('"').Trim("'")
if ($supabaseUrl -notmatch '^https://([a-z0-9]+)\.supabase\.co/?$') {
  throw "VITE_SUPABASE_URL khong hop le: $supabaseUrl"
}
$projectRef = $Matches[1]

Write-Host "Project ref: $projectRef" -ForegroundColor Yellow
Write-Host ''
Write-Host 'Buoc 1/3: Dang nhap Supabase CLI...' -ForegroundColor White
& npx supabase login
if ($LASTEXITCODE -ne 0) { throw 'Supabase login that bai.' }

Write-Host ''
Write-Host 'Buoc 2/3: Deploy manage-user voi --no-verify-jwt...' -ForegroundColor White
& npx supabase functions deploy manage-user --project-ref $projectRef --no-verify-jwt
if ($LASTEXITCODE -ne 0) { throw 'Deploy manage-user that bai.' }

Write-Host ''
Write-Host 'Buoc 3/3: Kiem tra health endpoint...' -ForegroundColor White
Start-Sleep -Seconds 3
$healthUrl = "$supabaseUrl/functions/v1/manage-user"
try {
  $health = Invoke-RestMethod -Method Get -Uri $healthUrl -TimeoutSec 30
  if ($health.ok -eq $true) {
    Write-Host ''
    Write-Host "THANH CONG: manage-user version $($health.version) da hoat dong." -ForegroundColor Green
  } else {
    throw 'Health endpoint khong tra ve ok=true.'
  }
} catch {
  Write-Host ''
  Write-Host 'Function da deploy nhung chua kiem tra duoc health endpoint.' -ForegroundColor Yellow
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host "Kiem tra tai: $healthUrl" -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Tiep theo chay: npm run build' -ForegroundColor Cyan
Write-Host 'Sau do upload lai thu muc dist len hosting.' -ForegroundColor Cyan
Write-Host ''
Read-Host 'Nhan Enter de dong'
