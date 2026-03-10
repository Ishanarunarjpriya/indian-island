import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

function normalizeIceServerEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const urlsRaw = entry.urls;
  const urls = Array.isArray(urlsRaw)
    ? urlsRaw.filter((u) => typeof u === 'string' && u.trim())
    : (typeof urlsRaw === 'string' && urlsRaw.trim() ? [urlsRaw.trim()] : []);
  if (!urls.length) return null;
  const normalized = { urls };
  if (typeof entry.username === 'string' && entry.username.trim()) {
    normalized.username = entry.username.trim();
  }
  if (typeof entry.credential === 'string' && entry.credential.trim()) {
    normalized.credential = entry.credential.trim();
  }
  return normalized;
}

function parseIceServersFromEnv(rawValue) {
  const fallback = [
    { urls: ['stun:stun.l.google.com:19302'] },
    { urls: ['stun:stun1.l.google.com:19302'] },
    { urls: ['stun:stun2.l.google.com:19302'] }
  ];
  if (!rawValue || typeof rawValue !== 'string') return fallback;
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return fallback;
    const normalized = parsed
      .map(normalizeIceServerEntry)
      .filter(Boolean);
    return normalized.length ? normalized : fallback;
  } catch {
    return fallback;
  }
}

app.get('/db-test', async (req, res) => {
  if (!USE_TURSO) {
    res.status(400).json({ ok: false, error: 'TURSO_DATABASE_URL not configured.' });
    return;
  }
  try {
    const client = getDbClient();
    const result = await client.execute('select datetime(\'now\') as now');
    res.json({ ok: true, now: result.rows?.[0]?.now || null });
  } catch (err) {
    console.error('[db-test] DB ERROR:', err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

const PORT = process.env.PORT || 3000;
const TURSO_DATABASE_URL = typeof process.env.TURSO_DATABASE_URL === 'string'
  ? process.env.TURSO_DATABASE_URL.trim()
  : '';
const TURSO_AUTH_TOKEN = typeof process.env.TURSO_AUTH_TOKEN === 'string'
  ? process.env.TURSO_AUTH_TOKEN.trim()
  : '';
const USE_TURSO = TURSO_DATABASE_URL.length > 0;
const VOICE_ICE_SERVERS = parseIceServersFromEnv(process.env.VOICE_ICE_SERVERS_JSON);
const WORLD_LIMIT = 40;
const ISLAND_SURFACE_Y = 1.35;
const LIGHTHOUSE_POS = {
  x: WORLD_LIMIT * 1.65,
  z: -WORLD_LIMIT * 1.85
};
const LIGHTHOUSE_RADIUS = 11.7;
const INTERIOR_POS = { x: -130, z: 210 };
const INTERIOR_RADIUS = 11.2;
const SWIM_MIN_RADIUS = WORLD_LIMIT + 0.6;
const SWIM_MAX_RADIUS = WORLD_LIMIT * 3.9;
const SWIM_MIN_Y = -0.15;
const PLAYABLE_BOUND = WORLD_LIMIT * 5.6;
const MINE_POS = { x: 140, z: 140 };
const MINE_RADIUS = 52;
const MINE_PLAY_RADIUS = MINE_RADIUS - 3;
const MINE_SWIM_BLOCK_RADIUS = MINE_RADIUS + 34;
const MINE_ORE_TRADER_POS = { x: MINE_POS.x + 30.5, z: MINE_POS.z - 22.5 };
const MINE_ENTRY_ISLAND_POS = { x: -WORLD_LIMIT * 1.95, z: -WORLD_LIMIT * 1.2 };
const MINE_ENTRY_ISLAND_RADIUS = 11.4;
const FISHING_ISLAND_POS = { x: WORLD_LIMIT * 2.2, z: WORLD_LIMIT * 1.85 };
const FISHING_ISLAND_RADIUS = 11.9;
const MARKET_ISLAND_POS = { x: -WORLD_LIMIT * 2.35, z: WORLD_LIMIT * 1.2 };
const MARKET_ISLAND_RADIUS = 11.5;
const FURNITURE_ISLAND_POS = { x: WORLD_LIMIT * 0.35, z: WORLD_LIMIT * 3.0 };
const FURNITURE_ISLAND_RADIUS = 11.4;
const LEADERBOARD_ISLAND_POS = { x: WORLD_LIMIT * 2.8, z: -WORLD_LIMIT * 0.95 };
const LEADERBOARD_ISLAND_RADIUS = 11.2;
const MAIN_HOUSE_POS = { x: -WORLD_LIMIT * 0.33, z: WORLD_LIMIT * 0.12 };
const MAIN_HOUSE_NO_SPAWN_RADIUS = 8.8;
const HOUSE_ROOM_POS = { x: -220, z: -210 };
const HOUSE_ROOM_RADIUS = 10.8;
const INTERACT_RANGE = 4;
const CHAT_MAX_LEN = 220;
const NAME_MAX_LEN = 18;
const ACCOUNT_ROLE_TAG_BY_PROFILE_ID = new Map([
  ['acct-devansh', 'Creator'],
  ['acct-ishyfishyinthedishy', 'Creator'],
  ['acct-eye_wonder_who', 'Creator']
]);
const CHAT_FILTER_WORDS = [
  'fuck',
  'fucking',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dick',
  'pussy',
  'cunt',
  'nigger',
  'nigga',
  'whore',
  'slut',
  'rape',
  'retard'
];
const HAIR_STYLES = new Set(['none', 'short', 'sidepart', 'spiky', 'long', 'ponytail', 'bob', 'wavy']);
const FACE_STYLES = new Set(['smile', 'serious', 'grin', 'wink', 'lashessmile', 'soft']);
const ACCESSORY_TYPES = new Set(['hat', 'glasses', 'backpack']);
const ORE_TYPES = new Set(['stone', 'iron', 'gold', 'diamond']);
const PICKAXE_ORDER = ['wood', 'stone', 'iron', 'diamond'];
const PICKAXE_PRICE = {
  stone: 360,
  iron: 840,
  diamond: 1860
};
const PICKAXE_LEVEL_REQUIREMENT = {
  wood: 1,
  stone: 2,
  iron: 5,
  diamond: 9
};
const FISHING_ROD_LEVEL_REQUIREMENT = {
  basic: 1,
  reinforced: 4,
  expert: 7,
  master: 11,
  mythic: 15
};
const MAX_PLAYER_LEVEL = 60;
const BASE_XP_TO_LEVEL = 110;
const XP_PER_LEVEL_STEP = 35;
const FISHING_ROD_PRICE = 780;
const MAX_STAMINA_BONUS_PCT = 50;
const FISH_STAMINA_GAIN_PER_FISH = 5;
const FISH_CATCH_COOLDOWN_MS = 1800;
const FISH_CHALLENGE_EXPIRE_MS = 20_000;
const FURNITURE_TRADER_CYCLE_MS = 30 * 60 * 1000;
const FURNITURE_TRADER_PURCHASE_LIMIT = 2;
const FISH_RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const FISH_SELL_BY_RARITY = {
  common: 18,
  uncommon: 32,
  rare: 56,
  epic: 120,
  legendary: 320,
  mythic: 1500
};
const ORE_SELL_PRICE = {
  stone: 2,
  iron: 8,
  gold: 22,
  diamond: 120
};
const HOME_ROOM_PAINT_PRICE = 90;
const HOME_ROOM_FURNITURE_SHOP = {
  bed: { label: 'Bed', price: 520, stock: 1, occasionallyAvailable: false },
  table: { label: 'Table', price: 320, stock: 1, occasionallyAvailable: false },
  lamp: { label: 'Lamp', price: 220, stock: 1, occasionallyAvailable: true, availabilityChance: 0.62 },
  plant: { label: 'Plant', price: 180, stock: 1, occasionallyAvailable: true, availabilityChance: 0.48 }
};
const HOME_ROOM_FURNITURE_PRICE = Object.fromEntries(
  Object.entries(HOME_ROOM_FURNITURE_SHOP).map(([itemId, item]) => [itemId, item.price])
);
const HOME_ROOM_FURNITURE_IDS = Object.keys(HOME_ROOM_FURNITURE_PRICE);
const HOME_ROOM_WALL_PAINTS = new Set(['sand', 'sky', 'mint', 'slate', 'rose']);
const HOME_ROOM_FLOOR_PAINTS = new Set(['oak', 'walnut', 'slate', 'pine']);
const FISH_ROD_TIERS = ['basic', 'reinforced', 'expert', 'master', 'mythic'];
const FISH_ROD_DATA = {
  basic: {
    label: 'Basic Rod',
    rarityWeights: { common: 68, uncommon: 22, rare: 8, epic: 2, legendary: 0, mythic: 0 },
    difficultyAssist: { zoneBonus: 0, requiredHoldScale: 1.0 },
    next: {
      tier: 'reinforced',
      coins: 1950,
      fishCost: { 'pond-minnow': 12, 'coral-perch': 6 }
    }
  },
  reinforced: {
    label: 'Reinforced Rod',
    rarityWeights: { common: 51, uncommon: 28, rare: 13, epic: 6, legendary: 2, mythic: 0 },
    difficultyAssist: { zoneBonus: 0.02, requiredHoldScale: 0.93 },
    next: {
      tier: 'expert',
      coins: 5400,
      fishCost: { 'drift-trout': 8, 'thunder-pike': 4 }
    }
  },
  expert: {
    label: 'Expert Rod',
    rarityWeights: { common: 37, uncommon: 30, rare: 18, epic: 9, legendary: 4, mythic: 2 },
    difficultyAssist: { zoneBonus: 0.035, requiredHoldScale: 0.88 },
    next: {
      tier: 'master',
      coins: 12600,
      fishCost: { 'lava-char': 8, 'sunblade-mako': 4 }
    }
  },
  master: {
    label: 'Master Rod',
    rarityWeights: { common: 24, uncommon: 29, rare: 22, epic: 13, legendary: 8, mythic: 4 },
    difficultyAssist: { zoneBonus: 0.05, requiredHoldScale: 0.82 },
    next: {
      tier: 'mythic',
      coins: 28800,
      fishCost: { 'deepfin-marlin': 8, 'void-whalelet': 2 }
    }
  },
  mythic: {
    label: 'Mythic Rod',
    rarityWeights: { common: 14, uncommon: 24, rare: 26, epic: 18, legendary: 12, mythic: 6 },
    difficultyAssist: { zoneBonus: 0.065, requiredHoldScale: 0.76 },
    next: null
  }
};
const FISH_DIFFICULTY_BY_RARITY = {
  common: { zoneWidth: 0.28, zoneSpeed: 0.42, requiredHoldMs: 900, cursorRiseSpeed: 0.85, cursorFallSpeed: 0.72, decaySpeed: 0.32, timeoutMs: 9400 },
  uncommon: { zoneWidth: 0.24, zoneSpeed: 0.52, requiredHoldMs: 1150, cursorRiseSpeed: 0.95, cursorFallSpeed: 0.8, decaySpeed: 0.4, timeoutMs: 9800 },
  rare: { zoneWidth: 0.2, zoneSpeed: 0.64, requiredHoldMs: 1420, cursorRiseSpeed: 1.06, cursorFallSpeed: 0.9, decaySpeed: 0.5, timeoutMs: 10_400 },
  epic: { zoneWidth: 0.17, zoneSpeed: 0.76, requiredHoldMs: 1700, cursorRiseSpeed: 1.2, cursorFallSpeed: 1.02, decaySpeed: 0.58, timeoutMs: 11_000 },
  legendary: { zoneWidth: 0.14, zoneSpeed: 0.88, requiredHoldMs: 2000, cursorRiseSpeed: 1.34, cursorFallSpeed: 1.14, decaySpeed: 0.67, timeoutMs: 11_800 },
  mythic: { zoneWidth: 0.12, zoneSpeed: 1.0, requiredHoldMs: 2400, cursorRiseSpeed: 1.48, cursorFallSpeed: 1.28, decaySpeed: 0.78, timeoutMs: 12_600 }
};
const FISH_SPECIES = [
  { id: 'pond-minnow', name: 'Pond Minnow', rarity: 'common', chanceLabel: '1 in 5', color: '#7dc7ff', accent: '#d8f2ff', weight: 2800 },
  { id: 'river-darter', name: 'River Darter', rarity: 'common', chanceLabel: '1 in 6', color: '#60a5fa', accent: '#bfdbfe', weight: 2200 },
  { id: 'silver-gill', name: 'Silver Gill', rarity: 'common', chanceLabel: '1 in 7', color: '#94a3b8', accent: '#e2e8f0', weight: 1900 },
  { id: 'mud-carp', name: 'Mud Carp', rarity: 'common', chanceLabel: '1 in 8', color: '#84cc16', accent: '#d9f99d', weight: 1600 },
  { id: 'reed-snapper', name: 'Reed Snapper', rarity: 'common', chanceLabel: '1 in 10', color: '#22d3ee', accent: '#a5f3fc', weight: 1300 },
  { id: 'striped-koi', name: 'Striped Koi', rarity: 'common', chanceLabel: '1 in 13', color: '#fb923c', accent: '#fed7aa', weight: 1000 },
  { id: 'coral-perch', name: 'Coral Perch', rarity: 'uncommon', chanceLabel: '1 in 18', color: '#fb7185', accent: '#fecdd3', weight: 760 },
  { id: 'moon-tilapia', name: 'Moon Tilapia', rarity: 'uncommon', chanceLabel: '1 in 22', color: '#a78bfa', accent: '#ddd6fe', weight: 620 },
  { id: 'drift-trout', name: 'Drift Trout', rarity: 'uncommon', chanceLabel: '1 in 26', color: '#38bdf8', accent: '#bae6fd', weight: 520 },
  { id: 'amber-flounder', name: 'Amber Flounder', rarity: 'uncommon', chanceLabel: '1 in 31', color: '#f59e0b', accent: '#fde68a', weight: 430 },
  { id: 'glass-catfish', name: 'Glass Catfish', rarity: 'uncommon', chanceLabel: '1 in 37', color: '#67e8f9', accent: '#ecfeff', weight: 360 },
  { id: 'thunder-pike', name: 'Thunder Pike', rarity: 'rare', chanceLabel: '1 in 53', color: '#818cf8', accent: '#c7d2fe', weight: 250 },
  { id: 'lava-char', name: 'Lava Char', rarity: 'rare', chanceLabel: '1 in 74', color: '#f97316', accent: '#fdba74', weight: 180 },
  { id: 'ghost-bass', name: 'Ghost Bass', rarity: 'rare', chanceLabel: '1 in 102', color: '#d1d5db', accent: '#f8fafc', weight: 130 },
  { id: 'cobalt-ray', name: 'Cobalt Ray', rarity: 'rare', chanceLabel: '1 in 140', color: '#2563eb', accent: '#93c5fd', weight: 95 },
  { id: 'sunblade-mako', name: 'Sunblade Mako', rarity: 'epic', chanceLabel: '1 in 220', color: '#facc15', accent: '#fef08a', weight: 60 },
  { id: 'prism-swordfish', name: 'Prism Swordfish', rarity: 'epic', chanceLabel: '1 in 350', color: '#8b5cf6', accent: '#ddd6fe', weight: 38 },
  { id: 'deepfin-marlin', name: 'Deepfin Marlin', rarity: 'epic', chanceLabel: '1 in 560', color: '#0ea5e9', accent: '#bae6fd', weight: 24 },
  { id: 'void-whalelet', name: 'Void Whalelet', rarity: 'legendary', chanceLabel: '1 in 1650', color: '#6366f1', accent: '#c7d2fe', weight: 8 },
  { id: 'crown-leviathan', name: 'Crown Leviathan', rarity: 'mythic', chanceLabel: '1 in 6500', color: '#f43f5e', accent: '#fecdd3', weight: 2 }
];
const FISH_SPECIES_BY_ID = new Map(FISH_SPECIES.map((fish) => [fish.id, fish]));
const FISH_SPECIES_IDS = new Set(FISH_SPECIES.map((fish) => fish.id));
const FISH_SPECIES_WEIGHT_TOTAL = FISH_SPECIES.reduce((sum, fish) => sum + Math.max(0, Number(fish.weight) || 0), 0);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROFILE_FILE = path.join(__dirname, 'profiles.json');
const ACCOUNT_FILE = path.join(__dirname, 'accounts.json');

const players = new Map();
const profiles = new Map();
const accounts = new Map();
const voiceParticipants = new Set();
const interactables = new Map([
  [
    'beacon',
    {
      id: 'beacon',
      x: 0,
      z: 0,
      active: false,
      lastBy: null
    }
  ]
]);
let saveTimer = null;
let accountSaveTimer = null;
let shuttingDown = false;
let dbClient = null;
let dbReady = false;

app.use(express.static('public'));

app.get('/voice-config', (req, res) => {
  res.json({ ok: true, iceServers: VOICE_ICE_SERVERS });
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function xpNeededForLevel(level) {
  const safeLevel = clamp(Math.floor(Number(level) || 1), 1, MAX_PLAYER_LEVEL);
  return BASE_XP_TO_LEVEL + (safeLevel - 1) * XP_PER_LEVEL_STEP;
}

function levelProgressFromXp(totalXpRaw) {
  let remainingXp = clamp(Math.floor(Number(totalXpRaw) || 0), 0, 2_000_000_000);
  let level = 1;
  while (level < MAX_PLAYER_LEVEL) {
    const needed = xpNeededForLevel(level);
    if (remainingXp < needed) break;
    remainingXp -= needed;
    level += 1;
  }
  return {
    level,
    xpIntoLevel: remainingXp,
    xpToNextLevel: level >= MAX_PLAYER_LEVEL ? 0 : xpNeededForLevel(level)
  };
}

function normalizeProgressLevel(progress) {
  if (!progress || typeof progress !== 'object') {
    return levelProgressFromXp(0);
  }
  progress.xp = clamp(Math.floor(Number(progress.xp) || 0), 0, 2_000_000_000);
  const levelState = levelProgressFromXp(progress.xp);
  progress.level = levelState.level;
  return levelState;
}

function grantExperience(progress, amount) {
  const gained = clamp(Math.floor(Number(amount) || 0), 0, 2_000_000_000);
  const before = normalizeProgressLevel(progress);
  if (gained > 0) {
    progress.xp = clamp((progress.xp || 0) + gained, 0, 2_000_000_000);
  }
  const after = normalizeProgressLevel(progress);
  return {
    gained,
    previousLevel: before.level,
    level: after.level,
    xpIntoLevel: after.xpIntoLevel,
    xpToNextLevel: after.xpToNextLevel,
    levelsGained: Math.max(0, after.level - before.level),
    leveledUp: after.level > before.level
  };
}

function distance2DPoint(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0));
}

function clampToIsland(x, z, limit) {
  const radius = Math.hypot(x, z);
  if (radius <= limit) {
    return { x, z };
  }

  const scale = limit / (radius || 1);
  return { x: x * scale, z: z * scale };
}

function clampToPlayableGround(x, z, allowMine = false) {
  const MAIN_RADIUS = WORLD_LIMIT * 1.14;
  const MINE_ENTRY_RADIUS = MINE_ENTRY_ISLAND_RADIUS;
  const FISHING_RADIUS = FISHING_ISLAND_RADIUS;
  const MARKET_RADIUS = MARKET_ISLAND_RADIUS;
  const FURNITURE_RADIUS = FURNITURE_ISLAND_RADIUS;
  const LEADERBOARD_RADIUS = LEADERBOARD_ISLAND_RADIUS;
  const HOUSE_ROOM_PLAY_RADIUS = HOUSE_ROOM_RADIUS;
  const mineDist = Math.hypot(x - MINE_POS.x, z - MINE_POS.z);
  const mineSwimBlocked = allowMine && mineDist <= MINE_SWIM_BLOCK_RADIUS;
  const onMain = Math.hypot(x, z) <= MAIN_RADIUS;
  const onLighthouse = Math.hypot(x - LIGHTHOUSE_POS.x, z - LIGHTHOUSE_POS.z) <= LIGHTHOUSE_RADIUS;
  const onMineEntryIsland = Math.hypot(x - MINE_ENTRY_ISLAND_POS.x, z - MINE_ENTRY_ISLAND_POS.z) <= MINE_ENTRY_RADIUS;
  const onFishingIsland = Math.hypot(x - FISHING_ISLAND_POS.x, z - FISHING_ISLAND_POS.z) <= FISHING_RADIUS;
  const onMarketIsland = Math.hypot(x - MARKET_ISLAND_POS.x, z - MARKET_ISLAND_POS.z) <= MARKET_RADIUS;
  const onFurnitureIsland = Math.hypot(x - FURNITURE_ISLAND_POS.x, z - FURNITURE_ISLAND_POS.z) <= FURNITURE_RADIUS;
  const onLeaderboardIsland = Math.hypot(x - LEADERBOARD_ISLAND_POS.x, z - LEADERBOARD_ISLAND_POS.z) <= LEADERBOARD_RADIUS;
  const onInterior = Math.hypot(x - INTERIOR_POS.x, z - INTERIOR_POS.z) <= INTERIOR_RADIUS;
  const onHouseRoom = Math.hypot(x - HOUSE_ROOM_POS.x, z - HOUSE_ROOM_POS.z) <= HOUSE_ROOM_PLAY_RADIUS;
  const onMine = allowMine && mineDist <= MINE_PLAY_RADIUS;
  const radius = Math.hypot(x, z);
  const onSwimRing = radius >= SWIM_MIN_RADIUS && radius <= SWIM_MAX_RADIUS && !mineSwimBlocked;
  if (onMain || onLighthouse || onMineEntryIsland || onFishingIsland || onMarketIsland || onFurnitureIsland || onLeaderboardIsland || onInterior || onHouseRoom || onMine || onSwimRing) {
    return { x, z };
  }

  const toMain = clampToIsland(x, z, MAIN_RADIUS);
  const distMain = Math.hypot(x - toMain.x, z - toMain.z);

  const dxL = x - LIGHTHOUSE_POS.x;
  const dzL = z - LIGHTHOUSE_POS.z;
  const lenL = Math.hypot(dxL, dzL) || 1;
  const toLighthouse = {
    x: LIGHTHOUSE_POS.x + (dxL / lenL) * LIGHTHOUSE_RADIUS,
    z: LIGHTHOUSE_POS.z + (dzL / lenL) * LIGHTHOUSE_RADIUS
  };
  const distLighthouse = Math.hypot(x - toLighthouse.x, z - toLighthouse.z);
  const dxE = x - MINE_ENTRY_ISLAND_POS.x;
  const dzE = z - MINE_ENTRY_ISLAND_POS.z;
  const lenE = Math.hypot(dxE, dzE) || 1;
  const toMineEntry = {
    x: MINE_ENTRY_ISLAND_POS.x + (dxE / lenE) * MINE_ENTRY_RADIUS,
    z: MINE_ENTRY_ISLAND_POS.z + (dzE / lenE) * MINE_ENTRY_RADIUS
  };
  const distMineEntry = Math.hypot(x - toMineEntry.x, z - toMineEntry.z);
  const dxF = x - FISHING_ISLAND_POS.x;
  const dzF = z - FISHING_ISLAND_POS.z;
  const lenF = Math.hypot(dxF, dzF) || 1;
  const toFishing = {
    x: FISHING_ISLAND_POS.x + (dxF / lenF) * FISHING_RADIUS,
    z: FISHING_ISLAND_POS.z + (dzF / lenF) * FISHING_RADIUS
  };
  const distFishing = Math.hypot(x - toFishing.x, z - toFishing.z);
  const dxK = x - MARKET_ISLAND_POS.x;
  const dzK = z - MARKET_ISLAND_POS.z;
  const lenK = Math.hypot(dxK, dzK) || 1;
  const toMarket = {
    x: MARKET_ISLAND_POS.x + (dxK / lenK) * MARKET_RADIUS,
    z: MARKET_ISLAND_POS.z + (dzK / lenK) * MARKET_RADIUS
  };
  const distMarket = Math.hypot(x - toMarket.x, z - toMarket.z);
  const dxR = x - FURNITURE_ISLAND_POS.x;
  const dzR = z - FURNITURE_ISLAND_POS.z;
  const lenR = Math.hypot(dxR, dzR) || 1;
  const toFurniture = {
    x: FURNITURE_ISLAND_POS.x + (dxR / lenR) * FURNITURE_RADIUS,
    z: FURNITURE_ISLAND_POS.z + (dzR / lenR) * FURNITURE_RADIUS
  };
  const distFurniture = Math.hypot(x - toFurniture.x, z - toFurniture.z);
  const dxB = x - LEADERBOARD_ISLAND_POS.x;
  const dzB = z - LEADERBOARD_ISLAND_POS.z;
  const lenB = Math.hypot(dxB, dzB) || 1;
  const toLeaderboard = {
    x: LEADERBOARD_ISLAND_POS.x + (dxB / lenB) * LEADERBOARD_RADIUS,
    z: LEADERBOARD_ISLAND_POS.z + (dzB / lenB) * LEADERBOARD_RADIUS
  };
  const distLeaderboard = Math.hypot(x - toLeaderboard.x, z - toLeaderboard.z);

  const dxI = x - INTERIOR_POS.x;
  const dzI = z - INTERIOR_POS.z;
  const lenI = Math.hypot(dxI, dzI) || 1;
  const toInterior = {
    x: INTERIOR_POS.x + (dxI / lenI) * INTERIOR_RADIUS,
    z: INTERIOR_POS.z + (dzI / lenI) * INTERIOR_RADIUS
  };
  const distInterior = Math.hypot(x - toInterior.x, z - toInterior.z);
  const dxH = x - HOUSE_ROOM_POS.x;
  const dzH = z - HOUSE_ROOM_POS.z;
  const lenH = Math.hypot(dxH, dzH) || 1;
  const toHouseRoom = {
    x: HOUSE_ROOM_POS.x + (dxH / lenH) * HOUSE_ROOM_PLAY_RADIUS,
    z: HOUSE_ROOM_POS.z + (dzH / lenH) * HOUSE_ROOM_PLAY_RADIUS
  };
  const distHouseRoom = Math.hypot(x - toHouseRoom.x, z - toHouseRoom.z);
  const dxM = x - MINE_POS.x;
  const dzM = z - MINE_POS.z;
  const lenM = Math.hypot(dxM, dzM) || 1;
  const toMine = {
    x: MINE_POS.x + (dxM / lenM) * MINE_PLAY_RADIUS,
    z: MINE_POS.z + (dzM / lenM) * MINE_PLAY_RADIUS
  };
  const distMine = allowMine ? Math.hypot(x - toMine.x, z - toMine.z) : Number.POSITIVE_INFINITY;
  const toSwim = (() => {
    const len = Math.hypot(x, z) || 1;
    const target = len < SWIM_MIN_RADIUS ? SWIM_MIN_RADIUS : SWIM_MAX_RADIUS;
    const scale = target / len;
    return { x: x * scale, z: z * scale };
  })();
  const distSwim = mineSwimBlocked ? Number.POSITIVE_INFINITY : Math.hypot(x - toSwim.x, z - toSwim.z);

  if (
    distMain <= distLighthouse
    && distMain <= distMineEntry
    && distMain <= distFishing
    && distMain <= distMarket
    && distMain <= distFurniture
    && distMain <= distLeaderboard
    && distMain <= distInterior
    && distMain <= distHouseRoom
    && distMain <= distSwim
    && distMain <= distMine
  ) return toMain;
  if (
    distLighthouse <= distMineEntry
    && distLighthouse <= distFishing
    && distLighthouse <= distMarket
    && distLighthouse <= distFurniture
    && distLighthouse <= distLeaderboard
    && distLighthouse <= distInterior
    && distLighthouse <= distHouseRoom
    && distLighthouse <= distSwim
    && distLighthouse <= distMine
  ) return toLighthouse;
  if (
    distMineEntry <= distFishing
    && distMineEntry <= distMarket
    && distMineEntry <= distFurniture
    && distMineEntry <= distLeaderboard
    && distMineEntry <= distInterior
    && distMineEntry <= distHouseRoom
    && distMineEntry <= distSwim
    && distMineEntry <= distMine
  ) return toMineEntry;
  if (distFishing <= distMarket && distFishing <= distFurniture && distFishing <= distLeaderboard && distFishing <= distInterior && distFishing <= distHouseRoom && distFishing <= distSwim && distFishing <= distMine) return toFishing;
  if (distMarket <= distFurniture && distMarket <= distLeaderboard && distMarket <= distInterior && distMarket <= distHouseRoom && distMarket <= distSwim && distMarket <= distMine) return toMarket;
  if (distFurniture <= distLeaderboard && distFurniture <= distInterior && distFurniture <= distHouseRoom && distFurniture <= distSwim && distFurniture <= distMine) return toFurniture;
  if (distLeaderboard <= distInterior && distLeaderboard <= distHouseRoom && distLeaderboard <= distSwim && distLeaderboard <= distMine) return toLeaderboard;
  if (distInterior <= distHouseRoom && distInterior <= distSwim && distInterior <= distMine) return toInterior;
  if (distHouseRoom <= distSwim && distHouseRoom <= distMine) return toHouseRoom;
  if (distMine <= distSwim) return toMine;
  return toSwim;
}

function randomSpawn(limit) {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * limit;
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius
  };
}

function randomMainIslandSpawn(limit = WORLD_LIMIT * 0.65) {
  const safeLimit = Math.max(6, Number(limit) || (WORLD_LIMIT * 0.65));
  for (let i = 0; i < 36; i += 1) {
    const point = randomSpawn(safeLimit);
    if (distance2DPoint(point, MAIN_HOUSE_POS) >= MAIN_HOUSE_NO_SPAWN_RADIUS) {
      return point;
    }
  }
  // deterministic fallback away from the main house entrance zone
  return { x: safeLimit * 0.55, z: -safeLimit * 0.25 };
}

function randomHexColor() {
  const value = Math.floor(Math.random() * 0xffffff);
  return `#${value.toString(16).padStart(6, '0')}`;
}

function sanitizeName(value, fallback) {
  const raw = typeof value === 'string' ? value : '';
  const normalized = raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX_LEN);
  const safe = normalized.replace(/[\x00-\x1F\x7F<>]/g, '');
  return safe || fallback;
}

function normalizeNameKey(value) {
  return sanitizeName(value, '').toLowerCase();
}

function sanitizeColor(value, fallback) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const isHex = /^#([0-9a-fA-F]{6})$/.test(raw);
  return isHex ? raw : fallback;
}

function defaultAppearance() {
  return {
    skin: '#f3cfb3',
    shirt: '#5a8ef2',
    pants: '#334155',
    shoes: '#111827',
    hairStyle: 'short',
    hairColor: '#2b211c',
    faceStyle: 'smile',
    accessories: []
  };
}

function defaultInventory() {
  return {
    stone: 0,
    iron: 0,
    gold: 0,
    diamond: 0,
    torch: 1,
    fish: 0
  };
}

function defaultFishBag() {
  return {};
}

function fishForQuestPool(completions = 0) {
  const done = Math.max(0, Math.floor(Number(completions) || 0));
  if (done < 2) return { rarity: 'common', min: 3, max: 5, allowSpecific: false };
  if (done < 4) return { rarity: Math.random() < 0.65 ? 'common' : 'uncommon', min: 4, max: 6, allowSpecific: false };
  if (done < 7) return { rarity: 'uncommon', min: 5, max: 8, allowSpecific: true };
  if (done < 10) return { rarity: Math.random() < 0.75 ? 'rare' : 'uncommon', min: 5, max: 9, allowSpecific: true };
  if (done < 14) return { rarity: Math.random() < 0.7 ? 'rare' : 'epic', min: 6, max: 10, allowSpecific: true };
  if (done < 18) return { rarity: Math.random() < 0.7 ? 'epic' : 'legendary', min: 7, max: 11, allowSpecific: true };
  return { rarity: Math.random() < 0.75 ? 'legendary' : 'mythic', min: 8, max: 12, allowSpecific: true };
}

function pickFishByRarity(rarity) {
  const list = FISH_SPECIES.filter((fish) => fish.rarity === rarity);
  if (!list.length) return null;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx] || null;
}

