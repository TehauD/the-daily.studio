/* ============================================================
   Part 47 · Open a MIDI file as a song
   A Standard MIDI File (.mid / .midi / .kar) is read on this device. You choose which track is the melody; the rest of the tracks decide
   the chords (or, when the file is only a melody, the chords are worked out from it the way Hum to Song does). The result is a new song:
   chords per bar, the melody on the lead tab, the tempo and time signature from the file, words from karaoke files, and the band switched on.
   Nothing is uploaded. Drums in the file are not copied; the band plays its own pattern.
   ============================================================ */
const SMF = { maxBytes: 8 * 1048576, maxNotes: 300000, maxBars: 160, part: 8 };
const SMF_FAMILY = ['Piano', 'Chromatic percussion', 'Organ', 'Guitar', 'Bass', 'Strings', 'Ensemble', 'Brass', 'Reed', 'Pipe', 'Synth lead', 'Synth pad', 'Synth effects', 'Ethnic', 'Percussive', 'Sound effects'];

/** read the bytes of a Standard MIDI File. Throws an Error with a plain sentence when it is not one. */
function smfParse(ab) {
  const u = new Uint8Array(ab); let p = 0, head = -1;
  for (let i = 0; i < Math.min(u.length - 4, 128); i++) if (u[i] === 0x4D && u[i + 1] === 0x54 && u[i + 2] === 0x68 && u[i + 3] === 0x64) { head = i; break; }       // “MThd”, also inside an RMID wrapper
  if (head < 0) throw new Error('This is not a MIDI file.');
  p = head + 4; const r32 = () => { const v = ((u[p] << 24) | (u[p + 1] << 16) | (u[p + 2] << 8) | u[p + 3]) >>> 0; p += 4; return v; }, r16 = () => { const v = (u[p] << 8) | u[p + 1]; p += 2; return v; };
  const hl = r32(), fmt = r16(), ntrk = r16(), div = r16(); p = head + 8 + Math.max(6, hl);
  if (div & 0x8000) throw new Error('This file counts time in frames (SMPTE) instead of beats, which is not supported.');
  const ppq = div || 480, dec = new TextDecoder('utf-8'), tracks = [], tempos = [], sigs = [], keys = []; let total = 0, endTick = 0;
  while (p + 8 <= u.length && tracks.length < 128) {
    const id = String.fromCharCode(u[p], u[p + 1], u[p + 2], u[p + 3]); p += 4; const len = r32(), end = Math.min(u.length, p + len);
    if (id !== 'MTrk') { p = end; continue; }
    const tr = { name: '', notes: [], lyrics: [], prog: {} }, open = new Map(); let tick = 0, run = 0;
    const vlq = () => { let v = 0, b, k = 0; do { b = u[p++]; v = (v << 7) | (b & 127); } while ((b & 128) && p < end && ++k < 5); return v; };
    const off = (ch, m, t) => { const k = ch * 128 + m, a = open.get(k); if (a && a.length) { const o = a.shift(); if (t > o.t) { tr.notes.push({ t: o.t, d: t - o.t, m, v: o.v, ch }); total++; } } };
    while (p < end) {
      tick += vlq(); let st = u[p]; if (p >= end) break;
      if (st >= 0x80) { p++; if (st < 0xF0) run = st; } else st = run;           // running status
      if (!st) { p = end; break; }
      if (st === 0xFF) {
        const ty = u[p++], l = vlq(), d = u.subarray(p, Math.min(end, p + l)); p += l; run = 0;
        if (ty === 0x2F) { break; }
        else if (ty === 0x03 && !tr.name) tr.name = dec.decode(d).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 60);
        else if (ty === 0x51 && d.length >= 3) tempos.push({ t: tick, us: (d[0] << 16) | (d[1] << 8) | d[2] });
        else if (ty === 0x58 && d.length >= 2) sigs.push({ t: tick, n: d[0], d: 1 << d[1] });
        else if (ty === 0x59 && d.length >= 2) keys.push({ t: tick, sf: (d[0] << 24) >> 24, minor: !!d[1] });
        else if ((ty === 0x05 || ty === 0x01) && d.length) tr.lyrics.push({ t: tick, text: dec.decode(d), kind: ty });
      } else if (st === 0xF0 || st === 0xF7) { const l = vlq(); p += l; run = 0; }
      else if (st >= 0xF1) { p++; }
      else {
        const hi = st & 0xF0, ch = st & 15, d1 = u[p++], d2 = (hi === 0xC0 || hi === 0xD0) ? 0 : u[p++];
        if (hi === 0x90 && d2 > 0) { const k = ch * 128 + d1; let a = open.get(k); if (!a) open.set(k, a = []); a.push({ t: tick, v: d2 }); }
        else if (hi === 0x80 || hi === 0x90) off(ch, d1, tick);
        else if (hi === 0xC0 && !(ch in tr.prog)) tr.prog[ch] = d1;
      }
      if (total > SMF.maxNotes) throw new Error('This file has more notes than can be opened here.');
    }
    open.forEach((a, k) => a.forEach(o => { if (tick > o.t) { tr.notes.push({ t: o.t, d: tick - o.t, m: k % 128, v: o.v, ch: Math.floor(k / 128) }); total++; } }));
    endTick = Math.max(endTick, tick); tr.end = tick; tracks.push(tr); p = end;
  }
  if (!tracks.length) throw new Error('This MIDI file has no tracks.');
  tempos.sort((a, b) => a.t - b.t); sigs.sort((a, b) => a.t - b.t); keys.sort((a, b) => a.t - b.t);
  return { fmt, ppq, tracks, tempos, sigs, keys, endTick, total };
}

