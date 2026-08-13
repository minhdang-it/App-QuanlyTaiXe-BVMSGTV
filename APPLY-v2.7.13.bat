@echo off
setlocal
cd /d "%~dp0"
echo.
echo ============================================================
echo  BVMSGTV v2.7.13 - SUA NHIEU TEP DINH KEM
ECHO ============================================================
echo.
if exist "src\lib\backend.js" (
  del /f /q "src\lib\backend.js"
  echo [OK] Da xoa src\lib\backend.js cu
)
if exist "src\pages\DispatchPage.jsx" (
  del /f /q "src\pages\DispatchPage.jsx"
  echo [OK] Da xoa src\pages\DispatchPage.jsx cu
)
echo.
echo Da xu ly file legacy. Tiep theo chay:
echo   npm run verify:source
echo   npm run check
echo   npm run build
echo.
pause
