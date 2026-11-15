/* Practice lessons (2.69): info steps that describe a shape now draw it (LPC.show), and two new paths —
   Progressions (named chord progressions, played through with the band) and Styles (what makes a genre sound like
   itself, with a riff from each) — give Learn real instruction on harmony and vocabulary, not just a tool to browse. */
const { suite } = require('./lib.cjs');

suite('e2e-lessons', async t => {
  const { ok, wait } = t;
  const p = await t.open({ w: 1500, h: 900 }), ev = (f, a) => p.evaluate(f, a);
  await ev(() => window.__daily.goalGo('practice')); await wait(400);

  /* ---- an info step that describes a shape draws it: the fretboard, the tab, and ▶ Listen (no record button) ---- */
  const info = await ev(() => {
    const d = window.__daily, lead = d.LESSONS.find(x => x.id === 'lead');
    d.coachOpen(lead.lessons[0].steps, 0, { title: 'Lead' });
    const c = document.getElementById('coach'), bd = c.querySelector('.co-board'), tb = c.querySelector('.co-tab');
    return { kind: d.CO.p.kind, notes: d.CO.p.notes.length, board: !!bd, svg: !!(bd && bd.querySelector('svg')), tab: tb ? tb.textContent.trim().length > 20 : false, listen: !!document.getElementById('coListen'), playBtn: !!document.getElementById('coGo') };
  }); await wait(200);
  ok(info.kind === 'info' && info.notes === 12 && info.board && info.svg && info.tab, 'an info step with a shape (LPC.show) draws the neck and the tab, not a blank box ' + JSON.stringify(info));
  ok(info.listen && !info.playBtn, 'it can be demoed (▶ Listen), but there is nothing to check (no ● Play it)');
  ok(await ev(() => !!window.__daily.CFG.learn.done[window.__daily.CO.p.id]), 'an info step still marks itself done on arrival');

  /* ---- Progressions: named chord progressions, taught and played through with the band ---- */
  const prog = await ev(() => window.__daily.LESSONS.find(x => x.id === 'prog'));
  ok(prog && prog.lessons.length === 6, 'Progressions has six named progressions (' + (prog ? prog.lessons.length : 'missing') + ')');
  ok(prog.lessons.map(l => l.name).join('|') === 'I–IV–V: the three-chord song|I–V–vi–IV: the pop progression|12-bar blues|ii–V–I: the jazz cadence|The Andalusian cadence|The minor loop', 'covering the three-chord song, the pop progression, 12-bar blues, the jazz cadence, the Andalusian cadence and the minor loop');
  const pg = await ev(() => {
    const d = window.__daily, lesson = d.LESSONS.find(x => x.id === 'prog').lessons[0];
    d.coachOpen(lesson.steps, 1, { title: 'Progressions · ' + lesson.name });
    return { kind: d.CO.p.kind, chords: d.CO.p.chords, title: d.CO.p.title, chordRow: document.querySelectorAll('#coach .co-chords .co-chord').length, bandOn: window.__daily.CFG.learn.back };
  }); await wait(200);
  ok(pg.kind === 'changes' && pg.chords.join(' ') === 'G C D C' && pg.title === 'G – C – D – C' && pg.chordRow === 4, 'the three-chord song plays G–C–D–C, with all four chord diagrams shown ' + JSON.stringify(pg));

  /* ---- Styles: what makes a genre sound like itself, taught with a riff from each ---- */
  const style = await ev(() => window.__daily.LESSONS.find(x => x.id === 'style'));
  ok(style && style.lessons.length === 6 && style.lessons.map(l => l.name).join(',') === 'Blues,Rock,Funk,Country,Pop,Reggae', 'Styles covers Blues, Rock, Funk, Country, Pop and Reggae (' + (style ? style.lessons.map(l => l.name).join(',') : 'missing') + ')');
  const sy = await ev(() => {
    const d = window.__daily, lesson = d.LESSONS.find(x => x.id === 'style').lessons[0];
    d.coachOpen(lesson.steps, 1, { title: 'Styles · ' + lesson.name });
    const c = document.getElementById('coach');
    return { kind: d.CO.p.kind, title: d.CO.p.title, notes: d.CO.p.notes.length, svg: !!c.querySelector('.co-board svg'), bpm: d.CO.bpm };
  }); await wait(200);
  ok(sy.kind === 'timed' && sy.title === 'Box-one turnaround' && sy.notes === 9 && sy.svg && sy.bpm === 80, 'the blues style lesson plays Box-one turnaround with the neck drawn ' + JSON.stringify(sy));

  /* ---- placed after Singing, before Warm-ups; existing test indices (LESSONS[0], LESSONS[1]) untouched ---- */
  const order = await ev(() => { const d = window.__daily; const ids = d.LESSONS.map(x => x.id); return { ids, foundIdx: ids.indexOf('found'), leadIdx: ids.indexOf('lead'), warmIdx: ids.indexOf('warm') }; });
  ok(order.foundIdx === 0 && order.leadIdx === 1, 'Foundations and Lead keep their original positions (index 0 and 1)');
  ok(order.ids.indexOf('prog') < order.warmIdx && order.ids.indexOf('style') < order.warmIdx && order.ids.indexOf('voice') < order.ids.indexOf('prog'), 'Progressions and Styles sit after Singing and before Warm-ups');

  /* ---- a singer's Today still only pulls from Singing, never from Progressions, Styles or the guitar paths ---- */
  const td = await ev(() => { const d = window.__daily; d.meSet('sing'); d.CFG.learn.today = null; const T = d.todayPlan(); return { me: T.me, voice: T.ids.every(x => d.LSTEP[x[1]] && d.LSTEP[x[1]].pa.id === 'voice') }; });
  ok(td.me === 'sing' && td.voice, 'a singer’s Today stays all-sung, unaffected by the new paths');
  await ev(() => window.__daily.meSet(''));

  /* ---- the new paths are reachable from the Learn panel's Lessons section (the Lessons tab, not Warm-ups or Singing) ---- */
  await ev(() => window.__daily.learnOpen('lessons')); await wait(300);
  const names = await ev(() => [...document.querySelectorAll('#learn section[data-sec="lessons"] .ln-path b')].map(x => x.textContent));
  ok(names.includes('Progressions') && names.includes('Styles'), 'Progressions and Styles show as paths in Learn ▸ Lessons (' + names.join(', ') + ')');
});
