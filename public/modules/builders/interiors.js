import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import {
  createVendorNpc,
  makeTextSign
} from './common.js';

let scene = null;
let addWorldCollider = null;
let addWallCollisionFromMesh = null;
let setLighthouseInteriorPortal = null;
let setLighthouseInteriorGroup = null;
let setHouseHallGroup = null;
let setHouseHallExitMarker = null;
let setFishingShopGroup = null;
let setFishingShopExitMarker = null;
let setMarketShopGroup = null;
let setMarketShopExitMarker = null;
let setFurnitureShopGroup = null;
let setFurnitureShopExitMarker = null;
let houseHallRoomDoors = null;
let getHouseRoomSlotCount = null;
let getHouseRoomIds = null;
let houseRoomContext = null;
let layout = null;

export function initInteriorBuilders({
  sceneRef = null,
  addWorldColliderRef = null,
  addWallCollisionFromMeshRef = null,
  setLighthouseInteriorPortalRef = null,
  setLighthouseInteriorGroupRef = null,
  setHouseHallGroupRef = null,
  setHouseHallExitMarkerRef = null,
  setFishingShopGroupRef = null,
  setFishingShopExitMarkerRef = null,
  setMarketShopGroupRef = null,
  setMarketShopExitMarkerRef = null,
  setFurnitureShopGroupRef = null,
  setFurnitureShopExitMarkerRef = null,
  houseHallRoomDoorsRef = null,
  getHouseRoomSlotCountRef = null,
  getHouseRoomIdsRef = null,
  houseRoomContextRef = null,
  layoutRef = null
} = {}) {
  scene = sceneRef;
  addWorldCollider = addWorldColliderRef;
  addWallCollisionFromMesh = addWallCollisionFromMeshRef;
  setLighthouseInteriorPortal = setLighthouseInteriorPortalRef;
  setLighthouseInteriorGroup = setLighthouseInteriorGroupRef;
  setHouseHallGroup = setHouseHallGroupRef;
  setHouseHallExitMarker = setHouseHallExitMarkerRef;
  setFishingShopGroup = setFishingShopGroupRef;
  setFishingShopExitMarker = setFishingShopExitMarkerRef;
  setMarketShopGroup = setMarketShopGroupRef;
  setMarketShopExitMarker = setMarketShopExitMarkerRef;
  setFurnitureShopGroup = setFurnitureShopGroupRef;
  setFurnitureShopExitMarker = setFurnitureShopExitMarkerRef;
  houseHallRoomDoors = houseHallRoomDoorsRef;
  getHouseRoomSlotCount = getHouseRoomSlotCountRef;
  getHouseRoomIds = getHouseRoomIdsRef;
  houseRoomContext = houseRoomContextRef;
  layout = layoutRef;
}

export function addLighthouseInterior() {
  const interior = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.86, side: THREE.DoubleSide });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.72 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d5a2b, roughness: 0.82 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xf2c66a, roughness: 0.34, metalness: 0.55 });
  const shellRadius = 11.8;
  const shellHeight = 24.5;
  const floorRadius = 11.2;
  const stairRadius = layout.INTERIOR_STAIR_RADIUS;
  const stairSteps = layout.INTERIOR_STAIR_STEPS;
  const stairRise = layout.INTERIOR_STAIR_RISE;

  const wall = new THREE.Mesh(new THREE.CylinderGeometry(shellRadius, shellRadius + 0.35, shellHeight, 56, 1, true), shellMat);
  wall.position.set(layout.LIGHTHOUSE_INTERIOR_BASE.x, shellHeight * 0.5 - 0.12, layout.LIGHTHOUSE_INTERIOR_BASE.z);
  wall.receiveShadow = true;
  interior.add(wall);

  const floorBase = new THREE.Mesh(new THREE.CircleGeometry(floorRadius, 56), stoneMat);
  floorBase.rotation.x = -Math.PI / 2;
  floorBase.position.set(layout.LIGHTHOUSE_INTERIOR_BASE.x, 1.34, layout.LIGHTHOUSE_INTERIOR_BASE.z);
  floorBase.receiveShadow = true;
  interior.add(floorBase);

  const floorRing = new THREE.Mesh(
    new THREE.RingGeometry(3.1, floorRadius - 0.3, 56),
    new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.85 })
  );
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.set(layout.LIGHTHOUSE_INTERIOR_BASE.x, 1.345, layout.LIGHTHOUSE_INTERIOR_BASE.z);
  interior.add(floorRing);

  const centerWell = new THREE.Mesh(
    new THREE.CylinderGeometry(2.25, 2.4, shellHeight - 2.2, 28),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.82 })
  );
  centerWell.position.set(layout.LIGHTHOUSE_INTERIOR_BASE.x, 1.35 + (shellHeight - 2.2) * 0.5, layout.LIGHTHOUSE_INTERIOR_BASE.z);
  centerWell.castShadow = true;
  centerWell.receiveShadow = true;
  interior.add(centerWell);
  addWorldCollider(layout.LIGHTHOUSE_INTERIOR_BASE.x, layout.LIGHTHOUSE_INTERIOR_BASE.z, 2.55, 'interior-core');

  const lowerTrim = new THREE.Mesh(new THREE.TorusGeometry(floorRadius - 0.05, 0.12, 8, 64), trimMat);
  lowerTrim.rotation.x = Math.PI / 2;
  lowerTrim.position.set(layout.LIGHTHOUSE_INTERIOR_BASE.x, 1.72, layout.LIGHTHOUSE_INTERIOR_BASE.z);
  interior.add(lowerTrim);
  const upperTrim = lowerTrim.clone();
  upperTrim.position.y = shellHeight - 0.35;
  interior.add(upperTrim);

  const stairRailMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 });
  for (let i = 0; i < stairSteps; i += 1) {
    const angle = i * layout.INTERIOR_STAIR_ANGLE_STEP;
    const step = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 1.55), woodMat);
    step.position.set(
      layout.LIGHTHOUSE_INTERIOR_BASE.x + Math.cos(angle) * stairRadius,
      layout.INTERIOR_STAIR_START_Y + i * stairRise,
      layout.LIGHTHOUSE_INTERIOR_BASE.z + Math.sin(angle) * stairRadius
    );
    step.rotation.y = -angle;
    step.castShadow = true;
    step.receiveShadow = true;
    interior.add(step);

    if (i < stairSteps - 1) {
      const nextAngle = (i + 1) * layout.INTERIOR_STAIR_ANGLE_STEP;
      const nextX = layout.LIGHTHOUSE_INTERIOR_BASE.x + Math.cos(nextAngle) * stairRadius;
      const nextZ = layout.LIGHTHOUSE_INTERIOR_BASE.z + Math.sin(nextAngle) * stairRadius;
      const nextY = layout.INTERIOR_STAIR_START_Y + (i + 1) * stairRise;
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
        layout.LIGHTHOUSE_INTERIOR_BASE.x + Math.cos(angle) * (stairRadius + 1.52),
        step.position.y + 0.38,
        layout.LIGHTHOUSE_INTERIOR_BASE.z + Math.sin(angle) * (stairRadius + 1.52)
      );
      post.castShadow = true;
      interior.add(post);
    }
  }

  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8), trimMat);
    post.position.set(
      layout.INTERIOR_TOP_POS.x + Math.cos(a) * 3.45,
      layout.INTERIOR_TOP_POS.y + 0.18,
      layout.INTERIOR_TOP_POS.z + Math.sin(a) * 3.45
    );
    post.castShadow = true;
    interior.add(post);
  }
  const topRail = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.08, 10, 40), trimMat);
  topRail.rotation.x = Math.PI / 2;
  topRail.position.set(layout.INTERIOR_TOP_POS.x, layout.INTERIOR_TOP_POS.y + 0.72, layout.INTERIOR_TOP_POS.z);
  interior.add(topRail);

  const topPlatform = new THREE.Mesh(
    new THREE.CircleGeometry(3.35, 36),
    new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.76 })
  );
  topPlatform.rotation.x = -Math.PI / 2;
  topPlatform.position.set(layout.INTERIOR_TOP_POS.x, layout.INTERIOR_TOP_POS.y + 0.1, layout.INTERIOR_TOP_POS.z);
  interior.add(topPlatform);

  const upperDeck = new THREE.Mesh(
    new THREE.RingGeometry(5.0, floorRadius - 0.25, 48),
    new THREE.MeshStandardMaterial({ color: 0x7c4f2d, roughness: 0.84 })
  );
  upperDeck.rotation.x = -Math.PI / 2;
  upperDeck.position.set(layout.LIGHTHOUSE_INTERIOR_BASE.x, layout.INTERIOR_TOP_POS.y - 0.42, layout.LIGHTHOUSE_INTERIOR_BASE.z);
  upperDeck.receiveShadow = true;
  interior.add(upperDeck);

  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(shellRadius - 0.2, 56),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(layout.LIGHTHOUSE_INTERIOR_BASE.x, shellHeight - 0.22, layout.LIGHTHOUSE_INTERIOR_BASE.z);
  interior.add(ceiling);

  const entryFrame = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.1, 10, 30),
    new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x1d4ed8, emissiveIntensity: 0.5 })
  );
  entryFrame.rotation.x = Math.PI / 2;
  entryFrame.position.set(layout.INTERIOR_ENTRY_POS.x, 1.45, layout.INTERIOR_ENTRY_POS.z);
  interior.add(entryFrame);

  const mapTable = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.96, 0.72, 20), woodMat);
  mapTable.position.set(layout.LIGHTHOUSE_INTERIOR_BASE.x - 4.25, 1.72, layout.LIGHTHOUSE_INTERIOR_BASE.z - 3.4);
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
  lantern.position.set(layout.LIGHTHOUSE_INTERIOR_BASE.x, shellHeight - 2.1, layout.LIGHTHOUSE_INTERIOR_BASE.z);
  interior.add(lantern);

  const lighthouseInteriorPortal = new THREE.Group();
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
  lighthouseInteriorPortal.position.set(layout.INTERIOR_EXIT_PORTAL_POS.x, layout.INTERIOR_EXIT_PORTAL_POS.y, layout.INTERIOR_EXIT_PORTAL_POS.z);
  const portalGlow = new THREE.PointLight(0x7dd3fc, 1.25, 12, 2);
  portalGlow.position.y = 0.7;
  lighthouseInteriorPortal.add(portalGlow);
  interior.add(lighthouseInteriorPortal);

  interior.visible = false;
  setLighthouseInteriorPortal(lighthouseInteriorPortal);
  setLighthouseInteriorGroup(interior);
  scene.add(interior);
}

