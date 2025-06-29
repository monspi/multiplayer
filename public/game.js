// 游戏变量
let socket;
let canvas;
let ctx;
let players = {};
let currentPlayer = null;
let keys = {};

// 触摸/鼠标控制变量
let isDragging = false;
let lastTouchX = 0;
let lastTouchY = 0;
let virtualJoystick = {
    active: false,
    centerX: 0,
    centerY: 0,
    currentX: 0,
    currentY: 0,
    maxDistance: 60,  // 增加摇杆范围
    deadZone: 8       // 死区大小
};

// 地图和摄像头配置
const WORLD_WIDTH = 4800;  // 48的倍数
const WORLD_HEIGHT = 3600; // 48的倍数
const GRID_SIZE = 48;
let camera = {
    x: 0,
    y: 0
};

// Sprite配置
const SPRITE_SIZE = 48;
let spriteImages = {};
let spriteList = [];
let imagesLoaded = 0;
let totalImages = 0;

// 背景配置
let backgroundImages = {};
let backgroundList = [];
const BACKGROUND_TILE_SIZE = 48; // 假设背景瓦片大小为48像素

// 游戏配置
const MOVE_SPEED = 4;

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // 设置Canvas为全屏尺寸
    resizeCanvas();
    
    // 加载sprite和背景图片
    loadGameAssets();
    
    // 监听窗口大小变化
    window.addEventListener('resize', resizeCanvas);
    
    // 监听键盘事件
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // 添加触摸和鼠标事件监听
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // 监听回车键加入游戏
    document.getElementById('playerName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinGame();
        }
    });
});

// 加载sprite图片
async function loadSpriteImages() {
    try {
        // 获取sprite文件列表
        const response = await fetch('/api/sprites');
        const sprites = await response.json();
        
        spriteList = sprites;
        totalImages += sprites.length;
        
        // 加载每个sprite图片
        sprites.forEach((spriteName, index) => {
            const img = new Image();
            img.onload = () => {
                imagesLoaded++;
                console.log(`已加载sprite: ${spriteName} (${imagesLoaded}/${totalImages})`);
            };
            img.onerror = () => {
                console.error(`加载sprite失败: ${spriteName}`);
                imagesLoaded++;
            };
            img.src = `/assets/sprite/${spriteName}`;
            spriteImages[spriteName] = img;
        });
    } catch (error) {
        console.error('获取sprite列表失败:', error);
    }
}

// 加载背景图片
async function loadBackgroundImages() {
    try {
        // 获取背景图片文件列表
        const response = await fetch('/api/backgrounds');
        const backgrounds = await response.json();
        
        backgroundList = backgrounds;
        totalImages += backgrounds.length;
        
        // 加载每个背景图片
        backgrounds.forEach((backgroundName) => {
            const img = new Image();
            img.onload = () => {
                imagesLoaded++;
                console.log(`已加载背景: ${backgroundName} (${imagesLoaded}/${totalImages})`);
            };
            img.onerror = () => {
                console.error(`加载背景失败: ${backgroundName}`);
                imagesLoaded++;
            };
            img.src = `/assets/background/${backgroundName}`;
            backgroundImages[backgroundName] = img;
        });
    } catch (error) {
        console.error('获取背景列表失败:', error);
    }
}

// 加载游戏资源（sprites和背景）
async function loadGameAssets() {
    imagesLoaded = 0;
    totalImages = 0;
    
    // 并行加载sprite和背景图片
    await Promise.all([
        loadSpriteImages(),
        loadBackgroundImages()
    ]);
}

// 调整Canvas尺寸为全屏
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// 更新摄像头位置
function updateCamera() {
    if (!currentPlayer) return;
    
    // 摄像头跟随玩家，玩家保持在屏幕中心
    camera.x = currentPlayer.x - canvas.width / 2;
    camera.y = currentPlayer.y - canvas.height / 2;
    
    // 限制摄像头边界，确保不超出地图边界
    camera.x = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, camera.x));
    camera.y = Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, camera.y));
}

