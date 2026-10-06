@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title BVMSGTV - Navicom Gateway

if not exist ".env.navicom.local" (
  echo [LOI] Chua co .env.navicom.local
  echo Hay chay SETUP-NAVICOM-LOCAL.cmd truoc.
  pause
  exit /b 1
)

where node.exe >nul 2>&1 || (
  echo [LOI] Khong tim thay Node.js.
  pause
  exit /b 1
)

call npm.cmd run navicom:check
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo ================================================
echo   NAVICOM GATEWAY DANG CHAY
echo ================================================
echo Gateway: http://127.0.0.1:3020
echo Health : http://127.0.0.1:3020/health
echo.
echo KHONG DONG CUA SO NAY KHI DANG TEST APP.
echo.

node --env-file=.env.navicom.local server\navicom-gateway\server.mjs

set ERR=%ERRORLEVEL%
echo.
if not "%ERR%"=="0" echo [LOI] Navicom Gateway da dung voi ma loi %ERR%.
pause
exit /b %ERR%
