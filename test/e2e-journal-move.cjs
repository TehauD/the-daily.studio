/* The Daily at its own address (2.50), and moving a journal there. The two real addresses, https://the-daily.studio and
   https://journal.the-daily.studio, are answered in the browser from the built site through the site's own Worker (worker/index.mjs), so the
   browser keeps each address's storage apart exactly as it will on the live site. No network is used. */
const { suite } = require('./lib.cjs');
const fs = require('node:fs'), path = require('node:path');
const DIST = path.join(__dirname, '..', 'dist'), SITE = 'https://the-daily.studio', J = 'https://journal.the-daily.studio';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
/** what the site's assets answer for a path (as Cloudflare's: /x/ → x/index.html, /x → x.html, otherwise the not-found page) */
function assetResponse(p) {
  const tries = p.endsWith('/') ? [p + 'index.html'] : [p, p + '.html', p + '/index.html'];
  for (const t of tries) { const f = path.join(DIST, t); if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) return new Response(fs.readFileSync(f), { status: 200, headers: { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' } }); }
  return new Response(fs.readFileSync(path.join(DIST, '404.html')), { status: 404, headers: { 'Content-Type': TYPES['.html'] } });
}
const SEED = { kv: [{ k: 'daily:entry:2026-11-01', v: '{"text":"Wrote the bridge"}' }, { k: 'daily:entry:2026-11-02', v: '{"text":"Recorded the vocal"}' }], meta: [{ k: 'migratedAt', v: 'fresh' }], ls: { 'daily:settings': '{"theme":"dark"}', 'daily.workspace.v1': '{"w":1}' } };

suite('e2e-journal-move', async t => {
  const { ok, wait } = t;
  const { handle } = await import(path.join(__dirname, '..', 'worker', 'index.mjs'));
  const ENV = { ASSETS: { fetch: req => assetResponse(new URL(req.url).pathname) } };
  const ctx = async () => {
    const c = await t.fresh({ w: 1100, h: 800 });
    await c.route(u => /^https:\/\/(journal\.)?the-daily\.studio\//.test(u.href) || /^https:\/\/evil\.example\//.test(u.href), async route => {
      const u = new URL(route.request().url());
      if (u.host === 'evil.example' || u.pathname === '/__blank') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>blank</title>' });      /* a page to set storage up from, and a stranger's site */
      const r = await handle(new Request(u.href), ENV);
      route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
    });
    return c;
  };
  const store = (pg) => pg.evaluate(() => new Promise(res => { const ls = Object.keys(localStorage).filter(k => k.startsWith('daily')).sort(); const rq = indexedDB.open('the-daily');
    rq.onupgradeneeded = () => { rq.transaction.abort(); res({ ls, kv: [], none: true }); };
    rq.onsuccess = () => { const db = rq.result; if (!db.objectStoreNames.contains('kv')) { db.close(); return res({ ls, kv: [] }); } const g = db.transaction('kv').objectStore('kv').getAll(); g.onsuccess = () => { db.close(); res({ ls, kv: g.result.map(x => x.k + '=' + x.v).sort() }); }; };
    rq.onerror = () => res({ ls, kv: [], err: true }); }));

  /* ---- someone with a journal at the old address ---- */
  const c = await ctx(), old = await c.newPage();
  await old.goto(SITE + '/__blank');
  await old.evaluate(s => new Promise(res => { Object.entries(s.ls).forEach(([k, v]) => localStorage.setItem(k, v)); const rq = indexedDB.open('the-daily', 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore('kv', { keyPath: 'k' }); rq.result.createObjectStore('meta', { keyPath: 'k' }); };
    rq.onsuccess = () => { const tx = rq.result.transaction(['kv', 'meta'], 'readwrite'); s.kv.forEach(r => tx.objectStore('kv').put(r)); s.meta.forEach(r => tx.objectStore('meta').put(r)); tx.oncomplete = () => { rq.result.close(); res(); }; }; }), SEED);
  await old.goto(SITE + '/journal/'); await wait(600);
  const what = await old.textContent('#what');
  ok(/has a new address/.test(await old.textContent('h1')) && /2 saved items and 2 settings/.test(what), 'the old address explains the move and finds the journal kept there (' + what.slice(0, 70) + '…)');
  const [pop] = await Promise.all([old.waitForEvent('popup'), old.click('button:has-text("Move my journal")')]);
  await pop.waitForLoadState(); await t.poll(() => old.evaluate(() => /^Moved:/.test(document.getElementById('say').textContent)), 8000);
  const say = await old.textContent('#say');
  ok(pop.url() === J + '/move/' && /Moved: 2 saved items and 2 settings/.test(say), 'Move my journal opens the new address and hands the journal over (' + say.slice(0, 60) + ')');
  const NEWS = await store(pop);
  ok(NEWS.kv.join('|') === SEED.kv.map(x => x.k + '=' + x.v).sort().join('|') && NEWS.ls.join() === Object.keys(SEED.ls).sort().join(), 'the journal’s entries and settings are now kept at journal.the-daily.studio, exactly as they were');
  ok(/Your journal is here now/.test(await pop.textContent('#say')) && await pop.isVisible('#open'), 'the new address says so, with a button to open The Daily');
  ok((await store(old)).kv.length === 2, 'nothing at the old address is removed until the person chooses');
  await old.click('button:has-text("Remove the old copy")'); await wait(500);
  const OLDS = await store(old);
  ok(!OLDS.ls.length && (OLDS.none || !OLDS.kv.length), 'Remove the old copy clears the journal from the old address, so it is kept in one place only');
  ok((await store(pop)).kv.length === 2, 'and the new address still has it');

  /* the receiving page listens only to the old address, and only to the page that opened it */
  const ev = await c.newPage(); await ev.goto('https://evil.example/');
  const [p2] = await Promise.all([ev.waitForEvent('popup'), ev.evaluate(() => { window.__w = window.open('https://journal.the-daily.studio/move/', 'm2'); })]);
  await p2.waitForLoadState(); await wait(300);
  await ev.evaluate(() => window.__w.postMessage({ type: 'move', kv: [{ k: 'daily:entry:evil', v: 'x' }], meta: [], ls: { 'daily:evil': 'x' } }, '*')); await wait(600);
  const E = await store(p2);
  ok(!E.kv.some(x => /evil/.test(x)) && !E.ls.includes('daily:evil'), 'a page on another site cannot hand anything to the new address');
  const direct = await c.newPage(); await direct.goto(J + '/move/'); await wait(300);
  ok(/Open the old address/.test(await direct.textContent('#say')), 'opened on its own, the receiving page only points to the old address');

  /* the routes */
  const nf = await c.newPage(), r1 = await nf.goto(SITE + '/journal/move'), r2 = await nf.goto(J + '/guide/');
  ok(r1.status() === 404 && r2.status() === 404, 'the receiving page is not at the old address, and the site’s pages are not at the journal’s');
  const jd = await c.newPage(), je = []; jd.on('pageerror', e => je.push(e.message)); await jd.goto(J + '/'); await wait(1500);
  ok(/The Daily/.test(await jd.title()) && !je.length, 'journal.the-daily.studio opens The Daily, without script errors' + (je.length ? ': ' + je[0] : ''));
  await c.close();

  /* ---- someone without a journal there is simply taken to the new address ---- */
  const c2 = await ctx(), fresh = await c2.newPage();
  await fresh.goto(SITE + '/journal/'); await t.poll(() => fresh.url() === J + '/', 6000);
  ok(fresh.url() === J + '/', 'with no journal at the old address, /journal/ goes straight to journal.the-daily.studio');
  ok((await store(fresh)).kv.length === 0, 'and nothing was made at either address on the way');
  await c2.close();
});
