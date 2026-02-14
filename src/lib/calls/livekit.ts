import { RoomServiceClient, SipClient } from "livekit-server-sdk";
import { SIPMediaEncryption, SIPTransport } from "@livekit/protocol";

import { requireLiveKitEnv, requireTwilioEnv } from "@/lib/env";
import { logger, maskPhone } from "@/lib/logger";

type DialContactInput = {
  investigationId: string;
  callId: string;
  phoneNumber: string;
  participantName: string;
  roomName?: string;
};

export type DialContactResult = {
  roomName: string;
  participantIdentity: string;
  participantId: string;
  sipCallId: string;
};

export function toApiHost(url: string) {
  if (url.startsWith("wss://")) {
    return `https://${url.slice("wss://".length)}`;
  }
  if (url.startsWith("ws://")) {
    return `http://${url.slice("ws://".length)}`;
  }
  return url;
}

function getLiveKitClients() {
  const env = requireLiveKitEnv();
  const host = toApiHost(env.livekitUrl);
  logger.debug("livekit.client.init", { host });
  const sipClient = new SipClient(host, env.livekitApiKey, env.livekitApiSecret);
  const roomServiceClient = new RoomServiceClient(host, env.livekitApiKey, env.livekitApiSecret);
  return {
    sipClient,
    roomServiceClient,
    host,
    config: env,
  };
}

export function assertTelephonyConfig() {
  // We validate both LiveKit and Twilio variables because this app expects
  // LiveKit SIP to be wired to a Twilio trunk.
  requireLiveKitEnv();
  requireTwilioEnv();
  logger.debug("telephony.config.validated");
}

export function buildCallRoomName(investigationId: string, callId: string) {
  return `callagent-${investigationId.slice(-8)}-${callId.slice(-8)}`;
}

export async function dialContactViaLiveKit(input: DialContactInput): Promise<DialContactResult> {
  const { sipClient, config } = getLiveKitClients();
  const roomName = input.roomName ?? buildCallRoomName(input.investigationId, input.callId);
  const participantIdentity = `sip-${input.callId}`;
  logger.info("livekit.dial.start", {
    investigationId: input.investigationId,
    callId: input.callId,
    roomName,
    participantIdentity,
    to: maskPhone(input.phoneNumber),
    trunkId: config.livekitSipTrunkId,
  });

  await assertTrunkSecurityCompatible(sipClient, config.livekitSipTrunkId);

  let participant;
  try {
    participant = await sipClient.createSipParticipant(
      config.livekitSipTrunkId,
      input.phoneNumber,
      roomName,
      {
        participantIdentity,
        participantName: input.participantName,
        waitUntilAnswered: true,
        playDialtone: true,
        fromNumber: config.livekitSipNumber ?? undefined,
        headers: {
          "x-callagent-investigation-id": input.investigationId,
          "x-callagent-call-id": input.callId,
        },
        ringingTimeout: 45,
        maxCallDuration: 8 * 60,
      },
    );
  } catch (error) {
    throw mapDialError(error);
  }

  logger.info("livekit.dial.connected", {
    investigationId: input.investigationId,
    callId: input.callId,
    roomName,
    participantIdentity: participant.participantIdentity,
    sipCallId: participant.sipCallId,
  });

  return {
    roomName,
    participantIdentity,
    participantId: participant.participantId,
    sipCallId: participant.sipCallId,
  };
}

export async function hangupLiveKitParticipant(roomName: string, participantIdentity: string) {
  const { roomServiceClient } = getLiveKitClients();
  logger.info("livekit.hangup.requested", {
    roomName,
    participantIdentity,
  });
  await roomServiceClient.removeParticipant(roomName, participantIdentity).catch((error) => {
    logger.warn("livekit.hangup.failed", {
      roomName,
      participantIdentity,
      error: error instanceof Error ? error.message : String(error),
    });
    // Best effort cleanup: call may already be disconnected.
  });
  logger.info("livekit.hangup.completed", {
    roomName,
    participantIdentity,
  });
}

type WaitForParticipantExitInput = {
  roomName: string;
  participantIdentity: string;
  timeoutSeconds: number;
  pollIntervalMs?: number;
};

export async function waitForSipParticipantExit(input: WaitForParticipantExitInput) {
  const { roomServiceClient } = getLiveKitClients();
  const deadline = Date.now() + input.timeoutSeconds * 1000;
  const pollIntervalMs = input.pollIntervalMs ?? 1500;

  logger.info("livekit.participant.wait.start", {
    roomName: input.roomName,
    participantIdentity: input.participantIdentity,
    timeoutSeconds: input.timeoutSeconds,
  });

  while (Date.now() < deadline) {
    try {
      await roomServiceClient.getParticipant(input.roomName, input.participantIdentity);
    } catch (error) {
      if (isParticipantNotFound(error)) {
        logger.info("livekit.participant.wait.disconnected", {
          roomName: input.roomName,
          participantIdentity: input.participantIdentity,
        });
        return "disconnected";
      }
      logger.warn("livekit.participant.wait.pollError", {
        roomName: input.roomName,
        participantIdentity: input.participantIdentity,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await sleep(pollIntervalMs);
  }

  logger.warn("livekit.participant.wait.timeout", {
    roomName: input.roomName,
    participantIdentity: input.participantIdentity,
    timeoutSeconds: input.timeoutSeconds,
  });
  return "timeout";
}

async function assertTrunkSecurityCompatible(sipClient: SipClient, trunkId: string) {
  const trunks = await sipClient.listSipOutboundTrunk({
    trunkIds: [trunkId],
  });
  const trunk = trunks[0];
  if (!trunk) {
    logger.error("livekit.trunk.missing", { trunkId });
    throw new Error(`LiveKit outbound SIP trunk ${trunkId} not found.`);
  }

  logger.info("livekit.trunk.security", {
    trunkId,
    transport: SIPTransport[trunk.transport],
    mediaEncryption: SIPMediaEncryption[trunk.mediaEncryption],
  });

  if (trunk.transport !== SIPTransport.SIP_TRANSPORT_TLS) {
    throw new Error(
      `LiveKit trunk ${trunkId} uses non-TLS SIP transport. Set transport to SIP_TRANSPORT_TLS for Twilio secure media trunks.`,
    );
  }

  if (trunk.mediaEncryption === SIPMediaEncryption.SIP_MEDIA_ENCRYPT_DISABLE) {
    throw new Error(
      `LiveKit trunk ${trunkId} has media encryption disabled. Set mediaEncryption to SIP_MEDIA_ENCRYPT_ALLOW or SIP_MEDIA_ENCRYPT_REQUIRE.`,
    );
  }
}

function mapDialError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("livekit.dial.failed", { message });
  if (message.includes("32208") || /secure media|srtp/i.test(message)) {
    return new Error(
      "Twilio rejected the INVITE (32208): secure media is required. Configure the LiveKit outbound trunk with TLS transport and SRTP (mediaEncryption allow/require), and ensure the Twilio trunk/domain is Secure Trunking enabled.",
    );
  }
  return error instanceof Error ? error : new Error(message);
}

function isParticipantNotFound(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|unknown participant|could not find|does not exist/i.test(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
