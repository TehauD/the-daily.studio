/* The studio in other browsers' engines (2.19.1): Safari's (WebKit) and Firefox's, as well as Chromium.
   The main suite (test/run.cjs) runs in Chromium; this is a short pass over what people rely on most, in each engine:
   it opens, the audio engine and its worklets start, the song plays, the visuals draw, wide and vertical videos record at their sizes,
   Your video plays behind, the tip jar draws its code, the dialogs open and the problem report is made.
     BROWSER=webkit node test/xbrowser.cjs      BROWSER=firefox node test/xbrowser.cjs      node test/xbrowser.cjs (Chromium)
   (CI installs the engines with `npx playwright install --with-deps webkit firefox`.) Where an engine lacks something the browser itself
   provides (recording a canvas, say), the check says so by name rather than passing quietly; everything the app does itself must work. */
const { suite } = require('./lib.cjs');

suite('xbrowser-' + (process.env.BROWSER || 'chromium'), async t => {
  const { ok, wait, poll, engine } = t;
  const p = await t.open({ w: 1440, h: 900 });
  const ev = (f, a) => p.evaluate(f, a);
  console.log('engine: ' + engine + ' · ' + await ev(() => navigator.userAgent));

  /* ---- it opens, and the audio engine starts ---- */
  ok(await ev(() => !!window.__daily && !document.getElementById('boot')), 'the studio opens past the welcome card');
  ok(await ev(() => !!document.querySelector('.build-tag') && /v\d+\.\d+\.\d+/.test(document.querySelector('.build-tag').textContent)), 'the version tag is shown');
  const A = await ev(async () => { const D = window.__daily; await D.startAudio(); const c = D.E.ctx; if (c.state !== 'running') { try { await c.resume(); } catch (e) { } } return { ready: D.E.ready, state: c.state, worklet: D.E.worklet, lim: D.E.limiter.constructor.name, sr: c.sampleRate }; });
  ok(A.ready && A.worklet, 'the audio engine starts with its worklets (' + JSON.stringify(A) + ')');
  ok(A.lim === 'AudioWorkletNode', 'the zero-delay effects are in use (the limiter is ' + A.lim + ')');

  /* ---- the song plays, and the visuals draw ---- */
  const P = await ev(async () => { const D = window.__daily; D.dockGo('vis'); D.T.cursor = 0; await D.play(); const a = D.playheadSlot(); await new Promise(r => setTimeout(r, 1500)); const b = D.playheadSlot(); const playing = D.T.playing; D.stopPlay(true); return { playing, moved: b - a }; });
  ok(P.playing && P.moved > 1, 'the song plays and the playhead moves (' + JSON.stringify(P) + ')');
  ok(await poll(() => ev(() => { const v = window.__daily.UI.vcv; if (!v || !v.width) return false; const d = v.getContext('2d').getImageData(0, 0, v.width, v.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 40) n++; return n > 50; }), 5000), 'the visuals draw');

  /* ---- videos: wide and vertical, at their own sizes ---- */
  const canRec = await ev(() => !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream));
  if (!canRec) ok(true, 'NOTE: this engine has no canvas recording (MediaRecorder / captureStream), so videos are not checked here');
  else for (const f of ['wide', 'tall']) {
    const R = await ev(async f => {
      const D = window.__daily; D.CFG.recFmt = f; D.CFG.recQ = '720'; let got = null; await D.srecStart(false, { onBlob: b => { got = b; } }); await new Promise(r => setTimeout(r, 1800)); D.srecStop(true);
      for (let i = 0; i < 60 && !got; i++) await new Promise(r => setTimeout(r, 100)); D.CFG.recQ = 'auto'; if (!got) return { err: 'no video' };
      const el = document.createElement('video'); el.muted = true; el.src = URL.createObjectURL(got); await new Promise(r => { el.onloadedmetadata = r; el.onerror = r; setTimeout(r, 6000); });
      return { type: got.type, kb: Math.round(got.size / 1024), w: el.videoWidth, h: el.videoHeight };
    }, f);
    const want = f === 'tall' ? [720, 1280] : [1280, 720];
    ok(R.kb > 2 && (R.w === want[0] && R.h === want[1] || (R.w === 0 && R.kb > 2)), (f === 'tall' ? 'a vertical' : 'a wide') + ' video records' + (R.w ? ' at ' + R.w + ' × ' + R.h : ' (this engine cannot read back its own file to measure it)') + ' (' + JSON.stringify(R) + ')');
  }

  /* ---- Your video behind ---- */
  if (canRec) {
    const V = await ev(async () => {
      const D = window.__daily, cv = document.createElement('canvas'); cv.width = 160; cv.height = 90; const g = cv.getContext('2d');
      const mime = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)); if (!mime) return { skip: 'no video type to record' };
      const mr = new MediaRecorder(cv.captureStream(30), { mimeType: mime }), parts = []; mr.ondataavailable = e => parts.push(e.data); let k = 0;
      const iv = setInterval(() => { g.fillStyle = '#c03030'; g.fillRect(0, 0, 160, 90); g.fillStyle = '#fff'; g.fillRect(k++ % 160, 30, 10, 30); }, 33);
      await new Promise(r => { mr.onstop = r; mr.start(); setTimeout(() => mr.stop(), 1500); }); clearInterval(iv);
      const n = await D.vbgAdd([new File(parts, 'loop.' + (/mp4/.test(mime) ? 'mp4' : 'webm'), { type: mime.split(';')[0] })]); D.vzSetMode('video'); D.CFG.vbg.tint = 0; D.CFG.vbg.dim = 0;
      for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 150)); if (D.VBG.el.some(v => v && v.readyState >= 2)) break; }
      const v = D.UI.vcv, px = v.getContext('2d').getImageData(v.width * .2 | 0, v.height * .2 | 0, 1, 1).data;
      return { n, mime, playing: D.VBG.el.some(x => x && x.readyState >= 2), px: [...px].slice(0, 3) };
    });
    if (V.skip) ok(true, 'NOTE: ' + V.skip + ' in this engine, so Your video is not checked here');
    else ok(V.n === 1 && V.playing && V.px[0] > 120 && V.px[1] < 100, 'Your video is kept and plays behind (' + JSON.stringify(V) + ')');
    await ev(() => window.__daily.vzSetMode('hex'));
  }

  /* ---- the tip jar, the dialogs, the report ---- */
  const TJ = await ev(() => { const D = window.__daily, l = D.tipLink('@test-artist'); D.CFG.tip.link = '@test-artist'; const c = D.tipCard(300), q = D.qrMake(l); D.CFG.tip.link = ''; return { l, w: c && c.width, n: q.n }; });
  ok(TJ.l === 'https://venmo.com/u/test-artist' && TJ.w > 100 && TJ.n >= 21, 'the tip jar makes its link and draws its code (' + JSON.stringify(TJ) + ')');
  await ev(() => window.__daily.openSettings()); await wait(400);
  ok(await ev(() => { const d = document.getElementById('settings'); return !!(d && d.open); }), 'Settings opens');
  await ev(() => { const d = document.getElementById('settings'); if (d) d.close(); window.__daily.openHelp('report'); }); await wait(400);
  ok(await ev(() => !!document.getElementById('reportCopy')), 'Help ▸ Report a problem opens');
  const RP = await ev(() => window.__daily.reportText());
  ok(/problem report/.test(RP) && /Browser: /.test(RP), 'the problem report is made');
});
