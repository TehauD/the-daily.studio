/* ============================================================
   Part 71 · GPU visual engine (2.71) — WebGL2 particles and bloom, behind you
   The first of the GPU-powered looks (Stardust: a drifting, audio-reactive particle galaxy with a real bloom glow). The engine owns its
   own WebGL2 canvas, renders a look into it, and the ordinary 2D draw path blits the result onto the visuals canvas — so every overlay
   (the neck, the words, the lower third) still draws on top, and it works the same on the stage and in a recording.
     · No new dependency: raw WebGL2, built inline. WebGPU, where a browser has it, is a later fast-path; this is the tested baseline.
     · It degrades: with no WebGL2 (an old phone, a lost context) the look falls back to a plain 2D particle field, so nothing ever breaks.
     · It obeys the same rules as every other look: the colour follows the chord, the movement follows the sound and the comfort setting
       (Calm is slower and softer), and nothing flashes — brightness only ever glides, because it rides the smoothed energy, not raw peaks.
   The engine (gpuGet, gpuScene, gpuBlit) is written to be reused by the looks that come after it (the living cymatics, the 3D stage).
   ============================================================ */
const GPU = { cv: null, gl: null, ok: null, w: 0, h: 0, N: 0, P: {}, T: {}, F: {}, vao: null, off: false, float: false, floatLin: false, sim: {}, simRes: 256, simProg: null };

function gpuSh(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('gpu shader', gl.getShaderInfoLog(s)); return null; } return s; }
function gpuProg(gl, vs, fs) { const a = gpuSh(gl, gl.VERTEX_SHADER, vs), b = gpuSh(gl, gl.FRAGMENT_SHADER, fs); if (!a || !b) return null; const p = gl.createProgram(); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('gpu link', gl.getProgramInfoLog(p)); return null; } return p; }

