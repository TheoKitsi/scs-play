/* A single stroke language for UI, independent of the gameplay palette. */
const PATHS = {
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-3 2-3h2a3 3 0 0 0 3-3 9 9 0 0 0-9-8Z"/><path d="M7 9h.01M11 6h.01M16 8h.01M6 14h.01"/>',
  ruler: '<path d="m3 16 13-13 5 5L8 21zM12 7l2 2M9 10l2 2M6 13l2 2"/>',
  shapes: '<circle cx="7" cy="7" r="4"/><path d="m16 3 5 8H11z"/><rect x="5" y="15" width="8" height="6" rx="1"/>',
  chart: '<path d="M4 20V4m0 16h17M8 15l4-5 4 2 4-7"/>',
  star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
  fire: '<path d="M13 3c1 6-5 5-5 10-2-1-2-3-2-3-6 10 12 16 13 5 0-4-3-6-3-6s0 4-3 4c3-5 0-10 0-10Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  'face-1': '<circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01M8 16q4-4 8 0"/>',
  'face-2': '<circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01M8 15h8"/>',
  'face-3': '<circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01M8 14q4 5 8 0"/>',
  'face-4': '<circle cx="12" cy="12" r="9"/><path d="m6 10 2-2 2 2m4 0 2-2 2 2M7 14q5 7 10 0Z"/>',
};

export function icon(name) {
  return `<svg class="ui-icon line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name] || PATHS.shapes}</svg>`;
}

export function directionIcon(direction) {
  const rotation = ({ '→': 0, '↓': 90, '←': 180, '↑': 270 })[direction] ?? 0;
  return `<svg class="ui-icon line-icon direction-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path transform="rotate(${rotation} 12 12)" d="M4 12h16m-6-6 6 6-6 6"/></svg>`;
}
