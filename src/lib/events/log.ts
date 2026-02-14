import type { EventLog } from "@prisma/client";

import { db } from "@/lib/db";
import { fromDbInvestigationStatus, mapCallToProgressItem, mapTranscriptToLine } from "@/lib/mappers";
import type { SSEEventPayload } from "@/lib/events";

type PersistEventInput = {
  investigationId: string;
  callId?: string | null;
  payload: SSEEventPayload;
};

export async function persistEvent({ investigationId, callId, payload }: PersistEventInput) {
  await db.eventLog.create({
    data: {
      investigationId,
      callId: callId ?? undefined,
      eventType: payload.type,
      payload: payload as unknown as object,
    },
  });
}

export async function getInvestigationSnapshot(investigationId: string) {
  const investigation = await db.investigation.findUnique({
    where: {
      id: investigationId,
    },
    include: {
      calls: {
        orderBy: {
          createdAt: "asc",
        },
        include: {
          contact: true,
        },
      },
    },
  });

  if (!investigation) {
    return null;
  }

  const transcriptRows = await db.transcriptEvent.findMany({
    where: {
      call: {
        investigationId,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 500,
  });

  return {
    type: "investigation.snapshot" as const,
    investigationId,
    status: fromDbInvestigationStatus(investigation.status),
    requirement: investigation.requirement,
    calls: investigation.calls.map(mapCallToProgressItem),
    transcripts: transcriptRows.map(mapTranscriptToLine),
  };
}

export async function getEventsSince(investigationId: string, afterId: number) {
  const rows = await db.eventLog.findMany({
    where: {
      investigationId,
      id: {
        gt: afterId,
      },
    },
    orderBy: {
      id: "asc",
    },
    take: 250,
  });

  return rows.map((row) => ({
    cursor: row.id,
    payload: parseEventPayload(row),
  }));
}

function parseEventPayload(row: EventLog): SSEEventPayload {
  return row.payload as unknown as SSEEventPayload;
}
