import { capitalizeWord } from '../utils/formatters.js';

let getHouseRoomIds = () => [];

export function initGameData({ getCurrentHouseRoomIds } = {}) {
  if (typeof getCurrentHouseRoomIds === 'function') {
    getHouseRoomIds = getCurrentHouseRoomIds;
  }
}

export const CHAT_BUBBLE_MS = 4500;
export const MINE_SWING_MS = 340;
export const MINE_TIMING_HIT_COOLDOWN_MS = 120;
export const MINE_TIMING_TIMEOUT_FALLBACK_MS = 5200;
export const MINE_MISS_RETRY_COOLDOWN_MS = 700;
export const MINE_TIMING_PROFILES = {
  stone: { speed: 0.9, zoneWidth: 0.3, timeoutMs: 5600 },
  iron: { speed: 1.16, zoneWidth: 0.23, timeoutMs: 5000 },
  gold: { speed: 1.42, zoneWidth: 0.17, timeoutMs: 4400 },
  diamond: { speed: 1.78, zoneWidth: 0.12, timeoutMs: 3800 }
};
export const MINE_REQUIRED_HITS = {
  stone: 1,
  iron: 2,
  gold: 3,
  diamond: 4
};
export const PICKAXE_ACCURACY_ZONE_MULTIPLIER = {
  wood: 1.0,
  stone: 1.14,
  iron: 1.3,
  diamond: 1.5
};
export const MINE_FOCUS_CAMERA_BACK = 3.15;
export const MINE_FOCUS_CAMERA_SIDE = 1.15;
export const MINE_FOCUS_CAMERA_HEIGHT = 2.4;
export const FISH_FOCUS_CAMERA_BACK = 2.95;
export const FISH_FOCUS_CAMERA_SIDE = 0.92;
export const FISH_FOCUS_CAMERA_HEIGHT = 2.15;
export const STAMINA_BASE_MAX = 100;
export const MAX_PLAYER_LEVEL = 60;
export const BASE_XP_TO_LEVEL = 110;
export const XP_PER_LEVEL_STEP = 35;
export const HOME_ROOM_PAINT_PRICE = 90;
export const HOME_ROOM_WALL_OPTIONS = {
  sand: { label: 'Sand', color: '#d9c4a3' },
  sky: { label: 'Sky', color: '#9ec4e8' },
  mint: { label: 'Mint', color: '#bde2c4' },
  slate: { label: 'Slate', color: '#9ca3af' },
  rose: { label: 'Rose', color: '#e9b6ba' }
};
export const HOME_ROOM_FLOOR_OPTIONS = {
  oak: { label: 'Oak', color: '#7d5a3a' },
  walnut: { label: 'Walnut', color: '#5d3f2a' },
  slate: { label: 'Slate Stone', color: '#6b7280' },
  pine: { label: 'Pine', color: '#a67c52' }
};
export const HOME_ROOM_FURNITURE_SHOP = {
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
export const HOME_ROOM_FURNITURE_ORDER = Object.keys(HOME_ROOM_FURNITURE_SHOP);

export function defaultFurnitureTraderItemState(itemId) {
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

export function defaultFurnitureTraderViewState() {
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

export function normalizeFurnitureTraderState(value) {
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

export function defaultHomeRoomState() {
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

export function normalizeHomeRoomState(value) {
  const base = defaultHomeRoomState();
  if (!value || typeof value !== 'object') return base;
  const roomIdRaw = typeof value.roomId === 'string' ? value.roomId.trim() : '';
  if (getHouseRoomIds().includes(roomIdRaw)) {
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

export function createDefaultQuestState() {
  return {
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
}

export const PICKAXE_TIERS = ['wood', 'stone', 'iron', 'diamond'];
export const PICKAXE_LEVEL_REQUIREMENT = { wood: 1, stone: 2, iron: 5, diamond: 9 };
export const PICKAXE_HEAD_COLORS = {
  wood: 0x8b5a2b,
  stone: 0x94a3b8,
  iron: 0xcbd5e1,
  diamond: 0x67e8f9
};
export const FISHING_ROD_ACCENT_COLORS = {
  basic: 0x9ca3af,
  reinforced: 0x34d399,
  expert: 0x60a5fa,
  master: 0xa78bfa,
  mythic: 0xfacc15
};
export const FISHING_ROD_LEVEL_REQUIREMENT = { basic: 1, reinforced: 4, expert: 7, master: 11, mythic: 15 };
export const ORE_RESOURCE_COLORS = {
  stone: 0x9ca3af,
  iron: 0xb45309,
  gold: 0xf59e0b,
  diamond: 0x22d3ee
};
export const FISHING_ROD_PRICE = 780;
export const ORE_SELL_PRICE = { stone: 2, iron: 8, gold: 22, diamond: 120 };
export const FISH_SELL_BY_RARITY = {
  common: 18,
  uncommon: 32,
  rare: 56,
  epic: 120,
  legendary: 320,
  mythic: 1500
};
export const FISH_CATCH_CARD_SHOW_MS = 2400;
export const FISH_RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const FISH_RARITY_COLORS = {
  common: '#cbd5e1',
  uncommon: '#86efac',
  rare: '#93c5fd',
  epic: '#c084fc',
  legendary: '#fcd34d',
  mythic: '#f472b6'
};
export const FISH_CATALOG = [
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
export const FISH_BY_ID = new Map(FISH_CATALOG.map((fish) => [fish.id, fish]));
export const FISH_CATALOG_SORTED = [...FISH_CATALOG].sort((a, b) => {
  const rarityGap = FISH_RARITY_ORDER.indexOf(a.rarity) - FISH_RARITY_ORDER.indexOf(b.rarity);
  if (rarityGap !== 0) return rarityGap;
  return a.name.localeCompare(b.name);
});
export const DEBUG_TAP_RESET_MS = 2500;
export const WORLD_CYCLE_MS = 240000;
export const WORLD_TIME_PRESETS = {
  day: 0.5,
  evening: 0.72,
  night: 0.9
};
export const FISHING_ROD_TIERS = ['basic', 'reinforced', 'expert', 'master', 'mythic'];
export const FISHING_ROD_TIER_LABEL = {
  basic: 'Basic Rod',
  reinforced: 'Reinforced Rod',
  expert: 'Expert Rod',
  master: 'Master Rod',
  mythic: 'Mythic Rod'
};
export const SELLABLE_ORE_ORDER = ['stone', 'iron', 'gold', 'diamond'];
