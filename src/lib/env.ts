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
  GEMINI_REALTIME_MODEL: z.string().min(1).optional(),
  GEMINI_REALTIME_VOICE: z.string().min(1).optional(),
  CALL_SESSION_TIMEOUT_SECONDS: z.string().min(1).optional(),
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
