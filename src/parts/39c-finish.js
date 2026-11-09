/* ============================================================
   Part 39c · FINISH IT (2.57) — master the song and make its release package, on this device
   1. Sound: the premaster (the whole mix without the master section, part 46b) goes through a tone (Natural, Warm, Bright, or matched to a
      reference song you load), a gentle glue compressor, then gain and a look-ahead limiter until it reaches the loudness you choose
      (−14 LUFS for streaming, −16 for Apple Music, louder for clubs) with true peaks under −1 dBTP. Measured by BS.1770 (part 39).
      ▶ Before / After plays both at the same loudness, so you hear the tone and the dynamics, not just "louder".
   2. Credits and splits: everyone in the song's history (Writing together rounds, versions), with what they did and a share of the writing.
   3. The release package: the master (24-bit, and 16-bit 44.1 kHz with dither for distributors), the lyrics, the chord sheet, the
      credits and splits, a README with the loudness and the song's details, and the song itself, in a folder or one .zip.
   Reference matching: both songs' average spectrum (4096-point FFT over the whole song) is compared in eleven bands; the difference,
   smoothed, limited to ±6 dB and scaled by Amount, becomes eleven peaking filters. Nothing is uploaded: the reference stays on this device.
   ============================================================ */
const FIN = { ref: null, out: null, pre: null, play: null, bands: [40, 80, 160, 315, 630, 1250, 2500, 5000, 8000, 12000, 16000] };
const FIN_TARGETS = [[-14, '−14 LUFS · streaming (Spotify, YouTube, Tidal, Amazon)'], [-16, '−16 LUFS · Apple Music, podcasts'], [-11, '−11 LUFS · louder'], [-9, '−9 LUFS · club, very loud'], [0, 'No target · keep the dynamics, peaks safe']];
const finDb = x => 20 * Math.log10(Math.max(x, 1e-9)), finLin = d => Math.pow(10, d / 20);

/* ---------- the reference song's tone, and the mix's ---------- */
function finFft(re, im) {
  const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
}
/** average energy in FIN.bands (dB, relative to their mean), from up to 240 frames spread over the song */
function finTone(l, r, sr) {
  const N = 4096, frames = Math.max(1, Math.min(240, Math.floor(l.length / N))), step = Math.max(N, Math.floor((l.length - N) / frames)), pw = new Float64Array(N / 2), win = new Float32Array(N).map((_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (N - 1)));
  for (let f = 0, o = 0; f < frames && o + N <= l.length; f++, o += step) { const re = new Float32Array(N), im = new Float32Array(N); for (let i = 0; i < N; i++) re[i] = (l[o + i] + (r ? r[o + i] : l[o + i])) * .5 * win[i]; finFft(re, im); for (let k = 0; k < N / 2; k++) pw[k] += re[k] * re[k] + im[k] * im[k]; }
  const B = FIN.bands, e = B.map((fc, i) => { const lo = i ? Math.sqrt(B[i - 1] * fc) : fc / 1.41, hi = i < B.length - 1 ? Math.sqrt(fc * B[i + 1]) : Math.min(sr / 2, fc * 1.41); let s = 0, c = 0; for (let k = Math.max(1, Math.floor(lo * N / sr)); k <= Math.min(N / 2 - 1, Math.ceil(hi * N / sr)); k++) { s += pw[k]; c++; } return 10 * Math.log10(Math.max(s / Math.max(c, 1), 1e-20)); });
  const m = e.reduce((a, v) => a + v, 0) / e.length; return e.map(v => v - m);
}
/** the EQ that moves the mix's tone toward the reference: ±6 dB at most, smoothed, times amount (0..1) */
function finMatchEq(mix, ref, amount) {
  const d = ref.map((v, i) => v - mix[i]), sm = d.map((v, i) => (d[Math.max(0, i - 1)] + 2 * v + d[Math.min(d.length - 1, i + 1)]) / 4);
  return sm.map(v => clamp(v * amount, -6, 6));
}
async function finDecode(file) {
  const ab = await file.arrayBuffer(), c = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100, 44100), b = await c.decodeAudioData(ab);
  return { l: b.getChannelData(0), r: b.numberOfChannels > 1 ? b.getChannelData(1) : b.getChannelData(0), sr: b.sampleRate, name: file.name };
}

