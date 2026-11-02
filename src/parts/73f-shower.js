/* ============================================================
   Part 73f · SHOWER MODE (2.27) — a hidden singing companion, made for wet hands
   Not on any menu. It opens when you hold the logo for two seconds (phones too), type "shower" anywhere outside a text box, or
   type shower in the Backstage terminal. Once open it is one full screen with a handful of big buttons:
     · the songs you have saved with a track, one after another (◀ ▶), each playing straight into the next
     · the track's four stems: the singer (as recorded, a quiet guide or off), drums, bass, and the rest
     · ▶ / ⏸, and ● to record yourself; then ▶ to hear your take back over the music with a tiled-bathroom reverb, or 💾 to keep it
     · the words, large, when the song has them; a belt meter and a splash score while you record, for fun
   The band and the click are silent in here (T.quiet: playback only, no song is changed); everything is put back as it was when you leave, including the song you had open.
   The microphone is opened only when you press ●, with the browser's echo cancellation on, never played through the speakers, and
   closed when you leave. Your take stays in memory unless you save it (the voice with the steam, not the record).
   ============================================================ */
const SING = { mic: null, srcN: null, an: null, buf: null, f: [], last: 0, db: -99, m: null, ducked: 0, st: null };
const SHW = { el: null, q: [], i: -1, home: null, busy: false, paused: true, was: false, restore: null, mix0: null, wake: null, tm: 0, raf: 0,
  rec: null, take: null, takeBuf: null, card: null, hearing: 0, msg: '' };
const SING_BELT = -20, SING_VOICE = -46;      /* dBFS of the room microphone (automatic gain off): above SING_BELT is belting, below SING_VOICE is the shower */
const SING_TITLES = [
  [0, 'Rubber Duck Rookie', 'Everyone starts somewhere. Usually under the water.'],
  [35, 'Shampoo Soloist', 'Lather, rinse, sing it again.'],
  [55, 'Conditioner Crooner', 'Smooth. Silky. Slightly echoey.'],
  [72, 'Loofah Legend', 'The tiles have never sounded better.'],
  [86, 'Hot Water Heavyweight', 'The neighbours have stopped knocking and started requesting.']
];
CFG.shed.shw = Object.assign({ vox: 'guide', drums: true, bass: true, other: true }, CFG.shed.shw && typeof CFG.shed.shw === 'object' ? CFG.shed.shw : {});
const singNew = () => ({ voiced: 0, inKey: 0, longest: 0, hold: { m: null, t: 0 }, hi: null, lo: null, belt: 0, peak: -99, ducks: 0, secs: 0 });

/* ---------- the score: one reading of the voice (MIDI pitch or null, level in dBFS, seconds since the last reading) ---------- */
function singStep(m, db, dt) {
  const s = SING.st; if (!s) return; s.secs += dt; if (db > s.peak) s.peak = db;
  if (db > SING_BELT && m != null) s.belt += dt;
  if (m == null || db < SING_VOICE) { s.hold = { m: null, t: 0 }; SING.ducked = 0; return; }
  s.voiced += dt; const t = voxTarget(m); if (Math.abs(t.n - m) < .5) s.inKey += dt;
  if (s.hold.m != null && Math.abs(m - s.hold.m) < .6) { s.hold.t += dt; s.hold.m = s.hold.m * .9 + m * .1; } else { s.hold = { m, t: dt }; SING.ducked = 0; }
  if (s.hold.t > s.longest) s.longest = s.hold.t;
  if (s.hold.t >= .3) { const r = Math.round(s.hold.m); if (s.hi == null || r > s.hi) s.hi = r; if (s.lo == null || r < s.lo) s.lo = r; }
  const d = Math.floor(s.hold.t / 4); if (d > SING.ducked) { SING.ducked = d; s.ducks++; shwQuack(); }      /* a rubber duck for every four seconds held */
}
/** the score out of 100, and the title that goes with it */
function singScore(st) {
  st = st || SING.st; if (!st || st.voiced < 1) return { score: 0, title: SING_TITLES[0][1], line: 'Not a peep. Is the phone on the other side of the curtain?', key: 0 };
  const key = st.inKey / st.voiced, score = Math.round(Math.min(100, 45 * key + 25 * Math.min(1, st.longest / 6) + 15 * Math.min(1, st.belt / 8) + 15 * Math.min(1, st.voiced / Math.max(8, st.secs * .35))));
  const t = [...SING_TITLES].reverse().find(x => score >= x[0]); return { score, title: t[1], line: t[2], key: Math.round(key * 100) };
}

