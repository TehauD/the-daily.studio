/* ============================================================
   Part 51 · Ranges — cut a stretch out of a recording, silence it, or punch in over it
   Shift-drag across a take lane (or press “Mark in” / “Mark out” on the clip bar, which works with a finger too) to mark a stretch of time.
   Then:  Cut out  takes it out of the recording and closes the gap · Silence  takes it out and leaves the gap · Punch in  plays the song
   from a bar before it, records only inside it, and drops the new audio into the same lane where the old stretch was.
   By default every take lane is edited together, so a guitar and a vocal that were recorded as one pass stay in step; switch “All lanes” off to edit one.
   The band and the chords do not move. Everything is one Undo step.
   ============================================================ */
const TKR = { on: false, lead: null, a: 0, b: 0, drag: null, all: true };
const PUNCH = { on: false, leadId: null, kind: 'gtr', a: 0, b: 0, startSlot: 0, endSlot: 0, before: null };
const TKR_FADE = .008;                 // a few milliseconds of fade at every new edge, so a cut never clicks

const tkByKey = key => TAKES.filter(t => tkKey(t) === key).sort((a, b) => a.startSec - b.startSec);
/** remove one clip from its lane; if it carried the lane's settings they pass to the next clip. No history, no redraw. */
function tkRemoveRaw(tk) {
  const lead = tkLead(tk), key = tkKey(tk), i = TAKES.indexOf(tk); if (i < 0) return false;
  TAKES.splice(i, 1); tkBinPut(tk);
  const nl = lead === tk ? TAKES.find(t => tkKey(t) === key) : null;
  if (nl) ['kind', 'name', 'g', 'pan', 'mute', 'solo', 'mode', 'fx', 'preset', 'bpm'].forEach(k => { nl[k] = k === 'fx' && tk.fx ? Object.assign({}, tk.fx) : tk[k]; });
  return true;
}
const tkrSnap = (t, alt) => alt ? Math.max(0, t) : Math.max(0, tkSnapAbs(t, null, 10));
function tkrSet(lead, a, b) {
  if (b < a) [a, b] = [b, a]; if (b - a < TKMIN) { tkrClear(); return false; }
  TKR.on = true; TKR.lead = lead; TKR.a = a; TKR.b = b; TL.dirty = true; bus.emit('clipsel', TKSEL.id); return true;
}
function tkrClear() { if (!TKR.on && !TKR.drag) return; TKR.on = false; TKR.drag = null; TL.dirty = true; bus.emit('clipsel', TKSEL.id); }
/** the lanes an edit applies to (each as its key, so a lane that vanishes midway is not a problem) */
function tkrKeys() { return TKR.all ? [...new Set(tkLeads().map(tkKey))] : [tkKey(TKR.lead)]; }

/** take [a,b] seconds out of one lane. close: everything after it moves left by b−a. Returns true if anything changed. */
function tkrLane(key, a, b, close) {
  const len = b - a; let changed = false, left = null, right = null;
  tkByKey(key).forEach(c => {
    const s = c.startSec, e = tkEnd(c);
    if (e <= a + 1e-6) return;
    if (s >= b - 1e-6) { if (close) { c.startSec = Math.max(0, s - len); changed = true; } return; }
    changed = true;
    if (s >= a - 1e-6 && e <= b + 1e-6) { tkRemoveRaw(c); return; }
    if (s < a - 1e-6 && e > b + 1e-6) {
      const r = tkNew(c, { startSec: close ? a : b, inS: tkIn(c) + (b - s), outS: c.outS == null ? null : c.outS, fadeIn: TKR_FADE, fadeOut: c.fadeOut || 0 });
      c.outS = tkIn(c) + (a - s); c.fadeOut = TKR_FADE; TAKES.splice(TAKES.indexOf(c) + 1, 0, r); return;
    }
    if (s < a - 1e-6) { c.outS = tkIn(c) + (a - s); c.fadeOut = TKR_FADE; return; }
    c.inS = tkIn(c) + (b - s); c.startSec = close ? a : b; c.fadeIn = TKR_FADE;
  });
  tkByKey(key).forEach(c => { if (tkLen(c) < TKMIN) { tkRemoveRaw(c); changed = true; } });
  return changed;
}
/** Cut out (close = true) or Silence (close = false) the marked range, in every lane or the chosen one */
function tkrApply(close) {
  if (!TKR.on) { toast('Mark a stretch first: Shift-drag across a take, or use Mark in / Mark out.', 'warn'); return false; }
  const before = snap(), a = TKR.a, b = TKR.b; let any = false; tkrKeys().forEach(k => { if (tkrLane(k, a, b, close)) any = true; });
  if (!any) { toast('There is no recording in that stretch.', 'warn'); return false; }
  if (TKSEL.id && !TAKES.some(t => t.id === TKSEL.id)) TKSEL.id = null; tkrClear();
  tkDone(before, (close ? 'Cut out ' : 'Silenced ') + (b - a).toFixed(1) + ' s' + (close ? ' · the gap is closed' : '')); return true;
}
/** Mark in / Mark out at the playhead (the lane is the selected clip's, else the first take lane) */
function tkrMark(which) {
  const tk = tkSel(), lead = TKR.on && TKR.lead ? TKR.lead : (tk ? tkLead(tk) : tkLeads()[0]); if (!lead) { toast('Record or drop in a take first.', 'warn'); return false; }
  const t = Math.max(0, Math.round(tkNowSec() / tkBeat()) * tkBeat()); let a = TKR.on ? TKR.a : t, b = TKR.on ? TKR.b : t + tkBeat() * S.ts[0];
  if (which === 'in') { a = t; if (b <= a + TKMIN) b = a + tkBeat() * S.ts[0]; } else { b = t; if (a >= b - TKMIN) a = Math.max(0, b - tkBeat() * S.ts[0]); }
  return tkrSet(lead, a, b);
}

