/* ═══════════════════════════════════════
   SCS Play — Wheel of Fortune
   Daily spin for lives, fire, XP prizes.
   ═══════════════════════════════════════ */
import { CONFIG }    from '../config.js';
import { t }         from '../i18n.js';
import { $ }         from '../helpers/dom.js';
import { EffectsManager } from '../effects.js';
import app           from '../appState.js';

/* ─── Prize table (weighted) ─── */
const PRIZES = [
  { type: 'life', amount: 1,  weight: 30, color: '#EF4444', label: () => t('wheel_prize_life', { n: 1 }) },
  { type: 'life', amount: 2,  weight: 15, color: '#F87171', label: () => t('wheel_prize_life', { n: 2 }) },
  { type: 'fire', amount: 5,  weight: 25, color: '#FFA502', label: () => t('wheel_prize_fire', { n: 5 }) },
  { type: 'fire', amount: 15, weight: 10, color: '#FBBF24', label: () => t('wheel_prize_fire', { n: 15 }) },
  { type: 'xp',   amount: 50, weight: 15, color: '#7C3AED', label: () => t('wheel_prize_xp', { n: 50 }) },
  { type: 'xp',   amount: 200,weight: 3,  color: '#9D4EDD', label: () => t('wheel_prize_xp', { n: 200 }) },
  { type: 'jackpot', amount: 0, weight: 2, color: '#FFD700', label: () => t('wheel_prize_jackpot') },
  { type: 'fire', amount: 10, weight: 0,  color: '#EC4899', label: () => t('wheel_prize_fire', { n: 10 }) },
];

// Fill the 8th slice to make it 8 equal segments
const SEGMENTS = PRIZES.slice(0, 7).concat(PRIZES[7] || PRIZES[2]);
const SEG_COUNT = 8;
const SEG_ANGLE = (2 * Math.PI) / SEG_COUNT;

let spinning = false;
let currentAngle = 0;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function hasSpunToday() {
  return app.save?.data?.lastWheelSpin === todayKey();
}

/** Pick a prize index based on weights */
function pickPrize() {
  const totalWeight = SEGMENTS.reduce((s, p) => s + (p.weight || 1), 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < SEGMENTS.length; i++) {
    r -= (SEGMENTS[i].weight || 1);
    if (r <= 0) return i;
  }
  return 0;
}

/** Draw the wheel on canvas */
function drawWheel(canvas, angle) {
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = cx - 8;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  for (let i = 0; i < SEG_COUNT; i++) {
    const start = i * SEG_ANGLE;
    const end = start + SEG_ANGLE;

    // Segment fill
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, start, end);
    ctx.closePath();
    ctx.fillStyle = SEGMENTS[i].color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.save();
    ctx.rotate(start + SEG_ANGLE / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    const labelText = SEGMENTS[i].label();
    ctx.fillText(labelText, r * 0.62, 0);
    ctx.restore();
  }

  // Center circle
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, 2 * Math.PI);
  ctx.fillStyle = '#1F1F1F';
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

