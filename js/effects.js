/* ═══════════════════════════════════════
   SCS Play — Effects Manager
   Physics particles, screen distortion,
   combo celebrations, danger zone, speed lines,
   streak counter, score zones, and more
   ═══════════════════════════════════════ */
import { CONFIG } from './config.js';

export class EffectsManager {
  constructor(container) {
    this.c = container;
    this.reduced = false;
    this.lowPerf = false;

    /* Auto-detect device capability */
    this._detectPerformance();

    /* Canvas trail state */
    this._canvas = null;
    this._ctx = null;
    this._trailPoints = [];
    this._trailActive = false;
    this._trailColor = '#FFD700';
    this._trailOpacity = 1;
    this._trailFadeId = null;
    this._completeFadeTimeout = null;
    this._trailStyle = 'default';
    this._trailHueOffset = 0;

    /* Ambient state */
    this._ambientEls = [];
    this._ambientOn = false;

    /* Fever overlay */
    this._feverEl = null;

    /* Physics particle system */
    this._activeParticles = [];
    this._particleLoopId = null;

    /* Chromatic aberration SVG filter (cached) */
    this._chromaticFilterInjected = false;

    /* Danger zone overlay */
    this._dangerVignetteEl = null;
  }

  setReduced(on) { this.reduced = on; }

  /** Append alpha to a color — works for both hex (#rrggbb) and hsl() */
  _alphaColor(color, hexAlpha) {
    if (color.startsWith('hsl(')) {
      const opacity = (parseInt(hexAlpha, 16) / 255).toFixed(2);
      return color.replace('hsl(', 'hsla(').replace(')', `, ${opacity})`);
    }
    return color + hexAlpha;
  }

  /* ══════════════════════════════════════
     DEVICE PERFORMANCE DETECTION
     Heuristic: check deviceMemory, hardwareConcurrency,
     and a quick canvas draw benchmark. Mid-range devices
     (Samsung A54 class) will get lowPerf = true.
     ══════════════════════════════════════ */
  _detectPerformance() {
    const nav = navigator;
    const mem = nav.deviceMemory || 8;        // GB (Chrome/Edge only)
    const cores = nav.hardwareConcurrency || 8;

    // Quick heuristic: low memory or few cores → probably mid-range
    if (mem <= 4 || cores <= 4) {
      this.lowPerf = true;
      document.body.classList.add('low-perf');
      return;
    }

    // Canvas benchmark: draw 500 arcs in a tight loop, measure time
    try {
      const cv = document.createElement('canvas');
      cv.width = 200; cv.height = 200;
      const ctx = cv.getContext('2d');
      if (ctx) {
        const t0 = performance.now();
        for (let i = 0; i < 500; i++) {
          ctx.beginPath();
          ctx.arc(100, 100, 50, 0, Math.PI * 2);
          ctx.fillStyle = `hsl(${i % 360},80%,50%)`;
          ctx.fill();
        }
        const elapsed = performance.now() - t0;
        // If > 8ms for 500 fills, device is slow
        if (elapsed > 8) {
          this.lowPerf = true;
          document.body.classList.add('low-perf');
        }
      }
    } catch (_) { /* ignore */ }
  }

  /* ══════════════════════════════════════
     CANVAS SWIPE TRAIL
     ══════════════════════════════════════ */
  initTrailCanvas(canvas) {
    if (!canvas) return;
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._resizeCanvas();
    this._resizeBound = () => this._resizeCanvas();
    window.addEventListener('resize', this._resizeBound, { passive: true });
  }

