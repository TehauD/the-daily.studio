/* ============================================================
   Part 05c · One dialog for the header's buttons: ▦ Workspace, ◐ Appearance, ⚙ Settings and ? Help.
   They share one shape so they feel like one place: a header (icon, title, one line saying what it is for, ✕), a list of
   sections down the left (chips along the top on a phone) and the sections themselves as cards in one scrolling column.
   Every section stays in the page, so a link to a section simply scrolls there, and the list follows the scroll.
   ============================================================ */
/**
 * hubOpen(id, o) → the open <dialog>
 *   o.ico · o.title · o.sub      the header
 *   o.sections                    [{ key, label, ico, sub, body: () => Node | Node[] , wide }]  (wide: one column inside the card)
 *   o.at                          the section to open on
 *   o.foot                        Node for the footer (optional)
 *   o.preview                     no dimming behind (Appearance: you watch the app change)
 */
/** 2.66: a hub, or the coach, drawn in a panel instead of a dialog: a div that answers open / showModal / close as a dialog does, so the
    code written for the dialog (and anything that asks whether it is open) works on it unchanged. close hides it and fires 'close'. */
function hubInline(d) {
  if (d._inline) return d; d._inline = true;
  Object.defineProperty(d, 'open', { configurable: true, get: () => !d.hidden && d.isConnected });
  d.showModal = d.show = () => { d.hidden = false; };
  d.close = () => { if (d.hidden) return; d.hidden = true; d.dispatchEvent(new Event('close')); };
  return d;
}
function hubOpen(id, o) {
  let d = document.getElementById(id); const host = o.into || null;
  if (d && !!host !== !!d._inline) { try { if (d.open) d.close(); } catch (e) { } d.remove(); d = null; }      /* moved between a dialog and a panel (a phone turned into a tablet) */
  if (d && d.open) { try { d.close(); } catch (e) { } }
  if (!d) { d = host ? hubInline(h('div', { id, role: 'region' })) : h('dialog', { id }); (host || document.body).append(d); }
  if (host) { if (d.parentNode !== host) host.append(d); [...host.children].forEach(x => { if (x !== d && x._inline && x.open && x.classList.contains('hub')) x.close(); }); }      /* one hub at a time in a panel */
  d.className = 'hub' + (host ? ' hub-inline' : '') + (o.preview ? ' hub-preview' : ''); d.innerHTML = ''; d.setAttribute('aria-labelledby', id + '-t');
  const body = h('div', { class: 'hub-body' }), nav = h('nav', { class: 'hub-nav', 'aria-label': o.title + ' sections' });
  const secs = o.sections.filter(Boolean);
  secs.forEach(s => {
    const kids = [].concat(s.body ? s.body() : []).filter(Boolean);
    body.append(h('section', { class: 'hub-sec', id: id + '-' + s.key, 'data-sec': s.key, 'aria-labelledby': id + '-' + s.key + '-h' },
      h('div', { class: 'hub-sh' }, h('h3', { id: id + '-' + s.key + '-h' }, s.label), s.sub ? h('p', {}, s.sub) : null),
      h('div', { class: 'hub-card' + (s.wide ? ' wide' : '') }, ...kids)));
    nav.append(h('button', { type: 'button', class: 'hub-nb', 'data-sec': s.key, onclick: () => hubGo(d, s.key, true) }, h('span', { class: 'hub-ni', 'aria-hidden': 'true' }, s.ico || '•'), h('span', {}, s.label)));
  });
  /* o.links: more places in the list that open something else (another hub in the same panel) */
  if (o.links && o.links.length) { nav.append(h('div', { class: 'hub-nsep', 'aria-hidden': 'true' })); o.links.forEach(l => nav.append(h('button', { type: 'button', class: 'hub-nb hub-nl', id: l.id || null, onclick: l.fn }, h('span', { class: 'hub-ni', 'aria-hidden': 'true' }, l.ico || '→'), h('span', {}, l.label)))); }
  d.append(
    h('header', { class: 'hub-h' }, h('span', { class: 'hub-ico', 'aria-hidden': 'true' }, o.ico), h('div', { class: 'hub-ht' }, h('h2', { id: id + '-t' }, o.title), o.sub ? h('p', {}, o.sub) : null),
      o.back ? h('button', { type: 'button', class: 'btn sm hub-back', id: id + '-back', onclick: o.back.fn }, o.back.label) : host ? null : h('button', { type: 'button', class: 'hub-x', 'aria-label': 'Close', title: 'Close (Esc)', onclick: () => d.close() }, '✕')),
    h('div', { class: 'hub-main' }, nav, body));
  if (o.foot) d.append(h('footer', { class: 'hub-f' }, o.foot));
  body.addEventListener('scroll', () => hubSpy(d), { passive: true });
  if (!host) d.addEventListener('click', e => { if (e.target === d) d.close(); });   // a click on the backdrop closes it
  if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  hubGo(d, o.at || secs[0].key, false); return d;
}
/** scroll to a section (smoothly when asked by a click) and light it in the list */
function hubGo(d, key, smooth) {
  const sec = d.querySelector('.hub-sec[data-sec="' + key + '"]'), body = d.querySelector('.hub-body'); if (!sec || !body) return;
  d._hubLock = Date.now() + (smooth ? 600 : 0);
  { const top = Math.max(0, sec.offsetTop - body.offsetTop - 4); if (body.scrollTo) body.scrollTo({ top, behavior: smooth && !CFG.reduce ? 'smooth' : 'auto' }); else body.scrollTop = top; } hubMark(d, key);
}
function hubMark(d, key) { d.querySelectorAll('.hub-nb').forEach(b => { const on = b.dataset.sec === key; b.classList.toggle('on', on); if (on) { b.setAttribute('aria-current', 'true'); if (b.scrollIntoView && b.parentElement.scrollWidth > b.parentElement.clientWidth) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } else b.removeAttribute('aria-current'); }); }
function hubSpy(d) {
  if (d._hubLock && Date.now() < d._hubLock) return; const body = d.querySelector('.hub-body'); if (!body) return;
  const top = body.scrollTop + body.offsetTop + 40, secs = [...d.querySelectorAll('.hub-sec')]; let cur = secs[0];
  secs.forEach(s => { if (s.offsetTop <= top) cur = s; });
  if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) cur = secs[secs.length - 1];
  if (cur) hubMark(d, cur.dataset.sec);
}
/** a labelled row for a hub card: the label (and a hint under it) on the left, the control on the right */
function hubRow(label, el, hint) { return h('div', { class: 'hub-row' }, h('div', { class: 'hub-rl' }, h('b', {}, label), hint ? h('span', {}, hint) : null), h('div', { class: 'hub-rc' }, el)); }