const addMainHouseRoomInteriorImpl = new Function('ctx', "with (ctx) {\n\n  const room = new THREE.Group();\n  const floorY = GROUND_Y;\n  const wallHeight = 4.8;\n  const wallThickness = 0.28;\n  const halfDepth = HOUSE_ROOM_PLAY_RADIUS - 0.7;\n  const halfWidth = HOUSE_ROOM_PLAY_RADIUS - 0.6;\n  const doorWidth = 3.6;\n  const wallCenterY = floorY + wallHeight * 0.5;\n  const wallPaint = HOME_ROOM_WALL_OPTIONS.sand?.color || '#d9c4a3';\n  const floorPaint = HOME_ROOM_FLOOR_OPTIONS.oak?.color || '#7d5a3a';\n\n  const wallMat = new THREE.MeshStandardMaterial({ color: wallPaint, roughness: 0.86 });\n  const floorMat = new THREE.MeshStandardMaterial({ color: floorPaint, roughness: 0.92 });\n  const trimMat = new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.9 });\n  const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.85 });\n  const crownMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.82 });\n  const glassMat = new THREE.MeshStandardMaterial({ color: 0xa8d4f0, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.35 });\n  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.78 });\n  const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.82 });\n  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.84 });\n  const bracketMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.5, metalness: 0.35 });\n  const sconceShadeMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.55, side: THREE.DoubleSide });\n  const chainMat = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.4, metalness: 0.6 });\n  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc69332, roughness: 0.28, metalness: 0.82 });\n  const linenMat = new THREE.MeshStandardMaterial({ color: 0xf4ead0, roughness: 0.72, side: THREE.DoubleSide });\n  const sofaMat = new THREE.MeshStandardMaterial({ color: 0xd4c7b5, roughness: 0.84 });\n  const sofaAccentMat = new THREE.MeshStandardMaterial({ color: 0xb98b66, roughness: 0.82 });\n  const artCanvasMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.72 });\n  const curtainMat = new THREE.MeshStandardMaterial({ color: 0x9f6f48, roughness: 0.9 });\n  const accentPanelMat = new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.88 });\n  const deskTopMat = new THREE.MeshStandardMaterial({ color: 0x6f4a2f, roughness: 0.84 });\n  const deskBaseMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1f, roughness: 0.88 });\n  const paperMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.92 });\n  const bulbMat = new THREE.MeshStandardMaterial({\n    color: 0xfff7db,\n    emissive: 0xffd27a,\n    emissiveIntensity: 0.8,\n    roughness: 0.24,\n    metalness: 0.04\n  });\n\n  houseRoomWallMaterial = wallMat;\n  houseRoomFloorMaterial = floorMat;\n  const roomCenterX = HOUSE_ROOM_BASE.x;\n  const roomCenterZ = HOUSE_ROOM_BASE.z;\n  const backWallInnerZ = HOUSE_ROOM_BASE.z - halfDepth + wallThickness + 0.12;\n  const workspaceCenterX = HOUSE_ROOM_WORKSHOP_POS.x + 0.15;\n  const workspaceWallZ = backWallInnerZ + 0.02;\n  const workspaceDeskZ = workspaceWallZ + 1.34;\n  const bedroomCenterX = roomCenterX + halfWidth - 3.45;\n  const bedroomCenterZ = roomCenterZ - 2.75;\n  const bedsideZ = bedroomCenterZ - 2.55;\n  const loungeCenterX = roomCenterX + 1.1;\n  const loungeCenterZ = roomCenterZ + 0.95;\n  const readingCornerX = roomCenterX + halfWidth - 2.85;\n  const readingCornerZ = roomCenterZ + 0.3;\n\n  const floor = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.22, halfDepth * 2), floorMat);\n  floor.position.set(HOUSE_ROOM_BASE.x, floorY - 0.11, HOUSE_ROOM_BASE.z);\n  floor.receiveShadow = true;\n  room.add(floor);\n\n  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.18, halfDepth * 2), trimMat);\n  ceiling.position.set(HOUSE_ROOM_BASE.x, floorY + wallHeight + 0.1, HOUSE_ROOM_BASE.z);\n  ceiling.receiveShadow = true;\n  room.add(ceiling);\n\n  const backWall = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, wallHeight, wallThickness), wallMat);\n  backWall.position.set(HOUSE_ROOM_BASE.x, wallCenterY, HOUSE_ROOM_BASE.z - halfDepth + wallThickness * 0.5);\n  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, halfDepth * 2), wallMat);\n  leftWall.position.set(HOUSE_ROOM_BASE.x - halfWidth + wallThickness * 0.5, wallCenterY, HOUSE_ROOM_BASE.z);\n  const rightWall = leftWall.clone();\n  rightWall.position.x = HOUSE_ROOM_BASE.x + halfWidth - wallThickness * 0.5;\n\n  const frontSideWidth = (halfWidth * 2 - doorWidth) * 0.5;\n  const frontLeftWall = new THREE.Mesh(new THREE.BoxGeometry(frontSideWidth, wallHeight, wallThickness), wallMat);\n  frontLeftWall.position.set(\n    HOUSE_ROOM_BASE.x - (doorWidth * 0.5 + frontSideWidth * 0.5),\n    wallCenterY,\n    HOUSE_ROOM_BASE.z + halfDepth - wallThickness * 0.5\n  );\n  const frontRightWall = frontLeftWall.clone();\n  frontRightWall.position.x = HOUSE_ROOM_BASE.x + (doorWidth * 0.5 + frontSideWidth * 0.5);\n  const frontTopWall = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, wallHeight * 0.4, wallThickness), wallMat);\n  frontTopWall.position.set(\n    HOUSE_ROOM_BASE.x,\n    floorY + wallHeight - (wallHeight * 0.4) * 0.5,\n    HOUSE_ROOM_BASE.z + halfDepth - wallThickness * 0.5\n  );\n  room.add(backWall, leftWall, rightWall, frontLeftWall, frontRightWall, frontTopWall);\n\n  const baseboardHeight = 0.14;\n  const baseboardInset = wallThickness * 0.5 + 0.02;\n  const crownHeight = 0.12;\n  const crownY = floorY + wallHeight - crownHeight * 0.5;\n  const baseY = floorY + baseboardHeight * 0.5;\n  const wallLenX = halfWidth * 2 - wallThickness;\n  const wallLenZ = halfDepth * 2 - wallThickness;\n\n  const bbBack = new THREE.Mesh(new THREE.BoxGeometry(wallLenX, baseboardHeight, 0.06), baseboardMat);\n  bbBack.position.set(HOUSE_ROOM_BASE.x, baseY, HOUSE_ROOM_BASE.z - halfDepth + baseboardInset);\n  const bbLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, baseboardHeight, wallLenZ), baseboardMat);\n  bbLeft.position.set(HOUSE_ROOM_BASE.x - halfWidth + baseboardInset, baseY, HOUSE_ROOM_BASE.z);\n  const bbRight = bbLeft.clone();\n  bbRight.position.x = HOUSE_ROOM_BASE.x + halfWidth - baseboardInset;\n  const bbFrontL = new THREE.Mesh(new THREE.BoxGeometry(frontSideWidth - 0.1, baseboardHeight, 0.06), baseboardMat);\n  bbFrontL.position.set(frontLeftWall.position.x, baseY, HOUSE_ROOM_BASE.z + halfDepth - baseboardInset);\n  const bbFrontR = bbFrontL.clone();\n  bbFrontR.position.x = frontRightWall.position.x;\n  room.add(bbBack, bbLeft, bbRight, bbFrontL, bbFrontR);\n\n  const crBack = new THREE.Mesh(new THREE.BoxGeometry(wallLenX, crownHeight, 0.06), crownMat);\n  crBack.position.set(HOUSE_ROOM_BASE.x, crownY, HOUSE_ROOM_BASE.z - halfDepth + baseboardInset);\n  const crLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, crownHeight, wallLenZ), crownMat);\n  crLeft.position.set(HOUSE_ROOM_BASE.x - halfWidth + baseboardInset, crownY, HOUSE_ROOM_BASE.z);\n  const crRight = crLeft.clone();\n  crRight.position.x = HOUSE_ROOM_BASE.x + halfWidth - baseboardInset;\n  const crFrontL = new THREE.Mesh(new THREE.BoxGeometry(frontSideWidth - 0.1, crownHeight, 0.06), crownMat);\n  crFrontL.position.set(frontLeftWall.position.x, crownY, HOUSE_ROOM_BASE.z + halfDepth - baseboardInset);\n  const crFrontR = crFrontL.clone();\n  crFrontR.position.x = frontRightWall.position.x;\n  room.add(crBack, crLeft, crRight, crFrontL, crFrontR);\n\n  const chairRailHeight = 1.92;\n  const chairRailBack = new THREE.Mesh(new THREE.BoxGeometry(wallLenX, 0.09, 0.08), crownMat);\n  chairRailBack.position.set(HOUSE_ROOM_BASE.x, floorY + chairRailHeight, HOUSE_ROOM_BASE.z - halfDepth + baseboardInset + 0.02);\n  const chairRailLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, wallLenZ), crownMat);\n  chairRailLeft.position.set(HOUSE_ROOM_BASE.x - halfWidth + baseboardInset + 0.02, floorY + chairRailHeight, HOUSE_ROOM_BASE.z);\n  const chairRailRight = chairRailLeft.clone();\n  chairRailRight.position.x = HOUSE_ROOM_BASE.x + halfWidth - baseboardInset - 0.02;\n  room.add(chairRailBack, chairRailLeft, chairRailRight);\n\n  for (const beamOffset of [-3.4, 3.4]) {\n    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, halfDepth * 2 - 0.7), trimMat);\n    beam.position.set(HOUSE_ROOM_BASE.x + beamOffset, floorY + wallHeight - 0.11, HOUSE_ROOM_BASE.z - 0.1);\n    room.add(beam);\n  }\n\n  const interiorFrontFaceZ = HOUSE_ROOM_BASE.z + halfDepth - wallThickness;\n  const doorFrameDepth = 0.12;\n  const doorFrameThick = 0.18;\n  const doorFrameH = wallHeight * 0.82;\n  const doorFrameY = floorY + doorFrameH * 0.5;\n  const doorFrameZ = interiorFrontFaceZ + doorFrameDepth * 0.5 + 0.01;\n\n  const dfLeft = new THREE.Mesh(new THREE.BoxGeometry(doorFrameThick, doorFrameH, doorFrameDepth), doorFrameMat);\n  dfLeft.position.set(HOUSE_ROOM_BASE.x - doorWidth * 0.5 - doorFrameThick * 0.5, doorFrameY, doorFrameZ);\n  const dfRight = dfLeft.clone();\n  dfRight.position.x = HOUSE_ROOM_BASE.x + doorWidth * 0.5 + doorFrameThick * 0.5;\n  const dfTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + doorFrameThick * 2, doorFrameThick, doorFrameDepth), doorFrameMat);\n  dfTop.position.set(HOUSE_ROOM_BASE.x, floorY + doorFrameH + doorFrameThick * 0.5, doorFrameZ);\n  room.add(dfLeft, dfRight, dfTop);\n\n  const doorLeafMat = new THREE.MeshStandardMaterial({ color: 0x4b2f1d, roughness: 0.78 });\n  const doorGlassMat = new THREE.MeshStandardMaterial({\n    color: 0xc8e6fb,\n    roughness: 0.08,\n    metalness: 0.08,\n    transparent: true,\n    opacity: 0.42\n  });\n  const doorHandleMat = new THREE.MeshStandardMaterial({ color: 0xd3a64f, roughness: 0.32, metalness: 0.68 });\n  const doorLeafW = doorWidth * 0.5 - 0.14;\n  const doorLeafH = doorFrameH - 0.18;\n  const doorLeafT = 0.08;\n  const doorPanelZ = interiorFrontFaceZ + doorLeafT * 0.5 + 0.012;\n\n  function createInteriorDoorLeaf(side = -1) {\n    const leaf = new THREE.Group();\n    const panel = new THREE.Group();\n    panel.position.x = (side === -1 ? 1 : -1) * doorLeafW * 0.5;\n    const slab = new THREE.Mesh(new THREE.BoxGeometry(doorLeafW, doorLeafH, doorLeafT), doorLeafMat);\n    slab.position.y = doorLeafH * 0.5;\n    const railTop = new THREE.Mesh(new THREE.BoxGeometry(doorLeafW - 0.16, 0.12, 0.02), trimMat);\n    railTop.position.set(0, doorLeafH - 0.3, doorLeafT * 0.5 + 0.02);\n    const railMid = railTop.clone();\n    railMid.position.y = doorLeafH * 0.54;\n    const railBot = railTop.clone();\n    railBot.position.y = 0.42;\n    const stileL = new THREE.Mesh(new THREE.BoxGeometry(0.12, doorLeafH - 0.2, 0.02), trimMat);\n    stileL.position.set(-doorLeafW * 0.5 + 0.14, doorLeafH * 0.5, doorLeafT * 0.5 + 0.02);\n    const stileR = stileL.clone();\n    stileR.position.x = doorLeafW * 0.5 - 0.14;\n    const glass = new THREE.Mesh(new THREE.BoxGeometry(doorLeafW - 0.42, doorLeafH * 0.32, 0.02), doorGlassMat);\n    glass.position.set(0, doorLeafH * 0.7, doorLeafT * 0.5 + 0.03);\n    const lowerPanel = new THREE.Mesh(new THREE.BoxGeometry(doorLeafW - 0.42, doorLeafH * 0.24, 0.02), trimMat);\n    lowerPanel.position.set(0, doorLeafH * 0.27, doorLeafT * 0.5 + 0.03);\n    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), doorHandleMat);\n    handle.position.set((side === -1 ? 1 : -1) * (doorLeafW * 0.5 - 0.18), doorLeafH * 0.48, doorLeafT * 0.5 + 0.05);\n    panel.add(slab, railTop, railMid, railBot, stileL, stileR, glass, lowerPanel, handle);\n    leaf.add(panel);\n    return leaf;\n  }\n\n  const leftDoorLeaf = createInteriorDoorLeaf(-1);\n  leftDoorLeaf.position.set(HOUSE_ROOM_BASE.x - doorWidth * 0.5 + 0.02, floorY, doorPanelZ);\n  leftDoorLeaf.rotation.y = Math.PI * 0.09;\n  const rightDoorLeaf = createInteriorDoorLeaf(1);\n  rightDoorLeaf.position.set(HOUSE_ROOM_BASE.x + doorWidth * 0.5 - 0.02, floorY, doorPanelZ);\n  rightDoorLeaf.rotation.y = -Math.PI * 0.09;\n\n  const transom = new THREE.Mesh(\n    new THREE.BoxGeometry(doorWidth - 0.2, 0.46, 0.05),\n    doorGlassMat\n  );\n  transom.position.set(HOUSE_ROOM_BASE.x, floorY + doorFrameH - 0.34, interiorFrontFaceZ + 0.04);\n  const transomBar = new THREE.Mesh(\n    new THREE.BoxGeometry(0.08, 0.46, 0.06),\n    trimMat\n  );\n  transomBar.position.copy(transom.position);\n  const threshold = new THREE.Mesh(\n    new THREE.BoxGeometry(doorWidth + 0.12, 0.04, 0.22),\n    new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.88 })\n  );\n  threshold.position.set(HOUSE_ROOM_BASE.x, floorY + 0.03, interiorFrontFaceZ + 0.08);\n  room.add(leftDoorLeaf, rightDoorLeaf, transom, transomBar, threshold);\n\n  const doorStep = new THREE.Mesh(\n    new THREE.BoxGeometry(doorWidth + 0.6, 0.06, 0.5),\n    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9 })\n  );\n  doorStep.position.set(HOUSE_ROOM_BASE.x, floorY + 0.02, HOUSE_ROOM_BASE.z + halfDepth + 0.15);\n  doorStep.receiveShadow = true;\n  room.add(doorStep);\n\n  const welcomeRugBorder = new THREE.Mesh(\n    new THREE.BoxGeometry(doorWidth - 0.2, 0.025, 1.0),\n    new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.92 })\n  );\n  welcomeRugBorder.position.set(HOUSE_ROOM_BASE.x, floorY + 0.015, HOUSE_ROOM_BASE.z + halfDepth - 1.4);\n  welcomeRugBorder.receiveShadow = true;\n  const welcomeRug = new THREE.Mesh(\n    new THREE.BoxGeometry(doorWidth - 0.6, 0.03, 0.7),\n    new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.88 })\n  );\n  welcomeRug.position.set(HOUSE_ROOM_BASE.x, floorY + 0.02, HOUSE_ROOM_BASE.z + halfDepth - 1.4);\n  welcomeRug.receiveShadow = true;\n  room.add(welcomeRugBorder, welcomeRug);\n\n  const rugBorder = new THREE.Mesh(\n    new THREE.BoxGeometry(5.6, 0.035, 4.2),\n    new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.88 })\n  );\n  rugBorder.position.set(loungeCenterX, floorY + 0.005, loungeCenterZ);\n  rugBorder.receiveShadow = true;\n  const rug = new THREE.Mesh(\n    new THREE.BoxGeometry(5.0, 0.05, 3.7),\n    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.78 })\n  );\n  rug.position.set(loungeCenterX, floorY + 0.01, loungeCenterZ);\n  rug.receiveShadow = true;\n  const rugAccent = new THREE.Mesh(\n    new THREE.BoxGeometry(2.0, 0.045, 1.4),\n    new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.82 })\n  );\n  rugAccent.position.set(loungeCenterX, floorY + 0.018, loungeCenterZ);\n  rugAccent.receiveShadow = true;\n  room.add(rugBorder, rug, rugAccent);\n\n  const ambientLight = new THREE.AmbientLight(0xe2e8f0, 0.38);\n  const wallLightL = new THREE.PointLight(0xfef3c7, 0.58, 12, 2);\n  wallLightL.position.set(roomCenterX - 5.2, floorY + 3.34, backWallInnerZ + 0.34);\n  const wallLightR = wallLightL.clone();\n  wallLightR.position.x = roomCenterX + 5.2;\n  const doorFillLight = new THREE.PointLight(0xfef3c7, 0.34, 7.5, 2);\n  doorFillLight.position.set(roomCenterX, floorY + 3.1, roomCenterZ + halfDepth - 0.55);\n  const ceilingLampLight = new THREE.PointLight(0xfff4e0, 0.72, 13, 2);\n  ceilingLampLight.position.set(loungeCenterX, floorY + wallHeight - 0.58, loungeCenterZ);\n  room.add(ambientLight, wallLightL, wallLightR, doorFillLight, ceilingLampLight);\n\n  const sconceY = floorY + 3.3;\n  function createWallSconce() {\n    const sconce = new THREE.Group();\n    const backplate = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 18), brassMat);\n    backplate.rotation.x = Math.PI * 0.5;\n    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.3, 10), bracketMat);\n    arm.rotation.x = Math.PI * 0.5;\n    arm.position.z = 0.14;\n    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 10), brassMat);\n    cup.position.z = 0.3;\n    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), bulbMat);\n    bulb.position.z = 0.34;\n    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.34, 12), sconceShadeMat);\n    shade.rotation.x = Math.PI * 0.5;\n    shade.position.z = 0.41;\n    sconce.add(backplate, arm, cup, bulb, shade);\n    return sconce;\n  }\n\n  const sconceL = createWallSconce();\n  sconceL.position.set(HOUSE_ROOM_BASE.x - 5.2, sconceY, backWallInnerZ);\n  const sconceR = createWallSconce();\n  sconceR.position.set(HOUSE_ROOM_BASE.x + 5.2, sconceY, backWallInnerZ);\n  room.add(sconceL, sconceR);\n\n  const ceilingCanopy = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 12), brassMat);\n  ceilingCanopy.position.set(loungeCenterX, floorY + wallHeight + 0.04, loungeCenterZ);\n  const ceilingLampChain = new THREE.Mesh(\n    new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6),\n    chainMat\n  );\n  ceilingLampChain.position.set(loungeCenterX, floorY + wallHeight - 0.18, loungeCenterZ);\n  const ceilingLampShade = new THREE.Mesh(\n    new THREE.CylinderGeometry(0.36, 0.48, 0.36, 18, 1, true),\n    linenMat\n  );\n  ceilingLampShade.position.set(loungeCenterX, floorY + wallHeight - 0.5, loungeCenterZ);\n  const ceilingLampTrim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 8, 18), brassMat);\n  ceilingLampTrim.position.set(loungeCenterX, floorY + wallHeight - 0.68, loungeCenterZ);\n  ceilingLampTrim.rotation.x = Math.PI * 0.5;\n  const ceilingBulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 14), bulbMat);\n  ceilingBulb.position.set(loungeCenterX, floorY + wallHeight - 0.6, loungeCenterZ);\n  room.add(ceilingCanopy, ceilingLampChain, ceilingLampShade, ceilingLampTrim, ceilingBulb);\n\n  const entryLantern = new THREE.Group();\n  const entryBracket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.16), brassMat);\n  const entryLanternBody = new THREE.Mesh(\n    new THREE.BoxGeometry(0.34, 0.46, 0.28),\n    new THREE.MeshStandardMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.28, roughness: 0.18, metalness: 0.08 })\n  );\n  entryLanternBody.position.z = 0.08;\n  const entryBulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), bulbMat);\n  entryBulb.position.z = 0.08;\n  entryLantern.add(entryBracket, entryLanternBody, entryBulb);\n  entryLantern.position.set(roomCenterX, floorY + 3.15, roomCenterZ + halfDepth - 0.34);\n  room.add(entryLantern);\n\n  const workspacePanel = new THREE.Mesh(\n    new THREE.BoxGeometry(4.3, 2.9, 0.1),\n    accentPanelMat\n  );\n  workspacePanel.position.set(workspaceCenterX, floorY + 2.12, workspaceWallZ);\n  const workspaceShelf = new THREE.Mesh(\n    new THREE.BoxGeometry(3.15, 0.08, 0.28),\n    shelfMat\n  );\n  workspaceShelf.position.set(workspaceCenterX, floorY + 2.28, workspaceWallZ + 0.18);\n  const pegRail = new THREE.Mesh(\n    new THREE.BoxGeometry(3.1, 0.08, 0.12),\n    baseboardMat\n  );\n  pegRail.position.set(workspaceCenterX, floorY + 2.86, workspaceWallZ + 0.08);\n  room.add(workspacePanel, workspaceShelf, pegRail);\n\n  for (const hookOffset of [-0.78, -0.26, 0.26, 0.78]) {\n    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8), brassMat);\n    hook.rotation.x = Math.PI * 0.5;\n    hook.position.set(workspaceCenterX + hookOffset, floorY + 2.7, workspaceWallZ + 0.1);\n    room.add(hook);\n  }\n\n  const workshopSign = makeTextSign('Workspace', 2.7, 0.58, '#0f172a', '#f8fafc');\n  workshopSign.position.set(workspaceCenterX, floorY + 3.22, workspaceWallZ + 0.06);\n  room.add(workshopSign);\n\n  function createHouseRoomMarker({\n    ringRadius = 0.92,\n    ringColor = 0x7dd3fc,\n    emissiveColor = 0x0369a1,\n    iconType = 'exit'\n  } = {}) {\n    const marker = new THREE.Group();\n    const ring = new THREE.Mesh(\n      new THREE.TorusGeometry(ringRadius, 0.08, 10, 28),\n      new THREE.MeshStandardMaterial({\n        color: ringColor,\n        emissive: emissiveColor,\n        emissiveIntensity: 0.82,\n        roughness: 0.22,\n        metalness: 0.08\n      })\n    );\n    ring.rotation.x = Math.PI * 0.5;\n    const plate = new THREE.Mesh(\n      new THREE.CylinderGeometry(ringRadius * 0.68, ringRadius * 0.68, 0.04, 22),\n      new THREE.MeshStandardMaterial({\n        color: 0x10314d,\n        emissive: emissiveColor,\n        emissiveIntensity: 0.18,\n        roughness: 0.28,\n        transparent: true,\n        opacity: 0.82\n      })\n    );\n    plate.rotation.x = Math.PI * 0.5;\n    plate.position.y = 0.005;\n    const glow = new THREE.PointLight(ringColor, 0.46, 5.4, 2);\n    glow.position.y = 0.95;\n    const icon = new THREE.Group();\n\n    if (iconType === 'exit') {\n      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.54, 0.08), trimMat);\n      frame.position.y = 0.98;\n      const voidCut = new THREE.Mesh(\n        new THREE.BoxGeometry(0.2, 0.34, 0.1),\n        new THREE.MeshStandardMaterial({\n          color: ringColor,\n          emissive: emissiveColor,\n          emissiveIntensity: 0.9,\n          roughness: 0.18,\n          transparent: true,\n          opacity: 0.84\n        })\n      );\n      voidCut.position.set(-0.03, 0.96, 0.03);\n      const arrow = new THREE.Mesh(\n        new THREE.ConeGeometry(0.12, 0.22, 3),\n        new THREE.MeshStandardMaterial({\n          color: ringColor,\n          emissive: emissiveColor,\n          emissiveIntensity: 0.92,\n          roughness: 0.2\n        })\n      );\n      arrow.rotation.z = -Math.PI * 0.5;\n      arrow.position.set(0.18, 0.96, 0.02);\n      icon.add(frame, voidCut, arrow);\n    } else {\n      const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.22), deskTopMat);\n      board.position.y = 0.94;\n      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.06), deskBaseMat);\n      legL.position.set(-0.16, 0.76, 0);\n      const legR = legL.clone();\n      legR.position.x = 0.16;\n      const tool = new THREE.Mesh(\n        new THREE.BoxGeometry(0.08, 0.28, 0.08),\n        new THREE.MeshStandardMaterial({\n          color: ringColor,\n          emissive: emissiveColor,\n          emissiveIntensity: 0.88,\n          roughness: 0.24\n        })\n      );\n      tool.position.set(0, 1.18, 0);\n      const toolHead = new THREE.Mesh(\n        new THREE.BoxGeometry(0.24, 0.08, 0.08),\n        new THREE.MeshStandardMaterial({\n          color: ringColor,\n          emissive: emissiveColor,\n          emissiveIntensity: 0.88,\n          roughness: 0.24\n        })\n      );\n      toolHead.position.set(0, 1.28, 0);\n      icon.add(board, legL, legR, tool, toolHead);\n    }\n\n    marker.add(ring, plate, icon, glow);\n    marker.userData.ring = ring;\n    marker.userData.icon = icon;\n    marker.userData.glow = glow;\n    return marker;\n  }\n\n  houseRoomExitMarker = createHouseRoomMarker({\n    ringRadius: 0.94,\n    ringColor: 0x7dd3fc,\n    emissiveColor: 0x0369a1,\n    iconType: 'exit'\n  });\n  houseRoomExitMarker.position.set(HOUSE_ROOM_EXIT_POS.x, floorY + 0.02, HOUSE_ROOM_EXIT_POS.z);\n  room.add(houseRoomExitMarker);\n\n  houseRoomWorkshopMarker = createHouseRoomMarker({\n    ringRadius: 0.72,\n    ringColor: 0x5eead4,\n    emissiveColor: 0x0f766e,\n    iconType: 'workshop'\n  });\n  houseRoomWorkshopMarker.position.set(HOUSE_ROOM_WORKSHOP_POS.x, floorY + 0.02, HOUSE_ROOM_WORKSHOP_POS.z);\n  room.add(houseRoomWorkshopMarker);\n\n  const winFrameDepth = wallThickness + 0.14;\n  const winFrameThick = 0.1;\n  const winGlassMat = glassMat;\n  const winFrameX = halfWidth - 0.5;\n  const winFrameY = floorY + 2.7;\n  const winFrameW = 1.6;\n  const winFrameH = 1.3;\n\n  function addWindowFrame(group, wx, wz, rotY) {\n    const wGroup = new THREE.Group();\n    const glass = new THREE.Mesh(new THREE.BoxGeometry(winFrameW - 0.2, winFrameH - 0.2, 0.04), winGlassMat);\n    glass.position.y = winFrameY;\n    wGroup.add(glass);\n    const topBar = new THREE.Mesh(new THREE.BoxGeometry(winFrameW, winFrameThick, winFrameDepth), frameMat);\n    topBar.position.y = winFrameY + winFrameH * 0.5;\n    const botBar = topBar.clone();\n    botBar.position.y = winFrameY - winFrameH * 0.5;\n    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(winFrameThick, winFrameH, winFrameDepth), frameMat);\n    leftBar.position.set(-winFrameW * 0.5, winFrameY, 0);\n    const rightBar = leftBar.clone();\n    rightBar.position.x = winFrameW * 0.5;\n    const hDiv = new THREE.Mesh(new THREE.BoxGeometry(winFrameW - 0.12, 0.05, winFrameDepth * 0.6), frameMat);\n    hDiv.position.y = winFrameY;\n    const vDiv = new THREE.Mesh(new THREE.BoxGeometry(0.05, winFrameH - 0.12, winFrameDepth * 0.6), frameMat);\n    vDiv.position.y = winFrameY;\n    const sill = new THREE.Mesh(new THREE.BoxGeometry(winFrameW + 0.2, 0.06, 0.3), frameMat);\n    sill.position.set(0, winFrameY - winFrameH * 0.5 - 0.04, 0.18);\n    wGroup.add(topBar, botBar, leftBar, rightBar, hDiv, vDiv, sill);\n    wGroup.position.set(wx, 0, wz);\n    wGroup.rotation.y = rotY;\n    group.add(wGroup);\n  }\n\n  addWindowFrame(room, HOUSE_ROOM_BASE.x - winFrameX, HOUSE_ROOM_BASE.z - 1.2, Math.PI / 2);\n  addWindowFrame(room, HOUSE_ROOM_BASE.x + winFrameX, HOUSE_ROOM_BASE.z - 1.2, -Math.PI / 2);\n\n  function addCurtain(wx, wz, rotY, direction) {\n    const curtainRod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.95, 10), brassMat);\n    curtainRod.rotation.z = Math.PI * 0.5;\n    curtainRod.rotation.y = rotY;\n    curtainRod.position.set(wx, floorY + 3.52, wz);\n    room.add(curtainRod);\n    for (const side of [-1, 1]) {\n      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.54, 1.7, 0.08), curtainMat);\n      panel.position.set(\n        wx + Math.cos(rotY) * side * 0.08 + direction * side * 0.5,\n        floorY + 2.66,\n        wz - Math.sin(rotY) * side * 0.08\n      );\n      panel.rotation.y = rotY;\n      room.add(panel);\n    }\n  }\n\n  addCurtain(HOUSE_ROOM_BASE.x - winFrameX + 0.12, HOUSE_ROOM_BASE.z - 1.2, Math.PI / 2, 1);\n  addCurtain(HOUSE_ROOM_BASE.x + winFrameX - 0.12, HOUSE_ROOM_BASE.z - 1.2, -Math.PI / 2, -1);\n\n  const shelfWidth = 2.4;\n  const shelfDepth = 0.32;\n  const shelfY = floorY + 2.1;\n  const shelfZ = HOUSE_ROOM_BASE.z - halfDepth + wallThickness + shelfDepth * 0.5 + 0.04;\n  const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.08, shelfDepth), shelfMat);\n  shelfBoard.position.set(HOUSE_ROOM_BASE.x, shelfY, shelfZ);\n  shelfBoard.castShadow = true;\n  shelfBoard.receiveShadow = true;\n\n  const bookColors = [0xdc2626, 0x2563eb, 0x16a34a];\n  const bookGroup = new THREE.Group();\n  bookColors.forEach((c, i) => {\n    const book = new THREE.Mesh(\n      new THREE.BoxGeometry(0.18, 0.3, 0.22),\n      new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })\n    );\n    book.position.set(HOUSE_ROOM_BASE.x - 0.65 + i * 0.22, shelfY + 0.2, shelfZ);\n    bookGroup.add(book);\n  });\n  const bowl1 = new THREE.Mesh(\n    new THREE.TorusGeometry(0.1, 0.04, 6, 12, Math.PI),\n    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 })\n  );\n  bowl1.position.set(HOUSE_ROOM_BASE.x + 0.55, shelfY + 0.07, shelfZ);\n  bowl1.rotation.x = Math.PI / 2;\n  const bowl2 = bowl1.clone();\n  bowl2.position.x = HOUSE_ROOM_BASE.x + 0.85;\n  bowl2.scale.setScalar(0.75);\n  room.add(shelfBoard, bookGroup, bowl1, bowl2);\n\n  const paintingW = 1.5;\n  const paintingH = 1.0;\n  const paintFrameThick = 0.1;\n  const paintingY = floorY + 3.5;\n  const paintingZ = HOUSE_ROOM_BASE.z - halfDepth + wallThickness + 0.08;\n  const paintGroup = new THREE.Group();\n  const paintCanvas = new THREE.Mesh(\n    new THREE.BoxGeometry(paintingW - paintFrameThick * 2, paintingH - paintFrameThick * 2, 0.04),\n    new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.92 })\n  );\n  paintCanvas.position.y = paintingY;\n  paintGroup.add(paintCanvas);\n  const pfTop = new THREE.Mesh(\n    new THREE.BoxGeometry(paintingW, paintFrameThick, 0.1),\n    new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.5, metalness: 0.25 })\n  );\n  pfTop.position.y = paintingY + paintingH * 0.5;\n  const pfBot = pfTop.clone();\n  pfBot.position.y = paintingY - paintingH * 0.5;\n  const pfLeft = new THREE.Mesh(\n    new THREE.BoxGeometry(paintFrameThick, paintingH, 0.1),\n    pfTop.material\n  );\n  pfLeft.position.set(-paintingW * 0.5, paintingY, 0);\n  const pfRight = pfLeft.clone();\n  pfRight.position.x = paintingW * 0.5;\n  paintGroup.add(pfTop, pfBot, pfLeft, pfRight);\n  paintGroup.position.set(HOUSE_ROOM_BASE.x, 0, paintingZ);\n  room.add(paintGroup);\n\n  houseRoomFurnitureMeshes.clear();\n  const addFurniture = (id, mesh) => {\n    mesh.visible = false;\n    room.add(mesh);\n    houseRoomFurnitureMeshes.set(id, mesh);\n  };\n\n  const bed = new THREE.Group();\n  const bedFrame = new THREE.Mesh(\n    new THREE.BoxGeometry(3.4, 0.42, 2.2),\n    new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.88 })\n  );\n  bedFrame.position.y = 0.24;\n  bedFrame.castShadow = true;\n  const bedMattress = new THREE.Mesh(\n    new THREE.BoxGeometry(3.16, 0.28, 1.95),\n    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.8 })\n  );\n  bedMattress.position.y = 0.58;\n  const bedPillow = new THREE.Mesh(\n    new THREE.BoxGeometry(0.9, 0.2, 1.7),\n    new THREE.MeshStandardMaterial({ color: 0xbfdbfe, roughness: 0.76 })\n  );\n  bedPillow.position.set(1.15, 0.77, 0);\n  const bedBlanket = new THREE.Mesh(\n    new THREE.BoxGeometry(2.1, 0.12, 1.82),\n    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.82 })\n  );\n  bedBlanket.position.set(-0.12, 0.75, 0);\n  const bedHeadboard = new THREE.Mesh(\n    new THREE.BoxGeometry(0.12, 1.2, 2.2),\n    new THREE.MeshStandardMaterial({ color: 0x5a3118, roughness: 0.85 })\n  );\n  bedHeadboard.position.set(1.65, 0.84, 0);\n  const bedFootboard = new THREE.Mesh(\n    new THREE.BoxGeometry(0.1, 0.6, 2.2),\n    new THREE.MeshStandardMaterial({ color: 0x5a3118, roughness: 0.85 })\n  );\n  bedFootboard.position.set(-1.65, 0.54, 0);\n  const bedThrow = new THREE.Mesh(\n    new THREE.BoxGeometry(0.62, 0.08, 1.82),\n    new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.76 })\n  );\n  bedThrow.position.set(-0.92, 0.82, 0);\n  bed.add(bedFrame, bedMattress, bedPillow, bedBlanket, bedHeadboard, bedFootboard, bedThrow);\n  bed.position.set(bedroomCenterX, floorY, bedroomCenterZ);\n  bed.rotation.y = -Math.PI * 0.5;\n  addFurniture('bed', bed);\n\n  const nightstand = new THREE.Group();\n  const nsTop = new THREE.Mesh(\n    new THREE.BoxGeometry(0.65, 0.08, 0.55),\n    new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.86 })\n  );\n  nsTop.position.y = 0.68;\n  for (const sx of [-1, 1]) {\n    for (const sz of [-1, 1]) {\n      const leg = new THREE.Mesh(\n        new THREE.BoxGeometry(0.06, 0.6, 0.06),\n        new THREE.MeshStandardMaterial({ color: 0x4a2f1f, roughness: 0.88 })\n      );\n      leg.position.set(sx * 0.24, 0.34, sz * 0.18);\n      nightstand.add(leg);\n    }\n  }\n  const nsDrawer = new THREE.Mesh(\n    new THREE.BoxGeometry(0.5, 0.12, 0.02),\n    new THREE.MeshStandardMaterial({ color: 0x3d2515, roughness: 0.82 })\n  );\n  nsDrawer.position.set(0, 0.48, 0.27);\n  const nsKnob = new THREE.Mesh(\n    new THREE.SphereGeometry(0.03, 6, 6),\n    new THREE.MeshStandardMaterial({ color: 0xd4a44a, roughness: 0.3, metalness: 0.5 })\n  );\n  nsKnob.position.set(0, 0.48, 0.29);\n  const nsBook = new THREE.Mesh(\n    new THREE.BoxGeometry(0.26, 0.06, 0.18),\n    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.82 })\n  );\n  nsBook.position.set(-0.12, 0.75, -0.04);\n  const nsCup = new THREE.Mesh(\n    new THREE.CylinderGeometry(0.06, 0.05, 0.12, 10),\n    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.78 })\n  );\n  nsCup.position.set(0.14, 0.78, 0);\n  nightstand.add(nsTop, nsDrawer, nsKnob, nsBook, nsCup);\n  nightstand.position.set(bedroomCenterX, floorY, bedsideZ);\n  room.add(nightstand);\n\n  const table = new THREE.Group();\n  const tableTop = new THREE.Mesh(\n    new THREE.BoxGeometry(2.7, 0.16, 1.34),\n    deskTopMat\n  );\n  tableTop.position.y = 1.08;\n  table.add(tableTop);\n  for (const sx of [-1, 1]) {\n    for (const sz of [-1, 1]) {\n      const leg = new THREE.Mesh(\n        new THREE.BoxGeometry(0.12, 0.95, 0.12),\n        deskBaseMat\n      );\n      leg.position.set(sx * 1.1, 0.54, sz * 0.5);\n      table.add(leg);\n    }\n  }\n  const tableBackRail = new THREE.Mesh(\n    new THREE.BoxGeometry(2.7, 0.14, 0.12),\n    deskBaseMat\n  );\n  tableBackRail.position.set(0, 1.2, -0.61);\n  const drawerStack = new THREE.Mesh(\n    new THREE.BoxGeometry(0.62, 0.92, 1.02),\n    deskBaseMat\n  );\n  drawerStack.position.set(-0.88, 0.55, 0);\n  const drawerFaceTop = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.04), trimMat);\n  drawerFaceTop.position.set(-0.88, 0.72, 0.5);\n  const drawerFaceBottom = drawerFaceTop.clone();\n  drawerFaceBottom.position.y = 0.38;\n  const deskMatTop = new THREE.Mesh(\n    new THREE.BoxGeometry(1.16, 0.025, 0.64),\n    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42 })\n  );\n  deskMatTop.position.set(0.38, 1.17, 0.08);\n  const paperStack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.34), paperMat);\n  paperStack.position.set(0.84, 1.19, -0.12);\n  const toolCup = new THREE.Mesh(\n    new THREE.CylinderGeometry(0.1, 0.09, 0.18, 12),\n    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.48, metalness: 0.32 })\n  );\n  toolCup.position.set(0.98, 1.22, 0.38);\n  const chair = new THREE.Group();\n  const chairSeat = new THREE.Mesh(\n    new THREE.BoxGeometry(0.62, 0.1, 0.62),\n    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.76 })\n  );\n  chairSeat.position.y = 0.6;\n  const chairBack = new THREE.Mesh(\n    new THREE.BoxGeometry(0.62, 0.64, 0.08),\n    new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.78 })\n  );\n  chairBack.position.set(0, 0.98, -0.27);\n  const chairSupport = new THREE.Mesh(\n    new THREE.CylinderGeometry(0.06, 0.08, 0.46, 10),\n    new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.42, metalness: 0.52 })\n  );\n  chairSupport.position.y = 0.3;\n  const chairBase = new THREE.Mesh(\n    new THREE.CylinderGeometry(0.26, 0.22, 0.05, 12),\n    deskBaseMat\n  );\n  chairBase.position.y = 0.03;\n  chair.add(chairSeat, chairBack, chairSupport, chairBase);\n  chair.position.set(0.48, 0, 1.18);\n  table.add(\n    tableBackRail,\n    drawerStack,\n    drawerFaceTop,\n    drawerFaceBottom,\n    deskMatTop,\n    paperStack,\n    toolCup,\n    chair\n  );\n  table.position.set(workspaceCenterX, floorY, workspaceDeskZ);\n  table.castShadow = true;\n  addFurniture('table', table);\n\n  const lamp = new THREE.Group();\n  const lampBase = new THREE.Mesh(\n    new THREE.CylinderGeometry(0.22, 0.26, 0.08, 12),\n    new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.45, metalness: 0.5 })\n  );\n  lampBase.position.y = 0.08;\n  const lampStem = new THREE.Mesh(\n    new THREE.CylinderGeometry(0.035, 0.05, 1.3, 12),\n    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.48, metalness: 0.52 })\n  );\n  lampStem.position.y = 0.74;\n  const lampArm = new THREE.Mesh(\n    new THREE.CylinderGeometry(0.03, 0.035, 0.82, 10),\n    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.48, metalness: 0.52 })\n  );\n  lampArm.position.set(0.24, 1.48, 0);\n  lampArm.rotation.z = -Math.PI * 0.34;\n  const lampShade = new THREE.Mesh(\n    new THREE.ConeGeometry(0.26, 0.42, 14),\n    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.54 })\n  );\n  lampShade.position.set(0.44, 1.74, 0);\n  lampShade.rotation.x = Math.PI;\n  lampShade.rotation.z = -Math.PI * 0.1;\n  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), bulbMat);\n  lampBulb.position.set(0.44, 1.58, 0);\n  const lampGlow = new THREE.PointLight(0xfef3c7, 0.75, 9, 2);\n  lampGlow.position.set(0.44, 1.58, 0);\n  lamp.add(lampBase, lampStem, lampArm, lampShade, lampBulb, lampGlow);\n  lamp.position.set(readingCornerX, floorY, readingCornerZ);\n  lamp.rotation.y = Math.PI * 0.14;\n  addFurniture('lamp', lamp);\n\n  const plant = new THREE.Group();\n  const pot = new THREE.Mesh(\n    new THREE.CylinderGeometry(0.25, 0.3, 0.4, 12),\n    new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.82 })\n  );\n  pot.position.y = 0.22;\n  const potRim = new THREE.Mesh(\n    new THREE.TorusGeometry(0.26, 0.03, 6, 12),\n    new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 })\n  );\n  potRim.position.y = 0.42;\n  potRim.rotation.x = Math.PI / 2;\n  const leaves = new THREE.Mesh(\n    new THREE.DodecahedronGeometry(0.42, 1),\n    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 })\n  );\n  leaves.position.y = 0.82;\n  const trunk = new THREE.Mesh(\n    new THREE.CylinderGeometry(0.06, 0.08, 0.48, 6),\n    new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.85 })\n  );\n  trunk.position.y = 0.56;\n  plant.add(pot, potRim, trunk, leaves);\n  plant.position.set(roomCenterX - halfWidth + 2.45, floorY, roomCenterZ + 2.1);\n  addFurniture('plant', plant);\n\n  const sofa = new THREE.Group();\n  const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.36, 1.1), sofaMat);\n  sofaBase.position.y = 0.42;\n  const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.78, 0.18), sofaMat);\n  sofaBack.position.set(0, 0.86, -0.46);\n  const sofaArmL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 1.02), sofaAccentMat);\n  sofaArmL.position.set(-1.2, 0.6, 0);\n  const sofaArmR = sofaArmL.clone();\n  sofaArmR.position.x = 1.2;\n  const sofaCushion = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 0.92), linenMat);\n  sofaCushion.position.y = 0.6;\n  for (const sx of [-1, 1]) {\n    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.08), deskBaseMat);\n    leg.position.set(sx * 1.1, 0.13, -0.36);\n    sofa.add(leg);\n    const legBack = leg.clone();\n    legBack.position.z = 0.36;\n    sofa.add(legBack);\n  }\n  sofa.add(sofaBase, sofaBack, sofaArmL, sofaArmR, sofaCushion);\n  sofa.position.set(loungeCenterX - 2.2, floorY, loungeCenterZ + 0.75);\n  sofa.rotation.y = Math.PI * 0.5;\n  addFurniture('sofa', sofa);\n\n  const coffeeTable = new THREE.Group();\n  const coffeeTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.76), deskTopMat);\n  coffeeTop.position.y = 0.46;\n  coffeeTable.add(coffeeTop);\n  for (const sx of [-1, 1]) {\n    for (const sz of [-1, 1]) {\n      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), deskBaseMat);\n      leg.position.set(sx * 0.52, 0.2, sz * 0.26);\n      coffeeTable.add(leg);\n    }\n  }\n  coffeeTable.position.set(loungeCenterX - 0.6, floorY, loungeCenterZ + 0.45);\n  addFurniture('coffee-table', coffeeTable);\n\n  const bookshelf = new THREE.Group();\n  const shelfBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.3, 0.34), shelfMat);\n  shelfBody.position.y = 1.15;\n  bookshelf.add(shelfBody);\n  const shelfSlots = [-0.65, 0, 0.65];\n  shelfSlots.forEach((offsetY) => {\n    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.3), deskBaseMat);\n    shelf.position.set(0, 1.15 + offsetY, 0.02);\n    bookshelf.add(shelf);\n  });\n  const bookPalette = [0x2563eb, 0x16a34a, 0xdc2626, 0xf59e0b];\n  bookPalette.forEach((color, i) => {\n    const book = new THREE.Mesh(\n      new THREE.BoxGeometry(0.16, 0.3, 0.22),\n      new THREE.MeshStandardMaterial({ color, roughness: 0.75 })\n    );\n    book.position.set(-0.5 + i * 0.32, 1.62, 0.08);\n    bookshelf.add(book);\n  });\n  bookshelf.position.set(roomCenterX - halfWidth + 1.05, floorY, roomCenterZ - 1.6);\n  bookshelf.rotation.y = Math.PI * 0.5;\n  addFurniture('bookshelf', bookshelf);\n\n  const dresser = new THREE.Group();\n  const dresserBody = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 0.62), deskBaseMat);\n  dresserBody.position.y = 0.55;\n  const dresserTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.7), deskTopMat);\n  dresserTop.position.y = 1.02;\n  dresser.add(dresserBody, dresserTop);\n  for (let i = 0; i < 3; i += 1) {\n    const drawer = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.04), accentPanelMat);\n    drawer.position.set(0, 0.3 + i * 0.24, 0.34);\n    dresser.add(drawer);\n  }\n  dresser.position.set(roomCenterX + halfWidth - 1.4, floorY, roomCenterZ + 1.45);\n  dresser.rotation.y = -Math.PI * 0.5;\n  addFurniture('dresser', dresser);\n\n  const bedroomRug = new THREE.Group();\n  const rugBase = new THREE.Mesh(\n    new THREE.BoxGeometry(3.1, 0.035, 2.1),\n    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.82 })\n  );\n  rugBase.position.y = 0.02;\n  const rugInset = new THREE.Mesh(\n    new THREE.BoxGeometry(2.4, 0.03, 1.5),\n    new THREE.MeshStandardMaterial({ color: 0xcbd5f5, roughness: 0.8 })\n  );\n  rugInset.position.y = 0.035;\n  bedroomRug.add(rugBase, rugInset);\n  bedroomRug.position.set(bedroomCenterX, floorY, bedroomCenterZ);\n  addFurniture('rug', bedroomRug);\n\n  const wallArt = new THREE.Group();\n  const artFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.05, 0.08), accentPanelMat);\n  artFrame.position.y = 2.55;\n  const artCanvas = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.8, 0.04), artCanvasMat);\n  artCanvas.position.y = 2.55;\n  artCanvas.position.z = 0.04;\n  wallArt.add(artFrame, artCanvas);\n  wallArt.position.set(roomCenterX - halfWidth + 0.12, floorY, roomCenterZ + 1.2);\n  wallArt.rotation.y = Math.PI * 0.5;\n  addFurniture('wallart', wallArt);\n\n  const readingChair = new THREE.Group();\n  const readingSeat = new THREE.Mesh(\n    new THREE.BoxGeometry(1.0, 0.2, 1.04),\n    new THREE.MeshStandardMaterial({ color: 0xe7d7bd, roughness: 0.86 })\n  );\n  readingSeat.position.y = 0.48;\n  const readingBack = new THREE.Mesh(\n    new THREE.BoxGeometry(1.0, 1.0, 0.16),\n    new THREE.MeshStandardMaterial({ color: 0xd6c2a1, roughness: 0.84 })\n  );\n  readingBack.position.set(0, 1.02, -0.44);\n  const readingArmL = new THREE.Mesh(\n    new THREE.BoxGeometry(0.14, 0.66, 0.92),\n    new THREE.MeshStandardMaterial({ color: 0xc8b38d, roughness: 0.84 })\n  );\n  readingArmL.position.set(-0.46, 0.72, 0);\n  const readingArmR = readingArmL.clone();\n  readingArmR.position.x = 0.46;\n  const chairCushion = new THREE.Mesh(\n    new THREE.BoxGeometry(0.86, 0.12, 0.88),\n    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 })\n  );\n  chairCushion.position.y = 0.6;\n  for (const sx of [-1, 1]) {\n    for (const sz of [-1, 1]) {\n      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.08), deskBaseMat);\n      leg.position.set(sx * 0.34, 0.2, sz * 0.28);\n      readingChair.add(leg);\n    }\n  }\n  readingChair.add(readingSeat, readingBack, readingArmL, readingArmR, chairCushion);\n  readingChair.position.set(readingCornerX - 0.62, floorY, readingCornerZ + 0.04);\n  readingChair.rotation.y = Math.PI * 0.3;\n  room.add(readingChair);\n\n  const readingSideTable = new THREE.Group();\n  const readingSideTop = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.08, 16), deskTopMat);\n  readingSideTop.position.y = 0.6;\n  const readingSideBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.56, 12), bracketMat);\n  readingSideBase.position.y = 0.28;\n  const readingSideFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.05, 14), deskBaseMat);\n  readingSideFoot.position.y = 0.03;\n  const readingBook = new THREE.Mesh(\n    new THREE.BoxGeometry(0.28, 0.05, 0.2),\n    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.82 })\n  );\n  readingBook.position.set(-0.06, 0.67, 0.04);\n  const readingMug = nsCup.clone();\n  readingMug.position.set(0.1, 0.7, -0.04);\n  readingSideTable.add(readingSideTop, readingSideBase, readingSideFoot, readingBook, readingMug);\n  readingSideTable.position.set(readingCornerX - 1.58, floorY, readingCornerZ - 0.62);\n  room.add(readingSideTable);\n\n  const blanketBench = new THREE.Group();\n  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 0.52), deskTopMat);\n  benchTop.position.y = 0.5;\n  blanketBench.add(benchTop);\n  for (const sx of [-1, 1]) {\n    for (const sz of [-1, 1]) {\n      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.08), deskBaseMat);\n      leg.position.set(sx * 0.66, 0.22, sz * 0.18);\n      blanketBench.add(leg);\n    }\n  }\n  blanketBench.position.set(bedroomCenterX - 2.2, floorY, bedroomCenterZ);\n  room.add(blanketBench);\n\n  room.traverse((obj) => {\n    if (!obj?.isMesh) return;\n    obj.castShadow = false;\n    obj.receiveShadow = false;\n  });\n\n   scene.add(room);\n   room.visible = false;\n   houseRoomGroup = room;\n   addWallCollisionFromMesh(backWall, 'house-room');\n   addWallCollisionFromMesh(leftWall, 'house-room');\n   addWallCollisionFromMesh(rightWall, 'house-room');\n   addWallCollisionFromMesh(frontLeftWall, 'house-room');\n   addWallCollisionFromMesh(frontRightWall, 'house-room');\n   addWallCollisionFromMesh(frontTopWall, 'house-room');\n   addWorldCollider(bedroomCenterX, bedsideZ, 0.44, 'house-room');\n   addWorldCollider(readingCornerX - 0.62, readingCornerZ + 0.04, 0.74, 'house-room');\n   addWorldCollider(readingCornerX - 1.58, readingCornerZ - 0.62, 0.34, 'house-room');\n   addWorldCollider(bedroomCenterX - 2.2, bedroomCenterZ, 0.7, 'house-room');\n   applyHomeRoomVisuals();\n\n}");

