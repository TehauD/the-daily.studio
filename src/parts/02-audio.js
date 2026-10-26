/* ============================================================
   Part 02 · audio engine: worklets, I/O, FX rig, amp/cab/reverb models, presets
   ============================================================ */
const WORKLET_SRC = `
class Gate extends AudioWorkletProcessor{
  constructor(){super();this.p={th:-58,rel:140,hold:40,range:-70};this.env=0;this.g=1;this.open=false;this.hn=0;this.cnt=0;this.port.onmessage=e=>Object.assign(this.p,e.data);}
  process(i,o){const x=i[0],y=o[0];if(!x.length||!y.length)return true;const n=y[0].length,sr=sampleRate,p=this.p;
    const th=Math.pow(10,p.th/20),hy=th*0.65,floor=Math.pow(10,p.range/20);
    const ac=Math.exp(-1/(0.002*sr)),rc=Math.exp(-1/(Math.max(5,p.rel)*0.001*sr)),ed=Math.exp(-1/(0.012*sr)),hs=p.hold*0.001*sr;
    for(let k=0;k<n;k++){let a=0;for(let c=0;c<x.length;c++){const v=Math.abs(x[c][k]);if(v>a)a=v;}
      this.env=a>this.env?a:this.env*ed;
      if(this.env>th){this.open=true;this.hn=hs;}else if(this.env<hy){if(this.hn>0)this.hn--;else this.open=false;}
      const t=this.open?1:floor;this.g=t+(this.g-t)*(this.open?ac:rc);
      for(let c=0;c<y.length;c++){const s=x[c]?x[c][k]:x[0][k];y[c][k]=s*this.g;}}
    return true;}}
registerProcessor('fw-gate',Gate);

class Pitch extends AudioWorkletProcessor{
  static get parameterDescriptors(){return[{name:'semi',defaultValue:0,minValue:-36,maxValue:36,automationRate:'k-rate'},{name:'mix',defaultValue:1,minValue:0,maxValue:1,automationRate:'k-rate'}];}
  constructor(){super();this.N=16384;this.b=new Float32Array(this.N);this.w=0;this.ph=0;this.win=0.06;this.port.onmessage=e=>{if(e.data.win)this.win=e.data.win;};}
  rd(pos){const N=this.N;let p=pos;while(p<0)p+=N;const i=Math.floor(p),f=p-i;const a=this.b[i%N],c=this.b[(i+1)%N];return a+(c-a)*f;}
  process(i,o,p){const x=i[0],y=o[0];if(!x.length||!y.length)return true;const n=y[0].length,ratio=Math.pow(2,p.semi[0]/12),mix=p.mix[0];
    const W=Math.min(this.N-8,Math.max(256,Math.floor(this.win*sampleRate))),N=this.N;
    for(let k=0;k<n;k++){const xin=x[0][k];this.b[this.w]=xin;const p1=this.ph,p2=(this.ph+0.5)%1;
      const g1=Math.sin(Math.PI*p1),g2=Math.sin(Math.PI*p2);
      const wet=this.rd(this.w-p1*W)*g1*g1+this.rd(this.w-p2*W)*g2*g2;
      this.ph+=(1-ratio)/W;if(this.ph>=1)this.ph-=1;else if(this.ph<0)this.ph+=1;
      const out=xin*(1-mix)+wet*mix;for(let c=0;c<y.length;c++)y[c][k]=out;this.w=(this.w+1)%N;}
    return true;}}
registerProcessor('fw-pitch',Pitch);

class Flange extends AudioWorkletProcessor{
  static get parameterDescriptors(){const d=(name,v,a,b)=>({name,defaultValue:v,minValue:a,maxValue:b,automationRate:'k-rate'});return[d('rate',.3,.02,10),d('depth',.7,0,1),d('manual',2,.2,8),d('fb',.5,-.95,.95),d('mix',.5,0,1)];}
  constructor(){super();this.N=4096;this.b=[new Float32Array(this.N),new Float32Array(this.N)];this.w=0;this.ph=0;}
  process(i,o,p){const x=i[0],y=o[0];if(!x.length||!y.length)return true;const n=y[0].length,sr=sampleRate,N=this.N;
    const rate=p.rate[0],dep=p.depth[0],man=p.manual[0],fb=p.fb[0],mix=p.mix[0];
    for(let k=0;k<n;k++){const xin=x[0][k];
      for(let c=0;c<2;c++){const l=Math.sin(2*Math.PI*(this.ph+c*0.25));let d=man*0.001*sr*(1+l*dep*0.9);if(d<1)d=1;
        let rp=this.w-d;if(rp<0)rp+=N;const i0=Math.floor(rp),f=rp-i0,ln=this.b[c];const r=ln[i0%N]+(ln[(i0+1)%N]-ln[i0%N])*f;
        ln[this.w]=xin+fb*r;if(y[c])y[c][k]=xin*(1-mix*0.5)+r*mix;}
      this.ph+=rate/sr;if(this.ph>=1)this.ph-=1;this.w=(this.w+1)%N;}
    return true;}}
registerProcessor('fw-flange',Flange);

class Pluck extends AudioWorkletProcessor{
  constructor(){super();this.v=[];this.q=[];this.seed=987654321;
    this.port.onmessage=e=>{const m=e.data;if(m.t==='on')this.q.push(m);else if(m.t==='kill'){this.v.length=0;this.q.length=0;}};}
  rnd(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/2147483648-1;}
  start(m,off){const sr=sampleRate,s=m.s,Lf=sr/m.f+s,N=Math.max(4,Math.floor(Lf)),d=Lf-N,c=(1-d)/(1+d);
    const buf=new Float32Array(N),ex=new Float32Array(N);let lp=0;const a=m.br;
    for(let j=0;j<N;j++){lp+=a*(this.rnd()-lp);ex[j]=lp;}
    const pp=Math.max(1,Math.floor(N*m.pp));let mean=0;
    for(let j=0;j<N;j++){buf[j]=ex[j]-ex[(j+N-pp)%N];mean+=buf[j];}mean/=N;
    let e=0;for(let j=0;j<N;j++){buf[j]-=mean;e+=buf[j]*buf[j];}
    const sc=(0.22*m.vel)/Math.sqrt(e/N+1e-12);for(let j=0;j<N;j++)buf[j]*=sc;
    for(const o of this.v)if(m.id!=null&&o.id===m.id)o.fade=0.985;
    if(this.v.length>=44)this.v.shift();
    const pan=Math.max(-1,Math.min(1,m.pan||0)),ang=(pan+1)*Math.PI/4,g=m.g==null?1:m.g;
    const dec=m.dead?0.93:Math.pow(10,-3/(m.t60*m.f));
    this.v.push({buf,N,pos:0,c,s,dec,x1:0,y1:0,gl:Math.cos(ang)*g,gr:Math.sin(ang)*g,id:m.id,fade:1,env:1,age:0,delay:off});}
  process(i,o){const out=o[0],L=out[0],R=out[1]||out[0],n=L.length;
    if(this.q.length){const now=currentTime;for(let k=this.q.length-1;k>=0;k--){const m=this.q[k],off=Math.round((m.at-now)*sampleRate);if(off<n){this.q.splice(k,1);this.start(m,Math.max(0,off));}}}
    for(let vi=this.v.length-1;vi>=0;vi--){const v=this.v[vi];let k=0;if(v.delay>0){k=Math.min(n,v.delay);v.delay-=k;}
      const buf=v.buf,N=v.N,c=v.c,s=v.s,dec=v.dec*v.fade,gl=v.gl,gr=v.gr;let pos=v.pos,x1=v.x1,y1=v.y1,env=v.env;
      for(;k<n;k++){const yo=buf[pos],p1=pos+1===N?0:pos+1,f=((1-s)*yo+s*buf[p1])*dec,a=c*f+x1-c*y1;x1=f;y1=a;buf[pos]=a;pos=p1;L[k]+=yo*gl;if(R!==L)R[k]+=yo*gr;env=env*0.999+Math.abs(yo)*0.001;}
      v.pos=pos;v.x1=x1;v.y1=y1;v.env=env;v.age+=n;
      if((v.age>6000&&env<2e-5)||(v.fade<1&&env<1e-4&&v.age>800))this.v.splice(vi,1);}
    for(let k=0;k<n;k++){L[k]=Math.tanh(L[k]);if(R!==L)R[k]=Math.tanh(R[k]);}
    return true;}}
registerProcessor('fw-pluck',Pluck);

class Tap extends AudioWorkletProcessor{
  constructor(o){super();const po=(o&&o.processorOptions)||{};this.st=!!po.stereo;this.ons=!!po.onset;this.on=false;this.n=0;this.B=2048;
    this.l=new Float32Array(this.B);this.r=this.st?new Float32Array(this.B):null;this.t0=0;this.slow=0;this.prev=0;this.last=-1;
    this.port.onmessage=e=>{if('on' in e.data){this.on=e.data.on;this.n=0;}};}
  process(i){const x=i[0];if(!x||!x.length)return true;const a=x[0],b=x[1]||x[0],n=a.length;
    if(this.ons){let pk=0;for(let k=0;k<n;k++){const v=Math.abs(a[k]);if(v>pk)pk=v;}
      if(pk>0.012&&pk>this.prev*1.8&&pk>this.slow*1.8&&currentTime-this.last>0.07){this.last=currentTime;this.port.postMessage({onset:true,t:currentTime,lvl:pk});}
      this.slow=this.slow*0.97+pk*0.03;this.prev=pk;}
    if(this.on){for(let k=0;k<n;k++){if(this.n===0)this.t0=currentTime+k/sampleRate;
      this.l[this.n]=this.st?a[k]:(a[k]+b[k])*(x[1]?0.5:1);if(this.st)this.r[this.n]=b[k];this.n++;
      if(this.n===this.B){this.port.postMessage({t:this.t0,l:this.l.slice(),r:this.st?this.r.slice():null});this.n=0;}}}
    return true;}}
registerProcessor('fw-tap',Tap);
`;

