/* ============================================================
   Part 52 · Fretboard heatmap — where you play, how in tune it is, and which notes belong
   Three views on the Fretboard pane (mode “Heatmap”):
     Where you play   time spent on each string and fret
     How in tune      average cents flat / sharp at each position
     Which notes belong   every position coloured by the key and the current chord, sized by how much you used it
   Two sources: Live (what the microphone heard, kept for the session) and Song (the tab and the chord shapes of the song).
   Honest limit: one pitch can be played in several places on the neck, and a microphone hears the pitch, not the place.
   So live time is placed exactly only when the camera sees the hand, or the note has one possible place; otherwise it is shared out
   evenly across every place that note can be played, and the summary says how much was shared. Nothing here leaves the device.
   ============================================================ */
const HEAT = { view: 'where', src: 'live', t: {}, a: {}, cs: {}, cw: {}, tot: 0, amb: 0, tun: '', rev: 0, song: null, saved: 0, bar: null };
const heatTun = () => S.tuning.join(',') + '/' + S.capo;
(function heatLoad() { const d = store.get('heat', null); if (d && d.t && d.tun) { ['t', 'a', 'cs', 'cw'].forEach(k => { HEAT[k] = d[k] || {}; }); HEAT.tot = d.tot || 0; HEAT.amb = d.amb || 0; HEAT.tun = d.tun; } })();
function heatSave(force) {
  const n = performance.now(); if (!force && n - HEAT.saved < 4000) return; HEAT.saved = n;
  store.set('heat', { tun: HEAT.tun, t: HEAT.t, a: HEAT.a, cs: HEAT.cs, cw: HEAT.cw, tot: HEAT.tot, amb: HEAT.amb });
}
function heatReset() { HEAT.t = {}; HEAT.a = {}; HEAT.cs = {}; HEAT.cw = {}; HEAT.tot = 0; HEAT.amb = 0; HEAT.tun = heatTun(); HEAT.rev++; heatSave(true); paintFret(true); }
/** every (string, fret) that sounds this MIDI note with the current tuning and capo */
function heatCands(midi) { const out = []; S.tuning.forEach((o, st) => { const f = midi - o - S.capo; if (f >= 0 && f <= FB.frets) out.push({ st, f }); }); return out; }
function heatAdd(st, f, sec, cents, amb) {
  const k = st + ':' + f; HEAT.t[k] = (HEAT.t[k] || 0) + sec; if (amb) HEAT.a[k] = (HEAT.a[k] || 0) + sec;
  if (cents != null && isFinite(cents)) { HEAT.cs[k] = (HEAT.cs[k] || 0) + cents * sec; HEAT.cw[k] = (HEAT.cw[k] || 0) + sec; }
}
/** called when a live note ends (04-analysis noteOff): c = {midi, cs[], cam[]}, dur in seconds */
function heatLive(c, dur) {
  if (!c || !(dur > .05) || c.midi == null) return; if (HEAT.tun !== heatTun()) { HEAT.t = {}; HEAT.a = {}; HEAT.cs = {}; HEAT.cw = {}; HEAT.tot = 0; HEAT.amb = 0; HEAT.tun = heatTun(); }
  const cs = c.cs.slice(Math.floor(c.cs.length * .25)), cents = cs.length > 4 ? mean(cs) : null;
  const cam = (c.cam || []).filter(p => S.tuning[p.st] != null && S.tuning[p.st] + S.capo + p.fret === c.midi), exact = cam.length > 0;
  const pos = exact ? cam.map(p => ({ st: p.st, f: p.fret })) : heatCands(c.midi); if (!pos.length) return;
  const one = exact || pos.length === 1, w = dur / pos.length; pos.forEach(p => heatAdd(p.st, p.f, w, cents, !one));
  HEAT.tot += dur; if (!one) HEAT.amb += dur; HEAT.rev++; heatSave(false);
}
/** the song itself: every lead-tab note and the chord shapes, one slot of time each */
function heatSongBuild() {
  const t = {}, sd = slotDur(), N = spb(), add = (st, f, w) => { const k = st + ':' + f; t[k] = (t[k] || 0) + w; };
  flatBars().forEach(fb => {
    fb.bar.tab.forEach(n => { if (n.f !== 'x' && n.f != null && S.tuning[n.st] != null) add(n.st, +n.f, sd); });
    const ch = barChords(fb.bar); ch.forEach(sym => { const v = voicingFor(sym); if (v) v.frets.forEach((f, i) => { if (f != null) add(i, f, sd * N / ch.length * .5); }); });
  });
  return t;
}
/** position → { v (0..1 share of the busiest spot), t seconds, c mean cents or null, a ambiguous share } for the active source */
function heatMap() {
  const out = new Map(); let src, mx = 0;
  if (HEAT.src === 'song') { if (!HEAT.song) HEAT.song = heatSongBuild(); src = HEAT.song; }
  else { if (HEAT.tun !== heatTun()) { HEAT.t = {}; HEAT.a = {}; HEAT.cs = {}; HEAT.cw = {}; HEAT.tot = 0; HEAT.amb = 0; HEAT.tun = heatTun(); } src = HEAT.t; }
  Object.keys(src).forEach(k => { if (src[k] > mx) mx = src[k]; });
  Object.keys(src).forEach(k => { const live = HEAT.src !== 'song', w = live ? HEAT.cw[k] : 0; out.set(k, { v: mx ? src[k] / mx : 0, t: src[k], c: live && w > .15 ? HEAT.cs[k] / w : null, a: live ? (HEAT.a[k] || 0) / src[k] : 0 }); });
  return out;
}
const heatFmt = s => s < 90 ? s.toFixed(0) + ' s' : (s / 60).toFixed(1) + ' min';
const HEAT_COL = { flat: '#4a90d9', sharp: '#e8833a', ok: '#3fb27f', out: '#d64545' };
function paintHeat(force) {
  const root = FB.root == null ? S.key : FB.root, scPcs = FB.scPcs || new Set(), mp = heatMap(), v = HEAT.view; let chordPcs = new Set(), chordRoot = null;
  if (v === 'key') { let sym = null; if (FB.follow) { const ph = playheadSlot(), sp = spb(), bi = Math.floor(ph / sp), cd = chordAt(Math.max(0, bi), Math.max(0, Math.floor(ph) - bi * sp)); sym = cd && cd.sym; } if (!sym) sym = barChords((flatBars()[0] || { bar: { chord: '' } }).bar)[0]; const pc = sym && parseChord(sym); if (pc) { chordPcs = new Set(pc.pcs); chordRoot = pc.root; } }
  const key = ['H', v, HEAT.src, HEAT.rev, root, S.scale, [...chordPcs].join(), AN.midi, CFG.fretNames, S.tuning.join(), S.capo].join();
  if (!force && key === FB.key) return; FB.key = key;
  FB.nodes.forEach(row => row.forEach(nd => {
    const k = nd.st + ':' + nd.n, d = mp.get(k), has = !!d && d.t > 0, s = has ? Math.sqrt(d.v) : 0, inS = scPcs.has(nd.pc), inC = chordPcs.has(nd.pc);
    nd.g.style.display = ''; nd.gh.setAttribute('opacity', 0); nd.vo.setAttribute('opacity', 0); nd.cam.setAttribute('opacity', 0); nd.ring.setAttribute('opacity', AN.midi != null && AN.midi === nd.midi && HEAT.src === 'live' ? .95 : 0);
    let fill = 'var(--panel2)', stroke = 'var(--line2)', op = .5, sw = 1.2, tx = 'var(--muted)';
    if (v === 'where') { if (has) { fill = 'var(--accent)'; stroke = 'var(--accent)'; op = .2 + .8 * s; tx = s > .35 ? '#fff' : 'var(--text)'; } }
    else if (v === 'tune') {
      if (has && d.c != null) { const m = Math.abs(d.c); fill = m <= 7 ? HEAT_COL.ok : d.c < 0 ? HEAT_COL.flat : HEAT_COL.sharp; stroke = fill; op = .35 + .65 * Math.min(1, s + .15); tx = '#fff'; }
      else if (has) { fill = 'var(--muted)'; stroke = 'var(--muted)'; op = .25; }
    } else {
      const base = inC ? 'var(--accent)' : inS ? 'var(--accent2)' : HEAT_COL.out; fill = (inC || inS) ? base : 'var(--panel2)'; stroke = base; sw = nd.pc === root || nd.pc === chordRoot ? 3 : 1.5;
      op = has ? .6 + .4 * s : (inC || inS ? .3 : .16); tx = has && (inC || inS) ? '#fff' : 'var(--text)'; if (has && !inS && !inC) { fill = HEAT_COL.out; op = .5 + .5 * s; tx = '#fff'; }
    }
    nd.poly.setAttribute('fill', fill); nd.poly.setAttribute('stroke', stroke); nd.poly.setAttribute('opacity', op); nd.poly.setAttribute('stroke-width', sw);
    nd.txt.setAttribute('fill', tx); nd.txt.textContent = CFG.fretNames === 'frets' ? nd.n : CFG.fretNames === 'degrees' ? (IVNAMES[(nd.pc - root + 12) % 12]) : pcName(nd.pc);
  }));
  heatSummary(mp, root, scPcs);
}
function heatSummary(mp, root, scPcs) {
  const el = $('#fbheatsum'), info = $('#fbinfo'); if (!el) return; let tot = 0, ins = 0, cw = 0, ca = 0;
  mp.forEach((d, k) => { tot += d.t; const st = +k.split(':')[0], f = +k.split(':')[1], pc = (S.tuning[st] + S.capo + f) % 12; if (scPcs.has(pc)) ins += d.t; if (d.c != null) { cw += d.t; ca += Math.abs(d.c) * d.t; } });
  let msg;
  if (!tot) msg = HEAT.src === 'song' ? 'The song has no tab or chords yet.' : 'Nothing yet. Press Listen, play, and the places you use light up. Or switch Source to Song.';
  else if (HEAT.view === 'where') msg = HEAT.src === 'song' ? 'Every tab note and chord shape in the song. Brighter = more of the song lives there.' : heatFmt(HEAT.tot) + ' of playing · ' + (HEAT.tot ? Math.round(100 * (1 - HEAT.amb / HEAT.tot)) : 100) + '% placed exactly. The rest is shared across every place that note can be played, because a microphone hears the pitch, not the place (turn on the camera for exact positions).';
  else if (HEAT.view === 'tune') msg = HEAT.src === 'song' ? 'The song is written, not played, so there is no tuning data. Switch Source to Live.' : (cw ? 'Average ' + (ca / cw).toFixed(1) + '¢ off. Blue = flat, green = within 7¢, orange = sharp. Grey = played but too briefly to measure.' : 'No sustained notes measured yet. Hold a few notes for half a second or more.');
  else msg = Math.round(100 * ins / tot) + '% of ' + (HEAT.src === 'song' ? 'the song' : 'your playing') + ' is inside ' + pcName(root) + ' ' + S.scale + '. Red = outside the key, ring = root. Bright accent = chord tone of the chord under the playhead.';
  el.textContent = msg; if (info) info.textContent = pcName(root) + ' ' + S.scale + ' · ' + { where: 'where', tune: 'tuning', key: 'in key' }[HEAT.view];
  const lg = $('#fbheatlg'); if (lg) lg.dataset.v = HEAT.view;
}
function heatBar() {
  const sel = (opts, val, fn) => h('select', { class: 'in', style: { width: 'auto', fontFamily: 'var(--sans)' }, onchange: e => fn(e.target.value) }, opts.map(o => h('option', { value: o[0], selected: o[0] === val }, o[1])));
  const redo = () => { HEAT.rev++; FB.key = null; paintFret(true); };
  HEAT.bar = h('div', { class: 'heatbar', style: { display: 'none' } },
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', marginBottom: '6px' } },
      h('span', { class: 'small muted' }, 'Show'), sel([['where', 'Where you play'], ['tune', 'How in tune'], ['key', 'Which notes belong']], HEAT.view, v => { HEAT.view = v; redo(); }),
      h('span', { class: 'small muted' }, 'Source'), sel([['live', 'Live (microphone)'], ['song', 'Song (tab + chords)']], HEAT.src, v => { HEAT.src = v; HEAT.song = null; redo(); }),
      h('button', { class: 'btn sm', title: 'Clear the live heatmap', onclick: () => { heatReset(); toast('Heatmap cleared.', 'ok'); } }, 'Reset heatmap')),
    h('div', { class: 'tiny muted', id: 'fbheatsum', style: { marginBottom: '6px' } }),
    h('div', { class: 'heatlg', id: 'fbheatlg', 'data-v': HEAT.view }, h('i', { class: 'lg-where' }), h('i', { class: 'lg-tune' }), h('i', { class: 'lg-key' })));
  bus.on('song', () => { HEAT.song = null; HEAT.rev++; });
  bus.on('stats:reset', () => { HEAT.t = {}; HEAT.a = {}; HEAT.cs = {}; HEAT.cw = {}; HEAT.tot = 0; HEAT.amb = 0; HEAT.rev++; heatSave(true); });
  return HEAT.bar;
}
