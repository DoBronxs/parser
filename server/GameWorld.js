class GameWorld {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.blocks = this.generateWorld();
        this.blockTypes = [
            { id: 0, name: 'air', solid: false }, // воздух
            { id: 1, name: 'grass', solid: true },
            { id: 2, name: 'dirt', solid: true },
            { id: 3, name: 'stone', solid: true }
        ];
    }
    
    generateWorld() {
        const blocks = [];
        
        for (let y = 0; y < this.height; y++) {
            blocks[y] = [];
            for (let x = 0; x < this.width; x++) {
                // Генерация слоёв как в Terraria
                if (y < this.height - 5) {
                    // Верхний слой: трава
                    if (y === this.height - 8) {
                        blocks[y][x] = 1; // grass
                    }
                    // Средние слои: земля
                    else if (y > this.height - 8 && y < this.height - 5) {
                        blocks[y][x] = 2; // dirt
                    }
                    // Нижние слои: камень
                    else {
                        blocks[y][x] = 3; // stone
                    }
                } else {
                    // Воздух в верхней части
                    blocks[y][x] = 0; // air
                }
            }
        }
        
        return blocks;
    }
    
    getChunk(centerX, centerY, radius) {
        const chunk = [];
        const startX = Math.max(0, Math.floor(centerX - radius));
        const endX = Math.min(this.width - 1, Math.floor(centerX + radius));
        const startY = Math.max(0, Math.floor(centerY - radius));
        const endY = Math.min(this.height - 1, Math.floor(centerY + radius));
        
        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                chunk.push({
                    x: x,
                    y: y,
                    type: this.blocks[y][x]
                });
            }
        }
        
        return chunk;
    }
    
    getBlock(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            return this.blocks[y][x];
        }
        return -1; // за пределами карты
    }
    
    breakBlock(x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const blockType = this.blocks[y][x];
            if (blockType !== 0) { // Не воздух
                this.blocks[y][x] = 0;
                return { type: blockType, x: x, y: y };
            }
        }
        return null;
    }
    
    placeBlock(x, y, blockType) {
        x = Math.floor(x);
        y = Math.floor(y);
        
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            if (this.blocks[y][x] === 0) { // Только на воздух
                this.blocks[y][x] = blockType;
                return true;
            }
        }
        return false;
    }
    
    canMoveTo(x, y) {
        const blockX = Math.floor(x / 32);
        const blockY = Math.floor(y / 32);
        
        if (blockX >= 0 && blockX < this.width && blockY >= 0 && blockY < this.height) {
            const blockType = this.blocks[blockY][blockX];
            const blockInfo = this.blockTypes[blockType];
            return !blockInfo.solid;
        }
        return false;
    }
}

module.exports = GameWorld;