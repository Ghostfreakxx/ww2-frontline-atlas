'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Creates a session on this computer and shows the iPad presenter link as a QR code. */
export default function StartSession() {
  const [session, setSession] = useState<{ code: string; token: string } | null>(null);
  const [origin, setOrigin] = useState('');
  const [origins, setOrigins] = useState<string[]>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const here = window.location.origin;
    setOrigin(here);
    fetch('/api/info')
      .then((r) => r.json())
      .then((j: { addresses: string[]; port: string }) => {
        const lan = j.addresses.map((a) => `${window.location.protocol}//${a}${j.port && !['80', '443'].includes(j.port) ? `:${j.port}` : ''}`);
        setOrigins([here, ...lan.filter((o) => o !== here)]);
        if (/localhost|127\.0\.0\.1/.test(here) && lan[0]) setOrigin(lan[0]);
      })
      .catch(() => setOrigins([here]));
  }, []);

  const presenterUrl = session ? `${origin}/presenter?code=${session.code}#k=${session.token}` : '';
  useEffect(() => {
    if (presenterUrl) QRCode.toDataURL(presenterUrl, { margin: 1, width: 240 }).then(setQr);
  }, [presenterUrl]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/session', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      setSession({ code: j.code, token: j.token });
    } catch (e) {
      setError(`Could not create a session (${(e as Error).message}).`);
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
        <button className="btn primary big" onClick={create} disabled={busy}>New session</button>
        <a className="btn big" href="/presenter">Start presenting on this device</a>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <section className="card" style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'center' }}>
      {qr && <img src={qr} alt="QR code: open the presenter on the iPad" width={200} height={200} style={{ borderRadius: 10, background: '#fff' }} />}
      <div>
        <p className="label">Session</p>
        <div className="code-big">{session.code}</div>
        <p style={{ color: 'var(--text-2)' }}>1. Scan with the iPad camera to open the presenter (the link contains the presenter key — keep it private).</p>
        {origins.length > 1 && (
          <label style={{ fontSize: 14, color: 'var(--text-3)' }}>
            Address for the iPad:{' '}
            <select value={origin} onChange={(e) => setOrigin(e.target.value)} style={{ width: 'auto', minHeight: 34 }}>
              {origins.map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <a className="btn primary" href={`/display?code=${session.code}`} target="_blank" rel="noreferrer">2. Open audience display</a>
          <a className="btn" href={`/display?code=${session.code}&clean=1`} target="_blank" rel="noreferrer">Clean display (OBS)</a>
          <a className="btn" href={`/presenter?code=${session.code}#k=${session.token}`}>Present from this computer instead</a>
        </div>
      </div>
    </section>
  );
}
