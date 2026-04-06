import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import {
  PICKAXE_HEAD_COLORS,
  FISHING_ROD_ACCENT_COLORS
} from '../config/gameData.js';
import {
  normalizePickaxeTier,
  normalizeRodTier
} from '../utils/formatters.js';

let scene = null;
let fishingMiniGame = null;
let questState = null;

export function initPlayerMeshes({
  sceneRef = null,
  fishingMiniGameRef = null,
  questStateRef = null
} = {}) {
  scene = sceneRef;
  fishingMiniGame = fishingMiniGameRef;
  questState = questStateRef;
}

export function makeExactBaconMesh() {
  // TODO: Implement actual bacon mesh or remove if not used
  // For now, return a simple cube as placeholder
  const unit = 0.52;
  const geometry = new THREE.BoxGeometry(unit * 0.8, unit * 0.4, unit * 0.3);
  const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide,
    color: 0xff6b35,
    roughness: 0.3,
    metalness: 0.1
  });
  return new THREE.Mesh(geometry, material);
}

export function createHeldPickaxeMesh(unit) {
  const mesh = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055 * unit, 0.055 * unit, 1.42 * unit, 8),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x7c4a26, roughness: 0.8 })
  );
  handle.rotation.z = Math.PI / 2;
  handle.castShadow = true;

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.64 * unit, 0.22 * unit, 0.22 * unit),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: PICKAXE_HEAD_COLORS.wood, roughness: 0.45, metalness: 0.18 })
  );
  head.position.set(0.58 * unit, 0, 0);
  head.castShadow = true;

  mesh.add(handle, head);
  mesh.userData.head = head;
  return mesh;
}

export function createHeldFishingRodMesh(unit) {
  const rod = new THREE.Group();
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 * unit, 0.09 * unit, 0.52 * unit, 10),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x7c4a26, roughness: 0.84 })
  );
  grip.rotation.z = Math.PI / 2;
  grip.position.x = -0.46 * unit;
  grip.castShadow = true;

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028 * unit, 0.033 * unit, 2.25 * unit, 10),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0xdbeafe, roughness: 0.28, metalness: 0.52 })
  );
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = 0.36 * unit;
  shaft.castShadow = true;

  const accent = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11 * unit, 0.11 * unit, 0.14 * unit, 14),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: FISHING_ROD_ACCENT_COLORS.basic, roughness: 0.36, metalness: 0.58 })
  );
  accent.position.set(-0.2 * unit, -0.12 * unit, 0);
  accent.castShadow = true;

  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007 * unit, 0.007 * unit, 0.56 * unit, 6),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0xe2e8f0, roughness: 0.22, metalness: 0.1 })
  );
  line.position.set(1.44 * unit, -0.28 * unit, 0);
  line.castShadow = true;

  const hook = new THREE.Mesh(
    new THREE.SphereGeometry(0.03 * unit, 8, 8),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x94a3b8, roughness: 0.32, metalness: 0.55 })
  );
  hook.position.set(1.44 * unit, -0.58 * unit, -0.15 * unit);
  hook.castShadow = true;

  rod.add(grip, shaft, accent, line, hook);
  rod.userData.accent = accent;
  return rod;
}

export function createHeldTorchMesh(unit) {
  const torch = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06 * unit, 0.07 * unit, 1.0 * unit, 8),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x7c4a26, roughness: 0.85 })
  );
  handle.castShadow = true;

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 * unit, 0.08 * unit, 0.14 * unit, 10),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x9ca3af, roughness: 0.3, metalness: 0.6 })
  );
  band.position.y = 0.42 * unit;
  band.castShadow = true;

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.14 * unit, 0.36 * unit, 10),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0xf97316, emissive: 0xf59e0b, emissiveIntensity: 1.25, roughness: 0.28 })
  );
  flame.position.set(0, 0.72 * unit, 0.05 * unit);
  flame.castShadow = true;

  torch.add(handle, band, flame);
  torch.userData.flame = flame;
  return torch;
}