/** the file's tracks as playable parts (a track that mixes several channels is split by channel), each with a few facts and a guess at its job */
function smfParts(m) {
  const parts = [];
  m.tracks.forEach((tr, ti) => {
    const byCh = new Map(); tr.notes.forEach(n => { let a = byCh.get(n.ch); if (!a) byCh.set(n.ch, a = []); a.push(n); });
    byCh.forEach((notes, ch) => {
      notes.sort((a, b) => a.t - b.t || b.m - a.m);
      const drum = ch === 9, prog = tr.prog[ch], fam = prog != null ? SMF_FAMILY[prog >> 3] : '';
      const ms = notes.map(n => n.m).sort((a, b) => a - b), med = ms[ms.length >> 1];
      let sum = 0, uni = 0, last = -1; notes.forEach(n => { sum += n.d; const e = n.t + n.d, s0 = Math.max(n.t, last); if (e > s0) { uni += e - s0; last = e; } });
      const poly = uni ? sum / uni : 1, name = tr.name || (drum ? 'Drums' : fam ? fam + ' (channel ' + (ch + 1) + ')' : 'Track ' + (ti + 1)) + '';
      parts.push({ id: parts.length, ti, ch, name: (byCh.size > 1 && tr.name ? tr.name + ' · ch ' + (ch + 1) : name), drum, notes, n: notes.length, lo: ms[0], hi: ms[ms.length - 1], med, poly, role: '', words: false });
    });
  });
  // roles
  const pit = parts.filter(x => !x.drum && x.n >= 4);
  let mel = null, best = -1e9;
  pit.forEach(x => {
    let s = Math.min(x.n, 400) / 40 - Math.abs(x.poly - 1) * 4 - Math.abs(x.med - 70) / 10;
    if (/melod|vocal|voice|sing|lead|solo|vox|tune|theme/i.test(x.name)) s += 4; if (/bass|drum|perc|chord|rhythm|pad|string|organ|comp|accomp/i.test(x.name)) s -= 3;
    if (x.med < 52) s -= 5; if (x.poly > 1.6) s -= 3;
    if (s > best) { best = s; mel = x; }
  });
  parts.forEach(x => { x.role = x.drum ? 'drums' : x === mel ? 'melody' : x.med < 52 && x.poly < 1.5 ? 'bass' : x.poly > 1.5 ? 'chords' : 'other'; });
  return parts;
}

/** ticks → 16th-note slots at the file's own beat (so tempo changes in the file never move a note off its beat) */
const smfSlot = (m, tick) => Math.round(tick / (m.ppq / 4));

/**
 * Make a song from the file. opt: { melody: part id (or null), chords: [part ids used for the chords], title, name }
 * Returns { song, bars, notes, key, notesOut: [..], messages: [..] }
 */
