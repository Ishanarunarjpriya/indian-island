let refs = null;

export function initUiRenderers(refsRef = null) {
  refs = refsRef;
}

export function renderFishIndex() {
  if (!refs.fishIndexListEl) return;
  const discovered = refs.discoveredFishCount();
  if (refs.fishIndexSummaryEl) {
    refs.fishIndexSummaryEl.textContent = `Fish discovered: ${discovered} / ${refs.FISH_CATALOG_SORTED.length}`;
  }
  if (refs.marketFishIndexSummaryEl) {
    refs.marketFishIndexSummaryEl.textContent = `Fish discovered: ${discovered} / ${refs.FISH_CATALOG_SORTED.length}`;
  }
  refs.fishIndexListEl.innerHTML = '';
  refs.FISH_CATALOG_SORTED.forEach((fish) => {
    const count = refs.caughtFishCount(fish.id);
    const isDiscovered = count > 0;
    const entry = document.createElement('article');
    entry.className = `fish-entry${isDiscovered ? '' : ' locked'}`;
    const rarityLabel = refs.capitalizeWord(fish.rarity);
    entry.innerHTML = `
      <div class="icon-wrap">${refs.buildFishIconMarkup(fish, { compact: true, locked: !isDiscovered })}</div>
      <div class="meta">
        <div class="name">${isDiscovered ? fish.name : 'Unknown Fish'}</div>
        <div class="sub">${rarityLabel}${isDiscovered ? ` - ${fish.chanceLabel}` : ''}</div>
      </div>
      <div class="count">${isDiscovered ? `x${count}` : '---'}</div>
    `;
    refs.fishIndexListEl.appendChild(entry);
  });
}

export function renderFurnitureTraderModal() {
  const trader = refs.normalizeFurnitureTraderState(refs.questState.furnitureTrader);
  refs.questState.furnitureTrader = trader;
  refs.updateFurnitureTraderSummary();
  if (!refs.furnitureTraderListEl) return;
  refs.furnitureTraderListEl.innerHTML = '';
  for (const item of trader.items) {
    const card = document.createElement('article');
    card.className = 'market-section furniture-trader-card';

    const title = document.createElement('h3');
    title.textContent = item.label;

    const meta = document.createElement('div');
    meta.className = 'furniture-trader-card-meta';
    if (item.owned) {
      meta.textContent = 'Status: owned and ready for your room.';
    } else if (!item.availableThisCycle) {
      meta.textContent = item.occasional
        ? 'Occasional stock item. Check the next refresh.'
        : 'Unavailable this cycle.';
    } else if (item.remaining <= 0) {
      meta.textContent = 'Status: sold out for this cycle.';
    } else {
      const stockText = item.stock === 1 ? '1 copy this cycle' : `${item.remaining.toLocaleString()} of ${item.stock.toLocaleString()} left`;
      meta.textContent = `Price: ${item.price.toLocaleString()} coins | ${stockText}${item.occasional ? ' | Occasional stock' : ''}`;
    }

    const action = document.createElement('button');
    const cycleLimitReached = trader.purchasesRemaining <= 0;
    if (item.owned) {
      action.textContent = 'Owned';
      action.disabled = true;
    } else if (!item.availableThisCycle) {
      action.textContent = 'Not In Stock';
      action.disabled = true;
    } else if (item.remaining <= 0) {
      action.textContent = 'Sold Out';
      action.disabled = true;
    } else if (cycleLimitReached) {
      action.textContent = 'Cycle Limit Reached';
      action.disabled = true;
    } else {
      action.textContent = `Buy (${item.price.toLocaleString()} coins)`;
      action.disabled = refs.questState.coins < item.price;
      action.addEventListener('click', () => {
        refs.socket.emit('shop:buyFurniture', { itemId: item.itemId }, (resp) => {
          if (!resp?.ok) {
            refs.setFurnitureTraderStatus(resp?.error || 'Could not buy furniture.', '#fecaca');
            return;
          }
          if (resp.progress) {
            refs.applyProgressState(resp.progress);
          } else if (resp.furnitureTrader) {
            refs.questState.furnitureTrader = refs.normalizeFurnitureTraderState(resp.furnitureTrader);
          }
          renderFurnitureTraderModal();
          refs.setFurnitureTraderStatus(`Bought ${item.label}. It is now placed in your room.`, '#86efac');
        });
      });
    }

    card.append(title, meta, action);
    refs.furnitureTraderListEl.appendChild(card);
  }
}

