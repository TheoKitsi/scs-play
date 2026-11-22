import { createPrismArena } from '../engine/PrismScene.js';
import { PRISM_LEVELS, PRISM_COLORS } from '../game/prism/levels.js';
import { prismProgress, savePrismWin } from '../services/PrismProgress.js';
import { prismIsland, prismRegions } from '../renderers/prismIsland.js';
import { getLanguage } from '../i18n.js';
import { $, escHTML, showScreen } from '../helpers/dom.js';
import { openModal, closeModal } from '../helpers/modal.js';
import { appDialog } from '../helpers/appDialog.js';
import { haptic, cancelHaptics } from '../helpers/haptics.js';
import { prismChallengeUrl } from '../helpers/prismLink.js';
import { setGameplayPerformanceActive } from '../helpers/perfMode.js';
import app from '../appState.js';
import { CONFIG } from '../config.js';
import { rememberPlay } from '../helpers/lastPlay.js';
import { playDock } from '../renderers/playDock.js';

const copy = {
  de: {
    garden: 'Lichtgarten', gesture: 'Zieh am Prisma. Lass los.', quick: 'Farben-Blitz', menu: 'Menü', firstBloom: 'Die Mondblüte ist offen.', firstSaved: 'Deine Blüte bleibt. Im nächsten Garten wartet ein Spiegel.',
    home: 'Arcade & Menü', map: 'Weltkarte', chapter: 'KAPITEL 01 · DIE SCHWEBENDEN GÄRTEN',
    adventure: 'Dein Licht verändert die Welt.', intro: 'Lenke Energie durch vergessene Gärten. Wecke Kristalle, verbinde Wege und bring die Inseln zum Blühen.',
    play: 'Abenteuer starten', continue: 'Abenteuer fortsetzen', replay: 'Noch einmal spielen', restored: 'Rätsel gelöst', stars: 'Sterne',
    zones: ['Der erste Funke', 'Spiegelgärten', 'Das Sonnenwerk'], level: 'Level', locked: 'Gesperrt · schließe zuerst das vorherige Level ab',
    pulses: 'Impulse übrig', crystals: 'Kristalle', goal: 'Wecke alle Kristalle.', parOne: 'Drei Sterne mit einem Impuls', par: 'Drei Sterne mit höchstens {n} Impulsen',
    fire: 'Impuls auslösen', left: '5° nach links zielen', right: '5° nach rechts zielen', undo: 'Rückgängig', restart: 'Neustart', pause: 'Pause', resume: 'Weiterspielen',
    controls: 'Steuerung & Ziele', controlHelp: 'Tippen zielt; Ziehen und Loslassen schießt. Alternativ: links/rechts zielen, Leertaste oder Enter schießen. Die Zielauswahl unten funktioniert auch per Tastatur.',
    target: 'Zielen auf', mirror: 'Spiegel', paint: 'Farbring', switch: 'Schalter', crystal: 'Kristall',
    aimValue: 'Zielwinkel: {degrees} Grad', efficiency: 'Eingesetzte Impulse: {n} · Drei-Sterne-Ziel: {par}', starHelp: 'Drei Sterne für eine Lösung im Zielwert. Jeder Abschluss öffnet das nächste Rätsel. Rückgängig und Neustart sind kostenlos.',
    ready: 'Du hast Zeit. Finde deinen Weg.', launch: 'Energie unterwegs …', chain: 'Kettenreaktion · {n} Kristalle erwacht',
    mismatch: 'Anderes Symbol! Wähle die passende Energie oder nutze einen Farbring.', reflect: 'Licht umgelenkt', paintHit: 'Energie umgestimmt', switchHit: 'Lichtschranke geöffnet', miss: 'Neuer Weg? Du kannst den Impuls rückgängig machen.',
    won: 'Du bringst die Welt zum Leuchten.', lost: 'Ein neuer Weg wartet.', lostHelp: 'Kein Zeitdruck, keine verlorenen Leben. Probiere eine andere Richtung oder nimm den letzten Impuls zurück.',
    next: 'Nächstes Level', toMap: 'Zur Weltkarte', saving: 'Fortschritt wird gespeichert …', saved: 'Auf diesem Gerät gespeichert. Wiederholungen verbessern deine Sterne, ohne doppelte Belohnungen.',
    saveError: 'Speichern nicht möglich. Dein Ergebnis bleibt geöffnet. Prüfe den freien Speicher und versuche es erneut.', retrySave: 'Speichern wiederholen',
    complete: 'Die Gärten leben!', completeHelp: 'Du hast alle zwölf Rätsel abgeschlossen. Auf der Weltkarte kannst du Lösungen verbessern und Lieblingslevel teilen.',
    sound: 'Sound', soundOff: 'Sound aus', preferenceError: 'Die Einstellung konnte nicht dauerhaft gespeichert werden. Prüfe den freien Gerätespeicher.', share: 'Rätsel teilen', shareTitle: 'Schaffst du diese Kettenreaktion?', shareText: 'Spiele „{name}“ in SCS: Prism Worlds – kostenlos im Browser.',
    challenge: 'GETEILTES RÄTSEL', challengeHelp: 'Freies Rätsel: kein Kampagnenfortschritt und keine Änderung deiner Freischaltungen.',
    loading: 'Die Gärten werden aufgebaut …', graphicsError: 'Die Grafik konnte nicht gestartet werden. Du kannst es erneut versuchen oder zum Arcade-Menü zurückkehren.',
    context: 'Die Grafik wurde unterbrochen. Starte das Level neu. Dein gespeicherter Fortschritt bleibt erhalten.', angle: 'Zielwinkel',
    blooming: 'Der Garten erwacht.', skipReveal: 'Ergebnis anzeigen', hint: 'Tipp zum Lichtweg', improve: 'Mit weniger Impulsen versuchen',
    hitGate: 'Die Schranke hält das Licht auf. Ein Schalter öffnet sie.', hitWall: 'Der Impuls trifft auf Stein. Suche einen Weg um die Mauer.',
    trail: 'Impulsweg', edge: 'Rand', wall: 'Stein', gate: 'Schranke', wrong: 'Symbol passt nicht',
    opened: 'Die Schranke bleibt offen. Ziele mit dem nächsten Impuls neu.',
    offMirror: 'Der Strahl verfehlt nach dem Spiegel sein Ziel. Ändere den Auftreffwinkel.',
    offRing: 'Der Impuls hat jetzt {energy}. Richte die Bahn hinter dem Ring neu aus.',
    chooseSymbol: 'Der Kristall braucht {energy}. Wähle das passende Symbol.',
    ringSymbol: 'Der Kristall braucht {energy}. Stimme deinen Impuls mit dem Farbring um.',
    more: 'Noch nicht erwacht: {groups}.', positionsX: ['links', 'mittig', 'rechts'], positionsY: ['oben', 'auf halber Höhe', 'unten'],
    region: 'Region', forecast: 'Erster Kontakt', awake: 'Erwacht', asleep: 'Schläft', latched: 'Geschlossen', unlatched: 'Offen',
    fieldHelp: 'Die gestrichelte Linie zeigt deine Richtung. Die durchgezogene Spur zeigt den letzten Impuls. ✓ bedeutet erwacht.',
    routeHelp: 'Wähle eine Insel für ihre vier Rätsel.', mirrorSlash: 'steigt nach rechts', mirrorBack: 'fällt nach rechts',
  },
  en: {
    garden: 'Light garden', gesture: 'Drag from the prism. Let go.', quick: 'Colour blitz', menu: 'Menu', firstBloom: 'The moonflower opens.', firstSaved: 'Your flower stays. A mirror awaits in the next garden.',
    home: 'Arcade & menu', map: 'World map', chapter: 'CHAPTER 01 · THE FLOATING GARDENS',
    adventure: 'Your light changes the world.', intro: 'Guide energy through forgotten gardens. Awaken crystals, connect paths and bring the islands into bloom.',
    play: 'Start adventure', continue: 'Continue adventure', replay: 'Play again', restored: 'Puzzles solved', stars: 'Stars',
    zones: ['The first spark', 'Mirror gardens', 'The sun engine'], level: 'Level', locked: 'Locked · complete the previous level first',
    pulses: 'Pulses left', crystals: 'Crystals', goal: 'Awaken every crystal.', parOne: 'Three stars with one pulse', par: 'Three stars with at most {n} pulses',
    fire: 'Launch pulse', left: 'Aim 5° left', right: 'Aim 5° right', undo: 'Undo', restart: 'Restart', pause: 'Pause', resume: 'Keep playing',
    controls: 'Controls & targets', controlHelp: 'Tap to aim; drag and release to fire. Or aim left/right and press Space or Enter to launch. The target picker below also works with a keyboard.',
    target: 'Aim at', mirror: 'Mirror', paint: 'Colour ring', switch: 'Switch', crystal: 'Crystal',
    aimValue: 'Aim angle: {degrees} degrees', efficiency: 'Pulses used: {n} · Three-star target: {par}', starHelp: 'Earn three stars by meeting the pulse target. Every completion opens the next puzzle. Undo and restart are free.',
    ready: 'Take your time. Find your path.', launch: 'Energy in flight …', chain: 'Chain reaction · {n} crystals awake',
    mismatch: 'Different symbol! Choose matching energy or pass through a colour ring.', reflect: 'Light redirected', paintHit: 'Energy retuned', switchHit: 'Light barrier opened', miss: 'Another path? You can undo this pulse.',
    won: 'You make the world shine.', lost: 'Another path awaits.', lostHelp: 'No rush and no lost lives. Try another direction or undo your last pulse.',
    next: 'Next level', toMap: 'World map', saving: 'Saving progress …', saved: 'Saved on this device. Replays improve your stars without duplicate rewards.',
    saveError: 'Unable to save. Your result stays open. Check available storage and try again.', retrySave: 'Try saving again',
    complete: 'The gardens are alive!', completeHelp: 'You have completed all twelve puzzles. Improve your solutions and share favourite levels from the world map.',
    sound: 'Sound', soundOff: 'Sound off', preferenceError: 'Unable to persist this preference. Check available device storage.', share: 'Share puzzle', shareTitle: 'Can you solve this chain reaction?', shareText: 'Play “{name}” in SCS: Prism Worlds — free in your browser.',
    challenge: 'SHARED PUZZLE', challengeHelp: 'Free-play puzzle: no campaign progress and no change to your unlocks.',
    loading: 'Growing the gardens …', graphicsError: 'Unable to start the graphics. Try again or return to the arcade menu.',
    context: 'Graphics were interrupted. Restart this level. Your saved progress is safe.', angle: 'Aim angle',
    blooming: 'The garden awakens.', skipReveal: 'Show result', hint: 'Light-path hint', improve: 'Try with fewer pulses',
    hitGate: 'The barrier stops the light. A switch opens it.', hitWall: 'The pulse hit stone. Look for a way around the wall.',
    trail: 'Pulse path', edge: 'Edge', wall: 'Stone', gate: 'Barrier', wrong: 'Symbol mismatch',
    opened: 'The barrier stays open. Aim your next pulse through the gap.',
    offMirror: 'The reflected beam missed. Change where the pulse meets the mirror.',
    offRing: 'The pulse took on {energy}. Adjust the path beyond the ring.',
    chooseSymbol: 'This crystal needs {energy}. Select the matching symbol.',
    ringSymbol: 'This crystal needs {energy}. Retune your pulse with the colour ring.',
    more: 'Still asleep: {groups}.', positionsX: ['left', 'centre', 'right'], positionsY: ['upper', 'middle', 'lower'],
    region: 'Region', forecast: 'First contact', awake: 'Awake', asleep: 'Asleep', latched: 'Closed', unlatched: 'Open',
    fieldHelp: 'Dashes show where you aim. A solid trace shows your last pulse. ✓ means awake.',
    routeHelp: 'Choose an island to see its four puzzles.', mirrorSlash: 'rises to the right', mirrorBack: 'falls to the right',
  },
};

