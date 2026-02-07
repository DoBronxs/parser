class UI {
    constructor() {
        this.selectedBlock = null;
        this.initialize();
    }
    
    initialize() {
        this.setupEventListeners();
        this.updateHealth(20, 20);
    }
    
    setupEventListeners() {
        // Кнопка подключения
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.connectToServer();
        });
        
        // Поле ввода чата
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
        
        // Кнопка инвентаря
        document.getElementById('inventoryBtn').addEventListener('click', () => {
            this.toggleInventory();
        });
        
        // Кнопка закрытия инвентаря
        document.getElementById('closeInventory').addEventListener('click', () => {
            this.toggleInventory();
        });
        
        // Кнопки смерти
        document.getElementById('respawnBtn').addEventListener('click', () => {
            network.send({ type: 'RESPAWN' });
        });
        
        document.getElementById('quitBtn').addEventListener('click', () => {
            location.reload();
        });
    }
    
    connectToServer() {
        const username = document.getElementById('username').value.trim();
        const serverIp = document.getElementById('serverIp').value.trim();
        
        if (!username || !serverIp) {
            alert('Пожалуйста, введите ник и IP сервера');
            return;
        }
        
        if (username.length > 16) {
            alert('Ник не должен превышать 16 символов');
            return;
        }
        
        // Показываем загрузку
        const connectBtn = document.getElementById('connectBtn');
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Подключение...';
        connectBtn.disabled = true;
        
        network.connect(serverIp, username)
            .then(() => {
                // Подключение успешно, переход в игру произойдет после INIT сообщения
            })
            .catch(error => {
                alert('Ошибка подключения: ' + error.message);
                connectBtn.innerHTML = '<i class="fas fa-plug"></i> Подключиться';
                connectBtn.disabled = false;
            });
    }
    
    showGameScreen() {
        document.getElementById('connectScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        renderer.resize();
        window.addEventListener('resize', () => renderer.resize());
    }
    
    showDeathScreen(respawnTime) {
        document.getElementById('deathScreen').classList.remove('hidden');
        this.startRespawnTimer(respawnTime);
    }
    
    hideDeathScreen() {
        document.getElementById('deathScreen').classList.add('hidden');
    }
    
    startRespawnTimer(respawnTime) {
        const timerElement = document.getElementById('respawnTimer');
        const respawnBtn = document.getElementById('respawnBtn');
        
        if (respawnTime) {
            const interval = setInterval(() => {
                const secondsLeft = Math.max(0, Math.ceil((respawnTime - Date.now()) / 1000));
                timerElement.textContent = secondsLeft;
                
                if (secondsLeft === 0) {
                    clearInterval(interval);
                    respawnBtn.disabled = false;
                    respawnBtn.innerHTML = '<i class="fas fa-redo"></i> Возродиться';
                } else {
                    respawnBtn.disabled = true;
                    respawnBtn.innerHTML = `<i class="fas fa-clock"></i> Ожидание (${secondsLeft}s)`;
                }
            }, 1000);
        }
    }
    
    updateHealth(current, max) {
        const heartsContainer = document.getElementById('hearts');
        const healthText = document.getElementById('healthText');
        
        // Обновляем текст
        healthText.textContent = `${current}/${max}`;
        
        // Обновляем сердечки
        heartsContainer.innerHTML = '';
        for (let i = 0; i < max; i++) {
            const heart = document.createElement('div');
            heart.className = 'heart';
            heart.style.opacity = i < current ? '1' : '0.3';
            heartsContainer.appendChild(heart);
        }
    }
    
    updatePlayerInfo(username, x, y) {
        document.getElementById('playerName').textContent = username;
        document.getElementById('coordinates').textContent = `X: ${Math.floor(x)}, Y: ${Math.floor(y)}`;
    }
    
    updateOnlineCount(count) {
        document.getElementById('onlineNumber').textContent = count;
    }
    
    toggleInventory() {
        const inventory = document.getElementById('inventory');
        inventory.classList.toggle('hidden');
    }
    
    updateInventory(inventory) {
        const slotsContainer = document.getElementById('inventorySlots');
        slotsContainer.innerHTML = '';
        
        for (const [blockType, count] of Object.entries(inventory)) {
            if (count > 0) {
                const slot = document.createElement('div');
                slot.className = 'inventory-slot';
                slot.dataset.blockType = blockType;
                
                slot.innerHTML = `
                    <div class="block-icon" style="background-image: url('assets/${this.getBlockTexture(blockType)}.jpg')"></div>
                    <div class="block-count">${count}</div>
                `;
                
                slot.addEventListener('click', () => {
                    this.selectBlock(parseInt(blockType));
                    // Снимаем выделение с других слотов
                    document.querySelectorAll('.inventory-slot').forEach(s => {
                        s.classList.remove('selected');
                    });
                    slot.classList.add('selected');
                });
                
                slotsContainer.appendChild(slot);
            }
        }
        
        // Если выбранный блок есть в инвентаре
        if (this.selectedBlock && inventory[this.selectedBlock] > 0) {
            const slot = document.querySelector(`.inventory-slot[data-block-type="${this.selectedBlock}"]`);
            if (slot) {
                slot.classList.add('selected');
            }
        } else {
            this.selectedBlock = null;
        }
    }
    
    getBlockTexture(blockType) {
        const textures = {
            1: 'grass',
            2: 'dirt',
            3: 'stone'
        };
        return textures[blockType] || 'dirt';
    }
    
    selectBlock(blockType) {
        this.selectedBlock = blockType;
    }
    
    addChatMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        
        const time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        messageElement.innerHTML = `
            <span class="chat-username">${message.username}:</span>
            <span>${message.message}</span>
            <span style="float: right; font-size: 0.8em; color: #888;">${time}</span>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (message && network.connected) {
            network.send({
                type: 'CHAT',
                text: message
            });
            input.value = '';
        }
    }
}

const ui = new UI();