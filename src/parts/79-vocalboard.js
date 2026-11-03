/* ============================================================
   Part 79 · VOCAL PEDALBOARD (2.31) — seven stompboxes for the voice
   After the vocal polish, in this order: 🤘 Scream · De-esser · 📢 Megaphone · Doubler · Harmony · Echo · Reverb. The live voice and
   vocal takes both go through it (takes are kept clean and played back through it, so the sound can still change after you sing),
   and a fast bounce builds the same board offline.
     · Scream     a gate, hard compression, grit blended beside the clean voice (focused on the mids, so words stay clear) and an
                  analog-style octave down for growl that adds no delay. Styles: Rasp, Hardcore, Fry growl, Death growl
     · De-esser   turns the band above 4–9 kHz down only while it is loud
     · Megaphone  megaphone, radio or telephone: the voice squeezed into a band and driven
     · Doubler    two slightly delayed, slightly moving copies left and right: a double-tracked voice
     · Harmony    a voice a third or a fifth above or below that stays in the song's key (or on the chord playing): the worklet finds
                  the note you sing and moves it by steps of the scale. It lands a few hundredths of a second after you
     · Echo       in time with the song (1/4, dotted 1/8, 1/8 …); Throw: only while the pedal is held, so one word echoes
     · Reverb     room, plate or hall, with its lows cut so it does not muddy the voice
   Presets (Clean lead, Rock grit, Scream, Ballad, Ambient echo, Harmony lead, Megaphone) set the whole board; a song can switch
   presets per section as it plays (S.vbSec), and the foot pedal can switch Scream, step through presets and hold an echo throw.
   With Scream or Megaphone on, the show turns gritty, as it does for a megaphone pedal (part 78).
   ============================================================ */
const VB_DEF = {
  scream: { style: 'Rasp', grit: .35, growl: 0, gate: -55, level: 1 },
  deess: { amount: .5, freq: 6500 },
  mega: { style: 'Megaphone', drive: .6, level: 1 },
  double: { mix: .35, width: .8 },
  harm: { voice: 'Third above', mix: .45, follow: 'key' },
  echo: { time: '1/8 dotted', mix: .25, fb: .35, throw: false },
  verb: { type: 'Plate', mix: .2, decay: 1.6 }
};
const VB_ORDER = [['scream', '🤘', 'Scream'], ['deess', '𝑺', 'De-esser'], ['mega', '📢', 'Megaphone'], ['double', '👥', 'Doubler'], ['harm', '🎶', 'Harmony'], ['echo', '⟲', 'Echo'], ['verb', '◌', 'Reverb']];
const VB_SCREAM = { 'Rasp': { grit: .35, growl: 0, gate: -55 }, 'Hardcore': { grit: .65, growl: .15, gate: -50 }, 'Fry growl': { grit: .55, growl: .45, gate: -50 }, 'Death growl': { grit: .85, growl: .75, gate: -46 } };
const VB_MEGA = { 'Megaphone': [500, 3000, 1600, 8], 'Radio': [300, 4200, 1800, 5], 'Telephone': [380, 3400, 1200, 4] };
const VB_VOICES = { 'Third above': [2], 'Third below': [-2], 'Fifth above': [4], 'Third and fifth above': [2, 4], 'Octave below': [null, -12], 'Octave above': [null, 12] };
const VB_TIMES = { '1/4': 1, '1/8 dotted': .75, '1/8': .5, '1/4 triplet': 2 / 3, '1/16': .25 };
const VB_PRESETS = {
  'Off': {},
  'Clean lead': { deess: {}, verb: { type: 'Plate', mix: .15, decay: 1.4 } },
  'Rock grit': { scream: { style: 'Rasp', grit: .35, growl: 0 }, deess: {}, double: { mix: .25 }, verb: { type: 'Room', mix: .14, decay: 1 } },
  'Scream': { scream: { style: 'Hardcore', grit: .65, growl: .15 }, deess: {}, verb: { type: 'Room', mix: .12, decay: 1 } },
  'Ballad': { deess: {}, double: { mix: .35 }, echo: { time: '1/4', mix: .14, fb: .25 }, verb: { type: 'Plate', mix: .28, decay: 2.2 } },
  'Ambient echo': { deess: {}, double: { mix: .2 }, echo: { time: '1/8 dotted', mix: .32, fb: .5 }, verb: { type: 'Hall', mix: .32, decay: 3 } },
  'Harmony lead': { deess: {}, harm: { voice: 'Third above', mix: .45 }, double: { mix: .2 }, verb: { type: 'Plate', mix: .2, decay: 1.6 } },
  'Megaphone': { mega: { style: 'Megaphone', drive: .6 }, verb: { type: 'Room', mix: .1, decay: .8 } }
};
CFG.vb = Object.assign({ preset: 'Off', on: {}, p: {}, react: true }, CFG.vb && typeof CFG.vb === 'object' ? CFG.vb : {});
Object.keys(VB_DEF).forEach(k => { CFG.vb.p[k] = Object.assign({}, VB_DEF[k], CFG.vb.p[k] || {}); if (CFG.vb.on[k] == null) CFG.vb.on[k] = false; });
const VBS = { held: false, applied: null, bpm: 0, tm: 0, chord: '' };

