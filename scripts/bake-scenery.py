"""Bake original SCS environment plates and product shots. Authoring only:
Python 3, NumPy and Pillow. The game ships the WebPs, not a Python runtime."""
from pathlib import Path
import math
import random
import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "img" / "scenery"
OUT.mkdir(exist_ok=True)
def norm(v):
    return v / np.maximum(1e-7, np.linalg.norm(v, axis=-1, keepdims=True))
def sat(x):
    return np.clip(x, 0., 1.)
def mix(a, b, f):
    return a + (b-a)*f[..., None]
def save(name, image):
    image.convert("RGB").save(OUT/(name+".webp"), quality=87, method=6)
    print(name, image.size, (OUT/(name+".webp")).stat().st_size, flush=True)
def field(rng, w, h):
    v = np.zeros((h,w), dtype=np.float32)
    for i, a in enumerate([.48,.25,.14,.075,.04,.015]):
        small = rng.randint(0,256,(3*2**i,6*2**i), dtype=np.uint8)
        v += np.array(Image.fromarray(small).resize((w,h),Image.BICUBIC))*a/255.
    return v
def u8(a): return np.uint8(np.clip(a,0,255))

def harbour():
    rng = np.random.RandomState(2401)
    rand = random.Random(814)
    w,h = 1152,1152
    x,y = np.meshgrid(np.linspace(0,1,w),np.linspace(0,1,h))
    water = 718
    noise = field(rng,w,h)
    rgb = np.stack([np.interp(y,[0,.24,.44,.63,1],stops) for stops in
                    [[25,94,205,244,38],[40,77,129,186,44],[76,111,142,155,64]]],axis=-1)
    cloud = sat((noise-.45)*3.1)*sat((.58-y)*4.)
    rgb = mix(rgb,np.array([65,62,102]),cloud*.56)
    radius = np.hypot(x-.71,y-.447)
    rgb += np.exp(-radius*8)[...,None]*[44,27,4]
    rgb = mix(rgb,np.array([255,224,173]),sat((.025-radius)*900))
    sky = Image.fromarray(u8(rgb)); draw = ImageDraw.Draw(sky)
    # Solid perspective silhouettes, independently lit front/side curtain walls.
    for layer, (base, count, step, height, depth) in enumerate([(658,94,19,110,.32),(679,62,27,184,.59),(699,40,43,243,.85)]):
        left = -50
        for i in range(count):
            bw = rand.randint(int(step*.55),int(step*1.55))
            bh = int(height*(.12+rand.random()*.86)*(.56+.44*abs(math.cos(left/w*5.5))))
            if layer==2 and .46*w < left < .68*w: bh = int(bh*.57)
            top = base-bh
            ed = int(bw*rand.uniform(.17,.37)); lift=max(2,ed//4)
            fg = np.array([39,49,70])+rand.randint(-7,15)
            tint=lambda c: tuple(u8(np.array([190,145,151])*(1-depth)+c*depth))
            draw.rectangle([left,top,left+bw-ed,base],fill=tint(fg))
            draw.polygon([(left+bw-ed,top),(left+bw,top-lift),(left+bw,base-lift),(left+bw-ed,base)],fill=tint(fg+[25,12,10]))
            draw.polygon([(left,top),(left+ed,top-lift),(left+bw,top-lift),(left+bw-ed,top)],fill=tint(fg+[49,30,24]))
            if bh>90:
                draw.rectangle([left+bw*.24,top-5,left+bw*.63,top-1],fill=tint(fg))
                if i%4==1: draw.line([left+bw*.46,top-5,left+bw*.46,top-rand.randint(12,29)],fill=tint(fg))
            for yy in range(top+4,base,4+layer):
                if i%4==0: draw.line((left+1,yy,left+bw-ed-1,yy),fill=tint(fg+[14,12,15]))
                for xx in range(left+2,left+bw-ed-1,4+layer):
                    r=rand.random()
                    light = [80,83,99] if r<.76 else ([234,177,113] if r<.92 else [196,206,198])
                    draw.rectangle([xx,yy,xx+1+(layer==2),yy+1], fill=tint(np.array(light)))
            for j in range(3,ed,4):
                draw.line([left+bw-ed+j,top-j*lift/ed+1,left+bw-ed+j,base],fill=tint(fg+[43,24,25]))
            left += int(bw*rand.uniform(.7,1.06))
    # Long-span coastal viaduct with a lit promenade in front of the skyline.
    draw.polygon([(0,680),(w,651),(w,657),(0,694)],fill='#373f52')
    for xx in range(0,w,59):
        yy=680-29*xx/w
        draw.polygon([(xx,yy),(xx+8,yy),(xx+5,704),(xx,706)],fill='#454558')
    for px,py,span in [(865,642,150),(1034,640,120)]:
        draw.polygon([(px-9,py+20),(px,py-106),(px+4,py-106),(px+10,py+20)],fill='#575163')
        for side in [-1,1]:
            for n in range(1,11):
                draw.line((px+1,py-103+n*3,px+n*span/10*side,py+18),fill='#a18a8c',width=1)
    for j in range(500):
        xx=rand.randrange(w); yy=rand.uniform(700,water)
        draw.line((xx,yy,xx+rand.randint(1,4),yy),fill=rand.choice(['#514351','#746476','#e8ae83','#ffd19a']))
    draw.polygon([(0,700),(w,692),(w,water),(0,water)],fill='#45414d')
    for xx in range(0,w,11):
        draw.line((xx,707,xx+rand.randint(1,4),707),fill=rand.choice(['#746578','#bb837a','#ffcf94']))
    # Reflect the actual sky/buildings with depth-dependent surface roughness.
    a=np.asarray(sky).copy()
    rr,cc=np.indices((h-water,w)); d=rr/(h-water)
    ripple = np.sin(rr*.77+noise[water:]*34)+np.sin(rr*.19+cc*.014+noise[water:]*17)
    sy=np.clip((water-1-rr*.85 + ripple*(2+19*d)).astype(int),0,water-1)
    sx=np.clip((cc+ripple*(2+4*d)).astype(int),0,w-1)
    lake=a[sy,sx]*np.array([.64,.70,.81])
    lake=mix(lake,np.array([24,47,66]),.17+.44*d)
    lake+=np.maximum(0,ripple-1)[...,None]*[18,17,16]
    a[water:]=u8(lake)
    sky=Image.fromarray(a); draw=ImageDraw.Draw(sky)
    # Near-camera fronds break the horizon; individual leaflets catch the rim.
    for ox,oy,size,lean in [(-45,991,318,.35),(1190,899,219,-.31)]:
        tx,ty=ox+size*lean,oy-size
        draw.polygon([(ox-11,oy),(ox+11,oy),(tx+4,ty),(tx-2,ty)],fill='#1b2533')
        for k in range(13):
            angle=math.pi*(k/12*1.18-.10)
            vx,vy=math.cos(angle)*size*.47,-math.sin(angle)*size*.50
            for i in range(1,31):
                t=i/31; bx,by=tx+vx*t,ty+vy*t+size*.36*t*t
                length=math.sin(math.pi*t)**.65*size*.1
                for sign in [-1,1]:
                    draw.polygon([(bx,by),(bx+vx*.023,by+vy*.024),(bx+vx*.084+sign*length*.31,by+length*(1.1+sign*.43))],fill='#212b37' if k%3 else '#373944')
            draw.line([(tx+vx*t/30,ty+vy*t/30+size*.36*(t/30)**2) for t in range(31)],fill='#262b37',width=2)
    save('harbour',sky)

def valley():
    rng=np.random.RandomState(917)
    w,h=840,1120
    x,y=np.meshgrid(np.linspace(-1,1,w),np.linspace(0,1,h))
    noise=field(rng,w,h); grain=rng.normal(0,1,(h,w))
    canvas=np.stack([np.interp(y,[0,.18,.36,.65,1],stops) for stops in
                     [[43,122,235,101,24],[53,110,169,116,45],[100,148,163,149,58]]],axis=-1)
    disc=np.hypot((x-.52)*.375,y-.147)
    canvas+=np.exp(-disc*11)[...,None]*[55,38,13]
    canvas=mix(canvas,np.array([255,230,181]),sat((.029-disc)*1000))
    canvas=mix(canvas,np.array([153,124,151]),sat((noise-.49)*4)*.38*(y<.34))
    horizon=.33
    # Project a continuous heightfield into the camera one depth slice at a
    # time. Neighboring terrain samples supply a normal for the setting sun.
    tex=field(rng,1024,1024)
    def land(x,z):
        u=(x*14+518).astype(int)%1024; v=int(z*14)%1024
        n=tex[v,u]+.22*(tex[(v*5)%1024,(u*5)%1024]-.5)+.08*(tex[(v*15)%1024,(u*15)%1024]-.5)
        bank=np.abs(x-1.8*math.sin(z*.24)-z*.10)
        ridge=np.minimum(1,np.maximum(0,(bank-1.4)/5))**1.6
        return (ridge*(2.3+4.5*n+1.4*np.sin(x*.9+z*.68)) + (.3+n)*np.sin(x*.8+.5*z)*.25
                +sat((z-23)/6)*(1.2+5*n))-1.25
    water=sat((y-horizon)/.67); wav=field(rng,w,h)
    lake=mix(np.array([197,153,155]),np.array([18,61,75]),water**.67)
    micro=rng.normal(0,1,(h,w))
    spec=np.exp(-((x-.52)/(.045+.29*water))**2)*sat(.64*np.sin(y*890+wav*95+micro*.55)+.31*np.sin(y*1513+wav*39)-.20)
    lake+=spec[...,None]*[94,69,40]
    canvas=np.where((y>horizon)[...,None],lake,canvas)
    landmask=np.zeros((h,w),bool)
    cols=np.arange(w); last=np.full(w,h)
    for z in np.geomspace(62,1.7,1900)[::-1]:
        wx=x[0]*z*.44; height=land(wx,z)
        py=np.clip((h*(horizon+(2.8-np.maximum(height,0))/z*.91)).astype(int),0,h)
        dx=(land(wx+.09,z)-land(wx-.09,z))/.18
        dz=(land(wx,z+.09)-land(wx,z-.09))/.18
        normal=norm(np.stack([-dx,np.ones(w),-dz],axis=1))
        light=sat(normal@norm(np.array([.65,.43,.62])))
        vegetation=sat(normal[:,1]*1.6-.5)*sat((3.6-height)*1.9)
        rock=mix(np.array([42,47,69]),np.array([183,147,137]),light)
        forest=mix(np.array([16,49,56]),np.array([105,121,91]),light)
        fg=mix(rock,forest,vegetation)
        strata=np.sin(height*43+wx*5+tex[(int(z*45))%1024,(wx*43).astype(int)%1024]*15)
        fg*= (.96+.045*strata+.032*np.sin(height*85+wx*7))[:,None]
        fog=1-np.exp(-z*.040)
        color=mix(fg,np.array([179,151,161]),fog)
        for row in range(int(np.maximum(last-py,0).max())):
            ok=(py+row<last)&(height>0)
            canvas[py[ok]+row,cols[ok]]=color[ok];landmask[py[ok]+row,cols[ok]]=True
        last=np.minimum(last,py)
    img=Image.fromarray(u8(canvas+grain[...,None]*.85)); dr=ImageDraw.Draw(img)
    r=random.Random(821)
    # Evergreen silhouettes on the near banks; frame the action at the edges.
    for side in [-1,1]:
        for k in range(95):
            xx=r.uniform(-.06,.18); bx=(xx if side<0 else 1-xx)*w
            by=(.59+.48*r.random())*h; size=(by/h-.49)*r.uniform(26,111)
            if not landmask[int(np.clip(by,0,h-1)),int(np.clip(bx,0,w-1))]: continue
            col=tuple(u8(np.array([29,64,74])*(1.4-by/h*.61)))
            for tier in range(4):
                cy=by-size+tier*size*.19; width=size*(.065+tier*.035)
                dr.polygon([(bx,cy),(bx-width,cy+size*.44),(bx+width,cy+size*.42)],fill=col)
    save('valley',img)

def pavilion(name):
    """Two glazed optical halls, using a pinhole camera and a mirrored floor."""
    cold=name=='moonhall'; w,h=840,1120
    image=Image.open(OUT/('valley.webp' if cold else 'harbour.webp'))
    bg=(image if cold else image.crop((170,330,1010,1140))).resize((w,h),Image.LANCZOS)
    bg=Image.blend(bg,Image.new('RGB',(w,h),'#283f55' if cold else '#6c4436'),.46)
    backdrop=np.array(bg)
    dr=ImageDraw.Draw(bg); horizon=415; focal=590; eye=2.1
    def project(p):
        x,y,z=p
        return w*.5+x*focal/z, horizon-(y-eye)*focal/z
    def draw(points,color): dr.polygon([project(p) for p in points],fill=color)
    def line(points,color,width): dr.line([project(p) for p in points],fill=color,width=width)
    brass=('#798691','#b7d9d9','#4c5f70') if cold else ('#876854','#f8d291','#5d4c49')
    floorY=int(project((0,0,30))[1])
    def arch(z,inner=0):
        return [(a,b,z) for a,b in [(-3+inner,0),(-3+inner,3.75),(-2.82+inner,4.42),(-1.9,5.03-inner),
                          (-.75,5.44-inner),(.75,5.44-inner),(1.9,5.03-inner),(2.82-inner,4.42),(3-inner,3.75),(3-inner,0)]]
    for z in [30,22,16,11.6,8.3,5.9,4.25,3.05]:
        outer,inner,back=arch(z),arch(z,.115),arch(z+.32,.115)
        for j in range(len(outer)-1):
            draw([inner[j],inner[j+1],back[j+1],back[j]],brass[2])
            draw([outer[j],outer[j+1],inner[j+1],inner[j]],brass[0])
        line(inner,brass[1],max(1,int(5/z)))
        for side in [-1,1]:
            for yy in [.8,2.95]:
                line([(side*3,yy,z),(side*3,yy,z*1.42)],brass[2],max(1,int(12/z)))
            lamp=[(side*2.94,2.44,z),(side*2.94,2.76,z)]
            line(lamp, '#c3eef2' if cold else '#ffe6b7',max(1,int(17/z)))
    if not cold:
        for r in [1.65,1.77,1.84]:
            pts=[(r*math.cos(i*.025),4.5+r*math.sin(i*.025),12+.38*r*math.cos(i*.025)) for i in range(253)]
            line(pts,brass[1] if r==1.77 else brass[0],2)
    arr=np.array(bg)
    ry,rx=np.indices((h-floorY,w)); d=ry/(h-floorY)
    noise=field(np.random.RandomState(297),w,h-floorY)
    sy=np.clip((floorY-1-ry*.94+(noise-.5)*(4+18*d)).astype(int),0,h-1)
    sx=np.clip((rx+np.sin(ry*.32+noise*19)*(1+d)).astype(int),0,w-1)
    rz=focal*eye/(floorY+ry-horizon)
    wx=(rx-w*.5)*rz/focal
    reflect=arr[sy,sx].astype(float)
    seam=np.minimum(abs(wx/1.5-np.round(wx/1.5)),abs(rz/1.8-np.round(rz/1.8)))
    tile=(np.floor(wx/1.5)+np.floor(rz/1.8))%2
    floor=reflect*(.24+.13*(1-d[...,None]))+([15,31,43] if cold else [37,27,26])
    floor+=((noise-.5)*33+tile*2.2+np.exp(-seam*215)*11)[...,None]
    posts=np.any(arr[floorY:]!=backdrop[floorY:],axis=-1)
    arr[floorY:]=np.where(posts[...,None],arr[floorY:],u8(floor))
    save(name,Image.fromarray(arr))

# Sphere-traced cover objects: enamel, brushed alloy and smoked glass lit by
# long studio strips, with contact shadows and one reflected floor bounce.
def studio(name):
    w,h=512,384
    yy,xx=np.indices((h,w),dtype=np.float32)
    cam=np.array([3.8,2.45,5.5]); target=np.array([0.,.05,0.])
    fwd=norm(target-cam); right=norm(np.cross(fwd,[0,1,0])); up=np.cross(right,fwd)
    ray=norm(fwd + ((xx-w*.5)/h*.62)[...,None]*right - ((yy-h*.5)/h*.62)[...,None]*up)
    def turn(p,a,b,angle):
        q=p.copy(); c=math.cos(angle);s=math.sin(angle)
        q[...,a]=p[...,a]*c-p[...,b]*s; q[...,b]=p[...,a]*s+p[...,b]*c
        return q
    def sdf(p):
        q=turn(p,0,1,.42 if name=='optics' else -.15)
        if name=='optics':
            q=turn(q,1,2,.3)
            return np.hypot(np.hypot(q[...,0],q[...,1])-.88,q[...,2])-.29
        if name=='archive':
            distances=[]
            for k in [-1,0,1]:
                v=turn(p-[0,k*.52,0],0,2,-.15+k*.28)
                v=np.abs(v)-[.72,.16,.69]
                distances.append(np.linalg.norm(np.maximum(v,0),axis=-1)+np.minimum(v.max(axis=-1),0)-.11)
            return np.minimum.reduce(distances)
        q=turn(q,0,2,.54)
        # Cubic scaffold with rounded inside and outside corners.
        b=np.abs(q)-.74
        outer=np.linalg.norm(np.maximum(b,0),axis=-1)+np.minimum(b.max(axis=-1),0)-.12
        holes=np.minimum.reduce([np.hypot(q[...,a],q[...,b]) for a,b in [(0,1),(1,2),(0,2)]])-.52
        return np.maximum(outer,-holes)-.04
    def trace(origin,direction,limit):
        t=np.full(direction.shape[:-1],.001); live=np.ones(t.shape,bool)
        for _ in range(limit):
            if not np.any(live): break
            sel=np.flatnonzero(live); pp=origin[live]+direction[live]*t[live,None]; dist=sdf(pp)
            t[live]+=np.maximum(0,dist); live[sel[(dist<.0008)|(t[live]>16)]]=False
        return t
    ray=ray.reshape(-1,3); origin=np.broadcast_to(cam,ray.shape); t=trace(origin,ray,100)
    floor=-1.23 if name=='optics' else -.86 if name=='archive' else -1.05
    plane=(floor-cam[1])/np.minimum(ray[:,1],-.0001)
    hit=t<np.minimum(plane,15)
    colors={'optics':([.74,.16,.032],[.25,.071,.115]),'archive':([.37,.25,.62],[.09,.088,.19]),'calculus':([.052,.48,.46],[.035,.13,.155])}
    base,ground=map(np.asarray,colors[name])
    def shade(p,rd):
        n=norm(np.stack([sdf(p+axis*.001)-sdf(p-axis*.001) for axis in np.eye(3)],axis=-1))
        ref=rd-2*(rd*n).sum(axis=-1)[:,None]*n
        l=norm(np.array([-2,4,3])); diff=sat(n@l)
        fres=(1-sat((-rd*n).sum(axis=-1)))**4
        key=np.exp(-((ref[:,0]+.43)/.14)**2)*sat(ref[:,1]*4+.8)
        rim=np.exp(-((ref[:,1]-.27)/.078)**2)*sat(ref[:,0]*4)
        fill=np.exp(-((ref[:,0]-.37)/.41)**2)*sat(ref[:,1]*2)
        return base*(.18+.62*diff[:,None]+fill[:,None]*.83)+key[:,None]*[2,1.68,1.38]+rim[:,None]*[.7,1.2,1.9]+fres[:,None]*[.28,.31,.38]
    p=origin+ray*plane[:,None]; dist=np.hypot(p[:,0],p[:,2])
    col=ground*(.48+np.exp(-dist*.36)*.92)[:,None]
    reflection=ray.copy();reflection[:,1]*=-1
    rt=trace(p+[0,.002,0],reflection,55); refl=rt<12
    col[refl]+=shade(p[refl]+reflection[refl]*rt[refl,None],reflection[refl])*.18
    col*= (1-.59*np.exp(-dist**2/.91))[:,None]
    col[hit]=shade(origin[hit]+ray[hit]*t[hit,None],ray[hit])
    col=col.reshape(h,w,3)
    vign=1-.18*((xx/w-.5)**2+(yy/h-.5)**2)
    img=Image.fromarray(u8(255*(col/(.66+col))**.48*vign[...,None]))
    save(name,img)

if __name__=="__main__":
    harbour();valley()
    pavilion('moonhall');pavilion('sunhall')
    for name in ['optics','archive','calculus']: studio(name)
