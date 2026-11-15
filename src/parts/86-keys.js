/* ============================================================
   Part 86 · KEYS (2.35) — a piano to see and play, and keys in the band
     · 🎹 the piano under Write (beside the fretboard): the chord that is playing (its notes, the root marked), the song's scale,
       and what you and the band's keys play, lit as it sounds. Click or drag along it to play.
     · 🎹 Keys (a room): a bigger keyboard you play with the mouse, a touch screen, the computer keys (A W S E D F T G Y H U J K O L P ;,
       Z and X for octaves) or a MIDI keyboard. Six sounds of its own (piano, electric piano, organ, pad, synth lead, synth bass), or
       it plays the band's bass or lead guitar instead: "Plays into".
     · ● Record: in time with the band, what you play is written into the song: as a keys part, as the bass line (it replaces the
       made-up bass in those bars), or as lead tab. Rounded to 16ths, 8ths or quarters; added to what is there; one undo.
     · Keys in the band: a keys player that follows the chords, in five styles, with its own channel in the mixer (Keys).
   ============================================================ */
const KEYS_SOUNDS = ['Piano', 'Electric piano', 'Organ', 'Pad', 'Strings', 'Synth lead', 'Synth bass'];
const KEYS_STYLES = ['Pad (held)', 'Block chords', 'Broken chords', 'Arpeggio up', 'Off-beat stabs'];
const KEYS_TARGETS = [['keys', '🎹 Keys'], ['bass', 'Bass'], ['lead', 'Lead guitar']];
const KY = { target: ['keys', 'bass', 'lead'].includes(CFG.keysTarget) ? CFG.keysTarget : 'keys', oct: 4, held: new Map(), lit: new Map(), rec: false, bf: null, pend: new Map(), voice: null, noise: new WeakMap(), down: false, keys: new Map() };
const kySound = () => KEYS_SOUNDS.includes(S.band.keysSound) ? S.band.keysSound : 'Piano';
const kyStyle = () => KEYS_STYLES.includes(S.band.keysStyle) ? S.band.keysStyle : 'Pad (held)';

