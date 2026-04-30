/* ═══════════════════════════════════════
   SCS Play — Game Screen
   Rendering, HUD, countdown, pause,
   spawn handling, swipe wiring.
   ═══════════════════════════════════════ */
import { CONFIG }           from '../config.js';
import { t, getLanguage }   from '../i18n.js';
import { $, $$, setText, hexToRgba, showScreen } from '../helpers/dom.js';
import { haptic }           from '../helpers/haptics.js';
import { shapeSVG }         from '../renderers/shapes.js';
import { SwipeHandler }     from '../input.js';
import { EffectsManager }   from '../effects.js';
import { updateGameAdBanner, isAdFree } from '../services/AdService.js';
import app                   from '../appState.js';
import { getBodyFx } from './HomeScreen.js';
import { trackKlassikAnswer, startKlassikGhostRacer, endKlassikGame, getGhostDelta, getSpeedZone } from '../game/ModeMastery.js';
import { trackFormenAnswer, startFormenGame, endFormenGame, getFormenGhostDelta } from '../game/ModeMastery.js';
import { trackExpertAnswer, startExpertGame, endExpertGame, getExpertGhostDelta, getWeakestDirection } from '../game/ModeMastery.js';
import { trackUltraAnswer, startUltraGame, endUltraGame, getUltraGhostDelta, getWeakestUltraDirection } from '../game/ModeMastery.js';
import { trackMatheAnswer, startMatheGame, endMatheGame, getMatheGhostDelta } from '../game/ModeMastery.js';
import { trackAlgebraAnswer, startAlgebraGame, endAlgebraGame, getAlgebraGhostDelta } from '../game/ModeMastery.js';
import { trackWorteAnswer, startWorteGame, endWorteGame, getWorteGhostDelta } from '../game/ModeMastery.js';
import { trackHauptstaedteAnswer, startHauptstaedteGame, endHauptstaedteGame, getHauptstaedteGhostDelta } from '../game/ModeMastery.js';
import { trackWissenAnswer, startWissenGame, endWissenGame, getWissenGhostDelta } from '../game/ModeMastery.js';
import { trackMemoAnswer, startMemoGame, endMemoGame, getMemoGhostDelta } from '../game/ModeMastery.js';
import { trackSequenzResult, startSequenzGame, endSequenzGame } from '../game/ModeMastery.js';
import { trackStroopAnswer, startStroopGame, endStroopGame, getStroopGhostDelta } from '../game/ModeMastery.js';
import { trackFokusAnswer, startFokusGame, endFokusGame, getFokusGhostDelta } from '../game/ModeMastery.js';
import { trackChaosAnswer, startChaosGame, endChaosGame, getChaosGhostDelta } from '../game/ModeMastery.js';

/* ═══════ SVG Cache — avoid regenerating & parsing identical SVGs ═══════ */
const _svgCache = new Map();

function getCachedSVGNode(shape, color, size, bonus) {
  const key = `${shape}|${color}|${size}|${bonus || ''}`;
  let node = _svgCache.get(key);
  if (!node) {
    const tmp = document.createElement('div');
    tmp.innerHTML = shapeSVG(shape, color, size, bonus);
    node = tmp.firstChild;
    _svgCache.set(key, node);
  }
  return node.cloneNode(true);
}

/* ═══════ Platform color cache — avoid recomputing gradient strings ═══════ */
let _lastPlatformColor = '';
const _platformStyles = {};

function applyPlatformColor(platform, color) {
  if (color === _lastPlatformColor) return;
  _lastPlatformColor = color;
  if (!_platformStyles[color]) {
    _platformStyles[color] = {
      bg: `radial-gradient(circle, ${hexToRgba(color, 0.15)} 0%, ${hexToRgba(color, 0.04)} 55%, transparent 75%)`,
      border: hexToRgba(color, 0.2),
      shadow: `0 0 40px ${hexToRgba(color, 0.12)}`
    };
  }
  const s = _platformStyles[color];
  platform.style.background = s.bg;
  platform.style.borderColor = s.border;
  platform.style.boxShadow = s.shadow;
}

/* ═══════ Corner style cache — avoid recomputing per-color strings ═══════ */
const _cornerStyleCache = {};
function getCornerStyles(color) {
  if (!_cornerStyleCache[color]) {
    _cornerStyleCache[color] = {
      bg: hexToRgba(color, 0.08),
      border: hexToRgba(color, 0.3),
      shadow: `0 0 15px ${hexToRgba(color, 0.15)}, inset 0 0 15px ${hexToRgba(color, 0.05)}`
    };
  }
  return _cornerStyleCache[color];
}

/* ═══════ Render corners (with diffing — only touch changed DOM) ═══════ */
const _prevCornerState = {};

export function renderCorners(cornerMap, forceAll = false) {
  const { game } = app;
  const isText = game.contentType !== 'shape';

  /* Full reset only when necessary (first render or mode change) */
  if (forceAll || !Object.keys(_prevCornerState).length) {
    $$('.corner-shape').forEach(el => {
      el.innerHTML = '';
      el.className = el.className.replace(/\bdir-\S+/g, '').trim();
      if (!el.classList.contains('corner-shape')) el.classList.add('corner-shape');
    });
    for (const k in _prevCornerState) delete _prevCornerState[k];
  }

  Object.entries(cornerMap).forEach(([dir, info]) => {
    const color = app.colorblind ? info.colorblind : info.color;
    const display = isText ? info.display : info.shape;
    const prevKey = `${display}|${color}|${isText ? info.value : ''}|${info.size || ''}`;

    /* Skip DOM update if this corner hasn't changed */
    if (!forceAll && _prevCornerState[dir] === prevKey) return;
    _prevCornerState[dir] = prevKey;

    const el = $(`.corner-shape[data-dir="${dir}"]`);
    if (!el) return;

    /* ── STROOP corners: solid color swatch (no text — pure Stroop effect) ── */
    if (info.type === 'stroop') {
      el.innerHTML = '';
      el.dataset.value = info.value;
      el.dataset.color = color;
      if (!el.classList.contains(`dir-${dir}`)) el.classList.add(`dir-${dir}`);
      el.style.background = hexToRgba(color, 0.82);
      el.style.borderColor = hexToRgba(color, 0.9);
      el.style.boxShadow = `0 0 18px ${hexToRgba(color, 0.4)}, inset 0 0 12px ${hexToRgba(color, 0.2)}`;
      return;
    }

    /* ── CHAOS corners: shape+color combo ── */
    if (info.type === 'chaos') {
      const shapeMap = { circle: '●', square: '■', triangle: '▲', star: '★' };
      const sym = shapeMap[info.shape] || info.shape;
      const szMap = { tiny: '0.7rem', small: '1.2rem', medium: '2.0rem', large: '2.8rem' };
      const sz = szMap[info.size] || '1.1rem';
      el.innerHTML = `<span class="corner-text chaos-corner-shape" style="color:${color};font-size:${sz}">${sym}</span>`;
      el.dataset.color = color;
      if (!el.classList.contains(`dir-${dir}`)) el.classList.add(`dir-${dir}`);
      const cs = getCornerStyles(color);
      el.style.background = cs.bg;
      el.style.borderColor = cs.border;
      el.style.boxShadow = cs.shadow;
      return;
    }

    if (isText) {
      const extraCls = info.type === 'capitals' ? ' corner-capitals' : info.type === 'algebra' ? ' corner-algebra' : info.type === 'wissen' ? ' corner-wissen' : '';
      el.innerHTML = `<span class="corner-text${extraCls}">${info.display}</span>`;
      el.dataset.value = info.value;
    } else {
      el.textContent = '';
      el.appendChild(getCachedSVGNode(info.shape, color, 48));
      el.dataset.shape = info.shape;
    }

    el.dataset.color = color;
    if (!el.classList.contains(`dir-${dir}`)) el.classList.add(`dir-${dir}`);
    const cs = getCornerStyles(color);
    el.style.background = cs.bg;
    el.style.borderColor = cs.border;
    el.style.boxShadow = cs.shadow;
  });
}

/* ═══════ Render center shape ═══════ */
/* Neutral platform accent for brain/reflex modes — prevents leaking correct-answer color */
const NEUTRAL_PLATFORM_COLOR = '#9D4EDD';

export function renderCenter(shapeData) {
  const center = $('#centerShape');
  const platform = $('#centerPlatform');
  if (!center || !shapeData) return;
  const color = app.colorblind ? shapeData.colorblind : shapeData.color;
  const inRush = app.game.inRush;
  const inFever = app.game.feverActive;

  /* Brain & reflex modes: use neutral platform glow so it doesn't reveal the answer */
  const isBrainLike = shapeData.type === 'math' || shapeData.type === 'word'
    || shapeData.type === 'stroop' || shapeData.type === 'fokus' || shapeData.type === 'chaos'
    || shapeData.type === 'capitals' || shapeData.type === 'wissen';
  const platformColor = isBrainLike ? NEUTRAL_PLATFORM_COLOR : color;

  /* ── CAPITALS: show country name as center stimulus ── */
  if (shapeData.type === 'capitals') {
    let span = center.firstChild;
    if (!span || span.tagName !== 'SPAN') {
      center.innerHTML = '';
      span = document.createElement('span');
      center.appendChild(span);
    }
    span.className = 'center-text capitals-display';
    span.textContent = shapeData.display;
    center.className = 'center-shape pop-in spawn-pop';
    if (shapeData.bonus) center.classList.add(`bonus-${shapeData.bonus}`);
    if (platform) { applyPlatformColor(platform, platformColor); platform.classList.add('platform-active'); }
    if (!inRush) spawnBurstParticles(platformColor);
    return;
  }

  /* ── WISSEN: show question as center stimulus ── */
  if (shapeData.type === 'wissen') {
    let span = center.firstChild;
    if (!span || span.tagName !== 'SPAN') {
      center.innerHTML = '';
      span = document.createElement('span');
      center.appendChild(span);
    }
    span.className = 'center-text wissen-display';
    span.textContent = shapeData.display;
    center.className = 'center-shape pop-in spawn-pop';
    if (shapeData.bonus) center.classList.add(`bonus-${shapeData.bonus}`);
    if (platform) { applyPlatformColor(platform, platformColor); platform.classList.add('platform-active'); }
    if (!inRush) spawnBurstParticles(platformColor);
    return;
  }

  if (shapeData.type === 'math' || shapeData.type === 'word') {
    const cls = shapeData.type === 'math' ? 'math-eq' : 'word-display';
    /* Reuse existing span if possible instead of innerHTML parse */
    let span = center.firstChild;
    if (!span || span.tagName !== 'SPAN') {
      center.innerHTML = '';
      span = document.createElement('span');
      center.appendChild(span);
    }
    span.className = `center-text ${cls}`;
    span.textContent = shapeData.display;
    if (shapeData.type === 'word' && shapeData.textColor) {
      span.style.color = shapeData.textColor;
    } else {
      span.style.color = '';
    }

    center.className = 'center-shape pop-in spawn-pop';
    if (shapeData.bonus) center.classList.add(`bonus-${shapeData.bonus}`);
    if (platform) {
      applyPlatformColor(platform, platformColor);
      platform.classList.add('platform-active');
    }
    /* Skip burst particles during rush — they pile up and cause DOM pressure */
    if (!inRush) spawnBurstParticles(platformColor);
    return;
  }

  /* ── STROOP: show color-name word drawn in the ink color ── */
  if (shapeData.type === 'stroop') {
    center.innerHTML = '';
    const span = document.createElement('span');
    span.className = 'center-text stroop-display';
    span.textContent = shapeData.display;
    span.style.color = shapeData.inkColor;
    center.appendChild(span);
    center.className = 'center-shape pop-in spawn-pop';
    if (shapeData.bonus) center.classList.add(`bonus-${shapeData.bonus}`);
    if (platform) { applyPlatformColor(platform, platformColor); platform.classList.add('platform-active'); }
    if (!inRush) spawnBurstParticles(platformColor);
    return;
  }

  /* ── FOKUS: show flanker row with highlighted center arrow ── */
  if (shapeData.type === 'fokus') {
    center.innerHTML = '';
    const row = document.createElement('span');
    row.className = 'center-text fokus-display';
    const half = Math.floor((shapeData.flankers || []).length / 2);
    const leftFlankers = (shapeData.flankers || []).slice(0, half);
    const rightFlankers = (shapeData.flankers || []).slice(half);
    let html = '';
    leftFlankers.forEach(f => { html += `<span class="fokus-flanker">${f}</span>`; });
    html += `<span class="fokus-center">${shapeData.display}</span>`;
    rightFlankers.forEach(f => { html += `<span class="fokus-flanker">${f}</span>`; });
    row.innerHTML = html;
    center.appendChild(row);
    center.className = 'center-shape pop-in spawn-pop';
    if (shapeData.bonus) center.classList.add(`bonus-${shapeData.bonus}`);
    if (platform) { applyPlatformColor(platform, platformColor); platform.classList.add('platform-active'); }
    if (!inRush) spawnBurstParticles(platformColor);
    return;
  }

  /* ── CHAOS: show stimulus shape with color & size, plus rule banner ── */
  if (shapeData.type === 'chaos') {
    center.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'chaos-stimulus';
    const shapeMap = { circle: '●', square: '■', triangle: '▲', star: '★' };
    const sizeMap = { tiny: '1.0rem', small: '1.8rem', medium: '3.0rem', large: '4.2rem' };
    const sym = document.createElement('span');
    sym.className = 'chaos-shape';
    sym.textContent = shapeMap[shapeData.display] || shapeData.display;
    sym.style.color = shapeData.stimColor;
    sym.style.fontSize = sizeMap[shapeData.stimSize] || '2.4rem';
    wrap.appendChild(sym);
    /* Rule indicator — emoji + text label, color-coded by dimension */
    const rule = document.createElement('span');
    rule.className = 'chaos-rule-badge';
    const ruleLabels = { color: '🎨', shape: '🔷', size: '📏' };
    const ruleColors = { color: '#EF4444', shape: '#3B82F6', size: '#10B981' };
    rule.textContent = `${ruleLabels[shapeData.chaosRule] || ''} ${t('chaos_rule_' + shapeData.chaosRule) || shapeData.chaosRule.toUpperCase()}`;
    rule.style.borderColor = ruleColors[shapeData.chaosRule] || 'rgba(255,255,255,0.1)';
    rule.style.color = ruleColors[shapeData.chaosRule] || 'rgba(255,255,255,0.6)';
    wrap.appendChild(rule);
    center.appendChild(wrap);
    center.className = 'center-shape pop-in spawn-pop';
    if (shapeData.bonus) center.classList.add(`bonus-${shapeData.bonus}`);
    if (platform) { applyPlatformColor(platform, platformColor); platform.classList.add('platform-active'); }
    if (!inRush) spawnBurstParticles(platformColor);
    return;
  }

  const size = shapeData.bonus === 'diamond' ? 100 : shapeData.bonus === 'golden' ? 95 : 90;
  /* Use cached SVG clone instead of innerHTML parse */
  center.textContent = '';
  center.appendChild(getCachedSVGNode(shapeData.shape, color, size, shapeData.bonus));
  center.className = 'center-shape pop-in spawn-pop';
  if (shapeData.bonus) center.classList.add(`bonus-${shapeData.bonus}`);
  if (platform) {
    applyPlatformColor(platform, color);
    platform.classList.add('platform-active');
  }
  /* Skip burst particles during rush — they pile up and cause DOM pressure */
  if (!inRush) spawnBurstParticles(color);
}

