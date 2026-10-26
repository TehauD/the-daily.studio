/* Layout: nothing is clipped where the interface is tight: the time display from 1280 px up, the lane headers and clip bar on a phone,
   and no stray “null” / “undefined” text in the lanes. Own browser contexts; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-layout', async t => {
  const { ok, wait } = t;
  const take = (p, kind, f) => p.evaluate(async ({ b64, kind }) => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); await window.__daily.dropTake(new File([u], kind === 'vox' ? 'Lead vocal.wav' : 'Rhythm riff.wav', { type: 'audio/wav' }), kind); }, { b64: t.wav(t.tone(8, f, { voice: kind === 'vox', amp: .6 }).data, 22050).toString('base64'), kind });
  const stray = p => p.evaluate(() => { const bad = []; document.querySelectorAll('.tl-head, #transport, #songbar, .clipbar, #top').forEach(e => { if (/(^|\W)(null|undefined|NaN)(\W|$)/.test(e.innerText)) bad.push(e.className + ': ' + e.innerText.replace(/\s+/g, ' ').slice(0, 60)); }); return bad; });

  // the time display, at the widths a laptop has
  for (const w of [1280, 1366, 1440, 1600]) {
    const p = await t.open({ w, h: 800 });
    const r = await p.evaluate(() => [...document.querySelectorAll('#transport .lcd')].map(l => { const b = l.querySelector('b'), lr = l.getBoundingClientRect(), br = b.getBoundingClientRect(), nx = l.nextElementSibling && l.nextElementSibling.getBoundingClientRect(); return { fits: b.scrollWidth <= l.clientWidth + 1 && br.right <= lr.right + 1, apart: !nx || lr.right <= nx.left + 1, text: b.textContent }; }));
    ok(r.length === 2 && r.every(x => x.fits && x.apart), `at ${w} px the position and time displays show every digit ${JSON.stringify(r.map(x => x.text))}`);
    if (w === 1280) { await take(p, 'gtr', 110); await take(p, 'vox', 196); await wait(400); const bad = await stray(p); ok(bad.length === 0, 'no stray “null” or “undefined” on the desktop lanes ' + bad.join(' | ')); }
    await p.ctx.close();
  }

  // the header and song bar from a laptop to a big monitor: the beat/key/mode boxes show their whole value and nothing in the song bar is pushed off the edge
  for (const w of [1440, 1500, 1600, 1760, 1920]) {
    const p = await t.open({ w, h: 800 });
    const r = await p.evaluate(() => { const f = [...document.querySelectorAll('#transport .field select, #transport .field input')], sb = document.getElementById('songbar'), seg = [...document.querySelectorAll('#songbar button')].filter(b => /^(Canvas|Song|Studio)$/.test(b.textContent.trim())), last = seg[seg.length - 1];
      return { cut: f.filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.value + ':' + x.scrollWidth + '>' + x.clientWidth), narrow: f.filter(x => x.getBoundingClientRect().width < 44).length, sbOver: sb.scrollWidth - sb.clientWidth, segRight: last ? Math.round(last.getBoundingClientRect().right) : -1, W: innerWidth, topOver: document.getElementById('top').scrollWidth - innerWidth }; });
    ok(r.cut.length === 0 && r.narrow === 0, `at ${w} px the BPM, signature, key and mode boxes show their whole value ${JSON.stringify(r.cut)}`);
    ok(r.sbOver <= 1 && r.segRight <= r.W + 1 && r.topOver <= 0, `at ${w} px the song bar and header fit the window (Canvas | Song | Studio ends at ${r.segRight} of ${r.W})`);
    await p.ctx.close();
  }

  // a phone: lane headers fit their column, and the clip bar is whole
  const m = await t.open({ w: 390, h: 844, mobile: true });
  await take(m, 'gtr', 110); await take(m, 'vox', 196); await wait(500);
  await m.click('#mnav >> text=Write'); await wait(600); await m.evaluate(() => document.querySelectorAll('#toasts .toast').forEach(x => x.remove()));
  await m.click('.msc.tl'); await wait(600);
  const heads = await m.evaluate(() => [...document.querySelectorAll('.tl-head')].map(h => { const hr = h.getBoundingClientRect(); const over = [...h.querySelectorAll('.t > *, .b > *')].filter(c => c.getClientRects().length && c.getBoundingClientRect().right > hr.right + 1).map(c => c.className || c.tagName); return { name: (h.querySelector('.nm') || {}).textContent, over }; }));
  ok(heads.length >= 7 && heads.every(h => h.over.length === 0), 'every lane header on a phone, the vocal and guitar lanes included, fits its column ' + JSON.stringify(heads.filter(h => h.over.length)));
  ok(await m.evaluate(() => { const v = document.querySelector('.tl-head.vox select.vin'); return !v || getComputedStyle(v).display === 'none'; }), 'the cramped input selector is out of the vocal header on a phone (I/O sets it)');
  ok(await m.evaluate(() => { const bad = [...document.querySelectorAll('.tl-head')].filter(h => /\bnull\b/.test(h.innerText)); return bad.length === 0; }), 'no stray “null” in the phone lane headers');
  const cb = await m.evaluate(() => { const b = document.getElementById('clipBar'); if (!b || b.hidden) return null; const r = b.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, kids: [...b.children].every(c => c.getBoundingClientRect().right <= innerWidth + 1) }; });
  ok(cb && cb.l >= 0 && cb.r <= cb.w + 1 && cb.kids, 'the clip bar sits on its own row, with every button inside the screen ' + JSON.stringify(cb));
  await m.click('#clipSplit').catch(() => 0);
  const sheet = await m.evaluate(() => { document.querySelector('.mmore').click(); return new Promise(r => setTimeout(() => r([...document.querySelectorAll('.msheet .mtile')].map(x => { const b = x.getBoundingClientRect(); return b.right <= innerWidth + 1 && b.width > 40; }).every(Boolean)), 500)); });
  ok(sheet, 'every tile in the More sheet is whole and tappable');
});