/* ---------- the sounds ---------- */
function kyNoise(c) { let b = KY.noise.get(c); if (!b) { b = c.createBuffer(1, Math.floor(c.sampleRate * .05), c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); KY.noise.set(c, b); } return b; }
/** one keys note: `dur` in seconds, or null for held until .stop(t). Plays into the Keys channel of the mixer. */
function keysVoice(time, midi, vel, dur, sound) {
  const c = E.ctx, out = E.tr && E.tr.keys ? E.tr.keys.in : E.mix; if (!c || !out) return null;
  const f = mtof(midi), v = clamp(vel || .8, .05, 1), env = c.createGain(), oscs = [], snd = sound || kySound(), pan = c.createStereoPanner ? c.createStereoPanner() : null; env.gain.value = 0; if (pan) { env.connect(pan); pan.connect(out); } else env.connect(out);
  const sp = x => { if (!c.createStereoPanner) return env; const p = c.createStereoPanner(); p.pan.value = x; return p; }, lfo = (hz, depth, param, t0, rise) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = hz; g.gain.setValueAtTime(rise ? 0 : depth, time); if (rise) g.gain.linearRampToValueAtTime(depth, time + (t0 || .3)); o.connect(g); g.connect(param); o.start(time); oscs.push(o); };
  const osc = (type, freq, g, dst, det) => { const o = c.createOscillator(), gg = c.createGain(); o.type = type; o.frequency.value = freq; if (det) o.detune.value = det; gg.gain.value = g; o.connect(gg); gg.connect(dst || env); o.start(time); oscs.push(o); return { o, g: gg }; };
  let rel = .1, sus = 0, stopAt = null;
  switch (snd) {
    case 'Electric piano': { const car = osc('sine', f, .9 * v), mod = c.createOscillator(), mg = c.createGain(); mod.frequency.value = f; mg.gain.setValueAtTime(f * 3 * v, time); mg.gain.setTargetAtTime(f * .35, time, .35); mod.connect(mg); mg.connect(car.o.frequency); mod.start(time); oscs.push(mod); const tine = osc('sine', f * 4, .12 * v); tine.g.gain.setTargetAtTime(0, time, .12);
      env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(.55, time + .004); env.gain.setTargetAtTime(.0001, time + .004, 1.4 + 200 / f); rel = .18;
      const bell = osc('sine', Math.min(f * 14.1, 15000), .07 * v); bell.g.gain.setTargetAtTime(.0001, time + .002, .04);      /* the bark of the hammer on the tine */
      if (pan) lfo(4.4, .35, pan.pan); break; }      /* the classic auto-pan tremolo */
    case 'Organ': { [[.5, .45], [1, 1], [2, .55], [3, .3], [4, .22], [6, .1]].forEach(([r, g]) => osc('sine', f * r, g * .28)); const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 6.2; lg.gain.value = 4; lfo.connect(lg); oscs.slice(-6).forEach(x => lg.connect(x.detune)); lfo.start(time); oscs.push(lfo);
      env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(.5 * (.6 + .4 * v), time + .012); sus = 1; rel = .07; break; }
    case 'Pad': {      /* four detuned saws spread left and right, a sub, a filter that breathes slowly */
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650 + 1500 * v; lp.Q.value = .7; lp.connect(env); lfo(.17, 380, lp.frequency);
      [[-14, -1], [-6, -.7], [6, .7], [14, 1]].forEach(([d, x]) => { const p = sp(x); if (p !== env) p.connect(lp); osc('sawtooth', f, .1, p === env ? lp : p, d); }); osc('sine', f / 2, .18, lp);
      env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(.5 * (.5 + .5 * v), time + .6); sus = 1; rel = 1.2; break; }
    case 'Strings': {      /* a bowed section: five players a few cents apart across the stage, vibrato that comes in after the bow */
      const lp = c.createBiquadFilter(), hp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400 + 1600 * v; lp.Q.value = .5; hp.type = 'highpass'; hp.frequency.value = 170; lp.connect(hp); hp.connect(env);
      const players = [[-12, -.7], [-5, -.35], [0, 0], [6, .35], [13, .7]].map(([d, x]) => { const p = sp(x); if (p !== env) p.connect(lp); return osc('sawtooth', f, .085, p === env ? lp : p, d); });
      const vo = c.createOscillator(), vg = c.createGain(); vo.frequency.value = 5.3; vg.gain.setValueAtTime(0, time); vg.gain.linearRampToValueAtTime(9, time + .45); vo.connect(vg); players.forEach(pl => vg.connect(pl.o.detune)); vo.start(time); oscs.push(vo);
      env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(.55 * (.5 + .5 * v), time + .28); sus = 1; rel = .7; break; }
    case 'Synth lead': { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(800 + 4200 * v, time); lp.frequency.setTargetAtTime(1600, time, .18); lp.connect(env); osc('sawtooth', f, .3, lp, -5); osc('square', f, .18, lp, 5);
      env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(.45, time + .006); env.gain.setTargetAtTime(.36, time + .006, .2); sus = 1; rel = .12; break; }
    case 'Synth bass': { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(300 + 1500 * v, time); lp.frequency.setTargetAtTime(260, time, .12); lp.connect(env); osc('sawtooth', f, .4, lp); osc('square', f / 2, .3, lp);
      env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(.6, time + .004); env.gain.setTargetAtTime(.48, time + .004, .25); sus = 1; rel = .08; break; }
    default: {      /* piano (2.45): two strings a cent apart for each of eight stretched partials, the high ones dying first; the harder you play the
                       brighter it starts, and the brightness fades as the note rings; a felt-hammer knock */
      const B = .00038, low = f < 220 ? 1.4 : 1, br = c.createBiquadFilter(); br.type = 'lowpass'; br.Q.value = .5; br.frequency.setValueAtTime(1800 + 7000 * v, time); br.frequency.setTargetAtTime(900 + 2600 * v, time + .01, .7); br.connect(env);
      [1, .55, .36, .24, .16, .11, .08, .06, .045, .035, .026, .02].forEach((g, k) => { const hN = k + 1, fp = f * hN * Math.sqrt(1 + B * hN * hN); if (fp > 15000) return; (k < 4 ? [[-.25, .26], [.25, .19]] : [[0, .32]]).forEach(([d, a]) => { const p = osc('sine', fp, g * a * (k ? .45 + .55 * v * v : 1), br, d);      /* two strings a fraction of a cent apart, one quieter: a slow shimmer that never cancels out */ p.g.gain.setTargetAtTime(.0001, time + .004, Math.max(.28, 3.4 - k * .3) * low * (f > 900 ? .5 : 1)); }); });      /* twelve partials: the high ones bright on the hammer and gone in a moment */
      const n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain(); n.buffer = kyNoise(c); bp.type = 'bandpass'; bp.frequency.value = 1800 + f; bp.Q.value = 1.2; ng.gain.value = .12 * v; n.connect(bp); bp.connect(ng); ng.connect(env); n.start(time); oscs.push(n);
      env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(.32 + .5 * v, time + .003); rel = .25;
    }
  }
  try { kitSend(env, { Piano: .2, 'Electric piano': .12, Organ: .1, Pad: .22, Strings: .3 }[snd] || .08, 'keys'); } catch (e) { }      /* 2.45: the keys in a room */
  const stop = t => { if (stopAt != null) return; stopAt = Math.max(t, time + .02); env.gain.cancelScheduledValues(stopAt); env.gain.setTargetAtTime(0, stopAt, rel / 3); oscs.forEach(o => { try { o.stop(stopAt + rel * 2 + .05); } catch (e) { } }); };
  if (dur != null) stop(time + Math.max(.05, dur)); else if (!sus) { oscs.forEach(o => { try { o.stop(time + 12); } catch (e) { } }); }
  const end = dur != null ? time + dur : time + 30; KY.lit.set(midi, { a: time, b: end, by: 'keys' });
  return { stop: t => { stop(t); const l = KY.lit.get(midi); if (l) l.b = t; } };
}