// 加入游戏
function joinGame() {
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!playerName) {
        alert('请输入你的名字！');
        return;
    }
    
    if (playerName.length > 15) {
        alert('名字太长了，请限制在15个字符以内！');
        return;
    }
    
    // 连接到服务器
    socket = io();
    
    // 设置Socket事件监听
    setupSocketEvents();
    
    // 发送加入游戏请求，包含屏幕尺寸信息
    socket.emit('playerJoin', { 
        name: playerName,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight
    });
    
    // 切换到游戏界面
    document.getElementById('loginScreen').style.display = 'none';
    const gameScreen = document.getElementById('gameScreen');
    gameScreen.style.display = 'block';
    
    // 重置body样式以适应全屏游戏
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    
    document.getElementById('currentPlayerName').textContent = playerName;
    
    // 确保Canvas尺寸正确
    resizeCanvas();
    
    // 开始游戏循环
    gameLoop();
}

// 设置Socket事件监听
function setupSocketEvents() {
    // 接收当前所有玩家信息
    socket.on('currentPlayers', (serverPlayers) => {
        players = serverPlayers;
        currentPlayer = players[socket.id];
        updatePlayerCount();
    });
    
    // 新玩家加入
    socket.on('newPlayer', (newPlayer) => {
        players[newPlayer.id] = newPlayer;
        updatePlayerCount();
        console.log(`玩家 ${newPlayer.name} 加入了游戏`);
    });
    
    // 玩家移动
    socket.on('playerMoved', (data) => {
        if (players[data.id]) {
            players[data.id].x = data.x;
            players[data.id].y = data.y;
        }
    });
    
    // 玩家离开
    socket.on('playerLeft', (playerId) => {
        if (players[playerId]) {
            console.log(`玩家 ${players[playerId].name} 离开了游戏`);
            delete players[playerId];
            updatePlayerCount();
        }
    });
    
    // 玩家离线（角色仍保留）
    socket.on('playerOffline', (data) => {
        if (players[data.id]) {
            players[data.id].isOnline = false;
            console.log(`玩家 ${data.name} 离线，角色保留中...`);
            updatePlayerCount();
        }
    });
    
    // 游戏错误
    socket.on('gameError', (error) => {
        alert(error.message);
        // 返回登录界面并重置样式
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('gameScreen').style.display = 'none';
        document.body.style.overflow = 'auto';
        socket.disconnect();
    });
    
    // 连接断开
    socket.on('disconnect', () => {
        console.log('与服务器连接断开');
    });
}

// 键盘按下事件
function handleKeyDown(e) {
    keys[e.key] = true;
    
    // 防止方向键和WASD滚动页面
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(e.key)) {
        e.preventDefault();
    }
}

// 键盘释放事件
function handleKeyUp(e) {
    keys[e.key] = false;
}

// 处理玩家移动
function handleMovement() {
    if (!currentPlayer || !socket) return;
    
    let dx = 0;
    let dy = 0;
    
    // 方向键移动
    if (keys['ArrowLeft']) dx -= MOVE_SPEED;
    if (keys['ArrowRight']) dx += MOVE_SPEED;
    if (keys['ArrowUp']) dy -= MOVE_SPEED;
    if (keys['ArrowDown']) dy += MOVE_SPEED;
    
    // WASD移动
    if (keys['a'] || keys['A']) dx -= MOVE_SPEED;
    if (keys['d'] || keys['D']) dx += MOVE_SPEED;
    if (keys['w'] || keys['W']) dy -= MOVE_SPEED;
    if (keys['s'] || keys['S']) dy += MOVE_SPEED;
    
    // 处理虚拟摇杆移动（拖拽移动）
    if (virtualJoystick.active) {
        const deltaX = virtualJoystick.currentX - virtualJoystick.centerX;
        const deltaY = virtualJoystick.currentY - virtualJoystick.centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > virtualJoystick.deadZone) { // 使用配置的死区
            const normalizedX = deltaX / distance;
            const normalizedY = deltaY / distance;
            const intensity = Math.min(distance / virtualJoystick.maxDistance, 1);
            
            dx += normalizedX * MOVE_SPEED * intensity * 1.2; // 稍微增加灵敏度
            dy += normalizedY * MOVE_SPEED * intensity * 1.2;
        }
    }
    
    // 如果有移动，发送给服务器
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        socket.emit('playerMove', { dx, dy });
        
        // 本地立即更新（减少延迟感）
        const newX = currentPlayer.x + dx;
        const newY = currentPlayer.y + dy;
        const spriteHalfSize = SPRITE_SIZE / 2;
        
        currentPlayer.x = Math.max(spriteHalfSize, Math.min(WORLD_WIDTH - spriteHalfSize, newX));
        currentPlayer.y = Math.max(spriteHalfSize, Math.min(WORLD_HEIGHT - spriteHalfSize, newY));
    }
}

