const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const ARENA_ITEM_CATALOG = Object.freeze({
  melee_rust_blade: Object.freeze({
    id: 'melee_rust_blade',
    name: 'Rust Blade',
    category: 'melee',
    tokenCost: 0,
    maxUpgradeLevel: 5,
    upgradeBaseCost: 24,
    upgradeCostStep: 20,
    icon: '⚔️',
    baseStats: Object.freeze({
      damage: 16,
      range: 2.1,
      cooldownMs: 620,
      critChance: 0.06,
      critMultiplier: 1.6,
    }),
  }),
  sword_iron_fang: Object.freeze({
    id: 'sword_iron_fang',
    name: 'Iron Fang',
    category: 'sword',
    tokenCost: 120,
    maxUpgradeLevel: 7,
    upgradeBaseCost: 48,
    upgradeCostStep: 28,
    icon: '🗡️',
    baseStats: Object.freeze({
      damage: 28,
      range: 2.5,
      cooldownMs: 560,
      critChance: 0.08,
      critMultiplier: 1.7,
    }),
  }),
  sword_storm_edge: Object.freeze({
    id: 'sword_storm_edge',
    name: 'Storm Edge',
    category: 'sword',
    tokenCost: 360,
    maxUpgradeLevel: 9,
    upgradeBaseCost: 86,
    upgradeCostStep: 44,
    icon: '⚡',
    baseStats: Object.freeze({
      damage: 42,
      range: 2.8,
      cooldownMs: 500,
      critChance: 0.11,
      critMultiplier: 1.85,
    }),
  }),
  melee_titan_hammer: Object.freeze({
    id: 'melee_titan_hammer',
    name: 'Titan Hammer',
    category: 'melee',
    tokenCost: 280,
    maxUpgradeLevel: 8,
    upgradeBaseCost: 74,
    upgradeCostStep: 36,
    icon: '🔨',
    baseStats: Object.freeze({
      damage: 52,
      range: 2.3,
      cooldownMs: 820,
      critChance: 0.05,
      critMultiplier: 2.05,
      splashRadius: 1.9,
      splashScale: 0.35,
    }),
  }),
  ability_fireburst: Object.freeze({
    id: 'ability_fireburst',
    name: 'Fireburst',
    category: 'ability',
    tokenCost: 240,
    maxUpgradeLevel: 7,
    upgradeBaseCost: 66,
    upgradeCostStep: 35,
    icon: '🔥',
    baseStats: Object.freeze({
      damage: 60,
      range: 5.4,
      cooldownMs: 4000,
      radius: 2.6,
      burnDamage: 10,
      burnTicks: 3,
      burnTickMs: 800,
    }),
  }),
  ability_frost_nova: Object.freeze({
    id: 'ability_frost_nova',
    name: 'Frost Nova',
    category: 'ability',
    tokenCost: 300,
    maxUpgradeLevel: 8,
    upgradeBaseCost: 82,
    upgradeCostStep: 44,
    icon: '❄️',
    baseStats: Object.freeze({
      damage: 42,
      range: 4.2,
      cooldownMs: 4800,
      radius: 3.2,
      slowRatio: 0.42,
      slowMs: 2800,
    }),
  }),
  ability_arc_dash: Object.freeze({
    id: 'ability_arc_dash',
    name: 'Arc Dash',
    category: 'ability',
    tokenCost: 220,
    maxUpgradeLevel: 7,
    upgradeBaseCost: 58,
    upgradeCostStep: 30,
    icon: '💨',
    baseStats: Object.freeze({
      damage: 34,
      range: 7.5,
      cooldownMs: 3600,
      dashDistance: 4.7,
    }),
  }),
});

export const STARTER_OWNED_ITEMS = Object.freeze(['melee_rust_blade']);
export const STARTER_LOADOUT = Object.freeze(['melee_rust_blade', null, null, null, null, null, null, null, null]);

export const PVP_SHOP_INVENTORY = Object.freeze([
  'sword_iron_fang',
  'melee_titan_hammer',
  'ability_arc_dash',
  'ability_fireburst',
  'ability_frost_nova',
  'sword_storm_edge',
]);