/* ---------- engine state ---------- */
const E = {
  ctx: null, worklet: false, ready: false, stream: null, inSettings: null, src: null, hasInput: false, tr: {},
  devs: { in: [], out: [], cam: [] }, recOn: { di: false, wet: false, master: false }, onTap: {}
};
const TRACKS = [['drums', 'Drums', '#e4572e'], ['bass', 'Bass', '#8a5cf5'], ['rhythm', 'Rhythm Gtr', '#0a9aa6'], ['lead', 'Lead / Tab', '#e0a31a'], ['live', 'Live Guitar', '#2e9d57'], ['vox', 'Vocal', '#ff5fa2'], ['click', 'Click', '#7b8a88']];
const gn = (v = 1) => { const n = E.ctx.createGain(); n.gain.value = v; return n; };
const bq = (type, f, q = 0.707, g = 0) => { const n = E.ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = g; return n; };
const tc = (p, v, t = 0.025) => p.setTargetAtTime(v, E.ctx.currentTime, t);
const chainN = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n; };

function makeTap(src, opt, cb) {
  const c = E.ctx;
  if (E.worklet) {
    const n = new AudioWorkletNode(c, 'fw-tap', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: opt.stereo ? 2 : 1, channelCountMode: 'explicit', processorOptions: opt });
    n.port.onmessage = e => cb(e.data); src.connect(n);
    return { on(v) { n.port.postMessage({ on: v }); }, node: n };
  }
  const sp = c.createScriptProcessor(2048, 2, 1); let on = false;
  sp.onaudioprocess = e => {
    if (!on) return; const a = e.inputBuffer.getChannelData(0), b = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : a;
    const l = new Float32Array(a.length); for (let k = 0; k < a.length; k++) l[k] = opt.stereo ? a[k] : (a[k] + b[k]) / 2;
    cb({ t: e.playbackTime - 2048 / c.sampleRate, l, r: opt.stereo ? b.slice() : null });
  };
  const z = gn(0); src.connect(sp); sp.connect(z); z.connect(c.destination);
  return { on(v) { on = v; }, node: sp };
}

async function startAudio() {
  const gest = !navigator.userActivation || navigator.userActivation.hasBeenActive, kick = async c => { const r = c.resume(); if (gest) await r; else r.catch(() => { }); };
  if (E.ctx) { if (E.ctx.state === 'suspended') await kick(E.ctx); return; }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  const o = { latencyHint: CFG.hint === '0' ? 0 : CFG.hint }; if (CFG.sr !== 'auto') o.sampleRate = +CFG.sr;
  try { E.ctx = new Ctor(o); } catch (e) { E.ctx = new Ctor(); }
  const c = E.ctx;
  try {
    try { await c.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }))); }
    catch (e1) { await c.audioWorklet.addModule('data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(WORKLET_SRC)))); }
    E.worklet = true;
  } catch (e) { console.warn('AudioWorklet unavailable — using fallbacks', e); E.worklet = false; }
  buildGraph();
  if (c.state === 'suspended') await kick(c);
  E.ready = true; bus.emit('audio:ready');
}

function buildGraph() {
  const c = E.ctx;
  E.inTrim = gn(fromDB(CFG.gTrim || 0)); E.inSum = gn(1); E.rigIn = gn(1); E.rigOut = gn(1); E.mix = gn(1); E.master = gn(CFG.master != null ? CFG.master : .9);
  E.limiter = c.createDynamicsCompressor(); Object.assign(E.limiter.threshold, { value: -1.5 }); E.limiter.knee.value = 0; E.limiter.ratio.value = 20; E.limiter.attack.value = 0.001; E.limiter.release.value = 0.08;
  const mkAna = (fft, sm) => { const a = c.createAnalyser(); a.fftSize = fft; a.smoothingTimeConstant = sm; a.minDecibels = -110; a.maxDecibels = -10; return a; };
  E.anaDI = mkAna(4096, 0); E.anaChroma = mkAna(16384, 0.5); E.anaRig = mkAna(CFG.fft, CFG.smooth); E.anaMaster = mkAna(CFG.fft, CFG.smooth);
  E.inSum.connect(E.inTrim); E.inTrim.connect(E.rigIn); E.anaIn = mkAna(2048, 0); E.inTrim.connect(E.anaIn);
  /* what the note detector, tuner, chord/key finder, onset pulses and the Input meter listen to: the guitar, the vocal, or both (CFG.anSrc) */
  E.anSrc = gn(1); E.aG = gn(CFG.anSrc === 'v' ? 0 : 1); E.aV = gn(CFG.anSrc === 'v' || CFG.anSrc === 'b' ? 1 : 0); E.inTrim.connect(E.aG); E.aG.connect(E.anSrc); E.anSrc.connect(E.anaDI); E.anSrc.connect(E.anaChroma);
  E.rigOut.connect(E.anaRig);
  TRACKS.forEach(([id]) => {
    const t = { id, in: gn(1), g: gn(1), pan: c.createStereoPanner(), ana: mkAna(512, 0.4) };
    t.in.connect(t.g); t.g.connect(t.pan); t.pan.connect(t.ana); E.tr[id] = t; if (FX_TRACKS.includes(id)) { t.fx = fxStrip(E.mix); t.pan.connect(t.fx.in); } else t.pan.connect(E.mix);
  });
  E.takesIn = gn(1); E.takesIn.connect(E.mix);
  /* vocal path: the second input channel → trim → (meter · recorder tap) and → monitor switch → polish strip → Vocal track */
  E.voxIn = gn(1); E.voxTrim = gn(fromDB(CFG.voxTrim || 0)); E.voxMon = gn(0); E.anaVox = mkAna(2048, 0.3);
  E.voxIn.connect(E.voxTrim); E.voxTrim.connect(E.anaVox); E.voxTrim.connect(E.aV); E.voxTrim.connect(E.voxMon);
  { const sIn = gn(1), sOut = gn(1), hp = bq('highpass', 90), cmp = c.createDynamicsCompressor(), mk = gn(1.35), pr = gn(1), by = gn(0);
    cmp.threshold.value = -24; cmp.knee.value = 14; cmp.ratio.value = 3; cmp.attack.value = .008; cmp.release.value = .2;
    chainN(sIn, hp, cmp, mk, pr, sOut); sIn.connect(by); by.connect(sOut); E.voxStrip = { in: sIn, out: sOut, proc: pr, byp: by }; sOut.connect(E.tr.vox.in); E.voxMon.connect(sIn); }
  voxPolishApply();
  E.rigOut.connect(E.tr.live.in);
  { const ms = mstBuild(); E.mix.connect(ms.in); ms.out.connect(E.master); mstApply(); }
  E.master.connect(E.limiter); E.limiter.connect(E.anaMaster); E.limiter.connect(c.destination);
  E.testOut = gn(.5); E.testOut.connect(c.destination);
  E.tapDI = makeTap(E.inTrim, { onset: true }, m => bus.emit('tap:di', m));
  E.tapWet = makeTap(E.rigOut, {}, m => bus.emit('tap:wet', m)); E.tapVox = makeTap(E.voxTrim, { onset: true }, m => bus.emit('tap:vox', m));
  E.tapMaster = makeTap(E.limiter, { stereo: true }, m => bus.emit('tap:master', m));
  rigBuild(); applyMix(); setMonitor(CFG.monitor);
}

function applyMix() {
  if (!E.ready && !E.tr.drums) return; if (!S.mix.vox) S.mix.vox = { g: 1, p: 0, m: 0, s: 0 }; const m = S.mix;
  const solo = Object.values(m).some(x => x.s);
  Object.keys(E.tr).forEach(id => {
    const x = m[id]; if (!x) return;
    const a = solo ? (x.s ? 1 : 0) : (x.m ? 0 : 1);
    tc(E.tr[id].g.gain, x.g * a * (id === 'live' && !CFG.monitor ? 0 : 1)); tc(E.tr[id].pan.pan, x.p); if (E.tr[id].fx) E.tr[id].fx.set(x.fx);
  });
  if (E.voxMon) tc(E.voxMon.gain, CFG.voxMon && CFG.vin !== 'off' && E.hasInput ? 1 : 0);
}
function setMonitor(on) { CFG.monitor = on; saveCfg(); applyMix(); bus.emit('monitor', on); }

