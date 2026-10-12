'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './presenter.css';
import { idx } from '@/lib/conflict';
import { addDays, formatDate } from '@/lib/history/query';
import type { Camera, ISODate } from '@/lib/history/types';
import { useGeo } from '@/lib/map/geodata';
import { useFontsReady } from '@/lib/map/useStage';
import { ANNOTATION_COLORS, LAYOUTS, effectiveDate, type Annotation, type PresentationState } from '@/lib/sync/state';
import { sceneState, stepPosition } from '@/lib/episodes/apply';
import type { Episode } from '@/lib/episodes/types';
import { useStageView } from '@/components/display/useStageView';
import { DisplayStage } from '@/components/display/DisplayStage';
import { usePresenterSession } from './usePresenterSession';
import { useEpisodes } from './useEpisodes';
import { MapStageInteractive, type Tool } from './MapStageInteractive';
import { Transport } from './Transport';
import { ForcesPanel } from './ForcesPanel';
import { BattlesPanel, LayersPanel, ScenePanel, SourcesPanel } from './SidePanels';
import { EditorPanel } from './EditorPanel';
import { SharePanel } from './SharePanel';
import { Icon } from './icons';

const COLOR_NAMES = ['Red', 'Navy', 'Ochre', 'Green', 'Black', 'White'];

type Tab = 'scene' | 'forces' | 'battles' | 'layers' | 'sources' | 'edit';
const TABS: { id: Tab; label: string; icon: keyof typeof Icon }[] = [
  { id: 'scene', label: 'Scene', icon: 'film' },
  { id: 'forces', label: 'Forces', icon: 'flag' },
  { id: 'battles', label: 'Battles', icon: 'swords' },
  { id: 'layers', label: 'Layers', icon: 'layers' },
  { id: 'sources', label: 'Sources', icon: 'book' },
  { id: 'edit', label: 'Episode', icon: 'edit' },
];

