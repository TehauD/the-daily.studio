/* ============================================================
   Part 16b · LOAD YOUR COPY, and MAKE IT OURS (2.59) — songs over someone else's record, without sending the record
   Load your copy: a song link for a song played over a backing track names the track ("Joy – Artist") and carries a fingerprint of it:
   how its loudness rises and falls (onset strength, 20 times a second, for 40 seconds from the song's first downbeat), about 400 bytes,
   never the audio. Whoever opens the link loads their own copy of the record; the studio finds where the fingerprint best matches in
   their file (normalised cross-correlation), puts the song's first downbeat there (on their copy's nearest detected beat), and keeps
   that in the song (S.trackAlign). A different rip, a longer intro or a second of silence still lines up; the song itself (chords,
   words, tempo) is never changed by their file.
   Make it ours: one press turns a song played over a record into the studio's own: the chords found in the track (if the song has
   none), its tempo and key, its drum groove, and the band (drums, bass, rhythm) playing them; the record is muted (✕ Unload removes it).
   What's left is yours to share, send in a link, finish and release. Your recording of the band is original; the song's composition
   may still belong to its writers, so covers still need permission to publish.
   ============================================================ */
const YC = { hz: 20, secs: 40, scan: 180, min: .45 };
/** onset strength of the loaded track (its stems mixed), YC.hz frames a second, z-normalised */
function ycEnv(t0, secs) {
  if (!STM.ch) return null; const sr = STM.sr, hop = Math.max(1, Math.round(sr / YC.hz)), n0 = Math.max(0, Math.round(t0 * sr)), n1 = Math.min(STM.n, n0 + Math.round(secs * sr)), F = Math.floor((n1 - n0) / hop); if (F < 8) return null;
  const chs = STMS.map((_, si) => spData(si)[0]), en = new Float64Array(F), out = new Float32Array(F); let tot = 0;
  for (let f = 0; f < F; f++) { let s = 0; const a = n0 + f * hop; for (let i = a; i < a + hop; i += 2) { let v = 0; for (const c of chs) v += c[i]; s += v * v; } en[f] = s / (hop / 2); tot += en[f]; }
  /* two things, added: when sounds start (onsets) and how loud each moment is (the log-energy contour, its slow drift removed, so a quieter
     or louder copy still matches). Onsets alone can't tell two records at the same tempo apart; the loudness of each hit, fill and part can.
     Silence is floored 30 dB under the average and onsets capped at five times the typical one, so a quiet start or one loud hit can't
     outweigh the rest (a copy with a second of silence before the music still matches). */
  const floor = 1e-3 * tot / F + 1e-9, lg = new Float32Array(F); for (let f = 0; f < F; f++) lg[f] = Math.log(Math.max(en[f], floor));
  const z = a => { let m = 0, q = 0; for (const v of a) m += v; m /= a.length; for (const v of a) q += (v - m) * (v - m); const sd = Math.sqrt(q / a.length) || 1; return a.map(v => (v - m) / sd); };
  const on = new Float32Array(F); let om = 0; for (let f = 1; f < F; f++) { on[f] = Math.max(0, lg[f] - lg[f - 1]); om += on[f]; } const cap = 5 * (om / F || 1); for (let f = 0; f < F; f++) if (on[f] > cap) on[f] = cap;
  const W = YC.hz, ct = new Float32Array(F); let acc = 0; for (let f = 0; f < F; f++) { acc += lg[f]; if (f >= W) acc -= lg[f - W]; ct[f] = lg[f] - acc / Math.min(f + 1, W); }      /* the contour against its own last second */
  const a = z(on), b = z(ct); for (let f = 0; f < F; f++) out[f] = a[f] + b[f]; return z(out);
}
/** the fingerprint a link carries: 4 bits a frame, two frames a byte */
function ycPrint() {
  if (!STM.ch || !STM.an) return null; const e = ycEnv(trkT0(), YC.secs); if (!e) return null; const q = new Uint8Array(Math.ceil(e.length / 2));
  for (let i = 0; i < e.length; i++) { const v = Math.max(0, Math.min(15, Math.round((e[i] + 2) * 2.5))); q[i >> 1] |= i & 1 ? v << 4 : v; }
  return { t: (STM.title || STM.name || '').slice(0, 80), a: (STM.artist || '').slice(0, 80), d: Math.round(STM.dur), fp: slB64(q), n: e.length };
}
function ycUnprint(r) { const u = slUnB64(r.fp), n = Math.min(r.n || u.length * 2, u.length * 2), e = new Float32Array(n); for (let i = 0; i < n; i++) e[i] = ((i & 1 ? u[i >> 1] >> 4 : u[i >> 1] & 15) / 2.5) - 2; let m = 0, q = 0; for (const v of e) m += v; m /= n; for (const v of e) q += (v - m) * (v - m); const sd = Math.sqrt(q / n) || 1; return e.map(v => (v - m) / sd); }
/** where in the loaded copy the fingerprint fits best: { t (seconds), score (0..1) } */
function ycMatch(ref) {
  const T = ycUnprint(ref), E = ycEnv(0, Math.min(YC.scan, STM.dur)); if (!E || E.length < T.length) return null; let best = -1, at = 0;
  for (let l = 0; l + T.length <= E.length; l++) { let s = 0; for (let i = 0; i < T.length; i++) s += T[i] * E[l + i]; if (s > best) { best = s; at = l; } }
  return { t: at / YC.hz, score: Math.min(1, best / T.length) };
}
/** put the song's first downbeat at t seconds in the loaded copy (on its nearest detected beat) */
function ycSetStart(t) {
  const an = STM.an; if (!an || !an.beats || !an.beats.length) return null; let k = 0, d = Infinity; an.beats.forEach((b, i) => { const x = Math.abs(b / an.fps - t); if (x < d) { d = x; k = i; } });
  an.down = k; T.bars = null; TL.dirty = true; bus.emit('track'); return an.beats[k] / an.fps;
}
/** after any load or restore of the track: the song's own alignment, if it has one */
bus.on('track', () => { const a = S.trackAlign, an = STM.an; if (!a || !an || an._ycApplied === a.t0) return; an._ycApplied = a.t0; ycSetStart(a.t0); });
/** Load your copy: the person picks their file; it is split and analysed as any track, without changing the song, then lined up */
function ycLoad() {
  const ref = S.trackRef; const inp = h('input', { type: 'file', accept: 'audio/*', hidden: true }); document.body.append(inp);
  inp.addEventListener('change', async () => {
    const f = inp.files[0]; inp.remove(); if (!f) return; toast('Loading your copy of “' + ((ref && ref.t) || f.name) + '”…');
    await stemLoad(f, { noFill: true }); if (!STM.an) return; if (!ref || !ref.fp) return;
    const m = ycMatch(ref); if (!m || m.score < YC.min) return toast('Your copy is loaded, but it doesn’t clearly match the one the song was made with' + (m ? ' (match ' + Math.round(m.score * 100) + '%)' : '') + '. Is it the same recording? It starts at its own first downbeat for now.', 'warn');
    const t0 = ycSetStart(m.t); S.trackAlign = { t0: Math.round(t0 * 1000) / 1000, score: Math.round(m.score * 100) / 100 }; STM.an._ycApplied = S.trackAlign.t0; commit(false);
    toast('Lined up: the song starts ' + t0.toFixed(2) + ' s into your copy (match ' + Math.round(m.score * 100) + '%).' + (ref.d && Math.abs(ref.d - STM.dur) > 3 ? ' Your copy is ' + fmtT(STM.dur) + ' long, the original ' + fmtT(ref.d) + '.' : ''), 'ok');
  }, { once: true });
  inp.click();
}
/** Make it ours: the track's chords, tempo, key and groove, played by the band; the record muted */
function ycMakeOurs() {
  const an = STM.an; if (!STM.ch || !an) return toast('Load a track first.', 'warn'); const bf = snap();
  if (!S.sections.some(sec => sec.bars.some(b => b.chord)) && an.chordBars.length >= 2) stemWriteChords();
  S.bpm = Math.round(an.bpmEff * 100) / 100; if (an.key) { S.key = an.key.root; S.minor = an.key.minor; S.scale = an.key.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)'; }
  Object.assign(S.band, { drumsOn: true, bassOn: true, compOn: true });
  if (an.groove) { try { stemImportGroove(); } catch (e) { } }
  STM.mute = true; try { spBus(); } catch (e) { } S.track = Object.assign({}, S.track || {}, { ours: true, name: STM.title || STM.name }); delete S.trackRef;
  commit(true); try { histPush(bf); } catch (e) { } bus.emit('song', 'band'); try { syncBandStrip(); } catch (e) { }
  toast('✦ It’s yours now: the band plays the song’s chords, tempo and groove. The record is muted; ✕ Unload it when you’re happy.', 'ok');
}