/* ---------- the microphone: only while ● is on ---------- */
async function singMic() {
  if (SING.mic) return true; await startAudio();
  try { SING.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } }); }
  catch (e) { toast('The microphone is needed to record you. ' + (e && e.name === 'NotAllowedError' ? 'Allow it in the browser’s address bar, then try again.' : (e.message || e.name)), 'warn'); return false; }
  SING.srcN = E.ctx.createMediaStreamSource(SING.mic); SING.an = E.ctx.createAnalyser(); SING.an.fftSize = 2048; SING.srcN.connect(SING.an);   /* never connected to the speakers */
  return true;
}
function singMicOff() { try { SING.srcN && SING.srcN.disconnect(); } catch (e) { } try { SING.mic && SING.mic.getTracks().forEach(t => t.stop()); } catch (e) { } SING.mic = null; SING.srcN = null; SING.an = null; }
function singRead() {
  const an = SING.an; if (!an) return; const now = performance.now(), dt = Math.min(.12, (now - SING.last) / 1000); SING.last = now;
  if (!SING.buf || SING.buf.length !== an.fftSize) SING.buf = new Float32Array(an.fftSize); an.getFloatTimeDomainData(SING.buf);
  let e = 0; for (let i = 0; i < SING.buf.length; i++) e += SING.buf[i] * SING.buf[i]; const db = dB(Math.sqrt(e / SING.buf.length)); let m = null;
  if (db > SING_VOICE) { const r = yin(SING.buf, E.ctx.sampleRate, .15); if (r && r.f > 70 && r.f < 1300 && r.clarity > .7) { SING.f.push(r.f); if (SING.f.length > 3) SING.f.shift(); m = ftom(median(SING.f)); } else SING.f = []; } else SING.f = [];
  SING.db = db; SING.m = m; singStep(m, db, dt);
}

/* ---------- the steam: a small tiled room, bright early reflections, then a dense tail of about 1.3 s ---------- */
function singSteamIR(ctx) {
  const sr = ctx.sampleRate, n = Math.round(sr * 1.4), b = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let seed = 1234 + ch * 77; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
    for (let i = 0; i < n; i++) d[i] = rnd() * Math.exp(-i / (sr * .32)) * .5;
    [.003, .007, .011, .016, .023].forEach((t, k) => { const j = Math.round(t * sr) + ch * 17; if (j < n) d[j] += (k % 2 ? -.6 : .7) * (1 - k * .12); }); }
  return b;
}
/** the voice, through the steam, into ctx's `dest` from `at` (seconds on ctx's clock) */
function singSteamChain(ctx, buf, dest, at) {
  const src = ctx.createBufferSource(), dry = ctx.createGain(), wet = ctx.createGain(), cv = ctx.createConvolver(), hp = ctx.createBiquadFilter();
  src.buffer = buf; hp.type = 'highpass'; hp.frequency.value = 90; cv.buffer = singSteamIR(ctx); wet.gain.value = .55;
  src.connect(hp); hp.connect(dry); hp.connect(cv); cv.connect(wet); dry.connect(dest); wet.connect(dest); src.start(Math.max(ctx.currentTime, at)); return src;
}

