/* A small stand-in for GitHub's REST API, for the tests: users (by token), repositories, Git refs, commits, trees and blobs (with Git's own
   blob ids), the contents API, topics and repository search. It is shared by every browser context a test makes, so two "devices" can
   sync through it. install(ctx) routes https://api.github.com/** to it; F.log records every request (method, path, user).
   Only what the-daily.studio uses is here, and it answers the way GitHub does where it matters (404 for a private repository you cannot
   see, 409 for an empty one, 422 when a branch would not move forward, base64 contents). */
const crypto = require('node:crypto');

function fake(o = {}) {
  const F = { users: Object.assign({ tokA: 'tester' }, o.users || {}), noCreate: new Set(o.noCreate || []), repos: {}, blobs: {}, trees: {}, commits: {}, log: [] };
  const sha1 = s => crypto.createHash('sha1').update(s).digest('hex');
  const blobId = buf => sha1(Buffer.concat([Buffer.from('blob ' + buf.length + '\0'), buf]));
  const putBlob = buf => { const id = blobId(buf); F.blobs[id] = buf; return id; };
  const putTree = map => { const id = sha1('tree ' + JSON.stringify(Object.keys(map).sort().map(k => [k, map[k]]))); F.trees[id] = Object.assign({}, map); return id; };
  const putCommit = (tree, parents, message) => { const id = sha1('commit ' + tree + parents.join() + message + Math.random()); F.commits[id] = { tree, parents, message }; return id; };
  const mkRepo = (owner, name, priv, init) => {
    const R = F.repos[owner + '/' + name] = { owner, name, private: !!priv, topics: [], branch: 'main', head: null, description: '' };
    if (init) { const t = putTree({ 'README.md': putBlob(Buffer.from('# ' + name + '\n')) }); R.head = putCommit(t, [], 'Initial commit'); }
    return R;
  };
  F.mkRepo = mkRepo; F.putBlob = putBlob;
  /** the files of a repository's head, as text */
  F.files = (full) => { const R = F.repos[full]; if (!R || !R.head) return {}; const t = F.trees[F.commits[R.head].tree], out = {}; Object.keys(t).forEach(k => { out[k] = F.blobs[t[k]].toString('utf8'); }); return out; };
  F.commitCount = (full) => { let n = 0, c = F.repos[full] && F.repos[full].head; while (c) { n++; c = F.commits[c].parents[0]; } return n; };

  const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-GitHub-Api-Version', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'Access-Control-Expose-Headers': 'x-ratelimit-remaining, x-ratelimit-reset', 'x-ratelimit-remaining': '4999', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600) };
  const reply = (route, status, body) => route.fulfill({ status, headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: body == null ? '' : JSON.stringify(body) });
  async function handle(route) {
    const req = route.request(), u = new URL(req.url()), m = req.method(), p = decodeURIComponent(u.pathname);
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: H, body: '' });
    const auth = (req.headers()['authorization'] || '').replace(/^Bearer\s+/i, ''), user = auth ? F.users[auth] : null;
    F.log.push({ m, p: u.pathname + u.search, user: user || (auth ? '?' : null) });
    if (auth && !user) return reply(route, 401, { message: 'Bad credentials' });
    let body = null; try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch (e) { }
    let x;
    if (m === 'GET' && p === '/user') return user ? reply(route, 200, { login: user }) : reply(route, 401, { message: 'Requires authentication' });
    if (m === 'POST' && p === '/user/repos') {
      if (!user) return reply(route, 401, { message: 'Requires authentication' }); if (F.noCreate.has(auth)) return reply(route, 403, { message: 'Resource not accessible by personal access token' });
      if (F.repos[user + '/' + body.name]) return reply(route, 422, { message: 'name already exists on this account' });
      const R = mkRepo(user, body.name, body.private, body.auto_init); R.description = body.description || ''; return reply(route, 201, { full_name: user + '/' + body.name, private: R.private, default_branch: 'main' });
    }
    if (m === 'GET' && p === '/search/repositories') {
      const q = u.searchParams.get('q') || '', topic = (/topic:(\S+)/.exec(q) || [])[1];
      const items = Object.values(F.repos).filter(R => !R.private && (!topic || R.topics.includes(topic))).map(R => ({ name: R.name, full_name: R.owner + '/' + R.name, owner: { login: R.owner }, private: false, description: R.description, stargazers_count: 0, updated_at: new Date().toISOString() }));
      return reply(route, 200, { total_count: items.length, items });
    }
    if ((x = /^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/.exec(p))) {
      const full = x[1] + '/' + x[2], R = F.repos[full], rest = x[3] || '';
      if (!R || (R.private && user !== R.owner)) return reply(route, 404, { message: 'Not Found' });
      const mine = user === R.owner;
      if (m === 'GET' && !rest) return reply(route, 200, { full_name: full, private: R.private, default_branch: R.branch, size: 1 });
      if (m === 'PUT' && rest === '/topics') { if (!mine) return reply(route, 403, { message: 'Forbidden' }); R.topics = body.names || []; return reply(route, 200, { names: R.topics }); }
      if (m === 'GET' && rest === '/git/ref/heads/' + R.branch) return R.head ? reply(route, 200, { ref: 'refs/heads/' + R.branch, object: { sha: R.head, type: 'commit' } }) : reply(route, 409, { message: 'Git Repository is empty.' });
      let y;
      if (m === 'GET' && (y = /^\/git\/commits\/(\w+)$/.exec(rest))) { const c = F.commits[y[1]]; return c ? reply(route, 200, { sha: y[1], tree: { sha: c.tree }, parents: c.parents.map(s => ({ sha: s })), message: c.message }) : reply(route, 404, { message: 'Not Found' }); }
      if (m === 'GET' && (y = /^\/git\/trees\/(\w+)$/.exec(rest))) { const t = F.trees[y[1]]; return t ? reply(route, 200, { sha: y[1], truncated: false, tree: Object.keys(t).map(k => ({ path: k, type: 'blob', mode: '100644', sha: t[k], size: F.blobs[t[k]].length })) }) : reply(route, 404, { message: 'Not Found' }); }
      if (m === 'GET' && (y = /^\/git\/blobs\/(\w+)$/.exec(rest))) { const b = F.blobs[y[1]]; return b ? reply(route, 200, { sha: y[1], encoding: 'base64', content: b.toString('base64'), size: b.length }) : reply(route, 404, { message: 'Not Found' }); }
      if (!mine && m !== 'GET') return reply(route, 403, { message: 'Must have admin rights to Repository.' });
      if (m === 'POST' && rest === '/git/trees') {
        const base = body.base_tree ? F.trees[body.base_tree] : {}; if (body.base_tree && !base) return reply(route, 422, { message: 'Invalid tree' }); const map = Object.assign({}, base);
        for (const e of body.tree || []) { if (e.sha === null) delete map[e.path]; else if (e.content != null) map[e.path] = putBlob(Buffer.from(e.content, 'utf8')); else if (e.sha) map[e.path] = e.sha; }
        return reply(route, 201, { sha: putTree(map) });
      }
      if (m === 'POST' && rest === '/git/commits') { if (!F.trees[body.tree]) return reply(route, 422, { message: 'Invalid tree' }); return reply(route, 201, { sha: putCommit(body.tree, body.parents || [], body.message || '') }); }
      if (m === 'PATCH' && rest === '/git/refs/heads/' + R.branch) { const c = F.commits[body.sha]; if (!c) return reply(route, 422, { message: 'Object does not exist' }); if (!body.force && R.head && !c.parents.includes(R.head)) return reply(route, 422, { message: 'Update is not a fast forward' }); R.head = body.sha; return reply(route, 200, { object: { sha: R.head } }); }
      if ((y = /^\/contents\/(.+)$/.exec(rest))) {
        const path = y[1];
        if (m === 'GET') { const t = R.head && F.trees[F.commits[R.head].tree], id = t && t[path]; return id ? reply(route, 200, { name: path.split('/').pop(), path, sha: id, size: F.blobs[id].length, encoding: 'base64', content: F.blobs[id].toString('base64') }) : reply(route, 404, { message: 'Not Found' }); }
        if (m === 'PUT') { const map = R.head ? Object.assign({}, F.trees[F.commits[R.head].tree]) : {}; map[path] = putBlob(Buffer.from(body.content, 'base64')); const c = putCommit(putTree(map), R.head ? [R.head] : [], body.message || ''); R.head = c; return reply(route, 201, { commit: { sha: c } }); }
      }
    }
    return reply(route, 404, { message: 'Not Found (fake)' });
  }
  F.install = ctx => ctx.route(/^https:\/\/api\.github\.com\//, handle);
  F.calls = () => F.log.length;
  return F;
}
module.exports = { fake };
