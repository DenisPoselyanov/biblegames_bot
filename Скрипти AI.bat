@echo off
REM Миттєво запускає GUI і закриває це вікно (без очікування python)
cd /d "%~dp0"
wscript.exe //B //Nologo "%~dp0scripts\launch-ai-gui.vbs"
exit /b 0
