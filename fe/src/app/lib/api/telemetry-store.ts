// ponytail: ring buffer caps memory. Bump when ops actually needs more.
const BUFFER_SIZE = 200;

export interface TelemetryRecord {
  correlationId: string;
  method: string;
  /** Path-only (no query string) so PII in `?email=x` etc. never lands here. */
  path: string;
  /** Null when transport failed before a Response arrived. */
  status: number | null;
  durationMs: number;
  attempts: number;
  errorCode: string | null;
  timestamp: number;
}

const buffer: TelemetryRecord[] = [];

function stripQuery(pathOrUrl: string): string {
  const qIdx = pathOrUrl.indexOf("?");
  return qIdx === -1 ? pathOrUrl : pathOrUrl.slice(0, qIdx);
}

function isDev(): boolean {
  return Boolean((import.meta.env as Record<string, unknown>).DEV);
}

export function recordTelemetry(rec: TelemetryRecord): void {
  const safe: TelemetryRecord = {
    ...rec,
    path: stripQuery(rec.path),
  };
  buffer.push(safe);
  if (buffer.length > BUFFER_SIZE) {
    buffer.splice(0, buffer.length - BUFFER_SIZE);
  }
  if (isDev()) {
    // ponytail: replace with Sentry.addBreadcrumb when telemetry ships.
    // eslint-disable-next-line no-console
    console.debug(
      `[vnshop] ${safe.method} ${safe.path} ${safe.status ?? "—"} ${safe.durationMs}ms attempt=${safe.attempts}`,
    );
  }
}

export function getTelemetry(): readonly TelemetryRecord[] {
  return buffer;
}

export function clearTelemetry(): void {
  buffer.length = 0;
}
