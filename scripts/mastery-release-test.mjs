import assert from 'node:assert/strict';

globalThis.location = { hostname: 'localhost' };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE' }, configurable: true });
globalThis.document = { documentElement: { lang: 'de' }, addEventListener() {} };

const { CONFIG } = await import('../js/config.js');
const { setLanguage } = await import('../js/i18n.js');
const {
  ModeMastery,
  endChaosGame,
  endFokusGame,
  endHauptstaedteGame,
  endStroopGame,
  endWissenGame,
  getAlgebraInsights,
  getFokusInsights,
  getHauptstaedteInsights,
  getMatheInsights,
  getWissenInsights,
  getWorteInsights,
  startChaosGame,
  startFokusGame,
  startHauptstaedteGame,
  startStroopGame,
  startWissenGame,
  startWorteGame,
  trackChaosAnswer,
  trackFokusAnswer,
  trackHauptstaedteAnswer,
  trackStroopAnswer,
  trackWissenAnswer,
  trackWorteAnswer
} = await import('../js/game/ModeMastery.js');

const createMastery = (modeMastery = {}) => new ModeMastery({ data: { modeMastery } });
const stats = { correct: 1, total: 2, avgReaction: 500 };
const ghostModes = [
  ['hauptstaedte', startHauptstaedteGame, trackHauptstaedteAnswer, endHauptstaedteGame,
    { item: { display: 'Deutschland' } }],
  ['wissen', startWissenGame, trackWissenAnswer, endWissenGame,
    { item: { display: '', category: 'geo', tier: 1 } }],
  ['stroop', startStroopGame, trackStroopAnswer, endStroopGame,
    { item: { isCongruent: true } }],
  ['fokus', startFokusGame, trackFokusAnswer, endFokusGame,
    { item: { isCongruent: false }, difficultyProgress: 1 }],
  ['chaos', startChaosGame, trackChaosAnswer, endChaosGame,
    { item: { chaosRule: 'color' } }]
];

for (const [mode, start, track, end, extra] of ghostModes) {
  const mastery = createMastery();
  start(mastery);
  track(mastery, { correct: true, reaction: 450, ...extra }, { elapsed: 1.25, score: 140, ...extra });
  track(mastery, { correct: false, reaction: 700, ...extra }, { elapsed: 3.75, score: 115, ...extra });
  end(mastery, stats, true);
  assert.deepEqual(mastery.getArray(mode, 'pbPace'), [
    { t: 1.25, s: 140 },
    { t: 3.75, s: 115 }
  ], `${mode} must persist actual session timestamps and scores, including wrong answers`);
}

const fokus = createMastery();
startFokusGame(fokus);
const fokusLive = trackFokusAnswer(fokus, {
  correct: true,
  reaction: 400,
  item: { isCongruent: false }
}, { elapsed: 2, score: 100, correct: 20, difficultyProgress: 20 });
assert.equal(fokusLive.distractionLevel.level, 3, 'Fokus live level must use engine difficulty progress');
endFokusGame(fokus, { correct: 1, total: 1 }, false);
assert.equal(
  getFokusInsights(fokus, {}).find(insight => insight.type === 'distraction-level').data.level,
  3,
  'Fokus results must retain the highest engine-driven level from the session'
);

setLanguage('de');
const words = createMastery({
  worte: {
    wordCollection: ['hund'],
    catCorrect: { tier: 2 },
    catTotal: { tier: 3 }
  }
});
startWorteGame(words);
trackWorteAnswer(words, {
  correct: true,
  item: { display: 'Katze', category: 'tier' }
}, { elapsed: 1, score: 100 });
let wordInsights = getWorteInsights(words, {});
let collection = wordInsights.find(insight => insight.type === 'word-collection').data;
assert.deepEqual(collection, {
  collected: 2,
  total: Object.values(CONFIG.WORD_BANKS.de).flat().length
}, 'Worte must migrate legacy active-language words and use the active-language denominator');
assert.deepEqual(
  wordInsights.find(insight => insight.type === 'word-categories').data.tier,
  { correct: 3, total: 4 },
  'Worte must preserve legacy category progress when creating language-scoped metrics'
);

setLanguage('en');
startWorteGame(words);
trackWorteAnswer(words, {
  correct: true,
  item: { display: 'Dog', category: 'animal' }
}, { elapsed: 1, score: 100 });
wordInsights = getWorteInsights(words, {});
collection = wordInsights.find(insight => insight.type === 'word-collection').data;
assert.deepEqual(collection, {
  collected: 1,
  total: Object.values(CONFIG.WORD_BANKS.en).flat().length
}, 'Worte collections must remain isolated by language');
assert.equal(words.mapGet('worte', 'catCorrect_de', 'tier'), 3);
assert.equal(words.mapGet('worte', 'catCorrect_en', 'animal'), 1);

const capitals = createMastery({ hauptstaedte: { countryCollection: ['deutschland'] } });
startHauptstaedteGame(capitals);
const repeatCountry = trackHauptstaedteAnswer(capitals, {
  correct: true,
  reaction: 500,
  item: { display: 'Germany' }
}, { elapsed: 1, score: 100 });
assert.equal(repeatCountry.isNew, false, 'Localized names for an existing country must resolve to one identity');
assert.deepEqual(capitals.getArray('hauptstaedte', 'countryCollection'), ['germany']);
const capitalInsights = getHauptstaedteInsights(capitals, {});
assert.equal(capitalInsights.find(insight => insight.type === 'country-collection').data.collected, 1);
assert.equal(capitalInsights.find(insight => insight.type === 'world-map').data.germany.known, true);

const claims = createMastery({
  mathe: { reactionHistory: [500, 550], bestPhase: 2 },
  algebra: { algebraIQ: 150 },
  wissen: { wissenIQ: 150 }
});
const claimTypes = [
  ...getMatheInsights(claims, {}),
  ...getAlgebraInsights(claims, {}),
  ...getWissenInsights(claims, {})
].map(insight => insight.type);
for (const type of ['brain-age', 'community-speed', 'algebra-iq', 'wissen-iq']) {
  assert.equal(claimTypes.includes(type), false, `${type} must not be emitted`);
}

console.log('mastery-release-test: all checks passed');
