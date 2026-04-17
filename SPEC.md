# Mini Empire Online - Specification

## 1. Project Overview

**Project Name:** Mini Empire Online
**Type:** Real-time multiplayer strategy game
**Core Functionality:** Players build bases, generate units automatically, capture territory, and battle opponents in real-time
**Target Users:** Casual gamers who enjoy fast-paced strategy games

## 2. Technical Stack

- **Backend:** Node.js + Express + Socket.io
- **Frontend:** Vanilla JS + HTML5 Canvas
- **Architecture:** Client-server with authoritative game state on server

## 3. Game Mechanics

### 3.1 Core Loop
- Each player starts with 1 base
- Bases automatically generate units over time
- Units can be sent to attack other bases
- Capture neutral bases for income
- Capture enemy bases to weaken them
- Win by eliminating all opponents or having the most bases when timer ends

### 3.2 Resources & Units
- **Units:** Generated automatically by bases (1 unit every 2 seconds per base)
- **Max Units:** 50 per player
- **Unit Speed:** 100 pixels/second
- **Unit Health:** 10 HP
- **Unit Damage:** 5 HP per attack
- **Attack Range:** 30 pixels

### 3.3 Bases
- **Health:** 100 HP (upgrades increase this)
- **Production:** 1 unit/2 seconds
- **Neutral Bases:** Gray, 1 unit/3 seconds, 50 HP
- **Capture:** Send units to attack; when HP reaches 0, base belongs to attacker

### 3.4 Upgrades
Each base can be upgraded (costs units):
- **Level 2:** 150 units, +50% production, +25 HP
- **Level 3:** 300 units, +100% production, +50 HP, spawns 2 units

### 3.5 Map
- Canvas: 1200x800 pixels
- 5-8 neutral bases scattered randomly
- Starting bases at opposite corners/edges
- 2-4 players per room

## 4. Visual Specification

### 4.1 Color Palette
- **Background:** Dark terrain with grid pattern (#1a1a2e)
- **Player Colors:** Red (#e63946), Blue (#4361ee), Green (#2a9d8f), Yellow (#f4a261)
- **Neutral:** Gray (#6c757d)
- **UI:** Semi-transparent dark panels (#2d2d44cc)
- **Accent:** Gold (#ffd700) for selected/important elements

### 4.2 Base Visuals
- Hexagonal shape with inner glow
- Size based on level (30-50px radius)
- Health bar above
- Level indicator
- Pulsing effect when producing units

### 4.3 Unit Visuals
- Small circles (8px radius)
- Color matches player
- Trail effect when moving
- Flash red when taking damage

### 4.4 UI Elements
- Top bar: Player name, unit count, base count, timer
- Bottom bar: Selected base info, upgrade button, attack button
- Minimap: Bottom-right corner showing all bases
- Kill feed: Right side showing recent events

## 5. Networking Protocol

### 5.1 Client → Server Events
- `join_room` - Join a game room
- `select_base` - Select a base for actions
- `send_units` - {targetX, targetY, unitCount}
- `upgrade_base` - Upgrade selected base
- `chat_message` - Send chat message

### 5.2 Server → Client Events
- `game_state` - Full game state (60fps tick rate)
- `player_joined` - New player notification
- `player_left` - Player disconnected
- `game_over` - Winner announcement
- `chat_message` - Receive chat

## 6. Controls

- **Click on base:** Select it
- **Click on map:** Send selected units to location
- **Click on enemy base:** Send units to attack
- **Right-click:** Deselect
- **Keyboard 'U':** Upgrade selected base
- **Keyboard 'A':** Enter attack mode (click to attack)
- **Keyboard 'ESC':** Cancel selection

## 7. Game Flow

1. Player enters name and joins room
2. Wait for 2-4 players
3. 3-second countdown
4. Game starts (5 minutes timer)
5. Players expand, attack, defend
6. Timer ends or 1 player remains
7. Winner screen with stats
8. Option to play again

## 8. Acceptance Criteria

- [ ] Multiple players can join same room and see each other
- [ ] Units spawn automatically from bases
- [ ] Players can send units to attack bases
- [ ] Bases can be captured
- [ ] Game ends when timer expires or one player remains
- [ ] Real-time synchronization between all clients
- [ ] Visual feedback for all actions
- [ ] Responsive UI showing game state
- [ ] Smooth 60fps gameplay
