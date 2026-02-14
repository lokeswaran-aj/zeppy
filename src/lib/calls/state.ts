import type { CallProgressItem, TranscriptSpeaker } from "@/lib/domain";
import { db } from "@/lib/db";
import { persistEvent } from "@/lib/events/log";
import { mapCallToProgressItem, mapTranscriptToLine, toDbCallStatus, toDbTranscriptSpeaker } from "@/lib/mappers";
import type { ExtractedFindingResult } from "@/lib/calls/extract";

type UpdateCallStatusInput = {
  callId: string;
  status: CallProgressItem["status"];
  failureReason?: string | null;
  livekitRoomName?: string | null;
  livekitParticipant?: string | null;
  livekitSipCallId?: string | null;
  score?: number | null;
};

export async function updateCallStatus(input: UpdateCallStatusInput) {
  const dbStatus = toDbCallStatus(input.status);
  const now = new Date();

  const updated = await db.call.update({
    where: { id: input.callId },
    data: {
      status: dbStatus,
      failureReason: input.failureReason === undefined ? undefined : input.failureReason,
      livekitRoomName: input.livekitRoomName === undefined ? undefined : input.livekitRoomName,
      livekitParticipant:
        input.livekitParticipant === undefined ? undefined : input.livekitParticipant,
      livekitSipCallId: input.livekitSipCallId === undefined ? undefined : input.livekitSipCallId,
      score: input.score === undefined ? undefined : input.score,
      startedAt: input.status === "dialing" ? now : undefined,
      endedAt: input.status === "completed" || input.status === "failed" ? now : undefined,
    },
    include: {
      contact: true,
    },
  });

  const callPayload = mapCallToProgressItem(updated);

  await persistEvent({
    investigationId: updated.investigationId,
    callId: updated.id,
    payload: {
      type: "call.status",
      investigationId: updated.investigationId,
      call: callPayload,
    },
  });

  return updated;
}

type AppendTranscriptInput = {
  callId: string;
  speaker: TranscriptSpeaker;
  text: string;
};

export async function appendTranscript(input: AppendTranscriptInput) {
  const call = await db.call.findUnique({
    where: { id: input.callId },
    include: {
      contact: true,
    },
  });

  if (!call) {
    return null;
  }

  const saved = await db.transcriptEvent.create({
    data: {
      callId: call.id,
      speaker: toDbTranscriptSpeaker(input.speaker),
      contactName: call.contact.name,
      text: input.text,
    },
  });

  const transcriptPayload = mapTranscriptToLine(saved);

  await persistEvent({
    investigationId: call.investigationId,
    callId: call.id,
    payload: {
      type: "call.transcript",
      investigationId: call.investigationId,
      transcript: transcriptPayload,
    },
  });

  return saved;
}

export async function getCallTranscriptText(callId: string) {
  const rows = await db.transcriptEvent.findMany({
    where: {
      callId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return rows
    .map((row) => `${row.speaker}: ${row.text}`)
    .join("\n")
    .trim();
}

export async function getCallTranscriptSnapshot(callId: string) {
  const rows = await db.transcriptEvent.findMany({
    where: {
      callId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const transcriptText = rows
    .map((row) => `${row.speaker}: ${row.text}`)
    .join("\n")
    .trim();
  const hasConversation = rows.some((row) => row.speaker === "AGENT" || row.speaker === "CONTACT");

  return {
    transcriptText,
    lineCount: rows.length,
    hasConversation,
  };
}

type SaveExtractedFindingInput = {
  callId: string;
  transcriptText: string;
  extracted: ExtractedFindingResult;
};

export async function saveExtractedFinding(input: SaveExtractedFindingInput) {
  await db.extractedFinding.upsert({
    where: {
      callId: input.callId,
    },
    create: {
      callId: input.callId,
      monthlyPrice: input.extracted.monthlyPrice,
      locationFit: input.extracted.locationFit,
      availability: input.extracted.availability,
      rules: input.extracted.rules,
      confidence: input.extracted.confidence,
      summary: input.extracted.summary,
      raw: {
        transcript: input.transcriptText,
        extraction: input.extracted,
      },
    },
    update: {
      monthlyPrice: input.extracted.monthlyPrice,
      locationFit: input.extracted.locationFit,
      availability: input.extracted.availability,
      rules: input.extracted.rules,
      confidence: input.extracted.confidence,
      summary: input.extracted.summary,
      raw: {
        transcript: input.transcriptText,
        extraction: input.extracted,
      },
    },
  });

  await db.call.update({
    where: { id: input.callId },
    data: {
      score: input.extracted.score,
    },
  });
}