export function addMainHouseRoomInterior() {
  return addMainHouseRoomInteriorImpl(houseRoomContext);
}

export function addFishingShopInterior() {
   const {
     GROUND_Y,
     FISHING_SHOP_BASE,
     SHOP_INTERIOR_HALF_DEPTH,
     SHOP_INTERIOR_HALF_WIDTH,
     FISHING_SHOP_COUNTER_POS,
     FISHING_SHOP_EXIT_POS
   } = layout;
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
   const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x2d2218, roughness: 0.85 });
   const crownMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.82 });
   const glassMat = new THREE.MeshStandardMaterial({ color: 0xa8d4f0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35 });
   const frameMat = new THREE.MeshStandardMaterial({ color: 0x2d2218, roughness: 0.85 });
   const brassMat = new THREE.MeshStandardMaterial({ color: 0xc69332, roughness: 0.28, metalness: 0.82 });
   const lanternMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.82 });
   const lanternGlowMat = new THREE.MeshStandardMaterial({ color: 0xfff4cc, roughness: 0.5, emissive: 0xffe8a0, emissiveIntensity: 0.3 });

   const floor = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.22, halfDepth * 2), floorMat);
   floor.position.set(FISHING_SHOP_BASE.x, floorY - 0.11, FISHING_SHOP_BASE.z);
   floor.receiveShadow = true;
   shop.add(floor);

   const floorTileMat = new THREE.MeshStandardMaterial({ color: 0x4a3c2e, roughness: 0.88 });
   for (let ix = -3; ix <= 3; ix += 1) {
     for (let iz = -2; iz <= 2; iz += 1) {
       if ((ix + iz) % 2 === 0) {
         const tile = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 / 7 - 0.04, 0.02, halfDepth * 2 / 5 - 0.04), floorTileMat);
         tile.position.set(FISHING_SHOP_BASE.x + ix * (halfWidth * 2 / 7), floorY + 0.01, FISHING_SHOP_BASE.z + iz * (halfDepth * 2 / 5));
         tile.receiveShadow = true;
         shop.add(tile);
       }
     }
   }

   const ceiling = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.18, halfDepth * 2), trimMat);
   ceiling.position.set(FISHING_SHOP_BASE.x, floorY + wallHeight + 0.1, FISHING_SHOP_BASE.z);
   ceiling.receiveShadow = true;
   shop.add(ceiling);

   const beamMat = new THREE.MeshStandardMaterial({ color: 0x2d1f14, roughness: 0.88 });
   for (let i = -1; i <= 1; i += 1) {
     const beam = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 - 0.5, 0.22, 0.28), beamMat);
     beam.position.set(FISHING_SHOP_BASE.x, floorY + wallHeight - 0.12, FISHING_SHOP_BASE.z + i * (halfDepth * 0.8));
     beam.castShadow = true;
     beam.receiveShadow = true;
     shop.add(beam);
   }

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

   const baseboardH = 0.28;
   const baseboardInset = 0.02;
   const bbBack = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 - 0.2, baseboardH, 0.06), baseboardMat);
   bbBack.position.set(FISHING_SHOP_BASE.x, floorY + baseboardH * 0.5, FISHING_SHOP_BASE.z - halfDepth + wallThickness + baseboardInset);
   shop.add(bbBack);
   const bbLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, baseboardH, halfDepth * 2 - 0.2), baseboardMat);
   bbLeft.position.set(FISHING_SHOP_BASE.x - halfWidth + wallThickness + baseboardInset, floorY + baseboardH * 0.5, FISHING_SHOP_BASE.z);
   shop.add(bbLeft);
   const bbRight = bbLeft.clone();
   bbRight.position.x = FISHING_SHOP_BASE.x + halfWidth - wallThickness - baseboardInset;
   shop.add(bbRight);

   const crownH = 0.18;
   const crBack = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 - 0.2, crownH, 0.08), crownMat);
   crBack.position.set(FISHING_SHOP_BASE.x, floorY + wallHeight - crownH * 0.5, FISHING_SHOP_BASE.z - halfDepth + wallThickness + baseboardInset);
   shop.add(crBack);
   const crLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, crownH, halfDepth * 2 - 0.2), crownMat);
   crLeft.position.set(FISHING_SHOP_BASE.x - halfWidth + wallThickness + baseboardInset, floorY + wallHeight - crownH * 0.5, FISHING_SHOP_BASE.z);
   shop.add(crLeft);
   const crRight = crLeft.clone();
   crRight.position.x = FISHING_SHOP_BASE.x + halfWidth - wallThickness - baseboardInset;
   shop.add(crRight);

   const winW = 1.8;
   const winH = 2.2;
   const winY = floorY + wallHeight * 0.45;
   for (const side of [-1, 1]) {
     const wx = FISHING_SHOP_BASE.x + side * (halfWidth - 0.01);
     const wz = FISHING_SHOP_BASE.z - 1.2;
     const glass = new THREE.Mesh(new THREE.BoxGeometry(0.06, winH, winW), glassMat);
     glass.position.set(wx - side * 0.02, winY, wz);
     shop.add(glass);
     const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.1, winH + 0.16, 0.1), frameMat);
     frameL.position.set(wx, winY, wz - winW * 0.5 - 0.04);
     shop.add(frameL);
     const frameR = frameL.clone();
     frameR.position.z = wz + winW * 0.5 + 0.04;
     shop.add(frameR);
     const frameT = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, winW + 0.16), frameMat);
     frameT.position.set(wx, winY + winH * 0.5 + 0.04, wz);
     shop.add(frameT);
     const frameB = frameT.clone();
     frameB.position.y = winY - winH * 0.5 - 0.04;
     shop.add(frameB);
     const sill = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, winW + 0.2), frameMat);
     sill.position.set(wx - side * 0.06, winY - winH * 0.5 - 0.1, wz);
     shop.add(sill);
   }

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
   setFishingShopExitMarker?.(exitRing);

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

    const sconceMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.78, metalness: 0.2 });
    const sconceArmMat = new THREE.MeshStandardMaterial({ color: 0x2d2218, roughness: 0.82 });
    const sconcePositions = [
      [FISHING_SHOP_BASE.x - halfWidth + 0.15, floorY + 2.8, FISHING_SHOP_BASE.z + 0.5],
      [FISHING_SHOP_BASE.x + halfWidth - 0.15, floorY + 2.8, FISHING_SHOP_BASE.z + 0.5],
      [FISHING_SHOP_BASE.x - halfWidth + 0.15, floorY + 2.8, FISHING_SHOP_BASE.z + 1.8],
      [FISHING_SHOP_BASE.x + halfWidth - 0.15, floorY + 2.8, FISHING_SHOP_BASE.z + 1.8]
    ];
    for (const [sx, sy, sz] of sconcePositions) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.3), sconceArmMat);
      arm.position.set(sx, sy, sz);
      shop.add(arm);
      const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 8), sconceMat);
      holder.position.set(sx, sy + 0.04, sz + 0.12);
      shop.add(holder);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), lanternGlowMat);
      flame.position.set(sx, sy + 0.14, sz + 0.12);
      shop.add(flame);
    }

    for (let i = 0; i < 2; i += 1) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.72, 12), barrelMat);
      barrel.position.set(FISHING_SHOP_BASE.x - halfWidth + 1.0 + i * 1.1, floorY + 0.36, FISHING_SHOP_BASE.z - halfDepth + 1.0);
      barrel.castShadow = true;
      barrel.receiveShadow = true;
      shop.add(barrel);
      const barrelBand = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 6, 16), brassMat);
      barrelBand.rotation.x = Math.PI * 0.5;
      barrelBand.position.set(barrel.position.x, floorY + 0.22, barrel.position.z);
      shop.add(barrelBand);
      const barrelBand2 = barrelBand.clone();
      barrelBand2.position.y = floorY + 0.52;
      shop.add(barrelBand2);
    }

    const ropeCoilMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.92 });
    for (let i = 0; i < 3; i += 1) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22 + i * 0.06, 0.035, 6, 16), ropeCoilMat);
      coil.rotation.x = Math.PI * 0.5;
      coil.position.set(FISHING_SHOP_BASE.x + halfWidth - 1.2, floorY + 0.06, FISHING_SHOP_BASE.z - halfDepth + 1.5);
      shop.add(coil);
    }

    const hookMat = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.4, metalness: 0.6 });
    for (let i = 0; i < 4; i += 1) {
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 6), hookMat);
      hook.position.set(FISHING_SHOP_BASE.x - 1.8 + i * 0.9, floorY + 4.2, FISHING_SHOP_BASE.z - halfDepth + 0.3);
      shop.add(hook);
      const hookBase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), shelfMat);
      hookBase.position.set(hook.position.x, floorY + 4.34, hook.position.z);
      shop.add(hookBase);
    }

    const lanternShadeMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5, side: THREE.DoubleSide });
    const hangingLantern = new THREE.Group();
    const lanternBody = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.35, 10), lanternMat);
    hangingLantern.add(lanternBody);
    const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.28, 10, 1, true), lanternShadeMat);
    hangingLantern.add(lanternGlass);
    const lanternTop = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.15, 10), lanternMat);
    lanternTop.position.y = 0.24;
    hangingLantern.add(lanternTop);
    const lanternHandle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 12, Math.PI), brassMat);
    lanternHandle.position.y = 0.32;
    hangingLantern.add(lanternHandle);
    const lanternLight = new THREE.PointLight(0xffe8a0, 0.5, 5);
    lanternLight.position.y = 0;
    hangingLantern.add(lanternLight);
    hangingLantern.position.set(FISHING_SHOP_BASE.x - 2.2, floorY + wallHeight - 0.6, FISHING_SHOP_BASE.z + 0.5);
    shop.add(hangingLantern);

    const hangingLantern2 = hangingLantern.clone();
    hangingLantern2.position.set(FISHING_SHOP_BASE.x + 2.2, floorY + wallHeight - 0.6, FISHING_SHOP_BASE.z + 0.5);
    shop.add(hangingLantern2);

    const ambientLight = new THREE.AmbientLight(0xfff4e0, 0.18);
    shop.add(ambientLight);

    shop.traverse((obj) => {
     if (!obj?.isMesh) return;
     obj.castShadow = false;
     obj.receiveShadow = false;
   });

   scene.add(shop);
  shop.visible = false;
  setFishingShopGroup?.(shop);
  addWallCollisionFromMesh(backWall, 'fishing-shop');
  addWallCollisionFromMesh(leftWall, 'fishing-shop');
  addWallCollisionFromMesh(rightWall, 'fishing-shop');
  addWallCollisionFromMesh(frontLeftWall, 'fishing-shop');
  addWallCollisionFromMesh(frontRightWall, 'fishing-shop');
   addWallCollisionFromMesh(frontTopWall, 'fishing-shop');
   addWorldCollider(FISHING_SHOP_COUNTER_POS.x, FISHING_SHOP_COUNTER_POS.z, 2.2, 'fishing-shop');
}

