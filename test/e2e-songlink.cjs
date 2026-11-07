/* Send a song as a link (2.40, part 89): the song rides inside the link after the #. Making one, reading it back exactly, opening it
   on a first visit and as someone with songs of their own (who keeps them), and links that are broken, huge or hostile. */
const { suite } = require('./lib.cjs');
const zlib = require('node:zlib');
const b64 = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const link = (BASE, obj, how) => BASE + '?debug#s=1' + (how === 'j' ? 'j' + b64(JSON.stringify(obj)) : 'z' + b64(zlib.deflateRawSync(Buffer.from(JSON.stringify(obj)))));

suite('e2e-songlink', async t => {
  const { ok, wait, poll, BASE } = t;
  const p = await t.open({ w: 1440, h: 900 }), ev = (f, a) => p.evaluate(f, a), seen = [];
  p.on('request', r => seen.push(r.url()));
  await ev(() => { const D = window.__daily; D.S.title = 'Harbour Song'; D.beatUse('lofi', { play: false, quiet: true }); D.S.sections[0].lyrics = 'Lanterns on the harbour wall\nCalling all the boats back in'; const b = D.S.sections[0].bars[0]; b.tab = [{ s: 0, st: 5, f: 3, t: '' }, { s: 4, st: 4, f: 'x', t: 'h' }, { s: 8, st: 3, f: 5, t: 'b', bend: 7 }]; b.keys = [{ s: 0, m: 64, d: 8, v: .8 }]; D.commit(false); });
  await ev(() => window.__daily.goalGo('songwriter')); await wait(300); await ev(() => document.getElementById('gtLink').click()); await poll(() => ev(() => !!document.getElementById('slUrl')), 3000);
  const L = await ev(() => ({ url: document.getElementById('slUrl').value, what: document.querySelector('#slDlg .sl-what').textContent, qr: !document.getElementById('slQr').disabled }));
  ok(L.url.startsWith(BASE.replace(/\/$/, '') + '/#s=1z') && L.url.length < 3000, '🔗 Send as a link makes an ordinary link to the studio with the song after the # (' + L.url.length + ' characters)');
  ok(/A minor|C major|minor|major/.test(L.what) && /82 BPM/.test(L.what) && /words/.test(L.what) && /tab/.test(L.what) && /Lo-fi Nod/.test(L.what), 'the window says what travels: ' + L.what);
  await ev(() => document.getElementById('slQr').click()); await wait(200);
  ok(L.qr && await ev(() => !!document.querySelector('#slDlg .sl-qr svg')), 'a short link can be shown as a QR code to scan');
  await ev(() => document.getElementById('slDlg').close());

  /* it reads back exactly */
  const R = await ev(async u => { const D = window.__daily, s = await D.slRead(u), A = D.S, pick = x => ({ t: x.title, k: x.key, m: x.minor, b: x.bpm, sw: x.swing, tn: x.tuningName, sec: x.sections.map(q => [q.name, q.bars.map(b => b.chord).join('|'), q.lyrics, JSON.stringify(q.bars.map(b => (b.tab || []).map(n => [n.s, n.st, n.f, n.t || '', n.bend]))), JSON.stringify(q.bars.map(b => (b.keys || []).map(n => [n.m, n.s, n.d, n.v])))]), band: ['drumsOn', 'kit', 'patName', 'drumLen', 'bassOn', 'bassStyle', 'bassTone', 'compOn', 'keysOn', 'keysStyle', 'keysSound', 'beat'].map(k => x.band[k]).join(), pat: JSON.stringify((x.band.pat || []).map(r => r.slice(0, x.band.drumLen))) });
    return { a: JSON.stringify(pick(A)), b: JSON.stringify(pick(s)) }; }, L.url);
  ok(R.a === R.b, 'reading the link back gives the same song: title, key, tempo, swing, tuning, every section’s chords, words, tab and keys, the band and its drum pattern');
  ok(!seen.some(u => /s=1z/.test(u)), 'and the song never went into any request: the part after # stays in the browser');

  /* a first visit opens it */
  const q = await t.open({ w: 1440, h: 900, boot: false }), qv = (f, a) => q.evaluate(f, a);
  await q.goto(L.url.replace(/^.*?#/, BASE + '?debug#')); await poll(() => qv(() => !!document.getElementById('slIn')), 8000);
  const W = await qv(() => ({ title: document.getElementById('slInH').textContent, what: document.querySelector('#slIn .sl-what').textContent, hash: location.hash, boot: !!document.getElementById('boot') && document.getElementById('boot').getClientRects().length > 0 }));
  ok(W.title === 'Harbour Song' && /82 BPM/.test(W.what) && W.hash === '', 'opening the link offers the song by name and takes it out of the address (' + W.what + ')');
  await qv(() => document.getElementById('slPlay').click()); await poll(() => qv(() => window.__daily.S.title === 'Harbour Song' && window.__daily.T.playing), 8000);
  await wait(800);
  ok(await qv(() => { const D = window.__daily; return D.S.title === 'Harbour Song' && D.T.playing && D.S.band.beat === 'lofi' && D.S.sections[0].bars[0].tab.length === 3 && !(document.getElementById('boot') && document.getElementById('boot').getClientRects().length); }), '▶ Open and play: past the first page, the song is open and playing with its beat and tab');
  await qv(() => window.__daily.stopPlay(true));

  /* someone with songs of their own keeps them */
  const r = await t.open({ w: 1440, h: 900 }), rv = (f, a) => r.evaluate(f, a);
  const mine = await rv(async () => { const D = window.__daily; D.S.title = 'My Own Tune'; D.commit(false); await D.projSave(); return D.PRJ.cur; });
  await rv(u => { location.hash = u.slice(u.indexOf('#')); }, L.url); await poll(() => rv(() => !!document.getElementById('slIn')), 6000);
  await rv(() => document.getElementById('slOpenBtn').click()); await poll(() => rv(() => window.__daily.S.title === 'Harbour Song'), 6000);
  const K = await rv(async id => { const D = window.__daily, other = D.PRJ.cur !== id; await D.projLoad(id); await new Promise(r => setTimeout(r, 400)); return { other, back: D.S.title }; }, mine);
  ok(K.other && K.back === 'My Own Tune', 'for someone with a song open, the link opens as a new song beside theirs, and theirs opens again untouched (' + K.back + ')');

  /* links that are broken, huge or hostile */
  const evil = { v: 1, t: '<img src=x onerror=alert(1)>' + 'A'.repeat(500), a: 'x', k: 99, m: 1, sc: '__proto__', b: 9999, ts: [99, 7], sw: 9, cp: -4, tn: 'Nope',
    x: Array.from({ length: 60 }, (_, i) => ['S' + i, Array.from({ length: 30 }, () => 'Am <b>X</b> C#m7b5 ZZ9').join('|'), i ? 'w' : 'w'.repeat(9000), [[[0, 99, 'evil', '<script>', 1e9]]], [[[999, -5, 0, 7]]]]),
    bd: { d: 1, kit: 'evil', pn: 'p'.repeat(200), p: ['X'.repeat(500), 'zzzz'], bs: 'rm -rf', ko: 1, ks: 'nope', beat: '../x' } };
  const E = await t.open({ w: 1280, h: 800, boot: false }), xv = (f, a) => E.evaluate(f, a);
  await E.goto(link(BASE, evil)); await poll(() => xv(() => !!document.getElementById('slIn')), 8000);
  const X = await xv(async () => { const D = window.__daily, imgs = document.querySelectorAll('#slIn img').length, title = document.getElementById('slInH').textContent; document.getElementById('slOpenBtn').click(); await new Promise(r => setTimeout(r, 1500)); const S = D.S;
    return { imgs, title: title.length, ok: S.title.length <= 80, k: S.key, b: S.bpm, ts: S.ts.join('/'), sw: S.swing, cp: S.capo, sc: S.scale, secs: S.sections.length, bars: S.sections.reduce((a, s) => a + s.bars.length, 0), chords: S.sections[0].bars[0].chord, ly: S.sections[0].lyrics.length,
      tab: JSON.stringify(S.sections[0].bars[0].tab), key: JSON.stringify(S.sections[0].bars[0].keys), kit: S.band.kit, bs: S.band.bassStyle, ks: S.band.keysStyle, beat: S.band.beat, len: S.band.drumLen, pn: S.band.patName.length }; });
  ok(X.imgs === 0 && X.title <= 80 && X.ok, 'markup in a link is only ever text: no element is made from it, and the title is cut to 80 characters');
  ok(X.k === 11 && X.b === 260 && X.ts === '16/4' && X.sw === .5 && X.cp === 0 && X.sc === 'Natural Minor (Aeolian)', 'numbers are held to what the studio allows (key, tempo, time signature, swing, capo) and an unknown scale falls back');
  ok(X.secs <= 48 && X.bars <= 400 && X.chords === 'Am C#m7b5' && X.ly <= 6000, 'at most 48 sections and 400 bars; only real chords are kept (' + X.chords + '), and the words are capped');
  ok(/"st":5/.test(X.tab) && /"f":0/.test(X.tab) && !/script|evil/.test(X.tab) && /"m":108/.test(X.key), 'tab and notes are rebuilt from numbers in range: ' + X.tab + ' ' + X.key);
  ok(X.kit === 'Acoustic' && X.bs === 'Root–Fifth' && X.ks === 'Pad (held)' && X.beat === undefined && X.len === 32 && X.pn <= 48, 'band names not in the studio’s own lists are replaced by its defaults');
  const bomb = BASE + '?debug#s=1z' + b64(zlib.deflateRawSync(Buffer.alloc(6 * 1024 * 1024, 32)));
  const B = await t.open({ w: 1280, h: 800, boot: false }), bv = (f, a) => B.evaluate(f, a);
  await B.goto(bomb); await wait(3500);
  ok(await bv(() => !document.getElementById('slIn') && [...document.querySelectorAll('.toast')].some(t => /could not be opened.*more than a song can hold/.test(t.textContent))), 'a link that unpacks to megabytes is stopped while it unpacks, with a plain message');
  await B.goto(L.url.replace(/^.*?#/, BASE + '?debug#').slice(0, -40)); await wait(3500);
  ok(await bv(() => !document.getElementById('slIn') && [...document.querySelectorAll('.toast')].some(t => /could not be opened/.test(t.textContent))), 'a link cut short by a chat app says it could not be opened, and nothing else happens');
  ok(await xv(async u => { const D = window.__daily; let e = ''; try { await D.slRead(u); } catch (x) { e = x.message; } return /not a song link/.test(e); }, BASE + '#s=2zAAAA'), 'a link in an unknown format is turned away');
});
