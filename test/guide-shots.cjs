/* The pictures on the newer guide pages (site/img/*.webp), made from the app itself at 1280 × 720 and encoded to WebP by the browser
   (canvas.toDataURL), so nothing outside this repository is needed. Uses Chromium's synthetic camera and generated tones only.
     node test/guide-shots.cjs            all of them
     node test/guide-shots.cjs perform    just one (tones, perform, sync) */
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
  const p = await t.open({ w: 1280, h: 720, init });
  await p.evaluate(async s => { const D = window.__daily; await D.projCreate('blank', { form: 'empty' }); await window.dailyStudio.call('load_chord_sheet', { text: s }); D.S.title = 'Harbour Lights'; D.S.artist = 'The Test Band'; D.commit(false); await D.projSave(); }, SHEET);

  if (want('tones')) {      /* the Rig, with the tone presets beside it */
    await p.evaluate(() => { const d = window.__daily; d.dockGo('rig'); const b = document.querySelector('#left .tab[data-id="tones"]'); if (b) b.click(); });
    await wait(900); await quiet(p); await save(p, 'tones');
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
});
