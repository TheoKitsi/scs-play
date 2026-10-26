import { createPrismArena } from '../engine/PrismScene.js';
import { PRISM_LEVELS, PRISM_COLORS } from '../game/prism/levels.js';
import { prismProgress, savePrismWin } from '../services/PrismProgress.js';
import { prismIsland } from '../renderers/prismIsland.js';
import { getLanguage } from '../i18n.js';
import { $, escHTML, showScreen } from '../helpers/dom.js';
import { openModal, closeModal } from '../helpers/modal.js';
import { appDialog } from '../helpers/appDialog.js';
import { haptic, cancelHaptics } from '../helpers/haptics.js';
import { prismChallengeUrl } from '../helpers/prismLink.js';
import { setGameplayPerformanceActive } from '../helpers/perfMode.js';
import app from '../appState.js';

const copy = {
  de: {
    home: 'Arcade & Menü', map: 'Weltkarte', chapter: 'KAPITEL 01 · DIE SCHWEBENDEN GÄRTEN',
    adventure: 'Dein Licht verändert die Welt.', intro: 'Lenke Energie durch vergessene Gärten. Wecke Kristalle, verbinde Wege und bring die Inseln zum Blühen.',
    play: 'Abenteuer starten', continue: 'Abenteuer fortsetzen', replay: 'Noch einmal spielen', restored: 'Gärten erwacht', stars: 'Sterne',
    zones: ['Der erste Funke', 'Spiegelgärten', 'Das Sonnenwerk'], level: 'Level', locked: 'Gesperrt · schließe zuerst das vorherige Level ab',
    pulses: 'Impulse übrig', crystals: 'Kristalle', goal: 'Wecke alle Kristalle.', par: 'Drei Sterne mit höchstens {n} Impulsen',
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
  },
  en: {
    home: 'Arcade & menu', map: 'World map', chapter: 'CHAPTER 01 · THE FLOATING GARDENS',
    adventure: 'Your light changes the world.', intro: 'Guide energy through forgotten gardens. Awaken crystals, connect paths and bring the islands into bloom.',
    play: 'Start adventure', continue: 'Continue adventure', replay: 'Play again', restored: 'Gardens awake', stars: 'Stars',
    zones: ['The first spark', 'Mirror gardens', 'The sun engine'], level: 'Level', locked: 'Locked · complete the previous level first',
    pulses: 'Pulses left', crystals: 'Crystals', goal: 'Awaken every crystal.', par: 'Three stars with at most {n} pulses',
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
  },
};

const langIndex = () => getLanguage() === 'de' ? 0 : 1;
const tr = (key, params = {}) => Object.entries(params).reduce((s, [key, val]) => s.replaceAll(`{${key}}`, String(val)), copy[getLanguage()]?.[key] || copy.en[key] || key);
const title = level => level.name[langIndex()];
const policy = () => ({ tier: document.body.dataset.perfMode || 'high', reduced: document.body.hasAttribute('data-reduced-motion'), maxImpacts: document.body.dataset.perfMode === 'low' ? 4 : 12 });
let cleanup = null;

