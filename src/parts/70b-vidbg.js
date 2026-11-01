/* ============================================================
   Part 70b · YOUR VIDEO (2.19) — your own video loops, behind you
   A "Behind you" look made from videos you add (MP4 or WebM: clouds, a road at night, your own footage). It plays without sound,
   looped, filling the picture, so with Camera look ▸ Me in front you stand inside it; on the Visuals, the Stage, the Audience view and
   in recorded videos, like the other looks.
     · It moves with the music: the 🎚 Speed control sets how fast it plays, it brightens a little when you play loud and swells
       slightly on a strong beat (Breathe), and it can take the chord's colour (Tint, the same colour the other backdrops use).
     · With more than one video it can cut to the next on each new section, or every 4 or 8 bars, while the song plays (a short crossfade).
   The videos are kept as files in this browser's own database ('the-daily-songs', key stage/vid/<id>), like the stage's pictures:
   nothing is uploaded, and they are not part of a song's backup. Only the one being shown is opened, and it pauses when no one draws it.
   ============================================================ */
const VBG_MAX = 8, VBG_MAXFILE = 300e6, VBG_FADE = .6;
CFG.vbg = Object.assign({ list: [], pick: '', cycle: 'off', tint: .3, dim: .2, breathe: true }, CFG.vbg && typeof CFG.vbg === 'object' ? CFG.vbg : {});
if (!Array.isArray(CFG.vbg.list)) CFG.vbg.list = [];
const VBG = { el: [null, null], on: 0, id: ['', ''], url: new Map(), fade: 1, sec: '', bar: -1, cyc: '', used: 0, gone: new Set(), err: 0 };
VBACK.push(['video', 'Your video']); VMODES.push(['video', 'Your video']); BK_MODES.add('video'); BK_FN.video = vbgDraw;
const VBG_CYCLES = [['off', 'One video'], ['section', 'Each section'], ['bars4', 'Every 4 bars'], ['bars8', 'Every 8 bars']];

/** a video element for drawing: muted (so it may play without a click), looped, inline */
function vbgEl(i) {
  let v = VBG.el[i]; if (v) return v;
  v = VBG.el[i] = document.createElement('video'); v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
  v.addEventListener('error', () => { const id = VBG.id[i]; if (id && !VBG.gone.has(id)) { VBG.gone.add(id); console.warn('video backdrop could not play', id); } });
  return v;
}
/** a stored video as an address the element can play (made once, kept while the page is open) */
async function vbgUrl(id) {
  if (VBG.url.has(id)) return VBG.url.get(id);
  if (!PRJ.db) return null; const blob = await pdbGet('blobs', 'stage/vid/' + id); if (!blob) { VBG.gone.add(id); return null; }
  const u = URL.createObjectURL(blob); VBG.url.set(id, u); return u;
}
/** put video `id` on element i and start it */
async function vbgPut(i, id) {
  const v = vbgEl(i); if (VBG.id[i] === id) return v; VBG.id[i] = id;
  const u = id ? await vbgUrl(id) : null; if (VBG.id[i] !== id) return v;      /* another choice came in while this one loaded */
  if (!u) { v.removeAttribute('src'); v.load(); return v; }
  v.src = u; v.playbackRate = vbgRate(); try { await v.play(); } catch (e) { } return v;
}
const vbgRate = () => clamp(typeof vzSpeed === 'function' ? vzSpeed() : 1, .25, 3);
const vbgList = () => CFG.vbg.list.filter(x => !VBG.gone.has(x.id));
/** which video should be showing now: the one you chose; or, while the song plays and Change video is set, the next in turn on each new
    section or every 4 or 8 bars (VBG.cyc keeps its place until the next change; when the song stops, your choice comes back) */
