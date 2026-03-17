/* ═══════════════════════════════════════
   SCS Play — Input (Swipe + Tap + Trail)
   Beginner(4) / Expert(8) / Ultra(12) dirs
   Tap-to-corner: tap a corner to answer
   ═══════════════════════════════════════ */
import { CONFIG } from './config.js';

/* ─── Corner hit-test padding (px) for fat-finger tolerance ─── */
const TAP_HIT_PADDING = 12;

export class SwipeHandler {
  constructor(el, mode = 'beginner') {
    this.el = el;
    this.mode = mode;
    this.onSwipe = null;
    this.onTap = null;
    this.onCornerTap = null;   /* (dir, timestamp) — tapped a corner */
    this.onCenterTap = null;   /* () — tapped the center area */
    this.onTrailStart = null;
    this.onTrailMove  = null;
    this.onTrailEnd   = null;

    this._sx = 0; this._sy = 0; this._st = 0;
    this._active = false;
    this._bound = false;
    this._isTouch = false;

    this._onStart = this._start.bind(this);
    this._onMove  = this._move.bind(this);
    this._onEnd   = this._end.bind(this);
  }

  setMode(m) { this.mode = m; }

  bind() {
    if (this._bound) return;
    this.el.addEventListener('touchstart', this._onStart, { passive: true });
    this.el.addEventListener('touchmove',  this._onMove,  { passive: true });
    this.el.addEventListener('touchend',   this._onEnd,   { passive: true });
    this.el.addEventListener('mousedown',  this._onStart, { passive: true });
    this.el.addEventListener('mousemove',  this._onMove,  { passive: true });
    this.el.addEventListener('mouseup',    this._onEnd,   { passive: true });
    this._bound = true;
  }

  unbind() {
    this.el.removeEventListener('touchstart', this._onStart);
    this.el.removeEventListener('touchmove',  this._onMove);
    this.el.removeEventListener('touchend',   this._onEnd);
    this.el.removeEventListener('mousedown',  this._onStart);
    this.el.removeEventListener('mousemove',  this._onMove);
    this.el.removeEventListener('mouseup',    this._onEnd);
    this._bound = false;
    this._active = false;
  }

  _start(e) {
    if (e.touches) this._isTouch = true;
    else if (this._isTouch) return;
    const p = e.touches ? e.touches[0] : e;
    this._sx = p.clientX;
    this._sy = p.clientY;
    this._st = performance.now();
    this._active = true;
    if (this.onTrailStart) this.onTrailStart(p.clientX, p.clientY);
  }

  _move(e) {
    if (!this._active) return;
    if (this._isTouch && !e.touches) return;
    const p = e.touches ? e.touches[0] : e;
    if (this.onTrailMove) this.onTrailMove(p.clientX, p.clientY);
  }

  _end(e) {
    if (this._isTouch && !e.changedTouches) return;
    if (!this._active) return;
    this._active = false;
    const p = e.changedTouches ? e.changedTouches[0] : e;
    const dx = p.clientX - this._sx;
    const dy = p.clientY - this._sy;
    const dt = performance.now() - this._st;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (e.changedTouches) {
      setTimeout(() => { this._isTouch = false; }, 400);
    }

    if (dt > CONFIG.SWIPE_MAX_TIME) {
      if (this.onTrailEnd) this.onTrailEnd();
      return;
    }

    /* ── Tap gesture (no significant movement) ── */
    if (dist < CONFIG.SWIPE_MIN_DISTANCE) {
      if (this.onTrailEnd) this.onTrailEnd();
      const tapX = p.clientX, tapY = p.clientY;

      /* Hit-test against visible corner shapes */
      if (this.onCornerTap) {
        const hit = this._hitTestCorner(tapX, tapY);
        if (hit) {
          this.onCornerTap(hit, performance.now());
          return;
        }
      }

      /* Hit-test center platform (for Memo peek) */
      if (this.onCenterTap) {
        const center = this.el.querySelector('#centerPlatform');
        if (center) {
          const r = center.getBoundingClientRect();
          if (tapX >= r.left - TAP_HIT_PADDING && tapX <= r.right + TAP_HIT_PADDING &&
              tapY >= r.top - TAP_HIT_PADDING && tapY <= r.bottom + TAP_HIT_PADDING) {
            this.onCenterTap();
            return;
          }
        }
      }

      /* Fallback: generic tap */
      if (this.onTap) this.onTap();
      return;
    }

    /* ── Swipe gesture ── */
    const dir = this._classify(dx, dy);
    if (dir && this.onSwipe) {
      this.onSwipe(dir, performance.now());
    } else {
      if (this.onTrailEnd) this.onTrailEnd();
    }
  }

