/* ============================================================
   Part 46b · LANES OUT (2.55) — every lane as its own WAV, ready to mix and master in another app
   ⤓ Save this lane (every lane's ⋯ menu) and 📦 Export for mixing & mastering (Save & export) render each lane on its own through the fast
   renderer (part 46) with everything else silenced, and with the lane's own level, pan and effects, but WITHOUT the master tone, master
   level and limiter (opt.raw), which belong to whoever mixes it next.
   Every file starts at the song's first beat (0:00) and runs the whole song plus its tail, so in BandLab, a DAW, or anything else they line
   up the moment each one is dropped at the start. Nothing is normalised: levels stay as mixed. A lane that would clip is turned down just
   enough, and the README says by how many dB to raise its fader to restore the balance (one lane in memory at a time keeps this light).
   The whole set also gets a premaster (the full mix, no master effects, peaking at −3 dBFS or below) for mastering, and a README with
   the tempo, key, time signature and sample rate so the other app's grid can be set to match.
   Getting files into another app: a folder you pick (Chrome and Edge write straight into it), or one .zip. A lane you save on its own also
   gets a chip you can drag onto the desktop or into a page that accepts dropped files. Browsers don't put audio on the clipboard, so
   copy and paste between apps isn't possible; drag and drop is the way.
   ============================================================ */
const LXO = { busy: false, ceil: Math.pow(10, -1 / 20), pre: Math.pow(10, -3 / 20), bits: 24 };
const LX_BAND = { drums: ['drumsOn', 'Drums'], bass: ['bassOn', 'Bass'], rhythm: ['compOn', 'Rhythm Gtr'], lead: ['leadOn', 'Lead'], keys: ['keysOn', 'Keys'] };
const lxSafe = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'lane';
/** what can be saved, in the order of the arrangement: band parts that are on, each take, each stem of a backing track */
function lxLanes() {
  const out = [];
  Object.keys(LX_BAND).forEach(id => { if (S.band[LX_BAND[id][0]]) out.push({ id, kind: 'band', name: LX_BAND[id][1] }); });
  tkLeads().forEach(tk => out.push({ id: 'take:' + tkKey(tk), kind: 'take', key: tkKey(tk), name: tk.name || 'Take', vox: tk.kind === 'vox' }));
  if (STM.ch) STMS.forEach((_, i) => out.push({ id: 'stem:' + i, kind: 'stem', idx: i, name: 'Track ' + STEM_SHORT[i].replace(' · ', '-') }));
  return out;
}
/** the lane a lane-menu entry stands for (null for the input lanes, which hold nothing until something is recorded) */
function lxFor(l) {
  if (!l) return null; if (LX_BAND[l.id]) return { id: l.id, kind: 'band', name: LX_BAND[l.id][1] };
  if (l.type === 'take') return { id: l.id, kind: 'take', key: tkKey(l.take), name: l.take.name || 'Take', vox: l.take.kind === 'vox' };
  if (l.type === 'stem') return { id: l.id, kind: 'stem', idx: l.idx, name: 'Track ' + STEM_SHORT[l.idx].replace(' · ', '-') };
  if (l.type === 'trk') return { id: 'trk', kind: 'trk', name: 'Track' };
  return null;
}
/** silence everything but one lane (or nothing, for the premaster); returns the function that puts it all back */
function lxSolo(x) {
  const bandWas = Object.fromEntries(Object.values(LX_BAND).map(([k]) => [k, S.band[k]])), mixWas = Object.fromEntries(Object.entries(S.mix).map(([k, v]) => [k, { m: v.m, s: v.s }]));
  const tkWas = TAKES.map(t => [t, t.mute, t.solo]), stmWas = { mute: STM.mute, mix: STM.mix.map(m => ({ m: m.m, s: m.s })) }, monWas = CFG.monitor;
  if (x) {
    Object.values(S.mix).forEach(v => { v.s = 0; });
    Object.values(LX_BAND).forEach(([k]) => { S.band[k] = x.kind === 'band' && LX_BAND[x.id][0] === k; }); if (x.kind === 'band' && S.mix[x.id]) S.mix[x.id].m = 0;
    TAKES.forEach(t => { t.solo = false; t.mute = !(x.kind === 'take' && tkKey(t) === x.key); });
    if (x.kind === 'take') { const L = TAKES.find(t => tkKey(t) === x.key); if (L && L.kind === 'vox' && S.mix.vox) S.mix.vox.m = 0; if (L && L.mode === 'reamp') { if (S.mix.live) S.mix.live.m = 0; CFG.monitor = true; } }
    STM.mute = !(x.kind === 'stem' || x.kind === 'trk'); STM.mix.forEach((m, i) => { m.s = false; m.m = x.kind === 'stem' ? i !== x.idx : (x.kind === 'trk' ? m.m : true); });
  }
  return () => {
    Object.entries(bandWas).forEach(([k, v]) => { S.band[k] = v; }); Object.entries(mixWas).forEach(([k, v]) => { if (S.mix[k]) Object.assign(S.mix[k], v); });
    tkWas.forEach(([t, m, s]) => { t.mute = m; t.solo = s; }); STM.mute = stmWas.mute; STM.mix.forEach((m, i) => Object.assign(m, stmWas.mix[i])); CFG.monitor = monWas;
    try { applyMix(); spGains(); spBus(); } catch (e) { } bus.emit('song', 'band'); bus.emit('takes');
  };
}
const lxPeak = (l, r) => { let p = 0; for (let i = 0; i < l.length; i++) { const a = Math.abs(l[i]), b = Math.abs(r[i]); if (a > p) p = a; if (b > p) p = b; } return p; };
const lxDb = g => (20 * Math.log10(g)).toFixed(1);
/** one lane (or, with x = null, the premaster) rendered from the first beat, as { l, r, sr, peak } */
async function lxRender(x, onProgress) {
  await startAudio(); if (!ofrAvailable()) throw new Error('This browser can’t render the song faster than it plays, so lanes can’t be saved one by one here.');
  const back = lxSolo(x);
  try { const o = await ofrRender({ raw: true, onProgress }); return Object.assign(o, { peak: lxPeak(o.l, o.r) }); } finally { back(); }
}
const lxWav = (o, g) => { if (g !== 1) { o.l = o.l.map(v => v * g); o.r = o.r.map(v => v * g); } return encodeWav([o.l, o.r], o.sr, LXO.bits); };
/** a file you can drag onto the desktop or into a page that takes dropped files (Edge and Chrome: also straight into Explorer or Finder) */
function lxChip(file) {
  const url = URL.createObjectURL(file), a = h('a', { class: 'lx-chip', href: url, download: file.name, draggable: 'true', title: 'Drag it onto your desktop, a folder, or another app’s drop area. Or click to save it.' }, h('b', {}, '⇱ '), file.name, h('span', { class: 'tiny muted' }, ' · ' + projBytes(file.size)));
  a.addEventListener('dragstart', e => { const dt = e.dataTransfer; try { dt.setData('DownloadURL', (file.type || 'audio/wav') + ':' + file.name + ':' + url); } catch (x) { } try { dt.items.add(file); } catch (x) { } try { dt.setData('text/uri-list', url); } catch (x) { } dt.effectAllowed = 'copy'; });
  return a;
}
const lxName = (n, x) => (n ? String(n).padStart(2, '0') + ' ' : '') + lxSafe(x ? x.name : 'Premaster (full mix, no master effects)') + '.wav';

