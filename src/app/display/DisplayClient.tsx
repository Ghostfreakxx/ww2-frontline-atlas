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
import { toggleFullscreen } from '@/lib/ui/platform';
import { CameraFeed, InkLayer, PEN_COLORS, cameraSlot, loadWebcamPrefs, saveWebcamPrefs, useWebcam, type InkHandle, type WebcamPrefs } from '@/components/display/DisplayExtras';

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
  const camParam = params.get('cam') === '1';

  useEffect(() => {
    document.documentElement.classList.toggle('transparent', transparent);
  }, [transparent]);

  if (!valid) return <JoinForm initial={code} />;
  return <LiveDisplay code={code} transparent={transparent} clean={clean} quiet={quiet} forcedLayout={forcedLayout && forcedLayout in LAYOUTS ? forcedLayout : null} fixedScale={fixedScale} guides={guides} setGuides={setGuides} camParam={camParam} />;
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

function LiveDisplay(props: { code: string; transparent: boolean; clean: boolean; quiet: boolean; forcedLayout: Layout | null; fixedScale: boolean; guides: boolean; setGuides: (v: boolean) => void; camParam: boolean }) {
  const { code, transparent, clean, quiet, forcedLayout, fixedScale, guides, setGuides, camParam } = props;
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
  const say = useCallback((m: string, ms = 2500) => {
    setNotice(m);
    setTimeout(() => setNotice(null), ms);
  }, []);

  // This computer's webcam (camera area / bubble) and the screen pen. Local to this display only.
  const [cam, setCamState] = useState<WebcamPrefs>({ on: false, deviceId: null, mirror: true });
  useEffect(() => setCamState(loadWebcamPrefs(camParam)), [camParam]);
  const setCam = useCallback((u: (p: WebcamPrefs) => WebcamPrefs) => setCamState((p) => {
    const n = u(p);
    saveWebcamPrefs(n);
    return n;
  }), []);
  const webcam = useWebcam(cam);
  useEffect(() => {
    if (webcam.error) say(webcam.error, 4000);
  }, [webcam.error, say]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inkRef = useRef<InkHandle>(null);
  const [pen, setPen] = useState(false);
  const penRef = useRef(false);
  penRef.current = pen;
  const [penColor, setPenColor] = useState(PEN_COLORS[0].color);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (clean) return;
    let timer: ReturnType<typeof setTimeout>;
    const show = (e: Event) => {
      // While drawing with the pen the toolbar only appears near the top edge, so it stays out of the shot.
      if (penRef.current && 'clientY' in e && (e as MouseEvent).clientY > 90) return;
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
      let blob = await stageToPngBlob(svgRef.current, 1920, 1080, transparent ? null : '#000');
      const video = webcam.stream ? videoRef.current : null;
      const slot = cameraSlot(effective.layout);
      if ((video && slot && video.videoWidth) || inkRef.current?.hasInk()) {
        // Composite the webcam frame and the pen ink onto the map image.
        const c = document.createElement('canvas');
        c.width = 1920;
        c.height = 1080;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(await createImageBitmap(blob), 0, 0);
        if (video && slot && video.videoWidth) {
          ctx.save();
          ctx.beginPath();
          if (slot.round) ctx.arc(slot.x + slot.w / 2, slot.y + slot.h / 2, slot.w / 2, 0, Math.PI * 2);
          else ctx.rect(slot.x, slot.y, slot.w, slot.h);
          ctx.clip();
          const s = Math.max(slot.w / video.videoWidth, slot.h / video.videoHeight);
          const w = video.videoWidth * s, h = video.videoHeight * s;
          if (cam.mirror) {
            ctx.translate(slot.x + slot.w / 2, 0);
            ctx.scale(-1, 1);
            ctx.translate(-(slot.x + slot.w / 2), 0);
          }
          ctx.drawImage(video, slot.x + (slot.w - w) / 2, slot.y + (slot.h - h) / 2, w, h);
          ctx.restore();
          if (slot.round) {
            ctx.beginPath();
            ctx.arc(slot.x + slot.w / 2, slot.y + slot.h / 2, slot.w / 2 - 3, 0, Math.PI * 2);
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#f2eee4';
            ctx.stroke();
          }
        }
        inkRef.current?.paint(ctx);
        blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/png'));
      }
      downloadBlob(blob, `atlas-${view.date}-${state.sceneId ?? 'map'}.png`);
      setNotice('Screenshot saved (1920×1080 PNG)');
    } catch (e) {
      setNotice(`Screenshot failed: ${(e as Error).message}`);
    }
    setTimeout(() => setNotice(null), 2500);
  }, [transparent, view.date, state.sceneId, webcam.stream, effective.layout, cam.mirror]);

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
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'g' || e.key === 'G') setGuides(!guides);
      if (e.key === 'p' || e.key === 'P') setPen((v) => !v);
      if (e.key === 'c' || e.key === 'C') inkRef.current?.clear();
      if ((e.key === 'z' || e.key === 'Z') && !e.shiftKey) inkRef.current?.undo();
      if (e.key === 'Escape') setPen(false);
      if (e.key === 'w' || e.key === 'W') setCam((p) => ({ ...p, on: !p.on }));
      if (pen && e.key >= '1' && e.key <= String(PEN_COLORS.length)) setPenColor(PEN_COLORS[Number(e.key) - 1].color);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screenshot, guides, setGuides, setCam, pen]);

  const scale = fixedScale ? 1 : Math.min(size.w / STAGE.w, size.h / STAGE.h);
  const disconnected = status !== 'live';

  return (
    <div className="display-root" data-status={status} data-rev={state.rev} data-date={view.date}>
      {geo && hasState ? (
        <div className="display-stage" style={{ width: STAGE.w * scale, height: STAGE.h * scale }}>
          <DisplayStage ref={svgRef} idx={idx} geo={geo} state={effective} date={view.date} camera={view.camera} now={view.now} arrowBorn={view.arrowBorn} transparent={transparent} guides={guides} width={STAGE.w * scale} idPrefix="display" />
          {webcam.stream && <CameraFeed ref={videoRef} stream={webcam.stream} layout={effective.layout} scale={scale} mirror={cam.mirror} />}
          <InkLayer ref={inkRef} active={pen} color={penColor} scale={scale} resetKey={`${state.transition.seq}:${state.sceneId}:${state.stepIndex}`} />
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
          <button className="btn" onClick={() => toggleFullscreen()}>Fullscreen</button>
          <button className="btn" onClick={screenshot}>Screenshot</button>
          <button className={`btn ${recording ? 'on' : ''}`} onClick={toggleRecord}>{recording ? 'Stop recording' : 'Record tab'}</button>
          <button className={`btn ${guides ? 'on' : ''}`} onClick={() => setGuides(!guides)}>Guides</button>
          <span className="toolbar-sep" />
          <button className={`btn ${cam.on ? 'on' : ''}`} onClick={() => setCam((p) => ({ ...p, on: !p.on }))} aria-pressed={cam.on} title="Show this computer's camera in the camera area or bubble (W)">Camera</button>
          {cam.on && webcam.devices.length > 1 && (
            <select aria-label="Camera" value={cam.deviceId ?? ''} onChange={(e) => setCam((p) => ({ ...p, deviceId: e.target.value || null }))} style={{ width: 'auto', minHeight: 40 }}>
              <option value="">Default camera</option>
              {webcam.devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
            </select>
          )}
          {cam.on && <button className={`btn ${cam.mirror ? 'on' : ''}`} onClick={() => setCam((p) => ({ ...p, mirror: !p.mirror }))} aria-pressed={cam.mirror}>Mirror</button>}
          <span className="toolbar-sep" />
          <button className={`btn ${pen ? 'on' : ''}`} onClick={() => setPen((v) => !v)} aria-pressed={pen} title="Draw on the screen (P). C clears, Z undoes, Esc stops.">Pen</button>
          {pen && PEN_COLORS.map((c, i) => (
            <button key={c.color} className={`swatch-btn ${penColor === c.color ? 'on' : ''}`} style={{ background: c.color }} onClick={() => setPenColor(c.color)} aria-label={`${c.name} pen (${i + 1})`} aria-pressed={penColor === c.color} title={`${c.name} (${i + 1})`} />
          ))}
          {pen && <button className="btn" onClick={() => inkRef.current?.clear()}>Clear</button>}
        </div>
      )}
      {notice && <div className="conn-pill" style={{ top: 'auto', bottom: 12 }}>{notice}</div>}
    </div>
  );
}
