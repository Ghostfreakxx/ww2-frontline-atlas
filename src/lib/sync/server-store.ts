import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { initialState, SESSION_CODE_RE, type PresentationState } from './state.ts';

// Session store with two backends:
// - local: in-process memory with disk persistence (.data/sessions). For one Node process on the
//   presenter's own computer or LAN host (`npm start`). Changes are pushed to streams instantly.
// - redis: Upstash Redis over its REST API, used automatically when its environment variables are set
//   (e.g. on Vercel, where each request can run in a different serverless instance). Streams poll a
//   revision counter, so displays on any instance see the presenter's changes.

export interface Session {
  code: string;
  tokenHash: string;
  state: PresentationState;
  createdAt: number;
  updatedAt: number;
}

export type StorageKind = 'local' | 'redis' | 'ephemeral';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_TTL_S = 60 * 60 * 24 * 14;
const MAX_STATE_BYTES = 512 * 1024;

export const DATA_DIR = process.env.ATLAS_DATA_DIR || (process.env.VERCEL ? '/tmp/atlas-data' : path.join(process.cwd(), '.data'));
const SESSION_DIR = path.join(DATA_DIR, 'sessions');

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
export const newToken = () => crypto.randomBytes(18).toString('base64url');
const randomCode = () => Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');

// ---------------------------------------------------------------------------------------------
// Redis (Upstash REST) client

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const useRedis = Boolean(REDIS_URL && REDIS_TOKEN);

export function storageKind(): StorageKind {
  if (useRedis) return 'redis';
  return process.env.VERCEL ? 'ephemeral' : 'local';
}

