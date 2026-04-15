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
    fill.style.width = '0%';
    return;
  }
  const pct = Math.min(100, Math.max(0, (game.timer / app.gameDuration) * 100));
  fill.style.width = pct + '%';
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

  if (!practice && game.playType !== 'endless') {
    app.gameDuration = game.timer;
  } else {
    app.gameDuration = 0;
  }

  const timerBarFill = $('#timerBarFill');
  if (timerBarFill) {
    timerBarFill.style.width = (app.gameDuration > 0 ? '100%' : '0%');
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