  _resizeCanvas() {
    if (!this._canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = this._canvas.parentElement?.clientWidth || window.innerWidth;
    const h = this._canvas.parentElement?.clientHeight || window.innerHeight;
    this._canvas.width = w * dpr;
    this._canvas.height = h * dpr;
    this._canvas.style.width = w + 'px';
    this._canvas.style.height = h + 'px';
    if (this._ctx) {
      this._ctx.setTransform(1, 0, 0, 1, 0, 0);
      this._ctx.scale(dpr, dpr);
    }
  }

  trailStart(x, y, color) {
    if (this.reduced || !this._canvas) return;
    if (this._trailFadeId) {
      cancelAnimationFrame(this._trailFadeId);
      this._trailFadeId = null;
    }
    if (this._completeFadeTimeout) {
      clearTimeout(this._completeFadeTimeout);
      this._completeFadeTimeout = null;
    }
    this._trailPoints = [{ x, y }];
    this._trailActive = true;
    this._trailColor = color || '#FFD700';
    this._trailOpacity = 1;
    this._drawTrail();
  }

  trailMove(x, y) {
    if (!this._trailActive || !this._canvas) return;
    this._trailPoints.push({ x, y });
    if (this._trailPoints.length > 60) this._trailPoints.shift();
    this._drawTrail();
  }

  /** Called by game result handler — flashes green/red then fades */
  trailComplete(correct) {
    this._trailActive = false;
    if (!this._trailPoints.length || !this._canvas) return;
    this._trailColor = correct ? '#2ED573' : '#FF4757';
    this._trailOpacity = 1;
    this._drawTrail();
    this._completeFadeTimeout = setTimeout(() => {
      this._completeFadeTimeout = null;
      this._fadeTrail();
    }, 80);
  }

  /** Called for non-swipe gestures (taps, timeouts) — just fade */
  trailEnd() {
    this._trailActive = false;
    if (!this._trailPoints.length || !this._canvas) return;
    this._fadeTrail();
  }

  /* Aliases matching the public API contract */
  startTrail(x, y, color) { this.trailStart(x, y, color); }
  moveTrail(x, y) { this.trailMove(x, y); }
  endTrail() { this.trailEnd(); }

  setTrailStyle(styleId) { this._trailStyle = styleId || 'default'; }

  _getTrailConfig() {
    const cfg = CONFIG.TRAILS?.find(t => t.id === this._trailStyle);
    return cfg || { id: 'default', color: null, glow: 14, width: 3 };
  }

  _drawTrail() {
    const ctx = this._ctx;
    const pts = this._trailPoints;
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = (this._canvas.width / dpr) || window.innerWidth;
    const h = (this._canvas.height / dpr) || window.innerHeight;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (pts.length < 1) { ctx.restore(); return; }

    const tcfg = this._getTrailConfig();
    let trailColor = this._trailColor;
    const glowSize = tcfg.glow || 14;
    const lineW = tcfg.width || 3;

    /* Bought trails always use their own color scheme;
       default trail keeps the game-provided center-shape color */
    if (this._trailStyle === 'rainbow' && this._trailActive) {
      this._trailHueOffset = (this._trailHueOffset + 3) % 360;
      trailColor = `hsl(${this._trailHueOffset}, 90%, 60%)`;
    } else if (tcfg.color && this._trailActive && this._trailStyle !== 'default') {
      trailColor = tcfg.color;
    }

    ctx.globalAlpha = this._trailOpacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (pts.length >= 2) {
      if (!this.lowPerf) {
        /* Outer glow */
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = this._alphaColor(trailColor, '25');
        ctx.lineWidth = 20 + (lineW * 2);
        ctx.stroke();

        /* Mid glow */
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = this._alphaColor(trailColor, '50');
        ctx.lineWidth = 8 + lineW;
        ctx.stroke();
      }

      /* Inner bright line */
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = trailColor;
      ctx.lineWidth = lineW;
      if (!this.lowPerf) {
        ctx.shadowColor = trailColor;
        ctx.shadowBlur = glowSize;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* Stardust sparkles along the trail */
      if (!this.lowPerf && this._trailStyle === 'stardust' && this._trailActive && pts.length > 3) {
        for (let i = 0; i < pts.length; i += 3) {
          const sparkX = pts[i].x + (Math.random() - 0.5) * 12;
          const sparkY = pts[i].y + (Math.random() - 0.5) * 12;
          ctx.beginPath();
          ctx.arc(sparkX, sparkY, 1 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fillStyle = '#FFE08080';
          ctx.fill();
        }
      }
      /* Fire embers along the trail */
      if (!this.lowPerf && this._trailStyle === 'fire' && this._trailActive && pts.length > 3) {
        for (let i = 0; i < pts.length; i += 4) {
          const eX = pts[i].x + (Math.random() - 0.5) * 14;
          const eY = pts[i].y - Math.random() * 8;
          ctx.beginPath();
          ctx.arc(eX, eY, 1 + Math.random() * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = Math.random() > 0.5 ? '#FF440060' : '#FFD70050';
          ctx.fill();
        }
      }
    }

    /* Finger dot at current position */
    const last = pts[pts.length - 1];

    /* Outer ring */
    ctx.beginPath();
    ctx.arc(last.x, last.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = this._alphaColor(trailColor, '18');
    ctx.fill();

    /* Core dot */
    ctx.beginPath();
    ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = this._alphaColor(trailColor, '90');
    ctx.shadowColor = trailColor;
    ctx.shadowBlur = glowSize + 4;
    ctx.fill();

    /* White center */
    ctx.beginPath();
    ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.fill();

    ctx.restore();
  }

  _fadeTrail() {
    if (this._trailFadeId) cancelAnimationFrame(this._trailFadeId);
    const dpr = window.devicePixelRatio || 1;
    const step = () => {
      this._trailOpacity -= 0.08;
      if (this._trailOpacity <= 0) {
        if (this._ctx) {
          this._ctx.save();
          this._ctx.setTransform(1, 0, 0, 1, 0, 0);
          this._ctx.clearRect(0, 0, this._canvas?.width || 0, this._canvas?.height || 0);
          this._ctx.restore();
        }
        this._trailPoints = [];
        this._trailOpacity = 1;
        this._trailFadeId = null;
        return;
      }
      this._drawTrail();
      this._trailFadeId = requestAnimationFrame(step);
    };
    this._trailFadeId = requestAnimationFrame(step);
  }

  /* ══════════════════════════════════════
     TOUCH RIPPLE
     ══════════════════════════════════════ */
  ripple(x, y, color = '#ffffff') {
    if (this.reduced) return;
    const el = document.createElement('div');
    el.className = 'touch-ripple';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.borderColor = color;
    this.c.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  /* ══════════════════════════════════════
     AMBIENT PARTICLES (floating dots)
     ══════════════════════════════════════ */
  startAmbient() {
    if (this.reduced || this.lowPerf || this._ambientOn) return;
    this._ambientOn = true;
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      p.className = 'ambient-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      const size = 2 + Math.random() * 4;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.opacity = (0.06 + Math.random() * 0.12).toString();
      p.style.setProperty('--drift-x', (Math.random() * 60 - 30) + 'px');
      p.style.setProperty('--drift-y', (Math.random() * 60 - 30) + 'px');
      p.style.animationDuration = (7 + Math.random() * 10) + 's';
      p.style.animationDelay = (Math.random() * 6) + 's';
      this.c.appendChild(p);
      this._ambientEls.push(p);
    }
  }

  stopAmbient() {
    this._ambientOn = false;
    this._ambientEls.forEach(el => el.remove());
    this._ambientEls = [];
  }

  /** Convenience toggle for ambient particles */
  ambient(on) {
    if (on) this.startAmbient();
    else this.stopAmbient();
  }

  /* ══════════════════════════════════════
     SHAKE
     ══════════════════════════════════════ */
  shake(dur = 300, mag = 6) {
    if (this.reduced) return;
    this.c.style.transition = 'none';
    const start = performance.now();
    const step = () => {
      const t = performance.now() - start;
      if (t > dur) { this.c.style.transform = ''; return; }
      const x = (Math.random() - 0.5) * mag * (1 - t / dur);
      const y = (Math.random() - 0.5) * mag * (1 - t / dur);
      this.c.style.transform = `translate(${x}px,${y}px)`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  shakeHit() { this.shake(200, 4); }
  shakeMiss() { this.shake(350, 8); }
  
  /* ══════════════════════════════════════
     SCREEN SHAKE & HIT STOP
     ══════════════════════════════════════ */
  advancedShake(duration = 400, intensity = 10, isDirectional = false, angle = 0, style = 'decay') {
    if (this.reduced || !this.c) return;
    
    // Stop any existing shake
    if (this._shakeRafId) {
      cancelAnimationFrame(this._shakeRafId);
      this._shakeRafId = null;
    }

    this.c.style.transition = 'none';
    this.c.style.willChange = 'transform';
    const start = performance.now();

    const dx = isDirectional ? Math.cos(angle) : 0;
    const dy = isDirectional ? Math.sin(angle) : 0;

    const step = (now) => {
      const elapsed = now - start;
      if (elapsed >= duration) {
        this.c.style.transform = '';
        this.c.style.willChange = 'auto';
        this._shakeRafId = null;
        return;
      }

      const progress = elapsed / duration;
      let currentIntensity = intensity;

      // Amplitude envelope
      if (style === 'decay') {
        currentIntensity = intensity * Math.pow(1 - progress, 2); // Ease out quad
      } else if (style === 'pop') {
        currentIntensity = intensity * (1 - progress); // Linear fade
      } else if (style === 'crescendo') {
        currentIntensity = intensity * Math.pow(progress, 2); // Ease in quad
      } else if (style === 'constant') {
        currentIntensity = intensity * (progress > 0.9 ? (1-progress)*10 : 1);
      }

      let x, y, r;

      if (isDirectional) {
        // High frequency bounce along the force vector + perpendicular noise
        const bounce = Math.sin(elapsed * 0.05) * currentIntensity;
        const noise = (Math.random() - 0.5) * currentIntensity * 0.3;
        x = dx * bounce + (dy * noise);
        y = dy * bounce - (dx * noise);
        r = (Math.random() - 0.5) * currentIntensity * 0.1; 
      } else {
        // Rough multi-directional Perlin-like noise simulation
        // Mixing sine waves with random offsets
        x = (Math.random() - 0.5) * 2 * currentIntensity;
        y = (Math.random() - 0.5) * 2 * currentIntensity;
        r = (Math.random() - 0.5) * 0.4 * currentIntensity;
      }
      
      // Avoid fractional pixels for sharper render
      x = Math.round(x * 10) / 10;
      y = Math.round(y * 10) / 10;
      r = Math.round(r * 10) / 10;

      this.c.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${r}deg)`;
      this._shakeRafId = requestAnimationFrame(step);
    };

    this._shakeRafId = requestAnimationFrame(step);
  }

  // Pre-configured shake profiles matching haptic intents
  shakeHeavy() { this.advancedShake(450, 14, false, 0, 'decay'); }
  shakeError() { this.advancedShake(300, 10, true, Math.PI/4, 'decay'); } 
  shakeHeartBeat() { this.advancedShake(600, 4, false, 0, 'constant'); }
  shakeCrescendo(dur) { this.advancedShake(dur || 1000, 12, false, 0, 'crescendo'); }

  /* ══════════════════════════════════════
     HIT STOP (Time freeze for heavy impacts)
     ══════════════════════════════════════ */
  hitStop(durationMs = 50) {
    if (this.reduced || durationMs <= 0) return;
    if (this._hitStopId) clearTimeout(this._hitStopId);
    
    // Targeted hit-stop: only freeze the game container instead of every DOM element
    this.c.classList.add('hit-stop-active');

    // Inject scoped freeze style once (targets game children only)
    if (!document.getElementById('hit-stop-style')) {
      const style = document.createElement('style');
      style.id = 'hit-stop-style';
      style.textContent = `
        .hit-stop-active .center-shape,
        .hit-stop-active .corner-shape,
        .hit-stop-active .spawn-particle,
        .hit-stop-active .score-pop,
        .hit-stop-active .ambient-particle {
          animation-play-state: paused !important;
          transition: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    this._hitStopId = setTimeout(() => {
      this.c.classList.remove('hit-stop-active');
      this._hitStopId = null;
    }, durationMs);
  }

  /* ══════════════════════════════════════
     PARTICLES — Advanced Physics
     ══════════════════════════════════════ */
  particles(x, y, color, count = 8, isHeavy = false) {
    if (this.reduced) { this._particlesSimple(x, y, color, Math.min(count, 4)); return; }
    if (this.lowPerf) { this._particlesSimple(x, y, color, Math.min(count, 4)); return; }

    // Optimization check depending on intensity
    if (this._activeParticles.length >= (isHeavy ? 30 : 20)) return;

    for (let i = 0; i < count; i++) {
      const size = (isHeavy ? 5 : 3) + Math.random() * (isHeavy ? 8 : 5);
      const el = document.createElement("div");
      
      const isSpark = Math.random() > 0.7;
      let pColor = color;
      let bColor = color;
      if (isSpark) { pColor = "#ffffff"; bColor = color; }

      Object.assign(el.style, {
        position: "absolute", left: "0px", top: "0px",
        width: size + "px", height: size + "px", borderRadius: "50%",
        background: pColor,
        pointerEvents: "none", zIndex: "300",
        willChange: "transform, opacity"
      });
      this.c.appendChild(el);

      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.8;
      const force = isHeavy ? (8 + Math.random() * 12) : (3 + Math.random() * 6);
      const drag = 0.88 + (Math.random() * 0.1);

      this._activeParticles.push({
        el, x, y, 
        vx: Math.cos(angle) * force, vy: Math.sin(angle) * force - (isHeavy ? 4 : 2),
        gravity: (isHeavy ? 0.4 : 0.2) + Math.random() * 0.3, drag,
        rotation: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * (isHeavy ? 25 : 15),
        life: 1, decay: (isHeavy ? 0.008 : 0.015) + Math.random() * 0.015, size
      });
    }

    if (!this._particleLoopId) this._startParticleLoop();
  }

  _initSimpleParticlePool() {
    if (this._simplePool) return;
    this._simplePool = [];
    this._simplePoolIdx = 0;
    const POOL = 12;
    for (let i = 0; i < POOL; i++) {
      const el = document.createElement("div");
      el.className = "particle";
      el.style.display = "none";
      this.c.appendChild(el);
      this._simplePool.push(el);
    }
  }

  _particlesSimple(x, y, color, count = 8) {
    this._initSimpleParticlePool();
    const pool = this._simplePool;
    for (let i = 0; i < count; i++) {
      const el = pool[this._simplePoolIdx % pool.length];
      this._simplePoolIdx++;
      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.4;
      const dist = 40 + Math.random() * 50;
      el.style.cssText = `left:${x}px;top:${y}px;background:${color};--px:${Math.cos(angle)*dist}px;--py:${Math.sin(angle)*dist}px;`;
      if (el._hideTimeout) clearTimeout(el._hideTimeout);
      el.classList.remove('particle');
      requestAnimationFrame(() => { el.classList.add('particle'); });
      el._hideTimeout = setTimeout(() => { el.style.display = 'none'; el._hideTimeout = null; }, 600);
      el.style.display = '';
    }
  }

  _startParticleLoop() {
    const loop = () => {
      if (document.hidden) { this._particleLoopId = requestAnimationFrame(loop); return; }
      const cH = this.c.clientHeight; const cW = this.c.clientWidth;
      
      for (let i = this._activeParticles.length - 1; i >= 0; i--) {
        const p = this._activeParticles[i];
        
        p.x += p.vx; 
        p.y += p.vy; 
        p.vx *= p.drag; 
        p.vy *= p.drag;
        p.vy += p.gravity; 
        p.rotation += p.rotSpeed; 
        p.life -= p.decay;
        
        if (p.x < 0 || p.x > cW) { 
          p.x = Math.max(0, Math.min(cW, p.x)); 
          p.vx *= -0.6; 
        }
        
        if (p.y > cH - 10) { 
          p.y = cH - 10; 
          p.vy *= -0.5; 
          p.vx *= 0.8; 
          p.rotSpeed *= 0.8; 
        }
        
        if (p.life <= 0) { 
          p.el.remove(); 
          this._activeParticles.splice(i, 1); 
          continue; 
        }
        
        const currentScale = Math.max(0, p.life * 1.2);
        p.el.style.transform = `translate3d(${p.x}px,${p.y}px,0) rotate(${p.rotation}deg) scale(${currentScale})`;
        p.el.style.opacity = p.life;
      }
      
      if (this._activeParticles.length > 0) { 
        this._particleLoopId = requestAnimationFrame(loop); 
      } else { 
        this._particleLoopId = null; 
      }
    };
    
    this._particleLoopId = requestAnimationFrame(loop);
  }

  bonusParticles(x, y, type) {
    const colors = type === 'diamond'
      ? ['#b9f2ff', '#e0f7fa', '#ffffff', '#80deea']
      : ['#ffd700', '#ffeb3b', '#fff176', '#ffe082'];
    this.particles(x, y, colors[0], 8, false);
  }

  /* ══════════════════════════════════════
     DISTORTION — Chromatic Aberration
     ══════════════════════════════════════ */
  chromaticAberration(intensity = 1, duration = 300) {
    if (this.reduced) return;
    this._injectChromaticFilter();
    this.c.style.filter = 'url(#scsChromatic)';
    setTimeout(() => { this.c.style.filter = ''; }, duration);
  }

  _injectChromaticFilter() {
    if (this._chromaticFilterInjected) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML =
      '<svg style="position:absolute;width:0;height:0"><filter id="scsChromatic">' +
      '<feOffset in="SourceGraphic" dx="2" dy="0" result="r"/>' +
      '<feOffset in="SourceGraphic" dx="-2" dy="0" result="b"/>' +
      '<feColorMatrix in="r" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="red"/>' +
      '<feColorMatrix in="b" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="blue"/>' +
      '<feBlend in="red" in2="blue" mode="screen"/>' +
      '</filter></svg>';
    document.body.appendChild(wrapper.firstElementChild);
    this._chromaticFilterInjected = true;
  }

  /* ══════════════════════════════════════
     SCREEN DISTORTION — Radial Zoom
     ══════════════════════════════════════ */
  radialZoom(duration = 300) {
    if (this.reduced) return;
    const half = duration / 2;
    this.c.style.transition = `transform ${half}ms ease-out`;
    this.c.style.transform = 'scale(1.03)';
    setTimeout(() => {
      this.c.style.transition = `transform ${half}ms ease-in`;
      this.c.style.transform = '';
      setTimeout(() => { this.c.style.transition = ''; }, half);
    }, half);
  }

  /* ══════════════════════════════════════
     SCORE POP (floating text) — POOLED
     ══════════════════════════════════════ */
  _initScorePopPool() {
    if (this._scorePopPool) return;
    this._scorePopPool = [];
    this._scorePopIdx = 0;
    const POOL = 6;
    for (let i = 0; i < POOL; i++) {
      const el = document.createElement('div');
      el.className = 'score-pop';
      el.style.display = 'none';
      this.c.appendChild(el);
      this._scorePopPool.push(el);
    }
  }

  scorePop(x, y, text, color = '#fff', big = false) {
    this._initScorePopPool();
    const pool = this._scorePopPool;
    const el = pool[this._scorePopIdx % pool.length];
    this._scorePopIdx++;

    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = color;
    el.style.display = '';
    el.className = big ? 'score-pop big' : 'score-pop';
    /* Use rAF for animation re-trigger instead of forced reflow */
    requestAnimationFrame(() => {
      el.classList.add('score-pop-go');
    });
    setTimeout(() => { el.style.display = 'none'; el.classList.remove('score-pop-go'); }, big ? 1300 : 800);
  }

  /* ══════════════════════════════════════
     FLASH (full-screen color overlay) — POOLED
     ══════════════════════════════════════ */
  _initFlashPool() {
    if (this._flashPool) return;
    this._flashPool = [];
    this._flashIdx = 0;
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div');
      el.className = 'flash-overlay';
      el.style.display = 'none';
      this.c.appendChild(el);
      this._flashPool.push(el);
    }
  }

  flash(color = '#fff', dur = 120) {
    if (this.reduced) return;
    this._initFlashPool();
    const pool = this._flashPool;
    const el = pool[this._flashIdx % pool.length];
    this._flashIdx++;
    el.style.background = color;
    el.style.setProperty('--flash-dur', dur + 'ms');
    el.style.display = '';
    el.classList.remove('flash-overlay');
    requestAnimationFrame(() => { el.classList.add('flash-overlay'); });
    setTimeout(() => { el.style.display = 'none'; }, dur + 100);
  }
  perfectFlash() { this.flash('#2ED57340', 200); }
  goldenFlash()  { this.flash('#FFD70030', 280); }
  diamondFlash() { this.flash('#80DEEA30', 350); }

  /* ══════════════════════════════════════
     ABSORB (fly element from -> to)
     ══════════════════════════════════════ */
  _initAbsorbPool() {
    if (this._absorbPool) return;
    this._absorbPool = [];
    this._absorbIdx = 0;
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('div');
      el.className = 'absorb-dot';
      el.style.display = 'none';
      this.c.appendChild(el);
      this._absorbPool.push(el);
    }
  }

  absorb(fromX, fromY, toX, toY, color) {
    if (this.reduced) return;
    this._initAbsorbPool();
    const pool = this._absorbPool;
    const el = pool[this._absorbIdx % pool.length];
    this._absorbIdx++;
    el.style.background = color;
    el.style.left = fromX + 'px';
    el.style.top = fromY + 'px';
    el.style.setProperty('--ax', (toX - fromX) + 'px');
    el.style.setProperty('--ay', (toY - fromY) + 'px');
    el.style.display = '';
    el.classList.remove('absorb-dot');
    requestAnimationFrame(() => { el.classList.add('absorb-dot'); });
    setTimeout(() => { el.style.display = 'none'; }, 500);
  }

  /* ══════════════════════════════════════
     GLOW CORNER (pulse border-glow)
     ══════════════════════════════════════ */
  glowCorner(el, color) {
    if (this.reduced || !el) return;
    el.classList.add('corner-glow');
    el.style.boxShadow = `0 0 16px ${color}60`;
    setTimeout(() => {
      el.classList.remove('corner-glow');
      el.style.boxShadow = '';
    }, 400);
  }

  /* ══════════════════════════════════════
     CONFETTI (celebration burst)
     ══════════════════════════════════════ */
  confetti(count, duration) {
    const total = count || CONFIG.CONFETTI_COUNT;
    const dur = duration || 2500;
    const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
                    '#ff922b', '#cc5de8', '#20c997', '#fcc419'];
    const ct = document.body;
    const pieces = [];
    for (let i = 0; i < total; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.background = colors[i % colors.length];
      el.style.animationDelay = (Math.random() * 0.5) + 's';
      el.style.animationDuration = (1 + Math.random() * 1.5) + 's';
      el.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      el.style.setProperty('--drift', (Math.random() * 80 - 40) + 'px');
      ct.appendChild(el);
      pieces.push(el);
      el.addEventListener('animationend', () => el.remove());
    }
    /* Safety cleanup in case animationend doesn't fire */
    setTimeout(() => { pieces.forEach(p => { if (p.parentNode) p.remove(); }); }, dur);
  }

  /* ══════════════════════════════════════
     FEVER MODE OVERLAY
     ══════════════════════════════════════ */
  startFever() {
    if (this._feverEl) return;
    this._feverEl = document.createElement('div');
    this._feverEl.className = 'fever-overlay active';
    this.c.appendChild(this._feverEl);
  }
  stopFever() {
    if (this._feverEl) { this._feverEl.remove(); this._feverEl = null; }
  }

  /* ══════════════════════════════════════
     MULTIPLIER BACKGROUND SHIFT
     ══════════════════════════════════════ */
  setMultiplierBg(level) {
    if (level < 1) { this.resetMultiplierBg(); return; }
    const hues = [220, 260, 290, 320, 0, 30, 50, 60];
    const hue = hues[Math.min(level - 1, hues.length - 1)];
    document.documentElement.style.setProperty('--bg-hue', hue);
  }
  resetMultiplierBg() {
    document.documentElement.style.setProperty('--bg-hue', 220);
  }

  /* ══════════════════════════════════════
     ACHIEVEMENT TOAST
     ══════════════════════════════════════ */
  achievementToast(text, category) {
    const dur = CONFIG.TOAST_DURATION || 4500;
    // create / locate toast container
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.className = 'achievement-toast';
    if (category) el.classList.add(`cat-${category}`);
    el.style.setProperty('--toast-dur', dur + 'ms');
    el.style.animationDuration = dur + 'ms';
    el.innerHTML = `<span class="toast-icon"><svg class="ui-icon" viewBox="0 0 24 24"><use href="#icon-trophy"></use></svg></span><span class="toast-text">${text}</span>`;
    container.appendChild(el);

    // Tap to dismiss
    el.addEventListener('click', () => {
      el.style.transition = 'opacity 0.25s, transform 0.25s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(100px)';
      setTimeout(() => { if (el.parentNode) el.remove(); }, 300);
    });

    // keep at most 3 toasts stacked
    while (container.children.length > 3) container.removeChild(container.firstChild);

    // If reduced-motion is enabled, avoid animation reliance and remove by timeout
    if (this.reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('reduced');
      setTimeout(() => { if (el.parentNode) el.remove(); }, Math.max(1200, dur));
    } else {
      // remove after animation completes
      el.addEventListener('animationend', () => { if (el.parentNode) el.remove(); });
    }
  }

  /* ══════════════════════════════════════
     XP PULSE + CENTER PULSE
     ══════════════════════════════════════ */
  xpPulse(el) {
    if (!el) return;
    el.classList.remove('xp-pulse');
    void el.offsetWidth;
    el.classList.add('xp-pulse');
  }

  pulseCenter(el) {
    if (!el) return;
    el.classList.remove('center-pulse');
    void el.offsetWidth;
    el.classList.add('center-pulse');
  }

  /* ══════════════════════════════════════
     LEVEL-UP CELEBRATION
     Full-screen burst: confetti + XP pulse + glow ring
     ══════════════════════════════════════ */
  levelUpCelebration() {
    if (this.reduced) return;
    this.confetti(this.lowPerf ? 10 : undefined);
    if (!this.lowPerf) this.chromaticAberration();

    /* Central glow burst — premium CSS class */
    this._injectLevelUpStyles();
    const burst = document.createElement('div');
    burst.className = 'levelup-burst';
    document.body.appendChild(burst);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        burst.classList.add('levelup-burst--expand');
      });
    });
    setTimeout(() => burst.remove(), 900);

    /* Star particles — golden */
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (let i = 0; i < 16; i++) {
      if (this._activeParticles.length >= 50) break;
      const size = 5 + Math.random() * 7;
      const hue = 40 + Math.random() * 30;
      const el = document.createElement('div');
      el.className = 'levelup-star';
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.setProperty('--star-color', `hsl(${hue}, 100%, 55%)`);
      document.body.appendChild(el);
      const angle = (Math.PI * 2 / 16) * i;
      const speed = 4 + Math.random() * 5;
      this._activeParticles.push({
        el, x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        gravity: 0.2, rotation: 0, rotSpeed: 0,
        life: 1, decay: 0.012, size
      });
    }
    if (!this._particleLoopId) this._startParticleLoop();
  }

  /* ══════════════════════════════════════
     PB CELEBRATION
     Confetti + golden flash + screen pulse
     ══════════════════════════════════════ */
  pbCelebration() {
    if (this.reduced) return;
    this.confetti();
    this.goldenFlash();
    if (typeof this.screenPulse === 'function') this.screenPulse();
  }

  /* ══════════════════════════════════════
     DAILY STREAK BADGE (animated counter)
     ══════════════════════════════════════ */
  dailyStreakBadge(streak) {
    if (this.reduced && streak < 3) return;
    const el = document.createElement('div');
    el.className = 'achievement-toast';
    el.style.animationDuration = '4500ms';
    const flames = streak >= 7 ? '\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25' : streak >= 3 ? '\uD83D\uDD25\uD83D\uDD25' : '\uD83D\uDD25';
    el.innerHTML = `<span class="toast-icon">${flames}</span><span class="toast-text">${t('daily_streak_toast', { n: streak })}</span>`;

    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    container.appendChild(el);
    while (container.children.length > 3) container.removeChild(container.firstChild);
    el.addEventListener('animationend', () => { if (el.parentNode) el.remove(); });
  }

  /* ══════════════════════════════════════
     COMBO MILESTONE (big centered text)
     v22: stripped particle ring, shockwave and chromatic
     aberration — they cause heavy jank at high streaks.
     Only the CSS-animated label remains (GPU composited).
     ══════════════════════════════════════ */
  comboMilestone(streak) {
    if (this.reduced) return;

    let label, tier;
    if (streak >= 75) {
      label = t('combo_transcendent'); tier = 'transcendent';
    } else if (streak >= 50) {
      label = t('combo_godlike'); tier = 'godlike';
    } else if (streak >= 40) {
      label = t('combo_legendary'); tier = 'legendary';
    } else if (streak >= 30) {
      label = t('combo_insane'); tier = 'insane';
    } else if (streak >= 20) {
      label = t('combo_fire'); tier = 'fire';
    } else {
      return;
    }

    /* ── Milestone text animation — GPU-composited CSS class ── */
    const el = document.createElement('div');
    el.className = `combo-milestone combo-tier-${tier}`;
    el.textContent = label;

    this._injectComboMilestoneKeyframes();
    this.c.appendChild(el);

    /* Confetti burst */
    if (!this.lowPerf) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const count = tier === 'transcendent' ? 16 : tier === 'godlike' ? 14 : tier === 'legendary' ? 12 : tier === 'insane' ? 10 : 8;
      this.confetti(count, 2000);
    }

    el.addEventListener('animationend', () => el.remove());
  }

