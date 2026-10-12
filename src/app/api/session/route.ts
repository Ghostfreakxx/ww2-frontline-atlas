import { NextResponse } from 'next/server';
import { createSession } from '@/lib/sync/server-store';
import type { PresentationState } from '@/lib/sync/state';

export const dynamic = 'force-dynamic';

/** Create a presentation session, or recover one the presenter still holds locally ({code, token, state}). */
export async function POST(req: Request) {
  let body: { code?: string; token?: string; state?: PresentationState } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body = new session */
  }
  const res = await createSession(body);
  if ('error' in res) return NextResponse.json(res, { status: res.error === 'code-in-use' ? 409 : 400 });
  return NextResponse.json({ ...res, serverTime: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
