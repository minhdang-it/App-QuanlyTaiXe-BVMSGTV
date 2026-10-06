@echo off
setlocal
cd /d "%~dp0"
title BVMSGTV - Setup Local

echo ================================================
echo   BVMSGTV - THIET LAP LOCAL
echo ================================================
where node.exe >nul 2>&1 || (echo [LOI] Chua cai Node.js 22+. & pause & exit /b 1)
where npm.cmd >nul 2>&1 || (echo [LOI] Khong tim thay npm.cmd. & pause & exit /b 1)
node --version

if not exist ".env.local" (
  copy /Y ".env.local.example" ".env.local" >nul
  echo.
  echo [CAN LAM] Da tao .env.local.
  echo Hay dien VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY.
  start "" notepad ".env.local"
  echo Sau khi luu file, chay lai SETUP-LOCAL.cmd.
  pause
  exit /b 2
)

echo.
echo [1/3] Cai dependencies...
call npm.cmd ci --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo [LOI] npm ci that bai. Hay dong VS Code/terminal dang giu node_modules,
  echo xoa thu muc node_modules neu co, roi chay lai file nay.
  pause
  exit /b 1
)

echo [2/3] Kiem tra cau hinh local...
call npm.cmd run local:check || (pause & exit /b 1)

echo [3/3] Kiem tra source TypeScript...
call npm.cmd run verify:source || (pause & exit /b 1)
call npm.cmd run check || (pause & exit /b 1)

echo.
echo ================================================
echo   SETUP HOAN TAT
echo ================================================
echo Chay START-LOCAL.cmd de mo website.
pause
