/* ═══════════════════════════════════════
   SCS Play — Wheel of Fortune
   Daily spin with streak milestones,
   bonus spin, and richer presentation.
   ═══════════════════════════════════════ */
import { t } from '../i18n.js';
import { $ } from '../helpers/dom.js';
import { EffectsManager } from '../effects.js';
import app from '../appState.js';

const PRIZES = [
  { type: 'life', amount: 1, weight: 25, color: '#EF4444', label: () => t('wheel_prize_life', { n: 1 }) },
  { type: 'life', amount: 2, weight: 8, color: '#F87171', label: () => t('wheel_prize_life', { n: 2 }) },
  { type: 'fire', amount: 3, weight: 28, color: '#FFA502', label: () => t('wheel_prize_fire', { n: 3 }) },
  { type: 'fire', amount: 10, weight: 12, color: '#FBBF24', label: () => t('wheel_prize_fire', { n: 10 }) },
  { type: 'xp', amount: 30, weight: 18, color: '#7C3AED', label: () => t('wheel_prize_xp', { n: 30 }) },
  { type: 'xp', amount: 150, weight: 4, color: '#9D4EDD', label: () => t('wheel_prize_xp', { n: 150 }) },
  { type: 'jackpot', amount: 0, weight: 2, color: '#FFD700', label: () => t('wheel_prize_jackpot') },
  { type: 'fire', amount: 5, weight: 3, color: '#EC4899', label: () => t('wheel_prize_fire', { n: 5 }) },
];

const SEGMENTS = PRIZES.slice(0, 8);
const FEATURED_SEGMENTS = [SEGMENTS[1], SEGMENTS[5], SEGMENTS[6]];
const STREAK_MILESTONES = [
  { every: 14, type: 'life', amount: 1, color: '#FFD700', label: () => t('wheel_prize_life', { n: 1 }) },
  { every: 7, type: 'fire', amount: 5, color: '#F59E0B', label: () => t('wheel_prize_fire', { n: 5 }) },
  { every: 3, type: 'xp', amount: 40, color: '#A855F7', label: () => t('wheel_prize_xp', { n: 40 }) },
];
const SEG_COUNT = SEGMENTS.length;
const SEG_ANGLE = (2 * Math.PI) / SEG_COUNT;

let spinning = false;
let currentAngle = 0;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function usedBaseSpinToday() {
  return app.save?.data?.lastWheelSpin === todayKey();
}

function hasBonusSpinUnlocked() {
  return app.save?.data?.wheelBonusSpinUnlockedDate === todayKey();
}

function hasBonusSpinUsed() {
  return app.save?.data?.wheelBonusSpinUsedDate === todayKey();
}

function hasBonusSpinAvailable() {
  return hasBonusSpinUnlocked() && !hasBonusSpinUsed();
}

function canSpinNow() {
  return !usedBaseSpinToday() || hasBonusSpinAvailable();
}

function isBonusSpinActive() {
  return usedBaseSpinToday() && hasBonusSpinAvailable();
}

function hasFinishedWheelToday() {
  return usedBaseSpinToday() && !hasBonusSpinAvailable();
}

function getWheelStreak() {
  return app.save?.data?.wheelStreak || 0;
}

function getUpcomingSpinStreak() {
  const save = app.save;
  if (!save) return 1;
  if (isBonusSpinActive()) return Math.max(1, save.data.wheelStreak || 1);

  const today = todayKey();
  const wasYesterday = save.data.lastWheelDate && isConsecutiveDay(save.data.lastWheelDate, today);
  return wasYesterday ? (save.data.wheelStreak || 0) + 1 : 1;
}

function getMilestoneBonus(streak) {
  for (const milestone of STREAK_MILESTONES) {
    if (streak > 0 && streak % milestone.every === 0) return milestone;
  }
  return null;
}

function getNextMilestone(streak) {
  if (streak < 3) return { days: 3 - streak, reward: STREAK_MILESTONES[2] };
  if (streak < 7) return { days: 7 - streak, reward: STREAK_MILESTONES[1] };
  if (streak < 14) return { days: 14 - streak, reward: STREAK_MILESTONES[0] };

  const remainder = streak % 14;
  return { days: remainder === 0 ? 14 : 14 - remainder, reward: STREAK_MILESTONES[0] };
}

function isPremiumPrize(prize) {
  return prize.type === 'jackpot'
    || (prize.type === 'life' && prize.amount >= 2)
    || (prize.type === 'xp' && prize.amount >= 150)
    || (prize.type === 'fire' && prize.amount >= 10);
}

