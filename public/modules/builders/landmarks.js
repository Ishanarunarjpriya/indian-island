import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

let scene = null;
let addWorldCollider = null;
let createVendorNpc = null;
let createVendorStall = null;
let addStoreBuilding = null;
let makeTextSign = null;
let distance2D = null;
let isWaterAt = null;
let dockWalkZones = null;
let fishingSpots = null;
let getBoatState = null;
let setLighthouseTopPortal = null;
let setLighthouseLight = null;
let leaderboardState = null;
let layout = null;

export function initLandmarkBuilders({
  sceneRef = null,
  addWorldColliderRef = null,
  createVendorNpcRef = null,
  createVendorStallRef = null,
  addStoreBuildingRef = null,
  makeTextSignRef = null,
  distance2DRef = null,
  isWaterAtRef = null,
  dockWalkZonesRef = null,
  fishingSpotsRef = null,
  getBoatStateRef = null,
  setLighthouseTopPortalRef = null,
  setLighthouseLightRef = null,
  leaderboardStateRef = null,
  layoutRef = null
} = {}) {
  scene = sceneRef;
  addWorldCollider = addWorldColliderRef;
  createVendorNpc = createVendorNpcRef;
  createVendorStall = createVendorStallRef;
  addStoreBuilding = addStoreBuildingRef;
  makeTextSign = makeTextSignRef;
  distance2D = distance2DRef;
  isWaterAt = isWaterAtRef;
  dockWalkZones = dockWalkZonesRef;
  fishingSpots = fishingSpotsRef;
  getBoatState = getBoatStateRef;
  setLighthouseTopPortal = setLighthouseTopPortalRef;
  setLighthouseLight = setLighthouseLightRef;
  leaderboardState = leaderboardStateRef;
  layout = layoutRef;
}

export function dockOffsetPosition(dock, yaw, forward = 0, side = 0) {
  const fX = Math.sin(yaw);
  const fZ = Math.cos(yaw);
  const rX = Math.cos(yaw);
  const rZ = -Math.sin(yaw);
  return {
    x: dock.x + fX * forward + rX * side,
    z: dock.z + fZ * forward + rZ * side
  };
}

export function findWaterSideSlot(dock, yaw, preferSide = 1, forward = 6.0, baseSide = 3.2) {
  for (const sideDir of [preferSide, -preferSide]) {
    for (let side = baseSide; side <= baseSide + 8; side += 0.5) {
      const pos = dockOffsetPosition(dock, yaw, forward, side * sideDir);
      if (isWaterAt(pos.x, pos.z)) return pos;
    }
  }
  return dockOffsetPosition(dock, yaw, forward, baseSide * preferSide);
}

export function dockSlots() {
  return [
    { dock: layout.ISLAND_DOCK_POS, yaw: layout.ISLAND_DOCK_YAW },
    { dock: layout.LIGHTHOUSE_DOCK_POS, yaw: layout.LIGHTHOUSE_DOCK_YAW },
    { dock: layout.MINE_ENTRY_DOCK_POS, yaw: layout.MINE_ENTRY_DOCK_YAW },
    { dock: layout.FISHING_DOCK_POS, yaw: layout.FISHING_DOCK_YAW },
    { dock: layout.MARKET_DOCK_POS, yaw: layout.MARKET_DOCK_YAW },
    { dock: layout.FURNITURE_DOCK_POS, yaw: layout.FURNITURE_DOCK_YAW },
    { dock: layout.LEADERBOARD_DOCK_POS, yaw: layout.LEADERBOARD_DOCK_YAW }
  ];
}

export function nearestDockSlot(point, maxDistance = Infinity) {
  let best = null;
  for (const slot of dockSlots()) {
    const dist = distance2D(point, slot.dock);
    if (dist <= maxDistance && (!best || dist < best.distance)) {
      best = { ...slot, distance: dist };
    }
  }
  return best;
}

export function boatPoseForDock(slot) {
  if (slot.dock === layout.ISLAND_DOCK_POS) {
    return { ...findWaterSideSlot(slot.dock, slot.yaw, 1, 6.0, 3.2), yaw: slot.yaw };
  }
  return { ...findWaterSideSlot(slot.dock, slot.yaw, 1, 5.0, 2.4), yaw: slot.yaw };
}

