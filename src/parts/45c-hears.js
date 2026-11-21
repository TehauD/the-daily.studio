/* ============================================================
   Part 45c · What the studio hears (2.76) — one page about the open song
   The detectors lived in six places (chart import, stems, hum, the coach, the take check, the soundprint) and nothing gathered them.
   This listens to the song you have open and says, in plain words, what it found, each finding labelled:
     · Measured    counted or timed from your sound or your chart (a range, a bar count, how long the song is)
     · Estimated   a reasonable reading, not a fact (the key the chords point to; the tempo you tend to play at)
     · Suggestion  a thought for you to take or leave
   Every finding says how it was reached ("Why?"). The ones that would change the song (its key, its tempo) have an Apply that first keeps
   a version of the song and can be undone with one tap. Nothing is applied for you, nothing is uploaded, no take is touched.
   ============================================================ */
const HRS = { busy: false, rows: [], done: null };
const hrsYield = () => new Promise(r => setTimeout(r, 0));
const hrsKeyName = k => pcName(k.root) + (k.minor ? ' minor' : ' major');

/** the key the chords point to: every chord's notes counted (roots a little more), the first and last chord weighted — estimated */
function hrsChordKey() {
  const hst = new Array(12).fill(0); let n = 0, first = null, last = null;
  S.sections.forEach(s => s.bars.forEach(b => barChords(b).forEach(sym => { const c = parseChord(sym); if (!c) return; n++; c.pcs.forEach(p => { hst[p] += p === c.root ? 1.4 : 1; }); if (!first) first = c; last = c; })));
  if (n < 3) return null;
  hst[first.root] += 3; hst[last.root] += 2;
  const r = detectKey(hst); return { root: r[0].root, minor: r[0].minor, gap: r[0].r - r[1].r, n, alt: r[1] };
}

/** attack times in a take (seconds into the trimmed part) */
function hrsOnsets(tk) {
  const sr = tk.sr, d = tk.dry, a = Math.floor(tkIn(tk) * sr), b = Math.min(d.length, Math.floor(tkOut(tk) * sr)), win = 1024, hop = 512, n = Math.max(0, Math.floor((b - a - win) / hop)), e = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; const o = a + i * hop; for (let k = 0; k < win; k += 2) { const v = d[o + k]; s += v * v; } e[i] = Math.sqrt(s / (win / 2)); }
  if (n < 16) return [];
  const srt = Float32Array.from(e).sort(), floor = srt[Math.floor(n * .1)], loud = srt[Math.floor(n * .9)], gate = Math.max(Math.min(floor * 3, loud * .5), loud * .12, 1e-4), out = []; let last = -1;
  for (let i = 3; i < n; i++) { const prev = (e[i - 1] + e[i - 2] + e[i - 3]) / 3, t = i * hop / sr; if (e[i] > gate && e[i] > prev * 1.8 && t - last > .07) { out.push(t); last = t; } }
  return out;
}
/** the tempo a take was played at, read from the spacing of its attacks against the song's grid (only near the song's own tempo) — estimated */
function hrsTempo(takes) {
  const imp = [];
  for (const tk of takes) { const on = hrsOnsets(tk), beat = 60 / S.bpm;
    for (let i = 1; i < on.length; i++) { const ioi = on[i] - on[i - 1]; if (ioi < .12 || ioi > 2) continue; const q = Math.max(.25, Math.round(ioi / beat * 4) / 4), bpm = 60 * q / ioi; if (bpm > S.bpm * .75 && bpm < S.bpm * 1.33) imp.push(bpm); } }
  if (imp.length < 8) return null; imp.sort((x, y) => x - y);
  const med = imp[imp.length >> 1], dev = imp.map(v => Math.abs(v - med)).sort((x, y) => x - y)[imp.length >> 1]; return { bpm: med, wob: dev / med * 100, n: imp.length };
}
/** the notes a voice held, across its takes: the range (5th to 95th percentile, so one stray squeak does not count) and the key they sit in — measured / estimated */
async function hrsVoice(takes) {
  const midis = [], hst = new Array(12).fill(0);
  for (const tk of takes) { const sr = tk.sr, d = tk.dry, a = Math.floor(tkIn(tk) * sr), b = Math.min(d.length, Math.floor(tkOut(tk) * sr)), F = 2048, hop = 2048, n = Math.floor((b - a - F) / hop); if (n < 4) continue;
    let mx = 0; const rm = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < F; k += 4) { const v = d[a + i * hop + k]; s += v * v; } rm[i] = Math.sqrt(s / (F / 4)); if (rm[i] > mx) mx = rm[i]; }
    let done = 0; for (let i = 0; i < n && done < 400; i++) { if (rm[i] < mx * .2) continue; const r = yin(d.subarray(a + i * hop, a + i * hop + F), sr, .12, 70); done++; if (done % 40 === 0) await hrsYield();
      if (!r || r.clarity < .85 || r.f < 70 || r.f > 1400) continue; const m = 69 + 12 * Math.log2(r.f / 440); midis.push(m); hst[((Math.round(m) % 12) + 12) % 12] += 1; } }
  if (midis.length < 12) return null; midis.sort((x, y) => x - y);
  const lo = midis[Math.floor(midis.length * .05)], hi = midis[Math.floor(midis.length * .95)], k = detectKey(hst);
  return { lo: Math.round(lo), hi: Math.round(hi), n: midis.length, key: { root: k[0].root, minor: k[0].minor, gap: k[0].r - k[1].r } };
}
/** sections, repeats, length — counted from the chart */
function hrsStructure() {
  const bars = totalBars(), secs = S.sections.length, sec = bars * S.ts[0] * (60 / S.bpm) * (4 / S.ts[1]);
  const sig = s => s.bars.map(b => (b.chord || '').trim()).join('|'), seen = {}; let repeats = 0;
  S.sections.forEach(s => { const g = sig(s); if (g.replace(/\|/g, '')) { if (seen[g]) repeats++; seen[g] = 1; } });
  const names = S.sections.map(s => (s.name || '').toLowerCase()), has = re => names.some(n => re.test(n)), count = re => names.filter(n => re.test(n)).length;
  return { bars, secs, sec, repeats, has, count };
}
const hrsTime = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');

