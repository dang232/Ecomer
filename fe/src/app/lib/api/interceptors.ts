import type { z } from "zod";

import { getAccessToken, refreshTokens, setLiveTokenSet } from "../auth/native-auth";

import { apiResponseSchema, ApiError, type ApiMeta } from "./envelope";
import { recordTelemetry } from "./telemetry-store";

export interface RequestContext {
  url: string;
  init: RequestInit;
  correlationId: string;
  meta: {
    auth: boolean;
    idempotencyKey?: string;
    hasBody: boolean;
    /** Number of fetch attempts so far. The retry interceptor bumps this. */
    attempts?: number;
    /** Epoch-ms when the original request was kicked off. */
    startedAt?: number;
    /** Method extracted from init so retry/telemetry don't re-parse headers. */
    method?: string;
    /** Path-only (no query) for telemetry PII safety. */
    path?: string;
  };
}

export interface ResponseContext {
  request: RequestContext;
  response: Response;
  /** Pre-parsed JSON body. `null` until a response interceptor populates it. */
  parsed: unknown;
  envelopeMeta?: ApiMeta;
}

export type RequestInterceptor = (ctx: RequestContext) => Promise<RequestContext> | RequestContext;
export type ResponseInterceptor = (
  ctx: ResponseContext,
) => Promise<ResponseContext> | ResponseContext;
/**
 * Error interceptor. Returning a `Response` retries the response pipeline with
 * the new response; returning `void` / `undefined` re-throws the original error.
 */
export type ErrorInterceptor = (
  err: unknown,
  ctx: RequestContext,
) => Promise<Response | void> | Response | void;

/** Coerce `init.headers` into a mutable plain record for interceptor edits. */
function ensureHeaders(init: RequestInit): Record<string, string> {
  const existing = init.headers;
  if (!existing) {
    const headers: Record<string, string> = {};
    init.headers = headers;
    return headers;
  }
  if (existing instanceof Headers) {
    const out: Record<string, string> = {};
    existing.forEach((value, key) => {
      out[key] = value;
    });
    init.headers = out;
    return out;
  }
  if (Array.isArray(existing)) {
    const out: Record<string, string> = {};
    for (const [k, v] of existing) out[k] = v;
    init.headers = out;
    return out;
  }
  return existing;
}

// --- Request interceptors --------------------------------------------------

export const correlationIdInterceptor: RequestInterceptor = (ctx) => {
  const headers = ensureHeaders(ctx.init);
  headers["X-Correlation-Id"] = ctx.correlationId;
  return ctx;
};

export const contentTypeInterceptor: RequestInterceptor = (ctx) => {
  const headers = ensureHeaders(ctx.init);
  headers.Accept = "application/json";
  if (ctx.meta.hasBody) headers["Content-Type"] = "application/json";
  return ctx;
};

export const idempotencyInterceptor: RequestInterceptor = (ctx) => {
  if (!ctx.meta.idempotencyKey) return ctx;
  const headers = ensureHeaders(ctx.init);
  headers["Idempotency-Key"] = ctx.meta.idempotencyKey;
  return ctx;
};

export const authInterceptor: RequestInterceptor = (ctx) => {
  if (!ctx.meta.auth) return ctx;
  const token = getAccessToken();
  if (!token) return ctx;
  const headers = ensureHeaders(ctx.init);
  headers.Authorization = `Bearer ${token}`;
  return ctx;
};

// --- Response interceptors -------------------------------------------------

/** Read body once, parse JSON or throw `INVALID_JSON`. Sets `ctx.parsed`. */
export const jsonParseInterceptor: ResponseInterceptor = async (ctx) => {
  const serverCorrelationId =
    ctx.response.headers.get("x-request-id") ??
    ctx.response.headers.get("x-correlation-id") ??
    ctx.request.correlationId;
  const text = await ctx.response.text();
  if (text.length === 0) return { ...ctx, parsed: null };
  try {
    return { ...ctx, parsed: JSON.parse(text) };
  } catch {
    throw new ApiError(
      ctx.response.status,
      "INVALID_JSON",
      "Server returned non-JSON response",
      serverCorrelationId,
    );
  }
};

