/* ═══════════════════════════════════════
   SCS Play — Haptic Engine
   Provides intense, physical-feeling vibrations 
   synchronized with visual & game events.
   ═══════════════════════════════════════ */

const PATTERNS = {
  // == UI & Navigation ==
  tap:        [10],                      // Crisp menu tap
  hover:      [5],                       // Barely noticeable hover passing
  tick:       [8],                       // Small repetitive action (switches)
  purchase:   [20, 20, 40],              // Double click feel

  // == Gameplay Core ==
  correct:    [15],                      // Quick snap
  perfect:    [15, 10, 25],              // Smooth rolling impact
  wrong:      [20, 30, 20, 30, 20],      // Stuttering error
  heartLost:  [60, 40, 100],             // Heavy thump

  // == Streaks & Combos (Crescendos) ==
  streak5:    [15, 20, 25],              // Rising
  streak10:   [20, 15, 25, 15, 40],      // Rising sharp
  combo:      [30, 40, 50, 40],          // Rapid heartbeat
  rush:       [15, 30, 15, 30, 15, 30],  // Sustained thrum
  fever:      [50, 20, 50, 20, 60, 10, 80], // Massive explosion intro

  // == Milestones & Collectibles ==
  golden:     [20, 15, 15, 15, 30],      // Sparkle
  diamond:    [10, 10, 10, 10, 10, 50],  // Shimmer then pop
  levelUp:    [30, 40, 40, 40, 60, 20, 90], // Grand fanfare
  newPB:      [40, 30, 30, 30, 50, 20, 80, 20, 120], // Ecstatic heartbeat
  countdown:  [20],                      // Clock tick
  go:         [40, 20, 60],              // GO! burst
  gameOver:   [100, 50, 150, 50, 200]    // Devastating crush
};

/**
 * Trigger a highly tuned haptic vibration pattern.
 * @param {string} pattern - Key from PATTERNS
 * @param {object} save    - SaveService instance (to check haptics setting)
 * @param {number} [intensityRamp=1.0] - Optional multiplier for duration tuning
 */
export function haptic(pattern = 'tap', save, intensityRamp = 1.0) {
  if (save && !save.getSetting('haptics')) return;
  if (!navigator.vibrate) return;
  
  let p = PATTERNS[pattern] || PATTERNS.tap;
  
  if (intensityRamp !== 1.0) {
    p = p.map((val, idx) =>
      idx % 2 === 0 ? Math.min(Math.floor(val * intensityRamp), 300) : val
    );
  }

  navigator.vibrate(p);
}
