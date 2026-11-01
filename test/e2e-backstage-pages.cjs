/* The hidden pages under /backstage/ (2.23): written by scripts/backstage-pages.mjs into test/out/site (with the fonts and favicon they use) and
   opened from the same origin as the studio, so they see the studio's own storage, as they do on the real site. */
const { suite } = require('./lib.cjs');
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.join(__dirname, '..'), SITE = path.join(__dirname, 'out', 'site');

suite('e2e-backstage-pages', async t => {
  const { ok, wait, poll } = t;
  const { backstagePages } = await import(path.join(ROOT, 'scripts', 'backstage-pages.mjs'));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const { files } = backstagePages({ root: ROOT, version: pkg.version, build: 'abc1234', modified: '2026-11-01', repo: 'https://github.com/TehauD/the-daily.studio', origin: 'https://the-daily.studio', author: 'Tehau DeBarthe' });
  fs.rmSync(SITE, { recursive: true, force: true });
  for (const [rel, text] of files) { fs.mkdirSync(path.dirname(path.join(SITE, rel)), { recursive: true }); fs.writeFileSync(path.join(SITE, rel), text); }
  fs.mkdirSync(path.join(SITE, 'fonts'), { recursive: true }); for (const f of ['inter-latin-wght.woff2', 'montserrat-latin-wght.woff2']) fs.copyFileSync(path.join(ROOT, 'src', 'fonts', f), path.join(SITE, 'fonts', f));
  fs.mkdirSync(path.join(SITE, 'icons'), { recursive: true }); fs.copyFileSync(path.join(ROOT, 'icons', 'favicon.svg'), path.join(SITE, 'icons', 'favicon.svg'));
  const U = t.BASE + 'test/out/site/', html = rel => files.find(f => f[0] === rel)[1];

  /* ---- what any visitor (or crawler) gets ---- */
  const PAGES = ['backstage/index.html', 'backstage/source/index.html', 'backstage/data/index.html', 'backstage/api/index.html', 'backstage/changelog/index.html'];
  ok(PAGES.every(p => /<meta name="robots" content="noindex,nofollow">/.test(html(p))), 'every hidden page says noindex, nofollow');
  ok(PAGES.every(p => { const c = (html(p).match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || ''; return /script-src 'sha256-[A-Za-z0-9+/=]+'/.test(c) && !/unsafe-inline'[^;]*;?\s*$|script-src[^;]*unsafe/.test(c) && /connect-src 'none'/.test(c) && (html(p).match(/<script\b/g) || []).length === 1 && !/<script[^>]+src=/.test(html(p)); }), 'each has one inline script, allowed only by its hash, and may connect nowhere');
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8'), sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  ok(/User-agent: \*\nAllow: \/\n#[^\n]*\nDisallow: \/backstage\//.test(robots) && !/backstage/.test(sitemap), 'robots.txt turns crawlers away from /backstage/, and the sitemap does not list it');
  ok(/There is a door backstage/.test(html('humans.txt')) && /Made by: Tehau DeBarthe/.test(html('humans.txt')), 'humans.txt says who made it, and drops a hint');

  /* ---- no pass: the door ---- */
  const p = await t.open({ boot: false });
  await p.goto(U + 'backstage/'); await wait(400);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.locked')).display !== 'none' && getComputedStyle(document.querySelector('.vault')).display === 'none' && /guest list only/.test(document.querySelector('.locked').textContent)), 'without a pass, the lobby is a closed door that says where to knock');
  await p.evaluate(() => localStorage.setItem('fw.cfg', JSON.stringify({ backstage: true, bksPass: { n: 4321, at: Date.now(), build: 'abc1234' } })));      /* a pass, but no studio here yet */
  await p.goto(U + 'backstage/data/'); await wait(700);
  ok(await p.evaluate(async () => getComputedStyle(document.querySelector('.vault')).display !== 'none' && /No songs in this browser yet/.test(document.getElementById('songs').textContent) && !(await indexedDB.databases()).some(d => d.name === 'the-daily-songs')), 'the data page reads only: where the studio has no database yet, it makes none');

  /* ---- with the studio and a pass ---- */
  await t.boot(p);
  await p.evaluate(async () => { const D = window.__daily; await D.projCreate('blank', { form: 'vc' }); D.S.title = 'Harbour Lights'; D.commit(false); await D.projSave(); localStorage.setItem('fw.ghtok', JSON.stringify({ t: 'ghp_SECRETSECRET', via: 'token' })); window.dailyStudio.backstage(window.dailyStudio.describe().build); });
  await wait(600); const PASS = await p.evaluate(() => window.__daily.CFG.bksPass.n);
  await p.goto(U + 'backstage/'); await wait(500);
  ok(await p.evaluate(n => document.documentElement.classList.contains('bks-in') && getComputedStyle(document.querySelector('.vault')).display !== 'none' && document.querySelector('[data-pass-no]').textContent === '#' + n, PASS), 'with a pass, the lobby opens and shows the pass number (#' + PASS + ')');
  ok(await p.evaluate(() => ['source/', 'data/', 'api/', 'changelog/', '../humans.txt'].every(h => document.querySelector('a.card[href="' + h + '"]')) && document.querySelectorAll('a.card[href^="../#backstage/"]').length >= 6), 'it links to every hidden page, and into the studio’s rooms');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'nothing on it is wider than the window');

  await p.goto(U + 'backstage/source/'); await wait(400);
  const nParts = fs.readdirSync(path.join(ROOT, 'src', 'parts')).filter(f => f.endsWith('.js')).length;
  ok(await p.evaluate(n => document.querySelectorAll('#parts tbody tr').length === n && [...document.querySelectorAll('#parts tbody a')].every(a => /github\.com\/TehauD\/the-daily\.studio\/blob\/main\/src\/parts\//.test(a.href)), nParts), 'the source map lists every one of the ' + nParts + ' parts, each linked to its source');
  await p.fill('#find', 'folder sync'); await wait(200);
  ok(await p.evaluate(() => { const v = [...document.querySelectorAll('#parts tbody tr')].filter(r => !r.hidden); return v.length >= 1 && v.length < 10 && v.some(r => /40-sync\.js/.test(r.textContent)); }), 'and finds a part by what it does');

  await p.goto(U + 'backstage/data/'); await wait(900);
  ok(await p.evaluate(() => /Harbour Lights/.test(document.getElementById('songs').textContent) && /fw\.cfg/.test(document.getElementById('ls').textContent)), 'your data, raw: the songs from IndexedDB and the studio’s keys in local storage');
  await p.evaluate(() => [...document.querySelectorAll('#songs tbody tr')].find(r => /Harbour Lights/.test(r.textContent)).click()); await wait(200);
  ok(await p.evaluate(() => /"title": "Harbour Lights"/.test(document.getElementById('rec').textContent)), 'choosing a song shows its record');
  await p.evaluate(() => [...document.querySelectorAll('#ls tbody tr')].find(r => /fw\.ghtok/.test(r.textContent)).click()); await wait(200);
  ok(await p.evaluate(() => /Not shown, on purpose/.test(document.getElementById('lsv').textContent) && !/SECRETSECRET/.test(document.body.textContent)), 'a GitHub token is never shown');

  await p.goto(U + 'backstage/api/'); await wait(300);
  ok(await p.evaluate(() => ['transpose', 'call <tool> [json]', 'labs [name on|off]'].every(c => document.body.textContent.includes(c)) && /Two ways in/.test(document.body.textContent) && /WebMCP/.test(document.body.textContent)), 'the API page: every Backstage shell command, and the agent API');
  await p.goto(U + 'backstage/changelog/'); await wait(300);
  ok(await p.evaluate(v => document.querySelectorAll('details.rel').length >= 30 && document.querySelector('details.rel .v').textContent === v && document.querySelector('details.rel').open, (fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').match(/^## (\d+\.\d+\.\d+)/m) || [])[1]), 'the changelog: every release as a timeline, the newest open');
  await p.evaluate(() => localStorage.removeItem('fw.ghtok'));
});
