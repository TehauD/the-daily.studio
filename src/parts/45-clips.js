/* ============================================================
   Part 45 · Clips — edit the audio you recorded or dropped in
   A recorded lane (a “take”) holds one or more clips. A clip plays one region of a recording. It can be moved, trimmed, split,
   faded, duplicated and deleted, and none of that ever changes the recording itself: drag a trimmed edge back out and the audio is still there.
   The lane owns level, pan, mute, solo, re-amp and effects; its first clip is the “lead” that carries them and every other clip follows it.
   Clips that came from one split share the same samples in memory and the same blob in the song file.
   Everything here is also part of Undo / Redo (see snap() in part 01).
   ============================================================ */
const TKMIN = .05;                     // the shortest clip, in seconds
const TK_EDGE = 7;                     // grab zone at a clip's edges, in px
const TK_BIN = new Map();              // clips that were deleted, kept while Undo could still bring them back
const TKSEL = { id: null };

/* ---------- the model ---------- */
function tkIn(tk) { return Math.max(0, tk.inS || 0); }
function tkOut(tk) { return tk.outS == null ? tk.dur : Math.min(tk.dur, Math.max(tk.outS, tkIn(tk))); }
function tkLen(tk) { return Math.max(0, tkOut(tk) - tkIn(tk)); }
function tkEnd(tk) { return tk.startSec + tkLen(tk); }
function tkSrc(tk) { return tk.src || tk.id; }
/** the lane a clip belongs to: clips of one lane share a key (the id of the first clip it ever had) and the first of them in TAKES carries the lane's settings */
function tkKey(tk) { return tk.grp || tk.id; }
function tkLead(tk) { const k = tkKey(tk); return TAKES.find(t => tkKey(t) === k) || tk; }
function tkIsLead(tk) { return tkLead(tk) === tk; }
function tkLeads() { return TAKES.filter(tkIsLead); }
function tkClips(lead) { const k = tkKey(lead); return TAKES.filter(t => tkKey(t) === k).sort((a, b) => a.startSec - b.startSec); }
function tkEdited(tk) { return tkIn(tk) > 0 || tkOut(tk) < tk.dur - 1e-6 || !!tk.fadeIn || !!tk.fadeOut; }
/** [fade in, fade out] in seconds, never longer than the clip together */
function tkFades(tk) { const len = tkLen(tk); let fi = clamp(+tk.fadeIn || 0, 0, len), fo = clamp(+tk.fadeOut || 0, 0, len); if (fi + fo > len) { const k = len / (fi + fo); fi *= k; fo *= k; } return [fi, fo]; }
/** the part of the recording this clip plays (a view, not a copy) */
function tkData(tk, which) {
  const d = which === 'wet' ? tk.wet : tk.dry; if (!d) return null;
  const i0 = Math.min(d.length, Math.round(tkIn(tk) * tk.sr)), i1 = Math.min(d.length, Math.round(tkOut(tk) * tk.sr));
  return i0 === 0 && i1 === d.length ? d : d.subarray(i0, Math.max(i0, i1));
}
/** from when to when a lane's clips sit on the song's timeline */
function tkSpan(lead) { const cs = tkClips(lead); return { a: Math.min(...cs.map(c => c.startSec)), b: Math.max(...cs.map(tkEnd)) }; }
/** the whole lane as one mono signal (every clip in place, fades applied, no level, pan or effects). `which` is 'dry' or 'wet'; null when the lane has none */
function tkRender(lead, which) {
  const cs = tkClips(lead).filter(c => c[which]); if (!cs.length) return null; const sr = lead.sr, a = Math.min(...cs.map(c => c.startSec)), b = Math.max(...cs.map(tkEnd));
  const out = new Float32Array(Math.max(1, Math.ceil((b - a) * sr)));
  cs.forEach(c => {
    const d = tkData(c, which), n = d.length, off = Math.round((c.startSec - a) * sr), [fi, fo] = tkFades(c), nfi = Math.round(fi * sr), nfo = Math.round(fo * sr);
    for (let i = 0; i < n; i++) { const j = off + i; if (j < 0 || j >= out.length) continue; let g = 1; if (i < nfi) g = i / nfi; if (n - i <= nfo) g = Math.min(g, (n - i) / nfo); out[j] += d[i] * g; }
  });
  return { data: out, sr, startSec: a, dur: out.length / sr };
}
/** one clip alone (trim and fades applied), at its own start */
function tkRenderClip(tk, which) {
  const d = tkData(tk, which); if (!d) return null; const out = Float32Array.from(d), n = out.length, sr = tk.sr, [fi, fo] = tkFades(tk), nfi = Math.round(fi * sr), nfo = Math.round(fo * sr);
  for (let i = 0; i < n; i++) { let g = 1; if (i < nfi) g = i / nfi; if (n - i <= nfo) g = Math.min(g, (n - i) / nfo); out[i] *= g; }
  return { data: out, sr, startSec: tk.startSec, dur: n / sr };
}
const tkPps = () => TL.bw / spb() / slotDur();             // pixels per second on the timeline
const tkBeat = () => (16 / S.ts[1]) * slotDur();            // seconds per beat
const tkNowSec = () => playheadSlot() * slotDur();          // where the playhead is
function tkSel() { return TAKES.find(t => t.id === TKSEL.id) || null; }
function tkSelect(id) {
  if (TKSEL.id === id) return; TKSEL.id = id || null; TL.dirty = true; bus.emit('clipsel', TKSEL.id);
  if (id && !CFG.clipTip) { CFG.clipTip = 1; saveCfg(); toast('Drag a clip to move it · drag its edges to trim · ✂ Split cuts it at the playhead · hold Alt for no snapping'); }
}
/** the clip of a lane that an action should act on: the selected one, else the one under the playhead, else the last */
function tkPick(lead) {
  const cs = tkClips(lead), sel = cs.find(c => c.id === TKSEL.id); if (sel) return sel; const t = tkNowSec();
  return cs.find(c => t >= c.startSec && t < tkEnd(c)) || cs[cs.length - 1] || null;
}
/** a place for the name of the n-th clip, “Take 2” stays “Take 2” (the lane owns the name) */
function tkNew(from, over) {
  const n = Object.assign({}, from, { id: uid(), grp: tkKey(from), src: tkSrc(from), _g: null, _pn: null, _fx: null, mute: false, solo: false }, over);
  return n;
}
/** make sure the arrangement is long enough for every clip to play */
function tkFit() {
  const last = S.sections[S.sections.length - 1]; if (!last) return; let end = 0; TAKES.forEach(t => { end = Math.max(end, tkEnd(t)); });
  let guard = 0; while (songSlots() * slotDur() < end + .01 && guard++ < 600) last.bars.push(newBar('')); T.bars = null;
}
/** re-schedule the clips while the song is playing so an edit is heard straight away */
function tkResched() {
  if (!T.playing || !E.ctx) return; const at = E.ctx.currentTime + .04;
  try { stopTakes(); scheduleTakes(at, Math.max(0, slotAtTime(at) * slotDur())); } catch (e) { console.warn(e); }
}
/** call after an edit is done: undo step, save, redraw */
function tkDone(before, msg) {
  tkFit(); tkResched(); try { TAKES.forEach(t => takeLive(t)); } catch (e) { }
  if (before != null) histPush(before); else commit(false);
  bus.emit('takes'); TL.dirty = true; if (msg) toast(msg, 'ok');
}