export function addMarketShopInterior() {
   const {
     GROUND_Y,
     MARKET_SHOP_BASE,
     SHOP_INTERIOR_HALF_DEPTH,
     SHOP_INTERIOR_HALF_WIDTH,
     MARKET_SHOP_COUNTER_POS,
     MARKET_SHOP_EXIT_POS
   } = layout;
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
   const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x2d1f14, roughness: 0.85 });
   const crownMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.82 });
   const glassMat = new THREE.MeshStandardMaterial({ color: 0xc9e4a8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35 });
   const frameMat = new THREE.MeshStandardMaterial({ color: 0x2d1f14, roughness: 0.85 });
   const brassMat = new THREE.MeshStandardMaterial({ color: 0xc69332, roughness: 0.28, metalness: 0.82 });
   const lanternMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.82 });
   const lanternGlowMat = new THREE.MeshStandardMaterial({ color: 0xfff4cc, roughness: 0.5, emissive: 0xffe8a0, emissiveIntensity: 0.3 });

   const floor = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.22, halfDepth * 2), floorMat);
   floor.position.set(MARKET_SHOP_BASE.x, floorY - 0.11, MARKET_SHOP_BASE.z);
   floor.receiveShadow = true;
   shop.add(floor);

   const floorTileMat = new THREE.MeshStandardMaterial({ color: 0x4a3c2e, roughness: 0.88 });
   for (let ix = -3; ix <= 3; ix += 1) {
     for (let iz = -2; iz <= 2; iz += 1) {
       if ((ix + iz) % 2 === 0) {
         const tile = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 / 7 - 0.04, 0.02, halfDepth * 2 / 5 - 0.04), floorTileMat);
         tile.position.set(MARKET_SHOP_BASE.x + ix * (halfWidth * 2 / 7), floorY + 0.01, MARKET_SHOP_BASE.z + iz * (halfDepth * 2 / 5));
         tile.receiveShadow = true;
         shop.add(tile);
       }
     }
   }

   const ceiling = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.18, halfDepth * 2), trimMat);
   ceiling.position.set(MARKET_SHOP_BASE.x, floorY + wallHeight + 0.1, MARKET_SHOP_BASE.z);
   ceiling.receiveShadow = true;
   shop.add(ceiling);

   const beamMat = new THREE.MeshStandardMaterial({ color: 0x2d1f14, roughness: 0.88 });
   for (let i = -1; i <= 1; i += 1) {
     const beam = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 - 0.5, 0.22, 0.28), beamMat);
     beam.position.set(MARKET_SHOP_BASE.x, floorY + wallHeight - 0.12, MARKET_SHOP_BASE.z + i * (halfDepth * 0.8));
     beam.castShadow = true;
     beam.receiveShadow = true;
     shop.add(beam);
   }

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

   const baseboardH = 0.28;
   const baseboardInset = 0.02;
   const bbBack = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 - 0.2, baseboardH, 0.06), baseboardMat);
   bbBack.position.set(MARKET_SHOP_BASE.x, floorY + baseboardH * 0.5, MARKET_SHOP_BASE.z - halfDepth + wallThickness + baseboardInset);
   shop.add(bbBack);
   const bbLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, baseboardH, halfDepth * 2 - 0.2), baseboardMat);
   bbLeft.position.set(MARKET_SHOP_BASE.x - halfWidth + wallThickness + baseboardInset, floorY + baseboardH * 0.5, MARKET_SHOP_BASE.z);
   shop.add(bbLeft);
   const bbRight = bbLeft.clone();
   bbRight.position.x = MARKET_SHOP_BASE.x + halfWidth - wallThickness - baseboardInset;
   shop.add(bbRight);

   const crownH = 0.18;
   const crBack = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 - 0.2, crownH, 0.08), crownMat);
   crBack.position.set(MARKET_SHOP_BASE.x, floorY + wallHeight - crownH * 0.5, MARKET_SHOP_BASE.z - halfDepth + wallThickness + baseboardInset);
   shop.add(crBack);
   const crLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, crownH, halfDepth * 2 - 0.2), crownMat);
   crLeft.position.set(MARKET_SHOP_BASE.x - halfWidth + wallThickness + baseboardInset, floorY + wallHeight - crownH * 0.5, MARKET_SHOP_BASE.z);
   shop.add(crLeft);
   const crRight = crLeft.clone();
   crRight.position.x = MARKET_SHOP_BASE.x + halfWidth - wallThickness - baseboardInset;
   shop.add(crRight);

   const winW = 1.8;
   const winH = 2.2;
   const winY = floorY + wallHeight * 0.45;
   for (const side of [-1, 1]) {
     const wx = MARKET_SHOP_BASE.x + side * (halfWidth - 0.01);
     const wz = MARKET_SHOP_BASE.z - 1.2;
     const glass = new THREE.Mesh(new THREE.BoxGeometry(0.06, winH, winW), glassMat);
     glass.position.set(wx - side * 0.02, winY, wz);
     shop.add(glass);
     const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.1, winH + 0.16, 0.1), frameMat);
     frameL.position.set(wx, winY, wz - winW * 0.5 - 0.04);
     shop.add(frameL);
     const frameR = frameL.clone();
     frameR.position.z = wz + winW * 0.5 + 0.04;
     shop.add(frameR);
     const frameT = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, winW + 0.16), frameMat);
     frameT.position.set(wx, winY + winH * 0.5 + 0.04, wz);
     shop.add(frameT);
     const frameB = frameT.clone();
     frameB.position.y = winY - winH * 0.5 - 0.04;
     shop.add(frameB);
     const sill = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, winW + 0.2), frameMat);
     sill.position.set(wx - side * 0.06, winY - winH * 0.5 - 0.1, wz);
     shop.add(sill);
   }

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
   setMarketShopExitMarker?.(exitRing);

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

    const sconceMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.78, metalness: 0.2 });
    const sconceArmMat = new THREE.MeshStandardMaterial({ color: 0x2d1f14, roughness: 0.82 });
    const sconcePositions = [
      [MARKET_SHOP_BASE.x - halfWidth + 0.15, floorY + 2.8, MARKET_SHOP_BASE.z + 0.5],
      [MARKET_SHOP_BASE.x + halfWidth - 0.15, floorY + 2.8, MARKET_SHOP_BASE.z + 0.5],
      [MARKET_SHOP_BASE.x - halfWidth + 0.15, floorY + 2.8, MARKET_SHOP_BASE.z + 1.8],
      [MARKET_SHOP_BASE.x + halfWidth - 0.15, floorY + 2.8, MARKET_SHOP_BASE.z + 1.8]
    ];
    for (const [sx, sy, sz] of sconcePositions) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.3), sconceArmMat);
      arm.position.set(sx, sy, sz);
      shop.add(arm);
      const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 8), sconceMat);
      holder.position.set(sx, sy + 0.04, sz + 0.12);
      shop.add(holder);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), lanternGlowMat);
      flame.position.set(sx, sy + 0.14, sz + 0.12);
      shop.add(flame);
    }

    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.86 });
    for (let i = 0; i < 2; i += 1) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.72, 12), barrelMat);
      barrel.position.set(MARKET_SHOP_BASE.x - halfWidth + 1.0 + i * 1.1, floorY + 0.36, MARKET_SHOP_BASE.z - halfDepth + 1.0);
      barrel.castShadow = true;
      barrel.receiveShadow = true;
      shop.add(barrel);
      const barrelBand = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 6, 16), brassMat);
      barrelBand.rotation.x = Math.PI * 0.5;
      barrelBand.position.set(barrel.position.x, floorY + 0.22, barrel.position.z);
      shop.add(barrelBand);
      const barrelBand2 = barrelBand.clone();
      barrelBand2.position.y = floorY + 0.52;
      shop.add(barrelBand2);
    }

    const crateMat = new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.88 });
    for (let i = 0; i < 3; i += 1) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.55), crateMat);
      crate.position.set(MARKET_SHOP_BASE.x + halfWidth - 1.2, floorY + 0.22, MARKET_SHOP_BASE.z - halfDepth + 1.2 + i * 0.7);
      crate.rotation.y = i * 0.15;
      crate.castShadow = true;
      crate.receiveShadow = true;
      shop.add(crate);
    }

    const lanternShadeMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5, side: THREE.DoubleSide });
    const hangingLantern = new THREE.Group();
    const lanternBody = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.35, 10), lanternMat);
    hangingLantern.add(lanternBody);
    const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.28, 10, 1, true), lanternShadeMat);
    hangingLantern.add(lanternGlass);
    const lanternTop = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.15, 10), lanternMat);
    lanternTop.position.y = 0.24;
    hangingLantern.add(lanternTop);
    const lanternHandle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 12, Math.PI), brassMat);
    lanternHandle.position.y = 0.32;
    hangingLantern.add(lanternHandle);
    const lanternLight = new THREE.PointLight(0xffe8a0, 0.5, 5);
    lanternLight.position.y = 0;
    hangingLantern.add(lanternLight);
    hangingLantern.position.set(MARKET_SHOP_BASE.x - 2.2, floorY + wallHeight - 0.6, MARKET_SHOP_BASE.z + 0.5);
    shop.add(hangingLantern);

    const hangingLantern2 = hangingLantern.clone();
    hangingLantern2.position.set(MARKET_SHOP_BASE.x + 2.2, floorY + wallHeight - 0.6, MARKET_SHOP_BASE.z + 0.5);
    shop.add(hangingLantern2);

    const ambientLight = new THREE.AmbientLight(0xfff4e0, 0.18);
    shop.add(ambientLight);

    shop.traverse((obj) => {
     if (!obj?.isMesh) return;
     obj.castShadow = false;
     obj.receiveShadow = false;
   });

   scene.add(shop);
   shop.visible = false;
   setMarketShopGroup?.(shop);
   addWallCollisionFromMesh(backWall, 'market-shop');
   addWallCollisionFromMesh(leftWall, 'market-shop');
   addWallCollisionFromMesh(rightWall, 'market-shop');
   addWallCollisionFromMesh(frontLeftWall, 'market-shop');
   addWallCollisionFromMesh(frontRightWall, 'market-shop');
   addWallCollisionFromMesh(frontTopWall, 'market-shop');
   addWorldCollider(MARKET_SHOP_COUNTER_POS.x, MARKET_SHOP_COUNTER_POS.z, 2.3, 'market-shop');
}

