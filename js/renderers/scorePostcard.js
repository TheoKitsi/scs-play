import { t, getLanguage } from '../i18n.js';

/** A local, printable version of the settled round ticket. No profile data. */
export async function scorePostcard(stats) {
  const canvas = document.createElement('canvas');
  canvas.width = 960; canvas.height = 640;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const font = (size, weight = 500) => `${weight} ${size}px Outfit,system-ui,sans-serif`;
  const text = (value,x,y,size,color,weight,width) => {
    g.font=font(size,weight); g.fillStyle=color; g.fillText(value,x,y,width);
  };
  const cream='#fff4dd', apricot='#ffcb8b', ink='#162535';
  g.fillStyle=ink; g.fillRect(0,0,960,640);
  const art = document.querySelector('#results.active #ticketScene');
  if (art?.complete && art.naturalWidth > 0) {
    const w=600,h=430,scale=Math.max(w/art.naturalWidth,h/art.naturalHeight);
    g.save(); g.beginPath(); g.rect(360,0,w,h); g.clip();
    g.drawImage(art,360+(w-art.naturalWidth*scale)/2,(h-art.naturalHeight*scale)/2,art.naturalWidth*scale,art.naturalHeight*scale);
    g.restore();
    const shade=g.createLinearGradient(350,0,960,0);
    shade.addColorStop(0,ink); shade.addColorStop(.65,'#162535bb'); shade.addColorStop(1,'#16253533');
    g.fillStyle=shade; g.fillRect(350,0,610,h);
  }
  // Engraved prism and split ray remain legible even without a decoded cover.
  g.save(); g.translate(744,165); g.lineWidth=3;
  for(const [color,y] of [['#a1d9c5',-58],[apricot,0],['#d3b8e7',58]]) {
    g.strokeStyle=color; g.beginPath(); g.moveTo(30,52); g.lineTo(225,y+52); g.stroke();
  }
  g.strokeStyle=cream; g.beginPath(); g.moveTo(-88,52);g.lineTo(6,-98);g.lineTo(100,52);g.closePath();
  g.moveTo(-88,52);g.lineTo(17,18);g.lineTo(6,-98);g.moveTo(17,18);g.lineTo(100,52);g.stroke();g.restore();
  text('SCS PLAY',56,72,33,cream,680,470);
  text(`${t(`mode_${stats.mode || 'klassik'}`)}  /  ${t(`play_${stats.playType || 'classic'}`)}`,56,164,36,apricot,500,540);
  text(Number(stats.score || 0).toLocaleString(getLanguage()),52,337,146,cream,650,625);
  text(t('share_pts'),59,394,32,cream,520,625);
  g.fillStyle='#f5ecdc';g.fillRect(0,430,960,210);
  g.fillStyle='#bcab96';g.fillRect(481,474,2,120);
  for (const [x,label,value] of [[56,t('accuracy'),`${stats.accuracy || 0}%`],[536,t('streak_label'),`${stats.streak || 0}×`]]) {
    text(label,x,505,31,'#465260',500,355);text(value,x,588,71,ink,650,355);
  }
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  return blob ? new File([blob],'scs-play.png',{type:blob.type}) : null;
}
