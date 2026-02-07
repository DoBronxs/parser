class Player {
    constructor(id, username) {
        this.id = id;
        this.username = username;
        this.x = 0;
        this.y = 0;
        this.health = 20;
        this.maxHealth = 20;
        this.isAlive = true;
        this.inventory = {
            1: 0, // grass
            2: 0, // dirt
            3: 0  // stone
        };
        this.lastHealTime = Date.now();
        this.respawnTime = 0;
    }
    
    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        return this.health;
    }
    
    heal(amount) {
        this.health += amount;
        if (this.health > this.maxHealth) this.health = this.maxHealth;
        return this.health;
    }
    
    addToInventory(blockType) {
        if (this.inventory.hasOwnProperty(blockType)) {
            this.inventory[blockType]++;
        } else {
            this.inventory[blockType] = 1;
        }
    }
    
    removeFromInventory(blockType) {
        if (this.inventory[blockType] && this.inventory[blockType] > 0) {
            this.inventory[blockType]--;
            return true;
        }
        return false;
    }
    
    respawn() {
        this.health = this.maxHealth;
        this.isAlive = true;
        this.respawnTime = 0;
    }
}

module.exports = Player;