/** gather everything into findings: { id, kind: 'measured'|'estimated'|'suggestion', title, text, why, apply?, applied? } */
async function hearsGather() {
  const F = [], takes = (typeof TAKES !== 'undefined' ? TAKES : []).filter(t => t.dry && t.dry.length && tkLen(t) >= 1), vox = takes.filter(t => t.kind === 'vox').slice(0, 4), any = takes.slice(0, 6);
  const st = hrsStructure();
  if (!st.bars) return [{ id: 'empty', kind: 'measured', title: 'Nothing here yet', text: 'This song has no bars. Add a section, or hum or play an idea, and this page will have something to say.', why: 'It reads the chords, bars and takes of the song that is open.' }];
  /* structure (measured) */
  F.push({ id: 'shape', kind: 'measured', title: 'The shape', text: st.secs + ' section' + (st.secs === 1 ? '' : 's') + ', ' + st.bars + ' bars, about ' + hrsTime(st.sec) + ' at ' + (Math.round(S.bpm * 10) / 10) + ' BPM in ' + S.ts[0] + '/' + S.ts[1] + '.', why: 'Counted from the chart: the bars in every section, at the song’s tempo and time signature.' });
  /* key from the chords (estimated), against what the song says */
  const ck = hrsChordKey(), cur = { root: S.key, minor: !!S.minor };
  if (ck) { const same = ck.root === cur.root && ck.minor === cur.minor, rel = ck.minor !== cur.minor && (ck.minor ? ck.root === (cur.root + 9) % 12 : ck.root === (cur.root + 3) % 12);
    if (same) F.push({ id: 'key', kind: 'estimated', title: 'The chords agree with the key', text: 'The chords point to ' + hrsKeyName(ck) + ', which is the key the song is set to.', why: 'Every chord’s notes were counted (roots a little more), the first and last chords weighted, and compared with the profile of each major and minor key. ' + ck.n + ' chords were read. It is a reading, not a fact.' });
    else F.push({ id: 'key', kind: 'suggestion', title: rel ? 'The chords sit in the relative key' : 'The chords point to a different key', text: 'The chords look like ' + hrsKeyName(ck) + '; the song is set to ' + hrsKeyName(cur) + '.' + (rel ? ' They share the same notes, so nothing is wrong: it is a question of which chord feels like home.' : ''),
      why: 'Every chord’s notes were counted (roots a little more), the first and last chords weighted, and compared with the profile of each major and minor key (' + ck.n + ' chords). ' + (ck.gap < .05 ? 'It was close, so this is a weak reading. ' : '') + 'The key setting drives the scale shown on the neck and what the coach and the take check call “in tune”, so set it to what you hear.',
      apply: () => { S.key = ck.root; S.minor = ck.minor; S.scale = ck.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'; }, applyLabel: 'Set the song to ' + hrsKeyName(ck) }); }
  else F.push({ id: 'key', kind: 'suggestion', title: 'No chords to read a key from', text: 'Add a few chords and this will say which key they point to.', why: 'At least three chords are needed.' });
  /* what was sung (measured range, estimated key) */
  if (vox.length) { HRS.status('Listening to your voice…'); const v = await hrsVoice(vox);
    if (v) { F.push({ id: 'range', kind: 'measured', title: 'Your range in these takes', text: midiName(v.lo) + ' to ' + midiName(v.hi) + ' (' + (v.hi - v.lo) + ' semitones).', why: 'The lowest and highest held, clear notes across ' + vox.length + ' vocal take' + (vox.length === 1 ? '' : 's') + ' (' + v.n + ' notes; the outer 5% is ignored so a stray squeak does not count). It is where you sang, not the limit of your voice.' });
      const sk = v.key; if (sk.gap > .08 && (sk.root !== cur.root || sk.minor !== cur.minor) && !(ck && sk.root === ck.root && sk.minor === ck.minor)) F.push({ id: 'vkey', kind: 'estimated', title: 'What you sang sits in ' + hrsKeyName(sk), text: 'The notes you held look like ' + hrsKeyName(sk) + (ck ? ', the chords say ' + hrsKeyName(ck) : '') + '.', why: 'The notes held in your vocal takes were counted and compared with each key’s profile. A melody can wander outside its key on purpose, so this only tells you where it spends its time.' }); } }
  /* tempo played (estimated) */
  if (any.length) { HRS.status('Listening to the timing…'); await hrsYield(); const t = hrsTempo(any);
    if (t) { const diff = (t.bpm - S.bpm) / S.bpm * 100, round = Math.round(t.bpm * 10) / 10;
      if (Math.abs(diff) < 3) F.push({ id: 'tempo', kind: 'estimated', title: 'You play with the tempo', text: 'Your attacks average about ' + round + ' BPM against the song’s ' + (Math.round(S.bpm * 10) / 10) + ', within ' + Math.abs(diff).toFixed(1) + '%.' + (t.wob > 4 ? ' The spacing wanders by about ' + t.wob.toFixed(0) + '%.' : ' The spacing is steady.'), why: 'The spacing between attacks in your takes was set against the song’s grid (to the nearest sixteenth) and the middle value taken (' + t.n + ' gaps). It only looks near the song’s tempo.' });
      else F.push({ id: 'tempo', kind: 'suggestion', title: 'You tend to play ' + (diff > 0 ? 'faster' : 'slower') + ' than the song', text: 'Your attacks average about ' + round + ' BPM; the song is at ' + (Math.round(S.bpm * 10) / 10) + '.', why: 'The spacing between attacks in your takes was set against the song’s grid (to the nearest sixteenth) and the middle value taken (' + t.n + ' gaps). If the song feels better where you naturally play, set it there; if you are rushing or dragging, leave the tempo alone and practise to the click.',
        apply: () => { S.bpm = round; }, applyLabel: 'Set the song to ' + round + ' BPM' }); } }
  /* structure thoughts (suggestions, never applied) */
  const T = []; const hasCh = st.has(/chorus|hook|refrain/), hasV = st.has(/verse/);
  if (st.secs >= 2 && hasV && !hasCh) T.push('There is a verse but no chorus. A section that comes back, with the same words, is usually what people remember.');
  if (hasCh && st.count(/chorus|hook|refrain/) === 1 && st.secs >= 3) T.push('The chorus appears once. Repeating it after the last verse (or after a bridge) is the common way to land the song.');
  if (st.secs >= 3 && !st.has(/intro/) && !st.has(/outro|end/)) T.push('There is no intro or outro. A few bars of either can make the song feel finished.');
  if (st.sec && st.sec < 60 && st.secs >= 2) T.push('At about ' + hrsTime(st.sec) + ' this is a sketch. That is a good place to start: try repeating the part you like most.');
  if (st.repeats === 0 && st.secs >= 3) T.push('No two sections share the same chords. Reusing a progression in two places helps a listener find their footing.');
  const odd = S.sections.filter(s => s.bars.length % 2 === 1).map(s => s.name); if (odd.length) T.push((odd.length > 2 ? 'Several sections' : odd.join(' and ')) + ' ' + (odd.length === 1 ? 'has' : 'have') + ' an odd number of bars. That is fine if you meant it; most phrases are 2, 4 or 8.');
  T.forEach((t, i) => F.push({ id: 'think' + i, kind: 'suggestion', title: 'A thought', text: t, why: 'A pattern common in songs, read from the section names, bar counts and chords. It is not a rule; your song, your call.' }));
  if (!T.length) F.push({ id: 'think0', kind: 'suggestion', title: 'Nothing to flag in the structure', text: 'The sections, repeats and phrase lengths look ordinary. Whether it is good is for you to say.', why: 'Section names, bar counts and repeated chords were checked against common song shapes.' });
  return F;
}
HRS.status = t => { const b = document.getElementById('hrsBox'); if (b && HRS.busy && b.firstChild && b.firstChild.className === 'hrs-wait') b.firstChild.textContent = t; };

/** one finding as a card: a label, the words, "Why?", and (for the ones that change the song) Apply / Undo */
function hrsCard(f) {
  const lab = f.kind === 'measured' ? ['m', 'Measured'] : f.kind === 'estimated' ? ['e', 'Estimated'] : ['s', 'Suggestion'], card = h('div', { class: 'hrs-card', 'data-id': f.id, 'data-kind': f.kind });
  const row = h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } });
  const paint = () => { row.replaceChildren(); if (!f.apply) return;
    if (!f.applied) row.append(h('button', { class: 'btn sm primary', type: 'button', 'data-act': 'apply', onclick: () => { vhSnap('before “' + f.title + '”', true); histStack.cur = snap(); /* so Undo reverts only this change, never a take recorded since the last snapshot */ f.apply(); commit(true); f.applied = true; toast('Done. Undo is one tap away.', 'ok'); paint(); bus.emit('hears', f.id); } }, f.applyLabel || 'Apply'));
    else row.append(h('span', { class: 'tiny muted' }, 'Applied. '), h('button', { class: 'btn sm', type: 'button', 'data-act': 'undo', onclick: () => { undo(); f.applied = false; toast('Put back.', 'ok'); paint(); bus.emit('hears', f.id); } }, '↶ Undo')); };
  paint();
  card.append(h('div', { class: 'row', style: { gap: '8px', alignItems: 'baseline' } }, h('abbr', { class: 'tkc-tag tkc-' + lab[0], title: lab[0] === 'm' ? 'Counted or timed from the sound or the chart' : lab[0] === 'e' ? 'A reasonable reading, not a fact' : 'A thought for you to take or leave' }, lab[1]), h('b', {}, f.title)),
    h('p', { class: 'small', style: { margin: '4px 0' } }, f.text), row, h('details', { class: 'hrs-why' }, h('summary', { class: 'tiny muted' }, 'Why?'), h('p', { class: 'tiny muted' }, f.why)));
  return card;
}

function hearsOpen() {
  const box = h('div', { id: 'hrsBox' }, h('p', { class: 'small muted hrs-wait' }, 'Listening to the song…'));
  const d = hubOpen('hears', { ico: '🧠', title: 'What the studio hears', sub: 'A plain reading of the open song. Measured, estimated or a suggestion, always labelled. Nothing leaves this page.', sections: [
    { key: 'now', label: 'This song', ico: '🧠', wide: true, body: () => [box] },
    { key: 'how', label: 'How to read this', ico: 'ⓘ', body: () => [
      h('p', { class: 'small' }, h('b', {}, 'Measured'), ' means counted or timed from your sound or your chart: a range, a bar count, a length.'),
      h('p', { class: 'small' }, h('b', {}, 'Estimated'), ' means a reasonable reading that can be wrong: the key the chords point to, the tempo you tend to play at.'),
      h('p', { class: 'small' }, h('b', {}, 'Suggestion'), ' is a thought, never a rule. Anything that would change the song keeps a version first and can be undone with one tap. Nothing is changed unless you tap it.')] }] });
  HRS.busy = true;
  HRS.done = hearsGather().then(rows => { HRS.rows = rows; HRS.busy = false; box.replaceChildren(...rows.map(hrsCard), h('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } }, h('button', { class: 'btn sm', type: 'button', id: 'hrsAgain', onclick: () => { d && d.close && d.close(); hearsOpen(); } }, '↻ Listen again'), TAKES.length > 1 ? h('button', { class: 'btn sm', type: 'button', onclick: () => takeCheckOpen() }, '⚖ Compare takes') : null)); bus.emit('hears', rows.length); return rows; })
    .catch(e => { HRS.busy = false; box.replaceChildren(h('p', { class: 'small' }, 'Could not read this song: ' + (e && e.message || e))); return []; });
  return d;
}
