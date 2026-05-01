/* ═══════════════════════════════════════
   SCS Play — Audio Manager
   Synth sounds + procedural background music
   with melody, chords, bass line, mode-specific themes,
   3-layer tension system, spatial audio, and expanded SFX
   ═══════════════════════════════════════ */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicEnabled = true;
    this._musicGain = null;
    this._musicRunning = false;
    this._musicTempo = 120;
    this._musicTimeout = null;
    this._musicBeat = 0;
    this._feverMode = false;

    /* music variety state */
    this._musicMode = 'classic';
    this._requestedMusicMode = 'classic';
    this._musicContext = {};
    this._baseTempo = 120;
    this._melodyIndex = 0;
    this._chordIndex = 0;
    this._melodyGain = null;
    this._padGain = null;
    this._padOscillators = [];
    this._padFilter = null;

    /* tension system state */
    this._tensionActive = false;
    this._tensionNodes = [];
    this._tensionTimers = [];
    this._tensionStartTime = 0;

    /* phrase-based music system state */
    this._currentPhrase = null;
    this._phrasePos = 0;
    this._modeData = null;
    this._melodyFilter = null;
    this._compressor = null;

    /* Audio file music (preferred over procedural) */
    this._musicAudio = null;
    this._availableMusicTracks = new Set();
    this._musicManifestLoaded = false;
    this._musicManifestPromise = null;
    this._musicFilePlaying = false;
    this._musicFileMode = null;
    this._musicFileVolume = 0.4;
    this._musicFadeTimer = null;

    this._initMusicData();
    this._loadMusicManifest();
  }

  /* ─────────────────────────────────────────
     Per-mode music configuration data
     ───────────────────────────────────────── */

  _initMusicData() {
    this._modeConfig = {

      /* ── Menu: relaxed C major pentatonic ── */
      menu: {
        scale: [261.63, 293.66, 329.63, 392.00, 440.00,
                523.25, 587.33, 659.26, 783.99, 880.00],
        phrases: [
          [329.63, 392.00, 440.00, 523.25, 587.33, 523.25, 440.00, 392.00],
          [523.25, 440.00, 392.00, 329.63, 293.66, 329.63, 392.00, 440.00],
          [392.00, 440.00, 523.25, 659.26, 587.33, 523.25, 440.00, 392.00],
          [261.63, 293.66, 329.63, 392.00, 440.00, 392.00, 329.63, 293.66],
          [440.00, 523.25, 587.33, 659.26, 523.25, 440.00, 392.00, 440.00],
          [329.63, 392.00, 0, 440.00, 523.25, 587.33, 0, 523.25]
        ],
        chords: [
          [130.81, 164.81, 196.00, 246.94],   // Cmaj7
          [110.00, 130.81, 164.81, 196.00],   // Am7
          [87.31,  110.00, 130.81, 164.81],   // Fmaj7
          [98.00,  123.47, 146.83, 164.81]    // G6
        ],
        melody: { type: 'sine',     attack: 0.08,  release: 0.4,  vol: 0.04  },
        bass:   { type: 'sine',     vol: 0.04  },
        filter: { cutoff: 2000, Q: 0.7 },
        arpeggio: true
      },

      /* ── Blitz: aggressive E minor pentatonic ── */
      blitz: {
        scale: [329.63, 392.00, 440.00, 493.88, 587.33,
                659.26, 783.99, 880.00, 987.77, 1174.66],
        phrases: [
          [329.63, 0, 392.00, 0, 440.00, 493.88, 0, 440.00],
          [493.88, 0, 440.00, 392.00, 0, 329.63, 0, 392.00],
          [587.33, 493.88, 440.00, 0, 392.00, 0, 329.63, 0],
          [440.00, 0, 587.33, 0, 493.88, 440.00, 392.00, 0],
          [329.63, 392.00, 0, 493.88, 0, 440.00, 0, 329.63],
          [587.33, 0, 440.00, 0, 493.88, 587.33, 0, 440.00]
        ],
        chords: [
          [164.81, 246.94],   // E5 power
          [146.83, 220.00],   // D5 power
          [130.81, 196.00],   // C5 power
          [146.83, 220.00]    // D5 power
        ],
        melody: { type: 'sawtooth', attack: 0.01,  release: 0.08, vol: 0.07  },
        bass:   { type: 'square',   vol: 0.07  },
        filter: { cutoff: 3500, Q: 2.0 }
      },

      /* ── Classic: balanced C major pentatonic ── */
      classic: {
        scale: [261.63, 293.66, 329.63, 392.00, 440.00,
                523.25, 587.33, 659.26, 783.99, 880.00],
        phrases: [
          [261.63, 329.63, 392.00, 440.00, 392.00, 329.63, 293.66, 261.63],
          [329.63, 392.00, 523.25, 440.00, 392.00, 440.00, 329.63, 293.66],
          [440.00, 392.00, 329.63, 261.63, 293.66, 329.63, 392.00, 523.25],
          [392.00, 523.25, 587.33, 523.25, 440.00, 392.00, 329.63, 392.00]
        ],
        chords: [
          [130.81, 164.81, 196.00],   // C
          [110.00, 130.81, 164.81],   // Am
          [87.31,  110.00, 130.81],   // F
          [98.00,  123.47, 146.83]    // G
        ],
        melody: { type: 'triangle', attack: 0.02,  release: 0.15, vol: 0.055 },
        bass:   { type: 'triangle', vol: 0.05  },
        filter: null   // classic: no melody filter (direct)
      },

      /* ── Endless: ambient D minor pentatonic ── */
      endless: {
        scale: [293.66, 349.23, 392.00, 440.00, 523.25,
                587.33, 698.46, 783.99, 880.00, 1046.50],
        phrases: [
          [293.66, 0, 440.00, 0, 349.23, 0, 392.00, 0],
          [440.00, 0, 0, 523.25, 0, 587.33, 0, 0],
          [392.00, 0, 349.23, 0, 293.66, 0, 0, 0],
          [523.25, 0, 440.00, 0, 392.00, 0, 349.23, 0],
          [293.66, 0, 0, 349.23, 0, 0, 440.00, 0],
          [587.33, 0, 523.25, 0, 0, 440.00, 0, 392.00]
        ],
        chords: [
          [146.83, 174.61, 220.00, 261.63, 329.63],   // Dm9
          [116.54, 146.83, 174.61, 220.00],            // Gm7/Bb
          [110.00, 146.83, 164.81, 196.00],            // Am7sus4
          [87.31,  110.00, 130.81, 164.81, 196.00]     // Fmaj9
        ],
        melody: { type: 'sine',     attack: 0.1,   release: 0.8,  vol: 0.03  },
        bass:   { type: 'sine',     vol: 0.03  },
        filter: { cutoff: 2500, Q: 0.5 }
      },

      /* ── Competition: intense A natural minor ── */
      competition: {
        scale: [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00,
                440.00, 493.88, 523.25, 587.33, 659.26, 698.46, 783.99],
        phrases: [
          [220.00, 261.63, 293.66, 329.63, 329.63, 293.66, 261.63, 220.00],
          [329.63, 349.23, 392.00, 440.00, 392.00, 349.23, 329.63, 293.66],
          [440.00, 392.00, 349.23, 329.63, 349.23, 392.00, 440.00, 523.25],
          [523.25, 493.88, 440.00, 392.00, 440.00, 523.25, 587.33, 659.26]
        ],
        chords: [
          [110.00, 130.81, 164.81],   // Am
          [87.31,  110.00, 130.81],   // F
          [130.81, 164.81, 196.00],   // C
          [98.00,  123.47, 146.83]    // G
        ],
        melody: { type: 'sawtooth', attack: 0.008, release: 0.06, vol: 0.06  },
        bass:   { type: 'sawtooth', vol: 0.06  },
        filter: { cutoff: 4000, Q: 1.0 }
      }
    };
  }

  _ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      /* Master bus compressor to prevent clipping */
      this._compressor = this.ctx.createDynamicsCompressor();
      this._compressor.threshold.value = -24;
      this._compressor.knee.value = 12;
      this._compressor.ratio.value = 4;
      this._compressor.attack.value = 0.003;
      this._compressor.release.value = 0.25;
      this._compressor.connect(this.ctx.destination);

      /* Algorithmic reverb — synthetic impulse response */
      this._reverbGain = this.ctx.createGain();
      this._reverbGain.gain.value = 0.18;
      try {
        const sr = this.ctx.sampleRate;
        const len = Math.ceil(sr * 0.9); // 0.9s reverb tail
        const irBuf = this.ctx.createBuffer(2, len, sr);
        for (let ch = 0; ch < 2; ch++) {
          const d = irBuf.getChannelData(ch);
          for (let i = 0; i < len; i++) {
            const decay = Math.exp(-3.5 * i / len);
            d[i] = (Math.random() * 2 - 1) * decay;
          }
        }
        this._convolver = this.ctx.createConvolver();
        this._convolver.buffer = irBuf;
        this._reverbGain.connect(this._convolver);
        this._convolver.connect(this._compressor);
      } catch (e) {
        // Fallback: reverb send goes directly to compressor
        this._reverbGain.connect(this._compressor);
      }

      this._musicGain = this.ctx.createGain();
      this._musicGain.gain.value = 0.18;
      this._musicGain.connect(this._compressor);

      this._melodyGain = this.ctx.createGain();
      this._melodyGain.gain.value = 0.12;
      this._melodyGain.connect(this._compressor);
      this._melodyGain.connect(this._reverbGain); // send melody to reverb

      this._padGain = this.ctx.createGain();
      this._padGain.gain.value = 0.08;
      this._padGain.connect(this._compressor);
      this._padGain.connect(this._reverbGain); // send pads to reverb
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /* ─────────────────────────────────────────
     Core sound primitives
     ───────────────────────────────────────── */

  /**
   * Play a single oscillator tone with optional spatial panning.
   * @param {number} freq   - frequency in Hz
   * @param {string} type   - oscillator waveform
   * @param {number} dur    - duration in seconds
   * @param {number} vol    - peak volume (0-1)
   * @param {number} detune - cents detune
   * @param {number} pan    - stereo position (-1 left, 0 centre, +1 right)
   */
  _play(freq, type, dur, vol = 0.15, detune = 0, pan = 0) {
    if (!this.enabled) return;
    this._ensure();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    if (pan !== 0 && typeof StereoPannerNode !== 'undefined') {
      const panner = new StereoPannerNode(this.ctx, {
        pan: Math.max(-1, Math.min(1, pan))
      });
      osc.connect(gain).connect(panner).connect(this.ctx.destination);
    } else {
      osc.connect(gain).connect(this.ctx.destination);
    }
    osc.start(t);
    osc.stop(t + dur);
  }

  /**
   * Play a burst of filtered noise.
   * @param {number} dur       - duration in seconds
   * @param {number} vol       - peak volume
   * @param {number} filterHz  - highpass filter frequency
   * @param {number} pan       - stereo position
   */
  _playNoise(dur, vol = 0.05, filterHz = 4000, pan = 0) {
    if (!this.enabled) return;
    this._ensure();

    const t = this.ctx.currentTime;
    const bufLen = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = filterHz;

    if (pan !== 0 && typeof StereoPannerNode !== 'undefined') {
      const panner = new StereoPannerNode(this.ctx, {
        pan: Math.max(-1, Math.min(1, pan))
      });
      src.connect(filter).connect(gain).connect(panner).connect(this.ctx.destination);
    } else {
      src.connect(filter).connect(gain).connect(this.ctx.destination);
    }
    src.start(t);
    src.stop(t + dur);
  }

  /* ═══════════════════════════════════════
     Game sounds
     ═══════════════════════════════════════ */

  /**
   * Correct sort — 3-layer sound with spatial spread.
   * Sub-bass + mid triangle + detuned shimmer pair.
   */
  correct(streak = 1) {
    const base = 440 + Math.min(streak, 30) * 15;
    const pan = (Math.random() - 0.5) * 0.4;

    // Sub-bass layer
    this._play(base / 2, 'sine', 0.15, 0.06, 0, pan);
    // Mid layer
    this._play(base, 'triangle', 0.12, 0.14, 0, pan);
    // Shimmer layer (detuned pair)
    this._play(base * 2, 'sine', 0.08, 0.06, 8, pan);
    this._play(base * 2, 'sine', 0.08, 0.06, -8, pan);

    // Milestone chime every 5 streak
    if (streak > 0 && streak % 5 === 0) {
      setTimeout(() => {
        this._play(660, 'sine', 0.15, 0.12, 0, pan);
        this._play(880, 'sine', 0.15, 0.10, 0, pan);
        this._play(1100, 'sine', 0.2, 0.08, 0, pan);
      }, 50);
    }
  }

  /** Wrong sort — centred buzzy impact. */
  wrong() {
    this._play(200, 'sawtooth', 0.2, 0.14, 0, 0);
    this._play(150, 'sawtooth', 0.25, 0.10, 0, 0);
    this._playNoise(0.1, 0.06, 4000, 0);
  }

  /** Perfect timing bonus. */
  perfect() {
    this._play(880, 'sine', 0.1, 0.1);
    setTimeout(() => this._play(1320, 'sine', 0.15, 0.12), 60);
    setTimeout(() => this._play(1760, 'sine', 0.2, 0.08), 120);
  }

  /** Multiplier level up chime. */
  multiplierUp(level) {
    const base = 440 + level * 80;
    this._play(base, 'triangle', 0.1, 0.1);
    setTimeout(() => this._play(base * 1.25, 'triangle', 0.15, 0.12), 70);
  }

  /** Rush event — rapid triple chirp. */
  rush() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this._play(600 + i * 100, 'square', 0.06, 0.08), i * 60);
    }
  }

  /** Countdown beep — sub-bass thump, rising pitch, chord on GO. */
  countdown(n) {
    const baseFreq = n === 0 ? 880 : 380 + (3 - n) * 60;
    this._play(baseFreq, 'sine', n === 0 ? 0.3 : 0.15, 0.16);
    // Sub-bass thump
    this._play(n === 0 ? 110 : 80, 'sine', 0.1, 0.08);
    // Chord on GO
    if (n === 0) {
      setTimeout(() => {
        this._play(523, 'sine', 0.2, 0.1);
        this._play(659, 'sine', 0.2, 0.08);
        this._play(784, 'sine', 0.25, 0.06);
      }, 80);
    }
  }

  /**
   * Game over — ascending resolution to C, followed by warm major pad.
   * No descending funeral tones.
   */
  gameOver() {
    // Ascending resolution sequence ending on C5
    const notes = [392, 440, 523, 494, 523];
    notes.forEach((f, i) => {
      setTimeout(() => this._play(f, 'sine', 0.3, 0.12), i * 150);
    });

    // Warm major pad chord follows the melody
    const padDelay = notes.length * 150 + 80;
    setTimeout(() => {
      if (!this.enabled) return;
      this._ensure();
      const t = this.ctx.currentTime;

      // C4-E4-G4-C5 with chorus detune for warmth
      [262, 330, 392, 523].forEach(f => {
        for (const det of [-6, 6]) {
          const osc = this.ctx.createOscillator();
          const eg = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = f;
          osc.detune.value = det;
          eg.gain.setValueAtTime(0, t);
          eg.gain.linearRampToValueAtTime(0.055, t + 0.12);
          eg.gain.setValueAtTime(0.055, t + 0.6);
          eg.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
          osc.connect(eg).connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + 1.25);
        }
      });
    }, padDelay);
  }

  /** New personal best fanfare. */
  newPB() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => {
        this._play(f, 'sine', 0.25, 0.12);
        this._play(f * 0.5, 'triangle', 0.3, 0.06);
      }, i * 120);
    });
  }

  /**
   * Result screen jingle — plays full fanfare on PB, gentle chime otherwise.
   * @param {boolean} pb - true if this was a personal best
   */
  resultJingle(pb) {
    if (pb) {
      this.newPB();
    } else {
      [523, 659, 784].forEach((f, i) => {
        setTimeout(() => this._play(f, 'sine', 0.2, 0.08), i * 110);
      });
    }
  }

  /* ═══════════════════════════════════════
     Bonus sounds
     ═══════════════════════════════════════ */

  /** Golden shape found — shimmering arpeggio. */
  goldenFound() {
    [660, 880, 1100, 1320].forEach((f, i) => {
      setTimeout(() => this._play(f, 'sine', 0.15, 0.1), i * 40);
    });
  }

  /** Diamond shape found — crystalline sparkle. */
  diamondFound() {
    [1047, 1319, 1568, 2093].forEach((f, i) => {
      setTimeout(() => {
        this._play(f, 'sine', 0.2, 0.1);
        this._play(f * 1.01, 'sine', 0.2, 0.08); // detune shimmer
      }, i * 50);
    });
  }

  /** Fever mode activated — rapid ascending sawtooth arpeggio. */
  feverStart() {
    this._feverMode = true;
    [262, 330, 392, 523, 659, 784].forEach((f, i) => {
      setTimeout(() => this._play(f, 'sawtooth', 0.12, 0.08), i * 40);
    });
    this._musicTempo = 180;
    if (this._musicAudio) this._musicAudio.playbackRate = 1.18;
  }

  /** Fever mode ended — gentle descending resolve. */
  feverEnd() {
    this._feverMode = false;
    this._musicTempo = this._baseTempo;
    if (this._musicAudio) this._musicAudio.playbackRate = 1;
    this._play(400, 'sine', 0.3, 0.08);
    this._play(300, 'sine', 0.4, 0.06);
  }

  setPerformanceIntensity(streak = 0) {
    if (this._feverMode) return;
    const cleanStreak = Math.max(0, Math.min(40, Number(streak) || 0));
    const tempoLift = Math.floor(cleanStreak / 4) * 5;
    const targetTempo = Math.min(this._baseTempo + 48, this._baseTempo + tempoLift);
    this._musicTempo = targetTempo;
    if (this._musicAudio) {
      this._musicAudio.playbackRate = Math.min(1.22, 1 + (targetTempo - this._baseTempo) / 220);
    }
  }

  /** Corner shuffle warning — swirling descending whoosh. */
  cornerShuffleWarn() {
    [800, 700, 600, 500].forEach((f, i) => {
      setTimeout(() => this._play(f, 'triangle', 0.08, 0.1, i * 4), i * 50);
    });
  }

  /** Corner shuffle done — snappy chord confirming new layout. */
  cornerShuffleDone() {
    this._play(523, 'sine', 0.15, 0.1);
    setTimeout(() => {
      this._play(659, 'sine', 0.15, 0.08);
      this._play(784, 'sine', 0.15, 0.06);
    }, 60);
  }

  /** Level up — grand ascending sequence with undertones. */
  levelUp() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      setTimeout(() => {
        this._play(f, 'sine', 0.2, 0.12);
        this._play(f * 0.75, 'triangle', 0.25, 0.06);
      }, i * 100);
    });
  }

  /** Achievement unlocked — delayed bright arpeggio. */
  achievementUnlock() {
    setTimeout(() => {
      [880, 1100, 1320, 1760].forEach((f, i) => {
        setTimeout(() => this._play(f, 'sine', 0.2, 0.1, i * 5), i * 80);
      });
    }, 200);
  }

  /** Near personal best — subtle double pulse. */
  nearPB() {
    this._play(880, 'sine', 0.08, 0.06);
    setTimeout(() => this._play(880, 'sine', 0.08, 0.06), 120);
  }

  /** Last seconds tick. */
  lastSeconds() {
    this._play(1000, 'square', 0.03, 0.06);
  }

  /** UI tap feedback. */
  tap() {
    this._play(600, 'sine', 0.04, 0.04);
  }

  /* ═══════════════════════════════════════
     Expanded SFX
     ═══════════════════════════════════════ */

  /**
   * Combo milestone fanfare — scales with streak magnitude.
   * Bigger arpeggio and shimmer burst at 30+ and 50+.
   */
  comboMilestone(streak) {
    if (!this.enabled) return;
    this._ensure();

    let notes, vol, dur, spacing;

    if (streak >= 50) {
      notes   = [523, 659, 784, 880, 1047, 1319, 1568];
      vol     = 0.16;
      dur     = 0.3;
      spacing = 70;
    } else if (streak >= 30) {
      notes   = [523, 659, 784, 1047, 1319, 1568];
      vol     = 0.14;
      dur     = 0.25;
      spacing = 65;
    } else {
      notes   = [523, 659, 784, 1047];
      vol     = 0.11;
      dur     = 0.2;
      spacing = 60;
    }

    notes.forEach((f, i) => {
      setTimeout(() => {
        this._play(f, 'sine', dur, vol);
        this._play(f * 1.5, 'sine', dur * 0.7, vol * 0.4);
        this._play(f * 0.5, 'triangle', dur * 1.2, vol * 0.3);
      }, i * spacing);
    });

    if (streak >= 30) {
      const totalTime = notes.length * spacing;
      setTimeout(() => {
        this._play(2093, 'sine', 0.4, vol * 0.35);
        this._play(2093 * 1.005, 'sine', 0.4, vol * 0.3);
        this._playNoise(0.08, 0.03);
      }, totalTime);
    }
  }

  /**
   * Endless mode miss — dramatic impact hit.
   * Deeper/heavier with fewer lives remaining.
   */
  endlessMiss(livesLeft) {
    if (!this.enabled) return;
    this._ensure();

    const depthFactor = Math.max(1, 4 - livesLeft);
    const baseFreq    = 220 / depthFactor;
    const vol         = 0.08 + depthFactor * 0.03;
    const dur         = 0.25 + depthFactor * 0.1;

    // Impact thud — pitch sweep down
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const eg = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 3, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.08);
    eg.gain.setValueAtTime(vol, t);
    eg.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(eg).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);

    // Distortion crunch layer
    this._play(baseFreq * 0.5, 'sawtooth', dur * 0.6, vol * 0.5, 0, 0);
    this._playNoise(0.08 + depthFactor * 0.03, 0.04 + depthFactor * 0.01, 4000, 0);

    // Warning descending tone on last life
    if (livesLeft <= 1) {
      setTimeout(() => {
        this._play(440, 'sine', 0.3, 0.1);
        setTimeout(() => this._play(330, 'sine', 0.35, 0.08), 120);
        setTimeout(() => this._play(220, 'sine', 0.45, 0.06), 260);
      }, 150);
    }
  }

  /** Competition win — triumphant brass-like fanfare with sustain chord. */
  competitionWin() {
    if (!this.enabled) return;
    this._ensure();

    const fanfare = [
      { f: 392, delay: 0 },
      { f: 440, delay: 100 },
      { f: 523, delay: 200 },
      { f: 659, delay: 350 },
      { f: 784, delay: 550 },
      { f: 1047, delay: 800 }
    ];

    fanfare.forEach(({ f, delay }) => {
      setTimeout(() => {
        this._play(f, 'sawtooth', 0.35, 0.1);
        this._play(f * 0.5, 'triangle', 0.4, 0.06);
        this._play(f * 0.75, 'sine', 0.3, 0.05);
      }, delay);
    });

    // Finale sustain chord
    setTimeout(() => {
      [523, 659, 784, 1047].forEach(f => {
        this._play(f, 'sine', 0.8, 0.07);
        this._play(f * 1.003, 'sine', 0.8, 0.05);
      });
      this._play(2093, 'sine', 0.6, 0.04);
      this._playNoise(0.15, 0.03);
    }, 1000);
  }

  /**
   * Boot / intro jingle — ascending 5-note motif
   * followed by sustained pad chord and filtered noise shimmer.
   */
  bootJingle() {
    if (!this.enabled) return;
    this._ensure();

    // Five rising notes: C5-E5-G5-B5-C6
    const notes   = [523, 659, 784, 988, 1047];
    const spacing = 90;

    notes.forEach((f, i) => {
      const isLast = i === notes.length - 1;
      const dur = isLast ? 0.4 : 0.15;
      const vol = isLast ? 0.13 : 0.1;
      setTimeout(() => {
        this._play(f, 'sine', dur, vol);
        this._play(f * 2, 'sine', dur * 0.6, vol * 0.2);
      }, i * spacing);
    });

    // Soft pad on final note
    const padStart = (notes.length - 1) * spacing + 20;
    setTimeout(() => {
      this._play(523, 'triangle', 0.5, 0.04);
      this._play(784, 'triangle', 0.5, 0.03);
    }, padStart);

    // Enhanced: sustained pad chord [262,330,392] with +/-3 detune
    const chordDelay = notes.length * spacing + 80;
    setTimeout(() => {
      if (!this.enabled) return;
      this._ensure();
      const t = this.ctx.currentTime;

      [262, 330, 392].forEach(f => {
        for (const det of [-3, 3]) {
          const osc = this.ctx.createOscillator();
          const eg = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = f;
          osc.detune.value = det;
          eg.gain.setValueAtTime(0, t);
          eg.gain.linearRampToValueAtTime(0.03, t + 0.08);
          eg.gain.setValueAtTime(0.03, t + 0.7);
          eg.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
          osc.connect(eg).connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + 1.05);
        }
      });

      // Filtered noise shimmer burst (60ms, highpass 6kHz, vol 0.02)
      this._playNoise(0.06, 0.02, 6000);
    }, chordDelay);
  }

  /** Screen transition — filtered noise whoosh with tonal sweep. */
  screenTransition() {
    if (!this.enabled) return;
    this._ensure();

    const t   = this.ctx.currentTime;
    const dur = 0.18;

    // Noise sweep
    const bufLen = Math.ceil(this.ctx.sampleRate * dur);
    const buf    = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src  = this.ctx.createBufferSource();
    src.buffer = buf;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type  = 'bandpass';
    bandpass.Q.value = 2;
    bandpass.frequency.setValueAtTime(800, t);
    bandpass.frequency.exponentialRampToValueAtTime(4000, t + dur * 0.6);
    bandpass.frequency.exponentialRampToValueAtTime(1200, t + dur);

    const eg = this.ctx.createGain();
    eg.gain.setValueAtTime(0, t);
    eg.gain.linearRampToValueAtTime(0.06, t + dur * 0.3);
    eg.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(bandpass).connect(eg).connect(this.ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.01);

    // Subtle tonal element underneath
    const osc = this.ctx.createOscillator();
    const og  = this.ctx.createGain();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + dur);
    og.gain.setValueAtTime(0.03, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(og).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  /* ═══════════════════════════════════════
     v19 — New SFX for enhanced game feel
     ═══════════════════════════════════════ */

  /** UI click — short pop for button presses. */
  uiClick() {
    this._play(800, 'sine', 0.05, 0.06);
    this._play(1200, 'sine', 0.03, 0.03);
  }

  /** Streak break — descending shatter when streak>=5 lost. */
  streakBreak(lostStreak = 5) {
    if (!this.enabled) return;
    this._ensure();
    const intensity = Math.min(lostStreak / 30, 1);
    const baseFreq = 600 - intensity * 200;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const eg = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq + 200, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, t + 0.25);
    eg.gain.setValueAtTime(0.08 + intensity * 0.04, t);
    eg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(eg).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
    this._playNoise(0.12, 0.04 + intensity * 0.02, 3000);
  }

  /** Streak protection shield — warm descending chime (v22) */
  streakProtected() {
    if (!this.enabled) return;
    this._ensure();
    const t = this.ctx.currentTime;
    /* Shield activation: ascending 2-note "save" chime */
    this._play(660, 'triangle', 0.15, 0.06);
    setTimeout(() => this._play(880, 'sine', 0.2, 0.05), 80);
    /* Subtle sub impact */
    const osc = this.ctx.createOscillator();
    const eg = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
    eg.gain.setValueAtTime(0.06, t);
    eg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(eg).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  /** Rush warning — tense double tick before rush starts (v22) */
  rushWarning() {
    if (!this.enabled) return;
    this._ensure();
    this._play(700, 'square', 0.06, 0.04);
    setTimeout(() => this._play(800, 'square', 0.06, 0.05), 150);
    setTimeout(() => this._play(900, 'square', 0.08, 0.06), 300);
  }

  /** Wissen level-up — bright ascending arpeggio (v22) */
  wissenLevelUp(level = 1) {
    if (!this.enabled) return;
    this._ensure();
    const baseNotes = [523.25, 659.26, 783.99, 1046.50, 1318.51];
    const count = Math.min(3 + level, baseNotes.length);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this._play(baseNotes[i], 'triangle', 0.18, 0.04 + i * 0.005);
      }, i * 70);
    }
  }

  /**
   * Score milestone celebration — ascending fanfare.
   * @param {number} tier — index 0-4 for 1K/2.5K/5K/10K/25K
   */
  scoreMilestone(tier = 0) {
    if (!this.enabled) return;
    this._ensure();
    const patterns = [
      [523, 659, 784],
      [523, 659, 784, 880],
      [523, 659, 784, 880, 1047],
      [440, 523, 659, 784, 880, 1047],
      [392, 523, 659, 784, 880, 1047, 1319]
    ];
    const notes = patterns[Math.min(tier, patterns.length - 1)];
    const vol = 0.09 + tier * 0.015;
    const spacing = 65 - tier * 3;
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._play(f, 'sine', 0.2, vol);
        if (tier >= 2) this._play(f * 1.5, 'sine', 0.15, vol * 0.35);
      }, i * spacing);
    });
    if (tier >= 2) {
      const tailDelay = notes.length * spacing;
      setTimeout(() => {
        this._play(notes[notes.length - 1] * 2, 'sine', 0.3, vol * 0.3);
        this._playNoise(0.06, 0.02, 6000);
      }, tailDelay);
    }
  }

  /** Score count-up tick for results screen. */
  scoreCountTick(progress = 0) {
    const freq = 600 + progress * 400;
    this._play(freq, 'sine', 0.025, 0.04);
  }

  /** Heartbeat for continue prompt. */
  continueHeartbeat() {
    if (!this.enabled) return;
    this._ensure();
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const eg1 = this.ctx.createGain();
    osc1.type = 'sine'; osc1.frequency.value = 60;
    eg1.gain.setValueAtTime(0.1, t);
    eg1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc1.connect(eg1).connect(this.ctx.destination);
    osc1.start(t); osc1.stop(t + 0.15);
    const osc2 = this.ctx.createOscillator();
    const eg2 = this.ctx.createGain();
    osc2.type = 'sine'; osc2.frequency.value = 70;
    eg2.gain.setValueAtTime(0.07, t + 0.15);
    eg2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc2.connect(eg2).connect(this.ctx.destination);
    osc2.start(t + 0.15); osc2.stop(t + 0.3);
  }

  /**
   * Victory jingle — tier-based end-of-game melody.
   * @param {'bronze'|'silver'|'gold'|'platinum'} tier
   */
  victoryJingle(tier = 'bronze') {
    if (!this.enabled) return;
    this._ensure();
    const tiers = {
      bronze:   { notes: [392, 440, 523],              vol: 0.08, dur: 0.2, spacing: 100 },
      silver:   { notes: [392, 523, 659, 784],         vol: 0.10, dur: 0.22, spacing: 90 },
      gold:     { notes: [392, 523, 659, 784, 1047],   vol: 0.12, dur: 0.25, spacing: 85 },
      platinum: { notes: [330, 392, 523, 659, 784, 1047, 1319], vol: 0.14, dur: 0.3, spacing: 80 },
    };
    const cfg = tiers[tier] || tiers.bronze;
    cfg.notes.forEach((f, i) => {
      setTimeout(() => {
        this._play(f, 'sine', cfg.dur, cfg.vol);
        this._play(f * 0.5, 'triangle', cfg.dur * 1.3, cfg.vol * 0.4);
        if (tier === 'platinum' || tier === 'gold') {
          this._play(f * 1.5, 'sine', cfg.dur * 0.6, cfg.vol * 0.25);
        }
      }, i * cfg.spacing);
    });
    if (tier === 'gold' || tier === 'platinum') {
      const padDelay = cfg.notes.length * cfg.spacing + 50;
      setTimeout(() => {
        [523, 659, 784].forEach(f => {
          this._play(f, 'sine', 0.6, 0.04);
          this._play(f * 1.003, 'sine', 0.6, 0.03);
        });
      }, padDelay);
    }
  }

  /** Swipe start whoosh — short directional air sound. */
  swipeStart(pan = 0) {
    if (!this.enabled) return;
    this._ensure();
    const t = this.ctx.currentTime;
    const dur = 0.06;
    const bufLen = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1500, t);
    bp.frequency.exponentialRampToValueAtTime(4000, t + dur);
    bp.Q.value = 1.5;
    const eg = this.ctx.createGain();
    eg.gain.setValueAtTime(0.04, t);
    eg.gain.exponentialRampToValueAtTime(0.001, t + dur);
    if (pan !== 0 && typeof StereoPannerNode !== 'undefined') {
      const panner = new StereoPannerNode(this.ctx, { pan: Math.max(-1, Math.min(1, pan)) });
      src.connect(bp).connect(eg).connect(panner).connect(this.ctx.destination);
    } else {
      src.connect(bp).connect(eg).connect(this.ctx.destination);
    }
    src.start(t);
    src.stop(t + dur + 0.01);
  }

  /* ═══════════════════════════════════════
     Mode-specific music configuration
     ═══════════════════════════════════════ */

  /**
   * Set the music mode before calling startMusic().
   * Resolves a track from play type plus concrete mode.
   * @param {'menu'|'blitz'|'classic'|'endless'|'competition'} mode
   * @param {{ modeId?: string, practice?: boolean }} context
   */
  _getBaseTempoForMode(mode) {
    switch (mode) {
      case 'menu':        return 72;
      case 'blitz':       return 136;
      case 'classic':     return 115;
      case 'endless':     return 92;
      case 'competition': return 140;
      default:            return 115;
    }
  }

  _resolveMusicMode(requestedMode, context = {}) {
    const playType = requestedMode || 'classic';
    const modeId = context.modeId || '';
    const flowModes = ['memo', 'sequenz'];
    const focusModes = ['mathe', 'worte', 'hauptstaedte', 'algebra', 'wissen'];
    const pressureModes = ['klassik', 'beginner', 'expert', 'ultra', 'stroop', 'fokus', 'chaos'];

    if (playType === 'menu') return 'menu';
    if (context.practice) return 'classic';
    if (playType === 'competition') return 'competition';
    if (flowModes.includes(modeId)) return 'endless';
    if (focusModes.includes(modeId)) return playType === 'endless' ? 'endless' : 'classic';
    if (pressureModes.includes(modeId)) return playType === 'endless' ? 'endless' : 'blitz';
    if (['menu', 'blitz', 'classic', 'endless', 'competition'].includes(playType)) return playType;
    return 'classic';
  }

  setMusicMode(mode, context = {}) {
    const previousMode = this._musicMode;
    this._requestedMusicMode = mode || 'classic';
    this._musicContext = { ...context };
    this._musicMode = this._resolveMusicMode(this._requestedMusicMode, this._musicContext);
    this._baseTempo = this._getBaseTempoForMode(this._musicMode);
    this._modeData = this._modeConfig[this._musicMode] || this._modeConfig.classic;
    if (!this._feverMode) {
      this._musicTempo = this._baseTempo;
      if (this._musicAudio) this._musicAudio.playbackRate = 1;
    }
    this._loadMusicManifest();
    if (this._musicRunning && previousMode !== this._musicMode) {
      this.stopMusic();
      this.startMusic();
    }
  }

  /**
   * Load the optional music track manifest once.
   * The manifest avoids blind file probes that create 404 noise.
   */
  _loadMusicManifest() {
    if (this._musicManifestLoaded) return Promise.resolve(this._availableMusicTracks);
    if (this._musicManifestPromise) return this._musicManifestPromise;

    this._musicManifestPromise = fetch('audio/music/tracks.json', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { tracks: [] }))
      .then(data => {
        const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
        this._availableMusicTracks = new Set(
          tracks
            .filter(track => typeof track === 'string' && track.trim())
            .map(track => track.trim().replace(/\.mp3$/i, ''))
        );
        this._musicManifestLoaded = true;
        return this._availableMusicTracks;
      })
      .catch(() => {
        this._availableMusicTracks = new Set();
        this._musicManifestLoaded = true;
        return this._availableMusicTracks;
      });

    return this._musicManifestPromise;
  }

  _hasMusicFile(mode) {
    return this._availableMusicTracks.has(mode);
  }

  _fadeMusicFileTo(targetVolume, durationMs = 450) {
    if (!this._musicAudio) return;
    clearInterval(this._musicFadeTimer);
    const startVolume = this._musicAudio.volume;
    const target = Math.max(0, Math.min(1, targetVolume));
    const startedAt = performance.now();
    this._musicFadeTimer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
      this._musicAudio.volume = startVolume + (target - startVolume) * progress;
      if (progress >= 1) {
        clearInterval(this._musicFadeTimer);
        this._musicFadeTimer = null;
      }
    }, 50);
  }

  /**
   * Start music from an audio file. Returns true if file playback started.
   */
  _startMusicFile() {
    const mode = this._musicMode;
    if (!this._hasMusicFile(mode)) return false;
    if (this._musicFilePlaying && this._musicFileMode === mode && this._musicAudio && !this._musicAudio.paused) {
      return true;
    }
    const url = `audio/music/${mode}.mp3`;
    if (!this._musicAudio) {
      this._musicAudio = new Audio();
      this._musicAudio.loop = true;
    }
    clearInterval(this._musicFadeTimer);
    this._musicFadeTimer = null;
    this._musicAudio.src = url;
    this._musicAudio.currentTime = 0;
    this._musicAudio.playbackRate = 1;
    this._musicAudio.volume = 0;
    this._musicAudio.play().then(() => {
      this._musicFilePlaying = true;
      this._musicFileMode = mode;
      this._fadeMusicFileTo(this._musicFileVolume, 450);
    }).catch(() => {
      this._musicFilePlaying = false;
      this._musicFileMode = null;
      this._availableMusicTracks.delete(mode);
    });
    return true;
  }

  /**
   * Stop file-based music playback.
   */
  _stopMusicFile() {
    clearInterval(this._musicFadeTimer);
    this._musicFadeTimer = null;
    if (this._musicAudio) {
      this._musicAudio.pause();
      this._musicAudio.currentTime = 0;
    }
    this._musicFilePlaying = false;
    this._musicFileMode = null;
  }

  /* ═══════════════════════════════════════
      2-Layer Tension Build-Up System
     Non-frightening urgency (replaces siren)
     ═══════════════════════════════════════ */

  /**
  * Start a 2-layer tension build when timer drops under 10 seconds.
   *  A — Filtered percussion ticking (bandpass noise bursts)
   *  B — Subtle heartbeat pulse (55 Hz sine with gain pulsing)
   * Uses recalculated setTimeout per tick to avoid drift.
   */
  startTension() {
    if (this._tensionActive || !this.enabled) return;
    this._ensure();
    this._tensionActive = true;
    this._tensionStartTime = this.ctx.currentTime;
    this._tensionNodes = [];
    this._tensionTimers = [];

    const DURATION = 10; // seconds

    /* ─── Layer A: Filtered percussion ticking ─── */
    // 30ms noise bursts through bandpass at 2kHz
    // Interval: 800ms -> 200ms   Volume: 0.02 -> 0.05
    const tickDest = this.ctx.createGain();
    tickDest.gain.value = 1.0;
    tickDest.connect(this.ctx.destination);
    this._tensionNodes.push(tickDest);

    const scheduleTick = () => {
      if (!this._tensionActive) return;
      const elapsed = this.ctx.currentTime - this._tensionStartTime;
      if (elapsed >= DURATION) return;
      const progress = Math.min(elapsed / DURATION, 1);

      const t = this.ctx.currentTime;
      const tickDur = 0.03;
      const bufLen = Math.ceil(this.ctx.sampleRate * tickDur);
      const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2000;
      bp.Q.value = 2;

      const eg = this.ctx.createGain();
      const tickVol = 0.02 + progress * 0.03; // 0.02 -> 0.05
      eg.gain.setValueAtTime(tickVol, t);
      eg.gain.exponentialRampToValueAtTime(0.001, t + tickDur);

      src.connect(bp).connect(eg).connect(tickDest);
      src.start(t);
      src.stop(t + tickDur + 0.01);

      // Next tick: interval linearly decreases 800ms -> 200ms
      const interval = 800 - progress * 600;
      const id = setTimeout(scheduleTick, interval);
      this._tensionTimers.push(id);
    };
    scheduleTick();

    /* ─── Layer B: Subtle heartbeat pulse ─── */
    // Sine at 55Hz, lowpass 120Hz, gain pulses on a shrinking cycle
    // Cycle: 700ms -> 400ms   Volume: 0.03 -> 0.06
    const heartOsc = this.ctx.createOscillator();
    heartOsc.type = 'sine';
    heartOsc.frequency.value = 55;

    const heartLP = this.ctx.createBiquadFilter();
    heartLP.type = 'lowpass';
    heartLP.frequency.value = 120;

    const heartGain = this.ctx.createGain();
    heartGain.gain.value = 0;

    heartOsc.connect(heartLP).connect(heartGain).connect(this.ctx.destination);
    heartOsc.start(this.ctx.currentTime);
    this._tensionNodes.push(heartOsc, heartLP, heartGain);

    const scheduleHeartbeat = () => {
      if (!this._tensionActive) return;
      const elapsed = this.ctx.currentTime - this._tensionStartTime;
      if (elapsed >= DURATION) return;
      const progress = Math.min(elapsed / DURATION, 1);

      const t = this.ctx.currentTime;
      const pulseVol = 0.03 + progress * 0.03; // 0.03 -> 0.06

      heartGain.gain.cancelScheduledValues(t);
      heartGain.gain.setValueAtTime(0, t);
      heartGain.gain.linearRampToValueAtTime(pulseVol, t + 0.04);
      heartGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      // Cycle shrinks: 700ms -> 400ms
      const cycle = 700 - progress * 300;
      const id = setTimeout(scheduleHeartbeat, cycle);
      this._tensionTimers.push(id);
    };
    scheduleHeartbeat();

  }

  /** Stop the tension build (timer reset, game end, etc.). */
  stopTension() {
    if (!this._tensionActive) return;
    this._tensionActive = false;

    // Clear all scheduled tick/heartbeat timers
    this._tensionTimers.forEach(id => clearTimeout(id));
    this._tensionTimers = [];

    const t = this.ctx ? this.ctx.currentTime : 0;
    const fadeOut = 0.15;

    this._tensionNodes.forEach(node => {
      try {
        if (node instanceof GainNode) {
          node.gain.cancelScheduledValues(t);
          node.gain.setValueAtTime(node.gain.value, t);
          node.gain.linearRampToValueAtTime(0, t + fadeOut);
        }
        if (node instanceof OscillatorNode) {
          node.stop(t + fadeOut + 0.05);
        }
        if (node instanceof AudioBufferSourceNode) {
          node.stop(t + fadeOut + 0.05);
        }
      } catch (e) {
        // Node already stopped — safe to ignore
      }
    });

    this._tensionNodes = [];
  }

  /* ═══════════════════════════════════════
     Procedural background music
     Melody, chords, bass line, percussion,
     pad filter sweep, mode awareness
     ═══════════════════════════════════════ */

  startMusic() {
    if (!this.musicEnabled || this._musicRunning) return;
    this._ensure();
    this._musicRunning = true;

    /* Try audio file first, fall back to procedural synth */
    if (this._hasMusicFile(this._musicMode) && this._startMusicFile()) {
      return; /* file-based playback started */
    }

    this._musicBeat = 0;
    this._melodyIndex = 0;
    this._chordIndex = 0;
    this._currentPhrase = null;
    this._phrasePos = 0;

    const md = this._modeConfig[this._musicMode] || this._modeConfig.classic;
    this._modeData = md;

    if (!this._feverMode) {
      this._musicTempo = this._baseTempo;
    }

    /* Set up melody filter for current mode */
    if (this._melodyFilter) {
      try { this._melodyFilter.disconnect(); } catch (e) {}
      this._melodyFilter = null;
    }
    if (md.filter) {
      this._melodyFilter = this.ctx.createBiquadFilter();
      this._melodyFilter.type = 'lowpass';
      this._melodyFilter.frequency.value = md.filter.cutoff;
      this._melodyFilter.Q.value = md.filter.Q;
      this._melodyFilter.connect(this._melodyGain);
    }

    const schedule = () => {
      if (!this._musicRunning) return;
      this._musicBeat++;

      if (this.musicEnabled) {
        const t = this.ctx.currentTime;
        const g = this._musicGain;
        const mode = this._musicMode;
        const isMenu = mode === 'menu';
        const isEndless = mode === 'endless';

        /* Swing: offset even beats slightly for groove (in seconds) */
        const swingAmt = isMenu ? 0.018 : (isEndless ? 0.012 : 0.008);
        const swing = (this._musicBeat % 2 === 0) ? swingAmt : 0;
        /* Humanize: small random timing offset (±3ms) */
        const humanize = (Math.random() - 0.5) * 0.006;
        const tt = t + swing + humanize; // timing with groove
        /* Velocity randomizer for percussion */
        const velR = () => 0.88 + Math.random() * 0.24;

        /* ────────── KICK on beats 1 and 3 (not menu) ────────── */
        if (!isMenu) {
          const playKick = (this._musicBeat % 8 === 1 || this._musicBeat % 8 === 5);
          if (playKick) {
            const osc = this.ctx.createOscillator();
            const eg = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(isEndless ? 120 : 150, tt);
            osc.frequency.exponentialRampToValueAtTime(isEndless ? 35 : 40, tt + 0.1);
            const kickVol = (this._feverMode ? 0.15 : (isEndless ? 0.06 : 0.1)) * velR();
            eg.gain.setValueAtTime(kickVol, tt);
            eg.gain.exponentialRampToValueAtTime(0.001, tt + 0.15);
            osc.connect(eg).connect(g);
            osc.start(tt);
            osc.stop(tt + 0.15);
          }
        }

        /* ────────── HI-HAT on every beat ────────── */
        if (!isMenu && this._musicBeat % 2 === 0) {
          if (!isEndless || this._musicBeat % 4 === 0) {
            const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.03, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const eg = this.ctx.createGain();
            const hhVol = (isEndless ? 0.025 : 0.04) * velR();
            eg.gain.setValueAtTime(hhVol, tt);
            eg.gain.exponentialRampToValueAtTime(0.001, tt + 0.03);
            const filt = this.ctx.createBiquadFilter();
            filt.type = 'highpass';
            filt.frequency.value = 8000;
            src.connect(filt).connect(eg).connect(g);
            src.start(tt);
            src.stop(tt + 0.05);
          }
        }

        /* ────────── MENU ARPEGGIO (replaces percussion) ────────── */
        if (isMenu && this._musicBeat % 4 === 1) {
          const chord = md.chords[this._chordIndex % md.chords.length];
          chord.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const eg = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq * 2;
            eg.gain.setValueAtTime(0, t + i * 0.06);
            eg.gain.linearRampToValueAtTime(0.02, t + i * 0.06 + 0.02);
            eg.gain.setValueAtTime(0.02, t + i * 0.06 + 0.05);
            eg.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 1.2);
            osc.connect(eg).connect(g);
            osc.start(t + i * 0.06);
            osc.stop(t + i * 0.06 + 1.25);
          });
        }

        /* ────────── MENU PERCUSSION (lounge groove after intro) ────────── */
        if (isMenu && this._musicBeat >= 8) {
          /* ── Kick drum on beats 1 and 5 ── */
          if (this._musicBeat % 8 === 1 || this._musicBeat % 8 === 5) {
            /* Layered kick: sine body + click transient */
            const kickBody = this.ctx.createOscillator();
            const kickEnv = this.ctx.createGain();
            kickBody.type = 'sine';
            kickBody.frequency.setValueAtTime(80, tt);
            kickBody.frequency.exponentialRampToValueAtTime(35, tt + 0.12);
            kickEnv.gain.setValueAtTime(0.09 * velR(), tt);
            kickEnv.gain.exponentialRampToValueAtTime(0.001, tt + 0.22);
            kickBody.connect(kickEnv).connect(g);
            kickBody.start(tt);
            kickBody.stop(tt + 0.25);
            /* Click transient for punch */
            const clickBuf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * 0.008), this.ctx.sampleRate);
            const clickData = clickBuf.getChannelData(0);
            for (let ci = 0; ci < clickData.length; ci++) clickData[ci] = (Math.random() * 2 - 1) * (1 - ci / clickData.length);
            const clickSrc = this.ctx.createBufferSource();
            clickSrc.buffer = clickBuf;
            const clickEnv = this.ctx.createGain();
            clickEnv.gain.setValueAtTime(0.06 * velR(), tt);
            clickEnv.gain.exponentialRampToValueAtTime(0.001, tt + 0.01);
            const clickHP = this.ctx.createBiquadFilter();
            clickHP.type = 'highpass';
            clickHP.frequency.value = 800;
            clickSrc.connect(clickHP).connect(clickEnv).connect(g);
            clickSrc.start(tt);
            clickSrc.stop(tt + 0.02);
          }

          /* ── Snare on beats 3 and 7 ── */
          if (this._musicBeat % 8 === 3 || this._musicBeat % 8 === 7) {
            const v = velR();
            /* Noise burst for snare body */
            const snareBuf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * 0.08), this.ctx.sampleRate);
            const snareData = snareBuf.getChannelData(0);
            for (let si = 0; si < snareData.length; si++) snareData[si] = Math.random() * 2 - 1;
            const snareSrc = this.ctx.createBufferSource();
            snareSrc.buffer = snareBuf;
            const snareEnv = this.ctx.createGain();
            snareEnv.gain.setValueAtTime(0.05 * v, tt);
            snareEnv.gain.exponentialRampToValueAtTime(0.001, tt + 0.1);
            const snareBP = this.ctx.createBiquadFilter();
            snareBP.type = 'bandpass';
            snareBP.frequency.value = 3200;
            snareBP.Q.value = 0.8;
            snareSrc.connect(snareBP).connect(snareEnv).connect(g);
            snareSrc.start(tt);
            snareSrc.stop(tt + 0.12);
            /* Tonal body (low sine thump) */
            const snareTone = this.ctx.createOscillator();
            const snareToneEnv = this.ctx.createGain();
            snareTone.type = 'triangle';
            snareTone.frequency.setValueAtTime(180, tt);
            snareTone.frequency.exponentialRampToValueAtTime(120, tt + 0.04);
            snareToneEnv.gain.setValueAtTime(0.04 * v, tt);
            snareToneEnv.gain.exponentialRampToValueAtTime(0.001, tt + 0.06);
            snareTone.connect(snareToneEnv).connect(g);
            snareTone.start(tt);
            snareTone.stop(tt + 0.08);
          }

          /* ── Hi-hat on every even beat (8th notes) ── */
          if (this._musicBeat % 2 === 0) {
            const hhBuf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * 0.025), this.ctx.sampleRate);
            const hhData = hhBuf.getChannelData(0);
            for (let hi = 0; hi < hhData.length; hi++) hhData[hi] = Math.random() * 2 - 1;
            const hhSrc = this.ctx.createBufferSource();
            hhSrc.buffer = hhBuf;
            const hhEnv = this.ctx.createGain();
            /* Accent on downbeats (1,5), ghost on others */
            const hhVol = ((this._musicBeat % 4 === 0) ? 0.035 : 0.02) * velR();
            hhEnv.gain.setValueAtTime(hhVol, tt);
            hhEnv.gain.exponentialRampToValueAtTime(0.001, tt + 0.025);
            const hhFilter = this.ctx.createBiquadFilter();
            hhFilter.type = 'highpass';
            hhFilter.frequency.value = 9000;
            hhSrc.connect(hhFilter).connect(hhEnv).connect(g);
            hhSrc.start(tt);
            hhSrc.stop(tt + 0.04);
          }

          /* ── Open hi-hat on beat 4 (before snare) for groove ── */
          if (this._musicBeat % 8 === 2 || this._musicBeat % 8 === 6) {
            const ohBuf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * 0.06), this.ctx.sampleRate);
            const ohData = ohBuf.getChannelData(0);
            for (let oi = 0; oi < ohData.length; oi++) ohData[oi] = Math.random() * 2 - 1;
            const ohSrc = this.ctx.createBufferSource();
            ohSrc.buffer = ohBuf;
            const ohEnv = this.ctx.createGain();
            ohEnv.gain.setValueAtTime(0.018 * velR(), tt);
            ohEnv.gain.exponentialRampToValueAtTime(0.001, tt + 0.06);
            const ohFilter = this.ctx.createBiquadFilter();
            ohFilter.type = 'highpass';
            ohFilter.frequency.value = 7000;
            ohSrc.connect(ohFilter).connect(ohEnv).connect(g);
            ohSrc.start(tt);
            ohSrc.stop(tt + 0.08);
          }
        }

        /* ────────── BASS LINE ────────── */
        if (isMenu) {
          /* Menu: rhythmic walking bass — root on 1, fifth on 3, octave on 5, passing tone on 7 */
          const chord = md.chords[this._chordIndex % md.chords.length];
          const root = chord[0];
          const beatInBar = this._musicBeat % 8;
          let bassFreq = 0;
          let bassVol = md.bass.vol;
          let bassDur = 0.35;
          if (beatInBar === 1) { bassFreq = root; bassVol = 0.055; bassDur = 0.4; }      /* root */
          else if (beatInBar === 3) { bassFreq = root * 1.5; bassVol = 0.04; bassDur = 0.3; }  /* fifth */
          else if (beatInBar === 5) { bassFreq = root * 2; bassVol = 0.045; bassDur = 0.35; }  /* octave */
          else if (beatInBar === 7) { bassFreq = root * 1.25; bassVol = 0.03; bassDur = 0.2; } /* passing (third) */

          if (bassFreq > 0 && this._musicBeat >= 8) {
            const bassOsc = this.ctx.createOscillator();
            const bassEnv = this.ctx.createGain();
            bassOsc.type = 'sine';
            bassOsc.frequency.value = bassFreq;
            bassEnv.gain.setValueAtTime(0, t);
            bassEnv.gain.linearRampToValueAtTime(bassVol, t + 0.015);
            bassEnv.gain.setValueAtTime(bassVol, t + 0.02);
            bassEnv.gain.exponentialRampToValueAtTime(0.001, t + bassDur);
            /* Subtle lowpass to keep bass warm */
            const bassLP = this.ctx.createBiquadFilter();
            bassLP.type = 'lowpass';
            bassLP.frequency.value = 400;
            bassLP.Q.value = 0.7;
            bassOsc.connect(bassLP).connect(bassEnv).connect(g);
            bassOsc.start(t);
            bassOsc.stop(t + bassDur + 0.05);
          }
        } else if (this._musicBeat % 8 === 1) {
          const chord = md.chords[this._chordIndex % md.chords.length];
          const bassNote = chord[0];

          const osc = this.ctx.createOscillator();
          const eg = this.ctx.createGain();
          osc.type = md.bass.type;
          osc.frequency.value = this._feverMode ? bassNote * 1.5 : bassNote;
          eg.gain.setValueAtTime(md.bass.vol, t);
          eg.gain.exponentialRampToValueAtTime(0.001, t + (isEndless ? 0.6 : 0.4));
          osc.connect(eg).connect(g);
          osc.start(t);
          osc.stop(t + (isEndless ? 0.7 : 0.5));
        }

        /* ────────── FEVER ACCENT on syncopation ────────── */
        if (this._feverMode && (this._musicBeat % 8 === 4 || this._musicBeat % 8 === 7)) {
          const osc = this.ctx.createOscillator();
          const eg = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = 220 + Math.sin(this._musicBeat * 0.3) * 50;
          eg.gain.setValueAtTime(0.03, t);
          eg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          osc.connect(eg).connect(g);
          osc.start(t);
          osc.stop(t + 0.1);
        }

        /* ────────── MELODY LINE (phrase-based with motif development) ────────── */
        const melodyInterval = isMenu ? 4 : (mode === 'blitz' || mode === 'competition' ? 2 : 4);
        if (this._musicBeat % melodyInterval === 1) {
          // Pick a new phrase if needed — sometimes develop the previous one
          if (!this._currentPhrase || this._phrasePos >= this._currentPhrase.length) {
            const phrases = md.phrases;
            if (this._currentPhrase && Math.random() < 0.35) {
              // Motif development: transpose last phrase up/down by scale step
              const shift = (Math.random() < 0.5) ? 1.125 : 0.889; // ~major 2nd up or down
              this._currentPhrase = this._currentPhrase.map(f => f > 0 ? f * shift : 0);
            } else {
              this._currentPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            }
            this._phrasePos = 0;
          }

          const freq = this._currentPhrase[this._phrasePos];
          this._phrasePos++;

          if (freq > 0) {
            const melFreq = this._feverMode && (this._melodyIndex % 3 === 0) ? freq * 2 : freq;
            const melCfg = md.melody;

            // Spatial panning — melody notes sweep gently
            const pan = Math.sin(this._melodyIndex * 0.3) * 0.2;

            const osc = this.ctx.createOscillator();
            const eg = this.ctx.createGain();
            osc.type = melCfg.type;
            osc.frequency.value = melFreq;

            // Attack phase
            eg.gain.setValueAtTime(0, t);
            eg.gain.linearRampToValueAtTime(melCfg.vol, t + melCfg.attack);
            // Release phase
            eg.gain.setValueAtTime(melCfg.vol, t + melCfg.attack + 0.01);
            eg.gain.exponentialRampToValueAtTime(0.001, t + melCfg.attack + melCfg.release);

            const totalDur = melCfg.attack + melCfg.release + 0.02;

            // Route through filter (if present) then panner into melody gain bus
            const melDest = this._melodyFilter || this._melodyGain;
            if (typeof StereoPannerNode !== 'undefined') {
              const panner = new StereoPannerNode(this.ctx, { pan });
              osc.connect(eg).connect(panner).connect(melDest);
            } else {
              osc.connect(eg).connect(melDest);
            }
            osc.start(t);
            osc.stop(t + totalDur + 0.01);
          }

          this._melodyIndex++;
        }

        /* ────────── PAD / CHORD with filter sweep ────────── */
        const padCycleLen = isMenu ? 16 : 32;
        if (this._musicBeat % padCycleLen === 1) {
          // Fade out previous pad oscillators
          this._padOscillators.forEach(o => {
            try {
              o.eg.gain.cancelScheduledValues(t);
              o.eg.gain.setValueAtTime(o.eg.gain.value, t);
              o.eg.gain.linearRampToValueAtTime(0, t + 0.3);
              o.osc.stop(t + 0.35);
            } catch (e) { /* already stopped */ }
          });
          this._padOscillators = [];

          // Disconnect previous pad filter
          if (this._padFilter) {
            try { this._padFilter.disconnect(); } catch (e) {}
            this._padFilter = null;
          }

          const chord = md.chords[this._chordIndex % md.chords.length];
          const padDur = 60 / this._musicTempo * 4 * 0.95; // ~4 beats
          const padVol = isMenu ? 0.045 : (isEndless ? 0.03 : 0.025);

          // Lowpass filter sweep: 400Hz <-> 2000Hz over 8 bars
          // Even chords sweep up, odd chords sweep back down
          const padLP = this.ctx.createBiquadFilter();
          padLP.type = 'lowpass';
          padLP.Q.value = 1;
          const sweepUp = (this._chordIndex % 2 === 0);
          padLP.frequency.setValueAtTime(sweepUp ? 400 : 2000, t);
          padLP.frequency.linearRampToValueAtTime(sweepUp ? 2000 : 400, t + padDur);
          padLP.connect(this._padGain);
          this._padFilter = padLP;

          chord.forEach(freq => {
            // Two detuned oscillators per chord note for richness
            for (let detOff = -4; detOff <= 4; detOff += 8) {
              const osc = this.ctx.createOscillator();
              const eg = this.ctx.createGain();
              osc.type = 'sine';
              osc.frequency.value = freq * (isEndless ? 2 : 1);
              osc.detune.value = detOff;
              eg.gain.setValueAtTime(0, t);
              eg.gain.linearRampToValueAtTime(padVol, t + 0.2);
              eg.gain.setValueAtTime(padVol, t + padDur - 0.3);
              eg.gain.linearRampToValueAtTime(0, t + padDur);
              osc.connect(eg).connect(padLP);
              osc.start(t);
              osc.stop(t + padDur + 0.05);
              this._padOscillators.push({ osc, eg });
            }
          });

          this._chordIndex++;
        }

        /* ────────── COMPETITION MODE extra percussion ────────── */
        if (mode === 'competition') {
          // Snare on beat 3
          if (this._musicBeat % 8 === 5) {
            const bufLen = Math.ceil(this.ctx.sampleRate * 0.06);
            const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const eg = this.ctx.createGain();
            eg.gain.setValueAtTime(0.05 * velR(), tt);
            eg.gain.exponentialRampToValueAtTime(0.001, tt + 0.06);
            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 3000;
            bp.Q.value = 1;
            src.connect(bp).connect(eg).connect(g);
            src.start(tt);
            src.stop(tt + 0.08);
          }
          // Off-beat hi-hat for drive
          if (this._musicBeat % 2 === 1) {
            const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.015, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const eg = this.ctx.createGain();
            eg.gain.setValueAtTime(0.02 * velR(), tt);
            eg.gain.exponentialRampToValueAtTime(0.001, tt + 0.015);
            const filt = this.ctx.createBiquadFilter();
            filt.type = 'highpass';
            filt.frequency.value = 10000;
            src.connect(filt).connect(eg).connect(g);
            src.start(tt);
            src.stop(tt + 0.03);
          }
        }

        /* ────────── BLITZ MODE driving bass eighths ────────── */
        if (mode === 'blitz' && this._musicBeat % 4 === 3) {
          const chord = md.chords[this._chordIndex % md.chords.length];
          const root  = chord[0];
          const osc = this.ctx.createOscillator();
          const eg = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = root * 2;
          eg.gain.setValueAtTime(0.025, t);
          eg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          osc.connect(eg).connect(g);
          osc.start(t);
          osc.stop(t + 0.1);
        }

        /* ────────── ENDLESS MODE ambient texture ────────── */
        /* Removed: ambient noise was perceived as ocean sound */
      }

      this._musicTimeout = setTimeout(schedule, 60000 / this._musicTempo / 2);
    };

    schedule();
  }

  stopMusic() {
    this._musicRunning = false;

    /* Stop file-based music if active */
    this._stopMusicFile();

    if (this._musicTimeout) {
      clearTimeout(this._musicTimeout);
      this._musicTimeout = null;
    }
    this._feverMode = false;
    this._musicTempo = this._baseTempo;
    if (this._musicAudio) this._musicAudio.playbackRate = 1;
    this._currentPhrase = null;
    this._phrasePos = 0;

    // Clean up pad oscillators
    const t = this.ctx ? this.ctx.currentTime : 0;
    this._padOscillators.forEach(o => {
      try { o.osc.stop(t + 0.05); } catch (e) {}
    });
    this._padOscillators = [];

    // Disconnect pad filter
    if (this._padFilter) {
      try { this._padFilter.disconnect(); } catch (e) {}
      this._padFilter = null;
    }

    // Disconnect melody filter
    if (this._melodyFilter) {
      try { this._melodyFilter.disconnect(); } catch (e) {}
      this._melodyFilter = null;
    }

    // Stop any active tension
    this.stopTension();
  }

  toggle(on)      { this.enabled = on; }
  toggleMusic(on) { this.musicEnabled = on; if (!on) this.stopMusic(); }

  setMusicVolume(v) {
    if (this._musicGain) this._musicGain.gain.value = v;
    this._musicFileVolume = Math.min(1, v * 2);
    if (this._musicAudio) this._musicAudio.volume = this._musicFileVolume;
  }
}
