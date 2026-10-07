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
  if (document.body.dataset.perfMode === 'low') document.body.classList.add('low-perf');
  if (!pinned) startGovernor();
  if (reducedMotionActive()) {
    document.body.dataset.reducedMotion = 'true';
  }
  /* React if the user toggles reduced-motion at OS level */
  try {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (mql.matches) document.body.dataset.reducedMotion = 'true';
      else delete document.body.dataset.reducedMotion;
    };
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

/* A tier the governor measured earlier can only lower the detected one */
function restoreTier(detected) {
  try {
    const saved = localStorage.getItem(TIER_KEY);
    if (TIERS.includes(saved) && TIERS.indexOf(saved) > TIERS.indexOf(detected)) return saved;
  } catch { /* storage unavailable */ }
  return detected;
}
let govRaf = 0;

function stepDown() {
  const cur = document.body.dataset.perfMode || 'high';
  const next = TIERS[Math.min(TIERS.indexOf(cur) + 1, TIERS.length - 1)];
  if (next === cur) return false;
  document.body.dataset.perfMode = next;
  try { localStorage.setItem(TIER_KEY, next); } catch { /* storage unavailable */ }
  if (next === 'low') document.body.classList.add('low-perf');
  window.dispatchEvent(new CustomEvent('scs:perftier', { detail: { tier: next } }));
  return true;
}

function startGovernor() {
  if (govRaf || typeof requestAnimationFrame !== 'function') return;
  let last = 0;
  let slow = 0;
  let frames = 0;
  const tick = (now) => {
    if (document.hidden) { last = 0; slow = 0; frames = 0; govRaf = requestAnimationFrame(tick); return; }
    if (last) {
      const dt = now - last;
      /* ignore stalls from tab switches / app resume */
      if (dt < 250) {
        frames++;
        if (dt > 24) slow++;
        if (frames >= 90) {
          if (slow / frames > 0.25 && !stepDown()) { /* already at floor */ }
          slow = 0; frames = 0;
        }
      }
    }
    last = now;
    const tier = document.body.dataset.perfMode;
    if (tier === 'low' && frames === 0) { govRaf = 0; return; }
    govRaf = requestAnimationFrame(tick);
  };
  govRaf = requestAnimationFrame(tick);
}
