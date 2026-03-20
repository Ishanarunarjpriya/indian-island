import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

let scene = null;
let addWallCollisionFromMesh = null;
let mainIslandHouseGroup = null;

export function initCommonBuilders({ sceneRef = null, addWallCollisionFromMeshRef = null } = {}) {
  scene = sceneRef;
  addWallCollisionFromMesh = addWallCollisionFromMeshRef;
}

export function createHouseWindow(w, h) {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8ecae6,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.45
  });
  const sillMat = new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.88 });
  const frameT = 0.09;
  const glassInset = 0.03;
  // Frame pieces
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(w + frameT * 2, frameT, frameT * 1.6), frameMat);
  topFrame.position.y = h * 0.5;
  const bottomFrame = topFrame.clone();
  bottomFrame.position.y = -h * 0.5;
  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(frameT, h, frameT * 1.6), frameMat);
  leftFrame.position.x = -w * 0.5;
  const rightFrame = leftFrame.clone();
  rightFrame.position.x = w * 0.5;
  // Cross bars
  const hBar = new THREE.Mesh(new THREE.BoxGeometry(w, frameT * 0.7, frameT * 1.2), frameMat);
  const vBar = new THREE.Mesh(new THREE.BoxGeometry(frameT * 0.7, h, frameT * 1.2), frameMat);
  // Glass pane
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - frameT, h - frameT, glassInset), glassMat);
  glass.position.z = glassInset * 0.5;
  // Window sill
  const sill = new THREE.Mesh(new THREE.BoxGeometry(w + frameT * 4, 0.08, 0.22), sillMat);
  sill.position.set(0, -h * 0.5 - 0.06, 0.12);
  // Shutters
  const shutterMat = new THREE.MeshStandardMaterial({ color: 0x2d5016, roughness: 0.82 });
  const shutterW = w * 0.52;
  const shutterH = h + 0.1;
  const shutterT = 0.06;
  const leftShutter = new THREE.Mesh(new THREE.BoxGeometry(shutterW, shutterH, shutterT), shutterMat);
  leftShutter.position.set(-w * 0.5 - shutterW * 0.5 - 0.02, 0, -0.02);
  const rightShutter = new THREE.Mesh(new THREE.BoxGeometry(shutterW, shutterH, shutterT), shutterMat);
  rightShutter.position.set(w * 0.5 + shutterW * 0.5 + 0.02, 0, -0.02);
  group.add(topFrame, bottomFrame, leftFrame, rightFrame, hBar, vBar, glass, sill, leftShutter, rightShutter);
  return group;
}

export function createVendorShop(x, z, yaw = 0, options = {}) {
  const shop = new THREE.Group();
  shop.position.set(x, 1.35, z);
  shop.rotation.y = yaw;
  const vendor = options?.vendor || null;
  
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.88 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4e3423, roughness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.92 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3f2510, roughness: 0.82 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.85 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.84 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.92 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.8 });
  
  const shopScale = 1.0;
  const shopW = 7.0 * shopScale;
  const shopD = 5.0 * shopScale;
  const wallH = 3.5 * shopScale;
  const wallT = 0.18;
  const doorW = 1.5 * shopScale;
  const doorH = 2.2 * shopScale;
  
  // Shop counter
  const counter = new THREE.Mesh(new THREE.BoxGeometry(shopW, 0.3, 0.8), counterMat);
  counter.position.set(0, 0.15, -shopD * 0.3);
  shop.add(counter);
  
  // Shop shelves
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(shopW * 0.8, 0.1, 0.05), shelfMat);
  shelf.position.set(0, wallH * 0.3, -shopD * 0.3);
  shop.add(shelf);
  
  // Shop floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(shopW, 0.2, shopD), wallMat);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  shop.add(floor);
  
  // Back wall
  const back = new THREE.Mesh(new THREE.BoxGeometry(shopW, wallH, wallT), wallMat);
  back.position.set(0, wallH * 0.5 + 0.1, -shopD * 0.5 + wallT * 0.5);
  shop.add(back);
  
  // Side walls
  const left = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, shopD), wallMat);
  left.position.set(-shopW * 0.5 + wallT * 0.5, wallH * 0.5 + 0.1, 0);
  shop.add(left);
  const right = left.clone();
  right.position.x = shopW * 0.5 - wallT * 0.5;
  shop.add(right);
  
  // Front wall with door
  const frontSideW = (shopW - doorW) * 0.5;
  const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSideW, wallH, wallT), wallMat);
  frontLeft.position.set(-(doorW * 0.5 + frontSideW * 0.5), wallH * 0.5 + 0.1, shopD * 0.5 - wallT * 0.5);
  shop.add(frontLeft);
  const frontRight = frontLeft.clone();
  frontRight.position.x = -frontLeft.position.x;
  shop.add(frontRight);
  const frontTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, wallH - doorH, wallT), wallMat);
  frontTop.position.set(0, doorH + (wallH - doorH) * 0.5 + 0.1, shopD * 0.5 - wallT * 0.5);
  shop.add(frontTop);
  
  // Door panel
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.12, doorH - 0.08, 0.08), doorMat);
  doorPanel.position.set(0, doorH * 0.5 + 0.04, shopD * 0.5 + 0.04);
  shop.add(doorPanel);
  
  // Shop sign
  const sign = new THREE.Mesh(new THREE.BoxGeometry(shopW * 0.8, 0.2, 0.05), signMat);
  sign.position.set(0, wallH * 0.9, shopD * 0.5 + 0.1);
  shop.add(sign);
  
  // Canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(shopW * 1.2, 0.2, shopD * 0.6), canopyMat);
  canopy.position.set(0, wallH + 0.1, -shopD * 0.3);
  shop.add(canopy);

  if (vendor) {
    vendor.position.set(0, 0.1, -1.9);
    shop.add(vendor);
  }
  
  return shop;
}

