/* Your studio on GitHub (2.21): two "devices" (browser contexts with their own storage) keep one private repository in step, through a
   stand-in for GitHub's API (test/fake-github.cjs) so no real account is touched. Also: Sign in with GitHub's return and renewal, and
   sharing looks and rigs to a public repository that the community gallery finds. */
const { suite } = require('./lib.cjs');
const { fake } = require('./fake-github.cjs');
const SHEET = '[Verse]\nG        D\nLanterns on the harbour wall\nEm       C\nCalling all the boats back in\n[Chorus]\nC   G   D   Em\nHold on, hold on';

suite('e2e-github', async t => {
  const { ok, wait, poll } = t, F = fake({ users: { tokA: 'tester', tokNo: 'tester', appTok: 'tester', appTok2: 'tester' }, noCreate: ['tokNo'] });
  const dev = async () => { const p = await t.open({ boot: false }); await F.install(p.ctx); await t.boot(p); return p; };
  const A = await dev();
  const ev = (p, f, a) => p.evaluate(f, a);

  /* ---- nothing goes to GitHub until you connect ---- */
  await ev(A, () => window.__daily.openSettings('github')); await wait(500);
  ok(await ev(A, () => !!document.getElementById('ghConnectBtn') && !document.getElementById('ghSignIn') && /Not connected/.test(document.getElementById('ghStatus').textContent)), 'Settings ▸ GitHub: not connected, with Connect with a token (no Sign in button until the site has its GitHub App)');
  ok(F.calls() === 0, 'nothing has gone to GitHub before connecting (' + F.calls() + ' requests)');
  ok(await ev(A, () => !/\bnull\b|undefined/.test(document.getElementById('ghSec').textContent)), 'the section reads cleanly (no stray “null”)');
  await ev(A, () => { const d = document.getElementById('settings'); if (d) d.close(); });

  /* a song, a preset, a look, a note and a setting, on device A */
  const songId = await ev(A, async () => {
    const D = window.__daily; await D.projCreate('blank', { form: 'empty' });
    return D.PRJ.cur;
  });
  await ev(A, async s => { const D = window.__daily; await window.dailyStudio.call('load_chord_sheet', { text: s }); D.S.title = 'Harbour Song'; D.S.artist = 'The Test Band'; await D.projSave();
    D.CFG.lookMode = 'dark'; D.CFG.inDev = 'my-secret-mic-id'; D.CFG.rtt = 12.5; localStorage.setItem('fw.presets', JSON.stringify([{ n: 'Warm Clean', d: 'mine', u: { amp: { on: 1, model: 'Clean', gain: .3 } } }]));
    D.CFG.show.saved.push({ id: 'lk1', name: 'Club night', design: 'lasers', ovr: {} }); localStorage.setItem('fw.lessons', JSON.stringify({ 'Harbour Song': 'Slow down the chorus' })); D.saveCfg(); }, SHEET);

  /* ---- connect: a private repository is made, and the first sync sends everything ---- */
  const C1 = await ev(A, async () => { const D = window.__daily; try { const r = await D.ghConnect('tokA', 'my-daily-studio'); return { r, err: D.GH.err, cfg: D.CFG.gh }; } catch (e) { return { e: e.message }; } });
  ok(!C1.e && !C1.err && C1.cfg.owner === 'tester' && C1.cfg.repo === 'my-daily-studio', 'connecting with a token finds who you are and your repository (' + JSON.stringify(C1.e || C1.err || C1.cfg.owner) + ')');
  const R = F.repos['tester/my-daily-studio'], files = F.files('tester/my-daily-studio');
  ok(R && R.private === true, 'the repository is made private');
  ok(['studio.json', 'settings.json', 'rig/presets.json', 'stage/looks.json', 'stage/scenes.json', 'notes.json', 'README.md', 'songs/' + (await ev(A, () => window.__daily.PRJ.cur)) + '.json'].every(f => files[f]), 'the first sync sends settings, presets, looks, scenes, notes, the README and the song (' + Object.keys(files).join(', ') + ')');
  const all = Object.values(files).join('\n');
  ok(!/tokA/.test(all) && !/my-secret-mic-id/.test(all) && !/"rtt"/.test(files['settings.json']) && !/"gh"/.test(files['settings.json']) && !/"monitor"/.test(files['settings.json']), 'the token, this device’s audio devices, its measured latency, monitoring and the sync’s own state are never sent');
  ok(/"lookMode": "dark"/.test(files['settings.json']) && /Warm Clean/.test(files['rig/presets.json']) && /Club night/.test(files['stage/looks.json']) && /Slow down the chorus/.test(files['notes.json']), 'your settings, presets, looks and notes are there');
  const songFile = Object.keys(files).find(f => /^songs\//.test(f) && JSON.parse(files[f]).title === 'Harbour Song'), sj = JSON.parse(files[songFile] || '{}');
  ok(sj.title === 'Harbour Song' && Array.isArray(sj.song.sections) && sj.song.sections.length >= 2 && /Lanterns/.test(files[songFile]) && /harbour/i.test(files[songFile]), 'songs go up as readable text: title, sections, chords and words (' + songFile + ')');
  ok(/^\{\n "/.test(files['settings.json']) && Object.keys(JSON.parse(files['settings.json']).settings).join() === Object.keys(JSON.parse(files['settings.json']).settings).sort().join(), 'files are tidy JSON with their keys in order, so changes read well in Git');
  ok(/Harbour Song/.test(files['README.md']), 'the README lists the songs');
  ok(F.commitCount('tester/my-daily-studio') === 2, 'the whole first sync is one commit after GitHub’s own first one (' + F.commitCount('tester/my-daily-studio') + ')');
  ok(!Object.keys(files).some(f => /demo/i.test(files[f] || '') && /^songs\//.test(f) && /Salt Wind/.test(files[f])), 'the demo song nobody touched is not sent');

  /* ---- a quiet auto sync asks GitHub nothing ---- */
  const n0 = F.calls(); const q = await ev(A, () => window.__daily.ghSync('auto'));
  ok(q && q.skipped && F.calls() === n0, 'an automatic sync with nothing changed here does not ask GitHub at all');

  /* ---- device B: connect the same repository, and it all comes in ---- */
  const B = await dev();
  const C2 = await ev(B, async () => { const D = window.__daily; await D.ghConnect('tokA', 'my-daily-studio'); await D.projRefresh(); return { err: D.GH.err, titles: D.PRJ.list.map(r => r.title), theme: D.CFG.lookMode, presets: JSON.parse(localStorage.getItem('fw.presets') || '[]').map(p => p.n), looks: D.CFG.show.saved.map(l => l.name), notes: JSON.parse(localStorage.getItem('fw.lessons') || '{}'), inDev: D.CFG.inDev || '' }; });
  ok(!C2.err && C2.titles.includes('Harbour Song'), 'a second device gets the song (' + C2.titles.join(', ') + ')');
  ok(C2.theme === 'dark' && C2.presets.includes('Warm Clean') && C2.looks.includes('Club night') && C2.notes['Harbour Song'], 'and the settings, presets, looks and notes (' + JSON.stringify({ theme: C2.theme, presets: C2.presets, looks: C2.looks, notes: C2.notes }) + ')');
  ok(C2.inDev !== 'my-secret-mic-id', 'but not the first device’s own audio device');

  /* ---- a change on B reaches A ---- */
  await ev(B, async id => { const D = window.__daily; await D.projLoad(id); D.S.notes = 'Capo on 2 for the live version'; await D.projSave(); await D.ghSync('button'); }, sj.id);
  await ev(A, () => window.__daily.ghSync('button'));
  ok(await ev(A, async id => { const r = await window.__daily.pdbGet('projects', id); return r && r.song.notes === 'Capo on 2 for the live version'; }, sj.id), 'a change made on one device reaches the other');

  /* ---- both change the same song: both versions are kept ---- */
  await ev(A, async id => { const D = window.__daily; await D.projLoad(id); D.S.notes = 'A says: half-time bridge'; await D.projSave(); }, sj.id);
  await ev(B, async id => { const D = window.__daily; await D.projLoad(id); D.S.notes = 'B says: double-time bridge'; await D.projSave(); }, sj.id);
  await ev(A, () => window.__daily.ghSync('button'));
  const BX = await ev(B, async () => { const D = window.__daily, r = await D.ghSync('button'); await D.projRefresh(); return { copies: r && r.copies, titles: D.PRJ.list.map(x => x.title) }; });
  ok(BX.copies === 1 && BX.titles.some(x => /\(from another device\)/.test(x)), 'when both devices changed the same song, both versions are kept (' + BX.titles.join(', ') + ')');
  const f2 = F.files('tester/my-daily-studio'), bothNotes = Object.keys(f2).filter(k => /^songs\//.test(k)).map(k => JSON.parse(f2[k]).song.notes);
  ok(bothNotes.includes('A says: half-time bridge') && bothNotes.includes('B says: double-time bridge'), 'and both reach GitHub');

  /* ---- settings changed on both sides merge key by key ---- */
  await ev(A, () => { const D = window.__daily; D.CFG.metroVol = .33; D.saveCfg(); return D.ghSync('button'); });
  await ev(B, () => { const D = window.__daily; D.CFG.countIn = 2; D.saveCfg(); return D.ghSync('button'); });
  await ev(A, () => window.__daily.ghSync('button'));
  ok(await ev(A, () => window.__daily.CFG.metroVol === .33 && window.__daily.CFG.countIn === 2) && await ev(B, () => window.__daily.CFG.metroVol === .33 && window.__daily.CFG.countIn === 2), 'a setting changed on each device ends up on both');

  /* ---- deleting ---- */
  const del = await ev(A, async () => { const D = window.__daily; const r = D.PRJ.list.find(x => /from another device/.test(x.title)); if (!r) return null; await D.projDelete(r.id); await D.ghSync('button'); return r.id; });
  ok(del && !F.files('tester/my-daily-studio')['songs/' + del + '.json'], 'a song deleted here is removed from GitHub');
  const kept = await ev(B, async id => { const D = window.__daily; await D.ghSync('button'); return { here: !!(await D.pdbGet('projects', id)), gone: D.CFG.gh.gone.includes(id) }; }, del);
  ok(kept.here && kept.gone && !F.files('tester/my-daily-studio')['songs/' + del + '.json'], 'on the other device it is kept (and its history stays in Git), and not sent back');

  /* ---- errors a person can act on ---- */
  const bad = await ev(B, async () => { const D = window.__daily; localStorage.setItem('fw.ghtok', JSON.stringify({ t: 'nope', via: 'token' })); await D.ghSync('button'); const e = D.GH.err; localStorage.setItem('fw.ghtok', JSON.stringify({ t: 'tokA', via: 'token' })); return e; });
  ok(/did not accept the token/.test(bad || ''), 'a token GitHub refuses is named as such (' + bad + ')');
  const nc = await ev(B, async () => { const D = window.__daily; try { await D.ghConnect('tokNo', 'another-repo'); return 'connected?'; } catch (e) { return e.message; } });
  ok(/Create it on GitHub \(private\)/.test(nc), 'a token that may not create the repository says how to make it (' + nc.slice(0, 80) + '…)');
  await ev(B, async () => { const D = window.__daily; await D.ghConnect('tokA', 'my-daily-studio'); });

  /* ---- Sign in with GitHub: the return, and renewal ---- */
  const S = await dev();
  await S.route(/\/auth\/github\/refresh$/, r => r.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: 'appTok2', r: 'ref2', exp: Date.now() + 8 * 3600e3 }) }));
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await ev(S, () => { sessionStorage.setItem('fw.ghState', 'wrong-state'); });
  await S.goto('about:blank'); await S.goto(t.BASE + '?debug#gh=' + enc({ t: 'appTok', r: 'ref1', exp: Date.now() + 3600e3, state: 'abc123' })); await wait(3500);      /* GitHub's redirect is a whole page load, not a jump within the page */
  ok(await ev(S, () => !localStorage.getItem('fw.ghtok') && location.hash === ''), 'a sign-in that comes back with the wrong check is not used, and the address is cleared');
  await ev(S, () => { sessionStorage.setItem('fw.ghState', 'abc123'); sessionStorage.setItem('fw.ghRepo', 'my-daily-studio'); });
  await S.goto('about:blank'); await S.goto(t.BASE + '?debug#gh=' + enc({ t: 'appTok', r: 'ref1', exp: Date.now() - 1000, state: 'abc123' }));
  ok(await poll(() => ev(S, () => { const t = JSON.parse(localStorage.getItem('fw.ghtok') || 'null'); return !!t && t.via === 'app' && location.hash === '' && window.__daily && window.__daily.CFG.gh.owner === 'tester'; }), 12000), 'Sign in with GitHub: the sign-in is taken from the address, checked, kept in this browser and the address cleared');
  ok(await poll(() => ev(S, () => { const t = JSON.parse(localStorage.getItem('fw.ghtok') || 'null'); return t && t.t === 'appTok2' && t.r === 'ref2'; }), 8000), 'an expired sign-in is renewed through the site (' + await ev(S, () => (JSON.parse(localStorage.getItem('fw.ghtok') || '{}')).t) + ')');
  ok(await poll(() => ev(S, () => window.__daily.PRJ.list.some(r => r.title === 'Harbour Song')), 10000), 'and the studio comes in');
  await ev(S, () => { window.__daily.BRAND.ghApp.clientId = 'Iv1.testclient'; window.__daily.BRAND.ghApp.slug = 'the-daily-studio'; window.__daily.ghDisconnect(); window.__daily.openSettings('github'); }); await wait(400);
  ok(await ev(S, () => !!document.getElementById('ghSignIn') && !!document.querySelector('#ghSec a[href*="/apps/the-daily-studio/installations/new"]')), 'with the site’s GitHub App set, Settings offers Sign in with GitHub and the link to give it access');
  ok(await ev(S, () => !localStorage.getItem('fw.ghtok') || localStorage.getItem('fw.ghtok') === 'null'), 'Disconnect removes the token from this browser');

  /* ---- sharing looks and rigs, and the community gallery ---- */
  const SH = await ev(A, async () => { const D = window.__daily; try { return await D.ghShare(['lk1'], ['Warm Clean']); } catch (e) { return { e: e.message }; } });
  const pub = F.repos['tester/daily-studio-shared'], pf = F.files('tester/daily-studio-shared');
  ok(!SH.e && pub && pub.private === false && pub.topics.includes('the-daily-studio'), 'sharing makes a PUBLIC repository of its own, tagged the-daily-studio (' + JSON.stringify(SH.e || SH.url) + ')');
  ok(/Club night/.test(pf['looks.json'] || '') && /Warm Clean/.test(pf['rigs.json'] || '') && !pf['settings.json'] && !Object.keys(pf).some(k => /^songs\//.test(k)), 'only the chosen look and rig are in it: no settings, no songs');
  ok(F.repos['tester/my-daily-studio'].private === true, 'the studio repository stays private');
  /* someone else's shared studio, with things in it that are not allowed */
  F.mkRepo('stranger', 'daily-studio-shared', false, true); F.repos['stranger/daily-studio-shared'].topics = ['the-daily-studio'];
  const evil = { looks: [{ name: '<img src=x onerror=alert(1)>Neon', design: 'lasers', ovr: { col: { a: '#ff00ff' }, use: { back: ['x'] }, junk: 'drop me' } }, { name: 'Bad design', design: 'nope' }] };
  const evilRigs = { presets: [{ n: 'Loud', d: 'x', u: { amp: { on: 1, gain: 99, model: 'NotAModel', extra: 1 }, rocket: { on: 1 } } }] };
  const t0 = F.trees[F.commits[F.repos['stranger/daily-studio-shared'].head].tree];
  const map = Object.assign({}, t0, { 'looks.json': F.putBlob(Buffer.from(JSON.stringify(evil))), 'rigs.json': F.putBlob(Buffer.from(JSON.stringify(evilRigs))) });
  const tr = require('node:crypto').createHash('sha1').update('t' + Math.random()).digest('hex'); F.trees[tr] = map; const cm = 'c' + require('node:crypto').createHash('sha1').update('c' + Math.random()).digest('hex').slice(1); F.commits[cm] = { tree: tr, parents: [], message: 'x' }; F.repos['stranger/daily-studio-shared'].head = cm;
  const G = await ev(B, async () => { const D = window.__daily, g = await D.ghGallery(), x = await D.ghGalleryOpen('stranger', 'daily-studio-shared'); return { total: g.total, owners: g.items.map(i => i.owner), looks: x.looks, rigs: x.rigs }; });
  ok(G.total === 2 && G.owners.includes('tester') && G.owners.includes('stranger'), 'the community gallery finds every studio that shares (' + G.total + ': ' + G.owners.join(', ') + ')');
  ok(G.looks.length === 1 && !('junk' in (G.looks[0].ovr || {})) && !(G.looks[0].ovr && G.looks[0].ovr.use), 'a shared look is cleaned: unknown designs, unknown fields and picture links are dropped');
  ok(G.rigs.length === 1 && G.rigs[0].u.amp.gain <= 1 && !('extra' in G.rigs[0].u.amp) && !G.rigs[0].u.rocket && G.rigs[0].u.amp.model !== 'NotAModel', 'a shared rig is cleaned: settings kept in range, unknown units and values dropped');
  await ev(B, () => window.__daily.ghGalleryShow()); await poll(() => ev(B, () => document.querySelectorAll('#ghGallery .gh-studio').length === 2), 6000);
  ok(await ev(B, () => /2/.test(document.getElementById('ghGalleryCount').textContent)), 'the gallery says how many studios share');
  await ev(B, async () => { const s = [...document.querySelectorAll('#ghGallery .gh-studio')].find(x => x.dataset.repo === 'stranger/daily-studio-shared'); s.querySelector('button').click(); });
  await poll(() => ev(B, () => !!document.querySelector('#ghGallery [data-keep="look"]')), 6000);
  await ev(B, () => { document.querySelector('#ghGallery [data-keep="look"]').click(); document.querySelector('#ghGallery [data-keep="rig"]').click(); });
  const K = await ev(B, () => ({ looks: window.__daily.CFG.show.saved.map(l => l.name), rigs: JSON.parse(localStorage.getItem('fw.presets') || '[]').map(p => p.n), html: document.getElementById('ghGallery').innerHTML }));
  ok(K.looks.some(n => /@stranger$/.test(n)) && K.rigs.some(n => /Loud · @stranger/.test(n)), 'a look and a rig from the gallery can be kept, with who made them (' + K.looks.filter(n => /@/.test(n)).join(', ') + ')');
  ok(!/<img src=x/.test(K.html), 'names from strangers are shown as text, never as markup');
  await ev(A, () => window.__daily.openSettings('github')); await wait(400);
  ok(await ev(A, () => !!document.getElementById('ghSyncNow') && !/\bnull\b|undefined/.test(document.getElementById('ghSec').textContent)), 'connected, the section reads cleanly too (no stray “null”)');

  /* GitHub answers 404 and 409 on purpose in these flows; they are not faults of the page */
  t.errs.splice(0, t.errs.length, ...t.errs.filter(e => !/api\.github\.com|auth\/github/.test(e)));
});