export function addDock(anchor, yaw = 0, options = {}) {
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

export function addLighthouseIsland() {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(12.5, 14.5, 3.0, 36),
    new THREE.MeshStandardMaterial({ color: 0x8b6a4c, roughness: 0.95 })
  );
  base.position.set(layout.LIGHTHOUSE_POS.x, -0.4, layout.LIGHTHOUSE_POS.z);
  base.receiveShadow = true;
  scene.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(10.8, 12.3, 1.3, 40),
    new THREE.MeshStandardMaterial({ color: 0x7ea35f, roughness: 0.9 })
  );
  top.position.set(layout.LIGHTHOUSE_POS.x, 1.35, layout.LIGHTHOUSE_POS.z);
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
  const doorCenterAngle = Math.atan2(
    layout.LIGHTHOUSE_DOOR_POS.x - layout.LIGHTHOUSE_POS.x,
    layout.LIGHTHOUSE_DOOR_POS.z - layout.LIGHTHOUSE_POS.z
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

  const lighthouseTopPortal = new THREE.Group();
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

  const lighthouseBeam = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 18, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfde68a,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  lighthouseBeam.position.y = 22;
  lighthouse.add(lighthouseBeam);

  const lighthouseBeamLight = new THREE.PointLight(0xfde68a, 0, 60, 1.5);
  lighthouseBeamLight.position.y = 14.5;
  lighthouse.add(lighthouseBeamLight);

  if (typeof setLighthouseLight === 'function') {
    setLighthouseLight({ beam: lighthouseBeam, light: lighthouseBeamLight });
  }

  lighthouse.position.set(layout.LIGHTHOUSE_POS.x, 0, layout.LIGHTHOUSE_POS.z);
  scene.add(lighthouse);
  setLighthouseTopPortal(lighthouseTopPortal);
}

export function addMineEntryIsland() {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(layout.MINE_ENTRY_ISLAND_RADIUS + 1.8, layout.MINE_ENTRY_ISLAND_RADIUS + 3.4, 3.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x8b6a4c, roughness: 0.95 })
  );
  base.position.set(layout.MINE_ENTRY_ISLAND_POS.x, -0.35, layout.MINE_ENTRY_ISLAND_POS.z);
  base.receiveShadow = true;
  scene.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(layout.MINE_ENTRY_ISLAND_RADIUS, layout.MINE_ENTRY_ISLAND_RADIUS + 1.2, 1.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x7ea35f, roughness: 0.9 })
  );
  top.position.set(layout.MINE_ENTRY_ISLAND_POS.x, 1.35, layout.MINE_ENTRY_ISLAND_POS.z);
  top.receiveShadow = true;
  scene.add(top);

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5f6470, roughness: 0.9 });
  const edgeRocks = 14;
  for (let i = 0; i < edgeRocks; i += 1) {
    const angle = (i / edgeRocks) * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1 + Math.random() * 0.5, 0), rockMat);
    const radius = layout.MINE_ENTRY_ISLAND_RADIUS - 0.9 + Math.random() * 1.7;
    rock.position.set(
      layout.MINE_ENTRY_ISLAND_POS.x + Math.cos(angle) * radius,
      1.8 + Math.random() * 1.0,
      layout.MINE_ENTRY_ISLAND_POS.z + Math.sin(angle) * radius
    );
    rock.scale.set(1 + Math.random() * 0.45, 1 + Math.random() * 0.5, 1 + Math.random() * 0.45);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }
}