export function createMarketStall(x, z, yaw = 0, options = {}) {
  const stall = new THREE.Group();
  stall.position.set(x, 1.35, z);
  stall.rotation.y = yaw;
  
  const stallMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.88 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.92 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.85 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.84 });
  
  const stallScale = 1.0;
  const stallW = 6.0 * stallScale;
  const stallD = 4.0 * stallScale;
  const wallH = 2.5 * stallScale;
  const wallT = 0.15;
  
  // Stall counter
  const counter = new THREE.Mesh(new THREE.BoxGeometry(stallW, 0.25, 0.6), counterMat);
  counter.position.set(0, 0.125, -stallD * 0.2);
  stall.add(counter);
  
  // Stall shelves
  const shelf1 = new THREE.Mesh(new THREE.BoxGeometry(stallW * 0.7, 0.08, 0.04), shelfMat);
  shelf1.position.set(0, wallH * 0.25, -stallD * 0.2);
  stall.add(shelf1);
  const shelf2 = shelf1.clone();
  shelf2.position.y = wallH * 0.5;
  stall.add(shelf2);
  
  // Stall canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(stallW * 1.1, 0.15, stallD * 0.8), canopyMat);
  canopy.position.set(0, wallH + 0.1, -stallD * 0.2);
  stall.add(canopy);
  
  // Stall floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(stallW, 0.15, stallD), stallMat);
  floor.position.y = 0.075;
  floor.receiveShadow = true;
  stall.add(floor);
  
  return stall;
}

