/* ============================================================
   Part 00 · ROOMS (2.40) — parts of the studio the hosted site loads the first time they are used
   The single-file index.html carries every part, so here room() simply answers at once. The site build (scripts/rooms.mjs) moves
   the parts listed in its ROOMS table into their own files and fills in ROOM.files, ROOM.sri, ROOM.sc and ROOM.apply below.
     room(id)            → a promise of the room's names, loading it once (one <script> from this site, checked by its hash)
     __roomFn(id, name)  the core's stand-in for a room function: loads the room, then calls the real one
   A room arrives through window.__dailyRoom, which only accepts the room being waited for. Nothing is fetched from anywhere else.
   ============================================================ */
const ROOM = { files: null, sri: null, sc: null, apply: null, done: {}, wait: {} };
/** load room `id` (no-op in the single-file app, where everything is already here) */
function room(id) {
  if (!ROOM.files || !ROOM.files[id]) return Promise.resolve(null);
  if (ROOM.done[id]) return Promise.resolve(ROOM.done[id]);
  if (ROOM.wait[id]) return ROOM.wait[id].p;
  const w = ROOM.wait[id] = {}; w.p = new Promise((res, rej) => { w.res = res; w.rej = rej; });
  const s = document.createElement('script'); s.src = ROOM.files[id]; s.async = true; if (ROOM.sri && ROOM.sri[id]) s.integrity = ROOM.sri[id];
  s.onerror = () => { delete ROOM.wait[id]; s.remove(); w.rej(new Error('room ' + id)); try { toast('That part of the studio could not load. Check the connection and try again (once loaded, it works offline).', 'bad'); } catch (e) { } };
  document.head.append(s); return w.p;
}
function __roomFn(id, name) { return async (...a) => { const x = await room(id); return x[name](...a); }; }
window.__dailyRoom = (id, make) => {
  const w = ROOM.wait[id]; if (!w || ROOM.done[id] || typeof make !== 'function') return;
  let x; try { x = make(ROOM.sc); } catch (e) { delete ROOM.wait[id]; console.error('room ' + id, e); w.rej(e); return; }
  ROOM.done[id] = x; delete ROOM.wait[id]; try { ROOM.apply(id, x); } catch (e) { console.error(e); }
  if (window.__daily) Object.assign(window.__daily, x);
  try { bus.emit('room', id); } catch (e) { } w.res(x);
};
