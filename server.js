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

// 数据持久化配置
const DATA_FILE_PATH = path.join(__dirname, 'data', 'offline_players.json');
const DATA_BACKUP_PATH = path.join(__dirname, 'data', 'offline_players_backup.json');
const SAVE_INTERVAL = 30 * 1000; // 每30秒保存一次离线玩家数据

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

// API路由 - 获取背景图片列表
app.get('/api/backgrounds', (req, res) => {
    const backgroundPath = path.join(__dirname, 'assets', 'background');
    
    try {
        const files = fs.readdirSync(backgroundPath);
        const backgroundFiles = files.filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'));
        res.json(backgroundFiles);
    } catch (error) {
        console.error('读取background文件夹失败:', error);
        res.status(500).json({ error: 'Failed to read background directory' });
    }
});

// API路由 - 获取当前在线人数
app.get('/api/online-count', (req, res) => {
    const totalPlayers = Object.keys(players).length;
    const onlinePlayers = Object.values(players).filter(player => player.isOnline !== false).length;
    const offlinePlayers = totalPlayers - onlinePlayers;
    
    res.json({
        online: onlinePlayers,
        offline: offlinePlayers,
        total: totalPlayers
    });
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
            lastActiveTime: Date.now(),
            joinTime: Date.now() // 添加加入时间用于移动端提示
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
                console.log(`玩家 ${players[socket.id].name} 离线，角色将保留4小时`);
            }
            
            // 将玩家标记为离线，而不是删除
            players[socket.id].isOnline = false;
            players[socket.id].disconnectTime = Date.now();
            
            // 立即保存离线玩家数据
            saveOfflinePlayersData();
            
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

// 数据持久化函数
function ensureDataDirectory() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('📁 创建数据目录:', dataDir);
    }
}

// 保存离线玩家数据
function saveOfflinePlayersData() {
    try {
        ensureDataDirectory();
        
        // 只保存离线玩家的数据
        const offlinePlayers = {};
        Object.keys(players).forEach(playerId => {
            const player = players[playerId];
            if (!player.isOnline) {
                offlinePlayers[playerId] = {
                    ...player,
                    savedAt: Date.now() // 记录保存时间
                };
            }
        });
        
        const dataToSave = {
            players: offlinePlayers,
            lastSaved: Date.now(),
            version: '1.0'
        };
        
        // 创建备份（如果原文件存在）
        if (fs.existsSync(DATA_FILE_PATH)) {
            fs.copyFileSync(DATA_FILE_PATH, DATA_BACKUP_PATH);
        }
        
        // 保存新数据
        fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(dataToSave, null, 2));
        
        const offlineCount = Object.keys(offlinePlayers).length;
        if (offlineCount > 0) {
            console.log(`💾 已保存 ${offlineCount} 个离线玩家数据`);
        }
    } catch (error) {
        console.error('❌ 保存离线玩家数据失败:', error);
    }
}

// 加载离线玩家数据
function loadOfflinePlayersData() {
    try {
        ensureDataDirectory();
        
        if (!fs.existsSync(DATA_FILE_PATH)) {
            console.log('📄 未找到离线玩家数据文件，将创建新文件');
            return;
        }
        
        const data = fs.readFileSync(DATA_FILE_PATH, 'utf8');
        const savedData = JSON.parse(data);
        
        if (!savedData.players) {
            console.log('📄 数据文件格式无效');
            return;
        }
        
        const now = Date.now();
        const OFFLINE_TIMEOUT = 4 * 60 * 60 * 1000; // 4小时
        let loadedCount = 0;
        let expiredCount = 0;
        
        // 加载未过期的离线玩家
        Object.keys(savedData.players).forEach(playerId => {
            const player = savedData.players[playerId];
            
            // 检查是否过期（从断开连接时间算起）
            if (player.disconnectTime && (now - player.disconnectTime) <= OFFLINE_TIMEOUT) {
                players[playerId] = {
                    ...player,
                    isOnline: false // 确保标记为离线
                };
                loadedCount++;
            } else {
                expiredCount++;
            }
        });
        
        console.log(`📂 已加载 ${loadedCount} 个离线玩家数据`);
        if (expiredCount > 0) {
            console.log(`🗑️  清理了 ${expiredCount} 个过期的离线玩家数据`);
        }
        
        // 立即保存一次以清理过期数据
        if (expiredCount > 0) {
            saveOfflinePlayersData();
        }
        
    } catch (error) {
        console.error('❌ 加载离线玩家数据失败:', error);
        
        // 尝试从备份文件恢复
        if (fs.existsSync(DATA_BACKUP_PATH)) {
            console.log('🔄 尝试从备份文件恢复...');
            try {
                fs.copyFileSync(DATA_BACKUP_PATH, DATA_FILE_PATH);
                loadOfflinePlayersData(); // 递归调用重新加载
            } catch (backupError) {
                console.error('❌ 从备份恢复也失败了:', backupError);
            }
        }
    }
}

