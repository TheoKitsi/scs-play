/* ═══════════════════════════════════════
   SCS Play — Tutorial Screen
   4-step interactive onboarding carousel
   with interactive swipe demo on step 2.
   ═══════════════════════════════════════ */
import { t }                       from '../i18n.js';
import { $, $$, showScreen } from '../helpers/dom.js';
import app                          from '../appState.js';
import { CONFIG } from '../config.js';
import { shapeSVG } from '../renderers/shapes.js';
import { icon } from '../renderers/icons.js';

let _step = 0;
let _tryBound = false;
let _advanceTimer = null;
let _feedbackTimer = null;
const stations = ['circle', 'square', 'triangle', 'star'];

export function showTutorial() {
  clearTimeout(_advanceTimer);
  _step = 0;
  const colors = CONFIG.COLORS[app.colorblind ? 'colorblind' : 'normal'];
  for (const selector of ['.tut-corner', '.tut-try-corner']) {
    $$(selector).forEach((corner, index) => {
      corner.innerHTML = shapeSVG(stations[index], colors[index], 48);
      const dir = corner.dataset.tutorialDir;
      if (dir) corner.setAttribute('aria-label', t(`direction_${dir}`));
    });
  }
  $$('.tut-shape-dot').forEach(el => { el.innerHTML = shapeSVG(stations[0], colors[0], 48); });
  const hint = $('#tutTryHint'), feedback = $('#tutTryFeedback');
  if (hint.parentElement.id === 'tutTryArea') {
    // Reserve a separate line for instructions so they never cover a control.
    const caption = document.createElement('div');
    caption.className = 'tut-practice-caption';
    $('#tutTryArea').after(caption);
    caption.append(hint, feedback);
    feedback.setAttribute('role', 'status');
  }
  $('.tut-speed-icon').innerHTML = icon('bolt');
  $('.tut-x-fire').innerHTML = `${icon('fire')} ×5`;
  showScreen('tutorial', app);
  renderStep();
}

/* ─── Interactive swipe demo (step 2) ─── */
let _tryStartX = 0, _tryStartY = 0, _tryActive = false;
const SWIPE_DIST = 30;

function _bindTrySwipe() {
  if (_tryBound) return;
  _tryBound = true;

  const area = $('#tutTryArea');
  if (!area) return;
  area.addEventListener('click', event => {
    const dir = event.target.closest('[data-tutorial-dir]')?.dataset.tutorialDir;
    if (event.detail === 0 && dir && _step === 1) _showTryFeedback(dir === 'ul', dir);
  });

  area.addEventListener('pointerdown', (e) => {
    _tryStartX = e.clientX;
    _tryStartY = e.clientY;
    _tryActive = true;
    area.setPointerCapture(e.pointerId);
    const center = $('#tutTryCenter');
    if (center) center.style.transform = 'translate(-50%,-50%) scale(1.1)';
  });

  area.addEventListener('pointermove', (e) => {
    if (!_tryActive) return;
    const dx = e.clientX - _tryStartX;
    const dy = e.clientY - _tryStartY;
    const center = $('#tutTryCenter');
    if (center) {
      const mx = Math.max(-20, Math.min(20, dx * 0.3));
      const my = Math.max(-20, Math.min(20, dy * 0.3));
      center.style.transform = `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px)) scale(1.1)`;
    }
  });

  area.addEventListener('pointerup', (e) => {
    if (!_tryActive) return;
    _tryActive = false;
    const center = $('#tutTryCenter');
    if (center) center.style.transform = 'translate(-50%,-50%)';

    const dx = e.clientX - _tryStartX;
    const dy = e.clientY - _tryStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    /* Tap detection — if distance is short, check if a corner was tapped */
    if (dist < SWIPE_DIST) {
      const tapped = document.elementFromPoint(e.clientX, e.clientY);
      const cornerEl = tapped?.closest('.tut-try-corner');
      if (cornerEl) {
        const isUL = cornerEl.classList.contains('tut-tc-ul');
        const isUR = cornerEl.classList.contains('tut-tc-ur');
        const isDL = cornerEl.classList.contains('tut-tc-dl');
        const isDR = cornerEl.classList.contains('tut-tc-dr');
        const dir = isUL ? 'ul' : isUR ? 'ur' : isDL ? 'dl' : isDR ? 'dr' : null;
        if (dir) { _showTryFeedback(dir === 'ul', dir); return; }
      }
      return;
    }

    /* Determine swipe direction (4 diagonal) */
    const isUp = dy < 0;
    const isLeft = dx < 0;
    let dir;
    if (isUp && isLeft)  dir = 'ul';
    else if (isUp)       dir = 'ur';
    else if (isLeft)     dir = 'dl';
    else                 dir = 'dr';

    const correct = dir === 'ul'; // red is top-left
    _showTryFeedback(correct, dir);
  });

  area.addEventListener('pointercancel', () => {
    _tryActive = false;
    const center = $('#tutTryCenter');
    if (center) center.style.transform = 'translate(-50%,-50%)';
  });
}

