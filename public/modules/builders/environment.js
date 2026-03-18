import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

let scene = null;
let addWorldCollider = null;
let addRockFootprintCollisionFromMesh = null;
let getWorldLimit = null;
let beaconIslandLights = null;
let setCliffWaterfallRoot = null;
let setCliffWaterfallFoam = null;
let setCliffWaterfallState = null;

const ISLAND_LAMP_BASE_INTENSITY = 0;
const ISLAND_LAMP_ACTIVE_INTENSITY = 9.2;
const ISLAND_LAMP_RANGE = 38;
const ISLAND_LAMP_DECAY = 1.45;

function currentWorldLimit() {
  return typeof getWorldLimit === 'function' ? getWorldLimit() : 40;
}

export function initEnvironmentBuilders({
  sceneRef = null,
  addWorldColliderRef = null,
  addRockFootprintCollisionFromMeshRef = null,
  getWorldLimitRef = null,
  beaconIslandLightsRef = null,
  setCliffWaterfallRootRef = null,
  setCliffWaterfallFoamRef = null,
  setCliffWaterfallStateRef = null
} = {}) {
  scene = sceneRef;
  addWorldCollider = addWorldColliderRef;
  addRockFootprintCollisionFromMesh = addRockFootprintCollisionFromMeshRef;
  getWorldLimit = getWorldLimitRef;
  beaconIslandLights = beaconIslandLightsRef;
  setCliffWaterfallRoot = setCliffWaterfallRootRef;
  setCliffWaterfallFoam = setCliffWaterfallFoamRef;
  setCliffWaterfallState = setCliffWaterfallStateRef;
}

export function addBeaconIslandLights() {
  const count = 10;
  const ringRadius = currentWorldLimit() * 0.86;
  const poleScale = 1.28;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x433222, roughness: 0.88, metalness: 0.02 });
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + 0.18;
    const x = Math.cos(angle) * ringRadius;
    const z = Math.sin(angle) * ringRadius;

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1 * poleScale, 0.1 * poleScale, 2.35 * poleScale, 8),
      postMat
    );
    post.position.set(x, 2.35 * poleScale, z);
    post.castShadow = true;
    post.receiveShadow = true;
    scene.add(post);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffdf8f,
      emissive: 0x2a220f,
      emissiveIntensity: 0,
      roughness: 0.45
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18 * poleScale, 12, 10), bulbMat);
    bulb.position.set(x, 3.62 * poleScale, z);
    scene.add(bulb);

    const light = new THREE.PointLight(0xffd27a, ISLAND_LAMP_BASE_INTENSITY, ISLAND_LAMP_RANGE, ISLAND_LAMP_DECAY);
    light.position.set(x, 3.62 * poleScale, z);
    scene.add(light);

    beaconIslandLights.push({ light, bulb });
  }
}

export function updateBeaconIslandLights(active, delta) {
  const targetIntensity = active ? ISLAND_LAMP_ACTIVE_INTENSITY : ISLAND_LAMP_BASE_INTENSITY;
  const blend = Math.min(1, delta * 4.6);
  for (const entry of beaconIslandLights) {
    entry.light.intensity = THREE.MathUtils.lerp(entry.light.intensity, targetIntensity, blend);
    const glow = entry.light.intensity / ISLAND_LAMP_ACTIVE_INTENSITY;
    entry.bulb.material.emissiveIntensity = glow * 3.8;
  }
}

export function mainIslandRadiusAtAngle(angle) {
  const worldLimit = currentWorldLimit();
  const profile = 0.86
    + Math.sin(angle * 2 + 0.6) * 0.11
    + Math.sin(angle * 5 - 0.9) * 0.06
    + Math.cos(angle * 1 + 2.1) * 0.04;
  return THREE.MathUtils.clamp(worldLimit * profile, worldLimit * 0.66, worldLimit * 1.08);
}

export function radialShape(radiusOffset = 0, segments = 144) {
  const shape = new THREE.Shape();
  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    const radius = Math.max(2.2, mainIslandRadiusAtAngle(t) + radiusOffset);
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    if (i === 0) {
      shape.moveTo(x, z);
    } else {
      shape.lineTo(x, z);
    }
  }
  shape.closePath();
  return shape;
}

