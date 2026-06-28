@echo off
chcp 65001 >nul
title 智能待办 TodoList

cd /d "%~dp0\.."

echo.
echo ==========================================
echo   智能待办 TodoList - 一键启动
echo ==========================================
echo.

REM 1. 检查 node_modules
if not exist "node_modules" (
    echo [1/4] 安装依赖中（首次启动需要 1-2 分钟）...
    where bun >nul 2>nul
    if %errorlevel%==0 (
        call bun install
    ) else (
        call npm install
    )
    if %errorlevel% neq 0 (
        echo.
        echo [错误] 依赖安装失败，请检查网络或手动运行 npm install
        pause
        exit /b 1
    )
) else (
    echo [1/4] 依赖已安装 OK
)

REM 2. 检查数据库
set DB_EXISTS=0
if exist "prisma\db\custom.db" set DB_EXISTS=1
if exist "db\custom.db" set DB_EXISTS=1
if "%DB_EXISTS%"=="0" (
    echo [2/4] 初始化数据库中...
    call npx prisma db push
    if %errorlevel% neq 0 (
        echo.
        echo [错误] 数据库初始化失败
        pause
        exit /b 1
    )
) else (
    echo [2/4] 数据库已存在 OK
)

REM 3. 检查端口 3000
echo [3/4] 检查端口 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo       端口被占用，正在终止 PID %%a ...
    taskkill /PID %%a /F >nul 2>nul
)

REM 4. 启动开发服务器
echo [4/4] 启动开发服务器...
echo.
echo ==========================================
echo   启动后请在浏览器访问:
echo   http://localhost:3000
echo ==========================================
echo.
echo 按 Ctrl+C 停止服务器
echo.

where bun >nul 2>nul
if %errorlevel%==0 (
    call bun run dev
) else (
    call npx next dev -p 3000
)

pause
