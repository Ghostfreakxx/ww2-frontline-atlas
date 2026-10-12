import Link from 'next/link';
import StartSession from './StartSession';

export default function Home() {
  return (
    <main className="page">
      <p className="label" style={{ marginBottom: 10 }}>Frontline Atlas · WWII Europe 1939–1945</p>
      <h1>Present the war map from your iPad</h1>
      <p className="lede">
        The iPad is your control surface. The computer shows a clean 16:9 historical map for OBS or browser capture. Everything you tap on the iPad — dates, army groups, battles, drawings —
        appears on the audience display immediately.
      </p>
      <StartSession />
      <div className="grid-2" style={{ marginTop: 28 }}>
        <section className="card">
          <h2 style={{ fontFamily: 'var(--serif)', marginTop: 0 }}>Recording setup</h2>
          <ol style={{ lineHeight: 1.6, color: 'var(--text-2)', paddingLeft: 20 }}>
            <li>Run the app on the computer (<span className="kbd">npm run build && npm start</span>) and keep iPad and computer on the same Wi-Fi.</li>
            <li>Click <strong>New session</strong> above and scan the QR code with the iPad — it opens the presenter with its private key.</li>
            <li>On the computer open the audience display. In OBS add a <em>Browser source</em> at 1920 × 1080 with the “OBS — clean” link from the presenter’s share sheet.</li>
            <li>Put your camera in the left 40% (or use the transparent link and layer the map over your camera).</li>
            <li>Record in OBS. The iPad never records anything; you can also save 1080p PNGs or a WebM of the display tab.</li>
          </ol>
        </section>
        <section className="card">
          <h2 style={{ fontFamily: 'var(--serif)', marginTop: 0 }}>What is on the map</h2>
          <ul style={{ lineHeight: 1.6, color: 'var(--text-2)', paddingLeft: 20 }}>
            <li><strong>Political borders</strong> — dated reconstructions (1939, 1939–40, 1940, 1941).</li>
            <li><strong>Front lines</strong> — dated snapshots anchored on documented places, with an uncertainty band.</li>
            <li><strong>Campaign arrows</strong> — schematic directions of dated advances, never unit positions.</li>
            <li><strong>Army groups</strong> — a time-aware command database: commanders, armies, corps, divisions, reorganisations.</li>
            <li>Every item carries citations and a confidence label. See <Link href="/sources">sources &amp; method</Link>.</li>
          </ul>
        </section>
      </div>
      <p style={{ marginTop: 28, color: 'var(--text-3)' }}>
        Already have a session? <Link href="/presenter">Open the presenter</Link> · <Link href="/display">Open an audience display</Link>
      </p>
    </main>
  );
}