export function openPrism({ onHome, challengeId = null }) {
  cleanup?.();
  const root = $('#prism');
  let arena = null, view = 'map', generation = 0, levelIndex = 0, paused = false, settled = false, challenge = false;
  let startupTimer = null, contextFailed = false;
  const listeners = new AbortController();
  const on = (el, type, handler) => el.addEventListener(type, handler, { signal: listeners.signal });
  const modal = () => $('#pwDialog');
  const closeDialog = () => { if (modal()) closeModal(modal(), { restoreFocus: false }); };
  const releaseArena = () => {
    clearTimeout(startupTimer); startupTimer = null;
    closeDialog(); generation++;
    setGameplayPerformanceActive(false);
    cancelHaptics(); app.releaseWakeLock?.();
    arena?.destroy(); arena = null;
    paused = false;
  };
  const leave = () => { cleanup?.(); onHome(); };

  function shell(body) {
    root.innerHTML = `<div class="pw-shell">
      <header class="pw-header"><button type="button" class="pw-icon-button" id="pwBack" aria-label="${tr(view === 'map' ? 'home' : 'map')}">←</button>
        <div class="pw-brand"><span class="pw-eyebrow">SCS PLAY PRESENTS</span><h1>Prism Worlds<span class="pw-brand-dot">.</span></h1></div>
        <button type="button" class="pw-icon-button" id="pwSound" aria-pressed="${app.save.getSetting('sound')}">${tr(app.save.getSetting('sound') ? 'sound' : 'soundOff')}</button>
      </header>${body}</div>`;
    root.scrollTop = 0;
  }

  function showMap() {
    releaseArena(); view = 'map'; settled = false; challenge = false;
    app.audio.setMusicMode('menu'); app.audio.startMusic();
    const progress = prismProgress(app.save.data);
    const next = progress.unlocked;
    shell(`<div class="pw-map-view">
      <section class="pw-world-art" aria-label="${tr('restored')}: ${progress.completed}/12">${prismIsland(progress.completed)}
        <div class="pw-world-caption"><span>${tr('restored')} <strong>${progress.completed}/12</strong></span><span>✦ <strong>${progress.stars}/36</strong> ${tr('stars')}</span></div>
      </section>
      <section class="pw-journey"><p class="pw-eyebrow">${tr('chapter')}</p><h2>${tr(progress.completed === 12 ? 'complete' : 'adventure')}</h2>
        <p class="pw-intro">${tr(progress.completed === 12 ? 'completeHelp' : 'intro')}</p>
        <p class="pw-next-preview">${tr('level')} ${progress.completed === 12 ? 1 : next + 1} · ${escHTML(title(PRISM_LEVELS[progress.completed === 12 ? 0 : next]))}</p>
        <button type="button" class="pw-primary" id="pwContinue">${tr(progress.completed === 12 ? 'replay' : progress.completed ? 'continue' : 'play')} <span aria-hidden="true">↗</span></button>
        <div class="pw-level-zones">${[0, 1, 2].map(zone => `<section class="pw-level-zone"><h3><span>0${zone + 1}</span> ${copy[getLanguage()]?.zones[zone] || copy.en.zones[zone]}</h3><div class="pw-level-grid">${PRISM_LEVELS.map((level, index) => {
          if (level.zone !== zone) return '';
          const result = progress.levels[level.id], unlocked = index <= next;
          return `<button type="button" class="pw-level${result ? ' pw-level--done' : ''}${index === next && !result ? ' pw-level--next' : ''}" data-pw-level="${index}" ${unlocked ? '' : 'disabled'} aria-label="${tr('level')} ${index + 1}: ${escHTML(title(level))}. ${unlocked ? `${result?.stars || 0}/3 ${tr('stars')}` : tr('locked')}" ${index === next && !result ? 'aria-current="step"' : ''}><span class="pw-level-number">${String(index + 1).padStart(2, '0')}</span><span class="pw-level-name">${escHTML(title(level))}</span><span class="pw-level-stars" aria-hidden="true">${result ? '✦'.repeat(result.stars) + '·'.repeat(3 - result.stars) : unlocked ? '→' : '·'}</span></button>`;
        }).join('')}</div></section>`).join('')}</div>
        <p class="pw-map-note">${getLanguage() === 'de' ? '12 handgestaltete Rätsel · kein Zeitlimit · offline spielbar' : '12 handcrafted puzzles · no time limit · playable offline'}</p>
        <p class="pw-map-note">${tr('starHelp')}</p>
      </section></div>`);
    $('#pwContinue').onclick = () => loadLevel(progress.completed === 12 ? 0 : next);
  }

  function makeDialog(heading, message, buttons, { dismiss } = {}) {
    closeDialog();
    modal()?.remove();
    const el = document.createElement('div');
    el.id = 'pwDialog'; el.className = 'pw-dialog'; el.setAttribute('aria-labelledby', 'pwDialogTitle');
    el.innerHTML = `<section class="pw-dialog-card"><span class="pw-eyebrow">PRISM WORLDS</span><h2 id="pwDialogTitle">${heading}</h2><div class="pw-result-art">${prismIsland(prismProgress(app.save.data).completed)}</div><p id="pwDialogMessage">${message}</p><div class="pw-dialog-actions"></div></section>`;
    for (const [id, label, action, primary] of buttons) {
      const button = document.createElement('button');
      button.id = id; button.type = 'button'; button.className = primary ? 'pw-primary' : 'pw-secondary'; button.textContent = label; button.onclick = action;
      el.querySelector('.pw-dialog-actions').appendChild(button);
    }
    root.querySelector('.pw-shell').appendChild(el);
    openModal(el, { onDismiss: dismiss || showMap });
  }

  function pause() {
    if (!arena || paused || settled || view !== 'game') return;
    paused = true; arena.scene.setPaused(true);
    setGameplayPerformanceActive(false); cancelHaptics(); app.audio.stopMusic(); app.releaseWakeLock?.();
    makeDialog(tr('pause'), tr('ready'), [
      ['pwResume', tr('resume'), resume, true], ['pwPauseRestart', tr('restart'), () => loadLevel(levelIndex, challenge)], ['pwPauseMap', tr('toMap'), showMap],
    ], { dismiss: resume });
  }

  function resume() {
    if (document.hidden || contextFailed) return;
    closeDialog(); paused = false;
    arena?.scene.setPaused(false); setGameplayPerformanceActive(true);
    app.audio.startMusic(); app.requestWakeLock?.();
  }

  async function finish(state) {
    if (settled) return;
    settled = true;
    arena.scene.settle();
    setGameplayPerformanceActive(false); app.releaseWakeLock?.();
    const token = generation, sim = arena.scene.simulation;
    if (state.phase === 'lost') {
      makeDialog(tr('lost'), tr('lostHelp'), [
        ['pwResultUndo', tr('undo'), () => { closeDialog(); settled = false; arena.scene.setPaused(false); arena.scene.undo(); app.requestWakeLock?.(); setGameplayPerformanceActive(true); }, true],
        ['pwResultRestart', tr('restart'), () => loadLevel(levelIndex, challenge)], ['pwResultMap', tr('toMap'), showMap],
      ], { dismiss: () => { closeDialog(); settled = false; arena.scene.setPaused(false); arena.scene.undo(); app.requestWakeLock?.(); setGameplayPerformanceActive(true); } });
      return;
    }
    makeDialog(tr('won'), challenge ? tr('challengeHelp') : tr('saving'), [
      ['pwNext', tr(challenge || levelIndex === 11 ? 'toMap' : 'next'), () => challenge || levelIndex === 11 ? showMap() : loadLevel(levelIndex + 1), true],
      ['pwResultReplay', tr('replay'), () => loadLevel(levelIndex, challenge)], ['pwShare', tr('share'), share],
    ]);
    const stars = document.createElement('div'); stars.className = 'pw-earned-stars'; stars.setAttribute('aria-label', `${state.stars}/3 ${tr('stars')}`);
    stars.textContent = '✦'.repeat(state.stars) + '·'.repeat(3 - state.stars);
    $('#pwDialogTitle').after(stars);
    const efficiency = document.createElement('p');
    efficiency.className = 'pw-efficiency';
    efficiency.textContent = tr('efficiency', { n: state.shots, par: sim.level.par });
    stars.after(efficiency);
    const next = $('#pwNext'); next.disabled = !challenge;
    if (challenge) return;
    const persist = async () => {
      try {
        $('#pwRetrySave')?.remove();
        const saved = await savePrismWin(app.save, sim);
        if (!saved) throw new Error('Campaign result not eligible');
        if (token !== generation) return;
        $('#pwDialogMessage').textContent = tr('saved');
        $('.pw-result-art').innerHTML = prismIsland(prismProgress(app.save.data).completed);
        next.disabled = false;
      } catch {
        if (token !== generation) return;
        $('#pwDialogMessage').textContent = tr('saveError');
        const button = document.createElement('button'); button.type = 'button'; button.id = 'pwRetrySave'; button.className = 'pw-secondary'; button.textContent = tr('retrySave'); button.onclick = persist;
        $('.pw-dialog-actions').prepend(button);
      }
    };
    await persist();
  }

  function update(state) {
    if (view !== 'game') return;
    const sim = arena?.scene.simulation;
    if (!sim) return;
    const count = state.nodes.filter(n => n.kind === 'crystal'), active = count.filter(n => n.active).length;
    $('#pwPulses').textContent = `${sim.level.shots - state.shots}`;
    $('#pwCrystals').textContent = `${active}/${count.length}`;
    $('#pwFire').disabled = state.phase !== 'ready' || paused;
    $('#pwUndo').disabled = !state.canUndo || paused;
    for (const button of root.querySelectorAll('[data-pw-color]')) {
      button.disabled = state.phase !== 'ready'; button.setAttribute('aria-pressed', String(button.dataset.pwColor === state.color));
    }
    $('#pwAimControls').disabled = state.phase !== 'ready';
    for (const button of root.querySelectorAll('[data-pw-target]')) {
      const node = state.nodes.find(n => n.id === button.dataset.pwTarget);
      button.disabled = state.phase !== 'ready' || Boolean(node?.active);
    }
    if (state.phase === 'won' || state.phase === 'lost') finish(state);
  }

  function signal(event) {
    if (view !== 'game' || paused) return;
    const el = $('#pwStatus');
    const messages = { launch: 'launch', reflect: 'reflect', paint: 'paintHit', switch: 'switchHit', mismatch: 'mismatch', miss: 'miss' };
    if (messages[event.kind]) el.textContent = tr(messages[event.kind]);
    if (event.kind === 'activate') {
      const n = arena.scene.simulation.nodes.filter(n => n.kind === 'crystal' && n.active).length;
      el.textContent = tr('chain', { n });
      // One bounded contact sound, not layered reward jingles.
      app.audio.gameImpact({ correct: true, quality: event.depth ? 'bonus' : 'good', streak: n, mode: 'memo' });
      if (!event.depth) haptic('correct', app.save);
    } else if (['reflect', 'paint', 'switch', 'launch'].includes(event.kind)) app.audio.tap();
    else if (event.kind === 'mismatch') app.audio.wrong();
  }

  function loadLevel(index, freePlay = false) {
    if (!Number.isInteger(index) || !PRISM_LEVELS[index] || (!freePlay && index > prismProgress(app.save.data).unlocked)) return;
    releaseArena(); levelIndex = index; challenge = freePlay; view = 'game'; settled = false;
    contextFailed = false;
    const level = PRISM_LEVELS[index], token = generation;
    shell(`<div class="pw-play-view"><div class="pw-level-heading"><div><p class="pw-eyebrow">${freePlay ? tr('challenge') : `${tr('level')} ${String(index + 1).padStart(2, '0')} / 12`}</p><h2>${escHTML(title(level))}</h2></div><button type="button" class="pw-icon-button" id="pwPause">Ⅱ <span>${tr('pause')}</span></button></div>
      <div class="pw-play-layout"><div class="pw-arena" id="pwArena"><p class="pw-loading">${tr('loading')}</p></div>
      <section class="pw-console" aria-label="${tr('controls')}"><div class="pw-stats"><div><span>${tr('crystals')}</span><strong id="pwCrystals">0</strong></div><div><span>${tr('pulses')}</span><strong id="pwPulses">${level.shots}</strong></div></div>
        <p class="pw-goal">${tr('goal')} <span>${tr('par', { n: level.par })}</span></p>
        <div class="pw-colors" aria-label="${getLanguage() === 'de' ? 'Energie wählen' : 'Choose energy'}">${level.colors.map(color => `<button type="button" data-pw-color="${color}" style="--energy:${PRISM_COLORS[color].css}" aria-pressed="${color === level.colors[0]}" aria-label="${PRISM_COLORS[color][getLanguage()]}"><span aria-hidden="true">${PRISM_COLORS[color].symbol}</span> ${PRISM_COLORS[color][getLanguage()].split(' · ')[0]}</button>`).join('')}</div>
        <fieldset id="pwAimControls" class="pw-aim-controls" aria-label="${tr('angle')}"><button type="button" id="pwLeft" class="pw-secondary" aria-label="${tr('left')}">↶</button><button type="button" id="pwFire" class="pw-primary">${tr('fire')} <span aria-hidden="true">↗</span></button><button type="button" id="pwRight" class="pw-secondary" aria-label="${tr('right')}">↷</button></fieldset>
        <div class="pw-tools"><button type="button" class="pw-text-button" id="pwUndo" disabled>↶ ${tr('undo')}</button><output id="pwAimReadout" class="pw-aim-readout" aria-label="${tr('aimValue', { degrees: 0 })}" aria-live="off">0°</output><button type="button" class="pw-text-button" id="pwRestart">↻ ${tr('restart')}</button></div>
        <p id="pwStatus" class="pw-status" role="status" aria-live="polite">${tr('ready')}</p>
        <p class="pw-tip">${escHTML(level.tip[langIndex()])}</p>
        <details class="pw-help"><summary>${tr('controls')}</summary><p>${tr('controlHelp')}</p><div class="pw-target-picker">${level.nodes.map((n, i) => `<button type="button" class="pw-secondary" data-pw-target="${n.id}">${tr('target')}: ${tr(n.kind)} ${i + 1}${n.color ? ` · ${PRISM_COLORS[n.color][getLanguage()]}` : ''}</button>`).join('')}</div></details>
        ${freePlay ? `<p class="pw-map-note">${tr('challengeHelp')}</p>` : ''}
      </section></div></div>`);
    try {
      startupTimer = setTimeout(() => {
        if (token !== generation) return;
        releaseArena();
        makeDialog('Prism Worlds', tr('graphicsError'), [['pwGraphicsRetry', tr('restart'), () => loadLevel(index, freePlay), true], ['pwGraphicsBack', tr('home'), leave]]);
      }, 10000);
      arena = createPrismArena($('#pwArena'), level, {
        ready: () => {
          if (token !== generation) return;
          clearTimeout(startupTimer); startupTimer = null;
          $('#pwArena .pw-loading')?.remove();
          if (document.hidden) pause();
        },
        state: state => { if (token === generation) update(state); },
        aim: point => {
          if (token !== generation) return;
          const degrees = Math.round(Math.atan2(point.x - level.launch.x, level.launch.y - point.y) * 180 / Math.PI);
          const readout = $('#pwAimReadout');
          readout.textContent = `${degrees > 0 ? '+' : ''}${degrees}°`;
          readout.setAttribute('aria-label', tr('aimValue', { degrees }));
        },
        signal: event => { if (token === generation) signal(event); },
        contextLost: event => {
          if (token !== generation) return;
          event.preventDefault(); contextFailed = true; paused = true;
          arena?.scene.setPaused(true);
          setGameplayPerformanceActive(false); app.releaseWakeLock?.(); cancelHaptics();
          makeDialog('Prism Worlds', tr('context'), [['pwGraphicsRestart', tr('restart'), () => loadLevel(index, freePlay), true], ['pwGraphicsMap', tr('toMap'), showMap]], { dismiss: showMap });
        },
      }, policy());
      app.audio.setMusicMode('endless'); app.audio.startMusic();
      app.requestWakeLock?.(); setGameplayPerformanceActive(true);
    } catch {
      releaseArena();
      makeDialog('Prism Worlds', tr('graphicsError'), [['pwGraphicsRetry', tr('restart'), () => loadLevel(index, freePlay), true], ['pwGraphicsBack', tr('home'), leave]]);
    }
    $('#pwFire').onclick = () => arena?.scene.fire();
    $('#pwLeft').onclick = () => arena?.scene.rotateAim(-5);
    $('#pwRight').onclick = () => arena?.scene.rotateAim(5);
    $('#pwUndo').onclick = () => { arena?.scene.undo(); if ($('#pwStatus')) $('#pwStatus').textContent = tr('ready'); };
    $('#pwRestart').onclick = () => loadLevel(index, freePlay);
    $('#pwPause').onclick = pause;
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
    if (target.id === 'pwBack') view === 'map' ? leave() : showMap();
    if (target.id === 'pwSound') {
      const sound = !app.save.getSetting('sound');
      app.save.setSetting('sound', sound).catch(() => appDialog({ title: 'Prism Worlds', message: tr('preferenceError') }));
      app.audio.toggle(sound); target.setAttribute('aria-pressed', String(sound)); target.textContent = tr(sound ? 'sound' : 'soundOff');
    }
    if (target.dataset.pwLevel != null) loadLevel(Number(target.dataset.pwLevel));
    if (target.dataset.pwColor) arena?.scene.selectColor(target.dataset.pwColor);
    if (target.dataset.pwTarget) {
      const node = arena?.scene.simulation.nodes.find(n => n.id === target.dataset.pwTarget);
      if (node) arena.scene.setAim(node);
    }
  });
  on(document, 'keydown', event => {
    if (app.currentScreen !== 'prism' || !arena || paused || settled) return;
    if (event.key === 'Escape') { event.preventDefault(); pause(); return; }
    if (event.target.closest('details,button,input,select')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); arena.scene.rotateAim(event.key === 'ArrowLeft' ? -5 : 5); }
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); arena.scene.fire(); }
  });
  on(document, 'visibilitychange', () => { if (document.hidden) pause(); });
  on(window, 'scs:native-pause', pause);
  on(window, 'scs:motionpreference', () => arena?.scene.setPolicy(policy()));
  on(window, 'scs:perftier', () => arena?.scene.setPolicy(policy()));
  on(window, 'resize', () => { if (window.innerHeight < 400 && view === 'game') pause(); });
  on(window, 'scs:screenchange', ({ detail }) => { if (detail.id !== 'prism') cleanup?.(); });

  cleanup = () => {
    listeners.abort(); releaseArena();
    root.innerHTML = ''; app.prismNavigation = null; cleanup = null;
  };
  app.prismNavigation = { back: () => { if (view === 'map') leave(); else if (!paused && !settled) pause(); else showMap(); } };
  showScreen('prism', app);
  showMap();
  const requested = PRISM_LEVELS.findIndex(level => level.id === challengeId);
  if (requested >= 0) loadLevel(requested, true);
}
