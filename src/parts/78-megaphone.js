/* ============================================================
   Part 78 · MEGAPHONE (2.30) — your vocal effects pedal drives the show
   A megaphone, radio or telephone voice effect pedal between your mic and the interface usually has no MIDI, but it
   changes your voice in a way that can be heard: the lows and the highs are cut away and the middle is pushed and dirtied. The studio
   listens to the vocal input for that sound, and while the pedal is on:
     · the stage and the Visuals turn gritty: red-hot colour, scan lines, a little shake (drawn into the picture itself, so the
       projector, stage videos and a window capture all show it)
     · the lights flash as you stomp it on (within the light comfort you chose)
     · the words in Perform and in the stream window go red and shake
   Settings ▸ Pedal & MIDI sync ▸ Megaphone pedal (folded away until you open it): switch it on, then teach it your voice: three seconds with the pedal off, three with it on. Without
   teaching it uses general settings that suit most megaphone sounds. Calm and reduced motion keep the colour and drop the shake.
   Only levels and the balance of lows, middle and highs are measured, a few times a second; nothing is recorded.
   ============================================================ */
CFG.mega = Object.assign({ on: false, model: null, stage: true, lights: true, words: true }, CFG.mega && typeof CFG.mega === 'object' ? CFG.mega : {});
const MEG = { on: false, tm: 0, buf: null, re: null, im: null, score: 0, voiced: false, up: 0, down: 0, quiet: 0, last: 0, feat: null, teach: null, t: 0 };
const MEG_DEFAULT = { off: [0, -18, .15], on: [-16, -32, .15], spread: [6, 6, 1] };      /* lows vs middle (dB), highs vs middle (dB), how noisy the middle is (left out until it is taught: voices differ too much) */

