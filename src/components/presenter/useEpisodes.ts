'use client';
import { useCallback, useEffect, useState } from 'react';
import { builtInEpisodes } from '@/lib/conflict';
import type { Episode } from '@/lib/episodes/types';
import { validateEpisode } from '@/lib/episodes/validate';

// Episode library: built-in episodes plus the presenter's own edits, autosaved to this device.
// Only scene data (dates, camera, notes, sources) is stored — nothing sensitive.

const LS_KEY = 'atlas.episodes.v1';

function load(): Record<string, Episode> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, Episode> = {};
    for (const [id, ep] of Object.entries(parsed)) {
      try {
        out[id] = validateEpisode(ep);
      } catch {
        /* skip corrupt entries */
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function useEpisodes() {
  const [local, setLocal] = useState<Record<string, Episode>>({});
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setLocal(load());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(local));
        setSavedAt(Date.now());
      } catch {
        /* quota */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [local, loaded]);

  const all: Episode[] = [...builtInEpisodes.filter((b) => !local[b.id]), ...Object.values(local)].sort((a, b) => a.title.localeCompare(b.title));
  const get = useCallback((id: string | null) => (id ? local[id] ?? builtInEpisodes.find((b) => b.id === id) ?? null : null), [local]);
  const save = useCallback((ep: Episode) => setLocal((m) => ({ ...m, [ep.id]: { ...ep, updatedAt: new Date().toISOString() } })), []);
  const remove = useCallback((id: string) => setLocal((m) => {
    const next = { ...m };
    delete next[id];
    return next;
  }), []);
  const isBuiltIn = (id: string) => builtInEpisodes.some((b) => b.id === id);
  const isModified = (id: string) => isBuiltIn(id) && !!local[id];
  return { episodes: all, get, save, remove, isBuiltIn, isModified, savedAt, loaded };
}

export function exportEpisode(ep: Episode) {
  const blob = new Blob([JSON.stringify(ep, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${ep.id}.episode.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function importEpisodeFile(file: File): Promise<Episode> {
  const text = await file.text();
  return validateEpisode(JSON.parse(text));
}