/* ---------- editing ---------- */
function tkSplit(tk, sec) {
  tk = tk || tkSel(); if (!tk) { toast('Click a clip first, then split it at the playhead.', 'warn'); return null; }
  sec = sec == null ? tkNowSec() : sec; const rel = sec - tk.startSec, len = tkLen(tk);
  if (rel < TKMIN || rel > len - TKMIN) { toast('Put the playhead inside the clip to split it. Click the ruler to place it.', 'warn'); return null; }
  const before = snap(), cut = tkIn(tk) + rel, right = tkNew(tk, { startSec: sec, inS: cut, outS: tk.outS == null ? null : tk.outS, fadeIn: 0, fadeOut: tk.fadeOut || 0 });
  tk.outS = cut; tk.fadeOut = 0; TAKES.splice(TAKES.indexOf(tk) + 1, 0, right); tkSelect(right.id); tkDone(before, 'Split at ' + tkFmt(sec)); return right;
}
function tkDup(tk) {
  tk = tk || tkSel(); if (!tk) { toast('Click a clip first, then duplicate it.', 'warn'); return null; }
  const before = snap(), n = tkNew(tk, { startSec: tkEnd(tk) }); TAKES.splice(TAKES.indexOf(tk) + 1, 0, n); tkSelect(n.id); tkDone(before, 'Duplicated. It sits right after the original.'); return n;
}
/** remove a clip (the recording is kept until the song is saved, so Undo can bring it back) */
function tkBinPut(tk) { if (tk._fx) { try { tk._fx.dispose(); } catch (e) { } tk._fx = null; } TK_BIN.set(tk.id, tk); while (TK_BIN.size > 24) TK_BIN.delete(TK_BIN.keys().next().value); }
function tkDelete(tk) {
  tk = tk || tkSel(); if (!tk) return false; const before = snap(), lead = tkLead(tk), key = tkKey(tk), i = TAKES.indexOf(tk); if (i < 0) return false;
  TAKES.splice(i, 1); tkBinPut(tk); if (TKSEL.id === tk.id) tkSelect(null);
  const nl = lead === tk ? TAKES.find(t => tkKey(t) === key) : null;      // the lane's settings pass to the next clip
  if (nl) ['kind', 'name', 'g', 'pan', 'mute', 'solo', 'mode', 'fx', 'preset', 'bpm'].forEach(k => { nl[k] = k === 'fx' && tk.fx ? Object.assign({}, tk.fx) : tk[k]; });
  tkDone(before, TAKES.some(t => tkKey(t) === key) ? 'Clip deleted' : '“' + tk.name + '” deleted'); return true;
}
/** remove a whole lane */
function tkDeleteLane(lead) {
  const before = snap(), cs = tkClips(lead); cs.forEach(c => { const i = TAKES.indexOf(c); if (i >= 0) TAKES.splice(i, 1); tkBinPut(c); }); if (cs.some(c => c.id === TKSEL.id)) tkSelect(null);
  tkDone(before, '“' + lead.name + '” deleted'); return true;
}
function tkReset(tk) {
  tk = tk || tkSel(); if (!tk || !tkEdited(tk)) return false; const before = snap(), s0 = tk.startSec - 0, i = tkIn(tk); tk.startSec = Math.max(0, s0 - i); tk.inS = 0; tk.outS = null; tk.fadeIn = 0; tk.fadeOut = 0; tkDone(before, 'Trim and fades cleared'); return true;
}
function tkSetFade(tk, which, v, quiet) {
  const len = tkLen(tk), other = which === 'in' ? (tk.fadeOut || 0) : (tk.fadeIn || 0); v = Math.round(clamp(v, 0, Math.max(0, len - Math.min(other, len))) * 1000) / 1000; if (which === 'in') tk.fadeIn = v; else tk.fadeOut = v;
  TL.dirty = true; if (!quiet) tkResched();
}
/** move a clip by whole beats (the keyboard and the clip menu use this; the mouse drags) */
function tkNudge(tk, beats) {
  tk = tk || tkSel(); if (!tk) return false; const before = snap(), to = Math.max(0, tk.startSec + beats * tkBeat()); if (Math.abs(to - tk.startSec) < 1e-6) return false;
  tk.startSec = to; tkDone(before); return true;
}
/** a clip's own level in dB (0 = as recorded), on top of the lane's level */
function tkSetGain(tk, db, quiet) { tk.cg = db === 0 ? 1 : Math.pow(10, db / 20); try { if (tk._cg) tc(tk._cg.gain, tk.cg, .015); } catch (e) { } const v = document.getElementById('cmLevelV'); if (v) v.textContent = db.toFixed(1) + ' dB'; TL.dirty = true; if (!quiet) bus.emit('takes'); }
const tkFmt = sec => { const sp = spb(), slot = sec / slotDur(), bar = Math.floor(slot / sp) + 1, beat = Math.floor((slot % sp) / (16 / S.ts[1])) + 1; return 'bar ' + bar + ' · beat ' + beat; };

