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
const MINE_ENTRY_ISLAND_POS = { x: -WORLD_LIMIT * 1.95, z: -WORLD_LIMIT * 1.2 };
const MINE_ENTRY_ISLAND_RADIUS = 11.4;
const FISHING_ISLAND_POS = { x: WORLD_LIMIT * 2.2, z: WORLD_LIMIT * 1.85 };
const FISHING_ISLAND_RADIUS = 11.9;
const MARKET_ISLAND_POS = { x: -WORLD_LIMIT * 2.35, z: WORLD_LIMIT * 1.2 };
const MARKET_ISLAND_RADIUS = 11.5;
const INTERACT_RANGE = 4;
const CHAT_MAX_LEN = 220;
const NAME_MAX_LEN = 18;
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
  stone: 120,
  iron: 280,
  diamond: 620
};
const FISHING_ROD_PRICE = 260;
const FISH_SELL_PRICE = 20;
const MAX_STAMINA_BONUS_PCT = 50;
const FISH_STAMINA_GAIN_PER_FISH = 1;
const FISH_CATCH_COOLDOWN_MS = 1800;

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  const mineDist = Math.hypot(x - MINE_POS.x, z - MINE_POS.z);
  const mineSwimBlocked = allowMine && mineDist <= MINE_SWIM_BLOCK_RADIUS;
  const onMain = Math.hypot(x, z) <= MAIN_RADIUS;
  const onLighthouse = Math.hypot(x - LIGHTHOUSE_POS.x, z - LIGHTHOUSE_POS.z) <= LIGHTHOUSE_RADIUS;
  const onMineEntryIsland = Math.hypot(x - MINE_ENTRY_ISLAND_POS.x, z - MINE_ENTRY_ISLAND_POS.z) <= MINE_ENTRY_RADIUS;
  const onFishingIsland = Math.hypot(x - FISHING_ISLAND_POS.x, z - FISHING_ISLAND_POS.z) <= FISHING_RADIUS;
  const onMarketIsland = Math.hypot(x - MARKET_ISLAND_POS.x, z - MARKET_ISLAND_POS.z) <= MARKET_RADIUS;
  const onInterior = Math.hypot(x - INTERIOR_POS.x, z - INTERIOR_POS.z) <= INTERIOR_RADIUS;
  const onMine = allowMine && mineDist <= MINE_PLAY_RADIUS;
  const radius = Math.hypot(x, z);
  const onSwimRing = radius >= SWIM_MIN_RADIUS && radius <= SWIM_MAX_RADIUS && !mineSwimBlocked;
  if (onMain || onLighthouse || onMineEntryIsland || onFishingIsland || onMarketIsland || onInterior || onMine || onSwimRing) {
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

  const dxI = x - INTERIOR_POS.x;
  const dzI = z - INTERIOR_POS.z;
  const lenI = Math.hypot(dxI, dzI) || 1;
  const toInterior = {
    x: INTERIOR_POS.x + (dxI / lenI) * INTERIOR_RADIUS,
    z: INTERIOR_POS.z + (dzI / lenI) * INTERIOR_RADIUS
  };
  const distInterior = Math.hypot(x - toInterior.x, z - toInterior.z);
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
    && distMain <= distInterior
    && distMain <= distSwim
    && distMain <= distMine
  ) return toMain;
  if (
    distLighthouse <= distMineEntry
    && distLighthouse <= distFishing
    && distLighthouse <= distMarket
    && distLighthouse <= distInterior
    && distLighthouse <= distSwim
    && distLighthouse <= distMine
  ) return toLighthouse;
  if (
    distMineEntry <= distFishing
    && distMineEntry <= distMarket
    && distMineEntry <= distInterior
    && distMineEntry <= distSwim
    && distMineEntry <= distMine
  ) return toMineEntry;
  if (distFishing <= distMarket && distFishing <= distInterior && distFishing <= distSwim && distFishing <= distMine) return toFishing;
  if (distMarket <= distInterior && distMarket <= distSwim && distMarket <= distMine) return toMarket;
  if (distInterior <= distSwim && distInterior <= distMine) return toInterior;
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

function defaultQuest(seed = 1) {
  const pool = [
    { resource: 'stone', min: 14, max: 28, rewardPerItem: 3, diamondBonusChance: 0.08 },
    { resource: 'iron', min: 8, max: 18, rewardPerItem: 7, diamondBonusChance: 0.12 },
    { resource: 'gold', min: 6, max: 14, rewardPerItem: 11, diamondBonusChance: 0.16 },
    { resource: 'diamond', min: 2, max: 7, rewardPerItem: 32, diamondBonusChance: 0.2 }
  ];
  const entry = pool[seed % pool.length];
  const span = entry.max - entry.min + 1;
  const targetCount = entry.min + ((seed * 7) % span);
  const rewardCoins = Math.round(targetCount * entry.rewardPerItem + 24 + Math.min(160, seed * 2.8));
  const rewardDiamonds = Math.random() < entry.diamondBonusChance ? 1 : 0;
  return {
    id: `q-${Date.now()}-${seed}`,
    type: 'mine',
    resource: entry.resource,
    targetCount,
    progress: 0,
    rewardCoins,
    rewardDiamonds,
    title: `Mine ${targetCount} ore`,
    description: `Collect ${targetCount} ore chunks in the mine.`,
    status: 'available'
  };
}

