/* ============================================================
   Part 69 · Progress journal and Welcome Back (2.12)
   THE JOURNAL  A small record, kept only on this device, of what you did and when: the days you played, the minutes, the chords the app heard you
   hold steady, the ideas you recorded, the songs you marked finished, and how often you landed a chord change in time. It stores counts and dates,
   not sound and not the notes you played. It is read by Welcome Back (the first page for someone who has been here before) and by My progress.
   A “session” is a visit with at least a minute of playing, recording or editing in it. A chord is “learned” once it has been held steady five times.
   A chord change counts as an attempt when you were holding the old chord as the song moved on, and as a hit when the new chord was heard within
   two beats. It depends on chord detection, so it is a guide, not a grade; with speakers instead of headphones the band can be heard as you.
   ============================================================ */
const JN = { d: null, t0: 0, vis: 0, counted: false, lastAct: 0, edit: -1e9, inp: -1e9, run: null, seen: {}, win: null, prev: null, saveT: 0 };
const JN_FRESH = () => ({ v: 1, since: Date.now(), days: {}, old: { t: 0, s: 0, i: 0 }, heard: {}, learned: {}, songs: {}, pairs: {}, last: {}, focus: '' });

const jnDay = t => { const d = new Date(t == null ? Date.now() : t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const jnDate = k => { const m = /^(\d+)-(\d+)-(\d+)$/.exec(k); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(NaN); };
const jnShift = (k, n) => { const d = jnDate(k); d.setDate(d.getDate() + n); return jnDay(d.getTime()); };
const jnDiff = (a, b) => Math.round((jnDate(b) - jnDate(a)) / 864e5);       // whole calendar days from a to b

function jnLoad() {
  if (JN.d) return JN.d;
  let d = store.get('jn', null);
  if (!d || d.v !== 1 || typeof d.days !== 'object' || !d.days) d = JN_FRESH();
  ['heard', 'learned', 'songs', 'pairs', 'last'].forEach(k => { if (!d[k] || typeof d[k] !== 'object') d[k] = {}; }); if (!d.old) d.old = { t: 0, s: 0, i: 0 };
  const keys = Object.keys(d.days).sort();                                   // three years of days are kept one by one; older ones are folded into totals
  if (keys.length > 1100) keys.slice(0, keys.length - 1100).forEach(k => { const r = d.days[k]; d.old.t += r.t || 0; d.old.s += r.s || 0; d.old.i += r.i || 0; delete d.days[k]; });
  return (JN.d = d);
}
function jnSave(now) { clearTimeout(JN.saveT); JN.saveT = 0; if (now) { if (JN.d) store.set('jn', JN.d); return; } JN.saveT = setTimeout(() => { JN.saveT = 0; if (JN.d) store.set('jn', JN.d); }, 4000); }
function jnBump(field, n = 1) { const d = jnLoad(), k = jnDay(), r = d.days[k] || (d.days[k] = { t: 0, s: 0, i: 0 }); r[field] = (r[field] || 0) + n; if (!JN.saveT) jnSave(); return r; }
function jnWhere() { const d = jnLoad(); d.last.song = { title: String(S.title || '').slice(0, 80), artist: String(S.artist || '').slice(0, 80), at: Date.now() }; }
/** an idea: a recording, a hum, or a capture of what you played */
function jnIdea(name, kind) { const d = jnLoad(); jnBump('i'); jnWhere(); d.last.rec = { name: String(name || 'Idea').slice(0, 90), kind: kind || 'take', at: Date.now(), song: (S.title || '').slice(0, 80) }; jnSave(true); }
/** the current song is finished (or not). Returns the new state. */
function jnFinish(on) {
  const d = jnLoad(), id = PRJ.cur || 'current'; const was = !!d.songs[id]; if (on == null) on = !was;
  if (on && !was) d.songs[id] = { title: String(S.title || 'Untitled').slice(0, 80), at: Date.now(), day: jnDay() }; if (!on) delete d.songs[id];
  jnSave(true); bus.emit('journal'); return on;
}
const jnIsFinished = () => !!jnLoad().songs[PRJ.cur || 'current'];

function jnChange(from, to, hit) {
  const d = jnLoad(), k = from + '>' + to, p = d.pairs[k] || (d.pairs[k] = { n: 0, h: '', f: '' });
  p.n++; p.h = (p.h + (hit ? 1 : 0)).slice(-30); if (p.f.length < 10) p.f += hit ? 1 : 0; p.at = Date.now(); jnSave(); return p;
}
function jnHeard(c) {
  const d = jnLoad(); d.heard[c] = (d.heard[c] || 0) + 1;
  if (!d.learned[c] && d.heard[c] >= 5) { d.learned[c] = jnDay(); jnSave(true); toast('New chord: ' + c + '. You have now held it steady five times.', 'ok'); }
  else jnSave();
}
const jnName = s => { const p = s ? parseChord(s) : null; return p ? p.name.replace(/\/.*$/, '') : null; };

/** one look at what is happening, about four times a second. o = { sym: the song's chord now, live: the chord heard, playing, bpm } */
function jnStep(now, o) {
  const live = jnName(o.live), song = o.playing ? jnName(o.sym) : null;
  if (live) { JN.seen[live] = now; if (JN.run && JN.run.c === live) { JN.run.k++; if (JN.run.k === 4) jnHeard(live); } else JN.run = { c: live, k: 1 }; } else JN.run = null;
  if (!song) { JN.win = null; JN.prev = null; return; }
  if (JN.win) {
    if (live === JN.win.to) { jnChange(JN.win.from, JN.win.to, true); JN.win = null; }
    else if (now > JN.win.end || song !== JN.win.to) { jnChange(JN.win.from, JN.win.to, false); JN.win = null; }
  }
  if (JN.prev && song !== JN.prev && JN.seen[JN.prev] != null && now - JN.seen[JN.prev] <= 1500) JN.win = { from: JN.prev, to: song, end: now + 120000 / (o.bpm || 90) + 250 };
  JN.prev = song;
}
function jnTick() {
  if (!E.ready || store.locked) return;
  const now = performance.now(), dt = JN.t0 ? Math.min(1, (now - JN.t0) / 1000) : 0; JN.t0 = now;
  const snd = !!(E.hasInput && AN.active), act = snd || !!REC || now - JN.edit < 20000;
  if (act && dt) {
    if (JN.lastAct && Date.now() - JN.lastAct > 30 * 60000) { JN.vis = 0; JN.counted = false; }
    JN.lastAct = Date.now(); JN.vis += dt; jnBump('t', dt);
    if (!JN.counted && JN.vis >= 60) { JN.counted = true; jnBump('s'); jnWhere(); jnSave(true); }
  }
  let sym = null, bpm = S.bpm; if (T.playing && E.ctx) { try { sym = stageInfo().sym; } catch (e) { } }
  jnStep(now, { sym, live: snd && AN.chord && AN.chord[0] ? AN.chord[0].sym : null, playing: !!T.playing && !!sym, bpm });
}

/* ---------- reading it back ---------- */
const jnPracticed = r => !!r && ((r.t || 0) >= 60 || (r.s || 0) > 0 || (r.i || 0) > 0);
function jnLastDay() { const d = jnLoad(); let best = null; for (const k in d.days) if (jnPracticed(d.days[k]) && (!best || k > best)) best = k; return best; }
function jnStreak() {
  const d = jnLoad(), today = jnDay(); let cur = 0, k = jnPracticed(d.days[today]) ? today : jnShift(today, -1);
  while (jnPracticed(d.days[k])) { cur++; k = jnShift(k, -1); }
  let best = 0, run = 0, prev = null; Object.keys(d.days).sort().forEach(x => { if (!jnPracticed(d.days[x])) return; run = prev && jnDiff(prev, x) === 1 ? run + 1 : 1; prev = x; if (run > best) best = run; });
  return { cur, best: Math.max(best, cur) };
}
/** counts from a day onward ('' = from the beginning) */
function jnSum(from) {
  const d = jnLoad(); const o = { sessions: 0, minutes: 0, chords: 0, ideas: 0, songs: 0, days: 0 };
  if (!from) { o.sessions += d.old.s || 0; o.ideas += d.old.i || 0; o.minutes += (d.old.t || 0) / 60; }
  for (const k in d.days) if (k >= from) { const r = d.days[k]; o.sessions += r.s || 0; o.ideas += r.i || 0; o.minutes += (r.t || 0) / 60; if (jnPracticed(r)) o.days++; }
  for (const c in d.learned) if (d.learned[c] >= from) o.chords++;
  for (const s in d.songs) if ((d.songs[s].day || '') >= from) o.songs++;
  o.minutes = Math.round(o.minutes); return o;
}
const jnPct = p => { const n = p.h.length; return n ? Math.round(100 * [...p.h].filter(x => x === '1').length / n) : 0; };
/** the chord change with the most attempts (at least five), with how it started if there is enough to tell */
function jnBestPair() {
  const d = jnLoad(); let best = null;
  for (const k in d.pairs) { const p = d.pairs[k]; if (p.n < 5) continue; if (!best || p.n > best.p.n) best = { k, p }; }
  if (!best) return null; const [a, b] = best.k.split('>'), now = jnPct(best.p), first = best.p.f.length >= 10 ? Math.round(100 * [...best.p.f].filter(x => x === '1').length / 10) : null;
  return { from: a, to: b, now, n: best.p.n, first: best.p.n >= 20 && first != null && now - first >= 10 ? first : null };
}
function jnAgo(k) {
  if (!k) return ''; const n = jnDiff(k, jnDay()); if (n <= 0) return 'today'; if (n === 1) return 'yesterday'; if (n < 14) return n + ' days ago';
  if (n < 60) return Math.round(n / 7) + ' weeks ago'; if (n < 700) return Math.round(n / 30.4) + ' months ago'; return Math.round(n / 365) + ' years ago';
}
const jnPlural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
function jnWorking() {
  const d = jnLoad(); if (d.focus) return { text: d.focus, mine: true };
  let t = d.last.song && d.last.song.title; if (!t) { const sv = store.get('song', null); t = sv && sv.title; } if (t === 'Untitled Idea') t = '';
  return { text: t || '', mine: false };
}
function jnHasAny() { const d = jnLoad(); return Object.keys(d.days).length > 0 || Object.keys(d.songs).length > 0; }

/* ---------- Welcome Back: the first page for someone who has been here before ---------- */
function wbRows() {
  const d = jnLoad(), rows = [], last = jnLastDay(), st = jnStreak(), wk = jnWorking(), pr = jnBestPair();
  if (last) rows.push(['Last practiced', jnAgo(last) + (jnDiff(last, jnDay()) > 6 ? ' (' + jnDate(last).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ')' : '')]);
  else { const at = +store.get('songAt', 0); if (at) rows.push(['Last worked on', jnAgo(jnDay(at))]); }
  if (last) rows.push(['Current streak', st.cur ? jnPlural(st.cur, 'day') : 'Starts again the next time you play' + (st.best > 1 ? ' · best so far ' + jnPlural(st.best, 'day') : '')]);
  rows.push(['Working on', wk.text || 'Nothing named yet', 'focus']);
  if (d.last.rec) rows.push(['Latest recording', d.last.rec.name + ' · ' + jnAgo(jnDay(d.last.rec.at))]);
  if (pr) rows.push(['Progress', pr.from + ' → ' + pr.to + ' changes now ' + pr.now + '% on time' + (pr.first != null ? ', up from ' + pr.first + '%' : '')]);
  else { const nc = Object.keys(d.learned).length; if (nc) rows.push(['Progress', jnPlural(nc, 'chord') + ' learned so far']); }
  return rows;
}
function wbSummary() {
  const y = new Date().getFullYear(), yr = jnSum(y + '-01-01'), all = jnSum(''), use = (yr.sessions || yr.ideas || yr.chords || yr.songs) ? yr : all, label = use === yr ? String(y) : 'All time';
  if (!(use.sessions || use.ideas || use.chords || use.songs)) return null;
  return label + ': ' + ['Played ' + jnPlural(use.sessions, 'session'), 'Learned ' + jnPlural(use.chords, 'chord'), 'Recorded ' + jnPlural(use.ideas, 'idea'), 'Completed ' + jnPlural(use.songs, 'song')].join(' · ');
}
function wbCard(start) {
  const d = jnLoad(), last = jnLastDay(), gap = last ? jnDiff(last, jnDay()) : 0;
  const head = gap >= 60 ? 'Welcome back. It has been ' + (gap >= 365 ? 'over a year' : Math.round(gap / 30.4) + ' months') + '.' : gap >= 14 ? 'Welcome back. It has been ' + Math.round(gap / 7) + ' weeks.' : 'Welcome back.';
  const sub = gap >= 14 ? 'Everything is saved on this device, just as you left it. Pick up where you stopped, or start something new.' : 'Pick up where you left off.';
  const dl = h('dl', { class: 'wb-list' }); const fillRows = () => {
    dl.innerHTML = '';
    wbRows().forEach(([k, v, f]) => {
      const dd = h('dd', {}, v); dl.append(h('dt', {}, k), dd);
      if (f) { dd.append(' ', h('button', { class: 'wb-edit', type: 'button', 'aria-label': 'Change what you are working on', title: 'Change what you are working on', onclick: () => {
        const inp = h('input', { class: 'in wb-in', value: jnLoad().focus || '', maxlength: 60, placeholder: 'For example: 90s alternative guitar', 'aria-label': 'What you are working on' }); dd.textContent = ''; dd.append(inp); inp.focus();
        const fin = ok => { inp.onblur = null; if (ok) { jnLoad().focus = inp.value.trim().slice(0, 60); jnSave(true); } fillRows(); }; inp.onblur = () => fin(true); inp.onkeydown = e => { if (e.key === 'Enter') fin(true); else if (e.key === 'Escape') fin(false); };
      } }, '✎')); }
    });
  };
  fillRows(); const sum = wbSummary();
  return h('section', { id: 'welcomeBack', class: 'wb', 'aria-label': 'Welcome back' }, h('h3', { class: 'wb-h' }, head), h('p', { class: 'wb-sub' }, sub), dl,
    sum ? h('p', { class: 'wb-sum', id: 'wbSummary' }, sum) : h('p', { class: 'wb-sum', id: 'wbSummary' }, jnHasAny() ? '' : 'Your journal starts now. It keeps counts and dates on this device, never sound.'),
    h('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } }, h('button', { class: 'btn sm', id: 'wbProgress', type: 'button', onclick: () => progressOpen() }, 'My progress…')));
}
/** called from the boot screen for people who have been here before */
function wbBoot() {
  const host = document.getElementById('bootRoutes'); if (!host || document.getElementById('welcomeBack')) return;
  host.parentNode.insertBefore(wbCard(), host);
  const wk = jnWorking(), nb = document.getElementById('bootNoMic');
  if (nb && wk.text) { const b = nb.querySelector('b'), s = nb.querySelector('span'); if (b) b.textContent = '● Pick up where I left off'; if (s) s.textContent = 'Opens ' + (jnLoad().last.song && jnLoad().last.song.title ? '“' + jnLoad().last.song.title + '”' : 'your last song') + ' and your last layout. Nothing is asked for until you choose.'; }
}

/* ---------- My progress ---------- */
function progressOpen() {
  const d = jnLoad(), box = h('div', { class: 'jn-dlg' }); let range = 'y';
  const from = () => range === 'a' ? '' : range === 'y' ? new Date().getFullYear() + '-01-01' : jnShift(jnDay(), -89);
  const draw = () => {
    box.innerHTML = ''; const s = jnSum(from()), st = jnStreak(), seg = (k, t) => h('button', { class: 'btn sm' + (range === k ? ' on' : ''), type: 'button', 'aria-pressed': String(range === k), onclick: () => { range = k; draw(); } }, t);
    box.append(h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', alignItems: 'center' } }, h('b', {}, 'Showing'), seg('d', 'Last 90 days'), seg('y', 'This year'), seg('a', 'All time')));
    const big = (n, t) => h('div', { class: 'jn-n' }, h('b', {}, String(n)), h('span', {}, t));
    box.append(h('div', { class: 'jn-nums', id: 'jnNums' }, big(s.sessions, s.sessions === 1 ? 'session played' : 'sessions played'), big(s.chords, s.chords === 1 ? 'chord learned' : 'chords learned'), big(s.ideas, s.ideas === 1 ? 'idea recorded' : 'ideas recorded'), big(s.songs, s.songs === 1 ? 'song completed' : 'songs completed')));
    box.append(h('p', { class: 'tiny muted', style: { margin: '2px 0 8px' } }, (s.minutes >= 120 ? Math.floor(s.minutes / 60) + ' hours ' + (s.minutes % 60) + ' minutes' : jnPlural(s.minutes, 'minute')) + ' of playing, recording and editing · streak ' + jnPlural(st.cur, 'day') + (st.best > st.cur ? ' · best ' + jnPlural(st.best, 'day') : '')));
    // the last twelve weeks, one square a day, so a quiet stretch and a steady one look different at a glance
    const today = jnDay(), dow = jnDate(today).getDay(), start = jnShift(today, -(dow + 77)), grid = h('div', { class: 'jn-grid', id: 'jnGrid', role: 'img' }); let on = 0, tot = 0;
    for (let c = 0; c < 12; c++) for (let r = 0; r < 7; r++) {
      const k = jnShift(start, c * 7 + r); if (k > today) { grid.append(h('i', { class: 'jn-c fut' })); continue; } const rec = d.days[k], m = rec ? Math.round((rec.t || 0) / 60) : 0, lv = !jnPracticed(rec) ? 0 : m < 10 ? 1 : m < 30 ? 2 : 3;
      tot++; if (lv) on++; grid.append(h('i', { class: 'jn-c l' + lv, title: jnDate(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + (lv ? ': ' + (m ? m + ' min' : 'played') : ': no practice') }));
    }
    grid.setAttribute('aria-label', 'Practice in the last twelve weeks: ' + on + ' of ' + tot + ' days'); box.append(h('h5', {}, 'The last twelve weeks'), grid, h('p', { class: 'tiny muted', style: { margin: '4px 0 0' } }, on + ' of the last ' + tot + ' days. Darker means more minutes.'));
    const pairs = Object.keys(d.pairs).filter(k => d.pairs[k].n >= 5).sort((a, b) => d.pairs[b].n - d.pairs[a].n).slice(0, 6);
    box.append(h('h5', {}, 'Chord changes'));
    if (!pairs.length) box.append(h('p', { class: 'tiny muted' }, 'Play along with a song using headphones and the app will notice how often you land each chord change in time. It shows a change here after five tries.'));
    else { const ul = h('ul', { class: 'jn-pairs', id: 'jnPairs' }); pairs.forEach(k => { const p = d.pairs[k], [a, b] = k.split('>'); ul.append(h('li', {}, h('b', {}, a + ' → ' + b), ' ' + jnPct(p) + '% on time', h('span', { class: 'muted' }, ' · ' + jnPlural(p.n, 'try', 'tries') + ' so far'))); }); box.append(ul); }
    const lc = Object.keys(d.learned).sort((a, b) => d.learned[a] < d.learned[b] ? 1 : -1);
    box.append(h('h5', {}, 'Chords you have learned'), lc.length ? h('div', { class: 'jn-chips', id: 'jnChords' }, lc.map(c => h('span', { class: 'jn-chip', title: 'First held steady five times on ' + jnDate(d.learned[c]).toLocaleDateString() }, c))) : h('p', { class: 'tiny muted' }, 'A chord shows here once the app has heard you hold it steady five times.'));
    const wk = jnWorking(), inp = h('input', { class: 'in', id: 'jnFocus', value: d.focus || '', maxlength: 60, placeholder: wk.text || 'For example: 90s alternative guitar', 'aria-label': 'What you are working on', style: { flex: '1', minWidth: '160px' }, onchange: e => { d.focus = e.target.value.trim().slice(0, 60); jnSave(true); } });
    const fin = h('button', { class: 'btn sm' + (jnIsFinished() ? ' on' : ''), id: 'jnFinish', type: 'button', 'aria-pressed': String(jnIsFinished()), onclick: () => { const v = jnFinish(); toast(v ? '“' + (S.title || 'This song') + '” is marked finished.' : 'Marked as still in progress.', 'ok'); draw(); } }, jnIsFinished() ? '✓ This song is finished' : 'Mark this song finished');
    box.append(h('h5', {}, 'Working on'), h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, inp, fin));
    box.append(h('div', { class: 'row', style: { gap: '8px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' } },
      h('button', { class: 'btn sm', type: 'button', onclick: () => download('daily-journal.json', JSON.stringify(jnLoad(), null, 2), 'application/json') }, '⤓ Download my journal'),
      h('button', { class: 'btn sm bad', id: 'jnErase', type: 'button', onclick: e => { if (!e.currentTarget.dataset.arm) { e.currentTarget.dataset.arm = '1'; e.currentTarget.textContent = 'Press again to erase'; setTimeout(() => { try { e.target.dataset.arm = ''; e.target.textContent = 'Erase my journal'; } catch (x) { } }, 4000); return; } JN.d = JN_FRESH(); jnSave(true); toast('Journal erased. Your songs and recordings are untouched.', 'ok'); draw(); } }, 'Erase my journal')));
    box.append(h('p', { class: 'tiny muted', style: { marginTop: '10px', lineHeight: 1.5 } }, 'Kept only on this device: counts and dates, never sound or the notes you played. A session is a visit with at least a minute of playing, recording or editing. Chord detection is a guide, so treat the accuracy as a rough sense of direction. With speakers instead of headphones the band can be heard as you.'));
  };
  draw(); return pdlg('progress', 'MY PROGRESS', box, { wide: true });
}

setInterval(() => { try { jnTick(); } catch (e) { if (!JN.err) { JN.err = 1; console.warn('journal', e); } } }, 250);
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, e => { if (e.isTrusted) JN.inp = performance.now(); }, true));
document.addEventListener('visibilitychange', () => { if (document.hidden) jnSave(true); });
window.addEventListener('pagehide', () => jnSave(true));
