/* Authored conservatory / precision-instrument artwork. This entire function
   runs in the build-time browser, never in the game. Texture grain, relief,
   directional lighting, leaves and crystal facets are baked into WebP. */
export function drawMaterialArt({ kind, zone = 0, mode = 'klassik' }) {
  const canvas = document.createElement('canvas');
  canvas.width = kind === 'island' ? 3200 : kind === 'crystals' ? 1280 : kind === 'deck' ? 768 : 840;
  canvas.height = kind === 'island' ? 480 : kind === 'crystals' ? 192 : kind === 'deck' ? 1024 : 1120;
  const ctx = canvas.getContext('2d');
  let seed = 1097 + zone * 191;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const path = points => { ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); };
  const poly = (points, fill, stroke = null, line = 1) => { path(points); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); } };
  const ellipse = (x, y, rx, ry, fill) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  const linear = (x, y, xx, yy, stops) => { const g = ctx.createLinearGradient(x, y, xx, yy); stops.forEach(([at, c]) => g.addColorStop(at, c)); return g; };
  const glow = (x, y, r, color) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  const line = (points, color, width = 1) => { ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); };
  const round = (x, y, w, h, r, fill) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); };
  const grain = (x, y, w, h, count, alpha = .035) => {
    for (let i = 0; i < count; i++) { ctx.fillStyle = `rgba(${random() > .5 ? '255,255,255' : '0,0,0'},${random() * alpha})`; ctx.fillRect(x + random() * w, y + random() * h, random() < .9 ? .6 : 1.5, .6); }
  };
  const ring = (x, y, rx, ry, color, width = 1, start = 0, end = Math.PI * 2) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, start, end); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); };

  // Mineral strata at three spatial scales rather than white noise painted
  // over a flat slab. Fixed light from the top left catches raised grain.
  function honedStone() {
    const slab = document.createElement('canvas');
    slab.width = 420; slab.height = 560;
    const c = slab.getContext('2d'), image = c.createImageData(420, 560);
    const field = Float32Array.from({ length: 128 * 128 }, random);
    const noise = (x, y) => {
      const i = Math.floor(x), j = Math.floor(y);
      let u = x - i, v = y - j;
      u *= u * (3 - 2 * u); v *= v * (3 - 2 * v);
      const sample = (a, b) => field[(b & 127) * 128 + (a & 127)];
      return (sample(i,j) * (1-u) + sample(i+1,j) * u) * (1-v)
        + (sample(i,j+1) * (1-u) + sample(i+1,j+1) * u) * v;
    };
    for (let y = 0; y < 560; y++) for (let x = 0; x < 420; x++) {
      const warp = noise(x / 78, y / 71) * 20;
      const layer = noise(x / 63, (y + x * .42 + warp) / 6);
      const mica = noise(x / 5, y / 3);
      const vein = Math.max(0, 1 - Math.abs(layer - .59) * 29);
      const luminance = Math.round(101 + layer * 29 + mica * 16 + vein * 29 + (random() - .5) * 13);
      const k = (y * 420 + x) * 4;
      image.data[k] = luminance + 4; image.data[k+1] = luminance + 2; image.data[k+2] = luminance; image.data[k+3] = 255;
    }
    c.putImageData(image, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .8;
    ctx.drawImage(slab, 0, 0); ctx.restore();
  }

  function fern(x, y, length, angle) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.shadowColor = '#071c2380'; ctx.shadowBlur = 2; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
    for (let i = 0; i < 11; i++) {
      const t = i / 11, reach = length * .27 * Math.sin(Math.PI * (.15 + .85 * t));
      const bx = t * t * length * .19, by = -t * length;
      for (const side of [-1, 1]) {
        const tip = bx + side * reach * (.8 + .2 * random());
        poly([[bx, by], [bx + side * reach * .52, by - 2], [tip, by - reach * .8],
          [bx + side * reach * .36, by - reach * .5]], side < 0 ? '#739480' : '#436e62');
      }
    }
    line([[0, 1], [length * .04, -length * .48], [length * .19, -length]], '#b3bfa06e', .7);
    ctx.restore();
  }

  function leaf(x, y, size, angle, tint = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-size * .5, -size * .45, -size * .4, -size, 0, -size * 1.4); ctx.bezierCurveTo(size * .5, -size, size * .5, -size * .3, 0, 0);
    ctx.fillStyle = linear(-size * .4, 0, size * .4, 0, [[0, '#122d2c'], [.48, tint ? '#6d9580' : '#406f61'], [.51, '#244a42'], [1, '#173f3b']]);
    ctx.fill(); line([[0, 0], [0, -size * 1.2]], '#a9cda12b', .5); ctx.restore();
  }
  function plant(x, y, size, index) {
    ellipse(x + 3, y + size * .18, size * 1.2, size * .4, '#020c10a0');
    for (let i = 0; i < 9; i++) leaf(x, y, size * (.5 + random() * .5), (i / 9 * Math.PI * 2) - .7, (index + i) % 4 === 0);
    ellipse(x - 1, y - 1, 2, 2, '#8da886');
  }
  function stone(x, y, s, tilt = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    ellipse(3, s * .45, s * 1.2, s * .5, '#0009');
    poly([[-s, 0], [-s * .6, -s * .65], [s * .4, -s * .8], [s, -s * .2], [s * .8, s * .6], [-s * .5, s * .55]], '#283d40');
    poly([[-s, 0], [-s * .6, -s * .65], [s * .4, -s * .8], [s * .65, -s * .1], [-s * .15, s * .2]], '#4d6666');
    poly([[s * .4, -s * .8], [s, -s * .2], [s * .8, s * .6], [s * .65, -s * .1]], '#344d51');
    line([[-s * .6, -s * .65], [s * .4, -s * .8], [s * .65, -s * .1]], '#adc1ae42', .6);
    ctx.restore();
  }

  if (kind === 'deck') {
    // Neutral luminous ceramic. Tinting in Phaser makes the same relief obey
    // the selected theme without baking any stimulus colour into the stage.
    ctx.scale(2, 2);
    const outline = [[25, 12], [359, 12], [379, 33], [379, 471], [359, 491], [25, 491], [5, 471], [5, 33]];
    ctx.save(); ctx.shadowColor = '#000b'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 7; poly(outline, '#555'); ctx.restore();
    poly(outline.map(([x, y]) => [x, y + 8]), '#424242');
    poly(outline, linear(0, 0, 384, 512, [[0, '#e6e6e6'], [.45, '#aaaaaa'], [1, '#737373']]), '#ddd', .6);
    const inset = [[28, 17], [356, 17], [374, 36], [374, 468], [356, 485], [28, 485], [10, 468], [10, 36]];
    poly(inset, linear(0, 0, 300, 500, [[0, '#dadada'], [.5, '#b6b6b6'], [1, '#979797']]));
    ctx.save(); path(inset); ctx.clip();
    glow(60, 5, 340, '#ffffff36');
    grain(0, 0, 384, 512, 42000, .13);
    // Different instruments, not a recoloured common blueprint. All marks are
    // neutral and static; no stimulus, hidden symbol or answer enters this art.
    if (mode === 'klassik' || mode === 'expert' || mode === 'fokus') {
      const rx = mode === 'fokus' ? 113 : mode === 'expert' ? 148 : 123;
      const ry = mode === 'fokus' ? 125 : mode === 'expert' ? 169 : 151;
      if (mode === 'klassik') {
        // Recessed ceramic dial with a cut metal lip. Neutral even at the
        // brightest highlight: the four swatches alone carry the answer.
        ring(192, 252, rx + 1, ry + 1, '#25252568', 4);
        ring(192, 250, rx, ry, linear(55, 88, 320, 419, [[0, '#fbfbfb'], [.32, '#ababab'], [.57, '#646464'], [.82, '#c3c3c3'], [1, '#747474']]), 3);
        ring(192, 250, rx - 3, ry - 3, '#40404055', 1);
      }
      ring(192, 251, rx, ry, '#22222225', 1);
      ring(192, 250, rx - 2, ry - 2, '#ffffff35', .7);
      if (mode === 'fokus') for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        poly([[192 + Math.cos(a) * 96, 251 + Math.sin(a) * 108], [192 + Math.cos(a + .5) * 114, 251 + Math.sin(a + .5) * 126], [192 + Math.cos(a + .8) * 123, 251 + Math.sin(a + .8) * 135]], '#00000016', '#ffffff18', .5);
      }
      else for (let i = 0; i < (mode === 'expert' ? 96 : 48); i++) {
        const a = i / (mode === 'expert' ? 96 : 48) * Math.PI * 2;
        line([[192 + Math.cos(a) * (rx + 5), 251 + Math.sin(a) * (ry + 5)], [192 + Math.cos(a) * (rx + (i % 4 ? 8 : 12)), 251 + Math.sin(a) * (ry + (i % 4 ? 8 : 12))]], '#22222245', .6);
      }
    } else if (mode === 'beginner') {
      round(35, 104, 314, 299, 64, linear(35, 104, 349, 403, [[0, '#ffffff28'], [1, '#00000014']]));
      for (const y of [108, 399]) line([[107, y], [277, y]], '#ffffff58', 1.2);
      for (const x of [40, 344]) for (let i = 0; i < 3; i++) ellipse(x, 240 + i * 11, 1.4, 1.4, '#33333355');
    } else if (mode === 'mathe') {
      for (let i = 0; i < 60; i++) { const y = 43 + i * 7; line([[23, y], [i % 5 ? 29 : 36, y]], '#22222266', .6); }
      for (let i = 0; i < 32; i++) { const x = 52 + i * 9; line([[x, 469], [x, i % 5 ? 465 : 458]], '#22222266', .6); }
      line([[57, 401], [57, 110]], '#00000025', 1); line([[58, 402], [325, 402]], '#ffffff60', 1);
      ctx.beginPath(); ctx.moveTo(66, 384); ctx.bezierCurveTo(130, 374, 248, 179, 325, 137); ctx.strokeStyle = '#33333335'; ctx.lineWidth = 1; ctx.stroke();
    } else if (mode === 'wissen') {
      for (const side of [-1, 1]) {
        poly([[192 + side * 5, 95], [192 + side * 147, 110], [192 + side * 147, 407], [192 + side * 5, 392]], linear(30, 90, 350, 410, [[0, '#ffffff30'], [1, '#33333320']]));
        for (let i = 0; i < 4; i++) line([[192 + side * 15, 116 + i * 5], [192 + side * 131, 128 + i * 5]], '#33333330', .7);
      }
      line([[192, 72], [192, 434]], '#33333366', 1); line([[194, 72], [194, 434]], '#ffffff70', 1);
    } else if (mode === 'memo') {
      for (const y of [106, 371]) {
        round(34, y + 3, 316, 34, 6, '#44444425'); round(34, y, 316, 32, 6, '#ffffff28');
        for (let x = 43; x < 344; x += 5) { line([[x, y + 4], [x, y + 27]], '#00000020', .6); line([[x + 1, y + 4], [x + 1, y + 27]], '#ffffff38', .6); }
      }
      for (const x of [44, 340]) line([[x, 164], [x, 338]], '#3333333a', 1);
    } else if (mode === 'sequenz') {
      for (const side of [-1, 1]) {
        const x = 192 + side * 137;
        line([[192 + side * 55, 92], [x - side * 12, 92], [x, 104], [x, 399], [x - side * 12, 411], [192 + side * 55, 411]], '#33333350', 1.5);
        for (const y of [151, 351]) { ellipse(x, y, 6, 6, '#44444470'); ellipse(x - 1, y - 1, 4, 4, '#e1e1e1'); ellipse(x, y, 2, 2, '#999'); }
      }
    } else if (mode === 'stroop') {
      for (const side of [-1, 1]) {
        const x = side < 0 ? 29 : 211;
        poly([[x, 99], [x + 144, 77], [x + 144, 405], [x, 427]], linear(x, 110, x + 144, 420, [[0, '#ffffff30'], [.5, '#ffffff05'], [1, '#33333328']]));
        for (let i = 0; i < 140; i++) line([[x + 5, 105 + i * 2.15], [x + 139, 85 + i * 2.15]], '#ffffff0c', .45);
      }
    } else if (mode === 'chaos') {
      for (const points of [[[23, 118], [155, 89], [110, 174], [23, 201]], [[361, 113], [253, 89], [298, 174], [361, 209]], [[23, 323], [122, 347], [156, 414], [23, 396]], [[361, 304], [282, 347], [253, 414], [361, 401]]]) {
        poly(points, linear(23, 89, 361, 414, [[0, '#ffffff30'], [1, '#33333335']]), '#ffffff45', .7);
      }
      for (const x of [24, 360]) for (let i = 0; i < 7; i++) line([[x - 3, 220 + i * 10], [x + 3, 215 + i * 10]], '#33333355', .9);
    }
    for (const y of [84, 419]) { line([[30, y], [123, y]], '#22222220', .6); line([[261, y], [354, y]], '#22222220', .6); }
    for (const x of [19, 365]) for (const y of [28, 473]) {
      ellipse(x, y + .7, 2.4, 2.4, '#444'); ellipse(x, y, 2, 2, '#b9b9b9'); line([[x - .8, y], [x + .8, y]], '#555', .7);
    }
    ctx.restore();
    line([[31, 17.6], [354, 17.6]], '#fff9', .7);
  } else if (kind === 'island') {
    // Five authored restoration frames per region. Each frame repeats the
    // same seeded rock/architecture; only earned light and plant beds grow.
    for (let state = 0; state <= 4; state++) {
      ctx.save(); ctx.translate(state * 640, 0); seed = 4321 + zone * 313;
      const surface = zone === 0 ? [[82, 239], [194, 167], [428, 171], [558, 237], [514, 293], [300, 337], [127, 296]]
        : zone === 1 ? [[65, 248], [172, 182], [291, 199], [350, 169], [560, 242], [504, 294], [389, 310], [313, 283], [187, 326], [83, 284]]
          : [[101, 242], [222, 163], [424, 165], [553, 248], [476, 315], [260, 343], [114, 291]];
      const underside = surface.map(([x, y]) => [320 + (x - 320) * .7, y + 78]);
      ellipse(331, 410, 218, 21, '#030c1820'); ellipse(331, 409, 156, 12, '#030c1818');
      for (let i = 3; i < surface.length; i++) {
        const a = surface[i], b = surface[(i + 1) % surface.length], u = underside[i], v = underside[(i + 1) % surface.length];
        const face = [a, b, v, u];
        poly(face, linear(a[0], a[1], u[0], u[1], [[0, i % 3 ? '#314b57' : '#4a6470'], [1, '#102435']]));
        ctx.save(); path(face); ctx.clip();
        grain(80, 240, 480, 180, 6000, .16);
        for (let j = 0; j < 16; j++) {
          const t = j / 16;
          line([[a[0] + (u[0] - a[0]) * t, a[1] + 78 * t], [(a[0] + b[0]) / 2 + Math.sin(j) * 8, (a[1] + b[1]) / 2 + 78 * t], [b[0] + (v[0] - b[0]) * t, b[1] + 78 * t]], j % 3 ? '#07172215' : '#9cbbb51b', j % 3 ? 1 : 2);
        }
        ctx.restore();
        if (i % 2 === 0) line([[a[0] + 12, a[1] + 8], [u[0] + 8, u[1] - 6]], '#bed2bd20', 1);
      }
      poly(surface.map(([x, y]) => [x, y + 8]), '#142b35');
      poly(surface, linear(100, 165, 530, 325, [[0, zone === 2 ? '#b6ad8a' : '#9eafa1'], [.4, '#5e7c77'], [1, '#36545b']]), '#c6d1ba66', 1);
      ctx.save(); path(surface); ctx.clip(); grain(65, 162, 500, 180, 14000, .17);
      for (const y of [209, 238, 269, 296]) line([[60, y], [574, y - 7]], '#102c3640', 1);
      for (const x of [182, 289, 407, 505]) line([[x, 162], [x - 40, 337]], '#d8dfc523', .8);
      ctx.restore();

      function plinth(x, y, w = 60) {
        ellipse(x + 6, y + 11, w * .65, w * .2, '#020e1b66');
        poly([[x - w / 2, y], [x, y + w * .26], [x + w / 2, y], [x + w / 2, y + 12], [x, y + w * .26 + 12], [x - w / 2, y + 12]], '#3b5660');
        poly([[x - w / 2, y], [x, y - w * .23], [x + w / 2, y], [x, y + w * .26]], '#9cae9d', '#d1ddbe55', .8);
      }
      function column(x, y, h) {
        plinth(x, y, 29); poly([[x - 10, y], [x - 10, y - h], [x + 3, y - h - 4], [x + 11, y - h], [x + 11, y], [x, y + 5]], '#698589');
        poly([[x - 10, y], [x - 10, y - h], [x + 2, y - h - 4], [x + 2, y + 3]], '#b4c4b2');
        line([[x - 6, y - 5], [x - 6, y - h + 4]], '#d2dbc655', 1);
      }
      function crystal(x, y, h, active) {
        plinth(x, y, h * .8);
        if (active) { glow(x, y - h * .4, h * 1.3, zone === 2 ? '#ffdc8b30' : '#92ffd430'); ellipse(x, y + 4, h, h * .28, '#9aefc322'); }
        poly([[x, y - h], [x + h * .25, y - h * .32], [x, y], [x - h * .27, y - h * .25]], active ? '#8bedd0' : '#78939e');
        poly([[x, y - h], [x, y], [x - h * .27, y - h * .25]], active ? '#e4ffdc' : '#b7c8c2');
        line([[x - h * .27, y - h * .25], [x, y - h], [x + h * .25, y - h * .32]], active ? '#ecffdf' : '#d2e3da', 1.1);
      }
      if (zone === 0) {
        // A broken conservatory arch, terraced beds and the first light spire.
        column(202, 235, 91); column(393, 235, 91);
        ctx.beginPath(); ctx.ellipse(298, 145, 96, 67, 0, Math.PI, Math.PI * 2); ctx.strokeStyle = '#405e63'; ctx.lineWidth = 18; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(297, 141, 96, 67, 0, Math.PI, Math.PI * 2); ctx.strokeStyle = '#a8beb0'; ctx.lineWidth = 10; ctx.stroke();
        // Four earned stages retract the conservatory shutters. The opening
        // changes silhouette even when the island is a small home thumbnail.
        const span = (4 - state) * 21;
        for (const side of [-1, 1]) if (span > 0) {
          const jamb = side < 0 ? 208 : 388, end = jamb - side * span;
          poly([[jamb,143],[end,123],[end,226],[jamb,236]], linear(jamb,140,end,225,[[0,'#647873'],[.48,'#30464d'],[1,'#233942']]), '#82988b', 1.8);
          for (let dx = 8; dx < span; dx += 12) line([[jamb-side*dx,145],[jamb-side*dx,226]], '#acbb9d66', 1);
        }
        crystal(302, 244, 113, state > 0);
        for (const [x, y] of [[161, 268], [458, 260]]) { plinth(x, y, 70); ellipse(x, y, 24, 7, '#183e3b'); }
      } else if (zone === 1) {
        // Two mirror pylons and a suspended bridge, not the garden silhouette.
        poly([[173, 251], [379, 202], [403, 213], [195, 267]], '#142b3a');
        poly([[173, 244], [379, 195], [403, 206], [195, 260]], '#b1c4bc', '#ecedce60', .8);
        for (let i = 0; i < 13; i++) line([[188 + i * 15, 245 - i * 3.6], [199 + i * 15, 251 - i * 3.6]], '#3b576477', 1);
        for (const [x, y, flip] of [[173, 236, -1], [434, 245, 1]]) {
          column(x, y, 129);
          poly([[x - 34, y - 56], [x - 34, y - 148], [x + 33, y - 126], [x + 33, y - 34]], '#1c3449', '#a6c6c4', 4);
          poly([[x - 29, y - 60], [x - 29, y - 140], [x + 28, y - 122], [x + 28, y - 40]], linear(x - 32, y - 140, x + 32, y - 45, [[0, '#e0f2df'], [.3, '#6c9cab'], [.55, '#c0dbd9'], [1, '#304b6d']]));
          line([[x - 25, y - 129], [x + 25, y - 54]], '#eaffed66', 2);
          if (state >= (flip < 0 ? 1 : 3)) glow(x, y - 84, 60, '#bbe8ff20');
        }
        crystal(311, 275, 57, state > 1);
      } else {
        // An astronomical engine with thick bronze gimbals and radial steps.
        plinth(328, 263, 154); plinth(328, 245, 128);
        for (const [x, y] of [[211, 238], [444, 241]]) column(x, y, 90);
        ctx.save(); ctx.translate(328, 174); ctx.rotate(-.22);
        ring(0, 0, 90, 88, '#102637', 15); ring(-2, -3, 90, 88, '#ba9f6c', 9); ring(-3, -4, 81, 79, '#f6e0a275', 2);
        ring(-2, -3, 94, 29, '#d3bb88', 5);
        for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; line([[Math.cos(a) * 82, Math.sin(a) * 80], [Math.cos(a) * (i % 3 ? 87 : 91), Math.sin(a) * (i % 3 ? 85 : 89)]], '#fae4ac99', 1.1); }
        ctx.restore(); crystal(328, 225, 100, state === 4);
        if (state === 4) glow(328, 170, 111, '#ffdd7b28');
      }
      for (const [x, y, size, angle] of [[110, 267, 15, -.2], [485, 289, 17, .2], [276, 327, 11, .5], [512, 244, 10, -.5]]) stone(x, y, size, angle);
      // One local bed and light for each earned puzzle. Never light another
      // region merely because a global completion count happens to be high.
      for (let i = 0; i < 4; i++) {
        const x = [141, 231, 409, 488][i], y = [274, 308, 302, 263][i];
        ellipse(x, y, 29, 9, '#1e383c');
        if (i < state) {
          plant(x, y, 19 + i * 2, i);
          for (let j = 0; j < 5; j++) ellipse(x - 17 + j * 8, y - 12 - (j % 2) * 7, 2.6, 2.2, zone === 2 ? '#f6d29b' : '#d6e7ba');
          ellipse(x + 18, y + 2, 3, 2, '#d2ffcb'); glow(x + 18, y + 2, 24, '#b0ffd923');
        } else { leaf(x - 6, y, 13, -.5); leaf(x + 5, y, 11, .6); }
      }
      ctx.restore();
    }
  } else if (kind === 'garden') {
    ctx.scale(2, 2);
    const sky = zone === 0 ? ['#24424c', '#132831', '#07131f'] : zone === 1 ? ['#293c59', '#17273e', '#0b1628'] : ['#403d42', '#252731', '#121a29'];
    ctx.fillStyle = linear(0, 0, 360, 560, [[0, sky[0]], [.5, sky[1]], [1, sky[2]]]); ctx.fillRect(0, 0, 420, 560);
    glow(40, -10, 360, zone === 2 ? '#f9d79a28' : '#9bd5c628');
    // Distant topography / clouds. All detail is static and away from tasks.
    for (let i = 0; i < 9; i++) {
      const y = 30 + i * 62;
      poly([[-20, y + 60], [30, y + 5], [72, y + 25], [111, y - 30], [154, y + 15], [170, y + 80], [-20, y + 90]], `rgba(104,149,156,${.025 + i * .002})`);
      ellipse(360, y, 90, 7, '#b8d6d408');
    }
    ellipse(219, 495, 194, 48, '#030b16a0');
    // A thick floating stone terrace, lit from the upper left. It preserves the
    // exact 25..395 × 25..536 collision plane; scenery never becomes an obstacle.
    const terrace = [[48, 18], [369, 18], [402, 54], [402, 488], [369, 532], [51, 532], [18, 495], [18, 54]];
    poly([[19, 441], [402, 441], [390, 519], [349, 550], [108, 550], [37, 518]], '#1e333a');
    poly([[37, 499], [108, 550], [160, 550], [109, 511]], '#30494b');
    poly([[249, 519], [296, 554], [349, 550], [390, 519]], '#0c1e2b');
    poly(terrace.map(([x, y]) => [x, y + 8]), '#101f2b');
    poly(terrace, linear(25, 20, 400, 520, [[0, '#aac1b2'], [.3, '#718e86'], [1, '#3c5758']]));
    const inner = [[52, 29], [365, 29], [391, 58], [391, 485], [363, 519], [55, 519], [29, 491], [29, 58]];
    poly(inner, '#0b1e29');
    const floor = [[56, 34], [360, 34], [386, 61], [386, 481], [359, 512], [59, 512], [34, 487], [34, 61]];
    const tile = zone === 0 ? ['#37534f', '#213b3e', '#172f36'] : zone === 1 ? ['#3c5062', '#293d51', '#203244'] : ['#504c45', '#373d3e', '#283338'];
    poly(floor, linear(30, 20, 400, 540, [[0, tile[0]], [.45, tile[1]], [1, tile[2]]]), '#cfe5cf38', .7);
    ctx.save(); path(floor); ctx.clip();
    honedStone();
    grain(30, 30, 360, 490, 72000, .12);
    // Large irregular paving joints: detail for depth, not a graph-paper grid.
    for (const y of [104, 231, 362, 459]) {
      line([[30, y + 1], [388, y + 1]], '#a3c2b411', .7); line([[30, y], [388, y]], '#07172266', .9);
    }
    for (const [x, y, yy] of [[128, 34, 104], [299, 34, 104], [219, 104, 231], [94, 231, 362], [321, 231, 362], [186, 362, 459], [288, 459, 512]]) {
      line([[x, y], [x, yy]], '#091a2260', .8); line([[x + 1, y], [x + 1, yy]], '#c4d8c00d', .7);
    }
    // An old celestial engraving; its centre remains unobstructed.
    const metal = zone === 2 ? '#e4be7752' : '#bed2b824';
    ring(210, 274, 144, 199, '#061b2560', 1.1); ring(210, 272, 144, 199, metal, .7);
    ring(210, 272, 137, 190, '#b7cfc418', .6);
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * Math.PI * 2;
      line([[210 + Math.cos(a) * 147, 272 + Math.sin(a) * 203], [210 + Math.cos(a) * (i % 4 ? 150 : 154), 272 + Math.sin(a) * (i % 4 ? 207 : 212)]], metal, .8);
    }
    if (zone === 1) for (const x of [54, 366]) {
      line([[x, 88], [x, 437]], '#c5e2f535', 1); line([[x + 2, 88], [x + 2, 437]], '#0c1e2baa', 1);
    }
    if (zone === 2) for (const y of [82, 447]) {
      ring(210, y, 44, 16, '#d5b67736', 1.4); ring(210, y, 33, 11, '#c6a36926', .7);
    }
    glow(65, 52, 280, '#b7e0bb12');
    ctx.restore();
    // Narrow machined rim, warm reflected light and mounting pins.
    line([[49, 19], [368, 19], [401, 54]], '#e4ead495', .9);
    line([[20, 57], [20, 491], [52, 530]], '#86b1a855', 1);
    for (const [x, y] of [[43, 48], [377, 48], [43, 495], [377, 495]]) {
      ellipse(x, y + 1, 4.5, 4.5, '#132832'); ellipse(x, y, 3.6, 3.6, '#a2b7a1'); ellipse(x - 1, y - 1, 1.5, 1.5, '#d2d9bd');
    }
    // Moss, weathered rock and foliage are restricted to the outside margins,
    // so even the late leftmost crystal (x=60) is never painted over.
    for (const [x, y, s, a] of [[23, 50, 15, -.2], [388, 68, 17, .2], [19, 469, 15, -.7], [389, 492, 19, .1], [63, 529, 13, .2], [353, 533, 13, -.4]]) stone(x, y, s, a);
    plant(24, 30, 21, 0); plant(385, 497, 14, 2);
    for (const [x, y, size, angle] of [[391, 29, 45, -1.5], [394, 27, 39, -2.6],
      [15, 495, 49, .17], [16, 496, 36, 1.05], [351, 541, 46, -1.45], [61, 536, 27, -.9]]) fern(x, y, size, angle);
    if (zone === 1) for (const [x, y] of [[23, 162], [397, 377]]) {
      poly([[x, y - 21], [x + 6, y - 5], [x + 3, y + 16], [x - 5, y + 12], [x - 6, y - 6]], '#9cb6cc');
      poly([[x, y - 21], [x + 1, y + 12], [x - 5, y + 12], [x - 6, y - 6]], '#e3f1e5');
    }
    if (zone === 2) for (const x of [21, 398]) for (const y of [146, 404]) {
      ellipse(x, y, 7, 12, '#172a31'); ring(x, y, 7, 12, '#bd9c5b', 2); line([[x, y - 8], [x, y + 8]], '#f1d38a55', 1);
    }
    grain(0, 0, 420, 560, 10000, .025);
  } else {
    const colors = [['#78efc0', '#183d3c', '#d6fff0'], ['#ffcc76', '#493b2a', '#fff4cf'], ['#c2a2ff', '#352c51', '#f3e8ff']];
    for (let frame = 0; frame < 8; frame++) {
      ctx.save(); ctx.translate(frame * 160, 0);
      const color = colors[Math.floor(frame / 2) % 3], active = frame % 2 === 1;
      const x = 80, y = 80;
      // One coherent light rig: soft contact shadow, ceramic/bronze cradle,
      // explicit refraction planes, upper-left softbox and narrow rim light.
      ellipse(x + 6, 149, 57, 17, '#00000018'); ellipse(x + 4, 146, 46, 12, '#00000055'); ellipse(x + 2, 143, 35, 9, '#020b13ac');
      if (active) glow(x, 125, 77, `${color[0]}38`);
      ellipse(x, 131, 43, 15, '#142632');
      round(37, 122, 86, 10, 3, linear(37, 120, 123, 136, [[0, '#81948c'], [.3, '#41585a'], [1, '#1a303a']]));
      ellipse(x, 122, 43, 13, linear(50, 109, 110, 132, [[0, '#d3d8b8'], [.5, '#7c968c'], [1, '#364f54']]));
      ellipse(x, 121, 37, 10, '#142d35');
      ring(x, 122, 40, 11, '#e3e7ca55', 1.3, Math.PI, Math.PI * 2);
      if (active) { ring(x, 123, 32, 8, color[0], 1.5); glow(x, 110, 48, `${color[0]}2b`); }
      if (frame >= 6) {
        // Launcher / newly grown fern, sharing this same small atlas.
        if (frame === 6) {
          ring(x, 107, 27, 27, '#e7ead580', 2); ring(x, 107, 22, 22, '#78efc080', 1);
          ellipse(x, 107, 19, 19, '#29454c');
          ring(x, 107, 18, 18, '#b7d3c380', 1);
        } else {
          ctx.clearRect(0, 0, 160, 192);
          plant(80, 145, 45, 1);
          for (const [xx, yy] of [[51, 121], [98, 112], [106, 142]]) {
            for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ellipse(xx + Math.cos(a) * 5, yy + Math.sin(a) * 5, 4, 3, '#d6e8b9'); }
            ellipse(xx, yy, 2.5, 2.5, '#efc57a');
          }
        }
      } else {
        const body = [[x, 29], [x + 27, 62], [x + 23, 100], [x, 122], [x - 24, 101], [x - 29, 64]];
        poly(body, color[1], `${color[0]}99`, .8);
        poly([[x, 29], [x + 27, 62], [x + 5, 74], [x - 29, 64]], linear(x - 25, 25, x + 20, 80, [[0, active ? color[2] : color[0]], [1, color[1]]]));
        poly([[x - 29, 64], [x + 5, 74], [x, 122], [x - 24, 101]], linear(50, 68, 85, 114, [[0, color[0]], [.25, active ? color[2] : color[0]], [1, color[1]]]));
        poly([[x + 5, 74], [x + 27, 62], [x + 23, 100], [x, 122]], linear(82, 78, 110, 102, [[0, active ? color[0] : color[1]], [.45, color[1]], [1, color[0]]]));
        poly([[x, 29], [x - 3, 58], [x + 5, 74], [x - 12, 63]], '#effff74d');
        poly([[x - 17, 78], [x + 10, 69], [x + 8, 96], [x - 6, 106]], `${color[0]}42`);
        line([[x - 29, 64], [x, 29], [x + 27, 62]], `${color[2]}d0`, 1.4);
        line([[x - 24, 101], [x - 29, 64], [x + 5, 74], [x, 122]], `${color[2]}90`, .9);
        line([[x + 5, 74], [x + 27, 62], [x + 23, 100]], `${color[0]}60`, .8);
        // Distinct persistent geometry symbols remain readable in both states.
        ctx.fillStyle = active ? color[2] : color[0];
        if (frame < 2) poly([[80, y - 1], [87, y + 8], [80, y + 17], [73, y + 8]], ctx.fillStyle);
        else if (frame < 4) ellipse(80, y + 8, 7, 7, ctx.fillStyle);
        else poly([[80, y], [88, y + 15], [72, y + 15]], ctx.fillStyle);
        if (active) { glow(77, 79, 19, '#ffffff38'); line([[69, 65], [76, 64]], color[2], 1.2); }
      }
      ctx.restore();
    }
  }
  return { data: canvas.toDataURL('image/webp', .94), width: canvas.width, height: canvas.height };
}
