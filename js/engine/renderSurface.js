/* Backing pixels, not game coordinates. Both engines use the same bounded
   density policy; high-DPI never changes targets, ray geometry or hit testing. */
export function renderSurface(width, height, tier = 'high', density = 1) {
  const w = Number.isFinite(Number(width)) ? Math.max(1, Number(width)) : 1;
  const h = Number.isFinite(Number(height)) ? Math.max(1, Number(height)) : 1;
  const budget = tier === 'low' ? 640 * 960 : tier === 'mid' ? 900 * 1200 : 1024 * 1536;
  const ceiling = tier === 'low' ? 1 : tier === 'mid' ? 1.5 : 2;
  const ratio = Math.min(Math.max(1, Number(density) || 1), ceiling, Math.sqrt(budget / (w * h)), 3072 / Math.max(w, h));
  return { width: Math.max(1, Math.floor(w * ratio)), height: Math.max(1, Math.floor(h * ratio)), zoom: ratio };
}