/* ---------- one lane ---------- */
async function lxSaveLane(l) {
  const x = lxFor(l); if (!x) return toast('This lane has nothing recorded yet.', 'warn'); if (LXO.busy || OFR.busy) return toast('A render is already running', 'warn');
  if (T.playing) stopPlay(true); LXO.busy = true;
  const fill = h('i'), msg = h('p', { class: 'muted', id: 'lxMsg', role: 'status' }, 'Rendering ' + x.name + '…'), body = h('div', { class: 'rnd' }, msg, h('div', { class: 'rnd-bar' }, fill));
  const d = pdlg('lxDlg', '⤓ ' + x.name, body, { onclose: () => { if (OFR.busy) ofrAbort(); } });
  try {
    const o = await lxRender(x, p => { fill.style.width = Math.round(p * 100) + '%'; });
    if (o.peak < 1e-4) { msg.textContent = x.name + ' is silent from start to end (switched off, muted or empty), so there is nothing to save.'; return; }
    const g = o.peak > LXO.ceil ? LXO.ceil / o.peak : 1, file = new File([lxWav(o, g)], lxSafe((S.title || 'Song') + ' - ' + x.name) + '.wav', { type: 'audio/wav' });
    body.replaceChildren(
      h('p', {}, h('b', {}, x.name), ' is ready: ' + fmtT(o.l.length / o.sr) + ', ' + Math.round(o.sr / 1000) + ' kHz, ' + LXO.bits + '-bit stereo, from the song’s first beat.'),
      lxChip(file),
      h('p', { class: 'tiny muted' }, 'Drag it into another app, or onto your desktop first. Drop it at the very start (bar 1) and it lines up with the other lanes you save. ' + (g < 1 ? 'It would have clipped, so it is ' + lxDb(1 / g) + ' dB quieter: raise its fader that much to match.' : 'Its level is as you mixed it: no master effects.')),
      h('div', { class: 'row', style: { gap: '8px', justifyContent: 'flex-end' } }, h('button', { class: 'btn primary', id: 'lxDl', onclick: () => download(file.name, file) }, '⤓ Save'), h('button', { class: 'btn', onclick: () => d.close() }, 'Close')));
  } catch (e) { if (e && e.cancelled) return; msg.textContent = 'It could not be rendered: ' + (e.message || e); }
  finally { LXO.busy = false; }
}

