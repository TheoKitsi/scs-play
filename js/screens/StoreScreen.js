/* ═══════════════════════════════════════
   SCS Play — Store Screen
   Earned themes and trails.
   ═══════════════════════════════════════ */
import { CONFIG }           from '../config.js';
import { t }                from '../i18n.js';
import { $, $$, showScreen, escHTML } from '../helpers/dom.js';
import { haptic }           from '../helpers/haptics.js';
import { applyTheme }       from '../services/ThemeService.js';
import app                   from '../appState.js';
import { getBodyFx }        from '../services/EffectsService.js';
import { appDialog } from '../helpers/appDialog.js';
import { icon } from '../renderers/icons.js';
import { designPreview } from '../renderers/designPreview.js';
import { openModal, closeModal } from '../helpers/modal.js';

let shopTab = 'themes';
let previewRoot = null;
let previewAnimations = [];
let previewRun = 0;

function stopPreviewMotion() {
  previewRun++;
  previewAnimations.forEach(animation => animation.cancel());
  previewAnimations = [];
  const button = previewRoot?.querySelector('#btnPlayDesignDemo');
  if (button) { button.disabled = previewMotionBlocked(); button.textContent = t('design_demo'); }
}

function previewMotionBlocked() {
  return document.body.hasAttribute('data-reduced-motion') || document.body.dataset.perfMode === 'low';
}

function closeDesignPreview(restoreFocus = true) {
  stopPreviewMotion();
  closeModal(previewRoot, { restoreFocus });
}