/* ---------- input device handling ---------- */
async function listDevices() {
  try {
    const d = await navigator.mediaDevices.enumerateDevices();
    E.devs.in = d.filter(x => x.kind === 'audioinput'); E.devs.out = d.filter(x => x.kind === 'audiooutput'); E.devs.cam = d.filter(x => x.kind === 'videoinput');
  } catch (e) { console.warn(e); }
  bus.emit('devices');
}
async function openInput(deviceId) {
  const md = navigator.mediaDevices; if (!md || !md.getUserMedia) { toast('getUserMedia not available (needs https and a modern browser)', 'bad'); return false; }
  if (E.stream) E.stream.getTracks().forEach(t => t.stop());
  if (E.src) try { E.src.disconnect(); } catch (e) { }
  const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, latency: { ideal: 0 } };
  const attempt = async id => {
    const dev = id ? { deviceId: { exact: id } } : {}; let last = null;
    for (const extra of [{ ...base, ...dev, sampleRate: { ideal: E.ctx.sampleRate } }, { ...base, ...dev }, { echoCancellation: false, noiseSuppression: false, autoGainControl: false, ...dev }, { ...dev }]) {
      try { return await md.getUserMedia({ audio: extra }); } catch (e) { last = e; console.warn('input constraint failed', e.name, e.message); if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw e; }
    }
    throw last;
  };
  let st = null, err = null;
  try { st = await attempt(deviceId); } catch (e) {
    err = e;
    if (deviceId && e.name !== 'NotAllowedError' && e.name !== 'SecurityError') { try { st = await attempt(''); err = null; CFG.inDev = ''; toast('That input is not available any more (device IDs change between sessions) — using the system default input instead', 'warn'); } catch (e2) { err = e2; } }
  }
  if (!st) {
    const m = err ? ioErrMsg(err.name) + (/^(NotAllowed|Security)/.test(err.name) ? '' : ' (' + err.name + (err.message ? ': ' + err.message : '') + ')') : 'Could not open the audio input.'; E.lastInKind = (err && err.name) || 'Error';
    E.lastInErr = m; toast(m, 'bad'); bus.emit('input', null); return false;
  }
  E.lastInErr = null; E.lastInKind = null;
  xpSignal(2); E.stream = st; const tr = st.getAudioTracks()[0]; E.inSettings = tr.getSettings(); try { const cp = tr.getCapabilities && tr.getCapabilities(); E.inMax = (cp && cp.channelCount && cp.channelCount.max) || 0; } catch (e) { E.inMax = 0; }
  tr.addEventListener('ended', () => { if (E.stream !== st) return; E.stream = null; try { if (E.src) E.src.disconnect(); } catch (e) { } E.src = null; E.hasInput = false; E.lastInKind = 'ended'; E.lastInErr = '“' + (tr.label || 'The input') + '” was unplugged or taken by another app. Check the cable and press Connect.'; bus.emit('input', null); bus.emit('audiostate'); toast(E.lastInErr, 'warn'); }); CFG.inDev = E.inSettings.deviceId || deviceId || ''; saveCfg();
  E.src = E.ctx.createMediaStreamSource(st);
  if (!E.split) {
    E.split = E.ctx.createChannelSplitter(2); E.gL = gn(1); E.gR = gn(0);
    E.split.connect(E.gL, 0); E.split.connect(E.gR, 1); E.gL.connect(E.inSum); E.gR.connect(E.inSum);
    E.anaL = c0().createAnalyser(); E.anaR = c0().createAnalyser(); E.anaL.fftSize = E.anaR.fftSize = 1024; E.split.connect(E.anaL, 0); E.split.connect(E.anaR, 1);
    E.vL = gn(0); E.vR = gn(0); E.split.connect(E.vL, 0); E.split.connect(E.vR, 1); E.vL.connect(E.voxIn); E.vR.connect(E.voxIn);
  }
  E.src.connect(E.split); E.hasInput = true; setChannelMode(CFG.ch);
  await listDevices(); bus.emit('input', E.inSettings);
  return true;
}
/* Guitar channel (CFG.ch) and vocal channel (CFG.vin) share one 2-channel stream from the interface. A channel given to the
   vocal is taken away from the guitar, so the vocal never bleeds into the guitar's dry DI. */
function setChannelMode(m) {
  CFG.ch = m; saveCfg(); if (!E.gL) return;
  const nch = (E.inSettings && E.inSettings.channelCount) || 2;
  let l = 1, r = 0;
  if (m === 'R') { l = 0; r = 1; } else if (m === 'sum') { l = .5; r = .5; } else if (m === 'auto') { l = 1; r = nch > 1 ? 0 : 0; }
  if (CFG.vin === 'R') { l = 1; r = 0; } else if (CFG.vin === 'L') { l = 0; r = 1; }
  if (CFG.gOff) { l = 0; r = 0; }   // both inputs given to the vocal, or switched off: nothing goes to the guitar rig
  tc(E.gL.gain, l, .01); tc(E.gR.gain, r, .01);
  if (E.vL) { tc(E.vL.gain, CFG.vin === 'L' ? 1 : 0, .01); tc(E.vR.gain, CFG.vin === 'R' ? 1 : 0, .01); }
  applyMix(); bus.emit('route');
}
const c0 = () => E.ctx;
/** What each interface input is: ['g'|'v'|'o', 'g'|'v'|'o'] = Guitar (through the rig), Vocal (through the vocal strip) or Off. Derived from CFG.ch / CFG.vin / CFG.gOff. */
function chRoles() {
  const v = CFG.vin; let a = 'o', b = 'o';
  if (v === 'L') a = 'v'; else if (v === 'R') b = 'v';
  if (!CFG.gOff) { if (v === 'L') b = 'g'; else if (v === 'R') a = 'g'; else if (CFG.ch === 'sum') { a = 'g'; b = 'g'; } else if (CFG.ch === 'R') b = 'g'; else a = 'g'; }
  return [a, b];
}
/** Set both inputs at once. A second Vocal input is not possible, so choosing Vocal on one input hands the other back to the guitar. */
function chSetRoles(a, b) {
  if (a === 'v' && b === 'v') b = 'g';
  const wasOff = !!CFG.gOff;
  const g1 = a === 'g', g2 = b === 'g'; CFG.vin = a === 'v' ? 'L' : b === 'v' ? 'R' : 'off';
  CFG.gOff = !g1 && !g2; if (g1 && g2) CFG.ch = 'sum'; else if (g2) CFG.ch = 'R'; else if (g1) CFG.ch = 'L';
  if (CFG.vin !== 'off') CFG.armV = true;
  // the detector follows what is plugged in, unless the person already chose
  if (CFG.gOff && CFG.vin !== 'off') CFG.anSrc = 'v'; else if (CFG.vin === 'off' || wasOff || !CFG.anSrc) CFG.anSrc = 'g';
  saveCfg(); setChannelMode(CFG.ch); applyAnaSource();
}
function applyAnaSource() { const s = CFG.anSrc || 'g'; if (E.aG) { E.anTarget = [s === 'v' ? 0 : 1, s === 'g' ? 0 : 1]; tc(E.aG.gain, E.anTarget[0], .02); tc(E.aV.gain, E.anTarget[1], .02); } bus.emit('route'); }
function setAnaSource(s) { CFG.anSrc = s; saveCfg(); applyAnaSource(); }
/** vin: 'off' | 'L' (input 1) | 'R' (input 2) */
function setVoxInput(v) {
  if (v !== 'off' && E.hasInput && E.inSettings && E.inSettings.channelCount === 1) toast('This device exposes a single input channel, so a separate vocal channel is not possible. Pick a 2-channel input (e.g. the Focusrite) in I/O.', 'warn');
  CFG.vin = v; if (v !== 'off') CFG.armV = true; saveCfg(); setChannelMode(CFG.ch);
  if (v !== 'off') toast('Guitar on input ' + (v === 'R' ? '1' : '2') + ' · vocal on input ' + (v === 'R' ? '2' : '1') + ' — arm both lanes and press R to record them together', 'ok');
}
function setVoxTrim(db) { CFG.voxTrim = db; saveCfg(); if (E.voxTrim) tc(E.voxTrim.gain, fromDB(db), .02); }
function voxPolishApply() { if (!E.voxStrip) return; const on = CFG.voxPolish !== false; tc(E.voxStrip.proc.gain, on ? 1 : 0, .02); tc(E.voxStrip.byp.gain, on ? 0 : 1, .02); }
const armedG = () => CFG.armG !== false, armedV = () => CFG.armV !== false && !!CFG.vin && CFG.vin !== 'off';
async function autoDetectChannel() {
  if (!E.hasInput) return;
  const aL = E.ctx.createAnalyser(), aR = E.ctx.createAnalyser(); aL.fftSize = aR.fftSize = 2048; E.split.connect(aL, 0); E.split.connect(aR, 1);
  const bl = new Float32Array(2048), br = new Float32Array(2048); let pl = 0, pr = 0;
  toast('Strum the guitar for 2 seconds…');
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 50)); aL.getFloatTimeDomainData(bl); aR.getFloatTimeDomainData(br); for (let k = 0; k < 2048; k++) { pl = Math.max(pl, Math.abs(bl[k])); pr = Math.max(pr, Math.abs(br[k])); } }
  try { E.split.disconnect(aL); E.split.disconnect(aR); } catch (e) { }
  if (pl < .005 && pr < .005) { toast('No signal detected on either channel', 'warn'); return; }
  const pick = pr > pl * 1.5 ? 'R' : (pl > pr * 1.5 ? 'L' : 'sum');
  CFG.gOff = false; setChannelMode(pick); bus.emit('input', E.inSettings); toast('Input channel: ' + (pick === 'sum' ? 'both (summed)' : pick === 'L' ? 'Input 1 / Left' : 'Input 2 / Right'), 'ok');
}
async function setOutputDevice(id) {
  CFG.outDev = id; saveCfg();
  try { if (E.ctx.setSinkId) await E.ctx.setSinkId(id || ''); else toast('Output selection needs a recent Chromium browser', 'warn'); } catch (e) { toast('Could not switch output: ' + e.message, 'bad'); }
}
function latencyInfo() {
  const c = E.ctx; if (!c) return null;
  const out = (c.outputLatency || 0) * 1000, base = (c.baseLatency || 0) * 1000;
  const inp = E.inSettings && E.inSettings.latency != null ? E.inSettings.latency * 1000 : null;
  const est = base + out + (inp != null ? inp : base);
  return { sr: c.sampleRate, base, out, inp, est, block: 128 / c.sampleRate * 1000, rtt: CFG.rtt, state: c.state };
}
const rttMs = () => CFG.rtt != null ? CFG.rtt : (latencyInfo() ? latencyInfo().est : 20);

