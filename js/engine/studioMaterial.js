import Phaser from 'phaser';
import { studioMesh, STUDIO_VERTEX_FLOATS } from './studioMesh.js';
import { MATERIAL_ASSETS } from './materialAssets.js';

/* True triangle geometry and per-fragment Cook–Torrance/GGX illumination,
   inside Phaser's existing context. No extra canvas, dependency, animation
   loop, framebuffer or task palette replacement. Not glass transmission,
   ray tracing, image-based lighting or a claim of photorealistic assets. */
const vertex = `
precision highp float;
ATTRIBUTE vec3 aPosition; ATTRIBUTE vec3 aNormal; ATTRIBUTE vec3 aColor;
ATTRIBUTE vec3 aMaterial; ATTRIBUTE float aFinish;
uniform mat3 uTransform; uniform vec2 uViewport; uniform float uShadow;
uniform vec2 uShadowOffset;
uniform vec2 uStageOffset;
VARYING vec3 vPosition; VARYING vec3 vNormal; VARYING vec3 vColor; VARYING vec3 vMaterial;
VARYING float vFinish;
void main(){
  vec3 p=aPosition;
  if(aMaterial.z< -1.5)p.xy+=uStageOffset;
  if(uShadow>.5){float height=max(p.z,0.);p.xy+=vec2(.42,.6)*height+uShadowOffset*(.5+height*.025);p.z=-1.+uShadow*.1;}
  vec2 pixel=(uTransform*vec3(p.xy+vec2(.16,-.35)*p.z,1.)).xy;
  gl_Position=vec4(pixel.x/uViewport.x*2.-1.,1.-pixel.y/uViewport.y*2.,-p.z/256.,1.);
  vPosition=aPosition;vNormal=aNormal;vColor=aColor;vMaterial=aMaterial;vFinish=aFinish;
  if(aMaterial.z< -1.5)vPosition.xy+=uStageOffset;
}`;
const fragment = `
precision highp float;
VARYING vec3 vPosition; VARYING vec3 vNormal; VARYING vec3 vColor; VARYING vec3 vMaterial;
VARYING float vFinish;
uniform vec4 uLight; uniform vec3 uLightColor; uniform float uShadow;
uniform vec3 uFillDirection; uniform vec3 uFillColor;
uniform sampler2D uFinish; uniform float uHasFinish; uniform float uShadowAlpha;
const float PI=3.14159265;
const float STATION_CEILING=.12;
vec3 brdf(vec3 n,vec3 v,vec3 l,vec3 base,float rough,float metal){
  vec3 h=normalize(v+l);float nv=max(dot(n,v),.001),nl=max(dot(n,l),0.);
  float nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
  float a=rough*rough,a2=a*a,d=nh*nh*(a2-1.)+1.;
  float distribution=a2/(PI*d*d+.0001),k=(rough+1.)*(rough+1.)/8.;
  float visibility=(nv/(nv*(1.-k)+k))*(nl/(nl*(1.-k)+k));
  vec3 f0=mix(vec3(.04),base,metal),f=f0+(1.-f0)*pow(1.-vh,5.);
  vec3 spec=distribution*visibility*f/(4.*nv*max(nl,.001)+.0001);
  return ((1.-f)*(1.-metal)*base/PI+spec)*nl;
}
void main(){
  if(uShadow>.5){OUTPUT=vec4(0.,0.,0.,uShadowAlpha);return;}
  vec3 n=normalize(vNormal),v=normalize(vec3(-.16,.35,1.));
  vec3 base=pow(vColor,vec3(2.2));float rough=clamp(vMaterial.x,.16,.95),metal=vMaterial.y;
  // A bounded, padded data atlas; no colour art, procedural noise or task data.
  if(uHasFinish>.5&&vFinish>-.5){
    vec3 tangent=abs(n.z)>.6?normalize(vec3(n.z,0.,-n.x)):normalize(vec3(-n.y,n.x,0.));
    vec3 bitangent=cross(n,tangent);
    vec2 uv=(abs(n.z)>.6?vPosition.xy:vec2(dot(vPosition,tangent),vPosition.z))/64.;
    vec2 tile=(fract(uv)*126.+1.)/128.;tile.x=(floor(vFinish+.5)+tile.x)/4.;
    vec4 finish=TEXTURE(uFinish,tile);vec3 detail=finish.rgb*2.-1.;
    n=normalize(mat3(tangent,bitangent,n)*vec3(detail.xy*.65,max(detail.z,.1)));
    rough=clamp(rough+(finish.a-.5)*.6,.16,.95);
  }
  vec3 color=base*((vMaterial.z<-.5?.18:.08)+.14*max(n.z,0.));
  color+=brdf(n,v,normalize(vec3(-.45,-.55,1.)),base,rough,metal)*vec3(2.8,2.65,2.4);
  color+=brdf(n,v,normalize(uFillDirection),base,rough,metal)*uFillColor;
  vec3 delta=uLight.xyz-vPosition;float attenuation=uLight.w/(1.+dot(delta,delta)/18000.);
  color+=brdf(n,v,normalize(delta),base,rough,metal)*uLightColor*attenuation;
  color+=base*max(vMaterial.z,0.);
  // Warm waterfront horizon and cool overhead strip in the dark lacquer.
  // The face keeps the same luminance ceiling as before; the bevel picks up
  // more reflection at grazing angles. No additional texture or render pass.
  if(vMaterial.z<-.5){
    vec3 reflected=reflect(-v,n);
    float edge=pow(1.-clamp(dot(n,v),0.,1.),2.);
    float horizon=1.-smoothstep(.05,.40,abs(reflected.y+.16));
    float strip=1.-smoothstep(.04,.31,abs(reflected.x+.44+vPosition.y*.0007));
    color+=(horizon*vec3(.18,.055,.027)+strip*vec3(.055,.12,.18))*(.13+edge+metal*.35);
  }
  // Cut glass under a conservatory skylight. Sample an analytic sky/ground
  // field, not a framebuffer: facets retain their own reflected directions
  // and optical density without an extra pass or copying the puzzle image.
  if(vFinish<-.5){
    vec3 face=faceforward(n,-v,n),r=reflect(-v,face);
    vec3 inside=refract(-v,face,1./1.52);
    float facing=clamp(dot(v,face),0.,1.);
    float fresnel=.043+.957*pow(1.-facing,5.);
    float pane=smoothstep(.07,.28,r.z)*(1.-smoothstep(.32,.40,abs(r.x+.26)));
    float rail=1.-smoothstep(.025,.09,abs(r.x+.28));
    vec3 sky=mix(vec3(.09,.14,.16),vec3(1.8,2.15,2.4),pane*(1.-rail*.75));
    float cut=smoothstep(-.26,.28,inside.x-inside.y*.6);
    vec3 body=pow(max(base,vec3(.012)),vec3(.65+1.6*(1.-cut)));
    float window=smoothstep(-.48,.45,dot(n,normalize(vec3(-.85,-.34,.28))));
    color=color*.18+body*(.055+window*window*(1.1+cut)+max(vMaterial.z,0.))
      +sky*(.035+fresnel*.40)+vec3(.6,.86,1.)*smoothstep(.78,.92,window)*.55;
  }
  // A smooth shoulder retains highlight gradients rather than clipping them
  // into flat patches. The explicit bound protects overlaid task-label contrast.
  color=max(color,vec3(0.));
  if(vMaterial.z<-.5&&vMaterial.z> -1.5)color=STATION_CEILING*color/(color+vec3(.065));
  else color=color/(vec3(1.)+color);
  OUTPUT=vec4(pow(max(color,vec3(0.)),vec3(1./2.2)),1.);
}`;

