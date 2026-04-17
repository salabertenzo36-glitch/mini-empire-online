const socket = io();

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 700;
const MINIMAP_SCALE = 0.15;

let currentScreen = 'menu';
let playerId = null;
let playerColor = null;
let gameState = null;
let selectedBase = null;
let attackMode = false;
let lastClickTime = 0;

const screens = {
  menu: document.getElementById('menu'),
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  gameOver: document.getElementById('gameOver')
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');
minimap.width = MAP_WIDTH * MINIMAP_SCALE;
minimap.height = MAP_HEIGHT * MINIMAP_SCALE;

const elements = {
  playerName: document.getElementById('playerName'),
  joinBtn: document.getElementById('joinBtn'),
  menuStatus: document.getElementById('menuStatus'),
  lobbyPlayers: document.getElementById('lobbyPlayers'),
  lobbyStatus: document.getElementById('lobbyStatus'),
  playerNameDisplay: document.getElementById('playerNameDisplay'),
  playerStats: document.getElementById('playerStats'),
  timer: document.getElementById('timer'),
  selectionInfo: document.getElementById('selectionInfo'),
  selectedBaseInfo: document.getElementById('selectedBaseInfo'),
  upgradeBtn: document.getElementById('upgradeBtn'),
  unitCount: document.getElementById('unitCount'),
  sendUnitsBtn: document.getElementById('sendUnitsBtn'),
  killFeed: document.getElementById('killFeed'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  winnerText: document.getElementById('winnerText'),
  finalStats: document.getElementById('finalStats'),
  playAgainBtn: document.getElementById('playAgainBtn')
};

function showScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[screenName].classList.add('active');
  currentScreen = screenName;
}

elements.joinBtn.addEventListener('click', () => {
  const name = elements.playerName.value.trim() || 'Anonymous';
  socket.emit('join_game', { name });
  elements.menuStatus.textContent = 'Connecting...';
  elements.joinBtn.disabled = true;
});

elements.playerName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') elements.joinBtn.click();
});

elements.upgradeBtn.addEventListener('click', () => {
  if (!selectedBase || selectedBase.ownerId !== playerId) return;
  socket.emit('upgrade_base', { baseId: selectedBase.id });
});

elements.sendUnitsBtn.addEventListener('click', () => {
  const myUnits = gameState.units.filter(u => u.ownerId === playerId);
  const halfCount = Math.floor(myUnits.length / 2);
  if (halfCount > 0 && selectedBase) {
    socket.emit('send_units', { 
      x: selectedBase.x, 
      y: selectedBase.y, 
      count: halfCount 
    });
  }
});

elements.chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && elements.chatInput.value.trim()) {
    socket.emit('chat_message', { message: elements.chatInput.value.trim() });
    elements.chatInput.value = '';
  }
});

elements.playAgainBtn.addEventListener('click', () => {
  location.reload();
});

document.addEventListener('keydown', (e) => {
  if (currentScreen !== 'game') return;

  if (e.key === 'u' || e.key === 'U') {
    elements.upgradeBtn.click();
  } else if (e.key === 'a' || e.key === 'A') {
    attackMode = !attackMode;
  } else if (e.key === 'Escape') {
    selectedBase = null;
    attackMode = false;
    elements.selectionInfo.classList.add('hidden');
  }
});

canvas.addEventListener('click', (e) => {
  if (currentScreen !== 'game' || !gameState) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const clickedBase = gameState.bases.find(base => {
    const dx = base.x - x;
    const dy = base.y - y;
    return Math.sqrt(dx * dx + dy * dy) <= base.radius;
  });

  if (clickedBase) {
    if (clickedBase.ownerId === playerId) {
      selectedBase = clickedBase;
      attackMode = false;
      updateSelectionUI();
    } else if (selectedBase) {
      const myUnits = gameState.units.filter(u => u.ownerId === playerId);
      const count = Math.floor(myUnits.length / 2) || 1;
      socket.emit('send_units', { x: clickedBase.x, y: clickedBase.y, count });
    }
  } else {
    if (selectedBase) {
      const myUnits = gameState.units.filter(u => u.ownerId === playerId);
      const count = Math.floor(myUnits.length / 2) || 1;
      socket.emit('send_units', { x, y, count });
    }
  }
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  selectedBase = null;
  attackMode = false;
  elements.selectionInfo.classList.add('hidden');
});

