/* ============================================================
   Part 83 · TODAY, THIS SONG, BY EAR (2.34) — more of Learn
     · 📅 Today       about fifteen minutes, a new plan each day: a warm-up, a step you passed a while ago (reviewed after 1, 3, 7, 14
                      and then 30 days, so it sticks), the next new step on the path you are on, and a riff at your level. A streak and a
                      week's count; all of it kept in this browser.
     · 🎵 This song   the open song as lessons: its strum pattern (the band's own), each section's chords in time and its riff (from
                      the tab), then the whole song's changes; it starts at 70% of the song's tempo and the tempo ladder stops at the
                      song's own. Where you got to is remembered for the song.
     · 👂 By ear      call and response: the coach plays a short phrase in the key and scale you pick, with the tab hidden, and you
                      play it back. Get it and the next is a note longer (up to eight); miss two and it is a note shorter. 👁 Show me
                      reveals it.
   ============================================================ */
CFG.learn.rev = CFG.learn.rev && typeof CFG.learn.rev === 'object' ? CFG.learn.rev : {};
CFG.learn.passes = CFG.learn.passes && typeof CFG.learn.passes === 'object' ? CFG.learn.passes : {};
CFG.learn.sbpm = CFG.learn.sbpm && typeof CFG.learn.sbpm === 'object' ? CFG.learn.sbpm : {};
CFG.learn.ear = Object.assign({ scale: 'Minor Pentatonic', len: 3, key: null, best: 0 }, CFG.learn.ear || {});
const dayKey = t => { const d = new Date(t == null ? Date.now() : t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const LSTEP = {}; LESSONS.forEach(pa => pa.lessons.forEach(ls => ls.steps.forEach((s, i) => { LSTEP[s.id] = { s, ls, pa, i }; })));
const RIFF_BY = {}; RIFFS.forEach(r => { RIFF_BY[r.id] = r; });
const REV_DAYS = [1, 3, 7, 14, 30];

/** a step passed: when to see it again, today's count, and which path you are on */
function learnPassed(p) {
  if (!p || !p.id) return; const L = CFG.learn, now = Date.now(), k = dayKey(now); LRN_DIRTY = true;      /* the Learn hub's ticks and streak are stale now */
  L.passes[k] = (L.passes[k] || 0) + 1; const keys = Object.keys(L.passes).sort(); while (keys.length > 90) delete L.passes[keys.shift()];
  if (LSTEP[p.id] || RIFF_BY[p.id]) { const r = L.rev[p.id] || { n: 0, at: 0 }; if (dayKey(r.at) !== k) r.n++; r.at = now; L.rev[p.id] = r; }
  if (LSTEP[p.id] && LSTEP[p.id].pa.id !== 'warm') L.lastPath = LSTEP[p.id].pa.id;
  const T = L.today; if (T && T.day === k && !T.told && T.ids.every(([, id]) => todayDone(id))) { T.told = true; setTimeout(() => toast('✓ Today’s session is done. ' + streak() + '-day streak. See you tomorrow.', 'ok'), 400); }
}
const todayDone = id => { const r = CFG.learn.rev[id]; return !!(r && dayKey(r.at) === dayKey()) || (LSTEP[id] && LSTEP[id].s.kind === 'info' && !!CFG.learn.done[id]); };
/** days in a row with at least one step passed, counting back from today (or from yesterday, if today has not started) */
function streak() { let n = 0; const P = CFG.learn.passes, d = new Date(); if (!P[dayKey(d)]) d.setDate(d.getDate() - 1); while (P[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }
const weekCount = () => { let n = 0; const d = new Date(); for (let i = 0; i < 7; i++) { n += CFG.learn.passes[dayKey(d)] || 0; d.setDate(d.getDate() - 1); } return n; };
/** the day's plan, made once a day so it does not shuffle as you go: [kind, step id] */
function todayPlan() {
  const L = CFG.learn, k = dayKey(), who = typeof meNow === 'function' && meNow() === 'sing' ? 'sing' : ''; if (L.today && L.today.day === k && (L.today.me || '') === who && Array.isArray(L.today.ids) && L.today.ids.length) return L.today;
  const n = Math.floor(Date.now() / 864e5), ids = [], now = Date.now();
  if (who) {      /* 2.68: a singer's fifteen minutes: a held note to warm up, something to review, the next sung step, and the song */
    const V = LESSONS.find(x => x.id === 'voice'), steps = V.lessons.reduce((a, ls) => a.concat(ls.steps), []), holds = steps.filter(s => s.kind === 'hold'); ids.push(['warm', holds[n % holds.length].id]);
    const due = Object.keys(L.rev).filter(id => LSTEP[id] && LSTEP[id].pa.id === 'voice' && LSTEP[id].s.kind !== 'info').map(id => { const r = L.rev[id]; return [id, (now - r.at) / 864e5 - REV_DAYS[Math.min(REV_DAYS.length - 1, Math.max(0, r.n - 1))]]; }).filter(x => x[1] >= 0 && !ids.some(y => y[1] === x[0])).sort((a, b) => b[1] - a[1]); if (due.length) ids.push(['review', due[0][0]]);
    const nw = steps.find(s => s.kind !== 'info' && !L.done[s.id] && !ids.some(y => y[1] === s.id)) || steps.filter(s => s.kind === 'notes')[n % steps.filter(s => s.kind === 'notes').length]; if (nw && !ids.some(y => y[1] === nw.id)) ids.push(['new', nw.id]);
    L.today = { day: k, ids, told: false, me: who }; saveCfg(); return L.today;
  }
  const warm = LESSONS.find(x => x.id === 'warm'), wl = warm.lessons[n % warm.lessons.length], ws = wl.steps.find(s => s.kind !== 'info') || wl.steps[0]; ids.push(['warm', ws.id]);
  const due = Object.keys(L.rev).filter(id => (LSTEP[id] && LSTEP[id].s.kind !== 'info' && LSTEP[id].pa.id !== 'warm' && LSTEP[id].pa.id !== 'voice') || RIFF_BY[id]).map(id => { const r = L.rev[id]; return [id, (now - r.at) / 864e5 - REV_DAYS[Math.min(REV_DAYS.length - 1, Math.max(0, r.n - 1))]]; }).filter(x => x[1] >= 0).sort((a, b) => b[1] - a[1]);
  if (due.length) ids.push(['review', due[0][0]]);
  const paths = LESSONS.filter(x => x.id !== 'warm' && x.id !== 'voice'), lp = paths.find(x => x.id === L.lastPath), order = lp ? [lp].concat(paths.filter(x => x !== lp)) : paths;
  let nw = null; for (const pa of order) { for (const ls of pa.lessons) { const i = ls.steps.findIndex(s => s.kind !== 'info' && !L.done[s.id]); if (i >= 0) { if (i > 0 && ls.steps[i - 1].kind === 'info' && !L.done[ls.steps[i - 1].id]) ids.push(['read', ls.steps[i - 1].id]); nw = ls.steps[i]; break; } } if (nw) break; }
  if (nw) ids.push(['new', nw.id]);
  const level = Math.min(3, 1 + Math.floor(Object.keys(L.done).length / 15)), pool = RIFFS.filter(r => r.lvl <= level && !L.done[r.id] && !ids.some(x => x[1] === r.id)), rp = pool.length ? pool : RIFFS;
  ids.push(['riff', rp[n % rp.length].id]);
  L.today = { day: k, ids, told: false }; saveCfg(); return L.today;
}
const pieceOf = id => LSTEP[id] ? LSTEP[id].s : RIFF_BY[id] || null;
const TODAY_KIND = { read: '📖 Read first', warm: '🔥 Warm up', review: '↺ Review', new: '✨ Something new', riff: '🎸 A riff' };
function todayPieces() { return todayPlan().ids.map(([kind, id]) => { const p = pieceOf(id); return p ? Object.assign({}, p, { today: kind }) : null; }).filter(Boolean); }
function todayStart() { const ps = todayPieces(), at = Math.max(0, ps.findIndex(p => !todayDone(p.id))); return coachOpen(ps, at, { title: 'Today' }); }
function todayView() {
  const T = todayPlan(), st = streak(), wk = weekCount(), rows = T.ids.map(([kind, id]) => { const p = pieceOf(id); if (!p) return null; const r = CFG.learn.rev[id], ago = kind === 'review' && r ? Math.max(1, Math.round((Date.now() - r.at) / 864e5)) : 0;
    return h('li', { class: 'td-row' + (todayDone(id) ? ' done' : ''), 'data-today': kind }, h('span', { class: 'td-k' }, TODAY_KIND[kind] || kind), h('b', {}, p.title || p.name), h('small', { class: 'muted' }, kind === 'review' ? 'you passed it ' + ago + ' day' + (ago === 1 ? '' : 's') + ' ago' : LSTEP[id] ? LSTEP[id].ls.name : p.style ? p.style + ' · level ' + p.lvl : ''), h('span', { class: 'td-tick', 'aria-label': todayDone(id) ? 'done today' : 'to do' }, todayDone(id) ? '✓' : '')); }).filter(Boolean);
  const all = T.ids.every(([, id]) => todayDone(id));
  return h('div', { class: 'td' },
    h('div', { class: 'td-top' }, h('span', { class: 'td-streak', id: 'tdStreak' }, st ? '🔥 ' + st + '-day streak' : 'Start a streak today'), h('span', { class: 'muted' }, wk + ' step' + (wk === 1 ? '' : 's') + ' passed this week')),
    h('ol', { class: 'td-list' }, rows),
    h('div', { class: 'td-go' }, h('button', { class: 'btn primary', id: 'lnToday', type: 'button', onclick: todayStart }, all ? '▶ Go again' : '▶ Start today’s session'), all ? h('span', { class: 'muted small' }, '✓ Done for today. A new plan tomorrow.') : h('span', { class: 'muted small' }, 'About fifteen minutes. Reviews come back after 1, 3, 7, 14 and 30 days, so what you learn sticks.')));
}

/* ---------- 🎵 This song ---------- */
const songKey = () => 'song.' + String((typeof PRJ !== 'undefined' && PRJ.cur) || S.title || 'untitled').replace(/\W+/g, '_').slice(0, 40);
const secChords = sec => sec.bars.map(b => String(b.chord || '').trim().split(/\s+/)[0]).filter(c => c && parseChord(c));
function songLessons() {
  const sid = songKey(), target = Math.round(S.bpm), start = Math.max(40, Math.min(target, Math.round(target * .7 / 5) * 5)), bpm = Math.min(target, Math.max(start, CFG.learn.sbpm[sid] || start)), out = [], title = S.title || 'this song';
  const firstCh = S.sections.map(secChords).find(c => c.length); if (!firstCh) return [];
  const sty = S.band && S.band.compStyle && STRUMS[S.band.compStyle] ? S.band.compStyle : 'Down 4s', pat = (STRUMS[sty].p || 'D...D...D...D...').padEnd(16, '.').slice(0, 16).replace(/[0-9]/g, 'D').replace(/[^Ddumx.]/g, '.');
  const base = { bpm, target, song: sid };
  out.push(Object.assign({ kind: 'info', id: sid + '.intro', title: 'Learn “' + title + '”', text: 'Its strum first, then each part: the chords in time, and the riff where the tab has one. Then the whole song. You start at ' + bpm + ' BPM; every clean go is 5 faster, up to the song’s own ' + target + '.' }, base));
  out.push(Object.assign({ kind: 'rhythm', id: sid + '.strum', title: 'The strum: ' + sty, text: 'This song’s strum, on ' + firstCh[0] + ', with the click: D is a down-strum, u is up. Keep your arm moving down and up even when it does not hit.', pattern: pat, bars: 4, len: 16, back: { drums: true, bass: true, chords: [firstCh[0]] } }, base));
  const seen = new Set();
  S.sections.forEach((sec, si) => {
    const ch = secChords(sec), key = sec.name.replace(/\s*\d+$/, '') + '|' + ch.join(','); if (seen.has(key)) return; seen.add(key);
    if (ch.length) out.push(Object.assign({ kind: 'changes', id: sid + '.' + si + '.chords', title: sec.name + ': the chords', text: sec.name + ': ' + ch.join(' – ') + ', a bar each. Change when the band does; start moving on beat 4.', bars: Math.min(16, Math.max(4, ch.length)), len: 16 * Math.min(16, ch.length), back: { drums: true, bass: true, chords: ch.slice(0, 16) } }, base));
    const r = learnFromSong(si, true); if (r) out.push(Object.assign(r, { id: sid + '.' + si + '.riff', title: sec.name + ': the riff', text: 'The tab of ' + sec.name + ', note by note. When it is clean, press ⏱ In time.' }, base, { bpm: Math.min(bpm, r.bpm || bpm) }));
  });
  const all = S.sections.flatMap(secChords).slice(0, 32);
  if (all.length > 1) out.push(Object.assign({ kind: 'changes', id: sid + '.whole', title: 'The whole song', text: 'Every bar’s chord, start to end' + (all.length >= 32 ? ' (the first 32 bars)' : '') + '. This is the song.', bars: all.length, len: 16 * all.length, back: { drums: true, bass: true, chords: all } }, base));
  return out;
}
function songActions(p) { return p.kind === 'notes' || p.kind === 'timed' ? [h('button', { class: 'btn sm', id: 'coTimed', type: 'button', onclick: () => { CO.p = Object.assign({}, p, { kind: p.kind === 'timed' ? 'notes' : 'timed', back: { drums: true } }); CO.list[CO.idx] = CO.p; coBuild(); } }, p.kind === 'timed' ? '♪ Note by note' : '⏱ In time')] : []; }
function songStart(at) { const ps = songLessons(); if (!ps.length) { toast('This song has no chords yet. Write some, paste a chord sheet, or load a track.', 'warn'); return null; } return coachOpen(ps, at || 0, { title: '🎵 ' + (S.title || 'This song'), actions: songActions }); }
bus.on('coach:done', e => { if (!e || !e.ok || !CO.p || !CO.p.song) return; CFG.learn.sbpm[CO.p.song] = Math.min(CO.p.target || 999, CO.bpm); saveCfg(); CO.list.forEach(q => { if (q && typeof q === 'object' && q.song === CO.p.song) q.bpm = Math.max(q.bpm || 0, CFG.learn.sbpm[CO.p.song]); }); });
function songView() {
  const ps = songLessons(); if (!ps.length) return h('p', { class: 'small muted' }, 'Open a song with chords (☰ Songs), paste a chord sheet, or load a track, and it will be taught here.');
  const sid = songKey(), cur = CFG.learn.sbpm[sid], n = ps.filter(p => p.kind !== 'info').length, done = ps.filter(p => p.kind !== 'info' && CFG.learn.done[p.id]).length;
  return h('div', { class: 'sg' }, h('p', { class: 'small' }, h('b', {}, S.title || 'This song'), ' · ' + n + ' steps · ' + done + ' done · ' + (cur ? 'you are at ' + cur + ' of ' + Math.round(S.bpm) + ' BPM' : 'starts at ' + ps[0].bpm + ', the song is ' + Math.round(S.bpm) + ' BPM')),
    h('ol', { class: 'sg-list' }, ps.map((p, k) => p.kind === 'info' ? null : h('li', {}, h('button', { class: 'ln-ls' + (CFG.learn.done[p.id] ? ' done' : ''), type: 'button', 'data-song-step': k, onclick: () => songStart(k) }, h('span', {}, p.title), h('small', { class: 'mono' }, CFG.learn.done[p.id] ? '✓' : ''))))),
    h('button', { class: 'btn primary', id: 'lnSong', type: 'button', onclick: () => songStart(0) }, '▶ Teach me this song'));
}

/* ---------- 👂 By ear ---------- */
const EAR = { len: 3, fails: 0 };
const EAR_SCALES = ['Minor Pentatonic', 'Major Pentatonic', 'Natural Minor (Aeolian)', 'Major (Ionian)', 'Blues'];
/** a phrase of `len` notes on the scale, mostly by step, starting on the root (or for longer ones the fifth or the octave) */
function earLick(len, seed, o) {
  o = o || CFG.learn.ear; const R = labRng(seed * 7919 + len * 31 + 7), iv = SCALES[o.scale] || SCALES['Minor Pentatonic'], pool = [];
  for (let oc = 0; oc < 2; oc++) iv.forEach(x => pool.push(x + 12 * oc)); pool.push(24);
  const starts = len < 4 ? [0] : [0, pool.indexOf(7), pool.indexOf(12)].filter(x => x >= 0); let k = starts[Math.floor(R() * starts.length)], prev = -1; const src = [];
  for (let j = 0; j < len; j++) {
    if (j) { const cap = len <= 3 ? 5 : 7; let nk, tries = 0; do { const r = R(), st = r < .65 ? 1 : r < .9 ? 2 : 3; nk = Math.max(0, Math.min(pool.length - 1, k + (R() < .5 ? -st : st))); tries++; } while (tries < 60 && (nk === k || nk === prev || Math.abs(pool[nk] - pool[k]) > cap)); if (nk === k) nk = k ? k - 1 : 1; prev = k; k = nk; }      /* by step mostly; never more than a fifth (a fourth in short ones) */
    src.push({ at: j * 4, len: j === len - 1 ? 8 : 4, i: pool[k] });
  }
  const key = o.key != null ? o.key : S.key, first = src[0].i % 12, hint = first === 0 ? 'the root (' + pcName(key, false) + ')' : first === 7 ? 'the fifth' : 'a ' + pcName((key + first) % 12, false);
  return { kind: 'notes', ear: true, id: 'ear.' + len + '.' + seed, title: 'By ear · ' + len + ' notes', text: 'Listen, then play it back. ' + o.scale.replace(/ \(.*\)/, '') + ' in ' + pcName(key, false) + '. Stuck? ▶ Hear it again, or 👁 Show me.', src, len: rfLen(src), keyPc: key, lift: 12, near: 5, bpm: 76, keyed: false, ladder: false, hint };
}
function earStart() {
  const o = CFG.learn.ear; EAR.len = Math.max(2, Math.min(8, o.len || 3)); EAR.fails = 0; const s0 = Math.floor(Math.random() * 1e5);
  const list = Array.from({ length: 12 }, (_, k) => () => earLick(EAR.len, s0 + k, o));
  return coachOpen(list, 0, { title: '👂 By ear', key: o.key != null ? o.key : S.key });
}
bus.on('coach:done', e => {
  if (!e || !/^ear\./.test(e.id || '')) return; const o = CFG.learn.ear;
  if (e.ok) { if (!CO.reveal) { o.best = Math.max(o.best || 0, EAR.len); EAR.len = Math.min(8, EAR.len + 1); } EAR.fails = 0; saveCfg();
    const idx = CO.idx; setTimeout(() => { const d = document.getElementById('coach'); if (d && d.open && !CO.run && CO.idx === idx && idx < CO.list.length - 1) coSetPiece(idx + 1); }, 1800); }
  else if (++EAR.fails >= 2) { EAR.len = Math.max(2, EAR.len - 1); EAR.fails = 0; }
});
function earView() {
  const o = CFG.learn.ear, set = (k, v) => { o[k] = v; saveCfg(); };
  return h('div', { class: 'ln-lab' }, h('p', { class: 'small' }, 'Call and response: the coach plays a short phrase and you play it back, by ear. Get it and the next one is a note longer; miss two in a row and it is a note shorter. Your best: ' + (o.best ? o.best + ' notes' : 'not yet') + '.'),
    h('div', { class: 'ln-filt' },
      h('label', { class: 'field' }, 'Scale', h('select', { class: 'in', id: 'earScale', onchange: e => set('scale', e.target.value) }, EAR_SCALES.map(x => h('option', { value: x, selected: o.scale === x }, x.replace(/ \(.*\)/, ''))))),
      h('label', { class: 'field' }, 'Key', h('select', { class: 'in', id: 'earKey', onchange: e => set('key', e.target.value === '' ? null : +e.target.value) }, [h('option', { value: '' }, 'The song’s (' + pcName(S.key, false) + ')')].concat(NS.map((_, k) => h('option', { value: k, selected: o.key === k }, pcName(k, false)))))),
      h('label', { class: 'field' }, 'Start with', h('select', { class: 'in', id: 'earLen', onchange: e => set('len', +e.target.value) }, [2, 3, 4, 5].map(n => h('option', { value: n, selected: (o.len || 3) === n }, n + ' notes'))))),
    h('button', { class: 'btn primary', id: 'lnEar', type: 'button', onclick: earStart }, '🎧 Start'));
}
