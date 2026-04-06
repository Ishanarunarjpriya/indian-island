export function initTradingUI() {
  const modal = document.getElementById('trading-modal');
  const closeBtn = document.getElementById('trading-close');
  const tabButtons = modal.querySelectorAll('.trading-tab-btn');
  const tabContents = modal.querySelectorAll('.trading-tab-content');

  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.add('hidden'));
      btn.classList.add('active');
      modal.querySelector(`.trading-tab-content[data-tab="${tabName}"]`).classList.remove('hidden');
    });
  });
}

export function openTradingModal() {
  const modal = document.getElementById('trading-modal');
  modal.classList.remove('hidden');
}

export function closeTradingModal() {
  const modal = document.getElementById('trading-modal');
  modal.classList.add('hidden');
}

export function updateTradesList(trades, currentPlayerId) {
  const list = document.getElementById('trades-list');
  list.innerHTML = '';

  if (trades.length === 0) {
    list.innerHTML = '<p class="empty-state">No pending trades</p>';
    return;
  }

  trades.forEach(trade => {
    const isInitiator = trade.initiator_id === currentPlayerId;
    const otherPlayer = isInitiator ? trade.receiver_id : trade.initiator_id;
    const myItems = isInitiator ? trade.initiator_items : trade.receiver_items;
    const theirItems = isInitiator ? trade.receiver_items : trade.initiator_items;

    const element = document.createElement('div');
    element.className = 'trade-item';
    element.innerHTML = `
      <div class="trade-header">
        <strong>${isInitiator ? 'Trade with' : 'Trade from'} ${otherPlayer}</strong>
        <span class="trade-status ${trade.status}">${trade.status}</span>
      </div>
      <div class="trade-content">
        <div class="trade-side">
          <h4>I'm offering:</h4>
          <div class="trade-items">${formatTradeItems(myItems)}</div>
        </div>
        <div class="trade-arrow">↔</div>
        <div class="trade-side">
          <h4>They're offering:</h4>
          <div class="trade-items">${formatTradeItems(theirItems)}</div>
        </div>
      </div>
      <div class="trade-actions">
        ${!isInitiator && trade.status === 'pending' ? `
          <button class="btn-accept" data-trade-id="${trade.id}">Accept</button>
          <button class="btn-reject" data-trade-id="${trade.id}">Reject</button>
        ` : ''}
        ${(isInitiator || !isInitiator) && trade.status === 'pending' ? `
          <button class="btn-cancel" data-trade-id="${trade.id}">Cancel</button>
        ` : ''}
      </div>
    `;
    list.appendChild(element);
  });
}

function formatTradeItems(items) {
  if (!items || items.length === 0) {
    return '<p class="no-items">No items</p>';
  }

  return items.map(item => `
    <div class="trade-item-entry">
      <span class="item-name">${item.name}</span>
      <span class="item-qty">x${item.quantity}</span>
    </div>
  `).join('');
}

export function updateTradeHistory(history) {
  const list = document.getElementById('trade-history-list');
  list.innerHTML = '';

  if (history.length === 0) {
    list.innerHTML = '<p class="empty-state">No completed trades</p>';
    return;
  }

  history.forEach(trade => {
    const element = document.createElement('div');
    element.className = 'trade-history-item';
    element.innerHTML = `
      <div class="trade-header">
        <strong>Trade with ${trade.player2_id}</strong>
        <span class="trade-date">${new Date(trade.created_at).toLocaleDateString()}</span>
      </div>
      <div class="trade-content">
        <div class="trade-side">
          <h4>You gave:</h4>
          <div class="trade-items">${formatTradeItems(trade.player1_items)}</div>
        </div>
        <div class="trade-arrow">→</div>
        <div class="trade-side">
          <h4>You received:</h4>
          <div class="trade-items">${formatTradeItems(trade.player2_items)}</div>
        </div>
      </div>
    `;
    list.appendChild(element);
  });
}

export function setupTradeEventListeners(socket, currentPlayerId) {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-accept')) {
      const tradeId = e.target.dataset.tradeId;
      socket.emit('trade:accept', { tradeId });
    }
    if (e.target.classList.contains('btn-reject')) {
      const tradeId = e.target.dataset.tradeId;
      socket.emit('trade:reject', { tradeId });
    }
    if (e.target.classList.contains('btn-cancel')) {
      const tradeId = e.target.dataset.tradeId;
      socket.emit('trade:cancel', { tradeId });
    }
  });
}
