import "dotenv/config";

import { fileURLToPath } from "node:url";

import { Modality } from "@google/genai";
import { JobContext, WorkerOptions, cli, defineAgent, voice } from "@livekit/agents";
import * as google from "@livekit/agents-plugin-google";

import type { PreferredLanguage } from "@/lib/domain";
import { getAgentConfig, requireGeminiEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { appendTranscript } from "@/lib/calls/state";

type DispatchMetadata = {
  investigationId: string;
  callId: string;
  requirement: string;
  language: PreferredLanguage;
  contactName: string;
  contactPhone: string;
};

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const metadata = parseDispatchMetadata(ctx.job.metadata);
    logger.info("agent.job.start", {
      investigationId: metadata.investigationId,
      callId: metadata.callId,
      roomName: ctx.room.name,
      contactName: metadata.contactName,
      language: metadata.language,
    });

    await ctx.connect();

    const { geminiApiKey, geminiRealtimeModel, geminiRealtimeVoice } = requireGeminiEnv();
    const session = new voice.AgentSession({
      llm: new google.beta.realtime.RealtimeModel({
        apiKey: geminiApiKey,
        model: geminiRealtimeModel,
        voice: geminiRealtimeVoice,
        // Native audio models reject AUDIO+TEXT response modalities in realtime setup.
        // Keep audio responses and rely on transcription events for persisted text.
        modalities: [Modality.AUDIO],
        instructions: buildRealtimeInstructions(metadata),
        temperature: 0.4,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      }),
    });

    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, async (event) => {
      if (!event.isFinal || !event.transcript.trim()) {
        return;
      }

      logger.debug("agent.event.user_input_transcribed", {
        callId: metadata.callId,
        transcript: event.transcript,
      });

      await appendTranscript({
        callId: metadata.callId,
        speaker: "contact",
        text: event.transcript.trim(),
      }).catch((error) => {
        logger.warn("agent.event.user_input_transcribed.persist_failed", {
          callId: metadata.callId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, async (event) => {
      const item = event.item;
      if (item.role !== "assistant") {
        return;
      }

      const text = item.textContent?.trim();
      if (!text) {
        return;
      }

      logger.debug("agent.event.conversation_item_added", {
        callId: metadata.callId,
        role: item.role,
        text,
      });

      await appendTranscript({
        callId: metadata.callId,
        speaker: "agent",
        text,
      }).catch((error) => {
        logger.warn("agent.event.conversation_item_added.persist_failed", {
          callId: metadata.callId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

    const closePromise = new Promise<void>((resolve) => {
      session.on(voice.AgentSessionEventTypes.Close, (event) => {
        logger.info("agent.session.closed", {
          callId: metadata.callId,
          reason: event.reason,
          error: event.error ? String(event.error) : null,
        });
        resolve();
      });
    });

    session.on(voice.AgentSessionEventTypes.Error, (event) => {
      logger.error("agent.session.error", {
        callId: metadata.callId,
        error: event.error instanceof Error ? event.error.message : String(event.error),
      });
    });

    await session.start({
      room: ctx.room,
      agent: new voice.Agent({
        instructions: buildRealtimeInstructions(metadata),
      }),
    });

    await session.generateReply({
      instructions:
        `Introduce yourself briefly, greet ${metadata.contactName} by name, mention the requirement in one sentence, and ask 1-2 focused questions. Do not ask whether they personally need the requirement.`,
    });

    const { callSessionTimeoutSeconds } = getAgentConfig();
    await Promise.race([closePromise, sleep(callSessionTimeoutSeconds * 1000)]);

    await session.close().catch((error) => {
      logger.warn("agent.session.close_failed", {
        callId: metadata.callId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    logger.info("agent.job.finish", {
      callId: metadata.callId,
      investigationId: metadata.investigationId,
    });
    ctx.shutdown("completed");
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { livekitAgentName } = getAgentConfig();
  cli.runApp(
    new WorkerOptions({
      agent: fileURLToPath(import.meta.url),
      agentName: livekitAgentName,
    }),
  );
}

function parseDispatchMetadata(raw: string): DispatchMetadata {
  try {
    const parsed = JSON.parse(raw) as Partial<DispatchMetadata>;
    if (
      !parsed.callId ||
      !parsed.investigationId ||
      !parsed.requirement ||
      !parsed.language ||
      !parsed.contactName ||
      !parsed.contactPhone
    ) {
      throw new Error("Dispatch metadata is missing required fields.");
    }

    return {
      callId: parsed.callId,
      investigationId: parsed.investigationId,
      requirement: parsed.requirement,
      language: parsed.language,
      contactName: parsed.contactName,
      contactPhone: parsed.contactPhone,
    };
  } catch (error) {
    throw new Error(
      `Invalid agent dispatch metadata: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function buildRealtimeInstructions(metadata: DispatchMetadata) {
  const language = capitalize(metadata.language);
  return [
    "You are CallAgent, an outbound phone investigation assistant.",
    `Speak naturally in ${language}.`,
    `You are speaking with ${metadata.contactName}.`,
    `Requirement to investigate: "${metadata.requirement}".`,
    `In your first turn, greet ${metadata.contactName} by name and mention you are calling regarding this requirement.`,
    "Do not frame the requirement as your own need, and do not ask whether the callee personally needs it.",
    "Treat the callee as an information source/provider who can share details relevant to the requirement.",
    "Ask short, clear follow-up questions to gather requirement-specific facts such as cost/pricing, availability/timeline, location/context, relevant features/constraints, and next steps.",
    "Adapt to the requirement domain; if it is not about housing, avoid housing-specific assumptions.",
    "Keep the conversation concise, natural, and practical.",
  ].join(" ");
}

function capitalize(value: string) {
  if (!value) {
    return value;
  }
  return value[0]?.toUpperCase() + value.slice(1).toLowerCase();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
