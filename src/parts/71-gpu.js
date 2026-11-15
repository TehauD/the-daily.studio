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
const GPU = { cv: null, gl: null, ok: null, w: 0, h: 0, N: 0, P: {}, T: {}, F: {}, vao: null, off: false };

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

/** register the GPU looks as "Behind you" looks, before Your video, so they sit with the other backdrops */
(function gpuRegister() {
  if (typeof VBACK === 'undefined') return; const entries = [['stardust', 'Stardust']];
  const vi = VBACK.findIndex(m => m[0] === 'video'); const at = vi < 0 ? VBACK.length : vi;
  entries.forEach((e, k) => {
    VBACK.splice(at + k, 0, e); BK_MODES.add(e[0]); if (!VMODES.some(m => m[0] === e[0])) VMODES.splice(VMODES.findIndex(m => m[0] === 'video') < 0 ? VMODES.length : VMODES.findIndex(m => m[0] === 'video'), 0, e);
    BK_FN[e[0]] = (g, W, H, Bb) => gpuBlit(g, e[0], W, H, Bb);
  });
})();
