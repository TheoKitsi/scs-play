/* ================================================================
   SCS Play -- Achievement System v2.0
   Template-based generation of 1000+ achievements.
   Categories, tiers, progress tracking, i18n (DE/EN).
   ================================================================ */

// ── Mode & Play-Type Constants ──────────────────────────────────
export const ALL_MODES      = ['klassik','beginner','expert','ultra','mathe','worte','memo','sequenz','stroop','fokus','chaos','hauptstaedte','algebra'];
export const SORT_MODES     = ['klassik','beginner','expert','ultra'];
export const BRAIN_MODES    = ['mathe','worte','hauptstaedte','algebra'];
export const MEMORY_MODES   = ['memo','sequenz'];
export const REFLEX_MODES   = ['stroop','fokus','chaos'];
export const ALL_PLAY_TYPES = ['blitz','classic','endless','competition'];

const MODE_NAMES = {
  de: { klassik:'Klassik', beginner:'Formen', expert:'Expert', ultra:'Ultra',
        mathe:'Mathe', worte:'Wörter', memo:'Memo', sequenz:'Sequenz',
        stroop:'Stroop', fokus:'Fokus', chaos:'Chaos',
        hauptstaedte:'Hauptstädte', algebra:'Algebra' },
  en: { klassik:'Classic', beginner:'Shapes', expert:'Expert', ultra:'Ultra',
        mathe:'Math', worte:'Words', memo:'Memo', sequenz:'Sequence',
        stroop:'Stroop', fokus:'Focus', chaos:'Chaos',
        hauptstaedte:'Capitals', algebra:'Algebra' }
};
const PT_NAMES = {
  de: { blitz:'Blitz', classic:'Standard', endless:'Endlos', competition:'Wettkampf' },
  en: { blitz:'Blitz', classic:'Classic', endless:'Endless', competition:'Competition' }
};

// ── Categories ──────────────────────────────────────────────────
export const CATEGORIES = [
  { id:'milestones',  name:{ de:'Meilensteine',    en:'Milestones' },      desc:{ de:'Spiele & Fortschritt',          en:'Games & progress' }},
  { id:'scores',      name:{ de:'Highscores',      en:'High Scores' },     desc:{ de:'Punkteziele erreichen',         en:'Reach score targets' }},
  { id:'streaks',     name:{ de:'Serien',          en:'Streaks' },          desc:{ de:'Ununterbrochene Treffer',       en:'Unbroken hit chains' }},
  { id:'precision',   name:{ de:'Präzision',       en:'Precision' },        desc:{ de:'Genauigkeit & Perfektion',      en:'Accuracy & perfection' }},
  { id:'speed',       name:{ de:'Geschwindigkeit', en:'Speed' },            desc:{ de:'Reaktionszeit-Rekorde',         en:'Reaction time records' }},
  { id:'modes',       name:{ de:'Spielmodi',       en:'Game Modes' },       desc:{ de:'Modus-Erkundung',              en:'Mode exploration' }},
  { id:'endless',     name:{ de:'Endlos',          en:'Endless' },          desc:{ de:'Endlos-Modus',                 en:'Endless mode' }},
  { id:'competition', name:{ de:'Wettkampf',       en:'Competition' },      desc:{ de:'Wettkampf-Level',              en:'Competition levels' }},
  { id:'bonuses',     name:{ de:'Boni & Fever',    en:'Bonuses & Fever' },  desc:{ de:'Goldene, Diamanten & Fever',   en:'Goldens, diamonds & fever' }},
  { id:'progression', name:{ de:'Fortschritt',     en:'Progression' },      desc:{ de:'Level & Erfahrung',            en:'Levels & experience' }},
  { id:'daily',       name:{ de:'Täglich',         en:'Daily' },            desc:{ de:'Tägliche Aktivitäten',         en:'Daily activities' }},
  { id:'cumulative',  name:{ de:'Kumulativ',       en:'Cumulative' },       desc:{ de:'Lebenslange Statistiken',      en:'Lifetime statistics' }},
  { id:'mastery',     name:{ de:'Meisterschaft',   en:'Mastery' },          desc:{ de:'Kombinierte Höchstleistungen', en:'Combined master feats' }},
];

// ── Tiers ───────────────────────────────────────────────────────
export const TIERS = [
  { id:'bronze',   color:'#CD7F32', name:{ de:'Bronze',  en:'Bronze' },   xp:10 },
  { id:'silver',   color:'#C0C0C0', name:{ de:'Silber',  en:'Silver' },   xp:25 },
  { id:'gold',     color:'#FFD700', name:{ de:'Gold',    en:'Gold' },     xp:50 },
  { id:'platinum', color:'#E5E4E2', name:{ de:'Platin',  en:'Platinum' }, xp:100 },
  { id:'diamond',  color:'#B9F2FF', name:{ de:'Diamant', en:'Diamond' },  xp:250 },
];

function assignTier(index, total) {
  if (total <= 1) return 0;
  const pct = index / (total - 1);
  if (pct <= 0.25) return 0;
  if (pct <= 0.50) return 1;
  if (pct <= 0.72) return 2;
  if (pct <= 0.88) return 3;
  return 4;
}

// ── Number formatting ───────────────────────────────────────────
function fmtN(n, lang) {
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace('.', lang === 'de' ? ',' : '.') + 'M';
  return lang === 'de' ? n.toLocaleString('de-DE') : n.toLocaleString('en-US');
}

