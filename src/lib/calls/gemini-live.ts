import { GoogleGenAI, Modality } from "@google/genai";

import type { PreferredLanguage, TranscriptSpeaker } from "@/lib/domain";
import { requireGeminiEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

import { extractStructuredFinding, type ExtractedFindingResult } from "./extract";
import { buildConversationSystemPrompt, buildConversationUserPrompt } from "./prompts";

type RunGeminiCallInput = {
  requirement: string;
  language: PreferredLanguage;
  contactName: string;
  contactPhone: string;
  onTranscript: (speaker: TranscriptSpeaker, text: string) => Promise<void>;
};

export type GeminiCallOutput = {
  transcriptText: string;
  extracted: ExtractedFindingResult;
};

type ParsedLine = {
  speaker: TranscriptSpeaker;
  text: string;
};

export async function runGeminiCall(input: RunGeminiCallInput): Promise<GeminiCallOutput> {
  logger.info("gemini.live.start", {
    contactName: input.contactName,
    language: input.language,
  });
  const { geminiApiKey } = requireGeminiEnv();
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  let transcriptText = "";
  let resolveDone: (() => void) | null = null;
  let rejectDone: ((error: Error) => void) | null = null;

  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = (error: Error) => reject(error);
  });

  const session = await ai.live.connect({
    model: "gemini-live-2.5-flash-preview",
    config: {
      responseModalities: [Modality.TEXT, Modality.AUDIO],
      temperature: 0.4,
      systemInstruction: buildConversationSystemPrompt(input.language),
    },
    callbacks: {
      onopen: () => {
        logger.info("gemini.live.connected", {
          contactName: input.contactName,
        });
      },
      onmessage: (message) => {
        const next = message.text;
        if (next) {
          // The SDK can emit either incremental or cumulative text fragments.
          // This keeps the latest complete transcript while preserving deltas.
          if (next.startsWith(transcriptText)) {
            transcriptText = next;
          } else {
            transcriptText += next;
          }
        }

        logger.debug("gemini.live.message", {
          hasText: Boolean(next),
          textLength: next?.length ?? 0,
          turnComplete: Boolean(message.serverContent?.turnComplete),
          generationComplete: Boolean(message.serverContent?.generationComplete),
        });

        if (message.serverContent?.turnComplete || message.serverContent?.generationComplete) {
          resolveDone?.();
        }
      },
      onerror: (event) => {
        logger.error("gemini.live.error", {
          error:
            event.error instanceof Error ? event.error.message : "Unknown Gemini live session error",
        });
        rejectDone?.(
          event.error instanceof Error ? event.error : new Error("Gemini Live session failed."),
        );
      },
      onclose: () => {
        logger.info("gemini.live.closed", {
          contactName: input.contactName,
        });
        resolveDone?.();
      },
    },
  });

  session.sendClientContent({
    turns: [
      {
        role: "user",
        parts: [
          {
            text: buildConversationUserPrompt({
              requirement: input.requirement,
              contactName: input.contactName,
              contactPhone: input.contactPhone,
              language: input.language,
            }),
          },
        ],
      },
    ],
    turnComplete: true,
  });

  await withTimeout(done, 45_000, "Timed out waiting for Gemini Live response.");
  logger.info("gemini.live.turn.completed", {
    contactName: input.contactName,
    transcriptLength: transcriptText.length,
  });
  session.close();

  const parsedLines = parseTranscriptLines(transcriptText);
  logger.info("gemini.live.transcript.parsed", {
    contactName: input.contactName,
    lines: parsedLines.length,
  });
  for (const line of parsedLines) {
    await input.onTranscript(line.speaker, line.text);
  }

  const normalizedTranscript = parsedLines
    .map((line) => `${line.speaker.toUpperCase()}: ${line.text}`)
    .join("\n");

  const extracted = await extractStructuredFinding({
    requirement: input.requirement,
    transcriptText: normalizedTranscript,
  });
  logger.info("gemini.live.extraction.completed", {
    contactName: input.contactName,
    score: extracted.score,
    confidence: extracted.confidence,
  });

  return {
    transcriptText: normalizedTranscript,
    extracted,
  };
}

function parseTranscriptLines(rawTranscript: string): ParsedLine[] {
  const rows = rawTranscript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedLine[] = [];
  for (const row of rows) {
    const clean = row.replace(/^[0-9]+[.)]\s*/, "");
    const upper = clean.toUpperCase();

    if (upper.startsWith("AGENT:")) {
      parsed.push({ speaker: "agent", text: clean.slice("AGENT:".length).trim() });
      continue;
    }

    if (upper.startsWith("CONTACT:")) {
      parsed.push({ speaker: "contact", text: clean.slice("CONTACT:".length).trim() });
      continue;
    }

    parsed.push({ speaker: "system", text: clean });
  }

  if (parsed.length === 0 && rawTranscript.trim()) {
    parsed.push({ speaker: "system", text: rawTranscript.trim() });
  }

  return parsed;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
