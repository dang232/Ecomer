type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Readonly<Record<string, unknown>>;

const levels: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel: string | undefined = import.meta.env.VITE_LOG_LEVEL;
const minimumLevel: LogLevel =
  configuredLevel === "debug" ||
  configuredLevel === "info" ||
  configuredLevel === "warn" ||
  configuredLevel === "error"
    ? configuredLevel
    : import.meta.env.DEV
      ? "debug"
      : "info";
const sensitiveKey =
  /(authorization|cookie|token|password|secret|email|phone|address|body|payload|query|search|message|stack|componentstack)/i;

function redact(value: unknown, key = ""): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (value instanceof Error) return { name: value.name, message: "[REDACTED]" };
  if (Array.isArray(value)) return value.map((entry) => redact(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redact(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

function write(level: LogLevel, event: string, fields: LogFields): void {
  if (levels[level] < levels[minimumLevel]) return;
  const entry = { event, ...(redact(fields) as LogFields) };
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else if (level === "info") console.info(entry);
  else console.debug(entry);
}

export const logger = {
  debug: (event: string, fields: LogFields = {}) => write("debug", event, fields),
  info: (event: string, fields: LogFields = {}) => write("info", event, fields),
  warn: (event: string, fields: LogFields = {}) => write("warn", event, fields),
  error: (event: string, fields: LogFields = {}) => write("error", event, fields),
};
