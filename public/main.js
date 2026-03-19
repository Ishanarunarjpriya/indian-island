import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import {
  initFormatters,
  normalizeAccountTag,
  resolveAccountUsername,
  applyTaggedNameToElement,
  displayNameWithTag,
  capitalizeWord,
  normalizeFishRarity,
  sanitizeHexColor,
  normalizeFishIndexMap,
  normalizeFishBagMap,
  hexToCss,
  formatRefreshCountdown
} from './modules/utils/formatters.js';
import {
  initGameData,
  CHAT_BUBBLE_MS,
  MINE_SWING_MS,
  MINE_TIMING_HIT_COOLDOWN_MS,
  MINE_TIMING_TIMEOUT_FALLBACK_MS,
  MINE_MISS_RETRY_COOLDOWN_MS,
  MINE_TIMING_PROFILES,
  MINE_REQUIRED_HITS,
  PICKAXE_ACCURACY_ZONE_MULTIPLIER,
  MINE_FOCUS_CAMERA_BACK,
  MINE_FOCUS_CAMERA_SIDE,
  MINE_FOCUS_CAMERA_HEIGHT,
  FISH_FOCUS_CAMERA_BACK,
  FISH_FOCUS_CAMERA_SIDE,
  FISH_FOCUS_CAMERA_HEIGHT,
  STAMINA_BASE_MAX,
  MAX_PLAYER_LEVEL,
  BASE_XP_TO_LEVEL,
  XP_PER_LEVEL_STEP,
  HOME_ROOM_PAINT_PRICE,
  HOME_ROOM_WALL_OPTIONS,
  HOME_ROOM_FLOOR_OPTIONS,
  HOME_ROOM_FURNITURE_SHOP,
  HOME_ROOM_FURNITURE_ORDER,
  defaultFurnitureTraderItemState,
  defaultFurnitureTraderViewState,
  normalizeFurnitureTraderState,
  defaultHomeRoomState,
  normalizeHomeRoomState,
  createDefaultQuestState,
  PICKAXE_TIERS,
  PICKAXE_LEVEL_REQUIREMENT,
  PICKAXE_HEAD_COLORS,
  FISHING_ROD_ACCENT_COLORS,
  FISHING_ROD_LEVEL_REQUIREMENT,
  ORE_RESOURCE_COLORS,
  FISHING_ROD_PRICE,
  ORE_SELL_PRICE,
  FISH_SELL_BY_RARITY,
  FISH_CATCH_CARD_SHOW_MS,
  FISH_RARITY_ORDER,
  FISH_RARITY_COLORS,
  FISH_CATALOG,
  FISH_BY_ID,
  FISH_CATALOG_SORTED,
  DEBUG_TAP_RESET_MS,
  WORLD_CYCLE_MS,
  WORLD_TIME_PRESETS,
  FISHING_ROD_TIERS,
  FISHING_ROD_TIER_LABEL,
  SELLABLE_ORE_ORDER
} from './modules/config/gameData.js';
import {
  initWorldLayout,
  createWorldLayout,
  getHallPlayRadius,
  getHallExitPos
} from './modules/config/worldLayout.js';
import {
  initCommonBuilders,
  createHouseWindow,
  createVendorShop,
  createMarketStall,
  addWoodHouse,
  addStoreBuilding,
  createVendorNpc,
  createVendorStall,
  makeTextSign
} from './modules/builders/common.js';
import {
  initEnvironmentBuilders,
  addBeaconIslandLights,
  updateBeaconIslandLights,
  mainIslandRadiusAtAngle,
  radialShape,
  addMainIslandTerrain,
  createWaterfallFlowTexture,
  createWaterfallMistTexture,
  addPalm,
  addBush,
  addGrassTuft,
  addFlowerPatch,
  addCliffAndWaterfall,
  populateMainIslandNature
} from './modules/builders/environment.js';
import {
  initLandmarkBuilders,
  dockOffsetPosition,
  findWaterSideSlot,
  dockSlots,
  nearestDockSlot,
  boatPoseForDock,
  addDock,
  drawLeaderboardBoardTexture,
  refreshLeaderboardBoard,
  updateLeaderboardBoard,
  addLighthouseIsland,
  addMineEntryIsland,
  addFishingIsland,
  addMarketIsland,
  addFurnitureIsland,
  addArenaIsland,
  addLeaderboardIsland,
  addBoat,
  addDecorBoat
} from './modules/builders/landmarks.js';
import {
  initInteriorBuilders,
  addLighthouseInterior,
  addMainHouseRoomInterior,
  addFishingShopInterior,
  addMarketShopInterior,
  addFurnitureShopInterior,
  addHouseHallInterior
} from './modules/builders/interiors.js';
import {
  initMineBuilders,
  addMineArea
} from './modules/builders/mine.js';
import {
  initPlayerMeshes,
  makeExactBaconMesh,
  createHeldPickaxeMesh,
  createHeldFishingRodMesh,
  createHeldTorchMesh,
  paintPlayer,
  applyHeldGearVisual,
  makePlayerMesh
} from './modules/render/playerMeshes.js';
import {
  initCustomizePreview,
  refreshItemCards,
  makePreviewMesh,
  ensurePreviewScene,
  updatePreviewAvatar,
  renderPreview,
  outfitStorageKey,
  saveOutfit,
  loadOutfit
} from './modules/ui/customizePreview.js';
import {
  initUiRenderers,
  renderFishIndex,
  renderFurnitureTraderModal,
  renderHomeModal,
  renderInventoryModal,
  renderRodShopModal,
  renderMarketModal,
  renderOreModal
} from './modules/ui/renderers.js';

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
let lastMineAt = 0;
let torchEquipped = false;
const questState = createDefaultQuestState();
let HOUSE_ROOM_SLOT_COUNT = 6;
let HOUSE_ROOM_IDS = Array.from({ length: HOUSE_ROOM_SLOT_COUNT }, (_, i) => `room-${i + 1}`);
let HOUSE_ROOM_OWNERS = {};
initGameData({
  getCurrentHouseRoomIds: () => HOUSE_ROOM_IDS
});
initWorldLayout({
  getCurrentHouseRoomSlotCount: () => HOUSE_ROOM_SLOT_COUNT
});
const {
  GROUND_Y,
  MINE_POS,
  MINE_RADIUS,
  MINE_PLAY_RADIUS,
  MINE_ROCK_WALL_RADIUS,
  MINE_CEILING_Y,
  MINE_CAMERA_MAX_DISTANCE,
  MINE_SWIM_BLOCK_RADIUS,
  HOUSE_POS,
  HOUSE_DOOR_POS,
  HOUSE_ROOM_BASE,
  HOUSE_ROOM_PLAY_RADIUS,
  HOUSE_ROOM_ENTRY_POS,
  HOUSE_ROOM_EXIT_POS,
  HOUSE_ROOM_WORKSHOP_POS,
  HOUSE_HALL_BASE,
  HOUSE_HALL_PLAY_RADIUS,
  HOUSE_HALL_ENTRY_POS,
  HOUSE_HALL_EXIT_POS,
  HOUSE_HALL_EXIT_INTERACT_RADIUS,
  HOUSE_DOOR_INTERACT_RADIUS,
  HOUSE_ROOM_EXIT_INTERACT_RADIUS,
  HOUSE_ROOM_WORKSHOP_INTERACT_RADIUS,
  MINE_ENTRY_ISLAND_POS,
  MINE_ENTRY_ISLAND_RADIUS,
  FISHING_ISLAND_POS,
  FISHING_ISLAND_RADIUS,
  MARKET_ISLAND_POS,
  MARKET_ISLAND_RADIUS,
  FURNITURE_ISLAND_POS,
  FURNITURE_ISLAND_RADIUS,
  LEADERBOARD_ISLAND_POS,
  LEADERBOARD_ISLAND_RADIUS,
  FISHING_SHOP_BASE,
  MARKET_SHOP_BASE,
  FURNITURE_SHOP_BASE,
  SHOP_INTERIOR_HALF_DEPTH,
  SHOP_INTERIOR_HALF_WIDTH,
  SHOP_INTERIOR_RADIUS,
  SHOP_COUNTER_BACK_OFFSET,
  SHOP_EXIT_OFFSET,
  SHOP_EXIT_INTERACT_RADIUS,
  FISHING_SHOP_COUNTER_POS,
  FISHING_SHOP_EXIT_POS,
  MARKET_SHOP_COUNTER_POS,
  MARKET_SHOP_EXIT_POS,
  FURNITURE_SHOP_COUNTER_POS,
  FURNITURE_SHOP_EXIT_POS,
  toMainFromMineEntryX,
  toMainFromMineEntryZ,
  toMainFromMineEntryLen,
  MINE_ENTRY_DOCK_POS,
  MINE_ENTRY_DOCK_YAW,
  toMainFromFishingX,
  toMainFromFishingZ,
  toMainFromFishingLen,
  FISHING_DOCK_POS,
  FISHING_DOCK_YAW,
  toMainFromMarketX,
  toMainFromMarketZ,
  toMainFromMarketLen,
  MARKET_DOCK_POS,
  MARKET_DOCK_YAW,
  toMainFromFurnitureX,
  toMainFromFurnitureZ,
  toMainFromFurnitureLen,
  FURNITURE_DOCK_POS,
  FURNITURE_DOCK_YAW,
  toMainFromLeaderboardX,
  toMainFromLeaderboardZ,
  toMainFromLeaderboardLen,
  LEADERBOARD_DOCK_POS,
  LEADERBOARD_DOCK_YAW,
  LEADERBOARD_BOARD_REFRESH_MS,
  LEADERBOARD_BOARD_ROW_LIMIT,
  MINE_ENTRY_POS,
  MINE_ENTRY_WARNING_PREF_KEY,
  MINE_EXIT_POS,
  MINE_CRYSTAL_INTERACT_RADIUS,
  QUEST_NPC_POS,
  MINE_SHOP_NPC_POS,
  MINE_ORE_TRADER_POS,
  VENDOR_STAND_Y,
  FISHING_VENDOR_POS,
  MARKET_VENDOR_POS,
  FURNITURE_VENDOR_POS,
  FISHING_SPOT_RADIUS,
  MINE_ENTRY_YAW
} = createWorldLayout(THREE, worldLimit);
initFormatters({
  fishRarityOrder: FISH_RARITY_ORDER,
  fishById: FISH_BY_ID
});

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
const previewState = {
  get previewScene() {
    return previewScene;
  },
  set previewScene(value) {
    previewScene = value;
  },
  get previewCamera() {
    return previewCamera;
  },
  set previewCamera(value) {
    previewCamera = value;
  },
  get previewRenderer() {
    return previewRenderer;
  },
  set previewRenderer(value) {
    previewRenderer = value;
  },
  get previewAvatar() {
    return previewAvatar;
  },
  set previewAvatar(value) {
    previewAvatar = value;
  },
  get previewLight() {
    return previewLight;
  },
  set previewLight(value) {
    previewLight = value;
  },
  get previewYaw() {
    return previewYaw;
  },
  set previewYaw(value) {
    previewYaw = value;
  },
  get previewPitch() {
    return previewPitch;
  },
  set previewPitch(value) {
    previewPitch = value;
  },
  get previewDistance() {
    return previewDistance;
  },
  set previewDistance(value) {
    previewDistance = value;
  },
  get previewAutoSpin() {
    return previewAutoSpin;
  },
  set previewAutoSpin(value) {
    previewAutoSpin = value;
  },
  get previewDragging() {
    return previewDragging;
  },
  set previewDragging(value) {
    previewDragging = value;
  },
  get previewPointerId() {
    return previewPointerId;
  },
  set previewPointerId(value) {
    previewPointerId = value;
  },
  get previewLastX() {
    return previewLastX;
  },
  set previewLastX(value) {
    previewLastX = value;
  },
  get previewLastY() {
    return previewLastY;
  },
  set previewLastY(value) {
    previewLastY = value;
  },
  get previewRenderWidth() {
    return previewRenderWidth;
  },
  set previewRenderWidth(value) {
    previewRenderWidth = value;
  },
  get previewRenderHeight() {
    return previewRenderHeight;
  },
  set previewRenderHeight(value) {
    previewRenderHeight = value;
  },
  get previewPixelRatioCap() {
    return previewPixelRatioCap;
  }
};
const customizePreviewRefs = {
  itemCards,
  selectedAccessories,
  hairStyleInputEl,
  faceStyleInputEl,
  customizePreviewEl,
  customizeModalEl,
  nameInputEl,
  skinInputEl,
  colorInputEl,
  pantsColorInputEl,
  shoesColorInputEl,
  hairColorInputEl,
  customizeStatusEl
};
const uiRendererRefs = {
  get inventoryViewTab() {
    return inventoryViewTab;
  },
  set inventoryViewTab(value) {
    inventoryViewTab = value;
  },
  fishIndexListEl,
  fishIndexSummaryEl,
  marketFishIndexSummaryEl,
  furnitureTraderListEl,
  homeWallSelectEl,
  homeFloorSelectEl,
  homeWallApplyEl,
  homeFloorApplyEl,
  homeFurnitureListEl,
  homeDoorToggleEl,
  homeStatusEl,
  inventoryListEl,
  inventoryTabOresEl,
  inventoryTabFishEl,
  rodCurrentTierEl,
  rodNextTierEl,
  rodUpgradeCostEl,
  rodUpgradeFishCostEl,
  rodBuyBtnEl,
  rodUpgradeBtnEl,
  questState,
  socket,
  rodShopSnapshot,
  FISH_CATALOG_SORTED,
  FISHING_ROD_PRICE,
  FISHING_ROD_LEVEL_REQUIREMENT,
  HOME_ROOM_WALL_OPTIONS,
  HOME_ROOM_FLOOR_OPTIONS,
  HOME_ROOM_PAINT_PRICE,
  HOME_ROOM_FURNITURE_ORDER,
  HOME_ROOM_FURNITURE_SHOP,
  discoveredFishCount,
  caughtFishCount,
  buildFishIconMarkup,
  capitalizeWord,
  normalizeFurnitureTraderState,
  normalizeHomeRoomState,
  normalizeRodTier,
  rodTierLabel,
  updateFurnitureTraderSummary,
  setFurnitureTraderStatus,
  applyProgressState,
  ensureHomePaintSelectOptions,
  setHomeStatus,
  applyHomeRoomVisuals,
  inventoryEntriesForTab,
  ownedFishCount,
  renderMarketSellOptions,
  renderMarketSellPreview,
  renderMarketQuestSection,
  renderOreSellOptions,
  renderOreSellPreview
};
initUiRenderers(uiRendererRefs);
const houseRoomContext = new Proxy({}, {
  has() {
    return true;
  },
  get(_target, prop) {
    if (typeof prop !== 'string') return undefined;
    try {
      return eval(prop);
    } catch {
      return undefined;
    }
  },
  set(_target, prop, value) {
    if (typeof prop !== 'string') return true;
    try {
      const __value__ = value;
      eval(`${prop} = __value__`);
    } catch {}
    return true;
  }
});

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

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, renderPixelRatioCap));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = graphicsPreset !== 'performance';
document.body.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = 'none';