const GPU_VS_FS = `#version 300 es
  out vec2 vUv; void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;

/** build (once) the WebGL2 canvas, programs and the fullscreen VAO. Returns true if the GPU path is usable. */
function gpuGet() {
  if (GPU.ok !== null) return GPU.ok && !GPU.off;
  try {
    const cv = document.createElement('canvas'); cv.width = 2; cv.height = 2;
    const gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) { GPU.ok = false; return false; }
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); GPU.ok = false; }, false);
    GPU.cv = cv; GPU.gl = gl; GPU.vao = gl.createVertexArray();
    GPU.float = !!gl.getExtension('EXT_color_buffer_float'); GPU.floatLin = !!gl.getExtension('OES_texture_float_linear');      /* for the living simulations (2.72) */
    /* particle pass: attributeless — each point's path comes from its gl_VertexID and the time, its colour from the chord's hue */
    GPU.P.part = gpuProg(gl, `#version 300 es
      uniform float uT, uEn, uHue, uPulse; uniform vec2 uRes; out vec3 vCol;
      float h1(float n){ return fract(sin(n*127.1)*43758.5); }
      void main(){ float id=float(gl_VertexID); float seed=h1(id);
        float a=seed*6.2831 + uT*(.05+h1(id+7.)*.22); float r=pow(h1(id+3.),.7)*.95; float rr=r+.05*sin(uT*.6+id*.3);
        vec2 p=vec2(cos(a),sin(a))*rr*(.42+.5*uEn); p+=.12*vec2(sin(uT*.4+id),cos(uT*.33+id))*uEn;
        p*=1.+uPulse*.15*seed; p.x*=uRes.y/uRes.x;
        gl_Position=vec4(p,0.,1.); gl_PointSize=(1.5+5.5*h1(id+9.))*(.55+.8*uEn)*(uRes.y/420.);
        float hu=uHue + (seed-.5)*70.; vCol=.5+.5*cos(6.2831*(hu/360.)+vec3(0.,2.1,4.2)); vCol*=.35+.95*uEn; }`,
      `#version 300 es
       precision highp float; in vec3 vCol; out vec4 o;
       void main(){ float m=smoothstep(.5,0.,length(gl_PointCoord-.5)); o=vec4(vCol*m, m); }`);
    GPU.P.bright = gpuProg(gl, GPU_VS_FS, `#version 300 es
      precision highp float; in vec2 vUv; uniform sampler2D uTex; out vec4 o;
      void main(){ vec3 c=texture(uTex,vUv).rgb; float l=dot(c,vec3(.299,.587,.114)); o=vec4(c*smoothstep(.32,.7,l),1.); }`);
    GPU.P.blur = gpuProg(gl, GPU_VS_FS, `#version 300 es
      precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
      void main(){ vec3 s=texture(uTex,vUv).rgb*.2270; float w[4]=float[](.1945,.1216,.0540,.0162);
        for(int i=1;i<4;i++){ vec2 d=uDir*float(i); s+=texture(uTex,vUv+d).rgb*w[i-1]+texture(uTex,vUv-d).rgb*w[i-1]; } o=vec4(s,1.); }`);
    GPU.P.comp = gpuProg(gl, GPU_VS_FS, `#version 300 es
      precision highp float; in vec2 vUv; uniform sampler2D uScene, uBloom; uniform float uBloomAmt; out vec4 o;
      void main(){ vec3 c=texture(uScene,vUv).rgb + texture(uBloom,vUv).rgb*uBloomAmt; c=c/(c+vec3(1.)); c=pow(c,vec3(.4545)); o=vec4(c,1.); }`);
    if (!GPU.P.part || !GPU.P.bright || !GPU.P.blur || !GPU.P.comp) { GPU.ok = false; return false; }
    GPU.U = { t: gl.getUniformLocation(GPU.P.part, 'uT'), en: gl.getUniformLocation(GPU.P.part, 'uEn'), hue: gl.getUniformLocation(GPU.P.part, 'uHue'), pulse: gl.getUniformLocation(GPU.P.part, 'uPulse'), res: gl.getUniformLocation(GPU.P.part, 'uRes'),
      bdir: gl.getUniformLocation(GPU.P.blur, 'uDir'), cS: gl.getUniformLocation(GPU.P.comp, 'uScene'), cB: gl.getUniformLocation(GPU.P.comp, 'uBloom'), cA: gl.getUniformLocation(GPU.P.comp, 'uBloomAmt') };
    GPU.ok = true; return !GPU.off;
  } catch (e) { console.warn('gpu init', e); GPU.ok = false; return false; }
}
/** size the GPU canvas and its three ping-pong targets to w×h (capped), rebuilding the textures only when the size changes */
function gpuSize(w, h) {
  const gl = GPU.gl, scale = Math.min(1, 1920 / Math.max(w, h)); w = Math.max(2, Math.round(w * scale)); h = Math.max(2, Math.round(h * scale));
  if (GPU.w === w && GPU.h === h && GPU.T.a) return; GPU.w = w; GPU.h = h; GPU.cv.width = w; GPU.cv.height = h;
  ['a', 'b', 'c'].forEach(k => {
    if (!GPU.T[k]) { GPU.T[k] = gl.createTexture(); GPU.F[k] = gl.createFramebuffer(); }
    gl.bindTexture(gl.TEXTURE_2D, GPU.T[k]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, GPU.F[k]); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, GPU.T[k], 0);
  });
  GPU.N = Math.round(clamp(w * h / 520, 1800, 9000));      /* particle count scales with area, capped for weak GPUs */
}
const gpuFS = gl => { gl.bindVertexArray(GPU.vao); gl.drawArrays(gl.TRIANGLES, 0, 3); };
/** render a look into GPU.cv: the scene (into target a), then a bright-pass + separable blur (b), then a tonemapped composite to the canvas */
function gpuScene(look, B) {
  const gl = GPU.gl, w = GPU.w, h = GPU.h; gl.viewport(0, 0, w, h); gl.disable(gl.DEPTH_TEST);
  gl.bindFramebuffer(gl.FRAMEBUFFER, GPU.F.a); const sky = gpuSkyRGB(B.hue); gl.clearColor(sky[0], sky[1], sky[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); look(gl, B, w, h); gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, GPU.F.a); gl.viewport(0, 0, w, h);      /* a sim look may have changed the bound target and viewport; put them back for the post chain */
  gl.bindFramebuffer(gl.FRAMEBUFFER, GPU.F.b); gl.useProgram(GPU.P.bright); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, GPU.T.a); gpuFS(gl);
  gl.useProgram(GPU.P.blur);
  for (let i = 0; i < 2; i++) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, GPU.F.c); gl.bindTexture(gl.TEXTURE_2D, GPU.T.b); gl.uniform2f(GPU.U.bdir, 1.4 / w, 0); gpuFS(gl);
    gl.bindFramebuffer(gl.FRAMEBUFFER, GPU.F.b); gl.bindTexture(gl.TEXTURE_2D, GPU.T.c); gl.uniform2f(GPU.U.bdir, 0, 1.4 / h); gpuFS(gl);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.useProgram(GPU.P.comp);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, GPU.T.a); gl.uniform1i(GPU.U.cS, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, GPU.T.b); gl.uniform1i(GPU.U.cB, 1);
  gl.uniform1f(GPU.U.cA, 1.1 * (hmCm().motion > .7 ? 1 : .8));      /* a touch less bloom in Calm */
  gpuFS(gl); gl.flush();
}
/** the sky colour as linear-ish RGB (a deep tint of the chord's hue), matching the 2D looks' bkSky */
function gpuSkyRGB(hue) { const h = ((hue % 360) + 360) % 360 / 60, c = .10, x = c * (1 - Math.abs(h % 2 - 1)); let r = 0, g = 0, b = 0; if (h < 1) { r = c; g = x; } else if (h < 2) { r = x; g = c; } else if (h < 3) { g = c; b = x; } else if (h < 4) { g = x; b = c; } else if (h < 5) { r = x; b = c; } else { r = c; b = x; } return [r * .5 + .02, g * .5 + .03, b * .5 + .06]; }

/* ---------- the Stardust look (the particle galaxy) ---------- */
function gpuStardust(gl, B) {
  gl.useProgram(GPU.P.part);
  gl.uniform1f(GPU.U.t, B.t); gl.uniform1f(GPU.U.en, B.en); gl.uniform1f(GPU.U.hue, B.hue); gl.uniform1f(GPU.U.pulse, B.pulse || 0); gl.uniform2f(GPU.U.res, GPU.w, GPU.h);
  gl.bindVertexArray(GPU.vao); gl.drawArrays(gl.POINTS, 0, GPU.N);
}
/** draw a GPU look onto a 2D context `g` (the visuals canvas, a stage scene, or a recording), or the 2D fallback if the GPU is unavailable */
function gpuBlit(g, lookKey, W, H, B) {
  if (!gpuGet()) return gpuFallback2D(g, lookKey, W, H, B);
  try { gpuSize(W, H); gpuScene(GPU_LOOKS[lookKey] || gpuStardust, B); g.drawImage(GPU.cv, 0, 0, W, H); }
  catch (e) { GPU.off = true; gpuFallback2D(g, lookKey, W, H, B); }
}
const GPU_LOOKS = { stardust: gpuStardust };

/* ---------- the 2D fallback: a plain additive particle field, so the look still works with no WebGL2 (and the tests cover both paths) ---------- */
function gpuFallback2D(g, lookKey, W, H, B) {
  bkSky(g, W, H, B.hue, 3, 8); g.save(); g.globalCompositeOperation = 'lighter';
  const n = Math.round(clamp(W * H / 2600, 200, 1400)), cx = W / 2, cy = H / 2, R = Math.min(W, H) * .5, t = B.t;
  for (let i = 0; i < n; i++) {
    const seed = bkH(i), a = seed * 6.2831 + t * (.05 + bkH(i + 7) * .22), rr = (Math.pow(bkH(i + 3), .7) * .95 + .05 * Math.sin(t * .6 + i * .3)) * (.42 + .5 * B.en) * R;
    const x = cx + Math.cos(a) * rr + Math.sin(t * .4 + i) * .12 * R * B.en, y = cy + Math.sin(a) * rr + Math.cos(t * .33 + i) * .12 * R * B.en;
    const sz = (1 + 3 * bkH(i + 9)) * (.6 + .8 * B.en), hue = B.hue + (seed - .5) * 70;
    g.fillStyle = bkHsl(hue, 85, 62, .25 + .5 * B.en); g.beginPath(); g.arc(x, y, sz, 0, 6.2832); g.fill();
  }
  g.restore();
}

/* ---------- 2.72: living simulations — a wave-field (cymatic plate) and reaction-diffusion (life), run on the GPU as ping-pong state ---------- */
function gpuSimTex(res) {
  const gl = GPU.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, GPU.float ? gl.RGBA16F : gl.RGBA8, res, res, 0, gl.RGBA, GPU.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f };
}
/** lazily compile the simulation programs once (they are only built when a living look is first chosen) */
function gpuSimProgs() {
  if (GPU.simProg) return GPU.simProg !== false; const gl = GPU.gl, P = {};
  P.waveStep = gpuProg(gl, GPU_VS_FS, `#version 300 es
    precision highp float; in vec2 vUv; uniform sampler2D S; uniform vec2 px; uniform vec4 uB; uniform float uPulse; out vec4 o;
    void main(){ vec2 st=texture(S,vUv).xy; float h=st.x, hp=st.y;
      float lap=texture(S,vUv+vec2(px.x,0)).x+texture(S,vUv-vec2(px.x,0)).x+texture(S,vUv+vec2(0,px.y)).x+texture(S,vUv-vec2(0,px.y)).x-4.*h;
      float nh=(2.*h - hp + 0.49*lap)*0.9965;
      vec2 src[4]=vec2[](vec2(.5,.5),vec2(.28,.36),vec2(.72,.4),vec2(.5,.74));
      for(int i=0;i<4;i++){ float d=distance(vUv,src[i]); nh += (uB[i]*.022+uPulse*.01)*exp(-d*d*160.); }
      o=vec4(clamp(nh,-2.,2.),h,0.,1.); }`);
  P.waveShow = gpuProg(gl, GPU_VS_FS, `#version 300 es
    precision highp float; in vec2 vUv; uniform sampler2D S; uniform float uHue,uEn; out vec4 o;
    void main(){ float h=texture(S,vUv).x; float e=abs(h); float hu=uHue+h*60.;
      vec3 c=.5+.5*cos(6.2831*(hu/360.)+vec3(0.,2.1,4.2)); float m=smoothstep(.01,.3,e)*(.5+.8*uEn); o=vec4(c*m, m); }`);
  P.rdSeed = gpuProg(gl, GPU_VS_FS, `#version 300 es
    precision highp float; in vec2 vUv; out vec4 o;
    float h1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5); }
    void main(){ float b=0.; for(int i=0;i<24;i++){ vec2 c=vec2(h1(vec2(float(i),1.)),h1(vec2(float(i),2.))); if(distance(vUv,c)<.03) b=1.; } o=vec4(1.,b,0.,1.); }`);
  P.rdStep = gpuProg(gl, GPU_VS_FS, `#version 300 es
    precision highp float; in vec2 vUv; uniform sampler2D S; uniform vec2 px; uniform float f,k; out vec4 o;
    vec2 lap(){ vec2 s=texture(S,vUv).xy*-1.;
      s+=(texture(S,vUv+vec2(px.x,0)).xy+texture(S,vUv-vec2(px.x,0)).xy+texture(S,vUv+vec2(0,px.y)).xy+texture(S,vUv-vec2(0,px.y)).xy)*.2;
      s+=(texture(S,vUv+px).xy+texture(S,vUv-px).xy+texture(S,vUv+vec2(px.x,-px.y)).xy+texture(S,vUv+vec2(-px.x,px.y)).xy)*.05; return s; }
    void main(){ vec2 ab=texture(S,vUv).xy; float A=ab.x,B=ab.y,r=A*B*B; vec2 L=lap();
      o=vec4(clamp(A+(1.0*L.x - r + f*(1.-A)),0.,1.), clamp(B+(0.5*L.y + r - (k+f)*B),0.,1.), 0.,1.); }`);
  P.rdShow = gpuProg(gl, GPU_VS_FS, `#version 300 es
    precision highp float; in vec2 vUv; uniform sampler2D S; uniform float uHue,uEn; out vec4 o;
    void main(){ float b=texture(S,vUv).y; float hu=uHue - b*90.; vec3 c=.5+.5*cos(6.2831*(hu/360.)+vec3(0.,2.1,4.2));
      float m=smoothstep(.06,.4,b)*(.55+.7*uEn); o=vec4(c*m, m); }`);
  if (Object.values(P).some(x => !x)) { GPU.simProg = false; return false; }
  P.u = { wpx: gl.getUniformLocation(P.waveStep, 'px'), wB: gl.getUniformLocation(P.waveStep, 'uB'), wPulse: gl.getUniformLocation(P.waveStep, 'uPulse'),
    wsHue: gl.getUniformLocation(P.waveShow, 'uHue'), wsEn: gl.getUniformLocation(P.waveShow, 'uEn'),
    rpx: gl.getUniformLocation(P.rdStep, 'px'), rf: gl.getUniformLocation(P.rdStep, 'f'), rk: gl.getUniformLocation(P.rdStep, 'k'),
    rsHue: gl.getUniformLocation(P.rdShow, 'uHue'), rsEn: gl.getUniformLocation(P.rdShow, 'uEn') };
  GPU.simProg = P; return true;
}
/** step a ping-pong sim `steps` times, then return the current state texture */
function gpuSimRun(key, res, seedProg, stepProg, setU, steps) {
  const gl = GPU.gl; let s = GPU.sim[key]; if (!s) { s = GPU.sim[key] = { a: gpuSimTex(res), b: gpuSimTex(res), res }; if (seedProg) { gl.viewport(0, 0, res, res); gl.disable(gl.BLEND); gl.bindFramebuffer(gl.FRAMEBUFFER, s.a.f); gl.useProgram(seedProg); gpuFS(gl); } else { gl.bindFramebuffer(gl.FRAMEBUFFER, s.a.f); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.bindFramebuffer(gl.FRAMEBUFFER, s.b.f); gl.clear(gl.COLOR_BUFFER_BIT); } }
  gl.viewport(0, 0, res, res); gl.disable(gl.BLEND); gl.useProgram(stepProg);
  for (let i = 0; i < steps; i++) { gl.bindFramebuffer(gl.FRAMEBUFFER, s.b.f); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.a.t); setU(i); gpuFS(gl); const t = s.a; s.a = s.b; s.b = t; }
  return s.a.t;
}
/** draw a sim's state texture into the scene target, so the bloom chain glows it */
function gpuSimShow(stateTex, showProg, hueU, enU, B, w, h) {
  const gl = GPU.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, GPU.F.a); gl.viewport(0, 0, w, h); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.useProgram(showProg); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, stateTex); gl.uniform1f(hueU, B.hue); gl.uniform1f(enU, B.en); gpuFS(gl);
}
function gpuRipple(gl, B, w, h) {
  const P = GPU.simProg, res = GPU.simRes, steps = 1 + Math.round(2 * (hmCm().motion || 1));
  const bands = [B.b[0] + B.b[1], B.b[2] + B.b[3], B.b[4] + B.b[5], B.b[6] + B.b[7]];
  const state = gpuSimRun('ripple', res, null, P.waveStep, () => { gl.uniform2f(P.u.wpx, 1 / res, 1 / res); gl.uniform4f(P.u.wB, bands[0], bands[1], bands[2], bands[3]); gl.uniform1f(P.u.wPulse, B.pulse || 0); }, steps);
  gpuSimShow(state, P.waveShow, P.u.wsHue, P.u.wsEn, B, w, h);
}
function gpuLife(gl, B, w, h) {
  const P = GPU.simProg, res = GPU.simRes, steps = 4 + Math.round(6 * (hmCm().motion || 1));
  const state = gpuSimRun('life', res, P.rdSeed, P.rdStep, () => { gl.uniform2f(P.u.rpx, 1 / res, 1 / res); gl.uniform1f(P.u.rf, .035 + .006 * B.en); gl.uniform1f(P.u.rk, .062); }, steps);
  gpuSimShow(state, P.rdShow, P.u.rsHue, P.u.rsEn, B, w, h);
}
/** a GPU simulation look: needs WebGL2 + float render targets, else the 2D fallback */
function gpuSimLook(key) {
  return (g, W, H, B) => {
    if (!gpuGet() || !GPU.float || !gpuSimProgs()) return gpuFallback2D(g, key, W, H, B);
    try { gpuSize(W, H); gpuScene(key === 'life' ? gpuLife : gpuRipple, B); g.drawImage(GPU.cv, 0, 0, W, H); }
    catch (e) { GPU.off = true; gpuFallback2D(g, key, W, H, B); }
  };
}

/* ---------- 2.73: Arena — a perspective 3D stage you stand inside (a reflective floor to a lit horizon, reactive light columns) ---------- */
function gpuArenaProg() {
  if (GPU.P.arena) return true; if (GPU.P.arena === false) return false; const gl = GPU.gl;
  const pr = gpuProg(gl, GPU_VS_FS, `#version 300 es
    precision highp float; in vec2 vUv; uniform vec2 uRes; uniform float uT,uEn,uHue; uniform vec4 uB; out vec4 o;
    vec3 pal(float h){ return .5+.5*cos(6.2831*(h/360.)+vec3(0.,2.1,4.2)); }
    float h1(float n){ return fract(sin(n*127.1)*43758.5); }
    void main(){
      vec2 p=(vUv*uRes - .5*uRes)/uRes.y; float hor=0.02; vec3 col;
      if(p.y>hor){                                   /* sky: a tint of the chord, a horizon glow, a few calm stars */
        float t=p.y-hor; col=pal(uHue)*(.05+.10*exp(-t*6.)); col+=pal(uHue+20.)*exp(-t*9.)*(.4+.8*uEn)*.5;
        vec2 g=floor(p*uRes.y/26.); float st=step(.992,h1(g.x*57.+g.y*131.)); col+=st*(.25+.4*h1(g.x+g.y));
      } else {                                       /* floor: a perspective grid scrolling toward you, with glowing columns */
        float d=hor-p.y, z=1.0/(d*2.2), zz=z+uT*1.4, x=p.x*z*2.2, fog=exp(-d*7.5);
        float gx=abs(fract(x)-.5), gz=abs(fract(zz)-.5), aa=max(fwidth(x),fwidth(zz));   /* screen-space width: distant lines fade instead of aliasing */
        float grid=(1.-smoothstep(.0,.06+aa,gx))+(1.-smoothstep(.0,.06+aa,gz)); grid=clamp(grid*(1.-smoothstep(.0,.9,aa)),0.,1.);
        col=pal(uHue+x*2.)*.025 + pal(uHue+40.)*grid*(.22+.5*uEn)*fog;
        float b[4]=float[](uB.x,uB.y,uB.z,uB.w), xs[4]=float[](-2.4,-1.2,1.2,2.4);
        for(int i=0;i<4;i++){ float dxc=x-xs[i]; col+=pal(uHue+60.)*exp(-dxc*dxc*5.)*fog*(.25+1.3*b[i]); }
        col*=(.6+.4*fog)*smoothstep(.0,.08,d);
      }
      o=vec4(col,1.);                                /* linear-ish; the composite tonemaps once */
    }`);
  if (!pr) { GPU.P.arena = false; return false; }
  GPU.P.arena = pr; GPU.arenaU = { res: gl.getUniformLocation(pr, 'uRes'), t: gl.getUniformLocation(pr, 'uT'), en: gl.getUniformLocation(pr, 'uEn'), hue: gl.getUniformLocation(pr, 'uHue'), b: gl.getUniformLocation(pr, 'uB') }; return true;
}
function gpuArena(gl, B, w, h) {
  if (!gpuArenaProg()) return; const U = GPU.arenaU; gl.disable(gl.BLEND); gl.useProgram(GPU.P.arena);
  gl.uniform2f(U.res, GPU.w, GPU.h); gl.uniform1f(U.t, B.t); gl.uniform1f(U.en, B.en); gl.uniform1f(U.hue, B.hue);
  gl.uniform4f(U.b, B.b[0] + B.b[1], B.b[2] + B.b[3], B.b[4] + B.b[5], B.b[6] + B.b[7]);
  gl.bindVertexArray(GPU.vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
}
GPU_LOOKS.arena = gpuArena;

/** register the GPU looks as "Behind you" looks, before Your video, so they sit with the other backdrops */
(function gpuRegister() {
  if (typeof VBACK === 'undefined') return; const entries = [['stardust', 'Stardust'], ['arena', 'Arena'], ['ripple', 'Ripple'], ['life', 'Life']];
  const vi = VBACK.findIndex(m => m[0] === 'video'); const at = vi < 0 ? VBACK.length : vi;
  entries.forEach((e, k) => {
    VBACK.splice(at + k, 0, e); BK_MODES.add(e[0]); if (!VMODES.some(m => m[0] === e[0])) VMODES.splice(VMODES.findIndex(m => m[0] === 'video') < 0 ? VMODES.length : VMODES.findIndex(m => m[0] === 'video'), 0, e);
    BK_FN[e[0]] = (e[0] === 'ripple' || e[0] === 'life') ? gpuSimLook(e[0]) : (g, W, H, Bb) => gpuBlit(g, e[0], W, H, Bb);
  });
})();