function smfBuild(m, parts, opt) {
  opt = opt || {}; const msgs = [], mel = parts.find(x => x.id === opt.melody) || null, harm = parts.filter(x => (opt.chords || []).includes(x.id) && x !== mel && !x.drum);
  const ts0 = m.sigs[0]; let ts = [4, 4]; if (ts0 && ts0.n >= 1 && ts0.n <= 16 && [2, 4, 8].includes(ts0.d)) ts = [ts0.n, ts0.d]; else if (ts0) msgs.push('The time signature ' + ts0.n + '/' + ts0.d + ' is not supported here, so the song is in 4/4.');
  const bpm = m.tempos.length ? clamp(Math.round(60e6 / m.tempos[0].us), 30, 260) : 92; if (m.tempos.length > 1 && m.tempos.some(t => Math.abs(60e6 / t.us - bpm) > 2)) msgs.push('The tempo changes in this file. The song uses the first tempo (' + bpm + ' BPM).');
  const sp = ts[0] * 16 / ts[1], slotsOf = x => x.notes.map(n => ({ s: smfSlot(m, n.t), e: Math.max(smfSlot(m, n.t) + 1, smfSlot(m, n.t + n.d)), m: n.m, v: n.v }));
  const used = (mel ? [mel] : []).concat(harm); if (!used.length) throw new Error('Pick at least one track with notes.');
  let first = 1e9, lastS = 0; used.forEach(x => { x.notes.forEach(n => { const s = smfSlot(m, n.t); if (s < first) first = s; const e = smfSlot(m, n.t + n.d); if (e > lastS) lastS = e; }); });
  const b0 = Math.floor(first / sp), s0 = b0 * sp; let bars = Math.max(1, Math.ceil((lastS - s0) / sp)); if (bars > SMF.maxBars) { msgs.push('The first ' + SMF.maxBars + ' bars were opened. The rest of the file is longer than a song page is meant to hold.'); bars = SMF.maxBars; }
  // key: from every pitched note (held notes count more), unless the file names one that fits
  const hist = new Array(12).fill(0); parts.filter(x => !x.drum && (x === mel || harm.includes(x))).forEach(x => x.notes.forEach(n => { hist[n.m % 12] += n.d; }));
  let kr = detectKey(hist), key = { root: kr[0].root, minor: kr[0].minor };
  const ks = m.keys[0]; if (ks && ks.sf >= -7 && ks.sf <= 7) { const root = (((ks.sf * 7) + (ks.minor ? 9 : 0)) % 12 + 12) % 12, k2 = kr.slice(0, 3).find(k => k.root === root && k.minor === ks.minor); if (k2) key = { root, minor: ks.minor }; }
  const fl = keyUsesFlats(key.root, key.minor), nameOf = pc => pcName(pc, fl);
  // melody on the 16th grid, one note at a time (the highest when several start together)
  let melq = [];
  if (mel) {
    const q = slotsOf(mel).sort((a, b) => a.s - b.s || b.m - a.m);
    q.forEach(n => { const s = n.s - s0; if (s < 0 || s >= bars * sp) return; const p = melq[melq.length - 1]; if (p && s < p.s + p.l) { if (s === p.s) return; p.l = s - p.s; } melq.push({ s, l: Math.max(1, Math.min(n.e - n.s, bars * sp - s)), m: n.m }); });
  }
  // chords: from the other tracks when there are some, otherwise worked out from the melody
  const chords = []; const unit = Math.max(2, Math.round(sp / 2)), units = Math.ceil(bars * sp / unit);
  if (harm.length || (mel && !(ts[0] === 4 && ts[1] === 4))) {
    const src = harm.length ? harm : [mel], chroma = Array.from({ length: units }, () => new Array(12).fill(0)), low = Array.from({ length: units }, () => ({ m: 999, d: 0 })), any = new Array(units).fill(false);
    src.forEach(x => slotsOf(x).forEach(n => {
      const a0 = n.s - s0, e0 = n.e - s0; if (e0 <= 0 || a0 >= bars * sp) return;
      for (let u = Math.max(0, Math.floor(a0 / unit)); u < units && u * unit < e0; u++) {
        const a = Math.max(a0, u * unit), b = Math.min(e0, (u + 1) * unit); if (b <= a) continue;
        chroma[u][n.m % 12] += (b - a) * (.6 + .4 * (n.v || 90) / 127); any[u] = true; if (n.m < low[u].m) low[u] = { m: n.m, d: b - a };
      }
    }));
    let prev = '';
    for (let u = 0; u < units; u++) {
      if (!any[u]) { chords.push(''); continue; }
      const c = chroma[u].slice(); if (low[u].m < 999 && harm.length) c[low[u].m % 12] += low[u].d * 1.4;           // the lowest note says most about the chord
      const top = detectChord(c); let pick = null;
      if (top.length) { const triad = top.find(t => t.q === '' || t.q === 'm'); pick = triad && top[0].score - triad.score < .07 ? triad : top[0]; }
      if (!pick || pick.score < .6) chords.push(prev); else { const sym = nameOf(pick.root) + pick.q; chords.push(sym); prev = sym; }
    }
  }
  const perBar = [];
  if (chords.length) {
    for (let b = 0; b < bars; b++) { const x = chords[b * 2] || '', y = chords[b * 2 + 1] != null ? chords[b * 2 + 1] : x; perBar.push(!x && !y ? '' : (x === y || !y) ? (x || y) : (!x ? y : x + ' ' + y)); }
  } else if (melq.length) {
    let hm = humHarmonize(melq, bars, key, 0); hm = hm.map(c => { const k = c.split(' ').map(t => { const pc = parseChord(t); return pc ? nameOf(pc.root) + pc.q : t; }); return k.join(' '); }); perBar.push(...hm);
  }
  while (perBar.length < bars) perBar.push('');
  // sections of eight bars, with the melody on the lead tab
  const song = blankSong({ title: opt.title || 'MIDI song', bpm, ts, key: key.root, minor: key.minor, form: 'empty' }), secs = [], nsec = Math.ceil(bars / SMF.part);
  for (let i = 0; i < nsec; i++) {
    const a = i * SMF.part, b = Math.min(bars, a + SMF.part), sec = mkSection(nsec === 1 ? 'Song' : 'Part ' + (i + 1), perBar.slice(a, b));
    if (melq.length) humPlaceMelody(sec, melq.filter(n => n.s >= a * sp && n.s < b * sp).map(n => Object.assign({}, n, { s: n.s - a * sp }))); secs.push(sec);
  }
  // words from karaoke files (lyric events, or the text events of a track called Words / Lyrics)
  const lyr = []; m.tracks.forEach(tr => {
    const l5 = tr.lyrics.filter(l => l.kind === 5), l1 = tr.lyrics.filter(l => l.kind === 1 && !/^@/.test(l.text));
    (l5.length >= 8 ? l5 : l1.length >= 20 && /word|lyric|kar|lyr/i.test(tr.name) ? l1 : []).forEach(l => lyr.push(l));
  });
  let words = 0;
  if (lyr.length >= 8) {
    const spaced = lyr.filter(l => /[ \n\r]$/.test(l.text)).length / lyr.length > .3, per = secs.map(() => '');
    lyr.sort((a, b) => a.t - b.t).forEach(l => {
      const bi = Math.floor((smfSlot(m, l.t) - s0) / sp); if (bi < 0 || bi >= bars) return; const si = Math.floor(bi / SMF.part); let t = l.text.replace(/\r\n?/g, '\n');
      if (/^[\\/]/.test(t)) { per[si] = per[si].replace(/ +$/, '') + (t[0] === '\\' ? '\n\n' : '\n'); t = t.slice(1); }
      if (!spaced) t = /-$/.test(t) ? t.slice(0, -1) : t + ' '; per[si] += t; words++;
    });
    secs.forEach((x, i) => { x.lyrics = per[i].split('\n').map(z => z.replace(/ {2,}/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim(); });
  }
  song.sections = secs; song.swing = 0;
  const style = HUM_STYLES[humPickStyle({ bpm, key })], st = style; Object.assign(song.band, { drumsOn: true, kit: st.kit, patName: st.pat, pat: null, bassOn: true, bassStyle: st.bass, bassTone: 'Round', compOn: true, compStyle: st.comp, compInst: st.compInst, leadOn: !!melq.length, leadInst: st.lead });
  song.notes = 'Opened from a MIDI file (' + (opt.name || 'untitled') + ') in ' + nameOf(key.root) + (key.minor ? ' minor' : ' major') + ' at ' + bpm + ' BPM' + (melq.length ? '. The melody is on the lead tab' : '') + (words ? ', with the words from the file' : '') + '. The chords were worked out from the notes, so check them by ear.';
  return { song, bars, key, bpm, ts, melody: melq.length, words, messages: msgs, keyName: nameOf(key.root) + (key.minor ? ' minor' : ' major') };
}

/** the window: pick the melody and which tracks make the chords, then create the song */
async function smfOpen(file) {
  if (!file) return null;
  if (file.size > SMF.maxBytes) { toast('“' + file.name + '” is too large to be a song’s MIDI file (' + (file.size / 1048576).toFixed(1) + ' MB).', 'warn'); return null; }
  let m, parts; try { m = smfParse(await file.arrayBuffer()); parts = smfParts(m); } catch (e) { toast('Could not open “' + file.name + '”: ' + (e.message || e), 'warn'); return null; }
  const pit = parts.filter(x => !x.drum && x.n);
  if (!pit.length) { toast('“' + file.name + '” has no notes to open as a song' + (parts.some(x => x.drum) ? ' (it is drums only)' : '') + '.', 'warn'); return null; }
  const base = file.name.replace(/\.(mid|midi|kar)$/i, ''), title = ((typeof cleanTitle === 'function' ? cleanTitle(base) : '') || base || 'MIDI song').slice(0, 80);
  const st = { mel: (parts.find(x => x.role === 'melody') || pit[0]).id, harm: new Set(pit.filter(x => x.role !== 'melody').map(x => x.id)) };
  const body = h('div', { class: 'smf' });
  const tempo = m.tempos.length ? Math.round(60e6 / m.tempos[0].us) : 92, sg = m.sigs[0] ? m.sigs[0].n + '/' + m.sigs[0].d : '4/4';
  const draw = () => {
    body.innerHTML = '';
    body.append(h('p', { class: 'muted' }, tempo + ' BPM · ' + sg + ' · ' + pit.length + ' track' + (pit.length === 1 ? '' : 's') + ' with notes. Choose the melody. The other tracks you leave ticked decide the chords.'));
    body.append(h('div', { class: 'smf-tbl', role: 'table', 'aria-label': 'Tracks in the MIDI file' },
      h('div', { class: 'smf-r smf-h', role: 'row' }, ['Melody', 'Track', 'Notes', 'Range', 'Chords'].map(x => h('span', { role: 'columnheader' }, x))),
      pit.map(x => h('div', { class: 'smf-r' + (x.id === st.mel ? ' on' : ''), role: 'row', 'data-id': x.id },
        h('span', { role: 'cell' }, h('input', { type: 'radio', name: 'smfMel', checked: x.id === st.mel, 'aria-label': 'Use ' + x.name + ' as the melody', onchange: () => { st.mel = x.id; st.harm.delete(x.id); draw(); } })),
        h('b', { class: 'smf-n', role: 'cell', title: x.name }, x.name), h('span', { role: 'cell' }, String(x.n)), h('span', { role: 'cell' }, midiName(x.lo) + '–' + midiName(x.hi)),
        h('span', { role: 'cell' }, x.id === st.mel ? h('span', { class: 'muted' }, '·') : h('input', { type: 'checkbox', checked: st.harm.has(x.id), 'aria-label': 'Use ' + x.name + ' for the chords', onchange: e => { if (e.target.checked) st.harm.add(x.id); else st.harm.delete(x.id); } }))))));
    if (parts.some(x => x.drum)) body.append(h('div', { class: 'tiny muted' }, 'The drum track is not copied. The band plays its own pattern.'));
    body.append(h('div', { class: 'tiny muted' }, 'If no other track is ticked, the chords are worked out from the melody. Everything is read on this device.'));
    body.append(h('div', { class: 'row smf-act' }, h('button', { class: 'btn', onclick: () => d.close() }, 'Cancel'), h('span', { class: 'grow' }), h('button', { class: 'btn primary', id: 'smfGo', onclick: go }, 'Create song')));
  };
  let busy = false;
  const go = async () => {
    if (busy) return; busy = true;
    try {
      const r = smfBuild(m, parts, { melody: st.mel, chords: [...st.harm], title, name: file.name }); d.close();
      await projCreate('import', { song: r.song, zoom: 'song', title }); CFG.flats = keyUsesFlats(S.key, S.minor); saveCfg(); bus.emit('song');
      toast('Opened “' + title + '”: ' + r.bars + ' bars in ' + r.keyName + (r.melody ? ', melody on the lead tab' : '') + (r.words ? ', with words' : '') + '. ' + (r.messages[0] || 'Press play to hear it.'), r.messages.length ? 'warn' : 'ok');
      return r;
    } catch (e) { busy = false; console.warn(e); toast('Could not build a song from that file (' + (e.message || e) + ').', 'warn'); }
  };
  const d = pdlg('smfDlg', 'Open MIDI file — ' + title.slice(0, 40), body, { wide: true }); draw(); setTimeout(() => { const g = document.getElementById('smfGo'); if (g) g.focus(); }, 40);
  return { m, parts, st };
}