/* ---------- save a lane or a clip as audio ---------- */
function tkDownload(lead) {
  const n = lead.name.replace(/\W+/g, '_'), dry = tkRender(lead, 'dry'), wet = tkRender(lead, 'wet');
  if (lead.kind === 'vox') { const r = dry || wet; return r && download(n + '.wav', encodeWav([r.data], r.sr, 24)); }
  if (dry) download(n + '_dry_DI.wav', encodeWav([dry.data], dry.sr, 24)); if (wet) setTimeout(() => download(n + '_wet.wav', encodeWav([wet.data], wet.sr, 24)), 300);
}
function tkDownloadClip(tk) {
  const n = tk.name.replace(/\W+/g, '_') + '_clip', d = tkRenderClip(tk, 'dry'), w = tkRenderClip(tk, 'wet'); if (tkLead(tk).kind === 'vox') { const r = d || w; return r && download(n + '.wav', encodeWav([r.data], r.sr, 24)); }
  if (d) download(n + '_dry_DI.wav', encodeWav([d.data], d.sr, 24)); if (w) setTimeout(() => download(n + '_wet.wav', encodeWav([w.data], w.sr, 24)), 300);
}

/* ---------- Undo / Redo ---------- */
function tkHistGet() {
  return TAKES.map(t => ({ id: t.id, grp: t.grp || null, name: t.name, kind: t.kind, startSec: t.startSec, inS: t.inS || 0, outS: t.outS == null ? null : t.outS, fadeIn: t.fadeIn || 0, fadeOut: t.fadeOut || 0, cg: t.cg == null ? 1 : t.cg, g: t.g == null ? 1 : t.g, pan: t.pan || 0, mute: !!t.mute, solo: !!t.solo, mode: t.mode, fx: t.fx ? JSON.parse(JSON.stringify(t.fx)) : null }));
}
function tkHistSet(list) {
  if (!Array.isArray(list)) return; const have = new Map(TAKES.map(t => [t.id, t])), next = [], back = new Set();
  list.forEach(s => {
    let t = have.get(s.id); if (!t) { t = TK_BIN.get(s.id); if (t) back.add(t.id); } if (!t) return;
    t.grp = s.grp || null; t.name = s.name; t.kind = s.kind; t.startSec = s.startSec; t.inS = s.inS; t.outS = s.outS; t.fadeIn = s.fadeIn; t.fadeOut = s.fadeOut; t.cg = s.cg == null ? 1 : s.cg; t.g = s.g; t.pan = s.pan; t.mute = s.mute; t.solo = s.solo; t.mode = s.mode; if (s.fx) t.fx = s.fx; else delete t.fx; next.push(t);
  });
  const keep = new Set(next.map(t => t.id)); TAKES.forEach(t => { if (!keep.has(t.id)) tkBinPut(t); }); next.forEach(t => TK_BIN.delete(t.id));
  TAKES.length = 0; next.forEach(t => TAKES.push(t)); next.forEach(t => { if (back.has(t.id)) t._saved = false; });   // a clip that came back is written to the song file again
  if (TKSEL.id && !keep.has(TKSEL.id)) TKSEL.id = null;
  try { tkResched(); TAKES.forEach(t => takeLive(t)); } catch (e) { } T.bars = null; bus.emit('takes'); bus.emit('clipsel', TKSEL.id); TL.dirty = true;
}
const jclone = o => o ? JSON.parse(JSON.stringify(o)) : null;
function stmHistGet() { return { v: STM.vol == null ? 1 : STM.vol, mu: !!STM.mute, fx: jclone(STM.fx), mix: STM.mix.map(x => ({ g: x.g == null ? 1 : x.g, m: !!x.m, s: !!x.s, p: x.p || 0, fx: jclone(x.fx) })) }; }
function stmHistSet(o) {
  if (!o) return; STM.vol = o.v; STM.mute = !!o.mu; if (o.fx) STM.fx = o.fx; else delete STM.fx;
  (o.mix || []).forEach((x, i) => { const m = STM.mix[i]; if (!m) return; m.g = x.g; m.m = x.m; m.s = x.s; m.p = x.p; if (x.fx) m.fx = x.fx; else delete m.fx; });
  try { spBus(); spGains(); spFx(); } catch (e) { } try { if (typeof renderStemStrips === 'function') renderStemStrips(); } catch (e) { } TL.dirty = true; bus.emit('stemmix');
}
/** a new project or a new backing track starts with an even mix */
function stmReset() { STM.vol = 1; STM.mute = false; delete STM.fx; STM.mix.forEach(m => { m.g = 1; m.m = false; m.s = false; m.p = 0; delete m.fx; }); try { spBus(); spGains(); spFx(); } catch (e) { } }
/** a stem or backing-track fader / mute / solo changed: remember it with the song */
function stmDirty() { fxPersist(); }

