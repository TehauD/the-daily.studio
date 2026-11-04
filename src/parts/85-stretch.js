/* ============================================================
   Part 85 · SPEED & KEY (2.35) — slow a song down without lowering it, or move it to another key without slowing it
     · ⏱ Speed (50–125%): the band, the click and the loaded track all play slower or faster; the pitch stays. For practice:
       the song itself is not changed (its tempo, its bars), and it is back to 100% with one press.
     · ♯ Key (−6…+6 semitones): the track is moved up or down without changing its speed. "Move the song's chords and tab too"
       (on by default) transposes the song with it, so the band and the chart follow; off, only the track moves. Kept with the song.
   The track is stretched as it plays by a phase vocoder (2048-point frames, a quarter-frame hop, identity phase locking so chords
   stay clean), then resampled for the key change, in a worker, two seconds ahead, one stem at a time so mute and solo still work.
   While the speed is not 100%, recording is paused (a take is kept in the song's time) and recorded takes stay quiet.
   ============================================================ */
const PS = { rate: 1, semi: 0, warned: 0, w: null, seq: 0, wait: new Map() };
const psOn = () => PS.rate !== 1 || PS.semi !== 0;
/** seconds of audio per 16th as it plays: the song's own (slotDur) divided by the practice speed */
const playDur = () => slotDur() / PS.rate;

