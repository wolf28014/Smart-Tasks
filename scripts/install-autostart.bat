@echo off
chcp 65001 >nul
title 设置 TodoList 开机自启

cd /d "%~dp0\.."

echo.
echo ==========================================
echo   TodoList - Enable Auto-Start on Boot
echo ==========================================
echo.

set PROJECT_DIR=%CD%
set VBS_PATH=%PROJECT_DIR%\scripts\start-silent.vbs

echo Project: %PROJECT_DIR%
echo Launcher: %VBS_PATH%
echo.

if not exist "%VBS_PATH%" (
    echo [ERROR] VBS file not found: %VBS_PATH%
    pause
    exit /b 1
)

REM Remove existing task if present
schtasks /query /tn "TodoListAutoStart" >nul 2>nul
if %errorlevel% equ 0 (
    echo [1/2] Removing old task...
    schtasks /delete /tn "TodoListAutoStart" /f >nul 2>nul
)

REM Register new task (onlogon = when user logs in)
echo [2/2] Registering auto-start task...
schtasks /create /tn "TodoListAutoStart" /tr "wscript.exe \"%VBS_PATH%\"" /sc onlogon /f >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to register task.
    echo Please right-click this .bat file and choose "Run as administrator"
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Success! Auto-start is now enabled.
echo ==========================================
echo.
echo Next steps:
echo   - Server will auto-start on next login (no window)
echo   - Visit http://localhost:3001 after login
echo   - Log file: %PROJECT_DIR%\dev.log
echo.
echo Start now? Press Y to launch, any other key to exit.
choice /c yn /n /m "(Y/N): "
if %errorlevel%==1 (
    echo.
    echo Launching in background...
    wscript.exe "%VBS_PATH%"
    echo Waiting 5 seconds for server to start...
    timeout /t 5 /nobreak >nul
    echo.
    echo Now try opening http://localhost:3001 in your browser
)

echo.
pause
