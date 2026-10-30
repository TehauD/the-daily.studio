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
      out[g.id] = { name: d.LAY.name, now: (d.goalNow() || {}).id, dock: d.DOCK.cur, tabs: [...document.querySelectorAll('#dock .tabs .tab')].map(b => b.dataset.id).join(','), tools: [...document.querySelectorAll('#goalbar .gl-tool')].map(b => b.id).join(','), lvis: getComputedStyle(document.getElementById('left')).visibility, rvis: getComputedStyle(document.getElementById('right')).visibility, lcur: d.SD.cur.left, rcur: d.SD.cur.right, mon: ['tuner', 'levels', 'live', 'spectrum', 'views', 'audience'].filter(w => !d.LAY.rc.hide[w]).join('+'), pressed: (document.querySelector('#goalbar .gl-b.on') || {}).dataset.goal, hidden: d.LAY.hidden.length, cfg: d.CFG.ws };
    }
    return out;
  });
  const ids = Object.keys(fp);
  ok(ids.length === 6 && ids.every(i => fp[i].now === i && fp[i].pressed === i && fp[i].cfg === i), 'each goal opens its own workspace, lights its button and is remembered');
  ok(new Set(ids.map(i => [fp[i].dock, fp[i].tabs, fp[i].lvis, fp[i].rvis, fp[i].lcur, fp[i].rcur, fp[i].mon].join('/'))).size === 6, 'no two goals are the same workspace');
  ok(fp.songwriter.dock === 'tab' && fp.songwriter.lcur === 'theory' && /gtCap/.test(fp.songwriter.tools) && /gtTheory/.test(fp.songwriter.tools), 'Songwriter: the Write canvas, chords and scales beside it, Capture an idea (' + fp.songwriter.tools + ')');
  ok(fp.performer.dock === 'vis' && fp.performer.lcur === 'tones' && /audience/.test(fp.performer.mon) && /gtCam/.test(fp.performer.tools) && /gtTake/.test(fp.performer.tools), 'Performer: the stage, tones, the camera, a take and the audience view');
  ok(fp.creator.dock === 'vis' && fp.creator.lvis === 'hidden' && /views/.test(fp.creator.mon) && ['gtVideo', 'gtReplay', 'gtFx', 'gtThumb', 'gtExp'].every(x => fp.creator.tools.includes(x)), 'Creator Studio: record MP4, Studio Replay, overlays, a thumbnail, export, and the waveform views (' + fp.creator.tools + ')');
  ok(fp.practice.rcur === 'fret' && fp.practice.lcur === 'theory' && ['gtLoop', 'gtClick', 'gtSlow', 'gtFast', 'gtScale', 'gtChord'].every(x => fp.practice.tools.includes(x)), 'Practice: loop, metronome, tempo, scales and the chord on the fretboard');
  ok(fp.teacher.rcur === 'fret' && fp.teacher.lvis === 'hidden' && ['gtInk', 'gtNotes', 'gtScreen'].every(x => fp.teacher.tools.includes(x)), 'Teacher: annotate, lesson notes and screen recording');
  ok(fp.fullrig.hidden === 0 && !['rig', 'tab', 'band', 'vis', 'stage', 'neural', 'stems', 'tx', 'cam', 'lab', 'exp'].some(x => !fp.fullrig.tabs.split(',').includes(x)) && fp.fullrig.mon.split('+').length === 6 && fp.fullrig.lvis === 'visible' && fp.fullrig.rvis === 'visible', 'Full Rig: every panel on the strip (Song and Fretboard live inside Write), both sidebars, every Monitor widget ' + JSON.stringify(fp.fullrig));
  ok(fp.performer.tabs.split(',').length < fp.fullrig.tabs.split(',').length && !/\btab\b/.test(fp.performer.tabs), 'a goal hides what it does not need from the strip (' + fp.performer.tabs + ')');
  ok(await ev(() => { const d = window.__daily; d.goalGo('performer'); return [...document.querySelectorAll('#dock .tab-more, #dock .dmore, #dock button')].some(b => /☰/.test(b.textContent)); }), 'the hidden panels stay one click away under ☰');

  // next steps: Create → Perform → Share
  const path = await ev(async () => { const d = window.__daily, s = []; d.goalGo('songwriter'); for (let i = 0; i < 2; i++) { document.getElementById('gtNext').click(); await new Promise(r => setTimeout(r, 250)); s.push(d.goalNow().id); } document.querySelector('.gl-st[data-step="create"]').click(); await new Promise(r => setTimeout(r, 200)); s.push(d.goalNow().id); return s.join('>'); });
  ok(path === 'performer>creator>songwriter', 'Songwriter → Perform it → Share it, and the Create step goes back to writing (' + path + ')');

  // practice: tempo and loop from the bar
  const pr = await ev(async () => { const d = window.__daily; d.goalGo('practice'); const b0 = d.S.bpm, loop0 = d.T.loop; document.getElementById('gtFast').click(); document.getElementById('gtLoop').click(); await new Promise(r => setTimeout(r, 150)); const r = { up: d.S.bpm - b0, label: document.getElementById('gtBpm').textContent, loop: d.T.loop !== loop0, pressed: document.getElementById('gtLoop').getAttribute('aria-pressed') === String(d.T.loop) }; document.getElementById('gtSlow').click(); document.getElementById('gtLoop').click(); return r; });
  ok(pr.up === 5 && /\d+ BPM/.test(pr.label) && pr.loop && pr.pressed, 'Practice: +5 BPM and the loop work from the goal bar, and show it (' + JSON.stringify(pr) + ')');

  // the kit: lesson notes are kept, ink is drawn and cleared, Studio Replay and the thumbnail
  await ev(() => { window.__daily.goalGo('teacher'); document.getElementById('gtNotes').click(); });
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
