import { sources } from '@/data/conflicts/ww2-europe/sources';
import { frontlines } from '@/data/conflicts/ww2-europe/frontlines';
import { territorySnapshots } from '@/data/conflicts/ww2-europe/territory';
import { ww2Europe } from '@/data/conflicts/ww2-europe';
import { formatDate } from '@/lib/history/query';

export const metadata = { title: 'Sources & method — Frontline Atlas' };

const confidenceText: [string, string][] = [
  ['documented', 'A dated fact stated in the cited works: appointments, captures, renamings, battle dates.'],
  ['approximate', 'A reconstruction anchored on documented places and dates; vertices between anchors are interpolated. Drawn with an uncertainty band.'],
  ['schematic', 'A diagram — campaign arrows show the direction of a dated advance between documented start and end places, not where units were.'],
  ['planned', 'An intention or objective (e.g. Directive 21), shown with hollow symbols — never as an achieved result.'],
  ['uncertain', 'Thin or conflicting evidence; flagged on screen.'],
];

export default function SourcesPage() {
  const count = (c: string) => [...ww2Europe.events, ...ww2Europe.battles, ...ww2Europe.arrows, ...ww2Europe.frontlines, ...ww2Europe.objectives].filter((x) => x.confidence === c).length;
  return (
    <main className="page" style={{ maxWidth: 980 }}>
      <p className="label">Frontline Atlas</p>
      <h1>Sources &amp; method</h1>
      <p className="lede">
        The atlas separates political borders, occupied territory, military front lines, planned objectives and schematic campaign arrows. Every dated item cites the source registry
        below and carries a confidence label. Citations are recorded at reference level (work and author); page-level verification is marked separately and should be completed
        before publication.
      </p>

      <h2 style={{ fontFamily: 'var(--serif)' }}>Confidence labels</h2>
      <table className="table">
        <tbody>
          {confidenceText.map(([k, v]) => (
            <tr key={k}>
              <td><span className={`chip ${k}`}>{k}</span></td>
              <td>{v}</td>
              <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{count(k)} items</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontFamily: 'var(--serif)' }}>Political borders</h2>
      <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
        Built from Natural Earth country outlines (public domain), cut with hand-digitised historical boundary lines: the 1921 Riga border, the German–Soviet line of 28 September 1939
        (snapped to the Bug and San rivers), the Memel Territory, the Vienna Awards, the 1940 Soviet annexations, the French demarcation line, the General Government. Accuracy is
        about ±10–20 km; internal occupation zones in Yugoslavia and Greece are not drawn.
      </p>
      <ul>
        {territorySnapshots.map((t) => (
          <li key={t.id} style={{ marginBottom: 6 }}>
            <strong>{t.label}</strong> — shown from {formatDate(t.validFrom ?? t.date)}. <span style={{ color: 'var(--text-3)' }}>{t.description}</span>
          </li>
        ))}
      </ul>

      <h2 style={{ fontFamily: 'var(--serif)' }}>Front-line snapshots</h2>
      <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
        The map shows the latest snapshot on or before the selected date and labels its date. It never interpolates between snapshots. Anchor places (documented) and interpolated
        vertices are listed for each line.
      </p>
      {frontlines.map((f) => (
        <details key={f.id} style={{ marginBottom: 10 }}>
          <summary>
            <strong>{f.label}</strong> <span className={`chip ${f.confidence}`}>{f.confidence}</span> <span style={{ color: 'var(--text-3)' }}>±{f.uncertaintyKm} km</span>
          </summary>
          <p style={{ color: 'var(--text-2)' }}>{f.description}</p>
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Sources: {f.sources.map((s) => sources.find((x) => x.id === s.id)?.author).join('; ')}</p>
          <ul style={{ fontSize: 14, color: 'var(--text-2)' }}>
            {f.segments.flatMap((s) => s.points).filter((p) => p.place).map((p, i) => (
              <li key={i}>{p.q === 'a' ? 'Anchor' : p.q === 'b' ? 'Interpolated' : 'No continuous front'}: {p.place}{p.note ? ` — ${p.note}` : ''}</li>
            ))}
          </ul>
        </details>
      ))}

      <h2 style={{ fontFamily: 'var(--serif)' }}>Source registry ({sources.length})</h2>
      <ul style={{ lineHeight: 1.5 }}>
        {sources.map((s) => (
          <li key={s.id} style={{ marginBottom: 8 }}>
            {s.author}{s.year ? ` (${s.year})` : ''}. <em>{s.title}</em>{s.publisher ? `. ${s.publisher}` : ''}.{' '}
            <span style={{ color: 'var(--text-3)', fontSize: 14 }}>[{s.id}] {s.kind}{s.license ? ` · ${s.license}` : ''}{s.notes ? ` · ${s.notes}` : ''}</span>
          </li>
        ))}
      </ul>

      <h2 style={{ fontFamily: 'var(--serif)' }}>Imagery and fonts</h2>
      <p style={{ color: 'var(--text-2)' }}>
        Relief: Terrain Tiles (Mapzen / AWS Open Data; SRTM, GMTED2010, ETOPO1). Fonts: Source Serif 4 and IBM Plex Sans Condensed (SIL Open Font License). No commander portraits are
        bundled: add only images whose licence permits reuse and record their credit.
      </p>
    </main>
  );
}