/* ---------- FX framework ---------- */
const FX = {};
const P = (k, label, min, max, def, step = .01, unit = '', o = {}) => ({ k, label, min, max, def, step, unit, type: 'knob', ...o });
const SELP = (k, label, opts, def) => ({ k, label, type: 'select', opts, def: def == null ? opts[0] : def });
const TOG = (k, label, def = 0) => ({ k, label, type: 'toggle', def });
const defFx = (id, name, cat, params, build, o = {}) => { FX[id] = { id, name, cat, params, build, ...o }; };
function satCurve(k, bias = 0, n = 2048, kind = 'tanh') {
  const a = new Float32Array(n), nb = kind === 'tanh' ? Math.tanh(bias) : Math.atan(bias);
  const f = kind === 'tanh' ? Math.tanh : Math.atan, sc = Math.abs(f(k + bias) - nb) || 1;
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; a[i] = (f(k * x + bias) - nb) / sc; }
  return a;
}
const LFO = (c, type = 'sine', f = 1) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
const passthru = () => { const g = gn(); return { in: g, out: g, set() { } }; };

defFx('gate', 'Noise Gate', 'Dynamics', [P('thresh', 'Thresh', -80, -20, -58, 1, ' dB'), P('rel', 'Release', 20, 600, 140, 1, ' ms', { log: 1 }), P('hold', 'Hold', 0, 300, 40, 1, ' ms'), P('range', 'Range', -90, -6, -70, 1, ' dB')], (c) => {
  if (!E.worklet) return passthru();
  const n = new AudioWorkletNode(c, 'fw-gate', { channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1] });
  const map = { thresh: 'th', rel: 'rel', hold: 'hold', range: 'range' };
  return { in: n, out: n, set(k, v) { n.port.postMessage({ [map[k]]: v }); } };
});
defFx('comp', 'Compressor', 'Dynamics', [P('thr', 'Thresh', -60, 0, -26, 1, ' dB'), P('ratio', 'Ratio', 1, 20, 4, .1, ':1'), P('atk', 'Attack', 1, 200, 12, 1, ' ms', { log: 1 }), P('rel', 'Release', 20, 1000, 220, 1, ' ms', { log: 1 }), P('knee', 'Knee', 0, 40, 14, 1, ' dB'), P('makeup', 'Makeup', 0, 24, 6, .5, ' dB'), P('mix', 'Blend', 0, 1, 1, .01)], (c) => {
  const i = gn(), cm = c.createDynamicsCompressor(), mk = gn(), dry = gn(0), wet = gn(1), o = gn();
  chainN(i, cm, mk, wet, o); i.connect(dry); dry.connect(o);
  return { in: i, out: o, set(k, v) { switch (k) { case 'thr': cm.threshold.value = v; break; case 'ratio': cm.ratio.value = v; break; case 'atk': cm.attack.value = v / 1000; break; case 'rel': cm.release.value = v / 1000; break; case 'knee': cm.knee.value = v; break; case 'makeup': tc(mk.gain, fromDB(v)); break; case 'mix': tc(wet.gain, v); tc(dry.gain, 1 - v); } } };
});
defFx('wah', 'Wah', 'Filter', [SELP('mode', 'Mode', ['Pedal', 'Auto LFO']), P('pos', 'Pedal', 0, 1, .5), P('q', 'Q', 1, 16, 6, .1), P('rate', 'Rate', .1, 8, 1.6, .01, ' Hz', { log: 1 }), P('depth', 'Depth', 0, 1, .8), P('mix', 'Mix', 0, 1, 1)], (c) => {
  const i = gn(), bp = bq('bandpass', 800, 6), lfo = LFO(c), lg = gn(0), lv = gn(1.8), dry = gn(0), wet = gn(1), o = gn();
  lfo.connect(lg); lg.connect(bp.frequency); chainN(i, bp, lv, wet, o); i.connect(dry); dry.connect(o);
  let mode = 'Pedal', pos = .5, dep = .8;
  const upd = () => { const f = 350 * Math.pow(2, pos * 3.2); tc(bp.frequency, f, .02); tc(lg.gain, mode === 'Pedal' ? 0 : f * dep * .7, .05); };
  return { in: i, out: o, set(k, v) { switch (k) { case 'mode': mode = v; upd(); break; case 'pos': pos = v; upd(); break; case 'depth': dep = v; upd(); break; case 'q': bp.Q.value = v; break; case 'rate': lfo.frequency.value = v; break; case 'mix': tc(wet.gain, v); tc(dry.gain, 1 - v); } } };
});
function driveUnit(c, o) {
  const i = gn(), hp = bq('highpass', o.hp), body = bq('peaking', 720, .9, 0), drv = gn(8), ws = c.createWaveShaper(), lp = bq('lowpass', 4500), lv = gn(.8);
  ws.oversample = '4x'; chainN(i, hp, body, drv, ws, lp, lv); return { i, hp, body, drv, ws, lp, lv };
}
defFx('od', 'Overdrive', 'Drive', [P('drive', 'Drive', 0, 1, .45), P('tone', 'Tone', 0, 1, .5), P('level', 'Level', 0, 1, .55), P('body', 'Mid Hump', 0, 12, 5, .5, ' dB')], (c) => {
  const u = driveUnit(c, { hp: 140 }); u.ws.curve = satCurve(3.2, .12);
  return { in: u.i, out: u.lv, set(k, v) { switch (k) { case 'drive': tc(u.drv.gain, 1 + v * v * 50); break; case 'tone': tc(u.lp.frequency, 1500 * Math.pow(6, v)); break; case 'level': tc(u.lv.gain, v * 1.6); break; case 'body': u.body.gain.value = v; } } };
});
defFx('ds', 'Distortion', 'Drive', [P('drive', 'Gain', 0, 1, .55), P('tone', 'Tone', 0, 1, .5), P('level', 'Level', 0, 1, .45), P('grit', 'Grit', 0, 1, .5)], (c) => {
  const u = driveUnit(c, { hp: 110 });
  return { in: u.i, out: u.lv, set(k, v) { switch (k) { case 'drive': tc(u.drv.gain, 1 + v * v * 260); break; case 'tone': tc(u.lp.frequency, 1100 * Math.pow(9, v)); break; case 'level': tc(u.lv.gain, v * 1.3); break; case 'grit': u.ws.curve = satCurve(6 + v * 30, 0, 2048, v > .5 ? 'atan' : 'tanh'); } } };
});
defFx('fuzz', 'Fuzz', 'Drive', [P('fuzz', 'Fuzz', 0, 1, .7), P('bias', 'Bias', 0, 1, .4), P('tone', 'Tone', 0, 1, .5), P('level', 'Level', 0, 1, .4)], (c) => {
  const u = driveUnit(c, { hp: 70 }); let k = 20, b = .3;
  const cv = () => { u.ws.curve = satCurve(k, b * 1.4, 2048, 'tanh'); };
  return { in: u.i, out: u.lv, set(n, v) { switch (n) { case 'fuzz': tc(u.drv.gain, 1 + v * 90); k = 10 + v * 50; cv(); break; case 'bias': b = v; cv(); break; case 'tone': tc(u.lp.frequency, 700 * Math.pow(10, v)); break; case 'level': tc(u.lv.gain, v * 1.2); } } };
});
defFx('pitch', 'Pitch / Harmony', 'Pitch', [P('semi', 'Shift', -24, 24, 12, .01, ' st'), P('mix', 'Mix', 0, 1, .5), P('win', 'Window', 20, 120, 60, 1, ' ms')], (c) => {
  if (!E.worklet) return passthru();
  const n = new AudioWorkletNode(c, 'fw-pitch', { channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1] });
  return { in: n, out: n, set(k, v) { if (k === 'win') n.port.postMessage({ win: v / 1000 }); else n.parameters.get(k).value = v; } };
});
const AMP = {
  'Clean': { a1: 3, a2: 2, k1: 1.4, k2: 1.2, b1: .05, b2: .04, tB: 110, tM: 520, tT: 3200, vB: 2, vM: -1, vT: 3, hp: 60, inter: 7500, mk: 1.0, sag: .1 },
  'Chime (Class-A)': { a1: 5, a2: 3, k1: 1.8, k2: 1.5, b1: .08, b2: .05, tB: 120, tM: 1000, tT: 4200, vB: -1, vM: -2, vT: 5, hp: 80, inter: 9000, mk: .95, sag: .3 },
  'Crunch': { a1: 14, a2: 9, k1: 2.2, k2: 2.6, b1: .18, b2: .15, tB: 100, tM: 700, tT: 3000, vB: 1, vM: 3, vT: 2, hp: 90, inter: 6500, mk: .8, sag: .4 },
  'Lead': { a1: 24, a2: 12, k1: 3.0, k2: 2.8, b1: .2, b2: .12, tB: 110, tM: 900, tT: 3400, vB: 0, vM: 4, vT: 0, hp: 110, inter: 5800, mk: .7, sag: .5 },
  'Hi-Gain': { a1: 38, a2: 22, k1: 3.8, k2: 4.5, b1: .25, b2: .2, tB: 90, tM: 620, tT: 2800, vB: 3, vM: -3, vT: 4, hp: 140, inter: 5200, mk: .55, sag: .2 }
};
defFx('amp', 'Amp', 'Amp', [SELP('model', 'Model', Object.keys(AMP)), P('gain', 'Gain', 0, 1, .35), P('bass', 'Bass', 0, 1, .5), P('mid', 'Mid', 0, 1, .5), P('treble', 'Treble', 0, 1, .5), P('pres', 'Presence', 0, 1, .45), P('master', 'Master', 0, 1, .5), TOG('bright', 'Bright'), P('tight', 'Tight', 0, 1, .2)], (c) => {
  const i = gn(), hp = bq('highpass', 90), br = bq('highshelf', 3500, .7, 0), g1 = gn(4), w1 = c.createWaveShaper(), lp1 = bq('lowpass', 7500), hp2 = bq('highpass', 60), g2 = gn(2), w2 = c.createWaveShaper(),
    lo = bq('lowshelf', 110), mi = bq('peaking', 650, .8), hi = bq('highshelf', 3000), pr = bq('highshelf', 5500), dc = bq('highpass', 28), sg = c.createDynamicsCompressor(), ms = gn(.7);
  w1.oversample = w2.oversample = '4x'; sg.threshold.value = -20; sg.knee.value = 20; sg.attack.value = .004; sg.release.value = .12;
  chainN(i, hp, br, g1, w1, lp1, hp2, g2, w2, lo, mi, hi, pr, dc, sg, ms);
  const st = { model: 'Clean', gain: .35, bass: .5, mid: .5, treble: .5, pres: .45, master: .5, tight: .2, bright: 0 };
  const M = () => AMP[st.model];
  const upd = () => {
    const m = M(); w1.curve = satCurve(m.k1, m.b1); w2.curve = satCurve(m.k2, m.b2);
    tc(g1.gain, 1 + st.gain * m.a1); tc(g2.gain, 1 + st.gain * m.a2 * .6); lp1.frequency.value = m.inter;
    lo.frequency.value = m.tB; mi.frequency.value = m.tM; hi.frequency.value = m.tT;
    lo.gain.value = (st.bass - .5) * 24 + m.vB; mi.gain.value = (st.mid - .5) * 24 + m.vM; hi.gain.value = (st.treble - .5) * 24 + m.vT; pr.gain.value = (st.pres - .5) * 20;
    hp.frequency.value = Math.max(m.hp * .6, 40) + st.tight * 380; sg.ratio.value = 1 + m.sag * 5; tc(ms.gain, st.master * 1.5 * m.mk); br.gain.value = st.bright ? 5 : 0;
  };
  return { in: i, out: ms, set(k, v) { st[k] = v; upd(); } };
});
const CABS = {
  '1x12 Open Back': { res: [[105, .9, .020], [260, .35, .012], [1800, .30, .004], [3300, .45, .003]], lp: 5600, hp: 90, len: .045 },
  '2x12 Combo': { res: [[95, 1, .022], [240, .4, .012], [1500, .35, .004], [2900, .5, .003]], lp: 5200, hp: 80, len: .05 },
  '4x12 Closed': { res: [[78, 1.1, .03], [190, .5, .015], [1100, .4, .005], [2600, .7, .003]], lp: 4700, hp: 70, len: .06 },
  '1x10 Vintage': { res: [[140, .8, .015], [400, .4, .01], [2100, .5, .004], [4100, .5, .003]], lp: 4300, hp: 110, len: .04 },
  'Studio Flat': { res: [[200, .15, .006]], lp: 16000, hp: 60, len: .012 },
  'Acoustic Body Sim': { res: [[98, .9, .03], [200, .8, .025], [400, .5, .015], [1100, .3, .006], [2700, .3, .004]], lp: 9000, hp: 60, len: .08 }
};
function makeCabIR(c, type, mic) {
  const d = CABS[type] || CABS['2x12 Combo'], sr = c.sampleRate, N = Math.floor(sr * Math.max(d.len, .03) * 2), b = c.createBuffer(1, N, sr), x = b.getChannelData(0);
  x[0] = 1; for (const [f, a, tau] of d.res) for (let n = 0; n < N; n++) { const t = n / sr; x[n] += a * .6 * Math.exp(-t / tau) * Math.sin(2 * Math.PI * f * t); }
  const k = Math.max(1, Math.round(sr / 16000)) + 2; for (let n = N - 1; n >= k; n--) x[n] -= .35 * mic * x[n - k];
  const lpf = d.lp * (.55 + .9 * (1 - mic)), a1 = 1 - Math.exp(-2 * Math.PI * lpf / sr), a2 = 1 - Math.exp(-2 * Math.PI * d.hp / sr);
  for (let pass = 0; pass < 2; pass++) { let y = 0; for (let n = 0; n < N; n++) { y += a1 * (x[n] - y); x[n] = y; } }
  { let y = 0; for (let n = 0; n < N; n++) { y += a2 * (x[n] - y); x[n] -= y; } }
  let e = 0; for (let n = 0; n < N; n++) e += x[n] * x[n]; const s = 1 / Math.sqrt(e + 1e-9); for (let n = 0; n < N; n++) x[n] *= s * 1.6;
  return b;
}
defFx('cab', 'Cabinet / IR', 'Amp', [SELP('type', 'Cabinet', Object.keys(CABS), '2x12 Combo'), P('mic', 'Mic Pos', 0, 1, .3), P('lo', 'Low Cut', 20, 300, 70, 1, ' Hz', { log: 1 }), P('hi', 'High Cut', 2000, 16000, 12000, 10, ' Hz', { log: 1 }), P('mix', 'Mix', 0, 1, 1)], (c, p, u) => {
  const i = gn(), cv = c.createConvolver(), lo = bq('highpass', 70), hi = bq('lowpass', 12000), wet = gn(1), dry = gn(0), o = gn();
  cv.normalize = false; i.connect(cv); cv.connect(lo); lo.connect(hi); hi.connect(wet); wet.connect(o); i.connect(dry); dry.connect(o);
  let ty = '2x12 Combo', mic = .3, custom = false, tm = 0;
  const rb = () => { if (custom) return; clearTimeout(tm); tm = setTimeout(() => { cv.buffer = makeCabIR(c, ty, mic); }, 60); };
  u.loadIR = async file => { try { const buf = await c.decodeAudioData(await file.arrayBuffer()); const m = c.createBuffer(1, buf.length, buf.sampleRate), d = m.getChannelData(0); let e = 0; for (let k = 0; k < buf.length; k++) { let s = 0; for (let ch = 0; ch < buf.numberOfChannels; ch++) s += buf.getChannelData(ch)[k]; d[k] = s / buf.numberOfChannels; e += d[k] * d[k]; } const sc = 1.6 / Math.sqrt(e + 1e-9); for (let k = 0; k < d.length; k++) d[k] *= sc; cv.buffer = m; custom = true; toast('Loaded IR: ' + file.name, 'ok'); bus.emit('rig:ir', file.name); } catch (e) { toast('IR load failed: ' + e.message, 'bad'); } };
  u.clearIR = () => { custom = false; rb(); };
  return { in: i, out: o, set(k, v) { switch (k) { case 'type': ty = v; custom = false; rb(); break; case 'mic': mic = v; rb(); break; case 'lo': lo.frequency.value = v; break; case 'hi': hi.frequency.value = v; break; case 'mix': tc(wet.gain, v); tc(dry.gain, 1 - v); } } };
});
defFx('eq', 'Parametric EQ', 'Filter', [P('hp', 'Low Cut', 20, 500, 40, 1, ' Hz', { log: 1 }), P('b1', '80 Hz', -15, 15, 0, .5, ' dB'), P('b2', '250 Hz', -15, 15, 0, .5, ' dB'), P('b3', '800 Hz', -15, 15, 0, .5, ' dB'), P('b4', '2.5 kHz', -15, 15, 0, .5, ' dB'), P('b5', '6 kHz', -15, 15, 0, .5, ' dB'), P('lp', 'High Cut', 2000, 20000, 18000, 10, ' Hz', { log: 1 })], (c) => {
  const i = gn(), hp = bq('highpass', 40), f = [80, 250, 800, 2500, 6000].map((hz, n) => bq(n === 0 ? 'lowshelf' : n === 4 ? 'highshelf' : 'peaking', hz, 1)), lp = bq('lowpass', 18000);
  chainN(i, hp, ...f, lp);
  return { in: i, out: lp, set(k, v) { if (k === 'hp') hp.frequency.value = v; else if (k === 'lp') lp.frequency.value = v; else f[+k[1] - 1].gain.value = v; } };
});
defFx('chorus', 'Chorus', 'Modulation', [P('rate', 'Rate', .1, 8, .8, .01, ' Hz', { log: 1 }), P('depth', 'Depth', 0, 1, .5), P('mix', 'Mix', 0, 1, .5), P('dry', 'Dry', 0, 1, 1), P('tone', 'Tone', 1500, 16000, 9000, 10, ' Hz', { log: 1 })], (c) => {
  const i = gn(), d1 = c.createDelay(.05), d2 = c.createDelay(.05), lfo = LFO(c), l1 = gn(.004), inv = gn(-1), l2 = gn(.004), mg = c.createChannelMerger(2), lp = bq('lowpass', 9000), wet = gn(.5), dry = gn(1), o = gn();
  d1.delayTime.value = .013; d2.delayTime.value = .017; lfo.connect(l1); l1.connect(d1.delayTime); lfo.connect(inv); inv.connect(l2); l2.connect(d2.delayTime);
  i.connect(d1); i.connect(d2); d1.connect(mg, 0, 0); d2.connect(mg, 0, 1); mg.connect(lp); lp.connect(wet); wet.connect(o); i.connect(dry); dry.connect(o);
  return { in: i, out: o, set(k, v) { switch (k) { case 'rate': lfo.frequency.value = v; break; case 'depth': tc(l1.gain, .0008 + v * .005); tc(l2.gain, .0008 + v * .005); break; case 'mix': tc(wet.gain, v); break; case 'dry': tc(dry.gain, v); break; case 'tone': lp.frequency.value = v; } } };
});
defFx('phaser', 'Phaser', 'Modulation', [P('rate', 'Rate', .05, 8, .45, .01, ' Hz', { log: 1 }), P('depth', 'Depth', 0, 1, .7), P('res', 'Resonance', .3, 10, 2, .1), P('center', 'Center', 0, 1, .5), P('mix', 'Mix', 0, 1, .6)], (c) => {
  const i = gn(), base = [160, 380, 780, 1500, 2800, 4800], ap = base.map(f => bq('allpass', f, 2)), lfo = LFO(c), lgs = ap.map(() => gn(0)), wet = gn(.6), dry = gn(1), o = gn();
  chainN(i, ...ap, wet, o); i.connect(dry); dry.connect(o); ap.forEach((a, n) => { lfo.connect(lgs[n]); lgs[n].connect(a.frequency); });
  let dep = .7, ctr = .5; const upd = () => ap.forEach((a, n) => { const f = base[n] * Math.pow(2, (ctr - .5) * 2); tc(a.frequency, f); tc(lgs[n].gain, f * dep * .85); });
  return { in: i, out: o, set(k, v) { switch (k) { case 'rate': lfo.frequency.value = v; break; case 'depth': dep = v; upd(); break; case 'center': ctr = v; upd(); break; case 'res': ap.forEach(a => a.Q.value = v); break; case 'mix': tc(wet.gain, v); } } };
});
defFx('flanger', 'Flanger', 'Modulation', [P('rate', 'Rate', .02, 10, .3, .01, ' Hz', { log: 1 }), P('depth', 'Depth', 0, 1, .7), P('manual', 'Manual', .2, 8, 2, .1, ' ms'), P('fb', 'Feedback', -.95, .95, .5), P('mix', 'Mix', 0, 1, .5)], (c) => {
  if (!E.worklet) return passthru();
  const n = new AudioWorkletNode(c, 'fw-flange', { channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [2] });
  return { in: n, out: n, set(k, v) { n.parameters.get(k).value = v; } };
});
defFx('trem', 'Tremolo', 'Modulation', [P('rate', 'Rate', .3, 16, 5, .01, ' Hz', { log: 1 }), P('depth', 'Depth', 0, 1, .6), SELP('shape', 'Shape', ['sine', 'triangle', 'square', 'sawtooth'])], (c) => {
  const i = gn(), t = gn(.7), lfo = LFO(c), lg = gn(.3); i.connect(t); lfo.connect(lg); lg.connect(t.gain);
  return { in: i, out: t, set(k, v) { switch (k) { case 'rate': lfo.frequency.value = v; break; case 'depth': tc(t.gain, 1 - v / 2); tc(lg.gain, v / 2); break; case 'shape': lfo.type = v; } } };
});
const DIVS = { 'Free': null, '1/2': 2, '1/4': 1, '1/4 triplet': 2 / 3, '1/8 dotted': .75, '1/8': .5, '1/8 triplet': 1 / 3, '1/16': .25 };
defFx('delay', 'Delay', 'Time', [P('time', 'Time', 20, 1500, 380, 1, ' ms', { log: 1 }), SELP('sync', 'Sync', Object.keys(DIVS)), P('fb', 'Feedback', 0, .95, .38), P('tone', 'Tone', 600, 12000, 4800, 10, ' Hz', { log: 1 }), P('mix', 'Mix', 0, 1, .3), P('spread', 'Ping-Pong', 0, 1, .5), P('mod', 'Wobble', 0, 1, .15)], (c, p, u) => {
  const i = gn(), dL = c.createDelay(3), dR = c.createDelay(3), fL = gn(.3), fR = gn(.3), xL = gn(0), xR = gn(0), tL = bq('lowpass', 4800), tR = bq('lowpass', 4800), mg = c.createChannelMerger(2), wet = gn(.3), o = gn(), dry = gn(1), lfo = LFO(c, 'sine', .6), lg = gn(0), iR = gn(1);
  i.connect(dL); i.connect(iR); iR.connect(dR); dL.connect(tL); dR.connect(tR); tL.connect(fL); fL.connect(dL); tR.connect(fR); fR.connect(dR); tL.connect(xL); xL.connect(dR); tR.connect(xR); xR.connect(dL);
  tL.connect(mg, 0, 0); tR.connect(mg, 0, 1); mg.connect(wet); wet.connect(o); i.connect(dry); dry.connect(o); lfo.connect(lg); lg.connect(dL.delayTime); lg.connect(dR.delayTime);
  const st = { time: 380, sync: 'Free', fb: .38, spread: .5 };
  const ms = () => DIVS[st.sync] ? 60000 / S.bpm * DIVS[st.sync] : st.time;
  const upd = () => { const t = clamp(ms() / 1000, .005, 2.9); tc(dL.delayTime, t, .03); tc(dR.delayTime, t, .03); tc(fL.gain, st.fb * (1 - st.spread)); tc(fR.gain, st.fb * (1 - st.spread)); tc(xL.gain, st.fb * st.spread); tc(xR.gain, st.fb * st.spread); tc(iR.gain, 1 - st.spread * .85); };
  u.retime = upd; bus.on('bpm', () => { if (st.sync !== 'Free') upd(); });
  return { in: i, out: o, set(k, v) { switch (k) { case 'tone': tL.frequency.value = tR.frequency.value = v; break; case 'mix': tc(wet.gain, v); break; case 'mod': tc(lg.gain, v * .004); break; default: st[k] = v; upd(); } } };
});
const REVT = { 'Room': { att: .003, br: .55, er: [[7, .6], [13, .5], [19, .45], [27, .4], [33, .3]], dens: 1 }, 'Hall': { att: .035, br: .38, er: [[19, .5], [37, .4], [53, .35], [71, .3]], dens: 1 }, 'Plate': { att: .001, br: .85, er: [], dens: 1 }, 'Spring': { att: .002, br: .3, er: [], dens: .7, spring: 1 }, 'Cathedral': { att: .07, br: .25, er: [[41, .5], [83, .4], [131, .35]], dens: 1 }, 'Ethereal': { att: .28, br: .42, er: [], dens: 1 } };
function makeReverbIR(c, type, decay, pre, damp) {
  const sr = c.sampleRate, pn = Math.floor(sr * pre / 1000), len = Math.floor(sr * decay) + pn + 64, b = c.createBuffer(2, len, sr), pr = REVT[type] || REVT.Hall;
  for (let ch = 0; ch < 2; ch++) {
    const x = b.getChannelData(ch); let seed = 1234567 + ch * 7919 + type.length * 131; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; }; let lp = 0;
    for (let n = pn; n < len; n++) { const t = (n - pn) / sr, env = Math.exp(-6.91 * t / decay), at = 1 - Math.exp(-t / pr.att), a = lerp(pr.br, .04, damp * Math.sqrt(clamp(t / decay, 0, 1))); lp += a * (rnd() * pr.dens - lp); x[n] = lp * env * at; }
    for (const [ms, g] of pr.er) { const n = pn + Math.floor(ms * (1 + ch * .07) * sr / 1000); if (n < len) x[n] += g * (ch ? -1 : 1); }
    if (pr.spring) { const cl = Math.floor(sr * .025); for (let k = 0; k < 14; k++) { const s0 = pn + Math.floor(k * .036 * sr * (1 + ch * .03)), g = Math.pow(.78, k); let ph = 0; for (let j = 0; j < cl && s0 + j < len; j++) { const t = j / (cl / sr), f = 4500 * Math.pow(300 / 4500, t / .025); ph += 2 * Math.PI * f / sr; x[s0 + j] += g * .5 * Math.sin(ph) * (1 - j / cl); } } }
  }
  return b;
}
defFx('reverb', 'Reverb', 'Time', [SELP('type', 'Type', Object.keys(REVT), 'Hall'), P('decay', 'Decay', .2, 8, 2.2, .1, ' s'), P('pre', 'Pre-delay', 0, 120, 12, 1, ' ms'), P('damp', 'Damping', 0, 1, .5), P('lowcut', 'Low Cut', 20, 800, 140, 1, ' Hz', { log: 1 }), P('mix', 'Mix', 0, 1, .25)], (c) => {
  const i = gn(), cv = c.createConvolver(), hp = bq('highpass', 140), wet = gn(.25), o = gn(), dry = gn(1);
  i.connect(cv); cv.connect(hp); hp.connect(wet); wet.connect(o); i.connect(dry); dry.connect(o);
  const st = { type: 'Hall', decay: 2.2, pre: 12, damp: .5 }; let tm = 0;
  const rb = () => { clearTimeout(tm); tm = setTimeout(() => { cv.buffer = makeReverbIR(c, st.type, st.decay, st.pre, st.damp); }, 90); };
  return { in: i, out: o, set(k, v) { switch (k) { case 'mix': tc(wet.gain, v); break; case 'lowcut': hp.frequency.value = v; break; default: st[k] = v; rb(); } } };
});