/* ---------- the pedals, built on any audio context (the live one, or the offline one a fast bounce uses) ---------- */
function vbWrap(fx) { const i = gn(1), o = gn(1), dry = gn(1), wet = gn(0); i.connect(dry); dry.connect(o); i.connect(fx.in); fx.out.connect(wet); wet.connect(o); return { in: i, out: o, fx, on: false, setOn(v) { v = !!v; this.on = v; tc(dry.gain, v ? 0 : 1, .01); tc(wet.gain, v ? 1 : 0, .01); } }; }
const vbWorklet = (c, name) => { if (!E.worklet) return null; try { return new AudioWorkletNode(c, name, { channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1] }); } catch (e) { return null; } };
function vbScream(c) {
  const i = gn(1), o = gn(1), gate = vbWorklet(c, 'fw-gate') || gn(1), cmp = mkComp(c), mk = gn(1.6), dryG = gn(1), hp = bq('highpass', 220), pk = bq('peaking', 1800, .9, 6), drv = gn(1), sh = mkShaper(c), lp = bq('lowpass', 6500), gritG = gn(0);
  const oct = vbWorklet(c, 'fw-oct'), olp = bq('lowpass', 700), odr = gn(2), sh2 = mkShaper(c), growlG = gn(0), lv = gn(1);
  cmp.threshold.value = -28; cmp.ratio.value = 6; cmp.knee.value = 6; cmp.attack.value = .003; cmp.release.value = .12; sh.curve = satCurve(5); sh.oversample = '4x'; sh2.curve = satCurve(3);
  chainN(i, gate, cmp, mk); mk.connect(dryG); dryG.connect(lv); chainN(mk, hp, pk, drv, sh, lp, gritG); gritG.connect(lv); if (oct) { chainN(mk, oct, olp, odr, sh2, growlG); growlG.connect(lv); } lv.connect(o);
  if (gate.port) gate.port.postMessage({ range: -70, rel: 120, hold: 30 });
  return { in: i, out: o, set(k, v) { switch (k) {
    case 'grit': tc(dryG.gain, 1 - .55 * v); tc(drv.gain, 1 + v * v * 40); tc(gritG.gain, v > 0 ? .25 + .55 * v : 0); break;
    case 'growl': tc(growlG.gain, v * .9); break; case 'gate': if (gate.port) gate.port.postMessage({ th: v }); break; case 'level': tc(lv.gain, v); break; } } };
}
function vbDeess(c) { const n = vbWorklet(c, 'fw-deess'); if (!n) { const g = gn(1); return { in: g, out: g, set() { } }; } return { in: n, out: n, set(k, v) { if (k === 'amount') n.port.postMessage({ th: -14 - v * 30 }); if (k === 'freq') n.port.postMessage({ f: v }); } }; }
function vbMega(c) {
  const i = gn(1), h1 = bq('highpass', 500), h2 = bq('highpass', 500), pk = bq('peaking', 1600, 1, 8), drv = gn(4), sh = mkShaper(c), l1 = bq('lowpass', 3000), l2 = bq('lowpass', 3000), lv = gn(.8);
  sh.curve = satCurve(6); chainN(i, h1, h2, pk, drv, sh, l1, l2, lv);
  return { in: i, out: lv, set(k, v) { switch (k) {
    case 'style': { const m = VB_MEGA[v] || VB_MEGA.Megaphone; [h1, h2].forEach(f => { f.frequency.value = m[0]; }); [l1, l2].forEach(f => { f.frequency.value = m[1]; }); pk.frequency.value = m[2]; pk.gain.value = m[3]; break; }
    case 'drive': tc(drv.gain, 1 + v * 12); tc(lv.gain, .9 - v * .35); break; case 'level': break; } } };
}
function vbDouble(c) {
  const i = gn(1), o = gn(1), dry = gn(1), mk = (t, f, dep) => { const d = c.createDelay(.1); d.delayTime.value = t; const l = c.createOscillator(); l.frequency.value = f; const lg = gn(dep); l.connect(lg); lg.connect(d.delayTime); l.start(); const p = c.createStereoPanner(), g = gn(0); i.connect(d); d.connect(p); p.connect(g); g.connect(o); return { p, g }; };
  i.connect(dry); dry.connect(o); const a = mk(.021, .13, .0018), b = mk(.031, .17, .0022);
  return { in: i, out: o, set(k, v) { if (k === 'mix') { tc(a.g.gain, v * .8); tc(b.g.gain, v * .8); } if (k === 'width') { a.p.pan.value = -v; b.p.pan.value = v; } } };
}
function vbHarm(c) {
  const i = gn(1), o = gn(1), dry = gn(1), vs = [0, 1].map(k => { const n = vbWorklet(c, 'fw-harm'); if (!n) return null; const p = c.createStereoPanner(), g = gn(0); p.pan.value = k ? .35 : -.35; i.connect(n); n.connect(p); p.connect(g); g.connect(o); return { n, g }; });
  i.connect(dry); dry.connect(o); let mix = .45, voice = 'Third above';
  const upd = () => { const spec = VB_VOICES[voice] || VB_VOICES['Third above'], scale = vbScale();
    vs.forEach((v, k) => { if (!v) return; const st = spec[0] === null ? null : spec[k], fixed = spec[0] === null && k === 0 ? spec[1] : null, used = spec[0] === null ? k === 0 : st != null;
      v.n.port.postMessage({ scale, steps: st == null ? 2 : st, fixed }); tc(v.g.gain, used ? mix * (spec.length > 1 && spec[0] !== null ? .8 : 1) : 0); }); };
  return { in: i, out: o, voices: vs, upd, set(k, v) { if (k === 'mix') mix = v; if (k === 'voice') voice = v; upd(); } };
}
function vbEcho(c) {
  const i = gn(1), o = gn(1), dry = gn(1), send = gn(1), d = c.createDelay(3), tone = bq('lowpass', 4500), fb = gn(.35), wet = gn(.25), d2 = c.createDelay(3), p1 = c.createStereoPanner(), p2 = c.createStereoPanner();
  i.connect(dry); dry.connect(o); i.connect(send); send.connect(d); d.connect(tone); tone.connect(fb); fb.connect(d); tone.connect(p1); p1.connect(wet); tone.connect(d2); d2.connect(p2); p2.connect(wet); wet.connect(o); p1.pan.value = -.4; p2.pan.value = .4;
  const st = { time: '1/8 dotted', throw: false }; const retime = () => { const s = clamp(60 / (S.bpm || 100) * (VB_TIMES[st.time] || .75), .03, 2.9); tc(d.delayTime, s, .03); tc(d2.delayTime, Math.min(2.9, s * .5), .03); };
  const sendOn = () => tc(send.gain, !st.throw || VBS.held ? 1 : 0, .01);
  return { in: i, out: o, retime, sendOn, set(k, v) { switch (k) { case 'mix': tc(wet.gain, v); break; case 'fb': tc(fb.gain, Math.min(.9, v)); break; case 'time': st.time = v; retime(); break; case 'throw': st.throw = !!v; sendOn(); break; } } };
}
function vbVerb(c) { const u = FX.reverb.build(c); u.set('lowcut', 220); u.set('pre', 18); u.set('damp', .55); return u; }
/** the song's scale as twelve flags, for the harmony voices */
function vbScale() { const iv = SCALES[S.scale] || (S.minor ? SCALES['Natural Minor (Aeolian)'] : SCALES['Major (Ionian)']), f = new Array(12).fill(0); iv.forEach(x => { f[(S.key + x) % 12] = 1; }); return f; }
/** build the board between `from` and `to` on context c (called while the engine's graph is built, part 02) */
function vbAttach(c, from, to) {
  const B = { c, u: {} }; const mk = { scream: vbScream, deess: vbDeess, mega: vbMega, double: vbDouble, harm: vbHarm, echo: vbEcho, verb: vbVerb };
  let prev = from; VB_ORDER.forEach(([k]) => { const w = vbWrap(mk[k](c)); B.u[k] = w; prev.connect(w.in); prev = w.out; }); prev.connect(to);
  E.vb = B; vbApply(B); return B;
}
/** CFG.vb onto a board */
function vbApply(B) {
  B = B || E.vb; if (!B) return;
  VB_ORDER.forEach(([k]) => { const w = B.u[k], p = CFG.vb.p[k]; Object.keys(p).forEach(q => { try { w.fx.set(q, p[q]); } catch (e) { } }); w.setOn(!!CFG.vb.on[k]); });
  vbLook();
}

