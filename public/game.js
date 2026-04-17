const PLAYER_COLORS = ['#e63946', '#4361ee', '#2a9d8f', '#f4a261'];
const socket = io();

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 700;
const MINIMAP_SCALE = 0.15;

let currentScreen = 'menu';
let playerId = null;
let playerColor = null;
let playerName = '';
let playerPicture = null;
let gameState = null;
let selectedBase = null;
let roomCode = '';
let isHost = false;

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
  avatarInput: document.getElementById('avatarInput'),
  avatarImg: document.getElementById('avatarImg'),
  avatarInitial: document.getElementById('avatarInitial'),
  playerName: document.getElementById('playerName'),
  createRoomBtn: document.getElementById('createRoomBtn'),
  roomCode: document.getElementById('roomCode'),
  joinRoomBtn: document.getElementById('joinRoomBtn'),
  displayRoomCode: document.getElementById('displayRoomCode'),
  copyCodeBtn: document.getElementById('copyCodeBtn'),
  leaveRoomBtn: document.getElementById('leaveRoomBtn'),
  playersList: document.getElementById('playersList'),
  playerCountBadge: document.getElementById('playerCountBadge'),
  countdownDisplay: document.getElementById('countdownDisplay'),
  countdownNumber: document.getElementById('countdownNumber'),
  startGameBtn: document.getElementById('startGameBtn'),
  inviteCode: document.getElementById('inviteCode'),
  copyInviteBtn: document.getElementById('copyInviteBtn'),
  playerPicture: document.getElementById('playerPicture'),
  playerNameDisplay: document.getElementById('playerNameDisplay'),
  baseCount: document.getElementById('baseCount'),
  unitCount: document.getElementById('unitCount'),
  killCount: document.getElementById('killCount'),
  timer: document.getElementById('timer'),
  selectionInfo: document.getElementById('selectionInfo'),
  selectedBaseInfo: document.getElementById('selectedBaseInfo'),
  upgradeBtn: document.getElementById('upgradeBtn'),
  yourUnits: document.getElementById('yourUnits'),
  sendUnitsBtn: document.getElementById('sendUnitsBtn'),
  killFeed: document.getElementById('killFeed'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  winnerText: document.getElementById('winnerText'),
  resultIcon: document.getElementById('resultIcon'),
  finalStats: document.getElementById('finalStats'),
  playAgainBtn: document.getElementById('playAgainBtn'),
  backToMenuBtn: document.getElementById('backToMenuBtn')
};

function showScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[screenName].classList.add('active');
  currentScreen = screenName;
}

elements.avatarInput.addEventListener('input', (e) => {
  const url = e.target.value.trim();
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    elements.avatarImg.src = url;
    elements.avatarImg.style.display = 'block';
    elements.avatarInitial.style.display = 'none';
    playerPicture = url;
  } else {
    elements.avatarImg.style.display = 'none';
    elements.avatarInitial.style.display = 'flex';
    playerPicture = null;
  }
});

function updateAvatarInitial() {
  const name = elements.playerName.value.trim();
  if (name) {
    elements.avatarInitial.textContent = name[0].toUpperCase();
  } else {
    elements.avatarInitial.textContent = '?';
  }
}

elements.playerName.addEventListener('input', updateAvatarInitial);

elements.createRoomBtn.addEventListener('click', () => {
  const name = elements.playerName.value.trim();
  if (!name) {
    elements.playerName.focus();
    elements.playerName.style.borderColor = '#ff3366';
    setTimeout(() => elements.playerName.style.borderColor = '', 1000);
    return;
  }
  playerName = name;
  socket.emit('create_room', { name, picture: playerPicture });
});

elements.joinRoomBtn.addEventListener('click', () => {
  const name = elements.playerName.value.trim();
  if (!name) {
    elements.playerName.focus();
    elements.playerName.style.borderColor = '#ff3366';
    setTimeout(() => elements.playerName.style.borderColor = '', 1000);
    return;
  }
  const code = elements.roomCode.value.trim().toUpperCase();
  if (!code) {
    elements.roomCode.focus();
    elements.roomCode.style.borderColor = '#ff3366';
    setTimeout(() => elements.roomCode.style.borderColor = '', 1000);
    return;
  }
  playerName = name;
  socket.emit('join_room', { code, name, picture: playerPicture });
});

elements.roomCode.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') elements.joinRoomBtn.click();
});

elements.copyCodeBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(roomCode);
  elements.copyCodeBtn.textContent = '✓';
  setTimeout(() => elements.copyCodeBtn.textContent = '📋', 2000);
});

elements.copyInviteBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(roomCode);
  elements.copyInviteBtn.textContent = 'Copied!';
  setTimeout(() => elements.copyInviteBtn.textContent = 'Copy', 2000);
});

elements.leaveRoomBtn.addEventListener('click', () => {
  location.reload();
});