/* ---------- in the band ---------- */
/** chord tones for the right hand near middle C, moving as little as possible from the last chord; the root low for the left */
function kyVoicing(sym) {
  const ch = parseChord(sym); if (!ch) return null; const prev = KY.voice || [60, 64, 67], c0 = prev.reduce((a, b) => a + b, 0) / prev.length;
  const up = ch.pcs.slice(0, 4).map(pc => { let m = 48 + pc; while (m < c0 - 6) m += 12; while (m > c0 + 6) m -= 12; return Math.max(55, Math.min(79, m)); }).sort((a, b) => a - b);
  KY.voice = up; return { up, low: 36 + ((ch.bass - 36) % 12 + 12) % 12 };
}
/** every 16th: the bar's own keys part if it has one, otherwise the band's keys player in its style */
function keysStep(bar, sib, cd, tt, dur) {
  if (!S.band.keysOn) return; const own = bar.keys && bar.keys.length;
  if (own) { bar.keys.forEach(n => { if (n.s === sib) kyOut(tt, n.m, n.v || .8, (n.d || 1) * dur * .95); }); return; }
  if (!cd || !cd.sym) return; const st = kyStyle(), V = (cd.rel === 0 || sib === 0) ? kyVoicing(cd.sym) : (KY.voice ? { up: KY.voice, low: null } : kyVoicing(cd.sym)); if (!V) return;
  const all = (len, vel) => V.up.forEach((m, i) => kyOut(tt + i * .006, m, vel, len));
  if (st === 'Pad (held)') { if (cd.rel === 0) { all(cd.len * dur * .98, .55); if (V.low) kyOut(tt, V.low, .5, cd.len * dur * .98); } }
  else if (st === 'Block chords') { if (sib % 4 === 0) { all(dur * 3.6, sib % 16 === 0 ? .8 : .65); if (sib % 8 === 0 && V.low) kyOut(tt, V.low + 12, .6, dur * 7); } }
  else if (st === 'Off-beat stabs') { if (sib % 4 === 2) all(dur * 1.1, .7); }
  else if (st === 'Broken chords') { if (sib % 2 === 0) { const k = (sib / 2) % 4, seq = V.low != null || KY.low != null ? [KY.low = V.low != null ? V.low + 12 : KY.low, V.up[0], V.up[1], V.up[V.up.length - 1]] : V.up; kyOut(tt, seq[k % seq.length], k ? .55 : .7, dur * 3); } }
  else if (st === 'Arpeggio up') { if (sib % 2 === 0) { const seq = V.up.concat(V.up.map(m => m + 12)), k = (sib / 2) % seq.length; kyOut(tt, seq[k], .6, dur * 2.2); } }
}

