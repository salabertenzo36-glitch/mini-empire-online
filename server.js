const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

const PLAYER_COLORS = ['#e63946', '#4361ee', '#2a9d8f', '#f4a261'];
const GAME_DURATION = 300000;
const TICK_RATE = 1000 / 60;
const UNIT_SPAWN_RATE = 2000;
const UNIT_SPEED = 100;
const UNIT_HEALTH = 10;
const UNIT_DAMAGE = 5;
const UNIT_RADIUS = 8;
const BASE_HEALTH = 100;
const MAX_UNITS = 50;
const COUNTDOWN_TIME = 20000;

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

class GameRoom {
  constructor(code) {
    this.code = code;
    this.id = `room_${code}`;
    this.players = new Map();
    this.bases = [];
    this.units = [];
    this.gameStarted = false;
    this.gameOver = false;
    this.winner = null;
    this.startTime = null;
    this.lastTick = Date.now();
    this.neutralBaseId = 1000;
    this.countdownStarted = false;
    this.countdownStartTime = null;
    this.countdownDuration = COUNTDOWN_TIME;
  }

  generateMap() {
    const positions = [
      { x: 100, y: 100 },
      { x: 1100, y: 700 },
      { x: 100, y: 700 },
      { x: 1100, y: 100 }
    ];

    this.players.forEach((player, index) => {
      this.bases.push({
        id: `base_${player.id}`,
        x: positions[index].x,
        y: positions[index].y,
        ownerId: player.id,
        health: BASE_HEALTH,
        maxHealth: BASE_HEALTH,
        level: 1,
        lastSpawn: Date.now(),
        radius: 35
      });
    });

    const neutralPositions = [
      { x: 600, y: 400 },
      { x: 300, y: 300 },
      { x: 900, y: 300 },
      { x: 300, y: 500 },
      { x: 900, y: 500 },
      { x: 600, y: 200 },
      { x: 600, y: 600 }
    ];

    const numNeutral = Math.min(this.players.size + 2, neutralPositions.length);
    for (let i = 0; i < numNeutral; i++) {
      this.bases.push({
        id: `neutral_${this.neutralBaseId++}`,
        x: neutralPositions[i].x,
        y: neutralPositions[i].y,
        ownerId: null,
        health: 50,
        maxHealth: 50,
        level: 1,
        lastSpawn: Date.now(),
        spawnRate: 3000,
        radius: 25
      });
    }
  }

  addPlayer(socketId, name, picture) {
    const playerIndex = this.players.size;
    if (playerIndex >= 4) return null;

    const player = {
      id: socketId,
      name: name || `Player ${playerIndex + 1}`,
      picture: picture || null,
      color: PLAYER_COLORS[playerIndex],
      units: 0,
      baseCount: 0,
      kills: 0
    };

    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;

    this.bases = this.bases.filter(b => b.ownerId !== socketId);
    this.units = this.units.filter(u => u.ownerId !== socketId);
    this.players.delete(socketId);

    if (this.players.size === 1 && this.gameStarted && !this.gameOver) {
      this.gameOver = true;
      this.winner = Array.from(this.players.values())[0];
    }
  }

  getSpawnRate(base) {
    const baseMultiplier = base.level === 3 ? 2 : (base.level === 2 ? 1.5 : 1);
    return base.ownerId ? UNIT_SPAWN_RATE / baseMultiplier : (base.spawnRate || 3000);
  }