/* ---------- the master ---------- */
/** look-ahead brickwall limiter (stereo-linked): no sample over ceil; the gain falls over the look-ahead and recovers over `rel` */
function finLimit(l, r, sr, ceil, rel) {
  const n = l.length, la = Math.max(1, Math.round(sr * .0015)), need = new Float32Array(n), mn = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(l[i]), Math.abs(r[i])); need[i] = p > ceil ? ceil / p : 1; }
  const dq = new Int32Array(n); let h0 = 0, t0 = 0;      /* sliding minimum over the next la samples */
  for (let i = n - 1; i >= 0; i--) { while (t0 > h0 && need[dq[t0 - 1]] >= need[i]) t0--; dq[t0++] = i; while (dq[h0] > i + la) h0++; mn[i] = need[dq[h0]]; }
  const rc = 1 - Math.exp(-1 / ((rel || .06) * sr)); let acc = 0, g = 1, most = 1;
  for (let i = 0; i < n; i++) { acc += mn[i]; if (i >= la) acc -= mn[i - la]; const sm = acc / Math.min(i + 1, la), t = Math.min(sm, mn[i]); g = t < g ? t : g + (t - g) * rc; if (g > t) g = t; l[i] *= g; r[i] *= g; if (g < most) most = g; }
  return finDb(most);
}
/** premaster → tone and glue (offline graph) → gain and limiter, to the target; returns { l, r, sr, m (measure), gr (most gain reduction, dB) } */
async function finMaster(pre, o) {
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = pre.sr, n = pre.l.length, c = new OC(2, n, sr), b = c.createBuffer(2, n, sr); b.copyToChannel(pre.l, 0); b.copyToChannel(pre.r, 1);
  const src = c.createBufferSource(); src.buffer = b; let node = src; const add = x => { node.connect(x); node = x; };
  const p = (MST_PRE.find(x => x[0] === o.tone) || MST_PRE[0])[3];
  if (o.tone !== 'off' && o.tone !== 'match') { const lo = c.createBiquadFilter(); lo.type = 'lowshelf'; lo.frequency.value = 120; lo.gain.value = p.lo; add(lo); const hi = c.createBiquadFilter(); hi.type = 'highshelf'; hi.frequency.value = 6500; hi.gain.value = p.hi; add(hi); }
  if (o.eq) o.eq.forEach((g, i) => { if (Math.abs(g) < .1) return; const f = c.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = Math.min(FIN.bands[i], sr * .45); f.Q.value = 1.1; f.gain.value = g; add(f); });
  const glue = o.glue == null ? (o.tone === 'loud' ? .7 : .3) : o.glue; if (glue > 0) { const k = c.createDynamicsCompressor(); k.threshold.value = -8 - 14 * glue; k.ratio.value = 1.6 + 2.4 * glue; k.knee.value = 12; k.attack.value = .02; k.release.value = .25; add(k); const mk = c.createGain(); mk.gain.value = 1 + .5 * glue; add(mk); }
  node.connect(c.destination); src.start(); const out = await c.startRendering(), l = out.getChannelData(0).slice(), r = out.getChannelData(1).slice();
  const ceilTP = -1; let ceil = ceilTP - .5;
  if (o.target) {      /* gain toward the target, the limiter holding the peaks; measured again, as limiting lowers the loudness a little and may let an inter-sample peak through */
    const m0 = lufsMeasure(l, r, sr); if (!isFinite(m0.lufs)) throw new Error('The song is silent'); let g = Math.min(24, o.target - m0.lufs), best = null;
    for (let it = 0; it < 6; it++) {
      const a = l.map(v => v * finLin(g)), bb = r.map(v => v * finLin(g)), gr = finLimit(a, bb, sr, finLin(ceil), .08), mm = lufsMeasure(a, bb, sr); best = { l: a, r: bb, sr, m: mm, gr };
      if (mm.tp > ceilTP + .05) { ceil -= mm.tp - ceilTP + .1; continue; }
      if (Math.abs(mm.lufs - o.target) < .15 || g >= 24) break; g = Math.min(24, g + o.target - mm.lufs);
    }
    return best;
  }
  const gr = finLimit(l, r, sr, finLin(ceil), .08); return { l, r, sr, m: lufsMeasure(l, r, sr), gr };
}

