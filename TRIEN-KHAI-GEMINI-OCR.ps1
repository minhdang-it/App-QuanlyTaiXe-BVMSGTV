$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== TRIỂN KHAI GEMINI OCR ĐỒNG HỒ KM ===" -ForegroundColor Cyan
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw "Chưa cài Node.js/npm. Hãy cài Node.js trước."
}

$apiKey = Read-Host "Nhập GEMINI_API_KEY từ Google AI Studio"
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw "GEMINI_API_KEY không được để trống." }
$model = Read-Host "Model Gemini (Enter để dùng gemini-3.6-flash)"
if ([string]::IsNullOrWhiteSpace($model)) { $model = "gemini-3.6-flash" }

Write-Host "Đăng nhập Supabase nếu được yêu cầu..." -ForegroundColor Yellow
npx supabase login
Write-Host "Đặt secrets an toàn trên Supabase..." -ForegroundColor Yellow
npx supabase secrets set "GEMINI_API_KEY=$apiKey" "GEMINI_ODOMETER_MODEL=$model"
Write-Host "Triển khai Edge Function analyze-odometer..." -ForegroundColor Yellow
npx supabase functions deploy analyze-odometer

Write-Host "Hoàn tất. API key chỉ nằm trong Supabase Secret, không nằm trong source frontend." -ForegroundColor Green
