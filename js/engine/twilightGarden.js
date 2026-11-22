/* Two small, static canvas paintings. The live simulation supplies every
   crystal and collision; the distant flower only reflects earned progress. */
function fallbackSky(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 90, 560);
  for (const [y, color] of [[0, '#302e54'], [.24, '#956777'], [.39, '#dfab90'], [.56, '#56747c'], [1, '#102e39']]) sky.addColorStop(y, color);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 420, 560);
  function shape(color, path) { ctx.fillStyle = color; ctx.fill(new Path2D(path)); }
  ctx.fillStyle = '#ffdeab'; ctx.beginPath(); ctx.arc(319, 77, 31, 0, Math.PI * 2); ctx.fill();
  shape('#8b768a', 'M0 172 Q40 129 74 156 Q112 118 155 154 Q183 149 225 185 L0 210Z M218 179 Q270 143 305 149 Q346 105 420 135 V205Z');
  shape('#655e78', 'M244 139 Q281 126 363 130 L387 136 366 144 356 165 346 148 342 177 330 150 311 159 299 143Z');
  shape('#bba1a2', 'M244 139 Q300 119 364 129 L387 136 Q316 132 279 143Z');
  for (let i = 0; i < 45; i++) {
    const x = (i * 89 + 11) % 416, y = (i * i * 17 + 9) % 128;
    ctx.fillStyle = i % 4 ? '#fff4dc80' : '#fff4dc'; ctx.fillRect(x, y, i % 4 ? 1 : 2, 1.6);
  }
  shape('#54727b', 'M0 192 Q75 162 138 202 T278 199 Q342 174 420 182 V560 H0Z');
  shape('#315761', 'M0 231 Q92 182 177 219 T328 215 Q385 198 420 204 V560 H0Z');
  shape('#244953', 'M0 256 Q91 208 191 244 T420 232 V560 H0Z');
  shape('#173941', 'M0 318 Q68 278 102 298 Q205 357 294 312 Q365 279 420 284 V560 H0Z');
  // Broken, curved contour lines describe the slope without implying a ray.
  ctx.strokeStyle = '#81aaa026'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) ctx.stroke(new Path2D(`M-10 ${326+i*26} Q58 ${287+i*26} 110 ${319+i*26} T228 ${344+i*25} M292 ${329+i*26} Q358 ${305+i*26} 430 ${316+i*26}`));
  for (let side = 0; side < 2; side++) {
    ctx.save(); if (side) { ctx.translate(420, 0); ctx.scale(-1, 1); }
    for (const [x,y,s] of [[0,550,1.5],[28,534,.78],[2,295,.63],[14,28,.55]]) {
      ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
      for (let i = 0; i < 7; i++) {
        ctx.save(); ctx.rotate((i - 3) * .27);
        shape(i % 2 ? '#275858' : '#0e343c', 'M0 0 Q-16 -17 -5 -48 Q8 -38 0 0Z');
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

export function paintTwilight(ctx, level, plate) {
  if (plate) {
    ctx.drawImage(plate,0,0,420,560);
  } else fallbackSky(ctx);
  // A distant hanging garden, then the stepped beds, then the near bank.
  // Each socket still stands at its authored centre. The negative space
  // between the steps keeps the crystal chain readable at thumb scale.
  bed(ctx, 327, 139, 32, 29, 21, 9);
  const buds = level.nodes.filter(n => n.kind === 'crystal').sort((a,b) => a.y - b.y);
  for (const [i, n] of buds.entries()) {
    const opening = level.id === 'first-light';
    bed(ctx, n.x, n.y + 20, opening ? [103,82,79][i] : 44,
      opening ? [39,47,52][i] : 40, opening ? [47,48,56][i] : 34, 15 + i * 19);
  }
  bed(ctx, level.launch.x, level.launch.y + 17, 237, 86, 137, 81);
}

function wash(ctx, x, y, xx, yy, stops) {
  const g = ctx.createLinearGradient(x,y,xx,yy);
  for (const [t,c] of stops) g.addColorStop(t,c);
  return g;
}

// Local coordinates: a tapered, cambered moss bed on eroded basalt columns.
// One bake into the existing landscape texture, including all the vegetation.
function bed(ctx, x, y, left, right, depth, seed) {
  let bits = seed;
  const random = () => ((bits = (Math.imul(bits, 1664525) + 1013904223) >>> 0) / 4294967296);
  const width = left + right, near = depth > 100;
  const envelope = t => Math.sin(Math.PI * t) ** .72;
  const lip = t => envelope(t) * (4 + 2.8 * Math.sin(t * 8 + seed)) + (near ? (1-t)**1.6 * 55 : (1-t) * 4);
  const crown = t => lip(t) - envelope(t) * (near ? 26 : 15);
  const px = t => -left + t * width;
  ctx.save(); ctx.translate(x,y);
  const moss = new Path2D();
  for (let i=0; i<=40; i++) {
    const t = i/40, h = crown(t);
    if (i===0) moss.moveTo(px(t),h); else moss.lineTo(px(t),h);
  }
  for (let i=40; i>=0; i--) moss.lineTo(px(i/40),lip(i/40)+1.5);
  moss.closePath();

  // Joints taper inward below the lip. Each column shares its top and side
  // edges with its neighbour, with a distinct warm rim and cool fracture.
  const cols = Math.ceil(width / (near ? 30 : 20)), joints=[];
  for(let i=0;i<=cols;i++){
    const t = i===0 || i===cols ? i/cols : (i + (random()-.5)*.55)/cols;
    const f = envelope(t), h = depth * f * (.44 + .31 * Math.sin(t*4+.3) + .24*random());
    joints.push({x:px(t), y:lip(t), h, dx:(.4-t)*width*.28 - f*depth*.13});
  }
  for(let i=0;i<cols;i++){
    const a=joints[i], b=joints[i+1], w=b.x-a.x, ridge=.22+random()*.36;
    const rock=new Path2D();
    rock.moveTo(a.x-.4,a.y-1); rock.lineTo(b.x+.4,b.y-1);
    rock.lineTo(b.x+b.dx+.3,b.y+b.h); rock.lineTo(a.x+a.dx+w*ridge,a.y+a.h+depth*(.03+.09*random()));
    rock.lineTo(a.x+a.dx-.4,a.y+a.h); rock.closePath();
    ctx.save(); ctx.clip(rock);
    ctx.fillStyle=wash(ctx,a.x,a.y,b.x+2,b.y+1,[[0,'#343c49'],[ridge,'#4b5059'],[ridge+.14,'#6d6970'],[1,'#98897d']]);
    ctx.fillRect(-left,-10,width+2,depth+75);
    ctx.fillStyle=wash(ctx,0,a.y,2,a.y+Math.max(2,a.h),[[0,'#ffc39320'],[.2,'#30384700'],[.9,'#182c3cbf'],[1,'#1c3040']]);
    ctx.fillRect(-left,-10,width+2,depth+75);
    for(let k=1;k<6;k++){
      const v=a.y + (a.h/7)*k + random()*3;
      ctx.strokeStyle=k%3 ? '#d4c7a31e' : '#171e3047'; ctx.lineWidth=.6+random();
      ctx.beginPath();ctx.moveTo(a.x+a.dx-7,v+3);ctx.quadraticCurveTo(a.x+w*.4,v+1,b.x+8,v-3);ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle=wash(ctx,-left,6,right,-7,[[0,'#234644'],[.43,'#487066'],[.78,'#82987b'],[1,'#ddc69f']]);
  ctx.fill(moss);
  ctx.save(); ctx.clip(moss);
  for(let i=0;i<width*1.7;i++){
    const t=random(), size=.55+random()*2.9;
    ctx.fillStyle=['#ddd9a744','#254b5044','#9eb69b50','#45545135'][i%4];
    ctx.beginPath();ctx.ellipse(px(t),crown(t)+(lip(t)-crown(t))*random(),size,size*.35,-.09,0,2*Math.PI);ctx.fill();
  }
  // Contact shadow falls away from the setting sun and seats the ring.
  const shadow=ctx.createRadialGradient(0,0,2,0,0,1+Math.min(36,right));
  shadow.addColorStop(0,'#112d34c9');shadow.addColorStop(1,'#152c3100');
  ctx.scale(1,.26);ctx.fillStyle=shadow;ctx.fillRect(-42,-36,84,72);ctx.restore();

  // Broken sprays instead of a uniform grassy outline; never crowd a socket.
  const patches = near ? [.14,.3,.43,.54,.93] : [.11,.26,.86];
  for(const t of patches){
    const fx=px(t); if(Math.abs(fx)<(near?39:25)) continue;
    const size = near ? 21+random()*20 : (8+random()*11) * Math.min(1,depth/40);
    spray(ctx,fx,crown(t)+2,size,random);
  }
  // Soft strands of hanging saxifrage interrupt just a few column edges.
  for(const t of [.21,.38,.8]){
    const sx=px(t), sy=lip(t), len=(near?27:13)+random()*13;
    ctx.strokeStyle='#475f53';ctx.lineWidth=1.3;
    ctx.beginPath();ctx.moveTo(sx,sy);ctx.bezierCurveTo(sx+4,sy+6,sx-4,sy+len*.8,sx+1,sy+len);ctx.stroke();
    for(let j=0;j<5;j++){
      const f=j/5, r=(1-f)*2.6+.7;
      ctx.fillStyle=j%2?'#81947b':'#56796a';
      ctx.beginPath();ctx.ellipse(sx+(j%2?2:-1),sy+len*f,r,r*.6,j%2?-.6:.6,0,2*Math.PI);ctx.fill();
    }
  }
  ctx.restore();
}

function spray(ctx,x,y,h,random) {
  ctx.save();ctx.translate(x,y);
  for(let i=0;i<7;i++){
    const lean=(i-3)*.29, tx=h*lean, ty=-h*(1-.51*Math.abs(lean))*(.55+.45*random());
    const breadth=h*(.07+.06*random());
    ctx.fillStyle=wash(ctx,0,1,tx,ty,[[0,'#25484a'],[.64,i%2?'#547665':'#476c63'],[1,'#b5bd90']]);
    ctx.beginPath();ctx.moveTo(0,1);
    ctx.quadraticCurveTo(tx*.3-breadth,ty*.85,tx,ty);
    ctx.quadraticCurveTo(tx*.7+breadth,ty*.42,0,1);ctx.fill();
  }
  ctx.restore();
}
export function paintFlower(ctx, open) {
  ctx.save(); ctx.translate(36, 41);
  ctx.lineCap = 'round';
  ctx.strokeStyle='#344f46';ctx.lineWidth=2.8;
  ctx.stroke(new Path2D('M-6 36 C5 21 -4 16 2 -1'));
  ctx.strokeStyle='#b9ad7d';ctx.lineWidth=.85;
  ctx.stroke(new Path2D('M-5 35 C6 20 -2 15 2 -1'));
  for(const [x,y,angle,h] of [[-3,31,-.86,19],[0,23,.82,25],[0,15,-.57,14]]){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(h/20,h/20);
    ctx.fillStyle=wash(ctx,-5,0,5,-16,[[0,'#264947'],[.48,'#537165'],[.53,'#81967b'],[1,'#acb48a']]);
    ctx.fill(new Path2D('M0 1 Q-8 -5 -1 -20 Q7 -10 0 1Z'));
    ctx.restore();
  }
  // Crocus: the dusty back tepals silhouette against the sun; warm inner
  // petals and exposed stamens appear only once this garden has been earned.
  ctx.translate(2,1);ctx.rotate(.18);
  for(const i of [-2,2,-1,1,0]){
    ctx.save();ctx.rotate(i * (open ? .52 : .15));
    const h = open ? 23 + Math.abs(i) : 22-Math.abs(i)*1.5;
    ctx.scale(1,h/24);
    ctx.fillStyle=wash(ctx,-7,0,6,-23,open ?
      [[0,'#8e545c'],[.45,'#da8c80'],[.79,'#ffcb9f'],[1,'#fff3c1']] :
      [[0,'#3a4f51'],[.4,'#745c6e'],[.8,'#ac8188'],[1,'#d2ab9c']]);
    ctx.fill(new Path2D('M0 0 C-9 -3 -10 -17 -2 -24 C6 -21 9 -8 0 0Z'));
    ctx.strokeStyle=open?'#fff2c4a3':'#e2c3ae70';ctx.lineWidth=1;
    ctx.stroke(new Path2D('M0 -2 Q-4 -10 -2 -21'));
    ctx.restore();
  }
  if(open){
    for(const [dx,dy] of [[-4,-10],[.5,-13],[4,-10]]){
      ctx.strokeStyle='#efac67';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(dx,dy);ctx.stroke();
      ctx.fillStyle='#fff2b5';ctx.beginPath();ctx.ellipse(dx,dy,1.4,2.6,.15,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}
