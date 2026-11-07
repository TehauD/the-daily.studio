/* ============================================================
   Part 73f · SHOWER MODE (2.27, the Shower set in 2.28) — a hidden singing companion, made for wet hands
   Not on any menu. It opens when you hold the logo for two seconds (phones too), type "shower" anywhere outside a text box, or
   type shower in the Backstage terminal. Once open it is one full screen with a handful of big buttons:
     · the Shower set: songs of your own, kept apart from your Songs. Add many at once (several files, a whole folder, or drag them
       in); a playlist file (.m3u, .m3u8, .pls) picked with them sets the order. With folder sync on, a "shower" folder inside the
       studio folder fills the set on every computer. Shuffle, repeat, reorder and remove in ☰.
     · ⏮ ▶/⏸ ⏭, each song straight into the next; the next song is split while this one plays, so there is no wait between songs
     · the track's four stems: the singer (as recorded, a quiet guide or off), drums, bass, and the rest
     · the words, when the music brings them: a timed .lrc file beside the song, words stored in the file (MP3, M4A, FLAC; timed or
       not), or a .txt beside it. Untimed words follow where the singer is heard in the track.
     · ● to record yourself; then ▶ to hear your take back over the music with a tiled-bathroom reverb, or 💾 to keep it
   The tracks play through the stems player directly. The song you had open, and its track, are set aside in memory and put back as
   they were when you leave (it is not saved, re-split or changed while you are in here). The band and the click are silent.
   The microphone is opened only when you press ●, with the browser's echo cancellation on, never played through the speakers, and
   closed when you leave. Your take stays in memory unless you save it (the voice with the steam, not the record).
   ============================================================ */
const SING = { mic: null, srcN: null, an: null, buf: null, f: [], last: 0, db: -99, m: null, ducked: 0, st: null };
const SHW = { el: null, set: null, play: [], k: -1, cur: null, prep: new Map(), stash: null, busy: false, paused: true, was: false, wake: null, tm: 0, raf: 0,
  rec: null, take: null, takeBuf: null, card: null, hearing: 0, msg: '', words: null, adding: false, sheet: false };
const SHW_AUDIO = /\.(mp3|m4a|aac|mp4|wav|flac|ogg|oga|opus|webm|aif|aiff)$/i, SHW_LIST = /\.(m3u8?|pls)$/i;
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

/* ---------- the Shower set: kept in this browser's IndexedDB, apart from your Songs ---------- */
const shwBlank = () => ({ v: 1, items: [], order: 'list', repeat: 'all', hidden: [] });
async function shwLoadSet() { let s = null; try { s = await pdbGet('blobs', 'shower/set'); } catch (e) { } SHW.set = Object.assign(shwBlank(), s && s.v ? s : {}); return SHW.set; }
async function shwSaveSet() { try { await pdbPut('blobs', JSON.parse(JSON.stringify(SHW.set)), 'shower/set'); } catch (e) { console.warn(e); } }
const shwItem = id => SHW.set && SHW.set.items.find(x => x.id === id);
const shwBase = n => String(n || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '').toLowerCase();
/** the order things play in: the set's own order, or shuffled (keeping the song that is on first) */
function shwOrder() {
  const ids = SHW.set.items.map(x => x.id); if (SHW.set.order === 'shuffle') { for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } if (SHW.cur && ids.includes(SHW.cur)) { ids.splice(ids.indexOf(SHW.cur), 1); ids.unshift(SHW.cur); } }
  SHW.play = ids; SHW.k = SHW.cur ? ids.indexOf(SHW.cur) : -1;
}

