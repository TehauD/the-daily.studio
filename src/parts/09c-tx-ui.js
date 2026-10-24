/* ============================================================
   Part 09c · Transcribe pane — audio → tab (polyphonic), review, apply, consensus, self-test
   ============================================================ */
const TX = {
  src: '', file: null, res: null, rej: new Set(), busy: false, startBar: 1, tempo: 'song', shift: 0, cons: new Set(), auto: false, apply: 'replace', fillChords: true, bench: null, snapFirst: true, hover: null, lastMs: 0,
  p: Object.assign({ sens: .5, maxPoly: 6, grid: 1, offsetMs: 0, autoOffset: true, chordPrior: 1, camWeight: 1, techniques: true, legato: true, snapChord: true, minConf: 0 }, CFG.tx || {})
};
const txSave = () => { CFG.tx = TX.p; saveCfg(); };
const TXG = { 1: '16th', 2: '8th', 4: 'quarter' };

function txSource(id) {
  id = id || TX.src;
  if (id === 'file' && TX.file) return { id: 'file', name: TX.file.name, mono: TX.file.mono, sr: TX.file.sr, startSec: 0, cam: null, file: true };
  const tk = TAKES.find(t => t.id === id) || (id ? null : TAKES[TAKES.length - 1]); if (!tk) return null;
  return { id: tk.id, name: tk.name, mono: tk.dry || tk.wet, sr: tk.sr, startSec: tk.startSec, cam: tk.cam && tk.cam.length ? tk.cam : null, take: tk };
}
async function txImport(file) {
  try {
    toast('Decoding ' + file.name + '…'); const buf = await file.arrayBuffer(), AC = window.OfflineAudioContext || window.webkitOfflineAudioContext, c = new AC(1, 1, 44100), ab = await new Promise((res, rej) => c.decodeAudioData(buf, res, rej));
    const n = ab.length, mono = new Float32Array(n); for (let ch = 0; ch < ab.numberOfChannels; ch++) { const d = ab.getChannelData(ch); for (let i = 0; i < n; i++) mono[i] += d[i] / ab.numberOfChannels; }
    TX.file = { name: file.name, mono, sr: ab.sampleRate, dur: ab.duration }; TX.src = 'file'; toast('Loaded ' + file.name + ' (' + ab.duration.toFixed(1) + ' s)', 'ok'); txRefreshSrc();
  } catch (e) { console.error(e); toast('Could not decode that audio file: ' + (e.message || e), 'bad'); }
}
function txChordAt(k) {
  const N = spb(), bi = Math.floor(k / N); if (k < 0) return null; const fb = flatBars(), b = fb[bi]; if (!b) return null; const cs = barChords(b.bar); if (!cs.length) return null;
  return cs[Math.min(cs.length - 1, Math.floor((k % N) / N * cs.length))];
}
function txCx(src, startSec, dur) {
  return { tuning: S.tuning.slice(), capo: S.capo, maxFret: 22, a4: CFG.a4, slotDur: dur, swing: S.swing || 0, startSec, cam: src.cam, params: Object.assign({}, TX.p), voicings: sym => voicings(sym, S.tuning, S.capo, 9), chordAt: txChordAt, chordPrior: TX.p.chordPrior, camWeight: TX.p.camWeight };
}
async function txRun(srcs) {
  if (TX.busy) return; srcs = srcs.filter(Boolean); if (!srcs.length) return toast('Choose or record something to transcribe first', 'warn');
  TX.busy = true; txBusyUI(true); const t0 = performance.now(), results = [];
  try {
    for (let i = 0; i < srcs.length; i++) {
      const src = srcs[i]; let startSec = src.startSec, dur = slotDur(), tempoNote = '';
      if (src.file) {
        if (TX.tempo === 'detect') {
          txProg((i + .02) / srcs.length, 'Detecting tempo…'); await new Promise(r => setTimeout(r, 0)); const pp = txPrep(src.mono, src.sr), ons = txOnsets(pp.x, pp.fs, .65, false), tp = txTempo(ons);
          if (tp) { S.bpm = Math.round(tp.bpm * 10) / 10; commit(true); dur = slotDur(); startSec = -tp.phase; tempoNote = ' · tempo ' + S.bpm + ' BPM'; } else toast('Not enough onsets to detect a tempo — using the song tempo', 'warn');
        }
        if (TX.tempo !== 'detect' && TX.snapFirst) { txProg((i + .02) / srcs.length, 'Finding the first note…'); await new Promise(r => setTimeout(r, 0)); const pp = txPrep(src.mono, src.sr), ons = txOnsets(pp.x, pp.fs, .7, false); if (ons.length) startSec = -ons[0].t; }
        startSec += (TX.startBar - 1) * spb() * dur + TX.shift * dur;
      }
      const cx = txCx(src, startSec, dur), r = await txTranscribe(src.mono, src.sr, cx, (f, m) => txProg((i + f) / srcs.length, (srcs.length > 1 ? 'Take ' + (i + 1) + '/' + srcs.length + ' · ' : '') + m));
      r.src = src.name + tempoNote; results.push(r);
    }
    TX.res = results.length > 1 ? txConsensus(results) : results[0]; if (results.length > 1) TX.res.stats = Object.assign({}, TX.res.stats, { fs: results[0].stats.fs, tuneCents: mean(results.map(r => r.stats.tuneCents)), residAbs: mean(results.map(r => r.stats.residAbs)), residMean: mean(results.map(r => r.stats.residMean)), residSD: mean(results.map(r => r.stats.residSD).filter(isFinite)), meanConf: mean(TX.res.events.flatMap(e => e.notes.map(n => n.conf))) });
    TX.res.srcName = results.map(r => r.src).join(' + '); TX.lastMs = performance.now() - t0; TX.rej.clear(); TX.hover = null; txRender();
    const st = TX.res.stats; toast('Transcribed ' + st.notes + ' notes in ' + st.events + ' events (' + (TX.lastMs / 1000).toFixed(1) + ' s)', 'ok');
  } catch (e) { console.error(e); toast('Transcription failed: ' + (e.message || e), 'bad'); }
  TX.busy = false; txBusyUI(false);
}
function txGo() {
  const picked = TAKES.filter(t => TX.cons.has(t.id));
  if (picked.length > 1) return txRun(picked.map(t => txSource(t.id)));
  txRun([txSource()]);
}

