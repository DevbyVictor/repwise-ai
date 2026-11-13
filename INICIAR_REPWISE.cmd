@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 22.13 ou superior e abra este arquivo novamente.
  pause
  exit /b 1
)
echo Abra http://127.0.0.1:4173 no navegador.
node server.mjs
pause
