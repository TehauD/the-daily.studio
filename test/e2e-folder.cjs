/* Folder sync (2.22): two "computers" (browser contexts with their own storage) keep one studio in step through a folder. Each computer's
   folder is a real directory (the browser's origin-private file system, the same File System Access API a picked folder uses), and the
   cloud drive is played by copying one computer's folder to the other's (mirror), sometimes only partly, as a real one does. */
const { suite } = require('./lib.cjs');
const SHEET = '[Verse]\nG        D\nLanterns on the harbour wall\nEm       C\nCalling all the boats back in\n[Chorus]\nC   G   D   Em\nHold on, hold on';

suite('e2e-folder', async t => {
  const { ok, wait, poll } = t, ev = (p, f, a) => p.evaluate(f, a);
  /* the folder picker answers with the stand-in folder; automatic syncs wait (each step below syncs when it means to) */
  const pick = () => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Cloud', { create: true }); window.__syncDelay = 1e9; };
  const A = await t.open({ init: pick }), B = await t.open({ init: pick });
  const nets = []; for (const p of [A, B]) p.on('request', r => { if (!r.url().startsWith(t.BASE) && !/^(data|blob):/.test(r.url())) nets.push(r.url()); });
  /* the cloud drive: every file of one computer's folder, copied over the other's (skip: paths it has not brought yet) */
  const dump = p => ev(p, async () => { const out = {}, walk = async (d, pre) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, pre + n + '/'); else { const u = new Uint8Array(await (await h.getFile()).arrayBuffer()); let b = ''; for (let i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); out[pre + n] = btoa(b); } } };
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle('Cloud', { create: true }), ''); return out; });
  const mirror = async (from, to, skip) => { const files = await dump(from); if (skip) Object.keys(files).forEach(k => { if (skip.test(k)) delete files[k]; });
    await ev(to, async files => { const root = await navigator.storage.getDirectory(); try { await root.removeEntry('Cloud', { recursive: true }); } catch (e) { } const cloud = await root.getDirectoryHandle('Cloud', { create: true });
      for (const [p, b64] of Object.entries(files)) { let d = cloud; const parts = p.split('/'), n = parts.pop(); for (const x of parts) d = await d.getDirectoryHandle(x, { create: true }); const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(Uint8Array.from(atob(b64), c => c.charCodeAt(0))); await w.close(); } }, files); };
  /* the cloud drive bringing some files (matching `re`) without touching the rest; or putting one file in */
  const copyIn = async (from, to, re) => { const files = await dump(from); Object.keys(files).forEach(k => { if (!re.test(k)) delete files[k]; }); for (const [k, b] of Object.entries(files)) await put(to, k, b); return Object.keys(files).length; };
  const put = (p, path, b64) => ev(p, async ({ path, b64 }) => { let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('Cloud', { create: true }); const parts = path.split('/'), n = parts.pop(); for (const x of parts) d = await d.getDirectoryHandle(x, { create: true }); try { const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(Uint8Array.from(atob(b64), c => c.charCodeAt(0))); await w.close(); } catch (e) { const ls = []; for await (const [k, h] of d.entries()) ls.push(k + ':' + h.kind); throw new Error(e.name + ' writing ' + path + ' among ' + ls.join(', ')); } }, { path, b64 });
  const text = (files, p) => files[p] ? Buffer.from(files[p], 'base64').toString('utf8') : null;
  const drop = (p, name, sec, f) => ev(p, async ({ name, b64 }) => !!(await window.__daily.dropTake(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], name, { type: 'audio/wav' }), 'gtr')), { name, b64: t.wav(t.tone(sec, f, { amp: .5 }).data, 22050).toString('base64') });
  const sum = (p, id) => ev(p, async id => { const D = window.__daily, rec = await D.pdbGet('projects', id), out = {}; for (const m of rec.takes) { const a = await D.pdbGet('blobs', id + '/take/' + (m.src || m.id) + '/dry'); out[m.name] = a ? a.length + ':' + a.reduce((s, v, i) => (s + Math.abs(v) * (1 + i % 7)) % 1e9, 0) : null; } return out; }, id);
  const sync = (p, why) => ev(p, async why => { const r = await window.__daily.fsSync(why || 'poll'); return r ? { took: r.took, sent: r.sent, copies: r.copies, gone: r.gone, clash: r.clash || 0, media: r.media || null } : null; }, why);

  /* ---- nothing is written until a folder is chosen ---- */
  await ev(A, () => window.__daily.openSettings('folder')); await wait(400);
  ok(await ev(A, () => !!document.getElementById('syncChoose') && /iCloud Drive, Dropbox, Google Drive or OneDrive/.test(document.querySelector('.sync-ctl').textContent)), 'Settings ▸ Folder sync offers to choose a folder, and says a cloud drive’s folder keeps every computer the same');
  ok(Object.keys(await dump(A)).length === 0, 'nothing is in the folder before one is chosen');

  /* a song with a recording, a second song with a backing track, a preset, a look, a note and settings, on A */
  const S1 = await ev(A, async s => { const D = window.__daily; await D.projCreate('blank', { form: 'empty' }); await window.dailyStudio.call('load_chord_sheet', { text: s }); D.S.title = 'Harbour Song'; await D.projSave(); return D.PRJ.cur; }, SHEET);
  ok(await drop(A, 'First Take.wav', 2, 196), 'a recording is added to the song');
  const S2 = await ev(A, async () => { const D = window.__daily; await D.projSave(); const cur = D.PRJ.cur; await D.projCreate('blank', { form: 'vc' }); D.S.title = 'Night Drive'; await D.projSave(); const id = D.PRJ.cur; await D.projLoad(cur);
    /* a backing track, put straight into the (closed) song's storage */
    const buf = new Uint8Array(30000).map((x, i) => (i * 37) & 255).buffer; await D.pdbPut('blobs', { buf, type: 'audio/mp4', name: 'night drive backing.m4a' }, id + '/track');
    const rec = await D.pdbGet('projects', id); rec.track = { name: 'Night drive backing', title: 'Night drive backing', artist: '', dur: 3, fileName: 'night drive backing.m4a', type: 'audio/mp4', bytes: 30000 }; await D.pdbPut('projects', rec); await D.projRefresh(); return id; });
  await ev(A, () => { const D = window.__daily; D.CFG.lookMode = 'dark'; D.CFG.inDev = 'laptop-mic-id'; D.CFG.rtt = 9.5; localStorage.setItem('fw.presets', JSON.stringify([{ n: 'Warm Clean', d: 'mine', u: { amp: { on: 1, model: 'Clean', gain: .3 } } }]));
    D.CFG.show.saved.push({ id: 'lk1', name: 'Club night', design: 'lasers', ovr: {} }); localStorage.setItem('fw.lessons', JSON.stringify({ 'Harbour Song': 'Slow down the chorus' })); D.saveCfg(); });

  /* ---- choose the folder: the studio is written into it ---- */
  await ev(A, () => document.getElementById('syncChoose').click());
  ok(await poll(() => ev(A, () => !!(window.__daily.CFG.fsync.last && window.__daily.CFG.fsync.last.files) && !window.__daily.SYNC.busy), 15000), 'choosing a folder runs the first sync');
  let FA = await dump(A); const songA = 'the-daily.studio/songs/' + S1 + '.json', sjA = JSON.parse(text(FA, songA) || '{}');
  ok(['studio.json', 'settings.json', 'rig/presets.json', 'stage/looks.json', 'stage/scenes.json', 'notes.json', 'README.md', 'songs/' + S1 + '.json', 'songs/' + S2 + '.json'].every(f => FA['the-daily.studio/' + f]), 'the studio goes into “the-daily.studio” inside the chosen folder: settings, presets, looks, scenes, notes, a README and the songs as text (' + Object.keys(FA).length + ' files)');
  const take = (sjA.takes || [])[0] || {}, wavP = 'the-daily.studio/media/' + S1 + '/' + (take.src || take.id) + '.dry.wav', w = FA[wavP] ? Buffer.from(FA[wavP], 'base64') : null;
  ok(sjA.title === 'Harbour Song' && /Lanterns/.test(text(FA, songA)) && sjA.takes.length === 1 && take.name === 'First Take', 'a song lists its recordings (' + (sjA.takes || []).map(x => x.name).join(', ') + ')');
  ok(w && w.toString('ascii', 0, 4) === 'RIFF' && w.readUInt32LE(4) + 8 === w.length && Math.abs((w.length - 44) / 2 / w.readUInt32LE(24) - 2) < .05, 'each recording is a WAV in media/<song>/, whole and as long as it was recorded (' + (w ? ((w.length - 44) / 2 / w.readUInt32LE(24)).toFixed(2) + ' s' : 'missing') + ')');
  ok(FA['the-daily.studio/media/' + S2 + '/track-30000.m4a'] && Buffer.from(FA['the-daily.studio/media/' + S2 + '/track-30000.m4a'], 'base64').length === 30000, 'a backing track is there as the file that was loaded');
  const setA = text(FA, 'the-daily.studio/settings.json');
  ok(/"lookMode": "dark"/.test(setA) && !/laptop-mic-id|"rtt"|"fsync"|"syncAt"|"sync"/.test(setA), 'settings are there, but not this computer’s own (its microphone, measured latency, the folder’s own state)');
  ok(await ev(A, () => /In step with the folder/.test(document.getElementById('fsStatus').textContent) && /Cloud ▸ the-daily\.studio/.test(document.querySelector('.sync-ctl').textContent)), 'Settings says where the studio is and that it is in step');

  /* ---- the other computer chooses the same folder: the same studio ---- */
  await mirror(A, B);
  await ev(B, () => { window.__daily.CFG.inDev = 'desktop-interface'; window.__daily.saveCfg(); });
  const RB = await ev(B, async () => { const D = window.__daily, r = await D.fsUse(await (await navigator.storage.getDirectory()).getDirectoryHandle('Cloud')); return { took: r.took.length, names: D.PRJ.list.map(x => x.title) }; });
  ok(RB.names.includes('Harbour Song') && RB.names.includes('Night Drive'), 'choosing the same folder on another computer brings its songs (' + RB.names.join(', ') + ')');
  ok(JSON.stringify(await sum(B, S1)) === JSON.stringify(await sum(A, S1)), 'with their recordings, sample for sample (' + JSON.stringify(await sum(B, S1)) + ')');
  ok(await ev(B, async id => { const b = await window.__daily.pdbGet('blobs', id + '/track'); return b && b.buf.byteLength === 30000 && b.name === 'night drive backing.m4a'; }, S2), 'and their backing tracks');
  ok(await ev(B, () => { const D = window.__daily; return D.CFG.lookMode === 'dark' && /Warm Clean/.test(localStorage.getItem('fw.presets')) && D.CFG.show.saved.some(l => l.name === 'Club night') && /Slow down/.test(localStorage.getItem('fw.lessons')) && D.CFG.inDev === 'desktop-interface'; }), 'and the settings, presets, looks and notes, while the computer keeps its own audio interface');
  ok(await ev(B, async id => { const D = window.__daily; await D.projLoad(id); return D.TAKES.length === 1 && D.TAKES[0].dry.length > 40000 && !(D.PRJ_WAIT() || { list: [] }).list.length; }, S1), 'the song opens with its recording, ready to play');

  /* ---- a change on one computer reaches the other, recordings too ---- */
  await ev(B, async () => { const D = window.__daily; D.S.title = 'Harbour Song (live)'; D.commit(false); await D.projSave(); });
  ok(await drop(B, 'Second Take.wav', 1.5, 262), 'the second computer records another take');
  await ev(B, () => window.__daily.projSave()); const R1 = await sync(B, 'auto');
  ok(R1 && R1.sent >= 1 && R1.media && R1.media.wrote >= 1, 'it syncs the change and copies the new recording to the folder (' + JSON.stringify(R1 && R1.media) + ')');
  await mirror(B, A); await ev(A, async id => { await window.__daily.projLoad(id); }, S1);
  const R2 = await sync(A);
  ok(R2 && R2.took.includes('songs/' + S1 + '.json'), 'the first computer takes the change on its next look at the folder');
  ok(await ev(A, () => { const D = window.__daily; return D.S.title === 'Harbour Song (live)' && D.TAKES.length === 2 && D.TAKES.some(x => x.name === 'Second Take' && x.dry.length > 30000); }), 'the open song updates in place, with the new take playable');
  ok(JSON.stringify(await sum(A, S1)) === JSON.stringify(await sum(B, S1)), 'both computers hold the same audio');

  /* ---- recordings that arrive after their song ---- */
  await ev(B, async () => { const D = window.__daily; await D.projCreate('blank', { form: 'empty' }); D.S.title = 'Late Arrival'; await D.projSave(); });
  ok(await drop(B, 'Slow Upload.wav', 1.2, 330), 'a third song with a recording, on the second computer');
  await ev(B, () => window.__daily.projSave()); await sync(B, 'auto'); const S3 = await ev(B, () => window.__daily.PRJ.cur);
  await mirror(B, A, new RegExp('media/' + S3 + '/'));      /* the cloud drive has brought the song's text, not its audio yet */
  const R3 = await sync(A);
  const L1 = await ev(A, async id => { const D = window.__daily; await D.projLoad(id); const r = { takes: (await D.pdbGet('projects', id)).takes.length, loaded: D.TAKES.length, wait: D.PRJ_WAIT().list.length };
    D.S.title = 'Late Arrival (edited)'; D.commit(false); await D.projSave(); r.after = (await D.pdbGet('projects', id)).takes.length; return r; }, S3);
  ok(R3 && R3.media && R3.media.missing >= 1 && /still on the way/.test(await ev(A, () => document.getElementById('fsStatus') ? document.getElementById('fsStatus').textContent : window.__daily.FS.status)), 'a song whose recording has not arrived yet comes in, and the folder status says a recording is still on the way');
  ok(L1.takes === 1 && L1.loaded === 0 && L1.wait === 1 && L1.after === 1, 'it opens without it, and editing and saving the song keeps the recording in it, never dropped (' + JSON.stringify(L1) + ')');
  await sync(A, 'auto'); FA = await dump(A);
  ok(JSON.parse(text(FA, 'the-daily.studio/songs/' + S3 + '.json')).takes.length === 1, 'so the folder still lists it for every computer');
  ok(await copyIn(B, A, new RegExp('media/' + S3 + '/')) >= 1, 'then the cloud drive brings the audio');
  await ev(A, async () => { const D = window.__daily; D.FS.mediaDue = true; }); await sync(A);
  ok(await ev(A, () => { const D = window.__daily; return D.S.title === 'Late Arrival (edited)' && D.TAKES.length === 1 && D.TAKES[0].name === 'Slow Upload' && !D.PRJ_WAIT().list.length; }), 'when the recording arrives, the open song takes it in by itself, with the edit kept');

  /* ---- changed on both computers: both versions are kept ---- */
  await sync(A, 'auto'); await mirror(A, B); await sync(B);
  await ev(A, async id => { const D = window.__daily; await D.projLoad(id); D.S.title = 'Harbour (laptop)'; D.commit(false); await D.projSave(); }, S1);
  await ev(B, async id => { const D = window.__daily; await D.projLoad(id); D.S.title = 'Harbour (desktop)'; D.commit(false); await D.projSave(); }, S1);
  await sync(A, 'auto'); await mirror(A, B); const R4 = await sync(B);
  const CB = await ev(B, () => window.__daily.PRJ.list.map(r => r.title));
  ok(R4 && R4.copies === 1 && CB.includes('Harbour (desktop)') && CB.includes('Harbour (laptop) (from another device)'), 'a song changed on a computer that had not yet seen the other’s change keeps both versions (' + CB.filter(x => /Harbour/.test(x)).join(' · ') + ')');
  const cp = await ev(B, () => (window.__daily.PRJ.list.find(r => /from another device/.test(r.title)) || {}).id);
  ok(cp && (await sum(B, cp))['Second Take'] === (await sum(B, S1))['Second Take'], 'the kept version has its recordings too');
  await sync(B, 'auto'); await mirror(B, A); await sync(A);
  ok(await ev(A, () => { const t = window.__daily.PRJ.list.map(r => r.title); return t.includes('Harbour (desktop)') && t.includes('Harbour (laptop) (from another device)'); }), 'and both computers end up with both');

  /* ---- both computers saved before the cloud drive caught up: it keeps one file, and the other as a "conflicted copy" ---- */
  await ev(A, async id => { const D = window.__daily; await D.projLoad(id); D.S.title = 'Harbour (laptop, late)'; D.commit(false); await D.projSave(); }, S1);
  await ev(B, async id => { const D = window.__daily; await D.projLoad(id); D.S.title = 'Harbour (desktop, late)'; D.commit(false); await D.projSave(); }, S1);
  await sync(A, 'auto'); await sync(B, 'auto');      /* each wrote its own version into its own copy of the folder */
  const mine = (await dump(B))['the-daily.studio/songs/' + S1 + '.json'], clash = 'the-daily.studio/songs/' + S1 + ' (Desktop\'s conflicted copy 2026-11-01).json';
  await mirror(A, B); await put(A, clash, mine); await put(B, clash, mine);      /* the laptop's upload won; the desktop's version sits beside it, on both */
  const K1 = await sync(B), K2 = await sync(A);
  const KB = await ev(B, () => window.__daily.PRJ.list.filter(r => /late/.test(r.title)).map(r => r.id + ':' + r.title).sort()), KA = await ev(A, () => window.__daily.PRJ.list.filter(r => /late/.test(r.title)).map(r => r.id + ':' + r.title).sort());
  ok(K1 && K1.clash === 1 && KB.some(x => x.endsWith(':Harbour (laptop, late)')) && KB.some(x => x.endsWith(':Harbour (desktop, late) (from another device)')), 'the cloud drive’s conflicted copy is kept as a song of its own, so neither computer’s edit is lost (' + KB.map(x => x.split(':')[1]).join(' · ') + ')');
  ok(JSON.stringify(KA) === JSON.stringify(KB), 'the other computer keeps the same two songs, not a second copy of the copy');
  ok(!Object.keys(await dump(A)).some(k => /conflicted copy/.test(k)) && !Object.keys(await dump(B)).some(k => /conflicted copy/.test(k)), 'and the extra file is gone from the folder');
  await put(A, 'the-daily.studio/songs/' + S1 + '-LAPTOP.json', mine);      /* OneDrive's way: a second file named for the song and the computer */
  await sync(A); const KO = await ev(A, () => window.__daily.PRJ.list.filter(r => /late/.test(r.title)).length);
  ok(KO === 2 && await ev(A, id => window.__daily.PRJ.list.find(r => r.id === id).title === 'Harbour (laptop, late)', S1) && !(await dump(A))['the-daily.studio/songs/' + S1 + '-LAPTOP.json'], 'a second file named for another song never replaces that song (OneDrive’s “-LAPTOP” copies)');
  await sync(A, 'auto'); await mirror(A, B); await sync(B);

  /* ---- deleting ---- */
  await ev(A, async id => { await window.__daily.projDelete(id); }, S2); await sync(A, 'auto'); FA = await dump(A);
  ok(!FA['the-daily.studio/songs/' + S2 + '.json'], 'a song deleted on one computer is removed from the folder');
  await mirror(A, B); const R5 = await sync(B);
  ok(R5 && R5.gone === 1 && await ev(B, id => window.__daily.PRJ.list.some(r => r.id === id), S2), 'the other computer keeps its copy (deleting is never passed on blindly), and does not put it back');
  ok(!(await dump(B))['the-daily.studio/songs/' + S2 + '.json'], '…the folder stays without it');

  /* ---- tidy: a recording no song uses goes after a day; nothing else is ever touched ---- */
  await ev(A, async id => { const D = window.__daily; await D.projLoad(id); D.tkDelete(D.TAKES.find(x => x.name === 'First Take')); await D.projSave(); }, S1);
  await ev(A, async () => { const d = await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Cloud')).getDirectoryHandle('the-daily.studio')).getDirectoryHandle('media'), w = await (await d.getFileHandle('my notes.txt', { create: true })).createWritable(); await w.write('mine'); await w.close(); });
  await sync(A, 'auto'); FA = await dump(A); const first = 'the-daily.studio/media/' + S1 + '/' + (take.src || take.id) + '.dry.wav';
  ok(FA[first] && JSON.parse(text(FA, 'the-daily.studio/songs/' + S1 + '.json')).takes.every(m => m.name !== 'First Take'), 'a deleted take leaves the song at once, but its recording stays in the folder for now (a computer still copying may need it)');
  const T2 = await ev(A, async () => { const D = window.__daily, real = Date.now; Date.now = () => real() + 2.2 * 864e5; try { D.FS.mediaDue = true; const r = await D.fsSync('poll'); return r && r.media; } finally { Date.now = real; } });
  FA = await dump(A);
  ok(T2 && T2.tidied >= 1 && !FA[first], 'a day later it is tidied away (' + JSON.stringify(T2) + ')');
  ok(FA['the-daily.studio/media/my notes.txt'] && Object.keys(FA).some(k => k.includes('Second Take') || /\.dry\.wav$/.test(k)), 'files that are not the app’s own, and recordings still in use, are never touched');

  /* ---- never while playing ---- */
  const PL = await ev(A, async () => { const D = window.__daily; window.__syncDelay = 2000; await D.startAudio(); D.T.cursor = 0; await D.play(); D.S.title = 'Changed while playing'; D.commit(false); await D.projSave(); const r = await D.fsSync('auto'); const busy = D.SYNC.busy; D.stopPlay(true); return { r, busy }; });
  ok(PL.r === null && !PL.busy, 'nothing syncs while a song is playing');
  const PG = await poll(async () => /Changed while playing/.test(text(await dump(A), 'the-daily.studio/songs/' + S1 + '.json') || ''), 20000);
  ok(PG, 'and the change goes as soon as it stops'); await ev(A, () => { window.__syncDelay = 1e9; });

  /* ---- also a .daily-song.zip per song, if wanted ---- */
  await ev(A, () => { window.__daily.openSettings('folder'); }); await wait(300);
  await ev(A, () => document.getElementById('syncZips').click());
  ok(await poll(async () => Object.keys(await dump(A)).filter(k => /^[^/]+\.daily-song\.zip$/.test(k)).length >= 2, 15000), 'Also save each song as a .daily-song.zip writes one per song beside the studio folder');

  /* ---- a backup folder chosen before 2.22 ---- */
  const U = await t.open({ init: () => {      /* settings as 2.21 left them (a folder, no sync state), the folder handed in, and every message kept */
    window.__fsDir = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Cloud', { create: true }); window.__syncDelay = 1500; try { localStorage.setItem('fw.cfg', JSON.stringify({ sync: true, syncAt: 1 })); } catch (e) { }
    window.__said = ''; document.addEventListener('DOMContentLoaded', () => { const el = document.getElementById('toasts'); if (el) new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { window.__said += ' |' + n.textContent; }))).observe(el, { childList: true }); }); } });
  ok(await poll(async () => (await dump(U))['the-daily.studio/studio.json'], 15000), 'a backup folder from before becomes a synced studio by itself');
  ok(await poll(() => ev(U, () => window.__daily.CFG.fsync.zips === true && (window.__said.match(/whole studio in step/g) || []).length === 1), 5000), 'and says what changed');
  await ev(U, async () => { const D = window.__daily; await D.projCreate('blank', { form: 'empty' }); D.S.title = 'Old Backup Song'; D.commit(false); await D.projSave(); });
  ok(await poll(async () => Object.keys(await dump(U)).some(k => /^Old-Backup-Song.*\.daily-song\.zip$/.test(k)), 20000), 'and keeps saving each song’s .daily-song.zip, as before');
  await ev(U, () => window.__daily.fsSync('now')); await wait(500);
  ok(await ev(U, () => (window.__said.match(/whole studio in step/g) || []).length === 1 && window.__daily.CFG.fsync.told === true), 'the message is shown once, not on every sync');

  /* ---- a sync's own save never sets off another sync (with the real, short delays) ---- */
  const LOOP = await ev(A, async () => { const D = window.__daily, nap = ms => new Promise(r => setTimeout(r, ms)); window.__syncDelay = 300; await D.fsSync('now'); const at0 = D.SYNC.at; await nap(3000); const at1 = D.SYNC.at;
    D.S.title = 'One real edit'; D.commit(false); await D.projSave(); await nap(1500); const at2 = D.SYNC.at; await nap(3000); const at3 = D.SYNC.at; window.__syncDelay = 1e9; return { idle: at1 === at0, edit: at2 > at1, after: at3 === at2 }; });
  ok(LOOP.idle && LOOP.edit && LOOP.after, 'left alone the studio stays quiet: a sync never sets off another by itself, and a real edit sets off one (' + JSON.stringify(LOOP) + ')');

  /* ---- permission, turning off, the network ---- */
  const PM = await ev(A, async () => { const D = window.__daily, real = D.SYNC.dir; D.SYNC.dir = new Proxy(real, { get: (o, k) => k === 'queryPermission' ? async () => 'prompt' : typeof o[k] === 'function' ? o[k].bind(o) : o[k] }); const r = await D.fsSync('poll'); D.openSettings('folder'); await new Promise(x => setTimeout(x, 300)); const allow = !!document.getElementById('syncAllow'); D.SYNC.dir = real; await D.fsSync('poll'); return { r, allow }; });
  ok(PM.r === null && PM.allow, 'when the browser wants permission again, nothing is read or written and Settings offers Allow access again');
  await ev(A, () => { window.__daily.openSettings('folder'); }); await wait(300); await ev(A, () => document.getElementById('syncOff').click()); await wait(400);
  ok(await ev(A, () => !window.__daily.CFG.sync && !window.__daily.SYNC.dir && !!document.getElementById('syncChoose')) && (await dump(A))['the-daily.studio/studio.json'], 'Turn off stops syncing and leaves the folder as it is');
  ok(nets.length === 0, 'folder sync asks the network for nothing (' + nets.length + ' requests elsewhere' + (nets.length ? ': ' + nets[0] : '') + ')');
});
