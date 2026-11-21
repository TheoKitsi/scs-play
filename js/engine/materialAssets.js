/* Original, offline-baked artwork and normal/roughness data. The build and runtime share this manifest;
   no CDN, runtime noise shader, asset service or extra dependency is needed. */
export const MATERIAL_ASSETS = Object.freeze({
  decks: Object.freeze(Object.fromEntries(['klassik', 'beginner', 'expert', 'mathe', 'wissen', 'memo', 'sequenz', 'stroop', 'fokus', 'chaos']
    .map(mode => [mode, `img/materials/${mode === 'klassik' ? 'arcade-deck' : `arcade-${mode}`}.webp`]))),
  gardens: Object.freeze(['img/materials/prism-garden.webp', 'img/materials/prism-mirrors.webp', 'img/materials/prism-sun.webp']),
  islands: Object.freeze(['img/materials/island-garden.webp', 'img/materials/island-mirrors.webp', 'img/materials/island-sun.webp']),
  crystals: 'img/materials/prism-crystals.webp',
  finishes: 'img/materials/studio-finishes.png',
});

export const MATERIAL_FILES = Object.freeze([...Object.values(MATERIAL_ASSETS.decks), ...MATERIAL_ASSETS.gardens, ...MATERIAL_ASSETS.islands, MATERIAL_ASSETS.crystals, MATERIAL_ASSETS.finishes]);
