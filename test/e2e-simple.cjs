/* Simple mode (2.33): one switch (top right, and Settings ▸ Workflow) that tucks away what a first-timer does not need and keeps
   what makes something; first visits start in it, people who have been here before keep the full studio, and nothing is lost. */
const { suite } = require('./lib.cjs');

suite('e2e-simple', async t => {
  const { ok, wait } = t;
  const p = await t.open({ w: 1600, h: 900 }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => window.__daily.goalGo('songwriter')); await wait(400);
  const GONE = ['#transport .rew', '#transport .lcd-pos', '#transport .f-sig', '#transport .metro-more', '#topR #wsBtn', '#topR .mst-chip', '#topR .lat-chip', '#songbar .f-artist', '#songbar .f-tun', '#songbar .f-capo', '#songbar .f-scale', '#songbar .sb-more', '#songbar .sb-zoom', '#goalbar .gl-flow', '#xpTools', 'footer#status', '#pane-tab .tech', '#pane-tab .te-adv', '#timeline .tl-adv'];
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