/* Particle pool for spawn burst — avoids creating/removing DOM nodes every spawn */
const _spawnPool = [];
const _POOL_SIZE = 6;
let _poolInited = false;

function _initPool() {
  if (_poolInited) return;
  _poolInited = true;
  const gameEl = $('#game');
  if (!gameEl) return;
  for (let i = 0; i < _POOL_SIZE; i++) {
    const p = document.createElement('div');
    p.className = 'spawn-particle';
    p.style.display = 'none';
    gameEl.appendChild(p);
    _spawnPool.push(p);
  }
}

function spawnBurstParticles(color) {
  if (app.save.getSetting('reducedMotion')) return;
  /* Skip during rush — rapid spawns pile up particles */
  if (app.game.inRush) return;
  const platform = $('#centerPlatform');
  if (!platform) return;
  _initPool();
  if (!_spawnPool.length) return;

  const rect = platform.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  /* Batch all style writes, then trigger ONE reflow, then add class */
  for (let i = 0; i < _spawnPool.length; i++) {
    const p = _spawnPool[i];
    const angle = (i / _spawnPool.length) * Math.PI * 2;
    const dist = 20 + Math.random() * 15;
    p.style.cssText = `left:${cx}px;top:${cy}px;width:4px;height:4px;background:${color};--dx:${Math.cos(angle)*dist}px;--dy:${Math.sin(angle)*dist}px;`;
    p.style.display = '';
    p.classList.remove('spawn-particle');
  }
  /* Single forced reflow for the whole batch */
  _spawnPool[0].offsetWidth;
  for (let i = 0; i < _spawnPool.length; i++) {
    const p = _spawnPool[i];
    p.classList.add('spawn-particle');
  }
  /* Single timeout for cleanup */
  setTimeout(() => {
    for (let i = 0; i < _spawnPool.length; i++) _spawnPool[i].style.display = 'none';
  }, 500);
}

export function clearCenter() {
  const center = $('#centerShape');
  const platform = $('#centerPlatform');
  if (center) { center.textContent = ''; center.className = 'center-shape'; }
  if (platform) {
    /* Skip resetting platform styles — they'll be overwritten on next spawn.
       Only remove the active class so CSS transitions reset properly. */
    platform.classList.remove('platform-active');
  }
}

/* ═══════ HUD updates — cached element refs ═══════ */
let _hudCache = null;
const TEXT_HEAVY_MODES = new Set(['mathe', 'worte', 'hauptstaedte', 'algebra', 'wissen']);

function isTextHeavyMode(mode = app.selectedMode) {
  return TEXT_HEAVY_MODES.has(mode);
}

function getUrgencyThresholds() {
  if (isTextHeavyMode()) {
    return { urgent: 6, critical: 3, danger: 3, audio: 5, tension: 0 };
  }
  return { urgent: 10, critical: 5, danger: 10, audio: 10, tension: 10 };
}

function _getHudEls() {
  if (!_hudCache) {
    _hudCache = {
      score: $('#hudScore'),
      mult: $('#hudMultiplier'),
      streak: $('#hudStreak'),
      timer: $('#hudTimer'),
      fever: $('#hudFever'),
      timerFill: $('#timerBarFill'),
      game: $('#game'),
    };
  }
  return _hudCache;
}
/** Call when leaving game screen to drop cached refs */
export function invalidateHudCache() { _hudCache = null; }

function updateIntensity() {
  const { game } = app;
  const g = _getHudEls().game;
  if (!g) return;
  const textHeavy = isTextHeavyMode();
  g.classList.remove('intensity-low','intensity-mid','intensity-high','intensity-max',
                       'edge-glow-warm','edge-glow-hot','edge-glow-fire',
                       'action-climax','action-climax-peak');
  if (game.feverActive) {
    if (textHeavy) g.classList.add('intensity-mid');
    else g.classList.add('intensity-max','edge-glow-fire');
  } else if (game.streak >= 30) {
    if (textHeavy) g.classList.add('intensity-mid');
    else g.classList.add('intensity-high','edge-glow-fire');
  } else if (game.streak >= 20) {
    if (textHeavy) g.classList.add('intensity-low');
    else g.classList.add('intensity-high','edge-glow-hot');
  } else if (game.streak >= 10) {
    g.classList.add('intensity-mid','edge-glow-warm');
  } else if (game.streak >= 5) {
    g.classList.add('intensity-low');
  }

  if (!textHeavy && !game.practice && game.playType !== 'endless' && game.timer > 0) {
    if (game.timer <= 8) g.classList.add('action-climax');
    if (game.timer <= 3) g.classList.add('action-climax-peak');
  }
}

function updateTimerBar() {
  const { game } = app;
  const fill = _getHudEls().timerFill;
  if (!fill) return;
  if (game.practice || game.playType === 'endless' || app.gameDuration <= 0) {
    fill.style.transform = 'scaleX(0)';
    return;
  }
  const ratio = Math.min(1, Math.max(0, game.timer / app.gameDuration));
  fill.style.transform = `scaleX(${ratio})`;
  fill.classList.remove('urgent','critical');
  const thresholds = getUrgencyThresholds();
  if (game.timer <= thresholds.critical) fill.classList.add('critical');
  else if (game.timer <= thresholds.urgent) fill.classList.add('urgent');
}

let _hudRafPending = false;

export function updateHUD() {
  if (_hudRafPending) return;
  _hudRafPending = true;
  requestAnimationFrame(_updateHUDInner);
}

function _updateHUDInner() {
  _hudRafPending = false;
  const { game } = app;
  const hud = _getHudEls();

  const scoreEl = hud.score;
  if (scoreEl) {
    const newScore = String(game.score);
    if (scoreEl.textContent !== newScore) {
      scoreEl.textContent = newScore;
      scoreEl.classList.add('value-changed');
      clearTimeout(scoreEl._popTimer);
      scoreEl._popTimer = setTimeout(() => scoreEl.classList.remove('value-changed'), 350);
    }
  }

  const multEl = hud.mult;
  if (multEl) {
    const prev = multEl.textContent;
    multEl.textContent = `x${game.multiplier}`;
    multEl.className = 'hud-multiplier';
    if (game.multiplier >= 8) multEl.classList.add('mult-ultra');
    else if (game.multiplier >= 6) multEl.classList.add('mult-high');
    else if (game.multiplier >= 3) multEl.classList.add('mult-mid');
    if (prev !== `x${game.multiplier}`) {
      multEl.classList.add('value-changed');
      setTimeout(() => multEl.classList.remove('value-changed'), 350);
    }
  }

  const streakEl = hud.streak;
  if (streakEl) {
    streakEl.textContent = game.streak;
    streakEl.classList.toggle('on-fire', game.streak >= 10);
  }

  const timerEl = hud.timer;
  if (timerEl) {
    const thresholds = getUrgencyThresholds();
    if (game.playType === 'endless') {
      const min = Math.floor(game.elapsed / 60);
      const sec = game.elapsed % 60;
      timerEl.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
      timerEl.classList.remove('timer-urgent', 'timer-critical');
    } else if (game.practice) {
      timerEl.style.visibility = 'hidden';
    } else {
      timerEl.textContent = game.timer;
      timerEl.classList.toggle('timer-urgent', game.timer <= thresholds.urgent);
      timerEl.classList.toggle('timer-critical', game.timer <= thresholds.critical);
    }
  }

  const feverEl = hud.fever;
  if (feverEl) feverEl.classList.toggle('active', game.feverActive);

  updateTimerBar();
  updateIntensity();
}

function updateEndlessLives() {
  const { game } = app;
  const container = $('#hudEndlessLives');
  if (!container) return;
  const hearts = container.querySelectorAll('.endless-heart');
  hearts.forEach((h, i) => {
    if (i < game.endlessLives) { h.style.opacity = '1'; h.style.transform = ''; }
    else { h.style.opacity = '0.2'; h.style.transform = 'scale(0.6)'; }
  });
}

function checkPBProximity() {
  const { game, save, audio } = app;
  const pb = save.getPB(app.selectedMode);
  if (pb > 0 && game.score > 0) {
    const diff = pb - game.score;
    if (diff > 0 && diff <= 500) {
      setText('#pbProximity', t('pb_close', { n: diff }));
      $('#pbProximity')?.classList.add('visible');
      if (diff <= 100) audio.nearPB();
    } else if (diff <= 0) {
      setText('#pbProximity', t('new_pb'));
      $('#pbProximity')?.classList.add('visible', 'new-pb');
    } else {
      $('#pbProximity')?.classList.remove('visible', 'new-pb');
    }
  }
}

function showNearMiss(correctDir) {
  const corner = $(`.corner-shape[data-dir="${correctDir}"]`);
  if (!corner) return;
  corner.classList.remove('near-miss-hint');
  requestAnimationFrame(() => { corner.classList.add('near-miss-hint'); });
  setTimeout(() => corner.classList.remove('near-miss-hint'), 600);

  /* Briefly enlarge the correct corner text so player sees the right answer */
  const textEl = corner.querySelector('.corner-text');
  if (textEl) {
    textEl.classList.add('correct-flash');
    setTimeout(() => textEl.classList.remove('correct-flash'), 400);
  }
}

/* ═══════ Corner score pop — pooled ═══════ */
const _cornerPopPool = [];
const _CORNER_POP_POOL = 4;
let _cornerPopInited = false;

function _initCornerPopPool() {
  if (_cornerPopInited) return;
  _cornerPopInited = true;
  const gameEl = document.getElementById('game');
  if (!gameEl) return;
  for (let i = 0; i < _CORNER_POP_POOL; i++) {
    const el = document.createElement('div');
    el.className = 'corner-score-pop';
    el.style.display = 'none';
    gameEl.appendChild(el);
    _cornerPopPool.push(el);
  }
}

let _cornerPopIdx = 0;
function cornerScorePop(dir, text) {
  const corner = $(`.corner-shape[data-dir="${dir}"]`);
  if (!corner) return;

  _initCornerPopPool();
  if (!_cornerPopPool.length) return;

  const el = _cornerPopPool[_cornerPopIdx % _CORNER_POP_POOL];
  _cornerPopIdx++;

  const r = corner.getBoundingClientRect();
  el.textContent = text;
  el.style.left = (r.left + r.width / 2) + 'px';
  el.style.top = r.top + 'px';
  el.style.display = '';
  el.classList.remove('corner-score-pop');
  /* Use rAF instead of forced reflow for re-trigger */
  requestAnimationFrame(() => {
    el.classList.add('corner-score-pop');
  });
  setTimeout(() => { el.style.display = 'none'; }, 700);
}

/* ═══════ Pre-game Mode Instruction overlay ═══════ */
function _showModeInstruction(mode, onDone) {
  const overlay = $('#modeInstructionOverlay');
  if (!overlay) { onDone(); return; }
  const icons = { mathe:'🧮', worte:'📝', memo:'🧠', sequenz:'🔔', stroop:'🎨', fokus:'🎯', chaos:'🌀', hauptstaedte:'🌍', algebra:'📐', wissen:'💡' };
  const iconEl = $('#modeInstructionIcon');
  const titleEl = $('#modeInstructionTitle');
  const textEl = $('#modeInstructionText');
  if (iconEl) iconEl.textContent = icons[mode] || '💡';
  if (titleEl) titleEl.textContent = t(`mode_${mode}`) || mode.toUpperCase();
  if (textEl) textEl.textContent = t(`instr_${mode}`) || '';
  overlay.classList.add('active');
  const btn = $('#btnStartAfterInstruction');
  const handleStart = () => {
    btn?.removeEventListener('click', handleStart);
    overlay.classList.remove('active');
    setTimeout(onDone, 200);
  };
  btn?.addEventListener('click', handleStart);
}

/* ═══════ Countdown overlay ═══════ */
export function doCountdown(cb) {
  const { audio } = app;
  const overlay = $('#countdownOverlay');
  if (!overlay) { cb(); return; }
  overlay.classList.add('active');
  let n = 3;
  const numEl0 = $('#countdownNum');
  if (numEl0) numEl0.setAttribute('data-n', n);
  setText('#countdownNum', n);
  audio.countdown(n);
  haptic('countdown', app.save);

  const tick = () => {
    n--;
    if (n > 0) {
      const numEl = $('#countdownNum');
      if (numEl) { numEl.setAttribute('data-n', n); numEl.style.animation = 'none'; void numEl.offsetWidth; numEl.style.animation = ''; }
      setText('#countdownNum', n);
      audio.countdown(n);
      setTimeout(tick, 800);
    } else {
      const numEl = $('#countdownNum');
      if (numEl) { numEl.classList.add('cd-go'); numEl.style.animation = 'none'; void numEl.offsetWidth; numEl.style.animation = ''; }
      setText('#countdownNum', t('countdown_go'));
      audio.countdown(0);
      setTimeout(() => { overlay.classList.remove('active'); const el = $('#countdownNum'); if (el) { el.classList.remove('cd-go'); el.removeAttribute('data-n'); } cb(); }, 500);
    }
  };
  setTimeout(tick, 800);
}

/* ═══════ Cleanup intensity classes ═══════ */
/* ═══════ Klassik Mode Mastery — In-Game HUD Helpers ═══════ */
let _speedZoneTimeout = null;
let _colorComboId = 0;

function ensureKlassikHUD() {
  const gameEl = $('#game');
  if (!gameEl) return;

  if (!$('#speedZoneIndicator')) {
    const el = document.createElement('div');
    el.id = 'speedZoneIndicator';
    el.className = 'speed-zone-indicator';
    gameEl.appendChild(el);
  }
  if (!$('#ghostRacer')) {
    const el = document.createElement('div');
    el.id = 'ghostRacer';
    el.className = 'ghost-racer';
    el.innerHTML = '<div class="ghost-racer-fill" id="ghostRacerFill"></div><span class="ghost-racer-label" id="ghostRacerLabel"></span>';
    gameEl.appendChild(el);
  }
  if (!$('#flawlessCounter')) {
    const el = document.createElement('div');
    el.id = 'flawlessCounter';
    el.className = 'flawless-counter';
    gameEl.appendChild(el);
  }
  if (!$('#zenOverlay')) {
    const el = document.createElement('div');
    el.id = 'zenOverlay';
    el.className = 'zen-state-overlay';
    gameEl.appendChild(el);
  }
}