/* ---------- before / after, at the same loudness ---------- */
function finStop() { const p = FIN.play; if (!p) return; try { p.a.stop(); p.b.stop(); } catch (e) { } FIN.play = null; const b = document.getElementById('finPlay'); if (b) b.textContent = '▶ Play'; }
async function finPlay(which, at) {
  await startAudio(); finStop(); const c = E.ctx, mk = x => { const b = c.createBuffer(2, x.l.length, x.sr); b.copyToChannel(x.l, 0); b.copyToChannel(x.r, 1); const s = c.createBufferSource(); s.buffer = b; return s; };
  const A = FIN.pre, B = FIN.out; if (!A || !B) return; const match = document.getElementById('finMatch') ? document.getElementById('finMatch').checked : true;
  const la = finLin(match ? Math.min(0, B.m.lufs - A.m.lufs) : 0), lb = finLin(match ? Math.min(0, A.m.lufs - B.m.lufs) : 0);      /* the louder one is turned down to the other */
  const a = mk(A), b = mk(B), ga = c.createGain(), gb = c.createGain(); ga.gain.value = which === 'a' ? la : 0; gb.gain.value = which === 'b' ? lb : 0; a.connect(ga); b.connect(gb); ga.connect(c.destination); gb.connect(c.destination);
  const t0 = c.currentTime + .05; a.start(t0, at || 0); b.start(t0, at || 0); FIN.play = { a, b, ga, gb, la, lb, t0, at: at || 0 }; a.onended = () => { if (FIN.play && FIN.play.a === a) finStop(); };
  const btn = document.getElementById('finPlay'); if (btn) btn.textContent = '■ Stop';
}
function finAB(which) { const p = FIN.play; document.querySelectorAll('#finAB button').forEach(x => x.classList.toggle('on', x.dataset.w === which)); FIN.which = which; if (!p) return; const c = E.ctx, t = c.currentTime; p.ga.gain.setTargetAtTime(which === 'a' ? p.la : 0, t, .01); p.gb.gain.setTargetAtTime(which === 'b' ? p.lb : 0, t, .01); }

/* ---------- credits and splits ---------- */
function finPeople() {
  const me = (CFG.slName || '').trim() || (S.artist && S.artist !== 'Your Name' ? S.artist : 'Me'), P = new Map(), add = (n, role) => { n = String(n || '').trim().slice(0, 40); if (!n || n === 'Someone') return; const x = P.get(n) || { n, words: false, music: false, perf: false, prod: false, did: new Set() }; if (role) x[role] = true; P.set(n, x); return x; };
  const m0 = add(me); Object.assign(m0, { words: true, music: true, perf: TAKES.length > 0, prod: true });
  ((S.collab && S.collab.hist) || []).forEach(([who, , what]) => { const x = add(who); if (!x) return; const w = String(what || ''); if (/word/i.test(w)) x.words = true; if (/chord|added|bar|band|beat|section|tempo|key/i.test(w)) x.music = true; if (w) x.did.add(w); });
  verList().forEach(v => { if (v.kind === 'round' && v.from) { const x = add(v.from); if (x && (v.takes || []).length) x.perf = true; } });
  const saved = (PRJ.rec && PRJ.rec.credits) || [], list = [...P.values()].map(x => { const s = saved.find(y => y.n === x.n); return s ? Object.assign({}, x, s, { did: x.did }) : x; });
  saved.forEach(s => { if (!list.some(x => x.n === s.n)) list.push(Object.assign({ did: new Set() }, s)); });
  const writers = list.filter(x => x.words || x.music); if (!saved.length) writers.forEach(x => { x.share = Math.round(1000 / writers.length) / 10; });
  return list;
}
const finCreditsTxt = (people, v) => [(S.title || 'Untitled') + (S.artist && S.artist !== 'Your Name' ? ' — ' + S.artist : ''), v ? 'Version: ' + v.n + ' (' + new Date(v.at).toLocaleDateString() + ')' : '', '',
  'CREDITS', ...people.map(x => '  ' + x.n + ': ' + [x.words ? 'words' : '', x.music ? 'music' : '', x.perf ? 'performance' : '', x.prod ? 'production' : ''].filter(Boolean).join(', ') + (x.did && x.did.size ? '  (' + [...x.did].slice(0, 4).join('; ') + ')' : '')), '',
  'WRITING SPLITS (songwriting share; agree them with everyone before release)', ...people.filter(x => x.share > 0).map(x => '  ' + x.n + ': ' + x.share + ' %'), '',
  'From the song’s history in the-daily.studio (Writing together rounds and versions). It records who changed what; it is not a contract.'].filter(v => v !== null).join('\n');
