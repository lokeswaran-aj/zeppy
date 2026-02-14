type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_LEVEL: LogLevel = "info";

function getConfiguredLevel(): LogLevel {
  const raw = (process.env.CALLAGENT_LOG_LEVEL ?? DEFAULT_LEVEL).toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return DEFAULT_LEVEL;
}

function shouldLog(level: LogLevel) {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getConfiguredLevel()];
}

function format(level: LogLevel, event: string, meta?: Record<string, unknown>) {
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...(meta ? { meta } : {}),
  });
}

function write(level: LogLevel, event: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) {
    return;
  }

  const line = format(level, event, meta);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  debug: (event: string, meta?: Record<string, unknown>) => write("debug", event, meta),
  info: (event: string, meta?: Record<string, unknown>) => write("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => write("warn", event, meta),
  error: (event: string, meta?: Record<string, unknown>) => write("error", event, meta),
};

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D+/g, "");
  if (digits.length <= 4) {
    return phone;
  }
  const last4 = digits.slice(-4);
  return `***${last4}`;
}
