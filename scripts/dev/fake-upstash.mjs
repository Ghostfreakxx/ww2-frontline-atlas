// Minimal in-memory stand-in for the Upstash Redis REST API (only the commands the app uses),
// for testing the hosted (redis) storage mode locally:
//   node scripts/dev/fake-upstash.mjs 8079
//   KV_REST_API_URL=http://localhost:8079 KV_REST_API_TOKEN=dev VERCEL=1 npm start
import http from 'node:http';

const port = Number(process.argv[2] || 8079);
const kv = new Map(); // key -> { v, exp }
const live = (k) => {
  const e = kv.get(k);
  if (e && e.exp && e.exp < Date.now()) kv.delete(k);
  return kv.get(k);
};
const exec = ([cmd, ...a]) => {
  const c = String(cmd).toUpperCase();
  const k = String(a[0]);
  switch (c) {
    case 'GET': return live(k)?.v ?? null;
    case 'SET': {
      const opts = a.slice(2).map(String);
      if (opts.includes('NX') && live(k)) return null;
      const ex = opts.indexOf('EX');
      kv.set(k, { v: String(a[1]), exp: ex >= 0 ? Date.now() + Number(opts[ex + 1]) * 1000 : 0 });
      return 'OK';
    }
    case 'INCR': {
      const e = live(k) ?? { v: '0', exp: 0 };
      e.v = String(Number(e.v) + 1);
      kv.set(k, e);
      return Number(e.v);
    }
    case 'EXPIRE': { const e = live(k); if (!e) return 0; e.exp = Date.now() + Number(a[1]) * 1000; return 1; }
    case 'ZADD': { const e = live(k) ?? { v: new Map(), exp: 0 }; e.v.set(String(a[2]), Number(a[1])); kv.set(k, e); return 1; }
    case 'ZREM': { const e = live(k); return e?.v.delete(String(a[1])) ? 1 : 0; }
    case 'ZREMRANGEBYSCORE': { const e = live(k); if (!e) return 0; let n = 0; for (const [m, s] of e.v) if (s >= Number(a[1]) && s <= Number(a[2])) { e.v.delete(m); n++; } return n; }
    case 'ZCARD': return live(k)?.v.size ?? 0;
    case 'SADD': { const e = live(k) ?? { v: new Set(), exp: 0 }; e.v.add(String(a[1])); kv.set(k, e); return 1; }
    case 'SMEMBERS': return [...(live(k)?.v ?? [])];
    default: throw new Error(`unsupported ${c}`);
  }
};
http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization !== 'Bearer dev') return res.writeHead(401).end(JSON.stringify({ error: 'unauthorized' }));
    const run = (cmd) => { try { return { result: exec(cmd) }; } catch (e) { return { error: e.message }; } };
    const cmds = JSON.parse(body);
    res.end(JSON.stringify(req.url === '/pipeline' ? cmds.map(run) : run(cmds)));
  });
}).listen(port, () => console.log(`fake upstash on ${port}`));
