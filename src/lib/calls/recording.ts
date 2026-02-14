import {
  EgressClient,
  EgressStatus,
  EncodedFileOutput,
  EncodedFileType,
  GCPUpload,
} from "livekit-server-sdk";

import { getRecordingConfig, requireLiveKitEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { toApiHost } from "@/lib/calls/livekit";

import { saveCallRecordingMetadata } from "./recording-store";

type StartRecordingInput = {
  investigationId: string;
  callId: string;
  roomName: string;
};

type FinalizeRecordingInput = {
  investigationId: string;
  callId: string;
  roomName: string;
  egressId?: string | null;
  maxWaitSeconds?: number;
};

export async function startLiveKitRoomRecording(input: StartRecordingInput) {
  const recordingConfig = getRecordingConfigSafe(input.investigationId, input.callId);
  if (!recordingConfig || recordingConfig.provider !== "gcp") {
    logger.info("recording.livekit.disabled", {
      investigationId: input.investigationId,
      callId: input.callId,
    });
    return null;
  }

  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP3,
    filepath: buildRecordingFilepath({
      prefix: recordingConfig.gcpPrefix,
      investigationId: input.investigationId,
      callId: input.callId,
    }),
    output: {
      case: "gcp",
      value: new GCPUpload({
        bucket: recordingConfig.gcpBucket,
        credentials: recordingConfig.gcpCredentialsJson,
      }),
    },
  });

  logger.info("recording.livekit.start.requested", {
    investigationId: input.investigationId,
    callId: input.callId,
    roomName: input.roomName,
  });

  try {
    const info = await getEgressClient().startRoomCompositeEgress(input.roomName, { file: output }, {
      audioOnly: true,
    });
    logger.info("recording.livekit.start.accepted", {
      investigationId: input.investigationId,
      callId: input.callId,
      roomName: input.roomName,
      egressId: info.egressId,
    });
    return info.egressId;
  } catch (error) {
    logger.warn("recording.livekit.start.error", {
      investigationId: input.investigationId,
      callId: input.callId,
      roomName: input.roomName,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function finalizeLiveKitRoomRecording(input: FinalizeRecordingInput) {
  if (!input.egressId) {
    return null;
  }

  const recordingConfig = getRecordingConfigSafe(input.investigationId, input.callId);
  if (!recordingConfig || recordingConfig.provider !== "gcp") {
    return null;
  }

  const egressClient = getEgressClient();
  const maxWaitSeconds = input.maxWaitSeconds ?? 40;

  await egressClient.stopEgress(input.egressId).catch((error) => {
    logger.warn("recording.livekit.stop.warning", {
      investigationId: input.investigationId,
      callId: input.callId,
      roomName: input.roomName,
      egressId: input.egressId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  for (let attempt = 0; attempt < maxWaitSeconds; attempt += 1) {
    const infos = await egressClient.listEgress({
      egressId: input.egressId,
    });
    const info = infos[0];

    if (!info) {
      await sleep(1000);
      continue;
    }

    if (info.status === EgressStatus.EGRESS_COMPLETE) {
      const location = info.fileResults[0]?.location || (info.result.case === "file" ? info.result.value.location : "");
      if (!location) {
        logger.warn("recording.livekit.location.missing", {
          investigationId: input.investigationId,
          callId: input.callId,
          roomName: input.roomName,
          egressId: input.egressId,
        });
        return null;
      }

      const saved = await saveCallRecordingMetadata(input.callId, {
        provider: "gcp",
        location,
        egressId: input.egressId,
        createdAt: new Date().toISOString(),
      });

      logger.info("recording.livekit.saved", {
        investigationId: input.investigationId,
        callId: input.callId,
        roomName: input.roomName,
        egressId: input.egressId,
        location,
        publicUrl: saved.publicUrl,
        absolutePath: saved.absolutePath,
      });
      return saved.publicUrl;
    }

    if (
      info.status === EgressStatus.EGRESS_FAILED ||
      info.status === EgressStatus.EGRESS_ABORTED ||
      info.status === EgressStatus.EGRESS_LIMIT_REACHED
    ) {
      logger.warn("recording.livekit.failed", {
        investigationId: input.investigationId,
        callId: input.callId,
        roomName: input.roomName,
        egressId: input.egressId,
        status: info.status,
        error: info.error || info.details || null,
      });
      return null;
    }

    await sleep(1000);
  }

  logger.warn("recording.livekit.finalize.timeout", {
    investigationId: input.investigationId,
    callId: input.callId,
    roomName: input.roomName,
    egressId: input.egressId,
    maxWaitSeconds,
  });
  return null;
}

function buildRecordingFilepath(input: {
  prefix: string;
  investigationId: string;
  callId: string;
}) {
  const chunks = [input.prefix, input.investigationId, `${input.callId}-${Date.now()}.mp3`].filter(Boolean);
  return chunks.join("/");
}

function getEgressClient() {
  const livekit = requireLiveKitEnv();
  return new EgressClient(
    toApiHost(livekit.livekitUrl),
    livekit.livekitApiKey,
    livekit.livekitApiSecret,
  );
}

function getRecordingConfigSafe(investigationId: string, callId: string) {
  try {
    return getRecordingConfig();
  } catch (error) {
    logger.warn("recording.livekit.config.invalid", {
      investigationId,
      callId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
