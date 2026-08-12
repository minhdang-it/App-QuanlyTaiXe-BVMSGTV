$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path 'scripts/verify-source.mjs')) {
    throw 'Hãy chép script này vào thư mục gốc của project trước khi chạy.'
}

Write-Host '[1/3] Xóa create-website-user.mjs legacy...' -ForegroundColor Cyan
Remove-Item 'create-website-user.mjs' -Force -ErrorAction SilentlyContinue

Write-Host '[2/3] Xóa src/lib/demoData.ts không còn sử dụng...' -ForegroundColor Cyan
Remove-Item 'src/lib/demoData.ts' -Force -ErrorAction SilentlyContinue

Write-Host '[3/3] Xóa các hằng số DEMO_PHONE không còn tham chiếu...' -ForegroundColor Cyan
$constants = 'src/lib/constants.ts'
if (Test-Path $constants) {
    $content = Get-Content -LiteralPath $constants
    $content = $content | Where-Object {
        $_ -notmatch '^export const (DRIVER|ADMIN|ACCOUNTANT|DIRECTOR)_DEMO_PHONE\s*='
    }
    Set-Content -LiteralPath $constants -Value $content -Encoding utf8
}

Write-Host 'Chạy verify:source...' -ForegroundColor Yellow
npm run verify:source
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'VERIFY SOURCE: OK' -ForegroundColor Green
Write-Host 'Tiếp tục chạy:' -ForegroundColor Green
Write-Host '  npm run check'
Write-Host '  npm run build'