function _showTryFeedback(correct, dir) {
  const feedback = $('#tutTryFeedback');
  const hint = $('#tutTryHint');

  /* Flash the target corner */
  const cornerEl = $(`.tut-try-corner.tut-tc-${dir}`);
  if (cornerEl) {
    cornerEl.classList.add('tut-corner-glow');
    setTimeout(() => cornerEl.classList.remove('tut-corner-glow'), 600);
  }

  if (feedback) {
    feedback.textContent = correct ? t('correct') : t('tutorial_try_again');
    feedback.style.color = 'var(--text)';
    clearTimeout(_feedbackTimer);
    feedback.classList.add('show');
    hint.style.visibility = 'hidden';
    _feedbackTimer = setTimeout(() => {
      feedback.classList.remove('show');
      hint.style.visibility = '';
    }, 1200);
  }

  if (correct) {
    if (app.audio) app.audio.correct(1);
    /* Auto-advance to next step after success */
    clearTimeout(_advanceTimer);
    _advanceTimer = setTimeout(() => {
      if (_step === 1 && app.currentScreen === 'tutorial') {
        const moveFocus = $('#tutTryArea').contains(document.activeElement);
        _step++;
        renderStep();
        if (moveFocus) $('#btnTutorialNext').focus({ preventScroll: true });
      }
    }, 800);
  } else {
    if (app.audio) app.audio.wrong();
  }
}

function renderStep() {
  clearTimeout(_advanceTimer);
  clearTimeout(_feedbackTimer);
  $('#tutTryHint').style.visibility = '';
  $('#tutTryFeedback').classList.remove('show');
  $('#tutTryFeedback').textContent = '';
  const slides = $$('#tutorialCarousel .tutorial-slide');
  const dots = $$('#tutorialDots .tut-dot');
  const prevBtn = $('#btnTutorialPrev');
  const nextBtn = $('#btnTutorialNext');

  slides.forEach((s, i) => {
    s.inert = i !== _step;
    s.setAttribute('aria-hidden', String(i !== _step));
    s.classList.remove('active', 'exit-left');
    if (i === _step) s.classList.add('active');
    else if (i < _step) s.classList.add('exit-left');
  });
  dots.forEach((d, i) => d.classList.toggle('active', i === _step));
  const progress = $('#tutorialStepCount');
  if (progress) progress.textContent = t('studio_step', { n: _step + 1, total: slides.length });

  if (prevBtn) prevBtn.style.visibility = _step === 0 ? 'hidden' : 'visible';
  if (nextBtn) nextBtn.textContent = _step >= slides.length - 1 ? t('lets_go') : t('tutorial_next');
  /* On the last step "Los geht's!" already does what skip would do */
  const skipBtn = $('#btnTutorialSkip');
  if (skipBtn) skipBtn.style.visibility = _step >= slides.length - 1 ? 'hidden' : 'visible';

  /* Bind interactive swipe when step 2 is shown */
  if (_step === 1) _bindTrySwipe();
}

export function tutorialNext(onFinish) {
  const slides = $$('#tutorialCarousel .tutorial-slide');
  if (_step >= slides.length - 1) {
    onFinish();
  } else {
    _step++;
    renderStep();
    app.audio.tap();
  }
}

export function tutorialPrev() {
  if (_step > 0) {
    _step--;
    renderStep();
    app.audio.tap();
  }
}

export async function tutorialFinish(doCountdown, beginGame) {
  await app.save.setSetting('tutorialDone', true);
  app.engagement?.trackTutorialComplete();
  showScreen('game', app);
  doCountdown(() => beginGame(false, app.pendingDaily));
}