/* ---------- the sound ---------- */
/** power spectrum of a time block (radix-2, the block's length a power of two), with a Hann window */
function megSpectrum(x) {
  const n = x.length, re = new Float32Array(n), im = new Float32Array(n);
  for (let i = 0; i < n; i++) re[i] = x[i] * (.5 - .5 * Math.cos(2 * Math.PI * i / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const u = i + k, v = u + len / 2, tr = re[v] * cr - im[v] * ci, ti = re[v] * ci + im[v] * cr; re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
  const p = new Float32Array(n / 2); for (let i = 0; i < n / 2; i++) p[i] = re[i] * re[i] + im[i] * im[i]; return p;
}
/** [lows vs middle dB, highs vs middle dB, flatness of the middle] from a power spectrum; null when there is no voice */
function megFeatures(p, binHz, rms) {
  if (rms != null && rms < .006) return null; const band = (a, b) => { let s = 0; for (let i = Math.max(1, Math.round(a / binHz)); i <= Math.min(p.length - 1, Math.round(b / binHz)); i++) s += p[i]; return s; };
  const lo = band(80, 250), mid = band(300, 3400), hi = band(4500, Math.min(10000, binHz * (p.length - 1))); if (mid < 1e-9) return null;
  let lg = 0, ar = 0, n = 0; for (let i = Math.round(300 / binHz); i <= Math.round(3400 / binHz); i++) { lg += Math.log(p[i] + 1e-12); ar += p[i]; n++; }
  const flat = Math.exp(lg / n) / (ar / n + 1e-12);
  return [10 * Math.log10((lo + 1e-12) / mid), 10 * Math.log10((hi + 1e-12) / mid), flat];
}
/** how much a reading sounds like the pedal: 0 (clean voice) … 1 (megaphone), from the taught (or general) model */
function megScore(f, m) {
  if (!f) return null; m = m || CFG.mega.model || MEG_DEFAULT; const sp = m.spread || MEG_DEFAULT.spread, d = c => Math.sqrt(f.reduce((a, v, i) => a + ((v - c[i]) / sp[i]) ** 2, 0));
  const a = d(m.off), b = d(m.on); return a / (a + b + 1e-9);
}

/* ---------- listening ---------- */
const megSrc = () => (CFG.vin && CFG.vin !== 'off' && E.anaVox) ? E.anaVox : E.anaDI;
function megRead() {
  const an = megSrc(); if (!an || !E.hasInput) return null; const n = 2048; if (!MEG.buf || MEG.buf.length !== n) MEG.buf = new Float32Array(Math.max(n, an.fftSize));
  const b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b); const x = b.subarray(b.length - n); let e = 0; for (let i = 0; i < n; i++) e += x[i] * x[i];
  return megFeatures(megSpectrum(x), E.ctx.sampleRate / n, Math.sqrt(e / n));
}
/** one reading (features, or null for no voice) at time `now` (ms): on after 0.25 s of the pedal's sound, off after 0.6 s without it,
    and a pause in the singing keeps it as it was for four seconds */
function megStep(f, now) {
  const dt = Math.min(200, now - (MEG.last || now)); MEG.last = now; MEG.feat = f;
  if (MEG.teach) { if (f) MEG.teach.got.push(f); return; }
  if (MEG.force) { if (!MEG.on) megSet(true); return; }      /* the vocal board's Scream or Megaphone is on (part 79): the look stays until it goes off */
  if (!f) { MEG.quiet += dt; MEG.voiced = false; if (MEG.on && MEG.quiet > 4000) megSet(false); return; }
  MEG.quiet = 0; MEG.voiced = true; const s = megScore(f); MEG.score = MEG.score * .6 + s * .4;
  if (!MEG.on) { MEG.up = MEG.score > .62 ? MEG.up + dt : 0; if (MEG.up >= 250) megSet(true); }
  else { MEG.down = MEG.score < .45 ? MEG.down + dt : 0; if (MEG.down >= 600) megSet(false); }
}
function megSet(on) {
  if (on === MEG.on) return; MEG.on = on; MEG.up = 0; MEG.down = 0; MEG.t = performance.now(); document.body.classList.toggle('mega', on && CFG.mega.words);
  if (on && CFG.mega.lights && typeof LX !== 'undefined') { LX.strobeReq = true; LX.drop = Math.max(LX.drop || 0, .9); if (typeof SG !== 'undefined') SG.flash = 1; }
  megStream(); bus.emit('megaphone', on);
}
function megLoop(on) { clearInterval(MEG.tm); MEG.tm = 0; if (!on) { if (!MEG.force) megSet(false); return; } MEG.tm = setInterval(() => { if (!CFG.mega.on) return; megStep(megRead(), performance.now()); megPaint(); }, 60); }

/* ---------- teaching it your voice ---------- */
/** three seconds with the pedal off, then three with it on; the model is the middle of each, and how far apart they are */
async function megTeach(onTick) {
  if (!E.hasInput) { toast('Connect your vocal input first (Audio, top right), with the pedal between the mic and the interface.', 'warn'); return null; }
  const take = async (label, ms) => { MEG.teach = { got: [] }; onTick && onTick(label); await new Promise(r => setTimeout(r, ms)); const g = MEG.teach.got; MEG.teach = null; return g; };
  const was = MEG.tm; if (!was) megLoop(true); const off = await take('off', 3000), on = await take('on', 3000); if (!was) megLoop(false);
  return megLearn(off, on);
}
/** the model from two lists of readings; null (with a reason) when they cannot be told apart */
function megLearn(off, on) {
  const med = (a, i) => { const v = a.map(f => f[i]).sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  if (off.length < 8 || on.length < 8) { toast('Not enough singing was heard. Sing out through the whole three seconds, each time.', 'warn'); return null; }
  const A = [0, 1, 2].map(i => med(off, i)), B = [0, 1, 2].map(i => med(on, i)), floor = [1.5, 1.5, .03];
  const mad = (a, c, i) => { const v = a.map(f => Math.abs(f[i] - c)).sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  const sp = [0, 1, 2].map(i => Math.max(floor[i], 1.5 * Math.max(mad(off, A[i], i), mad(on, B[i], i))));      /* a measure that wobbles counts for less */
  const sep = Math.sqrt([0, 1].reduce((a, i) => a + ((A[i] - B[i]) / 6) ** 2, 0) + ((A[2] - B[2]) / .1) ** 2); if (sep < .8) { toast('The two sounded too alike to tell apart. Is the pedal between the mic and the interface, and on for the second part?', 'warn'); return null; }
  CFG.mega.model = { off: A, on: B, spread: sp, at: Date.now() }; saveCfg(); return CFG.mega.model;
}

/* ---------- the look ---------- */
/** drawn over the stage and the Visuals while the pedal is on: red-hot colour, scan lines, a jolt as it comes on */
function megDraw(g, W, H) {
  if (!MEG.on || !CFG.mega.stage) return; const t = performance.now(), age = (t - MEG.t) / 1000, calm = secretCalm();
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(255,120,90)'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(255,40,30,' + (calm ? .12 : .12 + .08 * Math.sin(t / 90)) + ')'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(0,0,0,.22)'; const step = Math.max(3, Math.round(H / 180)); for (let y = (calm ? 0 : Math.floor(t / 40) % step); y < H; y += step) g.fillRect(0, y, W, Math.max(1, step / 3));
  if (!calm && age < .35) { const k = 1 - age / .35; g.globalAlpha = .5 * k; g.drawImage(g.canvas, (Math.random() - .5) * W * .02 * k, (Math.random() - .5) * H * .02 * k); }
  g.restore();
}
function megStream() { try { if (typeof STRM !== 'undefined' && STRM.w && !STRM.w.closed) { const e = STRM.w.document.getElementById('sl'); if (e) { e.style.color = MEG.on && CFG.mega.words ? '#ff4b3e' : '#fff'; e.style.animation = MEG.on && CFG.mega.words && !secretCalm() ? 'megshake .12s steps(2) infinite' : ''; if (!STRM.w.document.getElementById('megk')) { const s = STRM.w.document.createElement('style'); s.id = 'megk'; s.textContent = '@keyframes megshake{0%{transform:translate(1px,-1px)}50%{transform:translate(-1px,1px)}}'; STRM.w.document.head.append(s); } } } } catch (e) { } }

/* ---------- Settings ▸ Pedal & MIDI sync ▸ Megaphone pedal (a fold-out: few people need it) ---------- */
function megDetails() {
  return h('details', { class: 'gear-more', id: 'megDetails', open: !!CFG.mega.on }, h('summary', {}, h('b', {}, '📢 Megaphone pedal'), h('span', { class: 'muted' }, ' · optional: the show reacts when a voice effect pedal is on')), megSettings());
}
function megPaint() { const b = document.getElementById('megLive'); if (!b) return; const s = MEG.voiced ? MEG.score : 0; b.style.setProperty('--s', s.toFixed(3)); b.querySelector('b').textContent = !E.hasInput ? 'No input connected' : MEG.on ? '📢 Megaphone' : MEG.voiced ? 'Clean voice' : 'Sing to test'; b.classList.toggle('on', MEG.on); }
function megSettings() {
  const chk = (k, label) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'meg-' + k, checked: !!CFG.mega[k], onchange: e => { CFG.mega[k] = e.target.checked; saveCfg(); if (k === 'on') megLoop(e.target.checked); if (k === 'words') document.body.classList.toggle('mega', MEG.on && CFG.mega.words); } }), label);
  const st = h('p', { class: 'hub-note', id: 'megTeachSt', role: 'status' }, CFG.mega.model ? 'Taught to your voice (' + new Date(CFG.mega.model.at).toLocaleDateString() + ').' : 'Using general settings. Teach it your voice for the best results.');
  return h('div', { class: 'meg' },
    chk('on', 'React to my megaphone pedal'),
    h('p', { class: 'hub-note' }, 'For any megaphone, radio or telephone voice effect pedal between your mic and the interface. While it is on, the stage and the Visuals turn gritty, the lights flash as you stomp it on, and the words in Perform and the stream window go red and shake. Only the balance of lows, middle and highs of the vocal input is measured; nothing is recorded.'),
    h('div', { class: 'meg-live', id: 'megLive', role: 'status', 'aria-live': 'polite' }, h('i'), h('b', {}, 'Sing to test')),
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn', id: 'megTeach', onclick: async e => { const b = e.currentTarget; b.disabled = true; const m = await megTeach(w => { st.textContent = w === 'off' ? '1 of 2: pedal OFF. Sing for three seconds…' : '2 of 2: pedal ON. Sing for three seconds…'; }); b.disabled = false; st.textContent = m ? 'Taught. Stomp it and sing: the box above follows you.' : 'Not taught: try again.'; } }, '🎓 Teach it my voice'),
      h('button', { class: 'btn', onclick: () => { CFG.mega.model = null; saveCfg(); st.textContent = 'Back to general settings.'; } }, 'Forget')), st,
    chk('stage', 'The stage and the Visuals turn gritty'), chk('lights', 'The lights flash as it comes on'), chk('words', 'The words go red and shake (Showtime, the stream window)'));
}
bus.on('audiostate', () => { if (CFG.mega.on && !MEG.tm) megLoop(true); });
if (CFG.mega.on) setTimeout(() => megLoop(true), 1500);