type Cmd = (string | number)[];
export async function redis<T = unknown>(cmd: Cmd): Promise<T> {
  const res = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}` }, body: JSON.stringify(cmd), cache: 'no-store' });
  const j = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || j.error) throw new Error(`redis: ${j.error ?? res.status}`);
  return j.result as T;
}
export async function redisPipeline(cmds: Cmd[]): Promise<unknown[]> {
  const res = await fetch(`${REDIS_URL.replace(/\/$/, '')}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}` }, body: JSON.stringify(cmds), cache: 'no-store' });
  const j = (await res.json()) as { result?: unknown; error?: string }[];
  if (!res.ok || !Array.isArray(j)) throw new Error(`redis pipeline: ${res.status}`);
  return j.map((r) => {
    if (r.error) throw new Error(`redis: ${r.error}`);
    return r.result;
  });
}

const kState = (code: string) => `atlas:s:${code}`;
const kRev = (code: string) => `atlas:r:${code}`;
const kPresence = (code: string) => `atlas:p:${code}`;

// ---------------------------------------------------------------------------------------------
// Local backend

type Sub = (event: string, data: string) => void;
type Local = { sessions: Map<string, Session>; subs: Map<string, Set<Sub>>; timers: Map<string, ReturnType<typeof setTimeout>> };
const g = globalThis as unknown as { __atlasStore?: Local };
const local: Local = (g.__atlasStore ??= { sessions: new Map(), subs: new Map(), timers: new Map() });

function localLoad(code: string): Session | undefined {
  const cached = local.sessions.get(code);
  if (cached) return cached;
  const file = path.join(SESSION_DIR, `${code}.json`);
  if (!fs.existsSync(file)) return undefined;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const s: Session = { code, tokenHash: raw.tokenHash, state: { ...initialState(), ...raw.state }, createdAt: raw.createdAt, updatedAt: raw.updatedAt };
    local.sessions.set(code, s);
    return s;
  } catch {
    return undefined;
  }
}

function localPersist(s: Session) {
  clearTimeout(local.timers.get(s.code));
  local.timers.set(
    s.code,
    setTimeout(() => {
      try {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
        const tmp = path.join(SESSION_DIR, `${s.code}.json.tmp`);
        // Drafts (in-progress strokes) are transient and not persisted.
        fs.writeFileSync(tmp, JSON.stringify({ tokenHash: s.tokenHash, createdAt: s.createdAt, updatedAt: s.updatedAt, state: { ...s.state, draft: null } }));
        fs.renameSync(tmp, path.join(SESSION_DIR, `${s.code}.json`));
      } catch (e) {
        console.error('[atlas] could not persist session', s.code, e);
      }
    }, 500),
  );
}

function localBroadcast(code: string, event: string, data: string) {
  const subs = local.subs.get(code);
  if (!subs) return;
  for (const send of subs) {
    try {
      send(event, data);
    } catch {
      subs.delete(send);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Public API

export async function getSession(code: string): Promise<Session | undefined> {
  if (!SESSION_CODE_RE.test(code)) return undefined;
  if (!useRedis) return localLoad(code);
  const raw = await redis<string | null>(['GET', kState(code)]);
  if (!raw) return undefined;
  const j = JSON.parse(raw);
  return { code, tokenHash: j.tokenHash, state: { ...initialState(), ...j.state }, createdAt: j.createdAt, updatedAt: j.updatedAt };
}

async function insert(s: Session): Promise<boolean> {
  if (!useRedis) {
    if (local.sessions.has(s.code) || fs.existsSync(path.join(SESSION_DIR, `${s.code}.json`))) return false;
    local.sessions.set(s.code, s);
    localPersist(s);
    return true;
  }
  const [ok] = await redisPipeline([
    ['SET', kState(s.code), JSON.stringify(s), 'NX', 'EX', SESSION_TTL_S],
    ['SET', kRev(s.code), s.state.rev, 'EX', SESSION_TTL_S],
  ]);
  return ok === 'OK';
}

export async function createSession(opts: { code?: string; token?: string; state?: PresentationState } = {}): Promise<{ code: string; token: string; state: PresentationState } | { error: string }> {
  if (opts.code) {
    // Recovery: re-create a session the presenter still has locally (e.g. the server's data was wiped).
    if (!SESSION_CODE_RE.test(opts.code) || !opts.token) return { error: 'invalid-code' };
    const existing = await getSession(opts.code);
    if (existing) {
      if (existing.tokenHash !== hash(opts.token)) return { error: 'code-in-use' };
      return { code: existing.code, token: opts.token, state: existing.state };
    }
  }
  const token = opts.token ?? newToken();
  const now = Date.now();
  const state = { ...initialState(), ...(opts.state ?? {}), rev: 1 };
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = opts.code ?? randomCode();
    if (await insert({ code, tokenHash: hash(token), state, createdAt: now, updatedAt: now })) return { code, token, state };
    if (opts.code) return { error: 'code-in-use' };
  }
  return { error: 'no-code-available' };
}

export function authorize(s: Session, token: string | null) {
  if (!token) return false;
  const a = Buffer.from(s.tokenHash, 'hex');
  const b = Buffer.from(hash(token), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function updateState(s: Session, next: PresentationState): Promise<PresentationState> {
  if (JSON.stringify(next).length > MAX_STATE_BYTES) throw new Error('state-too-large');
  const updatedAt = Date.now();
  if (!useRedis) {
    const live = local.sessions.get(s.code) ?? s;
    const state: PresentationState = { ...next, rev: live.state.rev + 1 };
    live.state = state;
    live.updatedAt = updatedAt;
    local.sessions.set(s.code, live);
    localBroadcast(s.code, 'state', JSON.stringify(state));
    localPersist(live);
    return state;
  }
  const rev = Number(await redis(['INCR', kRev(s.code)]));
  const state: PresentationState = { ...next, rev };
  const record = { code: s.code, tokenHash: s.tokenHash, createdAt: s.createdAt, updatedAt, state: { ...state, draft: state.draft ?? null } };
  await redisPipeline([
    ['SET', kState(s.code), JSON.stringify(record), 'EX', SESSION_TTL_S],
    ['EXPIRE', kRev(s.code), SESSION_TTL_S],
  ]);
  return state;
}

/** Number of open streams (displays and presenters) on this session. */
export async function listenerCount(code: string): Promise<number> {
  if (!useRedis) return local.subs.get(code)?.size ?? 0;
  const now = Date.now();
  const [, n] = await redisPipeline([
    ['ZREMRANGEBYSCORE', kPresence(code), 0, now - PRESENCE_STALE_MS],
    ['ZCARD', kPresence(code)],
  ]);
  return Number(n);
}

const PRESENCE_STALE_MS = 25_000;
const POLL_MS = 300;

/**
 * Follow a session: calls `send` with `state` on every change and `presence` when the listener count
 * changes. Returns a stop function. Local: push-based. Redis: polls the revision counter.
 */
export function watch(code: string, initialRev: number, send: Sub): () => void {
  if (!useRedis) {
    let subs = local.subs.get(code);
    if (!subs) local.subs.set(code, (subs = new Set()));
    subs.add(send);
    const announce = () => localBroadcast(code, 'presence', JSON.stringify({ listeners: local.subs.get(code)?.size ?? 0 }));
    announce();
    return () => {
      local.subs.get(code)?.delete(send);
      announce();
    };
  }
  const id = crypto.randomUUID();
  let rev = initialRev;
  let listeners = -1;
  let stopped = false;
  let lastPresence = 0;
  let busy = false;
  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      const now = Date.now();
      if (now - lastPresence > 10_000) {
        lastPresence = now;
        const [, , n] = await redisPipeline([
          ['ZADD', kPresence(code), now, id],
          ['ZREMRANGEBYSCORE', kPresence(code), 0, now - PRESENCE_STALE_MS],
          ['ZCARD', kPresence(code)],
          ['EXPIRE', kPresence(code), SESSION_TTL_S],
        ]);
        if (Number(n) !== listeners) {
          listeners = Number(n);
          send('presence', JSON.stringify({ listeners }));
        }
      }
      const r = Number(await redis(['GET', kRev(code)]));
      if (r > rev) {
        const s = await getSession(code);
        if (s && s.state.rev > rev) {
          rev = s.state.rev;
          send('state', JSON.stringify(s.state));
        }
      }
    } catch (e) {
      console.error('[atlas] watch', code, e);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(tick, POLL_MS);
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
    void redis(['ZREM', kPresence(code), id]).catch(() => {});
  };
}
