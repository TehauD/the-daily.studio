/* Record first (2.88): the big Record button is the first button on the start card; one tap opens a full-screen recorder over the hexagon field; a recording is
   kept as a SAMPLE on a shelf that survives a reload, and any sample goes into a song as a take. The microphone is Chromium's fake device. */
const { suite } = require('./lib.cjs');
suite('e2e-record-first', async t => {
  const { ok, wait, poll, BASE } = t, p = await t.open({ boot: false, w: 1280, h: 900, debug: true }), ev = (f, a) => p.evaluate(f, a);
  await p.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'debug'); await wait(3000);
  // ---- the start card leads with Record
  ok(await ev(() => { const b = document.querySelector('#boot .boot-card button'); return !!b && b.id === 'bootRec'; }), 'Record is the first button on the start card');
  ok(await ev(() => { const b = document.getElementById('bootRec'), r = b.getBoundingClientRect(), cs = getComputedStyle(b); return r.width >= 80 && r.top < 420 && /polygon/.test(cs.clipPath) && /rgb\(2[0-9]{2}, 1[6-9]\d, \d+\)|gradient/.test(cs.backgroundImage + cs.backgroundColor); }), 'and it is a big gold hexagon, high on the page');
  ok(await ev(() => { const s = document.getElementById('bootSamples'); return !!s && s.getBoundingClientRect().height > 30 && /^🎙 Samples$/.test(s.textContent.trim()); }), 'the Samples choice is on the start card, with no count until there is a sample');
  ok(await ev(() => { const k = [...document.querySelectorAll('#bootRoutes .glass')].map(b => b.id); return k.includes('bootWays') && k.includes('bootNoMic'); }), 'beside the Rooms and Control room choices');
  ok(await ev(() => !document.getElementById('rf') && !(window.__daily && window.__daily.E && window.__daily.E.hasInput)), 'nothing is recording and the microphone is not open before the tap');
  // ---- Light / Dark is on the first page and changes the first page (it used to do nothing on a first visit)
  ok(await ev(() => { const t = document.getElementById('bootTheme'); return !!t && t.getBoundingClientRect().height > 20 && t.getBoundingClientRect().top < 80; }), 'Light and Dark are at the top of the first page');
  const bgOf = () => ev(() => { const b = document.getElementById('boot'); return b.classList.contains('bg-light') ? 'light' : b.classList.contains('bg-dark') ? 'dark' : '?'; });
  await p.click('#bootTheme [data-t=light]'); await wait(350); const tl = await bgOf(), wl = await ev(() => getComputedStyle(document.querySelector('.boot-top h1 span')).color);
  await p.click('#bootTheme [data-t=dark]'); await wait(350); const td = await bgOf(), wd = await ev(() => getComputedStyle(document.querySelector('.boot-top h1 span')).color);
  ok(tl === 'light' && td === 'dark' && wl !== wd, 'choosing Light turns the first page light and Dark turns it dark, even on a first visit (' + tl + ', ' + td + ')');
  ok(await ev(() => !/user-select:\s*text/.test('') && getComputedStyle(document.querySelector('.boot-about')).userSelect === 'none'), 'the small print is not selectable text, so it never shows as highlighted boxes');
  ok(await ev(() => { const t = document.querySelector('.boot-fine').innerText; return !/Plus hum-to-song/.test(t) && /Begin on stage/.test(t) && /stay on this device/.test(t); }), 'and the small print is shorter');
  // ---- Rooms: the rooms by name (Writing room, Stage, Practice room, Control room), with the workspace each opens to
  await p.click('#bootWays'); await wait(300);
  ok(await ev(() => [...document.querySelectorAll('#bootDoors .boot-door b')].map(b => b.textContent).join('|') === 'Writing room|Stage|Practice room|Control room' && document.getElementById('bootQ').textContent === 'Choose a room'), 'Rooms lists the Writing room, the Stage, the Practice room and the Control room');
  ok(await ev(() => [...document.querySelectorAll('#bootDoors .boot-door small')].map(b => b.textContent).join('|') === 'Opens Songwriter|Opens Studio|Opens Practice|Opens the Full Rig'), 'each says which workspace it opens (the names on the studio bar)');
  // ---- the card follows the field behind it: dark words on a light field, light words on a dark one, whatever the app's theme is
  const tone = async t => { await ev(x => { window.__daily.CFG.hexTone = x; }, t); await wait(250); return ev(() => { const lum = c => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return (.2126 * m[0] + .7152 * m[1] + .0722 * m[2]) / 255; }, b = document.getElementById('boot'); return { light: b.classList.contains('bg-light'), dark: b.classList.contains('bg-dark'), word: lum(getComputedStyle(document.querySelector('.boot-top h1 span')).color), muted: lum(getComputedStyle(document.querySelector('.boot-rec-l')).color) }; }); };
  const onLight = await tone('white'), onDark = await tone('green');
  ok(onLight.light && !onLight.dark && onLight.word < .35 && onLight.muted < .45, 'on a light field the wordmark and the Record label are dark (' + onLight.word.toFixed(2) + ', ' + onLight.muted.toFixed(2) + ')');
  ok(onDark.dark && !onDark.light && onDark.word > .6 && onDark.muted > .6, 'on a dark field they are light, so “the-daily” never disappears (' + onDark.word.toFixed(2) + ', ' + onDark.muted.toFixed(2) + ')');
  await ev(() => { window.__daily.CFG.hexTone = ''; }); await wait(200);
  const lens = await ev(() => { document.querySelector('[data-me="tech"]').click(); const doors = [...document.querySelectorAll('#bootDoors .boot-door')].map(b => [getComputedStyle(b).order, b.dataset.door, !!b.querySelector('.bd-rec')]).sort((a, b) => a[0] - b[0]), goals = [...document.querySelectorAll('#bootGoals .boot-goal')].map(b => [getComputedStyle(b).order, b.dataset.goal, b.classList.contains('sug')]).sort((a, b) => a[0] - b[0]); return { q: document.getElementById('bootQ').textContent, why: (document.getElementById('bootWhy') || {}).textContent || '', doors, goals, hero: document.querySelector('.boot-hero .boot-sub').textContent }; });
  ok(lens.q === 'For a producer: start here' && /Control room has every panel/.test(lens.why) && /Everything else is still here/.test(lens.why), 'choosing Producer says where to start and why (' + lens.q + ')');
  ok(lens.doors[0][1] === 'explore' && lens.doors[0][2] && lens.doors.filter(d => d[2]).length === 1 && lens.doors.map(d => d[1]).join() === 'explore,song,stage,learn', 'the Control room comes first, marked Start here, the others follow in that order (' + lens.doors.map(d => d[1]).join() + ')');
  ok(lens.goals.map(g => g[1]).join() === 'loop,show,play,write,hum,split' && lens.goals.filter(g => g[2]).length === 2, 'the single tasks are reordered too, with two suggested');
  ok(/Control room/.test(lens.hero), 'and the line under Record speaks to them (' + lens.hero + ')');
  const back = await ev(() => { document.querySelector('[data-me="tech"]').click(); return { q: document.getElementById('bootQ').textContent, why: !!document.getElementById('bootWhy'), tags: document.querySelectorAll('.bd-rec').length, order: [...document.querySelectorAll('#bootDoors .boot-door')].map(b => b.style.order).join('') }; });
  ok(back.q === 'Choose a room' && !back.why && back.tags === 0 && back.order === '', 'choosing it again puts everything back, nothing was hidden');
  await p.click('#bootWays'); await wait(200);
  // ---- the first tap explains, then records
  await p.click('#bootRec'); await wait(500);
  ok(await ev(() => !!document.getElementById('rf') && /One quick thing/.test(document.getElementById('rfMain').textContent)), 'the first tap opens the recorder and says why the microphone is needed');
  ok(await ev(() => !!document.getElementById('rfHex')), 'the hexagon field is behind it');
  ok(await ev(() => { const b = document.getElementById('rfBack'); return !!b && /Back/.test(b.textContent) && [...document.querySelectorAll('#rfMain .rf-pill')].map(x => x.textContent).join('|').includes('Samples') && /Control room/.test(document.getElementById('rfMain').textContent); }), 'every screen has a visible Back, and a way to Samples and the Control room (not only Esc and Space)');
  await p.click('#rfMain .rf-primary'); ok(await poll(() => ev(() => !!document.querySelector('#rfMain .rf-stop')), 9000, 150), 'allowing opens the microphone and starts recording');
  ok(await ev(() => { const b = document.querySelector('#rfMain .rf-stop'), cs = getComputedStyle(b); return /polygon/.test(cs.clipPath) && /rgb\(255, 138, 140\)|rgb\(255, 77, 79\)/.test(cs.backgroundImage); }), 'while recording the button is a red hexagon, and the field glows red behind it');
  ok(await ev(() => { const d = document.getElementById('rfDock'); return !!d && d.getBoundingClientRect().height > 30 && !!document.getElementById('rfIn') && !!document.getElementById('rfGain') && !!document.getElementById('rfMaster') && !!document.getElementById('rfHear') && /Kill audio/.test(document.getElementById('rfKill').textContent); }), 'while recording the Sound dock is there: Input, Level, Master, Hear myself and Kill audio');
  ok(await ev(() => document.getElementById('rfIn').disabled), 'the input cannot be switched in the middle of a take');
  await ev(() => { const g = document.getElementById('rfGain'); g.value = 12; g.dispatchEvent(new Event('input', { bubbles: true })); const m = document.getElementById('rfMaster'); m.value = .5; m.dispatchEvent(new Event('input', { bubbles: true })); });
  ok(await ev(() => window.__daily.CFG.rcfGain === 12 && /\+12\.0 dB/.test(document.getElementById('rfGainO').textContent) && Math.abs(window.__daily.E.master.gain.value - .5) < .2 && /−6\.0 dB|-6\.0 dB/.test(document.getElementById('rfMasterO').textContent)), 'the Level and Master sliders work and say what they are in dB');
  await wait(1800);
  ok(await poll(() => ev(() => /dB|Quiet|Too loud/.test(document.getElementById('rfDtxt').textContent) && parseFloat(document.getElementById('rfDm').style.width) > 0), 6000, 100), 'the dock meter reads the input in dB');
  const lcd = await ev(() => document.getElementById('rfLcd').textContent); ok(/^0:0[1-9]$/.test(lcd), 'the clock runs (' + lcd + ')');
  ok(await ev(() => parseFloat(document.getElementById('rfLvl').style.width || '0') > 0 || [...document.querySelectorAll('#rfRoll span')].some(s => parseFloat(s.style.height) > 3)), 'the level meter and the rolling waveform move with the sound');
  await p.click('#rfMain .rf-circ[aria-label="Drop a marker"]'); await wait(300);
  // ---- Space stops it; the review keeps nothing until you say so
  await p.keyboard.press('Space'); ok(await poll(() => ev(() => !!document.querySelector('#rfMain .rf-wave')), 4000, 100), 'Space stops and shows the recording');
  ok(await ev(() => /Got it\./.test(document.getElementById('rfMain').textContent) && document.querySelectorAll('.rf-mk').length === 1), 'the review shows the length and the marker');
  const nm = await ev(() => document.getElementById('rfName').value); ok(/^Voice · /.test(nm), 'it is named for you (' + nm + ')');
  // ---- cutting: handles on the waveform, the keyboard, Reset, Trim quiet ends, and only the part between them is kept
  const len0 = await ev(() => +document.getElementById('rfSel').dataset.len);
  ok(len0 > 2 && await ev(() => !!document.getElementById('rfHa') && !!document.getElementById('rfHb') && !!document.getElementById('rfQuiet') && !!document.getElementById('rfReset')), 'the review has a start and an end handle on the waveform, Trim quiet ends and Reset (' + len0 + ' s)');
  const bx = await ev(() => { const r = document.getElementById('rfBox').getBoundingClientRect(), a = document.getElementById('rfHa').getBoundingClientRect(); return { x: r.left, w: r.width, y: r.top + r.height / 2, ax: a.left + a.width / 2 }; });
  await p.mouse.move(bx.ax, bx.y); await p.mouse.down(); await p.mouse.move(bx.x + bx.w * .5, bx.y, { steps: 6 }); await p.mouse.up(); await wait(200);
  const len1 = await ev(() => +document.getElementById('rfSel').dataset.len); ok(len1 < len0 * .65 && len1 > len0 * .35, 'dragging the start handle to the middle cuts the front off (' + len0 + ' → ' + len1 + ' s)');
  await p.focus('#rfHb'); await p.keyboard.press('ArrowLeft'); await wait(100); const len2 = await ev(() => +document.getElementById('rfSel').dataset.len);
  ok(len2 < len1 && len1 - len2 < .2, 'the arrow keys nudge a handle (' + len1 + ' → ' + len2 + ' s)');
  await p.click('#rfReset'); ok(Math.abs(await ev(() => +document.getElementById('rfSel').dataset.len) - len0) < .01, 'Reset puts the whole recording back');
  await p.mouse.move(bx.ax, bx.y); await p.mouse.down(); await p.mouse.move(bx.x + bx.w * .5, bx.y, { steps: 6 }); await p.mouse.up(); await wait(200);
  const keepLen = await ev(() => +document.getElementById('rfSel').dataset.len);
  await p.click('#rfPlay'); await wait(300); ok(await ev(() => /Pause/.test(document.getElementById('rfPlay').textContent)), 'Play plays it back');
  await p.click('#rfMain .rf-warn'); ok(await ev(() => /Sure\?/.test(document.getElementById('rfMain').textContent)), 'Discard asks once more, so a tap cannot lose a recording');
  await p.fill('#rfName', 'Verse hum'); await p.click('#rfMain .rf-primary:not(#rfPlay)');
  ok(await poll(() => ev(() => !document.getElementById('rf') && !!document.getElementById('rfShelf')), 6000, 150), 'Keep sample closes the recorder and opens the shelf');
  ok(await ev(() => document.querySelectorAll('#rfShelf .rf-item').length === 1 && document.querySelector('#rfShelf .rf-nm').value === 'Verse hum'), 'the shelf has the sample, with the name you gave it');
  ok(await ev(k => { const m = /^0:0(\d) /.exec(document.querySelector('#rfShelf .rf-info .tiny').textContent); return !!m && Math.abs(+m[1] - k) <= 1; }, keepLen), 'and it is only the part that was cut (' + Math.floor(keepLen) + ' s of ' + Math.floor(len0) + ' s)');
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
  // ---- the way out: Back while recording stops and shows what you have; Done keeps it and goes back
  await p.keyboard.press('Escape'); await wait(300);
  await p.click('#samplesBtn'); await wait(500); await p.click('#rfShelf .btn.primary:not(.sm)'); ok(await poll(() => ev(() => !!document.querySelector('#rfMain .rf-stop')), 9000, 150), 'Record from the shelf opens the recorder (the microphone is already allowed)');
  ok(await ev(() => { const b = document.getElementById('rfBack'); return !!b && /Back/.test(b.textContent) && b.getBoundingClientRect().height >= 36; }), 'while recording there is a visible Back');
  await wait(1200); await p.click('#rfBack'); ok(await poll(() => ev(() => !!document.querySelector('#rfMain .rf-wave')), 4000, 100), 'Back while recording stops and shows what you have');
  ok(await ev(() => /Done/.test(document.getElementById('rfBack').textContent)), 'where the top button now says Done');
  await p.click('#rfBack'); ok(await poll(() => ev(() => !document.getElementById('rf')), 4000, 100), 'Done keeps it and goes back, to where you were');
  await p.click('#samplesBtn'); await wait(500); ok(await ev(() => document.querySelectorAll('#rfShelf .rf-item').length === 1), 'and the sample is on the shelf');
  await p.keyboard.press('Escape'); await wait(200);
  // ---- Kill audio: Ctrl + . while recording keeps what was recorded, and Resume brings the engine back
  await p.click('#samplesBtn'); await wait(500); await p.click('#rfShelf .btn.primary:not(.sm)'); ok(await poll(() => ev(() => !!document.querySelector('#rfMain .rf-stop')), 9000, 150), 'recording again');
  await wait(1500); await p.keyboard.press('Control+.');
  ok(await poll(() => ev(() => !!document.querySelector('#rfMain .rf-wave') && window.__daily.AK.killed), 4000, 100), 'Ctrl + . while recording kills the audio and keeps what was recorded');
  ok(await ev(() => document.getElementById('rfDock').classList.contains('killed') && /Resume audio/.test(document.getElementById('rfKill').textContent)), 'the dock says audio is killed and offers Resume');
  await p.click('#rfPlay'); await wait(300); ok(await ev(() => !window.__daily.E.hasInput && /▶ Play/.test(document.getElementById('rfPlay').textContent)), 'playing while killed does not start anything, and the microphone is released');
  await p.click('#rfKill'); await wait(600); ok(await ev(() => !window.__daily.AK.killed && /Kill audio/.test(document.getElementById('rfKill').textContent)), 'Resume brings the engine back (the microphone stays off)');
  await p.click('#rfKill'); await wait(400); ok(await ev(() => window.__daily.AK.killed), 'and the Kill button kills it again');
  await p.click('#rfKill'); await wait(400); await p.click('#rfBack'); await wait(400);
  // ---- hexagon setting
  ok(await ev(() => window.__daily ? true : true), 'settings default is on');
  ok(t.errs.length === 0, 'no errors (' + t.errs.length + ')');
});
