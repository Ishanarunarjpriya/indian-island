import { PLAYER_COMBAT } from './config.js';
import { ARENA_ITEM_CATALOG, STARTER_LOADOUT, STARTER_OWNED_ITEMS, getCatalogItem } from './catalog.js';

const HOTBAR_SIZE = 9;

function sanitizeOwnedItems(value) {
  const ids = Array.isArray(value) ? value : [];
  const owned = new Set(STARTER_OWNED_ITEMS);
  for (const id of ids) {
    if (getCatalogItem(id)) {
      owned.add(id);
    }
  }
  return Array.from(owned);
}

function sanitizeHotbar(value, ownedItems) {
  const input = Array.isArray(value) ? value.slice(0, HOTBAR_SIZE) : [];
  const hotbar = Array.from({ length: HOTBAR_SIZE }, (_, index) => {
    const itemId = input[index] || null;
    return itemId && ownedItems.includes(itemId) ? itemId : null;
  });
  if (!hotbar[0]) {
    hotbar[0] = 'rust_sword';
  }
  return hotbar;
}

function sanitizeConsumables(value) {
  const safe = value && typeof value === 'object' ? value : {};
  const consumables = {};
  for (const [itemId, amount] of Object.entries(safe)) {
    const item = getCatalogItem(itemId);
    if (!item || item.category !== 'consumable') {
      continue;
    }
    consumables[itemId] = Math.max(0, Math.floor(Number(amount) || 0));
  }
  return consumables;
}

function sanitizeUnlockedLoot(value, ownedItems) {
  const safe = Array.isArray(value) ? value : [];
  const unlocked = new Set(ownedItems);
  for (const itemId of safe) {
    if (getCatalogItem(itemId)) {
      unlocked.add(itemId);
    }
  }
  return Array.from(unlocked);
}

export function buildDefaultArenaProgress() {
  return {
    tokens: 0,
    ownedItems: STARTER_OWNED_ITEMS.slice(),
    hotbar: STARTER_LOADOUT.slice(),
    selectedSlot: 0,
    consumables: {},
    stats: {
      highestWave: 0,
      lifetimeKills: 0,
      matchesPlayed: 0,
      bossKills: 0,
    },
    unlockedLoot: STARTER_OWNED_ITEMS.slice(),
    health: PLAYER_COMBAT.maxHealth,
  };
}

export function sanitizeArenaProgress(value) {
  const safe = value && typeof value === 'object' ? value : {};
  const ownedItems = sanitizeOwnedItems(safe.ownedItems);
  const unlockedLoot = sanitizeUnlockedLoot(safe.unlockedLoot, ownedItems);
  return {
    tokens: Math.max(0, Math.floor(Number(safe.tokens) || 0)),
    ownedItems,
    hotbar: sanitizeHotbar(safe.hotbar, unlockedLoot),
    selectedSlot: Math.min(HOTBAR_SIZE - 1, Math.max(0, Math.floor(Number(safe.selectedSlot) || 0))),
    consumables: sanitizeConsumables(safe.consumables),
    stats: {
      highestWave: Math.max(0, Math.floor(Number(safe.stats?.highestWave) || 0)),
      lifetimeKills: Math.max(0, Math.floor(Number(safe.stats?.lifetimeKills) || 0)),
      matchesPlayed: Math.max(0, Math.floor(Number(safe.stats?.matchesPlayed) || 0)),
      bossKills: Math.max(0, Math.floor(Number(safe.stats?.bossKills) || 0)),
    },
    unlockedLoot,
    health: PLAYER_COMBAT.maxHealth,
  };
}

export function ensureArenaProgress(progress) {
  const safeProgress = progress && typeof progress === 'object' ? { ...progress } : {};
  safeProgress.arena = sanitizeArenaProgress(safeProgress.arena);
  return safeProgress;
}

export function snapshotArenaProgress(progress) {
  const arena = sanitizeArenaProgress(progress?.arena);
  return {
    tokens: arena.tokens,
    selectedSlot: arena.selectedSlot,
    ownedItems: arena.ownedItems.slice(),
    hotbar: arena.hotbar.slice(),
    consumables: { ...arena.consumables },
    stats: { ...arena.stats },
    unlockedLoot: arena.unlockedLoot.slice(),
    health: PLAYER_COMBAT.maxHealth,
    catalog: Object.values(ARENA_ITEM_CATALOG).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      slotType: item.slotType,
      rarity: item.rarity,
      price: item.price,
      description: item.description,
      color: item.color,
      icon: item.icon,
      shop: item.shop,
    })),
  };
}