// ── Metric resolver functions ───────────────────────────────────
// Each receives (saveData, achStats, mode, playType)
// saveData = save.data,  achStats = saveData.achStats
const M = {
  /* Accumulated counts */
  gamesPlayed:     (s)       => s.gamesPlayed || 0,
  modeGames:       (s,a,m)   => a.modeGames[m] || 0,
  ptGames:         (s,a,m,p) => a.playTypeGames[p] || 0,
  mpGames:         (s,a,m,p) => a.modePlayTypeGames[`${m}_${p}`] || 0,
  totalCorrect:    (s,a)     => a.totalCorrect || 0,
  modeCorrect:     (s,a,m)   => a.modeCorrect[m] || 0,
  totalScoreAccum: (s,a)     => a.totalScoreAccum || 0,
  modeScoreAccum:  (s,a,m)   => a.modeScoreAccum[m] || 0,
  mpScoreAccum:    (s,a,m,p) => a.modePlayTypeScoreAccum[`${m}_${p}`] || 0,
  goldenCaught:    (s,a)     => a.goldenCaught || 0,
  diamondCaught:   (s,a)     => a.diamondCaught || 0,
  feverTriggered:  (s,a)     => a.feverTriggered || 0,
  perfectGames:    (s,a)     => a.perfectGames || 0,
  modePerfectGames:(s,a,m)   => a.modePerfectGames[m] || 0,
  playtimeMin:     (s,a)     => Math.floor((a.totalPlaytimeSec || 0) / 60),
  dailyGameCount:  (s,a)     => a.dailyGameCount || 0,
  brainGames:      (s,a)     => a.brainGames || 0,
  sortGames:       (s,a)     => a.sortGames || 0,
  modesPlayed:     (s,a)     => (a.modesPlayed || []).length,
  combosPlayed:    (s,a)     => (a.combosPlayed || []).length,
  sessionMax:      (s,a)     => a.sessionMaxGames || 0,

  /* Best-ever per-game values */
  bestStreak:      (s,a)     => a.bestStreak || 0,
  modeBestStreak:  (s,a,m)   => a.modeBestStreak[m] || 0,
  ptBestStreak:    (s,a,m,p) => a.playTypeBestStreak[p] || 0,
  bestReaction:    (s,a)     => a.bestReaction === 9999 ? 0 : a.bestReaction,
  modeBestReaction:(s,a,m)   => (a.modeBestReaction[m] || 9999) === 9999 ? 0 : a.modeBestReaction[m],
  maxMult:         (s,a)     => a.maxMultiplier || 0,
  bestPerfectT:    (s,a)     => a.bestPerfectTotal || 0,
  modeBestPerfT:   (s,a,m)   => a.modeBestPerfectTotal[m] || 0,
  bestSharpT:      (s,a)     => a.bestSharpTotal || 0,
  modeBestSharpT:  (s,a,m)   => a.modeBestSharpTotal[m] || 0,
  bestScoreHiAcc:  (s,a)     => a.bestScoreWithHighAcc || 0,

  /* PBs from save */
  anyPB:        (s) => Math.max(0, ...[s.pb_klassik,s.pb_beginner,s.pb_expert,s.pb_ultra,s.pb_mathe,s.pb_worte,s.pb_memo,s.pb_sequenz,s.pb_stroop,s.pb_fokus,s.pb_chaos,s.pb_hauptstaedte,s.pb_algebra].map(v=>v||0)),
  modePB:       (s,a,m)   => s[`pb_${m}`] || 0,
  ptBestScore:  (s,a,m,p) => a.playTypeBestScore[p] || 0,
  mpBestScore:  (s,a,m,p) => a.modePlayTypeBestScore[`${m}_${p}`] || 0,
  endlessPBAny: (s) => Math.max(0, ...ALL_MODES.map(m => s[`pb_endless_${m}`] || 0)),
  endlessPB:    (s,a,m)   => s[`pb_endless_${m}`] || 0,

  /* Progression */
  level:          (s) => s.level || 0,
  totalXP:        (s) => s.totalXP || 0,
  compLevel:      (s) => s.competitionLevel || 0,
  compStars:      (s) => (s.competitionStars || []).reduce((a,b) => a + b, 0),
  dailyChallenges:(s) => Object.keys(s.dailyChallenges || {}).length,
  loginStreak:    (s) => s.loginStreak || 0,

  /* Derived cross-mode */
  brainPBMin: (s) => {
    const vals = BRAIN_MODES.map(m => s[`pb_${m}`] || 0).filter(v => v > 0);
    return vals.length === BRAIN_MODES.length ? Math.min(...vals) : 0;
  },
  sortPBMin: (s) => {
    const vals = SORT_MODES.map(m => s[`pb_${m}`] || 0).filter(v => v > 0);
    return vals.length === SORT_MODES.length ? Math.min(...vals) : 0;
  },
  reflexPBMin: (s) => {
    const vals = REFLEX_MODES.map(m => s[`pb_${m}`] || 0).filter(v => v > 0);
    return vals.length === REFLEX_MODES.length ? Math.min(...vals) : 0;
  },
};

