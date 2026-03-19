export const ARENA_ROOM_PREFIX = 'arena:';

export const ARENA_WORLD = {
  hubCenter: { x: -48, y: 1.25, z: 86 },
  islandRadius: 18,
  innerCombatRadius: 13.5,
  spawnRingRadius: 7.5,
  enemySpawnRadius: 10.5,
  spectatorHeight: 10,
};

export const MATCHMAKING = {
  queueTimerMs: 18000,
  minPlayers: 2,
  maxPlayers: 4,
  intermissionMs: 12000,
  endDelayMs: 5000,
  tickMs: 100,
};

export const PLAYER_COMBAT = {
  maxHealth: 120,
  reviveBreakMs: 1800,
  defaultCritChance: 0.08,
  defaultCritMultiplier: 1.7,
  statusTickMs: 1000,
  baseMoveSpeed: 6.5,
};

export const REWARD_CONFIG = {
  dropTokenChance: 0.65,
  baseTokenDrop: [2, 5],
  bossTokenMultiplier: 3.5,
  waveTokenBase: 12,
  waveTokenGrowth: 4,
  bossWaveBonus: 30,
};

export const RARITY_CONFIG = {
  common: { label: 'Common', color: '#b7c4d4', lootWeight: 54, tokenMultiplier: 1 },
  rare: { label: 'Rare', color: '#50b4ff', lootWeight: 25, tokenMultiplier: 1.3 },
  epic: { label: 'Epic', color: '#b66cff', lootWeight: 14, tokenMultiplier: 1.7 },
  legendary: { label: 'Legendary', color: '#ffbf47', lootWeight: 6, tokenMultiplier: 2.2 },
  mythic: { label: 'Mythic', color: '#ff5f7a', lootWeight: 1, tokenMultiplier: 3.2 },
};

export const ENEMY_TYPES = {
  basic: {
    id: 'basic',
    label: 'Raider',
    role: 'melee',
    color: '#d6d7db',
    baseHp: 50,
    baseDamage: 9,
    moveSpeed: 2.8,
    attackRange: 1.5,
    attackCooldownMs: 1200,
    touchDamage: true,
    scoreValue: 1,
    tokenScale: 1,
  },
  tank: {
    id: 'tank',
    label: 'Bulwark',
    role: 'melee',
    color: '#7d8797',
    baseHp: 130,
    baseDamage: 16,
    moveSpeed: 1.65,
    attackRange: 1.8,
    attackCooldownMs: 1500,
    touchDamage: true,
    scoreValue: 2,
    tokenScale: 1.4,
  },
  ranged: {
    id: 'ranged',
    label: 'Slinger',
    role: 'ranged',
    color: '#5db3ff',
    baseHp: 65,
    baseDamage: 10,
    moveSpeed: 2.15,
    preferredRange: 7.5,
    attackRange: 12,
    attackCooldownMs: 1800,
    projectileSpeed: 13,
    scoreValue: 2,
    tokenScale: 1.2,
  },
  elite: {
    id: 'elite',
    label: 'Executioner',
    role: 'elite',
    color: '#9b67ff',
    baseHp: 180,
    baseDamage: 18,
    moveSpeed: 3,
    attackRange: 2.2,
    attackCooldownMs: 1100,
    specialCooldownMs: 6500,
    dashRange: 5.5,
    scoreValue: 4,
    tokenScale: 1.9,
  },
  boss: {
    id: 'boss',
    label: 'Arena Overlord',
    role: 'boss',
    color: '#ff6b52',
    baseHp: 520,
    baseDamage: 24,
    moveSpeed: 2.45,
    attackRange: 3.4,
    attackCooldownMs: 1250,
    projectileSpeed: 10,
    summonCooldownMs: 9000,
    aoeCooldownMs: 7000,
    phaseThresholds: [0.66, 0.33],
    scoreValue: 12,
    tokenScale: 4,
  },
};

export const WAVE_TABLE = {
  basic: [1, 0.55],
  tank: [0, 0.24],
  ranged: [0, 0.22],
  elite: [0, 0.13],
};

export const STATUS_EFFECTS = {
  burn: { id: 'burn', label: 'Burn', color: '#ff8c42', durationMs: 4500, tickDamage: 5 },
  freeze: { id: 'freeze', label: 'Freeze', color: '#7bd6ff', durationMs: 2500, speedMultiplier: 0.45 },
  poison: { id: 'poison', label: 'Poison', color: '#7de26d', durationMs: 5000, tickDamage: 4 },
};