/* ---------- the songs ---------- */
const shwOpenNow = () => !!(SHW.el && SHW.el.isConnected);
/** when the song started on the audio clock: the slot being scheduled, counted back to where playback began */
const shwT0 = () => T.next - (T.slot - T.startCursor) * slotDur();
const shwRec = () => SHW.q[SHW.i] && PRJ.list.find(r => r.id === SHW.q[SHW.i]);
/** the shower's stem choices on top of the song's own mix (put back when it leaves) */
function shwMixApply() {
  if (!STM.ch) return; const c = CFG.shed.shw, mx = STM.mix;
  mx[0].m = !c.drums; mx[1].m = !c.bass; mx[3].m = !c.other; mx[2].m = c.vox === 'off'; mx[2].g = c.vox === 'guide' ? .22 : 1; mx.forEach(m => { m.s = false; });
  try { spGains(); } catch (e) { }
}
function shwMixRestore() { if (SHW.mix0 && STM.ch) { STM.mix.forEach((m, i) => Object.assign(m, SHW.mix0[i])); try { spGains(); } catch (e) { } } SHW.mix0 = null; }
async function shwQueue() { await projRefresh(); SHW.q = PRJ.list.filter(r => r.track).map(r => r.id); }
/** go to song i of the queue: open it, wait for its stems, and play if asked */
async function shwGo(i, playNow) {
  if (SHW.busy || !SHW.q.length) return; i = (i + SHW.q.length) % SHW.q.length; SHW.busy = true; SHW.msg = 'Warming up the water…';
  try {
    if (SHW.rec) shwRecStop(); if (T.playing) stopPlay(true); SHW.paused = true; shwMixRestore(); SHW.i = i; shwPaint();
    const id = SHW.q[i]; if (PRJ.cur !== id) await projLoad(id);
    if (!STM.ch && PRJ.pending) await projRestoreTrack();
    for (let k = 0; k < 600 && STM.busy; k++) await new Promise(r => setTimeout(r, 100));
    SHW.mix0 = STM.mix.map(m => Object.assign({}, m)); shwMixApply(); T.quiet = true; T.loop = false; T.cursor = 0;
  } catch (e) { console.warn(e); }
  SHW.busy = false; SHW.msg = ''; shwPaint();
  if (playNow) await shwPlay(true);
}
async function shwPlay(on) {
  if (SHW.busy) return; const want = on == null ? !T.playing : on;
  if (!want) { if (T.playing) stopPlay(true); SHW.paused = true; if (SHW.rec) shwRecStop(); shwPaint(); return; }
  if (T.playing) return; if (typeof AK !== 'undefined' && AK.killed) { toast('Audio is stopped. Open Audio to resume.', 'warn'); return; }
  SHW.paused = false; SHW.hearing = 0; try { await play(); } catch (e) { } SHW.was = T.playing; shwPaint();      /* seen playing at once, so an early end still counts */
}
/** ◀: back to the top of this song if it has been playing a while, else the song before */
function shwPrev() { if (T.playing && playheadSlot() * slotDur() > 3) { stopPlay(true); T.cursor = 0; shwPlay(true); return; } shwGo(SHW.i - 1, T.playing || !SHW.paused); }
function shwNext() { shwGo(SHW.i + 1, T.playing || !SHW.paused); }
/** the stem buttons: the singer cycles as recorded → quiet guide → off; the others are on or off */
function shwStem(k) {
  const c = CFG.shed.shw; if (k === 'vox') c.vox = { orig: 'guide', guide: 'off', off: 'orig' }[c.vox] || 'guide'; else c[k] = !c[k];
  saveCfg(); shwMixApply(); shwPaint();
}