export function addWoodHouse(x, z, yaw = 0, options = {}) {
  const collisions = options?.collisions !== false;
  const isMainIslandHouse = options?.isMainIslandHouse === true;
  const onlinePlayerCount = Math.max(1, Math.floor(Number(options?.onlinePlayerCount) || 1));
  const expansionTier = isMainIslandHouse ? Math.min(8, Math.max(0, onlinePlayerCount - 1)) : 0;
  if (isMainIslandHouse && mainIslandHouseGroup) {
    scene?.remove(mainIslandHouseGroup);
    mainIslandHouseGroup.traverse((node) => {
      if (!node?.isMesh) return;
      node.geometry?.dispose?.();
      if (Array.isArray(node.material)) {
        node.material.forEach((mat) => mat?.dispose?.());
      } else {
        node.material?.dispose?.();
      }
    });
    mainIslandHouseGroup = null;
  }
  const house = new THREE.Group();
  house.position.set(x, 1.35, z);
  house.rotation.y = yaw;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x7b4f2d, roughness: 0.88 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4e3423, roughness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.92 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3f2510, roughness: 0.82 });

  const houseScale = 1.18;
  const houseW = (9.4 + expansionTier * 0.58) * houseScale;
  const houseD = (8.0 + expansionTier * 0.44) * houseScale;
  const wallH = (3.2 + expansionTier * 0.16) * houseScale;
  const wallT = 0.22;
  const doorW = Math.min(2.45 * houseScale, (1.9 + expansionTier * 0.05) * houseScale);
  const doorH = Math.min(3.0 * houseScale, (2.45 + expansionTier * 0.04) * houseScale);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(houseW, 0.2, houseD), wallMat);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  house.add(floor);

  const back = new THREE.Mesh(new THREE.BoxGeometry(houseW, wallH, wallT), wallMat);
  back.position.set(0, wallH * 0.5 + 0.1, -houseD * 0.5 + wallT * 0.5);
  const left = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, houseD), wallMat);
  left.position.set(-houseW * 0.5 + wallT * 0.5, wallH * 0.5 + 0.1, 0);
  const right = left.clone();
  right.position.x = houseW * 0.5 - wallT * 0.5;

  const frontSideW = (houseW - doorW) * 0.5;
  const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSideW, wallH, wallT), wallMat);
  frontLeft.position.set(-(doorW * 0.5 + frontSideW * 0.5), wallH * 0.5 + 0.1, houseD * 0.5 - wallT * 0.5);
  const frontRight = frontLeft.clone();
  frontRight.position.x = -frontLeft.position.x;
  const frontTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, wallH - doorH, wallT), wallMat);
  frontTop.position.set(0, doorH + (wallH - doorH) * 0.5 + 0.1, houseD * 0.5 - wallT * 0.5);

  house.add(back, left, right, frontLeft, frontRight, frontTop);

  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.14, doorH - 0.08, 0.08), doorMat);
  doorPanel.position.set(0, doorH * 0.5 + 0.04, houseD * 0.5 + 0.04);
  house.add(doorPanel);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.8 });
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), handleMat);
  handle.position.set(doorW * 0.28, doorH * 0.48, houseD * 0.5 + 0.12);
  house.add(handle);

  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.24, 0.12, 0.12), trimMat);
  frameTop.position.set(0, doorH + 0.16, houseD * 0.5 + 0.02);
  const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, doorH, 0.12), trimMat);
  frameLeft.position.set(-doorW * 0.5 - 0.06, doorH * 0.5 + 0.1, houseD * 0.5 + 0.02);
  const frameRight = frameLeft.clone();
  frameRight.position.x = doorW * 0.5 + 0.06;
  house.add(frameTop, frameLeft, frameRight);

  const winW = 1.4;
  const winH = 1.5;
  const winY = wallH * 0.5 + 0.35;
  const leftWin1 = createHouseWindow(winW, winH);
  leftWin1.position.set(-houseW * 0.5 - 0.02, winY, -houseD * 0.22);
  leftWin1.rotation.y = -Math.PI * 0.5;
  const leftWin2 = createHouseWindow(winW, winH);
  leftWin2.position.set(-houseW * 0.5 - 0.02, winY, houseD * 0.22);
  leftWin2.rotation.y = -Math.PI * 0.5;
  house.add(leftWin1, leftWin2);

  const rightWin1 = createHouseWindow(winW, winH);
  rightWin1.position.set(houseW * 0.5 + 0.02, winY, -houseD * 0.22);
  rightWin1.rotation.y = Math.PI * 0.5;
  const rightWin2 = createHouseWindow(winW, winH);
  rightWin2.position.set(houseW * 0.5 + 0.02, winY, houseD * 0.22);
  rightWin2.rotation.y = Math.PI * 0.5;
  house.add(rightWin1, rightWin2);

  const backWin = createHouseWindow(2.0, winH);
  backWin.position.set(0, winY, -houseD * 0.5 - 0.02);
  backWin.rotation.y = Math.PI;
  house.add(backWin);

  const frontWin1 = createHouseWindow(1.1, 1.2);
  frontWin1.position.set(-(doorW * 0.5 + frontSideW * 0.5), winY, houseD * 0.5 + 0.02);
  house.add(frontWin1);
  const frontWin2 = createHouseWindow(1.1, 1.2);
  frontWin2.position.set((doorW * 0.5 + frontSideW * 0.5), winY, houseD * 0.5 + 0.02);
  house.add(frontWin2);

  const postSize = 0.18;
  const postH = wallH + 0.16;
  const corners = [
    [-houseW * 0.5, -houseD * 0.5],
    [houseW * 0.5, -houseD * 0.5],
    [-houseW * 0.5, houseD * 0.5],
    [houseW * 0.5, houseD * 0.5]
  ];
  for (const [cx, cz] of corners) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(postSize, postH, postSize), trimMat);
    post.position.set(cx, postH * 0.5 + 0.1, cz);
    post.castShadow = true;
    house.add(post);
  }

  const foundationH = 0.28;
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(houseW + 0.3, foundationH, houseD + 0.3),
    stoneMat
  );
  foundation.position.y = 0.14 - foundationH * 0.5 + 0.12;
  foundation.receiveShadow = true;
  house.add(foundation);

  const eave = new THREE.Mesh(
    new THREE.BoxGeometry(houseW + 0.12, 0.12, houseD + 0.12),
    trimMat
  );
  eave.position.set(0, wallH + 0.12, 0);
  eave.castShadow = true;
  eave.receiveShadow = true;

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(houseW, houseD) * 0.68, (2.45 + expansionTier * 0.12) * houseScale, 4),
    roofMat
  );
  roof.position.set(0, wallH + (1.34 + expansionTier * 0.06) * houseScale, 0);
  roof.rotation.y = Math.PI * 0.25;
  roof.castShadow = true;
  roof.receiveShadow = true;

  const roofPeak = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1 * houseScale, 0.14 * houseScale, 0.46 * houseScale, 8),
    trimMat
  );
  roofPeak.position.set(0, wallH + (2.74 + expansionTier * 0.12) * houseScale, 0);
  roofPeak.castShadow = true;
  roofPeak.receiveShadow = true;

  house.add(eave, roof, roofPeak);

  const chimneyW = 0.7;
  const chimneyD = 0.7;
  const chimneyH = 2.8;
  const chimneyBase = new THREE.Group();
  const chimneyBody = new THREE.Mesh(new THREE.BoxGeometry(chimneyW, chimneyH, chimneyD), brickMat);
  chimneyBody.castShadow = true;
  chimneyBase.add(chimneyBody);
  const chimneyCap = new THREE.Mesh(
    new THREE.BoxGeometry(chimneyW + 0.2, 0.12, chimneyD + 0.2),
    stoneMat
  );
  chimneyCap.position.y = chimneyH * 0.5 + 0.06;
  chimneyCap.castShadow = true;
  chimneyBase.add(chimneyCap);
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(chimneyW + 0.04, 0.06, chimneyD + 0.04),
      stoneMat
    );
    band.position.y = -chimneyH * 0.5 + 0.5 + i * 0.7;
    chimneyBase.add(band);
  }
  chimneyBase.position.set(houseW * 0.22, wallH + 1.6, -houseD * 0.15);
  house.add(chimneyBase);

  const porchDepth = 2.2;
  const porchW = doorW + 2.4;
  const porchFloor = new THREE.Mesh(
    new THREE.BoxGeometry(porchW, 0.14, porchDepth),
    new THREE.MeshStandardMaterial({ color: 0x6b5340, roughness: 0.88 })
  );
  porchFloor.position.set(0, 0.02, houseD * 0.5 + porchDepth * 0.5 - 0.05);
  porchFloor.receiveShadow = true;
  house.add(porchFloor);
  const porchRoof = new THREE.Mesh(
    new THREE.BoxGeometry(porchW + 0.3, 0.1, porchDepth + 0.2),
    roofMat
  );
  porchRoof.position.set(0, doorH + 0.5, houseD * 0.5 + porchDepth * 0.5 - 0.05);
  porchRoof.castShadow = true;
  house.add(porchRoof);
  const porchPostH = doorH + 0.35;
  const porchPostPositions = [
    [-porchW * 0.5 + 0.12, 0, houseD * 0.5 + porchDepth - 0.15],
    [porchW * 0.5 - 0.12, 0, houseD * 0.5 + porchDepth - 0.15]
  ];
  for (const [px, py, pz] of porchPostPositions) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, porchPostH, 8),
      trimMat
    );
    post.position.set(px, porchPostH * 0.5 + 0.1, pz);
    post.castShadow = true;
    house.add(post);
    const postBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.18, 0.28),
      stoneMat
    );
    postBase.position.set(px, 0.12, pz);
    house.add(postBase);
  }
  const stepW = porchW * 0.6;
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(stepW, 0.12, 0.35),
      stoneMat
    );
    step.position.set(0, -0.06 - i * 0.12, houseD * 0.5 + porchDepth + 0.15 + i * 0.35);
    step.receiveShadow = true;
    house.add(step);
  }
  const railH = 0.7;
  const railMat = trimMat;
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, railH, porchDepth - 0.3),
      railMat
    );
    rail.position.set(side * (porchW * 0.5 - 0.12), railH * 0.5 + 0.14, houseD * 0.5 + porchDepth * 0.5 - 0.05);
    house.add(rail);
    const topBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.06, porchDepth - 0.3),
      railMat
    );
    topBar.position.set(side * (porchW * 0.5 - 0.12), railH + 0.18, houseD * 0.5 + porchDepth * 0.5 - 0.05);
    house.add(topBar);
  }

  const flowerBoxMat = new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.85 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.7 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 });
  const boxPositions = [
    [-(doorW * 0.5 + frontSideW * 0.5), winY - winH * 0.5 - 0.28, houseD * 0.5 + 0.22],
    [(doorW * 0.5 + frontSideW * 0.5), winY - winH * 0.5 - 0.28, houseD * 0.5 + 0.22]
  ];
  for (const [bx, by, bz] of boxPositions) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 0.22), flowerBoxMat);
    box.position.set(bx, by, bz);
    house.add(box);
    for (let fi = 0; fi < 4; fi++) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), flowerMat);
      flower.position.set(bx - 0.4 + fi * 0.26, by + 0.16, bz);
      house.add(flower);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 4), leafMat);
      stem.position.set(bx - 0.4 + fi * 0.26, by + 0.07, bz);
      house.add(stem);
    }
  }

  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(houseW * 0.6 - i * 1.2, 0.04, 0.04),
      ridgeMat
    );
    const ridgeY = wallH + 0.6 + i * 0.9;
    ridge.position.set(0, ridgeY, houseD * 0.25 - i * 0.15);
    house.add(ridge);
    const ridge2 = ridge.clone();
    ridge2.position.z = -(houseD * 0.25 - i * 0.15);
    house.add(ridge2);
  }

  house.children.forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
  });
  scene.add(house);
  if (collisions) {
    addWallCollisionFromMesh(back, 'house');
    addWallCollisionFromMesh(left, 'house');
    addWallCollisionFromMesh(right, 'house');
    addWallCollisionFromMesh(frontLeft, 'house');
    addWallCollisionFromMesh(frontRight, 'house');
    addWallCollisionFromMesh(frontTop, 'house');
  }
  if (isMainIslandHouse) {
    mainIslandHouseGroup = house;
  }
}

