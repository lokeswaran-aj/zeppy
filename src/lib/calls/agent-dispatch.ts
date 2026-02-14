import { AgentDispatchClient } from "livekit-server-sdk";

import type { PreferredLanguage } from "@/lib/domain";
import { getAgentConfig, requireLiveKitEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

import { toApiHost } from "./livekit";

type DispatchVoiceAgentInput = {
  roomName: string;
  metadata: {
    investigationId: string;
    callId: string;
    requirement: string;
    language: PreferredLanguage;
    contactName: string;
    contactPhone: string;
  };
};

export async function dispatchVoiceAgent(input: DispatchVoiceAgentInput) {
  const livekitEnv = requireLiveKitEnv();
  const { livekitAgentName } = getAgentConfig();
  const host = toApiHost(livekitEnv.livekitUrl);

  const dispatchClient = new AgentDispatchClient(
    host,
    livekitEnv.livekitApiKey,
    livekitEnv.livekitApiSecret,
  );

  logger.info("agent.dispatch.create", {
    roomName: input.roomName,
    agentName: livekitAgentName,
    investigationId: input.metadata.investigationId,
    callId: input.metadata.callId,
  });

  const dispatch = await dispatchClient.createDispatch(input.roomName, livekitAgentName, {
    metadata: JSON.stringify(input.metadata),
  });

  logger.info("agent.dispatch.created", {
    roomName: input.roomName,
    agentName: livekitAgentName,
    dispatchId: dispatch.id,
  });

  return dispatch;
}
