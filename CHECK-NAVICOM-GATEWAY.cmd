@echo off
setlocal
cd /d "%~dp0"
title BVMSGTV - Check Navicom Gateway

echo ================================================
echo   KIEM TRA NAVICOM GATEWAY
 echo ================================================
echo.
call npm.cmd run navicom:health
if errorlevel 1 (
  echo.
  echo [LOI] Gateway KHONG chay tai 127.0.0.1:3020.
  echo Hay chay START-NAVICOM-GATEWAY.cmd va GIU cua so do mo.
  echo.
  netstat -ano | findstr ":3020"
  echo.
  pause
  exit /b 1
)
echo.
echo [OK] Gateway dang hoat dong.
echo.
netstat -ano | findstr ":3020"
pause
