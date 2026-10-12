'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CLIENT_ID, useSessionStream, useStatePusher } from '@/lib/sync/client';
import { initialState, SESSION_CODE_RE, type PresentationState } from '@/lib/sync/state';

const LS_LAST = 'atlas.lastSession';
const tokenKey = (code: string) => `atlas.token.${code}`;
const backupKey = (code: string) => `atlas.backup.${code}`;

function readLS(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked — sync still works */
  }
}

/**
 * Presenter session: resolves (or creates) the session code + presenter token, keeps a local backup of
 * the state, adopts the server's state after a reload (session recovery) and pushes every change.
 */
export function usePresenterSession() {
  const [code, setCode] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<PresentationState>(() => initialState());
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [recoveredAt, setRecoveredAt] = useState<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const adopted = useRef(false);

  // Resolve code/token from the URL (?code=…#k=token), then localStorage, else create a new session.
  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      let c = (url.searchParams.get('code') || '').toUpperCase();
      const hashToken = new URLSearchParams(url.hash.slice(1)).get('k');
      if (c && hashToken) writeLS(tokenKey(c), hashToken);
      if (!c) {
        const last = readLS(LS_LAST);
        if (last && SESSION_CODE_RE.test(last) && readLS(tokenKey(last))) c = last;
      }
      let t = c ? readLS(tokenKey(c)) : null;
      if (!c || !t) {
        if (c && !t) {
          setBootError(`This device does not hold the presenter key for session ${c}. Open the presenter link (with its key) or start a new session.`);
          setCode(c);
          return;
        }
        const res = await fetch('/api/session', { method: 'POST' });
        if (!res.ok) {
          setBootError('Could not create a session — is the server running?');
          return;
        }
        const j = await res.json();
        c = j.code;
        t = j.token;
        writeLS(tokenKey(c), t!);
      }
      writeLS(LS_LAST, c);
      url.searchParams.set('code', c);
      url.hash = '';
      window.history.replaceState(null, '', url.toString());
      setCode(c);
      setToken(t);
    })().catch((e) => setBootError(String(e)));
  }, []);

  const onState = useCallback((s: PresentationState, kind: 'hello' | 'state') => {
    if (kind === 'hello' && !adopted.current) {
      // Session recovery: continue exactly where the session was (after reload or iPad sleep).
      adopted.current = true;
      setState({ ...initialState(), ...s, draft: null });
      setReady(true);
      return;
    }
    // Another presenter device changed the state.
    if (s.origin && s.origin !== CLIENT_ID && s.rev > stateRef.current.rev) setState(s);
    else if (s.origin === CLIENT_ID && s.rev > stateRef.current.rev) stateRef.current = { ...stateRef.current, rev: s.rev };
  }, []);

  const stream = useSessionStream(token ? code : null, 'presenter', onState);
  const { push, error: pushError } = useStatePusher(code, token, () => setRecoveredAt(Date.now()));

  // If the server lost the session, restore from this device's backup.
  useEffect(() => {
    if (stream.status !== 'not-found' || !code || !token) return;
    const backup = readLS(backupKey(code));
    const restored = backup ? (JSON.parse(backup) as PresentationState) : stateRef.current;
    fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, token, state: restored }) }).then((r) => {
      if (r.ok) setRecoveredAt(Date.now());
    });
  }, [stream.status, code, token]);

  const backupTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commit = useCallback(
    (update: (s: PresentationState) => PresentationState) => {
      const next = { ...update(stateRef.current), origin: CLIENT_ID };
      stateRef.current = next;
      setState(next);
      push(next);
      clearTimeout(backupTimer.current);
      backupTimer.current = setTimeout(() => code && writeLS(backupKey(code), JSON.stringify({ ...next, draft: null })), 400);
    },
    [push, code],
  );

  return { code, token, state, commit, ready: ready || stream.status === 'live', bootError, stream, pushError, recoveredAt };
}