/* ---------- using it ---------- */
function vbSave() { saveCfg(); vbApply(); vbPaint(); }
function vbToggle(k, on) { CFG.vb.on[k] = on == null ? !CFG.vb.on[k] : !!on; CFG.vb.preset = ''; vbSave(); bus.emit('vb', k); }
function vbSet(k, q, v) {
  CFG.vb.p[k][q] = v; if (k === 'scream' && q === 'style' && VB_SCREAM[v]) Object.assign(CFG.vb.p.scream, VB_SCREAM[v]);
  CFG.vb.preset = ''; saveCfg(); vbApply(); if (k === 'scream' && q === 'style') vbPaint();
}
/** a preset: every pedal on or off as it says, with its settings */
function vbPreset(name, quiet) {
  const P = VB_PRESETS[name]; if (!P) return false; VB_ORDER.forEach(([k]) => { CFG.vb.on[k] = !!P[k]; if (P[k]) CFG.vb.p[k] = Object.assign({}, VB_DEF[k], P[k]); });
  if (P.scream && P.scream.style && VB_SCREAM[P.scream.style]) CFG.vb.p.scream = Object.assign({}, VB_DEF.scream, VB_SCREAM[P.scream.style], P.scream);
  CFG.vb.preset = name; VBS.applied = name; vbSave(); if (!quiet) toast('🎤 ' + name, 'ok'); bus.emit('vb', 'preset'); return true;
}
function vbPresetNext() { const ks = Object.keys(VB_PRESETS).filter(k => k !== 'Off'), i = ks.indexOf(CFG.vb.preset); vbPreset(ks[(i + 1) % ks.length]); }
/** the echo throw: the echo hears the voice only while the pedal is held */
function vbThrow(held) { VBS.held = !!held; if (!CFG.vb.p.echo.throw && held) { CFG.vb.p.echo.throw = true; saveCfg(); vbApply(); } const B = E.vb; if (B) B.u.echo.fx.sendOn(); }
/** Scream or Megaphone on: the show's gritty look (part 78), whether or not a hardware pedal is being listened for */
function vbLook() {
  if (typeof MEG === 'undefined') return; const want = !!(CFG.vb.react && (CFG.vb.on.scream || CFG.vb.on.mega)); if (want === !!MEG.force) return;
  MEG.force = want; if (want) megSet(true); else if (!CFG.mega.on) megSet(false);
}
const vbSecKey = (sec, i) => sec.id || ('#' + i);
/** a quarter of a second: the echo follows the tempo, harmony the chord, and a section with its own preset switches to it */
function vbTick() {
  const B = E.vb; if (!B || B.c !== E.ctx) return;
  if (VBS.bpm !== S.bpm) { VBS.bpm = S.bpm; B.u.echo.fx.retime(); }
  if (CFG.vb.on.harm && CFG.vb.p.harm.follow === 'chord') { let sym = ''; try { const inf = stageInfo(); sym = inf && inf.sym || ''; } catch (e) { } if (sym !== VBS.chord) { VBS.chord = sym; const ch = sym ? parseChord(sym) : null; B.u.harm.fx.voices.forEach(v => v && v.n.port.postMessage({ chord: ch ? ch.pcs : null })); } }
  else if (VBS.chord) { VBS.chord = ''; B.u.harm.fx.voices.forEach(v => v && v.n.port.postMessage({ chord: null })); }
  if (T.playing && S.vbSec) { const sp = spb(), bi = Math.max(0, Math.floor(playheadSlot() / sp)), fb = barsCache()[Math.min(bi, barsCache().length - 1)]; if (fb) { const i = S.sections.indexOf(fb.sec), want = S.vbSec[vbSecKey(fb.sec, i)]; if (want && want !== VBS.applied && VB_PRESETS[want]) vbPreset(want, true); } }
}
setInterval(vbTick, 250);
bus.on('song', () => { if (E.vb && E.vb.u.harm) E.vb.u.harm.fx.upd(); });

