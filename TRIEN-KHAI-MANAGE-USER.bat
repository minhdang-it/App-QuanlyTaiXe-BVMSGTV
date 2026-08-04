@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0TRIEN-KHAI-MANAGE-USER.ps1"
if errorlevel 1 (
  echo.
  echo Deploy manage-user that bai.
  pause
  exit /b 1
)
endlocal
