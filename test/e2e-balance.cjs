/* Auto-balance: measure, plan, apply, undo. Runs in its own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-balance', async t => {
  const { ok, wait, BASE } = t, freshCtx = () => t.fresh();
  // v2.1 · auto-balance
  { const dp = await (await freshCtx()).newPage(), de = []; dp.on('pageerror', e => de.push(e.message));
    await dp.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'debug'); await wait(3500);
    await dp.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2000);
    await dp.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); const hb = document.getElementById('humbar'); if (hb) hb.remove();
      window.__wav = (sec, f, amp) => { const sr = 22050, n = Math.floor(sr * sec), b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * (f || 220) * i / sr) * 32000 * (amp || .3)), true); return b; };
    });
    // 0 · a pristine song needs nothing
    await dp.evaluate(() => window.__daily.autoBalance()); await wait(500);
    const p0 = await dp.evaluate(() => { const d = document.getElementById('abDlg'); return d ? { t: d.textContent, apply: !!d.querySelector('#abApply') } : null; });
    ok(p0 && /already sits well together/.test(p0.t) && !p0.apply, 'a fresh song with no recordings says nothing needs to change');
    await dp.evaluate(() => document.getElementById('abDlg').close()); await wait(200);
    // 1 · a loud vocal and a quiet guitar
    await dp.evaluate(async () => { const D = window.__daily; await D.dropTake(new File([window.__wav(6, 220, .8)], 'Loud Vocal.wav'), 'vox'); await D.dropTake(new File([window.__wav(6, 330, .03)], 'Quiet Guitar.wav'), 'gtr'); });
    await wait(500);
    // open through the Lanes menu button
    await dp.click('.tl-bar button:has-text("Lanes ▾")'); await wait(300);
    ok(await dp.evaluate(() => !!document.getElementById('lanesBal')), 'the Lanes menu offers Auto-balance');
    await dp.click('#lanesBal'); await wait(900);
    const pl = await dp.evaluate(() => { const d = document.getElementById('abDlg'); return { rows: [...d.querySelectorAll('.ab-r[data-id]')].map(r => [r.dataset.id.length > 4 ? 'take' : r.dataset.id, r.querySelector('.ab-n').textContent, r.querySelector('.ab-m').textContent, r.querySelector('.ab-l').textContent, r.querySelector('.ab-p').textContent]), apply: d.querySelector('#abApply') && d.querySelector('#abApply').textContent, g: window.__daily.TAKES.map(t => t.g) }; });
    ok(pl.rows.length === 2 && /Loud Vocal/.test(pl.rows[0][1]) && /LUFS/.test(pl.rows[0][2]) && /→/.test(pl.rows[0][3]) && /Quiet Guitar/.test(pl.rows[1][1]), 'the plan lists the measured vocal and guitar (' + JSON.stringify(pl.rows) + ')');
    ok(/Apply to 2 lanes/.test(pl.apply) && pl.g.join() === '1,1', 'nothing moves until Apply is pressed');
    await dp.click('#abApply'); await wait(400);
    const af = await dp.evaluate(() => { const D = window.__daily, m = t => D.lufsMeasure(t.dry, t.dry, t.sr).lufs, [v, g] = D.TAKES; return { v: m(v) + 20 * Math.log10(v.g), g: m(g) + 20 * Math.log10(g.g), gv: v.g, gg: g.g, pv: v.pan, pg: g.pan, undo: !!document.getElementById('abUndo') }; });
    ok(Math.abs(af.v + 16) < .4 && Math.abs(af.g + 19) < .4, 'after Apply the vocal sits at −16 LUFS and the guitar at −19 LUFS (' + af.v.toFixed(2) + ', ' + af.g.toFixed(2) + ')');
    ok(af.gv < 1 && af.gg > 1 && af.pv === 0 && af.pg === 0 && af.undo, 'the loud one comes down, the quiet one comes up, a single guitar stays centred and Undo is offered');
    ok(await dp.evaluate(() => { const sl = [...document.querySelectorAll('.tl-head input[type=range][title^="Take volume"]')].map(x => +x.value).sort((a, b) => a - b), want = window.__daily.TAKES.map(t => Math.sqrt(t.g)).sort((a, b) => a - b); return sl.length === 2 && sl.every((v, i) => Math.abs(v - want[i]) < .02); }), 'the lane faders show the new levels');
    await dp.click('#abUndo'); await wait(400);
    ok(await dp.evaluate(() => window.__daily.TAKES.map(t => t.g + ':' + t.pan).join() === '1:0,1:0' && !document.getElementById('abDlg')), 'Undo puts the levels and pans back exactly');
    // 2 · two guitars are spread left and right, a mixed-up band goes back to the reference balance
    await dp.evaluate(async () => { const D = window.__daily; await D.dropTake(new File([window.__wav(6, 392, .2)], 'Second Guitar.wav'), 'gtr'); D.S.mix.rhythm.g = 1.3; D.S.mix.rhythm.p = .9; D.S.mix.drums.g = .2; D.commit(false); });
    await dp.evaluate(() => window.__daily.autoBalance()); await wait(900);
    const p2 = await dp.evaluate(() => { const d = document.getElementById('abDlg'); return [...d.querySelectorAll('.ab-r[data-id]')].map(r => r.dataset.id + '|' + r.querySelector('.ab-l').textContent + '|' + r.querySelector('.ab-p').textContent); });
    ok(p2.some(x => /^rhythm\|/.test(x) && /R15|L15/.test(x)) && p2.some(x => /^drums\|/.test(x)), 'a lopsided band is brought back to the reference balance (' + p2.filter(x => /^(rhythm|drums)/.test(x)).join(' ; ') + ')');
    await dp.click('#abApply'); await wait(400);
    const a2 = await dp.evaluate(() => { const D = window.__daily, g = D.TAKES.filter(t => t.kind === 'gtr'); return { pans: g.map(t => t.pan).join(), r: D.S.mix.rhythm.g + ':' + D.S.mix.rhythm.p, d: D.S.mix.drums.g }; });
    ok(a2.pans === '-0.5,0.5' && a2.r === '0.75:-0.15' && a2.d === 0.8, 'two guitar takes are split left and right and the band is restored (' + JSON.stringify(a2) + ')');
    await dp.click('#abUndo'); await wait(300);
    ok(await dp.evaluate(() => window.__daily.S.mix.rhythm.g === 1.3 && window.__daily.S.mix.drums.g === .2 && window.__daily.TAKES.every(t => t.g === 1 && !t.pan)), 'Undo restores the band mix too');
    // 3 · a backing track is measured as it is heard
    await dp.evaluate(() => { const D = window.__daily, n = 22050 * 8, mk = (f, a) => { const x = new Int16Array(n); for (let i = 0; i < n; i++) x[i] = Math.round(Math.sin(2 * Math.PI * f * i / 22050) * 32767 * a); return x; };
      const S1 = D.STM; S1.sr = 22050; S1.n = n; S1.dur = n / 22050; S1.ch = { drumsL: mk(100, .5), drumsR: mk(100, .5), bass: mk(60, .3), vox: mk(500, .2), otherL: mk(800, .2), otherR: mk(800, .2) }; S1.vol = 1; S1.mute = false; });
    await dp.evaluate(() => window.__daily.autoBalance()); await wait(1200);
    const p3 = await dp.evaluate(() => { const r = document.querySelector('#abDlg .ab-r[data-id="trk"]'); return r ? [r.querySelector('.ab-m').textContent, r.querySelector('.ab-l').textContent] : null; });
    ok(p3 && /LUFS/.test(p3[0]), 'a loaded backing track is measured and listed (' + JSON.stringify(p3) + ')');
    await dp.click('#abApply'); await wait(300);
    const t3 = await dp.evaluate(() => { const D = window.__daily, S1 = D.STM, n = Math.min(S1.n, 22050 * 60), L = new Float32Array(n), R = new Float32Array(n); S1.mix.forEach((m, i) => { const c = S1.ch, d = i === 0 ? [c.drumsL, c.drumsR] : i === 1 ? [c.bass, c.bass] : i === 2 ? [c.vox, c.vox] : [c.otherL, c.otherR]; for (let j = 0; j < n; j++) { L[j] += d[0][j] / 32768; R[j] += d[1][j] / 32768; } });
      return { v: D.lufsMeasure(L, R, 22050).lufs + 20 * Math.log10(S1.vol), vol: S1.vol }; });
    ok(Math.abs(t3.v + 21) < .5 || (t3.vol >= 1.49 && t3.v < -21), 'with recordings present the backing track is set to −21 LUFS (' + t3.v.toFixed(2) + ' at ×' + t3.vol.toFixed(2) + ')');
    await dp.evaluate(() => { const D = window.__daily; D.STM.ch = null; D.STM.n = 0; D.STM.vol = 1; });
    // 4 · silent/short takes are left alone with a note
    await dp.evaluate(() => { const D = window.__daily; D.TAKES.length = 0; D.TAKES.push({ id: 'zz', kind: 'vox', name: 'Tiny', sr: 22050, dry: new Float32Array(500).fill(.1), g: 1, pan: 0, dur: .02, peaks: { mn: new Float32Array(1), mx: new Float32Array(1), per: 256 }, startSec: 0, mode: 'wet' }); D.bus.emit('takes'); D.S.mix.rhythm.g = .75; D.S.mix.rhythm.p = -.15; D.S.mix.drums.g = .8; });
    await dp.evaluate(() => window.__daily.autoBalance()); await wait(600);
    ok(await dp.evaluate(() => /“Tiny” is too quiet or too short to measure/.test(document.getElementById('abDlg').textContent)), 'a take too short to measure is left alone, with a note');
    ok(await dp.evaluate(() => window.__daily.BAL.busy === false), 'the balance dialog is not left busy');
    ok(de.length === 0, 'no page errors during auto-balance tests' + (de.length ? ': ' + de.join(' | ') : ''));
  }
});
