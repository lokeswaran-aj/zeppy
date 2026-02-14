import {
  type Call,
  CallStatus,
  type Contact,
  type TranscriptEvent,
  InvestigationStatus,
  PreferredLanguage,
  TranscriptSpeaker,
} from "@prisma/client";

import type {
  CallProgressItem,
  InvestigationStatus as InvestigationStatusLabel,
  PreferredLanguage as PreferredLanguageLabel,
  TranscriptLine,
  TranscriptSpeaker as TranscriptSpeakerLabel,
} from "@/lib/domain";

export function toDbLanguage(value: PreferredLanguageLabel): PreferredLanguage {
  return value.toUpperCase() as PreferredLanguage;
}

export function fromDbLanguage(value: PreferredLanguage): PreferredLanguageLabel {
  return value.toLowerCase() as PreferredLanguageLabel;
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

export function mapCallToProgressItem(call: CallWithContact): CallProgressItem {
  return {
    id: call.id,
    contactName: call.contact.name,
    phone: call.contact.phone,
    language: fromDbLanguage(call.contact.language),
    status: fromDbCallStatus(call.status),
    score: call.score,
    failureReason: call.failureReason,
    updatedAt: call.updatedAt.toISOString(),
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
