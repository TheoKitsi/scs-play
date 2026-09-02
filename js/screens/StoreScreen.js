/* ═══════════════════════════════════════
   SCS Play — Store Screen
   Earned themes and trails.
   ═══════════════════════════════════════ */
import { CONFIG }           from '../config.js';
import { t }                from '../i18n.js';
import { $, $$, showScreen } from '../helpers/dom.js';
import { haptic }           from '../helpers/haptics.js';
import { applyTheme }       from '../services/ThemeService.js';
import app                   from '../appState.js';
import { getBodyFx }        from '../services/EffectsService.js';

let shopTab = 'themes';

function updateShopLives() {
  const { save } = app;
  const fireEl = $('#shopFireCount');
  if (fireEl) fireEl.textContent = save.getFireBalance();
}

function renderShopTabs() {
  $$('.shop-tab').forEach(btn => btn.classList.toggle('selected', btn.dataset.tab === shopTab));
}

function renderUnlockItems(type) {
  const { save, audio } = app;
  const list = $('#storeList');
  if (!list) return;
  list.className = 'unlock-list';

  const items = type === 'themes' ? CONFIG.THEMES : CONFIG.TRAILS;
  const activeId = type === 'themes' ? save.getActiveTheme() : save.getActiveTrail();
  const prefix = type === 'themes' ? 'theme' : 'trail';
  const fireBalance = save.getFireBalance();

  /* Fire costs based on unlock level tiers */
  const fireCosts = { 0: 0, 2: 30, 3: 50, 5: 100, 7: 150, 8: 120, 9: 200, 12: 300, 15: 400, 18: 500, 19: 550 };

  list.innerHTML = items.map((item, i) => {
    const cost = fireCosts[item.unlockLevel] || item.unlockLevel * 25;
    const isDefault = item.id === 'default';
    const isOwned = isDefault || save.hasPurchase(`${prefix}_${item.id}`);
    const isActive = item.id === activeId;
    const canAfford = fireBalance >= cost;
    const previewClass = `${prefix}-preview-${item.id}`;

    let btnHTML = '';
    if (isActive) {
      btnHTML = `<button class="btn-unlock btn-active"><svg class="ui-icon" viewBox="0 0 24 24" style="width:14px;height:14px"><use href="#icon-eye"></use></svg> ${t('unlockable_active')}</button>`;
    } else if (isOwned) {
      btnHTML = `<button class="btn-unlock btn-activate" data-id="${item.id}" data-type="${type}">${t('unlockable_activate')}</button>`;
    } else {
      btnHTML = `<button class="btn-unlock btn-fire-buy ${canAfford ? '' : 'btn-locked'}" data-id="${item.id}" data-type="${type}" data-cost="${cost}" ${canAfford ? '' : 'disabled'}>\uD83D\uDD25 ${cost}</button>`;
    }

    return `
      <div class="unlock-item ${isActive ? 'active-item' : ''} ${!isOwned && !isDefault ? 'locked-item' : ''} ${isActive ? 'premium-glow-item' : ''}">
        <div class="unlock-preview ${previewClass}${type === 'trails' ? ' trail-anim' : ''}"></div>
        <div class="unlock-info">
          <span class="unlock-name">${t(prefix + '_' + item.id)}</span>
          <span class="unlock-desc">${t(prefix + '_' + item.id + '_desc')}</span>
        </div>
        ${btnHTML}
      </div>`;
  }).join('');

  /* Activate owned items */
  $$('.btn-activate', list).forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const itemType = btn.dataset.type;
      if (itemType === 'themes') { await save.setActiveTheme(id); applyTheme(id); app.engagement?.trackThemeChange(); }
      else { await save.setActiveTrail(id); }
      renderShopContent();
      audio.tap();
    });
  });

  /* Buy with fire */
  $$('.btn-fire-buy:not([disabled])', list).forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const itemType = btn.dataset.type;
      const cost = parseInt(btn.dataset.cost, 10);
      const itemName = t(`${btn.dataset.type === 'themes' ? 'theme' : 'trail'}_${id}`);
      const balance = save.getFireBalance();
      if (balance < cost) {
        alert(t('fire_not_enough', { cost, balance }));
        return;
      }
      const confirmed = confirm(t('fire_purchase_confirm', { item: itemName, cost }));
      if (!confirmed) return;
      const ok = await save.spendFire(cost);
      if (!ok) return;
      await save.setPurchase(`${prefix}_${id}`);
      if (itemType === 'themes') { await save.setActiveTheme(id); applyTheme(id); }
      else { await save.setActiveTrail(id); }
      const bodyFx = getBodyFx();
      bodyFx.achievementToast(t('fire_purchase_success', { item: itemName }));
      bodyFx.confetti(80, 2000);
      haptic('purchase', save);
      renderShopContent();
      updateShopLives();
      audio.tap();
    });
  });
}

function renderShopContent() {
  if (shopTab === 'themes') renderUnlockItems('themes');
  else if (shopTab === 'trails') renderUnlockItems('trails');
}

export function showStore(showHome) {
  const { audio } = app;
  showScreen('store', app);
  shopTab = 'themes';
  renderShopTabs();
  renderShopContent();
  updateShopLives();

  $$('.btn-back, .btn-back-bottom', $('#store')).forEach(btn => {
    btn._customBack = true;
    btn.onclick = () => { btn._customBack = false; showHome(); audio.tap(); };
  });
}

export function bindShopTabs() {
  const { audio, save } = app;
  $$('.shop-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      shopTab = tab.dataset.tab;
      renderShopTabs();
      renderShopContent();
      updateShopLives();
      audio.tap();
      haptic('tap', save);
      const bodyFx = getBodyFx();
      if (e.clientX && e.clientY && bodyFx) {
        bodyFx.ripple(e.clientX, e.clientY, '#00ffff');
      }
    });
  });
}
