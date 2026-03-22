import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import {
  makeTextSign,
  createVendorNpc,
  createVendorStall
} from './common.js';
import { ORE_RESOURCE_COLORS } from '../config/gameData.js';

let scene = null;
let addWorldCollider = null;
let oreNodes = null;
let setQuestNpcMesh = null;
let setMineShopNpcMesh = null;
let setMineEntranceMesh = null;
let setMineExitMesh = null;
let setMineCentralCrystalMesh = null;
let setMineGroup = null;
let setMineOreTraderNpcMesh = null;
let layout = null;

export function initMineBuilders({
  sceneRef = null,
  addWorldColliderRef = null,
  oreNodesRef = null,
  setQuestNpcMeshRef = null,
  setMineShopNpcMeshRef = null,
  setMineEntranceMeshRef = null,
  setMineExitMeshRef = null,
  setMineCentralCrystalMeshRef = null,
  setMineGroupRef = null,
  setMineOreTraderNpcMeshRef = null,
  layoutRef = null
} = {}) {
  scene = sceneRef;
  addWorldCollider = addWorldColliderRef;
  oreNodes = oreNodesRef;
  setQuestNpcMesh = setQuestNpcMeshRef;
  setMineShopNpcMesh = setMineShopNpcMeshRef;
  setMineEntranceMesh = setMineEntranceMeshRef;
  setMineExitMesh = setMineExitMeshRef;
  setMineCentralCrystalMesh = setMineCentralCrystalMeshRef;
  setMineGroup = setMineGroupRef;
  setMineOreTraderNpcMesh = setMineOreTraderNpcMeshRef;
  layout = layoutRef;
}

