/* ============================================================
   Part 92 · Soundprint's door (2.61): a soundprint link in the address opens it. The Soundprint itself (part 93) is a room,
   loaded the first time it is used; prtOpen here is the core's stand-in for it (part 00).
   ============================================================ */
function prtFromHash() {
  const m = /^#p=(1[zr][A-Za-z0-9_-]+)$/.exec(location.hash || ''); if (!m) return false;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
  Promise.resolve(prtOpen({ link: m[1] })).catch(e => toast('That soundprint could not be opened: ' + (e.message || e) + '.', 'warn')); return true;
}
setTimeout(prtFromHash, 450);
window.addEventListener('hashchange', () => { prtFromHash(); });