export function paintPlayer(player, appearance) {
  const parts = player?.mesh?.userData?.parts;
  if (!parts) return;
  const tintMeshTree = (node, color) => {
    if (!node) return;
    if (node.material?.color) {
      node.material.color.set(color);
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => tintMeshTree(child, color));
    }
  };

  parts.torso.material.color.set(appearance.shirt);
  parts.torsoStripe.material.color.set(appearance.shirt);
  parts.jacket.material.color.set(appearance.shirt);
  parts.belt.material.color.set(0x1f2937);
  parts.hips.material.color.set(appearance.pants);
  parts.neck.material.color.set(appearance.skin);
  parts.neckConnector.material.color.set(appearance.skin);
  parts.head.material.color.set(appearance.skin);
  parts.leftArm.material.color.set(appearance.skin);
  parts.rightArm.material.color.set(appearance.skin);
  parts.leftHand.material.color.set(appearance.skin);
  parts.rightHand.material.color.set(appearance.skin);
  parts.leftSleeve.material.color.set(appearance.shirt);
  parts.rightSleeve.material.color.set(appearance.shirt);
  parts.leftLeg.material.color.set(appearance.pants);
  parts.rightLeg.material.color.set(appearance.pants);
  parts.leftBoot.material.color.set(appearance.shoes);
  parts.rightBoot.material.color.set(appearance.shoes);
  tintMeshTree(parts.hairShort, appearance.hairColor);
  tintMeshTree(parts.hairSidePart, appearance.hairColor);
  tintMeshTree(parts.sideBang, appearance.hairColor);
  tintMeshTree(parts.hairSpiky, appearance.hairColor);
  tintMeshTree(parts.hairLong, appearance.hairColor);
  tintMeshTree(parts.hairPonytail, appearance.hairColor);
  tintMeshTree(parts.hairBob, appearance.hairColor);
  tintMeshTree(parts.hairWavy, appearance.hairColor);

  parts.hairShort.visible = appearance.hairStyle === 'short';
  parts.hairSidePart.visible = appearance.hairStyle === 'sidepart';
  parts.sideBang.visible = appearance.hairStyle === 'sidepart';
  parts.hairSpiky.visible = appearance.hairStyle === 'spiky';
  parts.hairLong.visible = appearance.hairStyle === 'long';
  parts.hairPonytail.visible = appearance.hairStyle === 'ponytail';
  parts.hairBob.visible = appearance.hairStyle === 'bob';
  parts.hairWavy.visible = appearance.hairStyle === 'wavy';
  const accessories = Array.isArray(appearance.accessories) ? appearance.accessories : [];
  parts.hat.visible = accessories.includes('hat');
  parts.glasses.visible = accessories.includes('glasses');
  parts.backpack.visible = accessories.includes('backpack');

  parts.leftEye.visible = true;
  parts.rightEye.visible = true;
  parts.leftEyeWink.visible = false;
  parts.leftLashes.visible = false;
  parts.rightLashes.visible = false;
  parts.mouthSmile.visible = false;
  parts.mouthSerious.visible = false;
  parts.mouthGrin.visible = false;
  parts.mouthSoft.visible = false;

  if (appearance.faceStyle === 'serious') {
    parts.mouthSerious.visible = true;
  } else if (appearance.faceStyle === 'grin') {
    parts.mouthGrin.visible = true;
  } else if (appearance.faceStyle === 'wink') {
    parts.leftEye.visible = false;
    parts.leftEyeWink.visible = true;
    parts.mouthSmile.visible = true;
  } else if (appearance.faceStyle === 'lashessmile') {
    parts.leftLashes.visible = true;
    parts.rightLashes.visible = true;
    parts.mouthSmile.visible = true;
  } else if (appearance.faceStyle === 'soft') {
    parts.leftLashes.visible = true;
    parts.rightLashes.visible = true;
    parts.mouthSoft.visible = true;
  } else {
    parts.mouthSmile.visible = true;
  }
}

