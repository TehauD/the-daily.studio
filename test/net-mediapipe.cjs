/* Needs the network (not part of the normal run): the camera library really loads from jsDelivr, code and WASM, under the page's security
   policy, which since 2.49.2 allows only that library's own folder. Run it after changing the MediaPipe version or the policy:
     node test/net-mediapipe.cjs            (with the network open)
     PW_PROXY=1 node test/net-mediapipe.cjs (in a sandbox that reaches the internet through HTTPS_PROXY) */
const { suite } = require('./lib.cjs');
suite('net-mediapipe', async t => {
  const p = await t.open({ w: 1280, h: 800 }), csp = [];
  p.on('console', m => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text().slice(0, 200)); });
  const r = await p.evaluate(async () => { const D = window.__daily; D.CFG.mpOk = true; try { const v = await D.mpVision(); return { ok: !!(v && v.mod && v.fs), n: v && v.mod ? Object.keys(v.mod).length : 0 }; } catch (e) { return { ok: false, err: String(e && e.message || e) }; } });
  t.ok(r.ok && !csp.length, 'the camera library and its WASM files load from jsDelivr under the page’s policy (' + (r.ok ? r.n + ' exports' : r.err) + (csp.length ? '; blocked: ' + csp[0] : '') + ')');
});