/* ---------- drawing a lane's clips ---------- */
function tkDraw(g, l, k) {
  const { y, hh, mid, ox, vw, sw, sans } = k, pps = sw / slotDur(), amp = hh / 2 - 4, lead = l.take, mute = !takeAudible(lead), C = TL.col;
  tkClips(lead).forEach(tk => {
    const pk = tk.peaks, len = tkLen(tk), x0 = tk.startSec * pps, wpx = Math.max(2, len * pps); if (!pk || x0 + wpx < ox - 2 || x0 > ox + vw + 2) return;
    const on = TKSEL.id === tk.id, xa = Math.max(x0, ox), xb = Math.min(x0 + wpx, ox + vw), base = tkIn(tk) * tk.sr / pk.per, span = len * tk.sr / pk.per, [fi, fo] = tkFades(tk);
    g.fillStyle = l.c; g.globalAlpha = mute ? .05 : (on ? .2 : .11); g.fillRect(x0, y + 3, wpx, hh - 6);
    g.globalAlpha = mute ? .2 : .85;
    for (let x = Math.floor(xa); x < xb; x++) {
      const t = (x - x0) / wpx, i0 = Math.floor(base + t * span), i1 = Math.max(i0 + 1, Math.floor(base + (t + 1 / wpx) * span)); let mn = 1, mx = -1;
      for (let q = i0; q < Math.min(i1, pk.mn.length); q++) { if (pk.mn[q] < mn) mn = pk.mn[q]; if (pk.mx[q] > mx) mx = pk.mx[q]; }
      if (mx < mn) continue; const c = t * len; let f = 1; if (fi > 0 && c < fi) f = c / fi; if (fo > 0 && len - c < fo) f = Math.min(f, (len - c) / fo);
      g.fillRect(x, mid - mx * f * amp * 2.2, 1, Math.max(1, (mx - mn) * f * amp * 2.2));
    }
    g.globalAlpha = 1;
    if (fi > 0) { g.fillStyle = C.bg; g.globalAlpha = .6; g.beginPath(); g.moveTo(x0, y + 3); g.lineTo(x0 + fi * pps, y + 3); g.lineTo(x0, y + hh - 4); g.closePath(); g.fill(); g.globalAlpha = 1; g.strokeStyle = l.c; g.beginPath(); g.moveTo(x0, y + hh - 4); g.lineTo(x0 + fi * pps, y + 3); g.stroke(); }
    if (fo > 0) { const xe = x0 + wpx; g.fillStyle = C.bg; g.globalAlpha = .6; g.beginPath(); g.moveTo(xe, y + 3); g.lineTo(xe - fo * pps, y + 3); g.lineTo(xe, y + hh - 4); g.closePath(); g.fill(); g.globalAlpha = 1; g.strokeStyle = l.c; g.beginPath(); g.moveTo(xe, y + hh - 4); g.lineTo(xe - fo * pps, y + 3); g.stroke(); }
    g.strokeStyle = on ? C.accent2 : l.c; g.lineWidth = on ? 2 : 1; g.strokeRect(x0 + .5, y + 3.5, wpx, hh - 7); g.lineWidth = 1;
    if (hh >= 40 && wpx > 60) { g.fillStyle = l.c; g.font = sans; g.fillText(tk.name, Math.max(x0, ox) + 6, y + 14); }
    if (on) {
      g.fillStyle = C.accent2; g.fillRect(x0, y + 4, 3, hh - 8); g.fillRect(x0 + wpx - 3, y + 4, 3, hh - 8);
      if (hh >= 30 && wpx > 28) { [x0 + fi * pps, x0 + wpx - fo * pps].forEach(hx => { g.fillRect(hx - 4, y + 4, 8, 8); }); }
    }
    const dr = TL.clip; if (dr && dr.tk === tk && dr.label) {
      g.font = '700 11px ui-monospace,Menlo,Consolas,monospace'; const w = g.measureText(dr.label).width + 12, bx = clamp(x0, ox + 2, ox + vw - w - 2), by = Math.max(y + 2, y + hh - 22);
      g.fillStyle = C.bg2; g.globalAlpha = .92; g.fillRect(bx, by, w, 18); g.globalAlpha = 1; g.strokeStyle = C.accent2; g.strokeRect(bx + .5, by + .5, w - 1, 17); g.fillStyle = C.text; g.fillText(dr.label, bx + 6, by + 13);
    }
  });
  if (typeof tkrDrawLane === 'function') tkrDrawLane(g, l, k);
}

