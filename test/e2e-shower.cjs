/* Shower mode (2.27; the Shower set in 2.28): hidden (hold the logo two seconds, or type "shower"), one screen of big buttons. The Shower
   set is songs of your own, kept apart from your Songs: added many at once (a playlist file sets the order, .lrc and .txt files beside
   them bring the words), shuffled, repeated, reordered and removed; the next song is split while one plays, so there is no wait; the
   four stems; ● to record yourself, then your take back with the steam. The voice is Chromium's fake microphone and readings fed to
   singStep; the songs are the synthetic backing track the stems tests use, under three names. */
const { suite } = require('./lib.cjs');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');

suite('e2e-shower', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({ w: 1280, h: 800 }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => window.__daily.room('shower'));      /* on the hosted site Shower mode is a room (2.40): load it before reaching into it */
  process.env.BARS = '8'; const SY = require('./stem_synth.cjs'), mono = SY.L.map((x, i) => (x + SY.R[i]) / 2);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shw-')), F = n => path.join(dir, n);
  fs.writeFileSync(F('Harbour Lights.wav'), t.wav(mono, 44100)); fs.writeFileSync(F('Salt Wind.wav'), t.wav(mono.map(x => x * .8), 44100)); fs.writeFileSync(F('Low Tide.wav'), t.wav(mono.map(x => x * .9), 44100));
  fs.writeFileSync(F('Harbour Lights.lrc'), '[ti:Harbour Lights]\n[00:00.50]Walking down to the harbour wall\n[00:03.00]Lights along the water\n[00:06.00]One more light along the shore\n');
  fs.writeFileSync(F('Low Tide.txt'), 'Low tide, low tide\nThe boats are sleeping\nWait for the water');
  fs.writeFileSync(F('shower.m3u'), '#EXTM3U\n#EXTINF:19,Salt Wind\nSalt%20Wind.wav\n#EXTINF:19,Harbour Lights\nfile:///music/Harbour Lights.wav\nLow Tide.wav\n');
  const hold = async (pg, ms) => { const b = await pg.$('header .brand'), bb = await b.boundingBox(); await pg.mouse.move(bb.x + 12, bb.y + 12); await pg.mouse.down(); await wait(ms); await pg.mouse.up(); await wait(500); };
  const open = () => ev(() => { const d = document.getElementById('shower'); return !!(d && d.open); });
  const S = () => ev(() => { const D = window.__daily, nm = id => (D.SHW.set.items.find(x => x.id === id) || {}).title; return { k: D.SHW.k, cur: nm(D.SHW.cur), play: D.SHW.play.map(nm), playing: D.STP.playing, busy: D.SHW.busy }; });
  const nearEnd = () => ev(() => { const D = window.__daily; D.STP.pos = D.STM.dur - .4; return D.spPlay(null, D.STM.dur - .4); });

  /* ---- the parts that read words ---- */
  const L = await ev(() => { const D = window.__daily; return { lrc: D.lrcParse('[ar:Me]\n[offset:+500]\n[00:01.00][00:09.00]Hello <00:01.20>there\n[00:05.5]Again\n'), none: D.lrcParse('just words\nno times'),
    m3u: D.shwPlaylist('#EXTM3U\n/home/me/Music/A%20Song.mp3\n#EXTINF:1,x\nC:\\Music\\B.flac\n', 'm3u'), pls: D.shwPlaylist('[playlist]\nFile1=One.mp3\nTitle1=One\nFile2=sub/Two.ogg\n', 'pls') }; });
  ok(JSON.stringify(L.lrc) === JSON.stringify([[0.5, 'Hello there'], [5, 'Again'], [8.5, 'Hello there']]) && L.none === null, 'timed words (.lrc): stamps in order, a line sung twice, the offset honoured, word stamps dropped; plain text is not mistaken for it');
  ok(L.m3u.join() === 'a song,b' && L.pls.join() === 'one,two', 'playlists (.m3u, .pls) are read by file name, whatever the path');
  const TG = await ev(() => { const D = window.__daily, enc = new TextEncoder();
    const frame = (id, body) => { const b = new Uint8Array(10 + body.length); b.set(enc.encode(id)); const n = body.length; b[4] = n >>> 24; b[5] = (n >> 16) & 255; b[6] = (n >> 8) & 255; b[7] = n & 255; b.set(body, 10); return b; };
    const txt = s => { const t = enc.encode(s); const b = new Uint8Array(t.length + 1); b[0] = 3; b.set(t, 1); return b; };
    const uslt = (() => { const t = enc.encode('First line\nSecond line'); const b = new Uint8Array(1 + 3 + 1 + t.length); b[0] = 3; b.set(enc.encode('eng'), 1); b[4] = 0; b.set(t, 5); return b; })();
    const sylt = (() => { const parts = [3, ...enc.encode('eng'), 2, 1, 0]; [['Hi ', 1000, false], ['there', 1500, false], ['Next', 4000, true]].forEach(([w, ms, nl]) => { parts.push(...enc.encode((nl ? '\n' : '') + w), 0, ms >>> 24, (ms >> 16) & 255, (ms >> 8) & 255, ms & 255); }); return new Uint8Array(parts); })();
    const frames = [frame('TIT2', txt('Tagged')), frame('TPE1', txt('The Band')), frame('USLT', uslt), frame('SYLT', sylt)], len = frames.reduce((a, f) => a + f.length, 0), all = new Uint8Array(10 + len + 8);
    all.set(enc.encode('ID3')); all[3] = 3; all[6] = (len >> 21) & 127; all[7] = (len >> 14) & 127; all[8] = (len >> 7) & 127; all[9] = len & 127; let o = 10; frames.forEach(f => { all.set(f, o); o += f.length; });
    const id3 = D.readTags(all.buffer, { lyrics: true });
    const vc = ['TITLE=Flac Song', 'ARTIST=Someone', 'LYRICS=[00:02.00]Timed in a flac\n[00:04.00]And again'].map(s => enc.encode(s)), vlen = 4 + 4 + vc.reduce((a, c) => a + 4 + c.length, 0), fl = new Uint8Array(4 + 4 + vlen), dv = new DataView(fl.buffer);
    fl.set(enc.encode('fLaC')); fl[4] = 0x84; fl[5] = (vlen >> 16) & 255; fl[6] = (vlen >> 8) & 255; fl[7] = vlen & 255; let q = 8; dv.setUint32(q, 0, true); q += 4; dv.setUint32(q, vc.length, true); q += 4; vc.forEach(c => { dv.setUint32(q, c.length, true); q += 4; fl.set(c, q); q += c.length; });
    return { id3, flac: D.readTags(fl.buffer, { lyrics: true }) }; });
  ok(TG.id3.title === 'Tagged' && TG.id3.lyrics === 'First line\nSecond line' && JSON.stringify(TG.id3.synced) === JSON.stringify([[1, 'Hi there'], [4, 'Next']]), 'words stored in an MP3 are read: plain (USLT) and timed (SYLT), the timed syllables joined into lines (' + JSON.stringify(TG.id3) + ')');
  ok(TG.flac.title === 'Flac Song' && TG.flac.artist === 'Someone' && TG.flac.synced && TG.flac.synced[0][0] === 2, 'and in a FLAC: the title, the artist, and words written as LRC come out timed (' + JSON.stringify(TG.flac) + ')');

  /* ---- hidden ---- */
  ok(await ev(() => !/Shower/i.test(document.body.innerText) && ![...document.querySelectorAll('button,a,[title]')].some(b => /shower/i.test(b.textContent + ' ' + (b.title || '')))), 'nothing in the studio names Shower mode or points to it');
  const home = await ev(async () => { const D = window.__daily; D.S.title = 'My work in progress'; D.commit(false); await D.projSave(); D.T.metro = true; await D.projRefresh(); return { id: D.PRJ.cur, n: D.PRJ.list.length }; });
  await hold(p, 900);
  ok(!(await open()), 'a short press on the logo does nothing');
  await hold(p, 2300);
  ok(await open(), 'holding the logo for two seconds opens Shower mode');
  ok(await ev(() => /You found Shower mode/.test(document.getElementById('toasts').textContent) && !!window.__daily.CFG.shed.found), 'the first time, it says you found it');
  const E0 = await ev(() => ({ empty: !document.querySelector('.shw-empty').hidden && document.querySelectorAll('.shw-empty button').length === 2, play: document.querySelector('.shw-play').disabled, quiet: window.__daily.T.quiet, mic: !!window.__daily.SING.mic }));
  ok(E0.empty && E0.play && E0.quiet && !E0.mic, 'an empty set: Add songs and A folder, the controls wait, the band and the click are silent, and the microphone is closed');

  /* ---- one pick, the whole playlist ---- */
  const t0 = Date.now();
  await p.setInputFiles('#shower .shw-files', ['Harbour Lights.wav', 'Salt Wind.wav', 'Low Tide.wav', 'Harbour Lights.lrc', 'Low Tide.txt', 'shower.m3u'].map(F));
  ok(await poll(() => ev(() => window.__daily.SHW.set.items.length === 3 && !window.__daily.SHW.adding), 15000), 'one pick adds three songs with their words and their playlist, in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s (they are split as they play, not before)');
  const A = await S();
  ok(A.play.join() === 'Salt Wind,Harbour Lights,Low Tide', 'the playlist sets the order: ' + A.play.join(', '));
  ok(await ev(() => { const it = n => window.__daily.SHW.set.items.find(x => x.title === n); return it('Harbour Lights').lyr.synced.length === 3 && it('Harbour Lights').lyr.from === 'lrc' && it('Low Tide').lyr.plain.startsWith('Low tide') && !it('Salt Wind').lyr; }), 'the .lrc beside a song gives timed words, the .txt plain words, and a song with neither has none');
  ok(await ev(async n => { await window.__daily.projRefresh(); return window.__daily.PRJ.list.length === n; }, home.n), 'none of it went into your Songs');
  ok(await poll(() => ev(() => window.__daily.SHW.k === 0 && !window.__daily.SHW.busy && !!window.__daily.STM.ch), 60000), 'the first song is split and ready');
  ok(await poll(() => ev(() => { const D = window.__daily, e = D.SHW.prep.get(D.SHW.play[1]); return !!(e && e.v); }), 60000) && await poll(() => ev(() => /next: Harbour Lights ✓/.test(document.querySelector('.shw-pos').textContent)), 3000), 'the next song is split while this one waits, and the screen says it is ready (✓)');

  /* ---- no gaps ---- */
  await p.click('.shw-play'); ok(await poll(() => ev(() => window.__daily.STP.playing), 5000), '▶ plays the track');
  const tn = Date.now(); await p.click('.shw-next'); await poll(() => ev(() => window.__daily.SHW.k === 1 && window.__daily.STP.playing), 10000); const gap = Date.now() - tn;
  ok(gap < 1500 && (await S()).cur === 'Harbour Lights', '⏭ to a song that is ready: playing again in ' + gap + ' ms, no waiting for the water');
  ok(await poll(() => ev(() => /Walking down to the harbour wall|Lights along the water|One more light/.test(document.querySelector('.shw-cur').textContent)), 8000), 'its timed words come up with the music: ' + await ev(() => document.querySelector('.shw-cur').textContent));
  await poll(() => ev(() => { const D = window.__daily, e = D.SHW.prep.get(D.SHW.play[2]); return !!(e && e.v); }), 60000); await nearEnd();
  ok(await poll(() => ev(() => window.__daily.SHW.k === 2 && window.__daily.STP.playing), 60000), 'at the end of a song the next one starts by itself');
  ok(await ev(() => { const W = window.__daily.SHW.words; return !!W && W.length === 3 && W[0][1] === 'Low tide, low tide' && W.every((w, i) => !i || w[0] >= W[i - 1][0]); }), 'plain words are spread, in order, over where the singer is heard');

  /* ---- the stems ---- */
  const mix = () => ev(() => window.__daily.STM.mix.map(m => (m.m ? 0 : +m.g.toFixed(2))));
  ok((await mix()).join() === '1,1,0.22,1', 'the singer starts as a quiet guide, the rest as recorded (' + (await mix()).join() + ')');
  await p.click('[data-stem="vox"]'); await wait(150);
  ok((await mix())[2] === 0 && await ev(() => document.querySelector('[data-stem="vox"]').getAttribute('aria-pressed') === 'false' && /Singer off/.test(document.querySelector('[data-stem="vox"]').textContent)), 'one tap: the singer is off (karaoke), and the button says so');
  await p.click('[data-stem="vox"]'); await p.click('[data-stem="drums"]'); await wait(150);
  ok((await mix()).join() === '0,1,1,1' && await ev(() => window.__daily.CFG.shed.shw.drums === false), 'the singer back as recorded, the drums off: the choices are remembered for every song');

  /* ---- the set: repeat, shuffle, reorder, remove ---- */
  await p.click('.shw-set'); await wait(200);
  ok(await ev(() => !document.querySelector('.shw-list').hidden && document.querySelectorAll('.shw-ul li').length === 3 && /timed words/.test(document.querySelector('.shw-ul').textContent)), '☰ shows the set: each song, and whether it has words');
  ok(await ev(() => /Repeat all/.test(document.getElementById('shwRepeat').textContent)), 'it repeats the whole set by default');
  await poll(() => ev(() => { const D = window.__daily, e = D.SHW.prep.get(D.SHW.play[0]); return !!(e && e.v); }), 60000); await nearEnd();
  ok(await poll(() => ev(() => window.__daily.SHW.k === 0 && window.__daily.STP.playing), 60000), 'after the last song, back round to the first');
  await p.click('#shwRepeat'); await wait(100);
  ok(await ev(() => window.__daily.SHW.set.repeat === 'one' && /Repeat one/.test(document.getElementById('shwRepeat').textContent)), 'Repeat one');
  await nearEnd();
  ok(await poll(() => ev(() => window.__daily.SHW.k === 0 && window.__daily.STP.playing && window.__daily.spPos() < 3), 8000), 'plays the same song again');
  await p.click('#shwRepeat'); await p.click('#shwShuffle'); await wait(200);
  const SH = await S(); ok(await ev(() => window.__daily.SHW.set.order === 'shuffle' && window.__daily.SHW.set.repeat === 'off') && SH.play[0] === SH.cur && SH.play.length === 3, 'Shuffle keeps the song that is on first, and Play once stops at the end');
  await p.click('#shwShuffle'); await ev(() => { const D = window.__daily, it = D.SHW.set.items.find(x => x.title === 'Low Tide'); return D.shwMove(it.id, -1); });
  ok((await S()).play.join() === 'Salt Wind,Low Tide,Harbour Lights', '↑ moves a song up the set');
  const gone = await ev(async () => { const D = window.__daily, it = D.SHW.set.items.find(x => x.title === 'Harbour Lights'); await D.shwRemove(it.id); return it.id; }); await wait(300);
  ok(await ev(async id => { const D = window.__daily; return D.SHW.set.items.length === 2 && D.SHW.set.hidden.includes('Harbour Lights.wav') && !(await D.pdbGet('blobs', 'shower/a/' + id)); }, gone), '✕ removes a song from the set (and its audio from this browser)');
  await p.setInputFiles('#shower .shw-files', [F('Harbour Lights.wav'), F('Harbour Lights.lrc')]); await poll(() => ev(() => window.__daily.SHW.set.items.length === 3), 15000);
  ok(await ev(() => !window.__daily.SHW.set.hidden.includes('Harbour Lights.wav')), 'and adding it again by hand brings it back');
  await p.setInputFiles('#shower .shw-files', [F('Salt Wind.wav')]); await wait(800);
  ok(await ev(() => window.__daily.SHW.set.items.length === 3), 'the same song twice is added once');
  await p.click('.shw-set'); await wait(150);

  /* ---- recording yourself ---- */
  await poll(() => ev(() => !window.__daily.SHW.busy), 60000);
  await p.click('.shw-rec');
  ok(await poll(() => ev(() => !!window.__daily.SHW.rec && window.__daily.STP.playing), 6000), '● records you over the music');
  await poll(() => ev(() => !document.querySelector('.shw-meter').hidden), 2000);
  const R1 = await ev(() => { const D = window.__daily, tr = D.SING.mic.getAudioTracks()[0]; return { live: tr.readyState === 'live', ec: tr.getSettings().echoCancellation, meter: !document.querySelector('.shw-meter').hidden, main: D.E.hasInput }; });
  ok(R1.live && R1.ec !== false && R1.meter && !R1.main, 'only now is the microphone open, with echo cancellation; the belt meter shows; the studio’s own input stays closed');
  ok(await poll(() => ev(() => document.body.classList.contains('onair')), 2000), 'and the red On air light is on');
  await ev(() => { const D = window.__daily; for (let i = 0; i < 45; i++) D.singStep(67, -14, .1); for (let i = 0; i < 10; i++) D.singStep(62, -28, .1); });
  ok(await ev(() => window.__daily.SING.st.ducks === 1 && window.__daily.SING.st.longest > 4), 'a note held four seconds earns a rubber duck');
  await wait(1200); await p.click('.shw-rec'); await wait(900);
  const C = await ev(() => { const D = window.__daily, tk = document.querySelector('.shw-take'); return { rec: !!D.SHW.rec, card: !tk.hidden && /Longest note/.test(tk.textContent), score: D.SHW.card && D.SHW.card.score, title: D.SHW.card && D.SHW.card.title, take: D.SHW.take ? D.SHW.take.blob.size : 0 }; });
  ok(!C.rec && C.card && C.score > 0 && C.take > 1000, '● again stops recording: a splash score (' + C.score + ', ' + C.title + ') and your take in memory (' + C.take + ' bytes)');
  await p.click('#shwHear');
  ok(await poll(() => ev(() => window.__daily.STP.playing && window.__daily.SHW.hearing > 0), 6000), '▶ Hear it, steamy: the music from where you started, with your take through the bathroom reverb');
  ok(await poll(() => ev(() => !window.__daily.STP.playing && window.__daily.SHW.hearing === 0), 8000), 'it stops when your take does');
  const dl = p.waitForEvent('download', { timeout: 15000 }); await p.click('#shwSave');
  const d1 = await dl.catch(() => null), fp = d1 && await d1.path().catch(() => null);
  ok(!!d1 && /_shower_take\.wav$/.test(d1.suggestedFilename()) && fp && fs.readFileSync(fp).toString('latin1', 8, 12) === 'WAVE', '💾 Keep it: your voice with the steam, as a WAV file (' + (d1 ? d1.suggestedFilename() : 'none') + ')');

  /* ---- leaving puts everything back, at once ---- */
  const tl = Date.now(); await p.click('.shw-x');
  ok(await poll(() => ev(() => !document.getElementById('shower')), 3000), 'leaving is immediate (' + (Date.now() - tl) + ' ms): nothing to re-split');
  const B = await ev(h => { const D = window.__daily; return { mic: !!D.SING.mic, quiet: D.T.quiet, metro: D.T.metro, cur: D.PRJ.cur === h, title: D.S.title, track: !!D.STM.ch, prep: D.SHW.prep.size }; }, home.id);
  ok(!B.mic && !B.quiet && B.metro && B.cur && B.title === 'My work in progress' && !B.track && B.prep === 0, 'the microphone is closed, the band and the click are back, your song is as it was (no track was put in it), and the prepared songs are let go (' + JSON.stringify(B) + ')');
  ok(await ev(async h => { const D = window.__daily; await D.projRefresh(); const r = D.PRJ.list.find(x => x.id === h); return !!r && !r.track; }, home.id), 'and your saved song never got a shower track');

  /* ---- the set is still there next time; type "shower" ---- */
  await ev(() => document.body.focus()); await p.keyboard.type('shower'); await wait(800);
  ok(await open() && await ev(() => !window.__daily.T.rec && !window.__daily.getREC()), 'typing "shower" opens it too, and the R at the end does not arm recording');
  ok(await poll(() => ev(() => window.__daily.SHW.set.items.length === 3 && window.__daily.SHW.play.length === 3), 8000), 'the Shower set is kept on this device');
  await p.keyboard.press('Escape'); await poll(() => ev(() => !document.getElementById('shower')), 5000);
  await ev(() => { const i = document.createElement('input'); i.id = 'tx'; document.body.append(i); i.focus(); }); await p.keyboard.type('shower'); await wait(500);
  ok(!(await open()), 'typing the word into a text box does not');
  await ev(() => document.getElementById('tx').remove());

  /* ---- the shower folder, with folder sync ---- */
  const FD = await ev(async () => {
    const D = window.__daily, root = await navigator.storage.getDirectory(), cloud = await root.getDirectoryHandle('Cloud' + Date.now(), { create: true }); window.__fsDir = async () => cloud;
    await D.fsUse(cloud); const studio = await cloud.getDirectoryHandle('the-daily.studio'), sh = await studio.getDirectoryHandle('shower', { create: true });
    const src = D.SHW.set.items.find(x => x.title === 'Low Tide'), b = await D.pdbGet('blobs', 'shower/a/' + src.id);
    const w = await (await sh.getFileHandle('From Another Computer.wav', { create: true })).createWritable(); await w.write(b.buf); await w.close();
    const w2 = await (await sh.getFileHandle('From Another Computer.lrc', { create: true })).createWritable(); await w2.write('[00:01.00]Sung on the other computer\n[00:03.00]And here too\n'); await w2.close();
    D.showerOpen(); for (let i = 0; i < 100 && !D.SHW.set.items.some(x => x.name === 'From Another Computer.wav'); i++) await new Promise(r => setTimeout(r, 100));
    const it = D.SHW.set.items.find(x => x.name === 'From Another Computer.wav');
    await D.shwAddFiles([new File([b.buf], 'Added Here.wav', { type: 'audio/wav' })]); await new Promise(r => setTimeout(r, 800));
    const names = []; for await (const [n] of sh.entries()) names.push(n);
    document.getElementById('shower').close(); return { came: !!it && it.from === 'folder' && !!it.lyr && it.lyr.synced.length === 2, names };
  });
  ok(FD.came, 'with folder sync on, a song put in the “shower” folder (with its .lrc) comes into the set: the same set on every computer');
  ok(FD.names.includes('Added Here.wav'), 'and a song added here is copied into that folder (' + FD.names.join(', ') + ')');
  await ev(() => window.__daily.syncOff());

  /* ---- on a phone ---- */
  const m = await t.open({ w: 390, h: 844, mobile: true }), mv = (f, a) => m.evaluate(f, a);
  await hold(m, 2300); await wait(500);
  const PH = await mv(() => { const d = document.getElementById('shower'), r = s => document.querySelector(s).getBoundingClientRect(); return { open: !!(d && d.open), wide: d.scrollWidth <= innerWidth, play: r('.shw-play').height, stem: r('.shw-stem').height, x: r('.shw-x').height, add: r('.shw-empty .shw-big').height, fit: r('.shw-rec').right <= innerWidth }; });
  ok(PH.open && PH.wide && PH.play >= 70 && PH.stem >= 56 && PH.x >= 44 && PH.add >= 60 && PH.fit, 'on a phone a long press opens it, everything fits, and every button is big enough for a wet thumb (play ' + Math.round(PH.play) + ' px, stems ' + Math.round(PH.stem) + ' px)');
});