function defaultFishingQuest(completions = 0, seed = 1) {
  const template = fishForQuestPool(completions);
  const span = Math.max(1, template.max - template.min + 1);
  const targetCount = template.min + ((seed * 5) % span);
  let targetFishId = null;
  if (template.allowSpecific && Math.random() < Math.min(0.7, 0.18 + completions * 0.04)) {
    targetFishId = pickFishByRarity(template.rarity)?.id || null;
  }
  const rarityBase = FISH_RARITY_ORDER.indexOf(template.rarity) + 1;
  const rewardXp = clamp(
    Math.floor(42 + targetCount * (9 + rarityBase * 4) + completions * 10),
    55,
    45_000
  );
  const targetFishName = targetFishId ? (FISH_SPECIES_BY_ID.get(targetFishId)?.name || 'fish') : `${template.rarity} fish`;
  return {
    id: `fq-${Date.now()}-${seed}`,
    type: 'fishing',
    status: 'available',
    targetRarity: template.rarity,
    targetFishId,
    targetCount,
    progress: 0,
    rewardXp,
    title: `Turn in ${targetCount} ${targetFishName}`,
    description: targetFishId
      ? `Bring ${targetCount} ${targetFishName} to the Market Trader.`
      : `Bring ${targetCount} ${template.rarity} fish to the Market Trader.`
  };
}