export function addStoreBuilding(x, z, yaw = 0, options = {}) {
  const collisions = options?.collisions !== false;
  const store = new THREE.Group();
  store.position.set(x, 1.35, z);
  store.rotation.y = yaw;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
  const awningMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.8 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.2, metalness: 0.1 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5a, roughness: 0.7 });

  const storeScale = 1.5;
  const storeW = 7.2 * storeScale;
  const storeD = 5.8 * storeScale;
  const wallH = 4.2 * storeScale;
  const wallT = 0.28;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(storeW, 0.15, storeD), trimMat);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  store.add(floor);

  const back = new THREE.Mesh(new THREE.BoxGeometry(storeW, wallH, wallT), wallMat);
  back.position.set(0, wallH * 0.5 + 0.1, -storeD * 0.5 + wallT * 0.5);
  store.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, storeD), wallMat);
  left.position.set(-storeW * 0.5 + wallT * 0.5, wallH * 0.5 + 0.1, 0);
  store.add(left);

  const right = left.clone();
  right.position.x = storeW * 0.5 - wallT * 0.5;
  store.add(right);

  const frontWallH = wallH * 0.7;
  const doorW = 2.2 * storeScale;
  const doorH = 3.1 * storeScale;
  const sideWallW = (storeW - doorW) * 0.5;

  const frontWallLeft = new THREE.Mesh(new THREE.BoxGeometry(sideWallW, frontWallH, wallT), wallMat);
  frontWallLeft.position.set(-(doorW * 0.5 + sideWallW * 0.5), frontWallH * 0.5 + 0.1, storeD * 0.5 - wallT * 0.5);
  store.add(frontWallLeft);
  const frontWallRight = frontWallLeft.clone();
  frontWallRight.position.x = doorW * 0.5 + sideWallW * 0.5;
  store.add(frontWallRight);

  const doorTopH = frontWallH - doorH;
  const doorTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorTopH, wallT), wallMat);
  doorTop.position.set(0, doorH + doorTopH * 0.5 + 0.1, storeD * 0.5 - wallT * 0.5);
  store.add(doorTop);

  const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.85 });
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.16, doorH - 0.1, 0.1), doorMat);
  doorPanel.position.set(0, doorH * 0.5 + 0.1, storeD * 0.5 + 0.04);
  store.add(doorPanel);

  const handleMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.8 });
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), handleMat);
  handle.position.set(doorW * 0.32, doorH * 0.56, storeD * 0.5 + 0.14);
  store.add(handle);

  const upperFrontWallH = wallH * 0.35;
  const upperFrontWallLeft = new THREE.Mesh(new THREE.BoxGeometry(sideWallW, upperFrontWallH, wallT), wallMat);
  upperFrontWallLeft.position.set(-(doorW * 0.5 + sideWallW * 0.5), frontWallH + upperFrontWallH * 0.5 + 0.1, storeD * 0.5 - wallT * 0.5);
  store.add(upperFrontWallLeft);
  const upperFrontWallRight = upperFrontWallLeft.clone();
  upperFrontWallRight.position.x = doorW * 0.5 + sideWallW * 0.5;
  store.add(upperFrontWallRight);
  const upperFrontWallCenter = new THREE.Mesh(new THREE.BoxGeometry(doorW, upperFrontWallH, wallT), wallMat);
  upperFrontWallCenter.position.set(0, frontWallH + upperFrontWallH * 0.5 + 0.1, storeD * 0.5 - wallT * 0.5);
  store.add(upperFrontWallCenter);

  const windowW = 2.8;
  const windowH = 2.3;
  const windowY = wallH * 0.42;
  const windowX = storeW * 0.3;
  const window1 = new THREE.Mesh(new THREE.BoxGeometry(windowW, windowH, 0.1), windowMat);
  window1.position.set(-windowX, windowY, storeD * 0.5 + 0.04);
  store.add(window1);
  const window2 = window1.clone();
  window2.position.x = windowX;
  store.add(window2);

  const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x5c4a38, roughness: 0.85 });
  const winFrameT = 0.08;
  for (const wx of [-windowX, windowX]) {
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(winFrameT, windowH + 0.2, 0.14), windowFrameMat);
    frameL.position.set(wx - windowW * 0.5 - winFrameT * 0.5, windowY, storeD * 0.5 + 0.1);
    store.add(frameL);
    const frameR = frameL.clone();
    frameR.position.x = wx + windowW * 0.5 + winFrameT * 0.5;
    store.add(frameR);
    const frameT = new THREE.Mesh(new THREE.BoxGeometry(windowW + winFrameT * 2, winFrameT, 0.14), windowFrameMat);
    frameT.position.set(wx, windowY + windowH * 0.5 + winFrameT * 0.5, storeD * 0.5 + 0.1);
    store.add(frameT);
    const frameB = frameT.clone();
    frameB.position.y = windowY - windowH * 0.5 - winFrameT * 0.5;
    store.add(frameB);
  }
  const windowCrossMat = windowFrameMat;
  for (const wx of [-windowX, windowX]) {
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(windowW - 0.2, 0.05, 0.12), windowCrossMat);
    crossH.position.set(wx, windowY, storeD * 0.5 + 0.1);
    store.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.05, windowH - 0.2, 0.12), windowCrossMat);
    crossV.position.set(wx, windowY, storeD * 0.5 + 0.1);
    store.add(crossV);
  }

  const awningW = storeW * 0.85;
  const awningD = 2.6;
  const awningH = 0.16;
  const awningBackY = wallH * 0.99;
  const awningFrontY = awningBackY - 0.26;
  const awningMidY = (awningBackY + awningFrontY) / 2;
  const awningOut = storeD * 0.5 + 0.92;

  const awningGeo = new THREE.BoxGeometry(awningW, awningH, awningD);
  const awningSlanted = new THREE.Mesh(awningGeo, awningMat);
  awningSlanted.rotation.x = -0.22;
  awningSlanted.position.set(0, awningMidY, awningOut);
  awningSlanted.castShadow = true;
  store.add(awningSlanted);

  for (let i = 0; i < 6; i++) {
    const stripeGeo = new THREE.BoxGeometry(awningW * 0.15, awningH + 0.02, awningD * 0.95);
    const stripeMat = i % 2 === 0 ? awningMat : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -0.22;
    stripe.position.set(-awningW * 0.43 + i * awningW * 0.175, awningMidY, awningOut);
    stripe.castShadow = true;
    store.add(stripe);
  }

  const supportMat = new THREE.MeshStandardMaterial({ color: 0x5c4a38, roughness: 0.85 });
  const supportH = Math.max(0.4, awningBackY - 1.9);
  const supportY = awningBackY - supportH * 0.5;
  const supportZ = awningOut - awningD * 0.45;
  for (const sx of [-awningW * 0.42, awningW * 0.42]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, supportH, 8), supportMat);
    post.position.set(sx, supportY, supportZ);
    post.castShadow = true;
    store.add(post);
  }
  const brace = new THREE.Mesh(new THREE.BoxGeometry(awningW * 0.9, 0.06, 0.06), supportMat);
  brace.position.set(0, supportY + supportH * 0.48, supportZ - 0.02);
  store.add(brace);
  const frontFaceZ = storeD * 0.5 - wallT * 0.5 + 0.02;
  const braceLen = awningOut - frontFaceZ + 0.24;
  for (const sx of [-awningW * 0.36, awningW * 0.36]) {
    const diag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, braceLen), supportMat);
    diag.rotation.x = -0.55;
    diag.position.set(sx, awningBackY - 0.35, frontFaceZ + braceLen * 0.5 - 0.1);
    diag.castShadow = true;
    store.add(diag);
  }

  // Removed plain sign slab to avoid a blank panel on storefronts.

  const postSize = 0.22;
  const postH = wallH + 0.15;
  const corners = [
    [-storeW * 0.5, -storeD * 0.5],
    [storeW * 0.5, -storeD * 0.5]
  ];
  for (const [cx, cz] of corners) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(postSize, postH, postSize), trimMat);
    post.position.set(cx, postH * 0.5 + 0.1, cz);
    post.castShadow = true;
    store.add(post);
  }

  const foundationH = 0.35;
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(storeW + 0.32, foundationH, storeD + 0.32),
    trimMat
  );
  foundation.position.y = 0.11 - foundationH * 0.5 + 0.1;
  foundation.receiveShadow = true;
  store.add(foundation);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(storeW + 0.14, 0.22, storeD + 0.14),
    roofMat
  );
  roof.position.set(0, wallH + 0.07, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  store.add(roof);

  store.children.forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
  });
  scene.add(store);
  if (collisions) {
    addWallCollisionFromMesh(back, 'store');
    addWallCollisionFromMesh(left, 'store');
    addWallCollisionFromMesh(right, 'store');
  }
}

