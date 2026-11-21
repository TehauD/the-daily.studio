/* The two big rooms of 2.85: the look worlds (parts 66b–66f) and Backstage (73c, 73d) load the first time they are needed, not with the page.
   Nobody pays for what they do not use: no request for either on a plain start; choosing a world look loads the worlds; knocking loads Backstage, and
   starting the studio already on the list loads it at once; the door (the knock, #backstage, the code) stays in the core and answers a stranger without it. */
const { suite } = require('./lib.cjs');
suite('e2e-lazy-rooms', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1400, h: 860, debug: true }), reqs = [], ev = (f, a) => p.evaluate(f, a), got = re => reqs.some(u => re.test(u));
  p.on('request', r => reqs.push(r.url())); await p.reload(); await t.boot(p); await wait(1500);
  ok(!got(/\/rooms\/worlds\./) && !got(/\/rooms\/backstage\./), 'a plain start asks for neither the worlds nor Backstage (' + reqs.filter(u => /\/rooms\//.test(u)).map(u => u.split('/').pop().split('.')[0]).join(', ') + ' loaded)');
  await ev(() => window.__daily.dockGo('vis')); await wait(800);
  ok(await ev(() => ['wheel', 'tonnetz', 'spiral', 'chladni', 'pitchtrace', 'nxtower', 'nxweb', 'nxjourney', 'vlweb', 'neural'].every(k => document.querySelector('#vzLooks [data-m=' + k + ']')) && ['vlweb', 'spiral', 'neural', 'chladni'].every(k => document.querySelector('#vzLooks [data-m=' + k + ']').classList.contains('has-opts'))), 'the look strip is complete, and marks the looks with options, before the room has loaded');
  const E0 = t.errs.length; await ev(() => window.__daily.vzSetMode('neural', true)); await wait(600);
  ok(got(/\/rooms\/worlds\./), 'choosing a look from the worlds loads the room (' + reqs.filter(u => /\/rooms\/worlds\./.test(u)).length + ' request)');
  await wait(1200); const loaded = await ev(() => typeof window.__daily.VW === 'object' && typeof window.__daily.vlWeb === 'function');
  ok(loaded, 'and its names arrive (the Voice-Leading Web, the Neural Map\'s settings)');
  await ev(() => { window.__daily.CFG.vo = {}; window.__daily.vzDesignOpen(true); }); await wait(500);
  ok(await ev(() => document.querySelectorAll('#vdOpts [data-vo]').length > 20), 'the Neural Map\'s Settings are there once it has arrived');
  await ev(() => { window.__daily.vlSet('vlweb', 'space', 'all'); window.__daily.vzSetMode('vlweb', true); window.__daily.vzDesignOpen(false); }); await wait(1800);
  const lit = await ev(() => { const cv = document.querySelector('#pane-vis canvas'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 13) if (d[i] + d[i + 1] + d[i + 2] > 200) n++; return n; });
  ok(lit > 40 && t.errs.length === E0, 'the look draws (' + lit + ' bright samples, ' + (t.errs.length - E0) + ' new errors)');
  // ---- a fresh visitor who has not been knocking
  const q = await t.open({ w: 1300, h: 800, debug: true }); const rq = []; q.on('request', r => rq.push(r.url())); await q.reload(); await t.boot(q); await wait(1500);
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await q.keyboard.press(k); await wait(500);
  ok(await q.evaluate(() => /guest list only/.test(document.getElementById('toasts').textContent)) && !rq.some(u => /\/rooms\/backstage\./.test(u)), 'the code answers a stranger from the core, without loading Backstage');
  ok(await q.evaluate(() => typeof window.studio === 'undefined') && /Not on the list|guest list/.test(await q.evaluate(() => window.dailyStudio.backstage('wrong'))) && !rq.some(u => /\/rooms\/backstage\./.test(u)), 'a wrong word at the door is turned away from the core too');
  // ---- the knock loads it; the next start loads it at once
  const build = await q.evaluate(() => window.dailyStudio.describe().build), msg = await q.evaluate(b => window.dailyStudio.backstage(b), build); await wait(1500);
  ok(/on the list/.test(msg) && rq.some(u => /\/rooms\/backstage\./.test(u)) && await q.evaluate(() => typeof window.studio === 'object'), 'the right word loads Backstage, and the console toolkit appears');
  await q.evaluate(() => { const d = document.getElementById('backstage'); if (d) d.close(); });
  const rq2 = []; q.on('request', r => rq2.push(r.url())); await q.reload(); await t.boot(q); await wait(2500);
  ok(rq2.some(u => /\/rooms\/backstage\./.test(u)) && await q.evaluate(() => typeof window.studio === 'object'), 'started again on the list, Backstage loads with the page and `studio` is ready');
  await q.keyboard.press('Control+k'); await wait(400); ok(await q.evaluate(() => !!document.getElementById('bkp')), 'and Ctrl K opens the palette');
  await q.keyboard.press('Escape');
  await q.evaluate(() => window.__daily.openSettings('backstage')); await wait(500);
  ok(await q.evaluate(() => !!document.getElementById('bksOnMaster')), 'Settings ▸ Backstage fills in when the room has arrived');
  ok(t.errs.length === E0 && await q.evaluate(() => true), 'no errors (' + t.errs.length + ')');
});
