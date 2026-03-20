import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { ARENA_CLIENT_CONFIG } from './config.js';

function makeTextSprite(THREE, text, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = options.background || 'rgba(52, 36, 26, 0.92)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = options.border || 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = options.color || '#f5f1e8';
  ctx.font = '700 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(options.scaleX || 6, options.scaleY || 1.9, 1);
  return sprite;
}

function disposeMaterial(material) {
  if (!material) {
    return;
  }
  if (Array.isArray(material)) {
    material.forEach((entry) => entry?.dispose?.());
    return;
  }
  material.dispose?.();
}

function disposeGroup(group) {
  group.traverse((child) => {
    child.geometry?.dispose?.();
    disposeMaterial(child.material);
  });
}

function buildWorldConfig() {
  return {
    hubCenter: ARENA_CLIENT_CONFIG.queueHubCenter,
    combatCenter: ARENA_CLIENT_CONFIG.combatCenter || ARENA_CLIENT_CONFIG.queueHubCenter,
    islandRadius: 18,
    stallOffset: { x: -10.8, y: 0, z: -6.4 },
    queuePads: Array.isArray(ARENA_CLIENT_CONFIG.queuePads) ? ARENA_CLIENT_CONFIG.queuePads : [],
  };
}

export function createArenaRenderer({ scene, world = buildWorldConfig() }) {
  if (!scene) {
    return {
      updateState() {},
      dispose() {},
    };
  }

  const lobbyCenter = world.hubCenter;
  const combatCenter = world.combatCenter || world.hubCenter;
  const root = new THREE.Group();
  root.name = 'arena-hub';
  scene.add(root);

  const lobbyRoot = new THREE.Group();
  lobbyRoot.name = 'arena-lobby';
  root.add(lobbyRoot);

  const islandRock = new THREE.Mesh(
    new THREE.CylinderGeometry(world.islandRadius + 2.8, world.islandRadius + 4.5, 3.6, 48),
    new THREE.MeshLambertMaterial({ color: 0x5a4632 }),
  );
  islandRock.position.set(lobbyCenter.x, lobbyCenter.y - 2.2, lobbyCenter.z);
  lobbyRoot.add(islandRock);

  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(world.islandRadius, world.islandRadius + 2.8, 2.4, 48),
    new THREE.MeshLambertMaterial({ color: 0x6d9a61 }),
  );
  island.position.set(lobbyCenter.x, lobbyCenter.y - 1.2, lobbyCenter.z);
  lobbyRoot.add(island);

  const islandTop = new THREE.Mesh(
    new THREE.CylinderGeometry(world.islandRadius - 0.3, world.islandRadius, 0.5, 48),
    new THREE.MeshLambertMaterial({ color: 0x7eaa5d }),
  );
  islandTop.position.set(lobbyCenter.x, lobbyCenter.y + 0.05, lobbyCenter.z);
  lobbyRoot.add(islandTop);

  const shore = new THREE.Mesh(
    new THREE.TorusGeometry(world.islandRadius + 1.2, 1.4, 8, 48),
    new THREE.MeshLambertMaterial({ color: 0x6f5438 }),
  );
  shore.rotation.x = Math.PI / 2;
  shore.position.set(lobbyCenter.x, lobbyCenter.y - 0.3, lobbyCenter.z);
  lobbyRoot.add(shore);

  const shoreFoam = new THREE.Mesh(
    new THREE.TorusGeometry(world.islandRadius + 2.4, 0.6, 6, 48),
    new THREE.MeshBasicMaterial({ color: 0xc8e8f0, transparent: true, opacity: 0.3 }),
  );
  shoreFoam.rotation.x = Math.PI / 2;
  shoreFoam.position.set(lobbyCenter.x, lobbyCenter.y + 0.1, lobbyCenter.z);
  lobbyRoot.add(shoreFoam);

  const lobbyRing = new THREE.Mesh(
    new THREE.RingGeometry(world.islandRadius - 6.5, world.islandRadius - 1.3, 48),
    new THREE.MeshBasicMaterial({ color: 0xff8a5b, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
  );
  lobbyRing.rotation.x = -Math.PI / 2;
  lobbyRing.position.set(lobbyCenter.x, lobbyCenter.y + 0.12, lobbyCenter.z);
  lobbyRoot.add(lobbyRing);

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(3, 7, 48),
    new THREE.MeshBasicMaterial({ color: 0xff6b3a, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
  );
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.set(lobbyCenter.x, lobbyCenter.y + 0.13, lobbyCenter.z);
  lobbyRoot.add(innerRing);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const rune = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.55, 6),
      new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.2, side: THREE.DoubleSide }),
    );
    rune.rotation.x = -Math.PI / 2;
    rune.rotation.z = angle;
    rune.position.set(
      lobbyCenter.x + Math.cos(angle) * (world.islandRadius - 3.8),
      lobbyCenter.y + 0.14,
      lobbyCenter.z + Math.sin(angle) * (world.islandRadius - 3.8)
    );
    lobbyRoot.add(rune);
  }

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + 0.13;
    const dist = world.islandRadius - 1.2 + Math.random() * 1.8;
    const grass = new THREE.Mesh(
      new THREE.ConeGeometry(0.18 + Math.random() * 0.12, 0.5 + Math.random() * 0.3, 4),
      new THREE.MeshLambertMaterial({ color: 0x4a8a35 + Math.floor(Math.random() * 0x152015) }),
    );
    grass.position.set(
      lobbyCenter.x + Math.cos(angle) * dist,
      lobbyCenter.y + 0.3,
      lobbyCenter.z + Math.sin(angle) * dist
    );
    lobbyRoot.add(grass);
  }

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.5;
    const dist = world.islandRadius - 2;
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.4 + Math.random() * 0.25, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a7530 }),
    );
    bush.position.set(
      lobbyCenter.x + Math.cos(angle) * dist,
      lobbyCenter.y + 0.3,
      lobbyCenter.z + Math.sin(angle) * dist
    );
    bush.scale.y = 0.65;
    lobbyRoot.add(bush);
  }

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.25;
    const dist = world.islandRadius + 0.6;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.4),
      new THREE.MeshLambertMaterial({ color: 0x6e6255 }),
    );
    rock.position.set(
      lobbyCenter.x + Math.cos(angle) * dist,
      lobbyCenter.y - 0.1,
      lobbyCenter.z + Math.sin(angle) * dist
    );
    lobbyRoot.add(rock);
  }

  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8a7e6e });
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const gap = (i % 4 === 1);
    if (gap) continue;
    const wallBlock = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.7, 0.55),
      stoneMat,
    );
    wallBlock.position.set(
      lobbyCenter.x + Math.cos(angle) * (world.islandRadius - 0.6),
      lobbyCenter.y + 0.4,
      lobbyCenter.z + Math.sin(angle) * (world.islandRadius - 0.6)
    );
    wallBlock.lookAt(lobbyCenter.x, lobbyCenter.y + 0.4, lobbyCenter.z);
    lobbyRoot.add(wallBlock);
  }

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.3;
    const dist = world.islandRadius - 0.6;
    const torchPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6),
      new THREE.MeshLambertMaterial({ color: 0x4a3520 }),
    );
    torchPost.position.set(
      lobbyCenter.x + Math.cos(angle) * dist,
      lobbyCenter.y + 0.65,
      lobbyCenter.z + Math.sin(angle) * dist
    );
    lobbyRoot.add(torchPost);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff8833 }),
    );
    flame.position.set(
      lobbyCenter.x + Math.cos(angle) * dist,
      lobbyCenter.y + 1.35,
      lobbyCenter.z + Math.sin(angle) * dist
    );
    lobbyRoot.add(flame);
    const torchLight = new THREE.PointLight(0xff9944, 0.5, 8, 2);
    torchLight.position.copy(flame.position);
    lobbyRoot.add(torchLight);
  }

  const teleporterPlaza = new THREE.Mesh(
    new THREE.CylinderGeometry(7.8, 8.4, 0.5, 36),
    new THREE.MeshLambertMaterial({ color: 0x2b3240 }),
  );
  teleporterPlaza.position.set(lobbyCenter.x, lobbyCenter.y + 0.12, lobbyCenter.z + 5.2);
  lobbyRoot.add(teleporterPlaza);

  const plazaRing = new THREE.Mesh(
    new THREE.RingGeometry(7.0, 7.8, 36),
    new THREE.MeshBasicMaterial({ color: 0xff6633, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
  );
  plazaRing.rotation.x = -Math.PI / 2;
  plazaRing.position.set(lobbyCenter.x, lobbyCenter.y + 0.38, lobbyCenter.z + 5.2);
  lobbyRoot.add(plazaRing);

  const teleporterTrim = new THREE.Mesh(
    new THREE.RingGeometry(4.2, 5.8, 48),
    new THREE.MeshBasicMaterial({ color: 0xf4b24d, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  teleporterTrim.rotation.x = -Math.PI / 2;
  teleporterTrim.position.set(lobbyCenter.x, lobbyCenter.y + 0.19, lobbyCenter.z + 5.2);
  lobbyRoot.add(teleporterTrim);

  const teleporterPad = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 3.2, 0.24, 28),
    new THREE.MeshLambertMaterial({ color: 0x1a2230 }),
  );
  teleporterPad.position.set(lobbyCenter.x, lobbyCenter.y + 0.24, lobbyCenter.z + 5.2);
  lobbyRoot.add(teleporterPad);

  const teleporterGlow = new THREE.Mesh(
    new THREE.RingGeometry(1.75, 2.7, 32),
    new THREE.MeshBasicMaterial({ color: 0xff6b4a, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  teleporterGlow.rotation.x = -Math.PI / 2;
  teleporterGlow.position.set(lobbyCenter.x, lobbyCenter.y + 0.28, lobbyCenter.z + 5.2);
  lobbyRoot.add(teleporterGlow);

  const teleporterPortal = new THREE.Mesh(
    new THREE.TorusGeometry(1.9, 0.22, 14, 38),
    new THREE.MeshLambertMaterial({ color: 0x6a7cff, emissive: 0x1c39b1, emissiveIntensity: 0.8 }),
  );
  teleporterPortal.rotation.x = Math.PI / 2;
  teleporterPortal.position.set(lobbyCenter.x, lobbyCenter.y + 2.2, lobbyCenter.z + 5.2);
  lobbyRoot.add(teleporterPortal);

  [-2.2, 2.2].forEach((offsetX) => {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 3.8, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x3a2518 }),
    );
    pillar.position.set(lobbyCenter.x + offsetX, lobbyCenter.y + 1.9, lobbyCenter.z + 5.2);
    lobbyRoot.add(pillar);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.2, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x5a4030 }),
    );
    cap.position.set(lobbyCenter.x + offsetX, lobbyCenter.y + 3.85, lobbyCenter.z + 5.2);
    lobbyRoot.add(cap);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x6a7cff }),
    );
    orb.position.set(lobbyCenter.x + offsetX, lobbyCenter.y + 4.1, lobbyCenter.z + 5.2);
    lobbyRoot.add(orb);
  });

  const archTop = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.18, 10, 24, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0x4e3528 }),
  );
  archTop.rotation.x = Math.PI / 2;
  archTop.position.set(lobbyCenter.x, lobbyCenter.y + 3.9, lobbyCenter.z + 5.2);
  lobbyRoot.add(archTop);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const rune = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.4, 5),
      new THREE.MeshBasicMaterial({ color: 0x7788ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
    );
    rune.position.set(
      lobbyCenter.x + Math.cos(a) * 2.8,
      lobbyCenter.y + 2.5 + Math.sin(a * 2) * 0.8,
      lobbyCenter.z + 5.2
    );
    lobbyRoot.add(rune);
  }

  const teleporterSign = makeTextSprite(THREE, 'PVP TELEPORTER', {
    scaleX: 7.2,
    scaleY: 1.3,
    background: 'rgba(20, 27, 38, 0.92)',
    border: 'rgba(255,145,90,0.4)',
  });
  teleporterSign.position.set(lobbyCenter.x, lobbyCenter.y + 4.6, lobbyCenter.z + 8.3);
  lobbyRoot.add(teleporterSign);

  const queuePads = world.queuePads.length
    ? world.queuePads
    : [
      { offset: { x: -8.6, z: 6.2 }, label: 'Solo', capacity: 1 },
      { offset: { x: -2.85, z: 6.2 }, label: 'Duo', capacity: 2 },
      { offset: { x: 2.85, z: 6.2 }, label: 'Trio', capacity: 3 },
      { offset: { x: 8.6, z: 6.2 }, label: 'Squad', capacity: 4 },
    ];
  queuePads.forEach((slot) => {
    const offsetX = Number(slot?.offset?.x) || 0;
    const offsetZ = Number(slot?.offset?.z) || 0;
    const padLabel = `${slot.label || 'Queue'} (${Number(slot.capacity) || 1})`;
    const padBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.5, 0.35, 24),
      new THREE.MeshLambertMaterial({ color: 0x3a3a42 }),
    );
    padBase.position.set(lobbyCenter.x + offsetX, lobbyCenter.y + 0.1, lobbyCenter.z + offsetZ);
    lobbyRoot.add(padBase);
    const queuePad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 0.1, 24),
      new THREE.MeshBasicMaterial({ color: 0xf0bb58, transparent: true, opacity: 0.3 }),
    );
    queuePad.position.set(lobbyCenter.x + offsetX, lobbyCenter.y + 0.3, lobbyCenter.z + offsetZ);
    lobbyRoot.add(queuePad);
    const padGlow = new THREE.Mesh(
      new THREE.RingGeometry(1.9, 2.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.2, side: THREE.DoubleSide }),
    );
    padGlow.rotation.x = -Math.PI / 2;
    padGlow.position.set(lobbyCenter.x + offsetX, lobbyCenter.y + 0.31, lobbyCenter.z + offsetZ);
    lobbyRoot.add(padGlow);
    const queueLabel = makeTextSprite(THREE, padLabel, {
      scaleX: 2.8,
      scaleY: 0.9,
      background: 'rgba(15, 20, 32, 0.9)',
      color: '#ffe5b2',
    });
    queueLabel.position.set(lobbyCenter.x + offsetX, lobbyCenter.y + 1.8, lobbyCenter.z + offsetZ);
    lobbyRoot.add(queueLabel);
    const padLight = new THREE.PointLight(0xffaa55, 0.3, 6, 2);
    padLight.position.set(lobbyCenter.x + offsetX, lobbyCenter.y + 0.6, lobbyCenter.z + offsetZ);
    lobbyRoot.add(padLight);
  });

  const pathMat = new THREE.MeshLambertMaterial({ color: 0x6b6358 });
  for (let px = -8; px <= 8; px += 1.6) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 1.2), pathMat);
    step.position.set(lobbyCenter.x + px * 0.55, lobbyCenter.y + 0.11, lobbyCenter.z + 2.5 + Math.abs(px) * 0.22);
    lobbyRoot.add(step);
  }
  for (let pz = 3; pz <= 9; pz += 1.2) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.9), pathMat);
    step.position.set(lobbyCenter.x, lobbyCenter.y + 0.11, lobbyCenter.z + pz);
    lobbyRoot.add(step);
  }

  const bannerMat = new THREE.MeshLambertMaterial({ color: 0xcc3322 });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
  [-12, -4, 4, 12].forEach((bx) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.5, 6), poleMat);
    pole.position.set(lobbyCenter.x + bx, lobbyCenter.y + 2.2, lobbyCenter.z - 2);
    lobbyRoot.add(pole);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.06), bannerMat);
    banner.position.set(lobbyCenter.x + bx, lobbyCenter.y + 3.0, lobbyCenter.z - 2);
    lobbyRoot.add(banner);
    const bannerStripe = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.08), new THREE.MeshLambertMaterial({ color: 0xffaa33 }));
    bannerStripe.position.set(lobbyCenter.x + bx, lobbyCenter.y + 3.2, lobbyCenter.z - 2);
    lobbyRoot.add(bannerStripe);
  });

  const gateFrame = new THREE.Mesh(
    new THREE.BoxGeometry(16, 4.8, 0.24),
    new THREE.MeshLambertMaterial({ color: 0x39424d }),
  );
  gateFrame.position.set(lobbyCenter.x, lobbyCenter.y + 2.2, lobbyCenter.z + 10.6);
  lobbyRoot.add(gateFrame);
  const cautionBand = new THREE.Mesh(
    new THREE.BoxGeometry(15, 0.3, 0.3),
    new THREE.MeshLambertMaterial({ color: 0xf3c24f }),
  );
  cautionBand.position.set(lobbyCenter.x, lobbyCenter.y + 2.5, lobbyCenter.z + 10.68);
  cautionBand.rotation.z = 0.22;
  lobbyRoot.add(cautionBand);
  const cautionBand2 = cautionBand.clone();
  cautionBand2.rotation.z = -0.22;
  lobbyRoot.add(cautionBand2);
  for (let i = 0; i < 5; i += 1) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 0.8, 12),
      new THREE.MeshLambertMaterial({ color: 0xff8f4e }),
    );
    cone.position.set(lobbyCenter.x - 5.4 + i * 2.7, lobbyCenter.y + 0.38, lobbyCenter.z + 9.25);
    lobbyRoot.add(cone);
  }

  const stall = new THREE.Group();
  const stallBase = world.stallOffset;
  const roofLeft = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.3, 5.6),
    new THREE.MeshLambertMaterial({ color: 0x2e241f }),
  );
  roofLeft.position.set(lobbyCenter.x + stallBase.x - 2.0, lobbyCenter.y + 4.0 + stallBase.y, lobbyCenter.z + stallBase.z);
  roofLeft.rotation.z = 0.22;
  stall.add(roofLeft);
  const roofRight = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.3, 5.6),
    new THREE.MeshLambertMaterial({ color: 0x352a22 }),
  );
  roofRight.position.set(lobbyCenter.x + stallBase.x + 2.0, lobbyCenter.y + 4.0 + stallBase.y, lobbyCenter.z + stallBase.z);
  roofRight.rotation.z = -0.22;
  stall.add(roofRight);
  const beamMaterial = new THREE.MeshLambertMaterial({ color: 0x503426 });
  [-3.6, 3.6].forEach((x) => {
    [-2.1, 2.1].forEach((z) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.8, 0.28), beamMaterial);
      beam.position.set(lobbyCenter.x + stallBase.x + x, lobbyCenter.y + 1.7 + stallBase.y, lobbyCenter.z + stallBase.z + z);
      stall.add(beam);
    });
  });
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(9.0, 0.15, 0.8),
    new THREE.MeshLambertMaterial({ color: 0xf2efe8 }),
  );
  awning.position.set(lobbyCenter.x + stallBase.x, lobbyCenter.y + 3.2 + stallBase.y, lobbyCenter.z + stallBase.z + 2.5);
  stall.add(awning);
  const stallFloor = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 0.08, 6.5),
    new THREE.MeshLambertMaterial({ color: 0x5a4e40 }),
  );
  stallFloor.position.set(lobbyCenter.x + stallBase.x, lobbyCenter.y + 0.01 + stallBase.y, lobbyCenter.z + stallBase.z);
  stall.add(stallFloor);
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.34, 1),
    new THREE.MeshLambertMaterial({ color: 0x6a4830 }),
  );
  counter.position.set(lobbyCenter.x + stallBase.x, lobbyCenter.y + 1.25 + stallBase.y, lobbyCenter.z + stallBase.z + 1.4);
  stall.add(counter);
  const sign = makeTextSprite(THREE, 'PVP Shop', { scaleX: 5.8, scaleY: 1.4 });
  sign.position.set(lobbyCenter.x + stallBase.x, lobbyCenter.y + 4.7 + stallBase.y, lobbyCenter.z + stallBase.z - 0.1);
  stall.add(sign);
  const backShelf = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 0.24, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x593a27 }),
  );
  backShelf.position.set(lobbyCenter.x + stallBase.x, lobbyCenter.y + 2.05 + stallBase.y, lobbyCenter.z + stallBase.z - 1.65);
  stall.add(backShelf);
  const crateLeft = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 1, 1.15),
    new THREE.MeshLambertMaterial({ color: 0x745038 }),
  );
  crateLeft.position.set(lobbyCenter.x + stallBase.x - 2.6, lobbyCenter.y + 0.52 + stallBase.y, lobbyCenter.z + stallBase.z + 0.3);
  stall.add(crateLeft);
  const crateRight = crateLeft.clone();
  crateRight.position.x = lobbyCenter.x + stallBase.x + 2.6;
  stall.add(crateRight);
  const weaponStandMat = new THREE.MeshLambertMaterial({ color: 0xd9c6a0 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 0.14), weaponStandMat);
  blade.position.set(lobbyCenter.x + stallBase.x - 1.5, lobbyCenter.y + 2.1 + stallBase.y, lobbyCenter.z + stallBase.z - 1.45);
  blade.rotation.z = 0.36;
  stall.add(blade);
  const rifleBody = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.18, 0.28), new THREE.MeshLambertMaterial({ color: 0x5b6673 }));
  rifleBody.position.set(lobbyCenter.x + stallBase.x, lobbyCenter.y + 2.15 + stallBase.y, lobbyCenter.z + stallBase.z - 1.45);
  stall.add(rifleBody);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 18, 18),
    new THREE.MeshLambertMaterial({ color: 0x73d3ff, emissive: 0x2d8cff, emissiveIntensity: 0.4 })
  );
  orb.position.set(lobbyCenter.x + stallBase.x + 1.75, lobbyCenter.y + 2.2 + stallBase.y, lobbyCenter.z + stallBase.z - 1.45);
  stall.add(orb);
  const potionRack = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 0.44, 10),
      new THREE.MeshLambertMaterial({ color: i === 0 ? 0x88ffb0 : i === 1 ? 0xff99c1 : 0xffd166 })
    );
    bottle.position.set(lobbyCenter.x + stallBase.x + 0.95 + i * 0.42, lobbyCenter.y + 1.8 + stallBase.y, lobbyCenter.z + stallBase.z + 1.15);
    potionRack.add(bottle);
  }
  stall.add(potionRack);
  const priceBoard = makeTextSprite(THREE, 'Blades • Guns • Powers', {
    scaleX: 6.2,
    scaleY: 1.1,
    background: 'rgba(12, 17, 28, 0.94)',
    border: 'rgba(115,211,255,0.35)',
    color: '#eff6ff'
  });
  priceBoard.position.set(lobbyCenter.x + stallBase.x, lobbyCenter.y + 0.95 + stallBase.y, lobbyCenter.z + stallBase.z + 3.15);
  stall.add(priceBoard);
  [-3.2, 3.2].forEach((lx) => {
    const lantern = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.45, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x8b6914 }),
    );
    lantern.position.set(lobbyCenter.x + stallBase.x + lx, lobbyCenter.y + 3.0 + stallBase.y, lobbyCenter.z + stallBase.z + 2.0);
    stall.add(lantern);
    const lanternGlow = new THREE.PointLight(0xffaa44, 0.4, 6, 2);
    lanternGlow.position.copy(lantern.position);
    stall.add(lanternGlow);
  });
  lobbyRoot.add(stall);

  const vendor = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.2, 0.8), new THREE.MeshLambertMaterial({ color: 0x7d4d35 }));
  body.position.set(lobbyCenter.x + stallBase.x, lobbyCenter.y + 0.7 + stallBase.y, lobbyCenter.z + stallBase.z + 0.2);
  vendor.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), new THREE.MeshLambertMaterial({ color: 0xc89b77 }));
  head.position.set(lobbyCenter.x + stallBase.x, lobbyCenter.y + 2.35 + stallBase.y, lobbyCenter.z + stallBase.z + 0.2);
  vendor.add(head);
  const armLeft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.3, 0.32), new THREE.MeshLambertMaterial({ color: 0x7d4d35 }));
  armLeft.position.set(lobbyCenter.x + stallBase.x - 0.88, lobbyCenter.y + 0.9 + stallBase.y, lobbyCenter.z + stallBase.z + 0.32);
  armLeft.rotation.z = 0.28;
  vendor.add(armLeft);
  const armRight = armLeft.clone();
  armRight.position.x = lobbyCenter.x + stallBase.x + 0.88;
  armRight.rotation.z = -0.28;
  vendor.add(armRight);
  lobbyRoot.add(vendor);

  const combatRoot = new THREE.Group();
  combatRoot.name = 'arena-combat';
  combatRoot.visible = false;
  root.add(combatRoot);

  const combatCliff = new THREE.Mesh(
    new THREE.CylinderGeometry(26.5, 29.5, 4.2, 56),
    new THREE.MeshLambertMaterial({ color: 0x4a3828 }),
  );
  combatCliff.position.set(combatCenter.x, combatCenter.y - 1.6, combatCenter.z);
  combatRoot.add(combatCliff);

  const combatShelf = new THREE.Mesh(
    new THREE.CylinderGeometry(24.0, 25.5, 1.2, 56),
    new THREE.MeshLambertMaterial({ color: 0x5e4d3d }),
  );
  combatShelf.position.set(combatCenter.x, combatCenter.y - 0.2, combatCenter.z);
  combatRoot.add(combatShelf);

  const combatDeck = new THREE.Mesh(
    new THREE.CircleGeometry(23.0, 56),
    new THREE.MeshLambertMaterial({ color: 0x6e7562 }),
  );
  combatDeck.rotation.x = -Math.PI / 2;
  combatDeck.position.set(combatCenter.x, combatCenter.y + 0.02, combatCenter.z);
  combatRoot.add(combatDeck);

  const combatOuterTrim = new THREE.Mesh(
    new THREE.RingGeometry(18.8, 22.2, 56),
    new THREE.MeshLambertMaterial({ color: 0x8d765b, side: THREE.DoubleSide }),
  );
  combatOuterTrim.rotation.x = -Math.PI / 2;
  combatOuterTrim.position.set(combatCenter.x, combatCenter.y + 0.03, combatCenter.z);
  combatRoot.add(combatOuterTrim);

  const combatTrack = new THREE.Mesh(
    new THREE.RingGeometry(9.6, 18.2, 56),
    new THREE.MeshLambertMaterial({ color: 0x60655a, side: THREE.DoubleSide }),
  );
  combatTrack.rotation.x = -Math.PI / 2;
  combatTrack.position.set(combatCenter.x, combatCenter.y + 0.035, combatCenter.z);
  combatRoot.add(combatTrack);

  const arenaRing = new THREE.Mesh(
    new THREE.RingGeometry(9.8, 13.3, 56),
    new THREE.MeshBasicMaterial({ color: 0xff8a5b, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  arenaRing.rotation.x = -Math.PI / 2;
  arenaRing.position.set(combatCenter.x, combatCenter.y + 0.05, combatCenter.z);
  combatRoot.add(arenaRing);

  const innerGlow = new THREE.Mesh(
    new THREE.RingGeometry(3.5, 5.5, 48),
    new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
  );
  innerGlow.rotation.x = -Math.PI / 2;
  innerGlow.position.set(combatCenter.x, combatCenter.y + 0.06, combatCenter.z);
  combatRoot.add(innerGlow);

  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(20.5, 22.5, 56),
    new THREE.MeshBasicMaterial({ color: 0xff5533, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
  );
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.set(combatCenter.x, combatCenter.y + 0.055, combatCenter.z);
  combatRoot.add(outerRing);

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const rune = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.8, 5 + (i % 3)),
      new THREE.MeshBasicMaterial({ color: 0xff6644, transparent: true, opacity: 0.15, side: THREE.DoubleSide }),
    );
    rune.rotation.x = -Math.PI / 2;
    rune.rotation.z = angle;
    rune.position.set(
      combatCenter.x + Math.cos(angle) * 15.5,
      combatCenter.y + 0.06,
      combatCenter.z + Math.sin(angle) * 15.5
    );
    combatRoot.add(rune);
  }

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.4;
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.02, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xff8855, transparent: true, opacity: 0.06 }),
    );
    line.rotation.y = angle;
    line.position.set(combatCenter.x, combatCenter.y + 0.055, combatCenter.z);
    combatRoot.add(line);
  }

  const outerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(23.2, 23.6, 3.0, 56),
    new THREE.MeshLambertMaterial({ color: 0x3d4552 }),
  );
  outerWall.position.set(combatCenter.x, combatCenter.y + 1.4, combatCenter.z);
  combatRoot.add(outerWall);

  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2;
    if (i % 7 === 0) continue;
    const brick = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.25, 0.2),
      new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? 0x4a5562 : 0x3f4a55 }),
    );
    brick.position.set(
      combatCenter.x + Math.cos(angle) * 23.4,
      combatCenter.y + 0.5 + (i % 3) * 0.5,
      combatCenter.z + Math.sin(angle) * 23.4
    );
    brick.lookAt(combatCenter.x, brick.position.y, combatCenter.z);
    combatRoot.add(brick);
  }

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const railPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 1.8, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a4a38 }),
    );
    railPost.position.set(
      combatCenter.x + Math.cos(angle) * 21.5,
      combatCenter.y + 0.9,
      combatCenter.z + Math.sin(angle) * 21.5
    );
    combatRoot.add(railPost);
    const railCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x7a6a50 }),
    );
    railCap.position.set(
      combatCenter.x + Math.cos(angle) * 21.5,
      combatCenter.y + 1.85,
      combatCenter.z + Math.sin(angle) * 21.5
    );
    combatRoot.add(railCap);
  }

  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2 + 0.17;
    const size = 0.6 + (i % 4) * 0.35;
    const rock = new THREE.Mesh(
      i % 3 === 0
        ? new THREE.DodecahedronGeometry(size)
        : i % 3 === 1
          ? new THREE.OctahedronGeometry(size * 0.9)
          : new THREE.BoxGeometry(size, size * 1.2, size),
      new THREE.MeshLambertMaterial({ color: 0x3e4650 + (i % 3) * 0x0a0a0a }),
    );
    rock.position.set(
      combatCenter.x + Math.cos(angle) * 21.0,
      combatCenter.y + 0.5,
      combatCenter.z + Math.sin(angle) * 21.0
    );
    rock.rotation.y = angle + 0.5;
    combatRoot.add(rock);
    if (i % 2 === 0) {
      const smallRock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(size * 0.4),
        new THREE.MeshLambertMaterial({ color: 0x4a525c }),
      );
      smallRock.position.set(
        combatCenter.x + Math.cos(angle + 0.15) * 21.8,
        combatCenter.y + 0.3,
        combatCenter.z + Math.sin(angle + 0.15) * 21.8
      );
      combatRoot.add(smallRock);
    }
  }

  const centerPad = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.8, 0.4, 28),
    new THREE.MeshLambertMaterial({ color: 0x2e343d }),
  );
  centerPad.position.set(combatCenter.x, combatCenter.y + 0.08, combatCenter.z);
  combatRoot.add(centerPad);

  const centerPadTrim = new THREE.Mesh(
    new THREE.RingGeometry(4.8, 5.5, 28),
    new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide }),
  );
  centerPadTrim.rotation.x = -Math.PI / 2;
  centerPadTrim.position.set(combatCenter.x, combatCenter.y + 0.3, combatCenter.z);
  combatRoot.add(centerPadTrim);

  const centerCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.5),
    new THREE.MeshLambertMaterial({ color: 0x73d3ff, emissive: 0x2b7fff, emissiveIntensity: 0.7 }),
  );
  centerCore.position.set(combatCenter.x, combatCenter.y + 2.6, combatCenter.z);
  combatRoot.add(centerCore);

  const coreRing1 = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.08, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0x55aaff, transparent: true, opacity: 0.5 }),
  );
  coreRing1.position.set(combatCenter.x, combatCenter.y + 2.6, combatCenter.z);
  combatRoot.add(coreRing1);
  const coreRing2 = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.06, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0x77ccff, transparent: true, opacity: 0.35 }),
  );
  coreRing2.position.set(combatCenter.x, combatCenter.y + 2.6, combatCenter.z);
  coreRing2.rotation.x = Math.PI * 0.35;
  combatRoot.add(coreRing2);

  const coreGlow = new THREE.PointLight(0x4499ff, 1.2, 12, 2);
  coreGlow.position.set(combatCenter.x, combatCenter.y + 3.5, combatCenter.z);
  combatRoot.add(coreGlow);

  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const px = combatCenter.x + Math.cos(angle) * 17.4;
    const pz = combatCenter.z + Math.sin(angle) * 17.4;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.75, 7.0, 10),
      new THREE.MeshLambertMaterial({ color: 0x3a4250 }),
    );
    pillar.position.set(px, combatCenter.y + 3.0, pz);
    combatRoot.add(pillar);
    const pillarCap = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.25, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x4e5766 }),
    );
    pillarCap.position.set(px, combatCenter.y + 6.55, pz);
    combatRoot.add(pillarCap);
    const pillarBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.3, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x4e5766 }),
    );
    pillarBase.position.set(px, combatCenter.y - 0.3, pz);
    combatRoot.add(pillarBase);

    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 2.0, 0.05),
      new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? 0xcc2211 : 0x2244aa }),
    );
    banner.position.set(
      px + Math.cos(angle + Math.PI / 2) * 0.55,
      combatCenter.y + 5.0,
      pz + Math.sin(angle + Math.PI / 2) * 0.55
    );
    banner.rotation.y = angle;
    combatRoot.add(banner);
    const bannerTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.12, 0.07),
      new THREE.MeshLambertMaterial({ color: 0xffaa33 }),
    );
    bannerTrim.position.copy(banner.position);
    bannerTrim.position.y += 0.8;
    bannerTrim.rotation.y = angle;
    combatRoot.add(bannerTrim);

    const flameBowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.25, 0.3, 8),
      new THREE.MeshLambertMaterial({ color: 0x3a3a3a }),
    );
    flameBowl.position.set(px, combatCenter.y + 6.8, pz);
    combatRoot.add(flameBowl);
    const flameBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff7722 }),
    );
    flameBall.position.set(px, combatCenter.y + 7.1, pz);
    combatRoot.add(flameBall);
    const flame = new THREE.PointLight(0xff9944, 1.1, 14, 2);
    flame.position.set(px, combatCenter.y + 7.2, pz);
    combatRoot.add(flame);
  }

  const enemyRoot = new THREE.Group();
  const projectileRoot = new THREE.Group();
  combatRoot.add(enemyRoot);
  combatRoot.add(projectileRoot);
  const enemyMeshes = new Map();
  const projectileMeshes = new Map();

  function makeEnemyMesh(enemy) {
    const geometry = enemy.type === 'boss'
      ? new THREE.DodecahedronGeometry(1.6)
      : enemy.type === 'tank'
        ? new THREE.BoxGeometry(1.5, 1.5, 1.5)
        : enemy.type === 'ranged'
          ? new THREE.OctahedronGeometry(1)
          : new THREE.IcosahedronGeometry(enemy.type === 'elite' ? 1.2 : 0.9);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: enemy.color || '#ffffff' }));
    mesh.position.set(enemy.x, enemy.y + (enemy.type === 'boss' ? 1.6 : 1), enemy.z);
    enemyRoot.add(mesh);
    enemyMeshes.set(enemy.id, mesh);
    return mesh;
  }

  function makeProjectileMesh(projectile) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(projectile.radius || 0.26, 12, 12),
      new THREE.MeshBasicMaterial({ color: projectile.color || '#ffffff' }),
    );
    mesh.position.set(projectile.x, projectile.y || combatCenter.y + 1, projectile.z);
    projectileRoot.add(mesh);
    projectileMeshes.set(projectile.id, mesh);
    return mesh;
  }

  function syncMeshes(collection, meshMap, createMesh) {
    const seen = new Set();
    collection.forEach((entry) => {
      seen.add(entry.id);
      const mesh = meshMap.get(entry.id) || createMesh(entry);
      mesh.position.set(entry.x, entry.y || mesh.position.y, entry.z);
    });
    Array.from(meshMap.entries()).forEach(([id, mesh]) => {
      if (seen.has(id)) {
        return;
      }
      mesh.parent?.remove(mesh);
      mesh.geometry?.dispose?.();
      disposeMaterial(mesh.material);
      meshMap.delete(id);
    });
  }

  return {
    updateState(matchState) {
      combatRoot.visible = Boolean(matchState?.roomId);
      const enemies = Array.isArray(matchState?.enemies) ? matchState.enemies : [];
      const projectiles = Array.isArray(matchState?.projectiles) ? matchState.projectiles : [];
      syncMeshes(enemies, enemyMeshes, makeEnemyMesh);
      syncMeshes(projectiles, projectileMeshes, makeProjectileMesh);
    },
    dispose() {
      syncMeshes([], enemyMeshes, makeEnemyMesh);
      syncMeshes([], projectileMeshes, makeProjectileMesh);
      scene.remove(root);
      disposeGroup(root);
    },
  };
}
