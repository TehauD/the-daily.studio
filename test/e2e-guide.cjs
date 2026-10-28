/* Getting started: the first page asks what you want to DO, each goal starts a short guided session that ticks off as the app sees you do it,
   tabs explain themselves once, DAW words are explained in guitar terms, and the Show tab has a preflight list.
   The steps are driven through the app's own state (the same state the guide watches). Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
const FRESH = new Function(`try { localStorage.removeItem('fw.started'); } catch (e) { }`);
const SPY = () => { window.__gum = { audio: 0, video: 0 }; const md = navigator.mediaDevices, g = md.getUserMedia.bind(md); md.getUserMedia = c => { if (c && c.audio) window.__gum.audio++; if (c && c.video) window.__gum.video++; return g(c); }; };
suite('e2e-guide', async t => {
  const { ok, wait, poll } = t;
  const open = async (o = {}) => { const p = await t.open({ boot: false, init: o.returning ? undefined : FRESH, ...o }); await p.addInitScript(SPY); await p.goto(t.BASE + '?debug'); await wait(3300); return p; };
  const goal = async (p, g) => { await p.evaluate(x => document.querySelector('.boot-goal[data-goal="' + x + '"]').click(), g); await poll(() => p.evaluate(() => !!document.getElementById('gd')), 9000); await wait(700); };
  const st = p => p.evaluate(() => { const D = window.__daily; return { id: D.GD.id, i: D.GD.i, text: (document.getElementById('gdText') || {}).textContent || '', title: (document.querySelector('#gd .gd-t') || {}).textContent || '', n: (document.querySelector('#gd .gd-n') || {}).textContent || '', done: (document.getElementById('gd') || { dataset: {} }).dataset.state, pulse: !!document.querySelector('.gd-pulse') }; });
  const tick = p => p.evaluate(() => { window.__daily.gdTick(); return window.__daily.GD.i; });

  // ---- the first page: goals, not levels
  const p = await open({ w: 1440, h: 900 });
  const f = await p.evaluate(() => ({ q: (document.getElementById('bootQ') || {}).textContent, goals: [...document.querySelectorAll('.boot-goal')].map(b => b.dataset.goal + ':' + b.querySelector('b').textContent), pro: !!document.getElementById('bootPro'), over: document.documentElement.scrollWidth > innerWidth, gum: window.__gum, lvl: /level|beginner|expert|skill/i.test(document.querySelector('.boot-card').textContent) }));
  ok(/what would you like to do first/i.test(f.q) && f.goals.join('|') === 'play:Play with a band|write:Write down what you play|hum:Turn a hum into a song|loop:Record, loop and layer|split:Learn a song|show:Run a show', 'the first page asks what you want to do, with six goals (Play, Create, Learn first) (' + f.goals.join(' | ') + ')');
  ok(!f.lvl && f.pro && !f.over && f.gum.audio === 0 && f.gum.video === 0, 'it never asks how good you are, offers a way to open everything, and asks for neither microphone nor camera');
  await p.ctx.close();

  // ---- Record, loop and layer (the goal), then Record guitar and voice
  let s0;
  const r = await open({ w: 1440, h: 900 }); await goal(r, 'loop');
  s0 = await st(r); ok(s0.id === 'loop' && s0.i === 0 && /1 of 6/.test(s0.n) && /My first loop/.test(await r.evaluate(() => window.__daily.S.title)), 'the Record, loop and layer goal opens its own six-step session on a new page (' + s0.n + ')');
  await r.evaluate(() => { window.__daily.guideStart('record', { fresh: true }); });
  let s = await st(r), info = await r.evaluate(() => { const D = window.__daily; return { title: D.S.title, lay: D.LAY.name, card: !!document.querySelector('#gd[role=region]'), steps: document.querySelectorAll('#gd .gd-steps li').length, gum: window.__gum }; });
  ok(s.id === 'record' && s.i === 0 && /Connect/.test(s.text) && s.pulse && info.card && info.steps === 5 && /1 of 5/.test(s.n), 'Record guitar and voice opens with step 1 of 5 and points at the control: "' + s.text.slice(0, 50) + '…"');
  ok(info.title === 'My first loop' && info.lay === 'Record' && info.gum.audio === 0 && info.gum.video === 0, 'it starts a fresh page in the Record layout without asking for the microphone yet');
  const rect = await r.evaluate(() => { const a = document.getElementById('gd').getBoundingClientRect(), b = (document.querySelector('.gd-pulse') || document.body).getBoundingClientRect(); return { off: a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom, inside: a.left >= 0 && a.top >= 0 && a.right <= innerWidth && a.bottom <= innerHeight }; });
  ok(rect.off && rect.inside, 'the card sits clear of the control it points at and inside the window');
  await r.evaluate(async () => { const D = window.__daily; await D.ioConnect(); }); await wait(900);
  ok((await tick(r)) >= 1, 'connecting an input ticks step 1 by itself');
  await r.evaluate(() => { window.__daily.T.rec = true; }); await wait(300); ok((await tick(r)) >= 2, 'arming a take ticks the next step');
  await r.evaluate(() => { const D = window.__daily; D.TAKES.push({ id: 'guide-fake', name: 'fake', dry: null, wet: null, t0: 0 }); }); await wait(300); await tick(r);
  s = await st(r); ok(s.i === 4, 'a finished take moves it to "Hear it back" (step ' + (s.i + 1) + ')');
  await r.evaluate(() => { window.__daily.GD.seen.played = 1; }); await tick(r); await wait(300);
  s = await st(r); const dn = await r.evaluate(() => ({ done: !!window.__daily.gdc().done.record, lvl: window.__daily.xpLevel(), next: (document.getElementById('gdNext') || {}).textContent, unl: (document.querySelector('.gd-unlock') || {}).textContent || '' }));
  ok(s.done === 'done' && dn.done && /Record, loop and layer/.test(dn.next || ''), 'finishing shows what you made and offers the next session (' + dn.next + ')');
  ok(dn.lvl === 'some' && /Added to your tabs/.test(dn.unl), 'finishing a session adds tools to the tab strip and says which (' + dn.unl.slice(0, 70) + ')');
  await r.evaluate(() => { const D = window.__daily, i = D.TAKES.findIndex(x => x.id === 'guide-fake'); if (i >= 0) D.TAKES.splice(i, 1); D.T.rec = false; });

  // ---- the loop session ticks from the looper's own state
  await r.evaluate(() => { const D = window.__daily; D.guideStart('loop', { fresh: true }); D.LP.on = false; D.LP.n0 = D.TAKES.length; }); await wait(600);
  await r.evaluate(async () => { await window.__daily.ioConnect(); }); await wait(900); s = await st(r);
  ok(s.id === 'loop' && s.i === 1 && /Loop & layer/.test(s.text) && await r.evaluate(() => !!document.querySelector('.gd-pulse')), 'with an input connected the loop session asks you to set the loop, and points at the button');
  await r.evaluate(() => { const D = window.__daily; D.LP.on = true; D.LP.n0 = D.TAKES.length; }); await tick(r); await wait(300); s = await st(r); ok(s.i === 2, 'starting the loop ticks "Set the loop"');
  await r.evaluate(() => { const D = window.__daily; D.TAKES.push({ id: 'lp-1', kind: 'gtr', name: 'Layer 1', dur: 1 }); }); await tick(r); await wait(300); s = await st(r); ok(s.i === 3, 'a first layer ticks "Play your chords"');
  await r.evaluate(() => { const D = window.__daily; D.TAKES.push({ id: 'lp-2', kind: 'gtr', name: 'Layer 2', dur: 1 }); }); await tick(r); await wait(300); s = await st(r); ok(s.i === 4, 'a second layer ticks "Play a lead on top"');
  await r.evaluate(() => { const D = window.__daily; D.T.playing = true; D.T.rec = false; }); await tick(r); await wait(300); s = await st(r); ok(s.i === 5, 'recording stopped with the loop still playing ticks "Just listen"');
  await r.evaluate(() => { const D = window.__daily; D.T.playing = false; D.LP.on = false; }); await tick(r); await wait(500); s = await st(r);
  ok(s.done === 'done' && /looper workflow/.test(await r.evaluate(() => document.getElementById('gd').textContent)), 'stopping finishes it and says what you made');
  await r.evaluate(() => { const D = window.__daily; ['lp-1', 'lp-2'].forEach(id => { const i = D.TAKES.findIndex(x => x.id === id); if (i >= 0) D.TAKES.splice(i, 1); }); });

  // ---- leaving and coming back; the menu
  await r.evaluate(() => { const D = window.__daily; D.guideStart('split', { fresh: true, go: true }); }); await wait(500);
  await r.evaluate(() => { const D = window.__daily; D.STM.dur = 12; D.STM.busy = false; }); await wait(800); s = await st(r);
  ok(s.id === 'split' && s.i >= 2, 'a song loading ticks "Load a song" (step ' + (s.i + 1) + ')');
  await r.evaluate(() => { const D = window.__daily; D.STM.mix[1].m = true; }); await wait(700); s = await st(r); ok(s.i === 3, 'muting a part ticks "Mute your part"');
  await r.evaluate(() => { const D = window.__daily; D.STP.playing = true; }); await wait(900); s = await st(r); ok(s.i === 4, 'playing along ticks the next step');
  await r.click('#gdEnd'); await wait(300);
  ok(await r.evaluate(() => !document.getElementById('gd') && window.__daily.gdc().prog.split === 4), 'closing the card keeps your place');
  await r.evaluate(() => { const D = window.__daily; D.STP.playing = false; D.STM.dur = 0; D.STM.mix[1].m = false; });
  await r.evaluate(() => window.__daily.guideMenu()); await wait(300);
  const mn = await r.evaluate(() => [...document.querySelectorAll('#gdMenu .gd-row')].map(x => x.querySelector('b').textContent.trim().replace(/\s*✓ done/, '') + ':' + x.querySelector('button').textContent));
  ok(mn.length === 7 && mn.some(x => /Record guitar and voice:Again/.test(x)) && mn.some(x => /Learn a song:Resume/.test(x)) && mn.some(x => /Turn a hum into a song:Start/.test(x)), 'the menu lists all seven, with Again, Resume and Start as they apply (' + mn.join(' | ') + ')');
  await r.click('#gdMenu button[data-s="split"]'); await wait(700); s = await st(r);
  ok(s.id === 'split' && s.i === 4, 'Resume picks the session up where it was');
  await r.evaluate(() => window.__daily.guideStop(true));
  // plain words
  await r.evaluate(() => window.__daily.guideWords()); await wait(300);
  const wd = await r.evaluate(() => { const n0 = document.querySelectorAll('#gdWordsDlg dt:not([hidden])').length, q = document.querySelector('#gdWordsDlg input'); q.value = 'loop'; q.dispatchEvent(new Event('input')); return { n0, n1: document.querySelectorAll('#gdWordsDlg dt:not([hidden])').length, txt: /guitar|tape|channel|drill/i.test(document.querySelector('#gdWordsDlg').textContent) }; });
  ok(wd.n0 >= 12 && wd.n1 >= 1 && wd.n1 < wd.n0 && wd.txt, 'DAW words are explained in guitar terms, and the list can be searched (' + wd.n0 + ' words, ' + wd.n1 + ' for “loop”)');
  await r.evaluate(() => { const d = document.getElementById('gdWordsDlg'); if (d) d.close(); });
  // help
  await r.evaluate(() => document.querySelector('button[title^="Help & shortcuts"]').click()); await wait(400);
  ok(await r.evaluate(() => !!document.getElementById('helpSessions')), 'Help has a Guided sessions button');
  await r.evaluate(() => { const d = document.getElementById('help'); if (d && d.open) d.close(); });
  await r.ctx.close();

  // ---- Turn a hum into a song
  const hm = await open({ w: 1440, h: 900 }); await goal(hm, 'hum'); await poll(() => hm.evaluate(() => !!document.getElementById('humGo2')), 6000);
  s = await st(hm); ok(s.id === 'hum' && s.i === 0 && /Sing or hum/.test(s.text) && s.pulse && /1 of 5/.test(s.n), 'the hum session points at the Sing or hum button on the clean page');
  ok(await hm.evaluate(() => document.querySelector('.gd-pulse').id === 'humGo2' && window.__gum.audio === 0), 'it does not start the microphone for you');
  await hm.evaluate(() => { const D = window.__daily; D.HUM.pcm = new Float32Array(100); D.HUM.o = { style: 'Folk', seed: 0, bpm: 90, key: 0, minor: false, form: 'full' }; }); await wait(900);
  s = await st(hm); ok(s.i === 2, 'once there is a hum, it moves to "Hear the band" (step ' + (s.i + 1) + ')');
  await hm.evaluate(() => { window.__daily.GD.seen.played = 1; }); await wait(900); s = await st(hm); ok(s.i === 3 && /Style|chords/i.test(s.text), 'playing it ticks that step and asks you to change something');
  await hm.evaluate(() => { window.__daily.HUM.o.seed = 1; }); await wait(900); s = await st(hm); ok(s.i === 4, 'changing the feel ticks the next step');
  await hm.evaluate(() => { const D = window.__daily; D.HUM.r = { key: { root: 0, minor: false } }; D.humBar && 0; const b = document.getElementById('humbar'); if (b) { try { b.close(); } catch (e) { } b.remove(); } }); await wait(900); s = await st(hm);
  ok(s.done === 'done' && /saved in My songs/i.test(await hm.evaluate(() => document.getElementById('gd').textContent)), 'keeping it finishes the session and says where it is saved');
  await hm.ctx.close();

  // ---- Run a show: the preflight
  const sh = await open({ w: 1440, h: 900 }); await goal(sh, 'show'); await wait(900);
  const o0 = await sh.evaluate(() => { const D = window.__daily; return { lay: D.LAY.name, dock: D.DOCK.cur, title: D.S.title, n: D.GD_SESSIONS.show.steps.length, id: D.GD.id, tab: D.SHC.tab }; });
  ok(o0.lay === 'Show' && o0.dock === 'stage' && o0.n === 7 && o0.id === 'show' && /demo/i.test(o0.title), 'Run a show opens a song in the Show layout with the Show setup open and a seven-step preflight (' + o0.title + ')');
  await sh.evaluate(() => window.__daily.shOpen('scene', 'out')); await wait(500);
  const pf0 = await sh.evaluate(() => ({ items: document.querySelectorAll('#gdPf li').length, head: document.querySelector('#gdPf .gd-pf-h b').textContent, ok: document.querySelectorAll('#gdPf li.ok').length }));
  ok(pf0.items === 7 && /0 of 7/.test(pf0.head) && pf0.ok === 0, 'the Output tab carries the same preflight list, all unticked to begin with (' + pf0.head + ')');
  await sh.evaluate(() => window.__daily.shOpen('scene', 'looks')); await wait(300);
  await sh.evaluate(() => { const b = [...document.querySelectorAll('#shc .btn')].find(x => /^Use$/.test(x.textContent.trim())); if (b) b.click(); }); await wait(600);
  await sh.evaluate(() => window.__daily.shOpen('scene', 'rig')); await wait(900);
  await sh.evaluate(() => window.__daily.shOpen('scene', 'out')); await wait(500);
  const popP = sh.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);
  await sh.click('#shPop'); const pop = await popP; if (pop) await pop.close().catch(() => { });
  await sh.evaluate(() => { const b = [...document.querySelectorAll('#shc .shc-seg button')].find(x => x.textContent.trim() === 'Bars'); b.click(); }); await wait(900);
  await sh.evaluate(() => { const b = [...document.querySelectorAll('#shc .shc-seg button')].find(x => x.textContent.trim() === 'Off'); b.click(); }); await wait(300);
  await sh.evaluate(() => { const i = document.querySelector('#shc .sg-sl input[type=range]'); i.value = .8; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(900);
  const pf1 = await sh.evaluate(() => ({ ids: [...document.querySelectorAll('#gdPf li.ok')].map(x => x.dataset.id).join(','), head: document.querySelector('#gdPf .gd-pf-h b').textContent }));
  ok(pf1.ids === 'look,rig,out,test,master', 'the app ticks look, rig, output, test pattern and master level as each is done (' + pf1.ids + ')');
  await sh.click('#shBo'); await wait(400); await sh.click('#shBo'); await wait(900);
  ok(await sh.evaluate(() => !window.__daily.SG.boOn && window.__daily.GD.pf.bo === 1 && !!document.querySelector('#gdPf li[data-id="bo"].ok')), 'a blackout and its return tick the blackout line');
  await sh.click('#sgdPlay'); await wait(1400);
  const fin = await sh.evaluate(() => ({ head: (document.querySelector('#gdPf .gd-pf-h b') || {}).textContent, done: (document.getElementById('gd') || { dataset: {} }).dataset.state, txt: (document.getElementById('gd') || {}).textContent || '' }));
  ok(/7 of 7/.test(fin.head) && fin.done === 'done' && /Preflight done/.test(fin.txt), 'playing the song through completes the preflight and the session (' + fin.head + ')');
  await sh.evaluate(() => { document.querySelector('#shc .btn[title], #sgdPlay'); window.__daily.stopPlay && window.__daily.stopPlay(true); });
  await sh.click('#gdPf .gd-pf-h .btn'); await wait(700);
  ok(await sh.evaluate(() => document.querySelectorAll('#gdPf li.ok').length === 0), 'Start over clears the ticks for the next room');
  await sh.ctx.close();

  // ---- the first time a tab opens
  const hn = await open({ w: 1440, h: 900 }); await hn.evaluate(() => document.getElementById('bootNoMic').click()); await wait(3300);
  await hn.evaluate(() => window.__daily.CFG.startTab && 0); await hn.evaluate(() => window.__daily.guideStop && window.__daily.guideStop(true));
  await hn.evaluate(() => { const d = window.__daily; d.CFG.xpMode = 'some'; d.rebuildTabs && d.rebuildTabs(); }); 
  await hn.evaluate(() => window.__daily.CFG.xpMode = 'auto');
  await hn.keyboard.press('Escape'); await hn.evaluate(() => { const d = window.__daily; document.querySelectorAll('.gd-hint').forEach(e => e.remove()); d.dockGo && d.dockGo('band'); }); await wait(700);
  const h1 = await hn.evaluate(() => { const e = document.querySelector('.gd-hint[data-id="band"]'); return { has: !!e, txt: e ? e.textContent : '', btn: !!(e && e.querySelector('.btn')) }; });
  ok(h1.has && /drummer|bassist/i.test(h1.txt) && /Try:/.test(h1.txt) && h1.btn, 'a tab explains itself the first time it opens: what it is, and something to try');
  await hn.evaluate(() => document.querySelector('.gd-hint[data-id="band"] .btn').click()); await wait(300);
  ok(await hn.evaluate(() => { const e = document.querySelector('.gd-hint[data-id="band"]'); return !!e.querySelector('.gd-info') && e.classList.contains('small') && window.__daily.gdc().hints.band === 1; }), 'Got it folds it into a small “What is this tab?” line, and remembers');
  await hn.evaluate(() => { window.__daily.dockGo('song'); }); await wait(300); await hn.evaluate(() => { window.__daily.dockGo('band'); }); await wait(400);
  ok(await hn.evaluate(() => document.querySelectorAll('.gd-hint[data-id="band"]').length === 1 && !!document.querySelector('.gd-hint[data-id="band"] .gd-info')), 'it does not come back as a full note, and is never added twice');
  await hn.evaluate(() => { window.__daily.GD_SESSIONS; window.__daily.guideStart('split', { fresh: true }); window.__daily.dockGo('tab'); }); await wait(400);
  ok(await hn.evaluate(() => document.querySelectorAll('.gd-hint[data-id="tab"]').length === 0), 'no notes appear while a guided session is running');
  await hn.evaluate(() => { window.__daily.guideStop(true); window.__daily.CFG.xpMode = 'pro'; window.__daily.dockGo('fret'); }); await wait(400);
  ok(await hn.evaluate(() => document.querySelectorAll('.gd-hint[data-id="fret"]').length === 0), 'on Everything there are no notes at all');
  await hn.ctx.close();

  // ---- "I know my way around"
  const pr = await open({ w: 1440, h: 900 }); await pr.evaluate(() => document.getElementById('bootPro').click()); await wait(3600);
  const px = await pr.evaluate(() => ({ lvl: window.__daily.xpLevel(), tabs: document.querySelectorAll('#dock .tab').length, gd: !!document.getElementById('gd') }));
  ok(px.lvl === 'pro' && px.tabs >= 8 && !px.gd, 'I know my way around opens the studio with every tool and no coaching (' + px.tabs + ' tabs)');
  await pr.ctx.close();

  // ---- someone who already has songs just carries on
  const rt = await open({ w: 1440, h: 900, returning: true });
  ok(await rt.evaluate(() => !document.getElementById('bootGoals') && !document.getElementById('bootPro') && !!document.getElementById('bootNoMic')), 'a returning visitor sees one button and no goal cards');
  await rt.ctx.close();

  // ---- a phone
  const ph = await open({ w: 390, h: 844, mobile: true, dpr: 2 });
  const pm = await ph.evaluate(() => { const r = e => document.querySelector(e).getBoundingClientRect(); return { first: Math.round(r('.boot-goal').bottom), last: Math.round(r('.boot-goal[data-goal="show"]').bottom), no: Math.round(r('#bootNoMic').bottom), vh: innerHeight, over: document.documentElement.scrollWidth > innerWidth }; });
  ok(pm.last < pm.vh && pm.no <= pm.vh && !pm.over, 'on a phone all six goals and the way in are on the first screen (goals end at ' + pm.last + ', way in at ' + pm.no + ' of ' + pm.vh + ')');
  await goal(ph, 'loop'); await wait(600);
  const pc = await ph.evaluate(() => { const a = document.getElementById('gd').getBoundingClientRect(); return { inside: a.left >= 0 && a.right <= innerWidth && a.top >= 0 && a.bottom <= innerHeight, steps: getComputedStyle(document.querySelector('#gd .gd-steps')).display, over: document.documentElement.scrollWidth > innerWidth, w: Math.round(a.width) }; });
  ok(pc.inside && pc.steps === 'none' && !pc.over, 'on a phone the session card is a compact strip inside the screen (' + pc.w + ' px wide)');
  await ph.ctx.close();
  ok(t.errors ? t.errors().length === 0 : true, 'no console errors');
});
