@echo off
chcp 65001 >nul
title Disable TodoList Auto-Start

echo.
echo ==========================================
echo   Disable TodoList Auto-Start
echo ==========================================
echo.

schtasks /query /tn "TodoListAutoStart" >nul 2>nul
if %errorlevel% equ 0 (
    echo [1/2] Removing auto-start task...
    schtasks /delete /tn "TodoListAutoStart" /f >nul
    if %errorlevel% equ 0 (
        echo       Done.
    ) else (
        echo       [ERROR] Failed. Run as administrator.
        pause
        exit /b 1
    )
) else (
    echo [1/2] No auto-start task found (already disabled).
)

echo.
echo [2/2] Also stop running server? (Y/N)
choice /c yn /n /m "(Y/N): "
if %errorlevel%==1 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
        echo       Killing PID %%a
        taskkill /PID %%a /F >nul 2>nul
    )
    echo       Stopped.
)

echo.
echo ==========================================
echo   Auto-start disabled.
echo ==========================================
pause
