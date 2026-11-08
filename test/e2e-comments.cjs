/* Comments pinned to a moment, and the lyric helper (2.58).
   Comments: pinned to the playhead's bar (and so kept on the beat), listed and jumped to, marked done, carried in a song link (open ones
   only, checked on the way in), shown when the link opens, and kept from both sides when a round becomes a version.
   Lyric helper: the word list loads from this site; syllables and rhyme scheme per line; rhymes for the last word typed, perfect ones
   first; a click puts a rhyme in at the cursor; and the Write card's own counts use the dictionary once it's loaded. */
const { suite } = require('./lib.cjs');
suite('e2e-comments', async t => {
  const { ok, wait, poll } = t, p = await t.open(); const ev = (fn, a) => p.evaluate(fn, a);
  await ev(async () => { const D = window.__daily; await D.projCreate('blank', { form: 'empty' }); D.S.title = 'Harbour Song'; D.S.sections[0].lyrics = 'Lanterns on the harbour wall'; D.commit(false); D.CFG.slName = 'Tehau'; });

  /* comments */
  const at = await ev(() => { const D = window.__daily, sp = D.spb ? D.spb() : 16; D.T.cursor = sp * 2 + sp / 2; return D.T.cursor; });
  await ev(() => document.getElementById('cmtBtn').click()); await wait(250);
  ok(await ev(() => /Pinned to bar 3/.test(document.getElementById('cmtDlg').textContent)), '💬 Comment pins to where the playhead is (bar 3)');
  await ev(() => { document.getElementById('cmtText').value = 'Rush here?'; document.getElementById('cmtAdd').click(); }); await wait(200);
  const C1 = await ev(() => window.__daily.cmtAll().map(c => ({ at: c.at, text: c.text, who: c.who, sec: c.sec })));
  ok(C1.length === 1 && C1[0].text === 'Rush here?' && C1[0].who === 'Tehau' && Math.abs(C1[0].at - at) < .01, 'the comment keeps its place, its words and who wrote it');
  ok(await ev(() => /bar 3/.test(document.getElementById('cmtList').textContent)), 'and it is listed by its place');
  await ev(() => { window.__daily.T.cursor = 0; document.querySelector('#cmtList .linkish').click(); }); await wait(100);
  ok(Math.abs(await ev(() => window.__daily.T.cursor) - at) < .01, 'pressing its place moves the playhead there');
  await ev(() => { const D = window.__daily; D.cmtAdd('Old note', 0); D.cmtAll().find(c => c.text === 'Old note').done = true; });
  await ev(() => document.getElementById('cmtDlg').close());
  /* through a link */
  const back = await ev(async () => { const D = window.__daily, url = await D.slLink(), s = await D.slRead(url.slice(url.indexOf('#'))); return { n: s.comments.length, t: s.comments[0].text, at: s.comments[0].at, who: s.comments[0].who }; });
  ok(back.n === 1 && back.t === 'Rush here?' && back.who === 'Tehau' && Math.abs(back.at - at) < .01, 'a song link carries the open comments (not the done one), each at its place, with who wrote it');
  const evil = await ev(async () => { const D = window.__daily, o = D.slPack(); o.cm = [[1e9, 'x'.repeat(999), 'y'.repeat(99), 'z'], ['bad'], [2, '']]; const u8 = new TextEncoder().encode(JSON.stringify(o)); let b = ''; u8.forEach(c => { b += String.fromCharCode(c); }); const s = await D.slRead('#s=1j' + btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')); return s.comments.map(c => [c.at, c.text.length, c.who.length]); }).catch(e => 'error: ' + e.message);
  ok(Array.isArray(evil) && evil.length === 1 && evil[0][0] === 1e5 && evil[0][1] === 280 && evil[0][2] === 40, 'comments from a link are checked: places clamped, words and names cut to length, broken ones dropped (' + JSON.stringify(evil) + ')');
  await ev(async () => { const D = window.__daily, url = await D.slLink(), s = await D.slRead(url.slice(url.indexOf('#'))); D.slWelcome(s); }); await wait(300);
  ok(await ev(() => /💬 1 comment/.test((document.getElementById('slInCmt') || {}).textContent || '') && /Rush here\?/.test(document.getElementById('slInCmt').textContent)), 'opening a link shows its comments');
  await ev(() => document.getElementById('slIn').close());
  /* both sides' comments when a round becomes a version */
  await ev(async () => { const D = window.__daily; D.S.collab = { id: 'cmtround', with: '', note: '', hist: [] }; D.commit(false); await D.projSave(); const s = JSON.parse(JSON.stringify(D.S)); s.collab = { id: 'cmtround', with: 'Sam', note: '', hist: [['Sam', 1, 'x']] }; s.comments = [{ at: 4, text: 'Love this line', who: 'Sam', day: 1, done: false }, { at: D.S.comments.find(c => c.text === 'Rush here?').at, text: 'Rush here?', who: 'Tehau', day: 1, done: false }]; D.slWelcome(s); }); await wait(300);
  const asV = await ev(() => !!document.getElementById('slAsVer'));
  await ev(() => { const b = document.getElementById('slAsVer') || document.getElementById('slOpenBtn'); b.click(); });
  ok(await poll(() => ev(() => { const a = window.__daily.cmtAll().map(c => c.text); return a.includes('Love this line') && a.filter(x => x === 'Rush here?').length === 1 && a.includes('Old note'); }), 8000), 'a round added as a version keeps your comments and theirs, without doubles' + (asV ? '' : ' (no Add as a new version offered)') + ' · now: ' + JSON.stringify(await ev(() => window.__daily.cmtAll().map(c => c.text))));

  /* the lyric helper */
  await ev(() => window.__daily.dockGo('tab')); await wait(300);
  const hasCard = await ev(() => !!document.getElementById('lhBtn'));
  if (hasCard) await ev(() => document.getElementById('lhBtn').click()); else await ev(() => window.__daily.lhOpen(document.querySelector('textarea.lyr')));
  ok(await poll(() => ev(() => window.__daily.LH.idx && window.__daily.LH.idx.size > 30000), 10000), 'the helper loads its 31,000 words from this site (' + (await ev(() => window.__daily.LH.idx && window.__daily.LH.idx.size)) + ')');
  const SY = await ev(() => { const D = window.__daily; return { every: D.lhSyl('everything'), fire: D.lhSyl('fire'), beautiful: D.lhSyl('beautiful'), sch: D.lhScheme('I walked into the night\nThe city lost its glow\nYou held the burning light\nAnd then you let me go').map(x => x.letter + x.syl).join(' ') }; });
  ok(SY.every === 3 && SY.beautiful === 3 && SY.sch === 'A6 B6 A6 B6', 'syllables and the rhyme scheme come from the dictionary: everything 3, beautiful 3, and A B A B (' + SY.sch + ')');
  const RH = await ev(() => { const r = window.__daily.lhRhymes('night'); return { p: r.perfect.slice(0, 12).map(x => x[0]), has: ['light', 'fight', 'tonight', 'delight'].every(w => r.perfect.some(x => x[0] === w)), near: r.near.length }; });
  ok(RH.has && !RH.p.includes('night') && RH.near > 0, 'rhymes for “night”: light, fight, tonight, delight…, common words first, and near rhymes too (' + RH.p.slice(0, 8).join(', ') + ')');
  await ev(() => { const ta = document.querySelector('textarea.lyr') || document.getElementById('mwText'); ta.focus(); ta.value = 'I walked into the night'; ta.setSelectionRange(ta.value.length, ta.value.length); ta.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
  ok(await ev(() => document.getElementById('lhWord').value === 'night' && document.querySelectorAll('#lhRes .lh-chip').length > 10), 'typing in the words fills in the last word and shows its rhymes');
  await ev(() => { const ta = document.querySelector('textarea.lyr'); ta.value += '\nYou held the burning '; ta.setSelectionRange(ta.value.length, ta.value.length); ta.dispatchEvent(new Event('input', { bubbles: true })); window.__daily.LH.ta = ta; const q = document.getElementById('lhWord'); q.value = 'night'; q.dispatchEvent(new Event('input')); [...document.querySelectorAll('#lhRes .lh-chip')].find(b => b.textContent === 'light').click(); });
  ok(await ev(() => /You held the burning light$/.test(document.querySelector('textarea.lyr').value)), 'clicking a rhyme puts it in at the cursor');
  ok(await ev(() => window.__daily.lhScheme(document.querySelector('textarea.lyr').value).map(x => x && x.letter).join('') === 'AA' && /A/.test(document.getElementById('lhRows').textContent)), 'and the panel’s rhyme scheme follows (A A)');
});
