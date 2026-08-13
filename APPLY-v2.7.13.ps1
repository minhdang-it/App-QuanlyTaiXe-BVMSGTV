$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$legacy = @('src/lib/backend.js', 'src/pages/DispatchPage.jsx')
foreach ($file in $legacy) {
  if (Test-Path $file) {
    Remove-Item -Force $file
    Write-Host "[OK] Đã xóa $file" -ForegroundColor Green
  }
}
Write-Host "`nTiếp theo chạy:" -ForegroundColor Cyan
Write-Host "npm run verify:source"
Write-Host "npm run check"
Write-Host "npm run build"