/* ---------- all of them ---------- */
async function lxPickFolder() { try { return await window.showDirectoryPicker({ id: 'daily-mix', mode: 'readwrite' }); } catch (e) { return null; } }
async function lxExport(opt) {
  opt = opt || {}; if (LXO.busy || OFR.busy) return toast('A render is already running', 'warn'); if (T.playing) stopPlay(true);
  const lanes = (opt.lanes || lxLanes()), want = opt.premaster !== false; if (!lanes.length && !want) return toast('Nothing to export yet.', 'warn');
  let dir = opt.dir || null; if (opt.where === 'folder' && !dir) { dir = await lxPickFolder(); if (!dir) return; }
  LXO.busy = true; const fill = h('i'), msg = h('p', { class: 'muted', id: 'lxAllMsg', role: 'status' }, 'Starting…'), list = h('ol', { class: 'small lx-list' }), body = h('div', { class: 'rnd' }, msg, h('div', { class: 'rnd-bar' }, fill), list);
  let stop = false; const d = pdlg('lxAll', '📦 Export for mixing & mastering', body, { onclose: () => { stop = true; if (OFR.busy) ofrAbort(); } });
  const jobs = (want ? [null] : []).concat(lanes), files = [], skipped = [], turned = [], title = lxSafe(S.title || 'Song'); let n = 0, sr = E.ctx ? E.ctx.sampleRate : 48000, secs = 0, sub = null, gP = 1;
  /* each file is written (or packed) as soon as it is rendered, so only one lane's audio is in memory at a time */
  const put = async (name, blob) => {
    if (dir) { if (!sub) { sub = dir; try { sub = await dir.getDirectoryHandle(title + ' (stems ' + new Date().toISOString().slice(0, 10) + ')', { create: true }); } catch (e) { } } const fh = await sub.getFileHandle(name, { create: true }), w = await fh.createWritable(); await w.write(blob); await w.close(); files.push({ name }); }
    else { const u = new Uint8Array(await blob.arrayBuffer()); files.push({ name, data: blob, crc: crc32(u), size: u.length }); }
  };
  try {
    for (let j = 0; j < jobs.length && !stop; j++) {
      const x = jobs[j], label = x ? x.name : 'the premaster'; msg.textContent = 'Rendering ' + label + ' (' + (j + 1) + ' of ' + jobs.length + ')…';
      const o = await lxRender(x, p => { fill.style.width = Math.round((j + p) / jobs.length * 100) + '%'; }); if (stop) return;
      if (o.peak < 1e-4) { skipped.push(x ? x.name : 'Premaster'); list.append(h('li', { class: 'muted' }, (x ? x.name : 'Premaster') + ': silent, left out')); continue; }
      sr = o.sr; secs = o.l.length / o.sr;
      const lim = x ? LXO.ceil : LXO.pre, g = o.peak > lim ? lim / o.peak : 1, name = x ? lxName(++n, x) : '00 ' + lxName(0, null);
      if (!x) gP = g; else if (g < 1) turned.push(name + ': ' + lxDb(1 / g) + ' dB quieter, so it doesn’t clip (raise its fader ' + lxDb(1 / g) + ' dB to restore the balance)');
      await put(name, lxWav(o, g)); list.append(h('li', {}, (x ? x.name : 'Premaster') + ' ✓' + (x && g < 1 ? ' (−' + lxDb(1 / g) + ' dB)' : '')));
      if (opt.onDone) opt.onDone(j, jobs.length);
    }
    if (stop) return;
    const readme = [title + (S.artist && S.artist !== 'Your Name' ? ' — ' + S.artist : ''), 'Exported from the-daily.studio ' + VERSION + ' on ' + new Date().toLocaleString(), '',
      'Tempo: ' + S.bpm + ' BPM   Time signature: ' + S.ts.join('/') + '   Key: ' + pcName(S.key, keyUsesFlats(S.key, S.minor)) + (S.minor ? ' minor' : ' major'),
      'Sample rate: ' + sr + ' Hz   Format: WAV, ' + LXO.bits + '-bit, stereo   Length of every file: ' + fmtT(secs) + ' (the song plus its tail)', '',
      'HOW TO USE: set your project to ' + S.bpm + ' BPM and ' + S.ts.join('/') + ', then drop every file at the very start (bar 1, 0:00). They all start at the song’s first beat, so they line up.',
      'Levels are as mixed in the studio, with each lane’s own level, pan and effects, and none of the master section (master tone, master level, limiter).',
      turned.length ? 'Turned down so they don’t clip:\n  ' + turned.join('\n  ') : 'No lane was turned down: none would clip, so the balance is exactly as mixed.',
      want && !skipped.includes('Premaster') ? '00 Premaster is the full mix the same way, for mastering' + (gP < 1 ? ', turned down ' + lxDb(1 / gP) + ' dB to peak at −3 dBFS (headroom for mastering).' : ' (it already peaks below −3 dBFS).') : '',
      '', 'Files:', ...files.map(f => '  ' + f.name), skipped.length ? '\nLeft out (silent): ' + skipped.join(', ') : ''].filter(v => v !== '').join('\n');
    await put('README.txt', new Blob([readme + '\n'], { type: 'text/plain' }));
    if (dir) msg.textContent = '✓ ' + (files.length - 1) + ' files and a README are in the folder “' + sub.name + '”. Drag them from there into your other app, all at bar 1.';
    else {
      const zf = new File([zipBuild(files)], title + ' - stems.zip', { type: 'application/zip' }); if (!opt.noDownload) download(zf.name, zf); LXO.lastZip = zf;
      msg.textContent = '✓ ' + (files.length - 1) + ' files and a README, in one .zip. Unzip it, then drag the files into your other app, all at bar 1.'; body.append(lxChip(zf));
    }
    fill.style.width = '100%'; body.append(h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, h('button', { class: 'btn primary', id: 'lxDone', onclick: () => d.close() }, 'Done')));
    return { files: files.map(f => f.name), turned, gP, readme };
  } catch (e) { if (!(e && e.cancelled)) { msg.textContent = 'The export stopped: ' + (e.message || e); console.warn(e); } }
  finally { LXO.busy = false; }
}
/** the choice before exporting: what goes in, and where it goes */
function lxExportOpen() {
  const lanes = lxLanes(); if (!lanes.length) return toast('Nothing to export yet: switch a band part on, record a take or load a track.', 'warn');
  const boxes = lanes.map(x => ({ x, c: h('input', { type: 'checkbox', checked: true }) })), pm = h('input', { type: 'checkbox', id: 'lxPm', checked: true }), canDir = typeof window.showDirectoryPicker === 'function';
  const go = where => { d.close(); lxExport({ lanes: boxes.filter(b => b.c.checked).map(b => b.x), premaster: pm.checked, where }); };
  const d = pdlg('lxPick', '📦 Export for mixing & mastering', h('div', { class: 'lx-pick' },
    h('p', { class: 'small' }, 'Each lane becomes its own WAV, rendered from the song’s first beat to its end, so in BandLab, a DAW or a mastering app they line up when dropped at bar 1. Levels, pan and lane effects are kept; the master section is left for whoever mixes it.'),
    h('div', { class: 'lx-lanes' }, boxes.map(b => h('label', { class: 'chk' }, b.c, ' ' + b.x.name))),
    h('label', { class: 'chk' }, pm, ' 00 Premaster: the full mix with headroom, for mastering'),
    h('p', { class: 'tiny muted' }, 'A README with the tempo, key and time signature goes with them. Your backing track’s stems are someone else’s recording: use them to practise and mix for yourself, and only publish parts that are yours.'),
    h('div', { class: 'row', style: { gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' } }, h('button', { class: 'btn', onclick: () => d.close() }, 'Cancel'),
      canDir ? h('button', { class: 'btn', id: 'lxZip', onclick: () => go('zip') }, 'One .zip') : null,
      h('button', { class: 'btn primary', id: 'lxGo', onclick: () => go(canDir ? 'folder' : 'zip') }, canDir ? 'Choose a folder…' : 'Export (.zip)'))));
}
