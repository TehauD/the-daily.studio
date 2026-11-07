/* ============================================================
   Part 89 · SEND A SONG AS A LINK (2.40) — the song travels inside the link, after the #
   🔗 Send as a link packs the song: its title, key, tempo, time signature and tuning; every section with its chords, words and tab;
   the band (the beat, the drum pattern, bass, rhythm guitar, keys) and what the piano roll drew. It is squeezed with the browser's
   own compression and written after the # of an ordinary link to this studio. The part after # is never sent to any server, so the
   song goes from one person to another without being stored or uploaded anywhere. Recordings stay with you (a share page carries audio).
   Opening a link: the studio reads it, clears it from the address, and offers the song. It opens as a new song, so nothing of
   yours is replaced. Everything in a link is treated as untrusted: lengths are capped, numbers clamped, names checked against the
   studio's own lists, chords parsed, and the unpacked size limited before anything is used.
   Format: #s=1 + 'z' (deflate-raw) or 'j' (plain) + base64url of the JSON below (keys kept short so the link stays short).
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
  return { v: 1, t: s.title, a: s.artist || undefined, k: s.key, m: s.minor ? 1 : 0, sc: s.scale, b: s.bpm, ts: s.ts, sw: s.swing || undefined, cp: s.capo || undefined, tn: s.tuningName, tu: TUNINGS[s.tuningName] ? undefined : s.tuning,
    x: s.sections.map(sec => { const row = [sec.name, sec.bars.map(b => b.chord || '').join('|'), sec.lyrics || ''];
      const tab = sec.bars.some(b => b.tab && b.tab.length), ky = sec.bars.some(b => b.keys && b.keys.length), bl = sec.bars.some(b => b.bassLine && b.bassLine.length);
      if (tab || ky || bl) row.push(tab ? sec.bars.map(b => (b.tab || []).map(n => n.bend != null ? [n.s, n.st, n.f, n.t || '', n.bend] : [n.s, n.st, n.f, n.t || ''])) : 0, ky ? sec.bars.map(b => notes(b.keys)) : 0, bl ? sec.bars.map(b => notes(b.bassLine)) : 0);
      return row; }),
    bd: { d: B.drumsOn ? 1 : 0, kit: B.kit, pn: B.patName, p: pat, bo: B.bassOn ? 1 : 0, bs: B.bassStyle, bt: B.bassTone, co: B.compOn ? 1 : 0, cs: B.compStyle, ci: B.compInst, lo: B.leadOn ? 1 : 0, li: B.leadInst, ko: B.keysOn ? 1 : 0, ks: B.keysStyle, kn: B.keysSound, beat: B.beat || undefined } };
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
    sec.lyrics = str(r[2], 6000);
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
  B.drumsOn = !!d.d; B.kit = pick(d.kit, Object.keys(KITS), B.kit); B.bassOn = !!d.bo; B.bassStyle = pick(d.bs, BASS_STYLES, B.bassStyle); B.bassTone = pick(d.bt, BASS_TONES, B.bassTone);
  B.compOn = !!d.co; B.compStyle = pick(d.cs, Object.keys(STRUMS), B.compStyle); B.compInst = pick(d.ci, INSTR, B.compInst); B.leadOn = !!d.lo; B.leadInst = pick(d.li, INSTR, B.leadInst);
  B.keysOn = !!d.ko; B.keysStyle = pick(d.ks, KEYS_STYLES, B.keysStyle); B.keysSound = pick(d.kn, KEYS_SOUNDS, B.keysSound); B.beat = pick(d.beat, BEATS.map(b => b.id), undefined);
  B.patName = str(d.pn, 48).trim() || B.patName;
  if (Array.isArray(d.p) && d.p.length) { const L = clamp(Math.max(...d.p.slice(0, 6).map(r => String(r || '').length)), 4, 32); B.drumLen = L; B.pat = DROWS.map((_, i) => Array.from({ length: 32 }, (_, j) => j < L ? Math.max(0, SL_DR.indexOf(String(d.p[i] || '')[j] || '.')) : 0)); }
  return s;
}
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
  const m = /#?s=1([zj])([A-Za-z0-9_-]+)\s*$/.exec(String(text || '')); if (!m) throw new Error('it is not a song link');
  if (m[2].length > SL.max) throw new Error('it is longer than a song link can be');
  let u = slUnB64(m[2]);
  if (m[1] === 'z') { if (typeof DecompressionStream !== 'function') throw new Error('this browser cannot unpack it (a newer browser can)'); u = await slZip(u, true); }
  if (u.length > SL.unz) throw new Error('it is bigger than a song can be');
  let o; try { o = JSON.parse(new TextDecoder().decode(u)); } catch (e) { throw new Error('it is damaged (part of the link may be missing)'); }
  return slUnpack(o);
}
const slSummary = s => { const bars = s.sections.reduce((a, x) => a + x.bars.length, 0), words = s.sections.some(x => (x.lyrics || '').trim()), tab = s.sections.some(x => x.bars.some(b => b.tab && b.tab.length)), beat = s.band.beat && BEATS.find(b => b.id === s.band.beat);
  return [pcName(s.key, keyUsesFlats(s.key, s.minor)) + (s.minor ? ' minor' : ' major'), s.bpm + ' BPM', s.sections.length + (s.sections.length === 1 ? ' section' : ' sections'), bars + ' bars', words ? 'words' : '', tab ? 'tab' : '', beat ? 'beat: ' + beat.name : ''].filter(Boolean).join(' · '); };

/* ---------- 🔗 sending ---------- */
async function slShare() {
  let url; try { url = await slLink(); } catch (e) { return toast('The link could not be made: ' + (e.message || e), 'bad'); }
  const old = document.getElementById('slDlg'); if (old) old.remove();
  const qrBox = h('div', { class: 'sl-qr', hidden: true }), inp = h('input', { class: 'in sl-url', id: 'slUrl', readonly: true, value: url, 'aria-label': 'The link', onfocus: e => e.target.select() });
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast('Link copied. Paste it in a message to whoever you are playing with.', 'ok'); } catch (e) { inp.select(); document.execCommand && document.execCommand('copy'); toast('Link selected: copy it with Ctrl+C (⌘C on a Mac).', ''); } };
  const d = h('dialog', { class: 'sl-dlg', id: 'slDlg', 'aria-labelledby': 'slH' },
    h('h3', { id: 'slH' }, '🔗 Send “' + S.title + '” as a link'),
    h('p', { class: 'sl-what' }, slSummary(S)),
    h('p', { class: 'small muted' }, 'The chords, words, tab, the beat, the tempo and the key travel inside the link itself, after the #, a part of a link that is never sent to any server. Whoever opens it gets the song, ready to play, as a new song of their own. Your recordings stay with you; for audio, make a share page in Save & export.'),
    inp,
    url.length > SL.long ? h('p', { class: 'tiny sl-long' }, 'This link is long (' + url.length.toLocaleString() + ' characters), so some chat apps may cut it short. Email, notes and most messengers keep it whole.') : null,
    h('div', { class: 'row sl-acts' },
      h('button', { class: 'btn primary', id: 'slCopy', type: 'button', onclick: copy }, '⧉ Copy link'),
      navigator.share ? h('button', { class: 'btn', id: 'slSend', type: 'button', onclick: () => navigator.share({ title: S.title, text: '“' + S.title + '”, a song for you on the-daily.studio', url }).catch(() => { }) }, '↗ Share…') : null,
      h('button', { class: 'btn', id: 'slQr', type: 'button', disabled: url.length > SL.qr, title: url.length > SL.qr ? 'Too long for a QR code: copy the link instead' : 'Show a code to scan with a phone', onclick: () => { if (!qrBox.childNodes.length) qrBox.innerHTML = qrSvg(qrMake(url)); qrBox.hidden = !qrBox.hidden; } }, '▦ QR code'),
      h('span', { class: 'grow' }), h('button', { class: 'btn', type: 'button', onclick: () => d.close() }, 'Close')),
    qrBox);
  d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal(); inp.focus();
}

