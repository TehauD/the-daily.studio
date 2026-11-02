/* The pictures on the newer guide pages (site/img/*.webp), made from the app itself at 1280 × 720 and encoded to WebP by the browser
   (canvas.toDataURL), so nothing outside this repository is needed. Uses Chromium's synthetic camera and generated tones only.
     node test/guide-shots.cjs            all of them
     node test/guide-shots.cjs perform    just one (start, record, tones, stems, tab, hum, show, perform, sync) */
const { suite } = require('./lib.cjs');
const fs = require('node:fs'), path = require('node:path');
const OUT = path.join(__dirname, '..', 'site', 'img'), want = n => !process.argv[2] || process.argv.slice(2).includes(n);
const SHEET = '[Verse 1]\nG              D/F#\nLanterns swing along the harbour wall\nEm             C\nAnd the gulls are calling out\nG        D\nOne more light along the shore\nC        G\nAnd one more after that\n[Chorus]\nC        G\nHold on, hold on\nEm       D\nThe tide will bring you home';

suite('guide-shots', async t => {
  const { ok, wait } = t;
  const init = () => { try { localStorage.setItem('fw.cfg', JSON.stringify({ lookMode: 'dark' })); } catch (e) { } window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Dropbox', { create: true }); window.__syncDelay = 1e9; };
  const quiet = p => p.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach(x => x.remove()); const hb = document.getElementById('humbar'); if (hb) hb.remove(); });
  /** the page as it is now, as a WebP file */
  const save = async (p, name) => {
    const png = (await p.screenshot()).toString('base64');
    const b64 = await p.evaluate(async png => { const im = new Image(); im.src = 'data:image/png;base64,' + png; await im.decode(); const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 1280; c.height = 720; g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, 1280, 720); return c.toDataURL('image/webp', .8).split(',')[1]; }, png);
    const f = path.join(OUT, name + '.webp'); fs.writeFileSync(f, Buffer.from(b64, 'base64')); const n = fs.statSync(f).size;
    ok(n > 15000 && n < 160000 && Buffer.from(b64, 'base64').toString('latin1', 8, 12) === 'WEBP', 'wrote ' + name + '.webp (' + Math.round(n / 1024) + ' kB)');
  };
  if (want('start')) {      /* the first page: the six goals and the ways in */
    const b = await t.open({ w: 1600, h: 900, init, boot: false }); await b.evaluate(() => { window.name = 'noseed'; }); await b.goto(t.BASE); await wait(3200);      /* a first visit: the goals, not "welcome back" */ await quiet(b); await save(b, 'start'); await b.ctx.close();
  }
  const p = await t.open({ w: 1280, h: 720, init });
  await p.evaluate(async s => { const D = window.__daily; await D.projCreate('blank', { form: 'empty' }); await window.dailyStudio.call('load_chord_sheet', { text: s }); D.S.title = 'Harbour Lights'; D.S.artist = 'The Test Band'; D.commit(false); await D.projSave(); }, SHEET);
  /** the middle of the studio given the room a laptop gives it, both sidebars closed (made at 1600 × 900, saved at 1280 × 720) */
  const wide = async (pg, on) => { await pg.setViewportSize(on ? { width: 1600, height: 900 } : { width: 1280, height: 720 }); await pg.evaluate(on => { const D = window.__daily; D.LAY.left = D.LAY.right = !on; D.applyLayout(); dispatchEvent(new Event('resize')); }, on); await wait(500); };

  if (want('record')) {     /* the arrangement with a guitar take and a vocal take as clips, above the rig */
    await p.evaluate(() => { const D = window.__daily, sr = D.E.ctx.sampleRate, n = Math.round(sr * 12), mk = (f, sw) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr, ph = (t * 2) % 1; a[i] = Math.sin(2 * Math.PI * f * t) * .35 * Math.exp(-ph * (sw ? 1.5 : 5)) * (sw ? .6 + .4 * Math.sin(t * 1.3) : 1); } return a; };
      D.stopPlay(true); D.TAKES.length = 0; D.T.cursor = 0; const g = mk(196, false);
      D.REC = { dry: [g], wet: [g], vox: [mk(330, true)], g: true, v: true, t0: 0, startSec: 0, bpm: D.S.bpm, preset: null, n: 0, cam: [], pkG: [], pkV: [], punch: null, tEnd: 0, cycle: false, wl: 0 }; D.recEnd(); D.dockGo('rig'); });
    await wide(p, true); await wait(600); await p.evaluate(() => { const D = window.__daily, [g, v] = [D.TAKES.find(x => x.kind === 'gtr'), D.TAKES.find(x => x.kind === 'vox')]; if (g) g.name = 'Guitar take'; if (v) v.name = 'Vocal take'; D.commit(false); });
    await wait(400); await p.evaluate(() => document.querySelectorAll('.tl-scroll, .tl-heads').forEach(e => { e.scrollTop = e.scrollHeight; })); await wait(500); await quiet(p); await save(p, 'record'); await wide(p, false);
  }
  if (want('tones')) {      /* the Rig, with the tone presets beside it */
    await p.evaluate(() => { const d = window.__daily; d.dockGo('rig'); const b = document.querySelector('#left .tab[data-id="tones"]'); if (b) b.click(); });
    await wait(900); await quiet(p); await save(p, 'tones');
  }
  if (want('tab')) {        /* Write: the tab, the chords over it and the words */
    await wide(p, true); await p.evaluate(() => window.__daily.dockGo('tab')); await wait(1000); await p.evaluate(() => document.querySelectorAll('#pane-tab, #pane-tab *').forEach(e => { if (e.scrollTop) e.scrollTop = 0; })); await wait(300); await quiet(p); await save(p, 'tab'); await wide(p, false);
  }
  if (want('hum')) {        /* Hum to song, over the studio */
    await p.evaluate(() => window.__daily.humOpen()); await wait(900); await quiet(p); await save(p, 'hum');
    await p.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) d.close(); }); await wait(300);
  }
  if (want('show')) {       /* the stage mid-chorus, with the show setup console beside it */
    await p.evaluate(async () => { const D = window.__daily; await D.startAudio(); D.dockGo('stage'); const ch = D.S.sections.findIndex(s => /chorus/i.test(s.name)); D.T.cursor = ch > 0 ? D.S.sections.slice(0, ch).reduce((a, s) => a + s.bars.length, 0) * D.spb() : 0; const lz = [...document.querySelectorAll('button')].find(b => /Laser room/.test(b.textContent)); if (lz) lz.click(); await D.play(); });
    await wide(p, true); await wait(4500); await quiet(p); await save(p, 'show'); await p.evaluate(() => window.__daily.stopPlay(true)); await wide(p, false);
  }
  if (want('perform')) {    /* Perform: the big chord, the shapes and the lyrics, mid-song (made at 1600 × 900, so it has the room a laptop gives it) */
    await p.setViewportSize({ width: 1600, height: 900 });
    await p.evaluate(async () => { const D = window.__daily; await D.startAudio(); delete D.CFG.pfView; D.T.cursor = 0; D.perfOpen(); }); await wait(600);
    await p.evaluate(() => { const b = document.getElementById('pfGo'); if (b) b.click(); }); await wait(5200); await quiet(p); await save(p, 'perform');
    await p.evaluate(() => { window.__daily.stopPlay(true); window.__daily.perfClose(); }); await wait(400); await p.setViewportSize({ width: 1280, height: 720 });
  }
  if (want('sync')) {       /* Settings ▸ Folder sync, in step with a folder */
    await p.evaluate(() => window.__daily.openSettings('folder')); await wait(500);
    await p.evaluate(() => document.getElementById('syncChoose').click());
    await t.poll(() => p.evaluate(() => !!window.__daily.CFG.fsync.last && !window.__daily.SYNC.busy), 15000);
    await p.evaluate(() => { const d = document.getElementById('settings'); if (d) d.close(); window.__daily.openSettings('folder'); }); await wait(700); await quiet(p); await save(p, 'sync');
  }
  if (want('stems')) {      /* Stems: a synthesised backing track, split, with its chords found (its own page: loading a track renames the song) */
    process.env.BARS = '8'; const SY = require('./stem_synth.cjs'), mono = SY.L.map((x, i) => (x + SY.R[i]) / 2), f = path.join(require('node:os').tmpdir(), 'Harbour Lights (backing).wav'); fs.writeFileSync(f, t.wav(mono, 44100));
    const sp = await t.open({ w: 1280, h: 720, init }); await wide(sp, true);
    await sp.evaluate(() => window.__daily.dockGo('stems')); await wait(400); await sp.setInputFiles('#pane-stems input[type=file]', f);
    await sp.waitForSelector('#pane-stems button:has-text("Import chords")', { timeout: 150000 }); await wait(800); await quiet(sp); await save(sp, 'stems'); fs.rmSync(f, { force: true });
  }
});