function defaultQuest(seed = 1) {
  const pool = [
    { resource: 'stone', min: 14, max: 28, xpPerItem: 5, diamondBonusChance: 0.08 },
    { resource: 'iron', min: 8, max: 18, xpPerItem: 10, diamondBonusChance: 0.12 },
    { resource: 'gold', min: 6, max: 14, xpPerItem: 16, diamondBonusChance: 0.16 },
    { resource: 'diamond', min: 2, max: 7, xpPerItem: 30, diamondBonusChance: 0.2 }
  ];
  const entry = pool[seed % pool.length];
  const span = entry.max - entry.min + 1;
  const targetCount = entry.min + ((seed * 7) % span);
  const rewardXp = Math.round(targetCount * entry.xpPerItem + 24 + Math.min(220, seed * 2.5));
  const rewardDiamonds = Math.random() < entry.diamondBonusChance ? 1 : 0;
  return {
    id: `q-${Date.now()}-${seed}`,
    type: 'mine',
    resource: entry.resource,
    targetCount,
    progress: 0,
    rewardXp,
    rewardDiamonds,
    title: `Mine ${targetCount} ore`,
    description: `Collect ${targetCount} ore chunks in the mine.`,
    status: 'available'
  };
}

function defaultHomeRoom() {
  return {
    wallPaint: 'sand',
    floorPaint: 'oak',
    ownedFurniture: {
      bed: false,
      table: false,
      lamp: false,
      plant: false
    },
    placedFurniture: {
      bed: false,
      table: false,
      lamp: false,
      plant: false
    }
  };
}

function sanitizeHomeRoom(value) {
  const base = defaultHomeRoom();
  if (!value || typeof value !== 'object') return base;
  const wallPaintRaw = typeof value.wallPaint === 'string' ? value.wallPaint.trim().toLowerCase() : '';
  const floorPaintRaw = typeof value.floorPaint === 'string' ? value.floorPaint.trim().toLowerCase() : '';
  if (HOME_ROOM_WALL_PAINTS.has(wallPaintRaw)) base.wallPaint = wallPaintRaw;
  if (HOME_ROOM_FLOOR_PAINTS.has(floorPaintRaw)) base.floorPaint = floorPaintRaw;

  const owned = value.ownedFurniture && typeof value.ownedFurniture === 'object'
    ? value.ownedFurniture
    : {};
  const placed = value.placedFurniture && typeof value.placedFurniture === 'object'
    ? value.placedFurniture
    : {};
  for (const furnitureId of HOME_ROOM_FURNITURE_IDS) {
    const isOwned = owned[furnitureId] === true;
    base.ownedFurniture[furnitureId] = isOwned;
    base.placedFurniture[furnitureId] = isOwned && placed[furnitureId] === true;
  }
  return base;
}

function currentFurnitureTraderCycleId(now = Date.now()) {
  return Math.max(0, Math.floor(now / FURNITURE_TRADER_CYCLE_MS));
}

function defaultFurnitureTraderState(now = Date.now()) {
  return {
    cycleId: currentFurnitureTraderCycleId(now),
    purchasedThisCycle: {}
  };
}

function sanitizeFurnitureTraderState(value, now = Date.now()) {
  const base = defaultFurnitureTraderState(now);
  if (!value || typeof value !== 'object') return base;
  const cycleId = Number(value.cycleId);
  if (Number.isFinite(cycleId) && cycleId >= 0) {
    base.cycleId = Math.floor(cycleId);
  }
  const purchasedThisCycle = value.purchasedThisCycle && typeof value.purchasedThisCycle === 'object'
    ? value.purchasedThisCycle
    : {};
  for (const itemId of HOME_ROOM_FURNITURE_IDS) {
    const count = clamp(Math.floor(Number(purchasedThisCycle[itemId]) || 0), 0, 99);
    if (count > 0) {
      base.purchasedThisCycle[itemId] = count;
    }
  }
  return base;
}

function ensureFurnitureTraderProgressShape(progress, now = Date.now()) {
  const currentCycleId = currentFurnitureTraderCycleId(now);
  const state = sanitizeFurnitureTraderState(progress?.furnitureTrader, now);
  if (state.cycleId !== currentCycleId) {
    progress.furnitureTrader = defaultFurnitureTraderState(now);
  } else {
    progress.furnitureTrader = state;
  }
  return progress.furnitureTrader;
}

function defaultProgress() {
  return {
    coins: 0,
    xp: 0,
    level: 1,
    pickaxe: 'wood',
    inventory: defaultInventory(),
    fishBag: defaultFishBag(),
    fishIndex: {},
    hasFishingRod: false,
    fishingRodTier: 'basic',
    maxStaminaBonusPct: 0,
    questSeed: 1,
    quest: defaultQuest(1),
    fishingQuestSeed: 1,
    fishingQuestCompletions: 0,
    fishingQuest: defaultFishingQuest(0, 1),
    homeRoom: defaultHomeRoom(),
    furnitureTrader: defaultFurnitureTraderState()
  };
}

function sanitizePickaxe(value, fallback = 'wood') {
  return PICKAXE_ORDER.includes(value) ? value : fallback;
}

function levelRequirementForPickaxe(tier) {
  return clamp(Math.floor(Number(PICKAXE_LEVEL_REQUIREMENT[tier]) || 1), 1, MAX_PLAYER_LEVEL);
}

function levelRequirementForRod(tier) {
  return clamp(Math.floor(Number(FISHING_ROD_LEVEL_REQUIREMENT[tier]) || 1), 1, MAX_PLAYER_LEVEL);
}

function sanitizeInventory(value) {
  const base = defaultInventory();
  if (!value || typeof value !== 'object') return base;
  for (const key of Object.keys(base)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const n = Number(value[key]);
    if (Number.isFinite(n)) {
      base[key] = clamp(Math.floor(n), 0, 1_000_000);
    }
  }
  return base;
}

function sanitizeFishIndex(value) {
  const cleaned = {};
  if (!value || typeof value !== 'object') return cleaned;
  for (const [fishId, count] of Object.entries(value)) {
    if (!FISH_SPECIES_IDS.has(fishId)) continue;
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) continue;
    cleaned[fishId] = clamp(Math.floor(n), 1, 1_000_000);
  }
  return cleaned;
}

function sanitizeFishBag(value) {
  const cleaned = {};
  if (!value || typeof value !== 'object') return cleaned;
  for (const [fishId, count] of Object.entries(value)) {
    if (!FISH_SPECIES_IDS.has(fishId)) continue;
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) continue;
    cleaned[fishId] = clamp(Math.floor(n), 1, 1_000_000);
  }
  return cleaned;
}

function sanitizeFishingRodTier(value, fallback = 'basic') {
  if (typeof value === 'string' && FISH_ROD_TIERS.includes(value)) return value;
  return fallback;
}

function sanitizeFishingQuest(value, completions = 0, seed = 1) {
  const fallback = defaultFishingQuest(completions, seed);
  if (!value || typeof value !== 'object') return fallback;
  const targetRarity = FISH_RARITY_ORDER.includes(value.targetRarity) ? value.targetRarity : fallback.targetRarity;
  const targetFishIdRaw = typeof value.targetFishId === 'string' ? value.targetFishId : '';
  const targetFishId = targetFishIdRaw && FISH_SPECIES_IDS.has(targetFishIdRaw)
    ? targetFishIdRaw
    : null;
  const targetCount = clamp(Math.floor(Number(value.targetCount) || fallback.targetCount), 1, 500);
  const progress = clamp(Math.floor(Number(value.progress) || 0), 0, targetCount);
  const rewardXpRaw = Number(value.rewardXp);
  const legacyRewardCoinsRaw = Number(value.rewardCoins);
  const rewardXpSource = Number.isFinite(rewardXpRaw)
    ? rewardXpRaw
    : (Number.isFinite(legacyRewardCoinsRaw) ? legacyRewardCoinsRaw : fallback.rewardXp);
  const rewardXp = clamp(Math.floor(rewardXpSource), 20, 1_000_000);
  const statusRaw = typeof value.status === 'string' ? value.status : fallback.status;
  const status = ['available', 'active', 'ready'].includes(statusRaw)
    ? statusRaw
    : fallback.status;
  const name = targetFishId
    ? (FISH_SPECIES_BY_ID.get(targetFishId)?.name || 'fish')
    : `${targetRarity} fish`;
  return {
    id: typeof value.id === 'string' && value.id ? value.id.slice(0, 80) : fallback.id,
    type: 'fishing',
    status: progress >= targetCount && status === 'active' ? 'ready' : status,
    targetRarity,
    targetFishId,
    targetCount,
    progress,
    rewardXp,
    title: `Turn in ${targetCount} ${name}`,
    description: targetFishId
      ? `Bring ${targetCount} ${name} to the Market Trader.`
      : `Bring ${targetCount} ${targetRarity} fish to the Market Trader.`
  };
}