elements.startGameBtn.addEventListener('click', () => {
  if (isHost) {
    socket.emit('start_countdown');
  }
});

elements.upgradeBtn.addEventListener('click', () => {
  if (!selectedBase || selectedBase.ownerId !== playerId) return;
  socket.emit('upgrade_base', { baseId: selectedBase.id });
});

elements.sendUnitsBtn.addEventListener('click', () => {
  const myUnits = gameState?.units?.filter(u => u.ownerId === playerId);
  const halfCount = Math.floor((myUnits?.length || 0) / 2);
  if (halfCount > 0 && selectedBase) {
    socket.emit('send_units', { x: selectedBase.x, y: selectedBase.y, count: halfCount });
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

elements.backToMenuBtn.addEventListener('click', () => {
  location.reload();
});

document.addEventListener('keydown', (e) => {
  if (currentScreen !== 'game') return;

  if (e.key === 'u' || e.key === 'U') {
    elements.upgradeBtn.click();
  } else if (e.key === 'Escape') {
    selectedBase = null;
    elements.selectionInfo.classList.add('hidden');
  }
});

canvas.addEventListener('click', (e) => {
  if (currentScreen !== 'game' || !gameState) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const clickedBase = gameState.bases?.find(base => {
    const dx = base.x - x;
    const dy = base.y - y;
    return Math.sqrt(dx * dx + dy * dy) <= base.radius;
  });

  if (clickedBase) {
    if (clickedBase.ownerId === playerId) {
      selectedBase = clickedBase;
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
  elements.selectionInfo.classList.add('hidden');
});

function updateSelectionUI() {
  if (!selectedBase) {
    elements.selectionInfo.classList.add('hidden');
    return;
  }

  elements.selectionInfo.classList.remove('hidden');
  const isOwn = selectedBase.ownerId === playerId;
  elements.selectedBaseInfo.textContent = `Base Lv.${selectedBase.level} | HP: ${Math.ceil(selectedBase.health)}/${selectedBase.maxHealth}`;
  elements.upgradeBtn.disabled = !isOwn || selectedBase.level >= 3;
  elements.sendUnitsBtn.disabled = !isOwn;
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

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
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

  if (!gameState.bases) return;

  gameState.bases.forEach(base => {
    const player = gameState.players?.find(p => p.id === base.ownerId);
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
    ctx.font = 'bold 14px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Lv${base.level}`, base.x, base.y);

    const healthPercent = base.health / base.maxHealth;
    const barWidth = base.radius * 1.5;
    const barHeight = 5;
    const barX = base.x - barWidth / 2;
    const barY = base.y - base.radius - 12;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const healthColor = healthPercent > 0.5 ? '#00ff88' : (healthPercent > 0.25 ? '#ffd700' : '#ff3366');
    ctx.fillStyle = healthColor;
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    if (selectedBase && base.id === selectedBase.id) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      drawHexagon(ctx, base.x, base.y, base.radius + 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  if (gameState.units) {
    gameState.units.forEach(unit => {
      const player = gameState.players?.find(p => p.id === unit.ownerId);
      if (!player) return;

      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, 7, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  elements.yourUnits.textContent = gameState.units?.filter(u => u.ownerId === playerId).length || 0;
}

function drawMinimap() {
  minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  minimapCtx.fillRect(0, 0, minimap.width, minimap.height);

  if (!gameState?.bases) return;

  gameState.bases.forEach(base => {
    const player = gameState.players?.find(p => p.id === base.ownerId);
    const color = player ? player.color : '#6c757d';
    
    minimapCtx.fillStyle = color;
    minimapCtx.beginPath();
    minimapCtx.arc(
      base.x * MINIMAP_SCALE,
      base.y * MINIMAP_SCALE,
      Math.max(2, base.radius * MINIMAP_SCALE),
      0, Math.PI * 2
    );
    minimapCtx.fill();
  });

  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  minimapCtx.strokeRect(0, 0, minimap.width, minimap.height);
}

function shadeColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return '#' + (0x1000000 + (R << 16) + (G << 8) + B).toString(16).slice(1);
}

function updateUI() {
  if (!gameState) return;

  elements.timer.textContent = formatTime(gameState.timeRemaining);
  elements.timer.style.color = gameState.timeRemaining < 60000 ? '#ff3366' : '#ffd700';

  const me = gameState.players?.find(p => p.id === playerId);
  if (me) {
    elements.playerNameDisplay.textContent = me.name;
    elements.playerNameDisplay.style.color = me.color;
    if (me.picture) {
      elements.playerPicture.src = me.picture;
      elements.playerPicture.style.display = 'block';
    }
    elements.baseCount.textContent = me.baseCount;
    elements.unitCount.textContent = me.unitCount;
    elements.killCount.textContent = me.kills;
  }
}

function addKillFeedEvent(html) {
  const event = document.createElement('div');
  event.className = 'kill-event';
  event.innerHTML = html;
  elements.killFeed.appendChild(event);
  setTimeout(() => event.remove(), 4000);
}

function updatePlayersList(players, currentCount) {
  elements.playersList.innerHTML = '';
  elements.playerCountBadge.textContent = `${currentCount}/4`;
  
  for (let i = 0; i < 4; i++) {
    const player = players?.[i];
    const card = document.createElement('div');
    card.className = 'player-card' + (player ? ' ready' : ' empty');
    
    if (player) {
      card.innerHTML = `
        <div class="player-avatar-small" style="background: linear-gradient(135deg, ${player.color}, ${shadeColor(player.color, -30)})">
          ${player.picture ? `<img src="${player.picture}" alt="">` : `<span class="initial">${player.name[0].toUpperCase()}</span>`}
        </div>
        <span class="player-name-small" style="color:${player.color}">${player.name}</span>
      `;
    } else {
      card.innerHTML = `
        <div class="player-avatar-small"></div>
        <span class="player-name-small" style="color:#666">Waiting...</span>
      `;
    }
    
    elements.playersList.appendChild(card);
  }
}

const damageStyle = document.createElement('style');
damageStyle.textContent = `
  @keyframes damageFloat {
    0% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-30px); }
  }
`;
document.head.appendChild(damageStyle);

socket.on('room_joined', (data) => {
  playerId = data.playerId;
  playerColor = data.player.color;
  roomCode = data.roomCode;
  isHost = data.isHost;
  
  elements.displayRoomCode.textContent = roomCode;
  elements.inviteCode.textContent = roomCode;
  
  elements.startGameBtn.disabled = !isHost;
  
  showScreen('lobby');
  updatePlayersList(data.players, data.playerCount);
});

socket.on('join_error', (data) => {
  alert(data.message);
});

socket.on('player_joined', (data) => {
  updatePlayersList(data.players, data.playerCount);
});

socket.on('player_left', (data) => {
  updatePlayersList(data.players, data.playerCount);
});

socket.on('countdown', (data) => {
  updatePlayersList(data.players, data.playerCount);
  
  if (data.timeRemaining > 0) {
    elements.countdownDisplay.classList.remove('hidden');
    elements.countdownNumber.textContent = Math.ceil(data.timeRemaining / 1000);
    elements.startGameBtn.disabled = true;
  } else {
    elements.countdownDisplay.classList.add('hidden');
  }
});

socket.on('game_start', () => {
  showScreen('game');
});

socket.on('game_state', (state) => {
  gameState = state;
  
  if (state.countdown && !state.gameStarted) {
    showScreen('lobby');
    return;
  }
  
  if (state.gameStarted && currentScreen === 'lobby') {
    showScreen('game');
  }
  
  if (currentScreen !== 'game') return;
  
  drawGame();
  drawMinimap();
  updateUI();

  if (state.gameOver) {
    showGameOver();
  }
});

socket.on('base_captured', (data) => {
  const attacker = gameState.players?.find(p => p.id === data.newOwnerId);
  if (attacker) {
    const previous = gameState.players?.find(p => p.id === data.previousOwnerId);
    addKillFeedEvent(`
      <span style="color:${attacker.color};font-weight:700">${attacker.name}</span> captured 
      ${previous ? `<span style="color:${previous.color}">${previous.name}</span>'s base` : 'a neutral base'}
    `);
  }
});

socket.on('damage', (data) => {
  console.log('Damage:', data);
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
    addKillFeedEvent('<span style="color:#ff3366">Not enough units to upgrade!</span>');
  }
});

socket.on('game_over', (data) => {
  gameState.gameOver = true;
  gameState.winner = data.winner;
  showGameOver();
});

function showGameOver() {
  showScreen('gameOver');
  
  const isWinner = gameState.winner?.id === playerId;
  elements.resultIcon.textContent = isWinner ? '🏆' : '💀';
  elements.winnerText.textContent = isWinner ? 'VICTORY!' : (gameState.winner ? `${gameState.winner.name} WINS!` : 'DRAW');
  elements.winnerText.style.color = isWinner ? '#ffd700' : '#ff3366';

  elements.finalStats.innerHTML = '';
  gameState.players
    .sort((a, b) => b.baseCount - a.baseCount)
    .forEach(player => {
      const div = document.createElement('div');
      div.className = 'player-stat' + (player.id === gameState.winner?.id ? ' winner' : '');
      div.innerHTML = `
        <span style="color:${player.color};font-weight:700">${player.name}</span>
        <span>${player.baseCount} bases</span>
        <span>${player.kills} kills</span>
      `;
      elements.finalStats.appendChild(div);
    });
}

function gameLoop() {
  if (currentScreen === 'game' || currentScreen === 'lobby') {
    socket.emit('request_state');
  }
  requestAnimationFrame(gameLoop);
}

gameLoop();