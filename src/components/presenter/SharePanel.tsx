'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { copyText } from '@/lib/ui/platform';
import { SESSION_CODE_RE } from '@/lib/sync/state';

interface Props {
  code: string;
  token: string | null;
  listeners: number;
  onClose: () => void;
}

/** Links and QR codes for the audience display (and for adding another presenter device). */
export function SharePanel({ code, token, listeners, onClose }: Props) {
  const [origins, setOrigins] = useState<string[]>([]);
  const [origin, setOrigin] = useState('');
  const [qr, setQr] = useState<{ display?: string; presenter?: string }>({});
  const [showKey, setShowKey] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const here = window.location.origin;
    setOrigin(here);
    fetch('/api/info')
      .then((r) => r.json())
      .then((j: { addresses: string[]; port: string }) => {
        const proto = window.location.protocol;
        const lan = j.addresses.map((a) => `${proto}//${a}${j.port && j.port !== '80' && j.port !== '443' ? `:${j.port}` : ''}`);
        const list = [here, ...lan.filter((o) => o !== here)];
        setOrigins(list);
        if (/localhost|127\.0\.0\.1/.test(here) && lan[0]) setOrigin(lan[0]);
      })
      .catch(() => setOrigins([here]));
  }, []);

  const displayUrl = `${origin}/display?code=${code}`;
  const presenterUrl = token ? `${origin}/presenter?code=${code}#k=${token}` : '';
  useEffect(() => {
    if (!origin) return;
    const opts = { margin: 1, width: 220, color: { dark: '#111111', light: '#ffffff' } };
    Promise.all([QRCode.toDataURL(displayUrl, opts), presenterUrl ? QRCode.toDataURL(presenterUrl, opts) : Promise.resolve(undefined)]).then(([d, p]) => setQr({ display: d, presenter: p }));
  }, [origin, displayUrl, presenterUrl]);

  const copy = (t: string) => copyText(t);
  // Join a session created elsewhere (e.g. the start page on the computer). Needed in the home-screen
  // app on iPad, whose storage is separate from Safari's, so a link opened in Safari does not carry over.
  const join = () => {
    try {
      const u = new URL(joinLink.trim(), window.location.origin);
      const c = (u.searchParams.get('code') || '').toUpperCase();
      const k = new URLSearchParams(u.hash.slice(1)).get('k');
      if (!SESSION_CODE_RE.test(c) || !k) throw new Error();
      // `join` forces a real navigation even when only the key in the hash differs.
      window.location.assign(`/presenter?code=${c}&join=${Date.now()}#k=${encodeURIComponent(k)}`);
    } catch {
      setJoinError('Paste the full presenter link (it contains ?code=… and #k=…).');
    }
  };
  const variants: [string, string][] = [
    ['Audience display (follows presenter layout)', displayUrl],
    ['OBS browser source — clean', `${displayUrl}&clean=1`],
    ['OBS — transparent camera area', `${displayUrl}&clean=1&transparent=1`],
    ['Always full-width map', `${displayUrl}&clean=1&layout=full`],
    ['Map with title-safe margins', `${displayUrl}&clean=1&layout=map-safe`],
  ];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Connect the audience display" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2>Connect the audience display</h2>
          <button className="btn icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="muted">Session code <span className="code-big" style={{ fontSize: 28 }}>{code}</span> · {listeners > 1 ? `${listeners - 1} other device(s) connected` : 'no display connected yet'}</p>
        {origins.length > 1 && (
          <label className="small">
            Address the other device should use:{' '}
            <select value={origin} onChange={(e) => setOrigin(e.target.value)} style={{ width: 'auto', minHeight: 36 }}>
              {origins.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        )}
        <div className="share-grid">
          <div>
            {qr.display && <img src={qr.display} alt="QR code for the audience display" width={180} height={180} />}
            <p className="small">On the computer, open <strong>{origin}/display</strong> and enter <strong>{code}</strong>, or scan this.</p>
          </div>
          <ul className="link-list">
            {variants.map(([label, url]) => (
              <li key={url}>
                <div className="small muted">{label}</div>
                <div className="link-copy">
                  <code>{url}</code>
                  <button className="btn" onClick={() => copy(url)}>Copy</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <details onToggle={(e) => setShowKey((e.target as HTMLDetailsElement).open)}>
          <summary>Control from a second device (presenter key)</summary>
          {showKey && token && (
            <div className="share-grid">
              {qr.presenter && <img src={qr.presenter} alt="QR code for a second presenter" width={180} height={180} />}
              <div>
                <p className="small">Anyone with this link can control the presentation. Use it only on your own devices.</p>
                <div className="link-copy"><code>{presenterUrl}</code><button className="btn" onClick={() => copy(presenterUrl)}>Copy</button></div>
              </div>
            </div>
          )}
        </details>
        <details>
          <summary>Switch session</summary>
          <p className="small">Join a session started on the computer by pasting its presenter link, or start a new session on this device.</p>
          <div className="link-copy">
            <input type="url" aria-label="Presenter link" placeholder="https://…/presenter?code=ABC123#k=…" value={joinLink} onChange={(e) => { setJoinLink(e.target.value); setJoinError(null); }} />
            <button className="btn" onClick={join} disabled={!joinLink.trim()}>Join</button>
          </div>
          {joinError && <p className="small" role="alert">{joinError}</p>}
          <p><a className="btn" href="/presenter?new=1">Start a new session</a></p>
        </details>
      </div>
    </div>
  );
}
