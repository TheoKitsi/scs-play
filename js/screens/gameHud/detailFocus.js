const chaosCue = {
  de: { color: 'Farbe zuordnen', shape: 'Form zuordnen', size: 'Größe vergleichen', math: 'Ergebnis finden', stroop: 'Schriftfarbe wählen' },
  en: { color: 'Match the color', shape: 'Match the shape', size: 'Match the size', math: 'Find the result', stroop: 'Match the ink' },
};

// The engine selects the next rule on answer, before replacing currentShape.
// Use that rule through the gap. The existing switch notice handles announcements.
export function updateFocus(root, game, phase, lang) {
  if (!root || (game?.mode !== 'chaos' && !root.hasAttribute('data-focus-rule'))) return;
  const label = root.querySelector('#modeRuleLabel');
  const rule = game?.mode === 'chaos' && (game._chaosRule || game.currentShape?.chaosRule);
  const cues = chaosCue[lang] || chaosCue.en;
  if (!label || !Object.hasOwn(cues, rule)) {
    if (label?.dataset.focusCue && label.textContent === label.dataset.focusCue) label.textContent = '';
    if (label?.dataset.focusCue) delete label.dataset.focusCue;
    root.removeAttribute('data-focus-rule');
    return;
  }
  const text = cues[rule];
  if (label.textContent !== text) label.textContent = text;
  if (label.dataset.focusCue !== text) label.dataset.focusCue = text;
  if (root.dataset.focusRule !== rule) root.dataset.focusRule = rule;
}
