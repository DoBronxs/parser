class Renderer {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.camera = { x: 0, y: 0 };
        this.blockSize = 32;
        this.viewDistance = 25;
        
        // Текстуры
        this.textures = {
            player: null,
            1: null, // grass
            2: null, // dirt
            3: null  // stone
        };
        
        this.loadTextures();
    }
    
    loadTextures() {
        const promises = [];
        
        // Загружаем текстуры
        const textureFiles = {
            player: 'assets/player.jpg',
            1: 'assets/grass.jpg',
            2: 'assets/dirt.jpg',
            3: 'assets/stone.jpg'
        };
        
        for (const [key, src] of Object.entries(textureFiles)) {
            promises.push(this.loadTexture(key, src));
        }
        
        return Promise.all(promises);
    }
    
    loadTexture(key, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.textures[key] = img;
                resolve();
            };
            img.onerror = reject;
            img.src = src;
        });
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    setCamera(x, y) {
        this.camera.x = x - this.canvas.width / 2;
        this.camera.y = y - this.canvas.height / 2;
    }
    
    worldToScreen(x, y) {
        return {
            x: x - this.camera.x,
            y: y - this.camera.y
        };
    }
    
    screenToWorld(x, y) {
        return {
            x: x + this.camera.x,
            y: y + this.camera.y
        };
    }
    
    drawBlock(x, y, blockType) {
        const screenPos = this.worldToScreen(x * this.blockSize, y * this.blockSize);
        
        if (this.textures[blockType]) {
            this.ctx.drawImage(
                this.textures[blockType],
                screenPos.x,
                screenPos.y,
                this.blockSize,
                this.blockSize
            );
        } else {
            // Запасная отрисовка
            this.ctx.fillStyle = this.getBlockColor(blockType);
            this.ctx.fillRect(
                screenPos.x,
                screenPos.y,
                this.blockSize,
                this.blockSize
            );
            
            // Сетка
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.strokeRect(
                screenPos.x,
                screenPos.y,
                this.blockSize,
                this.blockSize
            );
        }
    }
    
    getBlockColor(blockType) {
        const colors = {
            0: '#87CEEB', // воздух
            1: '#7CFC00', // трава
            2: '#8B4513', // земля
            3: '#808080'  // камень
        };
        return colors[blockType] || '#000000';
    }
    
    drawPlayer(player) {
        const screenPos = this.worldToScreen(player.x, player.y);
        
        // Рисуем игрока
        if (this.textures.player) {
            this.ctx.drawImage(
                this.textures.player,
                screenPos.x - 16,
                screenPos.y - 32,
                32,
                64
            );
        } else {
            // Запасная отрисовка
            this.ctx.fillStyle = player.isAlive ? '#FF6B6B' : '#666666';
            this.ctx.fillRect(
                screenPos.x - 16,
                screenPos.y - 32,
                32,
                64
            );
        }
        
        // Ник игрока
        this.ctx.fillStyle = player.isAlive ? '#FFFFFF' : '#888888';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            player.username,
            screenPos.x,
            screenPos.y - 40
        );
        
        // Здоровье (если не полное)
        if (player.health < player.maxHealth) {
            const barWidth = 40;
            const barHeight = 6;
            const healthPercent = player.health / player.maxHealth;
            
            // Фон полоски
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(
                screenPos.x - barWidth / 2,
                screenPos.y - 50,
                barWidth,
                barHeight
            );
            
            // Здоровье
            this.ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : 
                                healthPercent > 0.25 ? '#FF9800' : '#F44336';
            this.ctx.fillRect(
                screenPos.x - barWidth / 2,
                screenPos.y - 50,
                barWidth * healthPercent,
                barHeight
            );
        }
    }
    
    drawWorld(worldData) {
        // Очищаем канвас (небо)
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем блоки
        if (worldData && worldData.blocks) {
            for (const block of worldData.blocks) {
                const screenPos = this.worldToScreen(block.x * this.blockSize, block.y * this.blockSize);
                
                // Проверяем, виден ли блок на экране
                if (this.isOnScreen(screenPos.x, screenPos.y)) {
                    this.drawBlock(block.x, block.y, block.type);
                }
            }
        }
    }
    
    isOnScreen(x, y) {
        return x > -this.blockSize && 
               x < this.canvas.width + this.blockSize && 
               y > -this.blockSize && 
               y < this.canvas.height + this.blockSize;
    }
    
    drawCursor(selectedBlock) {
        const mousePos = game.getMousePosition();
        if (!mousePos) return;
        
        const gridX = Math.floor(mousePos.worldX / this.blockSize) * this.blockSize;
        const gridY = Math.floor(mousePos.worldY / this.blockSize) * this.blockSize;
        const screenPos = this.worldToScreen(gridX, gridY);
        
        // Подсветка блока под курсором
        this.ctx.strokeStyle = selectedBlock ? '#00FF00' : '#FFFF00';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
            screenPos.x,
            screenPos.y,
            this.blockSize,
            this.blockSize
        );
        
        // Показываем тип выбранного блока
        if (selectedBlock) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(screenPos.x, screenPos.y - 20, 60, 20);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(
                this.getBlockName(selectedBlock),
                screenPos.x + 5,
                screenPos.y - 5
            );
        }
    }
    
    getBlockName(blockType) {
        const names = {
            1: 'Трава',
            2: 'Земля',
            3: 'Камень'
        };
        return names[blockType] || 'Блок';
    }
}

const renderer = new Renderer();