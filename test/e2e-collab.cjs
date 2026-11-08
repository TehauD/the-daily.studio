/* Passing a song back and forth (2.51): a name and a note go with a song link, with a short history of who changed what; whoever opens it
   gets ↩ Send it back, which knows who it came from and what they changed. Someone who has never visited is invited to play it at once.
   Two people, each in their own browser: Alice (has been here before) and Bob (never has). Share pages and printed sheets link back. */
const { suite } = require('./lib.cjs');
const FRESH = new Function(`try { localStorage.removeItem('fw.started'); } catch (e) { }`);

suite('e2e-collab', async t => {
  const { ok, wait, poll } = t;
  /* ---- Alice writes a verse and sends it ---- */
  const a = await t.open({ w: 1280, h: 860 }), av = (f, x) => a.evaluate(f, x);
  await av(() => { const D = window.__daily; D.S.title = 'Harbour Song'; D.S.sections = [D.mkSection('Verse 1', ['Am', 'F', 'C', 'G']), D.mkSection('Chorus', ['F', 'G', 'C', 'C'])]; D.S.sections[0].lyrics = '[Am]Salt wind on the [F]water'; D.T.bars = null; D.commit(false); delete D.S.collab; });
  await av(() => window.__daily.slShare()); await wait(400);
  await a.fill('#slName', 'Alice'); await a.fill('#slNote', 'Can you write the chorus? <img src=x onerror=alert(1)>'); await wait(700);
  const A1 = await av(() => ({ h: document.getElementById('slH').textContent, url: document.getElementById('slUrl').value }));
  ok(/^🔗 Send “Harbour Song” as a link/.test(A1.h) && /#s=1[zj]/.test(A1.url), 'Alice sends the song as a link, with her name and a note');
  await a.click('#slCopy'); await wait(300);
  const A2 = await av(() => ({ c: window.__daily.S.collab, name: window.__daily.CFG.slName }));
  ok(A2.c && A2.c.hist.length === 1 && A2.c.hist[0][0] === 'Alice' && A2.c.hist[0][2] === 'started the song' && A2.name === 'Alice', 'sending makes the first round part of the song (Alice: started the song), and her name is remembered');

  /* ---- Bob, who has never been here, opens it ---- */
  const b = await t.open({ w: 1280, h: 860, boot: false, init: FRESH }), bv = (f, x) => b.evaluate(f, x);
  await b.goto(A1.url.replace(/^https?:\/\/[^/]+\/[^#]*/, t.BASE + '?debug')); await poll(() => bv(() => !!document.getElementById('slIn')), 8000);
  const B1 = await bv(() => { const d = document.getElementById('slIn'); return { kick: d.querySelector('.sl-kick').textContent, note: (document.getElementById('slInNote') || {}).textContent, imgs: d.querySelectorAll('img').length, hist: [...d.querySelectorAll('.slc-hist li')].map(x => x.textContent), play: document.getElementById('slPlay').textContent, open: document.getElementById('slOpenBtn').textContent, first: d.classList.contains('sl-first') }; });
  ok(B1.kick === '🎵 Alice sent you a song' && /Can you write the chorus\?/.test(B1.note) && B1.imgs === 0, 'Bob sees who sent it and her note, as plain text (' + B1.kick + ')');
  ok(B1.hist.length === 1 && /^Alice · today: started the song/.test(B1.hist[0]), 'and the rounds so far (' + B1.hist[0] + ')');
  ok(B1.first && B1.play === '▶ Play it' && B1.open === 'Open it in the studio', 'a first visit is an invitation: ▶ Play it, or Open it in the studio');
  await bv(() => document.getElementById('slPlay').click()); await poll(() => bv(() => window.__daily.S.title === 'Harbour Song' && !!document.getElementById('perform')), 10000);
  const B2 = await bv(() => ({ with: window.__daily.S.collab && window.__daily.S.collab.with, perf: !!document.getElementById('perform'), label: window.__daily.slSendLabel() }));
  ok(B2.with === 'Alice' && B2.perf, '▶ Play it opens the song and plays it in Perform, the words as a sing-along');
  ok(B2.label === '↩ Send back to Alice', 'the send buttons now say ↩ Send back to Alice');

  /* Bob writes the chorus and sends it back */
  await bv(() => { const D = window.__daily; D.perfClose(); D.stopPlay(); const c = D.S.sections.find(s => s.name === 'Chorus'); c.lyrics = '[F]Hold on, [G]the tide is [C]turning'; D.commit(false); D.slShare(); }); await wait(400);
  await b.fill('#slName', 'Bob'); await b.fill('#slNote', 'Chorus done!'); await wait(700);
  const B3 = await bv(() => ({ h: document.getElementById('slH').textContent, changed: (document.getElementById('slChanged') || {}).textContent, url: document.getElementById('slUrl').value }));
  ok(B3.h === '↩ Send “Harbour Song” back to Alice' && /wrote words for Chorus/.test(B3.changed), 'Send it back knows who it goes to and what Bob changed (' + B3.changed + ')');
  await b.click('#slCopy'); await wait(300);

  /* ---- Alice opens Bob's reply ---- */
  const a2 = await t.open({ w: 1280, h: 860, boot: false }), a2v = (f, x) => a2.evaluate(f, x);
  await a2.goto(B3.url.replace(/^https?:\/\/[^/]+\/[^#]*/, t.BASE + '?debug')); await poll(() => a2v(() => !!document.getElementById('slIn')), 8000);
  const C1 = await a2v(() => { const d = document.getElementById('slIn'); return { kick: d.querySelector('.sl-kick').textContent, note: (document.getElementById('slInNote') || {}).textContent, hist: [...d.querySelectorAll('.slc-hist li')].map(x => x.textContent), play: document.getElementById('slPlay').textContent }; });
  ok(C1.kick === '🎵 Bob sent you a song' && C1.note === 'Chorus done!' && C1.play === '▶ Open and play', 'Alice gets Bob’s reply with his note (she has been here, so it simply opens)');
  ok(C1.hist.length === 2 && /^Alice · today: started the song/.test(C1.hist[0]) && /^Bob · today: wrote words for Chorus/.test(C1.hist[1]), 'and both rounds: ' + C1.hist.join(' / '));
  await a2v(() => document.getElementById('slOpenBtn').click()); await poll(() => a2v(() => window.__daily.S.title === 'Harbour Song'), 8000);
  ok(await a2v(() => { const D = window.__daily; return /turning/.test(D.S.sections.find(s => s.name === 'Chorus').lyrics) && D.slSendLabel() === '↩ Send back to Bob'; }), 'the chorus Bob wrote is there, and her next send goes back to Bob');

  /* ---- what is shared or printed links back to the song ---- */
  const L = await av(async () => { const D = window.__daily, link = await D.slLink(), html = D.shareHtml('data:audio/webm;base64,AAAA', Object.assign(D.shareData(), { link })), pr = D.printSheetHtml(link);
    return { page: html.includes('Open this song in the-daily.studio') && html.includes('href="' + link.replace(/&/g, '&amp;') + '"'), print: /<svg[^>]*>/.test(pr) && /Scan to open this song/.test(pr) }; });
  ok(L.page, 'a share page links back to the song in the-daily.studio');
  ok(L.print, 'and a printed sheet has a code to scan that opens it');

  /* ---- nothing in a link can do more than a song can ---- */
  const bad = await av(() => { const D = window.__daily; try { const s = D.slUnpack({ v: 1, t: 'x', x: [['V', 'C', '']], c: { id: '<script>', f: 12345, n: { x: 1 }, h: 'nope' } }); return { ok: true, id: /^[a-z0-9]{6,16}$/.test(s.collab.id), with: s.collab.with, hist: s.collab.hist.length }; } catch (e) { return { ok: false, e: e.message }; } });
  ok(bad.ok && bad.id && bad.with === '12345' && bad.hist === 0, 'odd values in a link are cleaned or dropped, never trusted');
});