/* ---------- apply to the song ---------- */
function txAccepted() {
  if (!TX.res) return []; const minc = TX.p.minConf;
  return TX.res.events.map(e => Object.assign({}, e, { notes: e.notes.filter(n => !TX.rej.has(e.k + ':' + n.midi) && n.conf >= minc) })).filter(e => e.notes.length && e.k >= 0);
}
function txApply() {
  const evs = txAccepted(); if (!evs.length) return toast('Nothing to apply — every note is rejected or below the confidence floor', 'warn');
  const N = spb(), b0 = Math.floor(evs[0].k / N), b1 = Math.floor(evs[evs.length - 1].k / N);
  if (!S.sections.length) S.sections.push(mkSection('Transcribed', ['']));
  while (flatBars().length <= b1) S.sections[S.sections.length - 1].bars.push(newBar(''));
  const bars = flatBars(); if (TX.apply === 'replace') for (let b = b0; b <= b1; b++) bars[b].bar.tab = [];
  let added = 0;
  evs.forEach(e => {
    const bar = bars[Math.floor(e.k / N)].bar, s = e.k % N;
    e.notes.forEach(n => {
      if (TX.apply === 'merge' && bar.tab.some(t => t.s === s && t.st === n.st)) return; bar.tab = bar.tab.filter(t => !(t.s === s && t.st === n.st));
      const o = { s, st: n.st, f: n.fret, t: n.tech || '' }; if (n.tech === 'b') o.bend = n.bendTo != null ? n.bendTo : n.fret + 2; bar.tab.push(o); added++;
    });
  });
  let named = 0;
  if (TX.fillChords) for (let b = b0; b <= b1; b++) {
    const bar = bars[b].bar; if (bar.chord) continue; const ns = []; evs.forEach(e => { if (Math.floor(e.k / N) === b) e.notes.forEach(n => ns.push({ midi: n.midi, rel: n.conf })); }); if (ns.length < 2) continue;
    const g = txGuess(ns)[0]; if (g) { bar.chord = pcName(g.r, keyUsesFlats(S.key, S.minor)) + g.q; named++; }
  }
  for (let b = b0; b <= b1; b++) bars[b].bar.tab.sort((a, c) => a.s - c.s || a.st - c.st);
  commit(true); toast('Applied ' + added + ' notes to bars ' + (b0 + 1) + '–' + (b1 + 1) + (named ? ' · named ' + named + ' chords' : '') + ' (Ctrl+Z undoes)', 'ok'); dockGo('tab');
}
function txAscii() {
  const evs = txAccepted(); if (!evs.length) return ''; const N = spb(), b0 = Math.floor(evs[0].k / N), b1 = Math.floor(evs[evs.length - 1].k / N), bars = [];
  for (let b = b0; b <= b1; b++) bars.push({ chord: '', tab: [] });
  evs.forEach(e => e.notes.forEach(n => { const o = { s: e.k % N, st: n.st, f: n.fret, t: n.tech || '' }; if (n.tech === 'b') o.bend = n.bendTo != null ? n.bendTo : n.fret + 2; bars[Math.floor(e.k / N) - b0].tab.push(o); }));
  return renderTabBars(bars, 68);
}

