/* The vocal pedalboard (2.31): seven pedals after the vocal polish, measured by what they do to a signal (recorded on the audio thread):
   transparent when off; Scream's grit and its octave-down growl; the megaphone's band; the de-esser on loud highs only; the doubler's two
   copies; the echo in time with the song, and its throw; the reverb's tail; harmony a diatonic third above in C major and in A major.
   Then presets, a preset per section, the foot pedal, the show's gritty look, the room and a phone. */
const { suite } = require('./lib.cjs');

suite('e2e-vocalboard', async t => {
  const { ok, wait, poll } = t;
  const p = await t.open({ w: 1280, h: 860 }), ev = (f, a) => p.evaluate(f, a);
  await ev(async () => {
    const D = window.__daily; await D.startAudio(); D.vbPreset('Off', true);
    window.__rec = async (nodes, N, arm) => {
      const c = D.E.ctx; if (!window.__recOk) { const src = 'class R extends AudioWorkletProcessor{constructor(o){super();this.n=o.processorOptions.n;this.c=o.processorOptions.c;this.k=0;this.b=[];for(let i=0;i<this.c;i++)this.b.push(new Float32Array(this.n));}process(i){const x=i[0];if(this.k>=this.n)return false;const m=Math.min(128,this.n-this.k);for(let ch=0;ch<this.c;ch++){const s=x[ch];if(s)this.b[ch].set(s.subarray(0,m),this.k);}this.k+=m;if(this.k>=this.n){this.port.postMessage(this.b);return false;}return true;}};registerProcessor("t-rec2",R);'; await c.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: 'application/javascript' }))); window.__recOk = true; }
      return await new Promise(res => { const ch = nodes.reduce((a, n) => a + (n.ch || 1), 0), mg = c.createChannelMerger(ch), r = new AudioWorkletNode(c, 't-rec2', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: ch, channelCountMode: 'explicit', channelInterpretation: 'discrete', processorOptions: { n: N, c: ch } }), z = c.createGain(); z.gain.value = 0;
        let k = 0; nodes.forEach(n => { if (n.ch === 2) { const sp = c.createChannelSplitter(2); n.node.connect(sp); sp.connect(mg, 0, k++); sp.connect(mg, 1, k++); } else { n.node.connect(mg, 0, k++); } }); mg.connect(r); r.connect(z); z.connect(c.destination);
        r.port.onmessage = e => { try { r.disconnect(); mg.disconnect(); } catch (x) { } res(e.data); }; arm && arm(); });
    };
    /* play `make(sr)` (a Float32Array) into the board and record what comes out (left and right); returns the two channels */
    window.__through = async (make, secs) => {
      const c = D.E.ctx, sr = c.sampleRate, x = make(sr), b = c.createBuffer(1, x.length, sr); b.getChannelData(0).set(x);
      const s = c.createBufferSource(); s.buffer = b; const B = D.E.vb, inN = B.u.scream.in, outN = B.u.verb.out; const tap = c.createGain(); outN.connect(tap);
      const r = await window.__rec([{ node: tap, ch: 2 }], Math.round(sr * secs), () => { s.connect(inN); s.start(c.currentTime + .05); }); try { s.disconnect(); outN.disconnect(tap); } catch (e) { } return r;
    };
    window.__g = (x, f, sr, a, b) => { let re = 0, im = 0; for (let i = a; i < b; i++) { const w = 2 * Math.PI * f * i / sr; re += x[i] * Math.cos(w); im += x[i] * Math.sin(w); } return Math.sqrt(re * re + im * im) / (b - a); };
    window.__sine = (f, secs, amp) => sr => { const n = Math.round(sr * secs), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = (amp || .3) * Math.sin(2 * Math.PI * f * i / sr) * Math.min(1, i / (sr * .01), (n - i) / (sr * .01)); return x; };
    window.__imp = () => sr => { const x = new Float32Array(Math.round(sr * .1)); x[0] = .8; return x; };
  });
  await wait(300);

  /* ---- where it sits ---- */
  ok(await ev(() => { const B = window.__daily.E.vb; return !!B && window.__daily.VB_ORDER.every(([k]) => B.u[k] && B.u[k].fx) && B.c === window.__daily.E.ctx; }), 'the board is built into the audio engine after the vocal polish, seven pedals in order');

  /* ---- off is off ---- */
  const OFF = await ev(async () => { const D = window.__daily, [L] = await window.__through(window.__sine(440, .6), .7), sr = D.E.ctx.sampleRate, i0 = Math.round(sr * .3), i1 = Math.round(sr * .5); return { a: window.__g(L, 440, sr, i0, i1), h: window.__g(L, 1320, sr, i0, i1) }; });
  ok(Math.abs(OFF.a - .15) < .02 && OFF.h < .002, 'with every pedal off the voice comes through untouched (' + OFF.a.toFixed(3) + ' at 440 Hz, no added harmonics)');

  /* ---- Scream ---- */
  const SC = await ev(async () => { const D = window.__daily, sr = D.E.ctx.sampleRate, m = async () => { const [L] = await window.__through(window.__sine(220, .7, .3), .8), a = Math.round(sr * .35), b = Math.round(sr * .6); return { f: window.__g(L, 220, sr, a, b), h3: window.__g(L, 660, sr, a, b), h5: window.__g(L, 1100, sr, a, b), sub: window.__g(L, 110, sr, a, b) }; };
    D.vbToggle('scream', true); D.vbSet('scream', 'growl', 0); D.vbSet('scream', 'grit', .7); await new Promise(r => setTimeout(r, 150)); const grit = await m();
    D.vbSet('scream', 'growl', .75); await new Promise(r => setTimeout(r, 150)); const growl = await m(); D.vbToggle('scream', false); return { grit, growl }; });
  ok((SC.grit.h3 + SC.grit.h5) / SC.grit.f > .15, 'Scream adds grit: odd harmonics appear on a pure tone (' + ((SC.grit.h3 + SC.grit.h5) / SC.grit.f).toFixed(2) + ' of the fundamental)');
  ok(SC.growl.sub > SC.grit.sub * 4 && SC.growl.sub > .005, 'and Growl adds the octave below (110 Hz under a 220 Hz voice: ' + SC.grit.sub.toFixed(4) + ' → ' + SC.growl.sub.toFixed(4) + ')');

  /* ---- Megaphone ---- */
  const MG = await ev(async () => { const D = window.__daily, sr = D.E.ctx.sampleRate, mix = sr2 => { const a = window.__sine(120, .6, .15)(sr2), b = window.__sine(1500, .6, .15)(sr2), c = window.__sine(8000, .6, .15)(sr2); return a.map((v, i) => v + b[i] + c[i]); };
    const run = async () => { const [L] = await window.__through(mix, .7), a = Math.round(sr * .3), b = Math.round(sr * .5); return [120, 1500, 8000].map(f => window.__g(L, f, sr, a, b)); };
    const off = await run(); D.vbToggle('mega', true); await new Promise(r => setTimeout(r, 120)); const on = await run(); D.vbToggle('mega', false); return { off, on }; });
  ok(MG.on[0] / MG.on[1] < MG.off[0] / MG.off[1] / 10 && MG.on[2] / MG.on[1] < MG.off[2] / MG.off[1] / 10, 'Megaphone squeezes the voice into its band: the lows and the highs drop away against the middle');

  /* ---- De-esser ---- */
  const DE = await ev(async () => { const D = window.__daily, sr = D.E.ctx.sampleRate, run = async f => { const [L] = await window.__through(window.__sine(f, .6, .3), .7), a = Math.round(sr * .3), b = Math.round(sr * .5); return window.__g(L, f, sr, a, b); };
    const s0 = await run(7500), v0 = await run(500); D.vbSet('deess', 'amount', .9); D.vbToggle('deess', true); await new Promise(r => setTimeout(r, 120)); const s1 = await run(7500), v1 = await run(500); D.vbToggle('deess', false); return { s: 20 * Math.log10(s1 / s0), v: 20 * Math.log10(v1 / v0) }; });
  ok(DE.s < -6 && Math.abs(DE.v) < 1, 'the de-esser turns a loud “s” down (' + DE.s.toFixed(1) + ' dB) and leaves the voice’s body alone (' + DE.v.toFixed(2) + ' dB)');

  /* ---- Doubler ---- */
  const DB = await ev(async () => { const D = window.__daily, sr = D.E.ctx.sampleRate; D.vbSet('double', 'mix', .6); D.vbToggle('double', true); await new Promise(r => setTimeout(r, 120)); const [L, R] = await window.__through(window.__imp(), .2); D.vbToggle('double', false);
    const main = x => { let m = 0, at = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > m) { m = Math.abs(x[i]); at = i; } return at; }, at0 = main(L.map((v, i) => v + R[i]));
    const peaks = x => { const out = []; for (let i = at0 + Math.round(sr * .01); i < at0 + Math.round(sr * .045); i++) if (Math.abs(x[i]) > .05 && Math.abs(x[i]) >= Math.abs(x[i - 1]) && Math.abs(x[i]) >= Math.abs(x[i + 1])) out.push(+((i - at0) / sr * 1000).toFixed(1)); return out; };
    const en = (x, a, b) => { let e = 0; for (let i = at0 + Math.round(sr * a); i < at0 + Math.round(sr * b); i++) e += x[i] * x[i]; return e; };
    return { l: peaks(L), r: peaks(R), l21: en(L, .015, .026), r21: en(R, .015, .026), l31: en(L, .026, .04), r31: en(R, .026, .04) }; });
  ok([...DB.l, ...DB.r].some(ms => ms > 15 && ms < 26) && [...DB.l, ...DB.r].some(ms => ms > 26 && ms < 40) && DB.l21 > DB.r21 * 4 && DB.r31 > DB.l31 * 4, 'the doubler adds two copies, about 21 ms behind on the left and 31 ms on the right (' + JSON.stringify({ l: DB.l, r: DB.r }) + ')');

  /* ---- Echo ---- */
  const EC = await ev(async () => { const D = window.__daily, sr = D.E.ctx.sampleRate; D.S.bpm = 120; D.commit(false); D.vbTick(); D.vbSet('echo', 'time', '1/8 dotted'); D.vbSet('echo', 'mix', .5); D.vbSet('echo', 'throw', false); D.vbToggle('echo', true); await new Promise(r => setTimeout(r, 300));
    const hit = async () => { const [L] = await window.__through(window.__imp(), .6); let at = -1, top = 0; for (let i = Math.round(sr * .2); i < Math.round(sr * .55); i++) if (Math.abs(L[i]) > top) { top = Math.abs(L[i]); at = i; } return { ms: +((at / sr - .05) * 1000).toFixed(0), top }; };
    const free = await hit(); D.vbSet('echo', 'fb', 0); await new Promise(r => setTimeout(r, 1200)); D.vbSet('echo', 'throw', true); await new Promise(r => setTimeout(r, 100)); const thrown = await hit(); await new Promise(r => setTimeout(r, 400)); D.vbThrow(true); await new Promise(r => setTimeout(r, 100)); const held = await hit(); D.vbThrow(false); D.vbSet('echo', 'throw', false); D.vbToggle('echo', false); return { free, thrown, held }; });
  ok(Math.abs(EC.free.ms - 375) < 15 && EC.free.top > .05, 'Echo repeats in time with the song: a dotted eighth at 120 BPM is 375 ms (' + EC.free.ms + ' ms)');
  ok(EC.thrown.top < EC.free.top / 10 && EC.held.top > EC.free.top / 2, 'with Throw, nothing echoes until the pedal is held, then it does');

  /* ---- Reverb ---- */
  const RV = await ev(async () => { const D = window.__daily, sr = D.E.ctx.sampleRate, tail = async () => { const [L] = await window.__through(window.__imp(), .8); let e = 0; for (let i = Math.round(sr * .25); i < Math.round(sr * .7); i++) e += L[i] * L[i]; return e; };
    const off = await tail(); D.vbSet('verb', 'type', 'Hall'); D.vbSet('verb', 'decay', 2.5); D.vbSet('verb', 'mix', .4); D.vbToggle('verb', true); await new Promise(r => setTimeout(r, 400)); const on = await tail(); D.vbToggle('verb', false); return { off, on }; });
  ok(RV.on > 1e-4 && RV.on > RV.off * 100, 'Reverb leaves a tail behind the voice');

  /* ---- Harmony: a third above, in the song's key ---- */
  const HM = await ev(async () => { const D = window.__daily, sr = D.E.ctx.sampleRate, run = async () => { const [L, R] = await window.__through(window.__sine(440, 1.6, .3), 1.7), a = Math.round(sr * 1), b = Math.round(sr * 1.5), m = (L.map((v, i) => v + R[i])); return { c: window.__g(m, 523.25, sr, a, b), cs: window.__g(m, 554.37, sr, a, b), a: window.__g(m, 440, sr, a, b) }; };
    D.vbSet('harm', 'voice', 'Third above'); D.vbSet('harm', 'mix', .8); D.vbSet('harm', 'follow', 'key'); D.S.key = 0; D.S.minor = false; D.S.scale = 'Major (Ionian)'; D.commit(false); D.vbApply(); D.vbToggle('harm', true); await new Promise(r => setTimeout(r, 200));
    const inC = await run(); D.S.key = 9; D.commit(false); D.vbApply(); await new Promise(r => setTimeout(r, 200)); const inA = await run(); D.vbToggle('harm', false); return { inC, inA }; });
  ok(HM.inC.c > HM.inC.cs * 3 && HM.inC.c > .01, 'Harmony in C major: sing an A and a C comes in above it (a minor third, as the key says)');
  ok(HM.inA.cs > HM.inA.c * 3 && HM.inA.cs > .01, 'in A major the same A gets a C♯ (a major third): the harmony follows the song’s key');

  /* ---- presets, and a preset per section ---- */
  ok(await ev(() => { const D = window.__daily; D.vbPreset('Ballad', true); const o = D.CFG.vb.on; return o.double && o.verb && o.echo && o.deess && !o.scream && !o.mega && !o.harm && D.CFG.vb.p.verb.type === 'Plate'; }), 'a preset sets the whole board (Ballad: doubler, plate, quarter-note echo, de-esser)');
  const SEC = await ev(async () => { const D = window.__daily; await window.dailyStudio.call('load_chord_sheet', { text: '[Verse]\nG        D\nWalking down to the harbour wall\n[Chorus]\nC        G\nHold on, hold on', where: 'replace' }); D.S.bpm = 160; D.commit(false);
    D.vbPreset('Clean lead', true); D.S.vbSec = { [D.S.sections[1].id || '#1']: 'Scream' }; D.commit(false); D.T.cursor = 0; await D.play(); for (let i = 0; i < 40 && !D.CFG.vb.on.scream; i++) await new Promise(r => setTimeout(r, 150)); const got = D.CFG.vb.on.scream, name = D.CFG.vb.preset; D.stopPlay(true); return { got, name }; });
  ok(SEC.got && SEC.name === 'Scream', 'a section with its own preset switches the board when the song reaches it (the chorus: Scream)');

  /* ---- the show, the foot pedal ---- */
  ok(await ev(() => { const D = window.__daily; D.vbPreset('Off', true); D.vbToggle('scream', true); const on = D.MEG.on && document.body.classList.contains('mega'); D.vbToggle('scream', false); return on && !D.MEG.on; }), 'Scream on: the show turns gritty, as for a megaphone pedal; off: back');
  const PD = await ev(async () => { const D = window.__daily; D.CFG.pedal.on = true; D.CFG.pedal.map.vscream = ['k:x']; D.CFG.pedal.map.vthrow = ['k:y']; document.body.focus();
    const kd = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })), ku = k => window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
    kd('x'); const s1 = D.CFG.vb.on.scream; await new Promise(r => setTimeout(r, 250)); kd('x'); const s2 = D.CFG.vb.on.scream; kd('y'); const h1 = D.VBS.held; ku('y'); const h2 = D.VBS.held; D.CFG.pedal.on = false; return { s1, s2, h1, h2 }; });
  ok(PD.s1 && !PD.s2, 'the foot pedal switches Scream on and off');
  ok(PD.h1 && !PD.h2, 'and a held pedal throws the echo, for as long as it is held');

  /* ---- the room ---- */
  await ev(() => window.__daily.vocalBoardOpen()); await wait(400);
  ok(await ev(() => document.querySelectorAll('#vocalboard .vb-ped').length === 7 && document.querySelectorAll('#vocalboard [data-sw][aria-pressed]').length === 7 && document.querySelectorAll('#vbPreset option').length >= 8), 'Vocal pedals: seven pedals, each with an on / off switch, and the presets');
  await p.click('#vocalboard [data-sw="double"]'); await wait(150);
  ok(await ev(() => window.__daily.CFG.vb.on.double && document.querySelector('#vocalboard [data-sw="double"]').getAttribute('aria-pressed') === 'true' && document.querySelector('#vocalboard [data-ped="double"]').classList.contains('on')), 'a stomp switches a pedal, and it shows');
  ok(await ev(() => !!document.querySelector('#vocalboard section[data-sec="song"] select[data-sec]')), 'By section lists the song’s sections with a preset for each');
  await ev(() => document.getElementById('vocalboard').close());
  await ev(() => window.__daily.vbPreset('Off', true));

  /* ---- a phone ---- */
  const m = await t.open({ w: 390, h: 844, mobile: true }), mv = (f, a) => m.evaluate(f, a);
  await mv(() => window.__daily.vocalBoardOpen()); await wait(500);
  ok(await mv(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('#vocalboard .vb-sw')].every(b => b.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().right <= innerWidth)), 'on a phone the pedals stack, and every switch is big enough to stomp with a thumb');
});
