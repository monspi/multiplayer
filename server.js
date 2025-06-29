const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = config.server.port;

// 存储所有玩家数据
const players = {};

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 演示页面路由
app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});

// API路由 - 获取sprite列表
app.get('/api/sprites', (req, res) => {
    const fs = require('fs');
    const spritePath = path.join(__dirname, 'assets', 'sprite');
    
    try {
        const files = fs.readdirSync(spritePath);
        const spriteFiles = files.filter(file => file.endsWith('.png'));
        res.json(spriteFiles);
    } catch (error) {
        console.error('读取sprite文件夹失败:', error);
        res.status(500).json({ error: 'Failed to read sprite directory' });
    }
});

// API: 获取sprite列表
app.get('/api/sprites', (req, res) => {
    try {
        const spritePath = path.join(__dirname, 'assets', 'sprite');
        const files = fs.readdirSync(spritePath);
        const spriteFiles = files.filter(file => file.endsWith('.png'));
        res.json(spriteFiles);
    } catch (error) {
        console.error('读取sprite目录失败:', error);
        res.status(500).json({ error: '无法读取sprite目录' });
    }
});

// Socket.io 连接处理
io.on('connection', (socket) => {
    if (config.debug.logConnections) {
        console.log('新玩家连接:', socket.id);
    }

    // 玩家加入游戏
    socket.on('playerJoin', (playerData) => {
        // 检查玩家数量限制
        if (Object.keys(players).length >= config.game.maxPlayers) {
            socket.emit('gameError', { message: '游戏已满，请稍后再试' });
            return;
        }

        // 检查名字长度
        if (!playerData.name || playerData.name.length > config.game.playerNameMaxLength) {
            socket.emit('gameError', { message: '名字不符合要求' });
            return;
        }

        // 使用固定的大地图尺寸
        const worldWidth = config.game.worldWidth;
        const worldHeight = config.game.worldHeight;

        // 随机选择sprite图片
        const spritePath = path.join(__dirname, 'assets', 'sprite');
        const spriteFiles = fs.readdirSync(spritePath).filter(file => file.endsWith('.png'));
        const randomSprite = spriteFiles[Math.floor(Math.random() * spriteFiles.length)];

        // 创建新玩家对象
        players[socket.id] = {
            id: socket.id,
            name: playerData.name,
            x: Math.random() * (worldWidth - config.player.startPositionMargin * 2) + config.player.startPositionMargin,
            y: Math.random() * (worldHeight - config.player.startPositionMargin * 2) + config.player.startPositionMargin,
            spriteImage: randomSprite,
            size: 48, // sprite大小
            screenWidth: playerData.screenWidth || 1920,
            screenHeight: playerData.screenHeight || 1080,
            isOnline: true,
            lastActiveTime: Date.now()
        };

        if (config.debug.logConnections) {
            console.log(`玩家 ${playerData.name} 加入游戏 (屏幕: ${worldWidth}x${worldHeight})`);
        }

        // 向新玩家发送当前所有玩家信息
        socket.emit('currentPlayers', players);

        // 向其他玩家广播新玩家加入
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // 玩家移动
    socket.on('playerMove', (movementData) => {
        if (players[socket.id]) {
            const player = players[socket.id];
            
            // 更新玩家位置（添加边界检查）
            const newX = player.x + movementData.dx;
            const newY = player.y + movementData.dy;
            
            // 使用固定的地图尺寸进行边界检查
            const worldWidth = config.game.worldWidth;
            const worldHeight = config.game.worldHeight;
            
            player.x = Math.max(player.size/2, Math.min(worldWidth - player.size/2, newX));
            player.y = Math.max(player.size/2, Math.min(worldHeight - player.size/2, newY));
            player.lastActiveTime = Date.now(); // 更新活跃时间

            if (config.debug.logPlayerMovement) {
                console.log(`玩家 ${player.name} 移动到 (${player.x}, ${player.y})`);
            }

            // 广播玩家新位置给所有其他玩家
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: player.x,
                y: player.y
            });
        }
    });

    // 玩家断开连接
    socket.on('disconnect', () => {
        if (config.debug.logConnections) {
            console.log('玩家断开连接:', socket.id);
        }
        
        if (players[socket.id]) {
            if (config.debug.logConnections) {
                console.log(`玩家 ${players[socket.id].name} 离线，角色将保留10分钟`);
            }
            
            // 将玩家标记为离线，而不是删除
            players[socket.id].isOnline = false;
            players[socket.id].disconnectTime = Date.now();
            
            // 通知其他玩家此玩家离线（但角色仍在游戏中）
            socket.broadcast.emit('playerOffline', {
                id: socket.id,
                name: players[socket.id].name
            });
        }
    });
});

// 生成随机颜色
function getRandomColor() {
    return config.player.colors[Math.floor(Math.random() * config.player.colors.length)];
}

// 清理超时的离线玩家
function cleanupOfflinePlayers() {
    const now = Date.now();
    const OFFLINE_TIMEOUT = 10 * 60 * 1000; // 10分钟

    Object.keys(players).forEach(playerId => {
        const player = players[playerId];
        if (!player.isOnline && (now - player.disconnectTime) > OFFLINE_TIMEOUT) {
            if (config.debug.logConnections) {
                console.log(`清理超时玩家: ${player.name}`);
            }
            delete players[playerId];
            
            // 通知所有在线玩家，此玩家已被清理
            io.emit('playerLeft', playerId);
        }
    });
}

// 每分钟检查一次离线玩家
setInterval(cleanupOfflinePlayers, 60 * 1000);

server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
