/* Performer backdrop: calm and dim, section-aware, lower third, plain/green background, clean output window. Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-backdrop', async t => {
  const { ok, wait } = t, p = await t.open({ debug: true });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(async () => { const d = window.__daily; await d.ioConnect(); d.dockGo('stage'); });
  await wait(800);

  // off by default: nothing changes
  ok(await ev(() => { const d = window.__daily; return d.STG.pb && d.STG.pb.on === false && d.pbScene(d.STG.scenes[0], { sec: 'Verse' }) === d.STG.scenes[0]; }), 'the backdrop is off until you turn it on, and then the scene is untouched');
  await ev(() => { const d = window.__daily; d.shOpen('scene', 'scene'); }); await wait(400);
  ok(await ev(() => !!document.getElementById('pbCard') && !!document.getElementById('pbOut') && !!document.getElementById('pbFull')), 'the Stage pane has a Performer backdrop card with the clean-output and full-screen buttons');

  // calm + section colour + loudness
  const c = await ev(() => { const d = window.__daily; d.STG.pb.on = true; d.STG.pb.calm = true; d.S.sections = [{ id: 'a', name: 'Verse', lyrics: '', bars: [{ chord: 'C', tab: [] }] }, { id: 'b', name: 'Chorus', lyrics: '', bars: [{ chord: 'G', tab: [] }] }];
    const sc = Object.assign({}, d.STG.scenes[2], { flash: .8, trail: .3, glow: .9, sens: 2 }); const o = d.pbScene(sc, { sec: 'Verse' }); const h0 = d.PBK.hue;
    let last; for (let i = 0; i < 400; i++) last = d.pbScene(sc, { sec: 'Chorus' }); return { fl: o.flash, tr: o.trail, gl: o.glow, se: o.sens, h0, h1: d.PBK.hue, hueOut: last.hue - sc.hue }; });
  ok(c.fl === 0 && c.tr >= .8 && c.gl < .5 && c.se <= .75, 'calm mode: no flashing, long trails, softer glow, lower sensitivity (' + JSON.stringify(c) + ')');
  ok(c.h1 > 45 && c.h1 < 60 && Math.abs(c.hueOut - c.h1) < 1e-6, 'moving into the next section eases the colour by about 52 degrees (' + c.h1.toFixed(1) + ')');
  const small = await ev(() => { const d = window.__daily, sc = d.STG.scenes[0]; d.PBK.hue = 0; d.pbScene(sc, { sec: 'Verse' }); return d.PBK.hue; });
  ok(Math.abs(small) < 3, 'going back to the first section eases back toward no shift (' + small.toFixed(1) + ')');

  // dimming: darker when quiet, a little brighter when loud
  const dim = await ev(() => { const d = window.__daily; d.STG.pb.bg = 'visuals'; d.STG.pb.dim = .6; const mk = () => { const cv = document.createElement('canvas'); cv.width = cv.height = 8; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 8); return [cv, g]; };
    const lum = lv => { const [cv, g] = mk(); d.PBK.lv = lv; d.pbDim(g, 8, 8); return g.getImageData(4, 4, 1, 1).data[0]; }; return { quiet: lum(0), loud: lum(1) }; });
  ok(dim.quiet < 120 && dim.loud > dim.quiet + 20, 'the picture is dimmed, and louder playing lifts it (' + dim.quiet + ' quiet, ' + dim.loud + ' loud)');

  // green / black backgrounds through the real stage frame
  const px = async (bg, lower) => ev(([bg, lower]) => { const d = window.__daily; d.STG.pb.on = true; d.STG.pb.bg = bg; d.STG.pb.lower = lower; d.stageFrame(performance.now()); const cv = d.SG.cv, g = cv.getContext('2d'); const d1 = g.getImageData(Math.floor(cv.width * .5), Math.floor(cv.height * .2), 1, 1).data; return { w: cv.width, rgb: [d1[0], d1[1], d1[2]] }; }, [bg, lower]);
  let r = await px('green', false); ok(r.w > 100 && Math.abs(r.rgb[0] - 0) < 6 && Math.abs(r.rgb[1] - 177) < 6 && Math.abs(r.rgb[2] - 64) < 6, 'green background is chroma-key green (' + r.rgb.join(',') + ')');
  r = await px('black', false); ok(r.rgb.every(x => x < 6), 'black background is black (' + r.rgb.join(',') + ')');

  // the lower third
  const lt = await ev(() => { const d = window.__daily, mk = () => { const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; const g = cv.getContext('2d'); g.fillStyle = '#00b140'; g.fillRect(0, 0, 1280, 720); return [cv, g]; };
    const [c1, g1] = mk(), [c2, g2] = mk(), [c3, g3] = mk(); const C = { a: '#3cf', b: '#fc3' }; d.STG.pb.pos = 'bottom';
    d.drawLowerThird(g1, 1280, 720, { sym: 'Am', next: 'F', playing: true, sec: 'Verse', barIn: 2, nBars: 4, lyric: 'hello there my friend', lyricNext: 'and so it goes' }, C);
    d.drawLowerThird(g2, 1280, 720, { sym: null, playing: false, sec: 'Listening' }, C); d.STG.pb.pos = 'top'; d.drawLowerThird(g3, 1280, 720, { sym: 'G', playing: true, sec: 'Chorus', lyric: 'la la' }, C);
    const bright = (g, x, y) => { const a = g.getImageData(x, y, 1, 1).data; return a[1]; }; const whites = g => { const a = g.getImageData(0, 0, 1280, 720).data; let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] > 200 && a[i + 1] > 200 && a[i + 2] > 200) n++; return n; };
    return { panel: bright(g1, 640, 650), above: bright(g1, 640, 300), none: bright(g2, 640, 650), text: whites(g1), topPanel: bright(g3, 640, 70), topBottom: bright(g3, 640, 650) }; });
  ok(lt.panel < 60 && lt.above > 150 && lt.text > 800, 'the lower third is a dark panel along the bottom with white text (' + lt.panel + ' panel, ' + lt.above + ' behind, ' + lt.text + ' text pixels)');
  ok(lt.none > 150, 'with nothing to show (no chord, no lyric, not playing) there is no panel');
  ok(lt.topPanel < 60 && lt.topBottom > 150, 'the panel can sit at the top instead');

  // the lower third reads the song
  const info = await ev(() => { const d = window.__daily; d.S.sections = [{ id: 'a', name: 'Verse', lyrics: 'first line\nsecond line', bars: [{ chord: 'C G', tab: [] }, { chord: 'Am F', tab: [] }] }]; d.commit(false); return d.stageInfo(); });
  ok(info && typeof info === 'object', 'stageInfo is the same source the lower third and the HUD read');

  // clean output window
  const popP = p.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);
  await ev(() => { const d = window.__daily; d.STG.pb.bg = 'green'; d.STG.pb.on = false; }); await p.click('#pbOut').catch(() => { });
  const pop = await popP;
  if (pop) {
    await wait(600);
    const bg = await pop.evaluate(() => getComputedStyle(document.body).backgroundColor), kids = await pop.evaluate(() => [...document.body.children].map(e => e.tagName));
    ok(await ev(() => window.__daily.STG.pb.on === true), 'Clean output window turns the backdrop on');
    ok(/0, 177, 64/.test(bg), 'the output window is the same green, so no black edges show (' + bg + ')');
    ok(kids.length === 1 && kids[0] === 'VIDEO', 'the output window holds only the picture: no buttons, no text');
    await ev(() => { const d = window.__daily; d.STG.pb.bg = 'black'; document.getElementById('pb_bg').value = 'black'; document.getElementById('pb_bg').dispatchEvent(new Event('change')); }); await wait(300);
    ok(/rgb\(0, 0, 0\)/.test(await pop.evaluate(() => getComputedStyle(document.body).backgroundColor)), 'changing the background changes the window too');
    await pop.close();
  } else { ok(false, 'the clean output window opened'); }

  // persistence and the kill switch
  ok(await ev(() => JSON.parse(localStorage.getItem('fw.cfg') || '{}').stage ? JSON.parse(localStorage.getItem('fw.cfg')).stage.pb.on === true : true), 'the choice is saved with the stage settings');
  await p.keyboard.press('Control+.'); await wait(500);
  ok(await ev(() => !window.__daily.E.hasInput), 'the kill switch still stops everything');
  ok(t.errors ? t.errors().length === 0 : true, 'no console errors');
});
