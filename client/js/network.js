class Network {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.playerId = null;
        this.messageQueue = [];
    }
    
    connect(serverUrl, username) {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(serverUrl);
                
                this.ws.onopen = () => {
                    console.log('Подключено к серверу');
                    this.connected = true;
                    
                    // Отправляем запрос на присоединение
                    this.send({
                        type: 'JOIN',
                        username: username
                    });
                    
                    // Отправляем все сообщения из очереди
                    this.flushMessageQueue();
                    
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('Ошибка обработки сообщения:', error);
                    }
                };
                
                this.ws.onclose = (event) => {
                    console.log('Отключено от сервера');
                    this.connected = false;
                    game.handleDisconnect();
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket ошибка:', error);
                    reject(error);
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    send(message) {
        if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            // Добавляем в очередь, если не подключены
            this.messageQueue.push(message);
        }
    }
    
    flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'INIT':
                this.playerId = message.playerId;
                game.handleInit(message);
                break;
            case 'PLAYER_JOINED':
                game.addPlayer(message);
                break;
            case 'PLAYER_MOVED':
                game.updatePlayerPosition(message);
                break;
            case 'PLAYER_LEFT':
                game.removePlayer(message.playerId);
                break;
            case 'BLOCK_BROKEN':
                game.handleBlockBreak(message);
                break;
            case 'BLOCK_PLACED':
                game.handleBlockPlace(message);
                break;
            case 'PLAYER_ATTACKED':
                game.handlePlayerAttacked(message);
                break;
            case 'TAKE_DAMAGE':
                game.handleTakeDamage(message);
                break;
            case 'PLAYER_DIED':
                game.handlePlayerDeath(message);
                break;
            case 'RESPAWNED':
                game.handleRespawn(message);
                break;
            case 'PLAYER_RESPAWNED':
                game.handlePlayerRespawn(message);
                break;
            case 'INVENTORY_UPDATE':
                game.updateInventory(message.inventory);
                break;
            case 'HEAL':
                game.handleHeal(message);
                break;
            case 'CHAT_MESSAGE':
                ui.addChatMessage(message);
                break;
            case 'JOIN_ERROR':
                alert(message.message);
                location.reload();
                break;
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
        this.connected = false;
    }
}

const network = new Network();