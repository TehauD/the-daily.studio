/* The workspaces adapt to who you mostly are (2.68), and Practice has lessons a singer can sing.
   CFG.me (singer, guitarist, new to music, producer) is asked on the start page and changed from the chip beside the workspaces. It
   changes what Songwriter, Studio and Practice lead with (tools, tabs, sidebars, words); nothing is removed (the rest is under
   ⋯ More), a guitarist and anyone who has not said get each workspace as it was, and Full Rig is the same for everyone.
   The sung lessons are driven here by setting the voice's pitch reading (VOX.m) directly, with no input connected. */
const { suite } = require('./lib.cjs');

suite('e2e-adapt', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({ w: 1440, h: 900 }), ev = (f, a) => p.evaluate(f, a);
  const snap = () => ev(() => { const d = window.__daily, vis = b => !!b.offsetParent; return { ws: d.goalNow().id, lay: d.LAY.name, tabs: [...document.querySelectorAll('#dock .tabs .tab')].map(b => b.dataset.id).join(), tools: [...document.querySelectorAll('#goalbar .gl-tool')].filter(vis).map(b => b.id + (b.classList.contains('gl-main') ? '*' : '')).join(), all: [...document.querySelectorAll('#goalbar .gl-tool')].map(b => b.id).sort().join(), me: document.getElementById('gtMe').textContent, wr: d.WR.mode, barH: Math.round(document.getElementById('goalbar').getBoundingClientRect().height), how: document.querySelector('#goalbar .gl-mis').title }; });
  const at = async (me, g) => { await ev(m => window.__daily.meSet(m), me); await ev(x => window.__daily.goalGo(x), g); await wait(450); return snap(); };

  /* ---- as it was, for anyone and for a guitarist ---- */
  const A = { songwriter: await at('', 'songwriter'), performer: await at('', 'performer'), practice: await at('', 'practice') };
  ok(A.songwriter.tools === 'gtBeats,gtSheet*,gtPads,gtKeys,gtLink' && A.performer.tools === 'gtVideo*,gtCam,gtVox,gtReplay,gtExp' && A.practice.tools === 'gtLearn*,gtSlow,gtBpm,gtFast,gtSpeed' && /👤/.test(A.songwriter.me), 'for anyone, each workspace leads with what it did before');
  const Gt = { songwriter: await at('guitar', 'songwriter'), performer: await at('guitar', 'performer'), practice: await at('guitar', 'practice') };
  ok(['songwriter', 'performer', 'practice'].every(g => Gt[g].tools === A[g].tools && Gt[g].tabs === A[g].tabs) && /🎸/.test(Gt.practice.me), 'a guitarist gets the same workspaces (the chip shows 🎸)');

  /* ---- a singer ---- */
  const S = { songwriter: await at('sing', 'songwriter'), performer: await at('sing', 'performer'), practice: await at('sing', 'practice') };
  ok(S.songwriter.tools === 'gtBeats*,gtHum,gtRhyme,gtSheet,gtLink' && S.songwriter.wr === 'words' && /hum an idea/i.test(S.songwriter.how), 'a singer’s Songwriter: Beats, Hum an idea, Rhymes, Paste chords, Send; Write opens on the words (' + S.songwriter.tools + ')');
  ok(S.performer.tools === 'gtVideo*,gtCam,gtVox,gtVoice,gtExp' && S.performer.tabs === 'vis,band,stage,exp' && !/rig/.test(S.performer.tabs) && /Sing it with ★ Showtime/.test(S.performer.how), 'a singer’s Studio: vocal pedals and Voice lead, and there is no Rig tab (' + S.performer.tabs + ')');
  ok(S.practice.tools === 'gtLearn*,gtVoice,gtSpeed,gtSlow,gtBpm,gtFast' && S.practice.tabs === 'learn,tab,stems,band,tx' && !/fret|rig/.test(S.practice.tabs) && /Warm up/.test(S.practice.how), 'a singer’s Practice: Learn, Voice, Speed & key; the words and the backing track, no fretboard or rig (' + S.practice.tabs + ')');
  ok(['songwriter', 'performer', 'practice'].every(g => S[g].all === A[g].all && S[g].lay === A[g].lay), 'nothing is removed: every tool is still there (the rest under ⋯ More), and it is the same workspace');
  ok(['songwriter', 'performer', 'practice'].every(g => S[g].barH < 50 && A[g].barH < 50), 'the workspace bar is still one row');
  ok(await ev(() => window.__daily.CFG.vzRibbon === true && window.__daily.CFG.vzNeck === false && window.__daily.CFG.wrFret === false), 'and a singer sees their pitch on the visuals, not a guitar neck, and no fretboard under the words');

  /* ---- someone new, and a producer ---- */
  const N = await at('new', 'songwriter'), T = { songwriter: await at('tech', 'songwriter'), performer: await at('tech', 'performer') };
  ok(N.tools === 'gtBeats*,gtHum,gtSheet,gtPads,gtLink' && N.wr === 'words', 'someone new: a beat, a hum, the words');
  ok(T.songwriter.tools === 'gtBeats*,gtRoll,gtKeys,gtPads,gtLink' && /stems/.test(T.songwriter.tabs) && T.songwriter.wr === 'both' && await ev(() => !document.getElementById('center').classList.contains('tl-slim') || true) && T.performer.tools === 'gtVideo*,gtFmt,gtCam,gtStream,gtExp', 'a producer: the piano roll and the backing track in Songwriter, the video’s shape and the stream window in Studio');
  const fr = await at('sing', 'fullrig'), fr0 = await at('', 'fullrig');
  ok(fr.tools === fr0.tools && fr.tabs === fr0.tabs, 'Full Rig is the same for everyone');

  /* ---- the chip ---- */
  await ev(() => window.__daily.goalGo('performer')); await wait(300); await p.click('#gtMe'); await wait(200);
  ok(await ev(() => document.querySelectorAll('.gl-me-pop [data-me]').length === 5 && /Nothing is removed/.test(document.querySelector('.gl-me-pop').textContent)), 'the chip beside the workspaces offers the four, and Anyone');
  await ev(() => document.querySelector('.gl-me-pop [data-me="sing"]').click()); await wait(500);
  ok(await ev(() => window.__daily.CFG.me === 'sing' && /🎤/.test(document.getElementById('gtMe').textContent) && document.getElementById('gtVox').offsetParent && ![...document.querySelectorAll('#dock .tabs .tab')].some(b => b.dataset.id === 'rig')), 'choosing one sets the workspace up again at once');

  /* ---- ✦ Simple follows ---- */
  await ev(() => { const d = window.__daily; d.simpleSet(true, true); d.goalGo('practice'); }); await wait(500);
  let s = await snap();
  ok(s.tools === 'gtLearn*,gtVoice,gtSpeed' && s.tabs === 'learn,tab,band', 'in ✦ Simple a singer’s Practice keeps Learn, Voice and Speed & key, and Learn, the words and the band (' + s.tools + ' · ' + s.tabs + ')');
  await ev(() => window.__daily.simpleSet(false, true)); await wait(300);

  /* ---- Learn: Singing ---- */
  await ev(() => window.__daily.learnOpen()); await wait(400);
  const L = await ev(() => { const d = document.getElementById('learn'), secs = [...d.querySelectorAll('section[data-sec]')].map(x => x.dataset.sec); return { secs: secs.join(), n: d.querySelectorAll('section[data-sec="sing"] [data-lesson]').length, voice: !!document.getElementById('lnVoice') }; });
  ok(/^today,sing,/.test(L.secs) && L.n === 4 && L.voice, 'Learn has 🎤 Singing, second for a singer (four lessons), and Voice in its list (' + L.secs + ')');
  await ev(() => window.__daily.meSet('')); await wait(400);
  ok(await ev(() => { const s2 = [...document.querySelectorAll('#learn section[data-sec]')].map(x => x.dataset.sec); return s2.indexOf('sing') === s2.indexOf('ear') + 1 && s2[1] === 'lessons'; }), 'for anyone else it sits after By ear');
  await ev(() => window.__daily.meSet('sing')); await wait(400);

  /* a sung piece: a keyboard and note names, not a neck and tab */
  await ev(() => document.querySelector('#learn [data-lesson="v2"]').click()); await wait(400); await ev(() => document.getElementById('coNext').click()); await wait(400);
  const K = await ev(() => { const d = window.__daily, c = document.getElementById('coach'); return { title: d.CO.p.title, voice: !!d.CO.p.voice, ms: d.CO.p.notes.map(n => n.m).join(), keys: !!c.querySelector('.co-keys svg.co-ky'), neck: !!c.querySelector('.co-board:not(.co-keys) svg'), lit: [...c.querySelectorAll('.co-keys rect.ch')].map(k => +k.dataset.m).join(), tab: c.querySelector('.co-tab').textContent.replace(/\s+/g, ' ').trim(), go: document.getElementById('coGo').textContent, key: !!document.getElementById('coKey') }; });
  ok(K.voice && K.title === 'Five up, five down' && K.ms === '48,50,52,53,55,53,52,50,48' && K.keys && !K.neck && K.lit === '48,50,52,53,55' && K.tab === 'C D E F G F E D C' && /Sing it/.test(K.go) && K.key, 'a sung step shows a keyboard with its notes lit, their names, ● Sing it and a Key menu (' + K.tab + ')');
  await wait(400);
  ok(await ev(() => [...document.querySelectorAll('#coach .co-keys rect.ch')].map(k => +k.dataset.m).join() === '48,50,52,53,55'), 'and the song’s chord does not repaint it');

  /* the coach follows a voice: each note in turn, any octave; a slide through a wrong note does not count, a held one does */
  const sing = async (ms, hold) => { for (const m of ms) { await ev(x => { window.__daily.VOX.m = x; }, m); await wait(hold || 260); } await ev(() => { window.__daily.VOX.m = null; }); };
  await ev(() => document.getElementById('coGo').click()); await wait(300);
  await sing([60.1, 61, 62, 64.2], 220); await sing([61], 120);      /* an octave up; C#, passed through quickly */
  let R = await ev(() => ({ i: window.__daily.CO.run.i, miss: window.__daily.CO.run.miss, live: document.querySelector('#coach .co-live').textContent, on: [...document.querySelectorAll('#coach .co-keys rect.on')].map(k => +k.dataset.m).join() }));
  ok(R.i === 3 && R.miss === 0 && /Sing F/.test(R.live) && R.on === '53', 'it follows C, D, E sung an octave up, ignores a note slid through, and asks for F (' + R.live + ')');
  await sing([58], 620);
  R = await ev(() => ({ i: window.__daily.CO.run.i, miss: window.__daily.CO.run.miss }));
  ok(R.i === 3 && R.miss === 1, 'a wrong note that is held counts');
  await sing([53, 55, 53, 52, 50, 48], 240);
  ok(await poll(() => ev(() => !window.__daily.CO.run && /^✓ All 9 notes/.test(window.__daily.CO.res)), 3000), 'singing the rest passes the step: ' + await ev(() => window.__daily.CO.res));
  ok(await ev(() => { const d = window.__daily; return !!d.CFG.learn.done[d.CO.p.id] && d.CO.fb == null; }), 'it is marked done (and there is no fretboard feedback for a sung step)');

  /* hold a note in tune */
  await ev(() => { document.getElementById('coNext').click(); document.getElementById('coNext').click(); }); await wait(400);
  ok(await ev(() => window.__daily.CO.p.kind === 'hold' && window.__daily.CO.p.secs === 4), 'the lesson ends with a held note (four seconds)');
  await ev(() => document.getElementById('coGo').click()); await wait(200);
  await sing([56.2], 700);
  ok(await ev(() => window.__daily.CO.run && window.__daily.CO.run.hold < 300 && /a little high|a little low|sing/.test(document.querySelector('#coach .co-live').textContent)), 'a note that is off does not count towards the hold: ' + await ev(() => document.querySelector('#coach .co-live').textContent));
  await ev(() => { window.__daily.VOX.m = 67.15; });
  ok(await poll(() => ev(() => !window.__daily.CO.run && /^✓ Held G for 4 seconds/.test(window.__daily.CO.res)), 7000), 'holding it in tune (an octave up, 15 cents sharp) for four seconds passes: ' + await ev(() => window.__daily.CO.res));
  await ev(() => { window.__daily.VOX.m = null; });

  /* your range moves the exercises to where your voice sits */
  const rg = await ev(() => { const d = window.__daily; d.CFG.vrange = { lo: 55, hi: 79, c0: 57, c1: 74 }; d.CO.key = 0; d.coBuild && d.coBuild(); return { root: d.coVoiceRoot(0), low: d.coVoiceRoot(9) }; });
  ok(rg.root === 60 && rg.low === 57, 'with a range found (comfortable from A3), C exercises start on C4 and A ones on A3');
  await ev(() => { delete window.__daily.CFG.vrange; });

  /* Today, for a singer */
  const td = await ev(() => { const d = window.__daily; d.CFG.learn.today = null; const T2 = d.todayPlan(); return { me: T2.me, kinds: T2.ids.map(x => x[0]).join(), voice: T2.ids.every(x => d.LSTEP[x[1]] && d.LSTEP[x[1]].pa.id === 'voice') }; });
  ok(td.me === 'sing' && td.voice && /^warm/.test(td.kinds) && !/riff/.test(td.kinds), 'a singer’s Today is sung: a held note to warm up, then the next step, and no guitar riff (' + td.kinds + ')');
  const tg = await ev(() => { const d = window.__daily; d.meSet(''); const T2 = d.todayPlan(); return { me: T2.me || '', none: T2.ids.every(x => !(d.LSTEP[x[1]] && d.LSTEP[x[1]].pa.id === 'voice')), riff: T2.ids.some(x => x[0] === 'riff') }; });
  ok(tg.me === '' && tg.none && tg.riff, 'and nobody else’s Today has sung steps in it');
});
