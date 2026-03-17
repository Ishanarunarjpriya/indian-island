import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

const socket = io();
const players = new Map();
const interactables = new Map();
const keys = new Set();

let worldLimit = 40;
let localPlayerId = null;
let customizeTimer = null;
let furnitureTraderCountdownTimer = null;
let lastInteractAt = 0;
let lastEmoteAt = 0;
let pendingJump = false;
let emoteWheelOpen = false;
let menuOpen = false;
let debugMenuOpen = false;
let debugBannedAccounts = [];
let isAuthenticated = false;
let localRoomTransitioning = false;
const pendingLeaveMessages = new Map();
const pendingJoinMessages = new Map();
const CHAT_BUBBLE_MS = 4500;
let lastMineAt = 0;
const MINE_SWING_MS = 340;
const MINE_TIMING_HIT_COOLDOWN_MS = 120;
const MINE_TIMING_TIMEOUT_FALLBACK_MS = 5200;
const MINE_MISS_RETRY_COOLDOWN_MS = 700;
const MINE_TIMING_PROFILES = {
  stone: { speed: 0.9, zoneWidth: 0.3, timeoutMs: 5600 },
  iron: { speed: 1.16, zoneWidth: 0.23, timeoutMs: 5000 },
  gold: { speed: 1.42, zoneWidth: 0.17, timeoutMs: 4400 },
  diamond: { speed: 1.78, zoneWidth: 0.12, timeoutMs: 3800 }
};
const MINE_REQUIRED_HITS = {
  stone: 1,
  iron: 2,
  gold: 3,
  diamond: 4
};
const PICKAXE_ACCURACY_ZONE_MULTIPLIER = {
  wood: 1.0,
  stone: 1.14,
  iron: 1.3,
  diamond: 1.5
};
const MINE_FOCUS_CAMERA_BACK = 3.15;
const MINE_FOCUS_CAMERA_SIDE = 1.15;
const MINE_FOCUS_CAMERA_HEIGHT = 2.4;
const FISH_FOCUS_CAMERA_BACK = 2.95;
const FISH_FOCUS_CAMERA_SIDE = 0.92;
const FISH_FOCUS_CAMERA_HEIGHT = 2.15;
const STAMINA_BASE_MAX = 100;
const MAX_PLAYER_LEVEL = 60;
const BASE_XP_TO_LEVEL = 110;
const XP_PER_LEVEL_STEP = 35;
const HOME_ROOM_PAINT_PRICE = 90;
const HOME_ROOM_WALL_OPTIONS = {
  sand: { label: 'Sand', color: '#d9c4a3' },
  sky: { label: 'Sky', color: '#9ec4e8' },
  mint: { label: 'Mint', color: '#bde2c4' },
  slate: { label: 'Slate', color: '#9ca3af' },
  rose: { label: 'Rose', color: '#e9b6ba' }
};
const HOME_ROOM_FLOOR_OPTIONS = {
  oak: { label: 'Oak', color: '#7d5a3a' },
  walnut: { label: 'Walnut', color: '#5d3f2a' },
  slate: { label: 'Slate Stone', color: '#6b7280' },
  pine: { label: 'Pine', color: '#a67c52' }
};
const HOME_ROOM_FURNITURE_SHOP = {
  bed: { label: 'Bed', price: 520, occasionallyAvailable: false },
  table: { label: 'Desk', price: 320, occasionallyAvailable: false },
  lamp: { label: 'Reading Lamp', price: 220, occasionallyAvailable: true },
  plant: { label: 'Plant', price: 180, occasionallyAvailable: true },
  sofa: { label: 'Sofa', price: 900, occasionallyAvailable: false },
  'coffee-table': { label: 'Coffee Table', price: 260, occasionallyAvailable: false },
  bookshelf: { label: 'Bookshelf', price: 620, occasionallyAvailable: true },
  dresser: { label: 'Dresser', price: 520, occasionallyAvailable: true },
  rug: { label: 'Bedroom Rug', price: 240, occasionallyAvailable: false },
  wallart: { label: 'Wall Art', price: 200, occasionallyAvailable: true }
};
const HOME_ROOM_FURNITURE_ORDER = Object.keys(HOME_ROOM_FURNITURE_SHOP);

function defaultFurnitureTraderItemState(itemId) {
  const item = HOME_ROOM_FURNITURE_SHOP[itemId];
  return {
    itemId,
    label: item?.label || capitalizeWord(itemId),
    price: Math.max(0, Math.floor(Number(item?.price) || 0)),
    occasional: item?.occasionallyAvailable === true,
    availableThisCycle: item?.occasionallyAvailable !== true,
    stock: item?.occasionallyAvailable === true ? 0 : 1,
    purchased: 0,
    remaining: item?.occasionallyAvailable === true ? 0 : 1,
    soldOut: false,
    owned: false
  };
}

function defaultFurnitureTraderViewState() {
  return {
    cycleId: 0,
    cycleEndsAt: 0,
    cycleDurationMs: 0,
    purchaseLimit: 0,
    purchasesUsed: 0,
    purchasesRemaining: 0,
    items: HOME_ROOM_FURNITURE_ORDER.map((itemId) => defaultFurnitureTraderItemState(itemId))
  };
}

function normalizeFurnitureTraderState(value) {
  const base = defaultFurnitureTraderViewState();
  if (!value || typeof value !== 'object') return base;
  base.cycleId = Math.max(0, Math.floor(Number(value.cycleId) || 0));
  base.cycleEndsAt = Math.max(0, Math.floor(Number(value.cycleEndsAt) || 0));
  base.cycleDurationMs = Math.max(0, Math.floor(Number(value.cycleDurationMs) || 0));
  base.purchaseLimit = Math.max(0, Math.floor(Number(value.purchaseLimit) || 0));
  base.purchasesUsed = Math.max(0, Math.floor(Number(value.purchasesUsed) || 0));
  base.purchasesRemaining = Math.max(0, Math.floor(Number(value.purchasesRemaining) || 0));
  const byId = new Map(
    Array.isArray(value.items)
      ? value.items
        .map((entry) => {
          const itemId = typeof entry?.itemId === 'string' ? entry.itemId.trim().toLowerCase() : '';
          return HOME_ROOM_FURNITURE_ORDER.includes(itemId) ? [itemId, entry] : null;
        })
        .filter(Boolean)
      : []
  );
  base.items = HOME_ROOM_FURNITURE_ORDER.map((itemId) => {
    const fallback = defaultFurnitureTraderItemState(itemId);
    const entry = byId.get(itemId);
    if (!entry || typeof entry !== 'object') return fallback;
    const stock = Math.max(0, Math.floor(Number(entry.stock) || 0));
    const purchased = Math.max(0, Math.floor(Number(entry.purchased) || 0));
    const remaining = Math.max(0, Math.floor(Number(entry.remaining) || 0));
    return {
      itemId,
      label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : fallback.label,
      price: Math.max(0, Math.floor(Number(entry.price) || fallback.price)),
      occasional: entry.occasional === true || fallback.occasional,
      availableThisCycle: entry.availableThisCycle === true,
      stock,
      purchased,
      remaining,
      soldOut: entry.soldOut === true,
      owned: entry.owned === true
    };
  });
  return base;
}

function defaultHomeRoomState() {
  const ownedFurniture = {};
  const placedFurniture = {};
  for (const itemId of HOME_ROOM_FURNITURE_ORDER) {
    ownedFurniture[itemId] = false;
    placedFurniture[itemId] = false;
  }
  return {
    roomId: null,
    doorOpen: true,
    wallPaint: 'sand',
    floorPaint: 'oak',
    ownedFurniture,
    placedFurniture
  };
}

function normalizeHomeRoomState(value) {
  const base = defaultHomeRoomState();
  if (!value || typeof value !== 'object') return base;
  const roomIdRaw = typeof value.roomId === 'string' ? value.roomId.trim() : '';
  if (HOUSE_ROOM_IDS.includes(roomIdRaw)) {
    base.roomId = roomIdRaw;
  }
  if (typeof value.doorOpen === 'boolean') {
    base.doorOpen = value.doorOpen;
  }
  const wallPaintRaw = typeof value.wallPaint === 'string' ? value.wallPaint.trim().toLowerCase() : '';
  const floorPaintRaw = typeof value.floorPaint === 'string' ? value.floorPaint.trim().toLowerCase() : '';
  if (Object.prototype.hasOwnProperty.call(HOME_ROOM_WALL_OPTIONS, wallPaintRaw)) {
    base.wallPaint = wallPaintRaw;
  }
  if (Object.prototype.hasOwnProperty.call(HOME_ROOM_FLOOR_OPTIONS, floorPaintRaw)) {
    base.floorPaint = floorPaintRaw;
  }
  const owned = value.ownedFurniture && typeof value.ownedFurniture === 'object'
    ? value.ownedFurniture
    : {};
  const placed = value.placedFurniture && typeof value.placedFurniture === 'object'
    ? value.placedFurniture
    : {};
  for (const itemId of HOME_ROOM_FURNITURE_ORDER) {
    const isOwned = owned[itemId] === true;
    base.ownedFurniture[itemId] = isOwned;
    base.placedFurniture[itemId] = isOwned && placed[itemId] === true;
  }
  return base;
}
let torchEquipped = false;

const questState = {
  coins: 0,
  xp: 0,
  level: 1,
  xpIntoLevel: 0,
  xpToNextLevel: BASE_XP_TO_LEVEL,
  pickaxe: 'wood',
  inventory: { stone: 0, iron: 0, gold: 0, diamond: 0, torch: 1, fish: 0 },
  fishBag: {},
  fishIndex: {},
  hasFishingRod: false,
  fishingRodTier: 'basic',
  fishingQuest: null,
  fishingQuestCompletions: 0,
  maxStaminaBonusPct: 0,
  homeRoom: defaultHomeRoomState(),
  furnitureTrader: defaultFurnitureTraderViewState(),
  quest: null,
  shop: {
    order: ['wood', 'stone', 'iron', 'diamond'],
    price: { stone: 360, iron: 840, diamond: 1860 },
    levelReq: { wood: 1, stone: 2, iron: 5, diamond: 9 }
  }
};

const PICKAXE_TIERS = ['wood', 'stone', 'iron', 'diamond'];
const PICKAXE_LEVEL_REQUIREMENT = { wood: 1, stone: 2, iron: 5, diamond: 9 };
const PICKAXE_HEAD_COLORS = {
  wood: 0x8b5a2b,
  stone: 0x94a3b8,
  iron: 0xcbd5e1,
  diamond: 0x67e8f9
};
const FISHING_ROD_ACCENT_COLORS = {
  basic: 0x9ca3af,
  reinforced: 0x34d399,
  expert: 0x60a5fa,
  master: 0xa78bfa,
  mythic: 0xfacc15
};
const FISHING_ROD_LEVEL_REQUIREMENT = { basic: 1, reinforced: 4, expert: 7, master: 11, mythic: 15 };
const ORE_RESOURCE_COLORS = {
  stone: 0x9ca3af,
  iron: 0xb45309,
  gold: 0xf59e0b,
  diamond: 0x22d3ee
};

const GROUND_Y = 1.35;
const MINE_POS = new THREE.Vector3(140, 1.35, 140);
const MINE_RADIUS = 52;
const MINE_PLAY_RADIUS = MINE_RADIUS - 3;
const MINE_ROCK_WALL_RADIUS = MINE_RADIUS - 2.3;
const MINE_CEILING_Y = 19.8;
const MINE_CAMERA_MAX_DISTANCE = 16;
const MINE_SWIM_BLOCK_RADIUS = MINE_RADIUS + 34;
const HOUSE_POS = new THREE.Vector3(-worldLimit * 0.33, 1.35, worldLimit * 0.12);
const HOUSE_DOOR_POS = new THREE.Vector3(HOUSE_POS.x, 1.36, HOUSE_POS.z + 4.7);
const HOUSE_ROOM_BASE = new THREE.Vector3(-220, 0, -210);
const HOUSE_ROOM_PLAY_RADIUS = 10.8;
const HOUSE_ROOM_ENTRY_POS = new THREE.Vector3(HOUSE_ROOM_BASE.x, 1.36, HOUSE_ROOM_BASE.z + 6.8);
const HOUSE_ROOM_EXIT_POS = new THREE.Vector3(HOUSE_ROOM_BASE.x, 1.36, HOUSE_ROOM_BASE.z + 8.7);
const HOUSE_ROOM_WORKSHOP_POS = new THREE.Vector3(HOUSE_ROOM_BASE.x - 3.2, 1.36, HOUSE_ROOM_BASE.z - 6.2);
const HOUSE_HALL_BASE = new THREE.Vector3(HOUSE_ROOM_BASE.x + 60, 0, HOUSE_ROOM_BASE.z);
const HOUSE_HALL_PLAY_RADIUS = 14.5;
const HOUSE_HALL_ENTRY_POS = new THREE.Vector3(HOUSE_HALL_BASE.x, 1.36, HOUSE_HALL_BASE.z + 5.8);
const HOUSE_HALL_EXIT_POS = new THREE.Vector3(HOUSE_HALL_BASE.x, 1.36, HOUSE_HALL_BASE.z + 7.8);
const HOUSE_HALL_EXIT_INTERACT_RADIUS = 3.05;
const HOUSE_ROOM_SLOT_COUNT = 6;
const HOUSE_ROOM_IDS = Array.from({ length: HOUSE_ROOM_SLOT_COUNT }, (_, i) => `room-${i + 1}`);
const HOUSE_DOOR_INTERACT_RADIUS = 2.25;
const HOUSE_ROOM_EXIT_INTERACT_RADIUS = 3.05;
const HOUSE_ROOM_WORKSHOP_INTERACT_RADIUS = 3.25;
const MINE_ENTRY_ISLAND_POS = new THREE.Vector3(-worldLimit * 1.95, 0, -worldLimit * 1.2);
const MINE_ENTRY_ISLAND_RADIUS = 11.4;
const FISHING_ISLAND_POS = new THREE.Vector3(worldLimit * 2.2, 0, worldLimit * 1.85);
const FISHING_ISLAND_RADIUS = 8.6;
const MARKET_ISLAND_POS = new THREE.Vector3(-worldLimit * 2.35, 0, worldLimit * 1.2);
const MARKET_ISLAND_RADIUS = 8.3;
const FURNITURE_ISLAND_POS = new THREE.Vector3(worldLimit * 0.35, 0, worldLimit * 3.0);
const FURNITURE_ISLAND_RADIUS = 8.1;
const LEADERBOARD_ISLAND_POS = new THREE.Vector3(worldLimit * 2.8, 0, -worldLimit * 0.95);
const LEADERBOARD_ISLAND_RADIUS = 11.2;



// Shop interior positions
const FISHING_SHOP_BASE = new THREE.Vector3(-220, 0, 210);
const MARKET_SHOP_BASE = new THREE.Vector3(-220, 0, 260);
const FURNITURE_SHOP_BASE = new THREE.Vector3(-220, 0, 310);
const SHOP_INTERIOR_HALF_DEPTH = 8.0;
const SHOP_INTERIOR_HALF_WIDTH = 10.0;
const SHOP_INTERIOR_RADIUS = 11.5;
const SHOP_COUNTER_BACK_OFFSET = 4.2;
const SHOP_EXIT_OFFSET = SHOP_INTERIOR_HALF_DEPTH - 1.35;
const SHOP_EXIT_INTERACT_RADIUS = 3.0;
const FISHING_SHOP_COUNTER_POS = new THREE.Vector3(
  FISHING_SHOP_BASE.x,
  1.35,
  FISHING_SHOP_BASE.z - SHOP_INTERIOR_HALF_DEPTH + SHOP_COUNTER_BACK_OFFSET
);
const FISHING_SHOP_EXIT_POS = new THREE.Vector3(
  FISHING_SHOP_BASE.x,
  1.36,
  FISHING_SHOP_BASE.z + SHOP_EXIT_OFFSET
);
const MARKET_SHOP_COUNTER_POS = new THREE.Vector3(
  MARKET_SHOP_BASE.x,
  1.35,
  MARKET_SHOP_BASE.z - SHOP_INTERIOR_HALF_DEPTH + SHOP_COUNTER_BACK_OFFSET
);
const MARKET_SHOP_EXIT_POS = new THREE.Vector3(
  MARKET_SHOP_BASE.x,
  1.36,
  MARKET_SHOP_BASE.z + SHOP_EXIT_OFFSET
);
const FURNITURE_SHOP_COUNTER_POS = new THREE.Vector3(
  FURNITURE_SHOP_BASE.x,
  1.35,
  FURNITURE_SHOP_BASE.z - SHOP_INTERIOR_HALF_DEPTH + SHOP_COUNTER_BACK_OFFSET
);
const FURNITURE_SHOP_EXIT_POS = new THREE.Vector3(
  FURNITURE_SHOP_BASE.x,
  1.36,
  FURNITURE_SHOP_BASE.z + SHOP_EXIT_OFFSET
);
const toMainFromMineEntryX = -MINE_ENTRY_ISLAND_POS.x;
const toMainFromMineEntryZ = -MINE_ENTRY_ISLAND_POS.z;
const toMainFromMineEntryLen = Math.hypot(toMainFromMineEntryX, toMainFromMineEntryZ) || 1;
const MINE_ENTRY_DOCK_POS = new THREE.Vector3(
  MINE_ENTRY_ISLAND_POS.x + (toMainFromMineEntryX / toMainFromMineEntryLen) * 10.1,
  1.36,
  MINE_ENTRY_ISLAND_POS.z + (toMainFromMineEntryZ / toMainFromMineEntryLen) * 10.1
);
const MINE_ENTRY_DOCK_YAW = Math.atan2(-(MINE_ENTRY_DOCK_POS.z - MINE_ENTRY_ISLAND_POS.z), MINE_ENTRY_DOCK_POS.x - MINE_ENTRY_ISLAND_POS.x);
const toMainFromFishingX = -FISHING_ISLAND_POS.x;
const toMainFromFishingZ = -FISHING_ISLAND_POS.z;
const toMainFromFishingLen = Math.hypot(toMainFromFishingX, toMainFromFishingZ) || 1;
const FISHING_DOCK_POS = new THREE.Vector3(
  FISHING_ISLAND_POS.x + (toMainFromFishingX / toMainFromFishingLen) * (FISHING_ISLAND_RADIUS - 0.9),
  1.36,
  FISHING_ISLAND_POS.z + (toMainFromFishingZ / toMainFromFishingLen) * (FISHING_ISLAND_RADIUS - 0.9)
);
const FISHING_DOCK_YAW = Math.atan2(-(FISHING_DOCK_POS.z - FISHING_ISLAND_POS.z), FISHING_DOCK_POS.x - FISHING_ISLAND_POS.x);
const toMainFromMarketX = -MARKET_ISLAND_POS.x;
const toMainFromMarketZ = -MARKET_ISLAND_POS.z;
const toMainFromMarketLen = Math.hypot(toMainFromMarketX, toMainFromMarketZ) || 1;
const MARKET_DOCK_POS = new THREE.Vector3(
  MARKET_ISLAND_POS.x + (toMainFromMarketX / toMainFromMarketLen) * (MARKET_ISLAND_RADIUS - 0.9),
  1.36,
  MARKET_ISLAND_POS.z + (toMainFromMarketZ / toMainFromMarketLen) * (MARKET_ISLAND_RADIUS - 0.9)
);
const MARKET_DOCK_YAW = Math.atan2(-(MARKET_DOCK_POS.z - MARKET_ISLAND_POS.z), MARKET_DOCK_POS.x - MARKET_ISLAND_POS.x);
const toMainFromFurnitureX = -FURNITURE_ISLAND_POS.x;
const toMainFromFurnitureZ = -FURNITURE_ISLAND_POS.z;
const toMainFromFurnitureLen = Math.hypot(toMainFromFurnitureX, toMainFromFurnitureZ) || 1;
const FURNITURE_DOCK_POS = new THREE.Vector3(
  FURNITURE_ISLAND_POS.x + (toMainFromFurnitureX / toMainFromFurnitureLen) * (FURNITURE_ISLAND_RADIUS - 0.9),
  1.36,
  FURNITURE_ISLAND_POS.z + (toMainFromFurnitureZ / toMainFromFurnitureLen) * (FURNITURE_ISLAND_RADIUS - 0.9)
);
const FURNITURE_DOCK_YAW = Math.atan2(-(FURNITURE_DOCK_POS.z - FURNITURE_ISLAND_POS.z), FURNITURE_DOCK_POS.x - FURNITURE_ISLAND_POS.x);
const toMainFromLeaderboardX = -LEADERBOARD_ISLAND_POS.x;
const toMainFromLeaderboardZ = -LEADERBOARD_ISLAND_POS.z;
const toMainFromLeaderboardLen = Math.hypot(toMainFromLeaderboardX, toMainFromLeaderboardZ) || 1;
const LEADERBOARD_DOCK_POS = new THREE.Vector3(
  LEADERBOARD_ISLAND_POS.x + (toMainFromLeaderboardX / toMainFromLeaderboardLen) * 10.5,
  1.36,
  LEADERBOARD_ISLAND_POS.z + (toMainFromLeaderboardZ / toMainFromLeaderboardLen) * 10.5
);
const LEADERBOARD_DOCK_YAW = Math.atan2(
  -(LEADERBOARD_DOCK_POS.z - LEADERBOARD_ISLAND_POS.z),
  LEADERBOARD_DOCK_POS.x - LEADERBOARD_ISLAND_POS.x
);
const LEADERBOARD_BOARD_REFRESH_MS = 12_000;
const LEADERBOARD_BOARD_ROW_LIMIT = 8;
const MINE_ENTRY_POS = new THREE.Vector3(
  MINE_ENTRY_ISLAND_POS.x - (toMainFromMineEntryX / toMainFromMineEntryLen) * 2.4,
  1.35,
  MINE_ENTRY_ISLAND_POS.z - (toMainFromMineEntryZ / toMainFromMineEntryLen) * 2.4
);
const MINE_ENTRY_WARNING_PREF_KEY = 'island_skip_mine_warning';
const MINE_EXIT_POS = new THREE.Vector3(MINE_POS.x + 2.6, 1.35, MINE_POS.z + 23.2);
const MINE_CRYSTAL_INTERACT_RADIUS = 3.0;
const QUEST_NPC_POS = new THREE.Vector3(MINE_POS.x + 19.5, 1.35, MINE_POS.z + 8.1);
const MINE_SHOP_NPC_POS = new THREE.Vector3(MINE_POS.x - 18.2, 1.35, MINE_POS.z - 9.2);
const MINE_ORE_TRADER_POS = new THREE.Vector3(151.04, 1.35, 123.13);
const VENDOR_STAND_Y = 1.35;
const FISHING_VENDOR_POS = new THREE.Vector3(FISHING_ISLAND_POS.x, 1.35, FISHING_ISLAND_POS.z);
const MARKET_VENDOR_POS = new THREE.Vector3(MARKET_ISLAND_POS.x, 1.35, MARKET_ISLAND_POS.z);
const FURNITURE_VENDOR_POS = new THREE.Vector3(FURNITURE_ISLAND_POS.x, 1.35, FURNITURE_ISLAND_POS.z);
const FISHING_SPOT_RADIUS = 3.2;
const FISHING_ROD_PRICE = 780;
const ORE_SELL_PRICE = { stone: 2, iron: 8, gold: 22, diamond: 120 };
const FISH_SELL_BY_RARITY = {
  common: 18,
  uncommon: 32,
  rare: 56,
  epic: 120,
  legendary: 320,
  mythic: 1500
};
const FISH_CATCH_CARD_SHOW_MS = 2400;
const FISH_RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const FISH_RARITY_COLORS = {
  common: '#cbd5e1',
  uncommon: '#86efac',
  rare: '#93c5fd',
  epic: '#c084fc',
  legendary: '#fcd34d',
  mythic: '#f472b6'
};
const FISH_CATALOG = [
  { id: 'pond-minnow', name: 'Pond Minnow', rarity: 'common', chanceLabel: '1 in 5', color: '#7dc7ff', accent: '#d8f2ff' },
  { id: 'river-darter', name: 'River Darter', rarity: 'common', chanceLabel: '1 in 6', color: '#60a5fa', accent: '#bfdbfe' },
  { id: 'silver-gill', name: 'Silver Gill', rarity: 'common', chanceLabel: '1 in 7', color: '#94a3b8', accent: '#e2e8f0' },
  { id: 'mud-carp', name: 'Mud Carp', rarity: 'common', chanceLabel: '1 in 8', color: '#84cc16', accent: '#d9f99d' },
  { id: 'reed-snapper', name: 'Reed Snapper', rarity: 'common', chanceLabel: '1 in 10', color: '#22d3ee', accent: '#a5f3fc' },
  { id: 'striped-koi', name: 'Striped Koi', rarity: 'common', chanceLabel: '1 in 13', color: '#fb923c', accent: '#fed7aa' },
  { id: 'coral-perch', name: 'Coral Perch', rarity: 'uncommon', chanceLabel: '1 in 18', color: '#fb7185', accent: '#fecdd3' },
  { id: 'moon-tilapia', name: 'Moon Tilapia', rarity: 'uncommon', chanceLabel: '1 in 22', color: '#a78bfa', accent: '#ddd6fe' },
  { id: 'drift-trout', name: 'Drift Trout', rarity: 'uncommon', chanceLabel: '1 in 26', color: '#38bdf8', accent: '#bae6fd' },
  { id: 'amber-flounder', name: 'Amber Flounder', rarity: 'uncommon', chanceLabel: '1 in 31', color: '#f59e0b', accent: '#fde68a' },
  { id: 'glass-catfish', name: 'Glass Catfish', rarity: 'uncommon', chanceLabel: '1 in 37', color: '#67e8f9', accent: '#ecfeff' },
  { id: 'thunder-pike', name: 'Thunder Pike', rarity: 'rare', chanceLabel: '1 in 53', color: '#818cf8', accent: '#c7d2fe' },
  { id: 'lava-char', name: 'Lava Char', rarity: 'rare', chanceLabel: '1 in 74', color: '#f97316', accent: '#fdba74' },
  { id: 'ghost-bass', name: 'Ghost Bass', rarity: 'rare', chanceLabel: '1 in 102', color: '#d1d5db', accent: '#f8fafc' },
  { id: 'cobalt-ray', name: 'Cobalt Ray', rarity: 'rare', chanceLabel: '1 in 140', color: '#2563eb', accent: '#93c5fd' },
  { id: 'sunblade-mako', name: 'Sunblade Mako', rarity: 'epic', chanceLabel: '1 in 220', color: '#facc15', accent: '#fef08a' },
  { id: 'prism-swordfish', name: 'Prism Swordfish', rarity: 'epic', chanceLabel: '1 in 350', color: '#8b5cf6', accent: '#ddd6fe' },
  { id: 'deepfin-marlin', name: 'Deepfin Marlin', rarity: 'epic', chanceLabel: '1 in 560', color: '#0ea5e9', accent: '#bae6fd' },
  { id: 'void-whalelet', name: 'Void Whalelet', rarity: 'legendary', chanceLabel: '1 in 1650', color: '#6366f1', accent: '#c7d2fe' },
  { id: 'crown-leviathan', name: 'Crown Leviathan', rarity: 'mythic', chanceLabel: '1 in 6500', color: '#f43f5e', accent: '#fecdd3' }
];
const FISH_BY_ID = new Map(FISH_CATALOG.map((fish) => [fish.id, fish]));
const FISH_CATALOG_SORTED = [...FISH_CATALOG].sort((a, b) => {
  const rarityGap = FISH_RARITY_ORDER.indexOf(a.rarity) - FISH_RARITY_ORDER.indexOf(b.rarity);
  if (rarityGap !== 0) return rarityGap;
  return a.name.localeCompare(b.name);
});
const DEBUG_TAP_RESET_MS = 2500;
const WORLD_CYCLE_MS = 240000;
const WORLD_TIME_PRESETS = {
  day: 0.5,
  evening: 0.72,
  night: 0.9
};
const FISHING_ROD_TIERS = ['basic', 'reinforced', 'expert', 'master', 'mythic'];
const FISHING_ROD_TIER_LABEL = {
  basic: 'Basic Rod',
  reinforced: 'Reinforced Rod',
  expert: 'Expert Rod',
  master: 'Master Rod',
  mythic: 'Mythic Rod'
};
const SELLABLE_ORE_ORDER = ['stone', 'iron', 'gold', 'diamond'];
const MINE_ENTRY_YAW = Math.atan2(MINE_ENTRY_DOCK_POS.x - MINE_ENTRY_POS.x, MINE_ENTRY_DOCK_POS.z - MINE_ENTRY_POS.z);

let inMine = false;
let questNpcMesh = null;
let mineShopNpcMesh = null;
let mineEntranceMesh = null;
let mineExitMesh = null;
let mineCentralCrystalMesh = null;
let mineGroup = null;
let minePortalPulse = 0;
let mineOreTraderNpcMesh = null;
let houseRoomGroup = null;
let houseRoomExitMarker = null;
let houseRoomWorkshopMarker = null;
let inHouseRoom = false;
let inHouseHall = false;
let houseHallGroup = null;
let houseHallExitMarker = null;
let fishingShopExitMarker = null;
let marketShopExitMarker = null;
let furnitureShopExitMarker = null;
const houseHallRoomDoors = [];
let houseRoomWallMaterial = null;
let houseRoomFloorMaterial = null;
const houseRoomFurnitureMeshes = new Map();
let fishingShopGroup = null;
let marketShopGroup = null;
let furnitureShopGroup = null;
let inFishingShop = false;
let inMarketShop = false;
let inFurnitureShop = false;
let leaderboardBoardCanvas = null;
let leaderboardBoardCtx = null;
let leaderboardBoardTexture = null;
let leaderboardBoardRows = [];
let leaderboardBoardNeedsRedraw = false;
let leaderboardBoardFetchInFlight = false;
let leaderboardBoardLastFetchAt = 0;
const oreNodes = [];
const fishingSpots = [];
const fishingMiniGame = {
  active: false,
  starting: false,
  spotId: null,
  challengeId: null,
  targetFish: null,
  cursor: 0.5,
  isHolding: false,
  zonePointer: 0.2,
  zoneDirection: 1,
  zoneCenter: 0.5,
  zoneWidth: 0.22,
  zoneSpeed: 0.5,
  cursorRiseSpeed: 0.9,
  cursorFallSpeed: 0.8,
  decaySpeed: 0.35,
  requiredHoldMs: 1000,
  holdMs: 0,
  timeoutAt: 0,
  rarity: 'common'
};
let fishingMiniGameUiTimer = null;
let fishCatchCardTimer = null;
let mineRetryBlockedUntil = 0;
let lastMineRetryNoticeAt = 0;
const _fishSpotWorldPos = new THREE.Vector3();
const _fishFocusLook = new THREE.Vector3();
const _fishFocusCameraPos = new THREE.Vector3();
const miningAccuracyGame = {
  active: false,
  node: null,
  pointer: 0,
  direction: 1,
  zoneCenter: 0.5,
  zoneWidth: 0.2,
  speed: 1.0,
  timeoutAt: 0,
  hitCount: 0,
  requiredHits: 1
};
let miningAccuracyUiTimer = null;
const _mineNodeWorldPos = new THREE.Vector3();
const _mineCrystalWorldPos = new THREE.Vector3();
const _mineFocusLook = new THREE.Vector3();
const _mineFocusCameraPos = new THREE.Vector3();
const _mobileUseWorldPos = new THREE.Vector3();
const _mobileUseScreenPos = new THREE.Vector3();
const _nameTagWorldPos = new THREE.Vector3();
let npcDialogueOpen = false;
let npcDialoguePrimaryAction = null;
let npcDialogueSecondaryAction = null;
let mineWarningOpen = false;
let mineWarningContinueAction = null;

const statusEl = document.getElementById('status');
const playerCountEl = document.getElementById('player-count');
const interactHintEl = document.getElementById('interact-hint');
const timeLabelEl = document.getElementById('time-label');
const weatherLabelEl = document.getElementById('weather-label');
const compassEl = document.getElementById('compass');
const miniPanelEl = document.getElementById('mini-panel');
const minimapEl = document.getElementById('mini-map');
const minimapCtx = minimapEl.getContext('2d');
const minimapToggleEl = document.getElementById('minimap-toggle');
const minimapQuickToggleEl = document.getElementById('minimap-quick-toggle');
const fishIndexToggleEl = document.getElementById('fish-index-toggle');
const inventoryToggleEl = document.getElementById('inventory-toggle');
const performanceToggleEl = document.getElementById('performance-toggle');
const chatLogEl = document.getElementById('chat-log');
const chatFormEl = document.getElementById('chat-form');
const chatInputEl = document.getElementById('chat-input');
const chatPanelEl = document.getElementById('chat-panel');
const customizeFormEl = document.getElementById('customize-form');
const nameInputEl = document.getElementById('name-input');
const skinInputEl = document.getElementById('skin-input');
const hairStyleInputEl = document.getElementById('hair-style-input');
const hairColorInputEl = document.getElementById('hair-color-input');
const faceStyleInputEl = document.getElementById('face-style-input');
const colorInputEl = document.getElementById('color-input');
const pantsColorInputEl = document.getElementById('pants-color-input');
const shoesColorInputEl = document.getElementById('shoes-color-input');
const customizeStatusEl = document.getElementById('customize-status');
const customizeOpenEl = document.getElementById('customize-open');
const customizeCloseEl = document.getElementById('customize-close');
const customizeModalEl = document.getElementById('customize-modal');
const customizePreviewEl = document.getElementById('customize-preview');
const itemCards = Array.from(document.querySelectorAll('.item-card'));
const outfitSaveButtons = Array.from(document.querySelectorAll('[data-outfit-save]'));
const outfitLoadButtons = Array.from(document.querySelectorAll('[data-outfit-load]'));
const staminaFillEl = document.getElementById('stamina-fill');
const voiceToggleEl = document.getElementById('voice-toggle');
const settingsToggleEl = document.getElementById('settings-toggle');
const menuToggleEl = settingsToggleEl || document.getElementById('menu-toggle');
const chatToggleEl = document.getElementById('chat-toggle');
const voiceQuickToggleEl = document.getElementById('voice-quick-toggle');
const fullscreenToggleEl = document.getElementById('fullscreen-toggle');
const menuOverlayEl = document.getElementById('menu-overlay');
const menuTitleEl = document.getElementById('menu-title');
const debugOverlayEl = document.getElementById('debug-overlay');
const debugCloseEl = document.getElementById('debug-close');
const debugWeatherSelectEl = document.getElementById('debug-weather');
const debugTimeSelectEl = document.getElementById('debug-time');
const debugCycleSelectEl = document.getElementById('debug-cycle');
const debugWorldApplyEl = document.getElementById('debug-world-apply');
const debugPlayerSelectEl = document.getElementById('debug-player');
const debugItemTypeEl = document.getElementById('debug-item-type');
const debugItemSelectEl = document.getElementById('debug-item');
const debugAmountEl = document.getElementById('debug-amount');
const debugAddEl = document.getElementById('debug-add');
const debugRemoveEl = document.getElementById('debug-remove');
const debugProgressPlayerEl = document.getElementById('debug-progress-player');
const debugCoinsAmountEl = document.getElementById('debug-coins-amount');
const debugCoinsAddEl = document.getElementById('debug-coins-add');
const debugCoinsRemoveEl = document.getElementById('debug-coins-remove');
const debugXpAmountEl = document.getElementById('debug-xp-amount');
const debugXpAddEl = document.getElementById('debug-xp-add');
const debugXpRemoveEl = document.getElementById('debug-xp-remove');
const debugLevelValueEl = document.getElementById('debug-level-value');
const debugLevelSetEl = document.getElementById('debug-level-set');
const debugKickPlayerEl = document.getElementById('debug-kick-player');
const debugKickEl = document.getElementById('debug-kick');
const debugBanDurationEl = document.getElementById('debug-ban-duration');
const debugBanUnitEl = document.getElementById('debug-ban-unit');
const debugBanEl = document.getElementById('debug-ban');
const debugUnbanEl = document.getElementById('debug-unban');
const debugBannedPlayerEl = document.getElementById('debug-banned-player');
const debugBansRefreshEl = document.getElementById('debug-bans-refresh');
const debugBannedUnbanEl = document.getElementById('debug-banned-unban');
const debugStatusEl = document.getElementById('debug-status');
const saveQuitEl = document.getElementById('save-quit');
const authModalEl = document.getElementById('auth-modal');
const authUsernameEl = document.getElementById('auth-username');
const authPasswordEl = document.getElementById('auth-password');
const authLoginEl = document.getElementById('auth-login');
const authRegisterEl = document.getElementById('auth-register');
const authStatusEl = document.getElementById('auth-status');
const emoteWheelEl = document.getElementById('emote-wheel');
const wheelButtons = Array.from(document.querySelectorAll('[data-wheel-emote]'));
const nameTagsEl = document.getElementById('name-tags');
const inventoryBarEl = document.getElementById('inventory-bar');
const inventoryCoinsEl = document.getElementById('inventory-coins');
const inventoryLevelEl = document.getElementById('inventory-level');
const inventoryXpFillEl = document.getElementById('inventory-xp-fill');
const inventoryXpMetaEl = document.getElementById('inventory-xp-meta');
const inventoryPickaxeEl = document.getElementById('inventory-pickaxe');
const inventoryTorchEl = document.getElementById('inventory-torch');
const inventoryFishEl = document.getElementById('inventory-fish');
const inventoryTorchSlotEl = inventoryTorchEl?.closest('.inventory-slot') || null;
const miningMeterEl = document.getElementById('mining-meter');
const miningOrePreviewEl = document.getElementById('mining-ore-preview');
const miningPickaxeHeadEl = document.getElementById('mining-pickaxe-head');
const miningMeterZoneEl = document.getElementById('mining-meter-green-zone');
const miningMeterPointerEl = document.getElementById('mining-meter-pointer');
const miningMeterStatusEl = document.getElementById('mining-meter-status');
const miningMeterTierBonusEl = document.getElementById('mining-meter-tier-bonus');
const fishingMeterEl = document.getElementById('fishing-meter');
const fishingMeterPreviewIconEl = document.getElementById('fishing-preview-icon');
const fishingMeterPreviewNameEl = document.getElementById('fishing-preview-name');
const fishingMeterPreviewRarityEl = document.getElementById('fishing-preview-rarity');
const fishingMeterZoneEl = document.getElementById('fishing-meter-green-zone');
const fishingMeterPointerEl = document.getElementById('fishing-meter-pointer');
const fishingMeterStatusEl = document.getElementById('fishing-meter-status');
const fishCatchCardEl = document.getElementById('fish-catch-card');
const fishCatchRarityEl = document.getElementById('fish-catch-rarity');
const fishCatchIconEl = document.getElementById('fish-catch-icon');
const fishCatchNameEl = document.getElementById('fish-catch-name');
const fishCatchChanceEl = document.getElementById('fish-catch-chance');
const fishCatchCountEl = document.getElementById('fish-catch-count');
const fishIndexModalEl = document.getElementById('fish-index-modal');
const fishIndexCloseEl = document.getElementById('fish-index-close');
const fishIndexSummaryEl = document.getElementById('fish-index-summary');
const fishIndexListEl = document.getElementById('fish-index-list');
const inventoryModalEl = document.getElementById('inventory-modal');
const inventoryCloseEl = document.getElementById('inventory-close');
const inventoryTabOresEl = document.getElementById('inventory-tab-ores');
const inventoryTabFishEl = document.getElementById('inventory-tab-fish');
const inventoryListEl = document.getElementById('inventory-list');
const rodShopModalEl = document.getElementById('rod-shop-modal');
const rodShopCloseEl = document.getElementById('rod-shop-close');
const rodCurrentTierEl = document.getElementById('rod-current-tier');
const rodNextTierEl = document.getElementById('rod-next-tier');
const rodUpgradeCostEl = document.getElementById('rod-upgrade-cost');
const rodUpgradeFishCostEl = document.getElementById('rod-upgrade-fish-cost');
const rodBuyBtnEl = document.getElementById('rod-buy-btn');
const rodUpgradeBtnEl = document.getElementById('rod-upgrade-btn');
const rodShopStatusEl = document.getElementById('rod-shop-status');
const marketModalEl = document.getElementById('market-modal');
const marketCloseEl = document.getElementById('market-close');
const marketOpenIndexEl = document.getElementById('market-open-index');
const marketFishIndexSummaryEl = document.getElementById('market-fish-index-summary');
const marketSellItemEl = document.getElementById('market-sell-item');
const marketSellAmountEl = document.getElementById('market-sell-amount');
const marketSellPricePreviewEl = document.getElementById('market-sell-price-preview');
const marketSellBtnEl = document.getElementById('market-sell-btn');
const marketQuestTitleEl = document.getElementById('market-quest-title');
const marketQuestDescEl = document.getElementById('market-quest-desc');
const marketQuestProgressEl = document.getElementById('market-quest-progress');
const marketQuestFishItemEl = document.getElementById('market-quest-fish-item');
const marketQuestFishAmountEl = document.getElementById('market-quest-fish-amount');
const marketQuestAcceptBtnEl = document.getElementById('market-quest-accept-btn');
const marketQuestTurnInBtnEl = document.getElementById('market-quest-turnin-btn');
const marketQuestClaimBtnEl = document.getElementById('market-quest-claim-btn');
const marketStatusEl = document.getElementById('market-status');
const oreModalEl = document.getElementById('ore-modal');
const oreCloseEl = document.getElementById('ore-close');
const oreSellItemEl = document.getElementById('ore-sell-item');
const oreSellAmountEl = document.getElementById('ore-sell-amount');
const oreSellPricePreviewEl = document.getElementById('ore-sell-price-preview');
const oreSellBtnEl = document.getElementById('ore-sell-btn');
const oreStatusEl = document.getElementById('ore-status');
const furnitureTraderModalEl = document.getElementById('furniture-trader-modal');
const furnitureTraderCloseEl = document.getElementById('furniture-trader-close');
const furnitureTraderSummaryEl = document.getElementById('furniture-trader-summary');
const furnitureTraderListEl = document.getElementById('furniture-trader-list');
const furnitureTraderStatusEl = document.getElementById('furniture-trader-status');
const homeModalEl = document.getElementById('home-modal');
const homeCloseEl = document.getElementById('home-close');
const homeWallSelectEl = document.getElementById('home-wall-select');
const homeFloorSelectEl = document.getElementById('home-floor-select');
const homeWallApplyEl = document.getElementById('home-wall-apply');
const homeFloorApplyEl = document.getElementById('home-floor-apply');
const homeFurnitureListEl = document.getElementById('home-furniture-list');
const homeDoorToggleEl = document.getElementById('home-door-toggle');
const homeDoorNoteEl = document.getElementById('home-door-note');
const homeUnclaimEl = document.getElementById('home-unclaim-btn');
const homeStatusEl = document.getElementById('home-status');
const gameplayPanels = [
  'hud', 'mini-panel', 'chat-panel', 'world-state', 'top-left-toolbar',
  'inventory-bar', 'mining-meter', 'fishing-meter', 'fish-catch-card',
  'fish-index-modal', 'inventory-modal', 'market-modal', 'rod-shop-modal', 'ore-modal', 'furniture-trader-modal', 'home-modal',
  'debug-overlay'
]
  .map((id) => document.getElementById(id))
  .filter(Boolean);

const questTrackerEl = document.createElement('section');
questTrackerEl.id = 'quest-tracker';
questTrackerEl.className = 'panel';
questTrackerEl.style.display = 'none';
questTrackerEl.innerHTML = `
  <div id="quest-title" style="font-weight:700;font-size:12px;letter-spacing:.2px;color:#fde68a;">Current Quest</div>
  <div id="quest-progress" style="font-size:11px;color:#f8fafc;">Progress: 0/0</div>
  <div id="quest-status-msg" style="min-height:14px;font-size:11px;color:#cbd5e1;"></div>
`;
document.getElementById('hud')?.appendChild(questTrackerEl);
const questTitleEl = document.getElementById('quest-title');
const questProgressEl = document.getElementById('quest-progress');
const questStatusMsgEl = document.getElementById('quest-status-msg');

const npcDialogueEl = document.createElement('div');
npcDialogueEl.className = 'panel';
npcDialogueEl.style.position = 'fixed';
npcDialogueEl.style.left = '50%';
npcDialogueEl.style.bottom = '24px';
npcDialogueEl.style.transform = 'translateX(-50%)';
npcDialogueEl.style.width = 'min(620px, calc(100vw - 24px))';
npcDialogueEl.style.padding = '12px';
npcDialogueEl.style.display = 'none';
npcDialogueEl.style.zIndex = '70';
npcDialogueEl.innerHTML = `
  <div id="npc-dialogue-name" style="font-size:12px;font-weight:700;color:#fde68a;margin-bottom:6px;">NPC</div>
  <div id="npc-dialogue-text" style="font-size:13px;line-height:1.4;color:#f8fafc;min-height:36px;">...</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
    <button id="npc-dialogue-primary" type="button" style="height:34px;font-size:13px;">Talk</button>
    <button id="npc-dialogue-secondary" type="button" style="height:34px;font-size:13px;">Close</button>
  </div>
`;
document.body.appendChild(npcDialogueEl);
const npcDialogueNameEl = document.getElementById('npc-dialogue-name');
const npcDialogueTextEl = document.getElementById('npc-dialogue-text');
const npcDialoguePrimaryEl = document.getElementById('npc-dialogue-primary');
const npcDialogueSecondaryEl = document.getElementById('npc-dialogue-secondary');

const mineWarningEl = document.createElement('div');
mineWarningEl.className = 'panel';
mineWarningEl.style.position = 'fixed';
mineWarningEl.style.left = '50%';
mineWarningEl.style.top = '50%';
mineWarningEl.style.transform = 'translate(-50%, -50%)';
mineWarningEl.style.width = 'min(560px, calc(100vw - 24px))';
mineWarningEl.style.padding = '14px';
mineWarningEl.style.display = 'none';
mineWarningEl.style.zIndex = '74';
mineWarningEl.innerHTML = `
  <div style="font-size:14px;font-weight:700;color:#fde68a;margin-bottom:6px;">Mine Performance Warning</div>
  <div style="font-size:13px;line-height:1.45;color:#f8fafc;">
    When entering the mines, players on slower hardware may experience lag.
    If needed, turn down graphics settings in the menu before continuing.
  </div>
  <label style="display:flex;align-items:center;gap:8px;margin-top:10px;color:#cbd5e1;font-size:12px;">
    <input id="mine-warning-no-ask" type="checkbox" />
    Do not ask again
  </label>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
    <button id="mine-warning-continue" type="button" style="height:34px;font-size:13px;">OK, continue</button>
    <button id="mine-warning-cancel" type="button" style="height:34px;font-size:13px;">Cancel</button>
  </div>
`;
document.body.appendChild(mineWarningEl);
const mineWarningContinueEl = document.getElementById('mine-warning-continue');
const mineWarningCancelEl = document.getElementById('mine-warning-cancel');
const mineWarningNoAskEl = document.getElementById('mine-warning-no-ask');

const cachedAuthUsername = localStorage.getItem('island_auth_username') || '';
const cachedAuthPassword = localStorage.getItem('island_auth_password') || '';
let skipMineEntryWarning = localStorage.getItem(MINE_ENTRY_WARNING_PREF_KEY) === '1';
if (authUsernameEl) authUsernameEl.value = cachedAuthUsername;
if (authPasswordEl) authPasswordEl.value = cachedAuthPassword;

function persistAuth(username, password) {
  localStorage.setItem('island_auth_username', username);
  localStorage.setItem('island_auth_password', password);
  if (authUsernameEl) authUsernameEl.value = username;
  if (authPasswordEl) authPasswordEl.value = password;
}

const cachedName = localStorage.getItem('island_profile_name');
const cachedShirt = localStorage.getItem('island_profile_color');
const cachedSkin = localStorage.getItem('island_profile_skin');
const cachedHairStyle = localStorage.getItem('island_profile_hair_style');
const cachedHairColor = localStorage.getItem('island_profile_hair_color');
const cachedFaceStyle = localStorage.getItem('island_profile_face_style');
const cachedPants = localStorage.getItem('island_profile_pants_color');
const cachedShoes = localStorage.getItem('island_profile_shoes_color');
const cachedAccessories = localStorage.getItem('island_profile_accessories');
if (cachedName) nameInputEl.value = cachedName;
if (/^#[0-9a-fA-F]{6}$/.test(cachedShirt || '')) colorInputEl.value = cachedShirt;
if (/^#[0-9a-fA-F]{6}$/.test(cachedSkin || '')) skinInputEl.value = cachedSkin;
if (['none', 'short', 'sidepart', 'spiky', 'long', 'ponytail', 'bob', 'wavy'].includes(cachedHairStyle || '')) hairStyleInputEl.value = cachedHairStyle;
if (/^#[0-9a-fA-F]{6}$/.test(cachedHairColor || '')) hairColorInputEl.value = cachedHairColor;
if (['smile', 'serious', 'grin', 'wink', 'lashessmile', 'soft'].includes(cachedFaceStyle || '')) faceStyleInputEl.value = cachedFaceStyle;
if (/^#[0-9a-fA-F]{6}$/.test(cachedPants || '')) pantsColorInputEl.value = cachedPants;
if (/^#[0-9a-fA-F]{6}$/.test(cachedShoes || '')) shoesColorInputEl.value = cachedShoes;

const selectedAccessories = new Set(
  (cachedAccessories || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => ['hat', 'glasses', 'backpack'].includes(item))
);

function setGameplayVisible(visible) {
  gameplayPanels.forEach((panel) => {
    panel.style.display = visible ? '' : 'none';
  });
}

let voiceEnabled = false;
let voiceMuted = false;
const cachedChatOpen = localStorage.getItem('island_chat_open');
let chatPanelOpen = cachedChatOpen === null ? true : cachedChatOpen === '1';
let pointerLocked = false;
let minimapExpanded = false;
let minimapEnabled = localStorage.getItem('island_minimap_enabled') !== '0';
let debugTapCount = 0;
let debugTapResetAt = 0;
let worldStateLocked = false;
let worldState = { weather: 'clear', timeOfDay: 'day', cycleTime: false, cycleStart: 0, cycleOffset: WORLD_TIME_PRESETS.day };
let fishIndexOpen = false;
let inventoryModalOpen = false;
let marketModalOpen = false;
let rodShopModalOpen = false;
let oreModalOpen = false;
let furnitureTraderModalOpen = false;
let homeModalOpen = false;
let inventoryViewTab = 'ores';
let rodShopSnapshot = null;
const GRAPHICS_PRESETS = ['quality', 'balanced', 'performance'];
const legacyLowPerformanceMode = localStorage.getItem('island_low_performance_mode') === '1';
const storedGraphicsPreset = localStorage.getItem('island_graphics_preset');
let graphicsPreset = GRAPHICS_PRESETS.includes(storedGraphicsPreset || '')
  ? storedGraphicsPreset
  : (legacyLowPerformanceMode ? 'performance' : 'quality');
let lowPerformanceMode = graphicsPreset === 'performance';

const QUALITY_RENDER_PIXEL_RATIO_CAP = 2;
const BALANCED_RENDER_PIXEL_RATIO_CAP = 1.25;
const PERFORMANCE_RENDER_PIXEL_RATIO_CAP = 0.8;
const QUALITY_PREVIEW_PIXEL_RATIO_CAP = 2;
const BALANCED_PREVIEW_PIXEL_RATIO_CAP = 1.1;
const PERFORMANCE_PREVIEW_PIXEL_RATIO_CAP = 0.75;
const QUALITY_VOICE_UPDATE_INTERVAL_MS = 0;
const BALANCED_VOICE_UPDATE_INTERVAL_MS = 120;
const PERFORMANCE_VOICE_UPDATE_INTERVAL_MS = 180;
const QUALITY_WATERFALL_UPDATE_INTERVAL_MS = 0;
const BALANCED_WATERFALL_UPDATE_INTERVAL_MS = 33;
const PERFORMANCE_WATERFALL_UPDATE_INTERVAL_MS = 80;
const QUALITY_MINIMAP_DRAW_INTERVAL_MS = 100;
const BALANCED_MINIMAP_DRAW_INTERVAL_MS = 120;
const PERFORMANCE_MINIMAP_DRAW_INTERVAL_MS = 320;
const QUALITY_SHADOW_MAP_SIZE = 1024;
const BALANCED_SHADOW_MAP_SIZE = 512;
const PERFORMANCE_SHADOW_MAP_SIZE = 256;
const QUALITY_NAME_TAG_UPDATE_INTERVAL_MS = 50;
const BALANCED_NAME_TAG_UPDATE_INTERVAL_MS = 80;
const PERFORMANCE_NAME_TAG_UPDATE_INTERVAL_MS = 140;
const QUALITY_REMOTE_PLAYER_UPDATE_INTERVAL_MS = 0;
const BALANCED_REMOTE_PLAYER_UPDATE_INTERVAL_MS = 24;
const PERFORMANCE_REMOTE_PLAYER_UPDATE_INTERVAL_MS = 45;
const QUALITY_CAMERA_FAR = 300;
const BALANCED_CAMERA_FAR = 240;
const PERFORMANCE_CAMERA_FAR = 180;

let renderPixelRatioCap = QUALITY_RENDER_PIXEL_RATIO_CAP;
let previewPixelRatioCap = QUALITY_PREVIEW_PIXEL_RATIO_CAP;
let voiceUpdateIntervalMs = QUALITY_VOICE_UPDATE_INTERVAL_MS;
let waterfallUpdateIntervalMs = QUALITY_WATERFALL_UPDATE_INTERVAL_MS;
let minimapDrawIntervalMs = QUALITY_MINIMAP_DRAW_INTERVAL_MS;
let shadowMapSize = QUALITY_SHADOW_MAP_SIZE;
let nameTagUpdateIntervalMs = QUALITY_NAME_TAG_UPDATE_INTERVAL_MS;
let remotePlayerUpdateIntervalMs = QUALITY_REMOTE_PLAYER_UPDATE_INTERVAL_MS;
let cameraFarDistance = QUALITY_CAMERA_FAR;

let previewScene = null;
let previewCamera = null;
let previewRenderer = null;
let previewAvatar = null;
let previewLight = null;
let previewYaw = 0;
let previewPitch = -0.08;
let previewDistance = 6.4;
let previewAutoSpin = true;
let previewDragging = false;
let previewPointerId = null;
let previewLastX = 0;
let previewLastY = 0;
let previewRenderWidth = 0;
let previewRenderHeight = 0;

function setMinimapCanvasSize(expanded) {
  const size = lowPerformanceMode
    ? (expanded ? 236 : 144)
    : (expanded ? 296 : 176);
  if (minimapEl.width === size && minimapEl.height === size) return;
  minimapEl.width = size;
  minimapEl.height = size;
}

function updateMinimapToggleLabel() {
  if (!minimapToggleEl) return;
  minimapToggleEl.textContent = minimapEnabled ? 'Minimap: On' : 'Minimap: Off';
}

function updateMinimapQuickToggleState() {
  if (!minimapQuickToggleEl) return;
  minimapQuickToggleEl.style.filter = minimapEnabled ? 'none' : 'grayscale(0.95) brightness(0.75)';
  minimapQuickToggleEl.title = minimapEnabled ? 'Hide minimap' : 'Show minimap';
}

function updateFishIndexToggleState() {
  if (!fishIndexToggleEl) return;
  fishIndexToggleEl.style.filter = fishIndexOpen ? 'none' : 'grayscale(0.1) brightness(0.92)';
  fishIndexToggleEl.title = fishIndexOpen ? 'Close fish index' : 'Open fish index';
}

function closeCommerceModals() {
  inventoryModalOpen = false;
  marketModalOpen = false;
  rodShopModalOpen = false;
  oreModalOpen = false;
  furnitureTraderModalOpen = false;
  homeModalOpen = false;
  inventoryModalEl?.classList.add('hidden');
  marketModalEl?.classList.add('hidden');
  rodShopModalEl?.classList.add('hidden');
  oreModalEl?.classList.add('hidden');
  furnitureTraderModalEl?.classList.add('hidden');
  homeModalEl?.classList.add('hidden');
}

function isAnyGameplayOverlayOpen() {
  return fishIndexOpen
    || inventoryModalOpen
    || marketModalOpen
    || rodShopModalOpen
    || oreModalOpen
    || furnitureTraderModalOpen
    || homeModalOpen
    || debugMenuOpen;
}

function setFishIndexOpen(open) {
  if (!isAuthenticated && open) return;
  fishIndexOpen = Boolean(open);
  fishIndexModalEl?.classList.toggle('hidden', !fishIndexOpen);
  if (fishIndexOpen) {
    closeCommerceModals();
    closeNpcDialogue();
    setMenuOpen(false);
    renderFishIndex();
  }
  updateFishIndexToggleState();
}

function setInventoryModalOpen(open) {
  if (!isAuthenticated && open) return;
  if (!open) {
    inventoryModalOpen = false;
    inventoryModalEl?.classList.add('hidden');
    return;
  }
  setMenuOpen(false);
  setFishIndexOpen(false);
  closeNpcDialogue();
  closeCommerceModals();
  inventoryModalOpen = true;
  inventoryModalEl?.classList.remove('hidden');
  renderInventoryModal();
}

function setRodShopModalOpen(open) {
  if (!isAuthenticated && open) return;
  if (!open) {
    rodShopModalOpen = false;
    rodShopModalEl?.classList.add('hidden');
    return;
  }
  setMenuOpen(false);
  setFishIndexOpen(false);
  closeNpcDialogue();
  closeCommerceModals();
  rodShopModalOpen = true;
  rodShopModalEl?.classList.remove('hidden');
  renderRodShopModal();
}

function setMarketModalOpen(open) {
  if (!isAuthenticated && open) return;
  if (!open) {
    marketModalOpen = false;
    marketModalEl?.classList.add('hidden');
    return;
  }
  setMenuOpen(false);
  setFishIndexOpen(false);
  closeNpcDialogue();
  closeCommerceModals();
  marketModalOpen = true;
  marketModalEl?.classList.remove('hidden');
  renderMarketModal();
}

function setOreModalOpen(open) {
  if (!isAuthenticated && open) return;
  if (!open) {
    oreModalOpen = false;
    oreModalEl?.classList.add('hidden');
    return;
  }
  setMenuOpen(false);
  setFishIndexOpen(false);
  closeNpcDialogue();
  closeCommerceModals();
  oreModalOpen = true;
  oreModalEl?.classList.remove('hidden');
  renderOreModal();
}

function setFurnitureTraderModalOpen(open) {
  if (!isAuthenticated && open) return;
  if (!open) {
    furnitureTraderModalOpen = false;
    furnitureTraderModalEl?.classList.add('hidden');
    stopFurnitureTraderCountdown();
    return;
  }
  setMenuOpen(false);
  setFishIndexOpen(false);
  closeNpcDialogue();
  closeCommerceModals();
  furnitureTraderModalOpen = true;
  furnitureTraderModalEl?.classList.remove('hidden');
  setFurnitureTraderStatus('');
  renderFurnitureTraderModal();
  startFurnitureTraderCountdown();
}

function setHomeModalOpen(open) {
  if (!isAuthenticated && open) return;
  if (!open) {
    homeModalOpen = false;
    homeModalEl?.classList.add('hidden');
    return;
  }
  setMenuOpen(false);
  setFishIndexOpen(false);
  closeNpcDialogue();
  closeCommerceModals();
  homeModalOpen = true;
  homeModalEl?.classList.remove('hidden');
  setHomeStatus('');
  renderHomeModal();
}

function updatePerformanceToggleLabel() {
  if (!performanceToggleEl) return;
  if (graphicsPreset === 'performance') {
    performanceToggleEl.textContent = 'Graphics: Performance';
    return;
  }
  if (graphicsPreset === 'balanced') {
    performanceToggleEl.textContent = 'Graphics: Balanced';
    return;
  }
  performanceToggleEl.textContent = 'Graphics: Quality';
}

function setMinimapExpanded(expanded) {
  if (!minimapEnabled) expanded = false;
  if (isMobileLayout()) expanded = false;
  minimapExpanded = Boolean(expanded);
  miniPanelEl?.classList.toggle('expanded', minimapExpanded);
  setMinimapCanvasSize(minimapExpanded);
}

function setMinimapEnabled(enabled) {
  minimapEnabled = Boolean(enabled);
  localStorage.setItem('island_minimap_enabled', minimapEnabled ? '1' : '0');
  if (!minimapEnabled) minimapExpanded = false;
  miniPanelEl?.classList.toggle('hidden', !minimapEnabled);
  miniPanelEl?.classList.toggle('expanded', minimapEnabled && minimapExpanded);
  setMinimapCanvasSize(minimapEnabled && minimapExpanded);
  updateMinimapToggleLabel();
  updateMinimapQuickToggleState();
}

function setChatPanelOpen(open) {
  chatPanelOpen = Boolean(open);
  localStorage.setItem('island_chat_open', chatPanelOpen ? '1' : '0');
  chatPanelEl?.classList.toggle('hidden', !chatPanelOpen);
  if (chatToggleEl) {
    chatToggleEl.style.filter = chatPanelOpen ? 'none' : 'grayscale(0.95) brightness(0.75)';
    chatToggleEl.title = chatPanelOpen ? 'Hide chat' : 'Open chat';
  }
}

const _mobileLayoutQuery = window.matchMedia('(max-width: 900px), (max-height: 700px), (pointer: coarse)');

function isMobileLayout() {
  return _mobileLayoutQuery.matches;
}

function applyResponsiveLayout() {
  const mobile = isMobileLayout();
  document.body.classList.toggle('mobile-ui', mobile);
  if (cachedChatOpen === null) {
    setChatPanelOpen(!mobile);
  }
}

function updateVoiceButtonLabels() {
  if (voiceQuickToggleEl) {
    if (!voiceEnabled) {
      voiceQuickToggleEl.textContent = '🎙️';
      voiceQuickToggleEl.title = 'Enable voice chat';
      voiceQuickToggleEl.style.filter = 'grayscale(0.95) brightness(0.75)';
    } else if (voiceMuted) {
      voiceQuickToggleEl.textContent = '🔇';
      voiceQuickToggleEl.title = 'Unmute microphone';
      voiceQuickToggleEl.style.filter = 'none';
    } else {
      voiceQuickToggleEl.textContent = '🎙️';
      voiceQuickToggleEl.title = 'Mute microphone';
      voiceQuickToggleEl.style.filter = 'none';
    }
  }
  if (voiceToggleEl) {
    if (!voiceEnabled) {
      voiceToggleEl.textContent = 'Enable Voice Chat';
    } else if (voiceMuted) {
      voiceToggleEl.textContent = 'Unmute Mic (Voice On)';
    } else {
      voiceToggleEl.textContent = 'Mute Mic (Voice On)';
    }
  }
}

async function setVoiceMuted(muted) {
  voiceMuted = Boolean(muted);
  if (voiceMuted) {
    if (localVoiceStream) {
      localVoiceStream.getTracks().forEach((track) => track.stop());
      localVoiceStream = null;
    }
    voicePeers.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'audio' || sender.track === null) {
          sender.replaceTrack(null).catch(() => {});
        }
      });
    });
    updateVoiceButtonLabels();
    return;
  }

  if (!voiceEnabled) {
    updateVoiceButtonLabels();
    return;
  }

  if (!localVoiceStream) {
    try {
      localVoiceStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch {
      voiceMuted = true;
      if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        if (voiceToggleEl) voiceToggleEl.textContent = 'Voice needs HTTPS';
      } else if (voiceToggleEl) {
        voiceToggleEl.textContent = 'Mic blocked';
      }
      updateVoiceButtonLabels();
      return;
    }
  }

  const track = localVoiceStream.getAudioTracks()[0];
  if (track) {
    voicePeers.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'audio' || sender.track === null) {
          sender.replaceTrack(track).catch(() => {});
        }
      });
    });
  }
  updateVoiceButtonLabels();
}

function clearSessionWorld() {
  localPlayerId = null;
  players.forEach((_, id) => removePlayer(id));
  interactables.clear();
  boatState.onboard = false;
  inMine = false;
  inLighthouseInterior = false;
  inHouseRoom = false;
  inHouseHall = false;
  if (lighthouseInteriorGroup) lighthouseInteriorGroup.visible = false;
  if (houseRoomGroup) houseRoomGroup.visible = false;
  if (houseHallGroup) houseHallGroup.visible = false;
  torchEquipped = false;
  inventoryViewTab = 'ores';
  rodShopSnapshot = null;
  resetMiningAccuracyGame();
  resetFishingMiniGame();
  hideFishCatchCard();
  setFishIndexOpen(false);
  closeCommerceModals();
  closeMineWarningDialog();
  closeNpcDialogue();
  setFurnitureTraderStatus('');
  setHomeStatus('');
  refreshConsumeActionVisibility(null);
}

function setAuthModalOpen(open, statusText = '') {
  if (!authModalEl) return;
  authModalEl.classList.toggle('hidden', !open);
  if (authStatusEl) authStatusEl.textContent = statusText;
  isAuthenticated = !open;
  setGameplayVisible(!open);
  if (open) {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    keys.clear();
    pendingJump = false;
    emoteWheelOpen = false;
    emoteWheelEl?.classList.add('hidden');
    setCustomizeModal(false);
    setFishIndexOpen(false);
    closeCommerceModals();
    menuOpen = false;
    menuOverlayEl?.classList.add('hidden');
    debugMenuOpen = false;
    debugOverlayEl?.classList.add('hidden');
    resetMiningAccuracyGame();
    resetFishingMiniGame();
    hideFishCatchCard();
  }
}

function setMenuOpen(open) {
  if (!isAuthenticated) return;
  menuOpen = open;
  if (open) {
    keys.clear();
    pendingJump = false;
    emoteWheelOpen = false;
    emoteWheelEl?.classList.add('hidden');
    setCustomizeModal(false);
    setFishIndexOpen(false);
    closeCommerceModals();
    resetMiningAccuracyGame();
    resetFishingMiniGame();
  }
  menuOverlayEl?.classList.toggle('hidden', !open);
}

function isCreatorAccount() {
  const tag = normalizeAccountTag(players.get(localPlayerId)?.accountTag);
  return typeof tag === 'string' && tag.toLowerCase() === 'creator';
}

function setDebugMenuOpen(open) {
  debugMenuOpen = Boolean(open);
  debugOverlayEl?.classList.toggle('hidden', !debugMenuOpen);
  if (debugMenuOpen) {
    setMenuOpen(false);
    setFishIndexOpen(false);
    closeCommerceModals();
    closeNpcDialogue();
    refreshDebugPlayerLists();
    requestDebugBannedAccounts({ silent: true });
    refreshDebugItemOptions();
    refreshDebugWorldControls();
  }
}

function refreshDebugWorldControls() {
  if (debugWeatherSelectEl) debugWeatherSelectEl.value = worldState.weather;
  if (debugTimeSelectEl) debugTimeSelectEl.value = worldState.timeOfDay;
  if (debugCycleSelectEl) debugCycleSelectEl.value = worldState.cycleTime ? 'cycle' : 'fixed';
}

function refreshDebugPlayerLists() {
  if (!debugPlayerSelectEl && !debugKickPlayerEl && !debugProgressPlayerEl) return;
  const options = [...players.entries()]
    .map(([id, player]) => {
      const baseLabel = displayNameWithTag(player.name || `Player-${String(id).slice(0, 4)}`, player.accountTag);
      const accountUsername = player.accountUsername
        || (typeof player.profileId === 'string' && player.profileId.toLowerCase().startsWith('acct-')
          ? player.profileId.slice(5)
          : '');
      const label = accountUsername ? `${baseLabel} (@${accountUsername})` : baseLabel;
      return { id, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const fillSelect = (selectEl) => {
    if (!selectEl) return;
    const previous = selectEl.value;
    selectEl.innerHTML = '';
    options.forEach((entry) => {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.label;
      selectEl.appendChild(option);
    });
    if (previous && options.some((entry) => entry.id === previous)) {
      selectEl.value = previous;
    }
  };
  fillSelect(debugPlayerSelectEl);
  fillSelect(debugProgressPlayerEl);
  fillSelect(debugKickPlayerEl);
}

function renderDebugBannedAccounts() {
  if (!debugBannedPlayerEl) return;
  const previous = String(debugBannedPlayerEl.value || '').trim();
  debugBannedPlayerEl.innerHTML = '';
  if (!debugBannedAccounts.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No active bans';
    option.disabled = true;
    option.selected = true;
    debugBannedPlayerEl.appendChild(option);
    debugBannedPlayerEl.disabled = true;
    return;
  }
  debugBannedPlayerEl.disabled = false;
  debugBannedAccounts.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry.profileId || `acct-${entry.username}`;
    const untilLabel = Number.isFinite(Number(entry.bannedUntil))
      ? new Date(Number(entry.bannedUntil)).toLocaleString()
      : 'unknown';
    option.textContent = `@${entry.username} - until ${untilLabel}`;
    debugBannedPlayerEl.appendChild(option);
  });
  if ([...debugBannedPlayerEl.options].some((option) => option.value === previous)) {
    debugBannedPlayerEl.value = previous;
  }
}

function requestDebugBannedAccounts({ silent = false } = {}) {
  if (!isCreatorAccount() || !socket.connected) return;
  socket.emit('debug:listBans', {}, (resp) => {
    if (!resp?.ok) {
      if (!silent) {
        setDebugStatus(resp?.error || 'Could not load banned accounts.', true);
      }
      return;
    }
    debugBannedAccounts = Array.isArray(resp.accounts)
      ? resp.accounts.map((entry) => ({
        username: String(entry?.username || '').trim().toLowerCase(),
        profileId: String(entry?.profileId || '').trim().toLowerCase(),
        bannedUntil: Math.floor(Number(entry?.bannedUntil) || 0)
      })).filter((entry) => entry.username && entry.bannedUntil > 0)
      : [];
    renderDebugBannedAccounts();
    if (!silent) {
      const count = debugBannedAccounts.length;
      setDebugStatus(count ? `Loaded ${count} banned account${count === 1 ? '' : 's'}.` : 'No active bans.');
    }
  });
}

function refreshDebugItemOptions() {
  if (!debugItemTypeEl || !debugItemSelectEl) return;
  const type = debugItemTypeEl.value === 'fish' ? 'fish' : 'inventory';
  debugItemSelectEl.innerHTML = '';
  if (type === 'fish') {
    FISH_CATALOG_SORTED.forEach((fish) => {
      const option = document.createElement('option');
      option.value = fish.id;
      option.textContent = `${fish.name} (${capitalizeWord(fish.rarity)})`;
      debugItemSelectEl.appendChild(option);
    });
  } else {
    const items = [
      { id: 'stone', label: 'Stone' },
      { id: 'iron', label: 'Iron' },
      { id: 'gold', label: 'Gold' },
      { id: 'diamond', label: 'Diamond' },
      { id: 'torch', label: 'Torch' }
    ];
    items.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      debugItemSelectEl.appendChild(option);
    });
  }
}

function applyWorldState(nextState = {}) {
  const weather = nextState?.weather === 'rain' ? 'rain' : 'clear';
  const timeOfDay = WORLD_TIME_PRESETS[nextState?.timeOfDay] != null ? nextState.timeOfDay : 'day';
  const cycleTime = nextState?.cycleTime === true;
  const cycleStart = Number(nextState?.cycleStart || 0);
  const cycleOffset = Number.isFinite(Number(nextState?.cycleOffset))
    ? Number(nextState.cycleOffset)
    : WORLD_TIME_PRESETS[timeOfDay] ?? WORLD_TIME_PRESETS.day;
  worldState = { weather, timeOfDay, cycleTime, cycleStart, cycleOffset };
  worldStateLocked = true;
  rainActive = weather === 'rain';
  dayTime = WORLD_TIME_PRESETS[timeOfDay] ?? dayTime;
  refreshDebugWorldControls();
}

function setDebugStatus(message = '', isError = false) {
  if (!debugStatusEl) return;
  debugStatusEl.textContent = message;
  debugStatusEl.style.color = isError ? '#fca5a5' : '#86efac';
}

function sendDebugWorldUpdate() {
  const weather = debugWeatherSelectEl?.value === 'rain' ? 'rain' : 'clear';
  const timeOfDay = ['day', 'evening', 'night'].includes(debugTimeSelectEl?.value)
    ? debugTimeSelectEl.value
    : 'day';
  const cycleTime = debugCycleSelectEl?.value === 'cycle';
  socket.emit('debug:world', { weather, timeOfDay, cycleTime }, (resp) => {
    if (!resp?.ok) {
      setDebugStatus(resp?.error || 'World update failed.', true);
      return;
    }
    if (resp?.worldState) applyWorldState(resp.worldState);
    setDebugStatus('World updated.');
  });
}

function sendDebugInventoryUpdate(deltaSign = 1) {
  const targetId = String(debugPlayerSelectEl?.value || '').trim();
  if (!targetId) {
    setDebugStatus('Select a player.', true);
    return;
  }
  const amount = Math.max(1, Math.floor(Number(debugAmountEl?.value) || 0));
  if (!amount) {
    setDebugStatus('Enter an amount.', true);
    return;
  }
  const itemType = debugItemTypeEl?.value === 'fish' ? 'fish' : 'inventory';
  const itemId = String(debugItemSelectEl?.value || '').trim();
  if (!itemId) {
    setDebugStatus('Select an item.', true);
    return;
  }
  const delta = deltaSign > 0 ? amount : -amount;
  socket.emit('debug:inventory', { targetId, itemType, itemId, delta }, (resp) => {
    if (!resp?.ok) {
      setDebugStatus(resp?.error || 'Inventory update failed.', true);
      return;
    }
    setDebugStatus('Inventory updated.');
  });
}

function sendDebugKick() {
  const targetId = String(debugKickPlayerEl?.value || '').trim();
  if (!targetId) {
    setDebugStatus('Select a player to kick.', true);
    return;
  }
  const target = players.get(targetId);
  const targetUsername = target?.accountUsername || '';
  const targetProfileId = target?.profileId || '';
  socket.emit('debug:kick', { targetId, targetUsername, targetProfileId }, (resp) => {
    if (!resp?.ok) {
      setDebugStatus(resp?.error || 'Kick failed.', true);
      return;
    }
    setDebugStatus('Player kicked.');
  });
}

function sendDebugBan(action) {
  const targetId = String(debugKickPlayerEl?.value || '').trim();
  if (!targetId) {
    setDebugStatus(action === 'unban' ? 'Select a player to unban.' : 'Select a player to ban.', true);
    return;
  }
  const target = players.get(targetId);
  const targetUsername = target?.accountUsername || '';
  const targetProfileId = target?.profileId || '';
  let durationMs = 0;
  if (action !== 'unban') {
    const amount = Math.max(1, Math.floor(Number(debugBanDurationEl?.value) || 0));
    if (!amount) {
      setDebugStatus('Enter a ban duration.', true);
      return;
    }
    const unit = String(debugBanUnitEl?.value || 'minutes');
    let multiplier = 60_000;
    if (unit === 'hours') multiplier = 60 * 60_000;
    if (unit === 'days') multiplier = 24 * 60 * 60_000;
    durationMs = amount * multiplier;
  }
  socket.emit('debug:ban', {
    targetId,
    targetUsername,
    targetProfileId,
    action,
    durationMs
  }, (resp) => {
    if (!resp?.ok) {
      setDebugStatus(resp?.error || 'Ban failed.', true);
      return;
    }
    setDebugStatus(resp?.message || (action === 'unban' ? 'Account unbanned.' : 'Account banned.'));
    requestDebugBannedAccounts({ silent: true });
  });
}

function sendDebugBannedUnban() {
  const selectedKey = String(debugBannedPlayerEl?.value || '').trim();
  if (!selectedKey) {
    setDebugStatus('Select a banned account to unban.', true);
    return;
  }
  const target = debugBannedAccounts.find((entry) => (entry.profileId || `acct-${entry.username}`) === selectedKey);
  if (!target) {
    setDebugStatus('Selected banned account is no longer available.', true);
    requestDebugBannedAccounts({ silent: true });
    return;
  }
  socket.emit('debug:ban', {
    targetUsername: target.username,
    targetProfileId: target.profileId,
    action: 'unban',
    durationMs: 0
  }, (resp) => {
    if (!resp?.ok) {
      setDebugStatus(resp?.error || 'Unban failed.', true);
      return;
    }
    setDebugStatus(resp?.message || `@${target.username} unbanned.`);
    requestDebugBannedAccounts({ silent: true });
  });
}

function sendDebugProgressUpdate(kind, action) {
  const targetId = String(debugProgressPlayerEl?.value || '').trim();
  if (!targetId) {
    setDebugStatus('Select a player.', true);
    return;
  }
  let amount = 0;
  if (kind === 'coins') {
    amount = Math.max(1, Math.floor(Number(debugCoinsAmountEl?.value) || 0));
  } else if (kind === 'xp') {
    amount = Math.max(1, Math.floor(Number(debugXpAmountEl?.value) || 0));
  } else if (kind === 'level') {
    amount = Math.max(1, Math.floor(Number(debugLevelValueEl?.value) || 0));
  }
  if (!amount) {
    setDebugStatus('Enter an amount.', true);
    return;
  }
  socket.emit('debug:progress', { targetId, kind, action, amount }, (resp) => {
    if (!resp?.ok) {
      setDebugStatus(resp?.error || 'Progress update failed.', true);
      return;
    }
    setDebugStatus('Progress updated.');
  });
}

setAuthModalOpen(true, 'Login or create an account to continue.');
setChatPanelOpen(chatPanelOpen);
updateVoiceButtonLabels();
setMinimapEnabled(minimapEnabled);
updateFishIndexToggleState();
updatePerformanceToggleLabel();
applyResponsiveLayout();

const joystickEl = document.getElementById('joystick');
const joystickStickEl = document.getElementById('joystick-stick');
const mobileJumpEl = document.getElementById('btn-jump');
const mobileUseEl = document.getElementById('btn-use');
const mobileUseCaptionEl = mobileUseEl?.querySelector('.mobile-use-caption') ?? null;
const mobileUseLabelEl = mobileUseEl?.querySelector('.mobile-use-label') ?? null;
const mobileConsumeEl = document.getElementById('btn-consume');

let localVoiceStream = null;
const voicePeers = new Map();
const voiceAudioEls = new Map();
const voicePeerStreams = new Map();
const pendingVoiceIce = new Map();
const DEFAULT_VOICE_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];
let voiceIceServers = [...DEFAULT_VOICE_ICE_SERVERS];
let voiceConfigLoadPromise = null;
const MAX_PENDING_VOICE_ICE = 64;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb7d7e6, 45, 160);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 11, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, renderPixelRatioCap));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = graphicsPreset !== 'performance';
document.body.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = 'none';

function getFullscreenElement() {
  return document.fullscreenElement
    || document.webkitFullscreenElement
    || document.mozFullScreenElement
    || document.msFullscreenElement
    || null;
}

function requestFullscreenFor(elem) {
  if (!elem) return null;
  const request =
    elem.requestFullscreen
    || elem.webkitRequestFullscreen
    || elem.webkitRequestFullScreen
    || elem.mozRequestFullScreen
    || elem.msRequestFullscreen;
  return request ? request.call(elem) : null;
}

function exitFullscreenForDocument() {
  const exit =
    document.exitFullscreen
    || document.webkitExitFullscreen
    || document.mozCancelFullScreen
    || document.msExitFullscreen;
  return exit ? exit.call(document) : null;
}

function updateFullscreenButtonLabel() {
  if (!fullscreenToggleEl) return;
  const active = Boolean(getFullscreenElement());
  fullscreenToggleEl.textContent = active ? '🡼' : '⛶';
  fullscreenToggleEl.title = active ? 'Exit fullscreen' : 'Enter fullscreen';
}

async function requestPointerLockForGameplay() {
  if (!isAuthenticated || isMobileLayout() || document.pointerLockElement === renderer.domElement) return;
  try {
    const result = renderer.domElement.requestPointerLock?.();
    if (result?.catch) await result;
  } catch {}
}

async function toggleFullscreenPointerLock() {
  if (!isAuthenticated) return;
  if (!getFullscreenElement()) {
    try {
      const target = isMobileLayout() ? document.documentElement : renderer.domElement;
      const fsResult = requestFullscreenFor(target) || requestFullscreenFor(document.documentElement);
      if (fsResult?.catch) await fsResult;
    } catch {
      return;
    }
    updateFullscreenButtonLabel();
    await requestPointerLockForGameplay();
    return;
  }
  if (!isMobileLayout() && document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock?.();
  }
  try {
    const exitResult = exitFullscreenForDocument();
    if (exitResult?.catch) await exitResult;
  } catch {}
  updateFullscreenButtonLabel();
}

document.addEventListener('fullscreenchange', async () => {
  updateFullscreenButtonLabel();
  if (getFullscreenElement() && isAuthenticated) {
    await requestPointerLockForGameplay();
  } else if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock?.();
  }
});

document.addEventListener('webkitfullscreenchange', async () => {
  updateFullscreenButtonLabel();
  if (getFullscreenElement() && isAuthenticated) {
    await requestPointerLockForGameplay();
  } else if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock?.();
  }
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});

updateFullscreenButtonLabel();

const hemi = new THREE.HemisphereLight(0xd6f1ff, 0x4d3a27, 1.1);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.12);
sun.position.set(14, 32, 22);
sun.castShadow = graphicsPreset !== 'performance';
sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
scene.add(sun);

const TORCH_LIGHT_INTENSITY_SURFACE = 1.45;
const TORCH_LIGHT_INTENSITY_MINE = 2.25;
const TORCH_LIGHT_DISTANCE_SURFACE = 14;
const TORCH_LIGHT_DISTANCE_MINE = 22;
const torchLight = new THREE.PointLight(0xffcc7a, 0, TORCH_LIGHT_DISTANCE_SURFACE, 1.25);
torchLight.visible = false;
scene.add(torchLight);

const beaconIslandLights = [];
const ISLAND_LAMP_BASE_INTENSITY = 0;
const ISLAND_LAMP_ACTIVE_INTENSITY = 9.2;
const ISLAND_LAMP_RANGE = 38;
const ISLAND_LAMP_DECAY = 1.45;

function addBeaconIslandLights() {
  const count = 10;
  const ringRadius = worldLimit * 0.86;
  const poleScale = 1.28;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x433222, roughness: 0.88, metalness: 0.02 });
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + 0.18;
    const x = Math.cos(angle) * ringRadius;
    const z = Math.sin(angle) * ringRadius;

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1 * poleScale, 0.1 * poleScale, 2.35 * poleScale, 8),
      postMat
    );
    post.position.set(x, 2.35 * poleScale, z);
    post.castShadow = true;
    post.receiveShadow = true;
    scene.add(post);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffdf8f,
      emissive: 0x2a220f,
      emissiveIntensity: 0,
      roughness: 0.45
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18 * poleScale, 12, 10), bulbMat);
    bulb.position.set(x, 3.62 * poleScale, z);
    scene.add(bulb);

    const light = new THREE.PointLight(0xffd27a, ISLAND_LAMP_BASE_INTENSITY, ISLAND_LAMP_RANGE, ISLAND_LAMP_DECAY);
    light.position.set(x, 3.62 * poleScale, z);
    scene.add(light);

    beaconIslandLights.push({ light, bulb });
  }
}

function updateBeaconIslandLights(active, delta) {
  const targetIntensity = active ? ISLAND_LAMP_ACTIVE_INTENSITY : ISLAND_LAMP_BASE_INTENSITY;
  const blend = Math.min(1, delta * 4.6);
  for (const entry of beaconIslandLights) {
    entry.light.intensity = THREE.MathUtils.lerp(entry.light.intensity, targetIntensity, blend);
    const glow = entry.light.intensity / ISLAND_LAMP_ACTIVE_INTENSITY;
    entry.bulb.material.emissiveIntensity = glow * 3.8;
  }
}

const water = new THREE.Mesh(
  new THREE.CircleGeometry(170, 80),
  new THREE.MeshStandardMaterial({
    color: 0x2c7ea1,
    roughness: 0.2,
    metalness: 0.05
  })
);
water.rotation.x = -Math.PI / 2;
water.position.y = 0.38;
scene.add(water);

function mainIslandRadiusAtAngle(angle) {
  const profile = 0.86
    + Math.sin(angle * 2 + 0.6) * 0.11
    + Math.sin(angle * 5 - 0.9) * 0.06
    + Math.cos(angle * 1 + 2.1) * 0.04;
  return THREE.MathUtils.clamp(worldLimit * profile, worldLimit * 0.66, worldLimit * 1.08);
}

function radialShape(radiusOffset = 0, segments = 144) {
  const shape = new THREE.Shape();
  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    const radius = Math.max(2.2, mainIslandRadiusAtAngle(t) + radiusOffset);
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    if (i === 0) {
      shape.moveTo(x, z);
    } else {
      shape.lineTo(x, z);
    }
  }
  shape.closePath();
  return shape;
}

function addMainIslandTerrain() {
  // Original island scale restored. Only vertical alignment changed to remove the seam.
  const cliff = new THREE.Mesh(
    new THREE.CylinderGeometry(worldLimit + 4, worldLimit + 7, 4.9, 72, 1),
    new THREE.MeshStandardMaterial({ color: 0xc6b188, roughness: 0.96, metalness: 0.01 })
  );
  cliff.position.y = -1.15; // top at ~1.3, matching shoreline layers
  cliff.receiveShadow = true;
  scene.add(cliff);

  const shoreGeo = new THREE.ShapeGeometry(radialShape(2.6), 132);
  shoreGeo.rotateX(-Math.PI / 2);
  const shore = new THREE.Mesh(
    shoreGeo,
    new THREE.MeshStandardMaterial({ color: 0xbb9c6b, roughness: 0.98, metalness: 0.01 })
  );
  shore.position.y = 1.31;
  shore.receiveShadow = true;
  scene.add(shore);

  const sandGeo = new THREE.ShapeGeometry(radialShape(0.85), 132);
  sandGeo.rotateX(-Math.PI / 2);
  const sand = new THREE.Mesh(
    sandGeo,
    new THREE.MeshStandardMaterial({ color: 0xcdb180, roughness: 0.97, metalness: 0.01 })
  );
  sand.position.y = 1.34;
  sand.receiveShadow = true;
  scene.add(sand);

  const grassGeo = new THREE.ShapeGeometry(radialShape(-1.65), 132);
  grassGeo.rotateX(-Math.PI / 2);
  const grass = new THREE.Mesh(
    grassGeo,
    new THREE.MeshStandardMaterial({ color: 0x79a85d, roughness: 0.92, metalness: 0.02 })
  );
  grass.position.y = 1.36;
  grass.receiveShadow = true;
  scene.add(grass);
}

addMainIslandTerrain();

const PLAYER_COLLISION_RADIUS = 0.46;
const worldColliders = [];
let cliffWaterfallRoot = null;
let cliffWaterfallFoam = null;
let cliffWaterfallState = null;
const waterfallWorldPos = new THREE.Vector3();
const waterfallToCamera = new THREE.Vector3();
const waterfallForward = new THREE.Vector3();
const waterfallWorldQuat = new THREE.Quaternion();

function createWaterfallFlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const baseGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  baseGradient.addColorStop(0, 'rgba(163, 230, 255, 0.9)');
  baseGradient.addColorStop(0.26, 'rgba(104, 206, 247, 0.86)');
  baseGradient.addColorStop(0.66, 'rgba(58, 166, 220, 0.82)');
  baseGradient.addColorStop(1, 'rgba(34, 120, 178, 0.78)');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 64; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const length = 54 + Math.random() * 168;
    const width = 1.1 + Math.random() * 2.8;
    const alpha = 0.12 + Math.random() * 0.28;
    ctx.strokeStyle = `rgba(235,248,255,${alpha.toFixed(3)})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 15, y + length);
    ctx.stroke();
  }

  for (let i = 0; i < 30; i += 1) {
    const radius = 6 + Math.random() * 14;
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, 'rgba(230, 248, 255, 0.22)');
    glow.addColorStop(1, 'rgba(230, 248, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 18; i += 1) {
    const laneWidth = 8 + Math.random() * 18;
    const laneX = Math.random() * canvas.width;
    const laneGradient = ctx.createLinearGradient(laneX, 0, laneX + laneWidth, 0);
    laneGradient.addColorStop(0, 'rgba(255,255,255,0)');
    laneGradient.addColorStop(0.5, `rgba(240,252,255,${(0.12 + Math.random() * 0.14).toFixed(3)})`);
    laneGradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = laneGradient;
    ctx.fillRect(laneX, 0, laneWidth, canvas.height);
  }

  const edgeMask = ctx.createLinearGradient(0, 0, canvas.width, 0);
  edgeMask.addColorStop(0, 'rgba(0,0,0,0)');
  edgeMask.addColorStop(0.08, 'rgba(0,0,0,0.18)');
  edgeMask.addColorStop(0.2, 'rgba(0,0,0,0.88)');
  edgeMask.addColorStop(0.5, 'rgba(0,0,0,1)');
  edgeMask.addColorStop(0.8, 'rgba(0,0,0,0.88)');
  edgeMask.addColorStop(0.92, 'rgba(0,0,0,0.18)');
  edgeMask.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = edgeMask;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const heightMask = ctx.createLinearGradient(0, 0, 0, canvas.height);
  heightMask.addColorStop(0, 'rgba(0,0,0,0.75)');
  heightMask.addColorStop(0.08, 'rgba(0,0,0,1)');
  heightMask.addColorStop(0.84, 'rgba(0,0,0,0.98)');
  heightMask.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = heightMask;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.05, 1.95);
  tex.anisotropy = 4;
  return tex;
}

function createWaterfallMistTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.5;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, canvas.width * 0.5);
  gradient.addColorStop(0, 'rgba(245, 253, 255, 0.96)');
  gradient.addColorStop(0.25, 'rgba(228, 248, 255, 0.55)');
  gradient.addColorStop(0.65, 'rgba(210, 238, 251, 0.22)');
  gradient.addColorStop(1, 'rgba(210, 238, 251, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function addWorldCollider(x, z, radius, tag = 'solid') {
  worldColliders.push({ x, z, radius, tag });
}

function addWallCollisionFromMesh(mesh, tag = 'house') {
  if (!mesh) return;
  mesh.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromObject(mesh);
  const minX = box.min.x;
  const maxX = box.max.x;
  const minZ = box.min.z;
  const maxZ = box.max.z;
  const width = Math.max(0.01, maxX - minX);
  const depth = Math.max(0.01, maxZ - minZ);
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;

  if (width >= depth) {
    const radius = depth * 0.5 + 0.2;
    const count = Math.max(2, Math.ceil(width / Math.max(0.45, radius * 1.3)));
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x = minX + t * width;
      addWorldCollider(x, cz, radius, tag);
    }
  } else {
    const radius = width * 0.5 + 0.2;
    const count = Math.max(2, Math.ceil(depth / Math.max(0.45, radius * 1.3)));
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const z = minZ + t * depth;
      addWorldCollider(cx, z, radius, tag);
    }
  }
}

function addSphereCollisionFromMesh(mesh, tag = 'solid', extraRadius = 0.12) {
  if (!mesh?.geometry) return;
  if (!mesh.geometry.boundingSphere) {
    mesh.geometry.computeBoundingSphere();
  }
  const sphere = mesh.geometry.boundingSphere;
  if (!sphere) return;
  mesh.updateWorldMatrix(true, false);
  const center = sphere.center.clone().applyMatrix4(mesh.matrixWorld);
  const worldScale = new THREE.Vector3();
  mesh.getWorldScale(worldScale);
  // Collisions are resolved in XZ only, so use horizontal scale to avoid oversized blockers on tall meshes.
  const scale = Math.max(Math.abs(worldScale.x), Math.abs(worldScale.z), 0.01);
  const radius = sphere.radius * scale + extraRadius;
  addWorldCollider(center.x, center.z, radius, tag);
}

function addRockFootprintCollisionFromMesh(mesh, tag = 'rock', radiusPadding = 0) {
  if (!mesh) return;
  mesh.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromObject(mesh);
  if (box.isEmpty()) return;

  const minX = box.min.x;
  const maxX = box.max.x;
  const minZ = box.min.z;
  const maxZ = box.max.z;
  const width = Math.max(0.2, maxX - minX);
  const depth = Math.max(0.2, maxZ - minZ);
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;

  const minDim = Math.min(width, depth);
  const baseRadius = Math.max(0.24, minDim * 0.22 + radiusPadding);
  const armRadius = baseRadius * 0.82;
  const offsetX = width * 0.33;
  const offsetZ = depth * 0.33;

  addWorldCollider(cx, cz, baseRadius * 0.9, tag);
  addWorldCollider(cx - offsetX, cz, armRadius, tag);
  addWorldCollider(cx + offsetX, cz, armRadius, tag);
  addWorldCollider(cx, cz - offsetZ, armRadius, tag);
  addWorldCollider(cx, cz + offsetZ, armRadius, tag);
}

function resolveWorldCollisions(x, z, y = GROUND_Y) {
  let nextX = x;
  let nextZ = z;
  const nearLighthouseDoor = Math.hypot(nextX - LIGHTHOUSE_DOOR_POS.x, nextZ - LIGHTHOUSE_DOOR_POS.z) < 2.35 && y <= GROUND_Y + 2.2;
  for (const collider of worldColliders) {
    if (collider.tag === 'lighthouse-shell' && (inLighthouseInterior || nearLighthouseDoor || y > GROUND_Y + 2.6)) {
      continue;
    }
    const dx = nextX - collider.x;
    const dz = nextZ - collider.z;
    const cliffTightening = collider.tag === 'cliff' ? -0.18 : 0;
    const minDist = Math.max(0.05, PLAYER_COLLISION_RADIUS + collider.radius + cliffTightening);
    const dist = Math.hypot(dx, dz);
    if (dist >= minDist) continue;
    const scale = minDist / (dist || 1);
    nextX = collider.x + dx * scale;
    nextZ = collider.z + dz * scale;
  }
  return { x: nextX, z: nextZ };
}

function addPalm(x, z, scale = 1) {
  const trunkCurve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2 * scale, 0.38 * scale, 4.8 * scale, 10),
    new THREE.MeshStandardMaterial({ color: 0x7b5135, roughness: 0.9 })
  );
  trunkCurve.position.set(x + 0.15 * scale, 2.5 * scale, z - 0.12 * scale);
  trunkCurve.rotation.z = 0.13;
  trunkCurve.castShadow = true;
  trunkCurve.receiveShadow = true;
  scene.add(trunkCurve);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19 * scale, 0.34 * scale, 4.2 * scale, 9),
    new THREE.MeshStandardMaterial({ color: 0x7b5135, roughness: 0.9 })
  );
  trunk.position.set(x, 3.0 * scale, z);
  trunk.rotation.z = -0.09;
  trunk.castShadow = true;
  trunk.receiveShadow = true;

  const leaves = new THREE.Group();
  for (let i = 0; i < 6; i += 1) {
    const frond = new THREE.Mesh(
      new THREE.ConeGeometry(0.22 * scale, 2.25 * scale, 6),
      new THREE.MeshStandardMaterial({ color: 0x2f7f46, roughness: 0.82 })
    );
    frond.rotation.z = Math.PI / 2.35;
    frond.rotation.y = (i / 6) * Math.PI * 2;
    frond.position.set(x, 5.45 * scale, z);
    frond.castShadow = true;
    leaves.add(frond);
  }

  scene.add(trunk);
  scene.add(leaves);
  addWorldCollider(x, z, 0.64 * scale, 'tree');
}

function addBush(x, z, scale = 1) {
  const bush = new THREE.Mesh(
    new THREE.SphereGeometry(0.78 * scale, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x3d8e4d, roughness: 0.88 })
  );
  bush.position.set(x, 1.62 + 0.2 * scale, z);
  bush.castShadow = true;
  bush.receiveShadow = true;
  scene.add(bush);
  addWorldCollider(x, z, 0.5 * scale, 'bush');
}

function addGrassTuft(x, z, scale = 1, color = 0x4f8a3f) {
  const tuft = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.08 * scale, 0.55 * scale, 5),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    );
    blade.position.set((Math.random() - 0.5) * 0.18 * scale, 1.45 + 0.2 * scale, (Math.random() - 0.5) * 0.18 * scale);
    blade.rotation.x = (Math.random() - 0.5) * 0.24;
    blade.rotation.z = (Math.random() - 0.5) * 0.24;
    tuft.add(blade);
  }
  tuft.position.set(x, 0, z);
  scene.add(tuft);
}

function addFlowerPatch(x, z, count = 10, spread = 2.2) {
  for (let i = 0; i < count; i += 1) {
    const px = x + (Math.random() - 0.5) * spread;
    const pz = z + (Math.random() - 0.5) * spread;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.36, 6),
      new THREE.MeshStandardMaterial({ color: 0x3c8a3a, roughness: 0.92 })
    );
    stem.position.set(px, 1.53, pz);
    const bloomColor = [0xfef08a, 0xfda4af, 0xbfdbfe, 0xf5d0fe][i % 4];
    const bloom = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshStandardMaterial({ color: bloomColor, roughness: 0.75 })
    );
    bloom.position.set(px, 1.76, pz);
    scene.add(stem, bloom);
  }
}

const LIGHTHOUSE_POS = new THREE.Vector3(worldLimit * 1.65, 0, -worldLimit * 1.85);
const ISLAND_DOCK_POS = new THREE.Vector3(worldLimit * 0.92, 1.42, worldLimit * 0.24);
const ISLAND_DOCK_YAW = Math.atan2(-ISLAND_DOCK_POS.z, ISLAND_DOCK_POS.x);
const toMainX = -LIGHTHOUSE_POS.x;
const toMainZ = -LIGHTHOUSE_POS.z;
const toMainLen = Math.hypot(toMainX, toMainZ) || 1;
const LIGHTHOUSE_DOCK_POS = new THREE.Vector3(
  LIGHTHOUSE_POS.x + (toMainX / toMainLen) * 10.6,
  1.36,
  LIGHTHOUSE_POS.z + (toMainZ / toMainLen) * 10.6
);
const LIGHTHOUSE_DOCK_YAW = Math.atan2(-(LIGHTHOUSE_DOCK_POS.z - LIGHTHOUSE_POS.z), LIGHTHOUSE_DOCK_POS.x - LIGHTHOUSE_POS.x);
const LIGHTHOUSE_DOOR_POS = new THREE.Vector3(LIGHTHOUSE_POS.x, 1.36, LIGHTHOUSE_POS.z + 2.8);
const LIGHTHOUSE_TOP_POS = new THREE.Vector3(LIGHTHOUSE_POS.x, 14.2, LIGHTHOUSE_POS.z);
const LIGHTHOUSE_INTERIOR_BASE = new THREE.Vector3(-130, 0, 210);
const INTERIOR_PLAY_RADIUS = 11.2;
const INTERIOR_ENTRY_POS = new THREE.Vector3(LIGHTHOUSE_INTERIOR_BASE.x, 1.36, LIGHTHOUSE_INTERIOR_BASE.z + 8.6);
const INTERIOR_TOP_POS = new THREE.Vector3(LIGHTHOUSE_INTERIOR_BASE.x, 20.8, LIGHTHOUSE_INTERIOR_BASE.z);
const INTERIOR_STAIR_RADIUS = 7.25;
const INTERIOR_STAIR_START_Y = 1.5;
const INTERIOR_STAIR_RISE = 0.155;
const INTERIOR_STAIR_ANGLE_STEP = 0.17;
const INTERIOR_STAIR_STEPS = 126;
const INTERIOR_STAIR_END_ANGLE = (INTERIOR_STAIR_STEPS - 1) * INTERIOR_STAIR_ANGLE_STEP;
const INTERIOR_EXIT_PORTAL_POS = new THREE.Vector3(
  LIGHTHOUSE_INTERIOR_BASE.x + Math.cos(INTERIOR_STAIR_END_ANGLE) * (INTERIOR_STAIR_RADIUS + 0.45),
  INTERIOR_TOP_POS.y + 0.14,
  LIGHTHOUSE_INTERIOR_BASE.z + Math.sin(INTERIOR_STAIR_END_ANGLE) * (INTERIOR_STAIR_RADIUS + 0.45)
);
const SWIM_MIN_RADIUS = worldLimit + 0.6;
const SWIM_MAX_RADIUS = worldLimit * 3.9;
const SWIM_SURFACE_Y = 0.38;
const SWIM_SINK_Y = -3.6;
let lighthouseInteriorGroup = null;
let lighthouseInteriorPortal = null;
let lighthouseTopPortal = null;
let inLighthouseInterior = false;
let isTeleporting = false;
const TELEPORT_TRIGGER_COOLDOWN_MS = 900;
let teleportTriggerLockUntil = 0;
const dockWalkZones = [];

const boatState = {
  mesh: null,
  ...findWaterSideSlot(ISLAND_DOCK_POS, ISLAND_DOCK_YAW, 1, 6.0, 3.2),
  y: 1.05,
  yaw: ISLAND_DOCK_YAW,
  speed: 0,
  onboard: false,
  paddleLeftPivot: null,
  paddleRightPivot: null,
  paddlePhase: 0
};
const BOAT_CLEARANCE_MAIN = worldLimit + 3.4;
const BOAT_CLEARANCE_LIGHTHOUSE = 12.6;
const BOAT_CLEARANCE_MINE_ENTRY = MINE_ENTRY_ISLAND_RADIUS + 1.8;
const BOAT_CLEARANCE_FISHING = FISHING_ISLAND_RADIUS + 1.9;
const BOAT_CLEARANCE_MARKET = MARKET_ISLAND_RADIUS + 1.9;
const BOAT_CLEARANCE_LEADERBOARD = LEADERBOARD_ISLAND_RADIUS + 1.9;
addWorldCollider(LIGHTHOUSE_POS.x, LIGHTHOUSE_POS.z, 2.32, 'lighthouse-shell');

function dockOffsetPosition(dock, yaw, forward = 0, side = 0) {
  const fX = Math.sin(yaw);
  const fZ = Math.cos(yaw);
  const rX = Math.cos(yaw);
  const rZ = -Math.sin(yaw);
  return {
    x: dock.x + fX * forward + rX * side,
    z: dock.z + fZ * forward + rZ * side
  };
}

function findWaterSideSlot(dock, yaw, preferSide = 1, forward = 6.0, baseSide = 3.2) {
  for (const sideDir of [preferSide, -preferSide]) {
    for (let side = baseSide; side <= baseSide + 8; side += 0.5) {
      const pos = dockOffsetPosition(dock, yaw, forward, side * sideDir);
      if (isWaterAt(pos.x, pos.z)) return pos;
    }
  }
  return dockOffsetPosition(dock, yaw, forward, baseSide * preferSide);
}

function dockSlots() {
  return [
    { dock: ISLAND_DOCK_POS, yaw: ISLAND_DOCK_YAW },
    { dock: LIGHTHOUSE_DOCK_POS, yaw: LIGHTHOUSE_DOCK_YAW },
    { dock: MINE_ENTRY_DOCK_POS, yaw: MINE_ENTRY_DOCK_YAW },
    { dock: FISHING_DOCK_POS, yaw: FISHING_DOCK_YAW },
    { dock: MARKET_DOCK_POS, yaw: MARKET_DOCK_YAW },
    { dock: FURNITURE_DOCK_POS, yaw: FURNITURE_DOCK_YAW },
    { dock: LEADERBOARD_DOCK_POS, yaw: LEADERBOARD_DOCK_YAW }
  ];
}

function nearestDockSlot(point, maxDistance = Infinity) {
  let best = null;
  for (const slot of dockSlots()) {
    const dist = distance2D(point, slot.dock);
    if (dist <= maxDistance && (!best || dist < best.distance)) {
      best = { ...slot, distance: dist };
    }
  }
  return best;
}

function boatPoseForDock(slot) {
  if (slot.dock === ISLAND_DOCK_POS) {
    return { ...findWaterSideSlot(slot.dock, slot.yaw, 1, 6.0, 3.2), yaw: slot.yaw };
  }
  return { ...findWaterSideSlot(slot.dock, slot.yaw, 1, 5.0, 2.4), yaw: slot.yaw };
}

function addDock(anchor, yaw = 0, options = {}) {
  const segments = options.segments ?? 7;
  const plankLength = options.plankLength ?? 2.2;
  const plankWidth = options.plankWidth ?? 0.7;
  const spacing = options.spacing ?? 1.05;
  const addRamp = options.addRamp !== false;
  const walkable = options.walkable !== false;
  const dock = new THREE.Group();
  dock.position.copy(anchor);
  dock.rotation.y = yaw;
  const lastCenterX = (segments - 1) * spacing;
  const deckLength = lastCenterX + plankLength;
  const deckCenterX = lastCenterX * 0.5;

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(deckLength, 0.16, plankWidth),
    new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 })
  );
  deck.position.set(deckCenterX, 0.05, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  dock.add(deck);

  if (addRamp) {
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.18, plankWidth + 0.34),
      new THREE.MeshStandardMaterial({ color: 0x80552f, roughness: 0.9 })
    );
    ramp.position.set(-1.45, -0.01, 0);
    ramp.rotation.z = 0.07;
    ramp.receiveShadow = true;
    dock.add(ramp);
  }

  for (let i = 0; i < segments; i += 1) {
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.165, plankWidth * 0.98),
      new THREE.MeshStandardMaterial({ color: 0x5b412c, roughness: 0.95 })
    );
    seam.position.set(i * spacing - spacing * 0.5, 0.06, 0);
    seam.castShadow = true;
    dock.add(seam);
  }

  const railOffsetZ = plankWidth * 0.5 + 0.2;
  const railHeight = options.railHeight ?? 0.5;
  for (const z of [-railOffsetZ, railOffsetZ]) {
    const topRail = new THREE.Mesh(
      new THREE.BoxGeometry(deckLength + 0.34, 0.1, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x5b412c, roughness: 0.92 })
    );
    topRail.position.set(deckCenterX, railHeight, z);
    topRail.castShadow = true;
    topRail.receiveShadow = true;
    dock.add(topRail);

    const midRail = new THREE.Mesh(
      new THREE.BoxGeometry(deckLength + 0.28, 0.08, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x60452f, roughness: 0.92 })
    );
    midRail.position.set(deckCenterX, railHeight - 0.18, z);
    midRail.castShadow = true;
    midRail.receiveShadow = true;
    dock.add(midRail);
  }

  const railPostGeo = new THREE.BoxGeometry(0.12, railHeight + 0.06, 0.12);
  const railPosts = Math.max(6, Math.floor(deckLength / 1.6));
  for (let i = 0; i <= railPosts; i += 1) {
    const t = railPosts === 0 ? 0 : i / railPosts;
    const px = -plankLength * 0.5 + t * deckLength;
    for (const z of [-railOffsetZ, railOffsetZ]) {
      const post = new THREE.Mesh(
        railPostGeo,
        new THREE.MeshStandardMaterial({ color: 0x4d3624, roughness: 0.94 })
      );
      post.position.set(px, railHeight * 0.5, z);
      post.castShadow = true;
      post.receiveShadow = true;
      dock.add(post);
    }
  }

  const pillarGeo = new THREE.CylinderGeometry(0.14, 0.18, 1.0, 10);
  const pillarRows = Math.max(5, Math.floor(segments * 0.6));
  for (let i = 0; i < pillarRows; i += 1) {
    const t = pillarRows === 1 ? 0 : i / (pillarRows - 1);
    const px = -plankLength * 0.5 + 0.25 + t * (deckLength - 0.5);
    for (const z of [-railOffsetZ + 0.08, railOffsetZ - 0.08]) {
      const pillar = new THREE.Mesh(
        pillarGeo,
        new THREE.MeshStandardMaterial({ color: 0x4b3623, roughness: 0.95 })
      );
      pillar.position.set(px, -0.4, z);
      pillar.castShadow = true;
      dock.add(pillar);
    }
  }

  if (walkable) {
    const startX = addRamp ? -2.8 : -plankLength * 0.5 - 0.2;
    const endX = lastCenterX + plankLength * 0.5 + 0.25;
    const deckMinX = -plankLength * 0.5;
    const deckMaxX = lastCenterX + plankLength * 0.5;
    dockWalkZones.push({
      x: anchor.x,
      z: anchor.z,
      yaw,
      minForward: Math.min(startX, deckMinX) - 3.2,
      maxForward: Math.max(endX, deckMaxX) + 3.2,
      halfWidth: plankWidth * 0.5 + 1.8,
      floorY: anchor.y + 0.13
    });
  }

  scene.add(dock);
}

function addLighthouseIsland() {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(12.5, 14.5, 3.0, 36),
    new THREE.MeshStandardMaterial({ color: 0x8b6a4c, roughness: 0.95 })
  );
  base.position.set(LIGHTHOUSE_POS.x, -0.4, LIGHTHOUSE_POS.z);
  base.receiveShadow = true;
  scene.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(10.8, 12.3, 1.3, 40),
    new THREE.MeshStandardMaterial({ color: 0x7ea35f, roughness: 0.9 })
  );
  top.position.set(LIGHTHOUSE_POS.x, 1.35, LIGHTHOUSE_POS.z);
  top.receiveShadow = true;
  scene.add(top);

  const lighthouse = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 2.0, 12.5, 24),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.75 })
  );
  tower.position.y = 7.4;
  tower.castShadow = true;
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(1.88, 0.12, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 })
  );
  band.rotation.x = Math.PI / 2;
  band.position.y = 8.1;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.95, 2.4, 24),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 })
  );
  roof.position.y = 14.7;
  roof.castShadow = true;
  const balcony = new THREE.Mesh(
    new THREE.CylinderGeometry(2.55, 2.55, 0.24, 24),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.72 })
  );
  balcony.position.y = 13.1;
  balcony.receiveShadow = true;
  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(2.45, 0.08, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.72 })
  );
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 13.58;

  const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.88, side: THREE.DoubleSide });
  const doorWoodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9, side: THREE.DoubleSide });
  const doorMetalMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.58, metalness: 0.3, side: THREE.DoubleSide });
  // CylinderGeometry uses 0 radians at +Z, same convention as atan2(dx, dz) yaw math.
  const doorCenterAngle = Math.atan2(
    LIGHTHOUSE_DOOR_POS.x - LIGHTHOUSE_POS.x,
    LIGHTHOUSE_DOOR_POS.z - LIGHTHOUSE_POS.z
  );

  const frameArc = 1.42;
  const frameStart = doorCenterAngle - frameArc * 0.5;
  const doorFrame = new THREE.Mesh(
    new THREE.CylinderGeometry(2.34, 2.5, 3.98, 28, 1, true, frameStart, frameArc),
    doorFrameMat
  );
  doorFrame.position.y = 3.0;
  doorFrame.castShadow = true;
  doorFrame.receiveShadow = true;

  const doorVoidArc = 1.2;
  const doorVoidStart = doorCenterAngle - doorVoidArc * 0.5;
  const doorVoid = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.34, 3.82, 24, 1, true, doorVoidStart, doorVoidArc),
    new THREE.MeshBasicMaterial({ color: 0x0b0f17, side: THREE.DoubleSide })
  );
  doorVoid.position.y = 3.0;

  function makeLighthouseDoor(side = 1) {
    const door = new THREE.Group();
    const panelArc = 0.53;
    const centerGap = 0.08;
    const panelStart = side < 0
      ? doorCenterAngle - centerGap * 0.5 - panelArc
      : doorCenterAngle + centerGap * 0.5;
    const panel = new THREE.Mesh(
      new THREE.CylinderGeometry(2.26, 2.4, 3.56, 18, 1, true, panelStart, panelArc),
      doorWoodMat
    );
    panel.position.y = 3.0;
    panel.castShadow = true;
    panel.receiveShadow = true;
    door.add(panel);

    for (const yOffset of [1.05, 0, -1.05]) {
      const strap = new THREE.Mesh(
        new THREE.CylinderGeometry(2.29, 2.43, 0.09, 18, 1, true, panelStart, panelArc),
        doorMetalMat
      );
      strap.position.y = 3.0 + yOffset;
      strap.castShadow = true;
      strap.receiveShadow = true;
      door.add(strap);
    }

    const handleAngle = side < 0
      ? doorCenterAngle - centerGap * 0.5 - 0.03
      : doorCenterAngle + centerGap * 0.5 + 0.03;
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), doorMetalMat);
    handle.position.set(Math.cos(handleAngle) * 2.34, 3.05, Math.sin(handleAngle) * 2.34);
    handle.castShadow = true;
    door.add(handle);

    return door;
  }

  const wallLampL = new THREE.PointLight(0xffd68a, 0.45, 5, 2);
  wallLampL.position.set(-1.18, 2.95, 2.2);
  const wallLampR = new THREE.PointLight(0xffd68a, 0.45, 5, 2);
  wallLampR.position.set(1.18, 2.95, 2.2);

  lighthouseTopPortal = new THREE.Group();
  const topPortalDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, 0.1, 24),
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 1.15,
      roughness: 0.28,
      metalness: 0.32
    })
  );
  const topPortalRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.08, 12, 28),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.85,
      roughness: 0.35
    })
  );
  topPortalRing.rotation.x = Math.PI / 2;
  topPortalRing.position.y = 0.06;
  lighthouseTopPortal.position.set(0, 13.23, 0);
  lighthouseTopPortal.add(topPortalDisc, topPortalRing);
  const topPortalLight = new THREE.PointLight(0x67e8f9, 0.75, 8, 2);
  topPortalLight.position.set(0, 13.55, 0);
  lighthouseTopPortal.add(topPortalLight);
  lighthouse.add(
    tower, band, balcony, rail, roof,
    doorFrame, doorVoid,
    makeLighthouseDoor(-1), makeLighthouseDoor(1),
    wallLampL, wallLampR
  );
  lighthouse.add(lighthouseTopPortal);
  lighthouse.position.set(LIGHTHOUSE_POS.x, 0, LIGHTHOUSE_POS.z);
  scene.add(lighthouse);
}

function addMineEntryIsland() {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(MINE_ENTRY_ISLAND_RADIUS + 1.8, MINE_ENTRY_ISLAND_RADIUS + 3.4, 3.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x8b6a4c, roughness: 0.95 })
  );
  base.position.set(MINE_ENTRY_ISLAND_POS.x, -0.35, MINE_ENTRY_ISLAND_POS.z);
  base.receiveShadow = true;
  scene.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(MINE_ENTRY_ISLAND_RADIUS, MINE_ENTRY_ISLAND_RADIUS + 1.2, 1.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x7ea35f, roughness: 0.9 })
  );
  top.position.set(MINE_ENTRY_ISLAND_POS.x, 1.35, MINE_ENTRY_ISLAND_POS.z);
  top.receiveShadow = true;
  scene.add(top);

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5f6470, roughness: 0.9 });
  const edgeRocks = 14;
  for (let i = 0; i < edgeRocks; i += 1) {
    const angle = (i / edgeRocks) * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1 + Math.random() * 0.5, 0), rockMat);
    const radius = MINE_ENTRY_ISLAND_RADIUS - 0.9 + Math.random() * 1.7;
    rock.position.set(
      MINE_ENTRY_ISLAND_POS.x + Math.cos(angle) * radius,
      1.8 + Math.random() * 1.0,
      MINE_ENTRY_ISLAND_POS.z + Math.sin(angle) * radius
    );
    rock.scale.set(1 + Math.random() * 0.45, 1 + Math.random() * 0.5, 1 + Math.random() * 0.45);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }
}

function addFishingIsland() {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(FISHING_ISLAND_RADIUS + 1.8, FISHING_ISLAND_RADIUS + 3.4, 3.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x8c6a4c, roughness: 0.94 })
  );
  base.position.set(FISHING_ISLAND_POS.x, -0.35, FISHING_ISLAND_POS.z);
  base.receiveShadow = true;
  scene.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(FISHING_ISLAND_RADIUS, FISHING_ISLAND_RADIUS + 1.1, 1.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x6f9b62, roughness: 0.9 })
  );
  top.position.set(FISHING_ISLAND_POS.x, 1.35, FISHING_ISLAND_POS.z);
  top.receiveShadow = true;
  scene.add(top);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(FISHING_ISLAND_RADIUS - 1.2, FISHING_ISLAND_RADIUS + 0.2, 38),
    new THREE.MeshStandardMaterial({ color: 0xc5a273, roughness: 0.94 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(FISHING_ISLAND_POS.x, 1.38, FISHING_ISLAND_POS.z);
  ring.receiveShadow = true;
  scene.add(ring);

  const vendor = createVendorNpc({
    shirtColor: 0x0891b2,
    skinColor: 0xd6a581,
    hairColor: 0x1f2937,
    hatColor: 0x0f172a
  });
  vendor.scale.setScalar(0.65);
  const stall = createVendorStall({
    label: 'Fishing',
    signColor: '#0b2940',
    canopyA: 0x0ea5e9,
    canopyB: 0xffffff,
    vendor
  });
  const fishingHouseYaw = Math.atan2(-FISHING_VENDOR_POS.x, -FISHING_VENDOR_POS.z);
  const fishingStoreOffset = 2.0;
  const fishingStoreX = FISHING_VENDOR_POS.x - Math.sin(fishingHouseYaw) * fishingStoreOffset;
  const fishingStoreZ = FISHING_VENDOR_POS.z - Math.cos(fishingHouseYaw) * fishingStoreOffset;
  addStoreBuilding(fishingStoreX, fishingStoreZ, fishingHouseYaw);
  vendor.position.set(0, VENDOR_STAND_Y - 0.05, -1.0);
  stall.position.set(FISHING_VENDOR_POS.x, 0, FISHING_VENDOR_POS.z);
  stall.rotation.y = fishingHouseYaw;
  scene.add(stall);
  addWorldCollider(FISHING_VENDOR_POS.x, FISHING_VENDOR_POS.z, 1.04, 'npc');

  const spotDefs = [
    { id: 'fish-north', x: FISHING_ISLAND_POS.x + 0.8, z: FISHING_ISLAND_POS.z - (FISHING_ISLAND_RADIUS + 0.65) },
    { id: 'fish-east', x: FISHING_ISLAND_POS.x + (FISHING_ISLAND_RADIUS + 0.55), z: FISHING_ISLAND_POS.z + 0.9 },
    { id: 'fish-west', x: FISHING_ISLAND_POS.x - (FISHING_ISLAND_RADIUS + 0.48), z: FISHING_ISLAND_POS.z - 0.6 }
  ];
  for (const spot of spotDefs) {
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.65, roughness: 0.32 })
    );
    marker.position.set(spot.x, 0.43, spot.z);
    marker.castShadow = true;
    scene.add(marker);
    fishingSpots.push({
      id: spot.id,
      x: spot.x,
      z: spot.z,
      marker
    });
  }
}

function addMarketIsland() {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(MARKET_ISLAND_RADIUS + 1.8, MARKET_ISLAND_RADIUS + 3.4, 3.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x8b6b4f, roughness: 0.95 })
  );
  base.position.set(MARKET_ISLAND_POS.x, -0.35, MARKET_ISLAND_POS.z);
  base.receiveShadow = true;
  scene.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(MARKET_ISLAND_RADIUS, MARKET_ISLAND_RADIUS + 1.1, 1.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x739a62, roughness: 0.9 })
  );
  top.position.set(MARKET_ISLAND_POS.x, 1.35, MARKET_ISLAND_POS.z);
  top.receiveShadow = true;
  scene.add(top);

  const vendor = createVendorNpc({
    shirtColor: 0xa16207,
    skinColor: 0xe0b18f,
    hairColor: 0x111827,
    hatColor: 0x3f2a1a
  });
  vendor.scale.setScalar(0.65);
  const stall = createVendorStall({
    label: 'Fish Market',
    signColor: '#2f2417',
    canopyA: 0xf59e0b,
    canopyB: 0xffffff,
    vendor
  });
  const marketHouseYaw = Math.atan2(-MARKET_VENDOR_POS.x, -MARKET_VENDOR_POS.z);
  const marketStoreOffset = 2.0;
  const marketStoreX = MARKET_VENDOR_POS.x - Math.sin(marketHouseYaw) * marketStoreOffset;
  const marketStoreZ = MARKET_VENDOR_POS.z - Math.cos(marketHouseYaw) * marketStoreOffset;
  addStoreBuilding(marketStoreX, marketStoreZ, marketHouseYaw);
  vendor.position.set(0, VENDOR_STAND_Y - 0.05, -1.0);
  stall.position.set(MARKET_VENDOR_POS.x, 0, MARKET_VENDOR_POS.z);
  stall.rotation.y = marketHouseYaw;
  scene.add(stall);
  addWorldCollider(MARKET_VENDOR_POS.x, MARKET_VENDOR_POS.z, 1.04, 'npc');

  const spotDefs = [
    { id: 'market-fish-north', x: MARKET_ISLAND_POS.x + 0.75, z: MARKET_ISLAND_POS.z - (MARKET_ISLAND_RADIUS + 0.62) },
    { id: 'market-fish-east', x: MARKET_ISLAND_POS.x + (MARKET_ISLAND_RADIUS + 0.56), z: MARKET_ISLAND_POS.z + 0.55 },
    { id: 'market-fish-south', x: MARKET_ISLAND_POS.x - 0.45, z: MARKET_ISLAND_POS.z + (MARKET_ISLAND_RADIUS + 0.58) }
  ];
  for (const spot of spotDefs) {
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0c4a6e, emissiveIntensity: 0.72, roughness: 0.34 })
    );
    marker.position.set(spot.x, 0.43, spot.z);
    marker.castShadow = true;
    scene.add(marker);
    fishingSpots.push({
      id: spot.id,
      x: spot.x,
      z: spot.z,
      marker
    });
  }
}

function addFurnitureIsland() {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(FURNITURE_ISLAND_RADIUS + 1.8, FURNITURE_ISLAND_RADIUS + 3.4, 3.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x8b6d52, roughness: 0.95 })
  );
  base.position.set(FURNITURE_ISLAND_POS.x, -0.35, FURNITURE_ISLAND_POS.z);
  base.receiveShadow = true;
  scene.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(FURNITURE_ISLAND_RADIUS, FURNITURE_ISLAND_RADIUS + 1.1, 1.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x7ca069, roughness: 0.9 })
  );
  top.position.set(FURNITURE_ISLAND_POS.x, 1.35, FURNITURE_ISLAND_POS.z);
  top.receiveShadow = true;
  scene.add(top);

  const accentRing = new THREE.Mesh(
    new THREE.RingGeometry(FURNITURE_ISLAND_RADIUS - 1.1, FURNITURE_ISLAND_RADIUS + 0.24, 40),
    new THREE.MeshStandardMaterial({ color: 0xd5b48d, roughness: 0.92 })
  );
  accentRing.rotation.x = -Math.PI / 2;
  accentRing.position.set(FURNITURE_ISLAND_POS.x, 1.38, FURNITURE_ISLAND_POS.z);
  accentRing.receiveShadow = true;
  scene.add(accentRing);

  const vendor = createVendorNpc({
    shirtColor: 0xfb7185,
    skinColor: 0xe0b18f,
    hairColor: 0x3f2a1a,
    hatColor: 0x7c2d12
  });
  vendor.scale.setScalar(0.65);
  const stall = createVendorStall({
    label: 'Furniture',
    signColor: '#46271a',
    canopyA: 0xfb7185,
    canopyB: 0xfffbeb,
    vendor
  });
  const furnitureHouseYaw = Math.atan2(-FURNITURE_VENDOR_POS.x, -FURNITURE_VENDOR_POS.z);
  const furnitureStoreOffset = 2.0;
  const furnitureStoreX = FURNITURE_VENDOR_POS.x - Math.sin(furnitureHouseYaw) * furnitureStoreOffset;
  const furnitureStoreZ = FURNITURE_VENDOR_POS.z - Math.cos(furnitureHouseYaw) * furnitureStoreOffset;
  addStoreBuilding(furnitureStoreX, furnitureStoreZ, furnitureHouseYaw);
  vendor.position.set(0, VENDOR_STAND_Y - 0.05, -1.0);
  stall.position.set(FURNITURE_VENDOR_POS.x, 0, FURNITURE_VENDOR_POS.z);
  stall.rotation.y = furnitureHouseYaw;
  scene.add(stall);
  addWorldCollider(FURNITURE_VENDOR_POS.x, FURNITURE_VENDOR_POS.z, 1.04, 'npc');
}

function drawLeaderboardBoardTexture() {
  if (!leaderboardBoardCtx || !leaderboardBoardCanvas || !leaderboardBoardTexture) return;
  const ctx = leaderboardBoardCtx;
  const canvas = leaderboardBoardCanvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#0b1726');
  bgGrad.addColorStop(0.55, '#11263a');
  bgGrad.addColorStop(1, '#0a1522');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(236, 253, 245, 0.2)';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

  const now = new Date();
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 62px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText('Top Islanders', canvas.width * 0.5, 74);
  ctx.font = '500 24px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillStyle = '#bfdbfe';
  ctx.fillText(`Updated ${now.toLocaleTimeString()}`, canvas.width * 0.5, 120);

  const rows = Array.isArray(leaderboardBoardRows) ? leaderboardBoardRows.slice(0, LEADERBOARD_BOARD_ROW_LIMIT) : [];
  if (!rows.length) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 38px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText('No leaderboard data yet', canvas.width * 0.5, canvas.height * 0.5);
    leaderboardBoardTexture.needsUpdate = true;
    leaderboardBoardNeedsRedraw = false;
    return;
  }

  const rowStartY = 174;
  const rowHeight = 66;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const y = rowStartY + i * rowHeight;
    const odd = i % 2 === 1;
    ctx.fillStyle = odd ? 'rgba(30, 64, 95, 0.38)' : 'rgba(15, 30, 48, 0.28)';
    ctx.fillRect(34, y - 25, canvas.width - 68, 50);

    ctx.textAlign = 'left';
    ctx.font = '700 30px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`#${row.rank || (i + 1)}`, 56, y);
    ctx.fillStyle = '#f8fafc';
    const safeName = String(row.name || 'Player').slice(0, 20);
    ctx.fillText(safeName, 138, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`${Math.max(0, Math.floor(Number(row.coins) || 0)).toLocaleString()}c`, canvas.width - 56, y);
    ctx.fillStyle = '#93c5fd';
    ctx.font = '600 24px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText(
      `Lv ${Math.max(1, Math.floor(Number(row.level) || 1))}  XP ${Math.max(0, Math.floor(Number(row.xp) || 0)).toLocaleString()}`,
      canvas.width - 252,
      y
    );
  }

  leaderboardBoardTexture.needsUpdate = true;
  leaderboardBoardNeedsRedraw = false;
}

async function refreshLeaderboardBoard(force = false) {
  if (!leaderboardBoardCanvas) return;
  if (leaderboardBoardFetchInFlight) return;
  const now = performance.now();
  if (!force && now - leaderboardBoardLastFetchAt < LEADERBOARD_BOARD_REFRESH_MS) return;
  leaderboardBoardLastFetchAt = now;
  leaderboardBoardFetchInFlight = true;
  try {
    const response = await fetch(`/leaderboard?limit=${LEADERBOARD_BOARD_ROW_LIMIT}`, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    if (!payload?.ok || !Array.isArray(payload.rows)) return;
    leaderboardBoardRows = payload.rows.map((row, index) => ({
      rank: Math.max(1, Math.floor(Number(row?.rank) || (index + 1))),
      name: typeof row?.name === 'string' && row.name.trim() ? row.name.trim() : 'Player',
      level: Math.max(1, Math.floor(Number(row?.level) || 1)),
      xp: Math.max(0, Math.floor(Number(row?.xp) || 0)),
      coins: Math.max(0, Math.floor(Number(row?.coins) || 0))
    }));
    leaderboardBoardNeedsRedraw = true;
  } catch {
    // Keep last rendered board state if network fetch fails.
  } finally {
    leaderboardBoardFetchInFlight = false;
  }
}

function updateLeaderboardBoard(nowMs) {
  if (!leaderboardBoardCanvas) return;
  if (leaderboardBoardNeedsRedraw) {
    drawLeaderboardBoardTexture();
  }
  if (nowMs - leaderboardBoardLastFetchAt >= LEADERBOARD_BOARD_REFRESH_MS) {
    void refreshLeaderboardBoard();
  }
}

function addLeaderboardIsland() {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(LEADERBOARD_ISLAND_RADIUS + 1.7, LEADERBOARD_ISLAND_RADIUS + 3.3, 3.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x87684a, roughness: 0.95 })
  );
  base.position.set(LEADERBOARD_ISLAND_POS.x, -0.35, LEADERBOARD_ISLAND_POS.z);
  base.receiveShadow = true;
  scene.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(LEADERBOARD_ISLAND_RADIUS, LEADERBOARD_ISLAND_RADIUS + 1.1, 1.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x6d945f, roughness: 0.9 })
  );
  top.position.set(LEADERBOARD_ISLAND_POS.x, 1.35, LEADERBOARD_ISLAND_POS.z);
  top.receiveShadow = true;
  scene.add(top);

  const accentRing = new THREE.Mesh(
    new THREE.RingGeometry(LEADERBOARD_ISLAND_RADIUS - 1.2, LEADERBOARD_ISLAND_RADIUS + 0.25, 42),
    new THREE.MeshStandardMaterial({ color: 0xc7a67b, roughness: 0.92 })
  );
  accentRing.rotation.x = -Math.PI / 2;
  accentRing.position.set(LEADERBOARD_ISLAND_POS.x, 1.38, LEADERBOARD_ISLAND_POS.z);
  accentRing.receiveShadow = true;
  scene.add(accentRing);

  leaderboardBoardCanvas = document.createElement('canvas');
  leaderboardBoardCanvas.width = 1024;
  leaderboardBoardCanvas.height = 768;
  leaderboardBoardCtx = leaderboardBoardCanvas.getContext('2d');
  leaderboardBoardTexture = new THREE.CanvasTexture(leaderboardBoardCanvas);
  leaderboardBoardTexture.colorSpace = THREE.SRGBColorSpace;
  leaderboardBoardTexture.minFilter = THREE.LinearFilter;
  leaderboardBoardTexture.magFilter = THREE.LinearFilter;

  const boardFacingYaw = Math.atan2(-LEADERBOARD_ISLAND_POS.x, -LEADERBOARD_ISLAND_POS.z);
  const board = new THREE.Group();
  board.position.set(LEADERBOARD_ISLAND_POS.x, 0, LEADERBOARD_ISLAND_POS.z);
  board.rotation.y = boardFacingYaw;

  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a311f, roughness: 0.92 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x5e4026, roughness: 0.9 });
  const panelBackMat = new THREE.MeshStandardMaterial({ color: 0x14263a, roughness: 0.86 });
  const postGeo = new THREE.BoxGeometry(0.24, 5.6, 0.24);
  for (const x of [-2.5, 2.5]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, 2.9, -0.45);
    post.castShadow = true;
    post.receiveShadow = true;
    board.add(post);
  }
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.28, 0.26), frameMat);
  topBeam.position.set(0, 5.6, -0.45);
  topBeam.castShadow = true;
  board.add(topBeam);

  const boardBack = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.6, 0.26), panelBackMat);
  boardBack.position.set(0, 2.9, -0.36);
  boardBack.castShadow = true;
  boardBack.receiveShadow = true;
  board.add(boardBack);

  const boardFace = new THREE.Mesh(
    new THREE.PlaneGeometry(4.9, 4.25),
    new THREE.MeshStandardMaterial({ map: leaderboardBoardTexture, roughness: 0.8, metalness: 0.02 })
  );
  boardFace.position.set(0, 2.9, -0.2);
  boardFace.castShadow = true;
  board.add(boardFace);

  const sign = makeTextSign('Leaderboard', 3.0, 0.72, '#14263a', '#f8fafc');
  sign.position.set(0, 6.05, -0.22);
  board.add(sign);
  scene.add(board);
  addWorldCollider(LEADERBOARD_ISLAND_POS.x, LEADERBOARD_ISLAND_POS.z, 2.9, 'stall');

  leaderboardBoardRows = [];
  leaderboardBoardNeedsRedraw = true;
  drawLeaderboardBoardTexture();
  void refreshLeaderboardBoard(true);
}

function addLighthouseInterior() {
  const interior = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.86, side: THREE.DoubleSide });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.72 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d5a2b, roughness: 0.82 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xf2c66a, roughness: 0.34, metalness: 0.55 });
  const shellRadius = 11.8;
  const shellHeight = 24.5;
  const floorRadius = 11.2;
  const stairRadius = INTERIOR_STAIR_RADIUS;
  const stairSteps = INTERIOR_STAIR_STEPS;
  const stairRise = INTERIOR_STAIR_RISE;

  const wall = new THREE.Mesh(new THREE.CylinderGeometry(shellRadius, shellRadius + 0.35, shellHeight, 56, 1, true), shellMat);
  wall.position.set(LIGHTHOUSE_INTERIOR_BASE.x, shellHeight * 0.5 - 0.12, LIGHTHOUSE_INTERIOR_BASE.z);
  wall.receiveShadow = true;
  interior.add(wall);

  const floorBase = new THREE.Mesh(new THREE.CircleGeometry(floorRadius, 56), stoneMat);
  floorBase.rotation.x = -Math.PI / 2;
  floorBase.position.set(LIGHTHOUSE_INTERIOR_BASE.x, 1.34, LIGHTHOUSE_INTERIOR_BASE.z);
  floorBase.receiveShadow = true;
  interior.add(floorBase);

  const floorRing = new THREE.Mesh(
    new THREE.RingGeometry(3.1, floorRadius - 0.3, 56),
    new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.85 })
  );
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.set(LIGHTHOUSE_INTERIOR_BASE.x, 1.345, LIGHTHOUSE_INTERIOR_BASE.z);
  interior.add(floorRing);

  const centerWell = new THREE.Mesh(
    new THREE.CylinderGeometry(2.25, 2.4, shellHeight - 2.2, 28),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.82 })
  );
  centerWell.position.set(LIGHTHOUSE_INTERIOR_BASE.x, 1.35 + (shellHeight - 2.2) * 0.5, LIGHTHOUSE_INTERIOR_BASE.z);
  centerWell.castShadow = true;
  centerWell.receiveShadow = true;
  interior.add(centerWell);
  addWorldCollider(LIGHTHOUSE_INTERIOR_BASE.x, LIGHTHOUSE_INTERIOR_BASE.z, 2.55, 'interior-core');

  const lowerTrim = new THREE.Mesh(new THREE.TorusGeometry(floorRadius - 0.05, 0.12, 8, 64), trimMat);
  lowerTrim.rotation.x = Math.PI / 2;
  lowerTrim.position.set(LIGHTHOUSE_INTERIOR_BASE.x, 1.72, LIGHTHOUSE_INTERIOR_BASE.z);
  interior.add(lowerTrim);
  const upperTrim = lowerTrim.clone();
  upperTrim.position.y = shellHeight - 0.35;
  interior.add(upperTrim);

  const stairRailMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 });
  for (let i = 0; i < stairSteps; i += 1) {
    const angle = i * INTERIOR_STAIR_ANGLE_STEP;
    const step = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 1.55), woodMat);
    step.position.set(
      LIGHTHOUSE_INTERIOR_BASE.x + Math.cos(angle) * stairRadius,
      INTERIOR_STAIR_START_Y + i * stairRise,
      LIGHTHOUSE_INTERIOR_BASE.z + Math.sin(angle) * stairRadius
    );
    step.rotation.y = -angle;
    step.castShadow = true;
    step.receiveShadow = true;
    interior.add(step);

    if (i < stairSteps - 1) {
      const nextAngle = (i + 1) * INTERIOR_STAIR_ANGLE_STEP;
      const nextX = LIGHTHOUSE_INTERIOR_BASE.x + Math.cos(nextAngle) * stairRadius;
      const nextZ = LIGHTHOUSE_INTERIOR_BASE.z + Math.sin(nextAngle) * stairRadius;
      const nextY = INTERIOR_STAIR_START_Y + (i + 1) * stairRise;
      const midX = (step.position.x + nextX) * 0.5;
      const midZ = (step.position.z + nextZ) * 0.5;
      const midY = (step.position.y + nextY) * 0.5 - 0.01;
      const run = Math.hypot(nextX - step.position.x, nextZ - step.position.z);
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, stairRise + 0.08, run + 0.62),
        new THREE.MeshStandardMaterial({ color: 0x8a572a, roughness: 0.82 })
      );
      bridge.position.set(midX, midY, midZ);
      bridge.rotation.y = -((angle + nextAngle) * 0.5);
      bridge.castShadow = true;
      bridge.receiveShadow = true;
      interior.add(bridge);
    }

    if (i % 2 === 0) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 8), stairRailMat);
      post.position.set(
        LIGHTHOUSE_INTERIOR_BASE.x + Math.cos(angle) * (stairRadius + 1.52),
        step.position.y + 0.38,
        LIGHTHOUSE_INTERIOR_BASE.z + Math.sin(angle) * (stairRadius + 1.52)
      );
      post.castShadow = true;
      interior.add(post);
    }
  }

  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8), trimMat);
    post.position.set(
      INTERIOR_TOP_POS.x + Math.cos(a) * 3.45,
      INTERIOR_TOP_POS.y + 0.18,
      INTERIOR_TOP_POS.z + Math.sin(a) * 3.45
    );
    post.castShadow = true;
    interior.add(post);
  }
  const topRail = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.08, 10, 40), trimMat);
  topRail.rotation.x = Math.PI / 2;
  topRail.position.set(INTERIOR_TOP_POS.x, INTERIOR_TOP_POS.y + 0.72, INTERIOR_TOP_POS.z);
  interior.add(topRail);

  const topPlatform = new THREE.Mesh(
    new THREE.CircleGeometry(3.35, 36),
    new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.76 })
  );
  topPlatform.rotation.x = -Math.PI / 2;
  topPlatform.position.set(INTERIOR_TOP_POS.x, INTERIOR_TOP_POS.y + 0.1, INTERIOR_TOP_POS.z);
  interior.add(topPlatform);

  const upperDeck = new THREE.Mesh(
    new THREE.RingGeometry(5.0, floorRadius - 0.25, 48),
    new THREE.MeshStandardMaterial({ color: 0x7c4f2d, roughness: 0.84 })
  );
  upperDeck.rotation.x = -Math.PI / 2;
  upperDeck.position.set(LIGHTHOUSE_INTERIOR_BASE.x, INTERIOR_TOP_POS.y - 0.42, LIGHTHOUSE_INTERIOR_BASE.z);
  upperDeck.receiveShadow = true;
  interior.add(upperDeck);

  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(shellRadius - 0.2, 56),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(LIGHTHOUSE_INTERIOR_BASE.x, shellHeight - 0.22, LIGHTHOUSE_INTERIOR_BASE.z);
  interior.add(ceiling);

  const entryFrame = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.1, 10, 30),
    new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x1d4ed8, emissiveIntensity: 0.5 })
  );
  entryFrame.rotation.x = Math.PI / 2;
  entryFrame.position.set(INTERIOR_ENTRY_POS.x, 1.45, INTERIOR_ENTRY_POS.z);
  interior.add(entryFrame);

  const mapTable = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.96, 0.72, 20), woodMat);
  mapTable.position.set(LIGHTHOUSE_INTERIOR_BASE.x - 4.25, 1.72, LIGHTHOUSE_INTERIOR_BASE.z - 3.4);
  mapTable.castShadow = true;
  mapTable.receiveShadow = true;
  interior.add(mapTable);
  const mapTop = new THREE.Mesh(
    new THREE.CircleGeometry(0.82, 20),
    new THREE.MeshStandardMaterial({ color: 0xf3ecd2, roughness: 0.96 })
  );
  mapTop.rotation.x = -Math.PI / 2;
  mapTop.position.set(mapTable.position.x, 2.09, mapTable.position.z);
  interior.add(mapTop);

  const lantern = new THREE.PointLight(0xffe8ad, 1.65, 42, 2);
  lantern.position.set(LIGHTHOUSE_INTERIOR_BASE.x, shellHeight - 2.1, LIGHTHOUSE_INTERIOR_BASE.z);
  interior.add(lantern);

  lighthouseInteriorPortal = new THREE.Group();
  const portalDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.12, 1.12, 0.16, 28),
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.55,
      roughness: 0.24,
      metalness: 0.36
    })
  );
  const portalRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.38, 0.12, 12, 32),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.2 })
  );
  portalRing.rotation.x = Math.PI / 2;
  portalRing.position.y = 0.06;
  const portalCap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), brassMat);
  portalCap.position.y = 0.36;
  const portalBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.44, 2.25, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
  );
  portalBeam.position.y = 1.1;
  lighthouseInteriorPortal.add(portalDisc, portalRing, portalCap, portalBeam);
  lighthouseInteriorPortal.position.set(INTERIOR_EXIT_PORTAL_POS.x, INTERIOR_EXIT_PORTAL_POS.y, INTERIOR_EXIT_PORTAL_POS.z);
  const portalGlow = new THREE.PointLight(0x7dd3fc, 1.25, 12, 2);
  portalGlow.position.y = 0.7;
  lighthouseInteriorPortal.add(portalGlow);
  interior.add(lighthouseInteriorPortal);

  interior.visible = false;
  lighthouseInteriorGroup = interior;
  scene.add(interior);
}

function addBoat() {
  const boat = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.86 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.9 });
  const hullCore = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.72, 3.35, 14, 1), hullMat);
  hullCore.rotation.x = Math.PI / 2;
  hullCore.position.y = 0.25;
  hullCore.scale.set(1, 0.55, 1);
  hullCore.castShadow = true;
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.64, 0.88, 14), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.position.set(0, 0.24, 1.92);
  bow.castShadow = true;
  const stern = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.72, 14), hullMat);
  stern.rotation.x = -Math.PI / 2;
  stern.position.set(0, 0.24, -1.88);
  stern.castShadow = true;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.1, 2.28), new THREE.MeshStandardMaterial({ color: 0xbf7a31, roughness: 0.78 }));
  deck.position.y = 0.56;
  deck.castShadow = true;
  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.16, 0.54), trimMat);
  bench.position.set(0, 0.72, -0.2);
  bench.castShadow = true;
  const gunwaleL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 3.2), trimMat);
  gunwaleL.position.set(-0.67, 0.52, 0);
  const gunwaleR = gunwaleL.clone();
  gunwaleR.position.x = 0.67;
  const sideFillFL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.66), trimMat);
  sideFillFL.position.set(-0.56, 0.24, 1.34);
  const sideFillFR = sideFillFL.clone();
  sideFillFR.position.x = 0.56;
  const sideFillBL = sideFillFL.clone();
  sideFillBL.position.set(-0.56, 0.24, -1.34);
  const sideFillBR = sideFillBL.clone();
  sideFillBR.position.x = 0.56;
  const centerFill = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.18, 2.78), new THREE.MeshStandardMaterial({ color: 0xa1622b, roughness: 0.82 }));
  centerFill.position.y = 0.43;
  boat.add(hullCore, bow, stern, centerFill, deck, bench, gunwaleL, gunwaleR, sideFillFL, sideFillFR, sideFillBL, sideFillBR);

  const paddleMaterial = new THREE.MeshStandardMaterial({ color: 0x6b3d1f, roughness: 0.84 });
  function createPaddle(side = 1) {
    const pivot = new THREE.Group();
    pivot.position.set(0.78 * side, 0.66, -0.08);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 8), paddleMaterial);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = 0.46 * side;
    shaft.castShadow = true;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.24), paddleMaterial);
    blade.position.x = 1.04 * side;
    blade.castShadow = true;
    pivot.add(shaft, blade);
    return pivot;
  }
  const paddleLeftPivot = createPaddle(-1);
  const paddleRightPivot = createPaddle(1);
  boat.add(paddleLeftPivot, paddleRightPivot);
  boat.position.set(boatState.x, boatState.y, boatState.z);
  scene.add(boat);
  boatState.mesh = boat;
  boatState.paddleLeftPivot = paddleLeftPivot;
  boatState.paddleRightPivot = paddleRightPivot;
}

function addDecorBoat(x, z, yaw = 0, scale = 1.9, y = 1.06) {
  const boat = new THREE.Group();
  boat.position.set(x, y, z);
  boat.rotation.y = yaw;
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x744521, roughness: 0.87 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.9 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.3 * scale, 0.82 * scale, 7.4 * scale), hullMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  boat.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.15 * scale, 2.1 * scale, 14), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.position.z = 4.15 * scale;
  bow.castShadow = true;
  boat.add(bow);

  const stern = new THREE.Mesh(new THREE.BoxGeometry(2.1 * scale, 0.58 * scale, 1.5 * scale), trimMat);
  stern.position.z = -3.7 * scale;
  stern.position.y = 0.12 * scale;
  stern.castShadow = true;
  boat.add(stern);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.11 * scale, 2.9 * scale, 8), trimMat);
  mast.position.y = 1.95 * scale;
  mast.castShadow = true;
  boat.add(mast);

  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7 * scale, 1.25 * scale),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85, side: THREE.DoubleSide })
  );
  sail.position.set(0.86 * scale, 2.0 * scale, 0);
  sail.rotation.y = Math.PI / 2;
  boat.add(sail);

  scene.add(boat);
}

function createHouseWindow(w, h) {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8ecae6,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.45
  });
  const sillMat = new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.88 });
  const frameT = 0.09;
  const glassInset = 0.03;
  // Frame pieces
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(w + frameT * 2, frameT, frameT * 1.6), frameMat);
  topFrame.position.y = h * 0.5;
  const bottomFrame = topFrame.clone();
  bottomFrame.position.y = -h * 0.5;
  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(frameT, h, frameT * 1.6), frameMat);
  leftFrame.position.x = -w * 0.5;
  const rightFrame = leftFrame.clone();
  rightFrame.position.x = w * 0.5;
  // Cross bars
  const hBar = new THREE.Mesh(new THREE.BoxGeometry(w, frameT * 0.7, frameT * 1.2), frameMat);
  const vBar = new THREE.Mesh(new THREE.BoxGeometry(frameT * 0.7, h, frameT * 1.2), frameMat);
  // Glass pane
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - frameT, h - frameT, glassInset), glassMat);
  glass.position.z = glassInset * 0.5;
  // Window sill
  const sill = new THREE.Mesh(new THREE.BoxGeometry(w + frameT * 4, 0.08, 0.22), sillMat);
  sill.position.set(0, -h * 0.5 - 0.06, 0.12);
  // Shutters
  const shutterMat = new THREE.MeshStandardMaterial({ color: 0x2d5016, roughness: 0.82 });
  const shutterW = w * 0.52;
  const shutterH = h + 0.1;
  const shutterT = 0.06;
  const leftShutter = new THREE.Mesh(new THREE.BoxGeometry(shutterW, shutterH, shutterT), shutterMat);
  leftShutter.position.set(-w * 0.5 - shutterW * 0.5 - 0.02, 0, -0.02);
  const rightShutter = new THREE.Mesh(new THREE.BoxGeometry(shutterW, shutterH, shutterT), shutterMat);
  rightShutter.position.set(w * 0.5 + shutterW * 0.5 + 0.02, 0, -0.02);
  group.add(topFrame, bottomFrame, leftFrame, rightFrame, hBar, vBar, glass, sill, leftShutter, rightShutter);
  return group;
}

// Shop building functions
function createVendorShop(x, z, yaw = 0, options = {}) {
  const shop = new THREE.Group();
  shop.position.set(x, 1.35, z);
  shop.rotation.y = yaw;
  const vendor = options?.vendor || null;
  
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.88 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4e3423, roughness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.92 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3f2510, roughness: 0.82 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.85 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.84 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.92 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.8 });
  
  const shopScale = 1.0;
  const shopW = 7.0 * shopScale;
  const shopD = 5.0 * shopScale;
  const wallH = 3.5 * shopScale;
  const wallT = 0.18;
  const doorW = 1.5 * shopScale;
  const doorH = 2.2 * shopScale;
  
  // Shop counter
  const counter = new THREE.Mesh(new THREE.BoxGeometry(shopW, 0.3, 0.8), counterMat);
  counter.position.set(0, 0.15, -shopD * 0.3);
  shop.add(counter);
  
  // Shop shelves
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(shopW * 0.8, 0.1, 0.05), shelfMat);
  shelf.position.set(0, wallH * 0.3, -shopD * 0.3);
  shop.add(shelf);
  
  // Shop floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(shopW, 0.2, shopD), wallMat);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  shop.add(floor);
  
  // Back wall
  const back = new THREE.Mesh(new THREE.BoxGeometry(shopW, wallH, wallT), wallMat);
  back.position.set(0, wallH * 0.5 + 0.1, -shopD * 0.5 + wallT * 0.5);
  shop.add(back);
  
  // Side walls
  const left = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, shopD), wallMat);
  left.position.set(-shopW * 0.5 + wallT * 0.5, wallH * 0.5 + 0.1, 0);
  shop.add(left);
  const right = left.clone();
  right.position.x = shopW * 0.5 - wallT * 0.5;
  shop.add(right);
  
  // Front wall with door
  const frontSideW = (shopW - doorW) * 0.5;
  const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSideW, wallH, wallT), wallMat);
  frontLeft.position.set(-(doorW * 0.5 + frontSideW * 0.5), wallH * 0.5 + 0.1, shopD * 0.5 - wallT * 0.5);
  shop.add(frontLeft);
  const frontRight = frontLeft.clone();
  frontRight.position.x = -frontLeft.position.x;
  shop.add(frontRight);
  const frontTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, wallH - doorH, wallT), wallMat);
  frontTop.position.set(0, doorH + (wallH - doorH) * 0.5 + 0.1, shopD * 0.5 - wallT * 0.5);
  shop.add(frontTop);
  
  // Door panel
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.12, doorH - 0.08, 0.08), doorMat);
  doorPanel.position.set(0, doorH * 0.5 + 0.04, shopD * 0.5 + 0.04);
  shop.add(doorPanel);
  
  // Shop sign
  const sign = new THREE.Mesh(new THREE.BoxGeometry(shopW * 0.8, 0.2, 0.05), signMat);
  sign.position.set(0, wallH * 0.9, shopD * 0.5 + 0.1);
  shop.add(sign);
  
  // Canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(shopW * 1.2, 0.2, shopD * 0.6), canopyMat);
  canopy.position.set(0, wallH + 0.1, -shopD * 0.3);
  shop.add(canopy);

  if (vendor) {
    vendor.position.set(0, 0.1, -1.9);
    shop.add(vendor);
  }
  
  return shop;
}

function createMarketStall(x, z, yaw = 0, options = {}) {
  const stall = new THREE.Group();
  stall.position.set(x, 1.35, z);
  stall.rotation.y = yaw;
  
  const stallMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.88 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.92 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.85 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.84 });
  
  const stallScale = 1.0;
  const stallW = 6.0 * stallScale;
  const stallD = 4.0 * stallScale;
  const wallH = 2.5 * stallScale;
  const wallT = 0.15;
  
  // Stall counter
  const counter = new THREE.Mesh(new THREE.BoxGeometry(stallW, 0.25, 0.6), counterMat);
  counter.position.set(0, 0.125, -stallD * 0.2);
  stall.add(counter);
  
  // Stall shelves
  const shelf1 = new THREE.Mesh(new THREE.BoxGeometry(stallW * 0.7, 0.08, 0.04), shelfMat);
  shelf1.position.set(0, wallH * 0.25, -stallD * 0.2);
  stall.add(shelf1);
  const shelf2 = shelf1.clone();
  shelf2.position.y = wallH * 0.5;
  stall.add(shelf2);
  
  // Stall canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(stallW * 1.1, 0.15, stallD * 0.8), canopyMat);
  canopy.position.set(0, wallH + 0.1, -stallD * 0.2);
  stall.add(canopy);
  
  // Stall floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(stallW, 0.15, stallD), stallMat);
  floor.position.y = 0.075;
  floor.receiveShadow = true;
  stall.add(floor);
  
  return stall;
}

function addWoodHouse(x, z, yaw = 0, options = {}) {
  const collisions = options?.collisions !== false;
  const house = new THREE.Group();
  house.position.set(x, 1.35, z);
  house.rotation.y = yaw;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x7b4f2d, roughness: 0.88 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4e3423, roughness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.92 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3f2510, roughness: 0.82 });

  const houseScale = 1.18;
  const houseW = 9.4 * houseScale;
  const houseD = 8.0 * houseScale;
  const wallH = 3.2 * houseScale;
  const wallT = 0.22;
  const doorW = 1.9 * houseScale;
  const doorH = 2.45 * houseScale;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(houseW, 0.2, houseD), wallMat);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  house.add(floor);

  const back = new THREE.Mesh(new THREE.BoxGeometry(houseW, wallH, wallT), wallMat);
  back.position.set(0, wallH * 0.5 + 0.1, -houseD * 0.5 + wallT * 0.5);
  const left = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, houseD), wallMat);
  left.position.set(-houseW * 0.5 + wallT * 0.5, wallH * 0.5 + 0.1, 0);
  const right = left.clone();
  right.position.x = houseW * 0.5 - wallT * 0.5;

  const frontSideW = (houseW - doorW) * 0.5;
  const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSideW, wallH, wallT), wallMat);
  frontLeft.position.set(-(doorW * 0.5 + frontSideW * 0.5), wallH * 0.5 + 0.1, houseD * 0.5 - wallT * 0.5);
  const frontRight = frontLeft.clone();
  frontRight.position.x = -frontLeft.position.x;
  const frontTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, wallH - doorH, wallT), wallMat);
  frontTop.position.set(0, doorH + (wallH - doorH) * 0.5 + 0.1, houseD * 0.5 - wallT * 0.5);

  house.add(back, left, right, frontLeft, frontRight, frontTop);

  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.14, doorH - 0.08, 0.08), doorMat);
  doorPanel.position.set(0, doorH * 0.5 + 0.04, houseD * 0.5 + 0.04);
  house.add(doorPanel);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.8 });
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), handleMat);
  handle.position.set(doorW * 0.28, doorH * 0.48, houseD * 0.5 + 0.12);
  house.add(handle);

  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.24, 0.12, 0.12), trimMat);
  frameTop.position.set(0, doorH + 0.16, houseD * 0.5 + 0.02);
  const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, doorH, 0.12), trimMat);
  frameLeft.position.set(-doorW * 0.5 - 0.06, doorH * 0.5 + 0.1, houseD * 0.5 + 0.02);
  const frameRight = frameLeft.clone();
  frameRight.position.x = doorW * 0.5 + 0.06;
  house.add(frameTop, frameLeft, frameRight);

  const winW = 1.4;
  const winH = 1.5;
  const winY = wallH * 0.5 + 0.35;
  const leftWin1 = createHouseWindow(winW, winH);
  leftWin1.position.set(-houseW * 0.5 - 0.02, winY, -houseD * 0.22);
  leftWin1.rotation.y = -Math.PI * 0.5;
  const leftWin2 = createHouseWindow(winW, winH);
  leftWin2.position.set(-houseW * 0.5 - 0.02, winY, houseD * 0.22);
  leftWin2.rotation.y = -Math.PI * 0.5;
  house.add(leftWin1, leftWin2);

  const rightWin1 = createHouseWindow(winW, winH);
  rightWin1.position.set(houseW * 0.5 + 0.02, winY, -houseD * 0.22);
  rightWin1.rotation.y = Math.PI * 0.5;
  const rightWin2 = createHouseWindow(winW, winH);
  rightWin2.position.set(houseW * 0.5 + 0.02, winY, houseD * 0.22);
  rightWin2.rotation.y = Math.PI * 0.5;
  house.add(rightWin1, rightWin2);

  const backWin = createHouseWindow(2.0, winH);
  backWin.position.set(0, winY, -houseD * 0.5 - 0.02);
  backWin.rotation.y = Math.PI;
  house.add(backWin);

  const frontWin1 = createHouseWindow(1.1, 1.2);
  frontWin1.position.set(-(doorW * 0.5 + frontSideW * 0.5), winY, houseD * 0.5 + 0.02);
  house.add(frontWin1);
  const frontWin2 = createHouseWindow(1.1, 1.2);
  frontWin2.position.set((doorW * 0.5 + frontSideW * 0.5), winY, houseD * 0.5 + 0.02);
  house.add(frontWin2);

  const postSize = 0.18;
  const postH = wallH + 0.16;
  const corners = [
    [-houseW * 0.5, -houseD * 0.5],
    [houseW * 0.5, -houseD * 0.5],
    [-houseW * 0.5, houseD * 0.5],
    [houseW * 0.5, houseD * 0.5]
  ];
  for (const [cx, cz] of corners) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(postSize, postH, postSize), trimMat);
    post.position.set(cx, postH * 0.5 + 0.1, cz);
    post.castShadow = true;
    house.add(post);
  }

  const foundationH = 0.28;
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(houseW + 0.3, foundationH, houseD + 0.3),
    stoneMat
  );
  foundation.position.y = 0.14 - foundationH * 0.5 + 0.12;
  foundation.receiveShadow = true;
  house.add(foundation);

  const eave = new THREE.Mesh(
    new THREE.BoxGeometry(houseW + 0.12, 0.12, houseD + 0.12),
    trimMat
  );
  eave.position.set(0, wallH + 0.12, 0);
  eave.castShadow = true;
  eave.receiveShadow = true;

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(houseW, houseD) * 0.68, 2.45 * houseScale, 4),
    roofMat
  );
  roof.position.set(0, wallH + 1.34 * houseScale, 0);
  roof.rotation.y = Math.PI * 0.25;
  roof.castShadow = true;
  roof.receiveShadow = true;

  const roofPeak = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1 * houseScale, 0.14 * houseScale, 0.46 * houseScale, 8),
    trimMat
  );
  roofPeak.position.set(0, wallH + 2.74 * houseScale, 0);
  roofPeak.castShadow = true;
  roofPeak.receiveShadow = true;

  house.add(eave, roof, roofPeak);

  const chimneyW = 0.7;
  const chimneyD = 0.7;
  const chimneyH = 2.8;
  const chimneyBase = new THREE.Group();
  const chimneyBody = new THREE.Mesh(new THREE.BoxGeometry(chimneyW, chimneyH, chimneyD), brickMat);
  chimneyBody.castShadow = true;
  chimneyBase.add(chimneyBody);
  const chimneyCap = new THREE.Mesh(
    new THREE.BoxGeometry(chimneyW + 0.2, 0.12, chimneyD + 0.2),
    stoneMat
  );
  chimneyCap.position.y = chimneyH * 0.5 + 0.06;
  chimneyCap.castShadow = true;
  chimneyBase.add(chimneyCap);
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(chimneyW + 0.04, 0.06, chimneyD + 0.04),
      stoneMat
    );
    band.position.y = -chimneyH * 0.5 + 0.5 + i * 0.7;
    chimneyBase.add(band);
  }
  chimneyBase.position.set(houseW * 0.22, wallH + 1.6, -houseD * 0.15);
  house.add(chimneyBase);

  const porchDepth = 2.2;
  const porchW = doorW + 2.4;
  const porchFloor = new THREE.Mesh(
    new THREE.BoxGeometry(porchW, 0.14, porchDepth),
    new THREE.MeshStandardMaterial({ color: 0x6b5340, roughness: 0.88 })
  );
  porchFloor.position.set(0, 0.02, houseD * 0.5 + porchDepth * 0.5 - 0.05);
  porchFloor.receiveShadow = true;
  house.add(porchFloor);
  const porchRoof = new THREE.Mesh(
    new THREE.BoxGeometry(porchW + 0.3, 0.1, porchDepth + 0.2),
    roofMat
  );
  porchRoof.position.set(0, doorH + 0.5, houseD * 0.5 + porchDepth * 0.5 - 0.05);
  porchRoof.castShadow = true;
  house.add(porchRoof);
  const porchPostH = doorH + 0.35;
  const porchPostPositions = [
    [-porchW * 0.5 + 0.12, 0, houseD * 0.5 + porchDepth - 0.15],
    [porchW * 0.5 - 0.12, 0, houseD * 0.5 + porchDepth - 0.15]
  ];
  for (const [px, py, pz] of porchPostPositions) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, porchPostH, 8),
      trimMat
    );
    post.position.set(px, porchPostH * 0.5 + 0.1, pz);
    post.castShadow = true;
    house.add(post);
    const postBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.18, 0.28),
      stoneMat
    );
    postBase.position.set(px, 0.12, pz);
    house.add(postBase);
  }
  const stepW = porchW * 0.6;
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(stepW, 0.12, 0.35),
      stoneMat
    );
    step.position.set(0, -0.06 - i * 0.12, houseD * 0.5 + porchDepth + 0.15 + i * 0.35);
    step.receiveShadow = true;
    house.add(step);
  }
  const railH = 0.7;
  const railMat = trimMat;
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, railH, porchDepth - 0.3),
      railMat
    );
    rail.position.set(side * (porchW * 0.5 - 0.12), railH * 0.5 + 0.14, houseD * 0.5 + porchDepth * 0.5 - 0.05);
    house.add(rail);
    const topBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.06, porchDepth - 0.3),
      railMat
    );
    topBar.position.set(side * (porchW * 0.5 - 0.12), railH + 0.18, houseD * 0.5 + porchDepth * 0.5 - 0.05);
    house.add(topBar);
  }

  const flowerBoxMat = new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.85 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.7 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 });
  const boxPositions = [
    [-(doorW * 0.5 + frontSideW * 0.5), winY - winH * 0.5 - 0.28, houseD * 0.5 + 0.22],
    [(doorW * 0.5 + frontSideW * 0.5), winY - winH * 0.5 - 0.28, houseD * 0.5 + 0.22]
  ];
  for (const [bx, by, bz] of boxPositions) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 0.22), flowerBoxMat);
    box.position.set(bx, by, bz);
    house.add(box);
    for (let fi = 0; fi < 4; fi++) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), flowerMat);
      flower.position.set(bx - 0.4 + fi * 0.26, by + 0.16, bz);
      house.add(flower);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 4), leafMat);
      stem.position.set(bx - 0.4 + fi * 0.26, by + 0.07, bz);
      house.add(stem);
    }
  }

  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(houseW * 0.6 - i * 1.2, 0.04, 0.04),
      ridgeMat
    );
    const ridgeY = wallH + 0.6 + i * 0.9;
    ridge.position.set(0, ridgeY, houseD * 0.25 - i * 0.15);
    house.add(ridge);
    const ridge2 = ridge.clone();
    ridge2.position.z = -(houseD * 0.25 - i * 0.15);
    house.add(ridge2);
  }

  house.children.forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
  });
  scene.add(house);
  if (collisions) {
    addWallCollisionFromMesh(back, 'house');
    addWallCollisionFromMesh(left, 'house');
    addWallCollisionFromMesh(right, 'house');
    addWallCollisionFromMesh(frontLeft, 'house');
    addWallCollisionFromMesh(frontRight, 'house');
    addWallCollisionFromMesh(frontTop, 'house');
  }
}

function addStoreBuilding(x, z, yaw = 0, options = {}) {
  const collisions = options?.collisions !== false;
  const store = new THREE.Group();
  store.position.set(x, 1.35, z);
  store.rotation.y = yaw;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
  const awningMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.8 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.2, metalness: 0.1 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5a, roughness: 0.7 });

  const storeScale = 1.5;
  const storeW = 7.2 * storeScale;
  const storeD = 5.8 * storeScale;
  const wallH = 4.2 * storeScale;
  const wallT = 0.28;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(storeW, 0.15, storeD), trimMat);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  store.add(floor);

  const back = new THREE.Mesh(new THREE.BoxGeometry(storeW, wallH, wallT), wallMat);
  back.position.set(0, wallH * 0.5 + 0.1, -storeD * 0.5 + wallT * 0.5);
  store.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, storeD), wallMat);
  left.position.set(-storeW * 0.5 + wallT * 0.5, wallH * 0.5 + 0.1, 0);
  store.add(left);

  const right = left.clone();
  right.position.x = storeW * 0.5 - wallT * 0.5;
  store.add(right);

  const frontWallH = wallH * 0.7;
  const doorW = 2.2 * storeScale;
  const doorH = 3.1 * storeScale;
  const sideWallW = (storeW - doorW) * 0.5;

  const frontWallLeft = new THREE.Mesh(new THREE.BoxGeometry(sideWallW, frontWallH, wallT), wallMat);
  frontWallLeft.position.set(-(doorW * 0.5 + sideWallW * 0.5), frontWallH * 0.5 + 0.1, storeD * 0.5 - wallT * 0.5);
  store.add(frontWallLeft);
  const frontWallRight = frontWallLeft.clone();
  frontWallRight.position.x = doorW * 0.5 + sideWallW * 0.5;
  store.add(frontWallRight);

  const doorTopH = frontWallH - doorH;
  const doorTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorTopH, wallT), wallMat);
  doorTop.position.set(0, doorH + doorTopH * 0.5 + 0.1, storeD * 0.5 - wallT * 0.5);
  store.add(doorTop);

  const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.85 });
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.16, doorH - 0.1, 0.1), doorMat);
  doorPanel.position.set(0, doorH * 0.5 + 0.1, storeD * 0.5 + 0.04);
  store.add(doorPanel);

  const handleMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.8 });
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), handleMat);
  handle.position.set(doorW * 0.32, doorH * 0.56, storeD * 0.5 + 0.14);
  store.add(handle);

  const upperFrontWallH = wallH * 0.35;
  const upperFrontWallLeft = new THREE.Mesh(new THREE.BoxGeometry(sideWallW, upperFrontWallH, wallT), wallMat);
  upperFrontWallLeft.position.set(-(doorW * 0.5 + sideWallW * 0.5), frontWallH + upperFrontWallH * 0.5 + 0.1, storeD * 0.5 - wallT * 0.5);
  store.add(upperFrontWallLeft);
  const upperFrontWallRight = upperFrontWallLeft.clone();
  upperFrontWallRight.position.x = doorW * 0.5 + sideWallW * 0.5;
  store.add(upperFrontWallRight);
  const upperFrontWallCenter = new THREE.Mesh(new THREE.BoxGeometry(doorW, upperFrontWallH, wallT), wallMat);
  upperFrontWallCenter.position.set(0, frontWallH + upperFrontWallH * 0.5 + 0.1, storeD * 0.5 - wallT * 0.5);
  store.add(upperFrontWallCenter);

  const windowW = 2.8;
  const windowH = 2.3;
  const windowY = wallH * 0.42;
  const windowX = storeW * 0.3;
  const window1 = new THREE.Mesh(new THREE.BoxGeometry(windowW, windowH, 0.1), windowMat);
  window1.position.set(-windowX, windowY, storeD * 0.5 + 0.04);
  store.add(window1);
  const window2 = window1.clone();
  window2.position.x = windowX;
  store.add(window2);

  const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x5c4a38, roughness: 0.85 });
  const winFrameT = 0.08;
  for (const wx of [-windowX, windowX]) {
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(winFrameT, windowH + 0.2, 0.14), windowFrameMat);
    frameL.position.set(wx - windowW * 0.5 - winFrameT * 0.5, windowY, storeD * 0.5 + 0.1);
    store.add(frameL);
    const frameR = frameL.clone();
    frameR.position.x = wx + windowW * 0.5 + winFrameT * 0.5;
    store.add(frameR);
    const frameT = new THREE.Mesh(new THREE.BoxGeometry(windowW + winFrameT * 2, winFrameT, 0.14), windowFrameMat);
    frameT.position.set(wx, windowY + windowH * 0.5 + winFrameT * 0.5, storeD * 0.5 + 0.1);
    store.add(frameT);
    const frameB = frameT.clone();
    frameB.position.y = windowY - windowH * 0.5 - winFrameT * 0.5;
    store.add(frameB);
  }
  const windowCrossMat = windowFrameMat;
  for (const wx of [-windowX, windowX]) {
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(windowW - 0.2, 0.05, 0.12), windowCrossMat);
    crossH.position.set(wx, windowY, storeD * 0.5 + 0.1);
    store.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.05, windowH - 0.2, 0.12), windowCrossMat);
    crossV.position.set(wx, windowY, storeD * 0.5 + 0.1);
    store.add(crossV);
  }

  const awningW = storeW * 0.85;
  const awningD = 2.6;
  const awningH = 0.16;
  const awningBackY = wallH * 0.99;
  const awningFrontY = awningBackY - 0.26;
  const awningMidY = (awningBackY + awningFrontY) / 2;
  const awningOut = storeD * 0.5 + 0.92;

  const awningGeo = new THREE.BoxGeometry(awningW, awningH, awningD);
  const awningSlanted = new THREE.Mesh(awningGeo, awningMat);
  awningSlanted.rotation.x = -0.22;
  awningSlanted.position.set(0, awningMidY, awningOut);
  awningSlanted.castShadow = true;
  store.add(awningSlanted);

  for (let i = 0; i < 6; i++) {
    const stripeGeo = new THREE.BoxGeometry(awningW * 0.15, awningH + 0.02, awningD * 0.95);
    const stripeMat = i % 2 === 0 ? awningMat : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -0.22;
    stripe.position.set(-awningW * 0.43 + i * awningW * 0.175, awningMidY, awningOut);
    stripe.castShadow = true;
    store.add(stripe);
  }

  const supportMat = new THREE.MeshStandardMaterial({ color: 0x5c4a38, roughness: 0.85 });
  const supportH = Math.max(0.4, awningBackY - 1.9);
  const supportY = awningBackY - supportH * 0.5;
  const supportZ = awningOut - awningD * 0.45;
  for (const sx of [-awningW * 0.42, awningW * 0.42]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, supportH, 8), supportMat);
    post.position.set(sx, supportY, supportZ);
    post.castShadow = true;
    store.add(post);
  }
  const brace = new THREE.Mesh(new THREE.BoxGeometry(awningW * 0.9, 0.06, 0.06), supportMat);
  brace.position.set(0, supportY + supportH * 0.48, supportZ - 0.02);
  store.add(brace);
  const frontFaceZ = storeD * 0.5 - wallT * 0.5 + 0.02;
  const braceLen = awningOut - frontFaceZ + 0.24;
  for (const sx of [-awningW * 0.36, awningW * 0.36]) {
    const diag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, braceLen), supportMat);
    diag.rotation.x = -0.55;
    diag.position.set(sx, awningBackY - 0.35, frontFaceZ + braceLen * 0.5 - 0.1);
    diag.castShadow = true;
    store.add(diag);
  }

  // Removed plain sign slab to avoid a blank panel on storefronts.

  const postSize = 0.22;
  const postH = wallH + 0.15;
  const corners = [
    [-storeW * 0.5, -storeD * 0.5],
    [storeW * 0.5, -storeD * 0.5]
  ];
  for (const [cx, cz] of corners) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(postSize, postH, postSize), trimMat);
    post.position.set(cx, postH * 0.5 + 0.1, cz);
    post.castShadow = true;
    store.add(post);
  }

  const foundationH = 0.35;
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(storeW + 0.32, foundationH, storeD + 0.32),
    trimMat
  );
  foundation.position.y = 0.11 - foundationH * 0.5 + 0.1;
  foundation.receiveShadow = true;
  store.add(foundation);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(storeW + 0.14, 0.22, storeD + 0.14),
    roofMat
  );
  roof.position.set(0, wallH + 0.07, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  store.add(roof);

  store.children.forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
  });
  scene.add(store);
  if (collisions) {
    addWallCollisionFromMesh(back, 'store');
    addWallCollisionFromMesh(left, 'store');
    addWallCollisionFromMesh(right, 'store');
  }
}

function addCliffAndWaterfall(x, z) {
  const cliff = new THREE.Group();
  cliff.position.set(x, 0, z);
  cliff.scale.setScalar(0.84);
  const cliffRockMeshes = [];
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x586069, roughness: 0.93 });
  const faceMat = new THREE.MeshStandardMaterial({ color: 0x5f6872, roughness: 0.9 });
  const mainRock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(4.8, 0),
    rockMat
  );
  mainRock.position.set(0, 3.6, 0);
  mainRock.scale.set(2.6, 1.7, 2.0);
  mainRock.castShadow = true;
  mainRock.receiveShadow = true;
  cliff.add(mainRock);
  cliffRockMeshes.push(mainRock);

  for (let i = 0; i < 11; i += 1) {
    let rx = (Math.random() - 0.5) * 7.6;
    let rz = (Math.random() - 0.5) * 3.7;
    // Keep front faces clearer so waterfall stays visible.
    if ((rx < 0 && rz < 1.2) || (rz > 0.1 && Math.abs(rx) < 2.2)) {
      rx += 1.8;
      rz -= 1.2;
    }
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(3.1 + Math.random() * 1.8, 0),
      rockMat
    );
    rock.position.set(rx, 2.25 + Math.random() * 2.1, rz);
    rock.scale.set(2.55, 1.45 + Math.random() * 0.95, 2.0);
    rock.castShadow = true;
    rock.receiveShadow = true;
    cliff.add(rock);
    cliffRockMeshes.push(rock);
  }

  const makeWaterfallFace = (localX, localY, localZ, yaw, w = 3.4, h = 8.6) => {
    const normalX = Math.sin(yaw);
    const normalZ = Math.cos(yaw);
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.65, h + 0.9, 0.7),
      faceMat
    );
    face.position.set(localX, localY, localZ);
    face.rotation.y = yaw;
    face.castShadow = true;
    face.receiveShadow = true;
    cliff.add(face);

    const stream = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.92),
      new THREE.MeshBasicMaterial({
        color: 0x2ea9ff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: false
      })
    );
    // Slight outward offset; thickness keeps it visible from both camera sides.
    stream.position.set(
      localX + normalX * 0.16,
      localY - 0.12,
      localZ + normalZ * 0.16
    );
    stream.rotation.y = yaw;
    stream.renderOrder = 20;
    cliff.add(stream);

    const streakMat = new THREE.MeshBasicMaterial({
      color: 0xeaf7ff,
      transparent: true,
      opacity: 0.92,
      depthTest: true,
      depthWrite: false
    });
    for (let i = 0; i < 11; i += 1) {
      const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.0 + Math.random() * 0.9), streakMat);
      streak.position.set(
        (Math.random() - 0.5) * (w - 0.6),
        (Math.random() - 0.5) * (h - 0.8),
        0.02
      );
      stream.add(streak);
    }

    const foam = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 18),
      new THREE.MeshBasicMaterial({
        color: 0xe8f7ff,
        transparent: true,
        opacity: 0.74,
        depthTest: true,
        depthWrite: false
      })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(
      localX + normalX * 0.42,
      0.1,
      localZ + normalZ * 0.42
    );
    foam.renderOrder = 21;
    cliff.add(foam);
  };

  // Main waterfall: one-sided and only visible from the requested front angle.
  const guaranteedFall = new THREE.Group();
  // Centered on the target rock face, with face-matching yaw.
  const guaranteedYaw = -0.62;
  guaranteedFall.position.set(2.45, 4.28, 2.25);
  guaranteedFall.rotation.y = guaranteedYaw + Math.PI;
  const guaranteedFlowTexture = createWaterfallFlowTexture();
  const guaranteedSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 9.3),
    new THREE.MeshBasicMaterial({
      color: 0xa8e8ff,
      map: guaranteedFlowTexture,
      transparent: true,
      opacity: 0.9,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false
    })
  );
  // Keep waterfall attached just outside the cliff face (not inside).
  guaranteedSheet.position.z = 6;
  guaranteedSheet.renderOrder = 40;
  guaranteedFall.add(guaranteedSheet);

  const guaranteedCoreTexture = guaranteedFlowTexture.clone();
  guaranteedCoreTexture.repeat.set(0.62, 2.15);
  guaranteedCoreTexture.offset.x = 0.19;
  const guaranteedCoreSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 9.1),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: guaranteedCoreTexture,
      transparent: true,
      opacity: 0.42,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  guaranteedCoreSheet.position.set(0, 0.05, 6.04);
  guaranteedCoreSheet.renderOrder = 41;
  guaranteedFall.add(guaranteedCoreSheet);

  const edgeVeils = [];
  for (const side of [-1, 1]) {
    const edgeTexture = guaranteedFlowTexture.clone();
    edgeTexture.repeat.set(0.34, 2.15);
    edgeTexture.offset.x = side < 0 ? 0.03 : 0.63;
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(1.55, 9.0),
      new THREE.MeshBasicMaterial({
        color: 0xc9f2ff,
        map: edgeTexture,
        transparent: true,
        opacity: 0.36,
        side: THREE.FrontSide,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    veil.position.set(side * 2.72, -0.02, 6.03);
    veil.rotation.y = side * 0.14;
    veil.renderOrder = 41;
    guaranteedFall.add(veil);
    edgeVeils.push(veil);
  }

  const guaranteedStreakMat = new THREE.MeshBasicMaterial({
    color: 0xeaf7ff,
    transparent: true,
    opacity: 0.92,
    side: THREE.FrontSide,
    depthTest: false,
    depthWrite: false
  });
  const guaranteedStreaks = [];
  for (let i = 0; i < 24; i += 1) {
    const minY = -4.3;
    const maxY = 4.2;
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09 + Math.random() * 0.08, 1.3 + Math.random() * 1.9),
      guaranteedStreakMat
    );
    streak.position.set((Math.random() - 0.5) * 5.4, THREE.MathUtils.lerp(minY, maxY, Math.random()), 6.06 + Math.random() * 0.03);
    streak.userData.baseX = streak.position.x;
    streak.userData.minY = minY;
    streak.userData.maxY = maxY;
    streak.userData.speed = 2.3 + Math.random() * 2.2;
    streak.userData.swayPhase = Math.random() * Math.PI * 2;
    streak.userData.swayAmp = 0.03 + Math.random() * 0.07;
    streak.renderOrder = 41;
    guaranteedFall.add(streak);
    guaranteedStreaks.push(streak);
  }
  cliff.add(guaranteedFall);

  const guaranteedLipFoam = new THREE.Mesh(
    new THREE.PlaneGeometry(6.05, 0.42),
    new THREE.MeshBasicMaterial({
      color: 0xf4fcff,
      transparent: true,
      opacity: 0.58,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false
    })
  );
  guaranteedLipFoam.position.set(0, 4.58, 5.98);
  guaranteedLipFoam.renderOrder = 43;
  guaranteedFall.add(guaranteedLipFoam);

  const guaranteedFoam = new THREE.Mesh(
    new THREE.CircleGeometry(3.1, 24, Math.PI, Math.PI),
    new THREE.MeshBasicMaterial({
      color: 0xe9f8ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false
    })
  );
  guaranteedFoam.rotation.x = -Math.PI / 2;
  guaranteedFoam.rotation.z = 0;
  // Put foam at the middle/base of the waterfall and match its width.
  guaranteedFoam.position.set(0, -4.55, 6);
  guaranteedFoam.renderOrder = 42;
  guaranteedFall.add(guaranteedFoam);

  const splashDrops = [];
  const splashGroup = new THREE.Group();
  splashGroup.position.set(0, -4.5, 6.08);
  for (let i = 0; i < 18; i += 1) {
    const drop = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({
        color: 0xf2fbff,
        transparent: true,
        opacity: 0.5,
        side: THREE.FrontSide,
        depthTest: false,
        depthWrite: false
      })
    );
    drop.userData.phase = Math.random();
    drop.userData.speed = 0.9 + Math.random() * 1.2;
    drop.userData.angle = Math.random() * Math.PI * 2;
    drop.userData.radius = 0.2 + Math.random() * 0.3;
    drop.userData.spread = 0.38 + Math.random() * 0.42;
    drop.userData.lift = 0.14 + Math.random() * 0.28;
    splashGroup.add(drop);
    splashDrops.push(drop);
  }
  guaranteedFall.add(splashGroup);

  const mistCurtain = new THREE.Mesh(
    new THREE.PlaneGeometry(6.45, 1.85),
    new THREE.MeshBasicMaterial({
      color: 0xe6f7ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false
    })
  );
  mistCurtain.position.set(0, -4.03, 6.26);
  mistCurtain.renderOrder = 44;
  guaranteedFall.add(mistCurtain);

  const mistTexture = createWaterfallMistTexture();
  const mistCount = 72;
  const mistPositions = new Float32Array(mistCount * 3);
  const mistData = [];
  for (let i = 0; i < mistCount; i += 1) {
    const idx = i * 3;
    const side = Math.random() > 0.5 ? 1 : -1;
    mistPositions[idx] = side * (0.22 + Math.random() * 0.64);
    mistPositions[idx + 1] = Math.random() * 1.1;
    mistPositions[idx + 2] = (Math.random() - 0.5) * 0.5;
    mistData.push({
      phase: Math.random(),
      speed: 0.45 + Math.random() * 0.8,
      angle: Math.random() * Math.PI * 2,
      radius: 0.32 + Math.random() * 0.98,
      spread: 0.64 + Math.random() * 1.6,
      lift: 0.34 + Math.random() * 1.05,
      drift: 0.35 + Math.random() * 0.9
    });
  }
  const mistGeo = new THREE.BufferGeometry();
  const mistAttr = new THREE.BufferAttribute(mistPositions, 3);
  mistGeo.setAttribute('position', mistAttr);
  const mistPoints = new THREE.Points(
    mistGeo,
    new THREE.PointsMaterial({
      map: mistTexture,
      color: 0xe9f8ff,
      transparent: true,
      opacity: 0.46,
      size: 0.7,
      sizeAttenuation: true,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  mistPoints.position.set(0, -4.46, 6.16);
  mistPoints.renderOrder = 45;
  guaranteedFall.add(mistPoints);

  cliffWaterfallRoot = guaranteedFall;
  cliffWaterfallFoam = guaranteedFoam;
  cliffWaterfallState = {
    flowTexture: guaranteedFlowTexture,
    coreTexture: guaranteedCoreTexture,
    sheet: guaranteedSheet,
    coreSheet: guaranteedCoreSheet,
    edgeVeils,
    foam: guaranteedFoam,
    lipFoam: guaranteedLipFoam,
    streaks: guaranteedStreaks,
    splashDrops,
    splashGroup,
    mistCurtain,
    mistPoints,
    mistData,
    mistAttr
  };

  scene.add(cliff);
  cliff.updateWorldMatrix(true, true);
  // Build a tighter rock footprint so collision follows the visible cliff shape.
  for (const rockMesh of cliffRockMeshes) {
    addRockFootprintCollisionFromMesh(rockMesh, 'cliff', -0.05);
  }
}

function populateMainIslandNature() {
  const palmSpots = [
    [worldLimit * 0.62, worldLimit * 0.2, 1.24],
    [worldLimit * 0.34, -worldLimit * 0.42, 1.14],
    [-worldLimit * 0.72, worldLimit * 0.3, 1.28],
    [-worldLimit * 0.16, -worldLimit * 0.56, 1.1],
    [worldLimit * 0.04, worldLimit * 0.61, 1.05]
  ];
  palmSpots.forEach(([x, z, s]) => addPalm(x, z, s));
  addBush(worldLimit * 0.44, worldLimit * 0.28, 0.74);
  addBush(-worldLimit * 0.26, worldLimit * 0.44, 0.72);
  addBush(worldLimit * 0.14, -worldLimit * 0.36, 0.7);

  for (let i = 0; i < 120; i += 1) {
    const angle = (i / 120) * Math.PI * 2;
    const radius = worldLimit * (0.1 + Math.random() * 0.78);
    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 2.8;
    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 2.8;
    addGrassTuft(x, z, 0.8 + Math.random() * 0.45, i % 3 ? 0x4f8a3f : 0x568f45);
  }
  addFlowerPatch(worldLimit * 0.22, worldLimit * 0.38, 18, 5.6);
  addFlowerPatch(-worldLimit * 0.33, worldLimit * 0.12, 16, 5.1);
  addFlowerPatch(worldLimit * 0.46, -worldLimit * 0.22, 14, 4.9);
  addFlowerPatch(-worldLimit * 0.12, -worldLimit * 0.46, 13, 4.6);
}

function createVendorNpc({
  shirtColor = 0x7c3aed,
  skinColor = 0xe0b18f,
  hairColor = 0x111827,
  hatColor = null
} = {}) {
  const npc = new THREE.Group();
  // Slightly taller than player-height silhouette so vendors stand clearly above stall surfaces.
  const npcScale = 1.95;

  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.84 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.75 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.78 });

  const legGeo = new THREE.BoxGeometry(0.16 * npcScale, 0.92 * npcScale, 0.18 * npcScale);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.13 * npcScale, 0.47 * npcScale, 0);
  const legR = legL.clone();
  legR.position.x = 0.13 * npcScale;

  const hips = new THREE.Mesh(
    new THREE.BoxGeometry(0.44 * npcScale, 0.2 * npcScale, 0.28 * npcScale),
    pantsMat
  );
  hips.position.y = 0.97 * npcScale;

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.52 * npcScale, 1.08 * npcScale, 0.32 * npcScale),
    shirtMat
  );
  torso.position.y = 1.52 * npcScale;

  const shoulders = new THREE.Mesh(
    new THREE.BoxGeometry(0.62 * npcScale, 0.15 * npcScale, 0.34 * npcScale),
    shirtMat
  );
  shoulders.position.y = 1.98 * npcScale;

  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(0.16 * npcScale, 0.12 * npcScale, 0.16 * npcScale),
    skinMat
  );
  neck.position.y = 2.08 * npcScale;

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42 * npcScale, 0.52 * npcScale, 0.42 * npcScale),
    skinMat
  );
  head.position.y = 2.32 * npcScale;

  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.46 * npcScale, 0.18 * npcScale, 0.46 * npcScale),
    hairMat
  );
  hair.position.y = 2.58 * npcScale;

  const armGeo = new THREE.BoxGeometry(0.12 * npcScale, 0.82 * npcScale, 0.14 * npcScale);
  const armL = new THREE.Mesh(armGeo, skinMat);
  armL.position.set(-0.36 * npcScale, 1.52 * npcScale, 0);
  const armR = armL.clone();
  armR.position.x = 0.36 * npcScale;

  const handGeo = new THREE.BoxGeometry(0.14 * npcScale, 0.17 * npcScale, 0.15 * npcScale);
  const handL = new THREE.Mesh(handGeo, skinMat);
  handL.position.set(-0.36 * npcScale, 1.03 * npcScale, 0);
  const handR = handL.clone();
  handR.position.x = 0.36 * npcScale;

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05 * npcScale, 0.05 * npcScale, 0.02 * npcScale), eyeMat);
  eyeL.position.set(-0.1 * npcScale, 2.35 * npcScale, 0.22 * npcScale);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1 * npcScale;
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.14 * npcScale, 0.025 * npcScale, 0.02 * npcScale), eyeMat);
  mouth.position.set(0, 2.22 * npcScale, 0.22 * npcScale);

  npc.add(
    legL, legR,
    hips, torso, shoulders, neck,
    head, hair,
    armL, armR, handL, handR,
    eyeL, eyeR, mouth
  );

  if (hatColor !== null) {
    const hat = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 * npcScale, 0.13 * npcScale, 0.5 * npcScale),
      new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.78 })
    );
    hat.position.y = 2.72 * npcScale;
    npc.add(hat);
  }

  npc.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return npc;
}

function createVendorStall({
  label = 'Shop',
  signColor = '#2d3748',
  canopyA = 0x4f46e5,
  canopyB = 0xf8fafc,
  vendor = null
} = {}) {
  const stall = new THREE.Group();
  const width = 4.6;
  const depth = 2.8;
  const postHeight = 4.05;
  const roofY = 4.36;

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1f, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2f1e14, roughness: 0.92 });

  for (const px of [-1, 1]) {
    for (const pz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, postHeight, 0.2), woodMat);
      post.position.set(px * (width * 0.5 - 0.14), postHeight * 0.5, pz * (depth * 0.5 - 0.14));
      stall.add(post);
    }
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.52, 0.16, depth + 0.34), trimMat);
  roof.position.y = roofY;
  stall.add(roof);

  const stripeCount = 6;
  for (let i = 0; i < stripeCount; i += 1) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry((width + 0.36) / stripeCount, 0.11, 0.6),
      new THREE.MeshStandardMaterial({ color: i % 2 ? canopyA : canopyB, roughness: 0.72 })
    );
    const x = -((width + 0.36) * 0.5) + (i + 0.5) * ((width + 0.36) / stripeCount);
    stripe.position.set(x, roofY - 0.14, depth * 0.5 + 0.04);
    stall.add(stripe);
  }

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(width - 0.44, 0.15, 0.78), woodMat);
  counterTop.position.set(0, 1.74, depth * 0.24);
  const counterFront = new THREE.Mesh(new THREE.BoxGeometry(width - 0.58, 0.7, 0.12), woodMat);
  counterFront.position.set(0, 1.39, depth * 0.58);
  const counterRail = new THREE.Mesh(new THREE.BoxGeometry(width - 0.2, 0.12, 0.14), trimMat);
  counterRail.position.set(0, 2.07, depth * 0.58);
  stall.add(counterTop, counterFront, counterRail);

  const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.64, depth - 0.62), woodMat);
  sideRailL.position.set(-(width * 0.5 - 0.24), 1.44, 0);
  const sideRailR = sideRailL.clone();
  sideRailR.position.x = width * 0.5 - 0.24;
  stall.add(sideRailL, sideRailR);

  const sign = makeTextSign(label, 3.28, 0.62, signColor, '#ecfeff');
  sign.position.set(0, roofY + 0.72, depth * 0.5 + 0.15);
  sign.rotation.x = -0.14;
  stall.add(sign);

  if (vendor) {
    vendor.position.set(0, 0, -0.08);
    stall.add(vendor);
  }

  stall.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return stall;
}

function addMineArea() {
  const mine = new THREE.Group();
  mine.position.set(MINE_POS.x, 0, MINE_POS.z);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(MINE_RADIUS, 68),
    new THREE.MeshStandardMaterial({ color: 0x3b3b3b, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 1.34;
  floor.receiveShadow = true;
  mine.add(floor);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(MINE_RADIUS - 2.8, MINE_RADIUS, 72),
    new THREE.MeshStandardMaterial({ color: 0x2f241a, roughness: 0.95 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 1.335;
  mine.add(ring);

  const caveShellMat = new THREE.MeshStandardMaterial({
    color: 0x151b26,
    roughness: 0.98,
    metalness: 0.02,
    side: THREE.DoubleSide
  });
  const caveWall = new THREE.Mesh(
    new THREE.CylinderGeometry(MINE_RADIUS + 5.2, MINE_RADIUS + 3.3, MINE_CEILING_Y - 1.2, 88, 1, true),
    caveShellMat
  );
  caveWall.position.y = MINE_CEILING_Y * 0.55;
  caveWall.castShadow = true;
  caveWall.receiveShadow = true;
  mine.add(caveWall);

  const caveRoof = new THREE.Mesh(
    new THREE.CircleGeometry(MINE_RADIUS + 5.4, 84),
    new THREE.MeshStandardMaterial({ color: 0x131826, roughness: 0.98, metalness: 0.02, side: THREE.DoubleSide })
  );
  caveRoof.rotation.x = Math.PI / 2;
  caveRoof.position.y = MINE_CEILING_Y;
  caveRoof.castShadow = true;
  caveRoof.receiveShadow = true;
  mine.add(caveRoof);

  for (let i = 0; i < 40; i += 1) {
    const angle = (i / 40) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
    const radius = MINE_RADIUS * (0.14 + Math.random() * 0.78);
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.42 + Math.random() * 0.82, 1.4 + Math.random() * 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x202838, roughness: 0.94 })
    );
    spike.position.set(
      Math.cos(angle) * radius,
      MINE_CEILING_Y - 0.48 - Math.random() * 1.8,
      Math.sin(angle) * radius
    );
    spike.rotation.x = Math.PI;
    spike.rotation.y = Math.random() * Math.PI * 2;
    spike.castShadow = true;
    mine.add(spike);
  }

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.9 });
  for (let i = 0; i < 48; i += 1) {
    const angle = (i / 48) * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.9 + Math.random() * 1.5, 0), rockMat);
    const radius = MINE_RADIUS - 6.8 + Math.random() * 5.4;
    rock.position.set(Math.cos(angle) * radius, 2.2 + Math.random() * 2.8, Math.sin(angle) * radius);
    rock.scale.set(1.3 + Math.random() * 1.2, 1.4 + Math.random() * 1.5, 1.3 + Math.random() * 1.2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    mine.add(rock);
  }
  const wallColliderCount = 88;
  for (let i = 0; i < wallColliderCount; i += 1) {
    const angle = (i / wallColliderCount) * Math.PI * 2;
    addWorldCollider(
      MINE_POS.x + Math.cos(angle) * MINE_ROCK_WALL_RADIUS,
      MINE_POS.z + Math.sin(angle) * MINE_ROCK_WALL_RADIUS,
      1.5,
      'mine-wall'
    );
  }

  const mineAmbient = new THREE.AmbientLight(0x8b9ec6, 0.42);
  mine.add(mineAmbient);
  const mineFillLight = new THREE.PointLight(0x8dd5ff, 1.9, MINE_RADIUS * 2.6, 2);
  mineFillLight.position.set(0, 9.8, 0);
  mine.add(mineFillLight);

  const centralCrystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.9, 0),
    new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      emissive: 0x1d4ed8,
      emissiveIntensity: 1.45,
      roughness: 0.28,
      metalness: 0.05
    })
  );
  centralCrystal.position.set(0, 3.2, 0);
  centralCrystal.rotation.y = Math.PI * 0.14;
  centralCrystal.castShadow = true;
  mine.add(centralCrystal);
  mineCentralCrystalMesh = centralCrystal;
  const centralCrystalLight = new THREE.PointLight(0x60a5fa, 2.3, 34, 2);
  centralCrystalLight.position.set(0, 3.5, 0);
  mine.add(centralCrystalLight);

  const caveLampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffd89c,
    emissive: 0x8a5d1f,
    emissiveIntensity: 1.35,
    roughness: 0.56
  });
  const caveLampStoneMat = new THREE.MeshStandardMaterial({ color: 0x303948, roughness: 0.95 });
  const caveLampCount = 10;
  const caveLampRadius = MINE_RADIUS - 9.8;
  for (let i = 0; i < caveLampCount; i += 1) {
    const angle = (i / caveLampCount) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(angle) * caveLampRadius;
    const z = Math.sin(angle) * caveLampRadius;
    const lampStone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), caveLampStoneMat);
    lampStone.position.set(x, 2.0, z);
    lampStone.castShadow = true;
    lampStone.receiveShadow = true;
    const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), caveLampBulbMat);
    lampBulb.position.set(x, 2.7, z);
    const lampLight = new THREE.PointLight(0xffca7c, 2.3, 32, 2);
    lampLight.position.set(x, 2.86, z);
    mine.add(lampStone, lampBulb, lampLight);
  }

  const exitPortal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.84, 0.12, 24),
    new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0891b2,
      emissiveIntensity: 1.2,
      roughness: 0.32
    })
  );
  exitPortal.rotation.x = -Math.PI / 2;
  exitPortal.position.set(MINE_EXIT_POS.x - MINE_POS.x, 1.42, MINE_EXIT_POS.z - MINE_POS.z);
  mine.add(exitPortal);
  mineExitMesh = exitPortal;

  const oreDefs = [
    {
      resource: 'stone',
      color: ORE_RESOURCE_COLORS.stone,
      reward: 1,
      cooldownMs: 5200,
      positions: [
        [-26, -18], [-22, -7], [-18, 11], [-12, -22], [-7, -12], [-1, 16], [6, -17], [11, 8], [16, -6], [22, 12], [28, 3], [-14, 22]
      ]
    },
    {
      resource: 'iron',
      color: ORE_RESOURCE_COLORS.iron,
      reward: 2,
      cooldownMs: 7600,
      positions: [[-24, 8], [-16, -25], [-9, -15], [-2, 24], [8, -11], [14, 4], [19, 18], [25, -12], [4, 20]]
    },
    {
      resource: 'gold',
      color: ORE_RESOURCE_COLORS.gold,
      reward: 3,
      cooldownMs: 10400,
      positions: [[-28, 15], [-12, 26], [3, 28], [14, -22], [24, 6], [20, 23], [-4, -26]]
    },
    {
      resource: 'diamond',
      color: ORE_RESOURCE_COLORS.diamond,
      reward: 1,
      cooldownMs: 15600,
      positions: [[-30, -5], [-8, 4], [0, 0], [18, 14], [30, 10]]
    }
  ];

  oreDefs.forEach((def) => {
    def.positions.forEach(([x, z], idx) => {
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(def.resource === 'diamond' ? 0.95 : 0.85, 0),
        new THREE.MeshStandardMaterial({
          color: def.color,
          emissive: def.resource === 'diamond' ? 0x0891b2 : 0x000000,
          emissiveIntensity: def.resource === 'diamond' ? 0.8 : 0
        })
      );
      mesh.position.set(x, 1.86, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mine.add(mesh);
      oreNodes.push({
        id: `${def.resource}-${idx}`,
        resource: def.resource,
        colorHex: def.color,
        reward: def.reward,
        cooldownMs: def.cooldownMs,
        mesh,
        readyAt: 0,
        baseY: 1.86,
        baseScale: 1,
        breaking: false,
        breakStartAt: 0,
        breakEndAt: 0
      });
    });
  });

  scene.add(mine);
  mineGroup = mine;
  mineGroup.visible = false;

  const mineEntrance = new THREE.Group();
  mineEntrance.position.set(MINE_ENTRY_POS.x, 0, MINE_ENTRY_POS.z);
  const rockMatOuter = new THREE.MeshStandardMaterial({ color: 0xb9a79a, roughness: 0.96 });
  const rockMatMid = new THREE.MeshStandardMaterial({ color: 0x8f7f74, roughness: 0.95 });
  const caveDarkMat = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.98 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xbb6f3b, roughness: 0.86 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x7c838f, roughness: 0.62, metalness: 0.38 });
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x8d5a34, roughness: 0.9 });

  const rockBase = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 0), rockMatOuter);
  rockBase.position.set(0, 3.8, 0.75);
  rockBase.scale.set(2.8, 2.4, 1.92);
  mineEntrance.add(rockBase);

  const rockLeft = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45, 0), rockMatMid);
  rockLeft.position.set(-2.45, 2.85, 2.45);
  rockLeft.scale.set(1.55, 1.2, 1.15);
  mineEntrance.add(rockLeft);
  const rockRight = rockLeft.clone();
  rockRight.position.x = 2.45;
  mineEntrance.add(rockRight);

  const rockBottom = new THREE.Mesh(new THREE.DodecahedronGeometry(1.55, 0), rockMatOuter);
  rockBottom.position.set(0, 1.42, 2.62);
  rockBottom.scale.set(2.1, 0.7, 1.15);
  mineEntrance.add(rockBottom);

  const caveOuter = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.7, 3.6, 16, 1, false, 0, Math.PI), caveDarkMat);
  caveOuter.rotation.y = Math.PI * 0.5;
  caveOuter.position.set(0, 3.0, 3.1);
  mineEntrance.add(caveOuter);

  const caveVoid = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.8),
    new THREE.MeshBasicMaterial({ color: 0x0b0f17, side: THREE.DoubleSide })
  );
  caveVoid.position.set(0, 2.95, 3.9);
  mineEntrance.add(caveVoid);

  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.27, 3.25, 0.22), woodMat);
  postL.position.set(-1.14, 3.05, 4.52);
  const postR = postL.clone();
  postR.position.x = 1.14;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.3, 0.24), woodMat);
  beam.position.set(0, 4.62, 4.52);
  const signText = makeTextSign('MINE', 2.25, 0.48, '#c27a45', '#4a1d12');
  signText.position.set(0, 4.62, 4.68);
  mineEntrance.add(postL, postR, beam, signText);

  const doorWoodMat = new THREE.MeshStandardMaterial({ color: 0x7b4a26, roughness: 0.9 });
  const doorWoodDarkMat = new THREE.MeshStandardMaterial({ color: 0x5f3b22, roughness: 0.92 });
  const doorMetalMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.52, metalness: 0.44 });

  const doorFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.28, 0.22), woodMat);
  doorFrameLeft.position.set(-1.34, 2.96, 5.22);
  const doorFrameRight = doorFrameLeft.clone();
  doorFrameRight.position.x = 1.34;
  const doorFrameTop = new THREE.Mesh(new THREE.BoxGeometry(3.02, 0.22, 0.22), woodMat);
  doorFrameTop.position.set(0, 4.5, 5.22);
  mineEntrance.add(doorFrameLeft, doorFrameRight, doorFrameTop);

  function makeMineDoor(side = 1) {
    const door = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.82, 0.11), doorWoodMat);
    door.add(panel);

    for (const y of [0.88, 0, -0.88]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.11, 0.12), doorMetalMat);
      strap.position.set(0, y, 0.01);
      door.add(strap);
    }

    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 0.08), doorWoodDarkMat);
    brace.rotation.z = side * 0.52;
    brace.position.set(-side * 0.07, 0, 0.02);
    door.add(brace);

    for (const y of [0.72, -0.72]) {
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.08), doorMetalMat);
      hinge.position.set(side * 0.48, y, 0.03);
      door.add(hinge);
    }

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), doorMetalMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(-side * 0.31, 0.05, 0.08);
    door.add(handle);

    door.position.set(side * 0.66, 2.98, 5.28);
    door.rotation.y = side * 0.34;
    return door;
  }

  mineEntrance.add(makeMineDoor(-1), makeMineDoor(1));

  for (const side of [-1, 1]) {
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), doorMetalMat);
    hook.position.set(side * 1.2, 3.82, 5.34);
    const lantern = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.34, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xf4d58d, emissive: 0x7c5a1d, emissiveIntensity: 0.5, roughness: 0.55 })
    );
    lantern.position.set(side * 1.2, 3.58, 5.41);
    const lanternLight = new THREE.PointLight(0xffd68a, 0.85, 8, 2);
    lanternLight.position.set(side * 1.2, 3.6, 5.42);
    mineEntrance.add(hook, lantern, lanternLight);
  }

  const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 8.6), railMat);
  leftRail.position.set(-0.57, 1.16, 8.0);
  const rightRail = leftRail.clone();
  rightRail.position.x = 0.57;
  mineEntrance.add(leftRail, rightRail);
  for (let i = 0; i < 12; i += 1) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.2), tieMat);
    tie.position.set(0, 1.12, 4.55 + i * 0.72);
    mineEntrance.add(tie);
  }

  const cart = new THREE.Group();
  cart.position.set(0, 1.2, 9.05);
  const cartWoodMat = new THREE.MeshStandardMaterial({ color: 0x7a4b2a, roughness: 0.88 });
  const cartMetalMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.54, metalness: 0.36 });
  const cartBed = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.3, 1.5), cartWoodMat);
  cartBed.position.y = 0.22;
  const cartSideL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 1.5), cartWoodMat);
  cartSideL.position.set(-0.54, 0.44, 0);
  const cartSideR = cartSideL.clone();
  cartSideR.position.x = 0.54;
  const cartFront = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.52, 0.1), cartWoodMat);
  cartFront.position.set(0, 0.44, 0.7);
  const cartBack = cartFront.clone();
  cartBack.position.z = -0.7;
  cart.add(cartBed, cartSideL, cartSideR, cartFront, cartBack);

  const wheelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.11, 14);
  const wheelOffsets = [
    [-0.43, 0, -0.52],
    [0.43, 0, -0.52],
    [-0.43, 0, 0.52],
    [0.43, 0, 0.52]
  ];
  for (const [x, y, z] of wheelOffsets) {
    const wheel = new THREE.Mesh(wheelGeo, cartMetalMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    cart.add(wheel);
  }
  mineEntrance.add(cart);

  mineEntrance.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  mineEntrance.rotation.y = MINE_ENTRY_YAW;
  scene.add(mineEntrance);
  mineEntranceMesh = mineEntrance;

  const mineStallVendorScale = 0.65;
  const mineStallVendorY = VENDOR_STAND_Y - 0.05;
  const mineStallVendorZ = -1.0;

  const mineShopVendor = createVendorNpc({
    shirtColor: 0xb45309,
    skinColor: 0xd6a581,
    hairColor: 0x1f2937,
    hatColor: 0x111827
  });
  mineShopVendor.scale.setScalar(mineStallVendorScale);
  const mineShopStall = createVendorStall({
    label: 'Pickaxes',
    signColor: '#2f2417',
    canopyA: 0xf59e0b,
    canopyB: 0xfef3c7,
    vendor: mineShopVendor
  });
  mineShopStall.position.set(
    MINE_SHOP_NPC_POS.x - MINE_POS.x,
    0,
    MINE_SHOP_NPC_POS.z - MINE_POS.z
  );
  mineShopVendor.position.set(0, mineStallVendorY, mineStallVendorZ);
  mineShopStall.rotation.y = Math.atan2(-mineShopStall.position.x, -mineShopStall.position.z);
  mine.add(mineShopStall);
  mineShopNpcMesh = mineShopVendor;
  addWorldCollider(MINE_SHOP_NPC_POS.x, MINE_SHOP_NPC_POS.z, 1.04, 'npc');

  const oreTraderVendor = createVendorNpc({
    shirtColor: 0x7c2d12,
    skinColor: 0xd6a581,
    hairColor: 0x111827,
    hatColor: 0x334155
  });
  oreTraderVendor.scale.setScalar(mineStallVendorScale);
  const oreTraderStall = createVendorStall({
    label: 'Ore Trader',
    signColor: '#2b2f3a',
    canopyA: 0x94a3b8,
    canopyB: 0xf8fafc,
    vendor: oreTraderVendor
  });
  oreTraderStall.position.set(
    MINE_ORE_TRADER_POS.x - MINE_POS.x,
    0,
    MINE_ORE_TRADER_POS.z - MINE_POS.z
  );
  oreTraderVendor.position.set(0, mineStallVendorY, mineStallVendorZ);
  oreTraderStall.rotation.y = Math.atan2(-oreTraderStall.position.x, -oreTraderStall.position.z);
  mine.add(oreTraderStall);
  mineOreTraderNpcMesh = oreTraderVendor;
  addWorldCollider(MINE_ORE_TRADER_POS.x, MINE_ORE_TRADER_POS.z, 1.04, 'npc');

  const questVendor = createVendorNpc({
    shirtColor: 0x7c3aed,
    skinColor: 0xe0b18f,
    hairColor: 0x0f172a,
    hatColor: 0x1e293b
  });
  questVendor.scale.setScalar(mineStallVendorScale);
  const questStall = createVendorStall({
    label: 'Quests',
    signColor: '#2f2a3b',
    canopyA: 0x8b5cf6,
    canopyB: 0xf5f3ff,
    vendor: questVendor
  });
  questStall.position.set(
    QUEST_NPC_POS.x - MINE_POS.x,
    0,
    QUEST_NPC_POS.z - MINE_POS.z
  );
  questVendor.position.set(0, mineStallVendorY, mineStallVendorZ);
  questStall.rotation.y = Math.atan2(-questStall.position.x, -questStall.position.z);
  mine.add(questStall);
  questNpcMesh = questVendor;
  addWorldCollider(QUEST_NPC_POS.x, QUEST_NPC_POS.z, 1.04, 'npc');
}

function addMainHouseRoomInterior() {
  const room = new THREE.Group();
  const floorY = GROUND_Y;
  const wallHeight = 4.8;
  const wallThickness = 0.28;
  const halfDepth = HOUSE_ROOM_PLAY_RADIUS - 0.7;
  const halfWidth = HOUSE_ROOM_PLAY_RADIUS - 0.6;
  const doorWidth = 3.6;
  const wallCenterY = floorY + wallHeight * 0.5;
  const wallPaint = HOME_ROOM_WALL_OPTIONS.sand?.color || '#d9c4a3';
  const floorPaint = HOME_ROOM_FLOOR_OPTIONS.oak?.color || '#7d5a3a';

  const wallMat = new THREE.MeshStandardMaterial({ color: wallPaint, roughness: 0.86 });
  const floorMat = new THREE.MeshStandardMaterial({ color: floorPaint, roughness: 0.92 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.9 });
  const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.85 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.82 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xa8d4f0, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.35 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.78 });
  const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.82 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.84 });
  const bracketMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.5, metalness: 0.35 });
  const sconceShadeMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.55, side: THREE.DoubleSide });
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.4, metalness: 0.6 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc69332, roughness: 0.28, metalness: 0.82 });
  const linenMat = new THREE.MeshStandardMaterial({ color: 0xf4ead0, roughness: 0.72, side: THREE.DoubleSide });
  const sofaMat = new THREE.MeshStandardMaterial({ color: 0xd4c7b5, roughness: 0.84 });
  const sofaAccentMat = new THREE.MeshStandardMaterial({ color: 0xb98b66, roughness: 0.82 });
  const artCanvasMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.72 });
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0x9f6f48, roughness: 0.9 });
  const accentPanelMat = new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.88 });
  const deskTopMat = new THREE.MeshStandardMaterial({ color: 0x6f4a2f, roughness: 0.84 });
  const deskBaseMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1f, roughness: 0.88 });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.92 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff7db,
    emissive: 0xffd27a,
    emissiveIntensity: 0.8,
    roughness: 0.24,
    metalness: 0.04
  });

  houseRoomWallMaterial = wallMat;
  houseRoomFloorMaterial = floorMat;
  const roomCenterX = HOUSE_ROOM_BASE.x;
  const roomCenterZ = HOUSE_ROOM_BASE.z;
  const backWallInnerZ = HOUSE_ROOM_BASE.z - halfDepth + wallThickness + 0.12;
  const workspaceCenterX = HOUSE_ROOM_WORKSHOP_POS.x + 0.15;
  const workspaceWallZ = backWallInnerZ + 0.02;
  const workspaceDeskZ = workspaceWallZ + 1.34;
  const bedroomCenterX = roomCenterX + halfWidth - 3.45;
  const bedroomCenterZ = roomCenterZ - 2.75;
  const bedsideZ = bedroomCenterZ - 2.55;
  const loungeCenterX = roomCenterX + 1.1;
  const loungeCenterZ = roomCenterZ + 0.95;
  const readingCornerX = roomCenterX + halfWidth - 2.85;
  const readingCornerZ = roomCenterZ + 0.3;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.22, halfDepth * 2), floorMat);
  floor.position.set(HOUSE_ROOM_BASE.x, floorY - 0.11, HOUSE_ROOM_BASE.z);
  floor.receiveShadow = true;
  room.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.18, halfDepth * 2), trimMat);
  ceiling.position.set(HOUSE_ROOM_BASE.x, floorY + wallHeight + 0.1, HOUSE_ROOM_BASE.z);
  ceiling.receiveShadow = true;
  room.add(ceiling);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, wallHeight, wallThickness), wallMat);
  backWall.position.set(HOUSE_ROOM_BASE.x, wallCenterY, HOUSE_ROOM_BASE.z - halfDepth + wallThickness * 0.5);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, halfDepth * 2), wallMat);
  leftWall.position.set(HOUSE_ROOM_BASE.x - halfWidth + wallThickness * 0.5, wallCenterY, HOUSE_ROOM_BASE.z);
  const rightWall = leftWall.clone();
  rightWall.position.x = HOUSE_ROOM_BASE.x + halfWidth - wallThickness * 0.5;

  const frontSideWidth = (halfWidth * 2 - doorWidth) * 0.5;
  const frontLeftWall = new THREE.Mesh(new THREE.BoxGeometry(frontSideWidth, wallHeight, wallThickness), wallMat);
  frontLeftWall.position.set(
    HOUSE_ROOM_BASE.x - (doorWidth * 0.5 + frontSideWidth * 0.5),
    wallCenterY,
    HOUSE_ROOM_BASE.z + halfDepth - wallThickness * 0.5
  );
  const frontRightWall = frontLeftWall.clone();
  frontRightWall.position.x = HOUSE_ROOM_BASE.x + (doorWidth * 0.5 + frontSideWidth * 0.5);
  const frontTopWall = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, wallHeight * 0.4, wallThickness), wallMat);
  frontTopWall.position.set(
    HOUSE_ROOM_BASE.x,
    floorY + wallHeight - (wallHeight * 0.4) * 0.5,
    HOUSE_ROOM_BASE.z + halfDepth - wallThickness * 0.5
  );
  room.add(backWall, leftWall, rightWall, frontLeftWall, frontRightWall, frontTopWall);

  const baseboardHeight = 0.14;
  const baseboardInset = wallThickness * 0.5 + 0.02;
  const crownHeight = 0.12;
  const crownY = floorY + wallHeight - crownHeight * 0.5;
  const baseY = floorY + baseboardHeight * 0.5;
  const wallLenX = halfWidth * 2 - wallThickness;
  const wallLenZ = halfDepth * 2 - wallThickness;

  const bbBack = new THREE.Mesh(new THREE.BoxGeometry(wallLenX, baseboardHeight, 0.06), baseboardMat);
  bbBack.position.set(HOUSE_ROOM_BASE.x, baseY, HOUSE_ROOM_BASE.z - halfDepth + baseboardInset);
  const bbLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, baseboardHeight, wallLenZ), baseboardMat);
  bbLeft.position.set(HOUSE_ROOM_BASE.x - halfWidth + baseboardInset, baseY, HOUSE_ROOM_BASE.z);
  const bbRight = bbLeft.clone();
  bbRight.position.x = HOUSE_ROOM_BASE.x + halfWidth - baseboardInset;
  const bbFrontL = new THREE.Mesh(new THREE.BoxGeometry(frontSideWidth - 0.1, baseboardHeight, 0.06), baseboardMat);
  bbFrontL.position.set(frontLeftWall.position.x, baseY, HOUSE_ROOM_BASE.z + halfDepth - baseboardInset);
  const bbFrontR = bbFrontL.clone();
  bbFrontR.position.x = frontRightWall.position.x;
  room.add(bbBack, bbLeft, bbRight, bbFrontL, bbFrontR);

  const crBack = new THREE.Mesh(new THREE.BoxGeometry(wallLenX, crownHeight, 0.06), crownMat);
  crBack.position.set(HOUSE_ROOM_BASE.x, crownY, HOUSE_ROOM_BASE.z - halfDepth + baseboardInset);
  const crLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, crownHeight, wallLenZ), crownMat);
  crLeft.position.set(HOUSE_ROOM_BASE.x - halfWidth + baseboardInset, crownY, HOUSE_ROOM_BASE.z);
  const crRight = crLeft.clone();
  crRight.position.x = HOUSE_ROOM_BASE.x + halfWidth - baseboardInset;
  const crFrontL = new THREE.Mesh(new THREE.BoxGeometry(frontSideWidth - 0.1, crownHeight, 0.06), crownMat);
  crFrontL.position.set(frontLeftWall.position.x, crownY, HOUSE_ROOM_BASE.z + halfDepth - baseboardInset);
  const crFrontR = crFrontL.clone();
  crFrontR.position.x = frontRightWall.position.x;
  room.add(crBack, crLeft, crRight, crFrontL, crFrontR);

  const chairRailHeight = 1.92;
  const chairRailBack = new THREE.Mesh(new THREE.BoxGeometry(wallLenX, 0.09, 0.08), crownMat);
  chairRailBack.position.set(HOUSE_ROOM_BASE.x, floorY + chairRailHeight, HOUSE_ROOM_BASE.z - halfDepth + baseboardInset + 0.02);
  const chairRailLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, wallLenZ), crownMat);
  chairRailLeft.position.set(HOUSE_ROOM_BASE.x - halfWidth + baseboardInset + 0.02, floorY + chairRailHeight, HOUSE_ROOM_BASE.z);
  const chairRailRight = chairRailLeft.clone();
  chairRailRight.position.x = HOUSE_ROOM_BASE.x + halfWidth - baseboardInset - 0.02;
  room.add(chairRailBack, chairRailLeft, chairRailRight);

  for (const beamOffset of [-3.4, 3.4]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, halfDepth * 2 - 0.7), trimMat);
    beam.position.set(HOUSE_ROOM_BASE.x + beamOffset, floorY + wallHeight - 0.11, HOUSE_ROOM_BASE.z - 0.1);
    room.add(beam);
  }

  const interiorFrontFaceZ = HOUSE_ROOM_BASE.z + halfDepth - wallThickness;
  const doorFrameDepth = 0.12;
  const doorFrameThick = 0.18;
  const doorFrameH = wallHeight * 0.82;
  const doorFrameY = floorY + doorFrameH * 0.5;
  const doorFrameZ = interiorFrontFaceZ + doorFrameDepth * 0.5 + 0.01;

  const dfLeft = new THREE.Mesh(new THREE.BoxGeometry(doorFrameThick, doorFrameH, doorFrameDepth), doorFrameMat);
  dfLeft.position.set(HOUSE_ROOM_BASE.x - doorWidth * 0.5 - doorFrameThick * 0.5, doorFrameY, doorFrameZ);
  const dfRight = dfLeft.clone();
  dfRight.position.x = HOUSE_ROOM_BASE.x + doorWidth * 0.5 + doorFrameThick * 0.5;
  const dfTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + doorFrameThick * 2, doorFrameThick, doorFrameDepth), doorFrameMat);
  dfTop.position.set(HOUSE_ROOM_BASE.x, floorY + doorFrameH + doorFrameThick * 0.5, doorFrameZ);
  room.add(dfLeft, dfRight, dfTop);

  const doorLeafMat = new THREE.MeshStandardMaterial({ color: 0x4b2f1d, roughness: 0.78 });
  const doorGlassMat = new THREE.MeshStandardMaterial({
    color: 0xc8e6fb,
    roughness: 0.08,
    metalness: 0.08,
    transparent: true,
    opacity: 0.42
  });
  const doorHandleMat = new THREE.MeshStandardMaterial({ color: 0xd3a64f, roughness: 0.32, metalness: 0.68 });
  const doorLeafW = doorWidth * 0.5 - 0.14;
  const doorLeafH = doorFrameH - 0.18;
  const doorLeafT = 0.08;
  const doorPanelZ = interiorFrontFaceZ + doorLeafT * 0.5 + 0.012;

  function createInteriorDoorLeaf(side = -1) {
    const leaf = new THREE.Group();
    const panel = new THREE.Group();
    panel.position.x = (side === -1 ? 1 : -1) * doorLeafW * 0.5;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(doorLeafW, doorLeafH, doorLeafT), doorLeafMat);
    slab.position.y = doorLeafH * 0.5;
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(doorLeafW - 0.16, 0.12, 0.02), trimMat);
    railTop.position.set(0, doorLeafH - 0.3, doorLeafT * 0.5 + 0.02);
    const railMid = railTop.clone();
    railMid.position.y = doorLeafH * 0.54;
    const railBot = railTop.clone();
    railBot.position.y = 0.42;
    const stileL = new THREE.Mesh(new THREE.BoxGeometry(0.12, doorLeafH - 0.2, 0.02), trimMat);
    stileL.position.set(-doorLeafW * 0.5 + 0.14, doorLeafH * 0.5, doorLeafT * 0.5 + 0.02);
    const stileR = stileL.clone();
    stileR.position.x = doorLeafW * 0.5 - 0.14;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(doorLeafW - 0.42, doorLeafH * 0.32, 0.02), doorGlassMat);
    glass.position.set(0, doorLeafH * 0.7, doorLeafT * 0.5 + 0.03);
    const lowerPanel = new THREE.Mesh(new THREE.BoxGeometry(doorLeafW - 0.42, doorLeafH * 0.24, 0.02), trimMat);
    lowerPanel.position.set(0, doorLeafH * 0.27, doorLeafT * 0.5 + 0.03);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), doorHandleMat);
    handle.position.set((side === -1 ? 1 : -1) * (doorLeafW * 0.5 - 0.18), doorLeafH * 0.48, doorLeafT * 0.5 + 0.05);
    panel.add(slab, railTop, railMid, railBot, stileL, stileR, glass, lowerPanel, handle);
    leaf.add(panel);
    return leaf;
  }

  const leftDoorLeaf = createInteriorDoorLeaf(-1);
  leftDoorLeaf.position.set(HOUSE_ROOM_BASE.x - doorWidth * 0.5 + 0.02, floorY, doorPanelZ);
  leftDoorLeaf.rotation.y = Math.PI * 0.09;
  const rightDoorLeaf = createInteriorDoorLeaf(1);
  rightDoorLeaf.position.set(HOUSE_ROOM_BASE.x + doorWidth * 0.5 - 0.02, floorY, doorPanelZ);
  rightDoorLeaf.rotation.y = -Math.PI * 0.09;

  const transom = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth - 0.2, 0.46, 0.05),
    doorGlassMat
  );
  transom.position.set(HOUSE_ROOM_BASE.x, floorY + doorFrameH - 0.34, interiorFrontFaceZ + 0.04);
  const transomBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.46, 0.06),
    trimMat
  );
  transomBar.position.copy(transom.position);
  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth + 0.12, 0.04, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.88 })
  );
  threshold.position.set(HOUSE_ROOM_BASE.x, floorY + 0.03, interiorFrontFaceZ + 0.08);
  room.add(leftDoorLeaf, rightDoorLeaf, transom, transomBar, threshold);

  const doorStep = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth + 0.6, 0.06, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9 })
  );
  doorStep.position.set(HOUSE_ROOM_BASE.x, floorY + 0.02, HOUSE_ROOM_BASE.z + halfDepth + 0.15);
  doorStep.receiveShadow = true;
  room.add(doorStep);

  const welcomeRugBorder = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth - 0.2, 0.025, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.92 })
  );
  welcomeRugBorder.position.set(HOUSE_ROOM_BASE.x, floorY + 0.015, HOUSE_ROOM_BASE.z + halfDepth - 1.4);
  welcomeRugBorder.receiveShadow = true;
  const welcomeRug = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth - 0.6, 0.03, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.88 })
  );
  welcomeRug.position.set(HOUSE_ROOM_BASE.x, floorY + 0.02, HOUSE_ROOM_BASE.z + halfDepth - 1.4);
  welcomeRug.receiveShadow = true;
  room.add(welcomeRugBorder, welcomeRug);

  const rugBorder = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 0.035, 4.2),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.88 })
  );
  rugBorder.position.set(loungeCenterX, floorY + 0.005, loungeCenterZ);
  rugBorder.receiveShadow = true;
  const rug = new THREE.Mesh(
    new THREE.BoxGeometry(5.0, 0.05, 3.7),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.78 })
  );
  rug.position.set(loungeCenterX, floorY + 0.01, loungeCenterZ);
  rug.receiveShadow = true;
  const rugAccent = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.045, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.82 })
  );
  rugAccent.position.set(loungeCenterX, floorY + 0.018, loungeCenterZ);
  rugAccent.receiveShadow = true;
  room.add(rugBorder, rug, rugAccent);

  const ambientLight = new THREE.AmbientLight(0xe2e8f0, 0.38);
  const wallLightL = new THREE.PointLight(0xfef3c7, 0.58, 12, 2);
  wallLightL.position.set(roomCenterX - 5.2, floorY + 3.34, backWallInnerZ + 0.34);
  const wallLightR = wallLightL.clone();
  wallLightR.position.x = roomCenterX + 5.2;
  const doorFillLight = new THREE.PointLight(0xfef3c7, 0.34, 7.5, 2);
  doorFillLight.position.set(roomCenterX, floorY + 3.1, roomCenterZ + halfDepth - 0.55);
  const ceilingLampLight = new THREE.PointLight(0xfff4e0, 0.72, 13, 2);
  ceilingLampLight.position.set(loungeCenterX, floorY + wallHeight - 0.58, loungeCenterZ);
  room.add(ambientLight, wallLightL, wallLightR, doorFillLight, ceilingLampLight);

  const sconceY = floorY + 3.3;
  function createWallSconce() {
    const sconce = new THREE.Group();
    const backplate = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 18), brassMat);
    backplate.rotation.x = Math.PI * 0.5;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.3, 10), bracketMat);
    arm.rotation.x = Math.PI * 0.5;
    arm.position.z = 0.14;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 10), brassMat);
    cup.position.z = 0.3;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), bulbMat);
    bulb.position.z = 0.34;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.34, 12), sconceShadeMat);
    shade.rotation.x = Math.PI * 0.5;
    shade.position.z = 0.41;
    sconce.add(backplate, arm, cup, bulb, shade);
    return sconce;
  }

  const sconceL = createWallSconce();
  sconceL.position.set(HOUSE_ROOM_BASE.x - 5.2, sconceY, backWallInnerZ);
  const sconceR = createWallSconce();
  sconceR.position.set(HOUSE_ROOM_BASE.x + 5.2, sconceY, backWallInnerZ);
  room.add(sconceL, sconceR);

  const ceilingCanopy = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 12), brassMat);
  ceilingCanopy.position.set(loungeCenterX, floorY + wallHeight + 0.04, loungeCenterZ);
  const ceilingLampChain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6),
    chainMat
  );
  ceilingLampChain.position.set(loungeCenterX, floorY + wallHeight - 0.18, loungeCenterZ);
  const ceilingLampShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.48, 0.36, 18, 1, true),
    linenMat
  );
  ceilingLampShade.position.set(loungeCenterX, floorY + wallHeight - 0.5, loungeCenterZ);
  const ceilingLampTrim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 8, 18), brassMat);
  ceilingLampTrim.position.set(loungeCenterX, floorY + wallHeight - 0.68, loungeCenterZ);
  ceilingLampTrim.rotation.x = Math.PI * 0.5;
  const ceilingBulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 14), bulbMat);
  ceilingBulb.position.set(loungeCenterX, floorY + wallHeight - 0.6, loungeCenterZ);
  room.add(ceilingCanopy, ceilingLampChain, ceilingLampShade, ceilingLampTrim, ceilingBulb);

  const entryLantern = new THREE.Group();
  const entryBracket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.16), brassMat);
  const entryLanternBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.46, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.28, roughness: 0.18, metalness: 0.08 })
  );
  entryLanternBody.position.z = 0.08;
  const entryBulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), bulbMat);
  entryBulb.position.z = 0.08;
  entryLantern.add(entryBracket, entryLanternBody, entryBulb);
  entryLantern.position.set(roomCenterX, floorY + 3.15, roomCenterZ + halfDepth - 0.34);
  room.add(entryLantern);

  const workspacePanel = new THREE.Mesh(
    new THREE.BoxGeometry(4.3, 2.9, 0.1),
    accentPanelMat
  );
  workspacePanel.position.set(workspaceCenterX, floorY + 2.12, workspaceWallZ);
  const workspaceShelf = new THREE.Mesh(
    new THREE.BoxGeometry(3.15, 0.08, 0.28),
    shelfMat
  );
  workspaceShelf.position.set(workspaceCenterX, floorY + 2.28, workspaceWallZ + 0.18);
  const pegRail = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 0.08, 0.12),
    baseboardMat
  );
  pegRail.position.set(workspaceCenterX, floorY + 2.86, workspaceWallZ + 0.08);
  room.add(workspacePanel, workspaceShelf, pegRail);

  for (const hookOffset of [-0.78, -0.26, 0.26, 0.78]) {
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8), brassMat);
    hook.rotation.x = Math.PI * 0.5;
    hook.position.set(workspaceCenterX + hookOffset, floorY + 2.7, workspaceWallZ + 0.1);
    room.add(hook);
  }

  const workshopSign = makeTextSign('Workspace', 2.7, 0.58, '#0f172a', '#f8fafc');
  workshopSign.position.set(workspaceCenterX, floorY + 3.22, workspaceWallZ + 0.06);
  room.add(workshopSign);

  function createHouseRoomMarker({
    ringRadius = 0.92,
    ringColor = 0x7dd3fc,
    emissiveColor = 0x0369a1,
    iconType = 'exit'
  } = {}) {
    const marker = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 0.08, 10, 28),
      new THREE.MeshStandardMaterial({
        color: ringColor,
        emissive: emissiveColor,
        emissiveIntensity: 0.82,
        roughness: 0.22,
        metalness: 0.08
      })
    );
    ring.rotation.x = Math.PI * 0.5;
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(ringRadius * 0.68, ringRadius * 0.68, 0.04, 22),
      new THREE.MeshStandardMaterial({
        color: 0x10314d,
        emissive: emissiveColor,
        emissiveIntensity: 0.18,
        roughness: 0.28,
        transparent: true,
        opacity: 0.82
      })
    );
    plate.rotation.x = Math.PI * 0.5;
    plate.position.y = 0.005;
    const glow = new THREE.PointLight(ringColor, 0.46, 5.4, 2);
    glow.position.y = 0.95;
    const icon = new THREE.Group();

    if (iconType === 'exit') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.54, 0.08), trimMat);
      frame.position.y = 0.98;
      const voidCut = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.34, 0.1),
        new THREE.MeshStandardMaterial({
          color: ringColor,
          emissive: emissiveColor,
          emissiveIntensity: 0.9,
          roughness: 0.18,
          transparent: true,
          opacity: 0.84
        })
      );
      voidCut.position.set(-0.03, 0.96, 0.03);
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.22, 3),
        new THREE.MeshStandardMaterial({
          color: ringColor,
          emissive: emissiveColor,
          emissiveIntensity: 0.92,
          roughness: 0.2
        })
      );
      arrow.rotation.z = -Math.PI * 0.5;
      arrow.position.set(0.18, 0.96, 0.02);
      icon.add(frame, voidCut, arrow);
    } else {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.22), deskTopMat);
      board.position.y = 0.94;
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.06), deskBaseMat);
      legL.position.set(-0.16, 0.76, 0);
      const legR = legL.clone();
      legR.position.x = 0.16;
      const tool = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.28, 0.08),
        new THREE.MeshStandardMaterial({
          color: ringColor,
          emissive: emissiveColor,
          emissiveIntensity: 0.88,
          roughness: 0.24
        })
      );
      tool.position.set(0, 1.18, 0);
      const toolHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.08, 0.08),
        new THREE.MeshStandardMaterial({
          color: ringColor,
          emissive: emissiveColor,
          emissiveIntensity: 0.88,
          roughness: 0.24
        })
      );
      toolHead.position.set(0, 1.28, 0);
      icon.add(board, legL, legR, tool, toolHead);
    }

    marker.add(ring, plate, icon, glow);
    marker.userData.ring = ring;
    marker.userData.icon = icon;
    marker.userData.glow = glow;
    return marker;
  }

  houseRoomExitMarker = createHouseRoomMarker({
    ringRadius: 0.94,
    ringColor: 0x7dd3fc,
    emissiveColor: 0x0369a1,
    iconType: 'exit'
  });
  houseRoomExitMarker.position.set(HOUSE_ROOM_EXIT_POS.x, floorY + 0.02, HOUSE_ROOM_EXIT_POS.z);
  room.add(houseRoomExitMarker);

  houseRoomWorkshopMarker = createHouseRoomMarker({
    ringRadius: 0.72,
    ringColor: 0x5eead4,
    emissiveColor: 0x0f766e,
    iconType: 'workshop'
  });
  houseRoomWorkshopMarker.position.set(HOUSE_ROOM_WORKSHOP_POS.x, floorY + 0.02, HOUSE_ROOM_WORKSHOP_POS.z);
  room.add(houseRoomWorkshopMarker);

  const winFrameDepth = wallThickness + 0.14;
  const winFrameThick = 0.1;
  const winGlassMat = glassMat;
  const winFrameX = halfWidth - 0.5;
  const winFrameY = floorY + 2.7;
  const winFrameW = 1.6;
  const winFrameH = 1.3;

  function addWindowFrame(group, wx, wz, rotY) {
    const wGroup = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(winFrameW - 0.2, winFrameH - 0.2, 0.04), winGlassMat);
    glass.position.y = winFrameY;
    wGroup.add(glass);
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(winFrameW, winFrameThick, winFrameDepth), frameMat);
    topBar.position.y = winFrameY + winFrameH * 0.5;
    const botBar = topBar.clone();
    botBar.position.y = winFrameY - winFrameH * 0.5;
    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(winFrameThick, winFrameH, winFrameDepth), frameMat);
    leftBar.position.set(-winFrameW * 0.5, winFrameY, 0);
    const rightBar = leftBar.clone();
    rightBar.position.x = winFrameW * 0.5;
    const hDiv = new THREE.Mesh(new THREE.BoxGeometry(winFrameW - 0.12, 0.05, winFrameDepth * 0.6), frameMat);
    hDiv.position.y = winFrameY;
    const vDiv = new THREE.Mesh(new THREE.BoxGeometry(0.05, winFrameH - 0.12, winFrameDepth * 0.6), frameMat);
    vDiv.position.y = winFrameY;
    const sill = new THREE.Mesh(new THREE.BoxGeometry(winFrameW + 0.2, 0.06, 0.3), frameMat);
    sill.position.set(0, winFrameY - winFrameH * 0.5 - 0.04, 0.18);
    wGroup.add(topBar, botBar, leftBar, rightBar, hDiv, vDiv, sill);
    wGroup.position.set(wx, 0, wz);
    wGroup.rotation.y = rotY;
    group.add(wGroup);
  }

  addWindowFrame(room, HOUSE_ROOM_BASE.x - winFrameX, HOUSE_ROOM_BASE.z - 1.2, Math.PI / 2);
  addWindowFrame(room, HOUSE_ROOM_BASE.x + winFrameX, HOUSE_ROOM_BASE.z - 1.2, -Math.PI / 2);

  function addCurtain(wx, wz, rotY, direction) {
    const curtainRod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.95, 10), brassMat);
    curtainRod.rotation.z = Math.PI * 0.5;
    curtainRod.rotation.y = rotY;
    curtainRod.position.set(wx, floorY + 3.52, wz);
    room.add(curtainRod);
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.54, 1.7, 0.08), curtainMat);
      panel.position.set(
        wx + Math.cos(rotY) * side * 0.08 + direction * side * 0.5,
        floorY + 2.66,
        wz - Math.sin(rotY) * side * 0.08
      );
      panel.rotation.y = rotY;
      room.add(panel);
    }
  }

  addCurtain(HOUSE_ROOM_BASE.x - winFrameX + 0.12, HOUSE_ROOM_BASE.z - 1.2, Math.PI / 2, 1);
  addCurtain(HOUSE_ROOM_BASE.x + winFrameX - 0.12, HOUSE_ROOM_BASE.z - 1.2, -Math.PI / 2, -1);

  const shelfWidth = 2.4;
  const shelfDepth = 0.32;
  const shelfY = floorY + 2.1;
  const shelfZ = HOUSE_ROOM_BASE.z - halfDepth + wallThickness + shelfDepth * 0.5 + 0.04;
  const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.08, shelfDepth), shelfMat);
  shelfBoard.position.set(HOUSE_ROOM_BASE.x, shelfY, shelfZ);
  shelfBoard.castShadow = true;
  shelfBoard.receiveShadow = true;

  const bookColors = [0xdc2626, 0x2563eb, 0x16a34a];
  const bookGroup = new THREE.Group();
  bookColors.forEach((c, i) => {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.3, 0.22),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })
    );
    book.position.set(HOUSE_ROOM_BASE.x - 0.65 + i * 0.22, shelfY + 0.2, shelfZ);
    bookGroup.add(book);
  });
  const bowl1 = new THREE.Mesh(
    new THREE.TorusGeometry(0.1, 0.04, 6, 12, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 })
  );
  bowl1.position.set(HOUSE_ROOM_BASE.x + 0.55, shelfY + 0.07, shelfZ);
  bowl1.rotation.x = Math.PI / 2;
  const bowl2 = bowl1.clone();
  bowl2.position.x = HOUSE_ROOM_BASE.x + 0.85;
  bowl2.scale.setScalar(0.75);
  room.add(shelfBoard, bookGroup, bowl1, bowl2);

  const paintingW = 1.5;
  const paintingH = 1.0;
  const paintFrameThick = 0.1;
  const paintingY = floorY + 3.5;
  const paintingZ = HOUSE_ROOM_BASE.z - halfDepth + wallThickness + 0.08;
  const paintGroup = new THREE.Group();
  const paintCanvas = new THREE.Mesh(
    new THREE.BoxGeometry(paintingW - paintFrameThick * 2, paintingH - paintFrameThick * 2, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.92 })
  );
  paintCanvas.position.y = paintingY;
  paintGroup.add(paintCanvas);
  const pfTop = new THREE.Mesh(
    new THREE.BoxGeometry(paintingW, paintFrameThick, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.5, metalness: 0.25 })
  );
  pfTop.position.y = paintingY + paintingH * 0.5;
  const pfBot = pfTop.clone();
  pfBot.position.y = paintingY - paintingH * 0.5;
  const pfLeft = new THREE.Mesh(
    new THREE.BoxGeometry(paintFrameThick, paintingH, 0.1),
    pfTop.material
  );
  pfLeft.position.set(-paintingW * 0.5, paintingY, 0);
  const pfRight = pfLeft.clone();
  pfRight.position.x = paintingW * 0.5;
  paintGroup.add(pfTop, pfBot, pfLeft, pfRight);
  paintGroup.position.set(HOUSE_ROOM_BASE.x, 0, paintingZ);
  room.add(paintGroup);

  houseRoomFurnitureMeshes.clear();
  const addFurniture = (id, mesh) => {
    mesh.visible = false;
    room.add(mesh);
    houseRoomFurnitureMeshes.set(id, mesh);
  };

  const bed = new THREE.Group();
  const bedFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.42, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.88 })
  );
  bedFrame.position.y = 0.24;
  bedFrame.castShadow = true;
  const bedMattress = new THREE.Mesh(
    new THREE.BoxGeometry(3.16, 0.28, 1.95),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.8 })
  );
  bedMattress.position.y = 0.58;
  const bedPillow = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.2, 1.7),
    new THREE.MeshStandardMaterial({ color: 0xbfdbfe, roughness: 0.76 })
  );
  bedPillow.position.set(1.15, 0.77, 0);
  const bedBlanket = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.12, 1.82),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.82 })
  );
  bedBlanket.position.set(-0.12, 0.75, 0);
  const bedHeadboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.2, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x5a3118, roughness: 0.85 })
  );
  bedHeadboard.position.set(1.65, 0.84, 0);
  const bedFootboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.6, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x5a3118, roughness: 0.85 })
  );
  bedFootboard.position.set(-1.65, 0.54, 0);
  const bedThrow = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.08, 1.82),
    new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.76 })
  );
  bedThrow.position.set(-0.92, 0.82, 0);
  bed.add(bedFrame, bedMattress, bedPillow, bedBlanket, bedHeadboard, bedFootboard, bedThrow);
  bed.position.set(bedroomCenterX, floorY, bedroomCenterZ);
  bed.rotation.y = -Math.PI * 0.5;
  addFurniture('bed', bed);

  const nightstand = new THREE.Group();
  const nsTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.08, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.86 })
  );
  nsTop.position.y = 0.68;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.6, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x4a2f1f, roughness: 0.88 })
      );
      leg.position.set(sx * 0.24, 0.34, sz * 0.18);
      nightstand.add(leg);
    }
  }
  const nsDrawer = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.12, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x3d2515, roughness: 0.82 })
  );
  nsDrawer.position.set(0, 0.48, 0.27);
  const nsKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xd4a44a, roughness: 0.3, metalness: 0.5 })
  );
  nsKnob.position.set(0, 0.48, 0.29);
  const nsBook = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.06, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.82 })
  );
  nsBook.position.set(-0.12, 0.75, -0.04);
  const nsCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.05, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.78 })
  );
  nsCup.position.set(0.14, 0.78, 0);
  nightstand.add(nsTop, nsDrawer, nsKnob, nsBook, nsCup);
  nightstand.position.set(bedroomCenterX, floorY, bedsideZ);
  room.add(nightstand);

  const table = new THREE.Group();
  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 0.16, 1.34),
    deskTopMat
  );
  tableTop.position.y = 1.08;
  table.add(tableTop);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.95, 0.12),
        deskBaseMat
      );
      leg.position.set(sx * 1.1, 0.54, sz * 0.5);
      table.add(leg);
    }
  }
  const tableBackRail = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 0.14, 0.12),
    deskBaseMat
  );
  tableBackRail.position.set(0, 1.2, -0.61);
  const drawerStack = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.92, 1.02),
    deskBaseMat
  );
  drawerStack.position.set(-0.88, 0.55, 0);
  const drawerFaceTop = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.04), trimMat);
  drawerFaceTop.position.set(-0.88, 0.72, 0.5);
  const drawerFaceBottom = drawerFaceTop.clone();
  drawerFaceBottom.position.y = 0.38;
  const deskMatTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.16, 0.025, 0.64),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42 })
  );
  deskMatTop.position.set(0.38, 1.17, 0.08);
  const paperStack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.34), paperMat);
  paperStack.position.set(0.84, 1.19, -0.12);
  const toolCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.09, 0.18, 12),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.48, metalness: 0.32 })
  );
  toolCup.position.set(0.98, 1.22, 0.38);
  const chair = new THREE.Group();
  const chairSeat = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.1, 0.62),
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.76 })
  );
  chairSeat.position.y = 0.6;
  const chairBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.64, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.78 })
  );
  chairBack.position.set(0, 0.98, -0.27);
  const chairSupport = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.46, 10),
    new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.42, metalness: 0.52 })
  );
  chairSupport.position.y = 0.3;
  const chairBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.22, 0.05, 12),
    deskBaseMat
  );
  chairBase.position.y = 0.03;
  chair.add(chairSeat, chairBack, chairSupport, chairBase);
  chair.position.set(0.48, 0, 1.18);
  table.add(
    tableBackRail,
    drawerStack,
    drawerFaceTop,
    drawerFaceBottom,
    deskMatTop,
    paperStack,
    toolCup,
    chair
  );
  table.position.set(workspaceCenterX, floorY, workspaceDeskZ);
  table.castShadow = true;
  addFurniture('table', table);

  const lamp = new THREE.Group();
  const lampBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.08, 12),
    new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.45, metalness: 0.5 })
  );
  lampBase.position.y = 0.08;
  const lampStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 1.3, 12),
    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.48, metalness: 0.52 })
  );
  lampStem.position.y = 0.74;
  const lampArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.035, 0.82, 10),
    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.48, metalness: 0.52 })
  );
  lampArm.position.set(0.24, 1.48, 0);
  lampArm.rotation.z = -Math.PI * 0.34;
  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 0.42, 14),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.54 })
  );
  lampShade.position.set(0.44, 1.74, 0);
  lampShade.rotation.x = Math.PI;
  lampShade.rotation.z = -Math.PI * 0.1;
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), bulbMat);
  lampBulb.position.set(0.44, 1.58, 0);
  const lampGlow = new THREE.PointLight(0xfef3c7, 0.75, 9, 2);
  lampGlow.position.set(0.44, 1.58, 0);
  lamp.add(lampBase, lampStem, lampArm, lampShade, lampBulb, lampGlow);
  lamp.position.set(readingCornerX, floorY, readingCornerZ);
  lamp.rotation.y = Math.PI * 0.14;
  addFurniture('lamp', lamp);

  const plant = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.3, 0.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.82 })
  );
  pot.position.y = 0.22;
  const potRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.03, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 })
  );
  potRim.position.y = 0.42;
  potRim.rotation.x = Math.PI / 2;
  const leaves = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.42, 1),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 })
  );
  leaves.position.y = 0.82;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.48, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.85 })
  );
  trunk.position.y = 0.56;
  plant.add(pot, potRim, trunk, leaves);
  plant.position.set(roomCenterX - halfWidth + 2.45, floorY, roomCenterZ + 2.1);
  addFurniture('plant', plant);

  const sofa = new THREE.Group();
  const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.36, 1.1), sofaMat);
  sofaBase.position.y = 0.42;
  const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.78, 0.18), sofaMat);
  sofaBack.position.set(0, 0.86, -0.46);
  const sofaArmL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 1.02), sofaAccentMat);
  sofaArmL.position.set(-1.2, 0.6, 0);
  const sofaArmR = sofaArmL.clone();
  sofaArmR.position.x = 1.2;
  const sofaCushion = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 0.92), linenMat);
  sofaCushion.position.y = 0.6;
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.08), deskBaseMat);
    leg.position.set(sx * 1.1, 0.13, -0.36);
    sofa.add(leg);
    const legBack = leg.clone();
    legBack.position.z = 0.36;
    sofa.add(legBack);
  }
  sofa.add(sofaBase, sofaBack, sofaArmL, sofaArmR, sofaCushion);
  sofa.position.set(loungeCenterX - 2.2, floorY, loungeCenterZ + 0.75);
  sofa.rotation.y = Math.PI * 0.5;
  addFurniture('sofa', sofa);

  const coffeeTable = new THREE.Group();
  const coffeeTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.76), deskTopMat);
  coffeeTop.position.y = 0.46;
  coffeeTable.add(coffeeTop);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), deskBaseMat);
      leg.position.set(sx * 0.52, 0.2, sz * 0.26);
      coffeeTable.add(leg);
    }
  }
  coffeeTable.position.set(loungeCenterX - 0.6, floorY, loungeCenterZ + 0.45);
  addFurniture('coffee-table', coffeeTable);

  const bookshelf = new THREE.Group();
  const shelfBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.3, 0.34), shelfMat);
  shelfBody.position.y = 1.15;
  bookshelf.add(shelfBody);
  const shelfSlots = [-0.65, 0, 0.65];
  shelfSlots.forEach((offsetY) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.3), deskBaseMat);
    shelf.position.set(0, 1.15 + offsetY, 0.02);
    bookshelf.add(shelf);
  });
  const bookPalette = [0x2563eb, 0x16a34a, 0xdc2626, 0xf59e0b];
  bookPalette.forEach((color, i) => {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.3, 0.22),
      new THREE.MeshStandardMaterial({ color, roughness: 0.75 })
    );
    book.position.set(-0.5 + i * 0.32, 1.62, 0.08);
    bookshelf.add(book);
  });
  bookshelf.position.set(roomCenterX - halfWidth + 1.05, floorY, roomCenterZ - 1.6);
  bookshelf.rotation.y = Math.PI * 0.5;
  addFurniture('bookshelf', bookshelf);

  const dresser = new THREE.Group();
  const dresserBody = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 0.62), deskBaseMat);
  dresserBody.position.y = 0.55;
  const dresserTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.7), deskTopMat);
  dresserTop.position.y = 1.02;
  dresser.add(dresserBody, dresserTop);
  for (let i = 0; i < 3; i += 1) {
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.04), accentPanelMat);
    drawer.position.set(0, 0.3 + i * 0.24, 0.34);
    dresser.add(drawer);
  }
  dresser.position.set(roomCenterX + halfWidth - 1.4, floorY, roomCenterZ + 1.45);
  dresser.rotation.y = -Math.PI * 0.5;
  addFurniture('dresser', dresser);

  const bedroomRug = new THREE.Group();
  const rugBase = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 0.035, 2.1),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.82 })
  );
  rugBase.position.y = 0.02;
  const rugInset = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.03, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xcbd5f5, roughness: 0.8 })
  );
  rugInset.position.y = 0.035;
  bedroomRug.add(rugBase, rugInset);
  bedroomRug.position.set(bedroomCenterX, floorY, bedroomCenterZ);
  addFurniture('rug', bedroomRug);

  const wallArt = new THREE.Group();
  const artFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.05, 0.08), accentPanelMat);
  artFrame.position.y = 2.55;
  const artCanvas = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.8, 0.04), artCanvasMat);
  artCanvas.position.y = 2.55;
  artCanvas.position.z = 0.04;
  wallArt.add(artFrame, artCanvas);
  wallArt.position.set(roomCenterX - halfWidth + 0.12, floorY, roomCenterZ + 1.2);
  wallArt.rotation.y = Math.PI * 0.5;
  addFurniture('wallart', wallArt);

  const readingChair = new THREE.Group();
  const readingSeat = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.2, 1.04),
    new THREE.MeshStandardMaterial({ color: 0xe7d7bd, roughness: 0.86 })
  );
  readingSeat.position.y = 0.48;
  const readingBack = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.0, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xd6c2a1, roughness: 0.84 })
  );
  readingBack.position.set(0, 1.02, -0.44);
  const readingArmL = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.66, 0.92),
    new THREE.MeshStandardMaterial({ color: 0xc8b38d, roughness: 0.84 })
  );
  readingArmL.position.set(-0.46, 0.72, 0);
  const readingArmR = readingArmL.clone();
  readingArmR.position.x = 0.46;
  const chairCushion = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.12, 0.88),
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 })
  );
  chairCushion.position.y = 0.6;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.08), deskBaseMat);
      leg.position.set(sx * 0.34, 0.2, sz * 0.28);
      readingChair.add(leg);
    }
  }
  readingChair.add(readingSeat, readingBack, readingArmL, readingArmR, chairCushion);
  readingChair.position.set(readingCornerX - 0.62, floorY, readingCornerZ + 0.04);
  readingChair.rotation.y = Math.PI * 0.3;
  room.add(readingChair);

  const readingSideTable = new THREE.Group();
  const readingSideTop = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.08, 16), deskTopMat);
  readingSideTop.position.y = 0.6;
  const readingSideBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.56, 12), bracketMat);
  readingSideBase.position.y = 0.28;
  const readingSideFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.05, 14), deskBaseMat);
  readingSideFoot.position.y = 0.03;
  const readingBook = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.05, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.82 })
  );
  readingBook.position.set(-0.06, 0.67, 0.04);
  const readingMug = nsCup.clone();
  readingMug.position.set(0.1, 0.7, -0.04);
  readingSideTable.add(readingSideTop, readingSideBase, readingSideFoot, readingBook, readingMug);
  readingSideTable.position.set(readingCornerX - 1.58, floorY, readingCornerZ - 0.62);
  room.add(readingSideTable);

  const blanketBench = new THREE.Group();
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 0.52), deskTopMat);
  benchTop.position.y = 0.5;
  blanketBench.add(benchTop);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.08), deskBaseMat);
      leg.position.set(sx * 0.66, 0.22, sz * 0.18);
      blanketBench.add(leg);
    }
  }
  blanketBench.position.set(bedroomCenterX - 2.2, floorY, bedroomCenterZ);
  room.add(blanketBench);

  room.traverse((obj) => {
    if (!obj?.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
  });

   scene.add(room);
   room.visible = false;
   houseRoomGroup = room;
   addWallCollisionFromMesh(backWall, 'house-room');
   addWallCollisionFromMesh(leftWall, 'house-room');
   addWallCollisionFromMesh(rightWall, 'house-room');
   addWallCollisionFromMesh(frontLeftWall, 'house-room');
   addWallCollisionFromMesh(frontRightWall, 'house-room');
   addWallCollisionFromMesh(frontTopWall, 'house-room');
   addWorldCollider(bedroomCenterX, bedsideZ, 0.44, 'house-room');
   addWorldCollider(readingCornerX - 0.62, readingCornerZ + 0.04, 0.74, 'house-room');
   addWorldCollider(readingCornerX - 1.58, readingCornerZ - 0.62, 0.34, 'house-room');
   addWorldCollider(bedroomCenterX - 2.2, bedroomCenterZ, 0.7, 'house-room');
   applyHomeRoomVisuals();
}

function addFishingShopInterior() {
   const shop = new THREE.Group();
   const floorY = GROUND_Y;
   const wallHeight = 7.4;
   const wallThickness = 0.28;
   const halfDepth = SHOP_INTERIOR_HALF_DEPTH;
   const halfWidth = SHOP_INTERIOR_HALF_WIDTH;
   const doorWidth = 3.6;
   const doorHeight = 3.9;
   const wallCenterY = floorY + wallHeight * 0.5;
   const wallPaint = '#0ea5e9';
   const floorPaint = '#5b4a3a';

   const wallMat = new THREE.MeshStandardMaterial({ color: wallPaint, roughness: 0.86 });
   const floorMat = new THREE.MeshStandardMaterial({ color: floorPaint, roughness: 0.92 });
   const trimMat = new THREE.MeshStandardMaterial({ color: 0x3b2f24, roughness: 0.88 });

   const floor = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.22, halfDepth * 2), floorMat);
   floor.position.set(FISHING_SHOP_BASE.x, floorY - 0.11, FISHING_SHOP_BASE.z);
   floor.receiveShadow = true;
   shop.add(floor);

   const ceiling = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.18, halfDepth * 2), trimMat);
   ceiling.position.set(FISHING_SHOP_BASE.x, floorY + wallHeight + 0.1, FISHING_SHOP_BASE.z);
   ceiling.receiveShadow = true;
   shop.add(ceiling);

   const backWall = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, wallHeight, wallThickness), wallMat);
   backWall.position.set(FISHING_SHOP_BASE.x, wallCenterY, FISHING_SHOP_BASE.z - halfDepth + wallThickness * 0.5);
   shop.add(backWall);

   const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, halfDepth * 2), wallMat);
   leftWall.position.set(FISHING_SHOP_BASE.x - halfWidth + wallThickness * 0.5, wallCenterY, FISHING_SHOP_BASE.z);
   shop.add(leftWall);

   const rightWall = leftWall.clone();
   rightWall.position.x = FISHING_SHOP_BASE.x + halfWidth - wallThickness * 0.5;
   shop.add(rightWall);

   const frontSideWidth = (halfWidth * 2 - doorWidth) * 0.5;
   const frontLeftWall = new THREE.Mesh(new THREE.BoxGeometry(frontSideWidth, wallHeight, wallThickness), wallMat);
   frontLeftWall.position.set(
     FISHING_SHOP_BASE.x - (doorWidth * 0.5 + frontSideWidth * 0.5),
     wallCenterY,
     FISHING_SHOP_BASE.z + halfDepth - wallThickness * 0.5
   );
   shop.add(frontLeftWall);

   const frontRightWall = frontLeftWall.clone();
   frontRightWall.position.x = FISHING_SHOP_BASE.x + (doorWidth * 0.5 + frontSideWidth * 0.5);
   shop.add(frontRightWall);

   const frontTopHeight = wallHeight - doorHeight;
   const frontTopWall = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, frontTopHeight, wallThickness), wallMat);
   frontTopWall.position.set(
     FISHING_SHOP_BASE.x,
     floorY + doorHeight + frontTopHeight * 0.5,
     FISHING_SHOP_BASE.z + halfDepth - wallThickness * 0.5
   );
   shop.add(frontTopWall);

   const counterMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.82 });
   const shelfMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.78 });
   const accentMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.38, metalness: 0.2 });
   const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8b6b4f, roughness: 0.9 });
   const rugMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.85 });
   const barrelMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.86 });
   const netMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7, transparent: true, opacity: 0.5, side: THREE.DoubleSide });

   const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, doorHeight + 0.12, 0.16), trimMat);
   frameLeft.position.set(FISHING_SHOP_BASE.x - doorWidth * 0.5 + 0.09, floorY + (doorHeight + 0.12) * 0.5, FISHING_SHOP_BASE.z + halfDepth - wallThickness);
   shop.add(frameLeft);
   const frameRight = frameLeft.clone();
   frameRight.position.x = FISHING_SHOP_BASE.x + doorWidth * 0.5 - 0.09;
   shop.add(frameRight);
   const frameTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.18, 0.18, 0.16), trimMat);
   frameTop.position.set(FISHING_SHOP_BASE.x, floorY + doorHeight + 0.08, FISHING_SHOP_BASE.z + halfDepth - wallThickness);
   shop.add(frameTop);

   const counter = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 1.1), counterMat);
   counter.position.set(FISHING_SHOP_COUNTER_POS.x, floorY + 0.4, FISHING_SHOP_COUNTER_POS.z);
   counter.castShadow = true;
   counter.receiveShadow = true;
   shop.add(counter);

   const counterTop = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.1, 1.0), shelfMat);
   counterTop.position.set(FISHING_SHOP_COUNTER_POS.x, floorY + 0.86, FISHING_SHOP_COUNTER_POS.z);
   shop.add(counterTop);

   const rodRack = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.18, 0.22), shelfMat);
   rodRack.position.set(FISHING_SHOP_BASE.x, floorY + 3.1, FISHING_SHOP_BASE.z - halfDepth + 0.6);
   shop.add(rodRack);
   for (let i = -2; i <= 2; i += 1) {
     const rod = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.08), accentMat);
     rod.position.set(FISHING_SHOP_BASE.x + i * 0.7, floorY + 2.1, FISHING_SHOP_BASE.z - halfDepth + 1.0);
     shop.add(rod);
   }

   const vendor = createVendorNpc({
     shirtColor: 0x0ea5e9,
     skinColor: 0xd6a581,
     hairColor: 0x1f2937,
     hatColor: 0x0f172a
   });
   vendor.scale.setScalar(0.7);
   vendor.position.set(FISHING_SHOP_BASE.x, floorY, FISHING_SHOP_BASE.z - halfDepth + 1.4);
   vendor.rotation.y = 0;
   shop.add(vendor);

   const sign = makeTextSign('Fishing Rods', 3.6, 0.6, '#0b2940', '#ecfeff');
   sign.position.set(FISHING_SHOP_BASE.x, floorY + 3.6, FISHING_SHOP_BASE.z - halfDepth + 0.4);
   shop.add(sign);

   const buySign = makeTextSign('Buy Rods', 2.6, 0.5, '#0b2940', '#ecfeff');
   buySign.position.set(FISHING_SHOP_BASE.x, floorY + 1.5, FISHING_SHOP_BASE.z - halfDepth + 0.5);
   shop.add(buySign);

   const doorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.82 });
   const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.28, doorHeight - 0.12, 0.16), doorMat);
   exitDoor.position.set(FISHING_SHOP_BASE.x, floorY + (doorHeight - 0.12) * 0.5, FISHING_SHOP_BASE.z + halfDepth - wallThickness);
   shop.add(exitDoor);
   const exitDoorWindow = new THREE.Mesh(
     new THREE.BoxGeometry(1.2, 0.72, 0.06),
     new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.28, metalness: 0.08, transparent: true, opacity: 0.68 })
   );
   exitDoorWindow.position.set(FISHING_SHOP_BASE.x, floorY + 2.55, FISHING_SHOP_BASE.z + halfDepth - wallThickness - 0.06);
   shop.add(exitDoorWindow);
   const exitHandle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), new THREE.MeshStandardMaterial({ color: 0xf8d17a, roughness: 0.25, metalness: 0.55 }));
   exitHandle.position.set(FISHING_SHOP_BASE.x + 1.22, floorY + 1.55, FISHING_SHOP_BASE.z + halfDepth - wallThickness - 0.1);
   shop.add(exitHandle);
   const exitRing = new THREE.Mesh(
     new THREE.TorusGeometry(0.9, 0.08, 12, 28),
     new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x0ea5e9, emissiveIntensity: 0.7, roughness: 0.3 })
   );
   exitRing.rotation.x = Math.PI * 0.5;
   exitRing.position.set(FISHING_SHOP_EXIT_POS.x, floorY + 0.05, FISHING_SHOP_EXIT_POS.z);
   shop.add(exitRing);
   fishingShopExitMarker = exitRing;

   const rug = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.03, 2.6), rugMat);
   rug.position.set(FISHING_SHOP_BASE.x, floorY + 0.02, FISHING_SHOP_BASE.z - 0.4);
   shop.add(rug);

   const tackleShelf = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.4, 3.6), shelfMat);
   tackleShelf.position.set(FISHING_SHOP_BASE.x + halfWidth - 0.5, floorY + 1.0, FISHING_SHOP_BASE.z + 0.6);
   shop.add(tackleShelf);
   for (let i = 0; i < 4; i += 1) {
     const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.5), accentMat);
     box.position.set(FISHING_SHOP_BASE.x + halfWidth - 1.0, floorY + 0.4 + i * 0.35, FISHING_SHOP_BASE.z - 0.2 + i * 0.35);
     shop.add(box);
   }

   const net = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.2), netMat);
   net.position.set(FISHING_SHOP_BASE.x + halfWidth - 0.2, floorY + 2.4, FISHING_SHOP_BASE.z - 0.8);
   net.rotation.y = -Math.PI * 0.5;
   shop.add(net);

   const baitBench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.42, 0.9), shelfMat);
   baitBench.position.set(FISHING_SHOP_BASE.x - halfWidth + 1.7, floorY + 0.21, FISHING_SHOP_BASE.z + 1.5);
   shop.add(baitBench);
   for (let i = 0; i < 3; i += 1) {
     const tackleBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.38), accentMat);
     tackleBox.position.set(FISHING_SHOP_BASE.x - halfWidth + 1.0 + i * 0.68, floorY + 0.56, FISHING_SHOP_BASE.z + 1.5);
     shop.add(tackleBox);
   }

   const ceilingLight = new THREE.PointLight(0xfff4cc, 0.9, 9);
   ceilingLight.position.set(FISHING_SHOP_BASE.x, floorY + wallHeight - 1.5, FISHING_SHOP_BASE.z);
   shop.add(ceilingLight);
   const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6), ropeMat);
   rope.position.set(FISHING_SHOP_BASE.x, floorY + wallHeight - 0.75, FISHING_SHOP_BASE.z);
   shop.add(rope);

   const wallLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 10), shelfMat);
   wallLamp.rotation.z = Math.PI * 0.5;
   wallLamp.position.set(FISHING_SHOP_BASE.x - halfWidth + 0.18, floorY + 2.5, FISHING_SHOP_BASE.z - 0.8);
   shop.add(wallLamp);
   const wallLampGlow = new THREE.PointLight(0xfff3c4, 0.6, 4.5);
   wallLampGlow.position.set(FISHING_SHOP_BASE.x - halfWidth + 0.4, floorY + 2.5, FISHING_SHOP_BASE.z - 0.8);
   shop.add(wallLampGlow);

   shop.traverse((obj) => {
     if (!obj?.isMesh) return;
     obj.castShadow = true;
     obj.receiveShadow = true;
   });

   scene.add(shop);
  shop.visible = false;
  fishingShopGroup = shop;
  addWallCollisionFromMesh(backWall, 'fishing-shop');
  addWallCollisionFromMesh(leftWall, 'fishing-shop');
  addWallCollisionFromMesh(rightWall, 'fishing-shop');
  addWallCollisionFromMesh(frontLeftWall, 'fishing-shop');
  addWallCollisionFromMesh(frontRightWall, 'fishing-shop');
   addWallCollisionFromMesh(frontTopWall, 'fishing-shop');
   addWorldCollider(FISHING_SHOP_COUNTER_POS.x, FISHING_SHOP_COUNTER_POS.z, 2.2, 'fishing-shop');
}

function addMarketShopInterior() {
   const shop = new THREE.Group();
   const floorY = GROUND_Y;
   const wallHeight = 7.4;
   const wallThickness = 0.28;
   const halfDepth = SHOP_INTERIOR_HALF_DEPTH;
   const halfWidth = SHOP_INTERIOR_HALF_WIDTH;
   const doorWidth = 3.6;
   const doorHeight = 3.9;
   const wallCenterY = floorY + wallHeight * 0.5;
   const wallPaint = '#f59e0b';
   const floorPaint = '#5b4a3a';

   const wallMat = new THREE.MeshStandardMaterial({ color: wallPaint, roughness: 0.86 });
   const floorMat = new THREE.MeshStandardMaterial({ color: floorPaint, roughness: 0.92 });
   const trimMat = new THREE.MeshStandardMaterial({ color: 0x3b2f24, roughness: 0.88 });

   const floor = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.22, halfDepth * 2), floorMat);
   floor.position.set(MARKET_SHOP_BASE.x, floorY - 0.11, MARKET_SHOP_BASE.z);
   floor.receiveShadow = true;
   shop.add(floor);

   const ceiling = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.18, halfDepth * 2), trimMat);
   ceiling.position.set(MARKET_SHOP_BASE.x, floorY + wallHeight + 0.1, MARKET_SHOP_BASE.z);
   ceiling.receiveShadow = true;
   shop.add(ceiling);

   const backWall = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, wallHeight, wallThickness), wallMat);
   backWall.position.set(MARKET_SHOP_BASE.x, wallCenterY, MARKET_SHOP_BASE.z - halfDepth + wallThickness * 0.5);
   shop.add(backWall);

   const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, halfDepth * 2), wallMat);
   leftWall.position.set(MARKET_SHOP_BASE.x - halfWidth + wallThickness * 0.5, wallCenterY, MARKET_SHOP_BASE.z);
   shop.add(leftWall);

   const rightWall = leftWall.clone();
   rightWall.position.x = MARKET_SHOP_BASE.x + halfWidth - wallThickness * 0.5;
   shop.add(rightWall);

   const frontSideWidth = (halfWidth * 2 - doorWidth) * 0.5;
   const frontLeftWall = new THREE.Mesh(new THREE.BoxGeometry(frontSideWidth, wallHeight, wallThickness), wallMat);
   frontLeftWall.position.set(
     MARKET_SHOP_BASE.x - (doorWidth * 0.5 + frontSideWidth * 0.5),
     wallCenterY,
     MARKET_SHOP_BASE.z + halfDepth - wallThickness * 0.5
   );
   shop.add(frontLeftWall);

   const frontRightWall = frontLeftWall.clone();
   frontRightWall.position.x = MARKET_SHOP_BASE.x + (doorWidth * 0.5 + frontSideWidth * 0.5);
   shop.add(frontRightWall);

   const frontTopHeight = wallHeight - doorHeight;
   const frontTopWall = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, frontTopHeight, wallThickness), wallMat);
   frontTopWall.position.set(
     MARKET_SHOP_BASE.x,
     floorY + doorHeight + frontTopHeight * 0.5,
     MARKET_SHOP_BASE.z + halfDepth - wallThickness * 0.5
   );
   shop.add(frontTopWall);

   const counterMat = new THREE.MeshStandardMaterial({ color: 0x3b2f24, roughness: 0.84 });
   const displayMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.86 });
   const accentMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.2 });
   const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8b6b4f, roughness: 0.9 });
   const rugMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.85 });
   const netMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7, transparent: true, opacity: 0.55, side: THREE.DoubleSide });

   const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, doorHeight + 0.12, 0.16), trimMat);
   frameLeft.position.set(MARKET_SHOP_BASE.x - doorWidth * 0.5 + 0.09, floorY + (doorHeight + 0.12) * 0.5, MARKET_SHOP_BASE.z + halfDepth - wallThickness);
   shop.add(frameLeft);
   const frameRight = frameLeft.clone();
   frameRight.position.x = MARKET_SHOP_BASE.x + doorWidth * 0.5 - 0.09;
   shop.add(frameRight);
   const frameTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.18, 0.18, 0.16), trimMat);
   frameTop.position.set(MARKET_SHOP_BASE.x, floorY + doorHeight + 0.08, MARKET_SHOP_BASE.z + halfDepth - wallThickness);
   shop.add(frameTop);

   const counter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.84, 1.2), counterMat);
   counter.position.set(MARKET_SHOP_COUNTER_POS.x, floorY + 0.42, MARKET_SHOP_COUNTER_POS.z);
   counter.castShadow = true;
   counter.receiveShadow = true;
   shop.add(counter);

   const counterTop = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.05), displayMat);
   counterTop.position.set(MARKET_SHOP_COUNTER_POS.x, floorY + 0.92, MARKET_SHOP_COUNTER_POS.z);
   shop.add(counterTop);

   for (let i = -1; i <= 1; i += 1) {
     const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.7), displayMat);
     crate.position.set(MARKET_SHOP_BASE.x + i * 0.9, floorY + 0.21, MARKET_SHOP_BASE.z - 1.4);
     shop.add(crate);
     const fish = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), accentMat);
     fish.rotation.x = Math.PI / 2;
     fish.position.set(MARKET_SHOP_BASE.x + i * 0.9, floorY + 0.48, MARKET_SHOP_BASE.z - 1.4);
     shop.add(fish);
   }

   const vendor = createVendorNpc({
     shirtColor: 0xa16207,
     skinColor: 0xe0b18f,
     hairColor: 0x111827,
     hatColor: 0x3f2a1a
   });
   vendor.scale.setScalar(0.7);
   vendor.position.set(MARKET_SHOP_BASE.x, floorY, MARKET_SHOP_BASE.z - halfDepth + 1.4);
   vendor.rotation.y = 0;
   shop.add(vendor);

   const sign = makeTextSign('Fish Market', 3.6, 0.6, '#2f2417', '#fef3c7');
   sign.position.set(MARKET_SHOP_BASE.x, floorY + 3.6, MARKET_SHOP_BASE.z - halfDepth + 0.4);
   shop.add(sign);

   const doorMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.82 });
   const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.28, doorHeight - 0.12, 0.16), doorMat);
   exitDoor.position.set(MARKET_SHOP_BASE.x, floorY + (doorHeight - 0.12) * 0.5, MARKET_SHOP_BASE.z + halfDepth - wallThickness);
   shop.add(exitDoor);
   const exitDoorWindow = new THREE.Mesh(
     new THREE.BoxGeometry(1.2, 0.72, 0.06),
     new THREE.MeshStandardMaterial({ color: 0xbfdbfe, roughness: 0.28, metalness: 0.08, transparent: true, opacity: 0.68 })
   );
   exitDoorWindow.position.set(MARKET_SHOP_BASE.x, floorY + 2.55, MARKET_SHOP_BASE.z + halfDepth - wallThickness - 0.06);
   shop.add(exitDoorWindow);
   const exitHandle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), new THREE.MeshStandardMaterial({ color: 0xf8d17a, roughness: 0.25, metalness: 0.55 }));
   exitHandle.position.set(MARKET_SHOP_BASE.x + 1.22, floorY + 1.55, MARKET_SHOP_BASE.z + halfDepth - wallThickness - 0.1);
   shop.add(exitHandle);
   const exitRing = new THREE.Mesh(
     new THREE.TorusGeometry(0.9, 0.08, 12, 28),
     new THREE.MeshStandardMaterial({ color: 0x86efac, emissive: 0x22c55e, emissiveIntensity: 0.7, roughness: 0.3 })
   );
   exitRing.rotation.x = Math.PI * 0.5;
   exitRing.position.set(MARKET_SHOP_EXIT_POS.x, floorY + 0.05, MARKET_SHOP_EXIT_POS.z);
   shop.add(exitRing);
   marketShopExitMarker = exitRing;

   const rug = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.03, 3.0), rugMat);
   rug.position.set(MARKET_SHOP_BASE.x, floorY + 0.02, MARKET_SHOP_BASE.z - 0.2);
   shop.add(rug);

   const sideCounter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.4), counterMat);
   sideCounter.position.set(MARKET_SHOP_BASE.x - 4.2, floorY + 0.25, MARKET_SHOP_BASE.z + 0.6);
   shop.add(sideCounter);
   const iceBin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 1.2), displayMat);
   iceBin.position.set(MARKET_SHOP_BASE.x - 4.2, floorY + 0.52, MARKET_SHOP_BASE.z + 0.6);
   shop.add(iceBin);

   const net = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.0), netMat);
   net.position.set(MARKET_SHOP_BASE.x + halfWidth - 0.2, floorY + 2.6, MARKET_SHOP_BASE.z + 0.6);
   net.rotation.y = -Math.PI * 0.5;
   shop.add(net);

   for (let i = 0; i < 2; i += 1) {
     const basket = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.9), displayMat);
     basket.position.set(MARKET_SHOP_BASE.x + 3.4, floorY + 0.2, MARKET_SHOP_BASE.z - 0.8 + i * 1.1);
     shop.add(basket);
     const fishPile = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 12), accentMat);
     fishPile.rotation.x = Math.PI / 2;
     fishPile.position.set(MARKET_SHOP_BASE.x + 3.4, floorY + 0.45, MARKET_SHOP_BASE.z - 0.8 + i * 1.1);
     shop.add(fishPile);
   }

   const scalePole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8), counterMat);
   scalePole.position.set(MARKET_SHOP_BASE.x - 1.6, floorY + 1.0, MARKET_SHOP_BASE.z - 0.4);
   shop.add(scalePole);
   const scaleBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.06), counterMat);
   scaleBar.position.set(MARKET_SHOP_BASE.x - 1.6, floorY + 1.6, MARKET_SHOP_BASE.z - 0.4);
   shop.add(scaleBar);
   const scaleHook = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 10), accentMat);
   scaleHook.position.set(MARKET_SHOP_BASE.x - 1.6, floorY + 1.45, MARKET_SHOP_BASE.z - 0.4);
   shop.add(scaleHook);

   const ceilingLight = new THREE.PointLight(0xfff1c2, 0.85, 10);
   ceilingLight.position.set(MARKET_SHOP_BASE.x, floorY + wallHeight - 1.5, MARKET_SHOP_BASE.z);
   shop.add(ceilingLight);
   const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), ropeMat);
   rope.position.set(MARKET_SHOP_BASE.x, floorY + wallHeight - 0.8, MARKET_SHOP_BASE.z);
   shop.add(rope);

   const sellSign = makeTextSign('Sell Your Fish', 3.2, 0.5, '#4c2a0f', '#fffbeb');
   sellSign.position.set(MARKET_SHOP_BASE.x, floorY + 1.5, MARKET_SHOP_BASE.z - halfDepth + 0.5);
   shop.add(sellSign);

   shop.traverse((obj) => {
     if (!obj?.isMesh) return;
     obj.castShadow = true;
     obj.receiveShadow = true;
   });

   scene.add(shop);
   shop.visible = false;
   marketShopGroup = shop;
   addWallCollisionFromMesh(backWall, 'market-shop');
   addWallCollisionFromMesh(leftWall, 'market-shop');
   addWallCollisionFromMesh(rightWall, 'market-shop');
   addWallCollisionFromMesh(frontLeftWall, 'market-shop');
   addWallCollisionFromMesh(frontRightWall, 'market-shop');
   addWallCollisionFromMesh(frontTopWall, 'market-shop');
   addWorldCollider(MARKET_SHOP_COUNTER_POS.x, MARKET_SHOP_COUNTER_POS.z, 2.3, 'market-shop');
}

function addFurnitureShopInterior() {
   const shop = new THREE.Group();
   const floorY = GROUND_Y;
   const wallHeight = 7.4;
   const wallThickness = 0.28;
   const halfDepth = SHOP_INTERIOR_HALF_DEPTH;
   const halfWidth = SHOP_INTERIOR_HALF_WIDTH;
   const doorWidth = 3.6;
   const doorHeight = 3.9;
   const wallCenterY = floorY + wallHeight * 0.5;
   const wallPaint = '#8b5cf6';
   const floorPaint = '#5b4a3a';

   const wallMat = new THREE.MeshStandardMaterial({ color: wallPaint, roughness: 0.86 });
   const floorMat = new THREE.MeshStandardMaterial({ color: floorPaint, roughness: 0.92 });
   const trimMat = new THREE.MeshStandardMaterial({ color: 0x3b2f24, roughness: 0.88 });

   const floor = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.22, halfDepth * 2), floorMat);
   floor.position.set(FURNITURE_SHOP_BASE.x, floorY - 0.11, FURNITURE_SHOP_BASE.z);
   floor.receiveShadow = true;
   shop.add(floor);

   const ceiling = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.18, halfDepth * 2), trimMat);
   ceiling.position.set(FURNITURE_SHOP_BASE.x, floorY + wallHeight + 0.1, FURNITURE_SHOP_BASE.z);
   ceiling.receiveShadow = true;
   shop.add(ceiling);

   const backWall = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, wallHeight, wallThickness), wallMat);
   backWall.position.set(FURNITURE_SHOP_BASE.x, wallCenterY, FURNITURE_SHOP_BASE.z - halfDepth + wallThickness * 0.5);
   shop.add(backWall);

   const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, halfDepth * 2), wallMat);
   leftWall.position.set(FURNITURE_SHOP_BASE.x - halfWidth + wallThickness * 0.5, wallCenterY, FURNITURE_SHOP_BASE.z);
   shop.add(leftWall);

   const rightWall = leftWall.clone();
   rightWall.position.x = FURNITURE_SHOP_BASE.x + halfWidth - wallThickness * 0.5;
   shop.add(rightWall);

   const frontSideWidth = (halfWidth * 2 - doorWidth) * 0.5;
   const frontLeftWall = new THREE.Mesh(new THREE.BoxGeometry(frontSideWidth, wallHeight, wallThickness), wallMat);
   frontLeftWall.position.set(
     FURNITURE_SHOP_BASE.x - (doorWidth * 0.5 + frontSideWidth * 0.5),
     wallCenterY,
     FURNITURE_SHOP_BASE.z + halfDepth - wallThickness * 0.5
   );
   shop.add(frontLeftWall);

   const frontRightWall = frontLeftWall.clone();
   frontRightWall.position.x = FURNITURE_SHOP_BASE.x + (doorWidth * 0.5 + frontSideWidth * 0.5);
   shop.add(frontRightWall);

   const frontTopHeight = wallHeight - doorHeight;
   const frontTopWall = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, frontTopHeight, wallThickness), wallMat);
   frontTopWall.position.set(
     FURNITURE_SHOP_BASE.x,
     floorY + doorHeight + frontTopHeight * 0.5,
     FURNITURE_SHOP_BASE.z + halfDepth - wallThickness * 0.5
   );
   shop.add(frontTopWall);

   const counterMat = new THREE.MeshStandardMaterial({ color: 0x2f1e14, roughness: 0.84 });
   const displayMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.86 });
   const accentMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.38, metalness: 0.2 });
   const rugMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.85 });
   const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8b6b4f, roughness: 0.9 });

   const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, doorHeight + 0.12, 0.16), trimMat);
   frameLeft.position.set(FURNITURE_SHOP_BASE.x - doorWidth * 0.5 + 0.09, floorY + (doorHeight + 0.12) * 0.5, FURNITURE_SHOP_BASE.z + halfDepth - wallThickness);
   shop.add(frameLeft);
   const frameRight = frameLeft.clone();
   frameRight.position.x = FURNITURE_SHOP_BASE.x + doorWidth * 0.5 - 0.09;
   shop.add(frameRight);
   const frameTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.18, 0.18, 0.16), trimMat);
   frameTop.position.set(FURNITURE_SHOP_BASE.x, floorY + doorHeight + 0.08, FURNITURE_SHOP_BASE.z + halfDepth - wallThickness);
   shop.add(frameTop);

   const counter = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.86, 1.2), counterMat);
   counter.position.set(FURNITURE_SHOP_COUNTER_POS.x, floorY + 0.43, FURNITURE_SHOP_COUNTER_POS.z);
   counter.castShadow = true;
   counter.receiveShadow = true;
   shop.add(counter);

   const counterTop = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.1, 1.05), displayMat);
   counterTop.position.set(FURNITURE_SHOP_COUNTER_POS.x, floorY + 0.96, FURNITURE_SHOP_COUNTER_POS.z);
   shop.add(counterTop);

   const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.9), displayMat);
   sofa.position.set(FURNITURE_SHOP_BASE.x - 2.6, floorY + 0.25, FURNITURE_SHOP_BASE.z - 0.6);
   shop.add(sofa);
   const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.2), displayMat);
   sofaBack.position.set(FURNITURE_SHOP_BASE.x - 2.6, floorY + 0.8, FURNITURE_SHOP_BASE.z - 1.0);
   shop.add(sofaBack);

   const sideTable = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.72), displayMat);
   sideTable.position.set(FURNITURE_SHOP_BASE.x + 2.3, floorY + 0.21, FURNITURE_SHOP_BASE.z - 0.55);
   shop.add(sideTable);
   const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 8), counterMat);
   lampPole.position.set(FURNITURE_SHOP_BASE.x + 2.3, floorY + 0.99, FURNITURE_SHOP_BASE.z - 0.55);
   shop.add(lampPole);
   const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.34, 10), new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 }));
   lampShade.position.set(FURNITURE_SHOP_BASE.x + 2.3, floorY + 1.72, FURNITURE_SHOP_BASE.z - 0.55);
   shop.add(lampShade);
   const lampLight = new THREE.PointLight(0xfff1c2, 0.75, 6);
   lampLight.position.set(FURNITURE_SHOP_BASE.x + 2.3, floorY + 1.8, FURNITURE_SHOP_BASE.z - 0.55);
   shop.add(lampLight);

   const vendor = createVendorNpc({
     shirtColor: 0xfb7185,
     skinColor: 0xe0b18f,
     hairColor: 0x3f2a1a,
     hatColor: 0x7c2d12
   });
   vendor.scale.setScalar(0.7);
   vendor.position.set(FURNITURE_SHOP_BASE.x, floorY, FURNITURE_SHOP_BASE.z - halfDepth + 1.4);
   vendor.rotation.y = 0;
   shop.add(vendor);

   const sign = makeTextSign('Furniture', 3.6, 0.6, '#46271a', '#fffbeb');
   sign.position.set(FURNITURE_SHOP_BASE.x, floorY + 3.6, FURNITURE_SHOP_BASE.z - halfDepth + 0.4);
   shop.add(sign);

   const doorMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.82 });
   const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.28, doorHeight - 0.12, 0.16), doorMat);
   exitDoor.position.set(FURNITURE_SHOP_BASE.x, floorY + (doorHeight - 0.12) * 0.5, FURNITURE_SHOP_BASE.z + halfDepth - wallThickness);
   shop.add(exitDoor);
   const exitDoorWindow = new THREE.Mesh(
     new THREE.BoxGeometry(1.2, 0.72, 0.06),
     new THREE.MeshStandardMaterial({ color: 0xbfdbfe, roughness: 0.28, metalness: 0.08, transparent: true, opacity: 0.68 })
   );
   exitDoorWindow.position.set(FURNITURE_SHOP_BASE.x, floorY + 2.55, FURNITURE_SHOP_BASE.z + halfDepth - wallThickness - 0.06);
   shop.add(exitDoorWindow);
   const exitHandle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), new THREE.MeshStandardMaterial({ color: 0xf8d17a, roughness: 0.25, metalness: 0.55 }));
   exitHandle.position.set(FURNITURE_SHOP_BASE.x + 1.22, floorY + 1.55, FURNITURE_SHOP_BASE.z + halfDepth - wallThickness - 0.1);
   shop.add(exitHandle);
   const exitRing = new THREE.Mesh(
     new THREE.TorusGeometry(0.9, 0.08, 12, 28),
     new THREE.MeshStandardMaterial({ color: 0xfda4af, emissive: 0xfb7185, emissiveIntensity: 0.7, roughness: 0.3 })
   );
   exitRing.rotation.x = Math.PI * 0.5;
   exitRing.position.set(FURNITURE_SHOP_EXIT_POS.x, floorY + 0.05, FURNITURE_SHOP_EXIT_POS.z);
   shop.add(exitRing);
   furnitureShopExitMarker = exitRing;

   const rug = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.03, 3.2), rugMat);
   rug.position.set(FURNITURE_SHOP_BASE.x, floorY + 0.02, FURNITURE_SHOP_BASE.z - 0.2);
   shop.add(rug);

   const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.9), displayMat);
   chairSeat.position.set(FURNITURE_SHOP_BASE.x + 2.6, floorY + 0.25, FURNITURE_SHOP_BASE.z - 1.2);
   shop.add(chairSeat);
   const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.18), displayMat);
   chairBack.position.set(FURNITURE_SHOP_BASE.x + 2.6, floorY + 0.75, FURNITURE_SHOP_BASE.z - 1.6);
   shop.add(chairBack);

   const bedBase = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.36, 1.4), displayMat);
   bedBase.position.set(FURNITURE_SHOP_BASE.x - 3.6, floorY + 0.18, FURNITURE_SHOP_BASE.z + 0.8);
   shop.add(bedBase);
   const bedHead = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.18), displayMat);
   bedHead.position.set(FURNITURE_SHOP_BASE.x - 3.6, floorY + 0.55, FURNITURE_SHOP_BASE.z + 0.1);
   shop.add(bedHead);

   const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 1.2), displayMat);
   tableTop.position.set(FURNITURE_SHOP_BASE.x + 0.6, floorY + 0.6, FURNITURE_SHOP_BASE.z + 1.6);
   shop.add(tableTop);
   for (let ix = -1; ix <= 1; ix += 2) {
     for (let iz = -1; iz <= 1; iz += 2) {
       const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), displayMat);
       leg.position.set(FURNITURE_SHOP_BASE.x + 0.6 + ix * 0.7, floorY + 0.25, FURNITURE_SHOP_BASE.z + 1.6 + iz * 0.4);
       shop.add(leg);
     }
   }

   const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.2, 2.6), displayMat);
   shelf.position.set(FURNITURE_SHOP_BASE.x + halfWidth - 0.5, floorY + 1.1, FURNITURE_SHOP_BASE.z - 0.4);
   shop.add(shelf);
   for (let i = 0; i < 4; i += 1) {
     const book = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.6), accentMat);
     book.position.set(FURNITURE_SHOP_BASE.x + halfWidth - 1.0, floorY + 0.4 + i * 0.35, FURNITURE_SHOP_BASE.z - 1.2 + i * 0.35);
     shop.add(book);
   }

   const ceilingLight = new THREE.PointLight(0xfff1c2, 0.8, 9);
   ceilingLight.position.set(FURNITURE_SHOP_BASE.x, floorY + wallHeight - 1.5, FURNITURE_SHOP_BASE.z);
   shop.add(ceilingLight);
   const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), ropeMat);
   rope.position.set(FURNITURE_SHOP_BASE.x, floorY + wallHeight - 0.8, FURNITURE_SHOP_BASE.z);
   shop.add(rope);

   const buySign = makeTextSign('Browse Furniture', 3.2, 0.5, '#2f1e14', '#fffbeb');
   buySign.position.set(FURNITURE_SHOP_BASE.x, floorY + 1.5, FURNITURE_SHOP_BASE.z - halfDepth + 0.5);
   shop.add(buySign);

   shop.traverse((obj) => {
     if (!obj?.isMesh) return;
     obj.castShadow = true;
     obj.receiveShadow = true;
   });

   scene.add(shop);
   shop.visible = false;
  furnitureShopGroup = shop;
  addWallCollisionFromMesh(backWall, 'furniture-shop');
  addWallCollisionFromMesh(leftWall, 'furniture-shop');
  addWallCollisionFromMesh(rightWall, 'furniture-shop');
  addWallCollisionFromMesh(frontLeftWall, 'furniture-shop');
  addWallCollisionFromMesh(frontRightWall, 'furniture-shop');
   addWallCollisionFromMesh(frontTopWall, 'furniture-shop');
   addWorldCollider(FURNITURE_SHOP_COUNTER_POS.x, FURNITURE_SHOP_COUNTER_POS.z, 2.4, 'furniture-shop');
}

function addHouseHallInterior() {
  const hall = new THREE.Group();
  const floorY = GROUND_Y;
  const hallW = 13.4;
  const hallD = 24.0;
  const wallH = 4.6;
  const wallT = 0.25;
  const baseX = HOUSE_HALL_BASE.x;
  const baseZ = HOUSE_HALL_BASE.z;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.86 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 0.92 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x3b2f24, roughness: 0.88 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(hallW, 0.2, hallD), floorMat);
  floor.position.set(baseX, floorY, baseZ);
  floor.receiveShadow = true;
  hall.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(hallW, 0.2, hallD), ceilingMat);
  ceiling.position.set(baseX, floorY + wallH, baseZ);
  hall.add(ceiling);

  const ambientLight = new THREE.AmbientLight(0xcbd5e1, 0.34);
  const hallLightA = new THREE.PointLight(0xfef3c7, 0.6, 16, 2);
  hallLightA.position.set(baseX, floorY + 3.35, baseZ - 7);
  const hallLightB = hallLightA.clone();
  hallLightB.position.z = baseZ;
  const hallLightC = hallLightA.clone();
  hallLightC.position.z = baseZ + 7;
  hall.add(ambientLight, hallLightA, hallLightB, hallLightC);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(hallW, wallH, wallT), wallMat);
  backWall.position.set(baseX, floorY + wallH * 0.5, baseZ - hallD * 0.5 + wallT * 0.5);
  hall.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, hallD), wallMat);
  leftWall.position.set(baseX - hallW * 0.5 + wallT * 0.5, floorY + wallH * 0.5, baseZ);
  const rightWall = leftWall.clone();
  rightWall.position.x = baseX + hallW * 0.5 - wallT * 0.5;
  hall.add(leftWall, rightWall);

  const doorW = 3.4;
  const doorH = 3.2;
  const frontSideW = (hallW - doorW) * 0.5;
  const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSideW, wallH, wallT), wallMat);
  frontLeft.position.set(baseX - (doorW * 0.5 + frontSideW * 0.5), floorY + wallH * 0.5, baseZ + hallD * 0.5 - wallT * 0.5);
  const frontRight = frontLeft.clone();
  frontRight.position.x = baseX + (doorW * 0.5 + frontSideW * 0.5);
  const frontTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, wallH - doorH, wallT), wallMat);
  frontTop.position.set(baseX, floorY + doorH + (wallH - doorH) * 0.5, baseZ + hallD * 0.5 - wallT * 0.5);
  hall.add(frontLeft, frontRight, frontTop);

  addWallCollisionFromMesh(backWall, 'house-hall');
  addWallCollisionFromMesh(leftWall, 'house-hall');
  addWallCollisionFromMesh(rightWall, 'house-hall');
  addWallCollisionFromMesh(frontLeft, 'house-hall');
  addWallCollisionFromMesh(frontRight, 'house-hall');
  addWallCollisionFromMesh(frontTop, 'house-hall');

  const doorOffsets = [-7, 0, 7];
  const doorX = hallW * 0.5 - 0.7;
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.6,
    roughness: 0.3
  });

  houseHallRoomDoors.length = 0;
  for (let i = 0; i < HOUSE_ROOM_SLOT_COUNT; i += 1) {
    const row = Math.floor(i / 2);
    const isRight = i % 2 === 1;
    const z = baseZ + doorOffsets[row];
    const x = baseX + (isRight ? doorX : -doorX);

    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, doorH, 0.18), trimMat);
    const postL = post.clone();
    postL.position.set(-0.7, doorH * 0.5, 0);
    const postR = post.clone();
    postR.position.set(0.7, doorH * 0.5, 0);
    const header = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.2), trimMat);
    header.position.set(0, doorH + 0.05, 0);
    const frame = new THREE.Group();
    frame.add(postL, postR, header);
    frame.position.set(x, floorY, z);
    frame.rotation.y = isRight ? -Math.PI * 0.5 : Math.PI * 0.5;
    hall.add(frame);

    const sign = makeTextSign(`Room ${i + 1}`, 2.2, 0.5, '#1f2937', '#e2e8f0');
    sign.position.set(x, floorY + doorH + 0.45, z);
    sign.rotation.y = frame.rotation.y;
    hall.add(sign);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 10, 24), ringMat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.set(x, floorY + 0.05, z);
    hall.add(ring);

    houseHallRoomDoors.push({
      id: HOUSE_ROOM_IDS[i],
      position: new THREE.Vector3(x, 1.36, z),
      ring,
      sign
    });
  }

  const exitRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 12, 28), ringMat);
  exitRing.rotation.x = Math.PI * 0.5;
  exitRing.position.set(HOUSE_HALL_EXIT_POS.x, floorY + 0.05, HOUSE_HALL_EXIT_POS.z);
  hall.add(exitRing);
  houseHallExitMarker = exitRing;

  hall.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  hall.visible = false;
  scene.add(hall);
  houseHallGroup = hall;
}

function addLandmarks() {
  addDock(ISLAND_DOCK_POS, ISLAND_DOCK_YAW, { segments: 17, plankLength: 3.2, plankWidth: 3.2, spacing: 1.2 });
  addLighthouseIsland();
  addDock(LIGHTHOUSE_DOCK_POS, LIGHTHOUSE_DOCK_YAW, { segments: 12, plankLength: 2.8, plankWidth: 2.2, spacing: 1.1 });
  addMineEntryIsland();
  addDock(MINE_ENTRY_DOCK_POS, MINE_ENTRY_DOCK_YAW, { segments: 11, plankLength: 2.7, plankWidth: 2.1, spacing: 1.1 });
  addFishingIsland();
  addDock(FISHING_DOCK_POS, FISHING_DOCK_YAW, { segments: 11, plankLength: 2.8, plankWidth: 2.2, spacing: 1.05 });
  addMarketIsland();
  addDock(MARKET_DOCK_POS, MARKET_DOCK_YAW, { segments: 11, plankLength: 2.8, plankWidth: 2.2, spacing: 1.05 });
  addFurnitureIsland();
  addDock(FURNITURE_DOCK_POS, FURNITURE_DOCK_YAW, { segments: 11, plankLength: 2.8, plankWidth: 2.2, spacing: 1.05 });
  addLeaderboardIsland();
  addDock(LEADERBOARD_DOCK_POS, LEADERBOARD_DOCK_YAW, { segments: 11, plankLength: 2.8, plankWidth: 2.2, spacing: 1.05 });
   addLighthouseInterior();
   populateMainIslandNature();
   addBeaconIslandLights();
   addWoodHouse(HOUSE_POS.x, HOUSE_POS.z, 0, { collisions: false });
   addMainHouseRoomInterior();
   addHouseHallInterior();
   addFishingShopInterior();
   addMarketShopInterior();
   addFurnitureShopInterior();
  const cliffAngle = Math.atan2(-ISLAND_DOCK_POS.z, -ISLAND_DOCK_POS.x);
  addCliffAndWaterfall(Math.cos(cliffAngle) * worldLimit * 0.7, Math.sin(cliffAngle) * worldLimit * 0.7);
  const decorPos = findWaterSideSlot(ISLAND_DOCK_POS, ISLAND_DOCK_YAW, -1, 6.0, 3.2);
  addDecorBoat(
    decorPos.x,
    decorPos.z,
    ISLAND_DOCK_YAW - Math.PI * 0.18,
    0.58,
    1.08
  );
  addMineArea();
  addBoat();
}

addLandmarks();

const teleportOverlay = document.createElement('div');
teleportOverlay.style.position = 'fixed';
teleportOverlay.style.inset = '0';
teleportOverlay.style.background = 'radial-gradient(circle at 50% 42%, rgba(56, 189, 248, 0.28) 0%, rgba(2, 8, 20, 0.94) 70%)';
teleportOverlay.style.pointerEvents = 'none';
teleportOverlay.style.opacity = '0';
teleportOverlay.style.transition = 'opacity 240ms ease';
teleportOverlay.style.zIndex = '60';
teleportOverlay.style.display = 'flex';
teleportOverlay.style.alignItems = 'center';
teleportOverlay.style.justifyContent = 'center';
document.body.appendChild(teleportOverlay);

const teleportCard = document.createElement('div');
teleportCard.style.minWidth = '300px';
teleportCard.style.maxWidth = 'min(84vw, 460px)';
teleportCard.style.border = '1px solid rgba(148, 163, 184, 0.38)';
teleportCard.style.borderRadius = '16px';
teleportCard.style.background = 'linear-gradient(140deg, rgba(15,23,42,0.95), rgba(30,41,59,0.92))';
teleportCard.style.padding = '18px 20px 16px';
teleportCard.style.boxShadow = '0 26px 60px rgba(2, 6, 23, 0.5)';
teleportCard.style.opacity = '0';
teleportCard.style.transform = 'translateY(14px) scale(0.96)';
teleportCard.style.transition = 'opacity 220ms ease, transform 220ms ease';
teleportCard.style.backdropFilter = 'blur(8px)';
teleportOverlay.appendChild(teleportCard);

const teleportTitle = document.createElement('div');
teleportTitle.style.color = '#f8fafc';
teleportTitle.style.fontSize = '26px';
teleportTitle.style.fontWeight = '800';
teleportTitle.style.letterSpacing = '0.02em';
teleportCard.appendChild(teleportTitle);

const teleportSubtitle = document.createElement('div');
teleportSubtitle.style.color = 'rgba(191, 219, 254, 0.94)';
teleportSubtitle.style.fontSize = '14px';
teleportSubtitle.style.marginTop = '6px';
teleportSubtitle.style.letterSpacing = '0.02em';
teleportCard.appendChild(teleportSubtitle);

const teleportSweep = document.createElement('div');
teleportSweep.style.height = '3px';
teleportSweep.style.width = '100%';
teleportSweep.style.marginTop = '14px';
teleportSweep.style.borderRadius = '99px';
teleportSweep.style.background = 'linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.95) 45%, transparent 100%)';
teleportSweep.style.backgroundSize = '220% 100%';
teleportSweep.style.animation = 'teleportSweep 720ms linear infinite';
teleportCard.appendChild(teleportSweep);

const teleportStyleEl = document.createElement('style');
teleportStyleEl.textContent = '@keyframes teleportSweep{0%{background-position:130% 0}100%{background-position:-130% 0}}';
document.head.appendChild(teleportStyleEl);

function setTeleportTheme(type) {
  if (type === 'enter-mine') {
    teleportOverlay.style.background = 'radial-gradient(circle at 50% 35%, rgba(251, 191, 36, 0.26) 0%, rgba(2, 8, 20, 0.95) 72%)';
    teleportTitle.textContent = 'Entering Mines';
    teleportSubtitle.textContent = 'Heading underground...';
    teleportSweep.style.filter = 'hue-rotate(34deg)';
    return;
  }
  if (type === 'exit-mine') {
    teleportOverlay.style.background = 'radial-gradient(circle at 50% 35%, rgba(134, 239, 172, 0.24) 0%, rgba(2, 8, 20, 0.95) 72%)';
    teleportTitle.textContent = 'Exiting Mines';
    teleportSubtitle.textContent = 'Returning to the island...';
    teleportSweep.style.filter = 'hue-rotate(110deg)';
    return;
  }
  if (type === 'enter-lighthouse') {
    teleportOverlay.style.background = 'radial-gradient(circle at 50% 35%, rgba(125, 211, 252, 0.34) 0%, rgba(2, 8, 20, 0.95) 70%)';
    teleportTitle.textContent = 'Entering Lighthouse';
    teleportSubtitle.textContent = 'Stepping through the doorway...';
    teleportSweep.style.filter = 'hue-rotate(0deg)';
    return;
  }
  if (type === 'exit-lighthouse') {
    teleportOverlay.style.background = 'radial-gradient(circle at 50% 35%, rgba(250, 204, 21, 0.26) 0%, rgba(2, 8, 20, 0.95) 74%)';
    teleportTitle.textContent = 'Climbing To Lantern Deck';
    teleportSubtitle.textContent = 'Wind and ocean coming into view...';
    teleportSweep.style.filter = 'hue-rotate(58deg)';
    return;
  }
  if (type === 'enter-home') {
    teleportOverlay.style.background = 'radial-gradient(circle at 50% 35%, rgba(34, 211, 238, 0.28) 0%, rgba(2, 8, 20, 0.95) 72%)';
    teleportTitle.textContent = 'Entering House';
    teleportSubtitle.textContent = 'Stepping into the hall...';
    teleportSweep.style.filter = 'hue-rotate(6deg)';
    return;
  }
  if (type === 'exit-home') {
    teleportOverlay.style.background = 'radial-gradient(circle at 50% 35%, rgba(251, 191, 36, 0.24) 0%, rgba(2, 8, 20, 0.95) 72%)';
    teleportTitle.textContent = 'Leaving House';
    teleportSubtitle.textContent = 'Back to the island...';
    teleportSweep.style.filter = 'hue-rotate(44deg)';
    return;
  }
  teleportOverlay.style.background = 'radial-gradient(circle at 50% 42%, rgba(56, 189, 248, 0.28) 0%, rgba(2, 8, 20, 0.94) 70%)';
  teleportTitle.textContent = 'Teleporting';
  teleportSubtitle.textContent = 'Please wait...';
  teleportSweep.style.filter = 'hue-rotate(0deg)';
}

function runTeleportTransition(type, callback) {
  if (isTeleporting) return;
  isTeleporting = true;
  teleportTriggerLockUntil = Math.max(teleportTriggerLockUntil, performance.now() + 420);
  setTeleportTheme(type);
  renderer.domElement.style.transition = 'filter 320ms ease, transform 320ms ease';
  renderer.domElement.style.filter = 'blur(2px) saturate(1.15) brightness(1.08)';
  renderer.domElement.style.transform = (type === 'exit-lighthouse' || type === 'exit-mine' || type === 'exit-home') ? 'scale(0.985)' : 'scale(1.02)';
  teleportOverlay.style.opacity = '1';
  teleportCard.style.opacity = '1';
  teleportCard.style.transform = 'translateY(0) scale(1)';
  window.setTimeout(() => {
    callback();
    if (type === 'exit-lighthouse') {
      teleportSubtitle.textContent = 'You made it to the top.';
    } else if (type === 'enter-mine') {
      teleportSubtitle.textContent = 'Watch your step down here.';
    } else if (type === 'exit-mine') {
      teleportSubtitle.textContent = 'Back in the fresh air.';
    } else if (type === 'enter-home') {
      teleportSubtitle.textContent = 'Home sweet home.';
    } else if (type === 'exit-home') {
      teleportSubtitle.textContent = 'Back outside.';
    } else {
      teleportSubtitle.textContent = 'Welcome inside.';
    }
    teleportOverlay.style.opacity = '0';
    teleportCard.style.opacity = '0';
    teleportCard.style.transform = 'translateY(16px) scale(0.95)';
    renderer.domElement.style.filter = 'none';
    renderer.domElement.style.transform = 'scale(1)';
    window.setTimeout(() => {
      teleportTriggerLockUntil = Math.max(teleportTriggerLockUntil, performance.now() + TELEPORT_TRIGGER_COOLDOWN_MS);
      isTeleporting = false;
    }, 320);
  }, 380);
}

function resolveBoatShoreCollision(x, z) {
  let nextX = x;
  let nextZ = z;
  let collided = false;
  const circles = [
    { cx: 0, cz: 0, radius: BOAT_CLEARANCE_MAIN },
    { cx: LIGHTHOUSE_POS.x, cz: LIGHTHOUSE_POS.z, radius: BOAT_CLEARANCE_LIGHTHOUSE },
    { cx: MINE_ENTRY_ISLAND_POS.x, cz: MINE_ENTRY_ISLAND_POS.z, radius: BOAT_CLEARANCE_MINE_ENTRY },
    { cx: FISHING_ISLAND_POS.x, cz: FISHING_ISLAND_POS.z, radius: BOAT_CLEARANCE_FISHING },
    { cx: MARKET_ISLAND_POS.x, cz: MARKET_ISLAND_POS.z, radius: BOAT_CLEARANCE_MARKET },
    { cx: LEADERBOARD_ISLAND_POS.x, cz: LEADERBOARD_ISLAND_POS.z, radius: BOAT_CLEARANCE_LEADERBOARD }
  ];
  for (const circle of circles) {
    const dx = nextX - circle.cx;
    const dz = nextZ - circle.cz;
    const dist = Math.hypot(dx, dz);
    if (dist < circle.radius) {
      const safe = circle.radius / (dist || 1);
      nextX = circle.cx + dx * safe;
      nextZ = circle.cz + dz * safe;
      collided = true;
    }
  }
  return { x: nextX, z: nextZ, collided };
}

const beaconGroup = new THREE.Group();
const beaconPedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(1.15, 1.35, 1.0, 18),
  new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.7 })
);
beaconPedestal.position.y = 1.85;
beaconPedestal.castShadow = true;
beaconPedestal.receiveShadow = true;

const beaconCore = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.9, 0),
  new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0c4a6e,
    emissiveIntensity: 0.4,
    roughness: 0.15,
    metalness: 0.25
  })
);
beaconCore.position.y = 3.0;
beaconCore.castShadow = true;

beaconGroup.add(beaconPedestal);
beaconGroup.add(beaconCore);
scene.add(beaconGroup);

const rainCount = 700;
const rainPositions = new Float32Array(rainCount * 3);
for (let i = 0; i < rainCount; i += 1) {
  const idx = i * 3;
  rainPositions[idx] = (Math.random() - 0.5) * 180;
  rainPositions[idx + 1] = Math.random() * 35 + 4;
  rainPositions[idx + 2] = (Math.random() - 0.5) * 180;
}
const rainGeometry = new THREE.BufferGeometry();
rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
const rain = new THREE.Points(
  rainGeometry,
  new THREE.PointsMaterial({ color: 0xb9e6ff, size: 0.14, transparent: true, opacity: 0.65 })
);
rain.visible = false;
scene.add(rain);
let rainParticleUpdateCount = rainCount;

function applyPerformanceMode({ persist = true } = {}) {
  lowPerformanceMode = graphicsPreset === 'performance';
  if (graphicsPreset === 'performance') {
    renderPixelRatioCap = PERFORMANCE_RENDER_PIXEL_RATIO_CAP;
    previewPixelRatioCap = PERFORMANCE_PREVIEW_PIXEL_RATIO_CAP;
    voiceUpdateIntervalMs = PERFORMANCE_VOICE_UPDATE_INTERVAL_MS;
    waterfallUpdateIntervalMs = PERFORMANCE_WATERFALL_UPDATE_INTERVAL_MS;
    minimapDrawIntervalMs = PERFORMANCE_MINIMAP_DRAW_INTERVAL_MS;
    shadowMapSize = PERFORMANCE_SHADOW_MAP_SIZE;
    rainParticleUpdateCount = 220;
    nameTagUpdateIntervalMs = PERFORMANCE_NAME_TAG_UPDATE_INTERVAL_MS;
    remotePlayerUpdateIntervalMs = PERFORMANCE_REMOTE_PLAYER_UPDATE_INTERVAL_MS;
    cameraFarDistance = PERFORMANCE_CAMERA_FAR;
  } else if (graphicsPreset === 'balanced') {
    renderPixelRatioCap = BALANCED_RENDER_PIXEL_RATIO_CAP;
    previewPixelRatioCap = BALANCED_PREVIEW_PIXEL_RATIO_CAP;
    voiceUpdateIntervalMs = BALANCED_VOICE_UPDATE_INTERVAL_MS;
    waterfallUpdateIntervalMs = BALANCED_WATERFALL_UPDATE_INTERVAL_MS;
    minimapDrawIntervalMs = BALANCED_MINIMAP_DRAW_INTERVAL_MS;
    shadowMapSize = BALANCED_SHADOW_MAP_SIZE;
    rainParticleUpdateCount = 520;
    nameTagUpdateIntervalMs = BALANCED_NAME_TAG_UPDATE_INTERVAL_MS;
    remotePlayerUpdateIntervalMs = BALANCED_REMOTE_PLAYER_UPDATE_INTERVAL_MS;
    cameraFarDistance = BALANCED_CAMERA_FAR;
  } else {
    renderPixelRatioCap = QUALITY_RENDER_PIXEL_RATIO_CAP;
    previewPixelRatioCap = QUALITY_PREVIEW_PIXEL_RATIO_CAP;
    voiceUpdateIntervalMs = QUALITY_VOICE_UPDATE_INTERVAL_MS;
    waterfallUpdateIntervalMs = QUALITY_WATERFALL_UPDATE_INTERVAL_MS;
    minimapDrawIntervalMs = QUALITY_MINIMAP_DRAW_INTERVAL_MS;
    shadowMapSize = QUALITY_SHADOW_MAP_SIZE;
    rainParticleUpdateCount = rainCount;
    nameTagUpdateIntervalMs = QUALITY_NAME_TAG_UPDATE_INTERVAL_MS;
    remotePlayerUpdateIntervalMs = QUALITY_REMOTE_PLAYER_UPDATE_INTERVAL_MS;
    cameraFarDistance = QUALITY_CAMERA_FAR;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, renderPixelRatioCap));
  renderer.shadowMap.enabled = graphicsPreset !== 'performance';
  sun.castShadow = graphicsPreset !== 'performance';
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.needsUpdate = true;
  camera.far = cameraFarDistance;
  camera.updateProjectionMatrix();
  rainGeometry.setDrawRange(0, rainParticleUpdateCount);

  if (previewRenderer) {
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, previewPixelRatioCap));
    previewRenderWidth = 0;
    previewRenderHeight = 0;
  }

  if (cliffWaterfallRoot) {
    cliffWaterfallRoot.visible = graphicsPreset !== 'performance';
  }

  setMinimapCanvasSize(minimapEnabled && minimapExpanded);

  if (persist) {
    localStorage.setItem('island_graphics_preset', graphicsPreset);
    localStorage.setItem('island_low_performance_mode', lowPerformanceMode ? '1' : '0');
  }
  updatePerformanceToggleLabel();
}

applyPerformanceMode({ persist: false });

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

function normalizeAppearance(value, fallback = defaultAppearance()) {
  const source = value && typeof value === 'object' ? value : {};
  const hairStyle = ['none', 'short', 'sidepart', 'spiky', 'long', 'ponytail', 'bob', 'wavy'].includes(source.hairStyle)
    ? source.hairStyle
    : fallback.hairStyle;
  const faceStyle = ['smile', 'serious', 'grin', 'wink', 'lashessmile', 'soft'].includes(source.faceStyle)
    ? source.faceStyle
    : fallback.faceStyle;
  const accessories = Array.isArray(source.accessories)
    ? source.accessories.filter((item) => ['hat', 'glasses', 'backpack'].includes(item))
    : Array.isArray(fallback.accessories)
      ? fallback.accessories.filter((item) => ['hat', 'glasses', 'backpack'].includes(item))
      : [];
  const toColor = (input, base) => (/^#[0-9a-fA-F]{6}$/.test(input || '') ? input : base);

  return {
    skin: toColor(source.skin, fallback.skin),
    shirt: toColor(source.shirt ?? source.color, fallback.shirt),
    pants: toColor(source.pants, fallback.pants),
    shoes: toColor(source.shoes, fallback.shoes),
    hairStyle,
    hairColor: toColor(source.hairColor, fallback.hairColor),
    faceStyle,
    accessories: [...new Set(accessories)]
  };
}

function clampToIsland(x, z, limit) {
  const radius = Math.hypot(x, z);
  if (radius <= limit) return { x, z };
  const scale = limit / (radius || 1);
  return { x: x * scale, z: z * scale };
}

function clampToRing(x, z, minRadius, maxRadius) {
  const radius = Math.hypot(x, z) || 1;
  if (radius >= minRadius && radius <= maxRadius) return { x, z };
  const targetRadius = radius < minRadius ? minRadius : maxRadius;
  const scale = targetRadius / radius;
  return { x: x * scale, z: z * scale };
}

function mineDistance(x, z) {
  return Math.hypot(x - MINE_POS.x, z - MINE_POS.z);
}

function blocksMineEscapeSwim(x, z) {
  return mineDistance(x, z) <= MINE_SWIM_BLOCK_RADIUS;
}

function isSwimZone(x, z) {
  const radius = Math.hypot(x, z);
  return radius >= SWIM_MIN_RADIUS && radius <= SWIM_MAX_RADIUS;
}

function sampleInteriorStairHeight(x, z, currentY) {
  if (!inLighthouseInterior) return null;
  const dx = x - LIGHTHOUSE_INTERIOR_BASE.x;
  const dz = z - LIGHTHOUSE_INTERIOR_BASE.z;
  const radius = Math.hypot(dx, dz);
  if (radius <= 4.6 && currentY >= INTERIOR_TOP_POS.y - 3.0) {
    return INTERIOR_TOP_POS.y + 0.1;
  }
  if (radius >= 5.0 && radius <= INTERIOR_PLAY_RADIUS - 0.2 && currentY >= INTERIOR_TOP_POS.y - 2.2) {
    return INTERIOR_TOP_POS.y - 0.42;
  }
  if (radius < INTERIOR_STAIR_RADIUS - 1.15 || radius > INTERIOR_STAIR_RADIUS + 1.9) return null;

  let angle = Math.atan2(dz, dx);
  if (angle < 0) angle += Math.PI * 2;
  const risePerRadian = INTERIOR_STAIR_RISE / INTERIOR_STAIR_ANGLE_STEP;
  const startY = INTERIOR_STAIR_START_Y;
  const maxAngle = (INTERIOR_STAIR_STEPS - 1) * INTERIOR_STAIR_ANGLE_STEP;
  let bestY = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let turns = 0; turns <= 5; turns += 1) {
    const spiralAngle = angle + turns * Math.PI * 2;
    if (spiralAngle < 0 || spiralAngle > maxAngle + 0.5) continue;
    const y = startY + spiralAngle * risePerRadian + 0.07;
    const dist = Math.abs(y - currentY);
    if (dist < bestDist) {
      bestDist = dist;
      bestY = y;
    }
  }
  if (!Number.isFinite(bestY)) return null;
  return THREE.MathUtils.clamp(bestY, GROUND_Y, INTERIOR_TOP_POS.y + 0.12);
}

function clampToPlayableGround(x, z, allowMine = false) {
  const MAIN_RADIUS = worldLimit * 1.14;
  const LIGHTHOUSE_RADIUS = 10.9;
  const MINE_ENTRY_RADIUS = MINE_ENTRY_ISLAND_RADIUS;
  const FISHING_RADIUS = FISHING_ISLAND_RADIUS;
  const MARKET_RADIUS = MARKET_ISLAND_RADIUS;
  const LEADERBOARD_RADIUS = LEADERBOARD_ISLAND_RADIUS;
  const INTERIOR_RADIUS = INTERIOR_PLAY_RADIUS;
  const HOUSE_ROOM_RADIUS = HOUSE_ROOM_PLAY_RADIUS;
  const HOUSE_HALL_RADIUS = HOUSE_HALL_PLAY_RADIUS;
  const SHOP_RADIUS = SHOP_INTERIOR_RADIUS;
  const mineSwimBlocked = allowMine && blocksMineEscapeSwim(x, z);
  const inSwim = isSwimZone(x, z) && !mineSwimBlocked;

  const inMain = Math.hypot(x, z) <= MAIN_RADIUS;
  const dxL = x - LIGHTHOUSE_POS.x;
  const dzL = z - LIGHTHOUSE_POS.z;
  const inLighthouse = Math.hypot(dxL, dzL) <= LIGHTHOUSE_RADIUS;
  const dxE = x - MINE_ENTRY_ISLAND_POS.x;
  const dzE = z - MINE_ENTRY_ISLAND_POS.z;
  const inMineEntryIsland = Math.hypot(dxE, dzE) <= MINE_ENTRY_RADIUS;
  const dxF = x - FISHING_ISLAND_POS.x;
  const dzF = z - FISHING_ISLAND_POS.z;
  const inFishingIsland = Math.hypot(dxF, dzF) <= FISHING_RADIUS;
  const dxK = x - MARKET_ISLAND_POS.x;
  const dzK = z - MARKET_ISLAND_POS.z;
  const inMarketIsland = Math.hypot(dxK, dzK) <= MARKET_RADIUS;
  const dxB = x - LEADERBOARD_ISLAND_POS.x;
  const dzB = z - LEADERBOARD_ISLAND_POS.z;
  const inLeaderboardIsland = Math.hypot(dxB, dzB) <= LEADERBOARD_RADIUS;
  const dxI = x - LIGHTHOUSE_INTERIOR_BASE.x;
  const dzI = z - LIGHTHOUSE_INTERIOR_BASE.z;
  const inInterior = Math.hypot(dxI, dzI) <= INTERIOR_RADIUS;
  const dxH = x - HOUSE_ROOM_BASE.x;
  const dzH = z - HOUSE_ROOM_BASE.z;
  const inHouseRoomZone = Math.hypot(dxH, dzH) <= HOUSE_ROOM_RADIUS;
  const dxHH = x - HOUSE_HALL_BASE.x;
  const dzHH = z - HOUSE_HALL_BASE.z;
  const inHouseHallZone = Math.hypot(dxHH, dzHH) <= HOUSE_HALL_RADIUS;
  const dxFS = x - FISHING_SHOP_BASE.x;
  const dzFS = z - FISHING_SHOP_BASE.z;
  const inFishingShopZone = Math.hypot(dxFS, dzFS) <= SHOP_RADIUS;
  const dxMS = x - MARKET_SHOP_BASE.x;
  const dzMS = z - MARKET_SHOP_BASE.z;
  const inMarketShopZone = Math.hypot(dxMS, dzMS) <= SHOP_RADIUS;
  const dxRS = x - FURNITURE_SHOP_BASE.x;
  const dzRS = z - FURNITURE_SHOP_BASE.z;
  const inFurnitureShopZone = Math.hypot(dxRS, dzRS) <= SHOP_RADIUS;
  const dxM = x - MINE_POS.x;
  const dzM = z - MINE_POS.z;
  const inMine = allowMine && mineDistance(x, z) <= MINE_PLAY_RADIUS;
  if (
    inMain
    || inLighthouse
    || inMineEntryIsland
    || inFishingIsland
    || inMarketIsland
    || inLeaderboardIsland
    || inInterior
    || inHouseRoomZone
    || inHouseHallZone
    || inFishingShopZone
    || inMarketShopZone
    || inFurnitureShopZone
    || inMine
    || inSwim
  ) {
    return { x, z };
  }

  const toMain = clampToIsland(x, z, MAIN_RADIUS);
  const distMain = Math.hypot(x - toMain.x, z - toMain.z);
  const lenL = Math.hypot(dxL, dzL) || 1;
  const toLight = {
    x: LIGHTHOUSE_POS.x + (dxL / lenL) * LIGHTHOUSE_RADIUS,
    z: LIGHTHOUSE_POS.z + (dzL / lenL) * LIGHTHOUSE_RADIUS
  };
  const distLight = Math.hypot(x - toLight.x, z - toLight.z);
  const lenE = Math.hypot(dxE, dzE) || 1;
  const toMineEntry = {
    x: MINE_ENTRY_ISLAND_POS.x + (dxE / lenE) * MINE_ENTRY_RADIUS,
    z: MINE_ENTRY_ISLAND_POS.z + (dzE / lenE) * MINE_ENTRY_RADIUS
  };
  const distMineEntry = Math.hypot(x - toMineEntry.x, z - toMineEntry.z);
  const lenF = Math.hypot(dxF, dzF) || 1;
  const toFishing = {
    x: FISHING_ISLAND_POS.x + (dxF / lenF) * FISHING_RADIUS,
    z: FISHING_ISLAND_POS.z + (dzF / lenF) * FISHING_RADIUS
  };
  const distFishing = Math.hypot(x - toFishing.x, z - toFishing.z);
  const lenK = Math.hypot(dxK, dzK) || 1;
  const toMarket = {
    x: MARKET_ISLAND_POS.x + (dxK / lenK) * MARKET_RADIUS,
    z: MARKET_ISLAND_POS.z + (dzK / lenK) * MARKET_RADIUS
  };
  const distMarket = Math.hypot(x - toMarket.x, z - toMarket.z);
  const lenB = Math.hypot(dxB, dzB) || 1;
  const toLeaderboard = {
    x: LEADERBOARD_ISLAND_POS.x + (dxB / lenB) * LEADERBOARD_RADIUS,
    z: LEADERBOARD_ISLAND_POS.z + (dzB / lenB) * LEADERBOARD_RADIUS
  };
  const distLeaderboard = Math.hypot(x - toLeaderboard.x, z - toLeaderboard.z);
  const lenI = Math.hypot(dxI, dzI) || 1;
  const toInterior = {
    x: LIGHTHOUSE_INTERIOR_BASE.x + (dxI / lenI) * INTERIOR_RADIUS,
    z: LIGHTHOUSE_INTERIOR_BASE.z + (dzI / lenI) * INTERIOR_RADIUS
  };
  const distInterior = Math.hypot(x - toInterior.x, z - toInterior.z);
  const lenH = Math.hypot(dxH, dzH) || 1;
  const toHouseRoom = {
    x: HOUSE_ROOM_BASE.x + (dxH / lenH) * HOUSE_ROOM_RADIUS,
    z: HOUSE_ROOM_BASE.z + (dzH / lenH) * HOUSE_ROOM_RADIUS
  };
  const distHouseRoom = Math.hypot(x - toHouseRoom.x, z - toHouseRoom.z);
  const lenFS = Math.hypot(dxFS, dzFS) || 1;
  const toFishingShop = {
    x: FISHING_SHOP_BASE.x + (dxFS / lenFS) * SHOP_RADIUS,
    z: FISHING_SHOP_BASE.z + (dzFS / lenFS) * SHOP_RADIUS
  };
  const distFishingShop = Math.hypot(x - toFishingShop.x, z - toFishingShop.z);
  const lenMS = Math.hypot(dxMS, dzMS) || 1;
  const toMarketShop = {
    x: MARKET_SHOP_BASE.x + (dxMS / lenMS) * SHOP_RADIUS,
    z: MARKET_SHOP_BASE.z + (dzMS / lenMS) * SHOP_RADIUS
  };
  const distMarketShop = Math.hypot(x - toMarketShop.x, z - toMarketShop.z);
  const lenRS = Math.hypot(dxRS, dzRS) || 1;
  const toFurnitureShop = {
    x: FURNITURE_SHOP_BASE.x + (dxRS / lenRS) * SHOP_RADIUS,
    z: FURNITURE_SHOP_BASE.z + (dzRS / lenRS) * SHOP_RADIUS
  };
  const distFurnitureShop = Math.hypot(x - toFurnitureShop.x, z - toFurnitureShop.z);
  const lenM = Math.hypot(dxM, dzM) || 1;
  const toMine = {
    x: MINE_POS.x + (dxM / lenM) * MINE_PLAY_RADIUS,
    z: MINE_POS.z + (dzM / lenM) * MINE_PLAY_RADIUS
  };
  const distMine = allowMine ? Math.hypot(x - toMine.x, z - toMine.z) : Number.POSITIVE_INFINITY;
  const toSwim = clampToRing(x, z, SWIM_MIN_RADIUS, SWIM_MAX_RADIUS);
  const distSwim = mineSwimBlocked ? Number.POSITIVE_INFINITY : Math.hypot(x - toSwim.x, z - toSwim.z);
  if (distMain <= distLight && distMain <= distMineEntry && distMain <= distFishing && distMain <= distMarket && distMain <= distLeaderboard && distMain <= distInterior && distMain <= distHouseRoom && distMain <= distFishingShop && distMain <= distMarketShop && distMain <= distFurnitureShop && distMain <= distMine && distMain <= distSwim) return toMain;
  if (distLight <= distMineEntry && distLight <= distFishing && distLight <= distMarket && distLight <= distLeaderboard && distLight <= distInterior && distLight <= distHouseRoom && distLight <= distFishingShop && distLight <= distMarketShop && distLight <= distFurnitureShop && distLight <= distMine && distLight <= distSwim) return toLight;
  if (distMineEntry <= distFishing && distMineEntry <= distMarket && distMineEntry <= distLeaderboard && distMineEntry <= distInterior && distMineEntry <= distHouseRoom && distMineEntry <= distFishingShop && distMineEntry <= distMarketShop && distMineEntry <= distFurnitureShop && distMineEntry <= distMine && distMineEntry <= distSwim) return toMineEntry;
  if (distFishing <= distMarket && distFishing <= distLeaderboard && distFishing <= distInterior && distFishing <= distHouseRoom && distFishing <= distFishingShop && distFishing <= distMarketShop && distFishing <= distFurnitureShop && distFishing <= distMine && distFishing <= distSwim) return toFishing;
  if (distMarket <= distLeaderboard && distMarket <= distInterior && distMarket <= distHouseRoom && distMarket <= distFishingShop && distMarket <= distMarketShop && distMarket <= distFurnitureShop && distMarket <= distMine && distMarket <= distSwim) return toMarket;
  if (distLeaderboard <= distInterior && distLeaderboard <= distHouseRoom && distLeaderboard <= distFishingShop && distLeaderboard <= distMarketShop && distLeaderboard <= distFurnitureShop && distLeaderboard <= distMine && distLeaderboard <= distSwim) return toLeaderboard;
  if (distInterior <= distHouseRoom && distInterior <= distFishingShop && distInterior <= distMarketShop && distInterior <= distFurnitureShop && distInterior <= distMine && distInterior <= distSwim) return toInterior;
  if (distHouseRoom <= distFishingShop && distHouseRoom <= distMarketShop && distHouseRoom <= distFurnitureShop && distHouseRoom <= distMine && distHouseRoom <= distSwim) return toHouseRoom;
  if (distFishingShop <= distMarketShop && distFishingShop <= distFurnitureShop && distFishingShop <= distMine && distFishingShop <= distSwim) return toFishingShop;
  if (distMarketShop <= distFurnitureShop && distMarketShop <= distMine && distMarketShop <= distSwim) return toMarketShop;
  if (distFurnitureShop <= distMine && distFurnitureShop <= distSwim) return toFurnitureShop;
  if (distMine <= distSwim) return toMine;
  return toSwim;
}

function isWaterAt(x, z) {
  const radius = Math.hypot(x, z);
  if (radius > SWIM_MAX_RADIUS) return false;
  if (inMine && blocksMineEscapeSwim(x, z)) return false;

  // Brute-force dock safety: never treat areas around docks as water.
  if (Math.hypot(x - ISLAND_DOCK_POS.x, z - ISLAND_DOCK_POS.z) <= 16) return false;
  if (Math.hypot(x - LIGHTHOUSE_DOCK_POS.x, z - LIGHTHOUSE_DOCK_POS.z) <= 14) return false;
  if (Math.hypot(x - MINE_ENTRY_DOCK_POS.x, z - MINE_ENTRY_DOCK_POS.z) <= 14) return false;
  if (Math.hypot(x - FISHING_DOCK_POS.x, z - FISHING_DOCK_POS.z) <= 14) return false;
  if (Math.hypot(x - MARKET_DOCK_POS.x, z - MARKET_DOCK_POS.z) <= 14) return false;
  if (Math.hypot(x - FURNITURE_DOCK_POS.x, z - FURNITURE_DOCK_POS.z) <= 14) return false;
  if (Math.hypot(x - LEADERBOARD_DOCK_POS.x, z - LEADERBOARD_DOCK_POS.z) <= 14) return false;

  const angle = Math.atan2(z, x);
  const shorelineRadius = mainIslandRadiusAtAngle(angle) + 9.5;
  if (radius <= shorelineRadius) return false;

  // The dock-side beach uses custom blended geometry that can extend beyond radialShape.
  // Keep that blended shoreline region dry so players walk there instead of swimming.
  const dockRadius = Math.hypot(ISLAND_DOCK_POS.x, ISLAND_DOCK_POS.z);
  const nearMainDockBeach = distance2D({ x, z }, ISLAND_DOCK_POS) < 11.4 && radius <= dockRadius + 3.2;
  if (nearMainDockBeach) return false;

  const dxL = x - LIGHTHOUSE_POS.x;
  const dzL = z - LIGHTHOUSE_POS.z;
  const onLighthouseIslandLand = Math.hypot(dxL, dzL) <= 15.4;
  if (onLighthouseIslandLand) return false;
  const dxE = x - MINE_ENTRY_ISLAND_POS.x;
  const dzE = z - MINE_ENTRY_ISLAND_POS.z;
  const onMineEntryIslandLand = Math.hypot(dxE, dzE) <= MINE_ENTRY_ISLAND_RADIUS + 3.4;
  if (onMineEntryIslandLand) return false;
  const dxF = x - FISHING_ISLAND_POS.x;
  const dzF = z - FISHING_ISLAND_POS.z;
  const onFishingIslandLand = Math.hypot(dxF, dzF) <= FISHING_ISLAND_RADIUS + 3.2;
  if (onFishingIslandLand) return false;
  const dxK = x - MARKET_ISLAND_POS.x;
  const dzK = z - MARKET_ISLAND_POS.z;
  const onMarketIslandLand = Math.hypot(dxK, dzK) <= MARKET_ISLAND_RADIUS + 3.2;
  if (onMarketIslandLand) return false;
  const dxR = x - FURNITURE_ISLAND_POS.x;
  const dzR = z - FURNITURE_ISLAND_POS.z;
  const onFurnitureIslandLand = Math.hypot(dxR, dzR) <= FURNITURE_ISLAND_RADIUS + 3.2;
  if (onFurnitureIslandLand) return false;
  const dxB = x - LEADERBOARD_ISLAND_POS.x;
  const dzB = z - LEADERBOARD_ISLAND_POS.z;
  const onLeaderboardIslandLand = Math.hypot(dxB, dzB) <= LEADERBOARD_ISLAND_RADIUS + 3.2;
  if (onLeaderboardIslandLand) return false;
  const dxH = x - HOUSE_ROOM_BASE.x;
  const dzH = z - HOUSE_ROOM_BASE.z;
  const onHouseRoomLand = Math.hypot(dxH, dzH) <= HOUSE_ROOM_PLAY_RADIUS + 1.4;
  if (onHouseRoomLand) return false;
  const dxHH = x - HOUSE_HALL_BASE.x;
  const dzHH = z - HOUSE_HALL_BASE.z;
  const onHouseHallLand = Math.hypot(dxHH, dzHH) <= HOUSE_HALL_PLAY_RADIUS + 1.4;
  if (onHouseHallLand) return false;

  if (isInDockWalkZone(x, z, 3.0, 2.5)) return false;

  return true;
}

function isInDockWalkZone(x, z, forwardPad = 0, sidePad = 0) {
  for (const zone of dockWalkZones) {
    const dx = x - zone.x;
    const dz = z - zone.z;
    const fX = Math.sin(zone.yaw);
    const fZ = Math.cos(zone.yaw);
    const rX = Math.cos(zone.yaw);
    const rZ = -Math.sin(zone.yaw);
    const forward = dx * fX + dz * fZ;
    const side = dx * rX + dz * rZ;
    if (
      forward >= zone.minForward - forwardPad &&
      forward <= zone.maxForward + forwardPad &&
      Math.abs(side) <= zone.halfWidth + sidePad
    ) {
      return true;
    }
  }
  return false;
}

function dockFloorHeightAt(x, z, forwardPad = 0, sidePad = 0) {
  let best = null;
  for (const zone of dockWalkZones) {
    const dx = x - zone.x;
    const dz = z - zone.z;
    const fX = Math.sin(zone.yaw);
    const fZ = Math.cos(zone.yaw);
    const rX = Math.cos(zone.yaw);
    const rZ = -Math.sin(zone.yaw);
    const forward = dx * fX + dz * fZ;
    const side = dx * rX + dz * rZ;
    if (
      forward >= zone.minForward - forwardPad &&
      forward <= zone.maxForward + forwardPad &&
      Math.abs(side) <= zone.halfWidth + sidePad
    ) {
      const y = Number.isFinite(zone.floorY) ? zone.floorY : GROUND_Y;
      if (best === null || y > best) best = y;
    }
  }
  return best;
}

function groundHeightAt(x, z, currentY) {
  const stairY = sampleInteriorStairHeight(x, z, currentY);
  if (Number.isFinite(stairY)) return stairY;
  const dockY = dockFloorHeightAt(x, z, 2.2, 2.2);
  if (Number.isFinite(dockY)) return dockY;
  return GROUND_Y;
}

function shouldSwimAt(x, z, y) {
  return isWaterAt(x, z) && y <= GROUND_Y + 0.16 && !inLighthouseInterior && !inHouseRoom && !inHouseHall;
}

function swimAnimationLevel(nowMs) {
  return SWIM_SURFACE_Y + Math.sin(nowMs * 0.0042) * 0.06;
}

function getSwimVerticalIntent() {
  const up = keys.has(' ') || keys.has('space') || keys.has('w') || keys.has('arrowup');
  const down = keys.has('c') || keys.has('control') || keys.has('s') || keys.has('arrowdown');
  if (up && !down) return 1;
  if (down && !up) return -1;
  return 0;
}

function applySwimVertical(local, delta, nowMs) {
  const bobBase = swimAnimationLevel(nowMs);
  const upHeld = keys.has(' ') || keys.has('space') || keys.has('w') || keys.has('arrowup');
  const downHeld = keys.has('c') || keys.has('control') || keys.has('s') || keys.has('arrowdown');
  const verticalSwimSpeed = 2.8;

  if (upHeld && !downHeld) {
    local.y += verticalSwimSpeed * delta;
  } else if (downHeld && !upHeld) {
    local.y -= verticalSwimSpeed * delta;
  } else {
    // Gentle return toward the surface when no vertical input is held.
    local.y += (bobBase - local.y) * Math.min(1, delta * 1.3);
  }

  local.y = THREE.MathUtils.clamp(local.y, SWIM_SINK_Y, SWIM_SURFACE_Y + 0.6);
  local.vy = 0;
}

function applyGroundVertical(local, delta, floorY) {
  if (pendingJump && local.y <= floorY + 0.05) {
    local.vy = JUMP_VELOCITY;
  }
  pendingJump = false;

  local.vy -= GRAVITY * delta;
  local.y += local.vy * delta;
  if (local.y <= floorY) {
    local.y = floorY;
    local.vy = 0;
  }
}

function swimMoveFactor() {
  return 0.68;
}

function canUseSlideAndSprint(local) {
  return !local.isSwimming;
}

function preserveLocalInWater(local, prevY) {
  if (local.isSwimming && local.y > SWIM_SURFACE_Y + 0.6) {
    local.y = Math.max(prevY, SWIM_SURFACE_Y + 0.2);
  }
}

function computeRemoteSwimState(player) {
  const remoteDockY = dockFloorHeightAt(player.mesh.position.x, player.mesh.position.z, 2.2, 2.2);
  if (Number.isFinite(remoteDockY)) {
    player.isSwimming = false;
    if (player.mesh.position.y < remoteDockY) player.mesh.position.y = remoteDockY;
    return;
  }
  // If a player is at normal ground height, always treat as walking.
  if (player.mesh.position.y >= GROUND_Y - 0.08) {
    player.isSwimming = false;
    return;
  }
  const inWater = isWaterAt(player.mesh.position.x, player.mesh.position.z);
  if (!inWater) {
    player.isSwimming = false;
    return;
  }
  if (player.isSwimming) {
    player.isSwimming = player.mesh.position.y <= SWIM_SURFACE_Y + 0.82;
    return;
  }
  player.isSwimming = player.mesh.position.y <= SWIM_SURFACE_Y + 0.58;
}

function swimStateFromPosition(player) {
  return Boolean(player) && shouldSwimAt(player.x, player.z, player.y);
}

function applyLocalSurfaceState(local) {
  const localDockY = dockFloorHeightAt(local.x, local.z, 2.2, 2.2);
  if (Number.isFinite(localDockY)) {
    local.isSwimming = false;
    local.swimTargetY = null;
    local.y = localDockY;
    local.vy = 0;
    return;
  }
  // Ground-height safeguard: never swim while standing on sand/land.
  if (local.y >= GROUND_Y - 0.08) {
    local.isSwimming = false;
    local.swimTargetY = null;
    return;
  }
  const inWater = isWaterAt(local.x, local.z) && !inLighthouseInterior && !inHouseRoom && !inHouseHall && !local.onBoat;
  if (!inWater) {
    local.isSwimming = false;
    local.swimTargetY = null;
    return;
  }
  if (local.isSwimming) {
    local.isSwimming = local.y <= SWIM_SURFACE_Y + 0.78;
    return;
  }
  local.isSwimming = local.y <= GROUND_Y + 0.65;
  if (local.isSwimming) {
    local.swimTargetY = THREE.MathUtils.clamp(local.y, SWIM_SINK_Y, SWIM_SURFACE_Y + 0.35);
  }
}

function surfaceMoveMultiplier(local) {
  return local.isSwimming ? swimMoveFactor() : 1;
}

function floorYForLocal(local) {
  return groundHeightAt(local.x, local.z, local.y);
}

function applyVerticalMovement(local, delta, nowMs) {
  applyLocalSurfaceState(local);
  if (local.isSwimming) {
    applySwimVertical(local, delta, nowMs);
    pendingJump = false;
    return;
  }
  applyGroundVertical(local, delta, floorYForLocal(local));
}

function updateRemoteSurfaceState(player) {
  computeRemoteSwimState(player);
}

function swimSyncRange(x, z) {
  return isWaterAt(x, z);
}

function isServerSyncRange(x, z, allowMine = false) {
  return isWithinPlayableWorld(x, z, allowMine) || swimSyncRange(x, z);
}

function canEnterSwim(local) {
  return !local.onBoat && !inLighthouseInterior && !inHouseRoom && !inHouseHall;
}

function movementSpeedForState(local) {
  return canUseSlideAndSprint(local) ? WALK_SPEED : WALK_SPEED * swimMoveFactor();
}

function validSwimTransition(local) {
  return canEnterSwim(local) && shouldSwimAt(local.x, local.z, local.y);
}

function applySwimTransition(local) {
  if (validSwimTransition(local)) {
    local.isSwimming = true;
    local.vy = 0;
  }
}

function afterMovementState(local, prevY) {
  applySwimTransition(local);
  preserveLocalInWater(local, prevY);
}

function remoteStatePostMove(player) {
  updateRemoteSurfaceState(player);
}

function interactWhileSwimming(local) {
  return local?.isSwimming;
}

function stopSwimOnTeleport(local) {
  if (local) {
    local.isSwimming = false;
    local.swimTargetY = null;
  }
}

function swimHintText() {
  return 'Swimming: WASD move, Space/W up, C/S down';
}

function canBoardBoat(local) {
  if (inHouseRoom || inHouseHall) return false;
  const nearDock = (
    distance2D(local, ISLAND_DOCK_POS) < 5
    || distance2D(local, LIGHTHOUSE_DOCK_POS) < 5
    || distance2D(local, MINE_ENTRY_DOCK_POS) < 5
    || distance2D(local, FISHING_DOCK_POS) < 5
    || distance2D(local, MARKET_DOCK_POS) < 5
    || distance2D(local, FURNITURE_DOCK_POS) < 5
    || distance2D(local, LEADERBOARD_DOCK_POS) < 5
  );
  const nearBoat = Boolean(boatState.mesh) && distance2D(local, boatState) < 5.2;
  if (nearBoat) return true;
  if (interactWhileSwimming(local)) return false;
  return nearDock;
}

function movementClamp(local) {
  const bounded = clampToPlayableGround(local.x, local.z, inMine);
  const collided = resolveWorldCollisions(bounded.x, bounded.z, local.y);
  let nextX = collided.x;
  let nextZ = collided.z;

  if (inMine) {
    const dx = nextX - MINE_POS.x;
    const dz = nextZ - MINE_POS.z;
    const dist = Math.hypot(dx, dz);
    if (dist > MINE_PLAY_RADIUS) {
      const scale = MINE_PLAY_RADIUS / (dist || 1);
      nextX = MINE_POS.x + dx * scale;
      nextZ = MINE_POS.z + dz * scale;
    }
  }

  local.x = nextX;
  local.z = nextZ;
}

function localStepMovementEnd(local, delta, nowMs, prevY) {
  movementClamp(local);
  applyVerticalMovement(local, delta, nowMs);
  afterMovementState(local, prevY);
}

function serverMovementRange(local) {
  return isServerSyncRange(local.x, local.z, inMine);
}

function finalizeRemoteMovement(player) {
  remoteStatePostMove(player);
}

function jumpAllowed(local) {
  return !local.isSwimming;
}

function movementScaleForLocal(local) {
  return surfaceMoveMultiplier(local);
}

function shouldSlide(local) {
  return canUseSlideAndSprint(local);
}

function runSlideAllowed(local, isSliding) {
  return isSliding && shouldSlide(local);
}

function sprintAllowed(local) {
  return canUseSlideAndSprint(local);
}

function inSwimSyncRange(local) {
  return serverMovementRange(local);
}

function allowBoatBoard(local) {
  return canBoardBoat(local);
}

function swimBodyTilt(stride) {
  return -0.58 + stride * 0.05;
}

function swimStrokePhase(player) {
  return player.animPhase;
}

function swimLegKick(phase) {
  return Math.sin(phase * 1.8) * 0.36;
}

function swimArmStroke(phase) {
  return Math.sin(phase) * 0.9;
}

function swimBodyRoll(phase) {
  return Math.sin(phase * 0.5) * 0.11;
}

function swimBodyBob(phase, baseY) {
  return baseY - 0.34 + Math.sin(phase * 2) * 0.06;
}

function smoothRotation(obj, x, y, z, delta, speed = 10) {
  if (!obj) return;
  const t = Math.min(1, delta * speed);
  obj.rotation.x += (x - obj.rotation.x) * t;
  obj.rotation.y += (y - obj.rotation.y) * t;
  obj.rotation.z += (z - obj.rotation.z) * t;
}

function inDeepWater(player) {
  return player.isSwimming;
}

function applySwimPose(player, body, parts, baseBodyY, delta) {
  const phase = swimStrokePhase(player);
  const speed = Math.min(1, player.animSpeed + 0.25);
  const strokePhase = phase * 1.45;
  const leftStroke = Math.sin(strokePhase);
  const rightStroke = Math.sin(strokePhase + Math.PI);
  const flutter = Math.sin(strokePhase * 3.2) * (0.14 + speed * 0.12);
  const roll = Math.sin(strokePhase) * 0.05;
  const bodyBob = -0.76 + Math.sin(strokePhase * 2.0) * 0.018;
  body.position.y += (baseBodyY + bodyBob - body.position.y) * Math.min(1, delta * 9.2);
  // True prone belly-down posture, nearly parallel to the water surface.
  smoothRotation(body, 1.48 + Math.sin(strokePhase * 0.5) * 0.015, 0, roll, delta, 12.4);
  // Front crawl: one arm pulls back while the other reaches forward.
  smoothRotation(parts.leftArmPivot, -0.45 + leftStroke * 1.28, 0, -0.38 + leftStroke * 0.18, delta, 14.2);
  smoothRotation(parts.rightArmPivot, -0.45 + rightStroke * 1.28, 0, 0.38 - rightStroke * 0.18, delta, 14.2);
  smoothRotation(parts.leftLegPivot, 0.2 + flutter, 0, 0, delta, 12.1);
  smoothRotation(parts.rightLegPivot, 0.2 - flutter, 0, 0, delta, 12.1);
}

function shouldUseWaterIdle(player, speed) {
  return player.isSwimming && speed <= 0.14;
}

function applyWaterIdlePose(player, body, parts, baseBodyY, now, delta) {
  const t = now * 0.0026 + player.animPhase;
  body.position.y += (baseBodyY - 0.76 + Math.sin(t * 1.5) * 0.02 - body.position.y) * Math.min(1, delta * 8.2);
  smoothRotation(body, 1.45, 0, Math.sin(t * 0.8) * 0.018, delta, 10.2);
  smoothRotation(parts.leftArmPivot, -0.38 + Math.sin(t * 1.2) * 0.1, 0, -0.3, delta, 10.9);
  smoothRotation(parts.rightArmPivot, -0.38 - Math.sin(t * 1.2) * 0.1, 0, 0.3, delta, 10.9);
  smoothRotation(parts.leftLegPivot, 0.2 + Math.sin(t * 1.9) * 0.04, 0, 0, delta, 10.1);
  smoothRotation(parts.rightLegPivot, 0.2 - Math.sin(t * 1.9) * 0.04, 0, 0, delta, 10.1);
}

function movementInputScale(local, sprintHeld, isSliding) {
  if (!sprintAllowed(local)) return 1;
  if (sprintHeld && !isSliding) return SPRINT_MULTIPLIER;
  return 1;
}

function canSprintNow(local, sprintHeld, staminaLevel, isSliding) {
  return sprintAllowed(local) && sprintHeld && staminaLevel > 0.5 && !isSliding;
}

function canSlideNow(local, wantsSlide, isGrounded, isSliding, input) {
  return shouldSlide(local) && wantsSlide && isGrounded && !isSliding && (Math.abs(input.x) > 0.0001 || Math.abs(input.z) > 0.0001);
}

function slideDrainMultiplier(local) {
  return local.isSwimming ? 0 : 1;
}

function surfaceHintOverride(local) {
  if (local?.isSwimming) return swimHintText();
  return null;
}

function isWithinPlayableWorld(x, z, allowMine = false) {
  const MAIN_RADIUS = worldLimit * 1.14;
  const LIGHTHOUSE_RADIUS = 11.7;
  const MINE_ENTRY_RADIUS = MINE_ENTRY_ISLAND_RADIUS;
  const FISHING_RADIUS = FISHING_ISLAND_RADIUS;
  const MARKET_RADIUS = MARKET_ISLAND_RADIUS;
  const LEADERBOARD_RADIUS = LEADERBOARD_ISLAND_RADIUS;
  const INTERIOR_RADIUS = INTERIOR_PLAY_RADIUS;
  const HOUSE_ROOM_RADIUS = HOUSE_ROOM_PLAY_RADIUS;
  const mineSwimBlocked = allowMine && blocksMineEscapeSwim(x, z);
  const onMain = Math.hypot(x, z) <= MAIN_RADIUS;
  const onLighthouse = Math.hypot(x - LIGHTHOUSE_POS.x, z - LIGHTHOUSE_POS.z) <= LIGHTHOUSE_RADIUS;
  const onMineEntryIsland = Math.hypot(x - MINE_ENTRY_ISLAND_POS.x, z - MINE_ENTRY_ISLAND_POS.z) <= MINE_ENTRY_RADIUS;
  const onFishingIsland = Math.hypot(x - FISHING_ISLAND_POS.x, z - FISHING_ISLAND_POS.z) <= FISHING_RADIUS;
  const onMarketIsland = Math.hypot(x - MARKET_ISLAND_POS.x, z - MARKET_ISLAND_POS.z) <= MARKET_RADIUS;
  const onLeaderboardIsland = Math.hypot(x - LEADERBOARD_ISLAND_POS.x, z - LEADERBOARD_ISLAND_POS.z) <= LEADERBOARD_RADIUS;
  const inInterior = Math.hypot(x - LIGHTHOUSE_INTERIOR_BASE.x, z - LIGHTHOUSE_INTERIOR_BASE.z) <= INTERIOR_RADIUS;
  const inHouseRoomZone = Math.hypot(x - HOUSE_ROOM_BASE.x, z - HOUSE_ROOM_BASE.z) <= HOUSE_ROOM_RADIUS;
  const inHouseHallZone = Math.hypot(x - HOUSE_HALL_BASE.x, z - HOUSE_HALL_BASE.z) <= HOUSE_HALL_PLAY_RADIUS;
  const inMine = allowMine && mineDistance(x, z) <= MINE_PLAY_RADIUS;
  const inSwim = isSwimZone(x, z) && !mineSwimBlocked;
  return onMain || onLighthouse || onMineEntryIsland || onFishingIsland || onMarketIsland || onLeaderboardIsland || inInterior || inHouseRoomZone || inHouseHallZone || inMine || inSwim;
}

function setBeaconVisual(active) {
  if (active) {
    beaconCore.material.color.set(0xfbbf24);
    beaconCore.material.emissive.set(0xf59e0b);
    beaconCore.material.emissiveIntensity = 1.35;
  } else {
    beaconCore.material.color.set(0x38bdf8);
    beaconCore.material.emissive.set(0x0c4a6e);
    beaconCore.material.emissiveIntensity = 0.4;
  }
}

function updateBeaconState(payload) {
  if (!payload || payload.id !== 'beacon') return;
  interactables.set(payload.id, payload);
  setBeaconVisual(Boolean(payload.active));
}

function makeExactBaconMesh() {
  return null;
}

function makePlayerMesh(appearance) {
  const exact = makeExactBaconMesh();
  if (exact) {
    return exact;
  }

  const UNIT = 0.52;
  const rig = new THREE.Group();
  rig.position.y = 0.56;

  const hips = new THREE.Mesh(
    new THREE.BoxGeometry(1.36 * UNIT, 0.86 * UNIT, 0.72 * UNIT),
    new THREE.MeshStandardMaterial({ color: appearance.pants, roughness: 0.82 })
  );
  hips.position.y = 1.08 * UNIT;
  hips.castShadow = true;

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(1.56 * UNIT, 1.62 * UNIT, 0.88 * UNIT),
    new THREE.MeshStandardMaterial({ color: appearance.shirt, roughness: 0.68 })
  );
  torso.position.y = 2.46 * UNIT;
  torso.castShadow = true;

  const torsoStripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.32 * UNIT, 0.3 * UNIT, 0.08 * UNIT),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.7 })
  );
  torsoStripe.position.set(0, 2.4 * UNIT, 0.49 * UNIT);
  torsoStripe.castShadow = true;

  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(1.62 * UNIT, 1.66 * UNIT, 0.94 * UNIT),
    new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.75 })
  );
  jacket.position.copy(torso.position);
  jacket.castShadow = true;

  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(1.4 * UNIT, 0.14 * UNIT, 0.82 * UNIT),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.72 })
  );
  belt.position.y = 1.76 * UNIT;
  belt.castShadow = true;

  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(0.38 * UNIT, 0.2 * UNIT, 0.28 * UNIT),
    new THREE.MeshStandardMaterial({ color: appearance.skin, roughness: 0.9 })
  );
  neck.position.y = 3.52 * UNIT;
  neck.castShadow = true;

  const neckConnector = new THREE.Mesh(
    new THREE.BoxGeometry(0.44 * UNIT, 0.18 * UNIT, 0.34 * UNIT),
    new THREE.MeshStandardMaterial({ color: appearance.skin, roughness: 0.88 })
  );
  neckConnector.position.y = 3.72 * UNIT;
  neckConnector.castShadow = true;

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.12 * UNIT, 1.08 * UNIT, 1.02 * UNIT),
    new THREE.MeshStandardMaterial({ color: appearance.skin, roughness: 0.88 })
  );
  head.position.y = 4.42 * UNIT;
  head.castShadow = true;

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06 * UNIT, 8, 8), eyeMat);
  leftEye.position.set(-0.23 * UNIT, 4.56 * UNIT, 0.56 * UNIT);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.23 * UNIT;

  const mouthSmile = new THREE.Mesh(new THREE.TorusGeometry(0.2 * UNIT, 0.03 * UNIT, 6, 12, Math.PI), eyeMat);
  mouthSmile.rotation.set(Math.PI, 0, 0);
  mouthSmile.position.set(0, 4.26 * UNIT, 0.56 * UNIT);

  const mouthSerious = new THREE.Mesh(new THREE.BoxGeometry(0.34 * UNIT, 0.03 * UNIT, 0.02 * UNIT), eyeMat);
  mouthSerious.position.set(0, 4.22 * UNIT, 0.56 * UNIT);

  const mouthGrin = new THREE.Mesh(new THREE.TorusGeometry(0.24 * UNIT, 0.04 * UNIT, 6, 14, Math.PI), eyeMat);
  mouthGrin.rotation.set(Math.PI, 0, 0);
  mouthGrin.position.set(0, 4.24 * UNIT, 0.56 * UNIT);
  const mouthSoft = new THREE.Mesh(new THREE.TorusGeometry(0.16 * UNIT, 0.025 * UNIT, 6, 12, Math.PI), eyeMat);
  mouthSoft.rotation.set(Math.PI, 0, 0);
  mouthSoft.position.set(0, 4.2 * UNIT, 0.56 * UNIT);

  const leftEyeWink = new THREE.Mesh(new THREE.BoxGeometry(0.13 * UNIT, 0.03 * UNIT, 0.02 * UNIT), eyeMat);
  leftEyeWink.position.set(-0.23 * UNIT, 4.56 * UNIT, 0.56 * UNIT);
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.25 });
  const leftLashes = new THREE.Mesh(new THREE.BoxGeometry(0.16 * UNIT, 0.025 * UNIT, 0.02 * UNIT), lashMat);
  leftLashes.position.set(-0.23 * UNIT, 4.65 * UNIT, 0.56 * UNIT);
  const rightLashes = leftLashes.clone();
  rightLashes.position.x = 0.23 * UNIT;

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.86 * UNIT, 3.0 * UNIT, 0);
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.46 * UNIT, 1.4 * UNIT, 0.46 * UNIT),
    new THREE.MeshStandardMaterial({ color: appearance.skin, roughness: 0.9 })
  );
  leftArm.position.y = -0.8 * UNIT;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);
  const leftSleeve = new THREE.Mesh(
    new THREE.BoxGeometry(0.5 * UNIT, 0.42 * UNIT, 0.5 * UNIT),
    new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.76 })
  );
  leftSleeve.position.y = -0.2 * UNIT;
  leftArmPivot.add(leftSleeve);

  const leftHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.36 * UNIT, 0.34 * UNIT, 0.32 * UNIT),
    new THREE.MeshStandardMaterial({ color: appearance.skin, roughness: 0.88 })
  );
  leftHand.position.y = -1.7 * UNIT;
  leftHand.castShadow = true;
  leftArmPivot.add(leftHand);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.86 * UNIT, 3.0 * UNIT, 0);
  const rightArm = leftArm.clone();
  rightArm.position.y = -0.8 * UNIT;
  rightArmPivot.add(rightArm);
  const rightSleeve = leftSleeve.clone();
  rightArmPivot.add(rightSleeve);
  const rightHand = leftHand.clone();
  rightArmPivot.add(rightHand);

  const heldTorch = createHeldTorchMesh(UNIT);
  heldTorch.position.set(0.04 * UNIT, 0.14 * UNIT, 0.16 * UNIT);
  heldTorch.rotation.set(-1.04, -0.06, -0.18);
  heldTorch.visible = false;
  leftHand.add(heldTorch);

  const heldPickaxe = createHeldPickaxeMesh(UNIT);
  heldPickaxe.position.set(0.14 * UNIT, 0.18 * UNIT, 0.12 * UNIT);
  heldPickaxe.rotation.set(-1.08, 0.18, 0.42);
  rightHand.add(heldPickaxe);

  const heldFishingRod = createHeldFishingRodMesh(UNIT);
  heldFishingRod.position.set(0.16 * UNIT, 0.22 * UNIT, 0.16 * UNIT);
  heldFishingRod.rotation.set(-1.02, 0.18, 0.34);
  heldFishingRod.visible = false;
  rightHand.add(heldFishingRod);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.38 * UNIT, 1.02 * UNIT, 0);
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.52 * UNIT, 1.8 * UNIT, 0.56 * UNIT),
    new THREE.MeshStandardMaterial({ color: appearance.pants, roughness: 0.84 })
  );
  leftLeg.position.y = -1.02 * UNIT;
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);

  const leftKnee = new THREE.Mesh(
    new THREE.BoxGeometry(0.53 * UNIT, 0.2 * UNIT, 0.58 * UNIT),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
  );
  leftKnee.position.y = -0.94 * UNIT;
  leftKnee.castShadow = true;
  leftLegPivot.add(leftKnee);

  const leftBoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.58 * UNIT, 0.4 * UNIT, 0.88 * UNIT),
    new THREE.MeshStandardMaterial({ color: appearance.shoes, roughness: 0.68 })
  );
  leftBoot.position.set(0, -1.96 * UNIT, 0.14 * UNIT);
  leftBoot.castShadow = true;
  leftLegPivot.add(leftBoot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.38 * UNIT, 1.02 * UNIT, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.y = -1.02 * UNIT;
  rightLegPivot.add(rightLeg);
  const rightKnee = leftKnee.clone();
  rightLegPivot.add(rightKnee);
  const rightBoot = leftBoot.clone();
  rightLegPivot.add(rightBoot);

  const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.6 });
  const hairMatSoft = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.72 });

  const hairShort = new THREE.Group();
  const shortCrown = new THREE.Mesh(new THREE.SphereGeometry(0.66 * UNIT, 18, 12), hairMat);
  shortCrown.scale.set(1.0, 0.58, 0.96);
  shortCrown.position.set(0, 5.08 * UNIT, -0.02 * UNIT);
  shortCrown.castShadow = true;
  const shortBack = new THREE.Mesh(new THREE.BoxGeometry(1.06 * UNIT, 0.34 * UNIT, 0.26 * UNIT), hairMatSoft);
  shortBack.position.set(0, 4.85 * UNIT, -0.46 * UNIT);
  shortBack.castShadow = true;
  for (let i = -1; i <= 1; i += 1) {
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.22 * UNIT, 0.2 * UNIT, 0.16 * UNIT), hairMat);
    fringe.position.set(i * 0.19 * UNIT, 4.84 * UNIT - Math.abs(i) * 0.01 * UNIT, 0.53 * UNIT);
    fringe.castShadow = true;
    hairShort.add(fringe);
  }
  hairShort.add(shortCrown, shortBack);

  const hairSidePart = new THREE.Group();
  const sideCrown = new THREE.Mesh(new THREE.SphereGeometry(0.68 * UNIT, 18, 12), hairMat);
  sideCrown.scale.set(1.0, 0.6, 0.96);
  sideCrown.position.set(0.04 * UNIT, 5.07 * UNIT, 0);
  sideCrown.castShadow = true;
  const partLine = new THREE.Mesh(new THREE.BoxGeometry(0.1 * UNIT, 0.02 * UNIT, 0.82 * UNIT), new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3 }));
  partLine.position.set(0.1 * UNIT, 5.26 * UNIT, -0.02 * UNIT);
  const sideSweep = new THREE.Mesh(new THREE.BoxGeometry(0.44 * UNIT, 0.28 * UNIT, 0.2 * UNIT), hairMatSoft);
  sideSweep.position.set(0.31 * UNIT, 4.93 * UNIT, 0.49 * UNIT);
  sideSweep.rotation.y = -0.15;
  sideSweep.castShadow = true;
  const sideBang = new THREE.Mesh(new THREE.BoxGeometry(0.34 * UNIT, 0.34 * UNIT, 0.18 * UNIT), hairMatSoft);
  sideBang.position.set(-0.28 * UNIT, 4.82 * UNIT, 0.54 * UNIT);
  sideBang.rotation.y = 0.18;
  sideBang.castShadow = true;
  hairSidePart.add(sideCrown, partLine, sideSweep, sideBang);

  const hairSpiky = new THREE.Group();
  for (let i = -2; i <= 2; i += 1) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry((0.14 + Math.abs(i) * 0.015) * UNIT, 0.58 * UNIT, 12), hairMat);
    spike.position.set(i * 0.17 * UNIT, 5.2 * UNIT - Math.abs(i) * 0.02 * UNIT, -0.02 * UNIT);
    spike.rotation.x = -0.2 + Math.abs(i) * 0.05;
    spike.castShadow = true;
    hairSpiky.add(spike);
  }
  const spikyBase = new THREE.Mesh(new THREE.SphereGeometry(0.62 * UNIT, 16, 10), hairMatSoft);
  spikyBase.scale.set(1, 0.38, 0.9);
  spikyBase.position.set(0, 5.03 * UNIT, -0.03 * UNIT);
  spikyBase.castShadow = true;
  hairSpiky.add(spikyBase);

  const hairLong = new THREE.Group();
  const longCrown = new THREE.Mesh(new THREE.SphereGeometry(0.66 * UNIT, 18, 12), hairMat);
  longCrown.scale.set(1.0, 0.58, 0.94);
  longCrown.position.set(0, 5.08 * UNIT, 0);
  longCrown.castShadow = true;
  const longBack = new THREE.Mesh(new THREE.BoxGeometry(1.0 * UNIT, 1.24 * UNIT, 0.52 * UNIT), hairMatSoft);
  longBack.position.set(0, 4.56 * UNIT, -0.42 * UNIT);
  longBack.castShadow = true;
  const longFrontL = new THREE.Mesh(new THREE.BoxGeometry(0.2 * UNIT, 0.56 * UNIT, 0.16 * UNIT), hairMatSoft);
  longFrontL.position.set(-0.49 * UNIT, 4.6 * UNIT, 0.38 * UNIT);
  longFrontL.castShadow = true;
  const longFrontR = longFrontL.clone();
  longFrontR.position.x = 0.49 * UNIT;
  hairLong.add(longCrown, longBack, longFrontL, longFrontR);

  const hairPonytail = new THREE.Group();
  const ponyCap = new THREE.Mesh(new THREE.SphereGeometry(0.66 * UNIT, 18, 12), hairMat);
  ponyCap.scale.set(1.0, 0.58, 0.95);
  ponyCap.position.set(0, 5.08 * UNIT, 0);
  ponyCap.castShadow = true;
  const ponyBand = new THREE.Mesh(new THREE.TorusGeometry(0.14 * UNIT, 0.03 * UNIT, 8, 16), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 }));
  ponyBand.position.set(0, 4.9 * UNIT, -0.5 * UNIT);
  ponyBand.rotation.x = Math.PI / 2;
  const ponyTailTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * UNIT, 0.13 * UNIT, 0.42 * UNIT, 10), hairMatSoft);
  ponyTailTop.position.set(0, 4.64 * UNIT, -0.58 * UNIT);
  ponyTailTop.rotation.x = 0.28;
  ponyTailTop.castShadow = true;
  const ponyTailMid = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * UNIT, 0.1 * UNIT, 0.42 * UNIT, 10), hairMatSoft);
  ponyTailMid.position.set(0, 4.3 * UNIT, -0.62 * UNIT);
  ponyTailMid.rotation.x = 0.2;
  ponyTailMid.castShadow = true;
  const ponyTailEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * UNIT, 0.06 * UNIT, 0.36 * UNIT, 10), hairMatSoft);
  ponyTailEnd.position.set(0, 4.02 * UNIT, -0.58 * UNIT);
  ponyTailEnd.rotation.x = 0.05;
  ponyTailEnd.castShadow = true;
  hairPonytail.add(ponyCap, ponyBand, ponyTailTop, ponyTailMid, ponyTailEnd);

  const hairBob = new THREE.Group();
  const bobCrown = new THREE.Mesh(new THREE.SphereGeometry(0.68 * UNIT, 18, 12), hairMat);
  bobCrown.scale.set(1.02, 0.58, 0.95);
  bobCrown.position.set(0, 5.05 * UNIT, 0);
  bobCrown.castShadow = true;
  const bobBack = new THREE.Mesh(new THREE.BoxGeometry(1.08 * UNIT, 0.82 * UNIT, 0.4 * UNIT), hairMatSoft);
  bobBack.position.set(0, 4.54 * UNIT, -0.36 * UNIT);
  bobBack.castShadow = true;
  const bobSideL = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * UNIT, 0.14 * UNIT, 0.72 * UNIT, 10), hairMatSoft);
  bobSideL.position.set(-0.55 * UNIT, 4.63 * UNIT, 0.1 * UNIT);
  bobSideL.rotation.z = 0.1;
  bobSideL.castShadow = true;
  const bobSideR = bobSideL.clone();
  bobSideR.position.x = 0.55 * UNIT;
  bobSideR.rotation.z = -0.1;
  hairBob.add(bobCrown, bobBack, bobSideL, bobSideR);

  const hairWavy = new THREE.Group();
  const waveCrown = new THREE.Mesh(new THREE.SphereGeometry(0.67 * UNIT, 18, 12), hairMat);
  waveCrown.scale.set(1, 0.58, 0.95);
  waveCrown.position.set(0, 5.08 * UNIT, -0.01 * UNIT);
  waveCrown.castShadow = true;
  hairWavy.add(waveCrown);
  for (let i = -2; i <= 2; i += 1) {
    const curl = new THREE.Mesh(new THREE.SphereGeometry((0.13 + (2 - Math.abs(i)) * 0.012) * UNIT, 10, 8), hairMatSoft);
    curl.position.set(i * 0.18 * UNIT, 4.58 * UNIT - Math.abs(i) * 0.02 * UNIT, 0.44 * UNIT);
    curl.castShadow = true;
    hairWavy.add(curl);
  }
  for (const side of [-1, 1]) {
    const sideWave = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * UNIT, 0.08 * UNIT, 0.58 * UNIT, 10), hairMatSoft);
    sideWave.position.set(side * 0.56 * UNIT, 4.52 * UNIT, 0.02 * UNIT);
    sideWave.rotation.z = -side * 0.12;
    sideWave.castShadow = true;
    hairWavy.add(sideWave);
  }

  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52 * UNIT, 0.52 * UNIT, 0.3 * UNIT, 16),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 })
  );
  hat.position.set(0, 5.38 * UNIT, 0);
  hat.castShadow = true;

  const glasses = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
  const glassLeft = new THREE.Mesh(new THREE.TorusGeometry(0.13 * UNIT, 0.02 * UNIT, 8, 12), glassMat);
  glassLeft.position.set(-0.22 * UNIT, 4.56 * UNIT, 0.57 * UNIT);
  const glassRight = glassLeft.clone();
  glassRight.position.x = 0.22 * UNIT;
  const glassBridge = new THREE.Mesh(new THREE.BoxGeometry(0.12 * UNIT, 0.02 * UNIT, 0.02 * UNIT), glassMat);
  glassBridge.position.set(0, 4.56 * UNIT, 0.57 * UNIT);
  glasses.add(glassLeft, glassRight, glassBridge);

  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(1.0 * UNIT, 1.2 * UNIT, 0.35 * UNIT),
    new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.82 })
  );
  backpack.position.set(0, 2.5 * UNIT, -0.64 * UNIT);
  backpack.castShadow = true;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 20),
    new THREE.MeshBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.25 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;

  rig.add(
    hips,
    torso,
    torsoStripe,
    jacket,
    belt,
    neck,
    neckConnector,
    head,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    leftEye,
    rightEye,
    mouthSmile,
    mouthSerious,
    mouthGrin,
    mouthSoft,
    leftEyeWink,
    leftLashes,
    rightLashes,
    hat,
    glasses,
    backpack,
    hairShort,
    hairSidePart,
    sideBang,
    hairSpiky,
    hairLong,
    hairPonytail,
    hairBob,
    hairWavy
  );

  const group = new THREE.Group();
  group.add(rig, shadow);
  group.userData.body = rig;
  group.userData.baseBodyY = rig.position.y;
  group.userData.parts = {
    hips,
    torso,
    jacket,
    neck,
    neckConnector,
    head,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    leftArm,
    rightArm,
    leftHand,
    rightHand,
    leftLeg,
    rightLeg,
    leftKnee,
    rightKnee,
    leftBoot,
    rightBoot,
    leftSleeve,
    rightSleeve,
    torsoStripe,
    belt,
    leftEye,
    rightEye,
    mouthSmile,
    mouthSerious,
    mouthGrin,
    mouthSoft,
    leftEyeWink,
    leftLashes,
    rightLashes,
    heldTorch,
    heldTorchFlame: heldTorch.userData.flame || null,
    heldPickaxe,
    heldPickaxeHead: heldPickaxe.userData.head || null,
    heldFishingRod,
    heldFishingRodAccent: heldFishingRod.userData.accent || null,
    hat,
    glasses,
    backpack,
    hairShort,
    hairSidePart,
    sideBang,
    hairSpiky,
    hairLong,
    hairPonytail,
    hairBob,
    hairWavy,
    faceStyle: appearance.faceStyle,
    accessories: appearance.accessories
  };
  scene.add(group);

  return group;
}

function paintPlayer(player, appearance) {
  const parts = player?.mesh?.userData?.parts;
  if (!parts) return;
  const tintMeshTree = (node, color) => {
    if (!node) return;
    if (node.material?.color) {
      node.material.color.set(color);
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => tintMeshTree(child, color));
    }
  };

  parts.torso.material.color.set(appearance.shirt);
  parts.torsoStripe.material.color.set(appearance.shirt);
  parts.jacket.material.color.set(appearance.shirt);
  parts.belt.material.color.set(0x1f2937);
  parts.hips.material.color.set(appearance.pants);
  parts.neck.material.color.set(appearance.skin);
  parts.neckConnector.material.color.set(appearance.skin);
  parts.head.material.color.set(appearance.skin);
  parts.leftArm.material.color.set(appearance.skin);
  parts.rightArm.material.color.set(appearance.skin);
  parts.leftHand.material.color.set(appearance.skin);
  parts.rightHand.material.color.set(appearance.skin);
  parts.leftSleeve.material.color.set(appearance.shirt);
  parts.rightSleeve.material.color.set(appearance.shirt);
  parts.leftLeg.material.color.set(appearance.pants);
  parts.rightLeg.material.color.set(appearance.pants);
  parts.leftBoot.material.color.set(appearance.shoes);
  parts.rightBoot.material.color.set(appearance.shoes);
  tintMeshTree(parts.hairShort, appearance.hairColor);
  tintMeshTree(parts.hairSidePart, appearance.hairColor);
  tintMeshTree(parts.sideBang, appearance.hairColor);
  tintMeshTree(parts.hairSpiky, appearance.hairColor);
  tintMeshTree(parts.hairLong, appearance.hairColor);
  tintMeshTree(parts.hairPonytail, appearance.hairColor);
  tintMeshTree(parts.hairBob, appearance.hairColor);
  tintMeshTree(parts.hairWavy, appearance.hairColor);

  parts.hairShort.visible = appearance.hairStyle === 'short';
  parts.hairSidePart.visible = appearance.hairStyle === 'sidepart';
  parts.sideBang.visible = appearance.hairStyle === 'sidepart';
  parts.hairSpiky.visible = appearance.hairStyle === 'spiky';
  parts.hairLong.visible = appearance.hairStyle === 'long';
  parts.hairPonytail.visible = appearance.hairStyle === 'ponytail';
  parts.hairBob.visible = appearance.hairStyle === 'bob';
  parts.hairWavy.visible = appearance.hairStyle === 'wavy';
  const accessories = Array.isArray(appearance.accessories) ? appearance.accessories : [];
  parts.hat.visible = accessories.includes('hat');
  parts.glasses.visible = accessories.includes('glasses');
  parts.backpack.visible = accessories.includes('backpack');

  parts.leftEye.visible = true;
  parts.rightEye.visible = true;
  parts.leftEyeWink.visible = false;
  parts.leftLashes.visible = false;
  parts.rightLashes.visible = false;
  parts.mouthSmile.visible = false;
  parts.mouthSerious.visible = false;
  parts.mouthGrin.visible = false;
  parts.mouthSoft.visible = false;

  if (appearance.faceStyle === 'serious') {
    parts.mouthSerious.visible = true;
  } else if (appearance.faceStyle === 'grin') {
    parts.mouthGrin.visible = true;
  } else if (appearance.faceStyle === 'wink') {
    parts.leftEye.visible = false;
    parts.leftEyeWink.visible = true;
    parts.mouthSmile.visible = true;
  } else if (appearance.faceStyle === 'lashessmile') {
    parts.leftLashes.visible = true;
    parts.rightLashes.visible = true;
    parts.mouthSmile.visible = true;
  } else if (appearance.faceStyle === 'soft') {
    parts.leftLashes.visible = true;
    parts.rightLashes.visible = true;
    parts.mouthSoft.visible = true;
  } else {
    parts.mouthSmile.visible = true;
  }
}

function applyPlayerCustomization(id, name, color, appearancePayload) {
  const player = players.get(id);
  if (!player) return;

  if (typeof name === 'string' && name.trim()) {
    player.name = name.trim();
  }
  const appearance = normalizeAppearance(appearancePayload, normalizeAppearance(player.appearance, defaultAppearance()));
  if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) {
    appearance.shirt = color;
  }
  player.appearance = appearance;
  player.color = appearance.shirt;
  paintPlayer(player, appearance);
  applyHeldGearVisual(player);

  if (player.label) {
    applyTaggedNameToElement(player.label, player.name, player.accountTag);
  }

  if (id === localPlayerId) {
    localStorage.setItem('island_profile_name', player.name);
    if (player.color?.startsWith('#')) {
      localStorage.setItem('island_profile_color', player.color);
      colorInputEl.value = player.color;
    }
    localStorage.setItem('island_profile_skin', appearance.skin);
    localStorage.setItem('island_profile_hair_style', appearance.hairStyle);
    localStorage.setItem('island_profile_hair_color', appearance.hairColor);
    localStorage.setItem('island_profile_face_style', appearance.faceStyle);
    localStorage.setItem('island_profile_pants_color', appearance.pants);
    localStorage.setItem('island_profile_shoes_color', appearance.shoes);
    localStorage.setItem('island_profile_accessories', (appearance.accessories || []).join(','));
    skinInputEl.value = appearance.skin;
    hairStyleInputEl.value = appearance.hairStyle;
    hairColorInputEl.value = appearance.hairColor;
    faceStyleInputEl.value = appearance.faceStyle;
    pantsColorInputEl.value = appearance.pants;
    shoesColorInputEl.value = appearance.shoes;
    selectedAccessories.clear();
    (appearance.accessories || []).forEach((item) => selectedAccessories.add(item));
    nameInputEl.value = player.name;
    refreshItemCards();
    if (!customizeModalEl.classList.contains('hidden')) {
      updatePreviewAvatar();
    }
  }
}

function addPlayer(data) {
  if (players.has(data.id)) return;

  const appearance = normalizeAppearance(data.appearance, {
    ...defaultAppearance(),
    shirt: data.color || '#38bdf8'
  });
  const mesh = makePlayerMesh(appearance);
  mesh.position.set(data.x, data.y ?? 0, data.z);

  const tag = document.createElement('div');
  tag.className = 'player-tag';
  const baseName = data.name || `Player-${String(data.id).slice(0, 4)}`;
  const accountTag = normalizeAccountTag(data?.accountTag);
  const profileId = typeof data.profileId === 'string' ? data.profileId.trim() : '';
  const accountUsername = resolveAccountUsername(data);
  applyTaggedNameToElement(tag, baseName, accountTag);
  nameTagsEl.appendChild(tag);

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.style.display = 'none';
  nameTagsEl.appendChild(bubble);

  players.set(data.id, {
    id: data.id,
    profileId,
    accountUsername,
    mesh,
    x: data.x,
    y: data.y ?? 0,
    vy: 0,
    z: data.z,
    name: baseName,
    accountTag,
    color: appearance.shirt,
    appearance,
    emoteType: null,
    emoteUntil: 0,
    animPhase: Math.random() * Math.PI * 2,
    animSpeed: 0,
    facingYaw: 0,
    targetYaw: 0,
    onBoat: false,
    isSwimming: false,
    isLocal: data.id === localPlayerId,
    heldPickaxe: normalizePickaxeTier(data.pickaxe, 'wood'),
    hasFishingRod: data?.progress?.hasFishingRod === true || data?.hasFishingRod === true,
    heldFishingRodTier: normalizeRodTier(data?.progress?.fishingRodTier || data?.fishingRodTier, 'basic'),
    isFishing: data?.isFishing === true,
    torchEquipped: Boolean(data.torchEquipped),
    currentRoomId: data.currentRoomId || null,
    mineSwingStartedAt: 0,
    mineSwingUntil: 0,
    label: tag,
    bubble,
    bubbleUntil: 0
  });

  const player = players.get(data.id);
  paintPlayer(player, appearance);
  applyHeldGearVisual(player);
  updatePlayerVisibility(player);
  updateHud();
  refreshDebugPlayerLists();
}

function removePlayer(id) {
  const player = players.get(id);
  if (!player) return;
  scene.remove(player.mesh);
  // Dispose geometry and materials to prevent GPU memory leak on player leave
  player.mesh.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
  player.label?.remove();
  player.bubble?.remove();
  players.delete(id);
  updateHud();
  refreshDebugPlayerLists();
}

function localEffectiveRoomId() {
  const claimedId = normalizeHomeRoomState(questState.homeRoom).roomId;
  return inHouseRoom && claimedId ? claimedId : null;
}

function updatePlayerVisibility(player) {
  if (!player || player.isLocal) return;
  const localRoom = localEffectiveRoomId();
  const otherRoom = player.currentRoomId || null;
  const sameRoom = localRoom === otherRoom;
  player.mesh.visible = sameRoom;
  if (player.label) player.label.style.display = sameRoom ? '' : 'none';
  if (player.bubble) player.bubble.style.display = sameRoom ? player.bubble.style.display : 'none';
}

function showChatBubble(id, text) {
  const player = players.get(id);
  if (!player || !player.bubble) return;

  const safeText = String(text || '').trim().slice(0, 120);
  if (!safeText) return;

  player.bubble.textContent = safeText;
  player.bubble.style.display = 'block';
  player.bubble.style.opacity = '1';
  player.bubbleUntil = Date.now() + CHAT_BUBBLE_MS;
}

function normalizeAccountTag(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  return raw.slice(0, 24);
}

function resolveAccountUsername(data) {
  if (!data) return '';
  const direct = typeof data.username === 'string' ? data.username.trim() : '';
  if (direct) return direct.toLowerCase();
  const profileId = typeof data.profileId === 'string' ? data.profileId.trim() : '';
  if (profileId.toLowerCase().startsWith('acct-')) {
    return profileId.slice(5).toLowerCase();
  }
  return '';
}

function applyTaggedNameToElement(element, name, accountTag = null) {
  if (!element) return;
  const base = String(name || '').trim() || 'Player';
  const tag = normalizeAccountTag(accountTag);
  element.textContent = '';
  if (tag) {
    const badge = document.createElement('span');
    badge.className = 'account-role-tag';
    badge.textContent = `[${tag}]`;
    element.appendChild(badge);
    element.appendChild(document.createTextNode(' '));
  }
  element.appendChild(document.createTextNode(base));
}

function displayNameWithTag(name, accountTag = null) {
  const base = String(name || '').trim() || 'Player';
  const tag = normalizeAccountTag(accountTag);
  return tag ? `[${tag}] ${base}` : base;
}

function capitalizeWord(value) {
  const text = String(value || '');
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizePickaxeTier(value, fallback = 'wood') {
  const tier = typeof value === 'string' ? value.toLowerCase() : '';
  return PICKAXE_TIERS.includes(tier) ? tier : fallback;
}

function createHeldPickaxeMesh(unit) {
  const mesh = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055 * unit, 0.055 * unit, 1.42 * unit, 8),
    new THREE.MeshStandardMaterial({ color: 0x7c4a26, roughness: 0.8 })
  );
  handle.rotation.z = Math.PI / 2;
  handle.castShadow = true;

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.64 * unit, 0.22 * unit, 0.22 * unit),
    new THREE.MeshStandardMaterial({ color: PICKAXE_HEAD_COLORS.wood, roughness: 0.45, metalness: 0.18 })
  );
  head.position.set(0.58 * unit, 0, 0);
  head.castShadow = true;

  mesh.add(handle, head);
  mesh.userData.head = head;
  return mesh;
}

function createHeldFishingRodMesh(unit) {
  const rod = new THREE.Group();
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 * unit, 0.09 * unit, 0.52 * unit, 10),
    new THREE.MeshStandardMaterial({ color: 0x7c4a26, roughness: 0.84 })
  );
  grip.rotation.z = Math.PI / 2;
  grip.position.x = -0.46 * unit;
  grip.castShadow = true;

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028 * unit, 0.033 * unit, 2.25 * unit, 10),
    new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.28, metalness: 0.52 })
  );
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = 0.36 * unit;
  shaft.castShadow = true;

  const accent = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11 * unit, 0.11 * unit, 0.14 * unit, 14),
    new THREE.MeshStandardMaterial({ color: FISHING_ROD_ACCENT_COLORS.basic, roughness: 0.36, metalness: 0.58 })
  );
  accent.position.set(-0.2 * unit, -0.12 * unit, 0);
  accent.castShadow = true;

  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007 * unit, 0.007 * unit, 0.56 * unit, 6),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.22, metalness: 0.1 })
  );
  line.position.set(1.44 * unit, -0.28 * unit, 0);
  line.castShadow = true;

  const hook = new THREE.Mesh(
    new THREE.SphereGeometry(0.03 * unit, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.32, metalness: 0.55 })
  );
  hook.position.set(1.44 * unit, -0.58 * unit, 0);
  hook.castShadow = true;

  rod.add(grip, shaft, accent, line, hook);
  rod.userData.accent = accent;
  return rod;
}

function createHeldTorchMesh(unit) {
  const torch = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06 * unit, 0.07 * unit, 1.0 * unit, 8),
    new THREE.MeshStandardMaterial({ color: 0x7c4a26, roughness: 0.85 })
  );
  handle.castShadow = true;

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 * unit, 0.08 * unit, 0.14 * unit, 10),
    new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.3, metalness: 0.6 })
  );
  band.position.y = 0.42 * unit;
  band.castShadow = true;

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.14 * unit, 0.36 * unit, 10),
    new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf59e0b, emissiveIntensity: 1.25, roughness: 0.28 })
  );
  flame.position.y = 0.72 * unit;
  flame.castShadow = true;

  torch.add(handle, band, flame);
  torch.userData.flame = flame;
  return torch;
}

function applyHeldGearVisual(player) {
  const parts = player?.mesh?.userData?.parts;
  if (!parts) return;

  const tier = normalizePickaxeTier(player.heldPickaxe, 'wood');
  const rodTier = normalizeRodTier(player.heldFishingRodTier, 'basic');
  const hasRod = player.hasFishingRod === true;
  const fishingActive = player.isLocal
    ? Boolean(fishingMiniGame.active || fishingMiniGame.starting)
    : player.isFishing === true;
  const rodVisible = hasRod && fishingActive;
  const pickaxeVisible = !rodVisible;

  if (parts.heldPickaxeHead?.material?.color) {
    parts.heldPickaxeHead.material.color.set(PICKAXE_HEAD_COLORS[tier] || PICKAXE_HEAD_COLORS.wood);
  }
  if (parts.heldPickaxe) {
    parts.heldPickaxe.visible = pickaxeVisible;
  }
  if (parts.heldFishingRodAccent?.material?.color) {
    parts.heldFishingRodAccent.material.color.set(FISHING_ROD_ACCENT_COLORS[rodTier] || FISHING_ROD_ACCENT_COLORS.basic);
  }
  if (parts.heldFishingRod) {
    parts.heldFishingRod.visible = rodVisible;
  }

  const localTorchCount = player.isLocal ? Math.max(0, Math.floor(Number(questState.inventory.torch) || 0)) : 1;
  const torchVisible = Boolean(player.torchEquipped) && localTorchCount > 0;
  if (parts.heldTorch) {
    parts.heldTorch.visible = torchVisible;
  }
  if (parts.heldTorchFlame) {
    parts.heldTorchFlame.visible = torchVisible;
  }
}

function syncLocalHeldGear(emitToServer = false) {
  const local = players.get(localPlayerId);
  if (!local) return;
  const prevPickaxe = normalizePickaxeTier(local.heldPickaxe, 'wood');
  const prevTorch = local.torchEquipped === true;
  const prevHasRod = local.hasFishingRod === true;
  const prevRodTier = normalizeRodTier(local.heldFishingRodTier, 'basic');
  const prevIsFishing = local.isFishing === true;
  local.heldPickaxe = normalizePickaxeTier(questState.pickaxe, 'wood');
  local.hasFishingRod = questState.hasFishingRod === true;
  local.heldFishingRodTier = normalizeRodTier(questState.fishingRodTier, 'basic');
  local.isFishing = Boolean(fishingMiniGame.active || fishingMiniGame.starting);
  if (Math.max(0, Math.floor(Number(questState.inventory.torch) || 0)) <= 0) {
    torchEquipped = false;
  }
  local.torchEquipped = torchEquipped;
  applyHeldGearVisual(local);
  const changed = prevPickaxe !== local.heldPickaxe
    || prevTorch !== local.torchEquipped
    || prevHasRod !== local.hasFishingRod
    || prevRodTier !== local.heldFishingRodTier
    || prevIsFishing !== local.isFishing;
  if (emitToServer && isAuthenticated && changed) {
    socket.emit('player:gear', {
      torchEquipped,
      hasFishingRod: local.hasFishingRod,
      fishingRodTier: local.heldFishingRodTier,
      isFishing: local.isFishing === true
    });
  }
}

function makeTextSign(text, width = 2.2, height = 0.7, bg = '#8b5a2b', fg = '#fef3c7') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#3f2a1a';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = fg;
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width * 0.5, canvas.height * 0.52);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.02 });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
}

function closeNpcDialogue() {
  npcDialogueOpen = false;
  npcDialoguePrimaryAction = null;
  npcDialogueSecondaryAction = null;
  if (npcDialogueEl) npcDialogueEl.style.display = 'none';
}

function closeMineWarningDialog() {
  mineWarningOpen = false;
  mineWarningContinueAction = null;
  if (mineWarningEl) mineWarningEl.style.display = 'none';
}

function openMineWarningDialog(onContinue) {
  if (!mineWarningEl || !mineWarningContinueEl || !mineWarningCancelEl) return;
  if (mineWarningOpen) return;
  mineWarningOpen = true;
  mineWarningContinueAction = typeof onContinue === 'function' ? onContinue : null;
  if (mineWarningNoAskEl) mineWarningNoAskEl.checked = skipMineEntryWarning;
  mineWarningEl.style.display = 'block';
}

function openNpcDialogue({ name, text, primaryLabel = 'Okay', secondaryLabel = 'Close', onPrimary, onSecondary }) {
  if (!npcDialogueEl || !npcDialogueNameEl || !npcDialogueTextEl || !npcDialoguePrimaryEl || !npcDialogueSecondaryEl) return;
  npcDialogueOpen = true;
  npcDialogueNameEl.textContent = name;
  npcDialogueTextEl.textContent = text;
  npcDialoguePrimaryEl.textContent = primaryLabel;
  npcDialogueSecondaryEl.textContent = secondaryLabel;
  npcDialoguePrimaryAction = typeof onPrimary === 'function' ? onPrimary : closeNpcDialogue;
  npcDialogueSecondaryAction = typeof onSecondary === 'function' ? onSecondary : closeNpcDialogue;
  npcDialogueEl.style.display = 'block';
}

function nextPickaxeTier() {
  const order = questState.shop.order;
  const currentIdx = order.indexOf(questState.pickaxe);
  if (currentIdx < 0 || currentIdx >= order.length - 1) return null;
  return order[currentIdx + 1];
}

function getStaminaMax() {
  const bonus = Math.max(0, Math.min(50, Math.floor(Number(questState.maxStaminaBonusPct) || 0)));
  return STAMINA_BASE_MAX * (1 + bonus / 100);
}

function canConsumeFish() {
  const fish = Math.max(0, Math.floor(Number(questState.inventory.fish) || 0));
  const bonus = Math.max(0, Math.min(50, Math.floor(Number(questState.maxStaminaBonusPct) || 0)));
  return fish > 0 && bonus < 50;
}

function refreshConsumeActionVisibility(local) {
  if (!mobileConsumeEl) return;
  const fish = Math.max(0, Math.floor(Number(questState.inventory.fish) || 0));
  const visible = Boolean(local)
    && isAuthenticated
    && !mineWarningOpen
    && !menuOpen
    && !isAnyGameplayOverlayOpen()
    && authModalEl.classList.contains('hidden')
    && customizeModalEl.classList.contains('hidden')
    && fish > 0;
  mobileConsumeEl.classList.toggle('hidden', !visible);
}

function resetFishingMiniGame() {
  fishingMiniGame.active = false;
  fishingMiniGame.starting = false;
  fishingMiniGame.spotId = null;
  fishingMiniGame.challengeId = null;
  fishingMiniGame.targetFish = null;
  fishingMiniGame.cursor = 0.5;
  fishingMiniGame.isHolding = false;
  fishingMiniGame.zonePointer = 0.2;
  fishingMiniGame.zoneDirection = 1;
  fishingMiniGame.zoneCenter = 0.5;
  fishingMiniGame.zoneWidth = 0.22;
  fishingMiniGame.zoneSpeed = 0.5;
  fishingMiniGame.cursorRiseSpeed = 0.9;
  fishingMiniGame.cursorFallSpeed = 0.8;
  fishingMiniGame.decaySpeed = 0.35;
  fishingMiniGame.requiredHoldMs = 1000;
  fishingMiniGame.holdMs = 0;
  fishingMiniGame.timeoutAt = 0;
  fishingMiniGame.rarity = 'common';
  if (fishingMiniGameUiTimer) {
    clearTimeout(fishingMiniGameUiTimer);
    fishingMiniGameUiTimer = null;
  }
  if (fishingMeterEl) {
    fishingMeterEl.classList.add('hidden');
  }
  setFishingFocusMode(false);
  syncLocalHeldGear(true);
}

function scheduleFishingMiniGameClose(delayMs = 180) {
  setFishingFocusMode(false);
  if (fishingMiniGameUiTimer) {
    clearTimeout(fishingMiniGameUiTimer);
    fishingMiniGameUiTimer = null;
  }
  fishingMiniGameUiTimer = setTimeout(() => {
    fishingMiniGameUiTimer = null;
    resetFishingMiniGame();
  }, delayMs);
}

function hideFishCatchCard() {
  if (fishCatchCardTimer) {
    clearTimeout(fishCatchCardTimer);
    fishCatchCardTimer = null;
  }
  fishCatchCardEl?.classList.add('hidden');
}

function normalizeFishRarity(value, fallback = 'common') {
  return FISH_RARITY_ORDER.includes(value) ? value : fallback;
}

function sanitizeHexColor(value, fallback) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return fallback;
}

function normalizeFishIndexMap(value) {
  const next = {};
  if (!value || typeof value !== 'object') return next;
  for (const [id, count] of Object.entries(value)) {
    if (!FISH_BY_ID.has(id)) continue;
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) continue;
    next[id] = Math.max(0, Math.floor(n));
  }
  return next;
}

function normalizeFishBagMap(value) {
  const next = {};
  if (!value || typeof value !== 'object') return next;
  for (const [id, count] of Object.entries(value)) {
    if (!FISH_BY_ID.has(id)) continue;
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) continue;
    next[id] = Math.max(0, Math.floor(n));
  }
  return next;
}

function caughtFishCount(fishId) {
  return Math.max(0, Math.floor(Number(questState.fishIndex?.[fishId]) || 0));
}

function ownedFishCount(fishId) {
  return Math.max(0, Math.floor(Number(questState.fishBag?.[fishId]) || 0));
}

function discoveredFishCount() {
  return FISH_CATALOG_SORTED.reduce((sum, fish) => sum + (caughtFishCount(fish.id) > 0 ? 1 : 0), 0);
}

function buildFishIconMarkup(fish, options = {}) {
  const locked = options.locked === true;
  const compact = options.compact === true;
  const fishColor = sanitizeHexColor(fish?.color, '#60a5fa');
  const fishAccent = sanitizeHexColor(fish?.accent, '#bfdbfe');
  const classes = ['fish-icon'];
  if (compact) classes.push('compact');
  if (locked) classes.push('locked');
  return `<div class="${classes.join(' ')}" style="--fish-main:${fishColor};--fish-accent:${fishAccent};"><span class="tail"></span><span class="body"></span><span class="fin"></span><span class="eye"></span></div>`;
}

function applyFishIcon(el, fish, options = {}) {
  if (!el) return;
  el.innerHTML = buildFishIconMarkup(fish, options);
}

function fishFromServerPayload(payload) {
  const id = typeof payload?.id === 'string' ? payload.id : '';
  const base = FISH_BY_ID.get(id);
  if (!base) return null;
  const rarity = normalizeFishRarity(payload?.rarity, base.rarity);
  return {
    ...base,
    rarity,
    chanceLabel: typeof payload?.chanceLabel === 'string' && payload.chanceLabel.trim()
      ? payload.chanceLabel.trim().slice(0, 40)
      : base.chanceLabel,
    color: sanitizeHexColor(payload?.color, base.color),
    accent: sanitizeHexColor(payload?.accent, base.accent)
  };
}

function setFishingMeterStatus(text, color = '#fef3c7') {
  if (!fishingMeterStatusEl) return;
  fishingMeterStatusEl.textContent = text;
  fishingMeterStatusEl.style.color = color;
}

function setFishingFocusMode(active) {
  document.body.classList.toggle('fishing-focus', Boolean(active));
}

function renderFishIndex() {
  if (!fishIndexListEl) return;
  const discovered = discoveredFishCount();
  if (fishIndexSummaryEl) {
    fishIndexSummaryEl.textContent = `Fish discovered: ${discovered} / ${FISH_CATALOG_SORTED.length}`;
  }
  if (marketFishIndexSummaryEl) {
    marketFishIndexSummaryEl.textContent = `Fish discovered: ${discovered} / ${FISH_CATALOG_SORTED.length}`;
  }
  fishIndexListEl.innerHTML = '';
  FISH_CATALOG_SORTED.forEach((fish) => {
    const count = caughtFishCount(fish.id);
    const isDiscovered = count > 0;
    const entry = document.createElement('article');
    entry.className = `fish-entry${isDiscovered ? '' : ' locked'}`;
    const rarityLabel = capitalizeWord(fish.rarity);
    entry.innerHTML = `
      <div class="icon-wrap">${buildFishIconMarkup(fish, { compact: true, locked: !isDiscovered })}</div>
      <div class="meta">
        <div class="name">${isDiscovered ? fish.name : 'Unknown Fish'}</div>
        <div class="sub">${rarityLabel}${isDiscovered ? ` - ${fish.chanceLabel}` : ''}</div>
      </div>
      <div class="count">${isDiscovered ? `x${count}` : '---'}</div>
    `;
    fishIndexListEl.appendChild(entry);
  });
}

function fishSellPriceById(fishId) {
  const fish = FISH_BY_ID.get(fishId);
  if (!fish) return 0;
  return FISH_SELL_BY_RARITY[normalizeFishRarity(fish.rarity, 'common')] || 0;
}

function normalizeRodTier(value, fallback = 'basic') {
  const tier = typeof value === 'string' ? value.toLowerCase() : '';
  return FISHING_ROD_TIERS.includes(tier) ? tier : fallback;
}

function rodTierLabel(value) {
  const tier = normalizeRodTier(value, 'basic');
  return FISHING_ROD_TIER_LABEL[tier] || capitalizeWord(tier);
}

function setRodShopStatus(text, color = '#cbd5e1') {
  if (!rodShopStatusEl) return;
  rodShopStatusEl.textContent = text || '';
  rodShopStatusEl.style.color = color;
}

function setMarketStatus(text, color = '#cbd5e1') {
  if (!marketStatusEl) return;
  marketStatusEl.textContent = text || '';
  marketStatusEl.style.color = color;
}

function setOreStatus(text, color = '#cbd5e1') {
  if (!oreStatusEl) return;
  oreStatusEl.textContent = text || '';
  oreStatusEl.style.color = color;
}

function setFurnitureTraderStatus(text, color = '#cbd5e1') {
  if (!furnitureTraderStatusEl) return;
  furnitureTraderStatusEl.textContent = text || '';
  furnitureTraderStatusEl.style.color = color;
}

function setHomeStatus(text, color = '#cbd5e1') {
  if (!homeStatusEl) return;
  homeStatusEl.textContent = text || '';
  homeStatusEl.style.color = color;
}

function formatRefreshCountdown(targetAt) {
  const remainingMs = Math.max(0, Math.floor(Number(targetAt) || 0) - Date.now());
  if (remainingMs <= 0) return 'refreshing now';
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function updateFurnitureTraderSummary() {
  if (!furnitureTraderSummaryEl) return;
  const trader = normalizeFurnitureTraderState(questState.furnitureTrader);
  questState.furnitureTrader = trader;
  const purchasesLeft = Math.max(0, Math.floor(Number(trader.purchasesRemaining) || 0));
  const refreshText = formatRefreshCountdown(trader.cycleEndsAt);
  furnitureTraderSummaryEl.textContent = `Purchases left this stock cycle: ${purchasesLeft} / ${Math.max(0, Math.floor(Number(trader.purchaseLimit) || 0))} | Refresh in ${refreshText}`;
}

function stopFurnitureTraderCountdown() {
  if (furnitureTraderCountdownTimer) {
    clearInterval(furnitureTraderCountdownTimer);
    furnitureTraderCountdownTimer = null;
  }
}

function startFurnitureTraderCountdown() {
  stopFurnitureTraderCountdown();
  updateFurnitureTraderSummary();
  furnitureTraderCountdownTimer = window.setInterval(() => {
    if (!furnitureTraderModalOpen) {
      stopFurnitureTraderCountdown();
      return;
    }
    updateFurnitureTraderSummary();
  }, 1000);
}

function renderFurnitureTraderModal() {
  const trader = normalizeFurnitureTraderState(questState.furnitureTrader);
  questState.furnitureTrader = trader;
  updateFurnitureTraderSummary();
  if (!furnitureTraderListEl) return;
  furnitureTraderListEl.innerHTML = '';
  for (const item of trader.items) {
    const card = document.createElement('article');
    card.className = 'market-section furniture-trader-card';

    const title = document.createElement('h3');
    title.textContent = item.label;

    const meta = document.createElement('div');
    meta.className = 'furniture-trader-card-meta';
    if (item.owned) {
      meta.textContent = 'Status: owned and ready for your room.';
    } else if (!item.availableThisCycle) {
      meta.textContent = item.occasional
        ? 'Occasional stock item. Check the next refresh.'
        : 'Unavailable this cycle.';
    } else if (item.remaining <= 0) {
      meta.textContent = 'Status: sold out for this cycle.';
    } else {
      const stockText = item.stock === 1 ? '1 copy this cycle' : `${item.remaining.toLocaleString()} of ${item.stock.toLocaleString()} left`;
      meta.textContent = `Price: ${item.price.toLocaleString()} coins | ${stockText}${item.occasional ? ' | Occasional stock' : ''}`;
    }

    const action = document.createElement('button');
    const cycleLimitReached = trader.purchasesRemaining <= 0;
    if (item.owned) {
      action.textContent = 'Owned';
      action.disabled = true;
    } else if (!item.availableThisCycle) {
      action.textContent = 'Not In Stock';
      action.disabled = true;
    } else if (item.remaining <= 0) {
      action.textContent = 'Sold Out';
      action.disabled = true;
    } else if (cycleLimitReached) {
      action.textContent = 'Cycle Limit Reached';
      action.disabled = true;
    } else {
      action.textContent = `Buy (${item.price.toLocaleString()} coins)`;
      action.disabled = questState.coins < item.price;
      action.addEventListener('click', () => {
        socket.emit('shop:buyFurniture', { itemId: item.itemId }, (resp) => {
          if (!resp?.ok) {
            setFurnitureTraderStatus(resp?.error || 'Could not buy furniture.', '#fecaca');
            return;
          }
          if (resp.progress) {
            applyProgressState(resp.progress);
          } else if (resp.furnitureTrader) {
            questState.furnitureTrader = normalizeFurnitureTraderState(resp.furnitureTrader);
          }
          renderFurnitureTraderModal();
          setFurnitureTraderStatus(`Bought ${item.label}. It is now placed in your room.`, '#86efac');
        });
      });
    }

    card.append(title, meta, action);
    furnitureTraderListEl.appendChild(card);
  }
}

function loadFurnitureTraderModal(statusText = '') {
  setFurnitureTraderStatus(statusText || 'Checking furniture stock...', '#93c5fd');
  socket.emit('shop:getFurnitureTrader', {}, (resp) => {
    if (!resp?.ok) {
      setFurnitureTraderStatus(resp?.error || 'Could not load furniture stock.', '#fecaca');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    } else if (resp.furnitureTrader) {
      questState.furnitureTrader = normalizeFurnitureTraderState(resp.furnitureTrader);
    }
    renderFurnitureTraderModal();
    setFurnitureTraderStatus(statusText || 'Some items rotate in and out of stock each cycle.', '#cbd5e1');
  });
}

function applyHomeRoomVisuals() {
  const roomState = normalizeHomeRoomState(questState.homeRoom);
  const wallOption = HOME_ROOM_WALL_OPTIONS[roomState.wallPaint] || HOME_ROOM_WALL_OPTIONS.sand;
  const floorOption = HOME_ROOM_FLOOR_OPTIONS[roomState.floorPaint] || HOME_ROOM_FLOOR_OPTIONS.oak;
  if (houseRoomWallMaterial?.color) {
    houseRoomWallMaterial.color.set(wallOption.color);
  }
  if (houseRoomFloorMaterial?.color) {
    houseRoomFloorMaterial.color.set(floorOption.color);
  }
  for (const itemId of HOME_ROOM_FURNITURE_ORDER) {
    const mesh = houseRoomFurnitureMeshes.get(itemId);
    if (!mesh) continue;
    const owned = roomState.ownedFurniture?.[itemId] === true;
    const placed = roomState.placedFurniture?.[itemId] === true;
    mesh.visible = owned && placed;
  }
}

function ensureHomePaintSelectOptions() {
  if (homeWallSelectEl && homeWallSelectEl.options.length === 0) {
    for (const [paintId, option] of Object.entries(HOME_ROOM_WALL_OPTIONS)) {
      const opt = document.createElement('option');
      opt.value = paintId;
      opt.textContent = option.label;
      homeWallSelectEl.appendChild(opt);
    }
  }
  if (homeFloorSelectEl && homeFloorSelectEl.options.length === 0) {
    for (const [paintId, option] of Object.entries(HOME_ROOM_FLOOR_OPTIONS)) {
      const opt = document.createElement('option');
      opt.value = paintId;
      opt.textContent = option.label;
      homeFloorSelectEl.appendChild(opt);
    }
  }
}

function renderHomeModal() {
  ensureHomePaintSelectOptions();
  const room = normalizeHomeRoomState(questState.homeRoom);
  questState.homeRoom = room;
  if (homeWallSelectEl) {
    homeWallSelectEl.value = Object.prototype.hasOwnProperty.call(HOME_ROOM_WALL_OPTIONS, room.wallPaint)
      ? room.wallPaint
      : 'sand';
  }
  if (homeFloorSelectEl) {
    homeFloorSelectEl.value = Object.prototype.hasOwnProperty.call(HOME_ROOM_FLOOR_OPTIONS, room.floorPaint)
      ? room.floorPaint
      : 'oak';
  }
  if (homeWallApplyEl) {
    homeWallApplyEl.textContent = `Apply Wall Paint (${HOME_ROOM_PAINT_PRICE.toLocaleString()} coins)`;
  }
  if (homeFloorApplyEl) {
    homeFloorApplyEl.textContent = `Apply Floor Paint (${HOME_ROOM_PAINT_PRICE.toLocaleString()} coins)`;
  }
  if (homeFurnitureListEl) {
    homeFurnitureListEl.innerHTML = '';
    for (const itemId of HOME_ROOM_FURNITURE_ORDER) {
      const item = HOME_ROOM_FURNITURE_SHOP[itemId];
      if (!item) continue;
      const owned = room.ownedFurniture?.[itemId] === true;
      const placed = room.placedFurniture?.[itemId] === true;
      const card = document.createElement('article');
      card.className = 'home-furniture-card';

      const header = document.createElement('div');
      header.className = 'home-furniture-header';

      const title = document.createElement('h3');
      title.textContent = item.label;

      const tag = document.createElement('span');
      tag.className = 'home-furniture-tag';
      if (owned) {
        tag.textContent = placed ? 'Placed' : 'Stored';
        tag.dataset.state = placed ? 'placed' : 'stored';
      } else {
        tag.textContent = item.occasionallyAvailable ? 'Occasional' : 'Standard';
        tag.dataset.state = item.occasionallyAvailable ? 'occasional' : 'standard';
      }

      header.append(title, tag);

      const meta = document.createElement('div');
      meta.className = 'home-furniture-meta';
      if (owned) {
        meta.textContent = placed
          ? 'Status: placed in your room.'
          : 'Status: owned and stored.';
      } else {
        const priceText = item.price ? `${item.price.toLocaleString()} coins` : 'Market price';
        meta.textContent = `Buy at the Furniture Trader island (${priceText}).`;
      }
      const action = document.createElement('button');
      if (owned) {
        action.textContent = placed ? 'Store Item' : 'Place Item';
        action.addEventListener('click', () => {
          socket.emit('home:toggleFurniture', { itemId, placed: !placed }, (resp) => {
            if (!resp?.ok) {
              setHomeStatus(resp?.error || 'Could not update furniture.', '#fecaca');
              return;
            }
            if (resp.progress) {
              applyProgressState(resp.progress);
            }
            setHomeStatus(`${item.label} ${placed ? 'stored' : 'placed'}.`, '#86efac');
            renderHomeModal();
          });
        });
      } else {
        action.textContent = 'Buy At Trader';
        action.disabled = true;
      }
      const actions = document.createElement('div');
      actions.className = 'home-furniture-actions';
      actions.append(action);
      card.append(header, meta, actions);
      homeFurnitureListEl.appendChild(card);
    }
  }
  if (homeDoorToggleEl) {
    homeDoorToggleEl.textContent = room.doorOpen === false ? 'Door: Closed' : 'Door: Open';
  }
  applyHomeRoomVisuals();
  if (homeStatusEl && !homeStatusEl.textContent.trim()) {
    setHomeStatus('Use coins to buy furniture and paint your room.', '#cbd5e1');
  }
}

function inventoryEntriesForTab(tab = 'ores') {
  if (tab === 'fish') {
    return FISH_CATALOG_SORTED
      .map((fish) => {
        const qty = ownedFishCount(fish.id);
        if (qty <= 0) return null;
        return {
          id: fish.id,
          name: `${fish.name} (${capitalizeWord(fish.rarity)})`,
          qty,
          price: fishSellPriceById(fish.id)
        };
      })
      .filter(Boolean);
  }
  return SELLABLE_ORE_ORDER.map((ore) => ({
    id: ore,
    name: capitalizeWord(ore),
    qty: Math.max(0, Math.floor(Number(questState.inventory?.[ore]) || 0)),
    price: ORE_SELL_PRICE[ore] || 0
  }));
}

function renderInventoryModal() {
  if (!inventoryListEl) return;
  const tab = inventoryViewTab === 'fish' ? 'fish' : 'ores';
  inventoryViewTab = tab;
  inventoryTabOresEl?.classList.toggle('active', tab === 'ores');
  inventoryTabFishEl?.classList.toggle('active', tab === 'fish');
  const entries = inventoryEntriesForTab(tab);
  inventoryListEl.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('article');
    empty.className = 'inventory-entry';
    empty.innerHTML = `
      <div class="name">No items</div>
      <div class="qty">${tab === 'fish' ? 'Catch fish to fill this tab.' : 'Mine ore to fill this tab.'}</div>
      <div class="price">Value: --</div>
    `;
    inventoryListEl.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'inventory-entry';
    card.innerHTML = `
      <div class="name">${entry.name}</div>
      <div class="qty">Owned: ${entry.qty.toLocaleString()}</div>
      <div class="price">Sell value: ${entry.price.toLocaleString()} coins each</div>
    `;
    inventoryListEl.appendChild(card);
  });
}

function renderRodShopModal() {
  const hasFishingRod = questState.hasFishingRod === true;
  const currentTier = normalizeRodTier(questState.fishingRodTier, 'basic');
  const shopData = rodShopSnapshot?.rodShop || null;
  const buyPrice = Math.max(0, Math.floor(Number(rodShopSnapshot?.buyPrice) || FISHING_ROD_PRICE));
  const basicRodLevelReq = Math.max(1, Math.floor(Number(FISHING_ROD_LEVEL_REQUIREMENT.basic) || 1));
  const canBuyBasicRod = questState.level >= basicRodLevelReq;
  const currentLabel = hasFishingRod ? rodTierLabel(currentTier) : 'None';
  if (rodCurrentTierEl) {
    rodCurrentTierEl.textContent = `Current rod: ${currentLabel}`;
  }
  const next = shopData?.next || null;
  if (!hasFishingRod) {
    if (rodNextTierEl) rodNextTierEl.textContent = 'Next upgrade: Buy your first rod';
    if (rodUpgradeCostEl) {
      const levelText = `Level required: ${basicRodLevelReq} (you: ${questState.level})`;
      rodUpgradeCostEl.textContent = `First rod price: ${buyPrice.toLocaleString()} coins | ${levelText}`;
    }
    if (rodUpgradeFishCostEl) rodUpgradeFishCostEl.innerHTML = '<li>No fish required for first rod.</li>';
  } else if (shopData && next) {
    if (rodNextTierEl) rodNextTierEl.textContent = `Next upgrade: ${next.label || rodTierLabel(next.tier)}`;
    if (rodUpgradeCostEl) {
      const coinsRequired = Math.max(0, Math.floor(Number(next.coins) || 0)).toLocaleString();
      const levelRequired = Math.max(1, Math.floor(Number(next.levelRequired) || 1));
      rodUpgradeCostEl.textContent = `Coins required: ${coinsRequired} | Level required: ${levelRequired} (you: ${questState.level})`;
    }
    if (rodUpgradeFishCostEl) {
      rodUpgradeFishCostEl.innerHTML = '';
      for (const cost of next.fishCost || []) {
        const item = document.createElement('li');
        const owned = Math.max(0, Math.floor(Number(ownedFishCount(cost?.fishId) || cost?.owned) || 0));
        const needed = Math.max(1, Math.floor(Number(cost?.amount) || 1));
        const ok = owned >= needed;
        item.style.color = ok ? '#86efac' : '#fca5a5';
        item.textContent = `${cost?.name || 'Fish'}: ${owned.toLocaleString()} / ${needed.toLocaleString()}`;
        rodUpgradeFishCostEl.appendChild(item);
      }
    }
  } else if (!shopData) {
    if (rodNextTierEl) rodNextTierEl.textContent = 'Next upgrade: Loading...';
    if (rodUpgradeCostEl) rodUpgradeCostEl.textContent = '';
    if (rodUpgradeFishCostEl) rodUpgradeFishCostEl.innerHTML = '<li>Loading rod data...</li>';
  } else {
    if (rodNextTierEl) rodNextTierEl.textContent = 'Next upgrade: Max tier reached';
    if (rodUpgradeCostEl) rodUpgradeCostEl.textContent = '';
    if (rodUpgradeFishCostEl) rodUpgradeFishCostEl.innerHTML = '<li>Your rod is fully upgraded.</li>';
  }

  if (rodBuyBtnEl) {
    rodBuyBtnEl.disabled = hasFishingRod || !canBuyBasicRod;
    rodBuyBtnEl.textContent = hasFishingRod
      ? 'Rod Owned'
      : (canBuyBasicRod
        ? `Buy Fishing Rod (${buyPrice.toLocaleString()} coins)`
        : `Locked: Level ${basicRodLevelReq}`);
  }
  if (rodUpgradeBtnEl) {
    const meetsLevel = Boolean(next?.meetsLevel);
    rodUpgradeBtnEl.disabled = !hasFishingRod || !next || !meetsLevel;
  }
}

function loadRodShopModal(statusText = '') {
  setRodShopStatus(statusText || 'Loading rod shop...', '#93c5fd');
  socket.emit('shop:getRodShop', {}, (resp) => {
    if (!resp?.ok) {
      setRodShopStatus(resp?.error || 'Could not load rod shop.', '#fecaca');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    rodShopSnapshot = resp;
    renderRodShopModal();
    setRodShopStatus(statusText || 'Use fish, coins, and level requirements to upgrade your rod.', '#cbd5e1');
  });
}

function marketSellEntries(category = 'fish') {
  if (category === 'ore') {
    return SELLABLE_ORE_ORDER
      .map((oreId) => {
        const qty = Math.max(0, Math.floor(Number(questState.inventory?.[oreId]) || 0));
        if (qty <= 0) return null;
        return {
          id: oreId,
          name: capitalizeWord(oreId),
          qty,
          unitPrice: ORE_SELL_PRICE[oreId] || 0
        };
      })
      .filter(Boolean);
  }
  return FISH_CATALOG_SORTED
    .map((fish) => {
      const qty = ownedFishCount(fish.id);
      if (qty <= 0) return null;
      return {
        id: fish.id,
        name: `${fish.name} (${capitalizeWord(fish.rarity)})`,
        qty,
        unitPrice: fishSellPriceById(fish.id)
      };
    })
    .filter(Boolean);
}

function selectedMarketSellEntry() {
  const selectedId = typeof marketSellItemEl?.value === 'string' ? marketSellItemEl.value : '';
  const entry = marketSellEntries('fish').find((item) => item.id === selectedId) || null;
  return { category: 'fish', entry };
}

function renderMarketSellOptions() {
  if (!marketSellItemEl) return;
  const entries = marketSellEntries('fish');
  const previous = marketSellItemEl.value;
  marketSellItemEl.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'No items available';
    marketSellItemEl.appendChild(empty);
    marketSellItemEl.disabled = true;
    if (marketSellAmountEl) {
      marketSellAmountEl.value = '1';
      marketSellAmountEl.max = '1';
    }
    if (marketSellBtnEl) marketSellBtnEl.disabled = true;
    return;
  }
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = `${entry.name} (x${entry.qty.toLocaleString()})`;
    marketSellItemEl.appendChild(option);
  }
  marketSellItemEl.disabled = false;
  marketSellItemEl.value = entries.some((row) => row.id === previous) ? previous : entries[0].id;
}

function renderMarketSellPreview() {
  const { entry } = selectedMarketSellEntry();
  if (!entry) {
    if (marketSellPricePreviewEl) marketSellPricePreviewEl.textContent = 'Value: --';
    if (marketSellBtnEl) marketSellBtnEl.disabled = true;
    return;
  }
  const maxOwned = Math.max(1, entry.qty);
  const requested = Number(marketSellAmountEl?.value);
  const amount = Number.isFinite(requested) ? THREE.MathUtils.clamp(Math.floor(requested), 1, maxOwned) : 1;
  if (marketSellAmountEl) {
    marketSellAmountEl.value = String(amount);
    marketSellAmountEl.max = String(maxOwned);
  }
  const total = amount * entry.unitPrice;
  if (marketSellPricePreviewEl) {
    marketSellPricePreviewEl.textContent = `Value: ${amount.toLocaleString()} x ${entry.unitPrice.toLocaleString()} = ${total.toLocaleString()} coins`;
  }
  if (marketSellBtnEl) marketSellBtnEl.disabled = false;
}

function renderMarketQuestFishOptions() {
  if (!marketQuestFishItemEl) return;
  const previous = marketQuestFishItemEl.value;
  const entries = FISH_CATALOG_SORTED
    .map((fish) => {
      const qty = ownedFishCount(fish.id);
      if (qty <= 0) return null;
      return { fish, qty };
    })
    .filter(Boolean);
  marketQuestFishItemEl.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'No fish in bag';
    marketQuestFishItemEl.appendChild(empty);
    marketQuestFishItemEl.disabled = true;
    if (marketQuestFishAmountEl) {
      marketQuestFishAmountEl.value = '1';
      marketQuestFishAmountEl.max = '1';
    }
    return;
  }
  for (const row of entries) {
    const option = document.createElement('option');
    option.value = row.fish.id;
    option.textContent = `${row.fish.name} (${capitalizeWord(row.fish.rarity)}) x${row.qty.toLocaleString()}`;
    marketQuestFishItemEl.appendChild(option);
  }
  marketQuestFishItemEl.disabled = false;
  marketQuestFishItemEl.value = entries.some((row) => row.fish.id === previous) ? previous : entries[0].fish.id;
  const selectedQty = entries.find((row) => row.fish.id === marketQuestFishItemEl.value)?.qty || 1;
  const requested = Number(marketQuestFishAmountEl?.value);
  const amount = Number.isFinite(requested) ? THREE.MathUtils.clamp(Math.floor(requested), 1, selectedQty) : 1;
  if (marketQuestFishAmountEl) {
    marketQuestFishAmountEl.value = String(amount);
    marketQuestFishAmountEl.max = String(selectedQty);
  }
}

function renderMarketQuestSection() {
  const quest = questState.fishingQuest;
  if (!quest) {
    if (marketQuestTitleEl) marketQuestTitleEl.textContent = 'Fishing quest unavailable';
    if (marketQuestDescEl) marketQuestDescEl.textContent = 'Try reopening this panel.';
    if (marketQuestProgressEl) marketQuestProgressEl.textContent = '';
    if (marketQuestAcceptBtnEl) marketQuestAcceptBtnEl.disabled = true;
    if (marketQuestTurnInBtnEl) marketQuestTurnInBtnEl.disabled = true;
    if (marketQuestClaimBtnEl) marketQuestClaimBtnEl.disabled = true;
    return;
  }
  const targetFish = quest.targetFishId ? FISH_BY_ID.get(quest.targetFishId) : null;
  const targetLabel = targetFish
    ? targetFish.name
    : `${capitalizeWord(normalizeFishRarity(quest.targetRarity, 'common'))} fish`;
  if (marketQuestTitleEl) marketQuestTitleEl.textContent = quest.title || 'Fishing Quest';
  if (marketQuestDescEl) marketQuestDescEl.textContent = quest.description || `Bring ${targetLabel}.`;
  if (marketQuestProgressEl) {
    const status = capitalizeWord(quest.status || 'available');
    const progress = `${Math.max(0, Math.floor(Number(quest.progress) || 0))}/${Math.max(1, Math.floor(Number(quest.targetCount) || 1))}`;
    const rewardXp = Math.max(0, Math.floor(Number(quest.rewardXp) || 0)).toLocaleString();
    marketQuestProgressEl.textContent = `Status: ${status} | Progress: ${progress} | Reward: ${rewardXp} XP`;
  }
  renderMarketQuestFishOptions();
  if (marketQuestAcceptBtnEl) marketQuestAcceptBtnEl.disabled = quest.status !== 'available';
  if (marketQuestTurnInBtnEl) {
    const hasSelection = Boolean(marketQuestFishItemEl && marketQuestFishItemEl.value);
    marketQuestTurnInBtnEl.disabled = quest.status !== 'active' || !hasSelection;
  }
  if (marketQuestClaimBtnEl) marketQuestClaimBtnEl.disabled = quest.status !== 'ready';
}

function renderMarketModal() {
  renderFishIndex();
  renderMarketSellOptions();
  renderMarketSellPreview();
  renderMarketQuestSection();
}

function selectedOreSellEntry() {
  const selectedId = typeof oreSellItemEl?.value === 'string' ? oreSellItemEl.value : '';
  const entry = marketSellEntries('ore').find((item) => item.id === selectedId) || null;
  return { category: 'ore', entry };
}

function renderOreSellOptions() {
  if (!oreSellItemEl) return;
  const entries = marketSellEntries('ore');
  const previous = oreSellItemEl.value;
  oreSellItemEl.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'No ores available';
    oreSellItemEl.appendChild(empty);
    oreSellItemEl.disabled = true;
    if (oreSellAmountEl) {
      oreSellAmountEl.value = '1';
      oreSellAmountEl.max = '1';
    }
    if (oreSellBtnEl) oreSellBtnEl.disabled = true;
    return;
  }
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = `${entry.name} (x${entry.qty.toLocaleString()})`;
    oreSellItemEl.appendChild(option);
  }
  oreSellItemEl.disabled = false;
  oreSellItemEl.value = entries.some((row) => row.id === previous) ? previous : entries[0].id;
}

function renderOreSellPreview() {
  const { entry } = selectedOreSellEntry();
  if (!entry) {
    if (oreSellPricePreviewEl) oreSellPricePreviewEl.textContent = 'Value: --';
    if (oreSellBtnEl) oreSellBtnEl.disabled = true;
    return;
  }
  const maxOwned = Math.max(1, entry.qty);
  const requested = Number(oreSellAmountEl?.value);
  const amount = Number.isFinite(requested) ? THREE.MathUtils.clamp(Math.floor(requested), 1, maxOwned) : 1;
  if (oreSellAmountEl) {
    oreSellAmountEl.value = String(amount);
    oreSellAmountEl.max = String(maxOwned);
  }
  const total = amount * entry.unitPrice;
  if (oreSellPricePreviewEl) {
    oreSellPricePreviewEl.textContent = `Value: ${amount.toLocaleString()} x ${entry.unitPrice.toLocaleString()} = ${total.toLocaleString()} coins`;
  }
  if (oreSellBtnEl) oreSellBtnEl.disabled = false;
}

function renderOreModal() {
  renderOreSellOptions();
  renderOreSellPreview();
}

function showFishCatchCard(fish, amount = 1) {
  if (!fish || !fishCatchCardEl) return;
  const rarity = normalizeFishRarity(fish.rarity, 'common');
  if (fishCatchRarityEl) {
    fishCatchRarityEl.textContent = capitalizeWord(rarity);
    fishCatchRarityEl.style.borderColor = `${FISH_RARITY_COLORS[rarity] || '#cbd5e1'}80`;
    fishCatchRarityEl.style.color = FISH_RARITY_COLORS[rarity] || '#e2e8f0';
  }
  if (fishCatchNameEl) {
    fishCatchNameEl.textContent = fish.name;
  }
  if (fishCatchChanceEl) {
    fishCatchChanceEl.textContent = fish.chanceLabel;
  }
  if (fishCatchCountEl) {
    fishCatchCountEl.textContent = `Caught x${Math.max(1, Math.floor(Number(amount) || 1))}`;
  }
  applyFishIcon(fishCatchIconEl, fish);
  fishCatchCardEl.classList.remove('hidden');
  if (fishCatchCardTimer) {
    clearTimeout(fishCatchCardTimer);
  }
  fishCatchCardTimer = setTimeout(() => {
    fishCatchCardTimer = null;
    fishCatchCardEl.classList.add('hidden');
  }, FISH_CATCH_CARD_SHOW_MS);
}

function hexToCss(value, fallback = '#9ca3af') {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const safe = Math.max(0, Math.min(0xffffff, Math.floor(num)));
  return `#${safe.toString(16).padStart(6, '0')}`;
}

function mineTimingProfile(resource) {
  return MINE_TIMING_PROFILES[resource] || {
    speed: 1.0,
    zoneWidth: 0.2,
    timeoutMs: MINE_TIMING_TIMEOUT_FALLBACK_MS
  };
}

function mineRequiredHits(resource) {
  return Math.max(1, Math.floor(Number(MINE_REQUIRED_HITS[resource]) || 1));
}

function randomMiningZoneCenter(zoneWidth) {
  const half = zoneWidth * 0.5;
  const minCenter = half + 0.06;
  const maxCenter = 1 - half - 0.06;
  return minCenter + Math.random() * Math.max(0.01, maxCenter - minCenter);
}

function setMiningZoneLayout(zoneCenter, zoneWidth) {
  if (!miningMeterZoneEl) return;
  const left = (zoneCenter - zoneWidth * 0.5) * 100;
  miningMeterZoneEl.style.left = `${left.toFixed(2)}%`;
  miningMeterZoneEl.style.width = `${(zoneWidth * 100).toFixed(2)}%`;
}

function setMiningCrackProgress(progress) {
  if (!miningOrePreviewEl) return;
  const clamped = THREE.MathUtils.clamp(Number(progress) || 0, 0, 1);
  miningOrePreviewEl.style.setProperty('--crack-progress', clamped.toFixed(3));
  miningOrePreviewEl.classList.toggle('cracked', clamped >= 0.999);
}

function setMiningMeterStatus(text, color = '#fef3c7') {
  if (!miningMeterStatusEl) return;
  miningMeterStatusEl.textContent = text;
  miningMeterStatusEl.style.color = color;
}

function pickaxeAccuracyZoneBonusPct(tier) {
  const normalized = normalizePickaxeTier(tier, 'wood');
  const multiplier = PICKAXE_ACCURACY_ZONE_MULTIPLIER[normalized] || 1;
  return Math.max(0, Math.round((multiplier - 1) * 100));
}

function renderMiningTierBonusLegend(currentTier = 'wood') {
  if (!miningMeterTierBonusEl) return;
  const normalized = normalizePickaxeTier(currentTier, 'wood');
  const summary = PICKAXE_TIERS
    .map((tier) => `${capitalizeWord(tier)} +${pickaxeAccuracyZoneBonusPct(tier)}%`)
    .join('  |  ');
  miningMeterTierBonusEl.textContent = `Zone bonus: ${summary}   (Current: ${capitalizeWord(normalized)} +${pickaxeAccuracyZoneBonusPct(normalized)}%)`;
}

function setMiningFocusMode(active) {
  document.body.classList.toggle('mining-focus', Boolean(active));
}

function resetMiningAccuracyGame() {
  miningAccuracyGame.active = false;
  miningAccuracyGame.node = null;
  miningAccuracyGame.pointer = 0;
  miningAccuracyGame.direction = 1;
  miningAccuracyGame.zoneCenter = 0.5;
  miningAccuracyGame.zoneWidth = 0.2;
  miningAccuracyGame.speed = 1.0;
  miningAccuracyGame.timeoutAt = 0;
  miningAccuracyGame.hitCount = 0;
  miningAccuracyGame.requiredHits = 1;
  if (miningAccuracyUiTimer) {
    clearTimeout(miningAccuracyUiTimer);
    miningAccuracyUiTimer = null;
  }
  if (miningOrePreviewEl) {
    setMiningCrackProgress(0);
  }
  if (miningMeterEl) {
    miningMeterEl.classList.add('hidden');
  }
  setMiningFocusMode(false);
}

function scheduleMiningAccuracyClose(delayMs = 180) {
  setMiningFocusMode(false);
  if (miningAccuracyUiTimer) {
    clearTimeout(miningAccuracyUiTimer);
    miningAccuracyUiTimer = null;
  }
  miningAccuracyUiTimer = setTimeout(() => {
    miningAccuracyUiTimer = null;
    resetMiningAccuracyGame();
  }, delayMs);
}

function startMiningAccuracyGame(node) {
  if (!node || !node.mesh?.visible || node.breaking) return false;
  const profile = mineTimingProfile(node.resource);
  const pickaxeTier = normalizePickaxeTier(questState.pickaxe, 'wood');
  const zoneMultiplier = PICKAXE_ACCURACY_ZONE_MULTIPLIER[pickaxeTier] || 1;
  const zoneWidth = THREE.MathUtils.clamp(profile.zoneWidth * zoneMultiplier, 0.08, 0.46);
  const zoneCenter = randomMiningZoneCenter(zoneWidth);
  const requiredHits = mineRequiredHits(node.resource);
  const pickaxeHead = PICKAXE_HEAD_COLORS[pickaxeTier] || PICKAXE_HEAD_COLORS.wood;
  const oreColor = node.colorHex ?? ORE_RESOURCE_COLORS[node.resource] ?? ORE_RESOURCE_COLORS.stone;

  if (miningAccuracyUiTimer) {
    clearTimeout(miningAccuracyUiTimer);
    miningAccuracyUiTimer = null;
  }
  miningAccuracyGame.active = true;
  miningAccuracyGame.node = node;
  miningAccuracyGame.pointer = 0.08 + Math.random() * 0.84;
  miningAccuracyGame.direction = Math.random() < 0.5 ? -1 : 1;
  miningAccuracyGame.zoneCenter = zoneCenter;
  miningAccuracyGame.zoneWidth = zoneWidth;
  miningAccuracyGame.speed = Math.max(0.65, Number(profile.speed) || 1);
  miningAccuracyGame.timeoutAt = performance.now() + Math.max(1200, Number(profile.timeoutMs) || MINE_TIMING_TIMEOUT_FALLBACK_MS);
  miningAccuracyGame.hitCount = 0;
  miningAccuracyGame.requiredHits = requiredHits;

  if (miningOrePreviewEl) {
    miningOrePreviewEl.style.setProperty('--ore-color', hexToCss(oreColor));
    setMiningCrackProgress(0);
  }
  if (miningPickaxeHeadEl) {
    miningPickaxeHeadEl.style.background = hexToCss(pickaxeHead, '#94a3b8');
  }
  setMiningZoneLayout(zoneCenter, zoneWidth);
  if (miningMeterPointerEl) {
    miningMeterPointerEl.style.setProperty('--pickaxe-head-color', hexToCss(pickaxeHead, '#94a3b8'));
    miningMeterPointerEl.style.left = `${(miningAccuracyGame.pointer * 100).toFixed(2)}%`;
  }
  renderMiningTierBonusLegend(pickaxeTier);
  setMiningMeterStatus(`Mine ${node.resource}: hit green ${requiredHits}x (${miningAccuracyGame.hitCount}/${requiredHits}).`, '#fef3c7');
  if (miningMeterEl) {
    miningMeterEl.classList.remove('hidden');
  }
  setMiningFocusMode(true);
  return true;
}

function activeMiningNode(local) {
  const node = miningAccuracyGame.node;
  if (!local || !node || !node.mesh || !node.mesh.visible || node.breaking) return null;
  node.mesh.getWorldPosition(_mineNodeWorldPos);
  const dist = Math.hypot(local.x - _mineNodeWorldPos.x, local.z - _mineNodeWorldPos.z);
  if (dist > 3.45) return null;
  return node;
}

function beginOreBreak(node, nowMs = performance.now()) {
  if (!node || !node.mesh) return;
  node.breaking = true;
  node.breakStartAt = nowMs;
  node.breakEndAt = nowMs + 170;
  node.readyAt = nowMs + node.cooldownMs;
}

function attemptMiningAccuracyHit(local) {
  if (!miningAccuracyGame.active) return false;
  const now = performance.now();
  if (now - lastMineAt < MINE_TIMING_HIT_COOLDOWN_MS) return true;
  lastMineAt = now;

  if (!local || !inMine) {
    resetMiningAccuracyGame();
    return true;
  }
  const node = activeMiningNode(local);
  if (!node) {
    miningAccuracyGame.active = false;
    setMiningMeterStatus('Mining canceled. Move closer to the ore.', '#fecaca');
    scheduleMiningAccuracyClose(180);
    return true;
  }

  const zoneHalf = miningAccuracyGame.zoneWidth * 0.5;
  const zoneMin = miningAccuracyGame.zoneCenter - zoneHalf;
  const zoneMax = miningAccuracyGame.zoneCenter + zoneHalf;
  const hit = miningAccuracyGame.pointer >= zoneMin && miningAccuracyGame.pointer <= zoneMax;

  if (!hit) {
    miningAccuracyGame.active = false;
    mineRetryBlockedUntil = now + MINE_MISS_RETRY_COOLDOWN_MS;
    setMiningMeterStatus(`Missed. Retry in ${(MINE_MISS_RETRY_COOLDOWN_MS / 1000).toFixed(1)}s.`, '#fecaca');
    updateQuestPanel(`Missed timing on ${node.resource}. Retry in ${(MINE_MISS_RETRY_COOLDOWN_MS / 1000).toFixed(1)}s.`);
    scheduleMiningAccuracyClose(170);
    return true;
  }

  const requiredHits = Math.max(1, Math.floor(Number(miningAccuracyGame.requiredHits) || mineRequiredHits(node.resource)));
  miningAccuracyGame.requiredHits = requiredHits;
  miningAccuracyGame.hitCount = Math.min(requiredHits, miningAccuracyGame.hitCount + 1);
  const crackProgress = miningAccuracyGame.hitCount / requiredHits;
  setMiningCrackProgress(crackProgress);
  startMineSwing(localPlayerId, Date.now());

  if (miningAccuracyGame.hitCount < requiredHits) {
    miningAccuracyGame.zoneCenter = randomMiningZoneCenter(miningAccuracyGame.zoneWidth);
    miningAccuracyGame.pointer = 0.08 + Math.random() * 0.84;
    miningAccuracyGame.direction = Math.random() < 0.5 ? -1 : 1;
    const stageTimeout = Math.max(
      1000,
      Math.floor((Number(mineTimingProfile(node.resource).timeoutMs) || MINE_TIMING_TIMEOUT_FALLBACK_MS) * 0.92)
    );
    miningAccuracyGame.timeoutAt = now + stageTimeout;
    setMiningZoneLayout(miningAccuracyGame.zoneCenter, miningAccuracyGame.zoneWidth);
    if (miningMeterPointerEl) {
      miningMeterPointerEl.style.left = `${(miningAccuracyGame.pointer * 100).toFixed(2)}%`;
    }
    setMiningMeterStatus(
      `Crack ${miningAccuracyGame.hitCount}/${requiredHits}. Hit green again with your pickaxe.`,
      '#86efac'
    );
    updateQuestPanel(
      `Crack ${miningAccuracyGame.hitCount}/${requiredHits} on ${node.resource}. Keep landing green hits.`
    );
    return true;
  }

  miningAccuracyGame.active = false;
  setMiningMeterStatus(`Crack ${requiredHits}/${requiredHits}! Ore shattered.`, '#86efac');
  const amount = mineAmountForPickaxe(node.resource);
  beginOreBreak(node, now);
  scheduleMiningAccuracyClose(220);
  socket.emit('mine:collect', { resource: node.resource, amount }, (resp) => {
    if (!resp?.ok) {
      node.breaking = false;
      node.breakStartAt = 0;
      node.breakEndAt = 0;
      node.readyAt = performance.now() + 220;
      node.mesh.visible = true;
      node.mesh.scale.setScalar(node.baseScale || 1);
      node.mesh.rotation.x = 0;
      node.mesh.rotation.z = 0;
      node.mesh.position.y = node.baseY || 1.86;
      updateQuestPanel(resp?.error || 'Could not mine ore.');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    const questMsg = resp.questProgressed ? ' Quest progress updated.' : '';
    updateQuestPanel(`Mined ${amount} ${node.resource}.${questMsg}`);
  });
  return true;
}

function updateMiningAccuracyGame(local, nowMs, delta) {
  if (!miningAccuracyGame.active) return;
  if (!local || !isAuthenticated || !inMine || menuOpen || mineWarningOpen || npcDialogueOpen || !customizeModalEl.classList.contains('hidden')) {
    resetMiningAccuracyGame();
    return;
  }
  const node = activeMiningNode(local);
  if (!node) {
    miningAccuracyGame.active = false;
    setMiningMeterStatus('Mining canceled. Move closer to the ore.', '#fecaca');
    scheduleMiningAccuracyClose(170);
    return;
  }
  if (nowMs >= miningAccuracyGame.timeoutAt) {
    miningAccuracyGame.active = false;
    mineRetryBlockedUntil = nowMs + MINE_MISS_RETRY_COOLDOWN_MS;
    setMiningMeterStatus(`Too slow. Retry in ${(MINE_MISS_RETRY_COOLDOWN_MS / 1000).toFixed(1)}s.`, '#fecaca');
    updateQuestPanel(`Too slow. Retry in ${(MINE_MISS_RETRY_COOLDOWN_MS / 1000).toFixed(1)}s.`);
    scheduleMiningAccuracyClose(170);
    return;
  }
  let pointer = miningAccuracyGame.pointer + delta * miningAccuracyGame.speed * miningAccuracyGame.direction;
  if (pointer > 1) {
    pointer = 2 - pointer;
    miningAccuracyGame.direction = -1;
  } else if (pointer < 0) {
    pointer = -pointer;
    miningAccuracyGame.direction = 1;
  }
  miningAccuracyGame.pointer = THREE.MathUtils.clamp(pointer, 0, 1);
  if (miningMeterPointerEl) {
    miningMeterPointerEl.style.left = `${(miningAccuracyGame.pointer * 100).toFixed(2)}%`;
  }
}

function updateMiningFocusCamera(local, delta) {
  if (!local || !miningAccuracyGame.active) return false;
  const node = activeMiningNode(local);
  if (!node) return false;
  node.mesh.getWorldPosition(_mineNodeWorldPos);
  const dx = _mineNodeWorldPos.x - local.x;
  const dz = _mineNodeWorldPos.z - local.z;
  const len = Math.hypot(dx, dz) || 1;
  const dirX = dx / len;
  const dirZ = dz / len;
  const sideX = -dirZ;
  const sideZ = dirX;
  const desiredX = _mineNodeWorldPos.x - dirX * MINE_FOCUS_CAMERA_BACK + sideX * MINE_FOCUS_CAMERA_SIDE;
  const desiredY = Math.min(MINE_CEILING_Y - 1.25, local.y + MINE_FOCUS_CAMERA_HEIGHT);
  const desiredZ = _mineNodeWorldPos.z - dirZ * MINE_FOCUS_CAMERA_BACK + sideZ * MINE_FOCUS_CAMERA_SIDE;

  _mineFocusCameraPos.set(desiredX, desiredY, desiredZ);
  _mineFocusLook.set(_mineNodeWorldPos.x, _mineNodeWorldPos.y + 0.35, _mineNodeWorldPos.z);

  camera.position.x += (_mineFocusCameraPos.x - camera.position.x) * Math.min(1, delta * 11.5);
  camera.position.y += (_mineFocusCameraPos.y - camera.position.y) * Math.min(1, delta * 11.5);
  camera.position.z += (_mineFocusCameraPos.z - camera.position.z) * Math.min(1, delta * 11.5);
  camera.lookAt(_mineFocusLook);
  local.mesh.visible = true;
  return true;
}

function updateFishingFocusCamera(local, delta) {
  if (!local || !fishingMiniGame.active) return false;
  const spot = activeFishingSpot(local);
  if (!spot) return false;
  _fishSpotWorldPos.set(spot.x, Math.max(local.y + 0.48, 1.9), spot.z);
  const dx = _fishSpotWorldPos.x - local.x;
  const dz = _fishSpotWorldPos.z - local.z;
  const len = Math.hypot(dx, dz) || 1;
  const dirX = dx / len;
  const dirZ = dz / len;
  const sideX = -dirZ;
  const sideZ = dirX;
  const desiredX = _fishSpotWorldPos.x - dirX * FISH_FOCUS_CAMERA_BACK + sideX * FISH_FOCUS_CAMERA_SIDE;
  const desiredY = local.y + FISH_FOCUS_CAMERA_HEIGHT;
  const desiredZ = _fishSpotWorldPos.z - dirZ * FISH_FOCUS_CAMERA_BACK + sideZ * FISH_FOCUS_CAMERA_SIDE;

  _fishFocusCameraPos.set(desiredX, desiredY, desiredZ);
  _fishFocusLook.set(_fishSpotWorldPos.x, _fishSpotWorldPos.y + 0.14, _fishSpotWorldPos.z);

  camera.position.x += (_fishFocusCameraPos.x - camera.position.x) * Math.min(1, delta * 10.8);
  camera.position.y += (_fishFocusCameraPos.y - camera.position.y) * Math.min(1, delta * 10.8);
  camera.position.z += (_fishFocusCameraPos.z - camera.position.z) * Math.min(1, delta * 10.8);
  camera.lookAt(_fishFocusLook);
  local.mesh.visible = true;
  return true;
}

function applyProgressState(progress) {
  if (!progress || typeof progress !== 'object') return;
  questState.coins = Math.max(0, Math.floor(Number(progress.coins) || 0));
  questState.xp = Math.max(0, Math.floor(Number(progress.xp) || 0));
  questState.level = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(Number(progress.level) || 1)));
  const xpIntoLevel = Math.max(0, Math.floor(Number(progress.xpIntoLevel) || 0));
  const xpToNextLevel = Math.max(0, Math.floor(Number(progress.xpToNextLevel) || 0));
  if (questState.level >= MAX_PLAYER_LEVEL) {
    questState.xpIntoLevel = 0;
    questState.xpToNextLevel = 0;
  } else {
    questState.xpToNextLevel = xpToNextLevel > 0 ? xpToNextLevel : BASE_XP_TO_LEVEL;
    questState.xpIntoLevel = Math.min(questState.xpToNextLevel, xpIntoLevel);
  }
  questState.pickaxe = normalizePickaxeTier(progress.pickaxe, 'wood');
  const inv = progress.inventory || {};
  questState.inventory.stone = Math.max(0, Math.floor(Number(inv.stone) || 0));
  questState.inventory.iron = Math.max(0, Math.floor(Number(inv.iron) || 0));
  questState.inventory.gold = Math.max(0, Math.floor(Number(inv.gold) || 0));
  questState.inventory.diamond = Math.max(0, Math.floor(Number(inv.diamond) || 0));
  const torchCount = Number(inv.torch);
  questState.inventory.torch = Number.isFinite(torchCount)
    ? Math.max(0, Math.floor(torchCount))
    : 1;
  const fishCount = Number(inv.fish);
  questState.fishBag = normalizeFishBagMap(progress.fishBag);
  const fishFromBag = Object.values(questState.fishBag).reduce((sum, count) => sum + (Number(count) || 0), 0);
  questState.inventory.fish = Number.isFinite(fishCount)
    ? Math.max(0, Math.floor(fishCount))
    : Math.max(0, Math.floor(fishFromBag));
  if (fishFromBag > 0) {
    questState.inventory.fish = Math.max(0, Math.floor(fishFromBag));
  }
  questState.fishIndex = normalizeFishIndexMap(progress.fishIndex);
  questState.hasFishingRod = progress.hasFishingRod === true;
  questState.fishingRodTier = normalizeRodTier(progress.fishingRodTier, 'basic');
  if (!questState.hasFishingRod) {
    questState.fishingRodTier = 'basic';
  }
  questState.fishingQuest = progress.fishingQuest && typeof progress.fishingQuest === 'object'
    ? { ...progress.fishingQuest }
    : null;
  questState.fishingQuestCompletions = Math.max(0, Math.floor(Number(progress.fishingQuestCompletions) || 0));
  questState.maxStaminaBonusPct = Math.max(0, Math.min(50, Math.floor(Number(progress.maxStaminaBonusPct) || 0)));
  questState.homeRoom = normalizeHomeRoomState(progress.homeRoom);
  questState.furnitureTrader = normalizeFurnitureTraderState(progress.furnitureTrader);
  applyHomeRoomVisuals();
  if (questState.inventory.torch <= 0) {
    torchEquipped = false;
  }
  const local = players.get(localPlayerId);
  if (stamina > getStaminaMax()) {
    stamina = getStaminaMax();
  }
  if (!questState.hasFishingRod) {
    resetFishingMiniGame();
  }
  questState.quest = progress.quest ? { ...progress.quest } : null;
  syncLocalHeldGear();
  renderInventoryBar();
  if (fishIndexOpen) {
    renderFishIndex();
  }
  if (inventoryModalOpen) {
    renderInventoryModal();
  }
  if (marketModalOpen) {
    renderMarketModal();
  }
  if (rodShopModalOpen) {
    renderRodShopModal();
  }
  if (oreModalOpen) {
    renderOreModal();
  }
  if (furnitureTraderModalOpen) {
    renderFurnitureTraderModal();
  }
  if (homeModalOpen) {
    renderHomeModal();
  }
  refreshConsumeActionVisibility(local);
  updateQuestPanel();
}

function updateQuestPanel(message = '') {
  const quest = questState.quest;
  const showTracker = Boolean(quest && (quest.status === 'active' || quest.status === 'ready'));
  if (questTrackerEl) {
    questTrackerEl.style.display = showTracker ? 'grid' : 'none';
  }
  if (questTitleEl) questTitleEl.textContent = `Current Quest: ${quest?.title || 'none'}`;
  if (questProgressEl) {
    const progress = quest ? `${quest.progress || 0}/${quest.targetCount || 0}` : '0/0';
    const status = quest ? ` (${capitalizeWord(quest.status || 'new')})` : '';
    questProgressEl.textContent = `Progress: ${progress}${status}`;
  }

  if (questStatusMsgEl) questStatusMsgEl.textContent = message || '';
}

function getPickaxePower() {
  if (questState.pickaxe === 'diamond') return 4;
  if (questState.pickaxe === 'iron') return 3;
  if (questState.pickaxe === 'stone') return 2;
  return 1;
}

function renderInventoryBar() {
  if (inventoryBarEl) inventoryBarEl.classList.remove('hidden');
  if (inventoryCoinsEl) {
    inventoryCoinsEl.textContent = Math.max(0, Math.floor(Number(questState.coins) || 0)).toLocaleString();
  }
  const level = Math.max(1, Math.floor(Number(questState.level) || 1));
  const xpInto = Math.max(0, Math.floor(Number(questState.xpIntoLevel) || 0));
  const xpNeed = Math.max(0, Math.floor(Number(questState.xpToNextLevel) || 0));
  const maxLevel = level >= MAX_PLAYER_LEVEL || xpNeed <= 0;
  const xpPct = maxLevel ? 100 : THREE.MathUtils.clamp((xpInto / Math.max(1, xpNeed)) * 100, 0, 100);
  if (inventoryLevelEl) {
    inventoryLevelEl.textContent = `Lv ${level}`;
  }
  if (inventoryXpFillEl) {
    inventoryXpFillEl.style.width = `${xpPct.toFixed(1)}%`;
  }
  if (inventoryXpMetaEl) {
    inventoryXpMetaEl.textContent = maxLevel
      ? 'MAX LEVEL'
      : `${xpInto.toLocaleString()} / ${xpNeed.toLocaleString()}`;
  }
  if (inventoryPickaxeEl) {
    inventoryPickaxeEl.textContent = capitalizeWord(questState.pickaxe || 'wood');
  }
  const torchCount = Math.max(0, Math.floor(Number(questState.inventory.torch) || 0));
  if (inventoryTorchEl) {
    inventoryTorchEl.textContent = torchEquipped && torchCount > 0 ? `${torchCount} (On)` : String(torchCount);
  }
  if (inventoryTorchSlotEl) {
    inventoryTorchSlotEl.classList.toggle('active', torchEquipped && torchCount > 0);
  }
  if (inventoryFishEl) {
    inventoryFishEl.textContent = String(Math.max(0, Math.floor(Number(questState.inventory.fish) || 0)));
  }
}

function toggleTorchEquip() {
  const torchCount = Math.max(0, Math.floor(Number(questState.inventory.torch) || 0));
  if (torchCount <= 0) {
    torchEquipped = false;
    syncLocalHeldGear(true);
    renderInventoryBar();
    appendChatLine({ text: 'No torches available in inventory.', isSystem: true });
    return;
  }
  torchEquipped = !torchEquipped;
  syncLocalHeldGear(true);
  renderInventoryBar();
  appendChatLine({ text: torchEquipped ? 'Torch equipped.' : 'Torch put away.', isSystem: true });
}

function consumeFish(amount = 1) {
  if (!isAuthenticated) return;
  if (!canConsumeFish()) {
    appendChatLine({ text: 'No fish to consume or stamina bonus is maxed.', isSystem: true });
    return;
  }
  const qty = Math.max(1, Math.floor(Number(amount) || 1));
  socket.emit('fish:consume', { amount: qty }, (resp) => {
    if (!resp?.ok) {
      appendChatLine({ text: resp?.error || 'Could not consume fish.', isSystem: true });
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    const gained = Number(resp?.consumed) || qty;
    appendChatLine({
      text: `Consumed ${gained} fish. Max stamina is now ${Math.round(getStaminaMax())}.`,
      isSystem: true
    });
    updateQuestPanel(`Consumed fish. Max stamina: ${Math.round(getStaminaMax())}.`);
  });
}

function updateTorchLight(local, nowMs) {
  const torchCount = Math.max(0, Math.floor(Number(questState.inventory.torch) || 0));
  const active = Boolean(local && torchEquipped && torchCount > 0);
  if (!active) {
    torchLight.visible = false;
    return;
  }

  const facing = Number.isFinite(local.facingYaw) ? local.facingYaw : cameraYaw;
  const nearMine = inMine || mineDistance(local.x, local.z) <= MINE_PLAY_RADIUS + 6;
  const forwardOffset = nearMine ? 0.95 : 0.82;
  const sideOffset = 0.28;
  const handY = local.y + (local.isSwimming ? 1.15 : 1.55);
  const flicker = 0.92 + Math.sin(nowMs * 0.02) * 0.08;

  torchLight.visible = true;
  torchLight.distance = nearMine ? TORCH_LIGHT_DISTANCE_MINE : TORCH_LIGHT_DISTANCE_SURFACE;
  torchLight.intensity = (nearMine ? TORCH_LIGHT_INTENSITY_MINE : TORCH_LIGHT_INTENSITY_SURFACE) * flicker;
  torchLight.position.set(
    local.x + Math.sin(facing) * forwardOffset + Math.cos(facing) * sideOffset,
    handY,
    local.z + Math.cos(facing) * forwardOffset - Math.sin(facing) * sideOffset
  );
}

function updateHud() {
  playerCountEl.textContent = String(players.size || 1);
  renderInventoryBar();
  updateQuestPanel();
}

function appendChatLine({
  fromName,
  fromTag = null,
  text,
  sentAt,
  isSystem = false,
  isPrivate = false,
  isOutgoingPrivate = false
}) {
  const row = document.createElement('li');
  if (isSystem) row.classList.add('system');
  if (isPrivate) row.classList.add('private');
  if (isOutgoingPrivate) row.classList.add('outgoing');
  const time = new Date(sentAt || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const meta = document.createElement('span');
  meta.className = 'meta';
  const safeName = String(fromName || '').trim() || 'Player';
  const safeTag = isSystem ? null : normalizeAccountTag(fromTag);
  meta.appendChild(document.createTextNode(`[${time}] `));
  if (isPrivate && isOutgoingPrivate) {
    meta.appendChild(document.createTextNode('To '));
  }
  if (isSystem) {
    meta.appendChild(document.createTextNode('System'));
  } else {
    if (safeTag) {
      const badge = document.createElement('span');
      badge.className = 'chat-role-tag';
      badge.textContent = `[${safeTag}]`;
      meta.appendChild(badge);
      meta.appendChild(document.createTextNode(' '));
    }
    meta.appendChild(document.createTextNode(safeName));
  }
  if (isPrivate) {
    meta.appendChild(document.createTextNode(' (private)'));
  }
  meta.appendChild(document.createTextNode(':'));
  row.appendChild(meta);
  row.appendChild(document.createTextNode(` ${text}`));
  chatLogEl.appendChild(row);

  while (chatLogEl.children.length > 70) {
    chatLogEl.removeChild(chatLogEl.firstChild);
  }

  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function parsePrivateChatCommand(inputText) {
  const raw = String(inputText || '').trim();
  const match = raw.match(/^\/(msg|pm|w|whisper)\s+(.+)$/i);
  if (!match) return null;

  const body = match[2].trim();
  if (!body) {
    return { error: 'Usage: /msg <player> <message>' };
  }

  let targetName = '';
  let message = '';
  if (body.startsWith('"')) {
    const closingQuote = body.indexOf('"', 1);
    if (closingQuote <= 1) {
      return { error: 'For names with spaces, use quotes: /msg "Player Name" hello' };
    }
    targetName = body.slice(1, closingQuote).trim();
    message = body.slice(closingQuote + 1).trim();
  } else {
    const firstSpace = body.indexOf(' ');
    if (firstSpace <= 0) {
      return { error: 'Usage: /msg <player> <message>' };
    }
    targetName = body.slice(0, firstSpace).trim();
    message = body.slice(firstSpace + 1).trim();
  }

  if (!targetName || !message) {
    return { error: 'Usage: /msg <player> <message>' };
  }
  return { targetName, message };
}

function resolvePrivateRecipient(targetName) {
  const query = String(targetName || '').trim().toLowerCase();
  if (!query) return { error: 'Recipient is required.' };

  const localName = String(players.get(localPlayerId)?.name || '').toLowerCase();
  if (localName && localName === query) {
    return { error: 'You cannot message yourself.' };
  }

  const exactMatches = [];
  const prefixMatches = [];
  players.forEach((player, id) => {
    if (!player || id === localPlayerId) return;
    const name = String(player.name || '').trim();
    if (!name) return;
    const lower = name.toLowerCase();
    if (lower === query) {
      exactMatches.push({ id, name });
    } else if (lower.startsWith(query)) {
      prefixMatches.push({ id, name });
    }
  });

  if (exactMatches.length === 1) return { recipient: exactMatches[0] };
  if (exactMatches.length > 1) return { error: `Multiple players named "${targetName}" are online.` };
  if (prefixMatches.length === 1) return { recipient: prefixMatches[0] };
  if (prefixMatches.length > 1) return { error: `"${targetName}" matches multiple players. Be more specific.` };
  return { error: `Player "${targetName}" is not online.` };
}

function triggerEmote(type) {
  const now = performance.now();
  if (now - lastEmoteAt < 300) return;
  lastEmoteAt = now;
  if (localPlayerId) {
    applyEmote(localPlayerId, type, Date.now());
  }
  socket.emit('emote', { type });
}

function applyEmote(id, type, sentAt = Date.now()) {
  const player = players.get(id);
  if (!player) return;
  player.emoteType = type;
  player.emoteUntil = sentAt + 2200;
}

function normalizeClientIceServer(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const urlsRaw = entry.urls;
  const urls = Array.isArray(urlsRaw)
    ? urlsRaw.filter((value) => typeof value === 'string' && value.trim())
    : (typeof urlsRaw === 'string' && urlsRaw.trim() ? [urlsRaw.trim()] : []);
  if (!urls.length) return null;
  const normalized = { urls: urls.length === 1 ? urls[0] : urls };
  if (typeof entry.username === 'string' && entry.username.trim()) {
    normalized.username = entry.username.trim();
  }
  if (typeof entry.credential === 'string' && entry.credential.trim()) {
    normalized.credential = entry.credential.trim();
  }
  return normalized;
}

async function ensureVoiceConfigLoaded() {
  if (voiceConfigLoadPromise) return voiceConfigLoadPromise;
  voiceConfigLoadPromise = (async () => {
    try {
      const resp = await fetch('/voice-config', { cache: 'no-store' });
      const payload = await resp.json().catch(() => null);
      const list = Array.isArray(payload?.iceServers)
        ? payload.iceServers.map(normalizeClientIceServer).filter(Boolean)
        : [];
      if (list.length) {
        voiceIceServers = list;
      }
    } catch {
      voiceIceServers = [...DEFAULT_VOICE_ICE_SERVERS];
    }
  })().finally(() => {
    voiceConfigLoadPromise = null;
  });
  return voiceConfigLoadPromise;
}

function removeVoicePeer(peerId) {
  const pc = voicePeers.get(peerId);
  if (pc) {
    pc.onconnectionstatechange = null;
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.close();
    voicePeers.delete(peerId);
  }
  const audio = voiceAudioEls.get(peerId);
  if (audio) {
    audio.srcObject = null;
    audio.remove();
    voiceAudioEls.delete(peerId);
  }
  pendingVoiceIce.delete(peerId);
  voicePeerStreams.delete(peerId);
}

function queueVoiceIce(peerId, candidate) {
  if (!peerId || !candidate) return;
  const list = pendingVoiceIce.get(peerId) || [];
  list.push(candidate);
  if (list.length > MAX_PENDING_VOICE_ICE) {
    list.splice(0, list.length - MAX_PENDING_VOICE_ICE);
  }
  pendingVoiceIce.set(peerId, list);
}

async function flushQueuedIce(peerId, pc) {
  const list = pendingVoiceIce.get(peerId);
  if (!pc || !list?.length || !pc.remoteDescription) return;
  pendingVoiceIce.delete(peerId);
  for (const candidate of list) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {}
  }
}

function hasRemoteDescription(pc) {
  return Boolean(pc?.remoteDescription?.type);
}

function ensureVoicePeer(peerId, shouldOffer) {
  if (!voiceEnabled || !peerId || peerId === localPlayerId) return null;
  if (voicePeers.has(peerId)) return voicePeers.get(peerId);

  const pc = new RTCPeerConnection({
    iceServers: voiceIceServers
  });
  const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
  const localTrack = localVoiceStream?.getAudioTracks?.()[0] || null;
  if (localTrack) {
    audioTransceiver.sender.replaceTrack(localTrack).catch(() => {});
  }
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('voice:ice', { to: peerId, candidate: event.candidate });
    }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') {
      pc.createOffer({ iceRestart: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('voice:offer', { to: peerId, offer: pc.localDescription });
        })
        .catch(() => {});
    }
  };
  pc.ontrack = (event) => {
    let audio = voiceAudioEls.get(peerId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      document.body.appendChild(audio);
      voiceAudioEls.set(peerId, audio);
    }
    let stream = event.streams?.[0] || null;
    if (!stream) {
      stream = voicePeerStreams.get(peerId) || new MediaStream();
      if (event.track && !stream.getTracks().some((track) => track.id === event.track.id)) {
        stream.addTrack(event.track);
      }
      voicePeerStreams.set(peerId, stream);
    } else {
      voicePeerStreams.set(peerId, stream);
    }
    audio.srcObject = stream;
    audio.muted = false;
    audio.volume = 1;
    const startPlayback = audio.play();
    if (startPlayback?.catch) {
      startPlayback.catch(() => {});
    }
  };
  voicePeers.set(peerId, pc);

  if (shouldOffer) {
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        socket.emit('voice:offer', { to: peerId, offer: pc.localDescription });
      })
      .catch(() => {});
  }
  return pc;
}

async function enableVoice() {
  if (voiceEnabled) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
    if (voiceToggleEl) voiceToggleEl.textContent = 'Voice not supported';
    return;
  }
  await ensureVoiceConfigLoaded();
  voiceEnabled = true;
  await setVoiceMuted(false);
  socket.emit('voice:join');
}

function disableVoice() {
  if (!voiceEnabled) return;
  voiceEnabled = false;
  voiceMuted = false;
  socket.emit('voice:leave');
  if (localVoiceStream) {
    localVoiceStream.getTracks().forEach((track) => track.stop());
    localVoiceStream = null;
  }
  [...voicePeers.keys()].forEach(removeVoicePeer);
  updateVoiceButtonLabels();
}

async function toggleVoiceQuick() {
  if (!voiceEnabled) {
    await enableVoice();
    return;
  }
  await setVoiceMuted(!voiceMuted);
}

function updateVoiceVolumes() {
  if (!voiceEnabled) return;
  voiceAudioEls.forEach((audio) => {
    if (!audio) return;
    audio.volume = 1;
  });
}

function updateCliffWaterfallVisibility() {
  if (!cliffWaterfallRoot) return;
  cliffWaterfallRoot.getWorldPosition(waterfallWorldPos);
  cliffWaterfallRoot.getWorldQuaternion(waterfallWorldQuat);
  waterfallForward.set(0, 0, 1).applyQuaternion(waterfallWorldQuat).normalize();
  waterfallToCamera.copy(camera.position).sub(waterfallWorldPos).normalize();
  const fromFront = waterfallForward.dot(waterfallToCamera) > 0;
  if (cliffWaterfallState) {
    cliffWaterfallState.foam.visible = fromFront;
    cliffWaterfallState.lipFoam.visible = fromFront;
    cliffWaterfallState.splashGroup.visible = fromFront;
    if (cliffWaterfallState.mistCurtain) cliffWaterfallState.mistCurtain.visible = fromFront;
    if (cliffWaterfallState.mistPoints) cliffWaterfallState.mistPoints.visible = fromFront;
    if (Array.isArray(cliffWaterfallState.edgeVeils)) {
      for (const veil of cliffWaterfallState.edgeVeils) {
        veil.visible = fromFront;
      }
    }
  } else if (cliffWaterfallFoam) {
    cliffWaterfallFoam.visible = fromFront;
  }
}

function updateCliffWaterfall(nowMs, delta) {
  const state = cliffWaterfallState;
  if (!state) {
    updateCliffWaterfallVisibility();
    return;
  }

  const t = nowMs * 0.001;
  state.flowTexture.offset.y = (state.flowTexture.offset.y - delta * (0.78 + Math.sin(t * 0.7) * 0.08) + 1) % 1;
  state.flowTexture.offset.x = Math.sin(t * 0.32) * 0.022;
  state.coreTexture.offset.y = (state.coreTexture.offset.y - delta * (1.22 + Math.cos(t * 0.9) * 0.09) + 1) % 1;
  state.coreTexture.offset.x = 0.19 + Math.cos(t * 0.53) * 0.015;

  state.sheet.material.opacity = 0.78 + Math.sin(t * 2.2) * 0.08;
  state.coreSheet.material.opacity = 0.31 + Math.sin(t * 3.3 + 0.8) * 0.11;
  state.sheet.position.x = Math.sin(t * 1.68) * 0.042;
  state.sheet.position.y = Math.sin(t * 0.95) * 0.03;
  state.coreSheet.position.x = Math.sin(t * 2.02 + 1.2) * 0.07;

  if (Array.isArray(state.edgeVeils)) {
    for (let i = 0; i < state.edgeVeils.length; i += 1) {
      const veil = state.edgeVeils[i];
      const side = i === 0 ? -1 : 1;
      veil.position.x = side * (2.68 + Math.sin(t * 1.5 + i * 0.9) * 0.08);
      veil.position.z = 6.03 + Math.cos(t * 1.2 + i * 0.7) * 0.03;
      veil.rotation.y = side * (0.14 + Math.sin(t * 1.15 + i * 0.6) * 0.03);
      veil.material.opacity = 0.28 + Math.sin(t * 2.4 + i * 0.85) * 0.08;
    }
  }

  for (const streak of state.streaks) {
    const { minY, maxY, speed, baseX, swayPhase, swayAmp } = streak.userData;
    streak.position.y -= speed * delta;
    if (streak.position.y < minY) {
      streak.position.y += (maxY - minY);
    }
    streak.position.x = baseX + Math.sin(t * (1.8 + speed * 0.14) + swayPhase) * (swayAmp + 0.03);
    streak.material.opacity = 0.42 + Math.sin(t * 3.3 + swayPhase) * 0.2;
  }

  state.foam.scale.set(
    1.02 + Math.sin(t * 4.1) * 0.08,
    1 + Math.sin(t * 3.2) * 0.05,
    1
  );
  state.foam.material.opacity = 0.62 + Math.sin(t * 2.8) * 0.16;
  state.foam.position.y = -4.55 + Math.sin(t * 2.4) * 0.04;
  state.foam.position.x = Math.sin(t * 1.22) * 0.08;
  state.lipFoam.material.opacity = 0.46 + Math.sin(t * 4.8 + 0.4) * 0.18;
  state.lipFoam.position.y = 4.58 + Math.sin(t * 3.0) * 0.035;
  state.lipFoam.scale.x = 1 + Math.sin(t * 1.6) * 0.03;

  if (state.mistCurtain) {
    state.mistCurtain.material.opacity = 0.2 + Math.sin(t * 2.1 + 0.4) * 0.06;
    state.mistCurtain.position.y = -4.03 + Math.sin(t * 1.7) * 0.04;
    state.mistCurtain.scale.x = 1 + Math.sin(t * 0.9) * 0.03;
  }

  if (state.mistAttr && Array.isArray(state.mistData) && state.mistData.length) {
    const arr = state.mistAttr.array;
    for (let i = 0; i < state.mistData.length; i += 1) {
      const data = state.mistData[i];
      data.phase += delta * data.speed;
      if (data.phase >= 1) {
        data.phase -= 1;
        data.angle = Math.random() * Math.PI * 2;
        data.radius = 0.32 + Math.random() * 0.98;
        data.spread = 0.64 + Math.random() * 1.6;
        data.lift = 0.34 + Math.random() * 1.05;
        data.speed = 0.45 + Math.random() * 0.8;
        data.drift = 0.35 + Math.random() * 0.9;
      }
      const p = data.phase;
      const liftPulse = Math.sin(p * Math.PI);
      const spread = data.radius + data.spread * p;
      const idx = i * 3;
      arr[idx] = Math.cos(data.angle) * spread + Math.sin(t * (1.4 + data.drift) + i * 0.37) * 0.14;
      arr[idx + 1] = Math.pow(liftPulse, 0.8) * data.lift + Math.sin(t * 2.5 + i * 0.12) * 0.04;
      arr[idx + 2] = Math.sin(data.angle) * spread * 0.34 + Math.cos(t * (1.1 + data.drift) + i * 0.23) * 0.1;
    }
    state.mistAttr.needsUpdate = true;
    state.mistPoints.material.opacity = 0.36 + Math.sin(t * 1.8) * 0.08;
  }

  for (const drop of state.splashDrops) {
    const data = drop.userData;
    data.phase += delta * data.speed;
    if (data.phase >= 1) {
      data.phase -= 1;
      data.angle = Math.random() * Math.PI * 2;
      data.radius = 0.2 + Math.random() * 0.3;
      data.spread = 0.38 + Math.random() * 0.42;
      data.lift = 0.14 + Math.random() * 0.28;
      data.speed = 0.9 + Math.random() * 1.2;
    }
    const spread = data.radius + data.spread * data.phase;
    drop.position.x = Math.cos(data.angle) * spread;
    drop.position.z = Math.sin(data.angle) * spread * 0.42;
    drop.position.y = Math.sin(data.phase * Math.PI) * data.lift;
    const pulse = Math.sin(data.phase * Math.PI);
    drop.scale.setScalar(0.6 + pulse * 0.95);
    drop.material.opacity = (1 - data.phase) * 0.56;
  }

  updateCliffWaterfallVisibility();
}

function applyHeldToolArmPose(player, speed, now) {
  const parts = player?.mesh?.userData?.parts;
  if (!parts) return;
  const stride = Math.sin((player.animPhase || 0) * 1.2 + now * 0.0016);
  const torchActive = Boolean(player.torchEquipped);
  const rightX = -1.08 + stride * 0.08 * speed;
  const rightY = 0.2;
  const rightZ = 0.68;
  const leftX = (torchActive ? -1.16 : -0.64) + stride * 0.05 * speed;
  const leftY = torchActive ? -0.14 : -0.06;
  const leftZ = torchActive ? -0.58 : -0.3;
  const blend = 0.72;

  parts.rightArmPivot.rotation.x = THREE.MathUtils.lerp(parts.rightArmPivot.rotation.x, rightX, blend);
  parts.rightArmPivot.rotation.y = THREE.MathUtils.lerp(parts.rightArmPivot.rotation.y, rightY, blend);
  parts.rightArmPivot.rotation.z = THREE.MathUtils.lerp(parts.rightArmPivot.rotation.z, rightZ, blend);

  parts.leftArmPivot.rotation.x = THREE.MathUtils.lerp(parts.leftArmPivot.rotation.x, leftX, blend);
  parts.leftArmPivot.rotation.y = THREE.MathUtils.lerp(parts.leftArmPivot.rotation.y, leftY, blend);
  parts.leftArmPivot.rotation.z = THREE.MathUtils.lerp(parts.leftArmPivot.rotation.z, leftZ, blend);
}

function applyMineSwingPose(player, body, parts, baseBodyY, now) {
  const startAt = Number(player.mineSwingStartedAt) || now;
  const progress = THREE.MathUtils.clamp((now - startAt) / MINE_SWING_MS, 0, 1);
  const strike = Math.sin(progress * Math.PI);
  body.position.y = baseBodyY + strike * 0.08;
  body.rotation.x = -0.06 + strike * 0.22;
  body.rotation.y = Math.sin(progress * Math.PI * 2) * 0.05;

  parts.rightArmPivot.rotation.x = -1.16 + strike * 1.48;
  parts.rightArmPivot.rotation.y = 0.26;
  parts.rightArmPivot.rotation.z = 0.76 - strike * 0.7;

  parts.leftArmPivot.rotation.x = -0.9 + strike * 0.2;
  parts.leftArmPivot.rotation.y = -0.1;
  parts.leftArmPivot.rotation.z = -0.46;
}

function updatePlayerEmotes(now, delta) {
  players.forEach((player) => {
    const body = player.mesh.userData.body;
    const parts = player.mesh.userData.parts;
    const baseBodyY = player.mesh.userData.baseBodyY;
    if (!body || !parts) return;
    const resetForGround = () => {
      body.rotation.set(0, 0, 0);
      body.position.y = baseBodyY;
      parts.leftArmPivot.rotation.set(0, 0, 0);
      parts.rightArmPivot.rotation.set(0, 0, 0);
      parts.leftLegPivot.rotation.set(0, 0, 0);
      parts.rightLegPivot.rotation.set(0, 0, 0);
    };

    if (player.onBoat) {
      resetForGround();
      body.position.y = baseBodyY - 0.68;
      body.rotation.x = -0.08;
      parts.leftLegPivot.rotation.x = 1.26;
      parts.rightLegPivot.rotation.x = 1.26;
      const rowStrength = Math.min(1, Math.abs(boatState.speed) / 8);
      const stroke = Math.sin(boatState.paddlePhase || 0) * rowStrength;
      parts.leftArmPivot.rotation.x = -0.2 + stroke * 0.46;
      parts.rightArmPivot.rotation.x = -0.2 - stroke * 0.46;
      parts.leftArmPivot.rotation.z = -0.18 + stroke * 0.18;
      parts.rightArmPivot.rotation.z = 0.18 - stroke * 0.18;
      return;
    }

    const mineSwingUntil = Number(player.mineSwingUntil) || 0;
    const hasMineSwing = mineSwingUntil > now;
    const hasEmote = Boolean(player.emoteType && now <= player.emoteUntil);
    player.animPhase += delta * (4 + player.animSpeed * 13);
    const stride = Math.sin(player.animPhase);
    const strideAbs = Math.abs(stride);
    const speed = Math.min(1, player.animSpeed);

    if (!hasMineSwing && !hasEmote && inDeepWater(player)) {
      if (shouldUseWaterIdle(player, speed)) {
        applyWaterIdlePose(player, body, parts, baseBodyY, now, delta);
      } else {
        applySwimPose(player, body, parts, baseBodyY, delta);
      }
      return;
    }

    resetForGround();

    // Roblox-like locomotion: strong arm-leg opposition and blocky posture.
    if (!hasMineSwing && !hasEmote && speed > 0.04) {
      const legSwing = 0.96 * speed;
      const armSwing = 1.08 * speed;

      parts.leftLegPivot.rotation.x = stride * legSwing;
      parts.rightLegPivot.rotation.x = -stride * legSwing;
      parts.leftArmPivot.rotation.x = -stride * armSwing;
      parts.rightArmPivot.rotation.x = stride * armSwing;

      body.position.y = baseBodyY + strideAbs * (0.06 + speed * 0.05);
      body.rotation.x = -0.08 - speed * 0.12;
      body.rotation.y = Math.sin(player.animPhase * 0.5) * 0.03;
    } else if (!hasMineSwing && !hasEmote) {
      // Idle has a subtle toy-like sway.
      const idle = Math.sin(now * 0.0042 + player.animPhase) * 0.03;
      body.position.y = baseBodyY + idle;
      body.rotation.y = Math.sin(now * 0.0024 + player.animPhase) * 0.04;
      parts.leftArmPivot.rotation.x = 0.03 + Math.sin(now * 0.0035 + player.animPhase) * 0.04;
      parts.rightArmPivot.rotation.x = 0.03 - Math.sin(now * 0.0035 + player.animPhase) * 0.04;
    }

    if (!hasMineSwing && !hasEmote && player.y > GROUND_Y + 0.08) {
      // In-air pose: arms up, legs slightly tucked.
      body.rotation.x = -0.2;
      parts.leftArmPivot.rotation.x = -0.45;
      parts.rightArmPivot.rotation.x = -0.45;
      parts.leftLegPivot.rotation.x = 0.28;
      parts.rightLegPivot.rotation.x = 0.28;
    }

    if (hasMineSwing) {
      applyMineSwingPose(player, body, parts, baseBodyY, now);
      if (!hasEmote) {
        player.emoteType = null;
      }
      return;
    }

    player.mineSwingUntil = 0;

    if (!hasEmote) {
      applyHeldToolArmPose(player, speed, now);
      player.emoteType = null;
      return;
    }

    const t = (now % 1200) / 1200;
    if (player.emoteType === 'wave') {
      parts.rightArmPivot.rotation.x = -1.42;
      parts.rightArmPivot.rotation.z = Math.sin(t * Math.PI * 10) * 0.5;
      parts.leftArmPivot.rotation.x = 0.28;
      body.rotation.y = Math.sin(t * Math.PI * 2) * 0.16;
    } else if (player.emoteType === 'dance') {
      const beat = Math.sin(t * Math.PI * 6);
      body.rotation.y = beat * 0.72;
      body.position.y = baseBodyY + Math.abs(beat) * 0.18;
      parts.leftArmPivot.rotation.x = beat * 1.22;
      parts.rightArmPivot.rotation.x = -parts.leftArmPivot.rotation.x;
      parts.leftLegPivot.rotation.x = beat * 0.68;
      parts.rightLegPivot.rotation.x = -parts.leftLegPivot.rotation.x;
    } else if (player.emoteType === 'cheer') {
      body.position.y = baseBodyY + Math.abs(Math.sin(t * Math.PI * 4)) * 0.26;
      parts.leftArmPivot.rotation.x = -1.52;
      parts.rightArmPivot.rotation.x = -1.52;
      parts.leftArmPivot.rotation.z = -0.16;
      parts.rightArmPivot.rotation.z = 0.16;
      body.rotation.z = Math.sin(t * Math.PI * 4) * 0.16;
    }
  });
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function teleportLocal(local, pos, yaw = null) {
  local.x = pos.x;
  local.y = pos.y ?? GROUND_Y;
  local.z = pos.z;
  local.vy = 0;
  stopSwimOnTeleport(local);
  local.mesh.position.set(local.x, local.y, local.z);
  if (typeof yaw === 'number') {
    local.facingYaw = yaw;
    local.targetYaw = yaw;
    local.mesh.rotation.y = yaw;
  }
}

function boardBoat(local) {
  if (!boatState.mesh) return;
  boatState.onboard = true;
  local.onBoat = true;
  local.isSwimming = false;
  const slot = nearestDockSlot(local, 11);
  const nearBoat = distance2D(local, boatState) < 5.2;
  if (slot && !nearBoat) {
    const posed = boatPoseForDock(slot);
    boatState.x = posed.x;
    boatState.z = posed.z;
    boatState.yaw = posed.yaw;
  }
  boatState.speed = 0;
  boatState.mesh.position.set(boatState.x, boatState.y, boatState.z);
  boatState.mesh.rotation.y = boatState.yaw;
  teleportLocal(local, { x: boatState.x, y: GROUND_Y, z: boatState.z }, boatState.yaw);
}

function exitBoat(local, forceAnywhere = false) {
  boatState.onboard = false;
  boatState.speed = 0;
  local.onBoat = false;
  local.isSwimming = false;
  const dockSlot = nearestDockSlot(boatState, 12);
  if (dockSlot && !forceAnywhere) {
    const posed = boatPoseForDock(dockSlot);
    boatState.x = posed.x;
    boatState.z = posed.z;
    boatState.yaw = posed.yaw;
    boatState.mesh.position.set(boatState.x, boatState.y, boatState.z);
    boatState.mesh.rotation.y = boatState.yaw;
    const disembark = {
      x: dockSlot.dock.x - Math.sin(dockSlot.yaw) * 1.2,
      y: GROUND_Y,
      z: dockSlot.dock.z - Math.cos(dockSlot.yaw) * 1.2
    };
    teleportLocal(local, disembark, boatState.yaw);
    return;
  }

  const sideOffset = 1.14;
  const sideSign = Math.sin(performance.now() * 0.003) > 0 ? 1 : -1;
  const outX = boatState.x + Math.cos(boatState.yaw) * sideOffset * sideSign;
  const outZ = boatState.z - Math.sin(boatState.yaw) * sideOffset * sideSign;
  const outY = isWaterAt(outX, outZ) ? SWIM_SURFACE_Y : GROUND_Y;
  teleportLocal(local, { x: outX, y: outY, z: outZ }, boatState.yaw);
  local.isSwimming = isWaterAt(outX, outZ);
}

function isNearFishingVendor(local) {
  if (!local) return false;
  if (inFishingShop) return distance2D(local, FISHING_SHOP_COUNTER_POS) <= 3.2;
  return distance2D(local, FISHING_VENDOR_POS) <= 3.3;
}

function isNearFishMarket(local) {
  if (!local) return false;
  if (inMarketShop) return distance2D(local, MARKET_SHOP_COUNTER_POS) <= 3.2;
  return distance2D(local, MARKET_VENDOR_POS) <= 3.3;
}

function isNearFurnitureVendor(local) {
  if (!local) return false;
  if (inFurnitureShop) return distance2D(local, FURNITURE_SHOP_COUNTER_POS) <= 3.2;
  return distance2D(local, FURNITURE_VENDOR_POS) <= 3.3;
}

function isNearFishingShopExit(local) {
  return Boolean(local) && inFishingShop && distance2D(local, FISHING_SHOP_EXIT_POS) <= SHOP_EXIT_INTERACT_RADIUS;
}

function isNearMarketShopExit(local) {
  return Boolean(local) && inMarketShop && distance2D(local, MARKET_SHOP_EXIT_POS) <= SHOP_EXIT_INTERACT_RADIUS;
}

function isNearFurnitureShopExit(local) {
  return Boolean(local) && inFurnitureShop && distance2D(local, FURNITURE_SHOP_EXIT_POS) <= SHOP_EXIT_INTERACT_RADIUS;
}

function isNearHouseRoomExit(local) {
  return Boolean(local) && inHouseRoom && distance2D(local, HOUSE_ROOM_EXIT_POS) <= HOUSE_ROOM_EXIT_INTERACT_RADIUS;
}

function isNearHouseHallExit(local) {
  return Boolean(local) && inHouseHall && distance2D(local, HOUSE_HALL_EXIT_POS) <= HOUSE_HALL_EXIT_INTERACT_RADIUS;
}

function isNearHouseWorkshop(local) {
  return Boolean(local) && inHouseRoom && distance2D(local, HOUSE_ROOM_WORKSHOP_POS) <= HOUSE_ROOM_WORKSHOP_INTERACT_RADIUS;
}

function getNearbyHouseHallDoor(local, radius = 2.6) {
  if (!local || !inHouseHall) return null;
  let best = null;
  for (const door of houseHallRoomDoors) {
    const dist = Math.hypot(local.x - door.position.x, local.z - door.position.z);
    if (dist <= radius && (!best || dist < best.dist)) {
      best = { door, dist };
    }
  }
  return best?.door || null;
}

function nearestFishingSpot(local, radius = FISHING_SPOT_RADIUS) {
  if (!local) return null;
  let best = null;
  for (const spot of fishingSpots) {
    const dist = Math.hypot(local.x - spot.x, local.z - spot.z);
    if (dist <= radius && (!best || dist < best.dist)) {
      best = { spot, dist };
    }
  }
  return best?.spot || null;
}

function findFishingSpotById(id) {
  if (!id) return null;
  return fishingSpots.find((spot) => spot.id === id) || null;
}

function activeFishingSpot(local) {
  if (!local || !fishingMiniGame.active) return null;
  const spot = findFishingSpotById(fishingMiniGame.spotId);
  if (!spot) return null;
  if (distance2D(local, spot) > FISHING_SPOT_RADIUS + 2.8) return null;
  return spot;
}

function updateFishingMeterVisuals() {
  const half = THREE.MathUtils.clamp(fishingMiniGame.zoneWidth * 0.5, 0.04, 0.45);
  if (fishingMeterZoneEl) {
    fishingMeterZoneEl.style.left = `${((fishingMiniGame.zoneCenter - half) * 100).toFixed(2)}%`;
    fishingMeterZoneEl.style.width = `${(fishingMiniGame.zoneWidth * 100).toFixed(2)}%`;
  }
  if (fishingMeterPointerEl) {
    fishingMeterPointerEl.style.left = `${(fishingMiniGame.cursor * 100).toFixed(2)}%`;
  }
}

function applyFishingCatchResponse(resp, fallbackFish = null) {
  if (!resp?.ok) {
    updateQuestPanel(resp?.error || 'Could not catch fish.');
    appendChatLine({ text: resp?.error || 'Could not catch fish.', isSystem: true });
    return;
  }
  if (resp.progress) {
    applyProgressState(resp.progress);
  }
  const fish = fishFromServerPayload(resp?.caughtFish) || fallbackFish;
  if (!fish) {
    updateQuestPanel('Caught fish successfully.');
    appendChatLine({ text: 'Caught 1 fish.', isSystem: true });
    return;
  }
  const fishCount = Math.max(1, Math.floor(Number(resp?.fishCaughtCount) || ownedFishCount(fish.id) || 1));
  showFishCatchCard(fish, fishCount);
  renderFishIndex();
  updateQuestPanel(`Caught ${fish.name} (${capitalizeWord(fish.rarity)}).`);
  appendChatLine({ text: `Caught ${fish.name} (${capitalizeWord(fish.rarity)}).`, isSystem: true });
}

function completeFishingMinigame(local) {
  const spot = activeFishingSpot(local);
  if (!spot) {
    setFishingMeterStatus('Fishing canceled. Move back to the fishing spot.', '#fecaca');
    scheduleFishingMiniGameClose(170);
    return;
  }
  const challengeId = typeof fishingMiniGame.challengeId === 'string' ? fishingMiniGame.challengeId : '';
  const targetFish = fishingMiniGame.targetFish;
  fishingMiniGame.active = false;
  fishingMiniGame.isHolding = false;
  setFishingMeterStatus('Hooked! Reeling in...', '#86efac');
  scheduleFishingMiniGameClose(180);
  socket.emit('fish:catch', { challengeId }, (resp) => {
    applyFishingCatchResponse(resp, targetFish);
  });
}

function startFishingMinigame(spot) {
  if (!spot || fishingMiniGame.starting) return false;
  resetFishingMiniGame();
  fishingMiniGame.active = true;
  fishingMiniGame.starting = true;
  fishingMiniGame.spotId = spot.id;
  fishingMiniGame.cursor = 0.32;
  fishingMiniGame.zoneCenter = 0.5;
  fishingMiniGame.zoneWidth = 0.24;
  updateFishingMeterVisuals();
  if (fishingMeterPreviewNameEl) fishingMeterPreviewNameEl.textContent = 'Casting...';
  if (fishingMeterPreviewRarityEl) {
    fishingMeterPreviewRarityEl.textContent = 'Waiting for bite';
    fishingMeterPreviewRarityEl.style.color = '#93c5fd';
  }
  setFishingMeterStatus('Casting line...', '#93c5fd');
  fishingMeterEl?.classList.remove('hidden');
  setFishingFocusMode(true);
  syncLocalHeldGear(true);
  socket.emit('fish:start', { spotId: spot.id }, (resp) => {
    if (!fishingMiniGame.active || fishingMiniGame.spotId !== spot.id) {
      return;
    }
    fishingMiniGame.starting = false;
    const latestLocal = players.get(localPlayerId);
    if (!resp?.ok) {
      fishingMiniGame.active = false;
      scheduleFishingMiniGameClose(170);
      updateQuestPanel(resp?.error || 'Could not start fishing.');
      appendChatLine({ text: resp?.error || 'Could not start fishing.', isSystem: true });
      return;
    }
    const activeSpot = nearestFishingSpot(latestLocal, FISHING_SPOT_RADIUS + 0.6);
    if (!latestLocal || !activeSpot || activeSpot.id !== spot.id) {
      fishingMiniGame.active = false;
      scheduleFishingMiniGameClose(80);
      return;
    }
    const fish = fishFromServerPayload(resp.fish);
    const difficulty = resp?.difficulty || {};
    const zoneWidth = THREE.MathUtils.clamp(Number(difficulty.zoneWidth) || 0.22, 0.09, 0.42);
    const half = zoneWidth * 0.5;
    const minCenter = half;
    const maxCenter = 1 - half;
    fishingMiniGame.active = true;
    fishingMiniGame.spotId = spot.id;
    fishingMiniGame.challengeId = typeof resp.challengeId === 'string' ? resp.challengeId : null;
    fishingMiniGame.targetFish = fish;
    fishingMiniGame.cursor = 0.32;
    fishingMiniGame.isHolding = false;
    fishingMiniGame.zonePointer = Math.random();
    fishingMiniGame.zoneDirection = Math.random() < 0.5 ? -1 : 1;
    fishingMiniGame.zoneWidth = zoneWidth;
    fishingMiniGame.zoneSpeed = THREE.MathUtils.clamp(Number(difficulty.zoneSpeed) || 0.5, 0.2, 1.8);
    fishingMiniGame.cursorRiseSpeed = THREE.MathUtils.clamp(Number(difficulty.cursorRiseSpeed) || 0.9, 0.35, 2.2);
    fishingMiniGame.cursorFallSpeed = THREE.MathUtils.clamp(Number(difficulty.cursorFallSpeed) || 0.8, 0.35, 2.2);
    fishingMiniGame.decaySpeed = THREE.MathUtils.clamp(Number(difficulty.decaySpeed) || 0.35, 0.05, 2.5);
    fishingMiniGame.requiredHoldMs = THREE.MathUtils.clamp(Math.floor(Number(difficulty.requiredHoldMs) || 1000), 500, 5000);
    fishingMiniGame.holdMs = 0;
    fishingMiniGame.timeoutAt = performance.now() + THREE.MathUtils.clamp(Math.floor(Number(difficulty.timeoutMs) || 9800), 1500, 30000);
    fishingMiniGame.rarity = normalizeFishRarity(fish?.rarity, 'common');
    fishingMiniGame.zoneCenter = THREE.MathUtils.clamp(minCenter + fishingMiniGame.zonePointer * Math.max(0.001, (maxCenter - minCenter)), minCenter, maxCenter);
    updateFishingMeterVisuals();

    if (fish && fishingMeterPreviewNameEl) {
      fishingMeterPreviewNameEl.textContent = fish.name;
    } else if (fishingMeterPreviewNameEl) {
      fishingMeterPreviewNameEl.textContent = 'Mystery catch';
    }
    if (fishingMeterPreviewRarityEl) {
      const rarity = normalizeFishRarity(fish?.rarity, 'common');
      fishingMeterPreviewRarityEl.textContent = `${capitalizeWord(rarity)} difficulty`;
      fishingMeterPreviewRarityEl.style.color = FISH_RARITY_COLORS[rarity] || '#93c5fd';
    }
    applyFishIcon(fishingMeterPreviewIconEl, fish || FISH_CATALOG[0], { locked: false });
    setFishingMeterStatus('Hold click/touch/E/Space to move right. Release to drift left.', '#fef3c7');
    updateQuestPanel('Keep the white box inside the moving green zone to catch the fish.');
  });
  return true;
}

function setFishingHoldState(holding) {
  if (!fishingMiniGame.active || fishingMiniGame.starting) return;
  fishingMiniGame.isHolding = Boolean(holding);
}

function tryFishingSpotInteract(local) {
  if (!local || inMine || inLighthouseInterior || inHouseRoom || inHouseHall || local.onBoat) return false;
  const spot = nearestFishingSpot(local);
  if (!spot) return false;
  if (!questState.hasFishingRod) {
    appendChatLine({ text: 'You need a fishing rod first.', isSystem: true });
    updateQuestPanel('Buy a fishing rod at the Fishing island vendor.');
    return true;
  }
  if (fishingMiniGame.active) {
    return true;
  }
  if (fishingMiniGame.starting) {
    return true;
  }
  return startFishingMinigame(spot);
}

function updateFishingMinigame(local, nowMs, delta) {
  for (const spot of fishingSpots) {
    if (!spot.marker) continue;
    const pulse = 0.9 + Math.sin(nowMs * 0.004 + spot.x * 0.03) * 0.1;
    spot.marker.scale.setScalar(pulse);
  }
  if (!fishingMiniGame.active) return;
  if (
    !local
    || !questState.hasFishingRod
    || inMine
    || inLighthouseInterior
    || inHouseRoom
    || inHouseHall
    || local.onBoat
    || menuOpen
    || mineWarningOpen
    || npcDialogueOpen
    || isAnyGameplayOverlayOpen()
    || !customizeModalEl.classList.contains('hidden')
  ) {
    resetFishingMiniGame();
    return;
  }
  const spot = activeFishingSpot(local);
  if (!spot) {
    fishingMiniGame.active = false;
    setFishingMeterStatus('Fishing canceled. Move back to the fishing spot.', '#fecaca');
    scheduleFishingMiniGameClose(170);
    updateQuestPanel('Fishing canceled. Move back to a fishing spot.');
    return;
  }
  if (fishingMiniGame.starting) {
    setFishingMeterStatus('Casting line...', '#93c5fd');
    return;
  }
  if (nowMs > fishingMiniGame.timeoutAt) {
    fishingMiniGame.active = false;
    setFishingMeterStatus('Too slow. Fish got away.', '#fecaca');
    scheduleFishingMiniGameClose(170);
    updateQuestPanel('Fish got away. Cast again.');
    return;
  }

  const half = fishingMiniGame.zoneWidth * 0.5;
  const minCenter = half;
  const maxCenter = 1 - half;
  let zoneCenter = fishingMiniGame.zoneCenter + delta * fishingMiniGame.zoneSpeed * fishingMiniGame.zoneDirection;
  if (zoneCenter > maxCenter) {
    zoneCenter = maxCenter - (zoneCenter - maxCenter);
    fishingMiniGame.zoneDirection = -1;
  } else if (zoneCenter < minCenter) {
    zoneCenter = minCenter + (minCenter - zoneCenter);
    fishingMiniGame.zoneDirection = 1;
  }
  fishingMiniGame.zoneCenter = THREE.MathUtils.clamp(zoneCenter, minCenter, maxCenter);

  const cursorVelocity = fishingMiniGame.isHolding
    ? fishingMiniGame.cursorRiseSpeed
    : -fishingMiniGame.cursorFallSpeed;
  fishingMiniGame.cursor = THREE.MathUtils.clamp(fishingMiniGame.cursor + cursorVelocity * delta, 0, 1);
  updateFishingMeterVisuals();

  const zoneMin = fishingMiniGame.zoneCenter - half;
  const zoneMax = fishingMiniGame.zoneCenter + half;
  const inside = fishingMiniGame.cursor >= zoneMin && fishingMiniGame.cursor <= zoneMax;
  const holdDelta = delta * 1000;
  if (inside) {
    fishingMiniGame.holdMs = Math.min(fishingMiniGame.requiredHoldMs, fishingMiniGame.holdMs + holdDelta);
  } else {
    fishingMiniGame.holdMs = Math.max(0, fishingMiniGame.holdMs - holdDelta * fishingMiniGame.decaySpeed);
  }
  const progressPct = Math.round((fishingMiniGame.holdMs / Math.max(1, fishingMiniGame.requiredHoldMs)) * 100);
  const statusColor = inside ? '#86efac' : '#fef3c7';
  setFishingMeterStatus(`Reel control: ${progressPct}% (${Math.max(0, Math.ceil((fishingMiniGame.timeoutAt - nowMs) / 1000))}s left)`, statusColor);
  if (fishingMiniGame.holdMs >= fishingMiniGame.requiredHoldMs) {
    completeFishingMinigame(local);
  }
}

function homeWorkshopInteract(local) {
  if (!isNearHouseWorkshop(local)) return false;
  setHomeModalOpen(true);
  if (!homeStatusEl?.textContent?.trim()) {
    setHomeStatus('Place owned furniture here and repaint your room.', '#cbd5e1');
  }
  return true;
}

function claimHouseRoom(roomId, onSuccess) {
  socket.emit('home:claimRoom', { roomId }, (resp) => {
    if (!resp?.ok) {
      openNpcDialogue({
        name: 'Room Door',
        text: resp?.error || 'Could not claim this room.',
        primaryLabel: 'Okay',
        secondaryLabel: 'Close'
      });
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    if (typeof onSuccess === 'function') {
      onSuccess();
    }
  });
}

function houseHallDoorInteract(local) {
  if (!inHouseHall) return false;
  const door = getNearbyHouseHallDoor(local);
  if (!door) return false;
  const roomState = normalizeHomeRoomState(questState.homeRoom);
  if (roomState.roomId === door.id) {
    enterHouseRoom(local, door.id);
    return true;
  }
  if (roomState.roomId) {
    openNpcDialogue({
      name: 'Room Door',
      text: 'You already claimed a room. This one is locked.',
      primaryLabel: 'Okay',
      secondaryLabel: 'Close'
    });
    return true;
  }
  const roomNumber = door.id.split('-')[1] || door.id;
  openNpcDialogue({
    name: 'Room Door',
    text: `Claim Room ${roomNumber}? You can customize it after claiming.`,
    primaryLabel: 'Claim Room',
    secondaryLabel: 'Cancel',
    onPrimary: () => {
      claimHouseRoom(door.id, () => {
        enterHouseRoom(local, door.id);
      });
    }
  });
  return true;
}

function fishingVendorInteract(local) {
   if (!isNearFishingVendor(local)) return false;
   if (inFishingShop) {
     setRodShopModalOpen(true);
     loadRodShopModal();
     return true;
   }
   enterFishingShop(local);
   return true;
}

function fishMarketInteract(local) {
   if (!isNearFishMarket(local)) return false;
   if (inMarketShop) {
     setMarketModalOpen(true);
     renderMarketModal();
     setMarketStatus('Sell fish, or manage your fishing quest.', '#cbd5e1');
     return true;
   }
   enterMarketShop(local);
   return true;
}

function furnitureTraderInteract(local) {
   if (!isNearFurnitureVendor(local)) return false;
   if (inFurnitureShop) {
     setFurnitureTraderModalOpen(true);
     loadFurnitureTraderModal();
     return true;
   }
   enterFurnitureShop(local);
   return true;
}

function shopExitInteract(local) {
  if (isNearFishingShopExit(local)) {
    exitFishingShopToMain(local);
    return true;
  }
  if (isNearMarketShopExit(local)) {
    exitMarketShopToMain(local);
    return true;
  }
  if (isNearFurnitureShopExit(local)) {
    exitFurnitureShopToMain(local);
    return true;
  }
  return false;
}

function oreTraderInteract(local) {
  if (!local || !inMine) return false;
  if (distance2D(local, MINE_ORE_TRADER_POS) > 3.2) return false;
  setOreModalOpen(true);
  renderOreModal();
  setOreStatus('Sell mined ores for coins.', '#cbd5e1');
  return true;
}

function questInteract(local) {
  if (!local) return false;
  if (distance2D(local, QUEST_NPC_POS) > 3.2) return false;
  const quest = questState.quest;
  if (!quest) {
    openNpcDialogue({
      name: 'Quest Giver',
      text: 'Hold on... your quest book is still loading.',
      primaryLabel: 'Okay',
      secondaryLabel: 'Close'
    });
    return true;
  }
  if (quest.status === 'ready') {
    const rewardXp = Math.max(0, Math.floor(Number(quest.rewardXp) || 0));
    openNpcDialogue({
      name: 'Quest Giver',
      text: `Great work. Reward: ${rewardXp} XP${quest.rewardDiamonds ? ` + ${quest.rewardDiamonds} diamonds` : ''}.`,
      primaryLabel: 'Claim Reward',
      secondaryLabel: 'Later',
      onPrimary: () => {
        socket.emit('quest:claim', {}, (resp) => {
          if (!resp?.ok) {
            updateQuestPanel(resp?.error || 'Could not claim quest.');
            return;
          }
          closeNpcDialogue();
          const gainedXp = Math.max(0, Math.floor(Number(resp.rewardXp) || rewardXp));
          updateQuestPanel(`Quest reward claimed: +${gainedXp} XP.`);
        });
      },
      onSecondary: closeNpcDialogue
    });
    return true;
  }
  if (quest.status === 'available' || quest.status === 'new') {
    openNpcDialogue({
      name: 'Quest Giver',
      text: `${quest.description} Return here when you are done.`,
      primaryLabel: 'Accept Quest',
      secondaryLabel: 'Not Now',
      onPrimary: () => {
        socket.emit('quest:accept', {}, (resp) => {
          if (!resp?.ok) {
            updateQuestPanel(resp?.error || 'Could not accept quest.');
            return;
          }
          if (resp.quest) questState.quest = { ...resp.quest };
          closeNpcDialogue();
          updateQuestPanel('Quest accepted.');
        });
      },
      onSecondary: closeNpcDialogue
    });
    return true;
  }
  openNpcDialogue({
    name: 'Quest Giver',
    text: `Current task: ${quest.title}. Progress ${quest.progress || 0}/${quest.targetCount || 0}.`,
    primaryLabel: 'Okay',
    secondaryLabel: 'Close'
  });
  return true;
}

function mineShopInteract(local) {
  if (!local || !inMine) return false;
  if (distance2D(local, MINE_SHOP_NPC_POS) > 3.2) return false;
  const nextTier = nextPickaxeTier();
  if (!nextTier) {
    openNpcDialogue({
      name: 'Mine Merchant',
      text: 'You already own the best pickaxe I sell.',
      primaryLabel: 'Okay',
      secondaryLabel: 'Close'
    });
    return true;
  }
  const price = questState.shop.price[nextTier] || 0;
  const requiredLevel = Math.max(1, Math.floor(Number(questState.shop?.levelReq?.[nextTier]) || 1));
  const levelMet = questState.level >= requiredLevel;
  if (!levelMet) {
    openNpcDialogue({
      name: 'Mine Merchant',
      text: `The ${capitalizeWord(nextTier)} pickaxe unlocks at level ${requiredLevel}. You are level ${questState.level}.`,
      primaryLabel: 'Okay',
      secondaryLabel: 'Close'
    });
    return true;
  }
  openNpcDialogue({
    name: 'Mine Merchant',
    text: `I can sell you a ${capitalizeWord(nextTier)} pickaxe for ${price} coins. Requirement: level ${requiredLevel}. You are level ${questState.level} with ${questState.coins} coins.`,
    primaryLabel: `Buy ${capitalizeWord(nextTier)} Pickaxe`,
    secondaryLabel: 'Cancel',
    onPrimary: () => {
      socket.emit('shop:buyPickaxe', { tier: nextTier }, (resp) => {
        if (!resp?.ok) {
          updateQuestPanel(resp?.error || 'Could not buy pickaxe.');
          return;
        }
        closeNpcDialogue();
        updateQuestPanel(`Bought ${capitalizeWord(resp.tier)} pickaxe.`);
      });
    },
    onSecondary: closeNpcDialogue
  });
  return true;
}

function getNearbyOreNode(local) {
  let best = null;
  for (const node of oreNodes) {
    if (!node.mesh.visible || node.breaking) continue;
    node.mesh.getWorldPosition(_mineNodeWorldPos);
    const dist = Math.hypot(local.x - _mineNodeWorldPos.x, local.z - _mineNodeWorldPos.z);
    if (dist <= 3.2 && (!best || dist < best.dist)) {
      best = { node, dist };
    }
  }
  return best?.node || null;
}

function canMineResource(resource) {
  if (resource === 'diamond') return questState.pickaxe === 'iron' || questState.pickaxe === 'diamond';
  if (resource === 'gold') return questState.pickaxe !== 'wood';
  return true;
}

function mineAmountForPickaxe(resource) {
  const power = getPickaxePower();
  if (resource === 'diamond') return power >= 4 ? 3 : 2;
  if (resource === 'gold') return Math.max(2, power);
  return power + 1;
}

function isNearMineCrystal(local) {
  if (!local || !inMine || !mineCentralCrystalMesh) return false;
  mineCentralCrystalMesh.getWorldPosition(_mineCrystalWorldPos);
  return Math.hypot(local.x - _mineCrystalWorldPos.x, local.z - _mineCrystalWorldPos.z) <= MINE_CRYSTAL_INTERACT_RADIUS;
}

function exitMineToEntrance(local) {
  inMine = false;
  resetMiningAccuracyGame();
  const outDX = Math.sin(MINE_ENTRY_YAW) * 11.5;
  const outDZ = Math.cos(MINE_ENTRY_YAW) * 11.5;
  teleportLocal(
    local,
    { x: MINE_ENTRY_POS.x + outDX, y: GROUND_Y, z: MINE_ENTRY_POS.z + outDZ },
    MINE_ENTRY_YAW + Math.PI
  );
}

function exitHouseToMain(local) {
  inHouseRoom = false;
  inHouseHall = false;
  if (houseRoomGroup) houseRoomGroup.visible = false;
  if (houseHallGroup) houseHallGroup.visible = false;
  setHomeModalOpen(false);
  const outX = HOUSE_DOOR_POS.x;
  const outZ = HOUSE_DOOR_POS.z + 2.45;
  teleportLocal(local, { x: outX, y: GROUND_Y, z: outZ }, Math.PI);
  localRoomTransitioning = true;
  socket.emit('home:leaveRoom');
  const localPlayer = players.get(localPlayerId);
  if (localPlayer) localPlayer.currentRoomId = null;
  players.forEach((p) => updatePlayerVisibility(p));
}

function exitHouseRoomToHall(local) {
  inHouseRoom = false;
  inHouseHall = true;
  if (houseRoomGroup) houseRoomGroup.visible = false;
  if (houseHallGroup) houseHallGroup.visible = true;
  setHomeModalOpen(false);
  teleportLocal(local, { x: HOUSE_HALL_ENTRY_POS.x, y: GROUND_Y, z: HOUSE_HALL_ENTRY_POS.z }, Math.PI);
  localRoomTransitioning = true;
  socket.emit('home:leaveRoom');
  const localPlayer = players.get(localPlayerId);
  if (localPlayer) localPlayer.currentRoomId = null;
  players.forEach((p) => updatePlayerVisibility(p));
}

function enterHouseRoom(local, roomId) {
   inHouseHall = false;
   inHouseRoom = true;
   if (houseHallGroup) houseHallGroup.visible = false;
   if (houseRoomGroup) houseRoomGroup.visible = true;
   teleportLocal(local, { x: HOUSE_ROOM_ENTRY_POS.x, y: GROUND_Y, z: HOUSE_ROOM_ENTRY_POS.z }, Math.PI);
   if (roomId) {
     localRoomTransitioning = true;
     socket.emit('home:enterRoom', { roomId });
     const localPlayer = players.get(localPlayerId);
     if (localPlayer) localPlayer.currentRoomId = roomId;
   }
   players.forEach((p) => updatePlayerVisibility(p));
}

function exitHouseRoomToMain(local) {
   inHouseRoom = false;
   inHouseHall = false;
   if (houseRoomGroup) houseRoomGroup.visible = false;
   if (houseHallGroup) houseHallGroup.visible = false;
   setHomeModalOpen(false);
   const outX = HOUSE_DOOR_POS.x;
   const outZ = HOUSE_DOOR_POS.z + 2.45;
   teleportLocal(local, { x: outX, y: GROUND_Y, z: outZ }, Math.PI);
   localRoomTransitioning = true;
   socket.emit('home:leaveRoom');
   const localPlayer = players.get(localPlayerId);
   if (localPlayer) localPlayer.currentRoomId = null;
   players.forEach((p) => updatePlayerVisibility(p));
}

function enterFishingShop(local) {
   inFishingShop = true;
   if (fishingShopGroup) fishingShopGroup.visible = true;
   setRodShopModalOpen(false);
   teleportLocal(local, { x: FISHING_SHOP_BASE.x, y: GROUND_Y, z: FISHING_SHOP_BASE.z }, 0);
}

function exitFishingShopToMain(local) {
   inFishingShop = false;
   if (fishingShopGroup) fishingShopGroup.visible = false;
   teleportLocal(local, { x: FISHING_VENDOR_POS.x, y: GROUND_Y, z: FISHING_VENDOR_POS.z }, Math.PI);
}

function enterMarketShop(local) {
   inMarketShop = true;
   if (marketShopGroup) marketShopGroup.visible = true;
   setMarketModalOpen(false);
   teleportLocal(local, { x: MARKET_SHOP_BASE.x, y: GROUND_Y, z: MARKET_SHOP_BASE.z }, 0);
}

function exitMarketShopToMain(local) {
   inMarketShop = false;
   if (marketShopGroup) marketShopGroup.visible = false;
   teleportLocal(local, { x: MARKET_VENDOR_POS.x, y: GROUND_Y, z: MARKET_VENDOR_POS.z }, Math.PI);
}

function enterFurnitureShop(local) {
   inFurnitureShop = true;
   if (furnitureShopGroup) furnitureShopGroup.visible = true;
   setFurnitureTraderModalOpen(false);
   teleportLocal(local, { x: FURNITURE_SHOP_BASE.x, y: GROUND_Y, z: FURNITURE_SHOP_BASE.z }, 0);
}

function exitFurnitureShopToMain(local) {
   inFurnitureShop = false;
   if (furnitureShopGroup) furnitureShopGroup.visible = false;
   teleportLocal(local, { x: FURNITURE_VENDOR_POS.x, y: GROUND_Y, z: FURNITURE_VENDOR_POS.z }, Math.PI);
}

function startMineSwing(id, nowMs = Date.now()) {
  const player = players.get(id);
  if (!player) return;
  player.mineSwingStartedAt = nowMs;
  player.mineSwingUntil = Math.max(Number(player.mineSwingUntil) || 0, nowMs + MINE_SWING_MS);
}

function tryMineNode(local) {
  if (!local || !inMine) {
    if (miningAccuracyGame.active) resetMiningAccuracyGame();
    return false;
  }
  const now = performance.now();
  if (now < mineRetryBlockedUntil) {
    if (now - lastMineRetryNoticeAt > 140) {
      const waitSeconds = ((mineRetryBlockedUntil - now) / 1000).toFixed(1);
      updateQuestPanel(`Miss cooldown: ${waitSeconds}s before mining again.`);
      lastMineRetryNoticeAt = now;
    }
    return true;
  }
  if (mineRetryBlockedUntil > 0) {
    mineRetryBlockedUntil = 0;
  }
  const node = getNearbyOreNode(local);
  if (!node) {
    if (miningAccuracyGame.active) resetMiningAccuracyGame();
    return false;
  }
  if (miningAccuracyGame.active) {
    if (miningAccuracyGame.node?.id === node.id) {
      return attemptMiningAccuracyHit(local);
    }
    resetMiningAccuracyGame();
  }
  if (!canMineResource(node.resource)) {
    updateQuestPanel(`Need a better pickaxe for ${node.resource}.`);
    return true;
  }
  if (startMiningAccuracyGame(node)) {
    const requiredHits = mineRequiredHits(node.resource);
    updateQuestPanel(`Mine ${node.resource}: hit the green zone ${requiredHits}x with your pickaxe slider.`);
  }
  return true;
}

function tryAutoTeleport(local, now = performance.now()) {
  if (!local || isTeleporting || mineWarningOpen || now < teleportTriggerLockUntil) return false;

  const nearMineEntrance = !inMine && !inLighthouseInterior && !inHouseRoom && !inHouseHall && !local.onBoat && distance2D(local, MINE_ENTRY_POS) < 2.2;
  const nearLighthouseEntry = !inMine && !inLighthouseInterior && !inHouseRoom && !inHouseHall && !local.onBoat && (
    distance2D(local, LIGHTHOUSE_DOOR_POS) < 2.35
  );
  const nearHouseEntry = !inMine && !inLighthouseInterior && !inHouseRoom && !inHouseHall && !local.onBoat
    && distance2D(local, HOUSE_DOOR_POS) < HOUSE_DOOR_INTERACT_RADIUS;

  if (nearMineEntrance) {
    const enterMine = () => {
      runTeleportTransition('enter-mine', () => {
        inMine = true;
        inHouseRoom = false;
        if (houseRoomGroup) houseRoomGroup.visible = false;
        teleportLocal(local, { x: MINE_POS.x + 0.8, y: GROUND_Y, z: MINE_POS.z + 11.2 }, Math.PI);
      });
    };
    if (skipMineEntryWarning) {
      enterMine();
    } else {
      openMineWarningDialog((dontAskAgain) => {
        if (dontAskAgain) {
          skipMineEntryWarning = true;
          localStorage.setItem(MINE_ENTRY_WARNING_PREF_KEY, '1');
        } else {
          skipMineEntryWarning = false;
          localStorage.removeItem(MINE_ENTRY_WARNING_PREF_KEY);
        }
        enterMine();
      });
    }
    lastInteractAt = now;
    return true;
  }

  if (nearLighthouseEntry) {
    runTeleportTransition('enter-lighthouse', () => {
      inHouseRoom = false;
      if (houseRoomGroup) houseRoomGroup.visible = false;
      inLighthouseInterior = true;
      if (lighthouseInteriorGroup) lighthouseInteriorGroup.visible = true;
      teleportLocal(local, { x: INTERIOR_ENTRY_POS.x, y: GROUND_Y, z: INTERIOR_ENTRY_POS.z }, Math.PI);
    });
    lastInteractAt = now;
    return true;
  }

  if (nearHouseEntry) {
    runTeleportTransition('enter-home', () => {
      inMine = false;
      inLighthouseInterior = false;
      if (lighthouseInteriorGroup) lighthouseInteriorGroup.visible = false;
      inHouseHall = true;
      inHouseRoom = false;
      if (houseHallGroup) houseHallGroup.visible = true;
      if (houseRoomGroup) houseRoomGroup.visible = false;
      teleportLocal(local, { x: HOUSE_HALL_ENTRY_POS.x, y: GROUND_Y, z: HOUSE_HALL_ENTRY_POS.z }, Math.PI);
    });
    lastInteractAt = now;
    return true;
  }

  return false;
}

function hasManualInteractTarget(local) {
  return Boolean(getManualInteractTarget(local));
}

function getManualInteractTarget(local) {
  if (!local || isTeleporting) return null;
  if (fishingMiniGame.active || fishingMiniGame.starting) {
    return { mode: 'docked', label: 'Reel', caption: 'Hold' };
  }
  if (npcDialogueOpen) {
    return { mode: 'docked', label: 'Next', caption: 'Tap' };
  }
  if (isNearHouseRoomExit(local)) {
    return { mode: 'world', label: 'Hall', caption: 'Tap', worldPos: HOUSE_ROOM_EXIT_POS, offsetY: 0.95 };
  }
  if (isNearHouseHallExit(local)) {
    return { mode: 'world', label: 'Exit', caption: 'Tap', worldPos: HOUSE_HALL_EXIT_POS, offsetY: 0.95 };
  }
  const hallDoor = getNearbyHouseHallDoor(local);
  if (hallDoor) {
    const claimedId = normalizeHomeRoomState(questState.homeRoom).roomId;
    const label = claimedId === hallDoor.id ? 'Enter' : (claimedId ? 'Locked' : 'Claim');
    return { mode: 'world', label, caption: 'Tap', worldPos: hallDoor.position, offsetY: 0.95 };
  }
  if (isNearHouseWorkshop(local)) {
    return { mode: 'world', label: 'Build', caption: 'Tap', worldPos: HOUSE_ROOM_WORKSHOP_POS, offsetY: 1.0 };
  }
  if (inHouseRoom) return null;
  if (inMine && distance2D(local, MINE_EXIT_POS) < 3.1) {
    return { mode: 'world', label: 'Exit', caption: 'Tap', worldPos: MINE_EXIT_POS, offsetY: 1.05 };
  }
  if (inMine && isNearMineCrystal(local)) {
    mineCentralCrystalMesh?.getWorldPosition(_mobileUseWorldPos);
    return { mode: 'world', label: 'Leave', caption: 'Tap', worldPos: _mobileUseWorldPos, offsetY: 0.55 };
  }
  if (inMine) {
    const oreNode = getNearbyOreNode(local);
    if (oreNode) {
      oreNode.mesh.getWorldPosition(_mobileUseWorldPos);
      return { mode: 'world', label: 'Mine', caption: 'Tap', worldPos: _mobileUseWorldPos, offsetY: 0.85 };
    }
    if (distance2D(local, MINE_SHOP_NPC_POS) <= 3.2) {
      return { mode: 'world', label: 'Shop', caption: 'Tap', worldPos: MINE_SHOP_NPC_POS, offsetY: 1.45 };
    }
    if (distance2D(local, MINE_ORE_TRADER_POS) <= 3.2) {
      return { mode: 'world', label: 'Sell', caption: 'Tap', worldPos: MINE_ORE_TRADER_POS, offsetY: 1.45 };
    }
  }
  if (distance2D(local, QUEST_NPC_POS) <= 3.2) {
    return { mode: 'world', label: 'Talk', caption: 'Tap', worldPos: QUEST_NPC_POS, offsetY: 1.45 };
  }
  if (isNearFishingVendor(local)) {
    return { mode: 'world', label: 'Shop', caption: 'Tap', worldPos: FISHING_VENDOR_POS, offsetY: 1.45 };
  }
  if (isNearFishMarket(local)) {
    return { mode: 'world', label: 'Sell', caption: 'Tap', worldPos: MARKET_VENDOR_POS, offsetY: 1.45 };
  }
  if (isNearFurnitureVendor(local)) {
    return { mode: 'world', label: 'Shop', caption: 'Tap', worldPos: FURNITURE_VENDOR_POS, offsetY: 1.45 };
  }
  if (!inMine) {
    const fishingSpot = nearestFishingSpot(local);
    if (fishingSpot) {
      return {
        mode: 'world',
        label: questState.hasFishingRod ? 'Fish' : 'Rod',
        caption: 'Tap',
        worldPos: fishingSpot,
        offsetY: 0.75
      };
    }
  }

  if (inLighthouseInterior && distance2D(local, INTERIOR_EXIT_PORTAL_POS) < 3.1) {
    return { mode: 'world', label: 'Climb', caption: 'Tap', worldPos: INTERIOR_EXIT_PORTAL_POS, offsetY: 1.0 };
  }
  if (!inLighthouseInterior && !local.onBoat && distance2D(local, LIGHTHOUSE_TOP_POS) < 1.25 && local.y > 11.6) {
    return { mode: 'world', label: 'Enter', caption: 'Tap', worldPos: LIGHTHOUSE_TOP_POS, offsetY: 0.8 };
  }

  if (boatState.onboard) {
    return { mode: 'docked', label: 'Leave', caption: 'Tap' };
  }
  if (allowBoatBoard(local)) {
    if (boatState.mesh && distance2D(local, boatState) < 5.2) {
      boatState.mesh.getWorldPosition(_mobileUseWorldPos);
      return { mode: 'world', label: 'Boat', caption: 'Tap', worldPos: _mobileUseWorldPos, offsetY: 1.0 };
    }
    const dockSlot = nearestDockSlot(local, 6);
    if (dockSlot) {
      return { mode: 'world', label: 'Boat', caption: 'Tap', worldPos: dockSlot.dock, offsetY: 1.15 };
    }
    return { mode: 'docked', label: 'Boat', caption: 'Tap' };
  }

  const beacon = interactables.get('beacon');
  if (!beacon || Math.hypot(local.x - beacon.x, local.z - beacon.z) > 4.2) {
    return null;
  }
  beaconCore.getWorldPosition(_mobileUseWorldPos);
  return { mode: 'world', label: 'Toggle', caption: 'Tap', worldPos: _mobileUseWorldPos, offsetY: 0.4 };
}

function updateMobileUseButtonPlacement(target) {
  if (!mobileUseEl) return false;
  if (!target || target.mode !== 'world' || !target.worldPos) return false;

  const viewportX = window.innerWidth * 0.5;
  const viewportY = window.innerHeight * 0.5;
  const projected = _mobileUseScreenPos.copy(target.worldPos);
  projected.y += target.offsetY ?? 1.0;
  projected.project(camera);

  const isVisible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.16 && Math.abs(projected.y) < 1.16;
  if (!isVisible) return false;

  const x = THREE.MathUtils.clamp(projected.x * viewportX + viewportX, 58, window.innerWidth - 58);
  const y = THREE.MathUtils.clamp(-projected.y * viewportY + viewportY, 96, window.innerHeight - 164);
  mobileUseEl.style.left = `${x}px`;
  mobileUseEl.style.top = `${y}px`;
  mobileUseEl.style.right = '';
  mobileUseEl.style.bottom = '';
  return true;
}

function updateMobileUseButtonVisibility(local) {
  if (!mobileUseEl) {
    refreshConsumeActionVisibility(local);
    return;
  }
  const target = Boolean(local)
    && isAuthenticated
    && !mineWarningOpen
    && !menuOpen
    && !isAnyGameplayOverlayOpen()
    && authModalEl.classList.contains('hidden')
    && customizeModalEl.classList.contains('hidden')
    ? getManualInteractTarget(local)
    : null;

  if (!target) {
    mobileUseEl.classList.add('hidden');
    mobileUseEl.classList.remove('is-contextual', 'is-docked');
    mobileUseEl.style.left = '';
    mobileUseEl.style.top = '';
    mobileUseEl.style.right = '';
    mobileUseEl.style.bottom = '';
    refreshConsumeActionVisibility(local);
    return;
  }

  if (mobileUseCaptionEl) mobileUseCaptionEl.textContent = target.caption || 'Tap';
  if (mobileUseLabelEl) {
    mobileUseLabelEl.textContent = target.label || 'Use';
  } else {
    mobileUseEl.textContent = target.label || 'Use';
  }

  const isContextual = updateMobileUseButtonPlacement(target);
  mobileUseEl.classList.toggle('is-contextual', isContextual);
  mobileUseEl.classList.toggle('is-docked', !isContextual);
  if (!isContextual) {
    mobileUseEl.style.left = '';
    mobileUseEl.style.top = '';
    mobileUseEl.style.right = '';
    mobileUseEl.style.bottom = '';
  }
  mobileUseEl.classList.remove('hidden');
  refreshConsumeActionVisibility(local);
}

function tryInteract() {
  if (!isAuthenticated || menuOpen || isAnyGameplayOverlayOpen() || !customizeModalEl.classList.contains('hidden')) return;
  if (mineWarningOpen) return;
  if (npcDialogueOpen) {
    if (typeof npcDialoguePrimaryAction === 'function') npcDialoguePrimaryAction();
    return;
  }
  const now = performance.now();
  if (now - lastInteractAt < 220) return;
  const local = players.get(localPlayerId);
  if (!local || isTeleporting) return;
  if (tryAutoTeleport(local, now)) return;
  const nearMineExit = inMine && distance2D(local, MINE_EXIT_POS) < 3.1;
  const nearMineCrystal = inMine && isNearMineCrystal(local);
  const nearHouseRoomExit = isNearHouseRoomExit(local);
  const nearHouseHallExit = isNearHouseHallExit(local);
  const nearHouseWorkshop = isNearHouseWorkshop(local);
  const nearInteriorPortal = inLighthouseInterior && distance2D(local, INTERIOR_EXIT_PORTAL_POS) < 3.1;
  const nearTopPortal = !inLighthouseInterior && !local.onBoat && distance2D(local, LIGHTHOUSE_TOP_POS) < 1.25 && local.y > 11.6;

  if (nearMineExit) {
    runTeleportTransition('exit-mine', () => {
      exitMineToEntrance(local);
    });
    lastInteractAt = now;
    return;
  }

  if (nearMineCrystal) {
    runTeleportTransition('exit-mine', () => {
      exitMineToEntrance(local);
    });
    lastInteractAt = now;
    return;
  }

  if (nearHouseRoomExit) {
    runTeleportTransition('exit-home', () => {
      exitHouseRoomToHall(local);
    });
    lastInteractAt = now;
    return;
  }

  if (nearHouseHallExit) {
    runTeleportTransition('exit-home', () => {
      exitHouseToMain(local);
    });
    lastInteractAt = now;
    return;
  }

  if (nearHouseWorkshop) {
    if (homeWorkshopInteract(local)) {
      lastInteractAt = now;
      return;
    }
  }

  if (inHouseHall && houseHallDoorInteract(local)) {
    lastInteractAt = now;
    return;
  }

  if (inHouseRoom) {
    return;
  }

  if (fishingMiniGame.active && tryFishingSpotInteract(local)) {
    lastInteractAt = now;
    return;
  }

  if (tryMineNode(local)) {
    lastInteractAt = now;
    return;
  }

  if (fishingVendorInteract(local)) {
    lastInteractAt = now;
    return;
  }

  if (fishMarketInteract(local)) {
    lastInteractAt = now;
    return;
  }

  if (furnitureTraderInteract(local)) {
    lastInteractAt = now;
    return;
  }

  if (shopExitInteract(local)) {
    lastInteractAt = now;
    return;
  }

  if (tryFishingSpotInteract(local)) {
    lastInteractAt = now;
    return;
  }

  if (mineShopInteract(local)) {
    lastInteractAt = now;
    return;
  }

  if (oreTraderInteract(local)) {
    lastInteractAt = now;
    return;
  }

  if (questInteract(local)) {
    lastInteractAt = now;
    return;
  }

  if (nearInteriorPortal) {
    runTeleportTransition('exit-lighthouse', () => {
      inLighthouseInterior = false;
      if (lighthouseInteriorGroup) lighthouseInteriorGroup.visible = false;
      teleportLocal(local, { x: LIGHTHOUSE_TOP_POS.x + 2.2, y: LIGHTHOUSE_TOP_POS.y, z: LIGHTHOUSE_TOP_POS.z + 0.2 }, Math.PI * 0.5);
    });
    lastInteractAt = now;
    return;
  }

  if (nearTopPortal) {
    runTeleportTransition('enter-lighthouse', () => {
      inLighthouseInterior = true;
      if (lighthouseInteriorGroup) lighthouseInteriorGroup.visible = true;
      teleportLocal(local, { x: INTERIOR_TOP_POS.x, y: INTERIOR_TOP_POS.y, z: INTERIOR_TOP_POS.z }, Math.PI);
    });
    lastInteractAt = now;
    return;
  }

  if (boatState.onboard) {
    exitBoat(local, true);
    lastInteractAt = now;
    return;
  } else {
    if (allowBoatBoard(local)) {
      boardBoat(local);
      lastInteractAt = now;
      return;
    }
  }

  const beacon = interactables.get('beacon');
  if (!beacon) return;
  const distance = Math.hypot(local.x - beacon.x, local.z - beacon.z);
  if (distance > 4.2) return;
  socket.emit('interact', { id: 'beacon' });
  lastInteractAt = now;
}

socket.on('connect', () => {
  statusEl.textContent = 'Connected';
  if (!isAuthenticated) {
    if (authStatusEl && !authStatusEl.textContent.trim()) {
      authStatusEl.textContent = 'Connected. Login to continue.';
    }
  }
});

socket.on('disconnect', () => {
  statusEl.textContent = 'Disconnected';
  [...voicePeers.keys()].forEach(removeVoicePeer);
  if (isAuthenticated) {
    setAuthModalOpen(true, 'Connection lost. Login again.');
    clearSessionWorld();
  }
});

socket.on('auth:required', () => {
  statusEl.textContent = 'Auth Required';
  clearSessionWorld();
  setAuthModalOpen(true, 'Please login or create an account.');
});

socket.on('init', (payload) => {
  isAuthenticated = true;
  setAuthModalOpen(false);
  localPlayerId = payload.id;
  worldLimit = payload.worldLimit || worldLimit;

  players.forEach((_, id) => removePlayer(id));
  payload.players.forEach(addPlayer);

  interactables.clear();
  (payload.interactables || []).forEach(updateBeaconState);

  const local = payload.players.find((player) => player.id === localPlayerId);
  if (local) {
    inMine = local.inMine === true || mineDistance(local.x, local.z) <= MINE_PLAY_RADIUS;
     inLighthouseInterior = Math.hypot(local.x - LIGHTHOUSE_INTERIOR_BASE.x, local.z - LIGHTHOUSE_INTERIOR_BASE.z) <= INTERIOR_PLAY_RADIUS;
     inHouseRoom = Math.hypot(local.x - HOUSE_ROOM_BASE.x, local.z - HOUSE_ROOM_BASE.z) <= HOUSE_ROOM_PLAY_RADIUS;
     inHouseHall = Math.hypot(local.x - HOUSE_HALL_BASE.x, local.z - HOUSE_HALL_BASE.z) <= HOUSE_HALL_PLAY_RADIUS;
     inFishingShop = Math.hypot(local.x - FISHING_SHOP_BASE.x, local.z - FISHING_SHOP_BASE.z) <= SHOP_INTERIOR_RADIUS;
     inMarketShop = Math.hypot(local.x - MARKET_SHOP_BASE.x, local.z - MARKET_SHOP_BASE.z) <= SHOP_INTERIOR_RADIUS;
     inFurnitureShop = Math.hypot(local.x - FURNITURE_SHOP_BASE.x, local.z - FURNITURE_SHOP_BASE.z) <= SHOP_INTERIOR_RADIUS;
     if (inHouseRoom || inHouseHall || inFishingShop || inMarketShop || inFurnitureShop) {
       inMine = false;
       inLighthouseInterior = false;
     }
    if (lighthouseInteriorGroup) lighthouseInteriorGroup.visible = inLighthouseInterior;
    if (houseRoomGroup) houseRoomGroup.visible = inHouseRoom;
    if (houseHallGroup) houseHallGroup.visible = inHouseHall;
    applyPlayerCustomization(local.id, local.name, local.color, local.appearance);
    customizeStatusEl.textContent = `Loaded account avatar for ${local.name || 'Player'}.`;
   } else {
     inMine = false;
     inLighthouseInterior = false;
     inHouseRoom = false;
     inHouseHall = false;
     inFishingShop = false;
     inMarketShop = false;
     inFurnitureShop = false;
     if (lighthouseInteriorGroup) lighthouseInteriorGroup.visible = false;
     if (houseRoomGroup) houseRoomGroup.visible = false;
     if (houseHallGroup) houseHallGroup.visible = false;
     if (fishingShopGroup) fishingShopGroup.visible = false;
     if (marketShopGroup) marketShopGroup.visible = false;
     if (furnitureShopGroup) furnitureShopGroup.visible = false;
   }
  applyProgressState(payload.progress || null);
  if (payload.worldState) {
    applyWorldState(payload.worldState);
  }

  statusEl.textContent = 'Connected';
  appendChatLine({
    text: 'Connected to server chat.',
    isSystem: true
  });
  if (voiceEnabled) {
    socket.emit('voice:join');
  }
});

socket.on('progress:update', (payload) => {
  applyProgressState(payload || null);
});

socket.on('world:update', (payload) => {
  applyWorldState(payload || null);
});

socket.on('debug:kicked', (payload) => {
  const reason = payload?.reason || 'You were kicked by a creator.';
  appendChatLine({ text: reason, isSystem: true });
  clearSessionWorld();
  setAuthModalOpen(true, reason);
  setTimeout(() => window.location.reload(), 800);
});

socket.on('playerJoined', (payload) => {
  if (!isAuthenticated) return;
  addPlayer(payload);
  if (localRoomTransitioning) return;
  const id = payload.id;
  const name = displayNameWithTag(payload.name || 'A player', payload?.accountTag);
  const timer = setTimeout(() => {
    pendingJoinMessages.delete(id);
    appendChatLine({
      text: `${name} joined the island.`,
      isSystem: true
    });
  }, 200);
  pendingJoinMessages.set(id, timer);
});

socket.on('playerLeft', (id) => {
  if (!isAuthenticated) return;
  const player = players.get(id);
  removePlayer(id);
  if (localRoomTransitioning) return;
  const name = displayNameWithTag(player?.name || `Player-${id.slice(0, 4)}`, player?.accountTag);
  const timer = setTimeout(() => {
    pendingLeaveMessages.delete(id);
    appendChatLine({ text: `${name} left the island.`, isSystem: true });
  }, 200);
  pendingLeaveMessages.set(id, timer);
});

socket.on('playerMoved', ({
  id,
  x,
  y,
  z,
  accountTag,
  name,
  color,
  appearance,
  pickaxe,
  torchEquipped: movedTorchEquipped,
  hasFishingRod,
  fishingRodTier,
  isFishing,
  currentRoomId: movedRoomId
}) => {
  const player = players.get(id);
  if (!player) return;
  player.x = x;
  player.y = Number.isFinite(y) ? y : player.y;
  player.z = z;
  if (movedRoomId !== undefined) {
    player.currentRoomId = movedRoomId || null;
    updatePlayerVisibility(player);
  }
  if (typeof pickaxe === 'string') {
    player.heldPickaxe = normalizePickaxeTier(pickaxe, player.heldPickaxe || 'wood');
  }
  if (typeof movedTorchEquipped === 'boolean') {
    player.torchEquipped = movedTorchEquipped;
  }
  if (typeof hasFishingRod === 'boolean') {
    player.hasFishingRod = hasFishingRod;
  }
  if (typeof fishingRodTier === 'string') {
    player.heldFishingRodTier = normalizeRodTier(fishingRodTier, player.heldFishingRodTier || 'basic');
  }
  if (typeof isFishing === 'boolean') {
    player.isFishing = isFishing;
  }
  if (typeof accountTag === 'string' || accountTag == null) {
    player.accountTag = normalizeAccountTag(accountTag);
    if (player.label) {
      applyTaggedNameToElement(player.label, player.name, player.accountTag);
    }
  }
  applyHeldGearVisual(player);
  if (typeof name === 'string' || typeof color === 'string' || appearance) {
    applyPlayerCustomization(id, name, color, appearance);
  }
});

socket.on('playerRoom', ({ id, roomId }) => {
  const player = players.get(id);
  if (!player) return;
  const wasInRoom = player.currentRoomId || null;
  const nowInRoom = roomId || null;
  player.currentRoomId = nowInRoom;
  updatePlayerVisibility(player);
  if (id === localPlayerId) {
    localRoomTransitioning = false;
    return;
  }
  // Cancel any pending join/leave messages for room transitions
  const pendingJoin = pendingJoinMessages.get(id);
  if (pendingJoin) {
    clearTimeout(pendingJoin);
    pendingJoinMessages.delete(id);
  }
  const pendingLeave = pendingLeaveMessages.get(id);
  if (pendingLeave) {
    clearTimeout(pendingLeave);
    pendingLeaveMessages.delete(id);
  }
  const localRoom = localEffectiveRoomId();
  const name = displayNameWithTag(player.name || 'A player', player.accountTag);
  if (!wasInRoom && nowInRoom) {
    if (localRoom) {
      appendChatLine({ text: `${name} entered the room.`, isSystem: true });
    } else {
      appendChatLine({ text: `${name} entered a room.`, isSystem: true });
    }
  } else if (wasInRoom && !nowInRoom) {
    if (localRoom) {
      appendChatLine({ text: `${name} left the room.`, isSystem: true });
    } else {
      appendChatLine({ text: `${name} returned to the island.`, isSystem: true });
    }
  }
});

socket.on('playerGear', ({ id, pickaxe, torchEquipped: nextTorchEquipped, hasFishingRod, fishingRodTier, isFishing }) => {
  const player = players.get(id);
  if (!player) return;
  if (typeof pickaxe === 'string') {
    player.heldPickaxe = normalizePickaxeTier(pickaxe, player.heldPickaxe || 'wood');
  }
  if (typeof nextTorchEquipped === 'boolean') {
    player.torchEquipped = nextTorchEquipped;
    if (id === localPlayerId) {
      torchEquipped = nextTorchEquipped;
      renderInventoryBar();
    }
  }
  if (typeof hasFishingRod === 'boolean') {
    player.hasFishingRod = hasFishingRod;
  }
  if (typeof fishingRodTier === 'string') {
    player.heldFishingRodTier = normalizeRodTier(fishingRodTier, player.heldFishingRodTier || 'basic');
  }
  if (typeof isFishing === 'boolean') {
    player.isFishing = isFishing;
  }
  applyHeldGearVisual(player);
});

socket.on('player:mined', ({ id, sentAt } = {}) => {
  if (typeof id !== 'string') return;
  startMineSwing(id, Number.isFinite(sentAt) ? sentAt : Date.now());
});

socket.on('playerCustomized', ({ id, name, color, appearance }) => {
  applyPlayerCustomization(id, name, color, appearance);
  if (id === localPlayerId) {
    if (customizeTimer) {
      clearTimeout(customizeTimer);
      customizeTimer = null;
    }
    customizeStatusEl.textContent = `Saved as ${name}`;
  }
});

socket.on('playerEmote', ({ id, type, sentAt }) => {
  applyEmote(id, type, sentAt);
});

socket.on('voice:participants', (ids) => {
  if (!voiceEnabled || !Array.isArray(ids)) return;
  ids.forEach((id) => {
    if (id !== localPlayerId) ensureVoicePeer(id, String(localPlayerId || '') < String(id));
  });
});

socket.on('voice:user-joined', (id) => {
  if (!voiceEnabled || !id || id === localPlayerId) return;
  ensureVoicePeer(id, String(localPlayerId || '') < String(id));
});

socket.on('voice:user-left', (id) => {
  removeVoicePeer(id);
});

socket.on('voice:offer', async ({ from, offer }) => {
  if (!voiceEnabled || !from || !offer) return;
  const pc = ensureVoicePeer(from, false);
  if (!pc) return;
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await flushQueuedIce(from, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('voice:answer', { to: from, answer: pc.localDescription });
  } catch {}
});

socket.on('voice:answer', async ({ from, answer }) => {
  const pc = voicePeers.get(from);
  if (!pc || !answer) return;
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    await flushQueuedIce(from, pc);
  } catch {}
});

socket.on('voice:ice', async ({ from, candidate }) => {
  if (!from || !candidate || !voiceEnabled) return;
  const pc = voicePeers.get(from) || ensureVoicePeer(from, false);
  if (!pc) return;
  if (!hasRemoteDescription(pc)) {
    queueVoiceIce(from, candidate);
    return;
  }
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch {}
});

socket.on('interactableUpdated', (payload) => {
  updateBeaconState(payload);
});

socket.on('chat', ({ fromId, fromTag, fromName, text, sentAt }) => {
  const knownPlayer = fromId ? players.get(fromId) : null;
  const resolvedName = knownPlayer?.name || fromName;
  const resolvedTag = knownPlayer?.accountTag ?? normalizeAccountTag(fromTag);
  appendChatLine({
    fromName: resolvedName,
    fromTag: resolvedTag,
    text,
    sentAt,
    isSystem: fromName === 'System'
  });
  if (fromId) {
    showChatBubble(fromId, text);
  }
});

socket.on('private:message', ({ fromId, fromTag, fromName, text, sentAt }) => {
  const knownPlayer = fromId ? players.get(fromId) : null;
  const resolvedName = knownPlayer?.name || fromName;
  const resolvedTag = knownPlayer?.accountTag ?? normalizeAccountTag(fromTag);
  appendChatLine({ fromName: resolvedName, fromTag: resolvedTag, text, sentAt, isPrivate: true });
  if (fromId) {
    showChatBubble(fromId, `(private) ${text}`);
  }
});

function keyToEmote(key) {
  if (key === '1') return 'wave';
  if (key === '2') return 'dance';
  if (key === '3') return 'cheer';
  return null;
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    if (!authModalEl.classList.contains('hidden')) return;
    if (mineWarningOpen) {
      closeMineWarningDialog();
      return;
    }
    if (npcDialogueOpen) {
      closeNpcDialogue();
      return;
    }
    if (!customizeModalEl.classList.contains('hidden')) {
      setCustomizeModal(false);
      return;
    }
    if (inventoryModalOpen) {
      setInventoryModalOpen(false);
      return;
    }
    if (rodShopModalOpen) {
      setRodShopModalOpen(false);
      return;
    }
    if (marketModalOpen) {
      setMarketModalOpen(false);
      return;
    }
    if (oreModalOpen) {
      setOreModalOpen(false);
      return;
    }
    if (furnitureTraderModalOpen) {
      setFurnitureTraderModalOpen(false);
      return;
    }
    if (homeModalOpen) {
      setHomeModalOpen(false);
      return;
    }
    if (fishIndexOpen) {
      setFishIndexOpen(false);
      return;
    }
    setMenuOpen(!menuOpen);
    return;
  }

  const key = event.key.toLowerCase();
  const typingInInput =
    document.activeElement === chatInputEl ||
    document.activeElement === nameInputEl ||
    document.activeElement === authUsernameEl ||
    document.activeElement === authPasswordEl;

  if (
    key === '/' &&
    isAuthenticated &&
    authModalEl.classList.contains('hidden') &&
    customizeModalEl.classList.contains('hidden') &&
    !isAnyGameplayOverlayOpen() &&
    !typingInInput
  ) {
    event.preventDefault();
    if (menuOpen) setMenuOpen(false);
    setChatPanelOpen(true);
    chatInputEl?.focus();
    return;
  }

  if (
    key === 'v' &&
    !event.repeat &&
    isAuthenticated &&
    authModalEl.classList.contains('hidden') &&
    customizeModalEl.classList.contains('hidden') &&
    !isAnyGameplayOverlayOpen() &&
    !typingInInput
  ) {
    event.preventDefault();
    firstPersonEnabled = !firstPersonEnabled;
    if (!firstPersonEnabled) {
      cameraPitch = clampGameplayCameraPitch(cameraPitch);
      cameraDistanceTarget = Math.max(CAMERA_DIST_MIN, cameraDistanceTarget);
    }
    return;
  }

  if (
    key === 'f' &&
    !event.repeat &&
    isAuthenticated &&
    authModalEl.classList.contains('hidden') &&
    customizeModalEl.classList.contains('hidden') &&
    !isAnyGameplayOverlayOpen() &&
    !typingInInput
  ) {
    event.preventDefault();
    void toggleFullscreenPointerLock();
    return;
  }

  if (!isAuthenticated || menuOpen || isAnyGameplayOverlayOpen() || !customizeModalEl.classList.contains('hidden')) return;
  if (typingInInput) return;
  const local = players.get(localPlayerId);
  const isInteractKey = key === 'e' || key === ' ' || key === 'space';
  if (isInteractKey) {
    event.preventDefault();
  }
  if (fishingMiniGame.active || fishingMiniGame.starting) {
    if (isInteractKey) {
      setFishingHoldState(true);
      return;
    }
  }
  if (miningAccuracyGame.active) {
    if (isInteractKey && !event.repeat) {
      attemptMiningAccuracyHit(local);
      return;
    }
  }
  if ((key === ' ' || key === 'space') && !event.repeat && local) {
    if (inMine && getNearbyOreNode(local) && tryMineNode(local)) {
      return;
    }
    if (!inMine && questState.hasFishingRod && nearestFishingSpot(local) && tryFishingSpotInteract(local)) {
      return;
    }
  }
  if (key === 't' && !event.repeat) {
    event.preventDefault();
    toggleTorchEquip();
    return;
  }
  if (key === 'r' && !event.repeat) {
    event.preventDefault();
    consumeFish(1);
    return;
  }
  if (key === 'q') {
    emoteWheelOpen = true;
    emoteWheelEl?.classList.remove('hidden');
    return;
  }

  if (key === 'e' && !event.repeat) {
    event.preventDefault();
    tryInteract();
    return;
  }

  const emote = keyToEmote(key);
  if (emote && !event.repeat) {
    triggerEmote(emote);
  }

  const wantsJump = (key === ' ' || key === 'space') && !event.repeat;
  if (wantsJump) {
    pendingJump = true;
  }

  keys.add(key);
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  // Always release keys even while menus/modals are open, so input cannot get stuck.
  keys.delete(key);
  if (key === 'e' || key === ' ' || key === 'space') {
    setFishingHoldState(false);
  }
  if (!isAuthenticated || menuOpen || isAnyGameplayOverlayOpen() || !customizeModalEl.classList.contains('hidden')) return;
  if (key === 'q') {
    emoteWheelOpen = false;
    emoteWheelEl?.classList.add('hidden');
  }
});

// Safety: if the tab/window loses focus while a key is held, clear all pressed state.
window.addEventListener('blur', () => {
  keys.clear();
  pendingJump = false;
  setFishingHoldState(false);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    keys.clear();
    pendingJump = false;
    setFishingHoldState(false);
  }
});
window.addEventListener('pointerup', () => {
  setFishingHoldState(false);
});
window.addEventListener('pointercancel', () => {
  setFishingHoldState(false);
});

chatFormEl.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!isAuthenticated) return;
  const text = chatInputEl.value.trim();
  if (!text) return;

  if (/^\/where\b/i.test(text)) {
    const local = players.get(localPlayerId);
    if (!local) {
      appendChatLine({ text: 'Location unavailable.', isSystem: true });
    } else {
      const worldPos = `World: x=${local.x.toFixed(2)}, y=${local.y.toFixed(2)}, z=${local.z.toFixed(2)}`;
      if (inMine) {
        const localX = (local.x - MINE_POS.x).toFixed(2);
        const localZ = (local.z - MINE_POS.z).toFixed(2);
        appendChatLine({ text: `${worldPos} | Mine local: x=${localX}, z=${localZ}`, isSystem: true });
      } else {
        appendChatLine({ text: worldPos, isSystem: true });
      }
    }
    chatInputEl.value = '';
    chatInputEl.focus();
    return;
  }

  const privateCommand = parsePrivateChatCommand(text);
  if (privateCommand) {
    if (privateCommand.error) {
      appendChatLine({ text: privateCommand.error, isSystem: true });
      chatInputEl.focus();
      return;
    }
    const resolved = resolvePrivateRecipient(privateCommand.targetName);
    if (!resolved.recipient) {
      appendChatLine({ text: resolved.error || 'Private message failed.', isSystem: true });
      chatInputEl.focus();
      return;
    }

    socket.emit('private:send', { toId: resolved.recipient.id, text: privateCommand.message }, (resp) => {
      if (!resp?.ok) {
        appendChatLine({ text: resp?.error || 'Private message failed.', isSystem: true });
        chatInputEl.focus();
        return;
      }
      appendChatLine({
        fromName: resp.toName || resolved.recipient.name,
        fromTag: resp.toTag || players.get(resolved.recipient.id)?.accountTag || null,
        text: resp.text || privateCommand.message,
        sentAt: resp.sentAt,
        isPrivate: true,
        isOutgoingPrivate: true
      });
      chatInputEl.value = '';
      chatInputEl.focus();
    });
    return;
  }

  socket.emit('chat', { text });
  chatInputEl.value = '';
  chatInputEl.focus();
});

function currentFormAppearance() {
  return normalizeAppearance(
    {
      skin: skinInputEl.value,
      shirt: colorInputEl.value,
      pants: pantsColorInputEl.value,
      shoes: shoesColorInputEl.value,
      hairStyle: hairStyleInputEl.value,
      hairColor: hairColorInputEl.value,
      faceStyle: faceStyleInputEl.value,
      accessories: [...selectedAccessories]
    },
    defaultAppearance()
  );
}

function refreshItemCards() {
  itemCards.forEach((card) => {
    const type = card.dataset.type;
    const value = card.dataset.value;
    const selected =
      (type === 'hair' && hairStyleInputEl.value === value) ||
      (type === 'face' && faceStyleInputEl.value === value) ||
      (type === 'accessory' && selectedAccessories.has(value));
    card.classList.toggle('active', selected);
  });
}

function makePreviewMesh(appearance) {
  const mesh = makePlayerMesh(appearance);
  scene.remove(mesh);
  mesh.position.set(0, 0, 0);
  paintPlayer({ mesh }, appearance);
  return mesh;
}

function ensurePreviewScene() {
  if (previewScene) return;
  previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color(0x111827);
  previewCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  previewCamera.position.set(0, 2.5, previewDistance);
  previewLight = new THREE.DirectionalLight(0xffffff, 1.25);
  previewLight.position.set(5, 8, 7);
  previewScene.add(new THREE.HemisphereLight(0xdbeafe, 0x1f2937, 0.86), previewLight);
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 24),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.92 })
  );
  pad.rotation.x = -Math.PI / 2;
  previewScene.add(pad);
  previewRenderer = new THREE.WebGLRenderer({ canvas: customizePreviewEl, antialias: true, alpha: false });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, previewPixelRatioCap));

  const startDrag = (event) => {
    event.preventDefault();
    previewDragging = true;
    previewAutoSpin = false;
    previewPointerId = event.pointerId;
    previewLastX = event.clientX;
    previewLastY = event.clientY;
    if (customizePreviewEl.setPointerCapture) {
      try {
        customizePreviewEl.setPointerCapture(event.pointerId);
      } catch {}
    }
  };

  const moveDrag = (event) => {
    if (!previewDragging || (previewPointerId !== null && event.pointerId !== previewPointerId)) return;
    event.preventDefault();
    const dx = event.clientX - previewLastX;
    const dy = event.clientY - previewLastY;
    previewLastX = event.clientX;
    previewLastY = event.clientY;
    previewYaw += dx * 0.012;
    previewPitch = THREE.MathUtils.clamp(previewPitch + dy * 0.004, -0.65, 0.45);
  };

  const endDrag = (event) => {
    if (previewPointerId !== null && event.pointerId !== previewPointerId) return;
    previewDragging = false;
    previewPointerId = null;
  };

  customizePreviewEl.addEventListener('pointerdown', startDrag);
  customizePreviewEl.addEventListener('pointermove', moveDrag);
  customizePreviewEl.addEventListener('pointerup', endDrag);
  customizePreviewEl.addEventListener('pointercancel', endDrag);
  customizePreviewEl.addEventListener('pointerleave', endDrag);
  customizePreviewEl.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      previewAutoSpin = false;
      previewDistance = THREE.MathUtils.clamp(previewDistance + event.deltaY * 0.01, 4.2, 9.2);
    },
    { passive: false }
  );
}

function updatePreviewAvatar() {
  ensurePreviewScene();
  if (previewAvatar) {
    previewScene.remove(previewAvatar);
  }
  previewAvatar = makePreviewMesh(currentFormAppearance());
  previewScene.add(previewAvatar);
}

function renderPreview() {
  if (!previewRenderer || !previewScene || !previewAvatar || customizeModalEl.classList.contains('hidden')) return;
  const width = Math.max(220, customizePreviewEl.clientWidth || customizePreviewEl.width);
  const height = Math.max(220, customizePreviewEl.clientHeight || customizePreviewEl.height);
  if (width !== previewRenderWidth || height !== previewRenderHeight) {
    previewRenderWidth = width;
    previewRenderHeight = height;
    previewRenderer.setSize(width, height, false);
    previewCamera.aspect = width / height;
    previewCamera.updateProjectionMatrix();
  }
  previewCamera.position.set(0, 2.5, previewDistance);
  previewCamera.lookAt(0, 1.55 + Math.sin(previewPitch) * 0.55, 0);
  if (previewAutoSpin && !previewDragging) {
    previewYaw += 0.012;
  }
  previewAvatar.rotation.y = previewYaw;
  previewRenderer.render(previewScene, previewCamera);
}

itemCards.forEach((card) => {
  card.addEventListener('click', () => {
    const type = card.dataset.type;
    const value = card.dataset.value;
    if (type === 'hair') hairStyleInputEl.value = value;
    if (type === 'face') faceStyleInputEl.value = value;
    if (type === 'accessory') {
      if (selectedAccessories.has(value)) selectedAccessories.delete(value);
      else selectedAccessories.add(value);
    }
    refreshItemCards();
    updatePreviewAvatar();
  });
});

function outfitStorageKey(slot) {
  return `island_outfit_slot_${slot}`;
}

function saveOutfit(slot) {
  const appearance = currentFormAppearance();
  const name = nameInputEl.value.trim().slice(0, 18);
  localStorage.setItem(
    outfitStorageKey(slot),
    JSON.stringify({
      name,
      appearance
    })
  );
  customizeStatusEl.textContent = `Saved outfit slot ${slot}.`;
}

function loadOutfit(slot) {
  const raw = localStorage.getItem(outfitStorageKey(slot));
  if (!raw) {
    customizeStatusEl.textContent = `No outfit in slot ${slot}.`;
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const appearance = normalizeAppearance(parsed.appearance, currentFormAppearance());
    if (parsed.name) nameInputEl.value = String(parsed.name).slice(0, 18);
    skinInputEl.value = appearance.skin;
    colorInputEl.value = appearance.shirt;
    pantsColorInputEl.value = appearance.pants;
    shoesColorInputEl.value = appearance.shoes;
    hairStyleInputEl.value = appearance.hairStyle;
    hairColorInputEl.value = appearance.hairColor;
    faceStyleInputEl.value = appearance.faceStyle;
    selectedAccessories.clear();
    (appearance.accessories || []).forEach((item) => selectedAccessories.add(item));
    refreshItemCards();
    updatePreviewAvatar();
    customizeStatusEl.textContent = `Loaded outfit slot ${slot}.`;
  } catch {
    customizeStatusEl.textContent = `Outfit slot ${slot} is invalid.`;
  }
}

outfitSaveButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const slot = Number(button.dataset.outfitSave);
    if (slot) saveOutfit(slot);
  });
});

outfitLoadButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const slot = Number(button.dataset.outfitLoad);
    if (slot) loadOutfit(slot);
  });
});

[skinInputEl, hairStyleInputEl, hairColorInputEl, faceStyleInputEl, colorInputEl, pantsColorInputEl, shoesColorInputEl].forEach((input) => {
  input.addEventListener('input', () => {
    refreshItemCards();
    updatePreviewAvatar();
  });
  input.addEventListener('change', () => {
    refreshItemCards();
    updatePreviewAvatar();
  });
});

refreshItemCards();

customizeFormEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const currentLocal = players.get(localPlayerId);
  const name = (nameInputEl.value.trim().slice(0, 18) || currentLocal?.name || '').trim();
  const appearance = normalizeAppearance(
    {
      skin: skinInputEl.value,
      shirt: colorInputEl.value,
      pants: pantsColorInputEl.value,
      shoes: shoesColorInputEl.value,
      hairStyle: hairStyleInputEl.value,
      hairColor: hairColorInputEl.value,
      faceStyle: faceStyleInputEl.value,
      accessories: [...selectedAccessories]
    },
    currentLocal?.appearance || defaultAppearance()
  );
  const color = appearance.shirt;
  if (!name) return;

  customizeStatusEl.textContent = `Saving ${name}...`;
  if (customizeTimer) {
    clearTimeout(customizeTimer);
  }

  customizeTimer = window.setTimeout(() => {
    customizeStatusEl.textContent = 'Save pending. Check connection.';
  }, 3000);

  socket.emit('customize', { name, color, appearance }, (response) => {
    if (customizeTimer) {
      clearTimeout(customizeTimer);
      customizeTimer = null;
    }
    if (!response?.ok) {
      const persistedName = String(players.get(localPlayerId)?.name || '').trim();
      if (persistedName) {
        nameInputEl.value = persistedName;
      }
      customizeStatusEl.textContent = response?.error || 'Save failed. Try again.';
      return;
    }

    applyPlayerCustomization(localPlayerId, response.name, response.color, response.appearance);
    customizeStatusEl.textContent = `Saved spawn avatar for ${response.name}. You will spawn with this avatar until you change it.`;
  });
});

function setCustomizeModal(open) {
  if (open && !isAuthenticated) return;
  customizeModalEl.classList.toggle('hidden', !open);
  if (open) {
    setMenuOpen(false);
    refreshItemCards();
    updatePreviewAvatar();
  }
}

async function submitAuth(mode) {
  const username = (authUsernameEl?.value || '').trim().toLowerCase();
  const password = authPasswordEl?.value || '';
  if (!username || !password) {
    if (authStatusEl) authStatusEl.textContent = 'Enter username and password.';
    return;
  }
  if (authStatusEl) authStatusEl.textContent = mode === 'register' ? 'Creating account...' : 'Logging in...';
  socket.emit(mode === 'register' ? 'auth:register' : 'auth:login', { username, password }, (response) => {
    if (!response?.ok) {
      if (authStatusEl) authStatusEl.textContent = response?.error || 'Authentication failed.';
      return;
    }
    persistAuth(username, password);
    if (authStatusEl) authStatusEl.textContent = `Welcome, ${username}.`;
  });
}

menuToggleEl?.addEventListener('click', () => setMenuOpen(!menuOpen));
menuTitleEl?.addEventListener('click', () => {
  if (!isCreatorAccount()) return;
  const now = performance.now();
  if (now - debugTapResetAt > DEBUG_TAP_RESET_MS) {
    debugTapCount = 0;
  }
  debugTapResetAt = now;
  debugTapCount += 1;
  if (debugTapCount >= 5) {
    debugTapCount = 0;
    setDebugMenuOpen(true);
  }
});
debugCloseEl?.addEventListener('click', () => setDebugMenuOpen(false));
debugOverlayEl?.addEventListener('click', (event) => {
  if (event.target === debugOverlayEl) setDebugMenuOpen(false);
});
debugItemTypeEl?.addEventListener('change', refreshDebugItemOptions);
debugWorldApplyEl?.addEventListener('click', sendDebugWorldUpdate);
debugAddEl?.addEventListener('click', () => sendDebugInventoryUpdate(1));
debugRemoveEl?.addEventListener('click', () => sendDebugInventoryUpdate(-1));
debugKickEl?.addEventListener('click', sendDebugKick);
debugBanEl?.addEventListener('click', () => sendDebugBan('ban'));
debugUnbanEl?.addEventListener('click', () => sendDebugBan('unban'));
debugBansRefreshEl?.addEventListener('click', () => requestDebugBannedAccounts());
debugBannedUnbanEl?.addEventListener('click', sendDebugBannedUnban);
debugCoinsAddEl?.addEventListener('click', () => sendDebugProgressUpdate('coins', 'add'));
debugCoinsRemoveEl?.addEventListener('click', () => sendDebugProgressUpdate('coins', 'remove'));
debugXpAddEl?.addEventListener('click', () => sendDebugProgressUpdate('xp', 'add'));
debugXpRemoveEl?.addEventListener('click', () => sendDebugProgressUpdate('xp', 'remove'));
debugLevelSetEl?.addEventListener('click', () => sendDebugProgressUpdate('level', 'set'));
chatToggleEl?.addEventListener('click', () => {
  if (!isAuthenticated) return;
  setChatPanelOpen(!chatPanelOpen);
  if (chatPanelOpen) chatInputEl?.focus();
});
voiceQuickToggleEl?.addEventListener('click', async () => {
  if (!isAuthenticated) return;
  await toggleVoiceQuick();
});
fullscreenToggleEl?.addEventListener('click', async () => {
  await toggleFullscreenPointerLock();
});
menuOverlayEl?.addEventListener('click', (event) => {
  if (event.target === menuOverlayEl) setMenuOpen(false);
});
minimapToggleEl?.addEventListener('click', () => {
  setMinimapEnabled(!minimapEnabled);
});
minimapQuickToggleEl?.addEventListener('click', () => {
  setMinimapEnabled(!minimapEnabled);
});
fishIndexToggleEl?.addEventListener('click', () => {
  if (!isAuthenticated) return;
  setFishIndexOpen(!fishIndexOpen);
});
inventoryToggleEl?.addEventListener('click', () => {
  if (!isAuthenticated) return;
  setInventoryModalOpen(!inventoryModalOpen);
});
performanceToggleEl?.addEventListener('click', () => {
  const currentIdx = GRAPHICS_PRESETS.indexOf(graphicsPreset);
  const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % GRAPHICS_PRESETS.length : 0;
  graphicsPreset = GRAPHICS_PRESETS[nextIdx];
  applyPerformanceMode();
});
minimapEl?.addEventListener('click', () => {
  if (!minimapEnabled) return;
  if (isMobileLayout()) return;
  setMinimapExpanded(!minimapExpanded);
});
saveQuitEl?.addEventListener('click', () => {
  disableVoice();
  setCustomizeModal(false);
  setMenuOpen(false);
  socket.emit('auth:logout');
  clearSessionWorld();
  setAuthModalOpen(true, 'Progress saved. Login to continue.');
});
authLoginEl?.addEventListener('click', () => submitAuth('login'));
authRegisterEl?.addEventListener('click', () => submitAuth('register'));
authPasswordEl?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitAuth('login');
  }
});
authUsernameEl?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitAuth('login');
  }
});

customizeOpenEl?.addEventListener('click', () => {
  setCustomizeModal(true);
});
customizeCloseEl?.addEventListener('click', () => setCustomizeModal(false));
customizeModalEl?.addEventListener('click', (event) => {
  if (event.target === customizeModalEl) setCustomizeModal(false);
});
fishIndexCloseEl?.addEventListener('click', () => setFishIndexOpen(false));
fishIndexModalEl?.addEventListener('click', (event) => {
  if (event.target === fishIndexModalEl) setFishIndexOpen(false);
});
inventoryCloseEl?.addEventListener('click', () => setInventoryModalOpen(false));
inventoryModalEl?.addEventListener('click', (event) => {
  if (event.target === inventoryModalEl) setInventoryModalOpen(false);
});
inventoryTabOresEl?.addEventListener('click', () => {
  inventoryViewTab = 'ores';
  renderInventoryModal();
});
inventoryTabFishEl?.addEventListener('click', () => {
  inventoryViewTab = 'fish';
  renderInventoryModal();
});
rodShopCloseEl?.addEventListener('click', () => setRodShopModalOpen(false));
rodShopModalEl?.addEventListener('click', (event) => {
  if (event.target === rodShopModalEl) setRodShopModalOpen(false);
});
marketCloseEl?.addEventListener('click', () => setMarketModalOpen(false));
marketModalEl?.addEventListener('click', (event) => {
  if (event.target === marketModalEl) setMarketModalOpen(false);
});
oreCloseEl?.addEventListener('click', () => setOreModalOpen(false));
oreModalEl?.addEventListener('click', (event) => {
  if (event.target === oreModalEl) setOreModalOpen(false);
});
furnitureTraderCloseEl?.addEventListener('click', () => setFurnitureTraderModalOpen(false));
furnitureTraderModalEl?.addEventListener('click', (event) => {
  if (event.target === furnitureTraderModalEl) setFurnitureTraderModalOpen(false);
});
homeCloseEl?.addEventListener('click', () => setHomeModalOpen(false));
homeModalEl?.addEventListener('click', (event) => {
  if (event.target === homeModalEl) setHomeModalOpen(false);
});
homeWallApplyEl?.addEventListener('click', () => {
  const paintId = typeof homeWallSelectEl?.value === 'string' ? homeWallSelectEl.value : '';
  if (!paintId) {
    setHomeStatus('Select a wall paint first.', '#fecaca');
    return;
  }
  socket.emit('home:setPaint', { surface: 'wall', paintId }, (resp) => {
    if (!resp?.ok) {
      setHomeStatus(resp?.error || 'Could not apply wall paint.', '#fecaca');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    if (resp.unchanged) {
      setHomeStatus('Wall paint already applied.', '#cbd5e1');
      return;
    }
    const wallLabel = HOME_ROOM_WALL_OPTIONS[paintId]?.label || capitalizeWord(paintId);
    setHomeStatus(`Applied ${wallLabel} wall paint.`, '#86efac');
    renderHomeModal();
  });
});
homeFloorApplyEl?.addEventListener('click', () => {
  const paintId = typeof homeFloorSelectEl?.value === 'string' ? homeFloorSelectEl.value : '';
  if (!paintId) {
    setHomeStatus('Select a floor paint first.', '#fecaca');
    return;
  }
  socket.emit('home:setPaint', { surface: 'floor', paintId }, (resp) => {
    if (!resp?.ok) {
      setHomeStatus(resp?.error || 'Could not apply floor paint.', '#fecaca');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    if (resp.unchanged) {
      setHomeStatus('Floor paint already applied.', '#cbd5e1');
      return;
    }
    const floorLabel = HOME_ROOM_FLOOR_OPTIONS[paintId]?.label || capitalizeWord(paintId);
    setHomeStatus(`Applied ${floorLabel} floor paint.`, '#86efac');
    renderHomeModal();
  });
});
homeDoorToggleEl?.addEventListener('click', () => {
  socket.emit('home:setDoor', {}, (resp) => {
    if (!resp?.ok) {
      setHomeStatus(resp?.error || 'Could not toggle door.', '#fecaca');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    const state = resp.doorOpen ? 'open' : 'closed';
    setHomeStatus(`Door is now ${state}.`, '#86efac');
    renderHomeModal();
  });
});
homeUnclaimEl?.addEventListener('click', () => {
  openNpcDialogue({
    name: 'Unclaim Room',
    text: 'Sell your room for 400 coins? All furniture will be reset to starter items and paint will reset.',
    primaryLabel: 'Sell Room',
    secondaryLabel: 'Cancel',
    onPrimary: () => {
      localRoomTransitioning = true;
      socket.emit('home:unclaimRoom', {}, (resp) => {
        if (!resp?.ok) {
          localRoomTransitioning = false;
          setHomeStatus(resp?.error || 'Could not unclaim room.', '#fecaca');
          return;
        }
        if (resp.progress) {
          applyProgressState(resp.progress);
        }
        setHomeStatus(`Room sold for ${resp.sellPrice} coins.`, '#86efac');
        setHomeModalOpen(false);
        const localPlayer = players.get(localPlayerId);
        if (localPlayer) localPlayer.currentRoomId = null;
        players.forEach((p) => updatePlayerVisibility(p));
      });
    }
  });
});
marketOpenIndexEl?.addEventListener('click', () => {
  setMarketModalOpen(false);
  setFishIndexOpen(true);
});
marketSellItemEl?.addEventListener('change', renderMarketSellPreview);
marketSellAmountEl?.addEventListener('input', renderMarketSellPreview);
oreSellItemEl?.addEventListener('change', renderOreSellPreview);
oreSellAmountEl?.addEventListener('input', renderOreSellPreview);
marketSellBtnEl?.addEventListener('click', () => {
  const { category, entry } = selectedMarketSellEntry();
  if (!entry) {
    setMarketStatus('No item selected to sell.', '#fecaca');
    return;
  }
  const requested = Number(marketSellAmountEl?.value);
  const amount = Number.isFinite(requested) ? THREE.MathUtils.clamp(Math.floor(requested), 1, entry.qty) : 1;
  socket.emit('market:sellSelection', { category, itemId: entry.id, amount }, (resp) => {
    if (!resp?.ok) {
      setMarketStatus(resp?.error || 'Could not sell selected item.', '#fecaca');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    renderMarketModal();
    const sold = Math.max(1, Math.floor(Number(resp.sold) || amount));
    const coinsEarned = Math.max(0, Math.floor(Number(resp.coinsEarned) || 0));
    setMarketStatus(`Sold ${sold.toLocaleString()} for ${coinsEarned.toLocaleString()} coins.`, '#86efac');
  });
});
oreSellBtnEl?.addEventListener('click', () => {
  const { category, entry } = selectedOreSellEntry();
  if (!entry) {
    setOreStatus('No ore selected to sell.', '#fecaca');
    return;
  }
  const requested = Number(oreSellAmountEl?.value);
  const amount = Number.isFinite(requested) ? THREE.MathUtils.clamp(Math.floor(requested), 1, entry.qty) : 1;
  socket.emit('market:sellSelection', { category, itemId: entry.id, amount }, (resp) => {
    if (!resp?.ok) {
      setOreStatus(resp?.error || 'Could not sell ore.', '#fecaca');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    renderOreModal();
    const sold = Math.max(1, Math.floor(Number(resp.sold) || amount));
    const coinsEarned = Math.max(0, Math.floor(Number(resp.coinsEarned) || 0));
    setOreStatus(`Sold ${sold.toLocaleString()} for ${coinsEarned.toLocaleString()} coins.`, '#86efac');
  });
});
marketQuestFishItemEl?.addEventListener('change', renderMarketQuestSection);
marketQuestFishAmountEl?.addEventListener('input', renderMarketQuestSection);
marketQuestAcceptBtnEl?.addEventListener('click', () => {
  socket.emit('market:fishingQuestAccept', {}, (resp) => {
    if (!resp?.ok) {
      setMarketStatus(resp?.error || 'Could not accept fishing quest.', '#fecaca');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    renderMarketModal();
    setMarketStatus('Fishing quest accepted.', '#86efac');
  });
});
marketQuestTurnInBtnEl?.addEventListener('click', () => {
  const fishId = typeof marketQuestFishItemEl?.value === 'string' ? marketQuestFishItemEl.value : '';
  if (!fishId) {
    setMarketStatus('Select fish to turn in.', '#fecaca');
    return;
  }
  const owned = ownedFishCount(fishId);
  const requested = Number(marketQuestFishAmountEl?.value);
  const amount = Number.isFinite(requested) ? THREE.MathUtils.clamp(Math.floor(requested), 1, Math.max(1, owned)) : 1;
  socket.emit('market:fishingQuestTurnIn', { fishId, amount }, (resp) => {
    if (!resp?.ok) {
      setMarketStatus(resp?.error || 'Could not turn in fish.', '#fecaca');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    renderMarketModal();
    const turnedIn = Math.max(1, Math.floor(Number(resp.turnedIn) || amount));
    setMarketStatus(`Turned in ${turnedIn.toLocaleString()} fish.`, '#86efac');
  });
});
marketQuestClaimBtnEl?.addEventListener('click', () => {
  socket.emit('market:fishingQuestClaim', {}, (resp) => {
    if (!resp?.ok) {
      setMarketStatus(resp?.error || 'Could not claim fishing quest.', '#fecaca');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    renderMarketModal();
    const rewardXp = Math.max(0, Math.floor(Number(resp.rewardXp) || 0));
    setMarketStatus(`Claimed ${rewardXp.toLocaleString()} XP. New fishing quest generated.`, '#86efac');
  });
});
rodBuyBtnEl?.addEventListener('click', () => {
  socket.emit('shop:buyFishingRod', {}, (resp) => {
    if (!resp?.ok) {
      setRodShopStatus(resp?.error || 'Could not buy fishing rod.', '#fecaca');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    if (resp.rodShop) {
      rodShopSnapshot = {
        ...(rodShopSnapshot || {}),
        ...resp,
        rodShop: resp.rodShop
      };
    }
    renderRodShopModal();
    setRodShopStatus('Fishing rod purchased.', '#86efac');
  });
});
rodUpgradeBtnEl?.addEventListener('click', () => {
  socket.emit('shop:upgradeFishingRod', {}, (resp) => {
    if (!resp?.ok) {
      setRodShopStatus(resp?.error || 'Could not upgrade rod.', '#fecaca');
      return;
    }
    if (resp.progress) {
      applyProgressState(resp.progress);
    }
    if (resp.rodShop) {
      rodShopSnapshot = {
        ...(rodShopSnapshot || {}),
        ...resp,
        rodShop: resp.rodShop
      };
    }
    renderRodShopModal();
    setRodShopStatus('Rod upgraded successfully.', '#86efac');
  });
});

wheelButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const type = button.dataset.wheelEmote;
    if (!type) return;
    triggerEmote(type);
    emoteWheelOpen = false;
    emoteWheelEl?.classList.add('hidden');
  });
});

voiceToggleEl?.addEventListener('click', async () => {
  await toggleVoiceQuick();
});
npcDialoguePrimaryEl?.addEventListener('click', () => {
  if (typeof npcDialoguePrimaryAction === 'function') npcDialoguePrimaryAction();
});
npcDialogueSecondaryEl?.addEventListener('click', () => {
  if (typeof npcDialogueSecondaryAction === 'function') npcDialogueSecondaryAction();
});
mineWarningContinueEl?.addEventListener('click', () => {
  const dontAskAgain = Boolean(mineWarningNoAskEl?.checked);
  const action = mineWarningContinueAction;
  closeMineWarningDialog();
  if (typeof action === 'function') action(dontAskAgain);
});
mineWarningCancelEl?.addEventListener('click', () => {
  closeMineWarningDialog();
});
miningMeterEl?.addEventListener('pointerdown', (event) => {
  if (!miningAccuracyGame.active) return;
  if (typeof event.button === 'number' && event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  attemptMiningAccuracyHit(players.get(localPlayerId));
});
fishingMeterEl?.addEventListener('pointerdown', (event) => {
  if (!fishingMiniGame.active) return;
  if (typeof event.button === 'number' && event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  setFishingHoldState(true);
});
fishingMeterEl?.addEventListener('pointerup', () => {
  setFishingHoldState(false);
});
fishingMeterEl?.addEventListener('pointercancel', () => {
  setFishingHoldState(false);
});
fishingMeterEl?.addEventListener('pointerleave', () => {
  setFishingHoldState(false);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, renderPixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (previewRenderer) {
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, previewPixelRatioCap));
    previewRenderWidth = 0;
    previewRenderHeight = 0;
  }
  applyResponsiveLayout();
  resetJoystick();
});

window.addEventListener('beforeunload', () => {
  if (document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  disableVoice();
});

let joystickId = null;
let joystickX = 0;
let joystickY = 0;

function updateJoystick(event) {
  const rect = joystickEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const radius = rect.width * 0.42;
  const len = Math.hypot(dx, dy) || 1;
  const scale = len > radius ? radius / len : 1;
  const clampedX = dx * scale;
  const clampedY = dy * scale;
  const inputGain = 1.15;
  const stickSize = joystickStickEl.offsetWidth || 40;
  const stickHome = (rect.width - stickSize) * 0.5;

  joystickX = THREE.MathUtils.clamp((clampedX / radius) * inputGain, -1, 1);
  joystickY = THREE.MathUtils.clamp((clampedY / radius) * inputGain, -1, 1);

  joystickStickEl.style.left = `${stickHome + clampedX}px`;
  joystickStickEl.style.top = `${stickHome + clampedY}px`;
}

function resetJoystick() {
  joystickId = null;
  joystickX = 0;
  joystickY = 0;
  const stickSize = joystickStickEl.offsetWidth || 40;
  const baseSize = joystickEl.clientWidth || 120;
  const stickHome = (baseSize - stickSize) * 0.5;
  joystickStickEl.style.left = `${stickHome}px`;
  joystickStickEl.style.top = `${stickHome}px`;
}

joystickEl.addEventListener('pointerdown', (event) => {
  joystickId = event.pointerId;
  joystickEl.setPointerCapture(event.pointerId);
  updateJoystick(event);
});

joystickEl.addEventListener('pointermove', (event) => {
  if (event.pointerId !== joystickId) return;
  updateJoystick(event);
});

joystickEl.addEventListener('pointerup', (event) => {
  if (event.pointerId !== joystickId) return;
  joystickEl.releasePointerCapture(event.pointerId);
  resetJoystick();
});

joystickEl.addEventListener('pointercancel', resetJoystick);

mobileJumpEl?.addEventListener('click', () => {
  if (!isAuthenticated || menuOpen || isAnyGameplayOverlayOpen() || !customizeModalEl.classList.contains('hidden')) return;
  pendingJump = true;
});
mobileUseEl?.addEventListener('pointerdown', (event) => {
  if (!fishingMiniGame.active && !fishingMiniGame.starting) return;
  event.preventDefault();
  setFishingHoldState(true);
});
mobileUseEl?.addEventListener('pointerup', () => {
  setFishingHoldState(false);
});
mobileUseEl?.addEventListener('pointercancel', () => {
  setFishingHoldState(false);
});
mobileUseEl?.addEventListener('pointerleave', () => {
  setFishingHoldState(false);
});
mobileUseEl?.addEventListener('click', tryInteract);
mobileConsumeEl?.addEventListener('click', () => consumeFish(1));

let lastSentAt = 0;
const WALK_SPEED = 12;
const SPRINT_MULTIPLIER = 1.58;
const GRAVITY = 30;
const JUMP_VELOCITY = 11;
const SEND_EVERY_MS = 45;
const TURN_SPEED = 14;
const REMOTE_TURN_SPEED = 10;
const STAMINA_DRAIN = 25;
const STAMINA_REGEN = 18;
const SLIDE_DURATION = 0.42;
const SLIDE_SPEED = 20;
let stamina = STAMINA_BASE_MAX;
let slideUntil = 0;
let slideDirX = 0;
let slideDirZ = 0;

const CAMERA_PITCH_MIN = 0.2;
const CAMERA_PITCH_MAX = 1.18;
const CAMERA_PITCH_FIRST_PERSON_MIN = -1.12;
const CAMERA_PITCH_FIRST_PERSON_MAX = 1.12;
const CAMERA_DIST_MIN = 8;
const CAMERA_DIST_MAX = 30;
const CAMERA_DIST_START = 17;
const FIRST_PERSON_EYE_HEIGHT = 1.94;
const FIRST_PERSON_EYE_HEIGHT_SWIM = 1.08;
let cameraYaw = 0;
let cameraPitch = 0.58;
let cameraDistance = CAMERA_DIST_START;
let cameraDistanceTarget = CAMERA_DIST_START;
let firstPersonEnabled = false;
let isOrbiting = false;
let orbitPointerId = null;
let lastPointerX = 0;
let lastPointerY = 0;

function clampGameplayCameraPitch(value) {
  const min = firstPersonEnabled ? CAMERA_PITCH_FIRST_PERSON_MIN : CAMERA_PITCH_MIN;
  const max = firstPersonEnabled ? CAMERA_PITCH_FIRST_PERSON_MAX : CAMERA_PITCH_MAX;
  return Math.max(min, Math.min(max, value));
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button === 0) {
    const local = players.get(localPlayerId);
    if (fishingMiniGame.active) {
      event.preventDefault();
      setFishingHoldState(true);
      return;
    }
    if (miningAccuracyGame.active) {
      event.preventDefault();
      attemptMiningAccuracyHit(local);
      return;
    }
    const canTryMineByClick = Boolean(local)
      && isAuthenticated
      && inMine
      && !menuOpen
      && !isAnyGameplayOverlayOpen()
      && !mineWarningOpen
      && !npcDialogueOpen
      && customizeModalEl.classList.contains('hidden');
    if (canTryMineByClick && tryMineNode(local)) {
      event.preventDefault();
      return;
    }
  }
  if (pointerLocked) return;
  if (event.button !== 0) return;
  isOrbiting = true;
  orbitPointerId = event.pointerId;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (miningAccuracyGame.active || fishingMiniGame.active) return;
  if (pointerLocked) {
    cameraYaw -= (event.movementX || 0) * 0.0038;
    cameraPitch = clampGameplayCameraPitch(cameraPitch - (event.movementY || 0) * 0.0038);
    return;
  }
  if (!isOrbiting || event.pointerId !== orbitPointerId) return;
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;

  cameraYaw -= dx * 0.005;
  cameraPitch = clampGameplayCameraPitch(cameraPitch - dy * 0.005);
});

function endOrbit(event) {
  if (pointerLocked) return;
  if (!isOrbiting || event.pointerId !== orbitPointerId) return;
  isOrbiting = false;
  orbitPointerId = null;
  renderer.domElement.releasePointerCapture(event.pointerId);
}

renderer.domElement.addEventListener('pointerup', (event) => {
  setFishingHoldState(false);
  endOrbit(event);
});
renderer.domElement.addEventListener('pointercancel', (event) => {
  setFishingHoldState(false);
  endOrbit(event);
});
renderer.domElement.addEventListener(
  'wheel',
  (event) => {
    if (miningAccuracyGame.active) return;
    if (firstPersonEnabled) return;
    event.preventDefault();
    cameraDistanceTarget = Math.max(
      CAMERA_DIST_MIN,
      Math.min(CAMERA_DIST_MAX, cameraDistanceTarget + event.deltaY * 0.01)
    );
  },
  { passive: false }
);

let dayTime = 0.23;
let rainActive = false;
let nextWeatherToggleAt = 15;
// Pre-allocated color objects — avoids new THREE.Color() every frame
const _skyColor = new THREE.Color();
const _fogColor = new THREE.Color();

function updateDayAndWeather(delta, nowSeconds) {
  if (!worldStateLocked) {
    dayTime = (dayTime + delta / 240) % 1;
  } else if (worldState.cycleTime) {
    const cycleStart = Number(worldState.cycleStart || 0);
    const offset = Number.isFinite(Number(worldState.cycleOffset))
      ? Number(worldState.cycleOffset)
      : WORLD_TIME_PRESETS[worldState.timeOfDay] ?? WORLD_TIME_PRESETS.day;
    const elapsed = (Date.now() - cycleStart) / WORLD_CYCLE_MS;
    dayTime = ((offset + elapsed) % 1 + 1) % 1;
  } else if (WORLD_TIME_PRESETS[worldState.timeOfDay] != null) {
    dayTime = WORLD_TIME_PRESETS[worldState.timeOfDay];
  }
  const sunAngle = dayTime * Math.PI * 2;
  // Center daylight at noon and keep midnight consistently darkest.
  const solarCurve = Math.cos((dayTime - 0.5) * Math.PI * 2);
  const dayFactor = THREE.MathUtils.clamp((solarCurve + 0.2) / 1.2, 0, 1);
  const insideMine = inMine;
  const outdoorSunIntensity = 0.03 + dayFactor * 1.07;
  const outdoorHemiIntensity = 0.06 + dayFactor * 0.92;

  sun.intensity = insideMine ? outdoorSunIntensity * 0.08 : outdoorSunIntensity;
  hemi.intensity = insideMine ? (0.1 + dayFactor * 0.2) : outdoorHemiIntensity;
  sun.position.set(Math.cos(sunAngle) * 40, 16 + dayFactor * 26, Math.sin(sunAngle) * 40);

  if (insideMine) {
    _skyColor.setHSL(0.62, 0.28, 0.055);
    _fogColor.setHSL(0.62, 0.25, 0.045);
    scene.fog.color.copy(_fogColor);
    scene.fog.near = 10;
    scene.fog.far = MINE_RADIUS + 26;
  } else {
    _skyColor.setHSL(0.58, 0.5, 0.035 + dayFactor * 0.52);
    _fogColor.setHSL(0.58, 0.36, 0.02 + dayFactor * 0.35);
    scene.fog.color.copy(_fogColor);
    if (lowPerformanceMode) {
      scene.fog.near = 28 + dayFactor * 10;
      scene.fog.far = 64 + dayFactor * 52;
    } else {
      scene.fog.near = 34 + dayFactor * 14;
      scene.fog.far = 88 + dayFactor * 84;
    }
  }
  renderer.setClearColor(_skyColor);

  if (worldStateLocked) {
    rainActive = worldState.weather === 'rain';
  } else if (nowSeconds > nextWeatherToggleAt) {
    rainActive = Math.random() > 0.55;
    nextWeatherToggleAt = nowSeconds + 22 + Math.random() * 16;
  }

  const renderRain = rainActive && !insideMine;
  rain.visible = renderRain;
  weatherLabelEl.textContent = insideMine ? 'Cave' : (rainActive ? (lowPerformanceMode ? 'Rain (lite)' : 'Rain') : 'Clear');

  if (renderRain) {
    const attr = rainGeometry.attributes.position;
    // Only iterate particles when rain is actually visible
    for (let i = 0; i < rainParticleUpdateCount; i += 1) {
      const idx = i * 3;
      attr.array[idx + 1] -= delta * 22;
      if (attr.array[idx + 1] < 0.5) {
        attr.array[idx + 1] = 30 + Math.random() * 10;
      }
    }
    attr.needsUpdate = true;
  }

  if (dayTime < 0.18 || dayTime > 0.82) {
    timeLabelEl.textContent = 'Night';
  } else if (dayTime < 0.34) {
    timeLabelEl.textContent = 'Morning';
  } else if (dayTime < 0.64) {
    timeLabelEl.textContent = 'Day';
  } else {
    timeLabelEl.textContent = 'Evening';
  }
}

function movementInput() {
  let x = 0;
  let z = 0;

  if (keys.has('w') || keys.has('arrowup')) z -= 1;
  if (keys.has('s') || keys.has('arrowdown')) z += 1;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;

  x += joystickX;
  z += joystickY;

  return { x, z };
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function rotatePlayerTowards(player, targetYaw, delta, speed) {
  if (!player?.mesh) return;
  const current = Number.isFinite(player.facingYaw) ? player.facingYaw : player.mesh.rotation.y;
  const target = normalizeAngle(targetYaw);
  const diff = normalizeAngle(target - current);
  const t = Math.min(1, delta * speed);
  const next = normalizeAngle(current + diff * t);
  player.facingYaw = next;
  player.mesh.rotation.y = next;
}

function updateLocalPlayer(delta, nowMs) {
  if (!isAuthenticated || menuOpen || isAnyGameplayOverlayOpen() || !customizeModalEl.classList.contains('hidden')) return;
  const local = players.get(localPlayerId);
  if (!local) return;
  if (miningAccuracyGame.active || fishingMiniGame.active) {
    local.animSpeed = 0;
    local.vy = 0;
    if (!Number.isFinite(local.targetYaw)) {
      local.targetYaw = Number.isFinite(local.facingYaw) ? local.facingYaw : 0;
    }
    rotatePlayerTowards(local, local.targetYaw, delta, TURN_SPEED * 0.65);
    if (staminaFillEl) {
      stamina = Math.min(getStaminaMax(), stamina + STAMINA_REGEN * delta);
      const pct = Math.round((stamina / getStaminaMax()) * 100);
      staminaFillEl.style.width = `${pct}%`;
    }
    return;
  }

  const prevX = local.x;
  const prevY = local.y;
  const prevZ = local.z;

  if (boatState.onboard && boatState.mesh) {
    const throttle = (keys.has('w') || keys.has('arrowup') ? 1 : 0) + (keys.has('s') || keys.has('arrowdown') ? -0.55 : 0);
    const steer = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + (keys.has('d') || keys.has('arrowright') ? -1 : 0);
    boatState.yaw += steer * delta * 1.9;
    boatState.speed = THREE.MathUtils.lerp(boatState.speed, throttle * 10.5, Math.min(1, delta * 3.5));
    boatState.x += Math.sin(boatState.yaw) * boatState.speed * delta;
    boatState.z += Math.cos(boatState.yaw) * boatState.speed * delta;
    const shore = resolveBoatShoreCollision(boatState.x, boatState.z);
    boatState.x = shore.x;
    boatState.z = shore.z;
    if (shore.collided) {
      boatState.speed *= 0.55;
    }
    const travelLimit = worldLimit * 3.45;
    boatState.x = THREE.MathUtils.clamp(boatState.x, -travelLimit, travelLimit);
    boatState.z = THREE.MathUtils.clamp(boatState.z, -travelLimit, travelLimit);
    boatState.paddlePhase += delta * (3.2 + Math.abs(boatState.speed) * 0.45);
    const rowStrength = Math.min(1, Math.abs(boatState.speed) / 8);
    const stroke = Math.sin(boatState.paddlePhase) * rowStrength;
    if (boatState.paddleLeftPivot && boatState.paddleRightPivot) {
      boatState.paddleLeftPivot.rotation.x = -0.35 + stroke * 0.75;
      boatState.paddleRightPivot.rotation.x = -0.35 - stroke * 0.75;
      boatState.paddleLeftPivot.rotation.z = -0.2 + stroke * 0.18;
      boatState.paddleRightPivot.rotation.z = 0.2 - stroke * 0.18;
    }
    boatState.mesh.position.set(boatState.x, boatState.y + Math.sin(nowMs * 0.002) * 0.05, boatState.z);
    boatState.mesh.rotation.y = boatState.yaw;
    const seatForward = -0.12;
    const seatRight = 0;
    const fX = Math.sin(boatState.yaw);
    const fZ = Math.cos(boatState.yaw);
    const rX = Math.cos(boatState.yaw);
    const rZ = -Math.sin(boatState.yaw);
    local.x = boatState.x + fX * seatForward + rX * seatRight;
    local.y = boatState.y - 0.06;
    local.z = boatState.z + fZ * seatForward + rZ * seatRight;
    local.vy = 0;
    local.targetYaw = boatState.yaw;
    local.facingYaw = boatState.yaw;
    local.mesh.position.set(local.x, local.y, local.z);
    local.mesh.rotation.y = boatState.yaw;
    local.animSpeed = Math.min(1, Math.abs(boatState.speed) / 10);

    if (staminaFillEl) {
      stamina = Math.min(getStaminaMax(), stamina + STAMINA_REGEN * delta);
      const pct = Math.round((stamina / getStaminaMax()) * 100);
      staminaFillEl.style.width = `${pct}%`;
    }
    return;
  }
  applyLocalSurfaceState(local);
  const activeFloorY = floorYForLocal(local);
  const isGrounded = local.y <= activeFloorY + 0.05;
  const sprintHeld = keys.has('shift');
  const wantsSlide = keys.has('c');

  const input = movementInput();
  let hasMoveInput = false;
  const isSliding = nowMs < slideUntil;

  if (canSlideNow(local, wantsSlide, isGrounded, isSliding, input)) {
    const len = Math.hypot(input.x, input.z) || 1;
    const normalizedX = input.x / len;
    const normalizedZ = input.z / len;
    const forwardScale = -normalizedZ;
    if (firstPersonEnabled) {
      // First-person movement must match the camera's true forward/right vectors.
      slideDirX = normalizedX * -Math.cos(cameraYaw) + forwardScale * Math.sin(cameraYaw);
      slideDirZ = normalizedX * Math.sin(cameraYaw) + forwardScale * Math.cos(cameraYaw);
    } else {
      slideDirX = normalizedX * Math.cos(cameraYaw) + forwardScale * -Math.sin(cameraYaw);
      slideDirZ = normalizedX * -Math.sin(cameraYaw) + forwardScale * -Math.cos(cameraYaw);
    }
    const dirLen = Math.hypot(slideDirX, slideDirZ) || 1;
    slideDirX /= dirLen;
    slideDirZ /= dirLen;
    slideUntil = nowMs + SLIDE_DURATION * 1000;
  }

  let speed = movementSpeedForState(local);
  if (Math.abs(input.x) > 0.0001 || Math.abs(input.z) > 0.0001) {
    hasMoveInput = true;
    const len = Math.hypot(input.x, input.z) || 1;
    const normalizedX = input.x / len;
    const normalizedZ = input.z / len;
    const forwardScale = -normalizedZ;

    let worldX;
    let worldZ;
    if (firstPersonEnabled) {
      // First-person: W goes where camera looks, A/D strafe correctly.
      worldX = normalizedX * -Math.cos(cameraYaw) + forwardScale * Math.sin(cameraYaw);
      worldZ = normalizedX * Math.sin(cameraYaw) + forwardScale * Math.cos(cameraYaw);
    } else {
      worldX = normalizedX * Math.cos(cameraYaw) + forwardScale * -Math.sin(cameraYaw);
      worldZ = normalizedX * -Math.sin(cameraYaw) + forwardScale * -Math.cos(cameraYaw);
    }
    const canSprint = canSprintNow(local, sprintHeld, stamina, isSliding);
    if (canSprint) {
      speed *= SPRINT_MULTIPLIER;
      stamina = Math.max(0, stamina - STAMINA_DRAIN * delta);
    } else {
      stamina = Math.min(getStaminaMax(), stamina + STAMINA_REGEN * delta * 0.75);
    }
    local.x += worldX * speed * delta;
    local.z += worldZ * speed * delta;
    local.targetYaw = Math.atan2(worldX, worldZ);
  } else {
    stamina = Math.min(getStaminaMax(), stamina + STAMINA_REGEN * delta);
  }

  if (runSlideAllowed(local, isSliding)) {
    const slideT = Math.max(0, (slideUntil - nowMs) / (SLIDE_DURATION * 1000));
    const slideSpeed = SLIDE_SPEED * slideT;
    local.x += slideDirX * slideSpeed * delta;
    local.z += slideDirZ * slideSpeed * delta;
    local.targetYaw = Math.atan2(slideDirX, slideDirZ);
    hasMoveInput = true;
    stamina = Math.max(0, stamina - STAMINA_DRAIN * delta * 0.5 * slideDrainMultiplier(local));

  }
  localStepMovementEnd(local, delta, nowMs, prevY);
  playerSpeedFromDelta(local, prevX, prevZ, delta, local.x, local.z);

  local.mesh.position.set(local.x, local.y, local.z);
  if (hasMoveInput) {
    rotatePlayerTowards(local, local.targetYaw ?? 0, delta, TURN_SPEED);
  } else {
    rotatePlayerTowards(local, local.targetYaw ?? local.facingYaw ?? 0, delta, TURN_SPEED * 0.65);
  }
  if (tryAutoTeleport(local, nowMs)) {
    return;
  }
  if (staminaFillEl) {
    const pct = Math.round((stamina / getStaminaMax()) * 100);
    staminaFillEl.style.width = `${pct}%`;
  }

  if (nowMs - lastSentAt >= SEND_EVERY_MS) {
    const inServerSyncRange = inSwimSyncRange(local);
    const changed =
      Math.abs(local.x - prevX) > 0.01 ||
      Math.abs(local.y - prevY) > 0.01 ||
      Math.abs(local.z - prevZ) > 0.01;
    if (changed && inServerSyncRange) {
      socket.emit('move', {
        x: local.x,
        y: local.y,
        z: local.z,
        inMine,
        isFishing: Boolean(fishingMiniGame.active || fishingMiniGame.starting)
      });
      lastSentAt = nowMs;
    }
  }
}

function updateRemotePlayers(delta) {
  players.forEach((player, id) => {
    if (id === localPlayerId) return;
    const prevX = player.mesh.position.x;
    const prevZ = player.mesh.position.z;
    player.mesh.position.x += (player.x - player.mesh.position.x) * Math.min(1, delta * 12);
    player.mesh.position.y += ((player.y ?? GROUND_Y) - player.mesh.position.y) * Math.min(1, delta * 14);
    player.mesh.position.z += (player.z - player.mesh.position.z) * Math.min(1, delta * 12);
    const dx = player.mesh.position.x - prevX;
    const dz = player.mesh.position.z - prevZ;
    if (Math.hypot(dx, dz) > 0.0015) {
      player.targetYaw = Math.atan2(dx, dz);
    }
    finalizeRemoteMovement(player);
    rotatePlayerTowards(player, player.targetYaw ?? player.facingYaw ?? 0, delta, REMOTE_TURN_SPEED);
    playerSpeedFromDelta(player, prevX, prevZ, delta);
  });
}

function playerSpeedFromDelta(player, prevX, prevZ, delta, currentX, currentZ) {
  if (!player || delta <= 0) return;
  const nextX = Number.isFinite(currentX) ? currentX : player.mesh.position.x;
  const nextZ = Number.isFinite(currentZ) ? currentZ : player.mesh.position.z;
  const distance = Math.hypot(nextX - prevX, nextZ - prevZ);
  const speed = distance / delta;
  player.animSpeed = THREE.MathUtils.clamp(speed / 8, 0, 1);
}

function updateNameTags() {
  const viewportX = window.innerWidth * 0.5;
  const viewportY = window.innerHeight * 0.5;
  const now = Date.now();
  const TAG_WORLD_OFFSET_Y = 3.25;
  const BUBBLE_PIXEL_GAP = 30;

  players.forEach((player) => {
    if (!player.label) return;

    const position = _nameTagWorldPos.copy(player.mesh.position);
    position.y += TAG_WORLD_OFFSET_Y;
    position.project(camera);

    const isVisible =
      position.z > -1 &&
      position.z < 1 &&
      Math.abs(position.x) < 1.2 &&
      Math.abs(position.y) < 1.2;

    if (!isVisible) {
      player.label.style.display = 'none';
      if (player.bubble) {
        player.bubble.style.display = 'none';
      }
      return;
    }

    player.label.style.display = 'block';
    player.label.style.left = `${position.x * viewportX + viewportX}px`;
    player.label.style.top = `${-position.y * viewportY + viewportY}px`;

    if (!player.bubble) return;
    if (now > player.bubbleUntil) {
      player.bubble.style.display = 'none';
      return;
    }

    const msLeft = player.bubbleUntil - now;
    const alpha = Math.max(0, Math.min(1, msLeft / CHAT_BUBBLE_MS));
    player.bubble.style.display = 'block';
    player.bubble.style.opacity = `${alpha}`;
    player.bubble.style.left = `${position.x * viewportX + viewportX}px`;
    player.bubble.style.top = `${-position.y * viewportY + viewportY - BUBBLE_PIXEL_GAP}px`;
  });
}

function updateInteractionHint() {
  const local = players.get(localPlayerId);
  updateMobileUseButtonVisibility(local);
  if (!local) {
    interactHintEl.textContent = 'Explore the island';
    return;
  }
  if (mineWarningOpen) {
    interactHintEl.textContent = 'Review mine warning: OK, continue or Cancel';
    return;
  }

  if (boatState.onboard) {
    interactHintEl.textContent = 'Boat controls: W/S move, A/D steer, E to get off anywhere';
    return;
  }
  if (inHouseHall) {
    if (isNearHouseHallExit(local)) {
      interactHintEl.textContent = 'Press E at the marker to exit the house';
      return;
    }
    const hallDoor = getNearbyHouseHallDoor(local);
    if (hallDoor) {
      const claimedId = normalizeHomeRoomState(questState.homeRoom).roomId;
      if (claimedId === hallDoor.id) {
        interactHintEl.textContent = 'Press E to enter your room';
      } else if (claimedId) {
        interactHintEl.textContent = 'This room is already claimed';
      } else {
        interactHintEl.textContent = `Press E to claim Room ${hallDoor.id.split('-')[1]}`;
      }
      return;
    }
    const claimedId = normalizeHomeRoomState(questState.homeRoom).roomId;
    interactHintEl.textContent = claimedId
      ? 'Hallway: find your room to enter'
      : 'Hallway: choose an empty room to claim';
    return;
  }
  if (inHouseRoom) {
    if (isNearHouseRoomExit(local)) {
      interactHintEl.textContent = 'Press E at the marker to return to the hall';
      return;
    }
    if (isNearHouseWorkshop(local)) {
      interactHintEl.textContent = 'Press E to open home workshop';
      return;
    }
    interactHintEl.textContent = 'Your Room: use Workshop marker to place furniture and paint';
    return;
  }
  if (inFishingShop) {
    if (isNearFishingShopExit(local)) {
      interactHintEl.textContent = 'Press E at the door to exit';
    } else {
      interactHintEl.textContent = 'Press E at the counter to browse fishing rods';
    }
    return;
  }
  if (inMarketShop) {
    if (isNearMarketShopExit(local)) {
      interactHintEl.textContent = 'Press E at the door to exit';
    } else {
      interactHintEl.textContent = 'Press E at the counter to sell fish or manage quests';
    }
    return;
  }
  if (inFurnitureShop) {
    if (isNearFurnitureShopExit(local)) {
      interactHintEl.textContent = 'Press E at the door to exit';
    } else {
      interactHintEl.textContent = 'Press E at the counter to browse furniture';
    }
    return;
  }
  if (inMine) {
    if (miningAccuracyGame.active) {
      interactHintEl.textContent = 'Mining minigame: click/tap or press E/Space in green';
      return;
    }
    if (distance2D(local, MINE_EXIT_POS) < 3.1) {
      interactHintEl.textContent = 'Press E at the glowing marker to exit mine';
      return;
    }
    if (isNearMineCrystal(local)) {
      interactHintEl.textContent = 'Press E at the crystal to return to mine entrance';
      return;
    }
    if (distance2D(local, QUEST_NPC_POS) < 3.4) {
      const quest = questState.quest;
      if (quest?.status === 'ready') {
        interactHintEl.textContent = 'Press E to talk to Quest Giver (reward ready)';
      } else {
        interactHintEl.textContent = 'Press E to talk to Quest Giver';
      }
      return;
    }
    if (distance2D(local, MINE_SHOP_NPC_POS) < 3.2) {
      interactHintEl.textContent = 'Press E to talk to Mine Merchant';
      return;
    }
    if (distance2D(local, MINE_ORE_TRADER_POS) < 3.2) {
      interactHintEl.textContent = 'Press E to talk to Ore Trader';
      return;
    }
    if (getNearbyOreNode(local)) {
      interactHintEl.textContent = 'Press E/Space or left-click to start mining minigame';
      return;
    }
    interactHintEl.textContent = 'Mine ore, sell at Ore Trader, and return to Quest Giver';
    return;
  }
  const swimHint = surfaceHintOverride(local);
  if (swimHint) {
    interactHintEl.textContent = swimHint;
    return;
  }
  if (fishingMiniGame.active) {
    interactHintEl.textContent = 'Fishing minigame: hold click/touch/E/Space to move right, release to drift left';
    return;
  }
  if (isNearFishingVendor(local)) {
    interactHintEl.textContent = 'Press E to open Fishing Rod upgrades';
    return;
  }
  if (isNearFishMarket(local)) {
    interactHintEl.textContent = 'Press E to open Market quests and selling';
    return;
  }
  if (isNearFurnitureVendor(local)) {
    interactHintEl.textContent = 'Press E to browse rotating furniture stock';
    return;
  }
  if (!inMine && nearestFishingSpot(local)) {
    interactHintEl.textContent = questState.hasFishingRod
      ? 'Press E/Space to cast line at this fishing spot'
      : 'Need fishing rod to fish at these islands';
    return;
  }
  if (distance2D(local, MINE_ENTRY_POS) < 2.45) {
    interactHintEl.textContent = 'Walk into the mine entrance to enter';
    return;
  }
  if (distance2D(local, HOUSE_DOOR_POS) < 2.6) {
    interactHintEl.textContent = 'Walk through the house door to enter the hall';
    return;
  }
  if (distance2D(local, QUEST_NPC_POS) < 3.4) {
    const quest = questState.quest;
    if (quest?.status === 'ready') {
      interactHintEl.textContent = 'Press E to talk to Quest Giver (reward ready)';
    } else {
      interactHintEl.textContent = 'Press E to talk to Quest Giver';
    }
    return;
  }
  if (inLighthouseInterior) {
    if (distance2D(local, INTERIOR_EXIT_PORTAL_POS) < 3.1) {
      interactHintEl.textContent = 'Press E at the glowing marker to go to lighthouse top';
      return;
    }
    interactHintEl.textContent = 'Climb the stairs to the glowing marker at the top';
    return;
  }
  if (distance2D(local, LIGHTHOUSE_TOP_POS) < 1.35 && local.y > 11.6) {
    interactHintEl.textContent = 'Press E at the portal to go back inside lighthouse';
    return;
  }
  if (distance2D(local, LIGHTHOUSE_DOOR_POS) < 2.6) {
    interactHintEl.textContent = 'Walk through the lighthouse door to enter';
    return;
  }
  if (distance2D(local, LEADERBOARD_ISLAND_POS) < LEADERBOARD_ISLAND_RADIUS - 2.1) {
    interactHintEl.textContent = 'Leaderboard Island: top players are shown on the board';
    return;
  }
  if (
    distance2D(local, ISLAND_DOCK_POS) < 6
    || distance2D(local, LIGHTHOUSE_DOCK_POS) < 6
    || distance2D(local, MINE_ENTRY_DOCK_POS) < 6
    || distance2D(local, FISHING_DOCK_POS) < 6
    || distance2D(local, MARKET_DOCK_POS) < 6
    || distance2D(local, FURNITURE_DOCK_POS) < 6
    || distance2D(local, LEADERBOARD_DOCK_POS) < 6
  ) {
    interactHintEl.textContent = 'Press E to board boat';
    return;
  }
  const beacon = interactables.get('beacon');
  if (beacon && Math.hypot(local.x - beacon.x, local.z - beacon.z) <= 4.2) {
    interactHintEl.textContent = 'Press E to toggle beacon';
    return;
  }
  interactHintEl.textContent = 'Use the dock boat to reach islands';
}

function headingText() {
  const degrees = ((THREE.MathUtils.radToDeg(cameraYaw) % 360) + 360) % 360;
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return `${labels[index]} (${Math.round(degrees)}deg)`;
}

function drawMinimap() {
  if (!minimapEnabled || !minimapEl || !minimapCtx) return;
  const size = minimapEl.width;
  const center = size / 2;
  const radius = center - 8;
  const simplifiedMinimap = lowPerformanceMode;

  minimapCtx.clearRect(0, 0, size, size);
  minimapCtx.fillStyle = '#1f4564';
  minimapCtx.beginPath();
  minimapCtx.arc(center, center, radius + 2, 0, Math.PI * 2);
  minimapCtx.fill();

  minimapCtx.fillStyle = '#638852';
  minimapCtx.beginPath();
  minimapCtx.arc(center, center, radius * 0.72, 0, Math.PI * 2);
  minimapCtx.fill();

  minimapCtx.strokeStyle = 'rgba(255,255,255,0.35)';
  minimapCtx.lineWidth = 1;
  minimapCtx.beginPath();
  minimapCtx.arc(center, center, radius * 0.72, 0, Math.PI * 2);
  minimapCtx.stroke();

  const scale = (radius * 0.72) / worldLimit;

  const beacon = interactables.get('beacon');
  if (beacon) {
    minimapCtx.fillStyle = beacon.active ? '#fbbf24' : '#38bdf8';
    minimapCtx.beginPath();
    minimapCtx.arc(center + beacon.x * scale, center + beacon.z * scale, 4, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  if (!simplifiedMinimap) {
    minimapCtx.fillStyle = '#f97316';
    minimapCtx.beginPath();
    minimapCtx.arc(center + ISLAND_DOCK_POS.x * scale, center + ISLAND_DOCK_POS.z * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.beginPath();
    minimapCtx.arc(center + LIGHTHOUSE_DOCK_POS.x * scale, center + LIGHTHOUSE_DOCK_POS.z * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.beginPath();
    minimapCtx.arc(center + MINE_ENTRY_DOCK_POS.x * scale, center + MINE_ENTRY_DOCK_POS.z * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.beginPath();
    minimapCtx.arc(center + FISHING_DOCK_POS.x * scale, center + FISHING_DOCK_POS.z * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.beginPath();
    minimapCtx.arc(center + MARKET_DOCK_POS.x * scale, center + MARKET_DOCK_POS.z * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.beginPath();
    minimapCtx.arc(center + FURNITURE_DOCK_POS.x * scale, center + FURNITURE_DOCK_POS.z * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.beginPath();
    minimapCtx.arc(center + LEADERBOARD_DOCK_POS.x * scale, center + LEADERBOARD_DOCK_POS.z * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
  }
  minimapCtx.fillStyle = '#f8fafc';
  minimapCtx.beginPath();
  minimapCtx.arc(center + LIGHTHOUSE_POS.x * scale, center + LIGHTHOUSE_POS.z * scale, 4, 0, Math.PI * 2);
  minimapCtx.fill();

  if (!simplifiedMinimap) {
    minimapCtx.fillStyle = '#a855f7';
    minimapCtx.beginPath();
    minimapCtx.arc(center + QUEST_NPC_POS.x * scale, center + QUEST_NPC_POS.z * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.fillStyle = '#f59e0b';
    minimapCtx.beginPath();
    minimapCtx.arc(center + MINE_ORE_TRADER_POS.x * scale, center + MINE_ORE_TRADER_POS.z * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  minimapCtx.fillStyle = '#60a5fa';
  minimapCtx.beginPath();
  minimapCtx.arc(center + MINE_ENTRY_POS.x * scale, center + MINE_ENTRY_POS.z * scale, 3, 0, Math.PI * 2);
  minimapCtx.fill();
  minimapCtx.fillStyle = '#22d3ee';
  minimapCtx.beginPath();
  minimapCtx.arc(center + FISHING_ISLAND_POS.x * scale, center + FISHING_ISLAND_POS.z * scale, 3, 0, Math.PI * 2);
  minimapCtx.fill();
  minimapCtx.fillStyle = '#f59e0b';
  minimapCtx.beginPath();
  minimapCtx.arc(center + MARKET_ISLAND_POS.x * scale, center + MARKET_ISLAND_POS.z * scale, 3, 0, Math.PI * 2);
  minimapCtx.fill();
  minimapCtx.fillStyle = '#fb7185';
  minimapCtx.beginPath();
  minimapCtx.arc(center + FURNITURE_ISLAND_POS.x * scale, center + FURNITURE_ISLAND_POS.z * scale, 3, 0, Math.PI * 2);
  minimapCtx.fill();
  minimapCtx.fillStyle = '#a78bfa';
  minimapCtx.beginPath();
  minimapCtx.arc(center + LEADERBOARD_ISLAND_POS.x * scale, center + LEADERBOARD_ISLAND_POS.z * scale, 3, 0, Math.PI * 2);
  minimapCtx.fill();

  if (boatState.mesh) {
    minimapCtx.fillStyle = '#a16207';
    minimapCtx.beginPath();
    minimapCtx.arc(center + boatState.x * scale, center + boatState.z * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  players.forEach((player, id) => {
    if (simplifiedMinimap && id !== localPlayerId) return;
    minimapCtx.fillStyle = id === localPlayerId ? '#ffd166' : '#f8fafc';
    minimapCtx.beginPath();
    minimapCtx.arc(center + player.x * scale, center + player.z * scale, id === localPlayerId ? 4 : 3, 0, Math.PI * 2);
    minimapCtx.fill();
  });

  compassEl.textContent = `Heading: ${headingText()}`;
}

function updateMineVisuals(nowMs, delta) {
  const local = players.get(localPlayerId);
  const inMineView = Boolean(local) && Math.hypot(local.x - MINE_POS.x, local.z - MINE_POS.z) <= MINE_RADIUS + 6;
  if (mineGroup) mineGroup.visible = inMineView || inMine;
  if (mineExitMesh) {
    minePortalPulse += delta * 2.2;
    mineExitMesh.position.y = (MINE_EXIT_POS.y - MINE_POS.y) + 0.08 + Math.sin(minePortalPulse) * 0.06;
  }
  if (mineEntranceMesh) {
    mineEntranceMesh.rotation.y = MINE_ENTRY_YAW;
  }
  oreNodes.forEach((node) => {
    if (node.breaking) {
      const duration = Math.max(1, node.breakEndAt - node.breakStartAt);
      const t = THREE.MathUtils.clamp((nowMs - node.breakStartAt) / duration, 0, 1);
      node.mesh.rotation.y += delta * 8.6;
      node.mesh.rotation.x = Math.sin(t * Math.PI * 8) * (1 - t) * 0.32;
      node.mesh.rotation.z = Math.sin(t * Math.PI * 5.4) * (1 - t) * 0.18;
      const scale = (node.baseScale || 1) * (1 + t * 0.48);
      node.mesh.scale.setScalar(scale);
      node.mesh.position.y = (node.baseY || 1.86) + t * 0.32;
      if (t >= 1) {
        node.breaking = false;
        node.mesh.visible = false;
        node.mesh.rotation.x = 0;
        node.mesh.rotation.z = 0;
        node.mesh.scale.setScalar(node.baseScale || 1);
        node.mesh.position.y = node.baseY || 1.86;
      }
      return;
    }
    if (!node.mesh.visible && nowMs >= node.readyAt) {
      node.mesh.visible = true;
      node.mesh.scale.setScalar(node.baseScale || 1);
      node.mesh.rotation.x = 0;
      node.mesh.rotation.z = 0;
      node.mesh.position.y = node.baseY || 1.86;
    }
    if (node.mesh.visible) {
      node.mesh.rotation.y += delta * 0.9;
      node.mesh.position.y = (node.baseY || 1.86) + Math.sin(nowMs * 0.002 + node.mesh.position.x) * 0.06;
    }
  });
}

function updateHouseRoomVisuals(nowMs) {
   if (houseRoomGroup) {
     houseRoomGroup.visible = inHouseRoom;
   }
   if (houseHallGroup) {
     houseHallGroup.visible = inHouseHall;
   }
   if (fishingShopGroup) {
     fishingShopGroup.visible = inFishingShop;
   }
   if (marketShopGroup) {
     marketShopGroup.visible = inMarketShop;
   }
   if (furnitureShopGroup) {
     furnitureShopGroup.visible = inFurnitureShop;
   }
  if (houseRoomExitMarker) {
    houseRoomExitMarker.position.y = GROUND_Y + 0.02;
    const icon = houseRoomExitMarker.userData?.icon;
    const ring = houseRoomExitMarker.userData?.ring;
    const glow = houseRoomExitMarker.userData?.glow;
    if (icon) {
      icon.position.y = Math.sin(nowMs * 0.004 + 0.9) * 0.05;
      icon.rotation.y = Math.sin(nowMs * 0.0018 + 0.3) * 0.14;
    }
    if (ring) {
      ring.rotation.z = nowMs * 0.0008;
    }
    if (glow) {
      glow.intensity = 0.36 + (Math.sin(nowMs * 0.004 + 1.4) * 0.5 + 0.5) * 0.22;
    }
  }
  if (houseRoomWorkshopMarker) {
    houseRoomWorkshopMarker.position.y = GROUND_Y + 0.02;
    const icon = houseRoomWorkshopMarker.userData?.icon;
    const ring = houseRoomWorkshopMarker.userData?.ring;
    const glow = houseRoomWorkshopMarker.userData?.glow;
    if (icon) {
      icon.position.y = Math.sin(nowMs * 0.004 + 1.8) * 0.045;
      icon.rotation.y = -Math.sin(nowMs * 0.0019 + 0.8) * 0.14;
    }
    if (ring) {
      ring.rotation.z = -nowMs * 0.0009;
    }
    if (glow) {
      glow.intensity = 0.32 + (Math.sin(nowMs * 0.0042 + 2.1) * 0.5 + 0.5) * 0.2;
    }
  }
  if (houseHallExitMarker) {
    houseHallExitMarker.position.y = GROUND_Y + 0.05;
    houseHallExitMarker.rotation.z = nowMs * 0.001;
  }
  if (fishingShopExitMarker) {
    fishingShopExitMarker.rotation.z = -nowMs * 0.001;
    fishingShopExitMarker.position.y = GROUND_Y + 0.05 + Math.sin(nowMs * 0.003) * 0.03;
  }
  if (marketShopExitMarker) {
    marketShopExitMarker.rotation.z = -nowMs * 0.001;
    marketShopExitMarker.position.y = GROUND_Y + 0.05 + Math.sin(nowMs * 0.003 + 1.2) * 0.03;
  }
  if (furnitureShopExitMarker) {
    furnitureShopExitMarker.rotation.z = -nowMs * 0.001;
    furnitureShopExitMarker.position.y = GROUND_Y + 0.05 + Math.sin(nowMs * 0.003 + 2.1) * 0.03;
  }
  if (houseHallRoomDoors.length) {
    const spin = nowMs * 0.0012;
    houseHallRoomDoors.forEach((door) => {
      if (door.ring) {
        door.ring.rotation.z = spin;
        door.ring.position.y = GROUND_Y + 0.05 + Math.sin(nowMs * 0.003 + door.ring.position.x) * 0.04;
      }
    });
  }
}

const clock = new THREE.Clock();
// Throttle timestamps for expensive per-frame operations
let _lastMinimapDraw = 0;
let _lastNameTagUpdate = 0;
let _lastVoiceVolumeUpdate = 0;
let _lastWaterfallUpdate = 0;
let _waterfallAccumDelta = 0;
let _lastRemotePlayerUpdate = 0;
let _remotePlayerAccumDelta = 0;
function animate(nowMs) {
  const delta = clock.getDelta();
  const nowSeconds = nowMs / 1000;

  updateDayAndWeather(delta, nowSeconds);
  beaconCore.rotation.y += delta * 1.2;

  const beacon = interactables.get('beacon');
  if (beacon?.active) {
    beaconCore.position.y = 3.0 + Math.sin(nowMs * 0.004) * 0.12;
  } else {
    beaconCore.position.y += (3.0 - beaconCore.position.y) * Math.min(1, delta * 8);
  }
  updateBeaconIslandLights(Boolean(beacon?.active), delta);
  if (lighthouseInteriorPortal) {
    lighthouseInteriorPortal.rotation.y += delta * 0.7;
    lighthouseInteriorPortal.position.y = INTERIOR_EXIT_PORTAL_POS.y + Math.sin(nowMs * 0.0042) * 0.08;
  }
  if (lighthouseTopPortal) {
    lighthouseTopPortal.rotation.y += delta * 0.9;
    lighthouseTopPortal.position.y = 13.23 + Math.sin(nowMs * 0.005) * 0.06;
  }

  updateLocalPlayer(delta, nowMs);
  _remotePlayerAccumDelta += delta;
  if (remotePlayerUpdateIntervalMs <= 0 || nowMs - _lastRemotePlayerUpdate >= remotePlayerUpdateIntervalMs) {
    updateRemotePlayers(_remotePlayerAccumDelta);
    _remotePlayerAccumDelta = 0;
    _lastRemotePlayerUpdate = nowMs;
  }
  const localForMinigames = players.get(localPlayerId);
  updateFishingMinigame(localForMinigames, nowMs, delta);
  updateMiningAccuracyGame(localForMinigames, nowMs, delta);
  updateInteractionHint();
  updatePlayerEmotes(Date.now(), delta);
  if (nowMs - _lastVoiceVolumeUpdate >= voiceUpdateIntervalMs) {
    updateVoiceVolumes();
    _lastVoiceVolumeUpdate = nowMs;
  }
  if (!lowPerformanceMode) {
    _waterfallAccumDelta += delta;
    if (nowMs - _lastWaterfallUpdate >= waterfallUpdateIntervalMs) {
      updateCliffWaterfall(nowMs, _waterfallAccumDelta);
      _waterfallAccumDelta = 0;
      _lastWaterfallUpdate = nowMs;
    }
  } else {
    _waterfallAccumDelta = 0;
  }
  updateMineVisuals(nowMs, delta);
  updateHouseRoomVisuals(nowMs);
  updateLeaderboardBoard(nowMs);

  const local = players.get(localPlayerId);
  updateTorchLight(local, nowMs);
  if (local) {
    const fishingCameraLocked = updateFishingFocusCamera(local, delta);
    const miningCameraLocked = !fishingCameraLocked && updateMiningFocusCamera(local, delta);
    if (!fishingCameraLocked && !miningCameraLocked) {
      const headTrackY = local.y + (local.isSwimming ? 1.15 : 1.78);
      if (firstPersonEnabled) {
      local.mesh.visible = false;
      const eyeY = local.y + (local.isSwimming ? FIRST_PERSON_EYE_HEIGHT_SWIM : FIRST_PERSON_EYE_HEIGHT);
      const desiredX = local.x;
      const desiredY = eyeY;
      const desiredZ = local.z;
      const lookDistance = 8;
      const horizontalLook = Math.cos(cameraPitch) * lookDistance;
      const lookX = desiredX + Math.sin(cameraYaw) * horizontalLook;
      const lookY = desiredY + Math.sin(cameraPitch) * lookDistance;
      const lookZ = desiredZ + Math.cos(cameraYaw) * horizontalLook;

        camera.position.x += (desiredX - camera.position.x) * Math.min(1, delta * 14);
        camera.position.y += (desiredY - camera.position.y) * Math.min(1, delta * 14);
        camera.position.z += (desiredZ - camera.position.z) * Math.min(1, delta * 14);
        camera.lookAt(lookX, lookY, lookZ);
      } else {
        local.mesh.visible = true;
        let activeCameraTarget = cameraDistanceTarget;
        if (inLighthouseInterior) {
          activeCameraTarget = Math.min(activeCameraTarget, 10.5);
        } else if (inHouseHall) {
          activeCameraTarget = Math.min(activeCameraTarget, 11.8);
        } else if (inHouseRoom) {
          activeCameraTarget = Math.min(activeCameraTarget, 9.8);
        } else if (inMine) {
          activeCameraTarget = Math.min(activeCameraTarget, MINE_CAMERA_MAX_DISTANCE);
        }
        cameraDistance += (activeCameraTarget - cameraDistance) * Math.min(1, delta * 10);
        if (inLighthouseInterior) {
          cameraDistance = Math.min(cameraDistance, 10.5);
          cameraDistanceTarget = activeCameraTarget;
        } else if (inHouseHall) {
          cameraDistance = Math.min(cameraDistance, 11.8);
          cameraDistanceTarget = activeCameraTarget;
        } else if (inHouseRoom) {
          cameraDistance = Math.min(cameraDistance, 9.8);
          cameraDistanceTarget = activeCameraTarget;
        } else if (inMine) {
          cameraDistance = Math.min(cameraDistance, MINE_CAMERA_MAX_DISTANCE);
          cameraDistanceTarget = activeCameraTarget;
        }

        const horizontal = Math.cos(cameraPitch) * cameraDistance;
        const offsetX = Math.sin(cameraYaw) * horizontal;
        const offsetY = Math.sin(cameraPitch) * cameraDistance;
        const offsetZ = Math.cos(cameraYaw) * horizontal;
        let desiredX = local.x + offsetX;
        let desiredY = headTrackY + offsetY;
        let desiredZ = local.z + offsetZ;
        if (inLighthouseInterior) {
          const camRadius = INTERIOR_PLAY_RADIUS - 1.35;
          const cdx = desiredX - LIGHTHOUSE_INTERIOR_BASE.x;
          const cdz = desiredZ - LIGHTHOUSE_INTERIOR_BASE.z;
          const clen = Math.hypot(cdx, cdz);
          if (clen > camRadius) {
            const scale = camRadius / (clen || 1);
            desiredX = LIGHTHOUSE_INTERIOR_BASE.x + cdx * scale;
            desiredZ = LIGHTHOUSE_INTERIOR_BASE.z + cdz * scale;
          }
        } else if (inHouseHall) {
          const camRadius = HOUSE_HALL_PLAY_RADIUS - 1.35;
          const cdx = desiredX - HOUSE_HALL_BASE.x;
          const cdz = desiredZ - HOUSE_HALL_BASE.z;
          const clen = Math.hypot(cdx, cdz);
          if (clen > camRadius) {
            const scale = camRadius / (clen || 1);
            desiredX = HOUSE_HALL_BASE.x + cdx * scale;
            desiredZ = HOUSE_HALL_BASE.z + cdz * scale;
          }
          desiredY = Math.min(desiredY, GROUND_Y + 4.4);
        } else if (inHouseRoom) {
          const camRadius = HOUSE_ROOM_PLAY_RADIUS - 1.25;
          const cdx = desiredX - HOUSE_ROOM_BASE.x;
          const cdz = desiredZ - HOUSE_ROOM_BASE.z;
          const clen = Math.hypot(cdx, cdz);
          if (clen > camRadius) {
            const scale = camRadius / (clen || 1);
            desiredX = HOUSE_ROOM_BASE.x + cdx * scale;
            desiredZ = HOUSE_ROOM_BASE.z + cdz * scale;
          }
          desiredY = Math.min(desiredY, GROUND_Y + 4.25);
        } else if (inMine) {
          const camRadius = MINE_PLAY_RADIUS - 1.9;
          const cdx = desiredX - MINE_POS.x;
          const cdz = desiredZ - MINE_POS.z;
          const clen = Math.hypot(cdx, cdz);
          if (clen > camRadius) {
            const scale = camRadius / (clen || 1);
            desiredX = MINE_POS.x + cdx * scale;
            desiredZ = MINE_POS.z + cdz * scale;
          }
          desiredY = Math.min(desiredY, MINE_CEILING_Y - 1.1);
        }

        camera.position.x += (desiredX - camera.position.x) * Math.min(1, delta * 10);
        camera.position.y += (desiredY - camera.position.y) * Math.min(1, delta * 10);
        camera.position.z += (desiredZ - camera.position.z) * Math.min(1, delta * 10);
        camera.lookAt(local.x, headTrackY - (local.isSwimming ? 0.2 : 0.05), local.z);
      }
    }
  }

  // Name tags: update interval scales with the active performance profile.
  if (nowMs - _lastNameTagUpdate >= nameTagUpdateIntervalMs) {
    updateNameTags();
    _lastNameTagUpdate = nowMs;
  }
  // Minimap: redraw interval scales with the active performance profile.
  if (nowMs - _lastMinimapDraw >= minimapDrawIntervalMs) {
    drawMinimap();
    _lastMinimapDraw = nowMs;
  }
  renderer.render(scene, camera);
  renderPreview();
  requestAnimationFrame(animate);
}

updateHud();
requestAnimationFrame(animate);