/* ---------- the room ---------- */
function vbKnob(k, q, label, min, max, step, fmt) { const v = CFG.vb.p[k][q]; return h('label', { class: 'vb-k' }, h('span', {}, label), h('input', { type: 'range', min, max, step, value: v, 'aria-label': label, oninput: e => { vbSet(k, q, +e.target.value); const o = e.target.nextSibling; if (o) o.textContent = fmt ? fmt(+e.target.value) : ''; } }), h('output', {}, fmt ? fmt(v) : '')); }
function vbSel(k, q, label, opts) { return h('label', { class: 'vb-k' }, h('span', {}, label), h('select', { class: 'in', 'aria-label': label, onchange: e => vbSet(k, q, e.target.value) }, opts.map(o => h('option', { value: o, selected: CFG.vb.p[k][q] === o }, o)))); }
const pc = v => Math.round(v * 100) + '%';
function vbControls(k) {
  switch (k) {
    case 'scream': return [vbSel(k, 'style', 'Style', Object.keys(VB_SCREAM)), vbKnob(k, 'grit', 'Grit', 0, 1, .01, pc), vbKnob(k, 'growl', 'Growl', 0, 1, .01, pc), vbKnob(k, 'gate', 'Gate', -80, -30, 1, v => v + ' dB')];
    case 'deess': return [vbKnob(k, 'amount', 'Amount', 0, 1, .01, pc), vbKnob(k, 'freq', 'Above', 4000, 9000, 100, v => (v / 1000).toFixed(1) + ' kHz')];
    case 'mega': return [vbSel(k, 'style', 'Sound', Object.keys(VB_MEGA)), vbKnob(k, 'drive', 'Drive', 0, 1, .01, pc)];
    case 'double': return [vbKnob(k, 'mix', 'Blend', 0, 1, .01, pc), vbKnob(k, 'width', 'Width', 0, 1, .01, pc)];
    case 'harm': return [vbSel(k, 'voice', 'Voice', Object.keys(VB_VOICES)), vbSel(k, 'follow', 'Follows', ['key', 'chord']), vbKnob(k, 'mix', 'Blend', 0, 1, .01, pc)];
    case 'echo': return [vbSel(k, 'time', 'Time', Object.keys(VB_TIMES)), vbKnob(k, 'mix', 'Blend', 0, 1, .01, pc), vbKnob(k, 'fb', 'Repeats', 0, .9, .01, pc), h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!CFG.vb.p.echo.throw, onchange: e => vbSet('echo', 'throw', e.target.checked) }), 'Throw: only while the pedal is held')];
    case 'verb': return [vbSel(k, 'type', 'Space', ['Room', 'Plate', 'Hall']), vbKnob(k, 'mix', 'Blend', 0, 1, .01, pc), vbKnob(k, 'decay', 'Length', .3, 5, .1, v => v.toFixed(1) + ' s')];
  }
  return [];
}
function vbBoard() {
  const box = h('div', { class: 'vb-board', id: 'vbBoard' }), draw = () => {
    box.innerHTML = '';
    box.append(h('div', { class: 'vb-top' }, h('label', { class: 'vb-k' }, h('span', {}, 'Preset'), h('select', { class: 'in', id: 'vbPreset', onchange: e => vbPreset(e.target.value) }, (CFG.vb.preset ? [] : [h('option', { value: '', selected: true }, 'Your own')]).concat(Object.keys(VB_PRESETS).map(n => h('option', { value: n, selected: CFG.vb.preset === n }, n))))),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'vbReact', checked: !!CFG.vb.react, onchange: e => { CFG.vb.react = e.target.checked; saveCfg(); vbLook(); } }), 'The show turns gritty with Scream or Megaphone')),
      h('div', { class: 'vb-grid' }, VB_ORDER.map(([k, ico, name]) => h('div', { class: 'vb-ped' + (CFG.vb.on[k] ? ' on' : ''), 'data-ped': k },
        h('div', { class: 'vb-ph' }, h('span', { class: 'vb-ico', 'aria-hidden': 'true' }, ico), h('b', {}, name)),
        h('div', { class: 'vb-ctl' }, vbControls(k)),
        h('button', { class: 'vb-sw', 'data-sw': k, 'aria-pressed': String(!!CFG.vb.on[k]), 'aria-label': name + (CFG.vb.on[k] ? ' on' : ' off'), onclick: () => vbToggle(k) }, h('i', { 'aria-hidden': 'true' }), CFG.vb.on[k] ? 'On' : 'Off')))));
  };
  box._draw = draw; draw(); return box;
}
function vbSections() {
  const box = h('div', { class: 'vb-secs' }), opts = [''].concat(Object.keys(VB_PRESETS));
  box.append(h('p', { class: 'hub-note' }, 'Switch the board as the song plays: choose a preset for a section, and it comes in when the section starts. Leave a section on “—” to keep whatever is on.'));
  S.sections.forEach((sec, i) => box.append(h('label', { class: 'vb-sec' }, h('span', {}, sec.name), h('select', { class: 'in', 'data-sec': vbSecKey(sec, i), onchange: e => { const bf = snap(); S.vbSec = Object.assign({}, S.vbSec || {}); if (e.target.value) S.vbSec[vbSecKey(sec, i)] = e.target.value; else delete S.vbSec[vbSecKey(sec, i)]; commit(false); histPush(bf); } }, opts.map(o => h('option', { value: o, selected: ((S.vbSec || {})[vbSecKey(sec, i)] || '') === o }, o || '—'))))));
  return box;
}
function vbPaint() { const b = document.getElementById('vbBoard'); if (b && b._draw) b._draw(); }
function vocalBoardOpen(at) {
  return hubOpen('vocalboard', { ico: '🎤', title: 'Vocal pedals', sub: 'Seven stompboxes for your voice, after the vocal polish. You hear them while you monitor (Hear myself, on headphones), and vocal takes play back through them.', at, sections: [
    { key: 'board', label: 'The board', ico: '🎛', wide: true, body: () => [vbBoard()] },
    { key: 'song', label: 'By section', ico: '▦', body: () => [vbSections()] },
    { key: 'how', label: 'Good to know', ico: 'ⓘ', body: () => [
      h('p', { class: 'small' }, 'Scream, the doubler, the de-esser, echo and reverb add no delay you would notice. Harmony lands a few hundredths of a second after you (it has to hear the note first), which sounds natural for a backing voice. Scream’s growl is an analog-style octave down, so it is instant.'),
      h('p', { class: 'small' }, 'Use headphones, or your interface’s own monitoring: with speakers, any live vocal effect can feed back.'),
      h('p', { class: 'small' }, 'Scream lets you scream lighter: the pedal adds the grit so your throat does not have to. If it hurts or you go hoarse, stop; a coach who teaches fry and false-cord screaming is worth it.'),
      h('p', { class: 'small muted' }, 'Takes are recorded clean and played back through the board, so you can change the sound after you sing. Bounces include it. The foot pedal (Settings ▸ Pedal & MIDI sync) can switch Scream, step through presets and hold an echo throw.')] }
  ] });
}
bus.on('vb', () => vbPaint());
