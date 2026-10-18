/* ═══════════════════════════════════════
   perfMode — single source of truth for
   device-class hints & user motion prefs.

   - body[data-perf-mode="low"|"mid"|"high"]
   - body[data-reduced-motion]   (when user set)

   Other modules (effects.js, ResultsScreen,
   onboarding) gate expensive effects on these
   datasets so the cost is paid in one place.
   ═══════════════════════════════════════ */

function detectClass() {
  const nav = (typeof navigator !== 'undefined') ? navigator : {};
  const mem = nav.deviceMemory || 8;
  const cores = nav.hardwareConcurrency || 8;
  if (mem <= 4 || cores <= 4) return 'low';
  if (mem <= 6 || cores <= 6) return 'mid';
  return 'high';
}

function reducedMotionActive() {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function applyMotionPreference(userReduced) {
  if (typeof document === 'undefined' || !document.body) return;
  if (userReduced !== undefined) document.body.toggleAttribute('data-user-reduced-motion', Boolean(userReduced));
  const reduced = document.body.hasAttribute('data-user-reduced-motion') || reducedMotionActive();
  document.body.toggleAttribute('data-reduced-motion', reduced);
  window.dispatchEvent(new CustomEvent('scs:motionpreference', { detail: { reduced } }));
}

/* QA builds (localStorage scsQa=1) can pin a tier so benchmarks compare
   like with like instead of racing the governor's step-downs. */
function pinnedQaTier() {
  try {
    if (localStorage.getItem('scsQa') !== '1') return null;
    const tier = localStorage.getItem('scsQaPerfTier');
    return TIERS.includes(tier) ? tier : null;
  } catch { return null; }
}

export function initPerfMode() {
  if (typeof document === 'undefined' || !document.body) return;
  const pinned = pinnedQaTier();
  document.body.dataset.perfMode = pinned || restoreTier(detectClass());
  document.body.classList.toggle('low-perf', document.body.dataset.perfMode === 'low');
  governorEnabled = !pinned;
  document.addEventListener('visibilitychange', () => {
    stopGovernor();
    if (!document.hidden && gameplayActive) startGovernor();
  });
  applyMotionPreference();
  /* React if the user toggles reduced-motion at OS level */
  try {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => applyMotionPreference();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', apply);
    } else if (typeof mql.addListener === 'function') {
      mql.addListener(apply);
    }
  } catch { /* matchMedia not available — ignore */ }
}

/* Runtime FPS governor: steps the tier down when frames stay slow.
   Never steps back up, so effects don't flicker mid-session. */
const TIERS = ['high', 'mid', 'low'];
const TIER_KEY = 'scs_perf_tier';

/* Keep thermal/load decisions within this tab session, not permanently across
   visits after a single slow startup or a backgrounded browser. */
function restoreTier(detected) {
  try {
    const saved = sessionStorage.getItem(TIER_KEY);
    if (TIERS.includes(saved) && TIERS.indexOf(saved) > TIERS.indexOf(detected)) return saved;
  } catch { /* storage unavailable */ }
  return detected;
}
let govRaf = 0;
let governorEnabled = false;
let gameplayActive = false;

export function setGameplayPerformanceActive(active) {
  gameplayActive = Boolean(active);
  stopGovernor();
  if (gameplayActive) startGovernor();
}

function stopGovernor() {
  if (govRaf) cancelAnimationFrame(govRaf);
  govRaf = 0;
}

function stepDown() {
  const cur = document.body.dataset.perfMode || 'high';
  const next = TIERS[Math.min(TIERS.indexOf(cur) + 1, TIERS.length - 1)];
  if (next === cur) return false;
  document.body.dataset.perfMode = next;
  try { sessionStorage.setItem(TIER_KEY, next); } catch { /* storage unavailable */ }
  if (next === 'low') document.body.classList.add('low-perf');
  window.dispatchEvent(new CustomEvent('scs:perftier', { detail: { tier: next } }));
  return true;
}

function startGovernor() {
  if (!governorEnabled || govRaf || document.hidden || document.body.dataset.perfMode === 'low' || typeof requestAnimationFrame !== 'function') return;
  let last = 0;
  let warmupUntil = 0;
  let slow = 0;
  let frames = 0;
  let elapsed = 0;
  let badWindows = 0;
  const tick = (now) => {
    govRaf = 0;
    if (document.hidden || !gameplayActive) return;
    if (!warmupUntil) warmupUntil = now + 750;
    if (last && now >= warmupUntil) {
      const dt = now - last;
      /* Resume gaps are not load samples; sustained 250–1000ms frames ARE. */
      if (dt < 1000) {
        frames++;
        elapsed += dt;
        if (dt > 24) slow++;
        if (elapsed >= 1500 && frames >= 6) {
          badWindows = slow / frames > 0.25 ? badWindows + 1 : 0;
          if (badWindows >= 2 || (slow / frames > 0.5 && elapsed / frames > 50)) {
            stepDown();
            badWindows = 0;
            warmupUntil = now + 500;
          }
          slow = 0; frames = 0; elapsed = 0;
        }
      } else {
        warmupUntil = now + 750;
        slow = 0; frames = 0; elapsed = 0; badWindows = 0;
      }
    }
    last = now;
    const tier = document.body.dataset.perfMode;
    if (tier === 'low') return;
    govRaf = requestAnimationFrame(tick);
  };
  govRaf = requestAnimationFrame(tick);
}
