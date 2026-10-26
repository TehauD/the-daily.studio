/* I/O: one Connect card, Set my level, adaptive Channels, signal path, output test, new-interface offer, permission help. Runs in its own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-io', async t => {
  const { ok, wait, BASE } = t, freshCtx = () => t.fresh();
  // I/O 2: one Connect card, Set my level, adaptive Channels, signal path, output test, new-interface offer, permission help
  { const ip = await (await freshCtx()).newPage(), ie = []; ip.on('pageerror', e => ie.push(e.message));
    await ip.addInitScript(() => { window.__gum = 0; const md = navigator.mediaDevices, g = md.getUserMedia.bind(md); md.getUserMedia = c => { if (c && c.audio) window.__gum++; return g(c); }; });
    await ip.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'debug'); await wait(3500);
    await ip.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2000);
    await ip.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); const hb = document.getElementById('humbar'); if (hb) hb.remove(); });
    await ip.evaluate(() => window.__daily.sideShow('io')); await wait(500);   // the context's saved layout may have the sidebar hidden
    ok(await ip.evaluate(() => window.__gum) === 0 && /Not connected/.test(await ip.$eval('#ioConn .io-st', e => e.textContent)), 'I/O: one Connect card says “Not connected” and asks nothing of the browser');
    ok(await ip.evaluate(() => { const a = document.getElementById('ioAdv'); return a && a.tagName === 'DETAILS' && !a.open && /Latency lab/.test(a.textContent) && /Diagnose/.test(a.textContent) && /Focusrite/.test(a.textContent); }), 'I/O: Latency lab, Focusrite notes and Diagnose live in a closed “Advanced & troubleshooting” fold');
    ok(await ip.evaluate(() => { const h4 = [...document.querySelectorAll('#left .pane.on .card > h4, #left .card > h4')].map(e => e.textContent.trim()); return h4.indexOf('Audio input') === 0 && h4.indexOf('Channels') === 1; }), 'I/O: Connect first, then Channels');
    ok(await ip.evaluate(() => !!document.querySelector('.aud .aud-lv')), 'the header Audio button carries a live level bar');
    // pure helpers
    const P = await ip.evaluate(() => { const D = window.__daily, o = {};
      o.ff = D.ioBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0', 0); o.sm = D.ioBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 0); o.si = D.ioBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 5); o.ed = D.ioBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0', 0); o.ch = D.ioBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 0);
      o.hFF = D.ioPermHelp('NotAllowedError', o.ff, false, true).steps.join(' '); o.hSI = D.ioPermHelp('NotAllowedError', o.si, false, true).steps.join(' '); o.hSM = D.ioPermHelp('NotAllowedError', o.sm, false, true).steps.join(' '); o.hCH = D.ioPermHelp('NotAllowedError', o.ch, false, true).steps.join(' '); o.hFR = D.ioPermHelp('NotAllowedError', o.ch, true, true).steps[0]; o.hIN = D.ioPermHelp('SecurityError', o.ch, false, false).steps[0];
      o.k = ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'ended', 'TypeError'].map(n => D.ioPermHelp(n, o.ch, false, true).kind).join();
      o.p = [-24, -60, -0.2, -50, -1, 3].map(r => JSON.stringify(D.ioPlan(r, -9))).join('|');
      o.d = [{ conn: false }, { conn: true, roles: false }, { conn: true, raw: -0.2, trim: -0.2 }, { conn: true, raw: -10, trim: 3 }, { conn: true, raw: -10, trim: -10, master: -0.5 }, { conn: true, raw: -90, trim: -90, recent: -90, silentFor: 8 }, { conn: true, raw: -90, trim: -90, recent: -90, silentFor: 8, monoBad: true }, { conn: true, raw: -40, trim: -40, recent: -40, master: -40, silentFor: 0 }, { conn: true, raw: -12, trim: -12, recent: -12, master: -40, silentFor: 0 }].map(L => D.ioDiagnose(Object.assign({ roles: true, raw: -120, trim: -120, recent: -120, master: -120, silentFor: 0 }, L)).k).join();
      o.n = D.ioNewInputs(['a', 'b'], [{ deviceId: 'a', label: 'A' }, { deviceId: 'c', label: 'C' }, { deviceId: 'default', label: 'Default' }, { deviceId: 'd', label: '' }]).map(d => d.deviceId).join(); return o; });
    ok(P.ff.b === 'firefox' && P.ff.os === 'win' && P.sm.b === 'safari' && P.sm.os === 'mac' && P.si.os === 'ios' && P.ed.b === 'edge' && P.ch.b === 'chrome' && P.ch.os === 'mac', 'permission help knows the browser and system (' + [P.ff.b + '/' + P.ff.os, P.sm.b + '/' + P.sm.os, P.si.b + '/' + P.si.os, P.ed.b, P.ch.b + '/' + P.ch.os].join(', ') + ')');
    ok(/permissions icon/.test(P.hFF) && /aA/.test(P.hSI) && /Settings for This Website/.test(P.hSM) && /Site settings/.test(P.hCH) && /System Settings → Privacy/.test(P.hCH) && /frame/.test(P.hFR) && /secure/.test(P.hIN), 'a blocked microphone gets browser-specific steps (Firefox, Safari Mac and iPhone, Chrome, frames, insecure page)');
    ok(P.k === 'denied,none,busy,ended,other', 'help covers blocked, not found, busy, unplugged and other errors (' + P.k + ')');
    ok(JSON.parse(P.p.split('|')[0]).trim === 15 && JSON.parse(P.p.split('|')[1]).k === 'none' && JSON.parse(P.p.split('|')[2]).k === 'hot' && JSON.parse(P.p.split('|')[3]).trim === 36 && JSON.parse(P.p.split('|')[3]).big === true && JSON.parse(P.p.split('|')[4]).trim === -8 && JSON.parse(P.p.split('|')[4]).low === true && JSON.parse(P.p.split('|')[5]).k === 'hot', 'Set my level maths: peak −24 → +15 dB, silence → none, 0 dBFS → hot, big gain flagged, clamps at +36, hot interface flagged (' + P.p.slice(0, 120) + ')');
    ok(P.d === 'idle,warn,bad,bad,warn,warn,warn,warn,ok', 'the signal-path sentence follows the levels (' + P.d + ')');
    ok(P.n === 'c', 'a new interface is spotted only if it is new, named and not the system default (' + P.n + ')');
    // connect
    await ip.click('#ioConn .io-go'); await wait(2500);
    ok(await ip.evaluate(() => window.__gum) > 0 && /\d ch · [\d.]+ kHz/.test(await ip.$eval('#ioConn .io-st', e => e.textContent)) && /Disconnect/.test(await ip.$eval('#ioConn .io-go', e => e.textContent)), 'Connect opens the input and the card shows the device, channels and sample rate');
    ok(await ip.evaluate(() => document.querySelectorAll('#ioConn .io-path .io-n').length === 4 && !!document.querySelector('#ioConn .io-out .io-test') && !!document.querySelector('#ioConn .io-msg')), 'signal path strip: Input, Trim, Rig, Master, Out with a message line');
    ok(await ip.evaluate(() => { const l = document.querySelector('#ioConn .io-level'); return !!l && !l.disabled; }), '“Set my level” is available once connected');
    // set my level
    await ip.evaluate(() => { window.__ioLevelMs = 500; window.__ioFeed = () => -24; });
    await ip.click('#ioConn .io-level'); await wait(300); ok(await ip.$eval('#iolevel', d => d.open), 'Set my level opens its dialog');
    await ip.click('#iolevel .io-wz-go'); await wait(1200);
    ok(await ip.evaluate(() => { const D = window.__daily, r = document.querySelector('#iolevel .io-wz-res'); return !!r && r.dataset.k === 'ok' && D.KNOBS.get('trim').get() === 15 && D.CFG.gTrim === 15 && D.CFG.ioLeveled === true; }), 'Set my level: a −24 dBFS peak sets the trim to +15 dB and remembers it');
    ok(await ip.evaluate(() => { const D = window.__daily; return Math.abs(D.E.inTrim.gain.value - Math.pow(10, 15 / 20)) < .5 || D.E.inTrim.gain.value > 2; }), 'the trim is applied to the audio graph');
    await ip.click('#iolevel .io-wz-undo'); await wait(300);
    ok(await ip.evaluate(() => window.__daily.KNOBS.get('trim').get() === 0 && !document.getElementById('iolevel')), 'Undo puts the trim back');
    await ip.evaluate(() => { window.__ioFeed = () => -0.2; }); await ip.click('#ioConn .io-level'); await ip.click('#iolevel .io-wz-go'); await wait(1200);
    ok(await ip.evaluate(() => { const r = document.querySelector('#iolevel .io-wz-res'); return !!r && r.dataset.k === 'hot' && window.__daily.KNOBS.get('trim').get() === 0; }), 'a signal that already clips at the interface is not “fixed” in software; it says to turn the gain knob down');
    await ip.click('#iolevel .io-wz-again'); await ip.evaluate(() => { window.__ioFeed = () => -90; }); await ip.click('#iolevel .io-wz-go'); await wait(1200);
    ok(await ip.evaluate(() => { const r = document.querySelector('#iolevel .io-wz-res'); return !!r && r.dataset.k === 'none' && /did not hear/.test(r.textContent); }), 'silence gets a checklist instead of a number');
    await ip.keyboard.press('Escape'); await wait(200); await ip.evaluate(() => { delete window.__ioFeed; });
    // channels follow the device
    ok(await ip.evaluate(() => !!document.querySelector('select[aria-label="What input 2 is"]') && !!document.querySelector('.io-preset')), 'Channels: a two-input device shows both inputs and one-tap presets');
    await ip.evaluate(() => { const D = window.__daily; D.E.inSettings = Object.assign({}, D.E.inSettings, { channelCount: 1 }); D.bus.emit('input', D.E.inSettings); }); await wait(300);
    ok(await ip.evaluate(() => !document.querySelector('select[aria-label="What input 2 is"]') && !!document.querySelector('select[aria-label="What input 1 is"]') && /single input/.test(document.querySelector('#left .chmx').parentNode.textContent)), 'Channels: a one-input device shows only one input and explains why');
    await ip.evaluate(() => { const D = window.__daily; D.E.inSettings = Object.assign({}, D.E.inSettings, { channelCount: 2 }); D.bus.emit('input', D.E.inSettings); }); await wait(300);
    await ip.click('.io-preset:has-text("Guitar & voice")'); await wait(300);
    ok(await ip.evaluate(() => window.__daily.chRoles().join() === 'g,v'), 'preset “Guitar & voice” puts the guitar on input 1 and the voice on input 2');
    await ip.click('.io-preset:has-text("Swap")'); await wait(300);
    ok(await ip.evaluate(() => window.__daily.chRoles().join() === 'v,g'), 'preset “Swap” swaps the two inputs');
    await ip.click('.io-preset:has-text("Guitar")'); await wait(200); await ip.evaluate(() => window.__daily.chSetRoles('g', 'o'));
    // the same Connect card in the header panel and in Perform
    await ip.click('.aud'); await wait(400);
    ok(await ip.evaluate(() => !!document.querySelector('#audio .io-conn .io-level') && !!document.querySelector('#audio .io-path') && /Disconnect/.test(document.querySelector('#audio .io-go').textContent)), 'the header Audio panel uses the same Connect card (level, path, test)');
    await ip.keyboard.press('Escape'); await wait(200);
    await ip.evaluate(() => window.__daily.perfOpen()); await wait(600);
    ok(await ip.evaluate(() => !!document.getElementById('pfLevel') && /connected/i.test(document.getElementById('pfRIn').textContent)), 'Perform: once connected, the readiness card offers “Set level”');
    await ip.evaluate(() => window.__daily.perfClose()); await wait(300);
    // output test
    await ip.evaluate(() => { window.__osc = 0; const f = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function () { window.__osc++; return f.apply(this, arguments); }; });
    await ip.click('#ioConn .io-test'); await wait(1600);
    ok(await ip.evaluate(() => window.__osc) >= 2, 'Test sound plays a tone on the left and then the right');
    // permission help in the card
    await ip.evaluate(() => { const D = window.__daily; D.closeInput(); D.E.lastInKind = 'NotAllowedError'; D.E.lastInErr = 'The microphone is blocked'; D.bus.emit('input', null); }); await wait(300);
    ok(await ip.evaluate(() => { const h = document.querySelector('#ioConn .io-help'); return !!h && !h.hidden && /blocked in/.test(h.textContent) && !!h.querySelector('.io-retry') && !!h.querySelector('.io-diag'); }), 'a refused microphone shows steps for this browser with “Try again” and “Run diagnostics”');
    await ip.click('#ioConn .io-retry'); await wait(2500);
    ok(await ip.evaluate(() => window.__daily.E.hasInput && document.querySelector('#ioConn .io-help').hidden), 'Try again reconnects and clears the help');
    // new interface offer: asks nothing until “Use it”
    const g0 = await ip.evaluate(() => window.__gum), cur = await ip.evaluate(() => window.__daily.E.inSettings.deviceId);
    await ip.evaluate(id => window.__daily.ioOffer({ deviceId: id, label: 'Focusrite Scarlett Solo USB' }), cur); await wait(300);
    ok(await ip.evaluate(() => !!document.getElementById('ioOffer') && /Focusrite Scarlett Solo USB/.test(document.getElementById('ioOffer').textContent)) && await ip.evaluate(() => window.__gum) === g0, 'a newly plugged-in interface is offered by name and nothing is requested until you answer');
    await ip.click('#ioOfferUse'); await wait(2200);
    ok(await ip.evaluate(() => window.__gum) > g0 && !!(await ip.$('#ioOfferLevel')), '“Use it” connects it and offers Set my level');
    await ip.click('#ioOffer .btn:has-text("Done")'); await wait(200);
    // kill switch
    await ip.keyboard.press('Control+.'); await wait(500);
    ok(await ip.evaluate(() => !window.__daily.E.hasInput) && /killed/i.test(await ip.$eval('#ioConn .io-st', e => e.textContent)), 'the kill switch drops the input and the card says so');
    ok(ie.length === 0, 'I/O 2 runs without script errors' + (ie.length ? ' ' + ie[0] : '')); await ip.close(); }
});
