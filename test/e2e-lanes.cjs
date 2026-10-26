/* Lane strips, master chip, undo / saved, count-in. Runs in its own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-lanes', async t => {
  const { ok, wait, BASE } = t, freshCtx = () => t.fresh();
  // v2.1 · lane strips, master chip, undo / saved, count-in
  { const mp = await (await freshCtx()).newPage(), me = []; mp.on('pageerror', e => me.push(e.message));
    const boot = async () => { await mp.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'debug'); await wait(3500); await mp.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2000); await mp.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); const hb = document.getElementById('humbar'); if (hb) hb.remove(); }); };
    await boot();
    // lane header: M S vol pan +Fx
    const hd = await mp.evaluate(() => { const hdr = [...document.querySelectorAll('.tl-head')].find(x => /Bass/.test(x.textContent)); if (!hdr) return null; return { m: !!hdr.querySelector('button[title="Mute"]'), s: !!hdr.querySelector('button[title="Solo"]'), vol: !!hdr.querySelector('input[type=range]'), pan: !!hdr.querySelector('input[title="Pan"]'), fx: hdr.querySelector('.fxchip') && hdr.querySelector('.fxchip').textContent }; });
    ok(hd && hd.m && hd.s && hd.vol && hd.pan && /Fx/.test(hd.fx), 'a band lane header has M, S, volume, pan and +Fx (' + JSON.stringify(hd) + ')');
    // select a lane: tinted
    await mp.click('.tl-head:has-text("Bass") .nm'); await wait(150);
    ok(await mp.evaluate(() => { const hdr = [...document.querySelectorAll('.tl-head')].find(x => /Bass/.test(x.textContent)); return hdr.classList.contains('sel'); }), 'clicking a lane header selects it');
    // Fx popover
    await mp.evaluate(() => { const hdr = [...document.querySelectorAll('.tl-head')].find(x => /Bass/.test(x.textContent)); hdr.querySelector('.fxchip').click(); }); await wait(300);
    const fp = await mp.evaluate(() => { const p = document.querySelector('.fxp'); return p ? { t: p.textContent.slice(0, 40), pre: [...p.querySelectorAll('.fxpre .btn')].map(b => b.textContent).join(), kn: p.querySelectorAll('.fxgrid > *').length } : null; });
    ok(fp && /BASS/i.test(fp.t) && fp.pre === 'Flat,Warm,Bright,Punch,Room,Hall,Echo' && fp.kn >= 6, 'the Fx panel opens with presets and six controls (' + JSON.stringify(fp) + ')');
    await mp.evaluate(() => { [...document.querySelectorAll('.fxp .fxpre .btn')].find(b => b.textContent === 'Punch').click(); }); await wait(300);
    const fx1 = await mp.evaluate(() => { const D = window.__daily, f = D.S.mix.bass.fx; const hdr = [...document.querySelectorAll('.tl-head')].find(x => /Bass/.test(x.textContent)); return { f, on: D.fxOn(f), chip: hdr.querySelector('.fxchip').className, strip: !!(D.E.tr.bass && D.E.tr.bass.fx && D.E.tr.bass.fx.in) }; });
    ok(fx1.on && fx1.f.comp > .5 && fx1.f.lo === 1.5 && /on/.test(fx1.chip), 'a preset sets the bass strip and lights the chip (' + JSON.stringify(fx1.f) + ')');
    ok(fx1.strip, 'the bass lane has a real effects strip in the audio graph');
    await mp.keyboard.press('Escape'); await mp.mouse.click(700, 120); await wait(200);
    // persistence of lane Fx and a take's Fx across a reload
    await mp.evaluate(async () => { const D = window.__daily; const mkw = () => { const sr = 22050, n = sr * 3, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }; w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true); for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(i / 20) * 9000), true); return b; };
      const tk = await D.dropTake(new File([mkw()], 'Fx Take.wav'), 'gtr'); tk.fx = { lo: 0, mid: 0, hi: 0, comp: 0, rev: .4, dly: 0 }; tk.pan = .35; D.commit(false); D.bus.emit('takes'); await D.projSave(); });
    await wait(600); await boot();
    const rl = await mp.evaluate(() => { const D = window.__daily, t = D.TAKES[0]; return { band: D.S.mix.bass.fx, take: t && { n: t.name, fx: t.fx, pan: t.pan } }; });
    ok(rl.band && rl.band.comp > .5 && rl.band.lo === 1.5, 'the bass strip settings come back after a reload');
    ok(rl.take && rl.take.n === 'Fx Take' && rl.take.fx && rl.take.fx.rev === .4 && rl.take.pan === .35, 'a take’s effects and pan come back after a reload (' + JSON.stringify(rl.take) + ')');
    // master chip
    ok(await mp.evaluate(() => { const c = document.querySelector('#topR .mst-chip, .mst-chip'); return !!c && !!document.querySelector('.mst-pre'); }), 'the header has a master chip');
    await mp.click('.mst-pre'); await wait(250);
    ok(await mp.evaluate(() => [...document.querySelectorAll('.mstm .mst-opt b')].map(b => b.textContent).join() === 'Off,Clean,Warm,Bright,Loud' && !!document.getElementById('mstBal')), 'the master menu lists five presets and offers Auto-balance');
    await mp.evaluate(() => { [...document.querySelectorAll('.mstm .mst-opt')].find(b => /Warm/.test(b.textContent)).click(); }); await wait(300);
    const ms = await mp.evaluate(() => { const D = window.__daily; return { p: D.CFG.mstPre, t: D.CFG.lufsTarget, lab: document.querySelector('.mst-pre').textContent, chain: !!(D.E.mst && D.E.mst.lo) }; });
    ok(ms.p === 'warm' && ms.t === -14 && /Warm/.test(ms.lab), 'choosing Warm sets the tone, the −14 LUFS export target and the label (' + JSON.stringify(ms) + ')');
    // undo / redo / saved
    const u0 = await mp.evaluate(() => ({ u: document.querySelector('.sb-hist[aria-label=Undo]').disabled, r: document.querySelector('.sb-hist[aria-label=Redo]').disabled, saved: document.querySelector('.sb-saved').dataset.k }));
    ok(u0.u && u0.r, 'undo and redo are greyed out when there is nothing to undo or redo');
    await mp.evaluate(() => { const D = window.__daily; D.S.bpm = 133; D.commit(true); }); await wait(1600);
    const u1 = await mp.evaluate(() => ({ u: document.querySelector('.sb-hist[aria-label=Undo]').disabled, saved: document.querySelector('.sb-saved').dataset.k, txt: document.querySelector('.sb-saved').textContent }));
    ok(!u1.u && u1.saved === 'ok' && /Saved/.test(u1.txt), 'after an edit Undo is live and the header says Saved (' + JSON.stringify(u1) + ')');
    await mp.evaluate(() => { const D = window.__daily; D.S.bpm = 140; D.commit(true); });
    ok(await mp.evaluate(() => document.querySelector('.sb-saved').dataset.k) === 'dirty', 'right after an edit it says Saving…');
    await mp.click('.sb-hist[aria-label=Undo]'); await wait(300);
    ok(await mp.evaluate(() => window.__daily.S.bpm === 133 && !document.querySelector('.sb-hist[aria-label=Redo]').disabled), 'Undo steps back and enables Redo');
    await mp.click('.sb-hist[aria-label=Redo]'); await wait(300);
    ok(await mp.evaluate(() => window.__daily.S.bpm === 140), 'Redo steps forward');
    // count-in menu
    await mp.click('.metro-more'); await wait(250);
    ok(await mp.evaluate(() => /None.*1 bar.*2 bars.*4 bars/.test(document.querySelector('.clkm .seg').textContent) && !!document.querySelector('.clkm input[type=range]')), 'the Click ▾ menu offers count-in length and click volume');
    await mp.evaluate(() => { [...document.querySelectorAll('.clkm .seg button')].find(b => b.textContent === '2 bars').click(); });
    ok(await mp.evaluate(() => window.__daily.CFG.countIn === 2), 'choosing “2 bars” sets the count-in');
    ok(me.length === 0, 'no page errors during mixer tests' + (me.length ? ': ' + me.join(' | ') : ''));
  }
});