export function createVendorNpc({
  shirtColor = 0x7c3aed,
  skinColor = 0xe0b18f,
  hairColor = 0x111827,
  hatColor = null
} = {}) {
  const npc = new THREE.Group();
  // Slightly taller than player-height silhouette so vendors stand clearly above stall surfaces.
  const npcScale = 1.95;

  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.84 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.75 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.78 });

  const legGeo = new THREE.BoxGeometry(0.16 * npcScale, 0.92 * npcScale, 0.18 * npcScale);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.13 * npcScale, 0.47 * npcScale, 0);
  const legR = legL.clone();
  legR.position.x = 0.13 * npcScale;

  const hips = new THREE.Mesh(
    new THREE.BoxGeometry(0.44 * npcScale, 0.2 * npcScale, 0.28 * npcScale),
    pantsMat
  );
  hips.position.y = 0.97 * npcScale;

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.52 * npcScale, 1.08 * npcScale, 0.32 * npcScale),
    shirtMat
  );
  torso.position.y = 1.52 * npcScale;

  const shoulders = new THREE.Mesh(
    new THREE.BoxGeometry(0.62 * npcScale, 0.15 * npcScale, 0.34 * npcScale),
    shirtMat
  );
  shoulders.position.y = 1.98 * npcScale;

  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(0.16 * npcScale, 0.12 * npcScale, 0.16 * npcScale),
    skinMat
  );
  neck.position.y = 2.08 * npcScale;

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42 * npcScale, 0.52 * npcScale, 0.42 * npcScale),
    skinMat
  );
  head.position.y = 2.32 * npcScale;

  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.46 * npcScale, 0.18 * npcScale, 0.46 * npcScale),
    hairMat
  );
  hair.position.y = 2.58 * npcScale;

  const armGeo = new THREE.BoxGeometry(0.12 * npcScale, 0.82 * npcScale, 0.14 * npcScale);
  const armL = new THREE.Mesh(armGeo, skinMat);
  armL.position.set(-0.36 * npcScale, 1.52 * npcScale, 0);
  const armR = armL.clone();
  armR.position.x = 0.36 * npcScale;

  const handGeo = new THREE.BoxGeometry(0.14 * npcScale, 0.17 * npcScale, 0.15 * npcScale);
  const handL = new THREE.Mesh(handGeo, skinMat);
  handL.position.set(-0.36 * npcScale, 1.03 * npcScale, 0);
  const handR = handL.clone();
  handR.position.x = 0.36 * npcScale;

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05 * npcScale, 0.05 * npcScale, 0.02 * npcScale), eyeMat);
  eyeL.position.set(-0.1 * npcScale, 2.35 * npcScale, 0.22 * npcScale);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1 * npcScale;
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.14 * npcScale, 0.025 * npcScale, 0.02 * npcScale), eyeMat);
  mouth.position.set(0, 2.22 * npcScale, 0.22 * npcScale);

  npc.add(
    legL, legR,
    hips, torso, shoulders, neck,
    head, hair,
    armL, armR, handL, handR,
    eyeL, eyeR, mouth
  );

  if (hatColor !== null) {
    const hat = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 * npcScale, 0.13 * npcScale, 0.5 * npcScale),
      new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.78 })
    );
    hat.position.y = 2.72 * npcScale;
    npc.add(hat);
  }

  npc.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return npc;
}