function playDesignDemo() {
  stopPreviewMotion();
  if (previewMotionBlocked() || document.hidden) return;
  const run = previewRun;
  const scene = previewRoot.querySelector('.design-preview');
  const { width, height } = scene.getBoundingClientRect();
  const button = previewRoot.querySelector('#btnPlayDesignDemo');
  button.disabled = true;
  button.textContent = t('design_demo_playing');
  // One user-requested compositor demonstration, never a looping mini-game.
  previewAnimations = [
    scene.querySelector('.design-object').animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${-85 / 240 * width}px,${35 / 156 * height}px) scale(.75)`, opacity: 1, offset: .8 },
      { transform: `translate(${-85 / 240 * width}px,${35 / 156 * height}px) scale(.75)`, opacity: 0 },
    ], { duration: 750, easing: 'cubic-bezier(.2,.6,.3,1)' }),
    scene.querySelector('.design-trace').animate([{ opacity: 0 }, { opacity: .8, offset: .6 }, { opacity: 0 }], { duration: 750 }),
  ];
  Promise.allSettled(previewAnimations.map(animation => animation.finished)).then(() => {
    if (run === previewRun) stopPreviewMotion();
  });
}

function showDesignPreview(type, id) {
  if (!previewRoot) {
    previewRoot = document.createElement('div');
    previewRoot.id = 'designPreviewOverlay';
    previewRoot.className = 'app-dialog-overlay';
    previewRoot.hidden = previewRoot.inert = true;
    previewRoot.setAttribute('aria-labelledby', 'designPreviewTitle');
    previewRoot.setAttribute('aria-describedby', 'designPreviewNote');
    previewRoot.innerHTML = '<section class="app-dialog-panel"><h2 id="designPreviewTitle"></h2><div id="designPreviewScene"></div><p id="designPreviewNote"></p><p id="designPreviewMotionNote" hidden></p><button type="button" id="btnPlayDesignDemo" class="btn btn-secondary"></button><button type="button" id="btnCloseDesignPreview" class="btn btn-secondary"></button></section>';
    document.body.appendChild(previewRoot);
    previewRoot.querySelector('#btnCloseDesignPreview').addEventListener('click', () => closeDesignPreview());
    previewRoot.querySelector('#btnPlayDesignDemo').addEventListener('click', playDesignDemo);
    previewRoot.addEventListener('click', event => { if (event.target === previewRoot) closeDesignPreview(); });
    window.addEventListener('scs:screenchange', () => closeDesignPreview(false));
    const syncMotion = () => {
      stopPreviewMotion();
      previewRoot.querySelector('#designPreviewMotionNote').hidden = !document.body.hasAttribute('data-reduced-motion');
    };
    window.addEventListener('scs:motionpreference', syncMotion);
    window.addEventListener('scs:perftier', syncMotion);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopPreviewMotion(); });
  }
  const name = t(`${type === 'themes' ? 'theme' : 'trail'}_${id}`);
  previewRoot.querySelector('h2').textContent = t('design_preview_item', { item: name });
  previewRoot.querySelector('#designPreviewScene').innerHTML = designPreview(type, id, app.save.getActiveTheme(), app.save.getSetting('colorblind'), app.save.getActiveTrail());
  previewRoot.querySelector('#designPreviewNote').textContent = t('design_preview_detail');
  previewRoot.querySelector('#designPreviewMotionNote').textContent = t('design_demo_static');
  previewRoot.querySelector('#designPreviewMotionNote').hidden = !document.body.hasAttribute('data-reduced-motion');
  previewRoot.querySelector('#btnCloseDesignPreview').textContent = t('dialog_ok');
  stopPreviewMotion();
  openModal(previewRoot, { initialFocus: '#btnCloseDesignPreview', onDismiss: () => closeDesignPreview() });
}

function updateShopLives() {
  const { save } = app;
  const fireEl = $('#shopFireCount');
  if (fireEl) fireEl.textContent = save.getFireBalance();
}

function renderShopTabs() {
  $$('.shop-tab').forEach(btn => {
    const selected = btn.dataset.tab === shopTab;
    btn.classList.toggle('selected', selected);
    btn.setAttribute('aria-selected', String(selected));
    btn.tabIndex = selected ? 0 : -1;
  });
  const panel = $('#shopTabContent');
  const activeTab = $(`.shop-tab[data-tab="${shopTab}"]`);
  if (panel && activeTab) panel.setAttribute('aria-labelledby', activeTab.id);
}

function renderUnlockItems(type, focusItemId = null) {
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
    const levelReached = save.getLevel() >= item.unlockLevel;

    let btnHTML = '';
    if (isActive) {
      btnHTML = `<span class="btn-unlock btn-active">${icon('check')} ${t('unlockable_active')}</span>`;
    } else if (isOwned) {
      btnHTML = `<button class="btn-unlock btn-activate" data-id="${item.id}" data-type="${type}" ${levelReached ? '' : 'disabled'}>${t('unlockable_activate')}</button>`;
    } else {
      btnHTML = `<button class="btn-unlock btn-fire-buy ${canAfford && levelReached ? '' : 'btn-locked'}" data-id="${item.id}" data-type="${type}" data-cost="${cost}" ${canAfford && levelReached ? '' : 'disabled'} aria-label="${cost} Fire"><svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" style="width:14px;height:14px"><use href="#icon-fire"></use></svg> ${cost}</button>`;
    }

    return `
      <div class="unlock-item ${isActive ? 'active-item' : ''} ${!isOwned && !isDefault ? 'locked-item' : ''} ${isActive ? 'premium-glow-item' : ''}" data-item-id="${item.id}" tabindex="-1">
        <button type="button" class="unlock-preview" data-preview-id="${item.id}" aria-label="${escHTML(t('design_preview_item', { item: t(prefix + '_' + item.id) }))}" aria-haspopup="dialog">${designPreview(type, item.id, save.getActiveTheme(), save.getSetting('colorblind'), save.getActiveTrail())}<span class="unlock-preview-label">${icon('eye')}${t('design_preview')}</span></button>
        <div class="unlock-info">
          <span class="unlock-name">${t(prefix + '_' + item.id)}</span>
          <span class="unlock-desc">${t(prefix + '_' + item.id + '_desc')}</span>
          ${levelReached ? '' : `<span class="unlock-requirement">${t('unlock_at_level', { n: item.unlockLevel + 1 })}</span>`}
        </div>
        ${btnHTML}
      </div>`;
  }).join('');

  $$('[data-preview-id]', list).forEach(button => {
    button.addEventListener('click', () => showDesignPreview(type, button.dataset.previewId));
  });

  /* Activate owned items */
  $$('.btn-activate', list).forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const itemType = btn.dataset.type;
      if (itemType === 'themes') { if (await save.setActiveTheme(id)) applyTheme(id); app.engagement?.trackThemeChange(); }
      else { await save.setActiveTrail(id); }
      renderShopContent(id);
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
        await appDialog({ title: t('store'), message: t('fire_not_enough', { cost, balance }) });
        return;
      }
      const confirmed = await appDialog({ title: t('dialog_purchase'), message: t('fire_purchase_confirm', { item: itemName, cost }), confirmLabel: t('dialog_unlock'), cancelLabel: t('dialog_cancel') });
      if (!confirmed) return;
      /* A dialog is asynchronous: another local action may already own it. */
      if (save.hasPurchase(`${prefix}_${id}`)) return;
      const ok = await save.spendFire(cost);
      if (!ok) return;
      await save.setPurchase(`${prefix}_${id}`);
      if (itemType === 'themes') { if (await save.setActiveTheme(id)) applyTheme(id); }
      else { await save.setActiveTrail(id); }
      const bodyFx = getBodyFx();
      bodyFx.achievementToast(t('fire_purchase_success', { item: itemName }));
      haptic('purchase', save);
      renderShopContent(id);
      updateShopLives();
      audio.tap();
    });
  });

  if (focusItemId) {
    const item = [...list.querySelectorAll('.unlock-item')]
      .find(candidate => candidate.dataset.itemId === focusItemId);
    item?.focus();
  }
}

function renderShopContent(focusItemId = null) {
  if (shopTab === 'themes') renderUnlockItems('themes', focusItemId);
  else if (shopTab === 'trails') renderUnlockItems('trails', focusItemId);
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
  const tabs = $$('.shop-tab');
  const selectTab = (tab) => {
    shopTab = tab.dataset.tab;
    renderShopTabs();
    renderShopContent();
    updateShopLives();
    audio.tap();
    haptic('tap', save);
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', (event) => selectTab(tab, event));
    tab.addEventListener('keydown', (event) => {
      let nextIndex;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else return;

      event.preventDefault();
      tabs[nextIndex].focus();
      selectTab(tabs[nextIndex]);
    });
  });
}
