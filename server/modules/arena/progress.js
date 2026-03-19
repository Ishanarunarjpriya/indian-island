import {
  STARTER_LOADOUT,
  STARTER_OWNED_ITEMS,
  getCatalogItem,
  getItemUpgradeCost,
  getShopInventory,
} from './catalog.js';

const HOTBAR_SIZE = 9;

function normalizeOwnedItems(value) {
  const source = Array.isArray(value) ? value : STARTER_OWNED_ITEMS;
  const deduped = [];
  const seen = new Set();
  for (let i = 0; i < source.length; i += 1) {
    const itemId = typeof source[i] === 'string' ? source[i] : '';
    if (!itemId || seen.has(itemId) || !getCatalogItem(itemId)) continue;
    seen.add(itemId);
    deduped.push(itemId);
  }
  if (!seen.has('melee_rust_blade')) deduped.unshift('melee_rust_blade');
  return deduped;
}

function normalizeHotbar(value, ownedItems) {
  const owned = new Set(ownedItems);
  const source = Array.isArray(value) ? value.slice(0, HOTBAR_SIZE) : STARTER_LOADOUT.slice(0, HOTBAR_SIZE);
  while (source.length < HOTBAR_SIZE) source.push(null);
  for (let i = 0; i < source.length; i += 1) {
    const itemId = typeof source[i] === 'string' ? source[i] : null;
    source[i] = itemId && owned.has(itemId) ? itemId : null;
  }
  if (!source[0]) source[0] = 'melee_rust_blade';
  return source;
}

function normalizeUpgrades(value, ownedItems) {
  const source = value && typeof value === 'object' ? value : {};
  const owned = new Set(ownedItems);
  const normalized = {};
  Object.keys(source).forEach((itemId) => {
    if (!owned.has(itemId)) return;
    const item = getCatalogItem(itemId);
    if (!item) return;
    const requested = Number(source[itemId]);
    if (!Number.isFinite(requested)) return;
    const maxLevel = item.maxUpgradeLevel || 0;
    const level = Math.max(0, Math.min(maxLevel, Math.floor(requested)));
    if (level > 0) normalized[itemId] = level;
  });
  return normalized;
}

function normalizeArenaState(arena) {
  const state = arena && typeof arena === 'object' ? { ...arena } : {};
  const ownedItems = normalizeOwnedItems(state.ownedItems);
  const itemUpgrades = normalizeUpgrades(state.itemUpgrades, ownedItems);
  const hotbar = normalizeHotbar(state.hotbar, ownedItems);
  const selectedSlotRaw = Number(state.selectedSlot);
  const selectedSlot = Number.isInteger(selectedSlotRaw)
    ? Math.max(0, Math.min(HOTBAR_SIZE - 1, selectedSlotRaw))
    : 0;
  const tokensRaw = Number(state.tokens);
  const tokens = Number.isFinite(tokensRaw) ? Math.max(0, Math.floor(tokensRaw)) : 0;
  const earnedRaw = Number(state.lifetimeTokensEarned);
  const lifetimeTokensEarned = Number.isFinite(earnedRaw) ? Math.max(tokens, Math.floor(earnedRaw)) : tokens;
  const playedRaw = Number(state.matchesPlayed);
  const matchesPlayed = Number.isFinite(playedRaw) ? Math.max(0, Math.floor(playedRaw)) : 0;
  const wonRaw = Number(state.matchesWon);
  const matchesWon = Number.isFinite(wonRaw) ? Math.max(0, Math.floor(wonRaw)) : 0;
  return {
    tokens,
    ownedItems,
    itemUpgrades,
    hotbar,
    selectedSlot,
    lifetimeTokensEarned,
    matchesPlayed,
    matchesWon,
  };
}

export function buildDefaultArenaProgress() {
  return {
    arena: normalizeArenaState(null),
  };
}

export function sanitizeArenaProgress(progress) {
  const next = progress && typeof progress === 'object' ? { ...progress } : {};
  next.arena = normalizeArenaState(next.arena);
  return next;
}

export function ensureArenaProgress(progress) {
  return sanitizeArenaProgress(progress);
}

export function getArenaProgress(progress) {
  const sanitized = ensureArenaProgress(progress);
  return sanitized.arena;
}

export function snapshotArenaProgress(progress) {
  const arena = getArenaProgress(progress);
  return {
    tokens: arena.tokens,
    ownedItems: arena.ownedItems.slice(),
    itemUpgrades: { ...arena.itemUpgrades },
    hotbar: arena.hotbar.slice(),
    selectedSlot: arena.selectedSlot,
    lifetimeTokensEarned: arena.lifetimeTokensEarned,
    matchesPlayed: arena.matchesPlayed,
    matchesWon: arena.matchesWon,
    shopInventory: getShopInventory(arena),
  };
}

export function grantArenaTokens(progress, amount) {
  const sanitized = ensureArenaProgress(progress);
  const arena = sanitized.arena;
  const delta = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  arena.tokens += delta;
  arena.lifetimeTokensEarned = Math.max(arena.lifetimeTokensEarned, arena.tokens);
  return sanitized;
}

export function spendArenaTokens(progress, amount) {
  const sanitized = ensureArenaProgress(progress);
  const arena = sanitized.arena;
  const delta = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  if (arena.tokens < delta) return false;
  arena.tokens -= delta;
  return true;
}

export function ownArenaItem(progress, itemId) {
  const sanitized = ensureArenaProgress(progress);
  const arena = sanitized.arena;
  const item = getCatalogItem(itemId);
  if (!item) return false;
  if (!arena.ownedItems.includes(itemId)) arena.ownedItems.push(itemId);
  if (!arena.hotbar.includes(itemId)) {
    const freeSlot = arena.hotbar.findIndex((slot) => !slot);
    if (freeSlot >= 0) arena.hotbar[freeSlot] = itemId;
  }
  return true;
}

export function upgradeArenaItem(progress, itemId) {
  const sanitized = ensureArenaProgress(progress);
  const arena = sanitized.arena;
  if (!arena.ownedItems.includes(itemId)) return { ok: false, reason: 'not-owned' };
  const currentLevel = Number(arena.itemUpgrades[itemId]) || 0;
  const cost = getItemUpgradeCost(itemId, currentLevel);
  if (!Number.isFinite(cost)) return { ok: false, reason: 'maxed' };
  if (arena.tokens < cost) return { ok: false, reason: 'insufficient-tokens' };
  arena.tokens -= cost;
  arena.itemUpgrades[itemId] = currentLevel + 1;
  return { ok: true, cost, level: arena.itemUpgrades[itemId] };
}
