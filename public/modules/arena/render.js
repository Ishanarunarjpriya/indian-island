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

export function createArenaRenderer({ scene, world = ARENA_CLIENT_CONFIG.world }) {
  const THREE = window.THREE;
  if (!THREE || !scene) {
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

  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(world.islandRadius, world.islandRadius + 2.8, 2.8, 48),
    new THREE.MeshLambertMaterial({ color: 0x7eaa5d }),
  );
  island.position.set(lobbyCenter.x, lobbyCenter.y - 1.4, lobbyCenter.z);
  lobbyRoot.add(island);

  const shore = new THREE.Mesh(
    new THREE.TorusGeometry(world.islandRadius + 0.8, 1.2, 8, 48),
    new THREE.MeshLambertMaterial({ color: 0x6f5438 }),
  );
  shore.rotation.x = Math.PI / 2;
  shore.position.set(lobbyCenter.x, lobbyCenter.y - 0.2, lobbyCenter.z);
  lobbyRoot.add(shore);

  const lobbyRing = new THREE.Mesh(
    new THREE.RingGeometry(world.islandRadius - 6.5, world.islandRadius - 1.3, 48),
    new THREE.MeshBasicMaterial({ color: 0xff8a5b, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
  );
  lobbyRing.rotation.x = -Math.PI / 2;
  lobbyRing.position.set(lobbyCenter.x, lobbyCenter.y + 0.04, lobbyCenter.z);
  lobbyRoot.add(lobbyRing);

  const teleporterPlaza = new THREE.Mesh(
    new THREE.CylinderGeometry(6.8, 7.4, 0.36, 36),
    new THREE.MeshLambertMaterial({ color: 0x2b3240 }),
  );
  teleporterPlaza.position.set(lobbyCenter.x, lobbyCenter.y + 0.12, lobbyCenter.z + 5.2);
  lobbyRoot.add(teleporterPlaza);

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
      new THREE.BoxGeometry(0.5, 3.4, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x4e3528 }),
    );
    pillar.position.set(lobbyCenter.x + offsetX, lobbyCenter.y + 1.7, lobbyCenter.z + 5.2);
    lobbyRoot.add(pillar);
  });

  const teleporterSign = makeTextSprite(THREE, 'PVP TELEPORTER', {
    scaleX: 7.2,
    scaleY: 1.3,
    background: 'rgba(20, 27, 38, 0.92)',
    border: 'rgba(255,145,90,0.4)',
  });
  teleporterSign.position.set(lobbyCenter.x, lobbyCenter.y + 4.6, lobbyCenter.z + 8.3);
  lobbyRoot.add(teleporterSign);

  [
    { x: -5.2, z: 1.1, label: '1-2' },
    { x: 0, z: -1.1, label: '1-4' },
    { x: 5.2, z: 1.1, label: 'FAST' },
  ].forEach((slot) => {
    const queuePad = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.08, 2.2),
      new THREE.MeshBasicMaterial({ color: 0xf0bb58, transparent: true, opacity: 0.35 }),
    );
    queuePad.position.set(lobbyCenter.x + slot.x, lobbyCenter.y + 0.26, lobbyCenter.z + 5.2 + slot.z);
    lobbyRoot.add(queuePad);
    const queueLabel = makeTextSprite(THREE, slot.label, {
      scaleX: 2.8,
      scaleY: 0.9,
      background: 'rgba(15, 20, 32, 0.9)',
      color: '#ffe5b2',
    });
    queueLabel.position.set(lobbyCenter.x + slot.x, lobbyCenter.y + 1.2, lobbyCenter.z + 5.2 + slot.z);
    lobbyRoot.add(queueLabel);
  });

  const stall = new THREE.Group();
  const stallBase = world.stallOffset;
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(8.4, 0.36, 5.2),
    new THREE.MeshLambertMaterial({ color: 0x2e241f }),
  );
  roof.position.set(lobbyCenter.x + stallBase.x, lobbyCenter.y + 3.5 + stallBase.y, lobbyCenter.z + stallBase.z);
  stall.add(roof);
  const beamMaterial = new THREE.MeshLambertMaterial({ color: 0x503426 });
  [-3.6, 3.6].forEach((x) => {
    [-2.1, 2.1].forEach((z) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.8, 0.28), beamMaterial);
      beam.position.set(lobbyCenter.x + stallBase.x + x, lobbyCenter.y + 1.7 + stallBase.y, lobbyCenter.z + stallBase.z + z);
      stall.add(beam);
    });
  });
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(8.6, 0.18, 0.6),
    new THREE.MeshLambertMaterial({ color: 0xf2efe8 }),
  );
  awning.position.set(lobbyCenter.x + stallBase.x, lobbyCenter.y + 3.2 + stallBase.y, lobbyCenter.z + stallBase.z + 2.3);
  stall.add(awning);
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

  const combatBase = new THREE.Mesh(
    new THREE.CylinderGeometry(24, 26.8, 3.2, 56),
    new THREE.MeshLambertMaterial({ color: 0x5d4635 }),
  );
  combatBase.position.set(combatCenter.x, combatCenter.y - 1.45, combatCenter.z);
  combatRoot.add(combatBase);

  const combatTop = new THREE.Mesh(
    new THREE.CylinderGeometry(21.5, 23.3, 1.1, 56),
    new THREE.MeshLambertMaterial({ color: 0x6f7f55 }),
  );
  combatTop.position.set(combatCenter.x, combatCenter.y - 0.1, combatCenter.z);
  combatRoot.add(combatTop);

  const arenaRing = new THREE.Mesh(
    new THREE.RingGeometry(9.8, 13.3, 56),
    new THREE.MeshBasicMaterial({ color: 0xff8a5b, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  arenaRing.rotation.x = -Math.PI / 2;
  arenaRing.position.set(combatCenter.x, combatCenter.y + 0.04, combatCenter.z);
  combatRoot.add(arenaRing);

  const centerPad = new THREE.Mesh(
    new THREE.CylinderGeometry(4.8, 5.2, 0.3, 28),
    new THREE.MeshLambertMaterial({ color: 0x39404d }),
  );
  centerPad.position.set(combatCenter.x, combatCenter.y + 0.08, combatCenter.z);
  combatRoot.add(centerPad);

  const centerCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.3),
    new THREE.MeshLambertMaterial({ color: 0x73d3ff, emissive: 0x2b7fff, emissiveIntensity: 0.55 }),
  );
  centerCore.position.set(combatCenter.x, combatCenter.y + 2.4, combatCenter.z);
  combatRoot.add(centerCore);

  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.8, 6.4, 10),
      new THREE.MeshLambertMaterial({ color: 0x474f5c }),
    );
    pillar.position.set(
      combatCenter.x + Math.cos(angle) * 17.4,
      combatCenter.y + 2.8,
      combatCenter.z + Math.sin(angle) * 17.4
    );
    combatRoot.add(pillar);
    const flame = new THREE.PointLight(0xffb15a, 0.9, 13, 2);
    flame.position.set(pillar.position.x, combatCenter.y + 5.9, pillar.position.z);
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
