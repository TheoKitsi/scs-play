/* Authored, deterministic puzzles. Coordinates belong to the simulation, not
   the device. Solutions are test fixtures in scripts, never shipped hints. */
const crystal = (id, x, y, color = 'mint') => ({ id, kind: 'crystal', x, y, color });
const mirror = (id, x, y, slope = '/') => ({ id, kind: 'mirror', x, y, slope });
const paint = (id, x, y, color) => ({ id, kind: 'paint', x, y, color });
const relay = (id, x, y) => ({ id, kind: 'switch', x, y });
const gate = (id, x, y, width, height) => ({ id, kind: 'gate', x, y, width, height });

export const PRISM_COLORS = Object.freeze({
  mint: { hex: 0x78efc0, css: '#78efc0', symbol: '◆', de: 'Mint · Raute', en: 'Mint · diamond' },
  amber: { hex: 0xffcc76, css: '#ffcc76', symbol: '●', de: 'Gold · Kreis', en: 'Gold · circle' },
  violet: { hex: 0xc2a2ff, css: '#c2a2ff', symbol: '▲', de: 'Violett · Dreieck', en: 'Violet · triangle' },
});

export const PRISM_LEVELS = Object.freeze([
  { id: 'first-light', name: ['Erstes Licht', 'First light'], zone: 0, par: 1, shots: 3, colors: ['mint'],
    tip: ['Tippe auf den Kristall. Löse dann unten den Impuls aus – oder ziehe zum Zielen und lass los.', 'Tap the crystal, then launch below. Or drag to aim and release.'],
    nodes: [crystal('a', 210, 170)] },
  { id: 'resonance', name: ['Resonanz', 'Resonance'], zone: 0, par: 1, shots: 3, colors: ['mint'],
    tip: ['Gleiche Kristalle in Reichweite geben ihre Energie weiter. Ein Treffer kann alle drei wecken.', 'Nearby matching crystals pass energy along. One hit can awaken all three.'],
    nodes: [crystal('a', 85, 218), crystal('b', 130, 138), crystal('c', 172, 225)] },
  { id: 'two-frequencies', name: ['Zwei Frequenzen', 'Two frequencies'], zone: 0, par: 2, shots: 4, colors: ['mint', 'amber'],
    tip: ['Wähle unten das passende Symbol. Mint und Gold bilden getrennte Ketten.', 'Choose the matching symbol below. Mint and gold form separate chains.'],
    nodes: [crystal('a', 112, 180), crystal('b', 165, 110), crystal('c', 290, 180, 'amber'), crystal('d', 300, 270, 'amber')] },
  { id: 'around-the-ruins', name: ['An den Ruinen vorbei', 'Around the ruins'], zone: 0, par: 1, shots: 3, colors: ['mint'],
    tip: ['Mauern blockieren Licht – auch Ketten. Suche einen freien Weg links vorbei.', 'Walls block light, including chains. Find a clear route around the left.'],
    walls: [{ x: 178, y: 246, width: 64, height: 28 }],
    nodes: [crystal('a', 100, 150), crystal('b', 170, 80)] },
  { id: 'right-turn', name: ['Lichtkurve', 'A turn of light'], zone: 1, par: 1, shots: 3, colors: ['mint'],
    tip: ['Peile die Mitte des Spiegels an. Verfolge die gestrichelte Linie über den Knick hinaus.', 'Aim at the centre of the mirror. Follow the dotted line past the bend.'],
    walls: [{ x: 259, y: 367, width: 73, height: 16 }],
    nodes: [mirror('m', 170, 308), crystal('a', 295, 333), crystal('b', 315, 238)] },
  { id: 'other-side', name: ['Die andere Seite', 'The other side'], zone: 1, par: 1, shots: 3, colors: ['mint'],
    tip: ['Dieser Spiegel lenkt nach links. Die gestrichelte Vorschau zeigt den ersten Umlenkpunkt.', 'This mirror bends light left. The dotted guide shows the first reflection.'],
    walls: [{ x: 97, y: 400, width: 72, height: 16 }],
    nodes: [mirror('m', 255, 328, '\\'), crystal('a', 123, 361), crystal('b', 102, 264)] },
  { id: 'golden-hour', name: ['Goldene Stunde', 'Golden hour'], zone: 1, par: 1, shots: 3, colors: ['mint'],
    tip: ['Ein Farbring stimmt deinen Impuls um. Fliege durch den goldenen Ring zu den goldenen Kristallen.', 'A colour ring retunes your pulse. Pass through gold to awaken the golden crystals.'],
    nodes: [paint('p', 177, 343, 'amber'), crystal('a', 144, 178, 'amber'), crystal('b', 76, 146, 'amber'), crystal('c', 167, 90, 'amber')] },
  { id: 'prism-garden', name: ['Prismengarten', 'Prism garden'], zone: 1, par: 2, shots: 4, colors: ['mint'],
    tip: ['Zwei Wege, zwei Ketten. Nur der linke Weg führt durch den violetten Farbring.', 'Two paths, two chains. Only the left path passes through the violet ring.'],
    nodes: [paint('p', 150, 338, 'violet'), crystal('a', 90, 168, 'violet'), crystal('b', 150, 104, 'violet'), crystal('c', 320, 215), crystal('d', 300, 128)] },
  { id: 'open-the-sky', name: ['Öffne den Himmel', 'Open the sky'], zone: 2, par: 2, shots: 4, colors: ['mint'],
    tip: ['Triff zuerst den runden Schalter mit dem Blitz. Er öffnet alle Lichtschranken.', 'Hit the round lightning switch first. It opens every light barrier.'],
    gates: [gate('g', 40, 250, 340, 16)],
    nodes: [relay('s', 115, 338), crystal('a', 210, 145), crystal('b', 286, 135)] },
  { id: 'the-sun-engine', name: ['Das Sonnenwerk', 'The sun engine'], zone: 2, par: 2, shots: 4, colors: ['mint'],
    tip: ['Erst den Schalter rechts, dann durch den goldenen Ring. Plane die Reihenfolge deiner Impulse.', 'Switch on the right first, then through the golden ring. Plan your pulse order.'],
    gates: [gate('g', 40, 240, 340, 16)],
    nodes: [relay('s', 310, 350), paint('p', 210, 320, 'amber'), crystal('a', 210, 150, 'amber'), crystal('b', 135, 130, 'amber'), crystal('c', 285, 130, 'amber')] },
  { id: 'light-weaver', name: ['Lichtweber', 'Light weaver'], zone: 2, par: 1, shots: 3, colors: ['mint', 'violet'],
    tip: ['Der Schalter kann auch im Vorbeiflug auslösen. Schau, was zwischen den beiden Spiegeln liegt.', 'A pulse can trip the switch on its way past. Look between the two mirrors.'],
    gates: [gate('g', 238, 124, 65, 12)],
    nodes: [mirror('m', 158, 352), relay('s', 265, 388), mirror('n', 308, 402), paint('p', 266, 276, 'violet'), crystal('a', 230, 169, 'violet'), crystal('b', 282, 83, 'violet')] },
  { id: 'world-awake', name: ['Eine Welt erwacht', 'A world awake'], zone: 2, par: 3, shots: 5, colors: ['mint'],
    tip: ['Nutze alles Gelernte: Schalter links, Spiegel in der Mitte, freie Bahn ganz links. Jeder Kristall zählt.', 'Bring it together: switch on the left, mirror in the centre, clear path on the far left. Every crystal counts.'],
    gates: [gate('g', 40, 220, 340, 16)],
    nodes: [relay('s', 95, 390), mirror('m', 210, 330), mirror('n', 335, 330), paint('p', 335, 257, 'amber'), crystal('a', 335, 128, 'amber'), crystal('b', 285, 68, 'amber'), crystal('c', 60, 155), crystal('d', 100, 80)] },
].map(level => Object.freeze({ ...level, launch: { x: 210, y: 508 }, chainRadius: 116, walls: [], gates: [], ...level })));
