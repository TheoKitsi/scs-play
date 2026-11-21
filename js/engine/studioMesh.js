/* Original bounded 3D meshes. Coordinates are presentation-only: no collision,
   answer, timer or hit-test code depends on these vertices. */
import { studioArchitecture } from './studioArchitecture.js';
const rgb = hex => [16, 8, 0].map(shift => ((hex >> shift) & 255) / 255);
const shade = (hex, scale) => [16, 8, 0].reduce((color, shift) => color | Math.min(255, Math.round(((hex >> shift) & 255) * scale)) << shift, 0);
const unit = v => { const n = Math.hypot(...v) || 1; return v.map(c => c / n); };
export const STUDIO_VERTEX_FLOATS = 13;
export const STUDIO_FINISHES = Object.freeze({ ceramic: 0, alloy: 1, slate: 2, satin: 3 });

export function studioMesh(objects) {
  const data = [];
  const vertex = (p, n, material) => data.push(...p, ...n, ...rgb(material.color), material.roughness ?? .4, material.metallic ?? .12,
    material.kind === 'station' ? -1 : material.kind === 'frame' ? -2 : material.emission || 0,
    material.kind === 'crystal' ? -1 : STUDIO_FINISHES[material.finish] ?? 0);
  const triangle = (a, b, c, material, normal = null) => {
    const u = b.map((v, i) => v - a[i]), v = c.map((v, i) => v - a[i]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...cross) < .000001) return;
    const smooth = normal && Array.isArray(normal[0]);
    const n = smooth ? normal : [normal || unit(cross), normal || unit(cross), normal || unit(cross)];
    vertex(a, n[0], material); vertex(b, n[1], material); vertex(c, n[2], material);
  };
  for (const item of objects.slice(0, 32)) {
    if (studioArchitecture(item, triangle)) continue;
    if (item.kind === 'crystal') {
      // A closed octagonal cut: foot, pavilion, crown and a small table. Ring
      // centres compensate only the shared oblique projection, not hit geometry.
      const sides = 8, height = item.h;
      const rings = [[.2, .38, 6, .5], [.5, .06, 24, 0], [.31, -.28, 41, .5], [.12, -.51, 51, 0]].map(([radius, y, z, turn]) =>
        Array.from({ length: sides }, (_, i) => {
          const a = (i + turn) * Math.PI * 2 / sides + Math.PI / 8;
          return [item.x - z * .16 + Math.cos(a) * item.w * radius, item.y + height * y + z * .35 + Math.sin(a) * item.w * radius * .5, z];
        }));
      for (let layer = 0; layer < rings.length - 1; layer++) for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides, a = rings[layer][i], b = rings[layer][next], c = rings[layer + 1][i], d = rings[layer + 1][next];
        triangle(a, b, c, item); triangle(b, d, c, item);
      }
      for (const layer of [0, rings.length - 1]) {
        const ring = rings[layer], center = ring.reduce((sum, p) => sum.map((v, i) => v + p[i] / sides), [0, 0, 0]);
        for (let i = 0; i < sides; i++) triangle(center, ring[layer ? i : (i + 1) % sides], ring[layer ? (i + 1) % sides : i], item);
      }
      continue;
    }
    const w = Math.max(12, item.w), h = Math.max(12, item.h), radius = Math.min(item.r || 12, w / 2, h / 2);
    const z = item.z || 10, rings = [[0, 0], [0, 3], [1.5, z - 2], [4, z]];
    const perimeter = (inset, depth) => {
      const points = [], r = Math.max(1, radius - inset);
      for (const [cx, cy, start] of [[-w / 2 + radius, -h / 2 + radius, Math.PI], [w / 2 - radius, -h / 2 + radius, Math.PI * 1.5], [w / 2 - radius, h / 2 - radius, 0], [-w / 2 + radius, h / 2 - radius, Math.PI / 2]]) {
        for (let i = 0; i <= 12; i++) {
          const a = start + i / 12 * Math.PI / 2;
          points.push([item.x + cx + Math.cos(a) * r - z * .16, item.y + cy + Math.sin(a) * r + z * .35, depth]);
        }
      }
      return points;
    };
    const layers = rings.map(([inset, depth]) => perimeter(inset, depth));
    for (let layer = 0; layer < layers.length - 1; layer++) for (let i = 0; i < layers[0].length; i++) {
      const next = (i + 1) % layers[0].length;
      const a = layers[layer][i], b = layers[layer][next], c = layers[layer + 1][i], d = layers[layer + 1][next];
      const material = { ...item, color: shade(item.color, [.55, .78, 1.08][layer]), roughness: layer === 2 ? Math.max(.18, (item.roughness ?? .4) * .65) : item.roughness ?? .4,
        metallic: layer === 2 ? Math.max(.52, item.metallic ?? .12) : item.metallic ?? .12, finish: layer === 2 ? 'alloy' : item.finish };
      const normalAt = index => {
        const angle = Math.PI + Math.floor(index / 13) * Math.PI / 2 + (index % 13) / 12 * Math.PI / 2;
        const dz = rings[layer + 1][1] - rings[layer][1], inset = rings[layer + 1][0] - rings[layer][0];
        return unit([Math.cos(angle) * dz, Math.sin(angle) * dz, inset]);
      };
      const na = normalAt(i), nb = normalAt(next);
      triangle(a, b, c, material, [na, nb, na]); triangle(b, d, c, material, [nb, nb, na]);
    }
    const cap = layers.at(-1), lift = Math.min(3.5, Math.min(w, h) * .035), center = [item.x - z * .16, item.y + z * .35, z + lift];
    const capNormal = p => unit([2 * lift * (p[0] - center[0]) / (w / 2 - 4) ** 2, 2 * lift * (p[1] - center[1]) / (h / 2 - 4) ** 2, 1]);
    for (let i = 0; i < cap.length; i++) {
      const next = (i + 1) % cap.length;
      triangle(center, cap[i], cap[next], item, [[0, 0, 1], capNormal(cap[i]), capNormal(cap[next])]);
    }
  }
  return new Float32Array(data);
}
