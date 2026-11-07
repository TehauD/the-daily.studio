/* The guided tours (2.47): they tell the studio as it is now. On a computer: the workspaces and ✦ Simple first, then connecting, the
   beats and the band, writing, recording and tuning, and sending the song; the full studio's steps only outside Simple. On a phone: the
   bottom bar (Words, Sing, Beats, Tracks, More). Every step either points at something on screen or is a centred card, the card is always
   fully on screen, and the tour changes nothing in the song. */
const { suite } = require('./lib.cjs');

suite('e2e-tour', async t => {
  const { ok, wait } = t;
  const walk = async (p) => {
    const before = await p.evaluate(() => JSON.stringify(window.__daily.S.sections));
    await p.evaluate(() => window.__daily.tourStart()); await wait(400);
    const seen = []; let n = 0;
    while (await p.$('#tour') && n < 40) {
      n++; await wait(260);
      seen.push(await p.evaluate(() => { const T = window.__daily.TOUR, st = T.steps[T.i], c = document.querySelector('.tour-card').getBoundingClientRect(), el = st._el;
        const r = el && el.isConnected ? el.getBoundingClientRect() : null;
        return { title: st.title, wanted: !!st.t, found: !!(r && r.width && r.height), card: c.left >= 0 && c.top >= 0 && c.right <= innerWidth + 1 && c.bottom <= innerHeight + 1, text: document.querySelector('.tour-b').textContent }; }));
      await p.keyboard.press('ArrowRight');
    }
    const after = await p.evaluate(() => JSON.stringify(window.__daily.S.sections));
    return { seen, same: before === after, closed: !(await p.$('#tour')) };
  };

  /* a computer, in ✦ Simple (a first visit starts there) */
  const d = await t.open({ w: 1440, h: 900 });
  await d.evaluate(() => { const D = window.__daily; if (!D.CFG.simple) D.simpleSet(true); D.goalGo('songwriter'); }); await wait(500);
  const S = await walk(d), titles = S.seen.map(x => x.title);
  ok(S.closed && S.same, 'the computer tour in Simple walks to the end and leaves the song as it was (' + S.seen.length + ' steps)');
  ok(titles[1] === 'Pick what you want to do' && titles[2] === '✦ Simple' && titles.includes('Connect your input') && titles.includes('Beats and the band') && titles.includes('Record, edit and tune') && titles.includes('Save, send and share'),
    'it tells the studio as it is: workspaces, Simple, connecting, the beats, recording and tuning, sending (' + titles.slice(1, -1).join(' · ') + ')');
  ok(!titles.includes('The Rig and pedalboard') && !titles.includes('Transcribe'), 'in Simple it leaves out the full studio\'s steps');
  const lost = S.seen.filter(x => x.wanted && !x.found).map(x => x.title);
  ok(!lost.length, 'every step finds what it points at' + (lost.length ? ' (missing: ' + lost.join(', ') + ')' : ''));
  ok(S.seen.every(x => x.card), 'the card is fully on screen at every step');
  ok(S.seen.every(x => !/Focusrite|latency chip/.test(x.text)), 'no brand names and nothing that has moved (the latency chip is in the status line since 2.38.1)');

  /* the Full Rig: every step */
  await d.evaluate(() => window.__daily.goalGo('fullrig')); await wait(600);
  const F = await walk(d), ft = F.seen.map(x => x.title), flost = F.seen.filter(x => x.wanted && !x.found).map(x => x.title);
  ok(F.closed && ft.includes('The Rig and pedalboard') && ft.includes('Transcribe') && ft.length > titles.length, 'in the Full Rig the tour has the full studio too (' + ft.length + ' steps against ' + titles.length + ')');
  ok(!flost.length && F.seen.every(x => x.card), 'and every one of its steps finds its target with the card on screen' + (flost.length ? ' (missing: ' + flost.join(', ') + ')' : ''));

  /* a phone */
  const m = await t.open({ w: 390, h: 844, mobile: true });
  const P = await walk(m), pt = P.seen.map(x => x.title), plost = P.seen.filter(x => x.wanted && !x.found).map(x => x.title);
  ok(P.closed && P.same, 'the phone tour walks to the end and leaves the song as it was (' + P.seen.length + ' steps)');
  ok(pt[1] === 'Five sections' && /Words.*Sing.*Beats.*Tracks.*More/.test(P.seen[1].text) && ['Words', 'Beats', 'Sing', 'Tracks', 'More'].every(x => pt.includes(x)), 'it follows the phone\'s bottom bar: Words, Sing, Beats, Tracks and More');
  ok(P.seen.some(x => /🎯 Tune/.test(x.text)) && P.seen.some(x => /Song build/.test(x.text)), 'and shows tuning a take and Song build');
  ok(!plost.length && P.seen.every(x => x.card), 'every phone step finds its target with the card on screen' + (plost.length ? ' (missing: ' + plost.join(', ') + ')' : ''));
});
