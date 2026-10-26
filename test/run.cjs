/* Run the browser tests in parallel. Every file is independent (own server, own browser, own contexts), so they can run side by side.
   Usage:  node test/run.cjs                run everything
           node test/run.cjs clips midi     only files whose name contains one of these words
   Options: JOBS=3 (parallel files; default is half the processors, 1 to 4) · CHROMIUM_PATH · NO_SANDBOX=1 · BASE_URL (test a deployed site) */
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const all = fs.readdirSync(__dirname).filter(f => /^(e2e(-.+)?|mobile)\.cjs$/.test(f)).sort((a, b) => (a === 'e2e.cjs' ? -1 : b === 'e2e.cjs' ? 1 : a.localeCompare(b)));
const want = process.argv.slice(2), files = want.length ? all.filter(f => want.some(w => f.includes(w))) : all;
const jobs = Math.max(1, Math.min(+process.env.JOBS || Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2))), files.length));
if (!files.length) { console.error('No test file matches ' + want.join(', ')); process.exit(2); }
const t0 = Date.now(), res = []; let next = 0, running = 0;
function start(f) {
  const out = []; const c = spawn(process.execPath, [path.join(__dirname, f)], { env: process.env, cwd: path.join(__dirname, '..') }); const t1 = Date.now();
  c.stdout.on('data', d => out.push(d)); c.stderr.on('data', d => out.push(d));
  c.on('close', code => {
    const txt = Buffer.concat(out).toString(), lines = txt.split('\n'), fail = lines.filter(l => /^FAIL /.test(l)), okn = lines.filter(l => /^ok /.test(l)).length;
    res.push({ f, code, fail: fail.length, ok: okn, s: (Date.now() - t1) / 1000 });
    console.log(`\n━━ ${f} · ${code === 0 ? 'passed' : 'FAILED'} · ${okn} ok, ${fail.length} failed · ${((Date.now() - t1) / 1000).toFixed(0)} s`);
    if (code !== 0) console.log(txt.split('\n').filter(l => !/^ok /.test(l)).join('\n').trim().slice(-3000));
    running--; pump();
  });
  running++;
}
function pump() {
  while (running < jobs && next < files.length) start(files[next++]);
  if (running === 0 && next >= files.length) {
    const bad = res.filter(r => r.code !== 0), n = res.reduce((a, r) => a + r.ok, 0), nf = res.reduce((a, r) => a + r.fail, 0);
    console.log(`\n${'─'.repeat(60)}\n${res.length} files · ${n} checks passed${nf ? ' · ' + nf + ' failed' : ''} · ${((Date.now() - t0) / 1000).toFixed(0)} s (${jobs} at a time)`);
    res.sort((a, b) => b.s - a.s).slice(0, 4).forEach(r => console.log(`  ${r.f.padEnd(20)} ${r.s.toFixed(0)} s`));
    console.log(bad.length ? `\nFAILED: ${bad.map(r => r.f).join(', ')}` : '\nall checks passed'); process.exit(bad.length ? 1 : 0);
  }
}
console.log(`Running ${files.length} test files, ${jobs} at a time:\n  ${files.join('\n  ')}`); pump();