function updateSpeedZoneIndicator(zone, reaction) {
  ensureKlassikHUD();
  const el = $('#speedZoneIndicator');
  if (!el) return;

  clearTimeout(_speedZoneTimeout);
  if (!zone) {
    el.classList.remove('active');
    return;
  }

  const zones = CONFIG.KLASSIK_SPEED_ZONES || [];
  const zoneInfo = zones.find(z => z.id === zone);
  if (!zoneInfo) return;

  const lang = getLanguage();
  el.textContent = `${zoneInfo[`label_${lang}`] || zoneInfo.label_en} ${reaction}ms`;
  el.dataset.zone = zone;
  el.classList.add('active');

  _speedZoneTimeout = setTimeout(() => el.classList.remove('active'), 1200);
}

function updateSpeedGlow(zone) {
  const gameArea = $('#game');
  if (!gameArea) return;
  gameArea.classList.remove('speed-glow-ultra', 'speed-glow-fast', 'speed-glow-good');
  if (zone === 'ultra') gameArea.classList.add('speed-glow-ultra');
  else if (zone === 'fast') gameArea.classList.add('speed-glow-fast');
  else if (zone === 'good') gameArea.classList.add('speed-glow-good');
}

function updateGhostRacer(game) {
  ensureKlassikHUD();
  const container = $('#ghostRacer');
  const fill = $('#ghostRacerFill');
  const label = $('#ghostRacerLabel');
  if (!container || !fill || !label || !app.mastery) return;

  const delta = getGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta == null) {
    container.classList.remove('visible');
    return;
  }

  container.classList.add('visible');
  const isAhead = delta >= 0;
  fill.className = 'ghost-racer-fill ' + (isAhead ? 'ahead' : 'behind');
  /* Width: scale delta to 0-100% (max meaningful delta ~2000pts) */
  const pct = Math.min(100, Math.abs(delta) / 20);
  fill.style.width = (50 + (isAhead ? pct / 2 : -pct / 2)) + '%';

  const lang = getLanguage();
  const sign = isAhead ? '+' : '';
  label.textContent = `${sign}${delta} ${lang === 'de' ? 'vs PB' : 'vs PB'}`;
  label.style.color = isAhead ? '#2ED573' : '#FF4757';
}

function updateFlawlessCounter(mastery) {
  ensureKlassikHUD();
  const el = $('#flawlessCounter');
  if (!el) return;
  const current = mastery.get('klassik', 'currentFlawless');
  const best = mastery.get('klassik', 'bestFlawless');
  if (current > 0) {
    const lang = getLanguage();
    el.textContent = `${lang === 'de' ? 'Fehlerfrei' : 'Flawless'}: ${current}${best > 0 ? ` / ${best}` : ''}`;
    el.classList.add('active');
  } else {
    el.classList.remove('active');
  }
}

function showColorComboPop(combo) {
  const gameEl = $('#game');
  if (!gameEl) return;
  const id = ++_colorComboId;
  const el = document.createElement('div');
  el.className = 'color-combo-pop';
  const lang = getLanguage();
  el.textContent = `${lang === 'de' ? 'FARB-LAUF' : 'COLOR RUN'} x${combo}!`;
  gameEl.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 700);
}

function updateZenState(streak) {
  const el = $('#zenOverlay');
  if (!el) return;
  const threshold = CONFIG.KLASSIK_ZEN_STREAK || 50;
  el.classList.toggle('active', streak >= threshold);
}

function cleanupKlassikHUD() {
  ['speedZoneIndicator', 'ghostRacer', 'flawlessCounter', 'zenOverlay'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
  document.querySelectorAll('.color-combo-pop').forEach(el => el.remove());
  const gameEl = $('#game');
  if (gameEl) gameEl.classList.remove('speed-glow-ultra', 'speed-glow-fast', 'speed-glow-good');
  clearTimeout(_speedZoneTimeout);
}

/* ═══════ Formen (Beginner) Mode Mastery — In-Game HUD Helpers ═══════ */

function ensureFormenHUD() {
  const gameEl = $('#game');
  if (!gameEl) return;

  if (!$('#flowMeter')) {
    const el = document.createElement('div');
    el.id = 'flowMeter';
    el.className = 'flow-meter';
    el.innerHTML = '<div class="flow-meter-fill" id="flowMeterFill"></div><span class="flow-meter-label" id="flowMeterLabel">FLOW</span>';
    gameEl.appendChild(el);
  }
  if (!$('#formenGhostRacer')) {
    const el = document.createElement('div');
    el.id = 'formenGhostRacer';
    el.className = 'ghost-racer';
    el.innerHTML = '<div class="ghost-racer-fill" id="formenGhostFill"></div><span class="ghost-racer-label" id="formenGhostLabel"></span>';
    gameEl.appendChild(el);
  }
}

function updateFlowMeter(flowStreak) {
  ensureFormenHUD();
  const container = $('#flowMeter');
  const fill = $('#flowMeterFill');
  if (!container || !fill) return;

  const minStreak = CONFIG.BEGINNER_FLOW_MIN_STREAK || 3;
  const maxStreak = CONFIG.BEGINNER_FLOW_MAX || 20;

  if (flowStreak >= minStreak) {
    container.classList.add('active', 'in-flow');
    const pct = Math.min(100, ((flowStreak - minStreak + 1) / (maxStreak - minStreak + 1)) * 100);
    fill.style.height = pct + '%';
  } else if (flowStreak > 0) {
    container.classList.add('active');
    container.classList.remove('in-flow');
    const pct = (flowStreak / minStreak) * 30; // partial fill before activation
    fill.style.height = pct + '%';
  } else {
    container.classList.remove('active', 'in-flow');
    fill.style.height = '0%';
  }
}

function updateFormenGhostRacer(game) {
  ensureFormenHUD();
  const container = $('#formenGhostRacer');
  const fill = $('#formenGhostFill');
  const label = $('#formenGhostLabel');
  if (!container || !fill || !label || !app.mastery) return;

  const delta = getFormenGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta == null) {
    container.classList.remove('visible');
    return;
  }

  container.classList.add('visible');
  const isAhead = delta >= 0;
  fill.className = 'ghost-racer-fill ' + (isAhead ? 'ahead' : 'behind');
  const pct = Math.min(100, Math.abs(delta) / 20);
  fill.style.width = (50 + (isAhead ? pct / 2 : -pct / 2)) + '%';

  const lang = getLanguage();
  const sign = isAhead ? '+' : '';
  label.textContent = `${sign}${delta} vs PB`;
  label.style.color = isAhead ? '#2ED573' : '#FF4757';
}

function showShapeChainPop(chain, shapeName) {
  const gameEl = $('#game');
  if (!gameEl) return;
  const el = document.createElement('div');
  el.className = 'shape-chain-pop';
  const lang = getLanguage();
  const nameMap = { circle: lang === 'de' ? 'Kreis' : 'Circle', square: lang === 'de' ? 'Quadrat' : 'Square', triangle: lang === 'de' ? 'Dreieck' : 'Triangle', star: lang === 'de' ? 'Stern' : 'Star' };
  el.textContent = `${nameMap[shapeName] || shapeName} x${chain}!`;
  gameEl.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 700);
}

function showJackpotPop() {
  const gameEl = $('#game');
  if (!gameEl) return;
  const el = document.createElement('div');
  el.className = 'jackpot-pop';
  el.textContent = 'JACKPOT!';
  gameEl.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 900);
}

function cleanupFormenHUD() {
  ['flowMeter', 'formenGhostRacer'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
  document.querySelectorAll('.shape-chain-pop, .jackpot-pop').forEach(el => el.remove());
}

/* ═══════ Expert HUD helpers ═══════ */

const COMPASS_DIR_ANGLES = {
  up: 0, ur: 45, right: 90, dr: 135,
  down: 180, dl: 225, left: 270, ul: 315
};

function ensureExpertHUD() {
  const gameEl = $('#game');
  if (!gameEl) return;

  /* Compass ring */
  if (!$('#expertCompassRing')) {
    const ring = document.createElement('div');
    ring.id = 'expertCompassRing';
    ring.className = 'expert-compass-ring';
    ring.innerHTML = Object.entries(COMPASS_DIR_ANGLES).map(([dir, angle]) =>
      `<div class="compass-dir" data-dir="${dir}" style="--angle:${angle}deg">
        <span class="compass-star-count">0</span>
      </div>`
    ).join('');
    gameEl.appendChild(ring);
  }

  /* Ghost racer */
  if (!$('#expertGhostRacer')) {
    const ghost = document.createElement('div');
    ghost.id = 'expertGhostRacer';
    ghost.className = 'ghost-racer';
    ghost.innerHTML = '<div class="ghost-racer-fill"></div><span class="ghost-racer-delta"></span>';
    gameEl.appendChild(ghost);
  }
}

function updateCompassRing(mastery) {
  const ring = $('#expertCompassRing');
  if (!ring) return;
  const dirs = ['ul','ur','dl','dr','up','down','left','right'];
  for (const dir of dirs) {
    const el = ring.querySelector(`[data-dir="${dir}"]`);
    if (!el) continue;
    const stars = mastery.mapGet('expert', 'dirStars', dir, 0);
    const countEl = el.querySelector('.compass-star-count');
    if (countEl) countEl.textContent = stars > 0 ? '\u2605'.repeat(Math.min(stars, 5)) : '\u00B7';
    el.dataset.stars = stars;
  }
}

function updateExpertGhostRacer(game) {
  const el = $('#expertGhostRacer');
  if (!el || !app.mastery) return;
  const delta = getExpertGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta === null) { el.style.opacity = '0'; return; }
  el.style.opacity = '1';
  const fill = el.querySelector('.ghost-racer-fill');
  const deltaEl = el.querySelector('.ghost-racer-delta');
  const pct = Math.min(100, Math.max(0, 50 + delta * 2));
  if (fill) fill.style.width = pct + '%';
  if (deltaEl) {
    deltaEl.textContent = (delta >= 0 ? '+' : '') + delta;
    deltaEl.className = 'ghost-racer-delta ' + (delta >= 0 ? 'ahead' : 'behind');
  }
}

function showFullCompassPop() {
  const gameEl = $('#game');
  if (!gameEl) return;
  const pop = document.createElement('div');
  pop.className = 'full-compass-pop';
  pop.textContent = 'FULL COMPASS!';
  gameEl.appendChild(pop);
  setTimeout(() => pop.remove(), 1200);
}

function updateWeakSpotIndicator(mastery, game) {
  const weakDir = getWeakestDirection(mastery);
  if (!weakDir) return;
  /* Highlight the weak corner with a subtle pulse */
  const corner = document.querySelector(`.corner-shape[data-dir="${weakDir}"]`);
  if (corner && !corner.classList.contains('weak-spot-pulse')) {
    /* Remove from all others first */
    document.querySelectorAll('.corner-shape.weak-spot-pulse').forEach(el =>
      el.classList.remove('weak-spot-pulse')
    );
    corner.classList.add('weak-spot-pulse');
  }
}

function cleanupExpertHUD() {
  ['expertCompassRing', 'expertGhostRacer'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
  document.querySelectorAll('.full-compass-pop').forEach(el => el.remove());
  document.querySelectorAll('.corner-shape.weak-spot-pulse').forEach(el =>
    el.classList.remove('weak-spot-pulse')
  );
}

/* ═══════ Ultra HUD Helpers (12-Direction) ═══════ */

const ULTRA_DIR_ANGLES = {
  up: 0, nnw: 330, ul: 300, left: 270, wsw: 240, dl: 210,
  down: 180, sse: 150, dr: 120, right: 90, ene: 60, ur: 30
};

function ensureUltraHUD() {
  const gameEl = $('#game');
  if (!gameEl) return;

  /* 12-point compass grid */
  if (!$('#ultraCompassGrid')) {
    const grid = document.createElement('div');
    grid.id = 'ultraCompassGrid';
    grid.className = 'ultra-compass-grid';
    grid.innerHTML = Object.entries(ULTRA_DIR_ANGLES).map(([dir, angle]) =>
      `<div class="ultra-dir" data-dir="${dir}" style="--angle:${angle}deg">
        <span class="ultra-star-count">0</span>
      </div>`
    ).join('');
    gameEl.appendChild(grid);
  }

  /* Ghost racer */
  if (!$('#ultraGhostRacer')) {
    const ghost = document.createElement('div');
    ghost.id = 'ultraGhostRacer';
    ghost.className = 'ghost-racer';
    ghost.innerHTML = '<div class="ghost-racer-fill"></div><span class="ghost-racer-delta"></span>';
    gameEl.appendChild(ghost);
  }
}

function updateUltraGrid(mastery) {
  const grid = $('#ultraCompassGrid');
  if (!grid) return;
  const dirs = Object.keys(ULTRA_DIR_ANGLES);
  for (const dir of dirs) {
    const el = grid.querySelector(`[data-dir="${dir}"]`);
    if (!el) continue;
    const stars = mastery.mapGet('ultra', 'dirStars', dir, 0);
    const countEl = el.querySelector('.ultra-star-count');
    if (countEl) countEl.textContent = stars > 0 ? '\u2605'.repeat(Math.min(stars, 5)) : '\u00B7';
    el.dataset.stars = stars;
  }
}

function updateUltraGhostRacer(game) {
  const el = $('#ultraGhostRacer');
  if (!el || !app.mastery) return;
  const delta = getUltraGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta === null) { el.style.opacity = '0'; return; }
  el.style.opacity = '1';
  const fill = el.querySelector('.ghost-racer-fill');
  const deltaEl = el.querySelector('.ghost-racer-delta');
  const pct = Math.min(100, Math.max(0, 50 + delta * 2));
  if (fill) fill.style.width = pct + '%';
  if (deltaEl) {
    deltaEl.textContent = (delta >= 0 ? '+' : '') + delta;
    deltaEl.className = 'ghost-racer-delta ' + (delta >= 0 ? 'ahead' : 'behind');
  }
}

function showUltraFullCompassPop() {
  const gameEl = $('#game');
  if (!gameEl) return;
  const pop = document.createElement('div');
  pop.className = 'ultra-full-compass-pop';
  pop.textContent = 'FULL COMPASS XII!';
  gameEl.appendChild(pop);
  setTimeout(() => pop.remove(), 1400);
}

function updateUltraWeakSpot(mastery, game) {
  const weakDir = getWeakestUltraDirection(mastery);
  if (!weakDir) return;
  const corner = document.querySelector(`.corner-shape[data-dir="${weakDir}"]`);
  if (corner && !corner.classList.contains('weak-spot-pulse')) {
    document.querySelectorAll('.corner-shape.weak-spot-pulse').forEach(el =>
      el.classList.remove('weak-spot-pulse')
    );
    corner.classList.add('weak-spot-pulse');
  }
}

