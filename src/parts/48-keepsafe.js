/* ============================================================
   Part 48 · Keeping your songs safe
   Everything lives in this browser. Safari (iPhone, iPad and Mac) clears a website's storage after about a week without a visit unless the
   site is added to the Home Screen or Dock, and any browser may clear it when the disk is nearly full. This part says so plainly, once,
   where it matters, shows the steps, and makes the backup one tap.
   ============================================================ */
const KEEP = { shown: false };
function keepEnv() {
  const ua = navigator.userAgent || '', ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /Safari\//.test(ua) && !/(Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg|OPR|Android)\//.test(ua);
  const standalone = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  return { ios, safari, standalone };
}
/** how exposed this browser is: 'high' (iPhone / iPad in a browser tab) · 'med' (Safari on a Mac) · 'low' (storage not marked permanent) · 'ok' */
function keepRisk() {
  const e = keepEnv();
  if (e.ios && !e.standalone) return { level: 'high', kind: 'ios', env: e };
  if (e.safari && !e.standalone) return { level: 'med', kind: 'safari', env: e };
  if (typeof PRJ !== 'undefined' && PRJ.persisted === false) return { level: 'low', kind: 'browser', env: e };
  return { level: 'ok', kind: 'ok', env: e };
}
function keepText(r) {
  r = r || keepRisk();
  if (r.kind === 'ios') return { title: 'Add to your Home Screen to keep your songs', why: 'On iPhone and iPad, Safari clears a website’s saved data after about a week without a visit. An app on the Home Screen is not cleared.', steps: ['Tap the Share button in Safari (the square with an arrow).', 'Choose “Add to Home Screen”, then “Add”.', 'Open the-daily.studio from that icon. Your songs stay with it.'] };
  if (r.kind === 'safari') return { title: 'Add to the Dock, and keep a copy', why: 'Safari on a Mac clears a website’s saved data after about a week without a visit, unless the site is added to the Dock.', steps: ['In Safari, choose File ▸ Add to Dock.', 'Open the-daily.studio from the Dock icon.', 'Press “Back up all songs” now and then, as well.'] };
  if (r.kind === 'browser') return { title: 'Keep a copy of your songs', why: 'This browser has not promised to keep your songs if the disk fills up. A backup is one file.', steps: ['Press “Back up all songs”.', 'Keep the zip somewhere safe. “Open a file” brings it back.'] };
  return null;
}
/** the card shown in the song library (and the Home Screen sheet): a short reason, the steps, one button */
function keepCard(opt) {
  opt = opt || {}; const r = keepRisk(), t = keepText(r), last = CFG.lastBackup ? new Date(CFG.lastBackup).toLocaleDateString() : 'never';
  if (!t) return h('div', { class: 'tiny muted', id: 'keepCard', style: { margin: '-2px 0 8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, h('span', {}, '🛡 Your browser keeps this library · Last backup: ' + last), h('button', { class: 'btn sm', id: 'keepBackup', title: 'One .zip with every song in its own folder', onclick: async () => { const ok = await projExportAll(); if (ok && opt.onDone) opt.onDone(); } }, '⤓ Back up all songs'));
  return h('div', { class: 'keep ' + r.level, role: 'note', id: 'keepCard' }, h('b', {}, t.title), h('p', { class: 'muted' }, t.why),
    h('ol', {}, t.steps.map(x => h('li', {}, x))),
    h('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } }, h('button', { class: 'btn sm primary', id: 'keepBackup', onclick: async () => { const ok = await projExportAll(); if (ok && opt.onDone) opt.onDone(); } }, '⤓ Back up all songs'), h('span', { class: 'tiny muted' }, 'Last backup: ' + last)));
}
function keepOpen() {
  const body = h('div', { class: 'keep-dlg' }, keepCard({ onDone: () => { const d = document.getElementById('keepDlg'); if (d) d.close(); } }), keepRisk().level === 'ok' ? h('p', { class: 'muted' }, 'This browser keeps your songs. A backup is still a good habit before you clear browser data or change devices.') : '',
    h('div', { class: 'row', style: { gap: '8px', marginTop: '10px' } }, h('button', { class: 'btn sm', onclick: () => { const d = document.getElementById('keepDlg'); if (d) d.close(); libraryOpen(); } }, '☰ My songs'), h('span', { class: 'grow' })));
  return pdlg('keepDlg', 'Keep my songs safe', body, {});
}
/** a toast with one button, kept up long enough to act on */
function keepToast(msg, label, fn, tries) {
  const box = $('#toasts'); if (!box) return toast(msg, 'warn');
  if (document.querySelector('dialog[open]:not(.humbar)') && (tries || 0) < 8) return void setTimeout(() => keepToast(msg, label, fn, (tries || 0) + 1), 4000);       // a window is open: wait, the toast would sit behind it
  const t = h('div', { class: 'toast warn keep-toast', role: 'status' }, h('span', {}, msg), h('button', { class: 'btn sm', onclick: () => { t.remove(); fn(); } }, label), h('button', { class: 'btn sm ghost', 'aria-label': 'Dismiss', onclick: () => t.remove() }, '✕'));
  box.append(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 14000);
}
/** the rare reminder: only with real work and no recent backup. Sooner on Safari, where the browser is the more likely to clear it. */
function projNudge(delay) {
  setTimeout(() => {
    try {
      const r = keepRisk(), real = PRJ.list.some(x => x.nTakes || x.track) || PRJ.list.length > 2, day = 864e5, now = Date.now(), gap = (r.level === 'high' || r.level === 'med' ? 7 : 30) * day;
      if (real && (!CFG.lastBackup || now - CFG.lastBackup > gap) && (!CFG.nudgeAt || now - CFG.nudgeAt > 7 * day)) {
        CFG.nudgeAt = now; saveCfg();
        keepToast(r.level === 'high' ? 'Your recordings live only in this browser tab, and Safari clears them after a week away. Back them up now?' : 'It has been a while since your last backup. Back up your songs now?', 'Back up now', () => { projExportAll(); });
      }
    } catch (e) { }
  }, delay == null ? 25000 : delay);
}
/** the first time a recording exists on an iPhone or iPad that is not installed */
bus.on('takes', () => {
  if (KEEP.shown || CFG.keepTip || !TAKES.length) return; const r = keepRisk(); if (r.level !== 'high') return;
  KEEP.shown = true; CFG.keepTip = true; saveCfg(); keepToast('Add the-daily.studio to your Home Screen so Safari does not clear your recordings.', 'How', keepOpen);
});
