/* ═══════════════════════════════════════
   SCS Play — Store Screen
   Earned themes and trails.
   ═══════════════════════════════════════ */
import { CONFIG }           from '../config.js';
import { t, getLanguage }   from '../i18n.js';
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
const fireCosts = { 0: 0, 2: 30, 3: 50, 5: 100, 7: 150, 8: 120, 9: 200, 12: 300, 15: 400, 18: 500, 19: 550 };

function designState(type, item) {
  const { save } = app;
  const prefix = type === 'themes' ? 'theme' : 'trail';
  const cost = fireCosts[item.unlockLevel] ?? item.unlockLevel * 25;
  const active = item.id === (type === 'themes' ? save.getActiveTheme() : save.getActiveTrail());
  const owned = item.id === 'default' || save.hasPurchase(`${prefix}_${item.id}`);
  const levelReached = save.getLevel() >= item.unlockLevel;
  const balance = save.getFireBalance();
  const state = active ? 'active' : !levelReached ? 'level' : owned ? 'owned' : balance < cost ? 'funds' : 'available';
  const label = { active: t('unlockable_active'), owned: item.id === 'default' ? t('theme_default') : t('iap_owned'),
    level: t('unlock_at_level', { n: item.unlockLevel + 1 }),
    funds: `${t('fire_balance')}: ${balance} / ${cost}`, available: t('dialog_unlock') }[state];
  return { state, cost, owned, label };
}

function stopPreviewMotion() {
  previewRun++;
  previewAnimations.forEach(animation => animation.cancel());
  previewAnimations = [];
  const button = previewRoot?.querySelector('#btnPlayDesignDemo');
  if (button) { button.disabled = previewMotionBlocked(); button.textContent = t('design_demo'); }
}

