/* Open a MIDI file as a song: track picker, chords from the other tracks, melody on the lead tab, tempo and time signature,
   karaoke words, format-0 files, and clear messages for files that cannot be opened. Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
const vlq = n => { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; };
const txt = s => [...Buffer.from(s, 'utf8')];
/** an SMF in Node: tracks = arrays of { t, b: [bytes], o } events */
function smf(tracks, o = {}) {
  const trk = ev => { ev = ev.slice().sort((a, b) => a.t - b.t || (a.o || 0) - (b.o || 0)); const d = []; let t = 0; ev.forEach(e => { d.push(...vlq(e.t - t), ...e.b); t = e.t; }); d.push(0, 0xFF, 0x2F, 0); const l = d.length; return [0x4D, 0x54, 0x72, 0x6B, l >>> 24, (l >> 16) & 255, (l >> 8) & 255, l & 255, ...d]; };
  const ppq = o.ppq || 480, fmt = o.fmt == null ? 1 : o.fmt; return Buffer.from([0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, fmt, 0, tracks.length, ppq >> 8, ppq & 255, ...[].concat(...tracks.map(trk))]);
}
const note = (ev, ch, m, v, t, d) => { ev.push({ t, b: [0x90 | ch, m, v], o: 1 }, { t: t + d, b: [0x80 | ch, m, 0], o: 0 }); };
const name = s => ({ t: 0, b: [0xFF, 3, s.length, ...txt(s)] });
function song(o = {}) {
  const PPQ = 480, bars = o.bars || 8, bl = (o.n || 4) * PPQ * 4 / (o.d || 4), us = Math.round(60e6 / (o.bpm || 100));
  const meta = [{ t: 0, b: [0xFF, 0x51, 3, us >> 16 & 255, us >> 8 & 255, us & 255] }, { t: 0, b: [0xFF, 0x58, 4, o.n || 4, Math.log2(o.d || 4), 24, 8] }, name('Conductor')];
  const mel = [name('Melody')], pad = [name('Pad')], bass = [name('Bass')], dr = [name('Drums')];
  const prog = [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]], roots = [36, 41, 43, 36], mn = [64, 65, 67, 64, 65, 69, 67, 67, 72, 71, 67, 62, 60, 62, 64, 60];
  for (let b = 0; b < bars; b++) {
    const t0 = b * bl; prog[b % 4].forEach(m => note(pad, 1, m, 70, t0, bl - 20)); note(bass, 2, roots[b % 4], 90, t0, bl / 2); note(bass, 2, roots[b % 4] + 7, 90, t0 + bl / 2, bl / 2);
    for (let k = 0; k < 4; k++) note(mel, 0, mn[(b * 2 + k) % mn.length], 100, t0 + k * bl / 4, bl / 4 - 10);
    for (let k = 0; k < 8; k++) note(dr, 9, k % 2 ? 42 : 36, 90, t0 + k * bl / 8, 100);
  }
  if (o.words) o.words.forEach((w, i) => mel.push({ t: i * PPQ, b: [0xFF, 0x05, ...vlq(w.length), ...txt(w)] }));
  return { meta, mel, pad, bass, dr };
}
suite('e2e-midi', async t => {
  const { ok, wait, poll } = t, p = await t.open();
  const send = (buf, nm) => p.evaluate(({ b64, nm }) => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); window.__r = window.__daily.dropFiles([new File([u], nm, { type: 'audio/midi' })]); return true; }, { b64: buf.toString('base64'), nm });
  const toastText = () => p.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent).join(' | '));

  // a four-track file: the dialog proposes the melody and the chord tracks
  const s = song({ words: ['Walk', 'ing ', 'down ', 'the ', 'road ', '/Sing', 'ing ', 'as ', 'we ', 'go '] });
  await send(smf([s.meta, s.mel, s.pad, s.bass, s.dr]), 'Walking Song.mid');
  ok(await poll(() => p.$('#smfDlg'), 6000), 'dropping a .mid file opens a window instead of an error');
  const rows = await p.$$eval('#smfDlg .smf-r[data-id]', r => r.map(x => ({ name: x.querySelector('.smf-n').textContent, mel: x.querySelector('input[type=radio]').checked, chk: [...x.querySelectorAll('input[type=checkbox]')].map(c => c.checked) })));
  ok(rows.length === 3 && rows.find(r => r.name === 'Melody' && r.mel), 'the pitched tracks are listed and the melody is chosen for you ' + JSON.stringify(rows.map(r => r.name + (r.mel ? '*' : ''))));
  ok(rows.filter(r => !r.mel).every(r => r.chk[0] === true) && !rows.some(r => /Drums/.test(r.name)), 'the other tracks are ticked for chords and the drum track is not offered');
  ok(/100 BPM/.test(await p.$eval('#smfDlg', d => d.textContent)) && /4\/4/.test(await p.$eval('#smfDlg', d => d.textContent)), 'the window shows the file’s tempo and time signature');
  await p.click('#smfGo'); ok(await poll(() => p.evaluate(() => window.__daily.S.title === 'Walking Song'), 8000), 'Create song makes a new song named after the file');
  const r = await p.evaluate(() => { const d = window.__daily, S = d.S; return { bpm: S.bpm, ts: S.ts, key: S.key, minor: S.minor, bars: S.sections.reduce((a, x) => a + x.bars.length, 0), chords: S.sections[0].bars.map(b => b.chord).join('|'), tab: S.sections.reduce((a, x) => a + x.bars.reduce((c, b) => c + b.tab.length, 0), 0), lyr: S.sections[0].lyrics, lead: S.band.leadOn, proj: !!d.PRJ.cur }; });
  ok(r.bpm === 100 && r.ts[0] === 4 && r.ts[1] === 4 && r.key === 0 && !r.minor && r.bars === 8, 'tempo, time signature, key and length come from the file ' + JSON.stringify([r.bpm, r.ts, r.key, r.minor, r.bars]));
  ok(r.chords === 'C|F|G|C|C|F|G|C', 'the chords are worked out from the pad and bass (' + r.chords + ')'); ok(r.tab >= 28, 'the melody is on the lead tab (' + r.tab + ' notes)'); ok(/Walk/.test(r.lyr) && /\n/.test(r.lyr), 'karaoke words are placed as lines'); ok(r.lead && r.proj, 'the band is on and the song is saved as a new song');
  await t.wait(300); ok(/Opened/.test(await toastText()), 'a message says what was made');

  // melody only: chords are suggested from the melody, in the key of the file
  const m1 = song({ bars: 4 }); await send(smf([m1.meta, m1.mel]), 'Tune.mid'); await poll(() => p.$('#smfDlg'), 6000); await p.click('#smfGo'); await poll(() => p.evaluate(() => window.__daily.S.title === 'Tune'), 8000);
  const c1 = await p.evaluate(() => window.__daily.S.sections[0].bars.map(b => b.chord)); ok(c1.length === 4 && c1.every(x => x && /^[A-G]/.test(x)), 'a melody-only file gets chords worked out from the notes (' + c1.join(' | ') + ')');

  // 3/4 and another tempo, a format-0 file with running status
  const w = song({ bars: 4, n: 3, d: 4, bpm: 120 }); await send(smf([w.meta, w.mel, w.pad]), 'Waltz.mid'); await poll(() => p.$('#smfDlg'), 6000); await p.click('#smfGo'); await poll(() => p.evaluate(() => window.__daily.S.title === 'Waltz'), 8000);
  ok(await p.evaluate(() => { const S = window.__daily.S; return S.bpm === 120 && S.ts[0] === 3 && S.ts[1] === 4 && S.sections[0].bars.length === 4; }), 'a 3/4 file at 120 BPM opens as a waltz');
  const f0 = []; [...w.meta, ...w.mel, ...w.pad].forEach(e => f0.push(e)); await send(smf([f0], { fmt: 0 }), 'Single.mid');
  ok(await poll(() => p.$('#smfDlg'), 6000) && (await p.$$('#smfDlg .smf-r[data-id]')).length === 2, 'a one-track (format 0) file is split by channel'); await p.click('#smfDlg button:has-text("Cancel")'); await wait(300);
  const body = [0, 0x90, 60, 90, 0x60, 62, 90, 0x60, 64, 90, 0x60, 60, 0, 0x60, 62, 0, 0x60, 64, 0, 0, 0xFF, 0x2F, 0];   // running status: only the first event carries its status byte
  const run = Buffer.from([0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xE0, 0x4D, 0x54, 0x72, 0x6B, 0, 0, 0, body.length, ...body]);
  const rn = await p.evaluate(b64 => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), m = window.__daily.smfParse(u.buffer); return m.tracks[0].notes.map(n => [n.m, n.t, n.d].join(':')); }, run.toString('base64'));
  ok(rn.join(' ') === '60:0:288 62:96:288 64:192:288', 'running status and note-off-as-velocity-zero are read correctly (' + rn.join(' ') + ')');

  // things that cannot be opened say so plainly
  await send(Buffer.from([0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0xE7, 0x28]), 'Smpte.mid'); await wait(600); ok(/frames \(SMPTE\)/.test(await toastText()), 'a time-code (SMPTE) file is explained');
  await send(Buffer.from('not a midi file at all'), 'Fake.mid'); await wait(600); ok(/not a MIDI file/.test(await toastText()), 'a file that is not MIDI is explained');
  const d0 = song({ bars: 2 }); await send(smf([d0.meta, d0.dr]), 'Drums.mid'); await wait(700); ok(/drums only|no notes/.test(await toastText()), 'a drums-only file says why it cannot become a song');
  ok(!(await p.$('#smfDlg')), 'no window is left open after those');

  // the New song window takes a MIDI file too (choose or drop), instead of trying to read it as audio
  const nm = song({ bars: 4 }); const file = t.tmp('Choose Me.mid', smf([nm.meta, nm.mel, nm.pad]));
  await p.evaluate(() => document.querySelector('.sb-new').click()); ok(await poll(() => p.$('.pd-drop'), 5000), 'the New song window opens');
  ok(/audio or MIDI/.test(await p.$eval('.pd-drop .pd-go', b => b.textContent)), 'its song card offers “audio or MIDI file”');
  await p.setInputFiles('.pd-drop input[type=file]', file); ok(await poll(() => p.$('#smfDlg'), 6000), 'choosing a MIDI file there opens the track picker');
  await p.click('#smfGo'); ok(await poll(() => p.evaluate(() => /Choose Me/.test(window.__daily.S.title)), 8000), 'and creates the song');
});
