import os from 'node:os';
import { NextResponse } from 'next/server';
import { storageKind } from '@/lib/sync/server-store';

export const dynamic = 'force-dynamic';

/** LAN addresses of this machine (so the start page can show links the iPad can open) and the storage mode. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  const hosted = Boolean(process.env.VERCEL);
  const addresses: string[] = [];
  // On a hosting platform the machine's own addresses are internal and useless to the iPad.
  if (!hosted) for (const list of Object.values(os.networkInterfaces())) for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) addresses.push(a.address);
  return NextResponse.json({ port, addresses, hosted, storage: storageKind(), serverTime: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
