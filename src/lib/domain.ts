export type PreferredLanguage = "kannada" | "tamil" | "hindi" | "english";

export const PREFERRED_LANGUAGES: Array<{
  value: PreferredLanguage;
  label: string;
}> = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "kannada", label: "Kannada" },
  { value: "tamil", label: "Tamil" },
];

export type ContactInput = {
  name: string;
  phone: string;
  language: PreferredLanguage;
};

export type CallStatus =
  | "queued"
  | "dialing"
  | "ringing"
  | "connected"
  | "analyzing"
  | "completed"
  | "failed";

export type InvestigationStatus =
  | "draft"
  | "running"
  | "completed"
  | "failed";

export type TranscriptSpeaker = "agent" | "contact" | "system";

export type TranscriptLine = {
  id: string;
  callId: string;
  contactName: string;
  speaker: TranscriptSpeaker;
  text: string;
  createdAt: string;
};

export type CallProgressItem = {
  id: string;
  contactName: string;
  phone: string;
  language: PreferredLanguage;
  status: CallStatus;
  score?: number | null;
  updatedAt?: string;
  failureReason?: string | null;
};

export type RecommendationItem = {
  callId: string;
  contactName: string;
  phone: string;
  score: number;
  summary: string;
  monthlyPrice?: number | null;
  availability?: string | null;
  locationFit?: string | null;
};

export type ActionItem = {
  id: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};