export function createVendorStall({
  label = 'Shop',
  signColor = '#2d3748',
  canopyA = 0x4f46e5,
  canopyB = 0xf8fafc,
  vendor = null
} = {}) {
  const stall = new THREE.Group();
  const width = 4.6;
  const depth = 2.8;
  const postHeight = 4.05;
  const roofY = 4.36;

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1f, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2f1e14, roughness: 0.92 });

  for (const px of [-1, 1]) {
    for (const pz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, postHeight, 0.2), woodMat);
      post.position.set(px * (width * 0.5 - 0.14), postHeight * 0.5, pz * (depth * 0.5 - 0.14));
      stall.add(post);
    }
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.52, 0.16, depth + 0.34), trimMat);
  roof.position.y = roofY;
  stall.add(roof);

  const stripeCount = 6;
  for (let i = 0; i < stripeCount; i += 1) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry((width + 0.36) / stripeCount, 0.11, 0.6),
      new THREE.MeshStandardMaterial({ color: i % 2 ? canopyA : canopyB, roughness: 0.72 })
    );
    const x = -((width + 0.36) * 0.5) + (i + 0.5) * ((width + 0.36) / stripeCount);
    stripe.position.set(x, roofY - 0.14, depth * 0.5 + 0.04);
    stall.add(stripe);
  }

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(width - 0.44, 0.15, 0.78), woodMat);
  counterTop.position.set(0, 1.74, depth * 0.24);
  const counterFront = new THREE.Mesh(new THREE.BoxGeometry(width - 0.58, 0.7, 0.12), woodMat);
  counterFront.position.set(0, 1.39, depth * 0.58);
  const counterRail = new THREE.Mesh(new THREE.BoxGeometry(width - 0.2, 0.12, 0.14), trimMat);
  counterRail.position.set(0, 2.07, depth * 0.58);
  stall.add(counterTop, counterFront, counterRail);

  const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.64, depth - 0.62), woodMat);
  sideRailL.position.set(-(width * 0.5 - 0.24), 1.44, 0);
  const sideRailR = sideRailL.clone();
  sideRailR.position.x = width * 0.5 - 0.24;
  stall.add(sideRailL, sideRailR);

  const sign = makeTextSign(label, 3.28, 0.62, signColor, '#ecfeff');
  sign.position.set(0, roofY + 0.72, depth * 0.5 + 0.15);
  sign.rotation.x = -0.14;
  stall.add(sign);

  if (vendor) {
    vendor.position.set(0, 0, -0.08);
    stall.add(vendor);
  }

  stall.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return stall;
}

export function makeTextSign(text, width = 2.2, height = 0.7, bg = '#8b5a2b', fg = '#fef3c7') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#3f2a1a';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = String(text).split('\n');
  if (lines.length <= 1) {
    ctx.font = 'bold 64px Arial';
    ctx.fillText(text, canvas.width * 0.5, canvas.height * 0.52);
  } else {
    const lineH = canvas.height / (lines.length + 0.4);
    const fontSize = Math.min(48, Math.floor(lineH * 0.85));
    ctx.font = `bold ${fontSize}px Arial`;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], canvas.width * 0.5, lineH * (i + 0.7));
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.02 });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
}