/* ---------- Shift-drag on a lane ---------- */
function tkrDown(e, lo, x) {
  if (!e.shiftKey || !lo || lo.l.type !== 'take') return false; const t = tkrSnap(x / tkPps(), e.altKey);
  TKR.drag = { lead: lo.l.take, t0: t, alt: e.altKey }; TKR.on = true; TKR.lead = lo.l.take; TKR.a = t; TKR.b = t; try { UI.tlc.setPointerCapture(e.pointerId); } catch (er) { } TL.dirty = true; return true;
}
function tkrMove(e) {
  const d = TKR.drag; if (!d) return false; const { x } = tlPoint(e), t = tkrSnap(x / tkPps(), e.altKey || d.alt); TKR.a = Math.min(d.t0, t); TKR.b = Math.max(d.t0, t); TL.dirty = true; return true;
}
function tkrUp() {
  const d = TKR.drag; if (!d) return false; TKR.drag = null; if (TKR.b - TKR.a < TKMIN) { TKR.on = false; TL.dirty = true; } bus.emit('clipsel', TKSEL.id); return true;
}
/** the range, drawn over a lane */
function tkrDrawLane(g, l, k) {
  if (!TKR.on) return; const lead = l.take; if (!TKR.all && tkKey(lead) !== tkKey(TKR.lead)) return; const { y, hh, sw } = k, pps = sw / slotDur(), x0 = TKR.a * pps, w = Math.max(2, (TKR.b - TKR.a) * pps), C = TL.col;
  g.save(); g.fillStyle = C.accent2; g.globalAlpha = .2; g.fillRect(x0, y + 1, w, hh - 2); g.globalAlpha = .9; g.fillRect(x0, y + 1, 2, hh - 2); g.fillRect(x0 + w - 2, y + 1, 2, hh - 2);
  if (hh >= 34 && w > 46) { g.globalAlpha = 1; g.font = '700 11px ui-monospace,Menlo,Consolas,monospace'; g.fillStyle = C.text; g.fillText((TKR.b - TKR.a).toFixed(1) + ' s', x0 + 6, y + hh - 8); }
  g.restore();
}

/* ---------- punch in ---------- */
/** Play from a bar before the range, record only inside it. The new audio replaces that stretch in the same lane. */
async function tkrPunch() {
  if (!TKR.on) { toast('Mark the stretch to re-record first (Shift-drag across the lane).', 'warn'); return false; }
  if (T.playing) stopPlay(true); if (!E.hasInput) { try { await startAudio(); } catch (e) { } }
  if (!E.hasInput) { toast('Connect an input first (I/O), then punch in.', 'warn'); return false; }
  const lead = TKR.lead, sd = slotDur(), s0 = Math.max(0, Math.round(TKR.a / sd)), s1 = Math.max(s0 + 1, Math.round(TKR.b / sd));
  Object.assign(PUNCH, { on: true, leadId: lead.id, kind: lead.kind === 'vox' ? 'vox' : 'gtr', a: s0 * sd, b: s1 * sd, startSlot: s0, endSlot: s1, before: snap() });
  T.cursor = Math.max(0, s0 - spb()); await play(true); if (!T.playing) { PUNCH.on = false; return false; }
  toast('Punching in over ' + (PUNCH.b - PUNCH.a).toFixed(1) + ' s: play along, it records only inside the marked stretch.', 'ok'); return true;
}
/** called by recEnd for a punched recording: put the new clip where the range was. Returns the clip, or null when the lane is gone. */
function tkrPunchApply(take, p) {
  const lead = TAKES.find(t => t.id === p.leadId); if (!lead) return null; const key = tkKey(lead), a = p.a, dur = take.dur, b = Math.min(p.b, Math.max(a + TKMIN, take.startSec + dur));
  let from = Math.max(take.startSec, a); take.inS = Math.max(0, from - take.startSec); take.startSec = from; take.outS = null;
  if (tkLen(take) > b - from + 1e-6) take.outS = take.inS + (b - from);
  take.grp = key; take.src = take.id; take.name = lead.name; take.fadeIn = TKR_FADE; take.fadeOut = TKR_FADE;
  ['g', 'pan', 'mute', 'solo', 'mode', 'fx', 'preset'].forEach(k => { if (k === 'fx') { if (lead.fx) take.fx = Object.assign({}, lead.fx); } else if (lead[k] !== undefined) take[k] = lead[k]; });
  tkrLane(key, from, from + tkLen(take), false); TAKES.push(take);                  // the old stretch is silenced, then the new clip fills it
  return take;
}
