import { ARENA_CLIENT_CONFIG } from './config.js';

function formatDuration(ms) {
  const total = Math.max(0, Math.ceil((ms || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes + ':' + String(seconds).padStart(2, '0');
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text != null) {
    element.textContent = text;
  }
  return element;
}

function ensureStyles() {
  if (document.getElementById('arena-ui-styles')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'arena-ui-styles';
  style.textContent = `
    #arena-root { position: fixed; inset: 0; pointer-events: none; z-index: 48; font-family: system-ui, sans-serif; color: #f3f7ff; }
    .arena-panel { background: ${ARENA_CLIENT_CONFIG.ui.panel}; border: 1px solid ${ARENA_CLIENT_CONFIG.ui.border}; border-radius: 20px; box-shadow: 0 24px 80px rgba(0,0,0,0.35); backdrop-filter: blur(12px); }
    #arena-prompt { position: fixed; bottom: 146px; left: 50%; transform: translateX(-50%); padding: 14px 20px; font-weight: 700; display: none; }
    #arena-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(960px, calc(100vw - 32px)); max-height: min(82vh, 760px); overflow: hidden; display: none; }
    #arena-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 22px 24px 0; }
    #arena-modal-body { display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; padding: 18px 24px 24px; }
    #arena-actions, #arena-shop, #arena-loadout, #arena-match-hud, #arena-hotbar { pointer-events: auto; }
    .arena-card { background: rgba(18, 27, 43, 0.8); border: 1px solid rgba(123,181,255,0.16); border-radius: 18px; padding: 18px; }
    .arena-actions-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .arena-button { width: 100%; border: 0; border-radius: 14px; padding: 14px 16px; font-weight: 800; cursor: pointer; color: #04111d; background: linear-gradient(135deg, #ffd166, #ff9b64); }
    .arena-button.secondary { background: linear-gradient(135deg, #73d3ff, #6ef3d6); }
    .arena-button.ghost { background: rgba(255,255,255,0.08); color: #eff6ff; }
    .arena-item-grid { display: grid; gap: 12px; max-height: 46vh; overflow: auto; padding-right: 4px; }
    .arena-item-card { border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); padding: 14px; background: rgba(9, 14, 24, 0.7); display: grid; gap: 8px; }
    .arena-item-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .arena-item-name { font-weight: 800; }
    .arena-item-meta { font-size: 12px; opacity: 0.8; }
    .arena-item-actions { display: flex; gap: 8px; }
    .arena-pill { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 800; background: rgba(255,255,255,0.08); }
    #arena-hud { position: fixed; top: 92px; left: 50%; transform: translateX(-50%); width: min(760px, calc(100vw - 40px)); display: grid; gap: 12px; }
    #arena-match-hud { display: none; padding: 16px 18px; }
    .arena-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .arena-stat { padding: 12px; border-radius: 16px; background: rgba(255,255,255,0.05); }
    .arena-stat-label { font-size: 12px; opacity: 0.75; }
    .arena-stat-value { font-size: 24px; font-weight: 800; }
    #arena-intermission { display: none; margin-top: 12px; gap: 10px; }
    #arena-hotbar { position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; }
    .arena-slot { width: 84px; min-height: 84px; border-radius: 18px; padding: 10px; display: grid; align-content: space-between; background: rgba(10, 15, 28, 0.82); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 16px 36px rgba(0,0,0,0.28); }
    .arena-slot.active { border-color: rgba(255,173,92,0.9); box-shadow: 0 0 0 2px rgba(255,173,92,0.25), 0 16px 36px rgba(0,0,0,0.28); }
    .arena-slot-key { font-size: 12px; opacity: 0.6; }
    .arena-slot-name { font-size: 13px; font-weight: 700; }
    .arena-slot-icon { font-size: 22px; }
    .arena-hidden { display: none !important; }
    @media (max-width: 880px) {
      #arena-modal-body { grid-template-columns: 1fr; }
      .arena-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      #arena-hotbar { gap: 8px; }
      .arena-slot { width: 70px; min-height: 76px; }
    }
  `;
  document.head.appendChild(style);
}

export function createArenaUI() {
  ensureStyles();
  const root = createElement('div');
  root.id = 'arena-root';

  const prompt = createElement('div', 'arena-panel');
  prompt.id = 'arena-prompt';
  root.appendChild(prompt);

  const modal = createElement('div', 'arena-panel');
  modal.id = 'arena-modal';
  modal.innerHTML = `
    <div id="arena-modal-header">
      <div>
        <div style="font-size:30px;font-weight:900;">Arena Lobby</div>
        <div id="arena-modal-subtitle" style="opacity:.72;margin-top:4px;">Queue up, buy gear, and manage your hotbar.</div>
      </div>
      <button id="arena-close" class="arena-button ghost" style="width:auto;padding:12px 14px;">Close</button>
    </div>
    <div id="arena-modal-body">
      <div class="arena-card" id="arena-actions">
        <div style="font-size:22px;font-weight:900;margin-bottom:8px;">Play</div>
        <div class="arena-actions-grid">
          <button id="arena-play-solo" class="arena-button">Play Solo</button>
          <button id="arena-play-coop" class="arena-button secondary">Play Co-op</button>
          <button id="arena-open-shop" class="arena-button ghost">Shop</button>
          <button id="arena-open-loadout" class="arena-button ghost">Loadout</button>
        </div>
        <div id="arena-queue-info" style="margin-top:16px;line-height:1.5;opacity:.82;">No players in queue.</div>
      </div>
      <div class="arena-card" id="arena-right-column">
        <div id="arena-balance" style="font-size:18px;font-weight:900;margin-bottom:12px;">PvP Tokens: 0</div>
        <div id="arena-shop" class="arena-hidden">
          <div style="font-size:20px;font-weight:900;margin-bottom:10px;">Shop</div>
          <div id="arena-shop-grid" class="arena-item-grid"></div>
        </div>
        <div id="arena-loadout" class="arena-hidden">
          <div style="font-size:20px;font-weight:900;margin-bottom:10px;">Loadout</div>
          <div id="arena-loadout-grid" class="arena-item-grid"></div>
        </div>
        <div id="arena-overview">
          <div style="font-size:20px;font-weight:900;margin-bottom:10px;">Run Rules</div>
          <div style="line-height:1.7;opacity:.82;">Fight endless waves, bank PvP Tokens, and risk unbanked loot if the team wipes. Bosses spawn every 5 waves.</div>
        </div>
      </div>
    </div>
  `;
  root.appendChild(modal);

  const hud = createElement('div');
  hud.id = 'arena-hud';
  const matchHud = createElement('div', 'arena-panel');
  matchHud.id = 'arena-match-hud';
  matchHud.innerHTML = `
    <div class="arena-stats">
      <div class="arena-stat"><div class="arena-stat-label">Wave</div><div id="arena-wave" class="arena-stat-value">1</div></div>
      <div class="arena-stat"><div class="arena-stat-label">Enemies</div><div id="arena-enemies" class="arena-stat-value">0</div></div>
      <div class="arena-stat"><div class="arena-stat-label">Health</div><div id="arena-health" class="arena-stat-value">120</div></div>
      <div class="arena-stat"><div class="arena-stat-label">Pending Tokens</div><div id="arena-pending" class="arena-stat-value">0</div></div>
    </div>
    <div id="arena-match-message" style="margin-top:12px;font-weight:700;opacity:.85;">Use number keys to swap gear.</div>
    <div id="arena-intermission" style="display:none;grid-template-columns:repeat(2,minmax(0,1fr));">
      <button id="arena-cashout" class="arena-button">Cash Out</button>
      <button id="arena-continue" class="arena-button secondary">Continue</button>
    </div>
  `;
  hud.appendChild(matchHud);
  root.appendChild(hud);

  const hotbar = createElement('div');
  hotbar.id = 'arena-hotbar';
  root.appendChild(hotbar);

  document.body.appendChild(root);

  const refs = {
    root,
    prompt,
    modal,
    subtitle: modal.querySelector('#arena-modal-subtitle'),
    queueInfo: modal.querySelector('#arena-queue-info'),
    balance: modal.querySelector('#arena-balance'),
    close: modal.querySelector('#arena-close'),
    playSolo: modal.querySelector('#arena-play-solo'),
    playCoop: modal.querySelector('#arena-play-coop'),
    openShop: modal.querySelector('#arena-open-shop'),
    openLoadout: modal.querySelector('#arena-open-loadout'),
    shop: modal.querySelector('#arena-shop'),
    loadout: modal.querySelector('#arena-loadout'),
    overview: modal.querySelector('#arena-overview'),
    shopGrid: modal.querySelector('#arena-shop-grid'),
    loadoutGrid: modal.querySelector('#arena-loadout-grid'),
    matchHud,
    wave: matchHud.querySelector('#arena-wave'),
    enemies: matchHud.querySelector('#arena-enemies'),
    health: matchHud.querySelector('#arena-health'),
    pending: matchHud.querySelector('#arena-pending'),
    message: matchHud.querySelector('#arena-match-message'),
    intermission: matchHud.querySelector('#arena-intermission'),
    cashout: matchHud.querySelector('#arena-cashout'),
    continueRun: matchHud.querySelector('#arena-continue'),
    hotbar,
  };

  function setPrompt(text, visible) {
    refs.prompt.textContent = text || '';
    refs.prompt.style.display = visible ? 'block' : 'none';
  }

  function setModalVisible(visible) {
    refs.modal.style.display = visible ? 'block' : 'none';
  }

  function showPanel(panel) {
    refs.shop.classList.toggle('arena-hidden', panel !== 'shop');
    refs.loadout.classList.toggle('arena-hidden', panel !== 'loadout');
    refs.overview.classList.toggle('arena-hidden', panel !== 'overview');
  }

  function renderShop(profile, onBuy) {
    refs.shopGrid.replaceChildren();
    const items = Array.isArray(profile?.catalog) ? profile.catalog.filter((item) => item.shop) : [];
    items.forEach((item) => {
      const card = createElement('div', 'arena-item-card');
      card.innerHTML = `
        <div class="arena-item-top">
          <div>
            <div class="arena-item-name">${item.icon || '•'} ${item.name}</div>
            <div class="arena-item-meta">${item.category.toUpperCase()} • ${item.rarity.toUpperCase()}</div>
          </div>
          <div class="arena-pill">${item.price} Tokens</div>
        </div>
        <div class="arena-item-meta">${item.description}</div>
      `;
      const actions = createElement('div', 'arena-item-actions');
      const buy = createElement('button', 'arena-button ghost', profile?.ownedItems?.includes(item.id) ? 'Owned' : 'Buy');
      buy.disabled = profile?.ownedItems?.includes(item.id);
      buy.addEventListener('click', () => onBuy(item.id));
      actions.appendChild(buy);
      card.appendChild(actions);
      refs.shopGrid.appendChild(card);
    });
  }

  function renderLoadout(profile, onEquip) {
    refs.loadoutGrid.replaceChildren();
    const hotbar = Array.isArray(profile?.hotbar) ? profile.hotbar : Array.from({ length: ARENA_CLIENT_CONFIG.hotbarSlots }, () => null);
    hotbar.forEach((itemId, index) => {
      const row = createElement('div', 'arena-item-card');
      const title = createElement('div', 'arena-item-top');
      title.innerHTML = `<div class="arena-item-name">Slot ${index + 1}</div><div class="arena-pill">${itemId || 'Empty'}</div>`;
      row.appendChild(title);
      const select = document.createElement('select');
      select.style.padding = '10px';
      select.style.borderRadius = '12px';
      select.style.background = 'rgba(255,255,255,0.08)';
      select.style.color = '#f5f8ff';
      const none = document.createElement('option');
      none.value = '';
      none.textContent = 'Empty';
      select.appendChild(none);
      (profile?.ownedItems || []).forEach((ownedId) => {
        const option = document.createElement('option');
        option.value = ownedId;
        option.textContent = ownedId;
        option.selected = ownedId === itemId;
        select.appendChild(option);
      });
      select.addEventListener('change', () => onEquip(index, select.value || null));
      row.appendChild(select);
      refs.loadoutGrid.appendChild(row);
    });
  }

  function renderHotbar(profile, matchState) {
    refs.hotbar.replaceChildren();
    const hotbar = Array.isArray(matchState?.self?.hotbar) ? matchState.self.hotbar : Array.isArray(profile?.hotbar) ? profile.hotbar : [];
    const selectedSlot = matchState?.self?.selectedSlot ?? profile?.selectedSlot ?? 0;
    hotbar.forEach((itemId, index) => {
      const item = (profile?.catalog || []).find((entry) => entry.id === itemId);
      const slot = createElement('div', 'arena-slot' + (index === selectedSlot ? ' active' : ''));
      slot.innerHTML = `
        <div class="arena-slot-key">${index + 1}</div>
        <div class="arena-slot-icon">${item?.icon || '·'}</div>
        <div class="arena-slot-name">${item?.name || 'Empty'}</div>
      `;
      refs.hotbar.appendChild(slot);
    });
    refs.hotbar.style.display = hotbar.length ? 'flex' : 'none';
  }

  function renderQueue(queue) {
    if (!queue || !Array.isArray(queue.entries) || !queue.entries.length) {
      refs.queueInfo.textContent = 'No players in queue.';
      return;
    }
    const remaining = queue.timerEndsAt ? Math.max(0, queue.timerEndsAt - Date.now()) : 0;
    refs.queueInfo.textContent = `${queue.entries.length} queued • Starts in ${formatDuration(remaining)} • ${queue.entries.map((entry) => entry.displayName).join(', ')}`;
  }

  function renderProfile(profile) {
    refs.balance.textContent = 'PvP Tokens: ' + (profile?.tokens || 0);
  }

  function renderMatch(matchState) {
    const active = !!matchState;
    refs.matchHud.style.display = active ? 'block' : 'none';
    if (!active) {
      refs.intermission.style.display = 'none';
      return;
    }
    refs.wave.textContent = String(matchState.wave || 0);
    refs.enemies.textContent = String(matchState.enemiesRemaining || 0);
    refs.health.textContent = `${matchState.self?.hp || 0} / ${matchState.self?.maxHp || 0}`;
    refs.pending.textContent = String(matchState.self?.pendingTokens || 0);
    const intermissionActive = matchState.status === 'intermission';
    refs.intermission.style.display = intermissionActive ? 'grid' : 'none';
    refs.message.textContent = intermissionActive
      ? 'Intermission: vote to cash out or keep the run alive.'
      : matchState.self?.spectating
        ? 'You are spectating. Stay with the team until the round ends.'
        : 'Use 1-9 to swap gear and left click to attack.';
  }

  return {
    refs,
    setPrompt,
    setModalVisible,
    showPanel,
    renderQueue,
    renderProfile,
    renderShop,
    renderLoadout,
    renderHotbar,
    renderMatch,
  };
}
