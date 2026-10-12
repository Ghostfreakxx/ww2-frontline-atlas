import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import type { Episode } from './types.ts';
import { validateEpisode } from './validate.ts';

const DIR = path.join(process.env.ATLAS_DATA_DIR || path.join(process.cwd(), '.data'), 'episodes');
const safeId = (id: string) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);

export function listEpisodes(): { id: string; title: string; updatedAt: string; scenes: number }[] {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).flatMap((f) => {
    try {
      const ep = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as Episode;
      return [{ id: ep.id, title: ep.title, updatedAt: ep.updatedAt, scenes: ep.scenes.length }];
    } catch {
      return [];
    }
  });
}

export function readEpisode(id: string): Episode | null {
  if (!safeId(id)) return null;
  const file = path.join(DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeEpisode(id: string, data: unknown): Episode {
  if (!safeId(id)) throw new Error('invalid-id');
  const ep = validateEpisode(data);
  if (ep.id !== id) throw new Error('id-mismatch');
  fs.mkdirSync(DIR, { recursive: true });
  const saved = { ...ep, updatedAt: new Date().toISOString() };
  const tmp = path.join(DIR, `${id}.json.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(saved, null, 2));
  fs.renameSync(tmp, path.join(DIR, `${id}.json`));
  return saved;
}
