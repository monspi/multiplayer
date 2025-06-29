# 多人在线网页游戏启动脚本
Write-Host "多人在线网页游戏启动器" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js 安装
Write-Host "检查 Node.js 安装..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>$null
    Write-Host "Node.js 已安装: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "错误：Node.js 未安装或未添加到 PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "请先安装 Node.js：" -ForegroundColor Yellow
    Write-Host "1. 访问 https://nodejs.org/"
    Write-Host "2. 下载并安装 LTS 版本"
    Write-Host "3. 重启 PowerShell 后再运行此脚本"
    Write-Host ""
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host ""

# 检查依赖包
Write-Host "检查依赖包..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "安装依赖包..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "依赖安装失败，请检查网络连接" -ForegroundColor Red
        Read-Host "按 Enter 键退出"
        exit 1
    }
} else {
    Write-Host "依赖包已存在" -ForegroundColor Green
}

Write-Host ""
Write-Host "启动游戏服务器..." -ForegroundColor Green
Write-Host "服务器将在 http://localhost:3000 启动" -ForegroundColor Yellow
Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Yellow
Write-Host ""

# 启动服务器
npm start
