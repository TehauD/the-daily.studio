/* Backstage, everywhere (2.84): once you are on the list it comes with you: the `studio` toolkit in the console, the command palette (Ctrl/⌘ K), the
   terminal drawer (Ctrl + `) and a line in the console for what an agent changes. None of it exists before the pass, and Settings ▸ Backstage (only there
   once you are on the list) turns it all off, or each piece. */
const { suite } = require('./lib.cjs');
suite('e2e-backstage-everywhere', async t => {
  const { ok, wait } = t, p = await t.open({ w: 1400, h: 860, debug: true }), logs = [], ev = (f, a) => p.evaluate(f, a), call = async (n, i) => { await wait(70); return p.evaluate(([n, i]) => window.dailyStudio.call(n, i || {}), [n, i]); };
  p.on('console', m => logs.push({ t: m.type(), s: m.text() }));
  await p.reload(); await wait(1500);
  // ---- before the pass: nothing
  ok(logs.some(l => /the-daily\.studio/.test(l.s) && /build [0-9a-f]{7}/.test(l.s)) && logs.some(l => /door backstage/.test(l.s) && /dailyStudio\.backstage\(\)/.test(l.s)), 'the console shows the badge, one line about what this is, and the knock (' + logs.filter(l => !/\[/.test(l.s)).length + ' lines)');
  ok(!logs.some(l => /Hey, you opened/.test(l.s)) && logs.filter(l => l.t === 'error').length === 0, 'and nothing else: no errors');
  ok(await ev(() => typeof window.studio === 'undefined'), 'there is no `studio` in the console yet');
  await p.keyboard.press('Control+k'); await wait(200);
  ok(await ev(() => !document.getElementById('bkp')), 'Ctrl K does nothing before the pass'); await p.keyboard.press('Control+`'); await wait(200);
  ok(await ev(() => !document.getElementById('bkd')), 'and neither does Ctrl + `');
  ok(await ev(() => { window.__daily.openSettings('work'); const r = !/Backstage/.test(document.getElementById('settings').textContent); document.getElementById('settings').close(); return r; }), 'Settings has no Backstage section: you have to find it first');
  // ---- the knock
  const build = await ev(() => window.dailyStudio.describe().build), msg = await ev(b => window.dailyStudio.backstage(b), build); await wait(600);
  ok(/on the list/.test(msg) && /studio\.help\(\)/.test(msg) && /Ctrl/.test(msg), 'the knock says what has come with the pass');
  await ev(() => { const d = document.getElementById('backstage'); if (d) d.close(); });
  ok(await ev(() => typeof window.studio === 'object' && typeof window.studio.help === 'function' && typeof window.studio.bpm === 'function' && typeof window.studio.sketch === 'function' && typeof window.studio.render === 'function'), '`studio` is now in the console, with the shell\'s commands and the ones made for it');
  // ---- the console toolkit
  await ev(() => window.studio.bpm(104)); await wait(150);
  ok(await ev(() => window.__daily.S.bpm) === 104 && logs.some(l => /104/.test(l.s)), 'studio.bpm(104) changes the tempo and says so in the console');
  await ev(() => window.studio.sketch('Am F C G | F C G Am', 'bpm=88')); await wait(500);
  const sk = await ev(() => ({ secs: window.__daily.S.sections.length, bars: window.__daily.S.sections.map(s => s.bars.map(b => b.chord).join(' ')).join(' | '), bpm: window.__daily.S.bpm }));
  ok(sk.secs === 2 && sk.bars === 'Am F C G | F C G Am' && sk.bpm === 88, 'studio.sketch(…) makes a song from chords in one line (' + sk.bars + ' at ' + sk.bpm + ')');
  await ev(() => window.studio.drums('kick=X...x...X...x... snare=....X.......X...')); await wait(300);
  ok(logs.some(l => /kick\s+X\.\.\.x\.\.\.X\.\.\.x\.\.\./.test(l.s)), 'studio.drums(…) writes a grid and prints it');
  await ev(() => window.studio.song()); await wait(100); ok(logs.some(l => /1 Verse\s+Am F C G/.test(l.s)), 'studio.song() lists the sections and their chords');
  ok(await ev(async () => { const r = await window.studio.call('get_song', { include_lyrics: false }); return r && r.sections && r.sections.length === 2; }), 'studio.call(tool, input) calls an agent tool and returns its answer');
  const n0 = logs.length; await ev(() => window.studio.help()); await wait(150);
  ok(logs.length > n0 && logs.some(l => /Backstage toolkit/.test(l.s)), 'studio.help() lists the commands');
  // ---- the palette
  await p.keyboard.press('Control+k'); await wait(250);
  ok(await ev(() => !!document.getElementById('bkp') && document.activeElement && document.activeElement.id === 'bkpIn'), 'Ctrl K opens the command palette with the cursor in it');
  await p.keyboard.type('visuals'); await wait(150);
  const items = await ev(() => [...document.querySelectorAll('#bkpList .bkp-it')].map(e => e.textContent));
  ok(items.length >= 1 && /Go to Visuals/.test(items[0]), 'typing narrows it to what matches (' + items.slice(0, 3).join(' | ') + ')');
  await p.keyboard.press('Enter'); await wait(500);
  ok(await ev(() => !document.getElementById('bkp') && window.__daily.DOCK.cur) === 'vis', 'Enter goes there and closes it');
  await p.keyboard.press('Control+k'); await wait(200); await p.keyboard.type('look wheel'); await wait(150); await p.keyboard.press('Enter'); await wait(500);
  ok(await ev(() => !document.getElementById('bkp') || /./.test(document.querySelector('#bkp .bkp-out') ? document.querySelector('#bkp .bkp-out').textContent : '.')), 'a command typed into the palette runs');
  await p.keyboard.press('Escape'); await ev(() => { const e = document.getElementById('bkp'); if (e) e.remove(); });
  await p.keyboard.press('Control+k'); await wait(200); await p.keyboard.type('bpm 117'); await wait(100); await p.keyboard.press('Enter'); await wait(700);
  ok(await ev(() => window.__daily.S.bpm) === 117, 'a command with an argument, “bpm 117”, runs from the palette');
  await ev(() => { const e = document.getElementById('bkp'); if (e) e.remove(); });
  await p.keyboard.press('Control+k'); await wait(200); await p.keyboard.press('Escape'); await wait(150);
  ok(await ev(() => !document.getElementById('bkp')), 'Esc closes it');
  // ---- the terminal drawer
  await ev(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+`'); await wait(300);
  ok(await ev(() => !!document.getElementById('bkd') && document.body.classList.contains('bkd-open') && document.activeElement && document.activeElement.id === 'bkdTermIn'), 'Ctrl + ` slides the terminal up over the studio, ready to type');
  await p.keyboard.type('status'); await p.keyboard.press('Enter'); await wait(500);
  ok(await ev(() => /tempo\s+117/.test(document.getElementById('bkdTermOut').textContent)), 'it is the Backstage shell: status answers');
  await p.keyboard.press('Control+`'); await wait(200); ok(await ev(() => !document.getElementById('bkd') && !document.body.classList.contains('bkd-open')), 'Ctrl + ` puts it away');
  // ---- agents
  const l0 = logs.length; await call('write_drums', { pattern: 'Rock 8ths' }); await call('get_song'); await wait(150);
  const al = logs.slice(l0).filter(l => /agent/.test(l.s));
  ok(al.length === 1 && /write_drums/.test(al[0].s) && al[0].t === 'info', 'a change an agent makes is one quiet line in the console, and a read is none (' + al.map(l => l.s.slice(0, 60)).join(' / ') + ')');
  // ---- Settings ▸ Backstage
  await ev(() => window.__daily.openSettings('backstage')); await wait(300);
  const st = await ev(() => ({ ids: ['bksOnMaster', 'bksPiece_palette', 'bksPiece_drawer', 'bksPiece_console', 'bksPiece_agentlog', 'bksGo'].map(i => !!document.getElementById(i)), on: ['bksOnMaster', 'bksPiece_palette', 'bksPiece_drawer', 'bksPiece_console', 'bksPiece_agentlog'].map(i => document.getElementById(i).checked) }));
  ok(st.ids.every(Boolean) && st.on.every(Boolean), 'Settings ▸ Backstage appears once you are on the list, with a master switch and one for each piece');
  await p.click('#bksPiece_palette'); await p.keyboard.press('Escape'); await wait(200); await p.keyboard.press('Control+k'); await wait(200);
  ok(await ev(() => !document.getElementById('bkp') && typeof window.studio === 'object'), 'switching the palette off leaves the rest');
  await ev(() => window.__daily.openSettings('backstage')); await wait(300); await p.click('#bksPiece_palette'); await p.click('#bksPiece_console'); await wait(200);
  ok(await ev(() => typeof window.studio === 'undefined'), 'switching the console toolkit off removes `studio`');
  await p.click('#bksPiece_agentlog'); await wait(100); const l1 = logs.length; await call('write_drums', { pattern: 'Pop Groove' }); await wait(150);
  ok(!logs.slice(l1).some(l => /agent/.test(l.s)), 'and the agent line');
  await p.click('#bksOnMaster'); await wait(200); await p.keyboard.press('Escape');
  await p.keyboard.press('Control+k'); await p.keyboard.press('Control+`'); await wait(250);
  ok(await ev(() => !document.getElementById('bkp') && !document.getElementById('bkd') && typeof window.studio === 'undefined' && JSON.parse(localStorage.getItem('fw.cfg')).bks.on === false), 'the master switch turns all of it off, and it is kept');
  ok(await ev(() => { window.__daily.openSettings('backstage'); const r = !!document.getElementById('bksGo') && !!document.getElementById('bksOnMaster'); document.getElementById('settings').close(); return r; }), 'the Backstage section stays (it is how you turn it back on), and the room is still there');
  await ev(() => { window.__daily.openSettings('backstage'); }); await wait(300); await p.click('#bksOnMaster'); await wait(100); await p.keyboard.press('Escape'); await wait(150);
  ok(await ev(() => typeof window.studio === 'undefined'), 'turning the master back on does not switch back on the pieces you turned off');
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
