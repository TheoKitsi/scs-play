/* ═══════════════════════════════════════
   SCS Play — Daily Quest Service
   3 deterministic quests per local day.
   Quests draw from a fixed pool seeded by date,
   so the same day shows the same quests for
   every player on the device.
   Persistence: save.data.dailyQuests = {
     date:   'YYYY-MM-DD',
     quests: [{ id, type, target, progress, claimed }]
   }
   ═══════════════════════════════════════ */

const QUEST_POOL = [
  { id: 'play3',     type: 'games',    target: 3,    rewardXP: 80,  rewardFire: 5 },
  { id: 'play5',     type: 'games',    target: 5,    rewardXP: 140, rewardFire: 8 },
  { id: 'score1500', type: 'score',    target: 1500, rewardXP: 100, rewardFire: 6 },
  { id: 'score3000', type: 'score',    target: 3000, rewardXP: 160, rewardFire: 10 },
  { id: 'streak8',   type: 'streak',   target: 8,    rewardXP: 90,  rewardFire: 6 },
  { id: 'streak15',  type: 'streak',   target: 15,   rewardXP: 180, rewardFire: 12 },
  { id: 'acc80',     type: 'accuracy', target: 80,   rewardXP: 110, rewardFire: 7 },
  { id: 'modes2',    type: 'modes',    target: 2,    rewardXP: 130, rewardFire: 8 }
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/* Mulberry32 PRNG seeded by date string for deterministic quest selection */
function dateSeed(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return h;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickQuests(dateStr) {
  const rng = mulberry32(dateSeed(dateStr));
  const pool = QUEST_POOL.slice();
  /* Fisher-Yates with seeded RNG */
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3).map(q => ({
    id: q.id,
    type: q.type,
    target: q.target,
    rewardXP: q.rewardXP,
    rewardFire: q.rewardFire,
    progress: 0,
    claimed: false,
    /* For 'modes' quest we track set of mode names */
    modesSeen: q.type === 'modes' ? [] : undefined
  }));
}

export function getOrSeedQuests(save) {
  if (!save || !save.data) return [];
  const today = todayKey();
  const cur = save.data.dailyQuests;
  if (!cur || cur.date !== today || !Array.isArray(cur.quests) || cur.quests.length === 0) {
    save.data.dailyQuests = { date: today, quests: pickQuests(today) };
  }
  return save.data.dailyQuests.quests;
}

/* Returns array of quests that just transitioned to completed (target reached) */
export function recordGameResult(save, stats) {
  if (!save || !stats) return [];
  const quests = getOrSeedQuests(save);
  const justCompleted = [];
  for (const q of quests) {
    if (q.claimed) continue;
    const wasComplete = q.progress >= q.target;
    switch (q.type) {
      case 'games':
        q.progress = Math.min(q.target, (q.progress || 0) + 1);
        break;
      case 'score':
        q.progress = Math.min(q.target, (q.progress || 0) + (stats.score || 0));
        break;
      case 'streak':
        q.progress = Math.max(q.progress || 0, stats.streak || 0);
        break;
      case 'accuracy':
        /* require ≥ target accuracy in any single game */
        if ((stats.accuracy || 0) >= q.target) q.progress = q.target;
        break;
      case 'modes': {
        const mode = stats.mode || '';
        if (!q.modesSeen) q.modesSeen = [];
        if (mode && !q.modesSeen.includes(mode)) q.modesSeen.push(mode);
        q.progress = Math.min(q.target, q.modesSeen.length);
        break;
      }
      default: break;
    }
    if (!wasComplete && q.progress >= q.target) justCompleted.push(q);
  }
  return justCompleted;
}

/* Auto-claim rewards when ready. Returns total {xp, fire} awarded. */
export function autoClaim(save) {
  const quests = getOrSeedQuests(save);
  let xp = 0, fire = 0;
  for (const q of quests) {
    if (!q.claimed && q.progress >= q.target) {
      q.claimed = true;
      xp  += q.rewardXP  || 0;
      fire += q.rewardFire || 0;
    }
  }
  return { xp, fire };
}

export function countCompleted(save) {
  const quests = getOrSeedQuests(save);
  return quests.filter(q => q.progress >= q.target).length;
}
