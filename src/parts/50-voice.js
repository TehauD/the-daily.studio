/* ============================================================
   Part 50 · Voice — see your pitch, know your range, find your key
   A pitch ribbon (what you sing against the notes of the song's key and the chord that is playing), a range finder (lowest, highest and
   comfortable notes, kept on this device) and "Find my key" (which key puts this song where your voice is happiest, with a one-step
   transpose). Everything is measured in the page from the vocal input (or the main input when no vocal channel is set).
   ============================================================ */
const VOX = { on: false, hist: [], buf: null, last: 0, m: null, cents: 0, f: [], hit: {}, voiced: 0, inTune: 0, inKey: 0, capt: false, panel: null, raf: 0, vlo: 55, vhi: 72, mode: 'ribbon' };
const VOX_WIN = 8;            // seconds of ribbon

const voxNote = m => pcName(m) + (Math.floor(Math.round(m) / 12) - 1);
const voxSrc = () => (CFG.vin && CFG.vin !== 'off' && E.anaVox) ? E.anaVox : E.anaDI;
const voxWant = () => !!(CFG.vzRibbon || VOX.panel || VOX.capt);
/** the pitch classes of the song's scale and, while it plays, of the chord under the playhead */
function voxScale() { const iv = SCALES[S.scale] || SCALES['Major (Ionian)']; return new Set(iv.map(i => (S.key + i) % 12)); }
function voxChordPcs() { try { const i = stageInfo(), c = i && i.sym ? parseChord(i.sym) : null; return c ? new Set(c.pcs) : null; } catch (e) { return null; } }
/** the nearest note of the key to a (fractional) MIDI pitch: { n: note, err: cents sharp (+) or flat (−) } */
function voxTarget(m, sc) {
  sc = sc || voxScale(); let best = null; for (let n = Math.floor(m) - 2; n <= Math.ceil(m) + 2; n++) { if (!sc.has(((n % 12) + 12) % 12)) continue; const e = (m - n) * 100; if (!best || Math.abs(e) < Math.abs(best.err)) best = { n, err: e }; }
  return best || { n: Math.round(m), err: (m - Math.round(m)) * 100 };
}

/** called from the analysis tick: one pitch reading of the voice */
function voxTick() {
  if (!voxWant() || !E.ready || !E.hasInput) return; const an = voxSrc(); if (!an) return; const now = performance.now(); if (now - VOX.last < 28) return;
  const dt = Math.min(.12, (now - VOX.last) / 1000); VOX.last = now; const n = an.fftSize; if (!VOX.buf || VOX.buf.length !== n) VOX.buf = new Float32Array(n);
  an.getFloatTimeDomainData(VOX.buf); let e = 0; for (let i = 0; i < n; i++) e += VOX.buf[i] * VOX.buf[i]; const db = dB(Math.sqrt(e / n));
  let m = null, cl = 0; if (db > (CFG.gateDb != null ? Math.min(CFG.gateDb, -48) : -52)) { const r = yin(VOX.buf, E.ctx.sampleRate, .15); if (r && r.f > 65 && r.f < 1250 && r.clarity > .72) { VOX.f.push(r.f); if (VOX.f.length > 3) VOX.f.shift(); m = ftom(median(VOX.f)); cl = r.clarity; } else VOX.f = []; } else VOX.f = [];
  VOX.m = m; VOX.hist.push({ t: now, m, c: cl }); while (VOX.hist.length && now - VOX.hist[0].t > (VOX_WIN + 2) * 1000) VOX.hist.shift();
  if (m != null) {
    VOX.cents = (m - Math.round(m)) * 100; const r = Math.round(m); VOX.hit[r] = (VOX.hit[r] || 0) + dt;
    if (!VOX.capt) { VOX.voiced += dt; const t = voxTarget(m); if (Math.abs(t.n - m) < .5) VOX.inKey += dt; if (Math.abs(t.err) <= 25) VOX.inTune += dt; }
  }
}
/** an empty tally for a new session or range pass */
function voxReset() { VOX.hit = {}; VOX.voiced = 0; VOX.inTune = 0; VOX.inKey = 0; }