export function preloadStudioMaterial(scene) {
  if (!scene.game.renderer.gl) return;
  // Decode through the existing preload barrier, but do not let the sprite
  // texture manager create a second, premultiplied copy of this data texture.
  const file = new Phaser.Loader.FileTypes.ImageFile(scene.load, { key: 'studio-finish-data', url: MATERIAL_ASSETS.finishes });
  file.addToCache = () => { scene.studioFinishImage = file.data; };
  scene.load.addFile(file);
}

export function createStudioMaterial(scene, onState = () => {}, depth = 0, rig = 'studio') {
  const renderer = scene.game.renderer, gl = renderer.gl;
  let enabled = false, disposed = false, available = false, error = null;
  let program = null, buffer = null, texture = null, vao = null, vaoApi = null, count = 0, draws = 0, uploads = 0;
  let finishLoaded = false, finishError = null, textureBytes = 0, textureUploads = 0;
  let objects = [], dirty = false, light = [0, 0, 120, 0], color = [1, 1, 1], uniforms = {};
  const matrix = new Float32Array(9);
  const stageOffset = new Float32Array(2);
  // Separate authored studio/conservatory rigs, not task-dependent lighting.
  const fillDirection = rig === 'garden' ? [-.7, .8, .35] : [.25, -.4, 1];
  const fillColor = rig === 'garden' ? [1, 1.15, 1.3] : [.35, .45, .6];
  let depthChecked;
  const notify = () => onState(enabled && available && draws > 0);
  const release = () => {
    if (vao) vaoApi?.delete(vao); if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program);
    if (texture) gl.deleteTexture(texture);
    vao = buffer = program = texture = null; textureBytes = 0; available = false;
  };
  const initialize = () => {
    if (!gl || program || error || disposed) return;
    const shaders = [];
    try {
      const modern = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
      const extension = !modern && gl.getExtension('OES_vertex_array_object');
      vaoApi = modern ? { create: () => gl.createVertexArray(), bind: v => gl.bindVertexArray(v), delete: v => gl.deleteVertexArray(v) }
        : extension ? { create: () => extension.createVertexArrayOES(), bind: v => extension.bindVertexArrayOES(v), delete: v => extension.deleteVertexArrayOES(v) } : null;
      if (!vaoApi) throw new Error('Vertex arrays unavailable');
      const compile = (type, text) => {
        const shader = gl.createShader(type); shaders.push(shader);
        const isVertex = type === gl.VERTEX_SHADER;
        const source = (modern ? '#version 300 es\n' : '') + text.replaceAll('ATTRIBUTE', modern ? 'in' : 'attribute')
          .replaceAll('VARYING', modern ? (isVertex ? 'out' : 'in') : 'varying')
          .replace('const float PI=', modern && !isVertex ? 'out vec4 fragmentColor;\nconst float PI=' : 'const float PI=')
          .replaceAll('TEXTURE', modern ? 'texture' : 'texture2D')
          .replaceAll('OUTPUT', modern ? 'fragmentColor' : 'gl_FragColor');
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Material shader failed');
        return shader;
      };
      program = gl.createProgram();
      if (!program) throw new Error('Material program unavailable');
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Material link failed');
      buffer = gl.createBuffer(); vao = vaoApi.create();
      if (!buffer || !vao) throw new Error('Material vertex storage unavailable');
      vaoApi.bind(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      for (const [i, name] of ['aPosition', 'aNormal', 'aColor', 'aMaterial', 'aFinish'].entries()) {
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, i === 4 ? 1 : 3, gl.FLOAT, false, STUDIO_VERTEX_FLOATS * 4, i * 12);
      }
      vaoApi.bind(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
      uniforms = Object.fromEntries(['uTransform', 'uViewport', 'uShadow', 'uShadowOffset', 'uShadowAlpha', 'uStageOffset', 'uLight', 'uLightColor', 'uFillDirection', 'uFillColor', 'uFinish', 'uHasFinish'].map(name => [name, gl.getUniformLocation(program, name)]));
      const unpack = [gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, gl.UNPACK_FLIP_Y_WEBGL, gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.UNPACK_ALIGNMENT]
        .map(key => [key, gl.getParameter(key)]);
      const active = gl.getParameter(gl.ACTIVE_TEXTURE);
      gl.activeTexture(gl.TEXTURE0);
      const binding = gl.getParameter(gl.TEXTURE_BINDING_2D);
      try {
        texture = gl.createTexture();
        if (!texture) throw new Error('Material texture storage unavailable');
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const image = scene.studioFinishImage;
        if (image?.width === 512 && image.height === 128) {
          try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            finishLoaded = true; textureBytes = 512 * 128 * 4;
          } catch (failure) { finishError = failure.message; }
        }
        if (!finishLoaded) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 255, 128]));
          textureBytes = 4;
        }
        textureUploads++;
      } finally {
        for (const [key, value] of unpack) gl.pixelStorei(key, value);
        gl.bindTexture(gl.TEXTURE_2D, binding); gl.activeTexture(active);
      }
      available = true; dirty = true;
    } catch (failure) { error = failure.message; release(); }
    finally { shaders.forEach(shader => gl.deleteShader(shader)); }
  };
  const external = new Phaser.GameObjects.Extern(scene);
  external.setDepth(depth);
  external.render = (_renderer, context, transform) => {
    if (!enabled || disposed || !objects.length || gl.isContextLost()) return;
    initialize();
    if (!available) return;
    renderer.glWrapper.updateBindingsFramebuffer({ bindings: { framebuffer: context.framebuffer } }, true);
    // Default Phaser cameras use the existing depth-capable canvas. Do not
    // pretend that an offscreen/filter target without depth is a 3D pass.
    if (depthChecked !== context.framebuffer) {
      if (gl.getParameter(gl.DEPTH_BITS) < 1) { error = 'Depth attachment unavailable'; release(); notify(); return; }
      depthChecked = context.framebuffer;
    }
    gl.viewport(0, 0, context.width, context.height); gl.useProgram(program); vaoApi.bind(vao);
    if (dirty) {
      const mesh = studioMesh(objects); count = mesh.length / STUDIO_VERTEX_FLOATS;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW); uploads++; dirty = false;
    }
    matrix.set([transform.a, transform.b, 0, transform.c, transform.d, 0, transform.tx, transform.ty, 1]);
    gl.uniformMatrix3fv(uniforms.uTransform, false, matrix); gl.uniform2f(uniforms.uViewport, context.width, context.height);
    gl.uniform4fv(uniforms.uLight, light); gl.uniform3fv(uniforms.uLightColor, color);
    gl.uniform3fv(uniforms.uFillDirection, fillDirection); gl.uniform3fv(uniforms.uFillColor, fillColor);
    gl.uniform2fv(uniforms.uStageOffset, stageOffset);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.uFinish, 0); gl.uniform1f(uniforms.uHasFinish, Number(finishLoaded));
    gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // Three weighted geometry projections soften only the narrow contact edge.
    // Successive sub-plane depths prevent triangle self-overdraw without more
    // depth clears, framebuffers, blur textures or a persistent render loop.
    for (const [i, [x, y, alpha]] of [[-1.3, -.7, .045], [1.2, .8, .045], [0, 0, .12]].entries()) {
      gl.uniform1f(uniforms.uShadow, i + 1); gl.uniform2f(uniforms.uShadowOffset, x, y); gl.uniform1f(uniforms.uShadowAlpha, alpha);
      gl.drawArrays(gl.TRIANGLES, 0, count);
    }
    gl.uniform1f(uniforms.uShadow, 0); gl.drawArrays(gl.TRIANGLES, 0, count);
    draws++; notify();
    // Extern's RebindContext restores the full Phaser wrapper state, including
    // VAO, blend/depth state, textures, program, framebuffer and viewport.
  };
  scene.add.existing(external);
  const api = {
    setEnabled(value) { enabled = Boolean(value) && Boolean(gl) && !disposed; external.setVisible(enabled && !error); notify(); },
    setObjects(value) { objects = value; dirty = true; },
    setStageOffset(x, y) { stageOffset.set([Math.max(-4, Math.min(4, x)), Math.max(-3, Math.min(3, y))]); },
    setLight(x, y, z, strength, hex = 0xffffff) { light = [x, y, z, strength]; color = [16, 8, 0].map(shift => ((hex >> shift) & 255) / 255); },
    snapshot() { return { enabled: enabled && available, model: available ? 'mesh-ggx' : 'baked-fallback', objects: objects.length, vertices: count, triangles: count / 3, draws, uploads, error,
      finish: finishLoaded ? 'normal-roughness-atlas' : 'smooth-fallback', finishError, textureUploads, shadowPasses: 3,
      kinds: objects.slice(0, 32).reduce((counts, item) => { counts[item.kind] = (counts[item.kind] || 0) + 1; return counts; }, {}), stageOffset: [...stageOffset],
      resources: { programs: Number(Boolean(program)), buffers: Number(Boolean(buffer)), vertexArrays: Number(Boolean(vao)), textures: Number(Boolean(texture)), textureBytes } }; },
    destroy() { if (disposed) return; disposed = true; enabled = false; release(); external.destroy(); objects = []; scene.studioFinishImage = null; notify(); },
  };
  scene.events.once('shutdown', api.destroy);
  return api;
}
