/* ═══════════════════════════════════════════════════════
   SCS Play — Configuration Constants
   Modes: Beginner / Expert / Ultra
   Play Types: Blitz / Classic / Endless / Competition
   ═══════════════════════════════════════════════════════ */
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
  ENDLESS_MAX_MISSES: 3,              // total misses allowed in endless

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
  ENDLESS_LIFE_STREAK: 10,        // earn +1 life every N streak in endless

  /* ─── Direct speed-up on correct ─── */
  SPEED_CORRECT_DIVISOR: 90,      // ~90 correct answers from start to min interval (gentler curve)
  SPEED_WRONG_RECOVERY_MULT: 5,   // wrong recovery = 5x the correct step (faster bounce-back)

  /* ─── Answer window (ms) — minimum time before auto-miss triggers ─── */
  MIN_ANSWER_WINDOW: 1200,

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
  SWIPE_MIN_DISTANCE: 30,
  SWIPE_MAX_TIME: 800,

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
  FEVER_STREAK:     15,
  FEVER_STREAK_BRAIN: 8,
  FEVER_DURATION:   5000,
  FEVER_COOLDOWN_MS: 3000,
  FEVER_MULT:       2,

  /* ─── XP / Levels ─── */
  XP_PER_100_SCORE: 3,
  LEVEL_THRESHOLDS: [
    0,          // Lv 0: Start
    50,         // Lv 1: ~2 games
    200,        // Lv 2: ~7 games
    500,        // Lv 3: ~17 games
    1200,       // Lv 4: ~40 games
    3000,       // Lv 5: ~100 games (~1 hr)
    7000,       // Lv 6: ~230 games (~2.5 hr)
    15000,      // Lv 7: ~500 games (~5 hr)
    30000,      // Lv 8: ~1000 games (~10 hr)
    60000,      // Lv 9: ~2000 games (~20 hr)
    120000,     // Lv 10: ~4000 games (~40 hr)
    200000,     // Lv 11: ~6700 games (~65 hr)
    350000,     // Lv 12: ~12000 games (~100 hr)
    600000,     // Lv 13: ~20000 games (~160 hr)
    1000000,    // Lv 14: ~33000 games (~250 hr)
    1600000,    // Lv 15: ~53000 games (~400 hr)
    2500000,    // Lv 16: ~83000 games (~600 hr)
    4000000,    // Lv 17: ~133000 games
    6500000,    // Lv 18: ~217000 games
    10000000    // Lv 19: ~333000 games
  ],
  LEVEL_NAMES_DE: [
    'Neuling','Anfänger','Lehrling','Aufsteiger','Geselle',
    'Profi','Experte','Meister','Veteran','Könner',
    'Großmeister','Champion','Legende','Titan','Phänomen',
    'Mythisch','Unsterblich','Göttlich','Transzendent','Gott'
  ],
  LEVEL_NAMES_EN: [
    'Rookie','Beginner','Apprentice','Rising Star','Journeyman',
    'Pro','Expert','Master','Veteran','Adept',
    'Grand Master','Champion','Legend','Titan','Phenomenon',
    'Mythic','Immortal','Divine','Transcendent','God'
  ],

  /* ─── Daily XP diminishing returns (v12) ─── */
  DAILY_XP_BRACKETS: [
    { limit: 5000,   rate: 1.0 },   // first 5000 XP: full rate
    { limit: 10000,  rate: 0.5 },   // 5000-10000: half rate
    { limit: 20000,  rate: 0.25 },  // 10000-20000: quarter rate
    { limit: Infinity, rate: 0.1 }  // beyond: 10%
  ],

  /* ─── Corner Shuffle (adaptive — shape modes only) ─── */
  CORNER_SHUFFLE_FIRST: 12,         // first shuffle after 12 correct
  CORNER_SHUFFLE_INTERVAL: 10,      // then every N correct
  CORNER_SHUFFLE_STEP: 2,           // reduce interval by 2 each shuffle
  CORNER_SHUFFLE_MIN_INTERVAL: 6,   // never faster than every 6
  CORNER_SHUFFLE_WARNING_MS: 800,   // warning flash before shuffle  CORNER_SHUFFLE_COLORS: true,      // also shuffle colors when corners shuffle
  /* ─── Mode unlock levels ─── */
  UNLOCK_KLASSIK: 0,       // Always unlocked
  UNLOCK_EXPERT: 5,        // Level 6 = 3,000 XP (~1 hr)
  UNLOCK_ULTRA:  7,        // Level 8 = 15,000 XP (~5 hrs)
  UNLOCK_COMPETITION: 5,   // Same as expert

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
  RESULTS_COUNTUP_MS: 1200,
  RESULTS_STATS_DELAY: 400,
  RESULTS_BUTTONS_DELAY: 400,

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
    animal: '🐾', food: '🍎', sport: '⚽', color: '🎨',
  },
  
  WORD_EMOJI_BANKS: {
    tier:   ['🐾','🐶','🐱','🦁','🦊','🐸','🦆','🐝','🦋','🐴'],
    essen:  ['🍎','🍔','🍕','🌮','🍉','🥐','🍩','🍪','🍓','🍒'],
    sport:  ['⚽','🏀','🎾','🏓','🏂','🎿','🥊','🏈','⛳','🏹'],
    farbe:  ['🔴','🟦','🟩','🟨','🟣','🟧','⚪','🟤','⚫','🔲'],
    animal: ['🐾','🐶','🐱','🦁','🦊','🐸','🦆','🐝','🦋','🐴'],
    food:   ['🍎','🍔','🍕','🌮','🍉','🥐','🍩','🍪','🍓','🍒'],
    sport:  ['⚽','🏀','🎾','🏓','🏂','🎿','🥊','🏈','⛳','🏹'],
    color:  ['🔴','🟦','🟩','🟨','🟣','🟧','⚪','🟤','⚫','🔲'],
  },

  /* Memo mode — hidden corners (Verdeckte Ecken) */
  MEMO_PREVIEW_MS: 3000,          // Corner preview duration at game start (ms)
  MEMO_PREVIEW_MIN_MS: 1200,      // Minimum preview after shrinking
  MEMO_PREVIEW_SHRINK: 200,       // ms reduction per reveal cycle
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
  SEQUENZ_FLASH_MIN: 250,
  SEQUENZ_READY_DELAY: 400,
  SEQUENZ_INPUT_TIMEOUT_MS: 3000,  /* Max idle time per tap during "go" phase */
  SEQUENZ_INPUT_TIMEOUT_MIN: 2000, /* Minimum input timeout after difficulty plateau */
  SEQUENZ_INPUT_TIMEOUT_STEP: 100, /* ms decrease per round after plateau */
  SEQUENZ_SPEED_STEP: 50,          /* ms decrease per speed-up event */

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
  /* Congruent rate: 35% trials show matching word+ink for baseline */
  STROOP_CONGRUENT_RATE: 0.35,

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
  LIVES_MAX: Infinity,

  /* ─── Score milestones (trigger audio+visual celebration) ─── */
  SCORE_MILESTONES: [1000, 2500, 5000, 10000, 25000],

  /* ─── Weekend XP bonus ─── */
  WEEKEND_XP_MULTIPLIER: 1.5,

  /* ─── Daily challenge rewards (v17) ─── */
  DAILY_REWARD_LIVES: 2,
  DAILY_REWARD_XP: 100,
  DAILY_STREAK_XP_BONUS: 25,   /* +25 XP per streak day, capped at +250 */
};
