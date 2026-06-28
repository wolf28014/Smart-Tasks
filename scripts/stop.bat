@echo off
chcp 65001 >nul
title 停止 TodoList 服务器

echo.
echo ==========================================
echo   停止 TodoList 开发服务器
echo ==========================================
echo.

set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo 终止进程 PID %%a ...
    taskkill /PID %%a /F >nul 2>nul
    if %errorlevel%==0 (
        echo   已终止 OK
        set FOUND=1
    )
)

if "%FOUND%"=="0" (
    echo 端口 3000 没有运行中的服务器
)

echo.
echo 完成。
pause
