import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const LEGACY_RECORDINGS_DIR_NAME = "recordings";
const RECORDING_META_DIR = ".callagent-recordings";

type RecordingMetadata = {
  provider: "gcp";
  location: string;
  egressId: string;
  createdAt: string;
};

function getLegacyRecordingFilename(callId: string) {
  return `${callId}.mp3`;
}

function getLegacyRecordingAbsolutePath(callId: string) {
  return path.join(process.cwd(), "public", LEGACY_RECORDINGS_DIR_NAME, getLegacyRecordingFilename(callId));
}

function getLegacyRecordingPublicUrl(callId: string) {
  return `/${LEGACY_RECORDINGS_DIR_NAME}/${getLegacyRecordingFilename(callId)}`;
}

function getRecordingMetadataPath(callId: string) {
  return path.join(process.cwd(), RECORDING_META_DIR, `${callId}.json`);
}

export async function getCallRecordingUrlIfExists(callId: string) {
  const metadata = await getCallRecordingMetadata(callId);
  if (metadata) {
    return `/api/recordings/${callId}`;
  }

  const absolutePath = getLegacyRecordingAbsolutePath(callId);
  try {
    await access(absolutePath);
    return getLegacyRecordingPublicUrl(callId);
  } catch {
    return null;
  }
}

export async function saveCallRecordingMetadata(callId: string, metadata: RecordingMetadata) {
  const absolutePath = getRecordingMetadataPath(callId);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(metadata, null, 2), "utf8");
  return {
    absolutePath,
    publicUrl: `/api/recordings/${callId}`,
  };
}

export async function getCallRecordingMetadata(callId: string): Promise<RecordingMetadata | null> {
  const absolutePath = getRecordingMetadataPath(callId);
  try {
    const raw = await readFile(absolutePath, "utf8");
    const parsed = JSON.parse(raw) as RecordingMetadata;
    if (!parsed?.location || !parsed?.provider) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
