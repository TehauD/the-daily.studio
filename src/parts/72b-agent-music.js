/* ============================================================
   Part 72b · AGENT TOOLS FOR MAKING MUSIC (2.84)
   Part 72 lets an agent read and edit chords, lyrics and the band. These are what an agent needs to make a piece, hear it and refine it:
     get_music_guide    everything it can choose from (beats, patterns, kits, sounds, progressions), the note format, and how to go about it
     write_drums        the drum grid, step by step (or a ready pattern)
     write_notes        a keys part, a bass line or a lead melody, note by note (the same notes the Keys room and the piano roll write)
     read_notes         the same notes back, so it can edit what it wrote
     arrange_sections   put the sections in a new order, repeat them (a chorus twice, a bridge before the last chorus)
     render_audio       mix the song faster than it plays and measure it: loudness, peak, tone balance, each section, silences, with plain advice
   dailyStudio.render() (for agents that drive the page with scripts, and the local bridge, scripts/mcp-bridge.mjs) returns the WAV itself.
   Same rules as part 72: it all runs in this page, one undo step per change, a 🤖 note, and nothing here touches the microphone, the camera or recording.
   ============================================================ */
/** "C4", "F#3", "Bb2" (C4 = middle C = 60) or a MIDI number 0–127 → the number, else null */
function agMidi(x) {
  if (typeof x === 'number') return Number.isInteger(x) && x >= 0 && x <= 127 ? x : null;
  const s = String(x == null ? '' : x).trim(), m = /^([A-Ga-g])([#b♯♭]?)(-?\d)$/.exec(s);
  if (!m) return /^\d{1,3}$/.test(s) && +s <= 127 ? +s : null; const pc = parsePc(m[1].toUpperCase() + m[2].replace('♯', '#').replace('♭', 'b')); return pc == null ? null : (+m[3] + 1) * 12 + pc;
}
const agNoteName = m => pcName(((m % 12) + 12) % 12, keyUsesFlats(S.key, S.minor)) + (Math.floor(m / 12) - 1);
const AG_RANGE = { keys: [24, 108], bass: [24, 72] };
/** a string and fret for a lead note: the fret nearest the hand's last position, on a string not already sounding at that moment */
function agFret(m, used, last) {
  const c = S.tuning.map((open, st) => ({ st, f: m - open - (S.capo || 0) })).filter(x => x.f >= 0 && x.f <= 22 && !used.has(x.st)); if (!c.length) return null;
  c.sort((a, b) => Math.abs(a.f - last) - Math.abs(b.f - last) || a.st - b.st); return c[0];
}
/** the part's notes in a section, as the tools speak them: bar (1 = first), step (0 = the downbeat, in 16ths), note, length (steps), velocity */
function agNotesOf(sec, part) {
  const out = []; sec.bars.forEach((b, bi) => {
    if (part === 'lead') (b.tab || []).filter(n => typeof n.f === 'number').forEach(n => out.push({ bar: bi + 1, step: n.s, note: agNoteName(noteMidi(n)), string: S.tuning.length - n.st, fret: n.f }));
    else (part === 'bass' ? b.bassLine : b.keys || []).forEach(n => out.push({ bar: bi + 1, step: n.s, note: agNoteName(n.m), length: n.d || 1, velocity: Math.round((n.v || .8) * 100) / 100 }));
  });
  return out.sort((a, b) => a.bar - b.bar || a.step - b.step);
}
const AG_PART = { type: 'string', enum: ['keys', 'bass', 'lead'], description: 'keys (the piano, pad or strings part), bass (the bass line) or lead (a melody played on the guitar: written into the tab).' };

agTool('get_music_guide', 'Everything you can choose from when making music here, and how to go about it: the ready beats (with tempo and feel), drum patterns and kits, bass styles and sounds, rhythm-guitar patterns, keys sounds, scales, chord progressions, what the section energies mean, how notes are written, and a good order of work. Read this once at the start.',
  agObj(), () => agTxt({
    beats: BEATS.map(b => ({ id: b.id, name: b.name, feel: b.feel, bpm: b.bpm, progression: b.prog || null })), drum_patterns: Object.keys(DPATS), drum_kits: Object.keys(KITS), bass_styles: BASS_STYLES, bass_sounds: BASS_TONES, strum_patterns: Object.keys(STRUMS), keys_sounds: KEYS_SOUNDS.slice(), scales: Object.keys(SCALES),
    progressions: PROGS.map(([n, r]) => ({ name: n.replace(/\s{2,}/g, ' · '), numerals: r })),
    section_energy: '1 = just hats, 2 = light, 3 = normal, 4 = big, 5 = everything. Set it per section with edit_section and turn Song build on in set_band: verses sit low, choruses lift, with fills and risers between.',
    notes: { keys_and_bass: 'write_notes {part, section, notes:[{bar, step, note, length, velocity}]}. bar 1 = the first bar of the section. step 0 = the downbeat; 16 steps to a 4/4 bar (a step is a sixteenth). note is "C4" (middle C), "F#3", "Bb2" or a MIDI number. length is in steps (4 = a quarter note). velocity 0–1.', lead: 'The same, played on the guitar: each note is given a string and fret near the last one (read_notes shows them).', drums: 'write_drums {grid:{kick, snare, hat, open_hat, clap, tom}}: 16 characters each, one per sixteenth. . = rest, g = ghost, x = hit, X = accent.' },
    how_to: ['1. set_song_details: title, key, tempo, time signature. Or set_band {beat} for a ready groove and tempo.', '2. add_section / edit_section: the chords, one per bar (get_key_chords lists the key\'s chords and progressions). Give each section an energy.', '3. set_band {song_build:true}, then choose drum_kit, bass_style, keys_sound.', '4. write_drums for your own groove; write_notes for a keys part, a bass line, a lead melody.', '5. arrange_sections to repeat or reorder (verse, chorus, verse, chorus, bridge, chorus).', '6. render_audio to hear it as numbers: loudness, balance, each section, silence. Fix what it says, render again. transport {action:"play"} for the person to hear it.'],
    limits: 'The studio plays chords as a band, so you do not have to write every part: write notes where you want a specific melody, bass line or riff, and let the band play the rest.'
  }), { readOnlyHint: true });

const AG_ROWS = { kick: 0, snare: 1, hat: 2, open_hat: 3, clap: 4, tom: 5 };
agTool('write_drums', 'Set the drum pattern: pick a ready one (pattern), or write your own as a grid, one row of 16 characters per drum, one character per sixteenth note: . rest, g ghost (quiet), x hit, X accent. Rows you leave out keep what they had. It applies to the whole song (the band repeats it every bar).',
  agObj({ pattern: agStr('A ready pattern.', { enum: Object.keys(DPATS) }), grid: { type: 'object', description: 'Rows of 16 characters (4, 8 or 16: a shorter row repeats). kick, snare, hat, open_hat, clap (clap or rim), tom (tom or percussion).', properties: Object.fromEntries(Object.keys(AG_ROWS).map(k => [k, { type: 'string' }])), additionalProperties: false },
    kit: agStr('The drum kit.', { enum: Object.keys(KITS) }), on: agBool('Drums on or off.') }),
  i => {
    if (i.kit && !KITS[i.kit]) throw new Error('Unknown drum kit'); if (i.pattern && !DPATS[i.pattern]) throw new Error('Unknown pattern. Patterns: ' + Object.keys(DPATS).join(', '));
    const rows = {}; if (i.grid) Object.entries(i.grid).forEach(([k, v]) => {
      if (!(k in AG_ROWS)) throw new Error('Unknown drum “' + k + '”. Rows: ' + Object.keys(AG_ROWS).join(', ')); const s = String(v).replace(/[\s|]/g, ''); if (![4, 8, 16].includes(s.length)) throw new Error(k + ': a row is 4, 8 or 16 characters, not ' + s.length);
      if (!/^[.\-_gxX0-3]+$/.test(s)) throw new Error(k + ': use . for a rest, g for a ghost note, x for a hit and X for an accent'); rows[k] = s.repeat(16 / s.length).split('').map(c => ({ '.': 0, '-': 0, '_': 0, g: 1, x: 2, X: 3 }[c] != null ? { '.': 0, '-': 0, '_': 0, g: 1, x: 2, X: 3 }[c] : +c));
    });
    if (!i.pattern && !i.grid && !i.kit && i.on == null) throw new Error('Give a pattern, a grid, a kit or on');
    agChange('wrote the drums', () => { const B = S.band; if (i.pattern) setDrumPattern(i.pattern); if (i.grid) { const pat = dpat(); Object.entries(rows).forEach(([k, r]) => { pat[AG_ROWS[k]] = r; }); } if (i.kit) B.kit = i.kit; if (i.on != null) B.drumsOn = !!i.on; else if (i.pattern || i.grid) B.drumsOn = true; commit(false); });
    try { syncBandStrip(); if (paneVisible('band')) renderBand(); } catch (e) { }
    const sym = ['.', 'g', 'x', 'X'], g = {}; Object.keys(AG_ROWS).forEach(k => { g[k] = dpat()[AG_ROWS[k]].map(v => sym[v] || '.').join(''); });
    return agTxt({ done: true, kit: S.band.kit, drums_on: !!S.band.drumsOn, grid: g });
  });

agTool('write_notes', 'Write a part note by note into one section: keys (piano, pad, strings), bass, or lead (a melody on the guitar). Replaces that part in the section by default (undoable); the band plays your notes instead of making the part up from the chords, and the part is switched on. Bars and steps count from the start of the section: bar 1, step 0 is its downbeat (16 steps to a 4/4 bar, a step is a sixteenth note).',
  agObj({ part: AG_PART, section: agSecP('Section number (1 = first) or name.'),
    notes: { type: 'array', minItems: 1, maxItems: 600, description: 'Each note: { bar, step, note, length, velocity }. note is "C4" (middle C), "F#3", "Bb2" or a MIDI number. step 0–15, default 0. length in steps, default 1 (4 = a quarter note, 16 = a whole bar). velocity 0–1, default 0.8.', items: { type: 'object' } },
    replace: agBool('Clear that part in the section first (default true). false adds to what is there.') }, ['part', 'section', 'notes']),
  i => {
    const si = agSec(i.section); if (si < 0) throw new Error('No section “' + i.section + '”. Sections: ' + S.sections.map((s, n) => (n + 1) + ' ' + s.name).join(', '));
    const sec = S.sections[si], sp = spb(), nb = sec.bars.length, part = i.part, rg = AG_RANGE[part], out = [];
    if (!Array.isArray(i.notes) || !i.notes.length) throw new Error('notes needs at least one note');
    i.notes.forEach((n, k) => {
      const w = 'notes[' + k + ']: ', o = n && typeof n === 'object' ? n : {}, bar = Math.round(+o.bar), step = o.step == null ? 0 : Math.round(+o.step), len = o.length == null ? 1 : Math.round(+o.length), v = o.velocity == null ? .8 : +o.velocity, m = agMidi(o.note);
      if (!(bar >= 1 && bar <= nb)) throw new Error(w + 'bar must be 1–' + nb + ' (“' + sec.name + '” has ' + nb + ' bars)'); if (!(step >= 0 && step < sp)) throw new Error(w + 'step must be 0–' + (sp - 1) + ' (a bar has ' + sp + ' steps)');
      if (m == null) throw new Error(w + '“' + o.note + '” is not a note: use "C4", "F#3", "Bb2" or a MIDI number'); if (rg && (m < rg[0] || m > rg[1])) throw new Error(w + part + ' notes go from ' + agNoteName(rg[0]) + ' to ' + agNoteName(rg[1]));
      if (!(len >= 1 && len <= sp * nb)) throw new Error(w + 'length must be 1–' + sp * nb + ' steps'); if (!(v > 0 && v <= 1)) throw new Error(w + 'velocity must be above 0 and at most 1'); out.push({ bar, step, m, len, v });
    });
    out.sort((a, b) => a.bar - b.bar || a.step - b.step || a.m - b.m); let skipped = 0;
    agChange('wrote ' + part + ' notes in ' + sec.name, () => {
      if (i.replace !== false) sec.bars.forEach(b => { if (part === 'keys') b.keys = []; else if (part === 'bass') b.bassLine = []; else b.tab = []; });
      let last = 5; const taken = new Set();
      out.forEach(n => { const b = sec.bars[n.bar - 1];
        if (part === 'lead') { const key = n.bar + ':' + n.step, used = new Set(b.tab.filter(t => t.s === n.step).map(t => t.st)); const f = agFret(n.m, used, last); if (!f) { skipped++; return; } last = f.f; taken.add(key); b.tab.push({ s: n.step, st: f.st, f: f.f, t: '' }); }
        else (part === 'bass' ? (b.bassLine = b.bassLine || []) : (b.keys = b.keys || [])).push({ s: n.step, m: n.m, v: n.v, d: n.len }); });
      const B = S.band; if (part === 'keys') { B.keysOn = true; if (!S.mix.keys) S.mix.keys = { g: .7, p: .1, m: 0, s: 0 }; } else if (part === 'bass') B.bassOn = true; else B.leadOn = true; T.bars = null;
    });
    try { syncBandStrip(); if (paneVisible('band')) renderBand(); } catch (e) { }
    return agTxt({ done: true, section: sec.name, part, written: out.length - skipped, skipped: skipped || undefined, note: skipped ? 'Some lead notes were out of reach of the guitar\'s strings and were left out.' : undefined, notes: agNotesOf(sec, part).slice(0, 80) });
  });

agTool('read_notes', 'The notes of one part in one section, in the form write_notes takes (bar, step, note, length, velocity; for lead also the string and fret). Use it to see what is there before you change it.',
  agObj({ part: AG_PART, section: agSecP('Section number (1 = first) or name.') }, ['part', 'section']),
  i => { const si = agSec(i.section); if (si < 0) throw new Error('No section “' + i.section + '”'); const sec = S.sections[si]; return agTxt({ section: sec.name, bars: sec.bars.length, steps_per_bar: spb(), part: i.part, notes: agNotesOf(sec, i.part) }); }, { readOnlyHint: true });

agTool('arrange_sections', 'Put the sections in a new order, and repeat them. order lists sections by number or name; a section named twice is copied (a chorus twice); a section you leave out is removed. Undoable.',
  agObj({ order: { type: 'array', minItems: 1, maxItems: 40, description: 'Section numbers (1 = first) or names, in the new order, e.g. ["Verse 1", "Chorus", "Verse 1", "Chorus", "Bridge", "Chorus"].', items: { type: ['string', 'number'] } } }, ['order']),
  i => {
    const idx = i.order.map(r => { const k = agSec(r); if (k < 0) throw new Error('No section “' + r + '”. Sections: ' + S.sections.map((s, n) => (n + 1) + ' ' + s.name).join(', ')); return k; }), seen = new Map(), names = new Set();
    const made = idx.map(k => { const n = (seen.get(k) || 0) + 1; seen.set(k, n); const src = S.sections[k]; if (n === 1) { names.add(src.name); return src; } const c = JSON.parse(JSON.stringify(src)); c.id = uid(); let nm = src.name.replace(/\s+\d+$/, ''), q = 2; while (names.has(nm + ' ' + q)) q++; c.name = nm + ' ' + q; names.add(c.name); return c; });
    agChange('rearranged the sections', () => { S.sections = made; SEL.sec = 0; SEL.bar = 0; TE.sec = 0; TE.bi = 0; T.bars = null; });
    return agTxt({ done: true, sections: S.sections.map((s, n) => (n + 1) + ' ' + s.name), total_bars: totalBars(), length_seconds: Math.round(songSlots() * slotDur()) });
  }, { destructiveHint: true });

/* ---------- hearing it: render and measure ---------- */
/** loudness, peak, tone balance, silences and clipping of a stereo signal, and what to do about them */
function agMetrics(l, r, sr) {
  const n = l.length, db = x => x > 1e-9 ? 20 * Math.log10(x) : -Infinity, rd = x => isFinite(x) ? Math.round(x * 10) / 10 : null; let pk = 0, ss = 0, clip = 0;
  for (let k = 0; k < n; k++) { const a = Math.max(Math.abs(l[k]), Math.abs(r[k])); if (a > pk) pk = a; if (a >= .999) clip++; const m = (l[k] + r[k]) / 2; ss += m * m; }
  const lu = lufsMeasure(l, r, sr), rms = Math.sqrt(ss / Math.max(1, n)), a1 = 1 - Math.exp(-2 * Math.PI * 250 / sr), a2 = 1 - Math.exp(-2 * Math.PI * 4000 / sr); let y1 = 0, y2 = 0; const e = [0, 0, 0];
  for (let k = 0; k < n; k++) { const x = (l[k] + r[k]) / 2; y1 += a1 * (x - y1); y2 += a2 * (x - y2); e[0] += y1 * y1; e[1] += (y2 - y1) * (y2 - y1); e[2] += (x - y2) * (x - y2); }
  const tot = e[0] + e[1] + e[2] || 1, share = e.map(x => Math.round(x / tot * 100)), w = Math.round(sr * .1); let lead = 0, trail = 0, gap = 0, run = 0, started = false;
  const quiet = j => { let s = 0; for (let k = j; k < Math.min(n, j + w); k++) s += l[k] * l[k] + r[k] * r[k]; return Math.sqrt(s / (2 * w)) < .001; };
  for (let j = 0; j + w <= n; j += w) { if (quiet(j)) { run += .1; if (!started) lead += .1; gap = Math.max(gap, run); } else { run = 0; started = true; } } for (let j = Math.floor(n / w) * w - w; j >= 0 && quiet(j); j -= w) trail += .1;
  const hints = [], L = lu.lufs;
  if (!isFinite(L)) hints.push('The render is silent: check that the band parts are on, the chords are not empty and nothing is muted.'); else {
    if (L < -23) hints.push('Quiet (' + rd(L) + ' LUFS): the mix is well under streaming level. Raise the strip levels or the master.'); else if (L > -9) hints.push('Very loud (' + rd(L) + ' LUFS): little room left; lower the master or the loudest part.');
    if (clip) hints.push(clip + ' samples reach full scale: lower the master or the loudest part.'); if (share[0] > 62) hints.push('Heavy in the low end (' + share[0] + '% below 250 Hz): thin out the bass or the keys.'); if (share[0] < 12) hints.push('Little low end (' + share[0] + '% below 250 Hz): turn up the bass or add a low part.'); if (share[2] < 1) hints.push('Almost nothing above 4 kHz: a brighter kit, hats or a lead would open it up.');
    if (gap > 1.5) hints.push('A silence of ' + rd(gap) + ' s somewhere in the song.');
  }
  return { duration_s: rd(n / sr), loudness_lufs: rd(L), true_peak_dbfs: rd(lu.tp), peak_dbfs: rd(db(pk)), rms_dbfs: rd(db(rms)), crest_db: rd(db(pk) - db(rms)), clipped_samples: clip, balance_percent: { low_under_250hz: share[0], mid: share[1], high_over_4khz: share[2] }, silence_s: { start: rd(lead), end: rd(trail), longest_gap: rd(gap) }, hints };
}
/** render the song (the same signal path as playing it) and return { l, r, sr, seconds } */
async function agRenderRaw(opt) {
  try { await startAudio(); } catch (e) { }
  if (!ofrAvailable()) throw new Error('The studio cannot render yet. The browser only starts sound after the person has clicked or tapped the page once: ask them to click anywhere in the studio, then try again.');
  if (T.rec) throw new Error('The studio is recording; the person has to stop it.');
  return ofrRender({ tail: opt && opt.tail != null ? clamp(+opt.tail || 0, 0, 8) : 2 });
}
agTool('render_audio', 'Mix the song to audio faster than it plays (the same signal as pressing play, with the band, your notes, the effects and the master) and measure it: loudness (LUFS), peaks, how the sound is spread between low, mid and high, silences, clipping, and each section\'s loudness, with plain advice on what to fix. Use it to hear your work as numbers, change something, and render again. It does not change the song.',
  agObj({ tail: agNum('Seconds of ring-out after the last bar, 0–8 (default 2).'), sections: agBool('Include each section\'s loudness (default true).') }),
  async i => {
    const o = await agRenderRaw(i), m = agMetrics(o.l, o.r, o.sr);
    if (i.sections !== false) { let at = 0; m.sections = S.sections.map(s => { const a = Math.round(at * o.sr), len = s.bars.length * spb() * slotDur(); at += len; const b = Math.min(o.l.length, Math.round(at * o.sr)); let v = null, pk = 0; if (b - a > o.sr * .8) { const lu = lufsMeasure(o.l.subarray(a, b), o.r.subarray(a, b), o.sr); v = isFinite(lu.lufs) ? Math.round(lu.lufs * 10) / 10 : null; pk = lu.peak; } return { name: s.name, bars: s.bars.length, energy: secEnergy(s), loudness_lufs: v }; }); }
    return agTxt(Object.assign({ done: true, bpm: S.bpm, key: agKeyName(S.key, S.minor) }, m));
  });
/** for scripts and the local bridge (dailyStudio.render): the mix as a WAV, base64, with its measurements. Nothing is downloaded. */
async function agRenderFile(opt) {
  if (!agentOn()) throw new Error('The person has turned off AI agent access in Settings ▸ Workflow.'); opt = opt || {};
  const o = await agRenderRaw(opt), bits = opt.bits === 24 ? 24 : 16, buf = new Uint8Array(await encodeWav([o.l, o.r], o.sr, bits).arrayBuffer()); let s = ''; for (let k = 0; k < buf.length; k += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(k, k + 0x8000));
  return { wav_base64: btoa(s), bytes: buf.length, sample_rate: o.sr, bits, seconds: Math.round(o.l.length / o.sr * 10) / 10, metrics: agMetrics(o.l, o.r, o.sr) };
}
