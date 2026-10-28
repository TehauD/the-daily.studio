/* What leaves the page. A real browser, a whole session, every request counted.
   The claims on the first page, in About, in README and in PRIVACY.md are only as good as this test:
     · a full session (first visit, demo song, play, Concert and its Sky poster, a stem split, transcribe, a recording, the exports and the backup)
       makes NO request to any other site, and its own requests are only the page, the service worker, the manifest, the icons and the sample list
     · the page sets no cookies and keeps its data in `fw.*` keys and its own IndexedDB
     · nothing in the shipped page loads a script, style, image, frame or font from another site
     · the camera on the stage route does not reach jsDelivr or Google until the visitor says yes to the one-time download; "no" keeps it offline
       and does not ask again by itself; "yes" is remembered; only those two hosts are ever tried
   Run it against the live site after a deploy:  BASE_URL=https://the-daily.studio/ node test/e2e-privacy.cjs
   (anything the host adds on its own, an analytics beacon for example, shows up here as a request to another site.)
   Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
const FRESH = new Function(`try { localStorage.removeItem('fw.started'); } catch (e) { }`);
const THIRD = new Set(['cdn.jsdelivr.net', 'storage.googleapis.com']);
const OWN = /^\/(index\.html|sw\.js|manifest\.webmanifest|icons\/[\w.-]+|samples\/manifest\.json|favicon\.ico|)$/;

suite('e2e-privacy', async t => {
  const { ok, wait, poll, BASE } = t, home = new URL(BASE).origin;
  /** log every request the browser makes for this context (pages, workers, the service worker) and refuse anything that is not this site */
  const watch = async p => {
    const own = [], off = [];
    p.ctx.on('request', r => { const u = r.url(); if (/^(data|blob|about|chrome-extension):/.test(u)) return; if (new URL(u).origin === home) own.push(new URL(u).pathname); });
    await p.ctx.route(u => /^https?:/.test(u.protocol) && u.origin !== home, r => { off.push(new URL(r.request().url()).hostname); r.abort(); });
    return { own, off };
  };
  const dl = (p, go) => Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), go()]).then(r => r[0]);

  /* ---------- 1 · a whole session, no camera ---------- */
  {
    const p = await t.open({ boot: false, w: 1440, h: 900, init: FRESH }), net = await watch(p);
    await p.goto(BASE + '?debug'); await wait(3500);
    ok(await p.evaluate(() => !!document.getElementById('boot')), 'a first visit opens the welcome card');
    await p.evaluate(() => document.getElementById('bootDemo').click()); await wait(3800);
    await p.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); });
    ok(await p.evaluate(() => /demo/i.test(window.__daily.S.title)), 'the demo song is open');

    await p.click('body', { position: { x: 5, y: 5 } }).catch(() => { }); await p.keyboard.press(' '); await wait(3200); await p.keyboard.press(' '); await wait(300);

    // the visuals: Concert, each lens, and the Sky poster
    await p.evaluate(() => window.__daily.dockGo('vis')); await wait(900);
    const lenses = await p.evaluate(async () => { const D = window.__daily, out = []; for (const l of ['teach', 'sky', 'perform']) { D.lxSetLens(l); await new Promise(r => setTimeout(r, 700)); out.push(D.CFG.lens); } return out; });
    ok(lenses.join() === 'teach,sky,perform', 'Concert runs in all three lenses');
    const sky = await dl(p, () => p.evaluate(() => { try { window.__daily.lxSkySave(); } catch (e) { } }));
    ok(!!sky && /sky\.png$/.test(sky.suggestedFilename()), 'the Sky poster saves as a file (' + (sky ? sky.suggestedFilename() : 'no download') + ')');
    // the Show setup console: every tab opened, a look chosen, a test pattern, blackout, a looks file saved: no request, nothing leaves
    await p.evaluate(async () => { const d = window.__daily; d.shOpen('vis', 'looks'); for (const k of ['rig', 'col', 'cues', 'resp', 'pics', 'out', 'scene', 'midi', 'looks']) { d.SHC.tab = k; d.shcDraw(); await new Promise(r => setTimeout(r, 120)); } d.shcPick('lasers'); d.SG.test = 'bars'; d.shBlackout(true); await new Promise(r => setTimeout(r, 400)); d.SG.test = null; d.shBlackout(false); d.shSaveLook('privacy check'); });
    const lk = await dl(p, () => p.evaluate(() => { window.__daily.shExportLooks(); }));
    ok(!!lk && /looks\.json$/.test(lk.suggestedFilename()), 'the Show setup console works through all its tabs and saves a looks file (' + (lk ? lk.suggestedFilename() : 'no download') + ')');

    // a stem split and the chord / tab pass on a file the visitor brings
    const tn = t.tone(14, 196, { sr: 22050 }), file = t.tmp('privacy-backing.wav', t.wav(tn.data, tn.sr));
    await p.evaluate(() => window.__daily.dockGo('stems')); await wait(500); await p.setInputFiles('#pane-stems input[type=file]', file);
    ok(!!await p.waitForSelector('#pane-stems button:has-text("Import chords")', { timeout: 120000 }).catch(() => null), 'a track is split into stems and analysed on the device');

    // a recording (the browser's fake microphone)
    await p.evaluate(async () => { const d = window.__daily; d.CFG.countIn = 0; d.CFG.armG = true; await d.ioConnect(); });
    await p.click('body', { position: { x: 5, y: 5 } }).catch(() => { }); await p.keyboard.press('r'); await poll(() => p.evaluate(() => !!window.__daily.REC), 6000); await wait(2500);
    await p.evaluate(() => window.__daily.stopPlay(true)); await wait(800);
    ok(await p.evaluate(() => window.__daily.TAKES.length >= 1), 'a take is recorded and kept');

    // exports: share page, print sheet, MIDI, compressed audio, backup of every song
    const X = await p.evaluate(() => { const D = window.__daily, d = D.shareData(), html = D.shareHtml('data:audio/webm;base64,AAAA', d); return { html: html.length, ext: /(src|href)="https?:/i.test(html), print: D.printSheetHtml().length }; });
    ok(X.html > 3000 && !X.ext && X.print > 40, 'the share page is one file with nothing fetched from anywhere, and the print sheet renders');
    const aud = dl(p, () => p.evaluate(() => { const D = window.__daily; D.srecStart(false, { audio: true }); setTimeout(() => D.srecStop(true), 2200); }));
    ok(!!await aud, 'compressed audio is rendered here and saved');
    const bk = await dl(p, () => p.evaluate(() => window.__daily.projExportAll()));
    ok(!!bk && /\.zip$/.test(bk.suggestedFilename()), 'the backup of every song is built in the page and saved (' + (bk ? bk.suggestedFilename() : 'no download') + ')');

    // the shipped page loads nothing from another site (links the visitor clicks are navigations, not loads)
    const ext = await p.evaluate(() => [...document.querySelectorAll('script[src],link:is([rel~=stylesheet],[rel~=preload],[rel~=modulepreload],[rel~=prefetch],[rel~=preconnect],[rel~=dns-prefetch],[rel~=icon],[rel~=apple-touch-icon],[rel~=manifest]),img[src],iframe[src],source[src],audio[src],video[src],embed[src],object[data]')].map(e => e.src || e.href || e.data).filter(u => /^https?:/.test(u) && new URL(u).origin !== location.origin));
    ok(ext.length === 0, 'no script, style, image, frame, media or font tag points at another site' + (ext.length ? ': ' + ext.join(', ') : ''));
    const css = await p.evaluate(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].map(r => r.cssText); } catch (e) { return []; } }).join('\n'));
    ok(!/url\(\s*['"]?https?:/i.test(css), 'no stylesheet rule loads anything from another site');

    // storage and cookies
    const st = await p.evaluate(async () => ({ cookie: document.cookie, keys: Object.keys(localStorage), dbs: indexedDB.databases ? (await indexedDB.databases()).map(x => x.name) : [] }));
    ok(st.cookie === '' && (await p.ctx.cookies()).length === 0, 'the page sets no cookies');
    ok(st.keys.length > 0 && st.keys.every(k => /^fw\./.test(k)), 'everything in local storage is under the app’s own fw.* keys (' + st.keys.length + ' keys)');
    ok(st.dbs.every(n => /^the-daily/.test(n)), 'the only databases are the app’s own (' + st.dbs.join(', ') + ')');

    // the verdict
    ok(net.off.length === 0, 'a whole session made no attempt to reach any other site' + (net.off.length ? ': ' + [...new Set(net.off)].join(', ') : ''));
    const odd = [...new Set(net.own.filter(x => !OWN.test(x)))];
    ok(odd.length === 0, 'its own requests were only the page, service worker, manifest, icons and sample list' + (odd.length ? ' · also: ' + odd.join(', ') : ''));
    ok(!net.own.some(x => /^\/journal\//.test(x)), 'The Daily (a separate app on this site) is not loaded unless it is opened');
    await p.ctx.close();
  }

  /* ---------- 2 · the stage route: the camera never reaches jsDelivr or Google without a yes ---------- */
  {
    const p = await t.open({ boot: false, w: 1440, h: 900, init: FRESH }), net = await watch(p); await p.ctx.grantPermissions(['camera', 'microphone']);
    await p.goto(BASE + '?debug'); await wait(3300);
    const asked = () => p.evaluate(() => !!document.getElementById('mpAsk'));
    await p.evaluate(() => document.getElementById('bootStage').click());
    ok(await poll(() => p.evaluate(() => window.__daily.CAM.on), 15000), 'Begin on stage starts the camera, only because it was chosen');
    ok(await poll(asked, 15000), 'the "Me in front" look asks before downloading anything');
    const txt = await p.$eval('#mpAsk', e => e.textContent);
    ok(/jsdelivr/i.test(txt) && /google/i.test(txt) && /IP address/i.test(txt) && /never sent/i.test(txt) && /10 MB/.test(txt), 'the question says who is contacted, what they see, how big it is, and that the picture stays here');
    await wait(1800);
    ok(net.off.length === 0, 'with the question open, no request has gone to another site');

    await p.click('#mpAskNo'); await wait(1500);
    const no = await p.evaluate(() => { const D = window.__daily; return { st: D.CF.state, ok: D.CFG.mpOk, card: !!document.getElementById('mpAsk') }; });
    ok(no.st === 'failed' && no.ok === false && !no.card, '“Not now” keeps it offline: the edges-in look is used and nothing is remembered');
    await wait(2500);
    ok(!await asked() && net.off.length === 0, 'it does not ask again by itself, and still nothing has gone to another site');

    await p.selectOption('select[aria-label="Camera look"]', 'edges'); await wait(300); await p.selectOption('select[aria-label="Camera look"]', 'person');
    ok(await poll(asked, 8000), 'choosing the look again asks again');
    await p.click('#mpAskYes'); await wait(2500);
    const yes = [...new Set(net.off)];
    ok(yes.length > 0 && yes.every(h => THIRD.has(h)), 'only after “Download” does the page try jsDelivr, and only the two documented hosts (' + yes.join(', ') + ')');
    ok(await p.evaluate(() => window.__daily.CFG.mpOk === true), 'the yes is remembered');
    await p.selectOption('select[aria-label="Camera look"]', 'edges'); await wait(300); await p.selectOption('select[aria-label="Camera look"]', 'person'); await wait(1500);
    ok(!await asked(), 'once agreed, it does not ask again');
    await p.ctx.close();
  }

  /* ---------- 3 · hand tracking asks too ---------- */
  {
    const p = await t.open({ boot: false, w: 1440, h: 900, init: FRESH }), net = await watch(p); await p.ctx.grantPermissions(['camera', 'microphone']);
    await p.goto(BASE + '?debug'); await wait(3300); await p.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2500);
    await p.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); });
    await p.evaluate(() => window.__daily.dockGo('cam')); await wait(600);
    await p.evaluate(() => { const D = window.__daily; D.CAM.want = 'hand'; });
    await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Camera on\/off/.test(b.textContent)).click());
    ok(await poll(() => p.evaluate(() => window.__daily.CAM.on), 15000), 'the camera starts when its button is pressed');
    ok(await poll(() => p.evaluate(() => !!document.getElementById('mpAsk')), 12000), 'hand tracking asks before downloading anything');
    const f0 = await p.evaluate(() => window.__daily.CAM.frames); await wait(1500);
    ok(net.off.length === 0, 'with the question open, nothing has gone to another site');
    ok(await p.evaluate(f => window.__daily.CAM.frames > f + 10, f0), 'the camera picture keeps running (motion mode) while the question waits for an answer');
    await p.click('#mpAskNo'); await wait(1500);
    ok(await p.evaluate(() => window.__daily.CAM.track === 'motion') && net.off.length === 0, '“Not now” falls back to motion mode, fully offline');
    await p.ctx.close();
  }
});
