/* ============================================================
   Part 73g · the ways into Shower mode (part 73f): hold the logo for two seconds, or type "shower".
   Kept in the core on its own because on the hosted site Shower mode is a room (part 00): the door has to be there before the room is.
   ============================================================ */
/* ---------- the ways in: hold the logo, or type "shower" ---------- */
{
  let hold = 0, x0 = 0, y0 = 0; const cancel = () => { clearTimeout(hold); hold = 0; const b = document.querySelector('header .brand'); if (b) b.classList.remove('shw-fog'); };
  document.addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('header .brand'); if (!b) return; x0 = e.clientX; y0 = e.clientY; clearTimeout(hold);
    setTimeout(() => { if (hold) b.classList.add('shw-fog'); }, 700); hold = setTimeout(() => { hold = 0; b.classList.remove('shw-fog'); showerOpen(); }, 2000); });
  document.addEventListener('pointermove', e => { if (hold && Math.hypot(e.clientX - x0, e.clientY - y0) > 12) cancel(); });
  ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => { if (hold) cancel(); }));
  document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('header .brand')) e.preventDefault(); });      /* a long press on a phone is ours, not the menu's */
  let typed = ''; window.addEventListener('keydown', e => {
    const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))) { typed = ''; return; }
    if (!/^[a-z]$/i.test(e.key)) { typed = ''; return; } typed = (typed + e.key.toLowerCase()).slice(-6);
    if (typed === 'shower') { typed = ''; e.preventDefault(); e.stopImmediatePropagation(); showerOpen(); }      /* the R that ends it does not arm recording */
  }, true);
}
