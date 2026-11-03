/* ============================================================
   Part 73e · ON AIR (2.25) — a tribute to the red light outside every studio door
   While a take or a stage video records, the logo in the header and the browser tab's icon blink red, and the tab's title says
   ● REC, so you can tell from any tab that the studio is rolling. One timer drives them all (and the record buttons), so they blink together. Calm and reduced motion get a steady red light, no blinking.
   ============================================================ */
const AIR = { on: false, tm: 0, ph: false, icon: null, red: null, title: '', lagT: 0 };
const AIR_LAG = 120;      /* ms: about how long a browser takes to show a new tab icon */
const airLive = () => !!(REC || (typeof SREC !== 'undefined' && SREC.on) || (typeof SHW !== 'undefined' && SHW.rec));      /* Shower mode's ● too */
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
    /* one clock for every red light: the tab icon, the logo and the record buttons all change on the same tick (body.air-dim is the dark half) */
    /* the browser repaints the tab icon a little after it is changed (the page itself changes at once), so the page follows the icon by
       AIR_LAG ms: the two then flip together as seen */
    const steady = secretCalm(), tick = () => { AIR.ph = steady || !AIR.ph; const ph = AIR.ph; if (link && AIR.red) link.setAttribute('href', ph ? AIR.red : AIR.icon); clearTimeout(AIR.lagT); AIR.lagT = setTimeout(() => { if (AIR.on) document.body.classList.toggle('air-dim', !ph); }, AIR_LAG); };
    AIR.ph = false; tick(); if (!steady) AIR.tm = setInterval(tick, 650);
  } else { clearTimeout(AIR.lagT); document.body.classList.remove('air-dim'); if (link && AIR.icon) link.setAttribute('href', AIR.icon); if (AIR.title) document.title = AIR.title; }
}
bus.on('rec:state', airSync); setInterval(airSync, 500);      /* takes say so; a stage video is noticed within half a second */