function cleanupUltraHUD() {
  ['ultraCompassGrid', 'ultraGhostRacer'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
  document.querySelectorAll('.ultra-full-compass-pop').forEach(el => el.remove());
  document.querySelectorAll('.corner-shape.weak-spot-pulse').forEach(el =>
    el.classList.remove('weak-spot-pulse')
  );
}

/* ═══════════════════════════════════════════════
   MATHE HUD helpers — Operation bar + phase pop
   ═══════════════════════════════════════════════ */

const MATHE_OPS = ['+', '\u2212', '\u00D7', '\u00F7'];
const MATHE_OP_LABELS = { '+': '+', '\u2212': '\u2212', '\u00D7': '\u00D7', '\u00F7': '\u00F7' };

function ensureMatheHUD() {
  if ($('#matheOpBar')) return;
  const bar = document.createElement('div');
  bar.id = 'matheOpBar';
  bar.className = 'mathe-op-bar';
  for (const op of MATHE_OPS) {
    const seg = document.createElement('div');
    seg.className = 'mathe-op-seg';
    seg.dataset.op = op;
    seg.innerHTML = `<span class="mathe-op-label">${MATHE_OP_LABELS[op]}</span><span class="mathe-op-count">0</span>`;
    bar.appendChild(seg);
  }
  $('#game')?.appendChild(bar);

  /* Ghost racer for Mathe */
  const ghost = document.createElement('div');
  ghost.id = 'matheGhostRacer';
  ghost.className = 'mastery-ghost-racer';
  ghost.textContent = '\u{1F47B}';
  ghost.style.display = 'none';
  $('#game')?.appendChild(ghost);
}

function updateMatheOpBar(mastery) {
  const bar = $('#matheOpBar');
  if (!bar) return;
  for (const op of MATHE_OPS) {
    const seg = bar.querySelector(`.mathe-op-seg[data-op="${op}"]`);
    if (!seg) continue;
    const correct = mastery.mapGet('mathe', 'opCorrect', op, 0);
    const total = mastery.mapGet('mathe', 'opTotal', op, 0);
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    seg.querySelector('.mathe-op-count').textContent = `${pct}%`;
    seg.classList.toggle('hot', pct >= 80);
    seg.classList.toggle('warm', pct >= 50 && pct < 80);
    seg.classList.toggle('cool', pct > 0 && pct < 50);
  }
}

function updateMatheGhostRacer(game) {
  const ghost = $('#matheGhostRacer');
  if (!ghost || !app.mastery) return;
  const delta = getMatheGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta === null) { ghost.style.display = 'none'; return; }
  ghost.style.display = '';
  ghost.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
  ghost.className = `mastery-ghost-racer ${delta >= 0 ? 'ghost-ahead' : 'ghost-behind'}`;
}

function showMathePhaseUp(phase) {
  const phaseNames = ['+/\u2212 Easy', '+/\u2212 Medium', '+/\u2212/\u00D7', 'All Ops', 'Advanced', 'Expert', 'Master'];
  const label = phaseNames[phase] || `Phase ${phase}`;
  const pop = document.createElement('div');
  pop.className = 'mathe-phase-pop';
  pop.textContent = `PHASE UP: ${label}`;
  $('#game')?.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
}

function cleanupMatheHUD() {
  ['matheOpBar', 'matheGhostRacer'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
  document.querySelectorAll('.mathe-phase-pop').forEach(el => el.remove());
  app._lastMathePhase = 0;
}

/* ═══════════════════════════════════════════════
   ALGEBRA HUD helpers — Type bar + unlock toast
   ═══════════════════════════════════════════════ */

const ALG_TYPE_LABELS_SHORT = {
  linear_add: 'ax+b', linear_sub: 'ax\u2212b', two_step: 'a(x+b)',
  square: 'x\u00B2', sqrt: '\u221A', power: 'a\u207F', fraction_add: '\u00BD+\u00BD'
};

function ensureAlgebraHUD() {
  if ($('#algebraTypeBar')) return;
  const bar = document.createElement('div');
  bar.id = 'algebraTypeBar';
  bar.className = 'algebra-type-bar';
  const types = ['linear_add', 'linear_sub', 'two_step', 'square', 'sqrt', 'power', 'fraction_add'];
  for (const t of types) {
    const seg = document.createElement('div');
    seg.className = 'algebra-type-seg';
    seg.dataset.type = t;
    seg.innerHTML = `<span class="algebra-type-label">${ALG_TYPE_LABELS_SHORT[t]}</span><span class="algebra-type-pct">-</span>`;
    bar.appendChild(seg);
  }
  $('#game')?.appendChild(bar);

  const ghost = document.createElement('div');
  ghost.id = 'algebraGhostRacer';
  ghost.className = 'mastery-ghost-racer';
  ghost.style.display = 'none';
  $('#game')?.appendChild(ghost);
}

function updateAlgebraTypeBar(mastery) {
  const bar = $('#algebraTypeBar');
  if (!bar) return;
  const types = ['linear_add', 'linear_sub', 'two_step', 'square', 'sqrt', 'power', 'fraction_add'];
  for (const t of types) {
    const seg = bar.querySelector(`.algebra-type-seg[data-type="${t}"]`);
    if (!seg) continue;
    const correct = mastery.mapGet('algebra', 'typeCorrect', t, 0);
    const total = mastery.mapGet('algebra', 'typeTotal', t, 0);
    const unlocked = mastery.getArray('algebra', 'unlockedTypes').includes(t);
    if (!unlocked && total === 0) {
      seg.classList.add('locked');
      seg.querySelector('.algebra-type-pct').textContent = '?';
    } else {
      seg.classList.remove('locked');
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      seg.querySelector('.algebra-type-pct').textContent = `${pct}%`;
      seg.classList.toggle('hot', pct >= 80);
      seg.classList.toggle('warm', pct >= 50 && pct < 80);
      seg.classList.toggle('cool', pct > 0 && pct < 50);
    }
  }
}

function updateAlgebraGhostRacer(game) {
  const ghost = $('#algebraGhostRacer');
  if (!ghost || !app.mastery) return;
  const delta = getAlgebraGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta === null) { ghost.style.display = 'none'; return; }
  ghost.style.display = '';
  ghost.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
  ghost.className = `mastery-ghost-racer ${delta >= 0 ? 'ghost-ahead' : 'ghost-behind'}`;
}

function showAlgebraUnlock(eqType, phase) {
  const label = ALG_TYPE_LABELS_SHORT[eqType] || eqType;
  const pop = document.createElement('div');
  pop.className = 'algebra-unlock-pop';
  pop.textContent = `UNLOCKED: ${label}`;
  $('#game')?.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
}

function cleanupAlgebraHUD() {
  ['algebraTypeBar', 'algebraGhostRacer'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
  document.querySelectorAll('.algebra-unlock-pop').forEach(el => el.remove());
  app._lastAlgPhase = 0;
}

/* ═══════════════════════════════════════════════
   WORTE HUD helpers — Collection counter + new word pop
   ═══════════════════════════════════════════════ */

function ensureWorteHUD() {
  if ($('#worteCollectionHUD')) return;
  const el = document.createElement('div');
  el.id = 'worteCollectionHUD';
  el.className = 'worte-collection-hud';
  el.innerHTML = `<span class="worte-coll-count">0</span><span class="worte-coll-label">collected</span>`;
  $('#game')?.appendChild(el);

  const ghost = document.createElement('div');
  ghost.id = 'worteGhostRacer';
  ghost.className = 'mastery-ghost-racer';
  ghost.style.display = 'none';
  $('#game')?.appendChild(ghost);
}

function updateWorteCollection(mastery) {
  const el = $('#worteCollectionHUD');
  if (!el) return;
  const count = mastery.getArray('worte', 'wordCollection').length;
  const countEl = el.querySelector('.worte-coll-count');
  if (countEl) countEl.textContent = count;
}

function updateWorteGhostRacer(game) {
  const ghost = $('#worteGhostRacer');
  if (!ghost || !app.mastery) return;
  const delta = getWorteGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta === null) { ghost.style.display = 'none'; return; }
  ghost.style.display = '';
  ghost.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
  ghost.className = `mastery-ghost-racer ${delta >= 0 ? 'ghost-ahead' : 'ghost-behind'}`;
}

function showWorteNewWord(word) {
  const pop = document.createElement('div');
  pop.className = 'worte-new-word-pop';
  pop.textContent = `NEW: ${word}`;
  $('#game')?.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
}

function cleanupWorteHUD() {
  ['worteCollectionHUD', 'worteGhostRacer'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
  document.querySelectorAll('.worte-new-word-pop').forEach(el => el.remove());
}

/* ═══════════════════════════════════════════════
   HAUPTSTAEDTE HUD helpers — Country collection + new country pop
   ═══════════════════════════════════════════════ */

function ensureHauptstaedteHUD() {
  if ($('#hauptstaedteHUD')) return;
  const el = document.createElement('div');
  el.id = 'hauptstaedteHUD';
  el.className = 'hauptstaedte-hud';
  /* Add tier display (Plan 8 feature 4) */
  const tierInfo = app.mastery ? app.mastery.getMasteryTier('hauptstaedte') : null;
  const tierLabel = tierInfo?.name || '';
  el.innerHTML = `<span class="haupt-count">0</span><span class="haupt-label">countries</span>${tierLabel ? `<span class="haupt-tier">${tierLabel}</span>` : ''}`;
  $('#game')?.appendChild(el);

  const ghost = document.createElement('div');
  ghost.id = 'hauptstaedteGhostRacer';
  ghost.className = 'mastery-ghost-racer';
  ghost.style.display = 'none';
  $('#game')?.appendChild(ghost);
}

function updateHauptstaedteCountry(mastery) {
  const el = $('#hauptstaedteHUD');
  if (!el) return;
  const count = (mastery.getArray('hauptstaedte', 'countryCollection') || []).length;
  const countEl = el.querySelector('.haupt-count');
  if (countEl) countEl.textContent = count;
}

function updateHauptstaedteGhostRacer(game) {
  const ghost = $('#hauptstaedteGhostRacer');
  if (!ghost || !app.mastery) return;
  const delta = getHauptstaedteGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta === null) { ghost.style.display = 'none'; return; }
  ghost.style.display = '';
  ghost.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
  ghost.className = `mastery-ghost-racer ${delta >= 0 ? 'ghost-ahead' : 'ghost-behind'}`;
}

function showHauptstaedteNewCountry(country) {
  const pop = document.createElement('div');
  pop.className = 'haupt-new-country-pop';
  pop.textContent = `NEW: ${country}`;
  $('#game')?.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
}

function cleanupHauptstaedteHUD() {
  ['hauptstaedteHUD', 'hauptstaedteGhostRacer', 'hauptTier'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
  document.querySelectorAll('.haupt-new-country-pop').forEach(el => el.remove());
}

/* ═══════════════════════════════════════════════
   WISSEN HUD helpers — Topic bar + ghost racer
   ═══════════════════════════════════════════════ */

function ensureWissenHUD() {
  if ($('#wissenHUD')) return;
  const el = document.createElement('div');
  el.id = 'wissenHUD';
  el.className = 'wissen-hud';
  el.innerHTML = `<span class="wissen-iq-live">IQ --</span>`;
  $('#game')?.appendChild(el);

  const ghost = document.createElement('div');
  ghost.id = 'wissenGhostRacer';
  ghost.className = 'mastery-ghost-racer';
  ghost.style.display = 'none';
  $('#game')?.appendChild(ghost);
}

function updateWissenTopicBar(mastery) {
  const el = $('#wissenHUD');
  if (!el) return;
  const correct = mastery.get('wissen', '_sessionCorrect', 0);
  const wrong = mastery.get('wissen', '_sessionWrong', 0);
  const total = correct + wrong;
  const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
  const iqEl = el.querySelector('.wissen-iq-live');
  if (iqEl) iqEl.textContent = `${acc}% acc`;
}

function updateWissenGhostRacer(game) {
  const ghost = $('#wissenGhostRacer');
  if (!ghost || !app.mastery) return;
  const delta = getWissenGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta === null) { ghost.style.display = 'none'; return; }
  ghost.style.display = '';
  ghost.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
  ghost.className = `mastery-ghost-racer ${delta >= 0 ? 'ghost-ahead' : 'ghost-behind'}`;
}

function cleanupWissenHUD() {
  ['wissenHUD', 'wissenGhostRacer', 'wissenDiffReveal', 'wissenTopicStreak'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
}

/* Difficulty Reveal (Plan 9 feature 3) — show question difficulty after answer */
function showWissenDifficultyReveal(tier) {
  let el = $('#wissenDiffReveal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wissenDiffReveal';
    el.className = 'wissen-diff-reveal';
    $('#game')?.appendChild(el);
  }
  const labels = ['Easy', 'Medium', 'Hard', 'Expert', 'Master'];
  const pcts = [85, 62, 38, 23, 8];
  const label = labels[tier] || labels[0];
  const pct = pcts[tier] || pcts[0];
  el.textContent = `${label} — ${pct}%`;
  el.dataset.tier = tier;
  el.classList.add('wissen-diff-show');
  setTimeout(() => el.classList.remove('wissen-diff-show'), 1500);
}

/* Topic Streak popup (Plan 9 feature 4) */
function showWissenTopicStreakPop(streak) {
  let el = $('#wissenTopicStreak');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wissenTopicStreak';
    el.className = 'wissen-topic-streak';
    $('#game')?.appendChild(el);
  }
  el.textContent = `${streak}x Topic!`;
  el.classList.add('pop-in');
  setTimeout(() => el.classList.remove('pop-in'), 1200);
}

/* Challenge Round visual (Plan 12 feature 4) */
function showStroopChallengeRound() {
  let el = $('#stroopChallenge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'stroopChallenge';
    el.className = 'stroop-challenge-round';
    $('#game')?.appendChild(el);
  }
  el.textContent = 'CHALLENGE!';
  el.classList.add('challenge-active');
  const duration = CONFIG.STROOP_CHALLENGE_DURATION || 5000;
  setTimeout(() => {
    el.classList.remove('challenge-active');
    if (app.mastery) app.mastery.set('stroop', '_inChallenge', false);
  }, duration);
}

/* Distraction Intensity display (Plan 13 feature 2) */
function updateFokusDistractionLevel(levelObj) {
  let el = $('#fokusDistLevel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fokusDistLevel';
    el.className = 'fokus-dist-level';
    $('#game')?.appendChild(el);
  }
  const lang = app.state?.lang || 'en';
  const label = levelObj[`label_${lang}`] || levelObj.label_en || `Level ${levelObj.level}`;
  el.textContent = `${label}`;
  el.dataset.level = levelObj.level;
}

/* ═══════════════════════════════════════════════
   MEMO HUD helpers — Memory span display
   ═══════════════════════════════════════════════ */

function ensureMemoHUD() {
  if ($('#memoHUD')) return;
  const el = document.createElement('div');
  el.id = 'memoHUD';
  el.className = 'memo-hud';
  el.innerHTML = `<span class="memo-span-label">Span</span><span class="memo-span-val">0</span>`;
  $('#game')?.appendChild(el);

  const ghost = document.createElement('div');
  ghost.id = 'memoGhostRacer';
  ghost.className = 'mastery-ghost-racer';
  ghost.style.display = 'none';
  $('#game')?.appendChild(ghost);
}

function updateMemoSpan(mastery) {
  const el = $('#memoHUD');
  if (!el) return;
  const span = mastery.get('memo', '_correctSinceReveal', 0);
  const valEl = el.querySelector('.memo-span-val');
  if (valEl) valEl.textContent = span;
}

