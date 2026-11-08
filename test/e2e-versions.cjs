/* Versions, the song journey and where songs are kept (2.56). One person, one browser: mark a version (with a take), change the song and
   remove the take, go back (the take's audio is still there, and what you had is kept as a version), open a version as a song of its own, a
   round of Writing together arriving as a new version, the versions going out with the song to sync, the journey strip and the 🛡 chip. */
const { suite } = require('./lib.cjs');
suite('e2e-versions', async t => {
  const { ok, wait, poll } = t, p = await t.open(); const ev = (fn, a) => p.evaluate(fn, a);
  await ev(async () => {
    const D = window.__daily; await D.projCreate('blank', { form: 'empty' }); D.S.title = 'Harbour Song'; D.S.sections[0].lyrics = 'Lanterns on the harbour wall'; D.S.sections[0].bars[0].chord = 'G'; D.commit(false);
    const dry = new Float32Array(48000).map((_, i) => .3 * Math.sin(i / 20)); D.TAKES.push({ id: 'tkV', kind: 'vox', name: 'Lead vocal', startSec: 1, sr: 48000, g: 1, pan: 0, mode: 'dry', dur: 1, dry, wet: null, cam: [], peaks: D.peaksOf(dry) }); D.bus.emit('takes'); await D.projSave();
  });
  /* the journey and the chip */
  const J0 = await ev(() => ({ steps: window.__daily.jrSteps().map(s => s.k + ':' + (s.on ? 1 : 0)).join(' '), title: document.getElementById('sbJr').title, safe: document.getElementById('sbSafe').textContent }));
  ok(J0.steps === 'words:1 chords:1 rec:1 ver:0 shared:0 done:0' && /Next: a version/.test(await ev(() => document.getElementById('sbJr').textContent)), 'the song journey shows words, chords and recorded done, and the next step: a version (' + J0.steps + ')');
  ok(/Only in this browser/.test(J0.safe), 'beside Saved, the 🛡 chip says honestly that the songs are only in this browser (' + J0.safe.trim() + ')');
  await ev(() => document.getElementById('sbSafe').click()); await wait(300);
  ok(await ev(() => !!document.getElementById('keepDlg')), 'and pressing it opens Keep my songs safe'); await ev(() => document.getElementById('keepDlg').close());
  await ev(() => { window.__daily.CFG.lastBackup = Date.now(); window.__daily.bus.emit('projects'); });
  ok(/Backed up/.test(await ev(() => document.getElementById('sbSafe').textContent)), 'after a backup it says so');

  /* mark a version */
  await ev(() => document.getElementById('sbJr').click()); await wait(200);
  ok(await ev(() => /Song journey/.test(document.getElementById('jrPop').textContent) && /Mark this version/.test(document.getElementById('jrPop').textContent)), 'the journey opens with each step, and how to do the next');
  await ev(() => { const b = [...document.querySelectorAll('#jrPop button')].find(x => /Versions/.test(x.textContent)); b.click(); }); await wait(300);
  await ev(() => { document.getElementById('verName').value = 'Demo 1'; document.getElementById('verNote').value = 'First full pass'; document.getElementById('verMarkBtn').click(); }); await wait(400);
  const V1 = await ev(() => { const v = window.__daily.verList(); return { n: v.length, name: v[0] && v[0].n, note: v[0] && v[0].note, takes: v[0] && v[0].takes.length }; });
  ok(V1.n === 1 && V1.name === 'Demo 1' && V1.note === 'First full pass' && V1.takes === 1, 'Mark this version keeps the song with its take, a name and a note');
  ok(await ev(() => !window.__daily.verChanged() && window.__daily.jrSteps().find(s => s.k === 'ver').t === 'Demo 1'), 'the journey now shows “Demo 1”, and nothing has changed since');

  /* change the song, drop the take, then go back */
  await ev(async () => { const D = window.__daily; D.S.sections[0].lyrics = 'Something else entirely'; D.TAKES.length = 0; D.bus.emit('takes'); D.commit(false); await D.projSave(); });
  ok(await ev(async () => { const D = window.__daily, v = D.verList()[0], m = v.takes[0]; return !!(await D.pdbGet('blobs', D.PRJ.cur + '/take/' + (m.src || m.id) + '/dry')); }), 'with the take deleted from the song, its recording is still kept, because a version uses it');
  await ev(async () => { const D = window.__daily; D.verOpen(); }); await wait(300);
  ok(await ev(() => /Changed since “Demo 1”: Intro: words|Changed since “Demo 1”: .*words/.test(document.getElementById('verDlg').textContent)), 'Versions says what changed since the last one (' + (await ev(() => (document.querySelector('#verDlg .ver-mark p') || {}).textContent || '')).slice(0, 60) + ')');
  await ev(() => [...document.querySelectorAll('#verDlg .ver-item button')].find(b => /Go back/.test(b.textContent)).click());
  ok(await poll(() => ev(() => { const D = window.__daily; return D.S.sections[0].lyrics === 'Lanterns on the harbour wall' && D.TAKES.length === 1 && D.TAKES[0].dry && D.TAKES[0].dry.length === 48000; }), 8000), 'Go back to this: the words and the take, with its audio, are back');
  ok(await ev(() => { const v = window.__daily.verList(); return v.length === 2 && /^Before going back to Demo 1$/.test(v[1].n) && v[1].kind === 'auto' && v[1].song.sections[0].lyrics === 'Something else entirely'; }), 'and what was there before is kept as a version (“Before going back to Demo 1”), so nothing is lost');

  /* open a version as a song of its own */
  const n0 = await ev(() => window.__daily.PRJ.list.length);
  await ev(async () => { const D = window.__daily; await D.verCopy(D.verList()[0]); });
  ok(await poll(() => ev(n0 => { const D = window.__daily; return D.PRJ.list.length === n0 + 1 && D.S.title === 'Harbour Song (Demo 1)' && D.TAKES.length === 1 && D.TAKES[0].dry.length === 48000; }, n0), 8000), 'Open as a copy makes a song of its own, with the version’s take and its audio');

  /* a round of Writing together for a song you have */
  await ev(async () => { const D = window.__daily, r = D.PRJ.list.find(x => x.title === 'Harbour Song'); await D.projLoad(r.id); D.S.collab = { id: 'c-round', with: '', note: '', hist: [['Me', 1, 'started the song']] }; D.commit(false); await D.projSave(); });
  const n1 = await ev(() => window.__daily.PRJ.list.length);
  await ev(() => { const D = window.__daily, s = JSON.parse(JSON.stringify(D.S)); s.sections[0].lyrics = 'Sam wrote a new line'; s.collab = { id: 'c-round', with: 'Sam', note: 'Tried a new first line', hist: [['Me', 1, 'started the song'], ['Sam', 2, 'wrote words for Intro']] }; D.slWelcome(s); }); await wait(300);
  ok(await ev(() => !!document.getElementById('slAsVer') && /You already have “Harbour Song”/.test(document.getElementById('slIn').textContent)), 'a round of a song you have offers: Add as a new version of “Harbour Song”');
  await ev(() => document.getElementById('slAsVer').click());
  ok(await poll(() => ev(n1 => { const D = window.__daily, v = D.verList(), L = v[v.length - 1]; return D.PRJ.list.length === n1 && D.S.sections[0].lyrics === 'Sam wrote a new line' && L && L.n === 'Round from Sam' && L.kind === 'round' && L.note === 'Tried a new first line'; }, n1), 8000), 'it becomes the newest version, “Round from Sam”, with Sam’s note, and no copy is made');
  ok(await ev(() => window.__daily.verList().some(v => v.n === 'Before Sam’s round')), 'and what you had just before is a version too');

  /* sync carries versions */
  ok(await ev(() => { const D = window.__daily, o = D.ghSongOut(D.PRJ.rec); return Array.isArray(o.versions) && o.versions.some(v => v.n === 'Round from Sam') && o.versions.every(v => v.song && v.song.sections); }), 'the song as it goes to your folder or GitHub carries its versions');
});
