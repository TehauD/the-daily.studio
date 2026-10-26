/* ============================================================
   Part 44 · Auto-balance
   Measures the loudness of your recordings and backing track (the same ITU-R BS.1770 meter the exporter uses), then proposes a level and pan for
   every lane so they sit together: vocal on top, guitar under it, the backing track behind, the band at a reference balance.
   You see the plan first, apply it, and can undo it. Everything is measured on this device.
   ============================================================ */
const BAL = { snap: null, plan: null, busy: false };
const AB_T = { vox: -16, gtr: -19, trk: -21, trkSolo: -16 };               // loudness (LUFS) each lane aims for when it is heard on its own
const AB_BAND = { drums: [.8, 0], bass: [.8, 0], rhythm: [.75, -.15], lead: [.8, .15] };   // generated parts are already level, so they go back to the reference balance
const AB_NAMES = { drums: 'Drums', bass: 'Bass', rhythm: 'Rhythm Gtr', lead: 'Lead / Tab' };
const AB_MAX = 4, AB_MAX_TRK = 1.5, AB_MIN = .05;                         // the lane faders' reach: takes go up to +12 dB (a squared fader), the backing track to +3.5 dB
const AB_PANS = [-.5, .5, -.3, .3, -.15, .15];
const abDb = g => (g > 0 ? 20 * Math.log10(g) : -60);
const abPan = p => Math.abs(p) < .03 ? 'C' : (p < 0 ? 'L' : 'R') + Math.round(Math.abs(p) * 100);
const abSign = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1);
const abTick = () => new Promise(r => setTimeout(r, 0));

