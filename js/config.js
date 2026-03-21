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
    },
  },
};
