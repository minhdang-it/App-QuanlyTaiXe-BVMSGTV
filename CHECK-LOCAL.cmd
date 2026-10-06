@echo off
setlocal
cd /d "%~dp0"
title BVMSGTV - Check Local
call npm.cmd run local:check || (pause & exit /b 1)
call npm.cmd run verify:source || (pause & exit /b 1)
call npm.cmd run check || (pause & exit /b 1)
echo.
echo KIEM TRA SOURCE: OK
pause
