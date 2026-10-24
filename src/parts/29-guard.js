/* ============================================================
   Part 29 · GUARD — a last line of defence: an unexpected error tells you plainly, once in a while, that your songs are safe
   (they are saved on every change). Browser noise that is not a real fault is ignored.
   ============================================================ */
const GUARD = { at: 0, n: 0 };
function guardReport(err) {
  const msg = String((err && err.message) || err || ''); GUARD.n++;
  if (!msg || /ResizeObserver|AbortError|NotAllowedError|The play\(\) request|Script error|Non-Error promise rejection/i.test(msg)) return;
  console.warn('[the-daily.studio]', err);
  if (Date.now() - GUARD.at < 20000) return; GUARD.at = Date.now();
  try { toast('Something went wrong. Your songs are saved on this device. If it keeps happening, reload the page or report it on GitHub.', 'warn'); } catch (e) { }
}
window.addEventListener('error', e => guardReport(e.error || e.message));
window.addEventListener('unhandledrejection', e => guardReport(e.reason));
