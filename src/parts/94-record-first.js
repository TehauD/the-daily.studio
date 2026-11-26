/* ============================================================
   Part 94 · RECORD FIRST (2.88) — Record is the first thing on the start screen, and a recording is a sample
   One big button on the start card opens a full-screen recorder over a living hexagon field (the start card's own canvas, kept alive behind the
   recorder: rings spread from the middle when you get loud). Stop, hear it, name it, keep it. What you keep is a SAMPLE, not a song: it goes on the
   Samples shelf (header 🎙, or "Your samples" on the start card) and can be used in any song as a Vocal or Guitar take at the playhead.
     · the microphone is opened only when you press Record (the first time, a short note says why), through the studio's own input and its errors
     · the recording is kept as it came in (16-bit, mono mix of the input), in this browser's own storage beside your songs; nothing is uploaded
     · the recorder takes the Space bar while it is open (stop, then Keep); Esc keeps what you have and closes it. Nothing is lost by accident
     · CFG.hexbg: 'on' (rings move with the sound), 'calm' (a still pattern) or 'off'. Reduced motion is always calm. The Control room never gets it
   Rooms (named spaces for a sample) and the Booth (the Shower's engine, repurposed) come next.
   ============================================================ */
const RCF = { items: [], loaded: false, el: null, st: '', tap: null, parts: [], n: 0, pk: 0, marks: [], bars: [], lvl: 0, paused: false, take: null, tick: 0, raf: 0, play: null, rings: [], emit: 0, hxT: 0, sure: null, asked: false };
const RCF_I = 'smp:i:', RCF_A = 'smp:a:', RCF_MAX = 600;      /* keys in the songs' blob store; the longest recording, in seconds */

/* ---------- the shelf, kept on this device ---------- */
async function rcfDb() { for (let i = 0; i < 40 && !PRJ.ready; i++) await new Promise(r => setTimeout(r, 100)); return !!PRJ.db; }
async function rcfLoad(force) {
  if (RCF.loaded && !force) return RCF.items; const out = [];
  if (await rcfDb()) try { for (const k of await pdbKeys('blobs', RCF_I)) { const m = await pdbGet('blobs', k); if (m && m.id) out.push(m); } } catch (e) { console.warn('samples', e); }
  out.sort((a, b) => b.t - a.t); RCF.items = out; RCF.loaded = true; rcfCount(); bus.emit('samples'); return out;
}
async function rcfSave(meta, pcm) {
  if (!(await rcfDb())) throw new Error('this browser will not let the studio keep recordings here');
  const a = toI16(pcm); meta.bytes = a.length * 2; await pdbPut('blobs', a, RCF_A + meta.id); await pdbPut('blobs', meta, RCF_I + meta.id);
  RCF.items = [meta].concat(RCF.items.filter(x => x.id !== meta.id)); rcfCount(); bus.emit('samples');
}
async function rcfPcm(id) { try { const a = await pdbGet('blobs', RCF_A + id); return a ? fromI16(a) : null; } catch (e) { return null; } }
async function rcfDel(id) { try { await pdbDel('blobs', RCF_A + id); await pdbDel('blobs', RCF_I + id); } catch (e) { console.warn(e); } RCF.items = RCF.items.filter(x => x.id !== id); rcfCount(); bus.emit('samples'); }
/** the start card says how many samples there are, once they are known */
function rcfCount() { const b = $('#bootSamples'); if (!b) return; b.hidden = !RCF.items.length; b.textContent = 'Your samples (' + RCF.items.length + ')'; }
const rcfStamp = () => { const d = new Date(), w = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()], hr = d.getHours(); return w + ' ' + ((hr + 11) % 12 + 1) + ':' + ('0' + d.getMinutes()).slice(-2) + (hr < 12 ? ' am' : ' pm'); };
const rcfLen = s => Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2);
const rcfBytes = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' kB';