  update() {
    if (!this.gameStarted && this.countdownStarted) {
      const now = Date.now();
      const elapsed = now - this.countdownStartTime;
      const remaining = Math.max(0, this.countdownDuration - elapsed);

      io.to(this.id).emit('countdown', { timeRemaining: remaining, playerCount: this.players.size });

      if (remaining <= 0 || this.players.size >= 4 || this.players.size >= 2) {
        this.gameStarted = true;
        this.startTime = Date.now();
        this.countdownStarted = false;
        this.generateMap();
        io.to(this.id).emit('game_start');
      }
      return;
    }

    if (!this.gameStarted || this.gameOver) return;

    const now = Date.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    if (now - this.startTime >= GAME_DURATION) {
      this.endGameByTimer();
      return;
    }

    this.bases.forEach(base => {
      const player = this.players.get(base.ownerId);
      if (!player) return;

      const playerUnitCount = this.units.filter(u => u.ownerId === base.ownerId).length;
      if (playerUnitCount >= MAX_UNITS) return;

      const spawnRate = this.getSpawnRate(base);
      const unitsToSpawn = base.level === 3 ? 2 : 1;

      if (now - base.lastSpawn >= spawnRate) {
        for (let i = 0; i < unitsToSpawn; i++) {
          const angle = Math.random() * Math.PI * 2;
          const offsetX = Math.cos(angle) * (base.radius + 10);
          const offsetY = Math.sin(angle) * (base.radius + 10);

          this.units.push({
            id: `unit_${Date.now()}_${Math.random()}`,
            x: base.x + offsetX,
            y: base.y + offsetY,
            ownerId: base.ownerId,
            targetBaseId: null,
            health: UNIT_HEALTH,
            speed: UNIT_SPEED,
            angle: angle
          });
        }
        base.lastSpawn = now;
      }
    });

    const unitsToRemove = [];

    this.units.forEach(unit => {
      if (unit.targetBaseId) {
        const targetBase = this.bases.find(b => b.id === unit.targetBaseId);
        if (!targetBase) {
          unit.targetBaseId = null;
          return;
        }

        const dx = targetBase.x - unit.x;
        const dy = targetBase.y - unit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= targetBase.radius + UNIT_RADIUS) {
          if (targetBase.ownerId !== unit.ownerId) {
            targetBase.health -= UNIT_DAMAGE;
            io.to(this.id).emit('damage', {
              baseId: targetBase.id,
              damage: UNIT_DAMAGE,
              x: targetBase.x,
              y: targetBase.y
            });

            if (targetBase.health <= 0) {
              const previousOwner = targetBase.ownerId;
              targetBase.ownerId = unit.ownerId;
              targetBase.health = BASE_HEALTH;
              targetBase.maxHealth = BASE_HEALTH;
              targetBase.lastSpawn = now;
              targetBase.level = 1;
              targetBase.radius = 35;

              const newOwner = this.players.get(unit.ownerId);
              if (newOwner) newOwner.kills++;

              if (previousOwner) {
                io.to(this.id).emit('base_captured', {
                  baseId: targetBase.id,
                  newOwnerId: unit.ownerId,
                  previousOwnerId: previousOwner
                });
              } else {
                io.to(this.id).emit('base_captured', {
                  baseId: targetBase.id,
                  newOwnerId: unit.ownerId
                });
              }

              this.units = this.units.filter(u => u.targetBaseId === targetBase.id && u.ownerId === unit.ownerId);
            }
          }
          unitsToRemove.push(unit.id);
        } else {
          unit.angle = Math.atan2(dy, dx);
          unit.x += Math.cos(unit.angle) * unit.speed * dt;
          unit.y += Math.sin(unit.angle) * unit.speed * dt;
        }
      }
    });

    this.units = this.units.filter(u => !unitsToRemove.includes(u.id));

    const gameState = this.getGameState();
    io.to(this.id).emit('game_state', gameState);
  }

  sendUnits(playerId, targetX, targetY, unitCount) {
    const playerUnits = this.units.filter(u => u.ownerId === playerId);
    const availableUnits = playerUnits.slice(0, Math.min(unitCount, MAX_UNITS / 2));

    if (availableUnits.length === 0) return;

    const ownedBases = this.bases.filter(b => b.ownerId === playerId);
    if (ownedBases.length === 0) return;

    availableUnits.forEach(unit => {
      unit.angle = Math.atan2(targetY - unit.y, targetX - unit.x);

      const targetBase = this.bases.find(b => {
        const bdx = b.x - targetX;
        const bdy = b.y - targetY;
        const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
        return bdist < b.radius + 20;
      });

      if (targetBase) {
        unit.targetBaseId = targetBase.id;
      }
    });
  }

  upgradeBase(playerId, baseId) {
    const base = this.bases.find(b => b.id === baseId);
    if (!base || base.ownerId !== playerId) return false;
    if (base.level >= 3) return false;

    const cost = base.level === 1 ? 150 : 300;
    const unitsToUse = this.units.filter(u => u.ownerId === playerId);

    if (unitsToUse.length < cost) return false;

    for (let i = 0; i < cost; i++) {
      const idx = this.units.findIndex(u => u.ownerId === playerId && !u.targetBaseId);
      if (idx !== -1) {
        this.units.splice(idx, 1);
      }
    }

    base.level++;
    if (base.level === 2) {
      base.maxHealth += 25;
      base.health = base.maxHealth;
      base.radius = 40;
    } else if (base.level === 3) {
      base.maxHealth += 50;
      base.health = base.maxHealth;
      base.radius = 45;
    }

    return true;
  }

  endGameByTimer() {
    this.gameOver = true;
    let maxBases = 0;
    let winner = null;

    this.players.forEach(player => {
      const basesOwned = this.bases.filter(b => b.ownerId === player.id).length;
      if (basesOwned > maxBases) {
        maxBases = basesOwned;
        winner = player;
      }
    });

    if (!winner && this.players.size > 0) {
      winner = Array.from(this.players.values())[0];
    }

    this.winner = winner;
    io.to(this.id).emit('game_over', {
      winner: winner,
      reason: 'timer'
    });
  }

  getGameState() {
    const players = [];
    this.players.forEach(p => {
      players.push({
        id: p.id,
        name: p.name,
        picture: p.picture,
        color: p.color,
        baseCount: this.bases.filter(b => b.ownerId === p.id).length,
        unitCount: this.units.filter(u => u.ownerId === p.id).length,
        kills: p.kills
      });
    });

    return {
      roomCode: this.code,
      players,
      countdown: this.countdownStarted ? {
        timeRemaining: Math.max(0, this.countdownDuration - (Date.now() - this.countdownStartTime)),
        playerCount: this.players.size
      } : null,
      bases: this.bases.map(b => ({
        id: b.id,
        x: b.x,
        y: b.y,
        ownerId: b.ownerId,
        health: b.health,
        maxHealth: b.maxHealth,
        level: b.level,
        radius: b.radius
      })),
      units: this.units.map(u => ({
        id: u.id,
        x: u.x,
        y: u.y,
        ownerId: u.ownerId,
        health: u.health,
        angle: u.angle
      })),
      gameStarted: this.gameStarted,
      gameOver: this.gameOver,
      winner: this.winner ? {
        id: this.winner.id,
        name: this.winner.name,
        picture: this.winner.picture,
        color: this.winner.color
      } : null,
      timeRemaining: this.startTime ? Math.max(0, GAME_DURATION - (Date.now() - this.startTime)) : GAME_DURATION
    };
  }
}

