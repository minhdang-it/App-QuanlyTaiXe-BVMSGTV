@echo off
setlocal
cd /d "%~dp0"
echo Patch v2.10.2: copy cac file trong thu muc patch de che vao project v2.10.1.
echo Sau do chay migration Supabase: supabase\migrate-v2.10.2-navicom-driver-minimal.sql
echo Tiep theo: npm.cmd run verify:source ^&^& npm.cmd run check ^&^& npm.cmd run build
pause
endlocal
