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

let _perfClass = 'high';

export function getPerfClass() { return _perfClass; }
export function isLowPerf()    { return _perfClass === 'low'; }
export function isReducedMotion() { return reducedMotionActive(); }

export function initPerfMode() {
  if (typeof document === 'undefined' || !document.body) return;
  _perfClass = detectClass();
  document.body.dataset.perfMode = _perfClass;
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
