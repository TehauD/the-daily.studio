/* Send with recordings (2.54): a song link that carries its takes for 7 days. Two people (two browser contexts with their own storage);
   the site's real Worker (worker/index.mjs → worker/share.mjs) answers /share/* with an in-memory bucket, and GitHub's /user is stood in for.
   No network. Checks: what leaves the browser is sealed (the key never does), the takes come back where they were, and what happens when
   recordings run out, are taken back, are tampered with, or the sender isn't signed in. */
const { suite } = require('./lib.cjs');
const path = require('node:path');

suite('e2e-sendrec', async t => {
  const { ok, wait, poll } = t;
  const { handle } = await import(path.join(__dirname, '..', 'worker', 'index.mjs'));
  const { fakeR2 } = await import(path.join(__dirname, 'fake-r2.mjs'));
  const R2 = fakeR2(), seen = [], HOST = new URL(t.BASE).host;
  const ghUser = async (url, init) => /tokA/.test((init.headers || {}).Authorization || '') ? new Response('{"id":101,"login":"tester"}', { headers: { 'Content-Type': 'application/json' } }) : new Response('{}', { status: 401 });
  const wire = async ctx => ctx.route(u => u.host === HOST && u.pathname.startsWith('/share/'), async route => {
    const q = route.request(), body = q.postDataBuffer(); seen.push({ url: q.url(), body: body ? body.toString('latin1') : '', headers: JSON.stringify(q.headers()) });
    const r = await handle(new Request(q.url(), { method: q.method(), headers: q.headers(), body: body && q.method() !== 'GET' ? body : undefined }), { SHARES: R2, ASSETS: { fetch: () => new Response('', { status: 404 }) } }, ghUser);
    route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
  });
  const dev = async () => { const p = await t.open({ boot: false }); await wire(p.ctx); await t.boot(p); return p; };
  const ev = (p, f, a) => p.evaluate(f, a);

  /* ---- someone with a song and a take, signed in ---- */
  const A = await dev(); await wire(A.context ? A.context() : A.ctx);
  const SR0 = 44100, N0 = Math.round(SR0 * 3.2), CLICK = 70000;
  await ev(A, async ({ SR0, N0, CLICK }) => {
    const D = window.__daily; localStorage.setItem('fw.ghtok', JSON.stringify({ t: 'tokA', via: 'token' }));
    await D.projCreate('blank', { form: 'empty' }); D.S.title = 'Harbour Song'; const dry = new Float32Array(N0);
    for (let i = 0; i < N0; i++) dry[i] = .25 * Math.sin(2 * Math.PI * 220 * i / SR0) * Math.min(1, i / 2000); dry[CLICK] = .98;
    D.TAKES.push({ id: 'tk1', kind: 'vox', name: 'Lead vocal', startSec: 2, sr: SR0, g: .8, pan: -.2, mode: 'dry', dur: N0 / SR0, dry, wet: null, cam: [], peaks: D.peaksOf(dry) });
    await D.projSave();
  }, { SR0, N0, CLICK });
  await ev(A, () => window.__daily.slShare()); await wait(500);
  ok(await ev(A, () => /Include my recordings \(1 take, 0:03\)/.test((document.getElementById('srxRow') || {}).textContent || '')), 'the send dialog offers to include the song’s recordings (1 take, 0:03)');
  await ev(A, () => document.getElementById('srxOn').click()); await wait(300);
  ok(await ev(A, () => !!document.getElementById('shareOk') && /recordings you choose to send with a song link are kept on this site, encrypted, for 7 days/.test(document.getElementById('shareOk').textContent) && !document.getElementById('srxOn').checked), 'the first time, it asks for the sharing terms (which now say recordings are kept, encrypted, for 7 days), and sends nothing until then');
  await ev(A, () => { document.getElementById('shareOkChk').click(); document.getElementById('shareOkGo').click(); });
  ok(await poll(() => ev(A, () => /^✓/.test(document.getElementById('srxSay').textContent)), 20000), 'they are compressed, sealed and sent: ' + await ev(A, () => document.getElementById('srxSay').textContent.slice(0, 90)));
  await poll(() => ev(A, () => /&r=/.test(document.getElementById('slUrl').value)), 5000);
  const url = await ev(A, () => document.getElementById('slUrl').value), m = /&r=(\d{8}\.[0-9a-f]{12}\.[A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(url);
  ok(!!m, 'the link carries where the recordings are and the key, after the #');
  const key = m && m[2], stored = [...R2.m.values()][0];
  ok(R2.m.size === 1 && stored.bytes.length < N0 * 2 / 4, 'one package is kept, compressed well below the recording’s size (' + stored.bytes.length + ' bytes for ' + (N0 * 2) + ' bytes of 16-bit audio)');
  const asText = Buffer.from(stored.bytes).toString('latin1');
  ok(asText.startsWith('TDS1') && !/Lead vocal|arrangement|tk1|Harbour/.test(asText), 'what the site keeps is sealed: no take name, song or file name can be read in it');
  ok(seen.length && !seen.some(s => s.url.includes(key) || s.body.includes(key) || s.headers.includes(key)), 'the key never left the browser (' + seen.length + ' requests checked)');
  await ev(A, () => { const d = document.getElementById('slDlg'); if (d) d.close(); });

  /* ---- the other person opens the link ---- */
  const B = await dev(); const hash = url.slice(url.indexOf('#'));
  await B.goto(t.BASE + '?debug' + hash); await wait(3500);
  ok(await ev(B, () => !!document.getElementById('slIn') && /With recordings, until/.test(document.getElementById('srxIn').textContent)), 'the link opens with “With recordings, until …” and a Report button');
  await ev(B, () => document.getElementById('slOpenBtn').click());
  ok(await poll(() => ev(B, () => window.__daily.TAKES.length === 1 && window.__daily.S.title === 'Harbour Song'), 20000), 'Open: the song arrives as a new song, with its take');
  const TB = await ev(B, () => { const t = window.__daily.TAKES[0]; let at = 0, mx = 0; for (let i = 0; i < t.dry.length; i++) if (Math.abs(t.dry[i]) > mx) { mx = Math.abs(t.dry[i]); at = i; } let s = 0; for (let i = 10000; i < 60000; i++) s += t.dry[i] * t.dry[i]; return { name: t.name, kind: t.kind, start: t.startSec, sr: t.sr, n: t.dry.length, g: t.g, pan: t.pan, at, rms: Math.sqrt(s / 50000) }; });
  const N1 = Math.round(N0 * 48000 / SR0), C1 = CLICK * 48000 / SR0;
  ok(TB.name === 'Lead vocal' && TB.kind === 'vox' && TB.start === 2 && TB.g === .8 && TB.pan === -.2, 'the take keeps its name, kind, place in the song, level and pan');
  ok(TB.sr === 48000 && Math.abs(TB.n - N1) <= 1, 'it is exactly as long as it was (' + TB.n + ' samples at 48 kHz, expected ' + N1 + ')');
  const LAG = await ev(B, async ({ SR0, N0, CLICK }) => {      /* the original, made again here and taken to 48 kHz the same way, against what arrived */
    const x0 = new Float32Array(N0); for (let i = 0; i < N0; i++) x0[i] = .25 * Math.sin(2 * Math.PI * 220 * i / SR0) * Math.min(1, i / 2000); x0[CLICK] = .98;
    const n = Math.round(N0 * 48000 / SR0), oc = new OfflineAudioContext(1, n, 48000), b = oc.createBuffer(1, N0, SR0), src = oc.createBufferSource(); b.copyToChannel(x0, 0); src.buffer = b; src.connect(oc.destination); src.start();
    const x = (await oc.startRendering()).getChannelData(0), y = window.__daily.TAKES[0].dry, c = Math.round(CLICK * 48000 / SR0); let best = -Infinity, lag = 0;
    for (let l = -600; l <= 600; l++) { let s = 0; for (let i = c - 3000; i < c + 3000; i++) s += x[i] * (y[i + l] || 0); if (s > best) { best = s; lag = l; } } return lag; }, { SR0, N0, CLICK });
  ok(Math.abs(LAG) <= 2, 'and sample-aligned: it lines up with the original to within 2 samples (' + LAG + ')');
  ok(Math.abs(20 * Math.log10(TB.rms / (.25 / Math.SQRT2))) < 1, 'it sounds the same: the level is within 1 dB (' + (20 * Math.log10(TB.rms / (.25 / Math.SQRT2))).toFixed(2) + ' dB)');
  ok(await poll(() => ev(B, async () => { const D = window.__daily; return (await new Promise(r => setTimeout(r, 300)), D.PRJ.list.find(r => r.id === D.PRJ.cur) || {}).nTakes === 1; }), 8000), 'and it is saved in their library like a take they recorded');

  /* report */
  await B.goto(t.BASE + '?debug' + hash); await wait(3000);
  await ev(B, () => document.getElementById('srxRepBtn').click()); await wait(300);
  await ev(B, () => { document.getElementById('srxWhy').value = 'Test report'; document.getElementById('srxSendRep').click(); }); await wait(800);
  const rep = [...R2.m.keys()].find(k => k.startsWith('reports/')), rj = rep && JSON.parse(Buffer.from(R2.m.get(rep).bytes).toString());
  ok(rj && rj.why === 'Test report' && rj.key === key && rj.account === '101', 'Report sends the reason, the account it came from and (as chosen) the key, so the owner can check');
  await ev(B, () => { const d = document.getElementById('slIn'); if (d) d.close(); });

  /* tampered key: the song still opens, without the recordings */
  const C = await dev(); await C.goto(t.BASE + '?debug' + hash.slice(0, -2) + (key.endsWith('AA') ? 'BB' : 'AA')); await wait(3000);
  await ev(C, () => document.getElementById('slOpenBtn').click());
  ok(await poll(() => ev(C, () => window.__daily.S.title === 'Harbour Song' && window.__daily.TAKES.length === 0 && /could not be unlocked/.test(document.body.textContent)), 15000), 'a link whose key was changed opens the song without the recordings, and says why');

  /* the sender takes them back: the link opens without them */
  await ev(A, () => window.__daily.slShare()); await wait(400);
  ok(await ev(A, () => !document.getElementById('srxOn').checked && !/&r=/.test(document.getElementById('slUrl').value)), 'a new send starts without recordings (each send chooses)');
  await ev(A, () => { const d = document.getElementById('slDlg'); if (d) d.close(); });
  const ref = m[1]; await ev(A, r => window.__daily.srxTakeBack ? window.__daily.srxTakeBack(r) : fetch('/share/delete', { method: 'POST', headers: { Authorization: 'Bearer tokA', 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: r }) }), ref);
  ok(![...R2.m.keys()].some(k => !k.startsWith('reports/')), 'taken back: the package is deleted from the site');
  const E = await dev(); await E.goto(t.BASE + '?debug' + hash); await wait(3000); await ev(E, () => document.getElementById('slOpenBtn').click());
  ok(await poll(() => ev(E, () => window.__daily.S.title === 'Harbour Song' && window.__daily.TAKES.length === 0 && /run out|taken back/.test(document.body.textContent)), 15000), 'after that (or after 7 days) the link still opens the song, and says the recordings have gone');
  for (let i = t.errs.length - 1; i >= 0; i--) if (/http 404 .*\/share\/\d{8}\./.test(t.errs[i])) t.errs.splice(i, 1);      /* that 404 was the point: the recordings had been taken back */

  /* not signed in */
  await ev(A, () => { localStorage.removeItem('fw.ghtok'); window.__daily.slShare(); }); await wait(400);
  await ev(A, () => document.getElementById('srxOn').click());
  ok(await poll(() => ev(A, () => /Sign in with GitHub first/.test(document.getElementById('srxSay').textContent) && !document.getElementById('srxOn').checked), 5000), 'without a sign-in, it says to sign in first, and nothing is sent');
});
