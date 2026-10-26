import { PRISM_LEVELS } from '../game/prism/levels.js';

/** Independent campaign namespace. Never reinterpret or erase arcade records. */
export function prismProgress(data) {
  const source = data.prism?.version === 1 ? data.prism : {};
  const levels = {};
  for (const level of PRISM_LEVELS) {
    const item = source.levels?.[level.id];
    if (Number.isInteger(item?.stars) && item.stars >= 1 && item.stars <= 3 && Number.isInteger(item.bestShots) && item.bestShots >= 1 && item.bestShots <= level.shots) {
      levels[level.id] = { stars: item.stars, bestShots: item.bestShots };
    }
  }
  let unlocked = 0;
  while (unlocked < PRISM_LEVELS.length - 1 && levels[PRISM_LEVELS[unlocked].id]) unlocked++;
  return { version: 1, levels, unlocked, stars: Object.values(levels).reduce((sum, item) => sum + item.stars, 0),
    completed: Object.keys(levels).length };
}

export async function savePrismWin(save, simulation) {
  if (simulation.phase !== 'won' || !PRISM_LEVELS.includes(simulation.level)) return false;
  const index = PRISM_LEVELS.indexOf(simulation.level);
  if (index > prismProgress(save.data).unlocked) return false;
  await save.withBatch(() => {
    const progress = prismProgress(save.data);
    const previous = progress.levels[simulation.level.id];
    progress.levels[simulation.level.id] = {
      stars: Math.max(previous?.stars || 0, simulation.stars),
      bestShots: Math.min(previous?.bestShots || Infinity, simulation.shots),
    };
    save.data.prism = { version: 1, levels: progress.levels };
  });
  return true;
}