/* ---------- adding: many files, a folder, a playlist ---------- */
/** a playlist's entries, by file name (paths and file:// addresses both work) */
function shwPlaylist(text, kind) {
  const out = []; String(text).replace(/\r/g, '').split('\n').forEach(l => { l = l.trim(); if (!l) return; if (kind === 'pls') { const m = /^File\d+\s*=\s*(.+)$/i.exec(l); if (m) out.push(m[1]); } else if (l[0] !== '#') out.push(l); });
  return out.map(x => { try { return shwBase(decodeURIComponent(x.replace(/^file:\/\/\/?/i, ''))); } catch (e) { return shwBase(x); } });
}
/** files from a drop, folders included */
async function shwDropFiles(dt) {
  const out = [], items = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!items.length) return [...(dt.files || [])];
  const walk = async e => { if (e.isFile) { out.push(await new Promise(r => e.file(r, () => r(null)))); return; } if (!e.isDirectory) return; const rd = e.createReader(); for (;;) { const ents = await new Promise(r => rd.readEntries(r, () => r([]))); if (!ents.length) break; for (const x of ents) await walk(x); } };
  for (const e of items) await walk(e); return out.filter(Boolean);
}
/** add songs to the set: audio files, their .lrc / .txt words beside them, in a playlist's order when there is one. Returns how many were added */
async function shwAddFiles(files, o) {
  o = o || {}; files = [...files].filter(Boolean); const audio = files.filter(f => !SHW_LIST.test(f.name) && !/\.(lrc|txt)$/i.test(f.name) && (SHW_AUDIO.test(f.name) || /^audio\//.test(f.type)))      /* a playlist is typed audio/x-mpegurl: it is not a song */, side = new Map(); let order = null;
  for (const f of files) { const b = shwBase(f.name); if (/\.lrc$/i.test(f.name)) side.set(b + '.lrc', f); else if (/\.txt$/i.test(f.name)) side.set(b + '.txt', f); else if (SHW_LIST.test(f.name) && !order) order = shwPlaylist(await f.text(), /\.pls$/i.test(f.name) ? 'pls' : 'm3u'); }
  if (order) { const at = b => { const i = order.indexOf(b); return i < 0 ? 1e9 : i; }; audio.sort((x, y) => at(shwBase(x.name)) - at(shwBase(y.name)) || x.name.localeCompare(y.name)); } else audio.sort((x, y) => (x.webkitRelativePath || x.name).localeCompare(y.webkitRelativePath || y.name, undefined, { numeric: true }));
  if (!audio.length) { if (!o.quiet) toast('No songs in that: Shower mode takes MP3, M4A, WAV, FLAC and OGG files.', 'warn'); return 0; }
  const had = new Set(SHW.set.items.map(x => x.name + ':' + x.bytes)), hidden = new Set(SHW.set.hidden); let n = 0; SHW.adding = true;
  for (const f of audio) {
    if (had.has(f.name + ':' + f.size) || (o.folder && hidden.has(f.name))) continue; n++; SHW.msg = 'Adding ' + f.name + '…'; shwPaint();
    try {
      const buf = await f.arrayBuffer(), tg = readTags(buf, { lyrics: true }), np = nameParts(f.name), id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), b = shwBase(f.name);
      let lyr = null; const lrc = side.get(b + '.lrc'), txt = side.get(b + '.txt');
      if (lrc) { const l = lrcParse(await lrc.text()); if (l) lyr = { synced: l, from: 'lrc' }; }
      if (!lyr && tg.synced) lyr = { synced: tg.synced, from: 'file' };
      if (!lyr && tg.lyrics) lyr = { plain: tg.lyrics.trim(), from: 'file' };
      if (!lyr && txt) { const t = (await txt.text()).trim(); const l = lrcParse(t); lyr = l ? { synced: l, from: 'txt' } : t ? { plain: t, from: 'txt' } : null; }
      await pdbPut('blobs', { buf, type: f.type || 'audio/mpeg', name: f.name }, 'shower/a/' + id);
      SHW.set.items.push({ id, name: f.name, bytes: f.size, type: f.type || '', title: cleanTitle(tg.title || '') || np.title || f.name.replace(/\.[^.]+$/, ''), artist: tg.artist || np.artist || '', lyr, from: o.folder ? 'folder' : 'device', added: Date.now() });
      SHW.set.hidden = SHW.set.hidden.filter(x => x !== f.name);
      if (!o.folder) shwFolderPush(f, lrc || txt);
    } catch (e) { console.warn(e); n--; toast('Could not add ' + f.name, 'warn'); }
  }
  SHW.adding = false; SHW.msg = ''; await shwSaveSet(); const was = SHW.cur; shwOrder();
  if (n && !o.quiet) toast('Added ' + n + ' song' + (n === 1 ? '' : 's') + ' to the Shower set.', 'ok');
  if (!was && SHW.play.length && shwOpenNow()) await shwGo(0, false); else { shwNextReady(); shwPaint(); }
  return n;
}
/** with folder sync on, the set lives in a "shower" folder inside the studio folder too, so every computer has it */
const shwFolderOn = () => !!(CFG.sync && typeof SYNC !== 'undefined' && SYNC.dir && SYNC.perm === 'granted');
async function shwFolderPush(f, side) { if (!shwFolderOn()) return; try { await fsOpen(); await fsPut('shower/' + f.name, f); if (side) await fsPut('shower/' + side.name, side); } catch (e) { console.warn('[shower] folder', e); } }
async function shwFolderPull() {
  if (!shwFolderOn()) return 0; try { await fsOpen(); const fs = []; for (const e of await fsLs('shower')) if (e.h.kind === 'file') fs.push(await e.h.getFile()); return fs.length ? await shwAddFiles(fs, { folder: true, quiet: true }) : 0; } catch (e) { console.warn('[shower] folder', e); return 0; }
}
/** remove from the set on this device (a copy in the synced folder stays there, and does not come back here) */
async function shwRemove(id) {
  const it = shwItem(id); if (!it) return; if (SHW.cur === id) { if (STP.playing) spStop(); SHW.paused = true; }
  SHW.set.items = SHW.set.items.filter(x => x !== it); if (!SHW.set.hidden.includes(it.name)) SHW.set.hidden.push(it.name); SHW.prep.delete(id);
  try { await pdbDel('blobs', 'shower/a/' + id); } catch (e) { } await shwSaveSet();
  if (SHW.cur === id) { SHW.cur = null; shwOrder(); if (SHW.play.length) await shwGo(Math.min(SHW.k < 0 ? 0 : SHW.k, SHW.play.length - 1), false); else { shwUninstall(); shwPaint(); } } else { shwOrder(); shwPaint(); }
}
async function shwMove(id, d) { const a = SHW.set.items, i = a.findIndex(x => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; await shwSaveSet(); if (SHW.set.order !== 'shuffle') shwOrder(); shwNextReady(); shwPaint(); }

/* ---------- getting a song ready: decoded and split, the current one and the next, no more (each is about 30 MB a minute) ---------- */
function shwPrepare(id) {
  const had = SHW.prep.get(id); if (had) return had.p;
  const e = { p: null, v: null, pct: 0 }; SHW.prep.set(id, e);
  e.p = (async () => {
    const b = await pdbGet('blobs', 'shower/a/' + id); if (!b) throw new Error('missing'); await startAudio();
    const ab = await E.ctx.decodeAudioData(b.buf.slice(0)); let n = ab.length; const sr = ab.sampleRate; n = Math.min(n, Math.floor(sr * 600));
    const L = new Float32Array(n), R = new Float32Array(n); L.set(ab.getChannelData(0).subarray(0, n)); R.set((ab.numberOfChannels > 1 ? ab.getChannelData(1) : ab.getChannelData(0)).subarray(0, n));
    const r = await stemSeparate(L, R, sr, p => { e.pct = p; if (SHW.cur === id && SHW.busy) { SHW.msg = 'Warming up the water… ' + Math.round(p * 100) + '%'; shwPaint(); } });
    const an = stemAnalyze(r.feat, sr, n / sr); e.v = { ch: r.stems, an, sr, n, dur: n / sr }; return e.v;
  })(); e.p.catch(() => SHW.prep.delete(id)); return e.p;
}
function shwPrune() { const keep = new Set([SHW.cur, SHW.play[shwNextK()]]); for (const k of [...SHW.prep.keys()]) if (!keep.has(k)) SHW.prep.delete(k); }
function shwNextK() { const n = SHW.play.length; if (!n || SHW.k < 0) return -1; if (SHW.set.repeat === 'one') return SHW.k; return SHW.k + 1 < n ? SHW.k + 1 : SHW.set.repeat === 'all' ? 0 : -1; }
function shwNextReady() { const k = shwNextK(); if (k >= 0 && SHW.play[k] !== SHW.cur) shwPrepare(SHW.play[k]).then(() => { if (shwOpenNow()) shwPaint(); }, () => { }); shwPrune(); }      /* the ✓ by “next” when it is ready */
/** the words with times: a timed file as it is; plain words spread over the parts where the singer is heard */
function shwWords(it, v) {
  if (!it || !it.lyr) return null; if (it.lyr.synced) return it.lyr.synced;
  const lines = it.lyr.plain.replace(/\r/g, '').split('\n').map(x => x.trim()).filter(x => x && !/^\[[^\]]*\]$/.test(x)); if (!lines.length) return null;
  const an = v.an, pr = an && an.pres && an.pres[2], ws = an ? an.W / an.fps : .5; const on = []; if (pr) for (let w = 0; w < pr.length; w++) if (pr[w] > .5) on.push(w * ws);
  if (on.length < lines.length) { const d = v.dur; return lines.map((l, i) => [d * (.05 + .9 * i / lines.length), l]); }
  return lines.map((l, i) => [on[Math.floor(i * on.length / lines.length)], l]);
}
/** the player gets this song (the song you had open waits in SHW.stash) */
function shwInstall(it, v) {
  if (STP.playing) spStop(); Object.assign(STM, { ch: v.ch, an: v.an, feat: null, env: null, sr: v.sr, n: v.n, dur: v.dur, name: it.name, title: it.title, artist: it.artist, file: null, _saved: true, busy: false, loop: { on: false, a: null, b: null }, beatShift: 0, tempoMul: 1, fx: undefined });
  STM.mix = STMS.map(() => ({ g: 1, m: false, s: false })); STP.pos = 0; try { spEnsure(); spFx(); } catch (e) { } shwMixApply(); SHW.words = shwWords(it, v);
}
function shwUninstall() { if (STP.playing) spStop(); STM.ch = null; STM.an = null; STM.dur = 0; SHW.words = null; }
const SHW_KEEP = ['ch', 'an', 'feat', 'env', 'sr', 'n', 'dur', 'name', 'title', 'artist', 'file', '_saved', 'loop', 'beatShift', 'tempoMul', 'fx', 'mix', 'busy'];
function shwStashIt() { const o = {}; SHW_KEEP.forEach(k => { o[k] = STM[k]; }); o.pos = STP.pos; SHW.stash = o; }
function shwUnstash() { const o = SHW.stash; if (!o) return; if (STP.playing) spStop(); SHW_KEEP.forEach(k => { STM[k] = o[k]; }); STP.pos = o.pos || 0; SHW.stash = null; try { spFx(); spGains(); renderStems(); } catch (e) { } if (typeof TL !== 'undefined') TL.dirty = true; bus.emit('track'); }

/* ---------- playing ---------- */
const shwOpenNow = () => !!(SHW.el && SHW.el.isConnected);
/** the shower's stem choices, on the shower's own mix */
function shwMixApply() {
  if (!STM.ch) return; const c = CFG.shed.shw, mx = STM.mix;
  mx[0].m = !c.drums; mx[1].m = !c.bass; mx[3].m = !c.other; mx[2].m = c.vox === 'off'; mx[2].g = c.vox === 'guide' ? .22 : 1; mx.forEach(m => { m.s = false; });
  try { spGains(); } catch (e) { }
}
/** go to place k in the playing order; play it if asked */
async function shwGo(k, playNow) {
  const n = SHW.play.length; if (!n) return; k = ((k % n) + n) % n; const id = SHW.play[k], it = shwItem(id); if (!it) return;
  const tk = SHW.go = (SHW.go || 0) + 1; if (SHW.rec) shwRecStop(); if (STP.playing) spStop(); SHW.paused = true; SHW.k = k; SHW.cur = id; SHW.busy = true; SHW.hearing = 0;
  const e = SHW.prep.get(id); SHW.msg = e && e.v ? '' : 'Warming up the water…'; shwPaint();
  let v = null; try { v = await shwPrepare(id); } catch (x) { console.warn(x); }
  if (tk !== SHW.go || !shwOpenNow()) return;
  SHW.busy = false; SHW.msg = '';
  if (!v) { toast('Could not play “' + it.title + '”. Skipping it.', 'warn'); if (n > 1) return shwGo(k + 1, playNow); shwPaint(); return; }
  shwInstall(it, v); shwNextReady(); shwPaint(); if (playNow) await shwPlay(true);
}
async function shwPlay(on) {
  if (SHW.busy || !STM.ch || !SHW.stash) return; const want = on == null ? !STP.playing : on;
  if (!want) { if (STP.playing) spPause(); SHW.paused = true; if (SHW.rec) shwRecStop(); shwPaint(); return; }
  if (STP.playing) return; if (typeof AK !== 'undefined' && AK.killed) { toast('Audio is stopped. Open Audio to resume.', 'warn'); return; }
  SHW.paused = false; SHW.hearing = 0; await spPlay(null, STP.pos); SHW.was = STP.playing; shwPaint();      /* seen playing at once, so an early end still counts */
}
/** ⏮: back to the top of this song if it has been playing a while, else the song before */
function shwPrev() { if (STM.ch && spPos() > 3) { const was = STP.playing; STP.pos = 0; if (was) spPlay(null, 0); shwPaint(); return; } shwGo(SHW.k - 1, STP.playing || !SHW.paused); }
function shwNext() { shwGo(SHW.k + 1, STP.playing || !SHW.paused); }
/** the stem buttons: the singer cycles as recorded → quiet guide → off; the others are on or off */
function shwStem(k) {
  const c = CFG.shed.shw; if (k === 'vox') c.vox = { orig: 'guide', guide: 'off', off: 'orig' }[c.vox] || 'guide'; else c[k] = !c[k];
  saveCfg(); shwMixApply(); shwPaint();
}
async function shwMode(what) {
  if (what === 'shuffle') { SHW.set.order = SHW.set.order === 'shuffle' ? 'list' : 'shuffle'; shwOrder(); }
  else SHW.set.repeat = { all: 'one', one: 'off', off: 'all' }[SHW.set.repeat] || 'all';
  await shwSaveSet(); shwNextReady(); shwPaint();
}

/* ---------- recording yourself ---------- */
async function shwRecToggle() {
  if (SHW.rec) { shwRecStop(); return; } if (SHW.busy || !STM.ch || !SHW.stash) return; if (REC) { toast('The studio is recording. Stop it first.', 'warn'); return; }
  if (!(await singMic())) return; if (!STP.playing) await shwPlay(true); if (!STP.playing) return;
  let mr; try { mr = new MediaRecorder(SING.mic); } catch (e) { toast('This browser cannot record here.', 'warn'); return; }
  const r = { mr, chunks: [], id: SHW.cur, songSec: spPos(), t0: E.ctx.currentTime };
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
  if (SHW.cur !== tk.id) { const k = SHW.play.indexOf(tk.id); if (k < 0) return; await shwGo(k, false); }
  if (STP.playing) spStop(); SHW.paused = false; const n = ++SHW.hearing; await spPlay(null, tk.songSec); if (!STP.playing || !STP.segs.length) return;
  const lat = (E.ctx.baseLatency || 0) + (E.ctx.outputLatency || 0) + .02;        /* the microphone heard the song this much after it was played */
  SHW.hearSrc = singSteamChain(E.ctx, buf, E.mix, STP.segs[0].t - lat);
  setTimeout(() => { if (SHW.hearing !== n) return; SHW.hearing = 0; if (STP.playing) spPause(); SHW.paused = true; shwPaint(); }, (buf.duration + .6) * 1000);
  shwPaint();
}
/** your voice with the steam, as a WAV file (the record is not in it: that is someone else's) */
async function shwSave() {
  const buf = await shwTakeBuf(); if (!buf) return; const it = shwItem(SHW.take.id);
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = buf.sampleRate, o = new OC(2, buf.length + Math.round(sr * 1.5), sr);
  singSteamChain(o, buf, o.destination, 0); const r = await o.startRendering();
  download(((it && it.title) || 'song').replace(/\W+/g, '_') + '_shower_take.wav', encodeWav([r.getChannelData(0), r.getChannelData(1)], sr, 16)); toast('Saved your shower take to this device. 🚿', 'ok');
}

/* ---------- the screen ---------- */
function shwQuack() { const box = SHW.el && SHW.el.querySelector('.shw-steam'); if (!box || secretCalm()) return; const d = h('span', { class: 'shw-duck', 'aria-hidden': 'true' }, '🦆'); d.style.left = (15 + Math.random() * 70) + '%'; box.append(d); setTimeout(() => d.remove(), 2400); }
function shwSheet() {
  const box = SHW.el.querySelector('.shw-list'); if (!box) return; box.innerHTML = ''; const set = SHW.set;
  box.append(h('div', { class: 'shw-lh' }, h('b', {}, 'The Shower set · ' + set.items.length), h('span', { style: { flex: 1 } }), h('button', { class: 'shw-sm', 'aria-label': 'Close the list', onclick: () => { SHW.sheet = false; shwPaint(); } }, '✕')),
    h('div', { class: 'shw-tb' }, h('button', { class: 'shw-sm', id: 'shwShuffle', 'aria-pressed': String(set.order === 'shuffle'), onclick: () => shwMode('shuffle') }, '🔀 Shuffle'),
      h('button', { class: 'shw-sm', id: 'shwRepeat', onclick: () => shwMode('repeat') }, { all: '🔁 Repeat all', one: '🔂 Repeat one', off: '➡ Play once' }[set.repeat])));
  const ul = h('ol', { class: 'shw-ul' }); set.items.forEach((it, i) => ul.append(h('li', { class: it.id === SHW.cur ? 'on' : '' },
    h('button', { class: 'shw-li', onclick: () => { SHW.sheet = false; shwGo(SHW.play.indexOf(it.id), true); } }, h('b', {}, it.title), h('span', {}, (it.artist ? it.artist + ' · ' : '') + (it.lyr ? (it.lyr.synced ? '♪ timed words' : '♪ words') : 'no words') + (it.from === 'folder' ? ' · from the folder' : ''))),
    h('button', { class: 'shw-sm', 'aria-label': 'Move ' + it.title + ' up', disabled: i === 0, onclick: () => shwMove(it.id, -1) }, '↑'), h('button', { class: 'shw-sm', 'aria-label': 'Move ' + it.title + ' down', disabled: i === set.items.length - 1, onclick: () => shwMove(it.id, 1) }, '↓'),
    h('button', { class: 'shw-sm', 'aria-label': 'Remove ' + it.title, onclick: () => shwRemove(it.id) }, '✕'))));
  box.append(ul, h('div', { class: 'shw-tb' }, h('button', { class: 'shw-sm', onclick: () => SHW.el.querySelector('.shw-files').click() }, '＋ Songs'), h('button', { class: 'shw-sm', onclick: () => SHW.el.querySelector('.shw-dir').click() }, '＋ A folder')),
    h('p', { class: 'shw-fine' }, 'Pick a playlist file (.m3u, .pls) with the songs to keep its order. Words come from a .lrc or .txt file with the same name, or from the song file itself. ' + (shwFolderOn() ? 'Songs added here are also copied to the “shower” folder in your synced folder; removing one here leaves its copy there.' : 'With folder sync on (Settings), a “shower” folder in your studio folder fills this set on every computer.')));
}
function shwPaint() {
  const d = SHW.el; if (!d) return; const q = s => d.querySelector(s), it = shwItem(SHW.cur), empty = !SHW.set || !SHW.set.items.length, c = CFG.shed.shw, nk = shwNextK(), nx = nk >= 0 && nk !== SHW.k ? shwItem(SHW.play[nk]) : null, ne = nx && SHW.prep.get(nx.id);
  q('.shw-song').textContent = empty ? 'The Shower set is empty' : it ? it.title : '…';
  q('.shw-pos').textContent = empty ? '' : (SHW.k + 1) + ' of ' + SHW.play.length + (it && it.artist ? ' · ' + it.artist : '') + (nx ? ' · next: ' + nx.title + (ne && ne.v ? ' ✓' : '') : '') + (SHW.set.order === 'shuffle' ? ' · 🔀' : '') + (SHW.set.repeat === 'one' ? ' · 🔂' : '');
  q('.shw-msg').textContent = SHW.msg; q('.shw-msg').hidden = !SHW.msg; q('.shw-empty').hidden = !empty || SHW.adding; q('.shw-words').hidden = empty;
  const vox = { orig: ['🎤', 'Singer'], guide: ['🎤', 'Guide'], off: ['🔇', 'Singer off'] }[c.vox] || ['🎤', 'Guide'], off = empty || SHW.busy || !STM.ch;
  [['vox', vox[0], vox[1], c.vox !== 'off'], ['drums', '🥁', 'Drums', c.drums], ['bass', '🎸', 'Bass', c.bass], ['other', '🎹', 'The rest', c.other]].forEach(([k, ico, t, on]) => { const b = q('[data-stem="' + k + '"]'); b.querySelector('i').textContent = ico; b.querySelector('span').textContent = t; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('off', !on); b.disabled = off; });
  const pb = q('.shw-play'); pb.textContent = STP.playing ? '⏸' : '▶'; pb.setAttribute('aria-label', STP.playing ? 'Pause' : 'Play'); [pb, q('.shw-prev'), q('.shw-next')].forEach(b => { b.disabled = off; });
  const rb = q('.shw-rec'); rb.classList.toggle('on', !!SHW.rec); rb.setAttribute('aria-pressed', String(!!SHW.rec)); rb.setAttribute('aria-label', SHW.rec ? 'Stop recording' : 'Record yourself'); rb.disabled = off;
  q('.shw-set').disabled = empty; q('.shw-list').hidden = !SHW.sheet; if (SHW.sheet) shwSheet();
  const tk = q('.shw-take'); tk.innerHTML = ''; tk.hidden = !(SHW.card || SHW.take) || !!SHW.rec || SHW.sheet;
  if (!tk.hidden) { const c2 = SHW.card, st = c2 && c2.st;
    if (c2) tk.append(h('div', { class: 'shw-score' }, h('b', {}, String(c2.score)), h('span', {}, c2.title)), h('p', { class: 'shw-line' }, c2.line + (st && st.voiced >= 1 ? ' Longest note ' + st.longest.toFixed(1) + ' s · ' + c2.key + '% in the key · 🦆 ' + st.ducks : '')));
    tk.append(h('div', { class: 'shw-tb' }, h('button', { class: 'shw-sm', id: 'shwHear', disabled: !SHW.take, onclick: () => shwHear() }, '▶ Hear it, steamy'), h('button', { class: 'shw-sm', id: 'shwSave', disabled: !SHW.take, onclick: () => shwSave() }, '💾 Keep it'), h('button', { class: 'shw-sm', id: 'shwDrop', 'aria-label': 'Throw the take away', onclick: () => { SHW.take = null; SHW.takeBuf = null; SHW.card = null; shwPaint(); } }, '✕'))); }
}
function shwDraw() {
  const d = SHW.el; if (!d) return; const q = s => d.querySelector(s), it = shwItem(SHW.cur), W = SHW.words, pos = STM.ch && SHW.stash ? spPos() : 0;
  let big = '', nx = '';
  if (W && W.length) { let i = -1; for (let j = 0; j < W.length; j++) { if (W[j][0] <= pos + .25) i = j; else break; } big = i >= 0 ? W[i][1] || '♪' : '♪'; nx = (W[i + 1] && W[i + 1][1]) || ''; if (i < 0) nx = 'Coming up: ' + (W[0][1] || ''); }
  else if (it) { big = it.title; nx = 'No words for this one. Sing it like nobody is listening.'; }
  const k = big + '\u0001' + nx; if (SHW.lk !== k) { SHW.lk = k; q('.shw-cur').textContent = big; q('.shw-nl').textContent = nx; }
  const pr = q('.shw-prog'); if (pr) pr.style.setProperty('--p', STM.dur ? (pos / STM.dur).toFixed(4) : 0);
  const live = !!SHW.rec, lv = live ? clamp((SING.db + 60) / 54, 0, 1) : 0, mt = q('.shw-meter');
  mt.hidden = !live; mt.style.setProperty('--lv', lv.toFixed(3)); mt.setAttribute('aria-valuenow', String(Math.round(live ? SING.db : -60)));
  if (live) { const t = Math.max(0, E.ctx.currentTime - SHW.rec.t0); q('.shw-rec b').textContent = Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); } else q('.shw-rec b').textContent = '●';
  const box = q('.shw-steam'); if (live && box && !secretCalm() && Math.random() < lv * .5) { const b = h('i', { class: 'shw-bub', 'aria-hidden': 'true' }); b.style.left = (Math.random() * 100) + '%'; b.style.setProperty('--sz', (6 + lv * 22 * Math.random()).toFixed(0) + 'px'); box.append(b); setTimeout(() => b.remove(), 2600); }
}
/** every quarter second: the song ended on its own → the next one (or again, or the end of the set) */
function shwTick() {
  if (!shwOpenNow()) return; if (SHW.rec) singRead();
  if (SHW.was && !STP.playing && !SHW.paused && !SHW.busy && !SHW.hearing) {
    if (SHW.rec) shwRecStop(); const nk = shwNextK();
    if (nk === SHW.k) { STP.pos = 0; spPlay(null, 0).then(() => { SHW.was = STP.playing; }); }
    else if (nk >= 0) shwGo(nk, true); else { SHW.paused = true; toast('That’s the whole set. Towel time. 🧺', 'ok'); }
  }
  if (SHW.was !== STP.playing) shwPaint(); SHW.was = STP.playing;
}
async function showerOpen() {
  if (shwOpenNow()) return SHW.el; if (REC) { toast('The studio is recording. Stop it first.', 'warn'); return null; }
  if (STM.busy) { toast('A track is still being split. Try again in a moment.', 'warn'); return null; }
  const pick = (cls, extra) => h('input', Object.assign({ type: 'file', class: cls, multiple: true, accept: 'audio/*,.mp3,.m4a,.wav,.flac,.ogg,.lrc,.txt,.m3u,.m3u8,.pls', hidden: true, onchange: e => { const fs = [...e.target.files]; e.target.value = ''; shwAddFiles(fs); } }, extra || {}));
  const files = pick('shw-files'), dir = pick('shw-dir', { webkitdirectory: true });
  const stem = k => h('button', { class: 'shw-stem', 'data-stem': k, 'aria-pressed': 'true', onclick: () => shwStem(k) }, h('i', { 'aria-hidden': 'true' }), h('span', {}));
  const d = h('dialog', { class: 'shw', id: 'shower', 'aria-label': 'Shower mode' },
    h('div', { class: 'shw-top' }, h('div', { class: 'shw-t' }, h('b', { class: 'shw-song' }), h('span', { class: 'shw-pos' })),
      h('button', { class: 'shw-sm shw-set', 'aria-label': 'The Shower set: order, shuffle, repeat, add, remove', onclick: () => { SHW.sheet = !SHW.sheet; shwPaint(); } }, '☰'),
      h('button', { class: 'shw-sm shw-add', 'aria-label': 'Add songs', title: 'Add songs: several at once, with their .lrc words and a playlist if you have one', onclick: () => files.click() }, '＋'), files, dir,
      h('button', { class: 'shw-sm shw-x', 'aria-label': 'Leave Shower mode', onclick: () => d.close() }, '✕')),
    h('div', { class: 'shw-list', role: 'region', 'aria-label': 'The Shower set', hidden: true }),
    h('div', { class: 'shw-words', 'aria-live': 'polite' }, h('div', { class: 'shw-steam', 'aria-hidden': 'true' }), h('div', { class: 'shw-cur' }), h('div', { class: 'shw-nl' }), h('div', { class: 'shw-prog', 'aria-hidden': 'true' }), h('div', { class: 'shw-meter', role: 'meter', 'aria-label': 'How loud you are singing', 'aria-valuemin': '-60', 'aria-valuemax': '0', 'aria-valuenow': '-60', hidden: true }, h('i'))),
    h('p', { class: 'shw-msg', role: 'status' }),
    h('div', { class: 'shw-empty' }, h('p', {}, 'Your Shower set is songs of your own, kept apart from your Songs. Add a few, a whole folder, or drop them here. Their singer is split off on this device as they play, so you can take over.'), h('div', { class: 'shw-tb' }, h('button', { class: 'shw-big', onclick: () => files.click() }, '＋ Add songs'), h('button', { class: 'shw-big shw-big2', onclick: () => dir.click() }, '📁 A folder'))),
    h('div', { class: 'shw-take', role: 'status' }),
    h('div', { class: 'shw-stems', role: 'group', 'aria-label': 'What you hear' }, stem('vox'), stem('drums'), stem('bass'), stem('other')),
    h('div', { class: 'shw-tr' }, h('button', { class: 'shw-btn shw-prev', 'aria-label': 'Previous song', onclick: () => shwPrev() }, '⏮'), h('button', { class: 'shw-btn shw-play', onclick: () => shwPlay() }, '▶'), h('button', { class: 'shw-btn shw-next', 'aria-label': 'Next song', onclick: () => shwNext() }, '⏭'), h('button', { class: 'shw-btn shw-rec', onclick: () => shwRecToggle() }, h('b', {}, '●'))),
    h('p', { class: 'shw-fine' }, 'Not responsible for damage to electronic devices. Keep the phone out of the spray. The microphone opens only while ● is on, and nothing leaves this device.'));
  d.addEventListener('dragover', e => { e.preventDefault(); d.classList.add('shw-drop'); }); d.addEventListener('dragleave', e => { if (e.target === d) d.classList.remove('shw-drop'); });
  d.addEventListener('drop', async e => { e.preventDefault(); d.classList.remove('shw-drop'); shwAddFiles(await shwDropFiles(e.dataTransfer)); });
  document.body.append(d); SHW.el = d; SHW.take = null; SHW.takeBuf = null; SHW.card = null; SHW.k = -1; SHW.cur = null; SHW.was = false; SHW.paused = true; SHW.sheet = false; SHW.msg = '';
  if (T.playing) stopPlay(true); shwStashIt(); SHW.loop0 = T.loop; T.quiet = true; T.loop = false;      /* the open song and its track wait in memory; the band and the click are silent */
  d.addEventListener('close', () => shwClose()); d.showModal();
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { SHW.wake = w; }).catch(() => { }); } catch (e) { }
  if (!CFG.shed.found) { CFG.shed.found = Date.now(); saveCfg(); toast('🚿 You found Shower mode. Not responsible for damage to electronic devices.', 'ok'); }
  clearInterval(SHW.tm); SHW.tm = setInterval(shwTick, 250); const loop = () => { if (!shwOpenNow()) return; shwDraw(); SHW.raf = requestAnimationFrame(loop); }; loop();
  await shwLoadSet(); shwOrder(); shwPaint();
  if (SHW.play.length) await shwGo(0, false); else shwPaint();
  shwFolderPull().then(n => { if (n && shwOpenNow()) toast(n + ' song' + (n === 1 ? '' : 's') + ' came in from the shower folder.', 'ok'); });
  return d;
}
async function shwClose() {
  const d = SHW.el; if (!d) return; SHW.el = null; SHW.go = (SHW.go || 0) + 1; clearInterval(SHW.tm); cancelAnimationFrame(SHW.raf); SHW.hearing = 0; SHW.busy = false;
  if (SHW.rec) { try { SHW.rec.mr.stop(); } catch (e) { } SHW.rec = null; } try { SHW.hearSrc && SHW.hearSrc.stop(); } catch (e) { } singMicOff();
  shwUnstash(); SHW.prep.clear(); SHW.cur = null; T.quiet = false; T.loop = !!SHW.loop0; try { syncTransport(); } catch (e) { }
  try { SHW.wake && SHW.wake.release(); } catch (e) { } SHW.wake = null; d.remove();
}