initCustomizePreview({
  sceneRef: scene,
  makePlayerMeshRef: makePlayerMesh,
  paintPlayerRef: paintPlayer,
  normalizeAppearanceRef: normalizeAppearance,
  currentFormAppearanceRef: currentFormAppearance,
  refsRef: customizePreviewRefs,
  stateRef: previewState
});
initPlayerMeshes({
  sceneRef: scene,
  fishingMiniGameRef: fishingMiniGame,
  questStateRef: questState
});

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

const PLAYER_COLLISION_RADIUS = 0.46;
const worldColliders = [];
let cliffWaterfallRoot = null;
let cliffWaterfallFoam = null;
let cliffWaterfallState = null;
const waterfallWorldPos = new THREE.Vector3();
const waterfallToCamera = new THREE.Vector3();
const waterfallForward = new THREE.Vector3();
const waterfallWorldQuat = new THREE.Quaternion();

initEnvironmentBuilders({
  sceneRef: scene,
  addWorldColliderRef: addWorldCollider,
  addRockFootprintCollisionFromMeshRef: addRockFootprintCollisionFromMesh,
  getWorldLimitRef: () => worldLimit,
  beaconIslandLightsRef: beaconIslandLights,
  setCliffWaterfallRootRef: (value) => {
    cliffWaterfallRoot = value;
  },
  setCliffWaterfallFoamRef: (value) => {
    cliffWaterfallFoam = value;
  },
  setCliffWaterfallStateRef: (value) => {
    cliffWaterfallState = value;
  }
});