/* ---------- review canvas: six string lanes ---------- */
const TXV = { cw: 24, lane: 26, head: 22, pad: 6 };
function txRender() {
  txStats(); txDraw(); const pre = UI.txAscii; if (pre) pre.textContent = txAscii() || '(nothing accepted)';
  if (UI.txApplyBtn) UI.txApplyBtn.disabled = !TX.res;
}
function txDraw() {
  const cv = UI.txCv; if (!cv) return; const d = window.devicePixelRatio || 1, wrap = UI.txScroll; const res = TX.res;
  if (!res || !res.events.length) { cv.width = Math.max(10, wrap.clientWidth) * d; cv.height = 90 * d; const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = TL.col.muted; g.font = `${12 * d}px sans-serif`; g.fillText(res ? 'No notes found. Raise the sensitivity or check the input level.' : 'Transcription appears here — each note is placed on its string and fret, coloured by confidence.', 14 * d, 40 * d); cv.style.width = '100%'; cv.style.height = '90px'; return; }
  const N = spb(), evs = res.events, kmin = Math.floor(evs[0].k / N) * N, kmax = (Math.floor(evs[evs.length - 1].k / N) + 1) * N, W = Math.max(wrap.clientWidth, (kmax - kmin) * TXV.cw + 40), H = TXV.head + 6 * TXV.lane + TXV.pad;
  cv.width = W * d; cv.height = H * d; cv.style.width = W + 'px'; cv.style.height = H + 'px'; const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H);
  const C = TL.col, x0 = 28, lbl = tabLabels();
  g.font = '600 10px ui-monospace,monospace'; g.textBaseline = 'middle';
  for (let s = 0; s < 6; s++) { const y = TXV.head + (5 - s) * TXV.lane + TXV.lane / 2; g.fillStyle = s % 2 ? C.p2 : 'transparent'; g.fillRect(0, y - TXV.lane / 2, W, TXV.lane); g.strokeStyle = C.line2; g.beginPath(); g.moveTo(x0, y); g.lineTo(W, y); g.stroke(); g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText(lbl[5 - s] || '', 6, y); }
  for (let k = kmin; k <= kmax; k++) { const x = x0 + (k - kmin) * TXV.cw, isBar = (k % N) === 0, isBeat = (k % 4) === 0; if (!isBar && !isBeat) continue; g.strokeStyle = isBar ? C.text : C.grid; g.globalAlpha = isBar ? .55 : 1; g.beginPath(); g.moveTo(x, TXV.head - 4); g.lineTo(x, H - TXV.pad); g.stroke(); g.globalAlpha = 1; if (isBar) { g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText(String(k / N + 1), x + 3, 8); const ch = txChordAt(k); if (ch) { g.fillStyle = C.accent; g.font = '700 11px ui-monospace,monospace'; g.fillText(ch, x + 18, 9); g.font = '600 10px ui-monospace,monospace'; } } }
  TX.hits = [];
  evs.forEach(e => e.notes.forEach(n => {
    const x = x0 + (e.k - kmin) * TXV.cw + 1, y = TXV.head + (5 - n.st) * TXV.lane + 3, w = TXV.cw - 3, hh = TXV.lane - 6, rej = TX.rej.has(e.k + ':' + n.midi), hue = 8 + n.conf * 120;
    g.globalAlpha = rej ? .28 : .35 + .65 * n.conf; g.fillStyle = rej ? C.muted : `hsl(${hue} 62% 46%)`; g.beginPath(); (g.roundRect ? g.roundRect(x, y, w, hh, 5) : g.rect(x, y, w, hh)); g.fill();
    if (n.inferred) { g.setLineDash([3, 2]); g.strokeStyle = C.text; g.lineWidth = 1; g.stroke(); g.setLineDash([]); } g.globalAlpha = rej ? .5 : 1;
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 11px ui-monospace,monospace'; g.fillText(String(n.fret), x + w / 2 - (n.tech ? 3 : 0), y + hh / 2 + .5); if (n.tech) { g.font = '700 9px ui-monospace,monospace'; g.fillText(n.tech, x + w - 5, y + 5); }
    if (n.camHit) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 4, y + hh - 4, 2, 0, 7); g.fill(); } if (rej) { g.strokeStyle = C.text; g.beginPath(); g.moveTo(x + 2, y + hh - 2); g.lineTo(x + w - 2, y + 2); g.stroke(); }
    g.globalAlpha = 1; TX.hits.push({ x, y, w, h: hh, e, n });
  }));
  g.font = '600 10px ui-monospace,monospace';
}
function txHit(ev) { const r = UI.txCv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top; return (TX.hits || []).find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h); }
function txInfoText(q) {
  if (!q) return 'Hover a note for details · click to accept / reject · rejected notes are ignored when applying';
  const n = q.n, e = q.e; return pcName(n.midi % 12) + (Math.floor(n.midi / 12) - 1) + ' · string ' + (6 - n.st) + ' fret ' + n.fret + ' · bar ' + (Math.floor(e.k / spb()) + 1) + ' slot ' + (e.k % spb() + 1) + ' · confidence ' + (n.conf * 100).toFixed(0) + '%' + (n.tech ? ' · ' + ({ h: 'hammer-on', p: 'pull-off', '/': 'slide up', '\\': 'slide down', '~': 'vibrato', b: 'bend' }[n.tech] || n.tech) : '') + (n.inferred ? ' · inferred from chord shape' : '') + (n.camHit ? ' · camera agrees' : '') + (e.res != null ? ' · timing ' + (e.res * 1000 >= 0 ? '+' : '') + (e.res * 1000).toFixed(0) + ' ms off grid' : '');
}
function txStats() {
  const box = UI.txStats; if (!box) return; box.innerHTML = ''; const r = TX.res; if (!r) return; const st = r.stats, sg = (l, v, s) => h('div', { class: 'stat' }, h('span', {}, l), h('b', {}, v), h('small', {}, s || ''));
  const acc = txAccepted(), nAcc = acc.reduce((a, e) => a + e.notes.length, 0), f = (v, d = 1) => v == null || !isFinite(v) ? '—' : v.toFixed(d);
  box.append(sg('Notes', String(st.notes), nAcc + ' accepted'), sg('Events', String(st.events), (st.onsets != null ? st.onsets + ' onsets' : (st.takes + ' takes · ≥' + st.need + ' agree'))),
    sg('Mean confidence', st.meanConf != null ? (st.meanConf * 100).toFixed(0) + '%' : '—', 'per-note average'), sg('Tuning offset', f(st.tuneCents) + ' ¢', 'estimated from partials'),
    sg('Timing', f(st.residAbs) + ' ms', 'mean |error|, σ ' + f(st.residSD) + ' ms'), sg('Grid offset', f(st.autoOffsetMs) + ' ms', 'auto-aligned'), sg('Analysis rate', f(st.fs ? st.fs / 1000 : null, 1) + ' kHz', 'decimated · ' + (TX.lastMs / 1000).toFixed(1) + ' s run'));
  if (UI.txHist && r.events.length) {
    const c = UI.txHist, d = window.devicePixelRatio || 1; c.width = c.clientWidth * d; c.height = c.clientHeight * d;
    const bins = new Array(13).fill(0); r.events.forEach(e => { if (e.res == null) return; const ms = e.res * 1000, i = clamp(Math.round(ms / 10) + 6, 0, 12); bins[i]++; });
    barChart(c, bins, bins.map((_, i) => ((i - 6) * 10) + ''), TL.col.accent2 || TL.col.accent);
  }
}
function txBusyUI(b) { if (UI.txGo) { UI.txGo.disabled = b; UI.txGo.textContent = b ? 'Transcribing…' : '✦ Transcribe'; } if (UI.txBar) UI.txBar.parentNode.parentNode.style.display = b ? '' : 'none'; if (UI.txBench) UI.txBench.disabled = b; }
function txProg(f, m) { if (UI.txBar) { UI.txBar.style.width = clamp(f * 100, 0, 100) + '%'; UI.txBarT.textContent = m || ''; } }
function txRefreshSrc() {
  const sel = UI.txSrc; if (!sel) return; const cur = TX.src; sel.innerHTML = '';
  if (!TAKES.length && !TX.file) sel.append(h('option', { value: '' }, 'No takes yet — record one or import audio'));
  TAKES.forEach(t => sel.append(h('option', { value: t.id, selected: t.id === cur }, (t.kind === 'vox' ? '🎤 ' : '') + t.name + ' · ' + t.dur.toFixed(1) + ' s' + (t.cam && t.cam.length ? ' · 📷 fret log' : ''))));
  if (TX.file) sel.append(h('option', { value: 'file', selected: cur === 'file' }, '📁 ' + TX.file.name + ' · ' + TX.file.dur.toFixed(1) + ' s'));
  if (!cur && TAKES.length) { TX.src = (TAKES.filter(x => x.kind !== 'vox').pop() || TAKES[TAKES.length - 1]).id; sel.value = TX.src; }
  const L = UI.txCons; if (L) { L.innerHTML = ''; if (TAKES.length < 2) L.append(h('div', { class: 'tiny muted' }, 'Record two or more takes of the same part to unlock consensus transcription — notes that most takes agree on survive; random misses and ghosts drop out.')); TAKES.forEach(t => L.append(h('label', { class: 'chk', style: { display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', fontWeight: 600 } }, h('input', { type: 'checkbox', checked: TX.cons.has(t.id), onchange: e => { e.target.checked ? TX.cons.add(t.id) : TX.cons.delete(t.id); UI.txGo.textContent = TX.cons.size > 1 ? '✦ Transcribe ' + TX.cons.size + ' takes (consensus)' : '✦ Transcribe'; } }), t.name))); }
  if (UI.txFileBox) UI.txFileBox.style.display = cur === 'file' ? '' : 'none';
}

/* ---------- self-test: synthetic guitar with known ground truth ---------- */
function txSuite(rngSeed) {
  const rnd = txRng(rngSeed || 11), tun = S.tuning, capo = S.capo, cases = [], dur = slotDur();
  const pick = a => a[Math.floor(rnd() * a.length)], syms = ['C', 'G', 'Am', 'F', 'Em', 'D', 'Dm', 'E', 'A'];
  const mk = (name, bars, chordFn) => { const truth = [], notes = []; bars.forEach((b, bi) => b.forEach(([s, list]) => { const k = bi * spb() + s; list.forEach(([st, f], j) => { const midi = tun[st] + capo + f; truth.push({ k, st, fret: f, midi }); notes.push({ k, midi, j, vel: .55 + .35 * rnd() }); }); })); return { name, truth, notes, chordFn, bars: bars.length }; };
  const shape = sym => { const v = voicings(sym, tun, capo, 1)[0]; if (!v) return null; const out = []; v.frets.forEach((f, st) => { if (f != null) out.push([st, f]); }); return out; };
  const chs = []; for (let i = 0; i < 4; i++) { const s = pick(syms), sh = shape(s); if (sh) chs.push({ s, sh }); }
  cases.push(mk('Strummed chords', chs.map(c => [[0, c.sh], [8, c.sh.slice().reverse().slice(0, Math.max(3, c.sh.length - 1)).reverse()]]), k => chs[Math.floor(k / spb())] && chs[Math.floor(k / spb())].s));
  const arp = []; for (let i = 0; i < 3; i++) { const s = pick(syms), sh = shape(s); if (!sh) continue; const b = []; for (let j = 0; j < 8; j++) b.push([j * 2, [sh[[0, 2, 1, 3, 2, 3, 1, 3][j] % sh.length]]]); arp.push({ s, b }); }
  cases.push(mk('Fingerstyle arpeggios', arp.map(a => a.b), k => arp[Math.floor(k / spb())] && arp[Math.floor(k / spb())].s));
  const mel = []; for (let bar = 0; bar < 4; bar++) { const b = []; let f = pick([0, 2, 3, 5]); for (let s = 0; s < 16; s += pick([2, 2, 4, 4, 6])) { f = clamp(f + pick([-2, -1, 0, 1, 2, 3]), 0, 12); b.push([s, [[pick([3, 4, 5]), f]]]); } mel.push(b); }
  cases.push(mk('Single-note melody', mel, () => null));
  const bm = []; for (let i = 0; i < 4; i++) { const s = pick(syms), sh = shape(s); if (!sh) continue; const lo = sh[0], b = [[0, [lo]]]; let f = pick([1, 3, 5]); [4, 6, 8, 12].forEach(sl => { f = clamp(f + pick([-2, -1, 1, 2]), 0, 10); b.push([sl, [[pick([4, 5]), f]]]); }); bm.push({ s, b }); }
  cases.push(mk('Bass + melody', bm.map(a => a.b), k => bm[Math.floor(k / spb())] && bm[Math.floor(k / spb())].s));
  return cases;
}
async function txBench() {
  if (TX.busy) return; TX.busy = true; txBusyUI(true); const snr = +UI.txSnr.value || null, jit = +UI.txJit.value / 1000, rows = [], sr = 44100;
  try {
    const cases = txSuite(+UI.txSeed.value || 11); let tot = { tp: 0, det: 0, truth: 0, sf: 0 };
    for (let ci = 0; ci < cases.length; ci++) {
      const c = cases[ci], dur = slotDur(), lead = .5, rnd = txRng(100 + ci), notes = c.notes.map(n => ({ t: lead + n.k * dur + (n.k % 2 ? (S.swing || 0) * dur : 0) + n.j * .011 + (jit ? (rnd() - .5) * 2 * jit : 0), midi: n.midi, vel: n.vel }));
      const total = lead + c.bars * spb() * dur + 2, audio = txSynth(notes, sr, total, { seed: 3 + ci, snr: snr || undefined });
      txProg(ci / cases.length, 'Synthesising & transcribing: ' + c.name); await new Promise(r => setTimeout(r, 0));
      const cx = txCx({ cam: null }, -lead, dur); cx.chordAt = c.chordFn; cx.params = Object.assign({}, TX.p, { autoOffset: true }); const t0 = performance.now(), r = await txTranscribe(audio, sr, cx);
      const sc = txScore(c.truth, r.events); rows.push({ name: c.name, sc, ms: performance.now() - t0, audioSec: total, resid: r.stats.residAbs, fpTech: r.events.reduce((a, e) => a + e.notes.filter(n => n.tech).length, 0) }); tot.tp += sc.tp; tot.det += sc.det; tot.truth += sc.truth; tot.sf += sc.sfAcc * sc.tp;
    }
    const P = tot.det ? tot.tp / tot.det : 0, R = tot.truth ? tot.tp / tot.truth : 0; TX.bench = { rows, P, R, F1: P + R ? 2 * P * R / (P + R) : 0, sf: tot.tp ? tot.sf / tot.tp : 0, snr, jitMs: jit * 1000, when: new Date().toISOString(), tuning: S.tuning.slice(), capo: S.capo, bpm: S.bpm };
  } catch (e) { console.error(e); toast('Self-test failed: ' + e.message, 'bad'); }
  TX.busy = false; txBusyUI(false); txBenchRender();
}
function txBenchRender() {
  const box = UI.txBenchOut; if (!box) return; box.innerHTML = ''; const b = TX.bench; if (!b) { box.append(h('div', { class: 'tiny muted' }, 'Runs the engine on synthetic Karplus-Strong guitar with known ground truth, in this browser, with your current tuning, capo, tempo and settings.')); return; }
  const pc = v => (v * 100).toFixed(0) + '%', tb = h('table', { class: 'tbl', style: { width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: '11px' } });
  tb.append(h('tr', { style: { textAlign: 'left', color: 'var(--muted)' } }, ['Case', 'Precision', 'Recall', 'F1', 'String/fret', 'Timing', 'Speed', 'Spurious tech'].map(t => h('th', { style: { padding: '2px 6px' } }, t))));
  b.rows.forEach(r => tb.append(h('tr', {}, [r.name, pc(r.sc.precision), pc(r.sc.recall), pc(r.sc.f1), pc(r.sc.sfAcc), r.resid != null ? r.resid.toFixed(1) + ' ms' : '—', (r.audioSec / (r.ms / 1000)).toFixed(0) + '× real-time', String(r.fpTech)].map((t, i) => h('td', { style: { padding: '2px 6px', fontWeight: i === 0 ? 700 : 500 } }, t)))));
  tb.append(h('tr', { style: { borderTop: '1px solid var(--line2)', fontWeight: 800 } }, ['All cases', pc(b.P), pc(b.R), pc(b.F1), pc(b.sf), '', '', String(b.rows.reduce((a, r) => a + r.fpTech, 0))].map(t => h('td', { style: { padding: '3px 6px' } }, t))));
  box.append(tb, h('div', { class: 'tiny muted', style: { marginTop: '5px', lineHeight: 1.5 } }, 'Noise ' + (b.snr ? b.snr + ' dB SNR' : 'off') + ' · timing humanise ±' + b.jitMs.toFixed(0) + ' ms · F1 counts a note correct when slot and pitch both match; string/fret is scored on the correct-pitch notes. Synthetic audio is cleaner than a real room — treat these numbers as an upper bound.'));
}
function txReport() {
  const r = TX.res; if (!r && !TX.bench) return toast('Nothing to export yet', 'warn');
  const rep = { tool: BRAND.name + ' transcription report', when: new Date().toISOString(), song: { title: S.title, bpm: S.bpm, ts: S.ts, tuning: S.tuning, capo: S.capo, swing: S.swing }, settings: TX.p, source: r && r.srcName, stats: r && r.stats, events: r && r.events.map(e => ({ slot: e.k, bar: Math.floor(e.k / spb()) + 1, residMs: e.res != null ? +(e.res * 1000).toFixed(1) : null, chord: e.sym, notes: e.notes.map(n => ({ midi: n.midi, string: 6 - n.st, fret: n.fret, conf: +n.conf.toFixed(3), tech: n.tech || null, inferred: n.inferred, camera: n.camHit, rejected: TX.rej.has(e.k + ':' + n.midi) })) })), benchmark: TX.bench };
  download((S.title || 'song').replace(/\W+/g, '_') + '_transcription.json', JSON.stringify(rep, null, 1), 'application/json');
}

/* ---------- pane ---------- */
function buildTxPane() {
  const p = PANES.tx; if (!p) return;
  const lab = (t, w) => h('label', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--muted)', display: 'block', margin: '8px 0 2px' } }, t, w || '');
  const rng = (key, min, max, step, fmt) => { const out = h('b', { class: 'mono', style: { marginLeft: '6px', color: 'var(--text)' } }, fmt(TX.p[key])); const inp = h('input', { type: 'range', min, max, step, value: TX.p[key], style: { width: '100%' }, oninput: e => { TX.p[key] = +e.target.value; out.textContent = fmt(TX.p[key]); txSave(); } }); return [out, inp]; };
  const chk = (key, label, tip) => h('label', { class: 'chk', title: tip || '', style: { display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', fontWeight: 600 } }, h('input', { type: 'checkbox', checked: TX.p[key], onchange: e => { TX.p[key] = e.target.checked; txSave(); } }), label);
  const slider = (label, key, min, max, step, fmt) => { const [o, i] = rng(key, min, max, step, fmt); return h('div', {}, lab(label, o), i); };
  UI.txSrc = h('select', { class: 'in', style: { width: '100%', fontFamily: 'var(--sans)' }, onchange: e => { TX.src = e.target.value; txRefreshSrc(); } });
  UI.txCons = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' } });
  const fileIn = h('input', { type: 'file', accept: 'audio/*,.wav,.mp3,.m4a,.flac,.ogg', style: { display: 'none' }, onchange: e => { if (e.target.files[0]) txImport(e.target.files[0]); e.target.value = ''; } });
  UI.txFileBox = h('div', { style: { display: 'none', marginTop: '6px', padding: '6px 8px', border: '1px solid var(--line2)', borderRadius: '8px', background: 'var(--panel2)' } },
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('label', { class: 'small', style: { fontWeight: 700 } }, 'Starts at bar ', h('input', { class: 'in', type: 'number', min: 1, max: 999, value: TX.startBar, style: { width: '56px' }, onchange: e => { TX.startBar = Math.max(1, +e.target.value || 1); } })),
      h('label', { class: 'small', style: { fontWeight: 700 } }, 'Shift slots ', h('input', { class: 'in', type: 'number', min: -64, max: 64, value: TX.shift, style: { width: '56px' }, onchange: e => { TX.shift = +e.target.value || 0; } }))),
    h('label', { class: 'chk', style: { display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', fontWeight: 600, marginTop: '6px' } }, h('input', { type: 'checkbox', checked: TX.snapFirst, onchange: e => { TX.snapFirst = e.target.checked; } }), 'Put the first note on the bar line'),
    h('div', { class: 'seg', style: { marginTop: '6px' } }, [['song', 'Use song tempo'], ['detect', 'Detect tempo']].map(([v, n]) => h('button', { class: TX.tempo === v ? 'on' : '', onclick: e => { TX.tempo = v; $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } }, n))),
    h('div', { class: 'tiny muted', style: { marginTop: '4px', lineHeight: 1.4 } }, 'For imported recordings: “Detect tempo” estimates BPM and the beat phase from the audio and sets the song tempo to match; otherwise your song’s tempo is used and bar 1 starts at the clip’s first beat.'));
  UI.txBar = h('div', { style: { height: '100%', width: '0%', background: 'var(--accent)', borderRadius: '4px', transition: 'width .15s' } }); UI.txBarT = h('div', { class: 'tiny mono muted', style: { marginTop: '3px' } }, '');
  UI.txGo = h('button', { class: 'btn primary', style: { flex: 1 }, onclick: txGo }, '✦ Transcribe');
  const left = h('div', { class: 'card', style: { flex: '0 0 330px', minWidth: '280px' } }, h('h4', {}, 'Source & detection'), h('div', { class: 'card-b' },
    lab('Take or imported audio'), UI.txSrc, h('div', { class: 'row', style: { gap: '6px', marginTop: '6px', flexWrap: 'wrap' } }, h('button', { class: 'btn sm', onclick: () => fileIn.click() }, '📁 Import audio…'), fileIn,
      h('button', { class: 'btn sm', title: 'Arms the recorder, plays the count-in and starts a take. Transcription runs automatically when you stop.', onclick: () => { TX.auto = true; toast('Recording — the take will be transcribed when you stop (Space)'); toggleRec(); } }, '● Record & transcribe')),
    samplesShelf(f => txImport(f), 'SAMPLES'), UI.txFileBox, UI.txCons,
    slider('Sensitivity', 'sens', 0, 1, .01, v => (v * 100).toFixed(0) + '%'),
    slider('Max simultaneous notes', 'maxPoly', 1, 6, 1, v => String(v)),
    h('div', {}, lab('Quantise to'), h('div', { class: 'seg' }, [[1, '16th'], [2, '8th'], [4, 'quarter']].map(([v, n]) => h('button', { class: TX.p.grid === v ? 'on' : '', onclick: e => { TX.p.grid = v; txSave(); $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } }, n)))),
    h('div', { class: 'row', style: { gap: '12px', flexWrap: 'wrap', marginTop: '8px' } }, chk('autoOffset', 'Auto-align timing', 'Searches ±70 ms for the grid offset that minimises timing error (latency, rushing or dragging)'), chk('techniques', 'Bends & vibrato'), chk('legato', 'Hammer-ons / pull-offs / slides', 'Reads soft attacks that change pitch without a new pluck')),
    slider('Manual timing offset', 'offsetMs', -120, 120, 1, v => (v > 0 ? '+' : '') + v + ' ms'),
    h('div', { style: { borderTop: '1px solid var(--line)', margin: '10px 0 2px' } }), h('div', { class: 'tiny', style: { fontWeight: 800, letterSpacing: '.08em', color: 'var(--muted)', textTransform: 'uppercase' } }, 'Musical priors'),
    h('div', { class: 'row', style: { marginTop: '6px' } }, chk('snapChord', 'Chord-shape repair', 'Tests the bar’s chord voicings against the spectrum and keeps the one that explains the audio best — recovers octave-doubled strings')),
    slider('Chord-shape influence on fretting', 'chordPrior', 0, 2, .05, v => v.toFixed(2)),
    slider('Camera-log influence', 'camWeight', 0, 2, .05, v => v.toFixed(2)),
    slider('Hide notes below confidence', 'minConf', 0, .9, .01, v => (v * 100).toFixed(0) + '%'),
    h('div', { class: 'row', style: { marginTop: '12px', gap: '6px' } }, UI.txGo),
    h('div', { style: { display: 'none', marginTop: '8px' } }, h('div', { style: { height: '7px', background: 'var(--panel2)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--line)' } }, UI.txBar), UI.txBarT)));
  UI.txCv = h('canvas', { style: { display: 'block', cursor: 'pointer' } }); UI.txScroll = h('div', { style: { overflowX: 'auto', overflowY: 'hidden', border: '1px solid var(--line)', borderRadius: '9px', background: 'var(--panel)' } }, UI.txCv);
  UI.txInfo = h('div', { class: 'tiny mono muted', style: { minHeight: '15px', marginTop: '5px' } }, txInfoText(null));
  UI.txCv.addEventListener('mousemove', ev => { const q = txHit(ev); UI.txInfo.textContent = txInfoText(q); UI.txCv.style.cursor = q ? 'pointer' : 'default'; });
  UI.txCv.addEventListener('click', ev => { const q = txHit(ev); if (!q) return; const key = q.e.k + ':' + q.n.midi; TX.rej.has(key) ? TX.rej.delete(key) : TX.rej.add(key); txRender(); });
  UI.txStats = h('div', { class: 'stat-grid', style: { marginTop: '8px' } }); UI.txHist = h('canvas', { style: { width: '100%', height: '70px', marginTop: '8px' } });
  UI.txAscii = h('pre', { class: 'mono', style: { margin: 0, padding: '8px 10px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '11.5px', overflow: 'auto', maxHeight: '220px', lineHeight: 1.25 } }, '');
  UI.txApplyBtn = h('button', { class: 'btn primary', disabled: true, onclick: txApply }, '⤵ Apply to song');
  const modeSeg = h('div', { class: 'seg' }, [['replace', 'Replace bars'], ['merge', 'Merge into empty slots']].map(([v, n]) => h('button', { class: TX.apply === v ? 'on' : '', onclick: e => { TX.apply = v; $$('button', e.target.parentNode).forEach(b => b.classList.toggle('on', b === e.target)); } }, n)));
  const right = h('div', { style: { flex: '1 1 480px', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '10px' } },
    h('div', { class: 'card' }, h('h4', {}, 'Review'), h('div', { class: 'card-b' }, UI.txScroll, UI.txInfo, UI.txStats,
      h('div', { class: 'tiny muted', style: { margin: '8px 0 2px', fontWeight: 700 } }, 'Timing error per event (ms off the grid)'), UI.txHist)),
    h('div', { class: 'card' }, h('h4', {}, 'Tab preview'), h('div', { class: 'card-b' }, UI.txAscii,
      h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', marginTop: '8px' } }, UI.txApplyBtn, modeSeg, h('label', { class: 'chk', style: { display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px', fontWeight: 600 } }, h('input', { type: 'checkbox', checked: TX.fillChords, onchange: e => { TX.fillChords = e.target.checked; } }), 'Name empty bars’ chords'),
        h('span', { class: 'grow' }), h('button', { class: 'btn sm', onclick: () => { const t = UI.txAscii.textContent; if (t) { copyText(t); toast('Tab copied', 'ok'); } } }, 'Copy tab'), h('button', { class: 'btn sm', onclick: txReport }, 'Export report (JSON)')))),
    h('div', { class: 'card' }, h('h4', {}, 'Self-test · synthetic ground truth'), h('div', { class: 'card-b' },
      h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', marginBottom: '8px' } },
        h('label', { class: 'small', style: { fontWeight: 700 } }, 'Noise ', (UI.txSnr = h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' } }, [['0', 'none'], ['30', '30 dB SNR'], ['20', '20 dB SNR'], ['12', '12 dB SNR']].map(([v, n]) => h('option', { value: v }, n))))),
        h('label', { class: 'small', style: { fontWeight: 700 } }, 'Timing humanise ', (UI.txJit = h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' } }, [['0', '±0 ms'], ['15', '±15 ms'], ['30', '±30 ms']].map(([v, n]) => h('option', { value: v }, n))))),
        h('label', { class: 'small', style: { fontWeight: 700 } }, 'Seed ', (UI.txSeed = h('input', { class: 'in', type: 'number', value: 11, style: { width: '58px' } }))),
        (UI.txBench = h('button', { class: 'btn sm primary', onclick: txBench }, '▶ Run self-test'))),
      (UI.txBenchOut = h('div', {})))));
  p.append(h('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' } }, left, right));
  txRefreshSrc(); txBenchRender(); txDraw();
  bus.on('takes', txRefreshSrc);
  bus.on('rec:done', () => { if (!TX.auto) return; TX.auto = false; const t = TAKES.filter(x => x.kind !== 'vox').pop(); if (!t) return; TX.src = t.id; txRefreshSrc(); dockGo('tx'); setTimeout(() => txRun([txSource(t.id)]), 120); });
  bus.on('dock', id => { if (id === 'tx') setTimeout(() => { txDraw(); txStats(); }, 30); });
  bus.on('theme', () => setTimeout(() => { txDraw(); txStats(); }, 30));
  new ResizeObserver(() => { if (paneVisible('tx')) txDraw(); }).observe(p);
}
