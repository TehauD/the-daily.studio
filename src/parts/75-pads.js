/* ============================================================
   Part 75 · PADS (2.29) — play the band's drums with your fingers, tap the tempo, and set the groove the song sits on
   Six pads, the band's own kit (kick, snare, hat, open hat, clap / rim, tom): tap them, press A S D F G H, or hit a MIDI pad
   controller (the General MIDI drum notes: 36 kick, 38 / 40 snare, 42 / 44 hat, 46 open hat, 37 / 39 clap and rim, toms 41–50).
   Harder taps (or MIDI velocity) play louder. Every hit lights the stage, as the band's drums do.
     · Tap tempo     four taps or more set the song's tempo (undo puts it back)
     · ● Record      1 or 2 bars loop over the click; what you play is written onto the 16th-note grid as the band's drum pattern.
                     Each press of ● is a new pass on top of the last (kick first, then the hats …); ↶ takes the last pass away
     · 🎤 Beatbox    the same, by mouth: kicks, snares and hats are told apart by their sound (part 75, bbAnalyze)
     · Bass follows the kick: the band's bass plays the chord's root on every kick (BASS_STYLES 'Follow the Kick', part 03)
   The grid under the pads is the pattern itself: tap a cell to change it.
   ============================================================ */
const PAD = { el: null, rec: null, taps: [], passes: [], bb: null, keys: 'asdfgh', loop0: null, held: new Map() };
const PAD_ROWS = [['Kick', '🦶'], ['Snare', '🥁'], ['Hat', '🔸'], ['Open hat', '🔶'], ['Clap / rim', '👏'], ['Tom', '🪘']];
const PAD_GM = { 35: 0, 36: 0, 38: 1, 40: 1, 42: 2, 44: 2, 46: 3, 37: 4, 39: 4, 41: 5, 43: 5, 45: 5, 47: 5, 48: 5, 50: 5 };
const padLen = () => Math.min(S.band.drumLen || spb(), 32);
const padBars = () => Math.max(1, Math.round(padLen() / spb()));
/** the pattern at a length of `n` 16ths (a one-bar groove doubled to two, or the first bar of two kept) */
function padResize(n) { const p = dpat(), L = padLen(); S.band.pat = p.map(r => Array.from({ length: Math.max(n, 32) }, (_, i) => i < n ? (r[i % L] || 0) : 0)); S.band.drumLen = n; }

/* ---------- a hit ---------- */
/** play pad `row` now at level v (1 ghost, 2 normal, 3 accent); while recording, write it on the grid */
function padHit(row, v) {
  if (!E.ready || !E.ctx) { startAudio().then(() => padHit(row, v)); return; }
  const t = E.ctx.currentTime + .005; drumHit(row, t, v); if (typeof lxHit === 'function') lxHit(row, t, v);
  const b = PAD.el && PAD.el.querySelector('[data-pad="' + row + '"]'); if (b) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
  if (PAD.rec && T.playing) {      /* where in the loop you played it, as heard: the speakers are output-latency behind the clock */
    const heard = E.ctx.currentTime - (E.ctx.outputLatency || E.ctx.baseLatency || 0), slot = slotAtTime(heard), L = padLen(), i = ((Math.round(slot) % L) + L) % L;
    const p = dpat(); p[row][i] = Math.max(p[row][i] || 0, v); commit(false); padGrid();
  }
}
const padLevel = f => f > .8 ? 3 : f > .35 ? 2 : 1;

