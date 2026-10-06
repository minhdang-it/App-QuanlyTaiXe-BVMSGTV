@echo off
setlocal
cd /d "%~dp0"
title BVMSGTV - Local Development

if not exist ".env.local" (
  echo [LOI] Chua co .env.local. Hay chay SETUP-LOCAL.cmd truoc.
  pause
  exit /b 1
)
if not exist "node_modules\vite\package.json" (
  echo [LOI] Chua co node_modules. Hay chay SETUP-LOCAL.cmd truoc.
  pause
  exit /b 1
)
call npm.cmd run local:check || (pause & exit /b 1)
start "" "http://localhost:5173"
echo.
echo Website local: http://localhost:5173
echo Nhan Ctrl+C de dung server.
echo.
call npm.cmd run dev:lan
