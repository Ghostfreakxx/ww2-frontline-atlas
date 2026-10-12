import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import type { Episode } from './types.ts';
import { validateEpisode } from './validate.ts';
import { DATA_DIR, redis, storageKind } from '../sync/server-store.ts';

// Episodes saved from the presenter: files in .data/episodes locally, or Redis keys when hosted.

const DIR = path.join(DATA_DIR, 'episodes');
const safeId = (id: string) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
const useRedis = () => storageKind() === 'redis';
const kEp = (id: string) => `atlas:e:${id}`;
const K_INDEX = 'atlas:episodes';

const summary = (ep: Episode) => ({ id: ep.id, title: ep.title, updatedAt: ep.updatedAt, scenes: ep.scenes.length });

export async function listEpisodes(): Promise<{ id: string; title: string; updatedAt: string; scenes: number }[]> {
  if (useRedis()) {
    const ids = (await redis<string[]>(['SMEMBERS', K_INDEX])) ?? [];
    const eps = await Promise.all(ids.map((id) => readEpisode(id)));
    return eps.flatMap((ep) => (ep ? [summary(ep)] : []));
  }
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).flatMap((f) => {
    try {
      return [summary(JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as Episode)];
    } catch {
      return [];
    }
  });
}

export async function readEpisode(id: string): Promise<Episode | null> {
  if (!safeId(id)) return null;
  if (useRedis()) {
    const raw = await redis<string | null>(['GET', kEp(id)]);
    return raw ? JSON.parse(raw) : null;
  }
  const file = path.join(DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function writeEpisode(id: string, data: unknown): Promise<Episode> {
  if (!safeId(id)) throw new Error('invalid-id');
  const ep = validateEpisode(data);
  if (ep.id !== id) throw new Error('id-mismatch');
  const saved = { ...ep, updatedAt: new Date().toISOString() };
  if (useRedis()) {
    await redis(['SET', kEp(id), JSON.stringify(saved)]);
    await redis(['SADD', K_INDEX, id]);
    return saved;
  }
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = path.join(DIR, `${id}.json.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(saved, null, 2));
  fs.renameSync(tmp, path.join(DIR, `${id}.json`));
  return saved;
}