/* ---------- recording yourself ---------- */
async function shwRecToggle() {
  if (SHW.rec) { shwRecStop(); return; } if (SHW.busy || !STM.ch) return; if (REC) { toast('The studio is recording. Stop it first.', 'warn'); return; }
  if (!(await singMic())) return; if (!T.playing) { T.cursor = Math.max(0, T.cursor); await shwPlay(true); } if (!T.playing) return;
  let mr; try { mr = new MediaRecorder(SING.mic); } catch (e) { toast('This browser cannot record here.', 'warn'); return; }
  const t0 = E.ctx.currentTime, r = { mr, chunks: [], id: PRJ.cur, songSec: T.startCursor * slotDur() + (t0 - shwT0()), t0 };
  mr.ondataavailable = e => { if (e.data && e.data.size) r.chunks.push(e.data); }; mr.onstop = () => shwKeep(r); mr.start();
  SING.st = singNew(); SING.ducked = 0; SING.f = []; SING.last = performance.now(); SHW.rec = r; SHW.card = null; shwPaint();
}
function shwRecStop() {
  const r = SHW.rec; if (!r) return; SHW.rec = null; try { if (r.mr.state !== 'inactive') r.mr.stop(); } catch (e) { }
  SHW.card = singScore(); SHW.card.st = SING.st; shwPaint();
}
function shwKeep(r) { if (!r.chunks.length) return; SHW.take = { blob: new Blob(r.chunks, { type: r.chunks[0].type || 'audio/webm' }), id: r.id, songSec: r.songSec }; SHW.takeBuf = null; shwPaint(); }
async function shwTakeBuf() { if (SHW.takeBuf) return SHW.takeBuf; if (!SHW.take) return null; try { SHW.takeBuf = await E.ctx.decodeAudioData(await SHW.take.blob.arrayBuffer()); } catch (e) { SHW.takeBuf = null; } return SHW.takeBuf; }
/** your take over the music, from where you started, with the steam; it stops when your take does */
async function shwHear() {
  const tk = SHW.take, buf = await shwTakeBuf(); if (!tk || !buf) return; if (SHW.rec) shwRecStop();
  if (PRJ.cur !== tk.id) { const i = SHW.q.indexOf(tk.id); if (i < 0) return; await shwGo(i, false); }
  if (T.playing) stopPlay(true); T.cursor = Math.max(0, Math.floor(tk.songSec / slotDur())); SHW.paused = false; try { await play(); } catch (e) { } if (!T.playing) return;
  const lat = (E.ctx.baseLatency || 0) + (E.ctx.outputLatency || 0) + .02;        /* the microphone heard the song this much after it was played */
  SHW.hearSrc = singSteamChain(E.ctx, buf, E.mix, shwT0() + (tk.songSec - T.startCursor * slotDur()) - lat);
  const n = ++SHW.hearing; setTimeout(() => { if (SHW.hearing !== n) return; SHW.hearing = 0; if (T.playing) stopPlay(true); SHW.paused = true; shwPaint(); }, (buf.duration + .6) * 1000);
  shwPaint();
}
/** your voice with the steam, as a WAV file (the record is not in it: that is someone else's) */
async function shwSave() {
  const buf = await shwTakeBuf(); if (!buf) return;
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = buf.sampleRate, o = new OC(2, buf.length + Math.round(sr * 1.5), sr);
  singSteamChain(o, buf, o.destination, 0); const r = await o.startRendering(); const rec = PRJ.list.find(x => x.id === SHW.take.id);
  download(((rec && rec.title) || 'song').replace(/\W+/g, '_') + '_shower_take.wav', encodeWav([r.getChannelData(0), r.getChannelData(1)], sr, 16)); toast('Saved your shower take to this device. 🚿', 'ok');
}

/* ---------- adding a song from in here ---------- */
async function shwAdd(file) {
  if (!file || SHW.busy) return; SHW.busy = true; SHW.msg = 'Getting the track ready (splitting off the singer)…'; shwPaint();
  try { if (T.playing) stopPlay(true); shwMixRestore(); await projCreate('blank', { form: 'empty' }); await stemLoad(file); for (let k = 0; k < 900 && STM.busy; k++) await new Promise(r => setTimeout(r, 100)); await projSave(); await shwQueue(); }
  catch (e) { console.warn(e); }
  SHW.busy = false; SHW.msg = ''; const i = SHW.q.indexOf(PRJ.cur); if (i >= 0) { SHW.i = -1; await shwGo(i, false); } else shwPaint();
}

