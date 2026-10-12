import { NextResponse } from 'next/server';
import { readEpisode, writeEpisode } from '@/lib/episodes/server-episodes';
import { authorize, getSession } from '@/lib/sync/server-store';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ep = await readEpisode(id);
  return ep ? NextResponse.json(ep) : NextResponse.json({ error: 'not-found' }, { status: 404 });
}

/** Manual save. Requires a valid presenter session (code + token) so only the presenter can write to disk. */
export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const code = req.headers.get('x-session-code') || '';
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || null;
  const s = await getSession(code.toUpperCase());
  if (!s || !authorize(s, token)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const saved = await writeEpisode(id, await req.json());
    return NextResponse.json({ ok: true, updatedAt: saved.updatedAt });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
