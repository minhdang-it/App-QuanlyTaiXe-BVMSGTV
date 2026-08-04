@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if not exist "%~dp0service\service-manager.ps1" (
  echo [LOI] Khong tim thay: service\service-manager.ps1
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0service\service-manager.ps1" -Action Status
set "EXITCODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXITCODE%