export function addFishingIsland() {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(layout.FISHING_ISLAND_RADIUS + 1.8, layout.FISHING_ISLAND_RADIUS + 3.4, 3.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x8c6a4c, roughness: 0.94 })
  );
  base.position.set(layout.FISHING_ISLAND_POS.x, -0.35, layout.FISHING_ISLAND_POS.z);
  base.receiveShadow = true;
  scene.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(layout.FISHING_ISLAND_RADIUS, layout.FISHING_ISLAND_RADIUS + 1.1, 1.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x6f9b62, roughness: 0.9 })
  );
  top.position.set(layout.FISHING_ISLAND_POS.x, 1.35, layout.FISHING_ISLAND_POS.z);
  top.receiveShadow = true;
  scene.add(top);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(layout.FISHING_ISLAND_RADIUS - 1.2, layout.FISHING_ISLAND_RADIUS + 0.2, 38),
    new THREE.MeshStandardMaterial({ color: 0xc5a273, roughness: 0.94 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(layout.FISHING_ISLAND_POS.x, 1.38, layout.FISHING_ISLAND_POS.z);
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
  const fishingHouseYaw = Math.atan2(-layout.FISHING_VENDOR_POS.x, -layout.FISHING_VENDOR_POS.z);
  const fishingStoreOffset = 2.0;
  const fishingStoreX = layout.FISHING_VENDOR_POS.x - Math.sin(fishingHouseYaw) * fishingStoreOffset;
  const fishingStoreZ = layout.FISHING_VENDOR_POS.z - Math.cos(fishingHouseYaw) * fishingStoreOffset;
  addStoreBuilding(fishingStoreX, fishingStoreZ, fishingHouseYaw);
  vendor.position.set(0, layout.VENDOR_STAND_Y - 0.05, -1.0);
  stall.position.set(layout.FISHING_VENDOR_POS.x, 0, layout.FISHING_VENDOR_POS.z);
  stall.rotation.y = fishingHouseYaw;
  scene.add(stall);
  addWorldCollider(layout.FISHING_VENDOR_POS.x, layout.FISHING_VENDOR_POS.z, 1.04, 'npc');

  const spotDefs = [
    { id: 'fish-north', x: layout.FISHING_ISLAND_POS.x + 0.8, z: layout.FISHING_ISLAND_POS.z - (layout.FISHING_ISLAND_RADIUS + 0.65) },
    { id: 'fish-east', x: layout.FISHING_ISLAND_POS.x + (layout.FISHING_ISLAND_RADIUS + 0.55), z: layout.FISHING_ISLAND_POS.z + 0.9 },
    { id: 'fish-west', x: layout.FISHING_ISLAND_POS.x - (layout.FISHING_ISLAND_RADIUS + 0.48), z: layout.FISHING_ISLAND_POS.z - 0.6 }
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

export function addMarketIsland() {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(layout.MARKET_ISLAND_RADIUS + 1.8, layout.MARKET_ISLAND_RADIUS + 3.4, 3.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x8b6b4f, roughness: 0.95 })
  );
  base.position.set(layout.MARKET_ISLAND_POS.x, -0.35, layout.MARKET_ISLAND_POS.z);
  base.receiveShadow = true;
  scene.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(layout.MARKET_ISLAND_RADIUS, layout.MARKET_ISLAND_RADIUS + 1.1, 1.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x739a62, roughness: 0.9 })
  );
  top.position.set(layout.MARKET_ISLAND_POS.x, 1.35, layout.MARKET_ISLAND_POS.z);
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
  const marketHouseYaw = Math.atan2(-layout.MARKET_VENDOR_POS.x, -layout.MARKET_VENDOR_POS.z);
  const marketStoreOffset = 2.0;
  const marketStoreX = layout.MARKET_VENDOR_POS.x - Math.sin(marketHouseYaw) * marketStoreOffset;
  const marketStoreZ = layout.MARKET_VENDOR_POS.z - Math.cos(marketHouseYaw) * marketStoreOffset;
  addStoreBuilding(marketStoreX, marketStoreZ, marketHouseYaw);
  vendor.position.set(0, layout.VENDOR_STAND_Y - 0.05, -1.0);
  stall.position.set(layout.MARKET_VENDOR_POS.x, 0, layout.MARKET_VENDOR_POS.z);
  stall.rotation.y = marketHouseYaw;
  scene.add(stall);
  addWorldCollider(layout.MARKET_VENDOR_POS.x, layout.MARKET_VENDOR_POS.z, 1.04, 'npc');

  const spotDefs = [
    { id: 'market-fish-north', x: layout.MARKET_ISLAND_POS.x + 0.75, z: layout.MARKET_ISLAND_POS.z - (layout.MARKET_ISLAND_RADIUS + 0.62) },
    { id: 'market-fish-east', x: layout.MARKET_ISLAND_POS.x + (layout.MARKET_ISLAND_RADIUS + 0.56), z: layout.MARKET_ISLAND_POS.z + 0.55 },
    { id: 'market-fish-south', x: layout.MARKET_ISLAND_POS.x - 0.45, z: layout.MARKET_ISLAND_POS.z + (layout.MARKET_ISLAND_RADIUS + 0.58) }
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

export function addFurnitureIsland() {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(layout.FURNITURE_ISLAND_RADIUS + 1.8, layout.FURNITURE_ISLAND_RADIUS + 3.4, 3.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x8b6d52, roughness: 0.95 })
  );
  base.position.set(layout.FURNITURE_ISLAND_POS.x, -0.35, layout.FURNITURE_ISLAND_POS.z);
  base.receiveShadow = true;
  scene.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(layout.FURNITURE_ISLAND_RADIUS, layout.FURNITURE_ISLAND_RADIUS + 1.1, 1.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x7ca069, roughness: 0.9 })
  );
  top.position.set(layout.FURNITURE_ISLAND_POS.x, 1.35, layout.FURNITURE_ISLAND_POS.z);
  top.receiveShadow = true;
  scene.add(top);

  const accentRing = new THREE.Mesh(
    new THREE.RingGeometry(layout.FURNITURE_ISLAND_RADIUS - 1.1, layout.FURNITURE_ISLAND_RADIUS + 0.24, 40),
    new THREE.MeshStandardMaterial({ color: 0xd5b48d, roughness: 0.92 })
  );
  accentRing.rotation.x = -Math.PI / 2;
  accentRing.position.set(layout.FURNITURE_ISLAND_POS.x, 1.38, layout.FURNITURE_ISLAND_POS.z);
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
  const furnitureHouseYaw = Math.atan2(-layout.FURNITURE_VENDOR_POS.x, -layout.FURNITURE_VENDOR_POS.z);
  const furnitureStoreOffset = 2.0;
  const furnitureStoreX = layout.FURNITURE_VENDOR_POS.x - Math.sin(furnitureHouseYaw) * furnitureStoreOffset;
  const furnitureStoreZ = layout.FURNITURE_VENDOR_POS.z - Math.cos(furnitureHouseYaw) * furnitureStoreOffset;
  addStoreBuilding(furnitureStoreX, furnitureStoreZ, furnitureHouseYaw);
  vendor.position.set(0, layout.VENDOR_STAND_Y - 0.05, -1.0);
  stall.position.set(layout.FURNITURE_VENDOR_POS.x, 0, layout.FURNITURE_VENDOR_POS.z);
  stall.rotation.y = furnitureHouseYaw;
  scene.add(stall);
  addWorldCollider(layout.FURNITURE_VENDOR_POS.x, layout.FURNITURE_VENDOR_POS.z, 1.04, 'npc');
}

