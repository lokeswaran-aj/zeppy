import type { CallProgressItem, PreferredLanguage, TranscriptSpeaker } from "@/lib/domain";
import { getAgentConfig } from "@/lib/env";
import { logger, maskPhone } from "@/lib/logger";

import { dispatchVoiceAgent } from "./agent-dispatch";
import { extractStructuredFinding } from "./extract";
import type { GeminiCallOutput } from "./gemini-live";
import {
  assertTelephonyConfig,
  buildCallRoomName,
  dialContactViaLiveKit,
  hangupLiveKitParticipant,
  waitForSipParticipantExit,
} from "./livekit";
import { finalizeLiveKitRoomRecording, startLiveKitRoomRecording } from "./recording";
import { getCallTranscriptSnapshot } from "./state";

export type ExecuteCallInput = {
  investigationId: string;
  callId: string;
  requirement: string;
  contact: {
    name: string;
    phone: string;
    language: PreferredLanguage;
  };
  onStatus: (
    status: Exclude<CallProgressItem["status"], "queued" | "analyzing" | "completed" | "failed">,
    details?: {
      livekitRoomName?: string;
      livekitParticipant?: string;
      livekitSipCallId?: string;
    },
  ) => Promise<void>;
  onTranscript: (speaker: TranscriptSpeaker, text: string) => Promise<void>;
  onRecordingReady?: (recordingUrl: string) => Promise<void>;
};

export async function executeInvestigationCall(input: ExecuteCallInput): Promise<GeminiCallOutput> {
  logger.info("call.runner.start", {
    investigationId: input.investigationId,
    callId: input.callId,
    contactName: input.contact.name,
    to: maskPhone(input.contact.phone),
    language: input.contact.language,
  });
  assertTelephonyConfig();
  const roomName = buildCallRoomName(input.investigationId, input.callId);

  await dispatchVoiceAgent({
    roomName,
    metadata: {
      investigationId: input.investigationId,
      callId: input.callId,
      requirement: input.requirement,
      language: input.contact.language,
      contactName: input.contact.name,
      contactPhone: input.contact.phone,
    },
  });

  await input.onStatus("ringing");

  const dialResult = await dialContactViaLiveKit({
    investigationId: input.investigationId,
    callId: input.callId,
    phoneNumber: input.contact.phone,
    participantName: input.contact.name,
    roomName,
  });

  await input.onStatus("connected", {
    livekitRoomName: dialResult.roomName,
    livekitParticipant: dialResult.participantIdentity,
    livekitSipCallId: dialResult.sipCallId,
  });
  logger.info("call.runner.connected", {
    investigationId: input.investigationId,
    callId: input.callId,
    roomName: dialResult.roomName,
    participantIdentity: dialResult.participantIdentity,
    sipCallId: dialResult.sipCallId,
  });

  await input.onTranscript(
    "system",
    `Call connected to ${input.contact.name}. Voice agent started.`,
  );

  const egressId = await startLiveKitRoomRecording({
    investigationId: input.investigationId,
    callId: input.callId,
    roomName: dialResult.roomName,
  });

  const { callSessionTimeoutSeconds } = getAgentConfig();
  const waitResult = await waitForSipParticipantExit({
    roomName: dialResult.roomName,
    participantIdentity: dialResult.participantIdentity,
    timeoutSeconds: callSessionTimeoutSeconds,
  });
  logger.info("call.runner.wait.completed", {
    investigationId: input.investigationId,
    callId: input.callId,
    waitResult,
    timeoutSeconds: callSessionTimeoutSeconds,
  });

  if (waitResult === "timeout") {
    await input.onTranscript(
      "system",
      "Call hit session timeout. Ending the call to keep workflow moving.",
    );
    await hangupLiveKitParticipant(dialResult.roomName, dialResult.participantIdentity);
  }

  const recordingUrl = await finalizeLiveKitRoomRecording({
    investigationId: input.investigationId,
    callId: input.callId,
    roomName: dialResult.roomName,
    egressId,
  });
  if (recordingUrl) {
    await input.onRecordingReady?.(recordingUrl);
    await input.onTranscript("system", "Call recording is available.");
  } else {
    await input.onTranscript(
      "system",
      "Call recording is unavailable for this call.",
    );
  }

  const transcriptText = await waitForConversationTranscript(input.callId, 12);
  if (!transcriptText) {
    throw new Error(
      "No transcript captured from the live call. Ensure `npm run dev:agent` is running and the agent is dispatched.",
    );
  }

  logger.info("call.runner.transcript.captured", {
    investigationId: input.investigationId,
    callId: input.callId,
    transcriptLength: transcriptText.length,
  });

  const extracted = await extractStructuredFinding({
    requirement: input.requirement,
    transcriptText,
  });

  logger.info("call.runner.extraction.completed", {
    investigationId: input.investigationId,
    callId: input.callId,
    score: extracted.score,
    confidence: extracted.confidence,
  });

  logger.info("call.runner.finish", {
    investigationId: input.investigationId,
    callId: input.callId,
  });
  return {
    transcriptText,
    extracted,
  };
}

async function waitForConversationTranscript(callId: string, maxSeconds: number) {
  const attempts = Math.max(1, Math.floor(maxSeconds));
  for (let i = 0; i < attempts; i += 1) {
    const snapshot = await getCallTranscriptSnapshot(callId);
    if (snapshot.hasConversation && snapshot.transcriptText.trim().length > 0) {
      return snapshot.transcriptText;
    }
    await sleep(1000);
  }
  return "";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
