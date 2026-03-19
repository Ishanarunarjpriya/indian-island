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

  const root = new THREE.Group();
  root.name = 'arena-hub';
  scene.add(root);

  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(world.islandRadius, world.islandRadius + 2.8, 2.8, 48),
    new THREE.MeshLambertMaterial({ color: 0x7eaa5d }),
  );
  island.position.set(world.hubCenter.x, world.hubCenter.y - 1.4, world.hubCenter.z);
  root.add(island);

  const shore = new THREE.Mesh(
    new THREE.TorusGeometry(world.islandRadius + 0.8, 1.2, 8, 48),
    new THREE.MeshLambertMaterial({ color: 0x6f5438 }),
  );
  shore.rotation.x = Math.PI / 2;
  shore.position.set(world.hubCenter.x, world.hubCenter.y - 0.2, world.hubCenter.z);
  root.add(shore);

  const arenaRing = new THREE.Mesh(
    new THREE.RingGeometry(world.islandRadius - 5, world.islandRadius - 1.3, 48),
    new THREE.MeshBasicMaterial({ color: 0xff8a5b, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
  );
  arenaRing.rotation.x = -Math.PI / 2;
  arenaRing.position.set(world.hubCenter.x, world.hubCenter.y + 0.04, world.hubCenter.z);
  root.add(arenaRing);

  const bridge = new THREE.Group();
  for (let i = 0; i < 8; i += 1) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.24, 1.7),
      new THREE.MeshLambertMaterial({ color: 0x7a5838 }),
    );
    plank.position.set(world.hubCenter.x, world.hubCenter.y - 0.05, world.hubCenter.z + world.islandRadius + 1.6 + i * 1.75);
    bridge.add(plank);
  }
  root.add(bridge);

  const stall = new THREE.Group();
  const stallBase = world.stallOffset;
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(8.4, 0.36, 5.2),
    new THREE.MeshLambertMaterial({ color: 0x2e241f }),
  );
  roof.position.set(world.hubCenter.x + stallBase.x, world.hubCenter.y + 3.5 + stallBase.y, world.hubCenter.z + stallBase.z);
  stall.add(roof);
  const beamMaterial = new THREE.MeshLambertMaterial({ color: 0x503426 });
  [-3.6, 3.6].forEach((x) => {
    [-2.1, 2.1].forEach((z) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.8, 0.28), beamMaterial);
      beam.position.set(world.hubCenter.x + stallBase.x + x, world.hubCenter.y + 1.7 + stallBase.y, world.hubCenter.z + stallBase.z + z);
      stall.add(beam);
    });
  });
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(8.6, 0.18, 0.6),
    new THREE.MeshLambertMaterial({ color: 0xf2efe8 }),
  );
  awning.position.set(world.hubCenter.x + stallBase.x, world.hubCenter.y + 3.2 + stallBase.y, world.hubCenter.z + stallBase.z + 2.3);
  stall.add(awning);
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.34, 1),
    new THREE.MeshLambertMaterial({ color: 0x6a4830 }),
  );
  counter.position.set(world.hubCenter.x + stallBase.x, world.hubCenter.y + 1.25 + stallBase.y, world.hubCenter.z + stallBase.z + 1.4);
  stall.add(counter);
  const sign = makeTextSprite(THREE, 'Arena', { scaleX: 5, scaleY: 1.4 });
  sign.position.set(world.hubCenter.x + stallBase.x, world.hubCenter.y + 4.7 + stallBase.y, world.hubCenter.z + stallBase.z - 0.1);
  stall.add(sign);
  root.add(stall);

  const vendor = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.2, 0.8), new THREE.MeshLambertMaterial({ color: 0x7d4d35 }));
  body.position.set(world.hubCenter.x + stallBase.x, world.hubCenter.y + 0.7 + stallBase.y, world.hubCenter.z + stallBase.z + 0.2);
  vendor.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), new THREE.MeshLambertMaterial({ color: 0xc89b77 }));
  head.position.set(world.hubCenter.x + stallBase.x, world.hubCenter.y + 2.35 + stallBase.y, world.hubCenter.z + stallBase.z + 0.2);
  vendor.add(head);
  root.add(vendor);

  const enemyRoot = new THREE.Group();
  const projectileRoot = new THREE.Group();
  root.add(enemyRoot);
  root.add(projectileRoot);
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
    mesh.position.set(projectile.x, projectile.y || world.hubCenter.y + 1, projectile.z);
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