addMainIslandTerrain();

function addWorldCollider(x, z, radius, tag = 'solid') {
  worldColliders.push({ x, z, radius, tag });
}

function clearWorldCollidersByTag(tag) {
  for (let i = worldColliders.length - 1; i >= 0; i -= 1) {
    if (worldColliders[i].tag === tag) {
      worldColliders.splice(i, 1);
    }
  }
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

initCommonBuilders({
  sceneRef: scene,
  addWallCollisionFromMeshRef: addWallCollisionFromMesh
});

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
const interiorLayout = {
  GROUND_Y,
  LIGHTHOUSE_INTERIOR_BASE,
  INTERIOR_TOP_POS,
  INTERIOR_ENTRY_POS,
  INTERIOR_EXIT_PORTAL_POS,
  INTERIOR_STAIR_RADIUS,
  INTERIOR_STAIR_START_Y,
  INTERIOR_STAIR_RISE,
  INTERIOR_STAIR_ANGLE_STEP,
  INTERIOR_STAIR_STEPS,
  HOUSE_HALL_BASE,
  FISHING_SHOP_BASE,
  MARKET_SHOP_BASE,
  FURNITURE_SHOP_BASE,
  SHOP_INTERIOR_HALF_DEPTH,
  SHOP_INTERIOR_HALF_WIDTH,
  FISHING_SHOP_COUNTER_POS,
  MARKET_SHOP_COUNTER_POS,
  FURNITURE_SHOP_COUNTER_POS,
  FISHING_SHOP_EXIT_POS,
  MARKET_SHOP_EXIT_POS,
  FURNITURE_SHOP_EXIT_POS
};
const SWIM_MIN_RADIUS = worldLimit + 0.6;
const SWIM_MAX_RADIUS = worldLimit * 3.9;
const SWIM_SURFACE_Y = 0.38;
const SWIM_SINK_Y = -3.6;
let lighthouseInteriorGroup = null;
let lighthouseInteriorPortal = null;
let lighthouseTopPortal = null;
initInteriorBuilders({
  sceneRef: scene,
  addWorldColliderRef: addWorldCollider,
  addWallCollisionFromMeshRef: addWallCollisionFromMesh,
  setLighthouseInteriorPortalRef: (value) => {
    lighthouseInteriorPortal = value;
  },
  setLighthouseInteriorGroupRef: (value) => {
    lighthouseInteriorGroup = value;
  },
  setHouseHallGroupRef: (value) => {
    houseHallGroup = value;
  },
  setHouseHallExitMarkerRef: (value) => {
    houseHallExitMarker = value;
  },
  setFishingShopGroupRef: (value) => {
    fishingShopGroup = value;
  },
  setFishingShopExitMarkerRef: (value) => {
    fishingShopExitMarker = value;
  },
  setMarketShopGroupRef: (value) => {
    marketShopGroup = value;
  },
  setMarketShopExitMarkerRef: (value) => {
    marketShopExitMarker = value;
  },
  setFurnitureShopGroupRef: (value) => {
    furnitureShopGroup = value;
  },
  setFurnitureShopExitMarkerRef: (value) => {
    furnitureShopExitMarker = value;
  },
  houseHallRoomDoorsRef: houseHallRoomDoors,
  getHouseRoomSlotCountRef: () => HOUSE_ROOM_SLOT_COUNT,
  getHouseRoomIdsRef: () => HOUSE_ROOM_IDS,
  getRoomOwnersRef: () => HOUSE_ROOM_OWNERS,
  houseRoomContextRef: houseRoomContext,
  layoutRef: interiorLayout
});
initMineBuilders({
  sceneRef: scene,
  addWorldColliderRef: addWorldCollider,
  oreNodesRef: oreNodes,
  setQuestNpcMeshRef: (value) => {
    questNpcMesh = value;
  },
  setMineShopNpcMeshRef: (value) => {
    mineShopNpcMesh = value;
  },
  setMineEntranceMeshRef: (value) => {
    mineEntranceMesh = value;
  },
  setMineExitMeshRef: (value) => {
    mineExitMesh = value;
  },
  setMineCentralCrystalMeshRef: (value) => {
    mineCentralCrystalMesh = value;
  },
  setMineGroupRef: (value) => {
    mineGroup = value;
  },
  setMineOreTraderNpcMeshRef: (value) => {
    mineOreTraderNpcMesh = value;
  },
  layoutRef: {
    MINE_POS,
    MINE_RADIUS,
    MINE_CEILING_Y,
    MINE_ROCK_WALL_RADIUS,
    MINE_ENTRY_POS,
    MINE_ENTRY_YAW,
    MINE_EXIT_POS,
    QUEST_NPC_POS,
    MINE_SHOP_NPC_POS,
    MINE_ORE_TRADER_POS,
    VENDOR_STAND_Y
  }
});
let inLighthouseInterior = false;
let isTeleporting = false;
const TELEPORT_TRIGGER_COOLDOWN_MS = 900;
let teleportTriggerLockUntil = 0;
const dockWalkZones = [];

const landmarkLayout = {
  ISLAND_DOCK_POS,
  ISLAND_DOCK_YAW,
  LIGHTHOUSE_POS,
  LIGHTHOUSE_DOCK_POS,
  LIGHTHOUSE_DOCK_YAW,
  LIGHTHOUSE_DOOR_POS,
  MINE_ENTRY_DOCK_POS,
  MINE_ENTRY_DOCK_YAW,
  FISHING_DOCK_POS,
  FISHING_DOCK_YAW,
  MARKET_DOCK_POS,
  MARKET_DOCK_YAW,
  FURNITURE_DOCK_POS,
  FURNITURE_DOCK_YAW,
  LEADERBOARD_DOCK_POS,
  LEADERBOARD_DOCK_YAW,
  MINE_ENTRY_ISLAND_POS,
  MINE_ENTRY_ISLAND_RADIUS,
  FISHING_ISLAND_POS,
  FISHING_ISLAND_RADIUS,
  MARKET_ISLAND_POS,
  MARKET_ISLAND_RADIUS,
  FURNITURE_ISLAND_POS,
  FURNITURE_ISLAND_RADIUS,
  LEADERBOARD_ISLAND_POS,
  LEADERBOARD_ISLAND_RADIUS,
  FISHING_VENDOR_POS,
  MARKET_VENDOR_POS,
  FURNITURE_VENDOR_POS,
  VENDOR_STAND_Y,
  LEADERBOARD_BOARD_REFRESH_MS,
  LEADERBOARD_BOARD_ROW_LIMIT
};

const leaderboardBoardStateRef = {
  get canvas() {
    return leaderboardBoardCanvas;
  },
  set canvas(value) {
    leaderboardBoardCanvas = value;
  },
  get ctx() {
    return leaderboardBoardCtx;
  },
  set ctx(value) {
    leaderboardBoardCtx = value;
  },
  get texture() {
    return leaderboardBoardTexture;
  },
  set texture(value) {
    leaderboardBoardTexture = value;
  },
  get rows() {
    return leaderboardBoardRows;
  },
  set rows(value) {
    leaderboardBoardRows = value;
  },
  get needsRedraw() {
    return leaderboardBoardNeedsRedraw;
  },
  set needsRedraw(value) {
    leaderboardBoardNeedsRedraw = value;
  },
  get fetchInFlight() {
    return leaderboardBoardFetchInFlight;
  },
  set fetchInFlight(value) {
    leaderboardBoardFetchInFlight = value;
  },
  get lastFetchAt() {
    return leaderboardBoardLastFetchAt;
  },
  set lastFetchAt(value) {
    leaderboardBoardLastFetchAt = value;
  }
};

initLandmarkBuilders({
  sceneRef: scene,
  addWorldColliderRef: addWorldCollider,
  createVendorNpcRef: createVendorNpc,
  createVendorStallRef: createVendorStall,
  addStoreBuildingRef: addStoreBuilding,
  makeTextSignRef: makeTextSign,
  distance2DRef: distance2D,
  isWaterAtRef: isWaterAt,
  dockWalkZonesRef: dockWalkZones,
  fishingSpotsRef: fishingSpots,
  getBoatStateRef: () => boatState,
  setLighthouseTopPortalRef: (value) => {
    lighthouseTopPortal = value;
  },
  leaderboardStateRef: leaderboardBoardStateRef,
  layoutRef: landmarkLayout
});

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

function applyRoomConfig(config) {
  if (!config || !Array.isArray(config.roomIds)) return;
  const newSlotCount = Math.max(1, Math.floor(Number(config.slotCount) || config.roomIds.length));
  const newRoomIds = config.roomIds.filter((id) => typeof id === 'string' && id.trim());
  if (!newRoomIds.length) return;
  HOUSE_ROOM_SLOT_COUNT = newSlotCount;
  HOUSE_ROOM_IDS = newRoomIds;
  if (config.roomOwners && typeof config.roomOwners === 'object') {
    HOUSE_ROOM_OWNERS = config.roomOwners;
  }
  rebuildHouseHall();
}

function rebuildHouseHall() {
  if (houseHallGroup) {
    houseHallGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    scene.remove(houseHallGroup);
    houseHallGroup = null;
  }
  clearWorldCollidersByTag('house-hall');
  houseHallRoomDoors.length = 0;
  houseHallExitMarker = null;
  addHouseHallInterior();
}

socket.on('home:roomConfig', (payload) => {
  applyRoomConfig(payload || null);
});

socket.on('home:roomUpdate', (payload) => {
  if (payload?.roomId && payload.state) {
    socket.emit('home:requestRoomConfig');
  }
});

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
  addArenaIsland();
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
  const HOUSE_HALL_RADIUS = getHallPlayRadius();
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
  const onHouseHallLand = Math.hypot(dxHH, dzHH) <= getHallPlayRadius() + 1.4;
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
  const inHouseHallZone = Math.hypot(x - HOUSE_HALL_BASE.x, z - HOUSE_HALL_BASE.z) <= getHallPlayRadius();
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

let localEffectiveRoomId = function localEffectiveRoomId() {
  const claimedId = normalizeHomeRoomState(questState.homeRoom).roomId;
  return inHouseRoom && claimedId ? claimedId : null;
};

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

function normalizePickaxeTier(value, fallback = 'wood') {
  const tier = typeof value === 'string' ? value.toLowerCase() : '';
  return PICKAXE_TIERS.includes(tier) ? tier : fallback;
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
  return Boolean(local) && inHouseHall && distance2D(local, getHallExitPos()) <= HOUSE_HALL_EXIT_INTERACT_RADIUS;
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
      closeNpcDialogue();
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
    return { mode: 'world', label: 'Exit', caption: 'Tap', worldPos: getHallExitPos(), offsetY: 0.95 };
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
  const savedUser = localStorage.getItem('island_auth_username') || '';
  const savedPass = localStorage.getItem('island_auth_password') || '';
  if (savedUser && savedPass) {
    statusEl.textContent = 'Logging in...';
    if (authStatusEl) authStatusEl.textContent = 'Logging in...';
    let responded = false;
    const fallbackTimer = setTimeout(() => {
      if (!responded) {
        responded = true;
        setAuthModalOpen(true, 'Login timed out. Please try again.');
      }
    }, 6000);
    socket.emit('auth:login', { username: savedUser, password: savedPass }, (response) => {
      if (responded) return;
      responded = true;
      clearTimeout(fallbackTimer);
      if (!response?.ok) {
        setAuthModalOpen(true, response?.error || 'Auto-login failed. Please login again.');
      }
    });
  } else {
    setAuthModalOpen(true, 'Please login or create an account.');
  }
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
     inHouseHall = Math.hypot(local.x - HOUSE_HALL_BASE.x, local.z - HOUSE_HALL_BASE.z) <= getHallPlayRadius();
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
  if (payload.roomConfig) {
    applyRoomConfig(payload.roomConfig);
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
      closeNpcDialogue();
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
  return value;
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
          const camRadius = getHallPlayRadius() - 2.8;
          const cdx = desiredX - HOUSE_HALL_BASE.x;
          const cdz = desiredZ - HOUSE_HALL_BASE.z;
          const clen = Math.hypot(cdx, cdz);
          if (clen > camRadius) {
            const scale = camRadius / (clen || 1);
            desiredX = HOUSE_HALL_BASE.x + cdx * scale;
            desiredZ = HOUSE_HALL_BASE.z + cdz * scale;
          }
          desiredY = Math.min(desiredY, GROUND_Y + 3.8);
        } else if (inHouseRoom) {
          const camRadius = HOUSE_ROOM_PLAY_RADIUS - 2.8;
          const cdx = desiredX - HOUSE_ROOM_BASE.x;
          const cdz = desiredZ - HOUSE_ROOM_BASE.z;
          const clen = Math.hypot(cdx, cdz);
          if (clen > camRadius) {
            const scale = camRadius / (clen || 1);
            desiredX = HOUSE_ROOM_BASE.x + cdx * scale;
            desiredZ = HOUSE_ROOM_BASE.z + cdz * scale;
          }
          desiredY = Math.min(desiredY, GROUND_Y + 3.8);
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

// Arena client context bridge

const arenaState = { arenaState: null };

window.__indianIslandArenaContext = {
  getScene: () => scene,
  getCamera: () => camera,
  getRenderer: () => renderer,
  getSocket: () => socket,
  getLocalPlayer: () => players.get(localPlayerId),
  getLocalPlayerState: () => arenaState,
};
if (typeof localEffectiveRoomId === 'function') {
  const __arenaOriginalLocalEffectiveRoomId = localEffectiveRoomId;
  localEffectiveRoomId = function wrappedLocalEffectiveRoomId() {
    const arenaRoomId = arenaState.arenaState ? arenaState.arenaState.roomId : null;
    if (typeof arenaRoomId === 'string' && arenaRoomId.startsWith('arena:')) {
      return arenaRoomId;
    }
    return __arenaOriginalLocalEffectiveRoomId();
  };
}
