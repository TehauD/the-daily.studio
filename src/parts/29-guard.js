/* ============================================================
   Part 29 · GUARD — a last line of defence: an unexpected error tells you plainly, once in a while, that your songs are safe
   (they are saved on every change). Browser noise that is not a real fault is ignored.
   ============================================================ */
const GUARD = { at: 0, n: 0, log: [], t0: Date.now() };
/* ---------- the problem log (2.19.1): the last 20 errors and warnings, in memory only ----------
   Nothing is sent anywhere. Help ▸ Report a problem copies a report the person can paste into a GitHub issue. Messages are made
   safe first: quoted names (a song, a file, a device) become “…”, addresses and long numbers are shortened. */
const GUARD_MAX = 20;
function guardClean(s) {
  return String(s == null ? '' : s).replace(/[“"'‘][^“”"'‘’\n]{1,80}[”"'’]/g, '“…”').replace(/blob:[^\s)]+/g, 'blob:…').replace(/https?:\/\/(?!the-daily\.studio)[^\s)]+/g, 'https://…').replace(/\s+/g, ' ').trim().slice(0, 300);
}
function guardLog(level, a) {
  try {
    const e = a && a.find && a.find(x => x instanceof Error), first = e ? e.message : a.map(x => typeof x === 'string' ? x : x && x.message ? x.message : (() => { try { return JSON.stringify(x); } catch (er) { return String(x); } })()).join(' ');
    const where = e && e.stack ? String(e.stack).split('\n').slice(1, 3).map(l => l.trim().replace(/\(?(?:blob|https?):[^)]*\/([^/)]*)\)?/g, '$1')).join(' · ') : '';
    GUARD.log.push({ t: Date.now(), level, msg: guardClean(first), where: guardClean(where) }); if (GUARD.log.length > GUARD_MAX) GUARD.log.shift();
  } catch (x) { }
}
GUARD.orig = { error: console.error.bind(console), warn: console.warn.bind(console) };
['error', 'warn'].forEach(level => { console[level] = (...a) => { guardLog(level, a); GUARD.orig[level](...a); }; });
function guardReport(err) {
  const msg = String((err && err.message) || err || ''); GUARD.n++;
  if (!msg || /ResizeObserver|AbortError|NotAllowedError|The play\(\) request|Script error|Non-Error promise rejection/i.test(msg)) return;
  guardLog('error', [err instanceof Error ? err : new Error(msg)]); GUARD.orig.warn('[the-daily.studio]', err);      /* an uncaught error is logged as an error */
  if (Date.now() - GUARD.at < 20000) return; GUARD.at = Date.now();
  try { toast(h('span', {}, 'Something went wrong. Your songs are saved on this device. If it keeps happening, reload the page, or ', h('a', { href: '#', id: 'guardReport', onclick: e => { e.preventDefault(); reportCopy(); } }, 'copy a problem report'), ' for a GitHub issue.'), 'warn'); } catch (e) { }
}
/** the report: what was running and on what, and what went wrong; no song, words, file or device names, no tip link */
async function reportText() {
  const L = [], c = E.ctx, ms = v => v == null ? '?' : Math.round(v * 1000) + ' ms', yes = v => v ? 'yes' : 'no';
  L.push('the-daily.studio problem report', 'Version: v' + VERSION + ' · build ' + BUILD, 'Date: ' + new Date().toISOString() + ' (page open ' + Math.round((Date.now() - GUARD.t0) / 60000) + ' min)');
  L.push('Browser: ' + navigator.userAgent);
  L.push('Device: layout ' + (document.body.dataset.form || '?') + ' · screen ' + screen.width + '×' + screen.height + ' @' + (window.devicePixelRatio || 1) + 'x · window ' + innerWidth + '×' + innerHeight + ' · touch ' + yes(navigator.maxTouchPoints > 0) + ' · installed ' + yes(document.body.dataset.pwa === '1') + ' · cores ' + (navigator.hardwareConcurrency || '?') + (navigator.deviceMemory ? ' · memory ' + navigator.deviceMemory + ' GB' : ''));
  L.push('Audio: ' + (c ? c.state + ' · ' + c.sampleRate + ' Hz · base ' + ms(c.baseLatency) + ' · output ' + ms(c.outputLatency) : 'not started') + ' · worklets ' + yes(E.worklet) + ' · zero-delay effects ' + yes(CFG.lowLat !== false) + ' · input ' + (E.hasInput ? 'open (' + ((E.inSettings && E.inSettings.channelCount) || '?') + ' ch)' : 'none') + ' · monitor ' + yes(CFG.monitor) + ' · round trip ' + (CFG.rtt != null ? CFG.rtt + ' ms measured' : 'not measured') + ' · latency hint ' + CFG.hint + (typeof AK !== 'undefined' && AK.killed ? ' · KILLED' : ''));
  L.push('Studio: workspace ' + ((typeof goalNow === 'function' && goalNow() && goalNow().id) || 'none') + ' · look ' + (typeof VZ !== 'undefined' ? VZ.mode : '?') + ' · lens ' + (CFG.lens || '?') + ' · camera ' + yes(typeof CAM !== 'undefined' && CAM.on) + ' · video ' + (typeof srecFmt === 'function' ? srecFmt() + ' ' + srecQ() + 'p' : '?') + ' · recording ' + yes(typeof SREC !== 'undefined' && SREC.on) + ' · playing ' + yes(T.playing) + ' · agents ' + yes(CFG.agents !== false));
  let st = 'unknown'; try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); st = Math.round((e.usage || 0) / 1048576) + ' MB of ' + Math.round((e.quota || 0) / 1048576) + ' MB'; } } catch (e) { }
  L.push('Storage: ' + st + ' · kept for good ' + yes(PRJ.persisted) + ' · database ' + yes(PRJ.db) + ' · songs ' + ((PRJ.list && PRJ.list.length) || '?') + ' · stage pictures ' + ((CFG.show && CFG.show.imgs && CFG.show.imgs.length) || 0) + ' · your videos ' + ((CFG.vbg && CFG.vbg.list.length) || 0));
  L.push('', 'Errors and warnings (newest last, ' + GUARD.log.length + ' kept of ' + GUARD.n + ' errors seen):');
  if (!GUARD.log.length) L.push('  none');
  GUARD.log.forEach(x => L.push('  [' + new Date(x.t).toISOString().slice(11, 19) + '] ' + x.level + ': ' + x.msg + (x.where ? '  (' + x.where + ')' : '')));
  L.push('', 'What I was doing when it happened: ', '', '(This report was made on the device. It has no song titles, words, file names, device names or tip link. Nothing was sent.)');
  return L.join('\n');
}
/** copy the report (or show it to copy by hand where the clipboard is not allowed) */
async function reportCopy() {
  const txt = await reportText();
  try { await navigator.clipboard.writeText(txt); toast('Copied a problem report. Paste it into a new issue on GitHub (Help ▸ Report a problem has the link).', 'ok'); return txt; }
  catch (e) { reportShow(txt); return txt; }
}
function reportShow(txt) {
  const ta = h('textarea', { class: 'in', id: 'reportText', readonly: true, rows: 14, style: { width: '100%', fontFamily: 'var(--mono)', fontSize: '12px' } }); ta.value = txt;
  pdlg('reportDlg', 'PROBLEM REPORT', h('div', {}, h('p', { class: 'tiny muted' }, 'Select it all and copy it, then paste it into a new GitHub issue. Nothing has been sent.'), ta,
    h('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } }, h('a', { class: 'btn', href: BRAND.repo + '/issues/new', target: '_blank', rel: 'noopener noreferrer' }, 'Open a GitHub issue ↗'))), { wide: true });
  setTimeout(() => { ta.focus(); ta.select(); }, 50);
}
window.addEventListener('error', e => guardReport(e.error || e.message));
window.addEventListener('unhandledrejection', e => guardReport(e.reason));