/* ---------- pointer: select, move, trim, fade ---------- */
function tkHit(lane, x, yrel, hh) {
  const pps = tkPps(); let best = null;
  tkClips(lane.take).forEach(tk => {
    const x0 = tk.startSec * pps, w = Math.max(2, tkLen(tk) * pps), x1 = x0 + w; if (x < x0 - 3 || x > x1 + 3) return;
    const edge = Math.min(TK_EDGE, w / 3), [fi, fo] = tkFades(tk); let zone = 'body';
    if (TKSEL.id === tk.id && hh >= 30 && w > 28 && yrel < 16) { if (Math.abs(x - (x0 + fi * pps)) <= 7 && x < x1 - edge) zone = 'fi'; else if (Math.abs(x - (x1 - fo * pps)) <= 7 && x > x0 + edge) zone = 'fo'; }
    if (zone === 'body') { if (x - x0 <= edge) zone = 'in'; else if (x1 - x <= edge) zone = 'out'; }
    best = { tk, zone };
  });
  return best;
}
const TK_CUR = { in: 'w-resize', out: 'e-resize', fi: 'pointer', fo: 'pointer', body: 'grab' };
/** hover feedback on the timeline canvas (no button down) */
function tkHover(e) {
  if (!UI.tlc || TL.clip) return; const { x, y } = tlPoint(e), lo = laneAt(y); let c = '';
  if (lo && lo.l.type === 'take' && y > TL.rh + TL.sh) { const hit = tkHit(lo.l, x, y - lo.y, lo.h); if (hit) c = TK_CUR[hit.zone] || ''; }
  if (UI.tlc._cur !== c) { UI.tlc._cur = c; UI.tlc.style.cursor = c; }
}
/** pointer went down over a clip. Returns true when the clip took the gesture. */
function tkDown(e, lo, x, y) {
  const hit = tkHit(lo.l, x, y - lo.y, lo.h); if (!hit) return false; const tk = hit.tk; tkSelect(tk.id);
  TL.clip = { tk, zone: hit.zone, cx: e.clientX, start0: tk.startSec, in0: tkIn(tk), out0: tkOut(tk), fi0: tk.fadeIn || 0, fo0: tk.fadeOut || 0, before: snap(), moved: false, alt: e.altKey, label: '' };
  try { UI.tlc.setPointerCapture(e.pointerId); } catch (er) { } UI.tlc.style.cursor = hit.zone === 'body' ? 'grabbing' : TK_CUR[hit.zone]; TL.dirty = true; return true;
}
/** where a time would land when snapped: the nearest beat, or the edge of another clip when one is close */
function tkSnapAbs(t, skip, px) {
  const thr = (px || 8) / tkPps(), beat = tkBeat(), nb = Math.round(t / beat) * beat; let best = t, bd = Math.abs(nb - t) <= thr ? Math.abs(nb - t) : Infinity; if (bd < Infinity) best = nb;
  TAKES.forEach(c => { if (c === skip) return; [c.startSec, tkEnd(c)].forEach(ed => { const d = Math.abs(ed - t); if (d <= thr && d < bd) { bd = d; best = ed; } }); });
  return best;
}
function tkMove(e) {
  const c = TL.clip; if (!c) return false; const tk = c.tk, pps = tkPps(), dx = e.clientX - c.cx; if (!c.moved && Math.abs(dx) < 3) return true; c.moved = true; const dt = dx / pps, free = e.altKey, len0 = c.out0 - c.in0;
  if (c.zone === 'body') {
    let d = free ? dt : Math.round(dt / tkBeat()) * tkBeat();               // moves in whole beats, so a take keeps its feel
    if (!free) { const thr = 8 / pps; let bd = Infinity; TAKES.forEach(o => { if (o === tk) return; [o.startSec, tkEnd(o)].forEach(ed => { [ed - c.start0, ed - (c.start0 + len0)].forEach(cand => { const dd = Math.abs(cand - dt); if (dd <= thr && dd < bd) { bd = dd; d = cand; } }); }); }); }
    tk.startSec = Math.max(0, c.start0 + d); c.label = tkFmt(tk.startSec);
  } else if (c.zone === 'in') {
    let ns = c.start0 + dt; if (!free) ns = tkSnapAbs(ns, tk); let nin = clamp(c.in0 + (ns - c.start0), Math.max(0, c.in0 - c.start0), c.out0 - TKMIN); tk.inS = nin; tk.startSec = c.start0 + (nin - c.in0); c.label = tkFmt(tk.startSec) + ' · ' + (c.out0 - nin).toFixed(2) + ' s';
  } else if (c.zone === 'out') {
    const end0 = c.start0 + len0; let ne = end0 + dt; if (!free) ne = tkSnapAbs(ne, tk); const nout = clamp(c.out0 + (ne - end0), c.in0 + TKMIN, tk.dur); tk.outS = nout >= tk.dur - 1e-4 ? null : nout; c.label = (nout - c.in0).toFixed(2) + ' s';
  } else if (c.zone === 'fi') { tkSetFade(tk, 'in', c.fi0 + dt, true); c.label = 'fade in ' + (tk.fadeIn || 0).toFixed(2) + ' s'; }
  else if (c.zone === 'fo') { tkSetFade(tk, 'out', c.fo0 - dt, true); c.label = 'fade out ' + (tk.fadeOut || 0).toFixed(2) + ' s'; }
  TL.dirty = true; return true;
}
function tkUp() {
  const c = TL.clip; if (!c) return false; TL.clip = null; if (UI.tlc) { UI.tlc.style.cursor = UI.tlc._cur || ''; }
  if (c.moved) tkDone(c.before); else TL.dirty = true; return true;
}
function tkContext(e) {
  if (!UI.tlc) return; const { x, y } = tlPoint(e), lo = laneAt(y); if (!lo || lo.l.type !== 'take' || y <= TL.rh + TL.sh) return;
  const hit = tkHit(lo.l, x, y - lo.y, lo.h); if (!hit) return; e.preventDefault(); tkSelect(hit.tk.id);
  const a = h('span', { style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '1px', height: '1px' } }); document.body.append(a); tkMenu(a, hit.tk); setTimeout(() => a.remove(), 0);
}

