/* Rooms (2.40): on the hosted site, parts of the studio load the first time they are used (scripts/rooms.mjs, part 00).
   The page starts without them, the fonts come as files, each room loads once from this site (checked by its hash), the core's
   stand-ins hand over to the real thing, and the room sees the core's song live (it reads and writes the same S). */
const { suite } = require('./lib.cjs');
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');

suite('e2e-rooms', async t => {
  const { ok, wait, poll } = t, dist = path.join(__dirname, '..', 'dist');
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8'), rooms = fs.readdirSync(path.join(dist, 'rooms'));
  ok(!/data:font\/woff2/.test(html) && /<link rel="preload" href="fonts\/inter-latin-wght\.woff2" as="font"/.test(html), 'the site’s page links its two fonts (preloaded) instead of carrying them');
  ok(['tx', 'midi', 'shower', 'tune', 'print'].every(id => rooms.some(f => new RegExp('^' + id + '\\.[0-9a-f]{8}\\.js$').test(f))), 'the rooms are their own files, named by their contents (' + rooms.join(', ') + ')');
  const gz = zlib.gzipSync(Buffer.from(html), { level: 9 }).length, one = zlib.gzipSync(fs.readFileSync(path.join(__dirname, '..', 'index.html')), { level: 9 }).length;
  ok(gz < one - 80000, 'the site’s page is much lighter than the single file: ' + (gz / 1024).toFixed(0) + ' kB gzip instead of ' + (one / 1024).toFixed(0) + ' kB');
  ok(/script-src 'sha256-[^']+' 'self'/.test(html), 'its policy lets in scripts from this site only, beside its own inline one');

  const p = await t.open({ w: 1280, h: 800 }), ev = (f, a) => p.evaluate(f, a), req = [];
  p.on('request', r => req.push(new URL(r.url()).pathname));
  const R0 = await ev(() => ({ files: Object.keys(window.__daily.ROOM.files || {}).sort().join(), loaded: Object.keys(window.__daily.ROOM.done).length, tags: document.querySelectorAll('script[src*="rooms/"]').length, shw: typeof window.__daily.SHW, fn: typeof window.__daily.smfParse, fonts: [...document.fonts].filter(f => /DS /.test(f.family) && f.status === 'loaded').length }));
  ok(R0.files === 'midi,print,shower,tune,tx' && R0.loaded === 0 && R0.tags === 0, 'the studio starts without its rooms (' + R0.files + ' wait to be used)');
  ok(R0.shw === 'undefined' && R0.fn === 'function', 'until then the core holds stand-ins: a room’s functions load it when called, its objects are not there yet');
  ok(R0.fonts >= 1, 'the fonts load from their files (' + R0.fonts + ' in use)');

  /* a room that reads and writes the song: MIDI import, through its stand-in */
  const M = await ev(async () => {
    const D = window.__daily, b = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0], ev = [0x00, 0xff, 0x51, 3, 0x09, 0x27, 0xc0, 0x00, 0x90, 60, 100, 0x83, 0x60, 0x80, 60, 0, 0x00, 0xff, 0x2f, 0];
    const trk = [0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, ev.length, ...ev], buf = new Uint8Array([...b, ...trk]).buffer;
    const p = D.smfParse(buf), wasPromise = p && typeof p.then === 'function', r = await p;
    return { wasPromise, tracks: r && r.tracks && r.tracks.length, bpm: r && r.tempos && r.tempos.length ? Math.round(60e6 / r.tempos[0].us) : 0, done: Object.keys(D.ROOM.done).join(), real: !String(D.smfParse).includes('room(') };
  });
  ok(M.wasPromise && M.tracks >= 1 && M.bpm === 100, 'calling a room function loads the room and answers (a .mid at ' + M.bpm + ' BPM, ' + M.tracks + ' track)');
  ok(M.done === 'midi' && M.real, 'and from then on the real function is in place, in the core and in the test handles');
  const tags = await ev(() => [...document.querySelectorAll('script[src*="rooms/"]')].map(s => ({ src: s.getAttribute('src'), sri: /^sha384-/.test(s.integrity) })));
  ok(tags.length === 1 && tags[0].sri, 'one script for the room, from this site, checked by its sha384 hash (' + tags.map(x => x.src).join() + ')');

  /* the room sees the core's live song: S replaced after the room loaded is the S it uses */
  const L = await ev(async () => { const D = window.__daily; await D.room('tx'); const before = D.S; D.S.title = 'Live check'; return { same: D.ROOM.sc.v.S === D.S, title: D.ROOM.sc.v.S.title, again: (await D.room('tx')) === D.ROOM.done.tx, before: before === D.S }; });
  ok(L.same && L.title === 'Live check' && L.again, 'a room reads the song through the core, live; asking again for a loaded room is instant');

  /* a room that fails to load says so, and can be tried again */
  const F = await ev(async () => { const D = window.__daily, f = D.ROOM.files.shower; D.ROOM.files.shower = 'rooms/missing.js'; let err = ''; try { await D.room('shower'); } catch (e) { err = e.message; } D.ROOM.files.shower = f; const x = await D.room('shower'); return { err, ok: !!x && typeof D.SHW === 'object', toast: [...document.querySelectorAll('.toast')].some(t => /could not load/.test(t.textContent)) }; });
  ok(/room shower/.test(F.err) && F.toast && F.ok, 'a room that cannot load says so, and loads when asked again');
  ok(req.every(u => !/^\/rooms\//.test(u) || /^\/rooms\/[a-z]+\.[0-9a-f]{8}\.js$|^\/rooms\/missing\.js$/.test(u)), 'nothing else was asked for');

  /* the transcription engine arrives with its panel */
  await ev(() => window.__daily.dockGo('tx')); await wait(300);
  ok(await poll(() => ev(() => !!window.__daily.ROOM.done.tx), 4000), 'opening Transcribe fetches its engine while you choose what to transcribe');
  ok(await ev(() => !!navigator.serviceWorker), 'the service worker keeps the rooms and fonts for offline use (sw.js lists them)');
  const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
  ok(rooms.every(f => sw.includes('rooms/' + f)) && /fonts\/inter-latin-wght\.woff2/.test(sw), 'sw.js names every room and font');
});