/** integrated loudness of a mono/stereo buffer (first `cap` seconds); −Infinity when it is too short or silent */
function abLufs(L, R, sr, cap) {
  const n = Math.min(L.length, Math.floor(sr * (cap || 60))); if (n < sr * .6) return -Infinity;
  return lufsMeasure(L.subarray(0, n), R ? R.subarray(0, n) : null, sr).lufs;
}
/** the backing track as it is heard now (stem gains, mutes and solos), before the whole-track level */
function abTrackLufs() {
  if (!STM.ch || !STM.n) return -Infinity;
  const sr = STM.sr, n = Math.min(STM.n, Math.floor(sr * 60)), L = new Float32Array(n), R = new Float32Array(n), anyS = STM.mix.some(m => m.s);
  STM.mix.forEach((m, i) => {
    if (anyS ? !m.s : m.m) return; const d = spData(i), k = (m.g == null ? 1 : m.g) / 32768, a = d[0], b = d[1];
    for (let j = 0; j < n; j++) { L[j] += a[j] * k; R[j] += b[j] * k; }
  });
  return abLufs(L, R, sr, 60);
}
/** work out what to change. Pure with respect to the app: it only reads. */
async function abMeasure() {
  const rows = [], notes = [], leads = tkLeads(), haveTakes = leads.length > 0, vox = leads.filter(t => t.kind === 'vox'), gtr = leads.filter(t => t.kind !== 'vox');
  const aim = (base, n) => base - (n > 1 ? 10 * Math.log10(n) : 0);
  const take = (tk, base, n, pan) => {
    const r = tkRender(tk, 'dry') || tkRender(tk, 'wet'); if (!r) return;                 // the lane as it plays: trimmed clips in place, fades applied
    const lufs = abLufs(r.data, null, r.sr, 60), g0 = tk.g == null ? 1 : tk.g;
    if (!isFinite(lufs)) { notes.push('“' + tk.name + '” is too quiet or too short to measure, so it was left as it is.'); return; }
    const want = aim(base, n), raw = Math.pow(10, (want - lufs) / 20), g1 = clamp(raw, AB_MIN, AB_MAX);
    if (raw > AB_MAX * 1.01) notes.push('“' + tk.name + '” is very quiet. It is raised as far as its fader goes, which is ' + (abDb(raw) - abDb(AB_MAX)).toFixed(1) + ' dB short of the target. Re-record it a little louder if you can.');
    rows.push({ type: 'take', id: tk.id, name: tk.name, lufs, g0, g1, p0: tk.pan || 0, p1: pan });
  };
  vox.forEach(tk => take(tk, AB_T.vox, vox.length, 0)); await abTick();
  for (let i = 0; i < gtr.length; i++) { take(gtr[i], AB_T.gtr, gtr.length, gtr.length > 1 ? AB_PANS[i % AB_PANS.length] : 0); await abTick(); }
  if (STM.ch) {
    const lufs = abTrackLufs(), g0 = STM.vol == null ? 1 : STM.vol;
    if (!isFinite(lufs)) notes.push('The backing track is silent as it is mixed now (check its mutes), so it was left as it is.');
    else { const want = haveTakes ? AB_T.trk : AB_T.trkSolo, raw = Math.pow(10, (want - lufs) / 20), g1 = clamp(raw, AB_MIN, AB_MAX_TRK); if (raw > AB_MAX_TRK * 1.01) notes.push('The backing track is quiet. It is raised as far as its fader goes, which is ' + (abDb(raw) - abDb(AB_MAX_TRK)).toFixed(1) + ' dB short of the target.'); rows.push({ type: 'trk', id: 'trk', name: 'Backing track', lufs, g0, g1, p0: 0, p1: 0 }); }
  }
  Object.keys(AB_BAND).forEach(k => {
    const m = S.mix[k] || (S.mix[k] = { g: 1, p: 0, m: 0, s: 0 }), [g1, p1] = AB_BAND[k];
    if (Math.abs(abDb(m.g) - abDb(g1)) >= .5 || Math.abs((m.p || 0) - p1) >= .05) rows.push({ type: 'band', id: k, name: AB_NAMES[k], lufs: null, g0: m.g, g1, p0: m.p || 0, p1 });
  });
  if (!haveTakes && !STM.ch) notes.push('There are no recordings or backing track yet, so only the band parts are set to a reference balance.');
  rows.forEach(r => { r.dg = abDb(r.g1) - abDb(r.g0); r.dp = r.p1 - r.p0; r.same = Math.abs(r.dg) < .5 && Math.abs(r.dp) < .05; });
  return { rows, notes, t: Date.now() };
}
function abSnapshot(plan) {
  const s = { takes: {}, trk: STM.vol == null ? 1 : STM.vol, band: {} };
  plan.rows.forEach(r => { if (r.type === 'take') { const tk = TAKES.find(t => t.id === r.id); if (tk) s.takes[r.id] = [tk.g == null ? 1 : tk.g, tk.pan || 0]; } else if (r.type === 'band') s.band[r.id] = [S.mix[r.id].g, S.mix[r.id].p || 0]; });
  return s;
}
function abLive() { try { TAKES.forEach(t => takeLive(t)); } catch (e) { } try { spBus(); } catch (e) { } try { applyMix(); } catch (e) { } bus.emit('takes'); TL.dirty = true; }
/** apply a plan (rows that already sit right are skipped). Returns the number of lanes changed. One step in Undo / Redo. */
function abApply(plan) {
  BAL.snap = abSnapshot(plan); const before = snap(); let n = 0; try { vhSnap('before Auto-balance', true); } catch (e) { }
  plan.rows.forEach(r => {
    if (r.same) return; n++;
    if (r.type === 'take') { const tk = TAKES.find(t => t.id === r.id); if (tk) { tk.g = +r.g1.toFixed(3); tk.pan = +r.p1.toFixed(2); } }
    else if (r.type === 'trk') STM.vol = +r.g1.toFixed(3);
    else { S.mix[r.id].g = r.g1; S.mix[r.id].p = r.p1; }
  });
  abLive(); if (!histPush(before)) commit(false); BAL.hist = histStack.cur; return n;
}
function abUndo() {
  const s = BAL.snap; if (!s) return false;
  if (BAL.hist && histStack.cur === BAL.hist && histStack.u.length) { BAL.snap = null; BAL.hist = null; undo(); abLive(); return true; }   // nothing else has changed since: step back through the shared history
  const before = snap();
  Object.keys(s.takes).forEach(id => { const tk = TAKES.find(t => t.id === id); if (tk) { tk.g = s.takes[id][0]; tk.pan = s.takes[id][1]; } });
  STM.vol = s.trk; Object.keys(s.band).forEach(k => { S.mix[k].g = s.band[k][0]; S.mix[k].p = s.band[k][1]; });
  BAL.snap = null; BAL.hist = null; abLive(); if (!histPush(before)) commit(false); return true;
}

