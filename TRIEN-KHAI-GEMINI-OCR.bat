@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0TRIEN-KHAI-GEMINI-OCR.ps1"
pause
