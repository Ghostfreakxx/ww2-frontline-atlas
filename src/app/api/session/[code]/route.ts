import { NextResponse } from 'next/server';
import { authorize, getSession, listenerCount, updateState } from '@/lib/sync/server-store';
import type { PresentationState } from '@/lib/sync/state';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const s = getSession(code.toUpperCase());
  if (!s) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  return NextResponse.json({ state: s.state, serverTime: Date.now(), listeners: listenerCount(s) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const s = getSession(code.toUpperCase());
  if (!s) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || null;
  if (!authorize(s, token)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  let body: { state?: PresentationState };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 });
  }
  if (!body.state || typeof body.state !== 'object' || typeof body.state.date !== 'string') return NextResponse.json({ error: 'bad-state' }, { status: 400 });
  try {
    const state = updateState(s, body.state);
    return NextResponse.json({ rev: state.rev, serverTime: Date.now(), listeners: listenerCount(s) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 413 });
  }
}