export function applyHeldGearVisual(player) {
  const parts = player?.mesh?.userData?.parts;
  if (!parts) return;

  const tier = player && player.heldPickaxe != null ? normalizePickaxeTier(player.heldPickaxe, 'wood') : 'wood';
  const rodTier = player && player.heldFishingRodTier != null ? normalizeRodTier(player.heldFishingRodTier, 'basic') : 'basic';
  const hasRod = player.hasFishingRod === true;
  const fishingActive = player.isLocal
    ? Boolean(fishingMiniGame.active || fishingMiniGame.starting)
    : player.isFishing === true;
  const rodVisible = hasRod && fishingActive;
  const pickaxeVisible = !rodVisible;

  if (parts.heldPickaxeHead?.material?.color) {
    parts.heldPickaxeHead.material.color.set(PICKAXE_HEAD_COLORS[tier] || PICKAXE_HEAD_COLORS.wood);
  }
  if (parts.heldPickaxe) {
    parts.heldPickaxe.visible = pickaxeVisible;
  }
  if (parts.heldFishingRodAccent?.material?.color) {
    parts.heldFishingRodAccent.material.color.set(FISHING_ROD_ACCENT_COLORS[rodTier] || FISHING_ROD_ACCENT_COLORS.basic);
  }
  if (parts.heldFishingRod) {
    parts.heldFishingRod.visible = rodVisible;
  }

  const localTorchCount = player.isLocal ? Math.max(0, Math.floor(Number(questState.inventory.torch) || 0)) : 1;
  const torchVisible = Boolean(player.torchEquipped) && localTorchCount > 0;
  if (parts.heldTorch) {
    parts.heldTorch.visible = torchVisible;
  }
  if (parts.heldTorchFlame) {
    parts.heldTorchFlame.visible = torchVisible;
  }
}

