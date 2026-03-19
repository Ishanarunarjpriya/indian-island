const ROOT_ID = 'arena-ui-root';

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function formatSeconds(ms) {
  return Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
}

function formatLoot(loot) {
  const entries = Object.entries(loot || {}).filter(([, amount]) => Number(amount) > 0);
  if (!entries.length) return 'None';
  return entries.map(([itemId, amount]) => `${itemId} x${amount}`).join(', ');
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function ensureRoot() {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;
  root = el('div');
  root.id = ROOT_ID;
  root.style.position = 'fixed';
  root.style.left = '16px';
  root.style.bottom = '16px';
  root.style.width = '360px';
  root.style.maxWidth = 'calc(100vw - 32px)';
  root.style.background = 'rgba(10, 20, 38, 0.86)';
  root.style.border = '1px solid rgba(120, 190, 255, 0.35)';
  root.style.borderRadius = '14px';
  root.style.padding = '12px';
  root.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  root.style.color = '#eaf6ff';
  root.style.backdropFilter = 'blur(8px)';
  root.style.zIndex = '1200';
  root.style.pointerEvents = 'auto';
  document.body.appendChild(root);
  return root;
}

export function createArenaUI(callbacks) {
  const root = ensureRoot();
  clearChildren(root);

  const title = el('div', '', 'PvP Gateway');
  title.style.fontSize = '20px';
  title.style.fontWeight = '700';
  title.style.marginBottom = '8px';
  root.appendChild(title);

  const hint = el('div', '', 'Walk to the PvP island teleporter and press E.');
  hint.style.opacity = '0.85';
  hint.style.marginBottom = '10px';
  root.appendChild(hint);

  const prompt = el('div', '', '');
  prompt.style.marginBottom = '8px';
  prompt.style.fontWeight = '600';
  root.appendChild(prompt);

  const actions = el('div');
  actions.style.display = 'grid';
  actions.style.gridTemplateColumns = '1fr 1fr';
  actions.style.gap = '8px';
  root.appendChild(actions);

  const enterHubBtn = el('button', '', 'Enter Queue Hub');
  enterHubBtn.type = 'button';
  enterHubBtn.style.padding = '8px 10px';
  enterHubBtn.style.borderRadius = '9px';
  enterHubBtn.style.border = '1px solid rgba(130, 190, 255, 0.45)';
  enterHubBtn.style.background = 'linear-gradient(180deg, #2f6fa1, #204e73)';
  enterHubBtn.style.color = '#eff8ff';
  enterHubBtn.style.fontWeight = '700';
  enterHubBtn.addEventListener('click', () => callbacks.onEnterQueueHub());
  actions.appendChild(enterHubBtn);

  const leavePadBtn = el('button', '', 'Leave Queue');
  leavePadBtn.type = 'button';
  leavePadBtn.style.padding = '8px 10px';
  leavePadBtn.style.borderRadius = '9px';
  leavePadBtn.style.border = '1px solid rgba(180, 200, 230, 0.35)';
  leavePadBtn.style.background = 'linear-gradient(180deg, #2a3b56, #1c2635)';
  leavePadBtn.style.color = '#e0edff';
  leavePadBtn.style.fontWeight = '700';
  leavePadBtn.addEventListener('click', () => callbacks.onLeaveQueuePad());
  actions.appendChild(leavePadBtn);

  const queuePanel = el('div');
  queuePanel.style.marginTop = '10px';
  queuePanel.style.paddingTop = '8px';
  queuePanel.style.borderTop = '1px solid rgba(110, 160, 220, 0.25)';
  root.appendChild(queuePanel);

  const queueTitle = el('div', '', 'Queue Pads');
  queueTitle.style.fontWeight = '700';
  queueTitle.style.marginBottom = '6px';
  queuePanel.appendChild(queueTitle);

  const queueList = el('div');
  queueList.style.display = 'grid';
  queueList.style.gridTemplateColumns = '1fr';
  queueList.style.gap = '6px';
  queuePanel.appendChild(queueList);

  const decisionPanel = el('div');
  decisionPanel.style.display = 'none';
  decisionPanel.style.marginTop = '10px';
  decisionPanel.style.paddingTop = '8px';
  decisionPanel.style.borderTop = '1px solid rgba(110, 160, 220, 0.25)';
  root.appendChild(decisionPanel);

  const decisionText = el('div', '', 'Round complete. Cash out or continue?');
  decisionText.style.fontWeight = '700';
  decisionText.style.marginBottom = '6px';
  decisionPanel.appendChild(decisionText);

  const decisionActions = el('div');
  decisionActions.style.display = 'grid';
  decisionActions.style.gridTemplateColumns = '1fr 1fr';
  decisionActions.style.gap = '6px';
  decisionPanel.appendChild(decisionActions);

  const cashoutBtn = el('button', '', 'Cash Out');
  cashoutBtn.type = 'button';
  cashoutBtn.style.padding = '8px 10px';
  cashoutBtn.style.borderRadius = '9px';
  cashoutBtn.style.border = '1px solid rgba(130, 220, 160, 0.55)';
  cashoutBtn.style.background = 'linear-gradient(180deg, #2f7c4c, #215436)';
  cashoutBtn.style.color = '#ecffef';
  cashoutBtn.style.fontWeight = '700';
  cashoutBtn.addEventListener('click', () => callbacks.onDecision('cashout'));
  decisionActions.appendChild(cashoutBtn);

  const continueBtn = el('button', '', 'Continue');
  continueBtn.type = 'button';
  continueBtn.style.padding = '8px 10px';
  continueBtn.style.borderRadius = '9px';
  continueBtn.style.border = '1px solid rgba(130, 190, 255, 0.45)';
  continueBtn.style.background = 'linear-gradient(180deg, #2f6fa1, #204e73)';
  continueBtn.style.color = '#eff8ff';
  continueBtn.style.fontWeight = '700';
  continueBtn.addEventListener('click', () => callbacks.onDecision('continue'));
  decisionActions.appendChild(continueBtn);

  const matchStats = el('div');
  matchStats.style.marginTop = '10px';
  matchStats.style.paddingTop = '8px';
  matchStats.style.borderTop = '1px solid rgba(110, 160, 220, 0.25)';
  root.appendChild(matchStats);

  const matchText = el('div', '', 'No active match.');
  matchStats.appendChild(matchText);

  const profilePanel = el('div');
  profilePanel.style.marginTop = '10px';
  profilePanel.style.paddingTop = '8px';
  profilePanel.style.borderTop = '1px solid rgba(110, 160, 220, 0.25)';
  root.appendChild(profilePanel);

  const profileTitle = el('div', '', 'PvP Shop (tokens only)');
  profileTitle.style.fontWeight = '700';
  profileTitle.style.marginBottom = '6px';
  profilePanel.appendChild(profileTitle);

  const profileInfo = el('div', '', 'Tokens: 0');
  profileInfo.style.opacity = '0.9';
  profileInfo.style.marginBottom = '8px';
  profilePanel.appendChild(profileInfo);

  const shopList = el('div');
  shopList.style.display = 'grid';
  shopList.style.gridTemplateColumns = '1fr';
  shopList.style.gap = '6px';
  profilePanel.appendChild(shopList);

  const message = el('div', '', '');
  message.style.marginTop = '10px';
  message.style.opacity = '0.86';
  root.appendChild(message);

  function renderQueueLanes(queueHubState) {
    clearChildren(queueList);
    const lanes = Array.isArray(queueHubState?.lanes) ? queueHubState.lanes : [];
    if (!lanes.length) {
      const empty = el('div', '', 'No queue pads loaded.');
      empty.style.opacity = '0.75';
      queueList.appendChild(empty);
      return;
    }
    for (let i = 0; i < lanes.length; i += 1) {
      const lane = lanes[i];
      const row = el('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1fr auto';
      row.style.alignItems = 'center';
      row.style.gap = '6px';
      row.style.padding = '7px 8px';
      row.style.borderRadius = '8px';
      row.style.border = '1px solid rgba(130, 180, 235, 0.25)';
      row.style.background = 'rgba(8, 23, 46, 0.46)';

      const left = el('div');
      const count = `${lane.occupancy || 0}/${lane.capacity || 0}`;
      const seconds = formatSeconds(lane.countdownMs);
      left.textContent = `${lane.label || lane.id} (${count}) - ${seconds}s`;
      row.appendChild(left);

      const joinBtn = el('button', '', 'Join');
      joinBtn.type = 'button';
      joinBtn.style.padding = '5px 8px';
      joinBtn.style.borderRadius = '7px';
      joinBtn.style.border = '1px solid rgba(138, 194, 255, 0.4)';
      joinBtn.style.background = 'linear-gradient(180deg, #2b638e, #1d445f)';
      joinBtn.style.color = '#e9f5ff';
      joinBtn.style.fontWeight = '700';
      joinBtn.disabled = Number(lane.occupancy) >= Number(lane.capacity);
      joinBtn.addEventListener('click', () => callbacks.onJoinQueuePad(lane.id));
      row.appendChild(joinBtn);

      queueList.appendChild(row);
    }
  }

  function renderProfile(profile) {
    const tokens = Number(profile?.tokens) || 0;
    profileInfo.textContent = `Tokens: ${tokens}`;
    clearChildren(shopList);
    const shopItems = Array.isArray(profile?.shopInventory) ? profile.shopInventory : [];
    if (!shopItems.length) {
      const none = el('div', '', 'Shop unavailable.');
      none.style.opacity = '0.7';
      shopList.appendChild(none);
      return;
    }

    for (let i = 0; i < shopItems.length; i += 1) {
      const item = shopItems[i];
      const row = el('div');
      row.style.padding = '7px 8px';
      row.style.borderRadius = '8px';
      row.style.border = '1px solid rgba(120, 170, 230, 0.22)';
      row.style.background = 'rgba(8, 19, 40, 0.5)';

      const name = el('div', '', `${item.icon || ''} ${item.name || item.id}`.trim());
      name.style.fontWeight = '700';
      row.appendChild(name);

      const meta = el(
        'div',
        '',
        `${item.category} | buy ${Number(item.tokenCost) || 0} | upgrade Lv ${Number(item.upgradeLevel) || 0}/${Number(item.maxUpgradeLevel) || 0}`,
      );
      meta.style.opacity = '0.85';
      meta.style.fontSize = '12px';
      row.appendChild(meta);

      const actions = el('div');
      actions.style.marginTop = '6px';
      actions.style.display = 'grid';
      actions.style.gridTemplateColumns = '1fr 1fr';
      actions.style.gap = '6px';
      row.appendChild(actions);

      const buyBtn = el('button', '', item.owned ? 'Owned' : `Buy (${Number(item.tokenCost) || 0})`);
      buyBtn.type = 'button';
      buyBtn.style.padding = '5px 8px';
      buyBtn.style.borderRadius = '7px';
      buyBtn.style.border = '1px solid rgba(120, 180, 240, 0.35)';
      buyBtn.style.background = item.owned
        ? 'linear-gradient(180deg, #4a586a, #2f3b48)'
        : 'linear-gradient(180deg, #2c6792, #1b415c)';
      buyBtn.style.color = '#e9f6ff';
      buyBtn.style.fontWeight = '700';
      buyBtn.disabled = !!item.owned;
      buyBtn.addEventListener('click', () => callbacks.onBuyItem(item.id));
      actions.appendChild(buyBtn);

      const nextUpgradeCost = Number(item.nextUpgradeCost);
      const canUpgrade = Number.isFinite(nextUpgradeCost) && nextUpgradeCost > 0 && !!item.owned;
      const upLabel = canUpgrade ? `Upgrade (${nextUpgradeCost})` : 'Upgrade Max';
      const upBtn = el('button', '', upLabel);
      upBtn.type = 'button';
      upBtn.style.padding = '5px 8px';
      upBtn.style.borderRadius = '7px';
      upBtn.style.border = '1px solid rgba(150, 200, 255, 0.35)';
      upBtn.style.background = canUpgrade
        ? 'linear-gradient(180deg, #396e90, #204059)'
        : 'linear-gradient(180deg, #4a586a, #2f3b48)';
      upBtn.style.color = '#e9f6ff';
      upBtn.style.fontWeight = '700';
      upBtn.disabled = !canUpgrade;
      upBtn.addEventListener('click', () => callbacks.onUpgradeItem(item.id));
      actions.appendChild(upBtn);

      shopList.appendChild(row);
    }
  }

  let nearGateway = false;
  let nearQueueHub = false;

  function refreshPrompt() {
    if (nearGateway) {
      prompt.textContent = 'Press E to enter the PvP queue hub.';
      return;
    }
    if (nearQueueHub) {
      prompt.textContent = 'Queue hub active: join Solo/Duo/Trio/Squad pads.';
      return;
    }
    prompt.textContent = 'Walk to the PvP mini island teleporter.';
  }

  return {
    renderQueueHubState(queueHubState) {
      renderQueueLanes(queueHubState);
    },
    renderProfile(profile) {
      renderProfile(profile);
    },
    renderMatch(match) {
      if (!match) {
        decisionPanel.style.display = 'none';
        matchText.textContent = 'No active match.';
        return;
      }

      const me = (Array.isArray(match.players) ? match.players : []).find((entry) => entry.socketId === callbacks.getSocketId());
      const unclaimedTokens = Number(me?.unclaimedTokens) || 0;
      const lootText = formatLoot(me?.unclaimedLoot || {});
      matchText.textContent = `Round ${match.round || 0} | phase: ${match.phase || 'combat'} | enemies ${match.enemiesRemaining || 0} | unclaimed ${unclaimedTokens} | loot ${lootText}`;

      if (match.phase === 'intermission') {
        const seconds = formatSeconds(match.intermissionSeconds ? match.intermissionSeconds * 1000 : match.intermissionEndsAt - Date.now());
        const votes = match.voteCounts || { cashout: 0, continue: 0, required: 1 };
        decisionText.textContent = `Intermission ${seconds}s - cashout ${votes.cashout}/${votes.required}, continue ${votes.continue}/${votes.required}`;
        decisionPanel.style.display = 'block';
      } else {
        decisionPanel.style.display = 'none';
      }
    },
    setNearGateway(value) {
      nearGateway = !!value;
      refreshPrompt();
    },
    setNearQueueHub(value) {
      nearQueueHub = !!value;
      refreshPrompt();
    },
    setMessage(text) {
      message.textContent = text || '';
    },
    destroy() {
      root.remove();
    },
  };
}
