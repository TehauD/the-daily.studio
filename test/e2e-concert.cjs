/* Concert: the lighting-rig visual (part 54), its three lenses, the drum-synced lights, mood and colour from the harmony, and the Monitor views card (part 55).
   Own browser context; see test/lib.cjs. */
const { suite } = require('./lib.cjs');
suite('e2e-concert', async t => {
  const { ok, wait } = t, p = await t.open({ debug: true }), ev = (f, a) => p.evaluate(f, a);
  await ev(async () => {
    const d = window.__daily; await d.ioConnect();
    d.S.key = 0; d.S.minor = false; d.S.title = 'Concert test';
    d.S.sections = [{ id: 'a', name: 'Verse', lyrics: 'Morning light\nSomething waits', bars: [{ chord: 'C', tab: [] }, { chord: 'Am', tab: [] }, { chord: 'F', tab: [] }, { chord: 'G', tab: [] }] }, { id: 'b', name: 'Chorus', lyrics: 'Oh we rise\nInto the light', bars: [{ chord: 'F', tab: [] }, { chord: 'G', tab: [] }, { chord: 'Em', tab: [] }, { chord: 'Am', tab: [] }] }];
    d.commit(false); d.dockGo('stage'); d.T.cursor = 0; d.CFG.show.auto = false; d.CFG.show.design = 'arena'; d.STG.comfort = 'full';
    window.__mkX = (dt, en) => ({ fd: new Float32Array(1024).fill(-60), bin: f => Math.max(1, Math.min(1023, Math.round(f / 20))), lvl: x => Math.max(0, Math.min(1, (x + 88) / 62)), dt: dt || .016, energy: en == null ? .5 : en });
  });
  await wait(600);

  // ---- section kinds → the show's program
  const k = await ev(() => { const d = window.__daily; return ['Verse', 'Chorus', 'Pre-Chorus', 'Bridge', 'Guitar Solo', 'Intro', 'Outro', 'Hook', 'Something else'].map(n => d.lxKind(n)); });
  ok(k.join() === 'verse,chorus,pre,bridge,solo,intro,outro,chorus,verse', 'section names map to show programs (' + k.join(' ') + ')');
  ok(await ev(() => { const P = window.__daily.LX_PROG; return P.chorus.int > P.verse.int && P.verse.int > P.intro.int && P.chorus.n > P.verse.n && P.chorus.strobe === 1 && P.verse.strobe === 0 && P.bridge.haze >= P.chorus.haze; }), 'a chorus is bigger than a verse, which is bigger than an intro; only a chorus strobes; a bridge is hazier than a chorus');

  // ---- roman numerals, in a major key and in a minor key
  const rn = await ev(() => { const d = window.__daily, num = a => a.map(x => d.lxNumeral(x)); d.S.key = 0; d.S.minor = false; const maj = num(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'G7', 'Bb', 'Cmaj7', 'Dm7']); d.S.key = 9; d.S.minor = true; const min = num(['Am', 'Dm', 'Em', 'E', 'F', 'G', 'C', 'E7']); d.S.key = 0; d.S.minor = false; return { maj, min }; });
  ok(rn.maj.join(' ') === 'I ii iii IV V vi vii° V7 ♭VII Imaj7 ii7', 'numerals in C major (' + rn.maj.join(' ') + ')');
  ok(rn.min.join(' ') === 'i iv v V VI VII III V7', 'numerals in A minor (' + rn.min.join(' ') + ')');

  // ---- valence and tension
  const q = await ev(() => { const d = window.__daily, g = s => d.lxQual(d.parseChord(s)); return { C: g('C'), Am: g('Am'), Bdim: g('Bdim'), G7: g('G7'), Caug: g('Caug'), none: d.lxQual(null) }; });
  ok(q.C.val > .2 && q.Am.val < -.2 && q.Bdim.val < 0, 'major sounds bright and minor sounds sad (C ' + q.C.val.toFixed(2) + ', Am ' + q.Am.val.toFixed(2) + ')');
  ok(q.Bdim.ten >= .7 && q.G7.ten > q.C.ten + .2 && q.G7.ten < q.Bdim.ten && q.Caug.ten >= .5 && q.none.val === 0 && q.none.ten === 0, 'tension rises with dim, aug and dominant sevenths (C ' + q.C.ten.toFixed(2) + ', G7 ' + q.G7.ten.toFixed(2) + ', Bdim ' + q.Bdim.ten.toFixed(2) + ')');
  ok(await ev(() => { const d = window.__daily; return ['C', 'Am', 'Bdim', 'G7', 'Caug', 'Fm7b5', 'Dsus4'].every(s => { const r = d.lxQual(d.parseChord(s)); return r.val >= -1 && r.val <= 1 && r.ten >= 0 && r.ten <= 1; }); }), 'valence stays within −1…1 and tension within 0…1');

  // ---- colour from the circle of fifths: home is one colour, every step round the circle moves the hue by 30°
  const fh = await ev(() => { const d = window.__daily, fs = r => d.lxFifths(r); const out = { maj: [fs(0), fs(7), fs(5), fs(2), fs(10), fs(6)], hueMaj: [0, 1, -1].map(d.lxHueOf) }; d.S.minor = true; d.S.key = 9; out.hueMin = d.lxHueOf(d.lxFifths(9)); out.minFifth = d.lxHueOf(d.lxFifths(4)) - d.lxHueOf(0); d.S.key = 0; d.S.minor = false; return out; });
  ok(fh.maj.join() === '0,1,-1,2,-2,6', 'steps round the circle of fifths from the tonic: C 0, G +1, F −1, D +2, B♭ −2, F♯ 6 (' + fh.maj.join(' ') + ')');
  ok(fh.hueMaj.join() === '38,68,8' && fh.hueMin === 262 && fh.minFifth === 30, 'a major key starts warm (hue 38), a minor key deep violet (262), 30° per fifth (' + fh.hueMaj.join('/') + ', ' + fh.hueMin + ')');

  // ---- why the next chord pulls the way it does
  const cap = await ev(() => { const d = window.__daily, c = (a, b) => d.lxCaption(a, b); return [c('G', 'C'), c('F', 'C'), c('C', 'G'), c('C', 'Am'), c('B', 'C'), c('D', 'G'), c('Am', 'G'), c('D', 'Eb'), c('G', 'nonsense')]; });
  ok(/Dominant → home/.test(cap[0]) && /Plagal/.test(cap[1]) && /Leaving home/.test(cap[2]) && /Stepping away/.test(cap[3]) && /Leading tone/.test(cap[4]) && /Falling fifth/.test(cap[5]) && /Step by step/.test(cap[6]) && /1 semitone$/.test(cap[7]) && cap[8] === '', 'one honest line for each kind of move (' + cap.slice(0, 3).join(' / ') + ' …)');

  // ---- what is coming
  const up = await ev(() => { const d = window.__daily, f = (cur, n) => { d.T.cursor = cur; return d.lxUpcoming(n || 5).map(x => x.sym + '+' + x.bars).join(' '); }; const a = f(0), b = f(48), c = f(16 * 7), sec = d.lxUpcoming(5).map(x => x.section).join(); d.S.sections[0].bars[1].chord = 'Am G'; d.commit(false); const m1 = f(16), m2 = f(16 + 9); d.S.sections[0].bars[1].chord = 'Am'; d.commit(false); d.T.cursor = 0; return { a, b, c, m1, m2, sec }; });
  ok(up.a === 'C+0 Am+1 F+2 G+3 F+4' && up.b === 'G+0 F+1 G+2 Em+3 Am+4', 'the next five chords from the playhead, across the section change (' + up.a + ' | ' + up.b + ')');
  ok(up.c.startsWith('Am+0 C+1'), 'at the end of the song the list wraps to the start (' + up.c + ')');
  ok(up.m1.startsWith('Am+0 G+0') && up.m2.startsWith('G+0 F+1'), 'a bar with two chords counts the second one once the playhead is past the middle (' + up.m1 + ' | ' + up.m2 + ')');

  // ---- the band's drum hits, on the audio clock
  const ex = await ev(() => {
    const d = window.__daily, L = d.LX, ct = d.E.ctx.currentTime; L.q.length = 0; L.kick = L.snare = L.hat = L.perc = L.tom = 0; L.chase = 0; L.strobeReq = false;
    d.lxHit(0, ct - .5, 3); d.lxHit(1, ct + 30, 3); const before = L.q.length; d.lxUpdate(.016, window.__mkX());
    return { before, after: L.q.length, kick: L.kick, snare: L.snare, left: L.q.map(e => e.row) };
  });
  ok(ex.before === 2 && ex.after === 1 && ex.left.join() === '1' && ex.kick > .5 && ex.snare === 0, 'a hit fires when the audio clock reaches it, and a future one waits (kick ' + ex.kick.toFixed(2) + ', snare ' + ex.snare + ', left ' + ex.left + ')');
  const fr = await ev(() => { const d = window.__daily, L = d.LX, z = () => { L.kick = L.snare = L.hat = L.perc = L.tom = 0; L.chase = 0; L.strobeReq = false; }, r = {}; z(); d.lxFire({ row: 0, v: 3 }); r.kick = L.kick; z(); d.lxFire({ row: 1, v: 3 }); r.snare = L.snare; r.req = L.strobeReq; z(); d.lxFire({ row: 2, v: 2 }); d.lxFire({ row: 3, v: 2 }); r.hat = L.hat; r.chase = L.chase; z(); d.lxFire({ row: 4, v: 2 }); r.perc = L.perc; z(); d.lxFire({ row: 5, v: 2 }); r.tom = L.tom; r.tchase = L.chase; z(); d.lxFire({ row: 0, v: 1 }); r.soft = L.kick; return r; });
  ok(fr.kick >= .99 && fr.snare >= .99 && fr.req && fr.hat >= .5 && fr.chase === 2 && fr.perc === 1 && fr.tom === 1 && fr.tchase === 2 && fr.soft < fr.kick, 'every drum row has its own light: kick pumps, snare flicks and asks for the blinder, hats step the chase, toms jump it, and a soft hit is a soft light (' + JSON.stringify(fr) + ')');

  // the band itself drives them: play and watch the lights move
  const live = await ev(() => new Promise(async res => { const d = window.__daily; d.S.band.drumsOn = true; d.T.cursor = 0; d.STG.cur = 0; await d.play(); let mk = 0, ms = 0, mh = 0; const iv = setInterval(() => { mk = Math.max(mk, d.LX.kick); ms = Math.max(ms, d.LX.snare); mh = Math.max(mh, d.LX.hat); }, 12); setTimeout(() => { clearInterval(iv); d.stopPlay && d.stopPlay(true); res({ mk, ms, mh }); }, 4200); }));
  ok(live.mk > .12 && live.ms > .12 && live.mh > .12, 'with the band playing, the kick, snare and hats each light the rig (kick ' + live.mk.toFixed(2) + ', snare ' + live.ms.toFixed(2) + ', hat ' + live.mh.toFixed(2) + ')');
  await ev(() => { const d = window.__daily; d.stopPlay(true); d.T.cursor = 0; }); await wait(400);

  // ---- the blinder: at most once a bar, never closer than the comfort gap, none at all in Calm
  await ev(() => { const d = window.__daily; d.S.sections = [{ id: 'c', name: 'Chorus', lyrics: '', bars: [{ chord: 'C', tab: [] }, { chord: 'F', tab: [] }, { chord: 'G', tab: [] }, { chord: 'C', tab: [] }] }, { id: 'v', name: 'Verse', lyrics: '', bars: [{ chord: 'Am', tab: [] }] }]; d.commit(false); d.T.cursor = 0; d.STG.cur = 1; });   // Backlight: the look with a blinder
  await ev(async () => { await window.__daily.play(); }); await wait(1500);
  const sb = await ev(() => {
    const d = window.__daily, L = d.LX, X = () => window.__mkX(), now = () => performance.now(), out = {}; d.lxUpdate(.016, X()); out.kind = L.kind; L.gov = 1;
    const go = (gap, comfort) => { d.STG.comfort = comfort; L.drop = 0; L.strobe = 0; L.strobeReq = true; L.lastStrobeBar = -1; L.lastStrobe = now() - gap; d.lxUpdate(.016, X()); return L.strobe; };
    out.stdSoon = go(100, 'standard'); out.stdLate = go(400, 'standard'); out.fullSoon = go(150, 'full'); out.fullLate = go(400, 'full'); out.calmLate = go(5000, 'calm');
    d.STG.comfort = 'full'; L.drop = 0; L.strobe = 0; L.strobeReq = true; L.lastStrobeBar = L.barIdx; L.lastStrobe = now() - 5000; d.lxUpdate(.016, X()); out.sameBar = L.strobe;
    const px = c => { d.STG.comfort = c; const cv = document.createElement('canvas'); cv.width = cv.height = 8; const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 8, 8); L.strobe = 1; L.gov = 1; d.lxStrobe(g, 8, 8); return g.getImageData(4, 4, 1, 1).data[0]; };
    out.pxStd = px('standard'); out.pxFull = px('full'); out.pxCalm = px('calm'); d.STG.comfort = 'full'; return out;
  });
  ok(sb.kind === 'chorus', 'the chorus is playing, so the program is a chorus (' + sb.kind + ')');
  ok(sb.stdSoon < .03 && sb.stdLate > .9, 'Standard: no second flash inside 340 ms, one after it (' + sb.stdSoon.toFixed(2) + ' then ' + sb.stdLate.toFixed(2) + ')');
  ok(sb.fullSoon < .03 && sb.fullLate > .9, 'Full show keeps the same limit: nothing 150 ms after the last flash, a flash at 400 ms (' + sb.fullSoon.toFixed(2) + ' then ' + sb.fullLate.toFixed(2) + ')');
  ok(sb.calmLate === 0, 'Calm has no blinder at all, however long it has been (' + sb.calmLate + ')');
  ok(sb.sameBar === 0, 'at most one blinder a bar: a second request in the same bar is refused even after 5 s');
  ok(sb.pxCalm === 0 && sb.pxStd > 15 && sb.pxStd < 70 && sb.pxFull > sb.pxStd * 1.5, 'the flash is a soft wash in Standard and stronger in Full (brightness ' + sb.pxStd + ' and ' + sb.pxFull + '; Calm ' + sb.pxCalm + ')');
  await ev(() => { const d = window.__daily; d.stopPlay(true); d.T.cursor = 0; }); await wait(300);

  // ---- the picture: not blank, colour follows the chord, the kick lifts it
  const pic = await ev(() => {
    const d = window.__daily, L = d.LX; d.stopPlay && d.stopPlay(true); d.CFG.lens = 'perform';
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d');
    const stat = () => { const a = g.getImageData(0, 0, 640, 360).data; let r = 0, gg = 0, b = 0, l = 0, l2 = 0, n = 0; for (let i = 0; i < a.length; i += 40) { r += a[i]; gg += a[i + 1]; b += a[i + 2]; const y = .3 * a[i] + .59 * a[i + 1] + .11 * a[i + 2]; l += y; l2 += y * y; n++; } const m = l / n; return { r: r / n, g: gg / n, b: b / n, lum: m, sd: Math.sqrt(Math.max(0, l2 / n - m * m)) }; };
    const run = sym => { for (let i = 0; i < 160; i++) { L.sym = sym; L.symT = performance.now(); d.concertDraw(g, 640, 360, window.__mkX(.05)); } return stat(); };
    d.CFG.show.design = 'pixels'; const C = run('C'), hueC = L.key[0], Fs = run('F#'), hueFs = L.key[0], C2 = run('C'), hueC2 = L.key[0];
    L.kick = 0; L.snare = 0; L.sym = 'C'; L.symT = performance.now(); d.concertDraw(g, 640, 360, window.__mkX(.001)); const calm = stat(); L.kick = 1; L.sym = 'C'; L.symT = performance.now(); d.concertDraw(g, 640, 360, window.__mkX(.001)); const hit = stat();
    return { C, Fs, C2, calm, hit, hueC, hueFs, hueC2, dFs: Math.abs(((hueFs - hueC + 540) % 360) - 180) };
  });
  ok(pic.C.lum > 12 && pic.C.sd > 8 && pic.Fs.lum > 12, 'the picture is a lit stage, not a blank or a flat fill (brightness ' + pic.C.lum.toFixed(0) + ', spread ' + pic.C.sd.toFixed(0) + ')');
  ok(Math.abs(pic.hueC - pic.hueC2) < 6 && pic.hueC !== pic.hueFs && pic.dFs > 12, 'the colour follows the harmony inside the design\u2019s own palette: home, the far side of the circle, and back (hue ' + pic.hueC.toFixed(0) + '°, F♯ ' + pic.hueFs.toFixed(0) + '°, C again ' + pic.hueC2.toFixed(0) + '°)');
  ok(pic.hit.lum > pic.calm.lum + 1.5, 'a kick drum lifts the whole picture (' + pic.calm.lum.toFixed(1) + ' → ' + pic.hit.lum.toFixed(1) + ')');

  // ---- lenses: what each one writes on the picture
  const lens = await ev(() => {
    const d = window.__daily, L = d.LX, texts = [], out = {}; d.S.sections = [{ id: 'a', name: 'Verse', lyrics: '', bars: [{ chord: 'C', tab: [] }, { chord: 'Am', tab: [] }, { chord: 'F', tab: [] }, { chord: 'G', tab: [] }] }, { id: 'b', name: 'Chorus', lyrics: '', bars: [{ chord: 'F', tab: [] }, { chord: 'G', tab: [] }, { chord: 'Em', tab: [] }, { chord: 'Am', tab: [] }] }]; d.commit(false);
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; const g = cv.getContext('2d'), ft = g.fillText.bind(g); g.fillText = (s, ...r) => { texts.push(String(s)); return ft(s, ...r); };
    const draw = k => { d.CFG.lens = k; texts.length = 0; d.T.cursor = 16; L.sym = 'Am'; L.symT = performance.now(); for (let i = 0; i < 3; i++) d.concertDraw(g, 1280, 720, window.__mkX()); return texts.slice(); };
    out.perform = draw('perform'); out.teach = draw('teach'); out.sky = draw('sky'); d.CFG.lens = 'perform'; d.T.cursor = 0; return out;
  });
  ok(lens.perform.length === 0, 'Perform writes nothing on the picture: the chord and lyric belong to the lower third (' + lens.perform.length + ' texts)');
  ok(['NOW', 'NEXT', 'Am', 'vi', 'F', 'G', 'HOME'].every(s => lens.teach.includes(s)) && lens.teach.some(s => /^IV\s+\+1$/.test(s)) && lens.teach.some(s => /^V\s+\+2$/.test(s)) && lens.teach.some(s => /MAJOR/.test(s) && /BPM/.test(s)) && lens.teach.includes('ENERGY') && lens.teach.includes('TENSION'), 'Teach shows the chord and its numeral, what comes next with numerals, home on the ring, the key and the mood meters (' + [...new Set(lens.teach)].slice(0, 12).join(' ') + ' …)');
  ok(lens.sky.includes('SESSION SKY'), 'Sky is titled and shows the session constellation');

  // ---- the band the lenses draw in stays clear of the lower third
  const bd = await ev(() => { const d = window.__daily, W = 1920, H = 1080, r = {}; d.STG.pb.on = false; r.off = d.lxMakeBand(W, H); d.STG.pb.on = true; d.STG.pb.lower = true; d.STG.pb.pos = 'bottom'; r.bottom = d.lxMakeBand(W, H); r.rb = d.pbLowerRect(W, H); d.STG.pb.pos = 'top'; r.top = d.lxMakeBand(W, H); r.rt = d.pbLowerRect(W, H); d.STG.pb.lower = false; r.noLower = d.lxMakeBand(W, H); r.rn = d.pbLowerRect(W, H); d.STG.pb.on = false; d.STG.pb.pos = 'bottom'; d.STG.pb.lower = true; return r; });
  ok(bd.off[0] < 80 && bd.off[1] > 900 && bd.off[1] <= 1030 && bd.rn === null, 'with no backdrop the Teach and Sky lenses use nearly the whole picture (' + bd.off.map(Math.round).join('–') + ' of 1080)');
  ok(bd.bottom[1] < bd.rb.y && bd.bottom[1] - bd.bottom[0] > 1080 * .3, 'with a lower third at the bottom they stop above it (band ends ' + Math.round(bd.bottom[1]) + ', panel starts ' + Math.round(bd.rb.y) + ')');
  ok(bd.top[0] > bd.rt.y + bd.rt.h && bd.top[1] > 900, 'with the lower third at the top they start below it (band starts ' + Math.round(bd.top[0]) + ', panel ends ' + Math.round(bd.rt.y + bd.rt.h) + ')');
  ok(bd.noLower[0] < 80 && bd.rn === null, 'a backdrop without its lower third leaves the room alone');
  const sizes = await ev(() => { const d = window.__daily, L = d.LX; const r = []; ['teach', 'sky', 'perform'].forEach(k => { d.CFG.lens = k; [[320, 180], [1358, 540], [1280, 720], [1920, 1080], [800, 1200]].forEach(([w, h]) => { try { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); for (let i = 0; i < 2; i++) d.concertDraw(g, w, h, window.__mkX()); } catch (e) { r.push(k + ' ' + w + 'x' + h + ': ' + e.message); } }); }); d.CFG.lens = 'perform'; return r; });
  ok(sizes.length === 0, 'every lens draws at tiny, wide, 16:9 and portrait sizes without an error' + (sizes.length ? ' · ' + sizes[0] : ''));
  ok(await ev(() => { const d = window.__daily; d.CFG.lens = 'teach'; d.STG.pb.on = true; d.STG.pb.lower = true; d.stageFrame(performance.now()); d.stageFrame(performance.now() + 20); d.CFG.lens = 'sky'; d.stageFrame(performance.now() + 40); d.CFG.lens = 'perform'; d.STG.pb.on = false; return d.SG.cv.width > 100; }), 'the Teach and Sky lenses run through the real stage frame with the lower third on');

  // ---- the session sky
  const sky = await ev(() => { const d = window.__daily, L = d.LX; d.lxSkyClear(); ['C', 'G', 'C', 'Am', 'Am'].forEach(s => d.lxSkyAdd(s)); const sk = L.sky; const out = { nodes: sk.nodes.size, edges: [...sk.edges.keys()].sort().join(), moves: sk.moves, c: sk.nodes.get('C').n, am: sk.nodes.get('Am').n }; L.band = [100, 700]; const ps = ['C', 'G', 'Am', 'F#m'].map(s => d.lxSkyPos(s, 1280, 800)); out.inside = ps.every(q => q.x > 0 && q.x < 1280 && q.y > 100 && q.y < 700); L.band = null; d.lxSkyClear(); out.cleared = sk.nodes.size === 0 && sk.edges.size === 0 && sk.moves === 0; return out; });
  ok(sky.nodes === 3 && sky.edges === 'C>Am,C>G,G>C' && sky.moves === 3 && sky.c === 2 && sky.am === 2, 'every chord becomes a star and every move a line; repeats count but are not moves (' + sky.nodes + ' stars, ' + sky.edges + ')');
  ok(sky.inside && sky.cleared, 'stars stay inside the free band, and New sky clears it');
  const poster = await ev(async () => { const d = window.__daily; d.lxSkyClear(); ['C', 'G', 'Am', 'F', 'C', 'G'].forEach(s => d.lxSkyAdd(s)); let dl = null; const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { dl = { name: this.download, href: this.href }; }; d.lxSkySave(); for (let i = 0; i < 40 && !dl; i++) await new Promise(r => setTimeout(r, 100)); HTMLAnchorElement.prototype.click = orig; if (!dl) return null; const b = await (await fetch(dl.href)).blob(); const bm = await createImageBitmap(b); return { name: dl.name, type: b.type, size: b.size, w: bm.width, h: bm.height }; });
  ok(poster && poster.name === 'the-daily-studio-sky.png' && poster.type === 'image/png' && poster.size > 20000 && poster.w === 1800 && poster.h === 1200, 'Save sky downloads a 1800 × 1200 PNG poster (' + (poster ? poster.name + ', ' + poster.w + '×' + poster.h + ', ' + Math.round(poster.size / 1024) + ' kB' : 'nothing') + ')');
  await ev(() => window.__daily.lxSkyClear());

  // ---- the Visuals bar and the lens switch
  const bar = await ev(() => { const d = window.__daily; return { modes: [...document.querySelectorAll('.seg [data-m]')].map(b => b.dataset.m), on: [...document.querySelectorAll('.seg [data-m].on')].map(b => b.dataset.m), lens: [...document.querySelectorAll('#lxLens [data-lens]')].map(b => b.dataset.lens), vmodes: d.VMODES.map(m => m[0]), mode: d.VZ.mode }; });
  ok(bar.modes[0] === 'hex' && bar.modes[1] === 'concert' && bar.on.join() === 'hex' && bar.mode === 'hex', 'Hex Resonance is the first visual and the one that starts selected, with Concert next to it (' + bar.modes.join(' ') + ')');
  ok(!bar.modes.includes('tunnel') && !bar.vmodes.includes('tunnel') && ['chroma', 'spectro', 'scope'].every(m => !bar.modes.includes(m) && bar.vmodes.includes(m)), 'Hex Tunnel is retired; the pitch wheel, spectrogram and scope left the bar but are still Stage scenes');
  ok(bar.lens.join() === 'perform,teach,sky', 'the lens switch offers Perform, Teach and Sky');
  const ls = await ev(() => { const d = window.__daily, r = {}; d.lxSetLens('sky'); r.sky = { cfg: d.CFG.lens, on: document.querySelector('#lxLens .on').dataset.lens, save: getComputedStyle(document.getElementById('lxSkySave')).display, sel: document.getElementById('pb_lens') ? document.getElementById('pb_lens').value : 'n/a' }; d.lxSetLens('teach'); r.teach = { cfg: d.CFG.lens, save: getComputedStyle(document.getElementById('lxSkySave')).display }; d.lxSetLens('bogus'); r.bogus = d.CFG.lens; d.lxSetLens('teach'); return r; });
  ok(ls.sky.cfg === 'sky' && ls.sky.on === 'sky' && ls.sky.save !== 'none' && ls.teach.save === 'none' && ls.bogus === 'perform', 'switching lens updates the bar, shows Save sky only on the Sky lens, and an unknown name falls back to Perform (' + JSON.stringify(ls.sky) + ')');
  await wait(300);
  await t.boot(p); await wait(500);
  ok(await ev(() => window.__daily.CFG.lens === 'teach'), 'the lens you chose is still chosen after a reload');
  await ev(() => { window.__mkX = (dt, en) => ({ fd: new Float32Array(1024).fill(-60), bin: f => Math.max(1, Math.min(1023, Math.round(f / 20))), lvl: x => Math.max(0, Math.min(1, (x + 88) / 62)), dt: dt || .016, energy: en == null ? .5 : en }); });
  await ev(() => window.__daily.lxSetLens('perform'));

  // ---- Monitor views card
  const mv = await ev(() => { const d = window.__daily, c = document.getElementById('mvCard'); if (!c) return null; const par = c.parentElement; const btns = [...c.querySelectorAll('[data-mv]')]; btns.find(b => b.dataset.mv === 'spectro').click(); const m1 = d.MV.mode, on1 = [...c.querySelectorAll('[data-mv].on')].map(b => b.dataset.mv).join(); btns.find(b => b.dataset.mv === 'chroma').click(); return { last: par.lastElementChild === c, card: c.dataset.card, kinds: btns.map(b => b.dataset.mv).join(), m1, on1, back: d.MV.mode, canvas: !!c.querySelector('canvas') }; });
  ok(mv && mv.last && mv.card === 'views' && mv.kinds === 'chroma,spectro,scope' && mv.canvas, 'the Monitor tab has a Views card, below the tuner, levels, live and spectrum (' + (mv && mv.kinds) + ')');
  ok(mv && mv.m1 === 'spectro' && mv.on1 === 'spectro' && mv.back === 'chroma', 'its three buttons switch the readout between pitch wheel, spectrogram and scope');

  // ---- saved looks from before: a Hex Tunnel scene becomes a Concert scene, and a saved Tunnel mode becomes Concert
  const old = await t.open({ debug: true, boot: false, init: new Function(`try { localStorage.setItem('fw.cfg', JSON.stringify({ visMode: 'tunnel', stage: { cur: 1, scenes: [ { name: 'Mine', mode: 'orbit', hue: 40, trail: .5, glow: .5, sens: 1, ov: { chord: true } }, { name: 'Tunnel', mode: 'tunnel', hue: 120, drift: .3, trail: .6, kal: 0, glow: .5, sens: 1, cam: false, flash: .5, sect: 'Chorus', ov: { chord: true } } ] } })); } catch (e) { }`) });
  await old.goto(t.BASE + '?debug'); await wait(3500);
  const mg = await old.evaluate(() => { const d = window.__daily; return { vis: d.CFG.visMode, vz: d.VZ.mode, modes: d.STG.scenes.map(s => s.mode), names: d.STG.scenes.slice(0, 2).map(s => s.name), tr: d.STG.scenes[1].trail, fl: d.STG.scenes[1].flash, sect: d.STG.scenes[1].sect, n: d.STG.scenes.length }; });
  ok(mg.vis === 'hex' && mg.vz === 'hex', 'a saved Hex Tunnel look opens as the default Hex Resonance (' + mg.vis + ')');
  ok(mg.modes.every(m => m !== 'tunnel') && mg.names.join() === 'Mine,Concert' && mg.modes[0] === 'orbit' && mg.modes[1] === 'concert' && mg.tr === 0 && mg.fl === 0 && mg.sect === 'Chorus' && mg.n === 8, 'a Tunnel scene becomes a Concert scene, keeping its section link, and scenes you made yourself are left alone (' + mg.names.join('/') + ')');
  await old.ctx.close();

  // ---- cost
  const cost = await ev(() => { const d = window.__daily, cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080; const g = cv.getContext('2d'); d.CFG.lens = 'teach'; for (let i = 0; i < 4; i++) d.concertDraw(g, 1920, 1080, window.__mkX()); const t0 = performance.now(); for (let i = 0; i < 20; i++) d.concertDraw(g, 1920, 1080, window.__mkX()); const ms = (performance.now() - t0) / 20; d.CFG.lens = 'perform'; return ms; });
  ok(cost < 60, 'a full-HD frame of the busiest lens costs ' + cost.toFixed(1) + ' ms in software rendering (limit 60; a graphics card is many times faster, and a slow machine drops to a lighter picture by itself)');
  ok(t.errors ? t.errors().length === 0 : true, 'no console errors');
});