  /* ─── Hit-test visible corner shapes ─── */
  _hitTestCorner(x, y) {
    const corners = this.el.querySelectorAll('.corner-shape');
    for (const el of corners) {
      /* Skip hidden corners (edge-only/ultra-only not in current mode) */
      if (el.offsetParent === null) continue;
      if (!el.innerHTML) continue;  /* empty = unassigned corner */
      const r = el.getBoundingClientRect();
      if (x >= r.left - TAP_HIT_PADDING && x <= r.right + TAP_HIT_PADDING &&
          y >= r.top - TAP_HIT_PADDING && y <= r.bottom + TAP_HIT_PADDING) {
        return el.dataset.dir;
      }
    }
    return null;
  }

  /* ─── Classify direction from vector ─── */
  _classify(dx, dy) {
    const angle = Math.atan2(-dy, dx) * (180 / Math.PI);

    if (this.mode === 'ultra') {
      /* 12 directions — 30° sectors; reject swipes within 3° of boundaries */
      const DEAD = 3;
      const norm = ((angle % 30) + 30) % 30;
      if (norm < DEAD || norm > (30 - DEAD)) return null;
      if (angle >= -15    && angle < 15)     return 'right';
      if (angle >= 15     && angle < 45)     return 'ene';
      if (angle >= 45     && angle < 75)     return 'ur';
      if (angle >= 75     && angle < 105)    return 'up';
      if (angle >= 105    && angle < 135)    return 'nnw';
      if (angle >= 135    && angle < 165)    return 'ul';
      if (angle >= 165    || angle < -165)   return 'left';
      if (angle >= -165   && angle < -135)   return 'wsw';
      if (angle >= -135   && angle < -105)   return 'dl';
      if (angle >= -105   && angle < -75)    return 'down';
      if (angle >= -75    && angle < -45)    return 'sse';
      if (angle >= -45    && angle < -15)    return 'dr';
      return 'right';
    }

    if (this.mode === 'expert') {
      /* 8 directions — 45° sectors; reject swipes within 4° of boundaries */
      const DEAD = 4;
      const norm = ((angle % 45) + 45) % 45;
      if (norm < DEAD || norm > (45 - DEAD)) return null;
      if (angle >= -22.5  && angle <  22.5)  return 'right';
      if (angle >=  22.5  && angle <  67.5)  return 'ur';
      if (angle >=  67.5  && angle < 112.5)  return 'up';
      if (angle >= 112.5  && angle < 157.5)  return 'ul';
      if (angle >= 157.5  || angle < -157.5) return 'left';
      if (angle >= -157.5 && angle < -112.5) return 'dl';
      if (angle >= -112.5 && angle < -67.5)  return 'down';
      if (angle >= -67.5  && angle < -22.5)  return 'dr';
      return 'right';
    }

    /* Beginner / Klassik / Mathe / Worte / Memo — 4 quadrants; reject swipes within 5° of axes */
    const DEAD = 5;
    const absAngle = Math.abs(angle);
    if (absAngle < DEAD || absAngle > (180 - DEAD) || Math.abs(absAngle - 90) < DEAD) return null;
    if (angle >= 0   && angle < 90)   return 'ur';
    if (angle >= 90  && angle <= 180) return 'ul';
    if (angle >= -180 && angle < -90) return 'dl';
    if (angle >= -90 && angle < 0)    return 'dr';
    return 'ur';
  }
}
