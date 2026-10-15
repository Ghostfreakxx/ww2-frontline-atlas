'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './editor.css';
import type { Aspect, MediaItem, Project } from '@/lib/editor/types';
import { ASPECTS } from '@/lib/editor/types';
import { clipAt, deleteClip, fmtTime, makeAudio, makeClip, makeText, newProject, projectDuration, splitAt, uid, videoDuration } from '@/lib/editor/timeline';
import * as store from '@/lib/editor/store';
import { Player } from '@/lib/editor/player';
import { MediaBin } from './MediaBin';
import { PreviewPane } from './PreviewPane';
import { Timeline } from './Timeline';
import { Inspector } from './Inspector';
import { ExportDialog } from './ExportDialog';

export type Selection = { kind: 'clip' | 'text' | 'audio'; id: string } | null;
export type Update = (fn: (p: Project) => Project, opts?: { transient?: boolean }) => void;

const LAST_KEY = 'atlas.editor.lastProject';

/**
 * Undo/redo over whole-project snapshots. Transient updates (mid-drag, typing) replace the present
 * without a history entry; the next normal update records one entry for the whole gesture.
 * (No refs are touched inside state updaters: React may run updaters twice in development.)
 */
function useHistory(initial: () => Project) {
  type H = { past: Project[]; present: Project; future: Project[] };
  const [hist, setHist] = useState<H>(() => ({ past: [], present: initial(), future: [] }));
  const ref = useRef(hist);
  const gestureBase = useRef<Project | null>(null);
  const commit = useCallback((h: H) => {
    ref.current = h;
    setHist(h);
  }, []);
  const update: Update = useCallback((fn, opts) => {
    const h = ref.current;
    const next = fn(h.present);
    if (opts?.transient) {
      if (next === h.present) return;
      gestureBase.current ??= h.present;
      return commit({ ...h, present: { ...next, updatedAt: Date.now() } });
    }
    const base = gestureBase.current ?? h.present;
    gestureBase.current = null;
    const present = next === h.present ? next : { ...next, updatedAt: Date.now() };
    if (present === base) return; // nothing changed (e.g. a tap without a drag)
    commit({ past: [...h.past.slice(-80), base], present, future: [] });
  }, [commit]);
  const undo = useCallback(() => {
    const h = ref.current;
    if (!h.past.length) return;
    gestureBase.current = null;
    commit({ past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] });
  }, [commit]);
  const redo = useCallback(() => {
    const h = ref.current;
    if (!h.future.length) return;
    gestureBase.current = null;
    commit({ past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) });
  }, [commit]);
  const reset = useCallback((p: Project) => {
    gestureBase.current = null;
    commit({ past: [], present: p, future: [] });
  }, [commit]);
  return { project: hist.present, update, undo, redo, reset, canUndo: hist.past.length > 0, canRedo: hist.future.length > 0 };
}

