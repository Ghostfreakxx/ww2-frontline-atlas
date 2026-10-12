// Dev helper: apply an episode scene/step to a session from the command line.
// usage: node scripts/dev/drive-session.mjs <base-url> <code> <token> <sceneIndex> <stepIndex> [layout]
import { barbarossaEpisode } from '../../src/data/conflicts/ww2-europe/episodes/barbarossa.ts';
import { sceneState } from '../../src/lib/episodes/apply.ts';
import { initialState } from '../../src/lib/sync/state.ts';
const [base, code, token, sc, st, layout] = process.argv.slice(2);
const cur = await (await fetch(`${base}/api/session/${code}`)).json();
let s = sceneState({ ...initialState(), ...cur.state, sceneId: null }, barbarossaEpisode, Number(sc), Number(st), Date.now(), { animate: false });
s.playback = { ...s.playback, playing: false };
if (s.playback.endDate) s.date = s.playback.endDate;
if (layout) s.layout = layout;
const res = await fetch(`${base}/api/session/${code}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ state: s }) });
console.log(res.status, s.sceneId, s.stepIndex, s.date, s.layout);
