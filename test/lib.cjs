/* Shared helpers for the browser tests. Each test file is independent: it starts its own static server on a free port, launches its own
   Chromium (fake audio device) and uses fresh browser contexts, so nothing one file leaves behind can change another.
   Options (environment): CHROMIUM_PATH=/path/to/chrome · NO_SANDBOX=1 (containers) · BASE_URL=https://… (test a deployed site)
            BROWSER=webkit|firefox (Safari's or Firefox's engine instead of Chromium; used by test/xbrowser.cjs; the fake microphone is Chromium's) */
const pw = require('playwright');
const ENGINE = ['webkit', 'firefox'].includes(process.env.BROWSER) ? process.env.BROWSER : 'chromium';
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const wait = ms => new Promise(r => setTimeout(r, ms));

/** a free TCP port */
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.on('error', rej); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });

/** 16-bit mono WAV bytes from a Float32Array */
function wav(L, sr) {
  const n = L.length, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 2); return b;
}
/** a plucked/voiced test tone: `sec` seconds at about `f` Hz, with phrases so the waveform looks like playing */
function tone(sec, f, o = {}) {
  const sr = o.sr || 22050, n = Math.floor(sr * sec), a = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, env = o.voice ? Math.pow(Math.max(0, Math.sin(Math.PI * ((t * .9) % 1))), .6) * (.55 + .45 * Math.sin(t * 3)) : Math.exp(-((t * 2) % 1) * 3);
    ph += 2 * Math.PI * f * (1 + (o.voice ? .02 * Math.sin(t * 5.5) : 0)) * (1 + .12 * Math.floor((t * .9) % 4)) / sr; a[i] = (Math.sin(ph) + .4 * Math.sin(2 * ph) + .2 * Math.sin(3 * ph)) * (o.amp || .3) * env;
  } return { data: a, sr };
}

/**
 * Run one test file. `fn(t)` gets: t.ok(cond, message) · t.wait · t.poll(fn, ms) · t.BASE · t.browser · t.open(opts) · t.fresh(opts) · t.errs · t.tmp(name, bytes)
 * t.open({ w, h, mobile, debug, boot, init }) → a page in its own fresh context, booted past the start card with the tour offer dismissed.
 */
async function suite(name, fn) {
  const t0 = Date.now(); let fails = 0, checks = 0; const errs = [], ctxs = [];
  const ok = (c, m) => { checks++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; return !!c; };
  let srv, port, BASE = process.env.BASE_URL;
  try {
    if (!BASE) { port = await freePort(); BASE = `http://localhost:${port}/`; srv = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'serve.mjs')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' }); await wait(800); }
    const browser = ENGINE === 'firefox' ? await pw.firefox.launch({ firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true, 'media.autoplay.default': 0, 'media.autoplay.blocking_policy': 0 } })
      : ENGINE === 'webkit' ? await pw.webkit.launch()
      : await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', ...(process.env.NO_SANDBOX ? ['--no-sandbox'] : [])] });
    const poll = async (f, ms = 6000, step = 120) => { const end = Date.now() + ms; for (;;) { let v; try { v = await f(); } catch (e) { v = false; } if (v) return v; if (Date.now() > end) return false; await wait(step); } };
    const fresh = async (o = {}) => {
      const dev = o.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: o.dpr || 2 } : {};
      const c = await browser.newContext({ viewport: { width: o.w || 1500, height: o.h || 900 }, permissions: ENGINE === 'chromium' ? ['microphone'] : [], acceptDownloads: true, ...dev });
      await c.addInitScript(() => { try { if (window.name !== 'noseed') localStorage.setItem('fw.started', 'true'); } catch (e) { } }); if (o.init) await c.addInitScript(o.init); ctxs.push(c); return c;
    };
    const boot = async (p, o = {}) => {
      await p.goto(BASE + (o.debug === false ? '' : (BASE.includes('?') ? '&' : '?') + 'debug')); await wait(3000);
      await p.evaluate(() => { const b = document.getElementById('bootNoMic') || document.getElementById('bootGo'); if (b) b.click(); }); await wait(o.settle || 1800);
      await p.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); const hb = document.getElementById('humbar'); if (hb) hb.remove(); document.querySelectorAll('#toasts .toast').forEach(x => x.remove()); });
    };
    const open = async (o = {}) => {
      const c = await fresh(o), p = await c.newPage(); p.on('pageerror', e => errs.push(`${name}: pageerror: ${e.message}`));
      p.on('console', m => { if (m.type() === 'error' && !/audio input|MIDI|favicon|Failed to load resource/i.test(m.text())) errs.push(`${name}: console: ${m.text()}`); });
      p.on('response', r => { if (r.status() >= 400 && !/favicon|manifest|icons\//.test(r.url())) errs.push(`${name}: http ${r.status()} ${r.url()}`); });
      p.ctx = c;
      if (o.boot === false) return p;
      await boot(p, o);
      return p;
    };
    const tmp = (n, bytes) => { const f = path.join(os.tmpdir(), `daily-${process.pid}-${n}`); fs.writeFileSync(f, bytes); return f; };
    try { await fn({ ok, wait, poll, BASE, browser, engine: ENGINE, open, boot, fresh, errs, tmp, wav, tone, fs, os, path }); }
    finally { for (const c of ctxs) { try { await c.close(); } catch (e) { } } await browser.close(); }
    ok(errs.length === 0, 'no console / page / network errors' + (errs.length ? '\n' + errs.slice(0, 8).join('\n') : ''));
  } catch (e) { console.error(e); ok(false, `${name} crashed: ${e && e.message}`); }
  finally { if (srv) srv.kill(); }
  console.log(`\n${name}: ${checks - fails}/${checks} checks passed in ${((Date.now() - t0) / 1000).toFixed(0)} s`); process.exit(fails ? 1 : 0);
}
module.exports = { suite, wait, wav, tone, freePort };
