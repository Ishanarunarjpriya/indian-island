import {
  ARENA_ROOM_PREFIX,
  ARENA_WORLD,
  ENEMY_TYPES,
  MATCHMAKING,
  PLAYER_COMBAT,
  QUEUE_PADS,
  REWARD_CONFIG,
  WAVE_TABLE,
} from './config.js';
import {
  getCatalogItem,
  getShopInventory,
  getUpgradedItemStats,
  rollLoot,
} from './catalog.js';
import {
  ensureArenaProgress,
  getArenaProgress,
  ownArenaItem,
  snapshotArenaProgress,
  upgradeArenaItem,
} from './progress.js';

const QUEUE_HUB_ROOM_ID = `${ARENA_ROOM_PREFIX}queue-hub`;
const LOBBY_RETURN_POS = Object.freeze({ x: -43.37, y: 1.35, z: 110.14 });
const MATCH_PREFIX = `${ARENA_ROOM_PREFIX}match:`;
const DEFAULT_MATCH_SECONDS = 20;
const ENEMY_ATTACK_INTERVAL_MS = 450;
const MATCH_STATE_THROTTLE_MS = 240;
const STATUS_TICK_MS = PLAYER_COMBAT.statusTickMs || 1000;
const MAX_QUEUE_TIMER_MS = Math.max(5000, Number(MATCHMAKING.queueTimerMs) || 22000);
const INTERMISSION_MS = Math.max(5000, Number(MATCHMAKING.intermissionMs) || 12000);
const ROUND_BREAK_BUFFER_MS = 550;

function nowMs() {
  return Date.now();
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function distanceXZ(a, b) {
  const dx = safeNumber(a?.x) - safeNumber(b?.x);
  const dz = safeNumber(a?.z) - safeNumber(b?.z);
  return Math.hypot(dx, dz);
}

function randomBetween(min, max) {
  return min + (Math.random() * (max - min));
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function chance(probability) {
  return Math.random() < probability;
}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length < 1) return null;
  return list[Math.floor(Math.random() * list.length)] || null;
}

function anglePoint(center, radius, angle) {
  return {
    x: center.x + (Math.cos(angle) * radius),
    y: center.y,
    z: center.z + (Math.sin(angle) * radius),
  };
}

function buildQueueLaneFromConfig(pad) {
  return {
    id: pad.id,
    label: pad.label,
    capacity: pad.capacity,
    offset: { ...pad.offset },
    radius: pad.radius,
    members: new Set(),
    timerEndsAt: 0,
    createdAt: 0,
  };
}

function createParticipantFromPlayer(player) {
  return {
    socketId: player.socketId,
    username: typeof player.username === 'string' ? player.username : `player_${player.socketId.slice(0, 5)}`,
    displayName: typeof player.displayName === 'string' && player.displayName
      ? player.displayName
      : (typeof player.username === 'string' ? player.username : 'Player'),
    maxHealth: PLAYER_COMBAT.maxHealth,
    health: PLAYER_COMBAT.maxHealth,
    alive: true,
    unclaimedTokens: 0,
    unclaimedLoot: {},
    cooldowns: {},
    statusEffects: [],
    decisions: {
      cashout: 0,
      continue: 0,
    },
  };
}

function serializeLoot(lootMap) {
  const keys = Object.keys(lootMap || {});
  keys.sort();
  const normalized = {};
  for (let i = 0; i < keys.length; i += 1) {
    const itemId = keys[i];
    const amount = Math.max(0, Math.floor(Number(lootMap[itemId]) || 0));
    if (amount > 0) normalized[itemId] = amount;
  }
  return normalized;
}

