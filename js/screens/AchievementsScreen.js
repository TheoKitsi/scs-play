/* ================================================================
   SCS Play -- Achievements Screen v3.0
   Shop-style tabs, staggered popIn animation, accordion categories.
   ================================================================ */
import { t, getLanguage }   from '../i18n.js';
import { $, $$, showScreen } from '../helpers/dom.js';
import app                    from '../appState.js';
import {
  generateAchievements, getChainIndex, getChainProgress,
  getProgress, getAchById, CATEGORIES, TIERS
} from '../achievements/AchievementSystem.js';

// ── Local UI state ──────────────────────────────────────────────
let _filter      = 'all';       // 'all' | 'earned' | 'locked' | 'close'
let _collapsed   = {};          // categoryId -> boolean (true = collapsed)
let _hasAutoExpanded = false;   // track if first-render auto-expand happened
let _allAchs     = null;        // cached generated list
let _byCat       = null;        // categoryId -> [achievements]
let _chains      = null;        // chainKey -> [achievement ids]
let _tabsBound   = false;       // track if tab listeners are bound

function init() {
  if (_allAchs) return;
  _allAchs = generateAchievements();
  _chains  = getChainIndex();

  // Group by category
  _byCat = {};
  for (const cat of CATEGORIES) _byCat[cat.id] = [];
  for (const a of _allAchs) {
    if (_byCat[a.cat]) _byCat[a.cat].push(a);
  }
}

// ── Main entry point ────────────────────────────────────────────
export function showAchievements() {
  init();
  const { save } = app;
  showScreen('achievements', app);

  const lang = getLanguage();
  const earned = new Set(save.getAchievements());
  const total  = _allAchs.length;
  const done   = _allAchs.filter(a => earned.has(a.id)).length;

  renderHeader(done, total);
  bindTabs();
  renderCategories(lang, earned, save.data, true);
}

// ──────────────────────────────────────────────────────────────
//  RENDER: Header progress bar
// ──────────────────────────────────────────────────────────────
function renderHeader(done, total) {
  const pEl = $('#achProgress');
  if (!pEl) return;
  const pct = Math.round((done / total) * 100);
  pEl.innerHTML = `
    <div class="ach-progress-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${t('achievements_short')}">
      <div class="ach-progress-fill" style="width:${pct}%"></div>
    </div>
    <span class="ach-progress-text">${done} / ${total} ${t('achievements_short')} (${pct}%)</span>
  `;
}

// ──────────────────────────────────────────────────────────────
//  TABS: Bind click handlers (once)
// ──────────────────────────────────────────────────────────────
function bindTabs() {
  // Sync selected state on every show
  $$('.ach-tab').forEach(btn => btn.classList.toggle('selected', btn.dataset.filter === _filter));

  if (_tabsBound) return;
  _tabsBound = true;

  $$('.ach-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.filter === _filter) return;
      _filter = tab.dataset.filter;
      $$('.ach-tab').forEach(b => b.classList.toggle('selected', b.dataset.filter === _filter));
      if (app.audio) app.audio.tap();
      _rerender(true);
    });
  });
}

// ──────────────────────────────────────────────────────────────
//  RENDER: Categories accordion with staggered popIn
// ──────────────────────────────────────────────────────────────
function renderCategories(lang, earned, saveData, animate) {
  const list = $('#achList');
  if (!list) return;

  // Default: collapse all, auto-expand first with progress
  if (!Object.keys(_collapsed).length) {
    for (const cat of CATEGORIES) {
      const catAchs = _byCat[cat.id] || [];
      const catEarnedCount = catAchs.filter(a => earned.has(a.id)).length;
      _collapsed[cat.id] = true;
      if (catEarnedCount > 0 && !_hasAutoExpanded) {
        _collapsed[cat.id] = false;
        _hasAutoExpanded = true;
      }
    }
  }

  let html = '';
  let itemIdx = 0;
  for (const cat of CATEGORIES) {
    const catAchs = _byCat[cat.id] || [];
    const filtered = _filterAchievements(catAchs, earned, saveData);
    if (filtered.length === 0 && (_filter !== 'all')) continue;

    const catEarned = catAchs.filter(a => earned.has(a.id)).length;
    const catTotal  = catAchs.length;
    const catPct    = catTotal ? Math.round((catEarned / catTotal) * 100) : 0;
    const isCollapsed = _collapsed[cat.id] !== false;
    const catName   = cat.name[lang] || cat.name.en;
    const catDesc   = cat.desc[lang] || cat.desc.en;
    const chainKeys = _getUniqueChains(filtered);
    const delay = animate ? itemIdx * 0.06 : 0;
    const animStyle = animate ? `animation:popIn .4s forwards;opacity:0;animation-delay:${delay}s` : '';

    html += `
    <div class="ach-category ${isCollapsed ? 'collapsed' : 'expanded'}" data-cat="${cat.id}" style="${animStyle}">
      <div class="ach-cat-header" data-cat="${cat.id}">
        <div class="ach-cat-info">
          <span class="ach-cat-name">${catName}</span>
          <span class="ach-cat-desc">${catDesc}</span>
        </div>
        <div class="ach-cat-right">
          <span class="ach-cat-counter">${catEarned}/${catTotal}</span>
          <div class="ach-cat-bar"><div class="ach-cat-bar-fill" style="width:${catPct}%"></div></div>
          <span class="ach-cat-arrow">${isCollapsed ? '\u25B6' : '\u25BC'}</span>
        </div>
      </div>
      <div class="ach-cat-body" style="${isCollapsed ? 'display:none' : ''}">
        ${chainKeys.map(ck => _renderChain(ck, filtered, earned, saveData, lang)).join('')}
      </div>
    </div>`;
    itemIdx++;
  }

  if (!html) {
    if (_filter === 'close') {
      html = `<div class="ach-empty">${t('ach_none_close') || 'Noch keine Erfolge in Reichweite \u2013 spiel weiter!'}</div>`;
    } else {
      html = `<div class="ach-empty">${t('no_achievements_found') || 'Keine Erfolge gefunden'}</div>`;
    }
  }

  list.innerHTML = html;

  // Bind accordion click — exclusive: only one category open at a time
  list.querySelectorAll('.ach-cat-header').forEach(header => {
    header.addEventListener('click', () => {
      const catId = header.dataset.cat;
      const wasCollapsed = _collapsed[catId] !== false;
      // Collapse all categories first
      for (const cat of CATEGORIES) _collapsed[cat.id] = true;
      // Toggle the clicked one (expand if was collapsed, stay collapsed if was open)
      _collapsed[catId] = !wasCollapsed;
      _rerender(false);
    });
  });
}

