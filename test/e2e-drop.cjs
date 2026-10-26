/* Drop anywhere: audio chooser, lyrics, bundles, rig files, the empty-page drop row. Runs in its own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-drop', async t => {
  const { ok, wait, BASE } = t, freshCtx = () => t.fresh();
  // v2.1 · drop anywhere
  { const dp = await (await freshCtx()).newPage(), de = []; dp.on('pageerror', e => de.push(e.message));
    await dp.addInitScript(() => { window.__gum = 0; const md = navigator.mediaDevices, g = md.getUserMedia.bind(md); md.getUserMedia = c => { if (c && (c.audio || c.video)) window.__gum++; return g(c); }; });
    await dp.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'debug'); await wait(3500);
    await dp.evaluate(() => document.getElementById('bootNoMic').click()); await wait(2000);
    await dp.evaluate(() => { const b = document.querySelector('#tourOffer .btn:not(.primary)'); if (b) b.click(); const hb = document.getElementById('humbar'); if (hb) hb.remove(); });
    // helper: send a drag/drop of generated files at an element
    await dp.evaluate(() => {
      window.__wav = (sec, f) => { const sr = 22050, n = Math.floor(sr * sec), b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * (f || 220) * i / sr) * 9000), true); return b; };
      window.__fire = (type, files, target) => { const dt = new DataTransfer(); files.forEach(f => dt.items.add(f)); const ev = new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }); (target || document.body).dispatchEvent(ev); return ev.defaultPrevented; };
    });
    ok(await dp.evaluate(() => { const r = document.getElementById('tlDrop'); return !!r && !r.hidden && /Drop audio, lyrics, MIDI or a song file/.test(r.textContent) && !!r.querySelector('#dropPick') && !!r.querySelector('#dropMemo'); }), 'empty arrangement shows the drop row with Choose a file… and Voice memo');
    ok(await dp.evaluate(() => { const D = window.__daily, k = n => D.dropKind({ name: n, type: '' }); return [k('a.mp3'), k('b.WAV'), k('c.m4a'), k('d.txt'), k('e.lrc'), k('f.md'), k('g.zip'), k('h.json'), k('i.mid'), k('j.exe'), k('k.mp4'), D.dropKind({ name: 'x', type: 'audio/ogg' })].join(); }) === 'audio,audio,audio,lyrics,lyrics,lyrics,bundle,json,midi,other,audio,audio', 'files are classified by name and type');
    // overlay on drag over, gone after leave
    const pre = await dp.evaluate(() => { window.__fire('dragenter', [new File(['x'], 'a.wav')]); const prevented = window.__fire('dragover', [new File(['x'], 'a.wav')]); const ov = document.getElementById('dropOv'); return { prevented, on: !!ov && ov.classList.contains('on'), txt: ov ? ov.textContent : '' }; });
    ok(pre.prevented && pre.on && /Drop to add it here/.test(pre.txt), 'dragging a file over the page shows the drop overlay (and accepts the drop)');
    ok(await dp.evaluate(() => { const ev = new DragEvent('dragleave', { bubbles: true, relatedTarget: null }); document.body.dispatchEvent(ev); return !document.getElementById('dropOv').classList.contains('on'); }), 'leaving the window hides the overlay');
    ok(await dp.evaluate(() => { const dt = new DataTransfer(); const ev = new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }); document.body.dispatchEvent(ev); return !ev.defaultPrevented && !document.getElementById('dropOv').classList.contains('on'); }), 'an in-app drag (no files) is left alone');
    // unsupported file: toast, nothing else, page not navigated
    const bad = await dp.evaluate(async () => { const pv = window.__fire('drop', [new File(['MZ'], 'setup.exe')]); await new Promise(r => setTimeout(r, 200)); return { pv, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join('|'), dlg: !!document.getElementById('dropDlg') }; });
    ok(bad.pv && /not something the-daily\.studio can open/.test(bad.toast) && !bad.dlg, 'an unsupported file gets a plain explanation and the page stays put');
    // lyrics
    await dp.evaluate(() => { window.__fire('drop', [new File(['[Verse 1]\nLate night, city lights\n\n[Chorus]\nI just wanna be right here'], 'my words.txt', { type: 'text/plain' })]); }); await wait(500);
    ok(await dp.evaluate(() => { const ta = document.querySelector('.lyi-ta'); return !!ta && /Late night, city lights/.test(ta.value); }), 'a dropped .txt opens the lyrics import with its text');
    await dp.keyboard.press('Escape'); await wait(200);
    // audio → chooser
    await dp.evaluate(async () => { const f = new File([window.__wav(2.5, 220)], 'Morning Sketch.wav', { type: 'audio/wav' }); window.__fire('drop', [f]); }); await wait(500);
    const ch = await dp.evaluate(() => { const d = document.getElementById('dropDlg'); return d ? { t: d.querySelector('.dlg-h').textContent, k: [...d.querySelectorAll('.drop-opt')].map(b => b.dataset.k + (b.disabled ? '!' : '') + (b.classList.contains('on') ? '*' : '')).join() } : null; });
    ok(ch && /Morning Sketch/.test(ch.t) && ch.k === 'track*,vox,gtr,hum', 'a dropped recording asks what it is (' + (ch && ch.k) + ')');
    await dp.click('#dropDlg .drop-opt[data-k="vox"]'); await wait(1500);
    const tk = await dp.evaluate(() => { const D = window.__daily; return { n: D.TAKES.length, k: D.TAKES[0] && D.TAKES[0].kind, nm: D.TAKES[0] && D.TAKES[0].name, dur: D.TAKES[0] && D.TAKES[0].dur, bars: D.songSlots() * D.slotDur(), pk: D.TAKES[0] && D.TAKES[0].peak, last: D.CFG.dropKind, row: document.getElementById('tlDrop').hidden, heads: document.querySelector('.tl-heads').textContent }; });
    ok(tk.n === 1 && tk.k === 'vox' && /Morning Sketch/.test(tk.nm) && Math.abs(tk.dur - 2.5) < .1, 'choosing Vocal take adds a vocal take with the file’s name and length (' + JSON.stringify([tk.n, tk.k, tk.nm, tk.dur]) + ')');
    ok(tk.bars >= tk.dur && /Morning Sketch/.test(tk.heads) && tk.row && tk.last === 'vox', 'bars grow to hold it, the lane appears, the drop row hides and the choice is remembered');
    // multi-file: only take options
    await dp.evaluate(async () => { window.__fire('drop', [new File([window.__wav(1, 330)], 'one.wav', { type: 'audio/wav' }), new File([window.__wav(1, 440)], 'two.wav', { type: 'audio/wav' })]); }); await wait(400);
    ok(await dp.evaluate(() => [...document.querySelectorAll('#dropDlg .drop-opt')].map(b => b.dataset.k + (b.disabled ? '!' : '') + (b.classList.contains('on') ? '*' : '')).join()) === 'track!,vox*,gtr,hum!', 'several recordings: backing track and hum are off, the last take type is highlighted');
    await dp.click('#dropDlg .drop-opt[data-k="gtr"]'); await wait(1500);
    ok(await dp.evaluate(() => { const D = window.__daily; return D.TAKES.length === 3 && D.TAKES.filter(t => t.kind === 'gtr').length === 2; }), 'both files become Guitar takes');
    // silent file and corrupt file
    const sil = await dp.evaluate(async () => { const t = await window.__daily.dropTake(new File([new ArrayBuffer(100)], 'broken.wav'), 'vox'); return { t, toast: [...document.querySelectorAll('.toast')].map(x => x.textContent).join('|') }; });
    ok(sil.t === null && /Could not read “broken.wav”/.test(sil.toast), 'an unreadable audio file gives a clear message and adds nothing');
    // rig json
    const rg = await dp.evaluate(async () => { const D = window.__daily; const j = JSON.stringify({ rig: D.rigSnapshot() }); window.__fire('drop', [new File([j], 'my-rig.json', { type: 'application/json' })]); await new Promise(r => setTimeout(r, 400)); return [...document.querySelectorAll('.toast')].map(x => x.textContent).join('|'); });
    ok(/Rig loaded from “my-rig.json”/.test(rg), 'a dropped rig .json loads into the rig');
    // a modal window blocks the drop
    await dp.evaluate(() => { const d = document.createElement('dialog'); d.id = 'tstDlg'; d.textContent = 'x'; document.body.append(d); d.showModal(); });
    const blk = await dp.evaluate(async () => { const ov0 = window.__fire('dragover', [new File(['x'], 'a.wav')]); const on = document.getElementById('dropOv').classList.contains('on'); const pv = window.__fire('drop', [new File([window.__wav(1)], 'late.wav', { type: 'audio/wav' })]); await new Promise(r => setTimeout(r, 300)); return { ov0, on, pv, dlg: !!document.getElementById('dropDlg'), toast: [...document.querySelectorAll('.toast')].map(x => x.textContent).join('|') }; });
    ok(blk.ov0 && !blk.on && blk.pv && !blk.dlg && /Close this window first/.test(blk.toast), 'with a window open the drop is declined politely (and never navigates away)');
    await dp.evaluate(() => { const d = document.getElementById('tstDlg'); d.close(); d.remove(); });
    // song file via Choose a file… path: a .zip is routed to the importer (bad zip → clear error, not a crash)
    const zp = await dp.evaluate(async () => { await window.__daily.dropFiles([new File(['not a zip'], 'x.zip')]); return [...document.querySelectorAll('.toast')].map(x => x.textContent).join('|'); });
    ok(/Import failed/.test(zp), 'a broken .zip reports “Import failed” instead of crashing');
    ok(await dp.evaluate(() => window.__gum) === 0, 'dropping files never asks for the microphone or camera');
    ok(de.length === 0, 'no page errors during drop tests' + (de.length ? ': ' + de.join(' | ') : ''));
  }
});
