'use client';
import { useEffect } from 'react';

/** Registers the service worker (production builds only; `?nosw` skips it, e.g. for debugging). */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    if (new URLSearchParams(window.location.search).has('nosw')) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* not available (e.g. plain HTTP on a LAN address) — the app works without it */
    });
  }, []);
  return null;
}
