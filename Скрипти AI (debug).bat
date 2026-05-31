@echo off
REM Запуск launcher з видимою консоллю (для діагностики, якщо .vbs не показує вікно)
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python не знайдено. Встановіть з python.org
  pause
  exit /b 1
)
python "%~dp0scripts\launch-ai-gui.py"
echo.
echo Exit code: %ERRORLEVEL%
pause
