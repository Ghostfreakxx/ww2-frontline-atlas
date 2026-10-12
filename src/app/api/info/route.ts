import os from 'node:os';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** LAN addresses of this machine, so the start page can show links/QR codes the iPad can open. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  const addresses: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) addresses.push(a.address);
  return NextResponse.json({ hostname: os.hostname(), port, addresses, serverTime: Date.now() });
}