export default function PresenterApp() {
  const session = usePresenterSession();
  const { state, commit, code, token, stream } = session;
  const { geo, error: geoError } = useGeo(idx.pkg.territorySnapshots);
  useFontsReady();
  const library = useEpisodes();
  const view = useStageView(state, stream.serverNow);

  const [tab, setTab] = useState<Tab>('scene');
  const [tool, setTool] = useState<Tool>('pan');
  const [color, setColor] = useState(ANNOTATION_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [locked, setLocked] = useState(false);
  const [selectedFormation, setSelectedFormation] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [preview, setPreview] = useState(false);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const episode: Episode | null = library.get(state.episodeId);
  const date = view.date;

  // First run: open the Barbarossa demonstration episode.
  const booted = useRef(false);
  useEffect(() => {
    if (!session.ready || !library.loaded || booted.current) return;
    booted.current = true;
    if (!state.episodeId) {
      const ep = library.get('barbarossa-1941');
      if (ep) commit((s) => sceneState(s, ep, 0, 0, stream.serverNow()));
    }
  }, [session.ready, library.loaded, state.episodeId, commit, library, stream]);

  // Stop playback at its end date.
  useEffect(() => {
    if (!state.playback.playing) return;
    const end = state.playback.endDate ?? idx.pkg.range.end;
    if (date >= end) commit((s) => ({ ...s, date: end, playback: { ...s.playback, playing: false, endDate: null } }));
  }, [date, state.playback.playing, state.playback.endDate, commit]);

  // ---------------------------------------------------------------- actions
  const goto = useCallback(
    (scene: number, step: number) => {
      if (!episode) return;
      commit((s) => sceneState(s, episode, scene, step, stream.serverNow()));
    },
    [episode, commit, stream],
  );
  const nextPos = episode ? stepPosition(episode, state.sceneIndex, state.stepIndex, 1) : null;
  const prevPos = episode ? stepPosition(episode, state.sceneIndex, state.stepIndex, -1) : null;
  const next = useCallback(() => nextPos && goto(nextPos.sceneIndex, nextPos.stepIndex), [nextPos, goto]);
  const prev = useCallback(() => prevPos && goto(prevPos.sceneIndex, prevPos.stepIndex), [prevPos, goto]);

  const pauseAt = (s: PresentationState): PresentationState => ({ ...s, date: effectiveDate(s, stream.serverNow(), addDays), playback: { ...s.playback, playing: false, endDate: null } });
  const togglePlay = useCallback(() => {
    commit((s) => {
      if (s.playback.playing) return pauseAt(s);
      const start = s.date >= idx.pkg.range.end ? idx.pkg.range.start : s.date;
      return { ...s, date: start, playback: { ...s.playback, playing: true, anchorDate: start, anchorAt: stream.serverNow(), endDate: null } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, stream]);

  const setSpeed = (speed: number) =>
    commit((s) => {
      if (!s.playback.playing) return { ...s, playback: { ...s.playback, speed } };
      const cur = effectiveDate(s, stream.serverNow(), addDays);
      return { ...s, date: cur, playback: { ...s.playback, speed, anchorDate: cur, anchorAt: stream.serverNow() } };
    });

  const lastDateSend = useRef(0);
  const setDate = (d: ISODate, final: boolean) => {
    const t = performance.now();
    if (!final && t - lastDateSend.current < 60) return;
    lastDateSend.current = t;
    commit((s) => ({ ...s, date: d, playback: { ...s.playback, playing: false, endDate: null } }));
  };

  const jumpEvent = (dir: 1 | -1) => {
    const ev = dir === 1 ? idx.nextEvent(date) : idx.prevEvent(date);
    if (!ev) return;
    commit((s) => {
      let n: PresentationState = { ...s, date: ev.date, playback: { ...s.playback, playing: false, endDate: null }, focus: { ...s.focus, cities: ev.placeId ? [ev.placeId] : [] } };
      if (ev.camera) n = { ...n, camera: { ...ev.camera, ms: 1600, seq: s.camera.seq + 1 } };
      return n;
    });
    flash(`${formatDate(ev.date, 'short')} — ${ev.title}`);
  };

  const onCamera = useCallback((c: Camera, _final: boolean) => commit((s) => ({ ...s, camera: { ...c, ms: 0, seq: s.camera.seq + 1 } })), [commit]);
  const flyTo = useCallback((lon: number, lat: number, zoom: number) => commit((s) => ({ ...s, camera: { lon, lat, zoom, ms: 1600, seq: s.camera.seq + 1 } })), [commit]);
  const resetView = () => {
    const scene = episode?.scenes[state.sceneIndex];
    const c = scene?.base.camera ?? idx.pkg.defaultCamera;
    flyTo(c.lon, c.lat, c.zoom);
  };
  const zoomBy = (f: number) => commit((s) => ({ ...s, camera: { ...s.camera, zoom: Math.max(0.6, Math.min(40, s.camera.zoom * f)), ms: 350, seq: s.camera.seq + 1 } }));

  const setAnnotations = (fn: (a: Annotation[]) => Annotation[]) =>
    commit((s) => {
      setUndoStack((u) => [...u.slice(-49), s.annotations]);
      setRedoStack([]);
      return { ...s, annotations: fn(s.annotations), draft: null };
    });
  const undo = () => {
    if (!undoStack.length) return;
    const prevA = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    commit((s) => {
      setRedoStack((r) => [...r, s.annotations]);
      return { ...s, annotations: prevA };
    });
  };
  const redo = () => {
    if (!redoStack.length) return;
    const nextA = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    commit((s) => {
      setUndoStack((u) => [...u, s.annotations]);
      return { ...s, annotations: nextA };
    });
  };
  const lastDraft = useRef(0);
  const onDraft = useCallback((a: Annotation | null) => {
    const t = performance.now();
    if (a && t - lastDraft.current < 45) return;
    lastDraft.current = t;
    commit((s) => ({ ...s, draft: a }));
  }, [commit]);

  const onTapFeature = (hit: { kind: 'formation' | 'battle'; id: string } | null) => {
    if (!hit || locked) return;
    if (hit.kind === 'formation') {
      commit((s) => ({ ...s, focus: { ...s.focus, formations: s.focus.formations[0] === hit.id && s.focus.formations.length === 1 ? [] : [hit.id], dimOthers: true }, panels: { ...s.panels, compare: false } }));
      setSelectedFormation(hit.id);
      setTab('forces');
    } else {
      commit((s) => ({ ...s, focus: { ...s.focus, battleId: s.focus.battleId === hit.id ? null : hit.id } }));
      setTab('battles');
    }
  };

  const saveToServer = async (ep: Episode) => {
    if (!code || !token) return 'Not connected';
    const res = await fetch(`/api/episodes/${ep.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-session-code': code }, body: JSON.stringify(ep) });
    return res.ok ? 'Saved to the presenting computer (.data/episodes)' : `Save failed (${res.status})`;
  };

  // Keyboard and presentation-clicker shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'h' || e.key === 'H') commit((s) => ({ ...s, hideUi: !s.hideUi }));
      else if (e.key === 'l' || e.key === 'L') setLocked((v) => !v);
      else if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (e.key === 'Escape') setTool('pan');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Long-press to unlock.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [holding, setHolding] = useState(false);
  const lockProps = locked
    ? {
        onPointerDown: () => { setHolding(true); holdTimer.current = setTimeout(() => { setLocked(false); setHolding(false); flash('Unlocked'); }, 900); },
        onPointerUp: () => { clearTimeout(holdTimer.current); setHolding(false); },
        onPointerLeave: () => { clearTimeout(holdTimer.current); setHolding(false); },
        onClick: () => !holding && flash('Hold to unlock'),
      }
    : { onClick: () => { setLocked(true); setTool('pan'); flash('Presentation locked — hold the lock to unlock'); } };

  const scene = episode?.scenes[state.sceneIndex];
  const nextLabel = useMemo(() => {
    if (!episode || !nextPos) return 'End';
    if (nextPos.sceneIndex !== state.sceneIndex) return `Scene ${nextPos.sceneIndex + 1}: ${episode.scenes[nextPos.sceneIndex].title}`;
    return scene?.steps[nextPos.stepIndex - 1]?.label ?? 'Next';
  }, [episode, nextPos, state.sceneIndex, scene]);
  const operation = state.focus.operationId ? idx.pkg.operations.find((o) => o.id === state.focus.operationId) : idx.operationsAt(date).find((o) => o.major) ?? idx.operationsAt(date)[0];

  const statusText = stream.status === 'live' ? 'Live' : stream.status === 'not-found' ? 'Session lost — recovering' : stream.status === 'offline' ? 'Offline' : 'Reconnecting…';

  if (session.bootError) {
    return (
      <main className="page" style={{ maxWidth: 640, paddingTop: '14vh' }}>
        <h1>Presenter</h1>
        <p className="lede">{session.bootError}</p>
        <button className="btn primary big" onClick={() => { window.location.href = '/presenter?new=1'; localStorage.removeItem('atlas.lastSession'); }}>Start a new session</button>
      </main>
    );
  }

  return (
    <div className={`pres ${locked ? 'is-locked' : ''}`}>
      <header className="pres-top">
        <button className={`conn ${stream.status}`} onClick={() => setShowShare(true)} aria-label={`Connection ${statusText}. Session ${code}. Show display link.`}>
          <span className="dot" />
          <span className="conn-text">{statusText}</span>
          <span className="conn-code">{code ?? '······'}</span>
          <span className="conn-count">{Math.max(0, stream.listeners - 1)} display{stream.listeners - 1 === 1 ? '' : 's'}</span>
        </button>
        <div className="top-title">
          <div className="top-episode">{episode?.title ?? 'No episode'}</div>
          <div className="top-scene">{scene ? `Scene ${state.sceneIndex + 1}/${episode!.scenes.length} · ${scene.title}${state.stepIndex ? ` · step ${state.stepIndex}/${scene.steps.length}` : ''}` : formatDate(date)}</div>
        </div>
        <div className="top-actions">
          <div className="seg" role="group" aria-label="Output layout">
            {(['split-right', 'full', 'map-safe'] as const).map((l) => (
              <button key={l} aria-pressed={state.layout === l} disabled={locked} onClick={() => commit((s) => ({ ...s, layout: l }))}>{l === 'split-right' ? 'Split' : l === 'full' ? 'Full' : 'Safe'}</button>
            ))}
          </div>
          <button className={`btn ${state.hideUi ? 'on' : ''}`} onClick={() => commit((s) => ({ ...s, hideUi: !s.hideUi }))} title="Hide all audience panels (H)" aria-label={state.hideUi ? 'Panels hidden — show audience panels' : 'Hide UI — hide all audience panels'} aria-pressed={state.hideUi}>
            {state.hideUi ? <Icon.eyeOff /> : <Icon.eye />}<span className="hide-sm">{state.hideUi ? 'Panels hidden' : 'Hide UI'}</span>
          </button>
          <button className={`btn ${preview ? 'on' : ''}`} onClick={() => setPreview((v) => !v)} title="Preview the audience output" aria-label="Preview the audience output" aria-pressed={preview}><Icon.monitor /><span className="hide-sm">Preview</span></button>
          <button className="btn icon" onClick={() => setShowShare(true)} aria-label="Display link and QR code"><Icon.share /></button>
          <button className="btn icon" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => flash('Fullscreen: use Share → Add to Home Screen on iPad')))} aria-label="Fullscreen"><Icon.expand /></button>
          <button className={`btn lock-btn ${locked ? 'on' : ''} ${holding ? 'holding' : ''}`} {...lockProps} aria-label={locked ? 'Locked. Hold to unlock' : 'Lock presentation'}>
            {locked ? <Icon.lock /> : <Icon.unlock />}<span className="hide-sm">{locked ? 'Hold to unlock' : 'Lock'}</span>
          </button>
        </div>
      </header>

      <aside className="pres-tools" aria-label="Map tools">
        {([['pan', 'hand', 'Pan & zoom'], ['freehand', 'pen', 'Freehand'], ['arrow', 'arrow', 'Arrow'], ['circle', 'circle', 'Circle'], ['text', 'text', 'Label']] as const).map(([t, ic, label]) => {
          const C = Icon[ic];
          return (
            <button key={t} className={`btn big icon ${tool === t ? 'on' : ''}`} disabled={locked} onClick={() => setTool(t)} aria-pressed={tool === t} title={label} aria-label={label}>
              <C />
            </button>
          );
        })}
        <div className="tool-sep" />
        <div className="swatches" role="radiogroup" aria-label="Drawing colour">
          {ANNOTATION_COLORS.map((c, i) => (
            <button key={c} role="radio" aria-checked={color === c} className={`swatch-btn ${color === c ? 'on' : ''}`} style={{ background: c }} disabled={locked} onClick={() => setColor(c)} aria-label={`${COLOR_NAMES[i]} ink`} title={`${COLOR_NAMES[i]} ink`} />
          ))}
        </div>
        <div className="seg vertical" role="group" aria-label="Line width">
          {([[3, 'Thin line'], [5, 'Medium line'], [8, 'Thick line']] as const).map(([w, label]) => (
            <button key={w} aria-pressed={strokeWidth === w} disabled={locked} onClick={() => setStrokeWidth(w)} aria-label={label} title={label}>
              <span style={{ display: 'inline-block', width: 18, height: w, background: 'currentColor', borderRadius: 4 }} />
            </button>
          ))}
        </div>
        <div className="tool-sep" />
        <button className="btn big icon" onClick={undo} disabled={locked || !undoStack.length} aria-label="Undo" title="Undo"><Icon.undo /></button>
        <button className="btn big icon" onClick={redo} disabled={locked || !redoStack.length} aria-label="Redo" title="Redo"><Icon.redo /></button>
        <button className="btn big icon" onClick={() => setAnnotations(() => [])} disabled={locked || !state.annotations.length} aria-label="Clear drawings" title="Clear drawings"><Icon.trash /></button>
        <div className="tool-sep" />
        <button className="btn big icon" onClick={() => zoomBy(1.5)} disabled={locked} aria-label="Zoom in"><Icon.plus /></button>
        <button className="btn big icon" onClick={() => zoomBy(1 / 1.5)} disabled={locked} aria-label="Zoom out"><Icon.minus /></button>
        <button className="btn big icon" onClick={resetView} disabled={locked} aria-label="Reset view" title="Reset view"><Icon.reset /></button>
      </aside>

      <main className="pres-stage">
        {geo ? (
          <MapStageInteractive
            geo={geo}
            state={state}
            date={date}
            now={view.now}
            arrowBorn={view.arrowBorn}
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            locked={locked}
            onCamera={onCamera}
            onDraft={onDraft}
            onAnnotation={(a) => setAnnotations((list) => [...list, a])}
            onTapFeature={onTapFeature}
          />
        ) : (
          <div className="loading">{geoError ? `Map data failed to load: ${geoError}` : 'Loading map…'}</div>
        )}
        {preview && geo && (
          <div className="preview-pip" aria-label="Audience output preview">
            <DisplayStage idx={idx} geo={geo} state={state} date={date} camera={view.camera} now={view.now} arrowBorn={view.arrowBorn} width={360} idPrefix="pip" />
          </div>
        )}
        {toast && <div className="toast" role="status">{toast}</div>}
        {session.pushError && <div className="toast warn" role="alert">{session.pushError}</div>}
      </main>

      <section className="pres-side" aria-label="Presenter panels">
        <nav className="side-tabs" role="tablist">
          {TABS.map((t) => {
            const C = Icon[t.icon];
            return (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                <C width={18} height={18} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="side-body">
          {tab === 'scene' && <ScenePanel episode={episode} state={state} onGoto={goto} locked={locked} />}
          {tab === 'forces' && <ForcesPanel state={state} date={date} selected={selectedFormation} onSelect={setSelectedFormation} locked={locked} commit={commit} flyTo={flyTo} />}
          {tab === 'battles' && <BattlesPanel date={date} state={state} commit={commit} locked={locked} flyTo={flyTo} />}
          {tab === 'layers' && <LayersPanel state={state} commit={commit} locked={locked} />}
          {tab === 'sources' && <SourcesPanel state={state} date={date} />}
          {tab === 'edit' && (
            <EditorPanel
              library={library}
              episode={episode}
              state={state}
              locked={locked}
              onLoadEpisode={(id, given) => {
                const ep = given ?? library.get(id);
                if (ep) commit((s) => sceneState({ ...s, sceneId: null }, ep, 0, 0, stream.serverNow()));
              }}
              onGoto={goto}
              saveToServer={saveToServer}
            />
          )}
        </div>
      </section>

      <footer className="pres-bottom">
        <Transport
          date={date}
          playing={state.playback.playing}
          speed={state.playback.speed}
          locked={locked}
          stepLabel={nextLabel}
          canPrev={!!prevPos}
          canNext={!!nextPos}
          operationRange={operation ? { start: operation.start, end: operation.end } : null}
          onPlay={togglePlay}
          onSpeed={setSpeed}
          onDate={setDate}
          onPrevStep={prev}
          onNextStep={next}
          onPrevEvent={() => jumpEvent(-1)}
          onNextEvent={() => jumpEvent(1)}
        />
      </footer>
      {showShare && code && <SharePanel code={code} token={token} listeners={stream.listeners} onClose={() => setShowShare(false)} />}
      <div className="sr-only" aria-live="polite">{formatDate(date)} {LAYOUTS[state.layout].label}</div>
    </div>
  );
}
