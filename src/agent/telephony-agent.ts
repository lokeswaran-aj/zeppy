import "dotenv/config";

import { fileURLToPath } from "node:url";

import { Modality } from "@google/genai";
import { JobContext, WorkerOptions, cli, defineAgent, voice } from "@livekit/agents";
import * as google from "@livekit/agents-plugin-google";

import type { PreferredLanguage } from "@/lib/domain";
import { getAgentConfig, requireGeminiEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { appendTranscript } from "@/lib/calls/state";
import {
  buildRealtimeFirstReplyInstructions,
  buildRealtimeInstructions,
} from "@/lib/calls/prompts";

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
        instructions: buildRealtimeInstructions({
          contactName: metadata.contactName,
          language: metadata.language,
          requirement: metadata.requirement,
        }),
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
        instructions: buildRealtimeInstructions({
          contactName: metadata.contactName,
          language: metadata.language,
          requirement: metadata.requirement,
        }),
      }),
    });

    await session.generateReply({
      instructions: buildRealtimeFirstReplyInstructions({
        contactName: metadata.contactName,
        language: metadata.language,
        requirement: metadata.requirement,
      }),
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