function previewMotionBlocked() {
  return document.body.hasAttribute('data-reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.dataset.perfMode === 'low';
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
  const button = previewRoot.querySelector('#btnPlayDesignDemo');
  const route = [...scene.querySelectorAll(':scope > svg')].find(svg => svg.getBoundingClientRect().width > 0);
  const trace = route.querySelector('.design-trace');
  const phone = route.classList.contains('design-phone-route');
  button.disabled = true;
  button.textContent = t('design_demo_playing');
  // The task stays in its receiver. Reveal a single gesture and its matched key.
  previewAnimations = [
    scene.querySelector('.design-slot--2').animate([
      { outline: '2px solid transparent' }, { outline: '2px solid transparent', offset: .68 },
      { outline: '2px solid #2ed573', offset: .84 }, { outline: '2px solid transparent' },
    ], { duration: 750 }),
    trace.animate([
      { clipPath: phone ? 'inset(0 0 76% 0)' : 'inset(0 0 0 50%)', opacity: 0 },
      { clipPath: 'inset(0)', opacity: 1, offset: .8 },
      { clipPath: 'inset(0)', opacity: 0 },
    ], { duration: 750, easing: 'cubic-bezier(.2,.6,.3,1)' }),
  ];
  if (scene.dataset.previewTrail === 'rainbow') previewAnimations.push(trace.animate(
    [3, 48, 93, 138].map(hue => ({ color: `hsl(${hue},90%,60%)` })), { duration: 750 }));
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
    previewRoot.innerHTML = '<section class="app-dialog-panel"><div class="collection-preview-kicker"></div><h2 id="designPreviewTitle"></h2><div id="designPreviewScene"></div><div class="collection-pair"></div><p id="designPreviewNote"></p><p id="designPreviewMotionNote" hidden></p><div class="collection-preview-actions"><button type="button" id="btnPlayDesignDemo" class="btn btn-secondary"></button><button type="button" id="btnCloseDesignPreview" class="btn btn-secondary"></button></div></section>';
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
  const isTheme = type === 'themes';
  const item = (isTheme ? CONFIG.THEMES : CONFIG.TRAILS).find(entry => entry.id === id);
  const { state, label } = designState(type, item);
  previewRoot.querySelector('.collection-preview-kicker').textContent = `${t('mode_klassik')} · ${t(`shop_tab_${type}`)}`;
  previewRoot.querySelector('.collection-pair').innerHTML = `<span>${icon(isTheme ? 'bolt' : 'palette')}${escHTML(t(isTheme ? `trail_${app.save.getActiveTrail()}` : `theme_${app.save.getActiveTheme()}`))}</span>
    <span>${icon(state === 'active' || state === 'owned' ? 'check' : state === 'available' ? 'fire' : 'lock')}${escHTML(label)}</span>`;
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

function shopSaveError() {
  return appDialog({ title: t('store'), message: getLanguage() === 'de'
    ? 'Nicht gespeichert. Dein Guthaben und deine Auswahl bleiben unverändert.'
    : 'Not saved. Your balance and equipped design are unchanged.' });
}

function renderShopTabs() {
  $$('.shop-tab').forEach(btn => {
    const selected = btn.dataset.tab === shopTab;
    const themes = btn.dataset.tab === 'themes';
    const entries = themes ? CONFIG.THEMES : CONFIG.TRAILS;
    const count = entries.filter(item => item.id === 'default' || app.save.hasPurchase(`${themes ? 'theme' : 'trail'}_${item.id}`)).length;
    btn.innerHTML = `${icon(themes ? 'palette' : 'bolt')}<span>${t(`shop_tab_${btn.dataset.tab}`)}</span><small>${count}/${entries.length}</small>`;
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
  const prefix = type === 'themes' ? 'theme' : 'trail';
  list.innerHTML = items.map(item => {
    const { state, cost, owned, label } = designState(type, item);
    const name = t(`${prefix}_${item.id}`);
    const price = t('wheel_prize_fire', { n: cost });

    let btnHTML = '';
    if (state === 'active') {
      btnHTML = `<span class="btn-unlock btn-active">${icon('check')} ${t('unlockable_active')}</span>`;
    } else if (owned) {
      btnHTML = `<button type="button" class="btn-unlock btn-activate" data-id="${item.id}" data-type="${type}" ${state === 'level' ? 'disabled' : ''} aria-label="${escHTML(name + ': ' + t('unlockable_activate'))}">${t('unlockable_activate')}${icon('arrow')}</button>`;
    } else {
      btnHTML = `<button type="button" class="btn-unlock btn-fire-buy ${state === 'available' ? '' : 'btn-locked'}" data-id="${item.id}" data-type="${type}" data-cost="${cost}" ${state === 'available' ? '' : 'disabled'} aria-label="${escHTML(`${t('dialog_unlock')}: ${name}, ${price}`)}">${icon('fire')}${price}</button>`;
    }

    return `
      <div class="unlock-item ${state === 'active' ? 'active-item' : ''} ${owned ? '' : 'locked-item'}" data-item-id="${item.id}" data-state="${state}" tabindex="-1">
        <button type="button" class="unlock-preview" data-preview-id="${item.id}" aria-label="${escHTML(t('design_preview_item', { item: t(prefix + '_' + item.id) }))}" aria-haspopup="dialog">${designPreview(type, item.id, save.getActiveTheme(), save.getSetting('colorblind'), save.getActiveTrail())}<span class="unlock-preview-label">${icon('eye')}${t('design_preview')}</span></button>
        <div class="unlock-info">
          <span class="unlock-name">${t(prefix + '_' + item.id)}</span>
          <span class="unlock-desc">${t(prefix + '_' + item.id + '_desc')}</span>
          ${state === 'active' ? '' : `<span class="unlock-requirement">${state === 'level' || state === 'funds' ? icon('lock') : ''}${escHTML(label)}</span>`}
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
      const isTheme = itemType === 'themes';
      try {
        const applied = await save.withBatch(() => isTheme ? save.setActiveTheme(id) : save.setActiveTrail(id));
        if (isTheme && applied) { applyTheme(id); app.engagement?.trackThemeChange(); }
      } catch { await shopSaveError(); return; }
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
      if (designState(type, items.find(item => item.id === id)).state !== 'available') {
        renderShopContent(id); updateShopLives(); return;
      }
      try {
        const equipped = await save.withBatch(async () => {
          if (!await save.spendFire(cost)) return false;
          await save.setPurchase(`${prefix}_${id}`);
          return itemType === 'themes' ? save.setActiveTheme(id) : save.setActiveTrail(id);
        });
        if (!equipped) return;
        if (itemType === 'themes') applyTheme(id);
      } catch { await shopSaveError(); return; }
      const bodyFx = getBodyFx();
      bodyFx.achievementToast(t('fire_purchase_success', { item: itemName }));
      haptic('purchase', save);
      renderShopTabs();
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