class FxUnit {
  constructor(def) {
    this.def = def; this.id = def.id; this.p = {}; def.params.forEach(q => this.p[q.k] = q.def);
    this.inN = gn(); this.outN = gn(); this.dry = gn(1); this.wet = gn(0); this.on = false; this.conn = false;
    this.fx = def.build(E.ctx, this.p, this);
    this.inN.connect(this.dry); this.dry.connect(this.outN); this.fx.out.connect(this.wet); this.wet.connect(this.outN);
    def.params.forEach(q => this.fx.set(q.k, this.p[q.k]));
  }
  setActive(a) {
    a = !!a; if (a === this.on && this.conn === a) return; this.on = a; clearTimeout(this.tm);
    if (a) { if (!this.conn) { this.inN.connect(this.fx.in); this.conn = true; } tc(this.dry.gain, 0, .008); tc(this.wet.gain, 1, .008); }
    else { tc(this.dry.gain, 1, .008); tc(this.wet.gain, 0, .008); this.tm = setTimeout(() => { if (!this.on && this.conn) { try { this.inN.disconnect(this.fx.in); } catch (e) { } this.conn = false; } }, 160); }
  }
  set(k, v) { this.p[k] = v; this.fx.set(k, v); }
}
const RIG = { order: ['gate', 'comp', 'wah', 'od', 'ds', 'fuzz', 'pitch', 'amp', 'cab', 'eq', 'chorus', 'phaser', 'flanger', 'trem', 'delay', 'reverb'], units: {}, cur: '—' };
function rigBuild() { RIG.order.forEach(id => { RIG.units[id] = new FxUnit(FX[id]); }); rigConnect(); }
function rigConnect() {
  try { E.rigIn.disconnect(); } catch (e) { }
  RIG.order.forEach(id => { try { RIG.units[id].outN.disconnect(); } catch (e) { } });
  let prev = E.rigIn; RIG.order.forEach(id => { prev.connect(RIG.units[id].inN); prev = RIG.units[id].outN; }); prev.connect(E.rigOut);
}
function rigMove(id, toIdx) { const a = RIG.order.indexOf(id); if (a < 0) return; RIG.order.splice(a, 1); RIG.order.splice(clamp(toIdx, 0, RIG.order.length), 0, id); if (E.ready) rigConnect(); bus.emit('rig:order'); }
function rigSnapshot() { const u = {}; RIG.order.forEach(id => { const x = RIG.units[id]; if (x) u[id] = { on: x.on ? 1 : 0, ...x.p }; }); return { order: RIG.order.slice(), u }; }
function rigApply(s, opts = {}) {
  if (!E.ready) return;
  if (s.order && s.order.length === RIG.order.length) { RIG.order = s.order.slice(); rigConnect(); }
  RIG.order.forEach(id => {
    const x = RIG.units[id], d = (s.u || {})[id], def = x.def;
    def.params.forEach(q => { const v = d && d[q.k] != null ? d[q.k] : q.def; x.set(q.k, v); });
    x.setActive(d ? !!d.on : false);
  });
  bus.emit('rig:refresh');
}
function rigLerp(a, b, t) {
  const o = { order: b.order, u: {} };
  RIG.order.forEach(id => { const A = a.u[id] || {}, B = b.u[id] || {}, r = { on: t < .5 ? A.on : B.on }; FX[id].params.forEach(q => { const x = A[q.k], y = B[q.k]; r[q.k] = (q.type === 'knob' && typeof x === 'number' && typeof y === 'number') ? (q.log ? x * Math.pow(y / x, t) : lerp(x, y, t)) : (t < .5 ? x : y); }); if ((A.on || B.on)) r.on = 1; o.u[id] = r; });
  return o;
}
function rigMutate(amount = .15) {
  const s = rigSnapshot(); RIG.order.forEach(id => { if (!s.u[id].on) return; FX[id].params.forEach(q => { if (q.type !== 'knob') return; const span = q.max - q.min; s.u[id][q.k] = clamp(s.u[id][q.k] + (Math.random() * 2 - 1) * span * amount, q.min, q.max); }); }); return s;
}

