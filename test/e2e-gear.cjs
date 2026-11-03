/* Pedal & MIDI sync and the stream window (2.29): a page-turner pedal (keys) and a MIDI footswitch, learned in Settings; MIDI clock out
   on the band's schedule (a stand-in output records what is sent) and clock in; the words window for OBS. */
const { suite } = require('./lib.cjs');

suite('e2e-gear', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({ w: 1280, h: 860 }), ev = (f, a) => p.evaluate(f, a);
  await ev(async () => { const D = window.__daily; await D.startAudio(); await window.dailyStudio.call('load_chord_sheet', { text: '[Verse]\nG        D\nWalking down to the harbour wall\nEm       C\nLights along the water\n[Chorus]\nC        G\nHold on, hold on\nD        Em\nThe tide will bring you home' }); D.S.bpm = 120; D.T.loop = false; D.commit(false); });

  /* ---- Settings ---- */
  await ev(() => window.__daily.openSettings('gear')); await wait(400);
  ok(await ev(() => !!document.getElementById('pedalOn') && document.querySelectorAll('#settings .gear-row').length === 7 && !!document.getElementById('mclkMode') && !/\bnull\b/.test(document.querySelector('#settings .gear').textContent)), 'Settings ▸ Pedal & MIDI sync: the pedal switch, seven actions to learn, and MIDI clock');
  ok(await ev(() => !window.__daily.CFG.pedal.on), 'the pedal is off until you switch it on');
  await p.keyboard.press('PageDown'); await wait(200);
  ok(!(await ev(() => window.__daily.T.playing)), 'so a Page Down does nothing to the studio');
  await p.click('#pedalOn'); await ev(() => document.getElementById('settings').close()); await ev(() => document.body.focus());

  /* ---- a page-turner pedal: keys ---- */
  await p.keyboard.press('PageDown'); await poll(() => ev(() => window.__daily.T.playing), 3000);
  ok(await ev(() => window.__daily.T.playing), 'Page Down (the right pedal, out of the box) plays');
  await p.keyboard.press('ArrowLeft'); await wait(400);
  const NX = await ev(() => ({ cur: window.__daily.T.cursor, ph: window.__daily.playheadSlot(), playing: window.__daily.T.playing, secs: window.__daily.pedalSecs().at }));
  ok(await poll(() => ev(() => window.__daily.T.playing && window.__daily.playheadSlot() >= 4 * window.__daily.spb()), 3000), '← (the left pedal) goes to the next section, still playing (' + JSON.stringify(NX) + ')');
  await p.keyboard.press('PageDown'); await wait(200);
  ok(await ev(() => !window.__daily.T.playing), 'Page Down again stops');
  await ev(() => { const i = document.createElement('input'); i.id = 'tx'; document.body.append(i); i.focus(); }); await p.keyboard.press('PageDown'); await wait(200);
  ok(!(await ev(() => window.__daily.T.playing)), 'in a text box the keys are left alone');
  await ev(() => { document.getElementById('tx').remove(); document.body.focus(); });

  /* ---- learning: a key, then a MIDI footswitch ---- */
  await ev(() => window.__daily.openSettings('gear')); await wait(300);
  await p.click('[data-learn="loop"]'); await wait(100);
  ok(await ev(() => /Step on it/.test(document.querySelector('[data-learn="loop"]').textContent)), 'Learn waits for the pedal');
  await p.keyboard.press('Enter'); await wait(200);
  ok(await ev(() => window.__daily.CFG.pedal.map.loop.includes('k:Enter') && /Enter/.test(document.querySelector('[data-act="loop"]').textContent)), 'a pedal that types Enter is now Loop');
  await p.click('[data-learn="mute"]'); await ev(() => window.__daily.onMidi({ data: [0xB0, 64, 127] })); await wait(150);
  ok(await ev(() => window.__daily.CFG.pedal.map.mute.includes('cc:64') && /MIDI CC 64/.test(document.querySelector('[data-act="mute"]').textContent)), 'and a MIDI sustain pedal (CC 64) is now the band on / off');
  await ev(() => document.getElementById('settings').close()); await ev(() => document.body.focus());
  const loop0 = await ev(() => window.__daily.T.loop); await p.keyboard.press('Enter'); await wait(250);
  ok(await ev(l => window.__daily.T.loop === !l, loop0), 'Enter switches the loop');
  const m0 = await ev(() => window.__daily.bandMuted());
  await ev(() => { window.__daily.onMidi({ data: [0xB0, 64, 127] }); }); await wait(250); await ev(() => window.__daily.onMidi({ data: [0xB0, 64, 0] }));
  ok(await ev(m => window.__daily.bandMuted() === !m, m0), 'stepping on the MIDI pedal mutes the band; letting it up does nothing more');
  await ev(() => { window.__daily.onMidi({ data: [0xB0, 64, 127] }); window.__daily.onMidi({ data: [0xB0, 64, 127] }); }); await wait(250);
  ok(await ev(m => window.__daily.bandMuted() === m, m0), 'a pedal that bounces counts once');

  /* ---- MIDI clock out ---- */
  const C = await ev(async () => {
    const D = window.__daily, log = []; D.MIDI.access = D.MIDI.access || { inputs: new Map(), outputs: new Map(), onstatechange: null };
    const out = { id: 'test-out', name: 'Test drum machine', send: (d, ts) => log.push([d[0], ts == null ? performance.now() : ts]) }; D.MIDI.access.outputs = new Map([['test-out', out]]);
    D.CFG.mclock = { mode: 'send', out: 'test-out' }; D.T.cursor = 0; await D.play(); await new Promise(r => setTimeout(r, 2200)); D.stopPlay(true); await new Promise(r => setTimeout(r, 100));
    const st = log.filter(x => x[0] === 0xFA), clk = log.filter(x => x[0] === 0xF8).map(x => x[1]), stop = log.filter(x => x[0] === 0xFC);
    const gaps = clk.slice(1).map((t, i) => t - clk[i]).sort((a, b) => a - b), med = gaps[Math.floor(gaps.length / 2)];
    return { start: st.length, first: st.length && clk.length ? Math.abs(st[0][1] - clk[0]) : 99, n: clk.length, med, stop: stop.length, order: log.findIndex(x => x[0] === 0xFA) < log.findIndex(x => x[0] === 0xF8) };
  });
  ok(C.start === 1 && C.order && C.first < 1, 'Send: Start goes out once, with the first clock, at the song’s first beat');
  ok(Math.abs(C.med - 60000 / 120 / 24) < 1 && C.n >= 70, 'then 24 clocks a quarter note: ' + C.n + ' clocks, ' + C.med.toFixed(2) + ' ms apart at 120 BPM (20.83 ms)');
  ok(C.stop === 1, 'and Stop when the studio stops');
  const C2 = await ev(async () => { const D = window.__daily, log = []; D.MIDI.access.outputs.get('test-out').send = d => log.push(d); D.T.cursor = 4 * D.spb(); await D.play(); await new Promise(r => setTimeout(r, 400)); D.stopPlay(true); return log.slice(0, 2).map(d => Array.from(d)); });
  ok(C2[0][0] === 0xF2 && (C2[0][1] | (C2[0][2] << 7)) === 64 && C2[1][0] === 0xFB, 'playing from bar 5: Song Position (64 16ths) and Continue instead of Start (' + JSON.stringify(C2) + ')');

  /* ---- MIDI clock in ---- */
  const F = await ev(async () => {
    const D = window.__daily; D.CFG.mclock = { mode: 'follow', out: '' }; D.T.cursor = 0; const t0 = performance.now(), per = 60000 / 96 / 24;
    for (let i = 0; i < 49; i++) D.onMidi({ data: [0xF8], timeStamp: t0 + i * per });
    const bpm = D.S.bpm; D.onMidi({ data: [0xFA] }); await new Promise(r => setTimeout(r, 300)); const playing = D.T.playing; D.onMidi({ data: [0xFC] }); await new Promise(r => setTimeout(r, 100));
    return { bpm, playing, stopped: !D.T.playing };
  });
  ok(F.bpm === 96, 'Follow: incoming clock sets the tempo (96 BPM)');
  ok(F.playing && F.stopped, 'and Start and Stop from the other gear start and stop the studio');
  await ev(() => { window.__daily.CFG.mclock = { mode: 'off', out: '' }; });

  /* ---- the stream window ---- */
  await ev(() => window.__daily.streamRoom()); await wait(300);
  ok(await ev(() => !!document.getElementById('strmOpen') && document.querySelectorAll('#strmBg option').length === 4), 'the stream window’s room: a key colour (green, blue, magenta, black), size, where, chord, next line');
  const popP = p.context().waitForEvent('page'); await p.click('#strmOpen'); const pop = await popP; await wait(400);
  await ev(async () => { const D = window.__daily; D.T.cursor = 0; await D.play(); }); await wait(1500);
  const W = await pop.evaluate(() => ({ line: document.getElementById('sl').textContent, chord: document.getElementById('sc').textContent, bg: getComputedStyle(document.body).backgroundColor }));
  ok(/Walking down to the harbour wall|Lights along the water/.test(W.line) && /^[A-G]/.test(W.chord) && W.bg === 'rgb(0, 177, 64)', 'the window shows the line being sung and the chord, on keying green (' + W.line + ', ' + W.chord + ')');
  await ev(() => { const s = document.getElementById('strmBg'); s.value = 'black'; s.dispatchEvent(new Event('change')); }); await wait(200);
  ok(await pop.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(0, 0, 0)', 'changing the colour changes the window at once');
  await ev(() => window.__daily.stopPlay(true));
  ok(await ev(() => !/stream window/i.test(document.body.innerText.replace(/[\s\S]*Stream window[\s\S]*/, ''))) && await ev(() => typeof window.__daily.streamOpen === 'function'), 'the stream window opens from its own room (Creator Studio and Performer tools)');
  await pop.close();
});