function updateMemoGhostRacer(game) {
  const ghost = $('#memoGhostRacer');
  if (!ghost || !app.mastery) return;
  const delta = getMemoGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta === null) { ghost.style.display = 'none'; return; }
  ghost.style.display = '';
  ghost.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
  ghost.className = `mastery-ghost-racer ${delta >= 0 ? 'ghost-ahead' : 'ghost-behind'}`;
}

function cleanupMemoHUD() {
  ['memoHUD', 'memoGhostRacer'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
}

/* ═══════════════════════════════════════════════
   SEQUENZ HUD helpers — Record display
   ═══════════════════════════════════════════════ */

function ensureSequenzHUD() {
  if ($('#sequenzHUD')) return;
  const el = document.createElement('div');
  el.id = 'sequenzHUD';
  el.className = 'sequenz-hud';
  el.innerHTML = `<span class="seq-rec-label">Record</span><span class="seq-rec-val">0</span>`;
  $('#game')?.appendChild(el);
}

function updateSequenzRecord(mastery) {
  const el = $('#sequenzHUD');
  if (!el) return;
  const best = mastery.get('sequenz', 'bestSeqLength', 0);
  const curr = mastery.get('sequenz', '_sessionBestLen', 0);
  const valEl = el.querySelector('.seq-rec-val');
  if (valEl) valEl.textContent = Math.max(best, curr);
}

function showSequenzNewRecord(seqLen) {
  const pop = document.createElement('div');
  pop.className = 'sequenz-record-pop';
  pop.textContent = `NEW RECORD: ${seqLen}`;
  $('#game')?.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
}

function cleanupSequenzHUD() {
  const el = $('#sequenzHUD');
  if (el) el.remove();
  document.querySelectorAll('.sequenz-record-pop').forEach(el => el.remove());
}

/* ═══════════════════════════════════════════════
   STROOP HUD helpers — Interference display
   ═══════════════════════════════════════════════ */

function ensureStroopHUD() {
  if ($('#stroopHUD')) return;
  const el = document.createElement('div');
  el.id = 'stroopHUD';
  el.className = 'stroop-hud';
  el.innerHTML = `<span class="stroop-int-label">Interference</span><span class="stroop-int-val">--</span>`;
  $('#game')?.appendChild(el);

  const ghost = document.createElement('div');
  ghost.id = 'stroopGhostRacer';
  ghost.className = 'mastery-ghost-racer';
  ghost.style.display = 'none';
  $('#game')?.appendChild(ghost);
}

function updateStroopInterference(mastery) {
  const el = $('#stroopHUD');
  if (!el) return;
  const congC = mastery.get('stroop', '_congCorrect', 0);
  const congT = mastery.get('stroop', '_congTotal', 0);
  const incC = mastery.get('stroop', '_incongCorrect', 0);
  const incT = mastery.get('stroop', '_incongTotal', 0);
  const congAcc = congT > 0 ? congC / congT : 1;
  const incAcc = incT > 0 ? incC / incT : 1;
  const interference = Math.round(Math.max(0, (congAcc - incAcc) * 100));
  const valEl = el.querySelector('.stroop-int-val');
  if (valEl) valEl.textContent = `${interference}%`;
}

function updateStroopGhostRacer(game) {
  const ghost = $('#stroopGhostRacer');
  if (!ghost || !app.mastery) return;
  const delta = getStroopGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta === null) { ghost.style.display = 'none'; return; }
  ghost.style.display = '';
  ghost.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
  ghost.className = `mastery-ghost-racer ${delta >= 0 ? 'ghost-ahead' : 'ghost-behind'}`;
}

function cleanupStroopHUD() {
  ['stroopHUD', 'stroopGhostRacer', 'stroopChallenge'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
}

/* ═══════════════════════════════════════════════
   FOKUS HUD helpers — Focus split display
   ═══════════════════════════════════════════════ */

function ensureFokusHUD() {
  if ($('#fokusHUD')) return;
  const el = document.createElement('div');
  el.id = 'fokusHUD';
  el.className = 'fokus-hud';
  el.innerHTML = `<span class="fokus-cost-label">Distraction</span><span class="fokus-cost-val">--</span>`;
  $('#game')?.appendChild(el);

  const ghost = document.createElement('div');
  ghost.id = 'fokusGhostRacer';
  ghost.className = 'mastery-ghost-racer';
  ghost.style.display = 'none';
  $('#game')?.appendChild(ghost);
}

function updateFokusSplit(mastery) {
  const el = $('#fokusHUD');
  if (!el) return;
  const congC = mastery.get('fokus', '_congCorrect', 0);
  const congT = mastery.get('fokus', '_congTotal', 0);
  const incC = mastery.get('fokus', '_incongCorrect', 0);
  const incT = mastery.get('fokus', '_incongTotal', 0);
  const congAcc = congT > 0 ? congC / congT : 1;
  const incAcc = incT > 0 ? incC / incT : 1;
  const cost = Math.round(Math.max(0, (congAcc - incAcc) * 100));
  const valEl = el.querySelector('.fokus-cost-val');
  if (valEl) valEl.textContent = `${cost}%`;
}

function updateFokusGhostRacer(game) {
  const ghost = $('#fokusGhostRacer');
  if (!ghost || !app.mastery) return;
  const delta = getFokusGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta === null) { ghost.style.display = 'none'; return; }
  ghost.style.display = '';
  ghost.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
  ghost.className = `mastery-ghost-racer ${delta >= 0 ? 'ghost-ahead' : 'ghost-behind'}`;
}

function cleanupFokusHUD() {
  ['fokusHUD', 'fokusGhostRacer', 'fokusDistLevel'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
}

/* ═══════════════════════════════════════════════
   CHAOS HUD helpers — Rule display + switch counter
   ═══════════════════════════════════════════════ */

function ensureChaosHUD() {
  if ($('#chaosHUD')) return;
  const el = document.createElement('div');
  el.id = 'chaosHUD';
  el.className = 'chaos-hud';
  el.innerHTML = `<span class="chaos-rule-label">Rule</span><span class="chaos-rule-val">--</span><span class="chaos-switch-count">0 switches</span>`;
  $('#game')?.appendChild(el);

  const ghost = document.createElement('div');
  ghost.id = 'chaosGhostRacer';
  ghost.className = 'mastery-ghost-racer';
  ghost.style.display = 'none';
  $('#game')?.appendChild(ghost);
}

function updateChaosRuleDisplay(mastery, game) {
  const el = $('#chaosHUD');
  if (!el) return;
  const rule = game.currentShape?.chaosRule || 'color';
  const ruleEl = el.querySelector('.chaos-rule-val');
  if (ruleEl) ruleEl.textContent = rule.toUpperCase();
  const switchEl = el.querySelector('.chaos-switch-count');
  if (switchEl) switchEl.textContent = `${mastery.get('chaos', '_switchCount', 0)} switches`;
}

function updateChaosGhostRacer(game) {
  const ghost = $('#chaosGhostRacer');
  if (!ghost || !app.mastery) return;
  const delta = getChaosGhostDelta(app.mastery, game.score, game.elapsed);
  if (delta === null) { ghost.style.display = 'none'; return; }
  ghost.style.display = '';
  ghost.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
  ghost.className = `mastery-ghost-racer ${delta >= 0 ? 'ghost-ahead' : 'ghost-behind'}`;
}

function cleanupChaosHUD() {
  ['chaosHUD', 'chaosGhostRacer'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.remove();
  });
}

export function cleanupGameClasses() {
  const g = $('#game');
  g?.classList.remove('intensity-low','intensity-mid','intensity-high','intensity-max','edge-glow-warm','edge-glow-hot','edge-glow-fire');
  /* Remove memo-covered from corners */
  $$('.corner-shape').forEach(el => el.classList.remove('memo-covered', 'memo-revealing'));
  /* Remove mode class from body */
  document.body.className = document.body.className.replace(/\bmode-\w+/g, '').trim();
  invalidateHudCache();
  /* Reset corner diff state so next game does full render */
  for (const k in _prevCornerState) delete _prevCornerState[k];
  _lastPlatformColor = '';
  _svgCache.clear();
}

/* ═══════ Start game ═══════ */
export function startGame(practice = false, daily = false, showTutorial, showResults, showHome, showContinuePrompt) {
  const { save, audio, game } = app;
  if (app.gameStarting) return;
  app.gameStarting = true;
  setTimeout(() => { app.gameStarting = false; }, 1500);

  app.pendingDaily = daily;
  const gameScreen = $('#game');
  if (!gameScreen) return;

  app.swipe?.unbind();
  app.effects?.cleanup();

  app.effects = new EffectsManager(gameScreen);
  app.effects.setReduced(save.getSetting('reducedMotion'));
  if (typeof app.effects.setTrailStyle === 'function') app.effects.setTrailStyle(save.getActiveTrail());

  app.swipe = new SwipeHandler(gameScreen, app.selectedMode);
  app.swipe.bind();

  updateGameAdBanner(save);

  const modeIndicator = $('#modeIndicator');
  if (modeIndicator) {
    const modeIcons = { beginner:'🟢', klassik:'🔵', expert:'🔷', ultra:'💎', mathe:'🧮', worte:'📝', memo:'🧠', sequenz:'🔔', stroop:'🎨', fokus:'🎯', chaos:'🌀', hauptstaedte:'🌍', algebra:'📐', wissen:'💡' };
    const modeLabels = { klassik: t('mode_klassik'), beginner: t('mode_beginner'), mathe: t('mode_mathe'), worte: t('mode_worte'), memo: t('mode_memo'), sequenz: t('mode_sequenz'), stroop: t('mode_stroop'), fokus: t('mode_fokus'), chaos: t('mode_chaos'), hauptstaedte: t('mode_hauptstaedte'), algebra: t('mode_algebra'), wissen: t('mode_wissen') };
    const icon = modeIcons[app.selectedMode] || '';
    if (modeLabels[app.selectedMode]) modeIndicator.textContent = `${icon} ${modeLabels[app.selectedMode]}`;
    else {
      const dirCount = app.selectedMode === 'ultra' ? 12 : app.selectedMode === 'expert' ? 8 : 4;
      modeIndicator.textContent = `${icon} ${dirCount}-DIR`;
    }
  }

  /* Persistent rule label — shows the mode's core instruction */
  const ruleLabelEl = $('#modeRuleLabel');
  if (ruleLabelEl) {
    const lang = getLanguage();
    const labels = CONFIG.RULE_LABELS[lang] || CONFIG.RULE_LABELS.de;
    const label = labels[app.selectedMode] || '';
    ruleLabelEl.textContent = label;
    ruleLabelEl.classList.remove('faded');
    if (label) {
      setTimeout(() => ruleLabelEl.classList.add('faded'), 3000);
    }
  }

  /* Set mode class on body for CSS-driven corner layout */
  document.body.className = document.body.className.replace(/\bmode-\w+/g, '').trim();
  document.body.classList.add('mode-' + app.selectedMode);

  setText('#hudScore', '0');
  setText('#hudMultiplier', 'x1');
  setText('#hudStreak', '0');
  $('#pbProximity')?.classList.remove('visible', 'new-pb');

  const timerEl = $('#hudTimer');
  const endlessLivesEl = $('#hudEndlessLives');
  const compTargetEl = $('#hudCompTarget');

  if (app.selectedPlayType === 'endless') {
    if (timerEl) { timerEl.style.visibility = 'visible'; timerEl.textContent = '0:00'; }
    if (endlessLivesEl) endlessLivesEl.style.display = 'flex';
    if (compTargetEl) compTargetEl.style.display = 'none';
    endlessLivesEl?.querySelectorAll('.endless-heart').forEach(h => { h.style.opacity = '1'; h.style.transform = ''; });
  } else if (app.selectedPlayType === 'competition') {
    const level = save.getCompetitionLevel();
    const dur = CONFIG.DURATION_COMPETITION[level] || 30;
    if (timerEl) { timerEl.style.visibility = 'visible'; timerEl.textContent = dur; }
    if (endlessLivesEl) endlessLivesEl.style.display = 'none';
    if (compTargetEl) {
      compTargetEl.style.display = 'block';
      compTargetEl.textContent = t('competition_target', { n: CONFIG.COMPETITION_SCORE_TARGETS[level] || 2000 });
    }
  } else {
    const isBrainLikeMode = ['mathe','worte','stroop','fokus','chaos','hauptstaedte','algebra','wissen'].includes(app.selectedMode);
    const blitzDur = isBrainLikeMode ? (CONFIG.DURATION_BLITZ_BRAIN || CONFIG.DURATION_BLITZ) : CONFIG.DURATION_BLITZ;
    const dur = app.selectedPlayType === 'classic' ? CONFIG.DURATION_CLASSIC : blitzDur;
    if (timerEl) { timerEl.style.visibility = 'visible'; timerEl.textContent = dur; }
    if (endlessLivesEl) endlessLivesEl.style.display = 'none';
    if (compTargetEl) compTargetEl.style.display = 'none';
  }

  const practiceLabel = $('#practiceLabel');
  if (practiceLabel) practiceLabel.style.display = 'none';
  const stopBtn = $('#btnStopPractice');
  if (stopBtn) stopBtn.style.display = 'none';

  $('#pauseOverlay')?.classList.remove('active');

  /* Clear previous game visuals before showing game screen */
  clearCenter();
  $$('.corner-shape').forEach(el => {
    el.innerHTML = '';
    el.style.background = '';
    el.style.borderColor = '';
    el.style.boxShadow = '';
  });

  showScreen('game', app);

  /* Lock page scroll during gameplay */
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  /* Hard-block touchmove on game element to prevent any scroll leak */
  const gameEl = document.getElementById('game');
  const _blockScroll = (e) => e.preventDefault();
  if (gameEl) gameEl.addEventListener('touchmove', _blockScroll, { passive: false });
  window.__gameScrollBlocker = { el: gameEl, fn: _blockScroll };

  if (!practice && !save.getSetting('tutorialDone')) {
    showTutorial();
    return;
  }

  /* Brain & Reflex modes: show instruction overlay for first 5 plays */
  const instructionModes = ['mathe','worte','memo','sequenz','stroop','fokus','chaos','hauptstaedte','algebra','wissen'];
  const instrViews = save.getInstructionViews(app.selectedMode);
  const showInstr = instructionModes.includes(app.selectedMode) && !practice && instrViews < 5;
  if (showInstr) {
    save.incrementInstructionViews(app.selectedMode);
    _showModeInstruction(app.selectedMode, () => {
      doCountdown(() => beginGame(practice, daily, showResults, showHome, showContinuePrompt));
    });
  } else {
    doCountdown(() => beginGame(practice, daily, showResults, showHome, showContinuePrompt));
  }
}

