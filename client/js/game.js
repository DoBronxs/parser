class Game {
    constructor() {
        this.player = {
            id: null,
            username: '',
            x: 0,
            y: 0,
            health: 20,
            maxHealth: 20,
            isAlive: true,
            inventory: {}
        };
        
        this.otherPlayers = new Map();
        this.worldData = {
            blocks: [],
            width: 500,
            height: 500
        };
        
        this.keys = {};
        this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
        this.lastUpdate = 0;
        this.animationFrame = null;
        
        this.initialize();
    }
    
    initialize() {
        this.setupEventListeners();
        this.gameLoop();
    }
    
    setupEventListeners() {
        // Управление клавишами
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            // Открытие/закрытие инвентаря
            if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                ui.toggleInventory();
            }
            
            // Отправка сообщения в чат
            if (e.key === 'Enter' && !document.getElementById('chatInput').matches(':focus')) {
                document.getElementById('chatInput').focus();
                e.preventDefault();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // Управление мышью
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            
            // Преобразуем экранные координаты в мировые
            const worldPos = renderer.screenToWorld(e.clientX, e.clientY);
            this.mouse.worldX = worldPos.x;
            this.mouse.worldY = worldPos.y;
        });
        
        window.addEventListener('mousedown', (e) => {
            if (!this.player.isAlive) return;
            
            const blockX = Math.floor(this.mouse.worldX / renderer.blockSize);
            const blockY = Math.floor(this.mouse.worldY / renderer.blockSize);
            
            if (e.button === 0) { // ЛКМ
                // Проверяем, кликнули ли по игроку
                for (const [id, otherPlayer] of this.otherPlayers) {
                    if (otherPlayer.isAlive) {
                        const distance = Math.sqrt(
                            Math.pow(this.player.x - otherPlayer.x, 2) + 
                            Math.pow(this.player.y - otherPlayer.y, 2)
                        );
                        
                        if (distance < 50) { // Дистанция атаки
                            const mouseDistance = Math.sqrt(
                                Math.pow(this.mouse.worldX - otherPlayer.x, 2) + 
                                Math.pow(this.mouse.worldY - otherPlayer.y, 2)
                            );
                            
                            if (mouseDistance < 20) { // Попадание по игроку
                                network.send({
                                    type: 'ATTACK',
                                    targetId: id
                                });
                                return;
                            }
                        }
                    }
                }
                
                // Если не попали по игроку, ломаем блок
                network.send({
                    type: 'BREAK_BLOCK',
                    x: blockX,
                    y: blockY
                });
                
            } else if (e.button === 2) { // ПКМ
                e.preventDefault(); // Отключаем контекстное меню
                
                if (ui.selectedBlock) {
                    network.send({
                        type: 'PLACE_BLOCK',
                        x: blockX,
                        y: blockY,
                        blockType: ui.selectedBlock
                    });
                }
            }
        });
        
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Отключаем контекстное меню браузера
        });
    }
    
    handleInit(message) {
        this.player.id = message.playerId;
        this.player.username = message.username;
        this.player.x = message.x;
        this.player.y = message.y;
        this.player.health = message.health;
        this.player.maxHealth = message.maxHealth;
        this.player.inventory = message.inventory || {};
        
        this.worldData.blocks = message.worldData || [];
        this.worldData.width = message.worldSize.width || 500;
        this.worldData.height = message.worldSize.height || 500;
        
        // Добавляем других игроков
        if (message.players) {
            for (const playerData of message.players) {
                this.addPlayer(playerData);
            }
        }
        
        // Обновляем UI
        ui.showGameScreen();
        ui.updatePlayerInfo(this.player.username, this.player.x, this.player.y);
        ui.updateInventory(this.player.inventory);
        ui.updateOnlineCount(this.otherPlayers.size + 1);
        
        console.log('Игра инициализирована');
    }
    
    addPlayer(playerData) {
        this.otherPlayers.set(playerData.id, {
            id: playerData.id,
            username: playerData.username,
            x: playerData.x,
            y: playerData.y,
            health: playerData.health || 20,
            maxHealth: 20,
            isAlive: true
        });
        
        ui.updateOnlineCount(this.otherPlayers.size + 1);
    }
    
    updatePlayerPosition(message) {
        const player = this.otherPlayers.get(message.playerId);
        if (player) {
            player.x = message.x;
            player.y = message.y;
        }
    }
    
    removePlayer(playerId) {
        this.otherPlayers.delete(playerId);
        ui.updateOnlineCount(this.otherPlayers.size + 1);
    }
    
    handleBlockBreak(message) {
        // Обновляем локальный мир
        const index = this.worldData.blocks.findIndex(
            block => block.x === message.x && block.y === message.y
        );
        
        if (index !== -1) {
            this.worldData.blocks.splice(index, 1);
        }
        
        // Если блок сломал наш игрок, обновляем инвентарь
        if (message.playerId === this.player.id) {
            const blockType = this.getBlockTypeAt(message.x, message.y);
            if (blockType && blockType !== 0) {
                this.player.inventory[blockType] = (this.player.inventory[blockType] || 0) + 1;
                ui.updateInventory(this.player.inventory);
            }
        }
    }
    
    handleBlockPlace(message) {
        // Добавляем блок в локальный мир
        const existingIndex = this.worldData.blocks.findIndex(
            block => block.x === message.x && block.y === message.y
        );
        
        if (existingIndex !== -1) {
            this.worldData.blocks[existingIndex].type = message.blockType;
        } else {
            this.worldData.blocks.push({
                x: message.x,
                y: message.y,
                type: message.blockType
            });
        }
    }
    
    handlePlayerAttacked(message) {
        // Можно добавить эффекты атаки (звуки, частицы и т.д.)
        console.log(`Игрок ${message.attackerId} атаковал ${message.targetId}`);
    }
    
    handleTakeDamage(message) {
        this.player.health = message.health;
        ui.updateHealth(this.player.health, this.player.maxHealth);
        
        // Показываем уведомление об уроне
        ui.addChatMessage({
            username: 'Система',
            message: `Вы получили ${message.damage} урон от ${message.attacker}`,
            timestamp: Date.now()
        });
    }
    
    handlePlayerDeath(message) {
        if (message.playerId === this.player.id) {
            this.player.isAlive = false;
            ui.showDeathScreen(message.respawnTime);
        } else {
            const player = this.otherPlayers.get(message.playerId);
            if (player) {
                player.isAlive = false;
            }
        }
    }
    
    handleRespawn(message) {
        this.player.x = message.x;
        this.player.y = message.y;
        this.player.health = message.health;
        this.player.isAlive = true;
        ui.updateHealth(this.player.health, this.player.maxHealth);
        ui.hideDeathScreen();
    }
    
    handlePlayerRespawn(message) {
        const player = this.otherPlayers.get(message.playerId);
        if (player) {
            player.x = message.x;
            player.y = message.y;
            player.health = message.health;
            player.isAlive = true;
        }
    }
    
    updateInventory(inventory) {
        this.player.inventory = inventory;
        ui.updateInventory(inventory);
    }
    
    handleHeal(message) {
        this.player.health = message.health;
        ui.updateHealth(this.player.health, this.player.maxHealth);
    }
    
    handleDisconnect() {
        alert('Отключено от сервера');
        location.reload();
    }
    
    getBlockTypeAt(x, y) {
        const block = this.worldData.blocks.find(b => b.x === x && b.y === y);
        return block ? block.type : 0;
    }
    
    getMousePosition() {
        return {
            x: this.mouse.x,
            y: this.mouse.y,
            worldX: this.mouse.worldX,
            worldY: this.mouse.worldY
        };
    }
    
    update() {
        const now = Date.now();
        if (now - this.lastUpdate < 16) return; // ~60 FPS
        this.lastUpdate = now;
        
        // Обновляем движение игрока
        if (this.player.isAlive && network.connected) {
            let moved = false;
            const moveData = {};
            
            if (this.keys['w'] || this.keys['ц']) {
                moveData.up = true;
                moved = true;
            }
            if (this.keys['s'] || this.keys['ы']) {
                moveData.down = true;
                moved = true;
            }
            if (this.keys['a'] || this.keys['ф']) {
                moveData.left = true;
                moved = true;
            }
            if (this.keys['d'] || this.keys['в']) {
                moveData.right = true;
                moved = true;
            }
            
            if (moved) {
                network.send({
                    type: 'MOVE',
                    ...moveData
                });
                
                // Плавное перемещение на клиенте
                const speed = 5;
                if (moveData.up) this.player.y -= speed;
                if (moveData.down) this.player.y += speed;
                if (moveData.left) this.player.x -= speed;
                if (moveData.right) this.player.x += speed;
                
                // Обновляем координаты в UI
                ui.updatePlayerInfo(this.player.username, this.player.x, this.player.y);
            }
        }
    }
    
    render() {
        // Устанавливаем камеру на игрока
        renderer.setCamera(this.player.x, this.player.y);
        
        // Рисуем мир
        renderer.drawWorld(this.worldData);
        
        // Рисуем других игроков
        for (const player of this.otherPlayers.values()) {
            if (player.isAlive) {
                renderer.drawPlayer(player);
            }
        }
        
        // Рисуем нашего игрока (поверх других)
        if (this.player.isAlive) {
            renderer.drawPlayer(this.player);
        }
        
        // Рисуем курсор
        renderer.drawCursor(ui.selectedBlock);
    }
    
    gameLoop() {
        this.update();
        this.render();
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }
}

// Запуск игры
const game = new Game();

// Загрузка текстур
renderer.loadTextures().then(() => {
    console.log('Текстуры загружены');
}).catch(error => {
    console.error('Ошибка загрузки текстур:', error);
});