/* ---------- the screen ---------- */
function shwQuack() { const box = SHW.el && SHW.el.querySelector('.shw-steam'); if (!box || secretCalm()) return; const d = h('span', { class: 'shw-duck', 'aria-hidden': 'true' }, '🦆'); d.style.left = (15 + Math.random() * 70) + '%'; box.append(d); setTimeout(() => d.remove(), 2400); }
function shwPaint() {
  const d = SHW.el; if (!d) return; const q = (s) => d.querySelector(s), r = shwRec(), c = CFG.shed.shw, empty = !SHW.q.length;
  q('.shw-song').textContent = empty ? 'No songs with a track yet' : (r ? (r.title || 'Untitled') : S.title || '…'); q('.shw-pos').textContent = empty ? '' : (SHW.i + 1) + ' of ' + SHW.q.length + (r && r.track && r.track.artist ? ' · ' + r.track.artist : '');
  q('.shw-msg').textContent = SHW.msg; q('.shw-msg').hidden = !SHW.msg; q('.shw-empty').hidden = !empty || SHW.busy; q('.shw-words').hidden = empty;
  const vox = { orig: ['🎤', 'Singer'], guide: ['🎤', 'Guide'], off: ['🔇', 'Singer off'] }[c.vox] || ['🎤', 'Guide'];
  [['vox', vox[0], vox[1], c.vox !== 'off'], ['drums', '🥁', 'Drums', c.drums], ['bass', '🎸', 'Bass', c.bass], ['other', '🎹', 'The rest', c.other]].forEach(([k, ico, t, on]) => { const b = q('[data-stem="' + k + '"]'); b.querySelector('i').textContent = ico; b.querySelector('span').textContent = t; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('off', !on); b.disabled = empty || SHW.busy; });
  const pb = q('.shw-play'); pb.textContent = T.playing ? '⏸' : '▶'; pb.setAttribute('aria-label', T.playing ? 'Pause' : 'Play'); [pb, q('.shw-prev'), q('.shw-next')].forEach(b => { b.disabled = empty || SHW.busy; });
  const rb = q('.shw-rec'); rb.classList.toggle('on', !!SHW.rec); rb.setAttribute('aria-pressed', String(!!SHW.rec)); rb.setAttribute('aria-label', SHW.rec ? 'Stop recording' : 'Record yourself'); rb.disabled = empty || SHW.busy;
  const tk = q('.shw-take'); tk.innerHTML = ''; tk.hidden = !(SHW.card || SHW.take) || !!SHW.rec;
  if (!tk.hidden) { const c2 = SHW.card, st = c2 && c2.st;
    if (c2) tk.append(h('div', { class: 'shw-score' }, h('b', {}, String(c2.score)), h('span', {}, c2.title)), h('p', { class: 'shw-line' }, c2.line + (st && st.voiced >= 1 ? ' Longest note ' + st.longest.toFixed(1) + ' s · ' + c2.key + '% in the key · 🦆 ' + st.ducks : '')));
    tk.append(h('div', { class: 'shw-tb' }, h('button', { class: 'shw-sm', id: 'shwHear', disabled: !SHW.take, onclick: () => shwHear() }, '▶ Hear it, steamy'), h('button', { class: 'shw-sm', id: 'shwSave', disabled: !SHW.take, onclick: () => shwSave() }, '💾 Keep it'), h('button', { class: 'shw-sm', id: 'shwDrop', 'aria-label': 'Throw the take away', onclick: () => { SHW.take = null; SHW.takeBuf = null; SHW.card = null; shwPaint(); } }, '✕'))); }
}
function shwDraw() {
  const d = SHW.el; if (!d) return; const q = s => d.querySelector(s);
  const i = SHW.q.length ? perfInfo() : { lines: [], idx: -1 }, cur = i.idx >= 0 ? i.lines[i.idx] : '', nx = i.idx >= 0 ? i.lines[i.idx + 1] : i.lines[0];
  const big = cur || (i.lines.length ? '♪' : (SHW.q.length ? 'Sing it like nobody is listening.' : '')), k = big + '\u0001' + (nx || '');
  if (SHW.lk !== k) { SHW.lk = k; q('.shw-cur').textContent = big; q('.shw-nl').textContent = nx || ''; }
  const live = !!SHW.rec, lv = live ? clamp((SING.db + 60) / 54, 0, 1) : 0, mt = q('.shw-meter');
  mt.hidden = !live; mt.style.setProperty('--lv', lv.toFixed(3)); mt.setAttribute('aria-valuenow', String(Math.round(live ? SING.db : -60)));
  if (live) { const t = Math.max(0, E.ctx.currentTime - SHW.rec.t0); q('.shw-rec b').textContent = Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); } else q('.shw-rec b').textContent = '●';
  const box = q('.shw-steam'); if (live && box && !secretCalm() && Math.random() < lv * .5) { const b = h('i', { class: 'shw-bub', 'aria-hidden': 'true' }); b.style.left = (Math.random() * 100) + '%'; b.style.setProperty('--sz', (6 + lv * 22 * Math.random()).toFixed(0) + 'px'); box.append(b); setTimeout(() => b.remove(), 2600); }
}
/** every quarter second: the song ended on its own → the next one */
function shwTick() {
  if (!shwOpenNow()) return; if (SHW.rec) singRead();
  if (SHW.was && !T.playing && !SHW.paused && !SHW.busy && !SHW.hearing) { if (SHW.rec) shwRecStop(); if (SHW.i < SHW.q.length - 1) shwGo(SHW.i + 1, true); else { SHW.paused = true; toast('That’s the whole set. Towel time. 🧺', 'ok'); } }
  if (SHW.was !== T.playing) shwPaint(); SHW.was = T.playing;
}
async function showerOpen() {
  if (shwOpenNow()) return SHW.el; if (REC) { toast('The studio is recording. Stop it first.', 'warn'); return null; }
  const file = h('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.flac,.m4a,.ogg', hidden: true, onchange: e => { const f = e.target.files[0]; e.target.value = ''; shwAdd(f); } });
  const stem = k => h('button', { class: 'shw-stem', 'data-stem': k, 'aria-pressed': 'true', onclick: () => shwStem(k) }, h('i', { 'aria-hidden': 'true' }), h('span', {}));
  const d = h('dialog', { class: 'shw', id: 'shower', 'aria-label': 'Shower mode' },
    h('div', { class: 'shw-top' }, h('div', { class: 'shw-t' }, h('b', { class: 'shw-song' }), h('span', { class: 'shw-pos' })), h('button', { class: 'shw-sm shw-add', 'aria-label': 'Add a song', title: 'Add a song (its singer is split off on this device)', onclick: () => file.click() }, '＋'), file, h('button', { class: 'shw-sm shw-x', 'aria-label': 'Leave Shower mode', onclick: () => d.close() }, '✕')),
    h('div', { class: 'shw-words', 'aria-live': 'polite' }, h('div', { class: 'shw-steam', 'aria-hidden': 'true' }), h('div', { class: 'shw-cur' }), h('div', { class: 'shw-nl' }), h('div', { class: 'shw-meter', role: 'meter', 'aria-label': 'How loud you are singing', 'aria-valuemin': '-60', 'aria-valuemax': '0', 'aria-valuenow': '-60', hidden: true }, h('i'))),
    h('p', { class: 'shw-msg', role: 'status' }), h('div', { class: 'shw-empty' }, h('p', {}, 'Shower mode plays the songs you have saved with a track. Add one and the singer is split off on this device, so you can take over.'), h('button', { class: 'shw-big', onclick: () => file.click() }, '＋ Add a song')),
    h('div', { class: 'shw-take', role: 'status' }),
    h('div', { class: 'shw-stems', role: 'group', 'aria-label': 'What you hear' }, stem('vox'), stem('drums'), stem('bass'), stem('other')),
    h('div', { class: 'shw-tr' }, h('button', { class: 'shw-btn shw-prev', 'aria-label': 'Previous song', onclick: () => shwPrev() }, '⏮'), h('button', { class: 'shw-btn shw-play', onclick: () => shwPlay() }, '▶'), h('button', { class: 'shw-btn shw-next', 'aria-label': 'Next song', onclick: () => shwNext() }, '⏭'), h('button', { class: 'shw-btn shw-rec', onclick: () => shwRecToggle() }, h('b', {}, '●'))),
    h('p', { class: 'shw-fine' }, 'Not responsible for damage to electronic devices. Keep the phone out of the spray. The microphone opens only while ● is on, and nothing leaves this device.'));
  document.body.append(d); SHW.el = d; SHW.home = PRJ.cur; SHW.restore = { loop: T.loop }; SHW.take = null; SHW.takeBuf = null; SHW.card = null; SHW.i = -1; SHW.was = false; SHW.paused = true;
  if (T.playing) stopPlay(true); T.quiet = true; T.loop = false;      /* just the record in here: the band and the click are silent, and no song is changed */
  d.addEventListener('close', () => shwClose()); d.showModal();
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { SHW.wake = w; }).catch(() => { }); } catch (e) { }
  if (!CFG.shed.found) { CFG.shed.found = Date.now(); saveCfg(); toast('🚿 You found Shower mode. Not responsible for damage to electronic devices.', 'ok'); }
  clearInterval(SHW.tm); SHW.tm = setInterval(shwTick, 250); const loop = () => { if (!shwOpenNow()) return; shwDraw(); SHW.raf = requestAnimationFrame(loop); }; loop();
  shwPaint(); await shwQueue(); const at = SHW.q.indexOf(PRJ.cur);
  if (SHW.q.length) await shwGo(at >= 0 ? at : 0, false); else shwPaint();
  return d;
}
async function shwClose() {
  const d = SHW.el; if (!d) return; SHW.el = null; clearInterval(SHW.tm); cancelAnimationFrame(SHW.raf); SHW.hearing = 0;
  if (SHW.rec) { try { SHW.rec.mr.stop(); } catch (e) { } SHW.rec = null; } try { SHW.hearSrc && SHW.hearSrc.stop(); } catch (e) { } singMicOff();
  if (T.playing) stopPlay(true); shwMixRestore();
  const r = SHW.restore; SHW.restore = null; T.quiet = false; if (r) { T.loop = r.loop; try { syncTransport(); } catch (e) { } }
  try { SHW.wake && SHW.wake.release(); } catch (e) { } SHW.wake = null; d.remove();
  for (let k = 0; k < 600 && SHW.busy; k++) await new Promise(res => setTimeout(res, 100));
  if (SHW.home && PRJ.cur !== SHW.home) { try { await projLoad(SHW.home); } catch (e) { } }      /* back to the song you had open */
}

