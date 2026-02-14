import type { PreferredLanguage } from "@/lib/domain";

const LANGUAGE_LABELS: Record<PreferredLanguage, string> = {
  english: "English",
  hindi: "Hindi",
  kannada: "Kannada",
  tamil: "Tamil",
};

export function getLanguageLabel(language: PreferredLanguage) {
  return LANGUAGE_LABELS[language];
}

export type RealtimeCallPromptInput = {
  requirement: string;
  language: PreferredLanguage;
  contactName: string;
};

export function buildRealtimeInstructions(input: RealtimeCallPromptInput) {
  const language = capitalize(input.language);
  return [
    "You are CallAgent, an outbound phone investigation assistant.",
    `Speak naturally in ${language}.`,
    `You are speaking with ${input.contactName}.`,
    `Requirement to investigate: "${input.requirement}".`,
    `In your first turn, greet ${input.contactName} by name and mention you are calling regarding this requirement.`,
    "Do not frame the requirement as your own need, and do not ask whether the callee personally needs it.",
    "Treat the callee as an information source/provider who can share details relevant to the requirement.",
    "Ask short, clear follow-up questions to gather requirement-specific facts such as pricing/cost, timelines/availability, fit/constraints, and next actions.",
    "Adapt to the requirement domain; avoid assumptions tied to any single use case (for example, housing-only assumptions).",
    "Keep the conversation concise, natural, and practical.",
  ].join(" ");
}

export function buildRealtimeFirstReplyInstructions(input: RealtimeCallPromptInput) {
  return [
    `Introduce yourself briefly and greet ${input.contactName} by name.`,
    "Mention the requirement context in one sentence.",
    "Ask 1-2 focused questions to begin information gathering.",
    "Do not ask whether they personally need the requirement.",
  ].join(" ");
}

export function buildConversationSystemPrompt(language: PreferredLanguage) {
  const languageLabel = getLanguageLabel(language);
  return [
    `You are CallAgent, a phone investigation assistant speaking in ${languageLabel}.`,
    "Generate a concise, realistic call transcript that investigates the user's requirement.",
    "Do not assume the contact personally needs the requirement; treat them as an information source.",
    "Use exactly these speaker labels at line starts: AGENT: and CONTACT:.",
    "Include concrete, requirement-specific details (for example: cost/pricing, availability/timeline, scope/location, constraints/rules, and next follow-up).",
    "Return between 8 and 14 lines total. Do not use markdown.",
  ].join(" ");
}

type BuildConversationUserPromptInput = {
  requirement: string;
  contactName: string;
  contactPhone: string;
  language: PreferredLanguage;
};

export function buildConversationUserPrompt(input: BuildConversationUserPromptInput) {
  return [
    `Requirement: ${input.requirement}`,
    `Contact: ${input.contactName} (${input.contactPhone})`,
    `Language: ${getLanguageLabel(input.language)}`,
    `Address the contact by name (${input.contactName}) and investigate the requirement without assuming they personally need it.`,
    "Simulate one realistic outbound investigation call and provide only dialogue lines with AGENT/CONTACT prefixes.",
  ].join("\n");
}

type BuildIntakeParserPromptInput = {
  rawInput: string;
  regexPhones: string[];
};

export function buildIntakeParserPrompt(input: BuildIntakeParserPromptInput) {
  return [
    "You are extracting structured fields for an outbound phone investigation workflow.",
    "Return strict JSON only.",
    "Interpret user text into:",
    "- requirement: the main inquiry objective",
    "- contacts: each with name, phone, optional language guess, optional notes, optional contact-level questions",
    "- generalQuestions: user questions not tied to a specific contact",
    "Rules:",
    "- Keep every real contact phone number you can find.",
    "- If language is not explicit, guess only when confidence is high, otherwise set null.",
    "- Do not invent phone numbers.",
    "- Keep requirement concise and actionable.",
    "",
    "Raw user input:",
    input.rawInput,
    "",
    `Phone candidates detected by regex: ${input.regexPhones.join(", ") || "none"}`,
  ].join("\n");
}

export const intakeParserResponseSchema = {
  type: "object",
  properties: {
    requirement: { type: "string" },
    generalQuestions: {
      type: "array",
      items: { type: "string" },
    },
    contacts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", nullable: true },
          phone: { type: "string" },
          language: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          questions: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["name", "phone", "language", "notes", "questions"],
      },
    },
  },
  required: ["requirement", "generalQuestions", "contacts"],
} as const;

export function buildExtractionPrompt(transcriptText: string, requirement: string) {
  return [
    "Extract structured findings from this call transcript for any use case/domain.",
    `Requirement: ${requirement}`,
    "Return values that help compare options and decide next actions.",
    "Use null when a field is not applicable.",
    "Transcript:",
    transcriptText,
  ].join("\n\n");
}

export const extractionResponseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    priceEstimate: { type: "number", nullable: true },
    availability: { type: "string", nullable: true },
    fitSummary: { type: "string", nullable: true },
    constraints: {
      type: "array",
      items: { type: "string" },
    },
    keyFacts: {
      type: "array",
      items: { type: "string" },
    },
    confidence: { type: "number" },
    score: { type: "number" },
    actionItems: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "summary",
    "priceEstimate",
    "availability",
    "fitSummary",
    "constraints",
    "keyFacts",
    "confidence",
    "score",
    "actionItems",
  ],
} as const;

function capitalize(value: string) {
  if (!value) {
    return value;
  }
  return value[0]?.toUpperCase() + value.slice(1).toLowerCase();
}