export function addMineArea() {
  const {
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
  } = layout;
  const mine = new THREE.Group();
  mine.position.set(MINE_POS.x, 0, MINE_POS.z);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(MINE_RADIUS, 68),
    new THREE.MeshStandardMaterial({ color: 0x3b3b3b, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 1.34;
  floor.receiveShadow = true;
  mine.add(floor);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(MINE_RADIUS - 2.8, MINE_RADIUS, 72),
    new THREE.MeshStandardMaterial({ color: 0x2f241a, roughness: 0.95 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 1.335;
  mine.add(ring);

  const caveShellMat = new THREE.MeshStandardMaterial({
    color: 0x151b26,
    roughness: 0.98,
    metalness: 0.02,
    side: THREE.DoubleSide
  });
  const caveWall = new THREE.Mesh(
    new THREE.CylinderGeometry(MINE_RADIUS + 5.2, MINE_RADIUS + 3.3, MINE_CEILING_Y - 1.2, 88, 1, true),
    caveShellMat
  );
  caveWall.position.y = MINE_CEILING_Y * 0.55;
  caveWall.castShadow = true;
  caveWall.receiveShadow = true;
  mine.add(caveWall);

  const caveRoof = new THREE.Mesh(
    new THREE.CircleGeometry(MINE_RADIUS + 5.4, 84),
    new THREE.MeshStandardMaterial({ color: 0x131826, roughness: 0.98, metalness: 0.02, side: THREE.DoubleSide })
  );
  caveRoof.rotation.x = Math.PI / 2;
  caveRoof.position.y = MINE_CEILING_Y;
  caveRoof.castShadow = true;
  caveRoof.receiveShadow = true;
  mine.add(caveRoof);

  for (let i = 0; i < 40; i += 1) {
    const angle = (i / 40) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
    const radius = MINE_RADIUS * (0.14 + Math.random() * 0.78);
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.42 + Math.random() * 0.82, 1.4 + Math.random() * 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x202838, roughness: 0.94 })
    );
    spike.position.set(
      Math.cos(angle) * radius,
      MINE_CEILING_Y - 0.48 - Math.random() * 1.8,
      Math.sin(angle) * radius
    );
    spike.rotation.x = Math.PI;
    spike.rotation.y = Math.random() * Math.PI * 2;
    spike.castShadow = true;
    mine.add(spike);
  }

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.9 });
  for (let i = 0; i < 48; i += 1) {
    const angle = (i / 48) * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.9 + Math.random() * 1.5, 0), rockMat);
    const radius = MINE_RADIUS - 6.8 + Math.random() * 5.4;
    rock.position.set(Math.cos(angle) * radius, 2.2 + Math.random() * 2.8, Math.sin(angle) * radius);
    rock.scale.set(1.3 + Math.random() * 1.2, 1.4 + Math.random() * 1.5, 1.3 + Math.random() * 1.2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    mine.add(rock);
  }
  const wallColliderCount = 88;
  for (let i = 0; i < wallColliderCount; i += 1) {
    const angle = (i / wallColliderCount) * Math.PI * 2;
    addWorldCollider(
      MINE_POS.x + Math.cos(angle) * MINE_ROCK_WALL_RADIUS,
      MINE_POS.z + Math.sin(angle) * MINE_ROCK_WALL_RADIUS,
      1.5,
      'mine-wall'
    );
  }

  const mineAmbient = new THREE.AmbientLight(0x8b9ec6, 0.42);
  mine.add(mineAmbient);
  const mineFillLight = new THREE.PointLight(0x8dd5ff, 1.9, MINE_RADIUS * 2.6, 2);
  mineFillLight.position.set(0, 9.8, 0);
  mine.add(mineFillLight);

  const centralCrystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.9, 0),
    new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      emissive: 0x1d4ed8,
      emissiveIntensity: 1.45,
      roughness: 0.28,
      metalness: 0.05
    })
  );
  centralCrystal.position.set(0, 3.2, 0);
  centralCrystal.rotation.y = Math.PI * 0.14;
  centralCrystal.castShadow = true;
  mine.add(centralCrystal);
  setMineCentralCrystalMesh(centralCrystal);
  const centralCrystalLight = new THREE.PointLight(0x60a5fa, 2.3, 34, 2);
  centralCrystalLight.position.set(0, 3.5, 0);
  mine.add(centralCrystalLight);

  const caveLampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffd89c,
    emissive: 0x8a5d1f,
    emissiveIntensity: 1.35,
    roughness: 0.56
  });
  const caveLampStoneMat = new THREE.MeshStandardMaterial({ color: 0x303948, roughness: 0.95 });
  const caveLampCount = 10;
  const caveLampRadius = MINE_RADIUS - 9.8;
  for (let i = 0; i < caveLampCount; i += 1) {
    const angle = (i / caveLampCount) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(angle) * caveLampRadius;
    const z = Math.sin(angle) * caveLampRadius;
    const lampStone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), caveLampStoneMat);
    lampStone.position.set(x, 2.0, z);
    lampStone.castShadow = true;
    lampStone.receiveShadow = true;
    const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), caveLampBulbMat);
    lampBulb.position.set(x, 2.7, z);
    const lampLight = new THREE.PointLight(0xffca7c, 2.3, 32, 2);
    lampLight.position.set(x, 2.86, z);
    mine.add(lampStone, lampBulb, lampLight);
  }

  const exitPortal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.84, 0.12, 24),
    new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0891b2,
      emissiveIntensity: 1.2,
      roughness: 0.32
    })
  );
  exitPortal.rotation.x = -Math.PI / 2;
  exitPortal.position.set(MINE_EXIT_POS.x - MINE_POS.x, 1.42, MINE_EXIT_POS.z - MINE_POS.z);
  mine.add(exitPortal);
  setMineExitMesh(exitPortal);

  const oreDefs = [
    {
      resource: 'stone',
      color: ORE_RESOURCE_COLORS.stone,
      reward: 1,
      cooldownMs: 5200,
      positions: [
        [-26, -18], [-22, -7], [-18, 11], [-12, -22], [-7, -12], [-1, 16], [6, -17], [11, 8], [16, -6], [22, 12], [28, 3], [-14, 22]
      ]
    },
    {
      resource: 'iron',
      color: ORE_RESOURCE_COLORS.iron,
      reward: 2,
      cooldownMs: 7600,
      positions: [[-24, 8], [-16, -25], [-9, -15], [-2, 24], [8, -11], [14, 4], [19, 18], [25, -12], [4, 20]]
    },
    {
      resource: 'gold',
      color: ORE_RESOURCE_COLORS.gold,
      reward: 3,
      cooldownMs: 10400,
      positions: [[-28, 15], [-12, 26], [3, 28], [14, -22], [24, 6], [20, 23], [-4, -26]]
    },
    {
      resource: 'emerald',
      color: ORE_RESOURCE_COLORS.emerald,
      reward: 4,
      cooldownMs: 12800,
      positions: [[-20, 20], [5, -25], [18, -15], [-10, -28], [26, 18]]
    },
    {
      resource: 'diamond',
      color: ORE_RESOURCE_COLORS.diamond,
      reward: 1,
      cooldownMs: 15600,
      positions: [[-30, -5], [-8, 4], [0, 0], [18, 14], [30, 10]]
    },
    {
      resource: 'amethyst',
      color: ORE_RESOURCE_COLORS.amethyst,
      reward: 3,
      cooldownMs: 9800,
      positions: [[-15, 30], [22, -8], [-5, -30], [28, -18], [-25, -15]]
    },
    {
      resource: 'obsidian',
      color: ORE_RESOURCE_COLORS.obsidian,
      reward: 5,
      cooldownMs: 18000,
      positions: [[0, 32], [-28, 0], [30, -5], [-5, -32], [15, 28]]
    }
  ];

  oreDefs.forEach((def) => {
    const emissiveResources = { diamond: 0x0891b2, emerald: 0x059669, amethyst: 0x7c3aed, obsidian: 0x4c1d95 };
    const emissiveColor = emissiveResources[def.resource] || 0x000000;
    const hasEmissive = def.resource === 'diamond' || def.resource === 'emerald' || def.resource === 'amethyst' || def.resource === 'obsidian';
    const scale = def.resource === 'obsidian' ? 1.1 : def.resource === 'diamond' || def.resource === 'emerald' ? 0.95 : 0.85;
    def.positions.forEach(([x, z], idx) => {
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(scale, 0),
        new THREE.MeshStandardMaterial({
          color: def.color,
          emissive: emissiveColor,
          emissiveIntensity: hasEmissive ? 0.8 : 0
        })
      );
      mesh.position.set(x, 1.86, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mine.add(mesh);
      oreNodes.push({
        id: `${def.resource}-${idx}`,
        resource: def.resource,
        colorHex: def.color,
        reward: def.reward,
        cooldownMs: def.cooldownMs,
        mesh,
        readyAt: 0,
        baseY: 1.86,
        baseScale: 1,
        breaking: false,
        breakStartAt: 0,
        breakEndAt: 0
      });
    });
  });

  scene.add(mine);
  setMineGroup(mine);
  mine.visible = false;

  const mineEntrance = new THREE.Group();
  mineEntrance.position.set(MINE_ENTRY_POS.x, 0, MINE_ENTRY_POS.z);
  const rockMatOuter = new THREE.MeshStandardMaterial({ color: 0xb9a79a, roughness: 0.96 });
  const rockMatMid = new THREE.MeshStandardMaterial({ color: 0x8f7f74, roughness: 0.95 });
  const caveDarkMat = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.98 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xbb6f3b, roughness: 0.86 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x7c838f, roughness: 0.62, metalness: 0.38 });
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x8d5a34, roughness: 0.9 });

  const rockBase = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 0), rockMatOuter);
  rockBase.position.set(0, 3.8, 0.75);
  rockBase.scale.set(2.8, 2.4, 1.92);
  mineEntrance.add(rockBase);

  const rockLeft = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45, 0), rockMatMid);
  rockLeft.position.set(-2.45, 2.85, 2.45);
  rockLeft.scale.set(1.55, 1.2, 1.15);
  mineEntrance.add(rockLeft);
  const rockRight = rockLeft.clone();
  rockRight.position.x = 2.45;
  mineEntrance.add(rockRight);

  const rockBottom = new THREE.Mesh(new THREE.DodecahedronGeometry(1.55, 0), rockMatOuter);
  rockBottom.position.set(0, 1.42, 2.62);
  rockBottom.scale.set(2.1, 0.7, 1.15);
  mineEntrance.add(rockBottom);

  const caveOuter = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.7, 3.6, 16, 1, false, 0, Math.PI), caveDarkMat);
  caveOuter.rotation.y = Math.PI * 0.5;
  caveOuter.position.set(0, 3.0, 3.1);
  mineEntrance.add(caveOuter);

  const caveVoid = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.8),
    new THREE.MeshBasicMaterial({ color: 0x0b0f17, side: THREE.DoubleSide })
  );
  caveVoid.position.set(0, 2.95, 3.9);
  mineEntrance.add(caveVoid);

  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.27, 3.25, 0.22), woodMat);
  postL.position.set(-1.14, 3.05, 4.52);
  const postR = postL.clone();
  postR.position.x = 1.14;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.3, 0.24), woodMat);
  beam.position.set(0, 4.62, 4.52);
  const signText = makeTextSign('MINE', 2.25, 0.48, '#c27a45', '#4a1d12');
  signText.position.set(0, 4.62, 4.68);
  mineEntrance.add(postL, postR, beam, signText);

  const doorWoodMat = new THREE.MeshStandardMaterial({ color: 0x7b4a26, roughness: 0.9 });
  const doorWoodDarkMat = new THREE.MeshStandardMaterial({ color: 0x5f3b22, roughness: 0.92 });
  const doorMetalMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.52, metalness: 0.44 });

  const doorFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.28, 0.22), woodMat);
  doorFrameLeft.position.set(-1.34, 2.96, 5.22);
  const doorFrameRight = doorFrameLeft.clone();
  doorFrameRight.position.x = 1.34;
  const doorFrameTop = new THREE.Mesh(new THREE.BoxGeometry(3.02, 0.22, 0.22), woodMat);
  doorFrameTop.position.set(0, 4.5, 5.22);
  mineEntrance.add(doorFrameLeft, doorFrameRight, doorFrameTop);

  function makeMineDoor(side = 1) {
    const door = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.82, 0.11), doorWoodMat);
    door.add(panel);

    for (const y of [0.88, 0, -0.88]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.11, 0.12), doorMetalMat);
      strap.position.set(0, y, 0.01);
      door.add(strap);
    }

    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 0.08), doorWoodDarkMat);
    brace.rotation.z = side * 0.52;
    brace.position.set(-side * 0.07, 0, 0.02);
    door.add(brace);

    for (const y of [0.72, -0.72]) {
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.08), doorMetalMat);
      hinge.position.set(side * 0.48, y, 0.03);
      door.add(hinge);
    }

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), doorMetalMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(-side * 0.31, 0.05, 0.08);
    door.add(handle);

    door.position.set(side * 0.66, 2.98, 5.28);
    door.rotation.y = side * 0.34;
    return door;
  }

  mineEntrance.add(makeMineDoor(-1), makeMineDoor(1));

  for (const side of [-1, 1]) {
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), doorMetalMat);
    hook.position.set(side * 1.2, 3.82, 5.34);
    const lantern = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.34, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xf4d58d, emissive: 0x7c5a1d, emissiveIntensity: 0.5, roughness: 0.55 })
    );
    lantern.position.set(side * 1.2, 3.58, 5.41);
    const lanternLight = new THREE.PointLight(0xffd68a, 0.85, 8, 2);
    lanternLight.position.set(side * 1.2, 3.6, 5.42);
    mineEntrance.add(hook, lantern, lanternLight);
  }

  const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 8.6), railMat);
  leftRail.position.set(-0.57, 1.16, 8.0);
  const rightRail = leftRail.clone();
  rightRail.position.x = 0.57;
  mineEntrance.add(leftRail, rightRail);
  for (let i = 0; i < 12; i += 1) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.2), tieMat);
    tie.position.set(0, 1.12, 4.55 + i * 0.72);
    mineEntrance.add(tie);
  }

  const cart = new THREE.Group();
  cart.position.set(0, 1.2, 9.05);
  const cartWoodMat = new THREE.MeshStandardMaterial({ color: 0x7a4b2a, roughness: 0.88 });
  const cartMetalMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.54, metalness: 0.36 });
  const cartBed = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.3, 1.5), cartWoodMat);
  cartBed.position.y = 0.22;
  const cartSideL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 1.5), cartWoodMat);
  cartSideL.position.set(-0.54, 0.44, 0);
  const cartSideR = cartSideL.clone();
  cartSideR.position.x = 0.54;
  const cartFront = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.52, 0.1), cartWoodMat);
  cartFront.position.set(0, 0.44, 0.7);
  const cartBack = cartFront.clone();
  cartBack.position.z = -0.7;
  cart.add(cartBed, cartSideL, cartSideR, cartFront, cartBack);

  const wheelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.11, 14);
  const wheelOffsets = [
    [-0.43, 0, -0.52],
    [0.43, 0, -0.52],
    [-0.43, 0, 0.52],
    [0.43, 0, 0.52]
  ];
  for (const [x, y, z] of wheelOffsets) {
    const wheel = new THREE.Mesh(wheelGeo, cartMetalMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    cart.add(wheel);
  }
  mineEntrance.add(cart);

  mineEntrance.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  mineEntrance.rotation.y = MINE_ENTRY_YAW;
  scene.add(mineEntrance);
  setMineEntranceMesh(mineEntrance);

  const mineStallVendorScale = 0.65;
  const mineStallVendorY = VENDOR_STAND_Y - 0.05;
  const mineStallVendorZ = -1.0;

  const mineShopVendor = createVendorNpc({
    shirtColor: 0xb45309,
    skinColor: 0xd6a581,
    hairColor: 0x1f2937,
    hatColor: 0x111827
  });
  mineShopVendor.scale.setScalar(mineStallVendorScale);
  const mineShopStall = createVendorStall({
    label: 'Pickaxes',
    signColor: '#2f2417',
    canopyA: 0xf59e0b,
    canopyB: 0xfef3c7,
    vendor: mineShopVendor
  });
  mineShopStall.position.set(
    MINE_SHOP_NPC_POS.x - MINE_POS.x,
    0,
    MINE_SHOP_NPC_POS.z - MINE_POS.z
  );
  mineShopVendor.position.set(0, mineStallVendorY, mineStallVendorZ);
  mineShopStall.rotation.y = Math.atan2(-mineShopStall.position.x, -mineShopStall.position.z);
  mine.add(mineShopStall);
  setMineShopNpcMesh(mineShopVendor);
  addWorldCollider(MINE_SHOP_NPC_POS.x, MINE_SHOP_NPC_POS.z, 1.04, 'npc');

  const oreTraderVendor = createVendorNpc({
    shirtColor: 0x7c2d12,
    skinColor: 0xd6a581,
    hairColor: 0x111827,
    hatColor: 0x334155
  });
  oreTraderVendor.scale.setScalar(mineStallVendorScale);
  const oreTraderStall = createVendorStall({
    label: 'Ore Trader',
    signColor: '#2b2f3a',
    canopyA: 0x94a3b8,
    canopyB: 0xf8fafc,
    vendor: oreTraderVendor
  });
  oreTraderStall.position.set(
    MINE_ORE_TRADER_POS.x - MINE_POS.x,
    0,
    MINE_ORE_TRADER_POS.z - MINE_POS.z
  );
  oreTraderVendor.position.set(0, mineStallVendorY, mineStallVendorZ);
  oreTraderStall.rotation.y = Math.atan2(-oreTraderStall.position.x, -oreTraderStall.position.z);
  mine.add(oreTraderStall);
  setMineOreTraderNpcMesh(oreTraderVendor);
  addWorldCollider(MINE_ORE_TRADER_POS.x, MINE_ORE_TRADER_POS.z, 1.04, 'npc');

  const questVendor = createVendorNpc({
    shirtColor: 0x7c3aed,
    skinColor: 0xe0b18f,
    hairColor: 0x0f172a,
    hatColor: 0x1e293b
  });
  questVendor.scale.setScalar(mineStallVendorScale);
  const questStall = createVendorStall({
    label: 'Quests',
    signColor: '#2f2a3b',
    canopyA: 0x8b5cf6,
    canopyB: 0xf5f3ff,
    vendor: questVendor
  });
  questStall.position.set(
    QUEST_NPC_POS.x - MINE_POS.x,
    0,
    QUEST_NPC_POS.z - MINE_POS.z
  );
  questVendor.position.set(0, mineStallVendorY, mineStallVendorZ);
  questStall.rotation.y = Math.atan2(-questStall.position.x, -questStall.position.z);
  mine.add(questStall);
  setQuestNpcMesh(questVendor);
  addWorldCollider(QUEST_NPC_POS.x, QUEST_NPC_POS.z, 1.04, 'npc');
}
