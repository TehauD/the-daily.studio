/* Run the browser tests in parallel. Every file is independent (own server, own browser, own contexts), so they can run side by side.
   Usage:  node test/run.cjs                run everything
           node test/run.cjs clips midi     only files whose name contains one of these words
   Options: JOBS=3 (parallel files; default is half the processors, 1 to 4) · CHROMIUM_PATH · NO_SANDBOX=1 · BASE_URL (test a deployed site)
            STRICT=1 (a file that fails beside others but passes on its own still counts as a failure)
   Files that time drawing (SOLO below) run on their own after the rest, so other tests do not slow their frames.
   A file that fails while others run beside it is run once more on its own: if it passes then, it is reported as flaky
   (passed alone) and named at the end, so it can be looked at, but it does not fail the run. A real fault fails both times. */
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const SOLO = ['e2e-concert.cjs', 'e2e-show.cjs'];
const all = fs.readdirSync(__dirname).filter(f => /^(e2e(-.+)?|mobile)\.cjs$/.test(f)).sort((a, b) => (a === 'e2e.cjs' ? -1 : b === 'e2e.cjs' ? 1 : a.localeCompare(b)));
const want = process.argv.slice(2), files = want.length ? all.filter(f => want.some(w => f.includes(w))) : all;
if (!files.length) { console.error('No test file matches ' + want.join(', ')); process.exit(2); }
const shared = files.filter(f => !SOLO.includes(f)), solo = files.filter(f => SOLO.includes(f));
const jobs = Math.max(1, Math.min(+process.env.JOBS || Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2))), shared.length || 1));
const strict = process.env.STRICT === '1', t0 = Date.now();

/** run one file; resolves with its result (and prints a summary, plus the failures) */
function run(f, how) {
  return new Promise(done => {
    const out = [], t1 = Date.now(), c = spawn(process.execPath, [path.join(__dirname, f)], { env: process.env, cwd: path.join(__dirname, '..') });
    c.stdout.on('data', d => out.push(d)); c.stderr.on('data', d => out.push(d));
    c.on('close', code => {
      const txt = Buffer.concat(out).toString(), lines = txt.split('\n'), fail = lines.filter(l => /^FAIL /.test(l)).length, ok = lines.filter(l => /^ok /.test(l)).length, s = (Date.now() - t1) / 1000;
      console.log(`\n━━ ${f}${how ? ' (' + how + ')' : ''} · ${code === 0 ? 'passed' : 'FAILED'} · ${ok} ok, ${fail} failed · ${s.toFixed(0)} s`);
      if (code !== 0) console.log(lines.filter(l => !/^ok /.test(l)).join('\n').trim().slice(-3000));
      done({ f, code, fail, ok, s });
    });
  });
}
/** run a list of files, n at a time */
async function pool(list, n, how) {
  const res = []; let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (next < list.length) res.push(await run(list[next++], how)); }));
  return res;
}

(async () => {
  console.log(`Running ${files.length} test files, ${jobs} at a time${solo.length ? ' (then ' + solo.join(', ') + ' on their own)' : ''}:\n  ${files.join('\n  ')}`);
  const first = await pool(shared, jobs, jobs > 1 ? 'beside others' : '');
  const soloRes = await pool(solo, 1, 'on its own');
  /* a second chance, on its own, for a file that failed beside others */
  const again = jobs > 1 ? first.filter(r => r.code !== 0) : [], flaky = [];
  if (again.length) console.log(`\n${'─'.repeat(60)}\nRunning ${again.map(r => r.f).join(', ')} again, on its own`);
  for (const r of again) { const r2 = await run(r.f, 'again, on its own'); if (r2.code === 0) { flaky.push(r.f); Object.assign(r, r2, { flaky: true }); } }
  const res = [...first, ...soloRes], bad = res.filter(r => r.code !== 0 || (strict && r.flaky));
  const n = res.reduce((a, r) => a + r.ok, 0), nf = res.reduce((a, r) => a + r.fail, 0);
  console.log(`\n${'─'.repeat(60)}\n${res.length} files · ${n} checks passed${nf ? ' · ' + nf + ' failed' : ''} · ${((Date.now() - t0) / 1000).toFixed(0)} s (${jobs} at a time)`);
  [...res].sort((a, b) => b.s - a.s).slice(0, 4).forEach(r => console.log(`  ${r.f.padEnd(20)} ${r.s.toFixed(0)} s`));
  if (flaky.length) console.log(`\nflaky (failed beside other tests, passed alone): ${flaky.join(', ')}${strict ? ' (STRICT=1: counted as failures)' : ''}`);
  console.log(bad.length ? `\nFAILED: ${bad.map(r => r.f).join(', ')}` : '\nall checks passed');
  process.exit(bad.length ? 1 : 0);
})();
