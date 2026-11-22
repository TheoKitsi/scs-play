/** Refresh the install listing from a real mobile session, without seeded progress. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { startStaticServer } from './lib/static-server.mjs';

const server = await startStaticServer({root:'.',port:0});
const browser = await chromium.launch();
try {
  const dir = 'img/install';
  await mkdir(dir,{recursive:true});
  const page = await browser.newPage({viewport:{width:360,height:640},deviceScaleFactor:1,
    locale:'de-DE',isMobile:true,hasTouch:true,serviceWorkers:'block'});
  page.setDefaultTimeout(30000);
  await page.addInitScript(()=>localStorage.setItem('scsQa','1'));
  await page.goto(server.baseUrl);
  const icon = await page.evaluate(async () => {
    const image = new Image(); image.src = 'img/icon-512.svg'; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 180;
    canvas.getContext('2d').drawImage(image,0,0,180,180);
    return canvas.toDataURL().split(',')[1];
  });
  await writeFile(`${dir}/icon-180.png`,Buffer.from(icon,'base64'));
  const cdp = await page.context().newCDPSession(page);
  async function capture(name) {
    const {data} = await cdp.send('Page.captureScreenshot',{format:'webp',quality:80});
    await writeFile(`${dir}/${name}.webp`,Buffer.from(data,'base64'));
  }
  await page.locator('#pwArena canvas').waitFor();
  await page.locator('#pwArena .pw-loading').waitFor({state:'detached'});
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
  await capture('garden');
  const gardenFrame=await page.locator('#pwArena canvas').screenshot();
  const cover = await page.evaluate(async frame => {
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;
    const g=canvas.getContext('2d'), img=new Image();img.src='img/scenery/harbour.webp';await img.decode();
    g.drawImage(img,0,0,1200,630);
    const shade=g.createLinearGradient(0,0,1200,310);shade.addColorStop(0,'#142232');shade.addColorStop(.50,'#172334f0');shade.addColorStop(1,'#17233417');g.fillStyle=shade;g.fillRect(0,0,1200,630);
    const arena=new Image();arena.src=`data:image/png;base64,${frame}`;await arena.decode();
    g.save();g.beginPath();g.roundRect(737,42,415,545,[105,105,28,28]);g.clip();g.drawImage(arena,737,42,415,545);g.restore();
    g.fillStyle='#ffdeb1';g.font='600 30px Outfit,sans-serif';g.fillText('SCS PLAY',64,106);
    g.fillStyle='#fff3de';g.font='94px Georgia,serif';g.fillText('Der Lichtgarten',61,319,642);
    g.fillStyle='#ffdeb1';g.fillRect(66,364,65,3);g.font='36px Outfit,sans-serif';g.fillText('12 Rätsel  /  10 Arcade-Modi',64,428);
    return canvas.toDataURL('image/jpeg',.88).split(',')[1];
  },gardenFrame.toString('base64'));
  await writeFile(`${dir}/cover.jpg`,Buffer.from(cover,'base64'));
  await page.locator('#pwQuickColors').tap();
  const state = await (await page.waitForFunction(()=>{const s=globalThis.__SCS_QA__?.gameState();return s?.direction && s.stimulusId != null && s})).jsonValue();
  await page.locator(`#game .corner-shape[data-dir="${state.direction}"]`).tap();
  await page.waitForFunction(id=>{const s=__SCS_QA__.gameState();return s.correct>0 && s.stimulusId!==id && !!s.direction},state.stimulusId);
  await capture('arcade');
} finally { await browser.close(); await server.close(); }
