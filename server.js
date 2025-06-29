const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const config = require('./config');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = config.server.port;

// 存储所有玩家数据
const players = {};

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 演示页面路由
app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'demo.html'));
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

        // 创建新玩家对象
        players[socket.id] = {
            id: socket.id,
            name: playerData.name,
            x: Math.random() * (config.game.worldWidth - config.player.startPositionMargin * 2) + config.player.startPositionMargin,
            y: Math.random() * (config.game.worldHeight - config.player.startPositionMargin * 2) + config.player.startPositionMargin,
            color: getRandomColor(),
            size: config.game.playerSize
        };

        if (config.debug.logConnections) {
            console.log(`玩家 ${playerData.name} 加入游戏`);
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
            
            player.x = Math.max(player.size/2, Math.min(config.game.worldWidth - player.size/2, newX));
            player.y = Math.max(player.size/2, Math.min(config.game.worldHeight - player.size/2, newY));

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
                console.log(`玩家 ${players[socket.id].name} 离开游戏`);
            }
            delete players[socket.id];
            
            // 通知其他玩家有人离开
            socket.broadcast.emit('playerLeft', socket.id);
        }
    });
});

// 生成随机颜色
function getRandomColor() {
    return config.player.colors[Math.floor(Math.random() * config.player.colors.length)];
}

server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
