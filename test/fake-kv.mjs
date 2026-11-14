/* An in-memory stand-in for a Cloudflare Workers KV namespace binding: just what worker/honeypot.mjs uses (get, put with expirationTtl). */
export function fakeKV() {
  const m = new Map();
  return {
    m,
    async get(k) { const v = m.get(k); return v === undefined ? null : v.value; },
    async put(k, v, o = {}) { m.set(k, { value: v, expirationTtl: o.expirationTtl }); },
    async delete(k) { m.delete(k); },
  };
}
