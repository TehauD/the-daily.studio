/* Report a problem (2.19.1): the last errors are kept in memory, and Help ▸ Report a problem copies a report for a GitHub issue.
   Nothing is sent, and the report leaves out song titles, words, file names, device names and the tip link. */
const { suite } = require('./lib.cjs');

suite('e2e-report', async t => {
  const { ok, wait } = t;
  const p = await t.open({});
  await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const ev = (f, a) => p.evaluate(f, a);

  /* things the report must not carry */
  await ev(() => { const D = window.__daily; D.S.title = 'My Secret Song'; D.CFG.tip.link = 'ko-fi.com/private-person'; console.warn('could not open “My Secret Song.mp3” from blob:http://x/123'); });
  ok(await ev(() => { const g = window.__daily.GUARD.log; return g.length >= 1 && /“…”/.test(g[g.length - 1].msg) && !/Secret/.test(g[g.length - 1].msg) && /blob:…/.test(g[g.length - 1].msg); }), 'warnings are kept with quoted names and addresses blanked out');
  await ev(() => { setTimeout(() => { null.boom(); }, 0); }); await wait(400);
  const R = await ev(() => window.__daily.reportText());
  ok(/^the-daily\.studio problem report/.test(R) && /Version: v\d+\.\d+\.\d+ · build [0-9a-f]{7}/.test(R) && /Browser: Mozilla/.test(R) && /Audio: /.test(R) && /Storage: /.test(R), 'the report says the version, build, browser, audio and storage');
  ok(/error: .*boom|error: .*null/i.test(R), 'it lists the error that just happened');
  ok(!/Secret/.test(R) && !/private-person/.test(R) && !/ko-fi/.test(R), 'it has no song title, file name or tip link');
  ok(await ev(() => { for (let i = 0; i < 30; i++) console.warn('noise ' + i); return window.__daily.GUARD.log.length === 20; }), 'only the last 20 are kept');

  /* the toast offers it, and Help has it */
  ok(await ev(() => !!document.getElementById('guardReport')), 'after an error, the message offers to copy a problem report');
  await ev(() => window.__daily.openHelp('report')); await wait(400);
  ok(await ev(() => !!document.getElementById('reportCopy') && !!document.querySelector('#help a[href$="/issues/new"]')), 'Help ▸ Report a problem has Copy, Show it first and the GitHub link');
  await ev(() => document.getElementById('reportCopy').click()); await wait(500);
  const clip = await ev(() => navigator.clipboard.readText().catch(() => ''));
  ok(/problem report/.test(clip) && /Nothing was sent/.test(clip), 'Copy puts the report on the clipboard');
  await ev(() => document.getElementById('reportShow').click()); await wait(400);
  ok(await ev(() => { const ta = document.getElementById('reportText'); return !!ta && /problem report/.test(ta.value) && ta.readOnly; }), 'Show it first opens it to read and copy by hand');
  t.errs.length = 0;      /* the errors above were made on purpose */
});
