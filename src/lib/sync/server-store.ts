import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { initialState, SESSION_CODE_RE, type PresentationState } from './state.ts';

// In-process session store with disk persistence (.data/sessions) for recovery after a server restart.
// Designed for a single Node process on the presenter's own computer or LAN host.

export interface Session {
  code: string;
  tokenHash: string;
  state: PresentationState;
  createdAt: number;
  updatedAt: number;
  subscribers: Set<(event: string, data: string) => void>;
  saveTimer?: ReturnType<typeof setTimeout>;
}

const DATA_DIR = process.env.ATLAS_DATA_DIR || path.join(process.cwd(), '.data');
const SESSION_DIR = path.join(DATA_DIR, 'sessions');
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type Store = { sessions: Map<string, Session> };
const g = globalThis as unknown as { __atlasStore?: Store };
const store: Store = (g.__atlasStore ??= { sessions: new Map() });

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function newCode(): string {
  for (;;) {
    const bytes = crypto.randomBytes(6);
    const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
    if (!store.sessions.has(code) && !fs.existsSync(path.join(SESSION_DIR, `${code}.json`))) return code;
  }
}

export const newToken = () => crypto.randomBytes(18).toString('base64url');

function load(code: string): Session | undefined {
  if (!SESSION_CODE_RE.test(code)) return undefined;
  const cached = store.sessions.get(code);
  if (cached) return cached;
  const file = path.join(SESSION_DIR, `${code}.json`);
  if (!fs.existsSync(file)) return undefined;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const s: Session = { code, tokenHash: raw.tokenHash, state: { ...initialState(), ...raw.state }, createdAt: raw.createdAt, updatedAt: raw.updatedAt, subscribers: new Set() };
    store.sessions.set(code, s);
    return s;
  } catch {
    return undefined;
  }
}

function persist(s: Session) {
  clearTimeout(s.saveTimer);
  s.saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      const tmp = path.join(SESSION_DIR, `${s.code}.json.tmp`);
      // Drafts (in-progress strokes) are transient and not persisted.
      fs.writeFileSync(tmp, JSON.stringify({ tokenHash: s.tokenHash, createdAt: s.createdAt, updatedAt: s.updatedAt, state: { ...s.state, draft: null } }));
      fs.renameSync(tmp, path.join(SESSION_DIR, `${s.code}.json`));
    } catch (e) {
      console.error('[atlas] could not persist session', s.code, e);
    }
  }, 500);
}

export function createSession(opts: { code?: string; token?: string; state?: PresentationState } = {}): { code: string; token: string; state: PresentationState } | { error: string } {
  if (opts.code) {
    // Recovery: re-create a session the presenter still has locally (e.g. the server's data was wiped).
    if (!SESSION_CODE_RE.test(opts.code) || !opts.token) return { error: 'invalid-code' };
    const existing = load(opts.code);
    if (existing) {
      if (existing.tokenHash !== hash(opts.token)) return { error: 'code-in-use' };
      return { code: existing.code, token: opts.token, state: existing.state };
    }
  }
  const code = opts.code ?? newCode();
  const token = opts.token ?? newToken();
  const now = Date.now();
  const state = { ...initialState(), ...(opts.state ?? {}), rev: 1 };
  const s: Session = { code, tokenHash: hash(token), state, createdAt: now, updatedAt: now, subscribers: new Set() };
  store.sessions.set(code, s);
  persist(s);
  return { code, token, state };
}

export function getSession(code: string) {
  return load(code);
}

export function authorize(s: Session, token: string | null) {
  if (!token) return false;
  const a = Buffer.from(s.tokenHash, 'hex');
  const b = Buffer.from(hash(token), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const MAX_STATE_BYTES = 512 * 1024;

export function updateState(s: Session, next: PresentationState): PresentationState {
  const state: PresentationState = { ...next, rev: s.state.rev + 1 };
  const json = JSON.stringify(state);
  if (json.length > MAX_STATE_BYTES) throw new Error('state-too-large');
  s.state = state;
  s.updatedAt = Date.now();
  broadcast(s, 'state', json);
  persist(s);
  return state;
}

export function broadcast(s: Session, event: string, data: string) {
  for (const send of s.subscribers) {
    try {
      send(event, data);
    } catch {
      s.subscribers.delete(send);
    }
  }
}

export function subscribe(s: Session, send: (event: string, data: string) => void) {
  s.subscribers.add(send);
  return () => s.subscribers.delete(send);
}

export function listenerCount(s: Session) {
  return s.subscribers.size;
}