/* ═══════ Begin game (after countdown) ═══════ */
export function beginGame(practice, daily, showResults, showHome, showContinuePrompt) {
  const { audio, game, save, effects, swipe } = app;

  if (typeof audio.setMusicMode === 'function') {
    audio.setMusicMode(practice ? 'classic' : app.selectedPlayType, {
      modeId: app.selectedMode,
      practice,
    });
  }
  audio.startMusic();

  const options = {
    practice, daily,
    competitionLevel: app.selectedPlayType === 'competition' ? save.getCompetitionLevel() : 0,
    lang: getLanguage()
  };
  const corners = game.start(app.selectedMode, practice ? 'blitz' : app.selectedPlayType, options);

  /* ── Klassik Mode Mastery: init ghost racer ── */
  if (app.selectedMode === 'klassik' && app.mastery) {
    startKlassikGhostRacer(app.mastery);
  }
  /* ── Formen Mode Mastery: init flow/chain tracking ── */
  if (app.selectedMode === 'beginner' && app.mastery) {
    startFormenGame(app.mastery);
  }
  /* ── Expert Mode Mastery: init compass tracking ── */
  if (app.selectedMode === 'expert' && app.mastery) {
    startExpertGame(app.mastery);
  }
  /* ── Ultra Mode Mastery: init 12-dir compass tracking ── */
  if (app.selectedMode === 'ultra' && app.mastery) {
    startUltraGame(app.mastery);
  }
  /* ── Mathe Mode Mastery: init op tracking ── */
  if (app.selectedMode === 'mathe' && app.mastery) {
    startMatheGame(app.mastery);
  }
  /* ── Algebra Mode Mastery: init type tracking ── */
  if (app.selectedMode === 'algebra' && app.mastery) {
    startAlgebraGame(app.mastery);
  }
  /* ── Worte Mode Mastery: init word collection tracking ── */
  if (app.selectedMode === 'worte' && app.mastery) {
    startWorteGame(app.mastery);
  }
  /* ── Hauptstaedte Mode Mastery: init region tracking ── */
  if (app.selectedMode === 'hauptstaedte' && app.mastery) {
    startHauptstaedteGame(app.mastery);
  }
  /* ── Wissen Mode Mastery: init topic tracking ── */
  if (app.selectedMode === 'wissen' && app.mastery) {
    startWissenGame(app.mastery);
  }
  /* ── Memo Mode Mastery: init memory span tracking ── */
  if (app.selectedMode === 'memo' && app.mastery) {
    startMemoGame(app.mastery);
  }
  /* ── Sequenz Mode Mastery: init round tracking ── */
  if (app.selectedMode === 'sequenz' && app.mastery) {
    startSequenzGame(app.mastery);
  }
  /* ── Stroop Mode Mastery: init interference tracking ── */
  if (app.selectedMode === 'stroop' && app.mastery) {
    startStroopGame(app.mastery);
  }
  /* ── Fokus Mode Mastery: init focus tracking ── */
  if (app.selectedMode === 'fokus' && app.mastery) {
    startFokusGame(app.mastery);
  }
  /* ── Chaos Mode Mastery: init flexibility tracking ── */
  if (app.selectedMode === 'chaos' && app.mastery) {
    startChaosGame(app.mastery);
  }

  if (!practice && game.playType !== 'endless') {
    app.gameDuration = game.timer;
  } else {
    app.gameDuration = 0;
  }

  const timerBarFill = $('#timerBarFill');
  if (timerBarFill) {
    timerBarFill.style.transform = (app.gameDuration > 0 ? 'scaleX(1)' : 'scaleX(0)');
    timerBarFill.classList.remove('urgent','critical');
  }

  effects.initTrailCanvas($('#trailCanvas'));
  renderCorners(corners, true);  /* forceAll on first render */
  effects.startAmbient();

  /* ─── Wire game callbacks ─── */
  game.onTick = () => {
    const thresholds = getUrgencyThresholds();
    const textHeavy = isTextHeavyMode();
    updateHUD();
    if (game.playType !== 'endless' && !game.practice && game.timer <= thresholds.audio && game.timer > 0) {
      audio.lastSeconds();
      if (!textHeavy && game.timer === thresholds.tension && typeof audio.startTension === 'function') audio.startTension();
    }
    if (effects && typeof effects.dangerZone === 'function') {
      const inDanger = (!game.practice && game.playType !== 'endless' && game.timer > 0 && game.timer <= thresholds.danger)
        || (game.playType === 'endless' && game.endlessLives <= 1);
      effects.dangerZone(inDanger);
    }
    /* v19: reactive background intensity */
    if (typeof effects.setBackgroundIntensity === 'function') {
      let intensity = 0;
      if (textHeavy) {
        if (game.feverActive) intensity = 2;
        else if (game.streak >= 20) intensity = 1;
      } else {
        if (game.feverActive) intensity = 4;
        else if (game.streak >= 30) intensity = 3;
        else if (game.streak >= 15) intensity = 2;
        else if (game.streak >= 5) intensity = 1;
      }
      effects.setBackgroundIntensity(intensity);
    }
    checkPBProximity();
  };

  game.onCornerShuffleWarn = () => {
    /* Show SHUFFLE! text overlay */
    const shuffleEl = $('#shuffleText');
    if (shuffleEl) {
      shuffleEl.textContent = t('shuffle');
      shuffleEl.classList.remove('active');
      requestAnimationFrame(() => { shuffleEl.classList.add('active'); });
    }
    /* Pulse all active corners */
    $$('.corner-shape').forEach(el => {
      if (el.style.display === 'none') return;
      el.classList.remove('shuffle-warn');
      requestAnimationFrame(() => { el.classList.add('shuffle-warn'); });
    });
    if (typeof audio.cornerShuffleWarn === 'function') audio.cornerShuffleWarn();
    haptic('rush', save);
  };

  game.onCornerShuffle = (cornerMap) => {
    /* Force full re-render of corners with new layout */
    for (const k in _prevCornerState) delete _prevCornerState[k];
    renderCorners(cornerMap, true);
    /* Pop-in animation on shuffled corners */
    $$('.corner-shape').forEach(el => {
      if (el.style.display === 'none') return;
      el.classList.remove('shuffle-warn', 'shuffle-done');
      requestAnimationFrame(() => { el.classList.add('shuffle-done'); });
    });
    setTimeout(() => {
      $$('.corner-shape').forEach(el => el.classList.remove('shuffle-done'));
    }, 500);
    if (typeof audio.cornerShuffleDone === 'function') audio.cornerShuffleDone();
    /* Clean up text overlay */
    setTimeout(() => {
      $('#shuffleText')?.classList.remove('active');
    }, 1200);
  };

  game.onCornersUpdate = (cm) => { renderCorners(cm); };

  /* ── Memo (hidden corners) callbacks ── */
  game.onMemoPreview = (cornerMap, durationMs) => {
    renderCorners(cornerMap, true);
    /* Corners are already visible from renderCorners — add a pulse to draw attention */
    $$('.corner-shape').forEach(el => {
      if (el.style.display === 'none') return;
      el.classList.remove('memo-covered', 'memo-revealing');
      el.classList.add('memo-revealing');
    });
    setTimeout(() => {
      $$('.corner-shape').forEach(el => el.classList.remove('memo-revealing'));
    }, 500);
  };

  game.onMemoCover = () => {
    $$('.corner-shape').forEach(el => {
      if (el.style.display === 'none') return;
      el.classList.remove('memo-revealing');
      el.classList.add('memo-covered');
    });
  };

  game.onMemoReveal = (cornerMap, durationMs) => {
    renderCorners(cornerMap, true);
    $$('.corner-shape').forEach(el => {
      if (el.style.display === 'none') return;
      el.classList.remove('memo-covered');
      el.classList.add('memo-revealing');
    });
    setTimeout(() => {
      $$('.corner-shape').forEach(el => el.classList.remove('memo-revealing'));
    }, 500);
    haptic('rush', save);
  };

  /* ── Chaos mode: rule-switch banner ── */
  game.onChaosRuleSwitch = (newRule) => {
    /* Clean up any existing banners to prevent DOM leaks */
    document.querySelectorAll('.chaos-rule-banner').forEach(el => el.remove());
    const ruleLabels = { color: '\uD83C\uDFA8', shape: '\uD83D\uDD37', size: '\uD83D\uDCCF', math: '\uD83D\uDCDD', stroop: '\uD83C\uDF08' };
    const ruleColors = { color: '#EF4444', shape: '#3B82F6', size: '#10B981', math: '#FBBF24', stroop: '#EC4899' };
    const banner = document.createElement('div');
    banner.className = 'chaos-rule-banner pop-in';
    banner.textContent = `${ruleLabels[newRule] || ''} ${t('chaos_rule_' + newRule) || newRule.toUpperCase()}`;
    banner.style.borderColor = ruleColors[newRule] || '';
    const gameEl = $('#game');
    if (gameEl) {
      gameEl.appendChild(banner);
      setTimeout(() => banner.remove(), 1800);
    }
    effects.flash((ruleColors[newRule] || '#ffffff') + '30', 250);
    haptic('rush', save);
  };

  game.onSpawn = (shape) => {
    renderCenter(shape);

    if (shape.bonus === 'golden') audio.goldenFound();
    if (shape.bonus === 'diamond') audio.diamondFound();
  };

  game.onResult = (result) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const isRush = game.inRush;
    const isFever = game.feverActive;

    if (result.correct) {
      audio.correct(result.streak);

      /* ── Rush fast-path: minimal FX for maximum frame budget ── */
      if (isRush) {
        /* Lightweight: just particles, score pop, multiplier ring */
        const pColor = app.colorblind ? "#fff" : (game.cornerMap[result.expected]?.color || "#fff");
        effects.particles(cx, cy, pColor, 2, false);
        effects.updateMultiplierRing(result.multiplier);
        effects.scorePop(cx, cy - 40, `+${result.points}`, '#fff', false);
        const corner = $(`.corner-shape[data-dir="${result.expected}"]`);
        if (corner) {
          corner.classList.add('corner-correct');
          setTimeout(() => corner.classList.remove('corner-correct'), 300);
        }
        effects.setMultiplierBg(result.multiplier);
        haptic('correct', save);
      } else {
        /* ── Normal path: full FX ── */
        effects.shakeHit();
        if (result.streak > 5) effects.hitStop(20);
        const particleFxCount = Math.min(10, 4 + Math.floor(result.streak / 10));
        const pColor = app.colorblind ? "#fff" : (game.cornerMap[result.expected]?.color || "#fff");
        effects.particles(cx, cy, pColor, particleFxCount, false);
        effects.updateMultiplierRing(result.multiplier);

        const corner = $(`.corner-shape[data-dir="${result.expected}"]`);
        effects.glowCorner(corner, game.cornerMap[result.expected]?.color || '#fff');

        if (corner) {
          corner.classList.remove('corner-matched','corner-destination-flash','corner-correct');
          /* Use rAF instead of forced reflow (void offsetWidth) */
          requestAnimationFrame(() => {
            corner.classList.add('corner-matched','corner-destination-flash','corner-correct');
          });
          setTimeout(() => corner.classList.remove('corner-matched','corner-destination-flash','corner-correct'), 500);
          const r = corner.getBoundingClientRect();
          effects.absorb(cx, cy, r.left + r.width/2, r.top + r.height/2, game.cornerMap[result.expected]?.color || '#fff');
        }

        cornerScorePop(result.expected, `+${result.points}`);

        let popText = `+${result.points}`, popColor = '#fff', big = false;
        if (result.bonus === 'diamond') { popText = `\uD83D\uDC8E +${result.points}`; popColor = '#00D2FF'; big = true; effects.diamondFlash(); effects.bonusParticles(cx, cy, 'diamond'); haptic('diamond', save); }
        else if (result.bonus === 'golden') { popText = `\u2726 +${result.points}`; popColor = '#FFD700'; big = true; effects.goldenFlash(); effects.bonusParticles(cx, cy, 'golden'); haptic('golden', save); }
        effects.scorePop(cx, cy - 40, popText, popColor, big);

        if (result.bonus === 'diamond') {
          if (save.addAchievement('diamond_catch')) {
            const bodyFx = getBodyFx();
            bodyFx.achievementToast(t('ach_diamond_catch'));
            audio.achievementUnlock();
          }
        }
        effects.setMultiplierBg(result.multiplier);
        if (result.streak > 0 && result.streak % 20 === 0 && typeof effects.screenPulse === 'function') {
          effects.screenPulse();
        }
        if (typeof effects.animateStreakCounter === 'function') effects.animateStreakCounter($('#hudStreak'));
        if (typeof effects.setScoreZone === 'function') effects.setScoreZone(game.score);
        haptic('correct', save);
      }
    } else {
      if (!result.autoMiss) {
          audio.wrong();
          effects.hitStop(80);
          effects.shakeError();
          effects.flash('rgba(255,0,0,0.2)');
        if (typeof effects.missOverlay === 'function') effects.missOverlay();
        haptic('wrong', save);
        if (result.expected) showNearMiss(result.expected);
        if (result.direction) {
          const wrongCorner = $(`.corner-shape[data-dir="${result.direction}"]`);
          if (wrongCorner) {
            wrongCorner.classList.remove('corner-wrong');
            /* Use rAF instead of forced reflow */
            requestAnimationFrame(() => { wrongCorner.classList.add('corner-wrong'); });
            setTimeout(() => wrongCorner.classList.remove('corner-wrong'), 500);
          }
        }
      }
      effects.resetMultiplierBg();
    }

    /* ── Klassik Mode Mastery: track answer + update HUD elements ── */
    if (game.mode === 'klassik' && app.mastery && !game.practice) {
      trackKlassikAnswer(app.mastery, result, game);

      /* Speed zone indicator */
      if (result.correct) {
        const zone = getSpeedZone(result.reaction);
        updateSpeedZoneIndicator(zone, result.reaction);
        updateSpeedGlow(zone);
        updateGhostRacer(game);
        updateFlawlessCounter(app.mastery);

        /* Color combo pop */
        const colorCombo = app.mastery.get('klassik', '_colorCombo');
        if (colorCombo >= (CONFIG.KLASSIK_COLOR_COMBO_MIN || 3)) {
          showColorComboPop(colorCombo);
        }

        /* Zen state overlay */
        updateZenState(game.streak);
      } else {
        updateSpeedZoneIndicator(null);
        updateSpeedGlow(null);
        updateFlawlessCounter(app.mastery);
        updateZenState(0);
      }
    }

    /* ── Formen Mode Mastery: track answer + update HUD elements ── */
    if (game.mode === 'beginner' && app.mastery && !game.practice) {
      trackFormenAnswer(app.mastery, result, game);

      if (result.correct) {
        /* Flow meter */
        const flowStreak = app.mastery.get('beginner', '_flowStreak');
        updateFlowMeter(flowStreak);

        /* Ghost racer */
        updateFormenGhostRacer(game);

        /* Shape chain pop */
        const shapeChain = app.mastery.get('beginner', '_shapeChain');
        if (shapeChain >= (CONFIG.BEGINNER_SHAPE_COMBO_MIN || 3)) {
          const cornerInfo = game.cornerMap?.[result.expected];
          showShapeChainPop(shapeChain, cornerInfo?.shape);
        }

        /* Jackpot pop for ultra-fast answers */
        if (result.reaction < 300) {
          showJackpotPop();
        }
      } else {
        updateFlowMeter(0);
      }
    }

    /* ── Expert Mode Mastery: track answer + update HUD elements ── */
    if (game.mode === 'expert' && app.mastery && !game.practice) {
      const expertResult = trackExpertAnswer(app.mastery, result, game);

      if (result.correct) {
        ensureExpertHUD();
        updateCompassRing(app.mastery);
        updateExpertGhostRacer(game);

        /* Full Compass! celebration */
        if (expertResult.fullCompass) {
          showFullCompassPop();
        }

        /* Weak spot indicator */
        updateWeakSpotIndicator(app.mastery, game);
      } else {
        updateCompassRing(app.mastery);
      }
    }

    /* ── Ultra Mode Mastery: track answer + update HUD elements ── */
    if (game.mode === 'ultra' && app.mastery && !game.practice) {
      const ultraResult = trackUltraAnswer(app.mastery, result, game);

      if (result.correct) {
        ensureUltraHUD();
        updateUltraGrid(app.mastery);
        updateUltraGhostRacer(game);

        /* Full Compass! celebration (12 dirs) */
        if (ultraResult.fullCompass) {
          showUltraFullCompassPop();
        }

        /* Weak spot indicator */
        updateUltraWeakSpot(app.mastery, game);
      } else {
        updateUltraGrid(app.mastery);
      }
    }

    /* ── Mathe Mode Mastery: track answer ── */
    if (game.mode === 'mathe' && app.mastery && !game.practice) {
      const maResult = trackMatheAnswer(app.mastery, result, game);

      if (result.correct) {
        ensureMatheHUD();
        updateMatheOpBar(app.mastery);
        updateMatheGhostRacer(game);

        /* Phase advance notification */
        if (maResult.phase > (app._lastMathePhase || 0)) {
          showMathePhaseUp(maResult.phase);
          app._lastMathePhase = maResult.phase;
        }
      } else {
        updateMatheOpBar(app.mastery);
      }
    }

    /* ── Algebra Mode Mastery: track answer ── */
    if (game.mode === 'algebra' && app.mastery && !game.practice) {
      const algResult = trackAlgebraAnswer(app.mastery, result, game);

      if (result.correct) {
        ensureAlgebraHUD();
        updateAlgebraTypeBar(app.mastery);
        updateAlgebraGhostRacer(game);

        /* Phase advance / unlock toast */
        if (algResult.phase > (app._lastAlgPhase || 0)) {
          showAlgebraUnlock(algResult.eqType, algResult.phase);
          app._lastAlgPhase = algResult.phase;
        }
      } else {
        updateAlgebraTypeBar(app.mastery);
      }
    }

    /* ── Worte Mode Mastery: track answer ── */
    if (game.mode === 'worte' && app.mastery && !game.practice) {
      const wResult = trackWorteAnswer(app.mastery, result, game);

      if (result.correct) {
        ensureWorteHUD();
        updateWorteCollection(app.mastery);
        updateWorteGhostRacer(game);
        if (wResult.isNew) {
          showWorteNewWord(game.currentShape?.display || '');
        }
      }
    }

    /* ── Hauptstaedte Mode Mastery: track answer ── */
    if (game.mode === 'hauptstaedte' && app.mastery && !game.practice) {
      const hResult = trackHauptstaedteAnswer(app.mastery, result, game);
      if (result.correct) {
        ensureHauptstaedteHUD();
        updateHauptstaedteCountry(app.mastery);
        updateHauptstaedteGhostRacer(game);
        if (hResult.isNew) showHauptstaedteNewCountry(game.currentShape?.display || '');
      }
    }

    /* ── Wissen Mode Mastery: track answer ── */
    if (game.mode === 'wissen' && app.mastery && !game.practice) {
      const wRes = trackWissenAnswer(app.mastery, result, game);
      if (result.correct) {
        ensureWissenHUD();
        updateWissenTopicBar(app.mastery);
        updateWissenGhostRacer(game);
        /* Difficulty Reveal (Plan 9 feature 3) */
        if (wRes.tier !== undefined) showWissenDifficultyReveal(wRes.tier);
        /* Topic Streak popup (Plan 9 feature 4) */
        if (wRes.topicStreak >= 3) showWissenTopicStreakPop(wRes.topicStreak);
      } else {
        updateWissenTopicBar(app.mastery);
      }
    }

    /* ── Memo Mode Mastery: track answer ── */
    if (game.mode === 'memo' && app.mastery && !game.practice) {
      const meResult = trackMemoAnswer(app.mastery, result, game);
      if (result.correct) {
        ensureMemoHUD();
        updateMemoSpan(app.mastery);
        updateMemoGhostRacer(game);
      } else {
        updateMemoSpan(app.mastery);
      }
    }

    /* ── Stroop Mode Mastery: track answer ── */
    if (game.mode === 'stroop' && app.mastery && !game.practice) {
      const sRes = trackStroopAnswer(app.mastery, result, game);
      if (result.correct) {
        ensureStroopHUD();
        updateStroopInterference(app.mastery);
        updateStroopGhostRacer(game);
        /* Challenge Round trigger (Plan 12 feature 4) */
        if (sRes.challengeTriggered) showStroopChallengeRound();
      } else {
        updateStroopInterference(app.mastery);
      }
    }

    /* ── Fokus Mode Mastery: track answer ── */
    if (game.mode === 'fokus' && app.mastery && !game.practice) {
      const fRes = trackFokusAnswer(app.mastery, result, game);
      if (result.correct) {
        ensureFokusHUD();
        updateFokusSplit(app.mastery);
        updateFokusGhostRacer(game);
        /* Distraction Intensity display (Plan 13 feature 2) */
        if (fRes.distractionLevel) updateFokusDistractionLevel(fRes.distractionLevel);
      } else {
        updateFokusSplit(app.mastery);
      }
    }

    /* ── Chaos Mode Mastery: track answer ── */
    if (game.mode === 'chaos' && app.mastery && !game.practice) {
      const chResult = trackChaosAnswer(app.mastery, result, game);
      if (result.correct) {
        ensureChaosHUD();
        updateChaosRuleDisplay(app.mastery, game);
        updateChaosGhostRacer(game);
      } else {
        updateChaosRuleDisplay(app.mastery, game);
      }
    }

    effects.trailComplete(result.correct);
    updateHUD();
    clearCenter();
    checkPBProximity();
  };

  game.onPerfect = () => {
    audio.perfect();
    effects.perfectFlash();
    effects.scorePop(window.innerWidth / 2, window.innerHeight / 2 - 80, t('perfect'), '#FFD700', true);
    haptic('perfect', save);
  };

  game.onStreak = (streak) => {
    const color = streak >= 20 ? '#FFD700' : streak >= 10 ? '#FFA502' : '#2ED573';
    effects.scorePop(window.innerWidth / 2, window.innerHeight / 2 - 100, `\uD83D\uDD25 ${streak} ${t('streak')}!`, color, true);
    haptic(streak >= 10 ? 'streak10' : 'streak5', save);
  };

  game.onMultiplierChange = (mult) => {
    if (mult > 1) audio.multiplierUp(mult);
    if (typeof effects.updateMultiplierRing === 'function') effects.updateMultiplierRing(mult);
    updateHUD();
  };

  game.onRush = () => {
    audio.rush();
    haptic('rush', save);
    /* Skip speedLines during rush — they pile up and cause DOM pressure */
    const rushEl = $('#rushText');
    if (rushEl) { rushEl.textContent = t('rush'); rushEl.classList.remove('active'); requestAnimationFrame(() => { rushEl.classList.add('active'); }); }
    setTimeout(() => $('#rushText')?.classList.remove('active'), 1500);
  };

  game.onFeverStart = () => {
    audio.feverStart();
    haptic('fever', save);
    effects.startFever();
    const feverEl = $('#feverText');
    if (feverEl) { feverEl.textContent = t('fever'); feverEl.classList.remove('active'); requestAnimationFrame(() => { feverEl.classList.add('active'); }); }
    if (save.addAchievement('fever_triggered')) {
      effects.achievementToast(t('ach_fever_triggered'));
      audio.achievementUnlock();
    }
  };

  game.onFeverEnd = () => {
    audio.feverEnd();
    effects.stopFever();
    const feverEl = $('#feverText');
    if (feverEl) {
      feverEl.classList.remove('active');
      feverEl.textContent = t('fever_cooldown');
      feverEl.classList.add('fever-cooldown');
      setTimeout(() => { feverEl.classList.remove('fever-cooldown'); feverEl.textContent = ''; }, 3000);
    }
  };

  game.onComboMilestone = (streak, bonusPoints) => {
    haptic('combo', save);
    if (typeof audio.comboMilestone === 'function') audio.comboMilestone(streak);
    if (typeof effects.comboMilestone === 'function') effects.comboMilestone(streak);
    if (bonusPoints > 0) {
      effects.scorePop(window.innerWidth / 2, window.innerHeight / 2 - 60, `+${bonusPoints}`, '#FFD700', true);
    }
  };

  /* v19: Score milestone celebration — skip burst during rush */
  game.onScoreMilestone = (threshold, tier) => {
    if (typeof audio.scoreMilestone === 'function') audio.scoreMilestone(tier);
    if (!game.inRush && typeof effects.scoreMilestoneBurst === 'function') effects.scoreMilestoneBurst(tier);
    haptic('combo', save);
    const label = threshold >= 10000 ? `${threshold/1000}K!` : `${threshold/1000}K`;
    effects.scorePop(window.innerWidth / 2, window.innerHeight / 2 - 80, `⭐ ${label}`, '#FFD700', true);
  };

  /* v19: Streak break feedback */
  game.onStreakBreak = (lostStreak) => {
    if (typeof audio.streakBreak === 'function') audio.streakBreak(lostStreak);
    if (lostStreak >= 10) { 
       haptic('heartLost', app.save); 
       effects.advancedShake(400, 15); 
    } else { 
       haptic('wrong', app.save); 
       effects.advancedShake(200, 5); 
    }
  };

  /* Combo decay: update streak HUD as combo ticks down */
  game.onComboDecay = (newStreak) => {
    const streakEl = document.getElementById('hudStreak');
    if (streakEl) streakEl.textContent = newStreak > 0 ? newStreak : '';
  };

  game.onEndlessMiss = (livesLeft) => {
    haptic('heartLost', save);
    if (typeof audio.endlessMiss === 'function') audio.endlessMiss(livesLeft);
    if (typeof effects.endlessHeartLost === 'function') effects.endlessHeartLost(livesLeft);
    updateEndlessLives();
    effects.scorePop(window.innerWidth / 2, window.innerHeight / 2 - 60,
      t('endless_miss', { n: livesLeft }), '#FF4757', true);
  };

  /* ── Streak Time Bonus visual feedback ── */
  game.onTimerBonus = (seconds) => {
    const timerEl = _getHudEls().timer;
    if (!timerEl) return;
    app.gameDuration = Math.max(app.gameDuration, game.timer);
    const rect = timerEl.getBoundingClientRect();
    effects.scorePop(
      rect.left + rect.width / 2,
      rect.top + rect.height + 5,
      `+${seconds}s`,
      '#2ED573',
      true
    );
    effects.flash('#2ED57340', 200);
    const gameEl = document.getElementById('game');
    if (gameEl) {
      gameEl.classList.remove('edge-glow-bonus');
      void gameEl.offsetWidth;
      gameEl.classList.add('edge-glow-bonus');
      setTimeout(() => gameEl.classList.remove('edge-glow-bonus'), 600);
    }
    timerEl.classList.remove('timer-bonus');
    void timerEl.offsetWidth;
    timerEl.classList.add('timer-bonus');
    setTimeout(() => timerEl.classList.remove('timer-bonus'), 800);
    updateHUD();
  };

  game.onTimerPenalty = (seconds) => {
    const timerEl = _getHudEls().timer;
    if (!timerEl) return;
    const rect = timerEl.getBoundingClientRect();
    effects.scorePop(
      rect.left + rect.width / 2,
      rect.top + rect.height + 5,
      `-${seconds}s`,
      '#FF4757',
      false
    );
    timerEl.classList.remove('timer-penalty');
    void timerEl.offsetWidth;
    timerEl.classList.add('timer-penalty');
    setTimeout(() => timerEl.classList.remove('timer-penalty'), 500);
    updateHUD();
  };

  game.onEndlessLifeEarned = (livesLeft) => {
    haptic('combo', save);
    if (typeof audio.correct === 'function') audio.correct(10);
    effects.scorePop(
      window.innerWidth / 2,
      window.innerHeight / 2 - 60,
      t('life_earned') || '+1',
      'var(--color-heart, #FF6B81)',
      true
    );
    effects.flash('#FF6B8140', 250);
    if (typeof effects.confetti === 'function') effects.confetti(6);
    const livesContainer = document.getElementById('hudEndlessLives');
    if (livesContainer) {
      livesContainer.classList.remove('life-earned-pulse');
      void livesContainer.offsetWidth;
      livesContainer.classList.add('life-earned-pulse');
      setTimeout(() => livesContainer.classList.remove('life-earned-pulse'), 800);
    }
    updateEndlessLives();
  };

  /* ═══ Anti-frustration callbacks (v22) ═══ */
  game.onStreakProtected = (brokenStreak) => {
    haptic('warn', save);
    if (typeof audio.streakProtected === 'function') audio.streakProtected();
    effects.scorePop(
      window.innerWidth / 2,
      window.innerHeight / 2 - 60,
      t('streak_warning', { n: brokenStreak }),
      '#FFA502',
      true
    );
    effects.flash('#FFA50230', 250);
  };

  game.onShowCorrectAnswer = (correctDir, durationMs) => {
    const el = $(`.corner-shape[data-dir="${correctDir}"]`);
    if (el) {
      el.classList.add('show-correct');
      setTimeout(() => el.classList.remove('show-correct'), durationMs || 400);
    }
  };

  game.onRushWarning = (seconds) => {
    if (typeof audio.rushWarning === 'function') audio.rushWarning();
    const gameEl = document.getElementById('game');
    if (!gameEl) return;
    const warn = document.createElement('div');
    warn.className = 'rush-warning';
    warn.textContent = t('rush_incoming', { n: seconds });
    gameEl.appendChild(warn);
    setTimeout(() => warn.remove(), 1200);
  };

  game.onShuffleExplain = () => {
    const gameEl = document.getElementById('game');
    if (!gameEl) return;
    const tip = document.createElement('div');
    tip.className = 'shuffle-explain';
    tip.textContent = t('shuffle_explain');
    gameEl.appendChild(tip);
    setTimeout(() => tip.remove(), 2800);
  };

  game.onWissenLevelUp = (level) => {
    haptic('combo', save);
    if (typeof audio.wissenLevelUp === 'function') audio.wissenLevelUp(level);
    const gameEl = document.getElementById('game');
    if (!gameEl) return;
    const el = document.createElement('div');
    el.className = 'wissen-level-up';
    el.textContent = t('wissen_level_up', { n: level });
    gameEl.appendChild(el);
    setTimeout(() => el.remove(), 1500);
    effects.flash('#a78bfa30', 300);
  };

  game.onCompetitionComplete = async (level, score) => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    if (window.__gameScrollBlocker) { window.__gameScrollBlocker.el?.removeEventListener('touchmove', window.__gameScrollBlocker.fn); window.__gameScrollBlocker = null; }
    game.stop();
    audio.stopMusic();
    if (typeof audio.competitionWin === 'function') audio.competitionWin();

    const stars = score >= game.competitionTarget * 2 ? 3 : score >= game.competitionTarget * 1.5 ? 2 : 1;
    const ultraUnlocked = await save.completeCompetitionLevel(level, stars);

    const bodyFx = getBodyFx();
    bodyFx.achievementToast(t('competition_complete'));
    bodyFx.confetti();

    if (ultraUnlocked) {
      setTimeout(() => { bodyFx.achievementToast(t('competition_ultra_unlocked')); audio.levelUp(); }, 2000);
    }

    setTimeout(() => {
      swipe?.unbind();
      effects?.resetMultiplierBg();
      effects?.stopAmbient();
      effects?.cleanup();
      cleanupGameClasses();
      showHome();
    }, 3000);
  };

  game.onContinuePrompt = (stats) => { showContinuePrompt(stats); };

  game.onGameOver = (stats) => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    if (window.__gameScrollBlocker) { window.__gameScrollBlocker.el?.removeEventListener('touchmove', window.__gameScrollBlocker.fn); window.__gameScrollBlocker = null; }
    audio.stopMusic();
    if (typeof audio.stopTension === 'function') audio.stopTension();
    audio.gameOver();
    haptic('gameOver', save);
    swipe?.unbind();
    effects.resetMultiplierBg();
    effects.stopFever();
    effects.stopAmbient();
    if (typeof effects.dangerZone === 'function') effects.dangerZone(false);
    effects.cleanup();
    cleanupGameClasses();
    cleanupKlassikHUD();
    cleanupFormenHUD();
    cleanupExpertHUD();
    cleanupUltraHUD();
    cleanupMatheHUD();
    cleanupAlgebraHUD();
    cleanupWorteHUD();
    cleanupHauptstaedteHUD();
    cleanupWissenHUD();
    cleanupMemoHUD();
    cleanupSequenzHUD();
    cleanupStroopHUD();
    cleanupFokusHUD();
    cleanupChaosHUD();

    /* ── Klassik Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'klassik' && app.mastery) {
      endKlassikGame(app.mastery, stats, stats.score > (app.save.getPB('klassik') || 0));
      app.mastery.persist();
    }
    /* ── Formen Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'beginner' && app.mastery) {
      endFormenGame(app.mastery, stats, stats.score > (app.save.getPB('beginner') || 0));
      app.mastery.persist();
    }
    /* ── Expert Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'expert' && app.mastery) {
      endExpertGame(app.mastery, stats, stats.score > (app.save.getPB('expert') || 0));
      app.mastery.persist();
    }
    /* ── Ultra Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'ultra' && app.mastery) {
      endUltraGame(app.mastery, stats, stats.score > (app.save.getPB('ultra') || 0));
      app.mastery.persist();
    }
    /* ── Mathe Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'mathe' && app.mastery) {
      endMatheGame(app.mastery, stats, stats.score > (app.save.getPB('mathe') || 0));
      app.mastery.persist();
    }
    /* ── Algebra Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'algebra' && app.mastery) {
      endAlgebraGame(app.mastery, stats, stats.score > (app.save.getPB('algebra') || 0));
      app.mastery.persist();
    }
    /* ── Worte Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'worte' && app.mastery) {
      endWorteGame(app.mastery, stats, stats.score > (app.save.getPB('worte') || 0));
      app.mastery.persist();
    }
    /* ── Hauptstaedte Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'hauptstaedte' && app.mastery) {
      endHauptstaedteGame(app.mastery, stats, stats.score > (app.save.getPB('hauptstaedte') || 0));
      app.mastery.persist();
    }
    /* ── Wissen Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'wissen' && app.mastery) {
      endWissenGame(app.mastery, stats, stats.score > (app.save.getPB('wissen') || 0));
      app.mastery.persist();
    }
    /* ── Memo Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'memo' && app.mastery) {
      endMemoGame(app.mastery, stats, stats.score > (app.save.getPB('memo') || 0));
      app.mastery.persist();
    }
    /* ── Sequenz Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'sequenz' && app.mastery) {
      endSequenzGame(app.mastery, stats, stats.score > (app.save.getPB('sequenz') || 0));
      app.mastery.persist();
    }
    /* ── Stroop Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'stroop' && app.mastery) {
      endStroopGame(app.mastery, stats, stats.score > (app.save.getPB('stroop') || 0));
      app.mastery.persist();
    }
    /* ── Fokus Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'fokus' && app.mastery) {
      endFokusGame(app.mastery, stats, stats.score > (app.save.getPB('fokus') || 0));
      app.mastery.persist();
    }
    /* ── Chaos Mode Mastery: persist end-of-game data ── */
    if (game.mode === 'chaos' && app.mastery) {
      endChaosGame(app.mastery, stats, stats.score > (app.save.getPB('chaos') || 0));
      app.mastery.persist();
    }

    const g = $('#game');
    g?.classList.add('game-over-freeze');
    if (typeof effects.gameOverFlash === 'function') {
      effects.gameOverFlash(t('game_over'));
    }
    setTimeout(() => { g?.classList.remove('game-over-freeze'); showResults(stats); }, CONFIG.GAME_OVER_TRANSITION_MS || 550);
  };

  /* ── Sequenz (Simon Says) callbacks ── */
  game.onSequenzRoundStart = (round, seqLen) => {
    /* Show "MERKEN!" watch overlay */
    const comboEl = $('#comboText');
    if (comboEl) {
      comboEl.textContent = t('sequenz_watch');
      comboEl.classList.remove('active');
      requestAnimationFrame(() => comboEl.classList.add('active'));
    }
    /* Show round badge */
    const rushEl = $('#rushText');
    if (rushEl) {
      rushEl.textContent = t('sequenz_round', { n: round + 1 });
      rushEl.classList.remove('active');
      requestAnimationFrame(() => rushEl.classList.add('active'));
      setTimeout(() => rushEl.classList.remove('active'), 1500);
    }
    /* Show round + sequence length in center platform */
    const center = $('#centerShape');
    if (center) {
      center.innerHTML = `<span class="sequenz-round-display"><span class="seq-round-num">${round + 1}</span><span class="seq-round-len">${t('sequenz_length', { n: seqLen })}</span></span>`;
      center.className = 'center-shape pop-in';
    }
    haptic('rush', save);
  };

  game.onSequenzFlash = (dir, index, total, flashMs) => {
    const corner = $(`.corner-shape[data-dir="${dir}"]`);
    if (!corner) return;
    /* Bright pulse on the flashed corner */
    corner.classList.remove('sequenz-flash');
    requestAnimationFrame(() => {
      corner.classList.add('sequenz-flash');
      corner.style.setProperty('--seq-flash-ms', `${flashMs}ms`);
    });
    setTimeout(() => corner.classList.remove('sequenz-flash'), flashMs);
    /* Play a tone for each step */
    audio.correct(index);
    haptic('hover', save);
  };

  game.onSequenzReady = (seqLen) => {
    /* Switch from WATCH to GO overlay */
    const comboEl = $('#comboText');
    if (comboEl) {
      comboEl.textContent = t('sequenz_go');
      comboEl.classList.remove('active');
      requestAnimationFrame(() => comboEl.classList.add('active'));
      setTimeout(() => comboEl.classList.remove('active'), 1200);
    }
    haptic('correct', save);
  };

  game.onSequenzResult = (result) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    if (result.correct && result.sequenzComplete) {
      /* Full sequence reproduced — celebrate */
      audio.correct(result.streak);
      effects.particles(cx, cy, '#FFD700', 8, false);
      effects.scorePop(cx, cy - 40, `+${result.points}`, '#FFD700', true);
      effects.perfectFlash();
      haptic('combo', save);
    } else if (result.correct && !result.sequenzComplete) {
      /* Correct step — small confirmation */
      const corner = $(`.corner-shape[data-dir="${result.direction}"]`);
      if (corner) {
        corner.classList.add('corner-correct');
        setTimeout(() => corner.classList.remove('corner-correct'), 300);
      }
      audio.correct(0);
      haptic('correct', save);
    } else {
      /* Wrong step */
      audio.wrong();
      effects.shakeError();
      effects.flash('rgba(255,0,0,0.2)');
      haptic('wrong', save);
      if (result.expected) showNearMiss(result.expected);
    }

    /* ── Sequenz Mode Mastery: track round result ── */
    if (game.mode === 'sequenz' && app.mastery && !game.practice) {
      const seqMResult = trackSequenzResult(app.mastery, result, game);
      if (seqMResult) {
        ensureSequenzHUD();
        updateSequenzRecord(app.mastery);
        if (seqMResult.isRecord) showSequenzNewRecord(seqMResult.seqLen);
      }
    }

    updateHUD();
  };

  swipe.onSwipe = (dir, ts) => {
    if (game.paused) return;
    /* Sequenz mode: route to sequence input handler */
    if (game.isSequenzMode) {
      game.handleSequenzInput(dir);
      return;
    }
    const result = game.handleSwipe(dir, ts);
    if (!result) effects.trailEnd();
  };

  /* ── Tap-to-corner: tap a corner shape to answer ── */
  swipe.onCornerTap = (dir, ts) => {
    if (game.paused) return;
    /* Sequenz mode: route to sequence input handler */
    if (game.isSequenzMode) {
      /* Visual feedback */
      const corner = $(`.corner-shape[data-dir="${dir}"]`);
      if (corner) {
        const r = corner.getBoundingClientRect();
        effects.ripple(r.left + r.width / 2, r.top + r.height / 2,
          game.cornerMap[dir]?.color || '#fff');
        corner.classList.remove('corner-tapped');
        requestAnimationFrame(() => corner.classList.add('corner-tapped'));
        setTimeout(() => corner.classList.remove('corner-tapped'), 350);
      }
      haptic('hover', save);
      game.handleSequenzInput(dir);
      return;
    }
    /* Visual feedback: pulse the tapped corner */
    const corner = $(`.corner-shape[data-dir="${dir}"]`);
    if (corner) {
      const r = corner.getBoundingClientRect();
      effects.ripple(r.left + r.width / 2, r.top + r.height / 2,
        game.cornerMap[dir]?.color || '#fff');
      corner.classList.remove('corner-tapped');
      requestAnimationFrame(() => corner.classList.add('corner-tapped'));
      setTimeout(() => corner.classList.remove('corner-tapped'), 350);
    }
    haptic('hover', save);
    const result = game.handleSwipe(dir, ts);
    if (!result) effects.trailEnd();
  };

  /* ── Center tap: no-op (memo peek removed) ── */
  swipe.onCenterTap = () => {};

  /* ── Dead-zone swipe: brief feedback so player knows input was received ── */
  swipe.onSwipeRejected = () => {
    haptic('tap', save);
    const platform = $('#centerPlatform');
    if (platform) {
      platform.classList.remove('dead-zone-flash');
      requestAnimationFrame(() => platform.classList.add('dead-zone-flash'));
      setTimeout(() => platform.classList.remove('dead-zone-flash'), 300);
    }
  };

  swipe.onTrailStart = (x, y) => {
    if (game.paused) return;
    const shape = game.currentShape;
    /* P4 fix: For brain modes (math/word) use a neutral accent color instead of
       the corner item color, since the center shows text not a colored shape */
    let color;
    if (shape && (shape.type === 'math' || shape.type === 'word' || shape.type === 'capitals')) {
      color = getComputedStyle(document.documentElement).getPropertyValue('--primary-glow').trim() || '#9D4EDD';
    } else {
      color = shape ? (app.colorblind ? shape.colorblind : shape.color) : '#ffffff';
    }
    effects.trailStart(x, y, color);
    effects.ripple(x, y, color);
    if (typeof audio.swipeStart === 'function') audio.swipeStart();
    haptic('hover', app.save);
  };
  swipe.onTrailMove = (x, y) => { if (!game.paused) effects.trailMove(x, y); };
  swipe.onTrailEnd = () => { effects.trailEnd(); };

  updateHUD();
  if (game.playType === 'endless') updateEndlessLives();
}