// 清理超时的离线玩家
function cleanupOfflinePlayers() {
    const now = Date.now();
    const OFFLINE_TIMEOUT = 4 * 60 * 60 * 1000; // 4小时
    let cleanedCount = 0;

    Object.keys(players).forEach(playerId => {
        const player = players[playerId];
        if (!player.isOnline && (now - player.disconnectTime) > OFFLINE_TIMEOUT) {
            if (config.debug.logConnections) {
                console.log(`清理超时玩家: ${player.name}`);
            }
            delete players[playerId];
            cleanedCount++;
            
            // 通知所有在线玩家，此玩家已被清理
            io.emit('playerLeft', playerId);
        }
    });
    
    // 如果清理了玩家，立即保存数据
    if (cleanedCount > 0) {
        saveOfflinePlayersData();
        console.log(`🗑️  已清理 ${cleanedCount} 个超时的离线玩家`);
    }
}

// 每分钟检查一次离线玩家
setInterval(cleanupOfflinePlayers, 60 * 1000);

// 数据持久化 - 保存离线玩家数据
function saveOfflinePlayers() {
    const offlinePlayers = Object.values(players).filter(player => !player.isOnline);
    if (offlinePlayers.length === 0) {
        return; // 没有离线玩家，无需保存
    }

    const dataToSave = offlinePlayers.map(player => ({
        id: player.id,
        name: player.name,
        x: player.x,
        y: player.y,
        spriteImage: player.spriteImage,
        size: player.size,
        screenWidth: player.screenWidth,
        screenHeight: player.screenHeight,
        disconnectTime: player.disconnectTime
    }));

    fs.writeFile(DATA_FILE_PATH, JSON.stringify(dataToSave), (err) => {
        if (err) {
            console.error('保存离线玩家数据失败:', err);
        } else {
            console.log('离线玩家数据已保存');
        }
    });
}

// 数据持久化 - 加载离线玩家数据
function loadOfflinePlayers() {
    if (!fs.existsSync(DATA_FILE_PATH)) {
        return; // 数据文件不存在，跳过加载
    }

    fs.readFile(DATA_FILE_PATH, (err, data) => {
        if (err) {
            console.error('加载离线玩家数据失败:', err);
            return;
        }

        try {
            const loadedPlayers = JSON.parse(data);
            loadedPlayers.forEach(playerData => {
                // 重新创建玩家对象，但不再是在线状态
                players[playerData.id] = {
                    id: playerData.id,
                    name: playerData.name,
                    x: playerData.x,
                    y: playerData.y,
                    spriteImage: playerData.spriteImage,
                    size: playerData.size,
                    screenWidth: playerData.screenWidth,
                    screenHeight: playerData.screenHeight,
                    isOnline: false,
                    lastActiveTime: Date.now(),
                    joinTime: Date.now() // 重新加入时更新加入时间
                };
            });

            console.log('离线玩家数据已加载');
        } catch (parseErr) {
            console.error('解析离线玩家数据失败:', parseErr);
        }
    });
}

// 每分钟检查一次离线玩家
setInterval(cleanupOfflinePlayers, 60 * 1000);

// 启动时加载离线玩家数据
loadOfflinePlayersData();

// 定时保存离线玩家数据
setInterval(saveOfflinePlayersData, SAVE_INTERVAL);

server.listen(PORT, () => {
    console.log(`🎮 异世界创造家/Isekai Maker 服务器运行在 http://localhost:${PORT}`);
    console.log(`💾 数据保存间隔: ${SAVE_INTERVAL / 1000}秒`);
    console.log(`📁 数据文件路径: ${DATA_FILE_PATH}`);
});

// 优雅关闭处理
function gracefulShutdown(signal) {
    console.log(`\n📋 收到 ${signal} 信号，正在保存数据并关闭服务器...`);
    
    // 保存最后一次数据
    saveOfflinePlayersData();
    
    // 关闭服务器
    server.close(() => {
        console.log('🛑 服务器已关闭');
        process.exit(0);
    });
    
    // 如果10秒内没有关闭，强制退出
    setTimeout(() => {
        console.log('⚠️  强制关闭服务器');
        process.exit(1);
    }, 10000);
}

// 监听进程信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 监听未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('❌ 未捕获的异常:', error);
    saveOfflinePlayersData(); // 保存数据后再退出
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 未处理的Promise拒绝:', reason);
    saveOfflinePlayersData(); // 保存数据后再退出
});
