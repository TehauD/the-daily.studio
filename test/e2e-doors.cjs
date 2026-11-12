/* The ways in (2.67): the start page offers four, one per workspace, and an optional "I'm mostly a" (singer, guitarist, new to
   music, producer) that changes what each says and where it leads. Each lands in its own workspace with a journey that starts there;
   the six single tasks land in one of the four workspaces too; and for someone who has been here before, every one of them starts
   something (before 2.67 they all just opened the last song). */
const { suite } = require('./lib.cjs');
const FRESH = new Function(`try { localStorage.removeItem('fw.started'); } catch (e) { }`);

suite('e2e-doors', async t => {
  const { ok, wait, poll } = t;
  const first = async () => { const p = await t.open({ boot: false, init: FRESH, w: 1440, h: 900 }); await p.goto(t.BASE + '?debug'); await wait(3200); return p; };
  const where = p => p.evaluate(() => { const d = window.__daily, tabs = [...document.querySelectorAll('#dock .tabs .tab')].map(b => b.dataset.id); return { ws: (d.goalNow() || {}).id || d.LAY.name, dock: d.DOCK.cur, inStrip: tabs.includes(d.DOCK.cur), song: d.S.title, gd: d.GD.id, step: (document.getElementById('gdText') || {}).textContent || '', simple: !!d.CFG.simple, tour: !!d.TOUR.on, arr: !document.getElementById('center').classList.contains('tl-slim'), hum: !!document.getElementById('humbar'), vox: !!document.getElementById('voxPanel'), coach: !!(document.getElementById('coach') && document.getElementById('coach').open) }; });
  const go = async (p, sel, me) => { if (me) await p.evaluate(m => document.querySelector('[data-me="' + m + '"]').click(), me); await p.evaluate(s => document.querySelector(s).click(), sel); await poll(async () => { const w = await where(p); return w.gd || w.tour || w.vox; }, 9000); await wait(900); return where(p); };
  const door = d => '.boot-door[data-door="' + d + '"]', goal = g => '.boot-goal[data-goal="' + g + '"]';

  /* ---- the page ---- */
  let p = await first();
  const pg = await p.evaluate(() => { const txt = d => document.querySelector('.boot-door[data-door="' + d + '"] .bd-s').textContent, a = txt('song'); document.querySelector('[data-me="sing"]').click(); const b = txt('song'), on = document.querySelector('[data-me="sing"]').getAttribute('aria-checked'), me = window.__daily.CFG.me; document.querySelector('[data-me="sing"]').click(); return { a, b, on, me, off: window.__daily.CFG.me, back: txt('song') === a, asks: /level|beginner|expert|skill/i.test(document.querySelector('.boot-card').textContent) }; });
  ok(/beat/.test(pg.a) && /Hum or sing/.test(pg.b) && pg.on === 'true' && pg.me === 'sing' && pg.off === '' && pg.back, '“I’m mostly a” is optional, is remembered, and changes what each way in says (singer: “' + pg.b.slice(0, 40) + '…”)');
  ok(!pg.asks, 'it asks what you mostly do, never how good you are');

  /* ---- a first visit: each way in lands in its own workspace, on a journey that starts there ---- */
  let w = await go(p, door('song'));
  ok(w.ws === 'songwriter' && w.dock === 'tab' && w.inStrip && w.song === 'My song' && w.gd === 'song' && /Beats/.test(w.step), 'Write a song: Songwriter, a new song, and the whole-song journey starting with a beat');

  /* the whole-song journey, start to finish */
  const D = f => p.evaluate(f), tick = () => p.evaluate(() => { window.__daily.gdTick(); return window.__daily.GD.i; });
  ok(await D(() => document.querySelectorAll('#gd .gd-steps li').length === 7 && /1 of 7/.test(document.querySelector('#gd .gd-n').textContent)), 'it has seven steps: an idea, hear it, words, a second part, a take, the stage, send it');
  await D(() => { const d = window.__daily; d.S.sections[0].bars.forEach((b, i) => { b.chord = ['G', 'D', 'Em', 'C'][i % 4]; }); d.commit(); });
  ok(await tick() === 1, 'chords in the song tick “Start with an idea”');
  await D(async () => { const d = window.__daily; await d.play(); await new Promise(r => setTimeout(r, 700)); d.gdTick(); d.stopPlay(true); }); await wait(200);
  ok(await tick() === 2, 'playing it once ticks “Hear it”');
  await D(() => { const d = window.__daily; d.S.sections[0].lyrics = '[G]Morning on the [D]water'; d.commit(); });
  ok(await tick() === 3, 'a line of words ticks “Write a line”');
  await D(() => { const d = window.__daily; d.S.sections.push(d.mkSection('Chorus', ['C', 'G', 'Am', 'F'])); d.commit(); });
  ok(await tick() === 4, 'a second section ticks “Add a second part”');
  const wav = t.wav(t.tone(3, 220, { amp: .4 }).data, 22050).toString('base64');
  await p.evaluate(async b64 => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); await window.__daily.dropTake(new File([u], 'Take.wav', { type: 'audio/wav' }), 'gtr'); }, wav); await wait(500);
  ok(await tick() === 5, 'a take ticks “Record a take”');
  await D(() => document.getElementById('gtNext').click()); await wait(600);
  ok(await tick() === 6 && (await where(p)).ws === 'performer', 'Into the Studio → ticks “Take it to the stage”');
  await D(() => document.getElementById('gtExp').click()); await wait(400); await tick(); await wait(300);
  ok(await D(() => document.getElementById('gd').dataset.state === 'done' && /whole song/.test(document.getElementById('gd').textContent)), '⇩ Export finishes it: “That is a whole song…”');
  await p.ctx.close();

  /* who you are changes where it leads */
  p = await first(); w = await go(p, door('song'), 'sing');
  ok(w.hum && w.gd === 'song' && /hum/i.test(w.step) && w.song === 'Untitled idea', 'a singer’s song starts by humming: the hum bar, and step 1 waits for it (' + w.step.slice(0, 40) + '…)');
  await p.ctx.close();
  p = await first(); w = await go(p, door('song'), 'guitar');
  ok(w.ws === 'songwriter' && /Capture/.test(w.step) && !w.hum, 'a guitarist’s song starts by capturing a riff');
  await p.ctx.close();

  p = await first(); w = await go(p, door('stage'));
  ok(w.ws === 'performer' && w.dock === 'vis' && /demo/.test(w.song) && w.gd === 'stage' && /Look/.test(w.step), 'Play it live: Studio, the finished song, and a journey that starts with a look');
  const st = await p.evaluate(async () => { const d = window.__daily, n0 = document.querySelectorAll('#gd .gd-steps li').length; d.vzSetMode('halo', true); d.gdTick(); const a = d.GD.i; d.CFG.me = 'sing'; const nSing = d.GD_SESSIONS.stage.steps.length; d.CFG.me = ''; return { n0, a, nSing }; });
  ok(st.n0 === 5 && st.a === 1 && st.nSing === 4, 'five steps (look, sound, band, ★ Showtime, video); a singer skips the guitar tone');
  await p.ctx.close();

  p = await first(); w = await go(p, door('learn'), 'new');
  ok(w.ws === 'practice' && w.dock === 'learn' && w.inStrip && w.gd === 'learn', 'Learn and practise: Practice, on the Learn panel, with its journey');
  await p.evaluate(() => { const d = window.__daily; d.GD.i = 1; d.gdTick(); document.getElementById('gdShow').click(); document.querySelector('#learn [data-lesson]').click(); }); await wait(500);
  ok((await where(p)).coach && await p.evaluate(() => { window.__daily.gdTick(); return window.__daily.GD.i; }) === 2, 'opening the first lesson ticks “Open a lesson”');
  await p.ctx.close();
  p = await first(); w = await go(p, door('learn'), 'sing');
  ok(w.ws === 'practice' && w.vox && !w.gd, 'a singer’s Practice opens Voice: the pitch ribbon, range and key');
  await p.ctx.close();

  p = await first(); w = await go(p, door('explore'), 'tech');
  ok(w.ws === 'fullrig' && !w.simple && /demo/.test(w.song) && w.tour, 'Explore everything: the Full Rig, every tool, a finished song, and the tour');
  await p.ctx.close();

  /* ---- the six single tasks land in one of the four workspaces, with their panel on the strip ---- */
  for (const [g, ws, dock, extra] of [['loop', 'performer', 'vis', x => x.arr], ['split', 'practice', 'stems', x => x.inStrip], ['play', 'performer', 'vis', x => /demo/.test(x.song)], ['write', 'songwriter', 'tab', x => x.inStrip]]) {
    p = await first(); w = await go(p, goal(g));
    ok(w.ws === ws && w.dock === dock && w.gd === g && extra(w), 'the “' + g + '” task opens in ' + ws + ' (' + JSON.stringify({ dock: w.dock, song: w.song, arr: w.arr }) + ')'); await p.ctx.close();
  }

  /* ---- someone who has been here before, with a song of their own ---- */
  const back = async () => { const q = await t.open({ w: 1440, h: 900 }); await q.evaluate(async () => { const d = window.__daily; await d.projCreate('blank', { form: 'verse', title: 'Joy', zoom: 'studio' }); d.S.sections[0].bars.forEach((b, i) => { b.chord = ['G', 'D', 'Em', 'C'][i % 4]; }); d.commit(); d.goalGo('songwriter'); await d.projSave(); }); await wait(700); await q.reload(); await wait(3200); return q; };
  p = await back();
  ok(await p.evaluate(() => document.getElementById('bootQ').textContent === 'Or start something new' && document.querySelectorAll('#bootStart .boot-door').length === 4 && document.querySelectorAll('#bootStart .boot-goal').length === 6 && !!(document.getElementById('bootRoutes').compareDocumentPosition(document.getElementById('bootStart')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'Welcome back: the main button, then the four ways in and the six tasks');
  w = await go(p, door('stage'));
  ok(w.ws === 'performer' && w.song === 'Joy' && w.gd === 'stage', 'Play it live keeps their own song (Joy), not the demo'); await p.ctx.close();
  p = await back(); w = await go(p, door('song'));
  ok(w.ws === 'songwriter' && w.song === 'My song' && w.gd === 'song', 'Write a song starts a new one'); await p.ctx.close();
  p = await back(); w = await go(p, goal('split'));
  ok(w.ws === 'practice' && w.dock === 'stems' && w.song === 'Learn a song' && w.gd === 'split', 'a single task starts for them too (it used to just open the last song)'); await p.ctx.close();
  p = await back(); w = await go(p, goal('hum'));
  ok(w.hum && w.gd === 'hum', 'and so does Turn a hum into a song'); await p.ctx.close();
  p = await back(); await p.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2500); w = await where(p);
  ok(w.song === 'Joy' && !w.gd, 'Pick up where I left off still opens their song, with no session');
});