  _injectComboMilestoneKeyframes() {
    if (document.getElementById('combo-milestone-kf')) return;
    const style = document.createElement('style');
    style.id = 'combo-milestone-kf';
    style.textContent = `
      .combo-milestone {
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(0);
        font-family: 'Space Grotesk', system-ui, sans-serif;
        font-size: clamp(1.8rem, 6vw, 3rem);
        font-weight: 900;
        text-align: center;
        pointer-events: none;
        z-index: 9999;
        opacity: 1;
        white-space: nowrap;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        line-height: 1;
        color: #FFD700;
        text-shadow: 0 0 30px rgba(255,215,0,0.8), 0 0 60px rgba(255,215,0,0.4), 0 4px 12px rgba(0,0,0,0.6);
        will-change: transform, opacity;
        contain: layout style;
        max-width: 90vw;
        overflow: hidden;
        text-overflow: ellipsis;
        padding: 8px 24px;
        border-radius: 12px;
        background: radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 70%);
        animation: comboMilestoneAnim 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      .combo-tier-insane {
        color: #FF6B35;
        text-shadow: 0 0 30px rgba(255,107,53,0.8), 0 0 60px rgba(255,107,53,0.4), 0 4px 12px rgba(0,0,0,0.6);
      }
      .combo-tier-legendary {
        color: #E040FB;
        text-shadow: 0 0 30px rgba(224,64,251,0.8), 0 0 60px rgba(224,64,251,0.4), 0 4px 12px rgba(0,0,0,0.6);
      }
      .combo-tier-godlike {
        color: #FF1744;
        text-shadow: 0 0 30px rgba(255,23,68,0.8), 0 0 60px rgba(255,23,68,0.4), 0 4px 12px rgba(0,0,0,0.6);
      }
      .combo-tier-transcendent {
        color: #FFFFFF;
        text-shadow: 0 0 30px rgba(255,255,255,0.9), 0 0 80px rgba(124,58,237,0.6), 0 4px 12px rgba(0,0,0,0.6);
      }
      @keyframes comboMilestoneAnim {
        0%   { transform: translate(-50%, -50%) scale(0) rotate(-8deg); opacity: 0; filter: blur(8px); }
        12%  { opacity: 1; filter: blur(0); }
        18%  { transform: translate(-50%, -50%) scale(1.35) rotate(2deg); opacity: 1; }
        35%  { transform: translate(-50%, -50%) scale(0.95) rotate(0); }
        55%  { transform: translate(-50%, -50%) scale(1.02); }
        80%  { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1.08) translateY(-20px); opacity: 0; filter: blur(4px); }
      }
    `;
    document.head.appendChild(style);
  }

