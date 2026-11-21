/* Original presentation-only architecture. No collision, answers, clocks or
   persistence are derived from these solids; exact puzzle marks stay in 2D. */
const unit = v => { const length = Math.hypot(...v) || 1; return v.map(n => n / length); };
const shade = (hex, scale) => [16, 8, 0].reduce((color, shift) => color | Math.min(255, Math.round(((hex >> shift) & 255) * scale)) << shift, 0);

export function arcadeFrame(x, y, w, h, color) {
  // Follows the authored deck's opaque outer edge, not the task rectangles.
  return { kind: 'frame', x, y: y - h * .0088, w: w * .974, h: h * .936,
    cutX: w * .057, cutY: h * .041, thickness: 5, color, roughness: .32, metallic: .6, finish: 'alloy' };
}

export function prismArchitecture(level) {
  const material = [
    { color: 0x59786d, roughness: .62, metallic: .16, finish: 'slate' },
    { color: 0x708896, roughness: .34, metallic: .7, finish: 'alloy' },
    { color: 0xa78c5c, roughness: .36, metallic: .68, finish: 'alloy' },
  ][level.zone] || { color: 0x59786d, roughness: .62, metallic: .16, finish: 'slate' };
  const alloy = { color: 0x80998f, roughness: .25, metallic: .72, finish: 'alloy' };
  // Stop short of the existing corner foliage; no duplicated plant decals or
  // rails over playable crystals, even at the campaign's outermost positions.
  const parts = [
    { kind: 'beam', x: 210, y: 24, w: 280, h: 8, z: 7, ...material },
    { kind: 'beam', x: 24, y: 274, w: 374, h: 7, z: 8, angle: Math.PI / 2, ...material },
    { kind: 'beam', x: 397, y: 276, w: 352, h: 7, z: 8, angle: Math.PI / 2, ...material },
    { kind: 'beam', x: 210, y: 525, w: 228, h: 8, z: 7, ...material },
    { kind: 'ring', x: level.launch.x, y: level.launch.y + 4, w: 62, h: 31, ...alloy },
  ];
  for (const wall of level.walls) parts.push({ kind: 'beam', x: wall.x + wall.width / 2, y: wall.y + wall.height / 2,
    w: wall.width, h: wall.height, z: 15, color: 0x66747b, roughness: .64, metallic: .12, finish: 'slate' });
  for (const gate of level.gates) for (const x of [gate.x + .5, gate.x + gate.width - .5]) parts.push({
    kind: 'beam', x, y: gate.y + gate.height / 2, w: 9, h: gate.height + 8, z: 10, ...alloy });
  for (const node of level.nodes) {
    if (node.kind === 'mirror') {
      const sign = node.slope === '/' ? -1 : 1;
      parts.push({ kind: 'beam', x: node.x, y: node.y, w: Math.hypot(84, 84), h: 11, z: 9,
        angle: Math.atan2(sign, 1), ...alloy });
      for (const dx of [-42, 42]) parts.push({ kind: 'post', x: node.x + dx, y: node.y + dx * sign, w: 8, h: 8, z: 7, ...alloy });
    } else if (node.kind === 'paint' || node.kind === 'switch') parts.push({ kind: 'ring', x: node.x, y: node.y, w: 58, h: 58, ...alloy });
  }
  return parts;
}

