import type { PreferredLanguage } from "@/lib/domain";

export function getLanguageLabel(language: PreferredLanguage) {
  const cleaned = language.trim();
  if (!cleaned) {
    return "English";
  }

  return cleaned
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export type RealtimeCallPromptInput = {
  requirement: string;
  language: PreferredLanguage;
  contactName: string;
  agentName: string;
};

export function buildRealtimeInstructions(input: RealtimeCallPromptInput) {
  const language = getLanguageLabel(input.language);
  const agentName = normalizeAgentName(input.agentName);
  return [
    `You are ${agentName}, an outbound phone investigation assistant.`,
    `You are speaking with ${input.contactName}.`,
    `Requirement to investigate: "${input.requirement}".`,
    `Start in ${language}.`,
    "If the language signal is unclear, start in English.",
    "If the contact responds in a different language, briefly acknowledge and switch to that language, then continue in that language for the rest of the call.",
    "For Tamil conversations, use natural spoken Tamil with common everyday English words where people normally mix them. Avoid overly pure or literary Tamil.",
    "If the requirement text includes a section like 'Priority questions user wants answered:' with numbered items, treat those as high-priority questions and cover them naturally during the call.",
    "Treat this as a generic investigation workflow across any domain (travel, rentals, PGs, vendors, hiring candidates, services, etc.).",
    `In your first turn, introduce yourself as ${agentName}, greet ${input.contactName} by name, and mention you are calling regarding this requirement.`,
    "Do not frame the requirement as your own need, and do not ask whether the callee personally needs it.",
    "Treat the callee as an information source/provider who can share details relevant to the requirement.",
    "Ask short, clear follow-up questions to gather requirement-specific facts such as pricing/cost, timelines/availability, fit/constraints, process steps, and next actions.",
    "Use any intake-generated question hints and contact-specific questions embedded in the requirement context as part of your questioning plan.",
    "Adapt to the requirement domain; avoid assumptions tied to any single use case (for example, housing-only assumptions).",
    "Time-box the call to about 60 seconds.",
    "Keep question count low: ask at most 3 primary questions total, and only 1 brief clarification when truly required.",
    "Prioritize highest-value unanswered questions first and skip anything already answered.",
    "Maintain a mental checklist and try to get at least one concrete answer for each important question before ending.",
    "End promptly with a short recap and next step once key answers are captured.",
    "Keep the conversation concise, natural, and practical.",
  ].join(" ");
}

export function buildRealtimeFirstReplyInstructions(input: RealtimeCallPromptInput) {
  const language = getLanguageLabel(input.language);
  const agentName = normalizeAgentName(input.agentName);
  return [
    `Introduce yourself briefly as ${agentName} and greet ${input.contactName} by name in ${language}.`,
    "Mention the requirement context in one sentence.",
    "Ask 1 focused question to begin information gathering (2 only if both are critical), prioritizing user-provided question hints when present.",
    "If the contact replies in a different language, confirm and switch to that language from the next turn.",
    "If speaking Tamil, keep it conversational with natural English words as people use in daily speech.",
    "Do not ask whether they personally need the requirement.",
  ].join(" ");
}

export function buildConversationSystemPrompt(language: PreferredLanguage) {
  const languageLabel = getLanguageLabel(language);
  return [
    `You are a phone investigation assistant speaking in ${languageLabel}.`,
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
    "You are a generic intake parser for outbound investigation workflows.",
    "The user can ask to investigate any domain (for example travel agencies, rentals, PGs, vendors, hiring candidates, or service providers).",
    "Return strict JSON only with keys: requirement, generalQuestions, contacts.",
    "Interpret user text into a concise, actionable requirement and structured contact plan.",
    "For each contact include:",
    "- name: string or null",
    "- phone: string",
    "- language: likely spoken language as a free-text string (for example english, hindi, marathi, telugu, tamil, kannada) or null",
    "- languageReason: short reason for language choice (especially when guessed from context)",
    "- locationHint: city/area/state if present, else null",
    "- notes: useful contact-specific details, else null",
    "- questions: contact-specific questions to ask on call",
    "Question rules:",
    "- Put broad/common questions in generalQuestions.",
    "- Put contact-specific questions in that contact's questions.",
    "Language rules (India-focused):",
    "- If explicit language is present, use it.",
    "- Otherwise infer from location/context when reasonably confident (for example Bengaluru/Karnataka -> kannada, Chennai/Tamil Nadu -> tamil, Hyderabad/Telangana -> telugu, Kolkata/West Bengal -> bengali).",
    "- If not confident, set language to null. Downstream parser will default null to english.",
    "Rules:",
    "- Keep every real contact phone number you can find.",
    "- Do not invent phone numbers.",
    "- Use the regex-detected phone candidates when useful.",
    "- Keep requirement domain-agnostic and practical.",
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
          languageReason: { type: "string", nullable: true },
          locationHint: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          questions: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["name", "phone", "language", "languageReason", "locationHint", "notes", "questions"],
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

function normalizeAgentName(value: string) {
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : "assistant";
}
