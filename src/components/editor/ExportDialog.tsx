'use client';
import { useEffect, useRef, useState } from 'react';
import type { MediaItem, Project } from '@/lib/editor/types';
import { ASPECTS } from '@/lib/editor/types';
import { fmtTime, projectDuration } from '@/lib/editor/timeline';
import { exportProject, pickPlan, type ExportProgress, type ExportResult } from '@/lib/editor/export';
import { getBlob } from '@/lib/editor/store';

export function ExportDialog({ project, media, onClose, pausePreview }: { project: Project; media: Map<string, MediaItem>; onClose: () => void; pausePreview: () => void }) {
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<(ExportResult & { url: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ fast: boolean; instagramReady: boolean } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const { w, h } = ASPECTS[project.aspect];
  const duration = projectDuration(project);
  const filename = `${(project.name || 'reel').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'reel'}`;

  useEffect(() => {
    pickPlan(w, h).then((r) => setPlan({ fast: !!r.plan, instagramReady: r.instagramReady }));
  }, [w, h]);
  useEffect(() => () => {
    abort.current?.abort();
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  const run = async () => {
    pausePreview();
    setError(null);
    setResult(null);
    abort.current = new AbortController();
    try {
      const r = await exportProject(project, media, getBlob, setProgress, abort.current.signal);
      setResult({ ...r, url: URL.createObjectURL(r.blob) });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || String(e));
    } finally {
      setProgress(null);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `${filename}.${result.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const file = result ? new File([result.blob], `${filename}.${result.ext}`, { type: result.blob.type }) : null;
  const canShare = !!file && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] });

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;

  return (
    <div className="sheet-backdrop" onClick={() => !progress && onClose()}>
      <div className="sheet ed-export" role="dialog" aria-modal="true" aria-label="Export video" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2>Export video</h2>
          <button className="btn icon" onClick={() => (progress ? abort.current?.abort() : onClose())} aria-label={progress ? 'Cancel export' : 'Close'}>✕</button>
        </div>
        <p className="muted">{w} × {h} · {project.fps} fps · {fmtTime(duration)} · {!plan ? 'checking this browser…' : `${plan.instagramReady ? 'MP4 — ready for Instagram, TikTok and YouTube' : 'WebM — convert to MP4 before posting to Instagram'}${plan.fast ? '' : ' · records in real time, keep this tab visible'}`}</p>

        {!progress && !result && (
          <button className="btn primary big" onClick={run} disabled={duration <= 0}>Export {fmtTime(duration)} video</button>
        )}
        {progress && (
          <div className="ed-progress" role="status" aria-live="polite">
            <div className="bar"><span style={{ width: `${pct}%` }} /></div>
            <p>{progress.phase === 'audio' ? 'Mixing sound…' : progress.phase === 'finishing' ? 'Finishing the file…' : `Rendering video… ${pct}%`}</p>
            <button className="btn" onClick={() => abort.current?.abort()}>Cancel</button>
          </div>
        )}
        {error && <p role="alert" className="ed-error">Export failed: {error}</p>}
        {result && (
          <div className="ed-result">
            <video src={result.url} controls playsInline style={{ aspectRatio: `${w} / ${h}` }} />
            <div>
              <p><strong>{filename}.{result.ext}</strong> · {(result.blob.size / 1024 / 1024).toFixed(1)} MB · made in {result.seconds.toFixed(0)} s</p>
              {result.ext === 'webm' && <p className="muted small">This browser could only make a WebM file. Instagram needs MP4 — export from Chrome, Edge or Safari, or convert the file.</p>}
              <div className="ins-row">
                <button className="btn primary big" onClick={download}>Download</button>
                {canShare && <button className="btn big" onClick={() => navigator.share({ files: [file!], title: project.name }).catch(() => {})}>Share / Save to Photos</button>}
              </div>
              <button className="btn ghost" onClick={run}>Export again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
