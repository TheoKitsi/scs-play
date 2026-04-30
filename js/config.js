/* ═══════════════════════════════════════════════════════
   SCS Play — Configuration Constants
   Modes: Beginner / Expert / Ultra
   Play Types: Blitz / Classic / Endless / Competition
   ═══════════════════════════════════════════════════════ */
export const DEBUG = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

export const CONFIG = {
  /* ─── Timer (per play type) ─── */
  GAME_DURATION: 30,                  // default (Blitz)
  DURATION_BLITZ: 30,
  DURATION_BLITZ_BRAIN: 60,           // brain/reflex modes need more time per round
  DURATION_CLASSIC: 60,
  DURATION_ENDLESS: 0,                // 0 = no timer
  DURATION_COMPETITION: [20, 25, 30, 35, 40, 45, 50, 55, 60, 60], // per level
  DURATION_COMPETITION_BRAIN: [26, 32, 39, 45, 52, 58, 65, 71, 78, 78], // ~30% more for brain/reflex

  /* ─── Endless mode ─── */
  ENDLESS_MAX_MISSES: 5,              // total misses allowed in endless

  /* ─── Competition levels ─── */
  COMPETITION_LEVELS: 10,
  COMPETITION_SCORE_TARGETS: [500, 1200, 2000, 3000, 4500, 6000, 7500, 9000, 11000, 14000],

  /* ─── Spawn interval (ms) ─── */
  SPAWN_INTERVAL_START: 850,
  SPAWN_INTERVAL_MIN: 400,
  SPAWN_INTERVAL_MAX: 1100,
  SPAWN_INTERVAL_STEP: 15,

  /* Brain-mode overrides (reading + thinking requires more time) */
  SPAWN_BRAIN_START: 2400,       // comfortable start for math/words
  SPAWN_BRAIN_MIN: 1000,          // minimum 1.0s (need to read + solve)
  SPAWN_BRAIN_MAX: 4000,
  SPAWN_BRAIN_STEP: 40,
  SPAWN_BRAIN_CLASSIC_START: 2800,  // standard play type: slightly more relaxed
  SPAWN_BRAIN_ENDLESS_START: 2600,  // endless: comfortable pace

  /* ─── Scoring ─── */
  BASE_SCORE: 100,
  TIME_BONUS_MAX: 50,
  TIME_BONUS_WINDOW: 500,
  MULTIPLIER_MAX: 8,
  STREAK_PER_MULTIPLIER: 5,
  MISS_PENALTY: 1,
  PERFECT_WINDOW_MS: 400,
  END_BONUS_STREAK_MULT: 50,
  END_BONUS_ACCURACY_MULT: 100,

  /* ─── Streak Time Bonus ─── */
  STREAK_TIME_THRESHOLD: 5,       // consecutive correct before time bonus starts
  STREAK_TIME_BONUS: 2,           // seconds added per correct after threshold
  WRONG_TIME_PENALTY: 1,          // seconds removed per wrong answer
  WRONG_TIME_PENALTY_BRAIN: 0,    // brain modes: no penalty for wrong (reading takes time)
  ENDLESS_LIFE_STREAK: 15,        // earn +1 life every N streak in endless

  /* ─── Direct speed-up on correct ─── */
  SPEED_CORRECT_DIVISOR: 90,      // ~90 correct answers from start to min interval (gentler curve)
  SPEED_WRONG_RECOVERY_MULT: 5,   // wrong recovery = 5x the correct step (faster bounce-back)

  /* ─── Answer window (ms) — minimum time before auto-miss triggers ─── */
  MIN_ANSWER_WINDOW: 1200,
  MIN_ANSWER_WINDOW_REFLEX: 1500,
  MIN_ANSWER_WINDOW_BRAIN: 1800,
  MIN_ANSWER_WINDOW_MEMO: 2200,

  /* ─── Anti-cheat ─── */
  ANTI_CHEAT_MIN_REACTION: 50,

  /* ─── Rush phases ─── */
  RUSH_INTERVAL: 15,
  RUSH_COUNT: 2,
  RUSH_DELAY: 1200,
  RUSH_WARNING_MS: 800,

  /* ─── Adaptive difficulty ─── */
  DIFFICULTY_GOOD_ACCURACY: 0.9,
  DIFFICULTY_GOOD_REACTION: 600,
  DIFFICULTY_BAD_ACCURACY: 0.7,
  DIFFICULTY_BAD_CONSECUTIVE_MISSES: 2,

  /* ─── Practice ─── */
  PRACTICE_INTERVAL: 1400,

  /* ─── Swipe detection ─── */
  SWIPE_MIN_DISTANCE: 24,
  SWIPE_MAX_TIME: 800,
  SWIPE_MIN_VELOCITY: 0.18,  // px/ms — reject only clearly accidental drags

  /* ─── Colours (12 for Ultra, first 4 for Beginner, first 8 for Expert) ─── */
  COLORS: {
    normal:     ['#FF4757','#3742FA','#2ED573','#FFA502','#FF6B81','#5352ED','#7BED9F','#ECCC68','#FF9FF3','#48DBFB','#C44569','#F8EFBA'],
    colorblind: ['#FF6348','#A55EEA','#A4B0BE','#18DCFF','#FC5C65','#778CA3','#45AAF2','#F7B731','#2C3A47','#E15F41','#6D214F','#B33771']
  },

  /* ─── Shapes per mode ─── */
  SHAPES_KLASSIK:  ['square'],                     // Klassik: only colored squares
  SHAPES_BEGINNER: ['circle','square','triangle','star'],
  SHAPES_EXPERT:   ['circle','square','triangle','star','diamond','hexagon','pentagon','cross'],
  SHAPES_ULTRA:    ['circle','square','triangle','star','diamond','hexagon','pentagon','cross','heart','crescent','arrow','bolt'],

  /* ─── Directions per mode ─── */
  DIRECTIONS_KLASSIK:  ['ul','ur','dl','dr'],      // Klassik: 4 diagonal directions
  DIRECTIONS_BEGINNER: ['ul','ur','dl','dr'],
  DIRECTIONS_EXPERT:   ['ul','ur','dl','dr','up','down','left','right'],
  DIRECTIONS_ULTRA:    ['ul','ur','dl','dr','up','down','left','right','ene','nnw','wsw','sse'],

  /* ─── Bonus system ─── */
  GOLDEN_CHANCE:    0.12,
  DIAMOND_CHANCE:   0.07,
  GOLDEN_MULT:      3,
  DIAMOND_MULT:     5,
  FEVER_STREAK:     20,
  FEVER_STREAK_BRAIN: 12,
  FEVER_DURATION:   4000,
  FEVER_COOLDOWN_MS: 3000,
  FEVER_MULT:       2,

  /* ─── XP / Levels ─── */
  XP_PER_100_SCORE: 2,
  LEVEL_THRESHOLDS: [
    0,          // Lv 0: Start
    100,        // Lv 1: ~5 games
    400,        // Lv 2: ~20 games
    1000,       // Lv 3: ~50 games
    2500,       // Lv 4: ~125 games
    5000,       // Lv 5: ~250 games (~2-3 days)
    10000,      // Lv 6: ~500 games
    20000,      // Lv 7: ~1000 games
    40000,      // Lv 8: ~2000 games
    80000,      // Lv 9: ~4000 games
    150000,     // Lv 10: ~7500 games (~2 weeks)
    250000,     // Lv 11
    400000,     // Lv 12
    650000,     // Lv 13
    1000000,    // Lv 14
    1500000,    // Lv 15
    2200000,    // Lv 16
    3200000,    // Lv 17
    4500000,    // Lv 18
    6500000,    // Lv 19
    9000000,    // Lv 20
    12000000,   // Lv 21
    16000000,   // Lv 22
    21000000,   // Lv 23
    27000000,   // Lv 24
    35000000,   // Lv 25
    45000000,   // Lv 26
    58000000,   // Lv 27
    75000000,   // Lv 28
    100000000   // Lv 29
  ],
  LEVEL_NAMES_DE: [
    'Neuling','Anfänger','Lehrling','Aufsteiger','Geselle',
    'Profi','Experte','Meister','Veteran','Könner',
    'Großmeister','Champion','Legende','Titan','Phänomen',
    'Mythisch','Unsterblich','Göttlich','Transzendent','Gott',
    'Arcana','Ewiger','Urkraft','Kosmisch','Absolut',
    'Omega','Unendlich','Allwissend','Schöpfer','Ultimativ'
  ],
  LEVEL_NAMES_EN: [
    'Rookie','Beginner','Apprentice','Rising Star','Journeyman',
    'Pro','Expert','Master','Veteran','Adept',
    'Grand Master','Champion','Legend','Titan','Phenomenon',
    'Mythic','Immortal','Divine','Transcendent','God',
    'Arcana','Eternal','Primal','Cosmic','Absolute',
    'Omega','Infinite','Omniscient','Creator','Ultimate'
  ],

  /* ─── Daily XP diminishing returns (v23) ─── */
  DAILY_XP_BRACKETS: [
    { limit: 3000,   rate: 1.0 },   // first 3000 XP: full rate
    { limit: 6000,   rate: 0.4 },   // 3000-6000: 40% rate
    { limit: 12000,  rate: 0.15 },  // 6000-12000: 15% rate
    { limit: Infinity, rate: 0.05 } // beyond: 5%
  ],

  /* ─── Corner Shuffle (adaptive — shape modes only) ─── */
  CORNER_SHUFFLE_FIRST: 12,         // first shuffle after 12 correct
  CORNER_SHUFFLE_INTERVAL: 10,      // then every N correct
  CORNER_SHUFFLE_STEP: 2,           // reduce interval by 2 each shuffle
  CORNER_SHUFFLE_MIN_INTERVAL: 6,   // never faster than every 6
  CORNER_SHUFFLE_WARNING_MS: 1400,  // warning flash before shuffle (was 800ms)
  CORNER_SHUFFLE_COLORS: true,      // also shuffle colors when corners shuffle

  /* ─── Anti-Frustration System (v23 — streak protection removed for tension) ─── */
  GENTLE_START_COUNT: 5,            // first N answers always at base speed
  GENTLE_START_NO_RUSH_SEC: 10,     // no rush/shuffle/fever in first N seconds
  MISS_GRACE_PERIOD_MS: 600,        // delay before next shape after miss
  MISS_SHOW_CORRECT_MS: 400,        // show correct answer after miss
  STREAK_PROTECTION_THRESHOLD: Infinity,  // v23: disabled — misses must hurt
  STREAK_PROTECTION_PENALTY: 1,
  RUSH_NO_MULTIPLIER_LOSS: true,    // rush misses don't reduce multiplier
  RUSH_PRE_WARNING_SEC: 2,          // show rush warning N seconds before

  /* ─── Combo Decay (v23) ─── */
  COMBO_DECAY_THRESHOLD: 2.0,       // multiplier on spawn interval before decay starts
  COMBO_DECAY_INTERVAL: 500,        // ms between each combo point loss
  COMBO_DECAY_AMOUNT: 1,            // combo points lost per decay tick

  /* ─── Wissen Mode Overhaul (v22) ─── */
  WISSEN_GLOBAL_TIMER: true,        // use global timer instead of per-question
  WISSEN_GAME_DURATION: 60,         // 60 seconds total
  WISSEN_BASE_POINTS: 100,
  WISSEN_SPEED_BONUS: [
    { maxMs: 2000, bonus: 150 },
    { maxMs: 4000, bonus: 75 },
    { maxMs: 6000, bonus: 25 },
    { maxMs: Infinity, bonus: 0 }
  ],
  WISSEN_TIME_BONUS_MS: 5000,       // +5s on fast correct answer
  WISSEN_TIME_BONUS_THRESHOLD: 3000,// answer under 3s = time bonus
  WISSEN_WRONG_PENALTY_SEC: 3,      // -3s on wrong answer
  WISSEN_LEVEL_THRESHOLDS: [300, 700, 1200, 1800, 2500],
  WISSEN_MIN_DISPLAY_MS: 1500,      // minimum time question is visible
  /* ─── Mode unlock levels ─── */
  UNLOCK_KLASSIK: 0,       // Always unlocked
  UNLOCK_EXPERT: 5,        // Level 6 = 3,000 XP (~1 hr)
  UNLOCK_ULTRA:  7,        // Level 8 = 15,000 XP (~5 hrs)
  UNLOCK_COMPETITION: 5,   // Same as expert

  /* ─── Canonical mode order for carousel ─── */
  MODE_ORDER: [
    'klassik', 'beginner', 'expert', 'ultra',
    'mathe', 'algebra',
    'worte', 'hauptstaedte', 'wissen',
    'memo', 'sequenz',
    'stroop', 'fokus', 'chaos'
  ],

  /* ─── Wissen (IQ Quiz) unlock ─── */
  UNLOCK_WISSEN: 2,

  /* ─── Continue (IAP lives) ─── */
  CONTINUE_EXTRA_TIME: 15,

  /* ─── Animation (ms) ─── */
  POP_DURATION: 140,
  ABSORB_DURATION: 200,
  SHAKE_HIT_DURATION: 80,
  SHAKE_HIT_MAGNITUDE: 2,
  SHAKE_MISS_DURATION: 120,
  SHAKE_MISS_MAGNITUDE: 3,
  PERFECT_FLASH_DURATION: 300,
  CONFETTI_COUNT: 20,

  /* ─── Toast display (ms) ─── */
  TOAST_DURATION: 8500,

  /* ─── Results stagger (ms) ─── */
  RESULTS_COUNTUP_MS: 700,
  RESULTS_STATS_DELAY: 140,
  RESULTS_BUTTONS_DELAY: 120,
  GAME_OVER_TRANSITION_MS: 550,

  /* ─── Boot screen (ms) ─── */
  BOOT_MIN_DISPLAY: 2800,

  /* ─── Avatars ─── */
  AVATAR_ICONS: [
    'circle','star','hexagon','diamond','heart','bolt',
    'crown','shield','flame','leaf','moon','sun',
    'drop','gem','paw','rocket'
  ],
  AVATAR_COLORS_INDICES: [0, 1, 2, 3, 4, 5, 6, 7],

  /* ═══════════════════════════════════════
     UNLOCKABLE THEMES (by level index)
     ═══════════════════════════════════════ */
  THEMES: [
    { id: 'default',  unlockLevel: 0 },
    { id: 'neon',     unlockLevel: 3 },
    { id: 'ocean',    unlockLevel: 5 },
    { id: 'sunset',   unlockLevel: 8 },
    { id: 'forest',   unlockLevel: 11 },
    { id: 'cosmic',   unlockLevel: 14 },
    { id: 'retro',    unlockLevel: 17 },
    { id: 'crystal',  unlockLevel: 19 },
  ],

  /* ═══════════════════════════════════════
     UNLOCKABLE TRAIL EFFECTS (by level index)
     ═══════════════════════════════════════ */
  TRAILS: [
    { id: 'default',  unlockLevel: 0, color: null,      glow: 14, width: 3 },
    { id: 'fire',     unlockLevel: 4, color: '#FF6B35', glow: 18, width: 4 },
    { id: 'ice',      unlockLevel: 7, color: '#00D2FF', glow: 16, width: 3 },
    { id: 'rainbow',  unlockLevel: 10, color: null,      glow: 16, width: 4 },
    { id: 'electric', unlockLevel: 14, color: '#7B68EE', glow: 22, width: 3 },
    { id: 'stardust', unlockLevel: 18, color: '#FFD700', glow: 20, width: 4 },
  ],

  /* ═══════════════════════════════════════
     NEW GAME MODES (v14)
     ═══════════════════════════════════════ */

  /* Math mode — difficulty phases scale with correct answers */
  MATH_PHASES: [
    { threshold: 0,   ops: ['+', '−'],            min: 1, max: 10 },
    { threshold: 5,   ops: ['+', '−'],            min: 1, max: 20 },
    { threshold: 12,  ops: ['+', '−', '×'],       min: 2, max: 12 },
    { threshold: 25,  ops: ['+', '−', '×', '÷'],  min: 2, max: 15 },
    { threshold: 45,  ops: ['+', '−', '×', '÷'],  min: 4, max: 25, multMax: 12, divMax: 12 },
    { threshold: 70,  ops: ['+', '−', '×', '÷'],  min: 5, max: 40, multMax: 15, divMax: 15 },
    { threshold: 100, ops: ['+', '−', '×', '÷'],  min: 10, max: 50, multMax: 18, divMax: 18 },
  ],

  /* Word mode — category banks per language */
  WORD_BANKS: {
    de: {
      tier:   ['Hund','Katze','Pferd','Maus','Vogel','Fisch','Löwe','Bär','Wolf','Hase','Fuchs','Affe','Tiger','Frosch','Igel','Reh','Hirsch','Adler','Eule','Schlange','Spinne','Hai','Wal','Krokodil','Elefant','Giraffe','Zebra','Nashorn','Kamel','Känguru','Papagei','Pinguin','Delfin','Otter','Biber','Dachs','Hamster','Schildkröte','Koralle','Flamingo'],
      essen:  ['Apfel','Brot','Käse','Pizza','Eis','Kuchen','Reis','Nudel','Salat','Suppe','Banane','Tomate','Birne','Milch','Butter','Gurke','Kartoffel','Traube','Kirsche','Erdbeere','Melone','Zitrone','Kiwi','Ananas','Paprika','Zwiebel','Knoblauch','Pilz','Mango','Brötchen','Joghurt','Schokolade','Honig','Waffel','Brezel','Müsli','Pflaume','Pfirsich','Mandel','Nuss'],
      sport:  ['Fußball','Tennis','Schwimmen','Laufen','Boxen','Yoga','Reiten','Surfen','Golf','Tanzen','Turnen','Radeln','Klettern','Ski','Rudern','Handball','Volleyball','Basketball','Eishockey','Badminton','Rugby','Judo','Karate','Tischtennis','Dart','Fechten','Segeln','Tauchen','Wandern','Bowling','Ringen','Sprint','Triathlon','Kraftsport','Parkour'],
      farbe:  ['Rot','Blau','Grün','Gelb','Weiß','Schwarz','Lila','Rosa','Braun','Grau','Türkis','Beige','Violett','Cyan','Magenta','Indigo','Koralle','Himmelblau','Mintgrün','Champagner','Bordeaux','Olive','Karmin','Azur','Lavendel','Lachs','Flieder','Apricot','Mauve','Khaki'],
    },
    en: {
      animal: ['Dog','Cat','Horse','Mouse','Bird','Fish','Lion','Bear','Wolf','Rabbit','Fox','Monkey','Tiger','Frog','Deer','Owl','Eagle','Shark','Snake','Spider','Whale','Crocodile','Elephant','Giraffe','Zebra','Rhino','Camel','Kangaroo','Penguin','Panda','Parrot','Dolphin','Otter','Beaver','Badger','Hamster','Turtle','Coral','Flamingo','Jellyfish'],
      food:   ['Apple','Bread','Cheese','Pizza','Ice','Cake','Rice','Pasta','Salad','Soup','Banana','Tomato','Pear','Milk','Butter','Carrot','Potato','Grape','Cherry','Strawberry','Melon','Lemon','Kiwi','Pineapple','Pepper','Onion','Garlic','Mushroom','Mango','Pretzel','Yogurt','Chocolate','Honey','Waffle','Cereal','Plum','Peach','Almond','Walnut','Coconut'],
      sport:  ['Soccer','Tennis','Swimming','Running','Boxing','Yoga','Riding','Surfing','Golf','Dancing','Climbing','Cycling','Skiing','Rowing','Hiking','Basketball','Baseball','Football','Hockey','Volleyball','Rugby','Cricket','Badminton','Gymnastics','Fencing','Sailing','Diving','Bowling','Wrestling','Sprint','Triathlon','Archery','Skating','Parkour'],
      color:  ['Red','Blue','Green','Yellow','White','Black','Purple','Pink','Brown','Gray','Teal','Beige','Violet','Cyan','Magenta','Indigo','Coral','Sky Blue','Mint','Champagne','Burgundy','Olive','Crimson','Azure','Lavender','Salmon','Lilac','Apricot','Mauve','Khaki'],
    },
  },
  WORD_CATEGORIES: {
    de: ['tier', 'essen', 'sport', 'farbe'],
    en: ['animal', 'food', 'sport', 'color'],
  },
  WORD_CAT_LABELS: {
    de: { tier: 'Tier', essen: 'Essen', sport: 'Sport', farbe: 'Farbe' },
    en: { animal: 'Animal', food: 'Food', sport: 'Sport', color: 'Color' },
  },
  WORD_CAT_EMOJIS: {
    tier: '🐾', essen: '🍎', sport: '⚽', farbe: '🎨',
    animal: '🐾', food: '🍎', color: '🎨',
  },
  
  WORD_EMOJI_BANKS: {
    tier:   ['🐾','🐶','🐱','🦁','🦊','🐸','🦆','🐝','🦋','🐴'],
    essen:  ['🍎','🍔','🍕','🌮','🍉','🥐','🍩','🍪','🍓','🍒'],
    sport:  ['⚽','🏀','🎾','🏓','🏂','🎿','🥊','🏈','⛳','🏹'],
    farbe:  ['🔴','🟦','🟩','🟨','🟣','🟧','⚪','🟤','⚫','🔲'],
    animal: ['🐾','🐶','🐱','🦁','🦊','🐸','🦆','🐝','🦋','🐴'],
    food:   ['🍎','🍔','🍕','🌮','🍉','🥐','🍩','🍪','🍓','🍒'],
    color:  ['🔴','🟦','🟩','🟨','🟣','🟧','⚪','🟤','⚫','🔲'],
  },

  /* Memo mode — hidden corners (Verdeckte Ecken) */
  MEMO_PREVIEW_MS: 3000,          // Corner preview duration at game start (ms)
  MEMO_PREVIEW_MIN_MS: 1800,      // Minimum preview after shrinking
  MEMO_PREVIEW_SHRINK: 120,       // ms reduction per reveal cycle
  MEMO_REVEAL_EVERY: 8,           // Re-reveal corners every N correct answers
  MEMO_SHUFFLE_AFTER: 3,          // Shuffle corner positions every N reveals

  /* Memo-mode spawn overrides — must exceed flash + response time */
  SPAWN_MEMO_START: 3200,
  SPAWN_MEMO_MIN: 1100,
  SPAWN_MEMO_MAX: 4500,
  SPAWN_MEMO_STEP: 40,

  /* Brain-mode time-bonus window (reading + solving needs more time) */
  TIME_BONUS_WINDOW_BRAIN: 2000,

  /* Brain-mode adaptive difficulty reaction threshold */
  DIFFICULTY_GOOD_REACTION_BRAIN: 2000,

  /* Brain-mode rush delay (need time to read & solve) */
  RUSH_DELAY_BRAIN: 1800,

  /* Generic 4-direction set for new modes */
  DIRECTIONS_4: ['ul','ur','dl','dr'],
  SHAPES_MEMO: ['circle','square','triangle','star'],

  /* Sequenz (Simon Says) mode */
  SEQUENZ_START_LENGTH: 4,
  SEQUENZ_FLASH_MS: 500,
  SEQUENZ_PAUSE_MS: 300,
  SEQUENZ_MAX_LENGTH: 20,
  SEQUENZ_SPEED_UP_EVERY: 3,
  SEQUENZ_FLASH_MIN: 320,
  SEQUENZ_READY_DELAY: 400,
  SEQUENZ_INPUT_TIMEOUT_MS: 3000,  /* Max idle time per tap during "go" phase */
  SEQUENZ_INPUT_TIMEOUT_MIN: 2600, /* Minimum input timeout after difficulty plateau */
  SEQUENZ_INPUT_TIMEOUT_STEP: 60,  /* ms decrease per round after plateau */
  SEQUENZ_SPEED_STEP: 35,          /* ms decrease per speed-up event */

  /* Word mode */
  WORD_SHUFFLE_INTERVAL: 12,  /* Re-shuffle category→corner mapping every N spawns */

  /* New mode unlock levels (0 = always available) */
  UNLOCK_MATHE: 0,
  UNLOCK_WORTE: 0,
  UNLOCK_MEMO:  2,
  UNLOCK_SEQUENZ: 3,
  UNLOCK_STROOP: 0,
  UNLOCK_FOKUS: 2,
  UNLOCK_CHAOS: 4,

  /* ═══ STROOP MODE (Stroop Effect) ═══ */
  STROOP_COLORS_4: [
    { name_de:'ROT',  name_en:'RED',  hex:'#EF4444' },
    { name_de:'BLAU', name_en:'BLUE', hex:'#3B82F6' },
    { name_de:'GRÜN', name_en:'GREEN',hex:'#10B981' },
    { name_de:'GELB', name_en:'YELLOW',hex:'#FBBF24' },
  ],
  STROOP_COLORS_8: [
    { name_de:'ROT',    name_en:'RED',    hex:'#EF4444' },
    { name_de:'BLAU',   name_en:'BLUE',   hex:'#3B82F6' },
    { name_de:'GRÜN',   name_en:'GREEN',  hex:'#10B981' },
    { name_de:'GELB',   name_en:'YELLOW', hex:'#FBBF24' },
    { name_de:'LILA',   name_en:'PURPLE', hex:'#8B5CF6' },
    { name_de:'ORANGE', name_en:'ORANGE', hex:'#F97316' },
    { name_de:'ROSA',   name_en:'PINK',   hex:'#EC4899' },
    { name_de:'TÜRKIS', name_en:'CYAN',   hex:'#06B6D4' },
  ],
  /* ═══ FOKUS MODE (Flanker Task) ═══ */
  FOKUS_ARROWS: ['←','→','↑','↓'],
  FOKUS_ARROWS_8: ['←','→','↑','↓','↗','↘','↙','↖'],
  FOKUS_FLANKER_COUNT: 4,  /* 2 on each side */
  FOKUS_CONGRUENT_RATE: 0.3,  /* 30% trials = all arrows same direction */

  /* ═══ CHAOS MODE (Rule Switching / WCST-inspired) ═══ */
  CHAOS_DIMENSIONS: ['color','shape','size'],
  CHAOS_EXTRA_DIMENSIONS: ['math','stroop'],  /* unlocked progressively in chaos */
  CHAOS_EXTRA_THRESHOLD: 15,  /* correct answers before extra dimensions activate */
  CHAOS_SHAPES: ['circle','square','triangle','star'],
  CHAOS_COLORS: ['#EF4444','#3B82F6','#10B981','#FBBF24'],
  CHAOS_SIZES: ['tiny','small','medium','large'],
  CHAOS_RULE_SWITCH_MIN: 4,  /* Min correct answers before rule can switch */
  CHAOS_RULE_SWITCH_MAX: 8,  /* Max correct answers before rule must switch */

  /* ─── Lives earning ─── */
  LIVES_DAILY_LOGIN: 1,
  LIVES_LEVEL_UP: 1,
  LIVES_REWARDED_AD: 1,
  LIVES_MAX: 10,

  /* ─── Score milestones (trigger audio+visual celebration) ─── */
  SCORE_MILESTONES: [1000, 2500, 5000, 10000, 25000],

  /* ─── Weekend XP bonus (v23: removed — consistent rewards for habit formation) ─── */
  WEEKEND_XP_MULTIPLIER: 1.0,

  /* ─── Daily challenge rewards ─── */
  /* DEPRECATED: DAILY_REWARD_LIVES, DAILY_REWARD_XP, DAILY_REWARD_FIRE
     replaced by escalating tier table in save.js claimDailyReward() */
  DAILY_STREAK_XP_BONUS: 25,   /* +25 XP per streak day, capped at +250 */

  /* ═══════════════════════════════════════
     HAUPTSTÄDTE MODE (Capitals of the World)
     ═══════════════════════════════════════ */
  UNLOCK_HAUPTSTAEDTE: 3,

  /* Difficulty tiers: progressive unlock by correct-answer count */
  CAPITALS_TIERS: [
    { threshold: 0,   label: 'easy' },
    { threshold: 10,  label: 'medium' },
    { threshold: 25,  label: 'hard' },
    { threshold: 45,  label: 'expert' },
    { threshold: 70,  label: 'obscure' },
    { threshold: 100, label: 'all' },
  ],

  /* Country→Capital data bank with region + tier tags.
     region is used for distractor selection (same-region distractors = harder).
     tier: 0=everyone knows, 1=major, 2=medium, 3=harder, 4=obscure */
  CAPITALS_BANK: [
    /* ── Tier 0: Everyone knows ── */
    { country_de:'Deutschland', country_en:'Germany', capital:'Berlin', region:'europe', tier:0 },
    { country_de:'Frankreich', country_en:'France', capital:'Paris', region:'europe', tier:0 },
    { country_de:'Italien', country_en:'Italy', capital:'Rom', capital_en:'Rome', region:'europe', tier:0 },
    { country_de:'Spanien', country_en:'Spain', capital:'Madrid', region:'europe', tier:0 },
    { country_de:'Vereinigtes Königreich', country_en:'United Kingdom', capital:'London', region:'europe', tier:0 },
    { country_de:'USA', country_en:'USA', capital:'Washington D.C.', region:'americas', tier:0 },
    { country_de:'Japan', country_en:'Japan', capital:'Tokio', capital_en:'Tokyo', region:'asia', tier:0 },
    { country_de:'China', country_en:'China', capital:'Peking', capital_en:'Beijing', region:'asia', tier:0 },
    { country_de:'Russland', country_en:'Russia', capital:'Moskau', capital_en:'Moscow', region:'europe', tier:0 },
    { country_de:'Brasilien', country_en:'Brazil', capital:'Brasília', region:'americas', tier:0 },
    { country_de:'Indien', country_en:'India', capital:'Neu-Delhi', capital_en:'New Delhi', region:'asia', tier:0 },
    { country_de:'Australien', country_en:'Australia', capital:'Canberra', region:'oceania', tier:0 },
    { country_de:'Kanada', country_en:'Canada', capital:'Ottawa', region:'americas', tier:0 },
    { country_de:'Mexiko', country_en:'Mexico', capital:'Mexiko-Stadt', capital_en:'Mexico City', region:'americas', tier:0 },
    { country_de:'Ägypten', country_en:'Egypt', capital:'Kairo', capital_en:'Cairo', region:'africa', tier:0 },
    { country_de:'Türkei', country_en:'Turkey', capital:'Ankara', region:'asia', tier:0 },
    { country_de:'Griechenland', country_en:'Greece', capital:'Athen', capital_en:'Athens', region:'europe', tier:0 },
    { country_de:'Österreich', country_en:'Austria', capital:'Wien', capital_en:'Vienna', region:'europe', tier:0 },
    { country_de:'Schweiz', country_en:'Switzerland', capital:'Bern', region:'europe', tier:0 },
    { country_de:'Niederlande', country_en:'Netherlands', capital:'Amsterdam', region:'europe', tier:0 },
    { country_de:'Portugal', country_en:'Portugal', capital:'Lissabon', capital_en:'Lisbon', region:'europe', tier:0 },
    { country_de:'Südkorea', country_en:'South Korea', capital:'Seoul', region:'asia', tier:0 },
    { country_de:'Argentinien', country_en:'Argentina', capital:'Buenos Aires', region:'americas', tier:0 },
    { country_de:'Schweden', country_en:'Sweden', capital:'Stockholm', region:'europe', tier:0 },
    { country_de:'Norwegen', country_en:'Norway', capital:'Oslo', region:'europe', tier:0 },
    { country_de:'Dänemark', country_en:'Denmark', capital:'Kopenhagen', capital_en:'Copenhagen', region:'europe', tier:0 },
    { country_de:'Finnland', country_en:'Finland', capital:'Helsinki', region:'europe', tier:0 },
    { country_de:'Polen', country_en:'Poland', capital:'Warschau', capital_en:'Warsaw', region:'europe', tier:0 },
    { country_de:'Thailand', country_en:'Thailand', capital:'Bangkok', region:'asia', tier:0 },
    { country_de:'Südafrika', country_en:'South Africa', capital:'Pretoria', region:'africa', tier:0 },
    /* ── Tier 1: Major countries ── */
    { country_de:'Belgien', country_en:'Belgium', capital:'Brüssel', capital_en:'Brussels', region:'europe', tier:1 },
    { country_de:'Tschechien', country_en:'Czech Republic', capital:'Prag', capital_en:'Prague', region:'europe', tier:1 },
    { country_de:'Ungarn', country_en:'Hungary', capital:'Budapest', region:'europe', tier:1 },
    { country_de:'Rumänien', country_en:'Romania', capital:'Bukarest', capital_en:'Bucharest', region:'europe', tier:1 },
    { country_de:'Irland', country_en:'Ireland', capital:'Dublin', region:'europe', tier:1 },
    { country_de:'Ukraine', country_en:'Ukraine', capital:'Kiew', capital_en:'Kyiv', region:'europe', tier:1 },
    { country_de:'Kroatien', country_en:'Croatia', capital:'Zagreb', region:'europe', tier:1 },
    { country_de:'Serbien', country_en:'Serbia', capital:'Belgrad', capital_en:'Belgrade', region:'europe', tier:1 },
    { country_de:'Bulgarien', country_en:'Bulgaria', capital:'Sofia', region:'europe', tier:1 },
    { country_de:'Indonesien', country_en:'Indonesia', capital:'Jakarta', region:'asia', tier:1 },
    { country_de:'Vietnam', country_en:'Vietnam', capital:'Hanoi', region:'asia', tier:1 },
    { country_de:'Philippinen', country_en:'Philippines', capital:'Manila', region:'asia', tier:1 },
    { country_de:'Malaysia', country_en:'Malaysia', capital:'Kuala Lumpur', region:'asia', tier:1 },
    { country_de:'Pakistan', country_en:'Pakistan', capital:'Islamabad', region:'asia', tier:1 },
    { country_de:'Iran', country_en:'Iran', capital:'Teheran', capital_en:'Tehran', region:'asia', tier:1 },
    { country_de:'Irak', country_en:'Iraq', capital:'Bagdad', capital_en:'Baghdad', region:'asia', tier:1 },
    { country_de:'Saudi-Arabien', country_en:'Saudi Arabia', capital:'Riad', capital_en:'Riyadh', region:'asia', tier:1 },
    { country_de:'Israel', country_en:'Israel', capital:'Jerusalem', region:'asia', tier:1 },
    { country_de:'Kolumbien', country_en:'Colombia', capital:'Bogotá', region:'americas', tier:1 },
    { country_de:'Peru', country_en:'Peru', capital:'Lima', region:'americas', tier:1 },
    { country_de:'Chile', country_en:'Chile', capital:'Santiago', region:'americas', tier:1 },
    { country_de:'Venezuela', country_en:'Venezuela', capital:'Caracas', region:'americas', tier:1 },
    { country_de:'Kuba', country_en:'Cuba', capital:'Havanna', capital_en:'Havana', region:'americas', tier:1 },
    { country_de:'Nigeria', country_en:'Nigeria', capital:'Abuja', region:'africa', tier:1 },
    { country_de:'Kenia', country_en:'Kenya', capital:'Nairobi', region:'africa', tier:1 },
    { country_de:'Marokko', country_en:'Morocco', capital:'Rabat', region:'africa', tier:1 },
    { country_de:'Äthiopien', country_en:'Ethiopia', capital:'Addis Abeba', capital_en:'Addis Ababa', region:'africa', tier:1 },
    { country_de:'Neuseeland', country_en:'New Zealand', capital:'Wellington', region:'oceania', tier:1 },
    { country_de:'Singapur', country_en:'Singapore', capital:'Singapur', capital_en:'Singapore', region:'asia', tier:1 },
    { country_de:'Nordkorea', country_en:'North Korea', capital:'Pjöngjang', capital_en:'Pyongyang', region:'asia', tier:1 },
    /* ── Tier 2: Medium difficulty ── */
    { country_de:'Slowakei', country_en:'Slovakia', capital:'Bratislava', region:'europe', tier:2 },
    { country_de:'Slowenien', country_en:'Slovenia', capital:'Ljubljana', region:'europe', tier:2 },
    { country_de:'Litauen', country_en:'Lithuania', capital:'Vilnius', region:'europe', tier:2 },
    { country_de:'Lettland', country_en:'Latvia', capital:'Riga', region:'europe', tier:2 },
    { country_de:'Estland', country_en:'Estonia', capital:'Tallinn', region:'europe', tier:2 },
    { country_de:'Island', country_en:'Iceland', capital:'Reykjavík', region:'europe', tier:2 },
    { country_de:'Albanien', country_en:'Albania', capital:'Tirana', region:'europe', tier:2 },
    { country_de:'Nordmazedonien', country_en:'North Macedonia', capital:'Skopje', region:'europe', tier:2 },
    { country_de:'Montenegro', country_en:'Montenegro', capital:'Podgorica', region:'europe', tier:2 },
    { country_de:'Bosnien und Herzegowina', country_en:'Bosnia & Herzegovina', capital:'Sarajevo', region:'europe', tier:2 },
    { country_de:'Luxemburg', country_en:'Luxembourg', capital:'Luxemburg', capital_en:'Luxembourg', region:'europe', tier:2 },
    { country_de:'Moldawien', country_en:'Moldova', capital:'Chișinău', region:'europe', tier:2 },
    { country_de:'Georgien', country_en:'Georgia', capital:'Tiflis', capital_en:'Tbilisi', region:'asia', tier:2 },
    { country_de:'Armenien', country_en:'Armenia', capital:'Jerewan', capital_en:'Yerevan', region:'asia', tier:2 },
    { country_de:'Aserbaidschan', country_en:'Azerbaijan', capital:'Baku', region:'asia', tier:2 },
    { country_de:'Kasachstan', country_en:'Kazakhstan', capital:'Astana', region:'asia', tier:2 },
    { country_de:'Bangladesch', country_en:'Bangladesh', capital:'Dhaka', region:'asia', tier:2 },
    { country_de:'Myanmar', country_en:'Myanmar', capital:'Naypyidaw', region:'asia', tier:2 },
    { country_de:'Sri Lanka', country_en:'Sri Lanka', capital:'Colombo', region:'asia', tier:2 },
    { country_de:'Nepal', country_en:'Nepal', capital:'Kathmandu', region:'asia', tier:2 },
    { country_de:'Kambodscha', country_en:'Cambodia', capital:'Phnom Penh', region:'asia', tier:2 },
    { country_de:'Ecuador', country_en:'Ecuador', capital:'Quito', region:'americas', tier:2 },
    { country_de:'Bolivien', country_en:'Bolivia', capital:'Sucre', region:'americas', tier:2 },
    { country_de:'Paraguay', country_en:'Paraguay', capital:'Asunción', region:'americas', tier:2 },
    { country_de:'Uruguay', country_en:'Uruguay', capital:'Montevideo', region:'americas', tier:2 },
    { country_de:'Costa Rica', country_en:'Costa Rica', capital:'San José', region:'americas', tier:2 },
    { country_de:'Panama', country_en:'Panama', capital:'Panama-Stadt', capital_en:'Panama City', region:'americas', tier:2 },
    { country_de:'Jamaika', country_en:'Jamaica', capital:'Kingston', region:'americas', tier:2 },
    { country_de:'Ghana', country_en:'Ghana', capital:'Accra', region:'africa', tier:2 },
    { country_de:'Tansania', country_en:'Tanzania', capital:'Dodoma', region:'africa', tier:2 },
    { country_de:'Tunesien', country_en:'Tunisia', capital:'Tunis', region:'africa', tier:2 },
    { country_de:'Algerien', country_en:'Algeria', capital:'Algier', capital_en:'Algiers', region:'africa', tier:2 },
    { country_de:'Libyen', country_en:'Libya', capital:'Tripolis', capital_en:'Tripoli', region:'africa', tier:2 },
    { country_de:'Senegal', country_en:'Senegal', capital:'Dakar', region:'africa', tier:2 },
    { country_de:'Kamerun', country_en:'Cameroon', capital:'Yaoundé', region:'africa', tier:2 },
    { country_de:'Uganda', country_en:'Uganda', capital:'Kampala', region:'africa', tier:2 },
    { country_de:'Mosambik', country_en:'Mozambique', capital:'Maputo', region:'africa', tier:2 },
    { country_de:'Simbabwe', country_en:'Zimbabwe', capital:'Harare', region:'africa', tier:2 },
    { country_de:'Fidschi', country_en:'Fiji', capital:'Suva', region:'oceania', tier:2 },
    /* ── Tier 3: Harder ── */
    { country_de:'Mongolei', country_en:'Mongolia', capital:'Ulaanbaatar', region:'asia', tier:3 },
    { country_de:'Usbekistan', country_en:'Uzbekistan', capital:'Taschkent', capital_en:'Tashkent', region:'asia', tier:3 },
    { country_de:'Turkmenistan', country_en:'Turkmenistan', capital:'Aschgabat', capital_en:'Ashgabat', region:'asia', tier:3 },
    { country_de:'Tadschikistan', country_en:'Tajikistan', capital:'Duschanbe', capital_en:'Dushanbe', region:'asia', tier:3 },
    { country_de:'Kirgisistan', country_en:'Kyrgyzstan', capital:'Bischkek', capital_en:'Bishkek', region:'asia', tier:3 },
    { country_de:'Laos', country_en:'Laos', capital:'Vientiane', region:'asia', tier:3 },
    { country_de:'Brunei', country_en:'Brunei', capital:'Bandar Seri Begawan', region:'asia', tier:3 },
    { country_de:'Bhutan', country_en:'Bhutan', capital:'Thimphu', region:'asia', tier:3 },
    { country_de:'Malediven', country_en:'Maldives', capital:'Malé', region:'asia', tier:3 },
    { country_de:'Afghanistan', country_en:'Afghanistan', capital:'Kabul', region:'asia', tier:3 },
    { country_de:'Jemen', country_en:'Yemen', capital:'Sanaa', region:'asia', tier:3 },
    { country_de:'Oman', country_en:'Oman', capital:'Maskat', capital_en:'Muscat', region:'asia', tier:3 },
    { country_de:'Kuwait', country_en:'Kuwait', capital:'Kuwait-Stadt', capital_en:'Kuwait City', region:'asia', tier:3 },
    { country_de:'Bahrain', country_en:'Bahrain', capital:'Manama', region:'asia', tier:3 },
    { country_de:'Katar', country_en:'Qatar', capital:'Doha', region:'asia', tier:3 },
    { country_de:'Jordanien', country_en:'Jordan', capital:'Amman', region:'asia', tier:3 },
    { country_de:'Libanon', country_en:'Lebanon', capital:'Beirut', region:'asia', tier:3 },
    { country_de:'Syrien', country_en:'Syria', capital:'Damaskus', capital_en:'Damascus', region:'asia', tier:3 },
    { country_de:'Honduras', country_en:'Honduras', capital:'Tegucigalpa', region:'americas', tier:3 },
    { country_de:'Guatemala', country_en:'Guatemala', capital:'Guatemala-Stadt', capital_en:'Guatemala City', region:'americas', tier:3 },
    { country_de:'El Salvador', country_en:'El Salvador', capital:'San Salvador', region:'americas', tier:3 },
    { country_de:'Nicaragua', country_en:'Nicaragua', capital:'Managua', region:'americas', tier:3 },
    { country_de:'Haiti', country_en:'Haiti', capital:'Port-au-Prince', region:'americas', tier:3 },
    { country_de:'Dominikanische Republik', country_en:'Dominican Republic', capital:'Santo Domingo', region:'americas', tier:3 },
    { country_de:'Trinidad und Tobago', country_en:'Trinidad & Tobago', capital:'Port of Spain', region:'americas', tier:3 },
    { country_de:'Guyana', country_en:'Guyana', capital:'Georgetown', region:'americas', tier:3 },
    { country_de:'Suriname', country_en:'Suriname', capital:'Paramaribo', region:'americas', tier:3 },
    { country_de:'Demokratische Republik Kongo', country_en:'DR Congo', capital:'Kinshasa', region:'africa', tier:3 },
    { country_de:'Elfenbeinküste', country_en:'Ivory Coast', capital:'Yamoussoukro', region:'africa', tier:3 },
    { country_de:'Madagaskar', country_en:'Madagascar', capital:'Antananarivo', region:'africa', tier:3 },
    { country_de:'Angola', country_en:'Angola', capital:'Luanda', region:'africa', tier:3 },
    { country_de:'Sudan', country_en:'Sudan', capital:'Khartum', capital_en:'Khartoum', region:'africa', tier:3 },
    { country_de:'Mali', country_en:'Mali', capital:'Bamako', region:'africa', tier:3 },
    { country_de:'Niger', country_en:'Niger', capital:'Niamey', region:'africa', tier:3 },
    { country_de:'Burkina Faso', country_en:'Burkina Faso', capital:'Ouagadougou', region:'africa', tier:3 },
    { country_de:'Tschad', country_en:'Chad', capital:'N\'Djamena', region:'africa', tier:3 },
    { country_de:'Ruanda', country_en:'Rwanda', capital:'Kigali', region:'africa', tier:3 },
    { country_de:'Sambia', country_en:'Zambia', capital:'Lusaka', region:'africa', tier:3 },
    { country_de:'Namibia', country_en:'Namibia', capital:'Windhoek', region:'africa', tier:3 },
    { country_de:'Botswana', country_en:'Botswana', capital:'Gaborone', region:'africa', tier:3 },
    /* ── Tier 4: Obscure ── */
    { country_de:'Osttimor', country_en:'East Timor', capital:'Dili', region:'asia', tier:4 },
    { country_de:'Zypern', country_en:'Cyprus', capital:'Nikosia', capital_en:'Nicosia', region:'europe', tier:4 },
    { country_de:'Malta', country_en:'Malta', capital:'Valletta', region:'europe', tier:4 },
    { country_de:'Andorra', country_en:'Andorra', capital:'Andorra la Vella', region:'europe', tier:4 },
    { country_de:'Liechtenstein', country_en:'Liechtenstein', capital:'Vaduz', region:'europe', tier:4 },
    { country_de:'Monaco', country_en:'Monaco', capital:'Monaco', region:'europe', tier:4 },
    { country_de:'San Marino', country_en:'San Marino', capital:'San Marino', region:'europe', tier:4 },
    { country_de:'Belize', country_en:'Belize', capital:'Belmopan', region:'americas', tier:4 },
    { country_de:'Bahamas', country_en:'Bahamas', capital:'Nassau', region:'americas', tier:4 },
    { country_de:'Barbados', country_en:'Barbados', capital:'Bridgetown', region:'americas', tier:4 },
    { country_de:'Papua-Neuguinea', country_en:'Papua New Guinea', capital:'Port Moresby', region:'oceania', tier:4 },
    { country_de:'Samoa', country_en:'Samoa', capital:'Apia', region:'oceania', tier:4 },
    { country_de:'Tonga', country_en:'Tonga', capital:'Nuku\'alofa', region:'oceania', tier:4 },
    { country_de:'Vanuatu', country_en:'Vanuatu', capital:'Port Vila', region:'oceania', tier:4 },
    { country_de:'Salomonen', country_en:'Solomon Islands', capital:'Honiara', region:'oceania', tier:4 },
    { country_de:'Kiribati', country_en:'Kiribati', capital:'Tarawa', region:'oceania', tier:4 },
    { country_de:'Marshallinseln', country_en:'Marshall Islands', capital:'Majuro', region:'oceania', tier:4 },
    { country_de:'Mikronesien', country_en:'Micronesia', capital:'Palikir', region:'oceania', tier:4 },
    { country_de:'Palau', country_en:'Palau', capital:'Ngerulmud', region:'oceania', tier:4 },
    { country_de:'Nauru', country_en:'Nauru', capital:'Yaren', region:'oceania', tier:4 },
    { country_de:'Tuvalu', country_en:'Tuvalu', capital:'Funafuti', region:'oceania', tier:4 },
    { country_de:'Lesotho', country_en:'Lesotho', capital:'Maseru', region:'africa', tier:4 },
    { country_de:'Eswatini', country_en:'Eswatini', capital:'Mbabane', region:'africa', tier:4 },
    { country_de:'Eritrea', country_en:'Eritrea', capital:'Asmara', region:'africa', tier:4 },
    { country_de:'Dschibuti', country_en:'Djibouti', capital:'Dschibuti', capital_en:'Djibouti', region:'africa', tier:4 },
    { country_de:'Komoren', country_en:'Comoros', capital:'Moroni', region:'africa', tier:4 },
    { country_de:'Kap Verde', country_en:'Cape Verde', capital:'Praia', region:'africa', tier:4 },
    { country_de:'São Tomé und Príncipe', country_en:'São Tomé & Príncipe', capital:'São Tomé', region:'africa', tier:4 },
    { country_de:'Gabun', country_en:'Gabon', capital:'Libreville', region:'africa', tier:4 },
    { country_de:'Äquatorialguinea', country_en:'Equatorial Guinea', capital:'Malabo', region:'africa', tier:4 },
    { country_de:'Guinea', country_en:'Guinea', capital:'Conakry', region:'africa', tier:4 },
    { country_de:'Guinea-Bissau', country_en:'Guinea-Bissau', capital:'Bissau', region:'africa', tier:4 },
    { country_de:'Sierra Leone', country_en:'Sierra Leone', capital:'Freetown', region:'africa', tier:4 },
    { country_de:'Liberia', country_en:'Liberia', capital:'Monrovia', region:'africa', tier:4 },
    { country_de:'Togo', country_en:'Togo', capital:'Lomé', region:'africa', tier:4 },
    { country_de:'Benin', country_en:'Benin', capital:'Porto-Novo', region:'africa', tier:4 },
    { country_de:'Mauritanien', country_en:'Mauritania', capital:'Nouakchott', region:'africa', tier:4 },
    { country_de:'Somalia', country_en:'Somalia', capital:'Mogadischu', capital_en:'Mogadishu', region:'africa', tier:4 },
    { country_de:'Burundi', country_en:'Burundi', capital:'Gitega', region:'africa', tier:4 },
    { country_de:'Malawi', country_en:'Malawi', capital:'Lilongwe', region:'africa', tier:4 },
    { country_de:'Zentralafrikanische Republik', country_en:'Central African Republic', capital:'Bangui', region:'africa', tier:4 },
    { country_de:'Südsudan', country_en:'South Sudan', capital:'Juba', region:'africa', tier:4 },
    { country_de:'Republik Kongo', country_en:'Republic of the Congo', capital:'Brazzaville', region:'africa', tier:4 },
  ],

  /* ═══════════════════════════════════════
     ALGEBRA MODE
     ═══════════════════════════════════════ */
  UNLOCK_ALGEBRA: 5,

  /* Algebra difficulty phases — progressive problem types */
  ALGEBRA_PHASES: [
    { threshold: 0,   type: 'linear_add',   label: 'ax + b = c' },
    { threshold: 8,   type: 'linear_sub',   label: 'ax - b = c' },
    { threshold: 18,  type: 'two_step',     label: 'a(x+b) = c' },
    { threshold: 30,  type: 'square',       label: 'x² = n' },
    { threshold: 45,  type: 'sqrt',         label: '√n' },
    { threshold: 65,  type: 'power',        label: 'aⁿ' },
    { threshold: 90,  type: 'fraction_add', label: 'a/b + c/d' },
  ],

  /* Perfect squares for sqrt/square phases */
  ALGEBRA_PERFECT_SQUARES: [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225],

  /* Power bases and their safe exponents (result ≤ 1000) */
  ALGEBRA_POWERS: [
    { base: 2, exps: [2,3,4,5,6,7,8,9,10] },
    { base: 3, exps: [2,3,4,5,6] },
    { base: 4, exps: [2,3,4] },
    { base: 5, exps: [2,3,4] },
    { base: 6, exps: [2,3] },
    { base: 7, exps: [2,3] },
    { base: 8, exps: [2,3] },
    { base: 9, exps: [2] },
    { base: 10, exps: [2,3] },
    { base: 11, exps: [2] },
    { base: 12, exps: [2] },
  ],

  /* Fraction pairs for fraction_add phase (result = simple fraction or integer) */
  ALGEBRA_FRACTIONS: [
    { a:1, b:2, c:1, d:2, rn:1, rd:1 },   /* 1/2+1/2 = 1 */
    { a:1, b:2, c:1, d:3, rn:5, rd:6 },
    { a:1, b:2, c:1, d:4, rn:3, rd:4 },
    { a:1, b:3, c:1, d:3, rn:2, rd:3 },
    { a:1, b:3, c:1, d:6, rn:1, rd:2 },
    { a:1, b:4, c:1, d:4, rn:1, rd:2 },
    { a:2, b:3, c:1, d:6, rn:5, rd:6 },
    { a:2, b:5, c:1, d:5, rn:3, rd:5 },
    { a:3, b:4, c:1, d:4, rn:1, rd:1 },
    { a:1, b:3, c:2, d:3, rn:1, rd:1 },
    { a:3, b:8, c:1, d:8, rn:1, rd:2 },
    { a:1, b:6, c:1, d:3, rn:1, rd:2 },
    { a:2, b:3, c:1, d:4, rn:11, rd:12 },
    { a:1, b:5, c:2, d:5, rn:3, rd:5 },
    { a:3, b:5, c:1, d:5, rn:4, rd:5 },
    { a:1, b:2, c:1, d:6, rn:2, rd:3 },
    { a:1, b:4, c:3, d:4, rn:1, rd:1 },
    { a:2, b:7, c:3, d:7, rn:5, rd:7 },
    { a:1, b:3, c:1, d:4, rn:7, rd:12 },
    { a:1, b:5, c:1, d:10, rn:3, rd:10 },
  ],

  /* ─── Persistent rule label keys (clarity overhaul) ─── */
  RULE_LABELS: {
    de: {
      klassik: 'Farbe zuordnen',
      beginner: 'Form zuordnen',
      expert: 'Form zuordnen',
      ultra: 'Form zuordnen',
      mathe: 'Lösung wählen',
      worte: 'Kategorie wählen',
      memo: 'Erinnere die Position',
      sequenz: 'Reihenfolge merken',
      stroop: 'Schriftfarbe, nicht Wort!',
      fokus: 'Nur der mittlere Pfeil!',
      chaos: '',
      hauptstaedte: 'Hauptstadt finden',
      algebra: 'x = ?',
      wissen: 'Richtige Antwort wählen',
    },
    en: {
      klassik: 'Match the color',
      beginner: 'Match the shape',
      expert: 'Match the shape',
      ultra: 'Match the shape',
      mathe: 'Pick the answer',
      worte: 'Pick the category',
      memo: 'Remember the position',
      sequenz: 'Remember the order',
      stroop: 'Ink color, not word!',
      fokus: 'Center arrow only!',
      chaos: '',
      hauptstaedte: 'Find the capital',
      algebra: 'x = ?',
      wissen: 'Pick the answer',
    },
  },

  /* ═══════════════════════════════════════════
     WISSEN (General Knowledge) Question Bank
     tier: 0=easy, 1=medium, 2=hard, 3=expert
     cat: geo, sci, hist, cult, sport, nature
     ═══════════════════════════════════════════ */
  WISSEN_TIERS: [
    { threshold: 0,  label: 'easy' },
    { threshold: 10, label: 'medium' },
    { threshold: 25, label: 'hard' },
    { threshold: 45, label: 'expert' },
  ],

  WISSEN_BANK: [
    /* ── Tier 0: Easy ── */
    { q_de:'Wie viele Kontinente gibt es?', q_en:'How many continents are there?',
      a:[{de:'7',en:'7',ok:1},{de:'5',en:'5'},{de:'6',en:'6'},{de:'8',en:'8'}], cat:'geo', tier:0 },
    { q_de:'Welches ist das größte Land der Erde?', q_en:'Which is the largest country on Earth?',
      a:[{de:'Russland',en:'Russia',ok:1},{de:'Kanada',en:'Canada'},{de:'China',en:'China'},{de:'USA',en:'USA'}], cat:'geo', tier:0 },
    { q_de:'Welcher Planet ist der Sonne am nächsten?', q_en:'Which planet is closest to the Sun?',
      a:[{de:'Merkur',en:'Mercury',ok:1},{de:'Venus',en:'Venus'},{de:'Mars',en:'Mars'},{de:'Erde',en:'Earth'}], cat:'sci', tier:0 },
    { q_de:'Wie viele Zähne hat ein erwachsener Mensch?', q_en:'How many teeth does an adult human have?',
      a:[{de:'32',en:'32',ok:1},{de:'28',en:'28'},{de:'30',en:'30'},{de:'36',en:'36'}], cat:'sci', tier:0 },
    { q_de:'In welchem Jahr fiel die Berliner Mauer?', q_en:'In which year did the Berlin Wall fall?',
      a:[{de:'1989',en:'1989',ok:1},{de:'1991',en:'1991'},{de:'1987',en:'1987'},{de:'1990',en:'1990'}], cat:'hist', tier:0 },
    { q_de:'Welches chemische Element hat das Symbol O?', q_en:'Which chemical element has the symbol O?',
      a:[{de:'Sauerstoff',en:'Oxygen',ok:1},{de:'Gold',en:'Gold'},{de:'Osmium',en:'Osmium'},{de:'Eisen',en:'Iron'}], cat:'sci', tier:0 },
    { q_de:'Wie viele Spieler hat eine Fußballmannschaft?', q_en:'How many players are on a soccer team?',
      a:[{de:'11',en:'11',ok:1},{de:'9',en:'9'},{de:'10',en:'10'},{de:'12',en:'12'}], cat:'sport', tier:0 },
    { q_de:'Welches Tier ist das größte Säugetier?', q_en:'Which animal is the largest mammal?',
      a:[{de:'Blauwal',en:'Blue whale',ok:1},{de:'Elefant',en:'Elephant'},{de:'Giraffe',en:'Giraffe'},{de:'Wal­hai',en:'Whale shark'}], cat:'nature', tier:0 },
    { q_de:'Wie viele Tage hat ein Schaltjahr?', q_en:'How many days does a leap year have?',
      a:[{de:'366',en:'366',ok:1},{de:'365',en:'365'},{de:'364',en:'364'},{de:'367',en:'367'}], cat:'sci', tier:0 },
    { q_de:'Welche Farbe entsteht aus Rot und Blau?', q_en:'What color do you get from red and blue?',
      a:[{de:'Lila',en:'Purple',ok:1},{de:'Grün',en:'Green'},{de:'Orange',en:'Orange'},{de:'Braun',en:'Brown'}], cat:'cult', tier:0 },
    { q_de:'Welches Organ pumpt Blut durch den Körper?', q_en:'Which organ pumps blood through the body?',
      a:[{de:'Herz',en:'Heart',ok:1},{de:'Lunge',en:'Lung'},{de:'Leber',en:'Liver'},{de:'Gehirn',en:'Brain'}], cat:'sci', tier:0 },
    { q_de:'In welchem Land steht der Eiffelturm?', q_en:'In which country is the Eiffel Tower?',
      a:[{de:'Frankreich',en:'France',ok:1},{de:'Italien',en:'Italy'},{de:'Spanien',en:'Spain'},{de:'Belgien',en:'Belgium'}], cat:'geo', tier:0 },
    { q_de:'Wie heißt der längste Fluss der Welt?', q_en:'What is the longest river in the world?',
      a:[{de:'Nil',en:'Nile',ok:1},{de:'Amazonas',en:'Amazon'},{de:'Donau',en:'Danube'},{de:'Jangtsekiang',en:'Yangtze'}], cat:'geo', tier:0 },
    { q_de:'Wie viele Bundesländer hat Deutschland?', q_en:'How many federal states does Germany have?',
      a:[{de:'16',en:'16',ok:1},{de:'14',en:'14'},{de:'18',en:'18'},{de:'12',en:'12'}], cat:'geo', tier:0 },
    { q_de:'Welches Gas atmen wir hauptsächlich ein?', q_en:'Which gas do we mainly breathe in?',
      a:[{de:'Stickstoff',en:'Nitrogen',ok:1},{de:'Sauerstoff',en:'Oxygen'},{de:'CO₂',en:'CO₂'},{de:'Helium',en:'Helium'}], cat:'sci', tier:0 },
    { q_de:'Wer malte die Mona Lisa?', q_en:'Who painted the Mona Lisa?',
      a:[{de:'Da Vinci',en:'Da Vinci',ok:1},{de:'Picasso',en:'Picasso'},{de:'Monet',en:'Monet'},{de:'Van Gogh',en:'Van Gogh'}], cat:'cult', tier:0 },
    { q_de:'Welches Metall ist flüssig bei Raumtemperatur?', q_en:'Which metal is liquid at room temperature?',
      a:[{de:'Quecksilber',en:'Mercury',ok:1},{de:'Blei',en:'Lead'},{de:'Zinn',en:'Tin'},{de:'Gallium',en:'Gallium'}], cat:'sci', tier:0 },
    { q_de:'Welcher Ozean ist der größte?', q_en:'Which ocean is the largest?',
      a:[{de:'Pazifik',en:'Pacific',ok:1},{de:'Atlantik',en:'Atlantic'},{de:'Indisch',en:'Indian'},{de:'Arktisch',en:'Arctic'}], cat:'geo', tier:0 },
    { q_de:'Wie heißt die Hauptstadt von Österreich?', q_en:'What is the capital of Austria?',
      a:[{de:'Wien',en:'Vienna',ok:1},{de:'Graz',en:'Graz'},{de:'Salzburg',en:'Salzburg'},{de:'Linz',en:'Linz'}], cat:'geo', tier:0 },
    { q_de:'Welches Vitamin liefert Sonnenlicht?', q_en:'Which vitamin does sunlight provide?',
      a:[{de:'Vitamin D',en:'Vitamin D',ok:1},{de:'Vitamin C',en:'Vitamin C'},{de:'Vitamin A',en:'Vitamin A'},{de:'Vitamin B',en:'Vitamin B'}], cat:'sci', tier:0 },
    { q_de:'Welches Land hat die meisten Einwohner?', q_en:'Which country has the most inhabitants?',
      a:[{de:'Indien',en:'India',ok:1},{de:'China',en:'China'},{de:'USA',en:'USA'},{de:'Indonesien',en:'Indonesia'}], cat:'geo', tier:0 },
    { q_de:'Wie heißt der höchste Berg der Welt?', q_en:'What is the highest mountain in the world?',
      a:[{de:'Mount Everest',en:'Mount Everest',ok:1},{de:'K2',en:'K2'},{de:'Kilimandscharo',en:'Kilimanjaro'},{de:'Mont Blanc',en:'Mont Blanc'}], cat:'geo', tier:0 },
    { q_de:'Welche Sportart wird auf Eis gespielt?', q_en:'Which sport is played on ice?',
      a:[{de:'Eishockey',en:'Ice hockey',ok:1},{de:'Cricket',en:'Cricket'},{de:'Rugby',en:'Rugby'},{de:'Handball',en:'Handball'}], cat:'sport', tier:0 },
    { q_de:'Wie viele Beine hat eine Spinne?', q_en:'How many legs does a spider have?',
      a:[{de:'8',en:'8',ok:1},{de:'6',en:'6'},{de:'10',en:'10'},{de:'4',en:'4'}], cat:'nature', tier:0 },
    { q_de:'Welches Instrument hat 88 Tasten?', q_en:'Which instrument has 88 keys?',
      a:[{de:'Klavier',en:'Piano',ok:1},{de:'Orgel',en:'Organ'},{de:'Akkordeon',en:'Accordion'},{de:'Synthesizer',en:'Synthesizer'}], cat:'cult', tier:0 },
    { q_de:'Welcher Stoff hat die chemische Formel H₂O?', q_en:'Which substance has the formula H₂O?',
      a:[{de:'Wasser',en:'Water',ok:1},{de:'Wasserstoff',en:'Hydrogen'},{de:'Helium',en:'Helium'},{de:'Alkohol',en:'Alcohol'}], cat:'sci', tier:0 },
    { q_de:'In welchem Monat ist Weihnachten?', q_en:'In which month is Christmas?',
      a:[{de:'Dezember',en:'December',ok:1},{de:'November',en:'November'},{de:'Januar',en:'January'},{de:'Oktober',en:'October'}], cat:'cult', tier:0 },
    { q_de:'Wie viele Buchstaben hat das deutsche Alphabet?', q_en:'How many letters in the German alphabet?',
      a:[{de:'26',en:'26',ok:1},{de:'24',en:'24'},{de:'28',en:'28'},{de:'30',en:'30'}], cat:'cult', tier:0 },
    { q_de:'Welcher Vogel kann nicht fliegen?', q_en:'Which bird cannot fly?',
      a:[{de:'Strauß',en:'Ostrich',ok:1},{de:'Adler',en:'Eagle'},{de:'Pelikan',en:'Pelican'},{de:'Papagei',en:'Parrot'}], cat:'nature', tier:0 },
    { q_de:'Wie heißt die Weltraumorganisation der USA?', q_en:'What is the US space agency called?',
      a:[{de:'NASA',en:'NASA',ok:1},{de:'ESA',en:'ESA'},{de:'SpaceX',en:'SpaceX'},{de:'CERN',en:'CERN'}], cat:'sci', tier:0 },

    /* ── Tier 1: Medium ── */
    { q_de:'Welches ist das kleinste Land der Welt?', q_en:'Which is the smallest country in the world?',
      a:[{de:'Vatikanstadt',en:'Vatican City',ok:1},{de:'Monaco',en:'Monaco'},{de:'San Marino',en:'San Marino'},{de:'Liechtenstein',en:'Liechtenstein'}], cat:'geo', tier:1 },
    { q_de:'In welchem Jahr begann der Erste Weltkrieg?', q_en:'In which year did World War I begin?',
      a:[{de:'1914',en:'1914',ok:1},{de:'1916',en:'1916'},{de:'1912',en:'1912'},{de:'1918',en:'1918'}], cat:'hist', tier:1 },
    { q_de:'Wie heißt das größte Organ des Menschen?', q_en:'What is the largest organ of the human body?',
      a:[{de:'Haut',en:'Skin',ok:1},{de:'Leber',en:'Liver'},{de:'Lunge',en:'Lung'},{de:'Darm',en:'Intestine'}], cat:'sci', tier:1 },
    { q_de:'Welcher Planet hat die meisten Monde?', q_en:'Which planet has the most moons?',
      a:[{de:'Saturn',en:'Saturn',ok:1},{de:'Jupiter',en:'Jupiter'},{de:'Uranus',en:'Uranus'},{de:'Neptun',en:'Neptune'}], cat:'sci', tier:1 },
    { q_de:'Wer schrieb "Romeo und Julia"?', q_en:'Who wrote "Romeo and Juliet"?',
      a:[{de:'Shakespeare',en:'Shakespeare',ok:1},{de:'Goethe',en:'Goethe'},{de:'Dickens',en:'Dickens'},{de:'Molière',en:'Molière'}], cat:'cult', tier:1 },
    { q_de:'Was ist die Lichtgeschwindigkeit (ca.)?', q_en:'What is the speed of light (approx.)?',
      a:[{de:'300.000 km/s',en:'300,000 km/s',ok:1},{de:'150.000 km/s',en:'150,000 km/s'},{de:'500.000 km/s',en:'500,000 km/s'},{de:'30.000 km/s',en:'30,000 km/s'}], cat:'sci', tier:1 },
    { q_de:'Welches Tier hat die längste Zunge?', q_en:'Which animal has the longest tongue?',
      a:[{de:'Chamäleon',en:'Chameleon',ok:1},{de:'Giraffe',en:'Giraffe'},{de:'Ameisenbär',en:'Anteater'},{de:'Frosch',en:'Frog'}], cat:'nature', tier:1 },
    { q_de:'In welcher Stadt sind die Olympischen Spiele 2024?', q_en:'In which city are the 2024 Olympics?',
      a:[{de:'Paris',en:'Paris',ok:1},{de:'Tokyo',en:'Tokyo'},{de:'Los Angeles',en:'Los Angeles'},{de:'London',en:'London'}], cat:'sport', tier:1 },
    { q_de:'Wie heißt das härteste natürliche Material?', q_en:'What is the hardest natural material?',
      a:[{de:'Diamant',en:'Diamond',ok:1},{de:'Titan',en:'Titanium'},{de:'Quarz',en:'Quartz'},{de:'Stahl',en:'Steel'}], cat:'sci', tier:1 },
    { q_de:'Wie viele Tasten hat ein Standardklavier?', q_en:'How many keys does a standard piano have?',
      a:[{de:'88',en:'88',ok:1},{de:'76',en:'76'},{de:'92',en:'92'},{de:'84',en:'84'}], cat:'cult', tier:1 },
    { q_de:'Welches Tier schläft bis zu 22 Stunden am Tag?', q_en:'Which animal sleeps up to 22 hours a day?',
      a:[{de:'Koala',en:'Koala',ok:1},{de:'Faultier',en:'Sloth'},{de:'Katze',en:'Cat'},{de:'Bär',en:'Bear'}], cat:'nature', tier:1 },
    { q_de:'In welchem Land liegt Machu Picchu?', q_en:'In which country is Machu Picchu?',
      a:[{de:'Peru',en:'Peru',ok:1},{de:'Bolivien',en:'Bolivia'},{de:'Chile',en:'Chile'},{de:'Kolumbien',en:'Colombia'}], cat:'geo', tier:1 },
    { q_de:'Welches ist das leichteste Element?', q_en:'Which is the lightest element?',
      a:[{de:'Wasserstoff',en:'Hydrogen',ok:1},{de:'Helium',en:'Helium'},{de:'Lithium',en:'Lithium'},{de:'Sauerstoff',en:'Oxygen'}], cat:'sci', tier:1 },
    { q_de:'Wie viele Knochen hat ein Erwachsener?', q_en:'How many bones does an adult have?',
      a:[{de:'206',en:'206',ok:1},{de:'196',en:'196'},{de:'216',en:'216'},{de:'186',en:'186'}], cat:'sci', tier:1 },
    { q_de:'Wer erfand die Glühbirne?', q_en:'Who invented the light bulb?',
      a:[{de:'Edison',en:'Edison',ok:1},{de:'Tesla',en:'Tesla'},{de:'Bell',en:'Bell'},{de:'Watt',en:'Watt'}], cat:'hist', tier:1 },
    { q_de:'Welcher Fluss fließt durch London?', q_en:'Which river flows through London?',
      a:[{de:'Themse',en:'Thames',ok:1},{de:'Seine',en:'Seine'},{de:'Donau',en:'Danube'},{de:'Rhein',en:'Rhine'}], cat:'geo', tier:1 },
    { q_de:'Was ist die Hauptzutat von Guacamole?', q_en:'What is the main ingredient of guacamole?',
      a:[{de:'Avocado',en:'Avocado',ok:1},{de:'Tomate',en:'Tomato'},{de:'Zucchini',en:'Zucchini'},{de:'Erbse',en:'Pea'}], cat:'cult', tier:1 },
    { q_de:'Wie viele Saiten hat eine Standardgitarre?', q_en:'How many strings does a standard guitar have?',
      a:[{de:'6',en:'6',ok:1},{de:'4',en:'4'},{de:'8',en:'8'},{de:'5',en:'5'}], cat:'cult', tier:1 },
    { q_de:'Welches Land hat die Form eines Stiefels?', q_en:'Which country is shaped like a boot?',
      a:[{de:'Italien',en:'Italy',ok:1},{de:'Griechenland',en:'Greece'},{de:'Portugal',en:'Portugal'},{de:'Chile',en:'Chile'}], cat:'geo', tier:1 },
    { q_de:'Wer war der erste Mensch auf dem Mond?', q_en:'Who was the first person on the Moon?',
      a:[{de:'Neil Armstrong',en:'Neil Armstrong',ok:1},{de:'Buzz Aldrin',en:'Buzz Aldrin'},{de:'Juri Gagarin',en:'Yuri Gagarin'},{de:'John Glenn',en:'John Glenn'}], cat:'hist', tier:1 },
    { q_de:'Wie heißt der höchste Berg Europas?', q_en:'What is the tallest mountain in Europe?',
      a:[{de:'Elbrus',en:'Elbrus',ok:1},{de:'Mont Blanc',en:'Mont Blanc'},{de:'Matterhorn',en:'Matterhorn'},{de:'Zugspitze',en:'Zugspitze'}], cat:'geo', tier:1 },
    { q_de:'Welches Tier ist das schnellste an Land?', q_en:'Which animal is the fastest on land?',
      a:[{de:'Gepard',en:'Cheetah',ok:1},{de:'Löwe',en:'Lion'},{de:'Antilope',en:'Antelope'},{de:'Pferd',en:'Horse'}], cat:'nature', tier:1 },
    { q_de:'In welchem Jahr wurde die EU gegründet?', q_en:'In which year was the EU founded?',
      a:[{de:'1993',en:'1993',ok:1},{de:'1989',en:'1989'},{de:'1995',en:'1995'},{de:'1991',en:'1991'}], cat:'hist', tier:1 },
    { q_de:'Wie lange dauert ein Flug zum Mond (ca.)?', q_en:'How long does a flight to the Moon take (approx.)?',
      a:[{de:'3 Tage',en:'3 days',ok:1},{de:'1 Tag',en:'1 day'},{de:'7 Tage',en:'7 days'},{de:'12 Stunden',en:'12 hours'}], cat:'sci', tier:1 },
    { q_de:'Aus welchem Land kommt Pizza?', q_en:'Which country does pizza come from?',
      a:[{de:'Italien',en:'Italy',ok:1},{de:'Griechenland',en:'Greece'},{de:'Spanien',en:'Spain'},{de:'USA',en:'USA'}], cat:'cult', tier:1 },
    { q_de:'Welche Blutgruppe ist ein Universalspender?', q_en:'Which blood type is a universal donor?',
      a:[{de:'0 negativ',en:'O negative',ok:1},{de:'A positiv',en:'A positive'},{de:'AB positiv',en:'AB positive'},{de:'B negativ',en:'B negative'}], cat:'sci', tier:1 },
    { q_de:'Welcher Kontinent hat die meisten Länder?', q_en:'Which continent has the most countries?',
      a:[{de:'Afrika',en:'Africa',ok:1},{de:'Asien',en:'Asia'},{de:'Europa',en:'Europe'},{de:'Südamerika',en:'South America'}], cat:'geo', tier:1 },
    { q_de:'Was ist der größte Planet unseres Sonnensystems?', q_en:'What is the largest planet in our solar system?',
      a:[{de:'Jupiter',en:'Jupiter',ok:1},{de:'Saturn',en:'Saturn'},{de:'Neptun',en:'Neptune'},{de:'Uranus',en:'Uranus'}], cat:'sci', tier:1 },
    { q_de:'Wie viele Herzkammern hat ein Mensch?', q_en:'How many heart chambers does a human have?',
      a:[{de:'4',en:'4',ok:1},{de:'2',en:'2'},{de:'3',en:'3'},{de:'6',en:'6'}], cat:'sci', tier:1 },
    { q_de:'Welche Währung nutzt Japan?', q_en:'What currency does Japan use?',
      a:[{de:'Yen',en:'Yen',ok:1},{de:'Won',en:'Won'},{de:'Yuan',en:'Yuan'},{de:'Rupie',en:'Rupee'}], cat:'geo', tier:1 },

    /* ── Tier 2: Hard ── */
    { q_de:'Wie heißt der tiefste Punkt im Meer?', q_en:'What is the deepest point in the ocean?',
      a:[{de:'Marianengraben',en:'Mariana Trench',ok:1},{de:'Tongagraben',en:'Tonga Trench'},{de:'Japangraben',en:'Japan Trench'},{de:'Sundagraben',en:'Sunda Trench'}], cat:'geo', tier:2 },
    { q_de:'In welchem Jahr wurde die UNO gegründet?', q_en:'In which year was the UN founded?',
      a:[{de:'1945',en:'1945',ok:1},{de:'1948',en:'1948'},{de:'1942',en:'1942'},{de:'1950',en:'1950'}], cat:'hist', tier:2 },
    { q_de:'Was ist der Siedepunkt von Wasser in Kelvin?', q_en:'What is the boiling point of water in Kelvin?',
      a:[{de:'373',en:'373',ok:1},{de:'273',en:'273'},{de:'100',en:'100'},{de:'473',en:'473'}], cat:'sci', tier:2 },
    { q_de:'Wer schrieb "Faust"?', q_en:'Who wrote "Faust"?',
      a:[{de:'Goethe',en:'Goethe',ok:1},{de:'Schiller',en:'Schiller'},{de:'Kafka',en:'Kafka'},{de:'Hesse',en:'Hesse'}], cat:'cult', tier:2 },
    { q_de:'Was ist der kleinste Knochen im menschlichen Körper?', q_en:'What is the smallest bone in the human body?',
      a:[{de:'Steigbügel',en:'Stapes',ok:1},{de:'Hammer',en:'Hammer'},{de:'Amboss',en:'Anvil'},{de:'Kniescheibe',en:'Kneecap'}], cat:'sci', tier:2 },
    { q_de:'Welches Tier hat drei Herzen?', q_en:'Which animal has three hearts?',
      a:[{de:'Oktopus',en:'Octopus',ok:1},{de:'Qualle',en:'Jellyfish'},{de:'Wurm',en:'Worm'},{de:'Schnecke',en:'Snail'}], cat:'nature', tier:2 },
    { q_de:'In welchem Land entspringt der Rhein?', q_en:'In which country does the Rhine originate?',
      a:[{de:'Schweiz',en:'Switzerland',ok:1},{de:'Deutschland',en:'Germany'},{de:'Österreich',en:'Austria'},{de:'Frankreich',en:'France'}], cat:'geo', tier:2 },
    { q_de:'Welches ist das meistgesprochene Muttersprache?', q_en:'Which is the most spoken native language?',
      a:[{de:'Mandarin',en:'Mandarin',ok:1},{de:'Englisch',en:'English'},{de:'Spanisch',en:'Spanish'},{de:'Hindi',en:'Hindi'}], cat:'cult', tier:2 },
    { q_de:'Wie heißt die Einheit der elektrischen Spannung?', q_en:'What is the unit of electrical voltage?',
      a:[{de:'Volt',en:'Volt',ok:1},{de:'Watt',en:'Watt'},{de:'Ampere',en:'Ampere'},{de:'Ohm',en:'Ohm'}], cat:'sci', tier:2 },
    { q_de:'Wie lang ist der Panamakanal (ca.)?', q_en:'How long is the Panama Canal (approx.)?',
      a:[{de:'82 km',en:'82 km',ok:1},{de:'40 km',en:'40 km'},{de:'120 km',en:'120 km'},{de:'200 km',en:'200 km'}], cat:'geo', tier:2 },
    { q_de:'Welcher Wissenschaftler entwickelte die Relativitätstheorie?', q_en:'Which scientist developed the theory of relativity?',
      a:[{de:'Einstein',en:'Einstein',ok:1},{de:'Newton',en:'Newton'},{de:'Bohr',en:'Bohr'},{de:'Hawking',en:'Hawking'}], cat:'sci', tier:2 },
    { q_de:'In welchem Ozean liegt Hawaii?', q_en:'In which ocean is Hawaii located?',
      a:[{de:'Pazifik',en:'Pacific',ok:1},{de:'Atlantik',en:'Atlantic'},{de:'Indisch',en:'Indian'},{de:'Arktisch',en:'Arctic'}], cat:'geo', tier:2 },
    { q_de:'Welches Gas macht die Sonne heiß?', q_en:'Which gas makes the Sun hot?',
      a:[{de:'Wasserstoff',en:'Hydrogen',ok:1},{de:'Helium',en:'Helium'},{de:'Sauerstoff',en:'Oxygen'},{de:'Stickstoff',en:'Nitrogen'}], cat:'sci', tier:2 },
    { q_de:'Wer komponierte die 9. Sinfonie?', q_en:'Who composed the 9th Symphony?',
      a:[{de:'Beethoven',en:'Beethoven',ok:1},{de:'Mozart',en:'Mozart'},{de:'Bach',en:'Bach'},{de:'Brahms',en:'Brahms'}], cat:'cult', tier:2 },
    { q_de:'Welches Land hat die längste Küstenlinie?', q_en:'Which country has the longest coastline?',
      a:[{de:'Kanada',en:'Canada',ok:1},{de:'Australien',en:'Australia'},{de:'Indonesien',en:'Indonesia'},{de:'Norwegen',en:'Norway'}], cat:'geo', tier:2 },
    { q_de:'Was misst ein Barometer?', q_en:'What does a barometer measure?',
      a:[{de:'Luftdruck',en:'Air pressure',ok:1},{de:'Temperatur',en:'Temperature'},{de:'Feuchtigkeit',en:'Humidity'},{de:'Windstärke',en:'Wind speed'}], cat:'sci', tier:2 },
    { q_de:'Wie viele Chromosomen hat ein Mensch?', q_en:'How many chromosomes does a human have?',
      a:[{de:'46',en:'46',ok:1},{de:'44',en:'44'},{de:'48',en:'48'},{de:'42',en:'42'}], cat:'sci', tier:2 },
    { q_de:'Welches Land hat die meisten Zeitzonen?', q_en:'Which country has the most time zones?',
      a:[{de:'Frankreich',en:'France',ok:1},{de:'Russland',en:'Russia'},{de:'USA',en:'USA'},{de:'China',en:'China'}], cat:'geo', tier:2 },
    { q_de:'Welcher Muskel ist der stärkste im Körper?', q_en:'Which muscle is the strongest in the body?',
      a:[{de:'Kaumuskel',en:'Masseter',ok:1},{de:'Bizeps',en:'Bicep'},{de:'Herz',en:'Heart'},{de:'Oberschenkel',en:'Quadricep'}], cat:'sci', tier:2 },
    { q_de:'Welches Element hat die Ordnungszahl 79?', q_en:'Which element has atomic number 79?',
      a:[{de:'Gold',en:'Gold',ok:1},{de:'Silber',en:'Silver'},{de:'Platin',en:'Platinum'},{de:'Kupfer',en:'Copper'}], cat:'sci', tier:2 },

    /* ── Tier 3: Expert ── */
    { q_de:'Wie viele Planeten im Sonnensystem haben Ringe?', q_en:'How many planets in the solar system have rings?',
      a:[{de:'4',en:'4',ok:1},{de:'2',en:'2'},{de:'1',en:'1'},{de:'3',en:'3'}], cat:'sci', tier:3 },
    { q_de:'Wer entdeckte Penicillin?', q_en:'Who discovered penicillin?',
      a:[{de:'Fleming',en:'Fleming',ok:1},{de:'Pasteur',en:'Pasteur'},{de:'Koch',en:'Koch'},{de:'Jenner',en:'Jenner'}], cat:'sci', tier:3 },
    { q_de:'In welchem Jahr endete der Zweite Weltkrieg?', q_en:'In which year did World War II end?',
      a:[{de:'1945',en:'1945',ok:1},{de:'1944',en:'1944'},{de:'1946',en:'1946'},{de:'1943',en:'1943'}], cat:'hist', tier:3 },
    { q_de:'Wie heißt die größte Wüste der Welt?', q_en:'What is the largest desert in the world?',
      a:[{de:'Antarktis',en:'Antarctica',ok:1},{de:'Sahara',en:'Sahara'},{de:'Gobi',en:'Gobi'},{de:'Kalahari',en:'Kalahari'}], cat:'geo', tier:3 },
    { q_de:'Welche Frequenz hat Kammerton A?', q_en:'What frequency is concert pitch A?',
      a:[{de:'440 Hz',en:'440 Hz',ok:1},{de:'432 Hz',en:'432 Hz'},{de:'460 Hz',en:'460 Hz'},{de:'420 Hz',en:'420 Hz'}], cat:'cult', tier:3 },
    { q_de:'Was ist die Avogadro-Zahl (ca.)?', q_en:'What is Avogadro\'s number (approx.)?',
      a:[{de:'6×10²³',en:'6×10²³',ok:1},{de:'3×10²³',en:'3×10²³'},{de:'6×10²⁰',en:'6×10²⁰'},{de:'9×10²³',en:'9×10²³'}], cat:'sci', tier:3 },
    { q_de:'Welche Insel ist die größte der Welt?', q_en:'Which island is the largest in the world?',
      a:[{de:'Grönland',en:'Greenland',ok:1},{de:'Madagaskar',en:'Madagascar'},{de:'Borneo',en:'Borneo'},{de:'Neuguinea',en:'New Guinea'}], cat:'geo', tier:3 },
    { q_de:'In welchem Jahr wurde das Internet erfunden?', q_en:'In which year was the internet invented?',
      a:[{de:'1969',en:'1969',ok:1},{de:'1975',en:'1975'},{de:'1983',en:'1983'},{de:'1991',en:'1991'}], cat:'hist', tier:3 },
    { q_de:'Was ist die Fibonacci-Folge nach 1,1,2,3,5?', q_en:'What follows 1,1,2,3,5 in Fibonacci?',
      a:[{de:'8',en:'8',ok:1},{de:'7',en:'7'},{de:'6',en:'6'},{de:'10',en:'10'}], cat:'sci', tier:3 },
    { q_de:'Welcher Philosoph sagte "Ich denke, also bin ich"?', q_en:'Which philosopher said "I think, therefore I am"?',
      a:[{de:'Descartes',en:'Descartes',ok:1},{de:'Sokrates',en:'Socrates'},{de:'Kant',en:'Kant'},{de:'Nietzsche',en:'Nietzsche'}], cat:'cult', tier:3 },
    { q_de:'Was ist der pH-Wert von reinem Wasser?', q_en:'What is the pH value of pure water?',
      a:[{de:'7',en:'7',ok:1},{de:'6',en:'6'},{de:'8',en:'8'},{de:'5',en:'5'}], cat:'sci', tier:3 },
    { q_de:'Welches Tier hat den höchsten Blutdruck?', q_en:'Which animal has the highest blood pressure?',
      a:[{de:'Giraffe',en:'Giraffe',ok:1},{de:'Elefant',en:'Elephant'},{de:'Wal',en:'Whale'},{de:'Pferd',en:'Horse'}], cat:'nature', tier:3 },
    { q_de:'Wie hoch ist der Eiffelturm (ca.)?', q_en:'How tall is the Eiffel Tower (approx.)?',
      a:[{de:'330 m',en:'330 m',ok:1},{de:'280 m',en:'280 m'},{de:'400 m',en:'400 m'},{de:'250 m',en:'250 m'}], cat:'geo', tier:3 },
    { q_de:'Wer formulierte die Evolutionstheorie?', q_en:'Who formulated the theory of evolution?',
      a:[{de:'Darwin',en:'Darwin',ok:1},{de:'Mendel',en:'Mendel'},{de:'Lamarck',en:'Lamarck'},{de:'Wallace',en:'Wallace'}], cat:'sci', tier:3 },
    { q_de:'Wie heißt die Hauptstadt von Neuseeland?', q_en:'What is the capital of New Zealand?',
      a:[{de:'Wellington',en:'Wellington',ok:1},{de:'Auckland',en:'Auckland'},{de:'Christchurch',en:'Christchurch'},{de:'Sydney',en:'Sydney'}], cat:'geo', tier:3 },
    { q_de:'Was besagt das Ohmsche Gesetz?', q_en:'What does Ohm\'s Law state?',
      a:[{de:'U = R × I',en:'V = R × I',ok:1},{de:'F = m × a',en:'F = m × a'},{de:'E = mc²',en:'E = mc²'},{de:'P = U × I',en:'P = V × I'}], cat:'sci', tier:3 },
    { q_de:'Wann wurde der Euro eingeführt (Bargeld)?', q_en:'When was the Euro introduced (cash)?',
      a:[{de:'2002',en:'2002',ok:1},{de:'1999',en:'1999'},{de:'2000',en:'2000'},{de:'2001',en:'2001'}], cat:'hist', tier:3 },
    { q_de:'Wie viele Monde hat der Mars?', q_en:'How many moons does Mars have?',
      a:[{de:'2',en:'2',ok:1},{de:'1',en:'1'},{de:'0',en:'0'},{de:'3',en:'3'}], cat:'sci', tier:3 },
    { q_de:'Welches Tier kann seinen Kopf um 270° drehen?', q_en:'Which animal can rotate its head 270°?',
      a:[{de:'Eule',en:'Owl',ok:1},{de:'Chamäleon',en:'Chameleon'},{de:'Katze',en:'Cat'},{de:'Papagei',en:'Parrot'}], cat:'nature', tier:3 },
    { q_de:'Wie heißt die Währung der Schweiz?', q_en:'What is the currency of Switzerland?',
      a:[{de:'Franken',en:'Franc',ok:1},{de:'Euro',en:'Euro'},{de:'Krone',en:'Krone'},{de:'Mark',en:'Mark'}], cat:'geo', tier:3 },
  ],

  /* ═══════════════════════════════════════════════
     MODE MASTERY — per-mode engagement definitions
     ═══════════════════════════════════════════════ */
  MODE_MASTERY_DEFS: {
    klassik: {
      tiers: [
        { threshold: 0,    name: 'Rookie' },
        { threshold: 50,   name: 'Quick' },
        { threshold: 150,  name: 'Lightning' },
        { threshold: 400,  name: 'Blitz' },
        { threshold: 1000, name: 'Zen Master' },
      ],
      scoreCalc(mastery, mode) {
        const z200 = mastery.get(mode, 'zone200');
        const z300 = mastery.get(mode, 'zone300');
        const bestFlawless = mastery.get(mode, 'bestFlawless');
        const zenCount = mastery.get(mode, 'zenReached');
        const totalGames = mastery.get(mode, 'totalGames');
        return (z200 * 5) + (z300 * 2) + (bestFlawless * 3) + (zenCount * 50) + totalGames;
      }
    },
    beginner: {
      tiers: [
        { threshold: 0,    name: 'Novice' },
        { threshold: 40,   name: 'Spotter' },
        { threshold: 120,  name: 'Sorter' },
        { threshold: 300,  name: 'Flow Master' },
        { threshold: 800,  name: 'Shape Whisperer' },
      ],
      scoreCalc(mastery, mode) {
        const gridFill = Object.keys(mastery.mapGetAll(mode, 'shapeGrid')).length;
        const bestChain = mastery.get(mode, 'bestShapeChain');
        const jackpots = mastery.get(mode, 'jackpotCount');
        const flowHits = mastery.get(mode, 'flowHits');
        const totalGames = mastery.get(mode, 'totalGames');
        return (gridFill * 4) + (bestChain * 3) + (jackpots * 20) + Math.floor(flowHits / 5) + totalGames;
      }
    },
    expert: {
      tiers: [
        { threshold: 0,     name: 'Navigator' },
        { threshold: 60,    name: 'Pathfinder' },
        { threshold: 180,   name: 'Compass' },
        { threshold: 500,   name: 'Cartographer' },
        { threshold: 1200,  name: 'Compass Master' },
      ],
      scoreCalc(mastery, mode) {
        const dirStars = Object.values(mastery.mapGetAll(mode, 'dirStars')).reduce((a, b) => a + b, 0);
        const fullCompass = mastery.get(mode, 'fullCompassCount');
        const totalGames = mastery.get(mode, 'totalGames');
        const dirCoverage = Object.keys(mastery.mapGetAll(mode, 'dirCorrect')).length;
        return (dirStars * 8) + (fullCompass * 25) + (dirCoverage * 5) + totalGames;
      }
    },
    ultra: {
      tiers: [
        { threshold: 0,     name: 'Initiate' },
        { threshold: 80,    name: 'Ultra Rank I' },
        { threshold: 250,   name: 'Ultra Rank II' },
        { threshold: 700,   name: 'Ultra Rank III' },
        { threshold: 1800,  name: 'Ultra Rank IV' },
        { threshold: 4000,  name: 'Ultra Rank V' },
      ],
      scoreCalc(mastery, mode) {
        const dirStars = Object.values(mastery.mapGetAll(mode, 'dirStars')).reduce((a, b) => a + b, 0);
        const fullCompass = mastery.get(mode, 'fullCompassCount');
        const totalGames = mastery.get(mode, 'totalGames');
        const dirCoverage = Object.keys(mastery.mapGetAll(mode, 'dirCorrect')).length;
        const bestSurvivorSec = Math.floor(mastery.get(mode, 'bestSurvivorTime') / 1000);
        return (dirStars * 6) + (fullCompass * 30) + (dirCoverage * 8) + (bestSurvivorSec * 2) + totalGames;
      }
    },
    mathe: {
      tiers: [
        { threshold: 0,     name: 'Beginner' },
        { threshold: 50,    name: 'Calculator' },
        { threshold: 150,   name: 'Arithmetician' },
        { threshold: 400,   name: 'Mathlete' },
        { threshold: 1000,  name: 'Brain' },
      ],
      scoreCalc(mastery, mode) {
        let opMaster = 0;
        for (const op of ['+', '\u2212', '\u00D7', '\u00F7']) {
          const c = mastery.mapGet(mode, 'opCorrect', op, 0);
          opMaster += Math.min(c, 100);
        }
        const bestPhase = mastery.get(mode, 'bestPhase', 0);
        const totalCorrect = mastery.get(mode, 'totalCorrect', 0);
        const totalGames = mastery.get(mode, 'totalGames', 0);
        return (opMaster) + (bestPhase * 15) + Math.floor(totalCorrect / 3) + totalGames;
      }
    },
    algebra: {
      tiers: [
        { threshold: 0,     name: 'Student' },
        { threshold: 60,    name: 'Solver' },
        { threshold: 200,   name: 'Algebraist' },
        { threshold: 600,   name: 'Equation Master' },
        { threshold: 1500,  name: 'Genius' },
      ],
      scoreCalc(mastery, mode) {
        const ALGEBRA_TYPES = ['linear_add', 'linear_sub', 'two_step', 'square', 'sqrt', 'power', 'fraction_add'];
        let typeMaster = 0;
        for (const t of ALGEBRA_TYPES) {
          const c = mastery.mapGet(mode, 'typeCorrect', t, 0);
          typeMaster += Math.min(c, 50);
        }
        const bestPhase = mastery.get(mode, 'bestPhase', 0);
        const totalCorrect = mastery.get(mode, 'totalCorrect', 0);
        const totalGames = mastery.get(mode, 'totalGames', 0);
        const iq = mastery.get(mode, 'algebraIQ', 0);
        return typeMaster + (bestPhase * 20) + Math.floor(totalCorrect / 2) + Math.floor(iq / 5) + totalGames;
      }
    },
    worte: {
      tiers: [
        { threshold: 0,     name: 'Novice' },
        { threshold: 40,    name: 'Collector' },
        { threshold: 120,   name: 'Librarian' },
        { threshold: 350,   name: 'Wordsmith' },
        { threshold: 900,   name: 'Lexicon' },
      ],
      scoreCalc(mastery, mode) {
        const collected = (mastery.getArray(mode, 'wordCollection') || []).length;
        let catStars = 0;
        for (const cat of ['tier', 'essen', 'sport', 'farbe', 'animal', 'food', 'color']) {
          catStars += Math.min(mastery.mapGet(mode, 'catCorrect', cat, 0), 100);
        }
        const totalGames = mastery.get(mode, 'totalGames', 0);
        return collected + Math.floor(catStars / 2) + totalGames;
      }
    },
    hauptstaedte: {
      tiers: [
        { threshold: 0,     name: 'Tourist' },
        { threshold: 50,    name: 'Traveller' },
        { threshold: 150,   name: 'Explorer' },
        { threshold: 400,   name: 'Geographer' },
        { threshold: 1000,  name: 'Geo-Master' },
      ],
      scoreCalc(mastery, mode) {
        const countries = (mastery.getArray(mode, 'countryCollection') || []).length;
        const regions = ['europe','americas','asia','oceania','africa'];
        let regionStars = 0;
        for (const r of regions) regionStars += Math.min(mastery.mapGet(mode, 'regionCorrect', r, 0), 80);
        const bestStreak = mastery.get(mode, 'bestCountryStreak', 0);
        const totalGames = mastery.get(mode, 'totalGames', 0);
        return (countries * 2) + Math.floor(regionStars / 2) + (bestStreak * 3) + totalGames;
      }
    },
    wissen: {
      tiers: [
        { threshold: 0,     name: 'Curious' },
        { threshold: 50,    name: 'Scholar' },
        { threshold: 150,   name: 'Specialist' },
        { threshold: 400,   name: 'Professor' },
        { threshold: 1000,  name: 'Genius' },
      ],
      scoreCalc(mastery, mode) {
        const cats = ['geo','sci','hist','sport','nature','cult'];
        let catScore = 0;
        for (const c of cats) catScore += Math.min(mastery.mapGet(mode, 'catCorrect', c, 0), 80);
        const wissenIQ = mastery.get(mode, 'wissenIQ', 0);
        const totalGames = mastery.get(mode, 'totalGames', 0);
        return catScore + Math.floor(wissenIQ / 3) + totalGames;
      }
    },
    memo: {
      tiers: [
        { threshold: 0,     name: 'Beginner' },
        { threshold: 40,    name: 'Retainer' },
        { threshold: 120,   name: 'Memoriser' },
        { threshold: 300,   name: 'Savant' },
        { threshold: 800,   name: 'Eidetic' },
      ],
      scoreCalc(mastery, mode) {
        const bestSpan = mastery.get(mode, 'bestMemorySpan', 0);
        const perfectRecalls = mastery.get(mode, 'perfectRecalls', 0);
        const totalCorrect = mastery.get(mode, 'totalCorrect', 0);
        const totalGames = mastery.get(mode, 'totalGames', 0);
        return (bestSpan * 10) + (perfectRecalls * 5) + Math.floor(totalCorrect / 3) + totalGames;
      }
    },
    sequenz: {
      tiers: [
        { threshold: 0,     name: 'Listener' },
        { threshold: 40,    name: 'Repeater' },
        { threshold: 120,   name: 'Sequencer' },
        { threshold: 300,   name: 'Pattern Master' },
        { threshold: 800,   name: 'Simon King' },
      ],
      scoreCalc(mastery, mode) {
        const bestLen = mastery.get(mode, 'bestSeqLength', 0);
        const totalRounds = mastery.get(mode, 'totalRounds', 0);
        const perfectRounds = mastery.get(mode, 'perfectRounds', 0);
        const totalGames = mastery.get(mode, 'totalGames', 0);
        return (bestLen * 15) + (totalRounds * 2) + (perfectRounds * 8) + totalGames;
      }
    },
    stroop: {
      tiers: [
        { threshold: 0,     name: 'Susceptible' },
        { threshold: 50,    name: 'Resistant' },
        { threshold: 150,   name: 'Controller' },
        { threshold: 400,   name: 'Neural Master' },
        { threshold: 1000,  name: 'Immune' },
      ],
      scoreCalc(mastery, mode) {
        const congCorrect = mastery.get(mode, 'congruentCorrect', 0);
        const incongCorrect = mastery.get(mode, 'incongruentCorrect', 0);
        const bestInterference = mastery.get(mode, 'bestInterference', 100);
        const totalGames = mastery.get(mode, 'totalGames', 0);
        return Math.min(congCorrect, 200) + (incongCorrect * 2) + Math.max(0, Math.floor((100 - bestInterference) * 3)) + totalGames;
      }
    },
    fokus: {
      tiers: [
        { threshold: 0,     name: 'Distracted' },
        { threshold: 50,    name: 'Attentive' },
        { threshold: 150,   name: 'Focused' },
        { threshold: 400,   name: 'Laser' },
        { threshold: 1000,  name: 'Tunnel Vision' },
      ],
      scoreCalc(mastery, mode) {
        const congCorrect = mastery.get(mode, 'congruentCorrect', 0);
        const incongCorrect = mastery.get(mode, 'incongruentCorrect', 0);
        const bestFocusScore = mastery.get(mode, 'bestFocusScore', 0);
        const totalGames = mastery.get(mode, 'totalGames', 0);
        return Math.min(congCorrect, 200) + (incongCorrect * 2) + Math.floor(bestFocusScore / 2) + totalGames;
      }
    },
    chaos: {
      tiers: [
        { threshold: 0,     name: 'Confused' },
        { threshold: 60,    name: 'Adapter' },
        { threshold: 180,   name: 'Flexible' },
        { threshold: 500,   name: 'Agile Mind' },
        { threshold: 1200,  name: 'Chaos Master' },
      ],
      scoreCalc(mastery, mode) {
        const rules = ['color','shape','size','math','stroop'];
        let ruleMastery = 0;
        for (const r of rules) ruleMastery += Math.min(mastery.mapGet(mode, 'ruleCorrect', r, 0), 60);
        const bestFlexScore = mastery.get(mode, 'bestFlexScore', 0);
        const switchesSurvived = mastery.get(mode, 'totalSwitchesSurvived', 0);
        const totalGames = mastery.get(mode, 'totalGames', 0);
        return ruleMastery + Math.floor(bestFlexScore / 2) + (switchesSurvived * 3) + totalGames;
      }
    }
  },

  /* ── Klassik Speed Zone thresholds (ms) ── */
  KLASSIK_SPEED_ZONES: [
    { max: 200, id: 'ultra', label_de: 'ULTRA', label_en: 'ULTRA', color: '#FF4757' },
    { max: 300, id: 'fast',  label_de: 'BLITZ', label_en: 'BLITZ', color: '#FFA502' },
    { max: 500, id: 'good',  label_de: 'SCHNELL', label_en: 'FAST', color: '#2ED573' },
  ],

  /* ── Klassik Color Combo minimum for bonus ── */
  KLASSIK_COLOR_COMBO_MIN: 3,
  KLASSIK_COLOR_COMBO_BONUS: 50,

  /* ── Klassik Zen State streak threshold ── */
  KLASSIK_ZEN_STREAK: 50,

  /* ── Beginner/Formen: Flow Meter ── */
  BEGINNER_FLOW_THRESHOLD: 500,         // ms — answers faster than this count as "in flow"
  BEGINNER_FLOW_MIN_STREAK: 3,          // consecutive flow answers to activate meter
  BEGINNER_FLOW_MAX: 20,                // flow streak cap for visual fill

  /* ── Beginner/Formen: Shape Combo ── */
  BEGINNER_SHAPE_COMBO_MIN: 3,          // same-shape streak to trigger pop

  /* ── Beginner/Formen: Dual Match Jackpot ── */
  BEGINNER_DUAL_MATCH_MULT: 2,          // score multiplier for dual match

  /* ── Expert: Compass Mastery ── */
  EXPERT_SPEED_TIERS: [
    { max: 300, id: 'gold',   label: 'Gold',   color: '#FFD700' },
    { max: 500, id: 'silver', label: 'Silver', color: '#C0C0C0' },
    { max: 800, id: 'bronze', label: 'Bronze', color: '#CD7F32' },
  ],
  EXPERT_STAR_THRESHOLDS: [3, 8, 15, 30, 60],   // correct answers per dir for 1-5 stars
  EXPERT_FULL_COMPASS_WINDOW: 8,                 // unique dirs in last N answers = Full Compass!
  EXPERT_WEAK_SPOT_BONUS: 1.5,                   // score mult for weakest direction

  /* ── Ultra: 12-Direction Mastery ── */
  ULTRA_SPEED_TIERS: [
    { max: 350, id: 'gold',   label: 'Gold',   color: '#FFD700' },
    { max: 550, id: 'silver', label: 'Silver', color: '#C0C0C0' },
    { max: 900, id: 'bronze', label: 'Bronze', color: '#CD7F32' },
  ],
  ULTRA_STAR_THRESHOLDS: [3, 8, 15, 30, 60],    // correct answers per dir for 1-5 stars
  ULTRA_FULL_COMPASS_WINDOW: 12,                 // unique dirs in last N answers = Full Compass!
  ULTRA_WEAK_SPOT_BONUS: 1.5,                    // score mult for weakest direction

  /* ── Chaos Rank tiers (Plan 14 feature 5) ── */
  CHAOS_RANK: [
    { threshold: 0,    id: 'bronze',   label_de: 'Bronze',  label_en: 'Bronze'  },
    { threshold: 150,  id: 'silver',   label_de: 'Silber',  label_en: 'Silver'  },
    { threshold: 400,  id: 'gold',     label_de: 'Gold',    label_en: 'Gold'    },
    { threshold: 800,  id: 'platinum', label_de: 'Platin',  label_en: 'Platinum'},
    { threshold: 1500, id: 'master',   label_de: 'Chaos Master', label_en: 'Chaos Master' },
  ],

  /* ── Stroop Brain Control Levels (Plan 12 feature 3) ── */
  STROOP_BRAIN_LEVELS: [
    { maxInterference: 100, level: 1, label_de: 'Anfänger',        label_en: 'Beginner'       },
    { maxInterference: 40,  level: 2, label_de: 'Wachsam',         label_en: 'Vigilant'       },
    { maxInterference: 25,  level: 3, label_de: 'Kontrolliert',    label_en: 'Controlled'     },
    { maxInterference: 15,  level: 4, label_de: 'Diszipliniert',   label_en: 'Disciplined'    },
    { maxInterference: 8,   level: 5, label_de: 'Neural Adept',    label_en: 'Neural Adept'   },
    { maxInterference: 3,   level: 6, label_de: 'Neural Meister',  label_en: 'Neural Master'  },
    { maxInterference: 0,   level: 7, label_de: 'Immun',           label_en: 'Immune'         },
  ],

  /* ── Stroop Challenge Round (Plan 12 feature 4) ── */
  STROOP_CHALLENGE_EVERY: 15,          // trigger challenge after N consecutive correct
  STROOP_CHALLENGE_DURATION: 5000,     // ms — all-incongruent burst duration
  STROOP_CONGRUENT_RATE: 0.2,         // base congruent trial rate

  /* ── Wissen Expert Badge threshold (Plan 9 feature 5) ── */
  WISSEN_EXPERT_BADGE_THRESHOLD: 10,   // correct per topic to earn Specialist badge

  /* ── Fokus Distraction Intensity Levels (Plan 13 feature 2) ── */
  FOKUS_DISTRACTION_LEVELS: [
    { threshold: 0,  level: 1, label_de: 'Einfache Flanker',   label_en: 'Simple Flankers'   },
    { threshold: 10, level: 2, label_de: 'Doppelte Flanker',   label_en: 'Double Flankers'   },
    { threshold: 20, level: 3, label_de: 'Dreifache Flanker',  label_en: 'Triple Flankers'   },
    { threshold: 35, level: 4, label_de: 'Extreme Ablenkung',  label_en: 'Extreme Distraction' },
  ],

  /* ── Fokus Tunnel Vision achievement thresholds (Plan 13 feature 3) ── */
  FOKUS_TUNNEL_THRESHOLDS: [5, 10, 20, 50],

  /* ── Community percentile simulation tables (Plans 4, 5) ── */
  COMMUNITY_PERCENTILES: {
    ultra_streak: [5, 8, 12, 18, 25, 35, 50, 70, 100],
    mathe_rt:     [2000, 1500, 1200, 1000, 800, 600, 500, 400, 300],
  },
};