const langIndex = () => getLanguage() === 'de' ? 0 : 1;
const tr = (key, params = {}) => Object.entries(params).reduce((s, [key, val]) => s.replaceAll(`{${key}}`, String(val)), copy[getLanguage()]?.[key] || copy.en[key] || key);
const title = level => level.name[langIndex()];
const energyName = color => PRISM_COLORS[color][getLanguage()] || PRISM_COLORS[color].en;
const zoneName = zone => (copy[getLanguage()] || copy.en).zones[zone];
const folio = index => String(index + 1).padStart(2, '0');
const nodeMark = n => n.kind === 'mirror' ? (n.slope === '/' ? '╱' : '╲') : n.kind === 'paint' ? '◎' : n.kind === 'switch' ? 'ϟ' : PRISM_COLORS[n.color].symbol;
const lock = '<svg class="pw-lock" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 6 0v2m-8 0h10v7H3z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
function targetLabel(node, level) {
  const words = copy[getLanguage()] || copy.en;
  const x = words.positionsX[Math.min(2, Math.floor(node.x / 140))];
  const y = words.positionsY[Math.min(2, Math.floor(node.y / (560 / 3)))];
  const number = level.nodes.filter(n => n.kind === node.kind).findIndex(n => n.id === node.id) + 1;
  const property = node.color ? energyName(node.color) : node.kind === 'mirror' ? tr(node.slope === '/' ? 'mirrorSlash' : 'mirrorBack') : '';
  return `${tr(node.kind)} ${number} · ${y}, ${x}${property ? ` · ${property}` : ''}`;
}
const glyph = id => `<svg class="pw-glyph" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><use href="#icon-${id}"/></svg>`;
const pulseCells = (max, remaining) => Array.from({ length: max }, (_, i) => `<i${i < remaining ? ' class="charged"' : ''}></i>`).join('');
const policy = () => ({ tier: document.body.dataset.perfMode || 'high', reduced: document.body.hasAttribute('data-reduced-motion'), maxImpacts: document.body.dataset.perfMode === 'low' ? 4 : 12 });
let cleanup = null;

