/* Hearing yourself, the output device and the Focusrite channel default (2.13.1):
   · "Hear myself" carries the vocal as well as the guitar (it used to leave a mic on the interface silent)
   · the output chosen last time is used when the engine starts, and an output that is gone falls back to the default
   · an input the engine cannot take (Firefox at a set sample rate) is reported, not left half-connected
   · a Focusrite starts as voice on input 1 and guitar on input 2, until you choose otherwise */
const { suite } = require('./lib.cjs');
suite('e2e-monitor', async t => {
  const { ok, wait } = t;
  const peak = p => p.evaluate(async () => { const D = window.__daily, a = D.E.anaMaster, b = new Float32Array(a.fftSize); let m = 0; for (let i = 0; i < 16; i++) { await new Promise(r => setTimeout(r, 90)); a.getFloatTimeDomainData(b); for (const v of b) if (Math.abs(v) > m) m = Math.abs(v); } return m; });

  /* ---- Hear myself and the vocal ---- */
  const p = await t.open({});
  await p.evaluate(async () => { const D = window.__daily; await D.ioConnect(''); D.chSetRoles('v', 'o'); D.S.band.on = false; });   // input 1 is the voice, no guitar
  await wait(400);
  const quiet = await peak(p);
  ok(quiet < 0.01, 'a mic on input 1 is silent while Hear myself is off (' + quiet.toFixed(3) + ')');
  await p.evaluate(() => { const b = document.querySelector('.io-mon'); b.click(); });
  await wait(300);
  const st = await p.evaluate(() => { const D = window.__daily; return { mon: D.CFG.monitor, vox: D.CFG.voxMon, g: D.E.voxMon.gain.value }; });
  ok(st.mon && st.vox && st.g > 0.9, 'Hear myself turns on the vocal monitor too (' + JSON.stringify(st) + ')');
  const loud = await peak(p);
  ok(loud > 0.05, 'with Hear myself on, the voice on input 1 reaches the output (' + loud.toFixed(3) + ')');
  await p.evaluate(() => document.querySelector('.io-mon').click()); await wait(200);
  ok(await p.evaluate(() => !window.__daily.CFG.voxMon && window.__daily.E.voxMon.gain.value < 0.1), 'Hear myself off turns the vocal off again');
  await p.evaluate(() => { const D = window.__daily; D.setMonitor(true); D.chSetRoles('g', 'o'); }); await wait(300);
  ok(await peak(p) > 0.05, 'the guitar on input 1 is heard with Hear myself on');
  await p.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: '.', ctrlKey: true, bubbles: true })); }); await wait(200);
  ok(await p.evaluate(() => !window.__daily.CFG.monitor && !window.__daily.CFG.voxMon), 'the kill switch turns both monitors off');

  /* ---- the Focusrite default ---- */
  const f = await p.evaluate(async () => {
    const D = window.__daily, C = D.CFG, o = {}; await D.ioConnect('');
    delete C.chUser; C.vin = 'off'; C.ch = 'auto'; C.gOff = false;
    o.other = D.chFocusriteDefault('Built-in Microphone'); o.otherRoles = D.chRoles().join('');
    o.fr = D.chFocusriteDefault('Analogue 1 + 2 (Focusrite USB Audio)'); o.frRoles = D.chRoles().join(''); o.frGain = [D.E.gL.gain.value, D.E.gR.gain.value];
    o.scar = (() => { C.vin = 'off'; C.ch = 'auto'; D.chFocusriteDefault('Scarlett 2i2 USB'); return D.chRoles().join(''); })();
    D.chSetRoles('g', 'v'); o.user = C.chUser;
    o.kept = D.chFocusriteDefault('Scarlett Solo USB'); o.keptRoles = D.chRoles().join('');
    return o;
  });
  await wait(100);
  ok(!f.other && f.otherRoles === 'go', 'another input is left as it was (' + f.otherRoles + ')');
  ok(f.fr && f.frRoles === 'vg', 'a Focusrite starts as voice on input 1 and guitar on input 2 (' + f.frRoles + ')');
  ok(f.scar === 'vg', 'a Scarlett is recognised too (' + f.scar + ')');
  ok(f.user && !f.kept && f.keptRoles === 'gv', 'once you choose the inputs yourself, the default leaves your choice alone (' + f.keptRoles + ')');

  /* ---- the output device ---- */
  const o2 = await t.open({ init: () => {
    try { const c = JSON.parse(localStorage.getItem('fw.cfg') || '{}'); if (!sessionStorage.getItem('seeded')) { c.outDev = 'gone-device-id'; localStorage.setItem('fw.cfg', JSON.stringify(c)); sessionStorage.setItem('seeded', '1'); } } catch (e) { }
    window.__sink = []; const orig = AudioContext.prototype.setSinkId; AudioContext.prototype.setSinkId = function (id) { window.__sink.push(id); return orig ? orig.call(this, id) : Promise.resolve(); };
  } });
  const out = await o2.evaluate(async () => { const D = window.__daily; await D.ioConnect(''); await new Promise(r => setTimeout(r, 300)); return { seen: window.__sink, now: D.CFG.outDev, state: D.E.ctx.state }; });
  ok(out.seen[0] === 'gone-device-id', 'the saved output is applied when the engine starts (asked for ' + JSON.stringify(out.seen) + ')');
  ok(out.now === '' && out.state === 'running', 'an output that is gone falls back to the default and the engine keeps running (' + JSON.stringify(out) + ')');
  const good = await o2.evaluate(async () => { const D = window.__daily; const id = (D.E.devs.out.find(d => d.deviceId && d.deviceId !== 'default') || {}).deviceId; if (!id) return 'none'; await D.setOutputDevice(id); return D.CFG.outDev === id && D.E.ctx.sinkId === id; });
  ok(good === true || good === 'none', 'choosing an output that exists keeps it (' + good + ')');

  /* ---- an input the engine cannot take ---- */
  const q = await t.open({});
  const r = await q.evaluate(async () => {
    const D = window.__daily; await D.ioConnect(''); D.CFG.sr = 'auto'; D.closeInput();
    const orig = AudioContext.prototype.createMediaStreamSource; AudioContext.prototype.createMediaStreamSource = function () { const e = new Error('Connecting AudioNodes from AudioContexts with different sample-rate is currently not supported.'); e.name = 'NotSupportedError'; throw e; };
    let res, threw = null; try { res = await D.ioConnect(''); } catch (e) { threw = e.message; }
    AudioContext.prototype.createMediaStreamSource = orig;
    const o = { res, threw, has: D.E.hasInput, stream: !!D.E.stream, err: D.E.lastInErr || '', state: D.E.ctx.state };
    o.again = await D.ioConnect(''); o.has2 = D.E.hasInput; return o;
  });
  ok(r.res === false && !r.threw && !r.has && !r.stream, 'an input the engine refuses is released and reported, not left half-connected (' + JSON.stringify({ res: r.res, threw: r.threw, has: r.has, stream: r.stream }) + ')');
  ok(/Sample rate to Auto|Chrome or Edge/.test(r.err) && r.state === 'running', 'the message says what to do and the engine keeps running');
  ok(r.again && r.has2, 'Connect works again afterwards');
  ok(!t.errs.length, 'no console / page / network errors' + (t.errs.length ? ': ' + t.errs.join(' | ') : ''));
});