/* ---------- the hexagon field (the start card's canvas, behind the recorder) ---------- */
function rcfHex(now) {
  RCF.hxT = requestAnimationFrame(rcfHex); const cv = $('#rfHex'); if (!cv) return cancelAnimationFrame(RCF.hxT);
  const mode = CFG.hexbg || 'on', calm = mode === 'calm' || CFG.reduce || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (mode === 'off') { const g0 = cv.getContext('2d'); g0.clearRect(0, 0, cv.width, cv.height); return; }
  if (document.hidden || now - (rcfHex.last || 0) < (calm ? 700 : 33)) return; rcfHex.last = now;
  const dpr = Math.min(1.5, window.devicePixelRatio || 1), W = cv.width = Math.floor(innerWidth * dpr), H = cv.height = Math.floor(innerHeight * dpr), g = cv.getContext('2d');
  const t = calm ? 0 : now / 1000, R = Math.max(26, Math.min(W, H) / 13), dx = R * Math.sqrt(3), dy = R * 1.5, cx = W / 2, cy = H * .44, maxd = Math.hypot(W, H) * .6;
  /* rings: loud sound while recording, the take while it plays, and a slow beat the rest of the time; a bigger room will make them longer (next) */
  if (!calm) {
    const lv = Math.min(1, RCF.lvl * 4), playing = !!RCF.play;
    if (RCF.st === 'rec' && !RCF.paused && lv > .35 && now - RCF.emit > 380) { RCF.rings.push({ t0: t, s: Math.min(1, lv + .15), life: 1.6 }); RCF.emit = now; }
    else if (playing && now - RCF.emit > 650) { RCF.rings.push({ t0: t, s: .8, life: 1.8 }); RCF.emit = now; }
    else if (!playing && RCF.st !== 'rec' && now - RCF.emit > 1900) { RCF.rings.push({ t0: t, s: .5, life: 2.6 }); RCF.emit = now; }
    RCF.rings = RCF.rings.filter(r => t - r.t0 < r.life); RCF.lvl *= .9;
  }
  g.clearRect(0, 0, W, H); const glow = g.createRadialGradient(cx, cy, 0, cx, cy, maxd); glow.addColorStop(0, 'rgba(61,220,132,.13)'); glow.addColorStop(.55, 'rgba(61,220,132,.03)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  const sc = W < 800 ? .55 : 1;
  for (let row = -1; row * dy < H + R; row++) for (let col = -1; col * dx < W + dx; col++) {
    const x = col * dx + (row & 1 ? dx / 2 : 0), y = row * dy, d = Math.hypot(x - cx, y - cy), fall = Math.max(0, 1 - d / maxd);
    let a = fall * fall * (.1 + (.5 + .5 * Math.sin(d * .011 - t * 1.2 + Math.sin(x * .004 + t * .3) * 2)) * .32);
    for (const r of RCF.rings) { const age = (t - r.t0) / r.life; a += Math.max(0, 1 - Math.abs(d - age * maxd * 1.05) / (R * 2.4)) * (1 - age) * r.s * (.35 + fall); }
    a = Math.min(1, a); const warm = ((col * 7 + row * 13) % 11) === 0;
    g.beginPath(); for (let i = 0; i < 6; i++) { const an = Math.PI / 6 + i * Math.PI / 3; g.lineTo(x + R * .9 * Math.cos(an), y + R * .9 * Math.sin(an)); } g.closePath();
    g.fillStyle = (warm ? 'rgba(242,182,50,' : 'rgba(61,220,132,') + (a * sc * (warm ? .34 : .26)).toFixed(3) + ')'; g.fill(); g.strokeStyle = 'rgba(125,191,155,' + (.04 + a * .4 * sc).toFixed(3) + ')'; g.lineWidth = 1; g.stroke();
  }
}

/* ---------- the recorder ---------- */
function rcfOpen() {
  if (RCF.el) return; RCF.st = ''; RCF.take = null; RCF.rings = [];
  RCF.el = h('div', { class: 'rf', id: 'rf', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Record a sample' }, h('canvas', { id: 'rfHex', 'aria-hidden': 'true' }), h('div', { class: 'rf-main', id: 'rfMain' }));
  document.body.append(RCF.el); document.addEventListener('keydown', rcfKey, true); RCF.hxT = requestAnimationFrame(rcfHex);
  if (!E.hasInput && !store.get('rfAsked', false)) { RCF.st = 'ask'; rcfDraw(); } else rcfBegin();
}
function rcfClose() {
  rcfPlayStop(); clearInterval(RCF.tick); if (RCF.tap) { try { RCF.tap.on(false); E.src.disconnect(RCF.tap.node); } catch (e) { } RCF.tap = null; }
  document.removeEventListener('keydown', rcfKey, true); cancelAnimationFrame(RCF.hxT); cancelAnimationFrame(RCF.raf); if (RCF.el) RCF.el.remove(); RCF.el = null; RCF.st = ''; RCF.take = null; RCF.parts = [];
}
function rcfKey(e) {
  if (!RCF.el) return; const t = e.target;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (RCF.st === 'rec') rcfStop(); else if (RCF.st === 'review') rcfKeep(false); else rcfClose(); return; }
  if (e.code === 'Space') {      /* while recording Space always stops (a button you pressed a moment ago, like Mark, must not take it); elsewhere it leaves a focused button or field alone */
    const typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName), onBtn = t && t.tagName === 'BUTTON'; if (typing || (onBtn && RCF.st !== 'rec')) return;
    e.preventDefault(); e.stopImmediatePropagation(); if (RCF.st === 'rec') rcfStop(); else if (RCF.st === 'review') rcfPlayToggle(); else if (RCF.st === '' || RCF.st === 'blocked') rcfBegin();
  }
}
async function rcfBegin() {
  RCF.st = 'wait'; rcfDraw(); store.set('rfAsked', true);
  try { await startAudio(); if (!E.hasInput) await pickInput(); } catch (e) { console.warn(e); }
  if (!RCF.el) return; if (!E.ctx || !E.hasInput || !E.src) { RCF.st = 'blocked'; return rcfDraw(); }
  if (E.ctx.state === 'suspended') { try { await E.ctx.resume(); } catch (e) { } }
  RCF.parts = []; RCF.n = 0; RCF.pk = 0; RCF.marks = []; RCF.bars = []; RCF.lvl = 0; RCF.paused = false; RCF.take = null;
  RCF.tap = makeTap(E.src, {}, m => {
    if (m.onset || !m.l || RCF.st !== 'rec' || RCF.paused) return; RCF.parts.push(m.l); RCF.n += m.l.length; let p = 0; for (let i = 0; i < m.l.length; i += 8) { const v = Math.abs(m.l[i]); if (v > p) p = v; }
    RCF.lvl = Math.max(RCF.lvl * .6, p); if (p > RCF.pk) RCF.pk = p; RCF.bars.push(p);
  });
  RCF.tap.on(true); RCF.st = 'rec'; rcfDraw(); RCF.tick = setInterval(rcfTick, 80);
}
function rcfTick() {
  if (RCF.st !== 'rec') return; const sr = E.ctx.sampleRate, s = RCF.n / sr, tm = $('#rfLcd'), lv = $('#rfLvl'), roll = $('#rfRoll');
  if (tm) tm.textContent = rcfLen(s); if (lv) lv.style.width = Math.min(100, RCF.lvl * 320) + '%';
  if (roll) { const c = roll.children, n = c.length; for (let i = 0; i < n; i++) { const b = RCF.bars[RCF.bars.length - n + i]; c[i].style.height = Math.max(3, Math.min(100, (b || 0) * 320)) + '%'; } }
  if (s >= RCF_MAX) { toast('That is ' + RCF_MAX / 60 + ' minutes: the longest one recording can be. It has been stopped and kept.', 'warn'); rcfStop(); }
}
function rcfStop() {
  if (RCF.st !== 'rec') return; clearInterval(RCF.tick); RCF.st = 'stopping'; if (RCF.tap) { try { RCF.tap.on(false); E.src.disconnect(RCF.tap.node); } catch (e) { } RCF.tap = null; }
  const sr = E.ctx.sampleRate, pcm = new Float32Array(RCF.n); let k = 0; for (const p of RCF.parts) { pcm.set(p, k); k += p.length; } RCF.parts = [];
  if (pcm.length < sr * .3 || RCF.pk < .002) { toast('Nothing was heard. Is the microphone on and its level up? Check Audio at the top right.', 'warn'); RCF.st = ''; return rcfBegin(); }
  const kind = CFG.me === 'guitar' ? 'gtr' : 'vox';
  RCF.take = { pcm, sr, dur: pcm.length / sr, kind, name: (kind === 'vox' ? 'Voice' : 'Instrument') + ' · ' + rcfStamp(), marks: RCF.marks.slice(), peaks: rcfPeaks(pcm, 360) }; RCF.st = 'review'; rcfDraw();
}
function rcfPeaks(pcm, n) { const o = new Float32Array(n), per = Math.max(1, Math.floor(pcm.length / n)); for (let i = 0; i < n; i++) { let m = 0; for (let k = i * per, e = Math.min(pcm.length, k + per); k < e; k += 4) { const v = Math.abs(pcm[k]); if (v > m) m = v; } o[i] = m; } let mx = 0; for (const v of o) if (v > mx) mx = v; if (mx > 0) for (let i = 0; i < n; i++) o[i] /= mx; return o; }
function rcfPlayStop() { if (RCF.play) { try { RCF.play.s.stop(); } catch (e) { } RCF.play = null; } cancelAnimationFrame(RCF.raf); const ph = $('#rfPh'); if (ph) ph.style.display = 'none'; const b = $('#rfPlay'); if (b) b.textContent = '▶ Play'; }
function rcfPlayToggle() {
  if (RCF.play) return rcfPlayStop(); const tk = RCF.take; if (!tk || !E.ctx) return;
  const b = E.ctx.createBuffer(1, tk.pcm.length, tk.sr); b.copyToChannel(tk.pcm, 0); const s = E.ctx.createBufferSource(); s.buffer = b; s.connect(E.master);
  s.onended = () => { if (RCF.play && RCF.play.s === s) rcfPlayStop(); }; s.start(); RCF.play = { s, t0: E.ctx.currentTime, dur: b.duration };
  const pb = $('#rfPlay'); if (pb) pb.textContent = '⏸ Pause';
  const step = () => { if (!RCF.play) return; const ph = $('#rfPh'); if (ph) { ph.style.display = 'block'; ph.style.left = Math.min(100, (E.ctx.currentTime - RCF.play.t0) / RCF.play.dur * 100) + '%'; } RCF.raf = requestAnimationFrame(step); }; step();
}
async function rcfKeep(then) {
  const tk = RCF.take; if (!tk) return rcfClose(); const nm = ($('#rfName') || {}).value || tk.name;
  const meta = { id: uid(), name: nm.trim().slice(0, 60) || tk.name, kind: tk.kind, sr: tk.sr, dur: tk.dur, marks: tk.marks, t: Date.now() };
  try { await rcfSave(meta, tk.pcm); } catch (e) { return toast('Could not keep it: ' + (e.message || e.name) + '. Use “Save a WAV” so it is not lost.', 'bad'); }
  rcfClose(); toast('Kept: “' + meta.name + '” is on your Samples shelf.', 'ok');
  if (then === 'use') rcfUse(meta.id); else if (then === 'shelf') rcfShelf();
}
function rcfSaveWav() { const tk = RCF.take; if (tk) download(((($('#rfName') || {}).value || tk.name).replace(/[\\/:*?"<>|]/g, '-')) + '.wav', new Blob([wavI16(toI16(tk.pcm), tk.sr)], { type: 'audio/wav' })); }

/* ---------- what the recorder shows ---------- */
function rcfDraw() {
  const m = $('#rfMain'); if (!m) return; m.textContent = '';
  const btn = (cls, txt, fn, extra) => h('button', Object.assign({ class: 'rf-btn ' + cls, type: 'button', onclick: fn }, extra || {}), txt);
  if (RCF.st === 'ask') {
    m.append(h('div', { class: 'rf-card' }, h('div', { class: 'rf-big', 'aria-hidden': 'true' }, '🎙'), h('h2', {}, 'One quick thing before we listen'),
      h('p', {}, 'The studio listens only while you record. Nothing leaves this device. Your browser will ask once: choose ', h('b', {}, 'Allow'), '.'),
      btn('rf-primary', 'Allow the microphone and record', () => rcfBegin()), btn('rf-ghost', 'Not now', rcfClose)));
  } else if (RCF.st === 'wait') {
    m.append(h('div', { class: 'rf-card' }, h('div', { class: 'rf-big', 'aria-hidden': 'true' }, '🎙'), h('h2', {}, 'Opening the microphone…'), h('p', {}, 'If your browser asks, choose Allow.')));
  } else if (RCF.st === 'blocked') {
    const hp = typeof ioPermHelp === 'function' ? ioPermHelp(E.lastInKind) : null;
    m.append(h('div', { class: 'rf-card' }, h('div', { class: 'rf-big', 'aria-hidden': 'true' }, '🔇'), h('h2', {}, hp ? hp.title : 'The microphone did not open'), h('p', {}, E.lastInErr || 'Check that a microphone is connected and allowed for this site.'),
      hp && hp.steps.length ? h('ol', {}, hp.steps.map(s => h('li', {}, s))) : null, btn('rf-primary', 'Try again', () => rcfBegin()), btn('rf-ghost', 'Close', rcfClose)));
  } else if (RCF.st === 'rec') {
    m.append(h('div', { class: 'rf-rec' }, h('div', { class: 'rf-top' }, h('span', { class: 'rf-live' + (RCF.paused ? ' paused' : '') }, h('i'), RCF.paused ? 'Paused' : 'Recording'), h('span', { class: 'rf-sub' }, 'Stays on this device')),
      h('div', { class: 'rf-mid' }, h('div', { class: 'rf-lcd', id: 'rfLcd', 'aria-live': 'off' }, rcfLen(RCF.n / E.ctx.sampleRate)), h('div', { class: 'rf-meter' }, h('i', { id: 'rfLvl' })), h('div', { class: 'rf-roll', id: 'rfRoll', 'aria-hidden': 'true' }, Array.from({ length: 56 }, () => h('span')))),
      h('div', { class: 'rf-ctl' }, h('div', { class: 'rf-side' }, h('button', { class: 'rf-circ', type: 'button', 'aria-label': 'Drop a marker', onclick: () => { RCF.marks.push(RCF.n / E.ctx.sampleRate); toast('Marker at ' + rcfLen(RCF.n / E.ctx.sampleRate)); } }, '⚑', h('span', {}, 'Mark'))),
        h('button', { class: 'rf-stop', type: 'button', 'aria-label': 'Stop', onclick: rcfStop }, h('i')), h('div', { class: 'rf-side' }, h('button', { class: 'rf-circ', type: 'button', 'aria-label': RCF.paused ? 'Resume' : 'Pause', onclick: () => { RCF.paused = !RCF.paused; rcfDraw(); } }, RCF.paused ? '▶' : '❚❚', h('span', {}, RCF.paused ? 'Resume' : 'Pause')))),
      h('p', { class: 'rf-tip' }, 'Space or the red button stops. Wear headphones if something else is playing.')));
  } else if (RCF.st === 'review') {
    const tk = RCF.take, cv = h('canvas', { class: 'rf-wave', width: 720, height: 120, 'aria-label': 'The recording' });
    m.append(h('div', { class: 'rf-card rf-wide' }, h('h2', {}, 'Got it. ' + rcfLen(tk.dur) + ' of you.'), h('p', {}, 'Hear it, name it, keep it. It goes on your Samples shelf, ready to use in any song.'),
      h('div', { class: 'rf-wavebox' }, cv, h('i', { class: 'rf-ph', id: 'rfPh' }), tk.marks.map(s => h('b', { class: 'rf-mk', style: { left: (s / tk.dur * 100) + '%' }, title: 'Marker at ' + rcfLen(s) }))),
      h('div', { class: 'rf-row' }, btn('rf-primary', '▶ Play', rcfPlayToggle, { id: 'rfPlay' }), btn('rf-ghost', 'Save a WAV', rcfSaveWav)),
      h('input', { class: 'rf-name', id: 'rfName', type: 'text', value: tk.name, maxlength: 60, 'aria-label': 'Name this sample' }),
      h('div', { class: 'rf-row rf-kinds', role: 'group', 'aria-label': 'What it is' }, [['vox', 'Voice'], ['gtr', 'Instrument']].map(([k, t]) => h('button', { class: 'rf-chip', type: 'button', 'aria-pressed': String(tk.kind === k), onclick: e => { tk.kind = k; $$('.rf-kinds .rf-chip').forEach(c => c.setAttribute('aria-pressed', String(c === e.currentTarget))); } }, t))),
      h('div', { class: 'rf-row' }, btn('rf-primary', 'Keep sample', () => rcfKeep('shelf')), btn('rf-main2', 'Keep and use in a song', () => rcfKeep('use'))),
      h('div', { class: 'rf-row' }, btn('rf-ghost', 'Record again', () => { rcfPlayStop(); RCF.take = null; rcfBegin(); }), RCF.sure === 'discard' ? btn('rf-danger', 'Sure? Discard it', () => { RCF.sure = null; rcfClose(); }) : btn('rf-ghost rf-warn', 'Discard', () => { RCF.sure = 'discard'; rcfDraw(); setTimeout(() => { if (RCF.sure === 'discard') { RCF.sure = null; if (RCF.st === 'review') rcfDraw(); } }, 4000); }))));
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, pk = tk.peaks; g.fillStyle = 'rgba(125,191,155,.9)'; for (let i = 0; i < pk.length; i++) { const hh = Math.max(2, pk[i] * (H - 10)), x = i * (W / pk.length); g.fillRect(x, (H - hh) / 2, Math.max(1, W / pk.length - 1.4), hh); }
  }
  const f = m.querySelector('button.rf-primary, .rf-stop'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { }
}

/* ---------- the shelf, and using a sample in a song ---------- */
async function rcfUse(id) {
  const m = RCF.items.find(x => x.id === id); if (!m) return; const pcm = await rcfPcm(id); if (!pcm) return toast('That sample could not be read.', 'warn');
  const dl = $('#rfShelf'); if (dl) { try { dl.close(); } catch (e) { } }
  if ($('#boot')) { const b = $('#bootNoMic'); if (b) b.click(); for (let i = 0; i < 30 && $('#boot'); i++) await new Promise(r => setTimeout(r, 100)); }
  const tk = takeAddPcm(pcm, m.sr, m.name, m.kind); if (tk && ZOOM.cur === 'canvas') zoomSet('song', true);
}
async function rcfPlaySample(id, btnEl) {
  if (RCF.play && RCF.play.id === id) { rcfPlayStop(); return; } rcfPlayStop(); const m = RCF.items.find(x => x.id === id), pcm = m && await rcfPcm(id); if (!pcm) return;
  if (!E.ctx) await startAudio(); if (!E.ctx) return; const b = E.ctx.createBuffer(1, pcm.length, m.sr); b.copyToChannel(pcm, 0); const s = E.ctx.createBufferSource(); s.buffer = b; s.connect(E.master);
  s.onended = () => { if (RCF.play && RCF.play.s === s) { RCF.play = null; if (btnEl) btnEl.textContent = '▶'; } }; s.start(); RCF.play = { s, id, t0: E.ctx.currentTime, dur: b.duration }; if (btnEl) btnEl.textContent = '■';
}
async function rcfShelf() {
  await rcfLoad(); const list = h('div', { class: 'rf-list' });
  const draw = () => {
    list.textContent = '';
    if (!RCF.items.length) list.append(h('div', { class: 'rf-empty' }, h('b', {}, 'Nothing recorded yet.'), h('span', { class: 'muted' }, 'A hum, a riff, a clap: press Record and it lands here, on this device.')));
    RCF.items.forEach(m => {
      const pb = h('button', { class: 'btn sm rf-pbtn', type: 'button', 'aria-label': 'Play ' + m.name, onclick: e => rcfPlaySample(m.id, e.currentTarget) }, '▶');
      const nm = h('input', { class: 'in rf-nm', type: 'text', value: m.name, maxlength: 60, 'aria-label': 'Name', onchange: async e => { m.name = e.target.value.trim().slice(0, 60) || m.name; e.target.value = m.name; try { await pdbPut('blobs', m, RCF_I + m.id); } catch (x) { } } });
      let sure = false; const del = h('button', { class: 'btn sm rf-del', type: 'button', onclick: async e => { if (!sure) { sure = true; e.currentTarget.textContent = 'Sure?'; setTimeout(() => { sure = false; e.currentTarget.textContent = 'Delete'; }, 3500); return; } rcfPlayStop(); await rcfDel(m.id); draw(); } }, 'Delete');
      list.append(h('div', { class: 'rf-item' }, pb, h('div', { class: 'rf-info' }, nm, h('span', { class: 'tiny muted' }, rcfLen(m.dur) + ' · ' + (m.kind === 'gtr' ? 'Instrument' : 'Voice') + ' · ' + rcfBytes(m.bytes || 0) + ' · ' + new Date(m.t).toLocaleDateString())),
        h('button', { class: 'btn sm primary', type: 'button', onclick: () => rcfUse(m.id) }, 'Use in a song'),
        h('button', { class: 'btn sm', type: 'button', onclick: async () => { const p = await rcfPcm(m.id); if (p) download(m.name.replace(/[\\/:*?"<>|]/g, '-') + '.wav', new Blob([wavI16(toI16(p), m.sr)], { type: 'audio/wav' })); } }, 'WAV'), del));
    });
  };
  draw(); const tot = RCF.items.reduce((a, m) => a + (m.bytes || 0), 0);
  pdlg('rfShelf', 'Samples', h('div', { class: 'rf-shelf' }, h('p', { class: 'muted' }, 'Recordings you have kept. Any of them can go into any song, as a Vocal or Guitar take where the playhead is.'),
    h('div', { class: 'row', style: { gap: '10px', margin: '0 0 12px' } }, h('button', { class: 'btn primary', type: 'button', onclick: () => { const d = $('#rfShelf'); if (d) d.close(); rcfOpen(); } }, '● Record'), h('span', { class: 'grow' }), h('span', { class: 'tiny muted' }, RCF.items.length + ' on this device · ' + rcfBytes(tot) + ' · never uploaded')), list), { onclose: rcfPlayStop });
}
document.addEventListener('DOMContentLoaded', () => { const b = $('#bootRec'); if (b) b.addEventListener('click', rcfOpen); const s = $('#bootSamples'); if (s) s.addEventListener('click', rcfShelf); rcfLoad().catch(() => { }); });
if (document.readyState !== 'loading') { const b = $('#bootRec'); if (b && !b._rf) { b._rf = 1; b.addEventListener('click', rcfOpen); } const s = $('#bootSamples'); if (s && !s._rf) { s._rf = 1; s.addEventListener('click', rcfShelf); } rcfLoad().catch(() => { }); }
