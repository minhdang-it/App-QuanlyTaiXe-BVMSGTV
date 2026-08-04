@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if not exist "%~dp0service\service-manager.ps1" (
  echo [LOI] Khong tim thay: service\service-manager.ps1
  echo Hay chep TOAN BO goi service vao thu muc goc website.
  echo.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0service\service-manager.ps1" -Action Restart -Build
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
  echo [LOI] Khong khoi dong lai duoc website. Ma loi: %EXITCODE%
  echo Xem file: .service\msg-car-web-error.log
) else (
  echo [OK] Website da build va khoi dong lai.
)
echo.
pause
exit /b %EXITCODE%
