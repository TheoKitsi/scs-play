// Stationary architecture below the sockets. Recessed faces, low rails and
// hanging supports read as scenery rather than additional collision pieces.
// Painted once per level, behind every live guide, shutter, mirror and link.
export function drawGardenTerraces(g, level) {
  const polygon = (color, points, alpha = 1) => {
    g.fillStyle(color, alpha); g.fillPoints(points.map(([x, y]) => ({ x, y })), true);
  };
  const stone = [0x394552, 0x354654, 0x534249][level.zone];
  const face = [0x283d42, 0x273642, 0x342f39][level.zone];
  const trim = [0x93ad90, 0xa5b5ac, 0xd1ac7b][level.zone];
  for (const n of level.nodes.filter(n => n.kind === 'crystal')) {
    const x = n.x, y = n.y + 19;
    if (level.zone === 0) {
      // These sockets already stand on planted basalt beds. Set the shelter,
      // paired frequencies and broken ruin into the bed's visible front edge.
      if (level.id === 'first-light') continue;
      if (level.id === 'two-frequencies') {
        for (const dx of [-13,0,13]) {
          const length = (n.color === 'mint' ? 26 : 13) - Math.abs(dx) / 2;
          polygon(face, [[x+dx-3,y+1],[x+dx+3,y+1],[x+dx+3,y+length],[x+dx,y+length+3],[x+dx-3,y+length]]);
          g.lineStyle(1.4,trim,.85); g.lineBetween(x+dx-2,y+1,x+dx-2,y+length);
        }
      } else {
        const side = level.id === 'resonance' ? -1 : 1;
        polygon(stone, [[x-25,y],[x+23,y],[x+17,y+9],[x+side*12,y+20],[x-13,y+11]]);
        g.lineStyle(1.6,trim,.72); g.lineBetween(x-25,y,x+23,y); g.lineBetween(x+side*12,y+3,x+side*8,y+16);
      }
      continue;
    }
    if (level.id === 'right-turn' || level.id === 'other-side') {
      const dir = level.id === 'right-turn' ? 1 : -1;
      // Counterweighted brackets carry these platforms from opposite banks.
      polygon(face, [[x-31*dir,y],[x+39*dir,y],[x+36*dir,y+32],[x+26*dir,y+39],[x+26*dir,y+18],[x-15*dir,y+9]]);
      polygon(stone, [[x-32*dir,y],[x+40*dir,y-5],[x+40*dir,y+3],[x-17*dir,y+6]]);
      g.lineStyle(1.6,trim,.83); g.lineBetween(x-30*dir,y,x+38*dir,y-4); g.lineBetween(x+8*dir,y+8,x+30*dir,y+24);
    } else if (level.id === 'golden-hour' || level.id === 'the-sun-engine') {
      const motor = level.zone === 2;
      // Graduated sundial bowls vs. ribbed turbine casings.
      polygon(face, [[x-27,y],[x+27,y],[x+19,y+13],[x+5,y+22],[x-12,y+17]]);
      g.fillStyle(stone); g.fillEllipse(x,y,57,15);
      g.lineStyle(1.8,trim,.84); g.strokeEllipse(x,y,57,15);
      for (const dx of [-17,-8,0,8,17]) g.lineBetween(x+dx,y+9-Math.abs(dx)*.14,x+dx*(motor ? .9 : .69),y+(motor ? 15 : 20)-Math.abs(dx)*.26);
    } else if (level.id === 'prism-garden') {
      for (const d of [-1,1]) {
        polygon(face, [[x,y+26],[x-23*d,y+6],[x-35*d,y-5],[x-12*d,y+2]]);
        g.lineStyle(1.8,trim,.8); g.lineBetween(x-33*d,y-4,x,y+20);
      }
    } else if (level.id === 'light-weaver') {
      // A hanging textile with an open comb rather than another barrier.
      g.fillStyle(stone); g.fillRoundedRect(x-23,y-2,46,8,3);
      for (let i=-3;i<=3;i++) {
        const dx=i*5, end=y+27-Math.abs(i)*4;
        g.lineStyle(3,face); g.lineBetween(x+dx,y+6,x+dx,end+2);
        g.lineStyle(1.4,trim); g.lineBetween(x+dx-1,y+6,x+dx-1,end);
      }
    } else {
      const tower = level.id === 'world-awake', h = tower ? 46 : 29;
      polygon(face, [[x-24,y],[x+24,y],[x+17,y+h-5],[x,y+h+2],[x-17,y+h-5]]);
      polygon(stone, [[x,y],[x+24,y],[x+17,y+h-5],[x,y+h+2]]);
      for(const dx of [-12,0,12]) {
        if(tower){g.fillStyle(0x1e2831);g.fillRoundedRect(x+dx-3,y+12,6,20,3)}
        else {g.lineStyle(2,trim,.65);g.lineBetween(x+dx,y+7,x+dx*.7,y+h-6)}
      }
      g.lineStyle(1.8,trim,.77); g.lineBetween(x-26,y+3,x+26,y+3);
    }
  }
}