  _injectLevelUpStyles() {
    if (document.getElementById('levelup-styles')) return;
    const style = document.createElement('style');
    style.id = 'levelup-styles';
    style.textContent = `
      .levelup-burst {
        position: fixed;
        top: 50%; left: 50%;
        width: 0; height: 0;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(124,58,237,.45), rgba(236,72,153,.25), transparent 70%);
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 9990;
        opacity: 1;
        transition: width .8s cubic-bezier(0.2,0.8,0.2,1), height .8s cubic-bezier(0.2,0.8,0.2,1), opacity .8s ease-out;
      }
      .levelup-burst--expand {
        width: 400px; height: 400px; opacity: 0;
      }
      .levelup-star {
        position: fixed; left: 0; top: 0;
        border-radius: 50%;
        background: var(--star-color, hsl(50, 100%, 55%));
        pointer-events: none;
        z-index: 9991;
        will-change: transform;
      }
    `;
    document.head.appendChild(style);
  }

  _injectShockwaveKeyframes() {
    if (document.getElementById('shockwave-kf')) return;
    const style = document.createElement('style');
    style.id = 'shockwave-kf';
    style.textContent = `
      @keyframes shockwaveExpand {
        0%   { transform: scale(0); opacity: 1; }
        100% { transform: scale(3); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════
     DANGER ZONE (pulsing red vignette)
     ══════════════════════════════════════ */
  dangerZone(active) {
    if (active) {
      if (this._dangerVignetteEl) return;

      /* Inject keyframes once */
      if (!document.getElementById('danger-pulse-kf')) {
        const style = document.createElement('style');
        style.id = 'danger-pulse-kf';
        style.textContent = `
          @keyframes dangerPulse {
            0%   { opacity: 0.15; }
            100% { opacity: 0.4; }
          }
        `;
        document.head.appendChild(style);
      }

      const el = document.createElement('div');
      el.className = 'danger-vignette';
      Object.assign(el.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(255,71,87,0.10) 100%)',
        animation: 'dangerPulse 1.2s cubic-bezier(0.55, 0, 0.1, 1) infinite alternate',
        pointerEvents: 'none',
        zIndex: '15'  /* below HUD (z:20) and particles (z:300), above trail (z:2) */
      });
      this.c.appendChild(el);
      this._dangerVignetteEl = el;
    } else {
      if (this._dangerVignetteEl) {
        this._dangerVignetteEl.remove();
        this._dangerVignetteEl = null;
      }
    }
  }

  /* ══════════════════════════════════════
     SPEED LINES (radial burst from center)
     Supports intensity parameter
     ══════════════════════════════════════ */
  speedLines(intensity = 1) {
    if (this.reduced) return;

    const container = document.getElementById('speedLines');
    if (!container) return;

    /* Inject keyframes if not already present */
    if (!document.getElementById('speed-lines-kf')) {
      const style = document.createElement('style');
      style.id = 'speed-lines-kf';
      style.textContent = `
        @keyframes speedLineShoot {
          0%   { opacity: var(--sl-opacity,0.8); transform: translate(-50%, -50%) rotate(var(--angle)) scaleX(0.3); }
          100% { opacity: 0;   transform: translate(-50%, -50%) rotate(var(--angle)) scaleX(1); }
        }
      `;
      document.head.appendChild(style);
    }

    const count = Math.round(5 * intensity);
    const lineWidth = 120 + intensity * 40;
    const opacity = Math.min(0.4 + intensity * 0.4, 1);
    const duration = Math.max(300, 600 - intensity * 150);

    const lines = [];
    for (let i = 0; i < count; i++) {
      const angle = (360 / count) * i + (Math.random() * 10 - 5);
      const line = document.createElement('div');
      Object.assign(line.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: lineWidth + 'px',
        height: '2px',
        background: `linear-gradient(90deg, rgba(255,255,255,${opacity}) 0%, rgba(255,255,255,0) 100%)`,
        transformOrigin: '0% 50%',
        pointerEvents: 'none',
        zIndex: '100',
        animation: `speedLineShoot ${duration}ms ease-out forwards`
      });
      line.style.setProperty('--angle', angle + 'deg');
      line.style.setProperty('--sl-opacity', opacity);
      container.appendChild(line);
      lines.push(line);
    }

    setTimeout(() => { lines.forEach(l => l.remove()); }, duration + 50);
  }

  /* ══════════════════════════════════════
     SCREEN TRANSITION (fade overlay)
     ══════════════════════════════════════ */
  screenTransition() {
    if (this.reduced) return;
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.35)',
      zIndex: '9998',
      pointerEvents: 'none',
      opacity: '1',
      transition: 'opacity 300ms ease-out'
    });
    this.c.appendChild(el);
    /* Double-rAF to ensure the browser paints at opacity 1 first */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { el.style.opacity = '0'; });
    });
    setTimeout(() => el.remove(), 350);
  }

  /* ══════════════════════════════════════
     SCREEN PULSE (quick zoom on container)
     ══════════════════════════════════════ */
  screenPulse() {
    if (this.reduced) return;

    const el = this.c;
    const start = performance.now();
    const duration = 200;
    const maxScale = 1.02;

    const step = () => {
      const t = performance.now() - start;
      if (t >= duration) {
        el.style.transform = '';
        return;
      }
      const progress = t / duration;
      const scale = progress < 0.5
        ? 1 + (maxScale - 1) * (progress / 0.5)
        : 1 + (maxScale - 1) * ((1 - progress) / 0.5);
      el.style.transform = `scale(${scale})`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ══════════════════════════════════════
     ENDLESS HEART LOST (animate heart break)
     ══════════════════════════════════════ */
  endlessHeartLost(livesLeft) {
    if (this.reduced) return;

    const livesContainer = document.getElementById('hudEndlessLives');
    if (!livesContainer) return;

    const hearts = livesContainer.querySelectorAll('.endless-heart');
    if (!hearts.length) return;

    const idx = Math.max(0, Math.min(livesLeft, hearts.length - 1));
    const heart = hearts[idx];
    if (!heart) return;

    if (!document.getElementById('heart-lost-kf')) {
      const style = document.createElement('style');
      style.id = 'heart-lost-kf';
      style.textContent = `
        @keyframes heartLostAnim {
          0%   { transform: scale(1); opacity: 1; }
          30%  { transform: scale(1.6); opacity: 1; }
          60%  { transform: scale(1.3); opacity: 0.6; }
          100% { transform: scale(1); opacity: 0.3; }
        }
      `;
      document.head.appendChild(style);
    }

    heart.style.animation = 'heartLostAnim 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    heart.addEventListener('animationend', () => {
      heart.style.animation = '';
      heart.style.opacity = '0.3';
      heart.style.filter = 'grayscale(1)';
    }, { once: true });
  }

  /* ══════════════════════════════════════
     STREAK FIRE (fire particles on element)
     ══════════════════════════════════════ */
  streakFire(el) {
    if (this.reduced || this.lowPerf || !el) return;

    if (!document.getElementById('streak-fire-kf')) {
      const style = document.createElement('style');
      style.id = 'streak-fire-kf';
      style.textContent = `
        @keyframes streakFireParticle {
          0%   { transform: translateY(0) scale(1); opacity: 0.9; }
          50%  { transform: translateY(-18px) scale(1.1); opacity: 0.6; }
          100% { transform: translateY(-36px) scale(0.2); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    const rect = el.getBoundingClientRect();
    const containerRect = this.c.getBoundingClientRect();
    const pieces = [];
    const count = 6;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      const hue = Math.random() * 40;
      const size = 4 + Math.random() * 6;
      Object.assign(p.style, {
        position: 'absolute',
        left: (rect.left - containerRect.left + Math.random() * rect.width) + 'px',
        top: (rect.top - containerRect.top + rect.height * 0.3) + 'px',
        width: size + 'px',
        height: size + 'px',
        borderRadius: '50%',
        background: `hsl(${hue}, 100%, 55%)`,
        pointerEvents: 'none',
        zIndex: '200',
        animation: `streakFireParticle ${400 + Math.random() * 300}ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards`,
        animationDelay: (Math.random() * 150) + 'ms'
      });
      this.c.appendChild(p);
      pieces.push(p);
    }

    setTimeout(() => { pieces.forEach(p => p.remove()); }, 850);
  }

  /* ══════════════════════════════════════
     SCORE COUNT-UP (animated number)
     Enhanced: scale pulse at every 10% milestone
     ══════════════════════════════════════ */
  scoreCountUp(el, from, to, duration = 600, onTick = null) {
    if (!el) return;

    const start = performance.now();
    const diff = to - from;
    let lastMilestone = -1;

    const step = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      /* Ease-out cubic for satisfying deceleration */
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + diff * eased);
      el.textContent = current.toLocaleString();

      /* Scale pulse at every 10 % of the counting range */
      if (diff > 0) {
        const milestone = Math.floor(current / (diff * 0.1));
        if (milestone > lastMilestone) {
          el.style.transform = 'scale(1.15)';
          setTimeout(() => { el.style.transform = ''; }, 80);
          lastMilestone = milestone;
          if (typeof onTick === 'function') onTick(progress);
        }
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = to.toLocaleString();
        if (typeof onTick === 'function') onTick(1);
      }
    };
    requestAnimationFrame(step);
  }

  /* ══════════════════════════════════════
     STREAK COUNTER ANIMATION
     Quick scale bounce on streak element
     ══════════════════════════════════════ */
  animateStreakCounter(el) {
    if (!el) return;
    el.style.transform = 'scale(1.3)';
    el.style.transition = 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 150);
  }

  /* ══════════════════════════════════════
     SCORE ZONE (subtle bg-hue shift)
     ══════════════════════════════════════ */
  setScoreZone(score) {
    let hue = 220; /* default: blue */
    if (score >= 15000)      hue = 45;  /* gold   */
    else if (score >= 10000) hue = 30;  /* orange */
    else if (score >= 5000)  hue = 280; /* purple */
    else if (score >= 2000)  hue = 260; /* violet */
    document.documentElement.style.setProperty('--bg-hue', hue);
  }

  /* ══════════════════════════════════════
     v19 — BACKGROUND INTENSITY
     Reactive ambient based on game state
     ══════════════════════════════════════ */
  setBackgroundIntensity(level) {
    if (this.reduced || this.lowPerf) return;
    // level: 0=calm, 1=low, 2=mid, 3=high, 4=fever
    const root = document.documentElement;
    root.style.setProperty('--bg-intensity', level);
    // Adjust ambient particle speed via CSS custom prop
    const speedMult = 1 + level * 0.5;
    root.style.setProperty('--ambient-speed', speedMult);
    // Ambient particle count adjustment
    if (this._ambientOn) {
      this._ambientEls.forEach(p => {
        const baseDur = parseFloat(p.style.animationDuration) || 10;
        p.style.animationDuration = Math.max(3, baseDur / speedMult) + 's';
        p.style.opacity = Math.min(0.25, 0.06 + level * 0.04).toString();
      });
    }
  }

  /* ══════════════════════════════════════
     v19 — SCORE MILESTONE BURST
     Celebratory particle explosion at score thresholds
     ══════════════════════════════════════ */
  scoreMilestoneBurst(tier = 0) {
    if (this.reduced || this.lowPerf) return;
    const cx = this.c.clientWidth / 2;
    const cy = this.c.clientHeight / 2;
    const colors = [
      ['#C0C0C0', '#E8E8E8', '#A0A0A0'],                   // 1K silver
      ['#C0C0C0', '#E8E8E8', '#87CEEB'],                    // 2.5K silver-blue
      ['#FFD700', '#FFE44D', '#FFC107'],                     // 5K gold
      ['#FFD700', '#FF6B6B', '#FF4757', '#FF9F43'],          // 10K gold-red
      ['#FF6B6B', '#FFD700', '#00D2FF', '#2ED573', '#CC5DE8'] // 25K rainbow
    ];
    const palette = colors[Math.min(tier, colors.length - 1)];
    const count = 8 + tier * 3;
    for (let i = 0; i < count; i++) {
      this.particles(cx, cy, palette[i % palette.length], 1);
    }
    // Shockwave ring
    this._injectShockwaveKeyframes();
    const wave = document.createElement('div');
    Object.assign(wave.style, {
      position: 'absolute',
      left: (cx - 50) + 'px', top: (cy - 50) + 'px',
      width: '100px', height: '100px',
      borderRadius: '50%',
      border: `3px solid ${palette[0]}`,
      pointerEvents: 'none', zIndex: '9998',
      animation: 'shockwaveExpand 700ms ease-out forwards'
    });
    this.c.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove());
    // Screen pulse
    if (typeof this.screenPulse === 'function') this.screenPulse();
  }

  /* ══════════════════════════════════════
     v19 — MISS OVERLAY
     Brief red vignette + crack on wrong answer
     ══════════════════════════════════════ */
  missOverlay() {
    if (this.reduced) return;
    // Red vignette flash
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute', inset: '0',
      background: 'radial-gradient(ellipse at center, transparent 40%, rgba(255,71,87,0.25) 100%)',
      pointerEvents: 'none', zIndex: '15',
      opacity: '1',
      transition: 'opacity 300ms ease-out'
    });
    this.c.appendChild(el);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { el.style.opacity = '0'; });
    });
    setTimeout(() => el.remove(), 350);
  }

  /* ══════════════════════════════════════
     v19 — MULTIPLIER RING
     Glowing ring around center platform
     ══════════════════════════════════════ */
  updateMultiplierRing(mult) {
    const platform = this.c.querySelector?.('#centerPlatform') || document.getElementById('centerPlatform');
    if (!platform) return;
    if (mult <= 1) {
      platform.style.setProperty('--ring-opacity', '0');
      platform.style.setProperty('--ring-color', 'transparent');
      return;
    }
    const hues = [220, 260, 290, 320, 0, 30, 50, 60];
    const hue = hues[Math.min(mult - 1, hues.length - 1)];
    const opacity = Math.min(0.3 + (mult - 1) * 0.08, 0.8);
    const thickness = 2 + mult;
    platform.style.setProperty('--ring-opacity', opacity);
    platform.style.setProperty('--ring-color', `hsl(${hue}, 80%, 60%)`);
    platform.style.setProperty('--ring-thickness', thickness + 'px');
    platform.style.setProperty('--ring-glow', `0 0 ${10 + mult * 4}px hsla(${hue}, 80%, 60%, ${opacity * 0.6})`);
  }

  /* ══════════════════════════════════════
     v19 — BEAT PULSE
     Subtle scale pulse synced with music BPM
     ══════════════════════════════════════ */
  beatPulse() {
    if (this.reduced || this.lowPerf) return;
    const corners = this.c.querySelectorAll?.('.corner-shape') || [];
    corners.forEach(corner => {
      corner.classList.add('corner-beat-pulse');
      setTimeout(() => { corner.classList.remove('corner-beat-pulse'); }, 80);
    });
  }

  /* ══════════════════════════════════════
     CLEANUP
     ══════════════════════════════════════ */
  cleanup() {
    this.stopAmbient();
    this.stopFever();

    /* Shake & hitStop cleanup */
    if (this._shakeRafId) {
      cancelAnimationFrame(this._shakeRafId);
      this._shakeRafId = null;
    }
    if (this._hitStopId) {
      clearTimeout(this._hitStopId);
      this._hitStopId = null;
    }

    /* Physics particles */
    for (const p of this._activeParticles) p.el.remove();
    this._activeParticles = [];
    if (this._particleLoopId) {
      cancelAnimationFrame(this._particleLoopId);
      this._particleLoopId = null;
    }

    /* Danger zone */
    if (this._dangerVignetteEl) {
      this._dangerVignetteEl.remove();
      this._dangerVignetteEl = null;
    }

    /* Trail */
    if (this._trailFadeId) cancelAnimationFrame(this._trailFadeId);
    if (this._completeFadeTimeout) clearTimeout(this._completeFadeTimeout);
    if (this._ctx) {
      this._ctx.save();
      this._ctx.setTransform(1, 0, 0, 1, 0, 0);
      this._ctx.clearRect(0, 0, this._canvas?.width || 0, this._canvas?.height || 0);
      this._ctx.restore();
    }
    this._trailPoints = [];
    if (this._resizeBound) window.removeEventListener('resize', this._resizeBound);
  }

  /* ══════════════════════════════════════
     GAME OVER FLASH (dramatic end-of-game)
     ══════════════════════════════════════ */
  gameOverFlash(labelText) {
    if (this.reduced) return;
    /* Red flash overlay */
    const flash = document.createElement('div');
    flash.className = 'game-over-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 650);

    /* Large text overlay */
    if (labelText) {
      const txt = document.createElement('div');
      txt.className = 'game-over-text';
      const span = document.createElement('span');
      span.textContent = labelText;
      txt.appendChild(span);
      document.body.appendChild(txt);
      setTimeout(() => txt.remove(), 800);
    }
  }
}
