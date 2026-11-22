/** Pair actual screenshot runs by state name. Output is a self-contained
 * directory that may be served separately from the game or opened offline. */
import {cp, mkdir, readdir, writeFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';

const [before,after,dest] = process.argv.slice(2);
if (!dest) throw new Error('Usage: node scripts/compare-surfaces.mjs BEFORE/VIEW AFTER/VIEW OUTPUT');
const afterNames = new Set(await readdir(after));
const names = (await readdir(before)).filter(n=>/^[\w-][\w.-]*\.png$/.test(n) && afterNames.has(n)).sort();
if (!names.length) throw new Error('No matching screenshot states');
for(const [folder,src] of [['vorher',before],['nachher',after]]) {
  await mkdir(resolve(dest,folder),{recursive:true});
  for(const n of names) await cp(resolve(src,n),resolve(dest,folder,n));
}
const group = n => {
  const i=Number(n.slice(0,2));
  return i<=6?'Einstieg & Katalog':i<=11?'Rekorde & Erfolge':i<=17?'Shop & Avatar':
    i<=24?'Einstellungen & Belohnungen':i<=30?'Tutorial & Arcade':i<=34?'Rundenauswertung':'Designs & System';
};
const sections = Map.groupBy(names,group);
const label = n=>basename(n,'.png').replace(/^\d+-/,'').replaceAll('-',' ');
const items = [...sections].map(([title,entries],i)=>`<section id="g${i}"><h2>${title}</h2>${entries.map(n=>`<article><h3>${label(n)}</h3><div class="pair">${['vorher','nachher'].map(k=>`<figure><figcaption>${k}</figcaption><a href="${k}/${n}"><img loading="lazy" src="${k}/${n}" alt="${label(n)} · ${k}"></a></figure>`).join('')}</div></article>`).join('')}</section>`);
await writeFile(resolve(dest,'index.html'),`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SCS Play · Designvergleich</title>
<style>*{box-sizing:border-box}html{background:#101a27;color:#fff2dd;font:100%/1.5 system-ui}body{max-width:48rem;margin:auto;padding:1rem}h1{font:500 clamp(2.5rem,8vw,4rem)/1 Georgia,serif;margin:.4em 0}h3{text-transform:capitalize}.pair{display:grid;grid-template-columns:1fr 1fr;gap:clamp(6px,3vw,1rem)}figure{margin:0;min-width:0}img{display:block;width:100%;border:1px solid #536376;border-radius:12px}figcaption{font-size:.9rem;color:#d2dbe5;text-transform:capitalize}a{color:#ffdeb1}nav{display:flex;flex-wrap:wrap;gap:.4rem 1rem}nav a{padding:.4rem 0}section{border-top:1px solid #536376;margin-top:2rem}article{margin-bottom:2rem}a:focus-visible{outline:3px solid #ffdf93}</style>
<main><p>SCS PLAY / DESIGNREVIEW</p><h1>Vorher und nachher</h1><p>${names.length} Zustände auf demselben Bildschirmformat. Tippe auf eine Aufnahme für die Originalgröße. Seltene Zustände sind gezielte Testfälle; Spielinhalte und Zufallswerte können abweichen.</p><nav>${[...sections.keys()].map((name,i)=>`<a href="#g${i}">${name}</a>`).join('')}</nav>${items.join('')}</main></html>`);
console.log(`${names.length} pairs in ${resolve(dest,'index.html')}`);