/** Maps non-2xx responses to `ApiError`, pulling errorCode/message from the body when present. */
export const errorStatusInterceptor: ResponseInterceptor = (ctx) => {
  if (ctx.response.status === 304) return ctx;
  if (ctx.response.ok) return ctx;
  const serverCorrelationId =
    ctx.response.headers.get("x-request-id") ??
    ctx.response.headers.get("x-correlation-id") ??
    ctx.request.correlationId;
  const parsed = ctx.parsed;
  const code =
    parsed &&
    typeof parsed === "object" &&
    "errorCode" in parsed &&
    typeof (parsed as Record<string, unknown>).errorCode === "string"
      ? ((parsed as Record<string, unknown>).errorCode as string)
      : null;
  const message =
    parsed &&
    typeof parsed === "object" &&
    "message" in parsed &&
    typeof (parsed as Record<string, unknown>).message === "string"
      ? ((parsed as Record<string, unknown>).message as string)
      : `HTTP ${ctx.response.status}`;
  const retryAfterHeader = ctx.response.headers.get("retry-after");
  const retryAfterMs =
    ctx.response.status === 429 && retryAfterHeader
      ? parseRetryAfterMs(retryAfterHeader)
      : undefined;
  throw new ApiError(ctx.response.status, code, message, serverCorrelationId, retryAfterMs);
};

function parseRetryAfterMs(value: string): number | undefined {
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(0, timestamp - Date.now());
}

/**
 * Builds a response interceptor that validates the API envelope against the
 * supplied zod schema. On success it replaces `ctx.parsed` with the unwrapped
 * inner `data`. Throws `ApiError` for malformed envelopes or `success: false`.
 */
export function envelopeInterceptor<TSchema extends z.ZodType>(
  schema: TSchema,
): ResponseInterceptor {
  return (ctx) => {
    const serverCorrelationId =
      ctx.response.headers.get("x-request-id") ??
      ctx.response.headers.get("x-correlation-id") ??
      ctx.request.correlationId;
    const envelope = apiResponseSchema(schema).safeParse(ctx.parsed);
    if (!envelope.success) {
      throw new ApiError(
        ctx.response.status,
        "MALFORMED_RESPONSE",
        envelope.error.message,
        serverCorrelationId,
      );
    }
    if (!envelope.data.success) {
      throw new ApiError(
        ctx.response.status,
        envelope.data.errorCode,
        envelope.data.message,
        serverCorrelationId,
      );
    }
    return { ...ctx, parsed: envelope.data.data, envelopeMeta: envelope.data.meta };
  };
}

// --- Error interceptors ----------------------------------------------------

/** Sentinel thrown by the runner when a 401 response should give the error chain a chance. */
export class UnauthorizedError extends Error {
  readonly response: Response;
  constructor(response: Response) {
    super("Unauthorized");
    this.name = "UnauthorizedError";
    this.response = response;
  }
}

/**
 * On a 401 for an authenticated request, try once to refresh tokens via the
 * httpOnly refresh-token cookie. On success, replay the request. On failure
 * (no cookie, expired cookie, revoked token) clear local auth state and
 * dispatch `auth:unauthorized` so AuthProvider boots us back to /login.
 *
 * The refresh token never enters JS — it's sent automatically by the browser
 * because the auth client uses {@code credentials: "include"}.
 */
export const unauthorizedInterceptor: ErrorInterceptor = async (err, ctx) => {
  if (!(err instanceof UnauthorizedError)) return undefined;
  if (!ctx.meta.auth) return undefined;
  try {
    const next = await refreshTokens();
    setLiveTokenSet(next);
    const headers = ensureHeaders(ctx.init);
    headers.Authorization = `Bearer ${next.accessToken}`;
    return fetch(ctx.url, ctx.init);
  } catch {
    setLiveTokenSet(null);
    window.dispatchEvent(new Event("auth:unauthorized"));
    return undefined;
  }
};

// --- Retry interceptor -----------------------------------------------------

/**
 * Backoff schedule indexed by attempt number (1-based). Attempt 1 has no
 * delay (it just ran). Attempt 2 waits 250ms, attempt 3 waits 750ms, etc.
 * Total of 5 attempts; after the 5th failure the runner re-throws.
 */
const BACKOFFS_MS = [0, 250, 750, 2000, 5000] as const;
const MAX_ATTEMPTS = BACKOFFS_MS.length;

const RETRYABLE_STATUSES = new Set([500, 502, 503, 504, 429]);