export function renderHomeModal() {
  refs.ensureHomePaintSelectOptions();
  const room = refs.normalizeHomeRoomState(refs.questState.homeRoom);
  refs.questState.homeRoom = room;
  if (refs.homeWallSelectEl) {
    refs.homeWallSelectEl.value = Object.prototype.hasOwnProperty.call(refs.HOME_ROOM_WALL_OPTIONS, room.wallPaint)
      ? room.wallPaint
      : 'sand';
  }
  if (refs.homeFloorSelectEl) {
    refs.homeFloorSelectEl.value = Object.prototype.hasOwnProperty.call(refs.HOME_ROOM_FLOOR_OPTIONS, room.floorPaint)
      ? room.floorPaint
      : 'oak';
  }
  if (refs.homeWallApplyEl) {
    refs.homeWallApplyEl.textContent = `Apply Wall Paint (${refs.HOME_ROOM_PAINT_PRICE.toLocaleString()} coins)`;
  }
  if (refs.homeFloorApplyEl) {
    refs.homeFloorApplyEl.textContent = `Apply Floor Paint (${refs.HOME_ROOM_PAINT_PRICE.toLocaleString()} coins)`;
  }
  if (refs.homeFurnitureListEl) {
    refs.homeFurnitureListEl.innerHTML = '';
    for (const itemId of refs.HOME_ROOM_FURNITURE_ORDER) {
      const item = refs.HOME_ROOM_FURNITURE_SHOP[itemId];
      if (!item) continue;
      const owned = room.ownedFurniture?.[itemId] === true;
      const placed = room.placedFurniture?.[itemId] === true;
      const card = document.createElement('article');
      card.className = 'home-furniture-card';

      const header = document.createElement('div');
      header.className = 'home-furniture-header';

      const title = document.createElement('h3');
      title.textContent = item.label;

      const tag = document.createElement('span');
      tag.className = 'home-furniture-tag';
      if (owned) {
        tag.textContent = placed ? 'Placed' : 'Stored';
        tag.dataset.state = placed ? 'placed' : 'stored';
      } else {
        tag.textContent = item.occasionallyAvailable ? 'Occasional' : 'Standard';
        tag.dataset.state = item.occasionallyAvailable ? 'occasional' : 'standard';
      }

      header.append(title, tag);

      const meta = document.createElement('div');
      meta.className = 'home-furniture-meta';
      if (owned) {
        meta.textContent = placed
          ? 'Status: placed in your room.'
          : 'Status: owned and stored.';
      } else {
        const priceText = item.price ? `${item.price.toLocaleString()} coins` : 'Market price';
        meta.textContent = `Buy at the Furniture Trader island (${priceText}).`;
      }
      const action = document.createElement('button');
      if (owned) {
        action.textContent = placed ? 'Store Item' : 'Place Item';
        action.addEventListener('click', () => {
          refs.socket.emit('home:toggleFurniture', { itemId, placed: !placed }, (resp) => {
            if (!resp?.ok) {
              refs.setHomeStatus(resp?.error || 'Could not update furniture.', '#fecaca');
              return;
            }
            if (resp.progress) {
              refs.applyProgressState(resp.progress);
            }
            refs.setHomeStatus(`${item.label} ${placed ? 'stored' : 'placed'}.`, '#86efac');
            renderHomeModal();
          });
        });
      } else {
        action.textContent = 'Buy At Trader';
        action.disabled = true;
      }
      const actions = document.createElement('div');
      actions.className = 'home-furniture-actions';
      actions.append(action);
      card.append(header, meta, actions);
      refs.homeFurnitureListEl.appendChild(card);
    }
  }
  if (refs.homeDoorToggleEl) {
    refs.homeDoorToggleEl.textContent = room.doorOpen === false ? 'Door: Closed' : 'Door: Open';
  }
  refs.applyHomeRoomVisuals();
  if (refs.homeStatusEl && !refs.homeStatusEl.textContent.trim()) {
    refs.setHomeStatus('Use coins to buy furniture and paint your room.', '#cbd5e1');
  }
}

export function renderInventoryModal() {
  if (!refs.inventoryListEl) return;
  const tab = refs.inventoryViewTab === 'fish' ? 'fish' : 'ores';
  refs.inventoryViewTab = tab;
  refs.inventoryTabOresEl?.classList.toggle('active', tab === 'ores');
  refs.inventoryTabFishEl?.classList.toggle('active', tab === 'fish');
  const entries = refs.inventoryEntriesForTab(tab);
  refs.inventoryListEl.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('article');
    empty.className = 'inventory-entry';
    empty.innerHTML = `
      <div class="name">No items</div>
      <div class="qty">${tab === 'fish' ? 'Catch fish to fill this tab.' : 'Mine ore to fill this tab.'}</div>
      <div class="price">Value: --</div>
    `;
    refs.inventoryListEl.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'inventory-entry';
    card.innerHTML = `
      <div class="name">${entry.name}</div>
      <div class="qty">Owned: ${entry.qty.toLocaleString()}</div>
      <div class="price">Sell value: ${entry.price.toLocaleString()} coins each</div>
    `;
    refs.inventoryListEl.appendChild(card);
  });
}