export function addMainIslandTerrain() {
  const worldLimit = currentWorldLimit();
  const cliff = new THREE.Mesh(
    new THREE.CylinderGeometry(worldLimit + 4, worldLimit + 7, 4.9, 72, 1),
    new THREE.MeshStandardMaterial({ color: 0xc6b188, roughness: 0.96, metalness: 0.01 })
  );
  cliff.position.y = -1.15;
  cliff.receiveShadow = true;
  scene.add(cliff);

  const shoreGeo = new THREE.ShapeGeometry(radialShape(2.6), 132);
  shoreGeo.rotateX(-Math.PI / 2);
  const shore = new THREE.Mesh(
    shoreGeo,
    new THREE.MeshStandardMaterial({ color: 0xbb9c6b, roughness: 0.98, metalness: 0.01 })
  );
  shore.position.y = 1.31;
  shore.receiveShadow = true;
  scene.add(shore);

  const sandGeo = new THREE.ShapeGeometry(radialShape(0.85), 132);
  sandGeo.rotateX(-Math.PI / 2);
  const sand = new THREE.Mesh(
    sandGeo,
    new THREE.MeshStandardMaterial({ color: 0xcdb180, roughness: 0.97, metalness: 0.01 })
  );
  sand.position.y = 1.34;
  sand.receiveShadow = true;
  scene.add(sand);

  const grassGeo = new THREE.ShapeGeometry(radialShape(-1.65), 132);
  grassGeo.rotateX(-Math.PI / 2);
  const grass = new THREE.Mesh(
    grassGeo,
    new THREE.MeshStandardMaterial({ color: 0x79a85d, roughness: 0.92, metalness: 0.02 })
  );
  grass.position.y = 1.36;
  grass.receiveShadow = true;
  scene.add(grass);
}

