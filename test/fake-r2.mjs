/* An in-memory stand-in for a Cloudflare R2 bucket binding: just what worker/share.mjs uses (put, get, head, delete, list). */
export function fakeR2() {
  const m = new Map();
  const obj = (k, v) => ({ key: k, size: v.bytes.length, customMetadata: v.meta, httpMetadata: v.http, uploaded: new Date(v.at) });
  return {
    m,
    async put(k, v, o = {}) { const bytes = typeof v === 'string' ? new TextEncoder().encode(v) : new Uint8Array(v instanceof ArrayBuffer ? v : v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)); m.set(k, { bytes, meta: o.customMetadata || {}, http: o.httpMetadata || {}, at: Date.now() }); return obj(k, m.get(k)); },
    async get(k) { const v = m.get(k); if (!v) return null; return Object.assign(obj(k, v), { body: v.bytes.slice(), async text() { return new TextDecoder().decode(v.bytes); } }); },
    async head(k) { const v = m.get(k); return v ? obj(k, v) : null; },
    async delete(k) { m.delete(k); },
    async list(o = {}) { const all = [...m.keys()].filter(k => k.startsWith(o.prefix || '')).sort(), lim = o.limit || 1000; return { objects: all.slice(0, lim).map(k => obj(k, m.get(k))), truncated: all.length > lim }; }
  };
}
