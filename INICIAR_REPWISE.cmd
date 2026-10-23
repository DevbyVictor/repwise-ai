@echo off
cd /d "%~dp0"
echo RepWise AI - cadastro e login por e-mail e senha
where node >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js 22.13 ou superior para iniciar.
  pause
  exit /b 1
)
if not exist "node_modules\vinext\package.json" (
  echo Instale as dependencias com npm ci nesta pasta e abra novamente.
  pause
  exit /b 1
)
node scripts\local-db.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
node scripts\sync-public.cjs
echo Abra http://localhost:4173 e mantenha esta janela aberta.
node scripts\run-framework.mjs dev --port 4173 --hostname 127.0.0.1
pause