/* ═══════ Pause / Resume / Quit ═══════ */
export function pauseGame() {
  const { game, audio, save } = app;
  if (!game.running || game.paused) return;
  game.pause();
  audio.stopMusic();
  if (typeof audio.stopTension === 'function') audio.stopTension();
  const info = $('#pauseGameInfo');
  if (info) {
    const modeName = t(`mode_${app.selectedMode}`) || app.selectedMode.toUpperCase();
    info.innerHTML = `<span class="pause-mode-badge">${modeName}</span><span class="pause-score">${game.score} ${t('score')}</span>`;
    if (app.selectedMode === 'sequenz') {
      info.innerHTML += `<span class="pause-seq-warn">${t('sequenz_pause_warn')}</span>`;
    }
  }
  const pauseAd = $('#pauseAdBanner');
  if (pauseAd) pauseAd.classList.toggle('hidden', isAdFree(save));
  $('#pauseOverlay')?.classList.add('active');
}

export function resumeGame() {
  const { game, audio } = app;
  game.resume();
  audio.startMusic();
  /* Memo re-reveal is handled by the engine's resume() via callbacks */
  $('#pauseOverlay')?.classList.remove('active');
}

export function restartGame(showTutorial, showResults, showHome, showContinuePrompt) {
  const { game, audio } = app;
  $('#pauseOverlay')?.classList.remove('active');
  game.stop();
  audio.stopMusic();
  if (typeof audio.stopTension === 'function') audio.stopTension();
  app.swipe?.unbind();
  app.effects?.cleanup();
  cleanupGameClasses();
  startGame(false, app.pendingDaily, showTutorial, showResults, showHome, showContinuePrompt);
}