const rooms = new Map();
const roomCodes = new Map();

function getOrCreateRoom(code) {
  if (code && roomCodes.has(code.toUpperCase())) {
    return roomCodes.get(code.toUpperCase());
  }
  
  let newCode = code || generateRoomCode();
  while (roomCodes.has(newCode)) {
    newCode = generateRoomCode();
  }
  
  const newRoom = new GameRoom(newCode);
  rooms.set(newRoom.id, newRoom);
  roomCodes.set(newCode, newRoom);
  return newRoom;
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  let currentRoom = null;
  let currentPlayer = null;

  socket.on('create_room', (data) => {
    const room = getOrCreateRoom(null);
    const player = room.addPlayer(socket.id, data.name, data.picture);

    currentRoom = room;
    currentPlayer = player;
    socket.join(room.id);

    socket.emit('room_joined', {
      playerId: socket.id,
      player: player,
      roomCode: room.code,
      roomId: room.id,
      playerCount: room.players.size,
      isHost: true
    });

    io.to(room.id).emit('player_joined', {
      player: player,
      playerCount: room.players.size,
      isHost: true
    });
  });

  socket.on('join_room', (data) => {
    const code = data.code?.toUpperCase();
    if (!code) {
      socket.emit('join_error', { message: 'Enter a room code' });
      return;
    }

    const room = getOrCreateRoom(code);
    
    if (room.gameStarted) {
      socket.emit('join_error', { message: 'Game already started' });
      return;
    }

    if (room.players.size >= 4) {
      socket.emit('join_error', { message: 'Room is full' });
      return;
    }

    const player = room.addPlayer(socket.id, data.name, data.picture);
    if (!player) {
      socket.emit('join_error', { message: 'Cannot join room' });
      return;
    }

    currentRoom = room;
    currentPlayer = player;
    socket.join(room.id);

    socket.emit('room_joined', {
      playerId: socket.id,
      player: player,
      roomCode: room.code,
      roomId: room.id,
      playerCount: room.players.size,
      isHost: false
    });

    io.to(room.id).emit('player_joined', {
      player: player,
      playerCount: room.players.size,
      isHost: false
    });

    if (room.players.size >= 2 && !room.countdownStarted) {
      room.countdownStarted = true;
      room.countdownStartTime = Date.now();
      room.countdownDuration = COUNTDOWN_TIME;
      io.to(room.id).emit('countdown', { timeRemaining: COUNTDOWN_TIME, playerCount: room.players.size });
    }
  });

  socket.on('start_countdown', () => {
    if (!currentRoom || currentRoom.gameStarted || currentRoom.countdownStarted) return;
    
    if (currentRoom.players.size >= 2) {
      currentRoom.countdownStarted = true;
      currentRoom.countdownStartTime = Date.now();
      currentRoom.countdownDuration = COUNTDOWN_TIME;
      io.to(currentRoom.id).emit('countdown', { timeRemaining: COUNTDOWN_TIME, playerCount: currentRoom.players.size });
    }
  });

  socket.on('send_units', (data) => {
    if (!currentRoom || !currentRoom.gameStarted) return;
    currentRoom.sendUnits(socket.id, data.x, data.y, data.count);
  });

  socket.on('upgrade_base', (data) => {
    if (!currentRoom || !currentRoom.gameStarted) return;
    const success = currentRoom.upgradeBase(socket.id, data.baseId);
    socket.emit('upgrade_result', { success, baseId: data.baseId });
  });

  socket.on('chat_message', (data) => {
    if (!currentRoom || !currentPlayer) return;
    io.to(currentRoom.id).emit('chat_message', {
      playerId: socket.id,
      playerName: currentPlayer.name,
      playerPicture: currentPlayer.picture,
      playerColor: currentPlayer.color,
      message: data.message
    });
  });

  socket.on('request_state', () => {
    if (!currentRoom) return;
    socket.emit('game_state', currentRoom.getGameState());
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      io.to(currentRoom.id).emit('player_left', {
        playerId: socket.id,
        playerCount: currentRoom.players.size
      });

      if (currentRoom.players.size === 0) {
        roomCodes.delete(currentRoom.code);
        rooms.delete(currentRoom.id);
      }
    }
  });
});

setInterval(() => {
  rooms.forEach(room => room.update());
}, TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Mini Empire Server running on http://localhost:${PORT}`);
});