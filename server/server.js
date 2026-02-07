const WebSocket = require('ws');
const GameWorld = require('./GameWorld');
const Player = require('./Player');

class GameServer {
    constructor() {
        this.port = process.env.PORT || 3000;
        this.wss = new WebSocket.Server({ port: this.port });
        this.world = new GameWorld(500, 500);
        this.players = new Map(); // WebSocket -> Player
        this.playerSockets = new Map(); // playerId -> WebSocket
        this.nextPlayerId = 1;
        
        console.log(`Minisrooft Server запущен на порту ${this.port}`);
        console.log(`IP для подключения: [ваш_хостинг_ip]:${this.port}`);
        
        this.setupWebSocket();
        this.startGameLoop();
    }
    
    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            console.log(`Новое подключение: ${req.socket.remoteAddress}`);
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(ws, message);
                } catch (error) {
                    console.error('Ошибка парсинга сообщения:', error);
                }
            });
            
            ws.on('close', () => {
                this.handleDisconnect(ws);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket ошибка:', error);
            });
        });
    }
    
    handleMessage(ws, message) {
        switch (message.type) {
            case 'JOIN':
                this.handleJoin(ws, message);
                break;
            case 'MOVE':
                this.handleMove(ws, message);
                break;
            case 'BREAK_BLOCK':
                this.handleBreakBlock(ws, message);
                break;
            case 'PLACE_BLOCK':
                this.handlePlaceBlock(ws, message);
                break;
            case 'ATTACK':
                this.handleAttack(ws, message);
                break;
            case 'RESPAWN':
                this.handleRespawn(ws);
                break;
            case 'CHAT':
                this.handleChat(ws, message);
                break;
        }
    }
    
    handleJoin(ws, message) {
        const playerId = `player_${this.nextPlayerId++}`;
        const username = message.username || `Игрок${this.nextPlayerId}`;
        
        // Проверяем, не занят ли ник
        const existingPlayer = Array.from(this.players.values()).find(p => p.username === username);
        if (existingPlayer) {
            ws.send(JSON.stringify({
                type: 'JOIN_ERROR',
                message: 'Этот ник уже занят'
            }));
            ws.close();
            return;
        }
        
        const player = new Player(playerId, username);
        player.x = Math.floor(this.world.width / 2);
        player.y = Math.floor(this.world.height / 2);
        
        this.players.set(ws, player);
        this.playerSockets.set(playerId, ws);
        
        // Отправляем данные игроку
        const nearbyPlayers = this.getNearbyPlayers(player, 100);
        const playerList = nearbyPlayers.map(p => ({
            id: p.id,
            username: p.username,
            x: p.x,
            y: p.y,
            health: p.health
        }));
        
        ws.send(JSON.stringify({
            type: 'INIT',
            playerId: playerId,
            username: username,
            x: player.x,
            y: player.y,
            health: player.health,
            maxHealth: player.maxHealth,
            inventory: player.inventory,
            worldData: this.world.getChunk(player.x, player.y, 25),
            players: playerList,
            worldSize: {
                width: this.world.width,
                height: this.world.height
            }
        }));
        
        // Уведомляем других игроков
        this.broadcastToNearby(player, 100, {
            type: 'PLAYER_JOINED',
            playerId: playerId,
            username: username,
            x: player.x,
            y: player.y,
            health: player.health
        }, ws);
        
        console.log(`Игрок ${username} (${playerId}) присоединился`);
    }
    
    handleMove(ws, message) {
        const player = this.players.get(ws);
        if (!player || !player.isAlive) return;
        
        const speed = 5;
        let newX = player.x;
        let newY = player.y;
        
        if (message.up) newY -= speed;
        if (message.down) newY += speed;
        if (message.left) newX -= speed;
        if (message.right) newX += speed;
        
        // Проверяем границы мира
        newX = Math.max(0, Math.min(this.world.width - 1, newX));
        newY = Math.max(0, Math.min(this.world.height - 1, newY));
        
        // Проверяем коллизии с блоками
        if (this.world.canMoveTo(newX, newY)) {
            player.x = newX;
            player.y = newY;
            
            // Отправляем обновление позиции ближайшим игрокам
            this.broadcastToNearby(player, 100, {
                type: 'PLAYER_MOVED',
                playerId: player.id,
                x: player.x,
                y: player.y
            }, ws);
        }
    }
    
    handleBreakBlock(ws, message) {
        const player = this.players.get(ws);
        if (!player || !player.isAlive) return;
        
        const blockX = message.x;
        const blockY = message.y;
        
        // Проверяем расстояние (максимум 5 блоков)
        const distance = Math.sqrt(
            Math.pow(player.x - blockX, 2) + Math.pow(player.y - blockY, 2)
        );
        
        if (distance <= 5) {
            const block = this.world.breakBlock(blockX, blockY);
            if (block && block.type !== 0) {
                player.addToInventory(block.type);
                
                // Отправляем обновление
                this.broadcastToNearby(player, 100, {
                    type: 'BLOCK_BROKEN',
                    x: blockX,
                    y: blockY,
                    playerId: player.id
                });
                
                // Отправляем обновление инвентаря игроку
                ws.send(JSON.stringify({
                    type: 'INVENTORY_UPDATE',
                    inventory: player.inventory
                }));
            }
        }
    }
    
    handlePlaceBlock(ws, message) {
        const player = this.players.get(ws);
        if (!player || !player.isAlive) return;
        
        const blockX = message.x;
        const blockY = message.y;
        const blockType = message.blockType;
        
        // Проверяем расстояние
        const distance = Math.sqrt(
            Math.pow(player.x - blockX, 2) + Math.pow(player.y - blockY, 2)
        );
        
        if (distance <= 5 && player.removeFromInventory(blockType)) {
            if (this.world.placeBlock(blockX, blockY, blockType)) {
                this.broadcastToNearby(player, 100, {
                    type: 'BLOCK_PLACED',
                    x: blockX,
                    y: blockY,
                    blockType: blockType
                });
                
                ws.send(JSON.stringify({
                    type: 'INVENTORY_UPDATE',
                    inventory: player.inventory
                }));
            }
        }
    }
    
    handleAttack(ws, message) {
        const attacker = this.players.get(ws);
        if (!attacker || !attacker.isAlive) return;
        
        const targetId = message.targetId;
        const targetWs = this.playerSockets.get(targetId);
        const target = this.players.get(targetWs);
        
        if (!target || !target.isAlive) return;
        
        // Проверяем расстояние (максимум 2 блока)
        const distance = Math.sqrt(
            Math.pow(attacker.x - target.x, 2) + Math.pow(attacker.y - target.y, 2)
        );
        
        if (distance <= 2) {
            target.takeDamage(1);
            
            // Отправляем урон цели
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({
                    type: 'TAKE_DAMAGE',
                    damage: 1,
                    attacker: attacker.username,
                    health: target.health
                }));
            }
            
            // Уведомляем ближайших игроков
            this.broadcastToNearby(attacker, 50, {
                type: 'PLAYER_ATTACKED',
                attackerId: attacker.id,
                targetId: target.id,
                damage: 1
            });
            
            if (target.health <= 0) {
                this.handlePlayerDeath(target);
            }
        }
    }
    
    handlePlayerDeath(player) {
        player.isAlive = false;
        player.respawnTime = Date.now() + 5000; // 5 секунд до возрождения
        
        const playerWs = this.playerSockets.get(player.id);
        if (playerWs && playerWs.readyState === WebSocket.OPEN) {
            playerWs.send(JSON.stringify({
                type: 'PLAYER_DIED',
                respawnTime: player.respawnTime
            }));
        }
        
        this.broadcastToAll({
            type: 'PLAYER_DIED',
            playerId: player.id
        });
        
        console.log(`Игрок ${player.username} умер`);
    }
    
    handleRespawn(ws) {
        const player = this.players.get(ws);
        if (!player || player.isAlive) return;
        
        if (Date.now() >= player.respawnTime) {
            player.respawn();
            player.x = Math.floor(this.world.width / 2);
            player.y = Math.floor(this.world.height / 2);
            
            ws.send(JSON.stringify({
                type: 'RESPAWNED',
                x: player.x,
                y: player.y,
                health: player.health
            }));
            
            this.broadcastToNearby(player, 100, {
                type: 'PLAYER_RESPAWNED',
                playerId: player.id,
                x: player.x,
                y: player.y,
                health: player.health
            });
        }
    }
    
    handleChat(ws, message) {
        const player = this.players.get(ws);
        if (!player) return;
        
        this.broadcastToNearby(player, 200, {
            type: 'CHAT_MESSAGE',
            playerId: player.id,
            username: player.username,
            message: message.text,
            timestamp: Date.now()
        });
    }
    
    handleDisconnect(ws) {
        const player = this.players.get(ws);
        if (player) {
            console.log(`Игрок ${player.username} отключился`);
            
            this.broadcastToAll({
                type: 'PLAYER_LEFT',
                playerId: player.id
            });
            
            this.players.delete(ws);
            this.playerSockets.delete(player.id);
        }
    }
    
    getNearbyPlayers(player, radius) {
        const nearby = [];
        for (const [ws, p] of this.players) {
            if (p.id !== player.id) {
                const distance = Math.sqrt(
                    Math.pow(player.x - p.x, 2) + Math.pow(player.y - p.y, 2)
                );
                if (distance <= radius) {
                    nearby.push(p);
                }
            }
        }
        return nearby;
    }
    
    broadcastToNearby(player, radius, message, excludeWs = null) {
        for (const [ws, p] of this.players) {
            if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
                const distance = Math.sqrt(
                    Math.pow(player.x - p.x, 2) + Math.pow(player.y - p.y, 2)
                );
                if (distance <= radius) {
                    ws.send(JSON.stringify(message));
                }
            }
        }
    }
    
    broadcastToAll(message, excludeWs = null) {
        for (const [ws, player] of this.players) {
            if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        }
    }
    
    startGameLoop() {
        setInterval(() => {
            // Восстановление здоровья
            const now = Date.now();
            for (const [ws, player] of this.players) {
                if (player.isAlive && player.health < player.maxHealth) {
                    if (now - player.lastHealTime >= 5000) { // 5 секунд
                        player.heal(1);
                        player.lastHealTime = now;
                        
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'HEAL',
                                health: player.health
                            }));
                        }
                    }
                }
            }
        }, 1000); // Проверка каждую секунду
    }
}

// Запуск сервера
const server = new GameServer();