function sanitizeQuest(value, fallbackSeed = 1) {
  const fallback = defaultQuest(fallbackSeed);
  if (!value || typeof value !== 'object') return fallback;
  const resource = ORE_TYPES.has(value.resource) ? value.resource : fallback.resource;
  const targetCount = clamp(Math.floor(Number(value.targetCount) || fallback.targetCount), 1, 2000);
  const progress = clamp(Math.floor(Number(value.progress) || 0), 0, targetCount);
  const rewardXpRaw = Number(value.rewardXp);
  const legacyRewardCoinsRaw = Number(value.rewardCoins);
  const rewardXpSource = Number.isFinite(rewardXpRaw)
    ? rewardXpRaw
    : (Number.isFinite(legacyRewardCoinsRaw) ? legacyRewardCoinsRaw : fallback.rewardXp);
  const rewardXp = clamp(Math.floor(rewardXpSource), 8, 1_000_000);
  const rewardDiamonds = clamp(Math.floor(Number(value.rewardDiamonds) || 0), 0, 50);
  const status = ['available', 'active', 'ready'].includes(value.status) ? value.status : fallback.status;
  return {
    id: typeof value.id === 'string' && value.id ? value.id.slice(0, 80) : fallback.id,
    type: 'mine',
    resource,
    targetCount,
    progress,
    rewardXp,
    rewardDiamonds,
    title: `Mine ${targetCount} ore`,
    description: `Collect ${targetCount} ore chunks in the mine.`,
    status: progress >= targetCount && status === 'active' ? 'ready' : status
  };
}

function sanitizeProgress(value) {
  const base = defaultProgress();
  if (!value || typeof value !== 'object') return base;
  const questSeed = clamp(Math.floor(Number(value.questSeed) || 1), 1, 1_000_000);
  const quest = sanitizeQuest(value.quest, questSeed);
  const inventory = sanitizeInventory(value.inventory);
  const fishBag = sanitizeFishBag(value.fishBag);
  const fishFromBag = Object.values(fishBag).reduce((sum, n) => sum + (Number(n) || 0), 0);
  if (fishFromBag > 0) {
    inventory.fish = clamp(Math.floor(fishFromBag), 0, 1_000_000);
  }
  const fishingQuestCompletions = clamp(Math.floor(Number(value.fishingQuestCompletions) || 0), 0, 1_000_000);
  const fishingQuestSeed = clamp(Math.floor(Number(value.fishingQuestSeed) || 1), 1, 1_000_000);
  const fishingQuest = sanitizeFishingQuest(value.fishingQuest, fishingQuestCompletions, fishingQuestSeed);
  const maxStaminaBonusPct = clamp(Math.floor(Number(value.maxStaminaBonusPct) || 0), 0, MAX_STAMINA_BONUS_PCT);
  const homeRoom = sanitizeHomeRoom(value.homeRoom);
  const furnitureTrader = sanitizeFurnitureTraderState(value.furnitureTrader);
  const xp = clamp(Math.floor(Number(value.xp) || 0), 0, 2_000_000_000);
  const levelState = levelProgressFromXp(xp);
  return {
    coins: clamp(Math.floor(Number(value.coins) || 0), 0, 100_000_000),
    xp,
    level: levelState.level,
    pickaxe: sanitizePickaxe(value.pickaxe, 'wood'),
    inventory,
    fishBag,
    fishIndex: sanitizeFishIndex(value.fishIndex),
    hasFishingRod: value.hasFishingRod === true,
    fishingRodTier: sanitizeFishingRodTier(value.fishingRodTier, 'basic'),
    maxStaminaBonusPct,
    questSeed,
    quest,
    fishingQuestSeed,
    fishingQuestCompletions,
    fishingQuest,
    homeRoom,
    furnitureTrader
  };
}

function nextQuest(progress) {
  progress.questSeed = clamp((progress.questSeed || 1) + 1, 1, 1_000_000);
  progress.quest = defaultQuest(progress.questSeed);
}

function deterministicHash(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function furnitureStockForCycle(itemId, cycleId) {
  const item = HOME_ROOM_FURNITURE_SHOP[itemId];
  if (!item) return 0;
  if (item.occasionallyAvailable === true) {
    const roll = deterministicHash(`furniture-stock:${cycleId}:${itemId}`) / 0x100000000;
    if (roll >= Number(item.availabilityChance || 0)) {
      return 0;
    }
  }
  return clamp(Math.floor(Number(item.stock) || 0), 0, 99);
}

function furnitureTraderPurchasesUsed(state) {
  if (!state || typeof state !== 'object') return 0;
  return HOME_ROOM_FURNITURE_IDS.reduce((sum, itemId) => {
    const count = clamp(Math.floor(Number(state.purchasedThisCycle?.[itemId]) || 0), 0, 99);
    return sum + count;
  }, 0);
}

function furnitureTraderSnapshot(progress, now = Date.now()) {
  const state = ensureFurnitureTraderProgressShape(progress, now);
  const room = sanitizeHomeRoom(progress.homeRoom);
  const cycleId = state.cycleId;
  const purchasesUsed = clamp(furnitureTraderPurchasesUsed(state), 0, FURNITURE_TRADER_PURCHASE_LIMIT);
  return {
    cycleId,
    cycleEndsAt: (cycleId + 1) * FURNITURE_TRADER_CYCLE_MS,
    cycleDurationMs: FURNITURE_TRADER_CYCLE_MS,
    purchaseLimit: FURNITURE_TRADER_PURCHASE_LIMIT,
    purchasesUsed,
    purchasesRemaining: Math.max(0, FURNITURE_TRADER_PURCHASE_LIMIT - purchasesUsed),
    items: HOME_ROOM_FURNITURE_IDS.map((itemId) => {
      const item = HOME_ROOM_FURNITURE_SHOP[itemId];
      const stock = furnitureStockForCycle(itemId, cycleId);
      const purchased = clamp(Math.floor(Number(state.purchasedThisCycle?.[itemId]) || 0), 0, 99);
      const remaining = Math.max(0, stock - purchased);
      return {
        itemId,
        label: item.label,
        price: item.price,
        occasional: item.occasionallyAvailable === true,
        availableThisCycle: stock > 0,
        stock,
        purchased,
        remaining,
        soldOut: stock > 0 && remaining <= 0,
        owned: room.ownedFurniture?.[itemId] === true
      };
    })
  };
}

function progressSnapshot(progress) {
  const levelState = normalizeProgressLevel(progress);
  return {
    coins: progress.coins,
    xp: clamp(Math.floor(Number(progress.xp) || 0), 0, 2_000_000_000),
    level: levelState.level,
    xpIntoLevel: levelState.xpIntoLevel,
    xpToNextLevel: levelState.xpToNextLevel,
    pickaxe: progress.pickaxe,
    inventory: { ...progress.inventory },
    fishBag: { ...(progress.fishBag || {}) },
    fishIndex: { ...(progress.fishIndex || {}) },
    hasFishingRod: progress.hasFishingRod === true,
    fishingRodTier: sanitizeFishingRodTier(progress.fishingRodTier, 'basic'),
    maxStaminaBonusPct: clamp(Math.floor(Number(progress.maxStaminaBonusPct) || 0), 0, MAX_STAMINA_BONUS_PCT),
    questSeed: progress.questSeed,
    quest: { ...progress.quest },
    fishingQuestSeed: clamp(Math.floor(Number(progress.fishingQuestSeed) || 1), 1, 1_000_000),
    fishingQuestCompletions: clamp(Math.floor(Number(progress.fishingQuestCompletions) || 0), 0, 1_000_000),
    fishingQuest: progress.fishingQuest ? { ...progress.fishingQuest } : defaultFishingQuest(0, 1),
    homeRoom: sanitizeHomeRoom(progress.homeRoom),
    furnitureTrader: furnitureTraderSnapshot(progress),
    shop: {
      order: [...PICKAXE_ORDER],
      price: { ...PICKAXE_PRICE },
      levelReq: { ...PICKAXE_LEVEL_REQUIREMENT }
    }
  };
}

function buildLeaderboardRows(limitRaw = 8) {
  const limit = clamp(Math.floor(Number(limitRaw) || 8), 1, 20);
  const rows = [];
  for (const [profileId, profile] of profiles.entries()) {
    const progress = profile?.progress && typeof profile.progress === 'object'
      ? profile.progress
      : defaultProgress();
    const xp = clamp(Math.floor(Number(progress.xp) || 0), 0, 2_000_000_000);
    const level = levelProgressFromXp(xp).level;
    const coins = clamp(Math.floor(Number(progress.coins) || 0), 0, 100_000_000);
    rows.push({
      profileId,
      name: sanitizeName(profile?.name, `Player-${String(profileId).slice(0, 4)}`),
      level,
      xp,
      coins
    });
  }
  rows.sort((a, b) => {
    if (b.coins !== a.coins) return b.coins - a.coins;
    if (b.level !== a.level) return b.level - a.level;
    if (b.xp !== a.xp) return b.xp - a.xp;
    return a.name.localeCompare(b.name);
  });
  return rows.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    name: row.name,
    level: row.level,
    xp: row.xp,
    coins: row.coins
  }));
}

app.get('/leaderboard', (req, res) => {
  const limit = clamp(Math.floor(Number(req.query?.limit) || 8), 1, 20);
  res.json({
    ok: true,
    generatedAt: Date.now(),
    rows: buildLeaderboardRows(limit)
  });
});

function fishCatchSnapshot(fish) {
  if (!fish || typeof fish !== 'object') return null;
  return {
    id: fish.id,
    name: fish.name,
    rarity: fish.rarity,
    chanceLabel: fish.chanceLabel,
    color: fish.color,
    accent: fish.accent
  };
}

function fishSellPrice(fishId) {
  const fish = FISH_SPECIES_BY_ID.get(fishId);
  if (!fish) return 0;
  return FISH_SELL_BY_RARITY[fish.rarity] || 0;
}

function computeTotalFishInBag(bag) {
  if (!bag || typeof bag !== 'object') return 0;
  return Object.values(bag).reduce((sum, n) => sum + Math.max(0, Math.floor(Number(n) || 0)), 0);
}

function weightedPick(entries, weightSelector) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const total = safeEntries.reduce((sum, entry) => sum + Math.max(0, Number(weightSelector(entry)) || 0), 0);
  if (total <= 0 || !safeEntries.length) return null;
  let roll = Math.random() * total;
  for (const entry of safeEntries) {
    roll -= Math.max(0, Number(weightSelector(entry)) || 0);
    if (roll <= 0) return entry;
  }
  return safeEntries[0] || null;
}

function pickRarityForRodTier(rodTier = 'basic') {
  const tier = FISH_ROD_DATA[sanitizeFishingRodTier(rodTier, 'basic')] || FISH_ROD_DATA.basic;
  const weighted = FISH_RARITY_ORDER
    .map((rarity) => ({ rarity, weight: Number(tier.rarityWeights?.[rarity]) || 0 }))
    .filter((entry) => entry.weight > 0);
  return weightedPick(weighted, (entry) => entry.weight)?.rarity || 'common';
}

function rollRandomFishSpecies(options = {}) {
  const requiredRarity = typeof options.rarity === 'string' ? options.rarity : '';
  const rarity = FISH_RARITY_ORDER.includes(requiredRarity)
    ? requiredRarity
    : pickRarityForRodTier(options.rodTier || 'basic');
  const pool = FISH_SPECIES.filter((fish) => fish.rarity === rarity);
  if (!pool.length) {
    return weightedPick(FISH_SPECIES, (fish) => Math.max(0, Number(fish.weight) || 0)) || null;
  }
  return weightedPick(pool, (fish) => Math.max(0, Number(fish.weight) || 0)) || null;
}

function fishingDifficultyForCatch(fish, rodTier = 'basic') {
  const safeFish = fish && FISH_SPECIES_BY_ID.has(fish.id) ? fish : rollRandomFishSpecies({ rodTier: 'basic' });
  const rarity = safeFish?.rarity || 'common';
  const base = FISH_DIFFICULTY_BY_RARITY[rarity] || FISH_DIFFICULTY_BY_RARITY.common;
  const tier = FISH_ROD_DATA[sanitizeFishingRodTier(rodTier, 'basic')] || FISH_ROD_DATA.basic;
  const assist = tier.difficultyAssist || { zoneBonus: 0, requiredHoldScale: 1 };
  const zoneWidth = clamp(Math.floor((base.zoneWidth + (assist.zoneBonus || 0)) * 1000), 90, 420) / 1000;
  const requiredHoldMs = clamp(
    Math.floor(base.requiredHoldMs * Math.max(0.55, Number(assist.requiredHoldScale) || 1)),
    600,
    5000
  );
  return {
    rarity,
    zoneWidth,
    zoneSpeed: base.zoneSpeed,
    requiredHoldMs,
    cursorRiseSpeed: base.cursorRiseSpeed,
    cursorFallSpeed: base.cursorFallSpeed,
    decaySpeed: base.decaySpeed,
    timeoutMs: base.timeoutMs
  };
}

function consumeFishBagForAmount(progress, amount) {
  const wanted = clamp(Math.floor(Number(amount) || 0), 0, 1_000_000);
  if (wanted <= 0) return 0;
  if (!progress.fishBag || typeof progress.fishBag !== 'object') {
    progress.fishBag = {};
  }
  const fishByValueAsc = Object.keys(progress.fishBag)
    .filter((fishId) => FISH_SPECIES_IDS.has(fishId) && (progress.fishBag[fishId] || 0) > 0)
    .sort((a, b) => fishSellPrice(a) - fishSellPrice(b));
  let remaining = wanted;
  for (const fishId of fishByValueAsc) {
    const has = clamp(Math.floor(Number(progress.fishBag[fishId]) || 0), 0, 1_000_000);
    if (has <= 0) continue;
    const take = Math.min(has, remaining);
    if (take <= 0) continue;
    const left = has - take;
    if (left > 0) {
      progress.fishBag[fishId] = left;
    } else {
      delete progress.fishBag[fishId];
    }
    remaining -= take;
    if (remaining <= 0) break;
  }
  const consumed = wanted - remaining;
  progress.inventory.fish = clamp(computeTotalFishInBag(progress.fishBag), 0, 1_000_000);
  return consumed;
}