// 鼠标事件处理
function handleMouseDown(e) {
    if (!currentPlayer) return;
    
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    lastTouchX = e.clientX - rect.left;
    lastTouchY = e.clientY - rect.top;
    
    // 设置虚拟摇杆
    virtualJoystick.active = true;
    virtualJoystick.centerX = lastTouchX;
    virtualJoystick.centerY = lastTouchY;
    virtualJoystick.currentX = lastTouchX;
    virtualJoystick.currentY = lastTouchY;
    
    e.preventDefault();
}

function handleMouseMove(e) {
    if (!isDragging || !currentPlayer) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // 限制摇杆把手在最大距离内
    const deltaX = currentX - virtualJoystick.centerX;
    const deltaY = currentY - virtualJoystick.centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance <= virtualJoystick.maxDistance) {
        virtualJoystick.currentX = currentX;
        virtualJoystick.currentY = currentY;
    } else {
        // 限制在圆周上
        const angle = Math.atan2(deltaY, deltaX);
        virtualJoystick.currentX = virtualJoystick.centerX + Math.cos(angle) * virtualJoystick.maxDistance;
        virtualJoystick.currentY = virtualJoystick.centerY + Math.sin(angle) * virtualJoystick.maxDistance;
    }
    
    e.preventDefault();
}

function handleMouseUp(e) {
    isDragging = false;
    virtualJoystick.active = false;
    e.preventDefault();
}

// 触摸事件处理
function handleTouchStart(e) {
    if (!currentPlayer) return;
    
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    lastTouchX = touch.clientX - rect.left;
    lastTouchY = touch.clientY - rect.top;
    
    // 设置虚拟摇杆
    virtualJoystick.active = true;
    virtualJoystick.centerX = lastTouchX;
    virtualJoystick.centerY = lastTouchY;
    virtualJoystick.currentX = lastTouchX;
    virtualJoystick.currentY = lastTouchY;
    
    e.preventDefault();
}

function handleTouchMove(e) {
    if (!isDragging || !currentPlayer) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;
    
    // 限制摇杆把手在最大距离内
    const deltaX = currentX - virtualJoystick.centerX;
    const deltaY = currentY - virtualJoystick.centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance <= virtualJoystick.maxDistance) {
        virtualJoystick.currentX = currentX;
        virtualJoystick.currentY = currentY;
    } else {
        // 限制在圆周上
        const angle = Math.atan2(deltaY, deltaX);
        virtualJoystick.currentX = virtualJoystick.centerX + Math.cos(angle) * virtualJoystick.maxDistance;
        virtualJoystick.currentY = virtualJoystick.centerY + Math.sin(angle) * virtualJoystick.maxDistance;
    }
    
    e.preventDefault();
}

function handleTouchEnd(e) {
    isDragging = false;
    virtualJoystick.active = false;
    e.preventDefault();
}

// 渲染游戏
function render() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 保存当前变换状态
    ctx.save();
    
    // 应用摄像头变换
    ctx.translate(-camera.x, -camera.y);
    
    // 绘制地图背景
    drawBackground();
    
    // 绘制背景网格
    drawGrid();
    
    // 绘制地图边界
    drawMapBounds();
    
    // 绘制所有玩家
    Object.values(players).forEach(player => {
        drawPlayer(player);
    });
    
    // 恢复变换状态
    ctx.restore();
    
    // 绘制UI元素（不受摄像头影响）
    drawUI();
    
    // 绘制虚拟摇杆（如果激活）
    drawVirtualJoystick();
    
    // 绘制触摸提示（仅在移动端）
    if (isMobileDevice()) {
        drawMobileTouchHint();
    }
}

// 检测是否为移动设备
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

// 绘制移动端触摸提示
function drawMobileTouchHint() {
    if (virtualJoystick.active || !currentPlayer) return;
    
    // 只在游戏刚开始时显示提示
    const gameStartTime = 10000; // 10秒后隐藏提示
    if (currentPlayer.joinTime && Date.now() - currentPlayer.joinTime > gameStartTime) return;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = '16px VonwaonBitmap, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('拖拽屏幕移动角色', canvas.width / 2, canvas.height - 50);
}

