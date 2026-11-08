/* Drops (2.60): an artist drops a finished song; it waits, private, until the owner approves it on the review page; then the public page
   lists it for 7 days and plays it. The site's real Worker answers /drops/* with two in-memory buckets (private and public); GitHub's
   /user is stood in for. Also: the Ogg file the studio makes is real, playable audio of the master's length; a song still over a record
   can't be dropped; a title with markup shows as text. */
const { suite } = require('./lib.cjs');
const path = require('node:path');
suite('e2e-drops', async t => {
  const { ok, wait, poll } = t;
  const { handle } = await import(path.join(__dirname, '..', 'worker', 'index.mjs'));
  const { fakeR2 } = await import(path.join(__dirname, 'fake-r2.mjs'));
  const PRIV = fakeR2(), PUB = fakeR2(), HOST = new URL(t.BASE).host, ENVX = { SHARES: PRIV, DROPS: PUB, OWNER_GITHUB_ID: '1', ASSETS: { fetch: () => new Response('', { status: 404 }) } };
  const users = { tokOwner: { id: 1, login: 'TehauD' }, tokA: { id: 101, login: 'artist' } };
  const ghU = async (url, init) => { const k = String((init.headers || {}).Authorization || '').replace('Bearer ', ''); return users[k] ? new Response(JSON.stringify(users[k]), { headers: { 'Content-Type': 'application/json' } }) : new Response('{}', { status: 401 }); };
  const wire = ctx => ctx.route(u => u.host === HOST && /^\/drops\/(api|a)\//.test(u.pathname), async route => {
    const q = route.request(), body = q.postDataBuffer(), r = await handle(new Request(q.url(), { method: q.method(), headers: q.headers(), body: body && q.method() !== 'GET' ? body : undefined }), ENVX, ghU);
    route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
  });
  const dev = async () => { const p = await t.open({ boot: false }); await wire(p.ctx); await t.boot(p); return p; };
  const A = await dev(), ev = (p, fn, a) => p.evaluate(fn, a);

  /* a finished song */
  await ev(A, async () => { const D = window.__daily, S = D.S; let n = 0; S.sections.forEach(sec => { sec.bars = sec.bars.filter(() => n++ < 4); }); S.sections = S.sections.filter(s => s.bars.length); S.title = '<img src=x onerror=alert(1)>Harbour Song'; Object.assign(S.band, { drumsOn: true, bassOn: true }); D.commit(false); localStorage.setItem('fw.ghtok', JSON.stringify({ t: 'tokA', via: 'token' })); D.CFG.slName = 'Tehau'; });
  await ev(A, () => window.__daily.finOpen()); await wait(300); await ev(A, () => document.getElementById('finGo').click());
  ok(await poll(() => ev(A, () => /^✓ Mastered/.test(document.getElementById('finSay').textContent)), 60000), 'the song is mastered in Finish it');
  /* the Ogg file is real audio */
  const OG = await ev(A, async () => { const D = window.__daily, F = D.FIN.out, b = await D.drpOgg(F.l, F.r, F.sr), ab = await b.arrayBuffer(), c = new OfflineAudioContext(2, 48000, 48000), au = await c.decodeAudioData(ab.slice(0)); let pk = 0; const x = au.getChannelData(0); for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i])); return { size: b.size, dur: au.duration, want: F.l.length / F.sr, pk, head: new TextDecoder().decode(new Uint8Array(ab, 0, 4)) }; });
  ok(OG.head === 'OggS' && Math.abs(OG.dur - OG.want) < .05 && OG.pk > .1, 'the drop’s audio is a real Ogg Opus file the browser plays back: ' + OG.dur.toFixed(2) + ' s for a ' + OG.want.toFixed(2) + ' s master, ' + Math.round(OG.size / 1024) + ' kB');
  /* dropping it */
  await ev(A, () => document.getElementById('finDrop').click()); await wait(300);
  ok(await ev(A, () => !!document.getElementById('shareOk') && /songs you choose to drop are public on the-daily.studio\/drops for 7 days, after the site’s owner has listened/.test(document.getElementById('shareOk').textContent)), 'the first time, the sharing terms ask first, and they say what Drops is');
  await ev(A, () => { document.getElementById('shareOkChk').click(); document.getElementById('shareOkGo').click(); }); await wait(300);
  ok(await ev(A, () => !!document.getElementById('drpDlg') && document.getElementById('drpGo').disabled), 'Drop it asks first: the button waits until you say the music is yours');
  await ev(A, () => { document.getElementById('drpNote').value = 'First drop'; document.getElementById('drpMine').click(); document.getElementById('drpGo').click(); });
  ok(await poll(() => ev(A, () => /^✓ Sent for review/.test(document.getElementById('drpSay').textContent)), 20000), 'it is sent for review: ' + await ev(A, () => document.getElementById('drpSay').textContent.slice(0, 60)));
  const pend = [...PRIV.m.keys()].filter(k => k.startsWith('drops-pending/'));
  ok(pend.length === 1 && [...PUB.m.keys()].length === 0 && PRIV.m.get(pend[0]).meta.l.startsWith('s=1'), 'it waits in the private bucket, with the song as a link; nothing is public');
  /* the public page before review */
  const P1 = await A.ctx.newPage(); await P1.goto(t.BASE + 'drops/'); await wait(800);
  ok(/Nothing has been dropped right now/.test(await P1.textContent('#list')), 'the public page shows nothing until the owner approves');
  /* the owner reviews */
  const R = await A.ctx.newPage(); await R.goto(t.BASE + 'drops/review/'); await R.evaluate(() => localStorage.setItem('fw.ghtok', JSON.stringify({ t: 'tokOwner' }))); await R.reload(); await wait(800);
  ok(/1 waiting/.test(await R.textContent('#say')) && /GitHub artist/.test(await R.textContent('#pend')), 'the owner’s review page lists the drop and who sent it');
  ok(await R.evaluate(() => !document.querySelector('#pend img') && !/[<>]/.test(document.querySelector('#pend h3').textContent) && /Harbour Song/.test(document.querySelector('#pend h3').textContent)), 'a title with markup arrives as plain text: the Worker removes < and >, and nothing runs');
  await R.click('#pend button:has-text("Load to listen")'); await wait(500);
  ok(await R.evaluate(() => !!document.querySelector('#pend audio') && /^blob:/.test(document.querySelector('#pend audio').src)), 'the owner can listen before deciding');
  await R.click('#pend button:has-text("Approve")'); await wait(800);
  ok([...PUB.m.keys()].some(k => k.startsWith('live/')) && /0 waiting · 1 live/.test(await R.textContent('#say')), 'Approve makes it public');
  /* the public page */
  await P1.reload(); await wait(800);
  const PUBV = await P1.evaluate(() => { const c = document.querySelector('.drop'); return c && { title: c.querySelector('h2').textContent, img: !!c.querySelector('img'), by: c.querySelector('.by').textContent, src: c.querySelector('audio').getAttribute('src'), left: c.querySelector('.left').textContent, song: (c.querySelector('a') || {}).href || '' }; });
  ok(PUBV && /Harbour Song/.test(PUBV.title) && !PUBV.img && /by Tehau/.test(PUBV.by) && /^7 days left/.test(PUBV.left), 'the public page lists it, as text, with who made it and the days left (' + (PUBV && PUBV.left) + ')');
  ok(PUBV && /\/drops\/a\//.test(PUBV.src) && /#s=1[zj]/.test(PUBV.song), 'with its audio and a link that opens the song in the studio');
  const st = await P1.evaluate(async src => (await fetch(src)).status, PUBV.src); ok(st === 200, 'and the audio plays from this site');
  /* not for songs over a record */
  ok(await ev(A, () => { const D = window.__daily; D.S.trackRef = { t: 'Someone else’s record', fp: 'x' }; return D.drpOwn() === false; }), 'a song still played over someone else’s record can’t be dropped (Make it ours first)');
});