export function makePlayerMesh(appearance) {
  const exact = makeExactBaconMesh();
  if (exact) {
    return exact;
  }

  const UNIT = 0.52;
  const rig = new THREE.Group();
  rig.position.y = 0.56;

  const hips = new THREE.Mesh(
    new THREE.BoxGeometry(1.36 * UNIT, 0.86 * UNIT, 0.72 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: appearance.pants, roughness: 0.82 })
  );
  hips.position.y = 1.08 * UNIT;
  hips.castShadow = true;

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(1.56 * UNIT, 1.62 * UNIT, 0.88 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: appearance.shirt, roughness: 0.68 })
  );
  torso.position.y = 2.46 * UNIT;
  torso.castShadow = true;

  const torsoStripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.32 * UNIT, 0.3 * UNIT, 0.08 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0xe5e7eb, roughness: 0.7 })
  );
  torsoStripe.position.set(0, 2.4 * UNIT, 0.49 * UNIT);
  torsoStripe.castShadow = true;

  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(1.62 * UNIT, 1.66 * UNIT, 0.94 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x14181e, roughness: 0.75 })
  );
  jacket.position.copy(torso.position);
  jacket.castShadow = true;

  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(1.4 * UNIT, 0.14 * UNIT, 0.82 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x1f2937, roughness: 0.72 })
  );
  belt.position.y = 1.76 * UNIT;
  belt.castShadow = true;

  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(0.38 * UNIT, 0.2 * UNIT, 0.28 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: appearance.skin, roughness: 0.9 })
  );
  neck.position.y = 3.52 * UNIT;
  neck.castShadow = true;

  const neckConnector = new THREE.Mesh(
    new THREE.BoxGeometry(0.44 * UNIT, 0.18 * UNIT, 0.34 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: appearance.skin, roughness: 0.88 })
  );
  neckConnector.position.y = 3.72 * UNIT;
  neckConnector.castShadow = true;

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.12 * UNIT, 1.08 * UNIT, 1.02 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: appearance.skin, roughness: 0.88 })
  );
  head.position.y = 4.42 * UNIT;
  head.castShadow = true;

  const eyeMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x0f172a, roughness: 0.2 });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06 * UNIT, 8, 8), eyeMat);
  leftEye.position.set(-0.23 * UNIT, 4.56 * UNIT, 0.56 * UNIT);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.23 * UNIT;

  const mouthSmile = new THREE.Mesh(new THREE.TorusGeometry(0.2 * UNIT, 0.03 * UNIT, 6, 12, Math.PI), eyeMat);
  mouthSmile.rotation.set(Math.PI, 0, 0);
  mouthSmile.position.set(0, 4.26 * UNIT, 0.56 * UNIT);

  const mouthSerious = new THREE.Mesh(new THREE.BoxGeometry(0.34 * UNIT, 0.03 * UNIT, 0.02 * UNIT), eyeMat);
  mouthSerious.position.set(0, 4.22 * UNIT, 0.56 * UNIT);

  const mouthGrin = new THREE.Mesh(new THREE.TorusGeometry(0.24 * UNIT, 0.04 * UNIT, 6, 14, Math.PI), eyeMat);
  mouthGrin.rotation.set(Math.PI, 0, 0);
  mouthGrin.position.set(0, 4.24 * UNIT, 0.56 * UNIT);
  const mouthSoft = new THREE.Mesh(new THREE.TorusGeometry(0.16 * UNIT, 0.025 * UNIT, 6, 12, Math.PI), eyeMat);
  mouthSoft.rotation.set(Math.PI, 0, 0);
  mouthSoft.position.set(0, 4.2 * UNIT, 0.56 * UNIT);

  const leftEyeWink = new THREE.Mesh(new THREE.BoxGeometry(0.13 * UNIT, 0.03 * UNIT, 0.02 * UNIT), eyeMat);
  leftEyeWink.position.set(-0.23 * UNIT, 4.56 * UNIT, 0.56 * UNIT);
  const lashMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x111827, roughness: 0.25 });
  const leftLashes = new THREE.Mesh(new THREE.BoxGeometry(0.16 * UNIT, 0.025 * UNIT, 0.02 * UNIT), lashMat);
  leftLashes.position.set(-0.23 * UNIT, 4.65 * UNIT, 0.56 * UNIT);
  const rightLashes = leftLashes.clone();
  rightLashes.position.x = 0.23 * UNIT;

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.86 * UNIT, 3.0 * UNIT, 0);
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.46 * UNIT, 1.4 * UNIT, 0.46 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: appearance.skin, roughness: 0.9 })
  );
  leftArm.position.y = -0.8 * UNIT;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);
  const leftSleeve = new THREE.Mesh(
    new THREE.BoxGeometry(0.5 * UNIT, 0.42 * UNIT, 0.5 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x14181e, roughness: 0.76 })
  );
  leftSleeve.position.y = -0.2 * UNIT;
  leftArmPivot.add(leftSleeve);

  const leftHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.36 * UNIT, 0.34 * UNIT, 0.32 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: appearance.skin, roughness: 0.88 })
  );
  leftHand.position.y = -1.7 * UNIT;
  leftHand.castShadow = true;
  leftArmPivot.add(leftHand);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.86 * UNIT, 3.0 * UNIT, 0);
  const rightArm = leftArm.clone();
  rightArm.position.y = -0.8 * UNIT;
  rightArmPivot.add(rightArm);
  const rightSleeve = leftSleeve.clone();
  rightArmPivot.add(rightSleeve);
  const rightHand = leftHand.clone();
  rightArmPivot.add(rightHand);

  const heldTorch = createHeldTorchMesh(UNIT);
  heldTorch.position.set(0.04 * UNIT, 0.14 * UNIT, 0.16 * UNIT);
  heldTorch.rotation.set(-1.04, -0.06, -0.18);
  heldTorch.visible = false;
  leftHand.add(heldTorch);

  const heldPickaxe = createHeldPickaxeMesh(UNIT);
  heldPickaxe.position.set(0.14 * UNIT, 0.18 * UNIT, 0.12 * UNIT);
  heldPickaxe.rotation.set(-1.08, 0.18, 0.42);
  rightHand.add(heldPickaxe);

  const heldFishingRod = createHeldFishingRodMesh(UNIT);
  heldFishingRod.position.set(0.16 * UNIT, 0.22 * UNIT, 0.16 * UNIT);
  heldFishingRod.rotation.set(-1.02, 0.18, 0.34);
  heldFishingRod.visible = false;
  rightHand.add(heldFishingRod);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.38 * UNIT, 1.02 * UNIT, 0);
  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.52 * UNIT, 1.8 * UNIT, 0.56 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: appearance.pants, roughness: 0.84 })
  );
  leftLeg.position.y = -1.02 * UNIT;
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);

  const leftKnee = new THREE.Mesh(
    new THREE.BoxGeometry(0.53 * UNIT, 0.2 * UNIT, 0.58 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x1e293b, roughness: 0.7 })
  );
  leftKnee.position.y = -0.94 * UNIT;
  leftKnee.castShadow = true;
  leftLegPivot.add(leftKnee);

  const leftBoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.58 * UNIT, 0.4 * UNIT, 0.88 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: appearance.shoes, roughness: 0.68 })
  );
  leftBoot.position.set(0, -1.96 * UNIT, 0.14 * UNIT);
  leftBoot.castShadow = true;
  leftLegPivot.add(leftBoot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.38 * UNIT, 1.02 * UNIT, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.y = -1.02 * UNIT;
  rightLegPivot.add(rightLeg);
  const rightKnee = leftKnee.clone();
  rightLegPivot.add(rightKnee);
  const rightBoot = leftBoot.clone();
  rightLegPivot.add(rightBoot);

  const hairMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: appearance.hairColor, roughness: 0.6 });
  const hairMatSoft = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: appearance.hairColor, roughness: 0.72 });

  const hairShort = new THREE.Group();
  const shortCrown = new THREE.Mesh(new THREE.SphereGeometry(0.66 * UNIT, 18, 12), hairMat);
  shortCrown.scale.set(1.0, 0.58, 0.96);
  shortCrown.position.set(0, 5.08 * UNIT, -0.02 * UNIT);
  shortCrown.castShadow = true;
  const shortBack = new THREE.Mesh(new THREE.BoxGeometry(1.06 * UNIT, 0.34 * UNIT, 0.26 * UNIT), hairMatSoft);
  shortBack.position.set(0, 4.85 * UNIT, -0.46 * UNIT);
  shortBack.castShadow = true;
  for (let i = -1; i <= 1; i += 1) {
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.22 * UNIT, 0.2 * UNIT, 0.16 * UNIT), hairMat);
    fringe.position.set(i * 0.19 * UNIT, 4.84 * UNIT - Math.abs(i) * 0.01 * UNIT, 0.53 * UNIT);
    fringe.castShadow = true;
    hairShort.add(fringe);
  }
  hairShort.add(shortCrown, shortBack);

  const hairSidePart = new THREE.Group();
  const sideCrown = new THREE.Mesh(new THREE.SphereGeometry(0.68 * UNIT, 18, 12), hairMat);
  sideCrown.scale.set(1.0, 0.6, 0.96);
  sideCrown.position.set(0.04 * UNIT, 5.07 * UNIT, 0);
  sideCrown.castShadow = true;
  const partLine = new THREE.Mesh(new THREE.BoxGeometry(0.1 * UNIT, 0.02 * UNIT, 0.82 * UNIT), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0xd1d5db, roughness: 0.3 }));
  partLine.position.set(0.1 * UNIT, 5.26 * UNIT, -0.02 * UNIT);
  const sideSweep = new THREE.Mesh(new THREE.BoxGeometry(0.44 * UNIT, 0.28 * UNIT, 0.2 * UNIT), hairMatSoft);
  sideSweep.position.set(0.31 * UNIT, 4.93 * UNIT, 0.49 * UNIT);
  sideSweep.rotation.y = -0.15;
  sideSweep.castShadow = true;
  const sideBang = new THREE.Mesh(new THREE.BoxGeometry(0.34 * UNIT, 0.34 * UNIT, 0.18 * UNIT), hairMatSoft);
  sideBang.position.set(-0.28 * UNIT, 4.82 * UNIT, 0.54 * UNIT);
  sideBang.rotation.y = 0.18;
  sideBang.castShadow = true;
  hairSidePart.add(sideCrown, partLine, sideSweep, sideBang);

  const hairSpiky = new THREE.Group();
  for (let i = -2; i <= 2; i += 1) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry((0.14 + Math.abs(i) * 0.015) * UNIT, 0.58 * UNIT, 12), hairMat);
    spike.position.set(i * 0.17 * UNIT, 5.2 * UNIT - Math.abs(i) * 0.02 * UNIT, -0.02 * UNIT);
    spike.rotation.x = -0.2 + Math.abs(i) * 0.05;
    spike.castShadow = true;
    hairSpiky.add(spike);
  }
  const spikyBase = new THREE.Mesh(new THREE.SphereGeometry(0.62 * UNIT, 16, 10), hairMatSoft);
  spikyBase.scale.set(1, 0.38, 0.9);
  spikyBase.position.set(0, 5.03 * UNIT, -0.03 * UNIT);
  spikyBase.castShadow = true;
  hairSpiky.add(spikyBase);

  const hairLong = new THREE.Group();
  const longCrown = new THREE.Mesh(new THREE.SphereGeometry(0.66 * UNIT, 18, 12), hairMat);
  longCrown.scale.set(1.0, 0.58, 0.94);
  longCrown.position.set(0, 5.08 * UNIT, 0);
  longCrown.castShadow = true;
  const longBack = new THREE.Mesh(new THREE.BoxGeometry(1.0 * UNIT, 1.24 * UNIT, 0.52 * UNIT), hairMatSoft);
  longBack.position.set(0, 4.56 * UNIT, -0.42 * UNIT);
  longBack.castShadow = true;
  const longFrontL = new THREE.Mesh(new THREE.BoxGeometry(0.2 * UNIT, 0.56 * UNIT, 0.16 * UNIT), hairMatSoft);
  longFrontL.position.set(-0.49 * UNIT, 4.6 * UNIT, 0.38 * UNIT);
  longFrontL.castShadow = true;
  const longFrontR = longFrontL.clone();
  longFrontR.position.x = 0.49 * UNIT;
  hairLong.add(longCrown, longBack, longFrontL, longFrontR);

  const hairPonytail = new THREE.Group();
  const ponyCap = new THREE.Mesh(new THREE.SphereGeometry(0.66 * UNIT, 18, 12), hairMat);
  ponyCap.scale.set(1.0, 0.58, 0.95);
  ponyCap.position.set(0, 5.08 * UNIT, 0);
  ponyCap.castShadow = true;
  const ponyBand = new THREE.Mesh(new THREE.TorusGeometry(0.14 * UNIT, 0.03 * UNIT, 8, 16), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x111827, roughness: 0.5 }));
  ponyBand.position.set(0, 4.9 * UNIT, -0.5 * UNIT);
  ponyBand.rotation.x = Math.PI / 2;
  const ponyTailTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * UNIT, 0.13 * UNIT, 0.42 * UNIT, 10), hairMatSoft);
  ponyTailTop.position.set(0, 4.64 * UNIT, -0.58 * UNIT);
  ponyTailTop.rotation.x = 0.28;
  ponyTailTop.castShadow = true;
  const ponyTailMid = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * UNIT, 0.1 * UNIT, 0.42 * UNIT, 10), hairMatSoft);
  ponyTailMid.position.set(0, 4.3 * UNIT, -0.62 * UNIT);
  ponyTailMid.rotation.x = 0.2;
  ponyTailMid.castShadow = true;
  const ponyTailEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * UNIT, 0.06 * UNIT, 0.36 * UNIT, 10), hairMatSoft);
  ponyTailEnd.position.set(0, 4.02 * UNIT, -0.58 * UNIT);
  ponyTailEnd.rotation.x = 0.05;
  ponyTailEnd.castShadow = true;
  hairPonytail.add(ponyCap, ponyBand, ponyTailTop, ponyTailMid, ponyTailEnd);

  const hairBob = new THREE.Group();
  const bobCrown = new THREE.Mesh(new THREE.SphereGeometry(0.68 * UNIT, 18, 12), hairMat);
  bobCrown.scale.set(1.02, 0.58, 0.95);
  bobCrown.position.set(0, 5.05 * UNIT, 0);
  bobCrown.castShadow = true;
  const bobBack = new THREE.Mesh(new THREE.BoxGeometry(1.08 * UNIT, 0.82 * UNIT, 0.4 * UNIT), hairMatSoft);
  bobBack.position.set(0, 4.54 * UNIT, -0.36 * UNIT);
  bobBack.castShadow = true;
  const bobSideL = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * UNIT, 0.14 * UNIT, 0.72 * UNIT, 10), hairMatSoft);
  bobSideL.position.set(-0.55 * UNIT, 4.63 * UNIT, 0.1 * UNIT);
  bobSideL.rotation.z = 0.1;
  bobSideL.castShadow = true;
  const bobSideR = bobSideL.clone();
  bobSideR.position.x = 0.55 * UNIT;
  bobSideR.rotation.z = -0.1;
  hairBob.add(bobCrown, bobBack, bobSideL, bobSideR);

  const hairWavy = new THREE.Group();
  const waveCrown = new THREE.Mesh(new THREE.SphereGeometry(0.67 * UNIT, 18, 12), hairMat);
  waveCrown.scale.set(1, 0.58, 0.95);
  waveCrown.position.set(0, 5.08 * UNIT, -0.01 * UNIT);
  waveCrown.castShadow = true;
  hairWavy.add(waveCrown);
  for (let i = -2; i <= 2; i += 1) {
    const curl = new THREE.Mesh(new THREE.SphereGeometry((0.13 + (2 - Math.abs(i)) * 0.012) * UNIT, 10, 8), hairMatSoft);
    curl.position.set(i * 0.18 * UNIT, 4.58 * UNIT - Math.abs(i) * 0.02 * UNIT, 0.44 * UNIT);
    curl.castShadow = true;
    hairWavy.add(curl);
  }
  for (const side of [-1, 1]) {
    const sideWave = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * UNIT, 0.08 * UNIT, 0.58 * UNIT, 10), hairMatSoft);
    sideWave.position.set(side * 0.56 * UNIT, 4.52 * UNIT, 0.02 * UNIT);
    sideWave.rotation.z = -side * 0.12;
    sideWave.castShadow = true;
    hairWavy.add(sideWave);
  }

  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52 * UNIT, 0.52 * UNIT, 0.3 * UNIT, 16),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x111827, roughness: 0.6 })
  );
  hat.position.set(0, 5.38 * UNIT, 0);
  hat.castShadow = true;

  const glasses = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x0f172a, roughness: 0.2 });
  const glassLeft = new THREE.Mesh(new THREE.TorusGeometry(0.13 * UNIT, 0.02 * UNIT, 8, 12), glassMat);
  glassLeft.position.set(-0.22 * UNIT, 4.56 * UNIT, 0.57 * UNIT);
  const glassRight = glassLeft.clone();
  glassRight.position.x = 0.22 * UNIT;
  const glassBridge = new THREE.Mesh(new THREE.BoxGeometry(0.12 * UNIT, 0.02 * UNIT, 0.02 * UNIT), glassMat);
  glassBridge.position.set(0, 4.56 * UNIT, 0.57 * UNIT);
  glasses.add(glassLeft, glassRight, glassBridge);

  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(1.0 * UNIT, 1.2 * UNIT, 0.35 * UNIT),
    new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x374151, roughness: 0.82 })
  );
  backpack.position.set(0, 2.5 * UNIT, -0.64 * UNIT);
  backpack.castShadow = true;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 20),
    new THREE.MeshBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.25 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;

  rig.add(
    hips,
    torso,
    torsoStripe,
    jacket,
    belt,
    neck,
    neckConnector,
    head,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    leftEye,
    rightEye,
    mouthSmile,
    mouthSerious,
    mouthGrin,
    mouthSoft,
    leftEyeWink,
    leftLashes,
    rightLashes,
    hat,
    glasses,
    backpack,
    hairShort,
    hairSidePart,
    sideBang,
    hairSpiky,
    hairLong,
    hairPonytail,
    hairBob,
    hairWavy
  );

  const group = new THREE.Group();
  group.add(rig, shadow);
  group.userData.body = rig;
  group.userData.baseBodyY = rig.position.y;
  group.userData.parts = {
    hips,
    torso,
    jacket,
    neck,
    neckConnector,
    head,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    leftArm,
    rightArm,
    leftHand,
    rightHand,
    leftLeg,
    rightLeg,
    leftKnee,
    rightKnee,
    leftBoot,
    rightBoot,
    leftSleeve,
    rightSleeve,
    torsoStripe,
    belt,
    leftEye,
    rightEye,
    mouthSmile,
    mouthSerious,
    mouthGrin,
    mouthSoft,
    leftEyeWink,
    leftLashes,
    rightLashes,
    heldTorch,
    heldTorchFlame: heldTorch.userData.flame || null,
    heldPickaxe,
    heldPickaxeHead: heldPickaxe.userData.head || null,
    heldFishingRod,
    heldFishingRodAccent: heldFishingRod.userData.accent || null,
    hat,
    glasses,
    backpack,
    hairShort,
    hairSidePart,
    sideBang,
    hairSpiky,
    hairLong,
    hairPonytail,
    hairBob,
    hairWavy,
    faceStyle: appearance.faceStyle,
    accessories: appearance.accessories
  };
  scene.add(group);

  return group;
}
