import { db } from "@/lib/db";
import { getEventsSince, getInvestigationSnapshot } from "@/lib/events/log";
import { investigationParamsSchema } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const encoder = new TextEncoder();

function formatSSE(payload: unknown) {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(request: Request, { params }: RouteContext) {
  const parsedParams = investigationParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return new Response(JSON.stringify({ error: "Invalid investigation id." }), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    });
  }
  const { id } = parsedParams.data;
  const snapshot = await getInvestigationSnapshot(id);

  if (!snapshot) {
    return new Response(JSON.stringify({ error: "Investigation not found." }), {
      status: 404,
      headers: {
        "content-type": "application/json",
      },
    });
  }

  let active = true;
  let cursor =
    Number(new URL(request.url).searchParams.get("cursor") || Number.NaN) ||
    Number(request.headers.get("last-event-id") || Number.NaN) ||
    0;

  const latestEvent = await db.eventLog.findFirst({
    where: { investigationId: id },
    orderBy: { id: "desc" },
    select: { id: true },
  });

  if (cursor <= 0) {
    cursor = latestEvent?.id ?? 0;
  }

  let pollHandle: NodeJS.Timeout | undefined;
  let heartbeatHandle: NodeJS.Timeout | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(formatSSE(snapshot));

      const poll = async () => {
        if (!active) {
          return;
        }

        const events = await getEventsSince(id, cursor);
        for (const event of events) {
          cursor = event.cursor;
          controller.enqueue(formatSSE(event.payload));
        }
      };

      pollHandle = setInterval(() => {
        void poll();
      }, 1000);

      heartbeatHandle = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15000);

      request.signal.addEventListener("abort", () => {
        active = false;
        if (pollHandle) {
          clearInterval(pollHandle);
        }
        if (heartbeatHandle) {
          clearInterval(heartbeatHandle);
        }
        controller.close();
      });
    },
    cancel() {
      active = false;
      if (pollHandle) {
        clearInterval(pollHandle);
      }
      if (heartbeatHandle) {
        clearInterval(heartbeatHandle);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