export function addFurnitureShopInterior() {
   const {
     GROUND_Y,
     FURNITURE_SHOP_BASE,
     SHOP_INTERIOR_HALF_DEPTH,
     SHOP_INTERIOR_HALF_WIDTH,
     FURNITURE_SHOP_COUNTER_POS,
     FURNITURE_SHOP_EXIT_POS
   } = layout;
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
   const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x2d1f14, roughness: 0.85 });
   const crownMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.82 });
   const glassMat = new THREE.MeshStandardMaterial({ color: 0xd4b8e8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35 });
   const frameMat = new THREE.MeshStandardMaterial({ color: 0x2d1f14, roughness: 0.85 });
   const brassMat = new THREE.MeshStandardMaterial({ color: 0xc69332, roughness: 0.28, metalness: 0.82 });
   const lanternMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.82 });
   const lanternGlowMat = new THREE.MeshStandardMaterial({ color: 0xfff4cc, roughness: 0.5, emissive: 0xffe8a0, emissiveIntensity: 0.3 });

   const floor = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.22, halfDepth * 2), floorMat);
   floor.position.set(FURNITURE_SHOP_BASE.x, floorY - 0.11, FURNITURE_SHOP_BASE.z);
   floor.receiveShadow = true;
   shop.add(floor);

   const floorTileMat = new THREE.MeshStandardMaterial({ color: 0x4a3c2e, roughness: 0.88 });
   for (let ix = -3; ix <= 3; ix += 1) {
     for (let iz = -2; iz <= 2; iz += 1) {
       if ((ix + iz) % 2 === 0) {
         const tile = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 / 7 - 0.04, 0.02, halfDepth * 2 / 5 - 0.04), floorTileMat);
         tile.position.set(FURNITURE_SHOP_BASE.x + ix * (halfWidth * 2 / 7), floorY + 0.01, FURNITURE_SHOP_BASE.z + iz * (halfDepth * 2 / 5));
         tile.receiveShadow = true;
         shop.add(tile);
       }
     }
   }

   const ceiling = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.18, halfDepth * 2), trimMat);
   ceiling.position.set(FURNITURE_SHOP_BASE.x, floorY + wallHeight + 0.1, FURNITURE_SHOP_BASE.z);
   ceiling.receiveShadow = true;
   shop.add(ceiling);

   const beamMat = new THREE.MeshStandardMaterial({ color: 0x2d1f14, roughness: 0.88 });
   for (let i = -1; i <= 1; i += 1) {
     const beam = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 - 0.5, 0.22, 0.28), beamMat);
     beam.position.set(FURNITURE_SHOP_BASE.x, floorY + wallHeight - 0.12, FURNITURE_SHOP_BASE.z + i * (halfDepth * 0.8));
     beam.castShadow = true;
     beam.receiveShadow = true;
     shop.add(beam);
   }

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

   const baseboardH = 0.28;
   const baseboardInset = 0.02;
   const bbBack = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 - 0.2, baseboardH, 0.06), baseboardMat);
   bbBack.position.set(FURNITURE_SHOP_BASE.x, floorY + baseboardH * 0.5, FURNITURE_SHOP_BASE.z - halfDepth + wallThickness + baseboardInset);
   shop.add(bbBack);
   const bbLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, baseboardH, halfDepth * 2 - 0.2), baseboardMat);
   bbLeft.position.set(FURNITURE_SHOP_BASE.x - halfWidth + wallThickness + baseboardInset, floorY + baseboardH * 0.5, FURNITURE_SHOP_BASE.z);
   shop.add(bbLeft);
   const bbRight = bbLeft.clone();
   bbRight.position.x = FURNITURE_SHOP_BASE.x + halfWidth - wallThickness - baseboardInset;
   shop.add(bbRight);

   const crownH = 0.18;
   const crBack = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 - 0.2, crownH, 0.08), crownMat);
   crBack.position.set(FURNITURE_SHOP_BASE.x, floorY + wallHeight - crownH * 0.5, FURNITURE_SHOP_BASE.z - halfDepth + wallThickness + baseboardInset);
   shop.add(crBack);
   const crLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, crownH, halfDepth * 2 - 0.2), crownMat);
   crLeft.position.set(FURNITURE_SHOP_BASE.x - halfWidth + wallThickness + baseboardInset, floorY + wallHeight - crownH * 0.5, FURNITURE_SHOP_BASE.z);
   shop.add(crLeft);
   const crRight = crLeft.clone();
   crRight.position.x = FURNITURE_SHOP_BASE.x + halfWidth - wallThickness - baseboardInset;
   shop.add(crRight);

   const winW = 1.8;
   const winH = 2.2;
   const winY = floorY + wallHeight * 0.45;
   for (const side of [-1, 1]) {
     const wx = FURNITURE_SHOP_BASE.x + side * (halfWidth - 0.01);
     const wz = FURNITURE_SHOP_BASE.z - 1.2;
     const glass = new THREE.Mesh(new THREE.BoxGeometry(0.06, winH, winW), glassMat);
     glass.position.set(wx - side * 0.02, winY, wz);
     shop.add(glass);
     const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.1, winH + 0.16, 0.1), frameMat);
     frameL.position.set(wx, winY, wz - winW * 0.5 - 0.04);
     shop.add(frameL);
     const frameR = frameL.clone();
     frameR.position.z = wz + winW * 0.5 + 0.04;
     shop.add(frameR);
     const frameT = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, winW + 0.16), frameMat);
     frameT.position.set(wx, winY + winH * 0.5 + 0.04, wz);
     shop.add(frameT);
     const frameB = frameT.clone();
     frameB.position.y = winY - winH * 0.5 - 0.04;
     shop.add(frameB);
     const sill = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, winW + 0.2), frameMat);
     sill.position.set(wx - side * 0.06, winY - winH * 0.5 - 0.1, wz);
     shop.add(sill);
   }

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
   setFurnitureShopExitMarker?.(exitRing);

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

    const sconceMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.78, metalness: 0.2 });
    const sconceArmMat = new THREE.MeshStandardMaterial({ color: 0x2d1f14, roughness: 0.82 });
    const sconcePositions = [
      [FURNITURE_SHOP_BASE.x - halfWidth + 0.15, floorY + 2.8, FURNITURE_SHOP_BASE.z + 0.5],
      [FURNITURE_SHOP_BASE.x + halfWidth - 0.15, floorY + 2.8, FURNITURE_SHOP_BASE.z + 0.5],
      [FURNITURE_SHOP_BASE.x - halfWidth + 0.15, floorY + 2.8, FURNITURE_SHOP_BASE.z + 1.8],
      [FURNITURE_SHOP_BASE.x + halfWidth - 0.15, floorY + 2.8, FURNITURE_SHOP_BASE.z + 1.8]
    ];
    for (const [sx, sy, sz] of sconcePositions) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.3), sconceArmMat);
      arm.position.set(sx, sy, sz);
      shop.add(arm);
      const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 8), sconceMat);
      holder.position.set(sx, sy + 0.04, sz + 0.12);
      shop.add(holder);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), lanternGlowMat);
      flame.position.set(sx, sy + 0.14, sz + 0.12);
      shop.add(flame);
    }

    const crateMat = new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.88 });
    for (let i = 0; i < 3; i += 1) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.55), crateMat);
      crate.position.set(FURNITURE_SHOP_BASE.x - halfWidth + 1.2, floorY + 0.22, FURNITURE_SHOP_BASE.z - halfDepth + 1.2 + i * 0.7);
      crate.rotation.y = i * 0.15;
      crate.castShadow = true;
      crate.receiveShadow = true;
      shop.add(crate);
    }

    const lanternShadeMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5, side: THREE.DoubleSide });
    const hangingLantern = new THREE.Group();
    const lanternBody = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.35, 10), lanternMat);
    hangingLantern.add(lanternBody);
    const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.28, 10, 1, true), lanternShadeMat);
    hangingLantern.add(lanternGlass);
    const lanternTop = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.15, 10), lanternMat);
    lanternTop.position.y = 0.24;
    hangingLantern.add(lanternTop);
    const lanternHandle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 12, Math.PI), brassMat);
    lanternHandle.position.y = 0.32;
    hangingLantern.add(lanternHandle);
    const lanternLight = new THREE.PointLight(0xffe8a0, 0.5, 5);
    lanternLight.position.y = 0;
    hangingLantern.add(lanternLight);
    hangingLantern.position.set(FURNITURE_SHOP_BASE.x - 2.2, floorY + wallHeight - 0.6, FURNITURE_SHOP_BASE.z + 0.5);
    shop.add(hangingLantern);

    const hangingLantern2 = hangingLantern.clone();
    hangingLantern2.position.set(FURNITURE_SHOP_BASE.x + 2.2, floorY + wallHeight - 0.6, FURNITURE_SHOP_BASE.z + 0.5);
    shop.add(hangingLantern2);

    const ambientLight = new THREE.AmbientLight(0xfff4e0, 0.18);
    shop.add(ambientLight);

    shop.traverse((obj) => {
     if (!obj?.isMesh) return;
     obj.castShadow = false;
     obj.receiveShadow = false;
   });

   scene.add(shop);
   shop.visible = false;
  setFurnitureShopGroup?.(shop);
  addWallCollisionFromMesh(backWall, 'furniture-shop');
  addWallCollisionFromMesh(leftWall, 'furniture-shop');
  addWallCollisionFromMesh(rightWall, 'furniture-shop');
  addWallCollisionFromMesh(frontLeftWall, 'furniture-shop');
  addWallCollisionFromMesh(frontRightWall, 'furniture-shop');
   addWallCollisionFromMesh(frontTopWall, 'furniture-shop');
   addWorldCollider(FURNITURE_SHOP_COUNTER_POS.x, FURNITURE_SHOP_COUNTER_POS.z, 2.4, 'furniture-shop');
}

