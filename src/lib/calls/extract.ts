import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { requireGeminiEnv } from "@/lib/env";

import { buildExtractionPrompt } from "./prompts";

export const extractedFindingSchema = z.object({
  summary: z.string(),
  monthlyPrice: z.number().nullable(),
  availability: z.string().nullable(),
  locationFit: z.string().nullable(),
  rules: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  score: z.number().min(0).max(100),
  actionItems: z.array(z.string()),
});

export type ExtractedFindingResult = z.infer<typeof extractedFindingSchema>;

const extractionResponseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    monthlyPrice: { type: "number", nullable: true },
    availability: { type: "string", nullable: true },
    locationFit: { type: "string", nullable: true },
    rules: {
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
    "monthlyPrice",
    "availability",
    "locationFit",
    "rules",
    "confidence",
    "score",
    "actionItems",
  ],
} as const;

type ExtractStructuredFindingInput = {
  requirement: string;
  transcriptText: string;
};

export async function extractStructuredFinding(
  input: ExtractStructuredFindingInput,
): Promise<ExtractedFindingResult> {
  const { geminiApiKey } = requireGeminiEnv();
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: buildExtractionPrompt(input.transcriptText, input.requirement),
    config: {
      responseMimeType: "application/json",
      responseSchema: extractionResponseSchema,
    },
  });

  const payloadText = response.text;
  if (!payloadText) {
    throw new Error("Gemini did not return structured extraction content.");
  }

  const payloadJson = JSON.parse(payloadText) as unknown;
  return extractedFindingSchema.parse(payloadJson);
}