function vbgWant() {
  const L = vbgList(); if (!L.length) return '';
  const pick = L.some(x => x.id === CFG.vbg.pick) ? CFG.vbg.pick : L[0].id;
  if (CFG.vbg.cycle === 'off' || L.length < 2 || !T.playing) { VBG.cyc = ''; return pick; }
  if (!VBG.cyc || !L.some(x => x.id === VBG.cyc)) VBG.cyc = pick;
  const info = typeof stageInfo === 'function' ? stageInfo() : {}, bar = Math.floor(Math.max(0, playheadSlot()) / spb()), n = CFG.vbg.cycle === 'bars8' ? 8 : 4;
  let step = false;
  if (CFG.vbg.cycle === 'section') { if (info.sec && info.sec !== 'Count-in' && info.sec !== VBG.sec) { step = !!VBG.sec; VBG.sec = info.sec; } }
  else { const k = Math.floor(bar / n); if (k !== VBG.bar) { step = VBG.bar >= 0; VBG.bar = k; } }
  if (step) { const i = L.findIndex(x => x.id === VBG.cyc); VBG.cyc = L[(i + 1) % L.length].id; }
  return VBG.cyc;
}
bus.on('transport', () => { if (!T.playing) { VBG.sec = ''; VBG.bar = -1; VBG.cyc = ''; } });
/** the look itself (part 70's backdrops call this with the shared state B: the chord's hue, the energy, the beat) */
function vbgDraw(g, W, H, B) {
  VBG.used = performance.now();
  const want = vbgWant(), A = VBG.el[VBG.on];
  if (want && !VBG.id[VBG.on]) vbgPut(VBG.on, want);      /* the first one goes straight on */
  else if (want && want !== VBG.id[VBG.on] && want !== VBG.id[1 - VBG.on]) { vbgPut(1 - VBG.on, want); VBG.fade = 0; }      /* the next one loads on the other element, then fades in */
  const nx = VBG.el[1 - VBG.on];
  if (nx && VBG.id[1 - VBG.on] === want && want && nx.readyState >= 2) { VBG.fade = Math.min(1, VBG.fade + B.dt / VBG_FADE); if (VBG.fade >= 1) { VBG.on = 1 - VBG.on; try { if (A) A.pause(); } catch (e) { } VBG.id[1 - VBG.on] = ''; } }
  const cur = VBG.el[VBG.on], ok = v => v && v.readyState >= 2 && v.videoWidth > 0, r = vbgRate();
  [[cur, VBG.id[VBG.on]], [nx, VBG.id[1 - VBG.on]]].forEach(([v, id]) => { if (!v) return; if (id && v.paused && v.src) v.play().catch(() => { }); else if (!id && !v.paused) v.pause(); if (Math.abs(v.playbackRate - r) > .01) v.playbackRate = r; });
  if (!ok(cur) && !ok(nx)) {
    bkSky(g, W, H, B.hue, 4, 12);
    if (!vbgList().length) { g.fillStyle = 'rgba(255,255,255,.72)'; g.textAlign = 'center'; g.font = `600 ${Math.round(Math.min(W, H) * .04)}px system-ui,sans-serif`; g.fillText('Your video: add one with 🎞 Your videos', W / 2, H / 2); g.textAlign = 'left'; }
    return;
  }
  const pulse = CFG.vbg.breathe ? 1 + .025 * clamp(B.pulse, 0, 1) : 1;
  const paint = (v, a) => { if (!ok(v) || a <= 0) return; const k = Math.max(W / v.videoWidth, H / v.videoHeight) * pulse, dw = v.videoWidth * k, dh = v.videoHeight * k; g.globalAlpha = a; try { g.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) { } g.globalAlpha = 1; };
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const f = VBG.id[1 - VBG.on] && ok(nx) ? VBG.fade : 0; paint(cur, ok(cur) ? 1 : 0); paint(nx, ok(cur) ? f : 1);
  const tint = clamp(+CFG.vbg.tint || 0, 0, 1); if (tint > .01) { g.globalCompositeOperation = 'color'; g.fillStyle = bkHsl(B.hue, 75, 50, tint * .85); g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
  const dim = clamp(+CFG.vbg.dim || 0, 0, .9) * (CFG.vbg.breathe ? 1 - .45 * clamp(B.en, 0, 1) : 1); if (dim > .01) { g.fillStyle = `rgba(0,0,0,${dim.toFixed(3)})`; g.fillRect(0, 0, W, H); }
}
/* a video no one has drawn for a moment is paused, so it costs nothing while another look is on */
setInterval(() => { if (performance.now() - VBG.used > 1500) VBG.el.forEach(v => { if (v && !v.paused) try { v.pause(); } catch (e) { } }); }, 1000);

/* ---------- adding, choosing and removing videos ---------- */
/** can this browser play it? read its length and size first (a format it cannot play is refused here, not found out on stage) */
function vbgProbe(file) {
  return new Promise(res => { const v = document.createElement('video'), u = URL.createObjectURL(file); let done = false; v.muted = true; v.preload = 'metadata';
    const end = r => { if (done) return; done = true; URL.revokeObjectURL(u); res(r); };
    v.onloadedmetadata = () => end(v.videoWidth > 0 ? { dur: v.duration, w: v.videoWidth, h: v.videoHeight } : null); v.onerror = () => end(null); setTimeout(() => end(null), 10000); v.src = u; });
}
async function vbgAdd(files) {
  if (!PRJ.db) return toast('This browser is not keeping files for this site (a private window, or storage turned off), so videos cannot be stored.', 'warn');
  const list = [...files].filter(f => /^video\//.test(f.type) || /\.(mp4|m4v|webm|mov|ogv)$/i.test(f.name)); if (!list.length) return toast('Choose video files: MP4 or WebM.', 'warn');
  let n = 0;
  for (const f of list) {
    if (CFG.vbg.list.length >= VBG_MAX) { toast('Up to ' + VBG_MAX + ' videos. Remove one to add another.', 'warn'); break; }
    if (f.size > VBG_MAXFILE) { toast('“' + f.name + '” is over 300 MB. A short loop (a few MB) works best.', 'warn'); continue; }
    const m = await vbgProbe(f); if (!m) { toast('This browser cannot play “' + f.name + '”. MP4 (H.264) or WebM play almost everywhere.', 'warn'); continue; }
    try {
      const id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await pdbPut('blobs', f, 'stage/vid/' + id);
      CFG.vbg.list.push({ id, name: f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Video', kb: Math.round(f.size / 1024), dur: isFinite(m.dur) ? +m.dur.toFixed(1) : null, w: m.w, h: m.h }); n++;
      if (!CFG.vbg.pick) CFG.vbg.pick = id;
    } catch (e) { toast('“' + f.name + '” could not be kept: ' + (e && /quota/i.test(e.name + e.message) ? 'this browser is out of storage space for this site.' : (e.message || e.name)), 'warn'); }
  }
  if (n) { saveCfg(); bus.emit('vbg'); toast(n + (n === 1 ? ' video' : ' videos') + ' added. They stay on this device.', 'ok'); }
  return n;
}
async function vbgRemove(id) {
  CFG.vbg.list = CFG.vbg.list.filter(x => x.id !== id); if (CFG.vbg.pick === id) CFG.vbg.pick = CFG.vbg.list.length ? CFG.vbg.list[0].id : '';
  [0, 1].forEach(i => { if (VBG.id[i] === id) { VBG.id[i] = ''; const v = VBG.el[i]; if (v) { try { v.pause(); } catch (e) { } v.removeAttribute('src'); v.load(); } } });
  const u = VBG.url.get(id); if (u) { URL.revokeObjectURL(u); VBG.url.delete(id); }
  try { await pdbDel('blobs', 'stage/vid/' + id); } catch (e) { }
  saveCfg(); bus.emit('vbg');
}
function vbgUse(id) { CFG.vbg.pick = id; saveCfg(); VBG.fade = 0; if (VZ.mode !== 'video') vzSetMode('video'); bus.emit('vbg'); }
/** the button beside the Behind you looks */
function vbgBtn() { return h('button', { class: 'btn sm', id: 'vbgBtn', title: 'Your own video loops, to play behind you', onclick: () => vbgOpen() }, '🎞 Your videos'); }
function vbgOpen() {
  const pick = h('input', { type: 'file', accept: 'video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov', multiple: true, style: { display: 'none' }, onchange: async e => { const fl = [...e.target.files]; e.target.value = ''; if (fl.length) { await vbgAdd(fl); paint(); } } });
  const listEl = h('div', { class: 'vbg-list', id: 'vbgList' }), fmt = x => [x.dur ? Math.floor(x.dur / 60) + ':' + String(Math.round(x.dur % 60)).padStart(2, '0') : '', x.w && x.h ? x.w + '×' + x.h : '', x.kb ? (x.kb > 1024 ? (x.kb / 1024).toFixed(1) + ' MB' : x.kb + ' KB') : ''].filter(Boolean).join(' · ');
  function paint() {
    listEl.innerHTML = ''; const L = CFG.vbg.list;
    if (!L.length) listEl.append(h('div', { class: 'tiny muted' }, 'No videos yet. A short loop that repeats smoothly works best: clouds, water, a road at night, lights, your own footage.'));
    L.forEach(x => listEl.append(h('div', { class: 'vbg-row' + (x.id === CFG.vbg.pick ? ' on' : ''), 'data-vid': x.id },
      h('div', { class: 'vbg-n' }, h('b', {}, x.name), h('span', { class: 'tiny muted' }, VBG.gone.has(x.id) ? 'cannot be played here' : fmt(x))),
      h('button', { class: 'btn sm' + (x.id === CFG.vbg.pick ? ' on' : ''), title: 'Show this one', onclick: () => { vbgUse(x.id); paint(); } }, x.id === CFG.vbg.pick ? '● Showing' : '▶ Use'),
      h('button', { class: 'btn sm', title: 'Remove it from this device', 'aria-label': 'Remove ' + x.name, onclick: async () => { await vbgRemove(x.id); paint(); } }, '✕'))));
    add.disabled = L.length >= VBG_MAX;
  }
  const add = h('button', { class: 'btn primary', id: 'vbgAdd', onclick: () => pick.click() }, '＋ Add videos…');
  const range = (k, lo, hi, label, tip) => h('label', { class: 'lrow', style: { gap: '8px', alignItems: 'center' }, title: tip }, h('span', { style: { width: '120px' } }, label),
    h('input', { type: 'range', min: lo, max: hi, step: .05, value: CFG.vbg[k], 'data-vbg': k, style: { flex: 1 }, oninput: e => { CFG.vbg[k] = +e.target.value; saveCfg(); } }));
  const box = h('div', { class: 'vbg-set' },
    h('p', { class: 'tiny muted', style: { margin: '0 0 10px', lineHeight: 1.5 } }, 'Your own video loops as a look behind you. They play without sound and fill the picture; with Camera look ▸ Me in front you stand inside them. On the Visuals, the Stage and in recorded videos.'),
    h('div', { class: 'row', style: { gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, add, pick, h('button', { class: 'btn', id: 'vbgShow', onclick: () => { vzSetMode('video'); try { dockGo('vis'); } catch (e) { } } }, 'Show Your video now')),
    listEl,
    h('h5', { style: { margin: '12px 0 4px' } }, 'With the music'),
    h('div', { class: 'row', style: { gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, h('span', { class: 'tiny muted' }, 'Change video'),
      h('div', { class: 'seg', role: 'group', id: 'vbgCycle' }, VBG_CYCLES.map(([v, t]) => h('button', { type: 'button', class: CFG.vbg.cycle === v ? 'on' : '', 'data-v': v, onclick: e => { CFG.vbg.cycle = v; saveCfg(); $$('button', e.currentTarget.parentNode).forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, t)))),
    range('tint', 0, 1, 'Tint to the chord', 'How much the video takes the colour of the chord being played'),
    range('dim', 0, .8, 'Darken', 'Darker makes you, the words and the chord stand out'),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'vbgBreathe', checked: !!CFG.vbg.breathe, onchange: e => { CFG.vbg.breathe = e.target.checked; saveCfg(); } }), ' Breathe with the music (brighter when you play loud, a small swell on a strong beat)'),
    h('p', { class: 'tiny muted', style: { margin: '10px 0 0', lineHeight: 1.5 } }, 'How fast they play follows 🎚 Speed. Up to ' + VBG_MAX + ' videos, 300 MB each. They are kept in this browser on this device, are not uploaded and are not part of song backups.'));
  pdlg('vbg', 'YOUR VIDEOS', box, { wide: true });
  paint();
}
