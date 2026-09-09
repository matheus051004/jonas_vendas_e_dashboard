import { CHAT_EVENTS_CHANNEL, createChatEventsSubscriber } from "@jonas/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET() {
  const subscriber = createChatEventsSubscriber();

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let cleanupRef: (() => Promise<void>) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* stream já fechado */
        }
      };

      const cleanup = async () => {
        if (closed) return;
        closed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        try {
          await subscriber.unsubscribe(CHAT_EVENTS_CHANNEL);
        } catch {
          /* ignore */
        }
        try {
          subscriber.disconnect();
        } catch {
          /* ignore */
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };
      cleanupRef = cleanup;

      subscriber.on("message", (_channel, message) => {
        send(`data: ${message}\n\n`);
      });

      subscriber.on("error", (err) => {
        console.error("[atendimentos/stream] redis error:", err);
        void cleanup();
      });

      void subscriber.subscribe(CHAT_EVENTS_CHANNEL).then(() => {
        send(`: connected\n\n`);
      });

      heartbeat = setInterval(() => {
        send(`: ping\n\n`);
      }, HEARTBEAT_MS);
    },
    cancel() {
      void cleanupRef?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
