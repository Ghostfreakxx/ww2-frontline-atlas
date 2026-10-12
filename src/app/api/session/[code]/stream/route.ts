import { getSession, subscribe, listenerCount, broadcast } from '@/lib/sync/server-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Server-sent events: `hello` (server clock + current state), then `state` on every change, plus keep-alives. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const s = getSession(code.toUpperCase());
  if (!s) return new Response('not found', { status: 404 });
  const role = new URL(req.url).searchParams.get('role') === 'presenter' ? 'presenter' : 'display';
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      controller.enqueue(encoder.encode('retry: 1500\n\n'));
      send('hello', JSON.stringify({ serverTime: Date.now(), state: s.state }));
      const unsubscribe = subscribe(s, send);
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
        } catch {
          cleanup();
        }
      }, 10_000);
      const announce = () => broadcast(s, 'presence', JSON.stringify({ listeners: listenerCount(s) }));
      announce();
      cleanup = () => {
        clearInterval(keepAlive);
        unsubscribe();
        announce();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener('abort', () => cleanup());
      void role;
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