function updateSelectionUI() {
  if (!selectedBase) {
    elements.selectionInfo.classList.add('hidden');
    return;
  }

  elements.selectionInfo.classList.remove('hidden');
  const isOwn = selectedBase.ownerId === playerId;
  elements.selectedBaseInfo.innerHTML = `
    <strong>Base Lv.${selectedBase.level}</strong> | 
    HP: ${Math.ceil(selectedBase.health)}/${selectedBase.maxHealth} |
    ${isOwn ? 'Your Base' : 'Enemy Base'}
  `;
  elements.upgradeBtn.disabled = !isOwn || selectedBase.level >= 3;
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function drawHexagon(ctx, x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawGame() {
  if (!gameState) return;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_WIDTH; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < CANVAS_HEIGHT; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  gameState.bases.forEach(base => {
    const player = gameState.players.find(p => p.id === base.ownerId);
    const color = player ? player.color : '#6c757d';
    
    const gradient = ctx.createRadialGradient(base.x, base.y, 0, base.x, base.y, base.radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, shadeColor(color, -30));

    ctx.fillStyle = gradient;
    drawHexagon(ctx, base.x, base.y, base.radius);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Lv${base.level}`, base.x, base.y);

    const healthPercent = base.health / base.maxHealth;
    const barWidth = base.radius * 1.5;
    const barHeight = 6;
    const barX = base.x - barWidth / 2;
    const barY = base.y - base.radius - 15;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const healthColor = healthPercent > 0.5 ? '#00ff88' : (healthPercent > 0.25 ? '#ffd700' : '#ff3366');
    ctx.fillStyle = healthColor;
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    if (base === selectedBase) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      drawHexagon(ctx, base.x, base.y, base.radius + 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  gameState.units.forEach(unit => {
    const player = gameState.players.find(p => p.id === unit.ownerId);
    if (!player) return;

    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, 8, 0, Math.PI * 2);
    ctx.stroke();
  });

  if (selectedBase) {
    elements.sendUnitsBtn.disabled = false;
  }

  elements.unitCount.textContent = gameState.units.filter(u => u.ownerId === playerId).length;
}

function drawMinimap() {
  minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  minimapCtx.fillRect(0, 0, minimap.width, minimap.height);

  gameState.bases.forEach(base => {
    const player = gameState.players.find(p => p.id === base.ownerId);
    const color = player ? player.color : '#6c757d';
    
    minimapCtx.fillStyle = color;
    minimapCtx.beginPath();
    minimapCtx.arc(
      base.x * MINIMAP_SCALE,
      base.y * MINIMAP_SCALE,
      Math.max(3, base.radius * MINIMAP_SCALE),
      0, Math.PI * 2
    );
    minimapCtx.fill();
  });

  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  minimapCtx.strokeRect(0, 0, minimap.width, minimap.height);
}

function shadeColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 +
    (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)
  ).toString(16).slice(1);
}

function updateUI() {
  if (!gameState) return;

  elements.timer.textContent = formatTime(gameState.timeRemaining);

  if (gameState.timeRemaining < 60000) {
    elements.timer.style.color = '#ff3366';
  } else {
    elements.timer.style.color = '#ffd700';
  }

  const me = gameState.players.find(p => p.id === playerId);
  if (me) {
    elements.playerNameDisplay.textContent = me.name;
    elements.playerNameDisplay.style.color = me.color;
    elements.playerStats.innerHTML = `
      <span class="stat">
        <svg class="stat-icon" viewBox="0 0 24 24" fill="${me.color}">
          <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/>
        </svg>
        ${me.baseCount} bases
      </span>
      <span class="stat">
        <svg class="stat-icon" viewBox="0 0 24 24" fill="${me.color}">
          <circle cx="12" cy="12" r="8"/>
        </svg>
        ${me.unitCount} units
      </span>
      <span class="stat">
        <svg class="stat-icon" viewBox="0 0 24 24" fill="${me.color}">
          <path d="M12 2L15 8H21L16 12L18 19L12 15L6 19L8 12L3 8H9L12 2Z"/>
        </svg>
        ${me.kills} kills
      </span>
    `;
  }
}

function addKillFeedEvent(html) {
  const event = document.createElement('div');
  event.className = 'kill-event';
  event.innerHTML = html;
  elements.killFeed.appendChild(event);
  
  setTimeout(() => {
    if (event.parentNode) {
      event.parentNode.removeChild(event);
    }
  }, 4000);
}

socket.on('join_success', (data) => {
  playerId = data.playerId;
  elements.joinBtn.disabled = false;
  elements.menuStatus.textContent = '';
  showScreen('lobby');
  updateLobby(data);
});

socket.on('join_error', (data) => {
  elements.menuStatus.textContent = data.message;
  elements.joinBtn.disabled = false;
});

socket.on('player_joined', (data) => {
  updateLobby(data);
});

socket.on('player_left', (data) => {
  elements.lobbyStatus.textContent = `Waiting... (${data.playerCount}/4 players)`;
});

socket.on('game_start', () => {
  showScreen('game');
});

socket.on('game_state', (state) => {
  if (currentScreen !== 'game') return;
  gameState = state;
  drawGame();
  drawMinimap();
  updateUI();

  if (gameState.gameOver) {
    showGameOver();
  }
});

socket.on('base_captured', (data) => {
  const attacker = gameState.players.find(p => p.id === data.newOwnerId);
  if (attacker) {
    if (data.previousOwnerId) {
      const previous = gameState.players.find(p => p.id === data.previousOwnerId);
      addKillFeedEvent(`
        <span class="attacker" style="color:${attacker.color}">${attacker.name}</span> 
        captured from 
        <span class="target" style="color:${previous?.color}">${previous?.name}</span>
      `);
    } else {
      addKillFeedEvent(`
        <span class="attacker" style="color:${attacker.color}">${attacker.name}</span> 
        captured a neutral base
      `);
    }
  }
});

socket.on('damage', (data) => {
  const canvas = document.getElementById('gameCanvas');
  const rect = canvas.getBoundingClientRect();
  const screenX = rect.left + data.x;
  const screenY = rect.top + data.y;
  
  const dmgEl = document.createElement('div');
  dmgEl.style.cssText = `
    position:fixed;
    left:${screenX}px;
    top:${screenY}px;
    color:#ff3366;
    font-weight:bold;
    font-size:14px;
    pointer-events:none;
    z-index:100;
    animation:damageFloat 0.5s ease-out forwards;
  `;
  dmgEl.textContent = `-${data.damage}`;
  document.body.appendChild(dmgEl);
  
  setTimeout(() => dmgEl.remove(), 500);
});

socket.on('chat_message', (data) => {
  const msg = document.createElement('div');
  msg.className = 'chat-message';
  msg.innerHTML = `<span class="author" style="color:${data.playerColor}">${data.playerName}:</span> ${data.message}`;
  elements.chatMessages.appendChild(msg);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
});

socket.on('upgrade_result', (data) => {
  if (!data.success) {
    addKillFeedEvent('Not enough units to upgrade!');
  }
});

socket.on('game_over', (data) => {
  gameState.gameOver = true;
  gameState.winner = data.winner;
  showGameOver();
});

function updateLobby(data) {
  elements.lobbyPlayers.innerHTML = '';
  
  for (let i = 0; i < 4; i++) {
    const card = document.createElement('div');
    card.className = 'player-card';
    
    const player = data.players?.[i] || (i < data.playerCount ? { name: 'Player ' + (i + 1), color: PLAYER_COLORS[i] } : null);
    
    if (player) {
      card.classList.add('ready');
      card.innerHTML = `<div class="player-name" style="color:${player.color}">${player.name}</div>`;
    } else {
      card.innerHTML = `<div class="player-name" style="color:#666">Waiting...</div>`;
    }
    
    elements.lobbyPlayers.appendChild(card);
  }

  elements.lobbyStatus.textContent = `Waiting for players... (${data.playerCount}/4)`;
}

function showGameOver() {
  showScreen('gameOver');
  
  if (gameState.winner) {
    const isWinner = gameState.winner.id === playerId;
    elements.winnerText.textContent = isWinner ? 'VICTORY!' : 'DEFEAT';
    elements.winnerText.style.color = isWinner ? '#ffd700' : '#ff3366';
  } else {
    elements.winnerText.textContent = 'DRAW';
    elements.winnerText.style.color = '#6c757d';
  }

  elements.finalStats.innerHTML = '';
  gameState.players
    .sort((a, b) => b.baseCount - a.baseCount)
    .forEach(player => {
      const div = document.createElement('div');
      div.className = 'player-stat' + (player.id === gameState.winner?.id ? ' winner' : '');
      div.innerHTML = `
        <span class="player-name" style="color:${player.color}">${player.name}</span>
        <span>${player.baseCount} bases</span>
        <span>${player.kills} kills</span>
      `;
      elements.finalStats.appendChild(div);
    });
}

const damageStyle = document.createElement('style');
damageStyle.textContent = `
  @keyframes damageFloat {
    0% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-30px); }
  }
`;
document.head.appendChild(damageStyle);

function gameLoop() {
  if (currentScreen === 'game') {
    socket.emit('request_state');
  }
  requestAnimationFrame(gameLoop);
}

gameLoop();