export function createWaterfallFlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const baseGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  baseGradient.addColorStop(0, 'rgba(163, 230, 255, 0.9)');
  baseGradient.addColorStop(0.26, 'rgba(104, 206, 247, 0.86)');
  baseGradient.addColorStop(0.66, 'rgba(58, 166, 220, 0.82)');
  baseGradient.addColorStop(1, 'rgba(34, 120, 178, 0.78)');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 64; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const length = 54 + Math.random() * 168;
    const width = 1.1 + Math.random() * 2.8;
    const alpha = 0.12 + Math.random() * 0.28;
    ctx.strokeStyle = `rgba(235,248,255,${alpha.toFixed(3)})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 15, y + length);
    ctx.stroke();
  }

  for (let i = 0; i < 30; i += 1) {
    const radius = 6 + Math.random() * 14;
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, 'rgba(230, 248, 255, 0.22)');
    glow.addColorStop(1, 'rgba(230, 248, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 18; i += 1) {
    const laneWidth = 8 + Math.random() * 18;
    const laneX = Math.random() * canvas.width;
    const laneGradient = ctx.createLinearGradient(laneX, 0, laneX + laneWidth, 0);
    laneGradient.addColorStop(0, 'rgba(255,255,255,0)');
    laneGradient.addColorStop(0.5, `rgba(240,252,255,${(0.12 + Math.random() * 0.14).toFixed(3)})`);
    laneGradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = laneGradient;
    ctx.fillRect(laneX, 0, laneWidth, canvas.height);
  }

  const edgeMask = ctx.createLinearGradient(0, 0, canvas.width, 0);
  edgeMask.addColorStop(0, 'rgba(0,0,0,0)');
  edgeMask.addColorStop(0.08, 'rgba(0,0,0,0.18)');
  edgeMask.addColorStop(0.2, 'rgba(0,0,0,0.88)');
  edgeMask.addColorStop(0.5, 'rgba(0,0,0,1)');
  edgeMask.addColorStop(0.8, 'rgba(0,0,0,0.88)');
  edgeMask.addColorStop(0.92, 'rgba(0,0,0,0.18)');
  edgeMask.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = edgeMask;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const heightMask = ctx.createLinearGradient(0, 0, 0, canvas.height);
  heightMask.addColorStop(0, 'rgba(0,0,0,0.75)');
  heightMask.addColorStop(0.08, 'rgba(0,0,0,1)');
  heightMask.addColorStop(0.84, 'rgba(0,0,0,0.98)');
  heightMask.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = heightMask;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.05, 1.95);
  tex.anisotropy = 4;
  return tex;
}

export function createWaterfallMistTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.5;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, canvas.width * 0.5);
  gradient.addColorStop(0, 'rgba(245, 253, 255, 0.96)');
  gradient.addColorStop(0.25, 'rgba(228, 248, 255, 0.55)');
  gradient.addColorStop(0.65, 'rgba(210, 238, 251, 0.22)');
  gradient.addColorStop(1, 'rgba(210, 238, 251, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function addPalm(x, z, scale = 1) {
  const trunkCurve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2 * scale, 0.38 * scale, 4.8 * scale, 10),
    new THREE.MeshStandardMaterial({ color: 0x7b5135, roughness: 0.9 })
  );
  trunkCurve.position.set(x + 0.15 * scale, 2.5 * scale, z - 0.12 * scale);
  trunkCurve.rotation.z = 0.13;
  trunkCurve.castShadow = true;
  trunkCurve.receiveShadow = true;
  scene.add(trunkCurve);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19 * scale, 0.34 * scale, 4.2 * scale, 9),
    new THREE.MeshStandardMaterial({ color: 0x7b5135, roughness: 0.9 })
  );
  trunk.position.set(x, 3.0 * scale, z);
  trunk.rotation.z = -0.09;
  trunk.castShadow = true;
  trunk.receiveShadow = true;

  const leaves = new THREE.Group();
  for (let i = 0; i < 6; i += 1) {
    const frond = new THREE.Mesh(
      new THREE.ConeGeometry(0.22 * scale, 2.25 * scale, 6),
      new THREE.MeshStandardMaterial({ color: 0x2f7f46, roughness: 0.82 })
    );
    frond.rotation.z = Math.PI / 2.35;
    frond.rotation.y = (i / 6) * Math.PI * 2;
    frond.position.set(x, 5.45 * scale, z);
    frond.castShadow = true;
    leaves.add(frond);
  }

  scene.add(trunk);
  scene.add(leaves);
  addWorldCollider(x, z, 0.64 * scale, 'tree');
}

export function addBush(x, z, scale = 1) {
  const bush = new THREE.Mesh(
    new THREE.SphereGeometry(0.78 * scale, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x3d8e4d, roughness: 0.88 })
  );
  bush.position.set(x, 1.62 + 0.2 * scale, z);
  bush.castShadow = true;
  bush.receiveShadow = true;
  scene.add(bush);
  addWorldCollider(x, z, 0.5 * scale, 'bush');
}

export function addGrassTuft(x, z, scale = 1, color = 0x4f8a3f) {
  const tuft = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.08 * scale, 0.55 * scale, 5),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    );
    blade.position.set((Math.random() - 0.5) * 0.18 * scale, 1.45 + 0.2 * scale, (Math.random() - 0.5) * 0.18 * scale);
    blade.rotation.x = (Math.random() - 0.5) * 0.24;
    blade.rotation.z = (Math.random() - 0.5) * 0.24;
    tuft.add(blade);
  }
  tuft.position.set(x, 0, z);
  scene.add(tuft);
}

export function addFlowerPatch(x, z, count = 10, spread = 2.2) {
  for (let i = 0; i < count; i += 1) {
    const px = x + (Math.random() - 0.5) * spread;
    const pz = z + (Math.random() - 0.5) * spread;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.36, 6),
      new THREE.MeshStandardMaterial({ color: 0x3c8a3a, roughness: 0.92 })
    );
    stem.position.set(px, 1.53, pz);
    const bloomColor = [0xfef08a, 0xfda4af, 0xbfdbfe, 0xf5d0fe][i % 4];
    const bloom = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshStandardMaterial({ color: bloomColor, roughness: 0.75 })
    );
    bloom.position.set(px, 1.76, pz);
    scene.add(stem, bloom);
  }
}

export function addCliffAndWaterfall(x, z) {
  const cliff = new THREE.Group();
  cliff.position.set(x, 0, z);
  cliff.scale.setScalar(0.84);
  const cliffRockMeshes = [];
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x586069, roughness: 0.93 });
  const faceMat = new THREE.MeshStandardMaterial({ color: 0x5f6872, roughness: 0.9 });
  const mainRock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(4.8, 0),
    rockMat
  );
  mainRock.position.set(0, 3.6, 0);
  mainRock.scale.set(2.6, 1.7, 2.0);
  mainRock.castShadow = true;
  mainRock.receiveShadow = true;
  cliff.add(mainRock);
  cliffRockMeshes.push(mainRock);

  for (let i = 0; i < 11; i += 1) {
    let rx = (Math.random() - 0.5) * 7.6;
    let rz = (Math.random() - 0.5) * 3.7;
    if ((rx < 0 && rz < 1.2) || (rz > 0.1 && Math.abs(rx) < 2.2)) {
      rx += 1.8;
      rz -= 1.2;
    }
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(3.1 + Math.random() * 1.8, 0),
      rockMat
    );
    rock.position.set(rx, 2.25 + Math.random() * 2.1, rz);
    rock.scale.set(2.55, 1.45 + Math.random() * 0.95, 2.0);
    rock.castShadow = true;
    rock.receiveShadow = true;
    cliff.add(rock);
    cliffRockMeshes.push(rock);
  }

  const makeWaterfallFace = (localX, localY, localZ, yaw, w = 3.4, h = 8.6) => {
    const normalX = Math.sin(yaw);
    const normalZ = Math.cos(yaw);
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.65, h + 0.9, 0.7),
      faceMat
    );
    face.position.set(localX, localY, localZ);
    face.rotation.y = yaw;
    face.castShadow = true;
    face.receiveShadow = true;
    cliff.add(face);

    const stream = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.92),
      new THREE.MeshBasicMaterial({
        color: 0x2ea9ff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: false
      })
    );
    stream.position.set(
      localX + normalX * 0.16,
      localY - 0.12,
      localZ + normalZ * 0.16
    );
    stream.rotation.y = yaw;
    stream.renderOrder = 20;
    cliff.add(stream);

    const streakMat = new THREE.MeshBasicMaterial({
      color: 0xeaf7ff,
      transparent: true,
      opacity: 0.92,
      depthTest: true,
      depthWrite: false
    });
    for (let i = 0; i < 11; i += 1) {
      const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.0 + Math.random() * 0.9), streakMat);
      streak.position.set(
        (Math.random() - 0.5) * (w - 0.6),
        (Math.random() - 0.5) * (h - 0.8),
        0.02
      );
      stream.add(streak);
    }

    const foam = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 18),
      new THREE.MeshBasicMaterial({
        color: 0xe8f7ff,
        transparent: true,
        opacity: 0.74,
        depthTest: true,
        depthWrite: false
      })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(
      localX + normalX * 0.42,
      0.1,
      localZ + normalZ * 0.42
    );
    foam.renderOrder = 21;
    cliff.add(foam);
  };

  void makeWaterfallFace;

  const guaranteedFall = new THREE.Group();
  const guaranteedYaw = -0.62;
  guaranteedFall.position.set(2.45, 4.28, 2.25);
  guaranteedFall.rotation.y = guaranteedYaw + Math.PI;
  const guaranteedFlowTexture = createWaterfallFlowTexture();
  const guaranteedSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 9.3),
    new THREE.MeshBasicMaterial({
      color: 0xa8e8ff,
      map: guaranteedFlowTexture,
      transparent: true,
      opacity: 0.9,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false
    })
  );
  guaranteedSheet.position.z = 6;
  guaranteedSheet.renderOrder = 40;
  guaranteedFall.add(guaranteedSheet);

  const guaranteedCoreTexture = guaranteedFlowTexture.clone();
  guaranteedCoreTexture.repeat.set(0.62, 2.15);
  guaranteedCoreTexture.offset.x = 0.19;
  const guaranteedCoreSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 9.1),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: guaranteedCoreTexture,
      transparent: true,
      opacity: 0.42,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  guaranteedCoreSheet.position.set(0, 0.05, 6.04);
  guaranteedCoreSheet.renderOrder = 41;
  guaranteedFall.add(guaranteedCoreSheet);

  const edgeVeils = [];
  for (const side of [-1, 1]) {
    const edgeTexture = guaranteedFlowTexture.clone();
    edgeTexture.repeat.set(0.34, 2.15);
    edgeTexture.offset.x = side < 0 ? 0.03 : 0.63;
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(1.55, 9.0),
      new THREE.MeshBasicMaterial({
        color: 0xc9f2ff,
        map: edgeTexture,
        transparent: true,
        opacity: 0.36,
        side: THREE.FrontSide,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    veil.position.set(side * 2.72, -0.02, 6.03);
    veil.rotation.y = side * 0.14;
    veil.renderOrder = 41;
    guaranteedFall.add(veil);
    edgeVeils.push(veil);
  }

  const guaranteedStreakMat = new THREE.MeshBasicMaterial({
    color: 0xeaf7ff,
    transparent: true,
    opacity: 0.92,
    side: THREE.FrontSide,
    depthTest: false,
    depthWrite: false
  });
  const guaranteedStreaks = [];
  for (let i = 0; i < 24; i += 1) {
    const minY = -4.3;
    const maxY = 4.2;
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09 + Math.random() * 0.08, 1.3 + Math.random() * 1.9),
      guaranteedStreakMat
    );
    streak.position.set((Math.random() - 0.5) * 5.4, THREE.MathUtils.lerp(minY, maxY, Math.random()), 6.06 + Math.random() * 0.03);
    streak.userData.baseX = streak.position.x;
    streak.userData.minY = minY;
    streak.userData.maxY = maxY;
    streak.userData.speed = 2.3 + Math.random() * 2.2;
    streak.userData.swayPhase = Math.random() * Math.PI * 2;
    streak.userData.swayAmp = 0.03 + Math.random() * 0.07;
    streak.renderOrder = 41;
    guaranteedFall.add(streak);
    guaranteedStreaks.push(streak);
  }
  cliff.add(guaranteedFall);

  const guaranteedLipFoam = new THREE.Mesh(
    new THREE.PlaneGeometry(6.05, 0.42),
    new THREE.MeshBasicMaterial({
      color: 0xf4fcff,
      transparent: true,
      opacity: 0.58,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false
    })
  );
  guaranteedLipFoam.position.set(0, 4.58, 5.98);
  guaranteedLipFoam.renderOrder = 43;
  guaranteedFall.add(guaranteedLipFoam);

  const guaranteedFoam = new THREE.Mesh(
    new THREE.CircleGeometry(3.1, 24, Math.PI, Math.PI),
    new THREE.MeshBasicMaterial({
      color: 0xe9f8ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false
    })
  );
  guaranteedFoam.rotation.x = -Math.PI / 2;
  guaranteedFoam.rotation.z = 0;
  guaranteedFoam.position.set(0, -4.55, 6);
  guaranteedFoam.renderOrder = 42;
  guaranteedFall.add(guaranteedFoam);

  const splashDrops = [];
  const splashGroup = new THREE.Group();
  splashGroup.position.set(0, -4.5, 6.08);
  for (let i = 0; i < 18; i += 1) {
    const drop = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({
        color: 0xf2fbff,
        transparent: true,
        opacity: 0.5,
        side: THREE.FrontSide,
        depthTest: false,
        depthWrite: false
      })
    );
    drop.userData.phase = Math.random();
    drop.userData.speed = 0.9 + Math.random() * 1.2;
    drop.userData.angle = Math.random() * Math.PI * 2;
    drop.userData.radius = 0.2 + Math.random() * 0.3;
    drop.userData.spread = 0.38 + Math.random() * 0.42;
    drop.userData.lift = 0.14 + Math.random() * 0.28;
    splashGroup.add(drop);
    splashDrops.push(drop);
  }
  guaranteedFall.add(splashGroup);

  const mistCurtain = new THREE.Mesh(
    new THREE.PlaneGeometry(6.45, 1.85),
    new THREE.MeshBasicMaterial({
      color: 0xe6f7ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false
    })
  );
  mistCurtain.position.set(0, -4.03, 6.26);
  mistCurtain.renderOrder = 44;
  guaranteedFall.add(mistCurtain);

  const mistTexture = createWaterfallMistTexture();
  const mistCount = 72;
  const mistPositions = new Float32Array(mistCount * 3);
  const mistData = [];
  for (let i = 0; i < mistCount; i += 1) {
    const idx = i * 3;
    const side = Math.random() > 0.5 ? 1 : -1;
    mistPositions[idx] = side * (0.22 + Math.random() * 0.64);
    mistPositions[idx + 1] = Math.random() * 1.1;
    mistPositions[idx + 2] = (Math.random() - 0.5) * 0.5;
    mistData.push({
      phase: Math.random(),
      speed: 0.45 + Math.random() * 0.8,
      angle: Math.random() * Math.PI * 2,
      radius: 0.32 + Math.random() * 0.98,
      spread: 0.64 + Math.random() * 1.6,
      lift: 0.34 + Math.random() * 1.05,
      drift: 0.35 + Math.random() * 0.9
    });
  }
  const mistGeo = new THREE.BufferGeometry();
  const mistAttr = new THREE.BufferAttribute(mistPositions, 3);
  mistGeo.setAttribute('position', mistAttr);
  const mistPoints = new THREE.Points(
    mistGeo,
    new THREE.PointsMaterial({
      map: mistTexture,
      color: 0xe9f8ff,
      transparent: true,
      opacity: 0.46,
      size: 0.7,
      sizeAttenuation: true,
      side: THREE.FrontSide,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  mistPoints.position.set(0, -4.46, 6.16);
  mistPoints.renderOrder = 45;
  guaranteedFall.add(mistPoints);

  setCliffWaterfallRoot(guaranteedFall);
  setCliffWaterfallFoam(guaranteedFoam);
  setCliffWaterfallState({
    flowTexture: guaranteedFlowTexture,
    coreTexture: guaranteedCoreTexture,
    sheet: guaranteedSheet,
    coreSheet: guaranteedCoreSheet,
    edgeVeils,
    foam: guaranteedFoam,
    lipFoam: guaranteedLipFoam,
    streaks: guaranteedStreaks,
    splashDrops,
    splashGroup,
    mistCurtain,
    mistPoints,
    mistData,
    mistAttr
  });

  scene.add(cliff);
  cliff.updateWorldMatrix(true, true);
  for (const rockMesh of cliffRockMeshes) {
    addRockFootprintCollisionFromMesh(rockMesh, 'cliff', -0.05);
  }
}

export function populateMainIslandNature() {
  const worldLimit = currentWorldLimit();
  const palmSpots = [
    [worldLimit * 0.62, worldLimit * 0.2, 1.24],
    [worldLimit * 0.34, -worldLimit * 0.42, 1.14],
    [-worldLimit * 0.72, worldLimit * 0.3, 1.28],
    [-worldLimit * 0.16, -worldLimit * 0.56, 1.1],
    [worldLimit * 0.04, worldLimit * 0.61, 1.05]
  ];
  palmSpots.forEach(([x, z, s]) => addPalm(x, z, s));
  addBush(worldLimit * 0.44, worldLimit * 0.28, 0.74);
  addBush(-worldLimit * 0.26, worldLimit * 0.44, 0.72);
  addBush(worldLimit * 0.14, -worldLimit * 0.36, 0.7);

  for (let i = 0; i < 120; i += 1) {
    const angle = (i / 120) * Math.PI * 2;
    const radius = worldLimit * (0.1 + Math.random() * 0.78);
    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 2.8;
    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 2.8;
    addGrassTuft(x, z, 0.8 + Math.random() * 0.45, i % 3 ? 0x4f8a3f : 0x568f45);
  }
  addFlowerPatch(worldLimit * 0.22, worldLimit * 0.38, 18, 5.6);
  addFlowerPatch(-worldLimit * 0.33, worldLimit * 0.12, 16, 5.1);
  addFlowerPatch(worldLimit * 0.46, -worldLimit * 0.22, 14, 4.9);
  addFlowerPatch(-worldLimit * 0.12, -worldLimit * 0.46, 13, 4.6);
}
