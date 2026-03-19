import { initArenaClient } from './client.js';

function waitForContext() {
  const context = window.__indianIslandArenaContext;
  if (!context || !context.getScene || !context.getSocket) {
    requestAnimationFrame(waitForContext);
    return;
  }
  // Wait until the local player is available (i.e. user has logged in)
  if (!context.getLocalPlayer()) {
    requestAnimationFrame(waitForContext);
    return;
  }
  if (window.__arenaClientInstance) {
    return;
  }
  const instance = initArenaClient({
    scene: context.getScene(),
    camera: context.getCamera(),
    renderer: context.getRenderer(),
    socket: context.getSocket(),
    getLocalPlayer: context.getLocalPlayer,
    getLocalPlayerState: context.getLocalPlayerState,
  });
  window.__arenaClientInstance = instance;
}

waitForContext();
