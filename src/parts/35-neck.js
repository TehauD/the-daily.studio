/* =====================================================================
   Part 35 · The neck, wired to everything
   One list of "marks" on the neck (what is sounding, what is coming, what you are singing, a chord you picked in the
   neural graph) feeds the Fretboard pane AND a small neck drawn on top of the Visuals and the Neural graph, so the
   three stay in step and you still see the neck when the dock is hidden (full-screen stage).
   ===================================================================== */
const NK = { pin: null, ghost: null, ghostSlot: -9, voiceAt: 0 };
var NECK_FRETS = 22;

/** The next lead-guitar note (and the next chord change) after the playhead, with how long until it arrives. */
function nkNext() {
  if (!T.playing || !E.ctx) { NK.ghost = null; return null; }
  const ph = playheadSlot(), s0 = Math.floor(ph) + 1;
  if (NK.ghost && NK.ghostSlot === s0) { NK.ghost.eta = (NK.ghost.slot - ph) * slotDur(); NK.ghost.cEta = NK.ghost.cslot != null ? (NK.ghost.cslot - ph) * slotDur() : null; return NK.ghost; }
  const sp = spb(), bc = barsCache(), g = { lead: null, chord: null, slot: 0, cslot: null, eta: 9 }; let ln = null, ch = null;
  for (let s = s0; s < s0 + sp * 2 && !(ln && ch); s++) {
    const bi = Math.floor(s / sp), sib = s - bi * sp, fb = bc[bi]; if (!fb) break;
    if (!ln && S.band.leadOn) { const n = fb.bar.tab.find(x => x.s === sib && x.f !== 'x'); if (n) ln = { st: n.st, f: n.f, slot: s }; }
    if (!ch && s < s0 + sp) { const cd = chordAt(bi, sib); if (cd && cd.sym && cd.rel === 0 && (S.band.compOn || !S.band.leadOn)) ch = { sym: cd.sym, slot: s }; }
  }
  if (ln) { g.lead = { st: ln.st, f: ln.f }; g.slot = ln.slot; }
  if (ch) { const v = voicingFor(ch.sym); g.chord = v ? { sym: ch.sym, frets: v.frets } : null; g.cslot = ch.slot; }
  NK.ghost = g; NK.ghostSlot = s0; g.eta = (g.slot - ph) * slotDur(); g.cEta = g.cslot != null ? (g.cslot - ph) * slotDur() : null; return g;
}

/** Where the note you are singing (or hearing back) can be played on the neck. */
function nkVoice(now) {
  let m = null;
  if (HUM.rec && HUM.live && now - HUM.live.t < 350) m = HUM.live.m;
  else if (HUM.hear && HUM.hearT0 && HUM.an) { const tt = (now - HUM.hearT0) / 1000, n = HUM.an.notes.find(x => tt >= x.t && tt < x.t + x.d); if (n) m = n.m; }
  if (m == null) return [];
  const lo = S.tuning[0] + S.capo; while (m < lo) m += 12; while (m > lo + 38) m -= 12;
  const out = []; S.tuning.forEach((open, st) => { const f = m - (open + S.capo); if (f >= 0 && f <= 15) out.push({ st, f, k: 'voice', a: 1 }); });
  return out;
}

/** Everything lit on the neck right now: [{st, f, k: hit|ghost|voice|pin, a}] */
function neckMarks(now) {
  now = now || performance.now(); const out = [];
  PB.hits.forEach(p => { const a = 1 - (now - p.t) / 420; if (a > .02) out.push({ st: p.st, f: p.f, k: 'hit', a }); });
  const g = nkNext(); if (g) {
    if (g.lead && g.eta < 2.2) out.push({ st: g.lead.st, f: g.lead.f, k: 'ghost', a: clamp(1.15 - g.eta / 1.6, .3, 1) });
    if (g.chord && g.cEta != null && g.cEta < 1.6) g.chord.frets.forEach((f, st) => { if (f != null) out.push({ st, f, k: 'ghost', a: clamp(.9 - g.cEta / 2, .2, .55) }); });
  }
  nkVoice(now).forEach(x => out.push(x));
  if (NK.pin) { const left = NK.pin.until - now; if (left <= -900) NK.pin = null; else NK.pin.frets.forEach((f, st) => { if (f != null) out.push({ st, f, k: 'pin', a: clamp(1 + left / 900, 0, 1) }); }); }
  return out;
}
const nkActive = () => !!(NK.pin || T.playing || HUM.rec || HUM.hear);