function getPrizeWeight(prize, streak, bonusSpin = false) {
  let weight = prize.weight || 1;
  if (streak >= 7 && isPremiumPrize(prize)) weight *= 1.2;
  if (streak >= 14 && prize.type === 'jackpot') weight *= 1.6;
  if (bonusSpin && isPremiumPrize(prize)) weight *= 1.35;
  return weight;
}

function pickPrize(streak = 0, bonusSpin = false) {
  const weights = SEGMENTS.map(prize => getPrizeWeight(prize, streak, bonusSpin));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * totalWeight;

  for (let i = 0; i < SEGMENTS.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return 0;
}

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
    const prize = SEGMENTS[i];
    const grad = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
    grad.addColorStop(0, prize.color + '40');
    grad.addColorStop(0.5, prize.color + 'CC');
    grad.addColorStop(1, prize.color);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, start, end);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.rotate(start + SEG_ANGLE / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(prize.label(), r * 0.62, 0);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0, 0, r + 2, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,215,0,0.25)';
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(255,215,0,0.3)';
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const centerGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
  centerGrad.addColorStop(0, '#2a2a2a');
  centerGrad.addColorStop(1, '#1a1a1a');
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, 2 * Math.PI);
  ctx.fillStyle = centerGrad;
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(255,215,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.stroke();

  ctx.restore();
}

function pulsePointer() {
  const pointer = $('#wheelPointer');
  if (!pointer) return;
  pointer.classList.remove('ticking');
  requestAnimationFrame(() => pointer.classList.add('ticking'));
  clearTimeout(pointer._tickTimer);
  pointer._tickTimer = setTimeout(() => pointer.classList.remove('ticking'), 140);
}