export function quitGame(showHome) {
  const { game, audio, effects } = app;
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  if (window.__gameScrollBlocker) { window.__gameScrollBlocker.el?.removeEventListener('touchmove', window.__gameScrollBlocker.fn); window.__gameScrollBlocker = null; }
  $('#pauseOverlay')?.classList.remove('active');
  game.stop();
  audio.stopMusic();
  if (typeof audio.stopTension === 'function') audio.stopTension();
  app.swipe?.unbind();
  effects?.resetMultiplierBg();
  effects?.stopAmbient();
  if (typeof effects?.dangerZone === 'function') effects.dangerZone(false);
  effects?.cleanup();
  cleanupGameClasses();
  showHome();
}

export function stopPractice(showHome) {
  const { game, audio, effects, swipe } = app;
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  if (window.__gameScrollBlocker) { window.__gameScrollBlocker.el?.removeEventListener('touchmove', window.__gameScrollBlocker.fn); window.__gameScrollBlocker = null; }
  game.stop();
  audio.stopMusic();
  audio.stopTension?.();
  swipe?.unbind();
  effects?.resetMultiplierBg();
  effects?.stopAmbient();
  effects?.stopFever?.();
  effects?.dangerZone?.(false);
  effects?.cleanup();
  cleanupGameClasses();
  showHome();
}
