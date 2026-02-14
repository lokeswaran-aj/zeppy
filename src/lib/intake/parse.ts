import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import type { PreferredLanguage } from "@/lib/domain";
import { requireGeminiEnv } from "@/lib/env";
import {
  buildIntakeParserPrompt,
  intakeParserResponseSchema,
} from "@/lib/calls/prompts";

type ParsedContact = {
  name: string;
  phone: string;
  language: PreferredLanguage;
  locationHint?: string | null;
  languageReason?: string | null;
  notes?: string | null;
  questions?: string[];
};

export type ParsedInvestigationInput = {
  requirement: string;
  contacts: ParsedContact[];
  questionHints: string[];
};

const aiContactSchema = z.object({
  name: z.string().nullable().optional(),
  phone: z.string(),
  language: z.string().nullable().optional(),
  languageReason: z.string().nullable().optional(),
  locationHint: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  questions: z.array(z.string()).optional().default([]),
});

const aiIntakeSchema = z.object({
  requirement: z.string(),
  generalQuestions: z.array(z.string()).optional().default([]),
  contacts: z.array(aiContactSchema).default([]),
});

export async function parseInvestigationInputText(inputText: string): Promise<ParsedInvestigationInput> {
  const raw = inputText.trim();
  if (raw.length < 12) {
    throw new Error("Please provide more details including requirement and contact numbers.");
  }

  const regexPhones = extractPhoneCandidates(raw);
  const aiPayload = await parseWithGemini(raw, regexPhones);

  const contacts = mergeAndNormalizeContacts(aiPayload.contacts, regexPhones, raw);
  if (contacts.length === 0) {
    throw new Error("Could not extract valid contact numbers. Include at least one phone number.");
  }

  const questionHints = normalizeStringList([
    ...aiPayload.generalQuestions,
    ...aiPayload.contacts.flatMap((contact) => contact.questions ?? []),
    ...extractQuestionLines(raw),
  ]);

  const requirement = aiPayload.requirement.trim().length >= 6
    ? aiPayload.requirement.trim()
    : fallbackRequirement(raw);

  return {
    requirement,
    contacts,
    questionHints,
  };
}