function nextFishingQuest(progress) {
  progress.fishingQuestSeed = clamp((Number(progress.fishingQuestSeed) || 1) + 1, 1, 1_000_000);
  const completions = clamp(Math.floor(Number(progress.fishingQuestCompletions) || 0), 0, 1_000_000);
  progress.fishingQuest = defaultFishingQuest(completions, progress.fishingQuestSeed);
}

function ensureFishingProgressShape(progress) {
  if (!progress.fishBag || typeof progress.fishBag !== 'object') {
    progress.fishBag = {};
  }
  progress.fishBag = sanitizeFishBag(progress.fishBag);
  if (!progress.fishingQuest || typeof progress.fishingQuest !== 'object') {
    progress.fishingQuest = defaultFishingQuest(
      clamp(Math.floor(Number(progress.fishingQuestCompletions) || 0), 0, 1_000_000),
      clamp(Math.floor(Number(progress.fishingQuestSeed) || 1), 1, 1_000_000)
    );
  } else {
    progress.fishingQuest = sanitizeFishingQuest(
      progress.fishingQuest,
      clamp(Math.floor(Number(progress.fishingQuestCompletions) || 0), 0, 1_000_000),
      clamp(Math.floor(Number(progress.fishingQuestSeed) || 1), 1, 1_000_000)
    );
  }
  progress.fishingRodTier = sanitizeFishingRodTier(progress.fishingRodTier, 'basic');
  progress.inventory.fish = clamp(computeTotalFishInBag(progress.fishBag) || Number(progress.inventory.fish) || 0, 0, 1_000_000);
  normalizeProgressLevel(progress);
}

function rodUpgradeSnapshot(progress) {
  const levelState = normalizeProgressLevel(progress);
  const tierId = sanitizeFishingRodTier(progress.fishingRodTier, 'basic');
  const tier = FISH_ROD_DATA[tierId] || FISH_ROD_DATA.basic;
  const next = tier.next;
  if (!next) {
    return {
      currentTier: tierId,
      currentLabel: tier.label,
      currentLevel: levelState.level,
      next: null
    };
  }
  const fishCost = Object.entries(next.fishCost || {}).map(([fishId, amount]) => ({
    fishId,
    name: FISH_SPECIES_BY_ID.get(fishId)?.name || fishId,
    amount: clamp(Math.floor(Number(amount) || 0), 1, 1_000_000),
    owned: clamp(Math.floor(Number(progress.fishBag?.[fishId]) || 0), 0, 1_000_000)
  }));
  const hasFish = fishCost.every((row) => row.owned >= row.amount);
  const hasCoins = (Number(progress.coins) || 0) >= next.coins;
  const levelRequired = levelRequirementForRod(next.tier);
  const meetsLevel = levelState.level >= levelRequired;
  return {
    currentTier: tierId,
    currentLabel: tier.label,
    currentLevel: levelState.level,
    next: {
      tier: next.tier,
      label: FISH_ROD_DATA[next.tier]?.label || next.tier,
      coins: next.coins,
      fishCost,
      levelRequired,
      meetsLevel,
      affordable: hasFish && hasCoins && meetsLevel
    }
  };
}

function fishingQuestSnapshot(progress) {
  return progress.fishingQuest ? { ...progress.fishingQuest } : defaultFishingQuest(0, 1);
}

function isNearFishingIsland(actor, extra = 4.4) {
  return distance2DPoint(actor, FISHING_ISLAND_POS) <= (FISHING_ISLAND_RADIUS + extra);
}

function isNearMarketIsland(actor, extra = 4.4) {
  return distance2DPoint(actor, MARKET_ISLAND_POS) <= (MARKET_ISLAND_RADIUS + extra);
}

function isNearFurnitureIsland(actor, extra = 4.4) {
  return distance2DPoint(actor, FURNITURE_ISLAND_POS) <= (FURNITURE_ISLAND_RADIUS + extra);
}

function isNearMineOreTrader(actor, extra = 3.8) {
  return distance2DPoint(actor, MINE_ORE_TRADER_POS) <= extra;
}

function tryPurchaseFurniture(actor, itemId, now = Date.now()) {
  const progress = actor?.progress;
  if (!actor || !progress) {
    return { ok: false, error: 'Not authenticated.' };
  }
  if (!isNearFurnitureIsland(actor)) {
    return { ok: false, error: 'Buy furniture at the Furniture Trader island.' };
  }
  progress.homeRoom = sanitizeHomeRoom(progress.homeRoom);
  const room = progress.homeRoom;
  ensureFurnitureTraderProgressShape(progress, now);
  const trader = furnitureTraderSnapshot(progress, now);
  const item = trader.items.find((entry) => entry.itemId === itemId) || null;
  if (!item) {
    return { ok: false, error: 'Unknown furniture item.' };
  }
  if (room.ownedFurniture[itemId] === true) {
    return { ok: false, error: 'You already own this furniture.' };
  }
  if (trader.purchasesRemaining <= 0) {
    return { ok: false, error: 'Furniture purchase limit reached for this stock cycle.' };
  }
  if (!item.availableThisCycle) {
    return { ok: false, error: `${item.label} is not in stock this cycle.` };
  }
  if (item.remaining <= 0) {
    return { ok: false, error: `${item.label} is sold out until the next stock refresh.` };
  }
  const price = clamp(Math.floor(Number(item.price) || 0), 0, 100_000_000);
  if (progress.coins < price) {
    return { ok: false, error: `Need ${price} coins.` };
  }
  progress.coins -= price;
  room.ownedFurniture[itemId] = true;
  room.placedFurniture[itemId] = true;
  const purchased = clamp(Math.floor(Number(progress.furnitureTrader?.purchasedThisCycle?.[itemId]) || 0) + 1, 0, 99);
  progress.furnitureTrader.purchasedThisCycle[itemId] = purchased;
  return {
    ok: true,
    itemId,
    label: item.label,
    price,
    furnitureTrader: furnitureTraderSnapshot(progress, now)
  };
}

function fishMatchesQuestTarget(quest, fishId) {
  if (!quest || typeof quest !== 'object') return false;
  if (!fishId || !FISH_SPECIES_BY_ID.has(fishId)) return false;
  const fish = FISH_SPECIES_BY_ID.get(fishId);
  if (quest.targetFishId && quest.targetFishId !== fishId) return false;
  if (quest.targetRarity && fish.rarity !== quest.targetRarity) return false;
  return true;
}

function sanitizeAppearance(input, fallback) {
  const base = fallback || defaultAppearance();
  const payload = input && typeof input === 'object' ? input : {};

  return {
    skin: sanitizeColor(payload.skin, base.skin),
    shirt: sanitizeColor(payload.shirt ?? payload.color, base.shirt),
    pants: sanitizeColor(payload.pants, base.pants),
    shoes: sanitizeColor(payload.shoes, base.shoes),
    hairStyle: HAIR_STYLES.has(payload.hairStyle) ? payload.hairStyle : base.hairStyle,
    hairColor: sanitizeColor(payload.hairColor, base.hairColor),
    faceStyle: FACE_STYLES.has(payload.faceStyle) ? payload.faceStyle : base.faceStyle,
    accessories: Array.isArray(payload.accessories)
      ? [...new Set(payload.accessories.filter((item) => ACCESSORY_TYPES.has(item)))]
      : Array.isArray(base.accessories)
        ? [...new Set(base.accessories.filter((item) => ACCESSORY_TYPES.has(item)))]
        : []
  };
}

function sanitizeProfileId(value) {
  const raw = typeof value === 'string' ? value : '';
  const safe = raw.trim().toLowerCase().slice(0, 64);
  return /^[a-z0-9-]{8,64}$/.test(safe) ? safe : null;
}

function sanitizeUsername(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const lower = raw.toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(lower) ? lower : null;
}

function sanitizePassword(value) {
  const raw = typeof value === 'string' ? value : '';
  return raw.length >= 4 && raw.length <= 80 ? raw : null;
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const chatFilterPattern = new RegExp(`\\b(${CHAT_FILTER_WORDS.map(escapeRegex).join('|')})\\b`, 'gi');

function filterChatText(text) {
  return String(text).replace(chatFilterPattern, (word) => '#'.repeat(word.length));
}

function accountRoleTagForProfileId(profileId) {
  const key = String(profileId || '').trim().toLowerCase();
  return ACCOUNT_ROLE_TAG_BY_PROFILE_ID.get(key) || null;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  try {
    const computed = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function parseMaybeJson(value, fallback = {}) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function getDbClient() {
  if (!USE_TURSO) return null;
  if (dbClient) return dbClient;
  dbClient = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN || undefined
  });
  return dbClient;
}

async function initDatabase() {
  if (!USE_TURSO) return false;
  try {
    const client = getDbClient();
    await client.execute('pragma foreign_keys = on');
    await client.execute(`
      create table if not exists profiles (
        profile_id text primary key,
        name text not null,
        color text not null,
        appearance text not null default '{}',
        x real,
        y real,
        z real,
        progress text not null default '{}',
        updated_at text not null default (datetime('now'))
      )
    `);
    await client.execute(`
      create table if not exists accounts (
        username text primary key,
        salt text not null,
        hash text not null,
        profile_id text not null references profiles(profile_id) on delete cascade,
        updated_at text not null default (datetime('now'))
      )
    `);
    await client.execute('create index if not exists idx_accounts_profile_id on accounts(profile_id)');
    dbReady = true;
    return true;
  } catch (error) {
    console.error('[db] Turso init failed, falling back to JSON storage:', error?.message || error);
    dbReady = false;
    return false;
  }
}

async function loadProfilesFromDb() {
  if (!dbReady) return;
  const client = getDbClient();
  const result = await client.execute(
    'select profile_id, name, color, appearance, x, y, z, progress from profiles'
  );
  const rows = Array.isArray(result.rows) ? result.rows : [];
  profiles.clear();
  for (const row of rows) {
    const profileId = sanitizeProfileId(row.profile_id);
    if (!profileId) continue;
    const name = sanitizeName(row.name, `Player-${profileId.slice(0, 4)}`);
    const color = sanitizeColor(row.color, randomHexColor());
    const appearance = sanitizeAppearance(parseMaybeJson(row.appearance), { ...defaultAppearance(), shirt: color });
    profiles.set(profileId, {
      name,
      color: appearance.shirt,
      appearance,
      x: Number.isFinite(Number(row.x)) ? Number(row.x) : null,
      y: Number.isFinite(Number(row.y)) ? Number(row.y) : null,
      z: Number.isFinite(Number(row.z)) ? Number(row.z) : null,
      progress: sanitizeProgress(parseMaybeJson(row.progress))
    });
  }
}

async function loadAccountsFromDb() {
  if (!dbReady) return;
  const client = getDbClient();
  const result = await client.execute('select username, salt, hash, profile_id from accounts');
  const rows = Array.isArray(result.rows) ? result.rows : [];
  accounts.clear();
  for (const row of rows) {
    const username = sanitizeUsername(row.username);
    const salt = typeof row.salt === 'string' ? row.salt : '';
    const hash = typeof row.hash === 'string' ? row.hash : '';
    const profileId = sanitizeProfileId(row.profile_id) || `acct-${username}`;
    if (!username || !salt || !hash) continue;
    accounts.set(username, { username, salt, hash, profileId });
  }
}

async function saveProfileToDb(profileId, profile) {
  if (!dbReady || !profileId || !profile) return;
  const client = getDbClient();
  await client.execute({
    sql: `insert into profiles (profile_id, name, color, appearance, x, y, z, progress, updated_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          on conflict(profile_id) do update
          set name = excluded.name,
              color = excluded.color,
              appearance = excluded.appearance,
              x = excluded.x,
              y = excluded.y,
              z = excluded.z,
              progress = excluded.progress,
              updated_at = datetime('now')`,
    args: [
      profileId,
      profile.name,
      profile.color,
      JSON.stringify(profile.appearance || defaultAppearance()),
      Number.isFinite(profile.x) ? profile.x : null,
      Number.isFinite(profile.y) ? profile.y : null,
      Number.isFinite(profile.z) ? profile.z : null,
      JSON.stringify(sanitizeProgress(profile.progress))
    ]
  });
}

async function saveAccountToDb(username, account) {
  if (!dbReady || !username || !account) return;
  const client = getDbClient();
  await client.execute({
    sql: `insert into accounts (username, salt, hash, profile_id, updated_at)
          values (?, ?, ?, ?, datetime('now'))
          on conflict(username) do update
          set salt = excluded.salt,
              hash = excluded.hash,
              profile_id = excluded.profile_id,
              updated_at = datetime('now')`,
    args: [username, account.salt, account.hash, account.profileId]
  });
}

function readProfiles() {
  try {
    if (!fs.existsSync(PROFILE_FILE)) {
      return;
    }
    const fileData = fs.readFileSync(PROFILE_FILE, 'utf8');
    const parsed = JSON.parse(fileData);
    for (const [profileId, profile] of Object.entries(parsed)) {
      if (!sanitizeProfileId(profileId)) continue;
      const name = sanitizeName(profile?.name, `Player-${profileId.slice(0, 4)}`);
      const color = sanitizeColor(profile?.color, randomHexColor());
      const appearance = sanitizeAppearance(profile?.appearance, {
        ...defaultAppearance(),
        shirt: color
      });
      const x = Number(profile?.x);
      const y = Number(profile?.y);
      const z = Number(profile?.z);
      profiles.set(profileId, {
        name,
        color: appearance.shirt,
        appearance,
        x: Number.isFinite(x) ? x : null,
        y: Number.isFinite(y) ? y : null,
        z: Number.isFinite(z) ? z : null,
        progress: sanitizeProgress(profile?.progress)
      });
    }
  } catch {
    // Ignore corrupt profile storage and continue with runtime defaults.
  }
}

function readAccounts() {
  try {
    if (!fs.existsSync(ACCOUNT_FILE)) {
      return;
    }
    const fileData = fs.readFileSync(ACCOUNT_FILE, 'utf8');
    const parsed = JSON.parse(fileData);
    for (const [usernameKey, account] of Object.entries(parsed)) {
      const username = sanitizeUsername(usernameKey);
      if (!username) continue;
      const salt = typeof account?.salt === 'string' ? account.salt : '';
      const hash = typeof account?.hash === 'string' ? account.hash : '';
      const profileId = sanitizeProfileId(account?.profileId) || `acct-${username}`;
      if (!salt || !hash) continue;
      accounts.set(username, { username, salt, hash, profileId });
    }
  } catch {
    // Ignore corrupt account storage and continue.
  }
}

function serializeProfiles() {
  const serialized = {};
  for (const [profileId, profile] of profiles.entries()) {
    serialized[profileId] = {
      name: profile.name,
      color: profile.color,
      appearance: profile.appearance,
      x: Number.isFinite(profile.x) ? profile.x : null,
      y: Number.isFinite(profile.y) ? profile.y : null,
      z: Number.isFinite(profile.z) ? profile.z : null,
      progress: sanitizeProgress(profile.progress)
    };
  }
  return serialized;
}

function serializeAccounts() {
  const serialized = {};
  for (const [username, account] of accounts.entries()) {
    serialized[username] = {
      salt: account.salt,
      hash: account.hash,
      profileId: account.profileId
    };
  }
  return serialized;
}

async function saveProfilesNow() {
  if (dbReady) {
    try {
      const writes = [];
      for (const [profileId, profile] of profiles.entries()) {
        writes.push(saveProfileToDb(profileId, profile));
      }
      await Promise.all(writes);
    } catch (error) {
      console.error('[db] Failed to save profiles:', error?.message || error);
    }
    return;
  }
  try {
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(serializeProfiles(), null, 2));
  } catch {
    // Ignore write failures; runtime state remains authoritative.
  }
}

