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
    lastMessage: '',
  };
  const arenaRenderer = createArenaRenderer({ scene: context?.scene });

  const ui = createArenaUI({
    getSocketId: () => socket.id,
    onEnterQueueHub: () => socket.emit('arena:enterQueueHub'),
    onJoinQueuePad: (padId) => socket.emit('arena:joinQueuePad', { padId }),
    onLeaveQueuePad: () => socket.emit('arena:leaveQueuePad'),
    onBuyItem: (itemId) => socket.emit('arena:buyItem', { itemId }),
    onUpgradeItem: (itemId) => socket.emit('arena:upgradeItem', { itemId }),
    onDecision: (decision) => socket.emit('arena:decision', decision),
  });

  function refreshUI() {
    const shouldShowArenaUi = Boolean(state.match) || state.nearGateway || state.nearQueueHub;
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

  socket.on('arena:profile', onProfile);
  socket.on('arena:queueHubState', onQueue);
  socket.on('arena:queueState', onQueue);
  socket.on('arena:state', onMatch);
  socket.on('arena:message', onMessage);
  socket.on('arena:matchEnded', onMatchEnded);

  socket.emit('arena:requestSync');

  function handleKeydown(event) {
    if (!event || typeof event.key !== 'string') return;

    if (event.key.toLowerCase() === 'e') {
      if (state.nearGateway) {
        socket.emit('arena:enterQueueHub');
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

    if (nearGateway !== state.nearGateway || nearQueueHub !== state.nearQueueHub) {
      state.nearGateway = nearGateway;
      state.nearQueueHub = nearQueueHub;
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
      arenaRenderer.dispose();
      ui.destroy();
    },
  };
}
