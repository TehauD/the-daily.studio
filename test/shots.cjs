/* Regenerate the screenshots used in README.md and the guides (docs/screenshots/*.png).
   It drives a real browser with a fake microphone, so every picture shows the real app with the same demo song and the same synthetic recordings.
   Run:  npm run shots              (all)
         npm run shots -- clips io  (only the ones whose name contains one of these words)
   Options (environment): CHROMIUM_PATH=/path/to/chrome · NO_SANDBOX=1 (containers) · SHOTS_DIR=/where/to/write */
const { suite } = require('./lib.cjs');
const fs = require('node:fs'), path = require('node:path');
const OUT = process.env.SHOTS_DIR || path.join(__dirname, '..', 'docs', 'screenshots');
const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
const want = name => !only.length || only.some(w => name.includes(w));
const DARK = { lookMode: 'dark' }, LIGHT = { lookMode: 'light' };

/* a standard Type-1 MIDI file for the MIDI picture: melody, pad, bass, drums, 8 bars at 96 BPM in G */
function midi() {
  const vlq = n => { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; }, txt = s => [...Buffer.from(s, 'utf8')];
  const trk = ev => { ev = ev.slice().sort((a, b) => a.t - b.t || (a.o || 0) - (b.o || 0)); const d = []; let t = 0; ev.forEach(e => { d.push(...vlq(e.t - t), ...e.b); t = e.t; }); d.push(0, 0xFF, 0x2F, 0); const l = d.length; return [0x4D, 0x54, 0x72, 0x6B, l >>> 24, (l >> 16) & 255, (l >> 8) & 255, l & 255, ...d]; };
  const note = (ev, ch, m, v, t, d) => { ev.push({ t, b: [0x90 | ch, m, v], o: 1 }, { t: t + d, b: [0x80 | ch, m, 0], o: 0 }); }, name = s => ({ t: 0, b: [0xFF, 3, s.length, ...txt(s)] });
  const PPQ = 480, bl = PPQ * 4, us = Math.round(60e6 / 96), meta = [{ t: 0, b: [0xFF, 0x51, 3, us >> 16 & 255, us >> 8 & 255, us & 255] }, { t: 0, b: [0xFF, 0x58, 4, 4, 2, 24, 8] }, name('Conductor')];
  const mel = [name('Lead vocal')], pad = [name('Piano')], bass = [name('Bass')], dr = [name('Drums')];
  const prog = [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]], roots = [43, 40, 36, 38], mn = [71, 74, 71, 69, 67, 69, 71, 67, 64, 67, 71, 67, 66, 69, 74, 69];
  for (let b = 0; b < 8; b++) {
    const t0 = b * bl; prog[b % 4].forEach(m => note(pad, 1, m, 70, t0, bl - 20)); note(bass, 2, roots[b % 4], 90, t0, bl / 2); note(bass, 2, roots[b % 4] + 7, 90, t0 + bl / 2, bl / 2);
    for (let k = 0; k < 4; k++) note(mel, 0, mn[(b * 2 + k) % mn.length], 100, t0 + k * bl / 4, bl / 4 - 10); for (let k = 0; k < 8; k++) note(dr, 9, k % 2 ? 42 : 36, 90, t0 + k * bl / 8, 100);
  }
  return Buffer.from([0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 5, PPQ >> 8, PPQ & 255, ...[].concat(...[meta, mel, pad, bass, dr].map(trk))]);
}

