'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { idx } from '@/lib/conflict';
import { useGeo } from '@/lib/map/geodata';
import { useFontsReady } from '@/lib/map/useStage';
import { useSessionStream } from '@/lib/sync/client';
import { initialState, LAYOUTS, SESSION_CODE_RE, STAGE, type Layout, type PresentationState } from '@/lib/sync/state';
import { DisplayStage } from '@/components/display/DisplayStage';
import { useStageView } from '@/components/display/useStageView';
import { downloadBlob, recordTab, stageToPngBlob } from '@/lib/export/png';
import { formatDate } from '@/lib/history/query';

export default function DisplayClient() {
  const params = useSearchParams();
  const code = (params.get('code') || '').toUpperCase();
  const valid = SESSION_CODE_RE.test(code);
  const transparent = params.get('transparent') === '1';
  const clean = params.get('clean') === '1';
  const quiet = params.get('quiet') === '1';
  const forcedLayout = params.get('layout') as Layout | null;
  const fixedScale = params.get('scale') === '1';
  const [guides, setGuides] = useState(params.get('guides') === '1');

  useEffect(() => {
    document.documentElement.classList.toggle('transparent', transparent);
  }, [transparent]);

  if (!valid) return <JoinForm initial={code} />;
  return <LiveDisplay code={code} transparent={transparent} clean={clean} quiet={quiet} forcedLayout={forcedLayout && forcedLayout in LAYOUTS ? forcedLayout : null} fixedScale={fixedScale} guides={guides} setGuides={setGuides} />;
}

function JoinForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <main className="page" style={{ maxWidth: 560, paddingTop: '18vh' }}>
      <h1>Audience display</h1>
      <p className="lede">Enter the six-character session code shown on the presenter iPad.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = value.trim().toUpperCase();
          if (SESSION_CODE_RE.test(v)) window.location.search = `?code=${v}`;
        }}
        style={{ display: 'flex', gap: 12, marginTop: 24 }}
      >
        <label className="sr-only" htmlFor="code">Session code</label>
        <input id="code" type="text" autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={6} value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} style={{ fontSize: 28, letterSpacing: '0.2em', textAlign: 'center' }} />
        <button className="btn primary big" type="submit">Join</button>
      </form>
    </main>
  );
}

function LiveDisplay(props: { code: string; transparent: boolean; clean: boolean; quiet: boolean; forcedLayout: Layout | null; fixedScale: boolean; guides: boolean; setGuides: (v: boolean) => void }) {
  const { code, transparent, clean, quiet, forcedLayout, fixedScale, guides, setGuides } = props;
  const [state, setState] = useState<PresentationState>(() => initialState());
  const [hasState, setHasState] = useState(false);
  const onState = useCallback((s: PresentationState) => {
    setState((prev) => (s.rev >= prev.rev || s.rev <= 1 ? s : prev));
    setHasState(true);
  }, []);
  const { status, serverNow } = useSessionStream(code, 'display', onState);
  const { geo, error } = useGeo(idx.pkg.territorySnapshots);
  useFontsReady();
  const effective = forcedLayout ? { ...state, layout: forcedLayout } : state;
  const view = useStageView(effective, serverNow);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 1920, h: 1080 });
  const [toolbar, setToolbar] = useState(false);
  const [recording, setRecording] = useState<null | (() => void)>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (clean) return;
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      setToolbar(true);
      clearTimeout(timer);
      timer = setTimeout(() => setToolbar(false), 2500);
    };
    window.addEventListener('mousemove', show);
    window.addEventListener('touchstart', show);
    return () => {
      window.removeEventListener('mousemove', show);
      window.removeEventListener('touchstart', show);
      clearTimeout(timer);
    };
  }, [clean]);

  const screenshot = useCallback(async () => {
    if (!svgRef.current) return;
    try {
      const blob = await stageToPngBlob(svgRef.current, 1920, 1080, transparent ? null : '#000');
      downloadBlob(blob, `atlas-${view.date}-${state.sceneId ?? 'map'}.png`);
      setNotice('Screenshot saved (1920×1080 PNG)');
    } catch (e) {
      setNotice(`Screenshot failed: ${(e as Error).message}`);
    }
    setTimeout(() => setNotice(null), 2500);
  }, [transparent, view.date, state.sceneId]);

  const toggleRecord = useCallback(async () => {
    if (recording) {
      recording();
      setRecording(null);
      return;
    }
    try {
      const stop = await recordTab((blob) => downloadBlob(blob, `atlas-recording-${Date.now()}.webm`));
      setRecording(() => stop);
    } catch {
      setNotice('Recording was cancelled or is not supported in this browser');
      setTimeout(() => setNotice(null), 3000);
    }
  }, [recording]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') screenshot();
      if (e.key === 'f' || e.key === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
      if (e.key === 'g' || e.key === 'G') setGuides(!guides);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screenshot, guides, setGuides]);

  const scale = fixedScale ? 1 : Math.min(size.w / STAGE.w, size.h / STAGE.h);
  const disconnected = status !== 'live';

  return (
    <div className="display-root" data-status={status} data-rev={state.rev} data-date={view.date}>
      {geo && hasState ? (
        <div style={{ width: STAGE.w * scale, height: STAGE.h * scale }}>
          <DisplayStage ref={svgRef} idx={idx} geo={geo} state={effective} date={view.date} camera={view.camera} now={view.now} arrowBorn={view.arrowBorn} transparent={transparent} guides={guides} width={STAGE.w * scale} idPrefix="display" />
        </div>
      ) : (
        <div style={{ color: transparent ? 'transparent' : 'var(--text-2)', fontSize: 20, textAlign: 'center' }}>
          {error ? `Could not load map data: ${error}` : status === 'not-found' ? `Session ${code} not found — start it on the presenter.` : `Connecting to session ${code}…`}
        </div>
      )}
      {disconnected && hasState && !quiet && <div className="conn-pill" role="status">{status === 'not-found' ? 'Session not found' : 'Reconnecting…'}</div>}
      {!clean && (
        <div className={`display-toolbar ${toolbar ? '' : 'hidden'}`}>
          <span style={{ alignSelf: 'center', color: 'var(--text-2)', padding: '0 8px', fontSize: 14 }}>
            {code} · {formatDate(view.date, 'short')} · {LAYOUTS[effective.layout].label}
          </span>
          <button className="btn" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}>Fullscreen</button>
          <button className="btn" onClick={screenshot}>Screenshot</button>
          <button className={`btn ${recording ? 'on' : ''}`} onClick={toggleRecord}>{recording ? 'Stop recording' : 'Record tab'}</button>
          <button className={`btn ${guides ? 'on' : ''}`} onClick={() => setGuides(!guides)}>Guides</button>
        </div>
      )}
      {notice && <div className="conn-pill" style={{ top: 'auto', bottom: 12 }}>{notice}</div>}
    </div>
  );
}
