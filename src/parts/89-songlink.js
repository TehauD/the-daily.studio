/* ============================================================
   Part 89 · SEND A SONG AS A LINK (2.40) — the song travels inside the link, after the #
   🔗 Send as a link packs the song: its title, key, tempo, time signature and tuning; every section with its chords, words and tab;
   the band (the beat, the drum pattern, bass, rhythm guitar, keys) and what the piano roll drew. It is squeezed with the browser's
   own compression and written after the # of an ordinary link to this studio. The part after # is never sent to any server, so the
   song goes from one person to another without being stored or uploaded anywhere. Recordings stay with you (a share page carries audio).
   Opening a link: the studio reads it, clears it from the address, and offers the song. It opens as a new song, so nothing of
   yours is replaced. Everything in a link is treated as untrusted: lengths are capped, numbers clamped, names checked against the
   studio's own lists, chords parsed, and the unpacked size limited before anything is used.
   Passing a song back and forth (2.51): a link can carry who sent it, a note, and a short history of the rounds (who changed which sections,
   and when). Whoever opens it gets ↩ Send it back, which knows who it came from and what they changed since. All of it rides in the link.
   Format: #s=1 + 'z' (deflate-raw) or 'j' (plain) + base64url of the JSON below (keys kept short so the link stays short).
   With recordings (2.54, part 89b): + '&r=' + where they are kept + '.' + the key that unlocks them (also after the #, so never sent).
   ============================================================ */
