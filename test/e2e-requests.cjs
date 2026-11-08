/* As few requests as possible (2.52). Static files are free on the host and Worker requests are counted, but every request also costs a
   visitor time and data, so: the page is downloaded once on a first visit (the service worker keeps that copy, not a second one); the sample
   shelf is built into the page, so it is never fetched; and on later visits the fonts, icons and code come from the saved copy with no
   request at all, only the page itself being checked for a new version. Also checks the Worker runs only where it has work (wrangler.jsonc)
   and the long cache on files whose names change with their contents. */
const { suite } = require('./lib.cjs');
const fs = require('node:fs'), path = require('node:path');
suite('e2e-requests', async t => {
  const { ok, wait, poll } = t;
  const c = await t.fresh({ w: 1280, h: 800 }), log = [];
  c.on('request', r => { const u = new URL(r.url()); if (u.host.startsWith('localhost')) log.push({ sw: !!r.serviceWorker(), p: u.pathname }); });
  const p = await c.newPage(); await p.goto(t.BASE);
  ok(await poll(() => p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active); }), 15000), 'the service worker is installed on a first visit');
  await wait(1500);
  const first = log.splice(0), page = first.filter(x => x.p === '/' || x.p === '/index.html');
  ok(page.length <= 2 && !first.some(x => x.p === '/index.html'), 'a first visit downloads the page once (once more by the service worker, which the host answers from the browser’s copy), never also as /index.html (' + page.length + ')');
  ok(!first.some(x => /samples\/manifest\.json/.test(x.p)), 'the sample shelf is in the page: no request for it');
  const saved = await p.evaluate(async () => { const ks = await caches.keys(), c = await caches.open(ks[0]); return (await c.keys()).map(r => new URL(r.url).pathname); });
  ok(['/', '/manifest.webmanifest', '/icons/icon-192.png'].every(x => saved.includes(x)) && saved.some(x => /^\/rooms\/tx\.[0-9a-f]{8}\.js$/.test(x)) && saved.some(x => /\/fonts\//.test(x)) && !saved.includes('/index.html'), 'it saves the page once, the icons, the fonts and the rooms for offline use (' + saved.length + ' files)');
  await p.reload(); await wait(2500);
  const second = log.splice(0), net = second.filter(x => x.sw);
  ok(net.length <= 1 && net.every(x => x.p === '/'), 'a later visit asks the network only whether the page has changed; fonts, icons and code come from the saved copy (' + (net.map(x => x.p).join(', ') || 'none') + ')');
  await p.evaluate(async () => { await window.__daily.room('tune'); }).catch(() => { }); await wait(500);
  ok(!log.splice(0).some(x => x.sw && /\/rooms\//.test(x.p)), 'a room is opened from the saved copy, with no request');
  /* the host: the Worker only where it has work, long cache for files whose names change with them */
  const wr = fs.readFileSync(path.join(__dirname, '..', 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''), cfg = JSON.parse(wr), rwf = cfg.assets.run_worker_first;
  ok(Array.isArray(rwf) && rwf.includes('/') && rwf.includes('/journal/*') && rwf.includes('/auth/*') && !rwf.some(x => /^\/\*|^\/fonts|^\/rooms|^\/icons|^\/guide/.test(x)), 'the Worker runs only for the pages that need it; fonts, code, icons and the guide are plain files (' + rwf.length + ' paths)');
  const hd = fs.readFileSync(path.join(__dirname, '..', 'dist', '_headers'), 'utf8');
  ok(/\/rooms\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/.test(hd) && /\/fonts\/\*\n\s+Cache-Control: public, max-age=2592000/.test(hd), 'the rooms (named by their contents) are kept a year, the fonts a month');
});
