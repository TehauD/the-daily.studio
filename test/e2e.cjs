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
  const ctx0 = await browser.newContext({ viewport: { width: 1500, height: 900 }, permissions: ['microphone'], acceptDownloads: true }); await ctx0.addInitScript(() => { try { if (window.name !== 'noseed') { localStorage.setItem('fw.started', 'true'); const c = JSON.parse(localStorage.getItem('fw.cfg') || '{}'); c.xpMode = 'pro'; c.humStage = false; localStorage.setItem('fw.cfg', JSON.stringify(c)); } } catch (e) { } });   // skip the first-run start card
  const page = await ctx0.newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio input|MIDI|favicon/i.test(m.text())) errs.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push('http ' + r.status() + ' ' + r.url()); });
  await page.goto(BASE); await wait(2500); if (await page.$('#bootGo')) await page.evaluate(() => document.getElementById('bootGo').click()); await wait(1800);
  ok(!!(await page.$('#dock .tab[data-id="rig"]')), 'app boots and the dock renders');

  // the app opens on the stage (Visuals) by default
  ok(await page.evaluate(() => window.__daily ? true : true) && await page.$eval('#dock .tab.on', e => e.dataset.id) === 'vis', 'the studio opens on the stage (Visuals tab) by default');
  await page.click('#dock .tab[data-id="rig"]'); await wait(400);
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
  await page.click('#left .side-tabs .tab[data-id="io"]'); await wait(200); await page.selectOption('select[aria-label="What input 2 is"]', 'v'); await wait(300);
  ok(await page.evaluate(() => document.querySelector('select[aria-label="What input 1 is"]').value === 'g' && document.querySelector('select[aria-label="What input 2 is"]').value === 'v'), 'Channels card: input 1 is the guitar, input 2 the vocal');
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
  { const bootAgain = async () => { await wait(2300); if (await page.$('#bootGo')) await page.evaluate(() => document.getElementById('bootGo').click()); await wait(2300); await page.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); }); };
    const title = () => page.$eval('.sb-title', e => e.value);
    await page.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); }); await page.click('.sb-zoom button[data-z="studio"]'); await wait(500);
    // work done before any song was chosen is kept: record a take, then start a new song; the take comes back when the first song is reopened
    await page.click('.sb-new'); await wait(300); ok(await page.$eval('#origins', d => d.open), 'New song opens the start card with two origins');
    const cards = await page.$$eval('#origins .pd-card h3', e => e.map(x => x.textContent)); ok(cards.join('|') === 'Hum or sing an idea|Clean canvas|Start from a song', 'origins lead with "Hum or sing an idea", then "Clean canvas" and "Start from a song": ' + cards.join(' | '));
    await page.fill('#origins input.in', 'Porch Light'); await page.click('#origins .pd-grid .pd-card:first-child .pd-go'); await wait(1500);
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
    await page.evaluate(() => { window.name = 'noseed'; window.__old = 1; }); await openReset(); await page.click('#reset button:has-text("Everything")'); await page.click('#reset button:has-text("Reset 6 items")'); await page.click('#reset button:has-text("Click again")'); await page.waitForFunction(() => !window.__old && !!document.getElementById('bootNoMic'), null, { timeout: 20000 }).catch(() => { }); await wait(1500); const keys0 = await keys(); if (await page.$('#bootNoMic')) await page.evaluate(() => document.getElementById('bootNoMic').click()); await page.waitForSelector('#humbar[data-mode="canvas"]', { timeout: 15000 }).catch(() => { }); await wait(800);
    const after = await page.evaluate(async () => ({ open: !!document.querySelector('#humbar[data-mode="canvas"]'), keys: Object.keys(localStorage).filter(k => k.startsWith('fw.')).sort().join(','), title: (document.querySelector('.sb-title') || {}).value }));
    ok(after.open && after.title === 'Untitled idea' && !/fw\.(song|cur|started|presets|layouts|vhist)\b/.test(keys0), 'Reset ▸ Everything: nothing is written back (the old bug) and the clean canvas returns. State: ' + JSON.stringify(after) + ' before start: ' + keys0);
    await page.evaluate(() => document.getElementById('humAltDemo').click()); await wait(2500);
    ok(await page.evaluate(() => (document.querySelector('.sb-title') || {}).value === 'Salt Wind (demo)' && !document.getElementById('humbar')), 'the start panel offers the demo song instead of humming (and closes)');
    await page.keyboard.press('Escape'); await wait(1200); const lib = await page.evaluate(() => new Promise(res => { const r = indexedDB.open('the-daily-songs'); r.onsuccess = () => { const t = r.result.transaction('projects').objectStore('projects').count(); t.onsuccess = () => res(t.result); }; r.onerror = () => res(-1); })); ok(lib <= 1, 'the library holds only the demo song after a factory reset: the empty placeholder page is not left behind (' + lib + ')'); }
  if (await page.$('#bootGo')) { await page.evaluate(() => document.getElementById('bootGo').click()); await wait(1800); } await page.evaluate(() => { const d = document.getElementById('origins'); if (d && d.open) d.close(); });   // nothing starts by itself: the start overlay waits for a click
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
    await page.keyboard.press('Escape'); await page.reload(); await wait(2300); if (await page.$('#bootGo')) await page.evaluate(() => document.getElementById('bootGo').click()); await wait(2300); await page.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); }); d = await dset(); ok(d.palette === 'paper' && d.corners === 'round' && d.density === 'spacious', 'appearance survives a reload: ' + d.palette + '/' + d.corners + '/' + d.density);
    await page.click('button[title^="Appearance"]'); await wait(300); await page.click('.lk-foot .btn'); await wait(300); d = await dset(); ok(d.corners === 'soft' && d.density === 'comfortable' && d.palette === 'dsday' && d.font === 'brand', 'Reset appearance restores the defaults (Daily Light, brand type)');
    await page.keyboard.press('Escape'); }
  // ---- v1.7: About & credits, CSP, production assets ----
  { await page.keyboard.press('Escape'); await page.click('.btn.icon[title^="Help"]'); await wait(400);
    const links = await page.$$eval('#help .ab a[href]', a => a.map(x => ({ h: x.href, r: x.rel, t: x.target })));
    const hs = links.map(l => l.h);
    ok(hs.includes('https://github.com/TehauD') && hs.includes('https://www.linkedin.com/in/tehau/'), 'Help ▸ About links to github.com/TehauD and linkedin.com/in/tehau');
    ok(links.every(l => /noopener/.test(l.r) && l.t === '_blank'), 'every external link opens in a new tab with rel=noopener');
    ok(/MIT/.test(await page.$eval('#help .ab', e => e.textContent)) && /MediaPipe/.test(await page.$eval('#help .ab', e => e.textContent)) && /Made for creators/.test(await page.$eval('#help .ab', e => e.textContent)) && !/Good Morning/.test(await page.$eval('#help .ab', e => e.textContent)), 'About tells the story and lists the licence and MediaPipe; no bundled sample is credited');
    ok(!/FRETWORK|Fretwork/.test(await page.evaluate(() => document.documentElement.outerHTML)), 'no old brand name anywhere in the page');
    await page.keyboard.press('Escape');
    ok(await page.evaluate(() => /default-src 'self'/.test((document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '')), 'a Content-Security-Policy is set on the page'); }
  // audio is never switched on for you: no microphone request until you choose, visible Audio control, kill switch
  { const ap = await ctx0.newPage(), ae = []; ap.on('pageerror', e => ae.push(e.message));
    await ap.addInitScript(() => { window.__gum = 0; const md = navigator.mediaDevices, g = md.getUserMedia.bind(md); md.getUserMedia = c => { if (c && c.audio) window.__gum++; return g(c).then(st => { (window.__st = window.__st || []).push(st); return st; }); }; });
    await ap.goto(BASE); await wait(3500);
    ok(await ap.evaluate(() => window.__gum) === 0 && !!(await ap.$('#boot')), 'nothing asks for the microphone on load; the start overlay waits for you');
    ok(/Begin in the studio/.test(await ap.$eval('#bootNoMic', e => e.textContent)) && /Begin on stage/.test(await ap.$eval('#bootStage', e => e.textContent)), 'the first choice is a route: the studio (no camera) or the stage (camera and visuals)');
    await ap.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2000);
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
  // Hum to Song: front door, nothing asked before the button, a synthetic hum becomes a whole song, the kill switch stops listening
  { const hp = await ctx0.newPage(), he = []; hp.on('pageerror', e => he.push(e.message));
    await hp.addInitScript(() => { try { const c = JSON.parse(localStorage.getItem('fw.cfg') || '{}'); delete c.humStage; localStorage.setItem('fw.cfg', JSON.stringify(c)); } catch (e) { } window.__gum = 0; window.__st = []; const md = navigator.mediaDevices, g = md.getUserMedia.bind(md); md.getUserMedia = c => { if (c && c.audio) window.__gum++; return g(c).then(st => { window.__st.push(st); return st; }); }; });
    await hp.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'debug&start=1'); await wait(3500);
    ok(/Hum a melody/.test(await hp.$eval('#boot', e => e.textContent)), 'the welcome card leads with "Hum a melody. Get a song."');
    await hp.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2500); await hp.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); document.querySelectorAll('#origins').forEach(d => d.close()); }); await hp.click('.sb-new'); await wait(500);
    const hero = await hp.$('#originsHum'); ok(!!hero, 'the first screen offers "Hum or sing" before anything else');
    if (hero) { await hero.click(); await wait(500); }
    ok(await hp.evaluate(() => !!document.getElementById('hum') && window.__gum === 0), 'the hum screen opens without asking for the microphone');
    ok(await hp.evaluate(() => !document.getElementById('humStage').checked), 'going on stage (camera, me in front) is not ticked by default in the studio route');
    await hp.click('#humGo'); await wait(2500);
    ok(await hp.evaluate(() => window.__gum === 1 && !!document.getElementById('humStop')), 'pressing the button asks for the microphone once and starts listening');
    await hp.keyboard.press('Control+.'); await wait(700);
    ok(await hp.evaluate(() => !document.getElementById('humbar') && window.__st.every(st => st.getTracks().every(t => t.readyState === 'ended'))), 'Ctrl + . stops the hum recording and releases the microphone');
    await hp.evaluate(() => { window.__daily.humOpen(); }); await wait(300);
    await hp.click('#humGo'); await wait(4200); await hp.click('#humStop'); await wait(5000);
    ok(await hp.evaluate(() => { const m = (document.getElementById('humbar') || {}).dataset; return !!m && (m.mode === 'res' || m.mode === 'few'); }), 'recording, listening back and arranging finish with a result or a helpful retry');
    const R = await hp.evaluate(async () => {
      const D = window.__daily, sr = 44100, notes = [60, 62, 64, 60, 64, 65, 67, 67, 67, 69, 67, 65, 64, 60, 62, 60], beat = .6, N = Math.ceil((notes.length * beat + 1) * sr), x = new Float32Array(N);
      notes.forEach((m, i) => { const f = 440 * Math.pow(2, (m - 69 + .25) / 12), t0 = .4 + i * beat, len = beat * .9; for (let k = 0; k < len * sr; k++) { const t = k / sr, env = Math.min(1, t / .03) * Math.min(1, (len - t) / .05); x[Math.floor(t0 * sr) + k] += .3 * env * Math.sin(2 * Math.PI * f * t) + .08 * env * Math.sin(4 * Math.PI * f * t); } });
      const an = await D.humAnalyze(x, sr, () => { }), full = D.humSong(an, {}), q = D.humSong(an, { form: 'quick' }), rock = D.humSong(an, { style: 'Rock' }), mi = D.humSong(an, { key: 9, minor: true });
      D.HUM.an = an; D.HUM.pcm = x; D.HUM.sr = sr; D.HUM.o = { style: null, form: 'full', seed: 0, bpm: null, key: null, minor: null, title: 'Hum idea' }; await D.humApply(false);
      return { n: an.notes.length, midi: an.notes.map(n => n.m).join(), bpm: an.bpm, key: an.key, secs: full.song.sections.map(c => c.name), bad: full.song.sections.flatMap(c => c.bars.map(b => b.chord)).filter(c => !c || c.split(' ').some(z => !D.parseChord(z))).length,
        tab: full.song.sections.map(c => c.bars.reduce((a, b) => a + b.tab.length, 0)), rock: rock.song.band.patName, q: q.song.sections.length, mi: mi.key, now: D.S.sections.length, btn: (document.getElementById('humPlay') || {}).textContent, last: full.song.sections[1].bars.slice(-1)[0].chord };
    });
    ok(R.n === 16 && R.midi === '60,62,64,60,64,65,67,67,67,69,67,65,64,60,62,60', 'a hummed melody (25 cents sharp) is heard note for note: ' + R.midi);
    ok(Math.abs(R.bpm - 100) <= 6 && R.key.root === 0 && !R.key.minor, 'tempo (' + R.bpm + ') and key (C major) are found');
    ok(R.secs.join() === 'Intro,Verse 1,Chorus,Verse 2,Chorus,Bridge,Chorus,Outro' && R.q === 4, 'the full song has intro, verses, choruses, bridge and outro; the quick sketch has verse and chorus');
    ok(R.bad === 0 && R.last === 'C', 'every chord is a real chord and the verse comes home to C (' + R.last + ')');
    ok(R.tab[1] === 16 && R.tab[2] > 0 && R.tab[5] > 0 && R.tab[0] === 0, 'the melody is on the lead guitar in the verse, chorus lift and bridge');
    ok(R.rock === 'Rock 8ths' && R.mi.minor === true, 'style and key changes re-arrange the band');
    ok(R.now === 8 && /Play my song/.test(R.btn), 'the song is built into the studio and the panel offers Play');
    const HT = await hp.evaluate(() => { const D = window.__daily, tk = D.TAKES.filter(t => t.hum), v = D.S.sections.findIndex(x => /^Verse/.test(x.name)), vs = D.S.sections.slice(0, v).reduce((a, x) => a + x.bars.length, 0) * 16 * (15 / D.S.bpm);
      return { n: tk.length, kind: tk[0] && tk[0].kind, dur: tk[0] && tk[0].dur, first: tk[0] && vs - tk[0].startSec - D.HUM.an.notes[0].t, band: [D.S.band.drumsOn, D.S.band.bassOn, D.S.band.compOn, D.S.band.leadOn], btn: !!document.getElementById('humVoice') }; });
    ok(HT.n === 1 && HT.kind === 'vox' && HT.dur > 8, 'the hummed recording is added to the arrangement as one Vocal take (' + HT.n + ')');
    ok(Math.abs(HT.first) < .01, 'its first note lines up with the first melody note of Verse 1');
    ok(HT.band.every(Boolean) && HT.btn, 'the band is on with it, and the panel has a My hum on/off button');
    await hp.click('#humbar .hum-chips button:has-text("Ballad")'); await wait(600);
    ok(await hp.evaluate(() => window.__daily.S.band.kit === 'Brush (soft)'), 'choosing a style re-builds the band right away');
    ok(await hp.evaluate(() => window.__daily.TAKES.filter(t => t.hum).length === 1), 're-arranging replaces the hum take instead of stacking another');
    await hp.evaluate(async () => { const D = window.__daily; D.dockGo('fret'); D.FB.mode = 'none'; D.S.band.leadOn = true; await D.humPlay(); }); await wait(3500);
    const PBR = await hp.evaluate(() => { const D = window.__daily, rings = [...document.querySelectorAll('#fretsvg g')].filter(g => [...g.querySelectorAll('*')].some(e => e.getAttribute('opacity') && +e.getAttribute('opacity') > .2 && e.getAttribute('fill') === 'none')).length;
      return { hits: D.PB.seq, src: D.visAna() === D.E.anaMaster, shown: [...document.querySelectorAll('#fretsvg g')].filter(g => g.style.display !== 'none' && g.querySelector('circle,polygon')).length, rings }; });
    ok(PBR.hits > 5 && PBR.src, 'while the song plays, the visuals follow the mix and the playhead feeds the fretboard (' + PBR.hits + ' note hits)');
    const GH = await hp.evaluate(() => { const D = window.__daily, g = D.nkNext(), k = D.neckMarks().map(m => m.k); return { lead: !!(g && g.lead), kinds: [...new Set(k)].join(), eta: g && g.eta }; });
    ok(GH.lead && GH.eta >= 0 && GH.eta < 2.5, 'while playing, the neck knows the next lead note and how soon it arrives (' + (GH.eta && GH.eta.toFixed(2)) + ' s)');
    await hp.evaluate(() => { const D = window.__daily; if (D.T.playing) D.stopPlay(true); });
    const NKR = await hp.evaluate(async () => { const D = window.__daily; await D.nkPinChord('C'); const pin = D.neckMarks().filter(m => m.k === 'pin').length;
      D.HUM.rec = {}; D.HUM.live = { m: 64, t: performance.now() }; const vo = D.neckMarks().filter(m => m.k === 'voice'); D.HUM.rec = null; D.HUM.live = null; D.NK.pin = null;
      return { pin, vo: vo.length, ok: vo.every(m => 40 + m.f + 0 >= 0) }; });
    ok(NKR.pin >= 4, 'picking a chord shows its shape on the neck (' + NKR.pin + ' notes)');
    ok(NKR.vo >= 2, 'the note you sing is shown at every place it can be played on the neck (' + NKR.vo + ')');
    const CH = await hp.evaluate(async () => { const D = window.__daily, out = {}, sl = () => new Promise(r => setTimeout(r, 400)), gn = () => D.E.anTarget.join(); D.chSetRoles('g', 'v'); out.gv = [D.chRoles().join(), D.CFG.ch, D.CFG.vin, D.CFG.gOff, D.CFG.anSrc].join();
      D.chSetRoles('v', 'o'); await sl(); out.vo = [D.chRoles().join(), D.CFG.gOff, D.CFG.anSrc, gn()].join();
      D.setAnaSource('b'); await sl(); out.both = gn(); D.chSetRoles('g', 'g'); await sl(); out.gg = [D.chRoles().join(), D.CFG.ch, D.CFG.vin, D.CFG.anSrc, gn()].join();
      D.chSetRoles('v', 'v'); out.vv = D.chRoles().join(); D.chSetRoles('g', 'o'); out.go = [D.chRoles().join(), D.CFG.gOff].join(); D.chSetRoles('g', 'g'); return out; });
    ok(CH.gv === 'g,v,L,R,false,g', 'guitar on input 1 and vocal on input 2 routes correctly (' + CH.gv + ')');
    ok(CH.vo === 'v,o,true,v,0,1', 'vocal only: the rig gets nothing and the detector follows the voice (' + CH.vo + ')');
    ok(CH.both === '1,1' && CH.gg === 'g,g,sum,off,g,1,0', 'following both, then two guitars summed, set the detector and routing (' + CH.both + ' / ' + CH.gg + ')');
    ok(CH.vv === 'v,g' && CH.go === 'g,o,false', 'one vocal at most; a guitar on one input and nothing on the other (' + CH.vv + ' / ' + CH.go + ')');
    for (const mode of ['halo', 'kaleido']) {
      await hp.evaluate(async m => { const D = window.__daily; D.dockGo('vis'); D.vzSetMode(m); await D.humPlay(); }, mode); await wait(2600);
      const lit = await hp.evaluate(() => { const cv = document.querySelector('.vcanvas'), g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data; let n = 0, tot = 0; for (let i = 0; i < d.length; i += 64) { tot++; if (d[i] + d[i + 1] + d[i + 2] > 120) n++; } return n / tot; });
      ok(lit > .004 && lit < .97, 'the ' + mode + ' look draws something (' + (lit * 100).toFixed(1) + '% of pixels lit)');
      await hp.evaluate(() => { const D = window.__daily; if (D.T.playing) D.stopPlay(true); });
    }
    await hp.evaluate(() => window.__daily.vzSetMode('hex'));
    await hp.evaluate(() => window.__daily.dockGo('song'));
    const laneSave = async sel => { await hp.evaluate(s => document.querySelector(s + ' button[title^="Lane options"]').click(), sel); await wait(150); const t = await hp.evaluate(() => (document.querySelector('.pop') || {}).textContent || ''); await hp.keyboard.press('Escape'); await hp.mouse.click(5, 450); await wait(100); return t; };
    const tkSave = await laneSave('.tl-head.take'), bsSave = await laneSave('.tl-head.bass');
    ok(/⤓ WAV/.test(tkSave) && /⤓ Save this part \(WAV\)/.test(bsSave), 'every recording and band track can be saved from its lane ⋯ menu (⤓ WAV, ⤓ Save this part)');
    const dlp = hp.waitForEvent('download', { timeout: 60000 });
    await hp.evaluate(() => { const D = window.__daily; window.__keep = { sec: D.S.sections.slice(), bpm: D.S.bpm }; D.S.sections = D.S.sections.slice(0, 1); D.S.sections[0].bars = D.S.sections[0].bars.slice(0, 2); D.S.bpm = 200; D.bouncePart('bass'); });
    const dl = await dlp.catch(() => null);
    ok(!!dl && /bass\.wav$/.test(dl.suggestedFilename()), 'Save on the Bass lane downloads that part alone as a WAV (' + (dl && dl.suggestedFilename()) + ')');
    await wait(500);
    ok(await hp.evaluate(() => { const D = window.__daily; D.S.sections = window.__keep.sec; D.S.bpm = window.__keep.bpm; return D.S.band.drumsOn && D.S.band.bassOn && D.S.band.compOn && D.S.band.leadOn && D.TAKES.every(t => !t.mute); }), 'after saving one part the band and takes are switched back on');
    ok(await hp.evaluate(() => !window.__daily.CAM.on), 'the camera stays off until you ask for center stage');
    await hp.evaluate(() => { const b = document.getElementById('vzCamBtn'); if (b) b.click(); }); await wait(3500);
    ok(await hp.evaluate(() => window.__daily.CAM.on && window.__daily.VZ.cam && window.__daily.CFG.camFx === 'person'), 'one tap on Camera backdrop starts the camera and puts you in front (green screen)');
    await hp.evaluate(() => { const b = document.getElementById('vzCamBtn'); if (b) b.click(); }); await wait(500);
    ok(await hp.evaluate(() => !window.__daily.CAM.on && !window.__daily.VZ.cam), 'tapping again turns the camera off');
    await hp.evaluate(() => window.__daily.vzImmersive(true)); await wait(400);
    const IM = await hp.evaluate(() => { const w = document.querySelector('.vwrap').getBoundingClientRect(), x = document.getElementById('vzhExit'), k = document.getElementById('vzhKill'); return { on: document.body.classList.contains('vz-imm'), full: Math.round(w.width) === innerWidth && Math.round(w.height) === innerHeight, hud: !!x && !!k && x.offsetParent !== null }; });
    ok(IM.on && IM.full && IM.hud, 'center stage fills the whole screen with a Stop audio and a Studio button');
    await hp.click('#vzhExit'); await wait(300);
    ok(await hp.evaluate(() => !document.body.classList.contains('vz-imm') && document.getElementById('vzHud').offsetParent === null), 'the Studio button brings the studio back');
        // the novice guitar coach: tune six strings, learn the song's chords, then play along (a stand-in guitar drives the listener)
    await hp.evaluate(() => { window.__daily.HUM.r = null; }); await hp.evaluate(async () => { await window.__daily.humGuitar(); }); await wait(800);
    const GC = await hp.evaluate(() => {
      const D = window.__daily, g = D.HUM.g, out = { start: g && g.step, chords: g && g.chords.join(), mode: document.getElementById('humbar').dataset.mode }; clearInterval(g.t);
      for (let st = 0; st < 6; st++) { for (let k = 0; k < 11; k++) { D.AN.f0 = D.humStringHz(st) * Math.pow(2, 3 / 1200); D.AN.clarity = .9; D.AN.rms = -20; D.AN.midi = 40; D.humGuitarTick(); } }
      out.afterTune = D.HUM.g.step; const syms = D.HUM.g.chords.slice();
      syms.forEach(sym => { const c = D.parseChord(sym); for (let k = 0; k < 9; k++) { D.AN.active = true; D.AN.rms = -20; D.AN.chord = [{ sym, root: c.root, q: c.q === 'maj' ? '' : c.q, score: .95 }]; D.humGuitarTick(); } });
      out.afterChords = D.HUM.g.step; out.canvas = !!document.querySelector('.hum-chord') || D.HUM.g.step === 'play'; return out; });
    ok(GC.start === 'tune' && GC.mode === 'g' && GC.chords === 'G,Em,C,D', 'the guitar coach starts at tuning with a friendly first song: ' + GC.chords);
    ok(GC.afterTune === 'chords', 'six in-tune strings move on to learning chords');
    ok(GC.afterChords === 'play', 'playing each chord correctly leads to playing along with the band');