export default function EditorApp() {
  const h = useHistory(() => newProject());
  const { project, update } = h;
  const [loaded, setLoaded] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [projects, setProjects] = useState<Project[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(60); // px per second
  const [showExport, setShowExport] = useState(false);
  const [panel, setPanel] = useState<'media' | 'edit'>('media');
  const [toast, setToast] = useState<string | null>(null);
  const playerRef = useRef<Player | null>(null);
  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const mediaMap = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);
  const duration = projectDuration(project);

  // ------------------------------------------------------------------ load media and the last project
  const urlsRef = useRef(urls);
  urlsRef.current = urls;
  const refreshMedia = useCallback(async () => {
    const list = await store.listMedia();
    const next = new Map<string, string>();
    for (const m of list) {
      const existing = urlsRef.current.get(m.id);
      if (existing) next.set(m.id, existing);
      else {
        const b = await store.getBlob(m.id);
        if (b) next.set(m.id, URL.createObjectURL(b));
      }
    }
    setMedia(list);
    setUrls(next);
    return list;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refreshMedia();
        const list = await store.listProjects();
        setProjects(list);
        let last: string | null = null;
        try {
          last = localStorage.getItem(LAST_KEY);
        } catch {
          /* storage blocked */
        }
        const p = list.find((x) => x.id === last) ?? list[0];
        if (p) h.reset(p);
      } catch (e) {
        flash(`Storage unavailable: ${(e as Error).message}`);
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave.
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      store.saveProject(project).then(() => store.listProjects().then(setProjects)).catch(() => flash('Could not autosave (storage full?)'));
      try {
        localStorage.setItem(LAST_KEY, project.id);
      } catch {
        /* storage blocked */
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [project, loaded, flash]);

  // ------------------------------------------------------------------ player
  useEffect(() => {
    playerRef.current?.setMedia(mediaMap, urls);
    playerRef.current?.seek(playerRef.current.t);
  }, [mediaMap, urls]);
  useEffect(() => {
    playerRef.current?.setProject(project);
  }, [project]);
  const seek = useCallback((time: number) => {
    const p = playerRef.current;
    if (!p) return setT(time);
    if (p.playing) p.pause();
    p.seek(Math.max(0, Math.min(time, Math.max(duration, 0))));
  }, [duration]);
  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.playing) p.pause();
    else p.play();
  }, []);

  // ------------------------------------------------------------------ actions
  const addMediaToTimeline = useCallback((m: MediaItem) => {
    if (m.kind === 'audio') {
      update((p) => ({ ...p, audio: [...p.audio, makeAudio(m, p.audio.length ? Math.min(t, videoDuration(p)) : 0)] }));
      flash(`Added music: ${m.name}`);
    } else {
      const clip = makeClip(m);
      update((p) => ({ ...p, clips: [...p.clips, clip] }));
      setSelection({ kind: 'clip', id: clip.id });
    }
  }, [update, t, flash]);

  const importFiles = useCallback(async (files: File[] | FileList) => {
    const list = Array.from(files);
    if (!list.length) return;
    flash(`Importing ${list.length} file${list.length > 1 ? 's' : ''}…`);
    const added: MediaItem[] = [];
    for (const f of list) {
      try {
        added.push(await store.importMedia(f, f.name));
      } catch (e) {
        flash((e as Error).message);
      }
    }
    await refreshMedia();
    // Convenience: on an empty project, put imported clips straight on the timeline.
    if (added.length && project.clips.length === 0) {
      const clips = added.filter((m) => m.kind !== 'audio').map(makeClip);
      const music = added.filter((m) => m.kind === 'audio').map((m) => makeAudio(m, 0));
      update((p) => ({ ...p, clips: [...p.clips, ...clips], audio: [...p.audio, ...music] }));
    }
    if (added.length) flash(`Imported ${added.length} file${added.length > 1 ? 's' : ''}`);
  }, [flash, refreshMedia, project.clips.length, update]);

  const removeMedia = useCallback(async (m: MediaItem) => {
    const used = project.clips.some((c) => c.mediaId === m.id) || project.audio.some((a) => a.mediaId === m.id) || projects.some((p) => p.id !== project.id && (p.clips.some((c) => c.mediaId === m.id) || p.audio.some((a) => a.mediaId === m.id)));
    if (used && !window.confirm(`"${m.name}" is used in a project. Delete it anyway? Clips that use it will go blank.`)) return;
    await store.deleteMedia(m.id);
    const u = urls.get(m.id);
    if (u) URL.revokeObjectURL(u);
    await refreshMedia();
  }, [project, projects, urls, refreshMedia]);

  const split = useCallback(() => {
    update((p) => splitAt(p, t));
  }, [update, t]);

  const addText = useCallback((style: Parameters<typeof makeText>[1] = 'caption') => {
    const item = makeText(Math.min(t, Math.max(0, duration - 0.5)), style);
    update((p) => ({ ...p, texts: [...p.texts, item] }));
    setSelection({ kind: 'text', id: item.id });
    setPanel('edit');
  }, [update, t, duration]);

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    if (selection.kind === 'clip') update((p) => deleteClip(p, selection.id));
    if (selection.kind === 'text') update((p) => ({ ...p, texts: p.texts.filter((x) => x.id !== selection.id) }));
    if (selection.kind === 'audio') update((p) => ({ ...p, audio: p.audio.filter((x) => x.id !== selection.id) }));
    setSelection(null);
  }, [selection, update]);

  const newProj = () => {
    const p = newProject(`Reel ${projects.length + 1}`);
    h.reset(p);
    setSelection(null);
    seek(0);
  };
  const openProj = (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (p) {
      h.reset(p);
      setSelection(null);
      seek(0);
    }
  };
  const deleteProj = async () => {
    if (!window.confirm(`Delete the project "${project.name}"? Media files stay in the library.`)) return;
    await store.deleteProject(project.id);
    const list = await store.listProjects();
    setProjects(list);
    h.reset(list[0] ?? newProject());
    setSelection(null);
  };
  const duplicateProj = () => {
    const p = { ...project, id: uid('p'), name: `${project.name} (copy)`, updatedAt: Date.now() };
    h.reset(p);
    flash('Duplicated');
  };

  // ------------------------------------------------------------------ keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 's' || e.key === 'S') split();
      else if (e.key === 't' || e.key === 'T') addText();
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
      } else if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 1 / project.fps;
        seek(t + (e.key === 'ArrowLeft' ? -step : step));
      } else if (e.key === 'Home') seek(0);
      else if (e.key === 'End') seek(duration);
      else if (e.key === 'Escape') setSelection(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onTime = useCallback((time: number, isPlaying: boolean) => {
    setT(time);
    setPlaying(isPlaying);
  }, []);

  const hit = clipAt(project, t);

  return (
    <div className="ed" onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
    }}>
      <header className="ed-top">
        <a className="btn ghost" href="/" aria-label="Back to Frontline Atlas">Atlas</a>
        <input className="ed-name" aria-label="Project name" value={project.name} onChange={(e) => update((p) => ({ ...p, name: e.target.value }), { transient: true })} onBlur={() => update((p) => p)} />
        <select aria-label="Open project" value={project.id} onChange={(e) => (e.target.value === '__new' ? newProj() : openProj(e.target.value))}>
          {!projects.some((p) => p.id === project.id) && <option value={project.id}>{project.name}</option>}
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="__new">+ New project</option>
        </select>
        <select aria-label="Format" value={project.aspect} onChange={(e) => update((p) => ({ ...p, aspect: e.target.value as Aspect }))}>
          {(Object.keys(ASPECTS) as Aspect[]).map((a) => <option key={a} value={a}>{ASPECTS[a].label}</option>)}
        </select>
        <div className="ed-top-actions">
          <button className="btn icon" onClick={h.undo} disabled={!h.canUndo} aria-label="Undo" title="Undo (⌘Z)">↶</button>
          <button className="btn icon" onClick={h.redo} disabled={!h.canRedo} aria-label="Redo" title="Redo (⇧⌘Z)">↷</button>
          <details className="ed-menu">
            <summary className="btn" aria-label="Project menu">⋯</summary>
            <div className="ed-menu-list">
              <button className="btn ghost" onClick={newProj}>New project</button>
              <button className="btn ghost" onClick={duplicateProj}>Duplicate project</button>
              <button className="btn ghost" onClick={deleteProj}>Delete project</button>
            </div>
          </details>
          <button className="btn primary" onClick={() => setShowExport(true)} disabled={duration <= 0}>Export</button>
        </div>
      </header>

      <div className="ed-tabs" role="tablist">
        <button role="tab" aria-selected={panel === 'media'} onClick={() => setPanel('media')}>Media</button>
        <button role="tab" aria-selected={panel === 'edit'} onClick={() => setPanel('edit')}>Edit</button>
      </div>

      <aside className={`ed-bin ${panel === 'media' ? 'show' : ''}`} aria-label="Media library">
        <MediaBin media={media} onImport={importFiles} onAdd={addMediaToTimeline} onRemove={removeMedia} />
      </aside>

      <main className="ed-preview">
        <PreviewPane
          project={project}
          media={mediaMap}
          urls={urls}
          playerRef={playerRef}
          onTime={onTime}
          selection={selection}
          setSelection={(s) => {
            setSelection(s);
            if (s) setPanel('edit');
          }}
          update={update}
        />
        <div className="ed-transport">
          <button className="btn icon big" onClick={() => seek(0)} aria-label="Go to start">⏮</button>
          <button className="btn icon big primary" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
          <span className="ed-time" aria-live="off">{fmtTime(t)} / {fmtTime(duration)}</span>
          <button className="btn" onClick={split} disabled={!hit} title="Split the clip at the playhead (S)">Split</button>
          <button className="btn" onClick={() => addText('caption')} title="Add text at the playhead (T)">+ Text</button>
        </div>
      </main>

      <aside className={`ed-insp ${panel === 'edit' ? 'show' : ''}`} aria-label="Inspector">
        <Inspector project={project} media={mediaMap} selection={selection} setSelection={setSelection} update={update} t={t} seek={seek} onSplit={split} onDelete={deleteSelection} onAddText={addText} flash={flash} />
      </aside>

      <section className="ed-timeline" aria-label="Timeline">
        <Timeline project={project} media={mediaMap} t={t} duration={duration} zoom={zoom} setZoom={setZoom} seek={seek} selection={selection} setSelection={(s) => {
          setSelection(s);
          if (s) setPanel('edit');
        }} update={update} />
      </section>

      {showExport && <ExportDialog project={project} media={mediaMap} onClose={() => setShowExport(false)} pausePreview={() => playerRef.current?.pause()} />}
      {!loaded && <div className="ed-loading">Loading…</div>}
      {toast && <div className="ed-toast" role="status">{toast}</div>}
    </div>
  );
}