// ── Template Definitions ────────────────────────────────────────
// Each template produces: modes.length * playTypes.length * thresholds.length achievements
// Fields:
//   id          - base id prefix
//   cat         - category id
//   metric      - key into M resolver
//   T           - threshold array
//   modes       - optional array of modes (cross-product)
//   pts         - optional array of play types (cross-product)
//   cmp         - 'gte' (default) or 'lte'
//   name/desc   - {de,en} patterns with {n}, {mode}, {pt}
const TEMPLATES = [

  // ═══════════ MILESTONES ═══════════
  { id:'games_total', cat:'milestones', metric:'gamesPlayed',
    T:[3,5,10,25,50,100,250,500,1000,2500,5000,10000],
    name:{ de:'{n} Spiele', en:'{n} Games' },
    desc:{ de:'Spiele insgesamt {n} Runden', en:'Play {n} total games' }},

  { id:'games_m', cat:'milestones', metric:'modeGames',
    modes:ALL_MODES, T:[3,10,25,50,100,250,500,1000],
    name:{ de:'{n}x {mode}', en:'{n}x {mode}' },
    desc:{ de:'{n} Runden im {mode}-Modus', en:'{n} games in {mode} mode' }},

  { id:'games_pt', cat:'milestones', metric:'ptGames',
    pts:ALL_PLAY_TYPES, T:[3,10,25,50,100,250,500],
    name:{ de:'{n}x {pt}', en:'{n}x {pt}' },
    desc:{ de:'{n} Runden im {pt}-Modus', en:'{n} {pt} games' }},

  { id:'games_mp', cat:'milestones', metric:'mpGames',
    modes:ALL_MODES, pts:ALL_PLAY_TYPES, T:[5,25,50,100],
    name:{ de:'{n}x {mode} {pt}', en:'{n}x {mode} {pt}' },
    desc:{ de:'{n}x {mode} im {pt}-Modus', en:'{n}x {mode} in {pt}' }},

  // ═══════════ SCORES ═══════════
  { id:'score_any', cat:'scores', metric:'anyPB',
    T:[500,1000,2500,5000,10000,20000,50000,100000],
    name:{ de:'{n} Punkte', en:'{n} Points' },
    desc:{ de:'Erreiche {n} Punkte', en:'Score {n} points' }},

  { id:'score_m', cat:'scores', metric:'modePB',
    modes:ALL_MODES, T:[500,1000,2500,5000,10000,25000,50000],
    name:{ de:'{n} in {mode}', en:'{n} in {mode}' },
    desc:{ de:'{n} Punkte im {mode}-Modus', en:'{n} points in {mode}' }},

  { id:'score_pt', cat:'scores', metric:'ptBestScore',
    pts:ALL_PLAY_TYPES, T:[500,1000,2500,5000,10000,25000],
    name:{ de:'{n} im {pt}', en:'{n} in {pt}' },
    desc:{ de:'{n} Punkte im {pt}-Modus', en:'{n} points in {pt}' }},

  { id:'score_mp', cat:'scores', metric:'mpBestScore',
    modes:ALL_MODES, pts:ALL_PLAY_TYPES, T:[1000,5000,10000],
    name:{ de:'{n} {mode}/{pt}', en:'{n} {mode}/{pt}' },
    desc:{ de:'{n} Punkte in {mode} {pt}', en:'{n} pts in {mode} {pt}' }},

  // ═══════════ STREAKS ═══════════
  { id:'streak_any', cat:'streaks', metric:'bestStreak',
    T:[5,10,15,20,25,30,40,50,75,100],
    name:{ de:'{n}er Serie', en:'{n} Streak' },
    desc:{ de:'Erreiche eine {n}er Serie', en:'Reach a {n} streak' }},

  { id:'streak_m', cat:'streaks', metric:'modeBestStreak',
    modes:ALL_MODES, T:[5,10,15,20,25,30,40,50],
    name:{ de:'{n}er in {mode}', en:'{n} in {mode}' },
    desc:{ de:'{n}er Serie in {mode}', en:'{n} streak in {mode}' }},

  { id:'streak_pt', cat:'streaks', metric:'ptBestStreak',
    pts:ALL_PLAY_TYPES, T:[5,10,20,30,50],
    name:{ de:'{n}er im {pt}', en:'{n} in {pt}' },
    desc:{ de:'{n}er Serie im {pt}-Modus', en:'{n} streak in {pt}' }},

  // ═══════════ PRECISION ═══════════
  { id:'perf_t', cat:'precision', metric:'bestPerfectT',
    T:[5,10,15,20,25,30,40,50],
    name:{ de:'Perfekt x{n}', en:'Perfect x{n}' },
    desc:{ de:'100% Genauigkeit mit {n}+ Wischern', en:'100% accuracy with {n}+ swipes' }},

  { id:'sharp_t', cat:'precision', metric:'bestSharpT',
    T:[10,20,30,50,75,100],
    name:{ de:'Scharfschütze x{n}', en:'Sharpshooter x{n}' },
    desc:{ de:'95%+ Genauigkeit mit {n}+ Wischern', en:'95%+ accuracy with {n}+ swipes' }},

  { id:'perf_m', cat:'precision', metric:'modeBestPerfT',
    modes:ALL_MODES, T:[5,10,20,30],
    name:{ de:'Perfekt {mode} x{n}', en:'Perfect {mode} x{n}' },
    desc:{ de:'100% in {mode} mit {n}+ Wischern', en:'100% in {mode} with {n}+ swipes' }},

  { id:'sharp_m', cat:'precision', metric:'modeBestSharpT',
    modes:ALL_MODES, T:[10,20,30,50],
    name:{ de:'Scharf {mode} x{n}', en:'Sharp {mode} x{n}' },
    desc:{ de:'95%+ in {mode} mit {n}+ Wischern', en:'95%+ in {mode} with {n}+ swipes' }},

  // ═══════════ SPEED ═══════════
  { id:'react_fast', cat:'speed', metric:'bestReaction', cmp:'lte',
    T:[600,500,450,400,350,300,250,200],
    name:{ de:'Blitz {n}ms', en:'Lightning {n}ms' },
    desc:{ de:'Durchschnitt {n}ms Reaktion (10+ Wischer)', en:'Average {n}ms reaction (10+ swipes)' }},

  { id:'react_m', cat:'speed', metric:'modeBestReaction', cmp:'lte',
    modes:ALL_MODES, T:[600,500,400,350,300],
    name:{ de:'{n}ms in {mode}', en:'{n}ms in {mode}' },
    desc:{ de:'Durchschnitt {n}ms in {mode}', en:'Average {n}ms in {mode}' }},

  // ═══════════ MODES ═══════════
  { id:'mode_first', cat:'modes', metric:'modeGames',
    modes:ALL_MODES, T:[3],
    name:{ de:'{mode} entdeckt', en:'{mode} Discovered' },
    desc:{ de:'Spiele {mode} dreimal', en:'Play {mode} three times' }},

  { id:'modes_all', cat:'modes', metric:'modesPlayed',
    T:[7],
    name:{ de:'Allrounder', en:'All-Rounder' },
    desc:{ de:'Spiele alle 7 Modi', en:'Play all 7 modes' }},

  { id:'combos_all', cat:'modes', metric:'combosPlayed',
    T:[28],
    name:{ de:'Sammler', en:'Collector' },
    desc:{ de:'Spiele alle 28 Modus/Typ-Kombinationen', en:'Play all 28 mode/type combos' }},

  { id:'brain_total', cat:'modes', metric:'brainGames',
    T:[10,25,50,100,250,500],
    name:{ de:'{n}x Brain', en:'{n}x Brain' },
    desc:{ de:'{n} Brain-Modus-Spiele', en:'{n} brain mode games' }},

  { id:'sort_total', cat:'modes', metric:'sortGames',
    T:[10,25,50,100,250,500],
    name:{ de:'{n}x Sort', en:'{n}x Sort' },
    desc:{ de:'{n} Sort-Modus-Spiele', en:'{n} sort mode games' }},

  // ═══════════ ENDLESS ═══════════
  { id:'endl_any', cat:'endless', metric:'endlessPBAny',
    T:[10,25,50,75,100,150,200,300,500],
    name:{ de:'Endlos {n} richtig', en:'Endless {n} Correct' },
    desc:{ de:'{n} Treffer im Endlos-Modus', en:'{n} correct in endless' }},

  { id:'endl_m', cat:'endless', metric:'endlessPB',
    modes:ALL_MODES, T:[10,25,50,100,200],
    name:{ de:'Endlos {mode} {n}', en:'Endless {mode} {n}' },
    desc:{ de:'{n} Treffer in Endlos {mode}', en:'{n} correct in endless {mode}' }},

  // ═══════════ COMPETITION ═══════════
  { id:'comp_lvl', cat:'competition', metric:'compLevel',
    T:[1,2,3,5,7,10],
    name:{ de:'Wettkampf Lv{n}', en:'Competition Lv{n}' },
    desc:{ de:'Wettkampf-Level {n} abgeschlossen', en:'Clear competition level {n}' }},

  { id:'comp_star', cat:'competition', metric:'compStars',
    T:[5,10,15,20,25,30],
    name:{ de:'{n} Sterne', en:'{n} Stars' },
    desc:{ de:'{n} Wettkampf-Sterne gesammelt', en:'Collect {n} competition stars' }},

  // ═══════════ BONUSES ═══════════
  { id:'golden', cat:'bonuses', metric:'goldenCaught',
    T:[3,5,10,25,50,100,250,500],
    name:{ de:'{n}x Gold', en:'{n}x Golden' },
    desc:{ de:'{n} goldene Items gefangen', en:'Catch {n} golden items' }},

  { id:'diamond_c', cat:'bonuses', metric:'diamondCaught',
    T:[3,5,10,25,50,100,250],
    name:{ de:'{n}x Diamant', en:'{n}x Diamond' },
    desc:{ de:'{n} Diamanten gefangen', en:'Catch {n} diamonds' }},

  { id:'fever_c', cat:'bonuses', metric:'feverTriggered',
    T:[3,5,10,25,50,100,250],
    name:{ de:'{n}x Fever', en:'{n}x Fever' },
    desc:{ de:'Fever-Modus {n}x ausgelöst', en:'Trigger fever {n} times' }},

  // ═══════════ PROGRESSION ═══════════
  { id:'lvl', cat:'progression', metric:'level',
    T:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
    name:{ de:'Level {n}', en:'Level {n}' },
    desc:{ de:'Erreiche Level {n}', en:'Reach level {n}' }},

  { id:'xp_total', cat:'progression', metric:'totalXP',
    T:[100,500,1000,5000,10000,50000,100000,500000,1000000,5000000,10000000],
    name:{ de:'{n} XP', en:'{n} XP' },
    desc:{ de:'{n} XP insgesamt verdient', en:'Earn {n} total XP' }},

  // ═══════════ DAILY ═══════════
  { id:'daily_ch', cat:'daily', metric:'dailyChallenges',
    T:[1,3,7,14,30,60,100,200,365],
    name:{ de:'{n} Tagesaufgaben', en:'{n} Dailies' },
    desc:{ de:'{n} Tagesaufgaben abgeschlossen', en:'Complete {n} daily challenges' }},

  { id:'login_str', cat:'daily', metric:'loginStreak',
    T:[3,7,14,30,60,100,365],
    name:{ de:'{n} Tage Login', en:'{n} Day Login' },
    desc:{ de:'{n} Tage Login-Serie', en:'{n} day login streak' }},

  { id:'daily_gm', cat:'daily', metric:'dailyGameCount',
    T:[3,5,10,20,30,50],
    name:{ de:'{n} Spiele heute', en:'{n} Games Today' },
    desc:{ de:'{n} Runden an einem Tag', en:'{n} games in one day' }},

  // ═══════════ CUMULATIVE ═══════════
  { id:'cum_correct', cat:'cumulative', metric:'totalCorrect',
    T:[100,500,1000,5000,10000,50000,100000,500000],
    name:{ de:'{n} Treffer', en:'{n} Correct' },
    desc:{ de:'{n} richtige Wischer insgesamt', en:'{n} total correct swipes' }},

  { id:'cum_score', cat:'cumulative', metric:'totalScoreAccum',
    T:[10000,50000,100000,500000,1000000,5000000,10000000],
    name:{ de:'{n} Gesamtpunkte', en:'{n} Total Score' },
    desc:{ de:'{n} kumulative Punkte', en:'Accumulate {n} total points' }},

  { id:'cum_score_m', cat:'cumulative', metric:'modeScoreAccum',
    modes:ALL_MODES, T:[10000,50000,100000,500000,1000000],
    name:{ de:'{n} Ges. {mode}', en:'{n} Tot. {mode}' },
    desc:{ de:'{n} kumulative Punkte in {mode}', en:'{n} cumulative pts in {mode}' }},

  { id:'cum_corr_m', cat:'cumulative', metric:'modeCorrect',
    modes:ALL_MODES, T:[100,500,1000,5000,10000],
    name:{ de:'{n} Treffer {mode}', en:'{n} Correct {mode}' },
    desc:{ de:'{n} Treffer in {mode}', en:'{n} correct in {mode}' }},

  { id:'cum_score_mp', cat:'cumulative', metric:'mpScoreAccum',
    modes:ALL_MODES, pts:ALL_PLAY_TYPES, T:[10000,50000],
    name:{ de:'{n} {mode}/{pt}', en:'{n} {mode}/{pt}' },
    desc:{ de:'{n} Punkte in {mode} {pt}', en:'{n} pts in {mode} {pt}' }},

  // ═══════════ MASTERY ═══════════
  { id:'max_mult', cat:'mastery', metric:'maxMult',
    T:[2,3,4,5,6,7,8],
    name:{ de:'{n}x Multiplikator', en:'{n}x Multiplier' },
    desc:{ de:'Multiplikator {n}x erreicht', en:'Reach {n}x multiplier' }},

  { id:'score_acc', cat:'mastery', metric:'bestScoreHiAcc',
    T:[1000,2500,5000,10000,25000,50000],
    name:{ de:'{n}+ bei 95%', en:'{n}+ at 95%' },
    desc:{ de:'{n}+ Punkte mit 95%+ Genauigkeit', en:'{n}+ points with 95%+ accuracy' }},

  { id:'perf_game_m', cat:'mastery', metric:'modePerfectGames',
    modes:ALL_MODES, T:[1,3,5,10],
    name:{ de:'Perfekt {mode} x{n}', en:'Perfect Game {mode} x{n}' },
    desc:{ de:'{n}x Perfektes Spiel in {mode}', en:'{n}x perfect game in {mode}' }},

  { id:'brain_mstr', cat:'mastery', metric:'brainPBMin',
    T:[1000,5000,10000],
    name:{ de:'Brain-Meister {n}+', en:'Brain Master {n}+' },
    desc:{ de:'{n}+ in allen Brain-Modi', en:'{n}+ in all brain modes' }},

  { id:'sort_mstr', cat:'mastery', metric:'sortPBMin',
    T:[1000,5000,10000],
    name:{ de:'Sort-Meister {n}+', en:'Sort Master {n}+' },
    desc:{ de:'{n}+ in allen Sort-Modi', en:'{n}+ in all sort modes' }},

  { id:'session_gm', cat:'mastery', metric:'sessionMax',
    T:[3,5,10,15,25,50],
    name:{ de:'{n} in einer Session', en:'{n} in One Session' },
    desc:{ de:'{n} Runden in einer Session', en:'{n} games in one session' }},

  { id:'playtime', cat:'mastery', metric:'playtimeMin',
    T:[10,30,60,180,600,1200,3000],
    name:{ de:'{n} Minuten Spielzeit', en:'{n} Min Playtime' },
    desc:{ de:'{n} Minuten Gesamtspielzeit', en:'{n} minutes total playtime' }},

  // ═══════════ ADDITIONAL (to reach 1000+) ═══════════

  /* Endless score per mode (via achStats playTypeBestScore won't work per-mode;
     use modePlayTypeBestScore with pt='endless') */
  { id:'endl_score_m', cat:'endless', metric:'mpBestScore',
    modes:ALL_MODES, pts:['endless'], T:[1000,2500,5000,10000],
    name:{ de:'Endlos {mode} {n}P', en:'Endless {mode} {n}pts' },
    desc:{ de:'{n} Punkte in Endlos {mode}', en:'{n} points in endless {mode}' }},

  /* Streak in mode+playtype combos (narrow cross-product) */
  { id:'streak_mp', cat:'streaks', metric:'modeBestStreak',
    modes:ALL_MODES, T:[10,25],
    name:{ de:'{n}er Serie {mode}', en:'{n} Streak {mode}' },
    desc:{ de:'{n}er Serie in {mode}', en:'{n} streak in {mode}' }},

  /* Golden/Diamond per mode (via achStats -- need tracking; approximate with mode games) */
  { id:'golden_m', cat:'bonuses', metric:'goldenCaught',
    T:[10,25,50,100,250],
    name:{ de:'{n}x Gold gesamt', en:'{n}x Golden Total' },
    desc:{ de:'{n} goldene Items insgesamt', en:'{n} golden items total' }},

  /* Score milestones per play type with higher thresholds */
  { id:'score_pt_hi', cat:'scores', metric:'ptBestScore',
    pts:ALL_PLAY_TYPES, T:[50000,100000],
    name:{ de:'{n} im {pt}!', en:'{n} in {pt}!' },
    desc:{ de:'{n} Punkte im {pt}-Modus!', en:'{n} points in {pt} mode!' }},

  /* Accuracy in specific play types */
  { id:'sharp_pt', cat:'precision', metric:'bestSharpT',
    T:[15,25,40,60],
    name:{ de:'Präzise x{n}', en:'Precise x{n}' },
    desc:{ de:'95%+ Genauigkeit mit {n}+ Wischern', en:'95%+ accuracy with {n}+ swipes' }},

  /* Mode games at higher thresholds */
  { id:'games_m_hi', cat:'milestones', metric:'modeGames',
    modes:ALL_MODES, T:[2500,5000],
    name:{ de:'{n}x {mode}!', en:'{n}x {mode}!' },
    desc:{ de:'{n} Runden im {mode}-Modus!', en:'{n} games in {mode}!' }},

  /* Cumulative correct all-time (higher tiers) */
  { id:'cum_corr_hi', cat:'cumulative', metric:'totalCorrect',
    T:[1000000,2500000,5000000],
    name:{ de:'{n} Treffer!', en:'{n} Correct!' },
    desc:{ de:'{n} richtige Wischer insgesamt!', en:'{n} total correct swipes!' }},

  /* Diamond catches extended */
  { id:'diamond_hi', cat:'bonuses', metric:'diamondCaught',
    T:[500,1000],
    name:{ de:'{n}x Diamant!', en:'{n}x Diamond!' },
    desc:{ de:'{n} Diamanten insgesamt!', en:'{n} diamonds total!' }},

  /* Perfect games global */
  { id:'perf_game_g', cat:'mastery', metric:'perfectGames',
    T:[3,5,10,25,50,100],
    name:{ de:'{n}x Perfekt', en:'{n}x Perfect' },
    desc:{ de:'{n} Spiele mit 100% Genauigkeit', en:'{n} games with 100% accuracy' }},
];


