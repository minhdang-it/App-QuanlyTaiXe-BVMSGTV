@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist package.json (
  echo Khong tim thay package.json trong thu muc hien tai.
  pause
  exit /b 1
)
if not exist node_modules\@supabase\supabase-js (
  echo Chua co node_modules. Dang chay npm install...
  call npm install
  if errorlevel 1 (
    echo npm install that bai.
    pause
    exit /b 1
  )
)
node scripts\bootstrap-admin.mjs
pause
