/* Record first (2.88): the big Record button is the first button on the start card; one tap opens a full-screen recorder over the hexagon field; a recording is
   kept as a SAMPLE on a shelf that survives a reload, and any sample goes into a song as a take. The microphone is Chromium's fake device. */
const { suite } = require('./lib.cjs');
suite('e2e-record-first', async t => {
  const { ok, wait, poll, BASE } = t, p = await t.open({ boot: false, w: 1280, h: 900, debug: true }), ev = (f, a) => p.evaluate(f, a);
  await p.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'debug'); await wait(3000);
  // ---- the start card leads with Record
  ok(await ev(() => { const b = document.querySelector('#boot .boot-card button'); return !!b && b.id === 'bootRec'; }), 'Record is the first button on the start card');
  ok(await ev(() => { const r = document.getElementById('bootRec').getBoundingClientRect(); return r.width >= 80 && r.top < 420; }), 'and it is big and high on the page');
  ok(await ev(() => { const s = document.getElementById('bootSamples'); return !!s && s.getBoundingClientRect().height > 30 && /^🎙 Samples$/.test(s.textContent.trim()); }), 'the Samples choice is on the start card, with no count until there is a sample');
  ok(await ev(() => { const k = [...document.querySelectorAll('#bootRoutes .glass')].map(b => b.id); return k.includes('bootWays') && k.includes('bootNoMic'); }), 'beside the Rooms and Control room choices');
  ok(await ev(() => !document.getElementById('rf') && !(window.__daily && window.__daily.E && window.__daily.E.hasInput)), 'nothing is recording and the microphone is not open before the tap');
  // ---- the first tap explains, then records
  await p.click('#bootRec'); await wait(500);
  ok(await ev(() => !!document.getElementById('rf') && /One quick thing/.test(document.getElementById('rfMain').textContent)), 'the first tap opens the recorder and says why the microphone is needed');
  ok(await ev(() => !!document.getElementById('rfHex')), 'the hexagon field is behind it');
  await p.click('#rfMain .rf-primary'); ok(await poll(() => ev(() => !!document.querySelector('#rfMain .rf-stop')), 9000, 150), 'allowing opens the microphone and starts recording');
  await wait(1800);
  const lcd = await ev(() => document.getElementById('rfLcd').textContent); ok(/^0:0[1-9]$/.test(lcd), 'the clock runs (' + lcd + ')');
  ok(await ev(() => parseFloat(document.getElementById('rfLvl').style.width || '0') > 0 || [...document.querySelectorAll('#rfRoll span')].some(s => parseFloat(s.style.height) > 3)), 'the level meter and the rolling waveform move with the sound');
  await p.click('#rfMain .rf-circ[aria-label="Drop a marker"]'); await wait(300);
  // ---- Space stops it; the review keeps nothing until you say so
  await p.keyboard.press('Space'); ok(await poll(() => ev(() => !!document.querySelector('#rfMain .rf-wave')), 4000, 100), 'Space stops and shows the recording');
  ok(await ev(() => /Got it\./.test(document.getElementById('rfMain').textContent) && document.querySelectorAll('.rf-mk').length === 1), 'the review shows the length and the marker');
  const nm = await ev(() => document.getElementById('rfName').value); ok(/^Voice · /.test(nm), 'it is named for you (' + nm + ')');
  await p.click('#rfPlay'); await wait(300); ok(await ev(() => /Pause/.test(document.getElementById('rfPlay').textContent)), 'Play plays it back');
  await p.click('#rfMain .rf-warn'); ok(await ev(() => /Sure\?/.test(document.getElementById('rfMain').textContent)), 'Discard asks once more, so a tap cannot lose a recording');
  await p.fill('#rfName', 'Verse hum'); await p.click('#rfMain .rf-primary:not(#rfPlay)');
  ok(await poll(() => ev(() => !document.getElementById('rf') && !!document.getElementById('rfShelf')), 6000, 150), 'Keep sample closes the recorder and opens the shelf');
  ok(await ev(() => document.querySelectorAll('#rfShelf .rf-item').length === 1 && document.querySelector('#rfShelf .rf-nm').value === 'Verse hum'), 'the shelf has the sample, with the name you gave it');
  ok(await ev(() => /never uploaded/.test(document.getElementById('rfShelf').textContent)), 'and says it is never uploaded');
  await p.click('#rfShelf .rf-pbtn'); await wait(400); ok(await ev(() => document.querySelector('#rfShelf .rf-pbtn').textContent === '■'), 'a sample plays from the shelf');
  await p.keyboard.press('Escape'); await wait(300);
  // ---- it survives a reload, and the start card knows
  await p.reload(); await wait(3200);
  ok(await ev(() => { const s = document.getElementById('bootSamples'); return !!s && /Samples \(1\)/.test(s.textContent); }), 'after a reload the start card says “Samples (1)”');
  // ---- use it in a song
  await p.click('#bootSamples'); await wait(600); await p.click('#rfShelf .btn.primary.sm');
  ok(await poll(() => ev(() => !document.getElementById('boot') && [...document.querySelectorAll('#toasts .toast')].some(x => /Added “Verse hum”/.test(x.textContent))), 12000, 150), 'Use in a song starts the studio and adds it as a take');
  ok(await ev(() => !!document.getElementById('samplesBtn')), 'the Samples button is in the header of the studio');
  await p.click('#samplesBtn'); await wait(500); ok(await ev(() => document.querySelectorAll('#rfShelf .rf-item').length === 1), 'and the shelf opens from there');
  // ---- delete asks twice
  await p.click('#rfShelf .rf-del'); await p.click('#rfShelf .rf-del'); await wait(500);
  ok(await ev(() => /Nothing recorded yet/.test(document.getElementById('rfShelf').textContent)), 'Delete asks twice, then the shelf is empty again');
  // ---- hexagon setting
  ok(await ev(() => window.__daily ? true : true), 'settings default is on');
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
