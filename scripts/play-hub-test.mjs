import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

const server = await startStaticServer({root:'docs',port:0});
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport:{width:360,height:640},hasTouch:true,isMobile:true,locale:'de-DE'});
  const errors = [];
  await page.addInitScript(()=> {
    localStorage.setItem('scsQa','1');
    window.addEventListener('unhandledrejection',e=>console.error(String(e.reason)));
  });
  page.on('pageerror', e=>errors.push(e.message));
  page.on('console', m=>{ if(m.type()==='error') errors.push(m.text()); });
  const pick = name=>page.locator(`#hub.active [data-action="${name}"]`).tap();
  const game = name=>page.waitForFunction(mode=>__SCS_QA__.gameState().mode === mode && __SCS_QA__.gameState().running, name);
  const buttons = page.locator('#game .corner-shape:visible');
  const rects = ()=>buttons.evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect(); return [r.x,r.y,r.width,r.height];}));
  async function answer() {
    const dir = await (await page.waitForFunction(()=>__SCS_QA__.gameState().direction)).jsonValue();
    await page.locator(`#game .corner-shape[data-dir="${dir}"]`).tap();
    await page.waitForFunction(()=>__SCS_QA__.gameState().correct > 0);
  }
  await page.goto(server.baseUrl); await page.locator('#pwMenu').tap();
  await page.setViewportSize({width:320,height:568});
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';});
  async function clearDock(action) {
    const row=page.locator(`#hub [data-action="${action}"]`);
    await row.scrollIntoViewIfNeeded();
    assert.ok(await row.evaluate(el=>{
      const r=el.getBoundingClientRect(), d=document.querySelector('#hub nav').getBoundingClientRect();
      return r.bottom<=d.top+1 && el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    }),`${action} stays readable and tappable above the dock`);
  }
  await clearDock('mathe'); await pick('collection'); await clearDock('settings');
  await page.setViewportSize({width:360,height:640});
  await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  await pick('records');
  await page.locator('#lbModeSelect').selectOption('mathe');
  await page.locator('#btnLbPlayNow').tap(); await game('mathe');
  await page.locator('#btnPause').tap(); await page.locator('#btnPauseQuit').tap();
  await page.locator('#hub [data-action=collection][aria-current]').waitFor();
  await pick('play'); await pick('memo'); await game('memo');
  await page.locator('.corner-shape.memo-revealing:visible').first().waitFor();
  const shown = await rects();
  await page.locator('.corner-shape.memo-covered:visible').first().waitFor();
  assert.deepEqual(await rects(),shown);
  assert.match(await page.locator('#deckInstruction').innerText(), /Wo war/);
  assert.equal(shown.length,4);
  assert.ok(shown.every(([,y,w,h])=>y>320 && w>=88 && h>=44 && y+h<640));
  await answer();
  await page.locator('#results.active #btnOneMore').waitFor({timeout:60000});
  await page.locator('#btnOneMore').tap(); await game('memo');
  await page.locator('#btnPause').tap(); await page.locator('#btnPauseQuit').tap();
  await pick('mathe'); await game('mathe'); await answer();
  await page.locator('#results.active #btnHome').waitFor({timeout:60000});
  await page.locator('#btnHome').tap();
  await page.reload(); await page.locator('#hub.active').waitFor();
  assert.match(await page.locator('[data-action=resume]').innerText(), /Mathe/);
  await pick('resume'); await game('mathe');
  await page.locator('#btnPause').tap(); await page.locator('#btnPauseQuit').tap();
  await pick('worlds');
  await page.locator('#prism .play-dock [data-action=collection]').tap();
  await pick('worlds'); await page.locator('#pwContinue').tap(); await page.locator('#pwArena canvas').waitFor();
  assert.equal(await page.locator('.play-dock:visible').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS collection, Memo preview/recall, scored round, replay, switch to Math, persisted resume, return to garden.');
} finally { await browser.close(); await server.close(); }