function formatSeconds(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

function computeEnemyDifficulty(round, partySize) {
  const waveScale = 1 + ((Math.max(1, round) - 1) * 0.2);
  const partyScale = 1 + ((Math.max(1, partySize) - 1) * 0.22);
  const damageScale = 1 + ((Math.max(1, round) - 1) * 0.15) + ((Math.max(1, partySize) - 1) * 0.17);
  return {
    hpScale: waveScale * partyScale,
    damageScale,
    countScale: 1 + ((Math.max(1, round) - 1) * 0.2) + ((Math.max(1, partySize) - 1) * 0.33),
  };
}

function computeWaveCounts(round, partySize) {
  const counts = {
    basic: 0,
    tank: 0,
    ranged: 0,
    elite: 0,
    boss: 0,
  };
  const countScale = computeEnemyDifficulty(round, partySize).countScale;
  const enemyIds = ['basic', 'tank', 'ranged', 'elite'];
  for (let i = 0; i < enemyIds.length; i += 1) {
    const enemyId = enemyIds[i];
    const [baseCount, growth] = Array.isArray(WAVE_TABLE[enemyId]) ? WAVE_TABLE[enemyId] : [0, 0];
    const unscaled = baseCount + (growth * (round - 1));
    counts[enemyId] = Math.max(0, Math.floor(unscaled * countScale));
  }
  if (round <= 2) counts.tank = Math.min(counts.tank, 1);
  if (round <= 3) counts.elite = Math.min(counts.elite, 1);
  if (round % 5 === 0) {
    counts.boss = Math.max(1, Math.floor(1 + ((round - 5) / 10)));
    counts.elite += Math.max(1, Math.floor(round / 4));
  }
  if (counts.basic < 1) counts.basic = 1;
  return counts;
}

function buildQueueHubState(lanes, socketLookup) {
  const snapshotLanes = lanes.map((lane) => {
    const members = Array.from(lane.members).map((socketId) => {
      const player = socketLookup(socketId);
      return {
        socketId,
        username: typeof player?.username === 'string' ? player.username : null,
        displayName: typeof player?.displayName === 'string' ? player.displayName : null,
      };
    });
    return {
      id: lane.id,
      label: lane.label,
      capacity: lane.capacity,
      occupancy: lane.members.size,
      countdownMs: lane.timerEndsAt > 0 ? Math.max(0, lane.timerEndsAt - nowMs()) : 0,
      members,
    };
  });
  return { lanes: snapshotLanes, updatedAt: nowMs() };
}

function computeRoundWaveReward(round, isBossRound) {
  const base = Number(REWARD_CONFIG.waveTokenBase) || 10;
  const growth = Number(REWARD_CONFIG.waveTokenGrowth) || 4;
  let reward = base + (growth * Math.max(0, round - 1));
  if (isBossRound) reward += Number(REWARD_CONFIG.bossWaveBonus) || 0;
  return Math.max(0, Math.floor(reward));
}

function computeEnemyDropTokens(typeId, isBoss) {
  if (!chance(REWARD_CONFIG.dropTokenChance || 0.5)) return 0;
  const [minDrop, maxDrop] = Array.isArray(REWARD_CONFIG.baseTokenDrop)
    ? REWARD_CONFIG.baseTokenDrop
    : [1, 3];
  let amount = randomInt(Math.max(1, minDrop), Math.max(minDrop, maxDrop));
  const typeScale = Number(ENEMY_TYPES[typeId]?.tokenScale) || 1;
  amount = Math.max(1, Math.round(amount * typeScale));
  if (isBoss) amount = Math.max(amount, Math.round(amount * (REWARD_CONFIG.bossTokenMultiplier || 2)));
  return amount;
}

function computeLootDrop() {
  if (!chance(0.2)) return null;
  const rolled = rollLoot(Math.random);
  return rolled ? { ...rolled } : null;
}

function getActivePlayers(participants) {
  return participants.filter((entry) => entry && entry.connected !== false);
}

function getAlivePlayers(participants) {
  return participants.filter((entry) => entry && entry.connected !== false && entry.alive);
}

function getMajorityTarget(count) {
  return Math.max(1, Math.floor(count / 2) + 1);
}

export function createArenaRuntime(args) {
  const io = args?.io;
  const players = args?.players;
  const persistPlayerProgress = typeof args?.persistPlayerProgress === 'function'
    ? args.persistPlayerProgress
    : async () => {};

  if (!io || !players) {
    throw new Error('createArenaRuntime requires io and players');
  }

  const lanes = QUEUE_PADS.map(buildQueueLaneFromConfig);
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  const socketLaneMap = new Map();

  const matches = new Map();
  const socketMatchMap = new Map();
  let matchCounter = 0;

  const queueHubMembers = new Set();

  function getPlayer(socketId) {
    return players.get(socketId) || null;
  }

  function ensureProgressForSocket(socketId) {
    const player = getPlayer(socketId);
    if (!player) return null;
    player.progress = ensureArenaProgress(player.progress);
    return player;
  }

  async function persistProgress(socketId) {
    const player = getPlayer(socketId);
    if (!player) return;
    player.progress = ensureArenaProgress(player.progress);
    await persistPlayerProgress(socketId, player.progress);
  }

  function emitArenaProfile(socketId) {
    const player = ensureProgressForSocket(socketId);
    if (!player) return;
    const snapshot = snapshotArenaProgress(player.progress);
    io.to(socketId).emit('arena:profile', snapshot);
  }

  function emitQueueState() {
    const state = buildQueueHubState(lanes, getPlayer);
    io.emit('arena:queueHubState', state);
    io.emit('arena:queueState', state);
  }

  function clearLaneTimerIfEmpty(lane) {
    if (lane.members.size < 1) {
      lane.timerEndsAt = 0;
      lane.createdAt = 0;
    }
  }

  function removeSocketFromLane(socketId) {
    const laneId = socketLaneMap.get(socketId);
    if (!laneId) return;
    const lane = laneById.get(laneId);
    if (!lane) {
      socketLaneMap.delete(socketId);
      return;
    }
    lane.members.delete(socketId);
    socketLaneMap.delete(socketId);
    clearLaneTimerIfEmpty(lane);
    emitQueueState();
  }

  function setPlayerToQueueHub(socketId) {
    const player = getPlayer(socketId);
    if (!player) return;
    player.currentRoomId = QUEUE_HUB_ROOM_ID;
    const offset = ARENA_WORLD.queueHubTeleportOffset || { x: 0, y: 0, z: 0 };
    player.x = safeNumber(ARENA_WORLD.queueHubCenter?.x) + safeNumber(offset.x);
    player.y = safeNumber(ARENA_WORLD.queueHubCenter?.y, 1.35) + safeNumber(offset.y);
    player.z = safeNumber(ARENA_WORLD.queueHubCenter?.z) + safeNumber(offset.z);
    queueHubMembers.add(socketId);
    io.to(socketId).emit('arena:returnToLobby', {
      x: player.x,
      y: player.y,
      z: player.z,
      roomId: QUEUE_HUB_ROOM_ID,
      mode: 'queue-hub',
    });
  }

  function returnToMainLobby(socketId) {
    const player = getPlayer(socketId);
    if (!player) return;
    player.currentRoomId = null;
    player.x = LOBBY_RETURN_POS.x;
    player.y = LOBBY_RETURN_POS.y;
    player.z = LOBBY_RETURN_POS.z;
    queueHubMembers.delete(socketId);
    removeSocketFromLane(socketId);
    io.to(socketId).emit('arena:returnToLobby', {
      ...LOBBY_RETURN_POS,
      roomId: null,
      mode: 'main-world',
    });
  }

  function ensureSocketLeavesArenaState(socketId) {
    removeSocketFromLane(socketId);
    const matchId = socketMatchMap.get(socketId);
    if (!matchId) return;
    const match = matches.get(matchId);
    if (!match) {
      socketMatchMap.delete(socketId);
      return;
    }
    const participant = match.participants.get(socketId);
    if (participant) {
      participant.connected = false;
      participant.alive = false;
      participant.health = 0;
    }
  }

  function joinQueuePad(socketId, padId) {
    const lane = laneById.get(padId);
    const player = getPlayer(socketId);
    if (!lane || !player) return;
    if (socketMatchMap.has(socketId)) return;

    queueHubMembers.add(socketId);
    if (player.currentRoomId !== QUEUE_HUB_ROOM_ID) {
      setPlayerToQueueHub(socketId);
    }

    const existingLaneId = socketLaneMap.get(socketId);
    if (existingLaneId && existingLaneId !== lane.id) removeSocketFromLane(socketId);

    if (lane.members.size >= lane.capacity && !lane.members.has(socketId)) {
      io.to(socketId).emit('arena:message', { message: `${lane.label} queue is full.` });
      return;
    }

    lane.members.add(socketId);
    socketLaneMap.set(socketId, lane.id);
    if (lane.timerEndsAt < 1) {
      lane.createdAt = nowMs();
      lane.timerEndsAt = lane.createdAt + MAX_QUEUE_TIMER_MS;
    }
    emitQueueState();
  }

  function buildMatchSnapshot(match) {
    const participants = Array.from(match.participants.values());
    const aliveCount = getAlivePlayers(participants).length;
    const activeCount = getActivePlayers(participants).length;
    const votes = {
      cashout: 0,
      continue: 0,
      required: getMajorityTarget(Math.max(1, activeCount)),
    };
    participants.forEach((participant) => {
      if (!participant || participant.connected === false) return;
      const vote = match.decisions.get(participant.socketId);
      if (vote === 'cashout') votes.cashout += 1;
      if (vote === 'continue') votes.continue += 1;
    });

    const enemies = Array.from(match.enemies.values());
    const enemySummary = {};
    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];
      enemySummary[enemy.typeId] = (enemySummary[enemy.typeId] || 0) + 1;
    }

    return {
      roomId: match.roomId,
      laneId: match.laneId,
      phase: match.phase,
      round: match.round,
      isBossRound: match.round > 0 && (match.round % 5 === 0),
      partySize: participants.length,
      activePlayers: activeCount,
      alivePlayers: aliveCount,
      enemiesRemaining: enemies.length,
      enemies: enemies.map((enemy) => ({
        id: enemy.id,
        type: enemy.typeId,
        color: enemy.color,
        x: enemy.x,
        y: enemy.y + (enemy.typeId === 'boss' ? 1.6 : 1.0),
        z: enemy.z,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
      })),
      projectiles: [],
      enemySummary,
      intermissionEndsAt: match.intermissionEndsAt,
      intermissionSeconds: match.intermissionEndsAt > 0 ? formatSeconds(match.intermissionEndsAt - nowMs()) : 0,
      decisionSeconds: match.intermissionEndsAt > 0 ? formatSeconds(match.intermissionEndsAt - nowMs()) : 0,
      voteCounts: votes,
      players: participants.map((participant) => ({
        socketId: participant.socketId,
        username: participant.username,
        displayName: participant.displayName,
        alive: participant.alive,
        connected: participant.connected !== false,
        health: participant.health,
        maxHealth: participant.maxHealth,
        unclaimedTokens: participant.unclaimedTokens,
        unclaimedLoot: serializeLoot(participant.unclaimedLoot),
      })),
    };
  }

  function broadcastMatchState(match, force = false) {
    const now = nowMs();
    if (!force && now - match.lastBroadcastAt < MATCH_STATE_THROTTLE_MS) return;
    match.lastBroadcastAt = now;
    const snapshot = buildMatchSnapshot(match);
    io.to(match.roomId).emit('arena:state', snapshot);
  }

  function notifyMatch(match, message) {
    io.to(match.roomId).emit('arena:message', { message, at: nowMs() });
  }

  function placePlayersIntoMatchRoom(match) {
    const participants = Array.from(match.participants.values());
    const radius = Math.max(2.4, ARENA_WORLD.spawnRingRadius || 7.5);
    const center = {
      x: safeNumber(ARENA_WORLD.combatCenter?.x),
      y: safeNumber(ARENA_WORLD.combatCenter?.y, 1.35),
      z: safeNumber(ARENA_WORLD.combatCenter?.z),
    };
    for (let i = 0; i < participants.length; i += 1) {
      const participant = participants[i];
      const angle = (Math.PI * 2 * i) / Math.max(1, participants.length);
      const pos = anglePoint(center, radius, angle);
      const player = getPlayer(participant.socketId);
      if (!player) continue;
      player.currentRoomId = match.roomId;
      player.x = pos.x;
      player.y = pos.y;
      player.z = pos.z;
      queueHubMembers.delete(participant.socketId);
      io.to(participant.socketId).emit('arena:returnToLobby', {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        roomId: match.roomId,
        mode: 'match',
      });
    }
  }

  function spawnEnemy(match, typeId, hpScale, damageScale) {
    const def = ENEMY_TYPES[typeId];
    if (!def) return;
    const enemyId = `${match.id}:enemy:${match.nextEnemyId++}`;
    const angle = randomBetween(0, Math.PI * 2);
    const spawn = anglePoint(
      {
        x: safeNumber(ARENA_WORLD.combatCenter?.x),
        y: safeNumber(ARENA_WORLD.combatCenter?.y, 1.35),
        z: safeNumber(ARENA_WORLD.combatCenter?.z),
      },
      Math.max(ARENA_WORLD.enemySpawnRadius || 10.5, 4.5),
      angle,
    );
    const maxHp = Math.max(20, Math.floor((def.baseHp || 60) * hpScale));
    const damage = Math.max(1, Math.floor((def.baseDamage || 10) * damageScale));
    match.enemies.set(enemyId, {
      id: enemyId,
      typeId,
      label: def.label || typeId,
      color: def.color || '#ffffff',
      maxHp,
      hp: maxHp,
      damage,
      role: def.role || 'melee',
      attackRange: Number(def.attackRange) || 1.8,
      attackCooldownMs: Number(def.attackCooldownMs) || ENEMY_ATTACK_INTERVAL_MS,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      statusEffects: [],
      cooldownUntil: nowMs() + randomInt(200, 900),
      spawnAt: nowMs(),
    });
  }

  function startRound(match, nextRound) {
    match.round = nextRound;
    match.phase = 'combat';
    match.intermissionEndsAt = 0;
    match.decisions.clear();
    match.enemies.clear();

    const participants = Array.from(match.participants.values());
    const alive = getAlivePlayers(participants);
    if (alive.length < 1) {
      endMatchFailure(match, 'team-wipe');
      return;
    }

    const difficulty = computeEnemyDifficulty(match.round, participants.length);
    const counts = computeWaveCounts(match.round, participants.length);
    const orderedSpawns = ['basic', 'tank', 'ranged', 'elite', 'boss'];
    for (let i = 0; i < orderedSpawns.length; i += 1) {
      const typeId = orderedSpawns[i];
      const count = Math.max(0, counts[typeId] || 0);
      for (let n = 0; n < count; n += 1) {
        spawnEnemy(match, typeId, difficulty.hpScale, difficulty.damageScale);
      }
    }

    notifyMatch(match, `Round ${match.round} started. Defeat all enemies.`);
    broadcastMatchState(match, true);
  }

  function beginIntermission(match) {
    match.phase = 'intermission';
    match.intermissionEndsAt = nowMs() + INTERMISSION_MS;
    match.decisions.clear();

    const isBossRound = match.round % 5 === 0;
    const reward = computeRoundWaveReward(match.round, isBossRound);
    const participants = Array.from(match.participants.values());
    const aliveParticipants = getAlivePlayers(participants);
    for (let i = 0; i < aliveParticipants.length; i += 1) {
      aliveParticipants[i].unclaimedTokens += reward;
    }

    notifyMatch(
      match,
      `Round ${match.round} cleared. +${reward} unclaimed PvP tokens. Vote: Cash Out or Continue.`,
    );
    broadcastMatchState(match, true);
  }

  function applyBurnTicks(entity) {
    const timestamp = nowMs();
    if (!Array.isArray(entity.statusEffects) || entity.statusEffects.length < 1) return 0;
    let totalDamage = 0;
    const nextEffects = [];
    for (let i = 0; i < entity.statusEffects.length; i += 1) {
      const effect = entity.statusEffects[i];
      if (!effect || timestamp >= effect.endsAt) continue;
      if (effect.type === 'burn' && timestamp >= effect.nextTickAt) {
        totalDamage += Math.max(1, Math.floor(effect.damage || 1));
        effect.nextTickAt = timestamp + Math.max(160, Number(effect.tickMs) || STATUS_TICK_MS);
      }
      nextEffects.push(effect);
    }
    entity.statusEffects = nextEffects;
    return totalDamage;
  }

  function findNearestEnemy(match, source, maxRange = Infinity) {
    let nearest = null;
    let nearestDist = maxRange;
    const enemies = Array.from(match.enemies.values());
    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];
      const dist = distanceXZ(source, enemy);
      if (dist <= nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  function findNearestOpponent(match, sourceSocketId, sourcePos, maxRange = Infinity) {
    let nearest = null;
    let nearestDist = maxRange;
    const participants = Array.from(match.participants.values());
    for (let i = 0; i < participants.length; i += 1) {
      const participant = participants[i];
      if (participant.socketId === sourceSocketId || !participant.alive || participant.connected === false) continue;
      const player = getPlayer(participant.socketId);
      if (!player) continue;
      const dist = distanceXZ(sourcePos, player);
      if (dist <= nearestDist) {
        nearest = participant;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  function awardKillDrops(match, participant, enemyTypeId) {
    if (!participant) return;
    const tokenDrop = computeEnemyDropTokens(enemyTypeId, enemyTypeId === 'boss');
    if (tokenDrop > 0) participant.unclaimedTokens += tokenDrop;
    const loot = computeLootDrop();
    if (!loot) return;
    participant.unclaimedLoot[loot.itemId] = (participant.unclaimedLoot[loot.itemId] || 0) + 1;
  }

function dealDamageToParticipant(match, participant, amount, sourceLabel = 'enemy') {
  if (!participant || !participant.alive) return;
  const applied = Math.max(1, Math.floor(amount));
  participant.health = Math.max(0, participant.health - applied);
  if (participant.health > 0) return;
  participant.alive = false;
  participant.unclaimedTokens = 0;
  participant.unclaimedLoot = {};
  notifyMatch(match, `${participant.displayName} was defeated by ${sourceLabel}.`);
    const alivePlayers = getAlivePlayers(Array.from(match.participants.values()));
    if (alivePlayers.length < 1) {
      endMatchFailure(match, 'team-wipe');
      return;
    }
    broadcastMatchState(match, true);
  }

  function applyStatusEffect(entity, effect) {
    if (!entity.statusEffects) entity.statusEffects = [];
    entity.statusEffects.push(effect);
  }

  function damageEnemy(match, enemy, damageAmount, sourceParticipant, sourceLabel = 'player') {
    if (!enemy || !match.enemies.has(enemy.id)) return;
    const damage = Math.max(1, Math.floor(damageAmount));
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (enemy.hp > 0) return;
    match.enemies.delete(enemy.id);
    if (sourceParticipant) awardKillDrops(match, sourceParticipant, enemy.typeId);
    notifyMatch(match, `${sourceLabel} defeated ${enemy.label}.`);
    if (match.enemies.size < 1 && match.phase === 'combat') {
      beginIntermission(match);
    } else {
      broadcastMatchState(match);
    }
  }

  function computeItemDamageAndCrit(itemStats) {
    const baseDamage = Math.max(1, Math.floor(Number(itemStats.damage) || 10));
    const critChance = clamp(Number(itemStats.critChance) || PLAYER_COMBAT.defaultCritChance, 0, 0.95);
    const critMultiplier = Math.max(1.1, Number(itemStats.critMultiplier) || PLAYER_COMBAT.defaultCritMultiplier);
    const isCrit = chance(critChance);
    const damage = isCrit ? Math.round(baseDamage * critMultiplier) : baseDamage;
    return { damage, isCrit };
  }

  function buildItemRuntimeStats(playerProgress, itemId) {
    const arenaProgress = getArenaProgress(playerProgress);
    const item = getCatalogItem(itemId);
    if (!item) return null;
    const upgradeLevel = Number(arenaProgress.itemUpgrades[itemId]) || 0;
    const stats = getUpgradedItemStats(itemId, upgradeLevel) || item.baseStats;
    return {
      item,
      stats,
      upgradeLevel,
    };
  }

  function useMeleeLikeItem(match, sourceParticipant, sourcePlayer, itemRuntime) {
    const maxRange = Number(itemRuntime.stats.range) || 2.2;
    const enemy = findNearestEnemy(match, sourcePlayer, maxRange);
    const opponent = findNearestOpponent(match, sourceParticipant.socketId, sourcePlayer, maxRange);
    const targetEnemyDist = enemy ? distanceXZ(sourcePlayer, enemy) : Infinity;
    const targetPlayerDist = opponent ? distanceXZ(sourcePlayer, getPlayer(opponent.socketId)) : Infinity;
    const { damage } = computeItemDamageAndCrit(itemRuntime.stats);

    if (targetEnemyDist <= targetPlayerDist && enemy) {
      damageEnemy(match, enemy, damage, sourceParticipant, sourceParticipant.displayName);
    } else if (opponent) {
      dealDamageToParticipant(match, opponent, damage, sourceParticipant.displayName);
      broadcastMatchState(match, true);
    }

    if (Number(itemRuntime.stats.splashRadius) > 0) {
      const splashRadius = Number(itemRuntime.stats.splashRadius);
      const splashScale = clamp(Number(itemRuntime.stats.splashScale) || 0.25, 0.1, 0.8);
      const enemies = Array.from(match.enemies.values());
      for (let i = 0; i < enemies.length; i += 1) {
        const enemyCandidate = enemies[i];
        if (distanceXZ(sourcePlayer, enemyCandidate) <= splashRadius) {
          damageEnemy(match, enemyCandidate, Math.max(1, Math.round(damage * splashScale)), sourceParticipant, sourceParticipant.displayName);
        }
      }
    }
  }

  function useAbilityItem(match, sourceParticipant, sourcePlayer, itemRuntime) {
    const stats = itemRuntime.stats;
    const baseRange = Number(stats.range) || 4.5;
    const damage = computeItemDamageAndCrit(stats).damage;
    const radius = Number(stats.radius) || 0;

    if (itemRuntime.item.id === 'ability_arc_dash') {
      const targetEnemy = findNearestEnemy(match, sourcePlayer, baseRange);
      if (targetEnemy) {
        damageEnemy(match, targetEnemy, Math.round(damage * 1.1), sourceParticipant, sourceParticipant.displayName);
      }
      const targetPlayer = findNearestOpponent(match, sourceParticipant.socketId, sourcePlayer, baseRange);
      if (targetPlayer) {
        dealDamageToParticipant(match, targetPlayer, Math.round(damage * 0.95), sourceParticipant.displayName);
      }
      return;
    }

    const enemies = Array.from(match.enemies.values());
    const participants = Array.from(match.participants.values());

    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];
      const dist = distanceXZ(sourcePlayer, enemy);
      if (dist <= Math.max(baseRange, radius > 0 ? radius : baseRange)) {
        damageEnemy(match, enemy, damage, sourceParticipant, sourceParticipant.displayName);
        if (itemRuntime.item.id === 'ability_fireburst' && stats.burnDamage > 0) {
          applyStatusEffect(enemy, {
            type: 'burn',
            damage: stats.burnDamage,
            nextTickAt: nowMs() + (stats.burnTickMs || STATUS_TICK_MS),
            tickMs: stats.burnTickMs || STATUS_TICK_MS,
            endsAt: nowMs() + ((stats.burnTickMs || STATUS_TICK_MS) * Math.max(1, stats.burnTicks || 1)),
          });
        }
        if (itemRuntime.item.id === 'ability_frost_nova' && stats.slowRatio > 0) {
          applyStatusEffect(enemy, {
            type: 'slow',
            slowRatio: clamp(Number(stats.slowRatio) || 0.35, 0.05, 0.85),
            endsAt: nowMs() + Math.max(400, Number(stats.slowMs) || 1800),
          });
        }
      }
    }

    for (let i = 0; i < participants.length; i += 1) {
      const target = participants[i];
      if (target.socketId === sourceParticipant.socketId || !target.alive || target.connected === false) continue;
      const targetPlayer = getPlayer(target.socketId);
      if (!targetPlayer) continue;
      const dist = distanceXZ(sourcePlayer, targetPlayer);
      if (dist <= Math.max(baseRange, radius > 0 ? radius : baseRange)) {
        dealDamageToParticipant(match, target, Math.round(damage * 0.9), sourceParticipant.displayName);
      }
    }
  }

  function handleUseItem(socketId, payload) {
    const matchId = socketMatchMap.get(socketId);
    if (!matchId) return;
    const match = matches.get(matchId);
    if (!match || match.phase !== 'combat') return;

    const participant = match.participants.get(socketId);
    const player = getPlayer(socketId);
    if (!participant || !player || !participant.alive || participant.connected === false) return;

    player.progress = ensureArenaProgress(player.progress);
    const arenaProgress = getArenaProgress(player.progress);
    const slotRaw = Number(payload?.slotIndex);
    const slotIndex = Number.isInteger(slotRaw) ? clamp(slotRaw, 0, 8) : arenaProgress.selectedSlot;
    const itemId = arenaProgress.hotbar[slotIndex];
    if (!itemId) return;

    const runtimeStats = buildItemRuntimeStats(player.progress, itemId);
    if (!runtimeStats) return;

    const now = nowMs();
    const cooldownKey = runtimeStats.item.id;
    const nextUse = Number(participant.cooldowns[cooldownKey]) || 0;
    if (now < nextUse) return;
    participant.cooldowns[cooldownKey] = now + Math.max(220, Number(runtimeStats.stats.cooldownMs) || 650);

    if (runtimeStats.item.category === 'ability') {
      useAbilityItem(match, participant, player, runtimeStats);
    } else {
      useMeleeLikeItem(match, participant, player, runtimeStats);
    }

    broadcastMatchState(match, true);
  }

  function processEnemyActions(match) {
    if (match.phase !== 'combat') return;
    const now = nowMs();
    const participants = getAlivePlayers(Array.from(match.participants.values()));
    if (participants.length < 1) {
      endMatchFailure(match, 'team-wipe');
      return;
    }

    const enemies = Array.from(match.enemies.values());
    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];
      const burnDamage = applyBurnTicks(enemy);
      if (burnDamage > 0) {
        damageEnemy(match, enemy, burnDamage, null, 'Burn');
        continue;
      }
      if (!match.enemies.has(enemy.id)) continue;
      if (now < enemy.cooldownUntil) continue;

      const target = pickRandom(participants);
      if (!target) continue;
      const targetPlayer = getPlayer(target.socketId);
      if (!targetPlayer) continue;
      const dist = distanceXZ(enemy, targetPlayer);
      if (dist <= Math.max(2.1, enemy.attackRange + 0.4)) {
        dealDamageToParticipant(match, target, enemy.damage, enemy.label);
      } else {
        const heading = Math.atan2(targetPlayer.z - enemy.z, targetPlayer.x - enemy.x);
        const step = (ENEMY_TYPES[enemy.typeId]?.moveSpeed || 2.2) * 0.35;
        enemy.x += Math.cos(heading) * step;
        enemy.z += Math.sin(heading) * step;
      }

      enemy.cooldownUntil = now + Math.max(300, enemy.attackCooldownMs || ENEMY_ATTACK_INTERVAL_MS);
    }

    const allParticipants = Array.from(match.participants.values());
    for (let i = 0; i < allParticipants.length; i += 1) {
      const participant = allParticipants[i];
      if (!participant.alive) continue;
      const burnDamage = applyBurnTicks(participant);
      if (burnDamage > 0) dealDamageToParticipant(match, participant, burnDamage, 'Burn');
    }

    if (match.phase === 'combat' && match.enemies.size < 1) {
      beginIntermission(match);
    }
  }

  async function bankParticipantRunRewards(socketId, participant) {
    const player = getPlayer(socketId);
    if (!player || !participant) return;
    player.progress = ensureArenaProgress(player.progress);
    const arenaProgress = getArenaProgress(player.progress);
    arenaProgress.tokens += Math.max(0, Math.floor(participant.unclaimedTokens || 0));

    const lootEntries = Object.entries(serializeLoot(participant.unclaimedLoot));
    for (let i = 0; i < lootEntries.length; i += 1) {
      const [itemId, amount] = lootEntries[i];
      if (amount < 1) continue;
      const item = getCatalogItem(itemId);
      if (!item) continue;
      if (!arenaProgress.ownedItems.includes(itemId)) {
        ownArenaItem(player.progress, itemId);
      } else {
        const duplicateValue = Math.max(8, Math.floor((item.tokenCost || 50) * 0.2));
        arenaProgress.tokens += duplicateValue * amount;
      }
    }

    arenaProgress.matchesPlayed += 1;
    arenaProgress.matchesWon += 1;
    participant.unclaimedTokens = 0;
    participant.unclaimedLoot = {};

    await persistProgress(socketId);
    emitArenaProfile(socketId);
  }

  async function markFailedMatchProgress(socketId) {
    const player = getPlayer(socketId);
    if (!player) return;
    player.progress = ensureArenaProgress(player.progress);
    const arenaProgress = getArenaProgress(player.progress);
    arenaProgress.matchesPlayed += 1;
    await persistProgress(socketId);
    emitArenaProfile(socketId);
  }

  function cleanupMatchRoom(match) {
    match.phase = 'ended';
    matches.delete(match.id);
    const members = Array.from(match.participants.values());
    for (let i = 0; i < members.length; i += 1) {
      socketMatchMap.delete(members[i].socketId);
      match.participants.delete(members[i].socketId);
    }
  }

  async function endMatchSuccess(match, reason = 'cashout') {
    if (!matches.has(match.id) || match.phase === 'ended') return;
    match.phase = 'ending';
    const participants = Array.from(match.participants.values());

    for (let i = 0; i < participants.length; i += 1) {
      const participant = participants[i];
      if (participant.connected === false) continue;
      await bankParticipantRunRewards(participant.socketId, participant);
    }

    io.to(match.roomId).emit('arena:matchEnded', {
      outcome: 'cashout',
      reason,
      roundReached: match.round,
      banked: true,
    });

    for (let i = 0; i < participants.length; i += 1) {
      const participant = participants[i];
      returnToMainLobby(participant.socketId);
    }

    cleanupMatchRoom(match);
  }

  async function endMatchFailure(match, reason = 'team-wipe') {
    if (!matches.has(match.id) || match.phase === 'ended') return;
    match.phase = 'ending';
    const participants = Array.from(match.participants.values());

    for (let i = 0; i < participants.length; i += 1) {
      const participant = participants[i];
      participant.unclaimedTokens = 0;
      participant.unclaimedLoot = {};
      if (participant.connected === false) continue;
      await markFailedMatchProgress(participant.socketId);
    }

    io.to(match.roomId).emit('arena:matchEnded', {
      outcome: 'failed',
      reason,
      roundReached: match.round,
      banked: false,
    });

    for (let i = 0; i < participants.length; i += 1) {
      returnToMainLobby(participants[i].socketId);
    }

    cleanupMatchRoom(match);
  }

  function processIntermission(match) {
    if (match.phase !== 'intermission') return;
    const participants = getActivePlayers(Array.from(match.participants.values()));
    if (participants.length < 1) {
      void endMatchFailure(match, 'all-left');
      return;
    }

    const votes = { cashout: 0, continue: 0 };
    participants.forEach((participant) => {
      const vote = match.decisions.get(participant.socketId);
      if (vote === 'cashout') votes.cashout += 1;
      if (vote === 'continue') votes.continue += 1;
    });

    const majority = getMajorityTarget(participants.length);
    if (votes.cashout >= majority) {
      void endMatchSuccess(match, 'majority-cashout');
      return;
    }
    if (votes.continue >= majority) {
      startRound(match, match.round + 1);
      return;
    }

    if (match.intermissionEndsAt > 0 && nowMs() >= match.intermissionEndsAt) {
      if (votes.cashout > votes.continue) {
        void endMatchSuccess(match, 'timer-cashout-majority');
      } else {
        startRound(match, match.round + 1);
      }
    }
  }

  function tickMatch(match) {
    if (!matches.has(match.id)) return;
    if (match.phase === 'combat') {
      processEnemyActions(match);
    } else if (match.phase === 'intermission') {
      processIntermission(match);
    }
    broadcastMatchState(match);
  }

  function launchMatchFromLane(lane, memberSocketIds) {
    const validSockets = memberSocketIds.filter((socketId) => {
      const player = getPlayer(socketId);
      return Boolean(player);
    });
    if (validSockets.length < 1) return;

    matchCounter += 1;
    const matchId = `${MATCH_PREFIX}${matchCounter}`;
    const match = {
      id: matchId,
      roomId: matchId,
      laneId: lane.id,
      createdAt: nowMs(),
      round: 0,
      phase: 'preparing',
      participants: new Map(),
      enemies: new Map(),
      nextEnemyId: 1,
      decisions: new Map(),
      intermissionEndsAt: 0,
      lastBroadcastAt: 0,
    };

    for (let i = 0; i < validSockets.length; i += 1) {
      const socketId = validSockets[i];
      const player = getPlayer(socketId);
      if (!player) continue;
      const participant = createParticipantFromPlayer(player);
      match.participants.set(socketId, participant);
      socketMatchMap.set(socketId, match.id);
      socketLaneMap.delete(socketId);
      lane.members.delete(socketId);
    }

    clearLaneTimerIfEmpty(lane);
    matches.set(match.id, match);

    placePlayersIntoMatchRoom(match);
    notifyMatch(match, `Match started with ${match.participants.size} player(s).`);
    startRound(match, 1);
    emitQueueState();
  }

  function processQueueLanes() {
    const now = nowMs();
    for (let i = 0; i < lanes.length; i += 1) {
      const lane = lanes[i];
      if (lane.members.size < 1) {
        clearLaneTimerIfEmpty(lane);
        continue;
      }

      if (lane.timerEndsAt < 1) {
        lane.createdAt = now;
        lane.timerEndsAt = now + MAX_QUEUE_TIMER_MS;
      }

      const members = Array.from(lane.members).filter((socketId) => {
        if (!getPlayer(socketId)) {
          lane.members.delete(socketId);
          socketLaneMap.delete(socketId);
          return false;
        }
        return true;
      });

      if (members.length < 1) {
        clearLaneTimerIfEmpty(lane);
        continue;
      }

      const full = members.length >= lane.capacity;
      const timerDone = lane.timerEndsAt > 0 && now >= lane.timerEndsAt;
      if (full || timerDone) {
        launchMatchFromLane(lane, members.slice(0, lane.capacity));
      }
    }
  }

  function processTick() {
    processQueueLanes();
    const liveMatches = Array.from(matches.values());
    for (let i = 0; i < liveMatches.length; i += 1) {
      tickMatch(liveMatches[i]);
    }
  }

  const intervalHandle = setInterval(processTick, Math.max(40, Number(MATCHMAKING.tickMs) || 100));
  if (typeof intervalHandle.unref === 'function') intervalHandle.unref();

  function setDecision(socketId, decision) {
    const matchId = socketMatchMap.get(socketId);
    if (!matchId) return;
    const match = matches.get(matchId);
    if (!match || match.phase !== 'intermission') return;
    if (decision !== 'cashout' && decision !== 'continue') return;

    const participant = match.participants.get(socketId);
    if (!participant || participant.connected === false) return;

    match.decisions.set(socketId, decision);
    notifyMatch(match, `${participant.displayName} voted ${decision}.`);
    broadcastMatchState(match, true);
  }

  async function buyShopItem(socketId, payload) {
    const player = ensureProgressForSocket(socketId);
    if (!player) return;
    const itemId = typeof payload === 'string' ? payload : payload?.itemId;
    const item = getCatalogItem(itemId);
    if (!item) return;

    const arenaProgress = getArenaProgress(player.progress);
    if (arenaProgress.ownedItems.includes(itemId)) {
      io.to(socketId).emit('arena:message', { message: `${item.name} already owned.` });
      emitArenaProfile(socketId);
      return;
    }

    const cost = Math.max(0, Math.floor(Number(item.tokenCost) || 0));
    if (arenaProgress.tokens < cost) {
      io.to(socketId).emit('arena:message', { message: `Not enough PvP tokens for ${item.name}.` });
      emitArenaProfile(socketId);
      return;
    }

    arenaProgress.tokens -= cost;
    ownArenaItem(player.progress, itemId);
    await persistProgress(socketId);

    io.to(socketId).emit('arena:message', { message: `Bought ${item.name}.` });
    emitArenaProfile(socketId);
  }

  async function upgradeShopItem(socketId, payload) {
    const player = ensureProgressForSocket(socketId);
    if (!player) return;
    const itemId = typeof payload === 'string' ? payload : payload?.itemId;
    const result = upgradeArenaItem(player.progress, itemId);
    if (!result.ok) {
      io.to(socketId).emit('arena:message', {
        message: result.reason === 'maxed'
          ? 'Item already max upgrade.'
          : result.reason === 'not-owned'
            ? 'Buy item first.'
            : 'Not enough PvP tokens to upgrade.',
      });
      emitArenaProfile(socketId);
      return;
    }

    await persistProgress(socketId);
    const item = getCatalogItem(itemId);
    io.to(socketId).emit('arena:message', { message: `${item?.name || itemId} upgraded to Lv ${result.level}.` });
    emitArenaProfile(socketId);
  }

  async function setHotbar(socketId, hotbar) {
    const player = ensureProgressForSocket(socketId);
    if (!player) return;
    if (!Array.isArray(hotbar)) return;

    const arenaProgress = getArenaProgress(player.progress);
    const owned = new Set(arenaProgress.ownedItems);
    const next = hotbar.slice(0, 9);
    while (next.length < 9) next.push(null);
    for (let i = 0; i < next.length; i += 1) {
      const itemId = typeof next[i] === 'string' ? next[i] : null;
      next[i] = itemId && owned.has(itemId) ? itemId : null;
    }
    if (!next[0]) next[0] = 'melee_rust_blade';
    arenaProgress.hotbar = next;
    if (!arenaProgress.hotbar[arenaProgress.selectedSlot]) {
      arenaProgress.selectedSlot = 0;
    }

    await persistProgress(socketId);
    emitArenaProfile(socketId);
  }

  async function selectSlot(socketId, slotIndex) {
    const player = ensureProgressForSocket(socketId);
    if (!player) return;
    const arenaProgress = getArenaProgress(player.progress);
    const slot = clamp(Math.floor(Number(slotIndex) || 0), 0, 8);
    arenaProgress.selectedSlot = slot;
    await persistProgress(socketId);
    emitArenaProfile(socketId);
  }

  async function leaveMatch(socketId, reason = 'quit') {
    const matchId = socketMatchMap.get(socketId);
    if (!matchId) {
      returnToMainLobby(socketId);
      return;
    }

    const match = matches.get(matchId);
    if (!match) {
      socketMatchMap.delete(socketId);
      returnToMainLobby(socketId);
      return;
    }

    const participant = match.participants.get(socketId);
    if (participant) {
      participant.connected = false;
      participant.alive = false;
      participant.health = 0;
      participant.unclaimedTokens = 0;
      participant.unclaimedLoot = {};
    }

    socketMatchMap.delete(socketId);
    returnToMainLobby(socketId);

    const alive = getAlivePlayers(Array.from(match.participants.values()));
    if (alive.length < 1) {
      await endMatchFailure(match, reason);
      return;
    }

    notifyMatch(match, `${participant?.displayName || socketId} left match.`);
    broadcastMatchState(match, true);
  }

  function emitQueueHubStateToSocket(socketId) {
    io.to(socketId).emit('arena:queueHubState', buildQueueHubState(lanes, getPlayer));
  }

  function attachSocket(socket) {
    if (!socket || !socket.id) return;

    socket.on('arena:requestSync', () => {
      emitArenaProfile(socket.id);
      emitQueueHubStateToSocket(socket.id);
      const matchId = socketMatchMap.get(socket.id);
      if (matchId && matches.has(matchId)) {
        const match = matches.get(matchId);
        io.to(socket.id).emit('arena:state', buildMatchSnapshot(match));
      }
    });

    socket.on('arena:enterQueueHub', () => {
      ensureSocketLeavesArenaState(socket.id);
      setPlayerToQueueHub(socket.id);
      emitQueueHubStateToSocket(socket.id);
      emitArenaProfile(socket.id);
    });

    socket.on('arena:joinQueuePad', (payload) => {
      const padId = typeof payload === 'string' ? payload : payload?.padId;
      if (!laneById.has(padId)) return;
      joinQueuePad(socket.id, padId);
    });

    socket.on('arena:leaveQueuePad', () => {
      removeSocketFromLane(socket.id);
      emitQueueHubStateToSocket(socket.id);
    });

    // Legacy compatibility events
    socket.on('arena:startSolo', () => joinQueuePad(socket.id, 'solo'));
    socket.on('arena:joinCoop', (payload) => {
      const targetSize = clamp(Math.floor(Number(payload?.targetSize) || 2), 1, 4);
      const pad = QUEUE_PADS.find((entry) => entry.capacity === targetSize) || QUEUE_PADS[1] || QUEUE_PADS[0];
      joinQueuePad(socket.id, pad.id);
    });
    socket.on('arena:leaveQueue', () => removeSocketFromLane(socket.id));

    socket.on('arena:decision', (decision) => {
      setDecision(socket.id, decision);
    });

    socket.on('arena:buyItem', (payload) => {
      void buyShopItem(socket.id, payload);
    });

    socket.on('arena:upgradeItem', (payload) => {
      void upgradeShopItem(socket.id, payload);
    });

    socket.on('arena:setHotbar', (hotbar) => {
      void setHotbar(socket.id, hotbar);
    });

    socket.on('arena:selectSlot', (slotIndex) => {
      void selectSlot(socket.id, slotIndex);
    });

    socket.on('arena:useItem', (payload) => {
      handleUseItem(socket.id, payload || {});
    });

    socket.on('arena:quitMatch', () => {
      void leaveMatch(socket.id, 'quit');
    });

    socket.on('disconnect', () => {
      removeSocketFromLane(socket.id);
      const matchId = socketMatchMap.get(socket.id);
      if (!matchId) return;
      const match = matches.get(matchId);
      socketMatchMap.delete(socket.id);
      if (!match) return;
      const participant = match.participants.get(socket.id);
      if (participant) {
        participant.connected = false;
        participant.alive = false;
        participant.health = 0;
        participant.unclaimedTokens = 0;
        participant.unclaimedLoot = {};
      }
      const alive = getAlivePlayers(Array.from(match.participants.values()));
      if (alive.length < 1) {
        void endMatchFailure(match, 'disconnect-wipe');
      } else {
        broadcastMatchState(match, true);
      }
    });

    // Prime profile quickly once socket is authenticated and present in players map.
    setTimeout(() => {
      if (!getPlayer(socket.id)) return;
      emitArenaProfile(socket.id);
      emitQueueHubStateToSocket(socket.id);
    }, 350);
  }

  return {
    attachSocket,
    destroy() {
      clearInterval(intervalHandle);
    },
    debugState() {
      return {
        lanes: buildQueueHubState(lanes, getPlayer),
        matchIds: Array.from(matches.keys()),
      };
    },
  };
}