ok(he.length === 0, 'hum to song runs without script errors' + (he.length ? ' ' + he[0] : '')); await hp.evaluate(() => { window.__daily.CFG.humStage = false; const c = JSON.parse(localStorage.getItem('fw.cfg') || '{}'); c.humStage = false; localStorage.setItem('fw.cfg', JSON.stringify(c)); }); await hp.close(); }
  // the studio adapts: a brand-new visitor sees a simple studio and more appears as they use it; "Tools" overrides
  { const nctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, permissions: ['microphone'] }), np = await nctx.newPage(), ne = []; np.on('pageerror', e => ne.push(e.message));
    await np.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'start=0'); await wait(3000); await np.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2500);
    await np.evaluate(() => { document.querySelectorAll('dialog').forEach(d => d.close()); const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); });
    const ids = () => np.$$eval('#dock .tab', t => t.map(x => x.dataset.id).sort().join());
    ok(await ids() === 'band,exp,song,vis', 'a brand-new visitor sees four plain tabs: ' + await ids());
    ok(/Save & export/.test(await np.$eval('#dock .tabs', e => e.textContent)) && !/1 · /.test(await np.$eval('#dock .tabs', e => e.textContent)), 'tab names are plain words, not numbered technical names');
    await np.click('.sb-zoom button[data-z="studio"]'); await wait(300); await np.click('.sb-zoom button[data-z="song"]'); await wait(300); await np.click('.sb-zoom button[data-z="studio"]'); await wait(600);
    ok((await ids()).split(',').includes('rig') && (await ids()).split(',').includes('tab'), 'using the studio adds more tools by itself: ' + await ids());
    await np.click('#xpTools'); await wait(300); await np.click('.xp-opt:has(b:text-is("Everything"))'); await wait(500);
    ok((await ids()).split(',').length >= 12 && /1 · Rig/.test(await np.$eval('#dock .tabs', e => e.textContent)), 'Tools ▸ Everything shows every tab with the technical names');
    await np.click('#xpTools'); await wait(300); await np.click('.xp-opt:has(b:text-is("Simple"))'); await wait(500);
    ok((await ids()).split(',').length <= 5, 'Tools ▸ Simple brings the short list back: ' + await ids());
    ok(ne.length === 0, 'the adaptive studio runs without script errors' + (ne.length ? ' ' + ne[0] : '')); await nctx.close(); }


  // the stage route: choosing it puts you on the stage (camera backdrop on Hex Resonance) and I/O is the first left tab; the studio route never touches the camera
  { const dctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, permissions: ['microphone', 'camera'] }); await dctx.addInitScript(() => { try { localStorage.setItem('fw.started', 'true'); } catch (e) { } });
    await dctx.route(/jsdelivr|googleapis/, r => r.abort()); const dp = await dctx.newPage(); await dp.goto(BASE + '?debug'); await wait(2500);
    ok(await dp.evaluate(() => !window.__daily.CAM.on), 'nothing touches the camera before a button is pressed');
    { const lt = await dp.evaluate(() => document.querySelector('#left .side-tabs .tab.on').dataset.id); ok(lt === 'io', 'the left rail opens on I/O (audio and camera inputs) instead of Tones (' + lt + ')'); }
    await dp.evaluate(() => document.getElementById('bootGo').click()); await wait(3500);
    ok(await dp.evaluate(() => !window.__daily.CAM.on && window.__daily.CFG.route === 'studio' && !document.body.classList.contains('vz-imm')), 'Start and connect my input is the studio route: no camera, not full-screen');
    await dp.evaluate(() => document.getElementById('vzGoStage').click()); await wait(4500);
    const DS = await dp.evaluate(() => { const D = window.__daily; return { cam: D.CAM.on, vz: D.VZ.cam, mode: D.VZ.mode, tab: !!document.querySelector('#dock .tab.on[data-id="vis"]'), btn: document.getElementById('ioCamBtn') && document.getElementById('ioCamBtn').classList.contains('on'), look: D.CFG.camFx, route: D.CFG.route }; });
    ok(DS.cam && DS.vz && DS.mode === 'hex' && DS.tab && DS.btn && DS.look === 'person' && DS.route === 'stage', '🎥 Go on stage starts the camera backdrop on Hex Resonance, me in front (' + JSON.stringify(DS) + ')');
    await dp.evaluate(() => document.getElementById('ioCamBtn').click()); await wait(600);
    ok(await dp.evaluate(() => !window.__daily.CAM.on && window.__daily.CFG.humStage === false), 'the camera button in I/O turns it off and the choice is remembered');
    await dctx.close(); }
  // first run: one panel on the stage, no second welcome dialog
  { const fctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, permissions: ['microphone', 'camera'] }); await fctx.route(/jsdelivr|googleapis/, r => r.abort());
    const fp = await fctx.newPage(); await fp.goto(BASE + '?debug'); await wait(2500); await fp.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2500);
    const F1 = await fp.evaluate(() => ({ panel: !!document.querySelector('#humbar[data-mode="canvas"]'), alts: ['humGo2', 'humGuitar', 'humAltFile', 'humAltDemo', 'humAltStage'].every(i => document.getElementById(i)), origins: !!document.getElementById('origins'), cam: window.__daily.CAM.on, imm: document.body.classList.contains('vz-imm'), canvas: document.body.classList.contains('zoom-canvas'), focus: document.activeElement && document.activeElement.classList.contains('lyr') }));
    ok(F1.panel && F1.alts && !F1.origins && !F1.cam && !F1.imm && F1.canvas && F1.focus, 'the studio route opens a clean canvas with the cursor in the lyrics and a slim bar: sing or hum, guitar, song file, demo, stage (' + JSON.stringify(F1) + ')');
    await fp.evaluate(() => document.querySelector('#humbar .hum-x').click()); await wait(500);
    ok(await fp.evaluate(() => !document.getElementById('humbar') && (document.querySelector('.sb-title') || {}).value === 'Untitled idea'), 'closing the bar keeps the clean page');
    ok(await fp.evaluate(() => { const b = window.__daily.S.band; return !b.drumsOn && !b.bassOn && !b.compOn && !b.leadOn; }), 'a new blank song starts with the band off (playback is only what you record)');
    await fp.close(); await fctx.close();
    const gctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, permissions: ['microphone', 'camera'] }); await gctx.route(/jsdelivr|googleapis/, r => r.abort());
    const gp = await gctx.newPage(); await gp.goto(BASE + '?debug'); await wait(2500); await gp.evaluate(() => document.getElementById('bootStage').click()); await wait(4500);
    const G1 = await gp.evaluate(() => ({ panel: !!document.querySelector('#humbar[data-mode="start"]'), imm: document.body.classList.contains('vz-imm'), cam: window.__daily.CAM.on, origins: !!document.getElementById('origins') }));
    ok(G1.panel && G1.imm && G1.cam && !G1.origins, 'Begin on stage: full-screen stage, camera on, one start panel (' + JSON.stringify(G1) + ')');
    await gp.evaluate(() => document.getElementById('vzhNew').click()); await wait(1500);
    ok(await gp.evaluate(() => new Promise(res => { const r = indexedDB.open('the-daily-songs'); r.onsuccess = () => { const t = r.result.transaction('projects').objectStore('projects').count(); t.onsuccess = () => res(t.result === 1); }; r.onerror = () => res(false); })), '＋ New song on the stage reuses the untouched page instead of piling up empty songs');
    await gp.close(); await gctx.close();
    // the studio route never asks for the camera or goes full-screen, and the route is remembered
    const vctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, permissions: ['microphone', 'camera'] }); await vctx.route(/jsdelivr|googleapis/, r => r.abort());
    const vp = await vctx.newPage(); await vp.goto(BASE + '?debug'); await wait(2500);
    ok(await vp.evaluate(() => document.getElementById('bootNoMic').classList.contains('primary') && !document.getElementById('bootStage').classList.contains('primary')), 'the studio route is the default first choice');
    await vp.evaluate(() => document.getElementById('bootNoMic').click()); await wait(4500);
    const V1 = await vp.evaluate(() => { const D = window.__daily; return { cam: D.CAM.on, route: D.CFG.route, imm: document.body.classList.contains('vz-imm'), panel: !!document.querySelector('#humbar[data-mode="canvas"]'), stageBox: document.getElementById('humStage') ? document.getElementById('humStage').checked : null, goBtn: !!document.getElementById('vzGoStage') }; });
    ok(!V1.cam && V1.route === 'studio' && !V1.imm && V1.panel && V1.goBtn, 'Begin in the studio: clean canvas bar, no camera, not full-screen, a Go on stage button is there (' + JSON.stringify(V1) + ')');
    await vp.evaluate(() => document.getElementById('vzGoStage').click()); await wait(3500);
    await vp.reload(); await wait(2500);
    ok(await vp.evaluate(() => document.getElementById('bootStage').classList.contains('primary') && window.__daily.CFG.route === 'stage'), 'the route you used last is highlighted on the next visit');
    await vp.evaluate(() => { window.__daily.CFG.route = 'studio'; }); await vp.close(); await vctx.close(); }
  // record the stage: a video with the song's sound is saved locally; whole-song mode plays from the top; the kill switch discards
  { const rp = await ctx0.newPage(), re = []; rp.on('pageerror', e => re.push(e.message)); await rp.goto(BASE + '?debug'); await wait(2500);
    await rp.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2500);
    await rp.evaluate(() => { document.querySelectorAll('#humbar').forEach(d => d.remove()); const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); });
    ok(await rp.evaluate(() => !!document.getElementById('vzRecBtn') && typeof window.__daily.srecStart === 'function'), 'the Visuals bar has a Record button');
    await rp.evaluate(() => window.__daily.srecStart(false)); await wait(2600);
    ok(await rp.evaluate(() => window.__daily.SREC.on && /Stop|■/.test(document.getElementById('vzRecBtn').textContent) && document.getElementById('vzRecBtn').classList.contains('bad')), 'recording shows on the button with a running clock');
    const dl = rp.waitForEvent('download', { timeout: 8000 }); await rp.evaluate(() => window.__daily.srecStop(true));
    const d1 = await dl.catch(() => null), f1 = d1 && await d1.path().catch(() => null), sz = f1 ? fs.statSync(f1).size : 0;
    ok(!!d1 && /_stage\.(webm|mp4)$/.test(d1.suggestedFilename()) && sz > 3000, 'Record stage saves a video file on this device (' + (d1 ? d1.suggestedFilename() : 'no download') + ', ' + sz + ' bytes)');
    ok(await rp.evaluate(() => !window.__daily.SREC.on && !window.__daily.SREC.dest), 'stopping releases the recorder and audio tap');
    await rp.evaluate(() => window.__daily.srecStart(true)); await wait(1500);
    ok(await rp.evaluate(() => window.__daily.SREC.on && window.__daily.SREC.whole && window.__daily.T.playing === true), 'whole-song recording plays the song from the top');
    let got = false; rp.once('download', () => { got = true; }); await rp.keyboard.press('Control+.'); await wait(1800);
    ok(!got && await rp.evaluate(() => !window.__daily.SREC.on && !window.__daily.T.playing), 'the kill switch stops a recording and discards it');
    ok(re.length === 0, 'stage recording runs without script errors' + (re.length ? ' ' + re[0] : '')); await rp.close(); }
  // voice memo: one Vocal take on the clean page, no band, the song grows to hold it; the kill switch discards an unfinished memo
  { const mctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, permissions: ['microphone'] }); await mctx.route(/jsdelivr|googleapis/, r => r.abort()); const mp = await mctx.newPage(), me = []; mp.on('pageerror', e => me.push(e.message)); await mp.goto(BASE + '?debug'); await wait(2500);
    await mp.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2500);
    ok(await mp.evaluate(() => !!document.getElementById('humMemo')), 'the clean canvas bar offers a Voice memo');
    await mp.evaluate(() => document.getElementById('humMemo').click()); await wait(2800);
    ok(await mp.evaluate(() => !!document.getElementById('humStop') && /voice memo/i.test(document.getElementById('humbar').textContent)), 'pressing Voice memo starts a recording (and only then asks for the microphone)');
    await mp.evaluate(() => document.getElementById('humStop').click()); await wait(2500);
    const M1 = await mp.evaluate(() => { const D = window.__daily, S = D.S, tk = D.TAKES.filter(t => t.memo); return { n: tk.length, kind: tk[0] && tk[0].kind, dur: tk[0] && +tk[0].dur.toFixed(1), cover: D.songSlots() * D.slotDur() >= (tk[0] ? tk[0].dur : 99), band: S.band.drumsOn || S.band.bassOn || S.band.compOn || S.band.leadOn, bar: !!document.querySelector('#humbar[data-mode="canvas"]') }; });
    ok(M1.n === 1 && M1.kind === 'vox' && M1.dur > 1.5 && M1.cover && !M1.band && M1.bar, 'the memo becomes one Vocal take, no band, and the page is long enough to play it (' + JSON.stringify(M1) + ')');
    await mp.evaluate(() => document.getElementById('humMemo').click()); await wait(1800); await mp.keyboard.press('Control+.'); await wait(900);
    ok(await mp.evaluate(() => window.__daily.TAKES.filter(t => t.memo).length === 1 && !window.__daily.HUM.rec), 'the kill switch discards an unfinished memo');
    ok(me.length === 0, 'voice memo runs without script errors' + (me.length ? ' ' + me[0] : '')); await mp.close(); await mctx.close(); }
  // loudness, compressed audio, share page, print sheet
  { const xp = await ctx0.newPage(), xe = []; xp.on('pageerror', e => xe.push(e.message)); await xp.goto(BASE + '?debug'); await wait(2500);
    await xp.evaluate(() => { const b = document.getElementById('bootNoMic'); if (b) b.click(); }); await wait(2000);
    const LU = await xp.evaluate(() => { const D = window.__daily, sr = 48000, n = sr * 6, mk = a => { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = a * Math.sin(2 * Math.PI * 997 * i / sr); return x; };
      const a = D.lufsMeasure(mk(.1), mk(.1), sr), b = D.lufsMeasure(mk(1), mk(1), sr), z = D.lufsMeasure(new Float32Array(n), new Float32Array(n), sr);
      D.CFG.lufsTarget = -14; const l = mk(.05), r = mk(.05), note = D.loudAfterBounce(l, r, sr), after = D.lufsMeasure(l, r, sr); D.CFG.lufsTarget = 0; return { a: a.lufs, ap: a.tp, b: b.lufs, z: z.lufs, note, after: after.lufs }; });
    ok(Math.abs(LU.a + 20) < .3 && Math.abs(LU.ap + 20) < .4 && Math.abs(LU.b) < .3 && LU.z === -Infinity, 'loudness meter: −20 dBFS stereo sine reads −20 LUFS, full scale reads 0, silence is −∞ (' + LU.a.toFixed(2) + ', ' + LU.b.toFixed(2) + ', peak ' + LU.ap.toFixed(2) + ')');
    ok(Math.abs(LU.after + 14) < .3 && /−14\.0 LUFS/.test(LU.note), 'a loudness target brings a bounce to −14 LUFS (' + LU.note + ')');
    const SH = await xp.evaluate(() => { const D = window.__daily; D.S.sections[0].lyrics = '[Am]Salt wind on the water\n[F]Morning on my skin'; D.S.sections[1].lyrics = 'Hold on to the light'; const d = D.shareData(); return { html: D.shareHtml('data:audio/webm;base64,AAAA', d), n: d.secs.length, lines: d.secs.reduce((a, s) => a + s.lines.length, 0), title: d.title }; });
    ok(SH.n >= 2 && SH.lines >= 2 && !/(src|href)="https?:/.test(SH.html) && SH.html.length > 3000, 'the share page is one self-contained file with every section (' + SH.n + ' sections, ' + SH.lines + ' lyric lines, ' + (SH.html.length / 1024).toFixed(0) + ' KB)');
    const sp = await ctx0.newPage(), se = [], reqs = []; sp.on('pageerror', e => se.push(e.message)); sp.on('request', r => { if (!/^(data:|about:|blob:)/.test(r.url())) reqs.push(r.url()); }); await sp.setContent(SH.html); await wait(600);
    const SP = await sp.evaluate(() => ({ h1: document.querySelector('h1').textContent, ln: document.querySelectorAll('.ln').length, cv: !!document.getElementById('cv'), btn: !!document.getElementById('pl') }));
    ok(SP.h1 === SH.title && SP.ln === SH.lines && SP.cv && SP.btn && se.length === 0 && reqs.length === 0, 'the share page opens on its own with a title, lyrics and a player, no errors and no requests (' + JSON.stringify(SP) + ' ' + se.join(';') + ')'); await sp.close();
    const wasm = await xp.evaluate(() => new Promise(res => { const D = window.__daily; let got = null; D.srecStart(false, { audio: true, onBlob: b => { got = b; } }).then(() => setTimeout(() => { D.srecStop(true); setTimeout(() => res(got ? { size: got.size, type: got.type } : null), 1500); }, 2200)); }));
    ok(!!wasm && wasm.size > 1000 && /audio\/(mp4|webm)/.test(wasm.type), 'compressed audio is recorded from the master output (' + JSON.stringify(wasm) + ')');
    const dl2 = xp.waitForEvent('download', { timeout: 9000 }); await xp.evaluate(() => { const D = window.__daily; D.srecStart(false, { audio: true }); setTimeout(() => D.srecStop(true), 2200); });
    const cd = await dl2.catch(() => null); ok(!!cd && /_audio\.(m4a|webm)$/.test(cd.suggestedFilename()), 'Compressed audio saves an .m4a or .webm file (' + (cd ? cd.suggestedFilename() : 'no download') + ')');
    await xp.evaluate(() => { window.print = () => { window.__printed = { t: document.getElementById('printSheet').innerText, cls: document.body.classList.contains('printing-sheet') }; window.dispatchEvent(new Event('afterprint')); }; window.__daily.printSheet(); }); await wait(500);
    const PR = await xp.evaluate(() => ({ p: window.__printed, gone: !document.getElementById('printSheet') && !document.body.classList.contains('printing-sheet'), html: window.__daily.printSheetHtml() }));
    ok(PR.p && PR.p.cls && PR.p.t.length > 40 && PR.gone && /<b>/.test(PR.html), 'the print sheet opens the print dialog with chords over lyrics, then cleans up (' + (PR.p ? PR.p.t.slice(0, 40).replace(/\n/g, ' ') : '') + ')');
    await xp.evaluate(() => window.__daily.dockGo('exp')); await wait(500);
    ok(await xp.evaluate(() => ['exAudioC', 'exShare', 'exPrint'].every(i => document.getElementById(i))), 'the Export panel offers compressed audio, a share page and a print sheet');
    ok(xe.length === 0, 'export and share run without script errors' + (xe.length ? ' ' + xe[0] : '')); await xp.close(); }
  // Perform: readiness check, big chord + lyrics following the song, count-in and record, Esc to leave
  { const pp = await ctx0.newPage(), pe = []; pp.on('pageerror', e => pe.push(e.message)); await pp.goto(BASE + '?debug'); await wait(2500);
    await pp.evaluate(() => { const b = document.getElementById('bootNoMic'); if (b) b.click(); }); await wait(2000);
    await pp.evaluate(() => { document.querySelectorAll('#humbar').forEach(d => d.remove()); const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); });
    await pp.click('#sbPerform'); await wait(500);
    const P1 = await pp.evaluate(() => ({ dlg: !!document.getElementById('perform'), ready: !!document.getElementById('pfReady'), rows: document.querySelectorAll('.pf-r').length, audio: document.getElementById('pfRAudio').classList.contains('ok'), noInput: !!document.getElementById('pfConnect'), bar: getComputedStyle(document.querySelector('.pf-bar')).display }));
    ok(P1.dlg && P1.ready && P1.rows >= 3 && P1.audio && P1.noInput && P1.bar === 'none', 'Perform opens with a readiness check first (' + JSON.stringify(P1) + ')');
    await pp.click('#pfConnect'); await wait(3000);
    ok(await pp.evaluate(() => window.__daily.E.hasInput && !!document.getElementById('pfLv') && !document.getElementById('pfConnect')), 'Connect input in the check brings the input and its level meter up');
    await pp.click('#pfGo'); await wait(300);
    ok(await pp.evaluate(() => !document.getElementById('pfReady') && getComputedStyle(document.querySelector('.pf-bar')).display !== 'none'), 'Start performing reveals the play and record controls');
    await pp.click('#pfPlay'); await wait(3200);
    const P2 = await pp.evaluate(() => ({ chord: document.getElementById('pfChord').textContent, sec: document.getElementById('pfSec').textContent, play: document.getElementById('pfPlay').textContent, playing: window.__daily.T.playing, lyr: document.querySelectorAll('.pf-l').length }));
    ok(P2.playing && /^[A-G]/.test(P2.chord) && /bar \d\/\d/.test(P2.sec) && /Stop/.test(P2.play) && P2.lyr >= 1, 'playing shows the chord big, the section and bar, and the lyrics (' + JSON.stringify(P2) + ')');
    await pp.click('#pfPlay'); await wait(500);
    const t0 = await pp.evaluate(() => window.__daily.TAKES.length); await pp.click('#pfRec'); await wait(2200);
    ok(await pp.evaluate(() => document.getElementById('pfChord').classList.contains('pf-count') && window.__daily.T.rec), 'Record starts with a count-in shown as big numbers');
    await wait(4800); ok(await pp.evaluate(() => document.getElementById('pfRec').classList.contains('on')), 'then it is recording');
    await pp.click('#pfPlay'); await wait(1800);
    ok(await pp.evaluate(n => window.__daily.TAKES.length > n, t0), 'stopping saves a take into the song');
    await pp.keyboard.press('Escape'); await wait(300);
    ok(await pp.evaluate(() => !document.getElementById('perform') && !document.body.classList.contains('perform-on')), 'Esc leaves Perform');
    await pp.click('#sbPerform'); await wait(400); await pp.click('#pfGo'); await pp.click('#pfPlay'); await wait(800); await pp.keyboard.press('Control+.'); await wait(700);
    ok(await pp.evaluate(() => !window.__daily.T.playing), 'the kill switch works inside Perform');
    await pp.evaluate(() => window.__daily.perfClose());
    ok(pe.length === 0, 'Perform runs without script errors' + (pe.length ? ' ' + pe[0] : '')); await pp.close(); }
  // backup folder: choose a folder (stubbed picker), songs are written as .daily-song.zip, and a change is written again
  { const yp = await ctx0.newPage(), ye = []; yp.on('pageerror', e => ye.push(e.message));
    await yp.addInitScript(() => { window.__syncDelay = 300; window.__wrote = {}; const dir = { name: 'My Songs', kind: 'directory', queryPermission: async () => 'granted', requestPermission: async () => 'granted', getFileHandle: async n => ({ createWritable: async () => ({ write: async b => { window.__wrote[n] = b.size; }, close: async () => { } }) }) }; window.showDirectoryPicker = async () => dir; });
    await yp.goto(BASE + '?debug'); await wait(2500); await yp.evaluate(() => { const b = document.getElementById('bootNoMic'); if (b) b.click(); }); await wait(2000);
    await yp.evaluate(() => { document.querySelectorAll('#humbar').forEach(d => d.remove()); const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); });
    await yp.click('.btn.icon[title="Settings"]'); await wait(300);
    ok(await yp.evaluate(() => !!document.getElementById('syncChoose')), 'Settings offers a backup folder');
    await yp.click('#syncChoose'); await wait(2500);
    const Y1 = await yp.evaluate(() => ({ names: Object.keys(window.__wrote), cfg: window.__daily.CFG.sync, name: window.__daily.SYNC.name, ctl: !!document.getElementById('syncOff') }));
    ok(Y1.cfg && Y1.name === 'My Songs' && Y1.names.length >= 1 && Y1.names.every(n => /\.daily-song\.zip$/.test(n)) && Y1.ctl, 'choosing a folder saves every song there as a .daily-song.zip (' + JSON.stringify(Y1) + ')');
    await yp.evaluate(() => { window.__wrote = {}; window.__daily.S.title = 'Backup test song'; window.__daily.commit(); }); await wait(4500);
    ok(await yp.evaluate(() => Object.keys(window.__wrote).some(n => /^Backup-test-song.*\.daily-song\.zip$/.test(n))), 'a change is written to the folder by itself');
    await yp.click('#syncOff'); await wait(300);
    ok(await yp.evaluate(() => !window.__daily.CFG.sync && !window.__daily.SYNC.dir && !!document.getElementById('syncChoose')), 'Turn off stops the folder backup');
    ok(ye.length === 0, 'folder backup runs without script errors' + (ye.length ? ' ' + ye[0] : '')); await yp.close(); }
  // auto look: the look follows the section while playing, and your own look returns when it stops
  { const ap2 = await ctx0.newPage(), ae2 = []; ap2.on('pageerror', e => ae2.push(e.message)); await ap2.goto(BASE + '?debug'); await wait(2500);
    await ap2.evaluate(() => { const b = document.getElementById('bootNoMic'); if (b) b.click(); }); await wait(2000);
    const AL = await ap2.evaluate(async () => { const D = window.__daily, w = ms => new Promise(r => setTimeout(r, ms)); D.vzSetMode('hex'); D.S.sections[0].name = 'Chorus'; D.T.bars = null; D.CFG.vzAuto = true; D.T.cursor = 0; D.T.loop = true; await D.play(); await w(900); const during = D.VZ.mode; D.stopPlay(true); await w(700); return { during, after: D.VZ.mode }; });
    ok(AL.during === 'halo' && AL.after === 'hex', 'Auto look switches to the Fifths Halo in a chorus and goes back to your look when playback stops (' + JSON.stringify(AL) + ')');
    ok(await ap2.evaluate(() => !!document.getElementById('vzAutoBtn')), 'the Visuals bar has an Auto look button');
    await ap2.evaluate(() => { window.__daily.CFG.vzAuto = false; }); ok(ae2.length === 0, 'auto look runs without script errors' + (ae2.length ? ' ' + ae2[0] : '')); await ap2.close(); }
  // the v2.1 blocks run in their own fresh browser context: the songs, layout and settings left by the earlier flows must not leak in
  const freshCtx = async () => { const c = await browser.newContext({ viewport: { width: 1500, height: 900 }, permissions: ['microphone'] }); await c.addInitScript(() => { try { localStorage.setItem('fw.started', 'true'); } catch (e) { } }); return c; };
  // I/O 2: one Connect card, Set my level, adaptive Channels, signal path, output test, new-interface offer, permission help
  { const ip = await (await freshCtx()).newPage(), ie = []; ip.on('pageerror', e => ie.push(e.message));
    await ip.addInitScript(() => { window.__gum = 0; const md = navigator.mediaDevices, g = md.getUserMedia.bind(md); md.getUserMedia = c => { if (c && c.audio) window.__gum++; return g(c); }; });
    await ip.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'debug'); await wait(3500);
    await ip.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2000);
    await ip.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); const hb = document.getElementById('humbar'); if (hb) hb.remove(); });
    await ip.evaluate(() => window.__daily.sideShow('io')); await wait(500);   // the context's saved layout may have the sidebar hidden
    ok(await ip.evaluate(() => window.__gum) === 0 && /Not connected/.test(await ip.$eval('#ioConn .io-st', e => e.textContent)), 'I/O: one Connect card says “Not connected” and asks nothing of the browser');
    ok(await ip.evaluate(() => { const a = document.getElementById('ioAdv'); return a && a.tagName === 'DETAILS' && !a.open && /Latency lab/.test(a.textContent) && /Diagnose/.test(a.textContent) && /Focusrite/.test(a.textContent); }), 'I/O: Latency lab, Focusrite notes and Diagnose live in a closed “Advanced & troubleshooting” fold');
    ok(await ip.evaluate(() => { const h4 = [...document.querySelectorAll('#left .pane.on .card > h4, #left .card > h4')].map(e => e.textContent.trim()); return h4.indexOf('Audio input') === 0 && h4.indexOf('Channels') === 1; }), 'I/O: Connect first, then Channels');
    ok(await ip.evaluate(() => !!document.querySelector('.aud .aud-lv')), 'the header Audio button carries a live level bar');
    // pure helpers
    const P = await ip.evaluate(() => { const D = window.__daily, o = {};
      o.ff = D.ioBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0', 0); o.sm = D.ioBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 0); o.si = D.ioBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 5); o.ed = D.ioBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0', 0); o.ch = D.ioBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 0);
      o.hFF = D.ioPermHelp('NotAllowedError', o.ff, false, true).steps.join(' '); o.hSI = D.ioPermHelp('NotAllowedError', o.si, false, true).steps.join(' '); o.hSM = D.ioPermHelp('NotAllowedError', o.sm, false, true).steps.join(' '); o.hCH = D.ioPermHelp('NotAllowedError', o.ch, false, true).steps.join(' '); o.hFR = D.ioPermHelp('NotAllowedError', o.ch, true, true).steps[0]; o.hIN = D.ioPermHelp('SecurityError', o.ch, false, false).steps[0];
      o.k = ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'ended', 'TypeError'].map(n => D.ioPermHelp(n, o.ch, false, true).kind).join();
      o.p = [-24, -60, -0.2, -50, -1, 3].map(r => JSON.stringify(D.ioPlan(r, -9))).join('|');
      o.d = [{ conn: false }, { conn: true, roles: false }, { conn: true, raw: -0.2, trim: -0.2 }, { conn: true, raw: -10, trim: 3 }, { conn: true, raw: -10, trim: -10, master: -0.5 }, { conn: true, raw: -90, trim: -90, recent: -90, silentFor: 8 }, { conn: true, raw: -90, trim: -90, recent: -90, silentFor: 8, monoBad: true }, { conn: true, raw: -40, trim: -40, recent: -40, master: -40, silentFor: 0 }, { conn: true, raw: -12, trim: -12, recent: -12, master: -40, silentFor: 0 }].map(L => D.ioDiagnose(Object.assign({ roles: true, raw: -120, trim: -120, recent: -120, master: -120, silentFor: 0 }, L)).k).join();
      o.n = D.ioNewInputs(['a', 'b'], [{ deviceId: 'a', label: 'A' }, { deviceId: 'c', label: 'C' }, { deviceId: 'default', label: 'Default' }, { deviceId: 'd', label: '' }]).map(d => d.deviceId).join(); return o; });
    ok(P.ff.b === 'firefox' && P.ff.os === 'win' && P.sm.b === 'safari' && P.sm.os === 'mac' && P.si.os === 'ios' && P.ed.b === 'edge' && P.ch.b === 'chrome' && P.ch.os === 'mac', 'permission help knows the browser and system (' + [P.ff.b + '/' + P.ff.os, P.sm.b + '/' + P.sm.os, P.si.b + '/' + P.si.os, P.ed.b, P.ch.b + '/' + P.ch.os].join(', ') + ')');
    ok(/permissions icon/.test(P.hFF) && /aA/.test(P.hSI) && /Settings for This Website/.test(P.hSM) && /Site settings/.test(P.hCH) && /System Settings → Privacy/.test(P.hCH) && /frame/.test(P.hFR) && /secure/.test(P.hIN), 'a blocked microphone gets browser-specific steps (Firefox, Safari Mac and iPhone, Chrome, frames, insecure page)');
    ok(P.k === 'denied,none,busy,ended,other', 'help covers blocked, not found, busy, unplugged and other errors (' + P.k + ')');
    ok(JSON.parse(P.p.split('|')[0]).trim === 15 && JSON.parse(P.p.split('|')[1]).k === 'none' && JSON.parse(P.p.split('|')[2]).k === 'hot' && JSON.parse(P.p.split('|')[3]).trim === 36 && JSON.parse(P.p.split('|')[3]).big === true && JSON.parse(P.p.split('|')[4]).trim === -8 && JSON.parse(P.p.split('|')[4]).low === true && JSON.parse(P.p.split('|')[5]).k === 'hot', 'Set my level maths: peak −24 → +15 dB, silence → none, 0 dBFS → hot, big gain flagged, clamps at +36, hot interface flagged (' + P.p.slice(0, 120) + ')');
    ok(P.d === 'idle,warn,bad,bad,warn,warn,warn,warn,ok', 'the signal-path sentence follows the levels (' + P.d + ')');
    ok(P.n === 'c', 'a new interface is spotted only if it is new, named and not the system default (' + P.n + ')');
    // connect
    await ip.click('#ioConn .io-go'); await wait(2500);
    ok(await ip.evaluate(() => window.__gum) > 0 && /\d ch · [\d.]+ kHz/.test(await ip.$eval('#ioConn .io-st', e => e.textContent)) && /Disconnect/.test(await ip.$eval('#ioConn .io-go', e => e.textContent)), 'Connect opens the input and the card shows the device, channels and sample rate');
    ok(await ip.evaluate(() => document.querySelectorAll('#ioConn .io-path .io-n').length === 4 && !!document.querySelector('#ioConn .io-out .io-test') && !!document.querySelector('#ioConn .io-msg')), 'signal path strip: Input, Trim, Rig, Master, Out with a message line');
    ok(await ip.evaluate(() => { const l = document.querySelector('#ioConn .io-level'); return !!l && !l.disabled; }), '“Set my level” is available once connected');
    // set my level
    await ip.evaluate(() => { window.__ioLevelMs = 500; window.__ioFeed = () => -24; });
    await ip.click('#ioConn .io-level'); await wait(300); ok(await ip.$eval('#iolevel', d => d.open), 'Set my level opens its dialog');
    await ip.click('#iolevel .io-wz-go'); await wait(1200);
    ok(await ip.evaluate(() => { const D = window.__daily, r = document.querySelector('#iolevel .io-wz-res'); return !!r && r.dataset.k === 'ok' && D.KNOBS.get('trim').get() === 15 && D.CFG.gTrim === 15 && D.CFG.ioLeveled === true; }), 'Set my level: a −24 dBFS peak sets the trim to +15 dB and remembers it');
    ok(await ip.evaluate(() => { const D = window.__daily; return Math.abs(D.E.inTrim.gain.value - Math.pow(10, 15 / 20)) < .5 || D.E.inTrim.gain.value > 2; }), 'the trim is applied to the audio graph');
    await ip.click('#iolevel .io-wz-undo'); await wait(300);
    ok(await ip.evaluate(() => window.__daily.KNOBS.get('trim').get() === 0 && !document.getElementById('iolevel')), 'Undo puts the trim back');
    await ip.evaluate(() => { window.__ioFeed = () => -0.2; }); await ip.click('#ioConn .io-level'); await ip.click('#iolevel .io-wz-go'); await wait(1200);
    ok(await ip.evaluate(() => { const r = document.querySelector('#iolevel .io-wz-res'); return !!r && r.dataset.k === 'hot' && window.__daily.KNOBS.get('trim').get() === 0; }), 'a signal that already clips at the interface is not “fixed” in software; it says to turn the gain knob down');
    await ip.click('#iolevel .io-wz-again'); await ip.evaluate(() => { window.__ioFeed = () => -90; }); await ip.click('#iolevel .io-wz-go'); await wait(1200);
    ok(await ip.evaluate(() => { const r = document.querySelector('#iolevel .io-wz-res'); return !!r && r.dataset.k === 'none' && /did not hear/.test(r.textContent); }), 'silence gets a checklist instead of a number');
    await ip.keyboard.press('Escape'); await wait(200); await ip.evaluate(() => { delete window.__ioFeed; });
    // channels follow the device
    ok(await ip.evaluate(() => !!document.querySelector('select[aria-label="What input 2 is"]') && !!document.querySelector('.io-preset')), 'Channels: a two-input device shows both inputs and one-tap presets');
    await ip.evaluate(() => { const D = window.__daily; D.E.inSettings = Object.assign({}, D.E.inSettings, { channelCount: 1 }); D.bus.emit('input', D.E.inSettings); }); await wait(300);
    ok(await ip.evaluate(() => !document.querySelector('select[aria-label="What input 2 is"]') && !!document.querySelector('select[aria-label="What input 1 is"]') && /single input/.test(document.querySelector('#left .chmx').parentNode.textContent)), 'Channels: a one-input device shows only one input and explains why');
    await ip.evaluate(() => { const D = window.__daily; D.E.inSettings = Object.assign({}, D.E.inSettings, { channelCount: 2 }); D.bus.emit('input', D.E.inSettings); }); await wait(300);
    await ip.click('.io-preset:has-text("Guitar & voice")'); await wait(300);
    ok(await ip.evaluate(() => window.__daily.chRoles().join() === 'g,v'), 'preset “Guitar & voice” puts the guitar on input 1 and the voice on input 2');
    await ip.click('.io-preset:has-text("Swap")'); await wait(300);
    ok(await ip.evaluate(() => window.__daily.chRoles().join() === 'v,g'), 'preset “Swap” swaps the two inputs');
    await ip.click('.io-preset:has-text("Guitar")'); await wait(200); await ip.evaluate(() => window.__daily.chSetRoles('g', 'o'));
    // the same Connect card in the header panel and in Perform
    await ip.click('.aud'); await wait(400);
    ok(await ip.evaluate(() => !!document.querySelector('#audio .io-conn .io-level') && !!document.querySelector('#audio .io-path') && /Disconnect/.test(document.querySelector('#audio .io-go').textContent)), 'the header Audio panel uses the same Connect card (level, path, test)');
    await ip.keyboard.press('Escape'); await wait(200);
    await ip.evaluate(() => window.__daily.perfOpen()); await wait(600);
    ok(await ip.evaluate(() => !!document.getElementById('pfLevel') && /connected/i.test(document.getElementById('pfRIn').textContent)), 'Perform: once connected, the readiness card offers “Set level”');
    await ip.evaluate(() => window.__daily.perfClose()); await wait(300);
    // output test
    await ip.evaluate(() => { window.__osc = 0; const f = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function () { window.__osc++; return f.apply(this, arguments); }; });
    await ip.click('#ioConn .io-test'); await wait(1600);
    ok(await ip.evaluate(() => window.__osc) >= 2, 'Test sound plays a tone on the left and then the right');
    // permission help in the card
    await ip.evaluate(() => { const D = window.__daily; D.closeInput(); D.E.lastInKind = 'NotAllowedError'; D.E.lastInErr = 'The microphone is blocked'; D.bus.emit('input', null); }); await wait(300);
    ok(await ip.evaluate(() => { const h = document.querySelector('#ioConn .io-help'); return !!h && !h.hidden && /blocked in/.test(h.textContent) && !!h.querySelector('.io-retry') && !!h.querySelector('.io-diag'); }), 'a refused microphone shows steps for this browser with “Try again” and “Run diagnostics”');
    await ip.click('#ioConn .io-retry'); await wait(2500);
    ok(await ip.evaluate(() => window.__daily.E.hasInput && document.querySelector('#ioConn .io-help').hidden), 'Try again reconnects and clears the help');
    // new interface offer: asks nothing until “Use it”
    const g0 = await ip.evaluate(() => window.__gum), cur = await ip.evaluate(() => window.__daily.E.inSettings.deviceId);
    await ip.evaluate(id => window.__daily.ioOffer({ deviceId: id, label: 'Focusrite Scarlett Solo USB' }), cur); await wait(300);
    ok(await ip.evaluate(() => !!document.getElementById('ioOffer') && /Focusrite Scarlett Solo USB/.test(document.getElementById('ioOffer').textContent)) && await ip.evaluate(() => window.__gum) === g0, 'a newly plugged-in interface is offered by name and nothing is requested until you answer');
    await ip.click('#ioOfferUse'); await wait(2200);
    ok(await ip.evaluate(() => window.__gum) > g0 && !!(await ip.$('#ioOfferLevel')), '“Use it” connects it and offers Set my level');
    await ip.click('#ioOffer .btn:has-text("Done")'); await wait(200);
    // kill switch
    await ip.keyboard.press('Control+.'); await wait(500);
    ok(await ip.evaluate(() => !window.__daily.E.hasInput) && /killed/i.test(await ip.$eval('#ioConn .io-st', e => e.textContent)), 'the kill switch drops the input and the card says so');
    ok(ie.length === 0, 'I/O 2 runs without script errors' + (ie.length ? ' ' + ie[0] : '')); await ip.close(); }
  // v2.1 · drop anywhere
  { const dp = await (await freshCtx()).newPage(), de = []; dp.on('pageerror', e => de.push(e.message));
    await dp.addInitScript(() => { window.__gum = 0; const md = navigator.mediaDevices, g = md.getUserMedia.bind(md); md.getUserMedia = c => { if (c && (c.audio || c.video)) window.__gum++; return g(c); }; });
    await dp.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'debug'); await wait(3500);
    await dp.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2000);
    await dp.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); const hb = document.getElementById('humbar'); if (hb) hb.remove(); });
    // helper: send a drag/drop of generated files at an element
    await dp.evaluate(() => {
      window.__wav = (sec, f) => { const sr = 22050, n = Math.floor(sr * sec), b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * (f || 220) * i / sr) * 9000), true); return b; };
      window.__fire = (type, files, target) => { const dt = new DataTransfer(); files.forEach(f => dt.items.add(f)); const ev = new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }); (target || document.body).dispatchEvent(ev); return ev.defaultPrevented; };
    });
    ok(await dp.evaluate(() => { const r = document.getElementById('tlDrop'); return !!r && !r.hidden && /Drop audio, lyrics or a song file/.test(r.textContent) && !!r.querySelector('#dropPick') && !!r.querySelector('#dropMemo'); }), 'empty arrangement shows the drop row with Choose a file… and Voice memo');
    ok(await dp.evaluate(() => { const D = window.__daily, k = n => D.dropKind({ name: n, type: '' }); return [k('a.mp3'), k('b.WAV'), k('c.m4a'), k('d.txt'), k('e.lrc'), k('f.md'), k('g.zip'), k('h.json'), k('i.mid'), k('j.exe'), k('k.mp4'), D.dropKind({ name: 'x', type: 'audio/ogg' })].join(); }) === 'audio,audio,audio,lyrics,lyrics,lyrics,bundle,json,midi,other,audio,audio', 'files are classified by name and type');
    // overlay on drag over, gone after leave
    const pre = await dp.evaluate(() => { window.__fire('dragenter', [new File(['x'], 'a.wav')]); const prevented = window.__fire('dragover', [new File(['x'], 'a.wav')]); const ov = document.getElementById('dropOv'); return { prevented, on: !!ov && ov.classList.contains('on'), txt: ov ? ov.textContent : '' }; });
    ok(pre.prevented && pre.on && /Drop to add it here/.test(pre.txt), 'dragging a file over the page shows the drop overlay (and accepts the drop)');
    ok(await dp.evaluate(() => { const ev = new DragEvent('dragleave', { bubbles: true, relatedTarget: null }); document.body.dispatchEvent(ev); return !document.getElementById('dropOv').classList.contains('on'); }), 'leaving the window hides the overlay');
    ok(await dp.evaluate(() => { const dt = new DataTransfer(); const ev = new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }); document.body.dispatchEvent(ev); return !ev.defaultPrevented && !document.getElementById('dropOv').classList.contains('on'); }), 'an in-app drag (no files) is left alone');
    // unsupported file: toast, nothing else, page not navigated
    const bad = await dp.evaluate(async () => { const pv = window.__fire('drop', [new File(['MZ'], 'setup.exe')]); await new Promise(r => setTimeout(r, 200)); return { pv, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join('|'), dlg: !!document.getElementById('dropDlg') }; });
    ok(bad.pv && /not something the-daily\.studio can open/.test(bad.toast) && !bad.dlg, 'an unsupported file gets a plain explanation and the page stays put');
    // lyrics
    await dp.evaluate(() => { window.__fire('drop', [new File(['[Verse 1]\nLate night, city lights\n\n[Chorus]\nI just wanna be right here'], 'my words.txt', { type: 'text/plain' })]); }); await wait(500);
    ok(await dp.evaluate(() => { const ta = document.querySelector('.lyi-ta'); return !!ta && /Late night, city lights/.test(ta.value); }), 'a dropped .txt opens the lyrics import with its text');
    await dp.keyboard.press('Escape'); await wait(200);
    // audio → chooser
    await dp.evaluate(async () => { const f = new File([window.__wav(2.5, 220)], 'Morning Sketch.wav', { type: 'audio/wav' }); window.__fire('drop', [f]); }); await wait(500);
    const ch = await dp.evaluate(() => { const d = document.getElementById('dropDlg'); return d ? { t: d.querySelector('.dlg-h').textContent, k: [...d.querySelectorAll('.drop-opt')].map(b => b.dataset.k + (b.disabled ? '!' : '') + (b.classList.contains('on') ? '*' : '')).join() } : null; });
    ok(ch && /Morning Sketch/.test(ch.t) && ch.k === 'track*,vox,gtr,hum', 'a dropped recording asks what it is (' + (ch && ch.k) + ')');
    await dp.click('#dropDlg .drop-opt[data-k="vox"]'); await wait(1500);
    const tk = await dp.evaluate(() => { const D = window.__daily; return { n: D.TAKES.length, k: D.TAKES[0] && D.TAKES[0].kind, nm: D.TAKES[0] && D.TAKES[0].name, dur: D.TAKES[0] && D.TAKES[0].dur, bars: D.songSlots() * D.slotDur(), pk: D.TAKES[0] && D.TAKES[0].peak, last: D.CFG.dropKind, row: document.getElementById('tlDrop').hidden, heads: document.querySelector('.tl-heads').textContent }; });
    ok(tk.n === 1 && tk.k === 'vox' && /Morning Sketch/.test(tk.nm) && Math.abs(tk.dur - 2.5) < .1, 'choosing Vocal take adds a vocal take with the file’s name and length (' + JSON.stringify([tk.n, tk.k, tk.nm, tk.dur]) + ')');
    ok(tk.bars >= tk.dur && /Morning Sketch/.test(tk.heads) && tk.row && tk.last === 'vox', 'bars grow to hold it, the lane appears, the drop row hides and the choice is remembered');
    // multi-file: only take options
    await dp.evaluate(async () => { window.__fire('drop', [new File([window.__wav(1, 330)], 'one.wav', { type: 'audio/wav' }), new File([window.__wav(1, 440)], 'two.wav', { type: 'audio/wav' })]); }); await wait(400);
    ok(await dp.evaluate(() => [...document.querySelectorAll('#dropDlg .drop-opt')].map(b => b.dataset.k + (b.disabled ? '!' : '') + (b.classList.contains('on') ? '*' : '')).join()) === 'track!,vox*,gtr,hum!', 'several recordings: backing track and hum are off, the last take type is highlighted');
    await dp.click('#dropDlg .drop-opt[data-k="gtr"]'); await wait(1500);
    ok(await dp.evaluate(() => { const D = window.__daily; return D.TAKES.length === 3 && D.TAKES.filter(t => t.kind === 'gtr').length === 2; }), 'both files become Guitar takes');
    // silent file and corrupt file
    const sil = await dp.evaluate(async () => { const t = await window.__daily.dropTake(new File([new ArrayBuffer(100)], 'broken.wav'), 'vox'); return { t, toast: [...document.querySelectorAll('.toast')].map(x => x.textContent).join('|') }; });
    ok(sil.t === null && /Could not read “broken.wav”/.test(sil.toast), 'an unreadable audio file gives a clear message and adds nothing');
    // rig json
    const rg = await dp.evaluate(async () => { const D = window.__daily; const j = JSON.stringify({ rig: D.rigSnapshot() }); window.__fire('drop', [new File([j], 'my-rig.json', { type: 'application/json' })]); await new Promise(r => setTimeout(r, 400)); return [...document.querySelectorAll('.toast')].map(x => x.textContent).join('|'); });
    ok(/Rig loaded from “my-rig.json”/.test(rg), 'a dropped rig .json loads into the rig');
    // a modal window blocks the drop
    await dp.evaluate(() => { const d = document.createElement('dialog'); d.id = 'tstDlg'; d.textContent = 'x'; document.body.append(d); d.showModal(); });
    const blk = await dp.evaluate(async () => { const ov0 = window.__fire('dragover', [new File(['x'], 'a.wav')]); const on = document.getElementById('dropOv').classList.contains('on'); const pv = window.__fire('drop', [new File([window.__wav(1)], 'late.wav', { type: 'audio/wav' })]); await new Promise(r => setTimeout(r, 300)); return { ov0, on, pv, dlg: !!document.getElementById('dropDlg'), toast: [...document.querySelectorAll('.toast')].map(x => x.textContent).join('|') }; });
    ok(blk.ov0 && !blk.on && blk.pv && !blk.dlg && /Close this window first/.test(blk.toast), 'with a window open the drop is declined politely (and never navigates away)');
    await dp.evaluate(() => { const d = document.getElementById('tstDlg'); d.close(); d.remove(); });
    // song file via Choose a file… path: a .zip is routed to the importer (bad zip → clear error, not a crash)
    const zp = await dp.evaluate(async () => { await window.__daily.dropFiles([new File(['not a zip'], 'x.zip')]); return [...document.querySelectorAll('.toast')].map(x => x.textContent).join('|'); });
    ok(/Import failed/.test(zp), 'a broken .zip reports “Import failed” instead of crashing');
    ok(await dp.evaluate(() => window.__gum) === 0, 'dropping files never asks for the microphone or camera');
    ok(de.length === 0, 'no page errors during drop tests' + (de.length ? ': ' + de.join(' | ') : ''));
  }
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