async function saveAccountsNow() {
  if (dbReady) {
    try {
      const writes = [];
      for (const [username, account] of accounts.entries()) {
        writes.push(saveAccountToDb(username, account));
      }
      await Promise.all(writes);
    } catch (error) {
      console.error('[db] Failed to save accounts:', error?.message || error);
    }
    return;
  }
  try {
    fs.writeFileSync(ACCOUNT_FILE, JSON.stringify(serializeAccounts(), null, 2));
  } catch {
    // Ignore write failures; runtime state remains authoritative.
  }
}

async function flushPendingSaves() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (accountSaveTimer) {
    clearTimeout(accountSaveTimer);
    accountSaveTimer = null;
  }
  await Promise.all([saveProfilesNow(), saveAccountsNow()]);
}

function scheduleProfileSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveProfilesNow();
  }, 250);
}

function scheduleAccountSave() {
  if (accountSaveTimer) {
    clearTimeout(accountSaveTimer);
  }
  accountSaveTimer = setTimeout(() => {
    accountSaveTimer = null;
    void saveAccountsNow();
  }, 250);
}

function findProfileIdByDisplayName(name, excludeProfileId = null) {
  const key = normalizeNameKey(name);
  if (!key) return null;
  for (const [profileId, profile] of profiles.entries()) {
    if (excludeProfileId && profileId === excludeProfileId) continue;
    if (normalizeNameKey(profile?.name) === key) {
      return profileId;
    }
  }
  return null;
}

function findAccountByUsernameLikeName(name, excludeProfileId = null) {
  const key = normalizeNameKey(name);
  if (!key) return null;
  for (const account of accounts.values()) {
    if (excludeProfileId && account.profileId === excludeProfileId) continue;
    if (normalizeNameKey(account.username) === key) {
      return account;
    }
  }
  return null;
}

async function bootstrapPersistence() {
  const dbOk = await initDatabase();
  if (dbOk) {
    await loadProfilesFromDb();
    await loadAccountsFromDb();
    console.log('[db] Using Turso persistence.');
    return;
  }
  readProfiles();
  readAccounts();
  console.log('[db] Using JSON file persistence.');
}

await bootstrapPersistence();

function ensureProfileExists(profileId, username, options = {}) {
  if (!profileId) return false;
  if (profiles.has(profileId)) return false;
  const shirt = randomHexColor();
  profiles.set(profileId, {
    name: sanitizeName(username, username || `Player-${profileId.slice(0, 4)}`),
    color: shirt,
    appearance: sanitizeAppearance(null, { ...defaultAppearance(), shirt }),
    x: null,
    y: null,
    z: null,
    progress: defaultProgress()
  });
  if (!options.deferSave) {
    scheduleProfileSave();
  }
  return true;
}

function spawnPlayer(socket, profileId, username) {
  ensureProfileExists(profileId, username);
  const profile = profiles.get(profileId);
  const spawnPoint = randomMainIslandSpawn(WORLD_LIMIT * 0.65);
  const spawn = {
    id: socket.id,
    profileId,
    accountTag: accountRoleTagForProfileId(profileId),
    name: profile?.name || username || `Player-${socket.id.slice(0, 4)}`,
    x: spawnPoint.x,
    y: ISLAND_SURFACE_Y,
    z: spawnPoint.z,
    inMine: false,
    isFishing: false,
    torchEquipped: false,
    appearance: sanitizeAppearance(profile?.appearance, {
      ...defaultAppearance(),
      shirt: profile?.color || randomHexColor()
    }),
    progress: sanitizeProgress(profile?.progress)
  };
  ensureFishingProgressShape(spawn.progress);
  spawn.color = spawn.appearance.shirt;
  spawn.pickaxe = sanitizePickaxe(spawn.progress?.pickaxe, 'wood');
  players.set(socket.id, spawn);
  socket.emit('init', {
    id: socket.id,
    players: [...players.values()],
    worldLimit: WORLD_LIMIT,
    interactables: [...interactables.values()],
    progress: progressSnapshot(spawn.progress)
  });
  socket.broadcast.emit('playerJoined', spawn);
}

function persistPlayerProgress(player, options = {}) {
  if (!player?.profileId) return;
  profiles.set(player.profileId, {
    name: player.name,
    color: player.color,
    appearance: player.appearance,
    x: player.x,
    y: player.y,
    z: player.z,
    progress: sanitizeProgress(player.progress)
  });
  if (options.immediate) {
    void saveProfilesNow();
    return;
  }
  scheduleProfileSave();
}

function emitProgress(socket, player) {
  if (!socket || !player?.progress) return;
  socket.emit('progress:update', progressSnapshot(player.progress));
}

function removeAuthenticatedPlayer(socket) {
  const existing = players.get(socket.id);
  if (!existing) return;
  persistPlayerProgress(existing);
  players.delete(socket.id);
  voiceParticipants.delete(socket.id);
  socket.broadcast.emit('voice:user-left', socket.id);
  io.emit('playerLeft', socket.id);
}

