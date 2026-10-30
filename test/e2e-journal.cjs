/* 2.12: the progress journal and Welcome Back, and the white / dark-green hexagon choice.
   Headless browser with synthetic history and simulated chord input, so this proves the counting, the wording and the screens work as designed;
   it cannot say whether the numbers feel right to a person over months of real use, and chord detection from a real guitar is not tested here. */
const { suite } = require('./lib.cjs');
const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/** a journal for someone who last played 90 days ago: 87 sessions, 14 chords, 23 ideas, 4 finished songs, G→C getting better, a best streak of 5 */
function history() {
  const days = {}; let s = 0;
  for (let i = 90; i <= 94; i++) { days[day(i)] = { t: 1500, s: 1, i: 0 }; s++; }
  for (let i = 0; s < 87; i++) { days[day(96 + i * 2)] = { t: 1200, s: 1, i: 0 }; s++; }
  const k = Object.keys(days).sort(); for (let n = 0; n < 23; n++) days[k[n % k.length]].i += 1;
  const chords = ['C', 'G', 'Am', 'F', 'Em', 'Dm', 'D', 'A', 'E', 'Bm', 'G7', 'Cmaj7', 'Am7', 'Dsus4'], learned = {}, heard = {}; chords.forEach((c, i) => { learned[c] = day(100 + i * 9); heard[c] = 9; });
  const songs = {}; [95, 130, 170, 210].forEach((n, i) => { songs['s' + i] = { title: 'Song ' + i, at: Date.now() - n * 864e5, day: day(n) }; });
  const J = { v: 1, since: Date.now() - 300 * 864e5, days, old: { t: 0, s: 0, i: 0 }, heard, learned, songs, focus: '90s Alternative Guitar',
    pairs: { 'G>C': { n: 30, h: '110111111110111111101111111111', f: '0100100010', at: Date.now() - 91 * 864e5 } }, last: { song: { title: 'Maybe Today Demo', artist: '', at: Date.now() - 90 * 864e5 }, rec: { name: 'Maybe Today Demo: Take 3', kind: 'take', at: Date.now() - 91 * 864e5, song: 'Maybe Today Demo' } } };
  // the figures the card should print, by the same rule: this year if there is anything this year, otherwise all time
  const y = new Date().getFullYear() + '-01-01', sum = f => ({ s: Object.keys(days).filter(x => x >= f).reduce((a, x) => a + days[x].s, 0), i: Object.keys(days).filter(x => x >= f).reduce((a, x) => a + days[x].i, 0), c: chords.filter(c => learned[c] >= f).length, d: Object.keys(songs).filter(x => songs[x].day >= f).length });
  let u = sum(y), label = String(new Date().getFullYear()); if (!(u.s || u.i || u.c || u.d)) { u = sum(''); label = 'All time'; }
  return { J, label, u };
}
const seed = J => `try{localStorage.setItem('fw.jn',${JSON.stringify(JSON.stringify(J))});}catch(e){}`;

