/* ============================================================
   Part 0 · BEFORE THE FIRST PAINT (2.49.1)
   The first page used to show the first-visit card (and the default theme) for a moment before the studio, once started, swapped in
   Welcome back and the person's own theme: a flash of the wrong page. Now the card stays hidden (styles.css: html:not(.ds-booted))
   until boot has laid it out, and this sets the saved light or dark at once, so the first thing anyone sees is their own page.
   A first visit always opens on the dark green start page (#boot.boot-first); Welcome back follows the person's own light or dark.
   It only reads this browser's own settings; a fallback shows the card after five seconds even if boot never finishes.
   ============================================================ */
(() => {
  try {
    const r = document.documentElement, c = JSON.parse(localStorage.getItem('fw.cfg') || 'null') || {}, sys = (() => { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } })();
    const mode = c.lookMode === 'auto' ? (sys ? 'dark' : 'light') : (c.lookMode === 'dark' || c.lookMode === 'light' ? c.lookMode : c.theme === 'dark' ? 'dark' : 'light');
    r.dataset.theme = mode; r.style.colorScheme = mode;
    /* a first visit always opens on the dark green start page; someone coming back gets Welcome back in their own light or dark */
    const first = localStorage.getItem('fw.started') !== 'true', b = document.getElementById('boot'); if (first && b) b.classList.add('boot-first');
  } catch (e) { }
  setTimeout(() => document.documentElement.classList.add('ds-booted'), 5000);
})();
