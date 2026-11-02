/* ============================================================
   Part 73e · ON AIR (2.25) — a tribute to the red light outside every studio door
   While a take or a stage video records, the logo in the header and the browser tab's icon blink red, and the tab's title says
   ● REC, so you can tell from any tab that the studio is rolling. Calm and reduced motion get a steady red light, no blinking.
   ============================================================ */
const AIR = { on: false, tm: 0, ph: false, icon: null, red: null, title: '' };
const airLive = () => !!(REC || (typeof SREC !== 'undefined' && SREC.on));
/** the tab's icon in red: the same mark, its strokes recoloured */
function airRed(href) {
  try { const svg = decodeURIComponent(href.replace(/^data:image\/svg\+xml,/, '')); return 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/<style>[\s\S]*?<\/style>/, '<style>.h,.i{stroke:#ff2a3d}</style>')); } catch (e) { return href; }
}
function airSync() {
  const on = airLive(); if (on === AIR.on) return; AIR.on = on;
  const link = document.querySelector('link[rel="icon"]'); if (link && !AIR.icon && /^data:image\/svg/.test(link.getAttribute('href') || '')) { AIR.icon = link.getAttribute('href'); AIR.red = airRed(AIR.icon); }
  document.body.classList.toggle('onair', on); clearInterval(AIR.tm); AIR.tm = 0;
  /* the red light, for a screen reader too: one quiet announcement when it goes on and when it goes off */
  let say = document.getElementById('airSay'); if (!say) { say = h('span', { id: 'airSay', class: 'sr-only', role: 'status', 'aria-live': 'polite' }); document.body.append(say); }
  say.textContent = on ? 'On air: recording.' : 'Off air: recording stopped.';
  const mark = document.querySelector('.brand'); if (mark) { if (on) mark.setAttribute('title', 'On air: recording'); else mark.removeAttribute('title'); }
  if (on) {
    AIR.title = document.title.replace(/^● REC · /, ''); document.title = '● REC · ' + AIR.title;
    const steady = secretCalm(), tick = () => { AIR.ph = steady || !AIR.ph; if (link && AIR.red) link.setAttribute('href', AIR.ph ? AIR.red : AIR.icon); };
    AIR.ph = false; tick(); if (!steady) AIR.tm = setInterval(tick, 650);
  } else { if (link && AIR.icon) link.setAttribute('href', AIR.icon); if (AIR.title) document.title = AIR.title; }
}
bus.on('rec:state', airSync); setInterval(airSync, 500);      /* takes say so; a stage video is noticed within half a second */
