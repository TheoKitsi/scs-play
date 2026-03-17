/* ═══════════════════════════════════════
   SCS Play — Shared Application State
   Singleton object shared across all modules.
   Mutate properties — never reassign the export.
   ═══════════════════════════════════════ */

const app = {
  /* ─── Service instances (set once in app.js boot) ─── */
  audio:   null,
  auth:    null,
  save:    null,
  game:    null,
  effects: null,
  swipe:   null,
  bodyFx:  null,
  engagement: null,

  /* ─── UI / navigation ─── */
  currentScreen:    'boot',
  selectedMode:     'klassik',
  selectedPlayType: 'blitz',
  colorblind:       false,

  /* ─── Session tracking ─── */
  sessionGames: 0,
  sessionBest:  0,

  /* ─── Game flow flags ─── */
  pendingDaily:     false,
  gameStarting:     false,
  gameDuration:     0,
  lastResultStats:  null,
  continueStats:    null,
};

export default app;
