import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),

  LIVEKIT_URL: z.string().url().optional(),
  LIVEKIT_API_KEY: z.string().min(1).optional(),
  LIVEKIT_API_SECRET: z.string().min(1).optional(),
  LIVEKIT_SIP_TRUNK_ID: z.string().min(1).optional(),
  LIVEKIT_SIP_NUMBER: z.string().min(1).optional(),
  LIVEKIT_AGENT_NAME: z.string().min(1).optional(),

  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_SIP_TRUNK_SID: z.string().min(1).optional(),

  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_INTAKE_MODEL: z.string().min(1).optional(),
  GEMINI_REALTIME_MODEL: z.string().min(1).optional(),
  GEMINI_REALTIME_VOICE: z.string().min(1).optional(),
  CALL_SESSION_TIMEOUT_SECONDS: z.string().min(1).optional(),

  RECORDING_PROVIDER: z.string().min(1).optional(),
  RECORDING_GCP_BUCKET: z.string().min(1).optional(),
  RECORDING_GCP_PREFIX: z.string().min(1).optional(),
  RECORDING_GCP_CREDENTIALS_B64: z.string().min(1).optional(),
});

type Environment = z.infer<typeof environmentSchema>;

let cache: Environment | null = null;

export function getEnv() {
  if (cache) {
    return cache;
  }

  const parsed = environmentSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }

  cache = parsed.data;
  return cache;
}

export function requireLiveKitEnv() {
  const env = getEnv();
  const required = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_SIP_TRUNK_ID"] as const;

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required env var ${key}.`);
    }
  }

  return {
    livekitUrl: env.LIVEKIT_URL!,
    livekitApiKey: env.LIVEKIT_API_KEY!,
    livekitApiSecret: env.LIVEKIT_API_SECRET!,
    livekitSipTrunkId: env.LIVEKIT_SIP_TRUNK_ID!,
    livekitSipNumber: env.LIVEKIT_SIP_NUMBER ?? null,
  };
}

export function requireTwilioEnv() {
  const env = getEnv();
  const required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SIP_TRUNK_SID"] as const;

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required env var ${key}.`);
    }
  }

  return {
    twilioAccountSid: env.TWILIO_ACCOUNT_SID!,
    twilioAuthToken: env.TWILIO_AUTH_TOKEN!,
    twilioSipTrunkSid: env.TWILIO_SIP_TRUNK_SID!,
  };
}

export function requireGeminiEnv() {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    throw new Error("Missing required env var GEMINI_API_KEY.");
  }

  return {
    geminiApiKey: env.GEMINI_API_KEY,
    geminiIntakeModel: env.GEMINI_INTAKE_MODEL ?? "gemini-3-pro-preview",
    geminiRealtimeModel: env.GEMINI_REALTIME_MODEL ?? "gemini-2.5-flash-native-audio-preview-12-2025",
    geminiRealtimeVoice: env.GEMINI_REALTIME_VOICE ?? "Puck",
  };
}

export function getAgentConfig() {
  const env = getEnv();
  const timeoutRaw = Number(env.CALL_SESSION_TIMEOUT_SECONDS ?? "120");
  const callSessionTimeoutSeconds =
    Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.round(timeoutRaw) : 120;

  return {
    livekitAgentName: env.LIVEKIT_AGENT_NAME ?? "callagent-telephony-agent",
    callSessionTimeoutSeconds,
  };
}

type RecordingConfig = {
  provider: "gcp";
  gcpBucket: string;
  gcpPrefix: string;
  gcpCredentialsJson: string;
  gcpCredentials: Record<string, unknown>;
};

export function getRecordingConfig(): RecordingConfig | null {
  const env = getEnv();
  const providerRaw = (env.RECORDING_PROVIDER ?? "").trim().toLowerCase();
  const hasGcpFields = !!env.RECORDING_GCP_BUCKET && !!env.RECORDING_GCP_CREDENTIALS_B64;
  const useGcp = providerRaw === "gcp" || (!providerRaw && hasGcpFields);

  if (!useGcp) {
    return null;
  }

  if (!env.RECORDING_GCP_BUCKET) {
    throw new Error("Missing required env var RECORDING_GCP_BUCKET for GCP recording.");
  }
  if (!env.RECORDING_GCP_CREDENTIALS_B64) {
    throw new Error("Missing required env var RECORDING_GCP_CREDENTIALS_B64 for GCP recording.");
  }

  let gcpCredentialsJson = "";
  let gcpCredentials: Record<string, unknown> = {};
  try {
    gcpCredentialsJson = Buffer.from(env.RECORDING_GCP_CREDENTIALS_B64, "base64").toString("utf8");
    gcpCredentials = JSON.parse(gcpCredentialsJson) as Record<string, unknown>;
  } catch {
    throw new Error(
      "RECORDING_GCP_CREDENTIALS_B64 is invalid. Use base64 of the raw GCP service account JSON file.",
    );
  }

  return {
    provider: "gcp",
    gcpBucket: env.RECORDING_GCP_BUCKET,
    gcpPrefix: sanitizePrefix(env.RECORDING_GCP_PREFIX ?? "zeppy/recordings"),
    gcpCredentialsJson,
    gcpCredentials,
  };
}

function sanitizePrefix(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
}