// ══════════════════════════════════════════════════════════════════
//  GENERATION
// ══════════════════════════════════════════════════════════════════

let _cache = null;
let _chainIndex = null;   // templateBaseId -> [achIds in order]
let _byId = null;         // achId -> achievement object

function buildId(base, mode, pt, threshold) {
  let id = base;
  if (mode) id += `_${mode}`;
  if (pt)   id += `_${pt}`;
  id += `_${threshold}`;
  return id;
}

function buildChainKey(base, mode, pt) {
  let k = base;
  if (mode) k += `_${mode}`;
  if (pt)   k += `_${pt}`;
  return k;
}

function buildText(pattern, threshold, mode, pt, lang) {
  let s = pattern[lang] || pattern.en || '';
  s = s.replace(/\{n\}/g, fmtN(threshold, lang));
  if (mode) s = s.replace(/\{mode\}/g, MODE_NAMES[lang]?.[mode] || mode);
  if (pt)   s = s.replace(/\{pt\}/g, PT_NAMES[lang]?.[pt] || pt);
  return s;
}

/**
 * Generate all achievements from templates.
 * Returns a flat array of achievement objects.
 * Each object: { id, templateId, chainKey, cat, tier, threshold,
 *                mode, pt, name:{de,en}, desc:{de,en}, metric, cmp,
 *                chainIndex, chainLength, nextThreshold }
 */
