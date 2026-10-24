/* End-to-end flows in a real browser (Playwright, Chromium with a fake audio device).
   Setup once:  npm install && npx playwright install chromium
   Run:         npm run test:e2e            (starts its own static server)
   Options:     CHROMIUM_PATH=/path/to/chrome   NO_SANDBOX=1 (containers)   BASE_URL=https://… (test a deployed site) */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const PORT = 8123 + Math.floor(Math.random() * 500), BASE = process.env.BASE_URL || `http://localhost:${PORT}/`;
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
function wav(L, sr) { const n = L.length, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 30000))), 44 + i * 2); return b; }
(async () => {
  let srv; if (!process.env.BASE_URL) { srv = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' }); await wait(800); }
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', ...(process.env.NO_SANDBOX ? ['--no-sandbox'] : [])] });
  const ctx0 = await browser.newContext({ viewport: { width: 1500, height: 900 }, permissions: ['microphone'], acceptDownloads: true }); await ctx0.addInitScript(() => { try { if (window.name !== 'noseed') localStorage.setItem('fw.started', 'true'); } catch (e) { } });   // skip the first-run start card
  const page = await ctx0.newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio input|MIDI|favicon/i.test(m.text())) errs.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push('http ' + r.status() + ' ' + r.url()); });
  await page.goto(BASE); await wait(2500); if (await page.$('#bootGo')) await page.click('#bootGo'); await wait(1800);
  ok(!!(await page.$('#dock .tab[data-id="rig"]')), 'app boots and the dock renders');

  // rig deck has no empty rows: every row spans the card
  const deck = await page.evaluate(() => { const d = document.querySelector('.rigdeck'), w = d.getBoundingClientRect().width; return [...d.children].map(c => Math.round(c.getBoundingClientRect().width / w * 100)); });
  ok(deck.length >= 4 && deck.every(p => p >= 90), 'rig control deck rows fill the card ' + JSON.stringify(deck));

  // tunings
  await page.click('#dock .tab[data-id="song"]'); await wait(300);
  const strs = () => page.evaluate(() => [...document.querySelectorAll('.strs span')].map(s => s.textContent).join(' '));
  for (const [name, want] of [['C# standard (1½ steps down)', 'C# F# B E G# C#'], ['Drop B', 'B F# B E G# C#'], ['Half-step down (Eb)', 'Eb Ab Db Gb Bb Eb'], ['Drop D', 'D A D G B E']]) {
    await page.selectOption('#songbar select.sb-tun', name); await wait(250); const got = await strs(); ok(got === want, `tuning "${name}" → ${got}`);
  }
  await page.click('#songbar button:has-text("Notes & tuning")'); await wait(200); await page.click('.pop details.tun-ed summary'); await page.click('button:has-text("Drop low string")'); await wait(250);
  { const s2 = await strs(); ok(s2 === 'C A D G B E', 'custom editor lowers the low string → ' + s2); }
  await page.click('button:has-text("Reset to standard")'); await wait(250); ok((await strs()) === 'E A D G B E', 'reset to standard');

  // guided tour: offer, walk every step, finish
  ok(!!(await page.$('#tourOffer')), 'first-run tour offer appears'); await page.click('#tourOffer button.primary'); await wait(500);
  let steps = 0; while (await page.$('#tour')) { steps++; const inView = await page.evaluate(() => { const r = document.querySelector('.tour-card').getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }); if (!inView) ok(false, 'tour card fully on screen at step ' + steps); await page.keyboard.press('ArrowRight'); await wait(380); if (steps > 40) break; }
  ok(steps >= 15 && steps < 30, `tour walked ${steps} steps and closed`);

  // transcription self-test in Drop C#
  await page.click('#dock .tab[data-id="song"]'); await page.selectOption('#songbar select.sb-tun', 'Drop C# (C# G# C# F# A# D#)'); await wait(250);
  await page.click('#dock .tab[data-id="tx"]'); await wait(250); await page.click('button:has-text("Run self-test")');
  await page.waitForFunction(() => /All cases/.test(document.querySelector('#pane-tx').innerText), null, { timeout: 120000 });
  const f1 = await page.evaluate(() => { const r = [...document.querySelectorAll('#pane-tx table tr')].find(x => /^All cases/.test(x.innerText.trim())); return r ? r.innerText.replace(/\s+/g, ' ') : ''; });
  const pct = (f1.match(/(\d+)%/g) || []).map(x => parseInt(x)); ok(pct.length >= 3 && pct[2] >= 70, 'transcription self-test (Drop C#): ' + f1);

  // stems: synthetic backing track
  process.env.BARS = '8'; const S = require('./stem_synth.cjs'); const mono = S.L.map((x, i) => (x + S.R[i]) / 2); const tmp = path.join(os.tmpdir(), 'fw-e2e-backing.wav'); fs.writeFileSync(tmp, wav(mono, S.sr));
  await page.click('#dock .tab[data-id="stems"]'); await wait(300); await page.setInputFiles('#pane-stems input[type=file]', tmp);
  await page.waitForSelector('#pane-stems button:has-text("Import chords")', { timeout: 150000 });
  const txt = await page.evaluate(() => document.querySelector('#pane-stems').innerText); const bpm = (txt.match(/(\d{2,3}(?:\.\d)?)\s*BPM/i) || [])[1];
  ok(bpm && Math.abs(+bpm - 100) < 3, 'stems: tempo detected ≈ 100 BPM (' + bpm + ')');

  // loading a track fills the song strip (details move to the top and follow the track)
  { const d = await page.evaluate(() => ({ title: document.querySelector('#songbar .sb-title').value, bpm: document.querySelector('#top input[type=number]') && document.querySelector('#top input[type=number]').value, chip: !!document.querySelector('#songbar .sb-chip.on') }));
    ok(d.chip && d.title && !/\.wav$/i.test(d.title), 'track load: song strip title is the cleaned track name (“' + d.title + '”)'); }
  // the loaded track and its four stems become arrangement lanes
  { const ids = await page.$$eval('.tl-head', e => e.map(x => x.dataset.id)); ok(['trk', 'stem:0', 'stem:1', 'stem:2', 'stem:3'].every(i => ids.includes(i)), 'arrangement has Track + 4 stem lanes: ' + ids.join(',')); }
  // Refine lives in the right sidebar
  await page.click('#right .side-tabs .tab[data-id="refine"]'); await wait(300);
  ok(await page.evaluate(() => !!document.querySelector('#right .refine') && document.querySelector('#right .refine').getClientRects().length > 0), 'Refine panel (lyrics + chords) shows in the right sidebar');
  // two-input recording: guitar on 1, vocal on 2 → two takes from one pass
  await page.click('#left .side-tabs .tab[data-id="io"]'); await wait(200); await page.click('button:has-text("Guitar 1 · Vocal 2")'); await wait(300);
  ok(await page.evaluate(() => !!document.querySelector('.tl-head[data-id="vox"]')), 'vocal lane present once the vocal input is routed');
  await page.keyboard.press('r'); await wait(9500); await page.keyboard.press(' '); await wait(900);
  { const names = await page.$$eval('.tl-head[data-id^="take:"] .nm', e => e.map(x => x.textContent)); ok(names.some(n => /^Take/.test(n)) && names.some(n => /^Vocal/.test(n)), 'one record pass made a guitar take and a vocal take: ' + names.join(' | ')); }
  // lanes can be resized and reordered (persisted)
  { const before = await page.$eval('.tl-head[data-id="bass"]', e => Math.round(e.getBoundingClientRect().height)); await page.click('.tl-head[data-id="bass"] .more'); await page.click('.pop button:has-text("XL")'); await wait(250);
    const after = await page.$eval('.tl-head[data-id="bass"]', e => Math.round(e.getBoundingClientRect().height)); ok(after > before + 20, `lane height presets resize a lane (${before} → ${after})`); }
  // lyric intake: a pasted sheet becomes sections with chords over the words, in one undoable step
  { await page.click('#right .side-tabs .tab[data-id="refine"]'); await page.click('#right button:has-text("Paste lyrics")'); await page.fill('.lyi-ta', '[Verse 1]\nLate night, city lights\nYour body close to mine\n\n[Chorus]\nI just wanna be right here\nWith you tonight\n\n[Chorus]\nI just wanna be right here\nWith you tonight'); await wait(300);
    const rows = await page.$$eval('.lyi-row', r => r.length); await page.click('.lyi button:has-text("Import lyrics")'); await wait(400);
    const got = await page.evaluate(() => ({ n: document.querySelectorAll('#right .card.sec').length, ly: (document.querySelector('#right textarea.lyr') || {}).value }));
    ok(rows === 3 && got.n === 3 && /^\[[A-G][^\]]*\]Late night/.test(got.ly), `lyric import: ${rows} sections previewed, ${got.n} created, chords placed (${(got.ly || '').split('\n')[0]})`); }
  // ---- v1.4: songs library, two origins, zoom, real reset ----
  { const bootAgain = async () => { await wait(2300); if (await page.$('#bootGo')) await page.click('#bootGo'); await wait(2300); await page.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); }); };
    const title = () => page.$eval('.sb-title', e => e.value);
    await page.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); }); await page.click('.sb-zoom button[data-z="studio"]'); await wait(500);
    // work done before any song was chosen is kept: record a take, then start a new song; the take comes back when the first song is reopened
    await page.click('.sb-new'); await wait(300); ok(await page.$eval('#origins', d => d.open), 'New song opens the start card with two origins');
    const cards = await page.$$eval('#origins .pd-card h3', e => e.map(x => x.textContent)); ok(cards.join('|') === 'Clean canvas|Start from a song', 'origins are "Clean canvas" and "Start from a song": ' + cards.join(' | '));
    await page.fill('#origins input.in', 'Porch Light'); await page.click('#origins .pd-card:first-child .pd-go'); await wait(1500);
    ok((await title()) === 'Porch Light', 'clean canvas starts a new blank song with the given title');
    ok((await page.$$('.tl-head[data-id^="take:"]')).length === 0, 'the new song has no takes from the previous one');
    const nsec = await page.evaluate(() => document.querySelectorAll('#right .card.sec').length); ok(nsec === 1, 'a clean canvas has one empty section (' + nsec + ')');
    await page.click('.sb-songs'); await page.click('.pd-menu button:has-text("All songs")'); await wait(500);
    const rows = await page.$$eval('.pd-row', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
    ok(rows.length === 2 && rows.some(r => /🎙 2/.test(r)), 'library lists both songs, the earlier one with its 2 saved takes: ' + rows.map(r => r.slice(0, 40)).join(' ‖ '));
    await page.click('.pd-row:has(button:has-text("Open")):not(.cur) button:has-text("Open")'); await wait(1500);
    ok((await page.$$('.tl-head[data-id^="take:"]')).length === 2, 'reopening the first song brings its guitar and vocal takes back');
    // bundle: export, import
    const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => { document.querySelector('.sb-songs').click(); setTimeout(() => { [...document.querySelectorAll('.pd-menu button')].find(x => /bundle/.test(x.textContent)).click(); }, 250); })]);
    const zf = path.join(os.tmpdir(), 'ds-' + Date.now() + '.zip'); await dl.saveAs(zf); const zb = fs.readFileSync(zf); ok(/\.daily-song\.zip$/.test(dl.suggestedFilename()) && zb.includes('arrangement.json') && zb.includes('song.md') && zb.includes('.wav'), 'a song exports as a .daily-song.zip with song.md, arrangement.json and audio: ' + dl.suggestedFilename() + ' ' + zb.length + ' bytes');
    await page.click('.sb-songs'); await page.click('.pd-menu button:has-text("All songs")'); await wait(400); await page.setInputFiles('.pd-foot input[type=file]', zf); await wait(2500);
    ok((await page.$$('.tl-head[data-id^="take:"]')).length === 2, 'importing the bundle opens a copy with its takes');
    // zoom: Canvas hides everything but the page; Studio brings it back
    await page.click('.sb-zoom button[data-z="canvas"]'); await wait(500); const cz = await page.evaluate(() => ({ c: getComputedStyle(document.querySelector('#center')).display, r: document.querySelector('#right').getBoundingClientRect().width }));
    ok(cz.c === 'none' && cz.r > 700, `Canvas view shows only the Refine page (centre ${cz.c}, page ${Math.round(cz.r)} px wide)`);
    await page.click('.sb-zoom button[data-z="studio"]'); await wait(500); ok(await page.evaluate(() => getComputedStyle(document.querySelector('#center')).display !== 'none'), 'Studio view restores the arrangement');
    // reset: layout only keeps songs; settings are re-asked; Everything really empties the library
    const openReset = async () => { await page.click('.btn.icon[title="Settings"]'); await page.click('#settings button:has-text("Reset…")'); await wait(300); };
    const keys = () => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fw.')).sort().join(','));
    await openReset(); await page.click('#reset button:has-text("Layout only")'); await page.click('#reset button:has-text("Reset 1 item")'); await page.click('#reset button:has-text("Click again")'); await bootAgain();
    ok((await title()).length > 0 && (await page.evaluate(() => (JSON.parse(localStorage.getItem('fw.cfg') || '{}').zoom || '') === '')), 'Reset ▸ Layout only: songs stay, the view goes back to default');
    await page.click('.sb-songs'); await page.click('.pd-menu button:has-text("All songs")'); await wait(400); const kept = (await page.$$('.pd-row')).length; ok(kept === 3, 'Reset ▸ Layout only kept all songs (' + kept + ')'); await page.keyboard.press('Escape');
    await page.evaluate(() => { window.name = 'noseed'; }); await openReset(); await page.click('#reset button:has-text("Everything")'); await page.click('#reset button:has-text("Reset 6 items")'); await page.click('#reset button:has-text("Click again")'); await wait(4000); if (await page.$('#bootGo')) await page.click('#bootGo'); await wait(2500);
    const after = await page.evaluate(async () => ({ open: !!(document.getElementById('origins') || {}).open, keys: Object.keys(localStorage).filter(k => k.startsWith('fw.')).sort().join(','), title: (document.querySelector('.sb-title') || {}).value }));
    ok(after.open && after.title === 'Salt Wind (demo)' && !/fw\.(song|cur|started|presets|layouts|vhist)\b/.test(after.keys), 'Reset ▸ Everything: nothing is written back (the old bug), the start card returns and the demo song is back. Keys left: ' + after.keys);
    await page.keyboard.press('Escape'); await wait(1200); const lib = await page.evaluate(() => new Promise(res => { const r = indexedDB.open('the-daily-songs'); r.onsuccess = () => { const t = r.result.transaction('projects').objectStore('projects').count(); t.onsuccess = () => res(t.result); }; r.onerror = () => res(-1); })); ok(lib <= 1, 'the library holds only the fresh demo song after a factory reset (' + lib + ')'); }
  if (await page.$('#bootGo')) { await page.click('#bootGo'); await wait(1800); } await page.evaluate(() => { const d = document.getElementById('origins'); if (d && d.open) d.close(); });   // nothing starts by itself: the start overlay waits for a click
  // ---- v1.6: appearance system ----
  { const dset = () => page.evaluate(() => ({ ...document.documentElement.dataset, acc: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }));
    await page.click('button[title^="Appearance"]'); await wait(400); ok(await page.$eval('#look', d => d.open), 'the ◐ button opens the Appearance drawer');
    ok((await page.$$('.lk-pal')).length === 17 && (await page.$$('.lk-look')).length === 8, 'drawer offers 17 palettes and 8 looks');
    await page.click('.lk-look:has-text("Midnight")'); await wait(300); let d = await dset(); ok(d.theme === 'dark' && d.palette === 'midnight', 'look "Midnight" switches to the dark Midnight palette: ' + d.theme + '/' + d.palette);
    await page.click('.lk-pal[title="Paper"]'); await wait(300); d = await dset(); ok(d.palette === 'paper' && d.theme === 'light', 'choosing a light palette switches to light: ' + d.palette);
    await page.click('.lk-dot[title="Violet"]'); await wait(300); const v1 = (await dset()).acc; ok(/^#/.test(v1) && v1.toLowerCase() !== '#b4532a', 'accent swatch changes the accent colour: ' + v1);
    await page.evaluate(() => { const i = document.querySelector('.lk-dot.custom input'); i.value = '#e83e8c'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
    const cacc = (await dset()).acc; ok(/^#/.test(cacc) && cacc !== v1, 'a custom colour is accepted and adjusted for legibility: ' + cacc);
    await page.click('.lk-seg button:has-text("Round")'); await page.click('.lk-seg button:has-text("Roomy")'); await page.click('.lk-seg button:has-text("Colour-blind safe")'); await wait(300);
    d = await dset(); ok(d.corners === 'round' && d.density === 'spacious' && (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cv1').trim())) === '#0072B2', 'corners, density and colour-blind-safe data colours apply');
    await page.selectOption('#look select', 'legible'); await wait(200); ok((await dset()).font === 'legible', 'typeface choice applies');
    await page.keyboard.press('Escape'); await page.reload(); await wait(2300); if (await page.$('#bootGo')) await page.click('#bootGo'); await wait(2300); await page.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); }); d = await dset(); ok(d.palette === 'paper' && d.corners === 'round' && d.density === 'spacious', 'appearance survives a reload: ' + d.palette + '/' + d.corners + '/' + d.density);
    await page.click('button[title^="Appearance"]'); await wait(300); await page.click('.lk-foot .btn'); await wait(300); d = await dset(); ok(d.corners === 'soft' && d.density === 'comfortable' && d.palette === 'dsday' && d.font === 'brand', 'Reset appearance restores the defaults (Daily Light, brand type)');
    await page.keyboard.press('Escape'); }
  // ---- v1.7: About & credits, CSP, production assets ----
  { await page.keyboard.press('Escape'); await page.click('.btn.icon[title^="Help"]'); await wait(400);
    const links = await page.$$eval('#help .ab a[href]', a => a.map(x => ({ h: x.href, r: x.rel, t: x.target })));
    const hs = links.map(l => l.h);
    ok(hs.includes('https://github.com/TehauD') && hs.includes('https://www.linkedin.com/in/tehau/'), 'Help ▸ About links to github.com/TehauD and linkedin.com/in/tehau');
    ok(links.every(l => /noopener/.test(l.r) && l.t === '_blank'), 'every external link opens in a new tab with rel=noopener');
    ok(/MIT/.test(await page.$eval('#help .ab', e => e.textContent)) && /MediaPipe/.test(await page.$eval('#help .ab', e => e.textContent)) && /Good Morning/.test(await page.$eval('#help .ab', e => e.textContent)), 'About lists the licence, MediaPipe and the sample-track notice');
    ok(!/FRETWORK|Fretwork/.test(await page.evaluate(() => document.documentElement.outerHTML)), 'no old brand name anywhere in the page');
    await page.keyboard.press('Escape');
    ok(await page.evaluate(() => /default-src 'self'/.test((document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '')), 'a Content-Security-Policy is set on the page'); }
  // audio is never switched on for you: no microphone request until you choose, visible Audio control, kill switch
  { const ap = await ctx0.newPage(), ae = []; ap.on('pageerror', e => ae.push(e.message));
    await ap.addInitScript(() => { window.__gum = 0; const md = navigator.mediaDevices, g = md.getUserMedia.bind(md); md.getUserMedia = c => { if (c && c.audio) window.__gum++; return g(c).then(st => { (window.__st = window.__st || []).push(st); return st; }); }; });
    await ap.goto(BASE); await wait(3500);
    ok(await ap.evaluate(() => window.__gum) === 0 && !!(await ap.$('#boot')), 'nothing asks for the microphone on load; the start overlay waits for you');
    ok(/Start · microphone stays off/.test(await ap.$eval('#bootNoMic', e => e.textContent)), 'the first choice is to start with the microphone off');
    await ap.click('#bootNoMic'); await wait(2000);
    ok(await ap.evaluate(() => window.__gum) === 0 && /No input/.test(await ap.$eval('.aud .lbl', e => e.textContent)), 'starting leaves the microphone off and the header says so');
    await ap.click('.aud'); await wait(400); ok(await ap.$eval('#audio', d => d.open), 'the header Audio button opens the audio panel');
    await ap.click('#audio button:has-text("Connect")'); await wait(2000);
    ok(await ap.evaluate(() => window.__gum) > 0 && /Input live/.test(await ap.$eval('.aud .lbl', e => e.textContent)), 'Connect asks for the input and the header shows it is live');
    await ap.keyboard.press('Escape'); await ap.keyboard.press('Control+.'); await wait(600);
    ok(/killed/i.test(await ap.$eval('.aud .lbl', e => e.textContent)), 'Ctrl + . kills audio and the header shows it');
    ok(await ap.evaluate(() => (window.__st || []).length > 0 && window.__st.every(st => st.getTracks().every(t => t.readyState === 'ended'))), 'the kill switch releases every microphone track');
    if (await ap.evaluate(() => !!window.__daily && !!window.__daily.esc)) ok(await ap.evaluate(() => window.__daily.esc('<img src=x onerror=alert(1)>&"\'') === '&lt;img src=x onerror=alert(1)&gt;&amp;&quot;&#39;'), 'esc() neutralises markup in untrusted text');
    await ap.click('.aud'); await wait(300); await ap.click('#audio button:has-text("Resume audio")'); await wait(800);
    ok(/No input/.test(await ap.$eval('.aud .lbl', e => e.textContent)), 'resuming brings audio back with the microphone still off');
    ok(ae.length === 0, 'audio control runs without script errors' + (ae.length ? ' ' + ae[0] : '')); await ap.close(); }
  // camera looks: edges-in and the person cut-out (a stub segmenter stands in for the downloadable model)
  { const cp = await ctx0.newPage(), ce = []; cp.on('pageerror', e => ce.push(e.message)); await cp.goto(BASE + '?debug'); await wait(2200);
    await cp.evaluate(() => { const b = document.querySelector('#bootGo') || document.querySelector('#bootNoMic'); if (b) b.click(); }); await wait(1800);
    await cp.click('#dock .tab[data-id="cam"]'); await wait(400);
    await cp.evaluate(() => [...document.querySelectorAll('button')].find(b => /Camera on\/off/.test(b.textContent)).click()); await wait(2500);
    await cp.click('#dock .tab[data-id="vis"]'); await wait(500);
    await cp.evaluate(() => [...document.querySelectorAll('button')].find(b => /Camera backdrop/.test(b.textContent)).click());
    ok(await cp.$$eval('select[aria-label="Camera look"] option', o => o.slice(0, 3).map(x => x.value).join()) === 'over,edges,person', 'camera look offers dimmed, edges-in and green-screen');
    const px = x => cp.evaluate(x => { const c = document.querySelector('.vcanvas'), g = c.getContext('2d'), d = g.getImageData(Math.floor(c.width * x), Math.floor(c.height * .5), 1, 1).data; return [d[0], d[1], d[2]]; }, x);
    const green = p => p[1] > p[0] + 50 && p[1] > p[2] + 50;
    await cp.selectOption('select[aria-label="Camera look"]', 'edges'); await wait(800);
    ok(green(await px(.5)) && !green(await px(.04)), 'edges-in: camera shows in the middle, visuals around it');
    await cp.evaluate(() => { const w = 320, h = 180, a = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (x - w / 2) / (w * .17), dy = (y - h * .55) / (h * .42); a[y * w + x] = dx * dx + dy * dy < 1 ? 0 : 1; }   // inverted on purpose
      const D = window.__daily; D.CF.inv = null; D.CF.acc = null; D.CF.mask = null; D.CF.errN = 0; D.CF.seg = { segmentForVideo(v, t, cb) { cb({ confidenceMasks: [{ width: w, height: h, getAsFloat32Array: () => a }] }); } }; D.CF.state = 'ready'; });
    await cp.selectOption('select[aria-label="Camera look"]', 'person'); await wait(1200);
    ok(await cp.evaluate(() => window.__daily.CF.inv === true), 'cut-out: mask direction is detected automatically');
    ok(green(await px(.5)) && !green(await px(.06)), 'cut-out: you stay in front, the visuals fill the rest');
    ok(ce.length === 0, 'camera looks run without script errors' + (ce.length ? ' ' + ce[0] : '')); await cp.close(); }
  // The Daily is served at /journal/ on the same origin
  { const fwBefore = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fw.')).sort());
    const jp = await ctx0.newPage(), je = []; jp.on('pageerror', e => je.push(e.message));
    await jp.goto(BASE + 'journal/'); await wait(2000);
    ok(/The Daily/.test(await jp.title()), 'The Daily loads at /journal/');
    ok(await jp.evaluate(() => /default-src 'self'/.test((document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '')), 'The Daily has its own Content-Security-Policy');
    ok(je.length === 0, 'The Daily runs without script errors' + (je.length ? ' ' + je[0] : ''));
    { const after = await jp.evaluate(() => Object.keys(localStorage)); ok(fwBefore.length > 0 && fwBefore.every(k => after.includes(k)), 'opening The Daily leaves every studio key in place'); }
    await jp.close(); }
  ok(errs.length === 0, 'no console / page / network errors' + (errs.length ? '\n' + errs.slice(0, 8).join('\n') : ''));
  await browser.close(); if (srv) srv.kill(); console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