/** lowest, highest and comfortable notes from the time spent on each note (a note must be held about a quarter second to count) */
function voxRange(hit) {
  hit = hit || VOX.hit; const ks = Object.keys(hit).map(Number).filter(k => hit[k] >= .25).sort((a, b) => a - b); if (!ks.length) return null;
  let tot = 0; ks.forEach(k => { tot += hit[k]; }); if (tot < 1.5) return null; let acc = 0, c0 = ks[0], c1 = ks[ks.length - 1], got0 = false;
  ks.forEach(k => { acc += hit[k]; if (!got0 && acc >= tot * .1) { c0 = k; got0 = true; } if (acc <= tot * .9) c1 = k; });
  c1 = Math.max(c1, c0); return { lo: ks[0], hi: ks[ks.length - 1], c0, c1, secs: tot };
}
/** which move of the song (in semitones) suits a voice: range = { lo, hi, c0, c1 }, mel = { lo, hi } of the melody (or null), key = the song's key. Returns the three best, best first. */
function voxPlan(r, mel, key) {
  if (!mel) { const mid = (r.c0 + r.c1) / 2; let t = key; while (t < mid - 6) t += 12; while (t > mid + 6) t -= 12; mel = { lo: t - 4, hi: t + 8 }; }     // no melody to measure: a tune usually runs from just under the tonic to about an octave and a half above it
  const out = [];
  for (let d = -9; d <= 9; d++) {
    const lo = mel.lo + d, hi = mel.hi + d, over = Math.max(0, hi - r.c1) + Math.max(0, r.c0 - lo), hard = Math.max(0, hi - r.hi) + Math.max(0, r.lo - lo), cen = Math.abs((lo + hi) / 2 - (r.c0 + r.c1) / 2);
    out.push({ d, key: ((key + d) % 12 + 12) % 12, lo, hi, fit: !over, score: over ? over * 2 + hard * 5 + cen * .5 + Math.abs(d) * .2 + 1 : Math.abs(d) * .35 + cen * .1 });      // anything that fits beats anything that does not; of those, the smallest move wins
  }
  out.sort((a, b) => a.score - b.score); const best = [], seen = new Set(); out.forEach(o => { if (best.length < 3 && !seen.has(o.key)) { seen.add(o.key); best.push(o); } }); return best;
}
/** the lead-guitar tab's highest and lowest notes, as MIDI, or null when there are too few to say */
function voxMelody() {
  let lo = 999, hi = -1, n = 0; S.sections.forEach(sec => sec.bars.forEach(b => (b.tab || []).forEach(x => { if (typeof x.f === 'number' && S.tuning[x.st] != null) { const m = S.tuning[x.st] + S.capo + x.f; if (m < lo) lo = m; if (m > hi) hi = m; n++; } })));
  return n >= 4 ? { lo, hi, n } : null;
}
/** a chord symbol moved by d semitones (roots and slash basses) */
function voxXSym(sym, d, fl) {
  return String(sym).replace(/(^|\/)([A-G][#b]?)/g, (m, p, r) => { const pc = parsePc(r); return pc == null ? m : p + pcName(((pc + d) % 12 + 12) % 12, fl); });
}
/** move the whole song by d semitones: key, chords (and the [chords] in lyrics), tab frets; recorded takes are not touched. One undo step. */
function voxTranspose(d) {
  if (!d) return false; const before = snap(), key = ((S.key + d) % 12 + 12) % 12, fl = keyUsesFlats(key, S.minor); let off = 0;
  S.sections.forEach(sec => {
    sec.bars.forEach(b => { if (b.chord) b.chord = b.chord.split(/\s+/).map(c => voxXSym(c, d, fl)).join(' '); (b.tab || []).forEach(x => { if (typeof x.f === 'number') { let f = x.f + d; while (f < 0) f += 12; while (f > 24) f -= 12; if (f !== x.f + d) off++; x.f = f; } }); });
    if (sec.lyrics) sec.lyrics = sec.lyrics.replace(/\[([^\]]+)\]/g, (m, c) => '[' + voxXSym(c, d, fl) + ']');
  });
  S.key = key; CFG.flats = fl; T.bars = null; saveCfg(); if (!histPush(before)) commit(true); bus.emit('song', 'reload');
  toast('Song moved ' + (d > 0 ? 'up ' : 'down ') + Math.abs(d) + ' semitone' + (Math.abs(d) === 1 ? '' : 's') + ' to ' + pcName(key) + (S.minor ? ' minor' : ' major') + (off ? ' · ' + off + ' tab note' + (off === 1 ? '' : 's') + ' moved an octave to stay on the neck' : '') + ' · recorded takes were not changed', 'ok'); return true;
}

/* ---------- drawing ---------- */
/** the pitch ribbon, drawn into any canvas context */
function voxDraw(g, x, y, w, h, o) {
  o = o || {}; const now = performance.now(), sc = voxScale(), cp = voxChordPcs(), C = o.C || vcol(), lbl = o.labels !== false;
  const ph = VOX.hist.filter(p => now - p.t <= VOX_WIN * 1000); let lo = 1e9, hi = -1e9; ph.forEach(p => { if (p.m != null) { lo = Math.min(lo, p.m); hi = Math.max(hi, p.m); } });
  const rg = CFG.vrange; let tl = lo < 1e8 ? lo : (rg ? rg.c0 : 55), th = hi > -1e8 ? hi : (rg ? rg.c1 : 72); if (th - tl < 11) { const c = (th + tl) / 2; tl = c - 5.5; th = c + 5.5; }
  tl -= 2; th += 2; VOX.vlo += (tl - VOX.vlo) * .12; VOX.vhi += (th - VOX.vhi) * .12; const vlo = VOX.vlo, vhi = VOX.vhi, py = m => y + h - (m - vlo) / (vhi - vlo) * h, px = t => x + w - (now - t) / (VOX_WIN * 1000) * w, rowH = h / (vhi - vlo);
  g.save(); g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, Math.min(14, h * .12)) : g.rect(x, y, w, h); g.fillStyle = 'rgba(5,11,12,.74)'; g.fill(); g.clip();
  for (let n = Math.floor(vlo); n <= Math.ceil(vhi); n++) {
    const pc = ((n % 12) + 12) % 12; if (!sc.has(pc)) continue; const tonic = pc === S.key, ct = cp && cp.has(pc);
    g.fillStyle = ct ? 'rgba(120,230,180,.20)' : tonic ? 'rgba(255,210,90,.13)' : 'rgba(180,215,220,.06)'; g.fillRect(x, py(n + .5), w, rowH);
    g.fillStyle = ct ? 'rgba(150,255,200,.55)' : tonic ? 'rgba(255,210,90,.45)' : 'rgba(200,230,230,.22)'; g.fillRect(x, py(n) - .5, w, 1);
    if (lbl && rowH > 9) { g.fillStyle = ct ? 'rgba(190,255,220,.9)' : 'rgba(215,240,240,.5)'; g.font = `600 ${Math.min(12, Math.round(rowH * .75))}px ui-monospace,Menlo,monospace`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(voxNote(n), x + 6, py(n)); }
  }
  g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(3, h * .03); let prev = null;
  ph.forEach(p => {
    if (p.m == null) { prev = null; return; } const t = voxTarget(p.m, sc), a = Math.abs(t.err), col = a <= 20 ? '#5fe3a1' : a <= 35 ? '#ffd23f' : '#ff6b6b', age = (now - p.t) / (VOX_WIN * 1000);
    if (prev) { g.globalAlpha = clamp(1.1 - age, .15, 1); g.strokeStyle = col; g.beginPath(); g.moveTo(px(prev.t), py(prev.m)); g.lineTo(px(p.t), py(p.m)); g.stroke(); } prev = p;
  });
  g.globalAlpha = 1; const last = ph[ph.length - 1];
  if (last && last.m != null && now - last.t < 250) { const t = voxTarget(last.m, sc), a = Math.abs(t.err), col = a <= 20 ? '#5fe3a1' : a <= 35 ? '#ffd23f' : '#ff6b6b'; g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 14; g.beginPath(); g.arc(x + w - 4, py(last.m), Math.max(4, h * .035), 0, 6.3); g.fill(); g.shadowBlur = 0;
    g.fillStyle = 'rgba(240,252,252,.92)'; g.font = `800 ${Math.round(clamp(h * .17, 13, 26))}px ui-monospace,Menlo,monospace`; g.textAlign = 'right'; g.textBaseline = 'top'; g.fillText(voxNote(last.m) + '  ' + (t.err >= 0 ? '+' : '') + Math.round(t.err) + '¢', x + w - 12, y + 8); }
  else if (!ph.length || ph.every(p => p.m == null)) { g.fillStyle = 'rgba(220,240,240,.55)'; g.font = `600 ${Math.round(clamp(h * .09, 11, 15))}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(E.hasInput ? 'sing or hum: your pitch draws here' : 'connect an input to see your pitch', x + w / 2, y + h / 2); }
  if (VOX.voiced > 4) { g.fillStyle = 'rgba(220,240,240,.6)'; g.font = `600 ${Math.round(clamp(h * .075, 10, 13))}px ui-monospace,Menlo,monospace`; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText('in key ' + Math.round(VOX.inKey / VOX.voiced * 100) + '% · in tune ' + Math.round(VOX.inTune / VOX.voiced * 100) + '%', x + 8, y + h - 5); }
  g.restore();
}
/** where the ribbon sits on the stage: across the top third, above the neck */
function voxRect(W, H) { const w = Math.min(W * .9, H * 2.6), h = clamp(H * .26, 70, 220); return [(W - w) / 2, Math.max(8, H * .035), w, h]; }

/* ---------- the Voice window ---------- */
const voxPc = m => voxNote(m);
function voxOpen(anchor) {
  if (VOX.panel) { voxClose(); return; }
  VOX.mode = VOX.mode || 'ribbon'; const cv = h('canvas', { id: 'voxCv', width: 440, height: 170, role: 'img', 'aria-label': 'Pitch ribbon: the note you are singing against the notes of the key' }), body = h('div', { class: 'vx-body', id: 'voxBody' });
  const close = h('button', { class: 'btn sm', id: 'voxClose', onclick: () => voxClose() }, 'Close');
  const p = h('section', { id: 'voxPanel', class: 'vx', role: 'dialog', 'aria-label': 'Voice' }, h('div', { class: 'vx-h' }, h('b', {}, '🎤 Voice'), h('span', { class: 'grow' }), close), cv, body);
  document.body.append(p); VOX.panel = p; VOX.cv = cv; voxReset(); voxBuild(); voxLoop(); bus.emit('vox'); }
function voxClose() { if (!VOX.panel) return; VOX.capt = false; VOX.panel.remove(); VOX.panel = null; cancelAnimationFrame(VOX.raf); bus.emit('vox'); }
function voxLoop() {
  if (!VOX.panel) return; const cv = VOX.cv, g = cv.getContext('2d'), r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.max(200, Math.round(r.width * dpr)), H = Math.max(80, Math.round(r.height * dpr));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } g.clearRect(0, 0, W, H); voxDraw(g, 0, 0, W, H, {}); voxLive();
  VOX.raf = requestAnimationFrame(voxLoop);
}
/** small live readouts inside the window (range while capturing) */
function voxLive() {
  const el = document.getElementById('voxLive'); if (!el || !VOX.capt) return; const r = voxRange();
  el.textContent = r ? voxPc(r.lo) + ' – ' + voxPc(r.hi) + '   ·   comfortable ' + voxPc(r.c0) + ' – ' + voxPc(r.c1) : (VOX.m != null ? 'hearing ' + voxPc(VOX.m) + '…' : 'sing from your lowest note to your highest');
}
function voxBuild() {
  const b = document.getElementById('voxBody'); if (!b) return; b.innerHTML = '';
  const conn = E.hasInput ? null : h('div', { class: 'vx-note' }, 'No input is connected yet. ', h('button', { class: 'btn sm', id: 'voxConnect', onclick: async () => { try { await ioConnectFlow(); } catch (e) { } voxBuild(); } }, 'Connect my input'));
  const rg = CFG.vrange, mel = voxMelody(), key = pcName(S.key) + (S.minor ? ' minor' : ' major');
  const cap = h('button', { class: 'btn sm' + (VOX.capt ? ' on' : ''), id: 'voxCapture', onclick: () => {
    if (!VOX.capt) { if (!E.hasInput) { toast('Connect an input first', 'warn'); return; } voxReset(); VOX.capt = true; } else { VOX.capt = false; const r = voxRange(); if (r) { CFG.vrange = { lo: r.lo, hi: r.hi, c0: r.c0, c1: r.c1 }; saveCfg(); toast('Your range is kept on this device: ' + voxPc(r.lo) + ' to ' + voxPc(r.hi), 'ok'); } else toast('Not enough singing was heard. Hold a few notes for a second each.', 'warn'); voxReset(); }
    voxBuild(); } }, VOX.capt ? '■ Done' : '● Find my range');
  const plan = rg ? voxPlan(rg, mel, S.key) : null;
  b.append(...[conn,
    h('div', { class: 'vx-row' }, cap, h('span', { class: 'tiny muted' }, VOX.capt ? 'Sing from your lowest note to your highest, then press Done.' : 'Sing low to high once. It is kept on this device.')),
    h('div', { class: 'vx-live', id: 'voxLive', 'aria-live': 'polite' }, VOX.capt ? 'sing from your lowest note to your highest' : (rg ? 'Your range ' + voxPc(rg.lo) + ' – ' + voxPc(rg.hi) + ' · comfortable ' + voxPc(rg.c0) + ' – ' + voxPc(rg.c1) : 'No range kept yet'))].filter(Boolean));
  if (plan) {
    const top = plan[0], same = top.d === 0, keyName = k => pcName(k, keyUsesFlats(k, S.minor)) + (S.minor ? ' minor' : ' major');
    b.append(h('h5', { class: 'vx-h5' }, 'Find my key'),
      h('div', { class: 'vx-res', id: 'voxRes' },
        h('div', {}, 'This song is in ', h('b', {}, key), mel ? ', and its tab melody runs ' + voxPc(mel.lo) + ' – ' + voxPc(mel.hi) + '.' : '. It has no lead tab to measure, so this assumes a typical tune around the tonic.'),
        same ? h('div', { class: 'vx-good' }, '✓ That sits well in your voice. No change needed.') : h('div', { class: 'vx-adv' }, 'Try ', h('b', {}, keyName(top.key)), ' (' + (top.d > 0 ? 'up ' : 'down ') + Math.abs(top.d) + ' semitone' + (Math.abs(top.d) === 1 ? '' : 's') + '): the melody would run ' + voxPc(top.lo) + ' – ' + voxPc(top.hi) + (top.fit ? ', inside your comfortable range.' : ', as close as it gets.')),
        h('div', { class: 'vx-row' }, same ? null : h('button', { class: 'btn sm primary', id: 'voxXpose', onclick: () => { voxTranspose(top.d); voxBuild(); } }, 'Move the song to ' + keyName(top.key)),
          ...plan.slice(1).filter(o => o.d !== 0 || !same).slice(0, 2).map(o => h('button', { class: 'btn sm', 'data-d': o.d, onclick: () => { voxTranspose(o.d); voxBuild(); } }, keyName(o.key) + ' (' + (o.d > 0 ? '+' : '') + o.d + ')'))),
        h('div', { class: 'tiny muted' }, 'Chords, [chords] in lyrics and tab frets move together; recorded takes stay as they were. Undo (Ctrl/⌘+Z) puts it back.')));
  }
  b.append(h('div', { class: 'tiny muted' }, 'Green is within 20 cents of a note in the key, yellow within 35, red beyond. Bright rows are the chord that is playing. Nothing leaves this device.'));
}
bus.on('audiostate', () => { if (!E.hasInput) VOX.capt = false; if (VOX.panel) voxBuild(); });
bus.on('song', () => { if (VOX.panel && !VOX.capt) voxBuild(); });