export function generateAchievements() {
  if (_cache) return _cache;

  const list = [];
  _chainIndex = {};

  for (const tmpl of TEMPLATES) {
    const modes = tmpl.modes || [null];
    const playTypes = tmpl.pts || [null];

    for (const mode of modes) {
      for (const pt of playTypes) {
        const chainKey = buildChainKey(tmpl.id, mode, pt);
        _chainIndex[chainKey] = [];

        for (let i = 0; i < tmpl.T.length; i++) {
          const threshold = tmpl.T[i];
          const id = buildId(tmpl.id, mode, pt, threshold);
          const tier = assignTier(i, tmpl.T.length);

          const ach = {
            id,
            templateId: tmpl.id,
            chainKey,
            cat: tmpl.cat,
            tier,
            threshold,
            mode: mode || null,
            pt: pt || null,
            name: {
              de: buildText(tmpl.name, threshold, mode, pt, 'de'),
              en: buildText(tmpl.name, threshold, mode, pt, 'en'),
            },
            desc: {
              de: buildText(tmpl.desc, threshold, mode, pt, 'de'),
              en: buildText(tmpl.desc, threshold, mode, pt, 'en'),
            },
            metric: tmpl.metric,
            cmp: tmpl.cmp || 'gte',
            chainIndex: i,
            chainLength: tmpl.T.length,
            nextThreshold: i < tmpl.T.length - 1 ? tmpl.T[i + 1] : null,
          };

          list.push(ach);
          _chainIndex[chainKey].push(id);
        }
      }
    }
  }

  _cache = list;
  _byId = {};
  for (const a of list) _byId[a.id] = a;

  return list;
}