/* ---------- factory presets ---------- */
const PRESETS = [
  { n: 'Crystal Clean', c: 'Clean', d: 'Glassy hi-fi clean, light plate', u: { comp: { on: 1, thr: -28, ratio: 3, makeup: 4, mix: .8 }, amp: { on: 1, model: 'Clean', gain: .16, treble: .58, master: .55 }, cab: { on: 1, type: '2x12 Combo', mic: .3 }, reverb: { on: 1, type: 'Plate', decay: 1.6, mix: .18 } } },
  { n: 'Lagoon Chorus', c: 'Clean', d: 'Wide chorus, dotted echo, hall air', u: { comp: { on: 1, thr: -30, ratio: 3 }, amp: { on: 1, model: 'Chime (Class-A)', gain: .22, treble: .6 }, cab: { on: 1, type: '2x12 Combo' }, chorus: { on: 1, rate: .6, depth: .6, mix: .55 }, delay: { on: 1, sync: '1/8 dotted', fb: .35, tone: 5000, mix: .22 }, reverb: { on: 1, type: 'Hall', decay: 2.8, mix: .25 } } },
  { n: 'Busker Corner', c: 'Acoustic', d: 'Street-corner acoustic: tight comp, bright body, small room', u: { comp: { on: 1, thr: -24, ratio: 3.5, atk: 8, makeup: 5 }, eq: { on: 1, hp: 90, b1: -2, b2: -3, b4: 2.5, b5: 3, lp: 13000 }, cab: { on: 1, type: 'Acoustic Body Sim', mix: .7 }, reverb: { on: 1, type: 'Room', decay: .9, mix: .14 } } },
  { n: 'Nylon Lullaby', c: 'Acoustic', d: 'Soft, dark and warm with long hall', u: { comp: { on: 1, thr: -26, ratio: 2.5, makeup: 3 }, eq: { on: 1, hp: 70, b3: -2, b4: -2, b5: -4, lp: 9000 }, reverb: { on: 1, type: 'Hall', decay: 3.2, damp: .65, mix: .3 } } },
  { n: 'Edge of Breakup', c: 'Crunch', d: 'Touch-sensitive; clean until you dig in', u: { amp: { on: 1, model: 'Crunch', gain: .3, mid: .55, master: .5 }, cab: { on: 1, type: '1x12 Open Back' }, reverb: { on: 1, type: 'Spring', decay: 1.4, mix: .15 } } },
  { n: 'Blues Singer', c: 'Crunch', d: 'Mid-hump overdrive into warm crunch, spring verb', u: { od: { on: 1, drive: .35, tone: .45, level: .5, body: 6 }, amp: { on: 1, model: 'Crunch', gain: .25, bass: .45, treble: .45 }, cab: { on: 1, type: '1x12 Open Back', mic: .4 }, reverb: { on: 1, type: 'Spring', decay: 1.8, mix: .2 } } },
  { n: 'Classic Crunch', c: 'Crunch', d: 'Roaring 4x12 rock rhythm', u: { gate: { on: 1, thresh: -60 }, amp: { on: 1, model: 'Crunch', gain: .55, mid: .6, pres: .55, master: .5, tight: .3 }, cab: { on: 1, type: '4x12 Closed' }, reverb: { on: 1, type: 'Room', decay: .8, mix: .1 } } },
  { n: 'Surf Rider', c: 'Clean', d: 'Drippy spring reverb and tremolo', u: { amp: { on: 1, model: 'Chime (Class-A)', gain: .2, treble: .65, bright: 1 }, cab: { on: 1, type: '1x12 Open Back' }, trem: { on: 1, rate: 5.5, depth: .55, shape: 'sine' }, reverb: { on: 1, type: 'Spring', decay: 2.4, mix: .5 } } },
  { n: 'Funk Quack', c: 'Funk', d: 'Compressed, bouncy pedal-wah rhythm', u: { comp: { on: 1, thr: -34, ratio: 6, atk: 4, makeup: 9 }, wah: { on: 1, mode: 'Pedal', pos: .5, q: 7, mix: 1 }, amp: { on: 1, model: 'Clean', gain: .15 }, cab: { on: 1, type: '2x12 Combo' } } },
  { n: 'Auto-Wah Groove', c: 'Funk', d: 'LFO wah locked to a slow groove', u: { comp: { on: 1, thr: -30, ratio: 4 }, wah: { on: 1, mode: 'Auto LFO', pos: .45, rate: 2.2, depth: .85, q: 8, mix: .9 }, amp: { on: 1, model: 'Clean', gain: .2 }, cab: { on: 1 } } },
  { n: 'Country Snap', c: 'Clean', d: 'Squash + slapback for chicken pickin', u: { comp: { on: 1, thr: -30, ratio: 6, atk: 3, makeup: 8 }, amp: { on: 1, model: 'Chime (Class-A)', gain: .22, treble: .62, bright: 1 }, cab: { on: 1, type: '1x12 Open Back' }, delay: { on: 1, time: 110, fb: .12, tone: 6000, mix: .25, spread: 0 }, reverb: { on: 1, type: 'Plate', decay: 1.1, mix: .12 } } },
  { n: 'Singing Lead', c: 'Lead', d: 'Boosted lead with sustain, echo and hall', u: { gate: { on: 1, thresh: -62 }, comp: { on: 1, thr: -30, ratio: 3, makeup: 4 }, od: { on: 1, drive: .4, tone: .55, level: .65, body: 7 }, amp: { on: 1, model: 'Lead', gain: .5, mid: .62, pres: .5, master: .45 }, cab: { on: 1, type: '4x12 Closed', mic: .25 }, delay: { on: 1, sync: '1/4', fb: .32, tone: 3800, mix: .25 }, reverb: { on: 1, type: 'Hall', decay: 2.6, mix: .22 } } },
  { n: 'Cosmic Lead', c: 'Lead', d: 'Heavy sustain, huge ambience', u: { comp: { on: 1, thr: -28, ratio: 4, makeup: 5 }, fuzz: { on: 1, fuzz: .5, bias: .35, tone: .55, level: .35 }, amp: { on: 1, model: 'Lead', gain: .38, mid: .55 }, cab: { on: 1, type: '2x12 Combo' }, delay: { on: 1, sync: '1/8 dotted', fb: .5, tone: 4200, mix: .35, spread: .7, mod: .3 }, reverb: { on: 1, type: 'Cathedral', decay: 5, mix: .3 } } },
  { n: 'Smooth Jazz', c: 'Clean', d: 'Dark neck pickup tone with soft verb', u: { comp: { on: 1, thr: -26, ratio: 2.5 }, amp: { on: 1, model: 'Clean', gain: .1, bass: .55, treble: .3, pres: .25 }, cab: { on: 1, type: '1x12 Open Back', mic: .7 }, reverb: { on: 1, type: 'Room', decay: 1.2, mix: .18 } } },
  { n: 'Tight Metal Rhythm', c: 'Heavy', d: 'Gated, tight, scooped hi-gain', u: { gate: { on: 1, thresh: -52, rel: 70, hold: 20 }, od: { on: 1, drive: .15, tone: .55, level: .8, body: 8 }, amp: { on: 1, model: 'Hi-Gain', gain: .62, mid: .38, treble: .58, pres: .55, master: .45, tight: .65 }, cab: { on: 1, type: '4x12 Closed', mic: .2 } } },
  { n: 'Doom Fuzz', c: 'Heavy', d: 'Thick, wall-of-sound sludge', u: { fuzz: { on: 1, fuzz: .85, bias: .5, tone: .4, level: .5 }, amp: { on: 1, model: 'Crunch', gain: .5, bass: .65, mid: .45 }, cab: { on: 1, type: '4x12 Closed', mic: .5 }, reverb: { on: 1, type: 'Room', decay: 1.4, mix: .15 } } },
  { n: 'Psych Haze', c: 'Psych', d: 'Phased fuzz, tape-ish echo, cloudy hall', u: { fuzz: { on: 1, fuzz: .55, bias: .45, tone: .5, level: .35 }, amp: { on: 1, model: 'Chime (Class-A)', gain: .3 }, cab: { on: 1 }, phaser: { on: 1, rate: .3, depth: .8, res: 3, mix: .7 }, delay: { on: 1, sync: '1/8 dotted', fb: .5, tone: 3500, mix: .35, mod: .5, spread: .6 }, reverb: { on: 1, type: 'Hall', decay: 3.8, mix: .35 } } },
  { n: 'Shimmer Cathedral', c: 'Ambient', d: 'Octave-up bloom into endless stone', u: { comp: { on: 1, thr: -26, ratio: 3 }, pitch: { on: 1, semi: 12, mix: .35, win: 70 }, amp: { on: 1, model: 'Clean', gain: .1 }, cab: { on: 1, type: 'Studio Flat' }, delay: { on: 1, sync: '1/4', fb: .4, tone: 5200, mix: .25 }, reverb: { on: 1, type: 'Ethereal', decay: 7, damp: .3, mix: .55 } } },
  { n: 'Octave-Down Pad', c: 'Ambient', d: 'Sub octave under swelling verb', u: { pitch: { on: 1, semi: -12, mix: .5 }, amp: { on: 1, model: 'Clean', gain: .12, bass: .6 }, cab: { on: 1, type: 'Studio Flat' }, chorus: { on: 1, rate: .3, depth: .7, mix: .5 }, reverb: { on: 1, type: 'Ethereal', decay: 6, mix: .5 } } },
  { n: 'Space Echo', c: 'Ambient', d: 'Long regenerating wobble echoes', u: { amp: { on: 1, model: 'Clean', gain: .18 }, cab: { on: 1 }, delay: { on: 1, time: 520, fb: .72, tone: 3200, mix: .5, mod: .6, spread: .5 }, reverb: { on: 1, type: 'Plate', decay: 3, mix: .3 } } },
  { n: 'Tape Wobble', c: 'Lo-Fi', d: 'Slow chorus drift and rolled-off highs', u: { comp: { on: 1, thr: -26, ratio: 3 }, eq: { on: 1, hp: 120, b5: -6, lp: 6500 }, chorus: { on: 1, rate: .25, depth: .8, mix: .8, dry: .3 }, amp: { on: 1, model: 'Clean', gain: .2 }, cab: { on: 1, type: '1x10 Vintage' }, reverb: { on: 1, type: 'Spring', decay: 1.6, mix: .2 } } },
  { n: 'Lo-Fi Radio', c: 'Lo-Fi', d: 'Band-limited transistor radio', u: { eq: { on: 1, hp: 380, lp: 3600, b3: 5 }, ds: { on: 1, drive: .2, tone: .4, level: .5, grit: .3 }, trem: { on: 1, rate: 3.5, depth: .25 } } },
  { n: 'Whammy Rise', c: 'Ambient', d: 'Octave-up with drive, sweep Shift with a MIDI pedal', u: { pitch: { on: 1, semi: 7, mix: .6 }, od: { on: 1, drive: .3, level: .5 }, amp: { on: 1, model: 'Crunch', gain: .3 }, cab: { on: 1 }, delay: { on: 1, sync: '1/4', fb: .3, mix: .2 } } },
  { n: 'Jet Flange', c: 'Psych', d: 'Through-zero style jet sweep', u: { amp: { on: 1, model: 'Crunch', gain: .4 }, cab: { on: 1, type: '4x12 Closed' }, flanger: { on: 1, rate: .12, depth: .9, manual: 2.5, fb: .7, mix: .7 }, reverb: { on: 1, type: 'Room', decay: 1, mix: .12 } } },
  { n: 'Skank Clean', c: 'Funk', d: 'Dry punchy clean for reggae offbeats', u: { comp: { on: 1, thr: -30, ratio: 4, atk: 3, makeup: 6 }, amp: { on: 1, model: 'Clean', gain: .12, treble: .55 }, cab: { on: 1, type: '1x12 Open Back' }, reverb: { on: 1, type: 'Spring', decay: .9, mix: .1 } } },
  { n: 'Island Strum', c: 'Acoustic', d: 'Shimmering open-tuned strum bed (try Taro Patch G)', u: { comp: { on: 1, thr: -28, ratio: 3, makeup: 4 }, eq: { on: 1, hp: 80, b2: -2, b4: 2, b5: 2.5 }, cab: { on: 1, type: 'Acoustic Body Sim', mix: .6 }, chorus: { on: 1, rate: .5, depth: .35, mix: .3 }, reverb: { on: 1, type: 'Hall', decay: 2.4, mix: .2 } } },
  { n: 'Direct (No FX)', c: 'Clean', d: 'Straight-through di signal', u: {} }
];
function loadPreset(p) {
  rigApply({ u: p.u }); RIG.cur = p.n; if (p.bpm) { S.bpm = p.bpm; commit(false); }
  bus.emit('preset', p.n);
}