export function studioArchitecture(item, triangle) {
  if (!['frame', 'ring', 'beam', 'post'].includes(item.kind)) return false;
  const quad = (a, b, c, d, material, normals = null) => {
    triangle(a, b, c, material, normals ? [normals[0], normals[1], normals[0]] : null);
    triangle(b, d, c, material, normals ? [normals[1], normals[1], normals[0]] : null);
  };
  const height = item.kind === 'frame' ? 14 : item.kind === 'ring' ? 7 : item.z || 8;
  const point = (x, y, z) => {
    const angle = item.angle || 0, c = Math.cos(angle), s = Math.sin(angle);
    return [item.x + x * c - y * s - height * .16, item.y + x * s + y * c + height * .35, z];
  };
  const contour = (inset, z) => {
    const w = item.w / 2 - inset, h = item.h / 2 - inset;
    const cx = Math.max(.25, (item.cutX || Math.min(item.w, item.h) * .2) - inset * .4);
    const cy = Math.max(.25, (item.cutY || Math.min(item.w, item.h) * .2) - inset * .4);
    return [[-w + cx, -h], [w - cx, -h], [w, -h + cy], [w, h - cy], [w - cx, h], [-w + cx, h], [-w, h - cy], [-w, -h + cy]]
      .map(([x, y]) => point(x, y, z));
  };
  if (item.kind === 'frame') {
    const layers = [[0, 0], [0, 11], [1, height]], outer = layers.map(([inset, z]) => contour(inset, z));
    const inner = layers.map(([inset, z]) => contour(item.thickness - inset, z));
    for (let i = 0; i < 8; i++) {
      const next = (i + 1) % 8;
      for (let band = 0; band < 2; band++) {
        const material = { ...item, color: shade(item.color, band ? 1.12 : .62) };
        quad(outer[band][i], outer[band][next], outer[band + 1][i], outer[band + 1][next], material);
        quad(inner[band][next], inner[band][i], inner[band + 1][next], inner[band + 1][i], material);
      }
      quad(outer[2][i], outer[2][next], inner[2][i], inner[2][next], item, [[0, 0, 1], [0, 0, 1]]);
      quad(outer[0][next], outer[0][i], inner[0][next], inner[0][i], item, [[0, 0, -1], [0, 0, -1]]);
    }
    // Four closed, eight-sided mounting pins, integrated in this one descriptor.
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x = sx * (item.w / 2 - item.cutX / 2 - 1.8), y = sy * (item.h / 2 - item.cutY / 2 - 1.8);
      const pin = { ...item, color: 0x82968f, roughness: .29 };
      for (let i = 0; i < 8; i++) {
        const p = (j, z) => point(x + Math.cos(j * Math.PI / 4) * 1.35, y + Math.sin(j * Math.PI / 4) * 1.35, z);
        quad(p(i, height), p(i + 1, height), p(i, height + 1.4), p(i + 1, height + 1.4), pin);
        triangle(point(x, y, height + 1.4), p(i, height + 1.4), p(i + 1, height + 1.4), pin, [0, 0, 1]);
        triangle(point(x, y, height), p(i + 1, height), p(i, height), pin, [0, 0, -1]);
      }
    }
    return true;
  }
  if (item.kind === 'beam') {
    const rings = [[0, 0], [0, height - 1.5], [.8, height]].map(([inset, z]) => contour(inset, z));
    for (let i = 0; i < 8; i++) {
      const next = (i + 1) % 8;
      for (let band = 0; band < 2; band++) quad(rings[band][i], rings[band][next], rings[band + 1][i], rings[band + 1][next],
        { ...item, color: shade(item.color, band ? 1.08 : .65), roughness: band ? .22 : item.roughness });
      triangle(point(0, 0, height), rings[2][i], rings[2][next], item, [0, 0, 1]);
      triangle(point(0, 0, 0), rings[0][next], rings[0][i], item, [0, 0, -1]);
    }
    return true;
  }
  const profiles = item.kind === 'ring' ? [[1, 0], [1, 3], [.92, 7], [.72, 7], [.66, 3], [.7, 0]] : [[0, 0], [1, 0], [1, height - 1], [.78, height], [0, height]];
  const sides = item.kind === 'ring' ? 20 : 8;
  for (let band = 0; band < profiles.length; band++) {
    const [r, z] = profiles[band], [rr, zz] = profiles[(band + 1) % profiles.length];
    const material = { ...item, color: shade(item.color, item.kind === 'ring' ? [.72, .95, 1.12, .55, .45, .4][band] : 1),
      roughness: item.kind === 'ring' && band === 2 ? .2 : item.roughness };
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2;
      const p = (angle, radius, depth) => point(Math.cos(angle) * item.w / 2 * radius, Math.sin(angle) * item.h / 2 * radius, depth);
      const n = angle => {
        const [x, y, depth] = unit([Math.cos(angle) * (zz - z) / (item.w / 2), Math.sin(angle) * (zz - z) / (item.h / 2), r - rr]);
        const rotation = item.angle || 0;
        return [x * Math.cos(rotation) - y * Math.sin(rotation), x * Math.sin(rotation) + y * Math.cos(rotation), depth];
      };
      quad(p(a, r, z), p(b, r, z), p(a, rr, zz), p(b, rr, zz), material, [n(a), n(b)]);
    }
  }
  return true;
}