/* ---------- opening one ---------- */
async function slOpen(song, playNow) {
  const boot = document.getElementById('boot'), b = document.getElementById('bootNoMic');
  if (boot && b && boot.getClientRects().length && getComputedStyle(boot).display !== 'none') b.click();      /* past the first page, as Begin in the studio does */
  await projCreate('import', { song, zoom: 'studio' }); bus.emit('song', 'reload'); try { syncTransport(); syncBandStrip(); } catch (e) { }
  if (playNow) { try { await startAudio(); T.cursor = 0; T.loop = true; syncTransport(); play(); } catch (e) { console.warn(e); } }
  toast('“' + S.title + '” is open as a new song. Your other songs are as they were.', 'ok');
}
function slWelcome(song) {
  const old = document.getElementById('slIn'); if (old) old.remove();
  const go = p => { d.close(); slOpen(song, p).catch(e => toast('It could not be opened: ' + (e.message || e), 'bad')); };
  const d = h('dialog', { class: 'sl-dlg sl-in', id: 'slIn', 'aria-labelledby': 'slInH' },
    h('p', { class: 'sl-kick' }, '🎵 A song was sent to you'), h('h3', { id: 'slInH' }, song.title), song.artist ? h('p', { class: 'muted' }, song.artist) : null,
    h('p', { class: 'sl-what' }, slSummary(song)),
    h('p', { class: 'small muted' }, 'It opens as a new song, so none of yours change. It came inside the link: nothing was downloaded from anyone.'),
    h('div', { class: 'row sl-acts' }, h('button', { class: 'btn primary', id: 'slPlay', type: 'button', onclick: () => go(true) }, '▶ Open and play'), h('button', { class: 'btn', id: 'slOpenBtn', type: 'button', onclick: () => go(false) }, 'Open'), h('span', { class: 'grow' }), h('button', { class: 'btn', type: 'button', onclick: () => d.close() }, 'Not now')));
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
