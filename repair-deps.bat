@echo off
cd /d "%~dp0"
echo Repairing dependencies (this may take a few minutes)...
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found. Install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

if exist "node_modules\.vite-temp" (
  echo Removing corrupted .vite-temp cache...
  rmdir /s /q "node_modules\.vite-temp" 2>nul
)

if exist "node_modules" (
  echo Removing node_modules...
  rmdir /s /q "node_modules"
  if exist "node_modules" (
    echo.
    echo [ERROR] Could not delete node_modules completely.
    echo Close Cursor/VS Code and any terminal in this folder, then run this script again.
    echo If the problem remains, run in admin CMD: chkdsk E: /F
    pause
    exit /b 1
  )
)

if exist "package-lock.json" (
  echo Keeping package-lock.json
)

call npm.cmd install
if errorlevel 1 (
  echo.
  echo [ERROR] npm install failed. Try running this file as Administrator,
  echo or close programs that may lock files in this folder.
  pause
  exit /b 1
)

echo.
echo Done. You can now run start-app.bat
pause
