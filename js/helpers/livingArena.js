import { arenaWorld, arenaBlueprint } from '../renderers/arenaWorld.js';
import { arenaEnergy } from './arenaPhase.js';

/* Decoration only. No persistent frame loop or game-engine timers. Optional
   pointer depth coalesces events into one frame and never reads hit geometry. */
let stage = null;
let signal = null;
let scenery = null;
let impulse = null;
let confirmationTimer = null;
let listeners = null;
let active = false;
let depthEnabled = false;
let depthListeners = null;
let depthFrame = 0;
let depthX = 0;
let depthY = 0;
let world = arenaWorld('klassik');

function resetDepth() {
  if (depthFrame) cancelAnimationFrame(depthFrame);
  depthFrame = 0;
  depthX = depthY = 0;
  scenery?.style.removeProperty('transform');
}

function pointerDepth(event) {
  if (event.isPrimary === false || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
  depthX = Math.max(-1, Math.min(1, event.clientX / Math.max(1, innerWidth) * 2 - 1)) * 4;
  depthY = Math.max(-1, Math.min(1, event.clientY / Math.max(1, innerHeight) * 2 - 1)) * 3;
  if (!depthFrame) depthFrame = requestAnimationFrame(() => {
    depthFrame = 0;
    if (scenery) scenery.style.transform = `translate3d(${depthX.toFixed(2)}px,${depthY.toFixed(2)}px,0)`;
  });
}

function syncDepth() {
  const enabled = depthEnabled && active && !document.hidden && motionAllowed()
    && document.body.dataset.perfMode === 'high';
  if (!enabled) {
    depthListeners?.abort();
    depthListeners = null;
    resetDepth();
  } else if (!depthListeners && stage && scenery) {
    depthListeners = new AbortController();
    const options = { signal: depthListeners.signal, passive: true };
    const field = stage.parentElement;
    field.addEventListener('pointermove', pointerDepth, options);
    for (const type of ['pointerleave', 'pointerup', 'pointercancel']) field.addEventListener(type, resetDepth, options);
    window.addEventListener('resize', resetDepth, options);
  }
}

function motionAllowed() {
  return document.body.dataset.perfMode !== 'low'
    && !document.body.hasAttribute('data-reduced-motion')
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clearConfirmation() {
  clearTimeout(confirmationTimer);
  confirmationTimer = null;
  impulse?.cancel();
  impulse = null;
  stage?.removeAttribute('data-confirmed-direction');
  stage?.removeAttribute('data-impact');
  stage?.classList.remove('resonance-hit');
}

function syncActivity() {
  const moving = active && !document.hidden && motionAllowed();
  stage?.toggleAttribute('data-live', moving);
  if (!moving) clearConfirmation();
  syncDepth();
}

function policyChanged() {
  clearConfirmation();
  syncActivity();
}

export const livingArena = {
  configure(mode, depth = false) {
    resetDepth();
    world = arenaWorld(mode);
    depthEnabled = Boolean(depth);
    const root = document.getElementById('resonanceStage');
    stage = root;
    signal = root?.querySelector('.arena-signal');
    scenery = root?.querySelector('.arena-scenery');
    if (root) {
      root.dataset.world = world.id;
      root.dataset.energy = 'calm';
      root.dataset.phase = 'calm';
      root.parentElement.dataset.arenaMode = world.id;
      if (scenery) scenery.innerHTML = arenaBlueprint(world.id);
    }
    syncDepth();
  },

  setDepthEnabled(value) {
    depthEnabled = Boolean(value);
    syncDepth();
  },

  setEnergy(streak = 0, fever = false) {
    if (!stage) return;
    const energy = arenaEnergy(world.id, streak, fever);
    if (stage.dataset.energy !== energy) stage.dataset.energy = energy;
  },

  setPhase(phase) {
    if (stage && stage.dataset.phase !== phase) stage.dataset.phase = phase;
  },

  setActive(value) {
    active = Boolean(value);
    if (active && !listeners) {
      stage = document.getElementById('resonanceStage');
      signal = stage?.querySelector('.arena-signal');
      scenery = stage?.querySelector('.arena-scenery');
      if (!stage) return;
      listeners = new AbortController();
      const options = { signal: listeners.signal };
      document.addEventListener('visibilitychange', syncActivity, options);
      window.addEventListener('scs:perftier', policyChanged, options);
      window.addEventListener('scs:motionpreference', policyChanged, options);
    }
    syncActivity();
  },

  /* Coordinates come from the game's existing cached geometry, and are only
     requested on high quality. The impulse is cancelled BEFORE every spawn. */
  confirm(direction, getDisplacement, quality = 'good') {
    clearConfirmation();
    if (!active || !stage || document.hidden || !direction) return;
    stage.dataset.confirmedDirection = direction;
    stage.classList.add('resonance-hit');
    stage.dataset.impact = quality;
    if (motionAllowed() && document.body.dataset.perfMode === 'high' && signal?.animate) {
      const point = getDisplacement?.();
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
        const angle = Math.atan2(point.y, point.x);
        const animation = signal.animate([
          { transform: `translate3d(0,0,0) rotate(${angle}rad) scaleX(.4)`, opacity: 0 },
          { opacity: .85, offset: .2 },
          { transform: `translate3d(${point.x}px,${point.y}px,0) rotate(${angle}rad) scaleX(1)`, opacity: 0 },
        ], { duration: 70, easing: 'ease-out' });
        impulse = animation;
        animation.onfinish = () => { if (impulse === animation) impulse = null; };
      }
    }
    confirmationTimer = setTimeout(clearConfirmation, 260);
  },

  clearConfirmation,

  reset() {
    active = false;
    syncDepth();
    clearConfirmation();
    stage?.removeAttribute('data-live');
    stage?.removeAttribute('data-energy');
    stage?.removeAttribute('data-world');
    stage?.removeAttribute('data-phase');
    stage?.removeAttribute('data-impact');
    stage?.parentElement?.removeAttribute('data-arena-mode');
    if (scenery) scenery.replaceChildren();
    listeners?.abort();
    listeners = null;
    stage = signal = scenery = null;
  },
};
