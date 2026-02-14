import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { requireGeminiEnv } from "@/lib/env";

import { buildExtractionPrompt, extractionResponseSchema } from "./prompts";

const extractionPayloadSchema = z.object({
  summary: z.string(),
  priceEstimate: z.number().nullable(),
  availability: z.string().nullable(),
  fitSummary: z.string().nullable(),
  constraints: z.array(z.string()),
  keyFacts: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  score: z.number().min(0).max(100),
  actionItems: z.array(z.string()),
});

export const extractedFindingSchema = extractionPayloadSchema.transform((payload) => ({
  summary: payload.summary,
  monthlyPrice: payload.priceEstimate,
  availability: payload.availability,
  locationFit: payload.fitSummary,
  rules: payload.constraints,
  keyFacts: payload.keyFacts,
  confidence: payload.confidence,
  score: payload.score,
  actionItems: payload.actionItems,
}));

export type ExtractedFindingResult = z.infer<typeof extractedFindingSchema>;

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
