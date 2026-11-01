/* Secrets (2.20): Tuned to perfection, In the pocket, the hidden line, and Backstage, which the console note points developers to.
   The tuner's readings are stood in for (the fake microphone plays one tone), and so are the timing readings; everything else is the real thing. */
const { suite } = require('./lib.cjs');

suite('e2e-secrets', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({ boot: false }), logs = [];
  p.on('console', m => logs.push(m.text()));
  await t.boot(p);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(async () => { await window.__daily.startAudio(); });

  /* ---- the console says hello ---- */
  ok(logs.some(l => /Hey, you opened the console/.test(l) && /dailyStudio\.backstage\(\)/.test(l)) && logs.some(l => /the-daily\.studio/.test(l) && /build [0-9a-f]{7}/.test(l)), 'the console greets developers and points at dailyStudio.backstage()');
  ok(logs.some(l => /made from \d+ plain JavaScript parts \([\d,]+ lines\)/.test(l)), 'it says what the page is made of');

  /* ---- nothing shows until something is found ---- */
  ok(await ev(() => [...document.querySelectorAll('.secret-chip')].every(c => c.hidden)), 'no counter until the first secret is found');
  ok(await ev(() => { window.__daily.backstageOpen(); return !document.getElementById('backstage') || !document.getElementById('backstage').open; }), 'Backstage stays locked until the door is knocked on');

  /* ---- Tuned to perfection (the tuner's readings stood in for) ---- */
  const fake = () => ev(() => { const AN = window.__daily.AN; window.__fake = { active: false, midi: null, cents: 0 }; window.__keep = {};
    ['active', 'midi', 'cents'].forEach(k => { window.__keep[k] = Object.getOwnPropertyDescriptor(AN, k); Object.defineProperty(AN, k, { configurable: true, get: () => window.__fake[k], set: () => { } }); }); });
  const unfake = () => ev(() => { const AN = window.__daily.AN; ['active', 'midi', 'cents'].forEach(k => { delete AN[k]; const d = window.__keep[k]; if (d) Object.defineProperty(AN, k, d); }); });
  const tune = (cents) => ev(async cents => { const D = window.__daily; for (const m of D.S.tuning) { Object.assign(window.__fake, { active: true, midi: m, cents }); await new Promise(r => setTimeout(r, 520)); } window.__fake.active = false; }, cents);
  await fake();
  await tune(4.5);
  ok(await ev(() => !window.__daily.CFG.secrets.tuned), 'six strings 4.5 cents out is not perfect');
  await ev(() => { window.__daily.SREC.on = true; }); await tune(1);
  ok(await ev(() => !window.__daily.CFG.secrets.tuned), 'nothing fires while a video is recording');
  await ev(() => { window.__daily.SREC.on = false; window.__daily.SEC.tuned = {}; window.__daily.SEC.tunedT0 = 0; });
  await tune(-1.5);
  ok(await poll(() => ev(() => !!window.__daily.CFG.secrets.tuned), 3000), 'all six open strings within ±2 cents: Tuned to perfection');
  ok(await ev(() => /Tuned to perfection/.test(document.getElementById('toasts').textContent) && /Secret 1 of 7/.test(document.getElementById('toasts').textContent)), 'it says so, and which secret it is');
  ok(await ev(() => !!document.querySelector('.egg-glow')), 'a soft gold glow comes in from the edges');
  ok(await ev(() => { const c = document.querySelector('.secret-chip'); return !c.hidden && /1\/7/.test(c.textContent); }), 'the 🗝 counter appears: 1 of 7');
  await unfake();

  /* ---- In the pocket (under reduced motion) ---- */
  await p.emulateMedia({ reducedMotion: 'reduce' }); await wait(2600);
  const PK = await ev(async () => {
    const D = window.__daily; D.T.cursor = 0; await D.play(); const r = {};
    for (let i = 0; i < 12; i++) D.secretTiming(4); D.secretTiming(23); for (let i = 0; i < 12; i++) D.secretTiming(-3);
    r.afterMiss = !!D.CFG.secrets.pocket; for (let i = 0; i < 4; i++) D.secretTiming(2); r.after16 = !!D.CFG.secrets.pocket; r.glow = !!document.querySelector('.egg-glow'); D.stopPlay(true); return r;
  });
  ok(!PK.afterMiss && PK.after16, 'sixteen notes in a row within 10 ms of the beat: In the pocket (a late note starts the count again)');
  ok(!PK.glow, 'with reduced motion there is no glow');
  await p.emulateMedia({ reducedMotion: 'no-preference' });

  /* ---- the hidden line counts too ---- */
  await ev(() => { const tg = document.querySelector('.build-tag'); for (let i = 0; i < 3; i++) tg.click(); }); await wait(300);
  ok(await ev(() => !!window.__daily.CFG.secrets.line && /3\/7/.test(document.querySelector('.secret-chip').textContent)), 'triple-clicking the version (the hidden line) is a secret too: 3 of 7');

  /* ---- Backstage: guest list only, and the password is the build ---- */
  const knock = await ev(() => window.dailyStudio.backstage()); await wait(300);
  ok(/guest list only/.test(knock) && /describe\(\)\.build/.test(knock) && /bottom-right corner/.test(knock), 'knocking says Backstage is guest list only, and where the password is (' + knock.slice(0, 60) + '…)');
  ok(await ev(() => !window.__daily.CFG.backstage && !(document.getElementById('backstage') || {}).open), 'and the door stays shut');
  const wrong = await ev(() => [window.dailyStudio.backstage('letmein'), window.dailyStudio.backstage('1234567'), window.dailyStudio.backstage('nope')]);
  ok(wrong.every(w => /Not on the list/.test(w)) && /seven characters/.test(wrong[2]) && await ev(() => !window.__daily.CFG.backstage), 'a wrong password is turned away, with a stronger hint after a few tries');
  const ans = await ev(() => window.dailyStudio.backstage(window.dailyStudio.describe().build.toUpperCase())); await wait(700);
  const PASS = await ev(() => window.__daily.CFG.bksPass || {});
  ok(/You are on the list/.test(ans) && new RegExp('pass #' + PASS.n).test(ans) && PASS.n >= 1000 && PASS.n <= 9999 && /Secret 4 of 7/.test(ans), 'the build is the password: an all-access pass with a number of its own (' + ans + ')');
  const ROOMS = ['pass', 'engine', 'perf', 'storage', 'bus', 'terminal', 'labs', 'pages', 'made', 'agent', 'secrets'];
  ok(await ev(R => { const d = document.getElementById('backstage'); return !!(d && d.open) && d.classList.contains('bks-hub') && R.every(k => d.querySelector('[data-sec="' + k + '"]')); }, ROOMS), 'Backstage opens with every room: ' + ROOMS.join(', '));
  ok(await ev(n => new RegExp('#' + n).test(document.getElementById('bksPass').textContent) && /ALL ACCESS/.test(document.getElementById('bksPass').textContent), PASS.n), 'the pass shows its number');
  ok(await ev(() => document.querySelectorAll('#bksLive .bks-r').length >= 10 && /Hz/.test(document.getElementById('bksLive').textContent)), 'the engine numbers are live');
  ok(await ev(() => document.querySelectorAll('#bksChain .bks-unit').length >= 16 && /Noise Gate/.test(document.getElementById('bksChain').textContent) && /Reverb/.test(document.getElementById('bksChain').textContent)), 'the engine room shows the guitar’s signal chain, unit by unit, with what each adds');
  await ev(async () => { const D = window.__daily; D.T.cursor = 0; await D.play(); }); await wait(1300);
  ok(await ev(() => { const c = document.getElementById('bksScope'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 150) n++; return n > 200; }), 'the scope draws the sound');
  ok(await poll(() => ev(() => document.querySelectorAll('#bksEv .bks-e').length > 0 && /transport|tick|beat|bar|song/.test(document.getElementById('bksEv').textContent)), 4000), 'the event bus room shows the events the parts send each other, live');
  await ev(() => window.__daily.stopPlay(true));
  ok(await poll(() => ev(() => /Songs/.test(document.getElementById('bksStore').textContent) && /Used by this site/.test(document.getElementById('bksStore').textContent)), 4000), 'the storage room says what this browser keeps');
  ok(await ev(() => /fps/.test(document.getElementById('bksPerf').textContent) || /now/.test(document.getElementById('bksPerf').textContent)), 'the performance room shows frames a second and memory');
  const PG = await ev(async () => { const s = document.getElementById('bksTool'); s.value = 'get_song'; s.onchange(); document.getElementById('bksRun').click(); await new Promise(r => setTimeout(r, 700)); return document.getElementById('bksOut').textContent; });
  ok(/"title":/.test(PG) && /"bpm":/.test(PG), 'the agent playground calls a tool and shows its answer');
  ok(await ev(() => document.querySelectorAll('#backstage .bks-page').length >= 6 && /\/backstage\/source\//.test(document.querySelector('#backstage section[data-sec="pages"]').textContent)), 'the hidden pages are listed, with where they are');

  /* ---- the terminal ---- */
  const sh = async cmd => { await p.fill('#bksTermIn', cmd); await p.press('#bksTermIn', 'Enter'); await wait(250); return ev(() => document.getElementById('bksTermOut').textContent); };
  let T = await sh('help');
  ok(['transpose', 'bpm', 'call', 'labs', 'storage', 'sync', 'export', 'quote', 'open'].every(k => T.includes(k)), 'the terminal: help lists the commands');
  T = await sh('version'); ok(T.includes(await ev(() => window.dailyStudio.describe().app)), 'version says the version and build');
  const bpm0 = await ev(() => window.__daily.S.bpm); T = await sh('bpm 101');
  ok(await ev(() => window.__daily.S.bpm === 101) && /tempo 101 bpm/.test(T), 'bpm 101 sets the tempo, through the same tools an agent has');
  await ev(b => { window.__daily.S.bpm = b; window.__daily.commit(false); }, bpm0);
  T = await sh('quote'); ok(/“.+” — .+/.test(T.split('studio $ quote')[1] || ''), 'quote shows the quote of the day');
  T = await sh('call get_key_chords'); ok(/"key"|key/.test(T.split('studio $ call get_key_chords')[1] || ''), 'call runs an agent tool and prints its answer');
  T = await sh('sudo make me a sandwich'); ok(/already backstage/.test(T), 'and a few words just for fun');
  T = await sh('frobnicate'); ok(/command not found: frobnicate/.test(T), 'an unknown command says so');
  await p.press('#bksTermIn', 'ArrowUp'); ok(await ev(() => document.getElementById('bksTermIn').value === 'frobnicate'), '↑ brings back the last command');
  await p.fill('#bksTermIn', 'tran'); await p.press('#bksTermIn', 'Tab'); ok(await ev(() => document.getElementById('bksTermIn').value === 'transpose '), 'Tab completes a command');
  T = await sh('labs perf on'); ok(await ev(() => !!document.querySelector('.bks-ov') && /fps/.test(document.querySelector('.bks-ov').textContent) && window.__daily.CFG.labs.perf === true), 'labs perf on puts the performance overlay in the corner');
  await sh('labs perf off'); ok(await ev(() => !document.querySelector('.bks-ov')), 'and labs perf off takes it away');
  T = await sh('ls'); ok(/terminal\//.test(T) && /pages\//.test(T), 'ls lists the rooms');

  /* ---- other ways in ---- */
  await ev(() => document.getElementById('backstage').close()); await wait(200);
  const band0 = await ev(() => JSON.stringify(window.__daily.S.band));
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await p.keyboard.press(k);
  await wait(500);
  ok(await ev(() => !!(document.getElementById('backstage') || {}).open && document.activeElement && document.activeElement.id === 'bksTermIn'), '↑ ↑ ↓ ↓ ← → ← → B A opens Backstage at the terminal');
  ok(await ev(() => JSON.stringify(window.__daily.S.band)) === band0, '…and B does not switch the bass off on the way');
  await ev(() => { document.getElementById('backstage').close(); location.hash = '#backstage/storage'; }); await wait(1200);
  ok(await ev(() => !!(document.getElementById('backstage') || {}).open && location.hash === ''), '#backstage/storage in the address opens it (and the address is tidied)');
  await ev(() => { const d = document.getElementById('backstage'); if (d) d.close(); });
  ok(await ev(() => !window.dailyStudio.tools().some(x => x.name === 'backstage') && !window.dailyStudio.describe().tools.includes('backstage')), 'the door is not one of the agent tools');
  await ev(() => { window.__daily.openHelp('backstage'); }); await wait(400);
  ok(await ev(() => !!document.getElementById('helpBackstage')), 'once unlocked, Help has a way back in');
  await ev(() => { const d = document.getElementById('help'); if (d) d.close(); });
  ok(await ev(() => { const c = JSON.parse(localStorage.getItem('fw.cfg') || '{}'); return c.backstage === true && c.bksPass && c.bksPass.n >= 1000 && ['tuned', 'pocket', 'line', 'backstage'].every(k => c.secrets && c.secrets[k]); }), 'the pass and what was found are remembered in this browser');
  ok(await ev(() => window.dailyStudio.backstage()).then(x => /Welcome back, pass #\d{4}/.test(x)), 'knocking again: welcome back, by pass number');
  await wait(300); await ev(() => { const d = document.getElementById('backstage'); if (d) d.close(); });

  /* ---- Labs ▸ Developer handles, without ?debug ---- */
  const q = await t.open({ debug: false });
  ok(await q.evaluate(() => typeof window.__daily === 'undefined'), 'without ?debug there are no developer handles');
  await q.evaluate(() => window.dailyStudio.backstage(window.dailyStudio.describe().build)); await wait(700);
  await q.evaluate(() => { document.getElementById('bksLab-handles').click(); });
  ok(await q.evaluate(() => typeof window.__daily === 'object' && typeof window.__daily.S === 'object'), 'Backstage ▸ Labs ▸ Developer handles puts window.__daily there at once');
  await q.reload(); await wait(3500);
  ok(await q.evaluate(() => typeof window.__daily === 'object'), 'and they are there after a reload, until switched off');
  await q.evaluate(() => { window.dailyStudio.backstage(); }); await wait(700); await q.evaluate(() => document.getElementById('bksLab-handles').click());
  ok(await q.evaluate(() => typeof window.__daily === 'undefined'), 'switching them off takes them away');

  /* ---- the counter's list, and the switch ---- */
  await ev(() => document.querySelector('.secret-chip').click()); await wait(300);
  ok(await ev(() => /4 OF 7/.test(document.getElementById('secretsDlg').textContent) && document.querySelectorAll('#secretsDlg .secret-row.found').length === 4), 'the counter opens the list of secrets');
  await ev(() => { document.getElementById('secretsDlg').close(); const D = window.__daily; D.CFG.eggs = false; D.secretSync(); });
  ok(await ev(() => [...document.querySelectorAll('.secret-chip')].every(c => c.hidden)), 'Settings ▸ Workflow ▸ Hidden surprises off hides the counter');
  ok(await ev(() => /Hidden surprises/.test((() => { window.__daily.openSettings('work'); return document.getElementById('settings').textContent; })())), 'the switch is in Settings ▸ Workflow');
});