export function renderRodShopModal() {
  const hasFishingRod = refs.questState.hasFishingRod === true;
  const currentTier = refs.normalizeRodTier(refs.questState.fishingRodTier, 'basic');
  const shopData = refs.rodShopSnapshot?.rodShop || null;
  const buyPrice = Math.max(0, Math.floor(Number(refs.rodShopSnapshot?.buyPrice) || refs.FISHING_ROD_PRICE));
  const basicRodLevelReq = Math.max(1, Math.floor(Number(refs.FISHING_ROD_LEVEL_REQUIREMENT.basic) || 1));
  const canBuyBasicRod = refs.questState.level >= basicRodLevelReq;
  const currentLabel = hasFishingRod ? refs.rodTierLabel(currentTier) : 'None';
  if (refs.rodCurrentTierEl) {
    refs.rodCurrentTierEl.textContent = `Current rod: ${currentLabel}`;
  }
  const next = refs.rodShopSnapshot?.rodShop?.next || null;
  if (!hasFishingRod) {
    if (refs.rodNextTierEl) refs.rodNextTierEl.textContent = 'Next upgrade: Buy your first rod';
    if (refs.rodUpgradeCostEl) {
      const levelText = `Level required: ${basicRodLevelReq} (you: ${refs.questState.level})`;
      refs.rodUpgradeCostEl.textContent = `First rod price: ${buyPrice.toLocaleString()} coins | ${levelText}`;
    }
    if (refs.rodUpgradeFishCostEl) refs.rodUpgradeFishCostEl.innerHTML = '<li>No fish required for first rod.</li>';
  } else if (shopData && next) {
    if (refs.rodNextTierEl) refs.rodNextTierEl.textContent = `Next upgrade: ${next.label || refs.rodTierLabel(next.tier)}`;
    if (refs.rodUpgradeCostEl) {
      const coinsRequired = Math.max(0, Math.floor(Number(next.coins) || 0)).toLocaleString();
      const levelRequired = Math.max(1, Math.floor(Number(next.levelRequired) || 1));
      refs.rodUpgradeCostEl.textContent = `Coins required: ${coinsRequired} | Level required: ${levelRequired} (you: ${refs.questState.level})`;
    }
    if (refs.rodUpgradeFishCostEl) {
      refs.rodUpgradeFishCostEl.innerHTML = '';
      for (const cost of next.fishCost || []) {
        const item = document.createElement('li');
        const owned = Math.max(0, Math.floor(Number(refs.ownedFishCount(cost?.fishId) || cost?.owned) || 0));
        const needed = Math.max(1, Math.floor(Number(cost?.amount) || 1));
        const ok = owned >= needed;
        item.style.color = ok ? '#86efac' : '#fca5a5';
        item.textContent = `${cost?.name || 'Fish'}: ${owned.toLocaleString()} / ${needed.toLocaleString()}`;
        refs.rodUpgradeFishCostEl.appendChild(item);
      }
    }
  } else if (!shopData) {
    if (refs.rodNextTierEl) refs.rodNextTierEl.textContent = 'Next upgrade: Loading...';
    if (refs.rodUpgradeCostEl) refs.rodUpgradeCostEl.textContent = '';
    if (refs.rodUpgradeFishCostEl) refs.rodUpgradeFishCostEl.innerHTML = '<li>Loading rod data...</li>';
  } else {
    if (refs.rodNextTierEl) refs.rodNextTierEl.textContent = 'Next upgrade: Max tier reached';
    if (refs.rodUpgradeCostEl) refs.rodUpgradeCostEl.textContent = '';
    if (refs.rodUpgradeFishCostEl) refs.rodUpgradeFishCostEl.innerHTML = '<li>Your rod is fully upgraded.</li>';
  }

  if (refs.rodBuyBtnEl) {
    refs.rodBuyBtnEl.disabled = hasFishingRod || !canBuyBasicRod;
    refs.rodBuyBtnEl.textContent = hasFishingRod
      ? 'Rod Owned'
      : (canBuyBasicRod
        ? `Buy Fishing Rod (${buyPrice.toLocaleString()} coins)`
        : `Locked: Level ${basicRodLevelReq}`);
  }
  if (refs.rodUpgradeBtnEl) {
    const meetsLevel = Boolean(next?.meetsLevel);
    refs.rodUpgradeBtnEl.disabled = !hasFishingRod || !next || !meetsLevel;
  }
}

export function renderMarketModal() {
  renderFishIndex();
  refs.renderMarketSellOptions();
  refs.renderMarketSellPreview();
  refs.renderMarketQuestSection();
}

export function renderOreModal() {
  refs.renderOreSellOptions();
  refs.renderOreSellPreview();
}