suite('shots', async t => {
  const { ok, wait, poll } = t; fs.mkdirSync(OUT, { recursive: true });
  const cfgInit = c => `try { localStorage.setItem('fw.cfg', ${JSON.stringify(JSON.stringify(c))}); } catch (e) { }`;
  const asInit = c => new Function(cfgInit(c));
  const save = async (p, name, o = {}) => { if (!want(name)) return; const f = path.join(OUT, name + '.png'); await p.screenshot({ path: f, ...(o.clip ? { clip: o.clip } : {}) }); const n = fs.statSync(f).size; ok(n > 20000, 'wrote ' + name + '.png (' + Math.round(n / 1024) + ' KB)'); };
  const quiet = p => p.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach(x => x.remove()); const hb = document.getElementById('humbar'); if (hb) hb.remove(); });
  const wavB64 = (sec, f, o) => t.wav(t.tone(sec, f, o).data, 22050).toString('base64');
  /** two recordings on the arrangement: a vocal line and a guitar riff, as if they had just been recorded and dropped in */
  const takes = async p => {
    await p.evaluate(async ({ v, g }) => {
      const D = window.__daily, mk = (b64, n) => new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], n, { type: 'audio/wav' });
      await D.dropTake(mk(v, 'Lead vocal.wav'), 'vox'); D.T.cursor = 0; await D.dropTake(mk(g, 'Rhythm riff.wav'), 'gtr');
    }, { v: wavB64(20, 196, { voice: true, amp: .5 }), g: wavB64(20, 110, { amp: .5 }) });
    await wait(500); await quiet(p);
  };
  const clean = async p => { await quiet(p); await p.evaluate(() => { for (const d of document.querySelectorAll('dialog[open]')) try { d.close(); } catch (e) { } }); await wait(250); };
  const click = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  const byTitle = (p, re) => p.evaluate(src => { const r = new RegExp(src, 'i'), b = [...document.querySelectorAll('button')].find(x => x.getClientRects().length && (r.test(x.title || '') || r.test(x.textContent || ''))); if (b) b.click(); return !!b; }, re.source);

  /* ---------- desktop ---------- */
  {
    const p = await t.open({ w: 1500, h: 900, init: asInit(DARK) }); await takes(p);
    await p.evaluate(() => { const d = window.__daily; d.dockGo('rig'); d.T.cursor = 0; d.tkSelect(d.tkLeads()[0].id); const b = document.querySelector('#left .tab[data-id="tones"]'); if (b) b.click(); });
    await quiet(p); await p.evaluate(() => { const sc = document.querySelector('.tl-scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }); await wait(400);   // the arrangement shows the two take lanes
    await save(p, '01-rig-dark');

    if (want('24-clips') || want('25-clip') || want('34-lane')) {
      await p.evaluate(() => { const b = document.querySelector('.cmax[data-m="tl"]'); if (b) b.click(); }); await wait(700);
      await p.evaluate(() => { const d = window.__daily, lead = d.tkLeads()[0]; d.tkSelect(lead.id); d.T.cursor = 6 / d.slotDur(); }); await wait(300);
      await p.click('#clipSplit').catch(() => 0); await wait(500); await quiet(p);
      await save(p, '24-clips');
      // the clip's own menu (right-click)
      const box = await p.evaluate(() => { const h = document.querySelector('.tl-head.take'); if (!h) return null; const r = h.getBoundingClientRect(), cv = document.querySelector('#timeline canvas').getBoundingClientRect(); return { x: cv.left + 520, y: r.top + r.height / 2 }; });
      const blank = async () => { await p.mouse.click(700, 431); await wait(250); };   // a click on empty toolbar space closes a pop-up (Escape would also leave the maximised arrangement)
      if (box) { await p.mouse.click(box.x, box.y, { button: 'right' }); await wait(500); await save(p, '25-clip-menu'); await blank(); }
      if (want('34-lane')) { await p.evaluate(() => { const b = document.querySelector('.tl-head.take .fxchip'); if (b) b.click(); }); await wait(600); await save(p, '34-lane-fx'); await blank(); }
      await p.keyboard.press('Escape'); await wait(500);   // leave the maximised arrangement
    }
    await clean(p);

    if (want('26-io')) {   // the I/O card
      await click(p, '#left .tab[data-id="io"]'); await wait(700); await quiet(p);
      await save(p, '26-io'); await click(p, '#left .tab[data-id="tones"]'); await wait(300);
    }

    if (want('27-drop')) {   // an audio file dropped on the page
      await p.evaluate(b64 => { const f = new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'Tape demo.wav', { type: 'audio/wav' }); window.__daily.dropFiles([f]); }, wavB64(9, 165, { voice: true, amp: .5 }));
      await poll(() => p.$('.drop-dlg'), 6000); await wait(400); await save(p, '27-drop'); await clean(p);
    }

    if (want('28-balance')) {   // Auto-balance
      await byTitle(p, /Mastering preset/); await wait(400); await click(p, '#mstBal'); await poll(() => p.$('#abApply'), 15000); await wait(500);
      await save(p, '28-balance'); await clean(p);
    }
    if (want('29-master')) {   // the master menu
      await byTitle(p, /Mastering preset/); await wait(500); await save(p, '29-master'); await p.keyboard.press('Escape'); await p.mouse.click(5, 5); await clean(p);
    }
    if (want('30-render')) {   // the progress window of the fast render, mid-way
      await byTitle(p, /Settings/); await wait(300); await clean(p);
      await p.evaluate(() => { window.__daily.bounceMaster(); });
      await poll(() => p.evaluate(() => { const b = document.querySelector('#rndDlg .rnd-bar'); return b && +b.getAttribute('aria-valuenow') >= 25; }), 20000, 50); await save(p, '30-render');
      await click(p, '#rndCancel'); await wait(500); await clean(p);
    }
    if (want('31-midi')) {   // opening a MIDI file
      const m = midi(); await p.evaluate(b64 => { window.__daily.dropFiles([new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'Evening Light.mid', { type: 'audio/midi' })]); }, m.toString('base64'));
      await poll(() => p.$('#smfDlg'), 6000); await wait(400); await save(p, '31-midi'); await clean(p);
    }
    if (want('35-voice')) {   // the Voice window: the pitch ribbon against the notes of the key
      await p.evaluate(async () => { const d = window.__daily; try { await d.ioConnect(); } catch (e) { } d.S.key = 0; d.S.minor = false; d.S.scale = 'Major (Ionian)'; d.voxOpen(); });
      await wait(500);
      await p.evaluate(() => { const d = window.__daily, now = performance.now(), mel = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62]; d.VOX.hist.length = 0; for (let i = 0; i < 150; i++) { const k = Math.floor(i / 10), w = Math.sin(i * .9) * .12, off = (k % 5 === 3 ? .3 : 0); d.VOX.hist.push({ t: now - (150 - i) * 40, m: mel[k] + w + off, c: Math.round((w + off) * 100) }); } });
      await wait(150); await p.evaluate(() => { const d = window.__daily, now = performance.now(); d.VOX.hist.forEach((e, i) => { e.t = now - (150 - i) * 40; }); }); await wait(60);
      await quiet(p); await save(p, '35-voice'); await p.evaluate(() => window.__daily.voxClose()); await wait(300);
    }
    if (want('36-range')) {   // a marked stretch of a take, with the clip bar
      await p.evaluate(() => { const b = document.querySelector('.cmax[data-m="tl"]'); if (b) b.click(); }); await wait(700);
      await p.evaluate(() => { const d = window.__daily, lead = d.tkLeads()[0]; d.tkSelect(lead.id); d.tkrSet(lead, 5.2, 11.4); }); await wait(500); await quiet(p);
      await save(p, '36-range'); await p.evaluate(() => window.__daily.tkrClear()); await p.keyboard.press('Escape'); await wait(500);
    }
    if (want('37-heatmap')) {   // the fretboard heatmap: where a player spends their time
      await p.evaluate(() => { const d = window.__daily; d.dockGo('fret'); d.S.key = 0; d.S.minor = false; d.S.scale = 'Major (Ionian)'; d.FB.root = 0; d.heatReset(); d.bus.emit('song'); const sel = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'heat')); if (sel) { sel.value = 'heat'; sel.dispatchEvent(new Event('change')); }
        const spots = [[3, 2, 5, 4], [2, 2, 3, 2], [2, 0, 2, 3], [1, 3, 4, 3], [1, 1, 1.5, 2], [0, 3, 3, 3], [4, 1, 2.5, 0], [3, 0, 1, 1], [2, 4, 2, 2], [4, 3, 1, 8], [5, 0, 1.5, 3], [1, 5, 1, 1], [0, 5, 1, 2], [5, 3, 1, 3], [3, 5, 2, 1]];
        spots.forEach(([st, f, sec, cents]) => d.heatLive({ midi: d.S.tuning[st] + d.S.capo + f, cs: new Array(10).fill(cents), cam: [{ st, fret: f }] }, sec));
        d.heatLive({ midi: d.S.tuning[2] + 6, cs: new Array(10).fill(14), cam: [{ st: 2, fret: 6 }] }, 1.2); d.FB.mode = 'heat'; d.HEAT.view = 'where'; d.HEAT.src = 'live'; d.renderFret(); }); await wait(600); await quiet(p);
      await save(p, '37-heatmap'); await p.evaluate(() => { const d = window.__daily; d.HEAT.view = 'tune'; d.renderFret(); }); await wait(300); await save(p, '38-heatmap-tuning');
      await p.evaluate(() => { const d = window.__daily; d.heatReset(); d.FB.mode = 'scale'; d.renderFret(); });
    }
    if (want('39-backdrop')) {   // the performer backdrop on the stage: dimmed visuals and a lower third
      await p.evaluate(async () => { const d = window.__daily; try { await d.ioConnect(); } catch (e) { } d.S.sections = [{ id: 'a', name: 'Verse', lyrics: 'Morning light on the window sill\nSomething waits and I stand still', bars: [{ chord: 'G', tab: [] }, { chord: 'Em', tab: [] }, { chord: 'C', tab: [] }, { chord: 'D', tab: [] }] }]; d.commit(false); d.STG.pb.on = true; d.STG.pb.bg = 'visuals'; d.STG.pb.lower = true; d.dockGo('stage'); d.T.cursor = 0; await d.play(); });
      await wait(3200); await p.evaluate(() => { const w = document.querySelector('.stagewrap'); if (w) w.scrollIntoView({ block: 'center' }); const hb = document.querySelector('.stagehud'); if (hb) hb.style.display = 'none'; }); await wait(400); await quiet(p); await save(p, '39-backdrop'); await p.evaluate(() => { const d = window.__daily; d.stopPlay(true); d.STG.pb.on = false; });
    }
    await p.ctx.close();
  }

  /* ---------- Concert: the three lenses at 16:9, and the Monitor views card ---------- */
  if (want('40-concert') || want('41-concert') || want('42-concert') || want('43-monitor')) {
    const p = await t.open({ w: 1920, h: 1080, init: asInit(DARK) });
    await p.evaluate(async () => { const d = window.__daily; try { await d.ioConnect(); } catch (e) { } d.S.key = 0; d.S.minor = false; d.S.title = 'Morning Light'; d.S.sections = [{ id: 'a', name: 'Verse', lyrics: 'Morning light on the window sill\nSomething waits and I stand still', bars: [{ chord: 'C', tab: [] }, { chord: 'Am', tab: [] }, { chord: 'F', tab: [] }, { chord: 'G', tab: [] }] }, { id: 'b', name: 'Chorus', lyrics: 'Oh we rise\nInto the light', bars: [{ chord: 'F', tab: [] }, { chord: 'G', tab: [] }, { chord: 'Em', tab: [] }, { chord: 'Am', tab: [] }] }]; d.commit(false); d.STG.pb.on = false; d.STG.pb.lower = true; d.STG.pb.bg = 'visuals'; d.STG.pb.dim = .1; d.STG.cur = 0; d.dockGo('stage'); d.T.cursor = 4 * 16 - 8; await d.play(); });
    await wait(3000);
    const grab = async (name, lens, pb) => {
      if (!want(name)) return;
      await p.evaluate(([lens, pb]) => { const d = window.__daily; d.STG.pb.on = pb; d.lxSetLens(lens); const w = document.querySelector('.stagewrap'); w.style.aspectRatio = '16/9'; document.querySelectorAll('#toasts .toast').forEach(x => x.remove()); }, [lens, pb]); await wait(2200);
      const url = await p.evaluate(() => document.querySelector('.stagewrap canvas').toDataURL('image/png')); const f = path.join(OUT, name + '.png'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log('shot ' + name + ' ' + Math.round(fs.statSync(f).size / 1024) + ' kB');
    };
    await grab('40-concert-perform', 'perform', true); await grab('41-concert-teach', 'teach', false); await grab('42-concert-sky', 'sky', false);
    await p.evaluate(() => { const d = window.__daily; d.lxSetLens('perform'); d.STG.pb.on = false; d.stopPlay(true); });
    if (want('43-monitor')) {
      await p.evaluate(() => { const d = window.__daily; d.dockGo('vis'); d.sideShow('monitor'); const c = document.querySelector('.mon-chip[data-w="views"]'); if (c && !c.classList.contains('on')) c.click(); }); await wait(2500); await quiet(p);
      const box = await p.evaluate(() => { const c = document.getElementById('mvCard'); if (!c) return null; c.scrollIntoView({ block: 'center' }); const r = document.getElementById('right').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
      if (box) { await wait(500); await save(p, '43-monitor-views', { clip: { x: box.x, y: box.y, width: Math.min(box.w, 520), height: Math.min(box.h, 1000) } }); }
    }
    await p.ctx.close();
  }

  /* ---------- the six looks on the demo song, and the Show setup console ---------- */
  const SHOWS = [['46-look-theatre', 'theatre'], ['47-look-backlight', 'backlight'], ['48-look-blades', 'blades'], ['49-look-pixels', 'pixels'], ['50-look-horizon', 'horizon'], ['51-look-lasers', 'lasers']];
  const CONSOLE = [['52-show-setup', 'looks'], ['53-show-cues', 'cues'], ['54-show-output', 'out']];
  if (SHOWS.some(x => want(x[0])) || CONSOLE.some(x => want(x[0]))) {
    const p = await t.open({ w: 1280, h: 720, init: asInit(DARK) });
    await p.evaluate(async () => { const d = window.__daily; try { await d.ioConnect(); } catch (e) { } d.STG.comfort = 'full'; });
    for (const [name, id] of SHOWS) {
      if (!want(name)) continue;
      await p.evaluate(async id => {
        const d = window.__daily; d.STG.cur = d.SHOW_DESIGNS.findIndex(x => x.id === id); d.dockGo('stage'); const w = document.querySelector('.stagewrap'); if (w) w.style.aspectRatio = '16/9';
        let bi = 0; for (const s of d.S.sections) { if (d.lxKind(s.name) === 'chorus') break; bi += s.bars.length; } d.stopPlay(true); d.T.cursor = bi * 16; d.LX.lastStrobeBar = -1; await d.play(); document.querySelectorAll('#toasts .toast').forEach(x => x.remove());
      }, id);
      await wait(4600);
      const url = await p.evaluate(() => document.querySelector('.stagewrap canvas').toDataURL('image/png')); const f = path.join(OUT, name + '.png'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); ok(fs.statSync(f).size > 20000, 'wrote ' + name + '.png (' + Math.round(fs.statSync(f).size / 1024) + ' KB)');
      await p.evaluate(() => window.__daily.stopPlay(true));
    }
    await p.ctx.close();
    if (CONSOLE.some(x => want(x[0]))) {
      const q = await t.open({ w: 1500, h: 1000, init: asInit(DARK) });
      await q.evaluate(async () => { const d = window.__daily; try { await d.ioConnect(); } catch (e) { } d.STG.comfort = 'standard'; d.applyPreset(d.LAYOUTS.find(l => l[0] === 'Show')[2], 'Show'); d.shOpen('scene', 'looks'); });
      await wait(1500); await q.evaluate(() => document.activeElement && document.activeElement.blur()); await q.keyboard.press('6'); await wait(1200);
      for (const [name, tab] of CONSOLE) {
        if (!want(name)) continue;
        await q.evaluate(([tab]) => { const d = window.__daily; d.SHC.tab = tab; d.shcDraw(); if (tab === 'cues') { d.SHC.kind = 'chorus'; d.shcDraw(); d.lxPreview('chorus', { sec: 60 }); } document.querySelectorAll('#toasts .toast').forEach(x => x.remove()); }, [tab]);
        await wait(tab === 'cues' ? 3200 : 1500); await quiet(q); await save(q, name);
      }
      await q.ctx.close();
    }
  }

  /* ---------- the layout picker and four of the layouts ---------- */
  if (['55-layouts', '56-layout-write', '57-layout-arrange', '58-layout-show'].some(want)) {
    const p = await t.open({ w: 1600, h: 950, init: asInit(DARK) }); await takes(p);
    const go = async n => { await p.evaluate(n => { const d = window.__daily, l = d.LAYOUTS.find(x => x[0] === n); d.applyPreset(l[2], n); document.querySelectorAll('#toasts .toast').forEach(x => x.remove()); }, n); await wait(1500); await quiet(p); };
    for (const [name, lay] of [['56-layout-write', 'Write'], ['57-layout-arrange', 'Arrange'], ['58-layout-show', 'Show']]) { if (!want(name)) continue; await go(lay); await save(p, name); }
    if (want('55-layouts')) { await go('Studio'); await p.evaluate(() => document.getElementById('wsBtn').click()); await wait(700); await save(p, '55-layouts'); }
    await p.ctx.close();
  }

  /* ---------- 2.7: the goals on the first page, a guided session, the Show preflight, a note on a tab ---------- */
  if (['59-goals', '60-session-record', '61-session-hum', '62-show-preflight', '63-tab-note', '64-goals-phone', '65-session-phone'].some(want)) {
    const FR = new Function(`try { localStorage.removeItem('fw.started'); localStorage.setItem('fw.cfg', ${JSON.stringify(JSON.stringify(DARK))}); } catch (e) { }`);
    const first = async (o, goal) => { const p = await t.open({ boot: false, init: FR, ...o }); await p.goto(t.BASE + '?debug'); await wait(3800); if (!goal) return p; await p.evaluate(g => document.querySelector('.boot-goal[data-goal="' + g + '"]').click(), goal); await poll(() => p.evaluate(() => !!document.getElementById('gd')), 9000); await wait(1500); await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach(x => x.remove())); return p; };
    if (want('59-goals')) { const p = await first({ w: 1440, h: 900 }); await save(p, '59-goals'); await p.ctx.close(); }
    if (want('64-goals-phone')) { const p = await first({ w: 390, h: 844, mobile: true, dpr: 2 }); await save(p, '64-goals-phone'); await p.ctx.close(); }
    if (want('65-session-phone')) { const p = await first({ w: 390, h: 844, mobile: true, dpr: 2 }, 'loop'); await save(p, '65-session-phone'); await p.ctx.close(); }
    if (want('60-session-record')) { const p = await first({ w: 1440, h: 900 }, 'loop'); await save(p, '60-session-record'); await p.ctx.close(); }
    if (want('61-session-hum')) { const p = await first({ w: 1440, h: 900 }, 'hum'); await poll(() => p.$('#humGo2'), 6000); await wait(500); await save(p, '61-session-hum'); await p.ctx.close(); }
    if (want('62-show-preflight')) {
      const p = await first({ w: 1500, h: 1000 }, 'show'); await p.evaluate(() => { const d = window.__daily; d.shOpen('scene', 'out'); d.GD.pf.look = 1; d.GD.pf.rig = 1; d.GD.pf.out = 1; d.GD.pf.test = 1; }); await wait(1400); await p.evaluate(() => document.querySelector('#gdPf').scrollIntoView({ block: 'center' })); await wait(700); await save(p, '62-show-preflight'); await p.ctx.close();
    }
    if (want('63-tab-note')) {
      const p = await first({ w: 1440, h: 900 }); await p.evaluate(() => document.getElementById('bootNoMic').click()); await wait(3200); await p.evaluate(() => { const d = window.__daily; d.guideStop(true); d.zoomSet('song', true); d.dockGo('band'); }); await wait(900); await p.evaluate(() => document.querySelectorAll('#toasts .toast,#tourOffer').forEach(x => x.remove())); await save(p, '63-tab-note'); await p.ctx.close();
    }
  }

  /* ---------- 2.8: Loop & layer, two layers and the strip ---------- */
  if (want('66-loop-layer')) {
    const p = await t.open({ w: 1440, h: 900, debug: true, init: asInit(DARK) });
    await p.evaluate(async () => { const d = window.__daily; d.S.bpm = 150; d.S.sections = [Object.assign({}, d.S.sections[0], { bars: d.S.sections[0].bars.slice(0, 2) })]; d.CFG.countIn = 1; d.CFG.vin = 'off'; d.commit(false); await d.ioConnect(); await d.looperStart({ bars: 1, band: false }); });
    await poll(() => p.evaluate(() => window.__daily.TAKES.length >= 2 && window.__daily.LP.pass >= 3), 20000); await p.evaluate(() => { const d = window.__daily, l = d.LAYOUTS.find(x => x[0] === 'Arrange'); d.applyPreset(l[2], 'Arrange'); }); await wait(1500); await quiet(p);
    await save(p, '66-loop-layer'); await p.evaluate(() => window.__daily.looperEnd()); await p.ctx.close();
  }

  /* ---------- 2.9: the Write canvas inside the Songwriter workspace, and on a phone ---------- */
  if (['67-write-canvas', '68-write-phone'].some(want)) {
    const prep = async p => p.evaluate(async () => {
      const d = window.__daily; await d.ioConnect(); d.goalGo('songwriter'); d.dockGo('tab'); d.wrMode('both'); d.TE.sec = 0; d.TE.bi = 0; d.TE.slot = 0;
      d.S.sections[0].bars.forEach(b => { b.tab = []; b.chord = ''; });
      const put = (slot, notes, sym) => { const r = d.capInterpret(notes, null) || { items: d.capAssign(notes), sym }; d.capPut(slot, r.items, { sym: r.sym || sym }); };
      put(0, [40, 47, 52, 55, 59, 64], 'Em'); put(6, [45]); put(8, [52]); put(10, [55]); put(12, [57]); put(14, [59]);
      d.CAP.on = true; d.capSay('Em: E2 B2 E3 G3 B3 E4', 'ok'); d.CAP.count0 = 0; d.CAP.count = 11; d.wrCapUI(); d.renderTab();
    });
    if (want('67-write-canvas')) { const p = await t.open({ w: 1440, h: 900, debug: true, init: asInit(DARK) }); await prep(p); await wait(1200); await quiet(p); await save(p, '67-write-canvas'); await p.ctx.close(); }
    if (want('68-write-phone')) { const p = await t.open({ w: 390, h: 844, debug: true, mobile: true, dpr: 2, init: asInit(DARK) }); await prep(p); await p.evaluate(() => window.__daily.mGo && window.__daily.mGo('write', 'tab')); await wait(1200); await quiet(p); await save(p, '68-write-phone'); await p.ctx.close(); }
  }

  /* ---------- 2.10: the default hexagon again, and a sheet of the ten harmony looks ---------- */
  if (want('69-hex-default')) {
    const p = await t.open({ w: 1440, h: 900, debug: true, init: asInit(DARK) });
    await p.evaluate(async () => { const d = window.__daily; await d.ioConnect(); d.dockGo('vis'); }); await wait(2500); await quiet(p); await save(p, '69-hex-default'); await p.ctx.close();
  }
  if (want('70-harmony-looks')) {
    const p = await t.open({ w: 1280, h: 720, debug: true, init: asInit(DARK) });
    await p.evaluate(async () => {
      const d = window.__daily; await d.ioConnect(); d.CFG.rtt = 0; d.dockGo('vis'); d.CFG.vzNeck = false; d.vzImmersive(true); d.HM.force = 'Gmaj7';
      window.__sim = setInterval(() => { const tt = performance.now() / 1000, notes = [67, 71, 72, 71, 69, 74, 66, 71], k = Math.floor(tt / 1.1), m = notes[k % 8] + Math.sin(tt * 5) * .06 + (k % 3 === 0 ? .18 : 0); d.VOX.m = m; d.VOX.cents = (m - Math.round(m)) * 100; d.VOX.f = [1, 2, 3]; d.VOX.hist.push({ t: performance.now(), m, c: .9 }); d.VOX.db = -22; d.VOX.vlo = 55; d.VOX.vhi = 78; }, 30);
      window.__ons = setInterval(() => d.bus.emit('onset', {}), 260);
    });
    const tiles = [], names = ['gravity', 'field', 'swarms', 'mood', 'dna', 'stars', 'fluid', 'paint'];
    for (const m of names) { await p.evaluate(m => window.__daily.vzSetMode(m), m); await wait(3500); const f = path.join(OUT, '.tile-' + m + '.png'); await p.screenshot({ path: f }); tiles.push(f); }
    const out = path.join(OUT, '70-harmony-looks.png');
    require('node:child_process').execFileSync('python3', ['-c', 'import sys\nfrom PIL import Image\nout=sys.argv[1]; fs=sys.argv[2:]\nW,H=640,360\nsh=Image.new("RGB",(W*2,H*4),(7,7,10))\nfor i,f in enumerate(fs):\n    im=Image.open(f).convert("RGB").resize((W,H),Image.LANCZOS); sh.paste(im,((i%2)*W,(i//2)*H))\nsh.save(out,optimize=True)', out, ...tiles]);
    tiles.forEach(f => fs.unlinkSync(f)); const n = fs.statSync(out).size; ok(n > 20000, 'wrote 70-harmony-looks.png (' + Math.round(n / 1024) + ' KB)'); await p.ctx.close();
  }

  /* ---------- 2.11: the audience view ---------- */
  if (want('72-audience-view')) {
    const p = await t.open({ w: 1440, h: 900, debug: true, init: asInit(DARK) });
    await p.evaluate(async () => { const d = window.__daily; await d.ioConnect(); const L = d.LAYOUTS.find(x => x[0] === 'Record'); d.applyPreset(L[2], 'Record'); d.dockGo('tab'); d.vzSetMode('concert'); d.play(); document.getElementById('audCam').click(); });
    await wait(1800); await p.evaluate(() => { const b = document.getElementById('mpAskNo'); if (b) b.click(); }); await p.selectOption('#audCard select[aria-label="Camera look"]', 'edges'); await wait(2500); await quiet(p); await save(p, '72-audience-view'); await p.ctx.close();
  }

  if (want('73-welcome-back') || want('74-welcome-back-light') || want('75-my-progress')) {
    const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const mkJ = (gap, recent) => {                  // an invented history for the picture: 87 sessions, 14 chords, 23 ideas, 4 finished songs
      const days = {}; let s = 0; for (let i = gap; i < gap + 5; i++) { days[day(i)] = { t: 1500, s: 1, i: 0 }; s++; }
      for (let i = 0; s < 87; i++) { const k = day(gap + 6 + i * (recent ? 1 : 2)); if (!days[k]) { days[k] = { t: 600 + (i * 137) % 2400, s: 1, i: 0 }; s++; } }
      const ks = Object.keys(days).sort(); for (let n = 0; n < 23; n++) days[ks[(n * 3) % ks.length]].i += 1;
      const cs = ['C', 'G', 'Am', 'F', 'Em', 'Dm', 'D', 'A', 'E', 'Bm', 'G7', 'Cmaj7', 'Am7', 'Dsus4'], learned = {}, heard = {}; cs.forEach((c, i) => { learned[c] = day(gap + 20 + i * 6); heard[c] = 9; });
      const songs = {}; [gap + 5, gap + 40, gap + 80, gap + 120].forEach((n, i) => { songs['s' + i] = { title: 'Song ' + i, at: Date.now() - n * 864e5, day: day(n) }; });
      return { v: 1, since: Date.now() - 400 * 864e5, days, old: { t: 0, s: 0, i: 0 }, heard, learned, songs, focus: '90s Alternative Guitar',
        pairs: { 'G>C': { n: 34, h: '110111111110111111101111111111', f: '0100100010', at: Date.now() }, 'Am>F': { n: 18, h: '101101110111110111', f: '0110100110', at: Date.now() }, 'D>A': { n: 9, h: '110101111', f: '110101111', at: Date.now() } },
        last: { song: { title: 'Maybe Today Demo', artist: '', at: Date.now() - gap * 864e5 }, rec: { name: 'Maybe Today Demo', kind: 'take', at: Date.now() - gap * 864e5, song: 'Maybe Today Demo' } } };
    };
    const seedJ = (J, look) => `try{localStorage.setItem('fw.jn',${JSON.stringify(JSON.stringify(J))});${look ? `localStorage.setItem('fw.cfg',JSON.stringify({lookMode:'${look}'}));` : ''}}catch(e){}`;
    const first = async (j, look) => { const p = await t.open({ w: 1280, h: 900, boot: false, init: seedJ(j, look) }); await p.goto(t.BASE + (t.BASE.includes('?') ? '&' : '?') + 'debug'); await wait(3500); return p; };
    if (want('73-welcome-back')) { const p = await first(mkJ(2, true), 'dark'); await save(p, '73-welcome-back'); await p.ctx.close(); }
    if (want('74-welcome-back-light')) { const p = await first(mkJ(90, false), 'light'); await save(p, '74-welcome-back-light'); await p.ctx.close(); }
    if (want('75-my-progress')) {
      const p = await t.open({ w: 1280, h: 900, debug: true, init: seedJ(mkJ(0, true), 'dark') }); await p.evaluate(() => window.__daily.progressOpen()); await wait(700); await save(p, '75-my-progress'); await p.ctx.close();
    }
  }

  if (want('76-view-menu') || want('77-edge-tabs')) {
    const p = await t.open({ w: 1440, h: 900, debug: true, init: asInit(DARK) }); await takes(p); await quiet(p);
    if (want('77-edge-tabs')) { await wait(400); await save(p, '77-edge-tabs'); }
    if (want('76-view-menu')) { await p.evaluate(() => document.getElementById('wsBtn').click()); await wait(500); await save(p, '76-view-menu'); }
    await p.ctx.close();
  }

  // 2.12: hexagon colours and the "Behind you" looks
  const BACK = [['78-behind-ribbons', 'ribbons'], ['79-behind-aurora', 'aurora'], ['80-behind-warp', 'warp'], ['81-behind-rings', 'rings'], ['82-behind-nebula', 'nebula'], ['83-behind-skyline', 'skyline']];
  if (want('84-hex-colours') || BACK.some(([n]) => want(n))) {
    const p = await t.open({ w: 1440, h: 810, debug: true, init: asInit(DARK) }); await takes(p);
    await p.evaluate(async () => { const d = window.__daily; await d.ioConnect(); d.CFG.vzNeck = false; d.dockGo('vis'); d.HM.force = 'Am'; d.play && d.play(); window.__sim = setInterval(() => d.bus.emit('onset', {}), 400); });
    for (const [n, m] of BACK) if (want(n)) { await p.evaluate(m => window.__daily.vzSetMode(m), m); await wait(2600); await save(p, n); }
    if (want('84-hex-colours')) { await p.evaluate(() => { const d = window.__daily; d.vzSetMode('hex'); d.hexSet('custom'); const i = document.querySelector('#hexTone input[data-c="bg"]'); i.value = '#0b1a3a'; i.dispatchEvent(new Event('input', { bubbles: true })); const j = document.querySelector('#hexTone input[data-c="cell"]'); j.value = '#ff6a3d'; j.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(1800); await save(p, '84-hex-colours'); }
    await p.ctx.close();
  }

  /* ---------- the light theme, the start card, the canvas, the songs window, appearance and about ---------- */
  {
    const p = await t.open({ w: 1500, h: 900, init: asInit(LIGHT) }); await takes(p);
    await p.evaluate(() => { const d = window.__daily; d.dockGo('rig'); d.T.cursor = 0; d.tkSelect(d.tkLeads()[0].id); const b = document.querySelector('#left .tab[data-id="tones"]'); if (b) b.click(); }); await wait(300); await quiet(p);
    await p.evaluate(() => { const sc = document.querySelector('.tl-scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }); await wait(300);
    await save(p, '02-rig-light');
    if (want('17-hum-start')) { await p.evaluate(() => { document.querySelector('.sb-new').click(); }); await poll(() => p.$('dialog[open] .pd-grid, dialog[open] .og, dialog[open]'), 4000); await wait(700); await save(p, '17-hum-start'); await clean(p); }
    if (want('18-hum-screen')) { await p.evaluate(() => window.__daily.humOpen()); await wait(800); await save(p, '18-hum-screen'); await clean(p); }
    if (want('13-canvas')) { await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Canvas' && x.getClientRects().length); if (b) b.click(); }); await wait(900); await quiet(p); await save(p, '13-canvas'); }
    if (want('14-songs')) {
      await p.evaluate(() => { const D = window.__daily; return D.projSave && D.projSave(); }); await wait(600);
      await byTitle(p, /^Songs: new/); await wait(500); await p.evaluate(() => { const b = [...document.querySelectorAll('.pd-menu button')].find(x => /All songs/.test(x.textContent)); if (b) b.click(); }); await wait(900); await quiet(p); await save(p, '14-songs'); await clean(p);
    }
    if (want('15-appearance')) { await byTitle(p, /^Appearance/); await wait(800); await save(p, '15-appearance'); await clean(p); }
    if (want('16-about')) { await byTitle(p, /^Help & shortcuts/); await wait(700); await p.evaluate(() => { const a = document.querySelector('dialog[open] .ab'); if (a) a.scrollIntoView({ block: 'start' }); }); await wait(600); await save(p, '16-about'); await clean(p); }
    if (want('45-privacy')) { await byTitle(p, /^Help & shortcuts/); await wait(700); await p.evaluate(() => { const d = document.getElementById('abPriv'); if (d) { d.open = true; d.scrollIntoView({ block: 'center' }); } }); await wait(600); await save(p, '45-privacy'); await clean(p); }
    await p.ctx.close();
  }
  if (want('44-consent')) {   // the stage route: the camera is on, and the one-time download is a question, not a surprise
    const p = await t.open({ w: 1500, h: 900, boot: false, init: new Function(`try { localStorage.removeItem('fw.started'); localStorage.setItem('fw.cfg', ${JSON.stringify(JSON.stringify(DARK))}); } catch (e) { }`) });
    await p.ctx.grantPermissions(['camera', 'microphone']); await p.ctx.route(/jsdelivr|googleapis/, r => r.abort());
    await p.goto(t.BASE + '?debug'); await wait(3600); await p.evaluate(() => document.getElementById('bootStage').click());
    await poll(() => p.evaluate(() => !!document.getElementById('mpAsk')), 20000); await wait(1500); await save(p, '44-consent'); await p.ctx.close();
  }
  if (want('12-start')) {
    const p = await t.open({ w: 1500, h: 900, boot: false, init: new Function(`try { localStorage.removeItem('fw.started'); localStorage.setItem('fw.cfg', ${JSON.stringify(JSON.stringify(DARK))}); } catch (e) { }`) });
    await p.goto(t.BASE + '?debug'); await wait(4200); await save(p, '20-boot');
    await p.evaluate(() => { const b = document.getElementById('bootNoMic'); if (b) b.click(); }); await wait(2600); await quiet(p); await save(p, '12-start'); await p.ctx.close();
  }

  if (want('19-hum-stage')) {   // listening: the Hum to Song bar over the studio
    const p = await t.open({ w: 1500, h: 900, init: asInit(DARK) });
    await p.evaluate(() => window.__daily.humOpen()); await wait(700); await p.evaluate(() => { const c = document.getElementById('humStage'); if (c && c.checked) c.click(); }); await wait(300);
    await click(p, '#humGo'); await poll(() => p.$('#humbar'), 6000); await wait(3200); await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach(x => x.remove())); await save(p, '19-hum-stage'); await p.ctx.close();
  }

  /* ---------- the keep-songs-safe card on an iPhone in Safari ---------- */
  if (want('32-keep')) {
    const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    const c = await t.browser.newContext({ viewport: { width: 1500, height: 900 }, userAgent: IOS, permissions: ['microphone'] }); await c.addInitScript(() => { try { localStorage.setItem('fw.started', 'true'); localStorage.setItem('fw.cfg', '{"lookMode":"dark"}'); } catch (e) { } });
    const p = await c.newPage(); p.ctx = c; await t.boot(p); await p.evaluate(() => window.__daily.keepOpen()); await wait(700); await quiet(p); await save(p, '32-keep'); await c.close();
  }

  /* ---------- phone ---------- */
  const phone = {};
  if (want('11-mobile') || want('33-phone')) {
    const p = await t.open({ w: 390, h: 844, mobile: true, dpr: 2, init: asInit(DARK) }); await takes(p); await quiet(p);
    const shot = async k => { await quiet(p); await wait(300); phone[k] = await p.screenshot(); };
    await p.evaluate(() => { const d = window.__daily; d.T.cursor = 0; d.tkSelect(d.tkLeads()[0].id); }); await wait(300);
    await p.click('#mnav >> text=Play').catch(() => 0); await wait(700); await shot('play');
    await p.click('#mnav >> text=Write').catch(() => 0); await wait(700); await shot('write');
    await p.click('.msc.tl').catch(() => 0); await wait(700); await shot('clips'); await p.click('.msc.tl').catch(() => 0); await wait(400);
    await p.click('.mmore').catch(() => 0); await wait(800); await shot('more'); await p.keyboard.press('Escape'); await clean(p);
    await p.evaluate(b64 => { window.__daily.dropFiles([new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'Evening Light.mid', { type: 'audio/midi' })]); }, midi().toString('base64'));
    await poll(() => p.$('#smfDlg'), 6000); await wait(500); await shot('midi'); await clean(p);
    await p.ctx.close();
    const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    const c = await t.browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IOS, permissions: ['microphone'] }); await c.addInitScript(() => { try { localStorage.setItem('fw.started', 'true'); localStorage.setItem('fw.cfg', '{"lookMode":"dark"}'); } catch (e) { } });
    const q = await c.newPage(); q.ctx = c; await t.boot(q); await q.evaluate(() => window.__daily.keepOpen()); await wait(800); await quiet(q); phone.keep = await q.screenshot(); await c.close();
  }
  /** phones side by side on a quiet background: one picture */
  const sheet = async (name, keys, w, h) => {
    if (!want(name)) return; const imgs = keys.map(k => phone[k] && phone[k].toString('base64')).filter(Boolean); if (imgs.length < keys.length) { ok(false, name + ': missing phone pictures'); return; }
    const c = await t.browser.newContext({ viewport: { width: w, height: h } }), q = await c.newPage();
    await q.setContent(`<body style="margin:0;background:radial-gradient(1200px 700px at 50% 0%,#14303a,#0a1418);display:flex;gap:${keys.length > 3 ? 18 : 28}px;align-items:center;justify-content:center;height:100vh;overflow:hidden">${imgs.map(b => `<img src="data:image/png;base64,${b}" style="height:${h - 46}px;border-radius:34px;border:6px solid #05090b;box-shadow:0 18px 50px #000a,0 0 0 1px #2c4650">`).join('')}</body>`);
    await wait(500); await save(q, name); await c.close();
  };
  await sheet('11-mobile', ['play', 'write', 'more'], 1500, 900);
  await sheet('33-phone-new', ['clips', 'midi', 'keep'], 1500, 900);
});
