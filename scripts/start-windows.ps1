# 智能待办 TodoList - Windows 一键启动脚本
# 双击运行即可，无需手动输入命令

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ProjectDir

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  智能待办 TodoList - 一键启动" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "[1/4] 安装依赖中（首次启动需要 1-2 分钟）..." -ForegroundColor Yellow
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        bun install
    } else {
        npm install
    }
} else {
    Write-Host "[1/4] 依赖已安装 ✓" -ForegroundColor Green
}

# 2. 检查数据库
$dbPaths = @("prisma\db\custom.db", "db\custom.db")
$dbExists = $false
foreach ($p in $dbPaths) {
    if (Test-Path $p) { $dbExists = $true; break }
}
if (-not $dbExists) {
    Write-Host "[2/4] 初始化数据库中..." -ForegroundColor Yellow
    npx prisma db push
} else {
    Write-Host "[2/4] 数据库已存在 ✓" -ForegroundColor Green
}

# 3. 检查端口 3001 是否被占用
Write-Host "[3/4] 检查端口 3001..." -ForegroundColor Yellow
$portInUse = $false
try {
    $conn = Get-NetTCPConnection -LocalPort 3001 -ErrorAction Stop
    if ($conn) {
        $portInUse = $true
        Write-Host "      端口 3001 被占用，正在释放..." -ForegroundColor Yellow
        $pids = $conn.OwningProcess | Sort-Object -Unique
        foreach ($pid in $pids) {
            try {
                $proc = Get-Process -Id $pid -ErrorAction Stop
                Write-Host "      终止进程: $($proc.ProcessName) (PID: $pid)" -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction Stop
            } catch {
                Write-Host "      无法终止 PID $pid，跳过" -ForegroundColor DarkYellow
            }
        }
        Start-Sleep -Seconds 1
    }
} catch {
    # 端口未被占用，正常
}
if (-not $portInUse) {
    Write-Host "      端口 3001 空闲 ✓" -ForegroundColor Green
}

# 4. 启动开发服务器
Write-Host "[4/4] 启动开发服务器..." -ForegroundColor Yellow
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  启动后请在浏览器访问:" -ForegroundColor White
Write-Host "  http://localhost:3001" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor DarkGray
Write-Host ""

# 优先用 bun，没有就用 npx next
if (Get-Command bun -ErrorAction SilentlyContinue) {
    bun run dev
} else {
    npx next dev -p 3001
}
