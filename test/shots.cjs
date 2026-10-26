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
    await p.ctx.close();
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
