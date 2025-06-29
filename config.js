// 游戏配置文件
const config = {
    // 服务器配置
    server: {
        port: process.env.PORT || 1666,
        host: process.env.HOST || 'localhost'
    },
    
    // 游戏世界配置
    game: {
        worldWidth: 4800,  // 大地图宽度 (48像素的倍数: 48 * 100)
        worldHeight: 3600, // 大地图高度 (48像素的倍数: 48 * 75)
        playerSize: 48,    // 玩家sprite尺寸
        moveSpeed: 4,      // 移动速度
        maxPlayers: 50,
        playerNameMaxLength: 15,
        offlineRetentionTime: 4 * 60 * 60 * 1000 // 离线玩家保留时间：4小时
    },
    
    // 玩家默认配置
    player: {
        colors: [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
            '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3',
            '#FF9F43', '#C44569', '#F8B500', '#6C5CE7'
        ],
        startPositionMargin: 20
    },
    
    // 调试选项
    debug: {
        logPlayerMovement: false,
        logConnections: true,
        showFPS: false
    }
};

module.exports = config;
