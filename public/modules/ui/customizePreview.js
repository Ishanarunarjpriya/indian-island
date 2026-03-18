import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

let scene = null;
let makePlayerMesh = null;
let paintPlayer = null;
let normalizeAppearance = null;
let currentFormAppearance = null;
let refs = null;
let state = null;

export function initCustomizePreview({
  sceneRef = null,
  makePlayerMeshRef = null,
  paintPlayerRef = null,
  normalizeAppearanceRef = null,
  currentFormAppearanceRef = null,
  refsRef = null,
  stateRef = null
} = {}) {
  scene = sceneRef;
  makePlayerMesh = makePlayerMeshRef;
  paintPlayer = paintPlayerRef;
  normalizeAppearance = normalizeAppearanceRef;
  currentFormAppearance = currentFormAppearanceRef;
  refs = refsRef;
  state = stateRef;
}

export function refreshItemCards() {
  refs.itemCards.forEach((card) => {
    const type = card.dataset.type;
    const value = card.dataset.value;
    const selected =
      (type === 'hair' && refs.hairStyleInputEl.value === value) ||
      (type === 'face' && refs.faceStyleInputEl.value === value) ||
      (type === 'accessory' && refs.selectedAccessories.has(value));
    card.classList.toggle('active', selected);
  });
}

export function makePreviewMesh(appearance) {
  const mesh = makePlayerMesh(appearance);
  scene.remove(mesh);
  mesh.position.set(0, 0, 0);
  paintPlayer({ mesh }, appearance);
  return mesh;
}

export function ensurePreviewScene() {
  if (state.previewScene) return;
  state.previewScene = new THREE.Scene();
  state.previewScene.background = new THREE.Color(0x111827);
  state.previewCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  state.previewCamera.position.set(0, 2.5, state.previewDistance);
  state.previewLight = new THREE.DirectionalLight(0xffffff, 1.25);
  state.previewLight.position.set(5, 8, 7);
  state.previewScene.add(new THREE.HemisphereLight(0xdbeafe, 0x1f2937, 0.86), state.previewLight);
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 24),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.92 })
  );
  pad.rotation.x = -Math.PI / 2;
  state.previewScene.add(pad);
  state.previewRenderer = new THREE.WebGLRenderer({ canvas: refs.customizePreviewEl, antialias: true, alpha: false });
  state.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.previewPixelRatioCap));

  const startDrag = (event) => {
    event.preventDefault();
    state.previewDragging = true;
    state.previewAutoSpin = false;
    state.previewPointerId = event.pointerId;
    state.previewLastX = event.clientX;
    state.previewLastY = event.clientY;
    if (refs.customizePreviewEl.setPointerCapture) {
      try {
        refs.customizePreviewEl.setPointerCapture(event.pointerId);
      } catch {}
    }
  };

  const moveDrag = (event) => {
    if (!state.previewDragging || (state.previewPointerId !== null && event.pointerId !== state.previewPointerId)) return;
    event.preventDefault();
    const dx = event.clientX - state.previewLastX;
    const dy = event.clientY - state.previewLastY;
    state.previewLastX = event.clientX;
    state.previewLastY = event.clientY;
    state.previewYaw += dx * 0.012;
    state.previewPitch = THREE.MathUtils.clamp(state.previewPitch + dy * 0.004, -0.65, 0.45);
  };

  const endDrag = (event) => {
    if (state.previewPointerId !== null && event.pointerId !== state.previewPointerId) return;
    state.previewDragging = false;
    state.previewPointerId = null;
  };

  refs.customizePreviewEl.addEventListener('pointerdown', startDrag);
  refs.customizePreviewEl.addEventListener('pointermove', moveDrag);
  refs.customizePreviewEl.addEventListener('pointerup', endDrag);
  refs.customizePreviewEl.addEventListener('pointercancel', endDrag);
  refs.customizePreviewEl.addEventListener('pointerleave', endDrag);
  refs.customizePreviewEl.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      state.previewAutoSpin = false;
      state.previewDistance = THREE.MathUtils.clamp(state.previewDistance + event.deltaY * 0.01, 4.2, 9.2);
    },
    { passive: false }
  );
}

export function updatePreviewAvatar() {
  ensurePreviewScene();
  if (state.previewAvatar) {
    state.previewScene.remove(state.previewAvatar);
  }
  state.previewAvatar = makePreviewMesh(currentFormAppearance());
  state.previewScene.add(state.previewAvatar);
}

export function renderPreview() {
  if (!state.previewRenderer || !state.previewScene || !state.previewAvatar || refs.customizeModalEl.classList.contains('hidden')) return;
  const width = Math.max(220, refs.customizePreviewEl.clientWidth || refs.customizePreviewEl.width);
  const height = Math.max(220, refs.customizePreviewEl.clientHeight || refs.customizePreviewEl.height);
  if (width !== state.previewRenderWidth || height !== state.previewRenderHeight) {
    state.previewRenderWidth = width;
    state.previewRenderHeight = height;
    state.previewRenderer.setSize(width, height, false);
    state.previewCamera.aspect = width / height;
    state.previewCamera.updateProjectionMatrix();
  }
  state.previewCamera.position.set(0, 2.5, state.previewDistance);
  state.previewCamera.lookAt(0, 1.55 + Math.sin(state.previewPitch) * 0.55, 0);
  if (state.previewAutoSpin && !state.previewDragging) {
    state.previewYaw += 0.012;
  }
  state.previewAvatar.rotation.y = state.previewYaw;
  state.previewRenderer.render(state.previewScene, state.previewCamera);
}

export function outfitStorageKey(slot) {
  return `island_outfit_slot_${slot}`;
}

export function saveOutfit(slot) {
  const appearance = currentFormAppearance();
  const name = refs.nameInputEl.value.trim().slice(0, 18);
  localStorage.setItem(
    outfitStorageKey(slot),
    JSON.stringify({
      name,
      appearance
    })
  );
  refs.customizeStatusEl.textContent = `Saved outfit slot ${slot}.`;
}

export function loadOutfit(slot) {
  const raw = localStorage.getItem(outfitStorageKey(slot));
  if (!raw) {
    refs.customizeStatusEl.textContent = `No outfit in slot ${slot}.`;
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const appearance = normalizeAppearance(parsed.appearance, currentFormAppearance());
    if (parsed.name) refs.nameInputEl.value = String(parsed.name).slice(0, 18);
    refs.skinInputEl.value = appearance.skin;
    refs.colorInputEl.value = appearance.shirt;
    refs.pantsColorInputEl.value = appearance.pants;
    refs.shoesColorInputEl.value = appearance.shoes;
    refs.hairStyleInputEl.value = appearance.hairStyle;
    refs.hairColorInputEl.value = appearance.hairColor;
    refs.faceStyleInputEl.value = appearance.faceStyle;
    refs.selectedAccessories.clear();
    (appearance.accessories || []).forEach((item) => refs.selectedAccessories.add(item));
    refreshItemCards();
    updatePreviewAvatar();
    refs.customizeStatusEl.textContent = `Loaded outfit slot ${slot}.`;
  } catch {
    refs.customizeStatusEl.textContent = `Outfit slot ${slot} is invalid.`;
  }
}
