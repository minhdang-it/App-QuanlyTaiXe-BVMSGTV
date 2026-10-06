@echo off
setlocal
cd /d "%~dp0"
title BVMSGTV - Build Production
call npm.cmd run local:check || (pause & exit /b 1)
call npm.cmd run verify || (pause & exit /b 1)
echo.
echo BUILD THANH CONG. Thu muc phat hanh: dist\
pause