function defaultProgress() {
  return {
    coins: 0,
    pickaxe: 'wood',
    inventory: defaultInventory(),
    hasFishingRod: false,
    maxStaminaBonusPct: 0,
    questSeed: 1,
    quest: defaultQuest(1)
  };
}

function sanitizePickaxe(value, fallback = 'wood') {
  return PICKAXE_ORDER.includes(value) ? value : fallback;
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

function sanitizeQuest(value, fallbackSeed = 1) {
  const fallback = defaultQuest(fallbackSeed);
  if (!value || typeof value !== 'object') return fallback;
  const resource = ORE_TYPES.has(value.resource) ? value.resource : fallback.resource;
  const targetCount = clamp(Math.floor(Number(value.targetCount) || fallback.targetCount), 1, 2000);
  const progress = clamp(Math.floor(Number(value.progress) || 0), 0, targetCount);
  const rewardCoins = clamp(Math.floor(Number(value.rewardCoins) || fallback.rewardCoins), 5, 50_000);
  const rewardDiamonds = clamp(Math.floor(Number(value.rewardDiamonds) || 0), 0, 50);
  const status = ['available', 'active', 'ready'].includes(value.status) ? value.status : fallback.status;
  return {
    id: typeof value.id === 'string' && value.id ? value.id.slice(0, 80) : fallback.id,
    type: 'mine',
    resource,
    targetCount,
    progress,
    rewardCoins,
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
  const maxStaminaBonusPct = clamp(Math.floor(Number(value.maxStaminaBonusPct) || 0), 0, MAX_STAMINA_BONUS_PCT);
  return {
    coins: clamp(Math.floor(Number(value.coins) || 0), 0, 100_000_000),
    pickaxe: sanitizePickaxe(value.pickaxe, 'wood'),
    inventory: sanitizeInventory(value.inventory),
    hasFishingRod: value.hasFishingRod === true,
    maxStaminaBonusPct,
    questSeed,
    quest
  };
}

function nextQuest(progress) {
  progress.questSeed = clamp((progress.questSeed || 1) + 1, 1, 1_000_000);
  progress.quest = defaultQuest(progress.questSeed);
}

function progressSnapshot(progress) {
  return {
    coins: progress.coins,
    pickaxe: progress.pickaxe,
    inventory: { ...progress.inventory },
    hasFishingRod: progress.hasFishingRod === true,
    maxStaminaBonusPct: clamp(Math.floor(Number(progress.maxStaminaBonusPct) || 0), 0, MAX_STAMINA_BONUS_PCT),
    questSeed: progress.questSeed,
    quest: { ...progress.quest },
    shop: {
      order: [...PICKAXE_ORDER],
      price: { ...PICKAXE_PRICE }
    }
  };
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
  const spawnPoint = randomSpawn(WORLD_LIMIT * 0.65);
  const savedX = Number(profile?.x);
  const savedY = Number(profile?.y);
  const savedZ = Number(profile?.z);
  const hasSavedPosition = Number.isFinite(savedX) && Number.isFinite(savedY) && Number.isFinite(savedZ);
  const savedInMine = hasSavedPosition
    && Math.hypot(savedX - MINE_POS.x, savedZ - MINE_POS.z) <= MINE_PLAY_RADIUS;
  const boundedSaved = hasSavedPosition
    ? clampToPlayableGround(
      clamp(savedX, -PLAYABLE_BOUND, PLAYABLE_BOUND),
      clamp(savedZ, -PLAYABLE_BOUND, PLAYABLE_BOUND),
      savedInMine
    )
    : null;
  const spawn = {
    id: socket.id,
    profileId,
    name: profile?.name || username || `Player-${socket.id.slice(0, 4)}`,
    x: boundedSaved ? boundedSaved.x : spawnPoint.x,
    y: hasSavedPosition ? clamp(savedY, SWIM_MIN_Y, 30) : ISLAND_SURFACE_Y,
    z: boundedSaved ? boundedSaved.z : spawnPoint.z,
    inMine: Boolean(savedInMine),
    torchEquipped: false,
    appearance: sanitizeAppearance(profile?.appearance, {
      ...defaultAppearance(),
      shirt: profile?.color || randomHexColor()
    }),
    progress: sanitizeProgress(profile?.progress)
  };
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
  socket.data.lastFishCatchAt = 0;
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
    const next = clampToPlayableGround(boundedX, boundedZ, inMine);

    current.x = next.x;
    current.y = clamp(nextY, SWIM_MIN_Y, 30);
    current.z = next.z;
    players.set(socket.id, current);
    persistPlayerProgress(current);

    socket.broadcast.emit('playerMoved', {
      id: socket.id,
      x: current.x,
      y: current.y,
      z: current.z,
      name: current.name,
      color: current.color,
      appearance: current.appearance,
      pickaxe: sanitizePickaxe(current?.progress?.pickaxe, 'wood'),
      torchEquipped: current.torchEquipped === true
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
    progress.coins += quest.rewardCoins;
    if (quest.rewardDiamonds > 0) {
      progress.inventory.diamond += quest.rewardDiamonds;
    }
    const title = quest.title;
    const coins = quest.rewardCoins;
    const bonus = quest.rewardDiamonds;
    nextQuest(progress);
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    io.emit('chat', {
      fromName: 'System',
      text: `${actor.name} completed "${title}" for ${coins} coins${bonus ? ` and ${bonus} diamond` : ''}.`,
      sentAt: Date.now()
    });
    if (typeof ack === 'function') ack({ ok: true });
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
      torchEquipped: actor.torchEquipped === true
    });
    if (typeof ack === 'function') ack({ ok: true, tier: requested });
  });

  socket.on('shop:buyFishingRod', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    if (progress.hasFishingRod === true) {
      if (typeof ack === 'function') ack({ ok: false, error: 'You already own a fishing rod.' });
      return;
    }
    if (progress.coins < FISHING_ROD_PRICE) {
      if (typeof ack === 'function') ack({ ok: false, error: `Need ${FISHING_ROD_PRICE} coins.` });
      return;
    }
    progress.coins -= FISHING_ROD_PRICE;
    progress.hasFishingRod = true;
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') ack({ ok: true, hasFishingRod: true, progress: progressSnapshot(progress) });
  });

  socket.on('fish:catch', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    if (progress.hasFishingRod !== true) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Buy a fishing rod first.' });
      return;
    }
    const now = Date.now();
    const lastCatchAt = Number(socket.data.lastFishCatchAt) || 0;
    if (now - lastCatchAt < FISH_CATCH_COOLDOWN_MS) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Fish are not biting yet. Try again in a moment.' });
      return;
    }
    socket.data.lastFishCatchAt = now;
    progress.inventory.fish = clamp((progress.inventory.fish || 0) + 1, 0, 1_000_000);
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') ack({ ok: true, caught: 1, fish: progress.inventory.fish, progress: progressSnapshot(progress) });
  });

  socket.on('fish:sell', (payload, ack) => {
    const actor = players.get(socket.id);
    const progress = actor?.progress;
    if (!actor || !progress) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not authenticated.' });
      return;
    }
    const fishOwned = clamp(Math.floor(Number(progress.inventory.fish) || 0), 0, 1_000_000);
    if (fishOwned <= 0) {
      if (typeof ack === 'function') ack({ ok: false, error: 'No fish to sell.' });
      return;
    }
    const rawAmount = Number(payload?.amount);
    const wantsAll = !Number.isFinite(rawAmount) || rawAmount <= 0;
    const amount = wantsAll ? fishOwned : clamp(Math.floor(rawAmount), 1, fishOwned);
    const coinsEarned = amount * FISH_SELL_PRICE;
    progress.inventory.fish = fishOwned - amount;
    progress.coins = clamp((progress.coins || 0) + coinsEarned, 0, 100_000_000);
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        sold: amount,
        coinsEarned,
        fish: progress.inventory.fish,
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
    progress.inventory.fish = fishOwned - amount;
    progress.maxStaminaBonusPct = clamp(
      currentBonus + amount * FISH_STAMINA_GAIN_PER_FISH,
      0,
      MAX_STAMINA_BONUS_PCT
    );
    persistPlayerProgress(actor, { immediate: true });
    emitProgress(socket, actor);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        consumed: amount,
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
    const torchCount = Number(actor.progress?.inventory?.torch);
    actor.torchEquipped = wantsTorch && Number.isFinite(torchCount) && torchCount > 0;
    players.set(socket.id, actor);
    io.emit('playerGear', {
      id: socket.id,
      pickaxe: sanitizePickaxe(actor?.progress?.pickaxe, 'wood'),
      torchEquipped: actor.torchEquipped
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
      fromName: sender.name,
      toId: target.id,
      toName: target.name,
      text,
      sentAt
    });

    if (typeof ack === 'function') ack({
      ok: true,
      toId: target.id,
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
