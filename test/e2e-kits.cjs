/* The drum machines and the Glide Sub (2.42, part 03b; neutral names since 2.47.1), measured from the studio's own render: the Deep Machine kick
   is a long sub around 48 Hz, the Club Machine kick is short and punchy, hats are bright metal (energy above 5 kHz), the clap is a burst, and the Glide Sub sits low and
   slides; the modern beats use them. Nothing here is a sample: every sound is made in the page. */
const { suite } = require('./lib.cjs');

suite('e2e-kits', async t => {
  const { ok } = t;
  const p = await t.open({ w: 1280, h: 800 }), ev = (f, a) => p.evaluate(f, a);
  /* render one bar of one drum row (or the bass) with everything else off, and measure it in the page */
  const one = (kit, row, extra) => ev(async ([kit, row, extra]) => {
    const D = window.__daily; await D.startAudio(); const B = D.S.band; D.T.metro = false;
    D.S.sections = [D.S.sections[0]]; D.S.sections[0].bars = [{ chord: extra && extra.chord || 'Am', tab: [] }]; D.S.bpm = 90; D.S.swing = 0;
    Object.assign(B, { kit, drumsOn: row != null, bassOn: !!extra, compOn: false, leadOn: false, keysOn: false, drumLen: 16, bassStyle: 'Root Whole', bassTone: extra && extra.tone || 'Round' });
    B.pat = Array.from({ length: 6 }, (_, r) => Array.from({ length: 32 }, (_, i) => r === row && i === 0 ? 3 : 0)); D.T.bars = null; D.commit(false);
    const o = await D.ofrRender({ tail: 1.5 }), x = o.l, sr = o.sr, n = x.length;
    let st = 0; while (st < n && Math.abs(x[st]) < .01) st++;
    const win = (a, b) => { let e = 0; for (let i = st + Math.floor(a * sr); i < Math.min(n, st + Math.floor(b * sr)); i++) e += x[i] * x[i]; return e; };
    const zc = (a, b) => { let c = 0; for (let i = st + Math.floor(a * sr) + 1; i < Math.min(n, st + Math.floor(b * sr)); i++) if ((x[i - 1] < 0) !== (x[i] < 0)) c++; return c / 2 / (b - a); };
    const ah = Math.exp(-2 * Math.PI * 5000 / sr); let lp = 0, hi = 0, all = 0; for (let i = st; i < Math.min(n, st + sr * .3); i++) { lp = ah * lp + (1 - ah) * x[i]; const hp = x[i] - lp; hi += hp * hp; all += x[i] * x[i]; }
    return { ok: st < n, early: win(0, .1), mid: win(.4, .5), late: win(.8, .9), f: zc(.15, .45), zHi: zc(0, .03), hiShare: hi / Math.max(all, 1e-12) };
  }, [kit, row, extra]);
  const dB = (a, b) => 10 * Math.log10(Math.max(a, 1e-12) / Math.max(b, 1e-12));
  const k8 = await one('Deep Machine', 0), k9 = await one('Club Machine', 0);
  ok(k8.ok && k8.f > 38 && k8.f < 62, 'Deep Machine kick: a sub at about ' + k8.f.toFixed(0) + ' Hz');
  ok(dB(k8.early, k8.mid) < 22 && dB(k9.early, k9.mid) > dB(k8.early, k8.mid) + 6, 'Deep Machine kick rings on (−' + dB(k8.early, k8.mid).toFixed(0) + ' dB at 0.4 s); the Club Machine kick is short and punchy (−' + dB(k9.early, k9.mid).toFixed(0) + ' dB)');
  const h8 = await one('Deep Machine', 2), ac = await one('Acoustic', 2), oh = await one('Deep Machine', 3);
  ok(h8.zHi > 6000, 'Deep Machine closed hat: bright metal, crossing zero about ' + Math.round(h8.zHi) + ' times a second (a sound centred near ' + (h8.zHi / 1000).toFixed(1) + ' kHz), not the low clank of square waves');
  ok(dB(oh.early, oh.mid) < dB(h8.early, h8.mid), 'the open hat rings longer than the closed one');
  const cl = await one('Deep Machine', 4), sn = await one('Boom Bap', 1);
  ok(cl.ok && cl.early > 0 && dB(cl.early, cl.mid) > 15, 'the clap is a burst with a short room (gone −' + dB(cl.early, cl.mid).toFixed(0) + ' dB by 0.4 s)');
  ok(sn.ok && sn.early > 0, 'Boom Bap snare plays');
  const sub = await one('Deep Machine', null, { tone: 'Glide Sub', chord: 'Am' }), pl = await one('Deep Machine', null, { tone: 'Round', chord: 'Am' });
  ok(sub.f > 48 && sub.f < 62 && sub.hiShare < .05, 'Glide Sub: a low A (' + sub.f.toFixed(0) + ' Hz, an octave under the plucked bass) with almost nothing up top');
  ok(dB(sub.early, sub.mid) < 6, 'and it holds the note instead of plucking it (' + dB(sub.early, sub.mid).toFixed(1) + ' dB down at 0.4 s)');
  /* the acoustic kits (2.42): a room, a rim click, and hits that differ */
  const rs = await one('Rock Room', 1), ds = await one('Deep Machine', 1);
  ok(rs.mid > ds.mid * 4 && rs.late > 0, 'Rock Room snare carries its room (still sounding at 0.4 s, ' + dB(rs.mid, ds.mid).toFixed(0) + ' dB above the dry Deep Machine snare there)');
  const rim = await one('Acoustic', 4);
  ok(rim.ok && rim.zHi > 400 && rim.zHi < 2500 && dB(rim.early, rim.mid) > 20, 'the rim row on a real kit is a cross-stick: a short woody knock (about ' + Math.round(rim.zHi) + ' Hz), not a clap');
  const a1 = await one('Acoustic', 0), a2 = await one('Acoustic', 0), a3 = await one('Acoustic', 0), es = [a1, a2, a3].map(x => x.early), spread = (Math.max(...es) - Math.min(...es)) / Math.max(...es);
  ok(a1.ok && a1.f > 45 && a1.f < 95 && spread > .003, 'the acoustic kick sits at about ' + a1.f.toFixed(0) + ' Hz, and hits are never quite the same (three hits ' + (spread * 100).toFixed(1) + '% apart)');
  const br = await one('Brush (soft)', 1);
  ok(br.ok && br.early > 0 && br.early < rs.early, 'the brush snare is a softer swish than the rock snare');
  const B = await ev(() => { const D = window.__daily, by = id => D.BEATS.find(b => b.id === id); return { trap: by('trap').kit + '/' + by('trap').tone, drill: !!by('drill'), afro: !!by('afro'), rnb: !!by('rnb'), lofi: by('lofi').kit, night: by('night').kit, tones: D.BASS_TONES.includes('Glide Sub') }; });
  ok(B.trap === 'Deep Machine/Glide Sub' && B.night === 'Club Machine' && B.lofi === 'Boom Bap' && B.drill && B.afro && B.rnb && B.tones, 'the modern beats use them (Trap on the Deep Machine with the Glide Sub, Night Drive on the Club Machine, Lo-fi on Boom Bap), and Drill, Afrobeats and R&B are new');
  /* 2.47.1: neutral names; a song, link or snapshot saved with the old ones opens with the new */
  const RN = await ev(async () => { const D = window.__daily, n = D.normSong({ title: 'Old', sections: [], band: { kit: '808', bassTone: '808 Sub' } }), n9 = D.normSong({ sections: [], band: { kit: '909' } });
    const kits = Object.keys(D.KITS), names = D.BEATS.map(b => b.name).join('|');
    return { kit: n.band.kit, tone: n.band.bassTone, k9: n9.band.kit, gone: !kits.some(k => /\d{3}/.test(k)) && !D.BASS_TONES.some(t => /\d{3}/.test(t)), afro: D.BEATS.find(b => b.id === 'afro').name, names }; });
  ok(RN.kit === 'Deep Machine' && RN.k9 === 'Club Machine' && RN.tone === 'Glide Sub' && RN.gone, 'neutral names (2.47.1): Deep Machine, Club Machine and Glide Sub, and a song saved with the old names opens with them');
  ok(RN.afro === 'Golden Hour' && !/Afro Sunset/.test(RN.names), 'the Afrobeats beat is called Golden Hour');
});