/** Get a single achievement by id */
export function getAchById(id) {
  if (!_byId) generateAchievements();
  return _byId[id] || null;
}

/** Get the chain index map (chainKey -> [id, id, ...]) */
export function getChainIndex() {
  if (!_chainIndex) generateAchievements();
  return _chainIndex;
}

/** Total number of achievements */
export function getTotalCount() {
  return generateAchievements().length;
}


// ══════════════════════════════════════════════════════════════════
//  CHECKING
// ══════════════════════════════════════════════════════════════════

/**
 * Check a single achievement against current data.
 * @param {object} ach - achievement object from generateAchievements()
 * @param {object} saveData - save.data (the full save object)
 * @returns {boolean}
 */
export function isAchievementMet(ach, saveData) {
  const achStats = saveData.achStats || initAchStats();
  const metricFn = M[ach.metric];
  if (!metricFn) return false;

  const value = metricFn(saveData, achStats, ach.mode, ach.pt);

  if (ach.cmp === 'lte') {
    // For "less-than" metrics (reaction time): value must be > 0 AND <= threshold
    return value > 0 && value <= ach.threshold;
  }
  return value >= ach.threshold;
}

/**
 * Check all achievements. Returns array of newly-unlocked ids.
 * @param {object} saveData - save.data
 * @returns {string[]} newly unlocked achievement ids
 */
export function checkAllAchievements(saveData) {
  const all = generateAchievements();
  const earned = new Set(saveData.achievements || []);
  const newlyUnlocked = [];

  for (const ach of all) {
    if (earned.has(ach.id)) continue;
    if (isAchievementMet(ach, saveData)) {
      newlyUnlocked.push(ach.id);
      earned.add(ach.id);
    }
  }

  // Persist new unlocks
  if (newlyUnlocked.length) {
    saveData.achievements = [...earned];
  }

  return newlyUnlocked;
}

/**
 * Get progress for a single achievement.
 * Returns { current, target, pct, met }
 */
export function getProgress(ach, saveData) {
  const achStats = saveData.achStats || initAchStats();
  const metricFn = M[ach.metric];
  if (!metricFn) return { current: 0, target: ach.threshold, pct: 0, met: false };

  const value = metricFn(saveData, achStats, ach.mode, ach.pt);
  const target = ach.threshold;

  if (ach.cmp === 'lte') {
    // For reaction time: progress goes from high to low
    // If not yet recorded (value === 0), show 0%
    if (value <= 0) return { current: 0, target, pct: 0, met: false };
    const met = value <= target;
    // Use 800 as a reasonable "starting" reaction time
    const maxStart = 800;
    const pct = met ? 1 : Math.max(0, Math.min(1, (maxStart - value) / (maxStart - target)));
    return { current: value, target, pct, met };
  }

  const pct = target > 0 ? Math.min(1, value / target) : (value > 0 ? 1 : 0);
  return { current: value, target, pct, met: value >= target };
}

/**
 * Get progress summary for a chain.
 * Returns { earned, total, nextAch, nextProgress }
 */