export function openPrism({ onHome, onHub, onQuickColors, challengeId = null, play = false }) {
  cleanup?.();
  const root = $('#prism');
  let arena = null, view = 'map', generation = 0, levelIndex = 0, paused = false, settled = false, challenge = false;
  let startupTimer = null, contextFailed = false;
  let contacts = [];
  const listeners = new AbortController();
  const on = (el, type, handler) => el.addEventListener(type, handler, { signal: listeners.signal });
  const startGardenMusic = () => {
    if (!paused && !document.hidden && navigator.userActivation?.hasBeenActive !== false) app.audio.startMusic();
  };
  root.addEventListener('pointerup', startGardenMusic, { once: true, signal: listeners.signal });
  root.addEventListener('keydown', startGardenMusic, { once: true, signal: listeners.signal });
  const modal = () => $('#pwDialog');
  const closeDialog = (restoreFocus = false) => { if (modal()) closeModal(modal(), { restoreFocus }); };
  const releaseArena = () => {
    clearTimeout(startupTimer); startupTimer = null;
    closeDialog(); generation++;
    setGameplayPerformanceActive(false);
    cancelHaptics(); app.releaseWakeLock?.();
    arena?.destroy(); arena = null;
    delete root.dataset.pwFinishing;
    paused = false;
  };
  const leave = () => { cleanup?.(); onHome(); };
  const soundButton = () => `<button type="button" class="pw-icon-button" id="pwSound" aria-pressed="${app.save.getSetting('sound')}">${tr(app.save.getSetting('sound') ? 'sound' : 'soundOff')}</button>`;

  function shell(body) {
    root.dataset.pwView = view;
    if (view === 'game') root.dataset.pwRegion = PRISM_LEVELS[levelIndex].zone;
    else delete root.dataset.pwRegion;
    root.innerHTML = `<div class="pw-shell">
      <header class="pw-header"><button type="button" class="pw-icon-button" id="pwBack" aria-label="${tr(view === 'map' ? 'home' : 'map')}">←</button>
         ${view === 'map' ? `<div class="pw-brand"><span class="pw-eyebrow">PRISM WORLDS</span><h1>${tr('garden')}</h1></div>` :
           `<div class="pw-level-heading"><p class="pw-eyebrow">${challenge ? tr('challenge') : `${tr('level')} ${String(levelIndex + 1).padStart(2,'0')} / 12`}</p><h1>${escHTML(title(PRISM_LEVELS[levelIndex]))}</h1></div>`}
         <button type="button" class="pw-icon-button" id="pwMenu">${tr('menu')}</button>
        ${view === 'map' ? soundButton() : `<button type="button" class="pw-icon-button" id="pwPause" aria-label="${tr('pause')}">${glyph('pause')}</button>`}
       </header>${body}${view === 'map' ? playDock('worlds') : ''}</div>`;
    root.scrollTop = 0;
    const heading = root.querySelector('h1');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }

  function showMap() {
    releaseArena(); view = 'map'; settled = false; challenge = false;
    app.audio.setMusicMode('menu'); app.audio.startMusic();
    const progress = prismProgress(app.save.data);
    const next = progress.unlocked;
    const regions = prismRegions(progress);
    shell(`<div class="pw-map-view">
      <section class="pw-world-art" aria-label="${tr('map')}"><div class="pw-atlas">${prismIsland(progress, null, true)}
        <nav class="pw-map-pins" aria-label="${tr('routeHelp')}">${regions.map((count, i) => `<button type="button" data-pw-pin="${i}" aria-label="${tr('region')} ${i + 1}: ${zoneName(i)}. ${tr('restored')}: ${count}/4" aria-controls="pwZone${i}" ${count !== 4 && i === PRISM_LEVELS[next].zone ? 'aria-current="step"' : ''}>${count === 4 ? '✓ ' : ''}${folio(i)}</button>`).join('')}</nav></div>
        <div class="pw-world-caption"><span>${tr('restored')} <strong>${progress.completed}/12</strong></span><span>✦ <strong>${progress.stars}/36</strong> ${tr('stars')}</span></div>
      </section>
      <section class="pw-journey"><p class="pw-eyebrow">${tr('chapter')}</p><h2>${tr(progress.completed === 12 ? 'complete' : 'adventure')}</h2>
        <button type="button" class="pw-primary" id="pwContinue"><b>${tr(progress.completed === 12 ? 'replay' : progress.completed ? 'continue' : 'play')}<small>${tr('level')} ${folio(progress.completed === 12 ? 0 : next)} · ${escHTML(title(PRISM_LEVELS[progress.completed === 12 ? 0 : next]))}</small></b><span aria-hidden="true">↗</span></button>
        <p class="pw-intro">${tr(progress.completed === 12 ? 'completeHelp' : 'routeHelp')}</p>
        <div class="pw-level-zones">${[0, 1, 2].map(zone => `<section class="pw-level-zone" data-pw-zone="${zone}" id="pwZone${zone}"><div class="pw-region-heading">${prismIsland(progress, zone)}<div><h3 tabindex="-1"><span>${folio(zone)}</span> ${zoneName(zone)}</h3><p>${tr('restored')} <strong>${regions[zone]}/4</strong></p></div></div><div class="pw-level-grid">${PRISM_LEVELS.map((level, index) => {
          if (level.zone !== zone) return '';
          const result = progress.levels[level.id], unlocked = index <= next;
          return `<button type="button" class="pw-level${result ? ' pw-level--done' : ''}${index === next && !result ? ' pw-level--next' : ''}" data-pw-level="${index}" ${unlocked ? '' : 'disabled'} aria-label="${tr('level')} ${index + 1}: ${escHTML(title(level))}. ${unlocked ? `${result?.stars || 0}/3 ${tr('stars')}` : tr('locked')}" ${index === next && !result ? 'aria-current="step"' : ''}><span class="pw-level-number">${folio(index)}</span><span class="pw-level-name">${escHTML(title(level))}</span><span class="pw-level-stars" aria-hidden="true">${result ? '✦'.repeat(result.stars) + '·'.repeat(3 - result.stars) : unlocked ? '→' : lock}</span></button>`;
        }).join('')}</div></section>`).join('')}</div>
        <p class="pw-map-note">${getLanguage() === 'de' ? '12 handgestaltete Rätsel · kein Zeitlimit · offline spielbar' : '12 handcrafted puzzles · no time limit · playable offline'}</p>
        <p class="pw-map-note">${tr('starHelp')}</p>
      </section></div>`);
    $('#pwContinue').onclick = () => loadLevel(progress.completed === 12 ? 0 : next);
  }

  function makeDialog(heading, message, buttons, { dismiss, mode = 'error', progress } = {}) {
    closeDialog();
    modal()?.remove();
    const el = document.createElement('div');
    el.id = 'pwDialog'; el.className = 'pw-dialog'; el.setAttribute('aria-labelledby', 'pwDialogTitle');
    el.dataset.sheet = mode;
    el.setAttribute('aria-describedby', 'pwDialogMessage');
    const level = PRISM_LEVELS[levelIndex];
    el.innerHTML = `<section class="pw-dialog-card"><div class="pw-dialog-scroll"><span class="pw-eyebrow">${zoneName(level.zone)} · ${tr('level')} ${folio(levelIndex)}</span><h2 id="pwDialogTitle">${heading}</h2>
      ${mode === 'won' ? `<div class="pw-result-art">${resultArt(level.zone, progress)}</div>` : ''}
      ${mode === 'pause' || mode === 'lost' ? `<div class="pw-ledger"><strong>${escHTML(title(level))}</strong><span>${tr('crystals')} <b>${$('#pwCrystals').textContent}</b></span><span>${tr('pulses')} <b>${$('#pwPulses').textContent}</b></span></div>` : ''}
      <p id="pwDialogMessage" role="status">${message}</p><div class="pw-dialog-actions"></div></div><div class="pw-dialog-footer"></div></section>`;
    if (mode === 'lost' && contacts.length) {
      const trail = $('#pwTrail').cloneNode(true);
      trail.removeAttribute('id'); trail.querySelector('ol').removeAttribute('id');
      el.querySelector('#pwDialogMessage').before(trail);
    }
    for (const [id, label, action, primary] of buttons) {
      const button = document.createElement('button');
      button.id = id; button.type = 'button'; button.className = primary ? 'pw-primary' : 'pw-secondary'; button.textContent = label; button.onclick = action;
      el.querySelector(primary ? '.pw-dialog-footer' : '.pw-dialog-actions').appendChild(button);
    }
    root.querySelector('.pw-shell').appendChild(el);
    openModal(el, { initialFocus: '.pw-dialog-footer button:not(:disabled)', onDismiss: dismiss || showMap });
  }

  function pause() {
    if (!arena || paused || settled || view !== 'game') return;
    paused = true; arena.scene.setPaused(true);
    setGameplayPerformanceActive(false); cancelHaptics(); app.audio.stopMusic(); app.releaseWakeLock?.();
    makeDialog(tr('pause'), escHTML(PRISM_LEVELS[levelIndex].objective[langIndex()]), [
      ['pwResume', tr('resume'), resume, true], ['pwPauseRestart', tr('restart'), () => loadLevel(levelIndex, challenge)], ['pwPauseMap', tr('toMap'), showMap],
    ], { dismiss: resume, mode: 'pause' });
  }

  function resume() {
    if (document.hidden || contextFailed) return;
    closeDialog(true); paused = false;
    arena?.scene.setPaused(false); setGameplayPerformanceActive(true);
    app.audio.startMusic(); app.requestWakeLock?.();
  }

  function resultArt(zone, progress = prismProgress(app.save.data)) {
    const count = prismRegions(progress)[zone];
    return prismIsland(progress, zone) + (challenge ? '' : `<span class="pw-art-count">${tr('restored')} <strong>${count}/4</strong></span>`);
  }

  function undoPulse() {
    if (!arena) return;
    arena.scene.undo();
    resetTrail();
    $('#pwStatus').textContent = PRISM_LEVELS[levelIndex].objective[langIndex()];
  }

  async function finish(state) {
    if (settled) return;
    settled = true;
    setGameplayPerformanceActive(false); app.releaseWakeLock?.();
    const token = generation, sim = arena.scene.simulation;
    if (state.phase === 'lost') {
      arena.scene.settle();
      const retry = () => {
        closeDialog(); settled = false; arena.scene.setPaused(false); undoPulse(); $('#pwFire').focus({ preventScroll: true });
        app.requestWakeLock?.(); setGameplayPerformanceActive(true);
      };
      const lastMessage = $('#pwStatus').textContent;
      makeDialog(tr('lost'), `${lastMessage === tr('miss') ? '' : escHTML(lastMessage) + ' '}${tr('lostHelp')}`, [
        ['pwResultUndo', tr('undo'), retry, true],
        ['pwResultRestart', tr('restart'), () => loadLevel(levelIndex, challenge)], ['pwResultMap', tr('toMap'), showMap],
      ], { dismiss: retry, mode: 'lost' });
      return;
    }
    // Commit the genuine win immediately. Presentation neither delays storage
    // nor alters simulation time, rewards or eligibility. Catch before awaiting
    // the reveal so a rejected write can never become an unhandled rejection.
    const saveWin = () => savePrismWin(app.save, sim).then(saved => Boolean(saved), () => false);
    const priorProgress = prismProgress(app.save.data);
    const saving = challenge ? Promise.resolve(true) : saveWin();
    root.dataset.pwFinishing = '';
    $('#pwStatus').textContent = tr('blooming');
    $('#pwSkipReveal').hidden = false;
    const presented = await arena.scene.presentCompletion();
    if (!presented || token !== generation) return;
    delete root.dataset.pwFinishing;
    $('#pwSkipReveal').hidden = true;
    makeDialog(tr(levelIndex === 0 ? 'firstBloom' : levelIndex === 11 && !challenge ? 'complete' : 'won'), challenge ? tr('challengeHelp') : tr('saving'), [
      ['pwNext', tr(challenge || levelIndex === 11 ? 'toMap' : 'next'), () => challenge || levelIndex === 11 ? showMap() : loadLevel(levelIndex + 1), true],
      ['pwResultReplay', tr(state.stars < 3 ? 'improve' : 'replay'), () => loadLevel(levelIndex, challenge)], ['pwShare', tr('share'), share],
    ], { mode: 'won', progress: priorProgress });
    const stars = document.createElement('div'); stars.className = 'pw-earned-stars'; stars.setAttribute('role', 'img'); stars.setAttribute('aria-label', `${state.stars}/3 ${tr('stars')}`);
    stars.textContent = '✦'.repeat(state.stars) + '·'.repeat(3 - state.stars);
    $('#pwDialogTitle').after(stars);
    const efficiency = document.createElement('p');
    efficiency.className = 'pw-efficiency';
    efficiency.textContent = tr('efficiency', { n: state.shots, par: sim.level.par });
    stars.after(efficiency);
    const next = $('#pwNext'); next.disabled = !challenge;
    if (!challenge && levelIndex < PRISM_LEVELS.length - 1) {
      const destination = document.createElement('small');
      const upcoming = PRISM_LEVELS[levelIndex + 1];
      destination.textContent = `${upcoming.zone !== sim.level.zone ? zoneName(upcoming.zone) + ' · ' : ''}${folio(levelIndex + 1)} · ${title(upcoming)}`;
      next.append(destination);
    }
    if (challenge) return;
    const persist = async (pending = null) => {
      $('#pwRetrySave')?.remove();
      const saved = await (pending || saveWin());
      if (token !== generation || !next.isConnected || contextFailed) return;
      if (saved) {
        delete modal().dataset.save;
        $('#pwDialogMessage').textContent = tr(levelIndex === 0 ? 'firstSaved' : 'saved');
        $('.pw-result-art').innerHTML = resultArt(sim.level.zone);
        next.disabled = false;
        if (!modal().inert && (document.activeElement === modal() || document.activeElement === document.body)) next.focus({ preventScroll: true });
      } else {
        modal().dataset.save = 'error';
        $('#pwDialogMessage').textContent = tr('saveError');
        const button = document.createElement('button'); button.type = 'button'; button.id = 'pwRetrySave'; button.className = 'pw-secondary'; button.textContent = tr('retrySave'); button.onclick = () => persist();
        button.setAttribute('aria-describedby', 'pwDialogMessage');
        $('.pw-dialog-footer').prepend(button);
        $('#pwDialogMessage').scrollIntoView({ block: 'nearest', behavior: 'instant' });
        button.focus({preventScroll:true});
      }
    };
    await persist(saving);
  }

  function update(state) {
    if (view !== 'game') return;
    const sim = arena?.scene.simulation;
    if (!sim) return;
    const count = state.nodes.filter(n => n.kind === 'crystal'), active = count.filter(n => n.active).length;
    const remaining = sim.level.shots - state.shots;
    if ($('#pwPulses').textContent !== String(remaining)) {
      $('#pwPulses').textContent = String(remaining);
      $('#pwCharge').innerHTML = pulseCells(sim.level.shots, remaining);
    }
    $('#pwCrystals').textContent = `${active}/${count.length}`;
    const seals = $('#pwCrystalSeals').children;
    count.forEach((node, i) => { seals[i].dataset.awake = String(node.active); });
    $('#pwFire').disabled = state.phase !== 'ready' || paused;
    $('#pwTargetFire').disabled = $('#pwFire').disabled;
    $('#pwUndo').disabled = !state.canUndo || paused;
    for (const button of root.querySelectorAll('[data-pw-color]')) {
      button.disabled = state.phase !== 'ready'; button.setAttribute('aria-pressed', String(button.dataset.pwColor === state.color));
    }
    $('#pwAimControls').disabled = state.phase !== 'ready';
    for (const button of root.querySelectorAll('[data-pw-target]')) {
      const node = state.nodes.find(n => n.id === button.dataset.pwTarget);
      button.disabled = state.phase !== 'ready' || Boolean(node?.active);
      const label = button.querySelector('small');
      if (label) label.textContent = tr(node.kind === 'switch' ? node.active ? 'unlatched' : 'latched' : node.active ? 'awake' : 'asleep');
    }
    if (state.gates.length) $('#pwGateState').textContent = `${tr('gate')} · ${tr(state.gates.every(g => g.open) ? 'unlatched' : 'latched')}`;
    if (state.phase === 'won' || state.phase === 'lost') finish(state);
  }

  function resetTrail() {
    contacts = [];
    $('#pwTrail').hidden = true;
    $('#pwTrailList').replaceChildren();
  }

  function recordContact(event, sim) {
    const { kind, color, surface } = event;
    const node = sim.nodes.find(n => n.id === event.id);
    const mark = { reflect: node?.slope === '/' ? '╱' : '╲', paint: '◎', switch: 'ϟ', activate: PRISM_COLORS[color]?.symbol, mismatch: '≠', miss: '×' }[kind];
    if (!mark) return;
    const name = { reflect: 'mirror', paint: 'paint', switch: 'switch', activate: 'crystal', mismatch: 'wrong', miss: surface === 'wall' || surface === 'gate' ? surface : 'edge' }[kind];
    const list = $('#pwTrailList');
    const group = contacts.at(-1);
    let chip;
    if (kind === 'activate' && group?.kind === kind && group.color === color) {
      group.count++;
      chip = list.lastElementChild;
    } else {
      contacts.push({ kind, color, count: 1 });
      chip = document.createElement('li');
      chip.style.setProperty('--energy', PRISM_COLORS[color]?.css || 'var(--pw-text)');
      list.append(chip);
    }
    const n = contacts.at(-1).count;
    const label = `${tr(name)}${kind === 'paint' || kind === 'activate' ? ` · ${energyName(color)}` : ''}${n > 1 ? ` ×${n}` : ''}`;
    chip.setAttribute('aria-label', label); chip.title = label;
    chip.textContent = `${mark} ${tr(name)}${n > 1 ? ` ×${n}` : ''}`;
    $('#pwTrail').hidden = false;
  }

  function signal(event) {
    if (view !== 'game' || paused) return;
    const el = $('#pwStatus'), sim = arena.scene.simulation;
    if (event.kind === 'launch') resetTrail();
    recordContact(event, sim);
    const messages = { launch: 'launch', reflect: 'reflect', paint: 'paintHit', switch: 'switchHit', mismatch: 'mismatch', miss: 'miss' };
    const message = event.kind === 'miss' && event.surface === 'gate' ? 'hitGate'
      : event.kind === 'miss' && event.surface === 'wall' ? 'hitWall' : messages[event.kind];
    if (message) el.textContent = tr(message);
    if (event.kind === 'miss' && event.surface === 'edge') {
      const prior = contacts.at(-2);
      if (contacts.some(c => c.kind === 'switch')) el.textContent = tr('opened');
      else if (prior?.kind === 'reflect') el.textContent = tr('offMirror');
      else if (prior?.kind === 'paint') el.textContent = tr('offRing', { energy: energyName(prior.color) });
    }
    if (event.kind === 'mismatch') {
      const hit = sim.nodes.find(n => n.id === event.id);
      if (hit) el.textContent = tr(sim.level.colors.includes(hit.color) ? 'chooseSymbol' : 'ringSymbol', { energy: energyName(hit.color) });
    }
    if (event.kind === 'settled' && event.phase === 'ready' && contacts.at(-1)?.kind === 'activate') {
      const asleep = sim.nodes.filter(n => n.kind === 'crystal' && !n.active);
      const groups = [...new Set(asleep.map(n => n.color))].map(color => `${asleep.filter(n => n.color === color).length} × ${energyName(color)}`);
      el.textContent = tr('more', { groups: groups.join(', ') });
    }
    app.audio.prismContact(event);
    if (event.kind === 'activate') {
      const n = arena.scene.simulation.nodes.filter(n => n.kind === 'crystal' && n.active).length;
      el.textContent = tr('chain', { n });
      if (!event.depth) haptic('correct', app.save);
    }
  }

  function loadLevel(index, freePlay = false) {
    if (!Number.isInteger(index) || !PRISM_LEVELS[index] || (!freePlay && index > prismProgress(app.save.data).unlocked)) return;
    releaseArena(); levelIndex = index; challenge = freePlay; view = 'game'; settled = false;
    if (!freePlay) rememberPlay(app.save, 'garden');
    contextFailed = false;
    const level = PRISM_LEVELS[index], token = generation;
    let sighted = null, forecastKey = null;
    contacts = [];
    shell(`<div class="pw-play-view">
      <div class="pw-play-layout"><div class="pw-arena" id="pwArena"><p class="pw-loading">${tr('loading')}</p><button type="button" id="pwSkipReveal" class="pw-reveal-skip" hidden>${tr('skipReveal')} <span aria-hidden="true">→</span></button></div>
      <section class="pw-console" aria-label="${tr('controls')}"><div class="pw-stats"><div><span>${tr('crystals')}<span id="pwCrystalSeals" aria-hidden="true">${level.nodes.filter(n => n.kind === 'crystal').map(n => `<i data-energy="${n.color}" style="--energy:${PRISM_COLORS[n.color].css}"></i>`).join('')}</span></span><strong id="pwCrystals">0</strong></div><div><span>${tr('pulses')}<span id="pwCharge" class="pw-charge" aria-hidden="true">${pulseCells(level.shots, level.shots)}</span></span><strong id="pwPulses">${level.shots}</strong></div></div>
        <div class="pw-colors" ${level.colors.length === 1 ? 'hidden' : ''} aria-label="${getLanguage() === 'de' ? 'Energie wählen' : 'Choose energy'}">${level.colors.map(color => `<button type="button" data-pw-color="${color}" style="--energy:${PRISM_COLORS[color].css}" aria-pressed="${color === level.colors[0]}" aria-label="${PRISM_COLORS[color][getLanguage()]}"><span aria-hidden="true">${PRISM_COLORS[color].symbol}</span> ${PRISM_COLORS[color][getLanguage()].split(' · ')[0]}</button>`).join('')}</div>
         <p id="pwStatus" class="pw-status" role="status" aria-live="polite">${index === 0 ? tr('gesture') : escHTML(level.objective[langIndex()])}</p>
        <fieldset id="pwAimControls" class="pw-aim-controls" aria-label="${tr('angle')}"><button type="button" id="pwLeft" class="pw-secondary" aria-label="${tr('left')}">↶</button><button type="button" id="pwFire" class="pw-primary">${tr('fire')} <span aria-hidden="true">↗</span></button><button type="button" id="pwRight" class="pw-secondary" aria-label="${tr('right')}">↷</button></fieldset>
         <div class="pw-tools"><button type="button" class="pw-text-button" id="pwUndo" disabled>↶ ${tr('undo')}</button><output id="pwAimReadout" class="pw-aim-readout" aria-label="${tr('aimValue', { degrees: 0 })}" aria-live="off">0°</output><button type="button" class="pw-text-button" id="pwRestart">↻ ${tr('restart')}</button></div>
         <div id="pwTrail" class="pw-trail" hidden><span>${tr('trail')}</span><ol id="pwTrailList" aria-label="${tr('trail')}"></ol></div>
        <details class="pw-help pw-hint"><summary>${tr('hint')}</summary><p class="pw-tip">${escHTML(level.tip[langIndex()])}</p><p>${tr(level.par === 1 ? 'parOne' : 'par', { n: level.par })}</p></details>
         <details class="pw-help"><summary>${tr('controls')}</summary><p>${escHTML(level.objective[langIndex()])} ${tr('controlHelp')}</p><p>${tr('fieldHelp')}</p>
         <div class="pw-sighting"><span>${tr('forecast')}</span><output id="pwForecast" aria-live="off"></output>${level.gates.length ? '<strong id="pwGateState"></strong>' : ''}</div>
         <div class="pw-target-picker" role="group" aria-label="${tr('target')}">${level.nodes.map(n => `<button type="button" class="pw-secondary" data-pw-target="${n.id}" aria-pressed="false"><span class="pw-node-mark" aria-hidden="true" style="--energy:${PRISM_COLORS[n.color]?.css || '#f3eddc'}">${nodeMark(n)}</span><span>${escHTML(targetLabel(n, level))}${['switch','crystal'].includes(n.kind) ? '<small></small>' : ''}</span></button>`).join('')}</div>
         <div class="pw-help-tools"><button type="button" id="pwTargetFire" class="pw-primary">${tr('fire')}</button>${soundButton()}</div></details>
        <button type="button" class="pw-quick" id="pwQuickColors"><span aria-hidden="true">⚡</span> ${tr('quick')} <small>Arcade · ${CONFIG.DURATION_BLITZ} s</small> →</button>
        ${freePlay ? `<p class="pw-map-note">${tr('challengeHelp')}</p>` : ''}
      </section></div></div>`);
    try {
      startupTimer = setTimeout(() => {
        if (token !== generation) return;
        releaseArena();
        makeDialog('Prism Worlds', tr('graphicsError'), [['pwGraphicsRetry', tr('restart'), () => loadLevel(index, freePlay), true], ['pwGraphicsBack', tr('home'), leave]]);
      }, 10000);
      arena = createPrismArena($('#pwArena'), level, {
        gardenRestored: Boolean(prismProgress(app.save.data).levels['first-light']),
        ready: () => {
          if (token !== generation) return;
          clearTimeout(startupTimer); startupTimer = null;
          $('#pwArena .pw-loading')?.remove();
          if (document.hidden) pause();
        },
        state: state => { if (token === generation) update(state); },
        aim: (point, first) => {
          if (token !== generation) return;
          const degrees = Math.round(Math.atan2(point.x - level.launch.x, level.launch.y - point.y) * 180 / Math.PI);
          const readout = $('#pwAimReadout');
          readout.textContent = `${degrees > 0 ? '+' : ''}${degrees}°`;
          readout.setAttribute('aria-label', tr('aimValue', { degrees }));
          const node = level.nodes.find(n => n.x === point.x && n.y === point.y);
          if (sighted !== node) {
            if (sighted) root.querySelector(`[data-pw-target="${sighted.id}"]`).setAttribute('aria-pressed', 'false');
            if (node) root.querySelector(`[data-pw-target="${node.id}"]`).setAttribute('aria-pressed', 'true');
            sighted = node;
          }
          const key = first?.id || first?.surface || '—';
          if (forecastKey !== key) {
            const hit = level.nodes.find(n => n.id === first?.id);
            $('#pwForecast').textContent = hit ? targetLabel(hit, level) : first ? tr(['gate','wall'].includes(first.surface) ? first.surface : 'edge') : '—';
            forecastKey = key;
          }
        },
        signal: event => { if (token === generation) signal(event); },
        contextLost: event => {
          if (token !== generation) return;
          event.preventDefault(); contextFailed = true; paused = true;
          arena?.scene.endCompletion(false);
          delete root.dataset.pwFinishing;
          $('#pwSkipReveal').hidden = true;
          arena?.scene.setPaused(true);
          setGameplayPerformanceActive(false); app.releaseWakeLock?.(); cancelHaptics();
          makeDialog('Prism Worlds', tr('context'), [['pwGraphicsRestart', tr('restart'), () => loadLevel(index, freePlay), true], ['pwGraphicsMap', tr('toMap'), showMap]], { dismiss: showMap });
        },
      }, policy());
      app.audio.setMusicMode('endless'); startGardenMusic();
      app.requestWakeLock?.(); setGameplayPerformanceActive(true);
    } catch {
      releaseArena();
      makeDialog('Prism Worlds', tr('graphicsError'), [['pwGraphicsRetry', tr('restart'), () => loadLevel(index, freePlay), true], ['pwGraphicsBack', tr('home'), leave]]);
    }
    $('#pwFire').onclick = () => arena?.scene.fire();
    $('#pwTargetFire').onclick = () => arena?.scene.fire();
    $('#pwLeft').onclick = () => arena?.scene.rotateAim(-5);
    $('#pwRight').onclick = () => arena?.scene.rotateAim(5);
    $('#pwUndo').onclick = undoPulse;
    $('#pwRestart').onclick = () => loadLevel(index, freePlay);
    $('#pwPause').onclick = pause;
    $('#pwSkipReveal').onclick = () => arena?.scene.endCompletion(true);
  }

  async function share() {
    const level = PRISM_LEVELS[levelIndex];
    const url = prismChallengeUrl(level.id, location.href, Boolean(window.Capacitor?.isNativePlatform?.()));
    const text = tr('shareText', { name: title(level) });
    if (navigator.share) {
      try { await navigator.share({ title: tr('shareTitle'), text, url }); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    await appDialog({ title: tr('share'), message: text, copyText: url });
  }

  on(root, 'click', event => {
    const target = event.target.closest('button');
    if (!target || target.disabled) return;
    if (view === 'map' && ['play','collection'].includes(target.dataset.action)) onHub(target.dataset.action);
    if (target.id === 'pwMenu') leave();
    if (target.id === 'pwQuickColors') onQuickColors();
    if (target.id === 'pwBack') view === 'map' ? leave() : showMap();
    if (target.id === 'pwSound') {
      const sound = !app.save.getSetting('sound');
      app.save.setSetting('sound', sound).catch(() => appDialog({ title: 'Prism Worlds', message: tr('preferenceError') }));
      app.audio.toggle(sound); target.setAttribute('aria-pressed', String(sound)); target.textContent = tr(sound ? 'sound' : 'soundOff');
    }
    if (target.dataset.pwLevel != null) loadLevel(Number(target.dataset.pwLevel));
    if (target.dataset.pwPin != null) {
      const region = $(`#pwZone${Number(target.dataset.pwPin)}`);
      region.scrollIntoView({ block: 'start', behavior: 'instant' });
      region.querySelector('h3').focus({ preventScroll: true });
    }
    if (target.dataset.pwColor) arena?.scene.selectColor(target.dataset.pwColor);
    if (target.dataset.pwTarget) {
      const node = arena?.scene.simulation.nodes.find(n => n.id === target.dataset.pwTarget);
      if (node) arena.scene.setAim(node);
    }
  });
  on(document, 'keydown', event => {
    if (app.currentScreen === 'prism' && root.hasAttribute('data-pw-finishing') && event.key === 'Escape') {
      event.preventDefault(); arena?.scene.endCompletion(true); return;
    }
    if (app.currentScreen !== 'prism' || !arena || paused || settled) return;
    if (event.key === 'Escape') { event.preventDefault(); pause(); return; }
    if (event.target.closest('details,button,input,select')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); arena.scene.rotateAim(event.key === 'ArrowLeft' ? -5 : 5); }
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); arena.scene.fire(); }
  });
  const suspend = () => { arena?.scene.endCompletion(true); pause(); };
  on(document, 'visibilitychange', () => { if (document.hidden) suspend(); });
  on(window, 'scs:native-pause', suspend);
  on(window, 'scs:motionpreference', () => arena?.scene.setPolicy(policy()));
  on(window, 'scs:perftier', () => arena?.scene.setPolicy(policy()));
  on(window, 'resize', () => { if (window.innerHeight < 400 && view === 'game') pause(); });
  on(window, 'scs:screenchange', ({ detail }) => { if (detail.id !== 'prism') cleanup?.(); });

  cleanup = () => {
    listeners.abort(); releaseArena();
    root.innerHTML = ''; app.prismNavigation = null; cleanup = null;
    delete root.dataset.pwView;
    delete root.dataset.pwRegion;
  };
  app.prismNavigation = {
    back: () => { if (view === 'map') leave(); else if (!paused && !settled) pause(); else showMap(); },
    rendererState: () => arena?.scene.solid ? { ...arena.scene.solid.snapshot(), loopRunning: Boolean(arena.game.loop.running), tier: arena.scene.policy.tier } : null,
  };
  showScreen('prism', app);
  const requested = PRISM_LEVELS.findIndex(level => level.id === challengeId);
  if (requested >= 0) loadLevel(requested, true);
  else if (play) {
    const progress = prismProgress(app.save.data);
    loadLevel(progress.completed === PRISM_LEVELS.length ? 0 : progress.unlocked);
  } else showMap();
}