/* ---------- the stretcher (runs in a worker; the same code runs here if a worker cannot start) ---------- */
function psDSPFactory() {
  const N = 2048, HS = 512, NB = N / 2 + 1, win = new Float32Array(N), TWO = Math.PI * 2;
  for (let i = 0; i < N; i++) win[i] = .5 - .5 * Math.cos(TWO * i / N);
  const LOG = Math.log2(N), rev = new Uint32Array(N), cs = new Float64Array(N / 2), sn = new Float64Array(N / 2);
  for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < LOG; b++) r |= ((i >> b) & 1) << (LOG - 1 - b); rev[i] = r; }
  for (let i = 0; i < N / 2; i++) { cs[i] = Math.cos(TWO * i / N); sn[i] = -Math.sin(TWO * i / N); }
  const fft = (re, im, inv) => {
    for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= N; size <<= 1) { const half = size >> 1, step = N / size; for (let i = 0; i < N; i += size) for (let j = 0, k = 0; j < half; j++, k += step) {
      const wr = cs[k], wi = inv ? -sn[k] : sn[k], a = i + j, b = a + half, tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; } }
  };
  const wrap = x => x - TWO * Math.round(x / TWO), norm = 1 / (1.5 * N);
  const re = new Float64Array(N), im = new Float64Array(N), mag = new Float64Array(NB), ph = new Float64Array(NB), peak = new Int32Array(NB);
  class Chan {
    reset(A, alpha, q) {
      this.alpha = alpha; this.q = q; this.ha = HS / alpha; const D = N; this.ipos = A - N / 2 - (D - N / 2) * this.ha / HS; this.last = null;
      this.prev = new Float64Array(NB); this.sum = new Float64Array(NB); this.acc = new Float64Array(N); this.skip = D;
      this.y = new Float32Array(1 << 15); this.yn = 0; this.yr = 1;      /* y: the stretched stream; yr: the resampler's place in it (1: room for the cubic's left point) */
    }
    frame() {
      const src = this.src, off = this.off, i0 = Math.floor(this.ipos), n = src.length;
      for (let i = 0; i < N; i++) { const j = i0 + i - off; re[i] = (j >= 0 && j < n ? src[j] / 32768 : 0) * win[i]; im[i] = 0; }
      fft(re, im, false);
      for (let k = 0; k < NB; k++) { mag[k] = Math.hypot(re[k], im[k]); ph[k] = Math.atan2(im[k], re[k]); }
      if (this.last == null) { for (let k = 0; k < NB; k++) this.sum[k] = ph[k]; }
      else {
        const ha = i0 - this.last; let np = 0;      /* the real analysis hop (frames start on whole samples) */
        for (let k = 0; k < NB; k++) { const m = mag[k]; if ((k < 2 || m > mag[k - 1] && m > mag[k - 2]) && (k > NB - 3 || m >= mag[k + 1] && m >= mag[k + 2])) peak[np++] = k; }
        const ns = new Float64Array(NB); if (!np) peak[np++] = 0;
        for (let p = 0; p < np; p++) { const k = peak[p], om = TWO * k / N, d = wrap(ph[k] - this.prev[k] - om * ha); ns[k] = this.sum[k] + (om + d / Math.max(1, ha)) * HS; }
        /* identity phase locking: every bin follows the peak it belongs to, keeping the phase it had relative to that peak */
        let p = 0; for (let k = 0; k < NB; k++) { while (p < np - 1 && Math.abs(peak[p + 1] - k) < Math.abs(peak[p] - k)) p++; const pk = peak[p]; if (k !== pk) ns[k] = ns[pk] + (ph[k] - ph[pk]); }
        this.sum = ns;
      }
      this.prev.set(ph); this.last = i0; this.ipos += this.ha;
      for (let k = 0; k < NB; k++) { re[k] = mag[k] * Math.cos(this.sum[k]); im[k] = mag[k] * Math.sin(this.sum[k]); }
      for (let k = 1; k < N / 2; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
      fft(re, im, true);
      const acc = this.acc; for (let i = 0; i < N; i++) acc[i] += re[i] * win[i] * norm;
      for (let i = 0; i < HS; i++) { if (this.skip > 0) { this.skip--; continue; } this.push(acc[i]); }
      acc.copyWithin(0, HS); acc.fill(0, N - HS);
    }
    push(v) { if (this.yn >= this.y.length) { const b = new Float32Array(this.y.length * 2); b.set(this.y); this.y = b; } this.y[this.yn++] = v; }
    out(len) {
      const o = new Float32Array(len), q = this.q; let k = 0;
      if (this.yn === 0 && this.yr === 1) { this.push(0); }      /* the cubic's left neighbour for the very first sample */
      while (k < len) {
        const i = Math.floor(this.yr); if (i + 2 >= this.yn) { this.frame(); continue; }
        const f = this.yr - i, y = this.y, a = y[i - 1], b = y[i], c = y[i + 1], d = y[i + 2];
        o[k++] = b + .5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a))); this.yr += q;
      }
      const drop = Math.floor(this.yr) - 2; if (drop > 4096) { this.y.copyWithin(0, drop, this.yn); this.yn -= drop; this.yr -= drop; }
      return o;
    }
  }
  const CH = [];
  /** one chunk: `chans` are the stems' Int16 samples from `off`; the output is `len` samples from track sample `start` on */
  function run(d) {
    const out = [];
    d.chans.forEach((src, c) => { const ch = CH[c] || (CH[c] = new Chan()); if (d.reset || ch.alpha !== d.alpha || ch.q !== d.q) ch.reset(d.start, d.alpha, d.q); ch.src = src; ch.off = d.off; out.push(ch.out(d.len)); });
    return out;
  }
  return { run, N };
}
function psWorker() {
  if (PS.w !== null) return PS.w;
  try {
    const url = URL.createObjectURL(new Blob(['const D=(' + psDSPFactory.toString() + ')();onmessage=e=>{const o=D.run(e.data);postMessage({seq:e.data.seq,out:o},o.map(a=>a.buffer));};'], { type: 'text/javascript' }));
    PS.w = new Worker(url); PS.w.onmessage = e => { const r = PS.wait.get(e.data.seq); if (r) { PS.wait.delete(e.data.seq); r(e.data.out); } };
    PS.w.onerror = () => { PS.w = false; PS.wait.forEach(r => r(null)); PS.wait.clear(); };
  } catch (e) { PS.w = false; }
  return PS.w;
}
let PS_LOCAL = null;
function psRun(d) {
  const w = psWorker(); d.seq = ++PS.seq;
  if (!w) { PS_LOCAL = PS_LOCAL || psDSPFactory(); return Promise.resolve(PS_LOCAL.run(d)); }
  return new Promise(res => { PS.wait.set(d.seq, res); w.postMessage(d, d.chans.map(a => a.buffer)); });
}

