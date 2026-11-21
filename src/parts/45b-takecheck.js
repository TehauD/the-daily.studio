/* ============================================================
   Part 45b · Compare takes (2.75) — what each take actually did, side by side
   You record three passes and have to choose. This listens to each one (in the page, nothing is sent anywhere) and lays them side by side:
     · Timing   how far the notes land from the song's grid, on average (early or late) and how steady that is     — measured
     · Pitch    for a voice: how far held notes sit from the nearest note of the song's key, and how often in tune   — measured; which
                note was meant is an estimate (the nearest one in the key)
     · Level    the peak, how even the loudness is, and whether anything clipped                                     — measured
     · Noise    how quiet the quietest tenth of the take is                                                          — estimated
   It never chooses for you and never changes or deletes a take: it marks the best figure in each column, says in a sentence what stands
   out, and labels every number as measured or estimated. The figures are kept on the take (t.chk) so the lanes can show them later.
   ============================================================ */
const TKC = { busy: false, rows: null };
const tkcMs = v => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v)) + ' ms';
const tkcDb = v => (20 * Math.log10(Math.max(1e-6, v)));

/** measure one take (its trimmed part). Resolves to { timing, pitch, level, noise } with nulls where there was not enough to measure. */
async function takeCheck(tk) {
  const sr = tk.sr, d = tk.dry, a = Math.floor(tkIn(tk) * sr), b = Math.min(d.length, Math.floor(tkOut(tk) * sr)), win = 1024, hop = 512;
  const n = Math.max(0, Math.floor((b - a - win) / hop)), e = new Float32Array(n); let pk = 0, clip = 0;
  for (let i = 0; i < n; i++) { let s = 0; const o = a + i * hop; for (let k = 0; k < win; k++) { const v = d[o + k]; s += v * v; if (k < hop) { const av = v < 0 ? -v : v; if (av > pk) pk = av; if (av >= .999) clip++; } } e[i] = Math.sqrt(s / win); if (i % 2000 === 1999) await new Promise(r => setTimeout(r, 0)); }
  const out = { timing: null, pitch: null, level: null, noise: null, dur: (b - a) / sr }; if (n < 8) return out;
  const srt = Float32Array.from(e).sort(), floor = srt[Math.floor(n * .1)], loud = srt[Math.floor(n * .9)], gate = Math.max(Math.min(floor * 3, loud * .5), loud * .12, 1e-4);      /* a held note has no quiet tenth: never set the gate above half the loud level */
  /* level: the peak, clipping, and how even the played parts are (the spread of short-term loudness, in dB) */
  { let m = 0, c = 0; for (let i = 0; i < n; i++) if (e[i] > gate) { m += tkcDb(e[i]); c++; } m /= c || 1; let v = 0; for (let i = 0; i < n; i++) if (e[i] > gate) { const q = tkcDb(e[i]) - m; v += q * q; }
    out.level = { peak: tkcDb(pk), even: Math.sqrt(v / (c || 1)), clip, active: c / n }; out.noise = { floor: tkcDb(floor) }; }
  /* timing: each attack (loudness jumps over what came just before), placed to the sample, against the nearest sixteenth of the song's grid */
  { const slot = slotDur(), offs = []; let last = -1;
    for (let i = 3; i < n; i++) { const prev = (e[i - 1] + e[i - 2] + e[i - 3]) / 3; if (e[i] > gate && e[i] > prev * 1.8 && (i * hop / sr - last) > .07) {
      const o = a + i * hop; let wp = 0; for (let k = 0; k < win; k++) { const av = Math.abs(d[o + k]); if (av > wp) wp = av; } let k0 = 0; while (k0 < win && Math.abs(d[o + k0]) < wp * .25) k0++;
      const tSong = tk.startSec + (o + k0 - a) / sr, off = tSong - Math.round(tSong / slot) * slot; offs.push(off * 1000); last = i * hop / sr; } }
    if (offs.length >= 4) { const m = offs.reduce((x, y) => x + y, 0) / offs.length, sd = Math.sqrt(offs.reduce((x, y) => x + (y - m) * (y - m), 0) / offs.length); out.timing = { mean: m, spread: sd, hits: offs.length }; } }
  /* pitch (a voice): held, clear notes against the nearest note of the song's key */
  if (tk.kind === 'vox') { const F = 2048, sc = (typeof vbScale === 'function') ? vbScale() : null, cents = []; let done = 0;
    for (let i = 0; i + 4 < n && done < 500; i += 4) { if (e[i] <= gate || e[i + 2] <= gate) continue; const r = yin(d.subarray(a + i * hop, a + i * hop + F), sr, .12, 70); done++; if (done % 40 === 0) await new Promise(r2 => setTimeout(r2, 0));
      if (!r || r.clarity < .8) continue; const m = 69 + 12 * Math.log2(r.f / 440); let best = Math.round(m), bd = 9;
      for (let k = -2; k <= 2; k++) { const q = Math.round(m) + k; if (sc && !sc[((q % 12) + 12) % 12]) continue; if (Math.abs(q - m) < bd) { bd = Math.abs(q - m); best = q; } } cents.push((m - best) * 100); }
    if (cents.length >= 6) { const ab = cents.map(Math.abs).sort((x, y) => x - y); out.pitch = { off: ab[ab.length >> 1], bias: cents.reduce((x, y) => x + y, 0) / cents.length, inTune: ab.filter(c => c <= 25).length / ab.length, notes: cents.length }; } }
  tk.chk = out; return out;
}
/** the takes worth comparing with `tk`: the same kind (voice with voice, instrument with instrument), at least a second long */
function tkcPeers(tk) { const vox = tk && tk.kind === 'vox'; return TAKES.filter(t => ((t.kind === 'vox') === vox) && tkLen(t) >= 1 && t.dry && t.dry.length).slice(0, 8); }
/** which row is best in each column (lower is better, except "in tune"), and a sentence about what stands out — only when there is something to compare */
function tkcVerdict(rows) {
  const best = {}, pick = (key, get, hi) => { let bi = -1, bv = null; rows.forEach((r, i) => { const v = get(r.c); if (v == null) return; if (bv == null || (hi ? v > bv : v < bv)) { bv = v; bi = i; } }); if (bi >= 0 && rows.filter(r => get(r.c) != null).length > 1) best[key] = bi; };
  pick('spread', c => c.timing && c.timing.spread); pick('mean', c => c.timing && Math.abs(c.timing.mean)); pick('pitch', c => c.pitch && c.pitch.off); pick('inTune', c => c.pitch && c.pitch.inTune, true); pick('even', c => c.level && c.level.even); pick('noise', c => c.noise && c.noise.floor);
  const say = []; if (best.spread != null) say.push(rows[best.spread].name + ' is the steadiest in time (±' + Math.round(rows[best.spread].c.timing.spread) + ' ms)');
  if (best.pitch != null) say.push(rows[best.pitch].name + ' is the most in tune (' + Math.round(rows[best.pitch].c.pitch.off) + ' cents off, typically)');
  if (best.even != null && best.even !== best.spread) say.push(rows[best.even].name + ' is the most even in level');
  const clip = rows.filter(r => r.c.level && r.c.level.clip > 0).map(r => r.name); if (clip.length) say.push(clip.join(' and ') + (clip.length > 1 ? ' clip' : ' clips') + ' (the input was too hot)');
  return { best, say };
}
function tkcTable(rows) {
  const V = tkcVerdict(rows), tag = (k, t) => h('abbr', { class: 'tkc-tag tkc-' + k, title: k === 'm' ? 'Measured from the recording' : 'Estimated: a reasonable reading, not a fact' }, t || (k === 'm' ? 'measured' : 'estimated'));
  const cell = (txt, on, sub) => h('td', { class: on ? 'tkc-best' : '' }, txt == null ? h('span', { class: 'muted' }, '—') : txt, sub ? h('div', { class: 'tiny muted' }, sub) : null);
  const tb = h('table', { class: 'tkc-t', id: 'tkcTable' }, h('thead', {}, h('tr', {}, h('th', {}, 'Take'),
    h('th', {}, 'Timing ', tag('m')), h('th', {}, 'Steadiness ', tag('m')), h('th', {}, 'Pitch ', tag('m')), h('th', {}, 'In tune ', tag('m')), h('th', {}, 'Level ', tag('m')), h('th', {}, 'Noise ', tag('e')))),
    h('tbody', {}, rows.map((r, i) => { const c = r.c, t = c.timing, p = c.pitch, l = c.level;
      return h('tr', { 'data-take': r.tk.id }, h('th', { scope: 'row' }, r.name, h('div', { class: 'tiny muted' }, c.dur.toFixed(1) + ' s')),
        cell(t ? tkcMs(t.mean) : null, V.best.mean === i, t ? (Math.abs(t.mean) < 8 ? 'on the grid' : t.mean > 0 ? 'behind the beat' : 'ahead of the beat') : 'too few attacks'),
        cell(t ? '±' + Math.round(t.spread) + ' ms' : null, V.best.spread === i, t ? t.hits + ' attacks' : ''),
        cell(p ? Math.round(p.off) + ' cents' : null, V.best.pitch === i, p ? (Math.abs(p.bias) < 6 ? 'centred' : p.bias > 0 ? 'tends sharp' : 'tends flat') : (r.tk.kind === 'vox' ? 'no clear notes' : 'voices only')),
        cell(p ? Math.round(p.inTune * 100) + '%' : null, V.best.inTune === i, p ? p.notes + ' notes' : ''),
        cell(l ? '±' + l.even.toFixed(1) + ' dB' : null, V.best.even === i, l ? 'peak ' + l.peak.toFixed(1) + ' dB' + (l.clip ? ' · clips' : '') : ''),
        cell(c.noise ? Math.round(c.noise.floor) + ' dB' : null, V.best.noise === i, '')); })));
  return [h('div', { class: 'tkc-wrap' }, tb),
    h('p', { class: 'small', id: 'tkcSay' }, V.say.length ? V.say.join('. ') + '.' : (rows.length < 2 ? 'Record another pass and they will sit side by side here.' : 'Nothing separates these clearly.')),
    h('p', { class: 'tiny muted' }, 'The best figure in each column is marked. Nothing is changed or deleted: the choice is yours, and a take that is a little loose can still be the one with the feeling.')];
}
/** open the window and measure the takes of the same kind as `tk` (or the selected take, or the newest) */
function takeCheckOpen(tk) {
  tk = tk || TAKES.find(t => t.id === TKSEL.id) || TAKES[TAKES.length - 1]; if (!tk) { toast('Record a take first', ''); return null; }
  const box = h('div', { id: 'tkcBox' }, h('p', { class: 'small muted' }, 'Listening to the takes…'));
  const d = hubOpen('takecheck', { ico: '⚖', title: 'Compare takes', sub: 'What each take did, side by side. Measured in this page; nothing leaves it.', sections: [
    { key: 'cmp', label: 'Side by side', ico: '⚖', wide: true, body: () => [box] },
    { key: 'how', label: 'How it is measured', ico: 'ⓘ', body: () => [
      h('p', { class: 'small' }, 'Timing: every attack is placed against the nearest sixteenth of the song’s tempo. “Timing” is the average (behind or ahead of the beat); “Steadiness” is how much the attacks wander around that average. A take recorded without the click, or at another tempo, will read as loose.'),
      h('p', { class: 'small' }, 'Pitch (voices): held, clear notes against the nearest note of the song’s key. The distance is measured; which note you meant is an estimate, so a deliberate blue note or slide counts as “off”.'),
      h('p', { class: 'small' }, 'Level: how much the loudness of the played parts varies, the peak, and whether the input clipped. Noise is the quietest tenth of the take, an estimate of the room and the hiss.')] }] });
  TKC.busy = true; const peers = tkcPeers(tk);
  TKC.done = (async () => { const rows = []; for (const t of peers) { const lead = tkLead(t), cl = tkClips(lead); rows.push({ tk: t, name: lead.name + (cl.length > 1 ? ' · clip ' + (cl.indexOf(t) + 1) : ''), c: await takeCheck(t) }); }
    TKC.rows = rows; TKC.busy = false; box.innerHTML = ''; box.append(...tkcTable(rows)); bus.emit('takecheck', rows.length); return rows; })();
  return d;
}
