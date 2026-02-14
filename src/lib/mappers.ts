import {
  type Call,
  CallStatus,
  type Contact,
  type TranscriptEvent,
  InvestigationStatus,
  TranscriptSpeaker,
} from "@prisma/client";

import type {
  CallProgressItem,
  InvestigationStatus as InvestigationStatusLabel,
  PreferredLanguage as PreferredLanguageLabel,
  TranscriptLine,
  TranscriptSpeaker as TranscriptSpeakerLabel,
} from "@/lib/domain";

export function toDbLanguage(value: PreferredLanguageLabel): string {
  return normalizeLanguage(value);
}

export function fromDbLanguage(value: string | null | undefined): PreferredLanguageLabel {
  return normalizeLanguage(value);
}

export function toDbCallStatus(value: CallProgressItem["status"]): CallStatus {
  return value.toUpperCase() as CallStatus;
}

export function fromDbCallStatus(value: CallStatus): CallProgressItem["status"] {
  return value.toLowerCase() as CallProgressItem["status"];
}

export function toDbInvestigationStatus(value: InvestigationStatusLabel): InvestigationStatus {
  return value.toUpperCase() as InvestigationStatus;
}

export function fromDbInvestigationStatus(value: InvestigationStatus): InvestigationStatusLabel {
  return value.toLowerCase() as InvestigationStatusLabel;
}

export function fromDbTranscriptSpeaker(value: TranscriptSpeaker): TranscriptSpeakerLabel {
  return value.toLowerCase() as TranscriptSpeakerLabel;
}

export function toDbTranscriptSpeaker(value: TranscriptSpeakerLabel): TranscriptSpeaker {
  return value.toUpperCase() as TranscriptSpeaker;
}

type CallWithContact = Pick<Call, "id" | "status" | "score" | "updatedAt" | "failureReason"> & {
  contact: Pick<Contact, "name" | "phone" | "language">;
};

type MapCallToProgressOptions = {
  recordingUrl?: string | null;
};

export function mapCallToProgressItem(
  call: CallWithContact,
  options?: MapCallToProgressOptions,
): CallProgressItem {
  const hasRecordingOption =
    options !== undefined &&
    options !== null &&
    typeof options === "object" &&
    "recordingUrl" in options;

  return {
    id: call.id,
    contactName: call.contact.name,
    phone: call.contact.phone,
    language: fromDbLanguage(call.contact.language),
    status: fromDbCallStatus(call.status),
    score: call.score,
    failureReason: call.failureReason,
    updatedAt: call.updatedAt.toISOString(),
    ...(hasRecordingOption ? { recordingUrl: options.recordingUrl ?? null } : {}),
  };
}

export function mapTranscriptToLine(
  transcript: Pick<TranscriptEvent, "id" | "callId" | "contactName" | "speaker" | "text" | "createdAt">,
): TranscriptLine {
  return {
    id: transcript.id,
    callId: transcript.callId,
    contactName: transcript.contactName,
    speaker: fromDbTranscriptSpeaker(transcript.speaker),
    text: transcript.text,
    createdAt: transcript.createdAt.toISOString(),
  };
}

function normalizeLanguage(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : "english";
}
