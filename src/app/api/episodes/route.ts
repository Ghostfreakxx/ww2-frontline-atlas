import { NextResponse } from 'next/server';
import { listEpisodes } from '@/lib/episodes/server-episodes';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ episodes: listEpisodes() });
}
