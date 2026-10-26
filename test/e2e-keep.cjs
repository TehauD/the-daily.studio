/* Keeping songs safe: an iPhone or Safari browser tab is told how to protect its songs (Add to Home Screen / Dock) and gets a firm backup
   reminder with a one-tap button; an installed app and Chrome are not nagged. Own browser contexts; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
const iosInit = standalone => `Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' }); Object.defineProperty(navigator, 'standalone', { get: () => ${standalone} });`;
suite('e2e-keep', async t => {
  const { ok, wait, poll } = t;
  const memo = b64 => async () => 0;
  const take = (p, kind) => p.evaluate(async ({ b64, kind }) => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); await window.__daily.dropTake(new File([u], 'Memo.wav', { type: 'audio/wav' }), kind); }, { b64: t.wav(t.tone(3, 200, { voice: true }).data, 22050).toString('base64'), kind });
  const more = p => p.click('.mmore');

  // Safari on an iPhone, in a browser tab
  const p = await t.open({ w: 390, h: 844, mobile: true, init: new Function(iosInit(false)) });
  ok(await p.evaluate(() => /iPhone/.test(navigator.userAgent) && window.__daily.keepRisk().level === 'high'), 'an iPhone browser tab is recognised as the exposed case');
  await more(p); await wait(500); const tiles = await p.$$eval('.msheet .mtile', e => e.map(x => x.textContent.trim()));
  ok(['My songs', 'Open a file', 'Keep songs safe'].every(x => tiles.includes(x)) && tiles.some(x => /Master/.test(x)), 'More has My songs, Open a file, Master · balance · click and Keep songs safe ' + JSON.stringify(tiles.slice(0, 14)));
  await p.click('.msheet .mtile:has-text("Keep songs safe")'); ok(await poll(() => p.$('#keepDlg #keepCard'), 4000), 'Keep songs safe opens a card');
  const txt = await p.$eval('#keepCard', e => e.textContent); ok(/Add to your Home Screen/.test(txt) && /Share/.test(txt) && /Add to Home Screen/.test(txt) && /about a week/.test(txt), 'it explains why, and gives the Share ▸ Add to Home Screen steps');
  ok(!!(await p.$('#keepBackup')), 'it has a one-tap “Back up all songs” button'); await p.evaluate(() => document.getElementById('keepDlg').close());
  await take(p, 'vox'); ok(await poll(() => p.$('.keep-toast'), 4000), 'the first recording shows the Home Screen tip, with a How button');
  await p.click('.keep-toast button:has-text("How")'); ok(await poll(() => p.$('#keepDlg'), 3000), 'How opens the steps'); await p.evaluate(() => document.getElementById('keepDlg').close());
  ok(await p.evaluate(() => window.__daily.CFG.keepTip === true), 'the tip is remembered, so it appears only once');
  await more(p); await wait(400); await p.click('.msheet .mtile:has-text("My songs")'); ok(await poll(() => p.$('.pd-lib #keepCard'), 4000), 'the song library carries the same card');
  ok(await p.evaluate(() => !/\bnull\b|undefined/.test(document.querySelector('.pd-lib').innerText)), 'no stray “null” or “undefined” in the library');
  await p.evaluate(() => { const d = document.getElementById('library'); if (d) d.close(); });
  // the reminder: real work and no backup for a week → a toast with a Back up now button that saves the zip, then quiet
  await p.evaluate(() => { const D = window.__daily; D.CFG.lastBackup = Date.now() - 9 * 864e5; D.CFG.nudgeAt = 0; D.PRJ.list.forEach(r => { r.nTakes = 1; }); D.projNudge(10); });
  ok(await poll(() => p.$('.keep-toast button:has-text("Back up now")'), 4000), 'with real work and no backup for a week, a reminder with a Back up now button appears');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('.keep-toast button:has-text("Back up now")')]); ok(/backup.*\.zip$/.test(dl.suggestedFilename()), 'Back up now saves one zip of all songs (' + dl.suggestedFilename() + ')');
  await p.evaluate(() => { const D = window.__daily; D.projNudge(10); }); await wait(600); ok(!(await p.$('.keep-toast button:has-text("Back up now")')), 'the reminder does not come back for a week');

  // the same iPhone as an installed app: no warning
  const q = await t.open({ w: 390, h: 844, mobile: true, init: new Function(iosInit(true)) });
  ok(await q.evaluate(() => window.__daily.keepRisk().level !== 'high'), 'an app added to the Home Screen is not warned'); await take(q, 'vox'); await wait(800); ok(!(await q.$('.keep-toast')), 'and it gets no Home Screen tip');

  // desktop Chrome
  const c = await t.open({ w: 1300, h: 800 }); const lvl = await c.evaluate(() => window.__daily.keepRisk()); ok(lvl.level === 'ok' || lvl.level === 'low', 'Chrome on a desktop is not told to add itself anywhere (' + lvl.level + ')');
  ok(await c.evaluate(() => { const d = window.__daily.keepCard(); return d.tagName === 'DIV' && (/Last backup/.test(d.textContent)); }), 'it just shows the last-backup line');
});
