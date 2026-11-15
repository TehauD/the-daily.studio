/* ============================================================
   Part 72 · WebXR (2.74, experimental) — watch your reactive visuals in a headset
   Where the browser and a connected headset support immersive VR, a 🥽 VR button appears in the visuals ⋯ More panel. It opens an
   immersive session and shows the live visuals (whatever look is running, with the camera cut-out if it is on) filling your view, so you
   can stand inside your own reactive show. It uses its own small WebGL context (never the visuals engine's), uploads the visuals canvas
   as a texture each frame and draws it per eye — nothing here changes the normal, non-VR app, and the button is simply absent where VR is
   not supported. This is experimental and device-dependent: it cannot be verified without a headset, so it is gated and fails safe.
   ============================================================ */
const XR = { supported: null, session: null, gl: null, cv: null, prog: null, tex: null, vao: null, ref: null };

function xrSupported(cb) {
  if (XR.supported != null) return cb(XR.supported);
  if (!(typeof navigator !== 'undefined' && navigator.xr && navigator.xr.isSessionSupported)) { XR.supported = false; return cb(false); }
  navigator.xr.isSessionSupported('immersive-vr').then(s => { XR.supported = !!s; cb(!!s); }).catch(() => { XR.supported = false; cb(false); });
}
function xrInitGL() {
  if (XR.gl) return true;
  try {
    const cv = document.createElement('canvas'); const gl = cv.getContext('webgl2', { xrCompatible: true, alpha: false, antialias: false });
    if (!gl) return false; XR.cv = cv; XR.gl = gl; XR.vao = gl.createVertexArray();
    const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
    const vs = mk(gl.VERTEX_SHADER, `#version 300 es
      out vec2 vUv; void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv=vec2(p.x,1.-p.y); gl_Position=vec4(p*2.-1.,0.,1.); }`);
    const fs = mk(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float; in vec2 vUv; uniform sampler2D T; out vec4 o; void main(){ o=texture(T,vUv); }`);
    if (!vs || !fs) return false; const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return false; XR.prog = p;
    XR.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, XR.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return true;
  } catch (e) { console.warn('xr gl', e); return false; }
}
async function xrEnter() {
  if (XR.session) { try { await XR.session.end(); } catch (e) { } return; }
  if (!(navigator.xr && navigator.xr.requestSession) || !xrInitGL()) { toast('VR is not available on this device', ''); return; }
  try {
    const gl = XR.gl; if (gl.makeXRCompatible) await gl.makeXRCompatible();
    const session = await navigator.xr.requestSession('immersive-vr'); XR.session = session;
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
    XR.ref = await session.requestReferenceSpace('local');
    session.addEventListener('end', () => { XR.session = null; XR.ref = null; bus.emit('xr', false); });
    const onFrame = (t, frame) => {
      if (!XR.session) return; XR.session.requestAnimationFrame(onFrame);
      const layer = XR.session.renderState.baseLayer, pose = XR.ref && frame.getViewerPose(XR.ref);
      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      try { const src = (typeof UI !== 'undefined' && UI.vcv); if (src && src.width) { gl.bindTexture(gl.TEXTURE_2D, XR.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } } catch (e) { }
      if (!pose) return; gl.useProgram(XR.prog); gl.bindVertexArray(XR.vao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, XR.tex); gl.uniform1i(gl.getUniformLocation(XR.prog, 'T'), 0);
      for (const view of pose.views) { const vp = layer.getViewport(view); gl.viewport(vp.x, vp.y, vp.width, vp.height); gl.drawArrays(gl.TRIANGLES, 0, 3); }      /* head-locked: the live visuals fill each eye */
    };
    session.requestAnimationFrame(onFrame); bus.emit('xr', true); toast('🥽 In VR — take the headset off or press the menu button to leave', 'ok');
  } catch (e) { console.warn('xr enter', e); XR.session = null; toast('Could not start VR', ''); }
}
/** the VR button in the visuals ⋯ More panel (referenced at runtime by part 09); absent unless a headset supports immersive VR */
function xrControl() {
  if (!(typeof navigator !== 'undefined' && navigator.xr && navigator.xr.isSessionSupported)) return '';
  const b = h('button', { class: 'btn sm', id: 'xrBtn', title: 'Experimental: watch your reactive visuals in a VR headset', onclick: () => xrEnter() }, '🥽 VR');
  xrSupported(ok => { if (!ok && b.parentNode) b.remove(); else if (!ok) b.dataset.off = '1'; });
  return b;
}
