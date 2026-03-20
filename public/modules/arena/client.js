import { ARENA_CLIENT_CONFIG } from './config.js';
import { createArenaUI } from './ui.js';
import { createArenaRenderer } from './render.js';

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function distanceXZ(a, b) {
  const dx = safeNumber(a?.x) - safeNumber(b?.x);
  const dz = safeNumber(a?.z) - safeNumber(b?.z);
  return Math.hypot(dx, dz);
}

function getPlayerPosition(context) {
  const state = typeof context.getLocalPlayerState === 'function' ? context.getLocalPlayerState() : null;
  if (state && Number.isFinite(Number(state.x)) && Number.isFinite(Number(state.z))) {
    return {
      x: Number(state.x),
      y: Number(state.y || 0),
      z: Number(state.z),
    };
  }
  const player = typeof context.getLocalPlayer === 'function' ? context.getLocalPlayer() : null;
  if (!player) return null;
  const source = player.position || player;
  if (!source || !Number.isFinite(Number(source.x)) || !Number.isFinite(Number(source.z))) return null;
  return {
    x: Number(source.x),
    y: Number(source.y || 0),
    z: Number(source.z),
  };
}

export function initArenaClient(context) {
  const socket = context?.socket;
  if (!socket) {
    return { destroy() {} };
  }

  const state = {
    profile: null,
    queue: null,
    match: null,
    nearGateway: false,
    nearQueueHub: false,
    nearbyPadId: null,
    lastMessage: '',
  };
  const arenaRenderer = createArenaRenderer({ scene: context?.scene });

  function teleportLocal(position) {
    if (!position) return;
    const x = Number(position.x);
    const y = Number(position.y);
    const z = Number(position.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;

    const localPlayer = typeof context.getLocalPlayer === 'function' ? context.getLocalPlayer() : null;
    if (localPlayer?.mesh?.position) {
      localPlayer.mesh.position.set(x, y, z);
    }
    if (localPlayer) {
      localPlayer.x = x;
      localPlayer.y = y;
      localPlayer.z = z;
    }
    const localState = typeof context.getLocalPlayerState === 'function' ? context.getLocalPlayerState() : null;
    if (localState) {
      localState.x = x;
      localState.y = y;
      localState.z = z;
    }
  }

  const ui = createArenaUI({
    getSocketId: () => socket.id,
    onEnterQueueHub: () => socket.emit('arena:enterQueueHub'),
    onJoinQueuePad: (padId) => socket.emit('arena:joinQueuePad', { padId }),
    onLeaveQueuePad: () => socket.emit('arena:leaveQueuePad'),
    onBuyItem: (itemId) => socket.emit('arena:buyItem', { itemId }),
    onUpgradeItem: (itemId) => socket.emit('arena:upgradeItem', { itemId }),
    onDecision: (decision) => socket.emit('arena:decision', decision),
  });

  function getNearbyPadId(pos) {
    const pads = Array.isArray(ARENA_CLIENT_CONFIG.queuePads) ? ARENA_CLIENT_CONFIG.queuePads : [];
    const padRadius = Number(ARENA_CLIENT_CONFIG.queuePadJoinRadius || 2.9);
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < pads.length; i += 1) {
      const pad = pads[i];
      const center = {
        x: Number(ARENA_CLIENT_CONFIG.queueHubCenter.x) + Number(pad?.offset?.x || 0),
        z: Number(ARENA_CLIENT_CONFIG.queueHubCenter.z) + Number(pad?.offset?.z || 0),
      };
      const dist = distanceXZ(pos, center);
      if (dist <= padRadius && dist < bestDist) {
        bestDist = dist;
        best = pad.id;
      }
    }
    return best;
  }

  function refreshUI() {
    const shouldShowArenaUi = Boolean(state.match);
    ui.setVisible(shouldShowArenaUi);
    ui.renderProfile(state.profile);
    ui.renderQueueHubState(state.queue);
    ui.renderMatch(state.match);
    ui.setNearGateway(state.nearGateway);
    ui.setNearQueueHub(state.nearQueueHub);
    ui.setMessage(state.lastMessage);
    arenaRenderer.updateState(state.match);
  }

  function onProfile(profile) {
    state.profile = profile || null;
    refreshUI();
  }

  function onQueue(queueState) {
    state.queue = queueState || null;
    refreshUI();
  }

  function onMatch(matchState) {
    state.match = matchState || null;
    refreshUI();
  }

  function onMessage(payload) {
    state.lastMessage = typeof payload?.message === 'string' ? payload.message : '';
    refreshUI();
  }

  function onMatchEnded(summary) {
    state.match = null;
    const outcome = summary?.outcome === 'cashout' ? 'Cashout complete.' : 'Run failed. Unclaimed rewards lost.';
    state.lastMessage = outcome;
    refreshUI();
  }

  function onReturnToLobby(payload) {
    teleportLocal(payload);
    if (payload?.mode === 'queue-hub') {
      state.nearQueueHub = true;
      state.nearGateway = false;
      state.lastMessage = 'Entered PvP queue hub.';
    } else if (payload?.mode === 'main-world') {
      state.lastMessage = 'Returned to main world.';
    } else if (payload?.mode === 'match') {
      state.lastMessage = 'PvP match started.';
    }
    refreshUI();
  }

  socket.on('arena:profile', onProfile);
  socket.on('arena:queueHubState', onQueue);
  socket.on('arena:queueState', onQueue);
  socket.on('arena:state', onMatch);
  socket.on('arena:message', onMessage);
  socket.on('arena:matchEnded', onMatchEnded);
  socket.on('arena:returnToLobby', onReturnToLobby);

  socket.emit('arena:requestSync');

  function handleKeydown(event) {
    if (!event || typeof event.key !== 'string') return;

    if (event.key.toLowerCase() === 'e') {
      if (state.match) return;
      if (state.nearGateway) {
        teleportLocal({
          x: ARENA_CLIENT_CONFIG.queueHubCenter.x,
          y: ARENA_CLIENT_CONFIG.queueHubCenter.y,
          z: ARENA_CLIENT_CONFIG.queueHubCenter.z,
        });
        state.nearGateway = false;
        state.nearQueueHub = true;
        state.lastMessage = 'Entering PvP queue hub...';
        socket.emit('arena:enterQueueHub');
        socket.emit('arena:requestSync');
        refreshUI();
        event.preventDefault();
        return;
      }
      if (state.nearQueueHub && state.nearbyPadId) {
        socket.emit('arena:joinQueuePad', { padId: state.nearbyPadId });
        state.lastMessage = `Joining ${state.nearbyPadId.toUpperCase()} queue...`;
        refreshUI();
        event.preventDefault();
      }
      return;
    }

    if (/^[1-9]$/.test(event.key)) {
      const slot = Number(event.key) - 1;
      socket.emit('arena:selectSlot', slot);
      event.preventDefault();
      return;
    }

    if (event.key.toLowerCase() === 'r') {
      socket.emit('arena:decision', 'continue');
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === 'c') {
      socket.emit('arena:decision', 'cashout');
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === 'q') {
      if (state.nearQueueHub && !state.match) {
        socket.emit('arena:leaveQueuePad');
        state.lastMessage = 'Left queue lane.';
        refreshUI();
        event.preventDefault();
      }
    }
  }

  function handlePointerDown(event) {
    if (!state.match || state.match.phase !== 'combat') return;
    const target = event?.target;
    if (target && typeof target.closest === 'function' && target.closest('#arena-ui-root')) return;
    socket.emit('arena:useItem', {});
  }

  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('pointerdown', handlePointerDown);

  const loopHandle = setInterval(() => {
    const pos = getPlayerPosition(context);
    if (!pos) return;

    const nearGateway = distanceXZ(pos, ARENA_CLIENT_CONFIG.gatewayCenter) <= Number(ARENA_CLIENT_CONFIG.gatewayInteractRadius || 4.2);
    const nearQueueHub = distanceXZ(pos, ARENA_CLIENT_CONFIG.queueHubCenter) <= Number(ARENA_CLIENT_CONFIG.queueHubInteractRadius || 28);
    const nearbyPadId = nearQueueHub ? getNearbyPadId(pos) : null;

    if (nearGateway !== state.nearGateway || nearQueueHub !== state.nearQueueHub || nearbyPadId !== state.nearbyPadId) {
      state.nearGateway = nearGateway;
      state.nearQueueHub = nearQueueHub;
      state.nearbyPadId = nearbyPadId;
      refreshUI();
    }
  }, 160);

  return {
    destroy() {
      clearInterval(loopHandle);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('pointerdown', handlePointerDown);
      socket.off('arena:profile', onProfile);
      socket.off('arena:queueHubState', onQueue);
      socket.off('arena:queueState', onQueue);
      socket.off('arena:state', onMatch);
      socket.off('arena:message', onMessage);
      socket.off('arena:matchEnded', onMatchEnded);
      socket.off('arena:returnToLobby', onReturnToLobby);
      arenaRenderer.dispose();
      ui.destroy();
    },
  };
}
