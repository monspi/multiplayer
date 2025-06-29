// 游戏配置文件
const config = {
    // 服务器配置
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost'
    },
    
    // 游戏世界配置
    game: {
        worldWidth: 800,
        worldHeight: 600,
        playerSize: 20,
        moveSpeed: 3,
        maxPlayers: 50,
        playerNameMaxLength: 15
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