/** Pick a chord (from the neural graph, say): show its shape on every neck and strum it. */
async function nkPinChord(sym) {
  const v = voicingFor(sym); if (!v) return; NK.pin = { sym, frets: v.frets.slice(), until: performance.now() + 5200 };
  try { await startAudio(); const t = E.ctx.currentTime + .02; let k = 0; v.frets.forEach((f, st) => { if (f != null) pluck('lead', t + (k++) * .028, S.tuning[st] + S.capo + f, .62, { id: 'p' + st, pan: (st - 2.5) * .08 }); }); } catch (e) { }
  toast(sym + ' is on the fretboard', 'ok');
}

/** A small neck drawn into any canvas. */
function drawMiniNeck(g, x, y, w, h, o) {
  o = o || {}; const marks = neckMarks(), on = nkActive(); NK.fade = clamp((NK.fade || 0) + (on ? .08 : -.05), 0, 1); if (NK.fade <= 0.01) return;
  const maxF = clamp(Math.max(12, ...marks.map(m => m.f + 1)), 12, NECK_FRETS), left = !!CFG.left, ns = S.tuning.length, pad = h * .12, gx = x + w * .05, gw = w * .9, top = y + pad, sh = (h - pad * 2) / (ns - 1);
  const px = n => { const t = (1 - Math.pow(2, -n / 12)) / (1 - Math.pow(2, -maxF / 12)); return gx + gw * (left ? 1 - t : t); };
  const rr = Math.min(sh * .46, w / maxF * .3), C = o.C || vcol();
  g.save(); g.globalAlpha = NK.fade * .96; g.fillStyle = 'rgba(5,11,12,.72)'; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, h * .18) : g.rect(x, y, w, h); g.fill(); g.strokeStyle = 'rgba(160,210,210,.22)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = 'rgba(200,230,230,.2)'; for (let n = 0; n <= maxF; n++) { g.lineWidth = n === 0 ? 3 : 1; g.beginPath(); g.moveTo(px(n), top - sh * .25); g.lineTo(px(n), top + sh * (ns - 1) + sh * .25); g.stroke(); }
  g.fillStyle = 'rgba(200,230,230,.28)'; [3, 5, 7, 9, 12, 15, 17, 19, 21].forEach(n => { if (n <= maxF) { g.beginPath(); g.arc((px(n) + px(n - 1)) / 2, y + h - pad * .45, rr * .22, 0, 6.3); g.fill(); } });
  for (let st = 0; st < ns; st++) { const yy = top + (ns - 1 - st) * sh; g.strokeStyle = 'rgba(225,245,245,.5)'; g.lineWidth = .8 + (ns - 1 - st) * .0 + (st < 2 ? 1.8 : st < 4 ? 1.1 : .6); g.beginPath(); g.moveTo(gx, yy); g.lineTo(gx + gw, yy); g.stroke(); }
  const KC = { hit: C.b, ghost: C.a, voice: '#ff5fc8', pin: '#ffd23f' };
  marks.sort((p, q) => (p.k === 'ghost') - (q.k === 'ghost')).forEach(m => {
    if (m.st >= ns || m.f > maxF) return; const cx = m.f === 0 ? px(0) + (left ? 1 : -1) * rr * 1.3 : (px(m.f) + px(m.f - 1)) / 2, cy = top + (ns - 1 - m.st) * sh, col = KC[m.k] || '#fff';
    g.globalAlpha = NK.fade * clamp(m.a, 0, 1);
    if (m.k === 'ghost') { g.setLineDash([rr * .5, rr * .4]); g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, rr * (1.1 + (1 - m.a) * .5), 0, 6.3); g.stroke(); g.setLineDash([]); g.fillStyle = col; g.globalAlpha *= .22; g.beginPath(); g.arc(cx, cy, rr, 0, 6.3); g.fill(); }
    else { g.fillStyle = col; g.shadowColor = col; g.shadowBlur = rr * 1.6; g.beginPath(); g.arc(cx, cy, rr * (m.k === 'hit' ? 1 + m.a * .25 : 1), 0, 6.3); g.fill(); g.shadowBlur = 0; }
  });
  g.globalAlpha = NK.fade * .8; g.fillStyle = 'rgba(235,250,250,.85)'; g.font = `700 ${Math.round(h * .17)}px ui-monospace,Menlo,monospace`; g.textAlign = 'left'; g.textBaseline = 'top';
  const lab = NK.pin ? NK.pin.sym : marks.some(m => m.k === 'voice') ? 'you' : ''; if (lab) g.fillText(lab, x + 8, y + 4);
  g.restore();
}
/** where the neck sits on a canvas: bottom centre, never wider than the stage */
function neckRect(W, H) { const u = Math.min(W, H * 2.2), w = Math.min(W * .94, u * .78), h = clamp(w * .15, 56, H * .3); return [(W - w) / 2, H - h - Math.max(10, H * .03), w, h]; }
