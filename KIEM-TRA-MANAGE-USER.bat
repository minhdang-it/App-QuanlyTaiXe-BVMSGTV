@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0KIEM-TRA-MANAGE-USER.ps1"
endlocal
