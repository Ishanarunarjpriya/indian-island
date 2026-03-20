import { ARENA_CLIENT_CONFIG } from './config.js';
import { createArenaRenderer } from './render.js';
import { createArenaUI } from './ui.js';

function distance2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function normalize2D(x, z) {
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

export function initArenaClient(context) {
  const socket = context.socket;
  if (!socket) {
    return null;
  }

  // Use getter functions so we always get the live player/state references
  const getLocalPlayer = typeof context.getLocalPlayer === 'function'
    ? context.getLocalPlayer
    : () => context.localPlayer;
  const getLocalPlayerState = typeof context.getLocalPlayerState === 'function'
    ? context.getLocalPlayerState
    : () => context.localPlayerState;

  const state = {
    profile: null,
    queue: null,
    match: null,
    modalOpen: false,
    panel: 'overview',
    nearHub: false,
  };

  const renderer = createArenaRenderer({ scene: context.scene, world: ARENA_CLIENT_CONFIG.world });
  const ui = createArenaUI();

  function localPosition() {
    const player = getLocalPlayer();
    const playerState = getLocalPlayerState();
    return {
      x: Number(playerState?.x ?? player?.x ?? player?.mesh?.position?.x ?? 0),
      y: Number(playerState?.y ?? player?.y ?? player?.mesh?.position?.y ?? 0),
      z: Number(playerState?.z ?? player?.z ?? player?.mesh?.position?.z ?? 0),
    };
  }

  function teleportLocal(position) {
    if (!position) {
      return;
    }
    const player = getLocalPlayer();
    if (player?.mesh) {
      player.mesh.position.set(position.x, position.y, position.z);
    }
    if (player) {
      player.x = position.x;
      player.y = position.y;
      player.z = position.z;
    }
    const playerState = getLocalPlayerState();
    if (playerState) {
      playerState.x = position.x;
      playerState.y = position.y;
      playerState.z = position.z;
      playerState.rotation = position.rotation || 0;
    }
  }

  function syncRoomState() {
    const playerState = getLocalPlayerState();
    if (!playerState) {
      return;
    }
    if (state.match && state.match.roomId) {
      playerState.arenaState = { roomId: state.match.roomId };
      return;
    }
    playerState.arenaState = null;
  }

  function renderAll() {
    ui.renderProfile(state.profile);
    ui.renderQueue(state.queue);
    ui.renderMatch(state.match);
    ui.renderHotbar(state.profile, state.match);
    ui.renderShop(state.profile, (itemId) => socket.emit('arena:buyItem', itemId));
    ui.renderLoadout(state.profile, (slotIndex, itemId) => {
      if (!state.profile) {
        return;
      }
      const nextHotbar = Array.isArray(state.profile.hotbar) ? state.profile.hotbar.slice() : Array.from({ length: ARENA_CLIENT_CONFIG.hotbarSlots }, () => null);
      nextHotbar[slotIndex] = itemId;
      state.profile.hotbar = nextHotbar;
      ui.renderLoadout(state.profile, (index, nextItemId) => {
        const cloned = state.profile.hotbar.slice();
        cloned[index] = nextItemId;
        state.profile.hotbar = cloned;
        socket.emit('arena:setHotbar', cloned);
        renderAll();
      });
      socket.emit('arena:setHotbar', nextHotbar);
      renderAll();
    });
  }

  function openModal(panel) {
    state.modalOpen = true;
    state.panel = panel || state.panel;
    ui.setModalVisible(true);
    ui.showPanel(state.panel);
    renderAll();
  }

  function closeModal() {
    state.modalOpen = false;
    ui.setModalVisible(false);
  }

  function updatePrompt() {
    const pos = localPosition();
    const hub = ARENA_CLIENT_CONFIG.world.hubCenter;
    const dist = distance2D(pos.x, pos.z, hub.x, hub.z);
    state.nearHub = dist <= ARENA_CLIENT_CONFIG.world.interactRadius;
    const promptText = state.match
      ? ''
      : state.nearHub
        ? 'Press E to enter the PvP teleporter'
        : '';
    ui.setPrompt(promptText, !!promptText && !state.modalOpen);
  }

  function emitUseItem() {
    if (!state.match || !state.match.self?.alive) {
      return;
    }
    const camera = context.camera;
    const vector = window.THREE ? new window.THREE.Vector3(0, 0, -1) : { x: 0, y: 0, z: -1 };
    if (window.THREE && camera) {
      vector.applyQuaternion(camera.quaternion);
    }
    const direction = normalize2D(vector.x || 0, vector.z || -1);
    socket.emit('arena:useItem', { direction });
  }

  function requestSync() {
    socket.emit('arena:requestSync');
  }

  socket.on('arena:profile', (profile) => {
    state.profile = profile;
    renderAll();
  });
  socket.on('arena:queueState', (queue) => {
    state.queue = queue;
    renderAll();
  });
  socket.on('arena:state', (matchState) => {
    state.match = matchState;
    syncRoomState();
    renderer.updateState(matchState);
    renderAll();
  });
  socket.on('arena:matchEnded', () => {
    state.match = null;
    syncRoomState();
    renderAll();
  });
  socket.on('arena:returnToLobby', (position) => {
    state.match = null;
    syncRoomState();
    teleportLocal(position);
    renderer.updateState({ enemies: [], projectiles: [] });
    renderAll();
  });
  socket.on('connect', requestSync);
  setTimeout(requestSync, 1000);

  ui.refs.close.addEventListener('click', closeModal);
  ui.refs.closeSecondary.addEventListener('click', closeModal);
  ui.refs.joinQueue.addEventListener('click', () => {
    const queueEmpty = !state.queue || !Array.isArray(state.queue.entries) || !state.queue.entries.length;
    const targetSize = Math.max(2, Math.min(4, Number(ui.refs.targetSize?.value) || 4));
    socket.emit('arena:joinCoop', queueEmpty ? { targetSize } : {});
    openModal('overview');
  });
  ui.refs.openShop.addEventListener('click', () => openModal('shop'));
  ui.refs.openLoadout.addEventListener('click', () => openModal('loadout'));
  ui.refs.cashout.addEventListener('click', () => socket.emit('arena:decision', 'cashout'));
  ui.refs.continueRun.addEventListener('click', () => socket.emit('arena:decision', 'continue'));

  document.addEventListener('keydown', (event) => {
    if (event.repeat) {
      return;
    }
    if (/^[1-9]$/.test(event.key) && state.match) {
      event.preventDefault();
      event.stopImmediatePropagation();
      socket.emit('arena:selectSlot', Number(event.key) - 1);
      return;
    }
    if (event.key.toLowerCase() === 'e') {
      if (state.match?.status === 'intermission') {
        return;
      }
      if (!state.match && state.nearHub) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (state.modalOpen) {
          closeModal();
        } else {
          openModal('overview');
        }
      }
    }
    if (event.key === 'Escape' && state.modalOpen) {
      closeModal();
    }
  }, true);

  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }
    if (!state.match || state.modalOpen) {
      return;
    }
    event.stopImmediatePropagation();
    emitUseItem();
  }, true);

  setInterval(() => {
    updatePrompt();
    if (state.queue) {
      ui.renderQueue(state.queue);
    }
    if (state.match) {
      ui.renderMatch(state.match);
    }
  }, 250);
  renderAll();

  return {
    openModal,
    closeModal,
    requestSync,
  };
}
