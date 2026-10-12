'use client';
import { useRef } from 'react';
import type { MediaItem } from '@/lib/editor/types';
import { fmtTime } from '@/lib/editor/timeline';

export function MediaBin({ media, onImport, onAdd, onRemove }: { media: MediaItem[]; onImport: (f: FileList) => void; onAdd: (m: MediaItem) => void; onRemove: (m: MediaItem) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="bin">
      <div className="bin-head">
        <h2>Media</h2>
        <button className="btn primary" onClick={() => input.current?.click()}>Import</button>
        <input
          ref={input}
          type="file"
          multiple
          accept="video/*,image/*,audio/*,.mp4,.mov,.webm,.m4a,.mp3,.wav"
          hidden
          aria-label="Import media files"
          onChange={(e) => {
            if (e.target.files) onImport(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {media.length === 0 ? (
        <div className="bin-empty">
          <p><strong>Drop videos, photos and music here</strong>, or tap Import.</p>
          <p className="muted small">Recordings made with <em>Record tab</em> on the audience display appear here automatically. Everything stays on this device.</p>
        </div>
      ) : (
        <ul className="bin-list">
          {media.map((m) => (
            <li key={m.id} className={`bin-item kind-${m.kind}`}>
              <button className="bin-thumb" onClick={() => onAdd(m)} title={m.kind === 'audio' ? 'Add as music' : 'Add to the end of the timeline'} aria-label={`Add ${m.name} to the timeline`}>
                {m.thumb ? <img src={m.thumb} alt="" /> : <span className="bin-icon" aria-hidden>{m.kind === 'audio' ? '♪' : m.kind === 'image' ? '▣' : '▶'}</span>}
                {m.kind !== 'image' && <span className="bin-dur">{fmtTime(m.duration)}</span>}
                <span className="bin-add" aria-hidden>+</span>
              </button>
              <div className="bin-meta">
                <span className="bin-name" title={m.name}>{m.name}</span>
                <button className="btn ghost tiny" onClick={() => onRemove(m)} aria-label={`Delete ${m.name} from the library`}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