/* ---------- the track, stretched as it plays (called from spSched in part 16 when psOn()) ---------- */
const PS_CHANS = c => [c.drumsL, c.drumsR, c.bass, c.vox, c.otherL, c.otherR];
function psSched() {
  if (!STP.playing || !STM.ch || STP.psBusy) return; const c = E.ctx, sr = STM.sr; STP.segs = STP.segs.filter(s => s.t + s.dur > c.currentTime - 2);
  if (STP.curT >= c.currentTime + 4.5) return;
  const L = STM.loop.on && STM.loop.a != null && STM.loop.b != null && STM.loop.b - STM.loop.a > .2, rate = PS.rate, q = Math.pow(2, PS.semi / 12);
  let end = STP.cur + 2 * rate; if (L && STP.cur < STM.loop.b) end = Math.min(end, STM.loop.b); end = Math.min(end, STM.dur);
  if (end - STP.cur < .02) { if (L) { STP.cur = STM.loop.a; STP.psNext = null; return psSched(); } STP.playing = false; setTimeout(() => { if (!STP.playing) { STP.pos = 0; spStop(); syncStemUI(); } }, Math.max(0, (STP.curT - c.currentTime) * 1000)); return; }
  const start = Math.round(STP.cur * sr), span = (end - STP.cur) * sr, len = Math.max(64, Math.round(span / rate)), M = 4 * 2048 + 64, off = Math.max(0, start - M), stop = Math.min(STM.n, Math.ceil(start + span + M));
  const reset = STP.psNext == null || Math.abs(STP.psNext - start) > 2, from = STP.cur, t = STP.curT, gen = STP.psGen;
  const chans = PS_CHANS(STM.ch).map(a => a.slice(off, stop));
  STP.psBusy = true; STP.psNext = start + len * rate; STP.cur = end; if (L && STP.cur >= STM.loop.b - 1e-6) STP.cur = STM.loop.a; STP.curT += len / sr;
  psRun({ chans, off, start, len, alpha: q / rate, q, reset }).then(out => {
    STP.psBusy = false; if (!out || gen !== STP.psGen || !STP.playing) return;
    const now = c.currentTime, late = Math.max(0, now + .02 - t), seg = { t, from, dur: len / sr, rate, srcs: [] }, pair = [[0, 1], [2, 2], [3, 3], [4, 5]];
    STMS.forEach((_, si) => { const buf = c.createBuffer(2, len, sr); buf.getChannelData(0).set(out[pair[si][0]]); buf.getChannelData(1).set(out[pair[si][1]]); const src = c.createBufferSource(); src.buffer = buf; src.connect(STP.sg[si]); if (late < len / sr) src.start(t + late, late); seg.srcs.push(src); });
    STP.segs.push(seg); psSched();
  });
}

/* ---------- changing speed or key ---------- */
/** restart whatever is playing at the same place, so the new speed or key takes over at once */
async function psRestart() {
  STP.psGen = (STP.psGen || 0) + 1; STP.psNext = null;
  if (T.playing) { const s = Math.max(0, Math.floor(playheadSlot())); stopPlay(true); T.cursor = Math.min(s, Math.max(0, songSlots() - 1)); await play(); }
  else if (STP.playing) { const p = spPos(); spStop(); await spPlay(null, p); }
}
function psSpeed(r) {
  r = Math.round(clamp(+r || 1, .5, 1.25) * 100) / 100; if (r === PS.rate) return; PS.rate = r; psRestart(); psPaint(); bus.emit('speed', r);
  if (r !== 1 && Date.now() - PS.warned > 60000) { PS.warned = Date.now(); toast('Speed ' + Math.round(r * 100) + '%: the band, the click and the track slow down, the pitch stays. Recording waits until you are back at 100%.', 'ok'); }
}
/** move the key by `d` semitones (absolute: the track's shift from the original); `song` also transposes the chords and tab */
function psKey(semi, song) {
  semi = Math.max(-6, Math.min(6, Math.round(+semi || 0)));
  if (!STM.ch) { const d = semi - PS.keyOff; if (!d) return; PS.keyOff = semi; const bf = snap(); songTranspose(d); histPush(bf); bus.emit('song', 'reload'); if (T.playing) psRestart(); psPaint(); return; }      /* no track: the key moves the song (and so the band) */
  const d = semi - PS.semi; if (!d) return;
  if (song) { const bf = snap(); songTranspose(d); histPush(bf); bus.emit('song', 'reload'); }
  PS.semi = semi; if (S.track) S.track.semi = semi; commit(false); psRestart(); psPaint(); bus.emit('speed', PS.rate);
}
PS.keyOff = 0;
/* the track's key shift is kept with the song (S.track.semi): a song opened later brings its own */
bus.on('song', () => { if (!S.track) return; const s = S.track.semi || 0; if (s !== PS.semi) { PS.semi = s; STP.psNext = null; psPaint(); } });

