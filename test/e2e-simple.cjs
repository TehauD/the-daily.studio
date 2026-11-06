/* Simple mode (2.33): one switch (top right, and Settings ▸ Workflow) that tucks away what a first-timer does not need and keeps
   what makes something; first visits start in it, people who have been here before keep the full studio, and nothing is lost. */
const { suite } = require('./lib.cjs');

suite('e2e-simple', async t => {
  const { ok, wait } = t;
  const p = await t.open({ w: 1600, h: 900 }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => window.__daily.goalGo('songwriter')); await wait(400);
  const GONE = ['#transport .rew', '#transport .lcd-pos', '#transport .f-sig', '#transport .metro-more', '#topR #wsBtn', '#topR .mst-chip', '#songbar .f-artist', '#songbar .f-tun', '#songbar .f-capo', '#songbar .f-scale', '#songbar .sb-more', '#songbar .sb-zoom', '#goalbar .gl-flow', '#xpTools', 'footer#status', '#pane-tab .tech', '#pane-tab .te-adv', '#timeline .tl-adv'];
  const KEPT = ['#transport .play', '#transport .rec', '#transport .f-bpm', '#songbar .sb-songs', '#songbar .sb-title', '#sbPerform', '#gtSheet', '#wrCap', '#bandMuteAll', '#lpBtn', '#simpleBtn'];
  const seen = q => ev(q => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, q);
  const all = async qs => { const o = {}; for (const q of qs) o[q] = await seen(q); return o; };

  /* ---- someone who has been here before: the full studio, and the switch ---- */
  const F0 = await all(GONE.concat(KEPT));
  ok(await ev(() => !document.body.classList.contains('simple') && document.getElementById('simpleBtn').getAttribute('aria-pressed') === 'false'), 'someone who has been here before keeps the full studio; ✦ Simple waits in the top right');
  ok(Object.values(F0).every(v => v !== false), 'every tool is showing (' + Object.keys(F0).filter(k => F0[k] === false).join(', ') + ')');

  /* ---- Simple on ---- */
  await ev(() => document.getElementById('simpleBtn').click()); await wait(400);
  const G = await all(GONE), K = await all(KEPT);
  ok(Object.values(G).every(v => !v), 'Simple tucks away the counter, time signature, meters, latency, artist, tuning, capo, scale, the view switch, the flow, Tools, techniques, fills, the arrangement’s tools and the status line (' + Object.keys(G).filter(k => G[k]).join(', ') + ')');
  ok(Object.values(K).every(Boolean), 'and keeps play, record, the tempo, Songs, the title, Perform, the workspace tools, ● Capture, Mute all, Loop & layer and the switch itself (' + Object.keys(K).filter(k => !K[k]).join(', ') + ')');
  ok(await ev(() => [...document.querySelectorAll('#dock .tabs .tab')].every(b => !/^\d+ · /.test(b.textContent)) && [...document.querySelectorAll('#transport .btn .lbl')].some(l => getComputedStyle(l).display !== 'none' && /Loop/.test(l.textContent))), 'the panel tabs are plain words (no numbers), and Loop and Click say what they are');
  ok(await ev(() => document.getElementById('simpleBtn').getAttribute('aria-pressed') === 'true' && window.__daily.CFG.simple === true), 'the switch shows it is on');
  const n = await ev(() => [...document.querySelectorAll('button, select, input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden'; }).length);
  const nFull = await ev(async () => { document.body.classList.remove('simple'); await new Promise(r => setTimeout(r, 100)); const c = [...document.querySelectorAll('button, select, input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden'; }).length; document.body.classList.add('simple'); return c; });
  ok(n < nFull * .8, 'fewer controls on screen: ' + n + ' instead of ' + nFull);
  ok(await ev(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1), 'nothing spills off the page');

  /* ---- what it tucks away still works ---- */
  await ev(() => window.__daily.goalGo('performer')); await wait(400);
  ok(await ev(() => !['vzCamBtn', 'vzNeckBtn', 'hexTone'].some(id => { const e = document.getElementById(id); return e && e.getBoundingClientRect().width > 0; }) && document.getElementById('gtCam').getBoundingClientRect().width > 0), 'Performer: the stage’s extra settings are tucked away; the camera is still one button in the tool row');
  await ev(() => { window.__daily.S.bpm = 100; window.__daily.commit(false); }); await p.keyboard.press('Escape');
  ok(await ev(() => window.__daily.S.bpm === 100), 'the song is untouched: Simple only hides');

  /* ---- kept after a reload, and in Settings ---- */
  await p.reload(); await wait(3500);
  ok(await ev(() => document.body.classList.contains('simple') && document.getElementById('simpleBtn').getAttribute('aria-pressed') === 'true'), 'it is still Simple after a reload');
  await ev(() => window.__daily.openSettings('work')); await wait(300);
  const box = await ev(() => { const l = [...document.querySelectorAll('#settings label.chk')].find(x => /Simple/.test(x.textContent)); return l ? l.querySelector('input').checked : null; });
  ok(box === true, 'Settings ▸ Workflow has the same switch, ticked');
  await ev(() => { const l = [...document.querySelectorAll('#settings label.chk')].find(x => /Simple/.test(x.textContent)); l.querySelector('input').click(); document.getElementById('settings').close(); window.__daily.goalGo('songwriter'); }); await wait(600);
  const F1 = await all(GONE);
  ok(await ev(() => !document.body.classList.contains('simple')) && Object.values(F1).every(v => v !== false), 'unticked: every tool is back');

  /* ---- 2.38: Simple across the board, and the arrangement kept ---- */
  const A0 = await ev(() => { const D = window.__daily; D.goalGo('performer'); return { lay: JSON.stringify(D.LAY), tabs: [...document.querySelectorAll('#dock .tabs .tab')].map(b => b.dataset.id).join() }; });
  await ev(() => window.__daily.simpleSet(true, true)); await wait(400);
  const A1 = await ev(() => { const D = window.__daily, vis = q => { const e = document.querySelector(q); return !!e && e.getBoundingClientRect().width > 0; };
    return { lay: D.LAY.name, tabs: [...document.querySelectorAll('#dock .tabs .tab')].map(b => b.dataset.id).join(), fullrig: vis('.gl-b[data-goal="fullrig"]'), goals: [...document.querySelectorAll('#goalbar .gl-b')].filter(b => b.getBoundingClientRect().width > 0).length, next: vis('#gtNext'),
      tools: [...document.querySelectorAll('#goalbar .gl-tool')].map(b => b.id + (b.classList.contains('gl-main') ? '*' : '')).join(), mis: document.querySelector('#goalbar .gl-mis').textContent }; });
  ok(!/rig/.test(A1.tabs) && A1.tabs.split(',').length <= 4 && A1.lay === 'Songwriter', 'Simple is the Songwriter workspace, with the panel strip at the essentials (' + A1.tabs + '; it was the Performer: ' + A0.tabs + ')');
  ok(A1.goals === 1 && !A1.next && A1.tools === 'gtBeats*,gtSheet,gtPads,gtKeys,gtLink' && /Pick a beat/.test(A1.mis), 'the goal bar is just the Songwriter: Beats first, then Paste chords, Pads, Keys and Send as a link, and “Pick a beat” as step one (' + A1.tools + ')');
  ok(!A1.fullrig, 'the other workspaces are tucked away');
  await ev(() => document.querySelector('#left .side-tabs .tab[data-id="tones"]').click()); await wait(200);
  const A1t = await ev(() => { const vis = q => { const e = document.querySelector(q); return !!e && e.getBoundingClientRect().width > 0; }; return { tones: document.querySelectorAll('#left .plist .pitem').length, all: vis('#toneAll'), search: vis('#left .tone-q') }; });
  ok(A1t.tones === 8 && A1t.all && !A1t.search, 'eight core tones, with Show all 27 tones, and no search or categories');
  await ev(() => document.getElementById('toneAll').click()); await wait(200);
  ok(await ev(() => document.querySelectorAll('#left .plist .pitem').length === 27), 'Show all tones lists every tone');
  await ev(() => document.querySelector('#left .side-tabs .tab[data-id="io"]').click()); await wait(200);
  const IO = await ev(() => { const vis = e => !!e && e.getBoundingClientRect().width > 0, card = t => [...document.querySelectorAll('#left .card')].find(c => c.querySelector('h4') && c.querySelector('h4').textContent.trim().startsWith(t)); return { input: vis(card('Audio input')), voice: vis(card('Channels')), cam: vis(card('Camera')), midi: vis(card('MIDI')), add: vis(document.getElementById('ioAddVoice')), path: vis(document.querySelector('#ioConn .io-pathbox')) }; });
  ok(IO.input && !IO.voice && !IO.cam && !IO.midi && !IO.path && IO.add, 'Audio: one input, with its level and monitoring; the camera, MIDI and the signal path are tucked away');
  await ev(() => document.getElementById('ioAddVoice').click()); await wait(200);
  ok(await ev(() => { const c = [...document.querySelectorAll('#left .card')].find(x => x.querySelector('h4') && /^Channels/.test(x.querySelector('h4').textContent.trim())); return !!c && c.getBoundingClientRect().width > 0 && /No microphone/.test(document.getElementById('ioAddVoice').textContent); }), '＋ Add a microphone for your voice brings in the second input');

  /* ---- 2.39: Simple's band is the beats and who plays ---- */
  await ev(() => window.__daily.dockGo('band')); await wait(300);
  const BD = await ev(() => ({ beats: document.querySelectorAll('#pane-band .bt-card').length, mix: [...document.querySelectorAll('#pane-band .bt-ch')].map(c => c.dataset.part).join(), grid: !!document.querySelector('#pane-band .dgrid'), sel: document.querySelectorAll('#pane-band select').length }));
  ok(BD.beats >= 10, 'the Band panel opens on the beats (' + BD.beats + ')');
  ok(BD.mix === 'drums,bass,rhythm,keys' && !BD.grid && BD.sel === 0, 'and who plays: drums, bass, guitar and keys, a switch and a level each; no step grid, no menus');
  await ev(() => { const D = window.__daily; D.S.sections.forEach(s => s.bars.forEach(b => { b.chord = ''; })); D.commit(false); document.querySelector('#pane-band .bt-card[data-beat="lofi"]').click(); }); await wait(600);
  const BT = await ev(() => { const D = window.__daily, B = D.S.band; return { bpm: D.S.bpm, swing: D.S.swing, kit: B.kit, len: B.drumLen, keys: B.keysOn && B.keysSound, playing: D.T.playing, loop: D.T.loop, chords: D.S.sections[0].bars.slice(0, 4).map(b => b.chord).join(' '), on: !!document.querySelector('#pane-band .bt-card.on[data-beat="lofi"]') }; });
  ok(BT.bpm === 82 && BT.swing > 0 && BT.kit === 'Brush (soft)' && BT.keys === 'Electric piano' && BT.playing && BT.loop, 'tapping Lo-fi Nod sets the band and the tempo and plays it on a loop (' + JSON.stringify(BT) + ')');
  ok(/^\S+m7 \S+7 \S+maj7 \S+m7$/.test(BT.chords) && BT.on, 'a song with no chords gets the beat’s progression in its key (' + BT.chords + '), and the beat shows as chosen');
  await ev(() => { const D = window.__daily; D.stopPlay(true); D.undo(); }); await wait(300);
  ok(await ev(() => { const D = window.__daily; return D.S.band.beat !== 'lofi' && D.S.bpm !== 82 && D.S.sections[0].bars.every(b => !b.chord); }), 'one undo puts the band, the tempo and the chords back');
  await ev(() => document.getElementById('bandAll').click()); await wait(200);
  ok(await ev(() => !!document.querySelector('#pane-band .dgrid') && !!document.getElementById('bandLess') && document.querySelectorAll('#pane-band .bt-card').length >= 10), 'Show every band setting brings the step grid and the menus back, with the beats on top');
  await ev(() => document.getElementById('bandLess').click()); await wait(200);

  await ev(() => { document.querySelector('#left .side-tabs .tab[data-id="theory"]').click(); window.__daily.simpleSet(false, true); }); await wait(400);      /* back to the sidebar tab it was on: the test itself moved it */
  const A2 = await ev(() => { const D = window.__daily; return { name: D.LAY.name, lay: JSON.stringify(D.LAY), tabs: [...document.querySelectorAll('#dock .tabs .tab')].map(b => b.dataset.id).join(), tones: document.querySelectorAll('#left .plist .pitem').length }; });
  ok(A2.name === 'Performer' && A2.lay === A0.lay && A2.tabs === A0.tabs && A2.tones === 27, 'Simple off: back in the Performer, exactly as it was (sidebars, panels, tabs), and every tone is back (' + A2.name + ')');
  await ev(() => { window.__daily.CFG.ioVoice = false; window.__daily.saveCfg(); window.__daily.goalGo('songwriter'); });

  /* ---- a first visit starts Simple; "I know my way around" does not ---- */
  const q = await t.open({ w: 1600, h: 900, boot: false }); await q.evaluate(() => { window.name = 'noseed'; }); await q.goto(t.BASE + '?debug'); await wait(3200);
  ok(await q.evaluate(() => window.__daily.CFG.simple === true), 'a first visit starts in Simple');
  await q.evaluate(() => document.getElementById('bootPro').click()); await wait(1500);
  ok(await q.evaluate(() => window.__daily.CFG.simple === false && !document.body.classList.contains('simple')), '“I know my way around” opens the full studio');

  /* ---- phones keep their own layout ---- */
  const m = await t.open({ w: 390, h: 844, mobile: true }), mv = (f, a) => m.evaluate(f, a);
  const ph = await mv(async () => { const a = document.querySelectorAll('button:not([hidden])').length; window.__daily.CFG.simple = true; document.body.classList.add('simple'); await new Promise(r => setTimeout(r, 200)); return { same: document.querySelectorAll('button:not([hidden])').length === a, wide: document.documentElement.scrollWidth <= innerWidth + 1 }; });
  ok(ph.wide, 'on a phone nothing spills off the page with Simple on');
});
