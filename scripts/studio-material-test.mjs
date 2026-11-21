/* Explicit shader fixtures plus real compiled controls. Fixtures never create
   an application win, replace its clock or assign scores/progress. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, firefox, webkit } from 'playwright';
import { studioMesh, STUDIO_VERTEX_FLOATS, STUDIO_FINISHES } from '../js/engine/studioMesh.js';
import { MATERIAL_ASSETS } from '../js/engine/materialAssets.js';
import { arcadeFrame, prismArchitecture } from '../js/engine/studioArchitecture.js';
import { PRISM_LEVELS } from '../js/game/prism/levels.js';
import { studioFinishPixels, studioFinishPng } from './lib/studio-finish.mjs';
import { startStaticServer } from './lib/static-server.mjs';

for (const item of [
  { kind: 'station', x: 100, y: 100, w: 90, h: 90, r: 18, color: 0x343c48 },
  { kind: 'station', x: 100, y: 100, w: 160, h: 160, r: 80, color: 0x343c48 },
  { kind: 'crystal', x: 100, y: 100, w: 37, h: 51, color: 0x78efc0 },
  arcadeFrame(200, 300, 360, 540, 0x343c48),
  { kind: 'ring', x: 100, y: 100, w: 62, h: 31, color: 0x80998f, finish: 'alloy' },
  { kind: 'beam', x: 100, y: 100, w: 120, h: 11, z: 9, angle: -.7, color: 0x80998f, finish: 'alloy' },
  { kind: 'post', x: 100, y: 100, w: 8, h: 8, z: 7, color: 0x80998f, finish: 'alloy' },
]) {
  const mesh = studioMesh([item]);
  assert.ok(mesh.length > 0 && mesh.length / (STUDIO_VERTEX_FLOATS * 3) <= 364);
  assert.ok(mesh.every(Number.isFinite));
  const depths = new Set();
  for (let i = 0; i < mesh.length; i += STUDIO_VERTEX_FLOATS) {
    depths.add(mesh[i + 2]);
    assert.ok(mesh[i + 2] >= 0, 'Solid geometry stays above its planar shadow receiver, never clipped behind its own contact shadow');
    assert.ok(Math.abs(Math.hypot(...mesh.slice(i + 3, i + 6)) - 1) < .00001, 'Every non-degenerate face has a unit 3D normal');
    assert.ok(item.kind === 'crystal' ? mesh[i + 12] === -1 : mesh[i + 12] >= 0 && mesh[i + 12] <= 3, 'Only neutral chassis sample a whitelisted finish');
  }
  assert.ok(depths.size >= 3, 'Not a flat image, billboard or CSS extrusion');
  if (item.kind !== 'station') {
    const edges = new Map(), key = at => [...mesh.slice(at, at + 3)].map(value => value.toFixed(4)).join(',');
    for (let at = 0; at < mesh.length; at += STUDIO_VERTEX_FLOATS * 3) for (let i = 0; i < 3; i++) {
      const edge = [key(at + i * STUDIO_VERTEX_FLOATS), key(at + (i + 1) % 3 * STUDIO_VERTEX_FLOATS)].sort().join(':');
      edges.set(edge, (edges.get(edge) || 0) + 1);
    }
    assert.ok([...edges.values()].every(count => count === 2), `${item.kind}: every solid edge belongs to two faces, including inner ring/frame walls`);
  }
}
const worstCase = studioMesh([arcadeFrame(210, 350, 390, 550, 0x343c48), ...Array.from({ length: 9 }, (_, i) => ({
  kind: 'station', x: i * 100, y: 200, w: 90, h: 90, r: 14, color: 0x343c48,
}))]);
assert.equal(worstCase.length / (STUDIO_VERTEX_FLOATS * 3), 3500, 'Architecture stays inside the original nine-station/3,500-triangle budget');
for (const level of PRISM_LEVELS) {
  const before = JSON.stringify(level), parts = prismArchitecture(level);
  const crystals = level.nodes.filter(node => node.kind === 'crystal').flatMap(node => [
    { kind: 'ring', x: node.x, y: node.y + 17, w: 43, h: 21, color: 0x6b807b },
    { kind: 'crystal', x: node.x, y: node.y, w: 37, h: 51, color: 0x78efc0 },
  ]);
  assert.equal(JSON.stringify(level), before, 'Architecture never mutates the authored puzzle');
  assert.ok(parts.length + crystals.length <= 32, 'No authored scene silently truncates geometry');
  assert.ok(studioMesh([...parts, ...crystals]).length / (STUDIO_VERTEX_FLOATS * 3) <= 3500);
  for (const mirror of level.nodes.filter(node => node.kind === 'mirror')) {
    const beam = parts.find(part => part.kind === 'beam' && part.x === mirror.x && part.y === mirror.y);
    assert.ok(Math.abs(Math.cos(beam.angle) * beam.w / 2 - 42) < .000001);
    assert.ok(Math.abs(Math.sin(beam.angle) * beam.w / 2 - (mirror.slope === '/' ? -42 : 42)) < .000001, 'Mesh endpoints preserve the actual reflecting axis');
  }
}
assert.deepEqual(await readFile(MATERIAL_ASSETS.finishes), studioFinishPng(), 'The lossless data atlas is reproducible without canvas colour conversion');
const atlas = studioFinishPixels();
assert.deepEqual([atlas.width, atlas.height], [512, 128], 'POT data texture also works on WebGL 1');
for (let i = 0; i < atlas.pixels.length; i += 4) {
  assert.ok(Math.abs(Math.hypot(...[...atlas.pixels.slice(i, i + 3)].map(value => value / 255 * 2 - 1)) - 1) < .015);
  assert.ok(atlas.pixels[i + 3] >= 60 && atlas.pixels[i + 3] <= 195, 'Roughness deviations are bounded');
}

const qaRoot = process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA, 'Temp/opencode') : resolve(tmpdir(), 'opencode');
const out = process.env.SCS_REVIEW_OUT || resolve(qaRoot, 'scs-luminous-studio');
await mkdir(out, { recursive: true });
const source = await startStaticServer({ root: '.', port: 0 });
const compiled = await startStaticServer({ root: 'docs', port: 0 });
const receipts = [];
const fixture = `<!doctype html><style>body{margin:0;background:#101d2a}canvas{display:block}</style>
<script type="importmap">{"imports":{"phaser":"/node_modules/phaser/dist/phaser.esm.js"}}</script>
<script type="module">
import Phaser from 'phaser';import{createStudioMaterial,preloadStudioMaterial}from'/js/engine/studioMaterial.js';
import{arcadeFrame}from'/js/engine/studioArchitecture.js';
window.studio={frames:[],ready:false,atlasPixels:null,lastPixels:null};
const game=new Phaser.Game({type:Phaser.WEBGL,width:320,height:240,banner:false,backgroundColor:'#101d2a',audio:{noAudio:true},
scene:{preload(){preloadStudioMaterial(this);},create(){const gl=this.game.renderer.gl,upload=gl.texImage2D.bind(gl);
const keys=[gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,gl.UNPACK_FLIP_Y_WEBGL,gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.UNPACK_ALIGNMENT],shaderSource=gl.shaderSource.bind(gl);
gl.shaderSource=(shader,text)=>{if(text.includes('vec3 brdf')){gl.pixelStorei(keys[0],true);gl.pixelStorei(keys[1],true);gl.pixelStorei(keys[2],gl.BROWSER_DEFAULT_WEBGL);gl.pixelStorei(keys[3],8);studio.unpack=keys.map(key=>gl.getParameter(key));}shaderSource(shader,text);};
gl.texImage2D=(...args)=>{upload(...args);if(args.length===6&&args[5]?.width===512&&args[5]?.height===128){const before=gl.getParameter(gl.FRAMEBUFFER_BINDING),frame=gl.createFramebuffer();try{gl.bindFramebuffer(gl.FRAMEBUFFER,frame);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,gl.getParameter(gl.TEXTURE_BINDING_2D),0);const pixels=new Uint8Array(512*128*4);gl.readPixels(0,0,512,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);studio.atlasPixels=[...pixels];}finally{gl.bindFramebuffer(gl.FRAMEBUFFER,before);gl.deleteFramebuffer(frame);}}};
const stage=createStudioMaterial(this,ready=>studio.ready=ready);studio.stage=stage;studio.game=this.game;
studio.item={kind:'station',x:160,y:120,w:140,h:110,r:24,color:0x343c48,roughness:.4,metallic:.12,finish:'ceramic'};
studio.frame=arcadeFrame(160,120,220,180,0x546965);
stage.setObjects([studio.item]);stage.setEnabled(true);this.add.rectangle(18,18,20,20,0x2ed573).setDepth(10);
this.game.events.on(Phaser.Core.Events.POST_RENDER,()=>{const pixels=new Uint8Array(320*240*4);gl.readPixels(0,0,320,240,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let hash=2166136261;for(const value of pixels)hash=Math.imul(hash^value,16777619);
const cap=[];for(let y=85;y<145;y++)for(let x=110;x<210;x++)cap.push(pixels[(y*320+x)*4]);const state=stage.snapshot();let delta={max:0,mean:0,aboveTwo:0};
if(studio.lastPixels)for(let i=0;i<pixels.length;i++){const d=Math.abs(pixels[i]-studio.lastPixels[i]);delta.max=Math.max(delta.max,d);delta.mean+=d/pixels.length;if(d>2)delta.aboveTwo++;}studio.lastPixels=pixels;
studio.frames.push({hash:hash>>>0,delta,state,error:gl.getError(),unpack:keys.map(key=>gl.getParameter(key)),sentinel:[...pixels.slice(((240-18)*320+18)*4,((240-18)*320+18)*4+4)],cap:{min:Math.min(...cap),max:Math.max(...cap),mean:cap.reduce((sum,n)=>sum+n,0)/cap.length,tones:new Set(cap).size}});if(state.draws||state.error)this.game.loop.sleep();});}}});
</script>`;

async function context(browser, fault = '') {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.addInitScript(fault => {
    localStorage.setItem('scsQa', '1'); localStorage.setItem('scsQaPerfTier', 'high');
    localStorage.setItem('scs_save:guest', JSON.stringify({ settings: { tutorialDone: true, sound: false, music: false } }));
    if (fault === 'canvas') {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /webgl/i.test(type) ? null : get.call(this, type, ...args); };
    }
    if (fault === 'webgl1') {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl2' ? null : get.call(this, type, ...args); };
    }
    if (fault === 'upload') for (const api of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) if (api) {
      const upload = api.prototype.texImage2D;
      api.prototype.texImage2D = function (...args) {
        if (args.length === 6 && args[5]?.width === 512 && args[5]?.height === 128) throw new Error('Injected data-texture upload failure');
        return upload.apply(this, args);
      };
    }
    if (fault === 'depth') for (const api of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) if (api) {
      const parameter = api.prototype.getParameter;
      api.prototype.getParameter = function (key) { return key === this.DEPTH_BITS ? 0 : parameter.call(this, key); };
    }
    if (fault === 'vao') for (const api of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) if (api) {
      // Fail only the custom material allocation, not Phaser's own startup VAOs.
      const shaderSource = api.prototype.shaderSource;
      api.prototype.shaderSource = function (shader, source) { if (source.includes('vec3 brdf')) globalThis.studioVaoFaultArmed = true; return shaderSource.call(this, shader, source); };
      const failOnce = create => function (...args) {
        if (globalThis.studioVaoFaultArmed) { globalThis.studioVaoFaultArmed = false; return null; }
        return create.apply(this, args);
      };
      const extension = api.prototype.getExtension;
      api.prototype.getExtension = function (key) {
        const result = extension.call(this, key);
        if (key === 'OES_vertex_array_object' && result && !result.studioWrapped) { result.createVertexArrayOES = failOnce(result.createVertexArrayOES); result.studioWrapped = true; }
        return result;
      };
      if (api.prototype.createVertexArray) api.prototype.createVertexArray = failOnce(api.prototype.createVertexArray);
    }
    if (fault === 'shader') for (const api of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) if (api) {
      const status = api.prototype.getShaderParameter;
      api.prototype.getShaderParameter = function (shader, key) {
        return key === this.COMPILE_STATUS && this.getShaderSource(shader)?.includes('vec3 brdf') ? false : status.call(this, shader, key);
      };
    }
  }, fault);
  return ctx;
}
async function start(page) {
  await page.goto(compiled.baseUrl, { waitUntil: 'networkidle' });
  await page.locator('#btnGuest').click();
  await page.evaluate(() => __SCS_QA__.setGameSelection('klassik', 'endless'));
  await page.locator('#btnPlay').click();
  if (await page.locator('#modeInstructionOverlay.active').count()) await page.locator('#btnStartAfterInstruction').click();
  await page.waitForFunction(() => __SCS_QA__.arcadeRendererState()?.targets === 4 && __SCS_QA__.arcadeRendererState().renderedFrames > 0);
}

try {
  for (const name of (process.env.SCS_BROWSERS || 'chromium').split(',')) {
    const browser = await ({ chromium, firefox, webkit })[name].launch();
    try {
      const probe = await browser.newPage();
      const errors = []; probe.on('pageerror', e => errors.push(e.message));
      await probe.route('**/studio-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture }));
      await probe.goto(`${source.baseUrl}/studio-fixture`);
      await probe.waitForFunction(() => window.studio?.frames.at(-1)?.state.draws > 0 || window.studio?.frames.at(-1)?.state.error);
      const first = await probe.evaluate(() => studio.frames.at(-1));
       assert.equal(first.state.model, 'mesh-ggx', JSON.stringify(first)); assert.equal(first.error, 0);
       assert.equal(first.state.finish, 'normal-roughness-atlas');
       assert.deepEqual(first.state.resources, { programs: 1, buffers: 1, vertexArrays: 1, textures: 1, textureBytes: 512 * 128 * 4 });
       assert.deepEqual(first.sentinel, [46, 213, 115, 255], 'A normal Phaser object still paints correctly after the custom textured pass');
       assert.deepEqual(first.unpack, await probe.evaluate(() => studio.unpack), 'Data upload restores every changed pixel-store setting');
       const gpuAtlas = await probe.evaluate(() => studio.atlasPixels);
       assert.equal(gpuAtlas.length, atlas.pixels.length);
       const atlasMaxError = gpuAtlas.reduce((maximum, value, i) => Math.max(maximum, Math.abs(value - atlas.pixels[i])), 0);
       assert.ok(atlasMaxError <= 2, `Actual GPU texture preserves straight, non-sRGB normal/roughness channels; max decode error=${atlasMaxError}`);
       assert.ok(first.cap.tones > 4 && first.cap.max <= 98, `Readable face retains tonal detail below its actual shader ceiling: ${JSON.stringify(first.cap)}`);
      const beforeA = await probe.evaluate(() => { const n = studio.frames.length; studio.stage.setLight(70, 40, 80, 4); studio.game.loop.wake(); return n; });
      await probe.waitForFunction(n => studio.frames.length > n, beforeA);
      const lightA = await probe.evaluate(() => studio.frames.at(-1));
      const beforeB = await probe.evaluate(() => { const n = studio.frames.length; studio.stage.setLight(265, 205, 80, 4); studio.game.loop.wake(); return n; });
      await probe.waitForFunction(n => studio.frames.length > n, beforeB);
      const lightB = await probe.evaluate(() => studio.frames.at(-1));
      assert.notEqual(lightA.hash, lightB.hash, 'The same actual mesh changes pixels when only the real light position changes');
       assert.equal(lightA.state.uploads, lightB.state.uploads, 'Lighting never rebuilds geometry or bakes a new image');
       assert.equal(lightB.state.textureUploads, 1, 'Light changes never reupload the data atlas');
       assert.equal(lightB.error, 0, 'Phaser and the custom pass share a valid restored GL state');
       for (let repeat = 0; repeat < 3; repeat++) {
         const before = await probe.evaluate(() => { const n = studio.frames.length; studio.game.loop.wake(); return n; });
         await probe.waitForFunction(n => studio.frames.length > n, before);
         const repeatFrame = await probe.evaluate(() => studio.frames.at(-1));
         // Firefox varied ten channels by one LSB in diagnosis. Compare actual
         // channel error, not a hash that treats harmless rounding as new art.
         assert.ok(repeatFrame.delta.max <= 1 && repeatFrame.delta.mean <= .005,
           `An unchanged material remains pixel-stable across sleep/wake: ${JSON.stringify(repeatFrame.delta)}`);
       }
       await probe.screenshot({ path: resolve(out, `${name}-lighting-fixture.png`) });
       const profiles = [];
       for (const finish of Object.keys(STUDIO_FINISHES)) {
         const before = await probe.evaluate(finish => { const n = studio.frames.length; studio.stage.setLight(70, 40, 80, 4); studio.stage.setObjects([{ ...studio.item, finish }]); studio.game.loop.wake(); return n; }, finish);
         await probe.waitForFunction(n => studio.frames.length > n, before);
         profiles.push({ finish, ...await probe.evaluate(() => studio.frames.at(-1)) });
         await probe.screenshot({ path: resolve(out, `${name}-finish-${finish}-fixture.png`) });
       }
       assert.equal(new Set(profiles.map(profile => profile.hash)).size, 4, 'Each normal/roughness profile changes real pixels with all geometry/lighting/base material held equal');
        assert.ok(profiles.every(profile => profile.error === 0 && profile.state.textureUploads === 1));
        const frameBefore = await probe.evaluate(() => { const n = studio.frames.length; studio.stage.setObjects([studio.frame, studio.item]); studio.game.loop.wake(); return n; });
        await probe.waitForFunction(n => studio.frames.length > n, frameBefore);
        const frameBase = await probe.evaluate(() => studio.frames.at(-1));
        const frameMoved = await probe.evaluate(() => { const n = studio.frames.length; studio.stage.setStageOffset(4, 3); studio.game.loop.wake(); return n; });
        await probe.waitForFunction(n => studio.frames.length > n, frameMoved);
        const moved = await probe.evaluate(() => studio.frames.at(-1));
        assert.notEqual(moved.hash, frameBase.hash, 'Real frame pixels move without moving the station');
        assert.ok(Math.abs(moved.cap.mean - frameBase.cap.mean) < .01, 'Station face pixels remain fixed while only the perimeter moves');
        assert.equal(moved.state.uploads, frameBase.state.uploads, 'Depth/parallax is a bounded uniform, never a geometry re-upload');
        assert.deepEqual(moved.state.kinds, { frame: 1, station: 1 });
        assert.deepEqual(await probe.evaluate(() => { studio.stage.setStageOffset(99, -99); return studio.stage.snapshot().stageOffset; }), [4, -3]);
       const released = await probe.evaluate(() => { studio.stage.destroy(); studio.stage.destroy(); return studio.stage.snapshot(); });
       assert.deepEqual(released.resources, { programs: 0, buffers: 0, vertexArrays: 0, textures: 0, textureBytes: 0 }, 'Idempotent disposal releases every owned GPU resource');
       await probe.evaluate(() => { studio.game.loop.wake(); studio.game.destroy(true); });
      await probe.close();

      const ctx = await context(browser), page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      try {
        await start(page);
        await page.waitForSelector('#game[data-arena-solid="mesh-ggx"]');
        const state = await page.evaluate(() => __SCS_QA__.arcadeRendererState());
          assert.equal(state.solid.error, null); assert.equal(state.solid.objects, 6);
          assert.deepEqual(state.solid.kinds, { frame: 1, station: 5 });
         assert.equal(state.solid.finish, 'normal-roughness-atlas');
         assert.equal(state.solid.textureUploads, 1); assert.equal(state.solid.shadowPasses, 3);
        assert.ok(state.solid.triangles > 0 && state.solid.triangles <= 3500);
        assert.equal(await page.locator('.arcade-engine-layer canvas').count(), 1, 'No second context/canvas or extra backing allocation');
        const rectangles = () => page.locator('#game .corner-shape,#centerPlatform').evaluateAll(nodes => nodes.filter(n => n.offsetParent).map(n => { const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
        const geometry = await rectangles();
        const task = await (await page.waitForFunction(() => {
          const state = __SCS_QA__.gameState();
          if (!state.direction) return false;
          const r = document.querySelector('#game .corner-shape[data-dir="' + state.direction + '"]').getBoundingClientRect();
          return { correct: state.correct, x: r.x + r.width / 2, y: r.y + r.height / 2 };
        })).jsonValue();
        await page.waitForTimeout(100); await page.touchscreen.tap(task.x, task.y);
        await page.waitForFunction(before => __SCS_QA__.gameState().correct > before, task.correct);
        assert.deepEqual(await rectangles(), geometry);
        await page.locator('#btnPause').click();
        assert.equal(await page.locator('#game .corner-score-pop').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).display === 'none')), true, 'Pausing cancels pooled score labels and pending show frames instead of painting over the modal');
        await page.screenshot({ path: resolve(out, `${name}-pause.png`), scale: 'css' });
        assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().loopRunning), false);
        await page.evaluate(() => { document.body.dataset.perfMode = 'low'; window.dispatchEvent(new Event('scs:perftier')); });
        assert.equal(await page.locator('#game').getAttribute('data-arena-solid'), null);
        assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().solid.enabled), false);
        assert.deepEqual(await rectangles(), geometry, 'Fallback does not move controls');
        await page.locator('#btnPauseQuit').click();
        await page.evaluate(() => { document.body.dataset.perfMode = 'high'; window.dispatchEvent(new Event('scs:perftier')); });
        await page.locator('#btnPrism').click(); await page.locator('#pwContinue').click();
         await page.waitForSelector('#pwArena[data-studio-renderer="mesh-ggx"]');
          await page.waitForTimeout(400); // Let the real screen-entry transition finish, without changing any game/renderer clock.
          const prism = await page.evaluate(() => __SCS_QA__.prismRendererState());
          assert.deepEqual(prism.kinds, { beam: 4, ring: 2, crystal: 1 }, 'The actual first puzzle has four 3D rails, launcher/crystal rings and a crystal');
          assert.equal(prism.loopRunning, false); assert.ok(prism.triangles <= 3500);
         await page.screenshot({ path: resolve(out, `${name}-prism-ready.png`), scale: 'css' });
        const arena = await page.locator('#pwArena canvas').boundingBox();
        await page.touchscreen.tap(arena.x + arena.width / 2, arena.y + arena.height * 170 / 560);
        await page.locator('#pwFire').click(); await page.waitForSelector('#pwNext:not(:disabled)');
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('scs_save:guest')).prism.levels['first-light'].stars), 3, 'Actual 3D rendering leaves the genuine puzzle win unchanged');
        await page.screenshot({ path: resolve(out, `${name}-prism-earned.png`), scale: 'css' });
          receipts.push({ browser: name, lightA, lightB, profiles, frameBase, moved, prism, atlasMaxError, released: released.resources, arcade: state.solid, realInput: true, fixedGeometry: true, genuinePrismWin: true });
      } finally { await ctx.close(); }

      for (const fault of ['shader', 'canvas', 'depth', 'vao', 'missing-atlas', 'upload', 'webgl1']) {
        const ctx = await context(browser, fault), page = await ctx.newPage();
        page.on('pageerror', e => errors.push(e.message));
        try {
          if (fault === 'missing-atlas') await page.route('**/img/materials/studio-finishes.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('undecodable-finish-fixture') }));
          await start(page);
          const fallback = ['shader', 'canvas', 'depth', 'vao'].includes(fault);
          if (!fallback) await page.waitForSelector('#game[data-arena-solid="mesh-ggx"]');
          const state = await page.evaluate(() => __SCS_QA__.arcadeRendererState());
          assert.equal(state.solid.enabled, !fallback);
          assert.equal(await page.locator('#game').getAttribute('data-arena-solid'), fallback ? null : 'mesh-ggx');
          assert.equal(await page.locator('#game').getAttribute('data-arena-material'), 'klassik', 'Existing material/DOM fallback remains available');
          if (['shader', 'depth', 'vao'].includes(fault)) { assert.ok(state.solid.error); assert.equal(state.solid.resources.textures, 0); }
          else if (fault === 'canvas') assert.equal(state.backend, 'canvas');
          else if (fault === 'webgl1') {
            assert.equal(state.backend, 'webgl'); assert.equal(state.solid.finish, 'normal-roughness-atlas');
            assert.match(await page.locator('.arcade-engine-layer canvas').evaluate(canvas => { const gl = canvas.getContext('webgl'); return gl.getParameter(gl.VERSION); }), /^WebGL 1\./);
          }
          else { assert.equal(state.solid.finish, 'smooth-fallback'); assert.equal(state.solid.resources.textureBytes, 4); }
          console.log(`PASS ${name}: ${fault} fixture`);
        } catch (failure) {
          await page.screenshot({ path: resolve(out, `${name}-${fault}-failure.png`), scale: 'css' });
          throw new Error(`${name}/${fault}: ${failure.message}`, { cause: failure });
        } finally { await ctx.close(); }
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${name}: closed cut meshes/GGX, four measured normal/roughness profiles, actual GPU data channels, bounded tonal detail, stable uploads, GL restoration/disposal, real input/win and shader/Canvas/tier/depth/VAO/atlas/upload/WebGL1 fallbacks`);
    } finally { await browser.close(); }
  }
  await writeFile(resolve(out, 'studio-material-receipts.json'), JSON.stringify(receipts, null, 2));
} finally { await source.close(); await compiled.close(); }
