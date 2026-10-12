'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PresentationState } from './state.ts';

export type ConnStatus = 'connecting' | 'live' | 'reconnecting' | 'not-found' | 'offline';

const clientId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
export const CLIENT_ID = clientId;

/**
 * Subscribes to a session's server-sent events with automatic reconnection and clock-offset estimation.
 * `onState` receives every state the server broadcasts (including our own echoes; callers filter by origin).
 */
export function useSessionStream(code: string | null, role: 'presenter' | 'display', onState: (s: PresentationState, kind: 'hello' | 'state') => void) {
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [listeners, setListeners] = useState(0);
  const offsetRef = useRef(0);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const lastMessageAt = useRef(Date.now());

  useEffect(() => {
    if (!code) return;
    let es: EventSource | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let closed = false;

    const connect = async () => {
      if (closed) return;
      // Check the session exists first so a missing session is reported instead of looping.
      try {
        const t0 = Date.now();
        const res = await fetch(`/api/session/${code}`, { cache: 'no-store' });
        if (res.status === 404) {
          setStatus('not-found');
          scheduleRetry(5000);
          return;
        }
        const j = await res.json();
        const t1 = Date.now();
        offsetRef.current = j.serverTime - (t0 + t1) / 2;
      } catch {
        setStatus(navigator.onLine === false ? 'offline' : 'reconnecting');
        scheduleRetry();
        return;
      }
      es = new EventSource(`/api/session/${code}/stream?role=${role}`);
      es.addEventListener('hello', (ev) => {
        const j = JSON.parse((ev as MessageEvent).data);
        offsetRef.current = j.serverTime - Date.now();
        retry = 0;
        lastMessageAt.current = Date.now();
        setStatus('live');
        onStateRef.current(j.state, 'hello');
      });
      es.addEventListener('state', (ev) => {
        lastMessageAt.current = Date.now();
        onStateRef.current(JSON.parse((ev as MessageEvent).data), 'state');
      });
      es.addEventListener('presence', (ev) => {
        lastMessageAt.current = Date.now();
        setListeners(JSON.parse((ev as MessageEvent).data).listeners);
      });
      es.addEventListener('ping', () => {
        lastMessageAt.current = Date.now();
      });
      // Hosted (serverless) streams end on schedule; reconnect at once and stay "live".
      es.addEventListener('bye', () => {
        es?.close();
        es = null;
        scheduleRetry(0);
      });
      es.onerror = () => {
        es?.close();
        es = null;
        setStatus('reconnecting');
        scheduleRetry();
      };
    };
    const scheduleRetry = (ms?: number) => {
      clearTimeout(timer);
      const delay = ms ?? Math.min(8000, 500 * 2 ** retry++);
      timer = setTimeout(connect, delay);
    };
    connect();
    // The server pings every 10 s; if nothing arrives for 25 s the connection is silently dead (e.g. iPad sleep).
    watchdog = setInterval(() => {
      if (es && Date.now() - lastMessageAt.current > 25_000) {
        es.close();
        es = null;
        setStatus('reconnecting');
        scheduleRetry(200);
      }
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!es || es.readyState === EventSource.CLOSED)) scheduleRetry(50);
    };
    const onOnline = () => scheduleRetry(50);
    // Test hook: simulate a dropped connection (used by the reconnection end-to-end test).
    const onDebugDrop = () => {
      es?.close();
      es = null;
      setStatus('reconnecting');
      scheduleRetry(300);
    };
    window.addEventListener('atlas-debug-drop', onDebugDrop);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(watchdog);
      es?.close();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('atlas-debug-drop', onDebugDrop);
    };
  }, [code, role]);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);
  return { status, listeners, serverNow };
}

/**
 * Pushes presenter state to the server. Coalesces rapid updates (pan/zoom/drawing) to one request in
 * flight at a time, always sending the latest state; recovers the session if the server lost it.
 */
export function useStatePusher(code: string | null, token: string | null, onRecovered?: () => void) {
  const inFlight = useRef(false);
  const pending = useRef<PresentationState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flush = useCallback(async () => {
    if (!code || !token || inFlight.current || !pending.current) return;
    const state = pending.current;
    pending.current = null;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/session/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ state }),
        keepalive: false,
      });
      if (res.status === 404) {
        // Server restarted without its data: re-create the session from the presenter's copy.
        const rec = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, token, state }) });
        if (rec.ok) onRecovered?.();
        else setError('Session could not be recovered');
      } else if (res.status === 403) setError('This device is not the presenter for this session');
      else if (!res.ok) setError(`Sync error ${res.status}`);
      else setError(null);
    } catch {
      setError('Offline — changes will be sent when the connection returns');
      pending.current ??= state;
      setTimeout(() => {
        inFlight.current = false;
        flush();
      }, 1000);
      return;
    }
    inFlight.current = false;
    if (pending.current) flush();
  }, [code, token, onRecovered]);

  const push = useCallback(
    (s: PresentationState) => {
      pending.current = s;
      flush();
    },
    [flush],
  );
  return { push, error };
}