// 绘制地图背景
function drawBackground() {
    if (backgroundList.length === 0) {
        // 如果没有背景图片，绘制默认背景色
        ctx.fillStyle = '#87CEEB'; // 天蓝色
        ctx.fillRect(Math.max(0, camera.x), Math.max(0, camera.y), 
                    Math.min(WORLD_WIDTH - camera.x, canvas.width), 
                    Math.min(WORLD_HEIGHT - camera.y, canvas.height));
        return;
    }
    
    // 计算可见区域，稍微扩大以避免边缘空白
    const padding = BACKGROUND_TILE_SIZE;
    const startX = Math.floor((camera.x - padding) / BACKGROUND_TILE_SIZE) * BACKGROUND_TILE_SIZE;
    const endX = Math.ceil((camera.x + canvas.width + padding) / BACKGROUND_TILE_SIZE) * BACKGROUND_TILE_SIZE;
    const startY = Math.floor((camera.y - padding) / BACKGROUND_TILE_SIZE) * BACKGROUND_TILE_SIZE;
    const endY = Math.ceil((camera.y + canvas.height + padding) / BACKGROUND_TILE_SIZE) * BACKGROUND_TILE_SIZE;
    
    // 平铺背景图片
    for (let x = startX; x < endX; x += BACKGROUND_TILE_SIZE) {
        for (let y = startY; y < endY; y += BACKGROUND_TILE_SIZE) {
            // 确保不超出地图边界
            if (x >= 0 && y >= 0 && x < WORLD_WIDTH && y < WORLD_HEIGHT) {
                // 使用位置计算选择背景图片，实现伪随机平铺
                const tileIndex = (Math.floor(x / BACKGROUND_TILE_SIZE) + Math.floor(y / BACKGROUND_TILE_SIZE)) % backgroundList.length;
                const backgroundName = backgroundList[tileIndex];
                const backgroundImg = backgroundImages[backgroundName];
                
                if (backgroundImg && backgroundImg.complete) {
                    // 计算实际绘制尺寸，处理边界情况
                    const drawWidth = Math.min(BACKGROUND_TILE_SIZE, WORLD_WIDTH - x);
                    const drawHeight = Math.min(BACKGROUND_TILE_SIZE, WORLD_HEIGHT - y);
                    
                    ctx.drawImage(backgroundImg, x, y, drawWidth, drawHeight);
                } else {
                    // 如果图片未加载，绘制默认瓦片颜色
                    ctx.fillStyle = '#90EE90'; // 浅绿色
                    const drawWidth = Math.min(BACKGROUND_TILE_SIZE, WORLD_WIDTH - x);
                    const drawHeight = Math.min(BACKGROUND_TILE_SIZE, WORLD_HEIGHT - y);
                    ctx.fillRect(x, y, drawWidth, drawHeight);
                }
            }
        }
    }
}

