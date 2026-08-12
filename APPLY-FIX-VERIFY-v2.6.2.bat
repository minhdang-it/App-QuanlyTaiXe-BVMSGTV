@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo BVMSGTV v2.6.2 - FIX VERIFY SOURCE
echo ============================================================

if not exist "scripts\verify-source.mjs" (
  echo [LOI] Khong tim thay scripts\verify-source.mjs.
  echo Hay chep file APPLY-FIX-VERIFY-v2.6.2.bat vao THU MUC GOC cua project.
  pause
  exit /b 1
)

echo [1/3] Xoa script legacy co du lieu tai khoan hard-code...
if exist "create-website-user.mjs" del /f /q "create-website-user.mjs"

echo [2/3] Xoa du lieu demo khong con duoc su dung...
if exist "src\lib\demoData.ts" del /f /q "src\lib\demoData.ts"

echo [3/3] Xoa cac hang so DEMO_PHONE khong con duoc tham chieu...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='src/lib/constants.ts'; if(Test-Path $p){ $c=Get-Content -LiteralPath $p; $c=$c | Where-Object { $_ -notmatch '^export const (DRIVER|ADMIN|ACCOUNTANT|DIRECTOR)_DEMO_PHONE\s*=' }; Set-Content -LiteralPath $p -Value $c -Encoding utf8 }"

if errorlevel 1 (
  echo [LOI] Khong cap nhat duoc constants.ts
  pause
  exit /b 1
)

echo.
echo Chay verify:source...
call npm run verify:source
if errorlevel 1 (
  echo.
  echo [LOI] Verify van con loi. Gui lai man hinh loi moi de kiem tra tiep.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo HOAN TAT - VERIFY SOURCE DA THANH CONG
echo Tiep theo chay:
echo   npm run check
echo   npm run build
echo ============================================================
pause