/* ---------- playing it: mouse, touch, computer keys, MIDI ---------- */
function kyNoteOn(m, v) {
  if (KY.held.has(m)) kyNoteOff(m); startAudio(); const c = E.ctx; if (!c) return; const t = c.currentTime + .005; v = v == null ? .8 : v;
  let h0 = null; if (KY.target === 'bass') pluck('bass', t, m, v, { id: 'kb' + m }); else if (KY.target === 'lead') pluck('lead', t, m, v, { id: 'kl' + m }); else { const sent = typeof moLive === 'function' && moLive(true, m, v); if (!sent || CFG.midiOut.local) h0 = keysVoice(t, m, v, null); if (sent) KY.sent = (KY.sent || new Set()).add(m); }
  if (KY.target !== 'keys') KY.lit.set(m, { a: t, b: t + 30, by: KY.target });
  KY.held.set(m, h0 || { stop: tt => { const l = KY.lit.get(m); if (l) l.b = tt; } });
  if (KY.rec && T.playing) KY.pend.set(m, { s: playheadSlot(), v });
  kyPaintAll(); bus.emit('keys:on', m);
}
function kyNoteOff(m) {
  const hd = KY.held.get(m); if (!hd) return; KY.held.delete(m); const c = E.ctx; hd.stop(c ? c.currentTime : 0); if (KY.sent && KY.sent.has(m)) { KY.sent.delete(m); moLive(false, m); }
  const p = KY.pend.get(m); if (p) { KY.pend.delete(m); kyWrite(m, p.s, playheadSlot(), p.v); } kyPaintAll();
}
/** a recorded note into the song: keys part, bass line or lead tab, rounded to the grid */
function kyWrite(m, s0, s1, v) {
  const g = [1, 2, 4].includes(CFG.keysQ) ? CFG.keysQ : 1, sp = spb(), start = Math.max(0, Math.round(s0 / g) * g), d = Math.max(g, Math.round((s1 - s0) / g) * g), bi = Math.floor(start / sp), fb = barsCache()[bi]; if (!fb) return;
  const s = start - bi * sp, bar = fb.bar, n = { s, m, d: Math.min(d, sp * 4), v: Math.round(v * 100) / 100 };
  if (KY.target === 'keys') { (bar.keys = bar.keys || []).push(n); }
  else if (KY.target === 'bass') { (bar.bassLine = bar.bassLine || []).push(n); }
  else { const cap = S.capo || 0, pl = wsPlace(m, 5); if (pl.f - cap < 0) return; bar.tab = bar.tab.filter(x => !(x.s === s && x.st === pl.s)); bar.tab.push({ s, st: pl.s, f: pl.f - cap, t: '' }); }
  KY.wrote = (KY.wrote || 0) + 1; kyPaintAll();
}
function kyRec(on) {
  on = on == null ? !KY.rec : !!on; if (on === KY.rec) return;
  if (on) { if (typeof PS !== 'undefined' && PS.rate !== 1) { toast('Recording keys is at the song’s own speed: set ⏱ back to 100% first.', 'warn'); return; } KY.bf = snap(); KY.wrote = 0; KY.rec = true; if (KY.target === 'keys') S.band.keysOn = true; if (KY.target === 'lead') S.band.leadOn = true; if (KY.target === 'bass') S.band.bassOn = true; if (!T.playing) play(); }
  else { KY.rec = false; [...KY.pend.keys()].forEach(m => kyNoteOff(m)); KY.pend.clear(); T.bars = null; if (KY.wrote) { histPush(KY.bf); toast(KY.wrote + ' note' + (KY.wrote === 1 ? '' : 's') + ' written into ' + { keys: 'the keys part', bass: 'the bass line', lead: 'the lead tab' }[KY.target] + '. Undo takes them out.', 'ok'); } KY.bf = null; }
  kyPaintAll(); try { syncBandStrip(); } catch (e) { }
}
/** clear the target's part in the section you are in (one undo) */
function kyClear() {
  const sec = S.sections[pedalSecs().i]; if (!sec) return; const bf = snap(); let n = 0;
  sec.bars.forEach(b => { if (KY.target === 'keys' && b.keys) { n += b.keys.length; b.keys = []; } if (KY.target === 'bass' && b.bassLine) { n += b.bassLine.length; b.bassLine = []; } });
  if (KY.target === 'lead') { toast('Lead tab is cleared in Write (Clear bar).', ''); return; }
  T.bars = null; if (n) { histPush(bf); toast('Cleared ' + n + ' note' + (n === 1 ? '' : 's') + ' in ' + sec.name + '.', 'ok'); } else toast('Nothing to clear in ' + sec.name + '.', '');
}
const KY_MAP = 'awsedftgyhujkolp;\''.split('');
document.addEventListener('keydown', e => {
  const d = document.getElementById('keysRoom'); if (!d || !d.open || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return; if (/^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return;
  const k = e.key.toLowerCase(); if (k === 'z' || k === 'x') { KY.oct = clamp(KY.oct + (k === 'z' ? -1 : 1), 1, 7); kyRoomPaint(); e.preventDefault(); return; }
  const i = KY_MAP.indexOf(k); if (i < 0) return; e.preventDefault(); e.stopPropagation(); const m = 12 * (KY.oct + 1) + i; if (KY.keys.has(k)) return; KY.keys.set(k, m); kyNoteOn(m, .8);
}, true);
document.addEventListener('keyup', e => { const k = e.key.toLowerCase(), m = KY.keys.get(k); if (m == null) return; KY.keys.delete(k); kyNoteOff(m); }, true);
/* a MIDI keyboard plays the keys while the Keys room is open (or always, with Settings ▸ Pedal & MIDI sync ▸ MIDI keyboard plays the keys) */
MIDIRAW.push(d => {
  const st = d[0] & 0xf0; if (st !== 0x90 && st !== 0x80) return false; const room = document.getElementById('keysRoom'); if (!(room && room.open) && !CFG.keysMidi) return false;
  if (st === 0x90 && d[2] > 0) kyNoteOn(d[1], d[2] / 127); else kyNoteOff(d[1]); return true;
});

/* ---------- the piano picture ---------- */
const KY_BLACK = [1, 3, 6, 8, 10];
/** an SVG keyboard from `lo` to `hi` (MIDI); keys carry data-m; paint() colours them */
function kyPiano(lo, hi, o = {}) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), whites = []; for (let m = lo; m <= hi; m++) if (!KY_BLACK.includes(m % 12)) whites.push(m);
  const W = 22, H = o.h || 96, BW = 14, BH = H * .62; svg.setAttribute('viewBox', '0 0 ' + whites.length * W + ' ' + (H + 2)); svg.setAttribute('class', 'ky-svg'); svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Piano keyboard, ' + pcName(lo % 12, false) + Math.floor(lo / 12 - 1) + ' to ' + pcName(hi % 12, false) + Math.floor(hi / 12 - 1));
  const el = (t, a) => { const e = document.createElementNS(ns, t); Object.entries(a).forEach(([k, v]) => e.setAttribute(k, v)); svg.append(e); return e; };
  const x = {}; whites.forEach((m, i) => { x[m] = i * W; const r = el('rect', { x: i * W + .5, y: .5, width: W - 1, height: H, rx: 3, class: 'ky-w', 'data-m': m }); r.setAttribute('aria-label', pcName(m % 12, false) + Math.floor(m / 12 - 1)); if (m % 12 === 0) el('text', { x: i * W + W / 2, y: H - 5, class: 'ky-c' }).textContent = 'C' + Math.floor(m / 12 - 1); });
  for (let m = lo; m <= hi; m++) if (KY_BLACK.includes(m % 12) && x[m - 1] != null) el('rect', { x: x[m - 1] + W - BW / 2, y: .5, width: BW, height: BH, rx: 2, class: 'ky-b', 'data-m': m });
  for (let m = lo; m <= hi; m++) { const bl = KY_BLACK.includes(m % 12), cx = bl ? x[m - 1] + W : x[m] + W / 2; if (cx == null || isNaN(cx)) continue; const t = el('text', { x: cx, y: bl ? BH - 6 : H - 18, class: 'ky-l' + (bl ? ' bl' : ''), 'data-l': m }); t.textContent = ''; }
  svg._lo = lo; svg._hi = hi;
  /* play by clicking, touching or dragging along it */
  const at = e => { const t = document.elementFromPoint(e.clientX, e.clientY); return t && t.dataset && t.dataset.m != null && svg.contains(t) ? +t.dataset.m : null; };
  svg.addEventListener('pointerdown', e => { const m = at(e); if (m == null) return; e.preventDefault(); KY.down = true; svg._cur = m; kyNoteOn(m, .75 + .2 * Math.min(1, (e.pressure || .5))); try { svg.setPointerCapture(e.pointerId); } catch (er) { } });
  svg.addEventListener('pointermove', e => { if (!KY.down || svg._cur == null) return; const m = at(e); if (m == null || m === svg._cur) return; kyNoteOff(svg._cur); svg._cur = m; kyNoteOn(m, .7); });
  const up = () => { if (svg._cur != null) kyNoteOff(svg._cur); svg._cur = null; KY.down = false; }; svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up); svg.addEventListener('lostpointercapture', up);
  return svg;
}
/** what to show: the chord at the playhead (or the bar you are on), the song's scale, and what is sounding now */
function kyMarks() {
  const sp = spb(), slot = T.playing ? playheadSlot() : T.cursor, bi = Math.max(0, Math.floor(slot / sp)), cd = chordAt(bi, Math.max(0, Math.floor(slot - bi * sp))), ch = cd && cd.sym ? parseChord(cd.sym) : null;
  const scale = (SCALES[S.scale] || SCALES['Major (Ionian)']).map(i => (S.key + i) % 12), now = E.ctx ? E.ctx.currentTime : 0, on = new Set();
  KY.lit.forEach((l, m) => { if (now >= l.a - .02 && now <= l.b) on.add(m); else if (now > l.b + 1) KY.lit.delete(m); }); KY.held.forEach((_, m) => on.add(m));
  const me = AN.active && AN.midi != null ? AN.midi : null; return { ch, scale, on, me, sym: cd && cd.sym };
}
function kyPaint(svg, mk) {
  if (!svg || !svg.isConnected) return; mk = mk || kyMarks(); const deg = CFG.fretNames === 'degrees';
  svg.querySelectorAll('[data-m]').forEach(k => { const m = +k.dataset.m, pc = m % 12, inCh = mk.ch && mk.ch.pcs.includes(pc), root = mk.ch && mk.ch.root === pc;
    k.classList.toggle('ch', !!inCh); k.classList.toggle('root', !!root); k.classList.toggle('sc', mk.scale.includes(pc)); k.classList.toggle('on', mk.on.has(m)); k.classList.toggle('me', mk.me === m); });
  svg.querySelectorAll('[data-l]').forEach(t => { const m = +t.dataset.l, pc = m % 12, inCh = mk.ch && mk.ch.pcs.includes(pc); t.textContent = inCh ? (deg ? ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'][((pc - mk.ch.root) % 12 + 12) % 12] : pcName(pc, CFG.flats)) : ''; });
}
function kyPaintAll() { const mk = kyMarks(); document.querySelectorAll('svg.ky-svg:not(.co-ky)').forEach(s => kyPaint(s, mk)); const st = document.getElementById('kyChord'); if (st) st.textContent = mk.sym ? 'Chord: ' + mk.sym : ''; }
/* keep it moving while it is on screen */
(function kyLoop() { requestAnimationFrame(kyLoop); const vis = [...document.querySelectorAll('svg.ky-svg:not(.co-ky)')].some(s => s.isConnected && s.getBoundingClientRect().width > 0); if (!vis) return; const now = performance.now(); if (now - (KY.pt || 0) < 60) return; KY.pt = now; kyPaintAll(); })();

/* ---------- under Write, beside the fretboard ---------- */
const kyWrOn = () => !!CFG.wrPiano;
function kyMountWrite() {
  if (!UI.wrBar || !UI.wrFretBox || document.getElementById('wrPianoBtn')) return;
  const btn = h('button', { class: 'btn sm wr-fb', id: 'wrPianoBtn', type: 'button', title: 'Show the piano under the canvas instead of the fretboard', 'aria-pressed': String(kyWrOn()), onclick: () => { CFG.wrPiano = !kyWrOn(); if (CFG.wrPiano && wrFretOn()) { WR.fret = false; CFG.wrFret = false; wrLayout(); } saveCfg(); kyWrSync(); } }, h('span', { class: 'wr-fl' }, '🎹 Piano'));
  UI.wrFretBtn.after(btn); UI.wrPianoBtn = btn;
  UI.wrPiano = h('div', { class: 'wr-piano', id: 'wrPiano' }, h('div', { class: 'wr-fh' }, h('b', { class: 'small' }, 'PIANO'), h('span', { class: 'tiny muted grow', id: 'kyChord' }), h('button', { class: 'btn sm', type: 'button', onclick: () => keysOpen() }, '🎹 Keys…')), h('div', { class: 'ky-wrap' }, kyPiano(36, 84, { h: 82 })));
  UI.wrFretBox.after(UI.wrPiano); kyWrSync();
}
function kyWrSync() { if (!UI.wrPiano) return; const on = kyWrOn(); UI.wrPiano.hidden = !on; UI.wrPianoBtn.classList.toggle('on', on); UI.wrPianoBtn.setAttribute('aria-pressed', String(on)); if (on) kyPaintAll(); }
bus.on('booted', kyMountWrite); bus.on('dock', () => kyMountWrite()); setTimeout(kyMountWrite, 0);

/* ---------- the Keys room ---------- */
function keysOpen() {
  let d = document.getElementById('keysRoom'); if (!d) { d = h('dialog', { class: 'keys-room', id: 'keysRoom', 'aria-labelledby': 'keysT' }); document.body.append(d); d.addEventListener('close', () => { [...KY.held.keys()].forEach(kyNoteOff); if (KY.rec) kyRec(false); }); }
  kyRoomBuild(); if (!d.open) d.showModal(); startAudio(); return d;
}
function kyRoomBuild() {
  const d = document.getElementById('keysRoom'); if (!d) return; d.innerHTML = ''; const lo = 12 * (KY.oct + 1) - 12, wide = innerWidth > 900;
  const sel = (id, label, opts, val, fn) => h('label', { class: 'field' }, label, h('select', { class: 'in', id, onchange: e => fn(e.target.value) }, opts.map(([v, t]) => h('option', { value: v, selected: String(val) === String(v) }, t))));
  d.append(
    h('div', { class: 'co-top' }, h('div', { class: 'co-tt' }, h('small', {}, 'Play, hear, write it down'), h('b', { id: 'keysT' }, '🎹 Keys')), h('span', { class: 'tiny muted', id: 'kyChord' }), h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Close Keys', onclick: () => d.close() }, '✕')),
    h('div', { class: 'ky-ctl' },
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Plays into', id: 'kyTarget' }, KEYS_TARGETS.map(([v, t]) => h('button', { type: 'button', class: KY.target === v ? 'on' : '', 'aria-pressed': String(KY.target === v), 'data-t': v, onclick: () => { KY.target = v; CFG.keysTarget = v; saveCfg(); kyRoomBuild(); } }, t))),
      KY.target === 'keys' ? sel('kySound', 'Sound', KEYS_SOUNDS.map(x => [x, x]), kySound(), v => { S.band.keysSound = v; commit(false); }) : h('span', { class: 'small muted' }, KY.target === 'bass' ? 'The band’s bass plays what you play.' : 'The band’s lead guitar plays what you play.'),
      h('span', { class: 'ky-oct' }, h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Octave down (Z)', onclick: () => { KY.oct = clamp(KY.oct - 1, 1, 7); kyRoomBuild(); } }, '−'), h('b', { class: 'mono' }, 'C' + KY.oct), h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Octave up (X)', onclick: () => { KY.oct = clamp(KY.oct + 1, 1, 7); kyRoomBuild(); } }, '+'))),
    h('div', { class: 'ky-wrap big' }, kyPiano(lo, lo + (wide ? 36 : 24), { h: 140 })),
    h('div', { class: 'ky-ctl' },
      h('button', { class: 'btn' + (KY.rec ? ' rec-on' : ' primary'), id: 'kyRec', type: 'button', onclick: () => kyRec() }, KY.rec ? '■ Stop recording' : '● Record into ' + { keys: 'the keys part', bass: 'the bass line', lead: 'the lead tab' }[KY.target]),
      sel('kyQ', 'Round to', [[1, '16ths'], [2, '8ths'], [4, 'quarters']], [1, 2, 4].includes(CFG.keysQ) ? CFG.keysQ : 1, v => { CFG.keysQ = +v; saveCfg(); }),
      h('button', { class: 'btn sm', id: 'kyClear', type: 'button', onclick: kyClear }, 'Clear in this section'),
      h('button', { class: 'btn sm', id: 'kyRoll', type: 'button', onclick: () => { d.close(); rollOpen(KY.target === 'bass' ? 'bass' : 'keys'); } }, '🎛 Piano roll…')),
    h('div', { class: 'ky-band' },
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'kyBand', checked: !!S.band.keysOn, onchange: e => { toggleBand('keysOn', e.target.checked); } }), 'Keys in the band'),
      sel('kyStyle', 'Style', KEYS_STYLES.map(x => [x, x]), kyStyle(), v => { S.band.keysStyle = v; commit(false); }),
      h('span', { class: 'tiny muted' }, 'A part you recorded plays in its bars; elsewhere the keys player follows the chords.')),
    typeof duckView === 'function' ? duckView() : null,
    h('p', { class: 'tiny muted' }, 'Play with the mouse or a touch screen, the computer keys A W S E D F T G Y H U J K O L P ; (Z and X move an octave), or a MIDI keyboard while this is open. The highlighted keys are the chord that is playing; the root is darker.'));
  kyPaintAll();
}
function kyRoomPaint() { kyRoomBuild(); }