// 绘制虚拟摇杆
function drawVirtualJoystick() {
    if (!virtualJoystick.active) return;
    
    // 绘制摇杆底盘（外圈）
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.arc(virtualJoystick.centerX, virtualJoystick.centerY, virtualJoystick.maxDistance, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 绘制死区指示圈
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(virtualJoystick.centerX, virtualJoystick.centerY, virtualJoystick.deadZone, 0, Math.PI * 2);
    ctx.stroke();
    
    // 绘制摇杆把手（内圈）
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(virtualJoystick.currentX, virtualJoystick.currentY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // 重置透明度
    ctx.globalAlpha = 1.0;
}

// 绘制背景网格
function drawGrid() {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    
    // 计算可见区域
    const startX = Math.floor(camera.x / GRID_SIZE) * GRID_SIZE;
    const endX = Math.min(WORLD_WIDTH, camera.x + canvas.width + GRID_SIZE);
    const startY = Math.floor(camera.y / GRID_SIZE) * GRID_SIZE;
    const endY = Math.min(WORLD_HEIGHT, camera.y + canvas.height + GRID_SIZE);
    
    // 绘制垂直线
    for (let x = startX; x <= endX; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, Math.max(0, camera.y));
        ctx.lineTo(x, Math.min(WORLD_HEIGHT, camera.y + canvas.height));
        ctx.stroke();
    }
    
    // 绘制水平线
    for (let y = startY; y <= endY; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(Math.max(0, camera.x), y);
        ctx.lineTo(Math.min(WORLD_WIDTH, camera.x + canvas.width), y);
        ctx.stroke();
    }
}

// 绘制地图边界
function drawMapBounds() {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

// 绘制UI元素（不受摄像头影响）
function drawUI() {
    // 绘制小地图
    drawMiniMap();
}

// 绘制小地图
function drawMiniMap() {
    const miniMapSize = 150;
    const miniMapX = canvas.width - miniMapSize - 20;
    const miniMapY = 20;
    
    // 绘制小地图背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(miniMapX, miniMapY, miniMapSize, miniMapSize);
    
    // 绘制小地图边框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(miniMapX, miniMapY, miniMapSize, miniMapSize);
    
    // 计算缩放比例
    const scaleX = miniMapSize / WORLD_WIDTH;
    const scaleY = miniMapSize / WORLD_HEIGHT;
    
    // 绘制玩家在小地图上
    Object.values(players).forEach(player => {
        const x = miniMapX + player.x * scaleX;
        const y = miniMapY + player.y * scaleY;
        
        // 在小地图上用简单的方块表示玩家
        if (player.id === currentPlayer?.id) {
            ctx.fillStyle = '#ffffff';
        } else if (player.isOnline === false) {
            ctx.fillStyle = '#888888';
        } else {
            // 为在线玩家使用与描边相同的随机颜色
            const hash = player.id.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            const hue = Math.abs(hash) % 360;
            ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        }
        
        ctx.fillRect(x - 2, y - 2, 4, 4);
    });
    
    // 绘制摄像头视野框
    const viewX = miniMapX + camera.x * scaleX;
    const viewY = miniMapY + camera.y * scaleY;
    const viewW = canvas.width * scaleX;
    const viewH = canvas.height * scaleY;
    
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.strokeRect(viewX, viewY, viewW, viewH);
}

// 绘制玩家
function drawPlayer(player) {
    const isCurrentPlayer = currentPlayer && player.id === currentPlayer.id;
    const isOffline = player.isOnline === false;
    
    // 为在线角色添加随机颜色描边
    if (!isOffline) {
        // 生成基于玩家ID的稳定随机颜色
        const hash = player.id.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        const hue = Math.abs(hash) % 360;
        const strokeColor = `hsl(${hue}, 70%, 50%)`;
        
        // 设置描边透明度为0.6
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        const halfSize = SPRITE_SIZE / 2;
        ctx.strokeRect(player.x - halfSize - 2, player.y - halfSize - 2, SPRITE_SIZE + 4, SPRITE_SIZE + 4);
        // 重置透明度
        ctx.globalAlpha = 1.0;
    }
    
    // 绘制玩家sprite图片
    if (player.spriteImage && spriteImages[player.spriteImage]) {
        const img = spriteImages[player.spriteImage];
        if (img.complete) {
            const halfSize = SPRITE_SIZE / 2;
            ctx.drawImage(img, player.x - halfSize, player.y - halfSize, SPRITE_SIZE, SPRITE_SIZE);
        }
    } else {
        // 如果图片未加载，绘制默认方块
        ctx.fillStyle = '#888';
        const halfSize = SPRITE_SIZE / 2;
        ctx.fillRect(player.x - halfSize, player.y - halfSize, SPRITE_SIZE, SPRITE_SIZE);
    }
    
    // 绘制玩家名字
    ctx.fillStyle = isOffline ? '#888' : '#333';
    ctx.font = isOffline ? '12px VonwaonBitmap, monospace' : '16px VonwaonBitmap, monospace';
    ctx.textAlign = 'center';
    let nameText = player.name;
    if (isOffline) {
        nameText += ' (离线)';
    }
    ctx.fillText(nameText, player.x, player.y - SPRITE_SIZE/2 - 8);
    
    // 如果是当前玩家，在名字下方添加指示
    if (isCurrentPlayer) {
        ctx.fillStyle = '#666';
        ctx.font = '14px VonwaonBitmap, monospace';
        ctx.fillText('(你)', player.x, player.y + SPRITE_SIZE/2 + 18);
    }
}

// 更新玩家数量显示
function updatePlayerCount() {
    const totalPlayers = Object.keys(players).length;
    const onlinePlayers = Object.values(players).filter(player => player.isOnline !== false).length;
    const offlinePlayers = totalPlayers - onlinePlayers;
    
    let countText = `在线: ${onlinePlayers}`;
    if (offlinePlayers > 0) {
        countText += ` | 离线: ${offlinePlayers}`;
    }
    
    document.getElementById('playerCount').innerHTML = countText;
}

// 游戏主循环
function gameLoop() {
    handleMovement();
    updateCamera();
    render();
    requestAnimationFrame(gameLoop);
}

// 页面关闭时断开连接
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.disconnect();
    }
});
