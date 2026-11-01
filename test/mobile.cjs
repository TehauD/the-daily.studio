/* Phone / tablet / desktop experience in a real browser (Playwright, Chromium with a fake audio device).
   Run:  npm run test:mobile      Options: CHROMIUM_PATH=/path/to/chrome  NO_SANDBOX=1  BASE_URL=https://… */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const PORT = 9123 + Math.floor(Math.random() * 500), BASE = process.env.BASE_URL || `http://localhost:${PORT}/`;
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
/** true as soon as fn() is truthy, false after ms (animations take longer on a busy machine, so wait for the state instead of a fixed time) */
const poll = async (fn, ms = 4000) => { const end = Date.now() + ms; for (;;) { let v; try { v = await fn(); } catch (e) { v = false; } if (v) return true; if (Date.now() > end) return false; await wait(100); } };
const errs = [];
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, small: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  land: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true },
  tabletL: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true }, desk: { viewport: { width: 1440, height: 900 } } };
(async () => {
  let srv; if (!process.env.BASE_URL) { srv = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' }); await wait(800); }
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', ...(process.env.NO_SANDBOX ? ['--no-sandbox'] : [])] });
  const open = async (dev, init) => {
    const ctx = await browser.newContext({ ...DEV[dev], permissions: ['microphone'] }); await ctx.addInitScript(() => { try { localStorage.setItem('fw.started', 'true'); } catch (e) { } }); if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(dev + ' pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/audio input|MIDI|favicon/i.test(m.text())) errs.push(dev + ' console: ' + m.text()); });
    p.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push(dev + ' http ' + r.status() + ' ' + r.url()); });
    await p.goto(BASE); await wait(2300); if (await p.$('#bootNoMic')) await p.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2500); await p.evaluate(() => { const b = document.getElementById('humAltDemo'); if (b) b.click(); }); await wait(2000);
    await p.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); }); await wait(300); p.ctx = ctx; return p;
  };
  const overflow = p => p.evaluate(() => { const W = innerWidth, bad = []; for (const x of document.querySelectorAll('#app *')) { if (document.body.dataset.form === 'tablet' && x.closest('#left,#right')) continue; const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') continue; const r = x.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; let a = x.parentElement, clip = false; while (a && a.id !== 'app') { const c = getComputedStyle(a); if (/(hidden|auto|scroll|clip)/.test(c.overflowX) && a.getBoundingClientRect().right <= W + 2) { clip = true; break; } a = a.parentElement; } if (!clip && (r.right > W + 2 || r.left < -2)) bad.push(x.tagName + '.' + String(x.className).slice(0, 24)); } return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }; });
  const goto = async (p, g, s) => {
    if (g === 'more') { await p.tap('.mnb[data-g="more"]'); await wait(300); await p.tap(`.msheet .mpanel-b button[data-sub="${s}"]`); await wait(450); return; }      /* 2.24: More opens the sheet; its first row has the panels */
    await p.tap(`.mnb[data-g="${g}"]`); await wait(150); await p.tap(`#msub .msc[data-s="${s}"]`); await wait(450);
  };

  /* ---- phone, portrait ---- */
  let p = await open('phone');
  ok(await p.evaluate(() => document.body.dataset.form === 'phone' && document.body.dataset.land === '0'), 'phone width selects the phone layout');
  ok(await p.evaluate(() => !!document.querySelector('#mtrans #mtrans, #mtrans .btn.play') && !!document.querySelector('#top #transport .field')), 'transport buttons moved to the bottom bar, tempo/key stay in the header');
  const subs = [['play', 'rig'], ['play', 'tones'], ['play', 'tuner'], ['play', 'io'], ['write', 'tab'], ['write', 'band'], ['write', 'theory'], ['see', 'vis'], ['see', 'stage'], ['see', 'neural'], ['see', 'cam'], ['stems', 'stems'], ['stems', 'tx'], ['more', 'lab'], ['more', 'exp']];
  for (const dev of ['phone', 'small']) {
    const q = dev === 'phone' ? p : await open('small'); const bad = [];
    for (const [g, s] of subs) { await goto(q, g, s); const o = await overflow(q); const vis = await q.evaluate(() => { const v = document.body.dataset.view; const el = v === 'center' ? document.querySelector('#dock .pane.on') : document.querySelector('#' + v); return !!el && el.getBoundingClientRect().height > 120; }); if (o.sw > o.W + 1 || o.bad.length || !vis) bad.push(s + ':' + JSON.stringify(o.bad) + (vis ? '' : ' empty')); }
    ok(bad.length === 0, `${dev}: all ${subs.length} panels fit the screen without sideways scrolling` + (bad.length ? ' ' + bad.join(' ') : ''));
    if (dev === 'small') await q.ctx.close();
  }
  // on-screen tab keypad
  await goto(p, 'write', 'tab');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#kpad')).display === 'flex'), 'tab keypad is shown in Write ▸ Tab');
  await p.tap('#pane-tab .tcell[data-b="0"][data-s="0"][data-st="5"]'); await p.tap('#kpad .kp.num:has-text("5")'); await wait(250);
  const cell = (b, s, st) => p.evaluate(([b, s, st]) => { const c = document.querySelector(`#pane-tab .tcell[data-b="${b}"][data-s="${s}"][data-st="${st}"]`); return c ? c.textContent.trim() : null; }, [b, s, st]);
  ok((await cell(0, 0, 5)) === '5', 'keypad: tap a cell, tap 5 → fret 5 written');
  ok(await p.evaluate(() => document.querySelector('#pane-tab .tcell.sel').dataset.s === '1'), 'keypad: auto-advance moves to the next slot');
  await p.tap('#kpad .kp.arm:has-text("10s")'); await p.tap('#kpad .kp.num:has-text("2")'); await wait(250);
  ok((await cell(0, 1, 5)) === '12', 'keypad: 10s then 2 → fret 12');
  await p.tap('#kpad .kp:has-text("◀")'); await p.tap('#kpad .kp:has-text("◀")'); await p.tap('#kpad .kp.tech:has-text("h")'); await wait(250);
  ok(await p.evaluate(() => /h/.test(document.querySelector('#pane-tab .tcell[data-b="0"][data-s="0"][data-st="5"]').textContent) || !!document.querySelector('#pane-tab .tcell[data-b="0"][data-s="0"][data-st="5"] .t')), 'keypad: technique key marks the note');
  await p.tap('#kpad .kp.bad'); await wait(200);
  ok((await cell(0, 0, 5)) === '', 'keypad: delete clears the note');
  // transport at the bottom plays
  await p.tap('#mtrans .btn.play'); await wait(900);
  ok(await p.evaluate(() => document.querySelector('#mtrans .btn.play').classList.contains('on')), 'bottom transport starts playback'); await p.tap('#mtrans .btn.play'); await wait(300);
  // arrangement cycling
  await goto(p, 'write', 'tab');
  const tlh = () => p.evaluate(() => document.querySelector('#timeline').getBoundingClientRect().height);
  const h0 = await tlh(); await p.tap('#msub .msc.tl'); await wait(250); const h1 = await tlh(); await p.tap('#msub .msc.tl'); await wait(250); const h2 = await tlh(); await p.tap('#msub .msc.tl'); await wait(250);
  ok(h1 > h0 + 80 && h2 === 0 && Math.abs((await tlh()) - h0) < 3, `arrangement cycles mini ${Math.round(h0)} → full ${Math.round(h1)} → hidden → mini`);
  // the More sheet
  await p.tap('.mmore'); await wait(350);
  ok(await p.evaluate(() => !!document.querySelector('.msheet') && document.querySelectorAll('.msheet .mtile').length >= 8), 'More sheet opens with its tiles');
  ok(await p.evaluate(() => /Monitor off/i.test(document.querySelector('.msheet').textContent)), 'in-app monitor starts OFF on a touch phone (feedback guard)');
  await p.tap('.msheet .mtile:has-text("Dark theme")'); await wait(300);
  ok(await p.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'theme toggles from the sheet');
  await p.tap('.msheet .mseg button:has-text("Desktop")'); await wait(500);
  ok(await p.evaluate(() => document.body.dataset.form === 'desktop' && getComputedStyle(document.querySelector('#mnav')).display === 'none' && !!document.querySelector('#transport .btn.play')), 'Device layout override → Desktop restores the desktop shell and header transport');
  await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('fw_cfg') || localStorage.getItem('fretwork.cfg') || '{}'); });
  await p.setViewportSize({ width: 391, height: 844 }); await wait(400); await p.setViewportSize({ width: 390, height: 844 }); await wait(400);
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const o = JSON.parse(localStorage[k]); if (o && o.form === 'desktop') { o.form = 'auto'; localStorage[k] = JSON.stringify(o); } } catch (e) { } } });
  await p.close(); await p.ctx.close();

  /* ---- fresh phone: tour, long-press, wake lock ---- */
  p = await open('phone', () => { window.__wl = 0; Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__wl++; return { release: async () => { }, addEventListener() { } }; } } }); });
  await p.tap('.mmore'); await wait(300); await p.tap('.msheet .mtile:has-text("Guided tour")'); await wait(700);
  let steps = 0, off = 0; while (await p.$('#tour')) { steps++; const r = await p.evaluate(() => { const c = document.querySelector('.tour-card').getBoundingClientRect(); return c.left >= 0 && c.top >= 0 && c.right <= innerWidth + 1 && c.bottom <= innerHeight + 1; }); if (!r) off++; const nxt = await p.$('.tour-card .btn.primary'); await nxt.tap(); await wait(520); if (steps > 40) break; }
  ok(steps >= 15 && steps <= 20 && off === 0, `phone tour walked ${steps} steps, every card on screen, then closed`);
  await goto(p, 'play', 'rig');
  await p.tap('#mtrans .btn.play'); await wait(2500);
  ok(await p.evaluate(() => window.__wl) >= 1, 'screen wake lock requested while playing'); await p.tap('#mtrans .btn.play');
  const knob = await p.$('.rigdeck .knob'); const kb = await knob.boundingBox(); const cdp = await p.ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: kb.x + kb.width / 2, y: kb.y + kb.height / 2 }] }); await wait(900); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(300);
  ok(await p.evaluate(() => !!document.querySelector('.knob.learn')), 'long-press on a knob acts as right-click (MIDI-learn arms)');
  // pedal ordering without drag and drop
  const order = () => p.evaluate(() => [...document.querySelectorAll('.board .pedal')].map(x => x.dataset.id).slice(0, 4).join(','));
  const o0 = await order(); await p.tap('.board .pedal:nth-child(2) .pgear'); await wait(300); await p.tap('.pop button:has-text("Earlier")'); await wait(400);
  ok((await order()) !== o0, 'pedal ⚙ ▸ Earlier reorders the chain on touch: ' + o0 + ' → ' + (await order()));
  // neural pinch (two touch points) and stage fill
  await goto(p, 'see', 'neural'); const cv = await (await p.$('#pane-neural canvas')).boundingBox(); const cx = cv.x + cv.width / 2, cy = cv.y + cv.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 20, y: cy, id: 1 }, { x: cx + 20, y: cy, id: 2 }] });
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 20 - i * 12, y: cy, id: 1 }, { x: cx + 20 + i * 12, y: cy, id: 2 }] }); await wait(30); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(300); ok(true, 'neural map accepts a two-finger pinch');
  await goto(p, 'see', 'stage'); await p.tap('#pane-stage .sbtn:has-text("Full")'); await wait(600);
  ok(await p.evaluate(() => { const w = document.querySelector('.stagewrap'); const r = w.getBoundingClientRect(); return (document.fullscreenElement === w) || (w.classList.contains('pfs') && r.width >= innerWidth - 1 && r.height >= innerHeight - 1); }), 'Stage fills the screen from its ⛶ button');
  await p.keyboard.press('Escape'); await wait(300); await p.evaluate(() => { if (document.fullscreenElement) document.exitFullscreen(); });
  ok(await p.evaluate(() => !!navigator.serviceWorker), 'service worker API present');
  await wait(800);
  ok(await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; }), 'service worker registered (offline cache)');
  await p.close(); await p.ctx.close();

  /* ---- phone: Tracks gets the whole work area ---- */
  p = await open('phone'); await goto(p, 'play', 'rig');
  await p.evaluate(() => { const b = document.querySelector('.msc.tl'); b.click(); if (document.body.dataset.tl !== 'full') b.click(); }); await wait(500);
  { const T1 = await p.evaluate(() => ({ tl: document.body.dataset.tl, dock: getComputedStyle(document.getElementById('dock')).display, h: Math.round(document.getElementById('timeline').getBoundingClientRect().height), vh: innerHeight, btn: document.querySelector('.msc.tl').textContent }));
    ok(T1.tl === 'full' && T1.dock === 'none' && T1.h > T1.vh * .5 && /Panel/.test(T1.btn), 'phone: Tracks takes the whole work area and the button offers Panel (' + JSON.stringify(T1) + ')'); }
  await p.close(); await p.ctx.close();

  /* ---- loading a track into Stems (a synthetic file made here; nothing is bundled) ---- */
  p = await open('phone'); await goto(p, 'stems', 'stems');
  ok(await p.evaluate(() => !document.querySelector('.smp-shelf .smp')), 'no sample track is bundled with the app');
  { const fs = require('node:fs'), os = require('node:os'), sr = 22050, n = sr * 6, buf = Buffer.alloc(44 + n * 2), wv = path.join(os.tmpdir(), 'daily-test-track.wav');
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
    for (let k = 0; k < n; k++) { const t = k / sr, beat = (t * 2) % 1, v = .35 * Math.sin(2 * Math.PI * 220 * t) * Math.exp(-beat * 3) + .25 * Math.sin(2 * Math.PI * 330 * t) * .6 + (beat < .02 ? .5 * (Math.random() - .5) : 0); buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + k * 2); }
    fs.writeFileSync(wv, buf); await p.setInputFiles('#pane-stems input[type=file]', wv); }
  const loaded = await p.waitForFunction(() => /daily-test-track ·/.test(document.querySelector('#pane-stems').innerText) && /Guitar · keys · other/.test(document.querySelector('#pane-stems').innerText), null, { timeout: 120000 }).then(() => true, () => false);
  ok(loaded, 'a loaded track is separated into stems');
  await p.close(); await p.ctx.close();

  /* ---- landscape phone ---- */
  p = await open('land'); ok(await p.evaluate(() => document.body.dataset.form === 'phone' && document.body.dataset.land === '1' && getComputedStyle(document.querySelector('#mnav')).flexDirection === 'column'), 'landscape phone uses the side rail');
  { const bad = []; for (const [g, s] of [['play', 'rig'], ['write', 'tab'], ['write', 'band'], ['see', 'neural'], ['see', 'stage'], ['stems', 'stems']]) { await goto(p, g, s); const o = await overflow(p); if (o.sw > o.W + 1 || o.bad.length) bad.push(s + JSON.stringify(o.bad)); } ok(bad.length === 0, 'landscape: panels fit' + (bad.length ? ' ' + bad : '')); }
  const hts = await p.evaluate(() => { const w = document.querySelector('#work').getBoundingClientRect(); return w.height; }); ok(hts >= 240, 'landscape: content area is at least 240px tall (' + Math.round(hts) + ')');
  await p.close(); await p.ctx.close();

  /* ---- tablet ---- */
  for (const dev of ['tablet', 'tabletL']) {
    p = await open(dev); ok(await p.evaluate(() => document.body.dataset.form === 'tablet'), dev + ' selects the tablet layout');
    const bad = []; for (const id of ['rig', 'tab', 'band', 'vis', 'stage', 'neural', 'stems', 'tx', 'cam', 'lab', 'exp']) { await p.evaluate(i => document.querySelector('#dock .tab[data-id="' + i + '"]').click(), id); await wait(350); const o = await overflow(p); if (o.sw > o.W + 1 || o.bad.length) bad.push(id + JSON.stringify(o.bad)); }
    ok(bad.length === 0, dev + ': every dock panel fits' + (bad.length ? ' ' + bad : ''));
    await p.tap('.mdraw.l'); ok(await poll(() => p.evaluate(() => { const l = document.querySelector('#left').getBoundingClientRect(); return l.left >= -1 && l.width > 200 && l.right < innerWidth; })), dev + ': ☰ opens the Tones drawer');
    await p.tap('#mback'); ok(await poll(() => p.evaluate(() => document.querySelector('#left').getBoundingClientRect().right <= 1)), dev + ': tapping outside closes the drawer');
    await p.tap('.mdraw.r'); ok(await poll(() => p.evaluate(() => document.querySelector('#right').getBoundingClientRect().left < innerWidth - 200)), dev + ': tuner drawer opens'); await p.tap('#mback'); await poll(() => p.evaluate(() => document.querySelector('#right').getBoundingClientRect().left >= innerWidth - 2));
    await p.evaluate(() => document.querySelector('#dock .tab[data-id="tab"]').click()); await wait(300);
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('#kpad')).display === 'flex'), dev + ': tab keypad available');
    await p.close(); await p.ctx.close();
  }

  /* ---- desktop is unchanged ---- */
  p = await open('desk');
  ok(await p.evaluate(() => document.body.dataset.form === 'desktop'), 'desktop width selects the desktop layout');
  ok(await p.evaluate(() => ['#mnav', '#mtrans', '#msub', '.mmore', '.mdraw.l', '#kpad'].every(s => getComputedStyle(document.querySelector(s)).display === 'none')), 'no phone / tablet chrome is visible on desktop');
  ok(await p.evaluate(() => { const g = id => document.querySelector(id).getBoundingClientRect(); return g('#left').width > 200 && g('#right').width > 250 && g('#timeline').height > 150 && !!document.querySelector('#transport .btn.play') && !!document.querySelector('#dock .tabs .tab') && g('#status').height > 20; }), 'desktop keeps both sidebars, the tab bar, timeline, status bar and header transport');
  await p.setViewportSize({ width: 560, height: 800 }); await wait(500); ok(await p.evaluate(() => document.body.dataset.form === 'phone'), 'narrowing the window switches to the phone layout live');
  await p.setViewportSize({ width: 1440, height: 900 }); await wait(500); ok(await p.evaluate(() => document.body.dataset.form === 'desktop' && !!document.querySelector('#transport .btn.play') && document.querySelectorAll('#transport > *').length === 14 && document.querySelector('#transport > #bandMute') === document.querySelector('#transport .metro-more').previousElementSibling && getComputedStyle(document.getElementById('bandMute')).display === 'none'), 'widening again restores the desktop header exactly (14 transport items, the band button back beside the click and hidden, as the band strip has Mute all)');
  await p.close(); await p.ctx.close();

  ok(errs.length === 0, 'no page errors or failed requests' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  await browser.close(); if (srv) srv.kill(); console.log(fails ? `\n${fails} FAILED` : '\nall mobile checks passed'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