export const LOOT_TABLE = Object.freeze([
  { itemId: 'sword_iron_fang', rarity: 'rare', weight: 36 },
  { itemId: 'melee_titan_hammer', rarity: 'epic', weight: 20 },
  { itemId: 'ability_arc_dash', rarity: 'rare', weight: 30 },
  { itemId: 'ability_fireburst', rarity: 'epic', weight: 16 },
  { itemId: 'ability_frost_nova', rarity: 'epic', weight: 12 },
  { itemId: 'sword_storm_edge', rarity: 'legendary', weight: 6 },
]);

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function getCatalogItem(itemId) {
  return ARENA_ITEM_CATALOG[itemId] || null;
}

export function getItemUpgradeCost(itemId, currentLevel) {
  const item = getCatalogItem(itemId);
  if (!item) return null;
  const level = clampNumber(currentLevel, 0, item.maxUpgradeLevel);
  if (level >= item.maxUpgradeLevel) return null;
  const rawCost = item.upgradeBaseCost + (item.upgradeCostStep * level);
  return Math.max(1, Math.round(rawCost));
}

export function getUpgradedItemStats(itemId, upgradeLevel) {
  const item = getCatalogItem(itemId);
  if (!item) return null;
  const level = clampNumber(upgradeLevel, 0, item.maxUpgradeLevel);
  const scalar = 1 + (level * 0.13);
  const stats = { ...item.baseStats };
  if (Number.isFinite(stats.damage)) stats.damage = Math.round(stats.damage * scalar);
  if (Number.isFinite(stats.range)) stats.range = Number((stats.range + level * 0.04).toFixed(3));
  if (Number.isFinite(stats.cooldownMs)) stats.cooldownMs = Math.max(180, Math.round(stats.cooldownMs * (1 - level * 0.025)));
  if (Number.isFinite(stats.critChance)) stats.critChance = Number(Math.min(0.6, stats.critChance + level * 0.01).toFixed(4));
  if (Number.isFinite(stats.critMultiplier)) stats.critMultiplier = Number((stats.critMultiplier + level * 0.03).toFixed(3));
  if (Number.isFinite(stats.radius)) stats.radius = Number((stats.radius + level * 0.05).toFixed(3));
  if (Number.isFinite(stats.burnDamage)) stats.burnDamage = Math.round(stats.burnDamage * (1 + level * 0.1));
  if (Number.isFinite(stats.burnTicks)) stats.burnTicks = Math.round(stats.burnTicks + level * 0.08);
  if (Number.isFinite(stats.slowMs)) stats.slowMs = Math.round(stats.slowMs + level * 100);
  if (Number.isFinite(stats.splashRadius)) stats.splashRadius = Number((stats.splashRadius + level * 0.03).toFixed(3));
  if (Number.isFinite(stats.splashScale)) stats.splashScale = Number(Math.min(0.7, stats.splashScale + level * 0.02).toFixed(3));
  if (Number.isFinite(stats.dashDistance)) stats.dashDistance = Number((stats.dashDistance + level * 0.2).toFixed(3));
  return stats;
}

function rarityRank(rarity) {
  const idx = RARITY_ORDER.indexOf(rarity);
  return idx === -1 ? 0 : idx;
}

export function rollLoot(random = Math.random) {
  const total = LOOT_TABLE.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return null;
  let marker = random() * total;
  for (let i = 0; i < LOOT_TABLE.length; i += 1) {
    marker -= LOOT_TABLE[i].weight;
    if (marker <= 0) return LOOT_TABLE[i];
  }
  return LOOT_TABLE[LOOT_TABLE.length - 1] || null;
}

export function getShopInventory(progress = null) {
  const owned = new Set(Array.isArray(progress?.ownedItems) ? progress.ownedItems : []);
  const upgrades = progress && typeof progress.itemUpgrades === 'object' && progress.itemUpgrades
    ? progress.itemUpgrades
    : {};
  return PVP_SHOP_INVENTORY.map((itemId) => {
    const item = getCatalogItem(itemId);
    const level = clampNumber(Number(upgrades[itemId]) || 0, 0, item.maxUpgradeLevel);
    const nextUpgradeCost = getItemUpgradeCost(itemId, level);
    return {
      ...item,
      owned: owned.has(itemId),
      upgradeLevel: level,
      nextUpgradeCost,
      rarityRank: rarityRank(item.rarity || 'common'),
      upgradedStats: getUpgradedItemStats(itemId, level),
    };
  });
}