function isUnsafeMutation(method: string | undefined, hasIdempotencyKey: boolean): boolean {
  if (!method) return false;
  const upper = method.toUpperCase();
  if (upper !== "POST" && upper !== "PUT" && upper !== "PATCH") return false;
  return !hasIdempotencyKey;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function extractErrorCode(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  return typeof obj.errorCode === "string" ? obj.errorCode : null;
}

/**
 * Defensive path extraction for telemetry. Never leaks the backend base URL
 * into the telemetry buffer — falls back to URL.pathname if meta.path was
 * not populated by the runner.
 */
function safePathFromUrl(url: string, metaPath?: string): string {
  if (metaPath) return metaPath.split("?")[0] ?? metaPath;
  try {
    return new URL(url).pathname;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

/**
 * Replay a request after a 5xx response or a transport failure. Skips
 * non-2xx errors that aren't transient, skips unsafe mutations (POST/PUT/PATCH
 * without an idempotency key), and respects the caller-provided abort signal.
 * 401s are owned by {@link unauthorizedInterceptor} which runs first.
 */
export const retryInterceptor: ErrorInterceptor = async (err, ctx) => {
  if (!(err instanceof ApiError)) return undefined;
  if (err.status === 401) return undefined;
  if (!RETRYABLE_STATUSES.has(err.status)) return undefined;

  const method = ctx.meta.method ?? ctx.init.method ?? "GET";
  if (err.status === 429) {
    if (method.toUpperCase() !== "GET" || (ctx.meta.attempts ?? 1) >= 2) return undefined;
    const signal = ctx.init.signal ?? undefined;
    try {
      await delay(
        Math.min(err.retryAfterMs ?? 0, 5_000),
        signal instanceof AbortSignal ? signal : undefined,
      );
    } catch {
      return undefined;
    }
    ctx.meta.attempts = 2;
    return fetch(ctx.url, ctx.init);
  }

  const attempts = (ctx.meta.attempts ?? 1) + 1;
  if (attempts > MAX_ATTEMPTS) {
    recordTelemetry({
      correlationId: ctx.correlationId,
      method: ctx.meta.method ?? ctx.init.method ?? "GET",
      path: safePathFromUrl(ctx.url, ctx.meta.path),
      status: err.status,
      durationMs: Date.now() - (ctx.meta.startedAt ?? Date.now()),
      attempts: MAX_ATTEMPTS,
      errorCode: err.errorCode,
      timestamp: Date.now(),
    });
    return undefined;
  }

  if (isUnsafeMutation(method, Boolean(ctx.meta.idempotencyKey))) return undefined;

  const signal = ctx.init.signal ?? undefined;
  const waitMs = BACKOFFS_MS[attempts - 1];
  try {
    await delay(waitMs, signal instanceof AbortSignal ? signal : undefined);
  } catch {
    return undefined;
  }

  ctx.meta.attempts = attempts;
  const next = await fetch(ctx.url, ctx.init);
  // If the retry fetch returned 401 (token expired mid-retry sequence),
  // surface it as UnauthorizedError so unauthorizedInterceptor gets a
  // chance to refresh and replay on the NEXT chain pass — otherwise the
  // caller would see a 5xx error masking an auth expiry.
  if (next.status === 401 && ctx.meta.auth) {
    throw new UnauthorizedError(next);
  }
  return next;
};

// --- Telemetry interceptor -------------------------------------------------

/**
 * Records one {@link TelemetryRecord} per response (including non-2xx).
 *
 * Lives BEFORE errorStatusInterceptor so non-2xx responses still reach
 * telemetry (otherwise errorStatusInterceptor would throw first and the
 * record would never fire). Body is parsed by jsonParseInterceptor which
 * runs first, so errorCode extraction still works. Sits before
 * envelopeInterceptor so we record the wire-level status, not the envelope
 * shape.
 */
export const telemetryInterceptor: ResponseInterceptor = (ctx) => {
  const correlationId =
    ctx.response.headers.get("x-request-id") ??
    ctx.response.headers.get("x-correlation-id") ??
    ctx.request.correlationId;
  const errorCode = ctx.response.ok ? null : extractErrorCode(ctx.parsed);
  const startedAt = ctx.request.meta.startedAt ?? Date.now();
  recordTelemetry({
    correlationId,
    method: ctx.request.meta.method ?? ctx.request.init.method ?? "GET",
    path: safePathFromUrl(ctx.request.url, ctx.request.meta.path),
    status: ctx.response.status,
    durationMs: Date.now() - startedAt,
    attempts: ctx.request.meta.attempts ?? 1,
    errorCode,
    timestamp: Date.now(),
  });
  return ctx;
};