const finCsv = people => 'name,words,music,performance,production,writing_share_percent\n' + people.map(x => ['"' + x.n.replace(/"/g, '""') + '"', x.words ? 1 : 0, x.music ? 1 : 0, x.perf ? 1 : 0, x.prod ? 1 : 0, x.share || 0].join(',')).join('\n') + '\n';

/* ---------- the release package ---------- */
function finDither16(l, r) { const q = 1 / 32768, a = new Float32Array(l.length), b = new Float32Array(r.length); for (let i = 0; i < l.length; i++) { a[i] = l[i] + (Math.random() - Math.random()) * q; b[i] = r[i] + (Math.random() - Math.random()) * q; } return [a, b]; }
async function finTo44(x) { if (x.sr === 44100) return x; const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, n = Math.round(x.l.length * 44100 / x.sr), c = new OC(2, n, 44100), b = c.createBuffer(2, x.l.length, x.sr); b.copyToChannel(x.l, 0); b.copyToChannel(x.r, 1); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(); const o = await c.startRendering(); return { l: o.getChannelData(0), r: o.getChannelData(1), sr: 44100 }; }
const finLyrics = () => S.sections.filter(s => (s.lyrics || '').trim()).map(s => '[' + s.name + ']\n' + s.lyrics.trim()).join('\n\n') + '\n';
async function finPackage(o) {
  o = o || {}; const M = FIN.out; if (!M) throw new Error('Render the master first'); const people = o.people || finPeople(), title = lxSafe(S.title || 'Song');
  if (verChanged()) await verMark('Release ' + new Date().toLocaleDateString(), 'Mastered to ' + fmtLU(M.m.lufs) + ' LUFS', {});
  const v = verList().slice(-1)[0], files = [], put = (name, data) => files.push({ name, data: data instanceof Uint8Array ? data : new TextEncoder().encode(data) });
  put(title + ' - master (24-bit ' + Math.round(M.sr / 100) / 10 + ' kHz).wav', new Uint8Array(await encodeWav([M.l, M.r], M.sr, 24).arrayBuffer()));
  const m44 = await finTo44(M), [dl, dr] = finDither16(m44.l, m44.r); put(title + ' - master (16-bit 44.1 kHz, for distributors).wav', new Uint8Array(await encodeWav([dl, dr], 44100, 16).arrayBuffer()));
  if (S.sections.some(s => (s.lyrics || '').trim())) put('lyrics.txt', finLyrics());
  try { put('chord sheet.html', printSheetHtml('')); } catch (e) { }
  put('credits.txt', finCreditsTxt(people, v)); put('splits.csv', finCsv(people));
  try { const b = zipBuild(await projEntries(PRJ.cur, '')); put(title + '.daily-song.zip', new Uint8Array(await b.arrayBuffer())); } catch (e) { }
  put('README.txt', [title + (S.artist && S.artist !== 'Your Name' ? ' — ' + S.artist : ''), 'Release package from the-daily.studio ' + VERSION + ', ' + new Date().toLocaleString(), v ? 'Version: ' + v.n : '', '',
    'Loudness: ' + fmtLU(M.m.lufs) + ' LUFS integrated, true peak ' + fmtLU(M.m.tp) + ' dBTP' + (FIN.opt && FIN.opt.target ? ' (target ' + FIN.opt.target + ' LUFS)' : ' (no loudness target)'),
    'Tempo ' + S.bpm + ' BPM · ' + S.ts.join('/') + ' · Key ' + pcName(S.key, keyUsesFlats(S.key, S.minor)) + (S.minor ? ' minor' : ' major') + ' · Length ' + fmtT(M.l.length / M.sr), '',
    'For a distributor: upload the 16-bit 44.1 kHz master; most also take the 24-bit one. Paste lyrics.txt where they ask for lyrics.', 'You will need: cover art (3000 × 3000 px is the usual ask), an ISRC (most distributors give one), the release date, and the agreed splits (splits.csv).', '',
    'The .daily-song.zip opens the song again in the-daily.studio, with its takes.'].filter(x => x !== '').join('\n') + '\n');
  if (PRJ.rec) { PRJ.rec.credits = people.map(x => ({ n: x.n, words: x.words, music: x.music, perf: x.perf, prod: x.prod, share: x.share || 0 })); PRJ.rec.done = Date.now(); await projSave(); bus.emit('versions'); }
  if (o.where === 'folder') { const dir = o.dir || await lxPickFolder(); if (!dir) return null; let sub = dir; try { sub = await dir.getDirectoryHandle(title + ' (release ' + new Date().toISOString().slice(0, 10) + ')', { create: true }); } catch (e) { } for (const f of files) { const fh = await sub.getFileHandle(f.name, { create: true }), w = await fh.createWritable(); await w.write(f.data); await w.close(); } return { files: files.map(f => f.name), where: sub.name }; }
  const zf = new File([zipBuild(files)], title + ' - release.zip', { type: 'application/zip' }); FIN.zip = zf; if (!o.noDownload) download(zf.name, zf); return { files: files.map(f => f.name), zip: zf };
}

/* ---------- the window ---------- */
async function finOpen() {
  if (!ofrAvailable() && !(await startAudio().then(() => ofrAvailable()).catch(() => false))) return toast('This browser can’t render the song faster than it plays, so Finish it isn’t available here.', 'warn');
  const tgt = h('select', { class: 'in', id: 'finTarget' }, FIN_TARGETS.map(([v, t]) => h('option', { value: v, selected: v === (CFG.finTarget == null ? -14 : CFG.finTarget) }, t)));
  const tone = h('select', { class: 'in', id: 'finTone' }, [['off', 'Natural'], ['clean', 'Clean'], ['warm', 'Warm'], ['bright', 'Bright'], ['loud', 'Dense'], ['match', 'Match a reference song…']].map(([v, t]) => h('option', { value: v, selected: v === (CFG.finTone || 'clean') }, t)));
  const refIn = h('input', { type: 'file', id: 'finRef', accept: 'audio/*', hidden: true }), refSay = h('span', { class: 'tiny muted', id: 'finRefSay' }, FIN.ref ? FIN.ref.name : ''), amt = h('input', { type: 'range', id: 'finAmt', min: 0, max: 100, value: 60 });
  const refRow = h('div', { class: 'row fin-ref', hidden: tone.value !== 'match' }, h('button', { class: 'btn sm', type: 'button', onclick: () => refIn.click() }, '♪ Choose the reference…'), refSay, h('label', { class: 'small' }, 'Amount ', amt));
  refIn.addEventListener('change', async () => { const f = refIn.files[0]; if (!f) return; refSay.textContent = 'Reading ' + f.name + '…'; try { const d = await finDecode(f); FIN.ref = { name: f.name, tone: finTone(d.l, d.r, d.sr) }; refSay.textContent = '✓ ' + f.name + ' (stays on this device)'; } catch (e) { refSay.textContent = 'That file could not be read: ' + (e.message || e); } });
  tone.addEventListener('change', () => { refRow.hidden = tone.value !== 'match'; });
  const say = h('p', { class: 'small', id: 'finSay', role: 'status' }), fill = h('i'), bar = h('div', { class: 'rnd-bar', hidden: true }, fill);
  const ab = h('div', { class: 'fin-ab', id: 'finAB', hidden: true }, h('button', { class: 'btn', id: 'finPlay', type: 'button', onclick: () => FIN.play ? finStop() : finPlay(FIN.which || 'b', +(document.getElementById('finPos') || {}).value || 0) }, '▶ Play'),
    h('div', { class: 'seg' }, h('button', { type: 'button', 'data-w': 'a', onclick: () => finAB('a') }, 'Before'), h('button', { type: 'button', 'data-w': 'b', class: 'on', onclick: () => finAB('b') }, 'After')),
    h('input', { type: 'range', id: 'finPos', min: 0, max: 1, step: .1, value: 0, 'aria-label': 'Where to play from', onchange: e => { if (FIN.play) finPlay(FIN.which || 'b', +e.target.value); } }),
    h('label', { class: 'chk tiny' }, h('input', { type: 'checkbox', id: 'finMatch', checked: true, onchange: () => { if (FIN.play) finPlay(FIN.which || 'b', 0); } }), ' Same loudness (a fair comparison)'), h('p', { class: 'tiny muted', id: 'finNums' }));
  const go = h('button', { class: 'btn primary', id: 'finGo', type: 'button', onclick: async () => {
    go.disabled = true; finStop(); bar.hidden = false; CFG.finTarget = +tgt.value; CFG.finTone = tone.value; saveCfg();
    try {
      if (tone.value === 'match' && !FIN.ref) throw new Error('Choose the reference song first');
      say.textContent = 'Rendering the mix…'; const pre = await lxRender(null, p => { fill.style.width = Math.round(p * 60) + '%'; }); if (pre.peak < 1e-4) throw new Error('The song is silent');
      FIN.pre = { l: pre.l, r: pre.r, sr: pre.sr, m: lufsMeasure(pre.l, pre.r, pre.sr) }; say.textContent = 'Mastering…'; fill.style.width = '70%';
      const eq = tone.value === 'match' ? finMatchEq(finTone(pre.l, pre.r, pre.sr), FIN.ref.tone, +amt.value / 100) : null;
      FIN.opt = { target: +tgt.value || 0, tone: tone.value, eq }; FIN.out = await finMaster(FIN.pre, FIN.opt); fill.style.width = '100%';
      const M = FIN.out.m, P = FIN.pre.m; say.textContent = '✓ Mastered: ' + fmtLU(M.lufs) + ' LUFS, true peak ' + fmtLU(M.tp) + ' dBTP' + (FIN.out.gr < -.5 ? ' · the limiter took up to ' + fmtLU(-FIN.out.gr) + ' dB off the loudest peaks' : '') + '.';
      document.getElementById('finNums').textContent = 'Before: ' + fmtLU(P.lufs) + ' LUFS, peak ' + fmtLU(P.tp) + ' dBTP · After: ' + fmtLU(M.lufs) + ' LUFS, peak ' + fmtLU(M.tp) + ' dBTP' + (eq ? ' · tone matched: ' + FIN.bands.map((f, i) => (eq[i] >= 0 ? '+' : '') + eq[i].toFixed(1)).join(' ') + ' dB' : '');
      const pos = document.getElementById('finPos'); pos.max = (FIN.out.l.length / FIN.out.sr).toFixed(1); ab.hidden = false; step2.hidden = false;
    } catch (e) { if (!(e && e.cancelled)) say.textContent = 'It could not be mastered: ' + (e.message || e); } finally { go.disabled = false; setTimeout(() => { bar.hidden = true; }, 600); }
  } }, '✦ Master it');
  /* credits and splits */
  const people = finPeople(), rows = h('tbody'), sum = h('span', { class: 'tiny', id: 'finSum' });
  const reSum = () => { const t = people.reduce((a, x) => a + (+x.share || 0), 0); sum.textContent = 'Writing shares add up to ' + Math.round(t * 10) / 10 + ' %' + (Math.abs(t - 100) > .05 ? ' (they should make 100)' : ' ✓'); sum.style.color = Math.abs(t - 100) > .05 ? 'var(--warn,#c98a12)' : ''; };
  const paint = () => { rows.replaceChildren(...people.map(x => h('tr', {}, h('td', {}, h('input', { class: 'in', value: x.n, maxlength: 40, 'aria-label': 'Name', oninput: e => { x.n = e.target.value; } })),
    ...['words', 'music', 'perf', 'prod'].map(k => h('td', {}, h('input', { type: 'checkbox', checked: !!x[k], 'aria-label': k, onchange: e => { x[k] = e.target.checked; } }))),
    h('td', {}, h('input', { class: 'in fin-share', type: 'number', min: 0, max: 100, step: .1, value: x.share || 0, 'aria-label': 'Writing share for ' + x.n, oninput: e => { x.share = +e.target.value || 0; reSum(); } }))))); reSum(); };
  paint();
  const step2 = h('div', { class: 'fin-step', id: 'finStep2', hidden: true },
    h('h4', {}, '2 · Credits and splits'), h('p', { class: 'tiny muted' }, 'Everyone in this song’s history (rounds of Writing together, versions), with what they did. Agree the writing shares together before you release it.'),
    h('table', { class: 'fin-tab' }, h('thead', {}, h('tr', {}, ...['Name', 'Words', 'Music', 'Played', 'Produced', 'Writing %'].map(t => h('th', {}, t)))), rows),
    h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'btn sm', type: 'button', onclick: () => { people.push({ n: '', words: false, music: false, perf: false, prod: false, share: 0, did: new Set() }); paint(); } }, '＋ Someone'), sum),
    h('h4', {}, '3 · Share it, or release it'), h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', margin: '4px 0' } }, h('button', { class: 'btn', id: 'finDrop', type: 'button', title: 'Public for 7 days on the-daily.studio/drops, after the site’s owner has listened', onclick: () => drpOpen() }, '🌍 Drop it (7 days)…')),
    h('h4', {}, 'The release package'), h('p', { class: 'tiny muted' }, 'The master (24-bit, and 16-bit 44.1 kHz for distributors), the lyrics, the chord sheet, credits and splits, a README, and the song itself. It’s also kept as a version.'),
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
      typeof window.showDirectoryPicker === 'function' ? h('button', { class: 'btn', id: 'finPkgDir', type: 'button', onclick: async () => { const r = await finPackage({ people, where: 'folder' }).catch(e => { toast(e.message || String(e), 'bad'); return null; }); if (r) { pkgSay.textContent = '✓ ' + r.files.length + ' files in “' + r.where + '”.'; } } }, '📁 Into a folder…') : null,
      h('button', { class: 'btn primary', id: 'finPkg', type: 'button', onclick: async () => { const r = await finPackage({ people }).catch(e => { toast(e.message || String(e), 'bad'); return null; }); if (r) { pkgSay.textContent = '✓ ' + r.files.length + ' files in one .zip.'; pkgSay.after(lxChip(r.zip)); } } }, '📦 Make the release package')),
    (() => { const p = h('p', { class: 'small', id: 'finPkgSay' }); return p; })());
  const pkgSay = step2.querySelector('#finPkgSay');
  pdlg('finDlg', '✦ Finish “' + (S.title || 'Untitled') + '”', h('div', { class: 'fin' },
    h('h4', {}, '1 · The sound'), h('p', { class: 'tiny muted' }, 'Your mix, mastered here: a tone, a gentle glue, then the loudness you choose, with the peaks kept under −1 dBTP. Nothing is uploaded.'),
    h('div', { class: 'fin-grid' }, h('label', { class: 'small' }, 'Loudness', tgt), h('label', { class: 'small' }, 'Tone', tone)), refRow, refIn,
    h('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } }, go), bar, say, ab, step2), { wide: true, onclose: finStop });
}