export function getChainProgress(chainKey, saveData) {
  const chain = _chainIndex?.[chainKey];
  if (!chain) return { earned: 0, total: 0, nextAch: null, nextProgress: null };

  const earnedSet = new Set(saveData.achievements || []);
  let earned = 0;
  let nextAch = null;

  for (const id of chain) {
    if (earnedSet.has(id)) {
      earned++;
    } else if (!nextAch) {
      nextAch = _byId[id];
    }
  }

  const nextProgress = nextAch ? getProgress(nextAch, saveData) : null;
  return { earned, total: chain.length, nextAch, nextProgress };
}


// ══════════════════════════════════════════════════════════════════
//  ACH-STATS TRACKING
// ══════════════════════════════════════════════════════════════════

/** Create a new blank achStats object */
export function initAchStats() {
  return {
    modeGames: {},
    playTypeGames: {},
    modePlayTypeGames: {},
    totalCorrect: 0,
    modeCorrect: {},
    totalScoreAccum: 0,
    modeScoreAccum: {},
    modePlayTypeScoreAccum: {},
    goldenCaught: 0,
    diamondCaught: 0,
    feverTriggered: 0,
    perfectGames: 0,
    modePerfectGames: {},
    totalPlaytimeSec: 0,
    bestStreak: 0,
    modeBestStreak: {},
    playTypeBestStreak: {},
    bestReaction: 9999,
    modeBestReaction: {},
    maxMultiplier: 0,
    bestPerfectTotal: 0,
    modeBestPerfectTotal: {},
    bestSharpTotal: 0,
    modeBestSharpTotal: {},
    bestScoreWithHighAcc: 0,
    playTypeBestScore: {},
    modePlayTypeBestScore: {},
    brainGames: 0,
    sortGames: 0,
    reflexGames: 0,
    modesPlayed: [],
    combosPlayed: [],
    dailyGameDate: '',
    dailyGameCount: 0,
    sessionMaxGames: 0,
  };
}

/**
 * Ensure achStats exists on saveData and patch missing fields.
 */
export function ensureAchStats(saveData) {
  if (!saveData.achStats) {
    saveData.achStats = initAchStats();
    /* Seed from existing save data for backward compat */
    _seedFromExistingSave(saveData);
  }
  // Patch any missing keys (save may be from older version)
  const defaults = initAchStats();
  for (const key of Object.keys(defaults)) {
    if (saveData.achStats[key] === undefined) {
      saveData.achStats[key] = defaults[key];
    }
  }
  return saveData.achStats;
}

/**
 * Seed achStats from existing save data (backward compat migration).
 * Called once when achStats is first created.
 */
function _seedFromExistingSave(saveData) {
  const a = saveData.achStats;

  // Total games -> rough distribute (we don't know per-mode, but set totals)
  // We can scan score history per mode
  for (const mode of ALL_MODES) {
    const scores = saveData[`scores_${mode}`] || [];
    a.modeGames[mode] = scores.length;

    // Accumulate score totals from history
    let scoreSum = 0;
    for (const entry of scores) {
      scoreSum += entry.score || 0;
      if (entry.playType) {
        a.playTypeGames[entry.playType] = (a.playTypeGames[entry.playType] || 0) + 1;
        const combo = `${mode}_${entry.playType}`;
        a.modePlayTypeGames[combo] = (a.modePlayTypeGames[combo] || 0) + 1;
        a.modePlayTypeScoreAccum[combo] = (a.modePlayTypeScoreAccum[combo] || 0) + (entry.score || 0);
        a.playTypeBestScore[entry.playType] = Math.max(a.playTypeBestScore[entry.playType] || 0, entry.score || 0);
        a.modePlayTypeBestScore[combo] = Math.max(a.modePlayTypeBestScore[combo] || 0, entry.score || 0);
        a.playTypeBestStreak[entry.playType] = Math.max(a.playTypeBestStreak[entry.playType] || 0, entry.streak || 0);
      }
      a.modeBestStreak[mode] = Math.max(a.modeBestStreak[mode] || 0, entry.streak || 0);
      a.bestStreak = Math.max(a.bestStreak, entry.streak || 0);
      if (entry.accuracy && entry.accuracy === 100) {
        a.modePerfectGames[mode] = (a.modePerfectGames[mode] || 0) + 1;
        a.perfectGames++;
      }
      if (entry.avgReaction && entry.avgReaction > 0) {
        a.modeBestReaction[mode] = Math.min(a.modeBestReaction[mode] || 9999, entry.avgReaction);
        a.bestReaction = Math.min(a.bestReaction, entry.avgReaction);
      }
    }
    a.modeScoreAccum[mode] = scoreSum;
    a.totalScoreAccum += scoreSum;

    if (scores.length > 0 && !a.modesPlayed.includes(mode)) {
      a.modesPlayed.push(mode);
    }
  }

  // Brain/Sort/Reflex counts
  a.brainGames = BRAIN_MODES.reduce((sum, m) => sum + (a.modeGames[m] || 0), 0);
  a.sortGames  = SORT_MODES.reduce((sum, m) => sum + (a.modeGames[m] || 0), 0);
  a.reflexGames = REFLEX_MODES.reduce((sum, m) => sum + (a.modeGames[m] || 0), 0);
  a.memoryGames = MEMORY_MODES.reduce((sum, m) => sum + (a.modeGames[m] || 0), 0);
}

/**
 * Update achStats after a game ends.
 * @param {object} gameStats - stats from GameEngine._buildStats() (extended)
 * @param {object} saveData  - save.data
 * @param {number} sessionGames - current session game count (app.sessionGames)
 */
