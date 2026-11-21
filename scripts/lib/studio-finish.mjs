/* Authored, periodic normal/roughness data. Build-time only: no noise, image
   readback or canvas/premultiplied colour conversion in the game. */
import { deflateSync } from 'node:zlib';

export function studioFinishPixels() {
  const width = 512, height = 128, tile = 128, inner = tile - 2;
  const pixels = new Uint8Array(width * height * 4);
  const noise = (x, y, period, seed) => {
    const [px, py] = Array.isArray(period) ? period : [period, period];
    const ix = Math.floor(x), iy = Math.floor(y), sx = x - ix, sy = y - iy;
    const smooth = t => t * t * (3 - 2 * t);
    const value = (a, b) => {
      let n = Math.imul((a % px + px) % px + seed, 374761393) ^ Math.imul((b % py + py) % py, 668265263);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const lerp = (a, b, t) => a + (b - a) * t;
    return lerp(lerp(value(ix, iy), value(ix + 1, iy), smooth(sx)), lerp(value(ix, iy + 1), value(ix + 1, iy + 1), smooth(sx)), smooth(sy));
  };
  for (let finish = 0; finish < 4; finish++) {
    const field = (x, y) => {
      const u = x / inner, v = y / inner, tau = Math.PI * 2;
      const broad = noise(u * 8, v * 8, 8, 191 + finish * 97) - .5;
      const fine = noise(u * 32, v * 32, 32, 811 + finish * 53) - .5;
      if (finish === 0) return broad * .12 + fine * .045; // glazed ceramic pores
      if (finish === 1) return (noise(u * 4, v * 48, [4, 48], 1409) - .5) * .2 + fine * .015; // irregular longitudinal brush
      if (finish === 2) return (noise(u * 12, v * 28, [12, 28], 1913) - .5) * .2 + broad * .3 + fine * .08; // honed slate
      return Math.sin(u * tau * 20) * Math.sin(v * tau * 19) * .035 + broad * .08 + fine * .045; // satin micro-weave
    };
    for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
      // One texel of wrapped padding prevents linear filtering into a neighbour.
      const xx = (x - 1 + inner) % inner, yy = (y - 1 + inner) % inner;
      const strength = [.55, .14, .85, .28][finish];
      const nx = (field(xx - 1, yy) - field(xx + 1, yy)) * strength;
      const ny = (field(xx, yy - 1) - field(xx, yy + 1)) * strength;
      const length = Math.hypot(nx, ny, 1), at = (y * width + finish * tile + x) * 4;
      pixels[at] = Math.round((nx / length * .5 + .5) * 255);
      pixels[at + 1] = Math.round((ny / length * .5 + .5) * 255);
      pixels[at + 2] = Math.round((1 / length * .5 + .5) * 255);
      pixels[at + 3] = Math.round(Math.max(.24, Math.min(.76, .5 + field(xx, yy) * .55)) * 255);
    }
  }
  return { width, height, pixels };
}

export function studioFinishPng() {
  const { width, height, pixels } = studioFinishPixels();
  const chunk = (name, data) => {
    const type = Buffer.from(name), bytes = Buffer.concat([type, data]);
    let crc = 0xffffffff;
    for (const value of bytes) {
      crc ^= value;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length); bytes.copy(result, 4); result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    // PNG's lossless Sub filter; straight RGBA, deliberately no gamma/profile.
    const row = y * (width * 4 + 1); rows[row] = 1;
    for (let x = 0; x < width * 4; x++) rows[row + x + 1] = (pixels[y * width * 4 + x] - (x >= 4 ? pixels[y * width * 4 + x - 4] : 0) + 256) % 256;
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
