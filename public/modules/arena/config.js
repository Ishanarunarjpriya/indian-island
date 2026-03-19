const WORLD = {
  gatewayCenter: { x: -43.37, y: 1.35, z: 110.14 },
  queueHubCenter: { x: -172, y: 1.25, z: 164 },
  combatCenter: { x: -236, y: 1.25, z: 164 },
  islandRadius: 18,
  gatewayInteractRadius: 4.2,
  queueHubInteractRadius: 28,
  queuePadJoinRadius: 2.9,
  queuePads: [
    { id: 'solo', label: 'SOLO', capacity: 1, offset: { x: -8.6, z: 6.2 } },
    { id: 'duo', label: 'DUO', capacity: 2, offset: { x: -2.85, z: 6.2 } },
    { id: 'trio', label: 'TRIO', capacity: 3, offset: { x: 2.85, z: 6.2 } },
    { id: 'squad', label: 'SQUAD', capacity: 4, offset: { x: 8.6, z: 6.2 } },
  ],
  stallOffset: { x: 0, y: 0.4, z: -6 },
};

export const ARENA_CLIENT_CONFIG = {
  gatewayCenter: WORLD.gatewayCenter,
  queueHubCenter: WORLD.queueHubCenter,
  combatCenter: WORLD.combatCenter,
  islandRadius: WORLD.islandRadius,
  gatewayInteractRadius: WORLD.gatewayInteractRadius,
  queueHubInteractRadius: WORLD.queueHubInteractRadius,
  queuePadJoinRadius: WORLD.queuePadJoinRadius,
  queuePads: WORLD.queuePads,
  stallOffset: WORLD.stallOffset,
  world: WORLD,
  ui: {
    accent: '#ff8a5b',
    accentAlt: '#56c6ff',
    panel: 'rgba(10, 18, 30, 0.88)',
    border: 'rgba(130, 196, 255, 0.28)',
  },
  hotbarSlots: 9,
};