/* ---------- the clip menu and bar ---------- */
function tkMenu(anchor, tk) {
  const lead = tkLead(tk), len = tkLen(tk), [fi, fo] = tkFades(tk), mx = Math.max(.05, Math.min(len, 8));
  const box = h('div', { class: 'clipmenu', style: { minWidth: '250px' } }, h('h5', {}, lead.name + (tkClips(lead).length > 1 ? ' · clip' : '')));
  const row = (...kids) => h('div', { class: 'row', style: { gap: '6px', margin: '4px 0', flexWrap: 'wrap' } }, kids);
  const fade = (lab, v, which) => h('div', { class: 'lrow' }, h('span', { style: { width: '62px' } }, lab), h('input', { type: 'range', min: 0, max: mx, step: .01, value: Math.min(v, mx), 'aria-label': lab, style: { flex: 1 }, oninput: e => { histBegin(); tkSetFade(tk, which, +e.target.value, true); }, onchange: () => { tkResched(); if (!histEnd()) bus.emit('takes'); } }));
  box.append(row(h('button', { class: 'btn sm', id: 'cmSplit', title: 'Cut the clip in two at the playhead (Ctrl+E)', onclick: () => { closePop(); tkSplit(tk); } }, '✂ Split at playhead'), h('button', { class: 'btn sm', id: 'cmDup', title: 'Copy the clip so it starts where this one ends (Ctrl+D)', onclick: () => { closePop(); tkDup(tk); } }, '⧉ Duplicate')),
    fade('Fade in', fi, 'in'), fade('Fade out', fo, 'out'),
    h('div', { class: 'lrow' }, h('span', { style: { width: '62px' } }, 'Clip level'), h('input', { type: 'range', id: 'cmLevel', min: -24, max: 12, step: .5, value: Math.round(20 * Math.log10(Math.max(.0631, tk.cg == null ? 1 : tk.cg)) * 2) / 2, 'aria-label': 'Clip level in dB', title: 'Louder or quieter for this clip only (double-click to reset); the lane’s own level still applies', style: { flex: 1 }, ondblclick: e => { histBegin(); tkSetGain(tk, 0, true); e.target.value = 0; if (!histEnd()) bus.emit('takes'); }, oninput: e => { histBegin(); tkSetGain(tk, +e.target.value, true); }, onchange: () => { if (!histEnd()) bus.emit('takes'); } }), h('span', { class: 'tiny muted', id: 'cmLevelV', style: { width: '44px', textAlign: 'right' } }, ((tk.cg == null ? 1 : tk.cg) === 1 ? '0' : (20 * Math.log10(tk.cg)).toFixed(1)) + ' dB')),
    row(h('span', { class: 'tiny muted', style: { width: '62px' } }, 'Move'), ...[['◀◀', -S.ts[0], 'A bar earlier'], ['◀', -1, 'A beat earlier'], ['▶', 1, 'A beat later'], ['▶▶', S.ts[0], 'A bar later']].map(([t, d, ti]) => h('button', { class: 'btn sm', title: ti, 'aria-label': ti, onclick: () => tkNudge(tk, d) }, t))),
    row(h('button', { class: 'btn sm', id: 'cmReset', disabled: !tkEdited(tk), title: 'Put the whole recording back: no trim, no fades', onclick: () => { closePop(); tkReset(tk); } }, '↺ Reset trim'), h('button', { class: 'btn sm', onclick: () => { closePop(); tkDownloadClip(tk); } }, '⤓ Save clip (WAV)'), h('button', { class: 'btn sm', id: 'cmShare', title: 'A small M4A of this clip to send or post, or a one-file share page', onclick: () => { closePop(); kitTake(tk, true); } }, '↗ Share clip…')),
    row(h('button', { class: 'btn sm bad', id: 'cmDel', title: 'Delete (Del). Undo brings it back.', onclick: () => { closePop(); tkDelete(tk); } }, '✕ Delete clip')),
    h('div', { class: 'tiny muted' }, 'Drag a clip to move it · drag its edges to trim · drag the top corners to fade · hold Alt for no snapping.'));
  popover(anchor, box, { style: { maxWidth: '330px' } });
}
function clipBarMake() {
  const b = (id, label, title, fn) => h('button', { class: 'btn sm', id, title, onclick: fn }, label);
  UI.clipbar = h('span', { class: 'clipbar', id: 'clipBar', hidden: true, role: 'group', 'aria-label': 'Selected clip' }, h('b', { class: 'small', id: 'clipName' }, 'Clip'),
    h('span', { class: 'cb-grp', id: 'clipAct' }, b('clipSplit', '✂ Split', 'Split the selected clip at the playhead (Ctrl+E)', () => tkSplit()), b('clipDup', '⧉ Duplicate', 'Duplicate the selected clip (Ctrl+D)', () => tkDup()),
      b('clipDel', '✕ Delete', 'Delete the selected clip (Del). Undo brings it back.', () => tkDelete()), b('clipMore', '⋯', 'More: fades, reset trim, save the clip', e => { const t = tkSel(); if (t) tkMenu(e.currentTarget, t); })),
    h('span', { class: 'cb-grp' }, b('rngIn', '⟦ In', 'Mark the start of a stretch at the playhead (or Shift-drag across a take)', () => tkrMark('in')), b('rngOut', 'Out ⟧', 'Mark the end of the stretch at the playhead', () => tkrMark('out'))),
    h('span', { class: 'cb-grp', id: 'rngAct', hidden: true }, b('rngCut', '⌫ Cut out', 'Take the stretch out and close the gap (Del). The band and chords do not move.', () => tkrApply(true)), b('rngSil', '◻ Silence', 'Take the stretch out and leave a gap', () => tkrApply(false)),
      b('rngPunch', '● Punch in', 'Play from a bar before the stretch and record only inside it, replacing what was there', () => tkrPunch()),
      h('button', { class: 'btn sm on', id: 'rngAll', 'aria-pressed': 'true', title: 'On: every take lane is edited together, so a guitar and a vocal recorded as one pass stay in step', onclick: e => { TKR.all = !TKR.all; e.currentTarget.classList.toggle('on', TKR.all); e.currentTarget.setAttribute('aria-pressed', String(TKR.all)); TL.dirty = true; } }, '⛓ All lanes'),
      b('rngClr', '✕', 'Clear the marked stretch (Esc)', () => tkrClear())));
  return UI.clipbar;
}
function clipBarSync() {
  const bar = UI.clipbar; if (!bar) return; const t = tkSel(), r = TKR.on && !TKR.drag; bar.hidden = !t && !TKR.on; if (bar.hidden) return;
  $('#clipAct', bar).hidden = !t; $('#rngAct', bar).hidden = !r; const rl = TKR.on ? ' · ' + (TKR.b - TKR.a).toFixed(1) + ' s marked' : '';
  if (!t) { $('#clipName', bar).textContent = (TKR.lead ? TKR.lead.name : 'Range') + rl; return; }
  const n = tkClips(tkLead(t)).length; $('#clipName', bar).textContent = tkLead(t).name + (n > 1 ? ' · clip ' + (tkClips(tkLead(t)).indexOf(t) + 1) + '/' + n : '') + rl;
}
bus.on('clipsel', clipBarSync); bus.on('takes', clipBarSync);
