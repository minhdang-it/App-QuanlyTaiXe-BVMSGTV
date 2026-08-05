@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0TAO-HTTPS-NOI-BO.ps1"
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
  echo [LOI] Khong tao duoc HTTPS noi bo. Ma loi: %EXITCODE%
) else (
  echo [OK] Da tao HTTPS va khoi dong lai website.
)
echo.
pause
exit /b %EXITCODE%
