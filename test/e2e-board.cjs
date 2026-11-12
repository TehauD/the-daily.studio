/* The rig as a board (2.66): one header row (the tone with ◀ ▶ and a searchable list, A ⇄ B, Save, ⋯, the master), the scenes, the
   board itself (only the pedals on it, in chain order) and the pedal you picked, open and large. Views ◎ Edit, ▦ All, ◉ Stomp. */
const { suite } = require('./lib.cjs');

suite('e2e-board', async t => {
  const { ok, wait } = t;
  const p = await t.open({ w: 1440, h: 900 }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => window.__daily.goalGo('fullrig')); await wait(600);
  const chips = () => ev(() => [...document.querySelectorAll('#pane-rig .cchip.bp')].map(c => c.dataset.id + (c.classList.contains('on') ? '+' : '-')).join(' '));
  const open = () => ev(() => [...document.querySelectorAll('#pane-rig .pedal')].filter(x => x.offsetParent).map(x => x.dataset.id).join());

  /* before the audio starts, the board already shows the tone's pedals */
  ok(/amp\+/.test(await chips()) && !/wah/.test(await chips()), 'before the audio starts, the board shows the tone’s own pedals (' + await chips() + ')');
  ok(await ev(() => document.querySelector('.rigdeck').children.length === 2 && !!document.getElementById('rigPick') && !!document.getElementById('rigSave') && !!document.getElementById('rigMore')), 'the deck is two rows: the tone row and the scenes');
  ok(await ev(() => document.querySelectorAll('.rigdeck .scn.empty').length === 8 && [...document.querySelectorAll('.rigdeck .scn.empty')].every(b => b.getBoundingClientRect().width < 60)), 'empty scene slots are just their numbers');

  await ev(async () => { await window.__daily.startAudio(); }); await wait(1000);
  const A = await chips();
  ok(A === 'comp+ amp+ cab+ reverb+', 'Crystal Clean: Compressor, Amp, Cabinet and Reverb on the board, nothing else (' + A + ')');
  ok((await open()).split(',').length === 1 && await ev(() => window.__daily.CFG.board.view === 'focus'), '◎ Edit: one pedal open, the first on the board (' + await open() + ')');

  await ev(() => document.querySelector('#pane-rig .cchip.bp[data-id="reverb"]').click()); await wait(150);
  ok(await open() === 'reverb', 'clicking a pedal on the board opens it');
  await ev(() => document.querySelector('#pane-rig .cchip.bp[data-id="reverb"] .bp-led').click()); await wait(150);
  ok(await ev(() => !window.__daily.RIG.units.reverb.on) && /reverb-/.test(await chips()), 'its LED bypasses it, and it stays on the board, bypassed');
  await ev(() => document.querySelector('#pane-rig .cchip.bp[data-id="reverb"] .bp-led').click()); await wait(100);

  await p.click('#brdAdd'); await wait(200);
  ok(await ev(() => !document.querySelector('.pop [data-add="amp"]') && !!document.querySelector('.pop [data-add="delay"]')), '＋ Pedal lists only the pedals not on the board, by kind');
  await ev(() => document.querySelector('.pop [data-add="delay"]').click()); await wait(200);
  ok(await ev(() => window.__daily.RIG.units.delay.on) && await open() === 'delay' && /cab\+ delay\+ reverb\+/.test(await chips()), 'it goes on the board in its place in the chain, on, and opens (' + await chips() + ')');

  /* the pedal's ⚙: a label of your own, earlier / later among the board's pedals, off the board */
  await ev(() => document.querySelector('#pane-rig .pedal[data-id="delay"] .pgear').click()); await wait(200);
  await p.fill('#pgLabel', 'Slapback'); await p.press('#pgLabel', 'Enter'); await wait(150);
  ok(await ev(() => /Slapback/.test(document.querySelector('#pane-rig .cchip.bp[data-id="delay"]').textContent) && window.__daily.CFG.board.items.delay.label === 'Slapback'), 'a pedal can be labelled (Slapback), and the label is kept');
  await ev(() => [...document.querySelectorAll('.pop button')].find(b => /Earlier/.test(b.textContent)).click()); await wait(150);
  ok(/amp\+ delay\+ cab\+/.test(await chips()), '⚙ ▸ Earlier steps past the previous pedal on the board, not an unused unit (' + await chips() + ')');
  await p.keyboard.press('Escape'); await wait(150);
  await ev(() => document.querySelector('#pane-rig .pedal[data-id="delay"] .pgear').click()); await wait(200);
  await ev(() => document.getElementById('pgRemove').click()); await wait(200);
  ok(!/delay/.test(await chips()) && await ev(() => !window.__daily.RIG.units.delay.on), '✕ Off the board bypasses it and takes it off');

  /* the tone row */
  await p.click('#rigNext'); await wait(300);
  const t1 = await ev(() => window.__daily.RIG.cur);
  ok(t1 && t1 !== 'Crystal Clean', '▶ steps to the next tone (' + t1 + ')');
  await p.click('#rigPick'); await wait(200); await p.fill('#rigToneQ', 'lagoon'); await p.keyboard.press('Enter'); await wait(400);
  ok(await ev(() => window.__daily.RIG.cur === 'Lagoon Chorus' && /Lagoon Chorus/.test(document.querySelector('.dk-name').textContent)), 'the tone list searches, and Enter loads the first match');
  ok(/chorus\+/.test(await chips()) && /delay\+/.test(await chips()), 'a tone puts its own pedals on the board (' + await chips() + ')');

  /* views */
  await ev(() => document.querySelector('.bv [data-v="board"]').click()); await wait(150);
  ok((await open()).split(',').length === (await chips()).split(' ').length, '▦ All opens every pedal on the board, and only those');
  await ev(() => document.querySelector('.bv [data-v="stomp"]').click()); await wait(150);
  ok(await ev(() => document.querySelector('.board').classList.contains('stompmode') && getComputedStyle(document.querySelector('#pane-rig .chainbar')).display === 'none'), '◉ Stomp: big footswitches, without the small board above them');
  await ev(() => document.querySelector('.bv [data-v="focus"]').click());

  /* save */
  await p.click('#rigSave'); await wait(200); await p.fill('#rigSaveName', 'Gig clean'); await p.click('#rigSaveGo'); await wait(200);
  ok(await ev(() => window.__daily.RIG.cur === 'Gig clean' && window.__daily.store.get('presets', []).some(x => x.n === 'Gig clean')), '💾 Save keeps the tone as one of yours');
});