io.on('connection', (socket) => {
  socket.data.lastFishCastAt = 0;
  socket.data.fishChallenge = null;
  socket.emit('auth:required');

  socket.on('auth:register', async (payload, ack) => {
    const username = sanitizeUsername(payload?.username);
    const password = sanitizePassword(payload?.password);
    if (!username || !password) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Use 3-20 letters/numbers for username and min 4-char password.' });
      return;
    }
    if (accounts.has(username)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Username already exists.' });
      return;
    }
    if (findProfileIdByDisplayName(username)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Display username already exists. Choose a different account username.' });
      return;
    }
    const { salt, hash } = hashPassword(password);
    const profileId = `acct-${username}`;
    const profileWasCreated = ensureProfileExists(profileId, username, { deferSave: true });
    const account = { username, salt, hash, profileId };
    accounts.set(username, account);
    try {
      if (dbReady) {
        await saveProfileToDb(profileId, profiles.get(profileId));
        await saveAccountToDb(username, account);
      } else {
        await saveProfilesNow();
        await saveAccountsNow();
      }
    } catch (error) {
      accounts.delete(username);
      if (profileWasCreated) {
        profiles.delete(profileId);
      }
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'Could not save account. Please try again.' });
      }
      return;
    }
    spawnPlayer(socket, profileId, username);
    if (typeof ack === 'function') ack({ ok: true, username });
  });

  socket.on('auth:login', (payload, ack) => {
    const username = sanitizeUsername(payload?.username);
    const password = sanitizePassword(payload?.password);
    if (!username || !password) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Invalid username or password.' });
      return;
    }
    const account = accounts.get(username);
    if (!account || !verifyPassword(password, account.salt, account.hash)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Invalid username or password.' });
      return;
    }
    ensureProfileExists(account.profileId, username);
    spawnPlayer(socket, account.profileId, username);
    if (typeof ack === 'function') ack({ ok: true, username });
  });

  socket.on('auth:logout', () => {
    socket.data.fishChallenge = null;
    removeAuthenticatedPlayer(socket);
  });

  socket.on('move', (payload) => {
    const current = players.get(socket.id);
    if (!current || !payload) return;

    const x = Number(payload.x);
    const y = Number(payload.y);
    const z = Number(payload.z);
    const nextX = Number.isFinite(x) ? x : current.x;
    const nextY = Number.isFinite(y) ? y : current.y;
    const nextZ = Number.isFinite(z) ? z : current.z;
    const boundedX = clamp(nextX, -PLAYABLE_BOUND, PLAYABLE_BOUND);
    const boundedZ = clamp(nextZ, -PLAYABLE_BOUND, PLAYABLE_BOUND);
    const inMine = payload?.inMine === true;
    const isFishing = payload?.isFishing === true && current?.progress?.hasFishingRod === true;
    const next = clampToPlayableGround(boundedX, boundedZ, inMine);

    current.x = next.x;
    current.y = clamp(nextY, SWIM_MIN_Y, 30);
    current.z = next.z;
    current.isFishing = isFishing;
    players.set(socket.id, current);
    persistPlayerProgress(current);

    socket.broadcast.emit('playerMoved', {
      id: socket.id,
      x: current.x,
      y: current.y,
      z: current.z,
      accountTag: accountRoleTagForProfileId(current.profileId),
      name: current.name,
      color: current.color,
      appearance: current.appearance,
      pickaxe: sanitizePickaxe(current?.progress?.pickaxe, 'wood'),
      torchEquipped: current.torchEquipped === true,
      hasFishingRod: current?.progress?.hasFishingRod === true,
      fishingRodTier: sanitizeFishingRodTier(current?.progress?.fishingRodTier, 'basic'),
      isFishing: current.isFishing === true
    });
  });

  socket.on('quest:accept', (payload, ack) => {
    const actor = players.get(socket.id);
    if (!actor?.progress?.quest) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Quest system unavailable.' });
      return;
    }
    const quest = actor.progress.quest;
    if (quest.status === 'ready') {
      if (typeof ack === 'function') ack({ ok: false, error: 'Claim your current quest reward first.' });
      return;
    }
    if (quest.status === 'active') {
      if (typeof ack === 'function') ack({ ok: true, quest, alreadyActive: true });
      return;
    }
    quest.status = 'active';
    persistPlayerProgress(actor);
    emitProgress(socket, actor);
    if (typeof ack === 'function') ack({ ok: true, quest });
  });

  socket.on('quest:claim', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    const quest = progress?.quest;
    if (!actor || !progress || !quest || quest.status !== 'ready') {
      if (typeof ack === 'function') ack({ ok: false, error: 'No completed quest to claim.' });
      return;
    }
    const rewardXp = clamp(Math.floor(Number(quest.rewardXp) || 0), 0, 1_000_000);
    const xpResult = grantExperience(progress, rewardXp);
    if (quest.rewardDiamonds > 0) {
      progress.inventory.diamond += quest.rewardDiamonds;
    }
    const title = quest.title;
    const bonus = quest.rewardDiamonds;
    nextQuest(progress);
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    io.emit('chat', {
      fromName: 'System',
      text: `${actor.name} completed "${title}" for ${xpResult.gained} XP${bonus ? ` and ${bonus} diamond` : ''}.`,
      sentAt: Date.now()
    });
    if (typeof ack === 'function') {
      ack({
        ok: true,
        rewardXp: xpResult.gained,
        level: xpResult.level,
        leveledUp: xpResult.leveledUp
      });
    }
  });

  socket.on('mine:collect', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false });
      return;
    }
    const nearMine = Math.hypot(actor.x - MINE_POS.x, actor.z - MINE_POS.z) <= MINE_RADIUS + 4.5;
    if (!nearMine) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Go to the mine to collect ore.' });
      return;
    }
    const resource = ORE_TYPES.has(payload?.resource) ? payload.resource : null;
    const amount = clamp(Math.floor(Number(payload?.amount) || 0), 1, 20);
    if (!resource) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Invalid ore type.' });
      return;
    }
    progress.inventory[resource] = clamp((progress.inventory[resource] || 0) + amount, 0, 1_000_000);
    const quest = progress.quest;
    let questProgressed = false;
    if (quest?.status === 'active' && quest.type === 'mine') {
      quest.progress = clamp(quest.progress + amount, 0, quest.targetCount);
      questProgressed = true;
      if (quest.progress >= quest.targetCount) {
        quest.status = 'ready';
      }
    }
    persistPlayerProgress(actor);
    emitProgress(socket, actor);
    io.emit('player:mined', { id: socket.id, sentAt: Date.now() });
    if (typeof ack === 'function') ack({ ok: true, progress: progressSnapshot(progress), questProgressed });
  });

  socket.on('shop:buyPickaxe', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    const requested = sanitizePickaxe(payload?.tier, '');
    if (!requested || requested === 'wood') {
      if (typeof ack === 'function') ack({ ok: false, error: 'Invalid pickaxe tier.' });
      return;
    }
    const currentIdx = PICKAXE_ORDER.indexOf(progress.pickaxe);
    const requestedIdx = PICKAXE_ORDER.indexOf(requested);
    if (requestedIdx !== currentIdx + 1) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Buy pickaxes in order.' });
      return;
    }
    const currentLevel = normalizeProgressLevel(progress).level;
    const requiredLevel = levelRequirementForPickaxe(requested);
    if (currentLevel < requiredLevel) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: `Need level ${requiredLevel} for ${requested} pickaxe.` });
      }
      return;
    }
    const price = PICKAXE_PRICE[requested] || 0;
    if (progress.coins < price) {
      if (typeof ack === 'function') ack({ ok: false, error: `Need ${price} coins.` });
      return;
    }
    progress.coins -= price;
    progress.pickaxe = requested;
    actor.pickaxe = requested;
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    io.emit('playerGear', {
      id: socket.id,
      pickaxe: progress.pickaxe,
      torchEquipped: actor.torchEquipped === true,
      hasFishingRod: progress.hasFishingRod === true,
      fishingRodTier: sanitizeFishingRodTier(progress.fishingRodTier, 'basic'),
      isFishing: actor.isFishing === true
    });
    if (typeof ack === 'function') ack({ ok: true, tier: requested });
  });

  socket.on('shop:getRodShop', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    ensureFishingProgressShape(progress);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        hasFishingRod: progress.hasFishingRod === true,
        buyPrice: FISHING_ROD_PRICE,
        rodShop: rodUpgradeSnapshot(progress),
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('shop:buyFishingRod', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    if (!isNearFishingIsland(actor)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Buy rods at the Fishing Trader island.' });
      return;
    }
    if (progress.hasFishingRod === true) {
      if (typeof ack === 'function') ack({ ok: false, error: 'You already own a fishing rod.' });
      return;
    }
    const currentLevel = normalizeProgressLevel(progress).level;
    const requiredLevel = levelRequirementForRod('basic');
    if (currentLevel < requiredLevel) {
      if (typeof ack === 'function') ack({ ok: false, error: `Need level ${requiredLevel} for a Fishing Rod.` });
      return;
    }
    if (progress.coins < FISHING_ROD_PRICE) {
      if (typeof ack === 'function') ack({ ok: false, error: `Need ${FISHING_ROD_PRICE} coins.` });
      return;
    }
    ensureFishingProgressShape(progress);
    progress.coins -= FISHING_ROD_PRICE;
    progress.hasFishingRod = true;
    progress.fishingRodTier = 'basic';
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    io.emit('playerGear', {
      id: socket.id,
      pickaxe: sanitizePickaxe(progress.pickaxe, 'wood'),
      torchEquipped: actor.torchEquipped === true,
      hasFishingRod: progress.hasFishingRod === true,
      fishingRodTier: sanitizeFishingRodTier(progress.fishingRodTier, 'basic'),
      isFishing: actor.isFishing === true
    });
    if (typeof ack === 'function') {
      ack({
        ok: true,
        hasFishingRod: true,
        rodShop: rodUpgradeSnapshot(progress),
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('shop:upgradeFishingRod', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    if (!isNearFishingIsland(actor)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Rod upgrades are available at the Fishing Trader island.' });
      return;
    }
    ensureFishingProgressShape(progress);
    if (progress.hasFishingRod !== true) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Buy a fishing rod first.' });
      return;
    }
    const tier = FISH_ROD_DATA[sanitizeFishingRodTier(progress.fishingRodTier, 'basic')] || FISH_ROD_DATA.basic;
    if (!tier.next) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Rod is already max tier.' });
      return;
    }
    const currentLevel = normalizeProgressLevel(progress).level;
    const requiredLevel = levelRequirementForRod(tier.next.tier);
    if (currentLevel < requiredLevel) {
      if (typeof ack === 'function') {
        ack({
          ok: false,
          error: `Need level ${requiredLevel} for ${FISH_ROD_DATA[tier.next.tier]?.label || tier.next.tier}.`
        });
      }
      return;
    }
    if (progress.coins < tier.next.coins) {
      if (typeof ack === 'function') ack({ ok: false, error: `Need ${tier.next.coins} coins.` });
      return;
    }
    for (const [fishId, amount] of Object.entries(tier.next.fishCost || {})) {
      const owned = clamp(Math.floor(Number(progress.fishBag?.[fishId]) || 0), 0, 1_000_000);
      const needed = clamp(Math.floor(Number(amount) || 0), 0, 1_000_000);
      if (owned < needed) {
        const fishName = FISH_SPECIES_BY_ID.get(fishId)?.name || fishId;
        if (typeof ack === 'function') ack({ ok: false, error: `Need ${needed} ${fishName}.` });
        return;
      }
    }
    progress.coins -= tier.next.coins;
    for (const [fishId, amount] of Object.entries(tier.next.fishCost || {})) {
      const owned = clamp(Math.floor(Number(progress.fishBag?.[fishId]) || 0), 0, 1_000_000);
      const left = Math.max(0, owned - clamp(Math.floor(Number(amount) || 0), 0, 1_000_000));
      if (left > 0) {
        progress.fishBag[fishId] = left;
      } else {
        delete progress.fishBag[fishId];
      }
    }
    progress.inventory.fish = clamp(computeTotalFishInBag(progress.fishBag), 0, 1_000_000);
    progress.fishingRodTier = sanitizeFishingRodTier(tier.next.tier, progress.fishingRodTier);
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    io.emit('playerGear', {
      id: socket.id,
      pickaxe: sanitizePickaxe(progress.pickaxe, 'wood'),
      torchEquipped: actor.torchEquipped === true,
      hasFishingRod: progress.hasFishingRod === true,
      fishingRodTier: sanitizeFishingRodTier(progress.fishingRodTier, 'basic'),
      isFishing: actor.isFishing === true
    });
    if (typeof ack === 'function') {
      ack({
        ok: true,
        rodShop: rodUpgradeSnapshot(progress),
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('shop:getFurnitureTrader', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    ensureFurnitureTraderProgressShape(progress);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        furnitureTrader: furnitureTraderSnapshot(progress),
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('shop:buyFurniture', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    const itemId = typeof payload?.itemId === 'string' ? payload.itemId.trim().toLowerCase() : '';
    if (!HOME_ROOM_FURNITURE_IDS.includes(itemId)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unknown furniture item.' });
      return;
    }
    const result = tryPurchaseFurniture(actor, itemId);
    if (!result.ok) {
      if (typeof ack === 'function') ack(result);
      return;
    }
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        itemId: result.itemId,
        price: result.price,
        furnitureTrader: result.furnitureTrader,
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('home:buyFurniture', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    const itemId = typeof payload?.itemId === 'string' ? payload.itemId.trim().toLowerCase() : '';
    if (!HOME_ROOM_FURNITURE_IDS.includes(itemId)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unknown furniture item.' });
      return;
    }
    const result = tryPurchaseFurniture(actor, itemId);
    if (!result.ok) {
      if (typeof ack === 'function') ack(result);
      return;
    }
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        itemId: result.itemId,
        price: result.price,
        furnitureTrader: result.furnitureTrader,
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('home:toggleFurniture', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    progress.homeRoom = sanitizeHomeRoom(progress.homeRoom);
    const room = progress.homeRoom;
    const itemId = typeof payload?.itemId === 'string' ? payload.itemId.trim().toLowerCase() : '';
    if (!HOME_ROOM_FURNITURE_IDS.includes(itemId)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unknown furniture item.' });
      return;
    }
    if (room.ownedFurniture[itemId] !== true) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Buy this furniture first.' });
      return;
    }
    const desiredPlaced = payload?.placed === true || payload?.placed === false
      ? payload.placed === true
      : !(room.placedFurniture[itemId] === true);
    room.placedFurniture[itemId] = desiredPlaced;
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        itemId,
        placed: desiredPlaced,
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('home:setPaint', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    progress.homeRoom = sanitizeHomeRoom(progress.homeRoom);
    const room = progress.homeRoom;
    const surface = payload?.surface === 'floor' ? 'floor' : (payload?.surface === 'wall' ? 'wall' : '');
    const paintId = typeof payload?.paintId === 'string' ? payload.paintId.trim().toLowerCase() : '';
    if (!surface) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Invalid paint surface.' });
      return;
    }
    const validSet = surface === 'wall' ? HOME_ROOM_WALL_PAINTS : HOME_ROOM_FLOOR_PAINTS;
    if (!validSet.has(paintId)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unknown paint option.' });
      return;
    }
    if ((surface === 'wall' ? room.wallPaint : room.floorPaint) === paintId) {
      if (typeof ack === 'function') ack({ ok: true, unchanged: true, progress: progressSnapshot(progress) });
      return;
    }
    if (progress.coins < HOME_ROOM_PAINT_PRICE) {
      if (typeof ack === 'function') ack({ ok: false, error: `Need ${HOME_ROOM_PAINT_PRICE} coins.` });
      return;
    }
    progress.coins -= HOME_ROOM_PAINT_PRICE;
    if (surface === 'wall') {
      room.wallPaint = paintId;
    } else {
      room.floorPaint = paintId;
    }
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        surface,
        paintId,
        price: HOME_ROOM_PAINT_PRICE,
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('fish:start', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    ensureFishingProgressShape(progress);
    if (progress.hasFishingRod !== true) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Buy a fishing rod first.' });
      return;
    }
    if (!isNearFishingIsland(actor) && !isNearMarketIsland(actor)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Fish near the Fishing or Market islands only.' });
      return;
    }
    const now = Date.now();
    const lastCastAt = Number(socket.data.lastFishCastAt) || 0;
    if (now - lastCastAt < 250) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Cast again in a moment.' });
      return;
    }
    socket.data.lastFishCastAt = now;
    const rodTier = sanitizeFishingRodTier(progress.fishingRodTier, 'basic');
    const caughtFish = rollRandomFishSpecies({ rodTier });
    if (!caughtFish || !FISH_SPECIES_BY_ID.has(caughtFish.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'No fish available right now. Try again.' });
      return;
    }
    const difficulty = fishingDifficultyForCatch(caughtFish, rodTier);
    const challengeId = `fc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    socket.data.fishChallenge = {
      id: challengeId,
      fishId: caughtFish.id,
      createdAt: now,
      expiresAt: now + FISH_CHALLENGE_EXPIRE_MS
    };
    if (typeof ack === 'function') {
      ack({
        ok: true,
        challengeId,
        fish: fishCatchSnapshot(caughtFish),
        rodTier,
        difficulty
      });
    }
  });

  socket.on('fish:catch', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    ensureFishingProgressShape(progress);
    if (progress.hasFishingRod !== true) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Buy a fishing rod first.' });
      return;
    }
    if (!isNearFishingIsland(actor) && !isNearMarketIsland(actor)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Fish near the Fishing or Market islands only.' });
      return;
    }
    const challengeId = typeof payload?.challengeId === 'string' ? payload.challengeId : '';
    const pending = socket.data.fishChallenge;
    if (!pending || pending.id !== challengeId) {
      if (typeof ack === 'function') ack({ ok: false, error: 'No active fishing cast.' });
      return;
    }
    if (Date.now() > Number(pending.expiresAt || 0)) {
      socket.data.fishChallenge = null;
      if (typeof ack === 'function') ack({ ok: false, error: 'Fish got away. Cast again.' });
      return;
    }
    const caughtFish = FISH_SPECIES_BY_ID.get(pending.fishId);
    socket.data.fishChallenge = null;
    if (!caughtFish) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Fish catch failed. Try again.' });
      return;
    }
    progress.fishBag[caughtFish.id] = clamp((progress.fishBag[caughtFish.id] || 0) + 1, 1, 1_000_000);
    progress.inventory.fish = clamp(computeTotalFishInBag(progress.fishBag), 0, 1_000_000);
    progress.fishIndex[caughtFish.id] = clamp((progress.fishIndex[caughtFish.id] || 0) + 1, 1, 1_000_000);
    const fishingQuest = progress.fishingQuest;
    let fishingQuestProgressed = false;
    if (fishingQuest?.status === 'active' && fishMatchesQuestTarget(fishingQuest, caughtFish.id)) {
      fishingQuest.progress = clamp((fishingQuest.progress || 0) + 1, 0, fishingQuest.targetCount || 0);
      fishingQuestProgressed = true;
      if (fishingQuest.progress >= fishingQuest.targetCount) {
        fishingQuest.status = 'ready';
      }
    }
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        caught: 1,
        fish: progress.inventory.fish,
        fishCaughtCount: progress.fishBag[caughtFish.id],
        caughtFish: fishCatchSnapshot(caughtFish),
        fishingQuestProgressed,
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('market:sellSelection', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    ensureFishingProgressShape(progress);
    const category = payload?.category === 'ore' ? 'ore' : 'fish';
    const itemId = typeof payload?.itemId === 'string' ? payload.itemId.trim() : '';
    const rawAmount = Number(payload?.amount);
    const amount = Number.isFinite(rawAmount) ? clamp(Math.floor(rawAmount), 1, 1_000_000) : 1;
    if (category === 'ore') {
      if (!isNearMineOreTrader(actor)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Sell ores at the Mine Ore Trader.' });
        return;
      }
      if (!ORE_TYPES.has(itemId)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Select a valid ore.' });
        return;
      }
      const owned = clamp(Math.floor(Number(progress.inventory[itemId]) || 0), 0, 1_000_000);
      if (owned <= 0) {
        if (typeof ack === 'function') ack({ ok: false, error: 'You do not have that ore.' });
        return;
      }
      const sold = clamp(amount, 1, owned);
      const unitPrice = ORE_SELL_PRICE[itemId] || 0;
      const coinsEarned = sold * unitPrice;
      progress.inventory[itemId] = owned - sold;
      progress.coins = clamp((progress.coins || 0) + coinsEarned, 0, 100_000_000);
      persistPlayerProgress(actor, { immediate: true });
      emitProgress(socket, actor);
      if (typeof ack === 'function') {
        ack({
          ok: true,
          sold,
          category,
          itemId,
          unitPrice,
          coinsEarned,
          progress: progressSnapshot(progress)
        });
      }
      return;
    }
    if (!isNearMarketIsland(actor)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Sell fish at the Market island.' });
      return;
    }
    if (!FISH_SPECIES_IDS.has(itemId)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Select a valid fish.' });
      return;
    }
    const owned = clamp(Math.floor(Number(progress.fishBag[itemId]) || 0), 0, 1_000_000);
    if (owned <= 0) {
      if (typeof ack === 'function') ack({ ok: false, error: 'You do not have that fish.' });
      return;
    }
    const sold = clamp(amount, 1, owned);
    const unitPrice = fishSellPrice(itemId);
    const coinsEarned = sold * unitPrice;
    const left = owned - sold;
    if (left > 0) {
      progress.fishBag[itemId] = left;
    } else {
      delete progress.fishBag[itemId];
    }
    progress.inventory.fish = clamp(computeTotalFishInBag(progress.fishBag), 0, 1_000_000);
    progress.coins = clamp((progress.coins || 0) + coinsEarned, 0, 100_000_000);
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        sold,
        category,
        itemId,
        unitPrice,
        coinsEarned,
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('market:fishingQuestAccept', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    if (!isNearMarketIsland(actor)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Talk to the Market Trader to accept fishing quests.' });
      return;
    }
    ensureFishingProgressShape(progress);
    const quest = progress.fishingQuest;
    if (!quest || quest.status !== 'available') {
      if (typeof ack === 'function') ack({ ok: false, error: 'No quest available to accept.' });
      return;
    }
    quest.status = 'active';
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') ack({ ok: true, quest: fishingQuestSnapshot(progress), progress: progressSnapshot(progress) });
  });

  socket.on('market:fishingQuestTurnIn', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    if (!isNearMarketIsland(actor)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Turn in quest fish at the Market island.' });
      return;
    }
    ensureFishingProgressShape(progress);
    const quest = progress.fishingQuest;
    if (!quest || quest.status !== 'active') {
      if (typeof ack === 'function') ack({ ok: false, error: 'No active fishing quest.' });
      return;
    }
    const fishId = typeof payload?.fishId === 'string' ? payload.fishId : '';
    if (!FISH_SPECIES_IDS.has(fishId)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Select a valid fish to turn in.' });
      return;
    }
    if (!fishMatchesQuestTarget(quest, fishId)) {
      if (typeof ack === 'function') {
        const targetName = quest.targetFishId
          ? (FISH_SPECIES_BY_ID.get(quest.targetFishId)?.name || quest.targetFishId)
          : `${quest.targetRarity} fish`;
        ack({ ok: false, error: `This quest needs ${targetName}.` });
      }
      return;
    }
    const rawAmount = Number(payload?.amount);
    const amount = Number.isFinite(rawAmount) ? clamp(Math.floor(rawAmount), 1, 1_000_000) : 1;
    const owned = clamp(Math.floor(Number(progress.fishBag[fishId]) || 0), 0, 1_000_000);
    if (owned <= 0) {
      if (typeof ack === 'function') ack({ ok: false, error: 'You do not have that fish.' });
      return;
    }
    const remainingNeeded = clamp((quest.targetCount || 0) - (quest.progress || 0), 0, 1_000_000);
    if (remainingNeeded <= 0) {
      quest.status = 'ready';
      if (typeof ack === 'function') ack({ ok: false, error: 'Quest already complete. Claim reward.' });
      return;
    }
    const turnIn = Math.min(amount, owned, remainingNeeded);
    const left = owned - turnIn;
    if (left > 0) {
      progress.fishBag[fishId] = left;
    } else {
      delete progress.fishBag[fishId];
    }
    progress.inventory.fish = clamp(computeTotalFishInBag(progress.fishBag), 0, 1_000_000);
    quest.progress = clamp((quest.progress || 0) + turnIn, 0, quest.targetCount || 0);
    if (quest.progress >= quest.targetCount) {
      quest.status = 'ready';
    }
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        turnedIn: turnIn,
        quest: fishingQuestSnapshot(progress),
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('market:fishingQuestClaim', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    if (!isNearMarketIsland(actor)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Claim fishing quests at the Market island.' });
      return;
    }
    ensureFishingProgressShape(progress);
    const quest = progress.fishingQuest;
    if (!quest || quest.status !== 'ready') {
      if (typeof ack === 'function') ack({ ok: false, error: 'No completed fishing quest to claim.' });
      return;
    }
    const rewardXp = clamp(Math.floor(Number(quest.rewardXp) || 0), 0, 1_000_000);
    const xpResult = grantExperience(progress, rewardXp);
    progress.fishingQuestCompletions = clamp((progress.fishingQuestCompletions || 0) + 1, 0, 1_000_000);
    const questTitle = quest.title;
    nextFishingQuest(progress);
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    io.emit('chat', {
      fromName: 'System',
      text: `${actor.name} completed fishing quest "${questTitle}" for ${xpResult.gained} XP.`,
      sentAt: Date.now()
    });
    if (typeof ack === 'function') {
      ack({
        ok: true,
        rewardXp: xpResult.gained,
        level: xpResult.level,
        leveledUp: xpResult.leveledUp,
        quest: fishingQuestSnapshot(progress),
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('fish:sell', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    ensureFishingProgressShape(progress);
    const entries = Object.entries(progress.fishBag || {});
    if (!entries.length) {
      if (typeof ack === 'function') ack({ ok: false, error: 'No fish to sell.' });
      return;
    }
    let sold = 0;
    let coinsEarned = 0;
    for (const [fishId, count] of entries) {
      const qty = clamp(Math.floor(Number(count) || 0), 0, 1_000_000);
      if (qty <= 0) continue;
      sold += qty;
      coinsEarned += qty * fishSellPrice(fishId);
    }
    progress.fishBag = {};
    progress.inventory.fish = 0;
    progress.coins = clamp((progress.coins || 0) + coinsEarned, 0, 100_000_000);
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        sold,
        coinsEarned,
        fish: 0,
        coins: progress.coins,
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('fish:consume', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    ensureFishingProgressShape(progress);
    const fishOwned = clamp(Math.floor(Number(progress.inventory.fish) || 0), 0, 1_000_000);
    if (fishOwned <= 0) {
      if (typeof ack === 'function') ack({ ok: false, error: 'No fish to consume.' });
      return;
    }
    const currentBonus = clamp(Math.floor(Number(progress.maxStaminaBonusPct) || 0), 0, MAX_STAMINA_BONUS_PCT);
    const remainingBonus = Math.max(0, MAX_STAMINA_BONUS_PCT - currentBonus);
    if (remainingBonus <= 0) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Max stamina bonus already reached.' });
      return;
    }
    const rawAmount = Number(payload?.amount);
    const requested = Number.isFinite(rawAmount) ? Math.max(1, Math.floor(rawAmount)) : 1;
    const byFish = clamp(requested, 1, fishOwned);
    const byCap = clamp(Math.floor(remainingBonus / FISH_STAMINA_GAIN_PER_FISH), 0, byFish);
    const amount = Math.max(0, byCap);
    if (amount <= 0) {
      if (typeof ack === 'function') ack({ ok: false, error: 'No stamina gain available from fish.' });
      return;
    }
    const consumed = consumeFishBagForAmount(progress, amount);
    if (consumed <= 0) {
      if (typeof ack === 'function') ack({ ok: false, error: 'No fish available to consume.' });
      return;
    }
    progress.maxStaminaBonusPct = clamp(
      currentBonus + consumed * FISH_STAMINA_GAIN_PER_FISH,
      0,
      MAX_STAMINA_BONUS_PCT
    );
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        consumed,
        fish: progress.inventory.fish,
        maxStaminaBonusPct: progress.maxStaminaBonusPct,
        progress: progressSnapshot(progress)
      });
    }
  });

  socket.on('player:gear', (payload) => {
    const actor = players.get(socket.id);
    if (!actor || !payload || typeof payload !== 'object') return;
    const wantsTorch = payload.torchEquipped === true;
    const wantsFishing = payload.isFishing === true;
    const torchCount = Number(actor.progress?.inventory?.torch);
    const hasRod = actor?.progress?.hasFishingRod === true;
    actor.torchEquipped = wantsTorch && Number.isFinite(torchCount) && torchCount > 0;
    actor.isFishing = wantsFishing && hasRod;
    players.set(socket.id, actor);
    io.emit('playerGear', {
      id: socket.id,
      pickaxe: sanitizePickaxe(actor?.progress?.pickaxe, 'wood'),
      torchEquipped: actor.torchEquipped,
      hasFishingRod: actor?.progress?.hasFishingRod === true,
      fishingRodTier: sanitizeFishingRodTier(actor?.progress?.fishingRodTier, 'basic'),
      isFishing: actor.isFishing === true
    });
  });

  socket.on('interact', (payload) => {
    const actor = players.get(socket.id);
    if (!actor || !payload || payload.id !== 'beacon') return;

    const beacon = interactables.get('beacon');
    if (!beacon) return;

    const distance = Math.hypot(actor.x - beacon.x, actor.z - beacon.z);
    if (distance > INTERACT_RANGE) return;

    beacon.active = !beacon.active;
    beacon.lastBy = actor.name;
    interactables.set(beacon.id, beacon);

    io.emit('interactableUpdated', beacon);
    io.emit('chat', {
      fromName: 'System',
      text: beacon.active ? `${actor.name} activated the island beacon.` : `${actor.name} cooled the island beacon.`,
      sentAt: Date.now()
    });
  });

  socket.on('chat', (payload) => {
    const sender = players.get(socket.id);
    if (!sender || !payload) return;

    const rawText = typeof payload.text === 'string' ? payload.text : '';
    const text = filterChatText(rawText.trim().slice(0, CHAT_MAX_LEN));
    if (!text) return;

    io.emit('chat', {
      fromId: socket.id,
      fromTag: accountRoleTagForProfileId(sender.profileId),
      fromName: sender.name,
      text,
      sentAt: Date.now()
    });
  });

  socket.on('private:send', (payload, ack) => {
    const sender = players.get(socket.id);
    if (!sender || !payload) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated or invalid payload.' });
      return;
    }

    const rawText = typeof payload.text === 'string' ? payload.text : '';
    const text = filterChatText(rawText.trim().slice(0, CHAT_MAX_LEN));
    if (!text) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Message cannot be empty.' });
      return;
    }

    const requestedTargetId = typeof payload.toId === 'string' ? payload.toId.trim() : '';
    const target = players.get(requestedTargetId);
    if (!target) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Recipient is offline.' });
      return;
    }
    if (target.id === socket.id) {
      if (typeof ack === 'function') ack({ ok: false, error: 'You cannot message yourself.' });
      return;
    }

    const sentAt = Date.now();
    io.to(target.id).emit('private:message', {
      fromId: socket.id,
      fromTag: accountRoleTagForProfileId(sender.profileId),
      fromName: sender.name,
      toId: target.id,
      toTag: accountRoleTagForProfileId(target.profileId),
      toName: target.name,
      text,
      sentAt
    });

    if (typeof ack === 'function') ack({
      ok: true,
      toId: target.id,
      toTag: accountRoleTagForProfileId(target.profileId),
      toName: target.name,
      text,
      sentAt
    });
  });

  socket.on('customize', (payload, ack) => {
    const current = players.get(socket.id);
    if (!current || !payload) {
      if (typeof ack === 'function') ack({ ok: false });
      return;
    }

    const previousName = current.name;
    const nextName = sanitizeName(payload.name, current.name);
    if (findProfileIdByDisplayName(nextName, current.profileId)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Display username already exists.' });
      return;
    }
    if (findAccountByUsernameLikeName(nextName, current.profileId)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Display username cannot match another account username.' });
      return;
    }
    current.name = nextName;
    current.appearance = sanitizeAppearance(payload.appearance, {
      ...current.appearance,
      shirt: sanitizeColor(payload.color, current.color)
    });
    current.color = current.appearance.shirt;
    players.set(socket.id, current);
    persistPlayerProgress(current);

    io.emit('playerCustomized', {
      id: current.id,
      name: current.name,
      color: current.color,
      appearance: current.appearance
    });

    if (typeof ack === 'function') {
      ack({
        ok: true,
        name: current.name,
        color: current.color,
        appearance: current.appearance
      });
    }

    if (previousName !== current.name) {
      io.emit('chat', {
        fromName: 'System',
        text: `${previousName} is now ${current.name}.`,
        sentAt: Date.now()
      });
    }
  });

  socket.on('emote', (payload) => {
    const actor = players.get(socket.id);
    const type = payload?.type;
    if (!actor || !['wave', 'dance', 'cheer'].includes(type)) return;

    io.emit('playerEmote', {
      id: socket.id,
      type,
      sentAt: Date.now()
    });
  });

  socket.on('voice:join', () => {
    if (!players.has(socket.id)) return;
    if (voiceParticipants.has(socket.id)) {
      socket.emit('voice:participants', [...voiceParticipants].filter((id) => id !== socket.id));
      return;
    }
    voiceParticipants.add(socket.id);
    socket.emit('voice:participants', [...voiceParticipants].filter((id) => id !== socket.id));
    socket.broadcast.emit('voice:user-joined', socket.id);
  });

  socket.on('voice:leave', () => {
    const deleted = voiceParticipants.delete(socket.id);
    if (!deleted) return;
    socket.broadcast.emit('voice:user-left', socket.id);
  });

  socket.on('voice:offer', (payload) => {
    if (!voiceParticipants.has(socket.id)) return;
    const to = typeof payload?.to === 'string' ? payload.to : '';
    const offer = payload?.offer;
    if (!to || !offer || !voiceParticipants.has(to)) return;
    io.to(to).emit('voice:offer', { from: socket.id, offer });
  });

  socket.on('voice:answer', (payload) => {
    if (!voiceParticipants.has(socket.id)) return;
    const to = typeof payload?.to === 'string' ? payload.to : '';
    const answer = payload?.answer;
    if (!to || !answer || !voiceParticipants.has(to)) return;
    io.to(to).emit('voice:answer', { from: socket.id, answer });
  });

  socket.on('voice:ice', (payload) => {
    if (!voiceParticipants.has(socket.id)) return;
    const to = typeof payload?.to === 'string' ? payload.to : '';
    const candidate = payload?.candidate;
    if (!to || !candidate || !voiceParticipants.has(to)) return;
    io.to(to).emit('voice:ice', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    socket.data.fishChallenge = null;
    removeAuthenticatedPlayer(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

function handleShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  void (async () => {
    await flushPendingSaves();
    if (dbClient && typeof dbClient.close === 'function') {
      try {
        await dbClient.close();
      } catch {
        // Ignore close failures during shutdown.
      }
    }
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2500).unref();
  })();
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('beforeExit', () => {
  void flushPendingSaves();
});
