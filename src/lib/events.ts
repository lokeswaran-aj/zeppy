import type {
  ActionItem,
  CallProgressItem,
  InvestigationStatus,
  RecommendationItem,
  TranscriptLine,
} from "@/lib/domain";

export type InvestigationSnapshotEvent = {
  type: "investigation.snapshot";
  investigationId: string;
  status: InvestigationStatus;
  requirement: string;
  calls: CallProgressItem[];
  transcripts: TranscriptLine[];
};

export type CallStatusEvent = {
  type: "call.status";
  investigationId: string;
  call: CallProgressItem;
};

export type TranscriptEvent = {
  type: "call.transcript";
  investigationId: string;
  transcript: TranscriptLine;
};

export type InvestigationCompletedEvent = {
  type: "investigation.completed";
  investigationId: string;
};

export type InvestigationFailedEvent = {
  type: "investigation.failed";
  investigationId: string;
  reason: string;
};

export type SSEEventPayload =
  | InvestigationSnapshotEvent
  | CallStatusEvent
  | TranscriptEvent
  | InvestigationCompletedEvent
  | InvestigationFailedEvent;

export type InvestigationResultsResponse = {
  investigationId: string;
  requirement: string;
  status: InvestigationStatus;
  bestCallId: string | null;
  recommendationSummary: string;
  ranked: RecommendationItem[];
  actionItems: ActionItem[];
};
