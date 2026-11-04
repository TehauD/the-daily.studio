/* Bass guitar (2.36): four, five and six-string bass tunings, chosen in Settings ▸ Music ▸ My instrument or the tuning list. The tab editor,
   both fretboards, tab text and the tuner follow the number of strings; bass tab plays as bass; the band's bass steps out (and back); the
   band's rhythm guitar keeps a guitar's chords; the pitch tracker hears down to a low B. */
const { suite } = require('./lib.cjs');
const SHEET = '[Verse]\nAm      F\nLanterns on the harbour wall\nC       G\nCalling all the boats back in';

suite('e2e-bass', async t => {
  const { ok, wait } = t;
  const p = await t.open({ w: 1440, h: 900 }), ev = (f, a) => p.evaluate(f, a);
  await ev(async s => { const D = window.__daily; await D.startAudio(); await window.dailyStudio.call('load_chord_sheet', { text: s }); D.S.bpm = 100; D.commit(false); D.goalGo('songwriter'); }, SHEET);
  await wait(300);
  ok(await ev(() => !window.__daily.isBass() && window.__daily.S.tuning.length === 6 && window.__daily.S.band.bassOn), 'a guitar song to start: six strings, the band’s bass playing');

  /* ---- Settings ▸ Music ▸ My instrument ---- */
  await ev(() => window.__daily.openSettings('music')); await wait(300);
  ok(await ev(() => [...document.querySelectorAll('#setInst option')].map(o => o.value).join() === 'guitar,bass4,bass5,bass6' && document.getElementById('setInst').value === 'guitar'), 'Settings ▸ Music ▸ My instrument: Guitar, or a 4, 5 or 6-string bass');
  await ev(() => { const s = document.getElementById('setInst'); s.value = 'bass4'; s.dispatchEvent(new Event('change')); document.getElementById('settings').close(); }); await wait(400);
  const B4 = await ev(() => { const D = window.__daily; return { tun: D.S.tuning.join(), name: D.S.tuningName, bass: D.isBass(), bandBass: D.S.band.bassOn, toast: [...document.querySelectorAll('#toasts .toast')].some(x => /band’s bass steps out/.test(x.textContent)) }; });
  ok(B4.tun === '28,33,38,43' && /^Bass: standard/.test(B4.name) && B4.bass, 'Bass (4 strings): E A D G an octave below a guitar’s (' + B4.name + ')');
  ok(!B4.bandBass && B4.toast, 'the band’s bass steps out so you can play it, and it says so');

  /* ---- everything follows four strings ---- */
  const V = await ev(() => { const D = window.__daily; D.dockGo('tab'); D.bus.emit('song'); D.renderTab && D.renderTab(); const g = document.querySelector('#pane-tab .tgrid'), cells = g ? g.querySelectorAll('.tcell').length : 0, sp = D.spb();
    const rows = D.renderBarTab(D.S.sections[0].bars[0]); return { rows: cells / sp, text: rows.length, labels: rows.length, fb: (D.FB && D.FB.nodes || []).length, wr: (D.WR && D.WR.nodes || []).length }; });
  ok(V.rows === 4 && V.text === 4, 'the tab editor and tab text have four lines (' + V.rows + ', ' + V.text + ')');
  await ev(() => { const D = window.__daily; D.renderFret && D.renderFret(); D.wrFretBuild && D.wrFretBuild(); }); await wait(200);
  ok(await ev(() => (window.__daily.FB.nodes || []).length === 4 && (window.__daily.WR.nodes || []).length === 4), 'the fretboard and the one under Write have four strings');
  ok(await ev(() => window.__daily.tabLabels().join(' ') === 'G D A E'), 'labelled G D A E, high to low (no small e: that is a guitar’s)');

  /* ---- bass tab plays as bass ---- */
  const PL = await ev(async () => { const D = window.__daily; Object.assign(D.S.band, { drumsOn: false, compOn: false, leadOn: true, bassOn: false, keysOn: false }); D.S.sections.forEach(s => s.bars.forEach(b => { b.tab = []; })); D.S.sections[0].bars[0].tab = [0, 4, 8, 12].map(s => ({ s, st: 1, f: 0, t: '' })); D.T.bars = null; D.commit(false); D.T.cursor = 0; D.T.metro = false;
    const pk = id => { const an = D.E.tr[id].ana, b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b); return Math.max(...b.map(Math.abs)); }; let bass = 0, lead = 0; await D.play(); for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 40)); bass = Math.max(bass, pk('bass')); lead = Math.max(lead, pk('lead')); } D.stopPlay(true); return { bass, lead }; });
  ok(PL.bass > .01 && PL.lead < .002, 'tab written for bass plays as a bass, on the bass channel (bass ' + PL.bass.toFixed(3) + ', guitar ' + PL.lead.toFixed(4) + ')');
  ok(await ev(() => (window.__daily.voicingFor('G') || { frets: [] }).frets.length === 6), 'the band’s rhythm guitar still voices its chords on a guitar’s six strings');

  /* ---- hearing a low B ---- */
  const Y = await ev(() => { const D = window.__daily, sr = D.E.ctx.sampleRate, n = 4096, mk = f => { const b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = .5 * Math.sin(2 * Math.PI * f * i / sr) + .25 * Math.sin(4 * Math.PI * f * i / sr) + .1 * Math.sin(6 * Math.PI * f * i / sr); return b; };
    const at = f => { const r = D.yin(mk(f), sr, .12, D.isBass() ? 27 : 45); return r ? r.f : null; }, g = f => { const r = D.yin(mk(f), sr); return r ? r.f : null; };
    return { e1: at(41.2), b0: at(30.87), a1: at(55), guitarB0: g(30.87) }; });
  ok(Y.e1 && Math.abs(Y.e1 / 41.2 - 1) < .01 && Y.b0 && Math.abs(Y.b0 / 30.87 - 1) < .01 && Math.abs(Y.a1 / 55 - 1) < .01, 'the pitch tracker hears a bass: low E ' + (Y.e1 || 0).toFixed(1) + ' Hz and a 5-string’s low B ' + (Y.b0 || 0).toFixed(1) + ' Hz');
  ok(!Y.guitarB0 || Math.abs(Y.guitarB0 / 30.87 - 1) > .05, 'with a guitar it keeps its guitar range (it does not reach for a 31 Hz note)');

  /* ---- five strings, and back to guitar ---- */
  await ev(() => { const D = window.__daily; D.TE.st = 3; D.setTuning(D.TUNINGS['Bass 5-string (B E A D G)'], 'Bass 5-string (B E A D G)'); D.commit(); D.bus.emit('song'); D.renderTab && D.renderTab(); }); await wait(300);
  const B5 = await ev(() => { const D = window.__daily, g = document.querySelector('#pane-tab .tgrid'); return { tun: D.S.tuning.join(), rows: g ? g.querySelectorAll('.tcell').length / D.spb() : 0, inst: D.instNow(), low: D.S.tuning[0] }; });
  ok(B5.tun === '23,28,33,38,43' && B5.rows === 5 && B5.inst === 'bass5' && B5.low === 23, 'a 5-string: a low B (B0) that a guitar tuning could not hold, and five lines of tab');
  await ev(() => { const D = window.__daily; D.setTuning(D.TUNINGS['Standard (E A D G B E)'], 'Standard (E A D G B E)'); D.commit(); D.bus.emit('song'); D.renderTab && D.renderTab(); }); await wait(400);
  const G = await ev(() => { const D = window.__daily, g = document.querySelector('#pane-tab .tgrid'); return { bass: D.isBass(), band: D.S.band.bassOn, rows: g ? g.querySelectorAll('.tcell').length / D.spb() : 0, fb: (D.FB.nodes || []).length }; });
  ok(!G.bass && G.band && G.rows === 6, 'back to guitar: six lines of tab again, and the band’s bass is back');
  ok(await ev(() => !!window.__daily.TUNINGS['Bass: drop D (D A D G)'] && document.querySelectorAll('#songbar .sb-tun option').length >= 25 && [...document.querySelectorAll('#songbar .sb-tun option')].some(o => /^Bass/.test(o.textContent))), 'the bass tunings are in the song bar’s tuning list too');
});