async function parseWithGemini(rawInput: string, regexPhones: string[]) {
  const { geminiApiKey, geminiIntakeModel } = requireGeminiEnv();
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const response = await ai.models.generateContent({
    model: geminiIntakeModel,
    contents: buildIntakeParserPrompt({
      rawInput,
      regexPhones,
    }),
    config: {
      responseMimeType: "application/json",
      responseSchema: intakeParserResponseSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini could not parse the input text.");
  }

  const payload = JSON.parse(text) as unknown;
  return aiIntakeSchema.parse(payload);
}

function mergeAndNormalizeContacts(
  aiContacts: z.infer<typeof aiContactSchema>[],
  fallbackPhones: string[],
  rawInput: string,
) {
  const contacts: ParsedContact[] = [];
  const seen = new Set<string>();

  for (const contact of aiContacts) {
    const phone = normalizePhone(contact.phone);
    if (!isValidPhone(phone)) {
      continue;
    }
    if (seen.has(phone)) {
      continue;
    }

    seen.add(phone);
    const locationHint = sanitizeOptionalText(contact.locationHint, 120);
    const notes = sanitizeOptionalText(contact.notes, 240);
    const explicitLanguage = normalizeLanguage(contact.language);
    const inferred = explicitLanguage
      ? { language: null, reason: null as string | null }
      : guessLanguageFromIndianContext(`${locationHint ?? ""}\n${notes ?? ""}`);
    const languageReason = sanitizeOptionalText(contact.languageReason, 180)
      ?? (explicitLanguage
        ? "Language explicitly mentioned in input."
        : inferred.reason ?? "No confident regional signal; defaulted to english.");

    contacts.push({
      name: sanitizeName(contact.name) || `Contact ${contacts.length + 1}`,
      phone,
      language: explicitLanguage ?? inferred.language ?? "english",
      locationHint,
      languageReason,
      notes,
      questions: normalizeStringList(contact.questions ?? []),
    });
  }

  for (const phoneCandidate of fallbackPhones) {
    const phone = normalizePhone(phoneCandidate);
    if (!isValidPhone(phone)) {
      continue;
    }
    if (seen.has(phone)) {
      continue;
    }

    seen.add(phone);
    const context = findPhoneContext(rawInput, phoneCandidate);
    const inferred = guessLanguageFromIndianContext(context || rawInput);
    contacts.push({
      name: `Contact ${contacts.length + 1}`,
      phone,
      language: inferred.language ?? "english",
      locationHint: null,
      languageReason: inferred.reason ?? "No confident regional signal; defaulted to english.",
      notes: sanitizeOptionalText(context, 240),
      questions: [],
    });
  }

  return contacts;
}

function fallbackRequirement(rawInput: string) {
  const compact = rawInput.replace(/\s+/g, " ").trim();
  if (compact.length <= 200) {
    return compact;
  }
  return compact.slice(0, 197).trimEnd() + "...";
}

function normalizeStringList(values: string[]) {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const value of values) {
    const text = value.trim();
    if (!text) {
      continue;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    cleaned.push(text);
  }

  return cleaned;
}

function extractPhoneCandidates(text: string) {
  const matches = text.match(/(?:\+?\d[\d\s().-]{6,}\d)/g) ?? [];
  return normalizeStringList(matches.map(normalizePhone).filter(isValidPhone));
}

function extractQuestionLines(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const questionish = lines.filter((line) => line.includes("?") || /\bask\b|\bquestion\b|\binquire\b/i.test(line));
  return questionish.map((line) => line.replace(/^[\-\d.)\s]+/, "").trim()).filter(Boolean);
}

function sanitizeName(name: string | null | undefined) {
  const cleaned = name?.trim() ?? "";
  if (!cleaned) {
    return "";
  }
  if (cleaned.length > 100) {
    return cleaned.slice(0, 100).trim();
  }
  return cleaned;
}

function sanitizeOptionalText(value: string | null | undefined, maxLength: number) {
  const cleaned = value?.trim();
  if (!cleaned) {
    return null;
  }
  if (cleaned.length > maxLength) {
    return `${cleaned.slice(0, maxLength - 3).trimEnd()}...`;
  }
  return cleaned;
}

function findPhoneContext(rawInput: string, phoneCandidate: string) {
  const targetDigits = normalizePhone(phoneCandidate).replace(/\D/g, "");
  if (!targetDigits) {
    return "";
  }

  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const shortTarget = targetDigits.length > 10 ? targetDigits.slice(-10) : targetDigits;
  for (const line of lines) {
    const lineDigits = line.replace(/\D/g, "");
    if (!lineDigits) {
      continue;
    }
    if (lineDigits.includes(shortTarget)) {
      return line;
    }
  }

  return "";
}

type LanguageGuess = {
  language: PreferredLanguage | null;
  reason: string | null;
};

const INDIAN_LOCATION_LANGUAGE_HINTS: Array<{
  language: PreferredLanguage;
  reason: string;
  pattern: RegExp;
}> = [
  {
    language: "kannada",
    reason: "Location hint suggests Karnataka region, so kannada is likely.",
    pattern:
      /\b(karnataka|bengaluru|bangalore|mysuru|mysore|mangaluru|hubballi|hubli|dharwad|belagavi|udupi|shivamogga)\b/i,
  },
  {
    language: "tamil",
    reason: "Location hint suggests Tamil Nadu region, so tamil is likely.",
    pattern:
      /\b(tamil nadu|chennai|coimbatore|madurai|trichy|tiruchirappalli|salem|erode|vellore|tirunelveli)\b/i,
  },
  {
    language: "hindi",
    reason: "Location hint suggests a Hindi-speaking region.",
    pattern:
      /\b(delhi|new delhi|ncr|noida|gurgaon|gurugram|ghaziabad|faridabad|lucknow|kanpur|jaipur|patna|indore|bhopal|varanasi|agra|uttar pradesh|madhya pradesh|bihar|rajasthan|haryana|jharkhand|uttarakhand|chhattisgarh|himachal|chandigarh)\b/i,
  },
];

function guessLanguageFromIndianContext(text: string | null | undefined): LanguageGuess {
  const source = text?.trim();
  if (!source) {
    return { language: null, reason: null };
  }

  for (const hint of INDIAN_LOCATION_LANGUAGE_HINTS) {
    if (hint.pattern.test(source)) {
      return {
        language: hint.language,
        reason: hint.reason,
      };
    }
  }

  return { language: null, reason: null };
}

function normalizeLanguage(value: string | null | undefined): PreferredLanguage | null {
  const language = value?.trim().toLowerCase();
  if (!language) {
    return null;
  }

  if (language.includes("kannada") || language === "kn") {
    return "kannada";
  }
  if (language.includes("tamil") || language === "ta") {
    return "tamil";
  }
  if (language.includes("hindi") || language === "hi" || language.includes("hinglish")) {
    return "hindi";
  }
  if (language.includes("english") || language === "en") {
    return "english";
  }
  return null;
}

function normalizePhone(raw: string) {
  const value = raw.trim();
  if (!value) {
    return "";
  }

  if (value.startsWith("+")) {
    const digits = value.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  if (digits.startsWith("00") && digits.length > 2) {
    return `+${digits.slice(2)}`;
  }
  if (digits.length === 10) {
    // Default to India when user shares local 10-digit numbers.
    return `+91${digits}`;
  }
  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }
  return digits;
}

function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}