export function updateAchStats(gameStats, saveData, sessionGames) {
  const a = ensureAchStats(saveData);
  const mode = gameStats.mode;
  const pt   = gameStats.playType || 'blitz';
  const combo = `${mode}_${pt}`;

  // ── Game counts ──
  a.modeGames[mode] = (a.modeGames[mode] || 0) + 1;
  a.playTypeGames[pt] = (a.playTypeGames[pt] || 0) + 1;
  a.modePlayTypeGames[combo] = (a.modePlayTypeGames[combo] || 0) + 1;

  // ── Correct & Score accumulation ──
  a.totalCorrect += gameStats.correct || 0;
  a.modeCorrect[mode] = (a.modeCorrect[mode] || 0) + (gameStats.correct || 0);
  a.totalScoreAccum += gameStats.score || 0;
  a.modeScoreAccum[mode] = (a.modeScoreAccum[mode] || 0) + (gameStats.score || 0);
  a.modePlayTypeScoreAccum[combo] = (a.modePlayTypeScoreAccum[combo] || 0) + (gameStats.score || 0);

  // ── Best-ever per-game values ──
  a.bestStreak = Math.max(a.bestStreak, gameStats.streak || 0);
  a.modeBestStreak[mode] = Math.max(a.modeBestStreak[mode] || 0, gameStats.streak || 0);
  a.playTypeBestStreak[pt] = Math.max(a.playTypeBestStreak[pt] || 0, gameStats.streak || 0);
  a.maxMultiplier = Math.max(a.maxMultiplier, gameStats.maxMultiplier || 1);

  if (gameStats.total >= 10 && gameStats.avgReaction > 0 && gameStats.avgReaction < 9999) {
    a.bestReaction = Math.min(a.bestReaction, gameStats.avgReaction);
    a.modeBestReaction[mode] = Math.min(a.modeBestReaction[mode] || 9999, gameStats.avgReaction);
  }

  // ── PB per play type & mode+playtype ──
  a.playTypeBestScore[pt] = Math.max(a.playTypeBestScore[pt] || 0, gameStats.score || 0);
  a.modePlayTypeBestScore[combo] = Math.max(a.modePlayTypeBestScore[combo] || 0, gameStats.score || 0);

  // ── Perfect games (100% accuracy, 10+ swipes) ──
  if (gameStats.accuracy === 100 && gameStats.total >= 10) {
    a.perfectGames++;
    a.modePerfectGames[mode] = (a.modePerfectGames[mode] || 0) + 1;
    a.bestPerfectTotal = Math.max(a.bestPerfectTotal, gameStats.total);
    a.modeBestPerfectTotal[mode] = Math.max(a.modeBestPerfectTotal[mode] || 0, gameStats.total);
  }

  // ── Sharpshooter (95%+ accuracy, 10+ swipes) ──
  if (gameStats.accuracy >= 95 && gameStats.total >= 10) {
    a.bestSharpTotal = Math.max(a.bestSharpTotal, gameStats.total);
    a.modeBestSharpTotal[mode] = Math.max(a.modeBestSharpTotal[mode] || 0, gameStats.total);
  }
  if (gameStats.accuracy >= 95 && gameStats.score > 0) {
    a.bestScoreWithHighAcc = Math.max(a.bestScoreWithHighAcc, gameStats.score);
  }

  // ── Bonus tracking (extended stats from GameEngine) ──
  a.goldenCaught  += gameStats.goldenCaught  || 0;
  a.diamondCaught += gameStats.diamondCaught || 0;
  a.feverTriggered += gameStats.feverTriggered || 0;

  // ── Playtime ──
  const gameDuration = gameStats.elapsed || _estimateDuration(pt);
  a.totalPlaytimeSec += gameDuration;

  // ── Daily game count ──
  const today = new Date().toISOString().slice(0, 10);
  if (a.dailyGameDate !== today) {
    a.dailyGameDate = today;
    a.dailyGameCount = 0;
  }
  a.dailyGameCount++;

  // ── Session tracking ──
  a.sessionMaxGames = Math.max(a.sessionMaxGames, sessionGames || 0);

  // ── Brain / Sort / Reflex / Memory counts ──
  if (BRAIN_MODES.includes(mode)) a.brainGames = (a.brainGames || 0) + 1;
  if (SORT_MODES.includes(mode))  a.sortGames  = (a.sortGames  || 0) + 1;
  if (REFLEX_MODES.includes(mode)) a.reflexGames = (a.reflexGames || 0) + 1;
  if (MEMORY_MODES.includes(mode)) a.memoryGames = (a.memoryGames || 0) + 1;

  // ── Modes & combos played ──
  if (!a.modesPlayed) a.modesPlayed = [];
  if (!a.combosPlayed) a.combosPlayed = [];
  if (!a.modesPlayed.includes(mode)) a.modesPlayed.push(mode);
  if (!a.combosPlayed.includes(combo)) a.combosPlayed.push(combo);
}

function _estimateDuration(playType) {
  switch (playType) {
    case 'blitz':   return 30;
    case 'classic': return 60;
    case 'endless': return 120; // rough estimate
    default:        return 40;
  }
}


// ══════════════════════════════════════════════════════════════════
//  MIGRATION: old 18 achievement ids -> new system
// ══════════════════════════════════════════════════════════════════

const OLD_TO_NEW = {
  first_game:        'games_total_1',
  games_10:          'games_total_10',
  games_50:          'games_total_50',
  daily_3:           'daily_ch_3',
  streak_10:         'streak_any_10',
  streak_25:         'streak_any_25',
  streak_50:         'streak_any_50',
  score_5000:        'score_any_5000',
  score_10000:       'score_any_10000',
  score_20000:       'score_any_20000',
  accuracy_100:      'perf_t_10',
  accuracy_95_20:    'sharp_t_20',
  expert_first:      'mode_first_expert_1',
  ultra_first:       'mode_first_ultra_1',
  endless_50:        'endl_any_50',
  competition_clear: 'comp_lvl_10',
  fever_triggered:   'fever_c_1',
  diamond_catch:     'diamond_c_1',
};

/**
 * Migrate old achievement ids to new system.
 * Call once during save load.
 */
export function migrateOldAchievements(saveData) {
  if (!saveData.achievements || saveData._achMigrated) return;
  const migrated = new Set(saveData.achievements);
  let changed = false;
  for (const [oldId, newId] of Object.entries(OLD_TO_NEW)) {
    if (migrated.has(oldId) && !migrated.has(newId)) {
      migrated.add(newId);
      changed = true;
    }
  }
  if (changed) {
    saveData.achievements = [...migrated];
  }
  saveData._achMigrated = true;
}