/* ---------- tap tempo ---------- */
function padTap() {
  const now = performance.now(); if (PAD.taps.length && now - PAD.taps[PAD.taps.length - 1] > 2000) PAD.taps = []; PAD.taps.push(now); if (PAD.taps.length > 8) PAD.taps.shift();
  if (PAD.el) { const b = PAD.el.querySelector('.pad-tap'); b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
  if (PAD.taps.length < 4) { padPaint(PAD.taps.length + ' …'); return null; }
  const d = PAD.taps.slice(1).map((t, i) => t - PAD.taps[i]).sort((a, b) => a - b), mid = d[Math.floor(d.length / 2)], bpm = Math.round(60000 / mid);
  if (bpm < 40 || bpm > 240) return null;
  if (bpm !== S.bpm) { const fresh = !PAD.tapBf || now - PAD.tapAt > 3000; if (fresh) PAD.tapBf = snap(); S.bpm = bpm; commit(false); if (fresh) histPush(PAD.tapBf); try { syncTransport(); } catch (e) { } }      /* one burst of taps is one undo */
  PAD.tapAt = now;
  padPaint(); return bpm;
}

/* ---------- recording a groove ---------- */
/** start a pass: the first loops `bars` bars from the start of the bar you are on, over the click; each later pass goes on top */
async function padRecord(bars) {
  if (PAD.rec) { padRecStop(); return; } if (REC || T.rec) { toast('The studio is recording. Stop it first.', 'warn'); return; }
  await startAudio(); const n = Math.min(32, (bars || padBars()) * spb()); if (n !== padLen()) padResize(n);
  PAD.passes.push(JSON.stringify({ pat: dpat(), len: padLen(), name: S.band.patName, on: S.band.drumsOn })); if (PAD.passes.length > 20) PAD.passes.shift();
  if (!PAD.loop0) PAD.loop0 = { loop: T.loop, a: T.loopA, b: T.loopB, metro: T.metro };
  const bar = Math.floor(playheadSlot() / spb()), a = Math.min(bar, Math.max(0, totalBars() - 1)) * spb();
  if (T.playing) stopPlay(true); T.loop = true; T.loopA = a; T.loopB = Math.min(songSlots(), a + n); T.cursor = a; T.metro = true; S.band.drumsOn = true; S.band.patName = 'Your groove';
  PAD.rec = { at: a, n }; commit(false); await play(); padPaint();
}
function padRecStop(keepPlaying) {
  if (!PAD.rec) return; PAD.rec = null; if (!keepPlaying && T.playing) stopPlay(true);
  const L0 = PAD.loop0; PAD.loop0 = null; if (L0) { T.loop = L0.loop; T.loopA = L0.a; T.loopB = L0.b; T.metro = L0.metro; try { syncTransport(); } catch (e) { } }
  commit(true); padPaint();
}
function padUndoPass() { const s = PAD.passes.pop(); if (!s) return; const o = JSON.parse(s); S.band.pat = o.pat; S.band.drumLen = o.len; S.band.patName = o.name; S.band.drumsOn = o.on; commit(true); padPaint(); }
function padClear() { PAD.passes.push(JSON.stringify({ pat: dpat(), len: padLen(), name: S.band.patName, on: S.band.drumsOn })); S.band.pat = DROWS.map(() => new Array(32).fill(0)); S.band.patName = 'Your groove'; commit(true); padPaint(); }

/* ---------- beatbox: kick, snare and hat told apart by their sound ---------- */
/** onsets in `x` (sample rate sr) → hits [{t, row, v}]: lows are kicks, hiss is a hat (a long one is open), the rest is a snare */
function bbHits(x, sr) {
  const hop = Math.round(sr * .005), n = Math.floor(x.length / hop), env = new Float32Array(n);
  for (let f = 0; f < n; f++) { let e = 0; for (let i = f * hop; i < (f + 1) * hop; i++) e += x[i] * x[i]; env[f] = Math.sqrt(e / hop); }
  let pk = 0; for (const v of env) pk = Math.max(pk, v); if (pk < 1e-4) return [];
  const hits = []; let last = -1e9;
  for (let f = 0; f < n - 2; f++) {
    const rise = env[f] - Math.max(f > 0 ? env[f - 1] : 0, f > 1 ? env[f - 2] * .9 : 0);      /* from the very first sample: a hit right at the start counts */ if (rise < pk * .12 || env[f] < pk * .15 || (f - last) * hop / sr < .09) continue;
    let top = f; while (top + 1 < n && env[top + 1] >= env[top] && top - f < 8) top++;
    const a = f * hop, w = Math.min(x.length - a, Math.round(sr * .06)); let lo = 0, hi = 0, tot = 0, y = 0, d = 0, prev = 0;
    const kl = Math.exp(-2 * Math.PI * 180 / sr), kh = Math.exp(-2 * Math.PI * 4500 / sr); let lp = 0, lp2 = 0;
    for (let i = a; i < a + w; i++) { const s = x[i]; lp = (1 - kl) * s + kl * lp; lp2 = (1 - kh) * s + kh * lp2; const hp = s - lp2; lo += lp * lp; hi += hp * hp; tot += s * s; }
    let len = 0; for (let g = top; g < n && env[g] > env[top] * .2; g++) len++;
    const lr = lo / (tot + 1e-12), hr = hi / (tot + 1e-12), dur = len * hop / sr;
    const row = lr > .45 ? 0 : hr > .35 ? (dur > .14 ? 3 : 2) : 1;
    hits.push({ t: a / sr, row, v: padLevel(env[top] / pk) }); last = f;
  }
  return hits;
}
/** the hits written onto a pattern of L 16ths: `t0` is the second the loop started in the recording, `slot` its 16th in seconds */
function bbPattern(hits, t0, slot, L) {
  const pat = DROWS.map(() => new Array(32).fill(0)); hits.forEach(h => { const i = Math.round((h.t - t0) / slot); if (i < 0 || i >= L * 2) return; const j = i % L; pat[h.row][j] = Math.max(pat[h.row][j], h.v); }); return pat;
}
/** beatbox over the click for the loop: a bar's count-in, then `bars` bars; the result goes on top of the pattern (or replaces it) */
async function padBeatbox(replace) {
  if (PAD.bb) return; if (REC || T.rec) { toast('The studio is recording. Stop it first.', 'warn'); return; } if (PAD.rec) padRecStop();
  await startAudio(); let mic; try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } }); }
  catch (e) { toast('The microphone is needed to hear your beatbox. ' + (e && e.name === 'NotAllowedError' ? 'Allow it in the address bar, then try again.' : (e.message || e.name)), 'warn'); return; }
  const c = E.ctx, src = c.createMediaStreamSource(mic), sp = c.createScriptProcessor(2048, 1, 1), z = c.createGain(); z.gain.value = 0; src.connect(sp); sp.connect(z); z.connect(c.destination);
  const n = padLen(), sd = slotDur(), bufs = []; let first = null;
  PAD.bb = { mic, stop: null }; padPaint('Count-in…');
  sp.onaudioprocess = ev => { if (first == null) first = ev.playbackTime; bufs.push(new Float32Array(ev.inputBuffer.getChannelData(0))); };
  const L0 = { loop: T.loop, a: T.loopA, b: T.loopB, metro: T.metro, drums: S.band.drumsOn };
  if (T.playing) stopPlay(true); const bar = Math.floor(T.cursor / spb()); T.cursor = bar * spb(); T.loop = false; T.metro = true; S.band.drumsOn = !replace && S.band.drumsOn;
  await play(); const t0 = T.next - (T.slot - T.startCursor) * sd + spb() * sd;      /* the loop starts a bar after the song does: that bar is the count-in */
  await new Promise(r => { PAD.bb.stop = r; setTimeout(r, (spb() + n) * sd * 1000 + 350); });
  sp.onaudioprocess = null; try { src.disconnect(); sp.disconnect(); } catch (e) { } mic.getTracks().forEach(t => t.stop()); stopPlay(true);
  Object.assign(T, { loop: L0.loop, loopA: L0.a, loopB: L0.b, metro: L0.metro }); S.band.drumsOn = L0.drums;
  const all = new Float32Array(bufs.reduce((a, b) => a + b.length, 0)); let o = 0; bufs.forEach(b => { all.set(b, o); o += b.length; });
  const lat = (c.baseLatency || 0) + (c.outputLatency || 0), hits = bbHits(all, c.sampleRate), pat = bbPattern(hits, t0 - (first || t0) + lat, sd, n);
  PAD.bb = null; const got = pat.reduce((a, r) => a + r.filter(Boolean).length, 0);
  if (!got) { padPaint(); toast('Nothing came through. Beatbox a little louder, close to the phone or the computer.', 'warn'); return; }
  PAD.passes.push(JSON.stringify({ pat: dpat(), len: padLen(), name: S.band.patName, on: S.band.drumsOn }));
  const cur = dpat(); S.band.pat = cur.map((r, ri) => Array.from({ length: 32 }, (_, i) => i < n ? (replace ? pat[ri][i] : Math.max(r[i] || 0, pat[ri][i])) : 0)); S.band.drumLen = n; S.band.patName = 'Your groove'; S.band.drumsOn = true;
  commit(true); padPaint(); toast('🎤 ' + got + ' hits written: ' + ['kick', 'snare', 'hat', 'open hat'].map((k, i) => pat[i].filter(Boolean).length + ' ' + k).filter(s => !/^0 /.test(s)).join(', ') + '. Press ▶ to hear it.', 'ok');
}

