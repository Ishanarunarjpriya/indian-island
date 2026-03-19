import {
  ARENA_ROOM_PREFIX,
  ARENA_WORLD,
  ENEMY_TYPES,
  MATCHMAKING,
  PLAYER_COMBAT,
  RARITY_CONFIG,
  REWARD_CONFIG,
  STATUS_EFFECTS,
  WAVE_TABLE,
} from './config.js';
import { LOOT_TABLE, getCatalogItem, getShopInventory } from './catalog.js';
import { ensureArenaProgress, snapshotArenaProgress } from './progress.js';

const TWO_PI = Math.PI * 2;

function nowMs() {
  return Date.now();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

function distance2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function normalize2D(x, z) {
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function createId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

function pickWeighted(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry;
    }
  }
  return entries[entries.length - 1] || null;
}

function rarityWeight(rarity) {
  return RARITY_CONFIG[rarity] ? RARITY_CONFIG[rarity].lootWeight : 1;
}

function getEnemyScale(wave) {
  return {
    hp: 1 + (wave - 1) * 0.18,
    damage: 1 + (wave - 1) * 0.11,
    moveSpeed: 1 + Math.min(0.35, (wave - 1) * 0.02),
  };
}

function buildWaveComposition(wave) {
  if (wave % 5 === 0) {
    return [{ type: 'boss', count: 1 }];
  }
  return Object.entries(WAVE_TABLE)
    .map(function mapWaveEntry(entry) {
      const type = entry[0];
      const baseCount = entry[1][0];
      const growth = entry[1][1];
      return {
        type,
        count: Math.max(0, Math.floor(baseCount + wave * growth)),
      };
    })
    .filter(function filterWaveEntry(entry) {
      return entry.count > 0;
    });
}

function buildSpawnPoint(index, total) {
  const angle = (index / Math.max(1, total)) * TWO_PI;
  return {
    x: ARENA_WORLD.hubCenter.x + Math.cos(angle) * ARENA_WORLD.spawnRingRadius,
    y: ARENA_WORLD.hubCenter.y,
    z: ARENA_WORLD.hubCenter.z + Math.sin(angle) * ARENA_WORLD.spawnRingRadius,
  };
}

function buildEnemySpawnPoint() {
  const angle = Math.random() * TWO_PI;
  const radius = randomRange(ARENA_WORLD.enemySpawnRadius - 2.5, ARENA_WORLD.enemySpawnRadius);
  return {
    x: ARENA_WORLD.hubCenter.x + Math.cos(angle) * radius,
    y: ARENA_WORLD.hubCenter.y,
    z: ARENA_WORLD.hubCenter.z + Math.sin(angle) * radius,
  };
}

function buildQueueSnapshot(queue) {
  return {
    queuedCount: queue.entries.length,
    entries: queue.entries.map(function mapEntry(entry) {
      return {
        socketId: entry.socketId,
        username: entry.username,
        displayName: entry.displayName,
        joinedAt: entry.joinedAt,
      };
    }),
    startsAt: queue.startsAt,
    timerEndsAt: queue.timerEndsAt,
    targetSize: queue.targetSize,
    ownerSocketId: queue.ownerSocketId,
    minPlayers: MATCHMAKING.minPlayers,
    maxPlayers: MATCHMAKING.maxPlayers,
  };
}

function serializeCooldowns(member, currentTime) {
  return Object.fromEntries(
    Object.entries(member.cooldowns).map(function mapCooldown(entry) {
      return [entry[0], Math.max(0, entry[1] - currentTime)];
    }),
  );
}

function serializeArenaPlayer(member) {
  return {
    socketId: member.socketId,
    username: member.username,
    displayName: member.displayName,
    hp: member.hp,
    maxHp: member.maxHp,
    alive: member.alive,
    spectating: member.spectating,
    selectedSlot: member.selectedSlot,
    activeItemId: member.hotbar[member.selectedSlot] || null,
    pendingTokens: member.pendingTokens,
    roundWins: member.roundWins || 0,
    pendingLoot: { ...member.pendingLoot },
    bankedTokens: member.tokens,
    buffs: member.buffs.map(function mapBuff(buff) {
      return { type: buff.type, endsAt: buff.endsAt };
    }),
  };
}

function serializeEnemy(enemy) {
  return {
    id: enemy.id,
    type: enemy.type,
    label: enemy.label,
    color: enemy.color,
    x: enemy.x,
    y: enemy.y,
    z: enemy.z,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    targetId: enemy.targetId,
    phase: enemy.phase,
    statusEffects: enemy.statusEffects.map(function mapStatus(status) {
      return { type: status.type, endsAt: status.endsAt };
    }),
  };
}

function serializeProjectile(projectile) {
  return {
    id: projectile.id,
    ownerType: projectile.ownerType,
    ownerId: projectile.ownerId,
    x: projectile.x,
    y: projectile.y,
    z: projectile.z,
    color: projectile.color,
    radius: projectile.radius,
  };
}

