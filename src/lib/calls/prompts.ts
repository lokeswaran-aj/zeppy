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

export function buildExtractionPrompt(transcriptText: string, requirement: string) {
  return [
    "Extract structured facts from this call transcript.",
    `Requirement: ${requirement}`,
    "Transcript:",
    transcriptText,
  ].join("\n\n");
}
