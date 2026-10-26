/* ============================================================
   Part 18 · responsive shell: phone / tablet / desktop form factors
   - detects the form factor (or honours Settings → Device layout) and sets body[data-form|data-land|data-touch]
   - phone: compact top bar, bottom transport, section chips + bottom navigation, "More" sheet, collapsible arrangement
   - tablet: two-row header, sidebars become slide-in drawers
   - desktop: untouched (this part only toggles attributes and moves nothing)
   ============================================================ */
const M = { form: 'desktop', g: 'play', s: 'rig', view: 'center', tl: { p: 'mini', l: 'off' }, last: {}, sheet: null, drawer: null };
const MGROUPS = [
  { id: 'play', name: 'Play', ico: '<rect x="4" y="5" width="16" height="14" rx="2.4"/><circle cx="9" cy="12" r="2.2"/><path d="M14.5 10h3M14.5 14h3"/>', subs: [['rig', 'Rig'], ['tones', 'Tones', 'left'], ['tuner', 'Tuner', 'right'], ['io', 'I/O', 'left']] },
  { id: 'write', name: 'Write', ico: '<path d="M4 20l1-4.2L16.2 4.6a1.6 1.6 0 012.2 0l1 1a1.6 1.6 0 010 2.2L8.2 19z"/><path d="M14 7l3 3"/>', subs: [['tab', 'Tab'], ['song', 'Song'], ['refine', 'Refine', 'right'], ['band', 'Band'], ['fret', 'Fretboard'], ['theory', 'Theory', 'left']] },
  { id: 'see', name: 'See', ico: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><circle cx="12" cy="12" r="2.6"/>', subs: [['vis', 'Visuals'], ['stage', 'Stage'], ['neural', 'Neural'], ['cam', 'Vision']] },
  { id: 'stems', name: 'Stems', ico: '<path d="M4 9v6M8 5v14M12 8v8M16 4v16M20 9v6"/>', subs: [['stems', 'Stems'], ['tx', 'Transcribe']] },
  { id: 'more', name: 'More', ico: '<circle cx="5.5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/>', subs: [['lab', 'Research'], ['exp', 'Export']] }
];
const msvg = (inner, sz) => { const s = document.createElement('span'); s.className = 'ico'; s.innerHTML = '<svg viewBox="0 0 24 24" width="' + (sz || 22) + '" height="' + (sz || 22) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'; return s; };
const mGroupOf = sid => MGROUPS.find(g => g.subs.some(s => s[0] === sid));

function detectForm() {
  const pref = CFG.form; if (pref === 'phone' || pref === 'tablet' || pref === 'desktop') return pref;
  const w = innerWidth, hh = innerHeight, coarse = matchMedia('(pointer:coarse)').matches;
  if (w <= 600 || (hh <= 500 && w <= 960)) return 'phone';
  if (w <= 1024 || (coarse && w <= 1400)) return 'tablet';
  return 'desktop';
}

/* the transport row lives in the header on desktop/tablet; on phones the playing buttons move to a bottom bar */
function mMoveTransport(phone) {
  const tr = $('#transport'); if (!tr || !M.trans) return;
  if (!M.kids) M.kids = [...tr.children];
  if (phone) { const k = M.kids.filter(x => !x.classList.contains('metro-more')); M.trans.append(k[0], k[1], k[2], k[3], k[4], k[5], k[6], k[7]); tr.append(k[8], k[9], k[10], k[11], ...M.kids.filter(x => x.classList.contains('metro-more'))); }   // the count-in arrow stays in the header (hidden on phones)
  else tr.append(...M.kids);
}

function applyForm() {
  const f = detectForm(), land = innerWidth > innerHeight, b = document.body, was = M.form;
  b.dataset.form = f; b.dataset.land = land ? '1' : '0'; b.dataset.touch = matchMedia('(pointer:coarse)').matches ? '1' : '0';
  document.documentElement.style.setProperty('--app-h', innerHeight + 'px');
  if (f !== was) {
    M.form = f; mCloseOverlays();
    mMoveTransport(f === 'phone');
    if (f !== 'desktop' && typeof FLOATS !== 'undefined') [...FLOATS.keys()].forEach(id => { try { unfloat(id); } catch (e) { } });
    const l = $('#left'), r = $('#right'); if (l) l.style.visibility = ''; if (r) r.style.visibility = '';
    if (f === 'desktop') { M.view = 'center'; applyLayout(); } else mSync();
    bus.emit('form', f);
  } else if (f !== 'desktop') mSync();
  setTimeout(() => { if (typeof tlSize === 'function') tlSize(); window.dispatchEvent(new Event('fw:fit')); }, 60);
}

/* ---------- navigation model (phone) ---------- */
function mSetView(v) { M.view = v; mSync(); }
function mGo(gid, sid) {
  const g = MGROUPS.find(x => x.id === gid) || MGROUPS[0], s = g.subs.find(x => x[0] === sid) || g.subs.find(x => x[0] === M.last[g.id]) || g.subs[0];
  M.g = g.id; M.s = s[0]; M.last[g.id] = s[0]; CFG.mlast = M.last;
  mCloseOverlays(true);
  if (s[2] === 'left') { M.view = 'left'; const t = $('#left .side-tabs .tab[data-id="' + s[0] + '"]'); if (t) t.click(); }
  else if (s[2] === 'right') { M.view = 'right'; const t = $('#right .side-tabs .tab[data-id="' + (s[0] === 'tuner' ? 'monitor' : s[0]) + '"]'); if (t) t.click(); }
  else { M.view = 'center'; if (DOCK.cur !== s[0]) dockGo(s[0]); }
  mSync();
}
function mSync() {
  const b = document.body; if (!b.dataset.form) return;
  b.dataset.view = M.view; b.dataset.g = M.g; b.dataset.s = M.s; b.dataset.kpad = CFG.kpad === false ? '0' : '1';
  const tlv = mTl();
  b.dataset.tl = (M.view !== 'center' || M.g === 'see') ? 'off' : tlv;
  if (!M.nav) return;
  $$('.mnb', M.nav).forEach(x => x.classList.toggle('on', x.dataset.g === M.g));
  const g = MGROUPS.find(x => x.id === M.g); if (!g) return;
  if (M.subFor !== g.id) { M.subFor = g.id; M.chips.innerHTML = ''; g.subs.forEach(([id, name, tgt]) => M.chips.append(h('button', { class: 'msc', 'data-s': id, role: 'tab', onclick: () => mGo(g.id, id) }, name))); }
  $$('.msc', M.chips).forEach(x => x.classList.toggle('on', x.dataset.s === M.s));
  const on = M.chips.querySelector('.msc.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (M.songBtn) M.songBtn.textContent = '♪ ' + ((S && S.title) || 'Song').slice(0, 14);
  M.tlBtn.textContent = tlv === 'full' ? '▾ Panel' : tlv === 'off' ? '▴ Tracks' : '⤢ Tracks'; M.tlBtn.title = tlv === 'mini' ? 'Give the tracks the whole screen' : tlv === 'full' ? 'Back to the panel (tracks hidden)' : 'Show the tracks';
  M.tlBtn.style.display = M.view === 'center' && M.g !== 'see' ? '' : 'none';
  setTimeout(() => { if (typeof tlSize === 'function') tlSize(); window.dispatchEvent(new Event('fw:fit')); }, 50);
}
const mTl = () => M.tl[document.body.dataset.land === '1' ? 'l' : 'p'];
function mCycleTl() { const k = document.body.dataset.land === '1' ? 'l' : 'p', v = M.tl[k]; M.tl[k] = v === 'mini' ? 'full' : v === 'full' ? 'off' : 'mini'; CFG.mtl = M.tl; saveCfg(); mSync(); }

/* ---------- overlays: More sheet, tablet drawers ---------- */
function mCloseOverlays(keepBack) {
  if (M.sheet) { M.sheet.remove(); M.sheet = null; }
  document.body.classList.remove('d-left', 'd-right', 'sheet-open', 'song-open');
  M.drawer = null;
}
function mDrawer(side) {
  const open = M.drawer === side; mCloseOverlays();
  if (!open) { M.drawer = side; document.body.classList.add('d-' + side); }
}
function mShare() {
  const url = location.href.split('#')[0];
  if (navigator.share) navigator.share({ title: BRAND.name, text: 'A guitar workstation that runs entirely in the browser.', url }).catch(() => { });
  else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => toast('Link copied'), () => toast(url));
  else toast(url);
}
function mSheet() {
  if (M.sheet) { mCloseOverlays(); return; }
  mCloseOverlays();
  const tile = (ico, label, fn, on) => h('button', { class: 'mtile' + (on ? ' on' : ''), onclick: e => { fn(e); } }, ico, h('span', {}, label));
  const stat = h('div', { class: 'mstat' }, (UI.st && UI.st.a.textContent) || '', UI.lat ? h('span', {}, UI.lat.textContent) : null);
  const mon = tile(msvg('<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>'), 'Monitor ' + (CFG.monitor ? 'on' : 'off'), e => { setMonitor(!CFG.monitor); mSheetRefresh(); }, CFG.monitor);
  const wake = tile(msvg('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>'), 'Screen awake ' + (CFG.wake !== false ? 'on' : 'off'), () => { CFG.wake = CFG.wake === false; saveCfg(); wakeSync(); mSheetRefresh(); }, CFG.wake !== false);
  const seg = h('div', { class: 'seg mseg' }, [['auto', 'Auto'], ['phone', 'Phone'], ['tablet', 'Tablet'], ['desktop', 'Desktop']].map(([v, t]) => h('button', { class: (CFG.form || 'auto') === v ? 'on' : '', onclick: () => { CFG.form = v; saveCfg(); applyForm(); mSheetRefresh(); } }, t)));
  const sh = h('div', { class: 'msheet', role: 'dialog', 'aria-label': 'More' },
    h('div', { class: 'mgrab', onclick: () => mCloseOverlays() }),
    stat,
    h('div', { class: 'mgrid' },
      tile(msvg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>'), 'Hum or sing a song', () => { mCloseOverlays(); humOpen(); }),
      tile(msvg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>'), 'Audio · kill switch', () => { mCloseOverlays(); audioOpen(); }),
      tile(msvg('<path d="M21 14.5A8.5 8.5 0 119.5 3a6.7 6.7 0 0011.5 11.5z"/>'), CFG.theme === 'light' ? 'Dark theme' : 'Light theme', () => { setTheme(CFG.theme === 'light' ? 'dark' : 'light'); mSheetRefresh(); }),
      tile(msvg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor"/>'), 'Appearance', () => { mCloseOverlays(); lookOpen(); }),
      mon, wake,
      tile(msvg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2l.4 2.7h4l.4-2.7a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>'), 'Settings', () => { mCloseOverlays(); openSettings(); }),
      tile(msvg('<path d="M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9.5a2.5 2.5 0 115 0c0 1.7-2.5 2-2.5 4M12 17h.01"/>'), 'Help', () => { mCloseOverlays(); openHelp(); }),
      tile(msvg('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'), 'Guided tour', () => { mCloseOverlays(); tourStart(); }),
      tile(msvg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'), 'Save project', () => { exportProject(); }),
      tile(msvg('<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4"/>'), 'Share link', mShare),
      M.installEvt ? tile(msvg('<rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M12 8v7M9 12.5l3 3 3-3"/>'), 'Install app', () => { mInstall(); }) : null,
      document.fullscreenEnabled ? tile(msvg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'), 'Full screen', () => { mCloseOverlays(); mFullscreen(); }) : null
    ),
    h('div', { class: 'mrow' }, h('span', {}, 'Device layout'), seg),
    h('div', { class: 'mfoot' }, BRAND.name + ' v' + VERSION + ' · everything stays on this device')
  );
  M.sheet = sh; document.body.classList.add('sheet-open'); document.body.append(sh);
}
function mSheetRefresh() { if (!M.sheet) return; M.sheet.remove(); M.sheet = null; mSheet(); }
function mFullscreen() { const e = document.documentElement; try { if (document.fullscreenElement) document.exitFullscreen(); else if (e.requestFullscreen) e.requestFullscreen({ navigationUI: 'hide' }).catch(() => toast('Full screen is not available here')); } catch (err) { } }
function mInstall() { const ev = M.installEvt; if (!ev) return; M.installEvt = null; ev.prompt(); ev.userChoice && ev.userChoice.finally(() => { }); mCloseOverlays(); }

/* ---------- build ---------- */
function buildMobile() {
  const app = $('#app'), top = $('#top'); if (!app || !top) return;
  M.trans = h('div', { id: 'mtrans', role: 'group', 'aria-label': 'Transport' });
  M.chips = h('div', { class: 'mchips', role: 'tablist' });
  M.tlBtn = h('button', { class: 'msc tl', title: 'Arrangement: mini → full → hidden', onclick: mCycleTl }, '▴ Tracks');
  M.songBtn = h('button', { class: 'msc song', title: 'Song details: title, artist, tuning, capo, loaded track', onclick: () => { const o = document.body.classList.contains('song-open'); mCloseOverlays(); if (!o) { document.body.classList.add('song-open'); } } }, '♪ Song');
  M.sub = h('div', { id: 'msub' }, M.songBtn, M.chips, M.tlBtn);
  M.nav = h('nav', { id: 'mnav', 'aria-label': 'Sections' }, MGROUPS.map(g => h('button', { class: 'mnb', 'data-g': g.id, onclick: () => mGo(g.id) }, msvg(g.ico), h('span', {}, g.name))));
  M.back = h('div', { id: 'mback', onclick: () => mCloseOverlays() });
  const more = h('button', { class: 'btn icon mmore', title: 'More: theme, settings, help, share', 'aria-label': 'More', onclick: mSheet }, msvg('<circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/>', 20));
  $('#topR').append(more);
  const dl = h('button', { class: 'btn icon mdraw l', title: 'Tones, I/O and theory ([)', 'aria-label': 'Open the Tones panel', onclick: () => mDrawer('left') }, msvg('<path d="M4 6h16M4 12h16M4 18h16"/>', 18));
  const dr = h('button', { class: 'btn icon mdraw r', title: 'Tuner and levels (])', 'aria-label': 'Open the Tuner panel', onclick: () => mDrawer('right') }, msvg('<path d="M12 3v7M8 7l4 4 4-4M5 14h14M7 18h10"/>', 18));
  top.insertBefore(dl, top.firstChild); $('#topR').insertBefore(dr, $('#topR').firstChild);
  app.append(M.trans, M.sub, M.nav, M.back);
  M.tl = Object.assign(M.tl, CFG.mtl && typeof CFG.mtl === 'object' ? CFG.mtl : {}); M.last = CFG.mlast || {};
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && (M.sheet || M.drawer)) mCloseOverlays(); });
  let rt = 0; const fit = () => { clearTimeout(rt); rt = setTimeout(applyForm, 90); };
  window.addEventListener('resize', fit); window.addEventListener('orientationchange', fit);
  bus.on('dock', id => {
    if (M.form === 'desktop' || (typeof SD !== 'undefined' && SD.nat[id])) return; const g = mGroupOf(id); if (!g) return;
    M.g = g.id; M.s = id; M.last[g.id] = id; M.view = 'center'; mSync();
  });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); M.installEvt = e; });
  applyForm();
  if (M.form !== 'desktop') { const init = mGroupOf(DOCK.cur || 'rig'); M.g = init ? init.id : 'play'; M.s = DOCK.cur || 'rig'; mSync(); }
}
