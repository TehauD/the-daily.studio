/* ============================================================
   Part 03c · SONGS THAT BUILD (2.44) — the band plays each section at its own energy
   With "Song build" on (S.band.build; a beat turns it on), every section has an energy from 1 to 5. A section without one takes it from
   its name: intro 2, verse 3, pre-chorus 4, chorus 5, bridge 2, solo 4, outro 2, anything else 3.
     1  just the hats and the rim, no bass, one harmony instrument     4  the groove, an open hat at the end of each bar, a crash to start
     2  kick, hats and a softer snare, no open hats or toms            5  all of 4, with the hats filled in to sixteenths
     3  the groove as written
   Between sections: a drum fill in the last beat (a tom-and-snare roll when the next section is bigger), a crash on the first beat of a
   section at 4 or more, and a noise riser through the last bar before a section that lifts to 4 or more. When the song is not looping,
   its last bar is an ending: one hit on the downbeat, with a crash, and the bass and chord left ringing.
   Nothing here changes the song's patterns: it decides, slot by slot, what the band plays of them (scheduleSlot in part 03).
   ============================================================ */
/* how hard the whole band plays at each energy (1 … 5): a chorus is bigger in every part, not only in the drums */
const BUILD_LIFT = [1, .52, .64, .75, .88, 1], BLD = { last: null }, BUILD_TRACKS = ['drums', 'bass', 'rhythm', 'lead', 'keys'];
/** the band's level for the section: set on each band track's energy gain at the first slot of a bar, gliding over a few milliseconds */
function buildLevel(C, sib, t) {
  const v = C ? BUILD_LIFT[C.ending ? 4 : C.e] : 1; if (sib !== 0 && BLD.last === v) return; if (BLD.last === v && BLD.ctx === E.ctx) return; BLD.last = v; BLD.ctx = E.ctx;
  BUILD_TRACKS.forEach(id => { const n = E.tr[id] && E.tr[id].nrg; if (n) { try { n.gain.setTargetAtTime(v, Math.max(t - .01, 0), .012); } catch (e) { } } });
}      /* a chorus at full level, the rest under it: lifting the chorus instead would only push it into the master's limiter */
const BUILD_DEF = [[/intro/i, 2], [/pre/i, 4], [/chorus|hook|refrain/i, 5], [/verse/i, 3], [/bridge|break|middle/i, 2], [/solo|instrumental/i, 4], [/outro|ending|coda/i, 2]];
/** a section's energy: its own, or the one its name suggests */
function secEnergy(sec) { if (!sec) return 3; const e = +sec.energy; if (e >= 1 && e <= 5) return Math.round(e); const d = BUILD_DEF.find(([re]) => re.test(sec.name || '')); return d ? d[1] : 3; }
/** where slot `slot` sits in the song's shape, or null when Song build is off */
function buildCtx(slot, fb, sib) {
  if (!S.band.build || !fb) return null;
  const sp = spb(), beat = 16 / S.ts[1], sec = fb.sec, e = secEnergy(sec), lastBar = fb.bi === sec.bars.length - 1, nextSec = S.sections[fb.si + 1] || (T.loop ? S.sections[0] : null);
  const ne = nextSec ? secEnergy(nextSec) : null, songLast = fb.si === S.sections.length - 1 && lastBar;
  return { e, ne, first: fb.bi === 0 && sib === 0, lastBar, fill: lastBar && !!nextSec && sib >= sp - beat, riser: lastBar && ne != null && ne >= 4 && ne > e, ending: songLast && !T.loop, sib, sp, beat, prevE: fb.si > 0 ? secEnergy(S.sections[fb.si - 1]) : null };
}
/** the drums for one slot at the section's energy; true when it played them */
function buildDrums(C, slot, t) {
  const pat = dpat(), L = Math.min(S.band.drumLen || 16, 32), i = ((slot % L) + L) % L, K = KITS[S.band.kit] || KITS.Acoustic, hit = (r, v, dt) => { const tt = t + (dt || 0) + (Math.random() * 2 - 1) * CFG.humanize * .006; if (typeof lxHit === 'function') lxHit(r, tt, v); drumHit(r, tt, v); };
  if (C.ending) { if (C.sib === 0) { hit(0, 3); hit(1, 3); buildCrash(K, t, 1); } return true; }
  if (C.first && (C.e >= 4 || (C.prevE != null && C.e - C.prevE >= 2))) buildCrash(K, t, C.e >= 5 ? 1 : .8);
  if (C.riser && C.sib === 0) buildRiser(t, C.sp * playDur());
  if (C.fill) {      /* the last beat of the section */
    const k = C.sib - (C.sp - C.beat), big = C.ne > C.e || C.e >= 4, n = C.beat;
    if (k === 0 && pat[0][i]) hit(0, pat[0][i]);
    if (big) { const row = k < n / 2 ? 5 : 1; hit(row, k === n - 1 ? 3 : 2); if (C.e >= 3) hit(row, 1, playDur() / 2); }
    else if (k >= n - 2) hit(1, k === n - 1 ? 2 : 1);
    else pat.forEach((r, ri) => { if (ri !== 1 && ri !== 5 && r[i]) hit(ri, Math.max(1, r[i] - (ri === 2 ? 1 : 0))); });
    return true;
  }
  pat.forEach((r, ri) => {
    let v = r[i] || 0;
    if (C.e === 1) { if (ri === 2) v = v ? Math.max(1, v - 1) : 0; else if (ri !== 4) v = 0; }
    else if (C.e === 2) { if (ri === 3 || ri === 5) v = 0; else if (ri === 1 && v) v = Math.max(1, v - 1); }
    else if (C.e >= 4) {
      if (ri === 3 && !v && C.sib === C.sp - 2 && !pat[2][i]) v = 2;      /* an open hat to lift the end of each bar */
      if (C.e === 5 && ri === 2 && !v && !pat[3][i]) v = 1;      /* sixteenth hats */
      if (ri === 0 && C.sib === 0 && v) v = 3;
    }
    if (v) hit(ri, v);
  });
  return true;
}
/** which of the band plays at this energy (bass, the rhythm part, the keys) */
function buildParts(C) {
  if (!C) return { bass: true, comp: true, keys: true };
  if (C.ending) return { bass: C.sib === 0, comp: C.sib === 0, keys: C.sib === 0, ring: true };
  const both = S.band.compOn && S.band.keysOn;      /* at 1 and 2 only one harmony instrument plays: the keys if both are on */
  return { bass: C.e >= 2, comp: C.e >= 3 || !both, keys: C.e >= 3 || !S.band.compOn || both };
}
/** a crash cymbal: metal and noise, long, into the room */
function buildCrash(K, t, amt) {
  const c = E.ctx; if (!c || !E.noise) return; const out = E.tr.drums.duck || E.tr.drums.in, g = gn(0), bp = bq('bandpass', 6500, .5), hp = bq('highpass', 3500), mix = gn(.18), dec = 2.2;
  KIT_HAT.forEach(f => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f * 1.9; o.connect(mix); o.start(t); o.stop(t + dec); });
  mix.connect(bp); const ng = gn(.8); nz(t, dec, ng); ng.connect(bp); chainN(bp, hp, g); g.connect(out);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.78 * amt, t + .004); g.gain.exponentialRampToValueAtTime(.26 * amt, t + .3); g.gain.exponentialRampToValueAtTime(.0001, t + dec);
  try { kitSend(g, .25); } catch (e) { }
}
/** a noise riser over `len` seconds: a band of noise sweeping up and swelling, ending at the next section */
function buildRiser(t, len) {
  const c = E.ctx; if (!c || !E.noise || len < .3) return; const out = E.tr.drums.duck || E.tr.drums.in, g = gn(0)      /* transitions ride over the section's level */, bp = bq('bandpass', 300, 1.4);
  nz(t, len, bp); bp.connect(g); g.connect(out);
  bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(9000, t + len); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.62, t + len * .97);      /* a straight swell: an exponential one from silence stays inaudible until the last moment */ g.gain.exponentialRampToValueAtTime(.0001, t + len + .02);
  try { kitSend(g, .3); } catch (e) { }
}
/* ---------- the controls: Band panel, Simple's band and the phone's Beats ---------- */
function buildCard() {
  const on = !!S.band.build, card = h('div', { class: 'card bl-card', id: 'buildCard' });
  card.append(h('h4', {}, 'Song build ', h('button', { class: 'btn sm' + (on ? ' on' : ''), id: 'buildOn', type: 'button', 'aria-pressed': String(on), title: 'The band plays each section at its own energy, with fills, crashes, risers and an ending', onclick: () => { S.band.build = !S.band.build; commit(true); bus.emit('song', 'band'); try { renderBand(); } catch (e) { } } }, on ? 'On' : 'Off')));
  const body = h('div', { class: 'card-b' });
  body.append(h('p', { class: 'tiny muted bl-how' }, on ? 'Each section plays at its energy: 1 is just hats, 3 the groove as written, 5 everything. Fills, crashes and risers come in between.' : 'Turn it on and the band builds through the song: quiet verses, big choruses, fills and risers between them.'));
  if (on) body.append(h('div', { class: 'bl-secs' }, S.sections.map((sec, si) => { const e = secEnergy(sec), own = sec.energy >= 1;
    return h('div', { class: 'bl-sec', 'data-si': si }, h('span', { class: 'bl-nm' }, sec.name), h('span', { class: 'bl-dots', role: 'radiogroup', 'aria-label': sec.name + ' energy' }, [1, 2, 3, 4, 5].map(n => h('button', { class: 'bl-dot' + (n <= e ? ' on' : '') + (own ? ' own' : ''), type: 'button', role: 'radio', 'aria-checked': String(n === e), 'aria-label': 'Energy ' + n, 'data-e': n, onclick: () => { sec.energy = n; commit(true); bus.emit('song', 'band'); try { renderBand(); } catch (x) { } if (typeof mScreenDraw === 'function') mScreenDraw(); } }))));
  })));
  card.append(body); return card;
}
