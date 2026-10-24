/* ============================================================
   Part 15 · version history (autosave snapshots) + "calibrate to my guitar" (noise gate & string check)
   ============================================================ */
const VH = { idx: store.get('vhist', []), last: '', lastT: 0 };
const vhHash = j => { let x = 5381; for (let i = 0; i < j.length; i++) x = ((x << 5) + x + j.charCodeAt(i)) | 0; return x; };
function vhSnap(label, force) {
  try {
    const j = JSON.stringify(S), hs = String(vhHash(j)); if (!force && hs === VH.last) return false; if (!S.sections.length) return false;
    VH.last = hs; VH.lastT = Date.now(); const id = Date.now().toString(36); store.set('vh.' + id, j);
    VH.idx.unshift({ id, t: Date.now(), title: S.title || 'Untitled', bars: totalBars(), label: label || 'auto', hs }); while (VH.idx.length > 30) { const o = VH.idx.pop(); store.set('vh.' + o.id, null); }
    store.set('vhist', VH.idx); bus.emit('vh'); return true;
  } catch (e) { return false; }
}
let vhTimer = 0; bus.on('song', () => { clearTimeout(vhTimer); vhTimer = setTimeout(() => { if (Date.now() - VH.lastT > 25000) vhSnap('auto'); }, 8000); });
bus.on('transport', () => { if (T.playing && Date.now() - VH.lastT > 5000) vhSnap('before play'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) vhSnap('on leave'); });
function vhRestore(id) { const j = store.get('vh.' + id, null); if (!j) return toast('Snapshot is gone', 'warn'); vhSnap('before restore', true); S = JSON.parse(j); commit(true); bus.emit('song', 'reload'); toast('Restored snapshot', 'ok'); }
function buildVersionCard() {
  const p = PANES.exp; if (!p) return; const list = h('div', { style: { display: 'grid', gap: '4px', maxHeight: '260px', overflow: 'auto' } });
  const fmt = t => { const d = new Date(t), n = Date.now() - t; return n < 6e4 ? 'just now' : n < 36e5 ? Math.round(n / 6e4) + ' min ago' : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  const render = () => { list.innerHTML = ''; if (!VH.idx.length) list.append(h('div', { class: 'tiny muted' }, 'No snapshots yet — they are taken as you work, before each play, and when you leave the page.')); VH.idx.forEach(v => list.append(h('div', { class: 'row', style: { gap: '8px', padding: '5px 8px', background: 'var(--panel2)', borderRadius: '8px', alignItems: 'center' } }, h('b', { style: { flex: 1, fontSize: '12px' } }, v.title, h('span', { class: 'muted', style: { fontWeight: 500 } }, '  ·  ' + v.bars + ' bars · ' + v.label)), h('span', { class: 'tiny muted' }, fmt(v.t)), h('button', { class: 'btn sm', onclick: () => vhRestore(v.id) }, 'Restore'), h('button', { class: 'btn sm bad', title: 'Delete this snapshot', onclick: () => { VH.idx = VH.idx.filter(x => x.id !== v.id); store.set('vh.' + v.id, null); store.set('vhist', VH.idx); render(); } }, '✕')))); };
  render(); bus.on('vh', render);
  p.append(h('div', { class: 'card', style: { padding: '12px', marginTop: '12px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '8px' } }, h('h4', { style: { margin: 0 } }, 'Version history'), h('button', { class: 'btn sm primary', onclick: () => { vhSnap('manual', true); toast('Snapshot saved', 'ok'); } }, '＋ Snapshot now')), list, h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, 'Kept in this browser only (last 30). Restoring first snapshots your current song, so it is reversible.')));
}

/* ---------- guitar calibration ---------- */
const CAL = { busy: false };
function calWait(ms, fn) { return new Promise(res => { const t0 = performance.now(), iv = setInterval(() => { const el = performance.now() - t0; fn && fn(el); if (el >= ms) { clearInterval(iv); res(); } }, 30); }); }
async function calNoise(ui) {
  if (!E.ready) return toast('Power on first'); CAL.busy = true; ui.noise.textContent = 'Stay quiet — mute the strings… 3 s'; const r = []; await calWait(3000, () => r.push(AN.rms)); const v = r.filter(Number.isFinite).sort((a, b) => a - b), n = v[Math.floor(v.length * .9)] || -80;
  CFG.gateDb = clamp(Math.round(n + 10), -66, -38); CFG.noiseDb = Math.round(n); saveCfg(); CAL.busy = false; ui.noise.textContent = `Noise floor ${CFG.noiseDb} dB → note gate set to ${CFG.gateDb} dB`; ui.noise.className = 'chip ok';
}
async function calStrings(ui) {
  if (!E.ready) return toast('Power on first'); CAL.busy = true; const res = [], names = S.tuning.map(m => tunPc(m));
  for (let i = 0; i < 6; i++) {
    ui.str.textContent = `Pluck the open ${names[i]} string (string ${6 - i}) and let it ring…`; ui.dots.children[i].className = 'cdot now';
    let got = false, t0 = performance.now(); while (!got && performance.now() - t0 < 12000) { await calWait(60); if (AN.active && AN.rms > (CFG.gateDb || -56) + 12 && AN.midi != null) got = true; }
    if (!got) { ui.dots.children[i].className = 'cdot bad'; res.push(null); continue; }
    const rms = [], cents = [], cen = [], mid = []; let pk = -99; await calWait(1300, () => { rms.push(AN.rms); pk = Math.max(pk, AN.peak); if (AN.midi != null) { mid.push(AN.midi); cents.push(AN.cents); } cen.push(AN.centroid || 0); });
    const med = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; }, m = med(mid), off = ((med(cents) || 0)) + (m - S.tuning[i] - S.capo) * 100, hi = Math.max(...rms), dec = rms.length ? (rms.findIndex((x, k) => k > 3 && x < hi - 12) + 1) * 30 : 0;
    res.push({ str: i, name: names[i], peak: pk, level: hi, cents: off, centroid: med(cen), decay: dec || 1300, midi: m }); ui.dots.children[i].className = Math.abs(off) > 12 ? 'cdot warn' : 'cdot ok'; await calWait(900);
  }
  const ok = res.filter(Boolean); CFG.guitar = { t: Date.now(), strings: res }; saveCfg(); CAL.busy = false; const out = [];
  if (ok.length < 4) out.push('Only ' + ok.length + ' of 6 strings were heard — check the input and try again.');
  ok.forEach(r => { if (Math.abs(r.cents) > 12) out.push(`${r.name}: ${r.cents > 0 ? 'sharp' : 'flat'} by ${Math.abs(r.cents).toFixed(0)}¢ — tune it before transcribing.`); if (r.peak > -1.5) out.push(`${r.name}: clipping — lower the interface gain.`); });
  const lv = ok.length ? ok.reduce((a, r) => a + r.level, 0) / ok.length : -99; if (lv < -34) out.push(`Average level ${lv.toFixed(0)} dB is low — raise the gain so open strings land around −18 dB.`); if (lv > -8) out.push(`Average level ${lv.toFixed(0)} dB is hot — back it off a little.`);
  const sp = ok.length ? Math.max(...ok.map(r => r.level)) - Math.min(...ok.map(r => r.level)) : 0; if (sp > 12) out.push(`String-to-string level varies by ${sp.toFixed(0)} dB — check pickup height or pick attack.`);
  ui.str.textContent = ok.length ? 'Done. ' + (out.length ? '' : 'All strings in tune and at a healthy level.') : 'No strings heard.'; ui.out.innerHTML = ''; out.forEach(t => ui.out.append(h('div', { class: 'small', style: { color: 'var(--warn, #c77)' } }, '• ' + t)));
  if (ok.length) ui.out.append(h('div', { class: 'tiny muted', style: { marginTop: '4px' } }, `Avg brightness ${Math.round(ok.reduce((a, r) => a + r.centroid, 0) / ok.length)} Hz · avg sustain ${(ok.reduce((a, r) => a + r.decay, 0) / ok.length / 1000).toFixed(1)} s`));
}
function buildCalCard() {
  const p = PANES.tx; if (!p) return; const ui = { noise: h('span', { class: 'chip' }, CFG.gateDb != null ? `Noise floor ${CFG.noiseDb} dB → gate ${CFG.gateDb} dB` : 'not measured'), str: h('div', { class: 'small muted' }, CFG.guitar ? 'Last run ' + new Date(CFG.guitar.t).toLocaleString() : 'Not run yet'), dots: h('div', { class: 'row', style: { gap: '6px' } }, [0, 1, 2, 3, 4, 5].map(() => h('span', { class: 'cdot' }))), out: h('div') };
  p.append(h('div', { class: 'card', style: { padding: '12px', marginTop: '12px' } }, h('h4', { style: { margin: '0 0 4px' } }, 'Calibrate to my guitar'), h('div', { class: 'tiny muted', style: { marginBottom: '8px' } }, 'Measures your room noise and checks each open string. Sets the note gate used by the tuner, chord/key detection and live visuals, and flags tuning, level and clipping problems before you record.'),
    h('div', { class: 'row', style: { gap: '10px', alignItems: 'center', flexWrap: 'wrap' } }, h('button', { class: 'btn sm', onclick: () => { if (!CAL.busy) calNoise(ui); } }, '① Measure noise (3 s)'), ui.noise), h('div', { class: 'row', style: { gap: '10px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn sm', onclick: () => { if (!CAL.busy) calStrings(ui); } }, '② Check open strings'), ui.dots), ui.str, ui.out,
    h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onclick: () => { delete CFG.gateDb; delete CFG.noiseDb; delete CFG.guitar; saveCfg(); ui.noise.textContent = 'not measured'; ui.noise.className = 'chip'; ui.str.textContent = 'Reset'; toast('Calibration cleared'); } }, 'Reset to defaults'))));
}