// ──────────────────────────────────────────────────────────────
//  RENDER: Chain (a template progression within a category)
// ──────────────────────────────────────────────────────────────
function _renderChain(chainKey, filteredAchs, earned, saveData, lang) {
  const chainIds = _chains[chainKey] || [];
  const chainAchs = chainIds.map(id => getAchById(id)).filter(Boolean);
  const visible = chainAchs.filter(a => filteredAchs.includes(a));
  if (visible.length === 0) return '';

  const progress = getChainProgress(chainKey, saveData);
  const { nextAch, nextProgress } = progress;
  const allEarned = progress.earned === progress.total;

  let progressHtml = '';
  if (nextAch && nextProgress) {
    const pct = Math.round(nextProgress.pct * 100);
    const nextName = nextAch.name[lang] || nextAch.name.en;
    const cur = _fmtDisplay(nextProgress.current, nextAch.cmp);
    const tar = _fmtDisplay(nextProgress.target, nextAch.cmp);
    progressHtml = `
      <div class="ach-chain-progress">
        <div class="ach-chain-next-label">${t('ach_next_target')}: ${nextName}</div>
        <div class="ach-chain-bar">
          <div class="ach-chain-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="ach-chain-values">${cur} / ${tar}</div>
      </div>`;
  } else if (allEarned) {
    progressHtml = `<div class="ach-chain-complete">${t('ach_complete')}</div>`;
  }

  const nodesHtml = visible.map(a => {
    const isEarned = earned.has(a.id);
    const tier = TIERS[a.tier] || TIERS[0];
    const name = a.name[lang] || a.name.en;
    const desc = a.desc[lang] || a.desc.en;
    const tierColor = isEarned ? tier.color : '#555';
    const tierName  = tier.name[lang] || tier.name.en;

    if (isEarned) {
      return `
        <div class="ach-node earned" title="${desc}">
          <span class="ach-node-check" style="color:${tierColor}">\u2713</span>
          <span class="ach-node-name">${name}</span>
          <span class="ach-node-tier" style="color:${tierColor}">${tierName}</span>
        </div>`;
    }

    const p = getProgress(a, saveData);
    const pct = Math.round(p.pct * 100);
    return `
      <div class="ach-node locked" title="${desc}">
        <span class="ach-node-lock">\uD83D\uDD12</span>
        <span class="ach-node-name">${name}</span>
        <span class="ach-node-tier">${tierName}</span>
        <div class="ach-node-minibar"><div class="ach-node-minibar-fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');

  return `
    <div class="ach-chain">
      ${progressHtml}
      <div class="ach-chain-nodes">${nodesHtml}</div>
    </div>`;
}

// ──────────────────────────────────────────────────────────────
//  FILTERING
// ──────────────────────────────────────────────────────────────
function _filterAchievements(achs, earned, saveData) {
  let result = achs;

  if (_filter === 'earned') {
    result = result.filter(a => earned.has(a.id));
  } else if (_filter === 'locked') {
    result = result.filter(a => !earned.has(a.id));
  } else if (_filter === 'close') {
    result = result.filter(a => {
      if (earned.has(a.id)) return false;
      const p = getProgress(a, saveData);
      return p.pct >= 0.5;
    });
  }

  return result;
}

// ──────────────────────────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────────────────────────
function _getUniqueChains(achs) {
  const seen = new Set();
  const result = [];
  for (const a of achs) {
    if (!seen.has(a.chainKey)) {
      seen.add(a.chainKey);
      result.push(a.chainKey);
    }
  }
  return result;
}

function _rerender(animate) {
  const { save } = app;
  const lang = getLanguage();
  const earned = new Set(save.getAchievements());
  const total  = _allAchs.length;
  const done   = _allAchs.filter(a => earned.has(a.id)).length;

  renderHeader(done, total);
  renderCategories(lang, earned, save.data, animate);
}

function _fmtDisplay(value, cmp) {
  if (cmp === 'lte' && (value === 0 || value === 9999)) return '--';
  if (value >= 1e6)  return (value / 1e6).toFixed(1) + 'M';
  if (value >= 1000) return Math.round(value).toLocaleString();
  return String(Math.round(value));
}
