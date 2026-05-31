@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found. Install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo node_modules missing. Running repair-deps.bat...
  call "%~dp0repair-deps.bat"
  if errorlevel 1 exit /b 1
)

if not exist "server\node_modules" (
  echo server\node_modules missing. Installing server dependencies...
  call npm.cmd run server:install
  if errorlevel 1 exit /b 1
)

echo Freeing dev ports 3001 and 5173 if still in use...
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($p in 3001,5173) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"
timeout /t 1 /nobreak >nul

echo.
echo Starting Bible Game...
echo   API:  http://localhost:3001  (window "Bible Game API")
echo   App:  http://localhost:5173  (this window)
echo.
echo Stop: Ctrl+C here and close the API window.
echo.

start "Bible Game API" /D "%~dp0" cmd /k npm run server:dev

echo Waiting for API...
set /a API_TRIES=0
:wait_api
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:3001/health' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto api_ready
set /a API_TRIES+=1
if %API_TRIES% geq 20 (
  echo [WARN] API did not respond in time; starting frontend anyway.
  goto api_ready
)
timeout /t 1 /nobreak >nul
goto wait_api

:api_ready
echo API is ready.
echo.

start "" http://localhost:5173
call npm.cmd run dev
set EXITCODE=%ERRORLEVEL%

if %EXITCODE% neq 0 (
  echo.
  echo [ERROR] Frontend failed. Run repair-deps.bat and try again.
)

echo.
pause
exit /b %EXITCODE%
