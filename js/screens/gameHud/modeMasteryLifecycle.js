import {
  startKlassikGhostRacer, endKlassikGame,
  startFormenGame, endFormenGame,
  startExpertGame, endExpertGame,
  startUltraGame, endUltraGame,
  startMatheGame, endMatheGame,
  startAlgebraGame, endAlgebraGame,
  startWorteGame, endWorteGame,
  startHauptstaedteGame, endHauptstaedteGame,
  startWissenGame, endWissenGame,
  startMemoGame, endMemoGame,
  startSequenzGame, endSequenzGame,
  startStroopGame, endStroopGame,
  startFokusGame, endFokusGame,
  startChaosGame, endChaosGame,
} from '../../game/ModeMastery.js';

const MODE_MASTERY = {
  klassik: { start: startKlassikGhostRacer, end: endKlassikGame, pbMode: 'klassik' },
  beginner: { start: startFormenGame, end: endFormenGame, pbMode: 'beginner' },
  expert: { start: startExpertGame, end: endExpertGame, pbMode: 'expert' },
  ultra: { start: startUltraGame, end: endUltraGame, pbMode: 'ultra' },
  mathe: { start: startMatheGame, end: endMatheGame, pbMode: 'mathe' },
  algebra: { start: startAlgebraGame, end: endAlgebraGame, pbMode: 'algebra' },
  worte: { start: startWorteGame, end: endWorteGame, pbMode: 'worte' },
  hauptstaedte: { start: startHauptstaedteGame, end: endHauptstaedteGame, pbMode: 'hauptstaedte' },
  wissen: { start: startWissenGame, end: endWissenGame, pbMode: 'wissen' },
  memo: { start: startMemoGame, end: endMemoGame, pbMode: 'memo' },
  sequenz: { start: startSequenzGame, end: endSequenzGame, pbMode: 'sequenz' },
  stroop: { start: startStroopGame, end: endStroopGame, pbMode: 'stroop' },
  fokus: { start: startFokusGame, end: endFokusGame, pbMode: 'fokus' },
  chaos: { start: startChaosGame, end: endChaosGame, pbMode: 'chaos' },
};

export function startModeMastery(mode, mastery) {
  const handler = MODE_MASTERY[mode];
  if (handler && mastery) handler.start(mastery);
}

export function finishModeMastery(mode, mastery, stats, save) {
  const handler = MODE_MASTERY[mode];
  if (!handler || !mastery) return;
  handler.end(mastery, stats, stats.score > (save.getPB(handler.pbMode) || 0));
  mastery.persist();
}