/** the dialog: measure → show the plan → apply → undo */
async function autoBalance() {
  if (BAL.busy) return; BAL.busy = true;
  const body = h('div', { class: 'ab' }, h('p', { class: 'muted' }, 'Measuring your lanes…')), d = pdlg('abDlg', 'Auto-balance', body, { onclose: () => { BAL.plan = null; } });
  try {
    const plan = BAL.plan = await abMeasure(); if (!document.getElementById('abDlg')) return;
    const draw = (applied) => {
      body.innerHTML = ''; const ch = plan.rows.filter(r => !r.same);
      body.append(h('p', { class: 'muted ab-lead' }, applied ? 'Done. Press play to hear it, or undo to put everything back.' : ch.length ? 'Here is what would change. Nothing moves until you press Apply.' : 'Everything already sits well together. Nothing needs to change.'));
      if (plan.rows.length) body.append(h('div', { class: 'ab-tbl', role: 'table' },
        h('div', { class: 'ab-r ab-h', role: 'row' }, ['Lane', 'Measured', 'Level', 'Pan'].map(x => h('span', { role: 'columnheader' }, x))),
        plan.rows.map(r => h('div', { class: 'ab-r' + (r.same ? ' ok' : ''), role: 'row', 'data-id': r.id },
          h('b', { class: 'ab-n', title: r.name }, r.name), h('span', { class: 'ab-m' }, r.lufs == null ? 'reference' : fmtLU(r.lufs) + ' LUFS'),
          h('span', { class: 'ab-l' }, r.same ? '✓ about right' : abSign(abDb(r.g0)) + ' → ' + abSign(abDb(r.g1)) + ' dB'), h('span', { class: 'ab-p' }, r.same ? abPan(r.p1) : abPan(r.p0) + ' → ' + abPan(r.p1))))));
      if (plan.notes.length) body.append(h('ul', { class: 'ab-notes tiny muted' }, plan.notes.map(x => h('li', {}, x))));
      body.append(h('div', { class: 'tiny muted' }, 'Loudness is measured on this device with the same meter used for exports. Vocal about ' + AB_T.vox + ' LUFS, guitar ' + AB_T.gtr + ', backing track ' + AB_T.trk + '.'));
      const act = h('div', { class: 'ab-act row' });
      if (applied) act.append(h('button', { class: 'btn', id: 'abUndo', onclick: () => { abUndo(); toast('Levels put back', 'ok'); d.close(); } }, '↶ Undo'), h('span', { class: 'grow' }), h('button', { class: 'btn primary', id: 'abDone', onclick: () => d.close() }, 'Done'));
      else act.append(h('button', { class: 'btn', onclick: () => d.close() }, 'Cancel'), h('span', { class: 'grow' }), ch.length ? h('button', { class: 'btn primary', id: 'abApply', onclick: () => { const n = abApply(plan); toast('Balanced ' + n + ' lane' + (n === 1 ? '' : 's'), 'ok'); draw(true); } }, 'Apply to ' + ch.length + ' lane' + (ch.length === 1 ? '' : 's')) : h('button', { class: 'btn primary', onclick: () => d.close() }, 'Close'));
      body.append(act);
    };
    draw(false);
  } catch (e) { console.warn(e); body.innerHTML = ''; body.append(h('p', {}, 'Could not measure the lanes (' + (e.message || e) + ').'), h('button', { class: 'btn', onclick: () => d.close() }, 'Close')); }
  finally { BAL.busy = false; }
}
