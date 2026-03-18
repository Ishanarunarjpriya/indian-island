import {
  PICKAXE_TIERS,
  FISHING_ROD_TIERS
} from '../config/gameData.js';

let FISH_RARITY_ORDER = [];
let FISH_BY_ID = new Map();

export function initFormatters({ fishRarityOrder = [], fishById = new Map() } = {}) {
  FISH_RARITY_ORDER = Array.isArray(fishRarityOrder) ? fishRarityOrder : [];
  FISH_BY_ID = fishById instanceof Map ? fishById : new Map();
}

export function normalizeAccountTag(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  return raw.slice(0, 24);
}

export function resolveAccountUsername(data) {
  if (!data) return '';
  const direct = typeof data.username === 'string' ? data.username.trim() : '';
  if (direct) return direct.toLowerCase();
  const profileId = typeof data.profileId === 'string' ? data.profileId.trim() : '';
  if (profileId.toLowerCase().startsWith('acct-')) {
    return profileId.slice(5).toLowerCase();
  }
  return '';
}

export function applyTaggedNameToElement(element, name, accountTag = null) {
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

export function displayNameWithTag(name, accountTag = null) {
  const base = String(name || '').trim() || 'Player';
  const tag = normalizeAccountTag(accountTag);
  return tag ? `[${tag}] ${base}` : base;
}

export function capitalizeWord(value) {
  const text = String(value || '');
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function normalizeFishRarity(value, fallback = 'common') {
  return FISH_RARITY_ORDER.includes(value) ? value : fallback;
}

export function sanitizeHexColor(value, fallback) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return fallback;
}

export function normalizeFishIndexMap(value) {
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

export function normalizeFishBagMap(value) {
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

export function normalizePickaxeTier(value, fallback = 'wood') {
  const tier = typeof value === 'string' ? value.toLowerCase() : '';
  return PICKAXE_TIERS.includes(tier) ? tier : fallback;
}

export function normalizeRodTier(value, fallback = 'basic') {
  const tier = typeof value === 'string' ? value.toLowerCase() : '';
  return FISHING_ROD_TIERS.includes(tier) ? tier : fallback;
}

export function hexToCss(value, fallback = '#9ca3af') {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const safe = Math.max(0, Math.min(0xffffff, Math.floor(num)));
  return `#${safe.toString(16).padStart(6, '0')}`;
}

export function formatRefreshCountdown(targetAt) {
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