/* ---------- the ways in: hold the logo, or type "shower" ---------- */
{
  let hold = 0, x0 = 0, y0 = 0; const cancel = () => { clearTimeout(hold); hold = 0; const b = document.querySelector('header .brand'); if (b) b.classList.remove('shw-fog'); };
  document.addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('header .brand'); if (!b) return; x0 = e.clientX; y0 = e.clientY; clearTimeout(hold);
    setTimeout(() => { if (hold) b.classList.add('shw-fog'); }, 700); hold = setTimeout(() => { hold = 0; b.classList.remove('shw-fog'); showerOpen(); }, 2000); });
  document.addEventListener('pointermove', e => { if (hold && Math.hypot(e.clientX - x0, e.clientY - y0) > 12) cancel(); });
  ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => { if (hold) cancel(); }));
  document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('header .brand')) e.preventDefault(); });      /* a long press on a phone is ours, not the menu's */
  let typed = ''; window.addEventListener('keydown', e => {
    const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))) { typed = ''; return; }
    if (!/^[a-z]$/i.test(e.key)) { typed = ''; return; } typed = (typed + e.key.toLowerCase()).slice(-6);
    if (typed === 'shower') { typed = ''; e.preventDefault(); e.stopImmediatePropagation(); showerOpen(); }      /* the R that ends it does not arm recording */
  }, true);
}