export function addHouseHallInterior() {
  const {
    GROUND_Y,
    HOUSE_HALL_BASE
  } = layout;
  const roomSlotCount = Math.max(1, Number(getHouseRoomSlotCount?.() || 0));
  const roomIds = Array.isArray(getHouseRoomIds?.()) ? getHouseRoomIds() : [];
  const hall = new THREE.Group();
  const floorY = GROUND_Y;
  const hallW = 13.4;
  const wallH = 4.6;
  const wallT = 0.25;
  const baseX = HOUSE_HALL_BASE.x;
  const baseZ = HOUSE_HALL_BASE.z;
  const roomCount = roomSlotCount;
  const rowCount = Math.ceil(roomCount / 2);
  const rowSpacing = 7.0;
  const hallDepthMargin = 10.0;
  const hallD = Math.max(24.0, rowCount * rowSpacing + hallDepthMargin);

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
  hallLightA.position.set(baseX, floorY + 3.35, baseZ - hallD * 0.3);
  const hallLightB = hallLightA.clone();
  hallLightB.position.z = baseZ;
  const hallLightC = hallLightA.clone();
  hallLightC.position.z = baseZ + hallD * 0.3;
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

  const doorOffsets = Array.from({ length: rowCount }, (_, row) => {
    return rowCount <= 1 ? 0 : (row - (rowCount - 1) / 2) * rowSpacing;
  });
  const doorX = hallW * 0.5 - 0.7;
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.6,
    roughness: 0.3
  });

  houseHallRoomDoors.length = 0;
  for (let i = 0; i < roomSlotCount; i += 1) {
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
      id: roomIds[i],
      position: new THREE.Vector3(x, 1.36, z),
      ring,
      sign
    });
  }

  const exitRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 12, 28), ringMat);
  exitRing.rotation.x = Math.PI * 0.5;
  const exitZ = baseZ + hallD * 0.5 - 1.5;
  exitRing.position.set(baseX, floorY + 0.05, exitZ);
  hall.add(exitRing);
  setHouseHallExitMarker?.(exitRing);

  hall.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });

  hall.visible = false;
  scene.add(hall);
  setHouseHallGroup?.(hall);
}
