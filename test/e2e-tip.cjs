/* The tip jar (2.17): an artist's own tip link as a QR code in an open guitar case, on the Visuals (and so in stage videos), the Stage,
   the Audience view, share pages, a printed sign and a picture. The QR codes were checked with an independent QR reader when the
   encoder was written; the fingerprints below pin them, so a change to the encoder that alters a code fails here. */
const { suite } = require('./lib.cjs');
const LINK = 'https://ko-fi.com/the-daily-test';

suite('e2e-tip', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({});
  const ev = (f, a) => p.evaluate(f, a);

  /* ---- the QR codes ---- */
  const q = await ev(() => {
    const D = window.__daily, fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
    const print = s => { const c = D.qrMake(s); let m = ''; for (let y = 0; y < c.n; y++) for (let x = 0; x < c.n; x++) m += c.dark(x, y) ? 1 : 0; return { v: c.v, n: c.n, mask: c.mask, f: fnv(m) }; };
    const big = D.qrMake('https://example.com/' + 'x'.repeat(280)), finder = c => [[0, 0], [c.n - 7, 0], [0, c.n - 7]].every(([x, y]) => c.dark(x, y) && c.dark(x + 6, y + 6) && !c.dark(x + 1, y + 1) && c.dark(x + 3, y + 3));
    return { a: print('https://ko-fi.com/the-daily-test'), b: print('https://cash.app/$tehau'), big: { v: big.v, n: big.n, finder: finder(big) }, svg: D.qrSvg(D.qrMake('hi'), 4) };
  });
  ok(q.a.v === 3 && q.a.n === 29 && q.a.f === 'e350c95d', 'a tip link becomes the same QR code it was checked as (version 3, ' + JSON.stringify(q.a) + ')');
  ok(q.b.v === 2 && q.b.n === 25 && q.b.f === '54360f2d', 'a Cash App link becomes the same QR code it was checked as (' + JSON.stringify(q.b) + ')');
  ok(q.big.v >= 10 && q.big.n === q.big.v * 4 + 17 && q.big.finder, 'a long link gets a larger code with its three finder patterns (' + JSON.stringify(q.big) + ')');
  ok(/^<svg [^>]*viewBox="0 0 29 29"/.test(q.svg) && /<path fill="#000" d="M/.test(q.svg), 'the code can be written as SVG with a quiet zone');

  /* ---- the link is made safe ---- */
  const L = await ev(() => { const f = window.__daily.tipLink; return ['ko-fi.com/name', '$Tehau', 'https://paypal.me/someone', 'http://ko-fi.com/x', 'javascript:alert(1)', 'https://me:pw@ko-fi.com/x', 'data:text/html,hi', 'not a link', '', 'https://localhost/x'].map(x => f(x)); });
  ok(L[0] === 'https://ko-fi.com/name' && L[1] === 'https://cash.app/$Tehau' && L[2] === 'https://paypal.me/someone', 'a bare address gets https:// and a $cashtag becomes a Cash App link (' + L.slice(0, 3).join(' · ') + ')');
  ok(L.slice(3, 8).every(x => x === null) && L[8] === '' && L[9] === null, 'plain http, javascript:, data:, a password in the link and things that are not addresses are refused (' + JSON.stringify(L.slice(3)) + ')');

  /* ---- nothing shows until the artist sets it up and agrees ---- */
  ok(await ev(() => { const D = window.__daily; D.CFG.tip.link = 'https://ko-fi.com/the-daily-test'; D.CFG.tip.on = true; delete D.CFG.tipOk; return !D.tipReady() && D.tipShareHtml() === ''; }), 'a link switched on is not shown until the artist has agreed to the terms');
  await ev(() => { const D = window.__daily; D.CFG.tip.link = ''; D.CFG.tip.on = false; D.dockGo('vis'); });
  await wait(600);

  /* ---- the dialog, from the 🎸 Tips button on the Visuals ---- */
  ok(await ev(() => !!document.querySelector('#paneVis [data-tipbtn], [data-tipbtn]')), 'the Visuals have a 🎸 Tips button');
  await ev(() => document.querySelector('[data-tipbtn]').click()); await wait(300);
  ok(await ev(() => { const d = document.getElementById('tipjar'); return !!(d && d.open && document.getElementById('tipLink') && document.getElementById('tipOn').disabled && document.getElementById('tipPrint').disabled); }), 'it opens the tip jar; Show and Print wait for a link');
  await p.fill('#tipLink', 'javascript:alert(1)');
  ok(await ev(() => /does not look like a web address/.test(document.getElementById('tipLinkNote').textContent) && document.getElementById('tipTest').disabled), 'a link that is not usable is named as such');
  await p.fill('#tipLink', 'ko-fi.com/the-daily-test'); await p.fill('#tipName', 'The Test Band');
  ok(await ev(() => /opens https:\/\/ko-fi\.com\/the-daily-test/.test(document.getElementById('tipLinkNote').textContent) && document.getElementById('tipOn').disabled && !document.getElementById('tipPrint').disabled), 'a good link is shown as it will open; Show still waits for the agreement');
  await p.check('#tipAgree'); await p.check('#tipOn');
  const S1 = await ev(() => { const D = window.__daily; return { ready: D.tipReady(), ok: D.CFG.tipOk === D.TIP_TERMS, link: D.CFG.tip.link, name: D.CFG.tip.name, btn: document.querySelector('[data-tipbtn]').classList.contains('on'), stat: document.getElementById('tipStatus').textContent }; });
  ok(S1.ready && S1.ok && S1.name === 'The Test Band' && S1.btn && /Showing/.test(S1.stat), 'agreed and switched on: the tip jar shows and the button lights (' + JSON.stringify(S1) + ')');
  ok(await ev(() => { const c = document.querySelector('#tipjar .tip-prev'); const d = c.getContext('2d').getImageData(c.width / 2, c.height * .5, 1, 1).data; return d[3] > 0; }), 'the dialog shows a preview of the case');

  /* ---- the case is drawn, and its code is the link ---- */
  const R = await ev(() => {
    const D = window.__daily, px = 400, card = D.tipCard(px), qr = D.qrMake(D.tipLink(D.CFG.tip.link)), g = card.getContext('2d');
    const cw = card.width, { x: ox, y: oy, cell } = card.qrBox, mid = i => Math.floor((Math.round(i * cell) + Math.round((i + 1) * cell)) / 2);
    const img = g.getImageData(0, 0, cw, px).data; let wrong = 0;
    for (let y = 0; y < qr.n; y++) for (let x = 0; x < qr.n; x++) { const i = ((oy + mid(y)) * cw + ox + mid(x)) * 4, dark = img[i] < 80; if (dark !== qr.dark(x, y)) wrong++; }
    /* a small card (a short canvas): the code still fills its panel, with modules of a pixel and a fraction */
    const sm = D.tipCard(108), sq = sm.qrBox, sideS = sq.cell * qr.n;
    return { wrong, cell, w: cw, h: card.height, small: +(sideS / (sm.width - 108 * .14)).toFixed(2) };
  });
  ok(R.wrong === 0 && R.cell >= 3, 'every module of the code in the case matches the link (' + JSON.stringify(R) + ')');
  ok(R.small > .75, 'on a small card the code still fills most of its white panel (' + R.small + ')');
  ok(await poll(() => ev(() => window.__daily.TIP.a.vis > .95), 5000), 'the case fades in on the Visuals (so it is in stage videos)');
  const V = await ev(() => {
    const D = window.__daily, cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; const g = cv.getContext('2d'); let r = null;
    D.TIP.a.test = 1; r = D.tipDraw(g, 1280, 720, 'test', []); D.CFG.tip.corner = 'tl'; const r2 = D.tipDraw(g, 1280, 720, 'test', []); D.CFG.tip.corner = 'br';
    const r3 = D.tipDraw(g, 1280, 720, 'test', [[0, 500, 1280, 220]]); delete D.TIP.a.test;
    const px = g.getImageData(Math.round(r[0] + r[2] / 2), Math.round(r[1] + r[3] / 2), 1, 1).data;
    return { r, r2, r3, mid: [...px] };
  });
  ok(V.r[0] + V.r[2] < 1280 && V.r[0] > 1280 * .6 && V.r[1] > 720 * .5 && V.r2[0] < 100 && V.r2[1] < 100, 'the case sits in the corner chosen (bottom right, top left)');
  ok(V.r3[1] + V.r3[3] <= 500, 'it steps up out of the way of what is drawn below it (the small neck, the lower third)');

  /* ---- only between songs ---- */
  await ev(() => { const D = window.__daily; D.CFG.tip.when = 'stopped'; D.play(); });
  ok(await poll(() => ev(() => window.__daily.TIP.a.vis < .05), 4000), '“Only between songs” hides it while the song plays');
  await ev(() => { const D = window.__daily; D.stopPlay(true); });
  ok(await poll(() => ev(() => window.__daily.TIP.a.vis > .95), 4000), '… and brings it back when the song stops');
  await ev(() => { window.__daily.CFG.tip.when = 'always'; });

  /* ---- the Stage and the projector ---- */
  await ev(() => window.__daily.dockGo('stage')); await wait(800);
  ok(await poll(() => ev(() => window.__daily.TIP.a.stage > .95), 5000), 'the case shows on the Stage (and so on the projector and the pop-out window)');
  ok(await ev(() => !!document.querySelector('.stagehud [data-tipbtn].on')), 'the Stage bar has the 🎸 Tips button, lit');
  ok(await ev(() => { const D = window.__daily, a = D.tipStageAvoid(1920, 1080, { ov: { tuner: true, info: true, chord: true, beat: false } }); return a.length === 3; }), 'on the Stage it steps around the tuner, the song info and the chord');
  await ev(() => { window.__daily.CFG.tip.where.stage = false; });
  ok(await poll(() => ev(() => window.__daily.TIP.a.stage < .05), 4000), 'it can be kept off the Stage');
  await ev(() => { window.__daily.CFG.tip.where.stage = true; });

  /* ---- share pages ---- */
  const H = await ev(() => { const D = window.__daily; D.CFG.tip.name = 'The <Test> Band'; const a = D.shareHtml('data:audio/wav;base64,', D.shareData()); D.CFG.tip.where.share = false; const b = D.shareHtml('data:audio/wav;base64,', D.shareData()); D.CFG.tip.where.share = true; D.CFG.tip.name = 'The Test Band'; return { a, b }; });
  ok(/<aside class="tip"/.test(H.a) && /<svg [^>]*viewBox/.test(H.a) && H.a.includes('href="https://ko-fi.com/the-daily-test" target="_blank" rel="noopener noreferrer nofollow"'), 'a share page carries the tip button and code, opening in a new tab');
  ok(H.a.includes('The &lt;Test&gt; Band') && !H.a.includes('<Test>') && /not part of the payment/.test(H.a), 'the name is escaped, and the page says the studio is not part of the payment');
  ok(!/<aside class="tip"/.test(H.b) && !/\.tip\{/.test(H.b), 'with share pages unticked, a share page has no tip jar');

  /* ---- a printed sign and a picture ---- */
  const P = await ev(() => { window.print = () => { }; window.__daily.tipPrint(); return new Promise(r => setTimeout(() => { const d = document.querySelector('#printSheet.tip-sign'); r({ svg: !!(d && d.querySelector('.ts-q svg')), h1: d && d.querySelector('h1').textContent, l: d && d.querySelector('.ts-l').textContent }); window.dispatchEvent(new Event('afterprint')); }, 150)); });
  ok(P.svg && P.h1 === 'The Test Band' && P.l === 'ko-fi.com/the-daily-test', 'a sign to print: the message, the name, a large code and the link (' + JSON.stringify(P) + ')');
  ok(await ev(() => !document.getElementById('printSheet') && !document.body.classList.contains('printing-sheet')), 'the sign is cleared after printing');
  const dl = p.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await ev(() => document.getElementById('tipPng').click());
  const d = await dl; ok(!!d && /^tip-jar_The_Test_Band\.png$/.test(d.suggestedFilename()), 'the case can be saved as a picture (' + (d && d.suggestedFilename()) + ')');

  /* ---- Settings, agents, keeping it ---- */
  await ev(() => { const x = document.getElementById('tipjar'); if (x) x.close(); window.__daily.openSettings('tip'); }); await wait(400);
  ok(await ev(() => /Tip jar: showing/.test((document.getElementById('setTip') || {}).textContent || '')), 'Settings has a Tip jar section that says it is showing');
  await ev(() => { const s = document.getElementById('settings'); if (s) s.close(); });
  const A = await ev(async () => { const r = await window.dailyStudio.call('get_studio_state', {}); return JSON.stringify(r); });
  ok(!A.includes('ko-fi.com/the-daily-test') && !A.includes('Test Band'), 'the agent tools do not see the tip link');
  ok(await ev(() => { const c = JSON.parse(localStorage.getItem('fw.cfg') || '{}'); return !!(c.tip && c.tip.link === 'ko-fi.com/the-daily-test' && c.tip.on && c.tipOk === 1); }), 'the tip jar is remembered in this browser');

  /* ---- on a phone the dialog fits ---- */
  const m = await t.open({ w: 390, h: 844, mobile: true });
  await m.evaluate(() => window.__daily.tipOpen()); await wait(400);
  ok(await m.evaluate(() => { const d = document.getElementById('tipjar'), b = d.querySelector('.dlg-b'); return d.open && b.scrollWidth <= b.clientWidth + 1 && document.getElementById('tipLink').getBoundingClientRect().width > 200; }), 'on a phone the tip jar fits the screen without sideways scrolling');
});