/* ---------- the room ---------- */
function padGrid() {
  const g = PAD.el && PAD.el.querySelector('.pad-grid'); if (!g) return; const L = padLen(), p = dpat(), sp = spb(), here = T.playing ? ((Math.floor(playheadSlot()) % L) + L) % L : -1;
  if (g.childElementCount !== 6 * (L + 1) || g.dataset.l !== String(L)) { g.innerHTML = ''; g.dataset.l = L; g.style.gridTemplateColumns = '64px repeat(' + L + ',minmax(0,1fr))';
    PAD_ROWS.forEach(([n], r) => { g.append(h('span', { class: 'pad-rn' }, n)); for (let i = 0; i < L; i++) g.append(h('button', { class: 'pad-c' + (i % sp === 0 ? ' bar' : i % 4 === 0 ? ' beat' : ''), 'data-r': r, 'data-i': i, 'aria-label': n + ', step ' + (i + 1), onclick: () => { const q = dpat(); q[r][i] = [2, 0, 3, 1][q[r][i] || 0];      /* off → normal → accent → ghost → off */ S.band.patName = 'Your groove'; commit(true); padGrid(); } })); }); }
  g.querySelectorAll('.pad-c').forEach(b => { const v = p[+b.dataset.r][+b.dataset.i] || 0; b.dataset.v = v; b.setAttribute('aria-pressed', String(v > 0)); b.classList.toggle('now', +b.dataset.i === here); });
}
function padPaint(msg) {
  const d = PAD.el; if (!d) return; const q = s => d.querySelector(s);
  q('.pad-bpm').textContent = Math.round(S.bpm) + ' BPM'; q('.pad-msg').textContent = msg || (PAD.rec ? '● Recording: play along, it loops. Press ● again to keep it.' : PAD.bb ? '🎤 Listening…' : PAD.taps.length && PAD.taps.length < 4 ? '' : '');
  const r = q('.pad-rec'); r.classList.toggle('on', !!PAD.rec); r.setAttribute('aria-pressed', String(!!PAD.rec)); r.textContent = PAD.rec ? '■ Keep it' : '● Record';
  q('.pad-play').textContent = T.playing ? '■ Stop' : '▶ Play'; q('.pad-undo').disabled = !PAD.passes.length || !!PAD.rec;
  q('.pad-bars').value = String(padBars()); q('.pad-follow').checked = S.band.bassStyle === 'Follow the Kick'; q('.pad-swing').value = String(S.swing || 0);
  q('.pad-bb').disabled = !!PAD.bb || !!PAD.rec; padGrid();
}
function padsOpen() {
  if (PAD.el && PAD.el.isConnected) { if (!PAD.el.open) PAD.el.showModal(); padPaint(); padTimer(); return PAD.el; }
  const pad = (r) => h('button', { class: 'pad', 'data-pad': r, 'aria-label': PAD_ROWS[r][0] + ' (key ' + PAD.keys[r].toUpperCase() + ')',
    onpointerdown: e => { e.preventDefault(); padHit(r, e.pointerType === 'pen' && e.pressure ? padLevel(e.pressure) : e.shiftKey ? 3 : 2); } },      /* a pen's pressure is real; fingers and mice play at the normal level (Shift: an accent) */
    h('i', { 'aria-hidden': 'true' }, PAD_ROWS[r][1]), h('b', {}, PAD_ROWS[r][0]), h('kbd', {}, PAD.keys[r].toUpperCase()));
  const d = h('dialog', { class: 'pads', id: 'pads', 'aria-label': 'Pads' },
    h('div', { class: 'pad-top' }, h('b', { class: 'pad-title' }, '👆 Pads'), h('span', { class: 'pad-bpm mono' }), h('button', { class: 'btn pad-tap', title: 'Tap four times or more to set the tempo (or press T here)', onclick: () => padTap() }, 'Tap tempo'),
      h('button', { class: 'btn pad-play', onclick: () => { T.playing ? stopPlay(true) : play(); setTimeout(padPaint, 60); } }, '▶ Play'), h('span', { style: { flex: 1 } }), h('button', { class: 'btn icon', 'aria-label': 'Close the pads', onclick: () => d.close() }, '✕')),
    h('div', { class: 'pad-pads' }, [0, 1, 2, 3, 4, 5].map(pad)),
    h('div', { class: 'pad-row' }, h('button', { class: 'btn primary pad-rec', 'aria-pressed': 'false', onclick: () => padRecord(+d.querySelector('.pad-bars').value) }, '● Record'),
      h('label', { class: 'field' }, 'Loop', h('select', { class: 'in pad-bars', onchange: e => { if (!PAD.rec) { padResize(+e.target.value * spb()); commit(true); padPaint(); } } }, h('option', { value: '1' }, '1 bar'), h('option', { value: '2' }, '2 bars'))),
      h('button', { class: 'btn pad-undo', onclick: () => padUndoPass() }, '↶ Last pass'), h('button', { class: 'btn', onclick: () => padClear() }, 'Clear'),
      h('button', { class: 'btn pad-bb', title: 'Beatbox the groove into the microphone: a bar’s count-in, then the loop', onclick: () => padBeatbox(false) }, '🎤 Beatbox it')),
    h('div', { class: 'pad-row' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', class: 'pad-follow', onchange: e => { if (e.target.checked) { PAD.bass0 = S.band.bassStyle; S.band.bassStyle = 'Follow the Kick'; S.band.bassOn = true; } else S.band.bassStyle = PAD.bass0 && PAD.bass0 !== 'Follow the Kick' ? PAD.bass0 : 'Root–Fifth'; commit(true); } }), 'Bass follows the kick'),
      h('label', { class: 'field pad-sw' }, 'Swing', h('input', { type: 'range', class: 'pad-swing', min: 0, max: .6, step: .05, oninput: e => { S.swing = +e.target.value; commit(false); } }))),
    h('p', { class: 'pad-msg small', role: 'status', 'aria-live': 'polite' }),
    h('div', { class: 'pad-grid', role: 'group', 'aria-label': 'The drum pattern: tap a step to change it' }),
    h('p', { class: 'tiny muted' }, 'Keys A S D F G H play the pads, T taps the tempo, Space plays. A MIDI pad controller plays them too (General MIDI drum notes). Each ● is a pass on top of the last; ↶ takes the last pass away.'));
  d.addEventListener('keydown', e => {
    const k = e.key.toLowerCase(), t = e.target; if (e.ctrlKey || e.metaKey || e.altKey || (t && /INPUT|SELECT|TEXTAREA/.test(t.tagName) && t.type !== 'checkbox' && t.type !== 'range')) return;
    const r = PAD.keys.indexOf(k); if (r >= 0 && !e.repeat) { e.preventDefault(); e.stopPropagation(); padHit(r, e.shiftKey ? 3 : 2); return; }
    if (k === 't') { e.preventDefault(); e.stopPropagation(); padTap(); return; }
    if (k === ' ') { e.preventDefault(); e.stopPropagation(); T.playing ? stopPlay(true) : play(); setTimeout(padPaint, 60); }
  });
  d.addEventListener('close', () => { if (PAD.rec) padRecStop(); if (PAD.bb && PAD.bb.stop) PAD.bb.stop(); clearInterval(PAD.tm); });
  document.body.append(d); PAD.el = d; d.showModal(); padPaint(); padTimer();
  return d;
}
/** the moving step marker and the play button, while the pads are open */
function padTimer() { clearInterval(PAD.tm); PAD.tm = setInterval(() => { if (!PAD.el || !PAD.el.open) return; padGrid(); const pb = PAD.el.querySelector('.pad-play'); if (pb) pb.textContent = T.playing ? '■ Stop' : '▶ Play'; }, 90); }
/* a MIDI pad controller plays the pads while they are open (and only then: the notes keep their other jobs elsewhere) */
MIDIRAW.push(data => { const [st, n, v] = data; if (!PAD.el || !PAD.el.open || (st & 0xf0) !== 0x90 || !v) return false; const r = PAD_GM[n]; if (r == null) return false; padHit(r, padLevel(v / 127)); return true; });
bus.on('transport', () => { if (PAD.el && PAD.el.open) padPaint(); if (PAD.rec && !T.playing) padRecStop(true); });