export function createArenaRuntime(args) {
  const io = args.io;
  const players = args.players;
  const persistPlayerProgress = args.persistPlayerProgress;
  const queue = {
    entries: [],
    startsAt: 0,
    timerEndsAt: 0,
    targetSize: 0,
    ownerSocketId: null,
  };
  const matches = new Map();
  const socketToMatchId = new Map();
  const sockets = new Map();

  function getPlayer(socketId) {
    return players && players[socketId] ? players[socketId] : null;
  }

  function getSocket(socketId) {
    return sockets.get(socketId) || io.sockets.sockets.get(socketId) || null;
  }

  function getArenaProgress(socketId) {
    const player = getPlayer(socketId);
    if (!player) {
      return null;
    }
    player.progress = ensureArenaProgress(player.progress);
    return player.progress.arena;
  }

  async function flushProgress(socketId) {
    const player = getPlayer(socketId);
    if (!player || !player.username) {
      return;
    }
    player.progress = ensureArenaProgress(player.progress);
    await persistPlayerProgress(player.username, player.progress);
  }

  function emitProfile(socketId) {
    const player = getPlayer(socketId);
    if (!player) {
      return;
    }
    player.progress = ensureArenaProgress(player.progress);
    io.to(socketId).emit('arena:profile', snapshotArenaProgress(player.progress));
  }

  function broadcastQueueState() {
    io.emit('arena:queueState', buildQueueSnapshot(queue));
  }

  function leaveQueue(socketId) {
    const before = queue.entries.length;
    queue.entries = queue.entries.filter(function filterEntry(entry) {
      return entry.socketId !== socketId;
    });
    if (before !== queue.entries.length) {
      if (!queue.entries.length) {
        queue.startsAt = 0;
        queue.timerEndsAt = 0;
        queue.targetSize = 0;
        queue.ownerSocketId = null;
      } else if (queue.ownerSocketId === socketId) {
        queue.ownerSocketId = queue.entries[0].socketId;
      }
      broadcastQueueState();
    }
  }

  function cleanupSocketRooms(socketId) {
    const socket = getSocket(socketId);
    const player = getPlayer(socketId);
    if (!socket || !player) {
      return;
    }
    socket.leave('world');
    socket.leave(player.currentRoomId || '');
    socket.leave('home:' + (player.currentRoomId || ''));
  }

  function movePlayerToArena(socketId, position, roomId) {
    const player = getPlayer(socketId);
    const socket = getSocket(socketId);
    if (!player || !socket) {
      return;
    }
    cleanupSocketRooms(socketId);
    player.currentRoomId = roomId;
    player.x = position.x;
    player.y = position.y;
    player.z = position.z;
    player.rotation = Math.atan2(ARENA_WORLD.hubCenter.x - position.x, ARENA_WORLD.hubCenter.z - position.z);
    socket.join(roomId);
  }

  function returnPlayerFromArena(member) {
    const player = getPlayer(member.socketId);
    const socket = getSocket(member.socketId);
    if (!player || !socket) {
      return;
    }
    socket.leave(member.roomId);
    player.currentRoomId = null;
    player.x = member.returnPosition.x;
    player.y = member.returnPosition.y;
    player.z = member.returnPosition.z;
    player.rotation = member.returnPosition.rotation || 0;
    socket.join('world');
    io.to(member.socketId).emit('arena:returnToLobby', {
      x: player.x,
      y: player.y,
      z: player.z,
      rotation: player.rotation,
    });
  }

  function createMember(socketId, index, total) {
    const player = getPlayer(socketId);
    if (!player) {
      return null;
    }
    const arenaProgress = getArenaProgress(socketId);
    const spawnPoint = buildSpawnPoint(index, total);
    return {
      socketId,
      roomId: null,
      username: player.username || player.accountUsername || ('guest_' + socketId.slice(0, 5)),
      displayName: player.displayName || player.username || 'Guest',
      hp: PLAYER_COMBAT.maxHealth,
      maxHp: PLAYER_COMBAT.maxHealth,
      alive: true,
      spectating: false,
      selectedSlot: arenaProgress.selectedSlot,
      hotbar: arenaProgress.hotbar.slice(),
      cooldowns: {},
      pendingTokens: 0,
      pendingLoot: {},
      tokens: arenaProgress.tokens,
      ownedItems: new Set(arenaProgress.ownedItems),
      consumables: { ...arenaProgress.consumables },
      buffs: [],
      returnPosition: {
        x: Number(player.x) || 0,
        y: Number(player.y) || ARENA_WORLD.hubCenter.y,
        z: Number(player.z) || 0,
        rotation: Number(player.rotation) || 0,
      },
      spawnPoint,
      kills: 0,
      damageDone: 0,
      decision: null,
      matchWave: 0,
      roundWins: 0,
    };
  }

  function awardLootToMember(member, lootItemId, quantity) {
    const item = getCatalogItem(lootItemId);
    if (!item) {
      return;
    }
    if (item.category === 'consumable') {
      member.pendingLoot[lootItemId] = (member.pendingLoot[lootItemId] || 0) + (quantity || 1);
      return;
    }
    if (member.ownedItems.has(lootItemId)) {
      member.pendingTokens += Math.max(8, Math.floor((RARITY_CONFIG[item.rarity] ? RARITY_CONFIG[item.rarity].tokenMultiplier : 1) * 18));
      return;
    }
    member.pendingLoot[lootItemId] = 1;
  }

  function rollLoot(member, enemy) {
    const chance = enemy.type === 'boss' ? 0.85 : enemy.type === 'elite' ? 0.34 : 0.16;
    if (Math.random() > chance) {
      return;
    }
    const weightedEntries = LOOT_TABLE.map(function mapLoot(entry) {
      return { itemId: entry.itemId, weight: entry.weight * rarityWeight(entry.rarity) };
    });
    const rolled = pickWeighted(weightedEntries);
    if (rolled) {
      awardLootToMember(member, rolled.itemId, 1);
    }
  }

  function bankMemberRewards(member) {
    const player = getPlayer(member.socketId);
    if (!player) {
      return;
    }
    player.progress = ensureArenaProgress(player.progress);
    const arena = player.progress.arena;
    arena.tokens += member.pendingTokens;
    Object.entries(member.pendingLoot).forEach(function eachLoot(entry) {
      const itemId = entry[0];
      const amount = entry[1];
      const item = getCatalogItem(itemId);
      if (!item) {
        return;
      }
      if (item.category === 'consumable') {
        arena.consumables[itemId] = (arena.consumables[itemId] || 0) + amount;
        return;
      }
      if (!arena.ownedItems.includes(itemId)) {
        arena.ownedItems.push(itemId);
      }
      if (!arena.unlockedLoot.includes(itemId)) {
        arena.unlockedLoot.push(itemId);
      }
      const emptySlot = arena.hotbar.findIndex(function findEmpty(slot) {
        return !slot;
      });
      if (emptySlot >= 0 && !arena.hotbar.includes(itemId)) {
        arena.hotbar[emptySlot] = itemId;
      }
    });
    arena.selectedSlot = member.selectedSlot;
    arena.stats.highestWave = Math.max(arena.stats.highestWave, member.matchWave || 0);
    arena.stats.lifetimeKills += member.kills;
    arena.stats.matchesPlayed += 1;
    member.pendingTokens = 0;
    member.pendingLoot = {};
    member.tokens = arena.tokens;
    emitProfile(member.socketId);
  }

  function buildEnemy(type, wave) {
    const base = ENEMY_TYPES[type];
    const scale = getEnemyScale(wave);
    const spawn = buildEnemySpawnPoint();
    const hpValue = Math.round(base.baseHp * scale.hp * (type === 'boss' ? 1.2 : 1));
    return {
      id: createId('enemy'),
      type,
      label: base.label,
      color: base.color,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      hp: hpValue,
      maxHp: hpValue,
      damage: Math.round(base.baseDamage * scale.damage),
      moveSpeed: base.moveSpeed * scale.moveSpeed,
      attackRange: base.attackRange,
      attackCooldownMs: base.attackCooldownMs,
      preferredRange: base.preferredRange || 0,
      projectileSpeed: base.projectileSpeed || 0,
      targetId: null,
      lastAttackAt: 0,
      lastSpecialAt: 0,
      phase: 0,
      statusEffects: [],
      tokenScale: base.tokenScale || 1,
      baseType: base,
    };
  }

  function sendSystemMessage(match, message) {
    io.to(match.roomId).emit('arena:message', { message, at: nowMs() });
  }

  function grantKillRewards(member, enemy) {
    member.kills += 1;
    if (Math.random() <= REWARD_CONFIG.dropTokenChance) {
      const dropped = Math.round(randomInt(REWARD_CONFIG.baseTokenDrop[0], REWARD_CONFIG.baseTokenDrop[1]) * enemy.tokenScale * (enemy.type === 'boss' ? REWARD_CONFIG.bossTokenMultiplier : 1));
      member.pendingTokens += dropped;
    }
    rollLoot(member, enemy);
  }

  function applyStatusEffect(enemy, statusConfig, currentTime) {
    if (!statusConfig || !statusConfig.type || !STATUS_EFFECTS[statusConfig.type]) {
      return;
    }
    enemy.statusEffects = enemy.statusEffects.filter(function filterStatus(status) {
      return status.type !== statusConfig.type;
    });
    enemy.statusEffects.push({
      type: statusConfig.type,
      endsAt: currentTime + (statusConfig.durationMs || STATUS_EFFECTS[statusConfig.type].durationMs),
      lastTickAt: currentTime,
    });
  }

  function damageEnemy(match, member, enemy, amount, statusConfig, currentTime) {
    enemy.hp = Math.max(0, enemy.hp - amount);
    member.damageDone += amount;
    if (statusConfig) {
      applyStatusEffect(enemy, statusConfig, currentTime);
    }
    if (enemy.hp <= 0) {
      match.enemies.delete(enemy.id);
      grantKillRewards(member, enemy);
      if (!match.enemies.size && match.status === 'combat') {
        beginIntermission(match);
      }
    }
  }

  function calculateDamage(item, member) {
    const critChance = item.critChance == null ? PLAYER_COMBAT.defaultCritChance : item.critChance;
    const critMultiplier = item.critMultiplier == null ? PLAYER_COMBAT.defaultCritMultiplier : item.critMultiplier;
    const buffMultiplier = member.buffs.reduce(function reduceBuff(product, buff) {
      return product * (buff.damageMultiplier || 1);
    }, 1);
    let damage = item.damage * buffMultiplier;
    if (Math.random() < critChance) {
      damage *= critMultiplier;
    }
    return Math.round(damage);
  }

  function useMelee(match, member, item, currentTime, direction) {
    const player = getPlayer(member.socketId);
    if (!player) {
      return;
    }
    const facing = normalize2D(direction.x || 0, direction.z || 1);
    if (match.mode === 'pvp') {
      match.members.forEach(function eachTarget(target) {
        if (!target.alive || target.socketId === member.socketId) {
          return;
        }
        const targetPlayer = getPlayer(target.socketId);
        if (!targetPlayer) {
          return;
        }
        const dx = Number(targetPlayer.x) - Number(player.x);
        const dz = Number(targetPlayer.z) - Number(player.z);
        const dist = Math.hypot(dx, dz);
        if (dist > item.range) {
          return;
        }
        const toTarget = normalize2D(dx, dz);
        if (facing.x * toTarget.x + facing.z * toTarget.z < -0.1) {
          return;
        }
        damageMember(match, target, calculateDamage(item, member), member);
      });
      return;
    }
    Array.from(match.enemies.values()).forEach(function eachEnemy(enemy) {
      const dx = enemy.x - Number(player.x);
      const dz = enemy.z - Number(player.z);
      const dist = Math.hypot(dx, dz);
      if (dist > item.range) {
        return;
      }
      const toEnemy = normalize2D(dx, dz);
      if (facing.x * toEnemy.x + facing.z * toEnemy.z < -0.1) {
        return;
      }
      damageEnemy(match, member, enemy, calculateDamage(item, member), item.status, currentTime);
      if (!item.splashRadius) {
        return;
      }
      Array.from(match.enemies.values()).forEach(function eachSplashEnemy(splashEnemy) {
        if (splashEnemy.id === enemy.id) {
          return;
        }
        if (distance2D(enemy.x, enemy.z, splashEnemy.x, splashEnemy.z) <= item.splashRadius) {
          damageEnemy(match, member, splashEnemy, Math.round(item.damage * 0.45), null, currentTime);
        }
      });
    });
  }

  function spawnProjectile(match, projectile) {
    match.projectiles.set(projectile.id, projectile);
  }

  function useGun(match, member, item, currentTime, direction) {
    const player = getPlayer(member.socketId);
    if (!player) {
      return;
    }
    const pelletCount = item.pelletCount || 1;
    for (let i = 0; i < pelletCount; i += 1) {
      const spread = item.spread || 0;
      const angleOffset = spread ? randomRange(-spread, spread) : 0;
      const rotated = {
        x: direction.x * Math.cos(angleOffset) - direction.z * Math.sin(angleOffset),
        z: direction.x * Math.sin(angleOffset) + direction.z * Math.cos(angleOffset),
      };
      const normalized = normalize2D(rotated.x, rotated.z);
      spawnProjectile(match, {
        id: createId('proj'),
        ownerType: 'player',
        ownerId: member.socketId,
        itemId: item.id,
        x: Number(player.x),
        y: ARENA_WORLD.hubCenter.y + 1.2,
        z: Number(player.z),
        vx: normalized.x * item.projectileSpeed,
        vz: normalized.z * item.projectileSpeed,
        radius: item.pelletCount ? 0.18 : 0.24,
        damage: item.damage,
        color: item.color,
        expiresAt: currentTime + item.projectileLifeMs,
        pierce: item.pierce || 0,
        status: item.status || null,
        sourceMemberId: member.socketId,
      });
    }
  }

  function useAbility(match, member, item, currentTime, direction) {
    const player = getPlayer(member.socketId);
    if (!player) {
      return;
    }
    if (match.mode === 'pvp') {
      const otherMembers = match.members
        .filter(function filterMember(entry) { return entry.alive && entry.socketId !== member.socketId; })
        .map(function mapMember(entry) {
          return { member: entry, player: getPlayer(entry.socketId) };
        })
        .filter(function filterMissing(entry) { return !!entry.player; });
      if (item.id === 'frost_nova' || item.id === 'venom_pulse') {
        otherMembers.forEach(function eachTarget(entry) {
          if (distance2D(Number(player.x), Number(player.z), Number(entry.player.x), Number(entry.player.z)) <= item.radius) {
            damageMember(match, entry.member, item.damage, member);
          }
        });
        return;
      }
      if (item.id === 'arc_surge') {
        otherMembers
          .sort(function sortEntry(a, b) {
            return distance2D(Number(player.x), Number(player.z), Number(a.player.x), Number(a.player.z))
              - distance2D(Number(player.x), Number(player.z), Number(b.player.x), Number(b.player.z));
          })
          .slice(0, item.chainTargets || 3)
          .forEach(function eachTarget(entry) {
            damageMember(match, entry.member, item.damage, member);
          });
        return;
      }
    }
    if (item.id === 'frost_nova' || item.id === 'venom_pulse') {
      Array.from(match.enemies.values()).forEach(function eachEnemy(enemy) {
        if (distance2D(Number(player.x), Number(player.z), enemy.x, enemy.z) <= item.radius) {
          damageEnemy(match, member, enemy, item.damage, item.status, currentTime);
        }
      });
      return;
    }
    if (item.id === 'arc_surge') {
      Array.from(match.enemies.values())
        .sort(function sortEnemy(a, b) {
          return distance2D(Number(player.x), Number(player.z), a.x, a.z) - distance2D(Number(player.x), Number(player.z), b.x, b.z);
        })
        .slice(0, item.chainTargets || 3)
        .forEach(function eachTarget(enemy) {
          damageEnemy(match, member, enemy, item.damage, item.status, currentTime);
        });
      return;
    }
    useGun(match, member, item, currentTime, direction);
  }

  function useConsumable(member, item, currentTime) {
    if ((member.consumables[item.id] || 0) <= 0) {
      return;
    }
    member.consumables[item.id] -= 1;
    if (item.healAmount) {
      member.hp = clamp(member.hp + item.healAmount, 0, member.maxHp);
    }
    if (item.buff) {
      member.buffs.push({
        type: item.id,
        damageMultiplier: item.buff.damageMultiplier || 1,
        endsAt: currentTime + item.buff.durationMs,
      });
    }
  }

  function handleUseItem(socketId, payload) {
    const match = matches.get(socketToMatchId.get(socketId));
    if (!match || match.status !== 'combat') {
      return;
    }
    const member = match.members.find(function findMember(entry) {
      return entry.socketId === socketId;
    });
    if (!member || !member.alive) {
      return;
    }
    const itemId = member.hotbar[member.selectedSlot];
    const item = getCatalogItem(itemId);
    if (!item) {
      return;
    }
    const currentTime = nowMs();
    if ((member.cooldowns[item.id] || 0) > currentTime) {
      return;
    }
    member.cooldowns[item.id] = currentTime + (item.cooldownMs || 0);
    const rawDirection = payload && payload.direction ? payload.direction : { x: 0, z: 1 };
    const direction = normalize2D(Number(rawDirection.x) || 0, Number(rawDirection.z) || 1);
    if (item.category === 'melee') {
      useMelee(match, member, item, currentTime, direction);
    } else if (item.category === 'gun') {
      useGun(match, member, item, currentTime, direction);
    } else if (item.category === 'ability') {
      useAbility(match, member, item, currentTime, direction);
    } else if (item.category === 'consumable') {
      useConsumable(member, item, currentTime);
    }
    broadcastMatchState(match);
  }

  function damageMember(match, member, amount, attacker) {
    if (!member.alive) {
      return;
    }
    member.hp = clamp(member.hp - amount, 0, member.maxHp);
    if (member.hp <= 0) {
      member.alive = false;
      member.spectating = match.mode === 'coop' || match.mode === 'pvp';
      const player = getPlayer(member.socketId);
      if (player) {
        player.y = ARENA_WORLD.hubCenter.y + ARENA_WORLD.spectatorHeight;
      }
      sendSystemMessage(match, member.displayName + ' was knocked out.');
      if (attacker && attacker.socketId !== member.socketId) {
        attacker.kills += 1;
        attacker.pendingTokens += 12;
      }
      if (match.mode === 'pvp') {
        const aliveMembers = match.members.filter(function findAlive(entry) { return entry.alive; });
        if (!aliveMembers.length) {
          sendSystemMessage(match, 'Round ' + match.wave + ' ended in a draw.');
          beginIntermission(match);
          return;
        }
        if (aliveMembers.length === 1) {
          const winner = aliveMembers[0];
          winner.roundWins = (winner.roundWins || 0) + 1;
          winner.pendingTokens += 35;
          sendSystemMessage(match, winner.displayName + ' won round ' + match.wave + '.');
          if (winner.roundWins >= (match.roundsToWin || 3)) {
            winner.pendingTokens += 60;
            endMatch(match, 'victory');
            return;
          }
          beginIntermission(match);
          return;
        }
      }
      if (!match.members.some(function findAlive(entry) { return entry.alive; })) {
        endMatch(match, 'defeat');
      }
    }
  }

  function processEnemyStatuses(match, enemy, currentTime) {
    enemy.statusEffects = enemy.statusEffects.filter(function filterStatus(status) {
      return status.endsAt > currentTime;
    });
    enemy.statusEffects.forEach(function eachStatus(status) {
      if (currentTime - status.lastTickAt < PLAYER_COMBAT.statusTickMs) {
        return;
      }
      status.lastTickAt = currentTime;
      const template = STATUS_EFFECTS[status.type];
      if (template && template.tickDamage) {
        const killer = match.members.find(function findAlive(entry) { return entry.alive; }) || match.members[0];
        if (killer) {
          damageEnemy(match, killer, enemy, template.tickDamage, null, currentTime);
        }
      }
    });
  }

  function getNearestAliveMember(match, enemy) {
    let nearest = null;
    let nearestDistance = Infinity;
    match.members.forEach(function eachMember(member) {
      if (!member.alive) {
        return;
      }
      const player = getPlayer(member.socketId);
      if (!player) {
        return;
      }
      const dist = distance2D(enemy.x, enemy.z, Number(player.x) || 0, Number(player.z) || 0);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearest = { member, player, dist };
      }
    });
    return nearest;
  }

  function tickEnemy(match, enemy, currentTime) {
    processEnemyStatuses(match, enemy, currentTime);
    if (!match.enemies.has(enemy.id)) {
      return;
    }
    const nearest = getNearestAliveMember(match, enemy);
    if (!nearest) {
      return;
    }
    enemy.targetId = nearest.member.socketId;
    const slowMultiplier = enemy.statusEffects.reduce(function reduceStatus(multiplier, status) {
      return status.type === 'freeze' ? multiplier * (STATUS_EFFECTS.freeze.speedMultiplier || 1) : multiplier;
    }, 1);
    const dx = Number(nearest.player.x) - enemy.x;
    const dz = Number(nearest.player.z) - enemy.z;
    const dir = normalize2D(dx, dz);
    if (enemy.type === 'ranged' && nearest.dist < enemy.preferredRange) {
      enemy.x -= dir.x * enemy.moveSpeed * slowMultiplier * (MATCHMAKING.tickMs / 1000);
      enemy.z -= dir.z * enemy.moveSpeed * slowMultiplier * (MATCHMAKING.tickMs / 1000);
    } else if (nearest.dist > enemy.attackRange) {
      enemy.x += dir.x * enemy.moveSpeed * slowMultiplier * (MATCHMAKING.tickMs / 1000);
      enemy.z += dir.z * enemy.moveSpeed * slowMultiplier * (MATCHMAKING.tickMs / 1000);
    }
    if (distance2D(enemy.x, enemy.z, ARENA_WORLD.hubCenter.x, ARENA_WORLD.hubCenter.z) > ARENA_WORLD.innerCombatRadius + 1) {
      const towardCenter = normalize2D(ARENA_WORLD.hubCenter.x - enemy.x, ARENA_WORLD.hubCenter.z - enemy.z);
      enemy.x += towardCenter.x * 0.75;
      enemy.z += towardCenter.z * 0.75;
    }
    if (enemy.type === 'elite' && currentTime - enemy.lastSpecialAt >= enemy.baseType.specialCooldownMs && nearest.dist <= enemy.baseType.dashRange) {
      enemy.lastSpecialAt = currentTime;
      enemy.x += dir.x * 2.8;
      enemy.z += dir.z * 2.8;
      damageMember(match, nearest.member, enemy.damage + 6);
      return;
    }
    if (enemy.type === 'boss') {
      const ratio = enemy.hp / enemy.maxHp;
      enemy.phase = ratio <= enemy.baseType.phaseThresholds[1] ? 2 : ratio <= enemy.baseType.phaseThresholds[0] ? 1 : 0;
      if (currentTime - enemy.lastSpecialAt >= enemy.baseType.aoeCooldownMs) {
        enemy.lastSpecialAt = currentTime;
        match.members.forEach(function eachTarget(member) {
          if (!member.alive) {
            return;
          }
          const player = getPlayer(member.socketId);
          if (!player) {
            return;
          }
          if (distance2D(enemy.x, enemy.z, Number(player.x), Number(player.z)) <= 5.5) {
            damageMember(match, member, enemy.damage + 10 + enemy.phase * 4);
          }
        });
      }
      if (currentTime - enemy.lastAttackAt >= enemy.baseType.summonCooldownMs) {
        enemy.lastAttackAt = currentTime;
        const summonCount = 2 + enemy.phase;
        for (let i = 0; i < summonCount; i += 1) {
          const summon = buildEnemy(i % 2 === 0 ? 'basic' : 'ranged', match.wave);
          summon.x = enemy.x + randomRange(-2, 2);
          summon.z = enemy.z + randomRange(-2, 2);
          match.enemies.set(summon.id, summon);
        }
      }
    }
    if (nearest.dist <= enemy.attackRange && currentTime - enemy.lastAttackAt >= enemy.attackCooldownMs) {
      enemy.lastAttackAt = currentTime;
      if (enemy.type === 'ranged' || enemy.type === 'boss') {
        spawnProjectile(match, {
          id: createId('proj'),
          ownerType: 'enemy',
          ownerId: enemy.id,
          x: enemy.x,
          y: enemy.y + 1,
          z: enemy.z,
          vx: dir.x * (enemy.projectileSpeed || 12),
          vz: dir.z * (enemy.projectileSpeed || 12),
          radius: enemy.type === 'boss' ? 0.4 : 0.26,
          damage: enemy.damage + enemy.phase * 3,
          color: enemy.color,
          expiresAt: currentTime + 2200,
        });
      } else {
        damageMember(match, nearest.member, enemy.damage);
      }
    }
  }

  function tickProjectiles(match, currentTime) {
    Array.from(match.projectiles.values()).forEach(function eachProjectile(projectile) {
      if (projectile.expiresAt <= currentTime) {
        match.projectiles.delete(projectile.id);
        return;
      }
      projectile.x += projectile.vx * (MATCHMAKING.tickMs / 1000);
      projectile.z += projectile.vz * (MATCHMAKING.tickMs / 1000);
      if (distance2D(projectile.x, projectile.z, ARENA_WORLD.hubCenter.x, ARENA_WORLD.hubCenter.z) > ARENA_WORLD.innerCombatRadius + 2) {
        match.projectiles.delete(projectile.id);
        return;
      }
      if (projectile.ownerType === 'player') {
        const member = match.members.find(function findMember(entry) { return entry.socketId === projectile.sourceMemberId; });
        if (!member) {
          match.projectiles.delete(projectile.id);
          return;
        }
        if (match.mode === 'pvp') {
          match.members.some(function hitTarget(target) {
            if (!target.alive || target.socketId === projectile.sourceMemberId) {
              return false;
            }
            const player = getPlayer(target.socketId);
            if (!player) {
              return false;
            }
            if (distance2D(projectile.x, projectile.z, Number(player.x), Number(player.z)) <= projectile.radius + 0.9) {
              damageMember(match, target, projectile.damage, member);
              if (projectile.pierce > 0) {
                projectile.pierce -= 1;
              } else {
                match.projectiles.delete(projectile.id);
              }
              return true;
            }
            return false;
          });
          return;
        }
        Array.from(match.enemies.values()).some(function hitEnemy(enemy) {
          if (distance2D(projectile.x, projectile.z, enemy.x, enemy.z) <= projectile.radius + 0.8) {
            damageEnemy(match, member, enemy, projectile.damage, projectile.status, currentTime);
            if (projectile.pierce > 0) {
              projectile.pierce -= 1;
            } else {
              match.projectiles.delete(projectile.id);
            }
            return true;
          }
          return false;
        });
        return;
      }
      match.members.some(function hitMember(member) {
        if (!member.alive) {
          return false;
        }
        const player = getPlayer(member.socketId);
        if (!player) {
          return false;
        }
        if (distance2D(projectile.x, projectile.z, Number(player.x), Number(player.z)) <= projectile.radius + 0.9) {
          damageMember(match, member, projectile.damage);
          match.projectiles.delete(projectile.id);
          return true;
        }
        return false;
      });
    });
  }

  function beginIntermission(match) {
    match.status = 'intermission';
    match.intermissionEndsAt = nowMs() + (match.mode === 'pvp' ? 5000 : MATCHMAKING.intermissionMs);
    match.projectiles.clear();
    if (match.mode === 'pvp') {
      match.members.forEach(function eachMember(member) {
        member.decision = null;
      });
      broadcastMatchState(match);
      return;
    }
    const waveReward = REWARD_CONFIG.waveTokenBase + (match.wave - 1) * REWARD_CONFIG.waveTokenGrowth + (match.wave % 5 === 0 ? REWARD_CONFIG.bossWaveBonus : 0);
    match.members.forEach(function eachMember(member) {
      member.pendingTokens += waveReward;
      member.decision = null;
    });
    sendSystemMessage(match, 'Wave ' + match.wave + ' cleared. Cash out or continue.');
    broadcastMatchState(match);
  }

  async function endMatch(match, outcome) {
    if (match.status === 'ended') {
      return;
    }
    match.status = 'ended';
    const shouldBank = outcome === 'cashout' || outcome === 'victory';
    const summary = { outcome, wave: match.wave, rewards: {} };
    for (const member of match.members) {
      if (shouldBank) {
        bankMemberRewards(member);
        await flushProgress(member.socketId);
      } else {
        emitProfile(member.socketId);
      }
      const player = getPlayer(member.socketId);
      summary.rewards[member.socketId] = {
        bankedTokens: player && player.progress && player.progress.arena ? player.progress.arena.tokens : member.tokens,
        pendingLoot: { ...member.pendingLoot },
        kills: member.kills,
      };
    }
    io.to(match.roomId).emit('arena:matchEnded', summary);
    setTimeout(function cleanupMatch() {
      match.members.forEach(function eachMember(member) {
        socketToMatchId.delete(member.socketId);
        returnPlayerFromArena(member);
      });
      matches.delete(match.id);
    }, MATCHMAKING.endDelayMs);
  }

  function resolveIntermission(match, forcedDecision) {
    if (match.mode === 'pvp') {
      if (forcedDecision === 'continue' || nowMs() >= match.intermissionEndsAt) {
        startNextWave(match);
      }
      return;
    }
    const continueVotes = match.members.filter(function filterDecision(member) { return member.decision === 'continue'; }).length;
    const cashoutVotes = match.members.filter(function filterCashout(member) { return member.decision === 'cashout'; }).length;
    const eligibleCount = Math.max(1, Math.ceil(match.members.length / 2));
    if (forcedDecision === 'cashout' || cashoutVotes >= eligibleCount) {
      endMatch(match, 'cashout');
      return;
    }
    if (forcedDecision === 'continue' || continueVotes >= eligibleCount || nowMs() >= match.intermissionEndsAt) {
      startNextWave(match);
    }
  }

  function startNextWave(match) {
    match.wave += 1;
    match.status = 'combat';
    match.intermissionEndsAt = 0;
    match.projectiles.clear();
    match.enemies.clear();
    match.members.forEach(function eachMember(member) {
      member.decision = null;
      member.matchWave = match.wave;
      member.alive = true;
      member.spectating = false;
      member.hp = member.maxHp;
      const player = getPlayer(member.socketId);
      if (player) {
        player.x = member.spawnPoint.x;
        player.y = member.spawnPoint.y;
        player.z = member.spawnPoint.z;
      }
    });
    if (match.mode === 'pvp') {
      if (match.members.length === 1) {
        match.members[0].roundWins = match.roundsToWin || 3;
        match.members[0].pendingTokens += 60;
        endMatch(match, 'victory');
        return;
      }
      sendSystemMessage(match, 'Round ' + match.wave + ' started.');
      broadcastMatchState(match);
      return;
    }
    buildWaveComposition(match.wave).forEach(function eachWaveEntry(entry) {
      for (let i = 0; i < entry.count; i += 1) {
        const enemy = buildEnemy(entry.type, match.wave);
        match.enemies.set(enemy.id, enemy);
      }
    });
    broadcastMatchState(match);
  }

  function createMatch(mode, socketIds) {
    const matchId = createId('match');
    const roomId = ARENA_ROOM_PREFIX + matchId;
    const match = {
      id: matchId,
      roomId,
      mode,
      createdAt: nowMs(),
      status: 'starting',
      wave: 0,
      intermissionEndsAt: 0,
      enemies: new Map(),
      projectiles: new Map(),
      roundsToWin: mode === 'pvp' ? 3 : 0,
      members: socketIds.map(function mapSocket(socketId, index) {
        return createMember(socketId, index, socketIds.length);
      }).filter(Boolean),
    };
    match.members.forEach(function eachMember(member) {
      member.roomId = roomId;
      movePlayerToArena(member.socketId, member.spawnPoint, roomId);
      socketToMatchId.set(member.socketId, matchId);
    });
    matches.set(matchId, match);
    startNextWave(match);
    return match;
  }

  function maybeStartQueue() {
    if (!queue.entries.length) {
      return;
    }
    if (!queue.startsAt) {
      queue.startsAt = nowMs();
      queue.timerEndsAt = queue.startsAt + MATCHMAKING.queueTimerMs;
    }
    const targetSize = Math.max(2, Math.min(queue.targetSize || MATCHMAKING.maxPlayers, MATCHMAKING.maxPlayers));
    if (queue.entries.length >= targetSize || nowMs() >= queue.timerEndsAt) {
      const startCount = Math.max(1, Math.min(queue.entries.length, targetSize));
      const socketIds = queue.entries.splice(0, startCount).map(function mapEntry(entry) { return entry.socketId; });
      queue.startsAt = 0;
      queue.timerEndsAt = 0;
      queue.targetSize = 0;
      queue.ownerSocketId = null;
      createMatch('pvp', socketIds);
      broadcastQueueState();
    }
  }

  function startSolo(socketId) {
    leaveQueue(socketId);
    if (socketToMatchId.has(socketId)) {
      return;
    }
    createMatch('solo', [socketId]);
  }

  function joinCoopQueue(socketId, options) {
    if (socketToMatchId.has(socketId)) {
      return;
    }
    const player = getPlayer(socketId);
    if (!player || queue.entries.some(function hasPlayer(entry) { return entry.socketId === socketId; })) {
      broadcastQueueState();
      return;
    }
    if (!queue.entries.length) {
      queue.targetSize = clamp(Math.floor(Number(options && options.targetSize) || MATCHMAKING.maxPlayers), 2, MATCHMAKING.maxPlayers);
      queue.ownerSocketId = socketId;
      queue.startsAt = nowMs();
      queue.timerEndsAt = queue.startsAt + MATCHMAKING.queueTimerMs;
    }
    queue.entries.push({
      socketId,
      username: player.username || player.accountUsername || ('guest_' + socketId.slice(0, 5)),
      displayName: player.displayName || player.username || 'Guest',
      joinedAt: nowMs(),
    });
    broadcastQueueState();
    maybeStartQueue();
  }

  async function buyShopItem(socketId, itemId) {
    const player = getPlayer(socketId);
    const item = getCatalogItem(itemId);
    if (!player || !item || !item.shop) {
      return;
    }
    player.progress = ensureArenaProgress(player.progress);
    const arena = player.progress.arena;
    if (arena.ownedItems.includes(itemId) || arena.tokens < item.price) {
      emitProfile(socketId);
      return;
    }
    arena.tokens -= item.price;
    arena.ownedItems.push(itemId);
    if (!arena.unlockedLoot.includes(itemId)) {
      arena.unlockedLoot.push(itemId);
    }
    const emptySlot = arena.hotbar.findIndex(function findEmpty(slot) { return !slot; });
    if (emptySlot >= 0) {
      arena.hotbar[emptySlot] = itemId;
    }
    await flushProgress(socketId);
    emitProfile(socketId);
  }

  async function setHotbar(socketId, hotbar) {
    const player = getPlayer(socketId);
    if (!player || !Array.isArray(hotbar)) {
      return;
    }
    player.progress = ensureArenaProgress(player.progress);
    const arena = player.progress.arena;
    arena.hotbar = Array.from({ length: 9 }, function mapSlot(_, index) {
      const itemId = hotbar[index] || null;
      return itemId && arena.ownedItems.includes(itemId) ? itemId : null;
    });
    if (!arena.hotbar[0]) {
      arena.hotbar[0] = 'rust_sword';
    }
    await flushProgress(socketId);
    emitProfile(socketId);
  }

  async function selectSlot(socketId, slotIndex) {
    const selectedSlot = clamp(Math.floor(Number(slotIndex) || 0), 0, 8);
    const match = matches.get(socketToMatchId.get(socketId));
    if (match) {
      const member = match.members.find(function findMember(entry) { return entry.socketId === socketId; });
      if (member) {
        member.selectedSlot = selectedSlot;
        broadcastMatchState(match);
      }
    }
    const player = getPlayer(socketId);
    if (!player) {
      return;
    }
    player.progress = ensureArenaProgress(player.progress);
    player.progress.arena.selectedSlot = selectedSlot;
    await flushProgress(socketId);
    emitProfile(socketId);
  }

  function setDecision(socketId, decision) {
    const match = matches.get(socketToMatchId.get(socketId));
    if (!match || match.status !== 'intermission') {
      return;
    }
    if (match.mode === 'pvp') {
      return;
    }
    const member = match.members.find(function findMember(entry) { return entry.socketId === socketId; });
    if (!member) {
      return;
    }
    member.decision = decision === 'cashout' ? 'cashout' : 'continue';
    resolveIntermission(match, null);
    broadcastMatchState(match);
  }

  async function leaveMatch(socketId) {
    const match = matches.get(socketToMatchId.get(socketId));
    if (!match) {
      return;
    }
    const member = match.members.find(function findMember(entry) { return entry.socketId === socketId; });
    if (!member) {
      return;
    }
    socketToMatchId.delete(socketId);
    if (match.mode === 'solo') {
      await endMatch(match, 'defeat');
      return;
    }
    returnPlayerFromArena(member);
    match.members = match.members.filter(function filterMember(entry) { return entry.socketId !== socketId; });
    if (!match.members.some(function hasAlive(entry) { return entry.alive; })) {
      await endMatch(match, 'defeat');
      return;
    }
    broadcastMatchState(match);
  }

  function tickMatch(match, currentTime) {
    if (match.status === 'combat') {
      if (match.mode !== 'pvp') {
        Array.from(match.enemies.values()).forEach(function eachEnemy(enemy) {
          tickEnemy(match, enemy, currentTime);
        });
      }
      tickProjectiles(match, currentTime);
      match.members.forEach(function eachMember(member) {
        member.buffs = member.buffs.filter(function filterBuff(buff) { return buff.endsAt > currentTime; });
      });
      if (match.mode !== 'pvp' && !match.enemies.size && match.status === 'combat') {
        beginIntermission(match);
      }
    } else if (match.status === 'intermission' && currentTime >= match.intermissionEndsAt) {
      resolveIntermission(match, 'continue');
    }
    broadcastMatchState(match);
  }

  function attachSocket(socket) {
    sockets.set(socket.id, socket);
    socket.on('arena:requestSync', function onRequestSync() {
      emitProfile(socket.id);
      broadcastQueueState();
      const match = matches.get(socketToMatchId.get(socket.id));
      if (match) {
        broadcastMatchState(match);
      }
    });
    socket.on('arena:startSolo', function onStartSolo() { startSolo(socket.id); });
    socket.on('arena:joinCoop', function onJoinCoop(options) { joinCoopQueue(socket.id, options || {}); });
    socket.on('arena:leaveQueue', function onLeaveQueue() { leaveQueue(socket.id); });
    socket.on('arena:buyItem', function onBuyItem(itemId) { buyShopItem(socket.id, itemId).catch(function swallow() {}); });
    socket.on('arena:setHotbar', function onSetHotbar(hotbar) { setHotbar(socket.id, hotbar).catch(function swallow() {}); });
    socket.on('arena:selectSlot', function onSelectSlot(slotIndex) { selectSlot(socket.id, slotIndex).catch(function swallow() {}); });
    socket.on('arena:useItem', function onUseItem(payload) { handleUseItem(socket.id, payload); });
    socket.on('arena:decision', function onDecision(decision) { setDecision(socket.id, decision); });
    socket.on('arena:quitMatch', function onQuitMatch() { leaveMatch(socket.id).catch(function swallow() {}); });
    socket.on('disconnect', function onDisconnect() {
      sockets.delete(socket.id);
      leaveQueue(socket.id);
      leaveMatch(socket.id).catch(function swallow() {});
    });
  }

  const interval = setInterval(function tickRuntime() {
    maybeStartQueue();
    const currentTime = nowMs();
    Array.from(matches.values()).forEach(function eachMatch(match) {
      tickMatch(match, currentTime);
    });
  }, MATCHMAKING.tickMs);

  if (typeof interval.unref === 'function') {
    interval.unref();
  }

  return {
    attachSocket,
    getQueueSnapshot: function getQueueSnapshot() {
      return buildQueueSnapshot(queue);
    },
    getArenaHubConfig: function getArenaHubConfig() {
      return {
        world: ARENA_WORLD,
        shopInventory: getShopInventory(),
      };
    },
  };
}
