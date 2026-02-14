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

  const contacts = mergeAndNormalizeContacts(aiPayload.contacts, regexPhones);
  if (contacts.length === 0) {
    throw new Error("Could not extract valid contact numbers. Include at least one phone number.");
  }

  const questionHints = normalizeStringList([
    ...aiPayload.generalQuestions,
    ...aiPayload.contacts.flatMap((contact) => contact.questions ?? []),
    ...extractQuestionLines(raw),
  ]);

  const requirement = buildRequirementText(aiPayload.requirement, raw, questionHints);

  return {
    requirement,
    contacts,
    questionHints,
  };
}

async function parseWithGemini(rawInput: string, regexPhones: string[]) {
  const { geminiApiKey } = requireGeminiEnv();
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
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

function mergeAndNormalizeContacts(aiContacts: z.infer<typeof aiContactSchema>[], fallbackPhones: string[]) {
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
    contacts.push({
      name: sanitizeName(contact.name) || `Contact ${contacts.length + 1}`,
      phone,
      language: normalizeLanguage(contact.language) ?? "english",
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
    contacts.push({
      name: `Contact ${contacts.length + 1}`,
      phone,
      language: "english",
    });
  }

  return contacts;
}

function buildRequirementText(parsedRequirement: string, rawInput: string, questionHints: string[]) {
  const requirementBase = parsedRequirement.trim().length >= 6 ? parsedRequirement.trim() : fallbackRequirement(rawInput);
  if (questionHints.length === 0) {
    return requirementBase;
  }

  const topQuestions = questionHints.slice(0, 8);
  return [
    requirementBase,
    "",
    "Priority questions user wants answered:",
    ...topQuestions.map((question, index) => `${index + 1}. ${question}`),
  ].join("\n");
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
  if (language.includes("hindi") || language === "hi") {
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
