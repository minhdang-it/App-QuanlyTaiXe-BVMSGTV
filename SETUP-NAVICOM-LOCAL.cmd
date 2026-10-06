@echo off
setlocal
cd /d "%~dp0"
title BVMSGTV - Setup Navicom Local

echo ================================================
echo   BVMSGTV v2.10.3 - THIET LAP NAVICOM LOCAL
echo ================================================
where node.exe >nul 2>&1 || (echo [LOI] Chua cai Node.js 22+. & pause & exit /b 1)
where npm.cmd >nul 2>&1 || (echo [LOI] Khong tim thay npm.cmd. & pause & exit /b 1)

if not exist ".env.navicom.local" (
  copy /Y ".env.navicom.local.example" ".env.navicom.local" >nul
  echo [OK] Da tao .env.navicom.local o che do MOCK.
  echo      Che do nay cho phep test giao dien Navicom ngay, KHONG can tai khoan that.
)

echo.
echo [1/3] Kiem tra file cau hinh Navicom...
call npm.cmd run navicom:check
if errorlevel 1 (pause & exit /b 1)

echo [2/3] Kiem tra ma gateway...
node --check server\navicom-gateway\server.mjs
if errorlevel 1 (echo [LOI] Gateway code co loi. & pause & exit /b 1)

echo [3/3] Kiem tra frontend source...
call npm.cmd run verify:source
if errorlevel 1 (pause & exit /b 1)

echo.
echo ================================================
echo   NAVICOM LOCAL DA SAN SANG
echo ================================================
echo Buoc tiep theo:
echo   1. Dam bao .env.local da co Supabase URL + ANON KEY.
echo   2. Chay START-LOCAL-NAVICOM.cmd
echo   3. Mo http://localhost:5173
echo   4. Gan Device ID Navicom cho tung xe trong Quan ly xe.
echo.
pause
endlocal