/* ---------- the control: ⏱ in the transport ---------- */
function psButton() {
  const b = h('button', { class: 'btn sm ps-btn', id: 'psBtn', type: 'button', title: 'Speed and key: slow down without lowering the pitch, or change the key', 'aria-haspopup': 'dialog', onclick: e => psPop(e.currentTarget) });
  PS.btn = b; psPaint(); return b;
}
function psPaint() {
  const b = PS.btn; if (!b) return; const on = psOn(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  b.textContent = '⏱ ' + Math.round(PS.rate * 100) + '%' + (PS.semi ? ' · ' + (PS.semi > 0 ? '+' : '') + PS.semi : '');
  const p = document.getElementById('psPop'); if (p) { const s = p.querySelector('#psRate'), v = p.querySelector('#psRateV'), k = p.querySelector('#psKeyV'); if (s) s.value = PS.rate * 100; if (v) v.textContent = Math.round(PS.rate * 100) + '%'; if (k) { const v = STM.ch ? PS.semi : PS.keyOff; k.textContent = (v > 0 ? '+' : '') + v + ' · ' + pcName(S.key, CFG.flats) + (S.minor ? 'm' : ''); } }
}
function psPop(anchor) {
  const moveSong = () => { const c = document.getElementById('psSong'); return !c || c.checked; }, cur = () => STM.ch ? PS.semi : PS.keyOff;
  const box = h('div', { class: 'ps-pop', id: 'psPop' },
    h('h5', {}, '⏱ Speed'),
    h('div', { class: 'lrow' }, h('input', { type: 'range', id: 'psRate', min: 50, max: 125, step: 5, value: PS.rate * 100, 'aria-label': 'Speed', style: { flex: 1 }, onchange: e => psSpeed(+e.target.value / 100), oninput: e => { document.getElementById('psRateV').textContent = e.target.value + '%'; } }), h('b', { class: 'mono', id: 'psRateV' }, Math.round(PS.rate * 100) + '%')),
    h('div', { class: 'ps-pre' }, [50, 60, 70, 75, 80, 90, 100].map(v => h('button', { class: 'btn sm', type: 'button', 'data-rate': v, onclick: () => psSpeed(v / 100) }, v + '%'))),
    h('p', { class: 'tiny muted' }, 'The band, the click and the loaded track play slower; the pitch stays. Your song is not changed.'),
    h('h5', {}, '♯ Key'),
    h('div', { class: 'lrow' }, h('button', { class: 'btn sm', id: 'psDown', type: 'button', 'aria-label': 'Down a semitone', onclick: () => psKey(cur() - 1, moveSong()) }, '−'), h('b', { class: 'mono', id: 'psKeyV', style: { minWidth: '70px', textAlign: 'center' } }), h('button', { class: 'btn sm', id: 'psUp', type: 'button', 'aria-label': 'Up a semitone', onclick: () => psKey(cur() + 1, moveSong()) }, '+'), h('button', { class: 'btn sm', type: 'button', onclick: () => psKey(0, moveSong()) }, 'Original')),
    STM.ch ? h('label', { class: 'chk tiny' }, h('input', { type: 'checkbox', id: 'psSong', checked: true }), 'Move the song’s chords and tab too, so the band follows') : null,
    h('p', { class: 'tiny muted' }, STM.ch ? 'The track moves without changing speed. A singer’s range, or a capo you do not want: up or down up to 6.' : 'No track is loaded: the key moves the song’s chords and tab (and the band).'),
    h('div', { class: 'row' }, h('button', { class: 'btn sm', id: 'psReset', type: 'button', onclick: () => { psSpeed(1); } }, '100% speed')));
  popover(anchor, box, { style: { width: '320px', maxWidth: '94vw' } }); psPaint();
}
