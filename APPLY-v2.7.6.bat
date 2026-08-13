@echo off
setlocal
cd /d "%~dp0"
echo [v2.7.6] Don dep file build cu co the lam Vite uu tien nham JavaScript...
if exist "src\lib\backend.js" del /q "src\lib\backend.js"
if exist "src\pages\DispatchPage.jsx" del /q "src\pages\DispatchPage.jsx"
if exist "tsconfig.app.tsbuildinfo" del /q "tsconfig.app.tsbuildinfo"
if exist "tsconfig.node.tsbuildinfo" del /q "tsconfig.node.tsbuildinfo"
echo [v2.7.6] Da don dep. Chay tiep:
echo npm run verify:source
echo npm run check
echo npm run build
endlocal
