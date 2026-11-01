/* Video shapes and your own video backgrounds (2.19).
   SHAPES  a stage video is drawn for its own frame: Wide 16:9 (1920 × 1080), Vertical 9:16 (1080 × 1920) or as on screen; the words and the chord
           can be on it (on by default for vertical); the Visuals show a preview while it records, and it keeps going on another panel.
   VIDEOS  your own video loops as a "Behind you" look: kept in this browser, played muted and looped, switched by hand or with the song,
           drawn on the Visuals, the Stage and in recorded videos. The test videos are made here, in the page, so nothing is downloaded. */
const { suite } = require('./lib.cjs');

suite('e2e-shapes', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({ w: 1440, h: 900 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { const D = window.__daily; D.dockGo('vis'); const c = D.E.ctx; if (c && c.state !== 'running') return c.resume(); }); await wait(600);

  /* ---- the choice ---- */
  ok(await ev(() => window.__daily.srecFmt() === 'wide'), 'a video is wide (16:9) unless you choose otherwise');
  await ev(() => document.getElementById('vzRecBtn').click()); await wait(300);
  const M = await ev(() => { const b = [...document.querySelectorAll('#srecFmt [data-fmt]')]; return { fmts: b.map(x => x.dataset.fmt), on: b.filter(x => x.classList.contains('on')).map(x => x.dataset.fmt), words: document.getElementById('srecWords').checked }; });
  ok(M.fmts.join() === 'wide,tall,screen' && M.on.join() === 'wide' && M.words === false, 'the Record menu offers Wide, Vertical and As on screen, with the words off for wide (' + JSON.stringify(M) + ')');
  await ev(() => document.querySelector('#srecFmt [data-fmt="tall"]').click());
  ok(await ev(() => window.__daily.CFG.recFmt === 'tall' && document.getElementById('srecWords').checked), 'choosing Vertical is remembered, and turns the words and chord on');
  await p.keyboard.press('Escape'); await wait(200);

  /* ---- recording each shape: the file's own size ---- */
  const rec = fmt => ev(async fmt => {
    const D = window.__daily; D.CFG.recFmt = fmt; let got = null; D.T.cursor = 0;
    await D.srecStart(false, { onBlob: b => { got = b; } }); D.play(); await new Promise(r => setTimeout(r, 2500));
    const v = D.UI.vcv, vd = v.getContext('2d').getImageData(1, v.height >> 1, 1, 1).data, mid = v.getContext('2d').getImageData(v.width >> 1, v.height >> 1, 1, 1).data;
    const prev = { edge: [...vd].slice(0, 3), mid: [...mid].slice(0, 3) };
    D.srecStop(true); D.stopPlay(true); for (let i = 0; i < 50 && !got; i++) await new Promise(r => setTimeout(r, 100)); if (!got) return { err: 'no video' };
    const el = document.createElement('video'); el.muted = true; el.src = URL.createObjectURL(got); await new Promise(r => { el.onloadedmetadata = r; el.onerror = r; setTimeout(r, 5000); });
    return { w: el.videoWidth, h: el.videoHeight, kb: Math.round(got.size / 1024), prev, ui: [v.width, v.height] };
  }, fmt);
  const W1 = await rec('wide'), T1 = await rec('tall'), S1 = await rec('screen');
  ok(W1.w === 1920 && W1.h === 1080, 'Wide records a 1920 × 1080 video (' + JSON.stringify(W1) + ')');
  ok(T1.w === 1080 && T1.h === 1920, 'Vertical records a 1080 × 1920 video (' + JSON.stringify(T1) + ')');
  ok(S1.w === S1.ui[0] - S1.ui[0] % 2 && S1.h === S1.ui[1] - S1.ui[1] % 2, 'As on screen records the Visuals’ own size, as before (' + JSON.stringify(S1) + ')');
  ok(T1.prev.edge.every(c => c < 8) && T1.prev.mid.some(c => c > 20), 'while a vertical video records, the Visuals show it as a tall preview with black at the sides');

  /* ---- quality: 720p for phones ---- */
  const Q = await ev(() => { const D = window.__daily, a = D.srecQ(); D.CFG.recQ = '720'; const w = D.srecSize('wide'), t = D.srecSize('tall'); D.CFG.recQ = 'auto'; document.body.dataset.form = 'phone'; const ph = D.srecQ(); document.body.dataset.form = 'desktop'; return { auto: a, w, t, ph }; });
  ok(Q.auto === 1080 && Q.ph === 720 && Q.w.join() === '1280,720' && Q.t.join() === '720,1280', 'quality: Auto is 1080p on a computer and 720p on a phone; 720p records 1280 × 720 or 720 × 1280 (' + JSON.stringify(Q) + ')');
  await ev(() => { window.__daily.CFG.recQ = '720'; });
  const T7 = await rec('tall'); await ev(() => { window.__daily.CFG.recQ = 'auto'; });
  ok(T7.w === 720 && T7.h === 1280, 'a 720p vertical video is 720 × 1280 (' + JSON.stringify({ w: T7.w, h: T7.h }) + ')');
  ok(await ev(() => { const f = window.__daily.SREC.lastFr; return !!f && f.n > 20 && f.late >= 0; }), 'frames are counted while it records, to warn if many came late');
  await p.keyboard.press('Escape'); await ev(() => document.getElementById('vzRecBtn').click()); await wait(300);
  const QM = await ev(() => ({ n: document.querySelectorAll('#srecQ [data-q]').length, hint: (document.getElementById('srecHint') || {}).textContent, fmt: window.__daily.CFG.recFmt, pop: !!document.getElementById('srecFmt') }));
  ok(QM.n === 3 && /\d+ × \d+/.test(QM.hint || ''), 'the Record menu has Quality (Auto, 1080p, 720p) and says the size it will record (' + JSON.stringify(QM) + ')');
  await p.keyboard.press('Escape'); await wait(200);

  /* ---- the words and chord ---- */
  const Wd = await ev(async () => {
    const D = window.__daily, sec = D.S.sections.find(s => (s.lyrics || '').trim()), si = D.S.sections.indexOf(sec), sp = 16 * D.S.ts[0] / D.S.ts[1];
    let bars = 0; for (let i = 0; i < si; i++) bars += D.S.sections[i].bars.length; D.T.cursor = bars * sp; D.play(); await new Promise(r => setTimeout(r, 1200));
    const info = D.stageInfo(), cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; const S = D.SREC, keep = [S.cv, S.words];
    const bright = () => { const d = cv.getContext('2d').getImageData(0, 1920 * .66 | 0, 1080, 1920 * .34 | 0).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) n++; return n; };
    D.VZ.mode = 'nebula'; S.cv = cv; S.words = true; D.srecFrame(); const on = bright(); S.words = false; D.srecFrame(); const off = bright(); S.cv = keep[0]; S.words = keep[1]; D.stopPlay(true); D.VZ.mode = 'hex';
    return { line: info.lyric, on, off };
  });
  ok(Wd.line && Wd.on > Wd.off + 2000, 'with Words and chord on, the line being sung is written large at the bottom of the video (' + JSON.stringify(Wd) + ')');

  /* ---- it keeps recording on another panel ---- */
  const K = await ev(async () => {
    const D = window.__daily; D.CFG.recFmt = 'wide'; let got = null; await D.srecStart(false, { onBlob: b => { got = b; } }); D.play();
    const cv = document.getElementById('srecCanvas'), snap = () => cv.toDataURL('image/jpeg', .5);
    D.dockGo('tab'); await new Promise(r => setTimeout(r, 600)); const a = snap(); await new Promise(r => setTimeout(r, 900)); const b = snap();
    D.srecStop(true); D.stopPlay(true); D.dockGo('vis'); for (let i = 0; i < 50 && !got; i++) await new Promise(r => setTimeout(r, 100));
    return { moving: a !== b, got: !!got };
  });
  ok(K.moving && K.got, 'a video keeps recording, picture and all, while another panel is open');

  /* ---- Creator Studio ---- */
  await ev(() => window.__daily.goalGo('creator')); await wait(700);
  ok(await ev(() => { const b = document.getElementById('gtFmt'); window.__daily.CFG.recFmt = 'tall'; window.__daily.goalSync && window.__daily.goalSync(); return !!b; }), 'Creator Studio has the video shape next to Record MP4');
  const th = await ev(() => { const D = window.__daily; D.CFG.recFmt = 'tall'; const c = D.kitThumb(); D.CFG.recFmt = 'wide'; const d = D.kitThumb(); return [c.width, c.height, d.width, d.height]; });
  ok(th.join() === '1080,1920,1280,720', 'the thumbnail takes the shape too: 1080 × 1920 for vertical, 1280 × 720 for wide (' + th.join(', ') + ')');

  /* ---- your own videos ---- */
  const A = await ev(async () => {
    const D = window.__daily;
    const mk = (col, name) => new Promise(res => { const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const g = cv.getContext('2d'), st = cv.captureStream(30), mr = new MediaRecorder(st, { mimeType: 'video/webm;codecs=vp8' }), parts = []; mr.ondataavailable = e => parts.push(e.data);
      let k = 0; const iv = setInterval(() => { g.fillStyle = col; g.fillRect(0, 0, 320, 180); g.fillStyle = '#fff'; g.fillRect((k++ * 8) % 320, 60, 20, 60); }, 33); mr.onstop = () => { clearInterval(iv); res(new File([new Blob(parts, { type: 'video/webm' })], name, { type: 'video/webm' })); }; mr.start(); setTimeout(() => mr.stop(), 1600); });
    window.__vids = [await mk('#d02020', 'red sky.webm'), await mk('#2040d0', 'blue sea.webm')];
    const bad = await D.vbgAdd([new File(['not a video'], 'broken.mp4', { type: 'video/mp4' })]);
    const n = await D.vbgAdd(window.__vids); D.CFG.vbg.tint = 0; D.CFG.vbg.dim = 0; D.CFG.vbg.breathe = false;
    const stored = await D.pdbGet('blobs', 'stage/vid/' + D.CFG.vbg.list[0].id);
    return { bad, n, list: D.CFG.vbg.list.map(x => [x.name, x.w, x.h]), stored: !!stored && stored.size > 1000 };
  });
  ok(A.bad === 0, 'a file the browser cannot play is refused, with a message');
  ok(A.n === 2 && A.list[0][0] === 'red sky' && A.list[0][1] === 320 && A.stored, 'videos are added and kept in this browser’s own database (' + JSON.stringify(A.list) + ')');
  ok(await ev(() => !!document.getElementById('vbgBtn') && [...document.querySelectorAll('#vzBack [data-m]')].some(b => b.dataset.m === 'video')), 'the Behind you looks have Your video, with the 🎞 Your videos button');
  const px = (sel) => ev(sel => { const D = window.__daily, cv = sel === 'rec' ? document.getElementById('srecCanvas') : D.UI.vcv, d = cv.getContext('2d').getImageData(cv.width * .2 | 0, cv.height * .15 | 0, 1, 1).data; return [...d].slice(0, 3); }, sel);
  const red = c => c[0] > 150 && c[1] < 80 && c[2] < 80, blue = c => c[2] > 150 && c[0] < 80;
  await ev(() => { const D = window.__daily; D.dockGo('vis'); D.vzSetMode('video'); });
  ok(await poll(async () => red(await px('vis')), 6000), 'Your video plays behind on the Visuals (the first video)');
  await ev(() => window.__daily.vbgUse(window.__daily.CFG.vbg.list[1].id));
  ok(await poll(async () => blue(await px('vis')), 6000), 'choosing another video fades to it');
  ok(await ev(() => { const D = window.__daily; return D.VBG.el.filter(v => v && !v.paused).length <= 2 && D.VBG.el[D.VBG.on].playbackRate === 1; }), 'it plays at the Speed setting (1×), muted');
  await ev(() => { window.__daily.CFG.vzSpeed = 2; });
  ok(await poll(() => ev(() => window.__daily.VBG.el[window.__daily.VBG.on].playbackRate === 2), 3000), '🎚 Speed sets how fast it plays (2×)');
  await ev(() => { window.__daily.CFG.vzSpeed = 1; });

  /* with the song: every 4 bars, the next video */
  const C = await ev(async () => {
    const D = window.__daily, bpm = D.S.bpm; D.CFG.vbg.cycle = 'bars4'; D.vbgUse(D.CFG.vbg.list[0].id); await new Promise(r => setTimeout(r, 1500));
    const before = D.VBG.id[D.VBG.on]; D.S.bpm = 240; D.T.cursor = 0; D.play(); await new Promise(r => setTimeout(r, 6500)); const after = D.VBG.id[D.VBG.on]; D.stopPlay(true); D.S.bpm = bpm;
    await new Promise(r => setTimeout(r, 2000)); const back = D.VBG.id[D.VBG.on]; D.CFG.vbg.cycle = 'off';
    return { before, after, back, ids: D.CFG.vbg.list.map(x => x.id) };
  });
  ok(C.before === C.ids[0] && C.after === C.ids[1], 'set to change every 4 bars, it moves to the next video as the song plays (' + JSON.stringify(C) + ')');
  ok(C.back === C.ids[0], 'and when the song stops, the video you chose comes back');

  /* in a recorded video and on the Stage */
  await ev(() => window.__daily.vbgUse(window.__daily.CFG.vbg.list[0].id)); await wait(1500);
  const R = await ev(async () => { const D = window.__daily; D.CFG.recFmt = 'tall'; let got = null; await D.srecStart(false, { onBlob: b => { got = b; } }); await new Promise(r => setTimeout(r, 1200)); const cv = document.getElementById('srecCanvas'), d = cv.getContext('2d').getImageData(200, 300, 1, 1).data; D.srecStop(true); for (let i = 0; i < 50 && !got; i++) await new Promise(r => setTimeout(r, 100)); D.CFG.recFmt = 'wide'; return [...d].slice(0, 3); });
  ok(red(R), 'a recorded video (vertical) has your video behind (' + R.join(',') + ')');
  const St = await ev(() => { const D = window.__daily, cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; D.drawVis(cv, { mode: 'video', bgA: 1, noText: true, stage: true }); const d = cv.getContext('2d').getImageData(100, 60, 1, 1).data; return [...d].slice(0, 3); });
  ok(red(St), 'a Stage scene can use it too (' + St.join(',') + ')');
  await ev(() => { window.__daily.CFG.vbg.tint = 1; }); await wait(400);
  ok(await ev(() => { const v = window.__daily.UI.vcv, d = v.getContext('2d').getImageData(v.width * .2 | 0, v.height * .15 | 0, 1, 1).data; return !(d[0] > 150 && d[1] < 80 && d[2] < 80); }), 'Tint to the chord changes its colour');
  await ev(() => { window.__daily.CFG.vbg.tint = 0; });

  /* ---- the dialog, removing ---- */
  await ev(() => window.__daily.vbgOpen()); await wait(300);
  ok(await ev(() => document.querySelectorAll('#vbgList .vbg-row').length === 2 && !!document.querySelector('#vbgList .vbg-row.on') && document.querySelectorAll('#vbgCycle button').length === 4), 'the Your videos dialog lists them, the one showing marked, with the four ways to change');
  const Rm = await ev(async () => { const D = window.__daily, id = D.CFG.vbg.list[0].id; document.querySelector('#vbgList .vbg-row [aria-label^="Remove"]').click(); await new Promise(r => setTimeout(r, 500)); return { n: D.CFG.vbg.list.length, gone: !(await D.pdbGet('blobs', 'stage/vid/' + id)), rows: document.querySelectorAll('#vbgList .vbg-row').length }; });
  ok(Rm.n === 1 && Rm.gone && Rm.rows === 1, 'removing one deletes it from this device (' + JSON.stringify(Rm) + ')');
  await ev(() => { const d = document.getElementById('vbg'); if (d) d.close(); });

  /* ---- on a phone ---- */
  const m = await t.open({ w: 390, h: 844, mobile: true });
  await m.evaluate(() => window.__daily.vbgOpen()); await wait(400);
  ok(await m.evaluate(() => { const d = document.getElementById('vbg'), b = d.querySelector('.dlg-b'); return d.open && b.scrollWidth <= b.clientWidth + 1; }), 'on a phone the Your videos dialog fits without sideways scrolling');
});
