@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title BVMSGTV - App + Navicom Local

if not exist ".env.local" (
  echo [LOI] Chua co .env.local.
  echo Hay chay SETUP-LOCAL.cmd truoc.
  pause
  exit /b 1
)
if not exist ".env.navicom.local" (
  echo [LOI] Chua co .env.navicom.local.
  echo Hay chay SETUP-NAVICOM-LOCAL.cmd truoc.
  pause
  exit /b 1
)

call npm.cmd run local:check
if errorlevel 1 (pause & exit /b 1)
call npm.cmd run navicom:check
if errorlevel 1 (pause & exit /b 1)

echo.
echo [1/3] Khoi dong Navicom Gateway trong cua so rieng...
start "BVMSGTV Navicom Gateway" /D "%~dp0" cmd.exe /k call START-NAVICOM-GATEWAY.cmd

call :WAIT_GATEWAY
if errorlevel 1 (
  echo.
  echo [LOI] Navicom Gateway khong khoi dong tai 127.0.0.1:3020.
  echo.
  echo Hay xem cua so "BVMSGTV Navicom Gateway" de doc loi.
  echo Co the kiem tra rieng bang:
  echo   START-NAVICOM-GATEWAY.cmd
  echo.
  echo Sau khi gateway chay, mo:
  echo   http://127.0.0.1:3020/health
  echo.
  pause
  exit /b 1
)

echo [2/3] Navicom Gateway: OK
echo [3/3] Khoi dong App dieu phoi xe...
echo.
echo App local : http://localhost:5173
echo Gateway   : http://127.0.0.1:3020
echo Health    : http://127.0.0.1:3020/health
echo.
call npm.cmd run dev:lan
exit /b %ERRORLEVEL%

:WAIT_GATEWAY
echo Dang cho Gateway san sang...
for /L %%I in (1,1,15) do (
  call npm.cmd run navicom:health >nul 2>&1
  if not errorlevel 1 exit /b 0
  timeout /t 1 /nobreak >nul
)
exit /b 1