export function drawLeaderboardBoardTexture() {
  if (!leaderboardState.ctx || !leaderboardState.canvas || !leaderboardState.texture) return;
  const ctx = leaderboardState.ctx;
  const canvas = leaderboardState.canvas;
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

  const rows = Array.isArray(leaderboardState.rows) ? leaderboardState.rows.slice(0, layout.LEADERBOARD_BOARD_ROW_LIMIT) : [];
  if (!rows.length) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 38px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText('No leaderboard data yet', canvas.width * 0.5, canvas.height * 0.5);
    leaderboardState.texture.needsUpdate = true;
    leaderboardState.needsRedraw = false;
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

  leaderboardState.texture.needsUpdate = true;
  leaderboardState.needsRedraw = false;
}

export async function refreshLeaderboardBoard(force = false) {
  if (!leaderboardState.canvas) return;
  if (leaderboardState.fetchInFlight) return;
  const now = performance.now();
  if (!force && now - leaderboardState.lastFetchAt < layout.LEADERBOARD_BOARD_REFRESH_MS) return;
  leaderboardState.lastFetchAt = now;
  leaderboardState.fetchInFlight = true;
  try {
    const response = await fetch(`/leaderboard?limit=${layout.LEADERBOARD_BOARD_ROW_LIMIT}`, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    if (!payload?.ok || !Array.isArray(payload.rows)) return;
    leaderboardState.rows = payload.rows.map((row, index) => ({
      rank: Math.max(1, Math.floor(Number(row?.rank) || (index + 1))),
      name: typeof row?.name === 'string' && row.name.trim() ? row.name.trim() : 'Player',
      level: Math.max(1, Math.floor(Number(row?.level) || 1)),
      xp: Math.max(0, Math.floor(Number(row?.xp) || 0)),
      coins: Math.max(0, Math.floor(Number(row?.coins) || 0))
    }));
    leaderboardState.needsRedraw = true;
  } catch {
    // Keep last rendered board state if network fetch fails.
  } finally {
    leaderboardState.fetchInFlight = false;
  }
}

export function updateLeaderboardBoard(nowMs) {
  if (!leaderboardState.canvas) return;
  if (leaderboardState.needsRedraw) {
    drawLeaderboardBoardTexture();
  }
  if (nowMs - leaderboardState.lastFetchAt >= layout.LEADERBOARD_BOARD_REFRESH_MS) {
    void refreshLeaderboardBoard();
  }
}

export function addLeaderboardIsland() {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(layout.LEADERBOARD_ISLAND_RADIUS + 1.7, layout.LEADERBOARD_ISLAND_RADIUS + 3.3, 3.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x87684a, roughness: 0.95 })
  );
  base.position.set(layout.LEADERBOARD_ISLAND_POS.x, -0.35, layout.LEADERBOARD_ISLAND_POS.z);
  base.receiveShadow = true;
  scene.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(layout.LEADERBOARD_ISLAND_RADIUS, layout.LEADERBOARD_ISLAND_RADIUS + 1.1, 1.2, 34),
    new THREE.MeshStandardMaterial({ color: 0x6d945f, roughness: 0.9 })
  );
  top.position.set(layout.LEADERBOARD_ISLAND_POS.x, 1.35, layout.LEADERBOARD_ISLAND_POS.z);
  top.receiveShadow = true;
  scene.add(top);

  const accentRing = new THREE.Mesh(
    new THREE.RingGeometry(layout.LEADERBOARD_ISLAND_RADIUS - 1.2, layout.LEADERBOARD_ISLAND_RADIUS + 0.25, 42),
    new THREE.MeshStandardMaterial({ color: 0xc7a67b, roughness: 0.92 })
  );
  accentRing.rotation.x = -Math.PI / 2;
  accentRing.position.set(layout.LEADERBOARD_ISLAND_POS.x, 1.38, layout.LEADERBOARD_ISLAND_POS.z);
  accentRing.receiveShadow = true;
  scene.add(accentRing);

  leaderboardState.canvas = document.createElement('canvas');
  leaderboardState.canvas.width = 1024;
  leaderboardState.canvas.height = 768;
  leaderboardState.ctx = leaderboardState.canvas.getContext('2d');
  leaderboardState.texture = new THREE.CanvasTexture(leaderboardState.canvas);
  leaderboardState.texture.colorSpace = THREE.SRGBColorSpace;
  leaderboardState.texture.minFilter = THREE.LinearFilter;
  leaderboardState.texture.magFilter = THREE.LinearFilter;

  const boardFacingYaw = Math.atan2(-layout.LEADERBOARD_ISLAND_POS.x, -layout.LEADERBOARD_ISLAND_POS.z);
  const board = new THREE.Group();
  board.position.set(layout.LEADERBOARD_ISLAND_POS.x, 0, layout.LEADERBOARD_ISLAND_POS.z);
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
    new THREE.MeshStandardMaterial({ map: leaderboardState.texture, roughness: 0.8, metalness: 0.02 })
  );
  boardFace.position.set(0, 2.9, -0.2);
  boardFace.castShadow = true;
  board.add(boardFace);

  const sign = makeTextSign('Leaderboard', 3.0, 0.72, '#14263a', '#f8fafc');
  sign.position.set(0, 6.05, -0.22);
  board.add(sign);
  scene.add(board);
  addWorldCollider(layout.LEADERBOARD_ISLAND_POS.x, layout.LEADERBOARD_ISLAND_POS.z, 2.9, 'stall');

  leaderboardState.rows = [];
  leaderboardState.needsRedraw = true;
  drawLeaderboardBoardTexture();
  void refreshLeaderboardBoard(true);
}

export function addBoat() {
  const boatState = getBoatState();
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

export function addDecorBoat(x, z, yaw = 0, scale = 1.9, y = 1.06) {
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