const SL = { v: '1', max: 60000, unz: 262144, long: 8000, qr: 2300 };
const SL_DR = '.gxX';
const slB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const slUnB64 = s => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
/** deflate-raw (or inflate, with a ceiling on what comes out) through the browser's own streams */
async function slZip(u8, inflate) {
  const cs = inflate ? new DecompressionStream('deflate-raw') : new CompressionStream('deflate-raw'), w = cs.writable.getWriter();
  w.write(u8).catch(() => { }); w.close().catch(() => { });
  const r = cs.readable.getReader(), parts = []; let n = 0;
  for (;;) { const { value, done } = await r.read(); if (done) break; n += value.length; if (n > SL.unz) { try { r.cancel(); } catch (e) { } throw new Error('it unpacks to more than a song can hold'); } parts.push(value); }
  const out = new Uint8Array(n); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out;
}
/** the song as the link carries it */
function slPack(s) {
  s = s || S; const B = s.band, L = Math.min(B.drumLen || 16, 32), pat = (s === S ? dpat() : B.pat || []).map(r => (r || []).slice(0, L).map(v => SL_DR[v | 0] || '.').join(''));
  const notes = a => Array.isArray(a) && a.length ? a.map(n => [n.m, n.s, n.d, n.v]) : 0;
  return { v: 1, t: s.title, a: s.artist && s.artist !== 'Your Name' ? s.artist : undefined,      /* not the demo song's placeholder */ k: s.key, m: s.minor ? 1 : 0, sc: s.scale, b: s.bpm, ts: s.ts, sw: s.swing || undefined, cp: s.capo || undefined, tn: s.tuningName, tu: TUNINGS[s.tuningName] ? undefined : s.tuning,
    x: s.sections.map(sec => { const row = [sec.name, sec.bars.map(b => b.chord || '').join('|'), sec.lyrics || ''];
      const tab = sec.bars.some(b => b.tab && b.tab.length), ky = sec.bars.some(b => b.keys && b.keys.length), bl = sec.bars.some(b => b.bassLine && b.bassLine.length);
      if (tab || ky || bl) row.push(tab ? sec.bars.map(b => (b.tab || []).map(n => n.bend != null ? [n.s, n.st, n.f, n.t || '', n.bend] : [n.s, n.st, n.f, n.t || ''])) : 0, ky ? sec.bars.map(b => notes(b.keys)) : 0, bl ? sec.bars.map(b => notes(b.bassLine)) : 0);
      if (sec.energy >= 1) { while (row.length < 6) row.push(0); row.push(sec.energy); }      /* 2.44: the section's energy */
      return row; }),
    c: s.collab && s.collab.out ? s.collab.out : undefined,      /* 2.51: who sent it, a note, the rounds so far */
    bd: { d: B.drumsOn ? 1 : 0, kit: B.kit, pn: B.patName, p: pat, bo: B.bassOn ? 1 : 0, bs: B.bassStyle, bt: B.bassTone, co: B.compOn ? 1 : 0, cs: B.compStyle, ci: B.compInst, lo: B.leadOn ? 1 : 0, li: B.leadInst, ko: B.keysOn ? 1 : 0, ks: B.keysStyle, kn: B.keysSound, beat: B.beat || undefined, bu: B.build ? 1 : undefined } };
}
/** a song from a link, rebuilt from scratch: only what is checked is kept */
function slUnpack(o) {
  if (!o || typeof o !== 'object' || o.v !== 1) throw new Error('it is not a song link this studio knows');
  const str = (x, n) => String(x == null ? '' : x).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, n);
  const int = (x, a, b, d) => { x = Math.round(+x); return Number.isFinite(x) ? clamp(x, a, b) : d; };
  const pick = (x, list, d) => list.includes(x) ? x : d, own = (O, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(O, k) && Array.isArray(O[k]);      /* never “__proto__” and the like */
  const s = newSong(); s.title = str(o.t, 80).trim() || 'A song for you'; s.artist = str(o.a, 80).trim();
  s.key = int(o.k, 0, 11, 9); s.minor = !!o.m; s.scale = own(SCALES, o.sc) ? o.sc : (s.minor ? 'Natural Minor (Aeolian)' : 'Major (Ionian)');
  s.bpm = int(o.b, 30, 260, 92); if (Array.isArray(o.ts)) s.ts = [int(o.ts[0], 1, 16, 4), pick(+o.ts[1], [2, 4, 8, 16], 4)];
  s.swing = clamp(+o.sw || 0, 0, .5); s.capo = int(o.cp, 0, 12, 0);
  if (own(TUNINGS, o.tn)) { s.tuningName = o.tn; s.tuning = TUNINGS[o.tn].slice(); }
  else if (Array.isArray(o.tu) && o.tu.length >= 4 && o.tu.length <= 7) { s.tuning = o.tu.map(m => int(m, 12, 100, 40)); s.tuningName = str(o.tn, 40).trim() || 'Custom'; }
  const ns = s.tuning.length, chordOk = c => c.length <= 14 && !!parseChord(c);
  const notes = (a, lo, hi) => Array.isArray(a) ? a.slice(0, 128).filter(Array.isArray).map(n => ({ m: int(n[0], lo, hi, 60), s: int(n[1], 0, 63, 0), d: int(n[2], 1, 64, 1), v: clamp(+n[3] || .8, .05, 1) })) : [];
  let total = 0;
  s.sections = (Array.isArray(o.x) ? o.x : []).slice(0, 48).map(r => {
    if (!Array.isArray(r) || total >= 400) return null;
    const chords = str(r[1], 6000).split('|').slice(0, 400 - total); total += chords.length;
    const sec = mkSection(str(r[0], 40).trim() || 'Section', chords.map(c => c.trim().split(/\s+/).filter(chordOk).slice(0, 4).join(' ')));
    sec.lyrics = str(r[2], 6000); if (r[6] != null) { const e = int(r[6], 1, 5, 0); if (e) sec.energy = e; }
    sec.bars.forEach((bar, i) => {
      const tb = Array.isArray(r[3]) && r[3][i]; if (Array.isArray(tb)) bar.tab = tb.slice(0, 96).filter(Array.isArray).map(n => {
        const f = n[2] === 'x' ? 'x' : int(n[2], 0, 24, 0), x = { s: int(n[0], 0, 63, 0), st: int(n[1], 0, ns - 1, 0), f, t: /^[a-z~/\\^]{0,3}$/i.test(String(n[3] || '')) ? String(n[3] || '') : '' };
        if (n[4] != null && Number.isFinite(+n[4])) x.bend = clamp(+n[4], 0, 30); return x; });
      const ky = Array.isArray(r[4]) && r[4][i]; if (ky) bar.keys = notes(ky, 21, 108);
      const bl = Array.isArray(r[5]) && r[5][i]; if (bl) bar.bassLine = notes(bl, 16, 72);
    });
    return sec.bars.length ? sec : null;
  }).filter(Boolean);
  if (!s.sections.length) throw new Error('it holds no bars');
  const d = o.bd && typeof o.bd === 'object' ? o.bd : {}, B = s.band, INSTR = ['Steel', 'Nylon', 'Electric', 'Muted Pluck'];
  B.drumsOn = !!d.d; B.kit = pick(BAND_RENAME.kit[d.kit] || d.kit, Object.keys(KITS), B.kit); B.bassOn = !!d.bo; B.bassStyle = pick(d.bs, BASS_STYLES, B.bassStyle); B.bassTone = pick(BAND_RENAME.tone[d.bt] || d.bt, BASS_TONES, B.bassTone);
  B.compOn = !!d.co; B.compStyle = pick(d.cs, Object.keys(STRUMS), B.compStyle); B.compInst = pick(d.ci, INSTR, B.compInst); B.leadOn = !!d.lo; B.leadInst = pick(d.li, INSTR, B.leadInst);
  B.keysOn = !!d.ko; B.keysStyle = pick(d.ks, KEYS_STYLES, B.keysStyle); B.keysSound = pick(d.kn, KEYS_SOUNDS, B.keysSound); B.beat = pick(d.beat, BEATS.map(b => b.id), undefined); B.build = !!d.bu;
  B.patName = str(d.pn, 48).trim() || B.patName;
  if (Array.isArray(d.p) && d.p.length) { const L = clamp(Math.max(...d.p.slice(0, 6).map(r => String(r || '').length)), 4, 32); B.drumLen = L; B.pat = DROWS.map((_, i) => Array.from({ length: 32 }, (_, j) => j < L ? Math.max(0, SL_DR.indexOf(String(d.p[i] || '')[j] || '.')) : 0)); }
  if (o.c && typeof o.c === 'object') {      /* 2.51: who sent it, their note, the rounds so far */
    const c = o.c, hist = (Array.isArray(c.h) ? c.h : []).slice(-SLC.keep).filter(Array.isArray).map(x => [str(x[0], 40).trim() || 'Someone', int(x[1], 0, 200000, 0), str(x[2], 140).trim()]);
    s.collab = { id: /^[a-z0-9]{6,16}$/.test(String(c.id || '')) ? c.id : slcId(), with: str(c.f, 40).trim(), note: str(c.n, SLC.note).trim(), hist };
  }
  if (s.collab) slcMark(s);      /* what it was when it arrived, to tell what changes before it goes back */
  return s;
}
/* ---------- passing a song back and forth (2.51) ---------- */
const SLC = { keep: 8, note: 280 };
const slcId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => (b % 36).toString(36)).join('') + Date.now().toString(36).slice(-4);
const slcDay = () => Math.floor(Date.now() / 864e5);
/** a short fingerprint of each section (its chords and words), by name */
function slcPrints(s) { const out = {}; s.sections.forEach(sec => { const t = sec.bars.map(b => b.chord || '').join('|') + '\u0001' + (sec.lyrics || ''); let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } out[sec.name] = (h >>> 0).toString(36); }); return out; }
/** what changed since the song arrived (or since it was last sent): "wrote Chorus, changed Verse 2, added Bridge" */
function slcChanges(s) {
  s = s || S; const c = s.collab; if (!c || !c.base) return 'started the song';
  const now = slcPrints(s), was = c.base, had = c.words || {}, names = Object.keys(now), wrote = [], changed = [], added = names.filter(n => !(n in was)), gone = Object.keys(was).filter(n => !(n in now));
  names.forEach(n => { if (!(n in was) || now[n] === was[n]) return; const sec = s.sections.find(x => x.name === n); (sec && (sec.lyrics || '').trim() && !had[n] ? wrote : changed).push(n); });
  const say = (verb, list) => list.length ? verb + ' ' + (list.length > 3 ? list.slice(0, 3).join(', ') + ' and ' + (list.length - 3) + ' more' : list.join(', ')) : '';
  return [say('wrote words for', wrote), say('changed', changed), say('added', added), say('took out', gone)].filter(Boolean).join('; ') || 'sent it on as it was';
}
/** remember the song as it is now, to tell what changes next */
function slcMark(s) { s = s || S; if (!s.collab) return; s.collab.base = slcPrints(s); s.collab.words = Object.fromEntries(s.sections.map(x => [x.name, !!(x.lyrics || '').trim()])); }
const slcWhen = d => { const k = slcDay() - d; return k <= 0 ? 'today' : k === 1 ? 'yesterday' : k < 7 ? k + ' days ago' : new Date(d * 864e5).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
/** the rounds, newest last, as a list */
const slcHistEl = hist => hist && hist.length ? h('ol', { class: 'slc-hist', 'aria-label': 'The rounds so far' }, hist.slice(-5).map(([who, d, what]) => h('li', {}, h('b', {}, who), ' · ' + slcWhen(d) + (what ? ': ' + what : '')))) : '';
/** where a link should point: this page when it is on the web, the public studio when it was opened from disk or another site */
const slBase = () => /^https?:$/.test(location.protocol) && !/codepen|cdpn/.test(location.hostname) ? location.origin + location.pathname : BRAND.url;
/** the link for a song (the open one unless given) */
async function slLink(s) {
  const u = new TextEncoder().encode(JSON.stringify(slPack(s)));
  const body = typeof CompressionStream === 'function' ? 'z' + slB64(await slZip(u)) : 'j' + slB64(u);
  return slBase() + '#s=' + SL.v + body;
}
/** a link (or just the part after #) back into a song */
async function slRead(text) {
  const m = /#?s=1([zj])([A-Za-z0-9_-]+)(?:&r=([A-Za-z0-9_.-]{1,140}))?\s*$/.exec(String(text || '')); if (!m) throw new Error('it is not a song link');
  if (m[2].length > SL.max) throw new Error('it is longer than a song link can be');
  let u = slUnB64(m[2]);
  if (m[1] === 'z') { if (typeof DecompressionStream !== 'function') throw new Error('this browser cannot unpack it (a newer browser can)'); u = await slZip(u, true); }
  if (u.length > SL.unz) throw new Error('it is bigger than a song can be');
  let o; try { o = JSON.parse(new TextDecoder().decode(u)); } catch (e) { throw new Error('it is damaged (part of the link may be missing)'); }
  const song = slUnpack(o); if (m[3] && SRX_ATT.test(m[3])) Object.defineProperty(song, '_att', { value: m[3], enumerable: false, configurable: true });      /* recordings: never saved with the song */
  return song;
}
const slSummary = s => { const bars = s.sections.reduce((a, x) => a + x.bars.length, 0), words = s.sections.some(x => (x.lyrics || '').trim()), tab = s.sections.some(x => x.bars.some(b => b.tab && b.tab.length)), beat = s.band.beat && BEATS.find(b => b.id === s.band.beat);
  return [pcName(s.key, keyUsesFlats(s.key, s.minor)) + (s.minor ? ' minor' : ' major'), s.bpm + ' BPM', s.sections.length + (s.sections.length === 1 ? ' section' : ' sections'), bars + ' bars', words ? 'words' : '', tab ? 'tab' : '', beat ? 'beat: ' + beat.name : ''].filter(Boolean).join(' · '); };

/* ---------- 🔗 sending (and ↩ sending back, 2.51) ---------- */
/** what the send buttons say: Send back to whoever the song came from, or Send as a link */
const slSendLabel = short => S.collab && S.collab.with ? '↩ Send back' + (short ? '' : ' to ' + S.collab.with) : (short ? '🔗 Send' : '🔗 Send as a link');
async function slShare() {
  const c = S.collab, back = !!(c && c.with), what = c ? slcChanges() : '';
  let url = '', built = null, sent = false;
  const nameIn = h('input', { class: 'in slc-name', id: 'slName', maxlength: 40, autocomplete: 'nickname', placeholder: 'Your name', value: CFG.slName || '', 'aria-label': 'Your name, so they know who sent it' });
  const noteIn = h('textarea', { class: 'in slc-noteIn', id: 'slNote', maxlength: SLC.note, rows: 2, placeholder: back ? 'A note for ' + c.with + ': what you did, or what comes next' : 'A note: “Can you write the chorus?”', 'aria-label': 'A note to go with the song' });
  const out = () => { const hist = ((c && c.hist) || []).concat([[nameIn.value.trim() || 'Someone', slcDay(), what || 'started the song']]).slice(-SLC.keep); return { id: (c && c.id) || (S.collab && S.collab.id) || (slShare.id = slShare.id || slcId()), f: nameIn.value.trim(), n: noteIn.value.trim(), h: hist }; };
  const build = () => built = (async () => { const prev = S.collab; S.collab = Object.assign({}, prev || {}, { out: out() }); try { url = await slLink(); if (SRS.att) url += '&r=' + SRS.att; } finally { S.collab = prev; } inp.value = url; long.hidden = url.length <= SL.long; long.textContent = 'This link is long (' + url.length.toLocaleString() + ' characters), so some chat apps may cut it short. Email, notes and most messengers keep it whole.'; qrBox.innerHTML = ''; qrBox.hidden = true; qrB.disabled = url.length > SL.qr; })();
  /** the round is part of the song once it has gone: the next send says what changed after this one */
  const gone = () => { if (sent) return; sent = true; const o = out(); S.collab = { id: o.id, with: c && c.with || '', note: c && c.note || '', hist: o.h }; slcMark(S); commit(false); };
  const qrBox = h('div', { class: 'sl-qr', hidden: true }), inp = h('input', { class: 'in sl-url', id: 'slUrl', readonly: true, value: '', 'aria-label': 'The link', onfocus: e => e.target.select() }), long = h('p', { class: 'tiny sl-long', hidden: true });
  const ready = async () => { if (SRS.busy) await SRS.busy.catch(() => { }); await built; };
  const copy = async () => { await ready(); try { await navigator.clipboard.writeText(url); toast('Link copied. Paste it in a message to ' + (back ? c.with : 'whoever you are writing with') + '.', 'ok'); } catch (e) { inp.select(); document.execCommand && document.execCommand('copy'); toast('Link selected: copy it with Ctrl+C (⌘C on a Mac).', ''); } gone(); };
  const qrB = h('button', { class: 'btn', id: 'slQr', type: 'button', title: 'Show a code to scan with a phone', onclick: async () => { await ready(); if (!qrBox.childNodes.length) qrBox.innerHTML = qrSvg(qrMake(url)); qrBox.hidden = !qrBox.hidden; gone(); } }, '▦ QR code');
  let tm = 0; const again = () => { clearTimeout(tm); tm = setTimeout(build, 250); };
  nameIn.addEventListener('input', () => { CFG.slName = nameIn.value.trim().slice(0, 40); saveCfg(); again(); }); noteIn.addEventListener('input', again);
  const old = document.getElementById('slDlg'); if (old) old.remove();
  const d = h('dialog', { class: 'sl-dlg', id: 'slDlg', 'aria-labelledby': 'slH' },
    h('h3', { id: 'slH' }, back ? '↩ Send “' + S.title + '” back to ' + c.with : '🔗 Send “' + S.title + '” as a link'),
    h('p', { class: 'sl-what' }, slSummary(S)),
    c ? h('div', { class: 'slc-box' }, what ? h('p', { class: 'small', id: 'slChanged' }, h('b', {}, 'Your changes: '), what) : '', slcHistEl(c.hist)) : '',
    h('div', { class: 'slc-form' }, h('label', { class: 'small' }, 'From', nameIn), h('label', { class: 'small' }, 'Note', noteIn)),
    h('p', { class: 'small muted' }, 'The chords, words, tab, the beat, the tempo and the key travel inside the link itself, with your name, your note and who changed what, after the #: a part of a link that is never sent to any server. Whoever opens it gets the song as a new song of their own, with ↩ Send it back.' + (TAKES.length ? ' Your recordings stay with you unless you include them.' : '')),
    srxRow(() => build()),
    inp, long,
    h('div', { class: 'row sl-acts' },
      h('button', { class: 'btn primary', id: 'slCopy', type: 'button', onclick: copy }, '⧉ Copy link'),
      navigator.share ? h('button', { class: 'btn', id: 'slSend', type: 'button', onclick: async () => { await ready(); navigator.share({ title: S.title, text: (nameIn.value.trim() ? nameIn.value.trim() + ' sent you' : 'Here is') + ' “' + S.title + '” on the-daily.studio' + (noteIn.value.trim() ? ': ' + noteIn.value.trim() : ''), url }).then(gone).catch(() => { }); } }, '↗ Share…') : null,
      qrB, h('span', { class: 'grow' }), h('button', { class: 'btn', type: 'button', onclick: () => d.close() }, 'Close')),
    qrBox);
  d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal();
  try { await build(); } catch (e) { d.close(); return toast('The link could not be made: ' + (e.message || e), 'bad'); }
  (nameIn.value ? noteIn : nameIn).focus();
}

/* ---------- opening one ---------- */
async function slOpen(song, playNow, perform) {
  const boot = document.getElementById('boot'), b = document.getElementById('bootNoMic'), att = song._att;
  if (boot && b && boot.getClientRects().length && getComputedStyle(boot).display !== 'none') b.click();      /* past the first page, as Begin in the studio does */
  let takes = null, lost = '';
  if (att) { try { takes = await srxReceive(att, t => toast(t)); } catch (e) { lost = e.message; } }      /* the recordings first: if they can't come, the song still does */
  delete song._att; await projCreate('import', { song, zoom: 'studio' }); if (takes && takes.length) { srxAdd(takes); await projSave(); }
  bus.emit('song', 'reload'); try { syncTransport(); syncBandStrip(); } catch (e) { }
  if (playNow) { try { await startAudio(); T.cursor = 0; T.loop = true; syncTransport(); play(); } catch (e) { console.warn(e); } }
  if (perform) { try { perfOpen(); const g = document.getElementById('pfGo'); if (g) g.click(); } catch (e) { console.warn(e); } }      /* a first visit through a link: the song as a sing-along */
  const from = S.collab && S.collab.with;
  if (lost) return toast(lost + ' The song opened without them' + (from ? ': ask ' + from + ' to send it again.' : '.'), 'warn');
  if (takes && takes.length) return toast('“' + S.title + '” is open as a new song with ' + takes.length + (takes.length === 1 ? ' recording' : ' recordings') + (from ? ' from ' + from + '. Add yours, then ↩ Send it back.' : '.'), 'ok');
  toast(from ? '“' + S.title + '” from ' + from + ' is open as a new song. Change what you like, then ↩ Send it back.' : '“' + S.title + '” is open as a new song. Your other songs are as they were.', 'ok');
}
function slWelcome(song) {
  const old = document.getElementById('slIn'); if (old) old.remove();
  const c = song.collab, from = c && c.with, first = !store.get('started', false);
  const go = (p, perf) => { d.close(); slOpen(song, p, perf).catch(e => toast('It could not be opened: ' + (e.message || e), 'bad')); };
  const d = h('dialog', { class: 'sl-dlg sl-in' + (first ? ' sl-first' : ''), id: 'slIn', 'aria-labelledby': 'slInH' },
    h('p', { class: 'sl-kick' }, from ? '🎵 ' + from + ' sent you a song' : '🎵 A song was sent to you'), h('h3', { id: 'slInH' }, song.title), song.artist ? h('p', { class: 'muted' }, song.artist) : null,
    c && c.note ? h('blockquote', { class: 'slc-note', id: 'slInNote' }, c.note) : null,
    h('p', { class: 'sl-what' }, slSummary(song)),
    c ? slcHistEl(c.hist) : null,
    song._att ? h('p', { class: 'small srx-in', id: 'srxIn' }, '🎙 With recordings, until ' + srxDate(srxUntil(song._att)) + '. ', h('button', { class: 'linkish tiny', id: 'srxRepBtn', type: 'button', onclick: () => srxReport(song._att) }, '⚑ Report')) : null,
    h('p', { class: 'small muted' }, (first ? 'This is the-daily.studio: a place to write, sing and play songs, free, in your browser, with no account. ' : '') + 'It opens as a new song' + (first ? '' : ', so none of yours change') + '. ' + (song._att ? 'The song came inside the link; its recordings are fetched encrypted from this site and unlocked with the link’s key.' : 'It came inside the link: nothing was downloaded from anyone.') + (from ? ' Change what you like, then ↩ Send it back to ' + from + '.' : '')),
    h('div', { class: 'row sl-acts' }, ...(first
      ? [h('button', { class: 'btn primary', id: 'slPlay', type: 'button', onclick: () => go(true, true) }, '▶ Play it'), h('button', { class: 'btn', id: 'slOpenBtn', type: 'button', onclick: () => go(false) }, 'Open it in the studio')]
      : [h('button', { class: 'btn primary', id: 'slPlay', type: 'button', onclick: () => go(true) }, '▶ Open and play'), h('button', { class: 'btn', id: 'slOpenBtn', type: 'button', onclick: () => go(false) }, 'Open'), h('span', { class: 'grow' }), h('button', { class: 'btn', type: 'button', onclick: () => d.close() }, 'Not now')])));
  d.addEventListener('close', () => setTimeout(() => d.remove(), 0)); document.body.append(d); d.showModal();
}
/** a song link in the address: read it, take it out of the address (so a reload does not offer it again), offer the song */
function slFromHash() {
  if (!/^#s=1[zj]/.test(location.hash || '')) return false; const text = location.hash;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
  slRead(text).then(slWelcome).catch(e => toast('That song link could not be opened: ' + (e.message || e) + '.', 'warn')); return true;
}
setTimeout(slFromHash, 400);      /* at once, over the first page too: a first visit should see the song before anything else */
window.addEventListener('hashchange', () => { slFromHash(); });
