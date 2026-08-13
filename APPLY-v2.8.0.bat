@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ==================================================
echo  Patch v2.8.0 - Mobile Operations Upgrade
echo ==================================================
echo.
echo Hay chep TOAN BO noi dung thu muc patch nay vao THU MUC GOC project,
echo sau do chay cac lenh:
echo.
echo   npm run verify:source
echo   npm run check
echo   npm run build
echo.
echo v2.8.0 KHONG can SQL migration moi va KHONG can deploy lai manage-user.
echo.
pause
