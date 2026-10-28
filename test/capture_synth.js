/* string-like synth for tests: decaying harmonics with slight inharmonicity, a pick transient, a strum stagger */
window.SY = {
  string(m, sr, sec, o = {}) {
    const f = 440 * Math.pow(2, (m - 69) / 12) * (o.detune ? Math.pow(2, o.detune / 1200) : 1), n = Math.round(sr * sec), x = new Float32Array(n), amp = o.amp || .2, tau0 = (o.tau || .9) * (m < 50 ? 1.3 : 1);
    const H = Math.min(14, Math.floor(7000 / f)), ph = []; for (let h = 1; h <= H; h++) ph.push(((o.seed || 1) * 7.31 * h + m * 1.7) % 6.28);
    for (let h = 1; h <= H; h++) {
      const fh = f * h * Math.sqrt(1 + 0.00008 * h * h), a = amp / Math.pow(h, .9) * (h === 1 && m < 47 ? .6 : 1) * Math.abs(Math.sin(Math.PI * h * .17) + .25), tau = tau0 / Math.pow(h, .7), w = 2 * Math.PI * fh / sr;
      for (let i = 0; i < n; i++) x[i] += a * Math.sin(w * i + ph[h - 1]) * Math.exp(-i / sr / tau);
    }
    let s = 12345 + m; for (let i = 0; i < Math.min(n, sr * .012); i++) { s = (s * 1664525 + 1013904223) >>> 0; x[i] += ((s / 4294967296) - .5) * amp * .8 * (1 - i / (sr * .012)); }
    return x;
  },
  /** notes [midi...] struck at t0 (s) with a stagger between strings, mixed into `buf` (Float32Array) */
  strike(buf, sr, notes, t0, o = {}) { const gap = o.gap == null ? .009 : o.gap; notes.forEach((m, i) => { const s = this.string(m, sr, o.sec || .9, { amp: o.amp || .2, seed: i + 1, detune: o.detune }), off = Math.round((t0 + i * gap) * sr); for (let k = 0; k < s.length && off + k < buf.length; k++) buf[off + k] += s[k]; }); },
  /** the two windows the capture reads for an attack at t0 in `buf` */
  windows(buf, sr, t0) { const on = Math.round(t0 * sr), post = buf.slice(on + Math.round(.012 * sr), on + Math.round(.14 * sr)), pre = buf.slice(Math.max(0, on - Math.round(.1 * sr)), on - Math.round(.006 * sr)); return { post, pre }; }
};
