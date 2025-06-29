@echo off
echo 多人在线网页游戏启动器
echo ========================

echo 检查 Node.js 安装...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误：Node.js 未安装或未添加到 PATH
    echo.
    echo 请先安装 Node.js：
    echo 1. 访问 https://nodejs.org/
    echo 2. 下载并安装 LTS 版本
    echo 3. 重启命令行后再运行此文件
    echo.
    pause
    exit /b 1
)

echo Node.js 已安装
echo.

echo 检查依赖包...
if not exist "node_modules" (
    echo 安装依赖包...
    npm install
    if %errorlevel% neq 0 (
        echo 依赖安装失败，请检查网络连接
        pause
        exit /b 1
    )
) else (
    echo 依赖包已存在
)

echo.
echo 启动游戏服务器...
echo 服务器将在 http://localhost:1666 启动
echo 按 Ctrl+C 停止服务器
echo.

npm start