suite('e2e-journal', async t => {
  const { ok, wait, poll } = t;
  const H = history();

  // ================= Welcome Back, ninety days later =================
  let p = await t.open({ w: 1280, h: 900, debug: true, boot: false, init: seed(H.J) }); const ev = (f, a) => p.evaluate(f, a);
  await p.goto(t.BASE + (t.BASE.includes('?') ? '&' : '?') + 'debug'); await wait(3200);
  const wb = await ev(() => { const e = document.getElementById('welcomeBack'); return e ? { text: e.innerText, rows: [...e.querySelectorAll('dt')].map(x => x.textContent + '=' + x.nextElementSibling.textContent.replace(/\s*✎$/, '')), sum: (document.getElementById('wbSummary') || {}).textContent, btn: document.getElementById('bootNoMic').innerText } : null; });
  ok(!!wb, 'someone who has been here before sees a Welcome Back card on the first page');
  ok(wb && /Welcome back\. It has been 3 months\./.test(wb.text), 'after about ninety days it says how long it has been, kindly');
  ok(wb && wb.rows.some(r => /^Last practiced=3 months ago/.test(r)), 'Last practiced is in plain words (' + (wb && wb.rows[0]) + ')');
  ok(wb && wb.rows.some(r => /^Current streak=Starts again the next time you play · best so far 5 days$/.test(r)), 'after a long gap the streak is gentle: it starts again, and shows the best so far');
  ok(wb && wb.rows.some(r => r === 'Working on=90s Alternative Guitar'), 'Working on shows what the person said they are working on');
  ok(wb && wb.rows.some(r => /^Latest recording=Maybe Today Demo: Take 3 · 3 months ago$/.test(r)), 'Latest recording names the take and says when');
  ok(wb && wb.rows.some(r => r === 'Progress=G → C changes now 90% on time, up from 30%'), 'Progress shows a chord change getting better, only because there are enough tries (' + (wb && wb.rows.find(r => /^Progress/.test(r))) + ')');
  const want = H.label + ': Played ' + H.u.s + ' sessions · Learned ' + H.u.c + ' chords · Recorded ' + H.u.i + ' ideas · Completed ' + H.u.d + ' songs';
  ok(wb && wb.sum === want, 'the summary line reads “' + want + '” (' + (wb && wb.sum) + ')');
  ok(wb && /Pick up where I left off/.test(wb.btn) && /Maybe Today Demo/.test(wb.btn), 'the main button says Pick up where I left off and names the song');
  ok(await ev(() => !document.getElementById('bootGoals') && !document.getElementById('bootDemo')), 'the first-time choices are still out of the way for a returning person');
  // changing what you are working on
  await ev(() => document.querySelector('#welcomeBack .wb-edit').click()); await p.fill('#welcomeBack .wb-in', 'Fingerstyle blues'); await p.keyboard.press('Enter');
  ok(await ev(() => /Fingerstyle blues/.test(document.getElementById('welcomeBack').innerText) && window.__daily.jnLoad().focus === 'Fingerstyle blues'), 'the pencil changes Working on, and it is kept');
  // the button opens the studio
  await ev(() => document.getElementById('bootNoMic').click()); ok(await poll(() => ev(() => !document.getElementById('boot')), 6000), 'the button opens the studio');
  // My progress, from the Songs menu
  await ev(() => document.querySelector('.sb-songs').click()); await wait(300);
  ok(await ev(() => !!document.getElementById('smProgress') && !!document.getElementById('smFinish')), 'the Songs menu has My progress and Mark this song finished');
  await ev(() => document.getElementById('smProgress').click()); await wait(400);
  const pg = await ev(() => ({ nums: [...document.querySelectorAll('#jnNums .jn-n')].map(x => x.innerText.replace(/\s+/g, ' ')), cells: document.querySelectorAll('#jnGrid .jn-c:not(.fut)').length, lit: document.querySelectorAll('#jnGrid .jn-c.l1,#jnGrid .jn-c.l2,#jnGrid .jn-c.l3').length, pairs: (document.getElementById('jnPairs') || {}).innerText, chips: document.querySelectorAll('#jnChords .jn-chip').length, aria: document.getElementById('jnGrid').getAttribute('aria-label') }));
  ok(pg.nums.length === 4 && /sessions? played/.test(pg.nums[0]) && /chords? learned/.test(pg.nums[1]) && /ideas? recorded/.test(pg.nums[2]) && /songs? completed/.test(pg.nums[3]), 'My progress shows four plain counts');
  ok(pg.cells >= 78 && pg.cells <= 84 && pg.lit === 0, 'the twelve-week strip has a square a day, and none is lit for a person who has been away three months (' + pg.cells + ' squares, ' + pg.lit + ' lit)');
  ok(/G → C/.test(pg.pairs || '') && /90% on time/.test(pg.pairs || ''), 'chord changes are listed with how often they landed on time (' + (pg.pairs || '').replace(/\n/g, ' ') + ')');
  ok(pg.chips === 14, 'the fourteen chords learned are listed');
  await p.click('#jnFinish'); await wait(200);
  const nfin = await ev(() => Object.keys(window.__daily.jnLoad().songs).length); ok(nfin === 5, 'Mark this song finished adds a completed song (' + nfin + ')');
  await p.click('#jnFinish'); ok(await ev(() => Object.keys(window.__daily.jnLoad().songs).length) === 4, 'and pressing it again takes it back');
  await p.click('#jnErase'); ok(await ev(() => Object.keys(window.__daily.jnLoad().days).length > 0), 'Erase asks for a second press');
  await p.click('#jnErase'); ok(await ev(() => Object.keys(window.__daily.jnLoad().days).length === 0 ), 'a second press erases the journal (songs and recordings are not touched)');
  await ev(() => { const d = document.getElementById('progress'); if (d) d.close(); });
  ok(t.errs.length === 0, 'no errors on the way (' + t.errs.length + ')'); await p.ctx.close();

  // ================= first time, and returning with no journal yet =================
  const f = await t.open({ w: 1280, h: 900, debug: true, boot: false, init: `try{localStorage.removeItem('fw.started');}catch(e){}` });
  await f.goto(t.BASE + (t.BASE.includes('?') ? '&' : '?') + 'debug'); await wait(3000);
  ok(await f.evaluate(() => !document.getElementById('welcomeBack') && !!document.getElementById('bootGoals')), 'a first-time visitor sees the goals, not Welcome Back'); await f.ctx.close();
  const n = await t.open({ w: 1280, h: 900, debug: true, boot: false });
  await n.goto(t.BASE + (t.BASE.includes('?') ? '&' : '?') + 'debug'); await wait(3000);
  const nj = await n.evaluate(() => ({ text: (document.getElementById('welcomeBack') || {}).innerText || '', btn: document.getElementById('bootNoMic').innerText }));
  ok(/Welcome back/.test(nj.text) && /journal starts now/i.test(nj.text) && !/Last practiced|Current streak/.test(nj.text), 'someone who upgrades with no journal yet is told it starts now, and nothing is invented');
  ok(/Begin in the studio/.test(nj.btn), 'and the button keeps its usual wording'); await n.ctx.close();

  // ================= counting =================
  p = await t.open({ w: 1440, h: 900, debug: true, init: `try{localStorage.removeItem('fw.jn');}catch(e){}` }); const ev2 = (f, a) => p.evaluate(f, a);
  await wait(4000);
  ok(await ev2(() => { const J = window.__daily.jnLoad(); return !Object.keys(J.days).length; }), 'a page that is only open, with nobody playing, counts nothing');
  // a chord is learned after it has been held steady five times
  await ev2(() => { const d = window.__daily; d.JN.d = null; localStorage.removeItem('fw.jn'); d.jnLoad(); let t = 1000; for (let r = 0; r < 5; r++) { for (let k = 0; k < 4; k++) { d.jnStep(t, { live: 'Am', playing: false, bpm: 100 }); t += 250; } d.jnStep(t, { live: null, playing: false }); t += 250; } });
  ok(await ev2(() => { const J = window.__daily.jnLoad(); return J.heard.Am === 5 && !!J.learned.Am; }), 'a chord held steady five times is learned');
  ok(await ev2(() => { const d = window.__daily; d.jnStep(9e4, { live: 'Em', playing: false }); d.jnStep(9250, { live: 'Em', playing: false }); d.jnStep(9500, { live: null, playing: false }); return !d.jnLoad().learned.Em && !d.jnLoad().heard.Em; }), 'a chord that only flickers is not counted');
  ok(await ev2(() => { const d = window.__daily; let t = 2e5; for (let k = 0; k < 4; k++) { d.jnStep(t, { live: 'C/G', playing: false }); t += 250; } return d.jnLoad().heard.C === 1; }), 'a slash chord counts as its chord');
  // a chord change counts only when you were holding the old chord, and lands if the new one is heard within two beats (at 120 bpm: 1.25 s)
  const ch = await ev2(() => {
    const d = window.__daily; d.JN.d = null; localStorage.removeItem('fw.jn'); d.jnLoad(); d.JN.win = null; d.JN.prev = null; d.JN.seen = {}; let t = 5e5; const out = {};
    const run = (live2, wait2) => { // song is on G, you play G, the song moves to C, you land C after wait2 ms (or never)
      for (let k = 0; k < 4; k++) { d.jnStep(t, { sym: 'G', live: 'G', playing: true, bpm: 120 }); t += 250; }
      d.jnStep(t, { sym: 'C', live: 'G', playing: true, bpm: 120 });
      const t0 = t; for (let ms = 250; ms <= 2000; ms += 250) { const lv = live2 && ms >= wait2 ? 'C' : 'G'; d.jnStep(t0 + ms, { sym: 'C', live: lv, playing: true, bpm: 120 }); }
      t = t0 + 2300; d.jnStep(t, { sym: 'G', live: null, playing: true, bpm: 120 }); t += 600;
    };
    run(true, 500); run(true, 750); run(true, 1000); run(true, 500); run(false); run(true, 1500);
    out.p = d.jnLoad().pairs['G>C']; out.after = d.jnBestPair();
    // the player was not playing at all when the chord changed: no attempt
    d.JN.seen = {}; d.JN.prev = null; d.JN.win = null; const n0 = d.jnLoad().pairs['G>C'].n;
    d.jnStep(t + 1e4, { sym: 'G', live: null, playing: true, bpm: 120 }); d.jnStep(t + 10250, { sym: 'C', live: null, playing: true, bpm: 120 }); d.jnStep(t + 11000, { sym: 'C', live: 'C', playing: true, bpm: 120 });
    out.same = d.jnLoad().pairs['G>C'].n === n0;
    // not playing the song (the transport is stopped): nothing is tracked
    d.jnStep(t + 2e4, { sym: 'G', live: 'G', playing: false }); d.jnStep(t + 2250, { sym: 'C', live: 'G', playing: false }); out.stop = d.jnLoad().pairs['G>C'].n === n0;
    return out;
  });
  ok(ch.p && ch.p.n === 6, 'six attempts were recorded for G → C (' + (ch.p && ch.p.n) + ')');
  ok(ch.p && ch.p.h === '111101', 'landing within two beats is a hit and later is a miss: 1,1,1,1,0,1 (' + (ch.p && ch.p.h) + ')');
  ok(ch.after && ch.after.from === 'G' && ch.after.to === 'C' && ch.after.now === 83, 'after six tries the change shows as 83% on time (' + (ch.after && ch.after.now) + ')');
  ok(ch.same === true, 'a change you did not play along with is not counted against you');
  ok(ch.stop === true, 'nothing is tracked while the song is not playing');
  ok(await ev2(() => !window.__daily.jnBestPair() || window.__daily.jnBestPair().first == null), 'it does not claim improvement before there are enough tries');

  // days, streaks and what counts as practice
  const st = await ev2(() => {
    const d = window.__daily, J = d.jnLoad(), k = n => { const x = new Date(); x.setDate(x.getDate() - n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    J.days = {}; [0, 1, 2, 4, 5, 6, 7].forEach(n => { J.days[k(n)] = { t: 600, s: 1, i: 0 }; }); J.days[k(3)] = { t: 30, s: 0, i: 0 };
    const a = d.jnStreak(); delete J.days[k(0)]; const b = d.jnStreak(); J.days = {}; J.days[k(2)] = { t: 600, s: 1, i: 0 }; const c = d.jnStreak();
    return { a, b, c };
  });
  ok(st.a.cur === 3 && st.a.best === 4, 'a streak counts days in a row, and a day with only half a minute is not practice (now ' + st.a.cur + ', best ' + st.a.best + ')');   // 0,1,2 now; 4,5,6,7 is the best run
  ok(st.b.cur === 2, 'if today has not happened yet, yesterday’s streak is still alive (' + st.b.cur + ')');
  ok(st.c.cur === 0 && st.c.best === 1, 'two days of silence ends the streak but keeps the best (' + st.c.cur + '/' + st.c.best + ')');

  // real signals: editing starts a session after a minute, a recording is an idea, and the song is remembered
  const sg = await ev2(async () => {
    const d = window.__daily; d.JN.d = null; localStorage.removeItem('fw.jn'); d.jnLoad(); d.JN.vis = 59.4; d.JN.edit = performance.now(); d.JN.counted = false; d.JN.lastAct = 0;
    await new Promise(r => setTimeout(r, 1800)); const J = d.jnLoad(), td = Object.values(J.days)[0] || {}; return { s: td.s || 0, t: td.t || 0, song: J.last.song && J.last.song.title };
  });
  ok(sg.s === 1 && sg.t > 0, 'a minute of activity makes one session (' + sg.s + ' session, ' + Math.round(sg.t) + ' s)');
  ok(sg.song === 'Untitled Idea' || !!sg.song, 'it remembers which song you were on (' + sg.song + ')');
  const idea = await ev2(() => {
    const d = window.__daily; d.TAKES.length = 0; const n = 48000, a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.sin(i / 20) * .3;
    d.REC = { dry: [a], wet: [], vox: [], g: true, v: false, t0: 0, startSec: 0, bpm: 120, preset: d.CFG.preset || null, n: 0, cam: [], pkG: [], pkV: [], punch: null, tEnd: 0, cycle: false }; d.recEnd();
    const J = d.jnLoad(), td = J.days[Object.keys(J.days)[0]]; return { i: td.i, rec: J.last.rec && J.last.rec.name, n: d.TAKES.length };
  });
  ok(idea.n === 1 && idea.i === 1 && /Take 1/.test(idea.rec || ''), 'recording a take counts as an idea and becomes the latest recording (“' + idea.rec + '”)');
  ok(await ev2(() => { const J = window.__daily.jnLoad(); return window.__daily.jnSum('').ideas === 1 && window.__daily.jnFinish() === true && Object.keys(J.songs).length === 1; }), 'finishing a song counts it once');

  // the journal lives in one local key, goes with a reset, and holds counts, not sound
  const kd = await ev2(() => { window.__daily.jnTick(); const raw = localStorage.getItem('fw.jn'); return { have: !!raw, size: raw ? raw.length : 0, audio: raw ? /Float32|\[object|"dry"|data:audio/.test(raw) : false }; });
  await wait(200); await ev2(() => window.dispatchEvent(new Event('pagehide')));
  const kd2 = await ev2(() => { const raw = localStorage.getItem('fw.jn'); return { have: !!raw, size: raw ? raw.length : 0, audio: raw ? /Float32|"dry"|data:audio/.test(raw) : false }; });
  ok(kd2.have && kd2.size < 5000 && !kd2.audio, 'the journal is saved on this device as a few hundred bytes of counts and dates (' + kd2.size + ' bytes), with no audio in it');
  ok(t.errs.length === 0, 'no errors in the counting (' + t.errs.length + ')'); await p.ctx.close();

  // ================= white or dark-green hexagons =================
  for (const [tone, theme, want] of [['auto', 'light', true], ['auto', 'dark', false], ['dark', 'light', false], ['light', 'dark', true]]) {
    const q = await t.open({ w: 1280, h: 800, debug: true, init: `try{localStorage.setItem('fw.cfg',JSON.stringify({lookMode:'${theme}',hexTone:'${tone}'}));}catch(e){}` });
    const r = await q.evaluate(() => { const d = window.__daily; return { light: d.hexLight(), theme: document.documentElement.dataset.theme }; });
    ok(r.light === want, 'Hexagons “' + tone + '” in the ' + theme + ' theme draw the ' + (want ? 'white' : 'dark-green') + ' field (' + r.light + ')'); await q.ctx.close();
  }
  const hx = await t.open({ w: 1440, h: 900, debug: true }); await hx.evaluate(() => { const d = window.__daily; d.vzSetMode('hex'); d.dockGo('vis'); }); await wait(900);
  const corner = pg => pg.evaluate(() => { const cv = document.querySelector('canvas.vcanvas'); const g = cv.getContext('2d'), w = cv.width, h = cv.height, a = g.getImageData(Math.floor(w * .02), Math.floor(h * .02), 6, 6).data; return [a[0], a[1], a[2]]; });
  const sw = await hx.evaluate(() => { const s = document.getElementById('hexTone'); return !!s && s.style.display !== 'none' ? [...s.querySelectorAll('.hx-sw')].map(b => b.dataset.k).join() : 'hidden'; });
  ok(sw === 'auto,green,white,ocean,ember,violet,mono,blush,sky,custom', 'the Visuals bar offers colour swatches for the hexagons while Hex Resonance is showing (' + sw + ')');
  await hx.click('#hexTone [data-k="white"]'); await wait(300);
  ok(await hx.evaluate(() => window.__daily.hexLight() === true && window.__daily.CFG.hexTone === 'white' && document.querySelector('#hexTone [data-k="white"]').getAttribute('aria-checked') === 'true'), 'choosing White is kept, and the swatch is marked');
  const px = await corner(hx);
  ok(px[0] > 200 && px[1] > 200 && px[2] > 200, 'and the field really is white (corner pixel ' + px.join(',') + ')');
  await hx.click('#hexTone [data-k="green"]'); await wait(300);
  const px2 = await corner(hx);
  ok(px2[0] < 40 && px2[1] < 60, 'Dark green turns it back (corner pixel ' + px2.join(',') + ')');
  for (const [k, test] of [['ocean', p => p[2] > p[0] + 8 && p[0] < 30], ['ember', p => p[0] > p[2] + 8 && p[0] < 60], ['violet', p => p[2] > p[1] + 8 && p[0] < 40], ['blush', p => p[0] > 220 && p[1] > 220], ['mono', p => p[0] < 30 && Math.abs(p[0] - p[2]) < 6]]) {
    await hx.click('#hexTone [data-k="' + k + '"]'); await wait(250); const q = await corner(hx);
    ok(test(q), k + ' paints its own background (corner pixel ' + q.join(',') + ')');
  }
  // your own three colours
  await hx.click('#hexTone [data-k="custom"]'); await wait(300);
  ok(await hx.evaluate(() => getComputedStyle(document.querySelector('#hexTone .hx-custom')).display !== 'none' && document.querySelectorAll('#hexTone .hx-custom input[type=color]').length === 3), 'Pick your own shows three colour pickers: background, cells and gold cells');
  await hx.evaluate(() => { const i = document.querySelector('#hexTone input[data-c="bg"]'); i.value = '#102a6b'; i.dispatchEvent(new Event('input', { bubbles: true })); const j = document.querySelector('#hexTone input[data-c="cell"]'); j.value = '#ff3366'; j.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(400);
  const pc = await corner(hx), saved = await hx.evaluate(() => { window.__daily.saveCfg && window.__daily.saveCfg(); return JSON.parse(localStorage.getItem('fw.cfg')); });
  ok(pc[2] > pc[0] + 20 && pc[2] > 70 && saved.hexTone === 'custom' && saved.hexCol && saved.hexCol.bg === '#102a6b' && saved.hexCol.cell === '#ff3366', 'your colours are used and remembered (corner pixel ' + pc.join(',') + ')');
  const cellSeen = await hx.evaluate(() => { const cv = document.querySelector('canvas.vcanvas'), g = cv.getContext('2d'), a = g.getImageData(0, 0, cv.width, cv.height).data; let red = 0; for (let k = 0; k < a.length; k += 16) if (a[k] > 50 && a[k] > a[k + 1] + 20) red++; return red; });
  ok(cellSeen > 5, 'the cells take your cell colour (' + cellSeen + ' reddish samples)');
  await hx.evaluate(() => { window.__daily.CFG.hexTone = 'light'; window.__daily.hexToneSync(); });
  ok(await hx.evaluate(() => window.__daily.hexPal().id === 'white' && document.querySelector('#hexTone [data-k="white"]').classList.contains('on')), 'an older saved “light” still means White');
  await hx.click('#hexTone [data-k="auto"]'); await wait(200);
  ok(await hx.evaluate(() => !('hexTone' in window.__daily.CFG)), 'Match the theme goes back to following light and dark');
  await hx.evaluate(() => window.__daily.vzSetMode('concert')); await wait(300);
  for (const [tone, test] of [['ember', p => p[0] > p[2] + 2 && p[0] < 60], ['white', p => p[0] > 200 && p[1] > 200]]) {
    const q = await t.open({ w: 1280, h: 800, debug: true, boot: false, init: `try{localStorage.setItem('fw.cfg',JSON.stringify({hexTone:'${tone}'}));localStorage.removeItem('fw.started');}catch(e){}` }); await q.goto(t.BASE + '?debug'); await wait(1800);
    const bp = await q.evaluate(() => { const cv = document.getElementById('bootHex'); if (!cv) return null; const a = cv.getContext('2d').getImageData(2, 2, 4, 4).data; return [a[0], a[1], a[2]]; });
    ok(bp && test(bp), 'the start screen paints the hexagon colours you chose (' + tone + ': ' + (bp ? bp.join(',') : 'no canvas') + ')'); await q.ctx.close();
  }
  ok(await hx.evaluate(() => getComputedStyle(document.getElementById('hexTone')).display === 'none'), 'the choice hides again on the other looks');
  ok(t.errs.length === 0, 'no errors in the hexagon choice (' + t.errs.length + ')');
});
