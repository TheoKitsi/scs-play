import { PRISM_LEVELS } from '../game/prism/levels.js';
import { MATERIAL_ASSETS } from '../engine/materialAssets.js';

/* Sanitized campaign records only, never live puzzle/answer data. A record in
   the Sun Engine must not restore the first garden by aggregate arithmetic. */
export function prismRegions(progress) {
  return [0, 1, 2].map(zone => PRISM_LEVELS.filter(level => level.zone === zone && progress?.levels?.[level.id]).length);
}

/** Original baked island frames, shared by home, map, regions and results.
 * The simple geometry beneath each image is also an unavailable-art fallback.
 * No filters, animation, generated IDs or runtime texture generation. */
export function prismIsland(progress, zone = null) {
  const regions = prismRegions(progress);
  const island = (index, x = 0, y = 0, width = 640, height = 480) => `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 640 480" overflow="hidden" data-pw-region="${index}" data-restored="${regions[index]}">
    <g fill="#223b4b"><path d="m205 260 112-30 116 30-40 65-82 23-87-32Z"/><path d="m205 260 112-30 116 30-116 34Z" fill="#57776f"/>
      ${index === 2 ? '<circle cx="320" cy="262" r="18" fill="none" stroke="#b59f72" stroke-width="3"/>' : index === 1 ? '<path d="M291 267v-23l20 5v23Zm40 0v-23l20 5v23Z" fill="#99b6bc"/>' : '<path d="m320 242 12 22-12 13-12-13Z" fill="#9aafa1"/>'}
    </g><image href="${MATERIAL_ASSETS.islands[index]}" x="${-regions[index] * 640}" width="3200" height="480"/></svg>`;
  if (Number.isInteger(zone) && zone >= 0 && zone <= 2) return `<svg class="pw-islands pw-islands--region" viewBox="0 0 640 480" aria-hidden="true" focusable="false">${island(zone)}</svg>`;
  return `<svg class="pw-islands" viewBox="0 0 600 400" aria-hidden="true" focusable="false">
    <g fill="#c3d9da" opacity=".045"><ellipse cx="78" cy="173" rx="123" ry="13"/><ellipse cx="464" cy="87" rx="150" ry="10"/><ellipse cx="367" cy="357" rx="180" ry="11"/></g>
    <path d="m153 264 147-113 153 122" fill="none" stroke="#4c6c7a" stroke-width="2" stroke-dasharray="2 8"/>
    ${island(1, 153, 0, 310, 233)}${island(0, -29, 143, 340, 255)}${island(2, 291, 148, 340, 255)}
    <g fill="#c6e5e3" opacity=".5"><circle cx="72" cy="97" r="1.2"/><circle cx="511" cy="163" r="1.2"/><circle cx="349" cy="364" r="1"/></g>
  </svg>`;
}