function spinWheel(prizeIdx, bonusSpin = false) {
  return new Promise(resolve => {
    const canvas = $('#wheelCanvas');
    if (!canvas) return resolve();

    spinning = true;
    const targetAngle = -(prizeIdx * SEG_ANGLE + SEG_ANGLE / 2) - Math.PI / 2;
    const fullRotations = (bonusSpin ? 4 : 6) + Math.floor(Math.random() * 2);
    const totalAngle = fullRotations * 2 * Math.PI + (targetAngle - (currentAngle % (2 * Math.PI)));
    const endAngle = currentAngle + totalAngle;
    const duration = (bonusSpin ? 3200 : 4200) + Math.random() * 900;

    let lastTickSegment = -1;
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const tEase = 1 - progress;
      const eased = 1 - (tEase * tEase * tEase * tEase);
      const angle = currentAngle + totalAngle * eased;
      const normalized = ((angle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
      const tickSegment = Math.floor(normalized / SEG_ANGLE);

      if (tickSegment !== lastTickSegment && progress < 0.985) {
        lastTickSegment = tickSegment;
        pulsePointer();
        if (app.audio) app.audio.tap();
      }

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

async function applyPrize(prize) {
  const { save } = app;
  if (!save || !prize) return;

  if (prize.type === 'life') {
    await save.addLives(prize.amount);
  } else if (prize.type === 'fire') {
    save.data.fire = (save.data.fire || 0) + prize.amount;
    await save.save();
  } else if (prize.type === 'xp') {
    await save.grantXP(prize.amount);
  } else if (prize.type === 'jackpot') {
    await save.addLives(5);
    save.data.fire = (save.data.fire || 0) + 50;
    await save.save();
  }
}

function syncMetaUI() {
  const { save } = app;
  if (!save) return;

  const livesEl = $('#homeLivesCount');
  const fireEl = $('#homeFireCount');
  const levelNum = $('#xpLevelNum');
  const title = $('#xpTitle');
  const numbers = $('#xpNumbers');
  const percent = $('#xpPercent');
  const bar = $('#xpBarFill');
  const prog = save.getXPProgress();

  if (livesEl) livesEl.textContent = save.getLives();
  if (fireEl) fireEl.textContent = save.getFireBalance();
  if (bar) bar.style.width = (prog.pct * 100) + '%';
  if (levelNum) levelNum.textContent = `${t('level')} ${save.getLevel() + 1}`;
  if (title) title.textContent = save.getLevelName();
  if (numbers) numbers.textContent = `${prog.current.toLocaleString()} / ${prog.needed.toLocaleString()} XP`;
  if (percent) percent.textContent = `${Math.round(prog.pct * 100)}%`;
}

async function awardPrize(prizeIdx, streak, allowMilestone = true) {
  const prize = SEGMENTS[prizeIdx];
  const milestoneBonus = allowMilestone ? getMilestoneBonus(streak) : null;

  await applyPrize(prize);
  if (milestoneBonus) await applyPrize(milestoneBonus);

  syncMetaUI();
  return { prize, milestoneBonus };
}

function clearResultCard() {
  const resultCard = $('#wheelResultCard');
  const titleEl = $('#wheelResultTitle');
  const resultEl = $('#wheelResult');
  const extraEl = $('#wheelResultExtra');

  if (resultCard) {
    resultCard.classList.remove('revealed', 'premium');
    resultCard.style.removeProperty('--wheel-win-color');
  }
  if (titleEl) titleEl.textContent = '';
  if (resultEl) {
    resultEl.textContent = '';
    resultEl.classList.remove('wheel-result-show');
  }
  if (extraEl) {
    extraEl.textContent = '';
    extraEl.style.display = 'none';
  }
}

function renderPrizeStrip() {
  const strip = $('#wheelPrizeStrip');
  if (!strip) return;

  const upcomingStreak = getUpcomingSpinStreak();
  const milestoneBonus = isBonusSpinActive() ? null : getMilestoneBonus(upcomingStreak);
  const chips = FEATURED_SEGMENTS.map(prize => `
    <span class="wheel-prize-chip${isPremiumPrize(prize) ? ' premium' : ''}">${prize.label()}</span>
  `);

  if (milestoneBonus) {
    chips.unshift(`<span class="wheel-prize-chip streak">${t('wheel_milestone_bonus')} ${milestoneBonus.label()}</span>`);
  }

  strip.innerHTML = chips.join('');
}

function renderWheelStatus() {
  const card = $('#wheelCard');
  const btn = $('#btnWheel');
  const reward = $('#wheelReward');
  const streakPill = $('#wheelStreakPill');
  const subline = $('#wheelSubline');
  const overlayStreak = $('#wheelOverlayStreak');
  const overlayBonus = $('#wheelOverlayBonus');
  const statusNote = $('#wheelStatusNote');
  const spinBtn = $('#btnWheelSpin');
  const adBtn = $('#btnWheelAd');

  const streak = getWheelStreak();
  const upcomingStreak = getUpcomingSpinStreak();
  const nextMilestone = getNextMilestone(upcomingStreak);
  const milestoneBonus = isBonusSpinActive() ? null : getMilestoneBonus(upcomingStreak);
  const finished = hasFinishedWheelToday();
  const bonusSpin = isBonusSpinActive();
  const bonusReady = hasBonusSpinAvailable();
  const streakText = streak > 0 ? t('wheel_streak', { n: streak }) : '';
  const bonusText = milestoneBonus
    ? `${t('wheel_milestone_bonus')} ${milestoneBonus.label()}`
    : t('wheel_next_bonus', { n: nextMilestone.days, reward: nextMilestone.reward.label() });

  if (card) {
    card.classList.toggle('wheel-done', finished);
    card.classList.toggle('wheel-bonus-live', bonusReady);
  }
  if (btn) btn.textContent = bonusSpin ? t('wheel_bonus_spin') : finished ? t('wheel_used') : t('wheel_spin');
  if (reward) {
    if (finished) reward.textContent = t('wheel_used');
    else if (bonusReady) reward.textContent = t('wheel_bonus_ready');
    else reward.textContent = t('wheel_daily_spin');
  }
  if (streakPill) {
    streakPill.textContent = streakText;
    streakPill.style.display = streakText ? 'inline-flex' : 'none';
  }
  if (subline) subline.textContent = bonusReady ? t('wheel_bonus_ready') : bonusText;
  if (overlayStreak) overlayStreak.textContent = streakText || t('wheel_daily_spin');
  if (overlayBonus) overlayBonus.textContent = bonusReady ? t('wheel_bonus_ready') : bonusText;
  if (statusNote) {
    if (finished) statusNote.textContent = t('wheel_status_complete');
    else if (bonusReady) statusNote.textContent = t('wheel_bonus_ready');
    else if (usedBaseSpinToday() && !hasBonusSpinUnlocked()) statusNote.textContent = t('wheel_ad_spin');
    else statusNote.textContent = t('wheel_subtitle');
  }
  if (spinBtn) {
    spinBtn.disabled = !canSpinNow() || spinning;
    spinBtn.textContent = bonusSpin ? t('wheel_bonus_spin') : t('wheel_spin');
  }
  if (adBtn) {
    adBtn.style.display = usedBaseSpinToday() && !hasBonusSpinUnlocked() ? '' : 'none';
  }
}

function revealResult(result, bonusSpin) {
  const { prize, milestoneBonus } = result;
  const resultCard = $('#wheelResultCard');
  const titleEl = $('#wheelResultTitle');
  const resultEl = $('#wheelResult');
  const extraEl = $('#wheelResultExtra');

  if (titleEl) titleEl.textContent = bonusSpin ? t('wheel_bonus_spin') : t('wheel_won');
  if (resultEl) {
    resultEl.textContent = prize.label();
    resultEl.classList.add('wheel-result-show');
  }
  if (extraEl) {
    const parts = [];
    if (milestoneBonus) parts.push(`${t('wheel_milestone_bonus')} ${milestoneBonus.label()}`);
    extraEl.textContent = parts.join(' • ');
    extraEl.style.display = parts.length ? 'block' : 'none';
  }
  if (resultCard) {
    resultCard.style.setProperty('--wheel-win-color', prize.color);
    resultCard.classList.add('revealed');
    resultCard.classList.toggle('premium', prize.type === 'jackpot' || Boolean(milestoneBonus));
  }
}

export function showWheel() {
  const overlay = $('#wheelOverlay');
  if (!overlay) return;
  overlay.classList.add('active');

  const canvas = $('#wheelCanvas');
  if (canvas) drawWheel(canvas, currentAngle);

  clearResultCard();
  renderPrizeStrip();
  renderWheelStatus();
}

export function hideWheel() {
  const overlay = $('#wheelOverlay');
  if (overlay) overlay.classList.remove('active');
}

export function updateWheelCard() {
  renderWheelStatus();
}

export function bindWheel() {
  $('#btnWheel')?.addEventListener('click', () => showWheel());
  $('#btnWheelClose')?.addEventListener('click', () => hideWheel());

  $('#btnWheelSpin')?.addEventListener('click', async () => {
    if (spinning || !canSpinNow()) return;

    const { save } = app;
    const today = todayKey();
    const bonusSpin = isBonusSpinActive();
    const upcomingStreak = getUpcomingSpinStreak();
    const prizeIdx = pickPrize(upcomingStreak, bonusSpin);

    renderWheelStatus();
    await spinWheel(prizeIdx, bonusSpin);

    save.data.wheelSpinsToday = (save.data.wheelSpinsToday || 0) + 1;
    if (!bonusSpin) {
      const wasYesterday = save.data.lastWheelDate && isConsecutiveDay(save.data.lastWheelDate, today);
      save.data.lastWheelSpin = today;
      save.data.wheelStreak = wasYesterday ? (save.data.wheelStreak || 0) + 1 : 1;
      save.data.lastWheelDate = today;
    } else {
      save.data.wheelBonusSpinUsedDate = today;
    }

    const effectiveStreak = bonusSpin ? Math.max(1, save.data.wheelStreak || 1) : (save.data.wheelStreak || upcomingStreak);
    await save.save();

    const result = await awardPrize(prizeIdx, effectiveStreak, !bonusSpin);
    revealResult(result, bonusSpin);

    if (result.prize.type === 'jackpot' || result.milestoneBonus?.type === 'life') {
      const fx = new EffectsManager(document.body);
      fx.confetti();
    }

    renderPrizeStrip();
    renderWheelStatus();
    if (app.audio) app.audio.tap();
  });

  $('#btnWheelAd')?.addEventListener('click', async () => {
    if (spinning || hasBonusSpinUnlocked()) return;
    const { showRewardedAd } = await import('../services/AdService.js');
    const rewarded = await showRewardedAd(app.save);
    if (!rewarded) {
      const fx = new EffectsManager(document.body);
      fx.achievementToast(t('ad_failed') || 'Ad not available');
      return;
    }

    const today = todayKey();
    app.save.data.wheelBonusSpinUnlockedDate = today;
    await app.save.save();
    renderWheelStatus();
    const fx = new EffectsManager(document.body);
    fx.achievementToast(t('wheel_bonus_unlock_toast'));
  });

  $('#wheelOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'wheelOverlay') hideWheel();
  });
}

function isConsecutiveDay(prev, current) {
  const [py, pm, pd] = prev.split('-').map(Number);
  const [cy, cm, cd] = current.split('-').map(Number);
  const prevDate = new Date(py, pm - 1, pd);
  const currDate = new Date(cy, cm - 1, cd);
  const diff = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
  return diff === 1;
}
