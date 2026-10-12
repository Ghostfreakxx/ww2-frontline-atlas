import { getSession, watch } from '@/lib/sync/server-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Serverless hosts cap how long a response may stream. The stream ends itself with a `bye` event
// shortly before that, and the client reconnects at once without showing "Reconnecting…".
export const maxDuration = 60;
const STREAM_MS = Number(process.env.ATLAS_STREAM_MS) || (process.env.VERCEL ? 50_000 : 0);

/** Server-sent events: `hello` (server clock + current state), then `state` on every change, plus keep-alives. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const code = (await ctx.params).code.toUpperCase();
  const s = await getSession(code);
  if (!s) return new Response('not found', { status: 404 });
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      controller.enqueue(encoder.encode('retry: 1500\n\n'));
      send('hello', JSON.stringify({ serverTime: Date.now(), state: s.state }));
      const stop = watch(code, s.state.rev, send);
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
        } catch {
          cleanup();
        }
      }, 10_000);
      const end = STREAM_MS
        ? setTimeout(() => {
            try {
              send('bye', '{}');
            } catch {
              /* closed */
            }
            cleanup();
          }, STREAM_MS)
        : undefined;
      let done = false;
      cleanup = () => {
        if (done) return;
        done = true;
        clearInterval(keepAlive);
        clearTimeout(end);
        stop();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener('abort', () => cleanup());
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
