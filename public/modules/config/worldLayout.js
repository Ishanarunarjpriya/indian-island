let THREE_REF = null;
let HOUSE_HALL_BASE_REF = null;
let HOUSE_HALL_PLAY_RADIUS_REF = 0;
let getHouseRoomSlotCount = () => 6;

export function initWorldLayout({ getCurrentHouseRoomSlotCount } = {}) {
  if (typeof getCurrentHouseRoomSlotCount === 'function') {
    getHouseRoomSlotCount = getCurrentHouseRoomSlotCount;
  }
}

export function getHallPlayRadius() {
  const rowCount = Math.ceil(Math.max(1, getHouseRoomSlotCount()) / 2);
  const hallD = Math.max(24.0, rowCount * 7.0 + 10.0);
  return Math.max(HOUSE_HALL_PLAY_RADIUS_REF, hallD * 0.5 + 2);
}

export function getHallExitPos() {
  const rowCount = Math.ceil(Math.max(1, getHouseRoomSlotCount()) / 2);
  const hallD = Math.max(24.0, rowCount * 7.0 + 10.0);
  const exitZ = HOUSE_HALL_BASE_REF.z + hallD * 0.5 - 1.5;
  return new THREE_REF.Vector3(HOUSE_HALL_BASE_REF.x, 1.36, exitZ);
}

export function createWorldLayout(THREE, worldLimit) {
  THREE_REF = THREE;

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
  HOUSE_HALL_BASE_REF = HOUSE_HALL_BASE;
  HOUSE_HALL_PLAY_RADIUS_REF = HOUSE_HALL_PLAY_RADIUS;
  const HOUSE_HALL_ENTRY_POS = new THREE.Vector3(HOUSE_HALL_BASE.x, 1.36, HOUSE_HALL_BASE.z + 5.8);
  const HOUSE_HALL_EXIT_POS = new THREE.Vector3(HOUSE_HALL_BASE.x, 1.36, HOUSE_HALL_BASE.z + 7.8);
  const HOUSE_HALL_EXIT_INTERACT_RADIUS = 3.05;
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
  const ARENA_GATEWAY_ISLAND_POS = new THREE.Vector3(-43.37, 0, 110.14);
  const ARENA_GATEWAY_ISLAND_RADIUS = 12.6;
  const ARENA_QUEUE_HUB_POS = new THREE.Vector3(-172, 0, 164);
  const ARENA_QUEUE_HUB_RADIUS = 20.5;
  const ARENA_COMBAT_POS = new THREE.Vector3(-236, 0, 164);
  const ARENA_COMBAT_RADIUS = 26.5;
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
  const MINE_ENTRY_YAW = Math.atan2(MINE_ENTRY_DOCK_POS.x - MINE_ENTRY_POS.x, MINE_ENTRY_DOCK_POS.z - MINE_ENTRY_POS.z);

  return {
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
    ARENA_GATEWAY_ISLAND_POS,
    ARENA_GATEWAY_ISLAND_RADIUS,
    ARENA_QUEUE_HUB_POS,
    ARENA_QUEUE_HUB_RADIUS,
    ARENA_COMBAT_POS,
    ARENA_COMBAT_RADIUS,
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
  };
}
