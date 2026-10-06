@echo off
setlocal
cd /d "%~dp0"
title BVMSGTV - Local HTTPS

if not exist ".certs\local-key.pem" (
  echo [LOI] Thieu .certs\local-key.pem
  echo Xem HUONG-DAN-CHAY-LOCAL-v2.10.1.md muc "Test dien thoai trong LAN".
  pause
  exit /b 1
)
if not exist ".certs\local-cert.pem" (
  echo [LOI] Thieu .certs\local-cert.pem
  pause
  exit /b 1
)
set "LOCAL_HTTPS_KEY=.certs/local-key.pem"
set "LOCAL_HTTPS_CERT=.certs/local-cert.pem"
call npm.cmd run local:check || (pause & exit /b 1)
echo.
echo HTTPS local dang khoi dong tai port 5173.
echo Mo URL VITE_PUBLIC_HTTPS_URL da cau hinh trong .env.local.
echo.
call npm.cmd run dev:https
