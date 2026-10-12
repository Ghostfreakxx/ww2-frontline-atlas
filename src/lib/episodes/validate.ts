import type { Episode } from './types.ts';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Structural validation for imported/saved episodes. Throws with a readable message. */
export function validateEpisode(data: unknown): Episode {
  const fail = (msg: string): never => {
    throw new Error(`Invalid episode: ${msg}`);
  };
  if (!data || typeof data !== 'object') fail('not an object');
  const ep = data as Episode;
  if (ep.schema !== 1) fail('unsupported schema version');
  if (typeof ep.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(ep.id)) fail('id must be lowercase letters, digits and dashes');
  if (typeof ep.title !== 'string' || !ep.title.trim()) fail('missing title');
  if (!Array.isArray(ep.scenes)) fail('scenes must be an array');
  if (ep.scenes.length > 200) fail('too many scenes');
  const ids = new Set<string>();
  ep.scenes.forEach((s, i) => {
    if (!s || typeof s !== 'object') fail(`scene ${i + 1} is not an object`);
    if (typeof s.id !== 'string' || ids.has(s.id)) fail(`scene ${i + 1} has a missing or duplicate id`);
    ids.add(s.id);
    if (typeof s.title !== 'string') fail(`scene ${i + 1} has no title`);
    if (!s.base || !ISO.test(s.base.date ?? '')) fail(`scene ${i + 1} has no valid date`);
    const c = s.base.camera;
    if (!c || [c.lon, c.lat, c.zoom].some((v) => typeof v !== 'number' || !Number.isFinite(v))) fail(`scene ${i + 1} has no valid camera`);
    if (!Array.isArray(s.steps)) fail(`scene ${i + 1} steps must be an array`);
    if (!Array.isArray(s.sources)) fail(`scene ${i + 1} sources must be an array`);
    if (typeof s.notes !== 'string') fail(`scene ${i + 1} notes must be text`);
    for (const st of s.steps) if (st.patch?.date && !ISO.test(st.patch.date)) fail(`scene ${i + 1} step "${st.label}" has an invalid date`);
  });
  return ep;
}
