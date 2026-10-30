/* Goal workspaces: the six goals (Songwriter, Performer, Creator Studio, Practice, Teacher, Full Rig), each a whole workspace with its own tools,
   the Create → Perform → Share path, the first-visit default, and the kit behind the buttons (Studio Replay, thumbnail, lesson notes, annotate).
   Own browser contexts; see test/lib.cjs. SHOTS=dir saves a screenshot of each workspace. */
const { suite } = require('./lib.cjs');
suite('e2e-goals', async t => {
  const { ok, wait, poll } = t, firstVisit = () => { if (!sessionStorage.getItem('seen')) { localStorage.removeItem('fw.started'); sessionStorage.setItem('seen', '1'); } }, p = await t.open({ w: 1440, h: 900, debug: true, init: firstVisit }), ev = (f, a) => p.evaluate(f, a);

  // a first visit on a computer opens the Performer
  ok(await ev(() => { const d = window.__daily; return d.CFG.ws === 'performer' && d.LAY.name === 'Performer' && d.DOCK.cur === 'vis'; }), 'a first visit opens the Performer workspace, on the stage');
  const bar = await ev(() => ({ goals: [...document.querySelectorAll('#goalbar .gl-b')].map(b => b.textContent.trim()), steps: [...document.querySelectorAll('#goalbar .gl-st')].map(b => b.textContent), on: (document.querySelector('#goalbar .gl-st.on') || {}).textContent, over: document.getElementById('goalbar').scrollWidth - document.getElementById('goalbar').clientWidth }));
  ok(bar.goals.join('|') === '🎸Songwriter|🎤Performer|🎬Creator Studio|🎼Practice|🎓Teacher|⚙️Full Rig', 'the goal bar offers the six goals (' + bar.goals.join(', ') + ')');
  ok(bar.steps.join('>') === 'Create>Perform>Share' && bar.on === 'Perform' && bar.over <= 1, 'Create → Perform → Share, with Perform lit, and the bar fits (' + JSON.stringify(bar) + ')');
  ok(await ev(() => !!document.getElementById('gtVideo') && /Share it/.test(document.getElementById('gtNext').textContent)), 'the Performer has one-click video recording and a “Share it →” next step');

  // each goal is its own workspace, with its own tools; nothing is lost
  const fp = await ev(async () => {
    const d = window.__daily, out = {};
    for (const g of d.GOALS) {
      document.querySelector('#goalbar .gl-b[data-goal="' + g.id + '"]').click(); await new Promise(r => setTimeout(r, 350));
      out[g.id] = { name: d.LAY.name, now: (d.goalNow() || {}).id, dock: d.DOCK.cur, tabs: [...document.querySelectorAll('#dock .tabs .tab')].map(b => b.dataset.id).join(','), tools: [...document.querySelectorAll('#goalbar .gl-tool')].map(b => b.id).join(','), lvis: getComputedStyle(document.getElementById('left')).visibility, rvis: getComputedStyle(document.getElementById('right')).visibility, lcur: d.SD.cur.left, rcur: d.SD.cur.right, mon: ['tuner', 'levels', 'live', 'spectrum', 'views', 'audience'].filter(w => !d.LAY.rc.hide[w]).join('+'), pressed: (document.querySelector('#goalbar .gl-b.on') || {}).dataset.goal, barTop: Math.round(document.getElementById('goalbar').getBoundingClientRect().top), tlTop: Math.round(document.getElementById('timeline').getBoundingClientRect().top), dockTop: Math.round(document.getElementById('dock').getBoundingClientRect().top), goalVar: getComputedStyle(document.documentElement).getPropertyValue('--goal').trim(), hidden: d.LAY.hidden.length, cfg: d.CFG.ws };
    }
    return out;
  });
  const ids = Object.keys(fp);
  ok(ids.length === 6 && ids.every(i => fp[i].now === i && fp[i].pressed === i && fp[i].cfg === i), 'each goal opens its own workspace, lights its button and is remembered');
  ok(new Set(ids.map(i => [fp[i].dock, fp[i].tabs, fp[i].lvis, fp[i].rvis, fp[i].lcur, fp[i].rcur, fp[i].mon].join('/'))).size === 6, 'no two goals are the same workspace');
  ok(fp.songwriter.dock === 'tab' && fp.songwriter.lcur === 'theory' && fp.songwriter.rvis === 'hidden' && /gtCap/.test(fp.songwriter.tools) && /gtTheory/.test(fp.songwriter.tools), 'Songwriter: a notebook — the Write canvas, theory beside it, no meters, Capture an idea (' + fp.songwriter.tools + ')');
  ok(fp.performer.dock === 'vis' && fp.performer.lcur === 'tones' && fp.performer.mon === 'tuner+levels' && /gtCam/.test(fp.performer.tools) && /gtTake/.test(fp.performer.tools), 'Performer: the stage, tones, tuner and levels, the camera and a take');
  ok(fp.creator.dock === 'vis' && fp.creator.lvis === 'hidden' && /views/.test(fp.creator.mon) && /audience/.test(fp.creator.mon) && ['gtVideo', 'gtReplay', 'gtFx', 'gtThumb', 'gtExp'].every(x => fp.creator.tools.includes(x)), 'Creator Studio: record MP4, Studio Replay, overlays, a thumbnail, export, the audience view and the waveform views (' + fp.creator.tools + ')');
  ok(fp.practice.dock === 'fret' && fp.practice.lcur === 'theory' && ['gtLoop', 'gtClick', 'gtSlow', 'gtFast', 'gtScale', 'gtChord'].every(x => fp.practice.tools.includes(x)), 'Practice: the fretboard large in the middle; loop, metronome, tempo, scales and chords');
  ok(fp.teacher.rcur === 'fret' && fp.teacher.lvis === 'hidden' && fp.teacher.tlTop < fp.teacher.dockTop && ['gtInk', 'gtNotes', 'gtScreen'].every(x => fp.teacher.tools.includes(x)), 'Teacher: annotate, lesson notes and screen recording');
  ok(fp.fullrig.hidden === 0 && !['rig', 'tab', 'band', 'vis', 'stage', 'neural', 'stems', 'tx', 'cam', 'lab', 'exp'].some(x => !fp.fullrig.tabs.split(',').includes(x)) && fp.fullrig.mon.split('+').length === 6 && fp.fullrig.lvis === 'visible' && fp.fullrig.rvis === 'visible', 'Full Rig: every panel on the strip (Song and Fretboard live inside Write), both sidebars, every Monitor widget ' + JSON.stringify(fp.fullrig));
  ok(ids.every(i => fp[i].barTop < 140), 'the goal bar stays at the top of the centre in every goal, the Teacher’s arrangement-on-top included (' + ids.map(i => fp[i].barTop).join(', ') + ')');
  ok(new Set(ids.map(i => fp[i].goalVar)).size === 6, 'each goal has its own colour (' + ids.map(i => fp[i].goalVar).join(' ') + ')');
  ok(new Set(ids.map(i => fp[i].dock + (fp[i].tlTop < fp[i].dockTop ? '↑' : '↓') + fp[i].lvis[0] + fp[i].rvis[0])).size >= 5, 'the goals differ in shape, not only in tabs: centre panel, arrangement above or below, which sidebars (' + ids.map(i => fp[i].dock + (fp[i].tlTop < fp[i].dockTop ? '↑' : '↓') + fp[i].lvis[0] + fp[i].rvis[0]).join(' ') + ')');
  ok(fp.performer.tabs.split(',').length < fp.fullrig.tabs.split(',').length && !/\btab\b/.test(fp.performer.tabs), 'a goal hides what it does not need from the strip (' + fp.performer.tabs + ')');
  ok(await ev(() => { const d = window.__daily; d.goalGo('performer'); return [...document.querySelectorAll('#dock .tab-more, #dock .dmore, #dock button')].some(b => /☰/.test(b.textContent)); }), 'the hidden panels stay one click away under ☰');

  // next steps: Create → Perform → Share
  const path = await ev(async () => { const d = window.__daily, s = []; d.goalGo('songwriter'); for (let i = 0; i < 2; i++) { document.getElementById('gtNext').click(); await new Promise(r => setTimeout(r, 250)); s.push(d.goalNow().id); } document.querySelector('.gl-st[data-step="create"]').click(); await new Promise(r => setTimeout(r, 200)); s.push(d.goalNow().id); return s.join('>'); });
  ok(path === 'performer>creator>songwriter', 'Songwriter → Perform it → Share it, and the Create step goes back to writing (' + path + ')');

  // practice: tempo and loop from the bar
  const pr = await ev(async () => { const d = window.__daily; d.goalGo('practice'); const b0 = d.S.bpm, loop0 = d.T.loop; document.getElementById('gtFast').click(); document.getElementById('gtLoop').click(); await new Promise(r => setTimeout(r, 150)); const r = { up: d.S.bpm - b0, label: document.getElementById('gtBpm').textContent, loop: d.T.loop !== loop0, pressed: document.getElementById('gtLoop').getAttribute('aria-pressed') === String(d.T.loop) }; document.getElementById('gtSlow').click(); document.getElementById('gtLoop').click(); return r; });
  ok(pr.up === 5 && /\d+ BPM/.test(pr.label) && pr.loop && pr.pressed, 'Practice: +5 BPM and the loop work from the goal bar, and show it (' + JSON.stringify(pr) + ')');

  // the kit: lesson notes are kept, ink is drawn and cleared, Studio Replay and the thumbnail
  await ev(() => window.__daily.goalGo('teacher'));
  ok(await ev(() => !!document.getElementById('kitNotes') && document.getElementById('gtNotes').getAttribute('aria-pressed') === 'true'), 'the Teacher opens with the lesson notes out');
  await p.fill('#kitNotesText', 'Bars 3–4: keep the strum loose.');
  ok(await ev(() => JSON.stringify(JSON.parse(localStorage.getItem('fw.lessons')))).then(s => /keep the strum loose/.test(s)), 'lesson notes are kept in this browser, per song');
  await ev(() => document.getElementById('gtNotes').click());
  ok(await ev(() => !document.getElementById('kitNotes')), 'and the card closes from the same button');
  await ev(() => document.getElementById('gtInk').click());
  await p.mouse.move(400, 400); await p.mouse.down(); await p.mouse.move(520, 460, { steps: 6 }); await p.mouse.up();
  const ink = await ev(() => ({ n: window.__daily.KIT.strokes.length, draw: document.getElementById('kitInk').classList.contains('drawing'), on: document.getElementById('gtInk').getAttribute('aria-pressed') }));
  ok(ink.n === 1 && ink.draw && ink.on === 'true', 'Annotate draws over the page (' + JSON.stringify(ink) + ')');
  await ev(() => document.getElementById('kitInkDone').click());
  ok(await ev(() => { const c = document.getElementById('kitInk'); return !!c && !c.classList.contains('drawing') && getComputedStyle(c).pointerEvents === 'none'; }), 'Done keeps the ink and gives the page its clicks back');
  await ev(() => { document.getElementById('gtInk').click(); document.getElementById('kitClear').click(); document.getElementById('kitInkDone').click(); });
  ok(await ev(() => !document.getElementById('kitInk') && window.__daily.KIT.strokes.length === 0), 'Clear and Done remove the ink');

  await ev(() => window.__daily.goalGo('creator'));
  ok(await ev(() => document.getElementById('gtReplay').disabled), 'Studio Replay waits for a recording');
  const pref = await ev(() => { const d = window.__daily; return { mp4: d.srecMime(false, true), dflt: d.srecMime(false) }; });
  ok(!/mp4/.test(pref.dflt) || /mp4/.test(pref.mp4), 'the Creator asks for MP4 first, where the browser has it (' + JSON.stringify(pref) + ')');
  await ev(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 36; const s = c.captureStream(10), g = c.getContext('2d'); const mr = new MediaRecorder(s); const ch = []; mr.ondataavailable = e => ch.push(e.data); mr.onstop = () => window.__daily.kitKeep(new Blob([new Uint8Array(2000), ...ch], { type: 'video/webm' }), 'stage'); let i = 0; const iv = setInterval(() => { g.fillStyle = i++ % 2 ? '#f00' : '#00f'; g.fillRect(0, 0, 64, 36); }, 50); mr.start(); setTimeout(() => { clearInterval(iv); mr.stop(); }, 600); });
  ok(await poll(() => ev(() => !document.getElementById('gtReplay').disabled), 4000), 'a recording makes Studio Replay available');
  await ev(() => document.getElementById('gtReplay').click()); await wait(400);
  const rp = await ev(() => { const d = document.getElementById('kitReplayDlg'); return d && { open: d.open, video: !!d.querySelector('video[src^="blob:"]'), save: !!d.querySelector('#kitSave'), thumb: !!d.querySelector('#kitThumbFrame'), again: !!d.querySelector('#kitAgain') }; });
  ok(rp && rp.open && rp.video && rp.save && rp.thumb && rp.again, 'Studio Replay plays it back with Save, Thumbnail from this frame and Record again (' + JSON.stringify(rp) + ')');
  if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/replay.png' });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), ev(() => document.getElementById('kitSave').click())]);
  ok(dl && /_stage\.(webm|mp4)$/.test(dl.suggestedFilename()), 'Save puts the video on this device (' + (dl && dl.suggestedFilename()) + ')');
  await ev(() => document.getElementById('kitReplayDlg').close());
  const [th] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), ev(() => document.getElementById('gtThumb').click())]);
  ok(th && /_thumbnail\.png$/.test(th.suggestedFilename()), 'Thumbnail saves a PNG of the stage (' + (th && th.suggestedFilename()) + ')');

  // screenshots of each workspace, when asked
  if (process.env.SHOTS) for (const g of ['songwriter', 'performer', 'creator', 'practice', 'teacher', 'fullrig']) { await ev(g => window.__daily.goalGo(g), g); await wait(500); await p.screenshot({ path: process.env.SHOTS + '/' + g + '.png' }); }

  // the four buttons at the top right open the same kind of dialog
  const hubs = {};
  for (const [sel, id] of [['#wsBtn', 'workspace'], ['button[title^="Appearance"]', 'look'], ['.btn.icon[title="Settings"]', 'settings'], ['.btn.icon[title^="Help"]', 'help']]) {
    await p.click(sel); await wait(350);
    hubs[id] = await ev(id => { const d = document.getElementById(id), r = d.getBoundingClientRect(); return { open: d.open && d.tagName === 'DIALOG' && d.classList.contains('hub'), head: !!d.querySelector('.hub-h h2'), close: !!d.querySelector('.hub-x'), nav: d.querySelectorAll('.hub-nb').length, secs: d.querySelectorAll('.hub-sec').length, w: Math.round(r.width), h: Math.round(r.height), over: d.querySelector('.hub-body').scrollWidth - d.querySelector('.hub-body').clientWidth }; }, id);
    await p.keyboard.press('Escape'); await wait(250);
  }
  const hv = Object.values(hubs);
  ok(hv.every(x => x.open && x.head && x.close && x.nav >= 4 && x.nav === x.secs && x.over <= 1) && new Set(hv.map(x => x.w + 'x' + x.h)).size === 1, '▦ Workspace, ◐ Appearance, ⚙ Settings and ? Help are one kind of modal: same size, a header with ✕, a section list and cards (' + JSON.stringify(hubs) + ')');
  await p.click('.btn.icon[title^="Help"]'); await wait(300); await p.click('#help .hub-nb[data-sec="about"]'); await wait(800);
  ok(await ev(() => { const d = document.getElementById('help'), a = d.querySelector('.hub-sec[data-sec="about"]').getBoundingClientRect(), b = d.querySelector('.hub-body').getBoundingClientRect(); return a.top < b.bottom - 40 && d.querySelector('.hub-nb.on').dataset.sec === 'about'; }), 'a section in the list scrolls into view and lights up');
  await p.keyboard.press('Escape'); await wait(200);
  await p.click('#wsBtn'); await wait(300);
  ok(await ev(() => document.querySelectorAll('#workspace .ws-card').length === 6 && document.querySelectorAll('#workspace .ws-card .ws-th').length === 6), 'Workspace shows the six goals as cards, each with a picture of its shape');
  await p.click('#workspace .ws-card[data-goal="practice"]'); await wait(400);
  ok(await ev(() => !document.getElementById('workspace').open && window.__daily.goalNow().id === 'practice'), 'choosing a card switches the goal and closes the dialog');
  // Appearance: light or dark first, then only that mode's palettes and looks
  await ev(() => window.__daily.setTheme('light')); await p.click('button[title^="Appearance"]'); await wait(300);
  const lk = async () => ev(() => { const d = document.getElementById('look'); return { dd: d.querySelectorAll('.lk-dd').length, mode: [...d.querySelectorAll('.lk-dd')].map(x => x.dataset.mode).join(), pals: d.querySelectorAll('.lk-pal').length, looks: [...d.querySelectorAll('.lk-look .lk-n')].map(x => x.textContent).join('|'), open: !!d.querySelector('.lk-dd[open]') }; });
  const L1 = await lk();
  ok(L1.dd === 1 && L1.mode === 'light' && L1.pals === 8 && !L1.open && !/Midnight|Studio night|Stage/.test(L1.looks), 'in Light, one closed dropdown holds the 8 light palettes, and only light looks are offered (' + JSON.stringify(L1) + ')');
  await p.click('#look .lk-mode button[data-t="dark"]'); await wait(300);
  const L2 = await lk();
  ok(L2.mode === 'dark' && L2.pals === 9 && /Midnight/.test(L2.looks) && !/Notebook/.test(L2.looks) && await ev(() => document.documentElement.dataset.theme === 'dark'), 'Dark switches the app and offers the 9 dark palettes and the dark looks (' + JSON.stringify(L2) + ')');
  await p.click('#look .lk-dds'); await p.click('#look .lk-pal[title="Plum"]'); await wait(300);
  ok(await ev(() => document.documentElement.dataset.palette === 'plum' && !!document.querySelector('#look .lk-dd[open]')), 'opening the dropdown and picking a palette applies it at once');
  await p.click('#look .lk-mode button[data-t="auto"]'); await wait(300);
  const L3 = await lk();
  ok(L3.dd === 2 && L3.mode === 'light,dark', 'System offers a daytime and a night palette (' + L3.mode + ')');
  await ev(() => { window.__daily.lookReset(); document.getElementById('look').close(); }); await wait(200);

  // a narrow laptop: the bar still fits (inactive goals fold to their icon)
  const n = await t.open({ w: 1280, h: 800, debug: true, init: firstVisit });
  const nf = await n.evaluate(() => { const b = document.getElementById('goalbar'), r = b.getBoundingClientRect(); return { over: b.scrollWidth - b.clientWidth, h: Math.round(r.height), right: [...b.querySelectorAll('button')].every(x => x.getBoundingClientRect().right <= r.right + 1) }; });
  ok(nf.over <= 1 && nf.right && nf.h < 90, 'at 1280 px the goal bar fits in two short rows (' + JSON.stringify(nf) + ')');
  if (process.env.SHOTS) await n.screenshot({ path: process.env.SHOTS + '/narrow.png' });

  // someone who has been here before keeps the workspace they had; a layout chosen before is kept; a phone has no goal bar
  const r = await t.open({ w: 1440, h: 900, debug: true });
  ok(await r.evaluate(() => window.__daily.CFG.ws === null && window.__daily.LAY.name !== 'Performer'), 'a returning visitor keeps the workspace they had');
  const k = await t.open({ w: 1440, h: 900, debug: true, init: () => { try { localStorage.removeItem('fw.started'); if (!localStorage.getItem('fw.cfg')) localStorage.setItem('fw.cfg', JSON.stringify({ layout: { name: 'Arrange', flip: false, left: false, right: true } })); } catch (e) { } } });
  ok(await k.evaluate(() => window.__daily.LAY.name === 'Arrange' && window.__daily.CFG.ws === null), 'a layout chosen before is kept, not replaced by a goal');
  const m = await t.open({ w: 390, h: 844, mobile: true, debug: true });
  ok(await m.evaluate(() => { const b = document.getElementById('goalbar'); return !b || getComputedStyle(b).display === 'none'; }), 'a phone keeps its own navigation: no goal bar');
});