/** Animate the spin */
function spinWheel(prizeIdx) {
  return new Promise(resolve => {
    const canvas = $('#wheelCanvas');
    if (!canvas) return resolve();

    spinning = true;
    const targetSeg = prizeIdx;
    // Land in the middle of the target segment (top = -PI/2 is the pointer position)
    const targetAngle = -(targetSeg * SEG_ANGLE + SEG_ANGLE / 2) - Math.PI / 2;
    const fullRotations = 4 + Math.floor(Math.random() * 3); // 4-6 full rotations
    const totalAngle = fullRotations * 2 * Math.PI + (targetAngle - (currentAngle % (2 * Math.PI)));
    const endAngle = currentAngle + totalAngle;
    const duration = 3500 + Math.random() * 1500; // 3.5-5 seconds

    const start = performance.now();
    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const angle = currentAngle + totalAngle * eased;
      drawWheel(canvas, angle);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        currentAngle = endAngle;
        spinning = false;
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

/** Award prize to player */
async function awardPrize(prizeIdx) {
  const prize = SEGMENTS[prizeIdx];
  const { save } = app;

  if (prize.type === 'life') {
    await save.addLives(prize.amount);
  } else if (prize.type === 'fire') {
    save.data.fire = (save.data.fire || 0) + prize.amount;
    save.save();
  } else if (prize.type === 'xp') {
    save.addXP(prize.amount);
  } else if (prize.type === 'jackpot') {
    await save.addLives(5);
    save.data.fire = (save.data.fire || 0) + 50;
    save.save();
  }

  // Update UI
  const livesEl = $('#homeLivesCount');
  if (livesEl) livesEl.textContent = save.getLives();
  const fireEl = $('#homeFireCount');
  if (fireEl) fireEl.textContent = save.getFireBalance();
}

/** Show the wheel overlay */
export function showWheel() {
  const overlay = $('#wheelOverlay');
  if (!overlay) return;
  overlay.classList.add('active');

  const canvas = $('#wheelCanvas');
  if (canvas) drawWheel(canvas, currentAngle);

  const resultEl = $('#wheelResult');
  if (resultEl) resultEl.textContent = '';

  const spinBtn = $('#btnWheelSpin');
  const adBtn = $('#btnWheelAd');
  const used = hasSpunToday();

  if (spinBtn) {
    spinBtn.disabled = used;
    spinBtn.textContent = used ? t('wheel_used') : t('wheel_spin');
  }
  if (adBtn) adBtn.style.display = used ? '' : 'none';
}

export function hideWheel() {
  const overlay = $('#wheelOverlay');
  if (overlay) overlay.classList.remove('active');
}

/** Update the wheel card on home screen */
export function updateWheelCard() {
  const card = $('#wheelCard');
  const btn = $('#btnWheel');
  const reward = $('#wheelReward');
  if (!card) return;

  const used = hasSpunToday();
  card.classList.toggle('wheel-done', used);
  if (btn) btn.textContent = used ? t('wheel_used') : t('wheel_spin');
  if (reward) reward.textContent = used ? t('wheel_used') : t('wheel_daily_spin');
}

/** Bind wheel events */
export function bindWheel() {
  $('#btnWheel')?.addEventListener('click', () => showWheel());
  $('#btnWheelClose')?.addEventListener('click', () => hideWheel());

  $('#btnWheelSpin')?.addEventListener('click', async () => {
    if (spinning || hasSpunToday()) return;
    const prizeIdx = pickPrize();

    await spinWheel(prizeIdx);
    await awardPrize(prizeIdx);

    // Mark as spun today
    const { save } = app;
    const today = todayKey();
    const wasYesterday = save.data.lastWheelDate && isConsecutiveDay(save.data.lastWheelDate, today);
    save.data.lastWheelSpin = today;
    save.data.wheelSpinsToday = (save.data.wheelSpinsToday || 0) + 1;
    save.data.wheelStreak = wasYesterday ? (save.data.wheelStreak || 0) + 1 : 1;
    save.data.lastWheelDate = today;
    save.save();

    // Show result
    const resultEl = $('#wheelResult');
    const prize = SEGMENTS[prizeIdx];
    if (resultEl) {
      resultEl.textContent = `${t('wheel_won')} ${prize.label()}`;
      resultEl.classList.add('wheel-result-show');
    }

    // Confetti on jackpot
    if (prize.type === 'jackpot') {
      const fx = new EffectsManager(document.body);
      fx.confetti();
    }

    // Disable spin button
    const spinBtn = $('#btnWheelSpin');
    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.textContent = t('wheel_used');
    }

    // Update home card
    updateWheelCard();

    if (app.audio) app.audio.tap();
  });

  // ad spin (placeholder — hooks into AdService)
  $('#btnWheelAd')?.addEventListener('click', async () => {
    if (spinning) return;
    const { showRewardedAd } = await import('../services/AdService.js');
    const rewarded = await showRewardedAd(app.save);
    if (!rewarded) return;

    // Grant extra spin
    app.save.data.lastWheelSpin = null; // temporarily allow
    const spinBtn = $('#btnWheelSpin');
    if (spinBtn) {
      spinBtn.disabled = false;
      spinBtn.textContent = t('wheel_spin');
    }
  });

  // Close on overlay click
  $('#wheelOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'wheelOverlay') hideWheel();
  });
}

function isConsecutiveDay(prev, current) {
  const [py, pm, pd] = prev.split('-').map(Number);
  const [cy, cm, cd] = current.split('-').map(Number);
  const prevDate = new Date(py, pm - 1, pd);
  const currDate = new Date(cy, cm - 1, cd);
  const diff = (currDate - prevDate) / (1000 * 60 * 60 * 24);
  return diff === 1;
}
